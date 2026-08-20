---
title: File-layout
---

# File-layout

## LOADS

None.


## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the exact rewrite that would have silenced the same failure. This
module chooses no layout. It refuses one, and it must be able to point at the path segment or the
export it refuses on.

## Law

Where a file sits is a claim about what it is. The law that states this carries eight codes, `FILE-1`
through `FILE-8`.

The law states eight codes. **All eight have a rule.** Each rule holds exactly one code, and each code is
held by exactly one rule — there is no code here without enforcement and no rule here without a code.
That one-to-one map is the good news and the whole of the trap: five rules read only the PATH, two read
the PATH and a source marker or export list, and one reads only the export list. That is what makes
them cheap and exact, and is also what they cost. A path rule can tell a folder from a folder. It
cannot tell a component from a helper, a drawing route from a mounting one, or a domain sentence from
a shape. So a green run here means the strings and the few inspected nodes were acceptable, never
that the tree is right.

A law with no rule is KNOWN to be unenforced, while a leaky rule is BELIEVED to be closed, and the
belief is the more expensive of the two. Every open hole below is therefore written down at full
strength.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `surface-folder-two-files-only` | `FILE-2` | `extra` — names the tier, the surface folder and the remaining path, then names the destination each kind of stray belongs to |
| `route-tree-holds-routes-only` | `FILE-6` | `stray` — names the path under the routing tree and the basename that is not a framework slot, then sends a screen to the page tier and a domain sentence to the block tier |
| `no-helper-folder-in-components` | `FILE-3` | `helper` — names which of the four folder kinds was found, then names the tree that folder belongs in |
| `export-matches-folder` | `FILE-1` | `mismatch` — names the folder, lists every direct named export it collected, and asks for the folder's own name or a prefixed member |
| `no-runtime-namespace` | `FILE-4` | `namespace` — names the binding and lists the members, then states the bundling cost |
| `monorepo-tier-belongs-to-its-side` | `FILE-5` | `featureInPackage` when a feature tier sits in the shared package, `vocabularyInApp` when a shape tier sits inside one app; each names the tier and the destination |
| `source-tier-marker-matches-folder` | `FILE-7` | `mismatch` — names the tier and the declared `meta.shape` value, then asks for the path owner and source marker to agree |
| `no-shell-tier` | `FILE-8` | `shell` — names the untyped `shells/` path and sends the owner to a named branch with typed contract content |

**No code is left without a rule.** `FILE-1` through `FILE-8` each
have exactly one machine, so there is nothing here to declare unenforced. What must be declared
instead is the reach of those machines: five are path-only, two use a path gate before reading source,
one reads source without a path gate, and the Escape hatches section below is the honest list of what
that leaves through.

The source's own file header describes "four rules". It publishes eight. The header is stale; the
export table is the truth.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means the pattern never matched and the rule made no judgement at all. `silent` and
   `out of scope` are different answers, and reporting the second as the first is how a leaky rule
   comes to be believed closed.
2. **Check the exemptions in their published order.** For the routing rule: a remaining path starting
   with `api/` or `_`, then a basename matching `\.test\.(tsx?|jsx?)$`, then a basename in the
   framework slot list. Anything caught by an earlier gate is never shown to a later one.
3. **Read the nodes only for the three source-reading rules.** `export-matches-folder` reads the export
   list after its filename gate; `source-tier-marker-matches-folder` reads an exported `meta` object
   after its tier gate; `no-runtime-namespace` reads declarators with no path gate at all. The other
   five rules receive a string and nothing else.
4. **Emit one block per finding.** The five path-only rules report once per file, on `Program`;
   `export-matches-folder` reports on `Program:exit`, `source-tier-marker-matches-folder` reports on
   the mismatched `shape` value, and `no-runtime-namespace` reports on the binding identifier.
5. **Write the `hatch` line whenever an open hatch would have silenced the same failure**, naming the
   exact rewrite.
6. **Do not report what no rule watches.** No rule here judges whether a route file draws, whether a
   package leaf knows a feature, or whether an unlinted extension exists; a verdict claiming otherwise
   is wrong about the module.

