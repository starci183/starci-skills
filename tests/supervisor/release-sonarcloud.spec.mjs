// release-sonarcloud.spec.mjs - the Sonar proof of the release against a fake SonarCloud: the example's config (SonarCloud host, the runtime's one token, the key <organization>_<declared key>),
// the pre-cut findings (variables, API, token, organization), project creation, the supplier's flow and verdicts, the lint report and the fresh-connection fetch. No network, no secret, no Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { freshFetch } from '../../scripts/api/sonar/fresh-fetch.mjs';
import { PROOF_BRANCH, cloudConfig, ensureCloudProject, sonarCloudFindings } from '../../scripts/supervisor/release-sonarcloud.mjs';
import { removeLintReport, writeLintReport } from '../../scripts/supervisor/release-sonar-report.mjs';
import { sonarCloudRefusal } from '../../scripts/supervisor/release-cut-plan.mjs';
import { sonarSupplier } from '../../scripts/supervisor/release-l4-sonar.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const tmp = (t, label) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `starci-sonarcloud-${label}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const SECRETS = { SONAR_TOKEN: 'cloud-token-value', SONAR_ORGANIZATION: 'acme' };
const EXAMPLE = path.join(skillRoot, 'examples', 'ecommerce-app');
const answer = (status, body) => ({ status, json: async () => body, text: async () => JSON.stringify(body) });

/** A fake SonarCloud: routes by path; `state` holds what it answers. Requests are logged as [method, path, authorization]. */
function fakeCloud({ valid = true, organizations = [{ key: 'acme' }], up = 200, projects = new Set(), mayCreate = true } = {}) {
  const log = [];
  const send = async (url, init = {}) => {
    const u = new URL(url);
    log.push([init.method ?? 'GET', u.pathname, init.headers?.Authorization ?? null]);
    switch (u.pathname) {
      case '/api/system/status': return answer(up, { status: 'UP' });
      case '/api/authentication/validate': return answer(200, { valid });
      case '/api/organizations/search': return answer(200, { organizations });
      case '/api/components/show': return projects.has(u.searchParams.get('component')) ? answer(200, {}) : answer(404, {});
      case '/api/projects/create': {
        if (!mayCreate) return answer(403, {});
        projects.add(new URLSearchParams(init.body).get('project'));
        return answer(200, {});
      }
      default: return answer(404, {});
    }
  };
  return { log, send, projects };
}

test('config: SonarCloud host, the runtime token from secret.env (not the SONAR_TOKEN or SONAR_HOST_URL of the environment), key <organization>_<declared key>', (t) => {
  const keep = { host: process.env.SONAR_HOST_URL, token: process.env.SONAR_TOKEN };
  t.after(() => { for (const [name, value] of [['SONAR_HOST_URL', keep.host], ['SONAR_TOKEN', keep.token]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  process.env.SONAR_HOST_URL = 'https://sonar.starci.org';
  process.env.SONAR_TOKEN = 'self-hosted-token';
  const cloud = cloudConfig(EXAMPLE, SECRETS);
  assert.equal(cloud.cfg.host, 'https://sonarcloud.io');
  assert.equal(cloud.key, 'acme_starci-example-ecommerce-app');
  assert.equal(cloud.org, 'acme');
  assert.equal(typeof cloud.cfg.fetch, 'function');
  assert.throws(() => cloudConfig(tmp(t, 'nokey'), SECRETS), /no sonar\.projectKey/);
});

test('fetch: every request asks for its own connection, so a socket pooled before a long synchronous step is never reused', async (t) => {
  const real = globalThis.fetch;
  t.after(() => { globalThis.fetch = real; });
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push(init.headers); return { status: 200 }; };
  await freshFetch('https://sonarcloud.io/api/x', { headers: { Accept: 'application/json' } });
  await freshFetch('https://sonarcloud.io/api/y');
  assert.deepEqual(seen, [{ Accept: 'application/json', Connection: 'close' }, { Connection: 'close' }]);
});

test('findings: a ready SonarCloud has none; no example means nothing to check; the token travels only as a bearer header', async () => {
  const cloud = fakeCloud();
  assert.deepEqual(await sonarCloudFindings([{ name: 'shop' }], { secrets: SECRETS, fetch: cloud.send }), []);
  assert.deepEqual(await sonarCloudFindings([], { secrets: {}, fetch: cloud.send }), []);
  assert.ok(cloud.log.filter(([, p]) => p !== '/api/system/status').every(([, , authorization]) => authorization === 'Bearer cloud-token-value'));
});

test('findings: a missing SONAR_TOKEN or SONAR_ORGANIZATION is named at once, with where to get it, before any request', async () => {
  const cloud = fakeCloud();
  const none = await sonarCloudFindings([{ name: 'shop' }], { secrets: {}, fetch: cloud.send });
  assert.deepEqual(none.map((f) => f.what), ["SONAR_TOKEN is not set in the runtime's secret.env", "SONAR_ORGANIZATION is not set in the runtime's secret.env"]);
  assert.match(none[0].fix, /sonarcloud\.io > My Account > Security > Generate Tokens/);
  assert.deepEqual(cloud.log, []);
});

test('findings: an unreachable API, a rejected token (a self-hosted prefix is named) and an unknown organization each refuse', async () => {
  const down = await sonarCloudFindings([{ name: 'shop' }], { secrets: SECRETS, fetch: async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }); } });
  assert.match(down[0].what, /SonarCloud is unreachable \(ENOTFOUND\)/);
  const unavailable = await sonarCloudFindings([{ name: 'shop' }], { secrets: SECRETS, fetch: fakeCloud({ up: 503 }).send });
  assert.match(unavailable[0].what, /HTTP 503/);
  const rejected = await sonarCloudFindings([{ name: 'shop' }], { secrets: { ...SECRETS, SONAR_TOKEN: 'sqa_selfhosted' }, fetch: fakeCloud({ valid: false }).send });
  assert.match(rejected[0].what, /SonarCloud rejects SONAR_TOKEN \(its prefix is that of a self-hosted SonarQube token\)/);
  assert.match(rejected[0].fix, /replace SONAR_TOKEN in \.claude\/secret\.env with a SonarCloud token/);
  const plain = await sonarCloudFindings([{ name: 'shop' }], { secrets: SECRETS, fetch: fakeCloud({ valid: false }).send });
  assert.doesNotMatch(plain[0].what, /prefix/);
  const unknown = await sonarCloudFindings([{ name: 'shop' }], { secrets: SECRETS, fetch: fakeCloud({ organizations: [] }).send });
  assert.match(unknown[0].what, /no organization acme/);
});

