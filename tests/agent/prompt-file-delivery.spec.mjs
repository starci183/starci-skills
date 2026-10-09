// Content is a file; what travels is the reference. A prompt above the inline bound is never pasted into an agent's terminal, whatever the adapter: the follow-up prompt
// (deliverPrompt) and the Task spec of a launch (taskSpecOf) both hand the agent a pointer that names a file the one owner (prompt-file.mjs) wrote. Seen live: Codex 0.160 folded a 16.8 KB paste into a
// "[Pasted Content N chars]" chip and the Enter did not submit it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deliverPrompt, loadAdapter } from '../../scripts/agent/lib.mjs';
import { packetFileOf, promptFileMaxChars, promptFileOf, taskSpecOf } from '../../scripts/agent/prompt-file.mjs';
import { allocationSettings } from '../../engine/config.mjs';

const temp = (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-prompt-file-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const sink = () => { const log = []; return { log, io: { send: (call) => { log.push(call); return { ok: true, submitted: true }; }, read: () => ({ ok: true, screen: '' }), sleep: () => {} } }; };

for (const agent of ['codex', 'claude', 'cursor', 'devin']) {
  test(`${agent}: a follow-up prompt above the inline bound is delivered as a file with a one-line instruction, a short one inline`, (t) => {
    const state = temp(t);
    const before = process.env.STARCI_LOCAL_ROOT;
    process.env.STARCI_LOCAL_ROOT = state;
    t.after(() => { if (before === undefined) delete process.env.STARCI_LOCAL_ROOT; else process.env.STARCI_LOCAL_ROOT = before; });
    const adapter = loadAdapter(agent).card;
    assert.equal(adapter.delivery?.mode, 'file-reference-above-inline-limit', `${agent}'s card declares file delivery`);
    const big = `Wake: ${'menu line\n'.repeat(400)}`;
    const long = sink();
    const sent = deliverPrompt({ handle: 'term_x', adapter, prompt: big, dispatchId: 'ctx_1', io: long.io });
    assert.equal(long.log.length, 1);
    assert.ok(long.log[0].text.length < promptFileMaxChars() && !long.log[0].text.includes('menu line'), 'what is typed is the reference');
    assert.equal(fs.readFileSync(sent.artifact.file, 'utf8'), big, 'and the file holds the prompt');
    assert.equal(path.dirname(sent.artifact.file), path.join(state, 'dispatch-prompts'), 'the file lives in dispatch-prompts of the state root');
    const short = sink();
    deliverPrompt({ handle: 'term_x', adapter, prompt: 'Run starci kernel status.', io: short.io });
    assert.equal(short.log[0].text, 'Run starci kernel status.');
  });
}

test('the Task spec of a launch is a pointer above a small bound, and the bound is below what a TUI folds into a chip', () => {
  assert.equal(promptFileMaxChars(), allocationSettings().promptFile.maxChars, 'the bound is declared once, in allocation.promptFile');
  assert.ok(promptFileMaxChars() <= 2000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-task-spec-'));
  try {
    const file = path.join(dir, 'p.md');
    const prompt = 'x'.repeat(promptFileMaxChars() + 1);
    const out = taskSpecOf({ prompt, file, heading: '[Kernel] w' });
    assert.equal(out.spilled, true);
    assert.ok(out.spec.length < promptFileMaxChars(), 'the pointer fits the bound');
    assert.equal(fs.readFileSync(file, 'utf8'), prompt);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a launch with no file of its own spills to the state root\'s dispatch-prompts, and the writer sweeps what is older than a day', (t) => {
  const dir = temp(t);
  const old = path.join(dir, 'old.md'), fresh = path.join(dir, 'fresh.md');
  fs.writeFileSync(old, 'o'); fs.writeFileSync(fresh, 'f');
  const now = Date.now(), ttlMs = allocationSettings().promptFile.ttlMs;
  fs.utimesSync(old, new Date(now - ttlMs - 60_000), new Date(now - ttlMs - 60_000));
  const file = promptFileOf('supervisor:abc', { dir, now });
  assert.equal(path.dirname(file), dir);
  assert.equal(path.extname(file), '.md');
  assert.equal(file, promptFileOf('supervisor:abc', { dir, now }), 'the same launch identity names the same file');
  assert.equal(fs.existsSync(old), false);
  assert.equal(fs.existsSync(fresh), true);
});

test('operation packets use the shared state-root directory and have distinct job and attempt identities', (t) => {
  const state = temp(t);
  const before = process.env.STARCI_LOCAL_ROOT;
  process.env.STARCI_LOCAL_ROOT = state;
  t.after(() => { if (before === undefined) delete process.env.STARCI_LOCAL_ROOT; else process.env.STARCI_LOCAL_ROOT = before; });
  const job = path.join(state, 'jobs', 'job-1');
  const file = packetFileOf(job, 1);
  assert.equal(path.dirname(file), path.join(state, 'dispatch-prompts'));
  assert.equal(file, packetFileOf(job, 1));
  assert.notEqual(file, packetFileOf(job, 2));
  assert.notEqual(file, packetFileOf(path.join(state, 'jobs', 'job-2'), 1));
  const prompt = 'x'.repeat(promptFileMaxChars() + 1);
  assert.equal(taskSpecOf({ prompt, file, op: 'work.author', jobId: 'job-1' }).file, file);
  assert.equal(fs.readFileSync(file, 'utf8'), prompt);
  assert.equal(fs.existsSync(job), false, 'delivery creates no second prompt directory');
});
