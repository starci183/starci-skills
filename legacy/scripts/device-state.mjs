#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  writeFileSync,
  writeSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const defaultSource = resolve(scriptRoot, '..', '..');
const manifestName = 'device-state.manifest.json';

function fail(message) {
  throw new Error(message);
}

function slash(value) {
  return value.replaceAll('\\', '/');
}

function expandHome(value) {
  if (!value.startsWith('~/') && !value.startsWith('~\\')) return value;
  const home = process.env.USERPROFILE ?? process.env.HOME;
  if (!home) fail('Cannot expand ~ because neither USERPROFILE nor HOME is set');
  return join(home, value.slice(2));
}

function command(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.stdio ?? 'pipe'
  });
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    fail(`${name} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return (result.stdout ?? '').trim();
}

function git(source, args) {
  return command('git', ['-C', source, ...args]);
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function sha256File(path) {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('data', (chunk) => hash.update(chunk));
  await finished(stream);
  return hash.digest('hex');
}

function readConfig(sourceRoot) {
  const path = join(sourceRoot, '.workspaces', 'device-state.json');
  if (!existsSync(path)) fail(`Missing portable device-state contract: ${path}`);
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (config.schemaVersion !== 1 || typeof config.id !== 'string') fail('device-state contract must use schemaVersion 1 and a stable id');
  if (!config.docker || typeof config.docker.helperImage !== 'string' || !Array.isArray(config.docker.volumes) || config.docker.volumes.length === 0) {
    fail('device-state contract must declare docker.helperImage and at least one volume');
  }
  const names = new Set();
  for (const volume of config.docker.volumes) {
    if (!volume || typeof volume.name !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(volume.name)) fail('Every device-state volume requires a safe exact name');
    if (names.has(volume.name)) fail(`Duplicate device-state volume: ${volume.name}`);
    names.add(volume.name);
  }
  const remote = config.remote;
  if (!remote || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(remote.repository ?? '')) fail('remote.repository must be owner/repository');
  if (!Number.isInteger(remote.chunkBytes) || remote.chunkBytes < 1024 * 1024 || remote.chunkBytes > 128 * 1024 * 1024) fail('remote.chunkBytes must be between 1 MiB and 128 MiB');
  if (!Number.isInteger(remote.retention) || remote.retention < 1 || remote.retention > 20) fail('remote.retention must be between 1 and 20');
  return { config, path };
}

function configFingerprint(config) {
  return sha256Buffer(Buffer.from(JSON.stringify(config)));
}

function dockerAvailable() {
  const probe = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8', windowsHide: true });
  return probe.status === 0;
}

function volumeExists(name) {
  return spawnSync('docker', ['volume', 'inspect', name], { encoding: 'utf8', windowsHide: true }).status === 0;
}

function containersForVolume(name, runningOnly = true) {
  const args = ['ps'];
  if (!runningOnly) args.push('--all');
  args.push('--filter', `volume=${name}`, '--format', '{{.Names}}');
  return command('docker', args).split(/\r?\n/).filter(Boolean);
}

function volumeIsEmpty(name, helperImage) {
  if (!volumeExists(name)) return true;
  const result = spawnSync('docker', [
    'run', '--rm', '--volume', `${name}:/target:ro`, helperImage, 'sh', '-c',
    'test -z "$(find /target -mindepth 1 -maxdepth 1 -print -quit)"'
  ], { encoding: 'utf8', windowsHide: true });
  return result.status === 0;
}

function publicRecipient(identityPath) {
  if (!existsSync(identityPath)) fail(`Master identity is missing: ${identityPath}`);
  const recipient = command('age-keygen', ['-y', identityPath]);
  if (!recipient.startsWith('age1')) fail('age-keygen did not return a valid public recipient');
  return recipient;
}

function waitFor(processHandle, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    let stderr = '';
    processHandle.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    processHandle.once('error', rejectPromise);
    processHandle.once('close', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${label} failed${stderr.trim() ? `: ${stderr.trim()}` : ''}`));
    });
  });
}

