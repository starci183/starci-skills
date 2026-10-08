// git-land.spec.mjs — ordered/locked local landing, typed refusals, ff-only behavior, notes, and no push.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { gitLand } from '../../scripts/supervisor/git-land.mjs';
import { merge as mergeCall } from '../../scripts/api/git/merge.mjs';
import { notes as notesCall } from '../../scripts/api/git/notes.mjs';
import { revParseQuery as revParseQueryCall } from '../../scripts/api/git/rev-parse-query.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const commit = (repo, file, text, message) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), text);
  git(repo, 'add', file);
  git(repo, 'commit', '-q', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
};

function fixture(t) {
  const base = mkdtemp(t, 'starci-git-land-'), repo = path.join(base, 'repo'), lane = path.join(base, 'lane');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', key, value);
  const main = commit(repo, 'README.md', 'base\n', 'base');
  git(repo, 'branch', 'lane');
  git(repo, 'worktree', 'add', '-q', lane, 'lane');
  const tip = commit(lane, 'scripts/value.mjs', 'export const value = 1;\n', 'lane change');
  return { base, repo, lane, main, tip };
}

const context = (fx, args = {}) => ({ positionals: [fx.lane, 'lane'], args, cwd: fx.base, env: {}, role: 'coordinator' });
const lock = async (_options, fn) => ({ ok: true, locked: true, value: await fn() });
const greenDeps = (fx, more = {}) => ({
  underHostLock: lock,
  runGate: () => ({ ok: true, base: fx.main, problems: [] }),
  runCheck: () => ({ ok: true, pass: 5, total: 5, output: 'green' }),
  changedFiles: () => ['scripts/value.mjs'],
  runSpecs: () => ({ ok: true, selected: 1, pass: 1, rerun: 0, log: path.join(fx.base, 'land.log') }),
  announceLand: () => true,
  ...more,
});

test('the six steps stay ordered under one lock and dry-run stops before the merge', async (t) => {
  const fx = fixture(t), events = [];
  const deps = greenDeps(fx, {
    linkedNodeModules: () => { events.push('links'); return []; },
    underHostLock: async (_options, fn) => { events.push('lock'); return { ok: true, value: await fn() }; },
    runGate: () => { events.push('gate'); return { ok: true, base: fx.main, problems: [] }; },
    runCheck: () => { events.push('check'); return { ok: true, pass: 2, total: 2 }; },
    runSpecs: () => { events.push('specs'); return { ok: true, selected: 1, pass: 1, rerun: 0, log: null }; },
    landLocalMain: () => { events.push('merge'); return { ok: true }; },
  });
  const out = await gitLand(context(fx), deps);
  assert.equal(out.code, 0);
  assert.deepEqual(events, ['links', 'lock', 'gate', 'check', 'specs', 'merge']);
  events.length = 0;
  const dry = await gitLand(context(fx, { 'dry-run': true }), deps);
  assert.equal(dry.code, 0);
  assert.equal(dry.data.landed, false);
  assert.deepEqual(events, ['links', 'lock', 'gate', 'check', 'specs']);
});

test('a green land fast-forwards primary local main and records verification trailers in refs/notes/land', async (t) => {
  const fx = fixture(t), calls = [];
  const deps = greenDeps(fx, {
    revParseQuery: (args, options) => { calls.push(['rev-parse', ...args]); return revParseQueryCall(args, options); },
    merge: (args, options) => { calls.push(['merge', ...args]); return mergeCall(args, options); },
    notes: (args, options) => { calls.push(['notes', ...args]); return notesCall(args, options); },
  });
  const out = await gitLand(context(fx), deps);
  assert.equal(out.code, 0, out.text);
  assert.equal(out.data.schema, 'starci/git-land@1');
  assert.equal(out.data.landed, true);
  assert.equal(git(fx.repo, 'rev-parse', 'HEAD'), fx.tip);
  const note = git(fx.repo, 'notes', '--ref=land', 'show', fx.tip);
  assert.match(note, new RegExp(`Land-Verified: ${fx.tip}`));
  assert.match(note, /Specs: 1\/1/);
  assert.match(note, /Check: 5\/5/);
  assert.equal(calls.some((argv) => argv.includes('push')), false, JSON.stringify(calls));
});

