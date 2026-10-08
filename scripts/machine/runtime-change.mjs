// runtime-change.mjs — the typed refusal of a runtime change by the Supervisor. Changing .claude belongs to Debug and the owner's
// release flow (modules/kernel/roles.yaml chain.runtimeChange); the verbs and the code are read from there, so the command guard,
// the file-write guard and the CLI dispatcher refuse with one voice.
import { rolesContract } from './roles-contract.mjs';

export const RUNTIME_CHANGE_CODE = 'RUNTIME_CHANGE_OWNED_BY_DEBUG';

/** The refusal fields {code, reason, remedy} for `words` (the group, verb and subcommand a caller runs), or null when they change nothing. */
export function runtimeChangeRefusal(words) {
  const { runtimeChange } = rolesContract().chain;
  const hit = runtimeChange.verbs.find((verb) => verb.every((word, index) => words[index] === word));
  if (!hit) return null;
  return { code: RUNTIME_CHANGE_CODE, reason: `the Supervisor changes no runtime code: starci ${hit.join(' ')} belongs to Debug`, remedy: runtimeChange.use };
}

/** The refusal fields for a Supervisor write inside the runtime checkout. */
export function runtimeWriteRefusal() {
  const { runtimeChange } = rolesContract().chain;
  return { code: RUNTIME_CHANGE_CODE, reason: 'the Supervisor changes no file of the runtime checkout: .claude belongs to Debug and the owner\'s release flow', remedy: runtimeChange.use };
}
