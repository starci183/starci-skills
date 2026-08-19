---
title: Contract
---

# Contract

## LOADS

None.


## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
which published rule fired, which law code it enforces, which mechanism fired it, what it found, and —
when one applies — the writing that would have avoided the report. This module chooses nothing. It
refuses, and it must be able to point at the node it refuses on.

## Law

A structural node is described ONCE, by a key that owns the classes the node wears, the element it
opens and the reason its children sit that way. An author who needs a shape types the key. The law
these rules hold runs `CONTRACT-1` through `CONTRACT-13` and is owned by the contract pattern, not by
this file.

**The strongest guarantees in this law are not rules at all.** The class vocabulary and the host
vocabulary are closed unions, so an off-scale value is unrepresentable rather than forbidden, and a
slot's identity, cardinality and props are compile errors before any rule runs. What the rules here
cover is the part a type cannot see: which FILE wrote a string, whether a key exists, and whether
anybody renders it.

This shelf documents ENFORCEMENT, not the law. Every section is true of the rules as implemented,
including the places where a rule is narrower than the sentence it is named after.

## Published rules

Twelve rules ship, and the source publishes exactly twelve entries in its `rules` export.

| Rule | Code | What it reports |
|---|---|---|
| `no-literal-structural-class` | `CONTRACT-1` | `structural` — a structural token in a static class attribute; `hoisted` — the same token in a module-level string constant |
| `no-class-composition-outside-contract` | `CONTRACT-2` | `composer` — a call to a known class-composing helper; `interpolated` — a class attribute built by template or by `+` |
| `only-the-frame-wears-a-node` | `CONTRACT-4` | `worn` — a call to `contractNodeProps` anywhere but the frame |
| `contract-why-is-a-reason` | `CONTRACT-6` | `tooShort` — a reason under twelve words; `restates` — a reason built only from the words of the key |
| `no-structural-host-outside-contract-frame` | `CONTRACT-7` | `host` — a hand-written neutral box; `styledSemantic` — a semantic element carrying a class |
| `no-structural-arrangement-in-leaf` | `CONTRACT-1, CONTRACT-7` | `arrangement` — a leaf nests a structural host or owns multiple structural host siblings |
| `no-hand-written-contract-attrs` | `CONTRACT-8` | `marker` — a `data-node` or `data-why` attribute written by hand |
| `no-duplicate-entry-shape` | `CONTRACT-9` | `duplicate` — an entry whose classes, host and slots another entry already spells |
| `no-unknown-contract-key` | *none* | `unknown` — a key that is not in the table, with the list of keys that are |
| `no-interaction-class-in-entry` | `CONTRACT-12` | `interaction`, `paint`, `raised` — an entry class that is behaviour, paint or elevation rather than arrangement |
| `no-dead-contract-key` | `CONTRACT-13` | `dead` — a key in the table that no walked file and no sibling slot names |
| `contract-children-are-typed` | `CONTRACT-11` | `missing` — an entry has no object-valued `children` grammar; `untyped` — a slot has no `leaf`, `composite` or `contract` owner identity |

**`no-unknown-contract-key` enforces no code in the law, and that is a finding rather than a gap to
paper over.** Its message quotes `CONTRACT-9` and `CONTRACT-5` as advice, but the check it performs is
membership: does this string appear as a key in the table. No numbered code states that. `CONTRACT-9`
governs whether a NEW key is justified — a judgement no rule takes — and the rule that actually holds
`CONTRACT-9` is `no-duplicate-entry-shape`. A verdict citing this rule writes `code: none`.

Three codes have no published rule and are not meant to have one. `CONTRACT-3` is a closed union held
by the type system. `CONTRACT-11` is held partly by the slot record type and partly by
`contract-children-are-typed`, because the table's object literal is written before a consuming
component gives it a type. `CONTRACT-5` — a key's NAME fixes what goes inside it — is held by nothing
and appears only as prose inside another rule's message. `CONTRACT-10` is expressed as an exemption
rather than a rule: four named surface branches are excused from two rules so each can own its fixed
wrapper.

