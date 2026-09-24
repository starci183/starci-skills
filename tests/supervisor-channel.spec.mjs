import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { appendInbox, readInbox, registerSupervisor, takeInbox } from '../scripts/connectors/telegram-bridge.mjs';
import { replyToOwner, splitText, waitForInbox, waitLine, drainRefusal, WAIT_TIMEOUT_EXIT } from '../scripts/supervisor/channel.mjs';
import { openSupervisorLedger } from '../scripts/supervisor/home.mjs';

// scripts/supervisor/channel.mjs is the supervisor's side of the Telegram command bridge: register /
// heartbeat, read the inbox the bridge fills, reply through the bot, and a `wait` a Monitor can run.

const ROOT = path.resolve(import.meta.dirname, '..');
const CHANNEL = path.join(ROOT, 'scripts', 'supervisor', 'channel.mjs');
const TOKEN = '123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop';
const tmp = (t, prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const cliEnv = (home) => ({ ...process.env, LOCALAPPDATA: home, STARCI_CONNECTORS_OFF: '1' });
const cli = (home, args) => spawnSync(process.execPath, [CHANNEL, ...args], { cwd: ROOT, env: cliEnv(home), encoding: 'utf8', windowsHide: true, timeout: 30000 });
const SETTINGS = { ready: true, token: TOKEN, chatId: '4242', language: 'vi' };

async function fakeBot(t, { fail = null } = {}) {
  const bot = { sent: [], nextId: 900 };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const payload = body ? JSON.parse(body) : {};
      res.writeHead(fail ? fail.status : 200, { 'content-type': 'application/json' });
      if (fail) return res.end(JSON.stringify(fail.json));
      bot.sent.push(payload);
      res.end(JSON.stringify({ ok: true, result: { message_id: bot.nextId++ } }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }));
  bot.apiBase = `http://127.0.0.1:${server.address().port}`;
  return bot;
}

test('register and heartbeat record the supervisor and report the bridge; inbox prints unread messages and marks them read', (t) => {
  const home = tmp(t, 'starci-channel-cli-');
  const reg = cli(home, ['register', '--id', 'sup-a', '--label', 'Alpha sup', '--repos', 'D:/a, D:/b']);
  assert.equal(reg.status, 0, reg.stderr);
  const answer = JSON.parse(reg.stdout);
  assert.deepEqual([answer.supervisor.id, answer.supervisor.label, answer.supervisor.repos], ['sup-a', 'Alpha sup', ['D:/a', 'D:/b']]);
  assert.equal(answer.bridge.skipped, 'STARCI_CONNECTORS_OFF', 'register ensures the bridge (here: connectors off)');
  const beat = cli(home, ['heartbeat', '--id', 'sup-a']);
  assert.equal(beat.status, 0, beat.stderr);
  assert.equal(JSON.parse(beat.stdout).unread, 0);
  assert.equal(cli(home, ['heartbeat', '--id', 'nobody']).status, 1, 'an unregistered heartbeat fails');
  assert.equal(cli(home, ['inbox', '--id', '../x']).status, 2, 'a bad id is refused');

  const env = { LOCALAPPDATA: home };
  appendInbox('sup-a', { chatId: '4242', messageId: 11, text: 'first ask' }, { env });
  appendInbox('sup-a', { chatId: '4242', messageId: 12, text: 'second\nline' }, { env });
  const peek = JSON.parse(cli(home, ['inbox', '--id', 'sup-a', '--json', '--peek']).stdout);
  assert.deepEqual(peek.messages.map((m) => m.text), ['first ask', 'second\nline']);
  assert.equal(readInbox('sup-a', env).filter((m) => !m.read).length, 2, '--peek leaves them unread');
  const read = cli(home, ['inbox', '--id', 'sup-a']);
  assert.match(read.stdout, /first ask/);
  assert.match(read.stdout, /second\nline/);
  assert.equal(readInbox('sup-a', env).filter((m) => !m.read).length, 0, 'reading marks them read');
  assert.match(cli(home, ['inbox', '--id', 'sup-a']).stdout, /no unread Telegram messages for sup-a/);
  assert.deepEqual(JSON.parse(cli(home, ['inbox', '--id', 'sup-a', '--json']).stdout).messages, []);
});

