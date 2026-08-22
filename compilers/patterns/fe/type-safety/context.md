# Type-safety

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input is a shape somebody already accepted — a layout, a block, a capability or a contract that is
no longer being argued about. The output is source architecture: which file holds the value that comes
in from outside, what that file may declare, what it may not assert, and what it owes in writing when
it does assert. This module never re-opens the accepted shape. It lands it, at the one place the shape
is silently allowed to stop being checked.

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

## Situation codes

Every situation this module governs carries a code, `TYPE-SAFETY-<n>`. The code names the SITUATION;
the columns name what that situation requires of the source and what it forecloses.

| Code | Situation | What the source must look like |
|---|---|---|
| `TYPE-SAFETY-1` | A value crosses into the program and the writer casts it through `unknown` | A value crossing into the program is narrowed by a check the compiler can follow. Forbidden: a cast through `unknown` — `x as unknown as T` — in governed product source |
| `TYPE-SAFETY-2` | The shape is genuinely unknown and the writer reaches for `any` | A genuinely unknown shape is declared `unknown`, so the narrowing has to happen somewhere in the open. Forbidden: `any`, in a declaration, a parameter, a generic argument or a cast |
| `TYPE-SAFETY-3` | An array type is spelled two different ways in one tree | One spelling for an array type: `Array<T>` and `ReadonlyArray<T>`. Forbidden: `T[]` and `readonly T[]` |
| `TYPE-SAFETY-4` | A test has to construct the value the types forbid, because that is what it proves | The permission to build a value the types forbid is a PATH — a `.test.` or `.spec.` file — and the wrong value is what the file is proving. Forbidden: a judgement-based exemption argued at a call site; a product file claiming the test permission |
| `TYPE-SAFETY-5` | A cast at a real boundary survives review | A cast that survives review states its reason in a clause beside it. Forbidden: a cast whose only justification is that the error went away |

Two codes name an **absence of a mechanism** rather than a value. `TYPE-SAFETY-4` is a permission,
not a prohibition: it is the only code here that says *yes*, and it exists so that the *no* in
`TYPE-SAFETY-1` can be absolute everywhere else. `TYPE-SAFETY-5` governs a comment, which is the
one thing on this list no compiler reads. Both are real situations a reader has to be able to cite:
a module that can only describe what a checker sees cannot correct the cases the checker was
deliberately not given.

## Reading an accepted shape

1. **Read what the shape states.** It states that some value reaches this surface: a response body, a
   stored record, a decoded token, a vendor event, a contract prop. That fact is settled; it is not
   re-opened here.
2. **Read what the shape does not state, and therefore does not resolve.** A shape never states what a
   type should contain — that belongs to the contract and props modules — and never states that a
   value is validated at runtime. This module governs only the moment the compiler is told to stop
   looking.
3. **Resolve outermost first.** Start at the file where the value enters the program and work inward.
   The seam a double cast erases is the outermost one, and every inner file inherits whatever that
   file decided.
4. **Ask each code's question, in order.** Does the file cast through `unknown` (`TYPE-SAFETY-1`)?
   Does it write `any` where the shape is genuinely unknown (`TYPE-SAFETY-2`)? Does it spell an array
   type twice over (`TYPE-SAFETY-3`)? Is the path a `.test.`/`.spec.` file whose subject is the wrong
   value (`TYPE-SAFETY-4`)? Does a surviving cast carry its reason in a clause (`TYPE-SAFETY-5`)?
5. **When two codes both match, choose the code with the right radius.** An erasure that stops at one
   line is `TYPE-SAFETY-1`; a type that travels with the value into files that never named it is
   `TYPE-SAFETY-2`. Same act, different radius — and the travelling one costs more.

## `TYPE-SAFETY-1` — a cast through `unknown` is erasure, not narrowing

**Situation.** A value has just crossed from **outside the program to inside it**: a network response,
something read from storage, a payload somebody else sent, a vendor type that does not match. It does
not have the shape the writer wants. Instead of checking it, the writer tells the compiler to forget
everything with `x as unknown as T`.

