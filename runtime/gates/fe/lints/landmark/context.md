# Landmark

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses nothing. It refuses, and it must be able to point at the element it refuses on.

## Law

A landmark is one of the small set of elements a reader can jump BETWEEN without reading what is
inside them. A neutral box and a landmark lay out identically, and only one of them is the reason
"skip to main content" exists.

A registry makes the mistake silent. A key named `<region>-main` records the intent exactly and
renders a neutral box, because the branch that draws registry nodes draws neutral boxes. Nothing turns
red: **a name in a key is not an element in a document.**

The law is the `LANDMARK-<n>` set and it states **five codes. Two of them have a rule.** This module
documents ENFORCEMENT, not the law — what a machine can see of it, and, in `## Escape hatches`, what
it cannot.

## Published rules

The identity of each rule is its NAME, because that is the string a build log prints, a disable
comment names and a conversation about the failure uses.

| Rule | Code | What it reports |
|---|---|---|
| `routed-page-is-a-main-landmark` | `LANDMARK-4` | A route layout that both renders the routed children and composes its own chrome, while no landmark appears anywhere in the file. |
| `main-landmark-belongs-to-a-route-file` | `LANDMARK-5` | A landmark drawn in a file that does not own a whole screen — every tier below a route file, and (for the landmark branch) below the page surface too. |

`LANDMARK-1`, `LANDMARK-2` and `LANDMARK-3` have **no rule in this module**. They are unenforced
rather than covered: one branch per landmark element, a branch that owns no class, and the refusal of
an element-choosing prop on the neutral frame are all held by review alone. A green run says nothing
about any of the three.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means no visitor ran and the rule did not exist for that file.
2. **`routed-page-is-a-main-landmark` needs a filename matching `/\/app\/(?:.*\/)?layout\.tsx$/`**,
   backslashes normalised to forward slashes first. Any other router directory, any other extension,
   and the rule disappears.
3. **Check the exemption before reading nodes.** `main-landmark-belongs-to-a-route-file` returns
   empty for any file whose path contains the landmark branch's own directory.
4. **Read the nodes.** For the first rule, three independent booleans over the whole file; for the
   second, each `JSXOpeningElement` against the two file predicates. A landmark is one of two shapes,
   and the shape decides which files may hold it.
5. **Emit one block per finding**, and write the `hatch` line whenever an open hatch would have hidden
   the same failure.
6. **Do not report what no rule watches.** Three of the five codes have no machine, and a lowercase
   hand-written landmark is invisible to both shapes; a verdict that claims otherwise is wrong about
   the module.

## `routed-page-is-a-main-landmark` — LANDMARK-4

**What it reports.** A route layout that has composed its own chrome around the routed page and has
marked no landmark anywhere in the file. One report, at `Program:exit`.

**How it detects.** Gate on `context.filename` matching `/\/app\/(?:.*\/)?layout\.tsx$/` after
backslashes are normalised to forward slashes. Then three independent booleans collected over the
whole file: a `JSXExpressionContainer` whose expression is an `Identifier` named `children`, **or** any
`Identifier` named `children` whose parent is not a `Property`; a `JSXOpeningElement` whose
`JSXIdentifier` name is the neutral frame branch; and any landmark element in either shape. Reported
at `Program:exit` when the first two are true and the third is false.

**What it cannot see.** Renaming the destructured prop — `function Layout({ children: content })` —
makes the `Identifier` named `children` a `Property` KEY, which is skipped, and nothing else in the
file is named `children`; the rule stops existing for that file after one rename. Aliasing the frame at
import — `import { Tree as Frame }` — or reaching it through a member expression such as
`<Branches.Tree>` leaves `composesChrome` false, so a layout that composes full chrome is measured as
composing none and is never asked for a landmark. Moving the chrome into a shell component the layout
renders silences both rules at once: the layout names no frame, and the shell cannot hold the landmark
because the second rule refuses it there. A landmark that wraps the wrong thing satisfies the rule
completely, because the three booleans are collected independently and never compared structurally —
a landmark drawn around the navigation with `children` handed to a plain leaf passes. `contract={"key"}`
instead of `contract="key"` turns the value into a `JSXExpressionContainer` rather than a `Literal`, so
shape two sees no key; two braces. A key resolved through a variable or a helper — `<Tree contract={keyFor(state)} />`
— is the same silence, and choosing between sibling entries through a typed helper is an ordinary
pattern. A router directory not named `app`, or a route file with any other extension, makes the rule
disappear rather than fail, while ANY directory named `app` anywhere in the path opens the gate on a
file that has no business owning a landmark. JSX in a branch that never renders is still in the tree,
so dead code satisfies the rule.