## Reading a diff

1. **Check the path gate first.** Every gate here is built on the path containing `/src/`, directly or
   through the table predicate. A file outside it is not clean, it is unjudged — and the run is green
   either way, so the verdict has to say which.
2. **Check the exemptions second**, before reading any node. `leaves/`, `branches/Tree/`, the four
   named surface branches, `.test.`/`.spec.` files and `.artifacts` each switch specific rules off.
3. **Read the file's nodes for the AST rules.** One parser, one file, one pass; table rules inspect
   the selected `buildContracts` object, and the leaf rule inspects the leaf's JSX tree.
4. **Read the table and the tree only where a rule asks for them** — the key list for
   `no-unknown-contract-key`, the repository walk for `no-dead-contract-key`.
5. **Emit one block per finding**, naming the mechanism that fired.
6. **When an open hatch applies, write it into the verdict.** A repair that moves the same decision
   one node type sideways is not a repair, and the record has to say so.

## `no-literal-structural-class` — CONTRACT-1

**What it reports.** `structural` for a structural token in a static class attribute; `hoisted` for
the same token in a module-level string constant, naming the variable.

**How it detects.** Two visitors. A class attribute whose value is a string literal, or an expression
container holding a literal or a hole-free template; and a `VariableDeclarator` with the same kind of
init. The text splits on whitespace, each token drops everything up to its last `:` and any leading
`!`, then matches a nine-member exact set — `flex`, `grid`, `contents`, the four position values —
and one prefix regex covering `flex-`, `grid-cols-`, `gap-`, `items-`, `justify-`, `col-`, `row-`,
`space-x-`, `divide-`, `overflow-`, `inset-`, `top-`, `z-`, `basis-`, `shrink`, `grow` among others.

**What it cannot see.** A string gathered into a structure: `const CLASSES = {root: "flex gap-4"}`,
then `className={CLASSES.root}` — the init is an `ObjectExpression`, so neither visitor sees a string.
An array joined at use, `["flex", "gap-4"].join(" ")`. A class field or a default parameter,
`static root = "flex gap-4"`, `({cls = "flex"})` — those are `PropertyDefinition` and
`AssignmentPattern`, and the declarator visitor knows neither. And anything at all under `leaves/`.

**Boundary.** A composed class is `CONTRACT-2`, not this rule. This rule only ever sees one static
string.

## `no-class-composition-outside-contract` — CONTRACT-2

**What it reports.** `composer` for a call to a known class-composing helper; `interpolated` for a
class attribute built by template or by `+`.

**How it detects.** A `CallExpression` whose callee is a bare identifier in a set of eight names —
`cn`, `clsx`, `classnames`, `classNames`, `twMerge`, `twJoin`, `cva`, `tv` — reported regardless of
what it returns. Plus a class attribute whose expression is a template with expressions, or a
`BinaryExpression` with operator `+`.

**What it cannot see.** `utils.cn(base, extra)`, or `import {cn as classes}` and then `classes(...)`:
the callee must be a bare identifier from the set, so a member call and a renamed import are both
invisible — the opposite of how `only-the-frame-wears-a-node` handles a member call, so the two rules
disagree about the same evasion. Composition by array method, `[base, dense && "gap-2"].filter(Boolean).join(" ")`.
And `` const root = `flex ${gap}` `` assigned first, because the interpolation visitor only reads the
attribute.

**Boundary.** A ternary — `className={dense ? "flex gap-2" : "grid gap-4"}` — passes this rule AND
`no-literal-structural-class`: the first needs a static string, the second knows only templates and
`+`. It is the single most available hatch in this module.

## `only-the-frame-wears-a-node` — CONTRACT-4

**What it reports.** `worn` — a call to `contractNodeProps` anywhere but the frame.

**How it detects.** A `CallExpression` whose callee is the identifier `contractNodeProps`, or a
non-computed member expression whose property is that identifier. Nothing about the arguments, the
receiver or the result is examined.

