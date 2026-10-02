/**
 * The transport slots of the HFS manifest, in one place.
 *
 * A slot id is manifest vocabulary, not a path: every rule that judges "a transport file" asks this instead of spelling
 * the ids itself. A cli command is no transport: it is an action runner of the cli feature root (slot `be.cli`).
 */

/**
 * True for a slot that holds transport code (`be.transport.<protocol>`).
 *
 * @param {string | null} slot - A slot id from `hfs.slotOf`.
 * @returns {boolean} Whether files of that slot are transport files.
 */
export const isTransportSlot = (slot) => typeof slot === "string" && slot.startsWith("be.transport.")
