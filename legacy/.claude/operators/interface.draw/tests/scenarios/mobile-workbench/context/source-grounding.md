# Nivo Accounting source grounding

Read-only source inspection for the `mobile-workbench` interface direction. No Nivo source was modified.

## Frontend

- `D:/Repositories/nivo-fe/apps/app/src/components/blocks/agentos/KindWorkbenchBlock/index.tsx` at commit `5eec15cfa4664b95b7980aba3f03e74a95d55f21`, SHA-256 `bd7f17120d9e07fa73c786580cee22f10eddb80785e3d0c4157edbdf710b5cc8`: the registered `accounting-sheet` workbench exposes owner review, the next evidence pack, and an explicit review-only state.
- `D:/Repositories/nivo-fe/apps/app/src/messages/en.json` at the same commit, SHA-256 `856bf76121c84ae7fe3d6707b80c957ad8b5211fde567c7273ee82d2044c70ad`: settled English copy says `Review only · no self-approval` and `Approval remains explicit; the assistant prepares evidence but does not authorize payment.`

## Backend

- `D:/Repositories/nivo-backend/src/modules/bussiness/agentos-accounting/accounting.types.ts` at commit `5adaf96fc4d4deffbd2460ce18e0b84c897ce17b`, SHA-256 `db8f8d2d70e24c12f3f9c41327d2997fb3a5b4ee7e357ddea8e6e29d764b3b76`: classifications are `income`, `expense`, `receivable`, and `payable`; the workbench returns capabilities, corrections, documents, events, ledger, periods, reconciliations, currency, ledger amount, and ledger version.
- `D:/Repositories/nivo-backend/src/modules/bussiness/agentos-accounting/accounting.service.ts` at the same commit, SHA-256 `6daf40e2f6475e4708a2e530f5ee741a28165c2ad12cdc06bac14287ecc8400e`: document intake creates `draft`; owner submits; the distinct approver approves; owner posts an approved document by appending an immutable ledger row; reconciliation freezes the current high-water and accepts signed or zero source amounts; period close serializes with posting and correction; submitting a correction creates `pending` with no ledger mutation; distinct approval appends the correction ledger successor.
- `D:/Repositories/nivo-backend/src/features/core/api/core/graphql/agentos-accounting/accounting.mutation.resolver.ts` at the same commit, SHA-256 `9b67dac9e42c50c40029562309d35c5940d2ebe7ca271210291e666616012d3e`: supported commands are initialize, ingest document, submit document, approve document, post document, reconcile, close period, submit correction, and approve correction.
- `D:/Repositories/nivo-backend/src/features/core/api/core/graphql/agentos-accounting/accounting.query.resolver.ts` at the same commit, SHA-256 `ccb85dbb4614473e6b8b3fb7dfcd1c11b59c73d135c9da4345fb6e85886fb289`: supported reads are applied context and the currency-scoped workbench with optional ledger-version as-of input.

## Design implication

The mobile direction may reorganize these capabilities, but it must not imply editable historical ledger rows, self-approval, an effect from a pending correction, or any command outside the listed GraphQL mutations. Controls shown in the drawing remain proposed native UI controls backed by live server data in an implementation.
