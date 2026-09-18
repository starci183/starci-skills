'use strict';

/**
 * The run-owned ephemeral stack: docker compose project + the api process, both started and disposed by
 * this suite, on this run, with names the run generated. Nothing here can reach the dev stack: every
 * host port is allocated from the OS at run time on 127.0.0.1, the compose project name and its volume
 * are run-scoped, and disposal is `docker compose down -v` against that one project name only.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { freePorts, runToken, secret, retryUntil } = require('./ports');
const journal = require('./journal');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const COMPOSE_FILE = path.join(BACKEND_ROOT, 'test', 'e2e', 'stack', 'compose.e2e.yaml');
const REALM = 'todo';
const PUBLIC_CLIENT = 'todo-api';

function sh(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: BACKEND_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

function compose(args, options) {
  return sh('docker', ['compose', '-p', options.project, '-f', COMPOSE_FILE, ...args], options);
}

async function httpOk(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  return response.status;
}

/** Starts the ephemeral services and waits until each one answers on its allocated loopback port. */
async function startServices() {
  const [pgPort, kcPort, redisPort, apiPort] = await freePorts(4);
  const token = runToken();
  const project = `todo-app-e2e-${token}`;
  const options = {
    project,
    env: {
      ...process.env,
      E2E_COMPOSE_PROJECT: project,
      E2E_PG_PORT: String(pgPort),
      E2E_KC_PORT: String(kcPort),
      E2E_REDIS_PORT: String(redisPort),
      E2E_PG_USER: 'e2e',
      E2E_PG_PASSWORD: secret(),
      E2E_PG_DB: 'todo',
      E2E_KC_ADMIN: 'e2e-admin',
      E2E_KC_ADMIN_PASSWORD: secret(),
    },
  };

  const up = compose(['up', '-d', '--wait'], options);
  if (up.status !== 0) {
    throw new Error(`docker compose up failed (exit ${up.status}):\n${up.stderr || up.stdout}`);
  }

  const pgIsReady = () => {
    const probe = compose(
      ['exec', '-T', 'postgres', 'pg_isready', '-U', options.env.E2E_PG_USER, '-d', options.env.E2E_PG_DB],
      options,
    );
    return probe.status === 0;
  };
  const redisIsReady = () => compose(['exec', '-T', 'redis', 'redis-cli', 'ping'], options).stdout.trim() === 'PONG';
  const keycloakIsReady = async () => (await httpOk(`http://127.0.0.1:${kcPort}/realms/${REALM}`)) === 200;

  const readiness = [];
  readiness.push(await retryUntil('postgres:5432', 120_000, async () => pgIsReady()));
  readiness.push(await retryUntil('redis:6379', 60_000, async () => redisIsReady()));
  readiness.push(await retryUntil(`keycloak:/realms/${REALM}`, 240_000, keycloakIsReady));

  const psql = (sql) => {
    const run = compose(['exec', '-T', 'postgres', 'psql', '-U', options.env.E2E_PG_USER, '-d', options.env.E2E_PG_DB, '-tAc', sql], options);
    if (run.status !== 0) throw new Error(`psql failed: ${run.stderr}`);
    return run.stdout.trim();
  };

  // Observed identity, not hostname inference: ask each service who it is, over the same loopback port
  // the scenarios will use.
  const identity = {
    postgres: {
      serverVersion: psql('select version()'),
      database: psql('select current_database()'),
      tablesBeforeApiBoot: psql("select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema='public'"),
    },
    keycloak: await fetch(`http://127.0.0.1:${kcPort}/realms/${REALM}`).then((r) => r.json())
      .then((realm) => ({
        realm: realm.realm,
        enabled: realm.enabled,
        notBefore: realm.notBefore,
        supportedPublicClients: (realm.clients ?? []).filter((c) => c.publicClient).map((c) => c.clientId),
      })),
    redis: {
      ping: compose(['exec', '-T', 'redis', 'redis-cli', 'ping'], options).stdout.trim(),
      serverVersion: compose(['exec', '-T', 'redis', 'redis-cli', 'info', 'server'], options).stdout
        .split('\n').find((line) => line.startsWith('redis_version:'))?.trim() ?? 'unknown',
    },
  };

  return { project, options, pgPort, kcPort, redisPort, apiPort, identity, readiness, env: options.env };
}

/** Postgres observation taken after the api booted, so the tables TypeORM's synchronize pass creates are
 * visible too - this is what proves the scenarios ran against a real schema and not an empty one. The
 * tracked seed creates only `tasks`; every other table below exists because the api's own synchronize
 * pass made it, on this run's volume, and nothing else. There is no `persons` table at all: a person is
 * Keycloak's subject claim, so the row count that matters for identity is `sessions`. */
function postgresSchemaAfterBoot(stack) {
  const psql = (sql) => {
    const run = compose(['exec', '-T', 'postgres', 'psql', '-U', stack.env.E2E_PG_USER, '-d', stack.env.E2E_PG_DB, '-tAc', sql], stack.options);
    if (run.status !== 0) throw new Error(`psql failed: ${run.stderr}`);
    return run.stdout.trim();
  };
  const tables = psql("select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema='public'")
    .split(',').map((name) => name.trim()).filter(Boolean);
  const rows = Object.fromEntries(tables.map((table) => [table, Number(psql(`select count(*) from ${table}`))]));
  return { tables, rows };
}

