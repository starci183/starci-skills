import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { probe, planToResult, readWindsurfApiKey } from '../scripts/api/quota/devin.mjs';
import { probeQuota } from '../scripts/api/quota/index.mjs';

// The devin quota probe reads the Windsurf seat API devin.exe calls
// (SeatManagementService/GetUserStatus, Connect-JSON). The probe is synchronous
// (the router and workers call it without awaiting), so its HTTP call runs in a
// `node -e` child under spawnSync — which means the spec's fake seat server must
// live in a worker thread: the main thread's event loop is blocked while the
// probe's child is in flight. The fake key must never appear in any output.

const KEY = 'wsk-spec-FAKE-key-9f8e7d6c5b4a-never-in-output';
const tmp = (t, prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };

const SERVER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const http = require('node:http');
const requests = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    requests.push({ method: req.method, url: req.url, headers: { ...req.headers }, body });
    let meta = {}; try { meta = JSON.parse(body).metadata || {}; } catch {}
    const reply = workerData.strict && !/^\\d+\\.\\d+\\.\\d+/.test(String(meta.extensionVersion))
      ? { status: 500, json: { code: 'unknown', message: 'an internal error occurred' } }
      : workerData.echo
      ? { status: workerData.status, json: { code: 'internal', echo: body } }
      : { status: workerData.status, json: workerData.json };
    res.writeHead(reply.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(reply.json));
  });
});
server.listen(0, '127.0.0.1', () => parentPort.postMessage({ port: server.address().port }));
parentPort.on('message', (m) => { if (m === 'report') parentPort.postMessage({ requests }); });
`;

/** A fake GetUserStatus endpoint in a worker thread: records requests, replies `json` (or echoes the body). */
async function fakeSeat(t, { planStatus, status = 200, json = undefined, echo = false, strict = false } = {}) {
  const worker = new Worker(SERVER_SOURCE, { eval: true, workerData: { status, json: json ?? { userStatus: { planStatus } }, echo, strict } });
  t.after(() => worker.terminate());
  const [{ port }] = await once(worker, 'message');
  return {
    endpoint: `http://127.0.0.1:${port}/exa.seat_management_pb.SeatManagementService/GetUserStatus`,
    async requests() { worker.postMessage('report'); const [m] = await once(worker, 'message'); return m.requests; },
  };
}

const credFile = (t, key = KEY) => {
  const dir = tmp(t, 'starci-devin-cred-');
  const file = path.join(dir, 'credentials.toml');
  fs.writeFileSync(file, `windsurf_api_key = "${key}"\napi_server_url = "https://server.codeium.com"\n`, { mode: 0o600 });
  return file;
};

const noKey = (r) => {
  assert.ok(!JSON.stringify(r).includes(KEY), `the api key must not appear in the probe result: ${JSON.stringify(r)}`);
  return r;
};

test('the probe POSTs Connect-JSON GetUserStatus and maps planStatus to the pinned result', async (t) => {
  const seat = await fakeSeat(t, {
    planStatus: {
      dailyQuotaRemainingPercent: 42.5, weeklyQuotaRemainingPercent: 60,
      dailyQuotaResetAtUnix: 1758700000, weeklyQuotaResetAtUnix: 1760400000,
      billingStrategy: 'seat', planEnd: 1765000000, overageBalanceMicros: 0,
    },
  });
  const r = noKey(probe({ endpoint: seat.endpoint, credentialsFile: credFile(t), cacheMs: 0, timeoutMs: 8000 }));
  assert.equal(r.state, 'ok');
  assert.equal(r.usedPercent, 57.5, 'usedPercent = 100 - min(daily 42.5, weekly 60)');
  assert.equal(r.resetsAt, new Date(1758700000 * 1000).toISOString(), 'the soonest reset shows');
  assert.match(r.detail, /devin seat quota/);
  const [req] = await seat.requests();
  assert.equal(req.method, 'POST');
  assert.equal(req.headers['connect-protocol-version'], '1');
  assert.match(req.headers['content-type'], /application\/json/);
  const sent = JSON.parse(req.body);
  assert.equal(sent.metadata.apiKey, KEY, 'the seat call carries the credentials.toml key');
  assert.equal(sent.metadata.ideName, 'devin-cli');
  assert.ok('ideVersion' in sent.metadata && 'extensionName' in sent.metadata && 'extensionVersion' in sent.metadata && 'locale' in sent.metadata);
});

