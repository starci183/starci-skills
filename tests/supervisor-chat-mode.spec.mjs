// config.yaml supervisor.mode chat (the default; owner, 2026-09-25: "dời supervisor vào chat đi cho persistent"):
// the owner's desktop chat is the Supervisor again (modules/supervisor/supervise.yaml chatSeat, docs/supervisor.md).
// The chat registers and drains channel 'main' with no Orca terminal; every other reader peeks. Nothing starts a
// [Supervisor] kernel: start-supervisor answers chat-mode, resume-all's ensureSupervisor skips, and the supervisor
// watchdog loop exits cleanly (also while the seat is DISABLED). Every spec runs on a temp LOCALAPPDATA and a temp
// supervisor home: no Orca, no agent, no network, never the live runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateConfig } from '../engine/config.mjs';
import { parseYaml } from '../engine/yaml.mjs';
import { appendInbox, getSupervisor, readInbox, readOutbox, registerSupervisor } from '../scripts/connectors/telegram-bridge.mjs';
import { drainRefusal, registrationRefusal, replyToOwner } from '../scripts/supervisor/channel.mjs';
import { openSupervisorLedger, setEnabled, supervisorMode, supervisorSettings } from '../scripts/supervisor/home.mjs';
import { ensureSupervisor, ensureSupervisorWatchdog, launchSupervisor, CHAT_MODE_REASON } from '../scripts/supervisor/start-supervisor.mjs';
import { runLoop, standDownReason, watchdogPass, STAND_DOWN_CHECKS } from '../scripts/supervisor/watchdog.mjs';
import { resumeAll } from '../scripts/kernel/resume-all.mjs';
import { removeStaging, stagingPathOf } from '../scripts/supervisor/workers.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHANNEL = path.join(ROOT, 'scripts', 'supervisor', 'channel.mjs');
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* a ledger handle closes after this hook */ } });
  return dir;
};
const envOf = (t, mode = 'chat') => { const root = tmp(t, 'sup-chat-'); return { LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_SUPERVISOR_MODE: mode }; };
/** The channel CLI as the chat (no ORCA_TERMINAL_HANDLE, session `session`) or as an Orca terminal. */
const cli = (env, args, { terminal = null, session = null } = {}) => {
  const childEnv = { ...process.env, ...env, STARCI_CONNECTORS_OFF: '1', ORCA_TERMINAL_HANDLE: terminal ?? '', CLAUDE_CODE_SESSION_ID: session ?? '' };
  return spawnSync(process.execPath, [CHANNEL, ...args], { cwd: ROOT, env: childEnv, encoding: 'utf8', windowsHide: true, timeout: 30000 });
};
const unread = (env) => readInbox('main', env).filter((m) => !m.read).length;

test('supervisor.mode: chat by default, kernel optional, anything else refused by the config validator', () => {
  assert.equal(supervisorMode({ env: {}, config: null }), 'chat', 'no config: chat');
  assert.equal(supervisorMode({ env: {}, config: { supervisor: { repos: [] } } }), 'chat', 'unset: chat');
  assert.equal(supervisorMode({ env: {}, config: { supervisor: { mode: 'kernel' } } }), 'kernel');
  assert.equal(supervisorMode({ env: { STARCI_SUPERVISOR_MODE: 'chat' }, config: { supervisor: { mode: 'kernel' } } }), 'chat', 'the env override wins');
  assert.equal(supervisorMode({ env: { STARCI_SUPERVISOR_MODE: 'bogus' }, config: { supervisor: { mode: 'kernel' } } }), 'kernel', 'an invalid override is ignored');
  assert.equal(supervisorSettings({ config: null }).mode, 'chat');
  assert.equal(supervisorSettings({ config: { supervisor: { mode: 'kernel' } } }).mode, 'kernel');
  const example = parseYaml(fs.readFileSync(path.join(ROOT, 'config.example.yaml'), 'utf8'));
  assert.equal(supervisorMode({ env: {}, config: validateConfig(example) }), 'chat', 'the shipped default is chat');
  const withMode = (mode) => ({ ...example, supervisor: { ...example.supervisor, mode } });
  for (const mode of ['chat', 'kernel', null]) assert.doesNotThrow(() => validateConfig(withMode(mode)), String(mode));
  assert.throws(() => validateConfig(withMode('daemon')), /supervisor\.mode must be chat or kernel/);
  assert.throws(() => validateConfig(withMode(true)), /supervisor\.mode must be chat or kernel/);
});

