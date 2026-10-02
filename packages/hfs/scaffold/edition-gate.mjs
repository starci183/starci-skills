// The edition gate of `hfs add` and `hfs new` (design 8.6 R8): a verb whose file tree lands in a slot the app's
// edition does not have - the slot's `editions` exclude it, or its `litePresence` is forbidden - is a full-edition
// capability and refuses before anything is planned or written. The slot resolver of the app answers, the same
// view `hfs check` reads; the noun's name is never the test, so a slot the lite manifest forbids refuses every
// verb that writes into it, with no noun list kept anywhere.

/** The refusal of a verb a non-full edition does not carry: printed verbatim by the CLI, exit 2, nothing written. */
export class EditionRefusal extends Error {
  constructor(command) {
    super(`${command}: full edition only; run starci app upgrade --edition full`);
    this.name = 'EditionRefusal';
  }
}

/**
 * Refuses `command` (`add <noun>`, `new <noun>`) when one of `slotIds` - the slots the verb writes into - does not
 * exist for the edition of `resolver`'s repository or is forbidden under it. `resolver` is the
 * createSlotResolver() view of the app; every scope answers a slot id. Under edition full the gate never fires.
 */
export function refuseInEdition({ resolver, slotIds, command }) {
  if ((resolver.repo.edition ?? 'full') === 'full') return;
  if (slotIds.some((id) => resolver.slot(id) === null || resolver.slot(id).presence === 'forbidden')) throw new EditionRefusal(command);
}
