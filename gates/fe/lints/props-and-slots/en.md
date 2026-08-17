---
title: Props-and-slots
---

# Props-and-slots

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
decides no props shape. It refuses one, and it must be able to point at the parameter, the key or the
attribute it refuses on.

## Law

A component's props are a CLOSED set of named slots, and that set is written as a type alias per tier
rather than assembled per component. What a caller may hand a component is therefore not a convention
anybody has to remember — it is the only thing that compiles. Five slots exist across the whole
system and no component has all five: `props` is what it draws, `on` is what it does, `contract` is
the key it renders and `render` is one named component per slot that key declares, and `isLoading` is
handed down, never decided locally.

The law states **seven codes**, `SLOTS-1` through `SLOTS-7`. **Three of them have a rule.** That is
not a coverage accident, it is the arrangement the law wants: the slot aliases in `props.ts` are the
fence, a fifth slot fails to compile rather than failing review, and there is nothing left for a rule
to patrol once the shape itself refuses. The rules exist exactly where a type has nothing to look at
— a shape with no NAME, a `children` hole hand-written beside the aliases instead of inside them, and
a generic `items` lane on a shared surface. This module records that enforced third honestly,
including the places where the enforcement is thinner than the name suggests.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-inline-parameter-type` | `SLOTS-3` | `inline` — a function parameter whose declared type contains an anonymous object shape, including inside parentheses, intersections and unions |
| `no-children-slot` | `SLOTS-4` | `slot` — a `children` member declared in a type, or a `children` key destructured in a parameter, inside a governed component file |
| `no-surface-list-items-slot` | `SLOTS-7` | `items` — an `items` JSX attribute on a tag bound to `SurfaceListCard` imported from the one literal path |

`SLOTS-1` (the data slot carries data, never a function, a component or any value carrying
behaviour), `SLOTS-2` (a component's data is declared with a type alias, never an `interface`),
`SLOTS-5` (a component below the request owner receives `isLoading` and never decides its own waiting
state) and `SLOTS-6` (appearance is a named variant decided inside, never `className`, `style`,
spacing props or per-part styling hooks) have **no rule at all** here. Three of them are held
elsewhere — `SLOTS-1`, `SLOTS-2` and `SLOTS-6` are `unrepresentable`, held by `DataValue`, by the
`D extends ComponentData` constraint and by the three closed tier aliases in `@starci/eslint-canon-fe/props` —
and `SLOTS-5` is `documented`, held by nothing at all. A green run of this module says nothing about
any of the four, and where the type never covered the file the code is simply unenforced rather than
covered.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means no visitor was installed and the rule did not exist for that file.
   `no-inline-parameter-type` installs no path gate at all and therefore has no out-of-scope state;
   `no-children-slot` needs `isGoverned`; `no-surface-list-items-slot` needs `/src/` in the path.
2. **Check the exemptions before reading a node.** The contract registry file is exempt from
   `no-children-slot` because its `children` member describes the closed child grammar. Framework
   route files sit outside the component tier and may receive ReactNode, provided they close it into
   a named projection before component composition. There are no component-folder exemptions.
3. **Read the nodes the rule actually visits.** A declared parameter type annotation; a
   `TSPropertySignature` key or an `ObjectPattern` property key; an import specifier and then a JSX
   attribute name. A node the visitor never reaches is unjudged, not clean.
4. **Emit one block per finding**, on the node the rule reports on — the type annotation, the
   `children` identifier, the whole `items` attribute.
5. **Write the `hatch` line** whenever an open hatch below would have hidden the same failure. A
   `Readonly<{…}>` parameter, a `PropsWithChildren` props type and a barrel import of the surface all
   pass, and none of them is compliance.
6. **Do not report what no rule watches.** Four of the seven codes have no machine here; a verdict
   that claims otherwise is wrong about the module.

## `no-inline-parameter-type` — SLOTS-3

**What it reports.** `inline` — one report per offending parameter, on `param.typeAnnotation` when
there is one and on the parameter itself otherwise.

**How it detects.** There is no filename test: `create` installs visitors for every file the parser
hands it. Four visitors share one `checkParams` walker — `ArrowFunctionExpression`,
`FunctionExpression`, `FunctionDeclaration` and `TSEmptyBodyFunctionExpression`. For each parameter
it reads `param.typeAnnotation?.typeAnnotation` and runs `isInlineObjectType`, which answers true for
a `TSTypeLiteral`, recurses through a `TSParenthesizedType`, and returns true when any member of a
`TSIntersectionType` or `TSUnionType` answers true. Everything else is false.

**What it cannot see.** A parameter with no annotation at all: `declared` is undefined, the walk
returns false immediately, and an untyped destructure is invisible. A shape one wrapper away —
`Readonly<{label: string}>`, `Partial<{…}>`, `{…}[]` — is a `TSTypeReference` or a `TSArrayType`, and
the walker recurses through parentheses, intersections and unions only, so one ordinary utility type
defeats it. The NAME is read, not checked: any named type passes, including one that is not `XProps`
for component `X`, and including a `type X = {…}` alias declared three lines above and used once. A
shape assembled after the parameter — destructured in the body, or spread into a local — never
reaches a parameter annotation. And because there is no scope gate, the rule fires in test files,
fixtures and tooling exactly as it fires in product source; a repository that dislikes that turns the
severity down and loses the whole code.

**Boundary.** This rule judges the shape at the parameter. Whether the named type it points to is the
right tier alias, and whether that alias admits a fourth slot, is the type's job and not a finding
here.

## `no-children-slot` — SLOTS-4

**What it reports.** `slot` — one report per `children` node, on the key identifier.

**How it detects.** `create` returns `{}` unless `isGoverned` accepts the filename. `isGoverned`
normalises backslashes to `/`, returns false for `isContractTableFile(path)`, and otherwise requires
`COMPONENT_ROOTS.filter((root) => root !== "src").some((root) => path.includes("/" + root + "/"))` —
that is, `/src/components/` or `/packages/ui/src/`, with the bare `src` catch-all dropped here and
only here, because used as a fence it matches every file under `src/` and reports a routed page for
taking children, the one thing a page legitimately does. In scope there are two visitors.
`TSPropertySignature` reports when `node.key.type === "Identifier"` and `node.key.name === "children"`.
`Property` reports the same key when its parent is an `ObjectPattern` and its grandparent is not a
`VariableDeclarator` — a destructured `children` in a parameter, which is the same slot arriving by
another door, while `const {children} = props` in a body is deliberately let through.

**What it cannot see.** A quoted member, `"children": ReactNode`, whose key is a `Literal` rather
than an `Identifier`, and a computed key likewise. A children hole under any other name —
`content: ReactNode`, `body: ReactNode`, `trigger: ReactNode` — because the rule matches one
identifier and nothing about ReactNode. `PropsWithChildren<XData>`, or any imported props type that
carries the member, because the rule never opens another file. The positive half of the code is
unwatched entirely: nothing here checks that a container declares `contract` and `render` together,
and nothing sees a closed shape that grows `render`. And the tier gate is a path: the same component
filed under `apps/web/features/…`, or under a `ui/` that is neither component root, has no rule
on it — the layout literal is the cheapest thing in a repository to change.

**Boundary.** This rule sees the markup hole and only the markup hole. `BranchProps` holds the
positive half, and the shells that hand an interior straight to vendor mechanics are exempt in the
law's words rather than in this rule's code.

## `no-surface-list-items-slot` — SLOTS-7

**What it reports.** `items` — one report per offending attribute, on the whole `JSXAttribute`.

**How it detects.** Scope is `context.filename` with backslashes rewritten to `/`, required to
`includes("/src/")`; anything else gets an empty visitor object. In scope the rule keeps a local
`bindings` set. `ImportDeclaration` normalises the source string and tests it against
`/(?:^|\/)components\/branches\/SurfaceListCard$/`; for a matching source it adds `specifier.local.name`
for every specifier whose `imported.name` is exactly `SurfaceListCard`. `JSXOpeningElement` takes the
tag name only when `node.name.type === "JSXIdentifier"`, requires it to be in `bindings`, and then
reports every attribute of type `JSXAttribute` whose `name.type === "JSXIdentifier"` and whose
`name.name` is `items`.

**What it cannot see.** Any other shared surface — `SurfaceCard`, `SurfaceAccordionCard`,
`SurfaceFormCard` — because the rule is bound to one import path. Any other spelling of that path: a
barrel (`@/components/branches`), a re-export, a relative path with an extension
(`./SurfaceListCard.tsx`), or a default import, which carries no `imported` name to compare. A
namespaced tag, `<Ui.SurfaceListCard items={…} />`, is a `JSXMemberExpression` and never matches. An
indirection — `const List = SurfaceListCard` then `<List items={…} />` — is not in `bindings`. A
spread, `<SurfaceListCard {...{items}} />`, is a `JSXSpreadAttribute` and has no attribute name. And
the lane itself survives a rename: `rows`, `entries`, `data` are a generic collection lane under
another word, and only the literal `items` is watched.

**Boundary.** This rule judges one attribute on one imported surface. Whether the collection that
moved into `props` is named for its domain, and whether the surface learned that domain anyway, is a
reader's question.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | `no-children-slot` and `no-surface-list-items-slot` rewrite backslashes to `/` before matching, so a Windows path decides the same way. `isInlineObjectType` reads no path at all |
| out of scope | `create` returns an empty visitor object. The rule does not exist for that file rather than passing it |
| component roots | `COMPONENT_ROOTS = ["src/components", "packages/ui/src", "src"]`, imported from `contract.mjs`; `isGoverned` drops the bare `src` entry and matches the remaining two as `/<root>/` anywhere in the path |
| registry exemption | `isContractTableFile(path)` — `contracts/index.ts` under any supported root — switches `no-children-slot` off for that file |
| shape walk | `isInlineObjectType` answers true on `TSTypeLiteral`, recurses through `TSParenthesizedType`, and maps `some` over `TSIntersectionType` and `TSUnionType` members. Nothing else is opened |
| surface binding | One import-source regex, `/(?:^|\/)components\/branches\/SurfaceListCard$/`, plus an exact `imported.name === "SurfaceListCard"`, produces the set of local tag names the JSX visitor will look at |
| reach outside the file | None. All three rules read one file; no rule opens an imported type, a re-export or the surface component itself |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `({label}: {label: string} & Base) => …` | `isInlineObjectType` maps over intersection members, so one anonymous half is enough |
| `({label}: ({label: string})) => …` | The parenthesised type is unwrapped before the test |
| A method signature with no body, in a declaration file | `TSEmptyBodyFunctionExpression` is one of the four visited function forms |
| `interface XProps { children?: ReactNode }` | `TSPropertySignature` visits interface members and type-literal members alike |
| `function X({children, ...rest}: XProps)` | A destructured `children` in a parameter is reported as the same slot arriving by another door |
| The same component in a monorepo at `packages/ui/src/...` | `COMPONENT_ROOTS` carries that layout, so the fence holds in both repositories rather than silently in neither |
| A Windows path with backslashes | Both scope tests normalise separators first |
| `import {SurfaceListCard as ListCard}` then `<ListCard items={…} />` | The binding set keys on `imported.name` and stores the local name, so an alias is still watched |
| `<SurfaceListCard items={tasks} className="…" />` | Every `JSXAttribute` on the matched tag is scanned; the other attributes change nothing |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `no-inline-parameter-type` | **A parameter with no annotation**, **a shape one utility type away** — `Readonly<{…}>`, `Partial<{…}>`, `{…}[]` — and **any name at all**, since `XProps` for component `X` is read and never checked |
| `no-children-slot` | **A quoted or computed key**, **a markup hole under another name** such as `content: ReactNode`, **`PropsWithChildren` or any imported props type**, **`const {children} = props` in a body**, **a path outside the two component roots**, and **the entire positive half** — nothing checks that `contract` and `render` appear together, or that a closed shape has not grown `render` |
| `no-surface-list-items-slot` | **Every other shared surface**, **a barrel, a re-export, an extension in the path or a default import**, **a namespaced tag**, **an indirect binding**, **a spread attribute**, and **the same generic lane spelled `rows`, `entries` or `data`** |
| none | **Everything `SLOTS-1`, `SLOTS-2`, `SLOTS-5` and `SLOTS-6` forbid** — a handler travelling inside `props`, a data shape declared with `interface`, a component deciding its own waiting state, and `className`, `style`, spacing props or per-part styling hooks. Three of those are held by a type wherever the tier alias is used; a hand-written props type that never used a tier alias is held by nothing, and `SLOTS-5` is held by nothing anywhere |

That last row is the honest summary: of seven codes, three are held by a rule here, three by a shape
that only holds where the shape was used, and one by a reader.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path as the rule sees it, separators normalised to `/` |
| scope decision | Which gate matched — `isGoverned`, `/src/`, or no gate at all — or that none did |
| parameter annotations | Every function parameter's `typeAnnotation.typeAnnotation`, and the node kind at each level of it |
| property keys | Every `TSPropertySignature` key, and every `ObjectPattern` property key, with its parent and grandparent node types |
| import specifiers | The normalised source string, `imported.name` and `local.name` per specifier |
| JSX tag and attributes | Every `JSXIdentifier` opening tag, and each `JSXAttribute` name on the tags that matched a binding |

## Rules

1. The alias is the whole shape; there is no fourth slot to add.
2. Data and behaviour travel in different slots.
3. Every parameter shape has a name in the module that declares it.
4. `contract` and `render` appear together or not at all.
5. The layer that owns a request writes `isLoading` and never receives one.
6. Appearance is decided inside the component, under a name.
7. A shared surface learns no caller's collection model.
8. One tier alias per component; a component that needs a different one has chosen the wrong tier.
9. The identity of a rule is its published name. The `SLOTS-<n>` code names the situation, is stable,
   is cited from outside the module, and is never renumbered.
10. No rule takes an option: all three declare `schema: []`. Severity is the only dial a repository
    has, and the published level is `error` for all three under the `starci-fe/` prefix.
11. Each rule reads exactly one file. No rule opens an imported type or the surface component.
12. Out of scope means no visitor is installed, not that the file passed.
13. `no-inline-parameter-type` reports once per offending parameter; `no-children-slot` once per
    `children` node; `no-surface-list-items-slot` once per offending attribute.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it releases.

- **The registry table.** `SLOTS-4` does not apply to the contract table itself, where a named child
  grammar describes what a key admits. Reporting it would ask the file that abolished the anonymous
  hole to stop describing what replaced it. This one is in code: `isContractTableFile` short-circuits
  `isGoverned`.
- **Outside the component tiers.** A routed page is not governed by `SLOTS-4`; taking what a
  framework hands it is the one thing a page legitimately does. Framework route files may receive
  ReactNode, and must close it into a named projection before component composition. This one is in
  code too, as the dropped bare `src` root.
- **The closed shells.** `SLOTS-4` exempts the shells that hand an interior straight to vendor
  mechanics — modal, drawer and dropdown — because they arrange nothing and cannot refuse a shape the
  vendor declares. The list is four files, by name; there is no folder-wide exemption. This exemption
  lives in the law's words and not in the rule: a shell filed inside the component tier is reported
  by `no-children-slot` like anything else.
- **Two lanes for `render`.** `SLOTS-4` is satisfied by bound slots and by a stable branded component
  type. Which lane applies is decided by whether the runtime data repeats, not by preference. No rule
  reads either lane.
- **A scalar parameter.** `SLOTS-3` governs shapes. A parameter typed `string` is not a shape with
  nowhere to be read from and needs no alias — and `isInlineObjectType` answers false for it without
  needing to be told.

No rule declares an option, an allowlist or a per-file opt-out. The only remaining exit is a disable
comment, and this module grants none. A repository that needs one is making a rule change, which
belongs in the module's history — not in a comment above the parameter.

## Output

One block per finding:

```text
file: <path as the rule sees it, forward slashes>
rule: <no-inline-parameter-type | no-children-slot | no-surface-list-items-slot>
scope: <in | out — the gate that decided it, or "no gate">
report: <inline | slot | items> at <node>
code: <SLOTS-3 | SLOTS-4 | SLOTS-7>
hatch: <the open hatch that would have hidden this, or none>
```

A clean file in scope emits one block per rule that ran, with `report: none` and `hatch: none`. A file
out of scope emits one block per rule with `scope: out` and `report: unjudged` — never `report: none`,
because no visitor looked.

## Worked example

**Input.** One branch inside the component tier, `components/branches/ModalBranch/index.tsx`, and
one call site under `app/tasks/page.tsx`:

```tsx
// src/components/branches/ModalBranch/index.tsx
type ModalBranchProps = { readonly children?: ReactNode }

