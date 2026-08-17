---
title: Transport
---

# Transport

## LOADS

None.


## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, on which decorator node, what route
and what evidence decided it, which law code that maps to, and the open hatch that would have hidden
the same failure. This module chooses no transport. It refuses one, and it must be able to point at
the decorator it refuses on.

## Law

The law this module enforces settles one question about doors: **when is a door allowed not to be
GraphQL**, and where the answer lands on disk. A REST route is permitted only where GraphQL cannot
serve, the file itself must show which case it is, and a door lives beside the other doors whatever
its transport.

This module does not restate that law. It records **enforcement**: which of those sentences a machine
can hold, by what mechanism, and — the part nobody writes down — which ways of writing walk past the
machine untouched.

The law states **three** codes. **Two of them have a rule.** The source publishes exactly two rules in
its `rules` export and exactly two in its `recommended` export, and the two lists agree. The third
code is held by nothing, and that gap is recorded here rather than papered over.

The design worth naming is that **neither rule reads a registry.** The reason a REST door is permitted
is read off the route string, the file path and the file's own text — the same evidence a human reader
would use. That choice is deliberate and correct, and it is also the origin of almost every open hatch
below: evidence read as raw text cannot tell a use from a mention, so a comment justifies a door
exactly as well as an interceptor does.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `rest-door-needs-a-reason` | `TRANSPORT-2` | `unjustified` on every `@Controller` decorator in a file that shows none of the five accepted reasons — probe, external, bytes, machine, operator |
| `door-lives-in-features` | `TRANSPORT-3` | `wrongTree` on every `@Controller` decorator in a file whose normalized path contains `/src/modules/` |

`TRANSPORT-1` — the default door is GraphQL — is enforced by **no rule**. Nothing reports a door that
should have been a query; `rest-door-needs-a-reason` only asks a door that already exists to show a
reason, and it recognises exactly one decorator. A socket gateway or a broker consumer — doors by the
law's own definition — is invisible to both rules. `TRANSPORT-1` is unenforced, not covered, and a
green run says nothing whatever about it.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — for `door-lives-in-features` the path gate returns an **empty visitor**, so the rule did
   not exist for that file rather than clearing it.
2. **`door-lives-in-features` needs `/src/modules/` in the backslash-normalized filename**, with a
   leading slash before `src`. Any other tree, and the rule is switched off entirely.
3. **`rest-door-needs-a-reason` has no path gate at all.** It runs on every file it is handed, spec
   and fixture included, and reads the whole file text once in `create`.
4. **Check the exemptions next.** For `TRANSPORT-2` the exemption is the five reasons — probe,
   external, bytes, machine, operator — tested in order, first match wins. For `TRANSPORT-3` there is
   no exemption inside the rule at all.
5. **Read the decorator nodes.** Both rules require the decorator name to be the identifier
   `Controller`, bare or as the callee of a `CallExpression`. Any other shape and both go silent, so
   one namespace or one rename defeats both.
6. **Emit one block per finding**, and record which evidence decided it — route, path or file text.
7. **Write the hatch line whenever an open hatch would have hidden the same failure**, and never let a
   silence read as compliance.
8. **Do not report what no rule watches.** `TRANSPORT-1` has no machine, and neither has any door that
   is not an `@Controller`.

## `rest-door-needs-a-reason` — TRANSPORT-2

**What it reports.** One message, `unjustified`, at the decorator node itself, for every `@Controller`
in a file that shows none of the five accepted reasons:

| Reason | Evidence the rule demands |
|---|---|
| probe | route matching `/^healthz?$/`, **or** path matching `/\/health(z)?[./]/` |
| external | route **or** path matching `/webhook/i` |
| bytes | **file text** matching `/FileInterceptor\|FilesInterceptor\|AnyFilesInterceptor\|StreamableFile\|@Res\s*\(\|createReadStream/` |
| machine | route matching `/^(pods\|internal\|agents)\//` |
| operator | route matching `/^api\/ops(\/\|$)/`, **or** file text matching `/Operator[A-Za-z]*Guard\|ServiceToken\|OPS_TOKEN/` |

The five tests run **in order and return on the first hit**, so a message never states *which* reason
saved a door — it only goes silent.

**How it detects.** Reads `context.filename` and the **entire file text** via `sourceCode.getText()`
once in `create`. Visits `Decorator`; requires the decorator name to be the identifier `Controller`,
bare or as the callee of a `CallExpression` whose callee is an `Identifier`. Extracts the route only
when `arguments[0]` is a `Literal` whose `value` is a string, otherwise `""`. Then the five tests
above; no match reports the decorator node.

