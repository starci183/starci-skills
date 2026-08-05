# Naming and structure (BE)

> Scope: where a module or a file LIVES and what it is CALLED — the folder tree, the boundary
> between what is reusable and what is wiring, which specifier an import may name, and the
> file-name suffixes.
> Not error handling, not data access, not API design beyond where their files sit.
>
> Anchors here are public sources, not files in this tree — there is nothing to re-count. The
> concrete idiom is written against a Nest-shaped TypeScript service, because that is the shape
> these rules were drawn from; the rule above each example is what travels.

---

## 1. A top-level folder is a capability, not a layer

`controllers/`, `services/`, `dtos/`, `repositories/` at the top of the tree is the arrangement
everybody reaches for first and nobody defends afterwards. It optimises for a question nobody asks
— "show me all the controllers" — and penalises the question asked every day, which is "show me
everything that makes ordering work". A one-line change to ordering touches four folders, none of
which is named ordering.

The argument is old and settled. Parnas' information-hiding criterion (1972) says a module boundary
should enclose a decision likely to change, and "it is written in HTTP" is not a decision that
changes independently of "how an order is priced". Evans' *Domain-Driven Design* gives the boundary
its modern name — the bounded context, a capability with its own model — and Richardson's
*Microservices Patterns* makes the same cut inside a monolith, so that a capability can leave
without an archaeology project.

```
src/modules/
  ordering/
    ordering.module.ts
    ordering.service.ts          the capability's rules; nothing HTTP-shaped in here
    pricing.service.ts
    entities/order.entity.ts
    types.ts                     colocated types; import the file, not a folder barrel

  catalog/
  notification/
```

The technical-layer folder is legitimate exactly once: INSIDE a capability, where `entities/`,
`types/`, `constants/` and `utils/` sit beside the services that use them. Local layering is
navigation; global layering is a filing system that fights the work.

---

## 2. Two roots: what is reusable, and what wires it to a transport

The portable test from Cockburn's Ports and Adapters (2005) and Martin's Clean Architecture is a
compile-time one: *the use-case layer must compile with no import of the web framework, the ORM
client, or the broker client.* Give that test a folder to live in and the tree falls out.

- A **capability root** (`src/modules/`) holds reusable units. A unit here exposes no endpoint, no
  subscription, no cron. It can be imported by two different applications without either learning
  about the other.
- A **composition root** (`src/features/`, plus a thin `apps/<name>/`) holds the wiring: the HTTP
  controllers, the GraphQL resolvers, the queue consumers, the schedulers. A feature is not reusable
  and is not meant to be.

Dependencies run one way — composition imports capability, never the reverse. A capability module
that imports a resolver has inverted the arrow, and the symptom shows up later as a circular
`@Module` reference that nobody can untangle without a rewrite.

**One manifest names what is switched on.** In a Nest application that is the root
`app.module.ts`, listing every module the process actually registers. Read it FIRST when asking
whether something is live: a folder existing under the capability root proves only that someone
wrote it. 12-Factor's build/release/run separation (V) is the same instinct — what runs is a
declared thing, not an emergent property of the file system.

---

## 3. Name the declaring file; a barrel is a bug

Every import names the file that declares the symbol. There is no module `index.ts`, no
`export *` public surface, and no "go through the entry". A specifier that stops at a folder
(`@modules/ai`, `@modules/platform/exceptions`, `@features/video-encoder`, `./types` meaning
`types/index.ts`) is a barrel, and a barrel is the bug.

This is still Parnas, stated as tooling — just the other way around from a curated facade. The
capability boundary in §1 is the folder and the `@Module` that wires it, not a re-export list that
drifts, collides on `ConfigurableModuleClass`, and hides the file a reader actually needs to open.
When a symbol moves, the import path moves with it; grep finds every caller; `isolatedModules` does
not have to chase `export *`.

