// install-sandbox.mjs - the clean-machine proof of the packaged runtime: it installs the `npm pack` tarball of the root package the way a user host gets it and
// asserts that the host configuration works, without reading or writing the real home of the machine it runs on. Used by .github/workflows/install-sandbox.yml
// (a Windows and a Linux runner) and by the two local sandboxes in docs/installation.md (this host, and a throwaway Docker container).
//   starci gate install-sandbox --tarball <starci-x.y.z.tgz> [--keep] [--out <file>]
//   starci gate install-sandbox --tarball <starci-x.y.z.tgz> --docker [--tools <dir with a Linux age-keygen>]      (the same run inside a throwaway Linux container, from a checkout)
// The sandbox is one temp directory holding an empty HOME/USERPROFILE (with an empty LOCALAPPDATA and APPDATA below it) and an empty git repository `app`. The
// process environment is redirected to it before anything runs, so npm, the installer, the shim and the machine database all see only the sandbox.
// The install is the real one: `npm install --prefix <home>/.starci/runtime <tarball>` (the fetch `starci runtime install` makes, with the tarball as the spec, since
// the registry copy is not the artifact under proof), then `installRuntime` of THAT installed package (scripts/install/install.mjs init into <app>/.claude and the
// per-user shim), then the shim is run for `--version`, `runtime check --only entry` and `runtime machine-db`. Nothing here copies the payload by hand.
// Node builtins and the runtime's api call files only (git, npm, process), no bash syntax, so the same file runs on a Windows and a Linux runner. Exit 0 every assertion passed, 1 an assertion failed (a product defect or
// a stale tarball), 2 the sandbox could not run (bad usage, unreadable tarball, npm or git or the shim could not start): a step that could not run is never a pass.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { init as gitInit } from '../api/git/init.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { runProgram } from '../api/process/run-program.mjs';
import { DEFAULT_NODE } from '../lib/node-image.mjs';
import { readEnv } from '../lib/env.mjs';
const HOST_IGNORES = ['.starciwork/', '.claude/config.yaml', '.claude/secret.env'];
const REQUIRED_FILES = ['CONTEXT.md', 'skills/starci/SKILL.md', 'skills/starci/references/host-startup.md', 'config.example.yaml', 'init/AGENTS.md', '.starci-skills.json'];
const HOST_MARKER = '<!-- starci:prompt-entry -->';
const STEP_TIMEOUT_MS = 15 * 60_000;
const TAIL_LINES = 60;

/** The installed version a tarball name `<name>-<x.y.z>[-pre].tgz` declares, or null when the name is not an npm pack name. Pure. */
export function tarballVersion(file) {
  return /^[\w.-]+?-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.tgz$/.exec(path.basename(file))?.[1] ?? null;
}

/**
 * The environment of every sandboxed process: base env with the home variables of every platform pointed into the sandbox.
 * `NPM_CONFIG_*` and `STARCI_*` variables of the outer machine are dropped so a runner or host setting cannot change the proof. Pure.
 */
export function sandboxEnv({ base, home, platform }) {
  const env = Object.fromEntries(Object.entries(base).filter(([key]) => !/^(?:npm_config_|npm_package_|npm_lifecycle_|STARCI_)/i.test(key)));
  const local = path.join(home, 'AppData', 'Local');
  const roaming = path.join(home, 'AppData', 'Roaming');
  Object.assign(env, { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_CACHE_HOME: path.join(home, '.cache'), XDG_DATA_HOME: path.join(home, '.local', 'share') });
  if (platform === 'win32') Object.assign(env, { USERPROFILE: home, LOCALAPPDATA: local, APPDATA: roaming, HOMEDRIVE: path.parse(home).root.replace(/[\\/]$/, ''), HOMEPATH: home.slice(path.parse(home).root.length - 1) });
  return env;
}

/** What differs between two snapshots (Map path -> `size:mtimeMs`): {added, removed, changed} sorted. Pure. */
export function diffSnapshots(before, after) {
  const added = [...after.keys()].filter((key) => !before.has(key)).sort();
  const removed = [...before.keys()].filter((key) => !after.has(key)).sort();
  const changed = [...after.keys()].filter((key) => before.has(key) && before.get(key) !== after.get(key)).sort();
  return { added, removed, changed };
}

