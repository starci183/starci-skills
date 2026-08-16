---
id: be-lints-exception-identity-index
title: INDEX.md
slug: /be/lints/exception-identity
sidebar_label: exception-identity
sidebar_position: 0
description: What the three exception-identity rules actually see, and every way of writing that walks past them.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `exception-identity`

## Law

A failure's identity is one word written in three alphabets, and all three must say the same thing:
the class name, the code passed on the wire, and the type of the payload the throw site has to
satisfy. Each alphabet is read by a different consumer and none of them can read the others — the
gates read the class name, the client reads the code, the caller reads the metadata type.

This shelf does not restate that law. It records **enforcement**: which of the law's rulings a
machine holds, by what mechanism, and — the part that is normally left unwritten — which ways of
writing the same defect the machine does not see at all. A ruling with no rule is known to be
unenforced. A rule believed to be closed and in fact leaky is worse, because it buys the reader's
attention and spends it on nothing.

## Rules

Three rules ship for this law, in `@starci/eslint-canon-be`, all three at `error`.

| Rule | Law code | What it reports |
|---|---|---|
| `exception-name-ends-in-exception` | `IDENTITY-1` | `suffix` — a class extending the house base whose name does not end in `Exception` |
| `exception-code-matches-class-name` | `IDENTITY-2` | `mismatch` — the letters of the code differ from the letters of the class name · `notLiteral` — the code is not a string literal |
| `exception-metadata-type-named-for-class` | `IDENTITY-4` | `untyped` — the destructured metadata parameter carries no type annotation · `named` — it is annotated with a type reference other than `<Class>Metadata` |

Three findings live in this table and are argued in [`audit.md`](./audit.md):

- **The third rule is filed against the wrong code in its own source.** Its section banner reads
  `IDENTITY-3`, but `IDENTITY-3` in the law is the rename ruling. The metadata-type ruling is
  `IDENTITY-4`. The mapping above follows the law, not the banner.
- **`IDENTITY-3` and `IDENTITY-5` have no rule.** The rename ruling spans two revisions of one file
  and the status ruling is a judgement about intent; neither is visible in a single parse. Both are
  review-held, which the law says in as many words.
- **No rule enforces one code with two rules.** `IDENTITY-2` reports a mismatch, not a duplicate.
  Two classes with the same name in different folders would both pass and both emit one code.

## Detection

Every rule is a pure AST walk. Nothing here reads the filename, resolves an import, follows a type
alias, or consults the type checker.

| Rule | Mechanism |
|---|---|
| `exception-name-ends-in-exception` | Visits `ClassDeclaration`. Requires `node.id` present, `node.superClass.type === "Identifier"` and `node.superClass.name === "AbstractException"`, then tests `/Exception$/` against `node.id.name`. Reports on the `Identifier` node of the class name. |
| `exception-code-matches-class-name` | Same `ClassDeclaration` gate. Finds the `MethodDefinition` with `kind === "constructor"` in `node.body.body`, then scans **only the top-level statements** of that constructor for an `ExpressionStatement` whose `expression` is a `CallExpression` with a `Super` callee. Reads `arguments[1]`, requires `type === "Literal"` with a `string` value, and compares both sides after stripping `_` and upper-casing. Reports on the argument node. |
| `exception-metadata-type-named-for-class` | Same `ClassDeclaration` and constructor gate. Reads `params[0]`, unwrapping an `AssignmentPattern` to its `left`. Requires `ObjectPattern`. Reads `param.typeAnnotation.typeAnnotation`; absent → `untyped`. Present and `TSTypeReference` with an `Identifier` `typeName` → compares that identifier against `` `${className}Metadata` ``. Anything else is ignored. Reports on the parameter or the annotation. |

Two mechanisms carry the whole shelf, and both are narrow on purpose: the class gate is a **literal
identifier comparison** against one spelling, and the super-call scan is a **flat statement list**.
Everything in the Open table below follows from those two sentences.

## Escape Hatches

### Closed

Ways of writing that a reader might reasonably expect to slip past, and do not.

