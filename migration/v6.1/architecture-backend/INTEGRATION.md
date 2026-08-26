# Integration procedure

This package is isolated so parallel v6.1 work can be merged without editing shared registries prematurely.

1. Review `SPEC.md` and approve the capability boundaries.
2. Move each manifest under `operators/architecture` and `operators/backend` into a normal eight-file v6 operator contract. Preserve the manifest's accepted artifacts, emitted artifact, gates, decisions, and stop conditions.
3. Copy the JSON schemas into a stable shared schema package or inline the exact relevant definitions into each operator schema. Do not weaken closed-object or semantic validation.
4. Add the architecture capabilities and backend capabilities to the operator registry.
5. Create small skills around approval boundaries instead of restoring one lifecycle-sized machine:
   - architecture discovery/model;
   - architecture option approval;
   - architecture independent critique;
   - backend solution and contract approval;
   - backend implementation;
   - backend conformance/proof.
6. Wire `machines/architecture.machine.json` and `machines/backend.machine.json` through the global capability router. Handoffs use `schemas/capability-handoff.schema.json`.
7. Require `dataOwnershipRef`, `designRealizationRef`, `contradictionLedgerRef`, `critiqueReceiptRef`, and the approved backend contract refs before granting exact source access.
8. Insert backend implementation conformance before format/lint/typecheck/build/test.
9. Add the behavior cases in `architecture-backend.spec.mjs` to the root test command.
10. Run materialization only after shared catalog/router changes are complete. This branch must not run it.

## Compatibility

Existing v6 architecture/backend skills become compatibility routers. They select the first missing capability and forward a typed handoff. They must not execute their old lifecycle-sized state machines after the v6.1 route is enabled.

## Release gate

Do not enable v6.1 globally until:

- all schemas and semantic validators reject the four regression cases;
- every state-changing backend plan names a physical store, database/schema or collection/bucket, resource, writer, migrator, transaction model and deployment realization;
- observed source and approved target remain distinguishable;
- independent critique cannot be bypassed for persistence, deployment, security, money, identity, retention or cross-service changes;
- the old monolith routes to capabilities without reloading already acknowledged context.
