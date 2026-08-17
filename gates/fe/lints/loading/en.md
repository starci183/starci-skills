---
title: Loading
---

# Loading

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses no resting shape. It refuses one, and it must be able to point at the filename, the attribute
or the ternary it refuses on.

## Law

A surface waiting for data draws the same shape it will draw when the data arrives, with the values
taken out. A second tree describing the first is correct on the day it is written and wrong the first
time the real shape changes, and nothing turns red when it does: a resting shape has no assertion to
fail. That is the whole reason this law is worth machine time — it is the class of defect no compiler
and no test will ever report.

The law lives in `patterns/fe/loading/INDEX.md` and carries seven codes, `LOADING-1` through
`LOADING-7`. The rules recorded here hold **two** of those seven. The other five are unheld, and that
is stated plainly rather than implied: an unheld law is known to be unenforced, which is a safer
condition than a leaky rule believed to be closed.

## Published rules

Three rules are published. Their identity is the name a build prints; there is no numeric code for a
rule, only for the law it holds.

| Rule | Code | What it reports |
|---|---|---|
| `no-resting-twin-component` | `LOADING-1` | `twin` — this file **is** a hand-mirrored twin, named after the component it copies. Reported once, on `Program`, so the whole file is the finding. |
| `no-placeholder-prop` | `LOADING-1` | `prop` — a ready-made tree handed in through a `skeleton`, `placeholder` or `fallback` attribute. `import` — a `*Skeleton` binding pulled in over a relative path. |
| `no-resting-branch-at-call-site` | `LOADING-2` | `branch` — a waiting flag choosing between two **different** root elements, quoting the flag text back (first 40 characters). |

Two rules hold one code between them, because `LOADING-1` forbids two shapes of the same mistake: a
twin declared as a file, and a twin handed in as a prop.

Nothing holds `LOADING-3` (collapsed height), `LOADING-4` (assistive silence), `LOADING-5` (a control
with nowhere to go), `LOADING-6` (one flag across independent regions) or `LOADING-7` (waiting as a
member of the state union). Those five have **no rule at all** — they are unenforced, not covered, and
a green run says nothing about any of them. They appear in `audit.md`, not here: a rule that cannot be
pointed at is a proposal.

## Reading a diff

1. **Decide scope before anything else, and record it.** The normalised path must contain
   `/src/components/`. Out of scope does not mean the file passed — `create` returns an empty visitor
   object and the rule did not exist for that file.
2. **Check the exemptions next.** A filename matching `/\.(?:test|spec)\.(?:ts|tsx)$/` is a fixture and
   is exempt from all three rules. A `placeholder` attribute holding a string literal is exempt by
   design. A ternary with `null` on one arm is exempt by design.
3. **Read the nodes the rules actually visit.** The filename for `no-resting-twin-component`;
   `JSXAttribute` and `ImportDeclaration` for `no-placeholder-prop`; `ConditionalExpression` for
   `no-resting-branch-at-call-site`. Nothing else in the file is evidence.
4. **Emit one block per finding** — one `twin` per file at most, one `prop` per offending attribute,
   one `import` per offending specifier, one `branch` per offending ternary.
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure**, including on
   a file that reported nothing.
6. **Do not report what no rule watches.** Five of the seven codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `no-resting-twin-component` — LOADING-1

**What it reports.** `twin` — one report per file, on `Program`, so the whole file is the finding, not
a line inside it.

**How it detects.** **Filename only. The file's contents are never parsed for this decision.**
`context.filename` is matched against `/\/([A-Za-z0-9]*Skeleton)\/index\.tsx?$/`, then against
`/\/([A-Za-z0-9]*Skeleton)\.tsx?$/`; the captured segment is re-tested against `^[A-Za-z0-9]*Skeleton$`.
On a hit it registers a `Program` visitor and reports the node the parser hands it.

