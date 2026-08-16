---
id: fe-patterns-type-safety-index
title: INDEX.md
slug: /gates/patterns/type-safety
sidebar_label: type-safety
sidebar_position: 0
description: Binding rules for the places a file turns the type system off, and what it owes when it does.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `type-safety`

## Law

Types are the half of this canon a machine holds without being asked. Most of what the other modules
say is held by a closed union or a slot alias rather than by a lint rule — which means the value of
the type system here is not "fewer bugs" in the abstract. It is that **most of canon stops being
optional.**

That gives this module one job: guard the places where somebody turns the type system OFF. A cast
does not fix a type error; it silences one, at the exact seam where the error was worth having.

The question that settles every code below:

> **What did the compiler know that this line is telling it to forget?**

If the answer is "nothing, the types genuinely match", the cast is unnecessary. If the answer is
anything else, the cast is hiding it.

**This is binding, not advisory.** Every erasure in the source is one of the five situations below.
There is no size at which an erasure is too small to carry a code: a one-line `as unknown as` in a
helper is `TYPE-SAFETY-1` for the same reason a module-wide `any` is `TYPE-SAFETY-2`. "It is only
one line" is not an exemption — it is the sentence that opens the seam.

## Situation Codes

Every situation this module governs carries a code, `TYPE-SAFETY-<n>`. The code names the SITUATION;
the columns name what that situation requires and what it forecloses.

| Code | Requires | Forbids |
|---|---|---|
| `TYPE-SAFETY-1` | A value crossing into the program is narrowed by a check the compiler can follow | A cast through `unknown` — `x as unknown as T` — in governed product source |
| `TYPE-SAFETY-2` | A genuinely unknown shape is declared `unknown`, so the narrowing has to happen somewhere in the open | `any`, in a declaration, a parameter, a generic argument or a cast |
| `TYPE-SAFETY-3` | One spelling for an array type: `Array<T>` and `ReadonlyArray<T>` | `T[]` and `readonly T[]` |
| `TYPE-SAFETY-4` | The permission to build a value the types forbid is a PATH — a `.test.` or `.spec.` file — and the wrong value is what the file is proving | A judgement-based exemption argued at a call site; a product file claiming the test permission |
| `TYPE-SAFETY-5` | A cast that survives review states its reason in a clause beside it | A cast whose only justification is that the error went away |

Two codes name an **absence of a mechanism** rather than a value. `TYPE-SAFETY-4` is a permission,
not a prohibition: it is the only code here that says *yes*, and it exists so that the *no* in
`TYPE-SAFETY-1` can be absolute everywhere else. `TYPE-SAFETY-5` governs a comment, which is the
one thing on this list no compiler reads. Both are real situations a reader has to be able to cite:
a module that can only describe what a checker sees cannot correct the cases the checker was
deliberately not given.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a rule in
[`sources/fe/type-safety.mjs`](../../../../sources/fe/type-safety.mjs) reports it, named below;
`documented` means nothing in this module's rule file holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `TYPE-SAFETY-1` | `enforced` | `no-double-cast`, messageId `double`. Reports the outer cast of an `x as unknown as T` pair, in any file matching `/src/` that is not `.test.`/`.spec.`. Exact — it matches one syntactic shape — and complete for that shape. |
| `TYPE-SAFETY-2` | `documented` | Nothing in this file, **on purpose**. The TypeScript plugin's own `@typescript-eslint/no-explicit-any` refuses `any`, and reimplementing it here would be a second copy of somebody else's rule — a second thing to keep in step, and the one nobody edits is the one that stops matching. Held outside the module, at a known cost: this module cannot state the severity that rule runs at. |
| `TYPE-SAFETY-3` | `documented` | Nothing in this file, for the same reason. The array spelling is a formatter-shaped question already answered by `@typescript-eslint/array-type` with `{ default: "generic", readonly: "generic" }`. What no rule holds is the *reason* — that the generic form stays readable when the element type is itself generic. |
| `TYPE-SAFETY-4` | `documented` | The exemption is IMPLEMENTED by `no-double-cast` (`isTestFile`, `isGoverned`), so a product file cannot claim it — but that half is reported as `TYPE-SAFETY-1`. The half that belongs to this code, that the wrong value is what the test is PROVING, is held by nobody. A test that casts through `unknown` out of laziness passes silently. |
| `TYPE-SAFETY-5` | `documented` | No rule reads a reason. A checker can see that a comment exists; it cannot see that the comment is true, and a rule that demanded any comment at all would be satisfied by the word `cast`. |

One code is held by a rule; four are held by a reader. The four are not a backlog to be silently
closed. Two (`TYPE-SAFETY-2`, `TYPE-SAFETY-3`) are deliberate hand-offs to rules a consuming
repository already has, and two (`TYPE-SAFETY-4`, `TYPE-SAFETY-5`) are the part of this law that a
checker cannot be given without becoming a formality. All four are recorded in `audit.md` with what
a rule would have to see.

## Anchor

A law that cannot be pointed at in real code is a proposal. Paths are relative to the front-end
source tree.

