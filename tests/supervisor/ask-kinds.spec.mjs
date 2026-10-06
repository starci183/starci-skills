import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { askClassOf, isLiveProofOp, parkAsk } from '../../scripts/kernel/ask-server.mjs';
import { askKeyOf, notifyAsk } from '../../scripts/connectors/telegram.mjs';
import { bridgeAskRepos, bridgeText, createBridge } from '../../scripts/supervisor/telegram-bridge.mjs';
import { collectProgress, progressMessages } from '../../scripts/supervisor/progress-report.mjs';
import { stallFindings } from '../../scripts/supervisor/stall.mjs';
import { translator } from '../../scripts/lib/i18n.mjs';
// These specs exercise the owner-flow contract; autopilot (scripts/kernel/autopilot-run.mjs, owner ruling 2026-09-28) is
// on by default, so they run with it off - tests/kernel/autopilot.spec.mjs covers the autopilot flow.
process.env.STARCI_AUTOPILOT ??= 'off';

// Owner, 2026-09-25: "there are 2 ask kinds: ask for creds does not block the main line, uat only; ask
// for approval asks urgently. never merge the two into one". A credential ask holds only the live proof and is never pushed; an
// approval ask is pushed at once; the two never share a list or a message.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const TOKEN = '123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop';
const OWNER = 4242;
const EXAMPLE = parseYaml(fs.readFileSync(path.join(ROOT, 'config.example.yaml'), 'utf8'));
const json = (v) => JSON.stringify(v ?? null);
const tmp = (t, prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };

const VNPAY = { text: '\u0110\u1ec3 b\u1eadt thanh to\u00e1n VNPAY sandbox, nh\u1eadp Hash Secret v\u00e0o \u00f4 vnpay-hash-secret.key v\u00e0 m\u00e3 ng\u01b0\u1eddi b\u00e1n v\u00e0o VNPAY_TMN_CODE.', options: [] };
const PRICING = { text: 'Ch\u1ed1t gi\u00e1 g\u00f3i Pro?', options: ['99.000\u0111/th\u00e1ng', '199.000\u0111/th\u00e1ng'] };
const HANDOVER = { text: 'Duy\u1ec7t b\u00e0n giao? Stack d\u00f9ng postgres-password.key, redis-password.key v\u00e0 KEYCLOAK_ADMIN_PASSWORD.', options: ['Duy\u1ec7t', 'G\u00f3p \u00fd'] };

test('askClassOf: handover, draw review, options and declared decision kinds are approval; secret fields with no options or a credential kind are credential', () => {
  assert.equal(askClassOf({ opId: 'provision.ask', question: VNPAY }), 'credential', 'the VNPAY ask: custody file and env var, no options');
  assert.equal(askClassOf({ opId: 'handover.review', question: { ...HANDOVER, options: [] } }), 'approval', 'a handover naming custody files is still an approval');
  assert.equal(askClassOf({ opId: 'interface.draw', question: { kind: 'draw-review', text: 'Nh\u1eadn b\u1ea3n v\u1ebd? STRIPE_SECRET_KEY' } }), 'approval');
  assert.equal(askClassOf({ opId: 'business.decide', question: PRICING }), 'approval');
  assert.equal(askClassOf({ opId: 'business.decide', question: { text: 'D\u00f9ng REDIS_URL c\u0169 hay t\u1ea1o m\u1edbi?', options: ['C\u0169', 'M\u1edbi'] } }), 'approval', 'options make it a decision');
  assert.equal(askClassOf({ opId: 'provision.ask', question: { kind: 'credential', text: 'M\u00e3 MoMo', options: ['C\u00f3', 'Ch\u01b0a c\u00f3'] } }), 'credential', 'a declared credential kind wins');
  for (const kind of ['account', 'access', 'consent']) assert.equal(askClassOf({ question: { kind, text: 'x' } }), 'credential', kind);
  assert.equal(askClassOf({ opId: 'provision.ask', question: { kind: 'business-decision', text: 'MOMO_PARTNER_CODE?' } }), 'approval', 'a declared decision kind is an approval');
  assert.equal(askClassOf({ opId: 'provision.ask', question: { text: 'T\u00ean mi\u1ec1n n\u00e0o?', options: [] } }), 'approval', 'nothing secret: an approval');
  assert.equal(askClassOf({ question: { text: 'x', picks: [{ id: 'p', choices: ['A', 'B'] }] } }), 'approval');
  assert.equal(askClassOf({}), 'approval', 'an ask with no question is never hidden');
  assert.deepEqual(['integration.verify', 'e2e.verify', 'uat.verify', 'uat.assisted.prepare', 'uat.assisted.verify'].map(isLiveProofOp), [true, true, true, true, true]);
  assert.deepEqual(['backend.implement', 'interface.implement', 'review.verify', 'provision.ask'].map(isLiveProofOp), [false, false, false, false]);
});

