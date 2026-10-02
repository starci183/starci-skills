import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { locateRuntime, runtimeEntryOf } from './runtime-locate.mjs';
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

// `starci <old>` spellings match from the program name; the retired `hfs` and `starci-test-stack` bins also match behind it.
const RETIRED_BINS = new Set(['hfs', 'starci-test-stack']);
const retiredMatch = (words, retired) => {
  const input = ['starci', ...words];
  const candidates = retired
    .map((entry) => {
      const tokens = entry.spelling.split(/\s+/);
      if (tokens[0] === 'starci') return { ...entry, tokens, offset: 0 };
      return RETIRED_BINS.has(tokens[0]) ? { ...entry, tokens, offset: 1 } : null;
    })
    .filter((entry) => entry && entry.tokens.every((token, index) => input[index + entry.offset] === token))
    .sort((a, b) => b.tokens.length - a.tokens.length);
  const match = candidates[0];
  if (!match) return null;
  const suffix = input.slice(match.offset + match.tokens.length);
  return {
    spelling: [...input.slice(0, match.offset), ...match.tokens, ...suffix].join(' '),
    use: [...match.use.split(/\s+/), ...suffix].join(' '),
  };
};

const handlerArgs = (validated, command, withFlagsBeforeDashes, { includeQuiet = true } = {}) => {
  const extra = [];
  if (validated.global.json === true && command.json !== 'always') extra.push('--json');
  if (validated.global.edition !== undefined) extra.push('--edition', validated.global.edition);
  if (includeQuiet && validated.global.quiet === true) extra.push('--quiet');
  return withFlagsBeforeDashes(validated.localArgs, extra);
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
  const { CATALOG, RETIRED } = catalogModule;
  const { completionFor, completionShells } = completionModule;
  const { explainHelp, groupHelp, topHelp, verbHelp } = helpModule;
  const { installRuntime } = installModule;
  const { linkRuntime } = linkModule;
  const { splitCommand, validateArgs, withFlagsBeforeDashes } = argsModule;
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

  const split = splitCommand(argv, catalog.global ?? []);
  const removed = split.group ? retiredMatch([split.group, ...(split.verb ? [split.verb] : []), ...split.args], retired) : null;
  if (removed) return fail(stderr, `"${removed.spelling}" was removed; use "${removed.use}"`);

  if (split.group === 'help') {
    const [verbName] = split.args.filter((token) => !token.startsWith('-'));
    const target = split.verb ? catalog.groups?.[split.verb] : null;
    if (split.verb && !target) return fail(stderr, `unknown group "${split.verb}"`);
    if (verbName && !target.verbs?.[verbName]) return fail(stderr, `unknown verb "${verbName}" for group "${split.verb}"`);
    writeTo(stdout, !split.verb ? topHelp(catalog, version) : verbName ? verbHelp(catalog, split.verb, verbName) : groupHelp(catalog, split.verb));
    return 0;
  }
  if (split.group === 'completion') {
    const shell = split.verb;
    if (split.help && !split.args.length) {
      writeTo(stdout, `Usage: starci completion <${completionShells.join('|')}>\n`);
      return 0;
    }
    if (!completionShells.includes(shell) || split.args.length) {
      return fail(stderr, `completion expects one of: ${completionShells.join(', ')}`);
    }
    const text = (io.completionFor ?? completionFor)(shell);
    if (text == null) return fail(stderr, `completion expects one of: ${completionShells.join(', ')}`);
    writeTo(stdout, text);
    return 0;
  }
  if (split.group === 'explain' && (catalog.commands ?? []).includes('explain')) {
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
    writeTo(stdout, explainHelp(catalog, groupName, verbName));
    return 0;
  }

  const wantsHelp = split.help;
  if (!split.group) {
    if (wantsHelp) {
      writeTo(stdout, topHelp(catalog, version));
      return 0;
    }
    return fail(stderr, 'missing command group');
  }
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
  const args = handlerArgs(validated, command, withFlagsBeforeDashes);

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

  if (split.group === 'runtime' && split.verb === 'link') {
    const link = io.linkRuntime ?? linkRuntime;
    return await link({
      cwd,
      ...(home ? { home } : {}),
      root: validated.values.root ?? null,
      json: validated.global.json === true,
      quiet: validated.global.quiet === true,
      stdout,
      stderr,
    }, io.runtimeLinkDeps ?? {});
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

  const skipped = [];
  const located = (io.locateRuntime ?? locateRuntime)({ cwd, env, skipped, ...(home ? { home } : {}) });
  if (!located) return noRuntime(stderr, split.group, skipped);
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
}