**What it cannot see.** Any number of twins **declared inside a correctly named file**:
`export const AvatarSkeleton = () => …` sitting in `Avatar/index.tsx` — the rule never inspects
declarations, it is a filename rule wearing an AST visitor. The same twin under any other word:
`AvatarPlaceholder`, `AvatarLoading`, `AvatarShimmer`, `AvatarResting`, `avatar-skeleton.tsx`,
`Card.Skeleton.tsx` — the pattern is a case-sensitive literal `Skeleton` in a segment of `[A-Za-z0-9]`
only, so a dot or a hyphen in the filename ends the match. `AvatarSkeleton/view.tsx` and
`AvatarSkeleton/render.tsx`, where the folder is named but the file is not `index`: the first pattern
requires `index`, the second requires the twin name on the file itself. And `AvatarSkeleton.jsx` — the
extension pattern is `tsx?`, and `jsx` is not in it.

**Boundary.** This rule judges a name on disk. Whether a resting tree is handed across as a value is
`no-placeholder-prop`; whether it is written inline at the call site is
`no-resting-branch-at-call-site`.

## `no-placeholder-prop` — LOADING-1

**What it reports.** `prop` — a ready-made tree handed in through an attribute. `import` — a
`*Skeleton` binding pulled in over a relative path. Two reports, one offence: a twin the described
component cannot even see.

**How it detects.** The `prop` half is a `JSXAttribute` visitor. The attribute's `name.type` must be
`JSXIdentifier` and its `name.name` must be exactly `skeleton`, `placeholder` or `fallback`. The value
must be a `JSXExpressionContainer` whose `expression.type` is `JSXElement` or `JSXFragment`. Three
names, one container type, two expression types — nothing else is examined. The `import` half is an
`ImportDeclaration` visitor. `node.source.value` must be a string matching `/^\.\.?\//` — a relative
path. Each specifier's `local.name` is tested against `^[A-Za-z0-9]*Skeleton$`, with the exact string
`Skeleton` excluded, because that is the primitive a component rests **with**, not a twin of one.

**What it cannot see.** The element gathered into a name first: `const resting = <AvatarBar/>` then
`skeleton={resting}`. Also `skeleton={SHAPES.avatar}`, `skeleton={renderResting()}`,
`skeleton={<AvatarBar/> as ReactNode}`, `fallback={isWide ? <A/> : <B/>}` — the check is on
`expression.type`, and an `Identifier`, `MemberExpression`, `CallExpression`, `TSAsExpression` or
`ConditionalExpression` is not `JSXElement`; nothing follows the reference. The component itself rather
than an element, `skeleton={AvatarBar}`, escapes for the same reason: a reference is not an element.
Any fourth name escapes — `loadingView={<X/>}`, `restingSlot={<X/>}`, `renderSkeleton={() => <X/>}`,
`emptyState={<X/>}` — the name list is closed at three, and a function returning the element is a
`JSXExpressionContainer` holding an `ArrowFunctionExpression`. **The tree passed inside an object
prop** — `props={{ fallback: <AvatarBar/> }}` — is a `Property` inside an `ObjectExpression`, not a
`JSXAttribute`; where a codebase routes everything through one object prop, this rule sees almost
nothing. On the import half, `import { AvatarSkeleton } from "@/components/leaves/AvatarSkeleton"`
escapes because the source must start `./` or `../`, and aliases are the ordinary way to import.
`import { AvatarSkeleton as Resting } from "./x"` and `import * as Shapes from "./skeletons"` escape
because only `specifier.local.name` is tested — the imported name is never read, so a rename at the
import site is a complete escape. And `import { AvatarPlaceholder } from "./x"` escapes on the literal
`Skeleton` again.

**Boundary.** This rule judges an attribute and an import specifier in one file. It never opens the
imported module, and it never asks whether the twin it names exists.

## `no-resting-branch-at-call-site` — LOADING-2

**What it reports.** `branch` — a waiting flag choosing between two different root elements, quoting
the flag text back, first 40 characters.

**How it detects.** A `ConditionalExpression` visitor. The test is read back as **source text** —
`sourceCode.getText(node.test)` — and matched against `/\bis(?:Loading|Skeleton|Pending)\b/`. Each arm
is reduced to a single string: a `JSXElement` becomes its opening name (`JSXIdentifier`, or
`object.property` for a `JSXMemberExpression`), a `JSXFragment` becomes `"<>"`, and anything else
becomes `null`. It reports only when both strings exist and differ. That reduction is the load-bearing
detail of this whole module: the rule compares **root element names**, not trees.

