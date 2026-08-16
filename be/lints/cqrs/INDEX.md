---
id: be-lints-cqrs-index
title: INDEX.md
slug: /be/lints/cqrs
sidebar_label: cqrs
sidebar_position: 0
description: What the three published CQRS lint rules can actually see, and the ways of writing they do not catch.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `cqrs`

## Law

The law lives in [`patterns/cqrs.md`](../../canon/patterns/cqrs.md) and carries seven codes,
`CQRS-1` through `CQRS-7`. This module documents something narrower and more useful: **which of
those codes a machine holds, by what mechanism, and where the mechanism ends.**

Three of the seven codes are shapes a parser can see. The other four — where the work lives, how
thin a dispatching service is, whether a failure is thrown or returned, whether the caller is
waiting on an event — are judgements. A rule that guessed at them would fire on correct code often
enough that everybody would learn to disable it, and a rule everybody disables enforces nothing
while looking like it does.

So the honest statement of enforcement is: **four codes have no machine at all, and three have a
machine with known holes in it.** Both halves of that sentence matter. A code with no rule is known
to be unenforced and gets read by a human. A rule believed to be airtight, that is not, is worse —
it buys silence and pays for it with a false sense of coverage.

## Rules

The identity of a rule is its published name — the string a build log prints, a disable comment
names, and a config file sets a severity on. There is no second numeric identifier.

| Rule | Code it enforces | What it reports |
|---|---|---|
| `handler-overrides-process` | `CQRS-3` | A decorated handler declares `execute` (`overridesExecute`), or a decorated handler with no superclass declares neither `execute` nor `process` (`noProcess`) |
| `message-carries-params-only` | `CQRS-2` | An undecorated class in a message file declares a non-constructor method (`method`), or its constructor does not take exactly one parameter named `params` (`shape`) |
| `handler-has-twin-spec` | `CQRS-7` | A handler file whose operation name has no matching `<operation>.handler.spec.ts` in the listing the config supplied (`missing`) |

Every published rule maps to a code. The gap runs the other way: `CQRS-1`, `CQRS-4`, `CQRS-5` and
`CQRS-6` have no rule, and no rule here claims them. That is recorded in `audit.md` rather than
patched over with an invented mapping.

The severity the module asks for, as shipped:

| Rule | Recommended severity | Why |
|---|---|---|
| `handler-overrides-process` | `error` | Measured debt burned down to zero |
| `message-carries-params-only` | `error` | Measured debt burned down to zero |
| `handler-has-twin-spec` | `off` | Inert without a folder listing passed as an option; a repository that supplies one turns it on |

A rule ships at `error` only once its measured count is zero. Shipping at `error` with debt
outstanding blocks every commit that touches an offender, which is how a rule gets disabled
wholesale instead of paid down.

## Detection

Read this table before the next one. What a rule can be dodged by follows directly from what it
looks at.

| Rule | Mechanism |
|---|---|
| `handler-overrides-process` | `ClassDeclaration` only. Gate: the class carries a decorator whose expression is an `Identifier`, or a `CallExpression` with an `Identifier` callee, whose name matches `/^(?:Command\|Query\|Events)Handler$/`. Then scans `node.body.body` for a `MethodDefinition` whose `key.name` is `execute`; if found, reports at that key. Otherwise, if `node.superClass` is present it stops; if not, it looks for a `MethodDefinition` whose `key.name` is `process` and reports its absence. No filename gate at all. |
| `message-carries-params-only` | Filename gate first: `context.filename` normalised to forward slashes, then matched against `/\/([a-z0-9-]+)\.(command\|query)\.ts$/`. No match means the rule returns an empty visitor and does not exist for that file. Then `ClassDeclaration`, skipped entirely if the class carries **any** decorator. Reports every `MethodDefinition` whose `kind` is not `constructor`. Then finds the constructor `MethodDefinition`, unwraps a `TSParameterProperty` to its `parameter`, and requires `params.length === 1` with `.name === "params"`. |
| `handler-has-twin-spec` | Filename gate: normalised path matched against `/\/([a-z0-9-]+)\.handler\.ts$/`, capturing the operation. Then reads `context.options[0].specs`; if that is not an array the rule returns an empty visitor. Otherwise it asks whether the array contains the string `` `${operation}.handler.spec.ts` ``. If not, it registers `Program:exit` and reports on the `Program` node. **It never touches the filesystem** — the check is a string against a list the config supplied. |