## `surface-folder-two-files-only` — FILE-2

**What it reports.** `extra` — names the tier, the surface folder and the remaining path, then names
the destination each kind of stray belongs to. Once per file, on `Program`.

**How it detects.** `context.filename`, back-slashes normalised, matched against
`/src/components/(pages|layouts)/<Name>/<rest>` or
`/src/components/overlays/<category>/<Name>/<rest>`; `<rest>` is then tested against
`^(component|index)(\.test)?\.tsx?$`.

**What it cannot see.** Moving the third component INTO `component.tsx` and exporting it from there —
the rule counts FILES, and three components in one file is one file. A surface folder holding only
`index.tsx` with the drawing inline: a path rule sees files that exist, never a file that is missing.
A flat overlay folder, `components/overlays/<Name>/extra.tsx`, because the overlay pattern requires a
category segment between the tier and the surface; omit the category and the folder is ungoverned. A
third file in a block, composite, branch, leaf or shell folder — only `pages`, `layouts` and
`overlays` are surface tiers. `constants.json`, `copy.md`, `styles.css` beside the two halves, because
a lint run only visits the extensions the config gives it. And a surface folder outside
`components/` — a shared package laying pages directly under `src/` omits the required
`components/` segment.

**Boundary.** This rule counts what sits beside the two halves in three tiers. Whether a helper folder
is legal anywhere in the component tree is `FILE-3`; whether the tier itself sits on the right side of
a workspace is `FILE-5`.

## `route-tree-holds-routes-only` — FILE-6

**What it reports.** `stray` — names the path under the routing tree and the basename that is not a
framework slot, then sends a screen to the page tier and a domain sentence to the block tier. Once per
file, on `Program`.

**How it detects.** `context.filename` matched against `/src/app/<rest>`; three gates applied in
order — `<rest>` starting with `api/` or `_`, then a basename matching `\.test\.(tsx?|jsx?)$`, then a
basename matching the framework slot list.

**What it cannot see.** A routing tree at the repository root with no `src/`: the pattern is
`/src/app/`, a root-level `app/` never matches, and that is the more common of the two layouts in the
wild. A route file that fetches and arranges inside `page.tsx` — the rule tests the NAME, and
"drawing" is not a property a filename can carry; the source says so itself. An underscore on a FILE
at the top of the tree, `app/FleetPageBase.tsx`, because the opt-out is tested against the whole
remaining path rather than against a segment. And note the mirror: `app/dashboard/_components/Card.tsx`
DOES fire while `app/_components/Card.tsx` does not — same convention, opposite result, the private
folder exempt only at the root of the tree, which is the one place it is least likely to be written. A
component named for a slot — a full page implementation in `template.tsx` or `default.tsx` — is
admitted without inspection, because slot names are an allow-list. A component parked under a test
name, `Hero.spec.tsx`, is exempt before the slot list is consulted.

**Boundary.** This rule judges a basename under one routing tree. What the file contains, and where
the component it hides should have lived, is decided by the law, not by this machine.

## `no-helper-folder-in-components` — FILE-3

**What it reports.** `helper` — names which of the four folder kinds was found, then names the tree
that folder belongs in. Once per file, on `Program`.

**How it detects.** `context.filename` matched against
`/src/components/.*/(constants|utils|types|hooks)/`. The trailing slash makes it a FOLDER test; the
`.*/` before it requires at least one path segment between the component root and the helper.

**What it cannot see.** A helper folder directly under the component root —
`components/utils/format.ts` — because the pattern requires at least one intermediate segment, so
the shallowest and most obvious placement is the one it cannot see. `helpers/`, `lib/`, `shared/`,
`util/`, `const/`, `models/`, `data/`: the four names are a closed literal list, and a synonym is a
folder the rule has never heard of. A helper as a FILE rather than a folder —
`blocks/<category>/<Name>/utils.ts` — because the trailing slash makes this a folder test, and the
block tier is outside the surface rule's reach, so the file escapes both rules at once.
`constants/tone.json`, `types/schema.json`: unlinted extensions reach no rule.

**Boundary.** This rule bans a folder NAME inside the component tree. It never opens the folder, so
whether the contents are genuinely non-rendering code is unjudged.

