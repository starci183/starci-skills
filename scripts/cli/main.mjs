#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importModule } from '../api/node/import-module.mjs';
import { runScript } from '../api/node/run-script.mjs';
import { isMain } from '../lib/is-main.mjs';
import { currentRole, requireRole } from './roles.mjs';

const defaultRuntimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliModule = (file) => importModule(pathToFileURL(path.join(defaultRuntimeRoot, 'packages', 'cli', 'src', file)).href);
const [{ CATALOG }, { splitCommand, validateArgs, withFlagsBeforeDashes }, { groupHelp, verbHelp }] = await Promise.all([
  cliModule('catalog.generated.mjs'), cliModule('validate-args.mjs'), cliModule('help.mjs'),
]);

const writeTo = (target, text) => {
  if (typeof target === 'function') target(text);
  else target.write(text);
};

const refuse = (stderr, message, code = 2) => {
  writeTo(stderr, `starci: ${message}\n`);
  return code;
};

const verbFailure = (stderr, group, verb, message) => {
  writeTo(stderr, `starci ${group} ${verb}: ${message}\n`);
  return 1;
};

const printModuleResult = ({ result, wantsJson, stdout, stderr, group, verb }) => {
  if (!result || typeof result !== 'object' || !Number.isInteger(result.code) || result.code < 0 || result.code > 255) {
    return verbFailure(stderr, group, verb, `returned invalid code ${JSON.stringify(result?.code)}`);
  }
  if (result.stderr !== undefined) writeTo(stderr, String(result.stderr));
  if (wantsJson) {
    if (result.data === undefined) return verbFailure(stderr, group, verb, 'returned no data for machine output');
    writeTo(stdout, `${JSON.stringify(result.data, null, 2)}\n`);
  } else if (result.text !== undefined) {
    const text = String(result.text);
    writeTo(stdout, text.endsWith('\n') ? text : `${text}\n`);
  }
  return result.code;
};

const runModule = async ({ command, ctx, root, importModuleFn, wantsJson, stdout, stderr, group, verb }) => {
  try {
    const target = pathToFileURL(path.resolve(root, command.impl.module)).href;
    const loaded = await importModuleFn(target);
    const handler = loaded?.[command.impl.export];
    if (typeof handler !== 'function') return verbFailure(stderr, group, verb, `export ${command.impl.export} is not a function`);
    const result = await handler(ctx);
    return printModuleResult({ result, wantsJson, stdout, stderr, group, verb });
  } catch (error) {
    return verbFailure(stderr, group, verb, error?.message ?? error);
  }
};

/** Runtime-side catalog dispatcher. */
export function main(argv = process.argv.slice(2), io = {}) {
  const catalog = io.catalog ?? CATALOG;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const env = io.env ?? process.env;
  const root = io.runtimeRoot ?? defaultRuntimeRoot;
  const split = splitCommand(argv, catalog.global ?? []);
  if (!split.group) return refuse(stderr, 'missing runtime command group');
  const group = catalog.groups?.[split.group];
  if (!group || group.owner !== 'runtime') return refuse(stderr, `unknown runtime group "${split.group}"`);
  if (!split.verb) {
    if (!split.help) return refuse(stderr, `missing verb for group "${split.group}"`);
    writeTo(stdout, groupHelp(catalog, split.group));
    return 0;
  }
  const command = group.verbs?.[split.verb];
  if (!command) return refuse(stderr, `unknown verb "${split.verb}" for group "${split.group}"`);
  if (split.help) {
    writeTo(stdout, verbHelp(catalog, split.group, split.verb));
    return 0;
  }

  const checked = validateArgs(split.args, { ...command, group: split.group, verb: split.verb }, catalog.global ?? []);
  if (!checked.ok) return refuse(stderr, checked.error, checked.code);
  const cwd = path.resolve(io.cwd ?? process.cwd(), checked.global.cwd ?? '.');
  const role = currentRole({ env });
  if (command.roles?.length) {
    const roleRefusal = requireRole({ role, group: split.group, verb: split.verb, roles: command.roles });
    if (roleRefusal) {
      writeTo(stderr, `${roleRefusal}\n`);
      return 2;
    }
  }

  if (command.impl?.module) {
    const ctxIo = {
      stdout: (text) => writeTo(stdout, text),
      stderr: (text) => writeTo(stderr, text),
    };
    const ctx = {
      args: checked.args,
      positionals: checked.positionals,
      global: checked.global,
      env,
      cwd,
      io: ctxIo,
      role,
      now: typeof io.now === 'function' ? io.now() : (io.now ?? Date.now()),
    };
    return runModule({
      command,
      ctx,
      root,
      importModuleFn: io.importModule ?? importModule,
      wantsJson: checked.global.json === true || command.json === 'always',
      stdout,
      stderr,
      group: split.group,
      verb: split.verb,
    });
  }
  if (!command.impl?.script) return refuse(stderr, `${split.group} ${split.verb} has no runtime implementation`, 1);

  // --quiet and --edition are dispatcher concerns. Runtime handlers never see
  // spellings they do not declare themselves; --cwd is represented by cwd.
  const jsonFlag = checked.global.json === true && command.json !== 'always' ? ['--json'] : [];
  const args = [...(command.impl.args ?? []), ...withFlagsBeforeDashes(checked.localArgs, jsonFlag)];
  const script = path.resolve(root, command.impl.script);
  const runner = io.runScript ?? runScript;
  return runner(script, args, { cwd, env });
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
