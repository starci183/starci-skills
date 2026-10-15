// cli.mjs - `starci app stack <action>` for the Swarm deploy tooling: flags, dry run versus --execute, dispatch, text and --json output.
//   starci app stack prepare|doctor|connect|disconnect|build-args|render|deploy|converge|verify|rollback|prune|backup|jobs --env <env> [flags]
// (up, down and status are the test-world verbs and are dispatched by packages/hfs/src/main.mjs.)
// Every action module exports one async function (ctx, config, options) -> { ok, lines, data }; a refusal throws StackError.
import path from 'node:path';
import { stackContext } from './context.mjs';
import { loadDeployConfig } from './config.mjs';
import { StackError, EXIT, refusal } from './errors.mjs';

export const ACTIONS = Object.freeze(['prepare', 'doctor', 'connect', 'disconnect', 'build-args', 'render', 'deploy', 'converge', 'verify', 'rollback', 'prune', 'backup', 'jobs', 'ingress']);

const BOOLEAN = new Set(['--execute', '--json', '--swarm-state', '--init-swarm', '--owner-approved', '--skip-public', '--skip-internal', '--allow-unpinned']);
const VALUE = new Set(['--env', '--image', '--source-sha', '--previous', '--out', '--release', '--since', '--timeout', '--retry', '--keep', '--app', '--ssh-cmd', '--extra-compose']);
const REPEAT = new Set(['--image', '--keep', '--extra-compose']);

/** Splits argv into { flags, positional }; an unknown flag or a flag without its value is a refusal. */
export function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (BOOLEAN.has(arg)) flags[arg.slice(2)] = true;
    else if (VALUE.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw refusal('STACK_USAGE', `${arg} needs a value`);
      index += 1;
      const key = arg.slice(2);
      flags[key] = REPEAT.has(arg) ? [...(flags[key] ?? []), value] : value;
    } else if (arg.startsWith('--')) throw refusal('STACK_USAGE', `unknown flag ${arg}`);
    else positional.push(arg);
  }
  return { flags, positional };
}

/** `--image api=ghcr.io/o/x@sha256:...` (repeatable or comma separated) -> { api: 'ghcr.io/o/x@sha256:...' }. */
export function parseImages(values = []) {
  const out = {};
  for (const item of values.flatMap((value) => value.split(','))) {
    const at = item.indexOf('=');
    const service = item.slice(0, at);
    if (at < 1 || at === item.length - 1 || Object.hasOwn(out, service)) throw refusal('STACK_USAGE', `--image takes <service>=<reference>, once per service (got ${service || item})`);
    out[service] = item.slice(at + 1);
  }
  return out;
}

const number = (flags, name) => {
  if (flags[name] === undefined) return undefined;
  const value = Number(flags[name]);
  if (!Number.isFinite(value) || value < 0) throw refusal('STACK_USAGE', `--${name} must be a number of seconds`);
  return value;
};

/** The options object each action module receives, from the parsed flags. */
const OPTIONS = {
  prepare: ({ flags }) => ({ execute: flags.execute === true, initSwarm: flags['init-swarm'] === true, ownerApproved: flags['owner-approved'] === true }),
  doctor: () => ({}),
  connect: ({ flags }) => ({ execute: flags.execute === true }),
  disconnect: ({ flags }) => ({ execute: flags.execute === true }),
  'build-args': ({ flags }) => ({ app: flags.app }),
  render: ({ flags, cwd }) => ({
    images: parseImages(flags.image), sourceSha: flags['source-sha'], previous: flags.previous ?? null,
    out: flags.out ? path.resolve(cwd, flags.out) : null, allowUnpinned: flags['allow-unpinned'] === true,
    extraCompose: (flags['extra-compose'] ?? []).map((file) => path.resolve(cwd, file)),
  }),
  deploy: ({ flags, cwd }) => ({
    images: parseImages(flags.image), sourceSha: flags['source-sha'], execute: flags.execute === true,
    out: flags.out ? path.resolve(cwd, flags.out) : null, timeoutSeconds: number(flags, 'timeout'), retrySeconds: number(flags, 'retry'),
  }),
  converge: ({ flags }) => ({ since: flags.since, timeoutSeconds: number(flags, 'timeout') }),
  verify: ({ flags }) => ({ retrySeconds: number(flags, 'retry'), skipPublic: flags['skip-public'] === true, skipInternal: flags['skip-internal'] === true }),
  rollback: ({ flags }) => ({ release: flags.release ?? null, execute: flags.execute === true, timeoutSeconds: number(flags, 'timeout') }),
  prune: ({ flags, cwd }) => ({ keepFiles: (flags.keep ?? []).map((file) => path.resolve(cwd, file)), execute: flags.execute === true }),
  backup: ({ flags }) => ({ swarmState: flags['swarm-state'] === true, execute: flags.execute === true }),
  ingress: ({ flags, positional }) => ({ action: positional[0], execute: flags.execute === true, args: positional.slice(1) }),
  jobs: ({ flags, positional }) => ({ action: positional[0], args: positional.slice(1), execute: flags.execute === true }),
};

const MODULES = {
  prepare: ['./prepare.mjs', 'prepareHost'], doctor: ['./prepare.mjs', 'doctorHost'],
  connect: ['./remote.mjs', 'connectCi'], disconnect: ['./remote.mjs', 'disconnectCi'],
  'build-args': ['./build-args.mjs', 'buildArgs'], render: ['./render.mjs', 'renderRelease'],
  deploy: ['./deploy.mjs', 'deployRelease'], converge: ['./converge.mjs', 'convergeStack'],
  verify: ['./verify.mjs', 'verifyStack'], rollback: ['./deploy.mjs', 'rollbackRelease'],
  prune: ['./prune.mjs', 'pruneStack'], backup: ['./backup.mjs', 'backupVolumes'], jobs: ['./jobs.mjs', 'runJobs'],
  ingress: ['./ingress.mjs', 'runIngress'],
};

async function handlerOf(action, importer) {
  const [file, name] = MODULES[action];
  return (await importer(file))[name];
}

function print(ctx, action, flags, result) {
  if (flags.json) ctx.stdout(`${JSON.stringify({ verb: action, ok: result.ok, ...result.data }, null, 2)}\n`);
  else for (const line of result.lines ?? []) ctx.stdout(`${line}\n`);
}

/** Runs one action; returns the exit code. `io.importer` lets a spec load fake action modules. */
export async function stackMain(argv, io = {}) {
  const ctx = stackContext(io);
  try {
    const { flags, positional } = parseFlags(argv.slice(1));
    const action = argv[0];
    if (!ACTIONS.includes(action)) throw refusal('STACK_USAGE', `starci app stack takes ${[...ACTIONS, 'up', 'down', 'status'].join(', ')}`);
    const config = loadDeployConfig({ repoRoot: ctx.cwd, env: flags.env ?? 'production' });
    const options = OPTIONS[action]({ flags, positional, cwd: ctx.cwd });
    const handler = await handlerOf(action, io.importer ?? ((file) => import(file)));
    const result = await handler(ctx, config, { ...options, sshCmd: flags['ssh-cmd'] ?? null });
    print(ctx, action, flags, result);
    return result.ok ? EXIT.ok : EXIT.failed;
  } catch (error) {
    if (!(error instanceof StackError)) throw error;
    ctx.stderr(`starci app stack: ${error.message}\n`);
    return error.exit;
  }
}
