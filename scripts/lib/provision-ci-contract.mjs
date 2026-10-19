import path from 'node:path';

const PARENT_KEYS = new Set(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR']);

/** Use only the entry returned and revalidated by the native owner; the secret body is never an argument. */
export function ciNativeArguments({ repoRoot, nativeIdentity, name, repository, scope, environment }) {
  let options = [];
  if (scope === 'dependabot') options = ['--dependabot'];
  else if (scope === 'environment') options = ['--env', environment];
  return [path.join(repoRoot, nativeIdentity.entry), 'app', 'ci', 'secret', 'set', name, ...options, '--repo', repository];
}

/** Project public OS/tool bindings only; provider credentials and executable loader settings are excluded. */
export function ciChildEnvironment(parentEnv = {}) {
  return Object.fromEntries(Object.entries(parentEnv).filter(([key, value]) => PARENT_KEYS.has(key) && typeof value === 'string'));
}
