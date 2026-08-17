---
title: Type-safety
---

# Type-safety

The input is a shape somebody already accepted — a capability, a contract, an operation, a stored record. This pattern does not re-open that decision. It lands it in source: which file holds the value, what type it is declared as, what stands behind that declaration, which layer owns the concern, and which lane the file is in. The accepted shape says what the system does; this pattern says what the compiler is still allowed to know after the code is written.

## Law

The type system is the cheapest reviewer a back end has: it reads every line, it never gets tired, and it objects before the code runs. Every code below is about **not switching it off** — because each of the ways to switch it off looks locally reasonable at the moment it is written and is invisible from that moment on.

`any` is the obvious one. The others are quieter: a double cast that launders a wrong type through `unknown`, an inline object type that nothing else can reference, an enum that is erased at compile time and cannot be read back at runtime, a set of booleans that admits combinations nobody has ever seen.

The question that settles a case: **after this line, does the compiler still know what it had?** If the answer is no, the line has spent a guarantee, and spending one needs a reason better than convenience. The reason is what a reader is entitled to find at the line.

**This is binding, not advisory.** Every value that crosses a boundary, every parameter list, every enum and every state carries exactly one of the codes below. There is no boundary too small to carry one: a two-field params object answers `TYPE-3` for the same reason a four-state grading result answers `TYPE-5`. "It is only a helper" is where this law is skipped most often, and a helper is exactly the thing that acquires a second caller without being re-read.

Half of this law is machine-checkable and half is not, and the split is not an accident of effort. The `Layer held` table says which is which rather than implying uniform enforcement, because a law that lets a reader believe a lint rule is watching when none is is worse than no law: it buys confidence with nothing behind it.

## Situation codes

Every situation this module governs carries a code, `TYPE-<n>`. The numbers are FIXED: they are cited from sibling laws, from lint-config comments and from historical task records, so a renumber silently breaks a citation somebody already made.

| Code | Situation | What the source must look like |
|---|---|---|
| `TYPE-1` | A value of unstated shape arrives from somewhere the code does not control | It enters as `unknown` and is narrowed once, in the open, where the assumption is readable. No `any` in any position — parameter, return, field, generic argument, cast target |
| `TYPE-2` | The compiler refuses a cast because the two types do not overlap | The cast is repaired at the type, or narrowed by a guard that actually checks. No `x as unknown as T` — the pair whose second half lands back on a concrete type |
| `TYPE-3` | A function takes an object and destructures it in the signature | The parameter takes a named type, declared where a second caller can import it. No inline object literal type on a destructured parameter |
| `TYPE-4` | A named set of constants | The enum is declared plain, so it keeps a runtime object that can be iterated, reverse-mapped and passed as a value. No `const enum`, in every position including ambient re-declaration |
| `TYPE-5` | One situation that has several states | The situation is a discriminated union of the states that exist. Not a set of booleans or co-optional fields describing one situation |
| `TYPE-6` | A lane of code that needs a sanctioned exit | The exit is declared once, at the lane it applies to, where a reader can find every place it is in force. Not a per-line suppression standing in for a lane-wide exit |

Six codes, and it ends at six. A situation that genuinely has no code is a recorded rule change, not a seventh number added in passing.

`TYPE-1` and `TYPE-2` look like one code said twice, and they stay two because they fail at different distances. `any` fails outward and immediately: everything read off it and everything derived from it is unchecked from that line onward, and a reader who lands on any of those lines can still see the `any` by walking back. The double cast fails inward and later: it produces a value that CLAIMS to be `T`, so nothing downstream has any reason to doubt it, and the failure surfaces at a line that did nothing wrong.

`TYPE-5` is the odd one. Every other code forbids a way of switching the compiler off; `TYPE-5` asks for a shape that switches it further ON — a union of real states makes an unreal state impossible to write down. It is in this module because the failure it prevents is the same failure: a bag of booleans type-checks in all sixteen of its combinations, of which perhaps three exist, and the compiler has been made useless about the thing that matters most.