export function ModalBranch({ children }: ModalBranchProps) {
  return <VendorModal>{children}</VendorModal>
}

export const ModalTitle = ({ text }: { readonly text: string } & Sized) => <h2>{text}</h2>
```

```tsx
// src/app/tasks/page.tsx
import { SurfaceListCard } from "@/components/branches/SurfaceListCard"

export default function TasksPage() {
  return <SurfaceListCard items={tasks} contract="task-list" render={render} />
}
```

The branch file is under `/src/components/` and is not the contract table, so `isGoverned` accepts it
and `no-children-slot` runs; `no-inline-parameter-type` runs on both files because it has no gate;
both files contain `/src/`, so `no-surface-list-items-slot` is in scope for both.

```text
file: src/components/branches/ModalBranch/index.tsx
rule: no-children-slot
scope: in — isGoverned, root src/components, not the contract table
report: slot at TSPropertySignature children
code: SLOTS-4
hatch: none
```

```text
file: src/components/branches/ModalBranch/index.tsx
rule: no-children-slot
scope: in — isGoverned, root src/components, not the contract table
report: slot at Property children in ObjectPattern
code: SLOTS-4
hatch: none
```

Two findings, not one: the declared member and the destructured key are the same slot arriving by two
doors, and each is reported where it is written.

```text
file: src/components/branches/ModalBranch/index.tsx
rule: no-inline-parameter-type
scope: in — no gate; this rule visits every parsed file
report: inline at TSTypeAnnotation of ({ text }) in ModalTitle
code: SLOTS-3
hatch: none
```

```text
file: src/app/tasks/page.tsx
rule: no-surface-list-items-slot
scope: in — filename includes /src/, binding SurfaceListCard from @/components/branches/SurfaceListCard
report: items at JSXAttribute items
code: SLOTS-7
hatch: none
```

Repaired, the branch declares `contract` and `render` and hands the interior on as a named
projection, the title takes a named props type, and the collection travels inside `props` under its
domain name:

```tsx
// src/components/branches/ModalBranch/index.tsx
type ModalBranchProps = {
  readonly contract: ModalContract
  readonly render: ModalRender
}

