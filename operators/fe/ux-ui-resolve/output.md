# `fe/ux-ui-resolve` output

## JSON architecture

The output state is `repair-ready`, `resolved`, or `blocked`.

- `repair-ready` carries one typed handoff, explicit visual assertions, and request-ledger approvals. It never claims the defect is fixed.
- `resolved` carries passing rerun proof for the same requests and request-ledger resolution mutations. It never carries a repair handoff.
- `blocked` carries evidence-backed findings and no request mutation.

`payload.artifact` preserves the defect class, target capability, exact request actions, observable assertions, and closure proof. `payload.produced.mutations` may touch only declared `.claude/requests/*.request.json` targets. Session intermediates purge at `skill-terminal`; durable request-ledger mutations survive.