**Boundary.** This rule asks whether a landmark exists in a route layout. Whether a landmark is drawn
in a file allowed to hold it is `LANDMARK-5`.

## `main-landmark-belongs-to-a-route-file` — LANDMARK-5

**What it reports.** A landmark drawn below the tier that owns the whole screen. A second landmark is
not a stronger landmark, it is an ambiguous one: with three of them, "skip to main content" means
nothing.

**How it detects.** Exempts any file whose path contains the landmark branch's own directory. Computes
two file predicates — route file `/\/app\/(?:.*\/)?(?:layout|page)\.tsx$/` and page surface
`/\/components\/pages\/[A-Z][A-Za-z0-9]*\/(?:index|component)\.tsx$/` — then reports on
`JSXOpeningElement`. Shape one, the named landmark branch, is reported whenever the file is not a route
file; the page surface is NOT exempt on this arm. Shape two, a frame whose entry declares
`host: "main"`, is reported when the file is neither a route file nor a page surface. The asymmetry is
deliberate and measured: importing a landmark in order to wrap something is not the same act as
rendering the outermost node of a screen whose key the table declares.

**What it cannot see.** A hand-written lowercase landmark element matches neither shape — shape one
wants the branch's capitalised name, shape two wants a contract key — so the most direct way to write
the mistake reports nothing. Aliasing the landmark branch — `import { Main as Screen }` — fails the
one-element set, and `<Branches.Main>` fails the `name.type` check outright. Any landmark element other
than the one in the set is unknown to both rules, and adding a branch for one is a rule change nobody
is reminded to make. A key that is not a literal passes exactly as it does in the first rule. The
exemption is a path substring, so ANY file living in the landmark branch's directory — a helper, a
story, a second component moved in — is exempt from the whole rule; a folder exemption is not a file
exemption, and this one is escapable by `mv`. The page-tier predicate hardcodes `/components/pages/`
and demands a capitalised folder plus `index` or `component`, so a monorepo layout, a lowercase folder
or a differently named file makes a correct page surface report as misplacing its landmark. An entry
table indented with anything but four spaces breaks the window that bounds one entry, and an entry with
no host inherits the first host below it. Dead JSX is still reported. And a layout and the page beneath
it both opening a landmark is invisible to a file-at-a-time rule — stated by the source rather than
implied, and the reason this rule narrows the PLACE instead of counting occurrences.

