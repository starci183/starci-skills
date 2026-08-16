---
id: be-lints-authorization-index
title: INDEX.md
slug: /be/lints/authorization
sidebar_label: authorization
sidebar_position: 0
description: What the single published authorization lint rule can actually see, and the ways of writing it does not catch.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `authorization`

## Law

The law lives in [`patterns/authorization.md`](../../canon/patterns/authorization.md) and carries six
codes, `AUTHZ-1` through `AUTHZ-6`. This module documents something narrower and more useful:
**which of those codes a machine holds, by what mechanism, and where the mechanism ends.**

One code of the six is a shape a parser can see. The other five turn on which row is being reached
and what owning it means — and a file is not where that lives. `AUTHZ-3`, `AUTHZ-4` and `AUTHZ-5`
each ask a question about a loaded record; a rule aimed at them would fire on shape rather than on
meaning, and a rule that fires on shape is one authors learn to disable. `AUTHZ-1` was measured and
deliberately left alone for the opposite reason: a handler restating its own identity precondition
looks like duplication and is not, so a rule refusing it would fire on the majority of correct
handlers in the tree.

What remains checkable inside one file is the door: a method that READS the authenticated identity
while nothing on that method or its class establishes it. That failure looks like nothing at all —
the parameter still says `user`, the handler still receives one — and the only missing piece is the
line that proved it belonged to the caller.

So the honest statement of enforcement is: **five codes have no machine at all, and one has a machine
with known holes in it.** Both halves matter. A code with no rule is known to be unenforced and gets
read by a human. A rule believed to be airtight, that is not, buys silence and pays for it with a
false sense of coverage.

## Rules

The identity of a rule is its published name — the string a build log prints, a disable comment
names, and a config file sets a severity on. There is no second numeric identifier.

| Rule | Code it enforces | What it reports |
|---|---|---|
| `identity-needs-guard` | `AUTHZ-2` | A class method takes a parameter decorated with one of three identity decorators while neither the method nor its immediate class carries a decorator named `UseGuards` (`unguarded`). The report is attached to the parameter, and the message names the identity decorator it found |

The published rule maps to a code. The gap runs the other way: `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4`,
`AUTHZ-5` and `AUTHZ-6` have no rule, and no rule here claims them. That is recorded in `audit.md`
rather than patched over with an invented mapping.

The severity the module asks for, as shipped:

| Rule | Recommended severity | Why |
|---|---|---|
| `identity-needs-guard` | `error` | The shape is narrow, the offence is silent at runtime, and the measured count is zero |

A rule ships at `error` only once its measured count is zero. Shipping at `error` with debt
outstanding blocks every commit that touches an offender, which is how a rule gets disabled
wholesale instead of paid down.

## Detection

Read this table before the next one. What a rule can be dodged by follows directly from what it
looks at.

| Rule | Mechanism |
|---|---|
| `identity-needs-guard` | `MethodDefinition` only — one visitor, no other node type, and **`context.filename` is never read**, so the rule exists in every file the config lints. For each method it walks `node.value.params`; a parameter of type `TSParameterProperty` is unwrapped to its inner `parameter` as a fallback carrier, and the decorator list taken is `parameter.decorators`, else the carrier's, else empty. A decorator's name is read from a bare `Identifier` expression, or from a `CallExpression` whose `callee.type` is `Identifier`; any other expression shape yields `undefined`. The method is a candidate when some parameter decorator name is a member of the closed literal set `{ KeycloakGraphQLUser, KeycloakUser, CurrentUser }`. It is then cleared if any decorator on the method is named exactly `UseGuards`, or — reaching the class through `node.parent` (the `ClassBody`) and that node's `parent` — if any decorator on that class node is named exactly `UseGuards`. Otherwise it reports `unguarded` at the parameter node |

Two properties of that mechanism decide everything below. **Identity is recognised only as a
parameter decorator, by three exact strings.** And **a guard is recognised only as a decorator
spelled `UseGuards`, by presence — never by what it applies.**

