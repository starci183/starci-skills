// spec-run.mjs - whether this process belongs to a spec run. The engine reads it to keep the owner's live files out of a spec.

/** True when `env` (default: the process environment) belongs to a spec run (`node --test` marks its children with NODE_TEST_CONTEXT). */
export const isSpecRun = (env = process.env) => Boolean(env.NODE_TEST_CONTEXT);
