// The edition gate of `starci app add` and `starci app new` (design 8.6 R8): a verb whose file tree lands in a slot the app's
// edition does not have - the slot's `editions` exclude it, or its `litePresence` is forbidden - is a full-edition
// capability and refuses before anything is planned or written. The slot resolver of the app answers, the same
// view `starci app check` reads; the noun's name is never the test, so a slot the lite manifest forbids refuses every
// verb that writes into it, with no noun list kept anywhere. The refusal carries no failure code by design: the
// scaffolders of packages/hfs keep their codes out of the runtime catalog (like HFS_SCAFFOLD_LOCK_FAILED).

/** The refusal of a verb a non-full edition does not carry: printed verbatim by the CLI, exit 2, nothing written. */
export class EditionRefusal extends Error {
  constructor(command, message = `${command}: full edition only; run starci app upgrade --edition full`) {
    super(message);
    this.name = 'EditionRefusal';
  }
}

/**
 * The refusal of a pattern noun in a lite app whose topic carries a `liteAdapter` (ruling:R212/case-1, amended by ruling:R212/case-4):
 * lite has the pattern, but the package carries only its full-adapter templates, so generating them would write adapter paths
 * unavailable in lite. The pattern is written by hand using the topic's declared lite adapter until the package carries a lite template.
 */
export class LiteAdapterRefusal extends EditionRefusal {
  constructor(command, topics) {
    super(command, `${command}: the package carries only the full adapter of ${topics.join(', ')}; in a lite app write it on its Supabase adapter (knowledge/patterns/be/${topics[0]}.yaml liteAdapter, knowledge/patterns/be/supabase-queues.yaml)`);
    this.name = 'LiteAdapterRefusal';
  }
}

/** Refuses `command` in a lite app when one of `topics` (pattern topic ids with their parsed documents) carries a `liteAdapter`. */
export function refuseFullAdapterInLite({ edition, topics, command }) {
  if (edition !== 'lite') return;
  const adapted = topics.filter(({ doc }) => doc?.liteAdapter !== undefined).map(({ id }) => id).sort();
  if (adapted.length) throw new LiteAdapterRefusal(command, adapted);
}

/**
 * Refuses `command` (`add <noun>`, `new <noun>`) when one of `slotIds` - the slots the verb writes into - does not
 * exist for the edition of `resolver`'s repository or is forbidden under it. `resolver` is the
 * createSlotResolver() view of the app; every scope answers a slot id. Under full every verb slot exists and none is
 * forbidden, so the gate never fires. A slot id the view does not answer (an `editions` exclusion, or an unknown id) refuses
 * in every edition alike: the view cannot tell them apart, and the callers name only slots of the manifest.
 */
export function refuseInEdition({ resolver, slotIds, command }) {
  if (slotIds.some((id) => resolver.slot(id) === null || resolver.slot(id).presence === 'forbidden')) throw new EditionRefusal(command);
}
