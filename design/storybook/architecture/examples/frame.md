# frame — in a real system

Direction, seam, alignment — and provably nothing about content.

The rule is in [`../elements/frame.md`](../elements/frame.md). This is one system obeying it,
named so every row can be checked.

| Component | Renders | Why this tier |
|---|---|---|
| `Stack` | children in a column or row at one rhythm | props are `gap · align · justify · divider · padding · nested · as · inline` — every one is arrangement |
| `Cluster` | items that wrap onto the next line | repeats a list; takes `items` data, never `children` |
| `Grid` | a fixed-column grid | columns are arrangement, not content |
| `ResponsiveRow` | a row that becomes a column at a named width | names the width where it changes — the reason `wrap` is not an answer |
| `Split` | two named regions, start and end | multiple roles ⇒ named slots, never `children` |
| `SplitWorkspace` | main plus aside | same contract as `Split` |
| `Container` | a readable-width cap, centred | owns `max-w` and `mx-auto`; `Stack` deliberately has neither |
| `RailShell` | a rail beside a body | arrangement plus its own chrome |
| `Flex` | a raw flex box for the frame layer itself | internal — never called from outside `frames/` |

## The proof is in the props

Read any frame's prop list. If one of them describes **content**, the frame has become a composite.
`Stack` is the check: ten props, not one of them asks what the children are.

## Three content contracts

| The frame | Takes | Never |
|---|---|---|
| wraps free-form content | `children` | — |
| repeats a list | `items` data | `children` |
| holds multiple roles | named slots | `children` |

## The one legal reach downward

`Stack` imports the divider atom to place a rule **between** children. The caller does not pass a
divider in — `Stack` decides it from a boolean. That is chrome the frame owns, and it is the whole
of the exception.

---

Read from a live tree with `scripts/scan-storybook-architecture.mjs`. Another repo answers with
different names, and its answer outranks this file.