| Written as | Why it is still reported |
|---|---|
| The code lifted into a constant — `const CODE = "ORDER_NOT_FOUND_EXCEPTION"`, then `super(msg, CODE)` | `arguments[1]` is an `Identifier`, not a `Literal`, so `notLiteral` fires. The constant that launders a literal past an attribute-matching rule does not launder one past this one. |
| The code taken from an enum member — `super(msg, Codes.OrderNotFound)` | `MemberExpression` is not a `Literal`. Same report. |
| A destructured parameter carrying a default — `constructor({ id }: SomeMetadata = {})` | The default wraps the pattern in an `AssignmentPattern`; the rule unwraps to `.left` before reading the annotation. The source records that reading only the outer node once hid exactly the declarations the rule exists for. |
| A correctly based, correctly placed, correctly thrown class named `*Error` | This is the case the first rule was written for. The neighbouring exception rules all key on the suffix and would each report nothing. |
| A code separated with hyphens — `"ORDER-NOT-FOUND-EXCEPTION"` | Only `_` is stripped before comparison, so the hyphens survive into the comparison and the letters differ. `mismatch` fires. |
| A code missing the `_EXCEPTION` tail — `"ORDER_NOT_FOUND"` | The class name's own `Exception` suffix is part of the compared letters. `mismatch` fires. |
| An acronym split differently — `GRAPHQL_DATA_...` against `GraphQLData...` | Deliberately **not** a report. Underscore placement inside an acronym has no correct answer and a rule insisting on one would fire on code that is right. |
| The base class's own declaration — `class AbstractException extends Error {}` | Its superclass is `Error`, so no rule considers it a house exception. |

### Open

Ways of writing this shelf genuinely does not catch. Each is ordinary code somebody would write while
tidying up, not sabotage.

| Written as | What walks past, and why |
|---|---|
| An intermediate base — `class DomainException extends AbstractException {}`, then `class OrderNotFound extends DomainException {}` | **All three rules stop existing.** The class gate is a literal comparison against one identifier spelling, so a subclass one level down is not a house exception as far as any rule is concerned. Introducing a domain base is the most ordinary refactor there is, and it silently unenforces every declaration beneath it. |
| An aliased import — `import { AbstractException as Base }`, then `extends Base` | Same gate, same total silence. The rule compares the spelling at the `extends` site, and an alias is a one-line change in the import block. |
| An anonymous default export — `export default class extends AbstractException { … }` | `node.id` is null, so `isHouseException` returns false before anything else runs. All three rules skip it. |
| A class expression — `const OrderNotFoundException = class extends AbstractException { … }` | Only `ClassDeclaration` is visited. `ClassExpression` is never entered by any of the three. |
| A `super()` call inside a block — `if (cause) { super(msg, "A", meta) } else { super(msg, "B", meta) }` | The scan reads the constructor's **top-level statements only**. A `super()` inside `if`, `try`, `switch` or a nested block is not found, the rule returns, and nothing is reported — which is exactly the shape a conditional code would take. |
| No code at all — `super("Order not found")` | `arguments.length < 2` returns early. A failure that passes no identity on the wire is reported by nothing here. |
| A constructor inherited rather than declared | `if (!ctor) return`. A class with no constructor of its own has its code and its metadata type decided somewhere the rule is not looking. |
| A code in the wrong case — `"order_not_found_exception"` | The comparison upper-cases **both** sides, so any casing passes. The law says SCREAMING_SNAKE; the rule does not check case. `"OrderNotFoundException"` passed as the code is also accepted. |
| A code with no separators — `"ORDERNOTFOUNDEXCEPTION"` | Underscores are stripped before comparison, so their absence cannot be detected. Unreadable, and legal. |
| A metadata parameter that is not destructured — `constructor(metadata: AbstractExceptionMetadata)` | `params[0]` is an `Identifier`, not an `ObjectPattern`, so the rule returns before reading the annotation. The exact defect the rule exists for, written one comma differently. |
| An inline or composed type — `{ id }: { id?: string }`, or `{ id }: AbstractExceptionMetadata & { id?: string }` | `TSTypeLiteral` and `TSIntersectionType` are not `TSTypeReference`. The rule returns without reporting. |
| A qualified type name — `{ id }: Errors.OrderNotFoundExceptionMetadata` | `typeName` is a `TSQualifiedName`, not an `Identifier`. Skipped, even though it may well be right. |
| A correctly named type that means nothing — `export type OrderNotFoundExceptionMetadata = Record<string, unknown>` | The rule reads an identifier's spelling. It resolves no alias and never checks that the type extends the shared metadata base, which is half of what `IDENTITY-4` asks for. |
| A metadata parameter in second position | Only `params[0]` is read. |
| A class name that satisfies the suffix and says nothing — `class Exception extends AbstractException {}`, `class OrderErrorException extends AbstractException {}` | `/Exception$/` tests a tail, not a meaning. A name that ends correctly and identifies nothing passes. |

