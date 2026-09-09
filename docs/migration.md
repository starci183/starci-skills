# Directory naming and compatibility

New projects use this mapping:

| Previous directory | New canonical directory | Owner |
| --- | --- | --- |
| `.work` | `.starciwork` | Project backend; durable BE + FE metadata/evidence |
| `.starci` or `.starcitemp` | `.starciwork/_local` | Same backend; BE + FE plan/run/approval/staging |
| `.claude` | unchanged | Host; shared runtime |
| `.workspaces` | unchanged | Host; project bindings |

This release changes installation templates, documentation and new-project conventions. It **does not automatically rename existing project directories**. Public package/CLI naming changes to `starci`; the previous scoped package is not assumed to redirect to it.

## Resume existing work

Run `starci storage <backend-root>` before creating new Work or a Plan. It is read-only: `new`/`ready` allow canonical creation; `migration-required` means legacy names remain; `conflict` means both naming schemes exist; `unsafe` means a candidate path is not a real directory. Non-ready states return a nonzero exit code. No status authorizes a move or proves schema validity.

New workspace initialization and Plan bundle creation reject legacy paths and parallel canonical trees beside legacy storage. Compatibility below is for resuming existing bound Plan bundles only, not creating new plans indefinitely under the old names. Finish or pause those runs at a coordinated migration checkpoint.

Keep existing bindings intact until migration is coordinated. `workflows/storage.mjs` resolves a legacy `.work` root to sibling `.starci` for existing runs. A `.starciwork` root, or another explicitly provided nonlegacy root, resolves to its own `_local` directory. The separate `.starcitemp` location is retired and never selected for new state. Unmigrated split-storage bundles must be inventoried and explicitly relocated before resuming with this layout; never infer an empty replacement Plan. These path functions do not move or delete data.

Do not change the bound root halfway through a run. Absolute paths can participate in goal/request digests; moving files alone cannot transfer an approval. Having both directory pairs on disk does not authorize merging them or choosing a replacement automatically.

## Migrate deliberately

There is no automatic migration command in this alpha. A separate migration must:

1. Identify the backend owner and stop concurrent writes; inventory bindings, unfinished plans, receipts and source/evidence references.
2. Make a recoverable backup and verify the original workspace before moving anything.
3. Design an exact path/reference transition. Finish active plans first where practical; otherwise present revised goals and obtain actual new approvals rather than editing signed receipts.
4. Change the project binding, state locations and backend ignore rules together; validate metadata and required evidence at the destination.
5. Resume only verified records and retain the original recovery copy until migration is accepted. Move Plan/run/approval/drafts/staging into `_local`, preserving immutable record bytes. Check artifact references and any absolute evidence roots: moving state does not authorize rewriting past approvals or treating old proof as current.
6. Remove the retired `.starcitemp` directory only after every owned entry has been accounted for, copied or moved safely and verified. Refuse recursive deletion of nonempty unverified state or linked paths. An absent `.starcitemp` requires no deletion.

Only the workspace-root `_local` directory is excluded from canonical Work. A Plan or draft there cannot establish a node, satisfy a dependency or count as published evidence. Nested underscore folders remain invalid. Backend Git ignores `_local/` within `.starciwork`; durable business records remain versionable.

Do not rename `work/node@2`, `work/evidence@1`, object fields such as `workRoot`, `.workspaces`, `.worktrees`, or `.starci-skills.json` as a filesystem migration. They have distinct compatibility roles. `init`/`update` preserve both old and new product directory names from installer cleanup.
