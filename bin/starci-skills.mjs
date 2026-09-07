#!/usr/bin/env node
// The installer for StarCi Skills. The runtime is a tree of files under <repo>/.claude and two
// bootstrap files at the repo root (CLAUDE.md for Claude Code, AGENTS.md for Codex); nothing here is
// a framework the tree depends on at run time. The CLI has no dependencies and needs Node 20+.
//
//   npx @starci/skills init            install the tree into ./.claude and write the bootstraps
//   npx @starci/skills update          bring an installed tree to this package's version
//   npx @starci/skills doctor          run the tree's own validators on the installed copy
//   npx @starci/skills version
//
// Every command takes --dir <repo> (default: the current directory). init refuses a non-empty
// .claude it did not install unless --force; update keeps a file a person changed locally unless
// --force; neither ever runs a git command.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, lstatSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

// What an installed tree is made of. Only these paths are copied, hashed and updated; anything else
// a person adds beside them (other tests, notes) is theirs and is never touched. Public evidence
// explicitly allowlisted by package.json is copied file-by-file, never as the whole tests tree.
// The explicit npm allowlist also defines the self-contained installed runtime. Its metadata and
// CLI must survive relocation: installed doctor fixtures copy this same declared payload.
export const PAYLOAD = [...new Set(['package.json', ...pkg.files.map(ref => ref.replace(/\/$/, ''))])];
const MANIFEST = '.starci-skills.json';
const LOCAL_IGNORE = '.work/_local/';
const ENTRY_MARKER = '<!-- starci:prompt-entry -->';
const LEGACY_PROMPT_ENTRY = `${ENTRY_MARKER}
For every user prompt, enter [StarCi](.claude/INDEX.md) before planning or target work and follow
the entry's user-session and goal protocol. Follow-up prompts reuse that host session.
<!-- /starci:prompt-entry -->`;
const PROMPT_ENTRY = `${ENTRY_MARKER}
For product development work, enter [StarCi](.claude/INDEX.md) and select the bounded operation
covered by the user's request. Track current product completion in .work; stop after the selected
operation or explicitly approved parallel group. Questions do not require a work ledger.
<!-- /starci:prompt-entry -->`;

const BOOTSTRAP = `# StarCi agent bootstrap

${PROMPT_ENTRY}

Read [\`<Source>/.claude/INDEX.md\`](.claude/INDEX.md) completely and follow its load order.

\`<Source>\` is the single host repository that owns this bootstrap and the \`.claude\` runtime. A routed
repository checkout or Git worktree follows that Source; do not rebind \`<Source>\` to it or expect it to
contain another \`.claude/INDEX.md\`.

This file is only a bootstrap. Do not copy context, brainstorm, compiler, gate or skill rules into it:
the entry routes, and a rule copied here becomes a second home that nobody remembers to update.
`;

const LEGACY_LITE_ENTRY = `${ENTRY_MARKER}
For every user prompt, enter [StarCi Lite](.claude/skills/starci-lite/SKILL.md) and use its scope classification.
Existing full workflows keep their current session and gates; formal UAT and publication use full StarCi.
<!-- /starci:prompt-entry -->`;
const LITE_ENTRY = `${ENTRY_MARKER}
For bounded maintenance, enter [StarCi Lite](.claude/skills/starci-lite/SKILL.md).
For tracked business work, use [StarCi](.claude/INDEX.md) and its selected-operation contract.
Do not create an automatic chain or migrate existing workflow evidence implicitly.
<!-- /starci:prompt-entry -->`;
const LITE_BOOTSTRAP = BOOTSTRAP.replace(PROMPT_ENTRY, LITE_ENTRY)
  .replace('Read [\`<Source>/.claude/INDEX.md\`](.claude/INDEX.md) completely and follow its load order.',
    'Read [StarCi Lite](.claude/skills/starci-lite/SKILL.md) first; it routes complex work to the full entry.');
function selectedProfile(opts, manifest) {
  const profile = opts.profile ?? manifest?.profile ?? 'full';
  if (!['full', 'lite'].includes(profile)) throw new Error('profile must be full or lite');
  return profile;
}

