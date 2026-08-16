---
id: fe-lints-type-safety-index
title: INDEX.md
slug: /gates/lints/type-safety
sidebar_label: type-safety
sidebar_position: 0
description: What the type-safety lint rule can actually see, what it cannot, and which law code it holds.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `type-safety`

## Law

The type system is the half of this canon a machine holds without being asked. Most of the other
laws are enforced by a closed union or a type alias rather than by a lint rule, which means the
value of the types here is not "fewer bugs" in the abstract — it is that most of canon stops being
optional. That gives a rule on this shelf one job: guard the places where somebody turns the type
system OFF.

This shelf does not restate that law. It records **enforcement**: the exact syntax the rule watches,
and — the part nobody writes down — the ways of writing the same erasure that it does not watch at
all.

**One rule exists in the rule module, and this file documents one.** That is what the source
publishes; the brief expected about one, and the count agrees. Its identity is the published name,
which is the string that appears in a build log and in a disable comment; no numeric code is
invented for it here.

The rule module states plainly why it is alone: the shorthand erasure and the array spelling are
already refused by the TypeScript plugin's own rules, and a second copy of somebody else's rule is a
second thing to keep in step — the copy nobody edits is the copy that stops matching. What is left
is the double cast, which no off-the-shelf rule refuses because most codebases treat it as a
legitimate escape.

## Rules

| Rule | Law code | What it reports |
|---|---|---|
| `no-double-cast` | `TYPE-SAFETY-1` | A `TSAsExpression` whose operand is itself a `TSAsExpression` written to the `unknown` keyword — the outer half of the `value as unknown as Target` pair — in a file whose path contains `/src/` and does not end `.test.ts`, `.test.tsx`, `.spec.ts` or `.spec.tsx`. |

**The file gate is the law's fourth code, spelled as a path.** `TYPE-SAFETY-4` says a test may build
a wrong value on purpose, and the rule realises that exemption as a filename suffix rather than a
judgement. The rule module argues the choice rather than assuming it: proving a closed API refuses
bad input means constructing bad input, and there is no way to build a value the types forbid
without telling the compiler to forget them. A judgement-based exemption would be re-argued at every
call site; a path is argued once. So `TYPE-SAFETY-4` is enforced, but as the ABSENCE of enforcement
over a set of filenames, which is why it appears here rather than in the table.

**Finding — two law codes are enforced by a package this module does not ship.** `TYPE-SAFETY-2`
(the shorthand erasure) and `TYPE-SAFETY-3` (one spelling for an array) publish no rule here. The
rule module names their owners: the TypeScript plugin's own no-explicit-any rule and its array-type
rule with the generic default. That is a sound delegation and it is written down — but it moves two
of the law's five codes outside this package's guarantee. A repository that adopts this package and
configures the TypeScript plugin loosely satisfies its lint gate while breaking two published codes,
and nothing in either package notices. Recorded, not repaired: reimplementing them here would create
the second copy the rule module refused.

**Finding — one law code has no rule anywhere.** `TYPE-SAFETY-5` says a cast that survives review
carries its reason on the line. No rule in this module, and none in the delegated package, reads
comments beside a cast. The code is real law and it is entirely unenforced; what a machine could
plausibly do about it is argued in `audit.md` rather than asserted here.

## Detection

| Rule | Mechanism |
|---|---|
| `no-double-cast` | File gate, evaluated once in `create` before any visitor is installed: `context.filename` (falling back to `context.getFilename()`) is coerced with `String(… \|\| "")`, back-slashes are replaced with forward slashes, and the result must contain the substring `/src/` and must NOT match `/\.(?:test\|spec)\.(?:ts\|tsx)$/`. When the gate fails, `create` returns an empty visitor object, so the rule does not merely stay quiet — it does not exist for that file. Node test: visits `TSAsExpression`, reads `node.expression`, requires `node.expression.type === "TSAsExpression"`, then requires that inner cast's `typeAnnotation.type` to be exactly `TSUnknownKeyword`. On a match it reports the OUTER node under `messageId: "double"`. |

Three properties of that mechanism decide everything in the next section. It is purely syntactic —
no module is resolved, no type is consulted, no code runs. It matches ONE keyword node, not a
meaning: any other way of spelling "the compiler now knows nothing" is a different node. And it
matches an adjacency — the two casts must be immediate parent and child, with nothing in between.

