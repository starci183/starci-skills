// hk-sessions.spec.mjs — the agent-session archive rules of STORAGE-PROMPT.md
// (items 1, 8, 9) run on fake USERPROFILE/APPDATA trees under os.tmpdir(). Every
// fixture dir is removed in t.after (temp hygiene); the junction cases create
// links inside the fixture's own tree only — the never-through-a-link rule is
// exactly what they prove.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sweepAgentSessions, archiveSessionFiles, sessionSweepRoots } from '../scripts/lib/hk-sessions.mjs';
import { safeRemoveTree } from '../scripts/lib/safe-remove.mjs';

const DAY = 24 * 60 * 60 * 1000;

// One fake host per test: %USERPROFILE% and %APPDATA% point at fresh dirs under
// os.tmpdir(), so a sweep can only ever see the fixture's own trees.
const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-sessions-'));
  t.after(() => { safeRemoveTree(root); });
  const profile = path.join(root, 'profile');
  const appData = path.join(root, 'appdata');
  const archiveRoot = path.join(root, 'archive');
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(appData, { recursive: true });
  return { root, profile, appData, archiveRoot, env: { USERPROFILE: profile, APPDATA: appData } };
};

const file = (p, { ageMs = 0, content = 'session-bytes' } = {}) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  if (ageMs) { const when = new Date(Date.now() - ageMs); fs.utimesSync(p, when, when); }
  return p;
};
const exists = (p) => fs.existsSync(p);
const allocation = (archiveRoot) => ({ housekeeping: { sessionArchiveAfterMs: 3 * DAY, archiveMaxAgeMs: 30 * DAY, archiveRoot } });

test('age boundary: files at or past sessionArchiveAfterMs archive, newer ones stay', async (t) => {
  const fx = fixture(t);
  const sessions = path.join(fx.profile, '.codex', 'sessions');
  const old = file(path.join(sessions, 'old.jsonl'), { ageMs: 4 * DAY });
  const edge = file(path.join(sessions, 'edge.jsonl'), { ageMs: 3 * DAY + 10 });
  const fresh = file(path.join(sessions, 'fresh.jsonl'), { ageMs: 60 * 1000 });
  const now = Date.now();

  const dry = await sweepAgentSessions({ apply: false, now, env: fx.env, allocation: allocation(fx.archiveRoot) });
  assert.deepEqual(dry.moved.map((m) => m.from).sort(), [edge, old].sort());
  assert.ok(dry.skipped.some((s) => s.path === fresh && s.reason === 'too-new'));
  assert.ok(exists(old) && exists(edge) && exists(fresh), 'a dry run writes nothing');
  assert.ok(!exists(fx.archiveRoot), 'a dry run creates no archive dirs');

  const run = await sweepAgentSessions({ apply: true, now, env: fx.env, allocation: allocation(fx.archiveRoot) });
  assert.ok(run.ok);
  assert.equal(run.moved.length, 2);
  assert.ok(!exists(old) && !exists(edge), 'stale files leave the session root');
  assert.ok(exists(fresh), 'a fresh file is untouched');
  assert.equal(run.movedBytes, fs.readFileSync(path.join(fx.archiveRoot, 'codex', 'sessions', 'old.jsonl'), 'utf8').length
    + fs.readFileSync(path.join(fx.archiveRoot, 'codex', 'sessions', 'edge.jsonl'), 'utf8').length);
});

test('the archived path keeps the path relative to the agent home', async (t) => {
  const fx = fixture(t);
  const nested = file(path.join(fx.profile, '.codex', 'sessions', '2026', '09', 'rollout-a.jsonl'), { ageMs: 5 * DAY });
  const archived = file(path.join(fx.profile, '.codex', 'archived_sessions', 'rollout-b.jsonl'), { ageMs: 5 * DAY });
  const run = await sweepAgentSessions({ apply: true, env: fx.env, allocation: allocation(fx.archiveRoot) });
  const destOf = (from) => run.moved.find((m) => m.from === from)?.to;
  assert.equal(destOf(nested), path.join(fx.archiveRoot, 'codex', 'sessions', '2026', '09', 'rollout-a.jsonl'));
  assert.equal(destOf(archived), path.join(fx.archiveRoot, 'codex', 'archived_sessions', 'rollout-b.jsonl'));
  assert.ok(exists(destOf(nested)) && exists(destOf(archived)));
});

