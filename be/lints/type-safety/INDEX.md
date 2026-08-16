---
id: be-lints-type-safety-index
title: INDEX.md
slug: /be/lints/type-safety
sidebar_label: type-safety
sidebar_position: 0
description: What the type-safety lint rules can actually see, what they cannot, and which law code each one holds.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `type-safety`

## Law

The type system is the cheapest reviewer a codebase has, and the law it holds is one sentence: do not
switch it off. Every way of switching it off looks locally reasonable — a cast that gets a build
green, an object type written where it is used, an enum spelled the cheap way — and every one of
them is invisible the day after it lands.

This shelf does not restate that law. It records **enforcement**: for each published rule, the exact
syntax node it watches, and — the part nobody writes down — the ways of writing the same mistake
that it does not watch at all.

The rule module publishes **three** rules, which is the number expected, and this file documents
three. Their identity is the published name, which is the string that appears in a build log and in
a disable comment; no numeric code is invented for them here.

Two further entries appear in the module's recommended severity block but are **not** published by
it: they belong to the TypeScript plugin and are named rather than reimplemented. They are recorded
in `## Exceptions` and argued in `audit.md`, and they get no section of their own, because a rule
this module does not own is a rule this module cannot describe the internals of.

## Rules

| Rule | Law code | What it reports |
|---|---|---|
| `no-double-cast` | `TYPE-2` (and the test half of `TYPE-6`) | A cast whose operand is itself a cast to `unknown` — the `x as unknown as T` spelling exactly — in any file that is not in the spec family or the test tree. |
| `no-inline-param-type` | `TYPE-3` | A **destructured** parameter whose type annotation is a bare object type literal, on a function declaration, a function expression or an arrow. |
| `no-const-enum` | `TYPE-4` | An enum declaration carrying the `const` modifier, anywhere, with the enum's name interpolated into the message. |

All three map to a code the law actually carries. The findings on this shelf are not missing
mappings; they are the four codes around them.

**Finding — a law code with no rule, by an argued decision.** `TYPE-5` — a discriminated union beats
a bag of booleans — is deliberately unenforced, and the module says why in its header: whether a set
of booleans describes one situation or several genuinely independent ones needs to know what the
code means, and a rule that guessed would fire on every record with two flags in it. This is the
right call recorded in the right place. It is listed here so a reader does not go looking for the
rule that holds it.

**Finding — a law code held by a borrowed rule.** `TYPE-1` — no `any` — is enforced by
`@typescript-eslint/no-explicit-any`, named in the recommended block. Reimplementing a rule everybody
already has would be a maintenance cost with no gain, so the decision is sound; the consequence is
that the loudest code in the law is held by a rule this module cannot describe, cannot version and
cannot guarantee is registered. If the TypeScript plugin is absent from the consuming configuration,
that entry does not silently do nothing — the configuration fails to resolve it.

**Finding — an enforced decision the law never published.** The recommended block also switches on
`@typescript-eslint/array-type` with `default: "generic"` and `readonly: "generic"`, which mandates
one spelling of the array type over the other. The law text carries no code for that decision: it
runs `TYPE-1` through `TYPE-6` and none of them is about array spelling. A build will therefore
report a violation of a rule whose reasoning exists only in the rule module's comments. Recorded
rather than repaired, because inventing the mapping would be inventing the law.

**Finding — an exit implemented against the letter of the code that grants it.** `TYPE-6` says the
sanctioned test exit is "written into the config rather than sprinkled as per-line suppressions".
`no-double-cast` puts it inside the rule instead, and argues the case: building a deliberately wrong
value is how a spec proves a closed API refuses it, so the exit is a property of the lane rather
than of any repository's file layout. The argument is good and the placement contradicts the
sentence that authorises it. One of the two should move.

## Detection

| Rule | Mechanism |
|---|---|
| `no-double-cast` | Visits `TSAsExpression`. Reports when `node.expression.type === "TSAsExpression"` **and** that inner cast's `typeAnnotation.type === "TSUnknownKeyword"`. The report node is the **outer** cast. File gate is evaluated once in `create` and returns an **empty visitor object** for the whole file: `context.filename` (falling back to `context.getFilename()`), back-slashes replaced by forward slashes, matching `/\.(?:spec\|test\|e2e-spec\|int-spec\|harness-spec)\.ts$/` or containing the literal segment `/src/tests/`. |
| `no-inline-param-type` | Visits `FunctionDeclaration`, `FunctionExpression` and `ArrowFunctionExpression`, and walks `node.params`. Each parameter is unwrapped once: if its type is `TSParameterProperty`, `.parameter` is read instead. Reports when the resulting node's type is exactly `ObjectPattern`, it carries a `typeAnnotation`, and that annotation's inner `typeAnnotation.type` is exactly `TSTypeLiteral`. The report node is the annotation, not the pattern. No file gate — every file the configuration points at is scanned. |
| `no-const-enum` | Visits `TSEnumDeclaration`; returns unless the boolean `node.const` is set; otherwise reports the declaration with `node.id.name` interpolated into the message. No file gate, no exemption, no test lane. |