The last mechanism is deliberate and worth stating plainly: a rule that stats the disk answers
differently depending on what else is checked out, and a rule whose answer depends on the working
tree is one nobody can reproduce in review.

## Escape Hatches

### Closed

Ways of writing that a reader might expect to slip past, and why they do not.

| Rule | The dodge that fails | Why it fails |
|---|---|---|
| `handler-overrides-process` | `@CommandHandler` written without parentheses | The decorator reader accepts a bare `Identifier` expression as well as a `CallExpression`, so both spellings are recognised |
| `handler-overrides-process` | Burying the handler decorator under `@Injectable()` and others | The gate uses `.some()` over every decorator on the class, not the first one |
| `handler-overrides-process` | `private execute()`, `public execute()`, `get execute()` | The scan matches `MethodDefinition` by key name only; accessibility, `override`, `async` and accessor kind are not consulted |
| `handler-overrides-process` | Declaring `process` as well, hoping it cancels out | The `execute` branch reports and returns before `process` is ever looked for |
| `message-carries-params-only` | `constructor(readonly params: P)` versus `constructor(params: P)` | A `TSParameterProperty` is unwrapped to its inner parameter before the name is compared, so the access modifier changes nothing |
| `message-carries-params-only` | Destructuring the parameter: `constructor({ request, user }: P)` | An `ObjectPattern` has no `.name`, so the shape check fails and reports |
| `message-carries-params-only` | Marking helper logic `private` or `static` | Neither is consulted; every non-constructor `MethodDefinition` is reported |
| `message-carries-params-only` | A backslash path on a Windows checkout | The filename is normalised to forward slashes before matching, so the gate behaves identically on every platform |
| `handler-has-twin-spec` | Passing `specs: []` to silence it | An empty array is still an array, so the rule runs and reports; only a **missing** option turns it off |
| `handler-has-twin-spec` | An empty handler file | The report is attached to `Program:exit`, so it fires with no code in the file at all |

### Open

Ways of writing these rules genuinely do **not** catch. Each row is a real violation of the law
that the machine reports nothing about.

| Rule | What slips through | Why the mechanism misses it |
|---|---|---|
| `handler-overrides-process` | `override execute = async (command: C) => { … }` | A class field is a `PropertyDefinition`, not a `MethodDefinition`. The instance property shadows the base method at runtime, so the template really is escaped — and the scan looks only at method definitions |
| `handler-overrides-process` | `async ["execute"](command: C) { … }` or a computed key | The scan compares `member.key.name`; a string or computed key has no `.name`, so it compares against `undefined` |
| `handler-overrides-process` | Any handler that `extends` anything and implements no `process` | `if (node.superClass) return` — the missing-`process` check applies only to a standalone class, which is the rarer shape. The canonical handler extends the template base, so the canonical shape is exactly the one this half of the rule never inspects |
| `handler-overrides-process` | `@nest.CommandHandler(C)`, or `import { CommandHandler as Handles }` then `@Handles(C)` | A `MemberExpression` callee yields no name and the class is not seen as a handler; the regex matches the local identifier spelling, not the import it resolves to. Rename the import and the whole rule turns off for that file |
| `handler-overrides-process` | A handler whose decorator is a project-specific wrapper — anything not spelled `CommandHandler`, `QueryHandler` or `EventsHandler` | The decorator name set is a closed literal regex; one wrapper decorator makes every handler under it invisible |
| `message-carries-params-only` | A message with no constructor: `export class ArchiveOrderCommand { readonly request: R; readonly user: U }` | The shape check returns early when there is no constructor, and fields are `PropertyDefinition` nodes the rule never reads. The exact violation `CQRS-2` describes, in a spelling the rule cannot see |
| `message-carries-params-only` | Logic in the constructor **body**: `constructor(readonly params: P) { this.params = normalise(params) }` | Only the parameter list is inspected. The body is never visited, so the one place a message can compute invisibly is the one place nothing looks |
| `message-carries-params-only` | `isValid = () => true` as a class field | Same node-type gap as above: a field is not a `MethodDefinition` |
| `message-carries-params-only` | Any decorator on the class, including one added for an unrelated reason | `if ((node.decorators \|\| []).length > 0) return` is a whole-class exemption bought to keep a differently-shaped `.command.ts` family quiet. One decorator makes a message unmeasurable |
| `message-carries-params-only` | A single parameter named `params` carrying anything at all — a repository, a cache, a callback | The check is the parameter's **name**, never its type. `params` is a naming convention the rule enforces and a content rule it does not |
| `message-carries-params-only` | `addToCart.command.ts`, `add_to_cart.command.ts`, `commands.ts`, a message declared in `index.ts` | The gate demands `[a-z0-9-]+` immediately before `.command.ts` or `.query.ts`. A capital letter, an underscore, a plural, or a barrel file and the rule does not exist. Filename is the cheapest thing in a repository to change |
| `handler-has-twin-spec` | Everything, by default | Shipped `off`, and inert even when on unless the config supplies `specs`. The rule is a reporter for a gate that lives outside it |
| `handler-has-twin-spec` | A spec that exists and tests nothing — empty, `describe.skip`, or a single truthy assertion | The check is a filename in a list. Content is never read, so "has a twin" and "is tested" are different claims and only the first is held |
| `handler-has-twin-spec` | Two operations with the same short name in different folders, one of which has a spec | The listing is compared as flat basenames with no folder qualification. One spec named for the operation satisfies every handler named for it |
| `handler-has-twin-spec` | `<operation>.handler.tsx`, `.handler.mts`, or a handler defined inside a barrel | Same closed filename gate as above, with the same cost |
| `handler-has-twin-spec` | A stale listing | Whoever supplies `specs` decides the answer. A listing built once and cached, or built from the wrong root, makes every handler pass while nothing is checked |

