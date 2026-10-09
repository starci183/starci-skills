// Content is a file; what travels is the reference. A prompt above the inline bound is never pasted into an agent's terminal, whatever the adapter: the follow-up prompt
// (deliverPrompt) and the Task spec of a launch (taskSpecOf) both hand the agent one line that names a file. Seen live: Codex 0.160 folded a 16.8 KB paste into a
// "[Pasted Content N chars]" chip and the Enter did not submit it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deliverPrompt, loadAdapter } from '../../scripts/agent/lib.mjs';
import { DISPATCH_PROMPT_TTL_MS, TASK_SPEC_MAX_CHARS, defaultSpecFile, taskSpecOf } from '../../scripts/machine/task-spec.mjs';
import { cleanupDeliveryArtifact } from '../../scripts/agent/delivery-artifact.mjs';

const temp = (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-prompt-file-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const sink = () => { const log = []; return { log, io: { send: (call) => { log.push(call); return { ok: true, submitted: true }; }, read: () => ({ ok: true, screen: '' }), sleep: () => {} } }; };

for (const agent of ['codex', 'claude', 'cursor', 'devin']) {
  test(`${agent}: a follow-up prompt above the inline bound is delivered as a file with a one-line instruction, a short one inline`, (t) => {
    const worktree = temp(t);
    const adapter = loadAdapter(agent).card;
    assert.equal(adapter.delivery?.mode, 'file-reference-above-inline-limit', `${agent}'s card declares file delivery`);
    const big = `Wake: ${'menu line\n'.repeat(400)}`;
    const long = sink();
    const sent = deliverPrompt({ handle: 'term_x', adapter, prompt: big, worktree, dispatchId: 'ctx_1', io: long.io });
    assert.equal(long.log.length, 1);
    assert.ok(long.log[0].text.length < 300 && !long.log[0].text.includes('menu line'), 'what is typed is the reference');
    assert.equal(fs.readFileSync(sent.artifact.file, 'utf8'), big, 'and the file holds the prompt');
    cleanupDeliveryArtifact(sent.artifact);
    assert.equal(fs.existsSync(sent.artifact.file), false, 'the artifact is removed by its owner once submission is attested');
    const short = sink();
    deliverPrompt({ handle: 'term_x', adapter, prompt: 'Run starci kernel status.', worktree, io: short.io });
    assert.equal(short.log[0].text, 'Run starci kernel status.');
  });
}

test('the Task spec of a launch is a pointer above a small bound, and the bound is below what a TUI folds into a chip', () => {
  assert.ok(TASK_SPEC_MAX_CHARS <= 2000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-task-spec-'));
  try {
    const file = path.join(dir, 'p.md');
    const prompt = 'x'.repeat(TASK_SPEC_MAX_CHARS + 1);
    const out = taskSpecOf({ prompt, file, heading: '[Kernel] w' });
    assert.equal(out.spilled, true);
    assert.ok(out.spec.length < TASK_SPEC_MAX_CHARS, 'the pointer fits the bound');
    assert.equal(fs.readFileSync(file, 'utf8'), prompt);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a launch with no file of its own spills to the state root\'s dispatch-prompts, and the writer sweeps what is older than a day', (t) => {
  const dir = temp(t);
  const old = path.join(dir, 'old.md'), fresh = path.join(dir, 'fresh.md');
  fs.writeFileSync(old, 'o'); fs.writeFileSync(fresh, 'f');
  const now = Date.now();
  fs.utimesSync(old, new Date(now - DISPATCH_PROMPT_TTL_MS - 60_000), new Date(now - DISPATCH_PROMPT_TTL_MS - 60_000));
  const file = defaultSpecFile('supervisor:abc', { dir, now });
  assert.equal(path.dirname(file), dir);
  assert.equal(path.extname(file), '.md');
  assert.equal(file, defaultSpecFile('supervisor:abc', { dir, now }), 'the same launch identity names the same file');
  assert.equal(fs.existsSync(old), false);
  assert.equal(fs.existsSync(fresh), true);
});
