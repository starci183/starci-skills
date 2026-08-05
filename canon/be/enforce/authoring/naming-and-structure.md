# Naming and structure (BE)

> Scope: where a module or a file LIVES and what it is CALLED — the folder tree, the boundary
> between what is reusable and what is wiring, the one public entry, and the file-name suffixes.
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
    types/index.ts
    index.ts                     the only file anything outside ordering may import

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

## 3. One public entry per module; a deep import from another capability is a bug

A module's folder has exactly one file the outside world may name, and it re-exports the module's
public surface. Everything else — services, entities, helpers, types not in the surface — is
internal, and internal means the compiler and the linter say so, not that a comment asks nicely.

This is Parnas again, stated as tooling. Without it, a refactor inside a capability breaks files in
three other capabilities, and the module boundary you drew in §1 is decorative: the code has already
grown through it.

```ts
// ordering/index.ts — the entire public surface, in one file
export * from "./ordering.module"
export * from "./ordering.service"
export * from "./types"
```

**A barrel contains `export *` lines and nothing else.** No `export { A, B }`, no
`export type { X } from`. A named re-export is always a symptom: it means two folders are trying to
emit the same symbol and someone hand-picked their way around the resulting `TS2308` instead of
fixing the ownership. The cure is ownership, not curation — see below.

**One symbol, one home; a symbol two folders share moves to `shared/`.** When folder `b` needs a type
that folder `a` defined, the answer is never `export type { T } from "../a"` in `b`'s barrel — that
makes `T` reachable by two paths, and the parent barrel that `export *`s both is then illegal. Move
`T` into the capability's `shared/` folder, which becomes its single owner, and let every consumer —
`a`, `b`, and the parent barrel — reach it through that one path.

```ts
// Wrong — real drift, seeders/ (2026-08-05): three paths emit one type
// shared/path/types/index.ts      defines ResolvedFilePath
// courses/path/index.ts           export type { ResolvedFilePath } from "../../shared"
// cv/path/types/…                 export type { ResolvedFilePath } from "../../../courses/path/…"
// → seeders/index.ts cannot `export *` both ./courses and ./shared, so it hand-listed ./shared's
//   surface behind a five-line apology. The apology is the bug report.

// Right: ResolvedFilePath lives in shared/ only. courses/ and cv/ import it; neither re-exports it.
```

The cost of `export *` is that a folder's whole surface is public, so the barrel no longer hides an
internal the way a curated list did. That hiding is bought back a level up: §3's own
`no-deep-module-import` rule means no consumer can name anything inside the module regardless, so the
information hiding lives at the module boundary, where it is machine-checked, instead of in a
hand-maintained list that drifts and collides.

The barrel re-exports the module class, its service(s) and the types the surface promises — and it
never `export *`s the `.module-definition.ts`. `ConfigurableModuleBuilder` generates
`ConfigurableModuleClass`, `MODULE_OPTIONS_TOKEN` and `OPTIONS_TYPE` under those exact generic names in
*every* module, so a barrel that blanket-exports two of them re-exports the same three names twice and
the compiler refuses it — `TS2308`, "already exported a member". Those tokens are wired inside the
module; no importer binds against them, so they stay internal. This is live drift, not a hypothetical:
`src/modules/ai/index.ts` and `src/modules/bussiness/index.ts` each carry exactly this collision
(2026-08-04). Gated — a `.module-definition` reached by an `export *`, or any `TS2308` on a module's
`index.ts`, is a folder-shape check away.

```ts
// Wrong: reaching past the entry into another capability's internals.
import { PricingService } from "@modules/ordering/pricing.service"

// Right: through the entry, which is the file that made a promise.
import { OrderingService } from "@modules/ordering"
```

Machine-checkable, and it should be checked, because review will not catch it reliably. Point
`eslint-plugin-import` at the boundary:

```js
// eslint.config.js
"import/no-internal-modules": ["error", {
    // a capability may be imported at its root only; anything inside it is private
    forbid: ["@modules/*/*"],
}],
```

Path aliases carry the same rule: map `@modules/*` at folder granularity, never
`@modules/ordering/services/*`. An alias that resolves into a module's interior is an invitation
that will be accepted.

Two exceptions that are real, not loopholes. A large module may nest a sub-module and re-export it
from its own `exports: [...]`, so consumers still go through the parent and the parent stays in
control of how the child is configured. And a genuinely cross-cutting utility used by many
capabilities belongs in a shared `common` module — not deep-imported from whichever capability
happened to write it first.

---

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
Under about three items, a flat `types.ts` beside the service beats a `types/` folder with a barrel;
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
  index.ts
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
// ordering/index.ts
export class OrderingService { /* ... */ }

/** @deprecated Renamed to {@link OrderingService}; this alias is removed after the call sites move. */
export const OrderService = OrderingService
```

The same discipline applies to moving a folder. A move and an edit in one commit produce a diff that
review cannot read, so the history stops being able to answer why anything changed — which is the
one thing history is for.
