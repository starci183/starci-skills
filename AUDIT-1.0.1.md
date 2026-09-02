# Audit toward StarCi Skills 1.0.1

Status: draft for the owner's shaping. `package.json` stays `1.0.0` until every row below is closed;
1.0.1 is the outcome of this audit, not its starting point.

Baseline under audit: `main` at `37b756b` (this tree). The complete v7.6 runtime is on branch `v7`
at `83b28e2` and is the only place a v7-only file may be cited from.

## What "complete" means

Every operator can be driven end to end on a real artifact and its output validates. Every knowledge
file the runtime binds has been read by the owner in its `.vi.md` mirror. Every open ownership
decision has one recorded answer. No finding below stays open without a named owner.

## Track A — the skills tree

| # | Area | Files | Reviewed by owner | Check | Owner decision needed |
| --- | --- | --- | --- | --- | --- |
| A1 | `SKILL.md` entry table | 1 | no | each of 14 request shapes routes to the right first operator | none |
| A2 | `routing.json` | 76 routes | no | every route's target is semantically right, especially the four meanings of `frontend` and `contract` → user, `source` → `workspace.bind` | none |
| A3 | FE loop operators | 4 packages | no | dry-run `fe.direction.decide` → `fe.presentation.resolve` → `fe.source.apply` → `fe.surface.audit` on the dashboard; each `execute.md` followable, each output validates. 2026-09-02: `fe.presentation.resolve` run on `dashboard/ContinueLearning` from real fingerprints; both artifacts validate; outcome `blocked · RULE_MISSING` because `gap.md` has no case for a leading mark beside a copy block nor for a copy column ending in its action, and the authorized evidence holds one instance of each, so no case was written ([record](audits/1.0.1/a3-presentation-resolve/README.md)). The other three operators wait for a resolvable block and a stable FE checkout | none; the two missing gap cases wait for a second authorized block |
| A4 | remaining 10 operators | 10 packages | no | one dry-run each with a real input; failure codes exercised at least once. 2026-09-02: `business.decide` run on `pro-subscription` against backend head `0b540dd2` and the real business head `eccaeaad`; outcome `blocked · EVIDENCE_MISSING` because every Pro enforcement is untracked at that head ([record](audits/1.0.1/a4-business-decide/README.md)). Two tree defects it exposed are fixed: the contract now names heads at `features/<featureId>` as the real root does (`3aaada85`), and `workspace.bind` derives `route.authorityRoots.businesses` so the root is no longer typed by hand (`6aa4d3b8`). `workspace.bind` run on `starci-academy/be` from the real portable and hydrated declarations; the route resolves, the checkout has 54 dirty paths outside the write root, outcome `blocked · CHECKOUT_DIRTY` ([record](audits/1.0.1/a4-workspace-bind/README.md)); that failure had been unreachable because the input validator pre-empted it, fixed in `47d21798`. `quality.verify` cannot run yet: it requires a producer receipt (`predecessors` minItems 1) and none exists, which is correct behaviour; recorded with the gate inventory it would pin ([record](audits/1.0.1/a4-quality-verify/README.md)). Eight operators remain | none |
| A5 | `ui/presentation/` | 10 topics | gap, padding, margin only | rule shape, `Owner` column, "Common already owns" table grounded in `packages/grammar` source; no invented API | none |
| A6 | `ui/composition/` | 8 topics | no | one prefix per file, `Decide` column states what the direction must settle, no verdict tables | none |
| A7 | `ui/proof/` | 5 topics | no | closed 2026-09-02: `_pending-contrast` relocated to `ui/proof/contrast.md` (+vi) as COLOR-3 and COLOR-5 in the proof rule shape, catalog row added, `fe.surface.audit` self-test binds and cites the `contrast` topic (`384a3ec9`); `Observe` column of the other four topics still to be read by the owner | decided: measured contrast lands in `ui/proof/contrast.md` |
| A8 | `patterns/fe`, `patterns/be` | 16 topics | no | every rule cites two real paths; non-universal counts stated; open questions left open | 7 recorded open questions |
| A9 | `grammars/starci/` | 5 topics | partly | matches current `packages/grammar`: no `Link`, `TextAction`/`Button` take `href`; 41 renderers | none |
| A10 | `_pending-*` | 0 files | no | closed 2026-09-02: contrast → `ui/proof/contrast.md` (`384a3ec9`); surface, boundary, icon, media, control-state, field → `grammars/starci/{surface,boundary,icon,media,control-state,field}.md` (+vi) with one `Case \| Rule \| Common owner \| Core realization` table per rule, every owner read from `packages/grammar/src` (`02f06b02`); the fourteen files deleted and the "Awaiting relocation" section removed after a recount to 118 ids (`85f3863d`) | decided as recorded; the prefix collision is closed: the legacy series is now `CORE-SURFACE-1..5` and `CORE-BOUNDARY-1..5` with provenance stated and numbers unchanged (`d78457a9`) |
| A11 | `resources/` | 2 registries, 14 operators | no | decided 2026-09-02: each operator binds exactly one profile and runs on it end to end (`roles` retired; the validator rejects a split). sol-fresh: business, architecture, fe.direction; sonnet: workspace.bind, fe.presentation.resolve, quality.verify, git.publish; opus: backend.implement, fe.source.apply, release.deploy, platform.operate; sol-reviewer: fe.surface.audit, uat.verify; luna: content.generate (schema-pinned; now permitted bounded web research for its own brief). The policy answers stay as set | whether `fable` should bind any operator |
| A12 | knowledge citations | 116 files | no | every `PREFIX-n` or `PREFIX-a..b` a knowledge file cites resolves to a published `##` heading; `scripts/validate-knowledge-citations.mjs` runs inside `npm test`. First run found 51 defects in `grammars/starci` (`RENDER-TRUTH-*`, `ACCESSIBILITY-*`, `TONE-4..5`, `PADDING-7/8` at `###`), all fixed (`d78457a9`); the tree publishes 254 rules under 44 prefixes | none |

