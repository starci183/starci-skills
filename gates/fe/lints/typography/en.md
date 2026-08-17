---
title: Typography
---

# Typography

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, which message it reported and on
which node, which law code that maps to, and the open hatch that would have hidden the same failure.
This module chooses no type scale. It refuses one, and it must be able to point at the tag it refuses
on.

## Law

Type carries rank, and a heading is not a size chosen next to a weight — it is a LEVEL, and the level
decides the tag a screen reader builds its outline from as well as the size a reader sees. Most of
that law is a closed union on two components, and a union needs no lint: the type system already
refuses a fifth step and refuses a weight pushed onto a heading.

What no type can see is a heading TAG written by hand. A file that never mentions the heading
component at all, and simply writes `<h2 className="text-2xl font-bold">`, type-checks perfectly while
adding an outline entry the scale never authorised.

The law states nine codes. **Two of them have a rule, and one rule holds both.** The rest are
published, argued and unenforced. This module does not restate the law; it records enforcement: for
the one published rule, the exact syntax it watches, and — the part nobody writes down — the ways of
writing the same mistake that it does not watch at all.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-heading-tag-outside-heading-component` | `TYPESET-1` (message `tag`) and `TYPESET-2` (message `tooDeep`) | A lowercase `h1`–`h6` element opened in a source file that is neither a test nor the heading leaf. `h1`–`h4` report as `tag`; `h5`–`h6` report as `tooDeep`. |

One rule, two codes, two messages. The mapping is not invented here: the `tag` message tells the
caller to render the heading component with a level, which is `TYPESET-1` word for word, and the
`tooDeep` message says the scale stops at four and the section has nested too far, which is
`TYPESET-2`. The split happens inside one `create`, on `Number(tag.slice(1)) > 4`.

Seven of the nine law codes have **no rule at all** in this module. `TYPESET-3` (rank never from a
box), `TYPESET-4` (quieten the neighbours), `TYPESET-5` (a secondary line ranks below its title),
`TYPESET-6` (no weight on a heading), `TYPESET-7` (the small step is always muted), `TYPESET-8` (a
temporal marker is a subtitle) and `TYPESET-9` (body title rank follows content ownership) are
unenforced rather than covered. Some are held by the closed unions and the typed pairing on the two
type components; `TYPESET-3`, `TYPESET-4`, `TYPESET-5`, `TYPESET-8` and `TYPESET-9` need to know what
a line means relative to its neighbour, which lint cannot see. A green run says nothing about any of
the seven.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means the file gate returned an empty visitor object and the rule did not exist for
   that file.
2. **Check the three gate tests in order.** The normalised path must contain the segment `/src/`; it
   must NOT match `/\.(?:test|spec)\.(?:ts|tsx)$/`; it must NOT contain
   `/src/components/leaves/Heading/`. Failing any one of the three switches the rule off entirely.
3. **Read the element name, not the attributes.** Only a `JSXIdentifier` whose `name` equals its own
   `toLowerCase()` is a tag at all; every other element shape resolves to `null` before the heading
   set is consulted.
4. **Emit one block per finding**, naming the message the branch chose — `tag` below the constant `4`,
   `tooDeep` above it.
5. **Write the `hatch` line** whenever an open hatch would have hidden the same failure, including on
   a file that reported nothing.
6. **Do not report what no rule watches.** Seven of the nine codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `no-heading-tag-outside-heading-component` — TYPESET-1, TYPESET-2

**What it reports.** A lowercase intrinsic heading tag — `h1`, `h2`, `h3`, `h4`, `h5`, `h6` — opened
by hand in any source file except a test file and except the heading leaf folder. `h1`–`h4` report as
`tag`, carrying the tag and the level, and map to `TYPESET-1`. `h5`–`h6` report as `tooDeep`, carrying
the tag and the deepest level, and map to `TYPESET-2`: the scale stops at four, so a fifth step is not
a question of size but of structure. One report per offending element.

**How it detects.** The file gate is evaluated once, in `create`: `context.filename` (falling back to
`context.getFilename()`), every back-slash replaced with a forward slash, then the three tests above.
Past the gate there is one visitor, `JSXOpeningElement`. Tag extraction requires `node.name` to exist
and to have `type === "JSXIdentifier"`; its `name` is returned only when it equals its own
`toLowerCase()`, otherwise `null` — this is the intrinsic-versus-component test, and it is the whole
of it. The extracted name must be a member of the set `h1 h2 h3 h4 h5 h6`. The branch is
`Number(tag.slice(1))` against the constant `4`. No attribute is read, no import is followed, no type
is consulted.

**What it cannot see.** The dynamic tag — `const Tag = "h2"` then `<Tag>{title}</Tag>` — because
`"Tag" !== "tag"` and the intrinsic test returns `null`; a capitalised binding is the ONLY way to
write a computed intrinsic in JSX, so the standard idiom for a variable heading level is exactly the
blind spot. `createElement("h2", …)` produces no JSX node, and neither does any factory or renderer
that takes a tag name as an argument. A heading inside a string —
`dangerouslySetInnerHTML={{ __html: "<h2>…</h2>" }}` — is a `Literal`. A markdown or MDX pipeline
turns `## Title` into an `h2` at build time with no heading tag in any linted file. `<Tags.h2>` is a
`JSXMemberExpression`, so the extractor returns `null` and a namespace object of intrinsics launders
all six tags at once. `<div role="heading" aria-level="2">` produces exactly the outline entry the law
is about and reads to the rule as an ordinary box. And the moderately loud hand-rolled heading —
`<div className="text-lg font-semibold">` used as a section title — has no tag for this rule and
neither a large size nor a heavy weight together for the twin in the other rule module, so it passes
both.