// The validators the tree ships, in the order npm test runs them. --quick keeps the three that
// finish in seconds; the full doctor also runs the operator self-tests and the script specs.
const DOCTOR_QUICK = ['validate-routing.mjs', 'validate-alias.mjs', 'validate-operator.mjs'];
const DOCTOR_FULL = [
  'validate-routing.mjs', 'validate-resources.mjs', 'validate-knowledge-citations.mjs', 'validate-alias.mjs',
  ['generate-alias-doc.mjs', '--check'], 'validate-operator.mjs', 'validate-helper.mjs', 'validate-defaults.mjs',
  ['generate-operators-index.mjs', '--check'], ['generate-helpers-index.mjs', '--check'], 'validate-templates.mjs', 'run-operator-self-tests.mjs',
];

function parseArgs(argv) {
  const out = { command: argv[0] ?? 'help', dir: process.cwd(), force: false, quick: false, bootstrap: true, upgradeMajor: false };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dir') out.dir = path.resolve(argv[++i] ?? '.');
    else if (a.startsWith('--dir=')) out.dir = path.resolve(a.slice(6));
    else if (a === '--profile') out.profile = argv[++i];
    else if (a.startsWith('--profile=')) out.profile = a.slice(10);
    else if (a === '--force') out.force = true;
    else if (a === '--quick') out.quick = true;
    else if (a === '--no-bootstrap') out.bootstrap = false;
    else if (a === '--upgrade-major') out.upgradeMajor = true;
    else if (a === '-h' || a === '--help') out.command = 'help';
    else throw new Error(`unknown argument ${a}`);
  }
  if (out.profile !== undefined && !['full', 'lite'].includes(out.profile)) throw new Error('profile must be full or lite');
  if (argv.includes('--profile') && out.profile === undefined) throw new Error('--profile requires full or lite');
  return out;
}

