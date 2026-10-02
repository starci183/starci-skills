import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { locateRuntime, runtimeEntryOf } from './runtime-locate.mjs';

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
  const located = (io.locateRuntime ?? locateRuntime)({ cwd, env: io.env ?? process.env, ...(io.home ? { home: io.home } : {}) });
  if (!located) return fail(stderr, 'the runtime group "guard" needs the StarCi runtime, which is not installed (run: starci runtime install)', 3);
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

const retiredMatch = (argv, retired) => {
  const input = ['starci', ...argv];
  const candidates = retired
    .filter((entry) => entry.spelling.startsWith('starci '))
    .map((entry) => ({ ...entry, tokens: entry.spelling.split(/\s+/) }))
    .filter((entry) => entry.tokens.every((token, index) => input[index] === token))
    .sort((a, b) => b.tokens.length - a.tokens.length);
  const match = candidates[0];
  if (!match) return null;
  const suffix = input.slice(match.tokens.length);
  return {
    spelling: [...match.tokens, ...suffix].join(' '),
    use: [...match.use.split(/\s+/), ...suffix].join(' '),
  };
};

const handlerArgs = (validated, command, { includeQuiet = true } = {}) => {
  const args = [...validated.localArgs];
  if (validated.global.json === true && command.json !== 'always') args.push('--json');
  if (validated.global.edition !== undefined) args.push('--edition', validated.global.edition);
  if (includeQuiet && validated.global.quiet === true) args.push('--quiet');
  return args;
};

/** The published CLI entry, with I/O and process seams for deterministic specs. */
export async function main(argv = process.argv.slice(2), io = {}) {
  const guarded = await guardFastPath(argv, io);
  if (guarded !== null) return guarded;
  const [catalogModule, completionModule, helpModule, installModule, argsModule] = await Promise.all([
    import('./catalog.generated.mjs'),
    import('./completion.mjs'),
    import('./help.mjs'),
    import('./runtime-install.mjs'),
    import('./validate-args.mjs'),
  ]);
  const { CATALOG, RETIRED } = catalogModule;
  const { completionFor, completionShells } = completionModule;
  const { groupHelp, topHelp, verbHelp } = helpModule;
  const { installRuntime } = installModule;
  const { splitCommand, validateArgs } = argsModule;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const catalog = io.catalog ?? CATALOG;
  const retired = io.retired ?? RETIRED;
  const version = io.version ?? cliVersion();
  const home = io.home;
  const env = io.env ?? process.env;
  const initialCwd = io.cwd ?? process.cwd();

  if (argv.length === 0 || (argv.length === 1 && ['help', '--help', '-h'].includes(argv[0]))) {
    writeTo(stdout, topHelp(catalog, version));
    return 0;
  }
  if (argv.length === 1 && argv[0] === '--version') {
    writeTo(stdout, `${version}\n`);
    return 0;
  }

  const removed = retiredMatch(argv, retired);
  if (removed) return fail(stderr, `"${removed.spelling}" was removed; use "${removed.use}"`);

  const split = splitCommand(argv, catalog.global ?? []);
  if (split.group === 'completion') {
    const shell = split.verb;
    if (!completionShells.includes(shell) || split.args.length) {
      return fail(stderr, `completion expects one of: ${completionShells.join(', ')}`);
    }
    const text = (io.completionFor ?? completionFor)(shell);
    if (text == null) return fail(stderr, `completion expects one of: ${completionShells.join(', ')}`);
    writeTo(stdout, text);
    return 0;
  }

  const wantsHelp = argv.includes('--help') || argv.includes('-h');
  if (!split.group) return fail(stderr, 'missing command group');
  const group = catalog.groups?.[split.group];
  if (!group) return fail(stderr, `unknown group "${split.group}"`);
  if (!split.verb) {
    if (wantsHelp) {
      writeTo(stdout, groupHelp(catalog, split.group));
      return 0;
    }
    return fail(stderr, `missing verb for group "${split.group}"`);
  }
  const command = group.verbs?.[split.verb];
  if (!command) return fail(stderr, `unknown verb "${split.verb}" for group "${split.group}"`);
  if (wantsHelp) {
    writeTo(stdout, verbHelp(catalog, split.group, split.verb));
    return 0;
  }

  const validated = validateArgs(split.args, { ...command, group: split.group, verb: split.verb }, catalog.global ?? []);
  if (!validated.ok) return fail(stderr, validated.error, validated.code);
  const cwd = path.resolve(initialCwd, validated.global.cwd ?? '.');
  const args = handlerArgs(validated, command);

  if (split.group === 'runtime' && split.verb === 'install') {
    const install = io.installRuntime ?? installRuntime;
    return await install({
      cwd,
      ...(home ? { home } : {}),
      force: validated.values.force === true,
      hosts: validated.values.hosts ?? null,
      noBootstrap: validated.values['no-bootstrap'] === true,
    }, io.runtimeInstallDeps ?? {});
  }

  if (group.owner === '@starci/hfs') {
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
  }

  const located = (io.locateRuntime ?? locateRuntime)({ cwd, env, ...(home ? { home } : {}) });
  if (!located) {
    return fail(stderr, `the runtime group "${split.group}" needs the StarCi runtime, which is not installed (run: starci runtime install)`, 3);
  }
  const spawn = io.spawn ?? spawnSync;
  const result = spawn(process.execPath, [runtimeEntryOf(located.root), split.group, split.verb, ...args], {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  });
  return result?.error ? 1 : (result?.status ?? 1);
}
