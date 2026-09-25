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
import { sha256 } from '../../engine/index.mjs';
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
// engine schema it enrolls workflows into, ranked by that schema's number. The installer accepts only
// the marker it writes itself - anything older is cleaned by hand, never upgraded by code.
const INSTALL_PROTOCOL_SCHEMA = 'starci/install-protocol@1';
const installProtocol = () => Object.freeze({ schema: INSTALL_PROTOCOL_SCHEMA, engine: requireEngineSchema() });
const engineRank = (engine) => { const m = /^starci\/engine@(\d+)$/.exec(String(engine ?? '')); return m ? Number(m[1]) : null; };
// Host-level ignores written into the host repo's own .gitignore: the ledger/runtime state is local
// to the checkout and the seeded owner config is untracked by contract.
const HOST_IGNORES = ['.starciwork/', '.claude/config.yaml'];
// Ignores inside the installed tree itself (its .claude/.gitignore): the seeded owner config is
// untracked by contract.
const INSTALLED_IGNORES = ['/config.yaml'];
const ENTRY_MARKER = '<!-- starci:prompt-entry -->';
const entryOf = text => text.match(/<!-- starci:prompt-entry -->[\s\S]*?<!-- \/starci:prompt-entry -->/)?.[0];

// The one shipped template. CLAUDE.md/DEVIN.md are not stored: when a host opts into those names the
// installer writes byte-identical copies of this same file.
const BOOTSTRAP = readFileSync(path.join(packageRoot, 'init/AGENTS.md'), 'utf8');
const PROMPT_ENTRY = entryOf(BOOTSTRAP);
if (!PROMPT_ENTRY) throw new Error('init/AGENTS.md must carry the managed starci:prompt-entry block');

function selectedProfile(opts) {
  if (opts.profile !== undefined && opts.profile !== 'full') throw new Error('only the full profile exists');
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
  const out = { command: argv[0] ?? 'help', dir: process.cwd(), force: false, quick: false, bootstrap: true, hosts: [] };
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
    else if (a === '-h' || a === '--help') out.command = 'help';
    else throw new Error(`unknown argument ${a}`);
  }
  if (out.profile !== undefined && out.profile !== 'full') throw new Error('only the full profile exists');
  if (argv.includes('--profile') && out.profile === undefined) throw new Error('--profile requires a value of full');
  return out;
}