test('chat mode: the chat registers channel main with no Orca terminal and drains it; Orca terminals are refused and peek', (t) => {
  const env = envOf(t);
  // An Orca terminal ([Kernel], [Op], [Worker]) does not take 'main' in chat mode; --force overrides.
  const fromOrca = cli(env, ['register', '--id', 'main', '--label', 'Supervisor'], { terminal: 'term_worker' });
  assert.equal(fromOrca.status, 1);
  assert.match(fromOrca.stderr, /owner's chat session/);
  assert.equal(getSupervisor('main', env), null, 'nothing was registered');
  assert.match(registrationRefusal({ id: 'main', terminal: 'term_x', mode: 'chat', env }), /owner's chat session/);
  assert.equal(registrationRefusal({ id: 'main', terminal: 'term_x', force: true, mode: 'chat', env }), null);
  assert.equal(registrationRefusal({ id: 'main', terminal: null, mode: 'chat', env }), null, 'the chat registers');
  assert.match(registrationRefusal({ id: 'main', terminal: null, mode: 'kernel', seatTerminal: null, env }), /\[Supervisor\] kernel/, 'kernel mode keeps its rule');

  // The desktop chat registers: no terminal, its session recorded.
  const reg = cli(env, ['register', '--id', 'main', '--label', 'Supervisor chat'], { session: 'sess-owner' });
  assert.equal(reg.status, 0, reg.stderr);
  const record = getSupervisor('main', env);
  assert.equal(record.terminal, undefined);
  assert.equal(record.session, 'sess-owner');

  appendInbox('main', { chatId: '4242', messageId: 7, text: 'owner ask' }, { env });
  appendInbox('main', { chatId: null, messageId: null, from: 'stall-alert', text: 'STALL-ALERT x' }, { env });

  // Every other reader: refused, nothing marked read; --peek stays open.
  const orca = cli(env, ['inbox', '--id', 'main'], { terminal: 'term_kernel', session: 'sess-owner' });
  assert.equal(orca.status, 1);
  assert.match(orca.stderr, /Orca terminal term_kernel/);
  const otherChat = cli(env, ['inbox', '--id', 'main'], { session: 'sess-lane' });
  assert.equal(otherChat.status, 1);
  assert.match(otherChat.stderr, /sess-owner only/);
  assert.equal(unread(env), 2, 'a refused drain marks nothing read');
  const peek = cli(env, ['inbox', '--id', 'main', '--json', '--peek'], { terminal: 'term_kernel' });
  assert.equal(peek.status, 0, peek.stderr);
  assert.equal(JSON.parse(peek.stdout).messages.length, 2);
  assert.equal(unread(env), 2, '--peek never marks read');

  // The registered chat drains.
  const drained = cli(env, ['inbox', '--id', 'main', '--json'], { session: 'sess-owner' });
  assert.equal(drained.status, 0, drained.stderr);
  assert.equal(JSON.parse(drained.stdout).messages.length, 2);
  assert.equal(unread(env), 0);
});

test('chat mode drain: a registration with no recorded session drains from any chat; one still bound to a terminal must re-register', (t) => {
  const env = envOf(t);
  // Not registered at all.
  assert.match(drainRefusal({ id: 'main', terminal: null, session: 's', env }) ?? '', /not registered/);
  // A chat registration made before sessions were recorded (the owner's register --force of 2026-09-25).
  registerSupervisor({ id: 'main', label: 'Supervisor' }, { env });
  assert.equal(drainRefusal({ id: 'main', terminal: null, session: null, env }), null);
  assert.equal(drainRefusal({ id: 'main', terminal: null, session: 'any', env }), null);
  assert.match(drainRefusal({ id: 'main', terminal: 'term_op', env }) ?? '', /owner's chat session only/);
  // Left over from kernel mode: the channel still names the old seat terminal.
  registerSupervisor({ id: 'main', label: 'Supervisor', terminal: 'term_old_seat' }, { env });
  assert.match(drainRefusal({ id: 'main', terminal: null, session: 's', env }) ?? '', /still registered to the Orca terminal term_old_seat/);
  // A new chat session takes over by registering again (the latest chat registration wins).
  const reg = cli(env, ['register', '--id', 'main', '--label', 'Supervisor'], { session: 'sess-new' });
  assert.equal(reg.status, 0, reg.stderr);
  assert.equal(drainRefusal({ id: 'main', terminal: null, session: 'sess-new', env }), null);
  assert.match(drainRefusal({ id: 'main', terminal: null, session: 'sess-old', env }) ?? '', /sess-new only/);
  // Other ids keep their open rules.
  assert.equal(drainRefusal({ id: 'sup-b', terminal: 'term_any', env }), null);
});

test('chat mode reply: a Telegram message is answered on Telegram; a runtime alert is recorded locally', async (t) => {
  const env = envOf(t);
  registerSupervisor({ id: 'main', label: 'Supervisor' }, { env });
  const sent = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { sent.push(JSON.parse(body || '{}')); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result: { message_id: 501 } })); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }));
  const deps = { env, settings: { ready: true, token: '123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop', chatId: '4242' }, apiBase: `http://127.0.0.1:${server.address().port}` };

  const tg = appendInbox('main', { chatId: '4242', messageId: 77, text: 'status of nivo?' }, { env });
  const r = await replyToOwner({ id: 'main', text: 'nivo is at UAT', to: tg.id }, deps);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.via, 'telegram');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].reply_parameters.message_id, 77, 'a reply to the owner message');
  assert.match(sent[0].text, /^\[Supervisor\] nivo is at UAT/);

  const alert = appendInbox('main', { chatId: null, messageId: null, from: 'stall-alert', text: 'OWED-ALERT inc-1' }, { env });
  const local = await replyToOwner({ id: 'main', text: 'fixed by lane abc', to: alert.id }, deps);
  assert.deepEqual([local.ok, local.via], [true, 'local']);
  assert.equal(sent.length, 1, 'a runtime alert is never answered on Telegram');
  assert.equal(readInbox('main', env).find((m) => m.id === alert.id).read, true);
  assert.deepEqual(readOutbox('main', env).map((o) => o.via), ['telegram', 'local']);
});

