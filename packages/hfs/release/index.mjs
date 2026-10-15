// index.mjs - `starci app release <gate|push>` and the plumbing the release and database verbs share: the context built from the app's IO, strict flag
// parsing, the optional `release:` / `database:` blocks of .starcistacks/application-stacks.yaml, text and --json output and the exit-code mapping.
//   starci app release gate [--execute] [--source <ref>] [--tag-prefix <prefix>] [--json]
//   starci app release push [--execute] [--remote <name>] [--json]
// Every action is a dry run unless --execute is given. A refusal is a StackError (exit 2); a failed step returns ok false (exit 1).
import fs from 'node:fs';
import path from 'node:path';
import { isPlainObject as plain } from '../runtime/engine/plain-object.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { STACKS_DIR, STACKS_FILE } from '../stack/config.mjs';
import { stackContext } from '../stack/context.mjs';
import { EXIT, StackError, refusal } from '../stack/errors.mjs';
import { RELEASE_CODE, VERSION, normalizeRelease, releaseGate } from './gate.mjs';
import { releasePush } from './push.mjs';

const IO_KEYS = ['cwd', 'stdout', 'stderr', 'env', 'sops'];

/** The stack context of one invocation: the IO of the app (cwd, writers, env, sops) over the injectable seams of `io.stackIo` (spawn, sleep, now, fetch). */
export function contextOf(io = {}) {
  const own = Object.fromEntries(IO_KEYS.filter((key) => io[key] !== undefined).map((key) => [key, io[key]]));
  return stackContext({ ...io.stackIo, ...own });
}

/** Splits argv into { flags, positional }; an unknown flag or a flag without its value is a refusal. */
export function parseVerbFlags(argv, spec, code = 'RELEASE_USAGE') {
  const flags = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (spec.boolean.includes(arg)) flags[arg.slice(2)] = true;
    else if (spec.value.includes(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw refusal(code, `${arg} needs a value`);
      index += 1;
      flags[arg.slice(2)] = value;
    } else if (arg.startsWith('--')) throw refusal(code, `unknown flag ${arg}`);
    else positional.push(arg);
  }
  return { flags, positional };
}

/** The top-level mapping of .starcistacks/application-stacks.yaml; a missing file is an empty declaration, an unreadable one a refusal. */
export function readDeclaration(root) {
  let source;
  try { source = fs.readFileSync(path.join(root, STACKS_DIR, STACKS_FILE), 'utf8'); } catch { return {}; }
  let doc;
  try { doc = parseYaml(source); } catch { throw refusal('STACKS_DEPLOY_FILE_INVALID', `${STACKS_FILE} is not valid YAML`); }
  return plain(doc) ? doc : {};
}

function readPackage(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { throw refusal('RELEASE_PACKAGE_UNREADABLE', 'package.json is not readable JSON'); }
}

/** The normalised `release:` block (tolerant of absence) with the package version: { root, version, gates, tagPrefix, defaultBranch, tagMatchesVersion }. */
export function loadReleaseConfig(root) {
  const pkg = readPackage(root);
  if (typeof pkg.version !== 'string' || !VERSION.test(pkg.version)) throw refusal(RELEASE_CODE, 'package.json needs a version like 1.2.3 (the release tag derives from it)');
  const { config, problems } = normalizeRelease(readDeclaration(root).release, pkg.scripts);
  if (!config) throw refusal(RELEASE_CODE, `${problems.length} problem(s) in release: ${problems.slice(0, 6).join('; ')}`);
  return { root, version: pkg.version, ...config };
}

function print(ctx, name, flags, result) {
  if (flags.json) ctx.stdout(`${JSON.stringify({ verb: name, ok: result.ok, ...result.data }, null, 2)}\n`);
  else for (const line of result.lines ?? []) ctx.stdout(`${line}\n`);
}

/** Parses the flags, runs `run(ctx, flags, positional)` and prints its result; returns the exit code. Only StackError is mapped, anything else is a bug and propagates. */
export async function runVerb({ label, name, io, argv, spec, run, code = 'RELEASE_USAGE' }) {
  const ctx = contextOf(io);
  try {
    const { flags, positional } = parseVerbFlags(argv, spec, code);
    const result = await run(ctx, flags, positional);
    print(ctx, name, flags, result);
    return result.ok ? EXIT.ok : EXIT.failed;
  } catch (error) {
    if (!(error instanceof StackError)) throw error;
    ctx.stderr(`${label}: ${error.message}\n`);
    return error.exit;
  }
}

const ACTIONS = {
  gate: {
    spec: { boolean: ['--execute', '--json'], value: ['--source', '--tag-prefix'] },
    run: (ctx, flags) => releaseGate(ctx, loadReleaseConfig(ctx.cwd), { execute: flags.execute === true, source: flags.source, tagPrefix: flags['tag-prefix'] }),
  },
  push: {
    spec: { boolean: ['--execute', '--json'], value: ['--remote'] },
    run: (ctx, flags) => releasePush(ctx, loadReleaseConfig(ctx.cwd), { execute: flags.execute === true, remote: flags.remote }),
  },
};

/** Runs `starci app release <gate|push>`; `io` is the app IO (cwd, stdout, stderr, env, sops, stackIo). Returns the exit code. */
export async function releaseMain(argv, io = {}) {
  const action = Object.hasOwn(ACTIONS, argv[0]) ? ACTIONS[argv[0]] : null;
  if (!action) {
    contextOf(io).stderr('starci app release: takes gate or push\n');
    return EXIT.refused;
  }
  return runVerb({ label: 'starci app release', name: argv[0], io, argv: argv.slice(1), spec: action.spec, run: action.run });
}