**What it cannot see.** The act itself, only the name: `CONTRACTS["key"].classes.join(" ")` spread
onto a vendor element, or `contractNodeProps` passed by reference into `map`, reaches the same classes
and is invisible.

**Boundary.** Tests are deliberately not exempt here; only the frame's own folder is. A twin test that
spreads the props is a finding, not an allowance.

## `contract-why-is-a-reason` — CONTRACT-6

**What it reports.** `tooShort` when a reason runs under twelve words; `restates` when a reason is
built only from the words of its key.

**How it detects.** A `Property` whose non-computed key reads `why` and whose value is a string
literal. Below twelve words fires `tooShort`; otherwise each word is lowercased, stripped to `a-z`
and checked for membership in the hyphen-split words of the owning key, read as `node.parent.parent`.

**What it cannot see.** A reason written as a template literal — a single backtick turns the rule off
entirely, length floor included. Twelve words of filler clear the only floor there is. And `restates`
requires EVERY word to come from the key, which at a twelve-word minimum is close to unreachable, so
in practice that second message never fires.

**Boundary.** The rule is gated on one filename ending in `contracts/index.ts` under three known
prefixes. A second table file is not the table.

## `no-structural-host-outside-contract-frame` — CONTRACT-7

**What it reports.** `host` for a hand-written neutral box; `styledSemantic` for a semantic element
carrying a class.

**How it detects.** A `JSXOpeningElement` whose name equals its own lowercase form. The seven-member
neutral set — `div`, `section`, `main`, `header`, `footer`, `aside`, `nav` — reports unconditionally.
The four-member semantic set — `ul`, `ol`, `li`, `form` — reports only when some attribute is a
`JSXAttribute` named `className` or `class`.

**What it cannot see.** Eleven tag names are enumerated; `<span className="flex gap-2">`, `<article>`,
`<figure>`, `<label>`, `<table>` and `<dl>` are containers this rule has no opinion about. A spread
carrying the class, `<ul {...listProps}>`, is a `JSXSpreadAttribute` and fails the attribute test. And
a computed host — `const Tag = "div"` then `<Tag>`, or `createElement("div", props)` — is never a
lowercase identifier at the call site.

**Boundary.** Reaching for `<ul>` to dodge the neutral-box ban does not work: a semantic element
carrying a class stops being a wrapper and is reported.

## `no-hand-written-contract-attrs` — CONTRACT-8

**What it reports.** `marker` — a `data-node` or `data-why` attribute written by hand.

**How it detects.** A `JSXAttribute` whose name node is a `JSXIdentifier` reading `data-node` or
`data-why`.

**What it cannot see.** Every indirection: `<div {...{"data-node": key}} />`,
`element.setAttribute("data-node", key)`, or the pair passed through an ordinary props object. And a
third marker the frame starts painting tomorrow — the set holds two strings, and adding a marker to
the frame does not add it here.

**Boundary.** Only a literal JSX attribute name is matched; everything else is a different node type.

## `no-duplicate-entry-shape` — CONTRACT-9

**What it reports.** `duplicate` — an entry whose classes, host and slots another entry already
spells. A pair is reported once, on the later entry.

**How it detects.** A `CallExpression` on `buildContracts`; each property of the first argument is
reduced to a string built from the classes as a SORTED multiset, the `host` literal, and each named
slot's identity — `contract`, `composite` or `leaf`, alternatives sorted and de-duplicated — plus its
`optional` and `repeats` booleans. Key name, `why`, `restingCount` and slot `props` are excluded on
purpose. Equal strings collide in a `Map`.

**What it cannot see.** An entry it cannot read statically is skipped rather than reported, so
`{...shared, classes: [...]}`, `classes: STACK` or a computed key hides a copy permanently. And each
call builds its own map, so two identical entries in two `buildContracts` calls or two table files
never meet.

**Boundary.** Reordering the class array, renaming the key or rewriting the reason does not defeat it;
those are exactly the fields the shape string excludes.

## `no-unknown-contract-key` — none

**What it reports.** `unknown` — a key that is not in the table, listing the keys that are.

