# Frontend owner audit record

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.frontend-owner-audit` |
| Owner | `starci-fe-process` |
| Scope | Page, nested layout, modal, and drawer audit history |

One audited application owner of kind `page`, `layout`, `modal`, or `drawer` owns one lowercase
`audit.md` in the same source directory. The record makes the latest visual status and complete score
history visible to later agents and to the human owner reviewing that surface. It is evidence metadata,
not business authority and not permission to widen the mutation boundary.

## Feature audit owner group

An owner request to audit a feature automatically compiles one complete direct owner group before
capture or mutation: every feature-owned page, every page-local or route-nested layout, and every
feature-owned or directly nested modal and drawer exercised by the flow. Audit, repair, recapture,
and scoring continue over this whole group; the task must not stop after finishing only the entry
page or one overlay.

A shared branch, global overlay primitive, application shell, header, navigation, or ancestor outside
the frozen ceiling is not pulled into the group. Record it as an exact external finding and continue
all remaining in-scope work. When it remains necessary for feature closure, send one authority request
to the Control Panel naming the shared owner/files, visible defect, smallest proposed change, affected
consumer regression matrix, and why no honest in-scope repair closes the feature. Never duplicate or
reconstruct the shared behavior locally to evade this boundary. The feature cannot claim typed PASS
or 9+ while that required shared finding is unresolved; only explicit owner authorization or an
explicit evidence-backed debt/exclusion disposition can change closure.

## Placement and identity

- Route `page.tsx` or `layout.tsx`: place `audit.md` in that route directory.
- Component-owned Page, Layout, Modal, or Drawer: place `audit.md` in the component owner directory.
- When several audited owners share one directory, keep one file with a complete owner section for
  each exact owner reference. Never duplicate the same owner into several records.
- Blocks, leaves, branches, generated source, tests, and unrelated siblings do not receive a record
  unless they independently own one of the four interaction-container roles above.

## Current snapshot

The current snapshot is replaceable metadata derived from the last history entry. It names:

- exact owner kind and source references;
- route or overlay entry context;
- `PASS`, `FAIL`, `BLOCKED`, `INSUFFICIENT_EVIDENCE`, or `STALE`;
- score `0/10` through `10/10`, or `N/A` when evidence is incomplete;
- one concise `reason why` grounded in visible evidence;
- five 0-2 audit axes when a numeric score exists;
- covered states, viewports, overlay open/close and focus-return lifecycle where applicable;
- source, evidence, and finding-batch SHA256 fingerprints;
- unresolved findings, evidence gaps, or authority gaps.

`9/10` or `10/10` is valid only with a fresh typed `PASS` over the complete latest-source packet.
Any visible finding caps the score at 8. A skeleton mistaken for steady state, runtime error, missing
viewport, or untested modal/drawer lifecycle is `INSUFFICIENT_EVIDENCE` and uses score `N/A`.

## Immutable history and owner feedback

Append one round after every complete visual review. Never edit, reorder, collapse, or delete prior
rounds. Each entry records date, round, typed verdict, score/delta, reason why, axis evidence,
coverage, fingerprints, and finding dispositions. A source mutation keeps prior rounds but changes
the current snapshot to `STALE` until fresh evidence exists.

Owner feedback is a separate append-only ledger with timestamp, feedback text, affected owner/state,
and disposition `PENDING`, `ADOPTED`, or `REJECTED` plus an evidence-backed reason. It is high-value
counterevidence; it cannot directly rewrite a typed verdict.

Use `.claude/templates/frontend-owner-audit.md` as the canonical shape and validate every changed
record with `.claude/scripts/validate-frontend-owner-audit.mjs <audit.md> [...]`.