/* ------------------------------------------------------------ parkAsk: push vs list */

const fakeBot = () => {
  const calls = []; let id = 100;
  const fetchImpl = async (url, init) => {
    calls.push({ method: url.split('/').pop(), body: init?.body ? JSON.parse(init.body) : null });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: ++id } }) };
  };
  return { calls, fetchImpl, sends: () => calls.filter((c) => c.method === 'sendMessage') };
};
const telegramConfig = () => ({ ...structuredClone(EXAMPLE), language: 'vi', connectors: { cloudflare: { mode: 'named', hostname: 'response.example.org' }, telegram: { enabled: true, chatId: String(OWNER) } } });
const seedAsk = (ledger, { workflowId, dispatchId, opId = 'provision.ask', question }) => {
  if (!ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId)) seedWorkflow(ledger, { id: workflowId, state: { phase: 'running' } });
  const jobId=`ask-${dispatchId}`;
  seedWorkflow(ledger,{id:workflowId,jobs:[{jobId,opId,status:'reported',dispatchId}]});
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
  ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(workflowId, attemptId, dispatchId, jobId, 'ask', JSON.stringify({ schema: 'starci/op-report@1', outcome: 'ask', summary: 'ask', question: { refs: [dispatchId], ...question } }), Date.now());
};

test('parkAsk pushes an approval ask at once and only lists a credential ask (ask-notified via creds, no message)', async (t) => {
  await withLedger(t, async ({ ledger, ledgerFile, machineHome, repoRoot }) => {
    seedAsk(ledger, { workflowId: 'wf-pay', dispatchId: 'ctx_vnpay', question: VNPAY });
    seedAsk(ledger, { workflowId: 'wf-pay', dispatchId: 'ctx_price', opId: 'business.decide', question: PRICING });
    const bot = fakeBot();
    const notify = (a) => notifyAsk(a, { config: telegramConfig(), env: { STARCI_LOCAL_ROOT: machineHome, TELEGRAM_BOT_TOKEN: TOKEN }, apiBase: 'http://bot.invalid', fetchImpl: bot.fetchImpl, sleepImpl: async () => {}, warn: () => {} });
    const report = (id) => ledger.db.prepare("SELECT r.*,a.op_id FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id='wf-pay' AND r.dispatch_id=?").get(id);
    const cred = await parkAsk({ ledger, ledgerFile, repo: repoRoot, workflowId: 'wf-pay', report: report('ctx_vnpay'), notify, close: async () => null });
    assert.deepEqual([cred.notified, cred.askClass, cred.telegram.listed], [true, 'credential', true]);
    assert.equal(bot.sends().length, 0, 'a credential ask is never pushed');
    const approval = await parkAsk({ ledger, ledgerFile, repo: repoRoot, workflowId: 'wf-pay', report: report('ctx_price'), notify, close: async () => null });
    assert.deepEqual([approval.notified, approval.askClass], [true, 'approval']);
    assert.equal(bot.sends().length, 1, 'an approval ask is pushed at once');
    assert.ok(bot.sends()[0].body.text.includes(PRICING.text));
    const notified = ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id='wf-pay' AND kind='ask-notified' ORDER BY seq").all().map((r) => JSON.parse(r.payload_json));
    assert.deepEqual(notified.map((p) => [p.dispatchId, p.via, p.askClass, p.messageId]),
      [['ctx_vnpay', 'creds', 'credential', null], ['ctx_price', 'telegram', 'approval', approval.telegram.messageId]]);
    assert.deepEqual(notified[0].fields, { files: ['vnpay-hash-secret.key'], vars: ['VNPAY_TMN_CODE'] });
  });
});

/* ------------------------------------------------------------ the frontier: a credential ask never holds the main line */