/** A snapshot of `target` down to `depth` levels as Map path -> `size:mtimeMs`; a missing path is an empty snapshot. Reads metadata only. */
export function snapshotTree(target, depth = 2, into = new Map()) {
  let stat;
  try { stat = fs.lstatSync(target); } catch { return into; }
  into.set(target, stat.isDirectory() ? 'dir' : `${stat.size}:${stat.mtimeMs}`);
  if (stat.isDirectory() && depth > 0) {
    let names = [];
    try { names = fs.readdirSync(target); } catch { names = []; }
    for (const name of names) snapshotTree(path.join(target, name), depth - 1, into);
  }
  return into;
}

/**
 * The real-home places this install writes if the redirection leaks: the per-user record, launcher dir and runtime dir the install owns, and the npm cache root.
 * Only these exact paths are watched (not the whole .starci, which a live host keeps writing to). Pure.
 */
export function watchedPaths({ realHome, realLocal, platform }) {
  const watched = [path.join(realHome, '.starci', 'runtime.json'), path.join(realHome, '.starci', 'bin'), path.join(realHome, '.starci', 'runtime'), path.join(realHome, '.npm')];
  if (platform === 'win32' && realLocal) watched.push(path.join(realLocal, 'npm-cache'));
  return watched;
}

/** The first PATH entry holding `program` (with a PATHEXT extension on Windows), or null. `exists` is the file probe. Pure over its inputs. */
export function findOnPath(program, { pathValue, platform, pathext = '.COM;.EXE;.BAT;.CMD', exists: probe = exists }) {
  const names = platform === 'win32' ? [program, ...pathext.split(';').filter(Boolean).map((ext) => program + ext.toLowerCase())] : [program];
  for (const dir of String(pathValue ?? '').split(platform === 'win32' ? ';' : ':').filter(Boolean)) {
    for (const name of names) if (probe(path.join(dir, name))) return path.join(dir, name);
  }
  return null;
}

/** The exit code of a finished run: 2 when any step could not run, else 1 when any assertion failed, else 0. Pure. */
export function exitCodeFor(results) {
  if (results.some((result) => result.status === 'error')) return 2;
  return results.some((result) => result.status === 'fail') ? 1 : 0;
}

function exists(file) { return fs.existsSync(file); }

/** The managed gitignore entries `text` lacks, matching a line with or without a leading slash. Pure. */
export function missingIgnores(text, entries = HOST_IGNORES) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  return entries.filter((entry) => !lines.includes(entry) && !lines.includes(`/${entry}`));
}

/** The last `lines` non-blank lines of `text` (CRLF folded): the part of a child's output that names its failure. Pure. */
export function tailOf(text, lines = TAIL_LINES) { return String(text ?? '').replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim()).slice(-lines).join('\n'); }

/** The failure detail of a child step: its exit, the installer's JSON result line when it printed one, then the tail of its stdout, stderr and own report. Pure. */
export function childDetail({ label, status, stdout = '', stderr = '', report = '' }) {
  const result = String(stdout).replace(/\r\n/g, '\n').split('\n').filter((line) => line.startsWith('initial age setup: ')).at(-1);
  return [`${label} exit ${status}`, ...(result ? [`installer result: ${result}`] : []), `--- output tail (last ${TAIL_LINES} lines of stdout, stderr and report)`, tailOf(`${stdout}\n${stderr}\n${report}`)].join('\n');
}

/**
 * A second spelling of the directory `root` that is not its canonical path, or why none exists: on Windows its 8.3 short name (when the volume generates short
 * names), elsewhere a path through a symlinked parent (the macOS /var -> /private/var shape). The directory must exist. Reads the host (cmd.exe, the filesystem).
 */
export function nonCanonicalSpelling(root, { platform = process.platform } = {}) {
  if (platform === 'win32') {
    const run = runProgram('cmd.exe', ['/d', '/s', '/c', `"for %I in ("${root}") do @echo %~sI"`], { windowsVerbatimArguments: true });
    const short = run.status === 0 ? String(run.stdout).trim() : '';
    return short && short.toLowerCase() !== fs.realpathSync.native(root).toLowerCase() ? { path: short } : { reason: 'this volume has no 8.3 short name for the sandbox directory (fsutil 8dot3name query <drive>:)' };
  }
  const holder = `${root}-via`;
  try { fs.symlinkSync(path.dirname(root), holder, 'dir'); } catch (error) { return { reason: `a symlink to the temp directory could not be created: ${error.code ?? error.message}` }; }
  return { path: path.join(holder, path.basename(root)), holder };
}

