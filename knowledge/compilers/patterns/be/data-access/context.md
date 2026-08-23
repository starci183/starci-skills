# Data-access

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is a shape already accepted: an operation, an entity or a capability whose behaviour is settled. This module does not re-open that decision. Its output is source architecture — which handle the constructor takes, which decorator names it, which file states the table name, which layer holds the transaction, and where a relation is asked for. The shape says what the system does; this pattern says where the code that does it lives and what it must look like.

## Law

Persistence goes through an `EntityManager`, injected by a decorator that names which datasource it belongs to. There is no repository injection here, and no ambient default connection: both of those are handles that look identical whichever database they are pointed at, and this application has more than one.

The whole law follows from one property. An `EntityManager` is a **unit of work that can be passed** — handed to a helper, wrapped in a transaction, swapped for a transactional one — and a repository is not, because it is bound to one entity for its whole life. The moment a use case needs to write two tables atomically, code built on repositories has to be rewritten rather than extended, and the rewrite lands in whatever module noticed first.

The question that settles it: **could this operation grow a second write?** It nearly always can, and a handle that cannot carry the transaction across the pair is the wrong handle from the start.

**This is binding, not advisory.** Every constructor that touches persistence, every entity class and every multi-write operation carries exactly one situation code below, and there is no operation small enough to be exempt: a single-row read is `DATA-1` for the same reason a settlement is. "It is only one table" is the most common place this rule gets skipped, because the second table arrives later and by then the handle is already wrong.

## Situation codes

Every situation this module governs carries a code, `DATA-<n>`. The numbers are fixed and are cited from other law files and from task records; a code keeps its number and its meaning for as long as it exists.

| Code | Situation | What the source must look like |
|---|---|---|
| `DATA-1` | A handle is being injected into a constructor: which database does this touch? | An injected `EntityManager` whose parameter carries an `@Inject*EntityManager()` decorator naming the datasource. Forbidden: a bare `EntityManager` constructor parameter; relying on the framework's default connection |
| `DATA-2` | The shape of the handle is being chosen | Persistence reached through the `EntityManager`. Forbidden: `@InjectRepository(...)`; a `Repository<T>`, `TreeRepository<T>` or `MongoRepository<T>` parameter |
| `DATA-3` | A new entity is being declared, or an entity class is about to be renamed | `@Entity("table_name")`, or `@Entity({ name: "table_name" })` when a schema qualifier is also needed. Forbidden: `@Entity()` with the table name left to be inferred from the class name |
| `DATA-4` | Several writes must live or die together | Work that must succeed or fail together running in one transaction, with the transactional manager passed to everything inside it. Forbidden: a helper reaching for its own injected manager while its caller is mid-transaction |
| `DATA-5` | What is this answer for, and who pays for it | Relations, selects and ordering stated at the call site that knows what the answer is for. Forbidden: `eager` relations on an entity |

`DATA-1` AND `DATA-2` READ THE SAME CONSTRUCTOR PARAMETER AND ARE NOT THE SAME FACT. `DATA-1` is about a handle that does not say **which database** it points at; `DATA-2` is about a handle that cannot **grow a second write** whichever database it points at. A perfectly decorated repository injection satisfies neither, and a bare `EntityManager` fails only the first. They are two codes because they fail independently and are fixed differently.

## Reading an accepted shape

1. Read what the shape states: which operation exists, which tables it touches, which answer it returns. This is settled and is not re-argued here.
2. Read what the shape does not state, and therefore does not resolve: it never says which datasource the handle points at, which handle shape the constructor takes, what the table is called, which writes must be undone together, or which relations a call site needs. Those five gaps are what this module resolves, and nothing else is invented to fill them.
3. Resolve outermost first: datasource before handle shape, handle shape before transaction, transaction before the relations a single call site asks for. An inner decision made on a wrong outer one is made twice.
4. Ask each code's question in order. `DATA-1`: does the injection site say which database this is? `DATA-2`: can this handle carry a second write? `DATA-3`: does the entity name its own table? `DATA-4`: does everything inside the transaction receive the transactional manager as an argument? `DATA-5`: is each relation asked for by the call site that needs it?
5. When two codes both match, they both apply — they are not alternatives. A repository injection fails `DATA-1` and `DATA-2` at once and is fixed by two different edits; a correctly injected manager used from inside somebody else's transaction fails `DATA-4` while passing `DATA-1` cleanly. Emit one output block per situation, never one block covering both.

## `DATA-1` — the handle must say which database it points at

**Situation.** A constructor is being written for a service, a handler or a cron that touches data. The type `EntityManager` says nothing about the connection: the manager of the primary database and the manager of an analytics replica or a sandbox are the same type.

**What it emits in source.** A constructor parameter typed `EntityManager` whose parameter carries an `@Inject*EntityManager()` decorator naming the datasource. The house wrapper is one line: it binds the framework's own injector to a named connection constant. The application holds more than one datasource family, which is the fact that makes an undecorated `EntityManager` ambiguous rather than merely untidy.