test('project: an existing project is left, an absent one is created in the organization, and a token that may not create names the one owner step', async () => {
  const cloud = { key: 'acme_starci-example-shop', org: 'acme' };
  const present = fakeCloud({ projects: new Set([cloud.key]) });
  assert.deepEqual(await ensureCloudProject(cloud, 'tok', present.send), { created: false });
  const absent = fakeCloud();
  assert.deepEqual(await ensureCloudProject(cloud, 'tok', absent.send), { created: true });
  assert.ok(absent.projects.has(cloud.key));
  const refused = await ensureCloudProject(cloud, 'tok', fakeCloud({ mayCreate: false }).send);
  assert.match(refused.error, /may not create it \(HTTP 403\): create it once in organization acme on sonarcloud\.io/);
});

const APP = { name: 'shop', dir: path.join(os.tmpdir(), 'x', 'examples', 'shop') };
const CLOUD = { cfg: { host: 'https://sonarcloud.io' }, key: 'acme_starci-example-shop', org: 'acme' };
const processedScan = (extra = {}) => ({ outcome: 'fail', reason: 'the quality gate failed: new_coverage 0', scanner: { exitCode: 0 }, ceTask: { status: 'SUCCESS' }, projectGate: { status: 'ERROR' }, ...extra });
/** A fake gate: records its calls; `scan` and `dashboard` are the reports it returns. */
function gateOf({ scan = { outcome: 'pass', scanner: { exitCode: 0 }, ceTask: { status: 'SUCCESS' } }, dashboard = { outcome: 'pass' }, project = { created: false }, config } = {}) {
  const calls = [];
  return {
    calls,
    gate: {
      config: config ?? (() => CLOUD),
      ensure: async () => { calls.push('ensure'); return project; },
      scan: async (cloud, dir, defines) => { calls.push(['scan', defines]); return scan; },
      dashboard: async () => { calls.push('dashboard'); return dashboard; },
    },
  };
}
const supplier = (t, fake, extra = {}) => sonarSupplier([APP], { gate: fake.gate, secrets: SECRETS, lintReport: () => ({ ok: true }), logDir: () => tmp(t, 'log'), ...extra });

test('supplier: the project is ensured, the scan runs with the organization on the proof branch, the dashboard is read, and both passing is the proof', async (t) => {
  const fake = gateOf();
  const proof = await supplier(t, fake).proofs['shop: sonar']();
  assert.equal(proof.ok, true);
  assert.deepEqual(fake.calls, ['ensure', ['scan', ['-Dsonar.organization=acme', `-Dsonar.branch.name=${PROOF_BRANCH}`]], 'dashboard']);
});

test('supplier: a project created by this proof is analysed as its main branch, never on a branch of a project that has none', async (t) => {
  const fake = gateOf({ project: { created: true } });
  await supplier(t, fake).proofs['shop: sonar']();
  assert.deepEqual(fake.calls[1][1], ['-Dsonar.organization=acme']);
});

