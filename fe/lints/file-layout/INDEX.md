---
id: fe-lints-file-layout-index
title: INDEX.md
slug: /fe/lints/file-layout
sidebar_label: file-layout
sidebar_position: 0
description: What the six file-layout rules can actually see, and — stated plainly — what they cannot.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `file-layout`

## Law

Where a file sits is a claim about what it is. The law that states this is
[`patterns/file-layout.md`](../../canon/patterns/file-layout.md), and it carries six codes,
`FILE-1` through `FILE-6`.

This record documents something narrower and more useful: **enforcement**. Six rules hold those six
codes. Five of them read the PATH and one reads only the export list, which is what makes them cheap
and exact — and is also the whole of their cost. A path rule can tell a folder from a folder. It
cannot tell a component from a helper, a drawing route from a mounting one, or a domain sentence
from a shape.

So every section below has a twin. `Detection` states what the machine looks at. `Escape Hatches`
states what it therefore misses. The second is the point: a law with no rule is KNOWN to be
unenforced, while a leaky rule is BELIEVED to be closed, and the belief is the more expensive of the
two.

## Rules

Six rules are published. Each holds exactly one code, and each of the six codes has exactly one
rule — there is no code here without enforcement and no rule here without a code.

| Rule | Code | What it reports |
|---|---|---|
| `surface-folder-two-files-only` | `FILE-2` | `extra` — names the tier, the surface folder and the remaining path, then names the destination each kind of stray belongs to |
| `route-tree-holds-routes-only` | `FILE-6` | `stray` — names the path under the routing tree and the basename that is not a framework slot, then sends a screen to the page tier and a domain sentence to the block tier |
| `no-helper-folder-in-components` | `FILE-3` | `helper` — names which of the four folder kinds was found, then names the tree that folder belongs in |
| `export-matches-folder` | `FILE-1` | `mismatch` — names the folder, lists every direct named export it collected, and asks for the folder's own name or a prefixed member |
| `no-runtime-namespace` | `FILE-4` | `namespace` — names the binding and lists the members, then states the bundling cost |
| `monorepo-tier-belongs-to-its-side` | `FILE-5` | `featureInPackage` when a feature tier sits in the shared package, `vocabularyInApp` when a shape tier sits inside one app; each names the tier and the destination |

The source's own file header describes "four rules". It publishes six. The header is stale; the
export table is the truth. See `audit.md`.

## Detection

| Rule | Mechanism |
|---|---|
| `surface-folder-two-files-only` | `context.filename`, back-slashes normalised, matched against `/src/components/(pages\|layouts)/<Name>/<rest>` or `/src/components/overlays/<category>/<Name>/<rest>`; `<rest>` then tested against `^(component\|index)(\.test)?\.tsx?$`. Reports once on `Program`. |
| `route-tree-holds-routes-only` | `context.filename` matched against `/src/app/<rest>`; three gates applied in order — `<rest>` starting with `api/` or `_`, then a basename matching `\.test\.(tsx?\|jsx?)$`, then a basename matching the framework slot list. Reports once on `Program`. |
| `no-helper-folder-in-components` | `context.filename` matched against `/src/components/.*/(constants\|utils\|types\|hooks)/`. The trailing slash makes it a FOLDER test; the `.*/` before it requires at least one path segment between the component root and the helper. Reports once on `Program`. |
| `export-matches-folder` | Filename gate `/<PascalCaseFolder>/index.tsx?$` selects the file; then AST — `ExportNamedDeclaration` contributes declarator `id.name` from a `VariableDeclaration`, `id.name` from a `FunctionDeclaration`, and `exported.name` from every specifier. On `Program:exit`, reports when the collected set is non-empty and no member equals the folder name or starts with it followed by an upper-case character. |
| `no-runtime-namespace` | AST only, no path gate. `ExportNamedDeclaration` → `VariableDeclaration` → each declarator whose `id.name` starts upper-case and whose `init` (after unwrapping `TSAsExpression`) is an `ObjectExpression`; members are the non-computed `Property` keys that are `Identifier` nodes. Reports on the declarator `id` when there are two or more members and every one starts upper-case. |
| `monorepo-tier-belongs-to-its-side` | `context.filename` matched against `/packages/<name>/src/(blocks\|overlays\|pages\|layouts)/` and against `/apps/<name>/src/(components/)?(contracts\|leaves\|composites\|branches\|shells)/`. The package test is evaluated first and returns. Reports once on `Program`. |

