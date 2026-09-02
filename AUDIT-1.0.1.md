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
| A3 | FE loop operators | 4 packages | no | dry-run `fe.direction.decide` → `fe.presentation.resolve` → `fe.source.apply` → `fe.surface.audit` on the dashboard; each `execute.md` followable, each output validates | none |
| A4 | remaining 10 operators | 10 packages | no | one dry-run each with a real input; failure codes exercised at least once | none |
| A5 | `ui/presentation/` | 10 topics | gap, padding, margin only | rule shape, `Owner` column, "Common already owns" table grounded in `packages/grammar` source; no invented API | none |
| A6 | `ui/composition/` | 8 topics | no | one prefix per file, `Decide` column states what the direction must settle, no verdict tables | none |
| A7 | `ui/proof/` | 4 topics | no | `Observe` column names runtime evidence that would falsify; contrast rules relocated from `_pending-contrast` | where measured-contrast lands |
| A8 | `patterns/fe`, `patterns/be` | 16 topics | no | every rule cites two real paths; non-universal counts stated; open questions left open | 7 recorded open questions |
| A9 | `grammars/starci/` | 5 topics | partly | matches current `packages/grammar`: no `Link`, `TextAction`/`Button` take `href`; 41 renderers | none |
| A10 | `_pending-*` | 7 files | no | each has a destination and is moved, not deleted | contrast → proof; surface, boundary, icon, media, control-state, field → grammars |

## Track B — what the tree depends on outside itself

| # | Item | State | Blocker | Owner decision needed |
| --- | --- | --- | --- | --- |
| B1 | `packages/grammar/src/common/conformance.ts` | stale | `RULE_FAMILY_COUNTS` still mirrors the retired 25-family catalog; three families assert coverage of rules that no longer exist | regenerate from the new tree or delete the mirror |
| B2 | starci-academy-fe | 7 local commits, unpushed | `pre-push` runs lint and the unit suite; lint has 1 architectural error; the suite cannot finish | see B4, B5 |
| B3 | nivo-fe | 4 local commits, unpushed | 2 architectural lint errors; unit suite 100% | where icon authority lives after the grammar migration |
| B4 | `LearnSpine/component.spec.tsx` | kills a `forks` worker | under the default `forks` pool the worker exits at load and the pool waits forever, so no full run ends and `pre-push` can never pass; under `--pool=threads` the same file completes in 38ms and fails one ordinary assertion (group label "Your path" is not rendered, same family as B5) | none; find the module that kills the fork, or move the app project to `threads` |
| B5 | 33 red specs in starci | pre-existing | stale attribute contracts (`data-variant`, `data-tone`), selection-vs-destination tests, `SourceFileTree` active state | which stale contracts Grammar should re-publish |
| B6 | `isPressLabel` on `Text` | 64 files | a static leaf carrying press semantics | keep, or move underline-on-hover to the press target's CSS |

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