## Escape Hatches

### Closed

Ways of writing that a reader might expect to slip past, and why they do not.

| The dodge that fails | Why it fails |
|---|---|
| Renaming or moving the file: `door.ts`, `orders.controller.ts`, a barrel, a folder nobody expected | There is no filename gate at all. Filename is the cheapest thing in a repository to change, and this rule does not spend anything on it |
| `@UseGuards` written without parentheses | The decorator reader accepts a bare `Identifier` as well as a `CallExpression`, so both spellings clear the check — and both spellings are refused as evidence nowhere |
| Burying the guard under `@Mutation()`, `@Injectable()` and four others | The check is `.some()` over every decorator on the method, then over every decorator on the class. Order and position are not consulted |
| `@UseInterceptors(TransformInterceptor)` in place of a guard | Only the exact name `UseGuards` clears the method. An interceptor sits in the same stack and reads the same way, and it still reports |
| Renaming the parameter from `user` to `caller`, `me`, `principal` | The parameter's name is never read. The decorator on it is |
| Moving the identity decorator to second position: `execute(@Args("request") request: R, @CurrentUser() user: U)` | Every parameter is walked, and every decorator on each is walked |
| A constructor parameter property: `constructor(@CurrentUser() private readonly user: U)` | `TSParameterProperty` is handled, and a constructor is an ordinary `MethodDefinition`. It reports |
| Destructuring the identity: `execute(@CurrentUser() { id }: U)` | The decorator lives on the parameter node whatever pattern it holds, so an `ObjectPattern` changes nothing |
| `static`, `private`, `protected`, `async`, `override` on the method | None of them are consulted. The visitor is keyed on node type, not on modifiers |
| A guard on a *different* method of the same class | The clearing check runs per method, and the class-level check reads the class's own decorators — not a sibling method's |
| Two identity parameters on one method | The first found decides; the method reports once. Silencing one parameter does not silence the method |

### Open

Ways of writing this rule genuinely does **not** catch. Each row is a real violation of `AUTHZ-2`
that the machine reports nothing about.

| What slips through | Why the mechanism misses it |
|---|---|
| Reading the identity off the request instead of a parameter decorator — `@Context() ctx` then `ctx.req.user`, or `@Req() req` then `req.user` | The rule's whole notion of "reads an identity" is one of three parameter decorators. A door reaching into the context reads exactly the same unproven identity, and nothing in the rule looks at a method body. **This is the largest hole, and it is the spelling a developer reaches for when the decorator feels heavyweight** |
| The helper hop: the door takes `@Context() ctx`, and a private method on the same class pulls the user out of it | Same gap, one level further away. The rule never follows a call, so the door reports nothing and the helper has no decorator to find |
| A namespaced decorator: `@auth.CurrentUser()` after `import * as auth from …` | `decoratorName` returns a name only for an `Identifier` or an `Identifier` callee. A `MemberExpression` callee yields `undefined`, which is not in the set, so the method is not even a candidate |
| A renamed import: `import { CurrentUser as Who }` then `@Who()` | The set is compared against the local spelling at the call site, never against what the import resolves to. Rename the import and the rule turns off for that file |
| Any fourth identity decorator — a wrapper the tree adds later, `@AuthUser()`, `@Principal()`, `@Viewer()` | The set is a closed literal of three strings. One new identity decorator makes every door under it invisible, and nothing announces that |
| `@UseGuards()` with no arguments at all | Verified silent. Presence of the decorator is the entire claim; the argument list is never read |
| `@UseGuards(RolesGuard)`, `@UseGuards(ThrottlerGuard)`, `@UseGuards(AlwaysTrueGuard)` — a guard that does not authenticate | Same reason. "Carries a guard" and "identity was established" are different facts, and only the first is held. A guard that assumes an earlier authentication satisfies this rule completely |
| A locally declared or locally re-exported `UseGuards` that does nothing | The check is the spelling. A no-op function of that name clears every door in the file |
| The class-level guard as a permanent blanket: one `@UseGuards(...)` on the class, then a method added a year later with a different subject | Once the class carries the decorator, every method on it is exempt forever, with nobody re-deciding. This is also where `AUTHZ-6` quietly fails — an operator door and a viewer door under one class-level guard are one guard for two subjects, and the rule is satisfied |
| A door that is not a class method — a route registered programmatically, a handler assembled by a factory, a resolver built from a map | The single visitor is `MethodDefinition`. Anything that is not one is outside the rule's world entirely |
| Everything `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4`, `AUTHZ-5` and `AUTHZ-6` forbid | Deliberately unenforced. Ownership decided from request ids, a refusal that leaks a private row's existence, an entitlement row mistaken for the entitlement, and one guard serving three subjects are all silent here — and each is a worse outage than the one code that is held |

