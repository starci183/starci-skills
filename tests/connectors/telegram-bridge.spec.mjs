import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  createBridge, ensureTelegramBridge, registerSupervisor, heartbeatSupervisor, listSupervisors, chatRoute, bridgeState, bridgeText, bridgeReloadFiles, BRIDGE_NAME, BRIDGE_FILE, ONLINE_MS,
} from '../../scripts/supervisor/telegram-bridge.mjs';
import { readInbox } from '../../scripts/machine/sup-messages.mjs';
import { claimManager, claimOrTakeOver, writeConnectorState } from '../../scripts/connectors/lib.mjs';
import { reexecSelf, RELOAD_ENV } from '../../scripts/machine/self-reload.mjs';
import { askKeyOf, readSentStore, textFor } from '../../scripts/connectors/telegram.mjs';
import { ledgerResolver } from '../../scripts/connectors/ask-gateway.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { collectProgress, progressMessages } from '../../scripts/supervisor/progress-report.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

// The owner commands a supervisor by chatting with the Telegram bot (docs/connectors.md "Command
// bridge"). Every spec runs on a fake Bot API server and a temp home whose machine.sqlite holds the bridge's
// state: no network, no real bot.

const TOKEN = '123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop';
const OWNER = 4242;
const EXAMPLE = parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
const withConnectors = (connectors, language = 'vi') => ({ ...structuredClone(EXAMPLE), language, connectors });
const tmp = (t, prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };

/** A fake Bot API: getUpdates serves `updates` from the requested offset; every call is recorded. */
async function fakeBot(t, { failGetUpdates = null } = {}) {
  const bot = { updates: [], calls: [], nextId: 500 };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url);
      const payload = body ? JSON.parse(body) : {};
      const reply = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      if (!m || m[1] !== TOKEN) return reply(404, { ok: false, description: 'Not Found' });
      bot.calls.push({ method: m[2], payload });
      if (m[2] === 'getUpdates') {
        if (failGetUpdates) return reply(failGetUpdates.status, failGetUpdates.json);
        const from = Number.isSafeInteger(payload.offset) ? payload.offset : -Infinity;
        return reply(200, { ok: true, result: bot.updates.filter((u) => u.update_id >= from) });
      }
      if (m[2] === 'sendMessage') return reply(200, { ok: true, result: { message_id: bot.nextId++, chat: { id: payload.chat_id }, text: payload.text } });
      return reply(200, { ok: true, result: true });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }));
  bot.apiBase = `http://127.0.0.1:${server.address().port}`;
  bot.sent = () => bot.calls.filter((c) => c.method === 'sendMessage').map((c) => c.payload);
  bot.of = (method) => bot.calls.filter((c) => c.method === method).map((c) => c.payload);
  return bot;
}

let seq = 1;
const message = (text, { chat = OWNER, from = OWNER, id = seq } = {}) => ({ update_id: seq++, message: { message_id: id + 1000, date: Math.floor(Date.now() / 1000), chat: { id: chat, type: 'private' }, from: { id: from, is_bot: false }, text } });
const callback = (data, { chat = OWNER, from = OWNER, messageId = 77 } = {}) => ({ update_id: seq++, callback_query: { id: `cb${seq}`, from: { id: from }, data, message: { message_id: messageId, chat: { id: chat } } } });

function setup(t, bot, { language = 'vi', ...extra } = {}) {
  const home = tmp(t, 'starci-tg-bridge-');
  const env = { LOCALAPPDATA: home };
  const logs = [];
  const make = () => createBridge({
    env, apiBase: bot.apiBase, sleepImpl: async () => {}, log: (line) => logs.push(line), timeoutS: 0,
    settings: () => ({ ready: true, token: TOKEN, chatId: String(OWNER), language }),
    statusMessages: () => progressMessages([], { now: Date.now() }), ...extra,
  });
  return { home, env, logs, make, bridge: make() };
}
const vi = bridgeText('vi');

