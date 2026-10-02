#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importModule } from '../api/node/import-module.mjs';
import { runScript } from '../api/node/run-script.mjs';
import { isMain } from '../lib/is-main.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliModule = (file) => importModule(pathToFileURL(path.join(runtimeRoot, 'packages', 'cli', 'src', file)).href);
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

/** Runtime-side catalog dispatcher. */
export function main(argv = process.argv.slice(2), io = {}) {
  const catalog = io.catalog ?? CATALOG;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
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
  if (!command.impl?.script) return refuse(stderr, `${split.group} ${split.verb} has no runtime implementation`, 1);

  const cwd = path.resolve(io.cwd ?? process.cwd(), checked.global.cwd ?? '.');
  // --quiet and --edition are dispatcher concerns. Runtime handlers never see
  // spellings they do not declare themselves; --cwd is represented by cwd.
  const jsonFlag = checked.global.json === true && command.json !== 'always' ? ['--json'] : [];
  const args = [...(command.impl.args ?? []), ...withFlagsBeforeDashes(checked.localArgs, jsonFlag)];
  const script = path.resolve(runtimeRoot, command.impl.script);
  const runner = io.runScript ?? runScript;
  return runner(script, args, { cwd });
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
