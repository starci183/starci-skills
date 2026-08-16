---
id: fe-lints-props-and-slots-index
title: INDEX.md
slug: /fe/lints/props-and-slots
sidebar_label: props-and-slots
sidebar_position: 0
description: What the three props-and-slots lint rules can see, what they report, and the ways of writing they do not catch.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `props-and-slots`

## Law

The law is [`patterns/props-and-slots.md`](../../canon/patterns/props-and-slots.md). A component's
props are a closed set of named slots, written as a type alias per layer rather than assembled per
component.

**Almost all of that law is held by a TYPE, not by a rule.** The slot aliases are the fence: a fifth
slot does not fail review, it fails to compile. This module is small because there is nothing left
for a rule to patrol once the shape itself refuses.

Three things remain that a type cannot see, and they are the three rules here:

- a shape with no NAME — an inline object type at the parameter satisfies every constraint an alias
  imposes and is still wrong, because nothing else can refer to it;
- a props shape written by HAND — the alias refuses a fourth slot, but nothing stops a file
  declaring its own interface and putting `children` in it;
- an attribute at a CALL SITE — a second runtime-data lane opened beside the data slot.

This record documents ENFORCEMENT, not the law. It states what a machine sees, and, in
`## Escape Hatches`, what it does not.

## Rules

Three rules are published. Their identity is the name under which each ships; there is no numeric
code for a rule, because the name is what a build log prints, what a disable comment names, and what
every conversation about the failure uses.

| Rule | Law code | What it reports |
|---|---|---|
| `no-inline-parameter-type` | `SLOTS-3` | A function parameter whose declared type contains an anonymous object shape — directly, inside parentheses, or inside an intersection or union. Reported at the type annotation. Severity `suggestion`. |
| `no-children-slot` | `SLOTS-4` | A property signature named `children` in a governed component file, or a `children` key destructured in a function parameter there. Reported at the key. Severity `problem`. |
| `no-surface-list-items-slot` | `SLOTS-7` | An `items` JSX attribute on an element bound to the `SurfaceListCard` named import. Reported at the whole attribute. Severity `problem`. |

Four codes in the law have no rule in this module: `SLOTS-1` (no function in the data slot),
`SLOTS-2` (data declared with a type alias, never an interface), `SLOTS-5` (`isLoading` is received,
never decided) and `SLOTS-6` (there is no appearance slot). `SLOTS-1` and `SLOTS-2` are held by the
data fence in the props types — an interface silently fails that fence, and the failure is a compile
error rather than a report. `SLOTS-5` and `SLOTS-6` are unheld here and are recorded in
[`audit.md`](./audit.md) rather than quietly implied.

Every rule that exists maps to exactly one code. No rule here enforces a code the law does not
carry.

## Detection

| Rule | Mechanism |
|---|---|
| `no-inline-parameter-type` | Visits `ArrowFunctionExpression`, `FunctionExpression`, `FunctionDeclaration` and `TSEmptyBodyFunctionExpression`. For each entry in `node.params`, reads `param.typeAnnotation.typeAnnotation` and asks whether it is an anonymous shape: `TSTypeLiteral` is true; `TSParenthesizedType` recurses into `typeAnnotation`; `TSIntersectionType` and `TSUnionType` recurse into `types` and are true if ANY member is. No filename gate, no import graph, no type information. |
| `no-children-slot` | Gated first by a filename predicate over `context.filename`, backslashes normalised to `/`. The gate refuses the contract table file, refuses four shell folders (`ModalShell`, `DrawerShell`, `DropdownShell`, `RouteShell`) matched as a component tier, and then requires the path to contain one of the component roots other than the bare `src` root. Inside a governed file it visits `TSPropertySignature` and reports when `node.key.type === "Identifier"` and `node.key.name === "children"`; and visits `Property`, returning early unless `node.parent.type === "ObjectPattern"`, returning early when `node.parent.parent.type === "VariableDeclarator"`, then reporting the same `Identifier` key. |
| `no-surface-list-items-slot` | Requires the normalised filename to contain `/src/`. Collects bindings from `ImportDeclaration` whose `source.value` matches `/(?:^|\/)components\/branches\/SurfaceListCard$/`, keeping only specifiers whose `imported.name` is exactly `SurfaceListCard`, and storing `specifier.local.name`. Then visits `JSXOpeningElement`, requires `node.name.type === "JSXIdentifier"` and the name to be in that binding set, and iterates `node.attributes` reporting any entry whose `type` is `JSXAttribute` and whose `name.name` is `items`. |

Two facts govern everything in the next section. **No rule here has type information** — none resolves
an imported alias, so a shape declared in another file is invisible. And **two of the three rules
match an identifier spelled a particular way** — not a shape, not a category.

## Escape Hatches

### Closed

