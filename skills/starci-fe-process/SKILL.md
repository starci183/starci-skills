---
name: starci-fe-process
description: Deliver, audit, repair, redesign, debug, or reconcile one frontend outcome end to end from approved business authority through blind visual review and quality/UAT closure.
---

# StarCi frontend process

Own one UI-only frontend mission. Preserve approved business and backend behavior; never create routes,
API operations, persistence, authentication behavior, fixtures, or remote mutations to make pixels
look complete. A typed gap exits to its exact domain owner. The same mission resumes at the exact
owned state carried by the correlated receipt.

The v7.6 path is deliberately linear:

`compile -> [direction-generate for reconstruct/new without an approved direction] -> source-apply -> capture-preflight -> render-capture -> blind visual-fidelity -> quality -> UAT`

`refine` skips direction generation with `directionEvidence.classification=not-applicable`. A
`reconstruct` or `new` mission also skips generation when compilation binds an exact approved
direction with `directionEvidence.classification=approved` plus its `direction://` identity,
content fingerprint, and exact `direction-approval://` authority; both cases route with
`directionMode=none`. One confirmed frontend visual finding may return exactly once
from visual fidelity to source apply, then repeats preflight, capture, and blind review. A second
finding closes as `blocked`; it never reopens analysis or grows another public stage. Product
potential, audit routing, authority classification, and finding classification are internal helpers
inside this path, not sequential public gates. Two fail-closed
exceptions are explicit: a compile-time Grammar gap repairs and publishes the exact Grammar authority
before recompiling, and valid-Grammar visual ambiguity presents three or four rendered alternatives
and waits for one user choice.

## Author once, compile outward

Freeze the complete mission scope before entering the machine. Scope owns the one
`frontend.ux-ui.change-level` value (`refine`, `reconstruct`, or `new`), and
`uxUiChangeLevel` is its validated executable projection. Scope also owns the exact target and file
set, exclusions, write roots, completion proof, and one `frontend.layout.owner-ceiling`. Every exact
file names an owner inside the authorized mutable ceiling. Shared branches, global shells, and
unauthorized ancestors remain observation-only.

`fe/request-compile` authors the single canonical UI contract from approved authority. Direction,
source, capture, and review artifacts compile outward from that contract; they do not silently
re-author intent, behavior, ownership, or scope. User feedback is evidence. If it contradicts a prior
PASS, invalidate the claim, bind the visible counterexample, and continue only through the one owned
repair route or a typed domain exit.

The machine routes `compiled` directly from `result.directionMode`; it does not re-read raw mission
intent in a second policy stage. Invocation binding proves that the compiled projection still equals
the validated mission input.

For reconstruct/new, an already approved direction compiles as `directionMode=none` and applies
directly only when the typed direction identity, fingerprint, and approval ref occur unchanged in
the compiled evidence and exact authority context. A generic authority ref cannot authorize reuse.
Otherwise `fe/direction-generate` must
return its real inspectable visualization artifact. `directionMode=dominant` produces one
evidence-selected direction with `requiresChoice=false` and
continues directly to apply. Only `directionMode=alternatives`, justified by material visual ambiguity
after Grammar is valid or an explicit user request to compare, produces three or four alternatives
with `requiresChoice=true` and enters the user-choice wait. Refine and approved reconstruct/new apply
the compiled contract directly. A direction mock is never delivery proof.

When the business domain or interaction model is unfamiliar, compilation performs the bounded
external reference research required by `knowledge/direction-visualization.md` and freezes its
provenance and limitations in `directionEvidence`. External pages and optional design-agent datasets
remain evidence, not authority or templates. If relevant references cannot be found, generation may
render only an explicitly evidenced, reversible hypothesis whose material decisions are already
supported by approved business facts, product-family signatures, Grammar, and product-neutral UX
principles. Unresolved business or recovery semantics exit through `business-required` or `blocked`;
the frontend process never fills them in by taste.

## UI-only execution boundary

Local FE missions consume the centralized runtime from `.claude/config.yaml`. They do not start,
stop, restart, replace, or kill FE, API, identity, tunnel, or Browser processes and do not rebind
ports or environment. Runtime or account readiness gaps go to their existing delegated owner.

Grammar and shared composition contracts remain fail-closed. Consume published compositions rather
than imitating their anatomy in local CSS. A missing reusable interface is `grammar-required`:
reconcile and publish the smallest exact Grammar authority, then resume `request-compile`. Never use a
product-local CSS workaround. Do not
compile one page's spacing, padding, dividers, cards, or leaderboard treatment into a global law.

