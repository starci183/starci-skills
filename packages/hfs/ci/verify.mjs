import { refuse, scopeArgs, scopeName } from './github.mjs';

/** Verification reports names and scopes only; values are compared in memory and excluded from findings. */
export function verifyCi({ declaration, sealed, gh, options, stdout }) {
  const repo = gh.repository(options.repo), stores = [];
  const environments = [...new Set([...declaration.secrets, ...declaration.vars].filter((item) => item.scope === 'environment').map((item) => item.environment))].sort();
  for (const scope of [{}, ...environments.map((env) => ({ env })), { dependabot: true }]) {
    for (const kind of scope.dependabot ? ['secret'] : ['secret', 'variable']) {
      const rows = gh.json([kind, 'list', '--json', kind === 'secret' ? 'name' : 'name,value', ...scopeArgs(scope), '--repo', repo]);
      if (!Array.isArray(rows) || rows.some((row) => typeof row?.name !== 'string' || (kind === 'variable' && typeof row.value !== 'string'))) throw refuse('CI_GITHUB_UNREADABLE', 'GitHub CLI returned an invalid name list');
      stores.push({ scope, kind, rows });
    }
  }
  const findings = [], sealedNames = new Set(sealed.map((item) => item.key));
  const declarations = (store) => store.scope.dependabot ? declaration.dependabotSecrets : store.kind === 'secret' ? declaration.secrets : declaration.vars;
  const matches = (entry, scope) => (entry.scope === 'environment' ? entry.environment : undefined) === scope.env;
  const add = (code, name, scope) => findings.push({ code, name, scope: scopeName(scope) });
  for (const store of stores) {
    const entries = declarations(store), actual = new Map(store.rows.map((row) => [row.name, row]));
    for (const entry of entries.filter((item) => matches(item, store.scope))) {
      const row = actual.get(entry.name);
      if (!row && !(store.kind === 'secret' && entry.optional)) add(store.kind === 'secret' ? 'CI_SECRET_MISSING' : 'CI_VAR_MISSING', entry.name, store.scope);
      else if (row && store.kind === 'variable' && entry.value !== undefined && row.value !== String(entry.value)) add('CI_VAR_DRIFT', entry.name, store.scope);
    }
    for (const row of store.rows) {
      if (store.kind === 'secret' && sealedNames.has(row.name)) add('APP_SECRET_IN_CI', row.name, store.scope);
      if (entries.some((entry) => entry.name === row.name && matches(entry, store.scope))) continue;
      const sameKind = store.kind === 'secret' ? [...declaration.secrets, ...declaration.dependabotSecrets] : declaration.vars;
      add(sameKind.some((entry) => entry.name === row.name) ? 'CI_SCOPE_MISMATCH' : store.kind === 'secret' ? 'CI_SECRET_UNDECLARED' : 'CI_VAR_UNDECLARED', row.name, store.scope);
    }
  }
  if (options.json) stdout(`${JSON.stringify({ ok: findings.length === 0, findings }, null, 2)}\n`);
  else if (!findings.length) stdout('CI verification passed\n');
  else for (const finding of findings) stdout(`${finding.code}: ${finding.name} (${finding.scope})\n`);
  return findings.length ? 1 : 0;
}
