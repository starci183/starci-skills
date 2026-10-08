// env.mjs - the one place the runtime reads a named environment variable (smell S8-01/S8-02/S11-04; scripts/checks/check-env.mjs).
// modules/schemas/env.yaml catalogues every variable with its purpose and kind. Production code reads a variable here
// (readEnv) or takes an injected `env` parameter; it never reads `process.env.NAME` itself. The test runner is observed
// in exactly one place, isSpecRun: code that must not touch the host's real state during a spec asks it.

/** The value of the environment variable `name` in `env` (default: the process environment), or undefined. */
export const readEnv = (name, env = process.env) => env[name];

export { isSpecRun } from '../../engine/spec-run.mjs';