## `export-matches-folder` — FILE-1

**What it reports.** `mismatch` — names the folder, lists every direct named export it collected, and
asks for the folder's own name or a prefixed member. Reported on `Program:exit`.

**How it detects.** Filename gate `/<PascalCaseFolder>/index.tsx?$` selects the file; then AST —
`ExportNamedDeclaration` contributes declarator `id.name` from a `VariableDeclaration`, `id.name` from
a `FunctionDeclaration`, and `exported.name` from every specifier. On `Program:exit`, it reports when
the collected set is non-empty and no member equals the folder name or starts with it followed by an
upper-case character.

**What it cannot see.** `export * from "./component"` — the ordinary barrel — because a star export is
a different node type, contributes no name, and the empty set makes the rule return before judging
anything. `export default Paragraph` in folder `Text`: same different node type, same silent return.
`export class Paragraph {}` or `export enum Paragraph {}`: only variable and function declarations are
collected. One matching export carrying any number of unrelated passengers — `export const Text`
beside `export const formatSomething` — because membership is satisfied by ANY collected name, so a
single correct export clears the whole file; the rule's own description claims the opposite. A folder
that is not PascalCase, or a half that is not `index` — `text/index.tsx`, `Text/component.tsx`,
`Text/index.jsx` — because the filename gate is the rule, and a rename makes it stop existing for that
file. `export type Paragraph = …` in folder `Text` contributes no name, so a mismatched type family
passes unread.

**Boundary.** This rule reads the export list of one `index` half. It says nothing about what the
folder's other files export, and nothing about whether the exported thing is a component.

## `no-runtime-namespace` — FILE-4

**What it reports.** `namespace` — names the binding and lists the members, then states the bundling
cost. Reported on the declarator `id`.

**How it detects.** AST only, no path gate. `ExportNamedDeclaration` → `VariableDeclaration` → each
declarator whose `id.name` starts upper-case and whose `init` (after unwrapping `TSAsExpression`) is
an `ObjectExpression`; members are the non-computed `Property` keys that are `Identifier` nodes. It
reports when there are two or more members and every one starts upper-case.

**What it cannot see.** `export const Card = Object.assign(CardRoot, { Header, Footer })` — the most
popular way of building a dotted family — because the initialiser must be an object literal and a call
is invisible. `Card.Header = CardHeader` written after the declaration: assignment expressions are not
inspected, so the object is assembled outside the declarator the rule watches. `const Card = { Root,
Header }` then `export { Card }` on the next line: the export node then carries specifiers instead of
a declaration, and the rule only descends into a declaration. `export default { Root, Header }` is a
different node type entirely. One lower-case member — `{ Root, Header, displayName: "Card" }` —
because every member must look component-shaped, so adding `displayName` disables the rule for that
object wholesale. `export const Card = { Root, Header } satisfies Parts`: only the `as` wrapper is
unwrapped, its sibling operator is not. Quoted keys, `{ "Root": CardRoot, "Header": CardHeader }`,
are not `Identifier` nodes, so both members are discarded and the count falls below the threshold. A
lower-case binding, `export const card = { Root, Header }`, fails the first gate.

**Boundary.** This rule has no path gate, so it applies to every linted file in the repository,
including files that are not components at all. Where a file sits is judged by the path-reading rules,
the two path-gated source rules, and the shell rule, never by this one.

## `monorepo-tier-belongs-to-its-side` — FILE-5

**What it reports.** `featureInPackage` when a feature tier sits in the shared package,
`vocabularyInApp` when a shape tier sits inside one app; each names the tier and the destination. Once
per file, on `Program`.

**How it detects.** `context.filename` matched against
`/packages/<name>/src/(blocks|overlays|pages|layouts)/` and against
`/apps/<name>/src/(components/)?(contracts|leaves|composites|branches|shells)/`. The package test is
evaluated first and returns.

