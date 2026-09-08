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
import {loadConfig} from '../scripts/config.mjs';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, statSync, lstatSync, writeFileSync, appendFileSync } from 'node:fs';
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
const LOCAL_IGNORES = ['.work/_local/','.work/_workflows/'];
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

const PROMPT_ENTRY = `${ENTRY_MARKER}
Use the single [StarCi skill](.claude/SKILL.md) to select one workflow from .claude/workflows/catalog.json.
Use direct-task for ad hoc work that does not fit a specialized workflow. Keep the selected matrix
within three sequential rows and three parallel primary cells; verify requested outcomes before advancing.
Questions may stay read-only. Check/build .dist first. Preserve existing scope, evidence and user changes.
<!-- /starci:prompt-entry -->`;

const BOOTSTRAP = `# StarCi agent bootstrap

${PROMPT_ENTRY}

Read [\`<Source>/.claude/SKILL.md\`](.claude/SKILL.md) completely and follow its load order.

\`<Source>\` is the single host repository that owns this bootstrap and the \`.claude\` runtime. A routed
repository checkout or Git worktree follows that Source; do not rebind \`<Source>\` to it or expect it to
contain another \`.claude/SKILL.md\`.

This file is only a bootstrap. Do not copy context, brainstorm, compiler, gate or skill rules into it:
the entry routes, and a rule copied here becomes a second home that nobody remembers to update.
`;

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
const LITE_BOOTSTRAP = BOOTSTRAP.replace(PROMPT_ENTRY, LITE_ENTRY)
  .replace('Read [\`<Source>/.claude/SKILL.md\`](.claude/SKILL.md) completely and follow its load order.',
    'Read [StarCi Lite](.claude/skills/starci-lite/SKILL.md) first; it routes complex work to the full entry.');
