---
title: Exception-identity
---

# Exception-identity

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |


## Record

The input is code that is already written — one class, one file, one hunk of a diff. The output is a
**verdict**: whether the node was in scope at all, which published rule fired, what it reported and on
which node, which law code that maps to, and the open hatch that would have hidden the same failure.
This module chooses no naming scheme. It refuses one, and it must be able to point at the character it
refuses on.

## Law

A failure's identity is one word written in three alphabets, and all three must say the same thing:
the class name, the code passed on the wire, and the type of the payload the throw site has to
satisfy. Each alphabet is read by a different consumer and none of them can read the others — the
gates read the class name, the client reads the code, the caller reads the metadata type.

The law states five codes, `IDENTITY-1` through `IDENTITY-5`. **Three of them have a rule.** This
module does not restate the law; it records **enforcement**: which of the law's rulings a machine
holds, by what mechanism, and — the part that is normally left unwritten — which ways of writing the
same defect the machine does not see at all. A ruling with no rule is known to be unenforced. A rule
believed to be closed and in fact leaky is worse, because it buys the reader's attention and spends it
on nothing.

## Published rules

Three rules ship for this law, in `@canon-be`, all three at `error`.

| Rule | Code | What it reports |
|---|---|---|
| `exception-name-ends-in-exception` | `IDENTITY-1` | `suffix` — a class extending the house base whose name does not end in `Exception` |
| `exception-code-matches-class-name` | `IDENTITY-2` | `mismatch` — the letters of the code differ from the letters of the class name · `notLiteral` — the code is not a string literal |
| `exception-metadata-type-named-for-class` | `IDENTITY-4` | `untyped` — the destructured metadata parameter carries no type annotation · `named` — it is annotated with a type reference other than `<Class>Metadata` |

`IDENTITY-3` (the rename ruling) and `IDENTITY-5` (the status ruling) have **no rule at all**. The
rename ruling spans two revisions of one file and the status ruling is a judgement about intent;
neither is visible in a single parse. Both are review-held, which the law says in as many words. They
are unenforced rather than covered, and a green run says nothing about either.

Two further facts belong beside the table. The third rule is **filed against the wrong code in its own
source**: its section banner reads `IDENTITY-3`, but `IDENTITY-3` in the law is the rename ruling and
the metadata-type ruling is `IDENTITY-4`. The mapping above follows the law, not the banner. And **no
rule enforces one code with two rules** — `IDENTITY-2` reports a mismatch, not a duplicate. Two classes
with the same name in different folders would both pass and both emit one code.

## Reading a diff

1. **Decide scope before anything else, and record it.** Scope here is a node, not a path: a rule
   exists only inside a `ClassDeclaration` whose superclass is the bare identifier `AbstractException`.
   Out of scope does not mean the declaration passed — it means no rule considered it a house exception.
2. **Check the exemptions, which are all structural.** A class with no constructor of its own is
   outside the second and third rules by construction. A file-level or `super()`-line disable comment
   is the only granted exit, and it must name the client and the retirement date, or the author of a
   generated declaration.
3. **Read the nodes the rules read, in their order.** The class `id` and `superClass`; then the
   constructor `MethodDefinition`; then that constructor's **top-level statements only** for the
   `super()` call; then `params[0]`, unwrapped through an `AssignmentPattern` if one is there.
4. **Emit one block per finding.** Three rules can fire on one class, and they are three verdicts.
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure**, including on
   a clean verdict where the silence comes from an early `return` rather than from correct code.
6. **Do not report what no rule watches.** Two of the five codes have no machine, and neither does
   uniqueness across classes; a verdict that claims otherwise is wrong about the module.

## `exception-name-ends-in-exception` — IDENTITY-1

**What it reports.** `suffix` — one report on the class name identifier, carrying the name it should
have been given.

**How it detects.** Visits `ClassDeclaration`. Requires `node.id` present,
`node.superClass.type === "Identifier"` and `node.superClass.name === "AbstractException"`, then tests
`/Exception$/` against `node.id.name`. Reports on the `Identifier` node of the class name.

