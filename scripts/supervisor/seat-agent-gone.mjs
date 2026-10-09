// seat-agent-gone.mjs - whether a seat's terminal still holds its agent, read from the screen.
//
// A worker the host still lists as ready can hold no agent any more: the agent process exited and the terminal shows its host
// shell again. Text typed there is run by the shell as commands, so such a seat is dead: the launch replaces it and no wake is typed.

/** The shell prompt row a seat's terminal ends in because its agent is gone, or null (also null when the screen cannot be read). */
export function seatAgentGone(deps, terminal) {
  if (!terminal || !deps?.screen || !deps?.exitedRow) return null;
  let screen = null;
  try { screen = deps.screen(terminal); } catch { return null; }
  return screen == null ? null : deps.exitedRow(screen);
}

/** The dead health of a seat whose terminal shows `row`, the shell prompt left by the agent's exit. */
export const agentGoneHealth = (row, { terminal, dispatch = null }) =>
  ({ live: false, dead: true, agentExited: true, shellPrompt: row, reason: `the agent exited: the terminal shows the shell prompt '${row}'`, terminal, dispatch });
