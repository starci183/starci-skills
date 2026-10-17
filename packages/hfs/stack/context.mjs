// context.mjs - the seams every stack module runs through: spawning tools, sleeping, the clock and the output.
// Production uses the real implementations; a spec injects fakes.
import { spawn, spawnSync } from 'node:child_process';
import { defaultSops } from '../runtime/scripts/hfs/secret-sops.mjs';

const MAX_BUFFER = 1 << 24;

const realSpawn = (command, args, options = {}) => {
  if (options.background) {
    const childOptions = { ...options };
    delete childOptions.background;
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true, ...childOptions });
    child.on('error', (error) => { child.spawnError = error; });
    return child;
  }
  const run = spawnSync(command, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, ...options });
  return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '', error: run.error };
};

const realSleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

/**
 * The context of one stack invocation.
 *   cwd, env       the app root and the process environment
 *   spawn          (command, args, { input, env, cwd }) -> { status, stdout, stderr, error }; never a shell
 *                  { background: true } -> ChildProcess, owned and killed by the command session
 *   platform       POSIX control master or win32 loopback tunnel; sshPath optionally selects the POSIX SSH executable
 *   sleep, now     await sleep(ms); now() -> epoch ms
 *   stdout, stderr text writers
 *   fetch          the HTTP seam of verify (url, init) -> Response
 *   sops           the secret seam (decrypt(file, format) -> map; decryptBinary(file) -> text); `io.sops` or, on first use, the app's own sops/age tools
 */
export function stackContext(io = {}) {
  const cwd = io.cwd ?? process.cwd();
  const env = io.env ?? process.env;
  let sops = io.sops;
  return Object.freeze({
    cwd,
    env,
    spawn: io.spawn ?? realSpawn,
    platform: io.platform ?? process.platform,
    username: io.username,
    sshPath: io.sshPath,
    sleep: io.sleep ?? realSleep,
    now: io.now ?? Date.now,
    stdout: io.stdout ?? ((text) => process.stdout.write(text)),
    stderr: io.stderr ?? ((text) => process.stderr.write(text)),
    fetch: io.fetch ?? globalThis.fetch,
    /** The secret seam: the app's own sops/age tools, created on first use so verbs that open no custody never need them. */
    get sops() {
      sops ??= defaultSops(env, cwd);
      return sops;
    },
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