test('an update whose chat or sender is not the owner is dropped and logged by numeric id only', async (t) => {
  const bot = await fakeBot(t);
  const { env, logs, bridge } = setup(t, bot);
  registerSupervisor({ id: 'sup-a', label: 'Alpha' }, { env });
  bot.updates.push(
    message('secret plan from a stranger', { chat: 999, from: 999 }),
    message('owner chat, foreign sender', { chat: OWNER, from: 777 }),
    message('foreign chat, owner sender', { chat: -100123, from: OWNER }),
    callback('sup:sup-a', { from: 777 }),
    { update_id: seq++, message: null },
    { update_id: seq++, edited_message: { text: 'x' } },
  );
  const r = await bridge.pollOnce();
  assert.equal(r.ok, true);
  assert.equal(bot.sent().length, 0, 'nothing is answered');
  assert.equal(bot.of('answerCallbackQuery').length, 0);
  assert.deepEqual(readInbox('sup-a', env), [], 'nothing reaches a supervisor');
  assert.equal(logs.filter((l) => /^dropped /.test(l)).length, 4);
  assert.ok(logs.some((l) => /from chat 999 user 999/.test(l)));
  assert.ok(!logs.join('\n').match(/secret|stranger|foreign/), 'message text is never logged');
});

test('/choose shows one button per supervisor with its online state; the callback routes and releases the held message', async (t) => {
  const bot = await fakeBot(t);
  const { env, bridge } = setup(t, bot);
  registerSupervisor({ id: 'sup-a', label: 'Alpha', repos: ['r/a'] }, { env });
  registerSupervisor({ id: 'sup-b', label: 'Beta' }, { env, now: Date.now() - ONLINE_MS - 60_000 });
  assert.deepEqual(listSupervisors({ env }).map((s) => [s.id, s.online]), [['sup-a', true], ['sup-b', false]]);

  bot.updates.push(message('/choose'));
  await bridge.pollOnce();
  const chooser = bot.sent().at(-1);
  assert.equal(chooser.text, vi.chooser, 'replies follow config language');
  assert.deepEqual(chooser.reply_markup.inline_keyboard, [[{ text: '🟢 Alpha', callback_data: 'sup:sup-a' }], [{ text: '⚪ Beta', callback_data: 'sup:sup-b' }]]);

  // A plain message with no route and two supervisors is held, and the chooser comes back.
  bot.updates.push(message('deploy the fix please'));
  await bridge.pollOnce();
  assert.equal(readInbox('sup-a', env).length + readInbox('sup-b', env).length, 0, 'held, not delivered');
  assert.match(bot.sent().at(-1).text, new RegExp(vi.held));
  assert.equal(chatRoute(OWNER, env).pending.length, 1);

  const before = bot.sent().length;
  bot.updates.push(callback('sup:sup-b', { messageId: 88 }));
  await bridge.pollOnce();
  assert.equal(bot.of('answerCallbackQuery').length, 1);
  const edit = bot.of('editMessageText').at(-1);
  assert.deepEqual([edit.message_id, edit.text], [88, vi.talking('Beta')]);
  assert.equal(chatRoute(OWNER, env).supervisorId, 'sup-b');
  assert.deepEqual(chatRoute(OWNER, env).pending, []);
  const inbox = readInbox('sup-b', env);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].text, 'deploy the fix please');
  const ack = bot.sent().slice(before).at(-1);
  assert.equal(ack.reply_parameters.message_id, inbox[0].messageId, 'the ack replies to the owner message');
  assert.equal(ack.text, `${vi.forwarded('Beta')}\n${vi.offline}`, 'an offline supervisor is said to be offline');

  // The route holds: the next message goes straight to Beta; /choose marks the current one.
  bot.updates.push(message('and the docs'));
  await bridge.pollOnce();
  assert.equal(readInbox('sup-b', env).length, 2);
  bot.updates.push(message('/choose@StarCiBot'));
  await bridge.pollOnce();
  assert.deepEqual(bot.sent().at(-1).reply_markup.inline_keyboard.map((row) => row[0].text), ['🟢 Alpha', '⚪ Beta ✓']);

  // A button for a supervisor that is gone is answered, and routes nothing.
  bot.updates.push(callback('sup:sup-gone'));
  await bridge.pollOnce();
  assert.equal(bot.of('answerCallbackQuery').at(-1).text, vi.gone);
  assert.equal(chatRoute(OWNER, env).supervisorId, 'sup-b');
});

