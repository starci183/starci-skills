---
id: be-patterns-type-safety-index
title: INDEX.md
slug: /be/patterns/type-safety
sidebar_label: type-safety
sidebar_position: 0
description: Binding rules for not switching the compiler off, and for the six ways it gets switched off quietly.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `type-safety`

## Law

The type system is the cheapest reviewer a back end has: it reads every line, it never gets tired,
and it objects before the code runs. Every code below is about **not switching it off** — because
each of the ways to switch it off looks locally reasonable at the moment it is written and is
invisible from that moment on.

`any` is the obvious one. The others are quieter: a double cast that launders a wrong type through
`unknown`, an inline object type that nothing else can reference, an enum that is erased at compile
time and cannot be read back at runtime, a set of booleans that admits combinations nobody has ever
seen.

The question that settles a case: **after this line, does the compiler still know what it had?** If
the answer is no, the line has spent a guarantee, and spending one needs a reason better than
convenience. The reason is what a reader is entitled to find at the line.

**This is binding, not advisory.** Every value that crosses a boundary, every parameter list, every
enum and every state carries exactly one of the codes below. There is no boundary too small to carry
one: a two-field params object answers `TYPE-3` for the same reason a four-state grading result
answers `TYPE-5`. "It is only a helper" is where this law is skipped most often, and a helper is
exactly the thing that acquires a second caller without being re-read.

Half of this law is machine-checkable and half is not, and the split is not an accident of effort.
The `Tầng giữ` table says which is which rather than implying uniform enforcement, because a law
that lets a reader believe a lint rule is watching when none is is worse than no law: it buys
confidence with nothing behind it.

## Situation Codes

Every situation this module governs carries a code, `TYPE-<n>`. The numbers are FIXED: they are
cited from sibling laws, from lint-config comments and from historical task records, so a renumber
silently breaks a citation somebody already made.

| Code | What it requires | What it forbids |
|---|---|---|
| `TYPE-1` | A value of unstated shape enters as `unknown` and is narrowed once, in the open, where the assumption is readable | `any` in any position — parameter, return, field, generic argument, cast target |
| `TYPE-2` | A cast that the compiler refuses is repaired at the type, or narrowed by a guard that actually checks | `x as unknown as T` — the pair whose second half lands back on a concrete type |
| `TYPE-3` | A destructured parameter takes a named type, declared where a second caller can import it | An inline object literal type on a destructured parameter |
| `TYPE-4` | An enum is declared plain, so it keeps a runtime object that can be iterated, reverse-mapped and passed as a value | `const enum`, in every position including ambient re-declaration |
| `TYPE-5` | A situation with several states is a discriminated union of the states that exist | A set of booleans or co-optional fields describing one situation |
| `TYPE-6` | A sanctioned exit is declared once, at the lane it applies to, where a reader can find every place it is in force | A per-line suppression standing in for a lane-wide exit |

Six codes, and it ends at six. A situation that genuinely has no code is a rule change recorded in
`changelog.md`, not a seventh number added in passing.

`TYPE-1` and `TYPE-2` look like one code said twice, and they stay two because they fail at
different distances. `any` fails outward and immediately: everything read off it and everything
derived from it is unchecked from that line onward, and a reader who lands on any of those lines can
still see the `any` by walking back. The double cast fails inward and later: it produces a value
that CLAIMS to be `T`, so nothing downstream has any reason to doubt it, and the failure surfaces at
a line that did nothing wrong.

`TYPE-5` is the odd one. Every other code forbids a way of switching the compiler off; `TYPE-5` asks
for a shape that switches it further ON — a union of real states makes an unreal state impossible to
write down. It is in this module because the failure it prevents is the same failure: a bag of
booleans type-checks in all sixteen of its combinations, of which perhaps three exist, and the
compiler has been made useless about the thing that matters most.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a lint rule published by
[`sources/be/type-safety.mjs`](../../../sources/be/type-safety.mjs) catches it; `documented` means
nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `TYPE-1` | `enforced` | `@typescript-eslint/no-explicit-any` — a standard rule NAMED in this law's `recommended` rather than reimplemented in it |
| `TYPE-2` | `enforced` | `no-double-cast` (export `noDoubleCast`) |
| `TYPE-3` | `enforced` | `no-inline-param-type` (export `noInlineParamType`) |
| `TYPE-4` | `enforced` | `no-const-enum` (export `noConstEnum`) |
| `TYPE-5` | `documented` | — |
| `TYPE-6` | `documented` | — |

**Four enforced, two documented, none unrepresentable.**

