---
id: fe-lints-the-split-index
title: INDEX.md
slug: /fe/lints/the-split
sidebar_label: the-split
sidebar_position: 0
description: What the two published rules of the split can actually see in a syntax tree, and what they cannot.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `the-split`

## Law

A surface that owns a request is two files. One fetches, settles which situation the reader is in and
resolves the words; the other takes an already-settled situation and draws it. The line exists so
that everything that can be wrong about DATA sits in one file and everything that can be wrong about
DRAWING sits in the other.

The law states six codes. **Two of them have a rule.** That is not an accident of coverage, it is the
shape of the problem: a file that fetches, reads a store or resolves a word is visible in what it
calls, while a file that draws badly looks exactly like one that draws well. This module records the
enforced half honestly, including the places where the enforcement is thinner than the name suggests.

## Rules

| Rule | Code | What it reports |
|---|---|---|
| `presentational-purity` | `SPLIT-1` | `reaches` — a call by name from one of four world-reading families, made inside the drawing half |
| `connected-block-has-presentational-twin` | `SPLIT-5` | `missing` — a connected block index reads the world but does not import exact `_<Folder>` from `./component`<br />`bypass` — it renders some other JSX tag<br />`unused` — it imports the twin and never renders it |

Both rules map to a code the law states. No rule here enforces something the law does not say, and no
rule is left without a code.

`SPLIT-2` (styling stays in the drawing half), `SPLIT-3` (the situation crosses as a name, not a bag
of flags), `SPLIT-4` (copy is resolved before it crosses) and `SPLIT-6` (a surface with no request
does not split) have **no rule at all**. They are unenforced by design and are listed in
`audit.md`, not softened here.

## Detection

| Rule | Mechanism |
|---|---|
| `presentational-purity` | **Scope**: `context.filename` (falling back to `context.getFilename()`), backslashes rewritten to `/`, tested against `/(?:^|\/)component\.tsx$/`. Out of scope the `create` returns an empty visitor object — the rule does not exist rather than passing. **In scope**: one visitor, `CallExpression`. It requires `node.callee.type === "Identifier"` and tests `callee.name` against a single union regex of four families: `useSWR` / `useSWRMutation` / `use…Swr`; `useAppSelector` / `useDispatch` / `use…Store`; `useTranslations` / `useLocale` / `useFormatter`; `query<Capital>…` / `mutation<Capital>…`. The report is anchored on the call node and interpolates the matched name. |
| `connected-block-has-presentational-twin` | **Scope**: the same normalised filename matched against `/\/src\/components\/blocks\/(?:[^/]+\/)*([A-Z][A-Za-z0-9]*)\/index\.tsx$/`. Capture group 1 is the folder name; the twin is the string `_` + that name, derived, never configured. **Three collectors and one decision.** `ImportDeclaration`: sets `importsTwin` only when the source string is exactly `./component` and one specifier has `imported.name === local.name === twin`; separately adds every specifier whose `imported.name` matches the world regex to a local-binding set, whatever the source. `CallExpression`: sets `readsWorld` when an `Identifier` callee is in that set or matches the regex directly. `JSXOpeningElement`: pushes every `JSXIdentifier` tag name onto a rendered list and sets `rendersTwin` on an exact match. `Program:exit`: returns silently unless `readsWorld`; then reports `missing` and stops, or reports `bypass` once per foreign tag and `unused` if the twin was never rendered. |

## Escape Hatches

### Closed

| A reader might expect this to slip past | Why it does not |
|---|---|
| Aliasing a world hook at the import in the connected half — `import { useTranslations as translate }` | The twin rule keys on `imported.name`, not the local name, so the alias still counts as reading the world |
| Wrapping the twin in a plain host element — `<div><_X /></div>` | Every `JSXIdentifier` tag is collected, lowercase host tags included, so the wrapper is reported as `bypass` |
| Burying a block deep in sub-folders | The scope regex allows any number of intermediate segments, so depth does not hide a block index |
| A Windows path with backslashes | Both scope tests normalise separators before matching |
| Moving the drawing half to another tier while keeping its name | The scope anchors on a path-segment boundary, not a folder, so `component.tsx` is in scope anywhere |
| Calling the world inline inside a JSX attribute — `props={{ label: useTranslations("x")("label") }}` | `CallExpression` visits the whole tree; nesting inside an attribute changes nothing |
| A thin block — one leaf, one tree, no local state | There is no thin-block branch in the code; `readsWorld` alone opens the check |
| Reading the world in one branch only | A single matching call anywhere in the file sets `readsWorld` for the whole file |

### Open

