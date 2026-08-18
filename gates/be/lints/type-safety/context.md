# Type-safety

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses nothing. It refuses, and it must be able to point at the character it refuses on.

## Law

The type system is the cheapest reviewer a codebase has, and the law it holds is one sentence: do not
switch it off. Every way of switching it off looks locally reasonable — a cast that gets a build
green, an object type written where it is used, an enum spelled the cheap way — and every one of them
is invisible the day after it lands.

The law runs `TYPE-1` through `TYPE-6`: **six codes**. The rule module publishes **three** rules,
which is the number expected, and three codes are actually held by a rule of this module's own.
A rule's identity is its published name — the string that appears in a build log and in a disable
comment — and no numeric identifier is invented for a rule here.

Two further entries appear in the module's recommended severity block but are **not** published by
it: they belong to the TypeScript plugin and are named rather than reimplemented. They get no section
of their own, because a rule this module does not own is a rule this module cannot describe the
internals of.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-double-cast` | `TYPE-2` (and the test half of `TYPE-6`) | A cast whose operand is itself a cast to `unknown` — the `x as unknown as T` spelling exactly — in any file that is not in the spec family or the test tree |
| `no-inline-param-type` | `TYPE-3` | A **destructured** parameter whose type annotation is a bare object type literal, on a function declaration, a function expression or an arrow |
| `no-const-enum` | `TYPE-4` | An enum declaration carrying the `const` modifier, anywhere, with the enum's name interpolated into the message |

All three map to a code the law actually carries. The findings are the codes around them.

`TYPE-1` — no `any` — has **no rule published here**. It is held by
`@typescript-eslint/no-explicit-any`, named in the recommended block. Reimplementing a rule everybody
already has would be a maintenance cost with no gain, so the decision is sound; the consequence is
that the loudest code in the law is held by a rule this module cannot describe, cannot version and
cannot guarantee is registered. If the TypeScript plugin is absent from the consuming configuration,
that entry does not silently do nothing — the configuration fails to resolve it.

`TYPE-5` — a discriminated union beats a bag of booleans — has **no rule at all**, by an argued
decision recorded in the rule module's header: whether a set of booleans describes one situation or
several genuinely independent ones needs to know what the code means, and a rule that guessed would
fire on every record with two flags in it. It is unenforced, not covered, and a green run says
nothing about it.

`TYPE-6` is held only in half. Its test exit is implemented inside `no-double-cast`; nothing else of
it has a rule.

There is also enforcement running with no code at all: the recommended block switches on
`@typescript-eslint/array-type` with `default: "generic"` and `readonly: "generic"`, mandating one
spelling of the array type over the other. The law text carries no code for that decision. A build
will therefore report a violation of a rule whose reasoning exists only in the rule module's
comments. Recorded rather than repaired, because inventing the mapping would be inventing the law.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means no visitor was installed and the rule did not exist for that file.
2. **Check the exemption, and only for the rule that has one.** `no-double-cast` is the only rule
   with a file gate. `no-inline-param-type` and `no-const-enum` have no gate at all: their scope is
   whatever the consuming configuration points the linter at, and nothing narrower.
3. **Read the nodes, not the meaning.** Every decision is made from the shape of the syntax tree.
   Nothing resolves a module, consults a type, reads `tsconfig.json` or runs code.
4. **Emit one block per finding**, naming the node that carries the defect: the outer cast, the
   annotation, the declaration.
5. **Write the `hatch` line** whenever an open hatch would have hidden the same failure.
6. **Do not report what no rule watches.** `TYPE-1` is somebody else's rule, `TYPE-5` has none, and a
   verdict that claims either was judged is wrong about the module.

## `no-double-cast` — TYPE-2

**What it reports.** `doubleCast` on the **outer** cast — one report per matching chain. Exactly one
spelling: `x as unknown as T`. This is the compiler saying the two types do not overlap, and then
being overruled twice. It is worse than `any` in exactly one way — the result *claims* to be the
target type, so everything downstream trusts it absolutely, and the break surfaces far from the line
that caused it.

**How it detects.** Visits `TSAsExpression`. Reports when `node.expression.type === "TSAsExpression"`
**and** that inner cast's `typeAnnotation.type === "TSUnknownKeyword"`. The file gate is evaluated
once in `create` and returns an **empty visitor object** for the whole file: `context.filename`
(falling back to `context.getFilename()`), back-slashes replaced by forward slashes, matching
`/\.(?:spec|test|e2e-spec|int-spec|harness-spec)\.ts$/` or containing the literal segment
`/src/tests/`.

**What it cannot see.** Two statements instead of one: `const loose: unknown = row` then
`return loose as Enrollment` launders exactly as much, through one cast whose operand is an
identifier — and that is what somebody does when the line got too long, not sabotage. Another bridge
type: only `TSUnknownKeyword` is tested, so `x as any as T`, `x as never as T`, `x as {} as T` and
`x as object as T` all pass; `as never as` deserves its own line, because `never` is assignable to
everything, launders with the same force, and unlike the `any` form has no second rule waiting behind
it. The angle-bracket assertion `<T><unknown>value` is a `TSTypeAssertion` node, not a
`TSAsExpression`. A generic coercion helper —
`const coerce = <T,>(value: unknown): T => value as T` — contains one cast, from `unknown`, legal
everywhere, and every call site then launders with no cast at all. A guard that checks nothing —
`const isEnrollment = (row: unknown): row is Enrollment => true` — produces the same trust downstream
with no cast in the file, and the law's own remedy is the part a syntactic rule cannot verify. A
single cast off an `any`-returning call, `JSON.parse(raw) as Payload`, has the bridge without
spelling it. And the filename: renaming a production module to end `.spec.ts` switches the rule off
for everything in it.

**Boundary.** This rule judges casts only. An inline shape in the signature it launders into is
`no-inline-param-type`; the enum spelling is `no-const-enum`.

## `no-inline-param-type` — TYPE-3

**What it reports.** `inline` on the **type annotation**, not the pattern — a destructured parameter
carrying a type written where it is used:
`({ userId, courseId }: { userId: string; courseId: string })`. That type cannot be referenced,
cannot be imported and cannot be extended, so the second caller retypes it, and when a third field
arrives only one of the two copies gets it.

**How it detects.** Visits `FunctionDeclaration`, `FunctionExpression` and `ArrowFunctionExpression`,
and walks `node.params`. Each parameter is unwrapped **once**: if its type is `TSParameterProperty`,
`.parameter` is read instead. Reports when the resulting node's type is exactly `ObjectPattern`, it
carries a `typeAnnotation`, and that annotation's inner `typeAnnotation.type` is exactly
`TSTypeLiteral`. No file gate — every file the configuration points at is scanned.

**What it cannot see.** Not destructuring it: `(params: { userId: string; courseId: string })` is an
`Identifier` parameter, so the rule never looks at its annotation — the shape is exactly as
unreferenceable, exactly as un-importable and exactly as likely to be retyped by the second caller,
and it is the more common way to write it. A default value:
`({ userId }: { userId: string } = { userId: "" })` makes the parameter an `AssignmentPattern` whose
`left` holds the pattern and the annotation, and the unwrap handles the parameter-property wrapper
and nothing else, so making the argument optional deletes the rule. Wrapping the literal: the
annotation must be *exactly* a `TSTypeLiteral`, so `{ a: string } & Base` is an intersection,
`{ a: string } | undefined` is a union, and `Readonly<{ a: string }>` or `Partial<{ a: string }>` is
a type reference — all three still bury an unreferenceable shape in the signature. A function node
that is not one of the three: `TSFunctionType` inside `type Handler = ({ id }: { id: string }) =>
void`, `TSMethodSignature` for an interface member, `TSDeclareFunction` for an overload signature,
`TSEmptyBodyFunctionExpression` for an abstract method — none is visited, so the shape can be fixed
in a contract and merely obeyed in the implementation. A local alias:
`type Params = { userId: string }` declared in the same file and not exported satisfies the rule
completely while remaining exactly as un-importable as the literal it replaced — the rule enforces
"named", the law asks for a named type in the module's types folder, and the difference is invisible
to a syntax tree. An array pattern: `([id, count]: [string, number])` buries an inline tuple, and the
shape test admits only `ObjectPattern`.

**Boundary.** This rule reads a parameter's annotation. It has no test lane and no exemption of any
kind — an inline destructured type in a test reports.

## `no-const-enum` — TYPE-4

**What it reports.** `constEnum` on the declaration, with `node.id.name` interpolated into the
message. A `const enum` is inlined at compile time and has **no runtime object**: it cannot be
iterated, cannot be reverse-mapped, and does not cross the isolated-modules boundary. It saves a few
bytes and breaks a whole family of ordinary things.

**How it detects.** Visits `TSEnumDeclaration`; returns unless the boolean `node.const` is set;
otherwise reports the declaration. No file gate, no exemption, no test lane.

**What it cannot see.** `declare enum` — an ambient enum without the `const` modifier emits no
runtime object either: it cannot be iterated, cannot be reverse-mapped, and fails at run time in
every way the message describes. `node.const` is false, so nothing reports. This is the failure the
law names, reached by a keyword the rule does not read. A declaration file: ambient const enums live
in `.d.ts`, and a typical configuration does not point the linter at them. Somebody else's const
enum: the rule watches declarations, not uses, so a const enum imported from a dependency carries
every failure the message lists, at every use site, and is declared in no file this module ever sees
— closing that needs module resolution and type information, which this module does not use. And
anything outside the configured globs: with no file gate at all, the rule's reach is exactly what the
consuming configuration hands it, and generated code, tooling folders and scripts directories are
commonly outside — a code generator emitting a const enum is exactly the case nobody reviews.

**Boundary.** This rule watches the `const` keyword on an enum declaration and nothing else. The
`declare` keyword is a different keyword and is unjudged.

## Detection

| Part | Mechanism |
|---|---|
| file gate — `no-double-cast` only | Evaluated once in `create`, which returns an **empty visitor object** for the whole file: `context.filename` (falling back to `context.getFilename()`), back-slashes replaced by forward slashes, matched against `/\.(?:spec|test|e2e-spec|int-spec|harness-spec)\.ts$/` or containing the literal segment `/src/tests/` |
| cast walker | `TSAsExpression`, reporting when `node.expression.type === "TSAsExpression"` and the inner cast's `typeAnnotation.type === "TSUnknownKeyword"`; the report node is the outer cast |
| parameter walker | `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`, over `node.params`, one unwrap of `TSParameterProperty` to `.parameter`, then exactly `ObjectPattern` + `typeAnnotation` whose inner `typeAnnotation.type` is exactly `TSTypeLiteral`; the report node is the annotation |
| enum walker | `TSEnumDeclaration`, gated on the boolean `node.const`, with `node.id.name` interpolated into the message |
| reach outside the file | None. Nothing resolves a module, consults a type, reads `tsconfig.json` or runs code |

Every decision is made from the shape of the syntax tree, which is why the rules are fast and why
every open hatch below is a different way of writing the same meaning.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `(x as unknown) as T` | Parentheses are not nodes in this tree. The parenthesised form and the bare form are the same shape, and both report |
| `x as unknown as A as B` | The outer cast does not match — its operand's annotation is `A`, not `unknown` — but the middle node is itself a `TSAsExpression` over a cast to `unknown`, so the chain reports exactly once rather than escaping |
| A double cast buried in a call argument, a return expression, a default value or an object property | There is no positional gate. The visitor fires on the node wherever it appears |
| A file named `spec-helpers.ts` or `test-data.ts` | The exemption pattern is anchored: `\.spec\.ts$`, `\.test\.ts$` and the three suffixed forms. A filename that merely contains the word is still linted |
| A Windows-shaped path reaching the test gate | The filename is normalised to forward slashes before either test, so the gate behaves the same on both platforms |
| An inline destructured type on a class method, a constructor, or an object-literal method | A method's body is a `FunctionExpression`, one of the three visited nodes. Only the declaration form differs; the rule does not care |
| `constructor(private readonly deps: Deps)` | The parameter property wrapper is unwrapped before the shape test, so the wrapper cannot hide a pattern from the rule |
| A nested destructure — `({ user: { id } }: { user: { id: string } })` | The outer parameter is still an `ObjectPattern` carrying a bare `TSTypeLiteral`, so the extra depth changes nothing |
| `export const enum X` and a `const enum` inside a `declare module` block | Both are still `TSEnumDeclaration` nodes with the `const` flag set. The modifiers around it are not read |
| A `const enum` written in a spec file | This rule has no test lane. The exemption belongs to one rule, not to the module |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Rule | What passes |
|---|---|
| `no-double-cast` | **Two statements instead of one.** `const loose: unknown = row` then `return loose as Enrollment` launders exactly as much, through one cast whose operand is an identifier |
| `no-double-cast` | **Another bridge type.** Only `TSUnknownKeyword` is tested, so `x as any as T`, `x as never as T`, `x as {} as T` and `x as object as T` all pass — and `as never as` launders with the same force with no second rule waiting behind it |
| `no-double-cast` | **The angle-bracket assertion.** `<T><unknown>value` is a `TSTypeAssertion`, not a `TSAsExpression` |
| `no-double-cast` | **A generic coercion helper.** `const coerce = <T,>(value: unknown): T => value as T` contains one legal cast, and every call site then launders with no cast at all |
| `no-double-cast` | **A guard that checks nothing.** `const isEnrollment = (row: unknown): row is Enrollment => true` produces the same trust downstream with no cast in the file |
| `no-double-cast` | **A single cast off an `any`-returning call.** `JSON.parse(raw) as Payload` — the bridge exists, it is just not spelled |
| `no-double-cast` | **The filename**, a whole-file exit keyed on a suffix, and **the folder**, `/src/tests/` exempt wholesale and forever, including a fixture module production code imports |
| `no-inline-param-type` | **Not destructuring it.** `(params: { userId: string; courseId: string })` is an `Identifier` parameter, and it is the more common way to write it |
| `no-inline-param-type` | **A default value.** `= { userId: "" }` makes the parameter an `AssignmentPattern`, which the single unwrap does not handle |
| `no-inline-param-type` | **Wrapping the literal.** An intersection, a union or `Readonly<…>` / `Partial<…>` is not exactly a `TSTypeLiteral` |
| `no-inline-param-type` | **A function node that is not one of the three.** `TSFunctionType`, `TSMethodSignature`, `TSDeclareFunction`, `TSEmptyBodyFunctionExpression` |
| `no-inline-param-type` | **A local alias.** Declared in the same file and not exported, it satisfies the rule while remaining as un-importable as the literal |
| `no-inline-param-type` | **An array pattern.** `([id, count]: [string, number])` buries an inline tuple |
| `no-const-enum` | **`declare enum`**, **a `.d.ts` declaration file**, **somebody else's const enum imported from a dependency**, and **anything outside the configured globs** |
| none | **Everything `TYPE-5` forbids** — a bag of booleans where a discriminated union belongs. And **`TYPE-1`** is held by `@typescript-eslint/no-explicit-any`, a rule this module cannot describe, version or guarantee is registered |

That last row is the honest summary: of six codes, three are held by rules described here, one is
borrowed, one is unenforced by decision, and one is held only in its test half.

## Rules

1. A rule's identity is its published name; nothing here assigns it a number.
2. Detection is purely syntactic. No module is resolved, no type is consulted, no compiler option is
   read, no code runs.
3. Two of the three rules have **no file gate at all**. Their scope is whatever the consuming
   configuration points the linter at, and nothing narrower.
4. The module publishes three rules. Its recommended block names five entries, two of which belong to
   another plugin and are a hard dependency on that plugin being registered.
5. The one exemption on the shelf is a **whole-file** exit, not a file-plus-value pair.
6. Every rule reports the node that carries the defect: the outer cast, the annotation, the
   declaration. Only the enum rule carries data in its message.
7. The module's own severity opinion is `error` for all five entries; the consuming configuration
   remains the authority on what is actually switched on.

## Exceptions

- **The spec family and the test tree** are exempt from `no-double-cast`, and from nothing else.
  Building a deliberately wrong value is how a spec proves a closed API refuses it. The exit is
  whole-file: inside an exempt file the rule does not exist, rather than permitting one construct. It
  releases `TYPE-2` for that file entirely.
- **`.spec.ts`, `.test.ts`, `.e2e-spec.ts`, `.int-spec.ts`, `.harness-spec.ts`** are the five
  recognised suffixes, plus any path under a `/src/tests/` segment. The suffix list is closed and
  anchored; the folder segment is not.
- **The other two rules have no exemptions.** A `const enum` in a spec reports; an inline destructured
  type in a test reports.
- `TYPE-6` says the sanctioned test exit is "written into the config rather than sprinkled as per-line
  suppressions". `no-double-cast` puts it inside the rule instead, and argues the case: building a
  deliberately wrong value is a property of the lane rather than of any repository's file layout. The
  argument is good and the placement contradicts the sentence that authorises it. One of the two
  should move.
- **`TYPE-5` has no rule**, by an argued decision recorded in the rule module's header.
- **`TYPE-1` is held by `@typescript-eslint/no-explicit-any`** and the array spelling by
  `@typescript-eslint/array-type`. Both are named in the recommended block, neither is published here,
  and this module documents neither's internals.

## Output

One block per finding:

```text
rule:    <no-double-cast | no-inline-param-type | no-const-enum>
file:    <path as the gate saw it, forward slashes>
scope:   <in | out — the gate that decided it, or "no gate">
node:    <TSAsExpression | TSTypeAnnotation on an ObjectPattern | TSEnumDeclaration>
message: <doubleCast | inline | constEnum>
data:    <enum name — constEnum only>
hatch:   <the open hatch that would have hidden this, or none>
```

A clean file emits one block per rule with `message: none` and `node: none`. An out-of-scope file
emits `scope: out`, `message: none` and `node: none` — no visitor was installed, so the rule did not
exist for that file, and the block records that rather than a pass.
