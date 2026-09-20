#!/usr/bin/env node
// The installer for StarCi. The runtime is a tree of files under <repo>/.claude plus one managed
// bootstrap file at the repo root (AGENTS.md by default; CLAUDE.md/DEVIN.md only when the host opts
// in via --hosts). Nothing here is a framework the tree depends on at run time. The CLI has no
// dependencies and needs Node 22.13+.
//
//   npx starci init            install the tree into ./.claude and write the bootstrap
//   npx starci update          bring an installed tree to this package's version
//   npx starci doctor          run the tree's own validators on the installed copy
//   npx starci version
//
// Every command takes --dir <repo> (default: the current directory). init refuses a non-empty
// .claude it did not install unless --force; update keeps a file a person changed locally unless
// --force; neither ever runs a git command.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, statSync, lstatSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

// ENGINE_SCHEMA names the durable workflow protocol marker recorded in the install manifest. It lives
// in engine/constants.mjs — which is itself payload, so a partially written package may not have it.
// Resolve lazily: version/help must still answer on a broken tree; init/update/doctor fail loudly.
const engineConstants = await import('../../engine/constants.mjs').catch((error) => {
  if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error?.message ?? '').includes('constants.mjs')) return null;
  throw error;
});
const requireEngineSchema = () => {
  if (typeof engineConstants?.ENGINE_SCHEMA !== 'string') throw new Error('package is incomplete: engine/constants.mjs is missing');
  return engineConstants.ENGINE_SCHEMA;
};

