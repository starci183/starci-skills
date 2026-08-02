# frame — in a real system

Direction, seam, alignment — and provably nothing about content.

The rule is in [`../elements/frame.md`](../elements/frame.md). This is one system obeying it,
named so every row can be checked.

| Component | Renders | Why this tier |
|---|---|---|
| `StackV` · `StackH` | a `body` in a column, or in a row, at one rhythm | props are `gap · align · justify · divider · padding · nested · as · inline` — every one is arrangement |
| `Cluster` | items that wrap onto the next line | repeats a list; takes `items` data, never `children` |
| `Grid` | a fixed-column grid | columns are arrangement, not content |
| `ResponsiveRow` | a row that becomes a column at a named width | names the width where it changes — the reason `wrap` is not an answer |
| `Split` | two named regions, start and end | multiple roles ⇒ named slots, never `children` |
| `SplitWorkspace` | main plus aside | same contract as `Split` |
| `Container` | a readable-width cap, centred | owns `max-w` and `mx-auto`; the stacks deliberately have neither |
| `RailShell` | a rail beside a body | arrangement plus its own chrome |
| `Flex` | a raw flex box for the frame layer itself | internal — never called from outside `frames/` |

## Direction can live in the name instead of a prop

There is no `Stack` with a `direction`. There are two components, and the axis is baked into each
name — which is why `wrap` exists on `StackH` and does not exist at all on `StackV`: a column
already grows without bound, so wrapping a column means nothing.

A prop would have had to accept both and then document that half its combinations are meaningless.
Splitting the component instead makes the impossible call unwritable, which is the same move as
closing a union: the type stops the mistake instead of a reviewer catching it.

The cost is a second name to learn. Worth it when a prop's values change what the *other* props
mean; not worth it when they only change a value.

## The proof is in the props

Read any frame's prop list. If one of them describes **content**, the frame has become a composite.
The stacks are the check: ten props, not one of them asks what the children are.

## Two content contracts, and `children` is not one of them

| The frame | Takes |
|---|---|
| repeats a list | `items` data |
| holds one region or several roles | a named slot each |

`children: ReactNode` never appears, however natural it reads. A slot can be narrowed later — to an
array of a known element, to a union of allowed tiers — and `children` cannot, because there is no
name to hang the type on. The `<>…</>` at a call site is what that possibility costs.

## The one legal reach downward

`Stack` imports the divider atom to place a rule **between** children. The caller does not pass a
divider in — `Stack` decides it from a boolean. That is chrome the frame owns, and it is the whole
of the exception.

---

Read from a live tree with `scripts/audit/scan-storybook-architecture.mjs`. Another repo answers with
different names, and its answer outranks this file.
