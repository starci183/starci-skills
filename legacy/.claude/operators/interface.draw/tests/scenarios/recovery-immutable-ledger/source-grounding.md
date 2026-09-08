# Immutable ledger source grounding

This scenario uses the supplied baseline and read-only inspection of real Nivo source. It does not run either application or claim working frontend behavior.

- Frontend worktree revision: `f234d1abe6dd8f59fa4031959f8c55934e8997b0`.
- `AccountingWorkbenchBlock/component.tsx` SHA-256 `5e4a0d23b13f9c891d74c3181c12894e7773873b41b2c93c6993ff98ee1f81bf`: the statement snapshot renders `ledgerAmountMinor` as a `Heading`, followed by `immutableBalance` (English: “Current immutable balance”). The only adjacent input is `asOfVersion`, whose hint says it inspects an immutable historical snapshot. Historical mode disables correction inputs.
- `AccountingWorkbenchBlock/useAccountingWorkbench.ts` SHA-256 `f1a8eca36d7ce58ec4c35cbad65bbb2739e1360b97858133d83c72176ace9c17`: correction availability is advisory and role/state constrained; commands use explicit document and correction operations.
- `modules/api/accounting.ts` SHA-256 `2735326ca25f512d2f624437c2ae3fb59f6bea26591dbfe3ff5965c5fd5780ea`: the workbench exposes `ledgerAmountMinor`, `ledgerVersion`, immutable ledger rows, and explicit mutations for posting and correction workflow. There is no direct balance-save mutation.
- Backend revision: `5adaf96fc4d4deffbd2460ce18e0b84c897ce17b`.
- `accounting.service.ts` SHA-256 `6daf40e2f6475e4708a2e530f5ee741a28165c2ad12cdc06bac14287ecc8400e`: document posting inserts a ledger row; `submitCorrection` is documented as submitting an immutable proposal without changing the ledger; `approveCorrection` atomically inserts the sole signed successor and increments `ledger_version`; `readWorkbench` derives the displayed balance by summing ledger rows through the selected version.

The product contract for this scenario is therefore: the displayed ledger balance is derived and read-only. A user may inspect an earlier version, post an approved document, submit a correction proposal, or approve a proposal when authorized. No user edits an existing ledger row or directly saves the displayed balance.