**Boundary.** This rule wants a TAG. The heading assembled out of a large size and a heavy weight is a
twin rule living in a different rule module, documented on that module's shelf. Between the two, a
hand-rolled heading is caught when it has the right tag and the wrong look, or the right look and no
tag; the seam between them is the moderately loud box, and the seam is where the next one gets
written.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | `context.filename` (falling back to `context.getFilename()`) with every back-slash replaced with a forward slash, so a Windows path decides the same way |
| scope segment | the path must contain the segment `/src/` |
| test exclusion | the path must NOT match `/\.(?:test\|spec)\.(?:ts\|tsx)$/` |
| leaf exclusion | the path must NOT contain `/src/components/leaves/Heading/` |
| out of scope | failing any one of the three returns an empty visitor object, so the rule is not installed at all for that file |
| walker | one visitor, `JSXOpeningElement`, over every such node in the file regardless of position in the tree |
| reader | `node.name` must exist with `type === "JSXIdentifier"`; its `name` is returned only when it equals its own `toLowerCase()`, otherwise `null` |
| match | the returned name must be a member of the set `h1 h2 h3 h4 h5 h6` |
| branch | `Number(tag.slice(1))` against the constant `4`; greater reports `tooDeep` with the tag and the deepest level, otherwise `tag` reports with the tag and the level |
| reach outside the file | none. No module is resolved, no type is consulted, no code runs, and no attribute of the reported element is read |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| A Windows-shaped path in the gate | Every filename is normalised to forward slashes before the three tests, so the gate behaves the same on both platforms |
| `<h2 />`, or a heading tag with no attributes at all | The rule reads only the tag name. There is no className to remove, no attribute to hide behind, and a self-closing element still opens |
| `<h2 {...props}>` or `<h2 className={cx(...)}>` | Attributes are never visited. Spreading, computing or deleting the class list changes nothing about what the rule sees |
| A one-line wrapper: `const H2 = (props) => <h2 {...props} />` | The tag still exists, in a source file that is neither a test nor the leaf, so it reports **at the wrapper**. The call sites go quiet; the wrapper does not |
| Writing `<h5>` or `<h6>` in the hope the deeper end is unwatched | Every tag in the set reports; the deeper two simply carry a different message. There is no depth at which the rule stops |
| A heading tag inside a ternary, a `.map` callback, a fragment, or a render function nested in the same file | Every `JSXOpeningElement` in the file is visited regardless of where it sits. Position in the tree is not part of the test |
| Naming a file `Heading.tsx` somewhere else and expecting the exemption | The exemption is a **path segment**, `/src/components/leaves/Heading/`. A file merely called Heading, or a folder called `Headings`, is linted like any other |
| A fixture in a story file, or a component under `__tests__/` | The test exemption is a suffix match on `.test.` or `.spec.` plus `.ts`/`.tsx`. Nothing else is exempt by being test-adjacent |
| An old lint host that offers only `getFilename()` | The gate reads `context.filename` with that call as the fallback, so the file test does not silently evaluate to the empty string and disable itself |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `no-heading-tag-outside-heading-component` | **The dynamic tag.** `const Tag = "h2"` then `<Tag>{title}</Tag>`. The name is a `JSXIdentifier`, but `"Tag" !== "tag"`, so the intrinsic test returns `null` and the rule never sees a heading. This is the widest hatch on the shelf, and it is not sabotage: a capitalised binding is the ONLY way to write a computed intrinsic in JSX, so the standard idiom for a variable heading level is exactly the blind spot |
| `no-heading-tag-outside-heading-component` | **`createElement("h2", …)`.** No JSX node exists, so no visitor fires. The same is true of any factory, any renderer that takes a tag name as an argument, and any generated code that skips the JSX form |
| `no-heading-tag-outside-heading-component` | **A heading inside a string.** `dangerouslySetInnerHTML={{ __html: "<h2>…</h2>" }}`, an HTML fragment stored in content, or markup returned from a tagged template. It is a `Literal`, never a `JSXOpeningElement` |
| `no-heading-tag-outside-heading-component` | **A markdown or MDX pipeline.** `## Title` becomes an `h2` at build time and appears in the outline, with no heading tag in any linted file. The whole document family is outside the rule by construction |
| `no-heading-tag-outside-heading-component` | **Anything outside a `/src/` path segment.** A route folder, a docs app, a package directory or a sibling workspace is unlinted; a heading tag written there is legal and appears on the same page |
| `no-heading-tag-outside-heading-component` | **The test exemption is a name, paired with nothing.** Any file ending `.test.tsx` or `.spec.tsx`, anywhere in the tree, may write any heading tag for any reason. The argued case is one twin test asserting on heading markup; the granted case is every test file in the repository |
| `no-heading-tag-outside-heading-component` | **The leaf gate is a substring, not a file identity.** Any path containing `/src/components/leaves/Heading/` is exempt: every helper, every sub-folder, every future file under that folder, and a second folder of that shape anywhere else — including in another workspace that happens to be linted by the same config |
| `no-heading-tag-outside-heading-component` | **`<Tags.h2>` and any member expression.** `node.name.type` is `JSXMemberExpression`, so the tag extractor returns `null` before the set is ever consulted. A namespace object of intrinsics launders all six tags at once |
| `no-heading-tag-outside-heading-component` | **`TYPESET-2` against the component itself.** The depth message exists only for hand-written tags. A level pushed past four through a widened variable or a cast is the type union's business, and once the union has been defeated nothing else is watching |
| `no-heading-tag-outside-heading-component` | **The moderately loud hand-rolled heading.** This rule wants a tag; the twin in the other rule module wants a large size **and** a heavy weight together. A `<div className="text-lg font-semibold">` used as a section title has neither, so it is a heading with no outline entry that both rules pass. This is the seam between the two, and the seam is where the next one gets written |
| `no-heading-tag-outside-heading-component` | **A heading declared through ARIA.** `<div role="heading" aria-level="2">` produces exactly the outline entry the law is about, contains no heading tag, and reads to the rule as an ordinary box |
| `no-heading-tag-outside-heading-component` | **A second heading component.** Because the exemption is a path shape rather than a named module, a new folder at that path receives the leaf's full freedom, and the law's premise — that ONE component owns the tag and the size together — is defeated by creating a directory |
| neither | **Everything `TYPESET-3`, `TYPESET-4`, `TYPESET-5`, `TYPESET-6`, `TYPESET-7`, `TYPESET-8` and `TYPESET-9` forbid** — rank taken from a box, neighbours left as loud as the title, a secondary line ranking above what it belongs to, a weight pushed onto a heading, an unmuted small step, a temporal marker promoted out of the subtitle position, a body title whose rank does not follow content ownership |