The pattern behind eleven of those fourteen rows is one sentence: **the rules recognise one exact
shape and fall silent on every neighbouring shape rather than reporting it.** An early `return` is
indistinguishable, in a build log, from a clean file.

## Inputs

| Input | What the rules read |
|---|---|
| Source AST | `ClassDeclaration`, its `superClass`, its `id`, its constructor `MethodDefinition`, that constructor's top-level statements and `params[0]` |
| Filename | **Nothing.** No rule reads `context.filename`, so no folder, suffix or fixture path exempts a file |
| Options | **Nothing.** All three declare `schema: []`; there is no configuration surface |
| Imports | **Nothing.** No module is resolved; the superclass is matched by spelling |
| Types | **Nothing.** No type is resolved; the metadata annotation is matched by spelling |

## Invariants

- A rule fires only inside a `ClassDeclaration` whose superclass is the bare identifier
  `AbstractException`.
- No rule ships a fixer. Every report is a message, and the suggested spelling in a message is prose,
  not a patch.
- No rule reads the filename, so the rules cannot be escaped by moving or renaming a file — and
  cannot be relaxed for a fixture either.
- No rule takes options, so a repository cannot weaken one without disabling it.
- Underscore placement is never a report; letters are the ruling.
- All three sit at `error` in the shipped configuration, and all three arrived at `warn` behind a
  debt entry that named their offenders and were flipped only when that entry closed.

## Exceptions

Exceptions are part of the enforcement, not relief from it. Each names the rule it steps around and
the reason that survives review.

- **A released client still matches the old code.** `IDENTITY-3` says the class keeps its old name
  until that client retires. If the rename already happened, the honest form is a disable comment on
  the `super()` line naming the client and the retirement date — not a second name invented to make
  the rule quiet.
- **A generated or vendored declaration.** A file this repository does not author is disabled at the
  file level with a comment saying who authors it.
- **An acronym split.** Not an exception at all; the rule does not fire. Recorded here because it is
  the report readers most often expect and do not get.
- **A class with no constructor of its own** is outside the second and third rules by construction,
  not by permission. If it inherits an identity, the identity is reviewed where it is written.

## Output

```text
rule:     <exception-name-ends-in-exception | exception-code-matches-class-name | exception-metadata-type-named-for-class>
law code: <IDENTITY-1 | IDENTITY-2 | IDENTITY-4>
message:  <suffix | mismatch | notLiteral | untyped | named>
node:     <class name identifier | super() argument | constructor parameter | type annotation>
severity: error
```

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for what each rule catches and why it is worth a
machine, [`example.md`](./example.md) for the code that fires and the code that walks past,
[`audit.md`](./audit.md) while judging whether the enforcement is honest, and
[`changelog.md`](./changelog.md) for what changed.

## Scope

This module documents three published rules and nothing else. A rule that ought to exist but is not
in the source is not documented here; it is an open risk in `audit.md`. Rule names are reproduced
verbatim because the name is the identity — it is what a build log prints, what a disable comment
carries, and what every conversation about the failure uses. Prose and examples name no product.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A rule
added, removed or renamed in the source is a change to this module even when the law does not move.
