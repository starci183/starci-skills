---
id: fe-lints-loading-index
title: INDEX.md
slug: /gates/lints/loading
sidebar_label: loading
sidebar_position: 0
description: What a machine can see of the loading law, and — written down here — what it cannot.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `loading`

## Law

A surface waiting for data draws the same shape it will draw when the data arrives, with the values
taken out. A second tree describing the first is correct on the day it is written and wrong the first
time the real shape changes, and nothing turns red when it does: a resting shape has no assertion to
fail. That is the whole reason this law is worth machine time — it is the class of defect no compiler
and no test will ever report.

The law lives in `fe/canon/patterns/loading.md` and carries seven codes, `LOADING-1` through
`LOADING-7`. The rules recorded here hold **two** of those seven. The other five are unheld, and that
is stated plainly rather than implied: an unheld law is known to be unenforced, which is a safer
condition than a leaky rule believed to be closed.

## Rules

Three rules are published. Their identity is the name a build prints; there is no numeric code for a
rule, only for the law it holds.

| Rule | Law code | What it reports |
|---|---|---|
| `no-resting-twin-component` | `LOADING-1` | `twin` — this file **is** a hand-mirrored twin, named after the component it copies. Reported once, on `Program`, so the whole file is the finding. |
| `no-placeholder-prop` | `LOADING-1` | `prop` — a ready-made tree handed in through a `skeleton`, `placeholder` or `fallback` attribute. `import` — a `*Skeleton` binding pulled in over a relative path. |
| `no-resting-branch-at-call-site` | `LOADING-2` | `branch` — a waiting flag choosing between two **different** root elements, quoting the flag text back (first 40 characters). |

Two rules hold one code between them, because `LOADING-1` forbids two shapes of the same mistake: a
twin declared as a file, and a twin handed in as a prop. Nothing holds `LOADING-3` (collapsed
height), `LOADING-4` (assistive silence), `LOADING-5` (a control with nowhere to go), `LOADING-6`
(one flag across independent regions) or `LOADING-7` (waiting as a member of the state union). Those
five appear in `audit.md`, not here — a rule that cannot be pointed at is a proposal.

## Detection

Every rule first asks the same question of the file, and asks it of nothing else:

| Gate | Mechanism |
|---|---|
| path normalisation | `String(filename).replace(/\\/g, "/")` — backslash paths compare like every other path |
| in scope | `normalizePath(context.filename).includes("/src/components/")` — a plain substring test |
| out of scope | `/\.(?:test\|spec)\.(?:ts\|tsx)$/` — a twin built by hand inside a test is a fixture |

Then, per rule:

| Rule | Mechanism |
|---|---|
| `no-resting-twin-component` | **Filename only. The file's contents are never parsed for this decision.** `context.filename` is matched against `/\/([A-Za-z0-9]*Skeleton)\/index\.tsx?$/`, then against `/\/([A-Za-z0-9]*Skeleton)\.tsx?$/`; the captured segment is re-tested against `^[A-Za-z0-9]*Skeleton$`. On a hit it registers a `Program` visitor and reports the node the parser hands it. |
| `no-placeholder-prop` (`prop`) | `JSXAttribute` visitor. The attribute's `name.type` must be `JSXIdentifier` and its `name.name` must be exactly `skeleton`, `placeholder` or `fallback`. The value must be a `JSXExpressionContainer` whose `expression.type` is `JSXElement` or `JSXFragment`. Three names, one container type, two expression types — nothing else is examined. |
| `no-placeholder-prop` (`import`) | `ImportDeclaration` visitor. `node.source.value` must be a string matching `/^\.\.?\//` — a relative path. Each specifier's `local.name` is tested against `^[A-Za-z0-9]*Skeleton$`, with the exact string `Skeleton` excluded because that is the primitive a component rests **with**, not a twin of one. |
| `no-resting-branch-at-call-site` | `ConditionalExpression` visitor. The test is read back as **source text** — `sourceCode.getText(node.test)` — and matched against `/\bis(?:Loading\|Skeleton\|Pending)\b/`. Each arm is reduced to a single string: a `JSXElement` becomes its opening name (`JSXIdentifier`, or `object.property` for a `JSXMemberExpression`), a `JSXFragment` becomes `"<>"`, and anything else becomes `null`. It reports only when both strings exist and differ. |

The reduction in the last row is the load-bearing detail of this whole module: the rule compares
**root element names**, not trees.

## Escape Hatches

### Closed

A way of writing that a reader might expect to slip past, and why it does not.

