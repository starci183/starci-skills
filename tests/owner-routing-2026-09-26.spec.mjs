import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kindOrder } from '../scripts/agent/models.mjs';

// Owner routing, 2026-09-26: Opus brainstorms/decides; Sol draws, audits the UI and verifies e2e;
// Devin/Qwen implement and do the mechanical ops; the kernel's own model calls go to Sol first.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chain = (kind, difficulty = 'hard') => kindOrder({ kind, difficulty, modelsDir: path.join(root, 'modules/models') }).chain;
const first = (kind, difficulty) => chain(kind, difficulty)[0];

test('Opus leads the brainstorm and decision ops', () => {
  for (const k of ['request.analyze', 'scope.define', 'business.decide', 'architecture.decide', 'goal.revise', 'decision.prepare', 'implementation.plan', 'brand.decide'])
    assert.equal(first(k), 'claude-agent', k);
});
test('Sol leads draw, UI audit, e2e, security and assisted UAT, with the hands as fallback', () => {
  for (const k of ['interface.draw', 'interface.audit', 'e2e.verify', 'security.verify', 'uat.assisted.verify'])
    assert.equal(first(k), 'codex-agent', k);
  assert.ok(chain('interface.audit').includes('devin-agent'));
});
test('the mechanical ops that used to run on Claude now start on the hands', () => {
  for (const k of ['provision.ask', 'workspace.manage', 'task.execute', 'knowledge.repair', 'backend.implement', 'interface.implement'])
    assert.equal(first(k), 'devin-agent', k);
});
test("the kernel's own model calls start on Sol", () => {
  for (const k of ['model.decide', 'model.planOp', 'model.manageWorkflow', 'judge'])
    assert.equal(first(k), 'codex-agent', k);
});
