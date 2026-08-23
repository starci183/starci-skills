---
title: Frontend quality review
---

# Frontend quality review

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `knowledge/brainstorms/frontend-quality/schema.json` | file | validate one candidate's integrated quality receipt |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | enforce lens coverage, advisory boundaries and detector closure |

## Record

This module folds the useful capabilities of public frontend-design, UI/UX intelligence, interface-guideline,
React-performance, composition, accessibility and design-review skills into one StarCi brainstorm review. It does
not copy their visual choices or make them product authority. It gives Layout, Block and Refactor one shared way to
challenge a direction before the owner spends an approval on it.

## Authority boundary

Routed business truth, Grammar, MASTER, current source ownership and rendered product evidence are binding.
External skills, catalogues and guidelines are advisory evidence only. They may widen the questions asked or
identify a candidate defect, but they may not add a journey step, route, state, action, field, token, component or
source file. Every adopted recommendation is restated as a StarCi-owned decision and mapped to `business`,
`grammar`, `principle`, `pattern`, `gate` or `source`.

No external package or network call is required. When an installed or fetched source is consulted, record its
locator and content digest. Live unpinned instructions cannot become binding input.

## Integrated evidence families

| Family | Contribution to the review | Boundary |
|---|---|---|
| distinctive craft | subject-specific visual character, intentional hierarchy, typography, one memorable move and anti-template critique | MASTER and routed Grammar still fix the product family |
| searchable intelligence | product/style/palette/type/chart/stack recommendations and known UX patterns | recommendations only; never copied into authority |
| interface quality | accessibility, focus, forms, touch, navigation, content overflow, locale and error recovery | observable obligations must map to proof |
| React engineering | waterfalls, bundle/render cost, component composition and state/API shape | apply only to the detected stack and exact source chain |
| incumbent-system review | design-system compliance, current tokens/components, responsive behavior and trustworthy interaction | current governing owners must be proven, not inferred from names |
| deterministic detectors | repeatable anti-pattern, accessibility, responsive, motion, performance and composition checks | detector output is evidence, not a design decision |

## Advisory source map

This map records what may be learned when a source is actually available; it does not import that source or pin a
live version. A run that consults one records its locator and digest in `sources`.

| Advisory family | Questions it may strengthen | StarCi destination |
|---|---|---|
| Anthropic frontend-design | intentional hierarchy, typography, composition and subject-specific visual character | `product-fit`, `visual-character`, `design-system` |
| Impeccable | structured critique, accessibility, responsive, interaction, copy, motion and anti-pattern detection | applicable lenses plus the six detector families |
| UI UX Pro Max | searchable product/style/palette/type/chart/stack recommendations | evidence for `visual-character`, `design-system`, `responsive-content` and `performance-motion` |
| Vercel Web Interface Guidelines | semantics, focus, forms, touch, navigation, overflow, content and error feedback | `accessibility`, `interaction`, `responsive-content`, `copy-localization` |
| Vercel React Best Practices | waterfall, bundle, render and client-performance risks | `performance-motion`, `component-composition` |
| Vercel composition patterns | compound composition, state/API ownership and boolean-mode pressure | `component-composition`, `state-resilience` |
| ibelick UI Skills | practical baseline cleanup and implementation-level interface review | `design-system`, `accessibility`, `responsive-content` |
| Microsoft frontend design review | design-system fit, accessibility and cross-viewport implementation review | `design-system`, `accessibility`, `interaction`, `responsive-content` |
| Taste Skill | anti-generic character and restraint checks where its declared product domain applies | `visual-character`; domain exclusions remain exclusions |

Names in this table are routing labels only. Their recommendations remain advisory even when several agree.

## Review process

1. Freeze the same scope, facts, content, MASTER, page set and viewport set used by the candidate.
2. Inventory binding sources first. Add external advisory receipts only when they materially change a question or
   reveal a verifiable risk.
3. Review the candidate through every closed lens below. A draft with an unresolved revision is revised or rejected
   before it enters the Layout/Block candidate batch.
4. Name one product-specific character move. It may be inherited from the parent or MASTER; it must encode a real
   subject, relationship or task and may not be decoration-only.
5. Run every detector family against the frozen HTML or source evidence available at that stage. Record `pass` or
   evidenced `not-applicable`; unresolved findings keep the candidate ineligible.
6. Validate the canonical receipt and attach it unchanged to the candidate. Layout state expansion preserves the
   approved receipt byte-for-byte.

## Closed lenses

| Lens | Question |
|---|---|
| `product-fit` | Does the direction make the actor's job, decisive action and outcome clearer without inventing product truth? |
| `visual-character` | Is the result specific to this product and free of generic AI/template defaults? |
| `design-system` | Does it preserve or explicitly route every deviation from the governing MASTER, tokens and components? |
| `accessibility` | Are semantics, contrast, focus, keyboard, touch and assistive feedback represented? |
| `interaction` | Are navigation, feedback, destructive actions and interruption/recovery behaviors predictable? |
| `responsive-content` | Do hierarchy, content length, localization, zoom and narrow layouts remain operable? |
| `performance-motion` | Is motion purposeful and reduced-motion safe, with avoidable layout/bundle/render cost rejected? |
| `component-composition` | Does the direction fit the real component/state ownership chain without prop or boolean-mode leakage? |
| `state-resilience` | Are loading, empty, ready, error, permission, disabled and overlay conditions owned and recoverable? |
| `copy-localization` | Are labels specific, stable across the flow, source-owned and safe for locale expansion? |

`product-fit`, `visual-character`, `design-system`, `accessibility`, `responsive-content` and `state-resilience`
always return `pass`. The other lenses may be `not-applicable` only with concrete evidence. A lens decision names
its StarCi owner and the proof that will close it.

## Detector families

Every eligible candidate records exactly one result for `semantics-a11y`, `interaction-feedback`,
`responsive-overflow`, `motion-performance`, `react-composition` and `state-content`. The first, third and sixth
always pass. A detector may be `not-applicable` only when the technology or interaction it checks is absent.

## Candidate count

This review never creates alternatives. Layout, Block or Refactor still emits exactly one direction by default.
When the owner explicitly requests brainstorm before `OK #1`, each of the three or four complete alternatives gets
its own review against identical facts and content. A weaker or invalid draft is removed rather than shown as an
option. External styles, palettes or fonts do not count as materially distinct directions by themselves.

## Output

One canonical JSON receipt conforming to `@schema`, attached to the candidate it reviews. Validate it before HTML
generation and again before `OK #1`:

```bash
node @validate-artifact --schema @schema --data <frontend-quality.json> --hash
```

The receipt is session evidence. It becomes approval-bound only as part of the Layout schema-9 page hash, the
Block schema-3 anatomy, or Refactor's displayed direction boundary.