## Escape Hatches

### Closed

| Way of writing it | Why it does not slip past |
|---|---|
| `(value as unknown) as Target` | Parentheses produce no node in this abstract syntax tree, so the inner cast is still the outer cast's direct operand. Grouping is not laundering. |
| A back-slash path in the gate | The filename is normalised to forward slashes before the substring and suffix tests, so the gate behaves identically on either kind of path separator. |
| An undefined filename | The gate coerces with `String(value \|\| "")` rather than reading a property off it, so a run with no filename yields an empty string that fails the `/src/` test — the rule stays silent instead of throwing. |
| `const ROW = payload as unknown as Target`, used far away | **Constants do not launder this rule.** It watches a syntax node, not an attribute position, so gathering the value into a constant carries the offending node into the constant's initialiser, where it is visited exactly as before. |
| `[payload as unknown as Target]` or `{ row: payload as unknown as Target }` | Same reason. An array element and an object property are ordinary expression positions, and the visitor fires on the node wherever it sits. |
| A cast inside a call argument, a JSX attribute, a return, a default value or a template hole | Same reason again. There is no position in an expression that hides this node from a node visitor. |
| `value as unknown as A as B` | The outer cast passes — its operand's annotation is `A`, not `unknown` — but the MIDDLE cast is itself a `TSAsExpression` whose operand casts to `unknown`, and that node reports. A longer chain does not buy silence. |
| `value as unknown` on its own | Deliberately legal, and it is the shape the rule is asking for: a value whose type has been widened in the open, where narrowing it again is somebody's visible obligation. |
| `value as Target` on its own | Deliberately legal. A single cast is a claim the compiler can still partly check; forbidding it would turn the rule into an argument rather than a boundary. |
| A double cast inside a test HELPER that is not named as a test | Not closed by intent — see the Open table. Listed here only to be denied: the exemption is the filename suffix and nothing else, so a helper file is governed like production. |

### Open

| Rule | Way of writing it that is NOT caught |
|---|---|
| `no-double-cast` | **The angle-bracket assertion.** `<Target><unknown>payload` is the same erasure, parsed as `TSTypeAssertion` — a node type this rule never visits. Unavailable in files with markup, freely available in every other source file, and it is the older spelling, so it arrives with anybody porting code rather than with anybody evading a rule. |
| `no-double-cast` | **A different erasure keyword in the middle.** The inner annotation must be the `unknown` keyword exactly. `payload as any as Target`, `payload as never as Target` and `payload as {} as Target` all erase the same amount and are all invisible here. The first is meant to be caught by the delegated shorthand rule — a rule with its own severity, its own configuration and its own disable comment, so silencing it silences this seam too. |
| `no-double-cast` | **An alias for the keyword.** `type Loose = unknown` turns the inner annotation into a type reference, and a type reference is not the keyword node. `payload as Loose as Target` reads tidier than the thing it replaces, which is precisely why somebody would write it. |
| `no-double-cast` | **Anything between the two casts.** The rule matches an adjacency. A non-null assertion — `(payload as unknown)! as Target` — inserts one node between parent and child and the pair stops existing, at a cost of one character. |
| `no-double-cast` | **The erasure split across two statements.** `const loose: unknown = payload` followed by `const row = loose as Target` performs exactly the same erasure with no double cast anywhere. This is the sharpest hatch on the shelf, because the rule's own suggested repair — narrow from `unknown` — is syntactically indistinguishable from the evasion. What separates them is the CHECK between the two lines, and nothing requires a check. |
| `no-double-cast` | **A generic helper.** `const coerce = <T,>(value: unknown): T => value as T` contains a single legal cast; every call site then reads `coerce<Target>(payload)` with no cast at all. One helper launders every erasure in the tree, permanently, and it looks like the opposite of a hack — it looks like a utility. |
| `no-double-cast` | **The keyword one level down in the type.** `payload as Array<unknown> as Array<Target>` and `payload as Record<string, unknown> as Config` annotate a type reference whose ARGUMENT is the keyword. The rule reads only the top node of the annotation, so a collection or a map may be erased in full. |
| `no-double-cast` | **Erasure with no cast to see.** A value that arrives typed as the shorthand — the return of a parse call, an untyped module, a wrong vendor declaration — can be assigned straight into a declared shape with no cast node at all. There is nothing syntactic to report; the seam is crossed silently. |
| `no-double-cast` | **Everything outside a `/src/` path segment.** A package folder, a root-level route folder, a build script, a configuration file or a sibling workspace is not examined. This is a deliberate scope decision and it is also the widest hatch: a file there may cast freely and re-export the result under an honest-looking type. |
| `no-double-cast` | **The same substring, in an ancestor directory.** The gate is `includes("/src/")`, not a test of the path relative to the repository. A checkout that happens to live under a folder named `src` puts every file in scope, including the tooling the gate meant to exclude — the mirror-image defect, a report where there is no offence. |
| `no-double-cast` | **The filename, as an opt-out.** The exemption is a suffix. Renaming a governed file to end `.spec.ts` deletes the rule for it, with no diff to the rule and nothing to review. Filename is the cheapest thing in a repository to change. |
| `no-double-cast` | **The filename, as an over-report.** The exemption recognises exactly four endings. A test helper, a fixture module, a factory of deliberately-wrong values, a folder-based test layout, or a test written with a different module extension is governed like production even though building wrong values is the whole job of the file. Under-reach and over-reach are the same line of code. |
| `no-double-cast` | **The reason clause.** The rule reports the shape and never reads what is written beside it, so a cast with a careful explanation and a cast with none are treated identically. That is the correct behaviour for THIS rule and the reason `TYPE-SAFETY-5` is unenforced: nothing anywhere checks that a surviving cast carries its reason. |

