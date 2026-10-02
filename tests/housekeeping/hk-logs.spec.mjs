// hk-logs.spec.mjs — the log/transcript caps of the housekeeping sweep (scripts/housekeeping/hk-logs.mjs),
// on fake roots: injected LOCALAPPDATA/USERPROFILE/APPDATA point at a temp dir, never the host's.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { sweepStarciLogs, DEFAULT_LOG_MAX_AGE_MS } from '../../scripts/housekeeping/hk-logs.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { allocationMs } from '../../engine/config.mjs';

// Every fixture dir comes down in t.after through the suite's mkdtemp helper; `before` runs inside the same
// after-callback ahead of the removal, so a test holding a file open (the FileShare.None case) releases it
// before the rm instead of after it (an open handle makes the rm fail and leaks the dir).
const tmp = (t, before = null) => mkdtemp(t, 'hk-logs-', before);
const envOf = (t, before = null) => {
  const root = tmp(t, before);
  return { LOCALAPPDATA: path.join(root, 'la'), USERPROFILE: path.join(root, 'user'), HOME: path.join(root, 'user'), APPDATA: path.join(root, 'ro') };
};
const NOW = 1_800_000_000_000;                          // a fixed clock
const OLD = NOW - DEFAULT_LOG_MAX_AGE_MS - 60_000;      // past the window
const YOUNG = NOW - 60_000;                             // inside the window
const HK = { housekeeping: { logMaxAgeMs: DEFAULT_LOG_MAX_AGE_MS } };

const put = (file, content = 'x', mtime = NOW) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  const at = new Date(mtime);
  fs.utimesSync(file, at, at);
  return file;
};
const paths = (list) => list.map((e) => e.path);

test('age deletes covered *.log/*.jsonl under the StarCi roots; young files and other names stay', async (t) => {
  const env = envOf(t);
  const starci = path.join(env.LOCALAPPDATA, 'StarCi');
  const home = path.join(env.USERPROFILE, '.starci');
  const old1 = put(path.join(starci, 'runtime', 'deps', '.cache', '_logs', 'npm-debug.log'), 'n'.repeat(100), OLD);
  const old2 = put(path.join(home, 'redundancy', 'handoff-devin', 'land-queue.log'), 'l', OLD);
  const old3 = put(path.join(starci, 'archive', 'guards', 'old.jsonl'), '{}\n', OLD);
  const young = put(path.join(starci, 'runtime', 'deps', '.cache', '_logs', 'recent.log'), 'y', YOUNG);
  const other = put(path.join(starci, 'runtime', 'machine.sqlite'), 'db', OLD);
  const state = put(path.join(starci, 'runtime', 'connectors', 'tunnel.json'), '{}', OLD);

  const dry = await sweepStarciLogs({ apply: false, now: NOW, env, allocation: HK });
  assert.ok(dry.ok);
  assert.equal(fs.existsSync(old1), true, 'dry run deletes nothing');
  assert.deepEqual(paths(dry.deleted).sort(), [old1, old2, old3].sort());
  assert.equal(dry.freedBytes, 104);
  assert.ok(dry.deleted.every((e) => e.dry === true), 'a dry run reports the plan');

  const r = await sweepStarciLogs({ apply: true, now: NOW, env, allocation: HK });
  assert.ok(r.ok);
  assert.equal(fs.existsSync(old1), false);
  assert.equal(fs.existsSync(old2), false);
  assert.equal(fs.existsSync(old3), false);
  assert.equal(fs.existsSync(young), true, 'inside the window');
  assert.equal(fs.existsSync(other), true, 'sqlite is not a covered name');
  assert.equal(fs.existsSync(state), true, '.json is not a covered name');
  assert.equal(r.freedBytes, 104);
});

