# Type-safety

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses nothing. It refuses, and it must be able to point at the character it refuses on.

## Law

The type system is the half of this canon a machine holds without being asked. Most of the other laws
are enforced by a closed union or a type alias rather than by a lint rule, which means the value of
the types here is not "fewer bugs" in the abstract — it is that most of canon stops being optional.
That gives a rule on this shelf one job: guard the places where somebody turns the type system OFF.

This module does not restate that law. It records **enforcement**: the exact syntax the rule watches,
and — the part nobody writes down — the ways of writing the same erasure that it does not watch at
all.

The law states five codes. **One of them has a rule**, and a second is held as the absence of that
rule over a set of filenames. The rule module states plainly why it is alone: the shorthand erasure
and the array spelling are already refused by the TypeScript plugin's own rules, and a second copy of
somebody else's rule is a second thing to keep in step — the copy nobody edits is the copy that stops
matching. What is left is the double cast, which no off-the-shelf rule refuses because most codebases
treat it as a legitimate escape.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-double-cast` | `TYPE-SAFETY-1` | `double` — a `TSAsExpression` whose operand is itself a `TSAsExpression` written to the `unknown` keyword, the outer half of the `value as unknown as Target` pair, in a file whose path contains `/src/` and does not end `.test.ts`, `.test.tsx`, `.spec.ts` or `.spec.tsx` |

`TYPE-SAFETY-4` (a test may build a wrong value on purpose) has no rule of its own: it is enforced as
the ABSENCE of enforcement over four filename suffixes, which is why it is not in the table.

`TYPE-SAFETY-2` (the shorthand erasure) and `TYPE-SAFETY-3` (one spelling for an array) publish **no
rule here**. They are delegated to a package this module does not ship — the TypeScript plugin's own
no-explicit-any rule and its array-type rule with the generic default. A repository that adopts this
package and configures the TypeScript plugin loosely satisfies its lint gate while breaking two
published codes, and nothing in either package notices. Delegated is not covered.

`TYPE-SAFETY-5` (a cast that survives review carries its reason on the line) has **no rule anywhere**
— not here, and not in the delegated package. Nothing reads comments beside a cast. The code is real
law and it is entirely unenforced.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means the file gate failed, `create` returned an empty visitor object, and the rule did
   not exist for that file.
2. **The gate is two tests on one string.** The path, forward-slashed, must contain `/src/` and must
   NOT end `.test.ts`, `.test.tsx`, `.spec.ts` or `.spec.tsx`. Only those four suffixes are exempt;
   nothing else grants the exemption.
3. **Read the nodes, not the statement.** Visit each `TSAsExpression`, read `node.expression`, require
   it to be a `TSAsExpression`, and require that inner cast's `typeAnnotation` to be exactly
   `TSUnknownKeyword`.
4. **Emit one block per finding**, anchored on the OUTER cast, one report per offending node.
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure** — in
   particular when the silence comes from a middle keyword that is not `unknown`, a node inserted
   between the two casts, an erasure split across two statements, or a path outside `/src/`.
6. **Do not report what no rule watches.** Two of the five codes live in another package and one has
   no machine at all; a verdict that claims otherwise is wrong about the module.

## `no-double-cast` — TYPE-SAFETY-1

**What it reports.** `double` — one report per offending outer node, anchored on the outer cast, so a
disable comment on the statement covers exactly one erasure. There is no automatic fix, because every
real repair gives the value a shape it did not have and no machine can choose that shape.

**How it detects.** File gate, evaluated once in `create` before any visitor is installed:
`context.filename` (falling back to `context.getFilename()`) is coerced with `String(… || "")`,
back-slashes are replaced with forward slashes, and the result must contain the substring `/src/` and
must NOT match `/\.(?:test|spec)\.(?:ts|tsx)$/`. When the gate fails, `create` returns an empty
visitor object. Node test: visits `TSAsExpression`, reads `node.expression`, requires
`node.expression.type === "TSAsExpression"`, then requires that inner cast's `typeAnnotation.type` to
be exactly `TSUnknownKeyword`. On a match it reports the OUTER node under `messageId: "double"`.

**What it cannot see.** Three properties of that mechanism decide everything. It is purely syntactic —
no module is resolved, no type is consulted, no code runs. It matches ONE keyword node, not a meaning:
`payload as any as Target`, `payload as never as Target`, `payload as {} as Target` and
`payload as Loose as Target` where `type Loose = unknown` all erase the same amount and are all
invisible here. And it matches an adjacency: `(payload as unknown)! as Target` inserts one node
between parent and child and the pair stops existing, at a cost of one character. The angle-bracket
assertion `<Target><unknown>payload` parses as `TSTypeAssertion`, a node type this rule never visits.
`payload as Array<unknown> as Array<Target>` puts the keyword one level down in the annotation and the
rule reads only the top node. And a value that arrives typed as the shorthand can be assigned straight
into a declared shape with no cast node at all — there is nothing syntactic to report.

**Boundary.** The inner annotation being the `unknown` keyword is what makes an erasure this rule's
business; the shorthand spelling belongs to the delegated TypeScript plugin rule, with its own
severity, its own configuration and its own disable comment. A single cast, and a widening cast to the
keyword alone, are deliberately legal and are not this rule's business either.

## Detection

| Part | Mechanism |
|---|---|
| file gate | Evaluated once in `create` before any visitor is installed. `context.filename`, falling back to `context.getFilename()`, coerced with `String(… \|\| "")` |
| separator normalisation | Back-slashes are replaced with forward slashes before the substring and suffix tests, so the gate behaves identically on either kind of path separator |
| scope test | The path must contain the substring `/src/` |
| exemption test | The path must NOT match `/\.(?:test\|spec)\.(?:ts\|tsx)$/` |
| out of scope | `create` returns an empty visitor object. The rule does not merely stay quiet — it does not exist for that file |
| node walker | Visits `TSAsExpression`; reads `node.expression`; requires `node.expression.type === "TSAsExpression"`; requires that inner cast's `typeAnnotation.type` to be exactly `TSUnknownKeyword`; reports the OUTER node under `messageId: "double"` |

Nothing here reaches outside the linted file. No module is resolved, no type is consulted, no code
runs.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `(value as unknown) as Target` | Parentheses produce no node in this abstract syntax tree, so the inner cast is still the outer cast's direct operand. Grouping is not laundering |
| A back-slash path in the gate | The filename is normalised to forward slashes before the substring and suffix tests |
| An undefined filename | The gate coerces with `String(value \|\| "")` rather than reading a property off it, so a run with no filename yields an empty string that fails the `/src/` test — the rule stays silent instead of throwing |
| `const ROW = payload as unknown as Target`, used far away | Constants do not launder this rule. It watches a syntax node, not an attribute position, so gathering the value into a constant carries the offending node into the constant's initialiser |
| `[payload as unknown as Target]` or `{ row: payload as unknown as Target }` | An array element and an object property are ordinary expression positions, and the visitor fires on the node wherever it sits |
| A cast inside a call argument, a JSX attribute, a return, a default value or a template hole | There is no position in an expression that hides this node from a node visitor |
| `value as unknown as A as B` | The outer cast passes — its operand's annotation is `A`, not `unknown` — but the MIDDLE cast is itself a `TSAsExpression` whose operand casts to `unknown`, and that node reports |
| A double cast inside a test HELPER that is not named as a test | Listed here only to be denied: the exemption is the filename suffix and nothing else, so a helper file is governed like production. It is an over-report, and it is in the Open table for that reason |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `no-double-cast` | **The angle-bracket assertion.** `<Target><unknown>payload` is the same erasure, parsed as `TSTypeAssertion` — a node type this rule never visits. It is the older spelling, so it arrives with anybody porting code rather than with anybody evading a rule |
| `no-double-cast` | **A different erasure keyword in the middle.** `payload as any as Target`, `payload as never as Target` and `payload as {} as Target`. The first is meant to be caught by the delegated shorthand rule — a rule with its own severity, its own configuration and its own disable comment, so silencing it silences this seam too |
| `no-double-cast` | **An alias for the keyword.** `type Loose = unknown` turns the inner annotation into a type reference, and a type reference is not the keyword node. `payload as Loose as Target` reads tidier than the thing it replaces |
| `no-double-cast` | **Anything between the two casts.** `(payload as unknown)! as Target` breaks the adjacency at a cost of one character |
| `no-double-cast` | **The erasure split across two statements.** `const loose: unknown = payload` then `const row = loose as Target`. The sharpest hatch on the shelf: the rule's own suggested repair — narrow from `unknown` — is syntactically indistinguishable from the evasion. What separates them is the CHECK between the two lines, and nothing requires a check |
| `no-double-cast` | **A generic helper.** `const coerce = <T,>(value: unknown): T => value as T` contains a single legal cast; every call site then reads `coerce<Target>(payload)` with no cast at all. One helper launders every erasure in the tree, permanently, and it looks like a utility |
| `no-double-cast` | **The keyword one level down in the type.** `payload as Array<unknown> as Array<Target>` and `payload as Record<string, unknown> as Config` annotate a type reference whose ARGUMENT is the keyword |
| `no-double-cast` | **Erasure with no cast to see.** A value that arrives typed as the shorthand — the return of a parse call, an untyped module, a wrong vendor declaration — is assigned straight into a declared shape. The seam is crossed silently |
| `no-double-cast` | **Everything outside a `/src/` path segment.** A package folder, a root-level route folder, a build script, a configuration file or a sibling workspace is not examined. The widest hatch: a file there may cast freely and re-export the result under an honest-looking type |
| `no-double-cast` | **The same substring, in an ancestor directory.** The gate is `includes("/src/")`, not a test of the path relative to the repository. A checkout under a folder named `src` puts every file in scope — the mirror-image defect, a report where there is no offence |
| `no-double-cast` | **The filename, as an opt-out.** Renaming a governed file to end `.spec.ts` deletes the rule for it, with no diff to the rule and nothing to review |
| `no-double-cast` | **The filename, as an over-report.** A test helper, a fixture module, a factory of deliberately-wrong values, a folder-based test layout, or a test written with a different module extension is governed like production. Under-reach and over-reach are the same line of code |
| delegated | **`TYPE-SAFETY-2` and `TYPE-SAFETY-3`** — held by a package this module does not ship, so a loose configuration there breaks two published codes with a green gate here |
| nobody | **`TYPE-SAFETY-5`.** The rule reports the shape and never reads what is written beside it, so a cast with a careful explanation and a cast with none are treated identically. Nothing anywhere checks that a surviving cast carries its reason |

## Rules

1. The rule's identity is its published name — the string that appears in a build log and in a disable
   comment. Nothing here assigns it a number.
2. Detection is purely syntactic. No module is resolved, no type is consulted, no code runs.
3. The file gate is evaluated once per file, before any visitor is installed. Outside its scope the
   rule does not exist rather than staying quiet, which is why no report can be recovered by moving a
   file back later without re-running the lint.
4. The exemption is a path and only a path. No judgement, no comment and no configuration option can
   grant it, and it cannot be granted per call site.
5. One report per offending outer node; the report anchors on the outer cast, so a disable comment on
   the statement covers exactly one erasure.
6. The report is the whole remedy. The rule publishes no automatic fix, because every real repair
   gives the value a shape it did not have and no machine can choose that shape.
7. The module's own severity opinion is `error`; the consuming configuration remains the authority on
   what is actually switched on.

## Exceptions

- **Test files.** Four filename suffixes — `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` — exempt
  wholesale. This is `TYPE-SAFETY-4` expressed as a path, and the rule module argues why it must be a
  path rather than a judgement: proving a closed API refuses bad input means constructing bad input,
  and there is no way to build a value the types forbid without telling the compiler to forget them. A
  judgement-based exemption would be re-argued at every call site; a path is argued once. It releases
  `TYPE-SAFETY-1` over those files entirely.
- **Everything outside `/src/`.** Not an exemption granted to anybody — a scope decision about what
  counts as product source. It releases `TYPE-SAFETY-1` over every other folder, and it is where the
  largest volume of unexamined code lives.
- **The single cast.** Not an oversight and not a grant: a narrowing the compiler can still partly
  check is a different act from an erasure, and the twin tests pin that difference down explicitly. It
  releases nothing, because `TYPE-SAFETY-1` never claimed it.
- **The widening cast to the keyword alone.** Legal by design; it is the shape the law asks for when
  the shape is genuinely not known yet.

## Output

One block per finding:

```text
rule:    no-double-cast
file:    <path as the gate saw it, forward-slashed>
scope:   <in | out — which half of the file gate decided it>
node:    TSAsExpression (outer)
inner:   TSAsExpression -> TSUnknownKeyword
message: double
report:  <double | none>
hatch:   <the open hatch that would have hidden this, or none>
```

A clean in-scope file emits one block with `scope: in`, `report: none`, `node:` and `inner:` and
`message:` written as `—`, and a `hatch` line whenever an open hatch could have produced that silence.

An out-of-scope file emits one block with `scope: out`, `report: none`, and a `hatch` line naming the
gate half that excluded it. It did not pass; no visitor was installed.
