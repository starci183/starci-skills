import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';



import {
  findSupabaseAppRoot,
  parseSupabaseConfig,
  supabaseStart,
  supabaseStatus,
  supabaseStop,
} from '../../scripts/machine/supabase-stack.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const PORTS = Object.freeze({
  api: 44830,
  db: 44831,
  shadow: 44832,
  studio: 44833,
  inbucket: 44834,
  analytics: 44835,
  pooler: 44836,
});

function config(project = 'lite-app', ports = PORTS) {
  return [
    `project_id = "${project}"`,
    '[api]', `port = ${ports.api}`,
    '[db]', `port = ${ports.db}`, `shadow_port = ${ports.shadow}`,
    '[studio]', `port = ${ports.studio}`,
    '[inbucket]', `port = ${ports.inbucket}`,
    '[analytics]', `port = ${ports.analytics}`,
    '[db.pooler]', `port = ${ports.pooler}`,
    '',
  ].join('\n');
}

function fixture(t, project = 'lite-app', ports = PORTS) {
  const root = mkdtemp(t, 'starci-supabase-');
  const app = path.join(root, 'app');
  const nested = path.join(app, 'be', 'apps', 'api');
  fs.mkdirSync(path.join(app, 'supabase'), { recursive: true });
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(app, 'hfs.json'), '{}\n');
  fs.writeFileSync(path.join(app, 'supabase', 'config.toml'), config(project, ports));
  return { app, nested };
}

const context = (cwd, args = {}) => ({ cwd, args, env: { PATH: '' }, role: 'worker', now: 0 });
const lock = async (meta, fn) => ({ ok: true, locked: true, value: await fn(), meta });

test('the TOML subset and upward search read exactly the project and seven ports', (t) => {
  const { app, nested } = fixture(t);
  const parsed = parseSupabaseConfig(`# app\n${config('comment-safe')} # end`);
  assert.equal(parsed.projectId, 'comment-safe');
  assert.deepEqual(parsed.ports, PORTS);
  assert.equal(findSupabaseAppRoot(nested), app);
});

test('supabaseStart checks every listener then starts once under the host lock', async (t) => {
  const { app, nested } = fixture(t);
  const probed = [];
  const calls = [];
  const locks = [];
  const out = await supabaseStart(context(nested), {
    portListener: (port) => { probed.push(port); return null; },
    supabaseStart: (root, options) => { calls.push({ root, options }); return { status: 0, stdout: 'secret-bearing CLI output is discarded' }; },
    underHostLock: async (meta, fn) => { locks.push(meta); return { ok: true, locked: true, value: await fn() }; },
  });
  assert.equal(out.code, 0);
  assert.equal(out.data.project, 'lite-app');
  assert.equal(out.data.locked, true);
  assert.deepEqual(probed, Object.values(PORTS));
  assert.deepEqual(locks, [{ role: 'worker', purpose: 'supabase-start' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].root, app);
  assert.doesNotMatch(JSON.stringify(out), /secret-bearing/u);
});

test('supabaseStart table-driven policy refusals include the typed code and do not call the CLI', async (t) => {
  const cases = [
    { name: 'missing project id', project: '', ports: PORTS, match: /project_id must be present/u },
    { name: 'protected project', project: 'nivo-lite', ports: PORTS, match: /protected stack/u },
    { name: 'reserved port', project: 'lite-app', ports: { ...PORTS, api: 55322 }, match: /55322.*55321-55327/u },
  ];
  for (const item of cases) {
    await t.test(item.name, async (st) => {
      const { nested } = fixture(st, item.project, item.ports);
      let calls = 0;
      const out = await supabaseStart(context(nested), {
        portListener: () => null,
        supabaseStart: () => { calls += 1; return { status: 0 }; },
        underHostLock: lock,
      });
      assert.equal(out.code, 2);
      assert.equal(out.data.failureCode, 'SUPABASE_PORT_POLICY');
      assert.match(out.text, item.match);
      assert.equal(calls, 0);
    });
  }
});

test('supabaseStart reports a busy port and its holder before taking the lock', async (t) => {
  const { nested } = fixture(t);
  let locks = 0;
  const out = await supabaseStart(context(nested), {
    portListener: (port) => port === PORTS.studio ? { pid: 4321, commandLine: 'node busy-server.mjs' } : null,
    underHostLock: async (...args) => { locks += 1; return lock(...args); },
  });
  assert.equal(out.code, 2);
  assert.equal(out.data.failureCode, 'SUPABASE_PORT_POLICY');
  assert.match(out.text, /studio port 44833.*pid 4321.*busy-server/u);
  assert.equal(locks, 0);
});

test('supabaseStop passes the config project id and no-backup through, never --all', async (t) => {
  const { app, nested } = fixture(t, 'my-project');
  const calls = [];
  const out = await supabaseStop(context(nested, { 'no-backup': true }), {
    supabaseStop: (root, projectId, options) => { calls.push({ root, projectId, options }); return { status: 0 }; },
  });
  assert.equal(out.code, 0);
  assert.equal(out.data.project, 'my-project');
  assert.equal(out.data.noBackup, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].root, app);
  assert.equal(calls[0].projectId, 'my-project');
  assert.equal(calls[0].options.noBackup, true);
  assert.doesNotMatch(JSON.stringify(calls), /--all/u);
});

test('supabaseStatus returns fixed URLs and key names without any secret value', async (t) => {
  const { nested } = fixture(t, 'safe-project');
  const secrets = ['anon-value-123', 'service-value-456', 'jwt-value-789'];
  const stdout = JSON.stringify({
    API_URL: 'http://127.0.0.1:44830',
    STUDIO_URL: 'http://127.0.0.1:44833',
    DB_URL: 'postgresql://postgres:database-password@127.0.0.1:44831/postgres',
    ANON_KEY: secrets[0],
    SERVICE_ROLE_KEY: secrets[1],
    JWT_SECRET: secrets[2],
  });
  const out = await supabaseStatus(context(nested), { supabaseStatus: () => ({ status: 0, stdout }) });
  assert.equal(out.code, 0);
  assert.equal(out.data.schema, 'starci/supabase-status@1');
  assert.equal(out.data.running, true);
  assert.equal(out.data.project, 'safe-project');
  assert.deepEqual(out.data.ports, PORTS);
  assert.deepEqual(out.data.keyNames, ['ANON_KEY', 'JWT_SECRET', 'SERVICE_ROLE_KEY']);
  assert.equal(out.data.urls.api, 'http://127.0.0.1:44830');
  assert.match(out.data.urls.db, /\[redacted\]@127\.0\.0\.1:44831/u);
  const serialized = JSON.stringify(out);
  for (const secret of [...secrets, 'database-password']) assert.doesNotMatch(serialized, new RegExp(secret, 'u'));
  assert.match(out.text, /ANON_KEY, JWT_SECRET, SERVICE_ROLE_KEY/u);
});

test('supabaseStatus maps the CLI not-running answer to a clean stopped result', async (t) => {
  const { nested } = fixture(t);
  const out = await supabaseStatus(context(nested), {
    supabaseStatus: () => ({ status: 1, stdout: '', stderr: 'local development setup is not running' }),
  });
  assert.equal(out.code, 0);
  assert.equal(out.data.running, false);
  assert.deepEqual(out.data.urls, { api: null, studio: null, db: null });
});