**How it detects.** A `JSXOpeningElement` whose element name is exactly `Tree`, reading a static
`contract` attribute; and a `CallExpression` on the bare identifier `contractSpec` with a string first
argument. The key list is read off disk as TEXT: the directory is walked up at most forty levels
trying three relative paths, the selected `buildContracts({` call is sliced brace-balanced, and keys
are matched by `/^\s{4}"([a-z][a-z-]*)":\s*\{/gm`.

**What it cannot see.** Four of the five forms that count as a reference elsewhere —
`defineContractComponent("typo-key")`, `defineContractProjection("typo-key")`, `CONTRACTS["typo-key"]`,
`contract: "typo-key"` in an object — are not validated here at all, so a typo in three of them is
both unvalidated and enough to keep a real key alive. A dynamic or aliased render —
`<Tree contract={key} />`, `contract={ok ? "a" : "b"}`, `import {Tree as Node}`, `<Contract.Tree>` —
is out of reach. And the key regex demands exactly four leading spaces and `[a-z][a-z-]*`:
reformatting the table empties the key list and switches the rule OFF in silence, while a key like
`grid-2-up` is absent from the list, so every correct use of it is reported unknown.

**Boundary.** This rule checks membership, not justification. Whether a new key deserves to exist is
`CONTRACT-9`, and no rule takes that judgement.

## `no-interaction-class-in-entry` — CONTRACT-12

**What it reports.** `interaction`, `paint` or `raised` — an entry class that is behaviour, paint or
elevation rather than arrangement.

**How it detects.** A `CallExpression` on `buildContracts`; each entry's `classes` or `classNames`
array is walked element by element and each string is tested RAW — no variant stripping — against
three regexes: an interaction family (`cursor-`, `group`, `hover:`, `active:`, `focus:`,
`focus-visible:`, `disabled:`, `aria-*:`, `data-[`), a paint family (six exact text colours,
`decoration-`, `underline`) and a raised-object family (`bg-surface`, `shadow`). A ground is spared
when the same array also holds a `w-full` and a `border-b` or `border-t`.

**What it cannot see.** Any variant walks a banned class straight in: `md:cursor-pointer`,
`lg:bg-surface`, `dark:shadow-md`, `!bg-surface`, `group-hover:opacity-80` — because these regexes do
not strip variants, unlike `no-literal-structural-class`, which does. Any other spelling of a ground,
an elevation or a colour is legal: `bg-white`, `bg-card`, `bg-neutral-50`, `drop-shadow-lg`, `ring-1`,
`text-primary`, `text-red-500`. And the band exemption is a two-token password rather than a
judgement: add `w-full` and `border-b` and `bg-surface` is spared.

**Boundary.** This rule reads entries in the table, not markup at a call site.

## `no-dead-contract-key` — CONTRACT-13

**What it reports.** `dead` — a key in the table that no walked file and no sibling slot names.

**How it detects.** A filesystem walk. The repository root is recovered from the table path by
longest-suffix match, then every `src` under the component roots plus every `apps/*/src` and
`packages/*/src` is walked — skipping `node_modules`, `.next`, `dist` and `.artifacts` — reading
`.ts .tsx .js .jsx .mjs .cjs`. Five reference regexes are applied to each file's text, and in any file
whose text contains the word `ContractKey`, every quoted lowercase hyphenated literal counts as a
reference. Keys named by another entry's `children.*.contract` slot are collected separately. What
remains is reported.

**What it cannot see.** A key named only in `.md`, `.mdx`, `.json` or any extension outside the six
walked is reported dead while a document renders it — and the finding arrives as an instruction to
delete. A dynamic render, `` contract={`row-${size}`} `` or `CONTRACTS[key]` in a file that never says
`ContractKey`, is reported dead while it draws on every load. The reverse costs too: the second
reference regex matches ANY object property named `contract` with a hyphenated string, so
`const job = {contract: "full-time"}` anywhere in the repository keeps a dead key alive, and one file
mentioning `ContractKey` promotes every quoted hyphenated literal in it to a reference.

