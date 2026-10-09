// env.mjs - the one place the runtime reads a named environment variable (smell S8-01/S8-02/S11-04; scripts/checks/check-env.mjs).
// modules/schemas/env.yaml catalogues every variable with its purpose and kind. Production code reads a variable here
// (readEnv) or takes an injected `env` parameter; it never reads `process.env.NAME` itself. The test runner is observed
// in exactly one place, isSpecRun: code that must not touch the host's real state during a spec asks it.

/** The value of the environment variable `name` in `env` (default: the process environment), or undefined. */
export const readEnv = (name, env = process.env) => env[name];

/** True when `env` (default: the process environment) belongs to a spec run (`node --test` marks its children with NODE_TEST_CONTEXT). */
export const isSpecRun = (env = process.env) => Boolean(env.NODE_TEST_CONTEXT);

/**
 * The environment for a child that is itself a test runner: `env` without the mark of an enclosing spec run. A `node --test` that inherits NODE_TEST_CONTEXT believes it is a
 * subtest of that run: it reports to its parent and exits 0 whatever its tests did, so a verb that runs specs as a child (starci test affected, the land gate, the release cut, the
 * suite) would pass red specs from inside a test process. The runner marks the spec files it starts itself, so isSpecRun stays true inside them.
 */
export function withoutTestRunner(env = process.env) {
  const { NODE_TEST_CONTEXT: _enclosing, ...rest } = env;
  return rest;
}
