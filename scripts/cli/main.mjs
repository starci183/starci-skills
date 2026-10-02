#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { splitCommand, validateArgs } from '../../packages/cli/src/validate-args.mjs';
import { runScript } from '../api/node/run-script.mjs';
import { isMain } from '../lib/is-main.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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
  const stderr = io.stderr ?? process.stderr;
  const split = splitCommand(argv, catalog.global ?? []);
  if (!split.group) return refuse(stderr, 'missing runtime command group');
  const group = catalog.groups?.[split.group];
  if (!group || group.owner !== 'runtime') return refuse(stderr, `unknown runtime group "${split.group}"`);
  if (!split.verb) return refuse(stderr, `missing verb for group "${split.group}"`);
  const command = group.verbs?.[split.verb];
  if (!command) return refuse(stderr, `unknown verb "${split.verb}" for group "${split.group}"`);

  const checked = validateArgs(split.args, { ...command, group: split.group, verb: split.verb }, catalog.global ?? []);
  if (!checked.ok) return refuse(stderr, checked.error, checked.code);
  if (!command.impl?.script) return refuse(stderr, `${split.group} ${split.verb} has no runtime implementation`, 1);

  const cwd = path.resolve(io.cwd ?? process.cwd(), checked.global.cwd ?? '.');
  const args = [...(command.impl.args ?? []), ...checked.localArgs];
  if (checked.global.json === true && command.json !== 'always') args.push('--json');
  // --quiet and --edition are dispatcher concerns. Runtime handlers never see
  // spellings they do not declare themselves; --cwd is represented by cwd.
  const script = path.resolve(runtimeRoot, command.impl.script);
  const runner = io.runScript ?? runScript;
  return runner(script, args, { cwd });
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
