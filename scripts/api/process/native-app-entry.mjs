import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {sha256, sha256File} from '../../../engine/digest.mjs';
import {insidePath} from '../../lib/path-key.mjs';

function ownedPath(root, file) {
  if (!insidePath(root, file)) throw new Error('NATIVE_APP_PATH_OUTSIDE_INSTALLATION');
  let selected = root;
  for (const part of path.relative(root, file).split(path.sep)) {
    selected = path.join(selected, part);
    if (fs.lstatSync(selected).isSymbolicLink()) throw new Error('NATIVE_APP_LINK_REFUSED');
  }
  return selected;
}

/** Resolve the logical package location too: Node's resolved realpath must not conceal a package link. */
function manifestFor(require, name, installation) {
  const resolved = require.resolve(`${name}/package.json`);
  const logical = require.resolve.paths(name).map(dir => path.join(dir, name, 'package.json')).find(file => fs.existsSync(file));
  if (!logical || fs.realpathSync(ownedPath(installation, logical)) !== fs.realpathSync(resolved)) throw new Error('NATIVE_APP_PACKAGE_RESOLUTION_REFUSED');
  return logical;
}

/** Full installed package bytes are public input; links and oversized trees cannot form one frozen consumer. */
function packageIdentity(file, name, installation, maxBytes = 128 * 1024 * 1024) {
  const root = path.dirname(ownedPath(installation, file));
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (manifest.name !== name || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(manifest.version)) throw new Error('NATIVE_APP_PACKAGE_INVALID');
  const digest = createHash('sha256');
  let count = 0, bytes = 0;
  const visit = dir => {
    for (const member of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      if (member.name === 'node_modules' || member.name === '.git') continue;
      const selected = path.join(dir, member.name), stat = fs.lstatSync(selected);
      if (stat.isSymbolicLink()) throw new Error('NATIVE_APP_LINK_REFUSED');
      if (stat.isDirectory()) {visit(selected); continue;}
      if (!stat.isFile() || ++count > 50000 || (bytes += stat.size) > maxBytes) throw new Error('NATIVE_APP_PACKAGE_BOUND');
      digest.update(path.relative(root, selected).replaceAll('\\', '/')).update('\0').update(fs.readFileSync(selected)).update('\0');
    }
  };
  visit(root);
  return {root, manifest, public: {name, version: manifest.version, sha256: digest.digest('hex')}};
}

/** Follow the published Supabase shim's ordered optional-package selection, without its binary override. */
function supabasePlatform(require, installation) {
  const platforms = {darwin: {arm64: ['darwin-arm64'], x64: ['darwin-x64']},
    linux: {arm64: ['linux-arm64', 'linux-arm64-musl'], x64: ['linux-x64', 'linux-x64-musl']},
    win32: {arm64: ['windows-arm64'], x64: ['windows-x64']}};
  const candidates = platforms[process.platform]?.[os.arch()];
  if (!candidates) throw new Error('NATIVE_APP_PACKAGE_INVALID');
  for (const suffix of candidates) {
    const name = `@supabase/cli-${suffix}`;
    try { require.resolve(`${name}/package.json`); }
    catch (error) { if (error.code === 'MODULE_NOT_FOUND') continue; throw error; }
    // Once Node selects a package, a confinement or identity failure cannot select another candidate.
    return packageIdentity(manifestFor(require, name, installation), name, installation, 256 * 1024 * 1024);
  }
  throw new Error('NATIVE_APP_ENTRY_UNAVAILABLE');
}