**Boundary.** A tree that cannot be walked produces no findings at all rather than a table declared
dead.

## `contract-children-are-typed` — CONTRACT-11

**What it reports.** `missing` when a static contract entry has no object-valued `children` grammar;
`untyped` when one of that grammar's slots is not an object or names no owner identity. An identity is
one of the literal property names `leaf`, `composite` or `contract`.

**How it detects.** Only a file recognised as a contract table is visited. On each bare
`buildContracts({ ... })` call whose first argument is an object, the rule checks each object-valued
entry. It finds the entry's own `children` property and requires an `ObjectExpression`, so
`children: {}` is a valid empty grammar. It then walks each slot property and requires an object value
containing at least one property named `leaf`, `composite` or `contract`. The rule reports on the entry
when the grammar is absent or not an object, and on the slot when its owner identity is absent.

**What it cannot see.** It does not type-check the identity value, `props`, `optional`, `repeats` or
`restingCount`, and it does not require exactly one identity: `{leaf: "x", contract: "y"}` passes this
rule. A spread, computed property, non-object entry, or a second table not reached through a bare
`buildContracts` call is skipped or only judged by the nodes the visitor can read. The companion TypeScript
types still own the closed value vocabulary and the `repeats`/`restingCount` pairing.

**Boundary.** This is the table-side enforcement of `CONTRACT-11`, not a check of rendered React
children. `CONTRACT-5` asks whether the key's name fixes what belongs inside; this rule asks whether
every declared slot has a typed owner. `CONTRACT-10` wrapper mechanics and `CONTRACT-12` runtime props
are outside its AST.

## `no-structural-arrangement-in-leaf` — CONTRACT-1, CONTRACT-7

**What it reports.** `arrangement` when a file under a `leaves/` tier nests a structural host below
another structural host, or when a non-structural JSX parent directly owns two or more structural host
siblings. Structural hosts are the seven neutral names (`div`, `section`, `main`, `header`, `footer`,
`aside`, `nav`) plus the four semantic names (`ul`, `ol`, `li`, `form`). It reports the nested opening
or the second sibling opening and sends ownership to a branch rendered through `<Tree contract="..." />`.

**How it detects.** The rule runs only for a leaf path; tests and the frame are skipped. It records
top-level declarations whose static string or hole-free template is one of the eleven host names, so
`const Tag = "div"` followed by `<Tag>` is recognised. It then walks JSX openings for structural
ancestors and direct structural siblings. A leaf may still own one atomic primitive; the rule is the
guard that makes the `CONTRACT-1`/`CONTRACT-7` leaf exemption stop at the second structural decision.

**What it cannot see.** It does not inspect helper implementations, vendor props, custom components,
spread children, mapped or dynamically-created JSX, or aliases declared inside a function, assigned
indirectly, or resolved from an expression. It does not inspect class strings, so one structural host
with any leaf-owned glue is outside this rule.

**Boundary.** The pattern law binds this rule to the leaf exception for `CONTRACT-1` (structural
classes) and `CONTRACT-7` (structural hosts), not to a new CONTRACT code. It is not `CONTRACT-11`:
that rule checks named slots in the table, while this one checks whether a supposedly atomic leaf has
become a second JSX tree. It is not `CONTRACT-10`: named surface branches are not leaf files and own
their fixed vendor wrapper through a separate exception.

## Detection

The machinery every rule shares, and the two rules that reach outside the file.

