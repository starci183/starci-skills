# Authorization

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
which published rule fired, on which node, which law code that maps to, and the open hatch that would
have hidden the same failure. This module chooses no authorization design. It refuses one, and it must
be able to point at the parameter it refuses on.

## Law

A door that **reads** the authenticated identity carries the guard that establishes that identity.
That failure looks like nothing at all — the parameter still says `user`, the handler still receives
one — and the only missing piece is the line that proved it belonged to the caller.

The law states six codes, `AUTHZ-1` through `AUTHZ-6`. **One of them has a rule.** That is not an
accident of coverage. One code of the six is a shape a parser can see; the other five turn on which
row is being reached and what owning it means, and a file is not where that lives. So the honest
statement of enforcement is: **five codes have no machine at all, and one has a machine with known
holes in it.** Both halves matter. A code with no rule is known to be unenforced and gets read by a
human. A rule believed to be airtight, that is not, buys silence and pays for it with a false sense of
coverage.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `identity-needs-guard` | `AUTHZ-2` | `unguarded` — a class method takes a parameter decorated with one of three identity decorators while neither the method nor its immediate class carries a decorator named `UseGuards`. The report is attached to the parameter, and the message names the identity decorator it found |

The identity of a rule is its published name — the string a build log prints, a disable comment names,
and a config file sets a severity on. There is no second numeric identifier. The published severity is
`error`; a rule ships at `error` only once its measured count is zero, and this one's is zero.

`AUTHZ-1` (a handler owns its own preconditions, and identity is one of them), `AUTHZ-3` (ownership is
decided from the loaded row, never from the request), `AUTHZ-4` (a refusal that would reveal a private
row's existence answers not-found), `AUTHZ-5` (an entitlement is a state, and holding a row is not
holding the state) and `AUTHZ-6` (an operator is a different subject from a user) have **no rule at
all**. They are unenforced rather than covered, and a green run says nothing about any of them.
`AUTHZ-1` was measured and deliberately left alone: a handler restating its own identity precondition
looks like duplication and is not, so a rule refusing it would fire on the majority of correct handlers
in the tree.

## Reading a diff

1. **Decide scope first and record it.** This rule has no filename gate at all — `context.filename` is
   never read — so it exists in every file the config lints. A file the config does not point at is
   unjudged, not clean: no visitor was installed and the rule did not exist for it.
2. **Check the exemptions before reading nodes.** A door reading no identity is not a finding. A
   `UseGuards` on the immediate class exempts every method on it.
3. **Read the nodes.** Only `MethodDefinition`. For each one, walk `node.value.params`, unwrap
   `TSParameterProperty`, read each decorator's name, and stop the moment a decorator expression is
   neither a bare `Identifier` nor a `CallExpression` with an `Identifier` callee — that name is
   `undefined` and the method is not even a candidate.
4. **Emit one block per finding.** A method reports once even when it carries two identity parameters.
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure**, and say what
   the silence costs.
6. **Do not report what no rule watches.** Five of the six codes have no machine; a verdict that claims
   otherwise is wrong about the module.

## `identity-needs-guard` — AUTHZ-2

**What it reports.** One message, `unguarded`, at the parameter node, naming the identity decorator it
found.

**How it detects.** One visitor, `MethodDefinition`, and no other node type. For each method it walks
`node.value.params`; a parameter of type `TSParameterProperty` is unwrapped to its inner `parameter` as
a fallback carrier, and the decorator list taken is `parameter.decorators`, else the carrier's, else
empty. A decorator's name is read from a bare `Identifier` expression, or from a `CallExpression` whose
`callee.type` is `Identifier`; any other expression shape yields `undefined`. The method is a candidate
when some parameter decorator name is a member of the closed literal set
`{ KeycloakGraphQLUser, KeycloakUser, CurrentUser }`. It is then cleared if any decorator on the method
is named exactly `UseGuards`, or — reaching the class through `node.parent` (the `ClassBody`) and that
node's `parent` — if any decorator on that class node is named exactly `UseGuards`. Otherwise it
reports `unguarded` at the parameter.