## Reading an accepted shape

1. **Read what the shape states.** It states the values that cross a boundary, the operations that take parameters, the named constant sets, and the states a situation is allowed to be in. Those are facts; take them as given.
2. **Read what the shape does not state, and therefore does not resolve.** An accepted shape almost never states the origin of a value, whether anything checked a declared claim, whether a second caller exists, whether anything iterates an enum, or which lane a file is in. Those are the `Inputs` of this pattern, and each one has to be gathered as evidence before a code can be assigned.
3. **Resolve outermost first.** Start at the boundary the value enters through, then the parameter list that carries it, then the constant sets and states inside. A value that is still `any` at the boundary makes every code applied further in decorative.
4. **Ask each code's question in order.** Does a value of unstated shape enter here (`TYPE-1`)? Did a cast get forced through `unknown` (`TYPE-2`)? Is a parameter destructured in the signature (`TYPE-3`)? Is a named constant set declared (`TYPE-4`)? Does one situation have several states (`TYPE-5`)? Does this lane need a sanctioned exit (`TYPE-6`)?
5. **When two codes both match, split them by what the line claims.** `any` confesses that nothing is checked; the double cast claims to be `T`, so `TYPE-2` takes any line that ends on a concrete type through `unknown` and `TYPE-1` takes the rest. An inline type on a destructured parameter is still fully checked, so it is `TYPE-3`, never `TYPE-1`. A single axis of values is `TYPE-4`; branches that each carry different data are `TYPE-5`. And a spec that builds a deliberately wrong value is not a forgiven `TYPE-2` — it is outside `TYPE-2`'s scope from the start, and what it answers is `TYPE-6`.

## `TYPE-1` — unknown, not any

**Situation.** A value arrives from somewhere the code does not control: a webhook body, an error thrown by a provider SDK, a `jsonb` column read back from the database, a config file somebody else edits. Its shape is not known.

**What it emits in source.** The value is declared `unknown` at the point it enters, and one visible narrowing — `typeof`, `instanceof` or a predicate — stands between it and the first concrete read. `any` appears nowhere: not as a parameter, a return, a field, a generic argument or a cast target. `any` does not mean "I do not know this type". It means **stop checking**, and the stopping spreads: every property read off it, every value derived from it and every place it is passed on is unchecked too. One `any` in a parser can blind a whole call chain without another `any` being written.

**Recognition signs.** The value comes off the network, off a third-party SDK, out of `JSON.parse`, out of a jsonb column, out of a `catch`. The reason for reaching for `any` is "the real type is too long" or "the SDK declares it wrong". After that line the IDE stops suggesting anything — the most visible sign that a guarantee has just been spent. Ask: if this were declared `unknown`, which lines would go red? Each red line is an assumption that was about to be hidden.

**Boundary.** Not `TYPE-2`: `any` confesses that it checks nothing, while a double cast lies that the value is `T`; `any` fails outward, the double cast fails inward. Not `TYPE-3`: an inline type on a parameter is still fully checked — it is unreferenceable, not unsafe — and merging the two loses that distinction.

**Common business situations.** A payment-gateway webhook parser · `catch (error)` around an AI provider call · reading a jsonb column holding a snapshot · parsing the front matter of a content file · the result of `JSON.parse` on a model response · the payload of a message-queue message · environment variables before validation.

## `TYPE-2` — no double cast through unknown

**Situation.** `x as T` is written, the compiler refuses because the two types do not overlap, and the refusal is answered by inserting `unknown` in the middle: `x as unknown as T`.

