---
title: The-split
---

# The-split

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses nothing. It refuses, and it must be able to point at the call it refuses on.

## Law

A surface that owns a request is two files. One fetches, settles which situation the reader is in and
resolves the words; the other takes an already-settled situation and draws it. The line exists so that
everything that can be wrong about DATA sits in one file and everything that can be wrong about
DRAWING sits in the other.

The law states six codes. **Two of them have a rule.** That is not an accident of coverage, it is the
shape of the problem: a file that fetches, reads a store or resolves a word is visible in what it
CALLS, while a file that draws badly looks exactly like one that draws well. This module records the
enforced half honestly, including the places where the enforcement is thinner than the name suggests.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `presentational-purity` | `SPLIT-1` | `reaches` — a call by name from one of four world-reading families, made inside the drawing half |
| `connected-block-has-presentational-twin` | `SPLIT-5` | `missing` — a connected block index reads the world but does not import exact `_<Folder>` from `./component`; `bypass` — it renders some other JSX tag; `unused` — it imports the twin and never renders it |

Both rules map to a code the law states. No rule here enforces something the law does not say, and no
rule is left without a code.

`SPLIT-2` (styling stays in the drawing half), `SPLIT-3` (the situation crosses as a name, not a bag
of flags), `SPLIT-4` (copy is resolved before it crosses) and `SPLIT-6` (a surface with no request
does not split) have **no rule at all**. They are unenforced by design, and a green run says nothing
about any of them.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means no visitor was installed and the rule did not exist for that file.
2. **`presentational-purity` needs a filename ending in `component.tsx`.** Any other name, including
   `view.tsx`, `Component.tsx` or `component.jsx`, switches the rule off.
3. **The twin rule needs a block index** — `components/blocks/**/<Folder>/index.tsx`, with a
   capitalised folder — and it needs the file to read the world. No world read, no check at all.
4. **Read the callee type first.** Both rules stop the moment a callee is not a bare `Identifier`, so
   one namespace defeats both.
5. **Emit one block per finding**, and write the `hatch` line whenever an open hatch would have hidden
   the same failure.
6. **Do not report what no rule watches.** Four of the six codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `presentational-purity` — SPLIT-1

**What it reports.** `reaches` — one report per offending call, interpolating the matched name.

**How it detects.** Scope is `context.filename`, backslashes rewritten to `/`, tested against
`/(?:^|\/)component\.tsx$/`; out of scope `create` returns an empty visitor object. In scope there is
one visitor, `CallExpression`, requiring `node.callee.type === "Identifier"` and testing `callee.name`
against a single union regex of four families: `useSWR` / `useSWRMutation` / `use…Swr`;
`useAppSelector` / `useDispatch` / `use…Store`; `useTranslations` / `useLocale` / `useFormatter`;
`query<Capital>…` / `mutation<Capital>…`.

**What it cannot see.** A member-expression callee — `hooks.useTranslations()`,
`store.useAppSelector()`, `client.queryOrder()` — because the visitor returns the moment the callee is
not an `Identifier`. A wrapper hook with an ordinary name — `useOrderData()`, `useRowsFor(id)`,
`loadSummary()` — matches no family, and this is the standard tidying move: one file away, the same
fetch becomes invisible. An all-caps suffix, `useOrderSWR()`, falls outside the exact `Swr` suffix. An
alias local to the drawing half — `import {useTranslations as translate}` then `translate("x")` —
passes, because this rule never reads imports at all. Reaching through a child rather than a call — the
drawing half rendering a connected `<OrderTotal />` — produces no call in this file. And the filename
gate is the cheapest thing in a repository to change.

**Boundary.** This rule judges one file's calls. Whether a twin exists, and whether it is rendered, is
`SPLIT-5`.

## `connected-block-has-presentational-twin` — SPLIT-5

**What it reports.** `missing`, then it stops; otherwise one `bypass` per foreign tag, plus at most
one `unused`.

