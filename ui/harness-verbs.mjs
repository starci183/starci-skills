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
      ...(deps.startOptions ?? {}),
    });
    ctx.io?.stdout?.(`StarCi harness: ${target}\n`);
    const result = await run.done;
    return { code: Number(result?.code) === 0 ? 0 : 1 };
  } catch (error) {
    return { code: 1, stderr: errorText('start', error) };
  }
}

export async function harnessStopVerb(ctx, deps = {}) {
  try {
    const result = await (deps.stopHarness ?? stopHarness)({ env: ctx.env, ...(deps.stopOptions ?? {}) });
    const stopped = result.stopped.length ? `: ${result.stopped.map((item) => `${item.mode} pid ${item.pid}`).join(', ')}` : '';
    const refused = result.refused.length ? `; refused ${result.refused.map((item) => `${item.mode} pid ${item.pid}: ${item.reason}`).join(', ')}` : '';
    return { code: result.ok ? 0 : 1, text: `harness ${result.action}${stopped}${refused}`, data: result };
  } catch (error) {
    return { code: 1, stderr: errorText('stop', error) };
  }
}

export async function harnessStatusVerb(_ctx, deps = {}) {
  try {
    const result = await (deps.harnessStatus ?? harnessStatus)(deps.statusOptions ?? {});
    return {
      code: result.ok ? 0 : 1,
      text: `harness ${result.running ? 'UP' : 'DOWN'}: ${result.url}${result.error ? ` (${result.error})` : ''}`,
      data: result,
    };
  } catch (error) {
    return { code: 1, stderr: errorText('status', error) };
  }
}

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
