# Props-and-slots

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe-props` | `@starci/eslint-canon-fe/props` | npm package | the published frontend prop types this record cites |

## Record

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

The law states **seven codes**, `SLOTS-1` through `SLOTS-7`. **Seven published rules enforce four
of them.** That is
not a coverage accident, it is the arrangement the law wants: the slot aliases in `props.ts` are the
fence, a fifth slot fails to compile rather than failing review, and there is nothing left for a rule
to patrol once the shape itself refuses. The rules exist exactly where a type has nothing to look at
— a shape with no NAME, a `children` hole hand-written beside the aliases instead of inside them, the
four CSS placement doors covered by `SLOTS-6`, and a generic `items` lane on a shared surface. This
module records that enforcement honestly, including the places where the enforcement is thinner than
the name suggests.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-inline-parameter-type` | `SLOTS-3` | `inline` — a function parameter whose declared type contains an anonymous object shape, including inside parentheses, intersections and unions |
| `no-children-slot` | `SLOTS-4` | `slot` — a `children` member declared in a type, or a `children` key destructured in a parameter, inside a governed component file |
| `no-per-part-classname-prop` | `SLOTS-6` | `perPart` — a lower-camel `<part>ClassName` property in supported component source |
| `no-public-classname-prop` | `SLOTS-6` | `declaration` or `usage` — `className`/`classNames` on a supported component prop type or on a JSX call to an imported house component |
| `no-public-frame-css-props` | `SLOTS-6` | `css` — `gap`, `padding`, `align`, `justify`, `className`, `classNames`, `style`, `inline` or `nested` above the leaf tier |
| `no-css-door-type-laundering` | `SLOTS-6` | `utility` — `Omit`, `Pick` or `Exclude` whose key union includes `className`, `classNames` or `style` |
| `no-surface-list-items-slot` | `SLOTS-7` | `items` — an `items` JSX attribute on a tag bound to `SurfaceListCard` imported from the one literal path |

