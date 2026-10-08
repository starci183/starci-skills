// sonar-stack.spec.mjs - `starci gate sonar up|stop` (scripts/gates/sonar-stack.mjs, sonar-host-secrets.mjs): the self-hosted Sonar stack of ext/sonar takes its
// secrets from the environment the runtime builds from secret.env. Docker never runs: the verb's Compose call owners are replaced by a recorder, and the real call
// owners (scripts/api/docker/compose-up.mjs, compose-stop.mjs) are run against node itself as the "docker" binary with a preload that records argv and exits. The
// missing-variable refusal, the child-environment-only hand-over and the absence of any secret file in ext/sonar are the contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sonarLocalMain } from '../../scripts/gates/sonar-local.mjs';
import { composeUp } from '../../scripts/api/docker/compose-up.mjs';
import { composeStop } from '../../scripts/api/docker/compose-stop.mjs';

const STACK_SECRETS = {
  SONARQUBE_DB_PASSWORD: 'db-secret-value-0007',
  SONARQUBE_ADMIN_PASSWORD: 'admin-secret-value-0008',
  CLOUDFLARE_TUNNEL_TOKEN: 'tunnel-secret-value-0009',
};

function temporary(t, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-sonar-${label}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/** A recorder standing in for the Compose call owners: it keeps each call's files, project, wait flag and child environment. */
const recorder = ({ status = 0, stderr = '' } = {}) => {
  const calls = [];
  const answer = (verb) => (request, options) => {
    calls.push({ verb, files: request.files.map((file) => path.basename(file)), projectName: request.projectName, wait: request.wait, cwd: options.cwd, env: options.env });
    return { status, stdout: '', stderr, error: null };
  };
  return { calls, runner: { up: answer('up'), stop: answer('stop') } };
};

const stackConfig = (root, composeRunner, env) => ({ host: 'http://localhost:9010', extRoot: path.join(root, 'ext-sonar'), composeRunner, runtimeSecretEnv: () => ({ ...env }) });

test('up hands the secret.env names and the published port to Compose in the child environment only, and the report carries no value', async (t) => {
  const root = temporary(t, 'stack-up');
  const { calls, runner } = recorder();
  const { exitCode, report } = await sonarLocalMain(['up'], { config: stackConfig(root, runner, STACK_SECRETS) });
  assert.equal(exitCode, 0, JSON.stringify(report));
  assert.deepEqual([report.command, report.outcome, report.files], ['up', 'up', ['compose.yaml']]);
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.deepEqual([call.verb, call.files, call.projectName, call.wait, call.cwd], ['up', ['compose.yaml'], 'starci', false, path.join(root, 'ext-sonar')]);
  for (const [name, value] of Object.entries(STACK_SECRETS)) assert.equal(call.env[name], value, `${name} reaches the child environment`);
  assert.equal(call.env.STARCI_PORT_SONARQUBE, '9010', 'the published port is derived from the declared host');
  for (const value of Object.values(STACK_SECRETS)) assert.ok(!JSON.stringify(report).includes(value), 'the report carries no stack secret');
});

test('up --public adds the tunnel file and refuses without CLOUDFLARE_TUNNEL_TOKEN, naming it, before any Compose call', async (t) => {
  const root = temporary(t, 'stack-public');
  const { calls, runner } = recorder();
  const { CLOUDFLARE_TUNNEL_TOKEN: omitted, ...withoutTunnel } = STACK_SECRETS;
  assert.ok(omitted);
  const refused = await sonarLocalMain(['up', '--public'], { config: stackConfig(root, runner, withoutTunnel) });
  assert.equal(refused.exitCode, 2);
  assert.deepEqual([refused.report.outcome, refused.report.refusal.code, refused.report.refusal.variables], ['blocked', 'sonar-host-secret-missing', ['CLOUDFLARE_TUNNEL_TOKEN']]);
  assert.match(refused.report.message, /CLOUDFLARE_TUNNEL_TOKEN is not set: add it to \.claude\/secret\.env/);
  assert.equal(calls.length, 0);
  const local = await sonarLocalMain(['up'], { config: stackConfig(root, runner, withoutTunnel) });
  assert.equal(local.exitCode, 0, 'the local server needs no tunnel token');
  const started = await sonarLocalMain(['up', '--public'], { config: stackConfig(root, runner, STACK_SECRETS) });
  assert.equal(started.exitCode, 0, JSON.stringify(started.report));
  assert.deepEqual(started.report.files, ['compose.yaml', 'cloudflared.yaml']);
  assert.equal(calls.at(-1).env.CLOUDFLARE_TUNNEL_TOKEN, STACK_SECRETS.CLOUDFLARE_TUNNEL_TOKEN);
});

test('up refuses naming every missing variable, counts blank and template values as missing, and starts nothing', async (t) => {
  const root = temporary(t, 'stack-missing');
  const { calls, runner } = recorder();
  const { exitCode, report } = await sonarLocalMain(['up'], { config: stackConfig(root, runner, { SONARQUBE_DB_PASSWORD: '   ', SONARQUBE_ADMIN_PASSWORD: 'REPLACE_ME' }) });
  assert.equal(exitCode, 2);
  assert.deepEqual(report.refusal.variables, ['SONARQUBE_DB_PASSWORD', 'SONARQUBE_ADMIN_PASSWORD']);
  assert.match(report.message, /SONARQUBE_DB_PASSWORD, SONARQUBE_ADMIN_PASSWORD are not set/);
  assert.equal(calls.length, 0, 'no container is started without its secrets');
});

test('a failing Compose is a blocked report whose message is scrubbed of the secrets it echoed', async (t) => {
  const root = temporary(t, 'stack-compose-fails');
  const { runner } = recorder({ status: 1, stderr: `error: ${STACK_SECRETS.SONARQUBE_DB_PASSWORD} was rejected` });
  const { exitCode, report } = await sonarLocalMain(['up'], { config: stackConfig(root, runner, STACK_SECRETS) });
  assert.equal(exitCode, 2);
  assert.equal(report.outcome, 'blocked');
  assert.match(report.message, /docker compose up exited 1/);
  assert.ok(!JSON.stringify(report).includes(STACK_SECRETS.SONARQUBE_DB_PASSWORD), 'the child echoed the password; the report does not');
});

test('stop needs no secret: an absent variable never refuses it, and it stops the same files', async (t) => {
  const root = temporary(t, 'stack-stop');
  const { calls, runner } = recorder();
  const { exitCode, report } = await sonarLocalMain(['stop', '--public'], { config: stackConfig(root, runner, {}) });
  assert.equal(exitCode, 0, JSON.stringify(report));
  assert.deepEqual([report.command, report.outcome, report.files], ['stop', 'ok', ['compose.yaml', 'cloudflared.yaml']]);
  assert.deepEqual([calls[0].verb, calls[0].files], ['stop', ['compose.yaml', 'cloudflared.yaml']]);
  assert.ok(Object.keys(STACK_SECRETS).every((name) => !/secret-value/.test(String(calls[0].env[name]))), 'no owner secret was needed');
});

test('the real Compose call owners put the secrets in the child environment and none on argv; up does not wait, stop does not remove', (t) => {
  const root = temporary(t, 'stack-call-owners');
  const log = path.join(root, 'calls.jsonl');
  const preload = path.join(root, 'record.mjs');
  fs.writeFileSync(preload, `import fs from 'node:fs';
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: process.argv.slice(1), db: process.env.SONARQUBE_DB_PASSWORD ?? null }) + '\\n');
process.exit(0);
`);
  const env = { ...process.env, ...STACK_SECRETS, NODE_OPTIONS: `--import ${pathToFileURL(preload).href}` };
  const files = [path.join(root, 'compose.yaml')];
  const up = composeUp({ files, projectName: 'starci', wait: false }, { cwd: root, docker: process.execPath, env });
  const stop = composeStop({ files, projectName: 'starci' }, { cwd: root, docker: process.execPath, env });
  assert.deepEqual([up.status, stop.status], [0, 0], `${up.stderr}${stop.stderr}`);
  // node resolves the first argument (`compose`) as its main script: argv[0] below is that resolved path, the rest are the arguments as given.
  const [upCall, stopCall] = fs.readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).map((call) => ({ ...call, first: path.basename(call.argv[0]), argv: ['compose', ...call.argv.slice(1)] }));
  assert.deepEqual([upCall.first, stopCall.first], ['compose', 'compose']);
  assert.deepEqual(upCall.argv, ['compose', '--project-directory', root, '-f', files[0], '--project-name', 'starci', 'up', '-d']);
  assert.deepEqual(stopCall.argv, ['compose', '--project-directory', root, '-f', files[0], '--project-name', 'starci', 'stop']);
  assert.equal(upCall.db, STACK_SECRETS.SONARQUBE_DB_PASSWORD, 'the child environment carries the secret');
  for (const call of [upCall, stopCall]) for (const value of Object.values(STACK_SECRETS)) assert.ok(!call.argv.join(' ').includes(value), 'no secret on argv');
});

test('the Compose files of ext/sonar hold no secret and read every one from the environment', () => {
  const dir = path.resolve(import.meta.dirname, '..', '..', 'ext', 'sonar');
  const compose = fs.readFileSync(path.join(dir, 'compose.yaml'), 'utf8');
  const tunnel = fs.readFileSync(path.join(dir, 'cloudflared.yaml'), 'utf8');
  for (const name of ['SONARQUBE_DB_PASSWORD', 'SONARQUBE_ADMIN_PASSWORD']) assert.match(compose, new RegExp(`\\$\\{${name}:\\?`), `${name} is required from the environment`);
  assert.match(tunnel, /\$\{CLOUDFLARE_TUNNEL_TOKEN:\?/);
  assert.doesNotMatch(compose + tunnel, /secrets\/|\/run\/secrets|REPLACE_ME/, 'no mounted secret file and no placeholder password');
  assert.equal(fs.existsSync(path.join(dir, 'secrets')), false, 'the extension holds no custody directory');
});