| Way of writing | Why it does not slip past |
|---|---|
| `({ a }: ({ a: string }))` — parentheses around the inline shape | `isInlineObjectType` recurses through `TSParenthesizedType`, so the wrapper is walked, not stopped at. |
| `(input: Frame & { readonly label: string })` — hiding the anonymous half in an intersection | Intersections and unions are walked member by member; one anonymous member is enough to report. |
| `({ props }: { props: { label: string } })` — nesting the shape one level down | The parameter's own annotation is already a `TSTypeLiteral`; the outer shape reports before nesting matters. |
| A second, third or curried parameter carrying the inline shape | Every entry in `node.params` is checked, not just the first. |
| `type P = { children?: ReactNode }` instead of an interface | A member of a type literal is a `TSPropertySignature` exactly like an interface member; both are visited. |
| `({ children: content }: P)` — renaming the binding while destructuring | The reported node is the property KEY, which is still `children`; the local name is never read. |
| `({ props: { children } }: P)` — burying the destructure one object deep | The inner pattern is still an `ObjectPattern`, and its grandparent is a `Property`, not a `VariableDeclarator`, so the early return does not apply. |
| A component parked in a shell-shaped folder that is not one of the four | The exemption list is four literal names; `shells/PopoverShell/index.tsx` is governed and reports. |
| A monorepo keeping the same tier at `packages/ui/src/*` | The roots list carries both layouts, so the gate is not a hand-written `/src/components/` literal. This was wrong once, and the repository reported zero violations, which read as compliance and was silence. |
| `import { SurfaceListCard as List } from "…/components/branches/SurfaceListCard"` | The binding set stores the LOCAL name, so the alias is tracked and `<List items={…} />` reports. |

### Open

| Way of writing | Why the rule does not catch it |
|---|---|
| `(input: Readonly<{ label: string }>)` — or `Partial<…>`, `Array<{…}>`, `{ label: string }[]` | `isInlineObjectType` walks type literals, parentheses, intersections and unions, and nothing else. A `TSTypeReference` with an anonymous shape in its type arguments, and a `TSArrayType` over one, are not inspected. `Readonly<…>` is idiomatic wherever the codebase writes `readonly` members, so this is the likeliest accident of the three. |
| `<T extends { label: string }>(input: T)` | The parameter's annotation is a `TSTypeReference` to `T`. The anonymous shape is in the type PARAMETER's constraint, which is never visited. The shape has no name and no rule sees it. |
| `type Handler = (input: { label: string }) => void` | `TSFunctionType` is not among the visited nodes. A props-shaped object hidden in a callback type is a parameter shape with no name, in a position no visitor reaches. |
| `const shape = input as { label: string }` inside the body | Only `param.typeAnnotation` is read. Anything asserted, inferred or narrowed inside the function is outside the rule entirely. |
| A parameter with no annotation at all, typed contextually by an assignment | There is nothing at the parameter to inspect. `const f = ({ a }) => a` is explicitly valid, and a contextual type supplies the anonymous shape from elsewhere. |
| `interface CardProps extends PropsWithChildren<CardData> {}` | `no-children-slot` sees property SIGNATURES written in this file. A `children` slot inherited from an imported type, or supplied by a helper type, produces no `TSPropertySignature` named `children` anywhere the rule can look — and the rule has no type information to resolve the extension. |
| `const Card = (props: CardProps) => <div>{props.children}</div>` | Nothing is destructured at the parameter, so no `Property` fires; if `CardProps` is imported, no signature fires either. A `MemberExpression` reading `children` is not visited. The slot arrives and is used, and the file is green. |
| `const { children } = props` on the first line of the body | The `Property`'s grandparent is a `VariableDeclarator`, which is an explicit early return. Destructuring in the body is exempt by construction; combined with an imported props type, the file carries no signal at all. |
| `interface P { "children"?: ReactNode }`, or `({ "children": kids })` | Both visitors require `key.type === "Identifier"`. A string-literal key is the same slot spelled differently and is invisible to both. |
| `interface P { body?: ReactNode }` — or `content`, `slot`, `inner` | The rule bans one WORD. The law refuses markup that has already been built, whatever it is called; the rule refuses the identifier `children`. A rename costs nothing and defeats it completely. |
| Any file outside the component roots — a page, a layout under another folder, a repository keeping components at `src/Card.tsx` | The bare `src` root is deliberately dropped from the fence, so a tree that is not under `src/components` or `packages/ui/src` is entirely ungoverned. A page taking children is the intended exemption; a container that happens to sit elsewhere gets the same free pass. |
| Anything at all written inside the four exempt shell folders, or inside the contract table file | The exemptions are FOLDER and FILE exemptions, not identity exemptions. A new unrelated component filed at `shells/ModalShell/Footer.tsx` inherits the exemption its neighbour earned. |
| `<SurfaceListCard {...config} />` where `config` carries `items` | The attribute loop skips anything whose `type` is not `JSXAttribute`, and a spread is a `JSXSpreadAttribute`. `{...{ items }}` defeats it just as well. This is the constants-launder-literals case, and it is one keystroke. |
| `import SurfaceListCard from "…/SurfaceListCard"`, `import * as Branches from …`, a barrel re-export, an import ending `/index`, or a sibling import that does not spell `components/branches/` | The binding set is built from one exact source pattern and one exact `imported.name`. A default import has no `imported`; a namespace access is a `JSXMemberExpression`, not a `JSXIdentifier`. Any of these leaves the binding set empty and the rule silent for the whole file. |
| A one-line wrapper: `const ListCard = (p: P) => <SurfaceListCard {...p} />`, then `<ListCard items={…} />` elsewhere | The wrapper's own file passes because the lane arrives by spread; the call site's file passes because `ListCard` is not the tracked binding. Nothing in either file is reported. |
| `<SurfaceListCard rows={…} />`, `entries`, `records`, `data` | Again one word. Any other name opens the same second data lane and teaches the shared surface a caller's model. |
| `createElement(SurfaceListCard, { items })` | Only `JSXOpeningElement` is visited. |
| `SurfaceListCard` declaring `items` in its own props type | The rule is a call-site rule only. The declaration side is unpoliced, so the lane can exist, compile and stay green until somebody uses it — and then only in files the import pattern matches. |