**What it emits in source.** A governed file under `/src/` that declares the incoming value and
narrows it with a check the compiler can follow — a predicate, a `typeof`, a discriminant. The string
`as unknown as` does not appear in that file. A single-step cast such as `a as B` is still a claim the
compiler can **partly** check: it refuses when the two types share nothing. Routing through `unknown`
is exactly how that partial check is bypassed, because `unknown` overlaps **every** type. That is not
narrowing. That is erasure — and what it erases is the seam most worth keeping. Inside the program a
wrong cast is usually caught by other types a few lines later. At the boundary nothing catches it; the
wrong data travels on until it breaks somewhere unrelated.

**Recognition signs.** The literal `as unknown as` in a non-test file. A cast sitting immediately after
`JSON.parse`, `response.json()`, `localStorage.getItem`, or a vendor import. A stated reason of the
form *TypeScript complains*, *it will not accept it*, *I know what shape it is*. Ask: if the server
renames a field tomorrow, does this line go red? If not, nobody is checking, and this cast is where
the checking was switched off.

**Boundary.** Not `TYPE-SAFETY-2`: this erases **at one line**, while `any` erases and then travels
with the value into every file it touches. Not `TYPE-SAFETY-4`: same syntax, different **file** — in a
`.test.`/`.spec.` file, building the wrong value is the file's job. Not `TYPE-SAFETY-5`: that code
covers a **single-step** cast that can still hold a reason; a cast through `unknown` is not rescued by
a comment, because a reason does not turn erasure back into checking. And a cast *into* `unknown` —
`value as unknown` alone — is not this code at all: it moves a value from a type the compiler should
not have believed to one it cannot act on without a check, the opposite direction and the direction
this law wants.

## `TYPE-SAFETY-2` — `any` is the same erasure, and it spreads

**Situation.** The real shape is genuinely not known yet, so the writer puts `any` and moves on. The
difference from `TYPE-SAFETY-1` is not how serious one line is; it is **radius**.

**What it emits in source.** A declaration, parameter or generic argument typed `unknown`, with the
narrowing visible in the file that needs it — a local predicate, an `isRecord`, a `typeof` chain — and
no `any` anywhere in the file. A cast stops at its line. `any` **travels**: every property read off it
is `any`, every value derived from it is `any`, and the erasure reaches files that never mentioned it.
The next reader opens a clean file, sees a variable with a type, and has no way to know that type
stopped being checked three files ago. `unknown` does not lie: it says "not known yet", and it
**forces** the narrowing to happen somewhere in the open.

**Recognition signs.** `: any`, `<any>`, `as any`, `Array<any>`, `Record<string, any>`. A function that
takes `any` and returns something typed, with **no** checking step in between. A stated reason of the
form *temporary*, *will fix later*, *this place is too generic*. Ask: if this `any` became `unknown`,
how many places go red? Each one is a place trusting something nobody checked.

**Boundary.** Not `TYPE-SAFETY-1`: if both could apply, take the code with the right radius — one line
is `TYPE-SAFETY-1`, a type that spreads is `TYPE-SAFETY-2`. Not `TYPE-SAFETY-5`: `any` is **not**
rescued by a reason, because a reason justifies bridging at one point and `any` is not a point.

## `TYPE-SAFETY-3` — one thing, one spelling

**Situation.** `Array<T>` and `T[]` mean **exactly the same thing**. That is precisely why this is a
law and not a preference: when two spellings are both correct, nothing ever fixes the second one.

**What it emits in source.** Every array type in the tree written in the generic form — `Array<T>` and
`ReadonlyArray<T>` — including where the element type is itself generic or exotic. Choose the generic
form because it stays **readable when the element type is itself generic**. Compare
`Array<Map<string, Set<number>>>` with `Map<string, Set<number>>[]`: in the postfix form the brackets
that say "this is an array" are pushed to the very end, after the eye has already unpacked two other
generic layers. A file written on Tuesday reads differently from the file beside it, and every later
diff carries noise that says nothing about the business.

**Recognition signs.** `T[]` or `readonly T[]` in a `.ts`/`.tsx` file. Both spellings living in **one**
file. Ask: if the element type becomes generic tomorrow, is this line still readable?

**Boundary.** Not any other code here: this is the only one that is **not** about switching checking
off. Nothing is erased; the type system keeps working as usual. It sits in this module for the same
root reason — what nobody fixes will drift.