| Part | Mechanism |
|---|---|
| path gate | All twelve gates are substring or suffix tests on the forward-slashed `context.filename`, resting on `/src/` |
| AST pass | Source-node rules use one parser, one file and one pass; table rules inspect the selected `buildContracts` object and the leaf rule inspects its JSX tree |
| table read | `no-unknown-contract-key` reads the contract table off disk as TEXT — an ESLint rule cannot import a TypeScript module — walking up at most forty levels over three relative paths, then matching keys by regex. The key cache invalidates on the table's mtime |
| tree walk | `no-dead-contract-key` walks the repository once per table per process, from a root recovered by longest-suffix match |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `className="lg:hover:!flex"` | Each token is cut at its last `:` and its leading `!` dropped before the match |
| `className={"flex gap-4"}`, or a backtick string with no holes | The container is unwrapped and a hole-free template is joined back into one string |
| `const ROOT = "flex flex-col gap-4"` | The declarator visitor exists for exactly this and names the variable |
| `class` instead of `className` | Both attribute names pass the same predicate |
| `` className={`flex ${dense ? "gap-2" : "gap-4"}`} `` | A template with expressions on a class attribute is reported as `interpolated` |
| `<ul className="flex gap-2">` | A semantic element carrying a class is reported as `styledSemantic` |
| `<section>` or `<nav>` instead of `<div>` | All seven neutral boxes are banned together, unconditionally |
| `helpers.contractNodeProps(contract)` | A non-computed member expression with that property is matched too |
| Spreading the props inside a test | Tests are not exempt from this rule; only the frame's folder is |
| Reordering classes, renaming the key, rewriting the reason | Classes compare as a sorted multiset; name, reason and resting count are excluded |
| Reordering slots or their alternatives | Slots sort by name; alternatives de-duplicate and sort before joining |
| A key rendered only from a sibling entry's slot | Child contract keys are collected before the report loop |
| A key rendered only in a story or a test | Stories and tests are walked exactly like product source |
| `children: {}` | An explicitly empty child grammar is typed and passes `contract-children-are-typed` |
| `children: {rows: {props: RowProps}}` | The slot has no `leaf`, `composite` or `contract` identity, so `untyped` fires |
| `children: {rows: {leaf: "row", contract: "row-stack"}}` | The rule checks identity-property presence only; TypeScript owns the stricter slot shape |
| `const Tag = "div"; <Tag><Vendor /></Tag>` in a leaf | A top-level static host alias is resolved and the nested structural host fires |
| `meta.shape = "leaf"` or `data-tier="leaf"` | Metadata does not exempt JSX structural arrangement |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| all twelve | **Any path without `/src/`.** An app with its routes at the repository root is not partly linted, it is entirely unlinted, and the run is green |
| `no-literal-structural-class` | **The whole `leaves/` folder, at any depth.** The exemption is a folder, so it is a policy boundary rather than a type |
| `no-structural-arrangement-in-leaf` | **Structural JSX hidden behind helpers, vendor props, dynamic aliases or expressions.** The rule reads only the leaf file's recognised JSX hosts and top-level static aliases |
| literal-class and host rules | **The four named surface branches, including nested subfolders.** The exemption is total rather than scoped to the wrapper seam: a fifth surface branch gets none, and a helper filed under one of the four gets a full one |
| table rules | **A table copy inside a plan record.** Only `no-dead-contract-key` skips `/.artifacts/`, so the source-AST table rules, including `contract-children-are-typed`, still lint a design candidate's copied vocabulary as if it shipped |

## Inputs

| Input | What reads it |
|---|---|
| `context.filename` | Every rule |
| The file's AST | Source-node rules, including `contract-children-are-typed` and `no-structural-arrangement-in-leaf` |
| The contract table on disk, read as TEXT | `no-unknown-contract-key` |
| The repository tree on disk | `no-dead-contract-key` |
| The table's mtime | The key cache, which invalidates on it |

## Rules

1. A rule that cannot read what it needs stays SILENT. A missing table, an unparsable table and an
   unwalkable tree all produce no findings, never a finding against every call site.
2. The three component roots are one list, so a layout added to it is added to every predicate at
   once.
3. Textual parsing is deliberate, not provisional. A rule runs under one parser on one file.
4. The frame is the only file exempt from wearing a node, and a test is not a second exemption.
5. Entry-level rules read entries off the selected `buildContracts` call, never off every object in
   the file, so a second table in one file cannot report the first.
6. A pair of duplicate entries is reported once, on the later one.
7. `contract-children-are-typed` checks the entry object itself because the consuming TypeScript type
   cannot see an untyped plain object literal before it is consumed.