test('with exactly one supervisor a message auto-routes; the inbox item and the ack have their shape', async (t) => {
  const bot = await fakeBot(t);
  const { env, bridge } = setup(t, bot, { language: 'en' });
  registerSupervisor({ id: 'solo', label: 'Solo sup' }, { env });
  bot.updates.push(message('check nivo auth'));
  await bridge.pollOnce();
  const [item] = readInbox('solo', env);
  assert.match(item.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual([item.chatId, item.text, item.read, typeof item.at, Number.isInteger(item.messageId)], [String(OWNER), 'check nivo auth', false, 'string', true]);
  assert.equal(chatRoute(OWNER, env).supervisorId, 'solo');
  const ack = bot.sent().at(-1);
  assert.equal(ack.text, '📥 Forwarded to Solo sup.', 'en when config language is en; online adds no note');
  assert.equal(ack.reply_parameters.message_id, item.messageId);

  // With no supervisor at all, a message is held and the owner is told so.
  const bot2 = await fakeBot(t);
  const other = setup(t, bot2);
  bot2.updates.push(message('anyone there?'));
  await other.bridge.pollOnce();
  assert.equal(bot2.sent().at(-1).text, vi.heldNone);
  assert.equal(chatRoute(OWNER, other.env).pending.length, 1);
  registerSupervisor({ id: 'late', label: 'Late' }, { env: other.env });
  bot2.updates.push(callback('sup:late'));
  await other.bridge.pollOnce();
  assert.deepEqual(readInbox('late', other.env).map((i) => i.text), ['anyone there?'], 'the held message reaches the first supervisor picked');
});

test('the offset is persisted before handling, so a restarted bridge never redelivers', async (t) => {
  const bot = await fakeBot(t);
  const { env, make, bridge } = setup(t, bot);
  registerSupervisor({ id: 'solo', label: 'Solo' }, { env });
  const a = message('one'), b = message('two');
  bot.updates.push(a, b);
  await bridge.pollOnce();
  assert.equal(bridgeState(env).offset, b.update_id + 1);
  const restarted = make();
  await restarted.pollOnce();
  assert.equal(bot.of('getUpdates').at(-1).offset, b.update_id + 1, 'the new bridge asks from the stored offset');
  assert.deepEqual(bot.of('getUpdates').at(-1).allowed_updates, ['message', 'callback_query']);
  assert.deepEqual(readInbox('solo', env).map((i) => i.text), ['one', 'two'], 'each message once');
});

test('/status answers from the bridge itself with the progress report, with no supervisor registered', async (t) => {
  const bot = await fakeBot(t);
  const empty = tmp(t, 'starci-tg-status-');
  const { bridge } = setup(t, bot, { statusMessages: () => progressMessages(collectProgress([empty], { config: {} })) });
  bot.updates.push(message('/status'));
  await bridge.pollOnce();
  const [report] = bot.sent();
  assert.equal(report.parse_mode, 'HTML');
  assert.match(report.text, /B\u00e1o c\u00e1o ti\u1ebfn \u0111\u1ed9/);
  bot.updates.push(message('/help'));
  await bridge.pollOnce();
  assert.equal(bot.sent().at(-1).text, vi.help);
  assert.match(vi.help, /\/choose/);
  assert.doesNotMatch(vi.help, /\/chon\b/, 'command names are English');
  // A report that cannot be built is said plainly; the bridge keeps going.
  const broken = setup(t, bot, { statusMessages: () => { throw Error('ledger gone'); } });
  bot.updates.push(message('/status'));
  assert.equal((await broken.bridge.pollOnce()).ok, true);
  assert.equal(bot.sent().at(-1).text, vi.statusFailed);
});

test('the token never appears in a log line, an error or a stored file (machine.sqlite included)', async (t) => {
  const bot = await fakeBot(t, { failGetUpdates: { status: 502, json: { ok: false, description: `Bad Gateway for /bot${TOKEN}/getUpdates` } } });
  const { home, logs, bridge } = setup(t, bot);
  const failed = await bridge.pollOnce();
  assert.ok(failed.error && !failed.error.includes(TOKEN));
  const unreachable = setup(t, { apiBase: 'http://127.0.0.1:1' });
  const net = await unreachable.bridge.pollOnce();
  assert.ok(net.error && !net.error.includes(TOKEN));
  const all = [...logs, ...unreachable.logs, failed.error, net.error].join('\n');
  assert.ok(logs.length && !all.includes(TOKEN) && !all.includes('AAFakeToken'), all);
  const files = fs.readdirSync(home, { recursive: true }).map((f) => path.join(home, f)).filter((f) => fs.statSync(f).isFile());
  for (const f of files) assert.ok(!fs.readFileSync(f, 'utf8').includes(TOKEN), f);
});

test('run stops when telegram is not ready, when another bridge owns the updates, and backs off on errors', async (t) => {
  const bot = await fakeBot(t, { failGetUpdates: { status: 409, json: { ok: false, description: 'Conflict: terminated by other getUpdates request' } } });
  const off = setup(t, bot, { settings: () => ({ ready: false, warning: 'telegram: not notifying' }) });
  assert.deepEqual(await off.bridge.run({ maxRounds: 3 }), { stopped: 'telegram: not notifying' });

  const conflict = setup(t, bot);
  const claim = claimManager(BRIDGE_NAME, { env: conflict.env });
  assert.deepEqual(await conflict.bridge.run({ ownPid: process.pid + 1, maxRounds: 3 }), { stopped: 'another bridge polls this bot' });
  claim.release();

  const waits = [];
  const flaky = await fakeBot(t, { failGetUpdates: { status: 500, json: { ok: false, description: 'Internal' } } });
  const backoff = setup(t, flaky, { sleepImpl: async (ms) => { waits.push(ms); } });
  assert.deepEqual(await backoff.bridge.run({ maxRounds: 4 }), { stopped: 'rounds' });
  assert.deepEqual(waits.slice(0, 4), [1000, 2000, 4000, 8000]);
});

test('run hands the bridge to a replacement between rounds when the runtime changed (self-reload), like the watchdogs', async (t) => {
  const bot = await fakeBot(t);
  const { bridge, logs, env } = setup(t, bot);
  const asked = [];
  const reload = async () => { asked.push(bot.of('getUpdates').length); return asked.length === 3 ? 5151 : null; };
  assert.deepEqual(await bridge.run({ maxRounds: 10, reload }), { stopped: 'reloaded', reloaded: 5151 });
  assert.deepEqual(asked, [1, 2, 3], 'asked after every finished round, never before the first');
  assert.equal(bot.of('getUpdates').length, 3, 'no round is polled once the replacement holds the bridge');
  assert.ok(logs.some((l) => /replacement 5151 took the bridge over/.test(l)));
  const files = bridgeReloadFiles().map((f) => path.basename(f));
  for (const name of ['telegram-bridge.mjs', 'telegram.mjs', 'lib.mjs', 'self-reload.mjs']) assert.ok(files.includes(name), name);
  for (const file of bridgeReloadFiles()) assert.ok(fs.existsSync(file), file);

  const original = claimManager(BRIDGE_NAME, { env });
  assert.equal(original.ok, true);
  const replacement = claimOrTakeOver(BRIDGE_NAME, { from: process.pid, env });
  assert.deepEqual([replacement.ok, replacement.takenOver], [true, true], 'the replacement atomically takes the old bridge lock');
  replacement.release();

  let spawned = null;
  const handed = await reexecSelf({
    script: BRIDGE_FILE, args: ['run'], lockName: BRIDGE_NAME, env, selfPid: 4141, now: () => 1234,
    spawnChild: (request) => { spawned = request; return { pid: 5151, exited: () => false }; },
    holder: () => ({ pid: 5151 }), sleep: async () => {}, kill: () => assert.fail('a successful handover is never killed'),
    reclaim: () => assert.fail('a successful handover is never reclaimed'), log: () => {},
  });
  assert.deepEqual(handed, { ok: true, pid: 5151 });
  assert.deepEqual([spawned.script, spawned.args, spawned.env[RELOAD_ENV.handoverFrom], spawned.env[RELOAD_ENV.reloadedAt]],
    [BRIDGE_FILE, ['run'], '4141', '1234'], 'the replacement runs the bridge verb with explicit handover identity');
});

test('ensureTelegramBridge leaves a live bridge alone, skips when off or unregistered, and launches otherwise', (t) => {
  const home = tmp(t, 'starci-tg-ensure-');
  const env = { LOCALAPPDATA: home, STARCI_TELEGRAM_API_BASE: 'http://127.0.0.1:1' };
  const config = withConnectors({ telegram: { enabled: true, chatId: String(OWNER) }, cloudflare: { mode: 'off' } });
  const spawned = [];
  const spawn = (script, args) => { spawned.push([path.basename(script), ...args]); return 4321; };
  assert.equal(ensureTelegramBridge({ env: { ...env, STARCI_CONNECTORS_OFF: '1' }, config, root: home, spawn }).skipped, 'STARCI_CONNECTORS_OFF');
  assert.equal(ensureTelegramBridge({ env: { LOCALAPPDATA: home, NODE_TEST_CONTEXT: 'child' }, config, root: home, spawn }).skipped, 'test context', 'a spec never reaches the real Bot API');
  assert.match(ensureTelegramBridge({ env, config, root: home, spawn }).skipped, /bot token/, 'no token: telegram is not ready');
  const ready = { ...env, TELEGRAM_BOT_TOKEN: TOKEN };
  assert.equal(ensureTelegramBridge({ env: ready, config, root: home, spawn, requireRegistered: true }).skipped, 'no supervisor registered');
  assert.deepEqual(ensureTelegramBridge({ env: ready, config, root: home, spawn, dryRun: true }), { ok: true, wouldStart: true });
  assert.deepEqual(ensureTelegramBridge({ env: ready, config, root: home, spawn }), { ok: true, launched: 4321 });
  assert.deepEqual(spawned, [['telegram-bridge.mjs', 'run']]);
  const claim = claimManager(BRIDGE_NAME, { env: ready });
  assert.deepEqual(ensureTelegramBridge({ env: ready, config, root: home, spawn }), { ok: true, already: true, pid: process.pid });
  assert.equal(spawned.length, 1);
  assert.ok(!JSON.stringify(ensureTelegramBridge({ env: ready, config: withConnectors({ telegram: { token: TOKEN } }), root: home, spawn })).includes(TOKEN));
  claim.release();
});

test('the registry heartbeats, validates ids, and ignores files that are not supervisors', (t) => {
  const home = tmp(t, 'starci-tg-registry-');
  const env = { LOCALAPPDATA: home };
  const old = Date.now() - 2 * ONLINE_MS;
  registerSupervisor({ id: 'sup-a', label: '  ', repos: [' x ', ''] }, { env, now: old });
  let [sup] = listSupervisors({ env });
  assert.deepEqual([sup.label, sup.repos, sup.online], ['sup-a', ['x'], false]);
  heartbeatSupervisor('sup-a', { env });
  [sup] = listSupervisors({ env });
  assert.equal(sup.online, true);
  assert.equal(listSupervisors({ env, onlineMs: 1, now: Date.now() + 1000 })[0].online, false, 'the online window is overridable');
  assert.equal(heartbeatSupervisor('nobody', { env }), null);
  assert.throws(() => registerSupervisor({ id: '../evil', label: 'x' }, { env }), /supervisor id/);
  assert.throws(() => registerSupervisor({ id: 'x'.repeat(61), label: 'x' }, { env }), /supervisor id/);
  // A channel row that does not name its own id, one with a bad id, and a row that is no channel are not supervisors.
  writeConnectorState('supervisor-channel:broken', { config: { nope: true } }, env);
  writeConnectorState('supervisor-channel:../x', { config: { id: '../x', label: 'x' } }, env);
  writeConnectorState('telegram-route', { cursor: { chats: {} } }, env);
  assert.deepEqual(listSupervisors({ env }).map((s) => s.id), ['sup-a']);
});

/* ------------------------------------------------------------ owner asks on demand */
// Owner, 2026-09-24: "one response.starci.org link pointing at the questions, and serve a url only
// when asked! the bot tells on telegram, the form is served only when the Generate URL button is pressed. answered means deleted".

const WF = 'wf-ask';
const seedAskReport = (ledger, { dispatchId, question }) => {
  if (!ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(WF)) seedWorkflow(ledger, { id: WF, state: { phase: 'running' } });
  const jobId=`ask-${dispatchId}`;
  seedWorkflow(ledger,{id:WF,jobs:[{jobId,opId:'provision.ask',status:'reported',dispatchId}]});
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
  ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF, attemptId, dispatchId, jobId, 'ask', JSON.stringify({ schema: 'starci/op-report@1', outcome: 'ask', summary: 'ask', question: { refs: [dispatchId], ...question } }), Date.now());
};
const askEvents = (ledger, kind) => ledger.db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(WF, kind).map((r) => JSON.parse(r.payload_json));
const exited = async (pid, ms = 30000) => {
  const alive = () => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
  for (const end = Date.now() + ms; alive();) { if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 100)); }
  return true;
};
const button = (key) => `ask:${key}`;

