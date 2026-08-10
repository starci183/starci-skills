# data access

## Definition

Persistence goes through an `EntityManager`, injected by a decorator that names which datasource it
belongs to. There is no repository injection here, and no ambient default connection: both of those
are handles that look identical whichever database they are pointed at, and this application has
more than one database.

The whole law follows from one property. An `EntityManager` is a **unit of work that can be passed**
— handed to a helper, wrapped in a transaction, swapped for a transactional one — and a repository
is not, because it is bound to one entity for its whole life. The moment a use case needs to write
two tables atomically, code built on repositories has to be rewritten rather than extended, and the
rewrite lands in whatever module noticed first.

The question that settles it: **could this operation grow a second write?** It nearly always can,
and a handle that cannot carry the transaction across the pair is the wrong handle from the start.

What holds this law is [`sources/be/data-access.mjs`](../../../sources/be/data-access.mjs).

## Rules

**DATA-1 · An injected `EntityManager` names its datasource through a decorator.**

`@InjectPrimaryPostgreSQLEntityManager()`, never a bare `EntityManager` parameter. The type says
nothing about which connection it is: a manager for the primary database and one for an analytics
or sandbox replica are the same type, so an undecorated parameter reads correctly and can be wired
to the wrong data.

The decorator is a house wrapper around the framework's own injector, and it exists so that the
connection is named at the injection site — the one place a reader looks to answer "which database
does this touch".

**DATA-2 · Persistence never arrives as an injected repository.**

Not `@InjectRepository`, not a `Repository<T>` parameter. A repository is bound to one entity, so a
handler holding one cannot carry a transaction into a second table, and a use case that grows a
second write is rewritten rather than extended. The manager is the handle that survives the growth.

**DATA-3 · An entity names its table.**

`@Entity("cart_items")`, never `@Entity()`. Left to infer, TypeORM derives the table name from the
class name — so renaming the class renames the table, and under `synchronize` a rename is performed
as a DROP and CREATE rather than as a migration. A class rename is a refactor; a dropped table is
an outage.

The options form is equally valid and is not a style to discourage: it is the only form that can
also carry a schema qualifier, so refusing it would push an author to delete the schema to satisfy
the rule.

**DATA-4 · The transaction is the unit of work, and it is passed, not implied.**

Work that must succeed or fail together runs inside one transaction, and everything inside it takes
the transactional manager as an argument. A helper that reaches for its own injected manager while
its caller is mid-transaction writes outside that transaction and commits independently — which is
invisible in review and only shows up as half-written state under load.

**DATA-5 · A query says what it needs, and the entity does not decide it.**

Relations, selects and ordering belong to the call site that knows what the answer is for. An entity
with eager relations answers every query the same expensive way, and the cost lands on the caller
who needed one column.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A bare `EntityManager` constructor parameter | The type does not say which datasource, and this application has more than one | Name it with the house `@Inject*EntityManager()` decorator |
| `@InjectRepository(...)` | It binds the handle to one entity, so a second write cannot join the transaction | Inject the `EntityManager` |
| A `Repository<T>` / `TreeRepository<T>` parameter | Same, wearing a type instead of a decorator | Same |
| `@Entity()` with no table name | The table name follows the class name, and a rename becomes a DROP under `synchronize` | `@Entity("table_name")` |
| A helper reaching for its own manager inside a caller's transaction | It writes outside the transaction and commits on its own, leaving half-written state | Pass the transactional manager in |
| Eager relations on an entity | Every query pays for the heaviest caller's needs | Ask for the relation at the call site that wants it |

## Examples

### The ordinary case — the connection is named where it is injected

```ts
constructor(
    @InjectPrimaryPostgreSQLEntityManager()
    private readonly entityManager: EntityManager,
) { super() }
```

```ts
// Wrong: reads correctly, compiles, and can be wired to the sandbox replica without anyone
// noticing - because nothing here says which database this is.
constructor(private readonly entityManager: EntityManager) { super() }
```

They differ in one thing: whether the datasource is stated where it is chosen.

### The handle trap

```ts
// The manager carries the whole unit of work, so a second write joins the first.
await this.entityManager.transaction(async (manager) => {
    await manager.save(enrollment)
    await manager.increment(WalletEntity, { userId }, "spent", price)
})
```

```ts
// Wrong: two repositories, two units of work. The wallet can move while the enrollment fails,
// and nothing in the type system objects.
await this.enrollments.save(enrollment)
await this.wallets.increment({ userId }, "spent", price)
```

They differ in one thing: whether the two writes can be undone together.

### The passing trap — the subtle one

```ts
// The helper is given the transaction it must run inside.
await this.entityManager.transaction(async (manager) => {
    await this.grantXp(manager, userId, amount)
})
```

```ts
// Wrong: `grantXp` injects its own manager, so it writes on a second connection and commits
// independently. The outer rollback leaves the XP behind.
await this.entityManager.transaction(async () => {
    await this.grantXp(userId, amount)
})
```

They differ in one thing: whether the helper is inside the transaction it appears to be inside.

### The table-name trap

```ts
@Entity("cart_items")
export class CartItemEntity { /* ... */ }
```

```ts
// Wrong: the table is called `cart_item_entity` because the class is. Rename the class to
// `CartLineEntity` and `synchronize` drops the table and creates an empty one.
@Entity()
export class CartItemEntity { /* ... */ }
```

They differ in one thing: whether a class rename is a refactor or an outage.
