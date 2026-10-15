// context.mjs - the seams every stack module runs through: spawning tools, sleeping, the clock and the output.
// Production uses the real implementations; the specs inject fakes (tests/helpers/stack-fakes.mjs).
import { spawnSync } from 'node:child_process';

const MAX_BUFFER = 1 << 24;

const realSpawn = (command, args, options = {}) => {
  const run = spawnSync(command, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, ...options });
  return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '', error: run.error };
};

const realSleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

/**
 * The context of one stack invocation.
 *   cwd, env       the app root and the process environment
 *   spawn          (command, args, { input, env, cwd }) -> { status, stdout, stderr, error }; never a shell
 *   sleep, now     await sleep(ms); now() -> epoch ms
 *   stdout, stderr text writers
 *   sops           the secret seam (decrypt(file, format) -> map; decryptBinary(file) -> text); created lazily by the caller
 */
export function stackContext(io = {}) {
  return Object.freeze({
    cwd: io.cwd ?? process.cwd(),
    env: io.env ?? process.env,
    spawn: io.spawn ?? realSpawn,
    sleep: io.sleep ?? realSleep,
    now: io.now ?? Date.now,
    stdout: io.stdout ?? ((text) => process.stdout.write(text)),
    stderr: io.stderr ?? ((text) => process.stderr.write(text)),
    sops: io.sops,
    fs: io.fs,
  });
}

/** Runs one tool; `env` replaces the child environment when given, `input` is written to its stdin. */
export const tool = (ctx, command, args, options = {}) => ctx.spawn(command, args, options);

/** Runs a tool and returns stdout, or throws the first stderr line. Used where a failure has no recovery. */
export function toolOutput(ctx, command, args, options = {}) {
  const run = tool(ctx, command, args, options);
  if (run.error) throw new Error(`cannot run ${command} (${run.error.message})`);
  if (run.status !== 0) throw new Error(`${command} ${args.slice(0, 2).join(' ')}: ${firstLine(run.stderr)}`);
  return run.stdout;
}

export const firstLine = (text) => String(text ?? '').trim().split(/\r?\n/u)[0];
export const lines = (text) => String(text ?? '').split(/\r?\n/u).filter(Boolean);
