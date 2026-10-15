// proves: CLI_ONLY_ENTRY@lite
// proves: CLI_ONLY_ENTRY@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanCliOnlyEntry } from '../../scripts/checks/check-cli-only-entry.mjs';

function scan(text, edition) {
  return scanCliOnlyEntry('/fixture', {
    catalog: { groups: [{ group: 'runtime', verbs: [{
      verb: 'public', editions: [edition], impl: { script: 'scripts/tools/public.mjs', args: [] },
    }] }] },
    internal: [],
    files: ['docs/actions.md'],
    read: () => text,
    generated: [],
  });
}

for (const edition of ['lite', 'full']) {
  test(`${edition} valid action enters through its catalog command`, () => {
    assert.deepEqual(scan('starci runtime public\n', edition).findings, []);
  });

  test(`${edition} invalid action rejects a direct handler invocation`, () => {
    const report = scan('node scripts/tools/public.mjs\n', edition);
    assert.deepEqual(report.findings.map(({ code, use }) => [code, use]), [
      ['CLI_ONLY_ENTRY', 'starci runtime public'],
    ]);
    assert.equal(report.ok, false);
  });
}