**What it cannot see.** **The same root tag on both arms**:
`isLoading ? <div className="h-4 animate-pulse"/> : <div><Avatar/><Text/></div>` — both arms reduce to
`div`, the strings are equal, and the rule returns; two entirely different trees pass as one. The same
applies to a shared wrapper, `isLoading ? <Row><Bar/></Row> : <Row><Avatar/><Text/></Row>`. The state
read inline, `input.state === "pending" ? <AvatarBar/> : <Avatar/>`, is invisible: the flag pattern
needs the literal `is` followed by `Loading`, `Skeleton` or `Pending`, and a union member spelled
`"pending"` is exactly the expression the law's own seam paragraph is written about. A qualified flag —
`isLoadingCourses ? <A/> : <B/>`, `isPendingReview ? <A/> : <B/>` — escapes because `\b` after `Loading`
fails against a following word character; adding a noun to the flag removes the rule. Another spelling
of waiting — `loading`, `busy`, `isFetching`, `isWaiting`, `!data` — is not recognised; three spellings
are. The branch written as anything but a ternary escapes: `if (isLoading) return <AvatarBar/>`,
`{isLoading && <AvatarBar/>}` beside `{!isLoading && <Avatar/>}`, or a `switch` over the state union —
only `ConditionalExpression` is visited. And the component chosen into a name,
`const El = isLoading ? AvatarBar : Avatar` then `<El/>`, escapes because both arms are `Identifier`,
`armName` returns `null`, and the rule declines.

**Boundary.** `null` on one arm is never reported. A control with nowhere to go yet is `LOADING-5`
behaving correctly, not a second tree — and `LOADING-5` has no rule.

## Detection

Every rule first asks the same question of the file, and asks it of nothing else:

| Gate | Mechanism |
|---|---|
| path normalisation | `String(filename).replace(/\\/g, "/")` — backslash paths compare like every other path |
| in scope | `normalizePath(context.filename).includes("/src/components/")` — a plain substring test |
| out of scope | `/\.(?:test|spec)\.(?:ts|tsx)$/` — a twin built by hand inside a test is a fixture |

Then, per rule:

| Rule | Mechanism |
|---|---|
| `no-resting-twin-component` | Filename only, never the contents: `/\/([A-Za-z0-9]*Skeleton)\/index\.tsx?$/`, then `/\/([A-Za-z0-9]*Skeleton)\.tsx?$/`, the capture re-tested against `^[A-Za-z0-9]*Skeleton$`, reported once on `Program` |
| `no-placeholder-prop` (`prop`) | `JSXAttribute` — `JSXIdentifier` name in exactly `skeleton`, `placeholder`, `fallback`; value a `JSXExpressionContainer`; `expression.type` `JSXElement` or `JSXFragment` |
| `no-placeholder-prop` (`import`) | `ImportDeclaration` — `node.source.value` matching `/^\.\.?\//`, each `specifier.local.name` against `^[A-Za-z0-9]*Skeleton$`, the exact string `Skeleton` excluded |
| `no-resting-branch-at-call-site` | `ConditionalExpression` — `sourceCode.getText(node.test)` against `/\bis(?:Loading|Skeleton|Pending)\b/`, each arm reduced to one string, reported only when both exist and differ |