Two facts follow from this table and are worth stating before the next section.

**Five of six rules never read the file.** Their entire input is a string. Change the string and the
rule ceases to exist for that file — not "passes", ceases to exist.

**One rule never reads the path.** `no-runtime-namespace` applies to every linted file in the
repository, including files that are not components at all.

## Escape Hatches

### Closed

Ways of writing that a reader might reasonably expect to slip past, and the reason they do not.

| Rule | Attempt | Why it still fires |
|---|---|---|
| all path rules | Back-slashed paths on a platform that uses them | Every rule normalises to forward slashes before matching, so one pattern serves both platforms |
| `route-tree-holds-routes-only` | Hiding a stray inside a route group or a dynamic segment — `(marketing)/`, `[id]/` | Only the basename is tested against the slot list; brackets and parentheses in ancestor segments change nothing |
| `route-tree-holds-routes-only` | A framework slot with a modifier suffix — `page.module.css`, `opengraph-image.alt.ts` | The slot pattern admits one dotted middle segment, so genuine framework files pass and an invented basename still does not |
| `no-helper-folder-in-components` | Burying the helper folder deeper — `blocks/<category>/<Name>/parts/utils/x.ts` | The pattern allows any depth between the component root and the folder name |
| `no-runtime-namespace` | `export const Card = { Root, Header } as const` | The `as` wrapper is unwrapped before the object test |
| `export-matches-folder` | A near-miss name that borrows the prefix — folder `Text` exporting `Textual` | Family membership requires the character after the prefix to be upper-case, so only a real member such as `TextLink` passes |
| `export-matches-folder` | Re-exporting a foreign name through a specifier — `export { Paragraph } from "./component"` | Specifier names are collected exactly like declarations, so a barrel that renames cannot launder the mismatch |
| `surface-folder-two-files-only` | Dropping JSX so the half becomes `component.ts` | The allowed pattern accepts `.ts` and `.tsx` alike, so the split is enforced by NAME, not by syntax |
| `monorepo-tier-belongs-to-its-side` | A repository with no workspace at all | Neither pattern matches, so the rule stays silent by design rather than firing on every folder in a single-app tree |

### Open

Ways of writing that these rules genuinely do NOT catch. Each row was checked against the rule, not
inferred from its name.