## `TYPE-SAFETY-4` — a test may build the wrong value, because that is its job

**Situation.** Something has to prove that a type-closed API **refuses** bad input. Proving that means
**constructing** bad input — and there is no way to construct a value the types forbid without telling
the compiler to forget them.

**What it emits in source.** A file whose path ends in `.test.ts`, `.test.tsx`, `.spec.ts` or
`.spec.tsx`, holding the deliberately wrong value, with the production file left clean. This is the
only code in the module that says **permitted**. It exists precisely so that the **no** in
`TYPE-SAFETY-1` can be absolute everywhere else. **The exemption is a PATH, and has to be a path.** A
judgement-based exemption — "when it is truly necessary it is allowed" — gets re-argued at **every**
call site, and the side arguing is always the side in a hurry. A path is argued **once**, here.

**Recognition signs.** The file ends in `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`. The value
built is a fake that is **deliberately incomplete**: enough for the function under test to touch, not
enough to match the real type. A sentence nearby makes clear what this file is guarding. Ask: is this
wrong value **the thing being proved**? If it is only a quick fixture, the exemption does not apply —
it is borrowing another code's permission.

**Boundary.** Not `TYPE-SAFETY-1`: same syntax, different file. That is the whole difference, and also
why the exemption must be a path rather than a promise. Not `TYPE-SAFETY-5`: inside a test a reason is
**not** the condition for the cast to exist; a sentence saying what the file guards is still what makes
it readable later, but that is habit, not law. **A test file is not automatically clean.** The
exemption says only that building a wrong value here is not a fault. It does **not** say every cast in
a test is right. A lazy cast in a test is still a lazy cast — there is just nothing reporting it.

## `TYPE-SAFETY-5` — a surviving cast carries its reason

**Situation.** Sometimes a boundary **genuinely** needs a cast: a vendor type declared wrongly, a value
the runtime guarantees and the compiler cannot, an implementation wider than any of its own overloads.
Those cases are real.

**What it emits in source.** A single-step cast with a clause beside it naming **what the runtime
guarantees** or **what the vendor declared wrongly**, and a checking step still standing after the cast
— the cast opens just enough room to check, it does not replace the check. What separates these from
the rest is not the writer's confidence but that **the reason can be written as a clause**. That test
is stronger than it looks: forced to write the sentence, most casts collapse, because the only sentence
available is "otherwise it errors" — and that error was the compiler saying something **true**.

**Recognition signs.** A single-step cast, not routed through `unknown`. A sentence beside it stating a
runtime guarantee or a vendor misdeclaration, not restating what the cast does. A narrowing step
remaining after the cast. Ask: write the reason as one sentence. If the sentence is "because it errors",
the cast belongs to `TYPE-SAFETY-1` or to a change of shape, not here.

**Boundary.** Not `TYPE-SAFETY-1`: a reason does **not** rescue a cast through `unknown`; erasure with
an explanation is still erasure. Not `TYPE-SAFETY-2`: a reason does not rescue `any` either, because
`any` does not stop at the line carrying the reason. Not `TYPE-SAFETY-4`: inside a test a cast needs no
permission; outside a test it does. **No rule holds this code, and none can.** A machine sees that a
comment exists; it cannot see that the comment is true, and a rule demanding "there must be a comment"
is satisfied by the word `cast`. This is the one place in the module where the reader is the only
mechanism.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a rule in `@canon-fe` reports it,
named below; `documented` means nothing in this module's rule file holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `TYPE-SAFETY-1` | `enforced` | `no-double-cast`, messageId `double`. Reports the outer cast of an `x as unknown as T` pair, in any file matching `/src/` that is not `.test.`/`.spec.`. Exact — it matches one syntactic shape — and complete for that shape. |
| `TYPE-SAFETY-2` | `documented` | Nothing in this file, **on purpose**. The TypeScript plugin's own `@typescript-eslint/no-explicit-any` refuses `any`, and reimplementing it here would be a second copy of somebody else's rule — a second thing to keep in step, and the one nobody edits is the one that stops matching. Held outside the module, at a known cost: this module cannot state the severity that rule runs at. |
| `TYPE-SAFETY-3` | `documented` | Nothing in this file, for the same reason. The array spelling is a formatter-shaped question already answered by `@typescript-eslint/array-type` with `{ default: "generic", readonly: "generic" }`. What no rule holds is the *reason* — that the generic form stays readable when the element type is itself generic. |
| `TYPE-SAFETY-4` | `documented` | The exemption is IMPLEMENTED by `no-double-cast` (`isTestFile`, `isGoverned`), so a product file cannot claim it — but that half is reported as `TYPE-SAFETY-1`. The half that belongs to this code, that the wrong value is what the test is PROVING, is held by nobody. A test that casts through `unknown` out of laziness passes silently. |
| `TYPE-SAFETY-5` | `documented` | No rule reads a reason. A checker can see that a comment exists; it cannot see that the comment is true, and a rule that demanded any comment at all would be satisfied by the word `cast`. |

