// start-phase.mjs - the phase lines of a Kernel start. `start-workflow` prints its one JSON answer at its end, so a start killed at its bound left nothing; each step
// names itself on stderr first, and the watchdog journals the last line as the cause of a start that never answered (kernel-watchdog.mjs unansweredStart).

/** Names the phase the start stands in. */
export const phase = (name) => console.error(`start-workflow: phase ${name}`);