**What it cannot see.** An intermediate base — `class DomainException extends AbstractException {}`,
then `class OrderNotFound extends DomainException {}` — because the gate is a literal comparison
against one identifier spelling; introducing a domain base is the most ordinary refactor there is, and
it silently unenforces every declaration beneath it. An aliased import,
`import { AbstractException as Base }` then `extends Base`, is the same total silence in one line. An
anonymous default export has a null `node.id` and is skipped before anything else runs. A class
expression, `const OrderNotFoundException = class extends AbstractException { … }`, is never visited at
all. And `/Exception$/` tests a tail, not a meaning: `class Exception` and `class OrderErrorException`
both pass.

**Boundary.** This rule judges a name. What the class passes on the wire is `IDENTITY-2`; what its
payload is typed as is `IDENTITY-4`. It is also the rule that makes the others real — the neighbouring
exception rules all key on the `Exception` suffix, so a correctly based, correctly placed, correctly
thrown class named `*Error` would be checked by nothing.

## `exception-code-matches-class-name` — IDENTITY-2

**What it reports.** `mismatch` — the letters of the code differ from the letters of the class name;
this is the code copied from the exception written just above, and the code left behind by a rename.
`notLiteral` — the code is assembled at runtime or fetched from elsewhere instead of being written
where it is read.

**How it detects.** Same `ClassDeclaration` gate. Finds the `MethodDefinition` with
`kind === "constructor"` in `node.body.body`, then scans **only the top-level statements** of that
constructor for an `ExpressionStatement` whose `expression` is a `CallExpression` with a `Super`
callee. Reads `arguments[1]`, requires `type === "Literal"` with a `string` value, and compares both
sides after stripping `_` and upper-casing. Reports on the argument node.

**What it cannot see.** A `super()` call inside a block — `if (cause) { super(msg, "A", meta) } else { super(msg, "B", meta) }`
— is not in the flat statement list, so the rule returns and nothing is
reported, which is exactly the shape a conditional code would take. No code at all,
`super("Order not found")`, returns early on `arguments.length < 2`. A constructor inherited rather
than declared hits `if (!ctor) return`. Case is invisible, because both sides are upper-cased:
`"order_not_found_exception"` passes, and so does `"OrderNotFoundException"` used as the code, though
the law says SCREAMING_SNAKE. Separators are invisible, because underscores are stripped before
comparison: `"ORDERNOTFOUNDEXCEPTION"` is unreadable and legal. Every hatch in the class gate above
applies here unchanged.

**Boundary.** The rule compares one code against one class name. It never compares two codes, so it
reports a mismatch and never a duplicate.

## `exception-metadata-type-named-for-class` — IDENTITY-4

**What it reports.** `untyped` — the destructured first constructor parameter carries no type
annotation. `named` — it is annotated with a type reference whose name is not `<Class>Metadata`.

**How it detects.** Same `ClassDeclaration` and constructor gate. Reads `params[0]`, unwrapping an
`AssignmentPattern` to its `left`. Requires `ObjectPattern`. Reads
`param.typeAnnotation.typeAnnotation`; absent → `untyped`. Present and `TSTypeReference` with an
`Identifier` `typeName` → compares that identifier against `` `${className}Metadata` ``. Anything else
is ignored. Reports on the parameter or the annotation.

**What it cannot see.** A metadata parameter that is not destructured —
`constructor(metadata: AbstractExceptionMetadata)` — is an `Identifier`, not an `ObjectPattern`, so the
rule returns before reading the annotation: the exact defect the rule exists for, written one comma
differently. An inline or composed type, `{ id }: { id?: string }` or
`{ id }: AbstractExceptionMetadata & { id?: string }`, is `TSTypeLiteral` or `TSIntersectionType`, not
`TSTypeReference`, and is skipped. A qualified name, `{ id }: Errors.OrderNotFoundExceptionMetadata`,
has a `TSQualifiedName` `typeName` and is skipped even though it may well be right. And the rule reads
an identifier's spelling only: `export type OrderNotFoundExceptionMetadata = Record<string, unknown>`
passes clean, because no alias is resolved and nothing checks that the type extends the shared metadata
base, which is half of what `IDENTITY-4` asks for. Only `params[0]` is read; a metadata parameter in
second position is invisible.