8. `no-structural-arrangement-in-leaf` guards the leaf exemption: one atomic primitive is allowed,
   but a nested structural host or a second direct structural sibling is a composite arrangement.

## Exceptions

Each exemption is a folder or a filename test, which makes every one of them a policy boundary
anybody can walk into by moving a file.

- **The leaf tier.** Any file under `leaves/` writes its own classes and opens its own boxes. The
  exemption is guarded by `no-structural-arrangement-in-leaf`, which asks the limited source question
  the machine can see — does this file nest structural hosts or own two direct structural siblings?
  Helpers, vendor props and dynamic JSX remain outside that rule's sight.
- **The frame.** Any file under `branches/Tree/` may open hosts and paint markers, because turning a
  key into an element is its job. The exemption is the FOLDER: flatten the frame to a single file
  beside its siblings and the frame becomes a violator of the rule it implements.
- **Four named surface branches.** Files under `branches/SurfaceCard/`,
  `branches/SurfaceAccordionCard/`, `branches/SurfaceListCard/` and `branches/SurfaceFormCard/` are
  excused from the literal-class and host rules so each can own its fixed vendor wrapper.
- **Tests.** Files matching `.test.` or `.spec.` sit outside the class, composition and host rules,
  because a twin test may build fixture markup by hand. They remain inside
  `only-the-frame-wears-a-node`.
- **Plan records.** `no-dead-contract-key` alone skips any path containing `.artifacts`, because a
  design candidate carries a copy of the vocabulary and draws one page of it.

## Output

One block per finding:

```text
rule: <published rule name>
code: <CONTRACT-n | none>
file: <path>
mechanism: <the node type or path test that fired>
finding: <what the rule reports>
hatch: <the writing that would have avoided the report, when one exists>
```

The last line is not optional when an open hatch applies. A repair that moves the same decision one
node type sideways is not a repair, and the record has to say so.

## Worked example

**Input.** A block file at `components/blocks/course/CourseRow/index.tsx`:

```tsx
const ROOT = "flex items-center gap-4"

export function CourseRow({course, dense}) {
  return (
    <div className={ROOT}>
      <span className={dense ? "flex gap-2" : "grid gap-4"}>{course.title}</span>
    </div>
  )
}
```

The path contains `/src/` and the file is not under `leaves/`, `branches/Tree/` or a named surface
branch, so every rule runs.

```text
rule: no-literal-structural-class
code: CONTRACT-1
file: src/components/blocks/course/CourseRow/index.tsx
mechanism: VariableDeclarator with a string Literal init
finding: hoisted — ROOT
hatch: none
```

```text
rule: no-structural-host-outside-contract-frame
code: CONTRACT-7
file: src/components/blocks/course/CourseRow/index.tsx
mechanism: JSXOpeningElement in the neutral set
finding: host — div
hatch: none
```

Two blocks, and the third violation is not one of them. The ternary on the `span` writes structural
classes at a call site and is invisible: `no-literal-structural-class` needs a static string and a
conditional is not one, while `no-class-composition-outside-contract` knows only templates and `+`.
The verdict records it:

```text
rule: no-class-composition-outside-contract
code: CONTRACT-2
file: src/components/blocks/course/CourseRow/index.tsx
mechanism: none fired
finding: none
hatch: a ternary between two static class strings passes this rule and CONTRACT-1 together
```

Repaired, the block types the key and the frame opens the box:

```tsx
export function CourseRow({course}) {
  return <Tree contract="row-between" title={course.title} />
}
```

Now `no-unknown-contract-key` becomes the rule that matters: if `row-between` is not a key in the
table, it fires — and if the table was reformatted to two-space indentation, it reads no keys at all
and says nothing.

## Scope

This module documents the rules that exist in the source and nothing else. A rule that ought to exist
and does not is open risk, never documented here as if it ran. Prose and examples name no product, no
component library and no repository; published rule names and the identifiers the rules match on are
quoted verbatim, because those are the strings a build prints.