const runApi = (...args) => spawnSync(process.execPath, [API, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, STARCI_CONNECTORS_OFF: '1' } });
const seed = (repo, fn) => { const ledger = openLedger({ file: ledgerFileFor(repo) }); try { fn(ledger); } finally { ledger.close(); } };
const LEGS = ['request.analyze', 'business.decide', 'provision.ask', 'backend.implement', 'integration.verify', 'uat.verify'];
const seedPlan = (repo, wf) => seed(repo, (ledger) => {
  const at = Date.now();
  seedWorkflow(ledger,{id:wf,now:at,state:{phase:'running'},jobs:[{jobId:'bd-1',opId:'business.decide',status:'succeeded',result:{verdict:'pass'},createdAt:at}]});
  ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf, 0, 'g', '# goal', json({ opChain: { legs: LEGS }, derivedPlan: { legs: LEGS.map((op) => ({ op })), edges: LEGS.slice(1).map((op, i) => [LEGS[i], op]) } }), at);
});
const seedOwnerWait = (repo, wf, { jobId, opId, dispatchId, question }) => seed(repo, (ledger) => {
  const at = Date.now();
  seedWorkflow(ledger,{id:wf,jobs:[{jobId,opId,status:'awaiting_owner',dispatchId,result:{verdict:'awaiting-owner',askDispatchId:dispatchId},createdAt:at}]});
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
  ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,'ask',?,?,?)")
    .run(wf, attemptId, dispatchId, jobId, json({ outcome: 'ask', summary: 'ask', question }), at, at);
  ledger.appendEvent({ workflowId: wf, entityType: 'report', entityId: dispatchId, kind: 'ask-notified', payload: { dispatchId, onDemand: true, via: 'creds' } });
});
const frontierOf = (repo, wf) => { const r = runApi('status', '--repo', repo, '--workflow', wf, '--json'); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout).frontier; };

test('an unanswered credential ask never parks the main line: next-ready while a build leg is owed, awaiting-owner once only live proof is left', (t) => {
  const repo = tmp(t, 'starci-askkinds-'), wf = 'wf-askkinds-cred';
  seedPlan(repo, wf);
  seedOwnerWait(repo, wf, { jobId: 'pa-1', opId: 'provision.ask', dispatchId: 'ctx_vnpay', question: VNPAY });
  let f = frontierOf(repo, wf);
  assert.deepEqual([f.state, f.actionable, f.credentialAskDispatches, f.askOnDemandDispatches], ['next-ready', true, ['ctx_vnpay'], ['ctx_vnpay']],
    'backend.implement is owed: the credential ask does not hold it');
  assert.match(f.reason, /credential ask\(s\) ctx_vnpay hold only the live-proof legs: enqueue backend\.implement now with placeholder values/);
  assert.doesNotMatch(f.reason, /request\.analyze/, 'an intake leg with no job before the reached legs is never owed');
  seed(repo, (ledger) => {
    const at = Date.now();
    seedWorkflow(ledger,{id:wf,jobs:[{jobId:'bi-1',opId:'backend.implement',status:'succeeded',result:{verdict:'pass'},createdAt:at}]});
  });
  f = frontierOf(repo, wf);
  assert.deepEqual([f.state, f.actionable, f.credentialAskDispatches], ['awaiting-owner', false, ['ctx_vnpay']], 'only integration.verify and uat.verify are left: they wait on the value');
});

test('an unanswered approval ask still parks the frontier at awaiting-owner with a build leg owed', (t) => {
  const repo = tmp(t, 'starci-askkinds-'), wf = 'wf-askkinds-approval';
  seedPlan(repo, wf);
  seedOwnerWait(repo, wf, { jobId: 'bd-2', opId: 'business.decide', dispatchId: 'ctx_price', question: PRICING });
  const f = frontierOf(repo, wf);
  assert.deepEqual([f.state, f.actionable, f.credentialAskDispatches], ['awaiting-owner', false, []]);
});

/* ------------------------------------------------------------ Telegram: /asks, /creds */

