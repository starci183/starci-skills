import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sweepClaudeTranscripts, claudeProjectSlug, claudeProjectsRoots } from '../scripts/lib/hk-claude.mjs';
import { safeRemoveTree } from '../scripts/lib/safe-remove.mjs';

// STORAGE-PROMPT.md item 10 on fake trees: ~/.claude/projects/<slug>/*.jsonl older than the archive
// window moves to <archiveRoot>/claude/<slug>/<file>, except the supervisor's live session (the newest
// transcript of the scratch-workspace project) and anything written in the last 24 hours; links are
// skipped, never moved through.
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const NOW = Date.parse('2026-09-26T12:00:00Z');
const LINK = process.platform === 'win32' ? 'junction' : 'dir';

function sandbox(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hk-claude-')));
  t.after(() => { safeRemoveTree(root); });
  const projects = path.join(root, 'projects');
  const archive = path.join(root, 'archive');
  fs.mkdirSync(projects, { recursive: true });
  const env = { STARCI_CLAUDE_PROJECTS_ROOT: projects };
  const allocation = { housekeeping: { claudeTranscriptArchiveAfterMs: WEEK, archiveRoot: archive } };
  return { root, projects, archive, env, allocation };
}

/** A transcript `name` in project `slug`, its mtime forged to `mtimeMs`. */
function transcript(projects, slug, name, mtimeMs, body = '{"x":1}\n') {
  const dir = path.join(projects, slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, body);
  const at = new Date(mtimeMs);
  fs.utimesSync(file, at, at);
  return file;
}

const skipped = (out, file) => out.skipped.find((s) => s.path === file)?.reason;

test('age boundary: strictly older than the window moves, at-or-inside stays', async (t) => {
  const { projects, archive, env, allocation } = sandbox(t);
  const older = transcript(projects, 'proj-a', 'old.jsonl', NOW - WEEK - 1);
  const edge = transcript(projects, 'proj-a', 'edge.jsonl', NOW - WEEK);
  const fresh = transcript(projects, 'proj-a', 'fresh.jsonl', NOW - WEEK + DAY);

  const out = await sweepClaudeTranscripts({ apply: true, now: NOW, env, allocation });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.deepEqual(out.moved.map((m) => m.from), [older]);
  assert.equal(skipped(out, edge), 'young', 'exactly at the boundary is not "older than"');
  assert.equal(skipped(out, fresh), 'young');
  assert.equal(fs.existsSync(older), false);
  assert.equal(fs.existsSync(path.join(archive, 'claude', 'proj-a', 'old.jsonl')), true);
  assert.equal(fs.existsSync(edge), true);
  assert.equal(out.movedBytes, fs.statSync(path.join(archive, 'claude', 'proj-a', 'old.jsonl')).size);
});

test('the 24-hour exemption is its own rule: a file written recently never moves, whatever the window', async (t) => {
  const { projects, env, allocation } = sandbox(t);
  allocation.housekeeping.claudeTranscriptArchiveAfterMs = 60 * 60 * 1000; // one hour
  const twoHours = transcript(projects, 'proj-b', 'recent.jsonl', NOW - 2 * 60 * 60 * 1000);
  const dayOld = transcript(projects, 'proj-b', 'dayold.jsonl', NOW - 25 * 60 * 60 * 1000);

  const out = await sweepClaudeTranscripts({ apply: true, now: NOW, env, allocation });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(skipped(out, twoHours), 'recent', 'older than the archive window but inside 24h stays');
  assert.equal(fs.existsSync(twoHours), true);
  assert.deepEqual(out.moved.map((m) => m.from), [dayOld]);
  assert.equal(fs.existsSync(dayOld), false);
});

test('the newest transcript of the scratch-workspace project is the supervisor session and stays', async (t) => {
  const { projects, env, allocation } = sandbox(t);
  const scratchSlug = 'C--Users-Hi-AppData-Roaming-Claude-scratch-workspaces-aaaa-scratch-2026-09-26-bbbb';
  const old = transcript(projects, scratchSlug, 'old-session.jsonl', NOW - 30 * DAY);
  const live = transcript(projects, scratchSlug, 'live-session.jsonl', NOW - 10 * DAY);
  const other = transcript(projects, 'plain-project', 'other.jsonl', NOW - 30 * DAY);

  const out = await sweepClaudeTranscripts({ apply: true, now: NOW, env, allocation });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(skipped(out, live), 'supervisor-session', 'the newest scratch-workspace transcript is exempt');
  assert.equal(fs.existsSync(live), true);
  assert.deepEqual(new Set(out.moved.map((m) => m.from)), new Set([old, other]),
    'older sessions of the same project and every other project still archive');
});

