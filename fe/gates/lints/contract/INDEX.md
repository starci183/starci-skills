---
id: fe-lints-contract-index
title: INDEX.md
slug: /gates/lints/contract
sidebar_label: contract
sidebar_position: 0
description: What the ten contract rules can actually see in source, and what they cannot.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `contract`

## Law

A structural node is described ONCE, by a key that owns the classes the node wears, the element it
opens and the reason its children sit that way. An author who needs a shape types the key. The law
these rules hold is `patterns/contract.md`, whose codes run `CONTRACT-1` through `CONTRACT-13`.

**The strongest guarantees in this law are not rules at all.** The class vocabulary and the host
vocabulary are closed unions, so an off-scale value is unrepresentable rather than forbidden, and a
slot's identity, cardinality and props are compile errors before any rule runs. What the rules here
cover is the part a type cannot see: which FILE wrote a string, whether a key exists, and whether
anybody renders it.

This shelf documents ENFORCEMENT, not the law. A section here is true of the rule as implemented on
this date, including the places where the rule is narrower than the sentence it is named after.

## Rules

Ten rules ship. The source publishes exactly ten entries in its `rules` export, and the count in this
table matches the file.

| Rule | Code | What it reports |
|---|---|---|
| `no-literal-structural-class` | `CONTRACT-1` | `structural` — a structural token in a static class attribute; `hoisted` — the same token in a module-level string constant |
| `no-class-composition-outside-contract` | `CONTRACT-2` | `composer` — a call to a known class-composing helper; `interpolated` — a class attribute built by template or by `+` |
| `only-the-frame-wears-a-node` | `CONTRACT-4` | `worn` — a call to `contractNodeProps` anywhere but the frame |
| `contract-why-is-a-reason` | `CONTRACT-6` | `tooShort` — a reason under twelve words; `restates` — a reason built only from the words of the key |
| `no-structural-host-outside-contract-frame` | `CONTRACT-7` | `host` — a hand-written neutral box; `styledSemantic` — a semantic element carrying a class |
| `no-hand-written-contract-attrs` | `CONTRACT-8` | `marker` — a `data-node` or `data-why` attribute written by hand |
| `no-duplicate-entry-shape` | `CONTRACT-9` | `duplicate` — an entry whose classes, host and slots another entry already spells |
| `no-unknown-contract-key` | *none — see below* | `unknown` — a key that is not in the table, with the list of keys that are |
| `no-interaction-class-in-entry` | `CONTRACT-12` | `interaction`, `paint`, `raised` — an entry class that is behaviour, paint or elevation rather than arrangement |
| `no-dead-contract-key` | `CONTRACT-13` | `dead` — a key in the table that no walked file and no sibling slot names |

**`no-unknown-contract-key` enforces no code in the law, and that is a finding rather than a gap to
paper over.** The source files it under `CONTRACT-9`, and its message quotes `CONTRACT-9` and
`CONTRACT-5` as advice, but the check it performs is membership: does this string appear as a key in
the table. No numbered code states that. `CONTRACT-9` governs whether a NEW key is justified — a
judgement no rule takes — and the rule that actually holds `CONTRACT-9` is
`no-duplicate-entry-shape`. Recorded in `audit.md` rather than mapped by invention.

Three codes have no rule and are not meant to have one. `CONTRACT-3` and `CONTRACT-11` are closed
unions and a checked slot record, held by the type system. `CONTRACT-5` — a key's NAME fixes what
goes inside it — is held by nothing, and appears here only as prose inside another rule's message.
`CONTRACT-10` is expressed as an exemption rather than a rule: four named surface branches are
excused from two rules so they can own their fixed wrapper.

## Detection