test('reply prefixes the label, answers the inbox message it names, splits long text, and never leaks the token', async (t) => {
  const home = tmp(t, 'starci-channel-reply-');
  const env = { LOCALAPPDATA: home };
  registerSupervisor({ id: 'sup-a', label: 'Alpha' }, { env });
  const item = appendInbox('sup-a', { chatId: '4242', messageId: 31, text: 'status of auth?' }, { env });
  const bot = await fakeBot(t);
  const deps = { env, settings: SETTINGS, apiBase: bot.apiBase, sleepImpl: async () => {} };
  const r = await replyToOwner({ id: 'sup-a', text: 'Auth is at UAT.', to: item.id }, deps);
  assert.deepEqual([r.ok, r.parts, r.replyTo], [true, 1, 31]);
  assert.deepEqual([bot.sent[0].chat_id, bot.sent[0].text, bot.sent[0].reply_parameters.message_id], ['4242', '[Alpha] Auth is at UAT.', 31]);
  assert.equal(readInbox('sup-a', env)[0].read, true, 'the answered message is marked read');

  const long = Array.from({ length: 300 }, (_, i) => `line ${i} ${'x'.repeat(30)}`).join('\n');
  const split = await replyToOwner({ id: 'sup-a', text: long }, deps);
  assert.equal(split.ok, true);
  assert.ok(split.parts >= 3);
  const parts = bot.sent.slice(1);
  assert.equal(parts.length, split.parts);
  parts.forEach((p, i) => { assert.ok(p.text.startsWith(`[Alpha] (${i + 1}/${parts.length}) `)); assert.ok(p.text.length <= 3900); assert.equal(p.reply_parameters, undefined); });
  assert.equal(parts.map((p) => p.text.replace(/^\[Alpha\] \(\d+\/\d+\) /, '')).join('\n'), long, 'nothing is lost across parts');

  assert.equal((await replyToOwner({ id: 'sup-a', text: 'x', to: 'no-such-item' }, deps)).ok, false);
  assert.equal((await replyToOwner({ id: 'sup-a', text: 'x' }, { ...deps, settings: { ready: false, warning: 'telegram off' } })).error, 'telegram off');
  const failing = await fakeBot(t, { fail: { status: 400, json: { ok: false, description: `Bad Request: chat not found for bot${TOKEN}` } } });
  const bad = await replyToOwner({ id: 'sup-a', text: 'x' }, { ...deps, apiBase: failing.apiBase });
  assert.equal(bad.ok, false);
  assert.ok(!JSON.stringify(bad).includes(TOKEN) && !JSON.stringify(bad).includes('AAFakeToken'), JSON.stringify(bad));
  const down = await replyToOwner({ id: 'sup-a', text: 'x' }, { ...deps, apiBase: 'http://127.0.0.1:1' });
  assert.ok(!down.ok && !JSON.stringify(down).includes(TOKEN));
});

test('splitText keeps every character and prefers line breaks', () => {
  assert.deepEqual(splitText('short'), ['short']);
  const text = `${'a'.repeat(60)}\n${'b'.repeat(60)}`;
  assert.deepEqual(splitText(text, 80), ['a'.repeat(60), 'b'.repeat(60)]);
  assert.deepEqual(splitText('c'.repeat(250), 100).map((p) => p.length), [100, 100, 50]);
});

