# Assisted UAT

Assisted UAT is a two-operation proof path for an accepted browser flow that contains at least one
checkpoint a person must perform or observe. It is not a general label for external systems. A provider API,
remote browser, payment processor or other third party remains an automated step when the selected tools can
execute and observe it safely. A flow without a genuine human gate uses `uat.verify`.

`uat.assisted.prepare` freezes the accepted flow and creates a deterministic controlled session.
`uat.assisted.verify` later consumes the exact prepared session and one immutable runner receipt. Neither
operation authors canonical Work completion. The selected UAT record remains `state: todo`; only final
reconciliation may bind current SRS, SDS, implementation, test/E2E and UAT evidence to one delivery revision
and write `done`.

## Human gate classification

Every gate must name the flow and preceding step, explain why automation must stop, define a structured
response and require evidence. The allowed classes are:

- `secret-entry`: a person enters a value that must never enter model context, logs or media, such as an OTP.
- `anti-automation-challenge`: a real challenge explicitly requires a person; a provider merely being capable
  of presenting one is not enough.
- `cross-device-action`: progress requires an action on a separately controlled device or channel.
- `subjective-observation`: accepted behavior explicitly requires a human observation that cannot be reduced
  to an existing machine postcondition. The response schema must capture the observation, not generic approval.
- `reserved-manual-action`: policy or authority explicitly reserves that exact action to a person.

The presence of a human gate does not make nearby steps manual. Scripts automate every other selected step and
pause only on declared gate IDs. A gate response is an execution fact. It does not change the accepted expected
behavior.

## Prepared bundle

The prepare operation owns these paths under its evidence root:

```text
E/assisted-uat/request.yaml
E/assisted-uat/session-manifest.yaml
E/assisted-uat/playwright/<flow-id>.spec.ts
E/assisted-uat/redaction.yaml
E/assisted-uat/cleanup.yaml
E/assisted-uat/receipts/<run-id>.yaml
E/assisted-uat/runs/<run-id>/**
```

The first five are finalized by `uat.assisted.prepare`. The controlled runner adds one new run directory and
writes its receipt last. It must refuse an existing receipt path or run ID. Verification receives the exact
request, session and receipt paths; it never searches for a latest or passing run.

`request.yaml` uses `schema: starci/assisted-uat-request@1` and has these fields:

- `requestId`, `nodeId`, `preparedAt`.
- `bindings`: `inputDigest`, `buildDigest`, `environmentDigest`, `flowsDigest`.
- `build`: repository, revision and served identity.
- `environment`: resource ID, revision and origins.
- ordered `flows`, each with ID, entry, actor and ordered steps. Each step carries its ID, action, expected
  result, machine postconditions and evidence requirements.
- ordered `humanGates`, each with ID, flow ID, preceding step ID, allowed class, reason, prompt,
  `responseSchema` and `evidenceRequired`.
- ordered `scripts`, each with flow ID, path, sha256, command and cwd.
- `sessionManifest.path`, and path/sha256 bindings for `redaction` and `cleanup`.
- `receipt`: schema, run-ID path template and `immutable: true`.
- bounded `limits` for timeout, retries and authorized spend when applicable.

`session-manifest.yaml` uses `schema: starci/assisted-uat-session-manifest@1`. It contains `sessionId`, the exact
request path and sha256, that same value as `requestDigest`, repeated input/build/environment/flow bindings, `scriptsDigest`,
`cleanupPlanDigest`, `redactionPolicyDigest`, actual Playwright/browser revisions, argv-safe launch data,
ordered script hashes, ordered gate IDs, required artifact rules and a write-once receipt template. Environment
variable names may be recorded; values may not.

All digests are lowercase sha256 of the exact finalized bytes or the explicitly defined ordered input set. A
mutable branch, friendly environment name or hostname is not a digest. Request bytes are finalized before the
session manifest hashes them.

## Runner receipt

The runner accepts explicit absolute `--request <request.yaml>` and `--receipt <new-receipt.yaml>` paths only.
It validates the bound session, refuses digest mismatch and writes the receipt only after every referenced
artifact is finalized and hashed. It does not discover a request, select a run or write the runtime ledger.

The receipt uses `schema: starci/assisted-uat-receipt@1` and contains:

- `receiptId`, `runId`, exact request and session-manifest paths/sha256.
- repeated `requestDigest`, `inputDigest`, `buildDigest`, `environmentDigest`, `flowsDigest`, `scriptsDigest`,
  `cleanupPlanDigest` and `redactionPolicyDigest`.
- runner, platform, Playwright and browser revisions plus start/finish times.
- `completionSignal: {value: ok, actor, recordedAt, meaning: execution-finished-not-pass}`.
- ordered flows and steps with `completed`, `failed` or `not-run` execution status, observations and evidence
  references.
- declared human gates with structured response and evidence references.
- executed checks with exact command, exit code and evidence references.
- artifacts with path, sha256, media type and redaction status.
- postconditions with expected, observed, status and evidence references.
- cleanup attempt/actions/unresolved effects and redaction result/failures.

The receipt has no accepted `pass` field. `ok` is the person's completion signal: the controlled session has
finished and the receipt may be verified. It is never an acceptance answer, a postcondition, a kernel verdict or
permission to change Work state.

## Independent verification

`uat.assisted.verify` fails closed unless all of the following are current and green:

1. Exact request, session, script, policy and receipt bytes reproduce every digest and identify one unreused run.
2. Current Work input, served build, environment and ordered flows reproduce the receipted bindings.
3. Every accepted flow, step and declared human gate has an honest ordered execution status and required evidence.
4. Required artifacts are enumerated, nonempty, current-hash exact, type-correct, finalized/playable and linked to
   the correct run, flow, step and gate.
5. Redaction inspection finds no credential, token, cookie, secret-entry value or unrelated personal data.
6. Independent read-only probes reproduce every required business/technical postcondition.
7. Independent owner probes confirm every selected run-owned effect absent or restored, with explicit reasons for
   authorized retained objects.

Verification does not replay the product action, execute cleanup, edit a receipt, substitute another run or call
automatic `uat.verify`. A stale binding, failed postcondition, invalid artifact or incomplete cleanup stays failed
or blocked even when the person supplied `ok` and the runner exited zero.

## Reporting boundary

Preparation, the runner receipt and verification evidence are artifacts of dispatched operations. The runner
never edits `.starciwork/runtime.sqlite`. After its own checks, the surrounding operation creates the ordinary
`starci/op-report@1` envelope, cites only owned artifact paths, files it through
`node .claude/scripts/kernel/api.mjs report --repo <bound-repo> --job <current-job> --report <op-report.json>`,
then signals the kernel. The kernel re-runs declared checks before settlement. No separate assisted-UAT ingestion
verb or direct SQL path exists.