test('chat mode: start-supervisor launches nothing and resume-all never starts the seat or its watchdog', async (t) => {
  const env = envOf(t);
  // Even an enabled seat left over from kernel mode is not started in chat mode.
  const ledger = openSupervisorLedger({ env });
  setEnabled(ledger, true, { by: 'spec' });
  ledger.close();
  const never = { list: () => assert.fail('no Orca call'), verdict: () => assert.fail('no Orca call'), spawn: () => assert.fail('no [Supervisor] spawn') };
  const start = await launchSupervisor({ mode: 'start', env, deps: never, template: 'x', doc: {} });
  assert.deepEqual([start.ok, start.exit, start.action, start.reason], [false, 1, 'chat-mode', CHAT_MODE_REASON]);
  const replace = await launchSupervisor({ mode: 'replace', env, deps: never, template: 'x', doc: {} });
  assert.deepEqual([replace.ok, replace.exit, replace.action], [true, 0, 'chat-mode'], "the watchdog's replace is a clean no-op");
  assert.equal((await launchSupervisor({ mode: 'adopt', adoptHandle: 'term_x', env, deps: never })).action, 'chat-mode');
  assert.deepEqual(ensureSupervisorWatchdog({ env, list: () => assert.fail('no process scan') }), { ok: true, skipped: 'chat mode' });
  assert.deepEqual(ensureSupervisor({ env, ensure: () => assert.fail('never ensures a watchdog') }), { ok: true, skipped: 'chat mode' });

  const result = resumeAll({ repos: [], workflowsOf: () => [], watchdogs: () => [], spawn: () => assert.fail('no watchdog to start'),
    probe: () => true, connectors: { cloudflare: { mode: 'off' } }, startOne: () => assert.fail('connectors are off'),
    ensureBridge: () => ({ ok: true, skipped: 'spec' }), stallAlert: () => ({ ok: true, skipped: 'spec' }),
    dedupeFn: () => ({ ok: true, closed: [], kept: [], deferred: [] }), logDedupeFn: () => null, orphansOf: () => [],
    supervisor: (options) => ensureSupervisor({ ...options, env, ensure: () => assert.fail('resume-all never starts the [Supervisor] watchdog in chat mode') }) });
  assert.deepEqual(result.supervisor, { ok: true, skipped: 'chat mode' });

  // Kernel mode keeps the old behaviour: an enabled seat gets its watchdog ensured.
  const kernelEnv = { ...env, STARCI_SUPERVISOR_MODE: 'kernel' };
  assert.deepEqual(ensureSupervisor({ env: kernelEnv, ensure: () => ({ ok: true, launched: 42 }) }), { ok: true, launched: 42 });
});