That last row is the honest summary: of nine codes, two are held, and both are held by one purely
syntactic rule that a single capitalised binding defeats.

## Inputs

| Input | Evidence required |
|---|---|
| file path | `context.filename`, or `context.getFilename()`, normalised to forward slashes |
| scope segment | the literal `/src/` appearing anywhere in that path |
| exemption segment | the literal `/src/components/leaves/Heading/` appearing anywhere in that path |
| test suffix | the path ending in `.test.ts`, `.test.tsx`, `.spec.ts` or `.spec.tsx` |
| element name | the `name` of a `JSXIdentifier` on a `JSXOpeningElement`, equal to its own lower-cased form |
| level | `Number` of the tag's second character, compared against the constant `4` |

## Rules

1. The rule's identity is its published name; nothing here assigns it a number.
2. Detection is purely syntactic. No module is resolved, no type is consulted, no code runs, and no
   attribute of the reported element is read.
3. The file gate is evaluated once, in `create`. A file outside scope does not receive a quiet rule —
   it receives no rule.
4. Only a **lowercase** `JSXIdentifier` can be a tag. Every other element shape resolves to `null`
   before the heading set is consulted.
5. The six heading tags split into two branches at the constant `4`, and the two branches say two
   different things: one about ownership, one about structure.
6. A path gate is a substring test, so it names a shape of path rather than a unique file.
7. The exemptions are files, not values: the leaf and the test files are exempt wholesale, which is a
   weaker form of exemption than a file-plus-value pair.