/** The compact summary document written to stdout and to the step summary. Pure. */
export function summaryOf({ results, version, platform, node, sandbox }) {
  return {
    schema: 'starci/install-sandbox@1', platform, node, version, sandbox,
    passed: results.filter((r) => r.status === 'pass').length, failed: results.filter((r) => r.status === 'fail').length, errored: results.filter((r) => r.status === 'error').length, skipped: results.filter((r) => r.status === 'skipped').length,
    results: results.map(({ name, status, detail }) => ({ name, status, ...(detail ? { detail } : {}) })),
  };
}

/** The markdown table of a summary for $GITHUB_STEP_SUMMARY. Pure. */
export function summaryMarkdown(summary) {
  const rows = summary.results.map((r) => `| ${r.status} | ${r.name} | ${String(r.detail ?? '').replace(/\|/g, '/').split(/\r?\n/)[0].slice(0, 200)} |`);
  const fence = '`'.repeat(3);
  const long = summary.results.filter((r) => r.status !== 'pass' && String(r.detail ?? '').includes('\n')).map((r) => `<details open><summary>${r.name}</summary>\n\n${fence}text\n${r.detail.replaceAll(fence, "'''")}\n${fence}\n</details>\n`);
  return [`## Install sandbox (${summary.platform}, node ${summary.node}, starci ${summary.version})`, '', `passed ${summary.passed}, failed ${summary.failed}, could not run ${summary.errored}${summary.skipped ? `, skipped ${summary.skipped}` : ''}`, '', '| result | assertion | detail |', '| --- | --- | --- |', ...rows, '', ...long].join('\n');
}

/** The `docker run` arguments (after `--rm`) of the Linux sandbox: one named container, the staged directory mounted READ-ONLY at /in, no port, no other mount. Pure. */
export function dockerArgs({ name, stage, image, tarballName, script, tools = null }) {
  // The node image carries node and git but not age-keygen (the apt package is an unsupported 1.1.1): a caller who has a supported Linux build mounts its directory read-only and it leads PATH.
  const mounts = ['--mount', `type=bind,source=${stage},target=/in,readonly`, ...(tools ? ['--mount', `type=bind,source=${tools},target=/tools,readonly`] : [])];
  const command = `${tools ? 'PATH=/tools:$PATH ' : ''}node /in/${script} --tarball /in/${tarballName}`;
  return ['--name', name, ...mounts, image, 'sh', '-c', command];
}

/** The runtime checkout holding this script, and the script's path inside it: the staged copy keeps that path so its relative imports resolve inside the container. */
const CHECKOUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.relative(CHECKOUT, fileURLToPath(import.meta.url)).split(path.sep).join('/');

/** The runtime files the container needs beside this script: everything its top-level static imports reach (the call files and what they import), derived from the import graph. */
async function containerFiles() {
  const { importClosure } = await import('../hfs/sync-runtime.mjs');
  const entries = [...read(fileURLToPath(import.meta.url)).matchAll(/^import [^\n]*? from '(\.[^']+)';$/gm)].map((match) => path.posix.join(path.posix.dirname(SCRIPT), match[1]));
  return importClosure(entries);
}

/**
 * Run the sandbox script inside a throwaway container of the node image the release parity step uses, through the docker call files (scripts/api/docker). Only the
 * tarball, this script and the call files it imports are staged (copied into a temp directory that is mounted read-only); the container is removed on exit. Needs a
 * checkout (the docker owner and the import graph live there), so the imports are lazy: the CI legs never load them. Returns the exit code (the container's, or 2 when
 * docker could not run).
 */
async function runInDocker({ tarball, tools = null }) {
  const { run } = await import('../api/docker/run.mjs');
  const tarballName = path.basename(tarball);
  if (!tarballVersion(tarballName) || !exists(tarball)) throw new CouldNotRun(`${tarball} is not an existing npm pack tarball`);
  const stage = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sandbox-stage-')));
  try {
    fs.copyFileSync(tarball, path.join(stage, tarballName));
    for (const file of [SCRIPT, ...await containerFiles()]) {
      fs.mkdirSync(path.dirname(path.join(stage, file)), { recursive: true });
      fs.copyFileSync(path.join(CHECKOUT, file), path.join(stage, file));
    }
    const name = `starci-install-sandbox-${process.pid}`;
    const result = run(dockerArgs({ name, stage, image: `node:${DEFAULT_NODE}`, tarballName, script: SCRIPT, tools }), { stdio: 'inherit', timeout: STEP_TIMEOUT_MS });
    if (result.error) throw new CouldNotRun(`docker could not run: ${result.error.message}`);
    return result.status ?? 2;
  } finally {
    await removeTree(stage);
  }
}

