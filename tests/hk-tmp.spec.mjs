import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sweepTmp } from '../scripts/lib/hk-tmp.mjs';
import { safeRemoveTree } from '../scripts/lib/safe-remove.mjs';

// STORAGE-PROMPT item 1.tmp: top-level %TEMP% entries matching a declared prefix and older than
// tmpMaxAgeMs go through safeRemoveTree; links, ${TEMP}/claude and live-process dirs are skipped. Every
// case runs against its own fixture dir through the injected `env` seam — the real TEMP is never read.
const DAY = 24 * 60 * 60 * 1000;
const ALLOCATION = { tmpPrefixes: ['starci', 'evidence-'], tmpMaxAgeMs: 2 * DAY };
const NOW = Date.parse('2026-09-26T12:00:00Z');

function sandbox(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hk-tmp-spec-')));
  t.after(() => { safeRemoveTree(root); });
  return { root, env: { TEMP: root } };
}
/** A temp entry (dir with a payload file, or a plain file) aged to `mtimeMs`. */
function entry(root, name, mtimeMs = NOW - 10 * DAY, { file = false, payload = 'payload-bytes' } = {}) {
  const p = path.join(root, name);
  if (file) fs.writeFileSync(p, payload);
  else { fs.mkdirSync(path.join(p, 'nested'), { recursive: true }); fs.writeFileSync(path.join(p, 'nested', 'data.txt'), payload); }
  const d = new Date(mtimeMs);
  fs.utimesSync(p, d, d);
  return p;
}
const skippedFor = (out, p) => out.skipped.find((s) => s.path === p);
const errorsFor = (out, p) => out.errors.find((e) => e.path === p);
/** A real junction on Windows (cmd //c mklink /J), a dir symlink elsewhere — never a fake. */
function makeLink(target, link) {
  if (process.platform === 'win32') {
    const r = spawnSync('cmd', ['/c', 'mklink', '/J', link, target], { encoding: 'utf8', windowsHide: true });
    assert.equal(r.status, 0, `mklink /J: ${r.stdout} ${r.stderr}`);
  } else {
    fs.symlinkSync(target, link, 'dir');
  }
}

test('sweepTmp removes only prefix-matched top-level entries and reports the freed bytes', async (t) => {
  const { root, env } = sandbox(t);
  const hit = entry(root, 'starci-w2-old');
  const hit2 = entry(root, 'evidence-run-9', NOW - 5 * DAY, { file: true });
  const miss = entry(root, 'unrelated-old-dir');
  const missFile = entry(root, 'notes.txt', NOW - 10 * DAY, { file: true });
  const out = await sweepTmp({ apply: true, now: NOW, env, allocation: ALLOCATION });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.deepEqual(out.deleted.sort(), [hit, hit2].sort());
  assert.equal(fs.existsSync(hit), false);
  assert.equal(fs.existsSync(hit2), false);
  assert.equal(fs.existsSync(miss), true, 'a non-matching name survives');
  assert.equal(fs.existsSync(missFile), true);
  assert.equal(skippedFor(out, miss), undefined, 'non-matching entries are not even reported');
  assert.equal(out.freedBytes > 0, true, 'the payload bytes are reported as freed');
});

test('sweepTmp deletes an entry strictly older than tmpMaxAgeMs and keeps one exactly at the boundary', async (t) => {
  const { root, env } = sandbox(t);
  const older = entry(root, 'starci-older', NOW - ALLOCATION.tmpMaxAgeMs - 1);
  const boundary = entry(root, 'starci-boundary', NOW - ALLOCATION.tmpMaxAgeMs);
  const fresh = entry(root, 'starci-fresh', NOW - DAY);
  const out = await sweepTmp({ apply: true, now: NOW, env, allocation: ALLOCATION });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.deepEqual(out.deleted, [older]);
  assert.equal(fs.existsSync(older), false);
  assert.equal(fs.existsSync(boundary), true, 'mtime exactly tmpMaxAgeMs old is not "older"');
  assert.match(skippedFor(out, boundary)?.reason ?? '', /within tmpMaxAgeMs/);
  assert.equal(fs.existsSync(fresh), true);
  assert.match(skippedFor(out, fresh)?.reason ?? '', /within tmpMaxAgeMs/);
});

