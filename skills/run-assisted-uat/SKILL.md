---
name: run-assisted-uat
description: >-
  Run one already-prepared assisted browser UAT request through the locked project Playwright runner,
  relay its finite frozen human checkpoints, collect an immutable sanitized receipt, and return it to
  the current operation for normal report ingestion. Use when a prepared assisted-UAT request needs a
  person to enter a secret, solve an anti-automation challenge, act on another device, make a reserved
  manual action, or record a subjective observation in a visible browser.
---

# Run assisted UAT

This skill executes one prepared `starci/assisted-uat-request@1`; it does not prepare or change a flow.
The only runner is:

```text
node <Source>/.claude/scripts/uat/assisted-runner.mjs <command> \
  --request <absolute E/assisted-uat/request.yaml> \
  --receipt <absolute E/assisted-uat/receipts/<new-run-id>.yaml>
```

`<Source>` is the host that owns this skill. The request and receipt arguments are always explicit and
absolute. Never scan for a “latest” request or receipt. A new attempt uses a new receipt/run ID; never
overwrite an old receipt or reuse its run directory.

## Boundary

- The prepare operation already froze build, environment, ordered flows, scripts, finite `humanGates`,
  redaction, cleanup and receipt paths. The runner recomputes all request/session/file digests before
  launch and before accepting a signal. A mismatch is stale preparation, not permission to refresh a
  digest or continue against a different build.
- Prepared semantic digests use SHA-256 over canonical JSON: object keys sort recursively and array order is
  preserved. `buildDigest`, `environmentDigest` and `flowsDigest` cover their same-named request values;
  `inputDigest` covers `{build, environment, flows, humanGates, scripts, redaction, cleanup}`; and
  `scriptsDigest` covers the ordered session `{flowId, path, sha256}` entries. `requestDigest`, policy hashes
  and script hashes cover exact finalized bytes. Preparation and execution must use this one algorithm.
- The runner launches the request's project-local locked Playwright version with a visible
  Chromium/Chrome browser, `--headed`, one worker and isolated Playwright test contexts. It refuses a
  global/arbitrary runner or a manifest whose installed version/browser revision drifted.
- The runner writes run artifacts only below the declared `runs/<run-id>/` and writes the YAML receipt
  last with create-only semantics. It never opens `.starciwork/runtime.sqlite`, changes a Work record,
  declares pass, settles a job or invents workflow identity.
- The enclosing dispatched operation verifies the exact receipt and artifacts, independently reruns its
  machine checks, builds its ordinary `starci/op-report@1`, and files that through
  `scripts/kernel/api.mjs report`. A human `ok` means only “the requested manual action finished”; the
  receipt records `meaning: execution-finished-not-pass`.

## Chat execution

1. Inspect, then start the exact prepared request:

   ```text
   node <runner> inspect --request <absolute request.yaml> --receipt <absolute new receipt.yaml>
   node <runner> start   --request <absolute request.yaml> --receipt <absolute new receipt.yaml>
   ```

2. Wait for the next event without polling. Pass the latest returned revision back as `--after`:

   ```text
   node <runner> wait --request <absolute request.yaml> --receipt <absolute receipt.yaml> --after <revision>
   ```

   A wait blocks on filesystem events and returns only for a new checkpoint or final receipt. Do not
   build a sleep/status loop around it.

3. On a `checkpoint` event, relay exactly `event.gate.instruction` plus its fixed accepted values
   `ok`, `fail`, `cancel`. Do not add steps, reveal driver output, weaken the expectation, or ask the
   user to paste a password, token, recovery code or OTP into chat. Raw secrets and OTPs are never in chat; they are entered only
   into the visible isolated browser. Ordinary API/provider activity is not a manual gate unless the
   frozen request classifies it as one of:

   `secret-entry | anti-automation-challenge | cross-device-action | subjective-observation | reserved-manual-action`.

4. After the user replies exactly `ok`, `fail` or `cancel`, deliver that value to the same run:

   ```text
   node <runner> signal --request <absolute request.yaml> --receipt <absolute receipt.yaml> \
     --value <ok|fail|cancel> --actor user
   ```

   The signal is write-once and idempotent. A changed replay is refused. `ok` resumes the same
   Playwright process so its machine assertions continue; `fail` and `cancel` finalize through the same
   sanitizer and cleanup path. Then call `wait` again with the last revision.

5. At `phase: finished`, return the exact receipt path to the current operation. Do not summarize it as
   pass. The operation consumes that immutable receipt, recomputes its bindings and decides its report
   from machine assertions, evidence, postconditions, redaction and cleanup.

If the process disappears before a receipt, report the stale process and use a new run ID for a new
attempt after the operation reconciles cleanup. Never launch a duplicate process into the old run.

## Direct/manual command

The foreground form uses the same inspect/start/wait/signal implementation and prompts only for the
three completion values:

```text
node <runner> run --request <absolute request.yaml> --receipt <absolute new receipt.yaml>
```

It is suitable for a terminal beside the visible browser. No second manual protocol exists.

## Prepared Playwright protocol

The selected script receives `STARCI_ASSISTED_UAT_REQUEST`, `STARCI_ASSISTED_UAT_RUN_DIR` and
`STARCI_ASSISTED_UAT_PROTOCOL`. It emits structured lines prefixed by the protocol value. A human gate
line carries only `{type:"checkpoint", gateId}`; the runner looks up and relays the frozen prompt from
the request. The script waits on stdin for `{type:"human-signal", gateId, value}` and resumes its
machine assertions only for `ok`. Other allowed structured event types are `step`, `check`, `artifact`
and `postcondition`. Non-protocol stdout/stderr is never relayed or admitted as evidence.

Every artifact event names a relative file under this run and must attest `redacted:true`; the runner
rehashes the final bytes after the prepared redaction commands. Cleanup actions and read-back
verification run on every exit path. Missing media, redaction failure, cleanup failure or an unresolved
resource stays explicit in the receipt and cannot be converted into success by the human signal.
