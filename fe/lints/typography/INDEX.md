---
id: fe-lints-typography-index
title: INDEX.md
slug: /fe/lints/typography
sidebar_label: typography
sidebar_position: 0
description: What the typography lint rule can actually see, what it cannot, and which law codes it holds.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `typography`

## Law

Type carries rank, and a heading is not a size chosen next to a weight — it is a LEVEL, and the
level decides the tag a screen reader builds its outline from as well as the size a reader sees.
Most of that law is a closed union on two components, and a union needs no lint: the type system
already refuses a fifth step and refuses a weight pushed onto a heading.

What no type can see is a heading TAG written by hand. A file that never mentions the heading
component at all, and simply writes `<h2 className="text-2xl font-bold">`, type-checks perfectly
while adding an outline entry the scale never authorised.

This shelf does not restate that law. It records **enforcement**: for the one published rule, the
exact syntax it watches, and — the part nobody writes down — the ways of writing the same mistake
that it does not watch at all.

One rule exists in the rule module, and this file documents one. Its identity is the published
name, the string that appears in a build log and in a disable comment; no numeric code is invented
for it here.

## Rules

| Rule | Law code | What it reports |
|---|---|---|
| `no-heading-tag-outside-heading-component` | `TYPESET-1` (message `tag`) and `TYPESET-2` (message `tooDeep`) | A lowercase `h1`–`h6` element opened in a source file that is neither a test nor the heading leaf. `h1`–`h4` report as `tag`; `h5`–`h6` report as `tooDeep`. |

**One rule, two codes, two messages.** This is not a mapping invented here: the `tag` message tells
the caller to render the heading component with a level, which is `TYPESET-1` word for word, and the
`tooDeep` message says the scale stops at four and the section has nested too far, which is
`TYPESET-2`. The split happens inside one `create`, on `Number(tag.slice(1)) > 4`.

**Finding — seven of the nine law codes have no rule in this module.** `TYPESET-3` (rank never from
a box), `TYPESET-4` (quieten the neighbours), `TYPESET-5` (a secondary line ranks below its title),
`TYPESET-6` (no weight on a heading), `TYPESET-7` (the small step is always muted), `TYPESET-8` (a
temporal marker is a subtitle) and `TYPESET-9` (body title rank follows content ownership) are
published, argued and unenforced by any rule on this shelf. Some are held by the closed unions and
the typed pairing on the two type components; some — `TYPESET-3`, `TYPESET-4`, `TYPESET-5`,
`TYPESET-8`, `TYPESET-9` — need to know what a line means relative to its neighbour, which lint
cannot see. Recorded as open risk in `audit.md`, not as rules, because a rule that cannot be pointed
at is a proposal.

**Finding — the rule holds only one of the two ways a heading gets hand-rolled.** The rule module
says so itself: its twin catches a heading assembled from a large size and a heavy weight, and lives
in a different rule module, so it is documented on a different shelf. Between the two, a hand-rolled
heading is caught when it has the right tag and the wrong look, or the right look and no tag. It is
caught by neither when the look is only moderately loud — see the Open table.

## Detection

| Rule | Mechanism |
|---|---|
| `no-heading-tag-outside-heading-component` | **File gate, evaluated once in `create`:** `context.filename` (falling back to `context.getFilename()`), every back-slash replaced with a forward slash, then three tests — the path must contain the segment `/src/`; it must NOT match `/\.(?:test\|spec)\.(?:ts\|tsx)$/`; it must NOT contain `/src/components/leaves/Heading/`. Failing any one returns an empty visitor object, so the rule is not installed at all for that file. **Node:** `JSXOpeningElement`. **Tag extraction:** `node.name` must exist and have `type === "JSXIdentifier"`; its `name` is returned only when it equals its own `toLowerCase()`, otherwise `null` — this is the intrinsic-versus-component test, and it is the whole of it. **Match:** the tag must be a member of the set `h1 h2 h3 h4 h5 h6`. **Branch:** `Number(tag.slice(1))` against the constant `4`; greater reports `tooDeep` with the tag and the deepest level, otherwise `tag` reports with the tag and the level. No attribute is read, no import is followed, no type is consulted. |

