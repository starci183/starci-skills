// config.yaml supervisor.mode chat (the default; owner, 2026-09-25: "move the supervisor into chat so it stays persistent"):
// the owner's desktop chat is the Supervisor again (modules/supervisor/supervise.yaml chatSeat, docs/supervisor.md).
// The chat registers and drains channel 'main' with no Orca terminal; every other reader peeks. Nothing starts a
// [Supervisor] kernel: start-supervisor answers chat-mode, and the supervisor
// watchdog loop exits cleanly (also while the seat is DISABLED). Every spec runs on a temp LOCALAPPDATA and a temp
// supervisor home: no Orca, no agent, no network, never the live runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateConfig } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { getSupervisor, registerSupervisor } from '../../scripts/supervisor/telegram-bridge.mjs';
import { appendInbox, readInbox, readOutbox } from '../../scripts/machine/sup-messages.mjs';
import { drainRefusal, registrationRefusal, replyToOwner } from '../../scripts/supervisor/channel.mjs';
import { supervisorMode, supervisorSettings } from '../../scripts/machine/home.mjs';
import { launchSupervisor, CHAT_MODE_REASON } from '../../scripts/supervisor/start-supervisor.mjs';
import { watchdogPass } from '../../scripts/supervisor/supervisor-watchdog.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CHANNEL = path.join(ROOT, 'scripts', 'supervisor', 'channel.mjs');
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* a ledger handle closes after this hook */ } });
  return dir;
};
const envOf = (t, mode = 'chat') => { const root = tmp(t, 'sup-chat-'); return { LOCALAPPDATA: path.join(root, 'la'), STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite'), STARCI_LANES_ROOT: path.join(root, 'lanes'), STARCI_SUPERVISOR_MODE: mode }; };
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