test('sweepTmp never removes or deletes through a junction: it is skipped and it and its target survive', async (t) => {
  const { root, env } = sandbox(t);
  const target = path.join(root, 'sentinel-target');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'live.txt'), 'do-not-lose\n');
  const link = path.join(root, 'starci-linked-out');
  makeLink(target, link);
  const d = new Date(NOW - 10 * DAY);
  try { fs.utimesSync(link, d, d); } catch { /* a junction that keeps the target's mtime still counts by lstat */ }
  const out = await sweepTmp({ apply: true, now: NOW, env, allocation: ALLOCATION });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.deepEqual(out.deleted, []);
  assert.equal(fs.existsSync(link), true, 'the junction itself survives — a link is never removed');
  assert.equal(fs.readFileSync(path.join(target, 'live.txt'), 'utf8'), 'do-not-lose\n', 'the target behind it is untouched');
  assert.match(skippedFor(out, link)?.reason ?? '', /link/);
});

test('sweepTmp records an EBUSY removal as skipped, not an error, and the entry survives', async (t) => {
  const { root, env } = sandbox(t);
  const held = entry(root, 'starci-held-open');
  const busyRemove = () => ({ ok: false, root: held, removed: { files: 0, dirs: 0, links: 0 }, errors: [{ path: held, code: 'EBUSY', message: 'resource busy or locked' }] });
  const out = await sweepTmp({ apply: true, now: NOW, env, allocation: ALLOCATION, remove: busyRemove });
  assert.equal(out.ok, true, 'busy is not an error');
  assert.deepEqual(out.deleted, []);
  assert.deepEqual(out.errors, []);
  assert.match(skippedFor(out, held)?.reason ?? '', /EBUSY/);
  assert.equal(fs.existsSync(held), true);
});

test('sweepTmp records a non-busy removal failure under errors and flips ok false', async (t) => {
  const { root, env } = sandbox(t);
  const broken = entry(root, 'starci-broken');
  const failRemove = () => ({ ok: false, errors: [{ path: broken, code: 'EIO', message: 'i/o error' }] });
  const out = await sweepTmp({ apply: true, now: NOW, env, allocation: ALLOCATION, remove: failRemove });
  assert.equal(out.ok, false);
  assert.deepEqual(out.deleted, []);
  assert.match(errorsFor(out, broken)?.error ?? '', /EIO/);
  assert.equal(fs.existsSync(broken), true);
});

test('sweepTmp on a dry run deletes nothing and reports the would-be-deleted entries and bytes', async (t) => {
  const { root, env } = sandbox(t);
  const stale = entry(root, 'starci-stale');
  const staleBytes = fs.statSync(path.join(stale, 'nested', 'data.txt')).size;
  const out = await sweepTmp({ apply: false, now: NOW, env, allocation: ALLOCATION });
  assert.equal(out.ok, true);
  assert.deepEqual(out.deleted, [], 'a dry run deletes nothing');
  assert.equal(fs.existsSync(stale), true);
  assert.match(skippedFor(out, stale)?.reason ?? '', /dry run/);
  assert.equal(out.freedBytes >= staleBytes, true, 'the report still prices what --apply would free');
});

test('sweepTmp never touches ${TEMP}/claude even when a prefix would match it', async (t) => {
  const { root, env } = sandbox(t);
  const claude = entry(root, 'claude', NOW - 30 * DAY);
  const claudePrefix = { tmpPrefixes: ['cla', 'starci'], tmpMaxAgeMs: 2 * DAY };
  const out = await sweepTmp({ apply: true, now: NOW, env, allocation: claudePrefix });
  assert.equal(out.ok, true);
  assert.deepEqual(out.deleted, []);
  assert.equal(fs.existsSync(claude), true);
  assert.match(skippedFor(out, claude)?.reason ?? '', /protected/);
});

test('sweepTmp with no declared prefixes matches nothing, and reports a missing temp dir as an error', async (t) => {
  const { root, env } = sandbox(t);
  entry(root, 'starci-anything');
  const out = await sweepTmp({ apply: true, now: NOW, env, allocation: {} });
  assert.equal(out.ok, true);
  assert.deepEqual(out.deleted, [], 'an undeclared prefix list fails safe, not wide');
  assert.equal(fs.readdirSync(root).length > 0, true);
  const gone = await sweepTmp({ apply: true, now: NOW, env: { TEMP: path.join(root, 'never-made') }, allocation: ALLOCATION });
  assert.equal(gone.ok, false);
  assert.equal(gone.errors.length, 1);
});
