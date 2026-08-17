---
title: Naming
module: naming
kind: pattern
codes: [NAMING-1, NAMING-2, NAMING-3]
---

# Naming

The input to this pattern is a shape somebody already accepted — a layout, a block, a capability, a
contract. That decision is closed here; this pattern does not reopen it. The output is source
architecture: which file the code lands in, how the declaration is written, what the thing a reader
triggers is called at every boundary it crosses, and which language the path segment is spelled in.
Every naming position an accepted shape produces resolves to one code below, or to the per-layer rule
this module names and does not restate.

## Law

Naming here is the mechanical half: the spellings that are the same in every file regardless of what
the file is for. How a module-level function is declared, what a thing that responds to a reader is
called, and which language a path is written in.

These are not preferences. Both forms of each pair work, and that is exactly why they are rules —
nothing corrects the second spelling, so a file written on a Tuesday reads differently from its
neighbour, and every diff afterwards carries noise that has nothing to do with the change.

**This is binding, not advisory.** Every module-level declaration, every function a reader's action
runs, and every path segment resolves to a code below. There is no file small enough to be exempt: a
three-line helper is `NAMING-1` for the same reason a route folder is `NAMING-3`.

What a component is called FOR — the thing rather than its first caller — is deliberately not
settled here. That question is answered per layer, because the failure it prevents is different at
each one, and a single answer stated here would be wrong at four layers to be right at one.

## Situation codes

Every situation this module governs carries a code, `NAMING-<n>`. The code names the SITUATION. The
codes are cited from other law files and from task records, so a number, once issued, is never
reused for a different meaning and never renumbered.

| Code | Situation | What the source must look like |
|---|---|---|
| `NAMING-1` | A function is declared at module level, callable from any other file | A module-level function is an arrow const, exported by name. Forbidden: `function X() {}` at module level; `export default function` |
| `NAMING-2` | A function runs because the reader clicked, typed or chose — and it will be passed onward | Anything a reader's action runs is named `onX` — at the declaration, at the call site and in the props type. Forbidden: `handleX` as a local, as a prop, or as a field in a props type |
| `NAMING-3` | A file name, folder name or route segment — the thing that sits in the URL and in a stack trace | A file, folder and route segment is written in the one language every reader shares. Forbidden: a path segment in a second language, whether accented or romanised |

THIS MODULE HAS THREE CODES AND ENDS WITH THREE. The flat law it re-expresses carries a fourth
prohibition — a name that says WHERE it is used rather than what it is — with no code attached,
because that rule is stated per layer and not here. Not issuing a fourth number is a decision, not
an oversight: a code issued here would be cited here, and the answer would be missing at the layer
that actually owns it.

## Reading an accepted shape

1. Read what the shape states. It states the surface, the blocks, the slots, the actions a reader can
   take, and the addresses those surfaces live at. Those facts are the inputs below.
2. Read what the shape does not state, and therefore does not resolve. A shape does not state what a
   component is called FOR — the thing rather than its first caller. That question is answered per
   layer and carries no code here, so it stays open when this pattern is finished.
3. Resolve outermost first. The route segment and the file path are decided before any declaration
   inside the file, because the address is the name a person quotes and a machine resolves, and the
   declarations sit inside it.
4. Ask each code's question in turn. `NAMING-1`: is the declaration's parent the module or a function
   body? `NAMING-2`: is a reader's action what runs it, or does it compute a value? `NAMING-3`: is
   this segment an address or is it content?
5. When two codes both match, they both apply. The codes read independently: `NAMING-1` states how a
   thing is declared, `NAMING-2` states the letters. An arrow const named `handleClaim` satisfies
   `NAMING-1` and still violates `NAMING-2`. Emit one output block per position, not one per file.

## `NAMING-1` — module-level function is an arrow const

**Situation.** You are declaring a function at the outermost level of a file: a helper, a component, a
formatter, a route. Both spellings run, but only one keeps the file's promise about ORDER.

**What it emits in source.** An arrow const, exported by name, appearing above its first use. Not
`function X() {}` at module level, and not `export default function`. The deeper reason is hoisting: a
`function` declaration exists BEFORE the line that declares it, so a file can call downward and stay
green — and the order of the file immediately means nothing, because nothing forces a thing to be
defined before it is used. A `const` cannot be used before it exists, so the file reads top to bottom
in the order it actually runs. `export default function` costs one more thing: the export has no name
to grep at its call sites.