export async function archiveVolume({ volume, helperImage, recipient, output }) {
  mkdirSync(dirname(output), { recursive: true });
  const docker = spawn('docker', [
    'run', '--rm', '--volume', `${volume}:/source:ro`, helperImage,
    'sh', '-c', 'tar -C /source -czf - .'
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const age = spawn('age', ['-r', recipient, '-o', output], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  docker.stdout.pipe(age.stdin);
  await Promise.all([waitFor(docker, `archive ${volume}`), waitFor(age, `encrypt ${volume}`)]);
}

export async function restoreVolume({ volume, helperImage, identityPath, archive, replace }) {
  if (!volumeExists(volume)) command('docker', ['volume', 'create', volume]);
  if (!replace && !volumeIsEmpty(volume, helperImage)) fail(`Refusing to overwrite non-empty volume ${volume}; pass --replace after explicit approval`);
  const cleanup = replace
    ? 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /target -xzf -'
    : 'tar -C /target -xzf -';
  const age = spawn('age', ['-d', '-i', identityPath, archive], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const docker = spawn('docker', [
    'run', '--rm', '--interactive', '--volume', `${volume}:/target`, helperImage,
    'sh', '-c', cleanup
  ], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  age.stdout.pipe(docker.stdin);
  await Promise.all([waitFor(age, `decrypt ${volume}`), waitFor(docker, `restore ${volume}`)]);
}

function stopContainers(names) {
  if (names.length > 0) command('docker', ['stop', ...names]);
}

function startContainers(names) {
  if (names.length > 0) command('docker', ['start', ...names]);
}

export function splitArchive(path, chunkBytes) {
  const parts = [];
  const input = openSync(path, 'r');
  try {
    const buffer = Buffer.allocUnsafe(chunkBytes);
    let index = 0;
    while (true) {
      const bytes = readSync(input, buffer, 0, chunkBytes, null);
      if (bytes === 0) break;
      const partPath = `${path}.part-${String(index).padStart(4, '0')}`;
      const output = openSync(partPath, 'w');
      try { writeSync(output, buffer, 0, bytes); } finally { closeSync(output); }
      parts.push(partPath);
      index += 1;
    }
  } finally {
    closeSync(input);
  }
  return parts;
}

export async function joinParts(parts, output) {
  const target = createWriteStream(output, { flags: 'w' });
  for (const part of parts) {
    const source = createReadStream(part);
    for await (const chunk of source) {
      if (!target.write(chunk)) await new Promise((resolvePromise) => target.once('drain', resolvePromise));
    }
  }
  target.end();
  await finished(target);
}

function token(config, sourceRoot) {
  const path = resolve(sourceRoot, config.remote.tokenFile);
  if (!existsSync(path)) fail(`Encrypted runtime token is not hydrated: ${path}; run npm run sync first`);
  const value = readFileSync(path, 'utf8').trim();
  if (!value) fail('Remote checkpoint token file is empty');
  return value;
}

async function githubJson(url, tokenValue, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenValue}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) fail(`GitHub ${options.method ?? 'GET'} ${url} failed: ${response.status} ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

async function uploadAsset(repository, releaseId, path, name, tokenValue) {
  const data = readFileSync(path);
  const url = `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenValue}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(data.length),
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: data
  });
  if (!response.ok) fail(`GitHub asset upload ${name} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function downloadAsset(asset, path, tokenValue) {
  const response = await fetch(asset.url, {
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${tokenValue}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!response.ok) fail(`GitHub asset download ${asset.name} failed: ${response.status} ${await response.text()}`);
  const target = createWriteStream(path);
  for await (const chunk of response.body) {
    if (!target.write(chunk)) await new Promise((resolvePromise) => target.once('drain', resolvePromise));
  }
  target.end();
  await finished(target);
}

async function releases(config, tokenValue) {
  const values = await githubJson(`https://api.github.com/repos/${config.remote.repository}/releases?per_page=100`, tokenValue);
  return values.filter((release) => !release.draft && release.tag_name.startsWith(`${config.remote.releasePrefix}-`));
}

async function latestRelease(config, tokenValue) {
  const values = await releases(config, tokenValue);
  values.sort((left, right) => new Date(right.published_at) - new Date(left.published_at));
  return values[0] ?? null;
}

function sourceIdentity(sourceRoot) {
  const status = git(sourceRoot, ['status', '--porcelain', '--untracked-files=normal']);
  if (status) fail('Source working tree is not clean; checkpoint only after mission-owned changes are committed');
  const head = git(sourceRoot, ['rev-parse', 'HEAD']);
  const branch = git(sourceRoot, ['branch', '--show-current']);
  const origin = git(sourceRoot, ['remote', 'get-url', 'origin']);
  const upstream = git(sourceRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const [behind, ahead] = git(sourceRoot, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`]).split(/\s+/).map(Number);
  if (behind !== 0 || ahead !== 0) fail(`Source must be pushed and remote-current before data publication (behind=${behind}, ahead=${ahead})`);
  return { origin, branch, head };
}

function generationId(head) {
  return `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${head.slice(0, 12)}`;
}

export async function buildCheckpoint({ sourceRoot = defaultSource } = {}) {
  if (!dockerAvailable()) fail('Docker daemon is unavailable');
  const source = resolve(sourceRoot);
  const { config } = readConfig(source);
  const identityPath = expandHome(config.encryption.masterIdentity);
  const recipient = publicRecipient(identityPath);
  const sourceState = sourceIdentity(source);
  const generation = generationId(sourceState.head);
  const outputRoot = join(source, '.workspace', 'device-state', 'outgoing', generation);
  mkdirSync(outputRoot, { recursive: true });
  const absent = config.docker.volumes.map((item) => item.name).filter((name) => !volumeExists(name));
  if (absent.length > 0) fail(`Declared volumes are absent: ${absent.join(', ')}`);
  const running = [...new Set(config.docker.volumes.flatMap((item) => containersForVolume(item.name, true)))];
  const artifacts = [];
  stopContainers(running);
  try {
    for (const item of config.docker.volumes) {
      const archive = join(outputRoot, `${item.name}.tar.gz.age`);
      await archiveVolume({ volume: item.name, helperImage: config.docker.helperImage, recipient, output: archive });
      const parts = splitArchive(archive, config.remote.chunkBytes);
      artifacts.push({
        volume: item.name,
        archive: slash(archive),
        ciphertextSha256: await sha256File(archive),
        ciphertextBytes: statSync(archive).size,
        chunks: await Promise.all(parts.map(async (path) => ({
          name: path.split(/[\\/]/).at(-1),
          path: slash(path),
          sha256: await sha256File(path),
          bytes: statSync(path).size
        })))
      });
    }
  } finally {
    startContainers(running);
  }
  const manifest = {
    schemaVersion: 1,
    contractId: config.id,
    contractSha256: configFingerprint(config),
    generation,
    createdAt: new Date().toISOString(),
    source: sourceState,
    encryption: { format: 'age', recipientSha256: sha256Buffer(Buffer.from(recipient)) },
    archive: { format: 'tar+gzip', quiescedContainers: running },
    artifacts: artifacts.map(({ archive: _archive, ...item }) => ({ ...item, chunks: item.chunks.map(({ path: _path, ...part }) => part) }))
  };
  const manifestPath = join(outputRoot, manifestName);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { config, manifest, manifestPath, outputRoot, artifacts };
}

export async function publishCheckpoint({ sourceRoot = defaultSource } = {}) {
  const source = resolve(sourceRoot);
  const built = await buildCheckpoint({ sourceRoot: source });
  const tokenValue = token(built.config, source);
  const tag = `${built.config.remote.releasePrefix}-${built.manifest.generation}`;
  const release = await githubJson(`https://api.github.com/repos/${built.config.remote.repository}/releases`, tokenValue, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      body: `Encrypted device-state checkpoint ${built.manifest.generation}\nManifest sha256: ${await sha256File(built.manifestPath)}`,
      draft: true,
      prerelease: false
    })
  });
  try {
    for (const artifact of built.artifacts) {
      for (const part of artifact.chunks) await uploadAsset(built.config.remote.repository, release.id, part.path, part.name, tokenValue);
    }
    await uploadAsset(built.config.remote.repository, release.id, built.manifestPath, manifestName, tokenValue);
    const published = await githubJson(`https://api.github.com/repos/${built.config.remote.repository}/releases/${release.id}`, tokenValue, {
      method: 'PATCH',
      body: JSON.stringify({ draft: false })
    });
    const prior = (await releases(built.config, tokenValue)).filter((item) => item.id !== published.id)
      .sort((left, right) => new Date(right.published_at) - new Date(left.published_at));
    for (const stale of prior.slice(Math.max(0, built.config.remote.retention - 1))) {
      await githubJson(`https://api.github.com/repos/${built.config.remote.repository}/releases/${stale.id}`, tokenValue, { method: 'DELETE' });
    }
    return { status: 'published', generation: built.manifest.generation, releaseUrl: published.html_url, volumeCount: built.manifest.artifacts.length };
  } catch (error) {
    throw new Error(`Checkpoint upload remains a private draft and was not published: ${error.message}`);
  }
}