**What it cannot see.** The bytes and operator tests run over **raw file text**, which cannot tell a
use from a mention: a comment reading `// TODO: switch the export to StreamableFile later`, an unused
`import { FileInterceptor } from "…"` left behind after a refactor, or a `const AUDIT_KEYS =
["OPS_TOKEN"]` in a config map each justifies every `@Controller` in the file, permanently and
invisibly. Justification is computed per file, so two controllers in one file — one streaming bytes,
one reading JSON — share one reason and the second door never produces a message. The path is evidence
too: an ancestor directory literally named `webhooks/`, or any folder named `health/` or `healthz/`,
carries the carve-out to every controller beneath it, to any depth. The machine and operator reasons
are granted by a **string prefix** alone: `@Controller("internal/reports")` on an ordinary
authenticated read, or `@Controller("api/ops/anything")` on a door a normal viewer can reach, is
never checked for a session, and the guard is not consulted once the prefix has matched.
`@Controller("healthz")` returning business data passes, because what the handler answers with is
never inspected. `@Nest.Controller("api/theme")` is a `MemberExpression`; `import { Controller as
Route }` then `@Route("api/theme")`, and `const Door = Controller` then `@Door("api/theme")`, compare
as different names — all three make the rule silent. A raw handler registered outside a class —
`app.use(…)`, `server.get("/api/theme", …)` in the bootstrap file — presents no decorator to visit.
And `routeOf` is the sharpest edge in the source: a template literal, a constant, a concatenation or
the object form `{ path: "…" }` collapses to `""`, which matches none of the three route-shaped
reasons, so a lawful door is reported and the fastest repair a person reaches for is a disable
comment. Method-level route strings are never read at all.

**Boundary.** This rule asks only whether a door that already exists shows a reason. Where that door
sits on disk is `TRANSPORT-3`, and a perfect reason exempts nothing from it.

## `door-lives-in-features` — TRANSPORT-3

**What it reports.** One message, `wrongTree`, at the decorator node itself, for **every**
`@Controller` in a file whose path contains `/src/modules/`. There is no exemption inside: the route,
the file name, the class name and whether the door has a valid `TRANSPORT-2` reason are none of them
consulted.

**How it detects.** A file-level gate runs first: `/\/src\/modules\//` tested against the
backslash-normalized `context.filename`. A non-match returns an **empty visitor**, so that file is not
partially checked — it is not checked at all. On a match it visits `Decorator`, requires the same
`Controller` identifier, and reports unconditionally.

**What it cannot see.** Renaming the folder `modules/` to `services/`, `domains/` or
`capabilities/` leaves the layer intact and the door still parked in the wrong place, with the
rule gone: banning a **folder** is not banning a **layer**. Only `@Controller` is recognised, so
`@WebSocketGateway()`, `@MessagePattern(…)`, `@EventPattern(…)` and `@Resolver` under `modules/`
all pass clean — the law defines a door as anything the outside world can reach and names sockets and
broker consumers explicitly, so this rule's name promises more than it checks. The same three
decorator spellings that silence the other rule — `MemberExpression`, renamed import, assignment
through a variable — silence this one. The gate demands a **leading slash** before `src`, so a runner
that hands the rule a relative filename such as `modules/x.controller.ts` switches it off; an
absolute path always has the slash, which makes this narrow but real — a dependency on how the runner
names the file, not on where the file is.