**What it emits in source.** The chain `as unknown as` does not exist in product code. The type is repaired instead — a minimal structural interface, a real mapping function — or the value is narrowed by a guard that actually checks. This is the compiler overruled twice. Once: these two types are unrelated. Twice: never mind. It is worse than `any` at exactly one point, and that point decides. `any` says "do not trust me", so everything after it is reconsidered; the double cast produces a value that claims to be `T`, so everything after it trusts it absolutely, and the failure lands on a line that did nothing wrong, dozens of files from the cause.

**Recognition signs.** The string `as unknown as` in product code. An object missing fields being forced into a full entity. The result of a raw query forced into an entity type with nothing checked. The reason in your head is "I know at runtime it is right". Ask: if the thing you know for certain is wrong, who finds out? If the answer is "the customer", this is `TYPE-2`.

**Boundary.** Not `TYPE-1`: see above. Not a single cast: a lone `as unknown` is honest widening — it throws information away and claims nothing extra — and a lone narrowing cast is a different and smaller question this code does not answer. Not `TYPE-6`: inside the spec family and the test tree a double cast is legitimate and necessary, and that is a property of the lane, not of the line.

**Common business situations.** Forcing a raw query row into an entity · forcing an empty object into a collaborator in product code · forcing one framework's request into another framework's request · "patching" an SDK type that is declared wrong · forcing a DTO into an entity to save writing a mapper.

## `TYPE-3` — a destructured parameter takes a named type

**Situation.** A function takes an object and destructures it in the signature: `({ userId, courseId }: { userId: string, courseId: string })`.

**What it emits in source.** A named type in the module's `types/` folder, one per operation, documented per field, and the signature references it. An inline type written at the call point cannot be referenced, imported, extended or indexed. So the second caller retypes it, and the two copies drift apart in silence because nothing links them; when the third field arrives, only one copy gets it. A named type carries the same information with a handle on it.

**Recognition signs.** The signature is longer than the body. Two places in the repository declare nearly the same object. You want to write `Params["field"]` and there is nothing to index into. You want to write a wrapper function and cannot name the inner function's parameter type. Ask: if a second caller appears tomorrow, what do they import? If there is no answer, this is `TYPE-3`.

**Boundary.** Not `TYPE-1`: an inline type is still fully checked; the problem is reuse, not safety. Not a positional parameter: `(params: { userId: string })` is outside this code. This code governs the destructured form, because that is the form the next caller retypes; an inline type on a positional parameter is a smaller problem with a different remedy.

**Common business situations.** The params of a CQRS handler · the params of a service method with three or more arguments · the options of a utility function · a job payload · the arguments of a projection function · the input of one step in a processing pipeline.

## `TYPE-4` — plain enum, never const enum

**Situation.** A named set of constants: order status, notification kind, model provider.

**What it emits in source.** A plain `enum` declaration that survives to runtime as an object. `const enum` is inlined at compile time and leaves no runtime object. What it saves is a few bytes. What it takes away is a whole family of ordinary work: no `Object.values()`, so no iterating to build a choice list; no reverse map from value back to member, so no recovering a value stored in the database; no passing the enum itself as a value into a generic function; and no crossing the `isolatedModules` boundary this compilation runs under.

**Recognition signs.** Somebody added `const` in front of `enum` "to shrink the bundle" — inside a Node process. A coercion helper takes `enumObject` as a parameter: that is proof the enum must exist at runtime. A `registerEnumType` call or an enum column in the database: both need a real object. Ask: does anything iterate this enum, reverse-map it, or pass it as a value? In a back end the answer is almost always yes, even when it is not yes today.

**Boundary.** Not `TYPE-5`: an enum is one axis of values, while a discriminated union is several states each carrying different data — if every branch needs its own fields, an enum is not enough and the situation is `TYPE-5`. Not `declare enum`: an ambient declaration describes something that already exists elsewhere and emits nothing, so it is outside this code.

**Common business situations.** Order status · transaction kind · AI model provider · notification channel · error classes grouped for retry · user role · the sort order of a list query.

## `TYPE-5` — a discriminated union beats a bag of booleans