**Recognition signs.** The declaration sits flush at the left margin and its parent is the module
itself or an `export` statement. Somewhere in the file a name defined BELOW is called and still runs.
You have to scroll up and then down to find where a name comes from. Ask: reading this file top to
bottom, is there a place that uses a name which has not appeared yet?

**Boundary.** This is not a nested declaration: a `function` inside the BODY of another function is
not module level, because hoisting within a single body does not destroy the order of the file — that
body is read as one unit. It is not `NAMING-2` either: this code states HOW a thing is declared, not
WHICH LETTERS it carries.

**Common business situations.** An exported component · a formatter for money, dates or units · a
custom hook · a guard or validator · an adapter that calls an API · the default route of a page · a
helper that builds a class string · a factory that builds configuration.

## `NAMING-2` — what a reader triggers is named `onX`

**Situation.** A function runs BECAUSE the reader did something: clicked, typed, chose, submitted,
closed. It is almost always passed onward — into a slot, into a prop, into a DOM attribute.

**What it emits in source.** The same word in all three positions: the local declaration, the call
site, and the field in the props type. `handleSubmit` and `onSubmit` describe the SAME function, but a
codebase using both has two vocabularies for one idea, and every writer has to decide which language
this file is speaking. `on` is the spelling that survives the trip: the slot is already `on`, the DOM
attribute is already `onClick`, the props type already declares `on…` — so a local named `handlePress`
is renamed at the boundary, every time, and every rename is an occasion to be wrong.

**Recognition signs.** It does not return a value to display; it CAUSES something. It appears on the
right-hand side of a prop or a DOM attribute. Within one screen the same name exists in two different
spellings. Ask: is what runs it the reader's action, or the render pass?

**Boundary.** It is not a value: something that COMPUTES a result taking `on` is a false statement
about the thing, and this rule does not ask for it — a label built from data is a value, not a
handler. It is not the words `handled` or `handler`: the pattern is `handle` followed by a capital,
and widening past it buys one more catch and costs every reader's attention. It is not `NAMING-1`,
which governs the declaration form rather than the letters.

**Common business situations.** A form submit button · a cancel button in a modal · selecting a row in
a list · switching tabs · changing pages · closing an overlay · dropping a file into an upload zone ·
pressing a shortcut key · confirming a delete · claiming a reward.

## `NAMING-3` — a path is written in the one shared language

**Situation.** You are naming a file, a folder, or a route segment.

**What it emits in source.** A path segment in the one language every reader of this repository
shares. A source-reading rule reads identifiers, comments and strings — but it does not read the name
of the file it is reading. So a route can be `app/cap-phat/page.tsx` with every identifier inside it
in English and nothing reports a thing, while the URL, the import string, the folder shown in every
editor sidebar and the path in every stack trace stay in a language half the readers do not have. A
route segment is also a PUBLIC name: it is the address a customer quotes back in a support ticket. The
check is two-part, because a path cannot carry diacritics: `cấp phát` reaches the filesystem as
`cap-phat`. Tone marks catch the first form; a NAMED LIST catches the accent-stripped form. The list
is deliberate rather than lazy — guessing by the shape of the letters would refuse `capacity` and
`dangerous`, and a rule that reports errors on English words is a rule that gets turned off, and a
rule that is off holds nothing.

**Recognition signs.** The segment carries tone marks, or is an accent-stripped word of another
language. The letters in the URL match the letters displayed on screen — the sign that somebody used
content as an address. The import specifier reads like a sentence rather than like an address. Ask: is
this segment an ADDRESS or is it CONTENT? Content belongs in the locale catalogue.

**Boundary.** It is not the locale catalogue: a translation dictionary IS the other language, that is
content, and switching it is the point — though the name of the catalogue file itself is still an
address. It is not an English word shaped like a romanised entry: `capacity` and `dangerous` open with
exactly those letters and the rule does not touch them.