Nothing here resolves a module, consults a type, reads `tsconfig.json` or runs code. Every decision
is made from the shape of the syntax tree, which is why the rules are fast and why every open hatch
below is a different way of writing the same meaning.

## Escape Hatches

### Closed

| Way of writing it | Why it does not slip past |
|---|---|
| `(x as unknown) as T` | Parentheses are not nodes in this tree. The parenthesised form and the bare form are the same shape, and both report. |
| `x as unknown as A as B` | The outer cast does not match — its operand's annotation is `A`, not `unknown` — but the middle node is itself a `TSAsExpression` over a cast to `unknown`, so the chain reports exactly once rather than escaping. |
| A double cast buried in a call argument, a return expression, a default value or an object property | There is no positional gate. The visitor fires on the node wherever it appears. |
| A file named `spec-helpers.ts` or `test-data.ts` | The exemption pattern is anchored: `\.spec\.ts$`, `\.test\.ts$` and the three suffixed forms. A filename that merely contains the word is still linted. |
| A Windows-shaped path reaching the test gate | The filename is normalised to forward slashes before either test, so the gate behaves the same on both platforms. |
| An inline destructured type on a class method, a constructor, or an object-literal method | A method's body is a `FunctionExpression`, which is one of the three visited nodes. Only the declaration form differs; the rule does not care. |
| `constructor(private readonly deps: Deps)` | The parameter property wrapper is unwrapped before the shape test, so the wrapper cannot hide a pattern from the rule — even though TypeScript itself already forbids a parameter property declared with a binding pattern. |
| A nested destructure — `({ user: { id } }: { user: { id: string } })` | The outer parameter is still an `ObjectPattern` carrying a bare `TSTypeLiteral`, so the extra depth changes nothing. |
| `export const enum X` and a `const enum` inside a `declare module` block | Both are still `TSEnumDeclaration` nodes with the `const` flag set. The modifiers around it are not read. |
| A `const enum` written in a spec file | This rule has no test lane. The exemption belongs to one rule, not to the module. |

### Open

| Rule | Way of writing it that is NOT caught |
|---|---|
| `no-double-cast` | **Two statements instead of one.** `const loose: unknown = row` then `return loose as Enrollment` launders exactly as much, through one cast whose operand is an identifier. This is not sabotage — it is what somebody does when the line got too long. |
| `no-double-cast` | **Another bridge type.** Only `TSUnknownKeyword` is tested, so `x as any as T`, `x as never as T`, `x as {} as T` and `x as object as T` all pass this rule. `as never as` deserves its own line: `never` is assignable to everything, it launders with the same force, and unlike the `any` form there is no second rule waiting behind it. |
| `no-double-cast` | **The angle-bracket assertion.** `<T><unknown>value` is a `TSTypeAssertion` node, not a `TSAsExpression`, so the older spelling of the same overrule is invisible to a rule written for the newer one. |
| `no-double-cast` | **A generic coercion helper.** `const coerce = <T,>(value: unknown): T => value as T` contains one cast, from `unknown`, which is legal everywhere. Every call site then launders with no cast at all — the whole rule deleted by one tidy-up. |
| `no-double-cast` | **A guard that checks nothing.** `const isEnrollment = (row: unknown): row is Enrollment => true` produces the same trust downstream with no cast in the file. The law's own remedy — "narrow with a guard that actually checks" — is the part a syntactic rule cannot verify. |
| `no-double-cast` | **A single cast off an `any`-returning call.** `JSON.parse(raw) as Payload` is one cast, and the value it starts from was already unchecked. The bridge exists; it is just not spelled. |
| `no-double-cast` | **The filename.** The gate is a whole-file exit keyed on a suffix. Renaming a production module to end `.spec.ts` switches the rule off for everything in it, and filename is the cheapest thing in a repository to change. |
| `no-double-cast` | **The folder.** Anything under a path segment `/src/tests/` is exempt wholesale, forever, whether or not it is still a test — including a factory or fixture module that production code imports. A folder exemption is not a file exemption, and it never expires on its own. |
| `no-inline-param-type` | **Not destructuring it.** `(params: { userId: string; courseId: string })` is an `Identifier` parameter, so the rule never looks at its annotation. The shape is exactly as unreferenceable, exactly as un-importable, and exactly as likely to be retyped by the second caller — and it is the more common way to write it. |
| `no-inline-param-type` | **A default value.** `({ userId }: { userId: string } = { userId: "" })` makes the parameter an `AssignmentPattern` whose `left` holds the pattern and the annotation. The unwrap handles the parameter-property wrapper and nothing else, so making the argument optional deletes the rule. |
| `no-inline-param-type` | **Wrapping the literal.** The annotation must be *exactly* a `TSTypeLiteral`. `{ a: string } & Base` is an intersection, `{ a: string } \| undefined` is a union, and `Readonly<{ a: string }>` or `Partial<{ a: string }>` is a type reference. All three still bury an unreferenceable shape in the signature. |
| `no-inline-param-type` | **A function node that is not one of the three.** A callback type inside `type Handler = ({ id }: { id: string }) => void` is a `TSFunctionType`; an interface member is a `TSMethodSignature`; an overload signature is a `TSDeclareFunction`; an abstract method's value is a `TSEmptyBodyFunctionExpression`. None of the four is visited, so the shape can be fixed in a contract and merely obeyed in the implementation. |
| `no-inline-param-type` | **A local alias.** `type Params = { userId: string }` declared in the same file, not exported, satisfies the rule completely — while remaining exactly as un-importable as the literal it replaced. The rule enforces "named"; the law asks for a named type in the module's types folder, and the difference between those two is invisible to a syntax tree. |
| `no-inline-param-type` | **An array pattern.** `([id, count]: [string, number])` buries an inline tuple in the signature, and the shape test admits only `ObjectPattern`. |
| `no-const-enum` | **`declare enum`.** An ambient enum without the `const` modifier emits no runtime object either: it cannot be iterated, cannot be reverse-mapped, and fails at run time in every way the message describes. `node.const` is false, so nothing reports. This is the failure the law names, reached by a keyword the rule does not read. |
| `no-const-enum` | **A declaration file.** Ambient const enums live in `.d.ts`, and a typical configuration does not point the linter at them. The rule has no gate of its own, which means its reach is entirely the consuming repository's glob. |
| `no-const-enum` | **Somebody else's const enum.** The rule watches declarations, not uses. A const enum imported from a dependency carries every failure the message lists, at every use site, and is declared in no file this module ever sees. Closing that needs module resolution and type information, which this module does not use. |
| `no-const-enum` | **Anything outside the configured globs.** With no file gate at all, the rule's scope is exactly what the consuming configuration hands it — generated code, tooling folders and scripts directories are commonly outside, and a code generator emitting a const enum is exactly the case nobody reviews. |