**Boundary.** Unwrapping `AssignmentPattern` is a recorded repair, not a nicety: `{ … }: Metadata = {}`
parses as an assignment pattern wrapping the object pattern, and reading only the outer node once hid
exactly the declarations this rule exists to catch.

## Detection

Every rule is a pure AST walk. Nothing here reads the filename, resolves an import, follows a type
alias, or consults the type checker.

| Part | Mechanism |
|---|---|
| class gate | A **literal identifier comparison**: `node.id` present, `node.superClass.type === "Identifier"`, `node.superClass.name === "AbstractException"`. Only `ClassDeclaration` is visited |
| constructor gate | The `MethodDefinition` with `kind === "constructor"` in `node.body.body`; `if (!ctor) return` |
| super-call scan | A **flat statement list** — the constructor's top-level `ExpressionStatement`s whose `expression` is a `CallExpression` with a `Super` callee |
| code comparison | `arguments[1]` must be a `Literal` with a `string` value; both sides stripped of `_` and upper-cased before comparing |
| parameter reader | `params[0]`, unwrapped through `AssignmentPattern` to `.left`, required to be `ObjectPattern`, then `param.typeAnnotation.typeAnnotation` |
| outside the file | **Nothing.** No import is resolved, no type is resolved, no filename is read, no option is declared |

Two mechanisms carry the whole shelf, and both are narrow on purpose: the class gate is a literal
identifier comparison against one spelling, and the super-call scan is a flat statement list.
Everything in the Open table below follows from those two sentences.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| The code lifted into a constant — `const CODE = "ORDER_NOT_FOUND_EXCEPTION"`, then `super(msg, CODE)` | `arguments[1]` is an `Identifier`, not a `Literal`, so `notLiteral` fires. The constant that launders a literal past an attribute-matching rule does not launder one past this one |
| The code taken from an enum member — `super(msg, Codes.OrderNotFound)` | `MemberExpression` is not a `Literal`. Same report |
| A destructured parameter carrying a default — `constructor({ id }: SomeMetadata = {})` | The default wraps the pattern in an `AssignmentPattern`; the rule unwraps to `.left` before reading the annotation |
| A correctly based, correctly placed, correctly thrown class named `*Error` | This is the case the first rule was written for; the neighbouring exception rules all key on the suffix and would each report nothing |
| A code separated with hyphens — `"ORDER-NOT-FOUND-EXCEPTION"` | Only `_` is stripped, so the hyphens survive into the comparison and the letters differ. `mismatch` fires |
| A code missing the `_EXCEPTION` tail — `"ORDER_NOT_FOUND"` | The class name's own `Exception` suffix is part of the compared letters. `mismatch` fires |
| Moving or renaming the file, or calling it a fixture | No rule reads `context.filename`, so no folder, suffix or fixture path exempts anything |
| The base class's own declaration — `class AbstractException extends Error {}` | Its superclass is `Error`, so no rule considers it a house exception |
| An acronym split differently — `GRAPHQL_DATA_…` against `GraphQLData…` | Deliberately **not** a report. Underscore placement inside an acronym has no correct answer and a rule insisting on one would fire on code that is right |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| all three | **An intermediate base.** `class DomainException extends AbstractException {}` and every declaration beneath it stops being a house exception |
| all three | **An aliased import.** `import { AbstractException as Base }`, then `extends Base` — one line in the import block |
| all three | **An anonymous default export.** `node.id` is null and the gate returns first |
| all three | **A class expression.** `ClassExpression` is never entered by any of the three |
| second and third | **A constructor inherited rather than declared.** `if (!ctor) return`; the identity is decided where the rule is not looking |
| `exception-name-ends-in-exception` | **A name that ends correctly and identifies nothing** — `class Exception`, `class OrderErrorException` |
| `exception-code-matches-class-name` | **A `super()` inside `if`, `try`, `switch` or a nested block**, **no code at all**, **any casing**, and **no separators at all** |
| `exception-metadata-type-named-for-class` | **A parameter that is not destructured**, **an inline or composed type**, **a qualified type name**, **a correctly named type that means nothing**, and **a metadata parameter in second position** |
| none of them | **Two classes emitting one code.** `IDENTITY-2` compares a code with its own class name, never with another code |
| none of them | **Everything `IDENTITY-3` and `IDENTITY-5` state** — the rename ruling and the status ruling are review-held |