The source writer stays inside the frozen exact-file and owner boundary. After every mutation, compare
the complete tracked and untracked delta with that boundary. Static checks, component names, DOM
measurements, and implementation rationale cannot certify the pixels.

When the compiled constraint includes `delivery-mode=ui-only-preserve-business`, preserve business
behavior and allow presentation-only changes in the exact listed files. Do not add API/GraphQL
operations, remote mutations, persistence, auth/session behavior, fixtures, or business actions. Keep
one observable writer for the owner group; never let two tasks repair the same page group concurrently.

## Capture and blind visual proof

After the latest mutation, freeze the render-state matrix and owner partitions, then execute
`capture-preflight -> render-capture -> visual-fidelity`. Preflight must reject bad or missing data,
false steady/skeleton identity, ineffective controls, incomplete probes, failed scroll or zoom
restoration, duplicate rasters, stale source binding, or the wrong handoff host before review.

The primary whole-page proof is a real populated happy-case steady state that renders every major
region and the core task. Empty, loading, skeleton, error, and recovery states are secondary evidence
only. If a populated hero cannot be observed, the result is `insufficient-evidence / N/A`, never PASS
or 9/10.

Capture the full applicable viewport and lifecycle matrix after the latest mutation. Bind every
raster and probe to the same source, matrix, partition, and packet fingerprints. Applicable viewport,
zoom, page-scroll, bounded-scroll, content-stress, transition, sticky/fixed/overlay, drag,
keyboard-focus, and neighboring-composition probes need their own observed image. An unsupported
probe is `not-applicable` only with an exact ownership reason. Probe/capture mismatch or stale binding
is terminal counterevidence.

`fe/visual-fidelity` runs once per round under one distinct fresh `gpt-5.6-sol` execution with
`forkTurns=none`. It receives only the immutable raster packet: no source, DOM, measurements, tests,
authority text, producer rationale, suspected defect, intended answer, prior verdict, or score. It
attacks purpose/content, composition/spacing, and interaction/responsive behavior from the pixels.
Every raster and applicable probe receives its required inspection record.

The reviewer judges whole-page hierarchy, information density, card/surface composition, internal
padding, section rhythm, divider ownership, alignment, typography, color/material finish, content
coherence, responsive reflow, wrapping, clipping, occlusion, affordance, fixed-edge clearance, and
empty-space balance. A cropped component, clean skeleton, accessibility report, screenshot count,
readiness-check count, or green test cannot raise the visual verdict.

## Terminal predicates and closure

Visual PASS is forbidden when any of these is true:

- the compiled contract, exact mutation boundary, or latest-source binding is missing or stale;
- the populated happy-case hero or an applicable state, viewport, lifecycle, or probe is absent;
- preflight is not ready, raster/probe partitions disagree, or any review record is missing;
- any structured visual finding, uncertainty, contradiction, clipping, overlap, misleading control,
  unfinished composition, weak hierarchy, bad padding/divider ownership, or responsive defect remains;
- the implementer reviewed its own work, the Sol execution is not fresh and isolated, or non-pixel
  evidence influenced the blind verdict;
- the same finding survives the single permitted source-apply repair loop or progress repeats.

A complete review may append the noncanonical audit score ledger. Numeric score never replaces the
typed verdict; PASS requires at least 9, any finding caps the score at 8, and missing evidence is N/A.
The ten preflight checks are mechanics, not a ten-point scale.

After blind visual PASS, emit a one-way handoff to `starci-quality-assure`. Consume its exact RETURN
only at `quality-return`, then hand off one way to `starci-uat-verify`. Consume its canonical final
RETURN at `uat-return` to complete, or its explicit counterevidence RETURN at `reapply` for one new
source/capture/review cycle. Quality or UAT cannot route back to analysis or direction generation. A new contradiction after terminal closure uses
the runtime's canonical counterevidence mechanism rather than pretending the old verdict still holds.

For every audited application owner of kind page, layout, modal, or drawer, preserve its adjacent
lowercase `audit.md` as latest evidence and append-only history. Missing or stale owner audit evidence
blocks quality/UAT handoff. Never manufacture PASS from a requested label.

## Runtime continuation

Every peer call emits a typed CALL and resumes only from a correlated runtime RETURN. Mission,
parent-child identity, authority/source heads, resume state, and progress fingerprint must match.
Accept only current v7.6 typed receipts. An exact portable checkpoint may continue only through its
canonical workspace route and current receipt; legacy versions, aliases, and stale migration
artifacts are rejected instead of becoming an FE resume path. Repeated progress fingerprints, missing authority, or an invalid
receipt close fail-safe as `blocked`.
