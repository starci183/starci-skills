# Evidence — a mission that wrote before opening a session, then asked which to do, 2026-09-04

The occurrence behind the widened Setup step 4 of `SKILL.md`/`SKILL.vi.md` and the widened
`CHECKOUT_DIRTY` case of `workspace.bind` lives here.

## What happened

Observed twice tonight, on live sessions. An agent did real source work on a product repository
without opening a session at all: it edited files in the routed checkout while that checkout sat on
its mutation branch. Having already written, it stopped and asked the person whether it should set a
session up or branch and commit.

Both halves are wrong, and they are two different kinds of wrong:

- Writing source outside a session contradicts the tree's first law (`SKILL.md` Setup step 4, "Nothing
  is designed, written or committed outside a session"). This is question 1 of `UPDATE.md`: the thing
  was already forbidden, so the surprise is not that a rule was missing but that nothing caught it
  before source moved.
- Asking whether to open a session, or which of "open a session" versus "branch and commit by hand" to
  do, is a question the tree has already answered. Turning an already-answered question into one put to
  a person is a distinct failure from the write itself, and the existing text did not say plainly that
  the answer is fixed and that surfacing it as a choice is itself a violation.

## What was true at the time

- `SKILL.md` Setup step 4 already said the session folder and a validated `request.json` are the first
  act, and that `SESSION_MISSING` is reported rather than papered over with a session written after the
  fact. It did not say, in one place, the full ordered list of first acts (session folder, then the
  branch the route's git policy names for session work, then the request), and it did not say that
  opening a session is never a question put to a person or that the repair for already-written work is
  fixed (open the session now, move the work onto its branch, run the operators that owe the receipt) —
  the same recovery `SESSION_MISSING`'s own `resume` clause in `operators/errors.json` already states,
  which the Setup step now cites instead of restating.
- `workspace.bind` is the one operator positioned to see this after the fact — it reads the checkout's
  actual branch and working tree against the route's declared git policy. Its step 4 already stopped on
  `CHECKOUT_DIRTY` for anything dirty outside the declared write roots, and on `BRANCH_POLICY_VIOLATION`
  for a forbidden branch, but a caller could declare write roots that happened to cover exactly the
  paths already hand-edited, and `mutationReadiness` would then read `ready` on the mutation branch
  itself with the violation sitting inside it, unrecorded. This is question 3: `CHECKOUT_DIRTY`'s case
  was narrower than the truth — it needs to also cover dirt found on the mutation branch itself,
  because the mutation branch carries no legitimate work in progress of its own; the write-root
  exemption is meant for a `session/<sessionId>` branch's expected in-progress state, never for the
  mutation branch.

## What changed

- `SKILL.md` and `SKILL.vi.md` Setup step 4 now states the first acts in order, states plainly that
  opening a session is never a question and never done after the first write, and states the fixed
  repair path for a mission that already wrote outside a session, citing `SESSION_MISSING`'s own
  `resume` clause rather than repeating it.
- `operators/workspace-bind/operator.md` (+ `.vi.md`) widens the `mutationReadiness` paragraph and the
  `declaredWriteRoots` Requirements row: the declared-write-root exemption from `CHECKOUT_DIRTY` applies
  only on a `session/<sessionId>` branch; any dirt at all on the mutation branch, inside a declared
  write root or outside it, is `CHECKOUT_DIRTY`.
- `operators/workspace-bind/errors.json` widens `CHECKOUT_DIRTY`'s `meaning` and `resume` to state the
  mutation-branch case and its repair (open the session, move the change onto its branch — not declare
  a write root over it).
- What is not enforceable: a validator reading a published receipt cannot see an agent that never
  entered the tree at all — there is no branch, no `request.json`, no response to validate against.
  The only place this class of violation can be caught mechanically is the next time the same checkout
  is bound: `workspace.bind` step 4 reads the live checkout's actual branch and working tree, which is
  the first moment the tree has any visibility into the situation, and it now refuses rather than
  passing over what it finds. Nothing shipped here can catch the violation at the moment it happens,
  only at the next bind that follows it.
