---
name: starci-fe-fidelity-start
description: Start or continue one bounded StarCi frontend fidelity session. Freeze binding evidence and comparison identity, then immediately make and prove settled small patches as feedback arrives. Use for "make this match", a wrong seam, icon, divider, state or small runtime bug. Split explicit creative or new-concept requests into starci-fe-design-plan previews without delaying independent fixes. The session remains open until starci-fe-fidelity-finality closes it.
---

# StarCi FE Fidelity Start

Read [`../../skill-shape.md`](../../skill-shape.md) first.

This lane restores an expected result. It does not redesign hierarchy, CTA, behavior, ownership or
reusable vocabulary. Route an explicit request for “sáng tạo”, a new concept or several layout
directions to `$starci-fe-design-plan`, which must render three to four implementation-feasible HTML
cases. Do not choose one production direction inside Fidelity, close the fidelity session, or delay
independent settled repairs while the creative choice is pending.

## CONTEXT

Present the context table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`; never infer a target from
`Source` or `App`. Resolve the frontend repository, branch, workflow path and exact production write
boundary before the first production write.

Create one stable `Session id` and append `## start` to
`<Source>/.workflows/fidel/<app>/<id>.md` immediately. Record `Session status: open`, the user's
request, binding evidence and `Touching` before deeper investigation so a later feedback turn can
continue without reconstructing context.

## PROCESS

Require one binding source for the expected result: an explicit instruction, named legacy source or
render, approved task evidence, contract `why`, or test. Freeze route, viewport, locale, theme, auth
persona, fixture or seed, owner state and reference commit before comparing.

Before any local live proof, resolve the Project's canonical app origin from runtime configuration,
HANDOFF evidence or the running allow-list, then use that exact scheme, hostname and port. Never
treat `localhost` and `127.0.0.1` as interchangeable for CORS, authentication, cookies or browser
storage. A static proposal URL is not evidence for the live app origin.

Measure the defect as a difference, inventory existing owners before inventing a new one, and name
the smallest file boundary. Record the baseline commit or worktree identity before the first write.

**REFERENCE OWNER CLOSURE.** Before drawing or copying a referenced shape, trace the rendered
reference to its concrete component and contract. Compare its named slots and design purpose with
existing leaf, composite and contract owners, including owners whose current name is
domain-specific. Record each plausible owner as `reuse`, `alter-generic` or `keep-apart`. A
different interaction host does not by itself justify duplicating the visual content. When purpose
matches, prefer reusing or altering/renaming the existing owner and its contract; if that requires a
boundary not already authorized, route that exact consolidation boundary before writing the
duplicate.

Record the closure in this table:

| Reference | Concrete owner / contract | Same-purpose candidates | Verdict | Interaction-host difference |
|---|---|---|---|---|

Then make the smallest in-boundary correction and prove it in the frozen state. A fidelity session
does not pause merely to hand work from planning to review to application; those responsibilities
are performed inside this skill as soon as their evidence exists.

### Continuous feedback

While the session is open, every user correction is appended as `## feedback` with the same
`Session id`, `Session status: open`, CONTEXT and six canonical output tables.

Split a mixed feedback message into independent items before classifying it. Never classify the
whole message as creative merely because one item asks for a new concept. A creative item never
delays an independent authorized small patch.

Classify each feedback item before acting:

| Class | Action |
|---|---|
| `within-boundary` | Correct it immediately, rerun the focused proof and append the result. |
| `creative-direction` | Leave production unchanged for this item, invoke `$starci-fe-design-plan` for three to four HTML cases, keep this session open and continue every independent correction. |
| `new-finding` | Record and route it; if it needs a new file, capability or authority, ask only for that added boundary while preserving the session. |
| `blocked` | Record the exact failed proof and continue every safe independent correction. |

Feedback may repeat without a new workflow file or a restarted plan. Never defer an authorized,
in-boundary correction merely because a named phase used to come later. When the expected result,
owner and write boundary are settled, edit production immediately, run the focused proof and append
`## feedback`; do not wait for Design Plan, Review or Apply.

Passing proof is not user acceptance. Keep acceptance in `OWED` until the user says the correction
is satisfactory. Then append that acceptance to the same open session; do not infer Finality or a
git stage/commit from acceptance.

For visual work, capture before and after in the same frozen state. Use
[`../starci-fe-design-review/references/state-coverage.md`](../starci-fe-design-review/references/state-coverage.md)
when the primary capture path fails. Run focused typecheck, lint, tests and build in proportion to
the touched boundary; suppress nothing.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`,
`### REJECTED` and `### OWED`, in that order.

`OUTPUTS` names the active correction and current proof. `CHANGES` lists the workflow plus every
production/evidence path written so far. End with the session still open and invite
`$starci-fe-fidelity-end` only when the user wants a closing proof and related-bug scan.
