// Fake Orca resources have no OS processes; replay-world accounts for real harness children.
// The worker-close fixture still refuses a surviving captured worker object.
export function processEnv({ names }) {
  if (names.length !== 1 || names[0] !== 'ORCA_TERMINAL_HANDLE') throw new Error('unexpected purge fixture environment read');
  return [];
}