The pattern behind most of those rows is one sentence: **the rules recognise one exact shape and fall
silent on every neighbouring shape rather than reporting it.** An early `return` is indistinguishable,
in a build log, from a clean file.

## Inputs

| Input | Evidence required |
|---|---|
| Source AST | `ClassDeclaration`, its `superClass`, its `id`, its constructor `MethodDefinition`, that constructor's top-level statements and `params[0]` |
| Scope decision | Which class gate matched, or that none did |
| Code argument | `arguments[1]` of the `super()` call: its node type, and its value when it is a string `Literal` |
| Metadata parameter | The node type of `params[0]` after unwrapping, and the node type of its annotation |
| Filename | **Nothing.** No rule reads `context.filename`, so no folder, suffix or fixture path exempts a file |
| Options | **Nothing.** All three declare `schema: []`; there is no configuration surface |
| Imports | **Nothing.** No module is resolved; the superclass is matched by spelling |
| Types | **Nothing.** No type is resolved; the metadata annotation is matched by spelling |

## Rules

1. A rule fires only inside a `ClassDeclaration` whose superclass is the bare identifier
   `AbstractException`.
2. The three rules hold `IDENTITY-1`, `IDENTITY-2` and `IDENTITY-4`. `IDENTITY-3` and `IDENTITY-5` are
   review-held, and nothing here may be written as though they had a machine.
3. The identity of a rule is its published name. It is reproduced verbatim, because it is the string a
   build log prints and the string a disable comment carries.
4. No rule ships a fixer. Every report is a message, and the suggested spelling in a message is prose,
   not a patch.
5. No rule reads the filename, so the rules cannot be escaped by moving or renaming a file — and cannot
   be relaxed for a fixture either.
6. No rule takes options, so a repository cannot weaken one without disabling it, and disabling it is
   visible.
7. Underscore placement is never a report; letters are the ruling.
8. All three sit at `error` in the shipped configuration, and all three arrived at `warn` behind a debt
   entry that named their offenders and were flipped only when that entry closed.
9. Open hatches must be written down. An unknown hatch is more dangerous than a ruling with no rule.

## Exceptions

Exceptions are part of the enforcement, not relief from it. Each names the rule it steps around and the
reason that survives review.

- **A released client still matches the old code.** `IDENTITY-3` says the class keeps its old name until
  that client retires, which releases `exception-name-ends-in-exception` and
  `exception-code-matches-class-name` for that declaration. If the rename already happened, the honest
  form is a disable comment on the `super()` line naming the client and the retirement date — not a
  second name invented to make the rule quiet.
- **A generated or vendored declaration.** A file this repository does not author is disabled at the
  file level, releasing all three rules, with a comment saying who authors it.
- **An acronym split.** Not an exception at all; the rule does not fire, because underscores are
  stripped before comparison. Recorded here because it is the report readers most often expect and do
  not get.
- **A class with no constructor of its own** is outside `exception-code-matches-class-name` and
  `exception-metadata-type-named-for-class` by construction, not by permission. If it inherits an
  identity, the identity is reviewed where it is written.