One code is held by a rule; four are held by a reader. The four are not a backlog to be silently
closed. Two (`TYPE-SAFETY-2`, `TYPE-SAFETY-3`) are deliberate hand-offs to rules a consuming repository
already has, and two (`TYPE-SAFETY-4`, `TYPE-SAFETY-5`) are the part of this law that a checker cannot
be given without becoming a formality.

## Inputs

| Input | Evidence required |
|---|---|
| file path | Whether the file is governed product source (`/src/`) or a `.test.`/`.spec.` file |
| erasure shape | Double cast through `unknown`, an `any` annotation, or a single cast |
| origin of the value | Whether it crossed into the program from outside — network, storage, a vendor type — or was built inside it |
| what the compiler knew | The type in force on the line before the erasure |
| reach | Whether the erasure stops at this line or travels with the value |
| reason | For a surviving cast: the sentence that would be written beside it |

## Rules

1. No `as unknown as` in product source under `/src/`.
2. A cast is an erasure, not a narrowing. A narrowing is a claim the compiler can still partly check.
3. The seam a double cast erases is the one worth checking: where a value crosses from outside the
   program to inside it.
4. `unknown` forces a narrowing to happen somewhere visible; `any` removes the requirement to have one.
5. An erasure that stops at one line and an erasure that travels are different sizes of the same act,
   and the travelling one costs more.
6. One thing has one spelling. Where two spellings mean the same thing, the module picks one and
   nothing is left to the day of the week.
7. The test exemption is a path, decided once, not a judgement re-argued at every call site.
8. A reason that cannot be written in a clause is a cast hiding something rather than bridging
   something.
9. Each foreign rule this module hands a code to is named. A code handed to nobody is unheld, and this
   module says so rather than implying coverage.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Test files.** `TYPE-SAFETY-1` does not apply to a `.test.` or `.spec.` file. That is
  `TYPE-SAFETY-4`, and it is narrow because it is a path: proving a closed API refuses bad input
  requires constructing bad input, and there is no way to construct a value the types forbid without
  telling the compiler to forget them.
- **Outside `/src/`.** Tooling, build config and scripts are out of scope for `TYPE-SAFETY-1`. The law
  governs the program, not the machinery that assembles it.
- **A genuine boundary, with its reason.** `TYPE-SAFETY-5` admits the cast that survives: a vendor type
  that is wrong, a value the runtime guarantees and the compiler cannot. Those exist. What separates
  them from the others is that the reason can be written in a clause.
- **Widening to `unknown`.** A single cast *to* `unknown` is not a `TYPE-SAFETY-1` erasure. It moves a
  value from a type the compiler should not have believed to one it cannot act on without a check — the
  opposite direction, and the direction this module wants.
- **The overload implementation.** `TYPE-SAFETY-5` admits a cast from an implementation signature to
  its own overload set, because the overloads are the checked surface and the implementation is
  deliberately wider than any single one of them.

## Output

One block per file the accepted shape produces.

```text
file: <path under the source tree>
governed: <yes | no — test file | no — outside /src/>
situation: <TYPE-SAFETY-1 … TYPE-SAFETY-5>
erasure: <double cast | any | single cast | none>
verdict: <refused | permitted | permitted with reason>
holder: <no-double-cast | foreign rule name | reader>
reason: <what the compiler knew, and why it may or may not forget it>
```