| Rule | What slips through | Why |
|---|---|---|
| `surface-folder-two-files-only` | Moving the third component INTO `component.tsx` and exporting it from there | The rule counts FILES. Three components in one file is one file |
| `surface-folder-two-files-only` | A surface folder holding only `index.tsx`, with the drawing inline | A path rule sees files that exist; it can never see a file that is missing |
| `surface-folder-two-files-only` | A flat overlay folder — `components/overlays/<Name>/extra.tsx` | The overlay pattern requires a category segment between the tier and the surface. Omit the category and the pattern stops matching, so the folder is ungoverned |
| `surface-folder-two-files-only` | A third file in a block, composite, branch, leaf or shell folder | Only `pages`, `layouts` and `overlays` are surface tiers. The same habit in any other tier is unenforced |
| `surface-folder-two-files-only` | `constants.json`, `copy.md`, `styles.css` beside the two halves | The rule fires from a lint run, and a lint run only visits the extensions the config gives it. Anything else is invisible to every rule here |
| `surface-folder-two-files-only` | A surface folder outside `src/components/` — a shared package laying pages directly under `src/` | The prefix `/src/components/` is required. A tree that omits the `components/` segment is ungoverned by this rule |
| `route-tree-holds-routes-only` | A routing tree at the repository root, with no `src/` | The pattern is `/src/app/`. A root-level `app/` never matches, and this is the more common of the two layouts in the wild |
| `route-tree-holds-routes-only` | A route file that fetches and arranges inside `page.tsx` | The rule tests the NAME. "Drawing" is not a property a filename can carry, and the source says so |
| `route-tree-holds-routes-only` | An underscore on a FILE at the top of the tree — `app/_FleetPage.tsx` | The opt-out is tested against the whole remaining path, not against a segment, so a leading underscore anywhere at the front exempts a file as readily as a folder |
| `route-tree-holds-routes-only` | Nothing at all — but note the mirror: `app/dashboard/_components/Card.tsx` DOES fire while `app/_components/Card.tsx` does not | Same anchor, opposite result. The private folder is exempt only at the root of the tree, which is the one place it is least likely to be written |
| `route-tree-holds-routes-only` | A component named for a slot — a full page implementation in `template.tsx` or `default.tsx` | Slot names are an allow-list. Anything wearing one is admitted without inspection |
| `route-tree-holds-routes-only` | A component parked under a test name — `Hero.test.tsx` | Any basename ending `.test.tsx` is exempt before the slot list is consulted |
| `no-helper-folder-in-components` | A helper folder directly under the component root — `src/components/utils/format.ts` | The pattern requires at least one segment between `components/` and the helper name. The shallowest and most obvious placement is the one it cannot see |
| `no-helper-folder-in-components` | `helpers/`, `lib/`, `shared/`, `util/`, `const/`, `models/`, `data/` | The four names are a closed literal list. A synonym is a new folder the rule has never heard of |
| `no-helper-folder-in-components` | A helper as a FILE rather than a folder — `blocks/<category>/<Name>/utils.ts` | The trailing slash makes this a folder test, and the block tier is outside the surface rule's reach, so the file escapes both rules at once |
| `no-helper-folder-in-components` | `constants/tone.json`, `types/schema.json` | Same extension limit as above: unlinted files reach no rule |
| `export-matches-folder` | `export * from "./component"` — the ordinary barrel | A star export is a different node type and contributes no name, so the collected set is empty and the rule returns before judging anything |
| `export-matches-folder` | `export default Paragraph` in folder `Text` | A default export is a different node type. Same empty set, same silent return |
| `export-matches-folder` | `export class Paragraph {}` or `export enum Paragraph {}` in folder `Text` | Only variable and function declarations are collected. A class or enum contributes no name |
| `export-matches-folder` | One matching export carrying any number of unrelated passengers — `export const Text`, `export const formatSomething` | Membership is satisfied by ANY collected name, so a single correct export clears the whole file. The rule's own description claims the opposite |
| `export-matches-folder` | A folder that is not PascalCase, or a half that is not `index` — `text/index.tsx`, `Text/component.tsx`, `Text/index.jsx` | The filename gate is the rule. Rename the folder, the file or the extension and the rule stops existing for it |
| `export-matches-folder` | `export type Paragraph = …` in folder `Text` | A type alias declaration contributes no name, so a mismatched type family passes unread |
| `no-runtime-namespace` | `export const Card = Object.assign(CardRoot, { Header, Footer })` | The initialiser must be an object literal. The most popular way of building a dotted family is a call, so it is invisible |
| `no-runtime-namespace` | `Card.Header = CardHeader` written after the declaration | Assignment expressions are not inspected. The object is assembled outside the declarator the rule watches |
| `no-runtime-namespace` | `const Card = { Root, Header }` then `export { Card }` on the next line | The export node then carries specifiers instead of a declaration, and the rule only descends into a declaration |
| `no-runtime-namespace` | `export default { Root, Header }` | A default export is a different node type entirely |
| `no-runtime-namespace` | One lower-case member — `{ Root, Header, displayName: "Card" }` | Every member must look component-shaped. A single lower-case key makes the check skip the declarator wholesale, so adding `displayName` disables the rule for that object |
| `no-runtime-namespace` | `export const Card = { Root, Header } satisfies Parts` | Only the `as` wrapper is unwrapped. Its sibling operator is not |
| `no-runtime-namespace` | Quoted keys — `{ "Root": CardRoot, "Header": CardHeader }` | A string key is not an `Identifier`, so both members are discarded and the count falls below the threshold |
| `no-runtime-namespace` | A lower-case binding — `export const card = { Root, Header }` | The binding name must start upper-case |
| `monorepo-tier-belongs-to-its-side` | `packages/ui/src/components/blocks/<category>/<Name>.tsx` | The app side tolerates an optional `components/` segment; the package side does not. The same violation spelled with one extra folder is unseen |
| `monorepo-tier-belongs-to-its-side` | A workspace that names its folders `libs/`, `services/` or `modules/` | Both patterns hard-code `packages/` and `apps/` |
| `monorepo-tier-belongs-to-its-side` | A domain-aware component sitting in `packages/ui/src/leaves/<Name>/` | This is the exact failure the law describes, and it is legal by path. The rule enforces where a TIER sits, never whether the file inside it knows a feature |
| `monorepo-tier-belongs-to-its-side` | Shared vocabulary parked in one app under a feature tier — `apps/web/src/components/blocks/<category>/Badge/` | A shape written into a feature tier is in a legal folder, so nothing looks at it |

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path the runner passes as `context.filename`, before normalisation |
| tier segment | Which of `pages`, `layouts`, `overlays`, `blocks`, `leaves`, `composites`, `branches`, `shells`, `contracts` the path names |
| workspace shape | Whether the repository has a `packages/` and `apps/` split, and whether the tree nests under `components/` |
| export list | For the two AST rules: every direct named export, its node type and its initialiser |
| runner globs | Which extensions the consuming config actually lints — an unlinted file reaches no rule at all |