// What an installed tree is made of. Only these paths are copied, hashed and updated; anything else
// a person adds beside them (other tests, notes) is theirs and is never touched. The payload equals
// the npm `files` allowlist — the installed tree must be byte-identical to the published tarball —
// so `!` negations are compiled into the walker and root globs like `*.md` expand to real files.
const rootGlob = (entry) => {
  const m = /^\*\.([A-Za-z0-9]+)$/.exec(entry);
  if (!m) throw new Error(`unsupported files glob in package.json: ${entry}`);
  return readdirSync(packageRoot, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(`.${m[1]}`)).map((e) => e.name);
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The `!a/**/b/` negation shape is the only one the files list uses: `a` is a fixed root, `b` the
// pruned leaf at any depth (`packages/**/node_modules` covers `packages/node_modules` too).
const PAYLOAD_NEGATIONS = pkg.files.filter((f) => f.startsWith('!')).map((f) => {
  const parts = f.slice(1).replace(/\/+$/, '').split('/**/');
  if (parts.length !== 2 || parts.some((p) => p.includes('*'))) throw new Error(`unsupported files negation in package.json: ${f}`);
  return new RegExp(`^${escapeRe(parts[0])}/(?:.+/)?${escapeRe(parts[1])}(?:/|$)`);
});
const isNegated = (relative) => PAYLOAD_NEGATIONS.some((rx) => rx.test(relative));
export const PAYLOAD = [...new Set(['package.json', ...pkg.files.filter((f) => !f.startsWith('!')).flatMap((f) => f.includes('*') ? rootGlob(f) : [f.replace(/\/$/, '')])])];
const MANIFEST = '.starci-skills.json';
// The durable workflow protocol an installed tree speaks, independent of public semver: named by the
// engine schema it enrolls workflows into, ranked by that schema's number. A receipt from before
// public 1.0 - a numbered marker or none at all - is the pre-release protocol, ranked below every
// public engine.
const INSTALL_PROTOCOL_SCHEMA = 'starci/install-protocol@2';
const installProtocol = () => Object.freeze({ schema: INSTALL_PROTOCOL_SCHEMA, engine: requireEngineSchema() });
const PRE_RELEASE_PROTOCOL_SCHEMA = 'starci/install-protocol@1';
const engineRank = (engine) => { const m = /^starci\/engine@(\d+)$/.exec(String(engine ?? '')); return m ? Number(m[1]) : null; };
// Host-level ignores written into the host repo's own .gitignore: the ledger/runtime state is local
// to the checkout and the seeded owner config is untracked by contract.
const HOST_IGNORES = ['.starciwork/', '.claude/config.yaml'];
// Ignores inside the installed tree itself (its .claude/.gitignore): the seeded config plus the
// config.json name used by pre-yaml installs so an upgraded tree keeps it untracked.
const INSTALLED_IGNORES = ['/config.yaml', '/config.json'];
const ENTRY_MARKER = '<!-- starci:prompt-entry -->';
const LEGACY_PROMPT_ENTRY = `${ENTRY_MARKER}
For every user prompt, enter [StarCi](.claude/INDEX.md) before planning or target work and follow
the entry's user-session and goal protocol. Follow-up prompts reuse that host session.
<!-- /starci:prompt-entry -->`;
const PREVIOUS_V3_PROMPT_ENTRY = `${ENTRY_MARKER}
For product development work, enter [StarCi](.claude/INDEX.md) and select the bounded operation
covered by the user's request. Track current product completion in .work; stop after the selected
operation or explicitly approved parallel group. Questions do not require a work ledger.
<!-- /starci:prompt-entry -->`;
const CAPPED_V3_PROMPT_ENTRY = `${ENTRY_MARKER}
For product development work, enter [StarCi](.claude/INDEX.md) and select a bounded op chain
from the user's scope: at most three sequential waves, each with at most three concurrent ops.
Track current product completion in .work; hand off remaining work when the prompt budget ends.
Questions do not require a work ledger.
<!-- /starci:prompt-entry -->`;
const PRESET_PROMPT_ENTRY = `${ENTRY_MARKER}
For product development, enter [StarCi](.claude/INDEX.md), match the prompt to a named preset skill,
and use its fixed bounded op chain. Across the prompt: at most three sequential waves and three
concurrent ops per wave. Track selected scope and evidence in .work; do not invent workflows.
Questions need no work ledger. Hand off work outside the selected scope or remaining budget.
<!-- /starci:prompt-entry -->`;

const DIRECT_TASK_PROMPT_ENTRY = `${ENTRY_MARKER}
Use the single [StarCi skill](.claude/SKILL.md) to select one workflow from .claude/workflows/catalog.json.
Use direct-task for ad hoc work that does not fit a specialized workflow. Keep the selected matrix
within three sequential rows and three parallel primary cells; verify requested outcomes before advancing.
Questions may stay read-only. Preserve existing scope, evidence and user changes.
<!-- /starci:prompt-entry -->`;
// The same direct-task entry as the build era wrote it, kept only so `update` recognizes and replaces
// it. It is never installed: the runtime reads source directly, there is nothing to build first.
const BUILD_ERA_DIRECT_TASK_ENTRY = DIRECT_TASK_PROMPT_ENTRY.replace(
  'Questions may stay read-only.',
  'Questions may stay read-only. Check/build .dist first.');

const PREVIOUS_BOOTSTRAP = `# StarCi agent bootstrap

${DIRECT_TASK_PROMPT_ENTRY}

Read [\`<Source>/.claude/SKILL.md\`](.claude/SKILL.md) completely and follow its load order.

\`<Source>\` is the single host repository that owns this bootstrap and the \`.claude\` runtime. A routed
repository checkout or Git worktree follows that Source; do not rebind \`<Source>\` to it or expect it to
contain another \`.claude/SKILL.md\`.

This file is only a bootstrap. Do not copy context, brainstorm, compiler, gate or skill rules into it:
the entry routes, and a rule copied here becomes a second home that nobody remembers to update.
`;

// Generation-2 template (`.workspaces` + storage-sentence era), frozen as a literal so `update` can
// still recognize bootstraps installed by that generation no matter how the shipped template is
// reworded. Historical storage-sentence variants are reconstructed from THIS text, never from the
// current template - a reworded template must not silently break recognition of older installs.
const STORAGE_TEMPLATE = `# StarCi agent bootstrap

${ENTRY_MARKER}
Read the single [StarCi skill](.claude/SKILL.md) completely before project work and follow its load order.

This directory is the host (\`Source\`): it owns these bootstrap files, \`.claude\` and \`.workspaces\`.
Resolve the selected project through \`.workspaces/projects/<project>/work.json\`, following
[workspace routing](.claude/schemas/workspace-routing.yaml) - the runtime reads source directly.
The project's backend owns shared \`.starciwork\`; its runtime record is the ledger \`.starciwork/runtime.sqlite\` for both backend and frontend.
The frontend is a source repository. Entering it does not move Source or create another workspace.

Carry the resolved host, project binding and project skill path when delegating work or changing
directories. A task opened outside the host must receive that context explicitly.
This file locates the runtime; workflow selection, goal confirmation and evidence rules live there.
<!-- /starci:prompt-entry -->
`;
// The storage sentence the generation-2 template carried, and every sentence it carried before.
// `_local/plans` is the variant the 1.0.4 cutover retired (docs/ledger-db.md §13); it stays here as
// something to recognize, never as something to install.
const STORAGE_SENTENCE = "The project's backend owns shared `.starciwork`; its runtime record is the ledger `.starciwork/runtime.sqlite` for both backend and frontend.";
const PLAN_STORAGE_SENTENCE = "The project's backend owns shared `.starciwork`; Plan/run state lives inside `.starciwork/_local/plans` for both backend and frontend.";
const SPLIT_STORAGE_SENTENCE = "The project's backend owns the shared `.starciwork` and sibling `.starcitemp` for both backend and frontend.";
const entryOf = text => text.match(/<!-- starci:prompt-entry -->[\s\S]*?<!-- \/starci:prompt-entry -->/)?.[0];
const withStorageSentence = sentence => STORAGE_TEMPLATE.replace(STORAGE_SENTENCE, sentence);
const STORAGE_ENTRY = entryOf(STORAGE_TEMPLATE);
const PLAN_STORAGE_BOOTSTRAP = withStorageSentence(PLAN_STORAGE_SENTENCE);
const PLAN_STORAGE_ENTRY = entryOf(PLAN_STORAGE_BOOTSTRAP);
const SPLIT_STORAGE_BOOTSTRAP = withStorageSentence(SPLIT_STORAGE_SENTENCE);
const SPLIT_STORAGE_ENTRY = entryOf(SPLIT_STORAGE_BOOTSTRAP);
const PRE_RENAME_BOOTSTRAP = SPLIT_STORAGE_BOOTSTRAP.replaceAll('.starciwork', '.work').replaceAll('.starcitemp', '.starci');
const PRE_RENAME_ENTRY = entryOf(PRE_RENAME_BOOTSTRAP);
// Without this the reconstruction above degrades into a no-op the moment the literal is edited, and
// every older installed bootstrap silently stops being recognized - which reads as "nothing to
// migrate", not as a bug.
if (!STORAGE_TEMPLATE.includes(STORAGE_SENTENCE) || !STORAGE_ENTRY) throw new Error('Storage-era bootstrap literal no longer carries the storage sentence its legacy variants are built from');

// The one shipped template. CLAUDE.md/DEVIN.md are not stored: when a host opts into those names the
// installer writes byte-identical copies of this same file.
const BOOTSTRAP = readFileSync(path.join(packageRoot, 'init/AGENTS.md'), 'utf8');
const PROMPT_ENTRY = entryOf(BOOTSTRAP);
if (!PROMPT_ENTRY) throw new Error('init/AGENTS.md must carry the managed starci:prompt-entry block');

const LEGACY_LITE_ENTRY = `${ENTRY_MARKER}
For every user prompt, enter [StarCi Lite](.claude/skills/starci-lite/SKILL.md) and use its scope classification.
Existing full workflows keep their current session and gates; formal UAT and publication use full StarCi.
<!-- /starci:prompt-entry -->`;
const PREVIOUS_V3_LITE_ENTRY = `${ENTRY_MARKER}
For bounded maintenance, enter [StarCi Lite](.claude/skills/starci-lite/SKILL.md).
For tracked business work, use [StarCi](.claude/SKILL.md) and its selected-operation contract.
Do not create an automatic chain or migrate existing workflow evidence implicitly.
<!-- /starci:prompt-entry -->`;
const LITE_ENTRY = `${ENTRY_MARKER}
For bounded maintenance, enter [StarCi Lite](.claude/skills/starci-lite/SKILL.md).
For tracked business work, use [StarCi](.claude/SKILL.md) and its scope-bounded chain limits.
Do not run an unbounded chain or migrate existing workflow evidence implicitly.
<!-- /starci:prompt-entry -->`;
const LITE_BOOTSTRAP = PREVIOUS_BOOTSTRAP.replace(DIRECT_TASK_PROMPT_ENTRY, LITE_ENTRY)
  .replace('Read [`<Source>/.claude/SKILL.md`](.claude/SKILL.md) completely and follow its load order.',
    'Read [StarCi Lite](.claude/skills/starci-lite/SKILL.md) first; it routes complex work to the full entry.');
function selectedProfile(opts, manifest) {
  if (opts.profile !== undefined && opts.profile !== 'full') throw new Error('starci-lite is retired; use the full prompt-to-skill entry');
  if (manifest?.profile === 'lite' && opts.bootstrap === false) throw new Error('retired Lite bootstrap must be migrated before removing its installed skill; omit --no-bootstrap and review host instructions');
  return 'full';
}

// Hosts the installer can write a bootstrap for. AGENTS.md is always the canonical write; claude/devin
// emit copies of the same template only when the host names them (`--hosts claude,devin` or `all`).
const HOST_BOOTSTRAP_FILES = { agents: 'AGENTS.md', claude: 'CLAUDE.md', devin: 'DEVIN.md' };
const HOST_BOOTSTRAP_NAMES = Object.values(HOST_BOOTSTRAP_FILES);
function parseHosts(value) {
  const hosts = String(value ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  const known = new Set([...Object.keys(HOST_BOOTSTRAP_FILES), 'all']);
  const bad = hosts.filter((h) => !known.has(h));
  if (bad.length) throw new Error(`unknown --hosts value ${bad.join(', ')}; expected a comma list of ${[...known].join(', ')}`);
  if (hosts.includes('all')) return Object.keys(HOST_BOOTSTRAP_FILES);
  return hosts;
}

function parseArgs(argv) {
  const out = { command: argv[0] ?? 'help', dir: process.cwd(), force: false, quick: false, bootstrap: true, upgradeMajor: false, hosts: [] };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dir') out.dir = path.resolve(argv[++i] ?? '.');
    else if (a.startsWith('--dir=')) out.dir = path.resolve(a.slice(6));
    else if (a === '--profile') out.profile = argv[++i];
    else if (a.startsWith('--profile=')) out.profile = a.slice(10);
    else if (a === '--hosts') out.hosts = parseHosts(argv[++i]);
    else if (a.startsWith('--hosts=')) out.hosts = parseHosts(a.slice(8));
    else if (a === '--force') out.force = true;
    else if (a === '--quick') out.quick = true;
    else if (a === '--no-bootstrap') out.bootstrap = false;
    else if (a === '--upgrade-major') out.upgradeMajor = true;
    else if (a === '-h' || a === '--help') out.command = 'help';
    else throw new Error(`unknown argument ${a}`);
  }
  if (out.profile !== undefined && out.profile !== 'full') throw new Error('only the full prompt-to-skill entry is supported; Lite is retired');
  if (argv.includes('--profile') && out.profile === undefined) throw new Error('--profile requires full');
  return out;
}

// `docs/` and `examples/` ship only authored reference files, matching the retired build's payload
// rules. An `examples/<name>/` stack kit (its `.starcistacks/` tree plus sibling `scripts/`, `gateway/`
// and `.gitignore` support files) additionally ships shell/config/Dockerfile inputs — but never
// materialized runtime or generated output, never a plaintext secret beside its sealed `.enc`
// counterpart, and never a `.mjs` automation source.
const stackKitPath = (relative) => /^examples\/[^/]+\/(\.starcistacks(\/|$)|scripts\/|gateway\/|\.gitignore$)/.test(relative);
const payloadDocAllowed = (root, relative) => {
  if (stackKitPath(relative)) {
    if (/\/(runtime|generated|\.runtime|node_modules|\.scannerwork)(\/|$)/.test(relative)) return false;
    const absolute = path.join(root, relative);
    if (!relative.endsWith('.enc') && existsSync(absolute + '.enc')) return false;
    if (/\.mjs$/.test(relative)) return false;
    return /\.(md|ya?ml|tsx?|png|svg|sh|ps1|conf)$/.test(relative)
      || ['Dockerfile', '.gitignore', '.dockerignore'].includes(path.basename(relative));
  }
  if (/^examples\/[^/]+\.ya?ml$/.test(relative)) return false;
  return /\.(md|ya?ml|tsx?|png|svg)$/.test(relative);
};
const PAYLOAD_DOC_ROOT = /^(examples|docs)\//;
const payloadFileAllowed = (root, relative) => !PAYLOAD_DOC_ROOT.test(relative) || payloadDocAllowed(root, relative);

function walk(root, rel = '') {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return payloadFileAllowed(root, rel) ? [rel] : [];
  const out = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const next = rel ? `${rel}/${e.name}` : e.name;
    // Match npm payload semantics: dependency trees, VCS internals and `files` negations never ship,
    // and a junction/symlink entry is not ours to copy (a fixture may carry one inside node_modules).
    if (e.isSymbolicLink() || e.name === 'node_modules' || e.name === '.git' || isNegated(next)) continue;
    if (e.isDirectory()) out.push(...walk(root, next));
    else if (payloadFileAllowed(root, next)) out.push(next);
  }
  return out;
}
const sha = (file) => createHash('sha256').update(readFileSync(file).toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
export const payloadFiles = (root) => PAYLOAD.flatMap((p) => walk(root, p)).sort();
const hashTree = (root) => Object.fromEntries(payloadFiles(root).map((rel) => [rel, sha(path.join(root, rel))]));

function readManifest(target) {
  const file = path.join(target, MANIFEST);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}
function writeManifest(target, kept = [], profile = 'full', bootstrapProfile = null) {
  const manifest = { name: pkg.name, version: pkg.version, installProtocol: installProtocol(), profile, bootstrapProfile, installedAt: new Date().toISOString(), files: hashTree(target) };
  if (kept.length) manifest.keptLocal = kept;
  writeFileSync(path.join(target, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function copyPayload(target) {
  for (const relative of PAYLOAD) {
    if (!existsSync(path.join(packageRoot, relative))) throw new Error(`package is incomplete: ${relative} is missing`);
  }
  // Copy declared files, never recursively replace user-populated directories.
  // Obsolete files are handled only by the separately ownership-checked retirement plan.
  for (const relative of payloadFiles(packageRoot)) {
    const to = path.join(target, relative);
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(path.join(packageRoot, relative), to);
  }
}

function safePayloadTarget(target) {
  const inspect = file => {
    const stat = lstatSync(file, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new Error('installer payload target contains a symlink/junction; resolve ownership before updating');
    if (stat.isDirectory()) for (const name of readdirSync(file)) inspect(path.join(file, name));
  };
  if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('installer .claude target must not be a symlink/junction');
  for (const relative of [...PAYLOAD, MANIFEST]) inspect(path.join(target, relative));
}

// Plan host changes before any payload mutation. Only exact installer-owned text is replaced.
// AGENTS.md is always planned; CLAUDE.md/DEVIN.md enter the plan only when the host opted in.
function bootstrapPlan(repo, opts) {
  for (const name of [...HOST_BOOTSTRAP_NAMES, '.gitignore']) {
    const stat = lstatSync(path.join(repo, name), { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(name + ': bootstrap target must be a regular owned file, not a symlink/junction');
  }
  const names = ['AGENTS.md', ...(opts.hosts ?? []).map((h) => HOST_BOOTSTRAP_FILES[h]).filter((n) => n && n !== 'AGENTS.md')];
  const entry = PROMPT_ENTRY;
  const bootstrap = BOOTSTRAP;
  return names.map(name => {
    const file = path.join(repo, name);
    if (!existsSync(file)) return { name, file, text: bootstrap, action: 'wrote' };
    const current = readFileSync(file, 'utf8');
    const managedEntries = [PROMPT_ENTRY, STORAGE_ENTRY, PLAN_STORAGE_ENTRY, SPLIT_STORAGE_ENTRY, PRE_RENAME_ENTRY, DIRECT_TASK_PROMPT_ENTRY, BUILD_ERA_DIRECT_TASK_ENTRY, PRESET_PROMPT_ENTRY, CAPPED_V3_PROMPT_ENTRY, LITE_ENTRY, PREVIOUS_V3_PROMPT_ENTRY, PREVIOUS_V3_LITE_ENTRY, LEGACY_PROMPT_ENTRY, LEGACY_LITE_ENTRY];
    const customProtocol = managedEntries.reduce((text, managed) => text.replace(managed, ''), current.replace(/\r\n/g, '\n'));
    if (/session-open\.mjs|plan-chain\.mjs|validated request\.json|Nothing is designed, written or committed outside a session/.test(customProtocol)) {
      throw new Error(name + ': custom v2 session/chain protocol conflicts with v3; reconcile it or use --no-bootstrap before changing payload');
    }
    const legacyBootstrap = BOOTSTRAP.replace(PROMPT_ENTRY, LEGACY_PROMPT_ENTRY);
    const legacyLiteBootstrap = LITE_BOOTSTRAP.replace(LITE_ENTRY, LEGACY_LITE_ENTRY);
    for (const known of [BOOTSTRAP, STORAGE_TEMPLATE, PLAN_STORAGE_BOOTSTRAP, SPLIT_STORAGE_BOOTSTRAP, PRE_RENAME_BOOTSTRAP, PREVIOUS_BOOTSTRAP, ...[PRESET_PROMPT_ENTRY, CAPPED_V3_PROMPT_ENTRY, PREVIOUS_V3_PROMPT_ENTRY, LEGACY_PROMPT_ENTRY, BUILD_ERA_DIRECT_TASK_ENTRY].map(entry => PREVIOUS_BOOTSTRAP.replace(DIRECT_TASK_PROMPT_ENTRY, entry)), BOOTSTRAP.replace(PROMPT_ENTRY, PRESET_PROMPT_ENTRY), STORAGE_TEMPLATE.replace(STORAGE_ENTRY, PRESET_PROMPT_ENTRY), LITE_BOOTSTRAP, BOOTSTRAP.replace(PROMPT_ENTRY, CAPPED_V3_PROMPT_ENTRY), BOOTSTRAP.replace(PROMPT_ENTRY, PREVIOUS_V3_PROMPT_ENTRY), LITE_BOOTSTRAP.replace(LITE_ENTRY, PREVIOUS_V3_LITE_ENTRY), legacyBootstrap, legacyLiteBootstrap]) {
      const normalized = current.replace(/\r\n/g, '\n'), authored = known.replace(/\r\n/g, '\n');
      if (normalized.startsWith(authored)) {
        let end = 0, count = 0;
        while (count < authored.length) { if (!(current[end] === '\r' && current[end + 1] === '\n')) count++; end++; }
        const suffix = current.slice(end);
        return { name, file, text: bootstrap + suffix, action: 'updated' };
      }
    }
    const managed = managedEntries.find(value => current.includes(value));
    if (managed) {
      return { name, file, text: current.replace(managed, entry), action: 'updated' };
    }
    if (current.includes(ENTRY_MARKER)) {
      throw new Error(name + ': custom StarCi entry needs explicit reconciliation; refusing a mixed v2/v3 bootstrap before payload writes');
    }
    return { name, file, text: current + (current.endsWith('\n') ? '\n' : '\n\n') + entry + '\n', action: 'updated' };
  });
}
function writeBootstraps(repo, log, plan) {
  for (const { name, file, text, action } of plan) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
    log(action + ' ' + name + ' (preserved custom instructions)');
  }
  const ignore = path.join(repo, '.gitignore');
  const lines = existsSync(ignore) ? readFileSync(ignore, 'utf8').split(/\r?\n/) : [];
  const missing = HOST_IGNORES.filter((entry) => !lines.some((l) => l.trim() === entry || l.trim() === '/' + entry));
  if (missing.length) {
    appendFileSync(ignore, `${lines.length && lines.at(-1) !== '' ? '\n' : ''}# StarCi: ledger/runtime state and the seeded owner config are local to this checkout\n${missing.join('\n')}\n`);
    for (const entry of missing) log(`added ${entry} to .gitignore`);
  }
}

// Even --no-bootstrap must not leave host instructions pointing at removed runtime paths. The retired
// set names paths the old engines owned inside .claude that no longer exist there; `scripts/`,
// `modules/`, `engine/`, `skills/`, `docs/`, `examples/`, `tests/`, `knowledge/`,
// `packages/`, `init/`, `bin/` are all still live and deliberately absent from the pattern.
const RETIRED_HOST_REFERENCE = /\.claude\/(?:workflows|hosts|cli|execution|contracts|approvals|specifications|schemas|kernel|sqlite|upgrades|models?|core|fixtures|legacy|ops|v3|alias|operators|profiles|checks|readiness|resources|templates|providers)\/|\.claude\/(?:INDEX(?:\.vi)?\.md|INDEX\.yaml|routing\.json)\b|\.claude\/skills\/starci-(?:lite|goal|migrate|business|architecture|build|redesign-fe|visual|content|uat|fix|data|runtime|release|maintain)\/|session-open\.mjs|plan-chain\.mjs|validated request\.json/;
function checkRetiredHostReferences(repo, plan) {
  for (const name of HOST_BOOTSTRAP_NAMES) {
    const file = path.join(repo, name);
    const stat = lstatSync(file, { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(name + ': host instructions must be a regular file before runtime retirement');
    const text = plan?.find(item => item.name === name)?.text ?? (stat ? readFileSync(file, 'utf8') : '');
    if (!text) continue;
    const hostFlag = name === 'CLAUDE.md' ? 'claude' : name === 'DEVIN.md' ? 'devin' : null;
    const hint = hostFlag && !plan?.some(item => item.name === name) ? `; reconcile it or pass --hosts ${hostFlag} to let the installer rewrite the file` : '';
    if (text.replace(/\r\n/g, '\n').includes(PRESET_PROMPT_ENTRY) || RETIRED_HOST_REFERENCE.test(text)) {
      throw new Error(name + ': host instructions still require retired runtime paths' + hint);
    }
  }
}

/**
 * What protocol an installed tree speaks: `{rank, label, modern}`. `rank` orders engines; `modern`
 * says the tree has the current layout (the kernel api gate). A malformed marker is refused, never
 * guessed.
 */
function installedProtocol(manifest) {
  if (!manifest) return null;
  if (manifest.installProtocol !== undefined) {
    const marker = manifest.installProtocol;
    const object = marker && typeof marker === 'object' && !Array.isArray(marker);
    if (object && marker.schema === INSTALL_PROTOCOL_SCHEMA && engineRank(marker.engine) !== null) return { rank: engineRank(marker.engine), label: marker.engine, modern: true };
    if (object && marker.schema === PRE_RELEASE_PROTOCOL_SCHEMA && Number.isInteger(marker.major) && marker.major >= 1) return { rank: 0, label: 'pre-release protocol ' + marker.major, modern: true };
    throw new Error('installed manifest has an invalid install protocol marker; refusing to infer compatibility');
  }
  // A receipt written before any marker existed: its package major is the only protocol identity it has.
  const legacy = Number(String(manifest.version ?? '').split('.')[0]);
  if (!Number.isInteger(legacy) || legacy < 1) throw new Error('legacy installed manifest has no recognizable protocol version');
  return { rank: 0, label: 'pre-release package ' + legacy, modern: legacy >= 3 };
}
function checkMajorUpgrade(manifest, opts) {
  const installed = installedProtocol(manifest), current = engineRank(requireEngineSchema());
  if (installed && installed.rank > current) throw new Error(`installed workflow protocol ${installed.label} is newer than supported ${requireEngineSchema()}`);
  if (installed !== null && installed.rank < current && !opts.upgradeMajor) {
    throw new Error('major workflow upgrade requires --upgrade-major after reviewing README.md and the applicable upgrade note; existing .worktrees data is not migrated or deleted');
  }
}

// Upgrade ownership only: these names are not executable legacy routing. A root belongs here as soon
// as the installer owns files under it, live or retired: it is what lets an update delete an installed
// file the new payload no longer ships, having first proved the file is unchanged since we wrote it.
// Live roots (`bin`, `init`, `skills`, `modules`, `engine`, `knowledge`, `examples`,
// `tests`, `scripts`, `packages`) sit beside every retired root (`workflows`, `hosts`, `execution`,
// `cli`, `contracts`, `approvals`, `specifications`, `schemas`, `sqlite`, `kernel`, `core`, `models`,
// `fixtures`, `legacy`…) for exactly the same reason. `docs` stays in PRESERVED_DOCUMENTATION_ROOTS
// and `upgrades` stays off this list: an upgrade note is the record of what one version asked of an
// operator, and a later payload that stops shipping notes must not delete them from a tree that was
// upgraded through that version. Notes accumulate; nothing there is ever superseded by a newer payload.
const RETIRED_ROOTS = new Set(['v3', 'legacy', 'ops', 'profiles', 'model', 'kernel', 'hosts', 'models', 'checks', 'contracts', 'approvals', 'core', 'schemas', 'specifications', 'sqlite', 'cli', '.dist', 'alias', 'helpers', 'knowledge', 'operators', 'readiness', 'resources', 'scripts', 'templates', 'tests', 'workflows', 'execution', 'fixtures', 'skills', 'bin', 'init', 'engine', 'modules', 'providers', 'examples', 'packages']);
const PRESERVED_DOCUMENTATION_ROOTS = new Set(['docs','sites']);
function retirementPlan(target, manifest) {
  const current = new Set(payloadFiles(packageRoot));
  const remove = [], preserved = [];
  for (const [relative, originalHash] of Object.entries(manifest?.files ?? {})) {
    if (typeof relative !== 'string' || relative.includes('\\') || relative.includes(':') || path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('invalid installed manifest path; refusing cleanup before writes');
    if (PRESERVED_DOCUMENTATION_ROOTS.has(relative.split('/')[0])) { preserved.push(relative); continue; }
    if (current.has(relative)) continue;
    const allowed = ['INDEX.md','INDEX.vi.md','README.md','README.vi.md','UPDATE.md','UPDATE.vi.md','SKILL.vi.md','README.yaml','INDEX.yaml','UPDATE.yaml','VERSION','MASTER.md','PARALLEL-AMAP.md','goal.md','config.example.json'].includes(relative) || relative === 'routing.json' || relative.startsWith('skills/starci-lite/') || RETIRED_ROOTS.has(relative.split('/')[0]);
    if (!allowed || relative === 'resources/settings.json' || relative.split('/').some(part => ['.git', '.work', '.starciwork', '.starcitemp', '.worktrees', 'worktrees', '_local'].includes(part))) { preserved.push(relative); continue; }
    let cursor = target, missing = false;
    for (const part of relative.split('/')) {
      cursor = path.join(cursor, part);
      const stat = lstatSync(cursor, { throwIfNoEntry: false });
      if (!stat) { missing = true; break; }
      if (stat.isSymbolicLink()) throw new Error('retired manifest path uses a symlink/junction; refusing cleanup before writes');
    }
    if (missing) continue;
    if (!statSync(cursor).isFile()) throw new Error('retired manifest entry must name an owned file, not a directory');
    if (manifest?.keptLocal?.includes(relative) || sha(cursor) !== originalHash) preserved.push(relative);
    else remove.push({ relative, file: cursor, hash: originalHash });
  }
  // Report remaining old/unowned paths without reading their content or following links.
  const removedNames = new Set(remove.map(item => item.relative));
  const inspect = relative => {
    const stat = lstatSync(path.join(target, relative), { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink() || relative === 'resources/settings.json' || relative.split('/').some(part => ['.git', '.work', '.starciwork', '.starcitemp', '.worktrees', 'worktrees', '_local'].includes(part))) {
      preserved.push(relative);
      return;
    }
    if (stat.isDirectory()) {
      for (const name of readdirSync(path.join(target, relative))) inspect(relative + '/' + name);
    } else if (!current.has(relative) && !removedNames.has(relative)) preserved.push(relative);
  };
  for (const relative of RETIRED_ROOTS) inspect(relative);
  // Keep V2 documentation/sites without walking build caches, dependencies or linked content.
  for (const relative of PRESERVED_DOCUMENTATION_ROOTS) if(lstatSync(path.join(target,relative),{throwIfNoEntry:false})) preserved.push(relative);
  return { remove, preserved: [...new Set(preserved)] };
}
function retireOwnedFiles(target, plan) {
  const removed = [], preserved = [...plan.preserved];
  for (const item of plan.remove) {
    let cursor = target;
    for (const part of item.relative.split('/')) {
      cursor = path.join(cursor, part);
      if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('retired target changed to a symlink/junction after planning; stopped cleanup');
    }
    const stat = lstatSync(item.file, { throwIfNoEntry: false });
    // Current payload replacement may already have removed an obsolete nested file.
    if (stat) {
      if (stat.isSymbolicLink() || !stat.isFile() || sha(item.file) !== item.hash) { preserved.push(item.relative); continue; }
      rmSync(item.file);
    }
    removed.push(item.relative);
    let directory = path.dirname(item.file);
    while (directory !== target && path.relative(target, directory) && !path.relative(target, directory).startsWith('..')) {
      try { rmdirSync(directory); } catch { break; }
      directory = path.dirname(directory);
    }
  }
  return { removedRetired: removed, preservedRetired: [...new Set(preserved)] };
}

function ensureInstalledDistIgnore(target) {
  const ignore = path.join(target, '.gitignore');
  const current = existsSync(ignore) ? readFileSync(ignore, 'utf8') : '';
  const lines = current.split(/\r?\n/);
  const required = ['/.dist/', '/.dist.staging/', '/.dist.previous/'];
  const missing = required.filter(entry => !lines.includes(entry));
  if (!missing.length) return;
  appendFileSync(ignore, `${current && !current.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`);
}

function ensureInstalledGitignore(target) {
  const ignore = path.join(target, '.gitignore');
  const lines = existsSync(ignore) ? readFileSync(ignore, 'utf8').split(/\r?\n/) : [];
  const missing = INSTALLED_IGNORES.filter((entry) => !lines.includes(entry));
  if (!missing.length) return;
  appendFileSync(ignore, `${lines.length && lines.at(-1) !== '' ? '\n' : ''}${missing.join('\n')}\n`);
}

function prepareInstalledRuntime(target) {
  // Distless runtime: the installed payload IS the runnable source — there is no build step to
  // run and no generated bundle to verify. Keeping a stale `.dist` ignored still protects trees
  // upgraded from a build-era version.
  ensureInstalledDistIgnore(target);
  ensureInstalledGitignore(target);
}

// The seeded owner config: `config.example.yaml` ships with the payload; the installer copies it
// verbatim (comments included) to the untracked `config.yaml` a host edits per project. Seeding is
// copy-if-absent only — an existing owner config is never rewritten by init or update.
function seedConfig(target, log) {
  const example = path.join(target, 'config.example.yaml');
  const file = path.join(target, 'config.yaml');
  if (!existsSync(example) || existsSync(file)) return;
  try {
    writeFileSync(file, readFileSync(example), { flag: 'wx' });
    log('seeded .claude/config.yaml from config.example.yaml (untracked owner config; keep it out of git)');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

// The lifecycle entry skills are user-facing: a host discovers them in its own skills dirs, not in
// the installed .claude tree (where they also ship as payload). Copy them into every host skills dir
// that already exists — `.devin/skills`, `.agents/skills` — best-effort: a host that keeps no such
// dir gets no extra files, and a package missing the skills fails payload copy before this runs.
const ENTRY_SKILLS = ['define-goal', 'start-kernel'];
const HOST_SKILL_DIRS = ['.devin/skills', '.agents/skills'];
function installEntrySkills(repo, log) {
  for (const dir of HOST_SKILL_DIRS) {
    const dest = path.join(repo, dir);
    const stat = lstatSync(dest, { throwIfNoEntry: false });
    if (!stat?.isDirectory() || stat.isSymbolicLink()) continue;
    for (const skill of ENTRY_SKILLS) {
      const source = path.join(packageRoot, 'skills', skill);
      if (!existsSync(source)) { log(`entry skill skills/${skill} is not in this package; skipped ${dir}`); continue; }
      cpSync(source, path.join(dest, skill), { recursive: true });
      log(`installed entry skill ${dir}/${skill}`);
    }
  }
}

export function init(opts, log = console.log) {
  const repo = path.resolve(opts.dir);
  const target = path.join(repo, '.claude');
  if (!existsSync(repo)) throw new Error(`${repo} does not exist`);
  safePayloadTarget(target);
  const manifest = readManifest(target);
  if (manifest) return update({ ...opts, dir: repo }, log);
  checkMajorUpgrade(manifest, opts);
  const profile = selectedProfile(opts, manifest);
  const hostPlan = opts.bootstrap ? bootstrapPlan(repo, opts) : null;
  checkRetiredHostReferences(repo, hostPlan);
  const retirement = retirementPlan(target, manifest);
  if (existsSync(target) && readdirSync(target).length && !manifest && !opts.force) {
    throw new Error(`${target} exists and was not installed by ${pkg.name}; move it away or pass --force to replace the runtime paths inside it`);
  }
  mkdirSync(target, { recursive: true });
  copyPayload(target);
  seedConfig(target, log);
  installEntrySkills(repo, log);
  const retired = retireOwnedFiles(target, retirement);
  prepareInstalledRuntime(target);
  const written = writeManifest(target, [], profile, hostPlan ? profile : manifest?.bootstrapProfile ?? null);
  log(`installed ${pkg.name}@${pkg.version} into ${target} (${Object.keys(written.files).length} files)`);
  if (hostPlan) writeBootstraps(repo, log, hostPlan);
  else log(`host files unchanged; add these to .gitignore yourself: ${HOST_IGNORES.join('  ')}`);
  log('installed profile: ' + profile + (hostPlan ? '; bootstrap updated' : '; host bootstrap unchanged'));
  if (retired.removedRetired.length) log(`removed ${retired.removedRetired.length} unchanged retired runtime file(s); recover from the prior package/Git revision`);
  for (const relative of retired.preservedRetired) log(`preserved retired/unowned ${relative}; review ownership before any manual cleanup`);
  return { ...written, ...retired };
}

/**
 * A version that asks something of the operator beyond `update` itself gets one entry here: the key
 * is the package version, the value the installed-tree path of the note to open. This is the whole
 * mechanism — a note that moves moves in one place.
 */
const UPGRADE_NOTES = {};

export function update(opts, log = console.log) {
  const target = path.resolve(opts.dir, '.claude');
  safePayloadTarget(target);
  const manifest = readManifest(target);
  if (!manifest) throw new Error(`${target} has no ${MANIFEST}; run init first`);
  checkMajorUpgrade(manifest, opts);
  const profile = selectedProfile(opts, manifest);
  const hostPlan = opts.bootstrap !== false ? bootstrapPlan(opts.dir, opts) : null;
  checkRetiredHostReferences(opts.dir, hostPlan);
  const retirement = retirementPlan(target, manifest);
  const before = hashTree(target);
  const locallyChanged = Object.entries(before).filter(([rel, h]) => manifest.files[rel] && manifest.files[rel] !== h).map(([rel]) => rel);
  const locallyAdded = Object.keys(before).filter((rel) => !manifest.files[rel]);
  const previouslyKept = (manifest.keptLocal ?? []).filter(rel => Object.hasOwn(before, rel));
  const saved = Object.fromEntries([...new Set([...locallyChanged, ...locallyAdded, ...previouslyKept])].map((rel) => [rel, readFileSync(path.join(target, rel))]));
  copyPayload(target);
  seedConfig(target, log);
  installEntrySkills(path.resolve(opts.dir), log);
  const currentFiles = new Set(payloadFiles(packageRoot));
  const kept = [];
  for (const [rel, bytes] of Object.entries(saved)) {
    if (opts.force && currentFiles.has(rel)) continue;
    const file = path.join(target, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    kept.push(rel);
  }
  const retired = retireOwnedFiles(target, retirement);
  prepareInstalledRuntime(target);
  const written = writeManifest(target, kept, profile, hostPlan ? profile : manifest.bootstrapProfile ?? null);
  log(`updated ${manifest.name}@${manifest.version} -> ${pkg.name}@${pkg.version} in ${target}`);
  // A version that asks something of the operator says so once, here, where they are looking. An
  // update that installed the version already present asks nothing new, so it stays quiet.
  if (manifest.version !== pkg.version) {
    const note = UPGRADE_NOTES[pkg.version];
    if (note && existsSync(path.join(target, note))) log(`upgrade notes: ${path.posix.join('.claude', note.split(path.sep).join('/'))}`);
  }
  for (const rel of kept) log(`kept ${rel} (changed locally; pass --force to take the package version)`);
  if (opts.force) log(`replaced ${Object.keys(saved).filter(rel => currentFiles.has(rel)).length} local current-payload file(s); unowned and modified retired files retained`);
  if (hostPlan) writeBootstraps(opts.dir, log, hostPlan);
  else log(`host files unchanged; add these to .gitignore yourself: ${HOST_IGNORES.join('  ')}`);
  if (retired.removedRetired.length) log(`removed ${retired.removedRetired.length} unchanged retired runtime file(s); recover from the prior package/Git revision`);
  for (const relative of retired.preservedRetired) log(`preserved retired/unowned ${relative}; review ownership before any manual cleanup`);
  return { ...written, ...retired };
}

// The installed tree validates itself: every spec the payload ships is a contract the install can
// check. `--quick` prefers the core kernel/ledger subset when those specs are present.
const QUICK_SPECS = ['kernel-api.spec.mjs', 'goal-entry.spec.mjs', 'ledger-schema-parity.spec.mjs', 'route-model.spec.mjs', 'verdict-contract.spec.mjs'];
export function doctor(opts, log = console.log) {
  const target = path.join(opts.dir, '.claude');
  const manifest = readManifest(target);
  // The kernel api gate is the modernity marker of the current layout: a tree without it is not an
  // installed StarCi runtime, no matter what else is present.
  if (!existsSync(path.join(target, 'scripts', 'kernel', 'api.mjs'))) {
    throw new Error(`${target} is not an installed StarCi runtime: missing scripts/kernel/api.mjs; run init first`);
  }
  const testsDir = path.join(target, 'tests');
  const specs = existsSync(testsDir) ? readdirSync(testsDir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.spec.mjs')).map((e) => e.name).sort() : [];
  if (!specs.length) throw new Error('installed tree has no tests/*.spec.mjs to validate against');
  let tests = opts.quick ? specs.filter((name) => QUICK_SPECS.includes(name)) : specs;
  if (!tests.length) tests = specs;
  if (manifest) {
    const drift = Object.entries(manifest.files).filter(([rel, hash]) => !existsSync(path.join(target, rel)) || sha(path.join(target, rel)) !== hash);
    log(`${manifest.name}@${manifest.version}; ${drift.length} file(s) changed or missing since install`);
  }
  let failed = 0;
  for (const testFile of tests) {
    const environment = { ...process.env };
    // Doctor starts independent test runners even when invoked by an installer test.
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(testsDir, testFile)], { cwd: target, encoding: 'utf8', windowsHide: true, env: environment });
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    const count = Number(output.match(/^# tests (\d+)$/m)?.[1] ?? 0);
    const passed = Number(output.match(/^# pass (\d+)$/m)?.[1] ?? 0);
    const failures = Number(output.match(/^# fail (\d+)$/m)?.[1] ?? -1);
    const success = result.status === 0 && count > 0 && passed === count && failures === 0;
    if (!success) failed++;
    log(`${success ? 'ok  ' : 'FAIL'} tests/${testFile}: ${passed}/${count} tests passed${success ? '' : '\n' + output.trim().split('\n').slice(-25).join('\n')}`);
  }
  log(failed ? `doctor: ${failed} check(s) failed` : 'doctor: local contracts/tests passed; no product or deployment acceptance implied');
  return failed;
}

const HELP = `${pkg.name} ${pkg.version}

  npx ${pkg.name} init   [--dir <repo>] [--force] [--no-bootstrap] [--hosts claude,devin]
  npx ${pkg.name} update [--dir <repo>] [--force] [--upgrade-major] [--hosts claude,devin]
  npx ${pkg.name} doctor [--dir <repo>] [--quick]
  npx ${pkg.name} version

init    copies the runnable source payload into <repo>/.claude, then records the install manifest.
        Seeds an untracked .claude/config.yaml from config.example.yaml; installs the entry skills
        (define-goal, start-kernel) into the host's .devin/skills/ and .agents/skills/ dirs when they
        exist; writes the managed StarCi entry into AGENTS.md — CLAUDE.md/DEVIN.md copies only when
        named by --hosts; and adds .starciwork/ + .claude/config.yaml to the host .gitignore while
        preserving custom instructions. Refuses a .claude it did not install unless --force;
        --no-bootstrap keeps host files unchanged (the gitignore lines are printed instead).
update  replaces current runtime paths; locally changed current files are kept unless --force.
        The runtime reads the installed source directly; no build step runs before recording the
        new version. Retired manifest-owned unchanged files are removed; changed or unowned files
        are preserved. Product .starciwork ledgers and owner config are never cleanup targets.
        A major upgrade requires --upgrade-major.
doctor  runs the installed tree's own tests/*.spec.mjs and reports drift against the manifest.
        --quick runs the core kernel/ledger subset when those specs ship.
entry   one AGENTS.md prompt-entry: define-goal / start-kernel lifecycle skills. Known older
        bootstraps are recognized and migrated; unresolved conflicts stop the update before writes.
        Existing ledgers are retained; installing skills does not migrate them.
`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.command === 'init') init(opts);
    else if (opts.command === 'update') update(opts);
    else if (opts.command === 'doctor') process.exitCode = doctor(opts) ? 1 : 0;
    else if (opts.command === 'version') console.log(pkg.version);
    else console.log(HELP);
  } catch (err) {
    console.error(`${pkg.name}: ${err.message}`);
    process.exitCode = 1;
  }
}