**How it detects.** Scope is the same normalised filename matched against
`/\/src\/components\/blocks\/(?:[^/]+\/)*([A-Z][A-Za-z0-9]*)\/index\.tsx$/`; capture group 1 is the
folder name and the twin is the string `_` + that name, derived and never configured. Three collectors
and one decision. `ImportDeclaration` sets `importsTwin` only when the source string is exactly
`./component` and one specifier has `imported.name === local.name === twin`; separately it adds every
specifier whose `imported.name` matches the world regex to a local-binding set, whatever the source.
`CallExpression` sets `readsWorld` when an `Identifier` callee is in that set or matches the regex
directly. `JSXOpeningElement` pushes every `JSXIdentifier` tag onto a rendered list and sets
`rendersTwin` on an exact match. `Program:exit` returns silently unless `readsWorld`.

**What it cannot see.** Laundering the world read disables the check entirely: if the index calls
`useOrderData()`, `readsWorld` stays false, `Program:exit` returns, and the block is invisible rather
than non-compliant — the two rules share one detector, so one launder defeats both. Rendering without
JSX, `createElement(Row, props)` beside a JSX `<_X />`, leaves an entire alternate tree undrawn in the
rendered list while `rendersTwin` is true. A namespaced tag, `<Ui.Card>`, is a `JSXMemberExpression`
and never enters the list. A path outside the one literal — `features/…`, `app/…`,
`components/blocks/…` without `src`, a lowercase folder, an entrypoint named `index.ts` — has no rule
on it. And the twin is never opened: `_X` may not exist, may fetch, may draw nothing. "Has
presentational twin" is decided from a NAME.

**Boundary.** This rule keys on `imported.name`, so an alias at the import still counts as reading the
world — the exact hole `presentational-purity` leaves open.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | Both scope tests rewrite backslashes to `/` before matching, so a Windows path decides the same way |
| out of scope | `create` returns an empty visitor object. The rule does not exist for that file rather than passing it |
| shared world regex | One union of four families, tested against a bare `Identifier` callee name; every open hatch below is a way of not being that |
| twin derivation | The twin name comes from the capitalised folder segment above `index.tsx`, and the import must match in both directions: same source string, same imported name, same local name |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `import {useTranslations as translate}` in the connected half | The twin rule keys on `imported.name`, not the local name |
| `<div><_X /></div>` | Every `JSXIdentifier` tag is collected, lowercase hosts included, so the wrapper is reported as `bypass` |
| Burying a block deep in sub-folders | The scope regex allows any number of intermediate segments |
| A Windows path with backslashes | Both scope tests normalise separators first |
| Moving the drawing half to another tier, same name | The scope anchors on a path-segment boundary, so `component.tsx` is in scope anywhere |
| `props={{label: useTranslations("x")("label")}}` | `CallExpression` visits the whole tree; nesting inside an attribute changes nothing |
| A thin block — one leaf, one tree, no local state | There is no thin-block branch in the code; `readsWorld` alone opens the check |
| Reading the world in one branch only | A single matching call anywhere in the file sets `readsWorld` for the whole file |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| both | **A member-expression callee.** The world arrives through a namespace and nothing is reported |
| both | **A wrapper hook with an ordinary name.** One file away, the same fetch becomes invisible |
| both | **All-caps suffix.** `useOrderSWR()` falls outside the exact `Swr` suffix |
| both | **A renamed default import.** A default specifier has no `imported` name to test |
| `presentational-purity` | **An alias local to the drawing half**, and **reaching through a child** rather than a call, and **any filename that is not `component.tsx`** |
| `connected-block-has-presentational-twin` | **A laundered world read**, **rendering without JSX**, **a namespaced tag**, **a path outside the one literal**, and **a twin that is never opened** |
| neither | **Everything `SPLIT-2`, `SPLIT-3`, `SPLIT-4` and `SPLIT-6` forbid** — styling decided in the connected half, four booleans instead of one named situation, a translation key crossing the line, a two-file split for a surface that fetches nothing |