test('a land announces itself once the main moved, and carries its Kernel note as a trailer of the land record, verbatim; absent, no line', async (t) => {
  const fx = fixture(t), announced = [];
  const note = 'settle now needs --evidence; re-read driver-loop.yaml before the next wake';
  const deps = greenDeps(fx, { announceLand: (event) => { announced.push(event); return true; } });
  const out = await gitLand(context(fx, { 'kernel-note': `  ${note}  ` }), deps);
  assert.equal(out.code, 0, out.text);
  assert.deepEqual(announced, [{ landed: fx.tip, lane: null, kernelNote: note }]);
  assert.match(git(fx.repo, 'notes', '--ref=land', 'show', fx.tip), new RegExp(`^Kernel-Note: ${note}$`, 'm'));
  const dry = await gitLand(context(fx, { 'dry-run': true, 'kernel-note': note }), deps);
  assert.equal(announced.length, 1, 'a dry run announces nothing');
  assert.ok(dry.data.trailers.includes(`Kernel-Note: ${note}`));
  const plain = fixture(t), plainAnnounced = [];
  const bare = await gitLand(context(plain), greenDeps(plain, { announceLand: (event) => { plainAnnounced.push(event); return true; } }));
  assert.equal(bare.code, 0, bare.text);
  assert.equal(bare.data.trailers.some((line) => line.startsWith('Kernel-Note')), false);
  assert.doesNotMatch(git(plain.repo, 'notes', '--ref=land', 'show', plain.tip), /Kernel-Note/);
  assert.equal(plainAnnounced[0].kernelNote, null);
});

test('a Kernel note that is empty, spans lines or is too long is a usage error before anything runs', async (t) => {
  const fx = fixture(t);
  let ran = 0;
  const deps = greenDeps(fx, { runGate: () => { ran += 1; return { ok: true, base: fx.main, problems: [] }; } });
  for (const bad of ['', '   ', 'one\ntwo', 'x'.repeat(401), true]) {
    const out = await gitLand(context(fx, { 'kernel-note': bad }), deps);
    assert.equal(out.code, 2, JSON.stringify(bad));
    assert.match(out.text, /--kernel-note/);
  }
  assert.equal(ran, 0);
});

test('every refusal names its typed step and stops before later work', async (t) => {
  const fx = fixture(t);
  const cases = [
    ['1-linked-node-modules', { linkedNodeModules: () => [path.join(fx.lane, 'node_modules')] }],
    ['2-land-gate', { runGate: () => ({ ok: false, problems: ['import red'] }) }],
    ['3-runtime-check', { runCheck: () => ({ ok: false, pass: 3, total: 4, output: 'check red' }) }],
    ['4-specs', { runSpecs: () => ({ ok: false, cause: 'selection-empty', detail: '1 code file changed but 0 specs selected', selected: 0, pass: 0, rerun: 0 }) }],
    ['6-local-main', { landLocalMain: () => ({ ok: false, cause: 'fast-forward', detail: 'main moved' }) }],
  ];
  for (const [step, override] of cases) {
    const out = await gitLand(context(fx), greenDeps(fx, override));
    assert.equal(out.code, 1, `${step}: ${out.text}`);
    assert.equal(out.data.refusal.step, step);
    assert.match(out.text, new RegExp(step));
    if (step === '1-linked-node-modules') assert.equal(out.data.refusal.code, 'RT_NODE_MODULES_LINK');
  }
  const held = await gitLand(context(fx), greenDeps(fx, { underHostLock: async () => ({ ok: false, cause: 'held', owner: 'release-7' }) }));
  assert.equal(held.data.refusal.step, '5-serial-lock');
  assert.match(held.text, /release-7/);
});

test('delta landing refuses a missing log and a verified commit outside ref history', async (t) => {
  const fx = fixture(t);
  const missing = await gitLand(context(fx, { verified: fx.main, 'verified-log': path.join(fx.base, 'absent.log') }), greenDeps(fx));
  assert.equal(missing.data.refusal.cause, 'verified-log-missing');
  const log = path.join(fx.base, 'verified.log');
  fs.writeFileSync(log, 'green\n');
  const other = commit(fx.repo, 'main-only.txt', 'x\n', 'main only');
  const outside = await gitLand(context(fx, { verified: other, 'verified-log': log }), greenDeps(fx));
  assert.equal(outside.data.refusal.cause, 'verified-not-ancestor');
});

test('ff-only refuses when local main moved to a divergent commit while verification ran', async (t) => {
  const fx = fixture(t);
  commit(fx.repo, 'main-only.txt', 'main moved\n', 'main moved');
  const out = await gitLand(context(fx), greenDeps(fx));
  assert.equal(out.code, 1);
  assert.equal(out.data.refusal.step, '6-local-main');
  assert.equal(out.data.refusal.cause, 'fast-forward');
  assert.notEqual(git(fx.repo, 'rev-parse', 'HEAD'), fx.tip);
});