**Boundary.** This rule judges where a landmark is drawn, one file at a time. How many landmarks a
document ends up with is a review question and is written down as one.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | Paths are read with backslashes rewritten to forward slashes before any test, so a Windows path decides the same way |
| out of scope | The first rule's gate installs no visitor. The rule does not exist for that file rather than passing it |
| landmark element, shape one | `JSXOpeningElement` whose `name.type` is `JSXIdentifier` and whose name is a member of a one-element set holding the landmark branch's name |
| landmark element, shape two | Any other `JSXIdentifier` element carrying a `contract` `JSXAttribute` whose value is a string `Literal`, where the entry table reachable by walking up from the linted file declares `host: "main"` for that key |
| entry table lookup | Filesystem walk upward, at most forty levels, trying three relative table paths per level. The table is read as TEXT: `indexOf('"<key>": {')`, then a window ending at the next `\n` followed by exactly four spaces and a quoted key, then `/\bhost:\s*"([a-z]+)"/`. Absent `host` reads as the neutral box; an unreadable table reads as `null` |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| Handing `children` to a builder instead of putting it in JSX | The bare `Identifier` arm counts it, so a layout that passes `children` into a slot callback is still measured as rendering the routed page |
| Deleting the landmark branch entirely and declaring the element on the entry | Shape two reads the host off the table, so a repository with no landmark branch at all still satisfies the first rule and is still policed by the second |
| Writing a landmark inside the landmark branch's own implementation | Deliberately exempt. That file is the one place the element is drawn by hand, exactly as the neutral frame is the one place a neutral box is |
| A key whose NAME ends in `-main`, drawn in a block | Names are not read. Only the entry's declared host is, so a reading column named for the region stays a reading column |
| An entry written a few lines above a landmark entry | The window ends at the next key at the same indentation rather than after a fixed slice, so an entry declaring no host no longer inherits the first one below it |
| A pass-through or root layout that renders `children` | Neither composes the chrome, so neither trips the second boolean, and neither is asked for a landmark it would only duplicate |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `routed-page-is-a-main-landmark` | **Renaming the destructured prop** — `function Layout({ children: content })`. One rename and the rule stops existing for that file |
| `routed-page-is-a-main-landmark` | **Aliasing the frame at import**, `import { Tree as Frame }`, or reaching it through a member expression. Full chrome is measured as no chrome |
| `routed-page-is-a-main-landmark` | **A landmark that wraps the wrong thing.** The three booleans are never compared structurally |
| both | **Moving the chrome into a shell component the layout renders.** Both rules stay silent and the document ends with chrome and no landmark |
| both | **`contract={"key"}` instead of `contract="key"`**, and **a key resolved through a variable or a helper** — `<Tree contract={keyFor(state)} />`. Shape two sees no key |
| both | **A router directory not named `app`, or any other extension** — the rules disappear rather than fail — and, in the other direction, **any directory named `app`, anywhere**, which opens the gate on an unrelated file |
| both | **Dead JSX.** A landmark in an unreachable branch satisfies the first rule and is reported by the second |
| `main-landmark-belongs-to-a-route-file` | **A hand-written lowercase landmark element.** Neither shape matches the most direct way to write the mistake |
| `main-landmark-belongs-to-a-route-file` | **Aliasing the landmark branch** — `import { Main as Screen }` — or `<Branches.Main>` |
| `main-landmark-belongs-to-a-route-file` | **Any landmark element other than the one in the set.** The set has one member, and adding a branch for another is a rule change nobody is reminded to make |
| `main-landmark-belongs-to-a-route-file` | **Filing a file under the landmark branch's directory.** A folder exemption escapable by `mv` |
| `main-landmark-belongs-to-a-route-file` | **A page surface under a shared package, or in a folder whose name is not capitalised** — a correct page surface reported as misplacing its landmark |
| `main-landmark-belongs-to-a-route-file` | **An entry table indented with anything but four spaces.** The window runs to end of file and an entry with no host inherits the first host below it |
| neither | **A layout and the page beneath it both opening a landmark**, and **everything `LANDMARK-1`, `LANDMARK-2` and `LANDMARK-3` forbid** — one branch per landmark element, a branch that owns no class, and the refusal of an element-choosing prop on the neutral frame |

## Inputs

| Input | Evidence required |
|---|---|
| filename | The linted file's path, normalised to forward slashes |
| AST | One file's JSX, under one parser, with no cross-file resolution |
| entry table | The nearest table found by walking up, read as text |
| element name | A bare identifier; member expressions and aliases are different strings |
| contract key | A string literal written at the attribute, and nothing else |

## Rules

1. A rule's identity is its published name. There is no second identifier.
2. A rule reads one file. Anything requiring two files is a review question and is written down as one.
3. An unreadable table produces silence, never a report. A reader that looked nowhere may not answer
   "nothing is here".
4. The landmark branch and the entry-declared host are two shapes with two different sets of files
   allowed to hold them, and collapsing them was a measured defect.
5. The frame test in the first rule is a narrowing, not a nicety: without it the rule would demand a
   landmark from files whose landmark the second rule would then refuse.
6. Every rule is published at error. A rule at error is a broken build, not a warning to triage.

## Exceptions

Exceptions are part of the enforcement, not relief from it.

- **The landmark branch's own directory.** Exempt from the second rule entirely, because that file
  draws the element by hand and must. It releases every check in `main-landmark-belongs-to-a-route-file`
  for every file in that directory.
- **The root layout and the pass-through layout.** Not exempted by name — they simply never compose
  the chrome, so the first rule's second condition is false. Requiring a landmark of either would put a
  second one in the document.
- **The page surface.** Allowed to render an entry whose host is the landmark, and NOT allowed to
  import the landmark branch. The asymmetry is deliberate: an entry rendered by whoever draws the
  screen's outermost node is not the same act as importing a landmark in order to wrap something. It
  releases shape two only, and nothing on shape one.
- **Records and generated trees.** Not exempted here. The first rule's gate and the second rule's
  predicates are the only filters; a record holding route-shaped files is linted like source.

## Output

One block per finding:

```text
rule: <routed-page-is-a-main-landmark | main-landmark-belongs-to-a-route-file>
file: <path as the rule sees it, forward slashes>
gate: <matched | not matched, and which predicate decided>
evidence: <the AST fact — element name, attribute kind, identifier parent>
verdict: <reported | silent>
hatch: <the open hatch that applies, or none>
```

A clean file emits one block with `verdict: silent` and the gate that matched. An out-of-scope file
emits one block with `gate: not matched` and `verdict: silent` — the file was not judged, and the
block must say which predicate excluded it.
