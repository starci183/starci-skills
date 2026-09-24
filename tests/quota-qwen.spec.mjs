import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  probe, meterRecords, qwenPlan, planWindow, estimateQuota, recordCalibration, loadCalibrations, calibrationsFile,
} from '../scripts/api/quota/qwen.mjs';
import { probeQuota } from '../scripts/api/quota/index.mjs';
import { createBridge } from '../scripts/connectors/telegram-bridge.mjs';
import { renderQuotaLine, renderSupervisorBlock } from '../scripts/supervisor/status-block.mjs';
import { stringifyYaml, parseYaml } from '../engine/yaml.mjs';

// The qwen quota probe meters locally (Qwen Code telemetry under ~/.qwen),
// never touches the console's cookie + sec_token gateway, and compares against
// config.yaml quota.qwen. Owner calibrations (/qwen <remaining%>) land in the
// runtime state dir and teach the local-units -> plan-units ratio.

const tmp = (t, prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };

const PLAN = {
  planQuota: 180000, unit: 'requests',
  resetAt: '2026-10-11T23:00:00+07:00',             // window: 2026-09-11T23:00+07 -> 2026-10-11T23:00+07
  calibratedRemainingPercent: 86.6, calibratedAt: '2026-09-24T20:35:50+07:00',
};
const CFG = { quota: { qwen: PLAN } };
const T0 = Date.parse(PLAN.calibratedAt);          // the seed calibration instant
const WINDOW_START = Date.parse('2026-09-11T23:00:00+07:00');
const NOW = Date.parse('2026-09-24T22:00:00+07:00'); // ~1.4h after the seed
const CRED = { BAILIAN_TOKEN_PLAN_API_KEY: 'spec-key' };

/** A fake ~/.qwen: `pre` request records before T0, `post` between T0 and NOW (all inside the window). */
function qwenHome(t, { pre = 0, post = 0 } = {}) {
  const home = tmp(t, 'starci-qwen-home-');
  const usage = path.join(home, 'usage');
  fs.mkdirSync(usage, { recursive: true });
  const lines = [];
  for (let i = 0; i < pre; i += 1) {
    const at = new Date(WINDOW_START + 3600_000 + i * 60_000);
    lines.push(JSON.stringify({ schemaVersion: 1, timestamp: at.toISOString(), localDate: at.toISOString().slice(0, 10), model: 'qwen3.8-flash', inputTokens: 1000, outputTokens: 50, totalTokens: 1050 }));
  }
  for (let i = 0; i < post; i += 1) {
    const at = new Date(T0 + 60_000 + i * 30_000);
    lines.push(JSON.stringify({ schemaVersion: 1, timestamp: at.toISOString(), localDate: at.toISOString().slice(0, 10), model: 'qwen3.8-flash', inputTokens: 2000, outputTokens: 80, totalTokens: 2080 }));
  }
  fs.writeFileSync(path.join(usage, 'token-usage-2026-09.jsonl'), `${lines.join('\n')}\n`);
  return home;
}

test('the meter counts one request per usage-block record, with usage_record.jsonl as the fallback', (t) => {
  const home = qwenHome(t, { pre: 7, post: 3 });
  const meter = meterRecords(home);
  assert.equal(meter.source, 'usage/token-usage-*.jsonl');
  assert.equal(meter.records.length, 10);
  assert.equal(meter.records.reduce((n, r) => n + r.requests, 0), 10);
  assert.equal(meter.records[0].tokens, 1050);

  const legacy = tmp(t, 'starci-qwen-legacy-');
  fs.writeFileSync(path.join(legacy, 'usage_record.jsonl'), [
    JSON.stringify({ version: 1, sessionId: 's1', timestamp: WINDOW_START + 5000, models: { 'qwen3.8-flash': { requests: 4, totalTokens: 4000 }, 'deepseek-v4.1-flash': { requests: 2, totalTokens: 2000 } } }),
    JSON.stringify({ version: 1, sessionId: 's2', timestamp: WINDOW_START + 9000, models: { 'qwen3.8-max': { requests: 3, totalTokens: 3000 } } }),
    'not json', JSON.stringify({ timestamp: WINDOW_START }), // no models -> skipped
  ].join('\n'));
  const fallback = meterRecords(legacy);
  assert.equal(fallback.source, 'usage_record.jsonl');
  assert.equal(fallback.records.reduce((n, r) => n + r.requests, 0), 9, 'fallback counts session request sums');

  assert.equal(meterRecords(tmp(t, 'starci-qwen-empty-')).source, null, 'no telemetry -> unmetered');
});

test('the seed calibration anchors the estimate: plan used at T0 over metered units at T0', (t) => {
  const home = qwenHome(t, { pre: 12000, post: 100 });
  const est = estimateQuota({ config: CFG, env: { LOCALAPPDATA: tmp(t, 'starci-qwen-state-') }, home, now: NOW });
  // 12000 local requests at T0 mapped to 24120 plan units (13.4% of 180000) -> ratio 2.01;
  // 100 more local units since -> 24120 + 100*2.01 = 24321 -> 13.5% used.
  assert.equal(est.ratio, 2.01);
  assert.equal(est.localUnits, 12100);
  assert.equal(est.planUsed, 24321);
  assert.equal(est.usedPercent, 13.5);
  assert.equal(est.resetsAt, new Date(Date.parse(PLAN.resetAt)).toISOString());
  assert.equal(est.metered, true);
});

