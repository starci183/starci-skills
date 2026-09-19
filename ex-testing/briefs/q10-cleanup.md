# Lane Q10 (qwen) — scaffolding cleanup sweep

SCOPE (exclusive): delete-only sweep + NEW `ex-testing/CLEANUP-REPORT.md`. May delete: `**/stubs/`, `**/infra-contract.d.ts`, `*.d.ts` files that shadow real `.ts` under `src/tests/`, `test/` dirs outside `src/tests`, `*.js` leftovers under `src/tests`, `nul` files. May NOT delete anything under `src/modules`, `src/features`, `apps/`, or outside `examples/`.

Hunt both apps for leftover scaffolding from the parallel-lane phase (contract stubs, throwing stub services, ambient `.d.ts` next to real implementations). Verify each candidate is truly unreferenced before deleting (grep imports). Write the report listing every deleted path + proof it was unreferenced.