/** Starts the api as a child process of this run, pointed only at the services started above. */
function startApi(stack) {
  const nodeEnv = {
    ...process.env,
    // The dev stack runs this process on the host with the declared development env, and the schema the
    // scenarios use comes from TypeORM's synchronize pass on first boot (the tracked seed creates only
    // `tasks`) - TYPEORM_SYNCHRONIZE is AppConfigService's own documented knob for it.
    NODE_ENV: 'dev',
    TYPEORM_SYNCHRONIZE: 'true',
    HOSTNAME: '127.0.0.1',
    PORT: String(stack.apiPort),
    DATABASE_URL: `postgres://${stack.env.E2E_PG_USER}:${stack.env.E2E_PG_PASSWORD}@127.0.0.1:${stack.pgPort}/${stack.env.E2E_PG_DB}`,
    REDIS_URL: `redis://127.0.0.1:${stack.redisPort}`,
    KEYCLOAK_URL: `http://127.0.0.1:${stack.kcPort}`,
    KEYCLOAK_REALM: REALM,
    KEYCLOAK_PUBLIC_CLIENT: PUBLIC_CLIENT,
    TASK_SESSION_SECRET: secret(),
    DATA_ENCRYPTION_KEY: secret(32),
    // integration.recur.scheduler's declared interval is every 5 minutes; the run overrides it through
    // the same env the dev live-proof script uses so a scenario can observe a real in-process tick
    // materialise real rows without a 5-minute wait.
    RECUR_TICK_CRON: process.env.E2E_RECUR_TICK_CRON ?? '* * * * * *',
    // No scenario in this suite proves the notify transport. This pins the one outbound-network effect
    // the app can attempt to a loopback port nothing listens on, so an accidental send fails locally
    // instead of reaching a real MX.
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1',
    SMTP_SECURE: 'false',
    SMTP_USER: 'e2e',
    SMTP_PASS: secret(),
    SMTP_DEFAULT_FROM: 'e2e@localhost',
    SEPAY_MODE: 'disabled',
  };
  const logPath = journal.file('api.log');
  const child = spawn(process.execPath, [path.join(BACKEND_ROOT, 'dist', 'main.js')], {
    cwd: BACKEND_ROOT,
    env: nodeEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const append = (chunk) => fs.appendFileSync(logPath, chunk);
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return { child, logPath, baseUrl: `http://127.0.0.1:${stack.apiPort}` };
}

/**
 * Readiness of the process this run just spawned, on the port this run just allocated. `/health` is the
 * app's one unauthenticated door, and the port is not one any other stack on this machine is bound to,
 * so a 200 here is an observation and not an inference from a hostname.
 */
async function waitForApi(api) {
  const probe = async () => {
    const status = await httpOk(`${api.baseUrl}/health`);
    if (status !== 200) return false;
    const body = await fetch(`${api.baseUrl}/health`).then((response) => response.json());
    return body?.status === 'ok';
  };
  return retryUntil(`api /health on ${api.baseUrl}`, 120_000, probe);
}

/** `docker compose ps --format json` for this project only: the exact container identities this run used. */
function serviceIdentities(stack) {
  const run = compose(['ps', '--format', 'json', '--all'], stack.options);
  const lines = run.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => {
    const record = JSON.parse(line);
    return {
      service: record.Service,
      name: record.Name,
      id: record.Id,
      image: record.Image,
      state: record.State,
      health: record.Health ?? null,
      ports: (record.Publishers ?? []).map((p) => `${p.URL ?? '127.0.0.1'}:${p.publishedPort ?? p.Published ?? p.publishedPort}->${p.targetPort ?? p.Target}`),
    };
  });
}

/** Disposes exactly what this run created, then verifies by observation that it is gone. */
async function stopAll(stack, api) {
  const steps = [];
  if (api?.child && api.child.exitCode === null) {
    const killed = !api.child.kill('SIGTERM');
    steps.push({ step: 'terminate api process', pid: api.child.pid, signalSent: killed });
    if (!killed) spawn('taskkill', ['/PID', String(api.child.pid), '/T', '/F'], { shell: true });
  }
  const down = compose(['down', '-v', '--remove-orphans', '--timeout', '20'], stack.options);
  steps.push({ step: 'docker compose down -v --remove-orphans', project: stack.project, exit: down.status, stderr: down.stderr?.trim() || undefined });
  const containers = sh('docker', ['ps', '-a', '--filter', `label=com.docker.compose.project=${stack.project}`, '--format', '{{.Names}}']).stdout.trim();
  const volumes = sh('docker', ['volume', 'ls', '--filter', `name=${stack.project}`, '--format', '{{.Name}}']).stdout.trim();
  steps.push({ step: 'verify no container of this project remains', project: stack.project, containers: containers || '(none)' });
  steps.push({ step: 'verify no volume of this project remains', project: stack.project, volumes: volumes || '(none)' });
  return { steps, clean: !containers && !volumes };
}

module.exports = { startServices, postgresSchemaAfterBoot, startApi, waitForApi, serviceIdentities, stopAll, BACKEND_ROOT, COMPOSE_FILE, REALM };