/**
 * Remove a scratch tree through the link-safe owner (scripts/api/fs/safe-remove.mjs), imported lazily: inside the throwaway container only this script and the tarball
 * exist, so the owner is absent there and the tree is left for the container's own removal (`docker run --rm`). Any other import failure is real.
 */
async function removeTree(dir) {
  let owner, hold;
  try {
    owner = await import('../api/fs/safe-remove.mjs');
    hold = await import('../machine/artifact-hold.mjs');
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return;
    throw error;
  }
  owner.safeRemove(dir, { hold: hold.artifactHoldReason });
}

/** Thrown by a step that could not run at all (not an assertion that came out false). */
class CouldNotRun extends Error {}

const read = (file) => fs.readFileSync(file, 'utf8');
const lf = (text) => text.split('\r\n').join('\n');

/** A finished child as {status, stdout, stderr}; a spawn error (`label` could not start) is CouldNotRun. */
function finished(label, result) {
  if (result.error) throw new CouldNotRun(`${label} could not run: ${result.error.message}`);
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/** Run a program through the process call file (never a shell) and return {status, stdout, stderr}. */
const exec = (program, args, options) => finished(program, runProgram(program, args, { timeout: STEP_TIMEOUT_MS, ...options }));

/** Run the sandbox; returns the summary document. `argv` carries --tarball, --keep, --out. */
async function runSandbox({ tarball, keep = false }) {
  const results = [];
  const record = (name, ok, detail = '') => results.push({ name, status: ok ? 'pass' : 'fail', detail: ok ? detail : detail || 'assertion false' });
  const step = async (name, body) => {
    try { await body(); } catch (error) {
      if (!(error instanceof CouldNotRun)) throw error;
      results.push({ name, status: 'error', detail: error.message });
    }
  };
  const platform = process.platform;
  const tarballFile = path.resolve(tarball);
  const version = tarballVersion(tarballFile);
  if (!version) throw new CouldNotRun(`${tarballFile} is not an npm pack tarball name (<name>-<x.y.z>.tgz)`);
  if (!exists(tarballFile)) throw new CouldNotRun(`${tarballFile} does not exist`);

  const realHome = os.homedir();
  const realLocal = readEnv('LOCALAPPDATA');
  const watched = watchedPaths({ realHome, realLocal, platform });
  const realBefore = new Map(watched.flatMap((target) => [...snapshotTree(target, 1)]));
  const realNamesBefore = new Set(fs.readdirSync(realHome));

  // The root keeps the spelling the host gives (a Windows 8.3 short-named TEMP, as on a GitHub windows runner): the sandbox exists to catch a product that mistakes it for a link.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sandbox-')));
  const home = path.join(root, 'home');
  const app = path.join(root, 'app');
  const store = path.join(root, 'store');
  for (const dir of [home, path.join(home, 'AppData', 'Local'), path.join(home, 'AppData', 'Roaming'), app, store]) fs.mkdirSync(dir, { recursive: true });
  const env = sandboxEnv({ base: process.env, home, platform });
  // The in-process work (installRuntime reads os.homedir() and the environment) sees the sandbox too.
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const opts = { cwd: app, env };
  const homeBefore = snapshotTree(home, 8);
  const rel = (target) => path.relative(root, target).split(path.sep).join('/');

  await step('git init of the empty app repository', async () => {
    const r = gitInit(app, { env });
    record('empty app git repository', r.ok && exists(path.join(app, '.git')), r.stderr);
  });

  const runtimeRoot = path.join(home, '.starci', 'runtime', 'node_modules', 'starci');
  let fetched = false;
  await step('fetch the tarball', async () => {
    const r = finished('npm', runNpm(['install', '--prefix', path.join(home, '.starci', 'runtime'), tarballFile, '--no-audit', '--no-fund'], { timeout: STEP_TIMEOUT_MS, ...opts }));
    record('npm install of the tarball into <home>/.starci/runtime', r.status === 0 && exists(path.join(runtimeRoot, 'scripts', 'install', 'install.mjs')), r.status === 0 ? '' : childDetail({ label: 'npm install', status: r.status, stdout: r.stdout, stderr: r.stderr }));
    if (r.status !== 0) throw new CouldNotRun('the tarball could not be fetched; nothing further can run');
    fetched = true;
    const installed = JSON.parse(read(path.join(runtimeRoot, 'package.json'))).version;
    record('the fetched package version equals the tarball version', installed === version, `tarball ${version}, package ${installed}`);
  });

  // The init lifecycle generates the host's age identity with age-keygen (scripts/api/sops/lib.mjs withGeneratedAgeIdentity); without it the install projects the
  // files and then exits 1 as "held". It is a prerequisite of a clean host, so it is asserted by name rather than left to read as an opaque install failure.
  const ageKeygen = findOnPath('age-keygen', { pathValue: env.PATH ?? env.Path, platform, pathext: env.PATHEXT });
  const ageVersion = ageKeygen ? exec(ageKeygen, ['--version'], opts).stdout.trim() : 'not found';
  record('age-keygen is on PATH (prerequisite of the init identity setup)', ageKeygen !== null, `${ageKeygen ?? 'none'}, version ${ageVersion}${ageKeygen ? '' : ': the install below is expected to hold'}`);

  const claude = path.join(app, '.claude');
  let installStatus = null;
  // The installer child runs with its output captured (and echoed), so a failed install reports what it printed instead of a bare exit code.
  let lastRun = { stdout: '', stderr: '', report: '' };
  const install = async ({ cwd = app, homeDir = home, environment = env } = {}) => {
    lastRun = { stdout: '', stderr: '', report: '' };
    const runNode = (args, options) => {
      const r = runProgram(process.execPath, args, { ...options, env: environment, stdio: 'pipe', maxBuffer: 256 * 1024 * 1024, timeout: STEP_TIMEOUT_MS });
      lastRun.stdout += r.stdout ?? ''; lastRun.stderr += r.stderr ?? '';
      process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? '');
      return r;
    };
    const stderr = (text) => { lastRun.report += text; process.stderr.write(text); };
    const { installRuntime } = await import(pathToFileURL(path.join(runtimeRoot, 'packages', 'cli', 'src', 'runtime-install.mjs')).href);
    // The tarball is already fetched by the npm step above (the same fetch installRuntime makes, with the tarball as its spec): the orchestration, the installer
    // entry and the shim writer that run here are the INSTALLED ones.
    return installRuntime({ cwd, home: homeDir, stderr }, { fetchRuntime: () => 0, env: environment, runNode });
  };
  const failed = (label, status) => childDetail({ label, status, ...lastRun });
  const skipped = (names, why) => { for (const name of names) results.push({ name, status: 'skipped', detail: why }); };
  if (fetched) {
    await step('install into the app', async () => {
      installStatus = await install();
      record('runtime install into the app exits 0', installStatus === 0, installStatus === 0 ? '' : failed('runtime install', installStatus));
    });
  } else skipped(['runtime install into the app exits 0'], 'skipped: the tarball fetch above did not succeed');

  if (installStatus === 0) {
    await step('configuration assertions', async () => {
      for (const file of REQUIRED_FILES) record(`.claude/${file} exists`, exists(path.join(claude, file)));
      const manifest = JSON.parse(read(path.join(claude, '.starci-skills.json')));
      record('the install manifest records the tarball version', manifest.version === version, `manifest ${manifest.version}, tarball ${version}`);
      record('no .starci/host anywhere (app, .claude, home)', ![path.join(app, '.starci', 'host'), path.join(claude, '.starci', 'host'), path.join(home, '.starci', 'host')].some(exists));
      const example = path.join(claude, 'config.example.yaml');
      const config = path.join(claude, 'config.yaml');
      record('config.yaml is seeded verbatim from config.example.yaml', exists(config) && exists(example) && read(config) === read(example));
      const agents = path.join(app, 'AGENTS.md');
      const template = exists(path.join(claude, 'init', 'AGENTS.md')) ? read(path.join(claude, 'init', 'AGENTS.md')) : null;
      record('AGENTS.md carries the managed prompt entry of init/AGENTS.md', exists(agents) && template !== null && lf(read(agents)).includes(HOST_MARKER) && lf(read(agents)) === lf(template));
      record('CLAUDE.md and DEVIN.md are absent without --hosts', !exists(path.join(app, 'CLAUDE.md')) && !exists(path.join(app, 'DEVIN.md')));
      record('the public starci entry is installed in .agents/skills/starci/SKILL.md', exists(path.join(app, '.agents', 'skills', 'starci', 'SKILL.md')));
      const ignore = exists(path.join(app, '.gitignore')) ? read(path.join(app, '.gitignore')) : '';
      record('the app .gitignore has the host ignores', missingIgnores(ignore).length === 0, `missing: ${missingIgnores(ignore).join(', ') || 'none'}`);
      const innerIgnore = exists(path.join(claude, '.gitignore')) ? read(path.join(claude, '.gitignore')) : '';
      record('.claude/.gitignore ignores /config.yaml and /secret.env', missingIgnores(innerIgnore, ['/config.yaml', '/secret.env']).length === 0);
    });

    await step('shim and CLI assertions', async () => {
      const shimDir = path.join(home, '.starci', 'bin');
      const shim = path.join(shimDir, platform === 'win32' ? 'starci.cmd' : 'starci');
      const record0 = exists(path.join(home, '.starci', 'runtime.json')) ? JSON.parse(read(path.join(home, '.starci', 'runtime.json'))) : null;
      record('runtime.json names <app>/.claude as the runtime root', record0 !== null && path.resolve(record0.root) === claude, record0 ? record0.root : 'missing');
      record('the starci shim file exists', exists(shim), rel(shim));
      // The shim is the per-user launcher; a .cmd needs the command interpreter, a POSIX shim runs directly.
      const starci = (args, extra = {}) => platform === 'win32'
        ? exec(readEnv('ComSpec') ?? 'cmd.exe', ['/d', '/s', '/c', `"${shim}" ${args.map((a) => (/[\s&]/.test(a) ? `"${a}"` : a)).join(' ')}`], { ...opts, windowsVerbatimArguments: true, ...extra })
        : exec(shim, args, { ...opts, ...extra });
      // `starci --version` prints the version of the CLI package (packages/cli, its own semver); the runtime version is the one `runtime version` prints.
      const cliVersion = starci(['--version']);
      record('starci --version prints a semver', cliVersion.status === 0 && /^\d+\.\d+\.\d+/.test(cliVersion.stdout.trim()), `cli package ${JSON.stringify(cliVersion.stdout.trim().slice(0, 40))}`);
      const v = starci(['runtime', 'version']);
      record('starci runtime version equals the tarball version', v.status === 0 && v.stdout.trim() === version, `exit ${v.status}, printed ${JSON.stringify(v.stdout.trim().slice(0, 80))}, tarball ${version}${v.stderr.trim() ? `, stderr ${JSON.stringify(v.stderr.trim().slice(0, 200))}` : ''}`);
      const entry = starci(['runtime', 'check', '--only', 'entry', '--', app]);
      record('starci runtime check --only entry <app> passes', entry.status === 0, `exit ${entry.status}, ${(entry.stdout || entry.stderr).trim().slice(0, 400)}`);
      const machine = path.join(store, 'machine.sqlite');
      const init = starci(['runtime', 'machine-db', 'init', '--file', machine, '--json']);
      record('machine-db init creates a fresh store', init.status === 0 && exists(machine), `exit ${init.status}, ${(init.stdout || init.stderr).trim().slice(0, 300)}`);
      const status = starci(['runtime', 'machine-db', 'status', '--file', machine, '--json']);
      let parsed = null;
      try { parsed = JSON.parse(status.stdout); } catch { parsed = null; }
      record('machine-db status reads the fresh store at schema starci/machine@1', status.status === 0 && parsed?.meta?.schema === 'starci/machine@1', `exit ${status.status}, ${status.stdout.trim().slice(0, 300) || status.stderr.trim().slice(0, 300)}`);
    });

    await step('second install', async () => {
      const config = path.join(claude, 'config.yaml');
      fs.appendFileSync(config, '\n# owner edit made after the first install\n');
      const edited = read(config);
      const agentsBefore = read(path.join(app, 'AGENTS.md'));
      const ignoreBefore = read(path.join(app, '.gitignore'));
      const second = await install();
      record('a second runtime install exits 0', second === 0, second === 0 ? '' : failed('second runtime install', second));
      record('the second install does not rewrite an existing config.yaml', read(config) === edited);
      record('the second install leaves AGENTS.md and .gitignore byte-identical', read(path.join(app, 'AGENTS.md')) === agentsBefore && read(path.join(app, '.gitignore')) === ignoreBefore);
    });
    await step('install through a non-canonical path spelling', async () => {
      const name = 'install succeeds through a non-canonical (8.3 or symlinked-prefix) path spelling', spelled = nonCanonicalSpelling(root);
      if (!spelled.path) return skipped([name], `skipped: ${spelled.reason}`);
      const other = path.join(spelled.path, 'app-spelled'), homeSpelled = path.join(spelled.path, 'home');
      fs.mkdirSync(path.join(root, 'app-spelled'));
      const made = gitInit(other, { env });
      const code = made.ok ? await install({ cwd: other, homeDir: homeSpelled, environment: sandboxEnv({ base: env, home: homeSpelled, platform }) }) : null;
      record(name, code === 0 && exists(path.join(root, 'app-spelled', '.claude', '.starci-skills.json')), code === 0 ? `through ${spelled.path}` : made.ok ? failed('runtime install through the spelled path', code) : made.stderr);
      if (spelled.holder) fs.unlinkSync(spelled.holder);
    });
  } else if (fetched) skipped(['configuration assertions', 'shim and CLI assertions', 'second install'], 'skipped: the runtime install above failed, so there is no installed host to assert');

  // Leak check: every file the run left is inside the sandbox root, and the real-home places the install would write are unchanged.
  const homeAfter = snapshotTree(home, 8);
  const homeDiff = diffSnapshots(homeBefore, homeAfter);
  const realAfter = new Map(watched.flatMap((target) => [...snapshotTree(target, 1)]));
  const realDiff = diffSnapshots(realBefore, realAfter);
  const realNamesAfter = new Set(fs.readdirSync(realHome));
  const newRealNames = [...realNamesAfter].filter((name) => !realNamesBefore.has(name));
  record('nothing was written to the real home', realDiff.added.length + realDiff.removed.length + realDiff.changed.length === 0 && newRealNames.length === 0,
    `watched ${watched.length} paths, added ${JSON.stringify(realDiff.added.slice(0, 5))}, removed ${JSON.stringify(realDiff.removed.slice(0, 5))}, changed ${JSON.stringify(realDiff.changed.slice(0, 5))}, new top-level names ${JSON.stringify(newRealNames)}`);
  record('the sandbox home gained the install (listing before and after)', homeDiff.added.length > 0 || installStatus !== 0, `home entries ${homeBefore.size} -> ${homeAfter.size}`);

  const summary = summaryOf({ results, version, platform: `${platform}-${os.arch()}`, node: process.version, sandbox: keep ? root : '<removed>' });
  if (!keep) await removeTree(root);
  return summary;
}

