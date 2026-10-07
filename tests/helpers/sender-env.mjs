// A Kernel launch needs a sender terminal (ORCA_TERMINAL_HANDLE); the specs that start a workflow name a fake one
// unless the spec set a non-empty value of its own (a blank one, to prove the refusal).
export const senderEnv = (script, env) => !String(script).endsWith('start-workflow.mjs') || env.ORCA_TERMINAL_HANDLE
  ? env : { ...env, ORCA_TERMINAL_HANDLE: 'fake-sender-terminal' };