test('an owner calibration in the state dir refines the learned ratio', (t) => {
  const home = qwenHome(t, { pre: 12000, post: 100 });
  const env = { LOCALAPPDATA: tmp(t, 'starci-qwen-cal-') };
  const r = recordCalibration({ remainingPercent: 80, env, home, config: CFG, now: NOW });
  assert.equal(r.calibration.localUnits, 12100);
  assert.equal(r.calibration.unit, 'requests');
  // Segment: (20% - 13.4%) * 180000 = 11880 plan units over (12100 - 12000) = 100 local units -> 118.8
  assert.equal(r.estimate.ratio, 118.8);
  assert.equal(r.estimate.usedPercent, 20, 'a fresh calibration is the truth at its instant');
  const cals = loadCalibrations(env);
  assert.equal(cals.length, 1);
  assert.equal(cals[0].remainingPercent, 80);
  // And the estimate after another 50 metered requests is anchored at the new calibration.
  const extra = qwenHome(t, { pre: 12000, post: 150 });
  const later = estimateQuota({ config: CFG, env, home: extra, now: NOW + 30 * 60_000 });
  assert.equal(later.planUsed, 36000 + Math.round(50 * 118.8), 'anchored at the newest calibration');
});

test('a reset rolls the window forward; calibrations of the old window stay history', (t) => {
  const home = qwenHome(t, { pre: 10 });
  const after = Date.parse('2026-10-12T00:00:00+07:00'); // past resetAt
  const w = planWindow(Date.parse(PLAN.resetAt), after);
  assert.equal(new Date(w.end).toISOString(), new Date(Date.parse('2026-11-11T23:00:00+07:00')).toISOString());
  const est = estimateQuota({ config: CFG, env: { LOCALAPPDATA: tmp(t, 'starci-qwen-roll-') }, home, now: after });
  assert.equal(est.localUnits, 0, 'old-window records no longer count');
  assert.equal(est.planUsed, 0);
  assert.equal(est.usedPercent, 0);
});

test('the probe: dead without credentials, ok/limited/dead by remaining with them', (t) => {
  const home = qwenHome(t, { pre: 12000, post: 100 });
  const env = { ...CRED, LOCALAPPDATA: tmp(t, 'starci-qwen-probe-') };
  const r = probe({ env, home, config: CFG, now: NOW });
  assert.equal(r.state, 'ok');
  assert.equal(r.usedPercent, 13.5);
  assert.equal(r.resetsAt, new Date(Date.parse(PLAN.resetAt)).toISOString());
  assert.match(r.detail, /credential env present: BAILIAN_TOKEN_PLAN_API_KEY/);
  assert.match(r.detail, /13\.5% used/);

  const noCred = probe({ env: { LOCALAPPDATA: tmp(t, 'starci-qwen-nc-') }, home: tmp(t, 'starci-qwen-nh-'), config: CFG, now: NOW });
  assert.equal(noCred.state, 'dead');
  assert.match(noCred.detail, /no qwen credential env/);

  const dotenv = tmp(t, 'starci-qwen-dotenv-');
  fs.writeFileSync(path.join(dotenv, '.env'), 'DASHSCOPE_API_KEY=spec-dotenv\n');
  assert.equal(probe({ env: { LOCALAPPDATA: tmp(t, 'starci-qwen-de-') }, home: dotenv, config: CFG, now: NOW }).state, 'ok', 'the .env file is a credential source too');
});

test('the probe maps an exhausted or nearly-spent plan to dead/limited', (t) => {
  const almost = qwenHome(t, { pre: 17000, post: 0 }); // 17000 local x ratio 1.4188 -> ~24120? no: seed still anchors
  // Seed-only: ratio = 24120/17000 = 1.4188; usedNow = 24120 + 0 -> 13.4% — still ok.
  assert.equal(probe({ env: CRED, home: almost, config: CFG, now: NOW }).state, 'ok');
  const spent = { quota: { qwen: { ...PLAN, calibratedRemainingPercent: 0 } } };
  const d = probe({ env: CRED, home: almost, config: spent, now: NOW });
  assert.equal(d.state, 'dead');
  const low = { quota: { qwen: { ...PLAN, calibratedRemainingPercent: 9.5 } } };
  assert.equal(probe({ env: CRED, home: almost, config: low, now: NOW }).state, 'limited');
});

test('without a quota.qwen block the probe is credential + meter only', (t) => {
  const home = qwenHome(t, { pre: 7, post: 3 });
  const r = probe({ env: CRED, home, config: {}, now: NOW });
  assert.equal(r.state, 'ok');
  assert.equal(r.usedPercent, null);
  assert.match(r.detail, /metered 10 requests locally/, 'the metered count is reported even unconfigured');
});

