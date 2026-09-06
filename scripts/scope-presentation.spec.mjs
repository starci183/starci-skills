import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderScope, previewScope } from './scope-presentation.mjs';

test('scope preview exposes actual routes and code, escapes cell content and separates plans from proof', () => {
  const mission = { version: 2, goal: 'Owner | creates\ninstance', discovery: {
    repositories: [{ role: 'be', repository: '/repo/service' }],
    impacts: [{ role: 'be', routes: ['/a/b', '/a/b/[id]'], code: ['installation service'] }],
    lanes: { backend: { status: 'planned', owner: 'be', dependsOn: ['business'] } },
  } };
  const result = renderScope(mission);
  assert.match(result, /Owner &#124; creates instance/);
  assert.match(result, /\/a\/b\/\[id\]/);
  assert.match(result, /\/repo\/service.*installation service/);
  assert.match(result, /planned, not executed or verified/);
  assert.match(result, /Not established/);
  assert.ok(result.indexOf('Biz/Goal') < result.indexOf('Impact: routes'));
});

test('corrected scope emits only changed rows and forecast without modifying previous mission', () => {
  const previous = { version: 1, goal: 'First', target: 'unchanged' };
  const bytes = JSON.stringify(previous);
  const result = renderScope({ ...previous, version: 2, goal: 'Corrected' }, previous);
  assert.match(result, /Corrected/);
  assert.match(result, /Workflow forecast/);
  assert.doesNotMatch(result, /\| Target \|/);
  assert.equal(JSON.stringify(previous), bytes);
});

test('preview is read only and refuses absent mission instead of inventing scope', () => {
  const session = mkdtempSync(path.join(os.tmpdir(), 'scope-preview-'));
  try {
    const file = path.join(session, 'state.json');
    const bytes = JSON.stringify({ mission: { version: 1, goal: 'Read only' } });
    writeFileSync(file, bytes);
    assert.match(previewScope(session), /Read only/);
    assert.equal(readFileSync(file, 'utf8'), bytes);
    writeFileSync(file, '{}');
    assert.throws(() => previewScope(session), /MISSION_MISSING/);
  } finally { rmSync(session, { recursive: true, force: true }); }
});
