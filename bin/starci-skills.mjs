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
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

// What an installed tree is made of. Only these paths are copied, hashed and updated; anything else
// a person adds beside them (a tests/ folder, notes) is theirs and is never touched.
export const PAYLOAD = [
  'UPDATE.md', 'UPDATE.vi.md',
  'INDEX.md', 'INDEX.vi.md', 'SKILL.md', 'SKILL.vi.md', 'routing.json',
  'alias', 'helpers', 'knowledge', 'operators', 'readiness', 'resources', 'scripts', 'templates', 'workflows',
];
const MANIFEST = '.starci-skills.json';
const SESSIONS_IGNORE = '.worktrees/sessions/';
const ENTRY_MARKER = '<!-- starci:prompt-entry -->';
const PROMPT_ENTRY = `${ENTRY_MARKER}
For every user prompt, enter [StarCi](.claude/INDEX.md) before planning or target work and follow
the entry's user-session and goal protocol. Follow-up prompts reuse that host session.
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

// The validators the tree ships, in the order npm test runs them. --quick keeps the three that
// finish in seconds; the full doctor also runs the operator self-tests and the script specs.
const DOCTOR_QUICK = ['validate-routing.mjs', 'validate-alias.mjs', 'validate-operator.mjs'];
const DOCTOR_FULL = [
  'validate-routing.mjs', 'validate-resources.mjs', 'validate-knowledge-citations.mjs', 'validate-alias.mjs',
  ['generate-alias-doc.mjs', '--check'], 'validate-operator.mjs', 'validate-helper.mjs', 'validate-defaults.mjs',
  ['generate-operators-index.mjs', '--check'], ['generate-helpers-index.mjs', '--check'], 'validate-templates.mjs', 'run-operator-self-tests.mjs',
];

function parseArgs(argv) {
  const out = { command: argv[0] ?? 'help', dir: process.cwd(), force: false, quick: false, bootstrap: true };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dir') out.dir = path.resolve(argv[++i] ?? '.');
    else if (a.startsWith('--dir=')) out.dir = path.resolve(a.slice(6));
    else if (a === '--force') out.force = true;
    else if (a === '--quick') out.quick = true;
    else if (a === '--no-bootstrap') out.bootstrap = false;
    else if (a === '-h' || a === '--help') out.command = 'help';
    else throw new Error(`unknown argument ${a}`);
  }
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
function writeManifest(target, kept = []) {
  const manifest = { name: pkg.name, version: pkg.version, installedAt: new Date().toISOString(), files: hashTree(target) };
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

function writeBootstraps(repo, log) {
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const file = path.join(repo, name);
    if (!existsSync(file)) { writeFileSync(file, BOOTSTRAP); log(`wrote ${name}`); continue; }
    const current = readFileSync(file, 'utf8');
    if (!current.includes(ENTRY_MARKER)) {
      appendFileSync(file, `${current.endsWith('\n') ? '\n' : '\n\n'}${PROMPT_ENTRY}\n`);
      log(`updated ${name} (added prompt entry; preserved existing instructions)`);
    } else log(`kept ${name} (already routes every prompt to StarCi)`);
  }
  const ignore = path.join(repo, '.gitignore');
  const lines = existsSync(ignore) ? readFileSync(ignore, 'utf8').split(/\r?\n/) : [];
  if (!lines.some((l) => l.trim() === SESSIONS_IGNORE || l.trim() === '.worktrees/' || l.trim() === '.worktrees')) {
    appendFileSync(ignore, `${lines.length && lines.at(-1) !== '' ? '\n' : ''}# StarCi Skills sessions live here and are never committed\n${SESSIONS_IGNORE}\n`);
    log(`added ${SESSIONS_IGNORE} to .gitignore`);
  }
}

export function init(opts, log = console.log) {
  const repo = opts.dir;
  const target = path.join(repo, '.claude');
  if (!existsSync(repo)) throw new Error(`${repo} does not exist`);
  const manifest = readManifest(target);
  if (existsSync(target) && readdirSync(target).length && !manifest && !opts.force) {
    throw new Error(`${target} exists and was not installed by ${pkg.name}; move it away or pass --force to replace the runtime paths inside it`);
  }
  if (manifest) log(`re-installing over ${manifest.name}@${manifest.version} (use "update" to keep local changes)`);
  mkdirSync(target, { recursive: true });
  copyPayload(target);
  const written = writeManifest(target);
  log(`installed ${pkg.name}@${pkg.version} into ${target} (${Object.keys(written.files).length} files)`);
  if (opts.bootstrap) writeBootstraps(repo, log);
  log('next: open the repo with Claude Code or Codex; the bootstrap routes every agent to .claude/INDEX.md');
  return written;
}

export function update(opts, log = console.log) {
  const target = path.join(opts.dir, '.claude');
  const manifest = readManifest(target);
  if (!manifest) throw new Error(`${target} has no ${MANIFEST}; run init first`);
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
  const written = writeManifest(target, kept);
  log(`updated ${manifest.name}@${manifest.version} -> ${pkg.name}@${pkg.version} in ${target}`);
  for (const rel of kept) log(`kept ${rel} (changed locally; pass --force to take the package version)`);
  if (opts.force && (locallyChanged.length || locallyAdded.length)) log(`replaced ${locallyChanged.length + locallyAdded.length} locally changed file(s)`);
  if (opts.bootstrap !== false) writeBootstraps(opts.dir, log);
  return written;
}

export function doctor(opts, log = console.log) {
  const target = path.join(opts.dir, '.claude');
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

  npx ${pkg.name} init   [--dir <repo>] [--force] [--no-bootstrap]
  npx ${pkg.name} update [--dir <repo>] [--force]
  npx ${pkg.name} doctor [--dir <repo>] [--quick]
  npx ${pkg.name} version

init    copies the runtime into <repo>/.claude, adds the StarCi entry once to CLAUDE.md and AGENTS.md
        while preserving custom instructions, and adds .worktrees/sessions/ to .gitignore.
        Refuses a .claude it did not install unless --force; --no-bootstrap keeps host files unchanged.
update  replaces the runtime paths with this version; a file changed locally is kept and listed
        (resources/settings.json is the person's own and is never part of the package)
        unless --force. Files outside the runtime paths are never touched.
doctor  runs the tree's own validators on the installed copy and reports local drift.
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