## Track B — what the tree depends on outside itself

| # | Item | State | Blocker | Owner decision needed |
| --- | --- | --- | --- | --- |
| B1 | `packages/grammar/src/common/conformance.ts` | closed 2026-09-02 | the hand-copied `RULE_FAMILY_COUNTS` is replaced by `packages/grammar/scripts/generate-rule-catalog.mjs` → `src/common/rule-catalog.generated.ts`, read from the knowledge headings (prefixes taken from the headings, ids listed rather than expanded because the spacing families start at `-0`); snapshot 29 families, 150 rules; `grammar:verify` green again after its stale `Link` import was removed | decided: regenerate, never copy |
| B2 | starci-academy-fe | pushed 2026-09-02, remote head `956d680` | pre-push ran lint and the unit suite on its own: `Test Files 497 passed (497)`, `Tests 3006 passed, 35 skipped`; `eslint` 0 problems; `tsc --noEmit` clean; four stashes untouched | closed by B4 and B5 |
| B3 | nivo-fe | pushed 2026-09-02, remote head `c9eb551` | closed: the two `no-vendor-icon-outside-icon-leaf` errors were the icon leaf itself renamed out of `leaves/Icon/index.tsx` by the grammar migration; it is back in the leaf, 13 consumers import it, and 7 further pre-existing `@nivo/app` lint errors that the pre-push hook exposed were fixed (two stranded `"use client"` directives among them). Lint 0, typecheck clean, 405 unit tests green | decided: icon authority lives in the Grammar icon leaf |
| B4 | `LearnSpine/component.spec.tsx` | closed 2026-09-02 | the order-dependence premise was wrong: the file hangs alone, in the one test that re-renders the rail collapsed. React Aria keys `ListBox.Section` and `ListBox.Item` in one namespace, and `Sidebar` passed the caller's group id straight to the section, so a group whose id equals its own item's id (`home`) collided: every later section was dropped (the "Your path" failure) and re-rendering the colliding collection never settled. `Sidebar` now prefixes section keys (`sidebar-section:<id>`), with a regression test; both pools complete | none |
| B5 | 35 red tests in starci (33 expected) | closed 2026-09-02 | tests moved onto the current contract (`role="button"` for callback actions, `button--primary`/`button--md` classes, `data-appearance`); seven were real component bugs and were fixed in the component: empty pressable targets in resting `ActivityRow`/`SuggestedUserRow`, `CourseMindMap` resting labels it held, `LearnSpine` locking rows with `isDisabled` so the gate was unreachable, `SourceFileTree` never setting `isActive` on the row control, `Article` folding six heading levels into one, `CoursePriceOverlay` close control without an accessible name (new copy key in both locales) | decided: no old attribute is republished |
| B6 | `isPressLabel` on `Text` | closed 2026-09-02 | only 3 call sites existed, not 64; the prop, its `data-press-label` attribute and class entries are removed from `Text`; `PressableSurface` publishes `pressableLabelClassName`, applied on the wrapper that already holds the identity line, firing on the control's own `.group:hover` / `.group:focus-visible`; `TextAction` already underlined on the press target | decided: the press target owns the underline |
| B7 | backend `package.json` scripts into `.claude` | closed 2026-09-02 (`8f645ee1`) | `workspace:bootstrap`, `sync:device`, `checkpoint:data:*`, `sync:data`, and `gate:canon` call `.claude/scripts/workspace-portable.mjs`, `device-state.mjs`, and `*.spec.mjs`, and the route declarations name `readiness/initialization/workspaces/*.schema.json` as `$schema`; the cutover dropped all of them. Restored from v7 with the validator import rewired; `check --source ..` validates all 10 routes. Still open outside the tree: `scripts/measure-canon-rules.mjs` imports `.claude/sources/be/*.mjs`, which neither v7 nor v8 holds, and `sync:device` calls `npm --prefix .claude run setup:python`, which no version defined | delete or retarget the two dead backend references |

## Proposed order for the shared sessions

1. A3 with the dashboard as fixture. This is the loop the release exists for, and it exercises A1,
   A2, A5 in passing.
2. A5's seven unreviewed topics, in the `.vi.md` mirrors: font, tone, measure, text-flow, overflow,
   surface, boundary.
3. A2 route by route, then A1.
4. A6, A7, A10 together, since relocating `_pending-contrast` closes both A7 and part of A10.
5. A4, two operators per session, real inputs only.
6. A8 last; it is reference material, not a runtime gate.

Track B runs in parallel where it needs no owner decision: B4 is a defect, B1 is mechanical once A10
settles the family list.

## Rules for the audit itself

- A row closes on evidence, not on reading: a dry-run receipt, a passing validator, a source path, or
  a recorded decision.
- A finding is repaired at its smallest owner. A wrong rule is fixed in knowledge; a wrong route in
  `routing.json`; a wrong operator contract in that package alone.
- Nothing in `.vi.md` becomes runtime authority. The owner edits there; the English file is updated to
  match and is what the validators and operators read.
- A row that would require inventing an API, a rule identifier, or a destination stays open and says
  so.