Nothing reaches outside the linted file: no type information, no module resolution, no cross-file
reading, no configuration.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| Windows-style path separators in the target repository | `normalizePath` rewrites `\` to `/` before any match |
| Burying the twin deeper: `.../leaves/media/AvatarSkeleton/index.tsx` | Both patterns anchor on the last `/`, at any depth |
| Dropping the `x`: `AvatarSkeleton.ts` | `tsx?` matches `.ts` as well as `.tsx` |
| An empty tree: `skeleton={<></>}` | `JSXFragment` is handled beside `JSXElement` |
| A long climb: `import { AvatarSkeleton } from "../../leaves/AvatarSkeleton"` | `^\.\.?\/` matches any relative depth |
| `placeholder="Search"` on a text field | Only a `JSXExpressionContainer` holding an element reports; a string literal is left alone on purpose |
| Negating the flag: `!isLoading ? <Avatar/> : <Bar/>` | The test is matched as text; `\bisLoading\b` is still in it |
| Resting as a bare fragment: `isLoading ? <></> : <Avatar/>` | `"<>"` is a name like any other, and it differs from `Avatar` |
| Two halves of one namespace: `isPending ? <Card.Bar/> : <Card.Body/>` | `JSXMemberExpression` resolves to `Card.Bar` and `Card.Body` |
| Writing the offence in a page, then importing it | Nothing is caught, but nothing is claimed either — see the first Open row |

**Open** — shipped blindness, every row read out of the implementation. A verdict must not claim these
were judged.

| Scope | What passes |
|---|---|
| all three | **The same offence written outside `/src/components/`** — a route folder, a feature folder, a second package, or any tree that spells the folder differently. Scope is a substring test on the path: a directory rename removes all three rules at once, silently, and the build stays green |
| all three | **A file named `*.stories.tsx`.** Only `.test.` and `.spec.` are treated as fixtures, so a demonstration of resting shapes is judged as product source |
| `no-resting-twin-component` | **A twin declared inside a correctly named file**, **the same twin under any other word**, **`AvatarSkeleton/view.tsx`**, and **`AvatarSkeleton.jsx`** |
| `no-placeholder-prop` (`prop`) | **The element gathered into a name first**, **a component reference instead of an element**, **any fourth attribute name**, and **the tree passed inside an object prop** |
| `no-placeholder-prop` (`import`) | **An aliased or bare-specifier source**, **a rename at the import site**, **a namespace import**, and **any word but `Skeleton`** |
| `no-resting-branch-at-call-site` | **The same root tag on both arms**, **the state read inline**, **a qualified flag**, **another spelling of waiting**, **any form but a ternary**, and **the component chosen into a name** |
| none | **Everything `LOADING-3` through `LOADING-7` forbid** — collapsed height, assistive silence, a control with nowhere to go, one flag across independent regions, and waiting as a member of the state union |

That last row is the honest summary: of seven codes, two are held, and the two that are held are
defeated by one ordinary rename.

## Inputs

| Input | Evidence required |
|---|---|
| `context.filename` | Absolute or repository-relative path of the file being linted |
| scope decision | Whether the normalised path contained `/src/components/`, and whether the test/spec pattern matched |
| source text | Parsed as TypeScript with JSX; the branch rule additionally reads its test back as text |
| nothing else | No type information, no module resolution, no cross-file reading, no configuration options — every rule declares `schema: []` |

## Rules

1. A rule's identity is the name it publishes. There is no second identifier for it anywhere; the
   numeric code belongs to the law it holds.
2. Every rule is `type: "problem"` and takes no options.
3. Scope is decided before anything else; outside `/src/components/`, `create` returns an empty visitor
   object and the rule costs nothing.
4. The twin rule reports at most once per file, on `Program`.
5. `null` on one arm of a waiting ternary is never reported: a control with nowhere to go yet is
   `LOADING-5` behaving correctly, not a second tree.
6. The bare name `Skeleton` is never a twin. It is the primitive a component rests **with**.
7. No rule offers a fix. Every finding is a shape decision a person has to make.
8. Only rules that exist in source are recorded here. A rule that ought to exist belongs in `audit.md`.
9. Every rule carries at least one honest row in the open-hatch table. Writing "none" for tidiness is
   more dangerous than having no rule at all.
10. The published severity, exported as `recommended`, is `error` for all three.

## Exceptions

Exceptions are part of the rules, not relief from them.

- **Tests.** A file ending `.test.ts`, `.test.tsx`, `.spec.ts` or `.spec.tsx` is exempt from all three.
  A twin built by hand in a test is a fixture asserted against, not a second description anybody
  renders.
- **Everything outside the component tree.** Stated as an exception because it is the widest one: the
  rules govern the component tree and nothing else.
- **The resting primitive.** An import whose local name is exactly `Skeleton` is exempt from the import
  half of `no-placeholder-prop`. It is not exempt from `no-resting-twin-component`, and that
  disagreement is a finding — see `audit.md`.
- **A ternary with `null` on one side.** Left alone by design; it releases `LOADING-5`, which no rule
  holds.
- **The literal `placeholder` attribute of a text field.** A string value never reports.

## Output

A run emits ordinary lint findings. The rule name is the whole identity; nothing else is printed to
identify which law was broken:

```text
<file>:<line>:<column>  error  <message>  starci-fe/<rule-name>
```

One verdict block per finding:

```text
file: <path as the rule sees it, forward slashes>
rule: <no-resting-twin-component | no-placeholder-prop | no-resting-branch-at-call-site>
scope: <in | out — the path test that decided it>
report: <twin | prop | import | branch> at <node>
code: <LOADING-1 | LOADING-2>
hatch: <the open hatch that would have hidden this, or none>
```

A clean file in scope emits one block with `report: none` and, where an open hatch applies, the `hatch`
line that says why the silence is not compliance. An out-of-scope file emits `scope: out`,
`report: none` and `code: none` — no visitor was installed, so nothing about it was judged.

A repository adopting these rules with history should expect the twin rule to report a folder at a
time: hand-kept placeholder trees arrive in families, one per screen, and each is a real shape that has
to be folded back into the component it copies rather than deleted.

## Worked example

**Input.** Two files under `components/leaves/Avatar/`:

```tsx
// src/components/leaves/AvatarSkeleton/index.tsx
export const AvatarSkeleton = () => (
  <Row><Bar className="h-4 w-24" /></Row>
)
```

```tsx
// src/components/leaves/Avatar/index.tsx
import { AvatarSkeleton } from "../AvatarSkeleton"

