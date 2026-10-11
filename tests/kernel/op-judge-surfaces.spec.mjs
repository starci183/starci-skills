// Who judges an op is shown where it is read: one tag on each leg of the full status text, and one line in the op prompt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { legsLine } from '../../scripts/kernel/verbs/shared/status-lines.mjs';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';
import { buildContext } from '../../scripts/context/pack.mjs';
import { judgeOf, judgeTagOf } from '../../scripts/kernel/op-judge.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const promptOf = (op, skillRoot = ROOT) => buildOpPrompt({
  skillRoot, contextPack: buildContext({ op, root: skillRoot }),
  packet: { op, brief: `modules/ops/ops/${op}.yaml`, context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } },
});
const leg = (op, color = 'green') => ({ op, label: op, color });

test('each leg of the full status text carries one tag of who judges it, read from its contract (passing)', () => {
  const text = legsLine({ graph: { legs: [leg('scope.define', 'yellow'), leg('backend.implement'), leg('handover.review'), leg('request.analyze')] }, internals: { skillRoot: ROOT } });
  assert.match(text, /scope\.define\(scope\.define\):yellow\[judge:machine\+critic\]/);
  assert.match(text, /backend\.implement\(backend\.implement\):green\[judge:machine\+next:review\.verify\]/);
  assert.match(text, /handover\.review\(handover\.review\):green\[judge:machine\+owner\]/);
  assert.match(text, /request\.analyze\(request\.analyze\):green\[judge:owner\]/);
});

test('the tag of an op whose contract declares nothing reads undeclared, never blank (violating)', () => {
  assert.equal(judgeTagOf('no.such-op', ROOT), 'undeclared');
  assert.deepEqual(judgeOf('no.such-op', ROOT), []);
});

test('the op prompt tells the op in one line who will judge its product, and the hand-listed Critic line names no op (passing)', () => {
  const lines = promptOf('scope.define').split('\n').filter((line) => line.startsWith('judged_by:'));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /machine \(/);
  assert.match(lines[0], /critic \(the runtime runs an independent Critic/);
  assert.match(lines[0], /run no Critic of your own/);
  const code = promptOf('backend.implement').split('\n').find((line) => line.startsWith('judged_by:'));
  assert.match(code, /next:review\.verify/);
  assert.match(code, /evidence and not an independent judgment of behaviour/, 'the op is told its own unit specs are evidence');
  assert.doesNotMatch(promptOf('scope.define'), /independent-critic \(scope\.define, architecture\.decide\)/);
});

test('every op prompt carries the judged_by line (passing)', () => {
  const ops = fs.readdirSync(path.join(ROOT, 'modules', 'ops', 'ops')).map((file) => file.replace(/\.yaml$/, ''));
  for (const op of ops) assert.equal(promptOf(op).split('\n').filter((line) => line.startsWith('judged_by:')).length, 1, op);
});
