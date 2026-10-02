// test-world-slot.mjs - the one answer of the machine checks to "is this slot the test world": the slot `be.tests.world` or one of its
// sub-slots (`be.tests.world.kit`, the world's inlined helpers), which form one test composition root. The lint side asks the same of
// the slot view through `inTestWorld` of packages/eslint/be/lib/hfs.mjs.

/** True when `slot` (a slot id, or a file's slot) belongs to the test world family. */
export const isTestWorldSlot = (slot) => typeof slot === 'string' && (slot === 'be.tests.world' || slot.startsWith('be.tests.world.'));
