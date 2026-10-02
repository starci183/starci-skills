// host-launch-env.mjs — the environment a desktop host (the Orca app) is launched with: this process's environment
// without any agent's Claude/ACP session variables, so the host and every agent it composes never inherit them
// (scripts/reconciler/services.mjs cleanEnv). Pure.

/** Launch the desktop host without inheriting an agent's Claude/ACP session. */
export function hostLaunchEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) =>
    !/^(?:CLAUDECODE|CLAUDE_CODE_.*|CLAUDE_AGENT_.*|CLAUDE_SESSION_ID|AGENT_SESSION_ID|SESSION_ID|ACP_BACKEND)$/i.test(key)));
}
