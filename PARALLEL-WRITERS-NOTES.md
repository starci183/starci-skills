# W2 — Parallel writers on the canonical worktree

Scope of this change (owned files only): `kernel/engine.mjs`, `kernel/candidate-bridge.mjs`,
`kernel/candidates.mjs`, `tests/w2-parallel-writers.spec.mjs` (new), this file (new).
`kernel/kernel.mjs` is untouched — the call-site diffs below are for the coordinator to apply at merge.

## What changed

### Writer pool capacity (`engine.mjs`, `candidate-bridge.mjs`)

- `candidate-bridge.mjs` exports `DEFAULT_MAX_CONCURRENT_WRITERS` (10) and
  `maxConcurrentWriters(profile)` — returns `allocation.maxConcurrentWriters` when the runtimes profile
  declares a positive integer, else 10.
- `createEngineRuntime` computes `writerCapacity = maxConcurrentWriters(runtimeProfile)` once and declares it
  on `canonical-writer:<repo>` (`setCapacity(writer.key, …)`, was `1`) and on every per-binding writer resource
  in `reserveOperation` (`admission.setCapacity(resource.key, …)`, was `1`). `runtime-projection:` binding
  fences use the same bound.
- The runtime object now exposes `writerCapacity`.
- `runtimeWriterHint({host, repoRoot, maxWriters})` reports the declared bound (default `1`, unchanged for
  callers that pass none). `beginCandidate` passes `maxWriters: writerCapacity`, so a bridge begun through the
  engine records the real bound. The aggregate bridge's `writer.maxWriters` is
  `bound × writableRoots` (per-root resources each admit `bound` writers).

### Concurrent-writer drift classification (`candidate-bridge.mjs`)

- `freezeDetectionCandidate` / `freezeSingleDetectionCandidate` accept optional `foreignAllowlists` and
  `concurrentScopes` (both spellings merge; default `[]` = byte-identical to previous behavior). These are path
  globs belonging to OTHER live operations, in the same coordinate space as `op.allowlist`.
- An observed change that is outside this op's allowlist but inside a foreign live scope now reports
  `concurrent-writer-drift:<file>` — a retryable quarantine reason. It is never counted as this op's
  `outside-allowlist` violation and never silently dropped: the file stays in `observedFiles` and in the new
  structured `concurrentWriterDrift` field on the quarantine result. The same reclassification applies to
  baseline drift (`dirtyBaseline` paths a sibling keeps writing): they surface as `concurrent-writer-drift`,
  not `pre-existing-user-work-modified`.
- Changes outside every scope still fail closed exactly as before (`outside-allowlist:`,
  `pre-existing-user-work-modified:`, `kernel-owned-write-drift:` are unchanged). Because any drift reason
  quarantines before the copy step, foreign in-flight bytes are never copied into the worker snapshot or sealed
  into the packet.