test('a covered file inside the window but over the cap is rotated to .1 (the rotateLog convention)', async (t) => {
  const env = envOf(t);
  const hk = { housekeeping: { logMaxAgeMs: DEFAULT_LOG_MAX_AGE_MS, logCapBytes: 100 } };
  const big = put(path.join(env.USERPROFILE, '.starci', 'handoff', 'big.log'), 'b'.repeat(500), YOUNG);
  const oldSibling = put(`${big}.1`, 'o'.repeat(60), YOUNG);
  const small = put(path.join(env.USERPROFILE, '.starci', 'handoff', 'small.log'), 's'.repeat(10), YOUNG);
  const oldOverCap = put(path.join(env.USERPROFILE, '.starci', 'handoff', 'aged.log'), 'a'.repeat(500), OLD);

  const r = await sweepStarciLogs({ apply: true, now: NOW, env, allocation: hk });
  assert.ok(r.ok);
  assert.equal(fs.existsSync(big), false, 'the live file was renamed away; the writer re-creates it');
  assert.equal(fs.readFileSync(`${big}.1`, 'utf8'), 'b'.repeat(500), 'the rotated sibling holds the content');
  const rot = r.truncated.find((e) => e.path === big);
  assert.equal(rot.fromBytes, 500);
  assert.equal(rot.toBytes, 0);
  assert.equal(rot.via, 'rename-.1');
  assert.equal(rot.freedBytes, 60, 'the previous .1 sibling was replaced');
  assert.equal(fs.existsSync(small), true);
  assert.equal(fs.existsSync(oldOverCap), false, 'over-cap AND old: age wins, it is deleted not rotated');
  assert.equal(r.freedBytes, 60 + 500);
});

test('orca terminal-history and logs are capped by age; emptied dirs go too', async (t) => {
  const env = envOf(t);
  const orca = path.join(env.APPDATA, 'orca');
  const dead = path.join(orca, 'terminal-history', 'term-dead');
  const alive = path.join(orca, 'terminal-history', 'term-alive');
  put(path.join(dead, 'output.log'), 'o', OLD);
  put(path.join(dead, 'meta.json'), '{}', OLD);
  put(path.join(dead, 'checkpoint.json'), '{}', OLD);
  put(path.join(alive, 'output.log'), 'o', YOUNG);
  const rotated = put(path.join(orca, 'logs', 'main.trace.ndjson.9'), 'n', OLD);
  const live = put(path.join(orca, 'logs', 'daemon.log'), 'd', YOUNG);

  const r = await sweepStarciLogs({ apply: true, now: NOW, env, allocation: HK });
  assert.ok(r.ok);
  assert.equal(fs.existsSync(dead), false, 'a dead terminal dir whose files all aged out is removed');
  assert.equal(fs.existsSync(alive), true);
  assert.equal(fs.existsSync(rotated), false, "Orca's own rotated siblings are capped by age too");
  assert.equal(fs.existsSync(live), true);
});

test('orchestration.db is reported by size and never touched', async (t) => {
  const env = envOf(t);
  const db = put(path.join(env.APPDATA, 'orca', 'orchestration.db'), 'd'.repeat(2048), OLD);
  const wal = put(`${db}-wal`, 'w'.repeat(512), OLD);
  const r = await sweepStarciLogs({ apply: true, now: NOW, env, allocation: HK });
  assert.ok(r.ok);
  assert.equal(r.report.orchestrationDbBytes, 2048);
  assert.equal(r.report.orchestrationDbWalBytes, 512);
  assert.equal(fs.readFileSync(db, 'utf8'), 'd'.repeat(2048), 'content untouched');
  assert.equal(fs.existsSync(wal), true, 'the wal is not under a capped dir and not a covered name');
  assert.ok(!paths(r.deleted).includes(db));
  assert.ok(!paths(r.skipped).includes(db));
});

test('a junction inside a root is never descended into', { skip: process.platform !== 'win32' && 'junction points are a Windows reparse-point feature (fs.symlinkSync type "junction"); on other platforms a directory link needs privileges the suite cannot assume' }, async (t) => {
  const env = envOf(t);
  const starci = path.join(env.LOCALAPPDATA, 'StarCi');
  const outside = tmp(t);
  const inside = put(path.join(outside, 'real', 'evil.log'), 'e', OLD);
  const junction = path.join(starci, 'runtime', 'linked');
  fs.mkdirSync(path.dirname(junction), { recursive: true });
  try { fs.symlinkSync(path.join(outside, 'real'), junction, 'junction'); } catch (error) { t.skip(`no junction: ${error.message}`); return; }

  const r = await sweepStarciLogs({ apply: true, now: NOW, env, allocation: HK });
  assert.ok(r.ok);
  assert.equal(fs.existsSync(inside), true, 'a file behind a junction is never reached');
  assert.equal(fs.existsSync(junction), true, 'the junction itself is left alone');
  assert.ok(r.skipped.some((e) => e.path === junction && e.reason === 'link'));
});