## Inputs

| Input | Evidence required |
|---|---|
| file path | `context.filename`, falling back to `context.getFilename()`, back-slashes normalised — read by one rule only |
| cast shape | the node type of a cast's operand, and the node type of the inner cast's type annotation |
| parameter shape | the node type of a parameter after one unwrap, and the node type of its inner type annotation |
| enum modifier | the `const` boolean on an enum declaration |
| enum name | `node.id.name`, interpolated into the message |

## Invariants

- A rule's identity is its published name; nothing here assigns it a number.
- Detection is purely syntactic. No module is resolved, no type is consulted, no compiler option is
  read, no code runs.
- Two of the three rules have **no file gate at all**. Their scope is whatever the consuming
  configuration points the linter at, and nothing narrower.
- The module publishes three rules. Its recommended block names five entries, two of which belong to
  another plugin and are a hard dependency on that plugin being registered.
- The one exemption on the shelf is a **whole-file** exit, not a file-plus-value pair.
- Every rule reports the node that carries the defect: the outer cast, the annotation, the
  declaration. Only the enum rule carries data in its message.
- The module's own severity opinion is `error` for all five entries; the consuming configuration
  remains the authority on what is actually switched on.

## Exceptions

- **The spec family and the test tree** are exempt from `no-double-cast`, and from nothing else.
  Building a deliberately wrong value is how a spec proves a closed API refuses it. The exit is
  whole-file: inside an exempt file the rule does not exist, rather than permitting one construct.
- **`.spec.ts`, `.test.ts`, `.e2e-spec.ts`, `.int-spec.ts`, `.harness-spec.ts`** are the five
  recognised suffixes, plus any path under a `/src/tests/` segment. The suffix list is closed and
  anchored; the folder segment is not.
- **The other two rules have no exemptions.** A `const enum` in a spec reports; an inline
  destructured type in a test reports.
- **`TYPE-5` has no rule**, by an argued decision recorded in the rule module's header.
- **`TYPE-1` is held by `@typescript-eslint/no-explicit-any`** and the array spelling by
  `@typescript-eslint/array-type`. Both are named in the recommended block, neither is published
  here, and this shelf documents neither's internals.

## Output

```text
rule:    <no-double-cast | no-inline-param-type | no-const-enum>
file:    <path as the gate saw it, forward slashes>
node:    <TSAsExpression | TSTypeAnnotation on an ObjectPattern | TSEnumDeclaration>
message: <doubleCast | inline | constEnum>
data:    <enum name — constEnum only>
```

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why a machine is worth having for
it, `example.md` for the code that fires and the code that slips through, `audit.md` while reviewing
whether the enforcement still matches the law, and `changelog.md` for version history.

## Scope

This module documents the three rules published by the type-safety law's rule module, shipped in
`@starci/eslint-canon-be`. It documents no rule that ought to exist: a rule that cannot be pointed at
is a proposal, and proposals are listed in `audit.md` as open risk instead.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A rule
added, removed or renamed in the rule module is such a change; so is an open hatch that gets closed,
and so is a change to which law code a rule holds.
