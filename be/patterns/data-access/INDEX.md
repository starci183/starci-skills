---
id: be-patterns-data-access-index
title: INDEX.md
slug: /be/patterns/data-access
sidebar_label: data-access
sidebar_position: 0
description: Binding rules for reaching persistence through a datasource-named EntityManager that can carry a transaction.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `data-access`

## Law

Persistence goes through an `EntityManager`, injected by a decorator that names which datasource it
belongs to. There is no repository injection here, and no ambient default connection: both of those
are handles that look identical whichever database they are pointed at, and this application has
more than one.

The whole law follows from one property. An `EntityManager` is a **unit of work that can be passed**
— handed to a helper, wrapped in a transaction, swapped for a transactional one — and a repository
is not, because it is bound to one entity for its whole life. The moment a use case needs to write
two tables atomically, code built on repositories has to be rewritten rather than extended, and the
rewrite lands in whatever module noticed first.

The question that settles it: **could this operation grow a second write?** It nearly always can,
and a handle that cannot carry the transaction across the pair is the wrong handle from the start.

**This is binding, not advisory.** Every constructor that touches persistence, every entity class
and every multi-write operation carries exactly one situation code below, and there is no operation
small enough to be exempt: a single-row read is `DATA-1` for the same reason a settlement is. "It is
only one table" is the most common place this rule gets skipped, because the second table arrives
later and by then the handle is already wrong.

## Situation Codes

Every situation this module governs carries a code, `DATA-<n>`. The numbers are fixed and are cited
from other law files and from task records; a code keeps its number and its meaning for as long as
it exists.

| Code | Requires | Forbids |
|---|---|---|
| `DATA-1` | An injected `EntityManager` whose parameter carries an `@Inject*EntityManager()` decorator naming the datasource | A bare `EntityManager` constructor parameter; relying on the framework's default connection |
| `DATA-2` | Persistence reached through the `EntityManager` | `@InjectRepository(...)`; a `Repository<T>`, `TreeRepository<T>` or `MongoRepository<T>` parameter |
| `DATA-3` | `@Entity("table_name")`, or `@Entity({ name: "table_name" })` when a schema qualifier is also needed | `@Entity()` with the table name left to be inferred from the class name |
| `DATA-4` | Work that must succeed or fail together running in one transaction, with the transactional manager passed to everything inside it | A helper reaching for its own injected manager while its caller is mid-transaction |
| `DATA-5` | Relations, selects and ordering stated at the call site that knows what the answer is for | `eager` relations on an entity |

`DATA-1` AND `DATA-2` READ THE SAME CONSTRUCTOR PARAMETER AND ARE NOT THE SAME FACT. `DATA-1` is
about a handle that does not say **which database** it points at; `DATA-2` is about a handle that
cannot **grow a second write** whichever database it points at. A perfectly decorated repository
injection satisfies neither, and a bare `EntityManager` fails only the first. They are two codes
because they fail independently and are fixed differently.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means the wrong value cannot be written;
`enforced` means a named rule from
[`sources/be/data-access.mjs`](../../../sources/be/data-access.mjs) reports it; `documented` means
nothing mechanical holds it and only a reader does.

| Code | Tier | Held by |
|---|---|---|
| `DATA-1` | `enforced` | `starci-be/must-inject-entity-manager` — reports a constructor parameter typed `EntityManager` that carries no decorator matching `Inject*EntityManager`. It reads the parameter and its parameter-property wrapper, so `private readonly` does not hide the decorator from it. |
| `DATA-2` | `enforced` | `starci-be/no-injected-repository` — reports both spellings: the `@InjectRepository` decorator, and the type `Repository`, `TreeRepository` or `MongoRepository` on a constructor parameter. Catching the type as well as the decorator matters, because the type alone is enough to bind the handle. |
| `DATA-3` | `enforced` | `starci-be/require-entity-table-name` — reports `@Entity()` whose arguments carry no string table name, directly or as the `name` property of the options object. |
| `DATA-4` | `documented` | Whether a helper was handed the caller's transactional manager is a fact about the call graph, not about any one file. A rule reading a single file would have to guess, and a guess here fires on correct code — which is how a correct rule gets disabled. |
| `DATA-5` | `documented` | Whether a relation should have been asked for at the call site depends on what the answer is for. Nothing in the entity file says whether the caller needed one column or the whole tree. |

Two of five codes read `documented`, and that is the honest state rather than a gap to be papered
over. The three that are enforced are exactly the three a parser can see in one file: a decorator on
a parameter, a type on a parameter, and an argument to a decorator. The two that are not are the two
that need either the call graph or the caller's intent — and the module that holds the rules says so
in its own header rather than shipping a heuristic that would be switched off within a week.

## Anchor

A law that cannot be pointed at in real code is a proposal. Each code below names a file in the
reference repository and what to look for there.