test('wait blocks until a message arrives, prints one TELEGRAM line per unread message and exits 0; it times out with 124', async (t) => {
  const home = tmp(t, 'starci-channel-wait-');
  const env = { LOCALAPPDATA: home };
  registerSupervisor({ id: 'sup-w', label: 'W' }, { env });
  const child = spawn(process.execPath, [CHANNEL, 'wait', '--id', 'sup-w', '--timeout-ms', '20000'], { cwd: ROOT, env: cliEnv(home), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { try { child.kill(); } catch { /* gone */ } });
  let out = '';
  child.stdout.on('data', (c) => { out += c; });
  const exited = new Promise((resolve) => child.on('exit', resolve));
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(child.exitCode, null, 'nothing unread: still waiting');
  const item = appendInbox('sup-w', { chatId: '4242', messageId: 5, text: `please\nrestart ${'y'.repeat(300)}` }, { env });
  assert.equal(await exited, 0);
  assert.equal(out.trim(), `TELEGRAM ${item.id}: please restart ${'y'.repeat(300)}`.slice(0, `TELEGRAM ${item.id}: `.length + 200));
  assert.equal(readInbox('sup-w', env)[0].read, false, 'wait does not mark read; inbox does');

  // Already unread: returns at once. Nothing unread and a short timeout: exit 124.
  assert.equal(cli(home, ['wait', '--id', 'sup-w', '--timeout-ms', '5000']).status, 0);
  takeInbox('sup-w', { env });
  const timeout = cli(home, ['wait', '--id', 'sup-w', '--timeout-ms', '200']);
  assert.equal(timeout.status, WAIT_TIMEOUT_EXIT);
  assert.equal(timeout.stdout.trim(), '');
});

test('waitForInbox resolves from the interval fallback too, and waitLine flattens the text', async (t) => {
  const home = tmp(t, 'starci-channel-waitfn-');
  const env = { LOCALAPPDATA: home };
  const pending = waitForInbox('sup-x', { env, intervalMs: 20, timeoutMs: 5000 });
  setTimeout(() => appendInbox('sup-x', { chatId: '1', messageId: 1, text: 'a\n b' }, { env }), 50);
  const items = await pending;
  assert.equal(items.length, 1);
  assert.equal(waitLine(items[0]), `TELEGRAM ${items[0].id}: a b`);
  assert.equal(await waitForInbox('sup-none', { env, timeoutMs: 50 }), null);
});

test("inbox for 'main' drains only from the seat terminal; --peek and other ids stay open", (t) => {
  const home = tmp(t, 'starci-channel-seat-');
  const supHome = path.join(home, 'suphome');
  const env = { LOCALAPPDATA: home, STARCI_SUPERVISOR_HOME: supHome };
  // The channel record knows the terminal it was registered from; the ledger seat wins when set.
  registerSupervisor({ id: 'main', label: 'Supervisor', terminal: 'term_seat' }, { env });
  appendInbox('main', { chatId: '4242', messageId: 7, text: 'owner ask' }, { env });
  const cliMain = (args, terminal = null) => spawnSync(process.execPath, [CHANNEL, ...args], {
    cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...cliEnv(home), STARCI_SUPERVISOR_HOME: supHome, ORCA_TERMINAL_HANDLE: terminal ?? '' },
  });

  // Not the seat: refused with exit 1, and no message is marked read (2026-09-24: a desktop
  // session ran `inbox --id main` and consumed 12 supervisor messages).
  const noTerminal = cliMain(['inbox', '--id', 'main']);
  assert.equal(noTerminal.status, 1);
  assert.match(noTerminal.stderr, /seat/);
  const wrong = cliMain(['inbox', '--id', 'main'], 'term_other');
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /term_seat/);
  assert.equal(readInbox('main', env).filter((m) => !m.read).length, 1, 'a refused inbox leaves every message unread');

  // --peek stays open to all and marks nothing.
  const peek = cliMain(['inbox', '--id', 'main', '--json', '--peek']);
  assert.equal(peek.status, 0, peek.stderr);
  assert.equal(JSON.parse(peek.stdout).messages.length, 1);
  assert.equal(readInbox('main', env).filter((m) => !m.read).length, 1, '--peek never marks read');

  // While the seat names a different terminal, the seat's terminal wins over the registered one.
  const ledger = openSupervisorLedger({ env });
  ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('supervisor-seat','main',?,?,?,?,NULL)")
    .run(process.pid, 'tok', JSON.stringify({ terminal: 'term_real_seat' }), Date.now());
  ledger.close();
  assert.equal(cliMain(['inbox', '--id', 'main'], 'term_seat').status, 1, 'a stale registered terminal no longer drains');
  const drained = cliMain(['inbox', '--id', 'main', '--json'], 'term_real_seat');
  assert.equal(drained.status, 0, drained.stderr);
  assert.equal(JSON.parse(drained.stdout).messages.length, 1);
  assert.equal(readInbox('main', env).filter((m) => !m.read).length, 0, 'the seat terminal drains');

  // Other ids keep the open rules; drainRefusal itself says why.
  appendInbox('sup-b', { chatId: '4242', messageId: 8, text: 'x' }, { env });
  assert.equal(cliMain(['inbox', '--id', 'sup-b', '--json']).status, 0);
  assert.equal(drainRefusal({ id: 'sup-b', terminal: null, env }), null);
  assert.match(drainRefusal({ id: 'main', terminal: null, seatTerminal: null, registeredTerminal: null, env }) ?? '', /no \[Supervisor\] seat terminal/);
});

test('unknown flags are an error for inbox, reply and register — a stray --help never consumes the inbox', (t) => {
  const home = tmp(t, 'starci-channel-flags-');
  const env = { LOCALAPPDATA: home };
  registerSupervisor({ id: 'sup-f', label: 'F' }, { env });
  appendInbox('sup-f', { chatId: '4242', messageId: 3, text: 'still unread' }, { env });
  const bad = cli(home, ['inbox', '--id', 'sup-f', '--help']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown flag.*--help/);
  assert.equal(readInbox('sup-f', env).filter((m) => !m.read).length, 1, 'the unknown flag aborted before the read');
  assert.equal(cli(home, ['inbox', '--id', 'sup-f', '--bogus']).status, 2);
  assert.equal(cli(home, ['reply', '--id', 'sup-f', '--text', 'x', '--wat']).status, 2);
  assert.equal(cli(home, ['register', '--id', 'sup-g', '--label', 'G', '--bogus']).status, 2);
  assert.equal(cli(home, ['inbox', '--id', 'sup-f', '--json', '--peek']).status, 0, 'the declared flags still work');
});
