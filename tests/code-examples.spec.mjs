import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transformSync} from 'esbuild';
import {compileKnowledge} from '../scripts/compile-knowledge.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('bundled multi-file code examples have valid TypeScript/TSX syntax, without claiming resolved types', () => {
  const compiled = compileKnowledge({root: repository, write: false, check: false});
  assert.equal(compiled.ok, true);
  let count = 0;
  for (const [relative, bytes] of compiled.files) {
    if (!relative.startsWith('knowledge/code-examples/') || !relative.endsWith('/INDEX.json')) continue;
    if (relative === 'knowledge/code-examples/INDEX.json') continue;
    if (relative === 'knowledge/code-examples/backend/INDEX.json') continue;
    if (relative === 'knowledge/code-examples/frontend/INDEX.json') continue;
    const document = JSON.parse(bytes.toString('utf8'));
    const contents = document.contents;
    if (!contents || typeof contents !== 'object') continue;
    for (const [filePath, source] of Object.entries(contents)) {
      if (!/\.tsx?$/.test(filePath) || typeof source !== 'string') continue;
      const loader = filePath.endsWith('.tsx') ? 'tsx' : 'ts';
      const result = transformSync(source, {
        loader,
        format: 'esm',
        target: 'esnext',
        tsconfigRaw: {compilerOptions: {experimentalDecorators: true, emitDecoratorMetadata: true}},
      });
      assert.ok(result.code.length > 0, `empty transpile for ${relative} ${filePath}`);
      count++;
    }
  }
  assert.ok(count >= 4, `expected at least four example sources, got ${count}`);
});
