# Execute `workspace/workflow-handoff`

## Step 1 — Freeze the handoff boundary

**Read:** validate mode, route receipt, explicit mutation approval, mission id and every exact checkout/artifact binding.

**Context:** inspect only route identity, Git status headers, changed path names, commit ids and durable artifact metadata. Do not load business, source bodies, prompts, reasoning, generated coding context or Qdrant.

**Session write:** record a fingerprint of mode, mission id, checkout identities, observed heads and next capability.

**Stop:** block on an undeclared checkout, missing approval, ambiguous mission ownership, stale route or changed fingerprint.

## Step 2A — Publish a portable checkpoint

**Read:** for each closed checkout, verify root, origin, branch, upstream, head, staged paths and unstaged paths. Classify every dirty path against the mission boundary.

**Action:** accept clean already-committed work. If and only if every staged/unstaged path is mission-owned, create a dedicated `codex/checkpoint/<mission-id>` branch and one checkpoint commit containing exactly those paths. Never commit unrelated work, secrets, ignored runtime state, generated context or session scratch. Push each checkpoint branch without force. Do not push a WIP commit directly to a protected delivery branch.

**Session write:** retain exact before/after heads and push receipts.

**Stop:** block on mixed ownership, staged drift, behind/diverged history, hook failure, missing upstream or any required force push.

## Step 3A — Publish the continuation manifest

**Action:** construct canonical JSON containing only `schemaVersion`, `missionId`, `source`, `checkouts`, `resumeCapability`, `resumeStage`, `durableArtifactRefs` and `createdAt`. Create an annotated Source tag named `starci-workflow/<mission-id>/<generation>` at the exact Source head and push it without force. Read it back from the remote and compare its object id and canonical payload.

**Session write:** emit the immutable tag and proof receipts. Purge all construction scratch at terminal.

**Stop:** block if the tag already exists with different content, any checkout head is not remote-readable, or forbidden context appears in the manifest.

## Step 2B — Resume an exact checkpoint

**Read:** fetch only the declared tag, validate its canonical manifest and verify Source origin, mission id, repository origins, branches and heads against current portable routes.

**Action:** require clean non-conflicting targets. Fetch each exact head and adopt its checkpoint branch or an isolated worktree; never overwrite local changes and never merge or rebase implicitly. Run minimal route/readiness proof for the declared roles.

**Session write:** emit a resume receipt containing the verified tag, adopted heads, durable artifact refs and the next capability/stage. The global analyzer may then select exactly that capability.

**Stop:** block when the tag is untrusted, a head is unavailable, current local work conflicts, an artifact is missing/stale, or the next capability no longer exists.

**Orchestration:** the coordinator owns the closed checkout join. Git mutations are serial. Read-only identity checks may run in parallel. No worker receives another checkout's source body or conversational context.
