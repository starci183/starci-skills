import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authorityRefs = [
  '../knowledge/ui.md',
  '../knowledge/ui-render-review.md',
  './fe/ui-detail-freeze/execute.md',
  './fe/implementation/execute.md',
  './fe/visual-fidelity/execute.md',
];

test('frontend delivery preserves destination, progress, and fact hierarchy semantics', () => {
  for (const ref of authorityRefs) {
    const authority = readFileSync(new URL(ref, import.meta.url), 'utf8');
    assert.match(authority, /native link semantics/i, ref);
    assert.match(authority, /(?:real non-null|non-null real) [`]?href/i, ref);
    assert.match(authority, /contract-declared progress/i, ref);
    assert.match(authority, /compact numeric fact/i, ref);
    assert.match(authority, /section(?: and content)? title/i, ref);
  }
});