test('a symlinked log file is skipped, never deleted through', { skip: process.platform !== 'win32' && 'the guarded path is only meaningful on Windows, where a file symlink needs Developer Mode or SeCreateSymbolicLinkPrivilege; POSIX hosts would exercise a different link semantic than the fleet runs on' }, async (t) => {
  const env = envOf(t);
  const outside = tmp(t);
  const target = put(path.join(outside, 'target.log'), 't', OLD);
  const link = path.join(env.LOCALAPPDATA, 'StarCi', 'runtime', 'app.log');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  try {
    fs.symlinkSync(target, link, 'file');
  } catch (error) {
    // Windows refuses a file symlink without Developer Mode or SeCreateSymbolicLinkPrivilege: that is the host,
    // not the sweep, so the case is skipped. Any other failure is a real error.
    if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error;
    t.skip(`the OS refused a file symlink (${error.code}): needs Developer Mode or the symlink privilege`);
    return;
  }

  const r = await sweepStarciLogs({ apply: true, now: NOW, env, allocation: HK });
  assert.ok(r.ok);
  assert.equal(fs.existsSync(link), true, 'the link is left alone');
  assert.equal(fs.existsSync(target), true, 'the target is never reached');
  assert.ok(r.skipped.some((e) => e.path === link && e.reason === 'link'));
});

test('a checkout subtree (dir with a .git entry) is skipped whole', async (t) => {
  const env = envOf(t);
  const lane = path.join(env.USERPROFILE, '.starci', 'lanes', 'storage-logs');
  put(path.join(lane, '.git'), 'gitdir: x', YOUNG);
  put(path.join(lane, 'run.log'), 'r', OLD);
  const r = await sweepStarciLogs({ apply: true, now: NOW, env, allocation: HK });
  assert.ok(r.ok);
  assert.equal(fs.existsSync(path.join(lane, 'run.log')), true, 'nothing inside a worktree is swept');
  assert.ok(r.skipped.some((e) => e.path === lane && e.reason === 'git-checkout'));
});

test('a file the host will not release (FileShare.None) is skipped, not an error', { skip: process.platform !== 'win32' && 'FileShare.None locking is a Windows-only file semantic ([System.IO.File]::Open with share None via powershell.exe); POSIX locks are advisory and would not reproduce the busy-file refusal under test' }, async (t) => {
  let ps = null;
  // Release the lock and wait for the holder to exit BEFORE the fixture dir is removed.
  const release = async () => {
    if (!ps || ps.exitCode !== null || ps.signalCode !== null) return;
    const exited = new Promise((resolve) => ps.once('exit', resolve));
    try { ps.stdin.end('x\n'); } catch { /* gone */ }
    const timer = setTimeout(() => { try { ps.kill(); } catch { /* gone */ } }, 5_000);
    await exited;
    clearTimeout(timer);
  };
  const env = envOf(t, release);
  const locked = put(path.join(env.LOCALAPPDATA, 'StarCi', 'runtime', 'held.log'), 'h', OLD);
  ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$f=[System.IO.File]::Open('${locked.replaceAll("'", "''")}', 'Open', 'ReadWrite', 'None'); [Console]::ReadLine() | Out-Null; $f.Close()`],
    { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
  // powershell.exe can take well over 10s to start under the full suite's load: wait by the per-spec budget.
  const deadline = Date.now() + allocationMs('landGate.perSpecMs');
  for (;;) {   // wait until the lock is held: our own write must start failing first
    try { fs.appendFileSync(locked, 'x'); await new Promise((r) => setTimeout(r, 100)); }
    catch { break; }
    assert.ok(Date.now() < deadline, 'the lock was never taken');
  }

  const r = await sweepStarciLogs({ apply: true, now: NOW, env, allocation: HK });
  assert.ok(r.ok, 'a busy file is a skip, never a sweep failure');
  assert.equal(fs.existsSync(locked), true);
  assert.ok(r.skipped.some((e) => e.path === locked && /EBUSY|EPERM|EACCES/.test(e.reason)), `skipped reasons: ${JSON.stringify(r.skipped)}`);
});