**What it cannot see.** `packages/ui/src/components/blocks/<category>/<Name>.tsx` — the app side
tolerates an optional `components/` segment and the package side does not, so the same violation
spelled with one extra folder is unseen. A workspace that names its folders `libs/`, `services/` or
`modules/`, because both patterns hard-code `packages/` and `apps/`. A domain-aware component sitting
in `packages/ui/src/leaves/<Name>/`: this is the exact failure the law describes and it is legal by
path, because the rule enforces where a TIER sits, never whether the file inside it knows a feature.
And the mirror — shared vocabulary parked in one app under a feature tier,
`apps/web/src/components/blocks/<category>/Badge/` — is a shape written into a legal folder, so
nothing looks at it.

**Boundary.** This rule decides which side of a workspace a tier folder sits on. Whether that folder
then obeys the surface, helper, routing, export, namespace, marker or shell rules is decided by the
other file-layout rules.

## `source-tier-marker-matches-folder` — FILE-7

**What it reports.** `mismatch` — names the tier and the exported `meta.shape` value that disagrees
with it. The report points at the literal shape value, once for each mismatched `meta` declaration.

**How it detects.** The filename is normalised and matched against
`/(?:src\/components|packages\/[^/]+\/src|apps\/[^/]+\/src\/(?:components\/)?)/(leaves|composites|branches|blocks|layouts|overlays|pages)\//`.
The expected markers are `leaf`, `composite`, `branch`, `block`, `layout`, `overlay` and `page`
respectively. In an exported `VariableDeclaration`, only a declarator named `meta` is inspected;
its `TSAsExpression` and `TSSatisfiesExpression` wrappers are removed, then a non-computed
`shape` property is read when its value is a string literal.

**What it cannot see.** A tier outside the closed path expression — including `contracts/`, `shells/`,
a package tree with `src/components/`, or a root-level `components/` tree — is out of scope. A
non-exported `meta`, a non-variable export, a computed `shape`, a spread or method, a non-literal
shape, and a `meta` object nested in another declaration are not inspected. The `contracts` entry in
the implementation's expected-marker map is unreachable because `contracts` is absent from its path
expression. The rule also checks only the declared marker; it does not prove that the surrounding
file actually behaves like the tier.

**Boundary.** This rule joins one path fact to one source fact. `no-shell-tier` owns the forbidden
shell path; the other file-layout rules own folder cardinality, helpers, exports, namespaces and
workspace side placement.

## `no-shell-tier` — FILE-8

**What it reports.** `shell` — names the `shells/` path as an untyped branch exemption and sends the
owner to a named branch with typed contract content and closed vendor mechanics. It reports once per
linted file, on `Program`.

**How it detects.** The normalised filename is matched against
`/(?:src\/components|packages\/[^/]+\/src|apps\/[^/]+\/src\/(?:components\/)?)\/shells\//`:
single-app `src/components/shells/`, package `packages/<name>/src/shells/`,
and app `apps/<name>/src/shells/` or `apps/<name>/src/components/shells/` all fire. The rule reads no
AST and has no import or metadata inspection.

**What it cannot see.** `shells/` outside those three layout prefixes, a root-level `app/` or
`components/` tree, and a shell-like folder with another name are out of scope. Imports containing
`/shells/` in an otherwise legal file and `meta.shape = "shell"` are also invisible: this published
rule is a path rule only. An extension the consuming ESLint glob does not lint reaches no rule.

