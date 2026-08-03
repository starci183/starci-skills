# hooks/ — what runs around every skill, before and after

A skill does one job. What every skill owes regardless of the job — resolve the tree before it touches
it, check what was already deferred, present a proposal rather than describe it, record the miss when the
result is wrong, prove the change before calling it done — does not belong copied into each `SKILL.md`. It
belongs here, once, and runs around the skill like a wrapper.

## Two moments, three scopes

**`pre/`** runs *before* the skill does its work — it prepares the ground. **`post/`** runs *after* — it
closes the loop the work opened.

Inside each, a hook's **scope is its folder**, so a skill knows which hooks are its own without reading a
line of prose:

- `plan/` — wraps only the **plan** skills (the ones that propose).
- `apply/` — wraps only the **apply** skills (the ones that land a change).
- a **loose `.md`** directly under `pre/` or `post/` — wraps **every** skill, front end and back end alike.

A rule that binds every skill is written once, loose; a rule that binds one phase sits in that phase's
folder. Nothing is written twice, and nothing declares a scope the folder does not already show.

## The hooks

| Hook | Runs | Scope | Does |
|---|---|---|---|
| [`pre/resolve-workspace.md`](pre/resolve-workspace.md) | before | every skill | resolves which FE/BE tree this machine points at |
| [`pre/apply/check-debt.md`](pre/apply/check-debt.md) | before | apply | reads the debt ledger so a deferred shortcut is seen, not re-broken |
| [`post/plan/present.md`](post/plan/present.md) | after | plan | presents the proposal as drawn options, not a wall of prose |
| [`post/apply/verify.md`](post/apply/verify.md) | after | apply | runs the skill's own test and the gates before the change is called done |
| [`post/record-correction.md`](post/record-correction.md) | after | every skill | writes the person's correction to `corrections/pending/` |

A skill runs the loose hooks and the hooks in the folder for its phase — a plan skill runs
`pre/resolve-workspace`, `post/plan/present` and `post/record-correction`; an apply skill runs
`pre/resolve-workspace`, `pre/apply/check-debt`, `post/apply/verify` and `post/record-correction`. Each
skill names the hooks it runs in its own `SKILL.md`.
