import fs from 'node:fs';
import { refuse, scopeArgs, scopeName } from './github.mjs';
import { declaredEntry } from './secret.mjs';

/** Public CI values may come from argv or the manifest, but two supplied values must agree. */
function valueOf(entry, supplied) {
  const declared = entry.value === undefined ? undefined : String(entry.value);
  if (supplied !== undefined && declared !== undefined && supplied !== declared) throw refuse('CI_VAR_DRIFT', 'the supplied value differs from the manifest');
  const value = supplied ?? declared;
  if (value === undefined) throw refuse('CI_VALUE_EMPTY', 'a public variable value is required');
  return value;
}

function writeVariable(gh, repo, entry, value, options, stdout) {
  gh.run(['variable', 'set', entry.name, '--body', value, ...scopeArgs(options), '--repo', repo]);
  stdout(`set variable ${entry.name} (${scopeName(options)})\n`);
}

/** Owner-supplied input is read once from stdin, with one trailing newline removed and no value echoed. */
async function ownerValueOf(options, stdin) {
  if (Object.hasOwn(options, 'value')) throw refuse('CI_VALUE_ARGV', 'an owner-supplied variable takes its value on stdin');
  let value;
  if (stdin === undefined) {
    if (process.stdin.isTTY) throw refuse('CI_VALUE_EMPTY', 'an owner-supplied variable value is required on stdin');
    value = fs.readFileSync(0, 'utf8');
  } else value = typeof stdin === 'function' ? await stdin() : stdin;
  value = String(value ?? '').replace(/\r?\n$/, '');
  if (!value.length) throw refuse('CI_VALUE_EMPTY', 'an owner-supplied variable value is required on stdin');
  return value;
}

/** Owner-supplied variables accept stdin only; other public variables retain manifest and argv agreement. */
export async function setVariable({ declaration, gh, options, name, stdin, stdout }) {
  const entry = declaredEntry(declaration.vars, name, options);
  const value = entry.ownerValue ? await ownerValueOf(options, stdin) : valueOf(entry, options.value);
  writeVariable(gh, gh.repository(options.repo), entry, value, options, stdout);
  return 0;
}

/** Sync validates the whole plan first and performs no GitHub access until execution is requested. */
export function syncVariables({ declaration, gh, options, stdout }) {
  const plan = declaration.vars.map((entry) => ({ entry, value: entry.ownerValue ? undefined : valueOf(entry), options: { env: entry.scope === 'environment' ? entry.environment : undefined } }));
  const repo = options.execute && plan.some((item) => !item.entry.ownerValue) ? gh.repository(options.repo) : undefined;
  for (const item of plan) {
    if (item.entry.ownerValue) stdout(`skip variable ${item.entry.name} (${scopeName(item.options)}): owner-supplied value; the owner runs starci app ci var set ${item.entry.name} [--env ENV] with the value on stdin\n`);
    else if (options.execute) writeVariable(gh, repo, item.entry, item.value, item.options, stdout);
    else stdout(`would set variable ${item.entry.name} (${scopeName(item.options)})\n`);
  }
  return 0;
}