async function botServer(t) {
  const bot = { calls: [], nextId: 500 };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url);
      const payload = body ? JSON.parse(body) : {};
      bot.calls.push({ method: m?.[2], payload });
      res.writeHead(200, { 'content-type': 'application/json' });
      if (m?.[2] === 'getUpdates') return res.end(JSON.stringify({ ok: true, result: [] }));
      if (m?.[2] === 'sendMessage') return res.end(JSON.stringify({ ok: true, result: { message_id: bot.nextId++ } }));
      return res.end(JSON.stringify({ ok: true, result: true }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }));
  bot.apiBase = `http://127.0.0.1:${server.address().port}`;
  bot.of = (method) => bot.calls.filter((c) => c.method === method).map((c) => c.payload);
  return bot;
}
let seq = 1;
const message = (text) => ({ update_id: seq++, message: { message_id: seq + 1000, date: Math.floor(Date.now() / 1000), chat: { id: OWNER, type: 'private' }, from: { id: OWNER }, text } });
const callback = (data, messageId) => ({ update_id: seq++, callback_query: { id: `cb${seq}`, from: { id: OWNER }, data, message: { message_id: messageId, chat: { id: OWNER } } } });
const bridgeFor = (t, bot, env, extra) => createBridge({
  env, apiBase: bot.apiBase, sleepImpl: async () => {}, timeoutS: 0, sweepEveryMs: -1,
  settings: () => ({ ready: true, token: TOKEN, chatId: String(OWNER), language: 'vi' }), ...extra,
});
const vi = bridgeText('vi');
const trv = translator('vi');
const WF = 'wf-ask';

test('/asks lists approval asks only, including one from a supervisor.repos repo outside the connector list; credential asks are one hint line', async (t) => {
  const bot = await botServer(t);
  await withLedger(t, async ({ ledger, repoRoot, machineHome }) => {
    seedAsk(ledger, { workflowId: WF, dispatchId: 'ctx_vnpay', question: VNPAY });
    seedAsk(ledger, { workflowId: WF, dispatchId: 'ctx_momo', question: { text: 'Nh\u1eadp momo-secret-key.key v\u00e0 MOMO_PARTNER_CODE', options: [] } });
    // The second handover lives in a product repo the connectors never listed: config supervisor.repos names it.
    const other = path.join(tmp(t, 'starci-askkinds-other-'), 'shop-be');
    fs.mkdirSync(path.join(other, '.starciwork'), { recursive: true });
    const otherLedger = openLedger({ file: ledgerFileFor(other) });
    try { seedAsk(otherLedger, { workflowId: 'wf-shop-work-and-stacks', dispatchId: 'ctx_handover', opId: 'handover.review', question: HANDOVER }); } finally { otherLedger.close(); }
    const env = { STARCI_LOCAL_ROOT: machineHome };
    const config = { ...structuredClone(EXAMPLE), connectors: { ...EXAMPLE.connectors, repos: [repoRoot] }, supervisor: { ...(EXAMPLE.supervisor ?? {}), repos: [other] } };
    const repos = bridgeAskRepos({ env, config });
    assert.ok(repos.includes(repoRoot) && repos.includes(other), `the ask repos cover the connector repos and supervisor.repos: ${repos.join(', ')}`);
    const bridge = bridgeFor(t, bot, env, { repos: () => bridgeAskRepos({ env, config }) });
    await bridge.handleUpdate(message('/asks'));
    const [head, ...listed] = bot.of('sendMessage');
    assert.equal(head.text, `${vi.asksHead(1)}\n${vi.credsHint(2)}`, 'one approval ask, and the credential asks only as a count');
    assert.equal(listed.length, 1);
    assert.match(listed[0].text, /Duy\u1ec7t b\u00e0n giao\?/);
    assert.equal(listed[0].reply_markup.inline_keyboard[0][0].callback_data, `ask:${askKeyOf('wf-shop-work-and-stacks', 'ctx_handover')}`);
    assert.ok(!bot.of('sendMessage').some((m) => /VNPAY|MoMo|momo/.test(m.text)), 'no credential ask is listed by /asks');
    assert.match(vi.help, /\/creds/);
    assert.match(bridgeText('en').help, /\/creds/);
  });
});