## Escape Hatches

### Closed

| Way of writing it | Why it does not slip past |
|---|---|
| A Windows-shaped path in the gate | Every filename is normalised to forward slashes before the three tests, so the gate behaves the same on both platforms. |
| `<h2 />`, or a heading tag with no attributes at all | The rule reads only the tag name. There is no className to remove, no attribute to hide behind, and a self-closing element still opens. |
| `<h2 {...props}>` or `<h2 className={cx(...)}>` | Attributes are never visited. Spreading, computing or deleting the class list changes nothing about what the rule sees. |
| A one-line wrapper: `const H2 = (props) => <h2 {...props} />` | The tag still exists, in a source file that is neither a test nor the leaf, so it reports **at the wrapper**. The call sites go quiet; the wrapper does not. |
| Writing `<h5>` or `<h6>` in the hope the deeper end is unwatched | Every tag in the set reports; the deeper two simply carry a different message. There is no depth at which the rule stops. |
| A heading tag inside a ternary, a `.map` callback, a fragment, or a render function nested in the same file | Every `JSXOpeningElement` in the file is visited regardless of where it sits. Position in the tree is not part of the test. |
| Naming a file `Heading.tsx` somewhere else and expecting the exemption | The exemption is a **path segment**, `/src/components/leaves/Heading/`. A file merely called Heading, or a folder called `Headings`, is linted like any other. |
| A fixture in a story file, or a component under `__tests__/` | The test exemption is a suffix match on `.test.` or `.spec.` plus `.ts`/`.tsx`. Nothing else is exempt by being test-adjacent. |
| An old lint host that offers only `getFilename()` | The gate reads `context.filename` with that call as the fallback, so the file test does not silently evaluate to the empty string and disable itself. |

### Open

| Rule | Way of writing it that is NOT caught |
|---|---|
| `no-heading-tag-outside-heading-component` | **The dynamic tag.** `const Tag = "h2"` then `<Tag>{title}</Tag>`. The name is a `JSXIdentifier`, but `"Tag" !== "tag"`, so the intrinsic test returns `null` and the rule never sees a heading. This is the widest hatch on the shelf, and it is not sabotage: a capitalised binding is the ONLY way to write a computed intrinsic in JSX, so the standard idiom for a variable heading level is exactly the blind spot. |
| `no-heading-tag-outside-heading-component` | **`createElement("h2", …)`.** No JSX node exists, so no visitor fires. The same is true of any factory, any renderer that takes a tag name as an argument, and any generated code that skips the JSX form. |
| `no-heading-tag-outside-heading-component` | **A heading inside a string.** `dangerouslySetInnerHTML={{ __html: "<h2>…</h2>" }}`, an HTML fragment stored in content, or markup returned from a tagged template. It is a `Literal`, never a `JSXOpeningElement`. |
| `no-heading-tag-outside-heading-component` | **A markdown or MDX pipeline.** `## Title` becomes an `h2` at build time and appears in the outline, with no heading tag in any linted file. The whole document family is outside the rule by construction. |
| `no-heading-tag-outside-heading-component` | **Anything outside a `/src/` path segment.** A route folder, a docs app, a package directory or a sibling workspace is unlinted; a heading tag written there is legal and appears on the same page. |
| `no-heading-tag-outside-heading-component` | **The test exemption is a name, paired with nothing.** Any file ending `.test.tsx` or `.spec.tsx`, anywhere in the tree, may write any heading tag for any reason. The argued case is one twin test asserting on heading markup; the granted case is every test file in the repository. |
| `no-heading-tag-outside-heading-component` | **The leaf gate is a substring, not a file identity.** Any path containing `/src/components/leaves/Heading/` is exempt: every helper, every sub-folder, every future file under that folder, and a second folder of that shape anywhere else — including in another workspace that happens to be linted by the same config. |
| `no-heading-tag-outside-heading-component` | **`<Tags.h2>` and any member expression.** `node.name.type` is `JSXMemberExpression`, so the tag extractor returns `null` before the set is ever consulted. A namespace object of intrinsics launders all six tags at once. |
| `no-heading-tag-outside-heading-component` | **`TYPESET-2` against the component itself.** The depth message exists only for hand-written tags. A level pushed past four through a widened variable or a cast is the type union's business, and once the union has been defeated nothing else is watching. |
| `no-heading-tag-outside-heading-component` | **The moderately loud hand-rolled heading.** This rule wants a tag; the twin in the other rule module wants a large size **and** a heavy weight together. A `<div className="text-lg font-semibold">` used as a section title has neither, so it is a heading with no outline entry that both rules pass. This is the seam between the two, and the seam is where the next one gets written. |
| `no-heading-tag-outside-heading-component` | **A heading declared through ARIA.** `<div role="heading" aria-level="2">` produces exactly the outline entry the law is about, contains no heading tag, and reads to the rule as an ordinary box. |
| `no-heading-tag-outside-heading-component` | **A second heading component.** Because the exemption is a path shape rather than a named module, a new folder at that path receives the leaf's full freedom, and the law's premise — that ONE component owns the tag and the size together — is defeated by creating a directory. |