`SLOTS-1` (the data slot carries data, never a function, a component or any value carrying
behaviour), `SLOTS-2` (a component's data is declared with a type alias, never an `interface`) and
`SLOTS-5` (a component below the request owner receives `isLoading` and never decides its own waiting
state) have no rule here. `SLOTS-1` and `SLOTS-2` remain `unrepresentable`, held by `DataValue` and
the `D extends ComponentData` constraint. `SLOTS-6` is enforced by four rules at its public CSS
doors, while `SLOTS-5` remains `documented`, held by nothing at all. A green run says nothing about
`SLOTS-5`, and where a scope gate does not cover a file the code is simply unenforced rather than
covered.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means no visitor was installed and the rule did not exist for that file.
   `no-inline-parameter-type` installs no path gate at all and therefore has no out-of-scope state;
   `no-children-slot` needs `isGoverned`; the four `SLOTS-6` rules have their own source/test/leaf
   gates; `no-surface-list-items-slot` needs `/src/` in the path.
2. **Check the exemptions before reading a node.** The contract registry file is exempt from
   `no-children-slot` because its `children` member describes the closed child grammar. Framework
   route files sit outside the component tier and may receive ReactNode, provided they close it into
   a named projection before component composition. There are no component-folder exemptions.
3. **Read the nodes the rule actually visits.** A declared parameter type annotation; a
   `TSPropertySignature` key or an `ObjectPattern` property key; an import specifier and then a JSX
   attribute name. A node the visitor never reaches is unjudged, not clean.
4. **Emit one block per finding**, on the node the rule reports on — the type annotation, the
   `children` identifier, the CSS-door property/type reference or the whole `items` attribute.
5. **Write the `hatch` line** whenever an open hatch below would have hidden the same failure. A
   `Readonly<{…}>` parameter, a `PropsWithChildren` props type and a barrel import of the surface all
   pass, and none of them is compliance.
6. **Do not report what no rule watches.** `SLOTS-1`, `SLOTS-2` and `SLOTS-5` have no rule here;
   a verdict that claims otherwise is wrong about the module. `SLOTS-6` has four named rules, not a
   single generic CSS rule.

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
taking children, the one thing a page legitimately does. In scope the two finding visitors are
deferred through `Program:exit` bookkeeping.
`TSPropertySignature` reports when `node.key.type === "Identifier"` and `node.key.name === "children"`.
`Property` reports the same key when its parent is an `ObjectPattern` and its grandparent is not a
`VariableDeclarator` — a destructured `children` in a parameter, which is the same slot arriving by
another door, while `const {children} = props` in a body is deliberately let through. Findings wait
until `Program:exit`: the rule records the enclosing type and the function whose first parameter
references it, then clears a candidate only for the closed boundary-converter shape. That shape reads
plain props, creates one `useCallback` children closure, and returns one JSX element carrying that
closure under a named attribute; any extra statement, branch, second return, own element or uncarried
value reports.

**What it cannot see.** A quoted member, `"children": ReactNode`, whose key is a `Literal` rather
than an `Identifier`, and a computed key likewise. A children hole under any other name —
`content: ReactNode`, `body: ReactNode`, `trigger: ReactNode` — because the rule matches one
identifier and nothing about ReactNode. `PropsWithChildren<XData>`, or any imported props type that
carries the member, because the rule never opens another file. The positive half of the code is
unwatched entirely: nothing here checks that a container declares `contract` and `render` together,
and nothing sees a closed shape that grows `render`. And the tier gate is a path: the same component
filed under `apps/web/features/…`, or under a `ui/` that is neither component root, has no rule
on it — the layout literal is the cheapest thing in a repository to change. Renaming a boundary-shaped
function or file cannot opt in; adding one real layout decision makes it report.

**Boundary.** This rule sees the markup hole and only the markup hole. `BranchProps` holds the
positive half. Only the closed boundary-converter shape is exempt; an ordinary shell that forwards
`children` remains a finding.

## `no-per-part-classname-prop` — SLOTS-6

**What it reports.** `perPart` on each `TSPropertySignature` whose static property name matches
`/^[a-z][A-Za-z0-9]*ClassName$/`, except exactly `className`.

**How it detects.** Tests and files outside `/src/components/` or `/packages/ui/src/` receive `{}`.
In scope the visitor reads `propertyName(node)` (identifier or static string literal) and reports
aliases and interfaces alike. It does not inspect JSX, imported types or utility compositions.

**What it cannot see.** Computed/dynamic keys, names outside the regex, `className`/`classNames`, test
files, bare `src`, imported or utility-composed props and usage sites are open. `className` belongs to
`no-public-classname-prop`; `classNames` does not match the singular per-part suffix.

## `no-public-classname-prop` — SLOTS-6

**What it reports.** `declaration` for exact `className` or `classNames` properties in supported
component source; `usage` for those exact JSX attributes on a local tag bound by a `components/`
import.

**How it detects.** Tests are always out. In every other file, imports whose normalised source contains
`/components/` add every local specifier to `bindings`. Declarations require the supported component
source gate; JSX usage only requires a `JSXIdentifier` in `bindings`, so usage may be outside the
component roots. The two visitors do not resolve imports or assignments.

**What it cannot see.** Computed keys, member-expression tags, spreads, assignments, unresolved
re-exports, imports whose source lacks `/components/`, tests, non-component-root declarations and
other CSS names are open. A barrel is watched when its source still contains `/components/`.

## `no-public-frame-css-props` — SLOTS-6

**What it reports.** `css` for exact static names in `gap`, `padding`, `align`, `justify`, `className`,
`classNames`, `style`, `inline`, `nested` on a non-leaf component source property.

**How it detects.** Tests, unsupported component roots and the leaf tier return `{}`. The leaf check
uses `isInComponentTier(filename, "leaves")` across the supported layouts. Every other
`TSPropertySignature` is compared through `propertyName` and exact set membership.

**What it cannot see.** Computed/inherited props, names outside the nine-name set, tests, leaves and
unsupported roots pass. Utility laundering is handled separately and only covers `className`,
`classNames` and `style`.

## `no-css-door-type-laundering` — SLOTS-6

**What it reports.** `utility` on the whole `TSTypeReference` when an `Omit`, `Pick` or `Exclude`
second type argument contains `className`, `classNames` or `style` as a static string key.

**How it detects.** Tests and paths without `/src/` return `{}`. The visitor accepts only an identifier
utility in the three-name set, reads `typeArguments.params` or `typeParameters.params`, recursively
walks a union in parameter two, and reports when one `TSLiteralType` string key is forbidden.

**What it cannot see.** Aliases, template/computed literals, non-union wrappers, other utilities,
first-argument doors, other keys, local utility aliases, tests and paths outside `/src/` are open.
Frame names `gap`, `padding`, `align`, `justify`, `inline`, `nested` belong to the direct frame rule.

**Boundary.** This rule stops utility types from hiding a CSS door; it does not resolve the base type
or replace declaration and usage rules.

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
| separator normalisation | All filename-aware rules rewrite backslashes to `/`; `no-inline-parameter-type` reads no path |
| out of scope | `create` returns an empty visitor object. The rule does not exist for that file rather than passing it |
| component roots | `COMPONENT_ROOTS = ["src/components", "packages/ui/src", "src"]`, imported from `contract.mjs`; `isGoverned` drops the bare `src` entry and matches the remaining two as `/<root>/` anywhere in the path |
| SLOTS-6 source/test/leaf gates | Per-part and declaration rules accept the two named component roots; frame CSS also excludes `leaves`; all four rules exclude `isTestFile`; public-name usage has no component-root gate |
| registry exemption | `isContractTableFile(path)` — `contracts/index.ts` under any supported root — switches `no-children-slot` off for that file |
| shape walk | `isInlineObjectType` answers true on `TSTypeLiteral`, recurses through `TSParenthesizedType`, and maps `some` over `TSIntersectionType` and `TSUnionType` members. Nothing else is opened |
| property names | `propertyName` reads identifiers and static string literals; computed/dynamic keys return `null` |
| SLOTS-6 matchers | Per-part uses `/^[a-z][A-Za-z0-9]*ClassName$/` except `className`; public-name uses exact `className`/`classNames`; frame uses exact nine-name `FRAME_CSS_PROPS` set |
| component binding | Public-name records every local import specifier from a source containing `/components/`; JSX usage checks only a bound `JSXIdentifier` |
| utility walk | CSS-door laundering accepts only `Omit`/`Pick`/`Exclude`, reads the second type parameter and recurses through union string literals |
| surface binding | One import-source regex, `/(?:^|\/)components\/branches\/SurfaceListCard$/`, plus an exact `imported.name === "SurfaceListCard"`, produces the set of local tag names the JSX visitor will look at |
| reach outside the file | None. All seven rules read one file; no rule opens an imported type, a utility alias, a re-export or the surface component itself |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `({label}: {label: string} & Base) => …` | `isInlineObjectType` maps over intersection members, so one anonymous half is enough |
| `({label}: ({label: string})) => …` | The parenthesised type is unwrapped before the test |
| A method signature with no body, in a declaration file | `TSEmptyBodyFunctionExpression` is one of the four visited function forms |
| `interface XProps { children?: ReactNode }` | `TSPropertySignature` visits interface members and type-literal members alike |
| `function X({children, ...rest}: XProps)` | A destructured `children` in a parameter is reported as the same slot arriving by another door |
| A closed boundary converter with one `useCallback` closure and one named JSX handoff | `Program:exit` clears only that candidate; a real layout decision reports |
| The same component in a monorepo at `packages/ui/src/...` | `COMPONENT_ROOTS` carries that layout, so the fence holds in both repositories rather than silently in neither |
| A Windows path with backslashes | Both scope tests normalise separators first |
| `type P = { titleClassName?: string }` | The lower-camel per-part matcher catches it |
| `type P = { className?: string }` above a leaf | Public-name and frame CSS rules close the direct door in their respective scopes |
| `<SurfaceCard classNames={map} />` from a `components/` import | The binding set records the local name and the JSX visitor checks both public placement names |
| `type P = Omit<Base, "className">` | The utility walker reads parameter two and reports the CSS key |
| `import {SurfaceListCard as ListCard}` then `<ListCard items={…} />` | The binding set keys on `imported.name` and stores the local name, so an alias is still watched |
| `<SurfaceListCard items={tasks} className="…" />` | Every `JSXAttribute` on the matched tag is scanned; the other attributes change nothing |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `no-inline-parameter-type` | **A parameter with no annotation**, **a shape one utility type away** — `Readonly<{…}>`, `Partial<{…}>`, `{…}[]` — and **any name at all**, since `XProps` for component `X` is read and never checked |
| `no-children-slot` | **A quoted or computed key**, **a markup hole under another name** such as `content: ReactNode`, **`PropsWithChildren` or any imported props type**, **`const {children} = props` in a body**, **a path outside the two component roots**, and **the entire positive half** — nothing checks that `contract` and `render` appear together, or that a closed shape has not grown `render` |
| `no-surface-list-items-slot` | **Every other shared surface**, **a barrel, a re-export, an extension in the path or a default import**, **a namespaced tag**, **an indirect binding**, **a spread attribute**, and **the same generic lane spelled `rows`, `entries` or `data`** |
| `no-per-part-classname-prop` | **Names outside its regex**, **`className`/`classNames`**, **computed keys**, **tests**, **unsupported roots**, **imported/utility-composed props** and **usage sites** |
| `no-public-classname-prop` | **Computed keys**, **JSX spreads/member expressions**, **assignments**, **imports without `/components/`**, **tests**, **non-component declarations** and **other CSS names** |
| `no-public-frame-css-props` | **Leaves**, **tests**, **unsupported roots**, **computed/inherited props** and **names outside its exact nine-name set** |
| `no-css-door-type-laundering` | **Aliases, template/computed literals, non-union wrappers, other utilities, first-argument doors, other keys, tests and paths without `/src/`** |
| none | **Everything `SLOTS-1`, `SLOTS-2` and `SLOTS-5` forbid** — a handler in `props`, a data shape declared with `interface`, and a component deciding its own waiting state. The first two are type-held where aliases are used; `SLOTS-5` is held by nothing |

That last row is the honest summary: seven published rules enforce `SLOTS-3`, `SLOTS-4`, `SLOTS-6`
and `SLOTS-7`; `SLOTS-1` and `SLOTS-2` are type-held where aliases are used, and `SLOTS-5` is
reader-held.

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
10. No rule takes an option: all seven declare `schema: []`. Severity is the only dial a repository
    has, and the published level is `error` for all seven under the `starci-fe/` prefix.
11. Each rule reads exactly one file. No rule opens an imported type, a utility alias, a re-export or
    the surface component.
12. Out of scope means no visitor is installed, not that the file passed.
13. `no-inline-parameter-type` reports once per offending parameter; `no-children-slot` once per
    `children` node; `no-per-part-classname-prop`, `no-public-classname-prop` and
    `no-public-frame-css-props` once per offending property or attribute; `no-css-door-type-laundering`
    once per offending utility reference; `no-surface-list-items-slot` once per offending attribute.

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
- **The boundary-converter shell.** `SLOTS-4` exempts one closed shape inside the component tier: a
  function that reads props, creates one `useCallback` children closure and hands it to exactly one
  JSX component under a named prop. `Program:exit` checks the function tied to the props type, not its
  filename or export name; a second return, conditional, local element, data read or bypassed closure
  closes the hatch and reports.
- **Two lanes for `render`.** `SLOTS-4` is satisfied by bound slots and by a stable branded component
  type. Which lane applies is decided by whether the runtime data repeats, not by preference. No rule
  reads either lane.
- **A scalar parameter.** `SLOTS-3` governs shapes. A parameter typed `string` is not a shape with
  nowhere to be read from and needs no alias — and `isInlineObjectType` answers false for it without
  needing to be told.
- **The atomic leaf.** `SLOTS-6` permits a leaf to own local frame spacing; the direct frame rule is
  disabled by `isInComponentTier(filename, "leaves")`. Tests remain out for all four SLOTS-6 rules.
- **Semantic variants.** Names such as `tone`, `density` and `titleTone` remain legal because these
  rules close exact placement doors, not every prop.

No rule declares an option, an allowlist or a per-file opt-out. The only remaining exit is a disable
comment, and this module grants none. A repository that needs one is making a rule change, which
belongs in the module's history — not in a comment above the parameter.

## Output

One block per finding:

```text
file: <path as the rule sees it, forward slashes>
rule: <one of the seven published rule names>
scope: <in | out — the gate that decided it, or "no gate">
report: <inline | slot | perPart | declaration | usage | css | utility | items> at <node>
code: <SLOTS-3 | SLOTS-4 | SLOTS-6 | SLOTS-7>
hatch: <the open hatch that would have hidden this, or none>
```

A clean file in scope emits one block per rule that ran, with `report: none` and `hatch: none`. A file
out of scope emits one block per rule with `scope: out` and `report: unjudged` — never `report: none`,
because no visitor looked.
