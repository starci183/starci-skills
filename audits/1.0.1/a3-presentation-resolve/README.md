# A3 dry run 1 — `fe.presentation.resolve` on `dashboard/ContinueLearning`

Date: 2026-09-02. Fixture: `starci-academy-fe/src/components/blocks/dashboard/ContinueLearning/component.tsx`
at head `6f764b1a`, Grammar `@starci/grammar@0.4.0`, knowledge topic `gap` at its current fingerprint.
Bound topics: `gap` only, because the block carries no other presentation property.

Both artifacts pass the operator's own validators (`validate-input.mjs`, `validate-output.mjs`; a
deliberately broken copy is rejected with `$.operatorId: expected "fe.presentation.resolve"`, so the
green is a measurement): [input.json](input.json), [output.json](output.json).

## Node walk

| Node | Observed | Matching case | Owner | Result |
| --- | --- | --- | --- | --- |
| outer `SurfaceCard composition="joined"` | joined faces | GAP-0 Case 3 | `SurfaceCard` | `GRAMMAR_OWNED`, no class |
| `div.grid gap-2 md:grid-cols-2 xl:grid-cols-3` of `SurfaceCard` children | cards of one collection in a grid | GAP-4 Case 2, exactly one | `App` | resolves to `gap-4`; the source's `gap-2` is a value drift the resolver would rewrite |
| featured `div.grid grid-cols-[auto_1fr] gap-3` (`IconTile` beside copy) | leading mark beside a content block inside a card | none | — | `RULE_MISSING` |
| compact `div.grid grid-cols-[auto_1fr] gap-2` | same relationship, quieter item | none | — | `RULE_MISSING` |
| `div.flex flex-col gap-3` (identity pair, then `TextAction`) | copy column whose last child is the action bound to it | none (GAP-3 Case 1 is side-by-side field and action) | — | `RULE_MISSING` |
| `div.flex flex-col gap-1` (kind label under title) | title and its short qualifier | GAP-1 Case 1, exactly one | `—` | `gap-1`, `COMMON_CAPABILITY_MISSING` |
| `Text`, `IconTile`, `TextAction`, `Icon` | Grammar leaves | — | Grammar | not app-owned |

## Outcome

`blocked` · `RULE_MISSING` · owning domain `knowledge`. Per `execute.md` the operator does not round
to a neighbouring case or copy a sibling node, so the unmatched relationships stop the invocation
before any resolved tree is written. The loop cannot proceed to `fe.source.apply` on this block until
the knowledge owner publishes the missing cases and the `gap` topic fingerprint is rebound.

## Returned to the knowledge owner

1. `gap.md` needs a case for a leading mark (`IconTile`) beside a content block inside one card, with
   its owner stated: `App` at one step, or a Common component if one already owns that relationship.
   The source uses two different steps (`gap-3` featured, `gap-2` compact) for the same relationship,
   so the case must also say whether emphasis changes the step.
2. `gap.md` needs a case for a stacked copy column whose last child is the action bound to that copy.
   Today only the side-by-side field-and-action pair is published.

### Why the cases were not published in this session

Counted across the authorized evidence (`blocks/dashboard/*`, `blocks/commerce/ProSubscriptionBlock`):
the leading-mark-beside-copy relationship occurs in one block only, at two different steps; the
copy-column-ending-in-an-action relationship occurs in one block only. Common composes `IconTile`
only inside `EmptyNotice` (vertical, centred, `gap-3 p-4`), so no component owns either relationship.
A case written from a single instance with two steps would be a fabricated rule; the gap stays open
until a second authorized block or a Common capability decides it.

## Observation for the source owner (not a resolver action)

The collection grid renders `gap-2` where the only matching published case is `gap-4`. Once the two
cases above exist and the block resolves, `fe.source.apply` would rewrite that class; nothing is
changed by this dry run.

## What this dry run proves about the tree

- The input contract can be filled from real fingerprints without inventing a field.
- The rule inventory in the input matches the published `gap.md` headings one for one.
- The blocked receipt shape carries enough to resume: node paths, missing ref, required delta.
- `RULE_MISSING` is reachable on the very first real block, which is the operator behaving as
  designed, and the first evidence that `presentation/gap.md` was authored from too few blocks.