**Common business situations.** Login and signup routes · a course page · a checkout page · a cart ·
a profile · settings · a component folder · a util file · a route group written in parentheses · image
and static asset folders.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a rule in `sources/fe/naming.mjs` reports it;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | Held by | What the tier does not reach |
|---|---|---|---|
| `NAMING-1` | `enforced` | `starci-fe/prefer-arrow-export` | The `FunctionDeclaration` shape only. `const X = function () {}` keeps the keyword the law refuses but is a `FunctionExpression` and is never visited; `export default () => {}` is an arrow with no name to grep at its call sites, which is half of why `export default function` is refused, and it passes |
| `NAMING-2` | `enforced` | `starci-fe/handler-on-prefix` | Three node kinds — a declarator with an `Identifier` id, a JSX attribute name, a `TSPropertySignature` key. An object-literal property, a destructured parameter and a class method carry the same prefix unvisited. The positive half is unread entirely: `submit` and `doClaim` satisfy the rule and not the law |
| `NAMING-3` | `enforced` | `starci-fe/no-second-language-in-path` | `ROMANISED` is a fixed list of twenty segments, so an accent-free second-language segment outside it passes. A folder holding no linted file is never visited, and a language other than the one the list was built from is not covered at all |

All three codes have a rule with a name. None is `documented`. What is NOT true is that any of the
three is held whole — each rule is narrower than the law it holds, and every gap above is a recorded
gap with a statement of what a rule would have to see, because a tier table that rounds "partly" up to
"enforced" is how a repository comes to believe it is protected.

## Anchor

Real code each code can be checked against. A law that cannot be pointed at in real code is a
proposal, not a law.

| Code | Anchor | What to look for |
|---|---|---|
| `NAMING-1` | `sources/fe/naming.mjs` | The file obeys the rule it publishes. Every declaration in it — `MODULE_LEVEL_PARENTS`, `segmentsOf`, all three rule objects — is a const, and each appears above its first use. Read it top to bottom and nothing is referenced before it exists; that property is the whole argument, and it is visible rather than asserted |
| `NAMING-1` | `sources/fe/naming.test.mjs` | The invalid triple: a named export, a bare module-level declaration, and `export default function Route()`. Beside it the valid case `export const E = () => { function inner() {…} }` — the nested declaration that is deliberately allowed, written as a test rather than as a sentence |
| `NAMING-2` | `sources/fe/naming.test.mjs` | The invalid triple is one function in three positions: a local, a JSX attribute, a field in a props type. That triple is the argument for the rule's reach. The valid cases `handled` and `handler` are the argument for its narrowness — a rule that fired on them would be noise, and noise is unread |
| `NAMING-2` | `sources/fe/naming.mjs` | `flag` and its `/^handle[A-Z]/` test, and the three visitors that call it. The visitor list IS the reach; anything not in it is outside the rule regardless of what it is named |
| `NAMING-3` | `sources/fe/naming.mjs` | `SECOND_LANGUAGE_PATH` and `ROMANISED` — two instruments for one law, because the filesystem drops diacritics. Then `segmentsOf`, and the `replace(/[()[\]]/g, "")` in the finder: route-group parentheses are punctuation around a name, not part of it |
| `NAMING-3` | `sources/fe/naming.test.mjs` | The valid cases `capacity` and `DangerBadge`. They are the reason `ROMANISED` is a list rather than a pattern, and they are the case a cleverer rule fails |

Every anchor above is lint source inside the trust tree, which is the code this repository can
actually open. The flat law also named two files in a product repository; those are not reproduced
here, because this shelf names no repository and because a path this repository cannot open is not
something a reader can check. That limit is recorded as a limit rather than papered over with a path
nobody can verify.

## Inputs

| Input | Evidence required |
|---|---|
| position | Whether this is a declaration, a local, a prop, a field in a props type, a JSX attribute or a path segment |
| scope | Whether the declaration's parent is the module or a function body |
| trigger | Whether a reader's action is what runs it, or it computes a value |
| boundary | Which slot the name is passed into, and what that slot already calls it |
| audience | Who reads the name: this file only, every call site, or every person who quotes the URL |
| language | Whether the words are content a person reads or an address a person and a machine both resolve |

## Rules

1. Every module-level declaration has the same silhouette, so a reader scanning the file is not
   parsing two grammars for one idea.
