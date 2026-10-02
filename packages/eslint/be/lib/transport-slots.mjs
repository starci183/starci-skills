/**
 * The transport slots of the HFS manifest, in one place.
 *
 * A slot id is manifest vocabulary, not a path: every rule that judges "a transport file" asks this instead of spelling
 * the ids itself. The command-line slot carries its feature prefix in the manifest (`be.feature.transport.cli`), and the
 * webhook and realtime kinds hold their doors in slots of their own (`be.webhooks`, `be.realtime`): a provider webhook and a
 * push channel are doors like any other and answer to the door laws (default deny, bounded input, no envelope).
 */

/** The slots of the feature kinds that are doors but are not an api's `transport/<protocol>/` folders. */
export const KIND_DOOR_SLOTS = Object.freeze(["be.webhooks", "be.realtime"])

/**
 * True for a slot that holds transport code (`be.transport.<protocol>`, the command-line slot and the door slots of the webhook and realtime kinds).
 *
 * @param {string | null} slot - A slot id from `hfs.slotOf`.
 * @returns {boolean} Whether files of that slot are transport files.
 */
export const isTransportSlot = (slot) => typeof slot === "string" && (slot.startsWith("be.transport.") || slot === "be.feature.transport.cli" || KIND_DOOR_SLOTS.includes(slot))