## Output

One block per finding:

```text
file:     <path as written; no rule reads it>
scope:    <in — ClassDeclaration extending the bare identifier AbstractException | out — no rule considered this a house exception>
rule:     <exception-name-ends-in-exception | exception-code-matches-class-name | exception-metadata-type-named-for-class>
law code: <IDENTITY-1 | IDENTITY-2 | IDENTITY-4>
message:  <suffix | mismatch | notLiteral | untyped | named>
node:     <class name identifier | super() argument | constructor parameter | type annotation>
severity: error
hatch:    <the open hatch that would have hidden this failure, or none>
```

A clean file emits one block per rule that ran, with `message: none` and `severity: none`, and a
`hatch` line whenever the silence came from an early `return` rather than from correct code. An
out-of-scope file emits `scope: out`, `message: none` and the reason the class gate did not match; it
was not judged, and it must never be written as passing.

## Worked example

**Input.** One declaration this module rejects:

```ts
export class OrderNotFoundError extends AbstractException {
  constructor({ orderId }) {
    super("Order not found", "ORDER_MISSING", { orderId })
  }
}
```

The class gate matches — `node.id` is present and the superclass is the bare identifier
`AbstractException` — so all three rules run, and all three fire.

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    in — ClassDeclaration extending the bare identifier AbstractException
rule:     exception-name-ends-in-exception
law code: IDENTITY-1
message:  suffix
node:     class name identifier
severity: error
hatch:    none
```

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    in — ClassDeclaration extending the bare identifier AbstractException
rule:     exception-code-matches-class-name
law code: IDENTITY-2
message:  mismatch
node:     super() argument
severity: error
hatch:    none
```

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    in — ClassDeclaration extending the bare identifier AbstractException
rule:     exception-metadata-type-named-for-class
law code: IDENTITY-4
message:  untyped
node:     constructor parameter
severity: error
hatch:    none
```

**Repaired.** The three alphabets are made to say the same thing:

```ts
export type OrderNotFoundExceptionMetadata = Record<string, unknown>

export class OrderNotFoundException extends AbstractException {
  constructor({ orderId }: OrderNotFoundExceptionMetadata) {
    super("Order not found", "ORDER_NOT_FOUND_EXCEPTION", { orderId })
  }
}
```

All three rules now pass. One of the three passes for a reason that is not compliance:

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    in — ClassDeclaration extending the bare identifier AbstractException
rule:     exception-metadata-type-named-for-class
law code: IDENTITY-4
message:  none
node:     type annotation
severity: none
hatch:    the rule reads the identifier's spelling only; `OrderNotFoundExceptionMetadata = Record<string, unknown>` resolves no alias and is never checked against the shared metadata base, which is half of what IDENTITY-4 asks for
```

And one ordinary refactor removes all three rules from this declaration without changing a character of
its identity:

```ts
export class DomainException extends AbstractException {}

export class OrderNotFoundException extends DomainException {
  constructor(metadata: AbstractExceptionMetadata) {
    super("Order not found", "SOMETHING_ELSE", metadata)
  }
}
```

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    out — superClass identifier is `DomainException`, not `AbstractException`
rule:     exception-name-ends-in-exception | exception-code-matches-class-name | exception-metadata-type-named-for-class
law code: IDENTITY-1 | IDENTITY-2 | IDENTITY-4
message:  none
node:     none
severity: none
hatch:    an intermediate base; the class gate is a literal identifier comparison against one spelling, so every declaration beneath a domain base is invisible rather than compliant
```

## Scope

This module documents three published rules and nothing else. A rule that ought to exist but is not in
the source is not documented here; it is an open risk. `IDENTITY-3` and `IDENTITY-5` are review-held
and this module makes no claim about them. Uniqueness across declarations is owned by no rule and no
module here. Rule names are reproduced verbatim because the name is the identity — it is what a build
log prints, what a disable comment carries, and what every conversation about the failure uses. Prose
and examples name no product.