**Boundary.** The rule also runs **wider than the law** in one place: the law binds `modules/**`
of the main application and exempts a separate application that keeps its own `modules/` folder,
while the gate matches every path containing `/src/modules/` regardless. That divergence is a
recorded finding, not a permission.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | Both rules normalize `\` to `/` before any path test, so a Windows path compares like every other path |
| file gate | `door-lives-in-features` gates on `/\/src\/modules\//`; a non-match returns an **empty visitor**. `rest-door-needs-a-reason` has no gate and runs everywhere |
| decorator identity | `node.expression`; its `type`; for a `CallExpression`, its `callee.type` and `callee.name`. An `Identifier` named `Controller` is the only accepted shape; a `MemberExpression` returns `null` |
| route helper | `routeOf` accepts `arguments[0]` as a `Literal` string and nothing else. Template literal, constant, concatenation and `{ path: "…" }` all collapse to `""`, and `""` matches none of the three route-shaped reasons. Method-level routes are never read |
| whole-file text | `sourceCode.getText()` read once in `create`, for the bytes and operator tests. This is the weakest evidence the module can produce |
| reach outside the file | None. Both are single-file: neither resolves an import, reads a type, or knows what another file declares. Both declare `schema: []` and take no options |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| A comment above the class saying `// this is a webhook receiver` | `webhook` is matched against the **route** and the **path** only, never the file text. A claim in prose buys nothing |
| Naming the class `WebhookController` while the route is `api/reports` and the file is `reports.controller.ts` | No rule reads the class name. Identity comes from the route string and the path |
| Moving an unjustified controller into `features/` | `rest-door-needs-a-reason` has no path gate for justification. Being in the right tree is a different sentence of the law, held by a different rule |
| A webhook controller left under `modules/` | The two rules are independent. A perfect `TRANSPORT-2` reason does not exempt anything from `TRANSPORT-3` |
| Nesting deeper: `modules/billing/http/controllers/x.controller.ts` | The gate matches the `/src/modules/` **pair anywhere in the path**, so extra depth changes nothing |
| A `@Controller` declared inside a spec or a fixture | Neither rule has a test-lane gate. A throwaway door in a test file reports like any other |
| `@Controller("ops/tenants")` intending an operator surface | The operator route test is anchored to `api/ops`. `ops/…` alone is not it, and the door reports unless the file also carries an operator-guard or service-token identifier |
| `@Controller("internal")` with no second segment | The machine test requires a trailing `/`. A bare prefix does not satisfy it |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `rest-door-needs-a-reason` | `// TODO: switch the export to StreamableFile later` in a file whose only door is a plain JSON read. The bytes test runs over the **raw file text** and cannot tell a use from a mention |
| `rest-door-needs-a-reason` | An unused `import { FileInterceptor } from "…"` left behind after a refactor. The import line is text; the door is justified by a leftover |
| `rest-door-needs-a-reason` | `const AUDIT_KEYS = ["OPS_TOKEN"]` in the same file. A string in a config map, a log key or a test name unlocks the operator reason |
| `rest-door-needs-a-reason` | Two controllers in one file, one streaming bytes and one reading JSON. Evidence is file-wide, so the second door rides on the first door's reason and no message is ever produced for it |
| `rest-door-needs-a-reason` | A checkout, package folder or ancestor directory literally named `webhooks/`. The external test matches `/webhook/i` against the **whole normalized path**, to any depth |
| `rest-door-needs-a-reason` | Any file under a folder named `health/` or `healthz/`. A service, a mapper and a full CRUD controller all inherit the liveness carve-out |
| `rest-door-needs-a-reason` | `@Controller("internal/reports")` on an ordinary authenticated read. The machine reason is a string prefix, and a prefix is the cheapest thing in a route to change |
| `rest-door-needs-a-reason` | `@Controller("api/ops/anything")` on a door a normal viewer can reach. The prefix is the entire evidence; the guard is not checked once it matched |
| `rest-door-needs-a-reason` | `@Controller("healthz")` returning business data. The probe test is an exact route match and never inspects what the handler answers with |
| `rest-door-needs-a-reason` | A route that is not a string `Literal` — this one runs backwards: a **lawful** door is reported, and the fastest repair is a disable comment. Method-level routes are never read, so an empty `@Controller()` plus `@Post("webhook/settlement")` is a real webhook that reports |
| `door-lives-in-features` | Renaming `modules/` to `services/`, `domains/` or `capabilities/`. Folder bans are not layer bans; the layer survives the rename with the rule switched off |
| `door-lives-in-features` | `@WebSocketGateway()`, `@MessagePattern(…)`, `@EventPattern(…)` under `modules/`. The rule recognises `@Controller` and nothing else, so its name promises more than it checks |
| `door-lives-in-features` | A relative filename such as `modules/x.controller.ts`. The gate demands a leading slash before `src` — a dependency on how the runner names the file |
| both | `@Nest.Controller("api/theme")`, or `import { Controller as Route }` then `@Route("api/theme")`, or `const Door = Controller` then `@Door("api/theme")`. A `MemberExpression` returns `null` and a renamed binding compares as a different name |
| both | A raw handler registered outside a class — `app.use(…)`, `server.get("/api/theme", …)` in the bootstrap file. There is no decorator to visit, and a REST door assembled by hand is a door the law governs |
| both | `// eslint-disable-next-line`. Neither rule is unsuppressible, so every hatch above is also reachable in one line by a person in a hurry |
| neither | **Everything `TRANSPORT-1` states** — a door that should have been a query is reported by nothing at all |

Every open hatch above is a hatch in the *rule*, never a permission in the *law*. Code that slips
through is still wrong.

## Inputs

| Input | Evidence required |
|---|---|
| `context.filename` | The path as the rule sees it, backslash-normalized, then matched against the probe, external and `/src/modules/` patterns |
| `sourceCode.getText()` | The complete file text, as a single string, for the bytes and operator tests |
| `Decorator` | `node.expression`; its `type`; for a `CallExpression`, its `callee.type`, `callee.name` and `arguments[0]` |
| Route argument | Only `arguments[0]` when it is a `Literal` with a string `value`. Every other shape becomes `""` |

Nothing else is read. No type information, no import graph, no second file, no configuration, no list
of blessed routes.

## Rules

1. A rule's identity is its **published name**. There is no numeric identifier for a rule; the name is
   what a build prints, what a disable comment carries, and what any conversation about a failure uses.
