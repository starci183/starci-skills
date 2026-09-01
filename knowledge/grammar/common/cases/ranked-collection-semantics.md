# Common case: ranked collection semantics

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-case-ranked-collection-semantics` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/common` |
| Operators | `fe/authority-reconcile` |
| Search tags | `rank, placement, medal, cup, trophy, delta, leaderboard` |
| Dependencies | `fe.grammar-common-semantic-color, fe.grammar-common-states-accessibility` |

## Trigger

A repeated collection compares ordered standing and may show placement distinction or movement since
a prior observation.

## Closed semantics

Every row keeps an explicit numeric rank, identity, and the comparable measure that determines order.
Current-user emphasis is `selected`, not success. Visual marks supplement this text:

- medals are reserved for the declared medal placements, normally first through third, and never
  replace the numeric position;
- a cup/trophy identifies the winner or the ranking competition/summary owner, never every ranked row;
- movement delta compares current rank with one exact prior observation: upward/improved,
  downward/declined, unchanged, or unknown;
- a delta shows direction plus signed magnitude or explicit unchanged text and an accessible label;
  color alone and an unlabeled arrow are insufficient;
- unknown or incomparable history renders no inferred movement claim.

Improvement/demotion is relative movement, not generic product success/failure. The selected Grammar
may bind distinct movement tones only when text and direction remain explicit and deterministic.
Scores, streaks, rewards, tiers, or completion states do not become rank delta by proximity.

## Responsive

Preserve rank, identity, comparable measure, and movement meaning. Compact layout may reorder
secondary metadata but may not hide the field that determines ordering or turn every row into an
independent decorative card when comparison remains important.

## Proof and negative boundary

Prove top placements, ordinary placement, selected current user, improved/declined/unchanged/unknown,
ties when supported, long identity, zero/large delta, screen-reader text, and compact alignment.
Ranking fixtures are evidence for this reusable relationship, not page-specific authority or
permission to hardcode names, scores, colors, or placement counts.
