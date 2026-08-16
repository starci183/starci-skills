---
id: fe-lints-landmark-index
title: INDEX.md
slug: /fe/lints/landmark
sidebar_label: landmark
sidebar_position: 0
description: What the landmark rules can actually see, what they report, and every way of writing that gets past them.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `landmark`

## Law

A landmark is one of the small set of elements a reader can jump BETWEEN without reading what is
inside them. A neutral box and a landmark lay out identically, and only one of them is the reason
"skip to main content" exists.

A registry makes the mistake silent. A key named `<region>-main` records the intent exactly and
renders a neutral box, because the branch that draws registry nodes draws neutral boxes. Nothing
turns red: **a name in a key is not an element in a document.**

This module documents ENFORCEMENT, not the law. The law is the `LANDMARK-<n>` set. What follows is
what a machine can see of it — and, in `## Escape Hatches`, what it cannot.

## Rules

Two rules are published. The identity of each is its NAME, because that is the string a build log
prints, a disable comment names and a conversation about the failure uses.

| Rule | Law code | What it reports |
|---|---|---|
| `routed-page-is-a-main-landmark` | `LANDMARK-4` | A route layout that both renders the routed children and composes its own chrome, while no landmark appears anywhere in the file. |
| `main-landmark-belongs-to-a-route-file` | `LANDMARK-5` | A landmark drawn in a file that does not own a whole screen — every tier below a route file, and (for the landmark branch) below the page surface too. |

`LANDMARK-1`, `LANDMARK-2` and `LANDMARK-3` have no rule in this module. That is a finding, recorded
in `audit.md`, not a gap papered over with a mapping: one branch per landmark element, a branch that
owns no class, and the refusal of an element-choosing prop on the neutral frame are all held by
review alone.

## Detection

| Rule | Mechanism |
|---|---|
| `routed-page-is-a-main-landmark` | Gate on `context.filename` matching `/\/app\/(?:.*\/)?layout\.tsx$/` after backslashes are normalised to forward slashes. Then three independent booleans collected over the whole file: `JSXExpressionContainer` whose expression is an `Identifier` named `children`, **or** any `Identifier` named `children` whose parent is not a `Property`; a `JSXOpeningElement` whose `JSXIdentifier` name is the neutral frame branch; and any landmark element. Reported at `Program:exit` when the first two are true and the third is false. |
| `main-landmark-belongs-to-a-route-file` | Exempts any file whose path contains the landmark branch's own directory. Computes two file predicates — route file `/\/app\/(?:.*\/)?(?:layout\|page)\.tsx$/` and page surface `/\/components\/pages\/[A-Z][A-Za-z0-9]*\/(?:index\|component)\.tsx$/` — then reports on `JSXOpeningElement`. |
| landmark element, shape one | `JSXOpeningElement` whose `name.type` is `JSXIdentifier` and whose name is a member of a one-element set holding the landmark branch's name. |
| landmark element, shape two | Any other `JSXIdentifier` element carrying a `contract` `JSXAttribute` whose value is a string `Literal`, where the entry table reachable by walking up from the linted file declares `host: "main"` for that key. |
| entry table lookup | Filesystem walk upward, at most forty levels, trying three relative table paths per level. The table is read as TEXT: `indexOf('"<key>": {')`, then a window ending at the next `\n` followed by exactly four spaces and a quoted key, then `/\bhost:\s*"([a-z]+)"/`. Absent `host` reads as the neutral box; an unreadable table reads as `null`. |

## Escape Hatches

### Closed

| Way of writing | Why it does not get past |
|---|---|
| Handing `children` to a builder instead of putting it in JSX | The bare `Identifier` arm counts it, so a layout that passes `children` into a slot callback is still measured as rendering the routed page. |
| Deleting the landmark branch entirely and declaring the element on the entry | Shape two reads the host off the table, so a repository with no landmark branch at all still satisfies the first rule and is still policed by the second. |
| Writing a landmark inside the landmark branch's own implementation | Deliberately exempt. That file is the one place the element is drawn by hand, exactly as the neutral frame is the one place a neutral box is. |
| A key whose NAME ends in `-main`, drawn in a block | Names are not read. Only the entry's declared host is, so a reading column named for the region stays a reading column. |
| An entry written a few lines above a landmark entry | The window ends at the next key at the same indentation rather than after a fixed slice, so an entry declaring no host no longer inherits the first one below it. |
| A pass-through or root layout that renders `children` | Neither composes the chrome, so neither trips the second boolean, and neither is asked for a landmark it would only duplicate. |

### Open