// `docs/` and `examples/` ship only authored reference files. An `examples/<name>/` stack kit (its
// `.starcistacks/` tree plus sibling `scripts/`, `gateway/`
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
const sha = (file) => sha256(readFileSync(file).toString('utf8').replace(/\r\n/g, '\n'));
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
  // Files the payload no longer ships are handled only by the ownership-checked stale-file plan.
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
    // The only managed block this installer knows is the one it writes. A file already carrying it is
    // left byte-identical; a file carrying any other starci:prompt-entry block is a conflict a person
    // resolves by hand - the installer never rewrites an entry it did not author.
    if (current.replace(/\r\n/g, '\n').includes(entry)) {
      return { name, file, text: current, action: 'unchanged' };
    }
    if (current.includes(ENTRY_MARKER)) {
      throw new Error(name + ': carries a StarCi entry this installer did not write; reconcile it by hand or pass --no-bootstrap');
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

/**
 * The only manifest marker this installer accepts: install-protocol@1 naming the engine schema this
 * package ships. A tree installed by anything else is not upgraded in place - it is cleaned by hand
 * and `init` runs fresh. A malformed marker is refused, never guessed.
 */
function checkInstalledProtocol(manifest) {
  const marker = manifest?.installProtocol;
  const object = marker && typeof marker === 'object' && !Array.isArray(marker);
  if (!object || marker.schema !== INSTALL_PROTOCOL_SCHEMA || engineRank(marker.engine) === null) {
    throw new Error(`${MANIFEST} does not record this installer's protocol; remove .claude by hand and run init - older trees are cleaned manually, never upgraded in place`);
  }
  const installed = engineRank(marker.engine), current = engineRank(requireEngineSchema());
  if (installed > current) throw new Error(`installed workflow protocol ${marker.engine} is newer than supported ${requireEngineSchema()}`);
  if (installed < current) throw new Error(`installed workflow protocol ${marker.engine} predates ${requireEngineSchema()}; remove .claude by hand and run init - older trees are cleaned manually, never upgraded in place`);
}

// Authored documentation roots are never cleanup targets: notes an earlier payload installed stay for
// the operator who read them, whatever the current payload ships.
const PRESERVED_ROOTS = new Set(['docs', 'sites']);
// The manifest is the whole ownership record. A file an earlier payload of this same protocol
// installed but the current payload no longer ships is stale: it is removed only while still
// byte-identical to what was written. Anything a person changed is preserved and reported instead.
function stalePlan(target, manifest) {
  const current = new Set(payloadFiles(packageRoot));
  const remove = [], preserved = [];
  for (const [relative, originalHash] of Object.entries(manifest?.files ?? {})) {
    if (typeof relative !== 'string' || relative.includes('\\') || relative.includes(':') || path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('invalid installed manifest path; refusing cleanup before writes');
    if (PRESERVED_ROOTS.has(relative.split('/')[0])) { preserved.push(relative); continue; }
    if (current.has(relative)) continue;
    if (relative.split('/').includes('.git')) { preserved.push(relative); continue; }
    let cursor = target, missing = false;
    for (const part of relative.split('/')) {
      cursor = path.join(cursor, part);
      const stat = lstatSync(cursor, { throwIfNoEntry: false });
      if (!stat) { missing = true; break; }
      if (stat.isSymbolicLink()) throw new Error('stale manifest path uses a symlink/junction; refusing cleanup before writes');
    }
    if (missing) continue;
    if (!statSync(cursor).isFile()) throw new Error('stale manifest entry must name an owned file, not a directory');
    if (manifest?.keptLocal?.includes(relative) || sha(cursor) !== originalHash) preserved.push(relative);
    else remove.push({ relative, file: cursor, hash: originalHash });
  }
  return { remove, preserved: [...new Set(preserved)] };
}
function removeStaleFiles(target, plan) {
  const removed = [], preserved = [...plan.preserved];
  for (const item of plan.remove) {
    let cursor = target;
    for (const part of item.relative.split('/')) {
      cursor = path.join(cursor, part);
      if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('stale target changed to a symlink/junction after planning; stopped cleanup');
    }
    const stat = lstatSync(item.file, { throwIfNoEntry: false });
    // Payload copy may already have replaced an unshipped nested file.
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
  return { removedStale: removed, preservedStale: [...new Set(preserved)] };
}

function ensureInstalledGitignore(target) {
  const ignore = path.join(target, '.gitignore');
  const lines = existsSync(ignore) ? readFileSync(ignore, 'utf8').split(/\r?\n/) : [];
  const missing = INSTALLED_IGNORES.filter((entry) => !lines.includes(entry));
  if (!missing.length) return;
  appendFileSync(ignore, `${lines.length && lines.at(-1) !== '' ? '\n' : ''}${missing.join('\n')}\n`);
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
  const profile = selectedProfile(opts);
  const hostPlan = opts.bootstrap ? bootstrapPlan(repo, opts) : null;
  const stale = stalePlan(target, manifest);
  if (existsSync(target) && readdirSync(target).length && !manifest && !opts.force) {
    throw new Error(`${target} exists and was not installed by ${pkg.name}; move it away or pass --force to replace the runtime paths inside it`);
  }
  mkdirSync(target, { recursive: true });
  copyPayload(target);
  seedConfig(target, log);
  installEntrySkills(repo, log);
  const cleaned = removeStaleFiles(target, stale);
  ensureInstalledGitignore(target);
  const written = writeManifest(target, [], profile, hostPlan ? profile : manifest?.bootstrapProfile ?? null);
  log(`installed ${pkg.name}@${pkg.version} into ${target} (${Object.keys(written.files).length} files)`);
  if (hostPlan) writeBootstraps(repo, log, hostPlan);
  else log(`host files unchanged; add these to .gitignore yourself: ${HOST_IGNORES.join('  ')}`);
  log('installed profile: ' + profile + (hostPlan ? '; bootstrap updated' : '; host bootstrap unchanged'));
  if (cleaned.removedStale.length) log(`removed ${cleaned.removedStale.length} unchanged unshipped file(s); recover from the prior package/Git revision`);
  for (const relative of cleaned.preservedStale) log(`preserved unowned/changed ${relative}; review ownership before any manual cleanup`);
  return { ...written, ...cleaned };
}

export function update(opts, log = console.log) {
  const target = path.resolve(opts.dir, '.claude');
  safePayloadTarget(target);
  const manifest = readManifest(target);
  if (!manifest) throw new Error(`${target} has no ${MANIFEST}; run init first`);
  checkInstalledProtocol(manifest);
  const profile = selectedProfile(opts);
  const hostPlan = opts.bootstrap !== false ? bootstrapPlan(opts.dir, opts) : null;
  const stale = stalePlan(target, manifest);
  const before = hashTree(target);
  const locallyChanged = Object.entries(before).filter(([rel, h]) => manifest.files[rel] && manifest.files[rel] !== h).map(([rel]) => rel);
  const locallyAdded = Object.keys(before).filter((rel) => !manifest.files[rel]);
  const stillKept = (manifest.keptLocal ?? []).filter(rel => Object.hasOwn(before, rel));
  const saved = Object.fromEntries([...new Set([...locallyChanged, ...locallyAdded, ...stillKept])].map((rel) => [rel, readFileSync(path.join(target, rel))]));
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
  const cleaned = removeStaleFiles(target, stale);
  ensureInstalledGitignore(target);
  const written = writeManifest(target, kept, profile, hostPlan ? profile : manifest.bootstrapProfile ?? null);
  log(`updated ${manifest.name}@${manifest.version} -> ${pkg.name}@${pkg.version} in ${target}`);
  for (const rel of kept) log(`kept ${rel} (changed locally; pass --force to take the package version)`);
  if (opts.force) log(`replaced ${Object.keys(saved).filter(rel => currentFiles.has(rel)).length} local current-payload file(s); unowned and locally changed files are preserved`);
  if (hostPlan) writeBootstraps(opts.dir, log, hostPlan);
  else log(`host files unchanged; add these to .gitignore yourself: ${HOST_IGNORES.join('  ')}`);
  if (cleaned.removedStale.length) log(`removed ${cleaned.removedStale.length} unchanged unshipped file(s); recover from the prior package/Git revision`);
  for (const relative of cleaned.preservedStale) log(`preserved unowned/changed ${relative}; review ownership before any manual cleanup`);
  return { ...written, ...cleaned };
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
  npx ${pkg.name} update [--dir <repo>] [--force] [--hosts claude,devin]
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
        new version. Manifest-owned files the payload no longer ships are removed when unchanged;
        changed or unowned files are preserved. Product .starciwork ledgers and owner config are
        never cleanup targets. An install recorded under any other protocol is not upgraded in
        place: remove .claude by hand and run init.
doctor  runs the installed tree's own tests/*.spec.mjs and reports drift against the manifest.
        --quick runs the core kernel/ledger subset when those specs ship.
entry   one AGENTS.md prompt-entry: define-goal / start-kernel lifecycle skills. A bootstrap carrying
        a StarCi entry this installer did not write stops the update before writes; reconcile it by
        hand or pass --no-bootstrap. Existing ledgers are retained.
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