**What it cannot see.** An identity that arrives any way other than those three decorators: `@Context()
ctx` then `ctx.req.user`, `@Req() req` then `req.user`, or the same read pushed one hop into a private
helper on the class — the rule never looks at a method body and never follows a call. A namespaced
decorator, `@auth.CurrentUser()`, whose `MemberExpression` callee yields `undefined`. A renamed import,
`import { CurrentUser as Who }` then `@Who()`, because the set is compared against the local spelling at
the call site and never against what the import resolves to. Any fourth identity decorator the tree adds
later. On the other side, it cannot see whether a guard guards: `@UseGuards()` with no arguments is
verified silent, and so is a guard that does not authenticate. It also reports on correct code in four
measured shapes — `@nest.UseGuards(G)`, a composed `@Authenticated()` that wraps
`applyDecorators(UseGuards(...))`, a guard placed only on a **base class** while the door is declared on
the subclass, and a request-scoped provider taking `@CurrentUser()` in its constructor without being a
door. Each of those buys an `eslint-disable`, and the disable comment is what hides the next real one.

**Boundary.** The rule holds one fact: a door that reads an identity carries a decorator spelled
`UseGuards`. Whether that guard authenticates, which row the handler then reaches, who owns it, what a
refusal leaks and which subject is behind the door are `AUTHZ-3` through `AUTHZ-6`, and no machine here
holds any of them.

## Detection

| Part | Mechanism |
|---|---|
| path gate | There is none. **`context.filename` is never read**, so the rule exists in every file the config lints |
| the walker | One visitor, `MethodDefinition`. A class field, an object method, a plain function or a programmatic registration is not one and is outside the rule's world entirely |
| the parameter reader | `node.value.params`, with `TSParameterProperty` unwrapped to its inner `parameter` as a fallback carrier; decorators are `parameter.decorators`, else the carrier's, else empty |
| the decorator reader | A bare `Identifier` expression, or a `CallExpression` whose `callee.type` is `Identifier`. Any other expression shape yields `undefined` |
| the identity set | The closed literal `{ KeycloakGraphQLUser, KeycloakUser, CurrentUser }`, compared against the spelling at the call site |
| the clearing check | `.some()` over the method's decorators for the exact name `UseGuards`, then over the class's own decorators reached through `node.parent.parent` |
| reaching outside the file | Nothing. No filesystem read, no import resolution, no call following |

Two properties of that mechanism decide everything below. **Identity is recognised only as a parameter
decorator, by three exact strings.** And **a guard is recognised only as a decorator spelled
`UseGuards`, by presence — never by what it applies.**

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| Renaming or moving the file: `door.ts`, `orders.controller.ts`, a barrel, a folder nobody expected | There is no filename gate at all. Filename is the cheapest thing in a repository to change, and this rule does not spend anything on it |
| `@UseInterceptors(TransformInterceptor)` in place of a guard | Only the exact name `UseGuards` clears the method. An interceptor sits in the same stack and reads the same way, and it still reports |
| Renaming the parameter from `user` to `caller`, `me`, `principal` | The parameter's name is never read. The decorator on it is |
| Moving the identity decorator to second position: `execute(@Args("request") request: R, @CurrentUser() user: U)` | Every parameter is walked, and every decorator on each is walked |
| A constructor parameter property: `constructor(@CurrentUser() private readonly user: U)` | `TSParameterProperty` is handled, and a constructor is an ordinary `MethodDefinition`. It reports |
| Destructuring the identity: `execute(@CurrentUser() { id }: U)` | The decorator lives on the parameter node whatever pattern it holds, so an `ObjectPattern` changes nothing |
| `static`, `private`, `protected`, `async`, `override` on the method | None of them are consulted. The visitor is keyed on node type, not on modifiers |
| A guard on a *different* method of the same class | The clearing check runs per method, and the class-level check reads the class's own decorators — not a sibling method's |
| Two identity parameters on one method | The first found decides; the method reports once. Silencing one parameter does not silence the method |

Two spellings clear the check rather than firing, and both are legitimate: `@UseGuards` written without
parentheses passes because the decorator reader accepts a bare `Identifier` as well as a
`CallExpression`, and burying the guard under `@Mutation()`, `@Injectable()` and four others passes
because the check is `.some()` over every decorator — order and position are not consulted.

**Open** — shipped blindness. A verdict must not claim these were judged.

