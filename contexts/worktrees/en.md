# Worktrees and sessions

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `contexts/worktrees/schema.json` | file | validate durable Git worktrees and disposable session roots |

## Record

This module separates durable branch-backed authority from disposable invocation state. Business truth and accepted quality debt survive on remote branches. Design candidates, previews, browser profiles, generated indexes and run manifests expire with their session.

## Law

`.worktrees` contains only local mounts of durable Git branches. The mount can be recreated, but the branch content is reusable authority. `.sessions/<project>/<session-id>` contains ignored invocation artifacts that another session never consumes as authority. Generated machine state that is not session-scoped belongs under `.workspaces/local`, not in `.worktrees`.

## Situation codes

| Code | Situation | Where it goes |
|---|---|---|
| `WORKTREE-1` | Evidence-backed product truth must survive | `.worktrees/<project>/businesses` on `codex/businesses/<project>` |
| `WORKTREE-2` | Draft, preview, browser profile or review pack serves one invocation | `.sessions/<project>/<session-id>`, ignored |
| `WORKTREE-3` | State lacks a project/session segment or enters `.claude` | rejected |
| `WORKTREE-4` | A durable linked worktree is foreign, dirty, unlocked when required or on the wrong branch | rejected |
| `WORKTREE-5` | Parallel writers overlap one target | isolate or run sequentially |
| `WORKTREE-6` | A linked worktree mount is stale or prunable | prune deliberately through Git |
| `WORKTREE-7` | A frontend design is reviewed before implementation | keep its pack in the current session and execute it before that invocation ends |
| `WORKTREE-8` | Product truth serves FE, BE and design | stable feature heads in `businesses` |
| `WORKTREE-9` | Accepted quality debt must survive and be repaid | `.worktrees/<project>/debts` on `quality-debts/<project>` |

## Reading a run

1. Classify every output as durable authority, generated machine state or disposable session state.
2. Require `.worktrees/<project>/{businesses,debts}` for durable linked worktrees.
3. Require `.sessions/<project>/<session-id>` for invocation artifacts.
4. Verify Git ownership, branch, cleanliness and lock only for durable linked worktrees.
5. Keep design material under `.sessions/<project>/<session-id>/design`.
6. Never resume product or design authority from another session's files.
7. Prune stale linked mounts through Git; never delete a linked worktree directory by hand.

## `WORKTREE-1` — durable business truth

Business decisions are not reproducible from code alone, so their remote branch remains durable and reviewable. The local linked mount is reconstructible.

## `WORKTREE-2` — disposable session state

Candidates, screenshots, browser profiles, render output and selected-design metadata can be rebuilt from durable authority and source. They remain ignored session artifacts even when expensive to produce.

## `WORKTREE-3` — invalid state path

Session state without project and session identity can mix runs. State under `.claude` contaminates the trust tree. Both are refused.

## `WORKTREE-4` — foreign or invalid durable worktree

Business and debt branches must be owned by this Source and mounted on their declared branches. Required locks and clean state must hold before authority writes.

## `WORKTREE-5` — parallel writes

Parallel readers and disjoint writers need no extra isolation. Overlapping writers run sequentially or in separate target worktrees.

## `WORKTREE-6` — stale linked worktree

Prune through Git after proving the exact target. Local mount disposal never deletes the durable remote branch.

## `WORKTREE-7` — same-session design and execution

A design candidate has no durable head. Approval authorizes the selected candidate and exact source boundary once; the same invocation implements and proves it.

## `WORKTREE-8` — product truth

Business feature heads remain durable because all roles must share the same actors, flows, rules, states and outcomes.

## `WORKTREE-9` — accepted debt

Debt records remain durable because delivery and repayment share the approved baseline, expiry and exit criteria. The local mount is reconstructible; the remote branch is the record.

## Inputs

| Input | Evidence required |
|---|---|
| project | explicitly declared project |
| source | Source owning trust and local state |
| businesses | correctly owned linked worktree |
| debts | correctly owned linked worktree |
| session | one invocation identity and ignored root |
| target source | approved source boundary when implementation occurs |

## Rules

1. Business truth and accepted debt are durable branch-backed authority.
2. Session artifacts are disposable and never cross-session authority.
3. `.worktrees` contains no cache or session directory.
4. `.sessions` contains no durable authority.
5. `.claude` never stores runtime state.
6. Isolation follows actual write collisions.
7. Frontend source plus executable proof is the durable accepted design outcome.

## Exceptions

- A completed session may remain for local debugging, but it stays ignored and has no authority.
- Conversation provenance may use its declared durable branch while decrypted/search derivatives remain session or generated local state.

## Output

```text
output: <business authority | debt authority | session artifact | source implementation>
durability: <durable branch | generated local | session | product source>
path: <business worktree | debt worktree | session root | routed frontend>
reason: <fact deciding placement>
```
