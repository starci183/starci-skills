# Release authorized work

This internal procedure is loaded by an explicit StarCi release request. The public entry is
`/starci`; there is no separate public push skill. Selection alone authorizes no release.
Use `docs/source-process.md` and `docs/git-governance.md` as the maintained release authorities.

Resolve the exact repository, accepted release scope, version and annotated tag. Inspect its native
status and release evidence. If these are unclear, present a concrete release plan for the owner's
approval before a tag, package publication or push. Continue an unchanged approved release without
repeated confirmation. Never supply missing approval from an agent's judgement.

## Qualified Source release

1. Finish and qualify bounded lanes, then land locally through the native land owner. Lanes run the
   targeted and dependent scopes in the test ladder; the coordinator freezes clean local main.
2. Follow the existing release owners for the version, finished CHANGELOG, package publication and
   example pins. Preserve actual package, image, UI/UAT and compatibility receipts required by scope.
3. Invoke the native release cut for the accepted tag:

   ```
   starci release cut --tag v<version>
   ```

   The release cut owns L4, the host lock, Linux parity, main-stability and secret checks, the annotated
   tag and atomic main-plus-tag push. Read its recorded logs and actual result. Do not start a second
   full-suite run in a lane, monitor or maintenance worker, and do not reconstruct this flow manually.
4. A red or refused cut stays visible. Repair each failing group in a bounded authorized lane using
   its targeted checks; requalify changed scope through the native owners before resuming release.
   Do not weaken a spec, add a waiver, stash another owner's work, force push or bypass hooks.
5. Report the actual frozen and pushed SHA, tag, published versions, L4/parity evidence and any
   remaining refusal. A plan or local green gate is not publication or remote acceptance. Report the
   tag's CI confirmation separately when available.

Product releases follow the same maintained governance for their own accepted scope. Full app
`unit.verify` or `e2e.verify` runs are on-demand goal/owner actions, not an automatic extra release.
`scripts/supervisor/push-git.mjs` remains a native compatibility mechanism; its existence grants
neither another public entry nor an alternative permission to push main outside the release owner.