That last row is the honest summary: of six codes, two are held, and the two that are held share a
single detector that any ordinarily-named wrapper function defeats.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path as the rule sees it, separators normalised to `/` |
| scope decision | Which filename test matched, or that none did |
| call names | Every `Identifier` callee in the file |
| import specifiers | Source string, `imported.name` and `local.name` per specifier |
| folder name | For a block index, the capitalised segment above `index.tsx` — it decides the twin |
| JSX tag names | Every `JSXIdentifier` opening tag; member-expression tags are not collected |

## Rules

1. The identity of a rule is its published name. There is no numeric identifier for a rule anywhere in
   this module.
2. Each rule reads exactly one file. Neither one opens the other half.
3. Neither rule takes an option: both declare `schema: []`. Severity is the only dial a repository has.
4. Out of scope means no visitor is installed, not that the file passed.
5. `presentational-purity` reports once per offending call.
6. The twin rule reports `missing` and stops, or else one `bypass` per foreign tag plus at most one
   `unused`.
7. A file the detector does not consider world-reading is never reported by the twin rule.
8. The twin name is derived from the folder, never configured, and the import must be exact in both
   directions.
9. The published severity is `error` for both.

## Exceptions

There are none in code. Neither rule declares an option, an allowlist, a thin-block branch or a
per-file opt-out, and the law states in words that one leaf, one tree in every state, no local domain
state and a forwarding twin are all still the same rule.

The only exit is a disable comment, and this module grants none. A repository that needs one is making
a rule change, which belongs in the module's history — not in a comment above the call.

## Output

One block per finding:

```text
file: <path as the rule sees it, forward slashes>
rule: <presentational-purity | connected-block-has-presentational-twin>
scope: <in | out — the filename test that decided it>
report: <reaches | missing | bypass | unused> at <node>
code: <SPLIT-1 | SPLIT-5>
hatch: <the open hatch that would have hidden this, or none>
```

## Worked example

**Input.** Two files of one block, `components/blocks/order/OrderTotal/`:

```tsx
// index.tsx
import {useTranslations} from "next-intl"
import {Row} from "./Row"

export function OrderTotal({id}) {
  const t = useTranslations("order")
  return <Row label={t("total")} />
}
```

```tsx
// component.tsx
export function _OrderTotal({label}) {
  const t = useTranslations("order")
  return <p>{label ?? t("fallback")}</p>
}
```

The index matches the block-index scope and reads the world, so the twin rule runs. `component.tsx`
matches the purity scope, so that rule runs too.

```text
file: src/components/blocks/order/OrderTotal/index.tsx
rule: connected-block-has-presentational-twin
scope: in — block index regex, folder OrderTotal, twin _OrderTotal
report: missing at Program:exit
code: SPLIT-5
hatch: none
```

`missing` stops the rule, so the `<Row />` tag is never reported as `bypass`. One finding, not two.

```text
file: src/components/blocks/order/OrderTotal/component.tsx
rule: presentational-purity
scope: in — /component\.tsx$/
report: reaches at CallExpression useTranslations
code: SPLIT-1
hatch: none
```

Repaired, the index imports the twin from `./component` and the drawing half takes the settled words
as props. But the same failure survives one rename:

```tsx
// index.tsx
import {useOrderCopy} from "./copy"
```

```text
file: src/components/blocks/order/OrderTotal/index.tsx
rule: connected-block-has-presentational-twin
scope: in — block index regex
report: none
code: SPLIT-5
hatch: a wrapper hook with an ordinary name leaves readsWorld false, so Program:exit returns and the block is invisible rather than compliant
```

## Scope

This module documents enforcement, not law. It names no product, no component library and no
repository. Rule names, message ids and the plugin prefix are identifiers that ship in build output
and are reproduced verbatim; everything written around them is ordinary markup and ordinary calls.