## Inputs

| Input | Evidence required |
|---|---|
| file path | `context.filename`, falling back to `context.getFilename()`, normalised to forward slashes |
| scope test | the substring `/src/` present in that path |
| exemption test | the path NOT ending `.test.ts`, `.test.tsx`, `.spec.ts` or `.spec.tsx` |
| outer node | a `TSAsExpression` |
| inner node | that node's `expression`, required to be a `TSAsExpression` |
| inner annotation | that inner cast's `typeAnnotation`, required to be `TSUnknownKeyword` |

## Invariants

- The rule's identity is its published name; nothing here assigns it a number.
- Detection is purely syntactic. No module is resolved, no type is consulted, no code runs.
- The file gate is evaluated once per file, before any visitor is installed. Outside its scope the
  rule does not exist rather than staying quiet, which is why no report can be recovered by moving a
  file back later without re-running the lint.
- The exemption is a path and only a path. No judgement, no comment and no configuration option can
  grant it, and it cannot be granted per call site.
- One report per offending outer node; the report anchors on the outer cast, so a disable comment on
  the statement covers exactly one erasure.
- The report is the whole remedy. The rule publishes no automatic fix, because every real repair
  gives the value a shape it did not have and no machine can choose that shape.
- The module's own severity opinion is `error`; the consuming configuration remains the authority on
  what is actually switched on.

## Exceptions

- **Test files.** Four filename suffixes, exempt wholesale. This is the law's fourth code expressed
  as a path, and the rule module argues why it must be a path rather than a judgement: the alternative
  is re-arguing the same exemption at every call site.
- **Everything outside `/src/`.** Not an exemption granted to anybody — a scope decision about what
  counts as product source. It is nonetheless where the largest volume of unexamined code lives.
- **The single cast.** Not an oversight and not a grant: a narrowing the compiler can still partly
  check is a different act from an erasure, and the twin tests pin that difference down explicitly.
- **The widening cast to the keyword alone.** Legal by design; it is the shape the law asks for when
  the shape is genuinely not known yet.

## Output

```text
rule:    no-double-cast
file:    <path as the gate saw it, forward-slashed>
node:    TSAsExpression (outer)
inner:   TSAsExpression -> TSUnknownKeyword
message: double
```

## Load Policy

Read this file first. Read `vi.md` for what the rule catches and why this law is worth a machine at
all, `example.md` for the code that fires and the code that slips through, `audit.md` while
reviewing whether the enforcement still matches the law, and `changelog.md` for version history.

## Scope

This module documents the one rule published by the type-safety law's rule module, shipped in
`@starci/eslint-canon-fe`. It documents no rule that ought to exist: a rule that cannot be pointed
at is a proposal, and proposals are listed in `audit.md` as open risk instead.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A rule
added, removed or renamed in the rule module is such a change; so is an open hatch that gets closed.