| Rule | Mechanism |
|---|---|
| `no-literal-structural-class` | Two visitors. `JSXAttribute` where the name is `className` or `class`, value a `Literal` string or a `JSXExpressionContainer` holding a `Literal` or a hole-free `TemplateLiteral`; the text is split on whitespace, each token has everything before its last `:` and any leading `!` stripped, then matched against a nine-member exact set (`flex`, `grid`, `contents`, the four position values) and one prefix regex (`flex-`, `grid-cols-`, `gap-`, `items-`, `justify-`, `col-`, `row-`, `space-x-`, `divide-`, `overflow-`, `inset-`, `top-`, `z-`, `basis-`, `shrink`, `grow` among others). `VariableDeclarator` whose id is an `Identifier` and whose init is a `Literal` string or hole-free `TemplateLiteral`, same token scan |
| `no-class-composition-outside-contract` | `CallExpression` whose callee is a bare `Identifier` in a set of eight names (`cn`, `clsx`, `classnames`, `classNames`, `twMerge`, `twJoin`, `cva`, `tv`), reported on the call regardless of what it returns. Plus `JSXAttribute` on a class attribute whose expression is a `TemplateLiteral` with expressions or a `BinaryExpression` with operator `+` |
| `only-the-frame-wears-a-node` | `CallExpression` whose callee is the `Identifier` `contractNodeProps`, or a non-computed `MemberExpression` whose property is that identifier. Nothing about the arguments, the receiver or the result is examined |
| `contract-why-is-a-reason` | `Property` whose non-computed key reads `why` and whose value is a string `Literal`. Word count below twelve fires `tooShort`; otherwise every word is lowercased, stripped to `a-z`, and checked for membership in the hyphen-split words of the owning key, which is read as `node.parent.parent` |
| `no-structural-host-outside-contract-frame` | `JSXOpeningElement` whose name is a `JSXIdentifier` equal to its own lowercase form. Membership in a seven-member neutral set (`div`, `section`, `main`, `header`, `footer`, `aside`, `nav`) reports unconditionally; membership in a four-member semantic set (`ul`, `ol`, `li`, `form`) reports only when some attribute is a `JSXAttribute` named `className` or `class` |
| `no-hand-written-contract-attrs` | `JSXAttribute` whose name node is a `JSXIdentifier` whose text is `data-node` or `data-why` |
| `no-duplicate-entry-shape` | `CallExpression` on the `Identifier` `buildContracts`; the first argument's `ObjectExpression` properties are each reduced to a string built from the classes as a SORTED multiset, the `host` literal, and each named slot's identity (`contract`, `composite` or `leaf`, alternatives sorted and de-duplicated) plus its `optional` and `repeats` booleans. Key name, `why`, `restingCount` and slot `props` are excluded on purpose. Equal strings collide in a `Map` and the later entry is reported |
| `no-unknown-contract-key` | `JSXOpeningElement` whose element name is exactly `Tree`, reading a static `contract` attribute; and `CallExpression` on the bare `Identifier` `contractSpec` with a string first argument. The key list comes from reading the table off disk: `dirname` is walked up at most forty levels trying three relative paths, the selected `buildContracts({` call is sliced brace-balanced, and keys are matched by `/^\s{4}"([a-z][a-z-]*)":\s*\{/gm` |
| `no-interaction-class-in-entry` | `CallExpression` on `buildContracts`; each entry's `classes` or `classNames` `ArrayExpression` is walked element by element and each string literal is tested RAW — no variant stripping — against three regexes: an interaction family (`cursor-`, `group`, `hover:`, `active:`, `focus:`, `focus-visible:`, `disabled:`, `aria-*:`, `data-[`), a paint family (six exact text colours, `decoration-`, `underline`) and a raised-object family (`bg-surface`, `shadow`). A ground is spared when the same class array also holds a `w-full` and a `border-b` or `border-t` |
| `no-dead-contract-key` | Filesystem walk. The repository root is recovered from the table path by longest-suffix match, then every `src` under the component roots plus every `apps/*/src` and `packages/*/src` is walked, skipping `node_modules`, `.next`, `dist` and `.artifacts`, reading files matching `.ts .tsx .js .jsx .mjs .cjs`. Five reference regexes are applied to each file's text, and in any file whose text contains the word `ContractKey`, every quoted lowercase hyphenated literal counts as a reference. Keys named by another entry's `children.*.contract` slot are collected separately. What remains is reported |

## Escape Hatches

### Closed

