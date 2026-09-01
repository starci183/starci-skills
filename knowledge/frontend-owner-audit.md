# Frontend owner audit record

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.frontend-owner-audit` |
| Contract revision | `7.6.0` |
| Owner | `starci-fe-process` |
| Scope | Page, nested layout, modal, and drawer audit evidence |
| Dependencies | `fe.audit-loop-v75b, fe.ui-render-review` |

One audited application owner of kind `page`, `layout`, `modal`, or `drawer` owns one lowercase
`audit.md` in the same source directory. The record is append-only evidence metadata. It never creates
business authority, widens mutation scope, routes work, starts a repair loop, or substitutes for the
canonical frontend machine.

## Compiled owner group

Compile one complete direct owner group before apply: every feature-owned page, explicitly mutable
page-local or route-nested layout, and feature-owned or directly nested modal/drawer exercised by the
flow. The separately frozen layout owner ceiling remains authoritative.

A shared branch, application shell, global overlay primitive, header, navigation owner, or immutable
ancestor stays outside the group. Record an exact external finding with owner/files, visible defect,
consumer impact, and required continuation. If it prevents closure, the canonical machine emits a
typed cross-domain exit. Never clone or reconstruct shared behavior locally to evade ownership.

## Placement and identity

- Route `page.tsx` or `layout.tsx`: place `audit.md` in that route directory.
- Component-owned Page, Layout, Modal, or Drawer: place `audit.md` in the component owner directory.
- When several audited owners share one directory, keep one file with one complete section per exact
  owner reference.
- Blocks, leaves, branches, generated source, tests, and unrelated siblings receive no audit record
  unless they independently own one of the four declared interaction-container roles.

## Current snapshot

The replaceable snapshot derives only from the latest immutable blind-review entry and names:

- exact owner kind, source references, route/overlay entry, and owner-group fingerprint;
- `PASS`, `FAIL`, `BLOCKED`, `INSUFFICIENT_EVIDENCE`, or `STALE`;
- one evidence-grounded reason;
- covered states, viewports, host context, scroll/zoom/drag, and overlay focus-return lifecycle;
- source, runtime, evidence-packet, and finding-batch fingerprints;
- every frontend-local, shared-owner, cross-domain, authority, and evidence finding;
- final quality and UAT receipt references only when both ran after latest-source blind PASS.

A source, runtime, host-geometry, or handoff-state change makes the snapshot `STALE` until fresh
capture/preflight and blind review. Skeleton shown as settled content, missing populated hero,
untested applicable lifecycle, or missing viewport is `INSUFFICIENT_EVIDENCE`, not PASS.

Visual ambiguity never becomes an owner-audit verdict. Before apply, use one realistic dominant
preview when a direction materially dominates; otherwise render three or four material alternatives
and bind the selection through a typed user-choice `WAIT`. The audit snapshot records only the
resulting implementation verdict from the five-value set above.

Numeric score is optional legacy/user-requested metadata and never routes. When present it must obey
`fe.ui-render-review`: any visible contradiction caps it at 8, 9+ requires typed PASS, and incomplete
evidence uses `N/A`.

## Immutable history and owner feedback

Append one entry for each complete blind review, including the optional single post-repair review.
Never edit, reorder, collapse, or delete earlier entries. Each entry records time, reviewer execution,
typed verdict, optional score, concrete lens observations, coverage, fingerprints, finding owners,
and typed disposition.

Owner feedback is a separate append-only ledger with time, feedback, affected owner/state, and
`PENDING`, `ADOPTED`, or `REJECTED` plus evidence-backed reason. It is high-value counterevidence, not
a direct verdict mutation. Promote a reusable law only through the smallest owning knowledge/Grammar
authority and preserve a negative boundary against copying the originating screen.

Use `.claude/templates/frontend-owner-audit.md` as the storage shape and validate changed product
records with `.claude/scripts/validate-frontend-owner-audit.mjs <audit.md> [...]`.
