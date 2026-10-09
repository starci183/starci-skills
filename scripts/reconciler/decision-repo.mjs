// decision-repo.mjs - a Decision Item (or a Supervisor gate item) that names a product ledger names it with a repository, or it is not opened.
//
// A Decision Item of a product ledger is written by `starci kernel decisions --open` run in the ledger's repository, and the Supervisor's item for a gate
// is answered by verbs that take `--repo`. An item planned with no repository behind its ledger (the ledger name or id is unknown, or its row has no
// repository) used to be opened anyway and found later by a reader: the verbs ran against the runtime root (ledger-root-is-runtime). The plan is
// refused where it is applied (ctx.openDecision, the one place every controller's item passes), with this code.
import path from 'node:path';

const NO_REPO = Object.freeze({ code: 'decision-item-without-repo' });
/** The failure code of an item planned without a repository (modules/kernel/failure-codes.yaml). */
export const DECISION_WITHOUT_REPO = NO_REPO.code;
const SUPERVISOR = 'supervisor';

/** The ledger an item names: its own ledger, else (a Supervisor item) the product ledger of its refs or its productLedger; null when it names none. */
const namedLedgerOf = (item) => {
  if (item.ledger !== SUPERVISOR) return item.ledger ?? null;
  return item.refs?.ledgerId ?? item.productLedger ?? null;
};

/** Whether a registered ledger answers to `name` (its id or its registered name) and has a repository. */
const hasRepo = (ledger, name) => (ledger.ledgerId === name || ledger.name === name || (ledger.repo && path.basename(ledger.repo) === name)) && Boolean(ledger.repo);

/**
 * The refusal of an item, or null: {code, error}. A Supervisor item that names no product ledger (a host-level item) needs no repository; every
 * other item needs its ledger to resolve, by id or by registered name, to a ledger that has one. `ledgers` are the ctx's [{ledgerId, name?, repo}].
 */
export function decisionRepoRefusal(item, ledgers) {
  const named = namedLedgerOf(item);
  if (named == null && item.ledger === SUPERVISOR) return null;
  if (!named) return { code: DECISION_WITHOUT_REPO, error: `${item.idempotencyKey ?? item.kind}: the item names no ledger, so no repository to run its verbs in` };
  if ((ledgers ?? []).some((ledger) => hasRepo(ledger, named))) return null;
  return { code: DECISION_WITHOUT_REPO, error: `${item.idempotencyKey ?? item.kind}: ledger ${named} resolves to no registered repository (by id or by name)` };
}
