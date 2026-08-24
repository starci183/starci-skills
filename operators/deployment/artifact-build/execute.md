# Execute `deployment/artifact-build`

This operator builds immutable release artifacts from pinned source revisions. Input, output, loaded source, command captures, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze the build invocation

**Read:** the complete input envelope only.
**Context:** none; resolve no load before validation succeeds.
**Action:** run `validate-input.mjs`; freeze the route, provided refs, source hashes, command refs, checkout ref, and orchestration profile.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before any read or command if schema, required fact, task ownership, or route validation fails.

## Step 2 — Resolve the execution plan and deployment law

**Read:** `payload.loads.artifacts` and `payload.loads.knowledge`.
**Context:** resolve exactly `executionPlanRef`, `sourceRevisionRefs`, and `artifactBuildRefs`; retrieve only `deployment.lifecycle` from its pinned generation.
**Analysis:** verify release identity, artifact names, build commands, output paths, media types, source revisions, and knowledge hashes. Record rule IDs and match/mismatch evidence only.
**Session write:** normalized build constraints at `payload.session.scratchPrefix/constraints`.
**Stop:** stop when a ref is missing, stale, ambiguous, belongs to another release, or requests an undeclared artifact.

## Step 3 — Verify exact build source

**Read:** only `payload.loads.source.targetFiles`.
**Context:** broad repository scans, undeclared files, repository source context, and indexed source summaries are forbidden.
**Analysis:** calculate each current SHA-256 and compare it with `beforeSha256`; verify every file's declared build purpose.
**Session write:** read-only observations at `scratchPrefix/source-checks/<worker-id>`.
**Orchestration:** balanced or parallel mode may assign disjoint files to read-only workers. The coordinator validates and joins every observation. Workers never write source or artifacts.
**Stop:** stop before running a command when one hash differs, a target cannot be read, or another file appears necessary.

## Step 4 — Preflight declared build commands

**Read:** `payload.loads.commands`, joined source checks, and normalized constraints.
**Context:** declared command refs and exact checkout only; no new source or environment data may be loaded.
**Analysis:** verify command identity, working boundary, output paths, environment-name allowlist, determinism requirements, and expected artifact definitions without executing.
**Session write:** `scratchPrefix/command-preflight`.
**Stop:** stop on shell interpolation, undeclared environment input, output traversal, mutable tag-only identity, or a command outside the plan.

## Step 5 — Build and hash artifacts

**Read:** validated command preflight and exact checkout.
**Context:** coordinator only. Workers and subagents do not execute commands or write artifacts.
**Action:** run each pinned build command once in declared order; capture exit code and value-safe diagnostics; hash every declared output and verify its identity and media type.
**Session write:** command capture at `scratchPrefix/command-capture`, digest evidence at `scratchPrefix/artifacts`, and candidate receipt at `scratchPrefix/candidate`.
**Durable write:** only ignored build outputs and immutable local artifacts declared by the plan. Do not persist input, output, logs, diagnostics, observations, prompts, or receipts.
**Stop:** stop on command failure, missing or extra output, digest ambiguity, source mutation, or scope expansion.

## Step 6 — Emit and register cleanup

**Read:** candidate receipt, artifact digests, used refs and revisions, command evidence, and session inventory.
**Context:** refs and value-safe metadata only; do not copy loaded source, full logs, prompts, or worker observations.
**Analysis:** prove `ready`, `completed`, root route, emitted fact, artifact refs, and durable writes agree.
**Action:** construct `output.schema.json`, run `validate-output.mjs`, and register every scratch ref.
**Session write:** `payload.session.outputRef` and `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid, partially joined, or unhashed result.
**Orchestration:** the coordinator validates final output and purges all intermediate session objects at every parent terminal.