**Situation.** One situation with several states, described by flags: `isPending`, `isGraded`, `isFailed`, plus `score?`.

**What it emits in source.** A union of the states that actually exist, separated by a discriminant, so an unreal state cannot be written down. Four booleans admit sixteen combinations. Perhaps three of them exist. The other thirteen compile cleanly, and one of them is what a caller passes at four in the morning. `isGraded && isFailed` compiles. `isGraded` without `score` compiles. Neither is a real business state, but the compiler has no way to know — it was never told. This is the one code in the module that forbids nothing: it switches the compiler further on instead of stopping somebody from switching it off.

**Recognition signs.** Two or more booleans describing **one** thing. An optional field that "only exists when that other flag is set" — and that fact lives only in a comment. Code that reads `if (a && !b && c)` to reconstruct a state that should have had a name. A comment explaining which combinations are valid: that comment is the type, written in the wrong place. Ask: list the states that really exist, then count the states the current shape allows. The difference is error surface created on purpose.

**Boundary.** Not `TYPE-4`: see above. Not several independent booleans: this code is about several booleans describing one situation; two booleans answering two independent questions are two booleans. Not a transport type: a schema-registered response class or a stored column cannot carry a union — the union lives on the internal result, the transport shape carries the flattened form, and the mapping happens once, in one place.

**Common business situations.** A grading result · the result of a sign-in step (challenge or session already issued) · payment status · a sync result (success / drift / broken) · the state of a background job · a model call result (content / blocked / out of quota).

## `TYPE-6` — a sanctioned exit is declared at the lane

**Situation.** Some places must be allowed to do what the law forbids. The clearest one: the spec family and the test tree may double cast, because building a deliberately wrong value is how a spec proves a closed API refuses it. Without this exit, the law itself cannot be tested.

**What it emits in source.** One declaration at the lane — a predicate in the rule, or a config entry — consulted once, from which every place the exit is in force is derivable. The problem was never that an exit exists; it is where the exit is written. Declared once at the lane, the exits are countable: read one function and you know every place it applies. Scattered as per-line `eslint-disable` comments, the exit stops existing and starts being a habit: nobody knows how many there are, nobody knows which are still needed, and the fiftieth is added because forty-nine were already there.

**Recognition signs.** An `eslint-disable-next-line` in product code for a rule belonging to this module. The same suppression line in three or more files — that is an undeclared lane. A product file that needs the test lane's exit: the file is in the wrong lane, the law is not wrong. Ask: if every suppression in the repository were deleted, could you still read off which places are allowed an exception? If not, the exit is in the wrong place.

**Boundary.** Not `TYPE-2`: `TYPE-2` says what is forbidden, `TYPE-6` says where the exemption is written. A spec that double casts is not a `TYPE-2` violation that was forgiven — it was never inside `TYPE-2`'s scope. Not a business exception: a closed exception listed under `Exceptions` is part of the law; a suppression is part of fatigue.