**Boundary.** This rule forbids the physical shell tier. It does not migrate files, validate the
named branch, inspect contract slots, or enforce the separate marker law in `FILE-7`.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | Every path rule normalises back-slashes to forward slashes before matching, so one pattern serves both platforms |
| surface scope | `/src/components/(pages\|layouts)/<Name>/<rest>` or `/src/components/overlays/<category>/<Name>/<rest>`, with `<rest>` tested against `^(component\|index)(\.test)?\.tsx?$` |
| routing scope | `/src/app/<rest>`, then three exemption gates in order: `<rest>` starting with `api/` or `_`, a basename matching `\.test\.(tsx?\|jsx?)$`, a basename in the framework slot list |
| helper scope | `/src/components/.*/(constants\|utils\|types\|hooks)/` — the trailing slash makes it a folder test, the `.*/` demands one intermediate segment |
| workspace scope | `/packages/<name>/src/(blocks\|overlays\|pages\|layouts)/` and `/apps/<name>/src/(components/)?(contracts\|leaves\|composites\|branches\|shells)/`; the package test runs first and returns |
| source-marker scope | `/(?:src/components\|packages/[^/]+/src\|apps/[^/]+/src/(?:components/)?)/(leaves\|composites\|branches\|blocks\|layouts\|overlays\|pages)/`; only exported `meta` variable declarations, unwrapped through `TSAsExpression` / `TSSatisfiesExpression`, contribute a literal `shape` |
| shell scope | `/(?:src/components\|packages/[^/]+/src\|apps/[^/]+/src/(?:components/)?)/shells/`; a matching file reports on `Program` without reading its AST |
| export reader | Filename gate `/<PascalCaseFolder>/index.tsx?$`, then `ExportNamedDeclaration` collecting declarator `id.name`, function `id.name` and every specifier `exported.name`, decided on `Program:exit` |
| declarator reader | No path gate at all: upper-case `id.name`, `init` unwrapped through `TSAsExpression` and required to be an `ObjectExpression`, members the non-computed `Identifier` `Property` keys |
| what reaches outside the file | Nothing but the runner's globs. Five rules never open the file; two read source only after path gates; one never reads the path; an extension the consuming config does not lint reaches no rule here at all |

Three facts follow and are worth stating plainly. **Five of eight rules never read the file** — their
entire input is a string, and changing the string makes the rule cease to exist for that file, not
pass it. **Two rules read source only after a path gate** — the export list and `meta.shape` reader.
**One rule never reads the path** — `no-runtime-namespace` applies to every linted file in the
repository.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| Back-slashed paths on a platform that uses them | Every rule normalises to forward slashes before matching |
| Hiding a stray inside a route group or a dynamic segment — `(marketing)/`, `[id]/` | Only the basename is tested against the slot list; brackets and parentheses in ancestor segments change nothing |
| A framework slot with a modifier suffix — `page.module.css`, `opengraph-image.alt.ts` | The slot pattern admits one dotted middle segment, so genuine framework files pass and an invented basename still does not |
| Burying the helper folder deeper — `blocks/<category>/<Name>/parts/utils/x.ts` | The pattern allows any depth between the component root and the folder name |
| `export const Card = { Root, Header } as const` | The `as` wrapper is unwrapped before the object test |
| A near-miss name that borrows the prefix — folder `Text` exporting `Textual` | Family membership requires the character after the prefix to be upper-case, so only a real member such as `TextLink` passes |
| Re-exporting a foreign name through a specifier — `export { Paragraph } from "./component"` | Specifier names are collected exactly like declarations, so a barrel that renames cannot launder the mismatch |
| Dropping JSX so the half becomes `component.ts` | The allowed pattern accepts `.ts` and `.tsx` alike, so the split is enforced by NAME, not by syntax |
| An exported marker wrapped in `as const` or `satisfies Meta` — `export const meta = { shape: "block" } as const` | The marker rule unwraps both wrappers before reading the literal `shape` |
| A literal marker in the wrong tier — `src/components/leaves/Card/index.tsx` with `meta.shape = "block"` | The tier path is selected first and the shape value is reported at its literal |
| A shell path in any supported layout — `packages/ui/src/shells/Modal/index.tsx` | `no-shell-tier` reports every linted file under the closed `shells/` prefixes |
| A repository with no workspace at all | Neither workspace pattern matches, so the rule stays silent by design rather than firing on every folder in a single-app tree |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Rule | What passes |
|---|---|
| `surface-folder-two-files-only` | **The third component moved INTO `component.tsx`**, a folder holding only `index.tsx` with the drawing inline, **a flat overlay folder** with no category segment, a third file in a block, composite, branch, leaf or shell folder, `constants.json` / `copy.md` / `styles.css` beside the two halves, and any surface folder outside `components/` |
| `route-tree-holds-routes-only` | **A routing tree at the repository root with no `src/`**, a route file that fetches and arranges inside `page.tsx`, an underscore on a FILE at the top of the tree, the mirror where `app/dashboard/_components/Card.tsx` fires and `app/_components/Card.tsx` does not, a full page wearing a slot name such as `template.tsx` or `default.tsx`, and a component parked under a `.spec.tsx` name |
| `no-helper-folder-in-components` | **A helper folder directly under the component root**, any synonym — `helpers/`, `lib/`, `shared/`, `util/`, `const/`, `models/`, `data/` — a helper written as a FILE rather than a folder, and unlinted extensions such as `constants/tone.json` |
| `export-matches-folder` | **`export * from "./component"`**, `export default`, `export class` and `export enum`, **one matching export carrying any number of unrelated passengers**, a non-PascalCase folder or a half that is not `index` or an extension that is not `.ts`/`.tsx`, and `export type` |
| `no-runtime-namespace` | **`Object.assign(CardRoot, { Header, Footer })`**, `Card.Header = CardHeader` after the declaration, declare-then-`export { Card }`, `export default { Root, Header }`, **one lower-case member such as `displayName`**, `satisfies` instead of `as`, quoted keys, and a lower-case binding |
| `monorepo-tier-belongs-to-its-side` | **`packages/ui/src/components/blocks/…`** — the same violation with one extra segment — a workspace named `libs/`, `services/` or `modules/`, **a domain-aware component in `packages/ui/src/leaves/<Name>/`**, and shared vocabulary parked in one app's feature tier |
| `source-tier-marker-matches-folder` | **`contracts/` and `shells/` paths**, package `src/components/` paths, root-level trees, non-exported or non-variable `meta`, computed/spread/method `shape`, non-literal shape values, nested `meta`, the unreachable `contracts` expected-marker entry, and a file whose extension is not linted |
| `no-shell-tier` | **`shells/` outside the three supported prefixes**, shell-like names other than `shells`, imports containing `/shells/`, `meta.shape = "shell"`, root-level trees, and unlinted extensions; the rule is path-only |

