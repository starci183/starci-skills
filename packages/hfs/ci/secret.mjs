import fs from 'node:fs';
import { refuse, scopeArgs, scopeName } from './github.mjs';

/** A declared name must belong to the requested store before a secret body is read. */
export function declaredEntry(entries, name, options) {
  const entry = entries.find((item) => item.name === name);
  if (!entry) throw refuse('CI_NAME_UNDECLARED', 'the name is not declared for this CI class');
  const environment = entry.scope === 'environment' ? entry.environment : undefined;
  if (environment !== options.env || (options.dependabot && options.env)) throw refuse('CI_SCOPE_MISMATCH', 'the requested scope differs from the declaration');
  return entry;
}

/** Secret input is read once, stripped of one trailing newline, and passed only to the child stdin. */
export async function setSecret({ declaration, sealed, gh, options, name, stdin, stdout }) {
  if (sealed.some((item) => item.key === name)) throw refuse('CI_SECRET_SEALED', 'the name belongs to a sealed app secret');
  declaredEntry(options.dependabot ? declaration.dependabotSecrets : declaration.secrets, name, options);
  let value;
  if (stdin === undefined) {
    if (process.stdin.isTTY) throw refuse('CI_VALUE_EMPTY', 'a secret value is required on stdin');
    value = fs.readFileSync(0, 'utf8');
  } else value = typeof stdin === 'function' ? await stdin() : stdin;
  value = String(value ?? '').replace(/\r?\n$/, '');
  if (!value.length) throw refuse('CI_VALUE_EMPTY', 'a secret value is required on stdin');
  const repo = gh.repository(options.repo);
  gh.run(['secret', 'set', name, ...scopeArgs(options), '--repo', repo], value);
  stdout(`set secret ${name} (${scopeName(options)})\n`);
  return 0;
}
