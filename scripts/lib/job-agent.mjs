// job-agent.mjs — the agent provider an op job's payload names.

/**
 * The agent of a job payload: the leading claude|codex|devin word of provider, agent, model or
 * route.agent (lowercased); 'claude' for a managed payload that names none; null otherwise.
 */
export const agentOfJob = (payload) =>
  /^(claude|codex|devin)/i.exec(String(payload?.provider ?? payload?.agent ?? payload?.model ?? payload?.route?.agent ?? ''))?.[1]?.toLowerCase()
  ?? (payload?.managed ? 'claude' : null);