That is the honest summary: all eight codes are held. Five holders decide from a path string alone,
two join a path gate to a narrow source read, and one reads source without a path gate. An ordinary
rename or one extra folder segment can therefore remove a rule rather than failing it.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path the runner passes as `context.filename`, before normalisation |
| tier segment | Which of `pages`, `layouts`, `overlays`, `blocks`, `leaves`, `composites`, `branches`, `shells`, `contracts` the path names; FILE-7 recognises only its closed seven-tier path set |
| workspace shape | Whether the repository has a `packages/` and `apps/` split, and whether the tree nests under `components/` |
| export list | For the three source-reading rules: every direct named export, its node type and its initialiser |
| source marker | For `source-tier-marker-matches-folder`: an exported variable named `meta`, its unwrapped object literal and literal `shape` property |
| runner globs | Which extensions the consuming config actually lints — an unlinted file reaches no rule at all |

## Rules

1. The published rule name is the rule's only identity. It is what a build prints, what a disable
   comment names, and what a report cites. There is no second identifier.
2. A rule holds exactly one law code, and a law code is held by exactly one rule.
3. A path rule reads the path and nothing else. It may not be described as if it read the file.
4. The five path-only rules report once per file, on `Program`. `export-matches-folder` reports on
   `Program:exit`, `source-tier-marker-matches-folder` on the mismatched `shape` value, and
   `no-runtime-namespace` on the binding identifier. A file is either in scope or it is not; there
   is no partial verdict.
5. Severity belongs to the consuming repository's config. The plugin publishes an opinion, not a
   setting.
6. A rule may only refuse what a machine can see. Everything else belongs in the law, and the gap
   between the two belongs in the Escape hatches section above.

## Exceptions

Each exception is closed and names the rule it applies to.

- **`export-matches-folder` is a suggestion, not a problem.** It is the one rule the source recommends
  adopting at warning level first in an existing tree: it fires on every folder whose convention
  predates it, and that count is a migration, not a defect. It releases nothing about the mismatch
  itself — only its severity.
- **A twin test beside a route file is exempt**, releasing `route-tree-holds-routes-only` for any
  basename matching `\.test\.(tsx?|jsx?)$`. A test ships in no bundle and no route renders it, so it
  cannot become the second screen the routing rule exists to prevent. The test's name is deliberately
  not required to match its subject, because route tests split by concern.