Three of the four enforced rows are house-written rules; the fourth, `TYPE-1`, is held by a rule
every TypeScript repository already has. The law names it in `recommended` instead of writing a
second implementation of it, and the choice is deliberate: a duplicate of a rule everybody has is a
maintenance cost with no gain, and `no-explicit-any` is the one whose absence would make the other
three decorative — `any` reintroduces every problem they forbid, in one keyword.

Two documented rows, and they are documented for opposite reasons. `TYPE-5` is unenforceable in
principle: deciding whether four booleans describe ONE situation or four genuinely independent
facts requires knowing what the code means, and a rule that guessed would fire on every struct with
two flags in it. `TYPE-6` is unenforceable in practice: a rule cannot tell a suppression that is
standing in for a missing lane declaration from one that is honestly local, because the two are the
same three tokens.

`unrepresentable` is empty, and the empty column is the most informative cell in this table.
`TYPE-5` is the code that ASKS for the `unrepresentable` tier — a discriminated union is exactly the
device that moves a business rule from prose into the type system — and it cannot itself be held
there, because no type can forbid you from declaring the wrong type. That is the recursion this
module lives inside, and it is why `TYPE-5` is prose with the failure attached rather than a rule.

Each enforced row is also narrower than its code. `no-double-cast` sees one expression, so a
laundering split across two statements passes. `no-inline-param-type` visits function declarations,
function expressions and arrows, so an inline type in a type-position signature passes.
`no-explicit-any` does not visit an unchecked cast, so `TYPE-1`'s second half — that the narrowing
actually narrows — has no rule at all. Every one of those gaps is named again in `audit.md` with the
live shape that proves it, because a tier table that rounds "partly" up to "enforced" is the same
lie this law is about.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `TYPE-1` | `src/modules/ai/balancer/utils/classify-ai-error.ts` → `extractStatus`, `extractRetryAfterMs`, `classifyAiError` | Three functions that take `error: unknown` from a boundary nobody controls and narrow with `typeof` and `instanceof` before reading a property. Read what the signature promises a caller versus what an `any` there would have promised |
| `TYPE-1` | `src/modules/ai/ping/utils/to-error-message.ts` → `extractResponseDetail` | The narrowing done the expensive way on purpose: each nesting level is `typeof`-checked before the next is read. This is what `TYPE-1` costs when the shape is genuinely unknown, and the cost is the point |
| `TYPE-1` | `eslint.config.mjs` → `'@typescript-eslint/no-explicit-any': 'error'` | The rule at `error`, with the law cited on the same line. Grep `: any` across `src` and read every hit: they are all the English word inside a comment. Zero declarations is the measurement that lets the level be `error` rather than `warn` |
| `TYPE-2` | `src/modules/platform/cookie/types/cookie.ts` → `CookieRequestLike` | The repair, with the reason attached: a minimal structural interface that exists so two seams do not double-cast a header bag into a full framework `Request`. Read the doc comment — it names the double cast it was written to avoid |
| `TYPE-2` | `.claude/sources/be/type-safety.test.mjs` → the `TYPE-2` twin test's `valid` list | The boundary of the rule stated as executable cases: a lone `as unknown` is honest widening, a lone narrowing cast is a different question, and only the pair landing back on a concrete type is the overrule |
| `TYPE-3` | `src/modules/ai/types/grading-lane-validation-params.ts` → `ValidateGradingLaneParams`, consumed destructured in `src/modules/ai/grading-lane-validation.service.ts` | The named type and its call site in two files. The interesting part is the third reference in the service: `NonNullable<ValidateGradingLaneParams["provider"]>`. An inline type cannot be indexed like that, so this line is what `TYPE-3` bought |
| `TYPE-3` | `src/modules/platform/cookie/types/cookie.ts` → `AttachHttpOnlyCookieParams`, `AttachReadableCookieParams`, `ClearCookieParams` | Three params types in one `types/` file, one per operation, each documented per field. Read them as the shape a module's `types/` folder takes when the law is followed rather than argued about |
| `TYPE-4` | `src/modules/databases/postgresql/primary/enums/mock-interview-kind.ts` → `normalizeMockInterviewKind` | `Object.values(MockInterviewKind)` inside a coercion that turns a stored string back into a known member. A `const enum` has no object to call `Object.values` on, so this function could not be written at all |
| `TYPE-4` | `src/modules/init/seeders/shared/extracts/coerce-md-scalar.service.ts` → `toNullableEnum`, `toRequiredEnum` | The strongest form: the enum is passed AS A VALUE, `enumObject: TEnum`, and matched by key and then by value. Every caller of this helper is a thing a `const enum` makes impossible |
| `TYPE-4` | `tsconfig.json` → `"isolatedModules": true` | The compiler setting that turns `TYPE-4`'s last clause from an opinion into a build error. The law's claim about the isolated-modules boundary is checkable here in one line |
| `TYPE-5` | `src/features/api/core/graphql/mutations/keycloak/sign-in/init/graphql-types/response.ts` → `SignInInitCommandResult` beside `SignInInitData` | Both halves of the code in one file. The internal result is a `kind`-discriminated union where a mixed challenge/session state does not compile; the transport class beside it has every field optional, because the wire format cannot carry a union. Read the pair as the exception's exact boundary, not as an inconsistency |
| `TYPE-6` | `.claude/sources/be/type-safety.mjs` → `isTestFile` | The exit itself: one predicate, one regex over the spec suffixes plus the test tree, consulted once at rule construction. Every place the exit is in force is derivable from this function, which is the property a per-line suppression destroys |
| `TYPE-6` | `src/features/api/core/graphql/mutations/keycloak/sign-in/init/sign-in-init.handler.spec.ts` → the `jest.Mocked<Pick<…>>` casts | The exit in use, and the reason for it: a spec builds a deliberately partial collaborator to prove the handler only touches the methods it declares. Note what is NOT here — no `eslint-disable` comment on any of those lines |