export async function fetchCheckpoint({ sourceRoot = defaultSource } = {}) {
  const source = resolve(sourceRoot);
  const { config } = readConfig(source);
  const tokenValue = token(config, source);
  const release = await latestRelease(config, tokenValue);
  if (!release) return { status: 'absent', generation: null, directory: null };
  const manifestAsset = release.assets.find((asset) => asset.name === manifestName);
  if (!manifestAsset) fail(`Release ${release.tag_name} has no ${manifestName}`);
  const incomingRoot = join(source, '.workspace', 'device-state', 'incoming', release.tag_name);
  mkdirSync(incomingRoot, { recursive: true });
  const manifestPath = join(incomingRoot, manifestName);
  await downloadAsset(manifestAsset, manifestPath, tokenValue);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.contractId !== config.id || manifest.contractSha256 !== configFingerprint(config)) {
    fail('Remote checkpoint manifest is incompatible with the current portable contract');
  }
  for (const artifact of manifest.artifacts) {
    const partPaths = [];
    for (const chunk of artifact.chunks) {
      const asset = release.assets.find((item) => item.name === chunk.name);
      if (!asset) fail(`Release is missing chunk ${chunk.name}`);
      const path = join(incomingRoot, chunk.name);
      await downloadAsset(asset, path, tokenValue);
      if (await sha256File(path) !== chunk.sha256) fail(`Chunk checksum mismatch: ${chunk.name}`);
      partPaths.push(path);
    }
    const archive = join(incomingRoot, `${artifact.volume}.tar.gz.age`);
    await joinParts(partPaths, archive);
    if (await sha256File(archive) !== artifact.ciphertextSha256) fail(`Archive checksum mismatch: ${artifact.volume}`);
  }
  return { status: 'fetched', generation: manifest.generation, directory: incomingRoot, manifest };
}

