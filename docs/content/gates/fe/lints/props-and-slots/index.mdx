---
title: Props-and-slots
---

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
behaviour), `SLOTS-2` (a component's data is declared with a type alias, never an `interface`),
`SLOTS-5` (a component below the request owner receives `isLoading` and never decides its own waiting
state) has **no rule at all** here. `SLOTS-1` and `SLOTS-2` remain `unrepresentable`, held by
`DataValue` and the `D extends ComponentData` constraint. `SLOTS-6` is now enforced by four rules
at its public CSS doors, while `SLOTS-5` remains `documented`, held by nothing at all. A green run
of this module says nothing about `SLOTS-5`, and where a scope gate does not cover a file the code is
simply unenforced rather than covered.

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
another door, while `const {children} = props` in a body is deliberately let through. Findings are
held as candidates until `Program:exit`: the rule records the enclosing type name and the function
whose first parameter references it, then clears a candidate only when that function is a closed
boundary converter. The converter may bind plain prop reads and one `useCallback` closure, then return
one JSX element whose named attribute carries that closure; any extra statement, branch, second return,
own element or uncarried value falls through to the report.

**What it cannot see.** A quoted member, `"children": ReactNode`, whose key is a `Literal` rather
than an `Identifier`, and a computed key likewise. A children hole under any other name —
`content: ReactNode`, `body: ReactNode`, `trigger: ReactNode` — because the rule matches one
identifier and nothing about ReactNode. `PropsWithChildren<XData>`, or any imported props type that
carries the member, because the rule never opens another file. The positive half of the code is
unwatched entirely: nothing here checks that a container declares `contract` and `render` together,
and nothing sees a closed shape that grows `render`. And the tier gate is a path: the same component
filed under `apps/web/features/…`, or under a `ui/` that is neither component root, has no rule
on it — the layout literal is the cheapest thing in a repository to change. A boundary-shaped
function is exempt only when its whole body matches the converter predicate; renaming the function or
file cannot opt in, and adding one real layout decision makes it report.

**Boundary.** This rule sees the markup hole and only the markup hole. `BranchProps` holds the
positive half. A boundary-converter shell is exempt by the closed shape described above; ordinary
shells that merely forward `children` remain findings.

## `no-per-part-classname-prop` — SLOTS-6

**What it reports.** `perPart` — one report on a `TSPropertySignature` whose plain property name
matches the lower-camel `<part>ClassName` form, except the public root name `className` itself.

**How it detects.** The rule normalises the filename and returns `{}` for a test file or for a file
outside a supported component source root (`/src/components/` or `/packages/ui/src/`; the bare
`src` catch-all is not a component-source root here). In scope it visits every `TSPropertySignature`,
gets its `key` (or `property` fallback) through `propertyName`, and reports when the resulting string
matches `/^[a-z][A-Za-z0-9]*ClassName$/` and is not exactly `className`. This catches declarations
in aliases and interfaces alike; it does not inspect JSX call sites or imported types.

**What it cannot see.** A quoted key is read when it is a static string literal, but computed keys,
symbols and non-string literals have no `propertyName`. `className` is deliberately left to
`no-public-classname-prop`; `classNames` does not match the singular suffix. A prop named
`TitleCSS`, `titleClass`, `title_style` or `title-className` is outside the regex. Imported or
utility-composed props are not opened, and a declaration in a test, route, tooling or bare `src`
file is out of scope. There is no JSX usage visitor, so passing `titleClassName` is not independently
reported when its declaration is elsewhere.

**Boundary.** This is the per-part placement door only. Semantic props such as `tone`, `density` or
`titleTone` remain possible; the component or contract still owns the resulting appearance.

## `no-public-classname-prop` — SLOTS-6

**What it reports.** `declaration` — a `className` or `classNames` property in supported component
source — and `usage` — either attribute on a JSX element whose local tag binding came from a
`components/` import.

**How it detects.** Tests are always out of scope. For every other file, `ImportDeclaration` records
every local specifier name when the normalised source contains `/components/` at a path boundary; it
does not require a specific component or import style. In supported component source, every static
property name exactly equal to `className` or `classNames` reports `declaration`. In any non-test file,
each `JSXOpeningElement` with a `JSXIdentifier` tag in that binding set reports matching
`JSXAttribute`s as `usage`. The declaration gate and usage gate are intentionally different.

**What it cannot see.** Computed or non-static property keys, JSX member-expression tags, spreads,
and attributes on a component that was not introduced by a matching `components/` import are not
visited. A barrel or re-export is watched if its source still contains `/components/`; a relative
path without that segment is not. The rule does not resolve aliases through assignments, re-exports
or another file, and it does not open an imported props type. It reports no declaration in tests,
files outside supported component roots, or source files that use another spelling such as
`class`, `classes` or `style`.

**Boundary.** This closes the public placement API for house components. Vendor primitives and
semantic variant props are outside this rule unless they are passed through a bound house component
under one of the two forbidden names.

## `no-public-frame-css-props` — SLOTS-6

**What it reports.** `css` — a `TSPropertySignature` named exactly `gap`, `padding`, `align`,
`justify`, `className`, `classNames`, `style`, `inline` or `nested` in a non-leaf component source
file.

**How it detects.** Tests and files outside supported component source are out of scope. The leaf
tier is also out of scope, including the supported single-app and monorepo paths recognised by
`isInComponentTier(filename, "leaves")`. Every other in-scope file visits `TSPropertySignature`,
extracts a static name with `propertyName`, and reports exact membership in `FRAME_CSS_PROPS`. The
rule reads no JSX, imports or utility types.

**What it cannot see.** Computed keys, dynamic names and props inherited through a reference are not
opened. A spelling outside the exact set (`margin`, `width`, `direction`, `class`, or a namespaced
CSS object) passes. Leaf declarations pass by design, as do tests and files outside the supported
component roots. A utility type that launders one of these names is the separate concern of
`no-css-door-type-laundering`, which only names `className`, `classNames` and `style`.

**Boundary.** A non-leaf component exposes semantic state or a named contract, not the frame's CSS
arrangement decisions. The atomic leaf may own its local spacing because it owns the one primitive.

## `no-css-door-type-laundering` — SLOTS-6

**What it reports.** `utility` — the whole `TSTypeReference` for `Omit`, `Pick` or `Exclude` when
its second type argument contains the string key `className`, `classNames` or `style`.

**How it detects.** The filename is normalised; tests and paths without `/src/` get no visitors. For
each `TSTypeReference`, the rule accepts only an identifier utility name in the three-element set,
then reads `typeArguments.params` (or the legacy `typeParameters.params`). It recursively walks a
union in the second parameter and collects only `TSLiteralType` string literals. One forbidden key
is enough to report the reference node. No type is resolved and no declaration or call site is
opened.

**What it cannot see.** A forbidden key supplied through a type alias, template literal, enum,
computed literal, non-union wrapper or a utility with another name is invisible. The first utility
argument is not inspected for a door, and keys other than `className`, `classNames` and `style` are
not reported. Paths outside `/src/`, tests and files where the utility is spelled through a local
alias are open hatches. `gap`, `padding`, `align`, `justify`, `inline` and `nested` are not this
rule's key set; their direct frame declarations are handled by `no-public-frame-css-props`.

**Boundary.** This rule prevents hiding a public CSS door with a utility type. It does not prove
that the owning base type actually declares the key, nor does it replace the declaration and usage
rules.

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
| separator normalisation | All filename-aware rules rewrite backslashes to `/` before matching, so a Windows path decides the same way. `no-inline-parameter-type` reads no path at all |
| out of scope | `create` returns an empty visitor object. The rule does not exist for that file rather than passing it |
| component roots | `COMPONENT_ROOTS = ["src/components", "packages/ui/src", "src"]`, imported from `contract.mjs`; `isGoverned` drops the bare `src` entry and matches the remaining two as `/<root>/` anywhere in the path |
| SLOTS-6 source gate | `no-per-part-classname-prop`, `no-public-classname-prop` declarations and `no-public-frame-css-props` accept only the two named component roots; `no-public-frame-css-props` then drops `leaves`; `no-public-classname-prop` usage has no component-root gate |
| SLOTS-6 test gate | `isTestFile` turns every four SLOTS-6 rules off for `.test/.spec` files; `no-public-classname-prop` applies that gate before both declaration and usage visitors |
| registry exemption | `isContractTableFile(path)` — `contracts/index.ts` under any supported root — switches `no-children-slot` off for that file |
| shape walk | `isInlineObjectType` answers true on `TSTypeLiteral`, recurses through `TSParenthesizedType`, and maps `some` over `TSIntersectionType` and `TSUnionType` members. Nothing else is opened |
| property-name extraction | `propertyName` reads identifier keys and static string literals from `TSPropertySignature`; computed or dynamic keys return `null` |
| per-part matcher | `no-per-part-classname-prop` applies `/^[a-z][A-Za-z0-9]*ClassName$/` and excludes exactly `className` |
| public-name matcher | `no-public-classname-prop` compares exact `className` and `classNames` names at declarations and JSX attributes |
| frame CSS set | `no-public-frame-css-props` compares exact membership in `gap`, `padding`, `align`, `justify`, `className`, `classNames`, `style`, `inline`, `nested` |
| component binding | `no-public-classname-prop` records every local import specifier whose source contains `/components/`; JSX usage checks only a `JSXIdentifier` tag in that set |
| utility walk | `no-css-door-type-laundering` accepts only `Omit`, `Pick` and `Exclude`, reads their second type parameter and recurses through `TSUnionType` string literal members |
| surface binding | One import-source regex, `/(?:^|\/)components\/branches\/SurfaceListCard$/`, plus an exact `imported.name === "SurfaceListCard"`, produces the set of local tag names the JSX visitor will look at |
| reach outside the file | None. All seven rules read one file; no rule opens an imported type, a re-export or the surface component itself |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `({label}: {label: string} & Base) => …` | `isInlineObjectType` maps over intersection members, so one anonymous half is enough |
| `({label}: ({label: string})) => …` | The parenthesised type is unwrapped before the test |
| A method signature with no body, in a declaration file | `TSEmptyBodyFunctionExpression` is one of the four visited function forms |
| `interface XProps { children?: ReactNode }` | `TSPropertySignature` visits interface members and type-literal members alike |
| `function X({children, ...rest}: XProps)` | A destructured `children` in a parameter is reported as the same slot arriving by another door |
| A closed boundary converter with one `useCallback` closure and one named JSX handoff | `Program:exit` recognises the whole shape and clears only that candidate; a real layout decision makes it report |
| The same component in a monorepo at `packages/ui/src/...` | `COMPONENT_ROOTS` carries that layout, so the fence holds in both repositories rather than silently in neither |
| A Windows path with backslashes | Both scope tests normalise separators first |
| `type P = { titleClassName?: string }` in a branch | The lower-camel per-part matcher catches every `<part>ClassName` property except the root `className` name |
| `type P = { className?: string }` above the leaf tier | `no-public-classname-prop` and `no-public-frame-css-props` both close the direct public door in their respective scopes |
| `<SurfaceCard classNames={map} />` after a `components/` import | The binding set records the local import name and the JSX visitor checks both exact public placement names |
| `type P = Omit<Base, "className">` | The utility walker reads the second argument and reports a CSS key even when the declaration is being narrowed |
| `import {SurfaceListCard as ListCard}` then `<ListCard items={…} />` | The binding set keys on `imported.name` and stores the local name, so an alias is still watched |
| `<SurfaceListCard items={tasks} className="…" />` | Every `JSXAttribute` on the matched tag is scanned; the other attributes change nothing |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `no-inline-parameter-type` | **A parameter with no annotation**, **a shape one utility type away** — `Readonly<{…}>`, `Partial<{…}>`, `{…}[]` — and **any name at all**, since `XProps` for component `X` is read and never checked |
| `no-children-slot` | **A quoted or computed key**, **a markup hole under another name** such as `content: ReactNode`, **`PropsWithChildren` or any imported props type**, **`const {children} = props` in a body**, **a path outside the two component roots**, and **the entire positive half** — nothing checks that `contract` and `render` appear together, or that a closed shape has not grown `render` |
| `no-surface-list-items-slot` | **Every other shared surface**, **a barrel, a re-export, an extension in the path or a default import**, **a namespaced tag**, **an indirect binding**, **a spread attribute**, and **the same generic lane spelled `rows`, `entries` or `data`** |
| `no-per-part-classname-prop` | **A name outside the exact lower-camel `<part>ClassName` regex**, **`className`/`classNames` (owned by the public-name rule)**, **computed keys**, **test files**, **files outside the two component roots**, **imported or utility-composed props**, and **usage sites** |
| `no-public-classname-prop` | **Computed keys**, **JSX spreads/member-expression tags**, **assignments and re-exports not represented by the import binding**, **imports whose source lacks `/components/`**, **tests**, **non-component-root declarations**, and **other CSS-shaped names** |
| `no-public-frame-css-props` | **Leaf files**, **tests**, **files outside the two component roots**, **computed or inherited props**, and **names outside the exact nine-name set** |
| `no-css-door-type-laundering` | **Aliases, template/computed literals, non-union wrappers, utilities other than `Omit`/`Pick`/`Exclude`, first-argument doors, keys other than `className`/`classNames`/`style`, tests and paths without `/src/`** |
| none | **Everything `SLOTS-1`, `SLOTS-2` and `SLOTS-5` forbid** — a handler travelling inside `props`, a data shape declared with `interface`, and a component deciding its own waiting state. The type holds the first two where the tier aliases are used; `SLOTS-5` is held by nothing anywhere |

That last row is the honest summary: seven published rules enforce `SLOTS-3`, `SLOTS-4`, `SLOTS-6`
and `SLOTS-7`; `SLOTS-1` and `SLOTS-2` are type-held where their aliases are used, and `SLOTS-5`
is a reader-held code.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path as the rule sees it, separators normalised to `/` |
| scope decision | Which gate matched — `isGoverned`, a SLOTS-6 source/test/leaf gate, `/src/`, or no gate at all — or that none did |
| parameter annotations | Every function parameter's `typeAnnotation.typeAnnotation`, and the node kind at each level of it |
| property keys | Every `TSPropertySignature` key, its static-name result, and every `ObjectPattern` property key, with its parent and grandparent node types |
| import specifiers | The normalised source string, `imported.name` and `local.name` per specifier |
| JSX tag and attributes | Every `JSXIdentifier` opening tag, and each `JSXAttribute` name on the tags that matched a binding |
| utility references | Utility identifier, type-argument list, second-argument node kind, and every static string key collected from its union |

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
  function whose whole body only reads props, creates one `useCallback` children closure, and hands
  that reference to exactly one JSX component under a named prop. `Program:exit` checks the actual
  function tied to the props type, not its filename or export name. A second return, conditional,
  local element, data read or forwarded value that bypasses the closure closes the hatch and reports.
- **Two lanes for `render`.** `SLOTS-4` is satisfied by bound slots and by a stable branded component
  type. Which lane applies is decided by whether the runtime data repeats, not by preference. No rule
  reads either lane.
- **A scalar parameter.** `SLOTS-3` governs shapes. A parameter typed `string` is not a shape with
  nowhere to be read from and needs no alias — and `isInlineObjectType` answers false for it without
  needing to be told.
- **The atomic leaf.** `SLOTS-6` permits a leaf to own its local frame spacing. The direct frame
  rule is disabled by `isInComponentTier(filename, "leaves")`; the public-name and per-part rules
  still judge any declarations they are designed to judge, and tests remain out of scope for all
  four rules.
- **A semantic variant is not a CSS door.** `tone`, `density`, `titleTone` and other names that do
  not match the exact rule sets remain legal. The four machines close placement names; they do not
  turn every prop into a finding.

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
type holds — `SLOTS-1` and `SLOTS-2` — belongs to `@canon-fe-props`; the four public CSS doors of
`SLOTS-6` belong to the published rules named above, and what nothing holds — `SLOTS-5` — belongs to
a reader.