test('STARCI_CLAUDE_SUPERVISOR_PROJECT pins the exempt project by slug', async (t) => {
  const { projects, env, allocation } = sandbox(t);
  const pinned = transcript(projects, 'kernel-project', 'seat.jsonl', NOW - 30 * DAY);
  const loose = transcript(projects, 'kernel-project', 'loose.jsonl', NOW - 40 * DAY);
  env.STARCI_CLAUDE_SUPERVISOR_PROJECT = 'kernel-project';

  const out = await sweepClaudeTranscripts({ apply: true, now: NOW, env, allocation });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(skipped(out, pinned), 'supervisor-session');
  assert.deepEqual(out.moved.map((m) => m.from), [loose]);
});

test('links are skipped with reason link and never moved through', async (t) => {
  const { projects, archive, env, allocation, root } = sandbox(t);
  const sentinel = path.join(root, 'sentinel');
  fs.mkdirSync(sentinel, { recursive: true });
  const inside = transcript(sentinel, '.', 'inside.jsonl', NOW - 30 * DAY);
  fs.symlinkSync(sentinel, path.join(projects, 'linked-project'), LINK);
  transcript(projects, 'real-project', 'plain.jsonl', NOW - 30 * DAY);
  const linkFile = path.join(projects, 'real-project', 'linked.jsonl');
  fs.symlinkSync(sentinel, linkFile, LINK);

  const out = await sweepClaudeTranscripts({ apply: true, now: NOW, env, allocation });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(skipped(out, path.join(projects, 'linked-project')), 'link');
  assert.equal(skipped(out, linkFile), 'link');
  assert.equal(fs.existsSync(inside), true, 'nothing moved out through the link');
  assert.equal(fs.existsSync(path.join(archive, 'claude', 'linked-project', 'inside.jsonl')), false);
  assert.equal(fs.existsSync(path.join(archive, 'claude', 'real-project', 'linked.jsonl')), false);
});

test('archive keeps the project slug as the relative path and apply=false only reports', async (t) => {
  const { projects, archive, env, allocation } = sandbox(t);
  const file = transcript(projects, 'deep-slug', 's.jsonl', NOW - 30 * DAY);
  const want = path.join(archive, 'claude', 'deep-slug', 's.jsonl');

  const dry = await sweepClaudeTranscripts({ apply: false, now: NOW, env, allocation });
  assert.equal(dry.ok, true);
  assert.deepEqual(dry.moved, [{ from: file, to: want }]);
  assert.equal(dry.movedBytes, dry.freedBytes);
  assert.equal(fs.existsSync(file), true, 'report-only leaves the source');
  assert.equal(fs.existsSync(want), false, 'report-only creates nothing');

  const live = await sweepClaudeTranscripts({ apply: true, now: NOW, env, allocation });
  assert.deepEqual(live.moved, [{ from: file, to: want }]);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(want), true);
});

test('claudeProjectSlug spells a cwd the way ~/.claude/projects does', () => {
  assert.equal(claudeProjectSlug('D:/Repositories/starci-academy-backend/.claude'),
    'D--Repositories-starci-academy-backend--claude');
  assert.equal(claudeProjectSlug('C:\\Users\\Hi\\AppData\\Roaming\\Claude\\scratch-workspaces\\u1\\u2\\scratch-2026-09-22-059e29'),
    'C--Users-Hi-AppData-Roaming-Claude-scratch-workspaces-u1-u2-scratch-2026-09-22-059e29');
  assert.deepEqual(claudeProjectsRoots({ STARCI_CLAUDE_PROJECTS_ROOT: 'x' + path.delimiter + 'y' }).map((p) => path.basename(p)), ['x', 'y']);
});