test("orca's codex-runtime-home sessions and generated_images are swept too", async (t) => {
  const fx = fixture(t);
  const orcaHome = path.join(fx.appData, 'orca', 'codex-runtime-home', 'home');
  const roll = file(path.join(orcaHome, 'sessions', 'rollout-orca.jsonl'), { ageMs: 5 * DAY });
  const img = file(path.join(orcaHome, 'generated_images', 'img.png'), { ageMs: 5 * DAY });
  const run = await sweepAgentSessions({ apply: true, env: fx.env, allocation: allocation(fx.archiveRoot) });
  const dests = run.moved.map((m) => m.to);
  assert.ok(dests.includes(path.join(fx.archiveRoot, 'orca-codex', 'sessions', 'rollout-orca.jsonl')));
  assert.ok(dests.includes(path.join(fx.archiveRoot, 'orca-codex', 'generated_images', 'img.png')));
  assert.ok(!exists(roll) && !exists(img));
});

test('qwen: only files under the known session/log subdirs are candidates', async (t) => {
  const fx = fixture(t);
  const qwen = path.join(fx.profile, '.qwen');
  const ses = file(path.join(qwen, 'sessions', '1.json'), { ageMs: 5 * DAY });
  const chat = file(path.join(qwen, 'projects', 'c-slug', 'chats', 'chat.json'), { ageMs: 5 * DAY });
  const log = file(path.join(qwen, 'tmp', 'abc123', 'logs.json'), { ageMs: 5 * DAY });
  const dbg = file(path.join(qwen, 'debug', 'run.txt'), { ageMs: 5 * DAY });
  // Real qwen state that is NOT session/log data must be left alone.
  const memory = file(path.join(qwen, 'projects', 'c-slug', 'memory', 'm.json'), { ageMs: 5 * DAY });
  const meta = file(path.join(qwen, 'projects', 'c-slug', 'meta.json'), { ageMs: 5 * DAY });
  const shells = file(path.join(qwen, 'tmp', 'abc123', 'background-shells', 'pid'), { ageMs: 5 * DAY });
  const settings = file(path.join(qwen, 'settings.json'), { ageMs: 5 * DAY });
  const run = await sweepAgentSessions({ apply: true, env: fx.env, allocation: allocation(fx.archiveRoot) });
  const dests = run.moved.map((m) => m.to);
  for (const dest of [
    path.join(fx.archiveRoot, 'qwen', 'sessions', '1.json'),
    path.join(fx.archiveRoot, 'qwen', 'projects', 'c-slug', 'chats', 'chat.json'),
    path.join(fx.archiveRoot, 'qwen', 'tmp', 'abc123', 'logs.json'),
    path.join(fx.archiveRoot, 'qwen', 'debug', 'run.txt'),
  ]) assert.ok(dests.includes(dest), `expected ${dest}`);
  for (const kept of [memory, meta, shells, settings]) assert.ok(exists(kept), `kept ${kept}`);
  for (const gone of [ses, chat, log, dbg]) assert.ok(!exists(gone), `moved ${gone}`);
});

test('links are never moved or descended: a junction candidate is skipped, a junction root refuses', async (t) => {
  const fx = fixture(t);
  const elsewhere = path.join(fx.root, 'elsewhere');
  const throughLink = file(path.join(elsewhere, 'nested', 'linked-session.jsonl'), { ageMs: 5 * DAY });
  const sessions = path.join(fx.profile, '.codex', 'sessions');
  fs.mkdirSync(sessions, { recursive: true });
  fs.symlinkSync(path.join(elsewhere, 'nested'), path.join(sessions, 'linked'), 'junction');
  const plain = file(path.join(sessions, 'plain.jsonl'), { ageMs: 5 * DAY });
  // The archived_sessions ROOT itself is a junction into a live dir.
  const liveDir = path.join(fx.root, 'live-dir');
  const liveFile = file(path.join(liveDir, 'live.jsonl'), { ageMs: 5 * DAY });
  fs.symlinkSync(liveDir, path.join(fx.profile, '.codex', 'archived_sessions'), 'junction');

  const run = await sweepAgentSessions({ apply: true, env: fx.env, allocation: allocation(fx.archiveRoot) });
  assert.ok(exists(throughLink), 'nothing is moved through a link');
  assert.ok(exists(liveFile), 'a link-like root is refused whole');
  assert.ok(!exists(plain), 'plain files beside the link still archive');
  const reasons = new Map(run.skipped.map((s) => [s.path, s.reason]));
  assert.equal(reasons.get(path.join(sessions, 'linked')), 'link');
  assert.equal(reasons.get(path.join(fx.profile, '.codex', 'archived_sessions')), 'link-like root');
});

