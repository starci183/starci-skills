// source-canon-registry.mjs - the @starci packages of this checkout as an npm registry, for a spec that resolves a scaffolded
// app's real lockfile before those versions are published. The canon versions are raised in the source ahead of the one
// publish (knowledge/hfs/canon-pins.yaml pins the source version), so the public registry may not hold them yet: a spec that
// depends on publish state is red on main for no fault of the code. Every public @starci package under packages/ is packed
// with `npm pack` (scripts/api/npm), and a loopback server in its own process serves a packument and the tarball of each.
// The lock step runs the scaffold's own `npm install --package-lock-only` with `@starci:registry` pointed at that server for
// the one call (an app-root .npmrc it writes and removes), so every other package resolves from the public registry and the
// scaffold's output is unchanged. Nothing is linked and no lockfile is written by hand.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { runNpm } from '../../scripts/api/npm/run-npm.mjs';
import { isMain } from '../../scripts/lib/is-main.mjs';
import { npmLock } from '../../packages/hfs/scaffold/app.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..', '..');
/** The package.json fields a packument version carries: what npm reads to resolve and lock it. */
const MANIFEST_FIELDS = ['name', 'version', 'description', 'license', 'main', 'exports', 'type', 'bin', 'engines', 'os', 'cpu',
  'dependencies', 'peerDependencies', 'peerDependenciesMeta', 'optionalDependencies', 'bundleDependencies'];

/** Every public @starci package of the checkout: [{name, version, dir}] (packages/<folder> or packages/<folder>/<side>). */
export function sourceCanonPackages(root = RUNTIME) {
  const packages = path.join(root, 'packages');
  const dirs = fs.readdirSync(packages, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
    .flatMap((entry) => {
      const dir = path.join(packages, entry.name);
      if (fs.existsSync(path.join(dir, 'package.json'))) return [dir];
      return fs.readdirSync(dir, { withFileTypes: true }).filter((side) => side.isDirectory()).map((side) => path.join(dir, side.name));
    });
  return dirs.filter((dir) => fs.existsSync(path.join(dir, 'package.json')))
    .map((dir) => ({ dir, json: JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) }))
    .filter(({ json }) => String(json.name ?? '').startsWith('@starci/') && json.private !== true)
    .map(({ dir, json }) => ({ name: json.name, version: json.version, dir, json }));
}

/** Packs `pkg` into `into` with npm (no lifecycle script) and returns the tarball's path. */
function pack(pkg, into) {
  const r = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', into], { cwd: pkg.dir, timeout: 300_000 });
  if (r.error || r.status !== 0) throw new Error(`npm pack of ${pkg.name} in ${pkg.dir} failed: ${r.stderr || r.error?.message}`);
  const [packed] = JSON.parse(r.stdout.slice(r.stdout.indexOf('[')));
  return path.join(into, packed.filename);
}

/**
 * Writes the registry tree under `dir`: `<name with / as %2f>.json` holds the packument template (its tarball URLs carry
 * the {{origin}} placeholder the server fills), `tarballs/<file>` the packed package.
 */
function writeRegistry(dir, packages) {
  fs.mkdirSync(path.join(dir, 'tarballs'), { recursive: true });
  for (const pkg of packages) {
    const tarball = pack(pkg, path.join(dir, 'tarballs'));
    const bytes = fs.readFileSync(tarball);
    const manifest = Object.fromEntries(MANIFEST_FIELDS.filter((field) => pkg.json[field] !== undefined).map((field) => [field, pkg.json[field]]));
    const version = {
      ...manifest, _id: `${pkg.name}@${pkg.version}`,
      dist: {
        tarball: `{{origin}}/tarballs/${path.basename(tarball)}`,
        shasum: crypto.createHash('sha1').update(bytes).digest('hex'),
        integrity: `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`,
      },
    };
    const packument = { _id: pkg.name, name: pkg.name, 'dist-tags': { latest: pkg.version }, versions: { [pkg.version]: version } };
    fs.writeFileSync(path.join(dir, `${encodeURIComponent(pkg.name)}.json`), JSON.stringify(packument));
  }
}

/** Serves the registry tree at `dir` on a loopback port and prints `listening <port>` once it answers. */
function serve(dir) {
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const origin = `http://${request.headers.host}`;
    const file = url.startsWith('tarballs/') ? path.join(dir, 'tarballs', path.basename(url)) : path.join(dir, `${encodeURIComponent(url)}.json`);
    if (!fs.existsSync(file)) { response.writeHead(404, { 'content-type': 'application/json' }); response.end('{"error":"not found"}'); return; }
    if (url.startsWith('tarballs/')) { response.writeHead(200, { 'content-type': 'application/octet-stream' }); response.end(fs.readFileSync(file)); return; }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(fs.readFileSync(file, 'utf8').replaceAll('{{origin}}', origin));
  });
  server.listen(0, '127.0.0.1', () => process.stdout.write(`listening ${server.address().port}\n`));
}

/**
 * Packs the checkout's @starci packages, starts their registry in a child process and returns
 * { packages, lock(root), close() }. `lock` is a scaffoldApp lock step: the scaffold's own npmLock with the @starci scope
 * resolved from this registry. It first proves the premise: every @starci version the app pins is the checkout's.
 */
export async function startSourceCanonRegistry({ root = RUNTIME } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-source-canon-'));
  const packages = sourceCanonPackages(root);
  writeRegistry(dir, packages);
  const child = spawn(process.execPath, [import.meta.filename, dir], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.once('exit', (code) => reject(new Error(`the source canon registry exited (${code}) before it listened`)));
    child.stdout.on('data', (chunk) => { out += chunk; const match = /listening (\d+)/.exec(out); if (match) resolve(Number(match[1])); });
  });
  const origin = `http://127.0.0.1:${port}`;
  const versions = new Map(packages.map((pkg) => [pkg.name, pkg.version]));
  const lock = (app) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
    for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
      if (!name.startsWith('@starci/')) continue;
      if (versions.get(name) !== version) return { ok: false, detail: `${name}@${version} is pinned, but the checkout holds ${versions.has(name) ? `${name}@${versions.get(name)}` : `no ${name}`}` };
    }
    const npmrc = path.join(app, '.npmrc');
    fs.writeFileSync(npmrc, `@starci:registry=${origin}/\n`);
    try { return npmLock(app); } finally { fs.rmSync(npmrc, { force: true }); }
  };
  const close = async () => {
    if (child.exitCode === null && child.signalCode === null) { const exited = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await exited; }
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  };
  return { packages, origin, lock, close };
}

if (isMain(import.meta.url)) serve(process.argv[2]);
