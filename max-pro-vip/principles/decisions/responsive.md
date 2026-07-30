---
name: responsive
description: Decision sheet for the responsive axis — decide how a shape changes as width changes when admitting a new entry into the library. Answers where a row breaks, what happens to a side region, and who owns a threshold. Does not answer how much data there is — that is volume, and volume picks the arrangement before width ever gets a say.
scope: breakpoints, collapse behaviour, container queries
---

# RESPONSIVE

## Scale — width and volume are two different axes

| Question | Decided by | Where |
|---|---|---|
| how many regions, centred or split | **record count** | `library/composites` |
| where a region breaks, folds, or disappears | **width** | this axis |

Volume decides first. Width only decides what happens to an arrangement volume already chose. Answering "it feels crowded" by adding a breakpoint is treating a volume problem as a width problem.

## Most of this axis is enforced by API, not by reading

Four rules, all of them structural. If the API is built right, none of them can be broken.

| Rule | Packaged as |
|---|---|
| a breakpoint is a **name**, never a number | `at: "sm" \| "md" \| "lg"`, never `at: 768` |
| a row must declare **where it breaks** | `at` required. There is no default and no "auto" |
| a side region forces a **collapse rule** | discriminated union: `{ aside?: never } \| { aside: ReactNode; collapseAt: Breakpoint }` |
| `@container` and `padding` never share an element | the frame splits two layers itself; the caller gets no chance to merge them |

No rationale file yet — this axis was created on 2026-07-30 and its history is three dated traps
recorded in [environment](../../references/environment.md) and in
[frame rationale](../../references/axis-notes/frame/rationale.md) section 4.3.

Rules no machine catches: [judgement](../judgement.md)
