# type safety

## Definition

Types are the half of this canon a machine holds without being asked. Most of what the other laws
say is enforced by a closed union or a slot alias rather than by a rule — which means the value of
the type system here is not "fewer bugs" in the abstract. It is that **most of canon stops being
optional.**

That gives the rules in this file one job: guard the places where somebody turns the type system
OFF. A cast does not fix a type error; it silences one, at the exact seam where the error was worth
having.

The question that settles it: **what did the compiler know that this line is telling it to forget?**
If the answer is "nothing, the types genuinely match", the cast is unnecessary. If the answer is
anything else, the cast is hiding it.

What holds this law is [`sources/fe/type-safety.mjs`](../../../sources/fe/type-safety.mjs).

## Rules

**TYPE-SAFETY-1 · A double cast turns checking off, and it is the loudest form of doing so.**

Casting through `unknown` tells the compiler to forget everything it knew about the value, because
the two types have nothing in common. That is not a narrowing — a narrowing is a claim the compiler
can still partly check. It is an erasure, and the seam it erases is exactly the one worth checking:
where a value crosses from outside the program to inside it.

**TYPE-SAFETY-2 · `any` is the same erasure spelled shorter, and it spreads.**

A cast stops at one line. `any` travels: every property read off it is `any`, every value derived
from it is `any`, and the erasure reaches files that never mentioned it. When the shape is genuinely
unknown, say `unknown` — which forces the narrowing to happen somewhere, in the open.

**TYPE-SAFETY-3 · One spelling for an array.**

`Array<T>`, never `T[]`. Both mean the same thing, which is exactly why this is a rule rather than a
preference: nothing corrects the second spelling, so a file written on a Tuesday reads differently
from its neighbour and every diff afterwards carries noise. The generic form is the one that stays
readable when the element type is itself generic.

**TYPE-SAFETY-4 · A test may build a wrong value on purpose.**

Proving that a closed API refuses bad input requires constructing bad input, and there is no way to
do that without a cast. The exemption is the test files, stated as a path — and it is narrow because
a judgement-based version would be argued at every call site.

**TYPE-SAFETY-5 · A cast that survives review carries its reason on the line.**

Occasionally a boundary genuinely needs one: a vendor type that is wrong, a value the runtime
guarantees and the compiler cannot. Those exist. What separates them from the others is that the
reason can be written in a clause — and if it cannot be, the cast is hiding something rather than
bridging something.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A cast through `unknown` | It erases everything the compiler knew, at the seam where knowing mattered most | Narrow from `unknown` with a check the compiler can follow |
| `any` | It spreads to every value derived from it, into files that never mentioned it | `unknown`, and narrow it in the open |
| `T[]` | Two spellings for one thing, and nothing corrects the second | `Array<T>` |
| A cast to make an error go away | The error was the compiler saying something true | Fix the shape, or narrow properly |
| A cast with no reason beside it | A reason that cannot be written in a clause is a cast that is hiding something | Write the clause, or remove the cast |

## Examples

### The erasure

```ts
const row = parse(payload)
if (!isResumeRow(row)) return
// the compiler followed the check, and knows what `row` is here
```

```ts
const row = payload as unknown as ResumeRow
// the compiler knew the payload's shape and has been told to forget it
```

They differ in one thing: whether anything still checks that the payload is what it claims.

### The spread

```ts
const answer: unknown = await response.json()
```

```ts
const answer: any = await response.json()
// every property read off `answer` is now `any`, in every file it reaches
```

They differ in one thing: whether the erasure stops at this line.

### The sanctioned case

```ts
// bearer.test.ts - proving the link refuses a malformed operation means building one
return operation as unknown as ApolloLink.Operation
```

```ts
// component.tsx - the same spelling, in a file whose job is not to build wrong values
return operation as unknown as ApolloLink.Operation
```

They differ in one thing: whether constructing a wrong value is the point of the file.
