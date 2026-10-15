// proves: ARCH_OWNER_CYCLE@lite ARCH_OWNER_CYCLE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadSlotManifest, RUNTIME_MANIFEST_FILE } from '../../scripts/hfs/slots.mjs';
import { createSlotResolver } from '../../scripts/hfs/slots.mjs';
import { resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { parseSource } from '../../scripts/hfs/runtime-rules/source-ast.mjs';
import { tierFindings } from '../../scripts/hfs/runtime-rules/tier-direction.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });

function context(files) {
  const declaration = resolveRepoDeclaration(MANIFEST, { hfs: 1, kind: 'runtime', project: 'starci' });
  const resolver = createSlotResolver(MANIFEST, declaration);
  const sources = Object.entries(files).map(([file, text]) => ({ path: file, text }));
  const parsed = new Map(sources.map((source) => [source.path, parseSource(source.text, source.path)]));
  return { resolver, sources, parsed: (file) => parsed.get(file), fileSet: new Set(Object.keys(files)), read: (file) => files[file] ?? null };
}

// The runtime graph is shared by both app editions; its declaration has no edition key.
for (const edition of ['lite', 'full']) {
  test(`R27 runtime rejects an owner cycle in ${edition}`, () => {
    const findings = tierFindings(context({
      'scripts/agent/c.mjs': "import '../route/d.mjs';\n",
      'scripts/route/d.mjs': "import '../agent/c.mjs';\n",
    }));
    assert.deepEqual(findings.map((finding) => finding.code), ['ARCH_OWNER_CYCLE']);
    assert.equal(findings[0].cycle.length, 3);
  });

  test(`R27 runtime accepts a one-way owner edge in ${edition}`, () => {
    assert.deepEqual(tierFindings(context({
      'scripts/agent/c.mjs': "import '../route/d.mjs';\n",
      'scripts/route/d.mjs': 'export const d = 1;\n',
    })), []);
  });
}
