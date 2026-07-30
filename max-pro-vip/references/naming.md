---
name: naming
description: Use when you need to name a component, story, type, file, directory, or write prose text shown in a panel. Does not answer which tier holds what — only answers the naming shape.
scope: 8 kinds of identifiers + 1 kind of prose
---

# NAMING

## Nine kinds, each with its own shape

| # | Kind | Shape |
|---|---|---|
| 1 | **directory** | a kind of element → **plural** (`cards`, `chips`). A **domain** noun → stays singular (`learn`, `commerce`, `ai`) |
| 2 | **impl file `.tsx`** | PascalCase matching the main export, **no dot** |
| 3 | **story file** | PascalCase matching the Component, or `ComponentMember` when it must be split by member |
| 4 | **story title** | `Tier/Family/Component[/device][/state]`, PascalCase, **no whitespace** |
| 5 | **story export** | PascalCase reading like a **data condition** (`Default`, `NotStarted`), not reading like a component name |
| 6 | **type/interface** | suffix by **role**: `XProps` · `XLike` (domain entity) · `XItem` (an element of `items`) · `XStyle`/`XConfig` (lookup-table value) |
| 7 | **prop** | camelCase, **symmetric** with sibling props of the same role |
| 8 | **local variable** | camelCase describing meaning, no abbreviations, no Hungarian notation |
| 9 | **prose text shown in a panel** | **a complete sentence with a subject and a verb.** `—` as a connector is forbidden, `↔` `->` `=>` are forbidden |

**Nine official tiers** *(the disk is the referee)*: `heroui · atom · behavior · frame · composite · block · layout · overlay · page`. `designs` and `screens` are **dead**.

## Decision tree

**Ask this before question 1:** does this string **appear in a panel** for a reader? Yes ⇒ **kind 9, stop right there** — this isn't naming, it's writing a sentence.

Then: directory ⇒ 1 · `.tsx` file ⇒ 2 · story file ⇒ 3 · `title:` ⇒ 4 · `export const` in a story ⇒ 5 · `interface`/`type` ⇒ 6 · a field in Props ⇒ 7 · everything else ⇒ 8.

**The test for kind 5:** delete every other state — can the component still be **called under a different name**? No (only the props change) ⇒ the name is a data condition. Yes (this is a different call site) ⇒ it's actually a **member**, go back to kind 3/4.

## Three pairs that have actually bitten

| Pair | The deciding test |
|---|---|
| story file ↔ story title | the file name **doesn't have to** equal the last segment of `title:`. But splitting a file by state for one title produces **two paths** ⇒ you're conflating STATE with MEMBER |
| story title ↔ story export | different paths = **two call sites** ⇒ genuinely two members. One title with several `export const`s that read like component names ⇒ **state disguised as a member**, split the file |
| type suffix ↔ prop | are you naming the **shape of the data** or a **field** inside that shape? Field ⇒ prop camelCase · the whole shape ⇒ type, suffix by role |

## Forbidden

| Forbidden | Caught by |
|---|---|
| namespace `X.Member` | `check-no-namespace.mjs` |
| an anonymous object-literal type | `check-inline-types.mjs` |
| a story export named like a member | `check-member-as-state.mjs` |
| `storyId` pointing to a story that doesn't exist | `check-story-ids.mjs` |
| a display name with **whitespace**/prose | gate not written yet |
| a family directory kept singular when it groups a replicable kind | not yet |
| inferring a type/prop name from **where it's used** instead of its **role** | discipline |
| abbreviations/Hungarian notation for local variables | no eslint rule for this |
| connector symbols in panel strings | **writable, so write it early** |

## Kind 9 — why symbols are forbidden

| Case | How to write it |
|---|---|
| wrong | `lead row — icon ↔ text cluster, center-aligned` |
| right | `the lead row, where the icon sits next to the text cluster, both aligned on the same line` |

Three reasons, not taste: **the panel is a narrow column** so text wraps anywhere — a symbol split from both ends loses its meaning, a sentence still reads fine. **The final reader is the LLM rebuilding the UI** — hit `A ↔ B` and it has to guess, and guessing is exactly where it makes things up. And symbols **don't translate** — everyone reads `↔` differently.

Exception: markdown tables in JSDoc, `§` anchors, arrows in a **tree diagram** — there, they're structure, not a sentence.

## Red flags

- "Just rename the two files to match and you're done" → **duplicate title, broken index**. Merge the files first, rename after. Never the other way around.
- "`learn` should be `learns` for consistency" → a **domain** noun stays singular. Forcing a plural means you misread the first question.
- "The docs say the path is `designs/`" → that name is dead. Re-read the disk with `ls`/`grep`, don't copy from the docs.
- "`X.Member` groups the family together neatly" → measure before deleting: only **1/10** of the namespace actually shares a signature.
- "Write `A ↔ B` for brevity" → the panel is a place **read as a sentence**. You're in naming mode inside a slot that needs a sentence written.
- "This rule doesn't belong to any axis" → **a rule that doesn't fit an axis's shape is a rule about to fall through the cracks.** Say so out loud, don't let it go looking for a home on its own.

## Read deeper

[`naming/rationale.md`](naming/rationale.md) · [`naming/example.html`](naming/example.html)