test('supplier: the scan row holds the runtime bar elsewhere: a processed analysis whose SonarCloud gate is red or NONE still passes the scan row and the dashboard decides', async (t) => {
  const green = gateOf({ scan: processedScan() });
  assert.equal((await supplier(t, green).proofs['shop: sonar']()).ok, true);
  const none = gateOf({ scan: processedScan({ outcome: 'blocked', reason: 'no quality-gate result for the analysis (status NONE)', projectGate: { status: 'NONE' } }) });
  assert.equal((await supplier(t, none).proofs['shop: sonar']()).ok, true, 'a new project has no gate: NONE is not a failed analysis');
  const red = gateOf({ scan: processedScan(), dashboard: { outcome: 'fail', reason: 'the dashboard fails: code_smells 3 > 0' } });
  const proof = await supplier(t, red).proofs['shop: sonar']();
  assert.equal(proof.ok, false);
  assert.match(fs.readFileSync(proof.log, 'utf8'), /sonar-local dashboard shop: fail/);
});

test('supplier: an analysis that was not processed (scanner failed, task failed, blocked) fails the proof and the dashboard is not read', async (t) => {
  for (const scan of [processedScan({ scanner: { exitCode: 1 } }), processedScan({ ceTask: { status: 'FAILED' } }), { outcome: 'blocked', reason: 'no token' }]) {
    const fake = gateOf({ scan });
    assert.equal((await supplier(t, fake).proofs['shop: sonar']()).ok, false);
    assert.ok(!fake.calls.includes('dashboard'));
  }
});

test('supplier: a config error, a failed lint report, a project that cannot be created and a thrown scan each fail the proof naming the cause', async (t) => {
  const config = gateOf({ config: () => { throw new Error('no sonar.projectKey'); } });
  assert.match(fs.readFileSync((await supplier(t, config).proofs['shop: sonar']()).log, 'utf8'), /sonar config: no sonar\.projectKey/);
  const lint = await supplier(t, gateOf(), { lintReport: () => ({ ok: false, reason: 'no CLI installed' }) }).proofs['shop: sonar']();
  assert.match(fs.readFileSync(lint.log, 'utf8'), /sonar lint report: no CLI installed/);
  const noProject = gateOf({ project: { error: 'the project could not be created' } });
  const refused = await supplier(t, noProject).proofs['shop: sonar']();
  assert.match(fs.readFileSync(refused.log, 'utf8'), /sonar project: the project could not be created/);
  assert.deepEqual(noProject.calls, ['ensure']);
  const thrown = gateOf();
  thrown.gate.scan = async () => { throw new Error('scanner exploded'); };
  assert.match(fs.readFileSync((await supplier(t, thrown).proofs['shop: sonar']()).log, 'utf8'), /scanner exploded/);
});

test('report: the lint report is written fresh before the scan, a lint run that writes none is named, and the report and its empty directory are removed afterwards', (t) => {
  const dir = tmp(t, 'report');
  fs.mkdirSync(path.join(dir, 'reports'));
  fs.writeFileSync(path.join(dir, 'reports', 'lint.sonar.json'), 'stale');
  let seen;
  const none = writeLintReport(dir, { run: (args, options) => { seen = { args, cwd: options.cwd, stale: fs.existsSync(path.join(dir, 'reports', 'lint.sonar.json')) }; return { status: 2, stderr: 'boom' }; } });
  assert.deepEqual(seen, { args: ['exec', '--no-install', '--', 'starci', 'app', 'lint', '--sonar', 'reports/lint.sonar.json'], cwd: dir, stale: false });
  assert.match(none.reason, /wrote no report \(exit 2\): boom/);
  const writes = () => { fs.mkdirSync(path.join(dir, 'reports'), { recursive: true }); fs.writeFileSync(path.join(dir, 'reports', 'lint.sonar.json'), '{}'); return { status: 1 }; };
  assert.deepEqual(writeLintReport(dir, { run: writes }), { ok: true }, 'findings (a non-zero lint exit) do not stop the report: the gate counts them');
  removeLintReport(dir);
  assert.equal(fs.existsSync(path.join(dir, 'reports')), false);
  removeLintReport(dir);
});

test('cut: a SonarCloud finding becomes the sonar-cloud verdict naming every finding and its fix; no finding is no refusal', async () => {
  const refusal = await sonarCloudRefusal({ repo: os.tmpdir(), deps: { sonarCloud: async () => [{ what: 'SONAR_TOKEN is not set', fix: 'owner: put it in secret.env' }] } });
  assert.equal(refusal.verdict, 'sonar-cloud');
  assert.match(refusal.why, /the Sonar proofs cannot reach SonarCloud: SONAR_TOKEN is not set \(owner: put it in secret\.env\)/);
  assert.equal(await sonarCloudRefusal({ repo: os.tmpdir(), deps: { sonarCloud: async () => [] } }), null);
});