function walk(root, rel = '') {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel];
  const out = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const next = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, next));
    else out.push(next);
  }
  return out;
}
const sha = (file) => createHash('sha256').update(readFileSync(file).toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
const payloadFiles = (root) => PAYLOAD.flatMap((p) => walk(root, p)).sort();
const hashTree = (root) => Object.fromEntries(payloadFiles(root).map((rel) => [rel, sha(path.join(root, rel))]));

function readManifest(target) {
  const file = path.join(target, MANIFEST);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}
function writeManifest(target, kept = [], profile = 'full', bootstrapProfile = null) {
  const manifest = { name: pkg.name, version: pkg.version, profile, bootstrapProfile, installedAt: new Date().toISOString(), files: hashTree(target) };
  if (kept.length) manifest.keptLocal = kept;
  writeFileSync(path.join(target, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function copyPayload(target) {
  for (const p of PAYLOAD) {
    const from = path.join(packageRoot, p);
    const to = path.join(target, p);
    if (!existsSync(from)) throw new Error(`package is incomplete: ${p} is missing`);
    if (statSync(from).isDirectory()) { rmSync(to, { recursive: true, force: true }); cpSync(from, to, { recursive: true }); }
    else { mkdirSync(path.dirname(to), { recursive: true }); cpSync(from, to); }
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
function bootstrapPlan(repo, profile) {
  for (const name of ['CLAUDE.md', 'AGENTS.md', '.gitignore']) {
    const stat = lstatSync(path.join(repo, name), { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(name + ': bootstrap target must be a regular owned file, not a symlink/junction');
  }
  const entry = profile === 'lite' ? LITE_ENTRY : PROMPT_ENTRY;
  const bootstrap = profile === 'lite' ? LITE_BOOTSTRAP : BOOTSTRAP;
  return ['CLAUDE.md', 'AGENTS.md'].map(name => {
    const file = path.join(repo, name);
    if (!existsSync(file)) return { name, file, text: bootstrap, action: 'wrote' };
    const current = readFileSync(file, 'utf8');
    const customProtocol = [PROMPT_ENTRY, LITE_ENTRY, LEGACY_PROMPT_ENTRY, LEGACY_LITE_ENTRY].reduce((text, managed) => text.replace(managed, ''), current.replace(/\r\n/g, '\n'));
    if (/session-open\.mjs|plan-chain\.mjs|validated request\.json|Nothing is designed, written or committed outside a session/.test(customProtocol)) {
      throw new Error(name + ': custom v2 session/chain protocol conflicts with v3; reconcile it or use --no-bootstrap before changing payload');
    }
    const legacyBootstrap = BOOTSTRAP.replace(PROMPT_ENTRY, LEGACY_PROMPT_ENTRY);
    const legacyLiteBootstrap = LITE_BOOTSTRAP.replace(LITE_ENTRY, LEGACY_LITE_ENTRY);
    for (const known of [BOOTSTRAP, LITE_BOOTSTRAP, legacyBootstrap, legacyLiteBootstrap]) {
      const normalized = current.replace(/\r\n/g, '\n'), authored = known.replace(/\r\n/g, '\n');
      if (normalized.startsWith(authored)) {
        let end = 0, count = 0;
        while (count < authored.length) { if (!(current[end] === '\r' && current[end + 1] === '\n')) count++; end++; }
        const suffix = current.slice(end);
        if (profile === 'lite' && suffix.includes('.claude/INDEX.md')) throw new Error(name + ': custom suffix still names the full entry; Lite cannot replace that instruction');
        return { name, file, text: bootstrap + suffix, action: 'updated' };
      }
    }
    const managed = [PROMPT_ENTRY, LITE_ENTRY, LEGACY_PROMPT_ENTRY, LEGACY_LITE_ENTRY].find(value => current.includes(value));
    if (managed) {
      const outside = current.replace(managed, '');
      if (profile === 'lite' && outside.includes('.claude/INDEX.md')) throw new Error(name + ': custom instructions still name the full entry; preserve them and resolve the profile explicitly before Lite bootstrap changes');
      return { name, file, text: current.replace(managed, entry), action: 'updated' };
    }
    if (current.includes(ENTRY_MARKER)) {
      throw new Error(name + ': custom StarCi entry needs explicit reconciliation; refusing a mixed v2/v3 bootstrap before payload writes');
    }
    if (profile === 'lite' && current.includes('.claude/INDEX.md')) throw new Error(name + ': custom instructions still name the full entry; preserve them and resolve the profile explicitly before Lite bootstrap changes');
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
  if (!lines.some((l) => l.trim() === LOCAL_IGNORE || l.trim() === '/' + LOCAL_IGNORE)) {
    appendFileSync(ignore, `${lines.length && lines.at(-1) !== '' ? '\n' : ''}# StarCi Work: only local scratch is ignored; product evidence remains durable\n${LOCAL_IGNORE}\n`);
    log(`added ${LOCAL_IGNORE} to .gitignore`);
  }
}

function checkMajorUpgrade(manifest, opts) {
  if (manifest && Number(manifest.version.split('.')[0]) < Number(pkg.version.split('.')[0]) && !opts.upgradeMajor) {
    throw new Error('major workflow upgrade requires --upgrade-major after reviewing v3/README.md; existing .worktrees data is not migrated or deleted');
  }
}

export function init(opts, log = console.log) {
  const repo = opts.dir;
  const target = path.join(repo, '.claude');
  if (!existsSync(repo)) throw new Error(`${repo} does not exist`);
  safePayloadTarget(target);
  const manifest = readManifest(target);
  checkMajorUpgrade(manifest, opts);
  const profile = selectedProfile(opts, manifest);
  const hostPlan = opts.bootstrap ? bootstrapPlan(repo, profile) : null;
  if (existsSync(target) && readdirSync(target).length && !manifest && !opts.force) {
    throw new Error(`${target} exists and was not installed by ${pkg.name}; move it away or pass --force to replace the runtime paths inside it`);
  }
  if (manifest) log(`re-installing over ${manifest.name}@${manifest.version} (use "update" to keep local changes)`);
  mkdirSync(target, { recursive: true });
  copyPayload(target);
  const written = writeManifest(target, [], profile, hostPlan ? profile : manifest?.bootstrapProfile ?? null);
  log(`installed ${pkg.name}@${pkg.version} into ${target} (${Object.keys(written.files).length} files)`);
  if (hostPlan) writeBootstraps(repo, log, hostPlan);
  log('installed profile: ' + profile + (hostPlan ? '; bootstrap updated' : '; host bootstrap unchanged'));
  return written;
}

export function update(opts, log = console.log) {
  const target = path.join(opts.dir, '.claude');
  safePayloadTarget(target);
  const manifest = readManifest(target);
  if (!manifest) throw new Error(`${target} has no ${MANIFEST}; run init first`);
  checkMajorUpgrade(manifest, opts);
  const profile = selectedProfile(opts, manifest);
  const hostPlan = opts.bootstrap !== false ? bootstrapPlan(opts.dir, profile) : null;
  const before = hashTree(target);
  const locallyChanged = Object.entries(before).filter(([rel, h]) => manifest.files[rel] && manifest.files[rel] !== h).map(([rel]) => rel);
  const locallyAdded = Object.keys(before).filter((rel) => !manifest.files[rel]);
  const saved = Object.fromEntries([...locallyChanged, ...locallyAdded].map((rel) => [rel, readFileSync(path.join(target, rel))]));
  copyPayload(target);
  const kept = [];
  if (!opts.force) {
    for (const [rel, bytes] of Object.entries(saved)) {
      const file = path.join(target, rel);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, bytes);
      kept.push(rel);
    }
  }
  const written = writeManifest(target, kept, profile, hostPlan ? profile : manifest.bootstrapProfile ?? null);
  log(`updated ${manifest.name}@${manifest.version} -> ${pkg.name}@${pkg.version} in ${target}`);
  for (const rel of kept) log(`kept ${rel} (changed locally; pass --force to take the package version)`);
  if (opts.force && (locallyChanged.length || locallyAdded.length)) log(`replaced ${locallyChanged.length + locallyAdded.length} locally changed file(s)`);
  if (hostPlan) writeBootstraps(opts.dir, log, hostPlan);
  return written;
}

export function doctor(opts, log = console.log) {
  const target = path.join(opts.dir, '.claude');
  const installedPackage = path.join(target, 'package.json');
  if (existsSync(installedPackage) && Number(JSON.parse(readFileSync(installedPackage, 'utf8')).version?.split('.')[0]) >= 3 && !existsSync(path.join(target, 'v3', 'cli', 'main.mjs'))) {
    throw new Error('installed v3 runtime is incomplete: missing v3/cli/main.mjs; refusing fallback to legacy validation');
  }
  if (existsSync(path.join(target, 'v3', 'cli', 'main.mjs'))) {
    const tests = opts.quick ? ['ops.spec.mjs', 'core.spec.mjs'] : ['ops.spec.mjs', 'core.spec.mjs', 'cli.spec.mjs', 'acceptance.spec.mjs'];
    const manifest = readManifest(target);
    if (manifest) {
      const drift = Object.entries(manifest.files).filter(([rel, hash]) => !existsSync(path.join(target, rel)) || sha(path.join(target, rel)) !== hash);
      log(`${manifest.name}@${manifest.version}; ${drift.length} file(s) changed or missing since install`);
    }
    let failed = 0;
    for (const testFile of tests) {
      const environment = { ...process.env };
      // Doctor starts independent test runners even when invoked by an installer test.
      delete environment.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(target, 'v3', testFile)], { cwd: target, encoding: 'utf8', windowsHide: true, env: environment });
      const output = (result.stdout ?? '') + (result.stderr ?? '');
      const count = Number(output.match(/^# tests (\d+)$/m)?.[1] ?? 0);
      const passed = Number(output.match(/^# pass (\d+)$/m)?.[1] ?? 0);
      const failures = Number(output.match(/^# fail (\d+)$/m)?.[1] ?? -1);
      const success = result.status === 0 && count > 0 && passed === count && failures === 0;
      if (!success) failed++;
      log(`${success ? 'ok  ' : 'FAIL'} v3/${testFile}: ${passed}/${count} tests passed${success ? '' : '\n' + output.trim().split('\n').slice(-25).join('\n')}`);
    }
    log(failed ? `doctor: ${failed} v3 check(s) failed` : 'doctor: v3 local contracts/tests passed; no product or deployment acceptance implied');
    return failed;
  }
  if (!existsSync(path.join(target, 'scripts'))) throw new Error(`${target} has no scripts/; run init first`);
  const manifest = readManifest(target);
  if (manifest) {
    const drift = Object.entries(hashTree(target)).filter(([rel, h]) => manifest.files[rel] && manifest.files[rel] !== h).map(([rel]) => rel);
    log(`${manifest.name}@${manifest.version}; ${drift.length} file(s) changed since install${drift.length ? `: ${drift.join(', ')}` : ''}`);
  } else log(`no ${MANIFEST}: validating an unmanaged tree`);
  const steps = opts.quick ? DOCTOR_QUICK : DOCTOR_FULL;
  let failed = 0;
  for (const step of steps) {
    const [script, ...args] = Array.isArray(step) ? step : [step];
    const r = spawnSync(process.execPath, [path.join(target, 'scripts', script), ...args], { cwd: target, encoding: 'utf8' });
    const ok = r.status === 0;
    if (!ok) failed += 1;
    log(`${ok ? 'ok  ' : 'FAIL'} ${script}${args.length ? ` ${args.join(' ')}` : ''}${ok ? '' : `\n${(r.stdout + r.stderr).trim()}`}`);
  }
  if (!opts.quick) {
    const specs = readdirSync(path.join(target, 'scripts')).filter((f) => f.endsWith('.spec.mjs')).map((f) => path.join(target, 'scripts', f));
    const r = spawnSync(process.execPath, ['--test', ...specs], { cwd: target, encoding: 'utf8' });
    if (r.status !== 0) failed += 1;
    log(`${r.status === 0 ? 'ok  ' : 'FAIL'} node --test scripts/*.spec.mjs (${specs.length} files)${r.status === 0 ? '' : `\n${(r.stdout + r.stderr).trim().split('\n').slice(-30).join('\n')}`}`);
  }
  log(failed ? `doctor: ${failed} check(s) failed` : 'doctor: the installed tree validates');
  return failed;
}

const HELP = `${pkg.name} ${pkg.version}

  npx ${pkg.name} init   [--dir <repo>] [--profile full|lite] [--force] [--no-bootstrap]
  npx ${pkg.name} update [--dir <repo>] [--profile full|lite] [--force]
  npx ${pkg.name} doctor [--dir <repo>] [--quick]
  npx ${pkg.name} version
  npx ${pkg.name} work <command> [arguments]

init    copies the runtime into <repo>/.claude, adds the StarCi entry once to CLAUDE.md and AGENTS.md
        while preserving custom instructions, and adds only .work/_local/ to .gitignore.
        Refuses a .claude it did not install unless --force; --no-bootstrap keeps host files unchanged.
update  replaces the runtime paths with this version; a file changed locally is kept and listed
        (resources/settings.json is the person's own and is never part of the package)
        unless --force. Files outside the runtime paths are never touched.
        A major upgrade requires --upgrade-major; no existing .worktrees data is migrated/deleted.
profile full is the default. Lite is an explicit separate entry for bounded work; all full operators
        remain installed. Update retains the installed profile unless --profile explicitly changes it.
        Custom host rules are preserved; --no-bootstrap leaves their entry routing under your control.
        Existing v2 ledgers are retained; v3 does not resume or convert their orchestration.
doctor  runs v3 local contract tests on the installed copy and reports local drift.
work    runs the bounded .work CLI; use "work help". Never dispatches product operations.
`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'work') {
      const result = spawnSync(process.execPath, [path.join(packageRoot, 'v3', 'cli', 'main.mjs'), ...process.argv.slice(3)], { stdio: 'inherit', windowsHide: true });
      process.exit(result.status ?? 1);
    }
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