/** The options of an argv: {tarball, keep, docker, tools, out}; a flag with a value takes the next entry. Pure. */
export function parseArgs(argv) {
  const out = { tarball: undefined, keep: false, docker: false, tools: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--keep') out.keep = true;
    else if (argv[i] === '--docker') out.docker = true;
    else if (['--tarball', '--tools', '--out'].includes(argv[i])) out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

/** Run the script; returns the exit code. */
export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (!args.tarball) {
    process.stderr.write('usage: install-sandbox.mjs --tarball <starci-x.y.z.tgz> [--keep] [--out <file>] [--docker [--tools <dir>]]\n');
    return 2;
  }
  if (args.docker) {
    try { return await runInDocker({ tarball: path.resolve(args.tarball), tools: args.tools ? path.resolve(args.tools) : null }); } catch (error) {
      process.stderr.write(`install-sandbox: could not run: ${error.message}\n`);
      return 2;
    }
  }
  let summary;
  try {
    summary = await runSandbox({ tarball: args.tarball, keep: args.keep });
  } catch (error) {
    process.stderr.write(`install-sandbox: could not run: ${error.message}\n`);
    return 2;
  }
  const text = JSON.stringify(summary, null, 2);
  process.stdout.write(`${text}\n`);
  for (const r of summary.results) process.stdout.write(`${r.status.toUpperCase().padEnd(5)} ${r.name}${r.status === 'pass' ? '' : `: ${r.detail}`}\n`);
  if (args.out) fs.writeFileSync(args.out, `${text}\n`);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${summaryMarkdown(summary)}\n`);
  return exitCodeFor(summary.results);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2), { ...process.env }));