| Way of writing | What actually happens |
|---|---|
| Renaming the destructured prop — `function Layout({ children: content })` | The `Identifier` named `children` is now a `Property` KEY and is skipped; nothing else in the file is named `children`. The first rule stops existing for that file. One rename. |
| Aliasing the frame at import — `import { Tree as Frame }` — or reaching it through a member expression | `composesChrome` compares a bare `JSXIdentifier` name. An aliased or dotted frame is not that name, so a layout that composes full chrome is measured as composing none and is never asked for a landmark. |
| Moving the chrome into a shell component the layout renders | The layout names no frame; the shell is not a route layout and cannot hold the landmark, because the second rule refuses it there. Both rules stay silent and the document ends with chrome and no landmark. |
| A landmark that wraps the wrong thing | The three booleans are collected independently over the whole file and never compared structurally. A landmark drawn around the navigation, with `children` handed to a plain leaf, satisfies the first rule completely. |
| `contract={"key"}` instead of `contract="key"` | The attribute value becomes a `JSXExpressionContainer`, not a `Literal`. Shape two sees no key. Two braces. |
| A key resolved through a variable or a helper — `<Tree contract={keyFor(state)} />` | Same arm, same silence. This is not hypothetical: choosing between sibling entries through a typed helper is an ordinary pattern, and the host arm is blind to every one of them. |
| A router directory not named `app`, or a route file with any other extension | Both filename gates hardcode the segment and the `.tsx` suffix. A different router convention makes both rules disappear rather than fail. |
| Any directory named `app`, anywhere | The gate only requires the segment somewhere in the path. A `layout.tsx` under an unrelated `app/` folder is treated as a route layout and can be reported for a landmark it has no business owning. |
| A hand-written lowercase landmark element | Neither shape matches it: shape one wants the branch's capitalised name, shape two wants a contract key. This law's rules say nothing about the most direct way to write the mistake. |
| Aliasing the landmark branch — `import { Main as Screen }` — or `<Branches.Main>` | Shape one compares a bare `JSXIdentifier` against a one-element set; a member expression fails the `name.type` check outright. A landmark in a block, drawn either way, is not reported. |
| Any landmark element other than the one in the set | The set has one member. The other landmark elements the law anticipates are unknown to both rules, so a second one drawn in a leaf reports nothing — and adding a branch for one is a rule change nobody is reminded to make. |
| Filing a file under the landmark branch's directory | The exemption is a path substring, so ANY file living there is exempt from the whole second rule — a helper, a story, a second component moved in. A folder exemption is not a file exemption, and this one is escapable by `mv`. |
| A page surface under a shared package, or in a folder whose name is not capitalised | The page-tier predicate hardcodes `/components/pages/` and demands a capitalised folder plus `index` or `component`. A monorepo layout, a lowercase folder or a differently named file makes a correct page surface report as misplacing its landmark. |
| An entry table indented with anything but four spaces | The window that bounds one entry looks for a newline, exactly four spaces, and a quoted key. Under two-space indentation, or a formatter that writes no space before the brace, the window runs to end of file and an entry with no host inherits the first host below it. |
| A landmark in unreachable JSX | JSX inside a branch that never renders is still in the tree. Dead code satisfies the first rule and is reported by the second. |
| A layout and the page beneath it both opening a landmark | A file-at-a-time rule cannot see it. Stated by the source rather than implied, and the reason the second rule narrows the PLACE instead of counting occurrences. |

## Inputs

| Input | Evidence required |
|---|---|
| filename | The linted file's path, normalised to forward slashes |
| AST | One file's JSX, under one parser, with no cross-file resolution |
| entry table | The nearest table found by walking up, read as text |
| element name | A bare identifier; member expressions and aliases are different strings |
| contract key | A string literal written at the attribute, and nothing else |

## Invariants

- A rule's identity is its published name. There is no second identifier.
- A rule reads one file. Anything requiring two files is a review question and is written down as one.
- An unreadable table produces silence, never a report. A reader that looked nowhere may not answer "nothing is here".
- The landmark branch and the entry-declared host are two shapes with two different sets of files allowed to hold them, and collapsing them was a measured defect.
- The frame test in the first rule is a narrowing, not a nicety: without it the rule would demand a landmark from files whose landmark the second rule would then refuse.
- Every rule is published at error. A rule at error is a broken build, not a warning to triage.

## Exceptions

Exceptions are part of the enforcement, not relief from it.

- **The landmark branch's own directory.** Exempt from the second rule entirely, because that file draws the element by hand and must.
- **The root layout and the pass-through layout.** Not exempted by name — they simply never compose the chrome, so the first rule's second condition is false. Requiring a landmark of either would put a second one in the document.
- **The page surface.** Allowed to render an entry whose host is the landmark, and NOT allowed to import the landmark branch. The asymmetry is deliberate: an entry rendered by whoever draws the screen's outermost node is not the same act as importing a landmark in order to wrap something.
- **Records and generated trees.** Not exempted here. The first rule's gate and the second rule's predicates are the only filters; a record holding route-shaped files is linted like source.

## Output

```text
rule: <routed-page-is-a-main-landmark | main-landmark-belongs-to-a-route-file>
file: <path as the rule sees it, forward slashes>
gate: <matched | not matched, and which predicate decided>
evidence: <the AST fact — element name, attribute kind, identifier parent>
verdict: <reported | silent>
hatch: <the open hatch that applies, or none>
```

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why the law deserves a machine,
`example.md` for the code that fires and the code that slips through, `audit.md` while reviewing the
enforcement itself, and `changelog.md` for what changed.

## Scope

This module documents the rules of one law and nothing else. It names no product, no component
library and no repository. Rule names, the element names they compare against and the package they
ship in are identifiers that appear in a build log, and they are written verbatim.

## Version Rule

Increment all five records by `0.01` for an accepted change to the rules or to what is claimed about
them, and record it in `changelog.md`.