| Rule | The writing somebody expects to slip past | Why it does not |
|---|---|---|
| `no-literal-structural-class` | `className="lg:hover:!flex"` — hiding a structural token behind variants and the important marker | Each token is reduced by cutting everything up to its last `:` and dropping a leading `!` before the match |
| `no-literal-structural-class` | `className={"flex gap-4"}` or a backtick string with no holes | The expression container is unwrapped, and a `TemplateLiteral` with no expressions is joined back into one string |
| `no-literal-structural-class` | Hoisting the string one line up into `const ROOT = "flex flex-col gap-4"` | The second visitor exists for exactly this and reports the declarator, naming the variable |
| `no-literal-structural-class` | Writing `class` instead of `className` | Both attribute names are accepted by the same predicate |
| `no-class-composition-outside-contract` | ``className={`flex ${dense ? "gap-2" : "gap-4"}`}`` | A template with expressions on a class attribute is reported as `interpolated` |
| `no-structural-host-outside-contract-frame` | `<ul className="flex gap-2">` — reaching for a semantic element to dodge the neutral-box ban | A semantic element carrying a class stops being a wrapper and is reported as `styledSemantic` |
| `no-structural-host-outside-contract-frame` | `<section>` or `<nav>` instead of `<div>` | All seven neutral boxes are banned together, and unconditionally |
| `only-the-frame-wears-a-node` | `helpers.contractNodeProps(contract)` — putting the helper behind an object | A non-computed member expression whose property is that name is matched as well as the bare identifier |
| `only-the-frame-wears-a-node` | Spreading the props inside a test instead of product source | Tests are deliberately not exempt; only the frame's own folder is |
| `no-duplicate-entry-shape` | Reordering the class array, renaming the key, or writing a different reason | Classes compare as a sorted multiset, and name, reason and resting count are excluded from the shape string |
| `no-duplicate-entry-shape` | Reordering the slot record, or listing a slot's alternatives the other way round | Slots sort by name and alternatives de-duplicate and sort before joining |
| `no-dead-contract-key` | A key rendered only from a sibling entry's slot, which no walked file names | Child contract keys are collected from every entry's `children.*.contract` before the report loop |
| `no-dead-contract-key` | A key rendered only in a story or a test | Story and test files are walked exactly like product source; rendering the key is what the question asks |
| `no-dead-contract-key` | A repository whose tree cannot be walked at all | The reader returns null and the rule does nothing, rather than reporting the whole table dead |

### Open