test('limited under 10% remaining; dead only at 0% with no overage balance', async (t) => {
  const limited = await fakeSeat(t, { planStatus: { dailyQuotaRemainingPercent: 8, weeklyQuotaRemainingPercent: 50 } });
  assert.equal(noKey(probe({ endpoint: limited.endpoint, credentialsFile: credFile(t), cacheMs: 0 })).state, 'limited');
  const dead = await fakeSeat(t, { planStatus: { dailyQuotaRemainingPercent: 0, weeklyQuotaRemainingPercent: 0, overageBalanceMicros: 0 } });
  const d = noKey(probe({ endpoint: dead.endpoint, credentialsFile: credFile(t), cacheMs: 0 }));
  assert.equal(d.state, 'dead');
  assert.equal(d.usedPercent, 100);
  const overage = await fakeSeat(t, { planStatus: { dailyQuotaRemainingPercent: 0, weeklyQuotaRemainingPercent: 0, overageBalanceMicros: 5000000 } });
  assert.equal(noKey(probe({ endpoint: overage.endpoint, credentialsFile: credFile(t), cacheMs: 0 })).state, 'limited', 'an overage balance keeps calls billable');
});

test('every API or credential failure is unknown, never dead; the key never surfaces', async (t) => {
  const dir = tmp(t, 'starci-devin-missing-');
  assert.equal(probe({ endpoint: 'http://127.0.0.1:1/x', credentialsFile: path.join(dir, 'absent.toml'), cacheMs: 0 }).state, 'unknown', 'no credentials.toml');
  const http500 = await fakeSeat(t, { echo: true, status: 500 });
  const r5 = noKey(probe({ endpoint: http500.endpoint, credentialsFile: credFile(t), cacheMs: 0 }));
  assert.equal(r5.state, 'unknown');
  assert.match(r5.detail, /HTTP 500/);
  assert.equal((await http500.requests()).length, 1);
  const r0 = noKey(probe({ endpoint: 'http://127.0.0.1:1/no-listener', credentialsFile: credFile(t), cacheMs: 0, timeoutMs: 5000 }));
  assert.equal(r0.state, 'unknown', 'an unreachable endpoint is unknown, not dead');
  const noPlan = await fakeSeat(t, { planStatus: null });
  assert.equal(noKey(probe({ endpoint: noPlan.endpoint, credentialsFile: credFile(t), cacheMs: 0 })).state, 'unknown', 'no planStatus');
  const bare = await fakeSeat(t, { planStatus: { billingStrategy: 'seat' } });
  assert.equal(noKey(probe({ endpoint: bare.endpoint, credentialsFile: credFile(t), cacheMs: 0 })).state, 'unknown', 'no percentages');
});

test('planToResult is the pure mapping; readWindsurfApiKey parses the toml value only', (t) => {
  assert.equal(planToResult({ dailyQuotaRemainingPercent: 100, weeklyQuotaRemainingPercent: 100 }).state, 'ok');
  assert.equal(planToResult({ dailyQuotaRemainingPercent: 10, weeklyQuotaRemainingPercent: 90 }).state, 'limited');
  assert.equal(planToResult({ dailyQuotaRemainingPercent: null, weeklyQuotaRemainingPercent: 33 }).usedPercent, 67);
  assert.equal(planToResult({}).state, 'unknown');
  const file = credFile(t);
  assert.equal(readWindsurfApiKey(file), KEY);
  assert.equal(readWindsurfApiKey(path.join(path.dirname(file), 'nope.toml')), null);
});

