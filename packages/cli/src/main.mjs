import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { foreignRuntimeNotice, locateRuntime, ownRuntimeRoot, runtimeEntryOf } from './runtime-locate.mjs';
import { runtimeEnv } from './shim.mjs';

const packageFile = fileURLToPath(new URL('../package.json', import.meta.url));
const cliVersion = () => JSON.parse(readFileSync(packageFile, 'utf8')).version;
const GUARD_FAST_PATH = Object.freeze({ command: 'command-guard.mjs', 'seat-tools': 'seat-tools.mjs' });

const importHfs = async () => {
  try {
    return await import('@starci/hfs');
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !String(error?.message ?? '').includes('@starci/hfs')) throw error;
    // The StarCi runtime ships packages/cli and packages/hfs side by side without
    // making the repository an npm workspace. Published @starci/cli resolves its
    // normal exact dependency above; the embedded runtime uses this payload path.
    return import(new URL('../../hfs/src/main.mjs', import.meta.url));
  }
};

const writeTo = (target, text) => {
  if (typeof target === 'function') target(text);
  else target.write(text);
};

const noRuntime = (stderr, group, skipped) => {
  for (const note of skipped) writeTo(stderr, `starci: ignored: ${note}\n`);
  return fail(stderr, `the runtime group "${group}" needs the StarCi runtime, which is not installed (run: starci runtime install)`, 3);
};

const fail = (stderr, message, code = 2) => {
  writeTo(stderr, `starci: ${message}\n`);
  return code;
};

/**
 * The hooks run on every tool call. Exact hook invocations bypass the generated catalog, help modules and a second
 * Node process; help and malformed invocations fall through to the catalog-driven dispatcher below.
 */
const guardFastPath = async (argv, io) => {
  if (argv.length !== 2 || argv[0] !== 'guard' || !Object.hasOwn(GUARD_FAST_PATH, argv[1])) return null;
  const stderr = io.stderr ?? process.stderr;
  const cwd = io.cwd ?? process.cwd();
  const skipped = [];
  const located = (io.locateRuntime ?? locateRuntime)({ cwd, env: io.env ?? process.env, skipped, ...(io.home ? { home: io.home } : {}) });
  if (!located) return noRuntime(stderr, 'guard', skipped);
  try {
    const file = path.join(located.root, 'scripts', 'guards', GUARD_FAST_PATH[argv[1]]);
    const guard = await (io.importGuard ?? ((target) => import(pathToFileURL(target).href)))(file);
    if (typeof guard.main !== 'function') return fail(stderr, `guard ${argv[1]} has no in-process entry`, 1);
    return Number(await guard.main({
      stdin: io.stdin ?? process.stdin,
      stdout: io.stdout ?? process.stdout,
      stderr,
      env: io.env ?? process.env,
    })) || 0;
  } catch (error) {
    return fail(stderr, `cannot load guard ${argv[1]}: ${error?.message ?? error}`, 1);
  }
};

const handlerArgs = (validated, command, withFlagsBeforeDashes, { includeQuiet = true } = {}) => {
  const extra = [];
  if (validated.global.json === true && command.json !== 'always') extra.push('--json');
  if (validated.global.edition !== undefined) extra.push('--edition', validated.global.edition);
  if (includeQuiet && validated.global.quiet === true) extra.push('--quiet');
  return withFlagsBeforeDashes(validated.localArgs, extra);
};

const ioCtx = (io) => ({ io, stdout: io.stdout ?? process.stdout, stderr: io.stderr ?? process.stderr, env: io.env ?? process.env, home: io.home });

/** Bare `starci`, `help`/`--help`/`-h` and `--version`; null when argv needs the dispatcher. */
const earlyOut = (argv, { catalog, version, help, stdout }) => {
  if (argv.length === 0 || (argv.length === 1 && ['help', '--help', '-h'].includes(argv[0]))) {
    writeTo(stdout, help.topHelp(catalog, version));
    return 0;
  }
  if (argv.length === 1 && argv[0] === '--version') {
    writeTo(stdout, `${version}\n`);
    return 0;
  }
  return null;
};

