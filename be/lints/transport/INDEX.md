---
id: be-lints-transport-index
title: INDEX.md
slug: /be/lints/transport
sidebar_label: transport
sidebar_position: 0
description: What the two transport rules actually see in a file, and what they cannot see at all.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `transport`

## Law

The law this module enforces settles one question about doors: **when is a door allowed not to be
GraphQL**, and where the answer lands on disk. A REST route is permitted only where GraphQL cannot
serve, the file itself must show which case it is, and a door lives beside the other doors whatever
its transport.

This shelf does not restate that law. It records **enforcement**: which of those sentences a machine
can hold, by what mechanism, and — the part nobody writes down — which ways of writing walk past the
machine untouched.

Two rules exist. The source publishes exactly two in its `rules` export and exactly two in its
`recommended` export, and the two lists agree. The law states **three** codes, so one of them is held
by nothing; that gap is recorded in `audit.md` rather than papered over here.

The design worth naming is that **neither rule reads a registry.** The reason a REST door is
permitted is read off the route string, the file path and the file's own text — the same evidence a
human reader would use. That choice is deliberate and correct, and it is also the origin of almost
every open hatch below: evidence read as raw text cannot tell a use from a mention, so a comment
justifies a door exactly as well as an interceptor does.

## Rules

| Rule | Code | What it reports |
|---|---|---|
| `rest-door-needs-a-reason` | `TRANSPORT-2` | `unjustified` on every `@Controller` decorator in a file that shows none of the five accepted reasons — probe, external, bytes, machine, operator |
| `door-lives-in-features` | `TRANSPORT-3` | `wrongTree` on every `@Controller` decorator in a file whose normalized path contains `/src/modules/` |

`TRANSPORT-1` (the default door is GraphQL) is enforced by **no rule**. Nothing reports a door that
should have been a query; `rest-door-needs-a-reason` only asks a door that already exists to show a
reason, and it recognises exactly one decorator. A socket gateway or a broker consumer — doors by the
law's own definition — is invisible to both rules. That is carried in `audit.md`.

## Detection

| Rule | Mechanism |
|---|---|
| `rest-door-needs-a-reason` | Reads `context.filename` and the **entire file text** via `sourceCode.getText()` once in `create`. Visits `Decorator`; requires the decorator name to be the identifier `Controller` (bare, or the callee of a `CallExpression`). Extracts the route only when `arguments[0]` is a `Literal` whose `value` is a string, otherwise `""`. Then five tests, first match wins: route `/^healthz?$/` or path `/\/health(z)?[./]/`; route or path `/webhook/i`; **file text** `/FileInterceptor\|FilesInterceptor\|AnyFilesInterceptor\|StreamableFile\|@Res\s*\(\|createReadStream/`; route `/^(pods\|internal\|agents)\//`; route `/^api\/ops(\/\|$)/` or **file text** `/Operator[A-Za-z]*Guard\|ServiceToken\|OPS_TOKEN/`. No match reports the decorator node |
| `door-lives-in-features` | File-level gate first: `/\/src\/modules\//` tested against the backslash-normalized `context.filename`; a non-match returns an **empty visitor**. Otherwise visits `Decorator`, requires the same `Controller` identifier, and reports unconditionally — no route, no text and no class name is consulted |

Both normalize `\` to `/` before any path test, so a Windows path compares like every other path.
Both are single-file: neither resolves an import, reads a type, or knows what another file declares.
Both declare `schema: []` and therefore take no options.

The route helper is the sharpest edge in the source. `routeOf` accepts a `Literal` string and
nothing else, so a route written as a template literal, a constant, a concatenation or the object
form `{ path: "…" }` collapses to `""` — and `""` matches none of the three route-shaped reasons.
Method-level route strings are never read at all.

## Escape Hatches

### Closed

| Way of writing | Why it does not slip |
|---|---|
| A comment above the class saying `// this is a webhook receiver` | `webhook` is matched against the **route** and the **path** only, never the file text. A claim in prose buys nothing |
| Naming the class `WebhookController` while the route is `api/reports` and the file is `reports.controller.ts` | No rule reads the class name. Identity comes from the route string and the path |
| Moving an unjustified controller into `features/` | `rest-door-needs-a-reason` has no path gate for justification. Being in the right tree is a different sentence of the law, held by a different rule |
| A webhook controller left under `src/modules/` | The two rules are independent. A perfect `TRANSPORT-2` reason does not exempt anything from `TRANSPORT-3` |
| Nesting deeper: `src/modules/billing/http/controllers/x.controller.ts` | The gate matches the `/src/modules/` **pair anywhere in the path**, so extra depth changes nothing |
| A `@Controller` declared inside a spec or a fixture | Neither rule has a test-lane gate. Unlike other shelves in this tree, a throwaway door in a test file reports like any other |
| `@Controller("ops/tenants")` intending an operator surface | The operator route test is anchored to `api/ops`. `ops/…` alone is not it, and the door reports unless the file also carries an operator-guard or service-token identifier |
| `@Controller("internal")` with no second segment | The machine test requires a trailing `/`. A bare prefix does not satisfy it |

### Open

