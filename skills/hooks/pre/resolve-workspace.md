# pre/resolve-workspace.md

**Scope.** Any skill that reads or writes the target app's code — every FE and BE build, review,
consolidate, skeleton or sync skill. Not the setup or ledger skills, which resolve nothing but themselves.

**Before the skill acts**, resolve the tree it acts on. A path remembered from another machine is right
there and wrong here; the answer lives in the per-machine record, never hard-coded in a skill.

```
node scripts/workspace/read-workspace-context.mjs fe.path
node scripts/workspace/read-workspace-context.mjs be.path
node scripts/workspace/read-workspace-context.mjs fe.design_system
```

Read only what the work needs — the front end's path for a FE skill, the back end's for a BE one, the
design-system folder for anything that authors a component. If the record does not resolve, the skill
does not guess: it stops, and the workspace is registered first with `starci-setup-workspace`
(`--fe`/`--be`, either or both).