test('archive expiry: files past archiveMaxAgeMs under archiveRoot are deleted, newer kept', async (t) => {
  const fx = fixture(t);
  const ancient = file(path.join(fx.archiveRoot, 'codex', 'sessions', 'ancient.jsonl'), { ageMs: 31 * DAY });
  const recent = file(path.join(fx.archiveRoot, 'codex', 'sessions', 'recent.jsonl'), { ageMs: 2 * DAY });
  const dry = await sweepAgentSessions({ apply: false, env: fx.env, allocation: allocation(fx.archiveRoot) });
  assert.deepEqual(dry.deleted, [ancient]);
  assert.ok(exists(ancient), 'a dry run deletes nothing');
  const run = await sweepAgentSessions({ apply: true, env: fx.env, allocation: allocation(fx.archiveRoot) });
  assert.deepEqual(run.deleted, [ancient]);
  assert.ok(!exists(ancient) && exists(recent));
  assert.ok(run.freedBytes >= 'session-bytes'.length);
});

test('the housekeeping block may also be injected directly as allocation', async (t) => {
  const fx = fixture(t);
  const old = file(path.join(fx.profile, '.codex', 'sessions', 'old.jsonl'), { ageMs: 10 * DAY });
  const run = await sweepAgentSessions({ apply: true, env: fx.env, allocation: { sessionArchiveAfterMs: 3 * DAY, archiveMaxAgeMs: 30 * DAY, archiveRoot: fx.archiveRoot } });
  assert.equal(run.moved.length, 1);
  assert.equal(run.moved[0].from, old);
  assert.ok(exists(path.join(fx.archiveRoot, 'codex', 'sessions', 'old.jsonl')));
});

test('missing roots are reported, never errors', async (t) => {
  const fx = fixture(t);
  const run = await sweepAgentSessions({ apply: false, env: fx.env, allocation: allocation(fx.archiveRoot) });
  assert.ok(run.ok);
  assert.ok(run.skipped.some((s) => s.path === path.join(fx.profile, '.codex', 'sessions') && s.reason === 'missing'));
  const dirs = sessionSweepRoots(fx.env).map((r) => r.dir);
  assert.ok(dirs.includes(path.join(fx.appData, 'orca', 'codex-runtime-home', 'home', 'sessions')));
  assert.ok(dirs.includes(path.join(fx.profile, '.qwen', 'sessions')));
});

test('archiveSessionFiles: the settle-time contract', async (t) => {
  const fx = fixture(t);
  const src1 = file(path.join(fx.profile, '.codex', 'sessions', '2026', '09', 'rollout-1.jsonl'), { ageMs: 0 });
  const src2 = file(path.join(fx.profile, '.codex', 'sessions', '2026', '10', 'rollout-1.jsonl'), { ageMs: 0 });
  const missing = path.join(fx.profile, '.codex', 'sessions', 'gone.jsonl');

  // apply=false: the same report, zero writes.
  const dry = await archiveSessionFiles([src1, missing], { archiveRoot: fx.archiveRoot, agent: 'codex', apply: false });
  assert.ok(!dry.ok, 'a missing input lands in errors');
  assert.equal(dry.errors.length, 1);
  assert.equal(dry.errors[0].path, missing);
  assert.equal(dry.moved.length, 1);
  assert.equal(dry.moved[0].to, path.join(fx.archiveRoot, 'codex', 'rollout-1.jsonl'));
  assert.ok(exists(src1) && !exists(fx.archiveRoot), 'side-effect-free on apply=false');

  // apply: basename destinations; a same-basename second file deepens to parent__base.
  const run = await archiveSessionFiles([src1, src2], { archiveRoot: fx.archiveRoot, agent: 'codex', apply: true });
  assert.ok(run.ok);
  assert.equal(run.moved.length, 2);
  const dests = run.moved.map((m) => m.to);
  assert.ok(dests.includes(path.join(fx.archiveRoot, 'codex', 'rollout-1.jsonl')));
  assert.ok(dests.includes(path.join(fx.archiveRoot, 'codex', '10__rollout-1.jsonl')));
  assert.ok(!exists(src1) && !exists(src2));
  assert.equal(run.movedBytes, 2 * 'session-bytes'.length);
  assert.equal(run.freedBytes, run.movedBytes);
  assert.deepEqual(run.deleted, []);

  // A link-like input is skipped, never followed.
  const targetDir = path.join(fx.root, 'link-target');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.symlinkSync(targetDir, path.join(fx.root, 'session-link'), 'junction');
  const linked = await archiveSessionFiles([path.join(fx.root, 'session-link')], { archiveRoot: fx.archiveRoot, agent: 'codex', apply: true });
  assert.deepEqual(linked.skipped, [{ path: path.join(fx.root, 'session-link'), reason: 'link' }]);
  assert.ok(exists(targetDir));
});