**Recognition signs.** A constructor parameter typed `EntityManager` with no decorator in front of it. Reading the file top to bottom finds not one word saying which database this is. The module wiring is correct, so the code runs — until the day someone changes the default provider.

**Boundary.** Not `DATA-2`: `DATA-1` says the handle **does not declare** where it points; `DATA-2` says the handle is the **wrong shape** even when it points in the right place. A carefully written `@InjectRepository` fails both; a bare `EntityManager` fails only the first. Not `DATA-4` either: `DATA-1` reads the **injection site**, `DATA-4` reads the **place of use** — a correct injection can still be used wrongly by reaching for one's own manager while the caller holds a transaction.

## `DATA-2` — the handle must be able to carry a second write

**Situation.** The shape of the handle is being chosen. A repository looks more convenient: it already knows the entity, the calls are shorter, the IDE suggests better. But it is **bound to one entity**, so the day this operation must write one more table, it cannot travel with it.

**What it emits in source.** Persistence reached through the `EntityManager`, never through a repository — neither the `@InjectRepository` decorator nor the types `Repository`, `TreeRepository` or `MongoRepository` on a constructor parameter. Catching the type as well as the decorator matters, because the type alone is enough to bind the handle. One `entityManager.transaction` writing several tables through the callback's `manager` is the shape this code produces; a repository-shaped handler could not have written it without one handle per table, and the tables would then commit separately.

**Recognition signs.** A constructor carrying `@InjectRepository(...)`, or a parameter typed `Repository<T>` / `TreeRepository<T>` / `MongoRepository<T>`. A handler holding two or three repositories — one per table — with the writes sitting side by side and nothing wrapping them. The sentence "this does not need a transaction yet" appearing in code review.

**Boundary.** Not `DATA-1`: see above. Not `DATA-4`: `DATA-2` says you **have** a unit of work that can be passed; `DATA-4` says whether you **actually passed it**. Fixing `DATA-2` does not make `DATA-4` correct.

## `DATA-3` — the entity must name its own table

**Situation.** A new entity is being declared or — more dangerous — an entity class is being renamed to fit new business language. If the table name is left for the ORM to infer, it is inferred from the class name.

**What it emits in source.** `@Entity("table_name")` on the entity class, or `@Entity({ name: "table_name", schema: "..." })` when a schema qualifier is also needed. The class name and the table name deliberately differ, which is the point: the class can be renamed without the table following it.

**Recognition signs.** `@Entity()` with no argument. A table name in a migration matching the class name exactly, suffixes like `_entity` included. A class-rename pull request whose diff contains no migration file.

**Boundary.** Not `DATA-5`: both are decisions that sit on the entity, but `DATA-3` is about the table's **identity** while `DATA-5` is about the **cost** the entity imposes on every query. An entity that names its table perfectly can still make the whole system pay for an eager relation.

## `DATA-4` — the transaction is the unit of work, and it is passed, not assumed

**Situation.** A transaction is open. Inside it, a helper on another service is called to add points, write a log entry, emit a notification. That helper has its own manager, injected in its own constructor.

**What it emits in source.** Work that must succeed or fail together running in one transaction, with the transactional manager passed as an argument to everything inside it. The helper's signature takes the work as `(manager: EntityManager) => Promise<Result>` and invokes it with the manager of the session that holds it; private methods on a service take `manager` as a parameter the same way. Nothing inside reaches for an injected manager.

**Recognition signs.** A call inside a `transaction()` callback that does **not** receive `manager` as an argument. A helper using `this.entityManager` while its caller is mid-transaction. A bug that appears only under load and always has the shape "half of it was written".

**Boundary.** Not `DATA-2`: see above. Not `DATA-1`: a helper that violates `DATA-4` usually does not violate `DATA-1` at all — its manager is injected perfectly, it simply should not be used here. That is why this code cannot be caught by reading one file. **No lint holds this code.** Whether a helper was handed the caller's transactional manager is a fact about the call graph, not about any one file; a rule reading a single file would have to guess, and a guess here fires on correct code — which is how a correct rule gets disabled.

## `DATA-5` — the query states what it needs; the entity does not decide for it

**Situation.** Data is being fetched for one specific answer. Relations, columns and ordering are properties of **that answer**, not properties of the entity. The one who knows what is needed is the call site.

**What it emits in source.** Relations, selects and ordering stated at the call site that knows what the answer is for — a `relations` tree written in the handler, with the branch each screen needs named beside it. The entity's `@ManyToOne` relations carry no `eager` option, so a caller that wants one column pays for one column.

**Recognition signs.** A relation declared `eager` on an entity. A screen that needs one column receiving the whole relation tree. Someone "optimising" by adding eager for convenience, and the query count rising somewhere else.