type ModalTitleProps = { readonly text: string } & Sized

export function ModalBranch({ contract, render }: ModalBranchProps) {
  return <Tree contract={contract} render={render} />
}

export const ModalTitle = ({ text }: ModalTitleProps) => <h2>{text}</h2>
```

```tsx
// src/app/tasks/page.tsx
import { SurfaceListCard } from "@/components/branches"

export default function TasksPage() {
  return <SurfaceListCard props={{ tasks }} contract="task-list" render={render} />
}
```

The repair is real, and two of these rules would have stayed silent for the wrong reason. Change the
import to the barrel and nothing binds:

```text
file: src/app/tasks/page.tsx
rule: no-surface-list-items-slot
scope: in — filename includes /src/
report: none
code: SLOTS-7
hatch: the import source must end exactly with components/branches/SurfaceListCard, so a barrel import leaves bindings empty and the tag is never examined — the lane is invisible rather than absent
```

And the same shape survives one utility type at the parameter:

```tsx
export const ModalTitle = ({ text }: Readonly<{ text: string }>) => <h2>{text}</h2>
```

```text
file: src/components/branches/ModalBranch/index.tsx
rule: no-inline-parameter-type
scope: in — no gate
report: none
code: SLOTS-3
hatch: the annotation is a TSTypeReference and isInlineObjectType recurses only through parentheses, intersections and unions, so the shape still has no name and nothing reports it
```

## Scope

This module documents enforcement, not law. It names no product, no component library and no
repository. Rule names, message ids, code tokens and the plugin prefix are identifiers that ship in
build output and are reproduced verbatim; everything written around them is ordinary TSX. What the
type holds — `SLOTS-1`, `SLOTS-2`, `SLOTS-6` — belongs to `@starci/eslint-canon-fe/props`, and what nothing
holds — `SLOTS-5` — belongs to a reader.
