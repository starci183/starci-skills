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

export function setVariable({ declaration, gh, options, name, stdout }) {
  const entry = declaredEntry(declaration.vars, name, options), value = valueOf(entry, options.value);
  writeVariable(gh, gh.repository(options.repo), entry, value, options, stdout);
  return 0;
}

/** Sync validates the whole plan first and performs no GitHub access until execution is requested. */
export function syncVariables({ declaration, gh, options, stdout }) {
  const plan = declaration.vars.map((entry) => ({ entry, value: valueOf(entry), options: { env: entry.scope === 'environment' ? entry.environment : undefined } }));
  const repo = options.execute && plan.length ? gh.repository(options.repo) : undefined;
  for (const item of plan) {
    if (options.execute) writeVariable(gh, repo, item.entry, item.value, item.options, stdout);
    else stdout(`would set variable ${item.entry.name} (${scopeName(item.options)})\n`);
  }
  return 0;
}