**Common business situations.** A spec building a collaborator missing methods · an e2e building a wrong payload to prove validation blocks it · a harness calling a real provider · a helper in the test tree building a fake entity · a fixture deliberately missing a required field.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the wrong value impossible to write; `enforced` means a lint rule published by `@starci/eslint-canon-be` catches it; `documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `TYPE-1` | `enforced` | `@typescript-eslint/no-explicit-any` — a standard rule NAMED in this law's `recommended` rather than reimplemented in it |
| `TYPE-2` | `enforced` | `no-double-cast` (export `noDoubleCast`) |
| `TYPE-3` | `enforced` | `no-inline-param-type` (export `noInlineParamType`) |
| `TYPE-4` | `enforced` | `no-const-enum` (export `noConstEnum`) |
| `TYPE-5` | `documented` | — |
| `TYPE-6` | `documented` | — |

**Four enforced, two documented, none unrepresentable.**

Three of the four enforced rows are house-written rules; the fourth, `TYPE-1`, is held by a rule every TypeScript repository already has. The law names it in `recommended` instead of writing a second implementation of it, and the choice is deliberate: a duplicate of a rule everybody has is a maintenance cost with no gain, and `no-explicit-any` is the one whose absence would make the other three decorative — `any` reintroduces every problem they forbid, in one keyword.

Two documented rows, and they are documented for opposite reasons. `TYPE-5` is unenforceable in principle: deciding whether four booleans describe ONE situation or four genuinely independent facts requires knowing what the code means, and a rule that guessed would fire on every struct with two flags in it. `TYPE-6` is unenforceable in practice: a rule cannot tell a suppression that is standing in for a missing lane declaration from one that is honestly local, because the two are the same three tokens.

`unrepresentable` is empty, and the empty column is the most informative cell in this table. `TYPE-5` is the code that ASKS for the `unrepresentable` tier — a discriminated union is exactly the device that moves a business rule from prose into the type system — and it cannot itself be held there, because no type can forbid you from declaring the wrong type. That is the recursion this module lives inside, and it is why `TYPE-5` is prose with the failure attached rather than a rule.

Each enforced row is also narrower than its code. `no-double-cast` sees one expression, so a laundering split across two statements passes. `no-inline-param-type` visits function declarations, function expressions and arrows, so an inline type in a type-position signature passes. `no-explicit-any` does not visit an unchecked cast, so `TYPE-1`'s second half — that the narrowing actually narrows — has no rule at all. A tier table that rounds "partly" up to "enforced" is the same lie this law is about.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `TYPE-1` | `modules/ai/balancer/utils/classify-ai-error.ts` → `extractStatus`, `extractRetryAfterMs`, `classifyAiError` | Three functions that take `error: unknown` from a boundary nobody controls and narrow with `typeof` and `instanceof` before reading a property. Read what the signature promises a caller versus what an `any` there would have promised |
| `TYPE-1` | `modules/ai/ping/utils/to-error-message.ts` → `extractResponseDetail` | The narrowing done the expensive way on purpose: each nesting level is `typeof`-checked before the next is read. This is what `TYPE-1` costs when the shape is genuinely unknown, and the cost is the point |
| `TYPE-1` | `eslint.config.mjs` → `'@typescript-eslint/no-explicit-any': 'error'` | The rule at `error`, with the law cited on the same line. Grep `: any` across `src` and read every hit: they are all the English word inside a comment. Zero declarations is the measurement that lets the level be `error` rather than `warn` |
| `TYPE-2` | `modules/platform/cookie/types/cookie.ts` → `CookieRequestLike` | The repair, with the reason attached: a minimal structural interface that exists so two seams do not double-cast a header bag into a full framework `Request`. Read the doc comment — it names the double cast it was written to avoid |
| `TYPE-2` | `@starci/eslint-canon-be` → the `TYPE-2` twin test's `valid` list | The boundary of the rule stated as executable cases: a lone `as unknown` is honest widening, a lone narrowing cast is a different question, and only the pair landing back on a concrete type is the overrule |
| `TYPE-3` | `modules/ai/types/grading-lane-validation-params.ts` → `ValidateGradingLaneParams`, consumed destructured in `modules/ai/grading-lane-validation.service.ts` | The named type and its call site in two files. The interesting part is the third reference in the service: `NonNullable<ValidateGradingLaneParams["provider"]>`. An inline type cannot be indexed like that, so this line is what `TYPE-3` bought |
| `TYPE-3` | `modules/platform/cookie/types/cookie.ts` → `AttachHttpOnlyCookieParams`, `AttachReadableCookieParams`, `ClearCookieParams` | Three params types in one `types/` file, one per operation, each documented per field. Read them as the shape a module's `types/` folder takes when the law is followed rather than argued about |
| `TYPE-4` | `modules/databases/postgresql/primary/enums/mock-interview-kind.ts` → `normalizeMockInterviewKind` | `Object.values(MockInterviewKind)` inside a coercion that turns a stored string back into a known member. A `const enum` has no object to call `Object.values` on, so this function could not be written at all |
| `TYPE-4` | `modules/init/seeders/shared/extracts/coerce-md-scalar.service.ts` → `toNullableEnum`, `toRequiredEnum` | The strongest form: the enum is passed AS A VALUE, `enumObject: TEnum`, and matched by key and then by value. Every caller of this helper is a thing a `const enum` makes impossible |
| `TYPE-4` | `tsconfig.json` → `"isolatedModules": true` | The compiler setting that turns `TYPE-4`'s last clause from an opinion into a build error. The law's claim about the isolated-modules boundary is checkable here in one line |
| `TYPE-5` | `features/api/core/graphql/mutations/keycloak/sign-in/init/graphql-types/response.ts` → `SignInInitCommandResult` beside `SignInInitData` | Both halves of the code in one file. The internal result is a `kind`-discriminated union where a mixed challenge/session state does not compile; the transport class beside it has every field optional, because the wire format cannot carry a union. Read the pair as the exception's exact boundary, not as an inconsistency |
| `TYPE-6` | `@starci/eslint-canon-be` → `isTestFile` | The exit itself: one predicate, one regex over the spec suffixes plus the test tree, consulted once at rule construction. Every place the exit is in force is derivable from this function, which is the property a per-line suppression destroys |
| `TYPE-6` | `features/api/core/graphql/mutations/keycloak/sign-in/init/sign-in-init.handler.spec.ts` → the `jest.Mocked<Pick<…>>` casts | The exit in use, and the reason for it: a spec builds a deliberately partial collaborator to prove the handler only touches the methods it declares. Note what is NOT here — no `eslint-disable` comment on any of those lines |

Every code is anchored. None is unanchored.

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

## Rules

1. `any` does not appear in a declaration, a cast target or a generic argument.
2. A value of unstated shape enters as `unknown` and is narrowed exactly once, visibly.
3. A cast pair through `unknown` does not exist outside the test lanes.
4. A destructured parameter's type has a name and a home a second caller can import from.
5. An enum keeps its runtime object.
6. A situation with several states is a union of those states, not a product of flags.
7. A sanctioned exit is declared at the lane, once, and is derivable from that declaration alone.
8. Every boundary crossing resolves to exactly one code. No value is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The test lanes may build a deliberately wrong value.** `TYPE-2` does not apply to the spec family or the test tree: constructing a value the production type refuses is how a spec proves a closed API refuses it. The exit is the lane, not the line — it is declared once, in the rule, and a per-line suppression inside a lane that already has the exit means the file is in the wrong lane.
- **Widening on the way out is honest.** `TYPE-2` forbids the PAIR. A lone `as unknown` throws information away and claims nothing, which is the opposite failure mode; a lone narrowing cast is a different and smaller question that this code does not answer.
- **A positional parameter is not a destructured one.** `TYPE-3` governs the destructured form, because that is where a shape gets retyped by the next caller. An inline type on a positional parameter is a smaller problem with a different remedy and is deliberately outside this code.
- **A transport type cannot carry a union.** `TYPE-5` does not fire on a wire or persistence shape whose format has no sum type — a schema-registered response class, a single stored column. The union lives on the internal result, the transport shape carries the flattened form, and the mapping between them happens once, in one place, where it can be read.
- **A version modelled as data is not a flag.** `TYPE-5` does not fire on independent booleans that answer independent questions. The code is about several booleans describing ONE situation; two booleans describing two situations are two booleans.
- **An ambient declaration is not a declaration.** `TYPE-4`'s rule deliberately passes `declare enum`, because an ambient enum describes something that already exists elsewhere rather than emitting anything.

## Output

One block per file the accepted shape produces.

```text
value: <the thing crossing the boundary>
origin: <parsed body | provider SDK | stored column | internal caller>
situation: <TYPE-1 … TYPE-6>
shape: <the declared type after the line>
narrowing: <the guard that stands behind the claim, or none>
lane: <product | spec | test tree>
reason: <what the compiler still knows after this line, and what it would have lost>
```

## Worked example

**The accepted shape.** A grading capability is accepted: an operation validates a grading lane from a set of arguments, calls a model provider, and returns a grading result that is either pending, graded with a score, or failed.

The shape states the arguments, the provider call and the three states. It does not state where the provider's error object comes from or what shape it has, whether a second caller of the arguments exists, whether anything iterates the provider set, or which lane each file sits in. Those are not resolved by the shape, and each is gathered as evidence before a code is assigned.

```text
value: the grading lane arguments
origin: internal caller
situation: TYPE-3
shape: ValidateGradingLaneParams, declared in the module's types/ folder and destructured at the signature
narrowing: none
lane: product
reason: the type has a name a second caller can import and index — NonNullable<ValidateGradingLaneParams["provider"]> is writable, which an inline type cannot be. It is not TYPE-1 because an inline type here was still fully checked; the fact that excludes TYPE-1 is that nothing was unchecked, only unreferenceable
```

```text
value: the error thrown by the model provider
origin: provider SDK
situation: TYPE-1
shape: unknown at entry, narrowed to a status and a retry hint before any property is read
narrowing: typeof and instanceof checks, one visible narrowing before the first concrete read
lane: product
reason: after the narrowing the compiler still knows the read is guarded; an any here would have left every derived value unchecked. It is not TYPE-2 because no cast lands on a concrete type — the fact that excludes TYPE-2 is that nothing here claims to be T
```

```text
value: the model provider identifier
origin: stored column
situation: TYPE-4
shape: a plain enum that keeps its runtime object
narrowing: a coercion that matches a stored string against Object.values of the enum
lane: product
reason: the stored value is reverse-mapped back to a member and the enum is passed as a value into the coercion, which a const enum makes impossible. It is not TYPE-5 because the providers are one axis of values with no per-branch data — the fact that excludes TYPE-5 is that no branch carries fields the others do not
```

```text
value: the grading result
origin: internal caller
situation: TYPE-5
shape: a kind-discriminated union of pending, graded and failed
narrowing: the discriminant
lane: product
reason: the three states that exist are the only three that can be written; a bag of isPending / isGraded / isFailed plus an optional score would have compiled in thirteen states that do not exist. It is not TYPE-4 because graded carries a score the other branches do not — the fact that excludes TYPE-4 is per-branch data
```

```text
value: a deliberately partial collaborator built to prove the handler only touches what it declares
origin: internal caller
situation: TYPE-6
shape: jest.Mocked<Pick<…>>, with no eslint-disable comment on any line
narrowing: none
lane: spec
reason: the exit is declared once at the lane by the rule's isTestFile predicate, so every place it is in force is derivable from that one function. It is not TYPE-2 because the spec lane was never inside TYPE-2's scope — the fact that excludes TYPE-2 is the lane, not the line
```

## Scope

This rule holds for any code of this kind in this stack: any back end compiled by a structural type system with an escape hatch in it, written as ordinary TypeScript in a NestJS-shaped application. It names no product, no repository, no feature and no course. The four rule ids are the only proper nouns in the law itself, because a rule id is an enforcement identity and a renamed rule cannot be cited in a config. Repository paths appear in `Anchor` and nowhere else — an anchor is required to be a real path, which is exactly what makes it an anchor.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published name, plugin prefix and all, because that is the exact string a build log prints and a disable comment carries. A citation that cannot be pasted into a search is not a citation. What the ban above forbids is PROSE and EXAMPLES that need a product to be understood — never an identifier somebody will read in a failure and have to look up.
