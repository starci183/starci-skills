# context lock

## Definition

A context lock is the resolved identity and authority boundary of one skill run. It answers one
question before any skill work begins: **which trust, skill, repositories, git states, artifacts,
runtime and writable paths does this run actually belong to?** Detection is read-only. A plausible
guess is not a lock; every value must have evidence from the workspace, the user's request or git.

The lock is printed in the conversation before the selected skill executes and is persisted with
that phase's artifacts. Plan, Preview and Apply inherit it in order. Fidelity Fix creates its own
lock from binding repair evidence. A later phase verifies the record instead of reconstructing a
more convenient project context.

## Rules

1. **CONTEXT-LOCK-1 — Detect before acting.** Before reading task-specific skill references,
   starting a lab, creating artifacts, delegating work or editing source, resolve the workspace
   roots, current directory, explicitly named repositories and references, trust root, exact skill
   path, artifact root, runtime, and each target repository's git root, branch, worktree, HEAD and
   remote identity. Read-only discovery may use workspace metadata, the request, `git rev-parse`,
   `git branch --show-current`, `git status` and repository files because a lock grounded only in
   folder names can silently target the wrong checkout.

2. **CONTEXT-LOCK-2 — Show the lock.** Print this table before the skill performs its first task
   action. Use absolute paths. Repeat rows for multiple targets or references rather than joining
   identities into prose.

   | Field | Locked value | Evidence |
   |---|---|---|
   | Phase | `plan`, `preview`, `apply` or `fidelity` | Invoked skill |
   | Trust root | Absolute `.claude` owner | Router or explicit instruction |
   | Skill | Name and absolute `SKILL.md` path | Skill discovery |
   | Primary target | Repository, role and absolute git root | Request + workspace + git |
   | Additional target | Repository, role and absolute git root, when approved | Request + source need + git |
   | Reference | Read-only repository/path and purpose | Named baseline or evidence |
   | Git identity | Branch, worktree, HEAD and remote per target | Git |
   | Artifact root | Absolute task artifact directory | Request or phase convention |
   | Write boundary | Exact writable directories/files per target | Phase policy or approval |
   | Read-only boundary | Repositories/paths that may be inspected but not edited | Evidence role |
   | Runtime | Lab/app/service port, process owner and start policy | Existing process or phase rule |
   | Context record | Absolute phase record path and inherited record | Artifact convention |

3. **CONTEXT-LOCK-3 — Stop on ambiguity.** Stop after read-only detection and ask the user to
   resolve any ambiguous value. Ambiguity includes multiple plausible target repositories, a
   target that could instead be a reference, an unknown or detached branch, an unverified
   worktree, conflicting remotes, an artifact root outside its allowed boundary, an occupied
   runtime with unknown ownership, overlapping target roles, or a write boundary described only
   as “the source”. Do not start the skill, create its artifacts, launch an agent or choose the
   most recently used repository while ambiguity remains.

4. **CONTEXT-LOCK-4 — Persist one immutable phase record.** After an unambiguous lock is shown,
   write `context-lock.<phase>.md` and `context-lock.<phase>.json` inside the artifact root. Both
   files describe the same values and include `version`, `task`, `phase`, `status`, `trustRoot`,
   `skill`, `targets`, `references`, `artifactRoot`, `writeBoundary`, `readOnlyBoundary`, `runtime`,
   `evidence`, `inheritedFrom` and `detectedAt`. Each target records `role`, `repo`, `gitRoot`,
   `branch`, `worktree`, `head` and `remote`. Never place secrets, tokens, credentials or copied
   production data in a context record.

5. **CONTEXT-LOCK-5 — Plan is artifact-only.** Plan's write boundary is exactly its artifact root.
   Production repositories, named legacy repositories and the trust tree are read-only during a
   Plan run because alternatives must be reviewable without becoming accidental implementation.
   Plan may host its direction lab from the artifact root, beginning at port `8080`, only after the
   lock is shown.

6. **CONTEXT-LOCK-6 — Preview is artifact-only.** Preview inherits the Plan record and writes only
   inside its artifact root. It may optimize cases, state matrices and review HTML, but production
   and trust remain read-only because visual approval must precede implementation. Its context
   record points to `context-lock.plan.json` and preserves every repository role and identity.

