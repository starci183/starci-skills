# Workflows

A workflow is a pre-composed chain of operators: an ordered list of **steps**, each step a list of
**branches** that run in parallel (at most three), with optional **loops** back to an earlier step and
**presets** for a branch's Requirements. The files here are references, not the only chains there are:
they are the shapes that came up often enough to be worth writing down, and a mission whose business
is harder than any of them composes its own chain under the same rules rather than forcing itself
into the nearest example.

How the entry uses them:

1. Read the `when` of every example. If the request matches one fully, run that chain; its presets
   fill `request.json`; obtain missing fields under [the interaction policy](../resources/interaction.md).
2. If the match is partial, or the business is harder than any `when` describes, compose a chain
   rather than bending a near-miss example into shape: brainstorm it from the operators' `## Next`
   tables and `routing.json`, under the same rules `scripts/validate-workflows.mjs` enforces on these
   files:
   - every branch names a real operator and presets only fields that operator declares;
   - every Requirements field with no Default is either preset or listed under the branch's `asks`, so a
     chain says up front which fields the entry must obtain before that branch starts; `asks` is an
     input inventory, not permission to send a question;
   - every required Input of a branch is produced by an earlier step;
   - branches of one step share no write alias (two operators may not write the same checkout or
     root at once; `frontend.surface.audit` fans out by matrix entry because it writes nothing);
   - a loop goes back to an earlier step and carries `maxRounds`;
   - a chain that writes frontend source under `mode: apply` runs `frontend.surface.audit` and
     `uat.verify` between that write and its `git.publish` — the long-flow law below;
   - the chain ends at `git.publish`, `release.deploy`, or `user`.
3. A composed chain that would be useful again becomes a new file here, with its `when`.

## Every example is a long flow

A chain that writes a surface is not finished when the source compiles. Between the write and the
publish stand two proofs that nothing else in the tree can supply: `frontend.surface.audit`, which
renders the surface and keeps the screenshots, and `uat.verify`, which walks a real person's journey
through it. `quality.verify` sits between them and answers a different question — the build, the
lint, the types, the coverage — and green gates have never yet noticed that a page reads wrong. So
every example that applies frontend source ends the same way:

```text
frontend.source.apply → workspace.bind (role fe, runtimeNeed consume) → frontend.surface.audit → quality.verify → uat.verify → git.publish
```

The second `workspace.bind` is there because the head moved: the surface that must be served, audited
and walked is the one the write just produced, not the one that was bound before it. `uat.verify`
needs `feature`, `flow` and `approval` before it starts — the flow to walk and the authority for its
own writes, taken from the environment's declaration and asked of a person only where that
declaration marks the touched class `person` — so every chain that carries it declares them under
`asks`, and the run refuses rather than inventing an authority.

`staging-uat` is the one example that proves a delivery somewhere other than where it was written.
It writes nothing — `frontend.source.apply` runs under `mode: dry`, so the long-flow law does not
reach it — and it carries `env` on the audit and the run, which is what selects the stack's runtime
registry entry, its accounts file and its approved reference. It ends at `user`, because two receipts
in a person's hands are the outcome; reaching an environment is `release`'s job and stays there.

`backend-feature` is the one delivery chain with neither proof, and its `when` says why: it writes no
surface, `uat.verify` requires a `frontend-surface-audit` input and a bound fe route, and neither
exists there. A backend feature whose promise reaches a person through a screen belongs in
`full-feature`, which walks the journey before it publishes. `release` and `content-unit` write no
frontend source and publish no boundary, so the law does not reach them.

Every source-writing branch commits on `session/<sessionId>`; `git.publish` merges it, and refuses a
session branch whose session carries no source-application receipt and no audit screenshots
(`SESSION_MISSING`). A blocked branch re-enters as a new step; a loop counts toward the operator's own
`maxRounds`.

| Workflow | When | Steps | Parallel | Ends |
| --- | --- | --- | --- | --- |
| `library-maintenance` | existing owner package behavior and next patch, without product presentation changes | bind → library apply → quality | — | `user` |
| `dependency-maintenance` | verified package consumption through exact dependency metadata | bind → dependency update → quality | — | `user` |
| `frontend-new-surface` | a surface that does not exist yet (`new`) | bind ×2 → business → direction → resolve → apply → bind (consume) → audit → quality → uat → publish | audit by matrix | `git.publish` |
| `frontend-reconstruct` | rebuild an existing surface, business facts kept | bind ×2 → direction → resolve → apply → bind (consume) → audit → quality → uat → publish | audit by matrix | `git.publish` |
| `frontend-refine` | repair inside an approved structure | bind ×2 → direction → resolve → apply → bind (consume) → audit → quality → uat → publish | audit by matrix | `git.publish` |
| `backend-feature` | a backend contract for one feature, no surface | bind → business (model) → architecture → backend apply → quality → business (reconcile) → publish | — | `git.publish` |
| `full-feature` | backend and a new frontend surface together | bind ×2 → business → architecture → [backend apply ∥ direction] → [quality ∥ resolve] → apply → bind (consume) → audit → quality → uat → business (reconcile) → publish | two steps of two, audit by matrix | `git.publish` |
| `frontend-with-uat` | a frontend change a person asked to walk through by name | bind ×2 → direction → resolve → apply → bind (consume) → audit → quality → uat → publish | audit by matrix | `git.publish` |
| `staging-uat` | a published delivery must be walked on another stack before release | bind ×2 (consume) → direction → resolve → apply (dry) → audit (env staging) → quality → uat (env staging) | audit by matrix | `user` |
| `release` | a published head must reach production | bind → quality → release | — | `release.deploy` |
| `content-unit` | one curriculum unit end to end | content.generate (review exchange inside) | — | `user` |

File shape (`schemaVersion` 9): `id` equals the file name; `when` has `en` and `vi`; `chain` is an
array of steps, each an array of
`{ operator, requirements?, asks?: [field], fanout?: "matrix", maxParallel?: 1..3 }`;
`loops` is an array of `{ from, to, when, maxRounds }`; `ends` is `user` or an operator of the last step.