8. The Open table is a list of blind spots, not a list of permitted ways to write it.
9. The module's own severity opinion is `error`; the consuming configuration remains the authority on
   what is actually switched on.

## Exceptions

Every exception here is closed on a FILE rather than on a file-plus-value pair, which is the weaker
form, and must be read that way.

- **The heading leaf** is exempt because it is the one place where the tag and the size are decided as
  one thing, so it must be able to write the tag. The exemption is granted to the path segment
  `/src/components/leaves/Heading/`, and therefore releases everything under it.
- **Test files** are exempt because a twin test may build heading markup by hand in order to assert
  against it. The exemption is granted to a filename suffix — `.test.ts`, `.test.tsx`, `.spec.ts`,
  `.spec.tsx` — and therefore releases every test file in the repository.
- **Everything outside `/src/`** is not examined at all. This is a scope decision rather than a grant,
  and it is the widest way to leave the rule behind.
- **There is no third exemption.** No attribute, prop or comment switches the rule off from inside a
  file that is in scope.

## Output

One block per finding:

```text
rule:    no-heading-tag-outside-heading-component
file:    <path as the gate saw it, forward slashes>
node:    JSXOpeningElement
tag:     <h1 | h2 | h3 | h4 | h5 | h6>
level:   <1 | 2 | 3 | 4>            # present on `tag` only
deepest: 4                          # present on `tooDeep` only
message: <tag | tooDeep>
```

A clean file in scope emits one block with `message: none` and the `hatch` line stating which open
hatch could have hidden a failure, or `hatch: none`. A file out of scope emits one block with
`message: none` and the gate test that rejected it, because out of scope is unjudged, not clean.

## Worked example

**Input.** `src/components/blocks/order/OrderSummary/index.tsx`:

```tsx
export function OrderSummary({title, notes}) {
  return (
    <section>
      <h2 className="text-2xl font-bold">{title}</h2>
      <h5>{notes}</h5>
    </section>
  )
}
```

The path contains `/src/`, is not a test file and is not under the heading leaf, so the gate installs
the rule. Two `JSXOpeningElement` nodes carry a lowercase `JSXIdentifier` in the heading set.

```text
rule:    no-heading-tag-outside-heading-component
file:    src/components/blocks/order/OrderSummary/index.tsx
node:    JSXOpeningElement
tag:     h2
level:   2
message: tag
```

```text
rule:    no-heading-tag-outside-heading-component
file:    src/components/blocks/order/OrderSummary/index.tsx
node:    JSXOpeningElement
deepest: 4
tag:     h5
message: tooDeep
```

The `className` is never read; it is the tag alone that fires. The second finding is not about size at
all — the scale stops at four, so the notes belong flattened out of the fifth step before they get a
heading.

**Repaired.** The heading component owns the tag and the level as one prop, and the notes drop to a
body line inside a flattened section:

```tsx
import {Heading} from "@/components/leaves/Heading"

export function OrderSummary({title, notes}) {
  return (
    <section>
      <Heading level={2}>{title}</Heading>
      <p>{notes}</p>
    </section>
  )
}
```

But the same failure survives one ordinary refactor. A sibling file writes the level as a variable:

```tsx
const Tag = depth > 1 ? "h3" : "h2"
return <Tag className="text-2xl font-bold">{title}</Tag>
```

```text
rule:    no-heading-tag-outside-heading-component
file:    src/components/blocks/order/OrderHeading/index.tsx
node:    JSXOpeningElement
tag:     Tag
message: none
hatch:   the dynamic tag — `"Tag" !== "tag"`, so the intrinsic test returns null and the rule never sees a heading; the outline entry is unjudged, not compliant
```

## Scope

This module documents the one rule published by the typography law's rule module, shipped in
`@starci/eslint-canon-fe`. It documents no rule that ought to exist: a rule that cannot be pointed at
is a proposal, not enforcement. The twin that catches a heading assembled out of type classes belongs
to a different rule module and is documented on that module's shelf. The closed unions and the typed
pairing on the two type components are the type system's business, not this module's.