| Way of writing | Why the rule does not catch it |
|---|---|
| `// TODO: switch the export to StreamableFile later` in a file whose only door is a plain JSON read | The bytes test runs over the **raw file text**. It cannot tell a use from a mention, so one word in a comment justifies every `@Controller` in the file, permanently and invisibly |
| An unused `import { FileInterceptor } from "…"` left behind after a refactor | Same mechanism. The import line is text; the door is justified by a leftover |
| `const AUDIT_KEYS = ["OPS_TOKEN"]` sitting in the same file | The operator test is a raw-text match too. A string in a config map, a log key or a test name unlocks the operator reason |
| Two controllers in one file, one streaming bytes and one reading JSON | Text and filename evidence is file-wide, not per-decorator. The second door rides on the first door's reason and no message is ever produced for it |
| A checkout, package folder or ancestor directory literally named `webhooks/` | The external test matches `/webhook/i` against the **whole normalized path**, including every ancestor segment. One badly named directory justifies every controller beneath it, to any depth |
| Any file anywhere under a folder named `health/` or `healthz/` | The probe test is `\/health(z)?[./]/` — a path segment, not a probe. A service, a mapper and a full CRUD controller under that folder all inherit the liveness carve-out |
| `@Controller("internal/reports")` on an ordinary authenticated read | The machine reason is granted by a **string prefix** alone. Nothing verifies that no user session is carried; a prefix is the cheapest thing in a route to change |
| `@Controller("api/ops/anything")` on a door a normal viewer can reach | Same shape. The route prefix is the entire evidence, and the guard is not checked when the prefix already matched |
| `@Controller("healthz")` returning business data | The probe test is an exact route match. What the handler answers with is never inspected |
| `@Nest.Controller("api/theme")`, or `import { Controller as Route }` then `@Route("api/theme")` | The decorator name is read from an `Identifier`, or from the callee of a `CallExpression` when that callee is an `Identifier`. A `MemberExpression` returns `null`; a renamed local binding compares as a different name. Both rules go silent for that decorator |
| `const Door = Controller` then `@Door("api/theme")` | Identical hatch, without touching the import line |
| A raw handler registered outside a class — `app.use(…)`, `server.get("/api/theme", …)` in the bootstrap file | There is no decorator to visit. A REST door assembled by hand is a door the law governs and neither rule can see |
| `@WebSocketGateway()`, `@MessagePattern(…)`, `@EventPattern(…)` under `src/modules/` | The law defines a door as anything the outside world can reach, and names sockets and broker consumers explicitly. `door-lives-in-features` recognises `@Controller` and nothing else, so its name promises more than it checks |
| Renaming the folder `src/modules/` to `src/services/`, `src/domains/` or `src/capabilities/` | The gate is one folder-name pair. Folder bans are not layer bans; the layer survives the rename with the rule switched off |
| A lint run that hands the rule a relative filename such as `src/modules/x.controller.ts` | The gate demands a **leading slash** before `src`. An absolute path always has one, so this is narrow — but it is a real dependency on how the runner names the file, not on where the file is |
| `// eslint-disable-next-line` above either rule | Neither rule is unsuppressible. Every hatch above is also reachable in one line by a person who is in a hurry |

## Inputs

| Input | What is read |
|---|---|
| `context.filename` | Backslash-normalized, then matched against the probe, external and `/src/modules/` patterns |
| `sourceCode.getText()` | The complete file text, as a single string, for the bytes and operator tests |
| `Decorator` | `node.expression`; its `type`; for a `CallExpression`, its `callee.type`, `callee.name` and `arguments[0]` |
| Route argument | Only `arguments[0]` when it is a `Literal` with a string `value`. Every other shape becomes `""` |

Nothing else is read. No type information, no import graph, no second file, no configuration, no
list of blessed routes.

## Invariants

- A rule's identity is its **published name**. There is no numeric identifier for a rule; the name is
  what a build prints, what a disable comment carries, and what any conversation about a failure uses.
- Each rule maps to exactly one code in the law, and no code is held by two rules.
- Both rules are `meta.type: "problem"` and both are `error` in `recommended`.
- Justification is computed **per file**, never per decorator, in `rest-door-needs-a-reason`.
- A path gate returns an **empty visitor**, so a gated file is not partially checked — it is not
  checked at all.
- Every open hatch above is a hatch in the *rule*, never a permission in the *law*. Code that slips
  through is still wrong.

## Exceptions

Every exception here is written into the rules, not granted beside them.

- **The five reasons are the exemption.** `rest-door-needs-a-reason` reports only what shows none of
  probe, external, bytes, machine or operator. The published message names **four**; the fifth,
  probe, is accepted silently, so a developer reading the failure will not learn that a liveness
  route is also allowed.
- **First match wins.** The five tests run in order and return on the first hit. A door with a
  webhook route is never examined for bytes, so a message never states *which* reason saved it.
- **Everything outside `/src/modules/` is exempt from `door-lives-in-features`** — including a
  separate application that keeps its own `src/modules/` folder, which the law exempts but the gate
  does not. That divergence is a finding, recorded in `audit.md`.
- **No test lane.** Neither rule carves out specs or fixtures.

## Output

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
shelf can produce, and reporting it as equal to a reason found in the route is how a leftover import
becomes an architectural decision.

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why it is worth a machine, read
`example.md` for the code that fires and the code that slips, and read `audit.md` only while
reviewing the enforcement itself.

## Scope

This module documents two rules of one back-end law. It names no product, no company and no
repository. Rule names, message identifiers, decorator names and the interceptor and guard
identifiers the rules match are **identifiers that ship** and are reproduced verbatim; that exemption
covers nothing else.

## Version Rule

Increment all five records by `0.01` for an accepted change to a rule or to what is claimed about it,
and record it in `changelog.md`. A new rule in the source, a removed rule, or a newly discovered open
hatch each require a version bump — a hatch found and not written down is the failure this shelf
exists to prevent.