| What slips through | What it costs |
|---|---|
| **Reading the identity off the request instead of a parameter decorator** — `@Context() ctx` then `ctx.req.user`, or `@Req() req` then `req.user` | The rule's whole notion of "reads an identity" is one of three parameter decorators, and nothing in it looks at a method body. This is the largest hole, and it is the spelling a developer reaches for when the decorator feels heavyweight |
| **The helper hop** — the door takes `@Context() ctx`, and a private method on the same class pulls the user out of it | Same gap, one level further away. The rule never follows a call, so the door reports nothing and the helper has no decorator to find |
| **A namespaced decorator**, `@auth.CurrentUser()` after `import * as auth from …` | A `MemberExpression` callee yields `undefined`, which is not in the set, so the method is not even a candidate |
| **A renamed import**, `import { CurrentUser as Who }` then `@Who()` | Rename the import and the rule turns off for that file |
| **Any fourth identity decorator** — `@AuthUser()`, `@Principal()`, `@Viewer()` | The set is a closed literal of three strings. One new identity decorator makes every door under it invisible, and nothing announces that |
| **`@UseGuards()` with no arguments at all** | Verified silent. Presence of the decorator is the entire claim; the argument list is never read |
| **`@UseGuards(RolesGuard)`, `@UseGuards(ThrottlerGuard)`, `@UseGuards(AlwaysTrueGuard)`** — a guard that does not authenticate | "Carries a guard" and "identity was established" are different facts, and only the first is held. A guard that assumes an earlier authentication satisfies this rule completely |
| **A locally declared or locally re-exported `UseGuards` that does nothing** | The check is the spelling. A no-op function of that name clears every door in the file |
| **The class-level guard as a permanent blanket** — one `@UseGuards(...)` on the class, then a method added a year later with a different subject | Every method on that class is exempt forever, with nobody re-deciding. This is also where `AUTHZ-6` quietly fails: an operator door and a viewer door under one class-level guard are one guard for two subjects, and the rule is satisfied |
| **A door that is not a class method** — a route registered programmatically, a handler assembled by a factory, a resolver built from a map | The single visitor is `MethodDefinition`. Anything that is not one is outside the rule's world entirely |
| **Everything `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4`, `AUTHZ-5` and `AUTHZ-6` forbid** | Deliberately unenforced. Ownership decided from request ids, a refusal that leaks a private row's existence, an entitlement row mistaken for the entitlement, and one guard serving three subjects are all silent here — and each is a worse outage than the one code that is held |

Two of these are the same defect wearing different clothes and are worth naming once: **the rule matches
strings that a rename changes**, and **it counts a decorator's presence rather than its effect.** Neither
is sabotage. Both are what ordinary tidying up looks like.

## Rules

1. A rule's identity is its published name. No numeric code is minted for a rule.
2. A rule reports only what its mechanism can see, and this module states that boundary rather than the
   law's ambition.
3. The rule does not read the filesystem, resolve an import or follow a call. An answer that depended on
   any of those could not be reproduced from the file under review.
4. Presence of the guard decorator is the claim the rule makes. Whether the guard authenticates is
   outside it, and this document never implies otherwise.
5. A rule ships at `error` only at a measured count of zero.
6. An unenforced code is recorded as unenforced. It is never assigned to the nearest rule.
7. A report on correct code is a defect of the same seriousness as a missed violation, because it buys
   the disable comment that hides the next real one.

## Exceptions

Each exemption below is deliberate and closed.

- **A door reading no identity is not reported.** A public query has nothing to establish, and treating
  it as a finding is how a rule gets disabled wholesale. This releases every method with no parameter
  decorator in the identity set.
- **A guard on the class exempts every method on it.** Refusing this would push authors to repeat the
  decorator on every method, which is not what the tree does. This releases every method of a class
  carrying `UseGuards`, and the cost is the blanket recorded above.
- **No filename gate.** The rule is deliberately as wide as the config that loads it, including files
  nobody thought of as doors. This releases nothing and widens everything.
- **`AUTHZ-1` is deliberately unenforced.** A handler owns its own preconditions; a rule refusing the
  restated identity check would contradict canon rather than hold it. This releases every handler-level
  identity check.
- **`AUTHZ-3`, `AUTHZ-4` and `AUTHZ-5` are deliberately unenforced.** Each is decided against a loaded
  row, and no parser knows which row a handler is reaching for or what owning it means. This releases
  every ownership, leak-shaped refusal and entitlement decision.
- **`AUTHZ-6` is deliberately unenforced.** The subject behind a door is a business fact, not a
  syntactic shape. This releases every operator-versus-user distinction.

## Output

One block per finding:

```text
rule: identity-needs-guard
code: AUTHZ-2
mechanism: MethodDefinition · identity parameter decorator name · UseGuards on method or class
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

A clean file — one the config lints, whose every identity-reading method is cleared by `UseGuards` on
itself or on its class — emits one block with `verdict: silent` and the `hatch` line filled in with the
open hatch that would have produced the same silence, or `none found`. There is no out-of-scope file for
this module: with no filename gate, every file the config points at is judged. A file the config does not
point at emits no block at all, and is unjudged rather than clean.
