# Maintaining StarCi Work 3.0

Read the current entry, selected code/contract and its consumers before editing. The user's explicit requested major refactor defines the scope; do not open a v2 session or reconstruct request/response chains to maintain v3.

## One authority per concept

Core schemas define machine shapes; core computes validation/digests/rollups. Operator common policy defines shared execution rules; op documents define domain-specific reads, writes and proof. skills/catalog.json owns preset discovery; each recipe owns its bounded mode/sequence. Entrypoints reference these authorities, never invent another routing graph. Scope/dependencies remain product-owned.

Change a contract and all affected consumers together. Preserve stable IDs; incompatible meanings require a version transition. English documents are runtime authority; same-stem Vietnamese documents are human mirrors. Keep domain-specific implementation details in the actual operation, not universal policy.

## Grounding

Inspect existing behavior before prescribing a fix. Separate observations from requirements and inference. Keep concrete product identities, machine paths and credentials out of reusable contracts. Synthetic examples must be labeled and must not masquerade as product acceptance.

Implement rejection checks where deterministic validation is possible. Test missing/changed evidence, stale inputs, path escape, ambiguous ownership and incomplete coverage. A hash cannot verify honesty of an authored statement; do not advertise it as such.

## Verification and commits

Run affected v3 tests and the complete npm test before final delivery. Test relocated installation and CLI consumers when entrypoints or payload change. Commit exact piece ownership sets; do not sweep unrelated user edits into a commit. Preserve failed evidence and describe any unrun verification.

Do not hand-edit generated op documents; change the v3/ops producer and check reproducible generation. Removed V2 source/docs/tests are recoverable through Git, not an executable fallback. Verify installed references and package contents without old directories. Preserve domain knowledge while removing obsolete session/routing instructions.

## Release and migration

A version change is not publication. Keep alpha/release status accurate. No npm publish, remote push, runtime deployment, real account operation or .worktrees migration is authorized merely by a request to edit this package.

A major installer upgrade requires deliberate opt-in and must not mutate product .work/.worktrees contents. Preserve custom bootstrap instructions; if they conflict with the new protocol, stop before payload writes and explain the conflict. Audit and preserve canonical Git/evidence/secret ownership before any separate data migration.