test('probeQuota("devin") dispatches the seat probe through the pinned interface', async (t) => {
  const seat = await fakeSeat(t, { planStatus: { dailyQuotaRemainingPercent: 71, weeklyQuotaRemainingPercent: 88, weeklyQuotaResetAtUnix: 1760400000 } });
  const dir = credFile(t);
  const saved = { ep: process.env.STARCI_DEVIN_SEAT_ENDPOINT, ad: process.env.APPDATA };
  t.after(() => { for (const [k, v] of [['STARCI_DEVIN_SEAT_ENDPOINT', saved.ep], ['APPDATA', saved.ad]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  process.env.STARCI_DEVIN_SEAT_ENDPOINT = seat.endpoint;
  process.env.APPDATA = path.dirname(dir); // credentialsFile resolves <APPDATA>/devin/credentials.toml
  fs.mkdirSync(path.join(process.env.APPDATA, 'devin'), { recursive: true });
  fs.renameSync(dir, path.join(process.env.APPDATA, 'devin', 'credentials.toml'));
  const r = noKey(probeQuota('devin-agent', { cacheMs: 0 }));
  assert.equal(r.state, 'ok');
  assert.equal(r.usedPercent, 29);
  assert.equal(typeof r.detail, 'string');
  assert.ok((await seat.requests()).length >= 1, 'the dispatch reached the fake seat API');
});

// Live 2026-09-24: the seat API answers HTTP 500 when metadata.extensionVersion is
// not a version string ("unknown"), 400 when it is absent, 200 with the CLI's
// shape (ideName/extensionName "devin-cli", a semver version). The strict fake
// mirrors that rule.
test('the probe sends the CLI seat shape: devin-cli names and semver versions, never "unknown"', async (t) => {
  const seat = await fakeSeat(t, { strict: true, planStatus: { dailyQuotaRemainingPercent: 100, weeklyQuotaRemainingPercent: 100 } });
  const r = noKey(probe({ endpoint: seat.endpoint, credentialsFile: credFile(t), cacheMs: 0 }));
  assert.equal(r.state, 'ok', `the strict seat API accepts the request: ${r.detail}`);
  const bad = noKey(probe({ endpoint: seat.endpoint, credentialsFile: credFile(t), cacheMs: 0, metadata: { ideVersion: 'unknown', extensionVersion: '' } }));
  assert.equal(bad.state, 'ok', 'a non-version metadata override falls back to the CLI version');
  for (const req of await seat.requests()) {
    const m = JSON.parse(req.body).metadata;
    assert.equal(m.ideName, 'devin-cli');
    assert.equal(m.extensionName, 'devin-cli');
    assert.match(m.ideVersion, /^\d+\.\d+\.\d+/);
    assert.match(m.extensionVersion, /^\d+\.\d+\.\d+/);
    assert.equal(typeof m.locale, 'string');
  }
});

test('STARCI_DEVIN_SEAT_ENDPOINT only redirects the key to a loopback URL', async (t) => {
  const seat = await fakeSeat(t, { planStatus: { dailyQuotaRemainingPercent: 50, weeklyQuotaRemainingPercent: 50 } });
  const cred = credFile(t);
  const local = noKey(probe({ credentialsFile: cred, cacheMs: 0, env: { STARCI_DEVIN_SEAT_ENDPOINT: seat.endpoint.replace('127.0.0.1', 'localhost') } }));
  assert.equal(local.state, 'ok', `a localhost override is honoured: ${local.detail}`);
  for (const foreign of [
    'https://evil.example/exa.seat_management_pb.SeatManagementService/GetUserStatus',
    'http://127.0.0.1.evil.example/x',
    'http://localhost@evil.example/x',
    'http://10.0.0.5:8080/x',
    'file:///etc/passwd',
    'not a url',
  ]) {
    const r = noKey(probe({ credentialsFile: cred, cacheMs: 0, timeoutMs: 2000, env: { STARCI_DEVIN_SEAT_ENDPOINT: foreign } }));
    assert.equal(r.state, 'unknown', foreign);
    assert.match(r.detail, /loopback/, `${foreign} is refused, not called: ${r.detail}`);
  }
  const opt = noKey(probe({ endpoint: 'https://evil.example/x', credentialsFile: cred, cacheMs: 0, timeoutMs: 2000 }));
  assert.match(opt.detail, /loopback/, 'the endpoint option obeys the same rule');
  assert.equal((await seat.requests()).length, 1, 'only the loopback override reached a server');
});