test('the supervisor watchdog stands down: chat mode or a DISABLED seat ends the loop cleanly after consecutive checks', async (t) => {
  const env = envOf(t);
  assert.equal(standDownReason({ env }), 'chat-mode');
  assert.deepEqual(await watchdogPass({ env, d: { verdict: () => assert.fail('no Orca call') } }), { ok: true, action: 'chat-mode' });
  const kernelEnv = { ...env, STARCI_SUPERVISOR_MODE: 'kernel' };
  assert.equal(standDownReason({ env: kernelEnv }), 'never-started');
  const ledger = openSupervisorLedger({ env: kernelEnv });
  setEnabled(ledger, true, { by: 'spec' });
  assert.equal(standDownReason({ env: kernelEnv }), null, 'an enabled kernel seat is watched');
  setEnabled(ledger, false, { by: 'spec' });
  ledger.close();
  assert.equal(standDownReason({ env: kernelEnv }), 'disabled');

  // The loop: exits (lock released) once STAND_DOWN_CHECKS consecutive checks agree, running no pass.
  let released = 0, slept = 0;
  const claim = () => ({ ok: true, release: () => { released += 1; } });
  const quiet = { claim, sleep: async () => { slept += 1; }, log: () => {}, pass: () => assert.fail('no pass while standing down'), maxIterations: 10 };
  assert.deepEqual(await runLoop({ ...quiet, env }), { exited: 'chat-mode' });
  assert.equal(slept, STAND_DOWN_CHECKS - 1, 'it exits on the second agreeing check');
  assert.ok(released >= 1, 'its lock is released');
  assert.deepEqual(await runLoop({ ...quiet, env: kernelEnv }), { exited: 'disabled' });

  // A --restart flips the seat off and on again between two checks: a single DISABLED reading never ends the loop.
  const readings = ['disabled', null, 'disabled', null, null];
  let passes = 0;
  const flipping = await runLoop({ claim, sleep: async () => {}, log: () => {}, standDown: () => readings.shift() ?? null,
    pass: async () => { passes += 1; return Date.now(); }, maxIterations: 5 });
  assert.deepEqual(flipping, { exited: null }, 'still running after the flip');
  assert.equal(passes, 3, 'it keeps passing while the seat is enabled');

  // Another loop holds the lock: this one returns at once.
  assert.deepEqual(await runLoop({ claim: () => ({ ok: false, holder: { pid: 55184 } }), log: () => {} }), { already: true, pid: 55184 });
});

test('the watchdog loop process exits 0 by itself in chat mode', (t) => {
  const env = envOf(t);
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'supervisor', 'watchdog.mjs')], {
    cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, env: { ...process.env, ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim().split(/\r?\n/).pop()), { ok: true, exited: 'chat-mode' });
  assert.ok(Date.now() - started < 110_000);
});

test('workers cleanup removes a staging directory whose worktree registration is gone (prune, then remove)', (t) => {
  const root = tmp(t, 'sup-chat-git-');
  const repo = path.join(root, 'repo');
  const git = (...args) => { const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  fs.mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  git('add', '.');
  git('-c', 'user.email=spec@example.com', '-c', 'user.name=spec', 'commit', '-q', '-m', 'init');
  const env = { STARCI_SUPERVISOR_HOME: path.join(root, 'home') };
  const jobId = 'fix-gone-registration-000001';
  const dir = stagingPathOf(jobId, env);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git('worktree', 'add', '-q', '-b', `sup/${jobId}`, dir, 'main');
  // The registration disappears (its admin dir removed); the checkout directory stays behind.
  fs.rmSync(path.join(repo, '.git', 'worktrees', path.basename(dir)), { recursive: true, force: true });
  const out = removeStaging({ jobId, root: repo, env, landed: true });
  assert.equal(out.removed, true, out.error);
  assert.equal(out.unregistered, true);
  assert.equal(fs.existsSync(dir), false, 'the directory is gone');
  assert.equal(out.branchDeleted, true);
  assert.doesNotMatch(git('worktree', 'list'), /fix-gone-registration/);
});