2. A const cannot be used before it exists, so the order of a file states something a reader can rely
   on.
3. An export has a name at the point it is exported, so a grep for it finds a definition.
4. A name that crosses a boundary is the same word on both sides of it.
5. `on` marks that a reader's action is what runs the thing. A computed value does not take it.
6. A path is an address, not content. The words a person READS live in the locale catalogue.
7. A path check is two-part, because a path cannot carry diacritics and half the evidence is lost
   before the rule sees the name.
8. Every naming position resolves to exactly one code, or to the per-layer rule this module names and
   does not restate.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **A nested declaration is not module-level** (`NAMING-1`). Hoisting inside one body does not
  destroy the order of a file, because the body is read as one unit. The exemption is exercised in
  the twin test, not merely asserted here.
- **A value is not a handler** (`NAMING-2`). `on` on something a reader never triggers is a false
  statement about the thing, and this rule does not ask for it.
- **`handled` and `handler` are words, not the pattern** (`NAMING-2`). The pattern is `handle`
  followed by a capital. Widening past it buys one more catch and costs every reader's attention.
- **The locale catalogue carries the second language** (`NAMING-3`). A translation dictionary IS the
  other language; that is content, and switching it is the point.
- **English words shaped like the romanised list stay** (`NAMING-3`). `capacity` and `dangerous` open
  with the same letters as list entries. A rule that refused English words is one a repository turns
  off, and a rule that is off holds nothing.

## Output

One block per naming position the accepted shape produces, one group per file.

```text
position: <declaration | local | prop | type field | jsx attribute | path segment>
code: <NAMING-1 | NAMING-2 | NAMING-3>
tier: <enforced: <rule name> | documented>
verdict: <keep | rename | rewrite as an arrow const | move the words to the locale catalogue>
reason: <what the current spelling costs at the next boundary it crosses>
```

## Worked example

The accepted shape: a reward page at the address `cấp phát`, whose page component renders a leaf with
a button, and the function that button runs is declared in the page and passed into the leaf's slot.

The shape does not state what the leaf is called FOR — the thing rather than its first caller — and
therefore this pattern does not resolve it. That question is answered per layer, it carries no code
here, and it stays open when these blocks are emitted.

Route segment, resolved outermost first:

```text
position: path segment
code: NAMING-3
tier: enforced: starci-fe/no-second-language-in-path
verdict: move the words to the locale catalogue
reason: the segment reaches the filesystem as app/cap-phat/page.tsx, so the URL, the import string, the editor sidebar and every stack trace carry a language half the readers do not have; this is not the locale catalogue exception because the segment is the address, not the dictionary whose whole function is to hold the other language
```

The page's exported component:

```text
position: declaration
code: NAMING-1
tier: enforced: starci-fe/prefer-arrow-export
verdict: rewrite as an arrow const
reason: written as export default function the export has no name to grep at its call sites, and the hoisted declaration lets the file call downward so its order stops meaning anything; this is not the nested-declaration exception because the declaration's parent is the module, not the body of another function
```

The function the button runs, in all three positions it occupies:

```text
position: declaration
code: NAMING-2
tier: enforced: starci-fe/handler-on-prefix
verdict: rename
reason: the slot it is passed into is already spelled on, so a local named handleClaim is renamed at the boundary every time; this is not the value exception because a reader's click is what runs it, and it is not the handled/handler exception because the letters are handle followed by a capital
```

```text
position: prop
code: NAMING-2
tier: enforced: starci-fe/handler-on-prefix
verdict: rename
reason: the same function under a second spelling at the call site gives one idea two vocabularies within one screen
```

```text
position: type field
code: NAMING-2
tier: enforced: starci-fe/handler-on-prefix
verdict: rename
reason: the props type is the boundary the name is read at by every future call site, and a field spelled handleClaim there forces the rename to happen again on each one
```

Note that the exported component satisfies `NAMING-1` and the handler question independently: an arrow
const named `handleClaim` would close `NAMING-1` and still leave `NAMING-2` open.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is ordinary TSX. Where the rule reaches a private
component, the module names the ROLE of that component — the leaf that owns a state, the slot a
handler is passed into — never its identifier in one codebase.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood — never an identifier
somebody will read in a failure and have to look up.
