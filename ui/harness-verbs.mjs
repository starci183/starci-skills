// harness-verbs.mjs - adapt harness lifecycle functions to the function-backed CLI result contract.
import { harnessStatus, harnessUrl, openHarness, startHarness, stopHarness } from './harness-process.mjs';

const errorText = (verb, error) => `starci harness ${verb}: ${String(error?.message ?? error)}`;

/** Run the selected harness mode until its in-process server and child process have stopped. */
export async function harnessStartVerb(ctx, deps = {}) {
  const tunnel = ctx.args?.tunnel === true;
  try {
    const target = deps.url ?? await (deps.harnessUrl ?? harnessUrl)({ tunnel });
    const run = (deps.startHarness ?? startHarness)({
      tunnel,
      env: ctx.env,
      now: ctx.now,
      ...deps.startOptions,
    });
    ctx.io?.stdout?.(`StarCi harness: ${target}\n`);
    const result = await run.done;
    return { code: Number(result?.code) === 0 ? 0 : 1 };
  } catch (error) {
    return { code: 1, stderr: errorText('start', error) };
  }
}

/**
 * Stop recorded harness processes through the lifecycle owner and format its CLI result.
 * Passes `ctx.env` and `deps.stopOptions`; the default owner clears stale records,
 * stops verified parents and retains identity mismatches as refusals.
 * Returns `{code,text,data}` with code 0 when no stop is refused; exceptions become
 * `{code:1,stderr}`. `deps.stopHarness` may replace the lifecycle call.
 */
export async function harnessStopVerb(ctx, deps = {}) {
  try {
    const result = await (deps.stopHarness ?? stopHarness)({ env: ctx.env, ...deps.stopOptions });
    const stopped = result.stopped.length ? `: ${result.stopped.map((item) => String(item.mode) + ' pid ' + String(item.pid)).join(', ')}` : '';
    const refused = result.refused.length ? `; refused ${result.refused.map((item) => String(item.mode) + ' pid ' + String(item.pid) + ': ' + String(item.reason)).join(', ')}` : '';
    return { code: result.ok ? 0 : 1, text: `harness ${result.action}${stopped}${refused}`, data: result };
  } catch (error) {
    return { code: 1, stderr: errorText('stop', error) };
  }
}

/**
 * Format the local harness health probe as CLI text and structured data.
 * The default reader probes `/healthz`; `{code,text,data}` reports code 0 for a
 * healthy result and code 1 for down or failed probes. Exceptions return code 1
 * with stderr. `deps.statusOptions` and `deps.harnessStatus` configure the read.
 */
export async function harnessStatusVerb(_ctx, deps = {}) {
  try {
    const result = await (deps.harnessStatus ?? harnessStatus)(deps.statusOptions ?? {});
    return {
      code: result.ok ? 0 : 1,
      text: `harness ${result.running ? 'UP' : 'DOWN'}: ${result.url}${result.error ? ' (' + String(result.error) + ')' : ''}`,
      data: result,
    };
  } catch (error) {
    return { code: 1, stderr: errorText('status', error) };
  }
}

/**
 * Request the default browser to open the local harness URL through the lifecycle owner.
 * `deps.openOptions` configures the request and `deps.openHarness` may replace it.
 * A successful launch receipt returns `{code:0,text,data}` without waiting for
 * navigation; a refused launch returns `{code:1,stderr,data}` and exceptions
 * return `{code:1,stderr}`.
 */
export async function harnessOpenVerb(_ctx, deps = {}) {
  try {
    const result = await (deps.openHarness ?? openHarness)(deps.openOptions ?? {});
    return result.ok
      ? { code: 0, text: `opened ${result.url}`, data: result }
      : { code: 1, stderr: `starci: could not open ${result.url}: ${result.error}`, data: result };
  } catch (error) {
    return { code: 1, stderr: errorText('open', error) };
  }
}
