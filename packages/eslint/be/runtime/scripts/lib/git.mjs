// git.mjs — pure helpers over git's text output, spawn results and env. The git spawn itself lives in scripts/api/git/ (lib.mjs and its call files).

/**
 * git's C-quoted diff path decoded - `"b\303\251"` a `+++ ` header line prints when core.quotePath
 * covers the name. Octal escapes become \u00XX for JSON.parse (which answers \n, \t, \" and \\);
 * a value not wrapped in quotes passes through unchanged.
 */
export const unquoteDiffPath = (value) =>
  /^".*"$/.test(value)
    ? JSON.parse(value.replace(/\\([0-7]{3})/g, (_, octal) => `\\u00${Number.parseInt(octal, 8).toString(16).padStart(2, '0')}`))
    : value;

// git's repository-local variables (git rev-parse --local-env-vars). A hook or alias run in a linked worktree exports
// GIT_DIR=<main>/.git/worktrees/<wt>; a spec inheriting it pointed every fixture git at the LIVE .claude repo and re-inited
// it core.bare=true (2026-09-29, a6f60352c). tests/setup/isolated-registry.mjs drops the same list.
export const GIT_LOCAL_ENV_VARS = ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_IMPLICIT_WORK_TREE', 'GIT_PREFIX', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_GRAFT_FILE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_REPLACE_REF_BASE', 'GIT_SHALLOW_FILE'];
/** `parent` (the caller's env) without git's repository-local variables (GIT_CONFIG_KEY_n/VALUE_n go with GIT_CONFIG_COUNT). Pure. */
export function withoutGitLocalEnv(parent) {
  const env = { ...parent };
  for (const key of Object.keys(env)) if (GIT_LOCAL_ENV_VARS.includes(key) || /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(key)) delete env[key];
  return env;
}

/** A git spawn result (a scripts/api/git call file's) as {ok, stdout, error}: ok only on a clean exit, error from stderr or the spawn. Pure. */
export const gitResultOf = (r) => ({
  ok: !r.error && r.status === 0,
  stdout: r.stdout ?? '',
  error: (r.stderr ?? '').trim() || String(r.error?.message ?? (r.status == null ? 'timed out' : `exit ${r.status}`)),
});

/** A git spawn result's stdout text; throws the spawn error, or an Error naming `what` with git's stderr and exit status, unless git exited 0. Pure. */
export function gitOutputOf(r, what = 'git') {
  if (r.error) throw r.error;
  if (r.status !== 0) throw Object.assign(new Error(`${what} exited ${r.status}: ${(r.stderr ?? '').trim()}`), { status: r.status, stderr: r.stderr });
  return r.stdout;
}