/** `starci help [group] [verb]`; null when argv is not a help invocation. */
const helpDispatch = (split, { catalog, version, help, stdout, stderr }) => {
  if (split.group !== 'help') return null;
  const verbName = split.args.find((token) => !token.startsWith('-'));
  const target = split.verb ? catalog.groups?.[split.verb] : null;
  if (split.verb && !target) return fail(stderr, `unknown group "${split.verb}"`);
  if (verbName && !target.verbs?.[verbName]) return fail(stderr, `unknown verb "${verbName}" for group "${split.verb}"`);
  let text;
  if (!split.verb) text = help.topHelp(catalog, version);
  else if (verbName) text = help.verbHelp(catalog, split.verb, verbName);
  else text = help.groupHelp(catalog, split.verb);
  writeTo(stdout, text);
  return 0;
};

/** `starci completion <shell>`; null when argv is not a completion invocation. */
const completionDispatch = (split, { io, completionFor, completionShells, stdout, stderr }) => {
  if (split.group !== 'completion') return null;
  const shell = split.verb;
  if (split.help && !split.args.length) {
    writeTo(stdout, `Usage: starci completion <${completionShells.join('|')}>\n`);
    return 0;
  }
  if (!completionShells.includes(shell) || split.args.length) return fail(stderr, `completion expects one of: ${completionShells.join(', ')}`);
  const text = (io.completionFor ?? completionFor)(shell);
  if (text == null) return fail(stderr, `completion expects one of: ${completionShells.join(', ')}`);
  writeTo(stdout, text);
  return 0;
};

/** `starci explain <group> <verb>`; null when argv is not explain or the catalog lacks the command. */
const explainDispatch = (split, { catalog, help, stdout, stderr }) => {
  if (split.group !== 'explain' || !(catalog.commands ?? []).includes('explain')) return null;
  if (split.help && !split.verb && !split.args.length) {
    writeTo(stdout, 'Usage: starci explain <group> <verb>\n');
    return 0;
  }
  const groupName = split.verb;
  const verbNames = split.args.filter((token) => !token.startsWith('-'));
  if (!groupName || verbNames.length !== 1) return fail(stderr, 'explain expects <group> <verb>');
  const target = catalog.groups?.[groupName];
  if (!target) return fail(stderr, `unknown group "${groupName}"`);
  const verbName = verbNames[0];
  if (!target.verbs?.[verbName]) {
    return fail(stderr, `unknown verb "${verbName}" for group "${groupName}" (available: ${Object.keys(target.verbs ?? {}).join(', ')})`);
  }
  writeTo(stdout, help.explainHelp(catalog, groupName, verbName));
  return 0;
};

/** Resolve group/verb against the catalog (printing help or failing); {command, group} or {code}. */
const resolveCommand = (split, { catalog, version, help, stdout, stderr }) => {
  const wantsHelp = split.help;
  if (!split.group) {
    if (wantsHelp) { writeTo(stdout, help.topHelp(catalog, version)); return { code: 0 }; }
    return { code: fail(stderr, 'missing command group') };
  }
  const group = catalog.groups?.[split.group];
  if (!group) return { code: fail(stderr, `unknown group "${split.group}"`) };
  if (!split.verb) {
    if (wantsHelp) { writeTo(stdout, help.groupHelp(catalog, split.group)); return { code: 0 }; }
    return { code: fail(stderr, `missing verb for group "${split.group}"`) };
  }
  const command = group.verbs?.[split.verb];
  if (!command) return { code: fail(stderr, `unknown verb "${split.verb}" for group "${split.group}"`) };
  if (wantsHelp) { writeTo(stdout, help.verbHelp(catalog, split.group, split.verb)); return { code: 0 }; }
  return { command, group };
};

/** `starci runtime install|link`; null for any other verb. */
const runtimeVerb = (split, validated, { io, installRuntime, linkRuntime, home, cwd, stdout, stderr }) => {
  if (split.group !== 'runtime') return null;
  if (split.verb === 'install') {
    const install = io.installRuntime ?? installRuntime;
    return install({
      cwd,
      ...(home ? { home } : {}),
      force: validated.values.force === true,
      hosts: validated.values.hosts ?? null,
      noBootstrap: validated.values['no-bootstrap'] === true,
    }, io.runtimeInstallDeps ?? {});
  }
  if (split.verb === 'link') {
    const link = io.linkRuntime ?? linkRuntime;
    return link({
      cwd,
      ...(home ? { home } : {}),
      root: validated.values.root ?? null,
      json: validated.global.json === true,
      quiet: validated.global.quiet === true,
      stdout,
      stderr,
    }, io.runtimeLinkDeps ?? {});
  }
  return null;
};