| Code | Anchor | What to look for |
|---|---|---|
| `DATA-1` | `src/modules/databases/postgresql/primary/primary.decorators.ts` | The house wrapper is one line: it binds the framework's own injector to a named connection constant. Beside it, `src/modules/databases/` holds three datasource families — which is the fact that makes an undecorated `EntityManager` ambiguous rather than merely untidy. |
| `DATA-2` | `src/features/api/core/graphql/mutations/courses/courses-checkout/courses-checkout.handler.ts` | One `entityManager.transaction` writing several tables through the callback's `manager`. A repository-shaped handler could not have written this without one handle per table, and the tables would then commit separately. Across `src/`, `@InjectRepository` and `Repository<…>` parameters occur zero times. |
| `DATA-3` | `src/modules/databases/postgresql/primary/entities/cart-item.entity.ts` | `@Entity("cart_items")` on a class named `CartItemEntity`. The two names deliberately differ, which is the point: the class can be renamed without the table following it. |
| `DATA-4` | `src/features/api/core/graphql/mutations/courses/course-enroll/checkout-advisory-lock.ts` | The helper's signature takes the work as `(manager: EntityManager) => Promise<Result>` and invokes it with the manager of the session that holds the lock. Nothing inside reaches for an injected manager. `src/modules/bussiness/achievements/achievements.service.ts` shows the same shape on private methods: every one takes `manager` as a parameter. |
| `DATA-5` | `src/features/api/core/graphql/queries/courses/my-cart/my-cart.handler.ts` | The `relations` tree is written at the call site, with a comment naming which screen needs each branch. Then read `cart-item.entity.ts` again: its `@ManyToOne` relations carry no `eager` option, so a caller wanting one column pays for one column. |

Every code is anchored. Anchors are paths in the reference repository and exist for verification
only; the examples in `example.md` name no product, no company and no repository.

## Inputs

| Input | Evidence required |
|---|---|
| datasource | Which connection this work touches, and the decorator that names it |
| handle | The injected `EntityManager`, or the transactional manager received as a parameter |
| writes | Every table this operation writes, including the ones a helper writes on its behalf |
| atomicity | Which of those writes must succeed or fail together |
| helpers | Every function called inside the transaction, and where each one gets its manager |
| answer | What the caller does with the result, and therefore which relations and columns it needs |

## Invariants

- An injected `EntityManager` names its datasource at the injection site.
- Persistence never arrives as a repository, by decorator or by type.
- An entity names its table; the table name is never a consequence of the class name.
- Work that must be undone together runs in one transaction.
- Everything inside a transaction receives the transactional manager as an argument.
- A relation is asked for by the call site that needs it, never granted by the entity to everyone.
- Every persistence-touching constructor, entity and multi-write operation resolves to exactly one
  code per situation. No operation is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the code it applies
to.

- **The options form of `@Entity`.** Under `DATA-3`, `@Entity({ name: "t", schema: "s" })` is
  equally valid and is not a style to discourage. It is the only form that can also carry a schema
  qualifier, so refusing it would push an author to delete the schema in order to satisfy the rule —
  a worse outcome than the inferred name the code exists to prevent.
- **A manager taken from an explicit query runner.** Under `DATA-4`, the transactional manager does
  not have to arrive from a `transaction()` callback. A helper that opens its own query runner to
  hold a session-scoped lock and then passes **that runner's** manager inward is inside one unit of
  work and satisfies the code. What the rule forbids is a callee reaching for an injected manager,
  not a particular factory. See `audit.md` — this reading is inferred from the anchor rather than
  stated by the older flat law, and is recorded as a tension rather than assumed.
- **`DATA-4` and `DATA-5` are read by a person.** They are not softer than the other three; they are
  held by a different tier. A reviewer who cannot answer "where did this helper get its manager" has
  found the defect, not an ambiguity in the rule.
- **Adoption debt.** All three rules measured at zero offenders in the reference repository and
  therefore ship at `error`. A repository adopting them into an existing tree measures first and
  lands anything above zero at `warn` with the count beside it, burns it down, and flips to `error`
  at zero. Shipping at `error` with debt outstanding blocks every commit that touches an offender,
  which is how a correct rule gets removed.

## Output

```text
datasource: <connection the decorator names>
handle: <injected EntityManager | transactional manager parameter>
writes: <every table this operation writes>
situation: <DATA-1 | DATA-2 | DATA-3 | DATA-4 | DATA-5>
placement: <where the decision must be stated: injection site, entity, transaction, call site>
reason: <the second write, or the caller whose cost this decision moves>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, `audit.md` only while reviewing the canon, and
`changelog.md` when a version marker disagrees with what you are reading.

## Scope

This module states a rule true of any relational back end with a unit-of-work handle. Its examples
are ordinary TypeScript in a Nest-shaped application and name no product, no company and no
repository. The Anchor table is the only place carrying repository paths, and it carries them as
verification, not as illustration.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. A
major bump (`x.00`) is for a change to the module's shape or the shelf it sits on. Situation codes
are never renumbered: a code that is retired is recorded as retired and its number is not reused.