- **Server code and the framework's own opt-out folder are exempt from the routing rule**, releasing
  any remaining path starting with `api/` or `_` — at the root of the routing tree only. The
  narrowness of that "only" is an open hatch, listed above.
- **A repository with no workspace split is out of scope for `monorepo-tier-belongs-to-its-side`.**
  Widening it by one segment would fire on every block in every single-app tree.
- **Blocks, composites, branches, leaves and shells are out of scope for
  `surface-folder-two-files-only`.** Those tiers may legitimately hold more than two files. A shell
  path is nevertheless rejected independently by `no-shell-tier` when it matches that rule's prefix.

## Output

One block per finding:

```text
rule: <published rule name>
code: <FILE-1 … FILE-8>
file: <path the rule was given>
mechanism: <path match | export list | both>
verdict: <reported | silent | out of scope>
hatch: <none | the exact rewrite that would silence it>
```

`silent` and `out of scope` are different answers. A rule that examined a file and accepted it has
made a judgement; a rule whose pattern never matched has made none. A clean file in scope emits
`verdict: silent`; a file no pattern selected emits `verdict: out of scope`, and it has not passed.

## Worked example

**Input.** One surface folder, `components/pages/FleetPage/`:

```
src/components/pages/FleetPage/index.tsx
src/components/pages/FleetPage/component.tsx
src/components/pages/FleetPage/PriceTag.tsx
src/components/pages/FleetPage/utils/format.ts
```

```tsx
// src/components/pages/FleetPage/index.tsx
export const Fleet = () => <FleetPageBase />
```

```text
rule: surface-folder-two-files-only
code: FILE-2
file: src/components/pages/FleetPage/PriceTag.tsx
mechanism: path match
verdict: reported
hatch: none
```

```text
rule: surface-folder-two-files-only
code: FILE-2
file: src/components/pages/FleetPage/utils/format.ts
mechanism: path match
verdict: reported
hatch: none
```

```text
rule: no-helper-folder-in-components
code: FILE-3
file: src/components/pages/FleetPage/utils/format.ts
mechanism: path match
verdict: reported
hatch: none
```

```text
rule: export-matches-folder
code: FILE-1
file: src/components/pages/FleetPage/index.tsx
mechanism: both
verdict: reported
hatch: none
```

The helper file is reported twice, by two rules holding two different codes, because it is both a
third path in a surface folder and a helper folder inside the component tree.

**Repaired.** `PriceTag` moves to the block tier, `format` moves to the shared non-rendering tree, and
the index exports the folder's own name:

```
src/components/pages/FleetPage/index.tsx
src/components/pages/FleetPage/component.tsx
```

```tsx
// src/components/pages/FleetPage/index.tsx
export const FleetPage = () => <FleetPageBase />
```

But two open hatches survive the repair. A writer who moves `PriceTag` into `component.tsx` instead of
out of the folder gets the same silence:

```text
rule: surface-folder-two-files-only
code: FILE-2
file: src/components/pages/FleetPage/component.tsx
mechanism: path match
verdict: silent
hatch: the rule counts FILES — three components in one file is one file, so the stray is invisible rather than compliant
```

And a writer who replaces the named export with the ordinary barrel gets the same silence again:

```tsx
// src/components/pages/FleetPage/index.tsx
export * from "./component"
```

```text
rule: export-matches-folder
code: FILE-1
file: src/components/pages/FleetPage/index.tsx
mechanism: export list
verdict: silent
hatch: a star export contributes no name, so the collected set is empty and the rule returns before judging anything
```

Neither silence is compliance.

## Scope

This module documents enforcement, not style. It names no product, no component library, no repository
and no registry key. Rule names and message identifiers are reproduced exactly as they ship, because
those strings are what a build prints; everything else is ordinary prose about ordinary paths and
ordinary markup. What a route file draws, whether a package leaf knows a feature, whether a folder of
helpers is really non-rendering code, whether a marker describes the tier's behaviour, and whether a
named branch has replaced a shell are all owned by the law that states `FILE-1` through `FILE-8`, never
by these eight machines.