## Invariants

- The published rule name is the rule's only identity. It is what a build prints, what a disable
  comment names, and what a report cites. There is no second identifier.
- A rule holds exactly one law code, and a law code is held by exactly one rule.
- A path rule reads the path and nothing else. It may not be described as if it read the file.
- The five path rules report once per file, on `Program`. A file is either in scope or it is not;
  there is no partial verdict.
- Severity belongs to the consuming repository's config. The plugin publishes an opinion, not a
  setting.
- A rule may only refuse what a machine can see. Everything else belongs in the law, and the gap
  between the two belongs in `Escape Hatches` above.

## Exceptions

Each exception is closed and names the rule it applies to.

- **`export-matches-folder` is a suggestion, not a problem.** It is the one rule the source
  recommends adopting at warning level first in an existing tree: it fires on every folder whose
  convention predates it, and that count is a migration, not a defect.
- **A twin test beside a route file is exempt.** A test ships in no bundle and no route renders it,
  so it cannot become the second screen the routing rule exists to prevent. The test's name is
  deliberately not required to match its subject, because route tests split by concern.
- **Server code and the framework's own opt-out folder are exempt from the routing rule**, at the
  root of the routing tree only. The narrowness of that "only" is an open hatch, listed above.
- **A repository with no workspace split is out of scope for the monorepo rule.** Widening it by one
  segment would fire on every block in every single-app tree.
- **Blocks, composites, branches, leaves and shells are out of scope for the surface-folder rule.**
  Those tiers may legitimately hold more than two files.

## Output

```text
rule: <published rule name>
code: <FILE-1 … FILE-6>
file: <path the rule was given>
mechanism: <path match | export list | both>
verdict: <reported | silent | out of scope>
hatch: <none | the exact rewrite that would silence it>
```

`silent` and `out of scope` are different answers. A rule that examined a file and accepted it has
made a judgement; a rule whose pattern never matched has made none, and reporting the second as the
first is how a leaky rule comes to be believed closed.

## Load Policy

Read this file first. Read `vi.md` for what each rule catches, why the law deserves a machine at
all, and which door is still open. Read `example.md` for the failing and passing code of every rule
plus the code that slips through. Read `audit.md` while reviewing enforcement itself, and
`changelog.md` for the version history.

## Scope

This module documents enforcement, not style. It names no product, no component library, no
repository and no registry key. Rule names and message identifiers are reproduced exactly as they
ship, because those strings are what a build prints; everything else is ordinary prose about
ordinary paths and ordinary markup.

## Version Rule

Increment all five records by `0.01` when a rule's behaviour changes, when a rule is added to or
removed from the source, or when a hatch moves between the closed and open tables. Record it in
`changelog.md`.