## Inputs

| Input | What the rule actually receives |
|---|---|
| AST | The parsed file, TypeScript nodes included. Syntax only. |
| `context.filename` | Used by two of the three rules as their entire scope gate, normalised to forward slashes. |
| Import declarations | Read by one rule, as literal source strings. Not resolved, not followed. |
| Type information | **None.** No rule uses parser services. An imported alias, an `extends`, a helper type and a contextual type are all opaque. |
| Configuration | None. All three rules declare `schema: []`, so there is nothing to tune per repository. |

## Invariants

- A rule's identity is its published name. It carries no second identifier.
- Every published rule maps to exactly one law code, and enforces no code the law does not carry.
- All three ship at `error`. The plugin's own recommendation is exact and mechanical: each fires on a
  syntactic shape rather than a judgement, so there is no false-positive risk that would justify
  `warn`.
- No rule reads type information, so no rule can see across a file boundary.
- The component-root list is one list, shared by every gate, so a new layout is added to every rule
  at once.
- The bare `src` root is a catch-all for READING the tree and is never a fence. Used as a fence it
  pulls routed pages into a rule about component slots.
- An exemption stated as a folder applies to every file in that folder.

## Exceptions

Exemptions are part of the enforcement, not relief from it. Each is closed and names the rule it
applies to.

- **The contract table** is exempt from `no-children-slot`. The table's `children` is not a children
  hole; it is the named child grammar that replaces one. Reporting it would ask the file that
  abolished the anonymous slot to stop describing what it admits.
- **Four shells** are exempt from `no-children-slot`: `ModalShell`, `DrawerShell` and `DropdownShell`
  pass an interior straight to vendor mechanics and arrange nothing; `RouteShell` converts the
  children a framework layout is handed. Note that the rule's own `docs.description` still says
  three — see [`audit.md`](./audit.md).
- **Everything outside the component roots** is outside `no-children-slot`. A page taking children is
  the one thing a page legitimately does.
- **An untyped parameter** is outside `no-inline-parameter-type`. Untyped destructuring is a
  different question and belongs to a different law.
- **A named scalar parameter** is not a shape with nowhere to be read from, and is not reported.

## Output

When citing a rule from this module, state the mechanism rather than the intent:

```text
rule: <starci-fe/no-inline-parameter-type | starci-fe/no-children-slot | starci-fe/no-surface-list-items-slot>
code: <SLOTS-3 | SLOTS-4 | SLOTS-7>
file: <path, and whether the rule's filename gate admits it>
node: <the AST node reported>
verdict: <fires | does not fire>
mechanism: <the node test that decided it>
hatch: <the open hatch that would silence it here, or none>
```

The `hatch` line is not optional. A rule reported as holding, with no statement of what would slip
past it, is the failure this shelf exists to prevent: an unknown escape hatch is more dangerous than
a law with no rule at all, because a law with no rule is KNOWN to be unenforced while a leaky rule
is believed to be closed.

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for each rule in business terms and why it deserves a
machine at all, [`example.md`](./example.md) for the firing and non-firing code of every rule
together with the code that slips through, [`audit.md`](./audit.md) when reviewing whether this
enforcement still matches its source, and [`changelog.md`](./changelog.md) for version history.

## Scope

This record documents exactly the rules published by the source module behind this law, and nothing
else. A rule that ought to exist but does not is recorded as an open risk in `audit.md`, never
documented here as though it ran. Prose and examples name no product; rule names, component names
and package names are identifiers that ship and are reproduced verbatim.

## Version Rule

Increment all five records by `0.01` for an accepted change to the documented enforcement, and record
it in `changelog.md`. A major bump is reserved for a change in the module's shape or the shelf it
sits on.
