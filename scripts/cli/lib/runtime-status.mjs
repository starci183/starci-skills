#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isMain } from '../../lib/is-main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const normalizedHash = (file, read) => createHash('sha256').update(read(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

function runtimeStatus({ runtimeRoot = root, exists = existsSync, read = readFileSync } = {}) {
  const packageFile = path.join(runtimeRoot, 'package.json');
  const manifestFile = path.join(runtimeRoot, '.starci-skills.json');
  const version = exists(packageFile) ? JSON.parse(read(packageFile, 'utf8')).version ?? null : null;
  if (!exists(manifestFile)) {
    // A source checkout (the live runtime of a host) has no install manifest: there is nothing to drift from, so it is a healthy tree.
    return { ok: true, version, root: runtimeRoot, doctor: { manifest: 'missing', changed: [] } };
  }
  try {
    const manifest = JSON.parse(read(manifestFile, 'utf8'));
    const changed = Object.entries(manifest.files ?? {}).filter(([relative, expected]) => {
      const file = path.join(runtimeRoot, relative);
      return !exists(file) || normalizedHash(file, read) !== expected;
    }).map(([relative]) => relative);
    return { ok: changed.length === 0, version, root: runtimeRoot, doctor: { manifest: 'present', changed } };
  } catch (error) {
    return { ok: false, version, root: runtimeRoot, doctor: { manifest: 'invalid', changed: [], error: String(error?.message ?? error) } };
  }
}

export function main(argv = process.argv.slice(2), io = {}) {
  const json = argv.includes('--json');
  const result = runtimeStatus(io);
  const write = io.stdout ?? ((text) => process.stdout.write(text));
  const text = json
    ? `${JSON.stringify({ schema: 'starci/runtime-status@1', ...result })}\n`
    : `StarCi ${result.version ?? 'unknown'}\ntree: ${result.root}\ndoctor: ${result.doctor.manifest}${result.doctor.changed.length ? `; ${result.doctor.changed.length} changed or missing file(s)` : ''}\n`;
  if (typeof write === 'function') write(text); else write.write(text);
  return result.ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