| A way of writing this genuinely does NOT catch | Rule | What actually happens |
|---|---|---|
| **A member-expression callee** — `hooks.useTranslations()`, `store.useAppSelector()`, `client.queryOrder()` | both | The visitor returns the moment `callee.type !== "Identifier"`. The world arrives through a namespace and nothing is reported |
| **A wrapper hook with an ordinary name** — `useOrderData()`, `useRowsFor(id)`, `loadSummary()` | both | None of the four families match. This is the standard tidying move: one file away, the same fetch becomes invisible |
| **All-caps suffix** — `useOrderSWR()` | both | The family requires the exact suffix `Swr`; `SWR` falls outside |
| **An alias local to the drawing half** — `import { useTranslations as translate }` then `translate("x")` | `presentational-purity` | This rule never reads imports at all. The twin rule closes exactly this hole; the purity rule does not |
| **Reaching through a child instead of a call** — the drawing half imports a connected block index and renders `<OrderTotal />` | `presentational-purity` | The rule watches `CallExpression`. A JSX child that fetches produces no call in this file |
| **Filename scoping** — `view.tsx`, `presentation.tsx`, `Component.tsx`, `component.jsx` | `presentational-purity` | The rule stops existing. Filename is the cheapest thing in a repository to change |
| **Laundering the world read disables the twin check entirely** — the connected index calls `useOrderData()` | `connected-block-has-presentational-twin` | `readsWorld` stays false, `Program:exit` returns, and the block is invisible rather than non-compliant. The two rules share one detector, so one launder defeats both |
| **A default import renamed** — `import swr from "…"` then `swr(key, fetcher)` | both | A default specifier has no `imported` name to test, and the local name does not match the regex |
| **Rendering without JSX** — `createElement(Row, props)` beside a JSX `<_X />` | `connected-block-has-presentational-twin` | `rendered` holds only the twin and `rendersTwin` is true, so an entire alternate tree draws with no report |
| **A namespaced tag** — `<Ui.Card>`, `<Icons.Spinner>` | `connected-block-has-presentational-twin` | `node.name.type` is `JSXMemberExpression`, the visitor returns before pushing, and the tag never enters the rendered list |
| **A path outside the one literal** — `src/features/…`, `src/app/…`, `components/blocks/…` without `src`, a lowercase folder name, or an entrypoint named `index.ts` | `connected-block-has-presentational-twin` | The scope regex does not match, so there is no rule on that file |
| **The twin is never opened** — `_X` may not exist, may fetch, may draw nothing | `connected-block-has-presentational-twin` | The check is satisfied by an import string and a tag name. "has presentational twin" is decided from a NAME |
| **Everything `SPLIT-2`, `SPLIT-3`, `SPLIT-4` and `SPLIT-6` forbid** — styling decided in the connected half, four booleans instead of one named situation, a translation key crossing the line, a two-file split for a surface that fetches nothing | neither | No rule watches any of it |

The last row is the honest summary of this module: of six codes, two are held, and the two that are
held share a single detector that any ordinarily-named wrapper function defeats.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path as the rule sees it, separators normalised to `/` |
| scope decision | Which filename test matched, or that none did |
| call names | Every `Identifier` callee in the file |
| import specifiers | Source string, `imported.name` and `local.name` per specifier |
| folder name | For a block index, the capitalised segment above `index.tsx` — it decides the twin |
| JSX tag names | Every `JSXIdentifier` opening tag; member-expression tags are not collected |

## Invariants

- The identity of a rule is its published name. There is no numeric identifier for a rule anywhere in
  this module.
- Each rule reads exactly one file. Neither one opens the other half.
- Neither rule takes an option: both declare `schema: []`. Severity is the only dial a repository has.
- Out of scope means no visitor is installed, not that the file passed.
- `presentational-purity` reports once per offending call.
- The twin rule reports `missing` and stops, or else one `bypass` per foreign tag plus at most one
  `unused`.
- A file the detector does not consider world-reading is never reported by the twin rule.
- The twin name is derived from the folder, never configured, and the import must be exact in both
  directions: same source string, same imported name, same local name.
- The published severity is `error` for both.

## Exceptions

There are none in code. Neither rule declares an option, an allowlist, a thin-block branch or a
per-file opt-out, and the law states in words that one leaf, one tree in every state, no local domain
state and a forwarding twin are all still the same rule.

The only exit is a disable comment, and this module grants none. A repository that needs one is
making a rule change, which belongs in `changelog.md` — not in a comment above the call.

## Output

```text
file: <path as the rule sees it, forward slashes>
rule: <presentational-purity | connected-block-has-presentational-twin>
scope: <in | out — the filename test that decided it>
report: <reaches | missing | bypass | unused> at <node>
code: <SPLIT-1 | SPLIT-5>
hatch: <the open hatch that would have hidden this, or none>
```

## Load Policy

Read this file first. Read `vi.md` for what each rule is for and why it is worth a machine, read
`example.md` for the code that fires and the code that slips through, and read `audit.md` only while
reviewing the enforcement itself.

## Scope

This module documents enforcement, not law. It names no product, no component library and no
repository. Rule names, message ids and the plugin prefix are identifiers that ship in build output
and are reproduced verbatim; everything written around them is ordinary markup and ordinary calls.

## Version Rule

Increment all five records by `0.01` for an accepted change to a rule, a detection mechanism or a
recorded hatch, and record it in `changelog.md`.
