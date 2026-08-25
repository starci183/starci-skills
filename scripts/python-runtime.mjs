#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const python = platform() === 'win32'
  ? join(root, '.venv', 'Scripts', 'python.exe')
  : join(root, '.venv', 'bin', 'python');

if (!existsSync(python)) {
  console.error('Python runtime is absent; run `npm run setup:python` first.');
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), { cwd: root, stdio: 'inherit', windowsHide: true });
process.exit(result.status ?? 1);
