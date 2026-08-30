# Mandatory UI laws — routing index

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui` |
| Operators | every frontend decision, implementation, review, and proof operator |
| Search tags | `ui law, mandatory, hierarchy, composition, ownership, responsive, state, affordance, media, accessibility, defect owner` |
| Dependencies | approved Behavior and UX authority; `fe.layout-composition`; routed Grammar; the law records in this directory |

## Authority boundary

This directory owns durable UI laws that remain true across products, pages, visual families,
components, and viewports. Every applicable law is compulsory. A routed Grammar, source precedent,
approved mock, attractive raster, or passing test may satisfy additional constraints, but none may
waive a UI-law violation.

This directory deliberately does **not** own packaged UI or product-family appearance. Grammar Core
owns packaged primitives and components, visual DNA, tokens, variants, object contracts, and reusable
composition recipes. A routed product Grammar may extend that package for its family. Product source
owns page realization and local content/state binding. Behavior owns facts and permissions; UX owns
journeys, task order, recovery, and interaction-container choice.

Do not place a radius, color, type scale, named component treatment, token value, visual signature,
page archetype, or family recipe in this directory. Those choices belong to Grammar even when they
recur.

## Progressive load order

Load this index whenever `fe.ui` is bound. Then load every law record that can affect the frozen
surface, state, viewport, or proof. A UI verdict is invalid when an applicable record was skipped.
Do not concatenate the whole directory by habit; route from the observed decision or defect:

| Decision or observation | Required record |
| --- | --- |
| invented status, promise, trust, urgency, or semantic color/glyph claim | [`render-truth.md`](render-truth.md) |
| reading/action order, progress, fact rank, or competing emphasis | [`hierarchy.md`](hierarchy.md) |
| region purpose, surface nesting, disclosure load, dead zones | [`ownership-composition.md`](ownership-composition.md) |
| padding, dividers, scroll owners, pinned/overlay clearance | [`boundaries-spacing.md`](boundaries-spacing.md) |
| wide/intermediate/compact transformation or sticky/drag constraints | [`responsive.md`](responsive.md) |
| loading/empty/error/recovery, labels, focus, links, control feedback | [`states-affordance.md`](states-affordance.md) |
| no/reuse/generate media decision, crop, alt, fallback, AI image | [`media.md`](media.md) |
| first-glance direction quality, sub-9 brainstorm, smallest Business/Backend supplement | [`direction-quality.md`](direction-quality.md) |
| raster/probe sufficiency, invalidation, falsification, visual PASS | [`evidence.md`](evidence.md) |

## Smallest-owner classification

| Evidence | Smallest owner |
| --- | --- |
| The requirement is necessary regardless of product family, page, package, or style | one law record in this directory |
| The result is coherent but not StarCi/product-family native, or a packaged primitive/token/recipe is missing | Grammar Core or routed Grammar |
| One consumer misapplies an existing law, component, token, state, or recipe | product source |
| Several pages need one family-specific composition without proving a universal invariant | named Grammar recipe/case, then consumers |
| Facts, permissions, task order, recovery, or content are absent or contradictory | Behavior, business, backend, or UX authority |

A page-only defect is not evidence for a universal law. A repeated family appearance problem is not
evidence for copying visual DNA into UI law. Repair the smallest demonstrated owner and rerun the same
observation.

## Mandatory evaluation contract

Evaluate every rendered situation in the fixed order `AI-first -> Rules-first -> Grammar-last`:

1. `AI-first` observes approved meaning, user purpose, evidence, status, and next-action priority.
2. `Rules-first` applies every routed law record; any contradiction fails the UI decision.
3. `Grammar-last` binds the coherent decision to Grammar Core plus exactly one routed Grammar.

Record surface, region, state, viewport, decision, law evidence, Grammar binding, implementation
intent, negative boundary, and runtime proof. `PASS` requires all applicable UI laws and Grammar to
pass. `FAIL` is any direct contradiction. `SUSPENSE` is a finite unresolved render choice with no law
failure and never counts as PASS. `BLOCKED` means required product authority or runtime evidence
cannot be obtained.