**Boundary.** Not `DATA-3`: see above. Not `DATA-4`: both are "a decision made in the wrong place", but `DATA-4` is a decision about **atomicity** while `DATA-5` is a decision about **cost**. Getting `DATA-4` wrong loses data; getting `DATA-5` wrong degrades steadily. **No lint holds this code.** Whether a relation should have been asked for at the call site depends on what the answer is for, and nothing in the entity file says whether the caller needed one column or the whole tree.

## Layer held

Which tier actually holds each code. `unrepresentable` means the wrong value cannot be written; `enforced` means a named rule from `@canon-be` reports it; `documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | Held by |
|---|---|---|
| `DATA-1` | `enforced` | `starci-be/must-inject-entity-manager` — reports a constructor parameter typed `EntityManager` that carries no decorator matching `Inject*EntityManager`. It reads the parameter and its parameter-property wrapper, so `private readonly` does not hide the decorator from it. |
| `DATA-2` | `enforced` | `starci-be/no-injected-repository` — reports both spellings: the `@InjectRepository` decorator, and the type `Repository`, `TreeRepository` or `MongoRepository` on a constructor parameter. Catching the type as well as the decorator matters, because the type alone is enough to bind the handle. |
| `DATA-3` | `enforced` | `starci-be/require-entity-table-name` — reports `@Entity()` whose arguments carry no string table name, directly or as the `name` property of the options object. |
| `DATA-4` | `documented` | Whether a helper was handed the caller's transactional manager is a fact about the call graph, not about any one file. A rule reading a single file would have to guess, and a guess here fires on correct code — which is how a correct rule gets disabled. |
| `DATA-5` | `documented` | Whether a relation should have been asked for at the call site depends on what the answer is for. Nothing in the entity file says whether the caller needed one column or the whole tree. |

Two of five codes read `documented`, and that is the honest state rather than a gap to be papered over. The three that are enforced are exactly the three a parser can see in one file: a decorator on a parameter, a type on a parameter, and an argument to a decorator. The two that are not are the two that need either the call graph or the caller's intent — and the module that holds the rules says so in its own header rather than shipping a heuristic that would be switched off within a week.

## Inputs

| Input | Evidence required |
|---|---|
| datasource | Which connection this work touches, and the decorator that names it |
| handle | The injected `EntityManager`, or the transactional manager received as a parameter |
| writes | Every table this operation writes, including the ones a helper writes on its behalf |
| atomicity | Which of those writes must succeed or fail together |
| helpers | Every function called inside the transaction, and where each one gets its manager |
| answer | What the caller does with the result, and therefore which relations and columns it needs |

## Rules

1. An injected `EntityManager` names its datasource at the injection site.
2. Persistence never arrives as a repository, by decorator or by type.
3. An entity names its table; the table name is never a consequence of the class name. The options form is as valid as the string form.
4. Work that must be undone together runs in one transaction.
5. Everything inside a transaction receives the transactional manager as an argument.
6. A relation is asked for by the call site that needs it, never granted by the entity to everyone.
7. When it is not certain whether an operation will grow a second write, treat it as if it will. Choose the handle on that assumption, because changing the handle later costs far more than holding a handle wider than today's need.
8. Every persistence-touching constructor, entity and multi-write operation resolves to exactly one code per situation. No operation is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the code it applies to.

- **The options form of `@Entity`.** Under `DATA-3`, `@Entity({ name: "t", schema: "s" })` is equally valid and is not a style to discourage. It is the only form that can also carry a schema qualifier, so refusing it would push an author to delete the schema in order to satisfy the rule — a worse outcome than the inferred name the code exists to prevent.
- **A manager taken from an explicit query runner.** Under `DATA-4`, the transactional manager does not have to arrive from a `transaction()` callback. A helper that opens its own query runner to hold a session-scoped lock and then passes **that runner's** manager inward is inside one unit of work and satisfies the code. What the rule forbids is a callee reaching for an injected manager, not a particular factory. This reading is inferred from the anchor rather than stated by the older flat law, and is recorded as a tension rather than assumed.
- **`DATA-4` and `DATA-5` are read by a person.** They are not softer than the other three; they are held by a different tier. A reviewer who cannot answer "where did this helper get its manager" has found the defect, not an ambiguity in the rule.
- **Adoption debt.** All three rules measured at zero offenders in the reference repository and therefore ship at `error`. A repository adopting them into an existing tree measures first and lands anything above zero at `warn` with the count beside it, burns it down, and flips to `error` at zero. Shipping at `error` with debt outstanding blocks every commit that touches an offender, which is how a correct rule gets removed.

## Output

One block per file the accepted shape produces.

```text
datasource: <connection the decorator names>
handle: <injected EntityManager | transactional manager parameter>
writes: <every table this operation writes>
situation: <DATA-1 | DATA-2 | DATA-3 | DATA-4 | DATA-5>
placement: <where the decision must be stated: injection site, entity, transaction, call site>
reason: <the second write, or the caller whose cost this decision moves>
```
