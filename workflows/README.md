# Workflows

A workflow is a pre-composed chain of operators: an ordered list of **steps**, each step a list of
**branches** that run in parallel (at most three), with optional **loops** back to an earlier step and
**presets** for a branch's Requirements. The files here are examples, not the only chains allowed.

How the entry uses them:

1. Read the `when` of every example. If the request matches one, run that chain; its presets fill
   `request.json` and the person is asked only for fields with no default.
2. If none matches, compose a chain from the operators' `## Next` tables and `routing.json`, under the
   same rules `scripts/validate-workflows.mjs` enforces on these files:
   - every branch names a real operator and presets only fields that operator declares;
   - every Requirements field with no Default is either preset or listed under the branch's `asks`, so a
     chain says up front which fields the entry must take from the mission scope or ask a person for
     before that branch starts;
   - every required Input of a branch is produced by an earlier step;
   - branches of one step share no write alias (two operators may not write the same checkout or
     root at once; `frontend.surface.audit` fans out by matrix entry because it writes nothing);
   - a loop goes back to an earlier step and carries `maxRounds`;
   - the chain ends at `git.publish`, `release.deploy`, or `user`.
3. A composed chain that would be useful again becomes a new file here, with its `when`.

Every source-writing branch commits on `session/<sessionId>`; `git.publish` merges it. A blocked branch
re-enters as a new step; a loop counts toward the operator's own `maxRounds`.

| Workflow | When | Steps | Parallel | Ends |
| --- | --- | --- | --- | --- |
| `frontend-new-surface` | a surface that does not exist yet (`new`) | bind ×2 → business → direction → resolve → apply → audit → quality → publish | audit by matrix | `git.publish` |
| `frontend-reconstruct` | rebuild an existing surface, business facts kept | bind → direction → resolve → apply → audit → quality → publish | audit by matrix | `git.publish` |
| `frontend-refine` | repair inside an approved structure | bind → direction → resolve → apply → audit → quality → publish | audit by matrix | `git.publish` |
| `backend-feature` | a backend contract for one feature | bind → business (model) → architecture → backend apply → quality → business (reconcile) → publish | — | `git.publish` |
| `full-feature` | backend and a new frontend surface together | bind ×2 → business → architecture → [backend apply ∥ direction] → [quality ∥ resolve] → apply → audit → quality → business (reconcile) → publish | two steps of two, audit by matrix | `git.publish` |
| `frontend-with-uat` | a frontend change a person asked to walk through | bind ×2 → … audit → quality → uat → publish | audit by matrix | `git.publish` |
| `release` | a published head must reach production | bind → quality → release | — | `release.deploy` |
| `content-unit` | one curriculum unit end to end | content.generate (review exchange inside) | — | `user` |

File shape (`schemaVersion` 9): `id` equals the file name; `when` has `en` and `vi`; `chain` is an
array of steps, each an array of `{ operator, requirements?, fanout?: "matrix", maxParallel?: 1..3 }`;
`loops` is an array of `{ from, to, when, maxRounds }`; `ends` is `user` or an operator of the last step.
