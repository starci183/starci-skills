import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const operators = path.join(root, 'operators');
const failures = [];
let passed = 0;

for (const entry of await readdir(operators, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const selfTest = path.join(operators, entry.name, 'self-test.mjs');
  if (!existsSync(selfTest)) {
    failures.push(`${entry.name}: no self-test.mjs`);
    continue;
  }
  try {
    const { stdout } = await run(process.execPath, [selfTest], { cwd: path.join(operators, entry.name) });
    process.stdout.write(stdout);
    passed += 1;
  } catch (error) {
    failures.push(`${entry.name}: ${(error.stderr || error.message).trim()}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${passed} operator self-tests passed\n`);
}