```ts
// Wrong: a folder, a barrel, a promise nobody can keep.
import { OrderingService } from "@modules/ordering"
import { PricingService } from "./pricing"

// Right: the file that declares the symbol.
import { OrderingService } from "@modules/ordering/ordering.service"
import { PricingService } from "./pricing.service"
```

**Cross-capability imports use the alias and the path under that root.** `@modules/<path from
src/modules>`, `@features/<path from src/features>`, `@tests/<path from src/tests>`. Meta-category
modules keep the category segment (`@modules/platform/winston/winston.service`, never the collapsed
`@modules/winston/...` short form).

**Same-capability imports are relative.** A file under `src/modules/ai/` that writes `@modules/ai/...`
is talking to itself through the public alias — a cycle magnet and a lie about the boundary. Gated
by `no-self-module-alias`. The same cut applies to `@features/<name>` and `@tests/<name>`.

**Machine-checked by two rules, both `error` with zero debt:**

- `must-deep-module-import` — a module/feature/tests root specifier is illegal; name a file.
- `no-self-module-alias` — inside a capability, do not use that capability's own alias.

**One symbol, one home; a symbol two folders share moves to `shared/`.** Without barrels the old
`TS2308` "already exported a member" failure mode is gone, but the ownership rule is not: when
folder `b` needs a type folder `a` defined, `b` imports the declaring file. It does not copy the
type, and it does not re-export it. If a third folder needs it too, the type moves to the
capability's `shared/` in the same commit and every caller points at that one file.

```ts
// Wrong — three paths emit one type (seeders/, 2026-08-05 drift, now retired).
// shared/path/types.ts            defines ResolvedFilePath
// courses/path.ts                 export type { ResolvedFilePath } from "../shared/path/types"
// cv/...                          export type { ResolvedFilePath } from "../../courses/path"

// Right: ResolvedFilePath lives in shared/ only. courses/ and cv/ import that file.
```

`.module-definition.ts` stays internal for the same reason it never belonged in a barrel:
`ConfigurableModuleBuilder` emits `ConfigurableModuleClass`, `MODULE_OPTIONS_TOKEN` and
`OPTIONS_TYPE` under those exact generic names in every module. Importers bind against the concrete
module class and its services, not those tokens.

A large module may still nest a sub-module and list it in `exports: [...]` so Nest's injector stays
in the parent's control. That is wiring, not an import facade. A genuinely cross-cutting utility
used by many capabilities belongs in its own shared module — imported by declaring file, not
deep-copied out of whichever capability wrote it first.

## 4. Colocate by default; promote on the second consumer

Everything one unit of work needs sits beside it: its types, its constants, its helpers, its test.
Next.js made this idea mainstream in a form worth borrowing — `layout`, `page`, `loading` and
`error` are first-class files colocated in the route folder they serve, so the route is one place
rather than four registries to keep in sync. The server-side version is identical: a service's
enums live in the capability's `enums/`, not in a global `src/enums/` that every module imports and
nobody owns.

Promotion is triggered by the SECOND consumer, not by a prediction of one. A type used by one module
stays in that module. When a second module genuinely needs it, it moves to the shared module in the
same commit that adds the second use — at which point the move is justified by evidence rather than
by taste, and the shared module stays small enough to read.

Companion folders are created when they have something in them and not before. An empty `utils/`
with a barrel exporting nothing is a folder a reader has to open to discover it was a false lead.
Under about three items, a flat `types.ts` beside the service beats a `types/` folder of one-file-each;
past that, the folder earns itself.

Tests colocate too — the spec sits beside the file it covers, so that moving the unit moves its
test, and a unit arriving without one is visible in the diff rather than in a coverage report
nobody opens.

---

## 5. One operation, one folder, one entry-point method with a fixed name

For a request-handling surface — a query, a mutation, a command endpoint — the unit is the
operation, and it gets a folder. Google's AIPs push the same granularity from the API side: standard
methods (AIP-131 through 135) are one method per resource operation, with custom methods only where
the standard set genuinely does not fit. Greg Young's CQRS is the same split where reads and writes
have diverged enough to want different models.