| Rule | The attempt | Why it does not work |
|---|---|---|
| `no-resting-twin-component` | Windows-style path separators in the target repository | `normalizePath` rewrites `\` to `/` before any match |
| `no-resting-twin-component` | Burying the twin deeper: `.../leaves/media/AvatarSkeleton/index.tsx` | Both patterns anchor on the last `/`, at any depth |
| `no-resting-twin-component` | Dropping the `x`: `AvatarSkeleton.ts` | `tsx?` matches `.ts` as well as `.tsx` |
| `no-placeholder-prop` | An empty tree: `skeleton={<></>}` | `JSXFragment` is handled beside `JSXElement` |
| `no-placeholder-prop` | A long climb: `import { AvatarSkeleton } from "../../leaves/AvatarSkeleton"` | `^\.\.?\/` matches any relative depth |
| `no-placeholder-prop` | `placeholder="Search"` on a text field | Only a `JSXExpressionContainer` holding an element reports; a string literal is left alone on purpose |
| `no-resting-branch-at-call-site` | Negating the flag: `!isLoading ? <Avatar/> : <Bar/>` | The test is matched as text; `\bisLoading\b` is still in it |
| `no-resting-branch-at-call-site` | Resting as a bare fragment: `isLoading ? <></> : <Avatar/>` | `"<>"` is a name like any other, and it differs from `Avatar` |
| `no-resting-branch-at-call-site` | Two halves of one namespace: `isPending ? <Card.Bar/> : <Card.Body/>` | `JSXMemberExpression` resolves to `Card.Bar` and `Card.Body` |
| all three | Writing the offence in a page, then importing it | Nothing is caught, but nothing is claimed either — see the first Open row |

### Open

A way of writing these rules genuinely do NOT catch. Every one below was read out of the
implementation, not imagined.

| Rule | What slips through | Why the rule cannot see it |
|---|---|---|
| all three | The same offence written outside `/src/components/` — in a route folder, a feature folder, a second package, or any tree that spells the folder differently | Scope is a substring test on the path. A directory rename removes all three rules at once, silently, and the build stays green |
| all three | A file named `*.stories.tsx` | Only `.test.` and `.spec.` are treated as fixtures, so a demonstration of resting shapes is judged as product source |
| `no-resting-twin-component` | Any number of twins **declared inside a correctly named file**: `export const AvatarSkeleton = () => …` sitting in `Avatar/index.tsx` | The rule never inspects declarations. It is a filename rule wearing an AST visitor |
| `no-resting-twin-component` | The same twin under any other word: `AvatarPlaceholder`, `AvatarLoading`, `AvatarShimmer`, `AvatarResting`, `avatar-skeleton.tsx`, `Card.Skeleton.tsx` | The pattern is a case-sensitive literal `Skeleton` in a segment of `[A-Za-z0-9]` only. A dot or a hyphen in the filename ends the match |
| `no-resting-twin-component` | `AvatarSkeleton/view.tsx`, `AvatarSkeleton/render.tsx` — the folder is named, the file is not `index` | The first pattern requires `index`; the second requires the twin name on the file itself |
| `no-resting-twin-component` | `AvatarSkeleton.jsx` | The extension pattern is `tsx?`; `jsx` is not in it |
| `no-placeholder-prop` (`prop`) | The element gathered into a name first: `const resting = <AvatarBar/>` then `skeleton={resting}`. Also `skeleton={SHAPES.avatar}`, `skeleton={renderResting()}`, `skeleton={<AvatarBar/> as ReactNode}`, `fallback={isWide ? <A/> : <B/>}` | The check is on `expression.type`. An `Identifier`, `MemberExpression`, `CallExpression`, `TSAsExpression` or `ConditionalExpression` is not `JSXElement`, and nothing follows the reference |
| `no-placeholder-prop` (`prop`) | The component itself rather than an element: `skeleton={AvatarBar}`, rendered inside as `<Skeleton/>` | Same reason. A reference is not an element |
| `no-placeholder-prop` (`prop`) | Any fourth name: `loadingView={<X/>}`, `restingSlot={<X/>}`, `renderSkeleton={() => <X/>}`, `emptyState={<X/>}` | The name list is closed at three, and a function returning the element is a `JSXExpressionContainer` holding an `ArrowFunctionExpression` |
| `no-placeholder-prop` (`prop`) | **The tree passed inside an object prop**: `props={{ fallback: <AvatarBar/> }}` | That is a `Property` inside an `ObjectExpression`, not a `JSXAttribute`. Where a codebase routes everything through one object prop, this rule sees almost nothing |
| `no-placeholder-prop` (`import`) | `import { AvatarSkeleton } from "@/components/leaves/AvatarSkeleton"` | The source must start `./` or `../`. An aliased or bare-specifier import is never examined, and aliases are the ordinary way to import |
| `no-placeholder-prop` (`import`) | `import { AvatarSkeleton as Resting } from "./x"`, or `import * as Shapes from "./skeletons"` | Only `specifier.local.name` is tested. The imported name is never read, so a rename at the import site is a complete escape |
| `no-placeholder-prop` (`import`) | `import { AvatarPlaceholder } from "./x"` | The name pattern is the literal `Skeleton` again |
| `no-resting-branch-at-call-site` | **The same root tag on both arms**: `isLoading ? <div className="h-4 animate-pulse"/> : <div><Avatar/><Text/></div>` | Both arms reduce to `div`, the strings are equal, and the rule returns. Two entirely different trees pass as one. The same applies to a shared wrapper: `isLoading ? <Row><Bar/></Row> : <Row><Avatar/><Text/></Row>` |
| `no-resting-branch-at-call-site` | The state read inline: `input.state === "pending" ? <AvatarBar/> : <Avatar/>` | The flag pattern needs the literal `is` followed by `Loading`, `Skeleton` or `Pending`. A union member spelled `"pending"` is invisible — which is the exact expression the law's own seam paragraph is written about |
| `no-resting-branch-at-call-site` | A qualified flag: `isLoadingCourses ? <A/> : <B/>`, `isPendingReview ? <A/> : <B/>` | `\b` after `Loading` fails against a following word character. Adding a noun to the flag removes the rule |
| `no-resting-branch-at-call-site` | Another spelling of waiting: `loading`, `busy`, `isFetching`, `isWaiting`, `!data` | Three spellings are recognised; the rest are not |
| `no-resting-branch-at-call-site` | The branch written as anything but a ternary: `if (isLoading) return <AvatarBar/>`, `{isLoading && <AvatarBar/>}` beside `{!isLoading && <Avatar/>}`, or a `switch` over the state union | Only `ConditionalExpression` is visited |
| `no-resting-branch-at-call-site` | The component chosen into a name: `const El = isLoading ? AvatarBar : Avatar` then `<El/>` | Both arms are `Identifier`, `armName` returns `null`, and the rule declines |

## Inputs

| Input | Evidence required |
|---|---|
| `context.filename` | Absolute or repository-relative path of the file being linted |
| source text | Parsed as TypeScript with JSX; the branch rule additionally reads its test back as text |
| nothing else | No type information, no module resolution, no cross-file reading, no configuration options — every rule declares `schema: []` |

## Invariants

- A rule's identity is the name it publishes. There is no second identifier for it anywhere.
- Every rule is `type: "problem"` and takes no options.
- Scope is decided before anything else; outside `/src/components/`, `create` returns an empty
  visitor object and the rule costs nothing.
- The twin rule reports at most once per file, on `Program`.
- `null` on one arm of a waiting ternary is never reported: a control with nowhere to go yet is
  `LOADING-5` behaving correctly, not a second tree.
- The bare name `Skeleton` is never a twin. It is the primitive a component rests **with**.
- No rule offers a fix. Every finding is a shape decision a person has to make.

## Exceptions

Exceptions are part of the rules, not relief from them.

- **Tests.** A file ending `.test.ts`, `.test.tsx`, `.spec.ts` or `.spec.tsx` is exempt from all
  three. A twin built by hand in a test is a fixture asserted against, not a second description
  anybody renders.
- **Everything outside the component tree.** Stated as an exception because it is the widest one:
  the rules govern the component tree and nothing else.
- **The resting primitive.** An import whose local name is exactly `Skeleton` is exempt from the
  import half of `no-placeholder-prop`. It is not exempt from `no-resting-twin-component`, and that
  disagreement is a finding — see `audit.md`.
- **A ternary with `null` on one side.** Left alone by design.
- **The literal `placeholder` attribute of a text field.** A string value never reports.

## Output

A run emits ordinary lint findings. The rule name is the whole identity; nothing else is printed to
identify which law was broken.

```text
<file>:<line>:<column>  error  <message>  starci-fe/<rule-name>
```

The plugin's own opinion of severity, exported as `recommended`, is `error` for all three. A
repository adopting them with history should expect the twin rule to report a folder at a time:
hand-kept placeholder trees arrive in families, one per screen, and each is a real shape that has to
be folded back into the component it copies rather than deleted.

## Load Policy

Read this file first for what is held and what is not. Read `vi.md` for why each rule is worth
machine time, `example.md` for the code that fires and the code that slips through, `audit.md` while
reviewing whether these rules still deserve to be trusted, and `changelog.md` for what changed.

## Scope

This module records enforcement for one law of one front-end canon. It names no product, no
component library and no repository in its prose or its examples. Rule names and the package name
are identifiers that ship, and are reproduced verbatim.

## Version Rule

Increment all five records by `0.01` when a rule is added, removed, or changes what it detects, and
record it in `changelog.md`. Discovering a new open escape hatch is a documentation change to this
module and increments it too — the hatch existed before it was written down, and the point of the
shelf is that it is written down.
