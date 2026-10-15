// verify.mjs - functional verification after convergence: the declared HTTP journeys (config.verify.http) and the declared checks inside a
// running task (config.verify.exec). Probes are bounded and read-only; a POST body comes only from the declared config and nothing here
// mutates business data. HTTP goes through ctx.fetch, docker through ctx.spawn, waits through ctx.sleep and time through ctx.now.
import { isDeepStrictEqual } from 'node:util';
import { eachInOrder, repeatInOrder } from '../runtime/scripts/lib/in-order.mjs';
import { lines as splitLines, tool } from './context.mjs';

const RETRY_MS = 6000;
const HTTP_TIMEOUT_MS = 8000;

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

/** Runs one check, retrying every 6 s up to `retrySeconds` when `retry` is set; records { name, ok, detail }. */
async function runCheck(ctx, results, name, run, { retry = false, retrySeconds = 0 } = {}) {
  const deadline = ctx.now() + (retry ? retrySeconds * 1000 : 0);
  const outcome = await repeatInOrder(async () => {
    try {
      return { ok: true, detail: await run() };
    } catch (error) {
      if (ctx.now() >= deadline) return { ok: false, detail: String(error.message) };
      await ctx.sleep(RETRY_MS);
      return undefined;
    }
  });
  results.push({ name, ...outcome });
}

function checkJson(text, expected) {
  let body;
  try { body = JSON.parse(text); } catch { throw new Error('body is not JSON'); }
  for (const [key, value] of Object.entries(expected)) expect(isDeepStrictEqual(body?.[key], value), `body.${key} is not the declared value`);
}

/** One declared HTTP journey; throws a message when the answer is not the declared one. */
async function probeHttp(ctx, check) {
  const init = { method: check.method, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) };
  if (check.body !== null) Object.assign(init, { body: check.body, headers: { 'content-type': 'application/json' } });
  const response = await ctx.fetch(check.url, init);
  expect(response.status === check.status, `HTTP ${response.status}`);
  const text = check.json === null && check.contains === null ? '' : await response.text();
  if (check.json !== null) checkJson(text, check.json);
  if (check.contains !== null) expect(text.includes(check.contains), `no ${check.contains} in the answer`);
  return String(response.status);
}

/** `docker exec` of a declared command in the running container; exit 0 and, when declared, stdout matching the regex. */
function probeExec(ctx, container, check) {
  const run = tool(ctx, 'docker', ['exec', container, ...check.command]);
  expect(run.status === 0, `exit ${run.status}`);
  if (check.stdout === null) return 'ok';
  expect(new RegExp(check.stdout, 'u').test(run.stdout), `stdout does not match ${check.stdout}`);
  return run.stdout.trim();
}

/** The running-task check of one service, then its declared commands (skipped when no task runs). */
async function verifyService(ctx, config, results, service) {
  const found = tool(ctx, 'docker', ['ps', '-q', '--filter', `label=com.docker.swarm.service.name=${config.stack}_${service}`, '--filter', 'status=running']);
  const container = splitLines(found.stdout)[0];
  await runCheck(ctx, results, `a ${service} task is running on this manager`, () => {
    expect(container, `no running container of ${config.stack}_${service} on the daemon`);
    return container.slice(0, 12);
  });
  if (!container) return;
  await eachInOrder(config.verify.exec.filter((entry) => entry.service === service), (check) => runCheck(ctx, results, check.name, () => probeExec(ctx, container, check)));
}

const verifyExec = (ctx, config, results) => eachInOrder([...new Set(config.verify.exec.map((check) => check.service))], (service) => verifyService(ctx, config, results, service));

/**
 * Runs the declared verification. Returns { ok, lines, data: { checks: [{ name, ok }] } }; the lines read `PASS|FAIL  name  detail`.
 * `skipPublic` skips the HTTP journeys, `skipInternal` the checks inside a task.
 */
export async function verifyStack(ctx, config, { retrySeconds = 180, skipPublic = false, skipInternal = false } = {}) {
  const results = [];
  if (!skipPublic) await eachInOrder(config.verify.http, (check) => runCheck(ctx, results, check.name, () => probeHttp(ctx, check), { retry: check.retry, retrySeconds }));
  if (!skipInternal) await verifyExec(ctx, config, results);
  return {
    ok: results.every((entry) => entry.ok),
    lines: results.map((entry) => `${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}  ${entry.detail}`),
    data: { checks: results.map(({ name, ok }) => ({ name, ok })) },
  };
}