test('probeQuota("qwen") forwards opts through the pinned interface', (t) => {
  const home = qwenHome(t, { pre: 12000, post: 100 });
  const r = probeQuota('qwen-agent', { env: CRED, home, config: CFG, now: NOW });
  assert.equal(r.state, 'ok');
  assert.equal(r.usedPercent, 13.5);
  assert.equal(typeof r.detail, 'string');
});

test('the quota block parses as YAML and the plan normalizer accepts the documented shape', () => {
  const doc = parseYaml(stringifyYaml(CFG));
  const plan = qwenPlan(doc);
  assert.equal(plan.planQuota, 180000);
  assert.equal(plan.unit, 'requests');
  assert.equal(plan.resetAt, Date.parse(PLAN.resetAt));
  assert.deepEqual(plan.seed, { at: T0, remainingPercent: 86.6 });
  assert.equal(qwenPlan({}), null);
  assert.equal(qwenPlan({ quota: { qwen: { planQuota: 'x' } } }), null);
});

/* ---------------------------------------------------------- /qwen command auth */

const OWNER = 4242;
let seq = 1;
const tgMessage = (text, { chat = OWNER, from = OWNER } = {}) => ({
  update_id: seq++, message: { message_id: seq + 1000, date: Math.floor(NOW / 1000), chat: { id: chat, type: 'private' }, from: { id: from, is_bot: false }, text },
});

function bridgeSetup(t, { recordQwen, language = 'en' } = {}) {
  const home = tmp(t, 'starci-qwen-tg-');
  const env = { LOCALAPPDATA: home };
  const sent = [], logs = [];
  const bridge = createBridge({
    env, apiBase: 'http://127.0.0.1:1', sleepImpl: async () => {}, timeoutS: 0,
    log: (l) => logs.push(l),
    fetchImpl: async (_url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 77 } }) }; },
    settings: () => ({ ready: true, token: 'spec-token', chatId: String(OWNER), language }),
    recordQwen,
  });
  return { env, sent, logs, bridge };
}

test('/qwen <percent> from the owner chat records a calibration; every other chat is refused', async (t) => {
  const home = qwenHome(t, { pre: 12000, post: 100 });
  const env = { LOCALAPPDATA: tmp(t, 'starci-qwen-cal-state-') };
  const recordQwen = (percent) => Promise.resolve(recordCalibration({ remainingPercent: percent, env, home, config: CFG, now: NOW }));
  const { sent, bridge } = bridgeSetup(t, { recordQwen });

  const foreign = await bridge.handleUpdate(tgMessage('/qwen 50', { chat: 999, from: 999 }));
  assert.equal(foreign.dropped, true, 'a foreign chat is refused before the command runs');
  assert.equal(loadCalibrations(env).length, 0, 'nothing was recorded');
  assert.equal(sent.length, 0, 'a refused chat gets no reply at all');

  const ok = await bridge.handleUpdate(tgMessage('/qwen 80'));
  assert.deepEqual(ok, { handled: 'message' });
  const cals = loadCalibrations(env);
  assert.equal(cals.length, 1);
  assert.equal(cals[0].remainingPercent, 80);
  assert.equal(cals[0].localUnits, 12100);
  assert.ok(calibrationsFile(env).endsWith(path.join('quota', 'qwen-calibrations.json')), 'calibrations live in the runtime state dir');
  const reply = sent.at(-1);
  assert.match(reply.text, /80% remaining/);
  assert.match(reply.text, /ratio ×118\.8/);

  const bad = await bridge.handleUpdate(tgMessage('/qwen nope'));
  assert.equal(bad.handled, 'message');
  assert.match(sent.at(-1).text, /Usage: \/qwen/);
  assert.equal(loadCalibrations(env).length, 1, 'a malformed percent records nothing');
});

/* ---------------------------------------------------------- /status line */

test('the supervisor block renders usedPercent and the next reset', () => {
  const quota = {
    qwen: { state: 'ok', usedPercent: 13.5, resetsAt: '2026-10-11T16:00:00.000Z' },
    devin: { state: 'limited', usedPercent: 91, resetsAt: '2026-09-25T00:00:00.000Z' },
    claude: { state: 'ok', usedPercent: null, detail: 'no window seen' },
  };
  const line = renderQuotaLine(quota, { language: 'en' });
  assert.match(line, /^📶 Quota: /);
  assert.match(line, /qwen 14% used/);
  assert.match(line, /↻10-11 16:00Z/, 'the reset instant shows');
  assert.match(line, /devin 91% used ⚠/);
  assert.ok(!line.includes('claude'), 'a probe with no number is skipped');
  assert.equal(renderQuotaLine({ claude: { state: 'ok', usedPercent: null } }), null);
  const snap = { seat: null, enabled: true, ticks: [], board: { active: [], reported: [] }, pushes: [], lands: [] };
  const html = renderSupervisorBlock(snap, { language: 'en', quota });
  assert.match(html, /📶 Quota: /);
  assert.match(html, /qwen 14% used/);
  assert.equal(renderSupervisorBlock(snap, { language: 'en' }).includes('Quota'), false, 'no quota map, no line');
});