7. **CONTEXT-LOCK-7 — Apply requires a second explicit confirmation.** Apply inherits the approved
   Preview record, redetects current git and runtime state, prints the table, and then stops for the
   user's explicit confirmation of every target repository, branch, worktree and exact write
   boundary. No production edit, generated-code write, dependency change, migration, seed, commit,
   agent dispatch or service mutation occurs before that confirmation. Record the user's words as
   confirmation evidence and change the Apply lock status from `awaiting-confirmation` to
   `confirmed` before implementation.

8. **CONTEXT-LOCK-8 — Drift stops the phase.** Compare inherited and detected trust root, skill
   lineage, target/reference roles, absolute roots, branch, worktree, HEAD, remote, artifact root,
   write/read-only boundaries and runtime ownership. Any difference is drift. Print a drift table,
   stop and ask the user whether to relock or return to the preceding phase. Never switch repo,
   branch, worktree, reference, port or boundary automatically, even when the new value appears
   equivalent.

9. **CONTEXT-LOCK-9 — Delegation inherits, never redetects authority.** Every worker receives the
   confirmed phase record, its subset of writable files and the full read-only/forbidden boundary.
   Workers may report a mismatch but may not relock, broaden scope or select another checkout.
   The coordinator alone compares drift and obtains user confirmation because parallel discovery
   must not create parallel authorities.

10. **CONTEXT-LOCK-10 — Fidelity also requires explicit confirmation.** Fidelity Fix detects and
    prints a fresh lock from its binding expected-result evidence, persists
    `context-lock.fidelity.md/json`, and stops for explicit confirmation of target repository,
    branch, worktree and exact write boundary before edits or worker dispatch. A small fix changes
    the amount of code, not the authority required to change it.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Infer the target from the skill's repository | Trust location identifies authority, not the source being designed | Resolve target and reference roles from request, workspace and git |
| Run a skill before showing Context Lock | The user cannot catch a wrong repository after artifacts or edits already exist | Print the complete table first |
| Let Plan or Preview write production source | Exploration and approval become implementation without a gate | Restrict both phases to their artifact root |
| Treat an unambiguous Apply lock as implicit consent | Production writes require confirmation even when detection is correct | Stop and obtain explicit target, branch, worktree and boundary approval |
| Carry context only in chat prose | Later phases can silently reconstruct different paths after compaction | Persist Markdown and JSON phase records |
| Ignore a changed HEAD, branch, worktree, remote or port owner | The inherited evidence may no longer describe the code or process being changed | Report drift and ask whether to relock |
| Allow a worker to choose its own repo or writable files | Parallel convenience can split one task across unrelated checkouts | Give every worker the confirmed record and an exact packet |

## Examples

### Right — Plan detects one clear target and remains artifact-only

```text
| Field | Locked value | Evidence |
| Phase | plan | starci-fe-design-plan |
| Trust root | D:\Repositories\starci-academy-backend\.claude | CLAUDE.md |
| Primary target | D:\Repositories\starci-academy-fe | request + git |
| Reference | D:\Repositories\starci-academy (read-only legacy) | named parity source |
| Write boundary | D:\Repositories\starci-academy-fe\design-plans\dashboard | Plan policy |
```

The task proceeds because every role is distinct and only the artifact directory is writable.

### Wrong — Plan edits the frontend because the target was obvious

```text
Target appears to be starci-academy-fe, so update src/app/dashboard and produce the plan afterward.
```

The difference is that detection does not authorize production writes.

### Right — Apply pauses even when nothing drifted

```text
No drift detected.
Awaiting explicit confirmation:
- target: D:\Repositories\starci-academy-fe
- branch/worktree: main / D:\Repositories\starci-academy-fe
- write boundary: src/app/dashboard, src/components/blocks/dashboard
```

The task edits only after the user confirms those values.

### Wrong — Preview follows the currently open repository

```text
The Plan targeted starci-academy-fe, but the current workspace is nivo-fe, so render the Preview there.
```

The difference is that a later phase inherits identity; workspace drift is a stop condition, not a
new target-selection signal.