- For aggregate (`ROOT_DETECTION_BRIDGE`) candidates, each foreign scope is routed through
  `pathInCandidateRoots` against `bridge.rootBindings` — the same routing `candidateRootBindings` applied to
  this op's own allowlist — and only the routed relative scope reaches each root's freeze. Scopes that route to
  no root are dropped (they cannot produce drift inside this candidate's roots).
- `beginDetectionCandidate` / `beginSingleDetectionCandidate` accept the same two option spellings plus
  `maxWriters`; the merged list is recorded on the bridge as `concurrentScopes` (routed per root for
  aggregates). This is begin-time evidence only — freeze never falls back to it, so a stale recorded scope can
  never reclassify a real violation.

### Promotion CAS (`candidates.mjs`)

- `prepareCandidateIntegration` already refuses promotion when the canonical head moved since seal
  (`expected-head-mismatch`) and when sealed byte inventory drifted (`canonical-drift`). In
  `detection-canonical` mode, a moved head now additionally reports `canonical-advanced-during-run` ahead of
  the exact expected/observed pair, so a sibling commit between seal and promotion is a distinguishable
  retryable quarantine — never a promotion over it. An unreadable head still reports only
  `expected-head-mismatch … observed unavailable`. `hard-isolation` mode is unchanged.

### Engine surface (`engine.mjs`)

- `beginCandidate(op, {…, foreignAllowlists, concurrentScopes})` — records the merged scopes on the bridge
  (`concurrentScopes`) and stamps the real `maxWriters` on the writer hint.
- `freezeCandidate(op, {reportedFiles, requireReported, foreignAllowlists, concurrentScopes})` — forwards the
  merged live foreign scopes to `freezeDetectionCandidate`.
- `settleStoppedOperation(op, {…, foreignAllowlists, concurrentScopes})` — forwards the merged scopes to its
  internal `freezeCandidate` call, so a stop-reconciliation freeze classifies sibling drift the same way.
- All three default to `[]` — without the coordinator changes below, behavior is identical to before.

## Required `kernel.mjs` diffs (coordinator applies at merge)

The launch fence (`busy.some(contends)`, ~line 1163) already guarantees that concurrently running ops have
disjoint allowlists. Passing the other live ops' allowlists into the freeze path is what stops a sibling's
in-flight writes inside ITS OWN allowlist from mis-quarantining this op.

Pass the allowlists of every other op that may hold a writer lease — `['running','answering']` plus blocked
ops that retained their reservation:

```js
const foreignAllowlistsOf=(op)=>state.ops
  .filter(other=>other.id!==op.id&&(other.lease||['running','answering'].includes(other.status)))
  .flatMap(other=>other.allowlist??[]);
```

(Minimal variant matching the brief where `busy` is in scope:
`busy.filter(other=>other.id!==op.id).flatMap(other=>other.allowlist??[])`. The lease-based predicate is
preferred: a quarantined sibling keeps its writer reservation and its unsealed paths in the tree.)

1. `~line 779` — `beginCandidate` at dispatch (records begin-time scopes; optional but recommended):

```diff
       const begun=ctx.engine.beginCandidate(op,{roots:rootBindings.bindings,bindingDigest:rootBindings.bindingDigest,
       dependencyDigests:op.dependencyDigests??{},environmentDigest: … ,
-      dependencyInstall:op.dependencyInstall??null,dependencyRequired:candidateChecksNeedDependencies(op.checks)});
+      dependencyInstall:op.dependencyInstall??null,dependencyRequired:candidateChecksNeedDependencies(op.checks),
+      foreignAllowlists:foreignAllowlistsOf(op)});
```

2. `~line 2384` — `freezeCandidate` in `applyOpReport` (`report.outcome==='done'` path):

```diff
-      const frozen=ctx.engine.freezeCandidate(op,{reportedFiles:report.files??[],requireReported:true});
+      const frozen=ctx.engine.freezeCandidate(op,{reportedFiles:report.files??[],requireReported:true,foreignAllowlists:foreignAllowlistsOf(op)});
```

3. `~line 2851` — `freezeCandidate` in `acceptReports`:

```diff
-      const frozen=ctx.engine.freezeCandidate(op,{reportedFiles:report.files??[],requireReported:true});
+      const frozen=ctx.engine.freezeCandidate(op,{reportedFiles:report.files??[],requireReported:true,foreignAllowlists:foreignAllowlistsOf(op)});
```

4. `~line 3223` — `settleStoppedOperation` in `reconcileStoppedNativeAttempt`:

```diff
-  const reconciled=ctx.engine.settleStoppedOperation(op,{dispatch:op.dispatch,settlement,reason});
+  const reconciled=ctx.engine.settleStoppedOperation(op,{dispatch:op.dispatch,settlement,reason,foreignAllowlists:foreignAllowlistsOf(op)});
```

5. `~line 687` — `settleStoppedOperation` in `reconcileStoppedNativeRetryLease`:

```diff
-    const reconciled=runtime.settleStoppedOperation(op,{dispatch:dispatchId,settlement,reason:'public workflow retry proved the exact native worker exited',acceptedPreparedDecision:preparedDecision});
+    const reconciled=runtime.settleStoppedOperation(op,{dispatch:dispatchId,settlement,reason:'public workflow retry proved the exact native worker exited',acceptedPreparedDecision:preparedDecision,foreignAllowlists:foreignAllowlistsOf(op)});
```

6. Optional, `~line 2057` — manager capacity surface only, not required for correctness:

```diff
-  const capacity={operationLimit:ctx.allocator?.maxParallelOps??null,nativeWriterLimit:ctx.engine?1:null,activeOperations:busy.length,globalAIJobLimit:10};
+  const capacity={operationLimit:ctx.allocator?.maxParallelOps??null,nativeWriterLimit:ctx.engine?.writerCapacity??null,activeOperations:busy.length,globalAIJobLimit:10};
```

## Required `tests/engine-adapter.spec.mjs` diff (coordinator applies at merge)

`cross-root admission acquires both writers atomically and retains both through acceptance`
(~line 183) asserts `reserveOperation(second).ok === false` for a second op whose `work` binding
shares the `owner` repo with a running op. That refusal was the capacity-1 serialization the
brief removes — under the bounded pool the second op is legitimately admitted (the launch fence,
not admission, is what keeps contending allowlists from running together). To keep the test's
real coverage — atomic multi-root acquisition with no partial reservation when a shared root is
exhausted — pin the bound to 1 for that test:

```diff
   const bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
-    runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),allocation={role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
+    runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true}),runtimeProfile:{...loadRuntimes(),allocation:{...(loadRuntimes().allocation??{}),maxConcurrentWriters:1}}}),allocation={role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
```

(`loadRuntimes` is already imported in that file.) With the bound pinned to 1 the existing
`refused.ok === false` and zero-partial-lease assertions hold unchanged.

## Known pre-existing failures (unrelated, present without this change)

- `tests/candidate-multi-root.spec.mjs` — two tests (`foreign runtime pin`, `complete sealed
  runtime identity`) fail with `ENOENT config.json`. `config.json` is gitignored
  (`/config.json` in `.gitignore`) and absent in this worktree; `sealRuntime` reads it at
  `process.cwd()`. Verified identical failures with all w2 changes stashed.

## Retryable-reason contract

- `concurrent-writer-drift:<file>` (freeze): a sibling's in-flight write inside its own live allowlist. Retry
  the freeze after the sibling settles; if it committed, the next freeze surfaces `canonical-head-drift` and the
  attempt rebuilds its baseline on the new head.
- `canonical-advanced-during-run` (integration prepare, `detection-canonical`): the canonical head moved between
  this candidate's seal and its promotion attempt. Rebuild the candidate on the new head; never promote over it.
- `outside-allowlist:` / `pre-existing-user-work-modified:` / `kernel-owned-write-drift:`: unchanged — drift
  outside every declared live scope still fails closed.

## Verification

- `npm run build` + `npm run build:check` → `"ok":true`
- `node --test tests/w2-parallel-writers.spec.mjs`
- `node --test tests/runtime-allocator.spec.mjs tests/dispatcher.spec.mjs`
