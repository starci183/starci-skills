// ledgers.mjs — the reconciler ctx's ledger-list reads.

/**
 * The product ledgers of a reconciler `ctx`: every `ctx.ledgers` entry with a ledgerId other than
 * 'supervisor' and a file to open.
 */
export const productLedgers = (ctx) => (ctx?.ledgers ?? []).filter((l) => l && l.ledgerId !== 'supervisor' && l.file);