export const Avatar = ({ isLoading, name }) => (
  <Card skeleton={<AvatarSkeleton />}>
    {isLoading ? <AvatarSkeleton /> : <Person name={name} />}
  </Card>
)
```

Both paths contain `/src/components/` and neither ends `.test.` or `.spec.`, so all three rules are
installed.

```text
file: src/components/leaves/AvatarSkeleton/index.tsx
rule: no-resting-twin-component
scope: in — /src/components/ substring, folder pattern AvatarSkeleton/index.tsx
report: twin at Program
code: LOADING-1
hatch: none
```

```text
file: src/components/leaves/Avatar/index.tsx
rule: no-placeholder-prop
scope: in — /src/components/ substring
report: import at ImportDeclaration "../AvatarSkeleton", specifier AvatarSkeleton
code: LOADING-1
hatch: none
```

```text
file: src/components/leaves/Avatar/index.tsx
rule: no-placeholder-prop
scope: in — /src/components/ substring
report: prop at JSXAttribute skeleton={<AvatarSkeleton />}
code: LOADING-1
hatch: none
```

```text
file: src/components/leaves/Avatar/index.tsx
rule: no-resting-branch-at-call-site
scope: in — /src/components/ substring
report: branch at ConditionalExpression, test "isLoading"
code: LOADING-2
hatch: none
```

**Repaired.** The twin file is deleted, the prop and the import go with it, and the one shape draws
itself with the values taken out:

```tsx
// src/components/leaves/Avatar/index.tsx
export const Avatar = ({ isLoading, name }) => (
  <Card>
    <Person name={isLoading ? null : name} resting={isLoading} />
  </Card>
)
```

But an open hatch survives the repair. Written this way instead, the same second tree ships and every
rule is silent:

```tsx
// src/components/leaves/Avatar/index.tsx
export const Avatar = ({ isLoadingProfile, name }) => (
  <Card>
    {isLoadingProfile
      ? <Row><Bar className="h-4 w-24" /></Row>
      : <Row><Person name={name} /></Row>}
  </Card>
)
```

```text
file: src/components/leaves/Avatar/index.tsx
rule: no-resting-branch-at-call-site
scope: in — /src/components/ substring
report: none
code: LOADING-2
hatch: two hatches at once — a qualified flag, because \b after Loading fails against the following word character in isLoadingProfile; and the same root tag on both arms, because each arm reduces to Row and equal strings return. Silence here is blindness, not compliance
```

## Scope

This module records enforcement for one law of one front-end canon, and only the two codes that have a
rule. `LOADING-3` through `LOADING-7` are owned by the law in `patterns/fe/loading/INDEX.md` and by
`audit.md`, not by any machine here. It names no product, no component library and no repository in its
prose or its examples. Rule names and the package name are identifiers that ship, and are reproduced
verbatim.