Two of these are the same defect wearing different clothes and are worth naming once: **the rule
matches strings that a rename changes**, and **it counts a decorator's presence rather than its
effect.** Neither is sabotage. Both are what ordinary tidying up looks like.

## Inputs

| Input | Evidence required |
|---|---|
| node type | `MethodDefinition`. A class field, an object method, a plain function or a programmatic registration is not one |
| parameters | `node.value.params`, with `TSParameterProperty` unwrapped to its inner parameter as a fallback |
| parameter decorators | The identifiers as spelled at the parameter, not as imported and not as they resolve |
| method decorators | The identifiers as spelled at the method |
| class decorators | Read through `node.parent.parent` — the immediate class only. No base class, no module, no application-level registration |
| filename | Not consulted. The rule applies wherever the config points it |

## Invariants

- A rule's identity is its published name. No numeric code is minted for a rule.
- A rule reports only what its mechanism can see, and this shelf states that boundary rather than the
  law's ambition.
- The rule does not read the filesystem, resolve an import or follow a call. An answer that depended
  on any of those could not be reproduced from the file under review.
- Presence of the guard decorator is the claim the rule makes. Whether the guard authenticates is
  outside it, and this document never implies otherwise.
- A rule ships at `error` only at a measured count of zero.
- An unenforced code is recorded as unenforced. It is never assigned to the nearest rule.
- A report on correct code is a defect of the same seriousness as a missed violation, because it buys
  the disable comment that hides the next real one.

## Exceptions

Each exemption below is deliberate and closed.

- **A door reading no identity is not reported.** A public query has nothing to establish, and
  treating it as a finding is how a rule gets disabled wholesale.
- **A guard on the class exempts every method on it.** Refusing this would push authors to repeat the
  decorator on every method, which is not what the tree does. The cost is the blanket recorded above.
- **No filename gate.** The rule is deliberately as wide as the config that loads it, including files
  nobody thought of as doors.
- **`AUTHZ-1` is deliberately unenforced.** A handler owns its own preconditions; a rule refusing the
  restated identity check would contradict canon rather than hold it.
- **`AUTHZ-3`, `AUTHZ-4` and `AUTHZ-5` are deliberately unenforced.** Each is decided against a loaded
  row, and no parser knows which row a handler is reaching for or what owning it means.

## Output

```text
rule: identity-needs-guard
code: AUTHZ-2
mechanism: MethodDefinition · identity parameter decorator name · UseGuards on method or class
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

## Load Policy

Read this file first. Read `vi.md` for what the rule catches and why the law deserves a machine,
`example.md` for code that fires and code that does not — including code that slips through — and
`audit.md` only while reviewing enforcement coverage.

## Scope

This module documents enforcement, not product. Every example is ordinary code in an ordinary folder,
and no prose here names a product, a repository or a component library. The rule name, the plugin
namespace it ships under, and the four decorator identifiers the rule matches as literal strings are
things that appear in build output and in the rule's own source, so they are reproduced verbatim;
that is the one exemption, and it does not extend to prose.

## Version Rule

Increment all five records by `0.01` for an accepted change to what is documented here, and record it
in `changelog.md`. A rule added to or removed from the source is such a change, and so is a change to
the identity-decorator set.
