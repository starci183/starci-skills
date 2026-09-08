import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { upstreamAuditScope, auditScopeCarryErrors } from './audit-scope.mjs';

const scope = { mode: 'primary-surfaces', surfaces: [{ id: 'primary', type: 'page', route: '/primary', matrixIds: ['primary-loaded'] }], deferredStates: ['empty'], coverageClaim: 'selected-surfaces' };
function fixture() {
  const session = mkdtempSync(path.join(tmpdir(), 'audit-scope-'));
  const branch = path.join(session, 'step-2/parallel-1');
  const source = path.join(session, 'step-1/parallel-1/response');
  mkdirSync(path.join(source, 'data'), { recursive: true });
  mkdirSync(path.join(branch, 'response/data'), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), '{}');
  writeFileSync(path.join(source, 'response.md'), '# audit\n\n## Audit scope\n');
  writeFileSync(path.join(source, 'data/verdicts.json'), JSON.stringify({ auditScope: scope }));
  writeFileSync(path.join(branch, 'response/data/audit-scope.json'), JSON.stringify(scope));
  writeFileSync(path.join(branch, 'response/response.md'), '# receipt\n\n## Audit scope\n\n| Field | Value |\n| --- | --- |\n| Mode | primary-surfaces |\n| Coverage claim | selected-surfaces |\n| Deferred states | empty |\n');
  return { session, branch, source, request: { inputs: { 'frontend-surface-audit': 'step-1/parallel-1/response/response.md' } }, response: { fields: { 'audit-scope': 'response/data/audit-scope.json' } } };
}
test('carries primary scope and deferred states without widening a receipt claim', () => {
  const f = fixture();
  try {
    assert.deepEqual(upstreamAuditScope(f.branch, f.request), scope);
    assert.deepEqual(auditScopeCarryErrors(f.branch, f.request, f.response), []);
    writeFileSync(path.join(f.branch, 'response/data/audit-scope.json'), JSON.stringify({ ...scope, coverageClaim: 'full-state-matrix', deferredStates: [] }));
    assert.match(auditScopeCarryErrors(f.branch, f.request, f.response).join('\n'), /must be carried unchanged/);
  } finally { rmSync(f.session, { recursive: true, force: true }); }
});
test('refuses missing typed carry, absent scope data and traversal; unrelated quality has no UI claim', () => {
  const f = fixture();
  try {
    assert.match(auditScopeCarryErrors(f.branch, f.request, { fields: {} }).join('\n'), /must carry/);
    writeFileSync(path.join(f.source, 'data/verdicts.json'), '{}');
    assert.match(auditScopeCarryErrors(f.branch, f.request, f.response).join('\n'), /missing its typed scope/);
    assert.throws(() => upstreamAuditScope(f.branch, { inputs: { 'frontend-surface-audit': '../../outside.md' } }), /session receipt/);
    assert.match(auditScopeCarryErrors(f.branch, { inputs: {} }, { fields: {} }).join('\n'), /Coverage claim must preserve not-recorded/);
    writeFileSync(path.join(f.branch, 'response/response.md'), '# receipt\n\n## Audit scope\n\n| Field | Value |\n| --- | --- |\n| Mode | not-recorded |\n| Coverage claim | not-recorded |\n| Deferred states | — |\n');
    assert.deepEqual(auditScopeCarryErrors(f.branch, { inputs: {} }, { fields: {} }), []);
  } finally { rmSync(f.session, { recursive: true, force: true }); }
});
test('rejects a scope-limited result described as full state coverage in markdown', () => {
  const f = fixture();
  try {
    writeFileSync(path.join(f.branch, 'response/response.md'), '# receipt\n\n## Audit scope\n\n| Field | Value |\n| --- | --- |\n| Mode | exhaustive |\n| Coverage claim | full-state-matrix |\n| Deferred states | — |\n');
    assert.match(auditScopeCarryErrors(f.branch, f.request, f.response).join('\n'), /Coverage claim must preserve selected-surfaces/);
  } finally { rmSync(f.session, { recursive: true, force: true }); }
});
