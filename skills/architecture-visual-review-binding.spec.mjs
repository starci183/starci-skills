import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

test('every architecture approval wait requires a rendered visualize preview', () => {
  const skillDirectories = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith('starci-'));
  let architectureWaitCount = 0;

  for (const directory of skillDirectories) {
    const skillRoot = path.join(root, directory.name);
    const machine = JSON.parse(readFileSync(path.join(skillRoot, 'machine.json'), 'utf8'));
    const architectureWaits = Object.values(machine.states).filter((state) => state.kind === 'wait' && state.approval?.approve === 'OK ARCHITECTURE <decision>');
    if (architectureWaits.length === 0) continue;

    architectureWaitCount += architectureWaits.length;
    const skill = readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
    const execute = readFileSync(path.join(skillRoot, 'execute.md'), 'utf8');
    assert.match(skill, /operators\/architecture\/review-widget\.md/);
    assert.match(skill, /render it through `visualize` before requesting `OK ARCHITECTURE`/);
    assert.match(execute, /render it through `visualize` before requesting `OK ARCHITECTURE`/);

    for (const waitState of architectureWaits) {
      assert.match(waitState.approval.prompt, /rendered visualize comparison/);
      const approveEdge = waitState.on.find((edge) => edge.when?.stage === 'architecture.decision.handoff' && edge.when?.status === 'ready');
      assert.ok(approveEdge, `${directory.name}: missing architecture approval edge`);
      assert.deepEqual(approveEdge.when.allFacts, ['architecture-visual-preview-ready']);
    }
  }

  assert.ok(architectureWaitCount > 0, 'expected at least one architecture approval wait');
});