Every code is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| origin | Where the value comes from — a parsed body, a provider SDK, a stored column, an internal caller — because that decides whether its shape is known at all |
| shape | The declared type it claims, and whether anything checked that claim |
| narrowing | The guard, `typeof`, `instanceof` or predicate that stands between `unknown` and the concrete read |
| callers | Every caller of a parameter list today, and whether a second one exists or plausibly will |
| runtime need | For an enum: whether anything iterates it, reverse-maps it or passes it as a value |
| states | For a situation: the states that actually exist, and the combinations the current shape also admits |
| lane | Which lane the file is in, because the sanctioned exits are lane properties, not line properties |

## Invariants

- `any` does not appear in a declaration, a cast target or a generic argument.
- A value of unstated shape enters as `unknown` and is narrowed exactly once, visibly.
- A cast pair through `unknown` does not exist outside the test lanes.
- A destructured parameter's type has a name and a home a second caller can import from.
- An enum keeps its runtime object.
- A situation with several states is a union of those states, not a product of flags.
- A sanctioned exit is declared at the lane, once, and is derivable from that declaration alone.
- Every boundary crossing resolves to exactly one code. No value is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The test lanes may build a deliberately wrong value.** `TYPE-2` does not apply to the spec
  family or the test tree: constructing a value the production type refuses is how a spec proves a
  closed API refuses it. The exit is the lane, not the line — it is declared once, in the rule, and
  a per-line suppression inside a lane that already has the exit means the file is in the wrong
  lane.
- **Widening on the way out is honest.** `TYPE-2` forbids the PAIR. A lone `as unknown` throws
  information away and claims nothing, which is the opposite failure mode; a lone narrowing cast is
  a different and smaller question that this code does not answer.
- **A positional parameter is not a destructured one.** `TYPE-3` governs the destructured form,
  because that is where a shape gets retyped by the next caller. An inline type on a positional
  parameter is a smaller problem with a different remedy and is deliberately outside this code.
- **A transport type cannot carry a union.** `TYPE-5` does not fire on a wire or persistence shape
  whose format has no sum type — a schema-registered response class, a single stored column. The
  union lives on the internal result, the transport shape carries the flattened form, and the
  mapping between them happens once, in one place, where it can be read.
- **A version modelled as data is not a flag.** `TYPE-5` does not fire on independent booleans that
  answer independent questions. The code is about several booleans describing ONE situation; two
  booleans describing two situations are two booleans.
- **An ambient declaration is not a declaration.** `TYPE-4`'s rule deliberately passes
  `declare enum`, because an ambient enum describes something that already exists elsewhere rather
  than emitting anything.

## Output

```text
value: <the thing crossing the boundary>
origin: <parsed body | provider SDK | stored column | internal caller>
situation: <TYPE-1 … TYPE-6>
shape: <the declared type after the line>
narrowing: <the guard that stands behind the claim, or none>
lane: <product | spec | test tree>
reason: <what the compiler still knows after this line, and what it would have lost>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.
`changelog.md` is read when a version marker disagrees with what a record says.

## Scope

This module states a rule true of any back end compiled by a structural type system with an escape
hatch in it. Examples are ordinary TypeScript in a NestJS-shaped application: they name no product,
no repository and no course. The four rule ids are the only proper nouns in the law itself, because
a rule id is an enforcement identity and a renamed rule cannot be cited in a config. Repository
paths appear in `Anchor` and nowhere else — an anchor is required to be a real path, which is
exactly what makes it an anchor.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding, removing or renumbering a `TYPE-<n>` code is a major change, not an increment.
