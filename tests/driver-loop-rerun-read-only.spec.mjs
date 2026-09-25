import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../engine/yaml.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loop = parseYaml(fs.readFileSync(path.join(root, 'modules/kernel/driver-loop.yaml'), 'utf8'));

test('the kernel re-runs checks read-only and never runs a script that writes into owned paths', () => {
  const find = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.settle?.rerunReadOnly) return node.settle.rerunReadOnly;
    for (const v of Object.values(node)) { const hit = find(v); if (hit) return hit; }
    return null;
  };
  const rule = find(loop);
  assert.ok(rule, 'settle.rerunReadOnly is declared');
  assert.match(rule, /read-only/);
  assert.match(rule, /never runs a script that writes\s+into the worker's owned paths/);
});