test('/creds batches every credential ask into ONE message with one button each; a press opens that ask in a new message and leaves the list', async (t) => {
  const bot = await botServer(t);
  await withLedger(t, async ({ ledger, repoRoot, machineHome }) => {
    seedAsk(ledger, { workflowId: WF, dispatchId: 'ctx_vnpay', question: VNPAY });
    seedAsk(ledger, { workflowId: WF, dispatchId: 'ctx_momo', question: { text: 'Nh\u1eadp momo-secret-key.key v\u00e0 MOMO_PARTNER_CODE', options: [] } });
    seedAsk(ledger, { workflowId: WF, dispatchId: 'ctx_price', opId: 'business.decide', question: PRICING });
    const url = 'http://127.0.0.1:6970/a-00112233445566778899';
    const spawnServe = ({ dispatchId }) => {
      ledger.appendEvent({ workflowId: WF, entityType: 'report', entityId: dispatchId, kind: 'ask-serving',
        payload: { dispatchId, url, pid: process.pid, fields: { files: ['vnpay-hash-secret.key'], vars: ['VNPAY_TMN_CODE'] }, ttlMs: 3600000, onDemand: true, requestedBy: 'telegram' } });
      return process.pid;
    };
    const bridge = bridgeFor(t, bot, { STARCI_LOCAL_ROOT: machineHome }, { repos: () => [repoRoot], spawnServe, publicBaseOf: () => null, ensureConnectors: () => ({ ok: true }) });
    await bridge.handleUpdate(message('/creds'));
    const sent = bot.of('sendMessage');
    assert.equal(sent.length, 1, 'one message for every credential ask');
    assert.match(sent[0].text, new RegExp(`^${vi.credsHead(2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(sent[0].text, /VNPAY/); assert.match(sent[0].text, /momo-secret-key\.key/);
    assert.ok(!sent[0].text.includes(PRICING.text.split('?')[0]), 'an approval ask is never in the credential list');
    const buttons = sent[0].reply_markup.inline_keyboard.map((row) => row[0].callback_data);
    assert.deepEqual(buttons.sort(), ['ctx_vnpay', 'ctx_momo'].map((d) => `cred:${askKeyOf(WF, d)}`).sort());
    await bridge.handleUpdate(callback(`cred:${askKeyOf(WF, 'ctx_vnpay')}`, 600));
    assert.equal(bot.of('editMessageText').length, 0, 'the list message stays as it is');
    const opened = bot.of('sendMessage').at(-1);
    assert.match(opened.text, /VNPAY/);
    assert.ok(opened.text.includes(url), 'the credential form opens on localhost, in its own message');
    assert.equal(opened.reply_markup.inline_keyboard[0][0].callback_data, `ask:${askKeyOf(WF, 'ctx_vnpay')}`);
    // Nothing waiting.
    for (const d of ['ctx_vnpay', 'ctx_momo']) ledger.appendEvent({ workflowId: WF, entityType: 'report', entityId: d, kind: 'ask-answered', payload: { dispatchId: d } });
    await bridge.handleUpdate(message('/creds'));
    assert.equal(bot.of('sendMessage').at(-1).text, vi.credsNone);
  });
});

/* ------------------------------------------------------------ no proactive push: the digest and /status */

test('stallFindings marks a workflow parked on credential asks alone credentialOnly', (t) => withLedger(t, ({ ledger, repoRoot }) => {
  const NOW = Date.now();
  seedWorkflow(ledger, { id: 'wf-pay', now: NOW - 600 * 60000, events: [{ kind: 'op-settled', payload: {}, created_at: NOW - 120 * 60000 }] });
  const status = (credentialAskDispatches, pending) => ({ ok: true, workers: [], awaitingOwner: pending.map((d) => ({ dispatchId: d, answer: 'pending' })),
    frontier: { state: 'awaiting-owner', actionable: false, queued: [], queuedCauses: {}, reason: 'owner', credentialAskDispatches } });
  const find = (s) => stallFindings(ledger.db, { repo: repoRoot, now: NOW, stallMinutes: 30, frontierOf: () => s }).find((f) => f.type === 'STALLED');
  const cred = find(status(['ctx_vnpay'], ['ctx_vnpay']));
  assert.deepEqual([cred.justifiedOwnerWait, cred.credentialOnly, cred.credentialAsks], [true, true, ['ctx_vnpay']]);
  const mixed = find(status(['ctx_vnpay'], ['ctx_vnpay', 'ctx_price']));
  assert.equal(mixed.credentialOnly, undefined, 'an approval ask pending too: the owner is told');
}));

test('/status lists approval asks and counts credential asks in one /creds line', (t) => withLedger(t, ({ ledger, repoRoot }) => {
  seedAsk(ledger, { workflowId: WF, dispatchId: 'ctx_vnpay', question: VNPAY });
  seedAsk(ledger, { workflowId: WF, dispatchId: 'ctx_price', opId: 'business.decide', question: PRICING });
  const text = progressMessages(collectProgress([repoRoot], { config: {} })).join('\n');
  assert.ok(text.includes(trv('❓ {count} question(s) waiting on you (/asks sends each with a link button)', { count: 1 })));
  assert.ok(text.includes(trv('🔑 {count} credential request(s) waiting, not blocking the main work: /creds', { count: 1 })));
  assert.ok(text.includes(PRICING.text));
  assert.doesNotMatch(text, /VNPAY/, 'a credential ask is never listed in the report');
}));