```
features/api/graphql/queries/order-summary/
  order-summary.module.ts             registers the leaf; the aggregator imports THIS
  order-summary.module-definition.ts
  order-summary.resolver.ts           one method, named execute
  order-summary.service.ts            reads; calls into the capability layer for anything rule-bearing
  graphql-types/response.ts
```

Two conventions in there are load-bearing and neither is obvious.

**The handler method has the same name in every leaf** — `execute`. It looks like a missed naming
opportunity and it is the opposite: when every operation's entry point is spelled identically, the
folder name is the only thing that varies, which is what makes the tree greppable, the codegen
uniform, and a cross-cutting decorator change a mechanical edit. A method named
`getOrderSummaryForUser` puts the same information in two places and lets them disagree.

**The leaf is registered as a module, not as a class the parent imports directly.** Schema builders
and DI containers discover operations through registration; a resolver imported as a plain class
compiles, passes review, and is simply absent from the schema at runtime. That failure has no error
message, which is exactly why the rule is written down.

The leaf's own service stays thin — it reads, it maps, it hands anything rule-bearing to the
capability layer from §2. A resolver or controller reaching straight for the ORM is the anti-pattern;
the one tolerated case is a single-entity lookup with no rule attached to it.

---

## 6. The file name says what the file is, and the suffix names its role

One exported class per file, PascalCase, matching the kebab-case file name; the suffix comes from a
closed set. The Google TypeScript Style Guide and the Airbnb guides both settle naming this way and
both insist it be enforced by tooling rather than by review, which is the part usually skipped.

```
ordering.module.ts       → export class OrderingModule
ordering.service.ts      → export class OrderingService
order.entity.ts          → export class OrderEntity
order-created.listener.ts
send-receipt.worker.ts
ordering.controller.ts   ordering.resolver.ts   admin.guard.ts   app-exception.filter.ts
ordering.service.spec.ts
```

The closed set matters more than any individual entry in it. When a file's role is not on the list,
that is information: `order-helpers.ts` and `misc.ts` are names for code that has not been given a
home, and the fix is to find its capability, not to widen the vocabulary. A tree where every file
announces its role can be read by a stranger, by a codemod, and by a lint rule that only wants to
touch entities.

Machine-checkable at the file level — `unicorn/filename-case` with `{ case: "kebabCase" }` holds the
casing, and a `no-restricted-syntax` rule or a small script can assert that a `*.entity.ts` exports
exactly one class ending in `Entity`. That the file belongs in THIS capability rather than the one
next door is judgement, and it is the judgement worth spending review time on, since no linter has
an opinion about it.

---

## 7. A name that has already spread is a name; rename it with expand-and-contract or not at all

Every established codebase contains a folder or a symbol whose spelling someone regrets. The
temptation is a quiet fix during unrelated work. The cost is a diff touching hundreds of imports,
mixed into a change about something else, that conflicts with every open branch.

Two honest options, and no third. Leave it and spell it the way the tree spells it — a document that
silently corrects the codebase teaches an import that will not resolve, and a reader who trusts the
document loses an hour. Or rename it properly, using the expand-and-contract sequence Ambler and
Fowler set out in *Refactoring Databases* (2006): introduce the new name as the real one, keep the
old as a deprecated re-export so nothing breaks, migrate call sites over time, then delete the alias
in a commit that does nothing else.

```ts
// ordering/ordering.service.ts
export class OrderingService { /* ... */ }

/** @deprecated Renamed to {@link OrderingService}; this alias is removed after the call sites move. */
export const OrderService = OrderingService
```

The same discipline applies to moving a folder. A move and an edit in one commit produce a diff that
review cannot read, so the history stops being able to answer why anything changed — which is the
one thing history is for.