| Rule | The writing it genuinely does not catch | What that costs |
|---|---|---|
| **all ten** | Any file whose path does not contain `/src/`. Every gate here is built on that substring, directly or through the table predicate | An app laid out with its routes at the repository root rather than under `src` is not partly linted, it is entirely unlinted, and the run is green |
| `no-literal-structural-class` | The string gathered into a structure: `const CLASSES = { root: "flex flex-col gap-4" }`, then `className={CLASSES.root}` | The declarator's init is an `ObjectExpression`, not a `Literal`, so neither visitor sees a string. Not sabotage — somebody tidying up |
| `no-literal-structural-class` | An array of tokens joined at use: `["flex", "gap-4"].join(" ")` | A literal inside an array is not at the attribute the rule watches, and the joined value is a call result |
| `no-literal-structural-class` | A class field or a default parameter: `static root = "flex gap-4"`, `({ cls = "flex" })` | Those are `PropertyDefinition` and `AssignmentPattern`, and the second visitor only knows `VariableDeclarator` |
| `no-literal-structural-class` and `no-class-composition-outside-contract` together | `className={dense ? "flex gap-2" : "grid gap-4"}` | The first rule needs a static string and a conditional is not one; the second knows only templates and `+`. A ternary passes BOTH rules, which is the single most available hatch in this module |
| `no-literal-structural-class` | Anything at all inside a `leaves/` folder, at any depth | The leaf exemption is a folder, so it is a policy boundary rather than a type: any component filed there may write its own structural classes, which is the exact drift the folder's own comment records |
| `no-literal-structural-class` and `no-structural-host-outside-contract-frame` | Anything at all inside `branches/SurfaceCard/`, `branches/SurfaceAccordionCard/`, `branches/SurfaceListCard/` or `branches/SurfaceFormCard/`, including nested subfolders | Four folder names are hardcoded, and the exemption is total rather than scoped to the wrapper seam. A fifth surface branch gets no exemption at all, and a helper filed under one of the four gets a full one |
| `no-class-composition-outside-contract` | `utils.cn(base, extra)`, or `import { cn as classes }` and then `classes(...)` | The callee must be a bare identifier whose text is one of eight names. A member call and a renamed import are both invisible — and this is the opposite of the member handling in `only-the-frame-wears-a-node`, so the two rules disagree about the same evasion |
| `no-class-composition-outside-contract` | `[base, dense && "gap-2"].filter(Boolean).join(" ")` | Composition by array method is composition, and no name in the set appears |
| `no-class-composition-outside-contract` | ``const root = `flex ${gap}`;`` then `className={root}` | The interpolation visitor only reads the attribute, and the constant visitor in the sibling rule requires a template with no holes |
| `contract-why-is-a-reason` | ``why: `the tags wrap onto their own line` `` — a reason written as a template literal | The value must be a string `Literal`. A backtick turns the reason off entirely, including the length floor |
| `contract-why-is-a-reason` | Twelve words of filler: `"this node exists because the design puts these children next to one another here"` | Length is the only floor. `restates` requires EVERY word to come from the key, which for a twelve-word minimum is close to unreachable — one word outside the key defeats it, so in practice the second message never fires |
| `contract-why-is-a-reason` | A table split across files, or entries written outside the `buildContracts` call | The rule is gated on one filename ending in `contracts/index.ts` under three known prefixes. A second table file is not the table |
| `no-structural-host-outside-contract-frame` | `<span className="flex gap-2">`, `<article>`, `<figure>`, `<label>`, `<table>`, `<dl>` | Eleven tag names are enumerated; every other container element is a node with no key that this rule has no opinion about |
| `no-structural-host-outside-contract-frame` | `<ul {...listProps}>` where the spread carries a class | `isClassAttribute` requires a `JSXAttribute`, and a `JSXSpreadAttribute` is not one |
| `no-structural-host-outside-contract-frame` | `const Tag = "div"` then `<Tag>`, or `createElement("div", props)` | The host name must be a lowercase `JSXIdentifier` written at the call site |
| `no-hand-written-contract-attrs` | `<div {...{ "data-node": key }} />`, or `element.setAttribute("data-node", key)`, or the pair passed through an ordinary props object | Only a literal JSX attribute name is matched. Every indirection is a different node type |
| `no-hand-written-contract-attrs` | A third marker the frame starts painting tomorrow | The set holds two strings. A marker added to the frame is not added here |
| `no-unknown-contract-key` | `defineContractComponent("typo-key")`, `defineContractProjection("typo-key")`, `CONTRACTS["typo-key"]`, `contract: "typo-key"` in an object | These are four of the five forms the dead-key walker counts as a reference, and NONE of them is validated as a key. The two rules disagree about what naming a key looks like, so a typo in three of the four forms is both unvalidated and enough to keep a real key alive |
| `no-unknown-contract-key` | `<Tree contract={key} />`, `contract={ok ? "a" : "b"}`, `import { Tree as Node }`, `<Contract.Tree>` | The element name must read exactly `Tree` and the attribute must be a static string |
| `no-unknown-contract-key` | A table indented with two spaces, or a key containing a digit | The key regex demands exactly four leading whitespace characters and `[a-z][a-z-]*`. Reformatting the table empties the key list, which makes the reader return null and switches the rule OFF in silence; a key like `grid-2-up` is absent from the list, so every correct use of it is reported unknown |
| `no-duplicate-entry-shape` | `{ ...shared, classes: [...] }`, `classes: STACK`, or any computed key | An entry that cannot be read statically is skipped rather than reported, so one spread hides a copy permanently |
| `no-duplicate-entry-shape` | Two entries with identical shapes in two different `buildContracts` calls or two table files | Each call builds its own map; nothing compares across calls |
| `no-interaction-class-in-entry` | `md:cursor-pointer`, `lg:bg-surface`, `dark:shadow-md`, `!bg-surface`, `group-hover:opacity-80` | The three regexes test the RAW class string with no variant stripping, unlike `no-literal-structural-class`, which does strip. Any responsive or theme prefix walks a banned class straight into the table |
| `no-interaction-class-in-entry` | `bg-white`, `bg-card`, `bg-neutral-50`, `drop-shadow-lg`, `ring-1`, `text-primary`, `text-red-500` | The raised family is two prefixes and the paint family is six exact colour names. Any other spelling of a ground, an elevation or a colour is legal |
| `no-interaction-class-in-entry` | A card written as a band: add `w-full` and `border-b` and `bg-surface` is spared | The band exemption is a two-token password rather than a judgement about what the node is |
| `no-interaction-class-in-entry`, `no-duplicate-entry-shape`, `contract-why-is-a-reason` | A table copy inside a plan record | Only `no-dead-contract-key` skips `/.artifacts/`. The other three table rules lint a design candidate's copied vocabulary as if it shipped |
| `only-the-frame-wears-a-node` | `CONTRACTS["key"].classes.join(" ")` spread onto a vendor element, or `contractNodeProps` passed by reference into `map` | The rule bans one helper NAME, not the act. Reaching the same classes any other way reproduces the failure the law calls the one with no red anywhere |
| `no-dead-contract-key` | A key named only in `.md`, `.mdx`, `.json`, or any file extension outside the six walked | Reported dead while a document renders it. The finding arrives as an instruction to delete |
| `no-dead-contract-key` | ``contract={`row-${size}`}`` or `CONTRACTS[key]` with a variable, in a file that never says `ContractKey` | Reported dead while it draws on every load |
| `no-dead-contract-key` | The reverse: `const job = { contract: "full-time" }` anywhere in the repository | The second reference regex matches any object property named `contract` with a hyphenated string. Unrelated domain data keeps a dead key alive, and one file mentioning `ContractKey` promotes every quoted hyphenated literal in it to a reference |

