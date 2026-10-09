// in-process.mjs - run one `scripts/kernel/cli.mjs` verb inside the calling process, by the same code path as the bin.
//
// The bin (scripts/kernel/cli.mjs run by node) is a thin wrapper: `main(argv)` is the whole of it. A spec that needs a verb's receipt - its stdout, its stderr
// and its exit code - for many steps against one fixture pays a node start and a module graph load per step when it spawns the bin. This entry runs
// `main(argv)` in the spec's own process, so the modules load once. It is the bin's code, not a double: what a verb prints goes to a capture, what it
// sets as `process.exitCode` or exits with (`process.exit`) is the receipt's status, and the process-wide state a verb reads - argv, env, cwd - is
// the caller's for the run and put back after. Runs are serialized (one verb at a time owns that state).
import path from 'node:path';

class ExitSignal extends Error {
  constructor(code) { super(`process.exit(${code})`); this.code = code; }
}

let queue = Promise.resolve();

/** Replace the keys of `process.env` with `env` and return the function that puts the old ones back. */
function swapEnv(env) {
  const before = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  return () => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, before); };
}

/** Capture what the verb writes through console and the process streams; returns {out, err, restore}. */
function capture() {
  const out = [], err = [];
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error, stdout: process.stdout.write, stderr: process.stderr.write };
  const line = (sink) => (...parts) => { sink.push(`${parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ')}\n`); };
  console.log = line(out); console.info = line(out); console.warn = line(err); console.error = line(err);
  process.stdout.write = (chunk) => { out.push(String(chunk)); return true; };
  process.stderr.write = (chunk) => { err.push(String(chunk)); return true; };
  const restore = () => {
    console.log = originals.log; console.info = originals.info; console.warn = originals.warn; console.error = originals.error;
    process.stdout.write = originals.stdout; process.stderr.write = originals.stderr;
  };
  return { out, err, restore };
}

async function execute(argv, { env, cwd }) {
  const saved = { argv: process.argv, cwd: process.cwd(), exitCode: process.exitCode, exit: process.exit };
  const restoreEnv = swapEnv(env);
  const io = capture();
  process.argv = [process.execPath, path.join(import.meta.dirname, 'cli.mjs'), ...argv];
  process.exitCode = undefined;
  process.exit = (code) => { throw new ExitSignal(code ?? process.exitCode ?? 0); };
  let status = 0;
  try {
    if (cwd) process.chdir(cwd);
    const { main } = await import('./cli.mjs');
    await main(argv);
    status = Number(process.exitCode ?? 0);
  } catch (error) {
    if (error instanceof ExitSignal) status = Number(error.code ?? 0);
    else { io.err.push(`${error?.stack ?? error}\n`); status = 1; }
  } finally {
    io.restore();
    process.exit = saved.exit; process.argv = saved.argv; process.exitCode = saved.exitCode;
    restoreEnv();
    process.chdir(saved.cwd);
  }
  return { status, stdout: io.out.join(''), stderr: io.err.join(''), signal: null, error: null };
}

/**
 * Run `cli.mjs <argv...>` in this process with `env` as the environment and `cwd` as the directory. Resolves to the receipt
 * {status, stdout, stderr}: the shape `spawnSync(process.execPath, [cli, ...argv])` gives, so a spec swaps one for the other.
 */
export function runKernelVerb(argv, { env = process.env, cwd = null } = {}) {
  const run = queue.then(() => execute(argv, { env: { ...env }, cwd }));
  queue = run.catch(() => {});
  return run;
}
