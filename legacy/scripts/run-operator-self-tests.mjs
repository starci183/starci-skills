// Every package's own self-test, run from its own folder: the operators, and the helpers of the
// support layer beside them. One runner, because "run each package's validator against its lawful
// branches and its mutations" is one job however many families of package the tree grows.
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAMILIES = ['operators', 'helpers'];
const failures = [];
const counts = [];

for (const family of FAMILIES) {
  const dir = path.join(root, family);
  if (!existsSync(dir)) continue;
  let passed = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const selfTest = path.join(dir, entry.name, 'self-test.mjs');
    if (!existsSync(selfTest)) {
      failures.push(`${family}/${entry.name}: no self-test.mjs`);
      continue;
    }
    try {
      const { stdout } = await run(process.execPath, [selfTest], { cwd: path.join(dir, entry.name) });
      process.stdout.write(stdout);
      passed += 1;
    } catch (error) {
      failures.push(`${family}/${entry.name}: ${(error.stderr || error.message).trim()}`);
    }
  }
  counts.push(`${passed} ${family.slice(0, -1)} self-test${passed === 1 ? '' : 's'}`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${counts.join(', ')} passed\n`);
}