## Inputs

| Input | Evidence required |
|---|---|
| file path | `context.filename`, or `context.getFilename()`, normalised to forward slashes |
| scope segment | the literal `/src/` appearing anywhere in that path |
| exemption segment | the literal `/src/components/leaves/Heading/` appearing anywhere in that path |
| test suffix | the path ending in `.test.ts`, `.test.tsx`, `.spec.ts` or `.spec.tsx` |
| element name | the `name` of a `JSXIdentifier` on a `JSXOpeningElement`, equal to its own lower-cased form |
| level | `Number` of the tag's second character, compared against the constant `4` |

## Invariants

- The rule's identity is its published name; nothing here assigns it a number.
- Detection is purely syntactic. No module is resolved, no type is consulted, no code runs, and no
  attribute of the reported element is read.
- The file gate is evaluated once, in `create`. A file outside scope does not receive a quiet rule —
  it receives no rule.
- Only a **lowercase** `JSXIdentifier` can be a tag. Every other element shape resolves to `null`
  before the heading set is consulted.
- A path gate is a substring test, so it names a shape of path rather than a unique file.
- The exemptions are files, not values: the leaf and the test files are exempt wholesale, which is a
  weaker form of exemption than a file-plus-value pair.
- The module's own severity opinion is `error`; the consuming configuration remains the authority on
  what is actually switched on.

## Exceptions

- **The heading leaf** is exempt because it is the one place where the tag and the size are decided
  as one thing, so it must be able to write the tag. The exemption is granted to a path segment, and
  therefore to everything under it.
- **Test files** are exempt because a twin test may build heading markup by hand in order to assert
  against it. The exemption is granted to a filename suffix, and therefore to every test file.
- **Everything outside `/src/`** is not examined at all. This is a scope decision rather than a
  grant, and it is the widest way to leave the rule behind.
- There is no third exemption. In particular there is no attribute, comment or prop that switches
  the rule off from inside a file that is in scope.

## Output

```text
rule:    no-heading-tag-outside-heading-component
file:    <path as the gate saw it, forward slashes>
node:    JSXOpeningElement
tag:     <h1 | h2 | h3 | h4 | h5 | h6>
level:   <1 | 2 | 3 | 4>            # present on `tag` only
deepest: 4                          # present on `tooDeep` only
message: <tag | tooDeep>
```

## Load Policy

Read this file first. Read `vi.md` for what the rule catches and why a machine is worth having for
it, `example.md` for the code that fires and the code that slips through, `audit.md` while reviewing
whether the enforcement still matches the law, and `changelog.md` for version history.

## Scope

This module documents the one rule published by the typography law's rule module, shipped in
`@starci/eslint-canon-fe`. It documents no rule that ought to exist: a rule that cannot be pointed
at is a proposal, and proposals are listed in `audit.md` as open risk instead. The twin that catches
a heading assembled out of type classes belongs to a different rule module and is documented on that
module's shelf.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A rule
added, removed or renamed in the rule module is such a change; so is a message added or split, and
so is an open hatch that gets closed.
