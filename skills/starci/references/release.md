# Release authorized work

This internal procedure is loaded by an explicit StarCi release request. The public entry is
`/starci`; there is no separate public push skill. Selection alone authorizes no release.
Use `docs/source-process.md` and `docs/git-governance.md` as the maintained release authorities.

Resolve the exact repository, accepted release scope, version and annotated tag. Inspect its native
status and release evidence. If these are unclear, present a concrete release plan for the owner's
approval before a tag, package publication or push. Continue an unchanged approved release without
repeated confirmation. Never supply missing approval from an agent's judgement.

## Qualified Source release

1. Finish and qualify bounded lanes, then land locally through the native land owner. Lanes prove each
   tip with `starci runtime verify` (check, package clean-test, scaffold e2e); the coordinator freezes clean local main.
2. Follow the existing release owners for the version, finished CHANGELOG, package publication and
   example pins. Preserve actual package, image, UI/UAT and compatibility receipts required by scope.
3. Invoke the native release cut for the accepted tag:

   ```
   starci release cut --plan --tag v<version>
   starci release cut --tag v<version>
   ```

   The `--plan` form reports what the cut would run and require and runs, tags and pushes nothing. The runtime's remote main is not pushed between releases: the pre-push
   hook refuses a push of `main` or of a `v*` tag unless the pushed commit is a release commit (version moved past the remote main's, annotated tag `v<version>`, dated
   CHANGELOG heading, and the release record of that exact commit with green package clean-test, scaffold e2e and checks rows), so this cut is the only way the remote moves.

   The cut refuses at once (verdict `release-host`, in `--plan` too) unless the host provides what L4 needs: the lockfile install and a Docker daemon that answers (the example images, the scaffold e2e, the stack-backed example specs and the Linux parity container).

   The L4 rows run as a schedule: the Linux parity container starts first and runs beside the root rows, the three example apps and their SonarCloud proofs run together once the checks row has ended, and a red row never cancels another (the result lists every red row). A cut on a new commit reuses a green row of an earlier cut only when the row's declared input set is byte-identical between the two commits (the example apps' rows; `--plan` prints `run`, `carry` or `reuse` with the reason per row); the three required rows (the package clean-test, the scaffold e2e and the runtime check) always run on the pushed commit, and the record lists each reused row with the commit that proved it. `--no-reuse` runs all rows. An env-only red row is re-run alone on the same commit with `starci release cut --tag v<version> --rows "<row>,<row>"`, which completes the record when every other row is already green on it. The numbers and input sets are `modules/supervisor/release-cut.yaml`; the details are in [releasing](../../../docs/releasing.md).

   `config.yaml` `release.suite` chooses where the Linux parity runs: `local` (default; the cut runs it) or `ci` (the owner's recorded choice of 2026-10-09: the cut does not plan it, lists it as `delegated` in the record, and the GitHub `ci` workflow judges it after the push). Both modes run the root rows and the example rows locally. The pre-push gate accepts a `suite: ci` record only while the checked-out config says `ci`. The trade: a release can reach GitHub and its tag before the Linux parity has run, and a red CI is fixed forward with the next pre-release; read the verdict with `starci release ci-status --tag v<version> --wait`. Details: [releasing](../../../docs/releasing.md#where-the-suite-runs).

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
`scripts/supervisor/push-git.mjs` and `push-mains` push product repositories only; they refuse the runtime
repository, whose main moves only through the release owner.

## Missing release shell

A real runtime cut whose only host prerequisite missing is its actual Orca terminal may prepare
one plain PowerShell shell in the canonical Source. It still returns a release-host refusal, with
the complete native receipt; no suite, tag or push starts. Inspect that receipt and run the cut
inside the newly owned terminal. Never copy a handle into an environment to impersonate its context.
The plan stays read-only. Unknown creation custody is retained: inspect native terminal inventory
before any deliberate retry; the adapter has no automatic retry or arbitrary command input.