| Code | Anchor | What to look for |
|---|---|---|
| `TYPE-SAFETY-1` | `src/components/contracts/props.ts`, and the tree-wide absence | The contract types are declared, never asserted into place. Tree-wide, every occurrence of `as unknown as` sits in a `.test.`/`.spec.` file; there is no governed source file that contains one. That absence is the anchor — this code's evidence is a count of zero, and a single new hit is the whole finding. |
| `TYPE-SAFETY-2` | `src/modules/code/sandbox-repo.ts`, `src/components/leaves/Article/index.tsx` | Both take the outside value as `unknown` — `parseSandboxRepoSnapshot(raw: unknown)`, `toNode(value: unknown)` — and each carries a local `isRecord` predicate that narrows it. The narrowing is visible in the file that needs it, which is what `unknown` buys and `any` spends. |
| `TYPE-SAFETY-3` | `src/components/contracts/props.ts` | `ReadonlyArray<DataValue>` inside the `DataValue` union and `Array<never>` in `ComponentActions`. Both are element types that are themselves generic or exotic, which is where the spelling stops being cosmetic. |
| `TYPE-SAFETY-4` | `src/modules/api/graphql/clients/links/bearer.test.ts` | A fake transport operation is assembled from the three methods the link touches and returned through a double cast. The file's own doc comment states what it guards; the cast exists because proving a closed API refuses a malformed operation means constructing one. |
| `TYPE-SAFETY-5` | `src/hooks/auth/useSessionRefresh.ts`, `src/components/contracts/props.ts` | In the first, the cast target is `{ exp?: unknown }` and the doc line above says why the shape is not trusted further; the value is then narrowed with `typeof`. In the second, the implementation of an overloaded factory is cast to its own overload set, under a doc comment that says which surface is the checked one. Counter-case in the same tree: `src/app/sitemap.ts` casts a response body to a named type with no reason clause and nothing reports it — see `audit.md`. |

## Inputs

| Input | Evidence required |
|---|---|
| file path | Whether the file is governed product source (`/src/`) or a `.test.`/`.spec.` file |
| erasure shape | Double cast through `unknown`, an `any` annotation, or a single cast |
| origin of the value | Whether it crossed into the program from outside — network, storage, a vendor type — or was built inside it |
| what the compiler knew | The type in force on the line before the erasure |
| reach | Whether the erasure stops at this line or travels with the value |
| reason | For a surviving cast: the sentence that would be written beside it |

## Invariants

- A cast is an erasure, not a narrowing. A narrowing is a claim the compiler can still partly check.
- The seam a double cast erases is the one worth checking: where a value crosses from outside the program to inside it.
- `unknown` forces a narrowing to happen somewhere visible; `any` removes the requirement to have one.
- An erasure that stops at one line and an erasure that travels are different sizes of the same act, and the travelling one costs more.
- One thing has one spelling. Where two spellings mean the same thing, the module picks one and nothing is left to the day of the week.
- The test exemption is a path, decided once, not a judgement re-argued at every call site.
- A reason that cannot be written in a clause is a cast hiding something rather than bridging something.
- Each foreign rule this module hands a code to is named. A code handed to nobody is unheld, and this module says so rather than implying coverage.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Test files.** `TYPE-SAFETY-1` does not apply to a `.test.` or `.spec.` file. That is
  `TYPE-SAFETY-4`, and it is narrow because it is a path: proving a closed API refuses bad input
  requires constructing bad input, and there is no way to construct a value the types forbid without
  telling the compiler to forget them.
- **Outside `/src/`.** Tooling, build config and scripts are out of scope for `TYPE-SAFETY-1`. The
  law governs the program, not the machinery that assembles it.
- **A genuine boundary, with its reason.** `TYPE-SAFETY-5` admits the cast that survives: a vendor
  type that is wrong, a value the runtime guarantees and the compiler cannot. Those exist. What
  separates them from the others is that the reason can be written in a clause.
- **Widening to `unknown`.** A single cast *to* `unknown` is not a `TYPE-SAFETY-1` erasure. It moves
  a value from a type the compiler should not have believed to one it cannot act on without a check —
  the opposite direction, and the direction this module wants.
- **The overload implementation.** `TYPE-SAFETY-5` admits a cast from an implementation signature to
  its own overload set, because the overloads are the checked surface and the implementation is
  deliberately wider than any single one of them.

## Output

```text
file: <path under the source tree>
governed: <yes | no — test file | no — outside /src/>
situation: <TYPE-SAFETY-1 … TYPE-SAFETY-5>
erasure: <double cast | any | single cast | none>
verdict: <refused | permitted | permitted with reason>
holder: <no-double-cast | foreign rule name | reader>
reason: <what the compiler knew, and why it may or may not forget it>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module governs the places a front-end file turns type checking off inside one source tree. It
names no product and no library brand. Anchors cite real paths because a pattern module owes a place
to check; every worked example is ordinary TSX or TS against placeholder modules.

It does not govern what a type should contain — that belongs to the contract and props modules — and
it does not govern runtime validation. It governs only the moment the compiler is told to stop
looking.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. A
new code, a removed code, a change to the governed path set, or a change to the exemption set is a
rule change. Renumbering an existing code is never permitted: the codes are cited from other law
files and from task records, and a silent renumber breaks a citation somebody already made.
