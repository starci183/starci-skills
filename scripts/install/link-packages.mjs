#!/usr/bin/env node
// link-packages.mjs — `starci link`: put the @starci/* packages a product repository pins into the repository from
// the runtime checkout, with no registry publish.
//
//   starci link [--repo <dir>] [--side be|fe] [--only <name,name>] [--home <runtime>] [--install] [--json]
//
// What it does, in order:
//   1. resolves the runtime: --home, else $STARCI_HOME, else the tree this script lives in;
//   2. reads knowledge/hfs/canon-pins.yaml and takes every `starci` pin the side owns (or --only), except a pin with
//      `install: registry` (a published package such as @starci/grammar): that one is installed from the npm registry
//      at its exact pinned version and `starci link` never touches it;
//   3. copies exactly the files `npm pack` would publish for each package (its `files` list) into
//      <repo>/.starci/packages/<name>/ — a plain directory, never a symlink or junction, so it works on Windows
//      without privileges and in CI, and the package resolves peers (jest, typescript, ...) from the repository;
//   4. points package.json at that copy: "@starci/x": "file:.starci/packages/x" (repo-relative, so the same text is
//      valid on every machine and in CI), in `dependencies` when the repo already lists it there, else devDependencies;
//   5. makes sure /.starci/ is in .gitignore, and records what it linked in .starci/link.json;
//   6. with --install, runs `npm install` so node_modules and package-lock.json follow.
//
// The copy is generated and ignored by git; `npm ci` needs it present, so CI runs `starci link` before `npm ci`.
// Re-running is idempotent and is how a repository picks up a runtime that moved to a newer pin.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { loadPins } from '../checks/check-canon-pins.mjs';

export const LINK_DIR = '.starci/packages';
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const slugOf = (name) => name.replace(/^@starci\//, '');

export function resolveHome(home) {
  const chosen = path.resolve(home ?? process.env.STARCI_HOME ?? skillRoot);
  if (!fs.existsSync(path.join(chosen, 'knowledge', 'hfs', 'canon-pins.yaml'))) {
    throw new Error(`STARCI_HOME ${chosen} is not a StarCi runtime checkout (no knowledge/hfs/canon-pins.yaml)`);
  }
  return chosen;
}

// npm is npm.cmd on Windows and cannot be spawned directly; going through cmd.exe avoids the shell option, which
// concatenates arguments without escaping.
function npm(args, cwd) {
  const [command, argv] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', 'npm', ...args]] : ['npm', args];
  return spawnSync(command, argv, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
}

/** The files `npm pack` would put in the tarball, relative to the package directory. */
export function packedFiles(packageDir) {
  const run = npm(['pack', '--dry-run', '--json', '--ignore-scripts'], packageDir);
  if (run.status !== 0) throw new Error(`npm pack --dry-run failed in ${packageDir}: ${String(run.stderr).trim()}`);
  const listing = JSON.parse(run.stdout);
  return listing[0].files.map((entry) => entry.path).filter((file) => !file.startsWith('node_modules/'));
}

function copyPackage({ home, pin, name, repo }) {
  const sourceDir = path.dirname(path.join(home, pin.source));
  const target = path.join(repo, ...LINK_DIR.split('/'), slugOf(name));
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error(`${target} is a link; remove it by hand, starci link writes only plain directories`);
  }
  fs.rmSync(target, { recursive: true, force: true });
  const files = packedFiles(sourceDir);
  for (const file of files) {
    const to = path.join(target, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(sourceDir, file), to);
  }
  const version = readJson(path.join(target, 'package.json')).version;
  if (version !== pin.version) throw new Error(`${name}: runtime package is ${version} but knowledge/hfs/canon-pins.yaml pins ${pin.version}`);
  return { name, version, files: files.length };
}

function updatePackageJson(repo, linked) {
  const file = path.join(repo, 'package.json');
  const raw = fs.readFileSync(file, 'utf8');
  const indent = /^\{\r?\n( +|\t)"/.exec(raw)?.[1] ?? '  ';
  const pkg = JSON.parse(raw);
  for (const { name } of linked) {
    const section = pkg.dependencies?.[name] !== undefined ? 'dependencies' : 'devDependencies';
    pkg[section] = { ...pkg[section], [name]: `file:${LINK_DIR}/${slugOf(name)}` };
    pkg[section] = Object.fromEntries(Object.entries(pkg[section]).sort(([a], [b]) => a.localeCompare(b)));
  }
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, indent)}${raw.endsWith('\n') ? '\n' : ''}`);
}

function ensureIgnored(repo) {
  const file = path.join(repo, '.gitignore');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current.split(/\r?\n/).some((line) => line.trim() === '/.starci/' || line.trim() === '.starci/')) return false;
  fs.writeFileSync(file, `${current}${current && !current.endsWith('\n') ? '\n' : ''}# generated by starci link from the runtime checkout\n/.starci/\n`);
  return true;
}