2. Each rule maps to exactly one code in the law, and no code is held by two rules.
3. Both rules are `meta.type: "problem"` and both are `error` in `recommended`.
4. Justification is computed **per file**, never per decorator, in `rest-door-needs-a-reason`.
5. A path gate returns an **empty visitor**, so a gated file is not partially checked — it is not
   checked at all.
6. Both rules declare `schema: []` and therefore take no options. Severity is the only dial a
   repository has.
7. Every open hatch is a hatch in the *rule*, never a permission in the *law*. Code that slips through
   is still wrong.

## Exceptions

Every exception here is written into the rules, not granted beside them.

- **The five reasons are the exemption.** `rest-door-needs-a-reason` reports only what shows none of
  probe, external, bytes, machine or operator. The published message names **four**; the fifth, probe,
  is accepted silently, so a developer reading the failure will not learn that a liveness route is
  also allowed. It releases the decorator from `TRANSPORT-2` and from nothing else.
- **First match wins.** The five tests run in order and return on the first hit. A door with a webhook
  route is never examined for bytes, so a message never states *which* reason saved it.
- **Everything outside `/src/modules/` is exempt from `door-lives-in-features`** — including a
  separate application that keeps its own `modules/` folder, which the law exempts but the gate
  does not. The exemption releases the file from `TRANSPORT-3` only; `TRANSPORT-2` still runs on it.
- **No test lane.** Neither rule carves out specs or fixtures.

## Output

One block per finding:

```text
rule:     <rest-door-needs-a-reason | door-lives-in-features>
code:     <TRANSPORT-2 | TRANSPORT-3>
file:     <path as the rule normalized it>
route:    <literal string | "" when the argument is not a string Literal>
reason:   <probe | external | bytes | machine | operator | none>
evidence: <route | path | file text>
message:  <unjustified | wrongTree>
verdict:  <fires | silent: hatch <name from the Open table>>
```

The `evidence` line is not decoration. A reason found in the **file text** is the weakest result this
module can produce, and reporting it as equal to a reason found in the route is how a leftover import
becomes an architectural decision.

The `verdict` line is the hatch line. `silent: hatch <name>` says the rule produced no message and
that the silence is not compliance; only `silent` with no hatch and `reason: none` unreachable means
the file is genuinely clean. A file outside `/src/modules/` emits `verdict: silent — out of scope,
empty visitor` for `door-lives-in-features` and is still judged by `rest-door-needs-a-reason`.

## Worked example

**Input.** One door under the capabilities tree, `modules/billing/billing.controller.ts`:

```ts
@Controller("api/billing/callback")
export class BillingCallbackController {
    @Post()
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

This IS a door for an external system, but neither the route nor the path says so, so the only
evidence the rule knows how to read does not exist. And the path contains `/src/modules/`.

```text
rule:     rest-door-needs-a-reason
code:     TRANSPORT-2
file:     src/modules/billing/billing.controller.ts
route:    "api/billing/callback"
reason:   none
evidence: route
message:  unjustified
verdict:  fires
```

```text
rule:     door-lives-in-features
code:     TRANSPORT-3
file:     src/modules/billing/billing.controller.ts
route:    "api/billing/callback"
reason:   none
evidence: path
message:  wrongTree
verdict:  fires
```

Two rules, two findings. A valid reason would not have saved the second one.

**Repaired.** The door moves to the doors tier and says in its route what it is,
`features/billing/billing-webhook.controller.ts`:

```ts
@Controller("api/billing/webhook")
export class BillingWebhookController {
    @Post()
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

Both rules go silent, and the silence here is real. But one edit later it stops being real — a second
door added to the same file:

```ts
@Controller("api/billing/settings")
export class BillingSettingsController {
    @Get()
    public async settings(): Promise<BillingSettingsDto> {
        return this.billing.settings()
    }
}
```

```text
rule:     rest-door-needs-a-reason
code:     TRANSPORT-2
file:     src/features/billing/billing-webhook.controller.ts
route:    "api/billing/settings"
reason:   external
evidence: path
message:  none
verdict:  silent: hatch two controllers in one file — evidence is file-wide, so the second door rides on the first door's reason and no message is ever produced for it
```

A plain JSON read, exactly what the schema already has a place for, and the rule will never speak
about it.

## Scope

This module documents two rules of one back-end law, and it does not judge what those rules do not
watch: whether an operation should have been a query at all is `TRANSPORT-1`, which no rule here
holds; a socket gateway, a broker consumer or a hand-registered handler is a door the law owns and
this module cannot see. It names no product, no company and no repository. Rule names, message
identifiers, decorator names and the interceptor and guard identifiers the rules match are
**identifiers that ship** and are reproduced verbatim; that exemption covers nothing else.