export async function restoreCheckpoint({ sourceRoot = defaultSource, replace = false } = {}) {
  if (!dockerAvailable()) fail('Docker daemon is unavailable');
  const source = resolve(sourceRoot);
  const { config } = readConfig(source);
  const fetched = await fetchCheckpoint({ sourceRoot: source });
  if (fetched.status === 'absent') fail('No published device-state checkpoint exists');
  const identityPath = expandHome(config.encryption.masterIdentity);
  const volumeNames = fetched.manifest.artifacts.map((item) => item.volume);
  const running = [...new Set(volumeNames.flatMap((name) => containersForVolume(name, true)))];
  stopContainers(running);
  try {
    for (const artifact of fetched.manifest.artifacts) {
      await restoreVolume({
        volume: artifact.volume,
        helperImage: config.docker.helperImage,
        identityPath,
        archive: join(fetched.directory, `${artifact.volume}.tar.gz.age`),
        replace
      });
    }
  } finally {
    startContainers(running);
  }
  return { status: 'restored', generation: fetched.generation, volumeCount: volumeNames.length, replaced: replace };
}

export async function checkpointStatus({ sourceRoot = defaultSource } = {}) {
  const source = resolve(sourceRoot);
  const { config } = readConfig(source);
  const local = config.docker.volumes.map((item) => ({
    volume: item.name,
    exists: dockerAvailable() && volumeExists(item.name),
    empty: dockerAvailable() ? volumeIsEmpty(item.name, config.docker.helperImage) : null
  }));
  let remote = null;
  const tokenPath = resolve(source, config.remote.tokenFile);
  if (existsSync(tokenPath)) {
    const release = await latestRelease(config, token(config, source));
    remote = release ? { tag: release.tag_name, publishedAt: release.published_at, url: release.html_url } : null;
  }
  return { status: 'ready', contractId: config.id, local, remote };
}

function parse(argv) {
  const commandName = argv[0];
  const sourceIndex = argv.indexOf('--source');
  const sourceRoot = sourceIndex < 0 ? defaultSource : argv[sourceIndex + 1];
  if (!sourceRoot) fail('--source requires a value');
  return {
    commandName,
    sourceRoot,
    apply: argv.includes('--apply'),
    replace: argv.includes('--replace')
  };
}

async function run(argv = process.argv.slice(2)) {
  const options = parse(argv);
  if (!['plan', 'status', 'publish', 'fetch', 'restore'].includes(options.commandName)) {
    fail('Usage: device-state.mjs <plan|status|publish|fetch|restore> --source <Source> [--apply] [--replace]');
  }
  if (['publish', 'fetch', 'restore'].includes(options.commandName) && !options.apply) {
    fail(`${options.commandName} requires --apply because it mutates local or external state`);
  }
  if (options.replace && options.commandName !== 'restore') fail('--replace is valid only with restore');
  if (options.commandName === 'plan') {
    const { config, path } = readConfig(resolve(options.sourceRoot));
    return { status: 'planned', contractPath: slash(path), volumeCount: config.docker.volumes.length, volumes: config.docker.volumes.map((item) => item.name), remote: config.remote.repository };
  }
  if (options.commandName === 'status') return checkpointStatus(options);
  if (options.commandName === 'publish') return publishCheckpoint(options);
  if (options.commandName === 'fetch') return fetchCheckpoint(options);
  return restoreCheckpoint(options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await run(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