test('/asks lists every open approval ask of the ask repos, one message each with its own Generate URL button', async (t) => {
  const bot = await fakeBot(t);
  await withLedger(t, async ({ ledger, repoRoot }) => {
    seedAskReport(ledger, { dispatchId: 'ctx_a', question: { text: 'Ch\u1ecdn c\u1ed5ng thanh to\u00e1n?', options: ['VNPay', 'MoMo'] } });
    seedAskReport(ledger, { dispatchId: 'ctx_b', question: { text: 'T\u00ean mi\u1ec1n n\u00e0o?', options: [] } });
    seedAskReport(ledger, { dispatchId: 'ctx_done', question: { text: '\u0110\u00e3 xong?', options: [] } });
    ledger.appendEvent({ workflowId: WF, entityType: 'report', entityId: 'ctx_done', kind: 'ask-answered', payload: { dispatchId: 'ctx_done' } });
    const { env, bridge } = setup(t, bot, { repos: () => [repoRoot], sweepEveryMs: -1 });
    bot.updates.push(message('/asks'));
    await bridge.pollOnce();
    const [head, ...listed] = bot.sent();
    assert.equal(head.text, vi.asksHead(2));
    assert.equal(listed.length, 2, 'an answered ask is not listed');
    assert.deepEqual(listed.map((m) => m.reply_markup.inline_keyboard[0][0].callback_data).sort(), ['ctx_a', 'ctx_b'].map((d) => button(askKeyOf(WF, d))).sort());
    assert.ok(listed.every((m) => m.reply_markup.inline_keyboard[0][0].text === textFor('vi').generate));
    assert.ok(listed.some((m) => /Ch\u1ecdn c\u1ed5ng thanh to\u00e1n\?/.test(m.text) && /1\. VNPay\n2\. MoMo/.test(m.text)));
    assert.ok(listed.every((m) => !/https?:\/\//.test(m.text)), 'listing serves nothing, so it links nothing');
    assert.deepEqual(askEvents(ledger, 'ask-serving'), []);
    const store = readSentStore(env);
    assert.equal(store.asks[`${WF}|ctx_a`].messageIds.length, 1, 'the listed message is remembered, so it is deleted with the ask');
    assert.equal(store.asks[`${WF}|ctx_a`].repo, repoRoot);
    for (const d of ['ctx_a', 'ctx_b']) ledger.appendEvent({ workflowId: WF, entityType: 'report', entityId: d, kind: 'ask-answered', payload: { dispatchId: d } });
    bot.updates.push(message('/asks'));
    await bridge.pollOnce();
    assert.equal(bot.sent().at(-1).text, vi.asksNone);
    assert.match(vi.help, /\/asks/);
  });
});

test('the Generate URL button serves the form on demand and edits the message with the public link; the answer deletes it and stops serving', async (t) => {
  const bot = await fakeBot(t);
  await withLedger(t, async ({ ledger, repoRoot }) => {
    seedAskReport(ledger, { dispatchId: 'ctx_pick', question: { text: 'G\u00f3i Pro gi\u00e1 bao nhi\u00eau?', options: ['99k', '199k'] } });
    const ensured = [];
    const { env, bridge } = setup(t, bot, {
      repos: () => [repoRoot], serveTtlMs: 120000, sweepEveryMs: 0,
      ensureConnectors: () => { ensured.push(1); return { ok: true }; }, publicBaseOf: () => 'https://response.example.org',
    });
    const key = askKeyOf(WF, 'ctx_pick');
    bot.updates.push(callback(button(key), { messageId: 91 }));
    await bridge.pollOnce();
    const [serving] = askEvents(ledger, 'ask-serving');
    assert.ok(serving, 'the press served the form');
    t.after(() => { try { process.kill(serving.pid); } catch { /* exited */ } });
    assert.deepEqual([serving.onDemand, serving.requestedBy], [true, 'telegram'], 'the on-demand serve is recorded as such');
    assert.equal(bot.of('answerCallbackQuery')[0].text, vi.askGenerating, 'the press is answered at once');
    const nonce = new URL(serving.url).pathname.slice(1);
    const edit = bot.of('editMessageText').at(-1);
    assert.equal(edit.message_id, 91, 'the pressed message itself carries the link');
    assert.ok(edit.text.includes(`${textFor('vi').link}: https://response.example.org/${nonce}`));
    assert.match(edit.text, /G\u00f3i Pro gi\u00e1 bao nhi\u00eau\?/);
    assert.ok(!edit.text.includes('127.0.0.1'), 'a decision ask carries only the public link');
    assert.equal(edit.reply_markup.inline_keyboard[0][0].callback_data, button(key), 'the button stays: an expired link is regenerated');
    assert.equal(ensured.length, 1, 'the gateway and tunnel are ensured for a public link');
    assert.equal(ledgerResolver({ repos: () => [repoRoot] })(nonce)?.url, serving.url, 'response.<domain> routes the nonce while it serves');

    bot.updates.push(callback(button(key), { messageId: 91 }));
    await bridge.pollOnce();
    assert.equal(askEvents(ledger, 'ask-serving').length, 1, 'a second press reuses the live form');

    const res = await fetch(`${serving.url}/answer`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'option=1' });
    assert.equal(res.status, 200);
    assert.equal(await exited(serving.pid), true, 'the answered form stops serving');
    assert.equal(ledgerResolver({ repos: () => [repoRoot] })(nonce), null, 'and the gateway no longer routes it');
    await bridge.pollOnce();
    assert.ok(bot.of('deleteMessage').some((p) => p.message_id === 91), 'the answered ask\'s message is deleted');
    assert.deepEqual(readSentStore(env).asks[`${WF}|ctx_pick`].messageIds, []);
    assert.equal(readSentStore(env).asks[`${WF}|ctx_pick`].closed, 'answered');
  });
});

test('a credential ask\'s button gives the localhost link to answer on the machine; an ended form goes back to the button; a closed ask\'s button removes its message', async (t) => {
  const bot = await fakeBot(t);
  await withLedger(t, async ({ ledger, repoRoot }) => {
    seedAskReport(ledger, { dispatchId: 'ctx_key', question: { text: 'Nh\u1eadp vnpay-hash-secret.key', options: [] } });
    const url = 'http://127.0.0.1:6970/a-00112233445566778899';
    const spawned = [], ensured = [];
    const spawnServe = (target) => {
      spawned.push(target);
      ledger.appendEvent({ workflowId: WF, entityType: 'report', entityId: 'ctx_key', kind: 'ask-serving',
        payload: { dispatchId: 'ctx_key', url, pid: process.pid, fields: { files: ['vnpay-hash-secret.key'], vars: [] }, ttlMs: 3600000, onDemand: true, requestedBy: 'telegram' } });
      return process.pid;
    };
    const { bridge } = setup(t, bot, {
      repos: () => [repoRoot], spawnServe, sweepEveryMs: 0,
      ensureConnectors: () => { ensured.push(1); return { ok: true }; }, publicBaseOf: () => 'https://response.example.org',
    });
    const key = askKeyOf(WF, 'ctx_key');
    bot.updates.push(callback(button(key), { messageId: 92 }));
    await bridge.pollOnce();
    assert.deepEqual(spawned.map((s) => [s.repo, s.workflowId, s.dispatchId]), [[repoRoot, WF, 'ctx_key']]);
    let edit = bot.of('editMessageText').at(-1);
    assert.equal(edit.message_id, 92);
    assert.ok(edit.text.includes(textFor('vi').credential));
    assert.ok(edit.text.includes(url), 'the credential form is linked on localhost');
    assert.ok(!edit.text.includes('response.example.org'), 'never on the public host');
    assert.equal(ensured.length, 0, 'a credential ask never needs the tunnel');

    // The form ends (ttl): the sweep takes the dead link back off and keeps the button.
    ledger.appendEvent({ workflowId: WF, entityType: 'report', entityId: 'ctx_key', kind: 'ask-serving-expired', payload: { dispatchId: 'ctx_key' } });
    await bridge.pollOnce();
    edit = bot.of('editMessageText').at(-1);
    assert.equal(edit.message_id, 92);
    assert.ok(!edit.text.includes(url) && edit.text.includes(textFor('vi').generate), 'back to the Generate URL notice');
    assert.equal(edit.reply_markup.inline_keyboard[0][0].callback_data, button(key));

    // Retired meanwhile: its button removes the message instead of serving.
    ledger.appendEvent({ workflowId: WF, entityType: 'report', entityId: 'ctx_key', kind: 'ask-superseded', payload: { dispatchId: 'ctx_key', by: null, retired: true } });
    bot.updates.push(callback(button(key), { messageId: 93 }));
    await bridge.pollOnce();
    assert.equal(bot.of('answerCallbackQuery').at(-1).text, vi.askClosed);
    assert.ok(bot.of('deleteMessage').some((p) => p.message_id === 93));
    assert.equal(spawned.length, 1, 'nothing is served for a closed ask');
  });
});