function supabaseIdentity(appRequire, installation, root, version) {
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('NATIVE_APP_PACKAGE_INVALID');
  const wrapper = packageIdentity(manifestFor(appRequire, 'supabase', installation), 'supabase', installation);
  const platform = supabasePlatform(createRequire(path.join(wrapper.root, 'package.json')), installation);
  if (wrapper.public.version !== version || platform.public.version !== version
      || wrapper.manifest.bin?.supabase !== 'dist/supabase.js'
      || wrapper.manifest.optionalDependencies?.[platform.public.name] !== version
      || !platform.manifest.os?.includes(process.platform) || !platform.manifest.cpu?.includes(os.arch()))
    throw new Error('NATIVE_APP_PACKAGE_PAIR_INVALID');
  const entry = ownedPath(wrapper.root, path.join(wrapper.root, 'dist/supabase.js'));
  if (!fs.statSync(entry).isFile()) throw new Error('NATIVE_APP_ENTRY_UNAVAILABLE');
  const ext = process.platform === 'win32' ? '.exe' : '';
  const binaries = ['supabase', 'supabase-go'].map(name => {
    const file = ownedPath(platform.root, path.join(platform.root, 'bin', `${name}${ext}`));
    if (!fs.statSync(file).isFile()) throw new Error('NATIVE_APP_ENTRY_UNAVAILABLE');
    return {path: path.relative(root, file).replaceAll('\\', '/'), sha256: sha256File(file)};
  });
  return {wrapper: wrapper.public, platformPackage: platform.public, platform: process.platform, architecture: os.arch(),
    entry: path.relative(root, entry).replaceAll('\\', '/'), entrySha256: sha256File(entry), binaries};
}

/** Source callers name fixed capability files, never target or argv paths into the installed package. */
function requireOwners(hfsRoot, requiredHfsFiles) {
  if (!requiredHfsFiles || typeof requiredHfsFiles !== 'object' || Array.isArray(requiredHfsFiles)
      || Object.keys(requiredHfsFiles).length > 16) throw new Error('NATIVE_APP_REQUIRED_OWNER_INVALID');
  for (const [relative, expected] of Object.entries(requiredHfsFiles)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*\.mjs$/.test(relative) || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('NATIVE_APP_REQUIRED_OWNER_INVALID');
    const file = ownedPath(hfsRoot, path.resolve(hfsRoot, relative));
    if (sha256File(file) !== expected) throw new Error('NATIVE_APP_OWNER_VERSION_REQUIRED');
  }
}

/**
 * Inspect the app's installed native CLI/HFS pair without running it or opening credential custody.
 * The absolute entry stays internal; the public identity freezes complete package trees, entry and
 * Node bytes. Callers compare that identity again immediately before their fixed asynchronous child.
 */
export function nativeAppEntry({repoRoot, requiredHfsFiles = {}, supabaseVersion}) {
  const root = fs.realpathSync(repoRoot), logicalInstallation = path.join(root, 'node_modules');
  if (fs.lstatSync(logicalInstallation).isSymbolicLink()) throw new Error('NATIVE_APP_LINK_REFUSED');
  const installation = fs.realpathSync(logicalInstallation);
  if (!insidePath(root, installation)) throw new Error('NATIVE_APP_PATH_OUTSIDE_INSTALLATION');
  const appRequire = createRequire(path.join(root, 'package.json'));
  const cliFile = manifestFor(appRequire, '@starci/cli', installation);
  const cli = packageIdentity(cliFile, '@starci/cli', installation);
  const hfs = packageIdentity(manifestFor(createRequire(cliFile), '@starci/hfs', installation), '@starci/hfs', installation);
  requireOwners(hfs.root, requiredHfsFiles);
  if (cli.manifest.dependencies?.['@starci/hfs'] !== hfs.public.version || cli.manifest.bin?.starci !== './bin/starci.mjs'
      || cli.manifest.exports?.['.'] !== './src/main.mjs' || hfs.manifest.exports?.['.'] !== './src/main.mjs')
    throw new Error('NATIVE_APP_PACKAGE_PAIR_INVALID');
  const entry = ownedPath(cli.root, path.join(cli.root, 'bin/starci.mjs'));
  if (!fs.statSync(entry).isFile()) throw new Error('NATIVE_APP_ENTRY_UNAVAILABLE');
  return {entry, public: {cli: cli.public, hfs: hfs.public, entry: path.relative(root, entry).replaceAll('\\', '/'),
    entrySha256: sha256(fs.readFileSync(entry)), nodeVersion: process.version, nodeSha256: sha256File(process.execPath),
    ...(supabaseVersion === undefined ? {} : {supabase: supabaseIdentity(appRequire, installation, root, supabaseVersion)})}};
}