/** A group owned by @starci/hfs runs in-process; null for runtime-owned groups. */
const hfsDispatch = async (split, group, args, { io, cwd, stdout, stderr }) => {
  if (group.owner !== '@starci/hfs') return null;
  try {
    const hfs = await (io.importHfs ?? importHfs)();
    const entry = hfs.main ?? hfs.default?.main;
    if (typeof entry !== 'function') return fail(stderr, '@starci/hfs does not export main(argv, io)', 1);
    return Number(await entry([split.verb, ...args], {
      ...io,
      cwd,
      stdout: (text) => writeTo(stdout, text),
      stderr: (text) => writeTo(stderr, text),
    })) || 0;
  } catch (error) {
    return fail(stderr, `cannot load @starci/hfs: ${error?.message ?? error}`, 1);
  }
};

/** Spawn the located runtime for the resolved verb; its exit status is the command's. */
const runRuntime = (split, args, { io, cwd, env, home, stderr }) => {
  const skipped = [];
  const located = (io.locateRuntime ?? locateRuntime)({ cwd, env, skipped, ...(home ? { home } : {}) });
  if (!located) return noRuntime(stderr, split.group, skipped);
  const notice = foreignRuntimeNotice(located, (io.ownRuntimeRoot ?? ownRuntimeRoot)());
  if (notice) writeTo(stderr, notice);
  const spawn = io.spawn ?? spawnSync;
  let result;
  try {
    result = spawn(process.execPath, [runtimeEntryOf(located.root), split.group, split.verb, ...args], {
      cwd,
      env: runtimeEnv(env, home ? { home } : {}),
      stdio: 'inherit',
      windowsHide: true,
    });
  } catch (error) {
    return fail(stderr, `cannot run the runtime: ${error?.message ?? error}`, 1);
  }
  if (result?.error) {
    if (result.error.code === 'ENOENT' && !existsSync(cwd)) return fail(stderr, `--cwd "${cwd}" is not a directory`);
    return fail(stderr, `cannot run the runtime: ${result.error.message ?? result.error}`, 1);
  }
  if (result?.status == null) return fail(stderr, `the runtime stopped on signal ${result?.signal ?? 'unknown'}`, 1);
  return result.status;
};

/** The published CLI entry, with I/O and process seams for deterministic specs. */
export async function main(argv = process.argv.slice(2), io = {}) {
  const guarded = await guardFastPath(argv, io);
  if (guarded !== null) return guarded;
  const [catalogModule, completionModule, helpModule, installModule, linkModule, argsModule] = await Promise.all([
    import('./catalog.generated.mjs'),
    import('./completion.mjs'),
    import('./help.mjs'),
    import('./runtime-install.mjs'),
    import('./runtime-link.mjs'),
    import('./validate-args.mjs'),
  ]);
  const catalog = io.catalog ?? catalogModule.CATALOG;
  const ctx = {
    ...ioCtx(io), catalog, version: io.version ?? cliVersion(), initialCwd: io.cwd ?? process.cwd(), globals: catalog.global ?? [],
    help: helpModule, completionFor: completionModule.completionFor, completionShells: completionModule.completionShells,
    installRuntime: installModule.installRuntime, linkRuntime: linkModule.linkRuntime,
  };
  const { splitCommand, validateArgs, withFlagsBeforeDashes } = argsModule;

  const early = earlyOut(argv, ctx);
  if (early !== null) return early;
  const split = splitCommand(argv, ctx.globals);
  for (const dispatch of [helpDispatch, completionDispatch, explainDispatch]) {
    const out = dispatch(split, ctx);
    if (out !== null) return out;
  }
  const resolved = resolveCommand(split, ctx);
  if (!resolved.command) return resolved.code;
  const { command, group } = resolved;

  const validated = validateArgs(split.args, { ...command, group: split.group, verb: split.verb }, ctx.globals);
  if (!validated.ok) return fail(ctx.stderr, validated.error, validated.code);
  const cwd = path.resolve(ctx.initialCwd, validated.global.cwd ?? '.');
  const args = handlerArgs(validated, command, withFlagsBeforeDashes);

  const runtimeOut = await runtimeVerb(split, validated, { ...ctx, cwd });
  if (runtimeOut !== null) return runtimeOut;
  const hfsOut = await hfsDispatch(split, group, args, { ...ctx, cwd });
  if (hfsOut !== null) return hfsOut;
  return runRuntime(split, args, { ...ctx, cwd });
}
