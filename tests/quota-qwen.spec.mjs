import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as qwen from '../scripts/api/quota/qwen.mjs';
import { probeQuota } from '../scripts/api/quota/index.mjs';
import { createBridge, bridgeText } from '../scripts/connectors/telegram-bridge.mjs';
import { renderQuotaLine, renderSupervisorBlock, renderBasePoolLine, basePoolState, supervisorStatusMessage } from '../scripts/supervisor/status-block.mjs';
import { openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { stringifyYaml, parseYaml } from '../engine/yaml.mjs';
import { validateConfig } from '../engine/config.mjs';

// Owner ruling 2026-09-24: Qwen is the base pool every task uses and it is cheap, so it is NOT metered.
// The quota probe is credential presence only (no ~/.qwen meter, no calibrations, no /qwen Telegram
// command); config.yaml quota.qwen stays valid and only its resetAt is read - by the quota circuit.
// /status shows Qwen as the base pool with its provider-health circuit state.

const tmp = (t, prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };

const PLAN = {
  planQuota: 180000, unit: 'requests',
  resetAt: '2026-10-11T23:00:00+07:00',
  calibratedRemainingPercent: 86.6, calibratedAt: '2026-09-24T20:35:50+07:00',
};
const CFG = { quota: { qwen: PLAN } };
const NOW = Date.parse('2026-09-24T22:00:00+07:00');
const CRED = { BAILIAN_TOKEN_PLAN_API_KEY: 'spec-key' };

/** A ~/.qwen with Qwen Code telemetry the old meter read: it must now be ignored. */
function meteredHome(t) {
  const home = tmp(t, 'starci-qwen-home-');
  fs.mkdirSync(path.join(home, 'usage'), { recursive: true });
  fs.writeFileSync(path.join(home, 'usage', 'token-usage-2026-09.jsonl'),
    `${JSON.stringify({ timestamp: new Date(NOW - 60000).toISOString(), model: 'deepseek-v4.1-flash', inputTokens: 10, outputTokens: 1, totalTokens: 11 })}\n`);
  fs.writeFileSync(path.join(home, 'usage_record.jsonl'), `${JSON.stringify({ timestamp: NOW, models: { x: { requests: 5 } } })}\n`);
  return home;
}

test('the qwen module no longer meters or calibrates: no meter, no estimate, no calibration exports', () => {
  for (const gone of ['meterRecords', 'estimateQuota', 'recordCalibration', 'loadCalibrations', 'calibrationsFile', 'quotaStateDir'])
    assert.equal(qwen[gone], undefined, `${gone} is gone`);
  assert.deepEqual(Object.keys(qwen).sort(), ['nextResetAt', 'planWindow', 'probe', 'qwenPlan']);
});

test('the probe is credential presence only: dead without a key, ok with one, never a usedPercent', (t) => {
  const home = meteredHome(t);
  const r = qwen.probe({ env: CRED, home, config: CFG, now: NOW });
  assert.equal(r.state, 'ok');
  assert.equal(r.usedPercent, null, 'the base pool is not metered');
  assert.match(r.detail, /credential env present: BAILIAN_TOKEN_PLAN_API_KEY/);
  assert.doesNotMatch(r.detail, /metered \d|requests locally|% used|calibrat/i, 'telemetry under ~/.qwen is not read');
  assert.match(r.detail, /not metered/);
  assert.equal(r.resetsAt, new Date(Date.parse(PLAN.resetAt)).toISOString(), 'the next plan reset is still reported');

  const noCred = qwen.probe({ env: {}, home: tmp(t, 'starci-qwen-nh-'), config: CFG, now: NOW });
  assert.equal(noCred.state, 'dead');
  assert.match(noCred.detail, /no qwen credential env/);
  const dotenv = tmp(t, 'starci-qwen-dotenv-');
  fs.writeFileSync(path.join(dotenv, '.env'), 'DASHSCOPE_API_KEY=spec-dotenv\n');
  assert.equal(qwen.probe({ env: {}, home: dotenv, config: CFG, now: NOW }).state, 'ok', 'the .env file is a credential source too');
  // A spent-looking calibration in config no longer moves the probe: blocking is the quota circuit's job.
  assert.equal(qwen.probe({ env: CRED, home, config: { quota: { qwen: { ...PLAN, calibratedRemainingPercent: 0 } } }, now: NOW }).state, 'ok');
  assert.equal(qwen.probe({ env: CRED, home, config: {}, now: NOW }).resetsAt, null);
});

test('probeQuota("qwen-agent") forwards opts through the pinned interface', (t) => {
  const r = probeQuota('qwen-agent', { env: CRED, home: meteredHome(t), config: CFG, now: NOW });
  assert.deepEqual([r.state, r.usedPercent], ['ok', null]);
  assert.equal(typeof r.detail, 'string');
});

test('resetAt stays in use: the plan window rolls forward a month at a time', () => {
  const plan = qwen.qwenPlan(parseYaml(stringifyYaml(CFG)));
  assert.deepEqual(plan, { resetAt: Date.parse(PLAN.resetAt) });
  assert.equal(qwen.qwenPlan({}), null);
  assert.equal(qwen.qwenPlan({ quota: { qwen: { planQuota: 1 } } }), null, 'no resetAt, no plan');
  assert.equal(qwen.nextResetAt({ config: CFG, now: NOW }), Date.parse(PLAN.resetAt));
  const after = Date.parse('2026-10-12T00:00:00+07:00');
  assert.equal(qwen.nextResetAt({ config: CFG, now: after }), Date.parse('2026-11-11T23:00:00+07:00'));
  assert.equal(qwen.planWindow(Date.parse(PLAN.resetAt), after).start, Date.parse('2026-10-11T23:00:00+07:00'));
  assert.equal(qwen.nextResetAt({ config: {}, now: NOW }), null);
});

test('the config validator still accepts every documented quota.qwen field', () => {
  const base = parseYaml(fs.readFileSync(new URL('../config.example.yaml', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => validateConfig({ ...base, quota: CFG.quota }));
  assert.doesNotThrow(() => validateConfig({ ...base, quota: { qwen: { planQuota: 1, resetAt: PLAN.resetAt } } }));
  assert.throws(() => validateConfig({ ...base, quota: { qwen: { resetAt: PLAN.resetAt, meter: 'x' } } }), /quota\.qwen/);
});

/* ---------------------------------------------------------- /qwen is gone */

const OWNER = 4242;
let seq = 1;
const tgMessage = (text) => ({
  update_id: seq++, message: { message_id: seq + 1000, date: Math.floor(NOW / 1000), chat: { id: OWNER, type: 'private' }, from: { id: OWNER, is_bot: false }, text },
});

test('/qwen is no longer a Telegram command and no help text offers it', async (t) => {
  const sent = [];
  const home = tmp(t, 'starci-qwen-tg-');
  const bridge = createBridge({
    env: { LOCALAPPDATA: home }, apiBase: 'http://127.0.0.1:1', sleepImpl: async () => {}, timeoutS: 0, log: () => {},
    fetchImpl: async (_url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 77 } }) }; },
    settings: () => ({ ready: true, token: 'spec-token', chatId: String(OWNER), language: 'en' }),
  });
  const r = await bridge.handleUpdate(tgMessage('/qwen 80'));
  assert.deepEqual(r, { handled: 'message' });
  assert.match(sent.at(-1).text, /^Unknown command\./, '/qwen answers like any unknown command');
  assert.ok(!fs.existsSync(path.join(home, 'StarCi', 'quota')), 'nothing was recorded');
  for (const lang of ['en', 'vi']) {
    const text = bridgeText(lang);
    assert.doesNotMatch(text.help, /\/qwen/, `${lang} help`);
    for (const key of ['qwenUsage', 'qwenRecorded', 'qwenFailed']) assert.equal(text[key], undefined, `${lang}.${key}`);
  }
  const source = fs.readFileSync(new URL('../scripts/connectors/telegram-bridge.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /recordQwen|recordCalibration|\/qwen/);
});

/* ---------------------------------------------------------- /status: the base pool line */

test('the quota line never meters the base pool; other providers keep their numbers', () => {
  const quota = {
    qwen: { state: 'ok', usedPercent: 13.5, resetsAt: '2026-10-11T16:00:00.000Z' },
    devin: { state: 'limited', usedPercent: 91, resetsAt: '2026-09-25T00:00:00.000Z' },
    claude: { state: 'ok', usedPercent: null, detail: 'no window seen' },
  };
  const line = renderQuotaLine(quota, { language: 'en' });
  assert.match(line, /^📶 Quota: devin 91% used ⚠/);
  assert.doesNotMatch(line, /qwen/, 'the Qwen metering line is gone');
  assert.equal(renderQuotaLine({ qwen: quota.qwen }), null);
});

test('/status shows Qwen as the base pool with its circuit state across the product ledgers', (t) => {
  const now = Date.now();
  const ledgerWith = (value, expiresAt) => {
    const repo = tmp(t, 'starci-qwen-status-');
    const l = openLedger({ file: ledgerFileFor(repo) });
    try {
      if (value) l.db.prepare(`INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('provider-health','qwen',NULL,NULL,?,?,?)`)
        .run(JSON.stringify(value), now - 1000, expiresAt);
    } finally { l.close(); }
    return ledgerFileFor(repo);
  };
  const config = { allocation: { shares: { 'qwen-agent': 40, 'claude-agent': 20, 'codex-agent': 20, 'devin-agent': 20 } } };
  const clean = [ledgerWith(null), ledgerWith({ status: 'recovered', failureKind: 'quota' }, now - 1)];
  const closed = basePoolState({ files: clean, config, now });
  assert.deepEqual([closed.pool, closed.model, closed.sharePercent, closed.ledgers, closed.open], ['qwen-agent', 'deepseek-v4.1-flash', 40, 2, []]);
  assert.equal(renderBasePoolLine(closed, { language: 'en', now }), '🟢 Base pool: qwen-agent (deepseek-v4.1-flash) · share 40% · circuit closed');
  assert.equal(renderBasePoolLine(closed, { language: 'vi', now }), '🟢 Pool nền: qwen-agent (deepseek-v4.1-flash) · tỉ trọng 40% · circuit đóng');

  const until = Date.parse('2099-01-15T01:00:00Z');
  const open = basePoolState({ files: [...clean, ledgerWith({ status: 'unavailable', failureKind: 'quota', observedAt: now - 5000,
    quotaProbe: { at: now - 12 * 60000, state: 'quota-exhausted' } }, until)], config, now });
  assert.equal(open.open.length, 1);
  const line = renderBasePoolLine(open, { language: 'en', now });
  assert.equal(line, '⛔ Base pool: qwen-agent (deepseek-v4.1-flash) · share 40% · circuit OPEN (quota) in 1/3 ledger(s) until 01-15 01:00Z · last probe 12m ago (quota-exhausted)');

  const snap = { seat: null, enabled: true, ticks: [], board: { active: [], reported: [] }, pushes: [], lands: [] };
  const html = renderSupervisorBlock(snap, { language: 'en', base: open, now });
  assert.ok(html.includes(line), 'the block carries the base-pool line');
  assert.equal(renderSupervisorBlock(snap, { language: 'en' }).includes('Base pool'), false, 'no base state, no line');
  // The live message builds it itself; a spec run without a supervisor home stays silent.
  assert.equal(supervisorStatusMessage({ env: {}, base: open }), null);
});