Two entries are the same defect wearing different clothes and are worth naming once: **class fields
are invisible to all of the method scanning here**, and **filename gates stop existing the moment a
file is renamed.** Neither is sabotage. Both are what tidying up looks like.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path as the linter reports it, normalised to forward slashes |
| decorators | The decorator identifiers as spelled at the class, not as imported |
| class members | Node types, not names: a method and a field of the same name are different evidence |
| constructor parameters | Count, and the name after a parameter property is unwrapped |
| options | For the twin-spec rule, the folder listing the config passes; absent, the rule is inert |

## Invariants

- A rule's identity is its published name. No numeric code is minted for a rule.
- A rule reports only what its mechanism can see, and this shelf states that boundary rather than
  the law's ambition.
- No rule reads the filesystem. An answer that depends on the working tree cannot be reproduced.
- A rule ships at `error` only at a measured count of zero; above zero it ships at `warn` with the
  count beside it, or `off` when it needs configuration to work at all.
- When measuring a rule's real count, count only that rule's reports. Inline disable comments
  naming rules a minimal config never loads are themselves reported and inflate every count.
- An unenforced code is recorded as unenforced. It is never assigned to the nearest rule.

## Exceptions

Each exemption below is deliberate, was bought with a measurement, and is closed.

- **Undecorated classes are not handlers.** A class named for a handler but carrying no handler
  decorator may be a socket handler, a strategy or an adapter. A rule that fired on the name would
  spend its life being disabled by people who were right.
- **A subclass is exempt from the missing-`process` check.** Reporting regardless of superclass
  produced ten false reports against three true ones, because an intermediate abstract handler that
  implements `process` once and is subclassed is a legitimate shape.
- **A decorated class in a message file is exempt.** Another framework uses the same file suffix for
  a decorated class with a `run` method, which is a door rather than a message; that family produced
  nineteen of twenty-one reports before the exemption.
- **The twin-spec rule is silent without its listing.** Given no option it does nothing rather than
  guess, because guessing here means reporting differently on two machines.

## Output

```text
rule: <published rule name>
code: <CQRS-n | none>
mechanism: <node type, filename regex or option consulted>
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why the law deserves a machine,
`example.md` for code that fires and code that does not — including code that slips through —
and `audit.md` only while reviewing enforcement coverage.

## Scope

This module documents enforcement, not product. Every example is ordinary code in an ordinary
folder, and no prose here names a product, a repository or a component library. The rule names and
the plugin namespace they ship under are identifiers that appear in build output, so they are
reproduced verbatim; that is the one exemption, and it does not extend to prose.

## Version Rule

Increment all five records by `0.01` for an accepted change to what is documented here, and record
it in `changelog.md`. A rule added to or removed from the source is such a change.
