# Lane v6-4 — CRITICAL ANALYSIS: does .starciwork actually manage change + extension well?

READ-ONLY AUDIT + dry-run analysis. Write only `.claude/ex-testing/lint/v6-4-REPORT.md`. You may run gate/check scripts and read everything under `.claude/` and `examples/*/`.

## Questions to answer (evidence-based; trace the actual mechanism, don't theorize)

1. **Change isolation**: when a module's code changes, what EXACTLY goes stale? Trace `check-example-work.mjs`'s codeDigest mechanics + `example-ownership.mjs`: is the blast radius = the owning record's evidence only, or does it cascade (recordDigest → dependents)? Prove with the real data: the ec-be `apps/`→`src/` merge staled how many records, and is that number right or over-flagged?
2. **Evidence as impact-reduction**: does evidence.yaml's per-file codeDigest actually let you tell WHICH file moved (i.e. does the diff tell you the blast radius, or just "stale")? When v5-1 rewires `src/tests/infra/**`, which records will stale — enumerate them NOW from the evidence files' `files[]` lists.
3. **Adding a feature**: walk through concretely — "add feature `promo-code` to ec-be": which records must exist before impl can be `done` (ui-before-impl rule, contract records, catalog entry, brand binding)? Is the ordering enforced or optional? Where does the gate REFUSE shortcuts?
4. **Extending a rule**: `br.checkout.place-order` got a new statement — what must change (change.rev bump? ac additions? evidence re-run?) and does anything force it? Check `br.task.complete.once` rev-2 in todo-be — did the revocation mechanics actually get followed there (withdraws, re-proof)?
5. **Rename/refactor resilience**: module dir renamed → owners/module paths break (ec-be proved this). Is there a migration tool or does every record hand-edit? Assess: is identity-by-id (not path) actually holding — did the apps/*→src/* move break IDs or just paths?
6. **What's missing**: things the model can't express that real maintenance needs — e.g. multi-repo FE records living in BE tree (todo-app-frontend code is a separate repo — who re-proves `impl/todo-app-frontend/*` when that repo changes? does the codeDigest even see that code?).

## Output
Answer each numbered question with mechanism evidence (script names, field names, real record paths). Then: 3 failure modes the current model WILL hit in the next month of development, and the minimal mechanism change that would prevent each.
