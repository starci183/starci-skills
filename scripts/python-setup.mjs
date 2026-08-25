#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const windows = platform() === 'win32';
const venvPython = windows
  ? join(root, '.venv', 'Scripts', 'python.exe')
  : join(root, '.venv', 'bin', 'python');
const requirements = join(root, 'runtime', 'knowledge-runtime', 'requirements.txt');
const venvRoot = join(root, '.venv');

function available(command) {
  return spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true }).status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(venvPython)) {
  const base = windows
    ? (available('py') ? 'py' : 'python')
    : (available('python3') ? 'python3' : 'python');
  const prefix = windows && base === 'py' ? ['-3'] : [];
  const created = spawnSync(base, [...prefix, '-m', 'venv', venvRoot], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true
  });
  if (created.status !== 0) {
    if (!available('uv')) process.exit(created.status ?? 1);
    rmSync(venvRoot, { recursive: true, force: true });
    run('uv', ['venv', '--python', base, venvRoot]);
  }
}

if (available('uv')) {
  run('uv', ['pip', 'install', '--python', venvPython, '--requirement', requirements]);
} else {
  run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--requirement', requirements]);
}