function selectedProfile(opts, manifest) {
  if (opts.profile !== undefined && opts.profile !== 'full') throw new Error('starci-lite is retired; use the full prompt-to-skill entry');
  if (manifest?.profile === 'lite' && opts.bootstrap === false) throw new Error('retired Lite bootstrap must be migrated before removing its installed skill; omit --no-bootstrap and review host instructions');
  return 'full';
}

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
  if (out.profile !== undefined && out.profile !== 'full') throw new Error('only the full prompt-to-skill entry is supported; Lite is retired');
  if (argv.includes('--profile') && out.profile === undefined) throw new Error('--profile requires full');
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
function bootstrapPlan(repo, profile) {
  for (const name of ['CLAUDE.md', 'AGENTS.md', '.gitignore']) {
    const stat = lstatSync(path.join(repo, name), { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(name + ': bootstrap target must be a regular owned file, not a symlink/junction');
  }
  const entry = PROMPT_ENTRY;
  const bootstrap = BOOTSTRAP;
  return ['CLAUDE.md', 'AGENTS.md'].map(name => {
    const file = path.join(repo, name);
    if (!existsSync(file)) return { name, file, text: bootstrap, action: 'wrote' };
    const current = readFileSync(file, 'utf8');
    const customProtocol = [PROMPT_ENTRY, PRESET_PROMPT_ENTRY, CAPPED_V3_PROMPT_ENTRY, LITE_ENTRY, PREVIOUS_V3_PROMPT_ENTRY, PREVIOUS_V3_LITE_ENTRY, LEGACY_PROMPT_ENTRY, LEGACY_LITE_ENTRY].reduce((text, managed) => text.replace(managed, ''), current.replace(/\r\n/g, '\n'));
    if (/session-open\.mjs|plan-chain\.mjs|validated request\.json|Nothing is designed, written or committed outside a session/.test(customProtocol)) {
      throw new Error(name + ': custom v2 session/chain protocol conflicts with v3; reconcile it or use --no-bootstrap before changing payload');
    }
    const legacyBootstrap = BOOTSTRAP.replace(PROMPT_ENTRY, LEGACY_PROMPT_ENTRY);
    const legacyLiteBootstrap = LITE_BOOTSTRAP.replace(LITE_ENTRY, LEGACY_LITE_ENTRY);
    for (const known of [BOOTSTRAP, BOOTSTRAP.replace(PROMPT_ENTRY, PRESET_PROMPT_ENTRY), LITE_BOOTSTRAP, BOOTSTRAP.replace(PROMPT_ENTRY, CAPPED_V3_PROMPT_ENTRY), BOOTSTRAP.replace(PROMPT_ENTRY, PREVIOUS_V3_PROMPT_ENTRY), LITE_BOOTSTRAP.replace(LITE_ENTRY, PREVIOUS_V3_LITE_ENTRY), legacyBootstrap, legacyLiteBootstrap]) {
      const normalized = current.replace(/\r\n/g, '\n'), authored = known.replace(/\r\n/g, '\n');
      if (normalized.startsWith(authored)) {
        let end = 0, count = 0;
        while (count < authored.length) { if (!(current[end] === '\r' && current[end + 1] === '\n')) count++; end++; }
        const suffix = current.slice(end);
        return { name, file, text: bootstrap + suffix, action: 'updated' };
      }
    }
    const managed = [PROMPT_ENTRY, PRESET_PROMPT_ENTRY, CAPPED_V3_PROMPT_ENTRY, LITE_ENTRY, PREVIOUS_V3_PROMPT_ENTRY, PREVIOUS_V3_LITE_ENTRY, LEGACY_PROMPT_ENTRY, LEGACY_LITE_ENTRY].find(value => current.includes(value));
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
  for(const LOCAL_IGNORE of LOCAL_IGNORES) if (!lines.some((l) => l.trim() === LOCAL_IGNORE || l.trim() === '/' + LOCAL_IGNORE)) {
    appendFileSync(ignore, `${lines.length && lines.at(-1) !== '' ? '\n' : ''}# StarCi Work: local scratch and workflow tracking are ignored; product evidence remains durable\n${LOCAL_IGNORE}\n`);
    log(`added ${LOCAL_IGNORE} to .gitignore`);
  }
}

// Even --no-bootstrap must not leave host instructions pointing at removed runtime files.
function checkRetiredHostReferences(repo, plan) {
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const file = path.join(repo, name);
    const stat = lstatSync(file, { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(name + ': host instructions must be a regular file before runtime retirement');
    const text = plan?.find(item => item.name === name)?.text ?? (stat ? readFileSync(file, 'utf8') : '');
    const currentPaths = new Set(payloadFiles(packageRoot));
    const inspected = text.replace(/\.claude\/workflows\/[A-Za-z0-9_/-]+\.json\b/g, ref => currentPaths.has(ref.slice('.claude/'.length)) ? '' : ref);
    if (text.replace(/\r\n/g,'\n').includes(PRESET_PROMPT_ENTRY) || /\.claude\/(?:skills\/starci-(?:lite|goal|migrate|business|architecture|build|redesign-fe|visual|content|uat|fix|data|runtime|release|maintain)\/|alias\/|routing\.json|operators\/|workflows\/|scripts\/)|session-open\.mjs|plan-chain\.mjs|validated request\.json/.test(inspected)) {
      throw new Error(name + ': host instructions still require retired runtime paths; reconcile routing before payload cleanup');
    }
  }
}

function checkMajorUpgrade(manifest, opts) {
  if (manifest && Number(manifest.version.split('.')[0]) < Number(pkg.version.split('.')[0]) && !opts.upgradeMajor) {
    throw new Error('major workflow upgrade requires --upgrade-major after reviewing README.json; existing .worktrees data is not migrated or deleted');
  }
}

// Upgrade ownership only: these names are not executable legacy routing.
const RETIRED_ROOTS = new Set(['v3', 'legacy', 'ops', 'profiles', 'contracts', 'core', 'schemas', 'specifications', 'cli', '.dist', 'alias', 'helpers', 'knowledge', 'operators', 'readiness', 'resources', 'scripts', 'templates', 'tests', 'workflows', 'skills', 'bin']);
const PRESERVED_DOCUMENTATION_ROOTS = new Set(['docs','sites']);
function retirementPlan(target, manifest) {
  const current = new Set(payloadFiles(packageRoot));
  const remove = [], preserved = [];
  for (const [relative, originalHash] of Object.entries(manifest?.files ?? {})) {
    if (typeof relative !== 'string' || relative.includes('\\') || relative.includes(':') || path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('invalid installed manifest path; refusing cleanup before writes');
    if (PRESERVED_DOCUMENTATION_ROOTS.has(relative.split('/')[0])) { preserved.push(relative); continue; }
    if (current.has(relative)) continue;
    const allowed = ['INDEX.md','INDEX.vi.md','README.md','README.vi.md','UPDATE.md','UPDATE.vi.md','SKILL.vi.md'].includes(relative) || relative === 'routing.json' || relative.startsWith('skills/starci-lite/') || RETIRED_ROOTS.has(relative.split('/')[0]);
    if (!allowed || relative === 'resources/settings.json' || relative.split('/').some(part => ['.git', '.work', '.worktrees', 'worktrees', '_local'].includes(part))) { preserved.push(relative); continue; }
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
    if (stat.isSymbolicLink() || relative === 'resources/settings.json' || relative.split('/').some(part => ['.git', '.work', '.worktrees', 'worktrees', '_local'].includes(part))) {
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

export function init(opts, log = console.log) {
  const repo = path.resolve(opts.dir);
  const target = path.join(repo, '.claude');
  if (!existsSync(repo)) throw new Error(`${repo} does not exist`);
  safePayloadTarget(target);
  const manifest = readManifest(target);
  if (manifest) return update({ ...opts, dir: repo }, log);
  checkMajorUpgrade(manifest, opts);
  const profile = selectedProfile(opts, manifest);
  const hostPlan = opts.bootstrap ? bootstrapPlan(repo, profile) : null;
  checkRetiredHostReferences(repo, hostPlan);
  const retirement = retirementPlan(target, manifest);
  if (existsSync(target) && readdirSync(target).length && !manifest && !opts.force) {
    throw new Error(`${target} exists and was not installed by ${pkg.name}; move it away or pass --force to replace the runtime paths inside it`);
  }
  mkdirSync(target, { recursive: true });
  copyPayload(target);
  loadConfig(target, {initialize:true});
  const localIgnore = path.join(target, '.gitignore');
  if (!existsSync(localIgnore) || !readFileSync(localIgnore,'utf8').split(/\r?\n/).includes('/config.json')) appendFileSync(localIgnore, '\n/config.json\n');
  const retired = retireOwnedFiles(target, retirement);
  const written = writeManifest(target, [], profile, hostPlan ? profile : manifest?.bootstrapProfile ?? null);
  log(`installed ${pkg.name}@${pkg.version} into ${target} (${Object.keys(written.files).length} files)`);
  if (hostPlan) writeBootstraps(repo, log, hostPlan);
  log('installed profile: ' + profile + (hostPlan ? '; bootstrap updated' : '; host bootstrap unchanged'));
  if (retired.removedRetired.length) log(`removed ${retired.removedRetired.length} unchanged retired runtime file(s); recover from the prior package/Git revision`);
  for (const relative of retired.preservedRetired) log(`preserved retired/unowned ${relative}; review ownership before any manual cleanup`);
  return { ...written, ...retired };
}

export function update(opts, log = console.log) {
  const target = path.resolve(opts.dir, '.claude');
  safePayloadTarget(target);
  const manifest = readManifest(target);
  if (!manifest) throw new Error(`${target} has no ${MANIFEST}; run init first`);
  checkMajorUpgrade(manifest, opts);
  const profile = selectedProfile(opts, manifest);
  const hostPlan = opts.bootstrap !== false ? bootstrapPlan(opts.dir, profile) : null;
  checkRetiredHostReferences(opts.dir, hostPlan);
  const retirement = retirementPlan(target, manifest);
  const before = hashTree(target);
  const locallyChanged = Object.entries(before).filter(([rel, h]) => manifest.files[rel] && manifest.files[rel] !== h).map(([rel]) => rel);
  const locallyAdded = Object.keys(before).filter((rel) => !manifest.files[rel]);
  const previouslyKept = (manifest.keptLocal ?? []).filter(rel => Object.hasOwn(before, rel));
  const saved = Object.fromEntries([...new Set([...locallyChanged, ...locallyAdded, ...previouslyKept])].map((rel) => [rel, readFileSync(path.join(target, rel))]));
  copyPayload(target);
  loadConfig(target, {initialize:true});
  const localIgnore = path.join(target, '.gitignore');
  if (!existsSync(localIgnore) || !readFileSync(localIgnore,'utf8').split(/\r?\n/).includes('/config.json')) appendFileSync(localIgnore, '\n/config.json\n');
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
  const written = writeManifest(target, kept, profile, hostPlan ? profile : manifest.bootstrapProfile ?? null);
  log(`updated ${manifest.name}@${manifest.version} -> ${pkg.name}@${pkg.version} in ${target}`);
  for (const rel of kept) log(`kept ${rel} (changed locally; pass --force to take the package version)`);
  if (opts.force) log(`replaced ${Object.keys(saved).filter(rel => currentFiles.has(rel)).length} local current-payload file(s); unowned and modified retired files retained`);
  if (hostPlan) writeBootstraps(opts.dir, log, hostPlan);
  if (retired.removedRetired.length) log(`removed ${retired.removedRetired.length} unchanged retired runtime file(s); recover from the prior package/Git revision`);
  for (const relative of retired.preservedRetired) log(`preserved retired/unowned ${relative}; review ownership before any manual cleanup`);
  return { ...written, ...retired };
}

export function doctor(opts, log = console.log) {
  const target = path.join(opts.dir, '.claude');
  const installedPackage = path.join(target, 'package.json');
  if (existsSync(installedPackage) && Number(JSON.parse(readFileSync(installedPackage, 'utf8')).version?.split('.')[0]) >= 3 && !existsSync(path.join(target, 'cli', 'main.mjs'))) {
    throw new Error('installed v3 runtime is incomplete: missing cli/main.mjs; refusing fallback to legacy validation');
  }
  if (existsSync(path.join(target, 'cli', 'main.mjs'))) {
    const tests = opts.quick ? ['ops.spec.mjs', 'core.spec.mjs', 'workflow-routing.spec.mjs'] : ['ops.spec.mjs', 'core.spec.mjs', 'workflow-routing.spec.mjs', 'cli.spec.mjs', 'acceptance.spec.mjs'];
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
      const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(target, 'tests', testFile)], { cwd: target, encoding: 'utf8', windowsHide: true, env: environment });
      const output = (result.stdout ?? '') + (result.stderr ?? '');
      const count = Number(output.match(/^# tests (\d+)$/m)?.[1] ?? 0);
      const passed = Number(output.match(/^# pass (\d+)$/m)?.[1] ?? 0);
      const failures = Number(output.match(/^# fail (\d+)$/m)?.[1] ?? -1);
      const success = result.status === 0 && count > 0 && passed === count && failures === 0;
      if (!success) failed++;
      log(`${success ? 'ok  ' : 'FAIL'} tests/${testFile}: ${passed}/${count} tests passed${success ? '' : '\n' + output.trim().split('\n').slice(-25).join('\n')}`);
    }
    log(failed ? `doctor: ${failed} v3 check(s) failed` : 'doctor: v3 local contracts/tests passed; no product or deployment acceptance implied');
    return failed;
  }
  throw new Error('No current v3 runtime is installed; legacy validators are removed. Install or upgrade the skills first.');
}

const HELP = `${pkg.name} ${pkg.version}

  npx ${pkg.name} init   [--dir <repo>] [--force] [--no-bootstrap]
  npx ${pkg.name} update [--dir <repo>] [--force] [--upgrade-major]
  npx ${pkg.name} doctor [--dir <repo>] [--quick]
  npx ${pkg.name} version
  npx ${pkg.name} work <command> [arguments]

init    copies the runtime into <repo>/.claude, adds the StarCi entry once to CLAUDE.md and AGENTS.md
        while preserving custom instructions, and ignores .work/_local/ and .work/_workflows/.
        Refuses a .claude it did not install unless --force; --no-bootstrap keeps host files unchanged.
update  replaces current runtime paths; locally changed current files are kept unless --force.
        Retired manifest-owned unchanged files are removed; changed or unowned files are preserved.
        Personal settings, product .work/.worktrees and Git metadata are never cleanup targets.
        A major upgrade requires --upgrade-major; no existing .worktrees data is migrated/deleted.
entry   one full prompt-to-skill router; Lite is removed. Known old bootstraps can be migrated safely.
        Custom host rules are preserved; unresolved conflicts stop the update before writes.
        Existing product ledgers are retained; installing skills does not migrate them.
doctor  runs v3 local contract tests on the installed copy and reports local drift.
work    runs the bounded .work CLI; use "work help". Never dispatches product operations.
`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'work') {
      const result = spawnSync(process.execPath, [path.join(packageRoot, 'cli', 'main.mjs'), ...process.argv.slice(3)], { stdio: 'inherit', windowsHide: true });
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