export function linkPackages({ repo, home, side, only, install = false } = {}) {
  const repoDir = path.resolve(repo ?? process.cwd());
  if (!fs.existsSync(path.join(repoDir, 'package.json'))) throw new Error(`${repoDir} has no package.json`);
  const runtime = resolveHome(home);
  const pins = loadPins(runtime).pins;
  const starci = Object.entries(pins).filter(([, pin]) => pin.group === 'starci');
  const named = (name, entry) => entry === name || entry === slugOf(name);
  if (only) {
    const unknown = only.filter((entry) => !starci.some(([name]) => named(name, entry)));
    if (unknown.length) throw new Error(`not a starci pin: ${unknown.join(', ')}`);
    const published = starci.filter(([name, pin]) => pin.install === 'registry' && only.some((entry) => named(name, entry)));
    if (published.length) throw new Error(`${published.map(([name]) => name).join(', ')}: install: registry, installed from the npm registry at the pinned version and never linked`);
  }
  const wanted = starci.filter(([name, pin]) => {
    if (pin.install === 'registry') return false;
    if (only) return only.some((entry) => named(name, entry));
    return !side || pin.side === 'both' || pin.side === side;
  });
  if (!wanted.length) throw new Error('no starci pin matches that side');
  const linked = wanted.map(([name, pin]) => copyPackage({ home: runtime, pin, name, repo: repoDir }));
  updatePackageJson(repoDir, linked);
  const ignored = ensureIgnored(repoDir);
  fs.writeFileSync(
    path.join(repoDir, '.starci', 'link.json'),
    `${JSON.stringify({ home: runtime, packages: Object.fromEntries(linked.map((entry) => [entry.name, entry.version])) }, null, 2)}\n`,
  );
  let installed = null;
  if (install) {
    const run = npm(['install', '--no-audit', '--no-fund'], repoDir);
    installed = { status: run.status, stderr: String(run.stderr).trim().split('\n').slice(-5).join('\n') };
    if (run.status !== 0) throw new Error(`npm install failed in ${repoDir}: ${installed.stderr}`);
  }
  return { repo: repoDir, home: runtime, linked, gitignoreUpdated: ignored, installed };
}

export const LINK_USAGE = `starci link [--repo <dir>] [--side be|fe] [--only <name,name>] [--home <runtime>] [--install] [--json]

Copies the pinned @starci packages from the runtime checkout into <repo>/.starci/packages and points package.json at them.
A pin with install: registry (@starci/grammar) is installed from the npm registry at its pinned version and is skipped.
-h, --help   print this text and change nothing
`;

export function linkMain(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(LINK_USAGE);
    return 0;
  }
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  try {
    const only = flag('--only')?.split(',').map((entry) => entry.trim()).filter(Boolean);
    const result = linkPackages({ repo: flag('--repo'), home: flag('--home'), side: flag('--side'), only, install: argv.includes('--install') });
    if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      for (const entry of result.linked) process.stdout.write(`linked ${entry.name}@${entry.version} (${entry.files} files) -> ${LINK_DIR}/${slugOf(entry.name)}\n`);
      process.stdout.write(result.installed ? 'npm install: done\n' : 'next: npm install (or npm ci) in the repository\n');
    }
    return 0;
  } catch (error) {
    process.stderr.write(`starci link: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = linkMain(process.argv.slice(2));
}