## Inputs

| Input | What reads it |
|---|---|
| `context.filename` | Every rule. All ten gates are substring or suffix tests on the forward-slashed path |
| The file's AST | Nine rules. One parser, one file, one pass |
| The contract table on disk, read as TEXT | `no-unknown-contract-key`, through a walk up the directory tree and two regexes. An ESLint rule cannot import a TypeScript module, so the table is parsed by hand |
| The repository tree on disk | `no-dead-contract-key`, through one cached walk per table per process |
| The table's mtime | The key cache, which invalidates on it |

## Invariants

- A rule that cannot read what it needs stays SILENT. A missing table, an unparsable table and an
  unwalkable tree all produce no findings, never a finding against every call site.
- The three component roots are one list, so a layout added to it is added to every predicate at
  once. A rule that wrote a prefix by hand would be silently wrong in both directions in the other
  layout.
- Textual parsing is deliberate, not provisional. A rule runs under one parser on one file.
- The frame is the only file exempt from wearing a node, and a test is not a second exemption.
- Entry-level rules read entries off the selected `buildContracts` call, never off every object in
  the file, so a second table in one file cannot report the first.
- A pair of duplicate entries is reported once, on the later one.

## Exceptions

Each exemption is a folder or a filename test, which makes every one of them a policy boundary
anybody can walk into by moving a file.

- **The leaf tier.** Any file under a `leaves/` folder writes its own classes and opens its own
  boxes. What keeps a component out is a question a person asks — does this file arrange two
  contents — and no gate asks it.
- **The frame.** Any file under `branches/Tree/` may open hosts and paint markers, because turning a
  key into an element is its job. The exemption is the FOLDER: flatten the frame to a single file
  beside its siblings and the frame becomes a violator of the rule it implements.
- **Four named surface branches.** Files under `branches/SurfaceCard/`,
  `branches/SurfaceAccordionCard/`, `branches/SurfaceListCard/` and `branches/SurfaceFormCard/` are
  excused from the literal-class and host rules so each can own its fixed vendor wrapper.
- **Tests.** Files matching `.test.` or `.spec.` are outside the governed set for the class,
  composition and host rules, because a twin test may build fixture markup by hand. They remain
  inside `only-the-frame-wears-a-node`.
- **Plan records.** `no-dead-contract-key` alone skips any path containing `.artifacts`, because a
  design candidate carries a copy of the vocabulary and draws one page of it.

## Output

```text
rule: <published rule name>
code: <CONTRACT-n | none>
file: <path>
mechanism: <the node type or path test that fired>
finding: <what the rule reports>
hatch: <the writing that would have avoided the report, when one exists>
```

The last line is not optional when an open hatch applies to the finding. A repair that moves the
same decision one node type sideways is not a repair, and the record has to say so.

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why the law wants a machine
holding it, `example.md` for the code that fires and the code that slips past, `audit.md` while
reviewing the enforcement itself, and `changelog.md` for the version history.

## Scope

This module documents the rules that exist in the source on this date and nothing else. A rule that
ought to exist and does not is recorded in `audit.md` under open risk, never documented here as if
it ran. Prose and examples name no product, no component library and no repository; published rule
names and the identifiers the rules match on are quoted verbatim, because those are the strings a
build prints.

## Version Rule

Increment all five records by `0.01` when a rule is added, removed, renamed, or when its detection
or its hatches change, and record it in `changelog.md`.
