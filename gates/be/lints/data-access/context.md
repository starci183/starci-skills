---
title: Data-access
runtime: true
source: en.md
sourceHash: 21c7996550a4976fbf36fd810bd853fc87652fcd4e944982db96b215b58ec242
contextVersion: 1
---

# Data-access

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
which published rule fired, on which node, which law code that maps to, and the open hatch that would
have hidden the same failure. This module chooses no design. It refuses one, and it must be able to
point at the parameter or the decorator it refuses on.

## Law

The law is `patterns/data-access.md`. It states five things. An injected manager names the datasource
it belongs to (`DATA-1`). Persistence never arrives as a repository (`DATA-2`). An entity names its
table (`DATA-3`). A transaction is passed to everything that must run inside it (`DATA-4`). A query
states what it needs, and the entity does not decide it (`DATA-5`).

The law states **five codes. Three of them have a rule.** This module does not restate the law; it
records ENFORCEMENT — the exact node a machine looks at, and the ways of writing that walk past it
untouched. A law with no rule is known to be unenforced and gets read by a person. A leaky rule is
BELIEVED to be closed, and nobody reads it at all, so the open table below is the reason this document
exists, not an appendix to it.

## Published rules

The identity of each rule is its name; there is no numeric code for a rule, because the name is
already the string that appears in a build log, in a disable comment and in every conversation about
the failure.

| Rule | Code | What it reports |
|---|---|---|
| `must-inject-entity-manager` | `DATA-1` | A constructor parameter annotated `EntityManager` that carries no decorator whose name matches the datasource-naming family, reported at the parameter itself |
| `no-injected-repository` | `DATA-2` | A constructor parameter that either carries an `InjectRepository` decorator or is annotated with one of three repository type names, reported at the parameter |
| `require-entity-table-name` | `DATA-3` | An `@Entity(...)` call whose arguments contain no string table name, reported at the whole decorator |

Every published rule maps to a code, and the mapping is one-to-one. `DATA-4` (a transaction is passed
to everything that must run inside it) and `DATA-5` (a query states what it needs) have **no rule at
all**: whether a helper was handed the caller's transactional manager needs the call graph, and
whether a relation should have been asked for at the call site needs to know what the answer is for.
Both are deliberately unenforced rather than covered, and a green run says nothing whatever about
either of them.

## Reading a diff

1. **Decide scope before anything else, and record it.** Scope here is the consuming configuration's
   glob. A file no glob names is a file no rule here exists for — out of scope does not mean the file
   passed, it means nothing was judged.
2. **Check the parser.** Without TypeScript parsing with decorator and parameter-property support,
   `TSParameterProperty`, `TSTypeReference` and `Decorator` never appear and all three rules go
   permanently silent while still reporting green.
3. **Read the nodes, not the intent.** Two rules visit constructor parameters; one visits decorators.
   Nothing else in the file is looked at.
4. **Read the type-reference identifier first.** Both parameter rules stop the moment the annotation
   is not a `TSTypeReference` whose `typeName` is an `Identifier`, so one namespace prefix or one
   alias defeats both.
5. **Emit one block per finding.**
6. **Write the `hatch` line whenever an open hatch applies** — silence that a hatch explains is a
   claim that the writing is unreviewed, not a claim that it is clean.
7. **Do not report what no rule watches.** Two of the five codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `must-inject-entity-manager` — DATA-1

**What it reports.** A constructor parameter whose type annotation is written exactly `EntityManager`
and which carries no decorator whose name matches `/^Inject\w*EntityManager$/`, reported at the
unwrapped parameter. The message names the replacement and the consequence: the type cannot say WHICH
of several databases, so the code reads correctly and points at another one.

**How it detects.** Visits `MethodDefinition` and continues only when `node.kind === "constructor"`
and `node.value.params` exists. For each parameter: unwraps `TSParameterProperty` to its `.parameter`,
then reads `param.typeAnnotation.typeAnnotation` and requires `TSTypeReference` whose
`typeName.type === "Identifier"`. Continues only when that identifier's `name` is exactly
`EntityManager`. Collects decorator names from TWO carriers — the original node and, when it is a
`TSParameterProperty`, its inner parameter — taking `expression.callee.name` for a `CallExpression`
with an `Identifier` callee and `expression.name` for a bare `Identifier`. Silent when any collected
name matches the regex; otherwise reports on the unwrapped parameter.

**What it cannot see.** `@InjectEntityManager()`, the framework's own bare decorator, because `\w*`
matches the empty string and a decorator's ARGUMENTS are never read — a decorator that names no
connection satisfies a rule whose whole message is about naming the connection. `@InjectAnythingEntityManager()`
for a datasource that does not exist, for the same reason: the rule checks a shape of NAME, never that
the name corresponds to a registered connection. A locally declared decorator spelled to fit, since no
import is resolved. `em: typeorm.EntityManager`, which parses as `TSQualifiedName`.
`import { EntityManager as Manager }` then `em: Manager`, and `type Manager = EntityManager` — the
rule compares the written identifier. `em: EntityManager | undefined`, a `TSUnionType` the annotation
reader returns null for. A class property, `@Inject(MANAGER) private readonly em: EntityManager`,
because a `PropertyDefinition` is never visited. `this.dataSource.manager`,
`this.dataSource.createEntityManager()` and `moduleRef.get(EntityManager)`, none of which is a
parameter: the rule guards the injection SITE, and a manager acquired at runtime carries no site to
guard while the datasource is chosen just as invisibly. A class holding no manager at all — there is
nothing to report on, and the rule's name promises a manager must be injected while what it actually
does is constrain one that already is. A factory provider, `useFactory: (em: EntityManager) => …`,
whose parameters are a function expression's, not a constructor's.

**Boundary.** This rule judges how a manager parameter is named and decorated. Whether persistence
should have arrived as a manager at all is `DATA-2`.

## `no-injected-repository` — DATA-2

**What it reports.** A constructor parameter satisfying either branch: the collected decorator names
contain the exact string `InjectRepository`, OR the parameter's type-reference identifier matches
`/^(?:Repository|TreeRepository|MongoRepository)$/`. One report per parameter regardless of which
branch matched.

**How it detects.** The same constructor walk, the same `TSParameterProperty` unwrap and the same
decorator collection as `must-inject-entity-manager`, so the two rules agree exactly on what counts as
a constructor parameter and on what a decorator is called. Type arguments are never read: the
identifier alone decides.

**What it cannot see.** `class UserRepository extends Repository<UserEntity>` injected as
`repo: UserRepository` — membership is three exact names, so the very thing the law forbids goes
unrecognised. `AbstractRepository`, `MongoEntityManager`, or any other handle name, by the same closed
list. `@Inject(getRepositoryToken(UserEntity)) private readonly repo: unknown`, where the decorator
name is `Inject` and the type is not on the list: the injection succeeds and the rule says nothing.
`this.entityManager.getRepository(UserEntity)` inside a method body — the most common way a repository
actually appears is a call expression, and the rule watches parameters only. A namespaced or aliased
type name, `orm.Repository<T>` or `type UserRepo = Repository<UserEntity>`, the same blind spot the
first rule has. A class property rather than a parameter. A repository handed in as a method parameter
or a function argument, which is not a constructor parameter.

**Boundary.** This rule judges the shape of a declared parameter. A handle acquired inside a method
body is not an exception to it; it is outside it.

## `require-entity-table-name` — DATA-3

**What it reports.** An `@Entity(...)` call whose argument list contains nothing that names the table,
reported on the whole `Decorator` node rather than on an argument. A table name is recognised in two
forms: a direct string literal, or an options object carrying a non-computed `name` key holding one.

**How it detects.** Visits `Decorator`. Requires `node.expression.type === "CallExpression"`,
`callee.type === "Identifier"` and `callee.name === "Entity"` — three conditions, each of which
returns early. A table name counts when some argument is a `Literal` with `typeof value === "string"`,
or a `TemplateLiteral`, or an `ObjectExpression` holding a non-computed `Property` whose key `name` or
`value` is `name` and whose value is one of those two literal forms. Otherwise reports on the
`Decorator` node. The node the decorator is attached to is never inspected. The options form is
accepted deliberately: it is the only form that can still carry a schema specification, so refusing it
would push writers to delete the schema to satisfy the rule — a worse outcome than the inferred name
the rule exists to prevent.

**What it cannot see.** `@Entity("")` — an empty string is a `Literal` whose value is a string, so the
check passes, the ORM falls back to the class name, and the exact outcome the rule exists to prevent
is reached through the rule's own accepting branch. `` @Entity(`${prefix}_items`) `` and an empty
template `` @Entity(``) ``, because a `TemplateLiteral` is accepted unconditionally: the rule
recognises a node TYPE, never a value. `@Entity` written with no parentheses, whose expression is an
`Identifier` and which fails the first guard before the rule looks at anything.
`import { Entity as Table }` then `@Table("cart_items")` or `@Table()` — an alias makes the rule not
exist for that file. `@Orm.Entity()`, a member-expression callee. `@ViewEntity()`, `@ChildEntity()`
and every other entity-declaring decorator, since only the exact name `Entity` is watched. A schema
object built in code rather than declared with a decorator, which presents no decorator node at all.
And the reverse failure: `@Entity(TABLES.cartItems)` and `@Entity({ name: TABLE_NAME })` are both
reported although the table is properly named — here the habit of hoisting strings into a constant
runs backwards and makes the rule fire wrongly, as do a computed key `@Entity({ ["name"]: "cart" })`
and `@Entity({ ...OPTIONS })` alone.

**Boundary.** This rule judges the decorator's arguments only. What the class beneath it declares, and
what any query later asks that entity for, is `DATA-5` and has no rule.

## Detection

| Part | Mechanism |
|---|---|
| path gate | None at rule level. The consuming configuration's glob decides which files are linted; no rule reads a file path |
| parser requirement | TypeScript with decorator and parameter-property support. Without it `TSParameterProperty`, `TSTypeReference` and `Decorator` never appear and all three rules go permanently silent |
| shared constructor walk | `MethodDefinition` with `node.kind === "constructor"` and `node.value.params`; each parameter unwrapped from `TSParameterProperty` to its `.parameter` before anything else is read |
| shared annotation reader | `param.typeAnnotation.typeAnnotation` must be a `TSTypeReference` whose `typeName.type === "Identifier"`; the written identifier is compared as a whole string |
| shared decorator reader | Names collected from TWO carriers — the original node and, when it is a `TSParameterProperty`, its inner parameter — taking `expression.callee.name` for a `CallExpression` with an `Identifier` callee and `expression.name` for a bare `Identifier` |
| decorator visitor | `Decorator` nodes, gated on `CallExpression` + `Identifier` callee + the exact name `Entity`, then `.some` over the whole argument list |
| reaching outside the file | Nothing. No rule reads type information, resolves an import, follows a call or reads a file path — everything is decided from written shape |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Rule | Why it still fires |
|---|---|---|
| `constructor(private readonly em: EntityManager)` | `must-inject-entity-manager` | The parameter property is unwrapped before the type is read, so the annotation is found on the inner parameter |
| `constructor(em?: EntityManager)` | `must-inject-entity-manager` | Optionality lives on the parameter, not on the annotation; the type reference is unchanged |
| `constructor(readonly em: EntityManager)` with no access modifier keyword | `must-inject-entity-manager` | Still a `TSParameterProperty`; the unwrap does not care which modifier produced it |
| A decorator written without parentheses — `@InjectPrimaryEntityManager` | `must-inject-entity-manager` | The bare `Identifier` branch collects the name, so the rule stays silent exactly as it would for the call form |
| A decorator placed on the inner parameter rather than on the parameter property | `must-inject-entity-manager` | Both carriers are read; whichever node the parser attached it to, the name is collected |
| `Repository<UserEntity>` | `no-injected-repository` | Type arguments are ignored; the rule reads the type-reference identifier, which is `Repository` |
| `@InjectRepository(UserEntity) private readonly em: EntityManager` | `no-injected-repository` | The decorator branch fires on its own; the parameter's type is irrelevant once the decorator matches |
| `constructor(repo: TreeRepository<NodeEntity>)` with no decorator at all | `no-injected-repository` | The type branch does not need a decorator |
| `@Entity({ schema: "public" })` | `require-entity-table-name` | An options object with no `name` property does not name the table, and refusing it is the point of allowing the options form at all |
| `@Entity({ "name": "cart_items" })` | `require-entity-table-name` | A string-literal key is accepted: the check reads `property.key.name` OR `property.key.value` |
| `@Entity({ ...base, name: "cart_items" })` | `require-entity-table-name` | The spread is skipped and the `name` property is still found by `.some` |
| `@Entity("cart_items", { schema: "public" })` | `require-entity-table-name` | Any argument may carry the name; the check is over the whole argument list |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Written this way | Rule | Why the rule cannot see it |
|---|---|---|
| `@InjectEntityManager()` — the framework's own bare decorator | `must-inject-entity-manager` | The regex is `^Inject\w*EntityManager$` and `\w*` matches the empty string. The decorator's ARGUMENTS are never read, so a decorator that names no connection satisfies a rule whose whole message is about naming the connection. This is the single most consequential row in this table |
| `@InjectAnythingEntityManager()` for a datasource that does not exist | `must-inject-entity-manager` | Same reason. The rule checks a shape of NAME, never that the name corresponds to a registered connection |
| A locally declared decorator that happens to be spelled right | `must-inject-entity-manager` | Decorator identity is a string. No import is resolved, so any function with a conforming name silences the rule |
| `em: typeorm.EntityManager` | `must-inject-entity-manager`, `no-injected-repository` | A qualified name parses as `TSQualifiedName`, and both rules require `typeName.type === "Identifier"`. The namespace import form is invisible to the whole module |
| `import { EntityManager as Manager }`, then `em: Manager` | `must-inject-entity-manager` | The rule compares the written identifier. Any alias, and any `type Manager = EntityManager`, empties it |
| `em: EntityManager \| undefined` | `must-inject-entity-manager` | A union is `TSUnionType`, not `TSTypeReference`; the annotation reader returns null and the parameter is skipped |
| A class property — `@Inject(MANAGER) private readonly em: EntityManager` | `must-inject-entity-manager`, `no-injected-repository` | A `PropertyDefinition` is not visited. Only constructor parameters exist for these two rules |
| `this.dataSource.manager`, `this.dataSource.createEntityManager()`, `moduleRef.get(EntityManager)` | `must-inject-entity-manager` | None of these is a parameter. The rule guards the injection SITE; a manager acquired at runtime carries no site to guard, and the datasource is chosen just as invisibly |
| A class holding no manager at all | `must-inject-entity-manager` | There is nothing to report on. The rule's name promises a manager must be injected; what it actually does is constrain one that already is |
| A factory provider — `useFactory: (em: EntityManager) => …` | `must-inject-entity-manager`, `no-injected-repository` | A function expression's parameters are not a constructor's. Providers built this way are outside both rules |
| `class UserRepository extends Repository<UserEntity>` injected as `repo: UserRepository` | `no-injected-repository` | Membership is three exact names. A custom repository class is the very thing the law forbids and the rule has no way to recognise it |
| `AbstractRepository`, `MongoEntityManager`, or any other handle name | `no-injected-repository` | Same closed list of three |
| `@Inject(getRepositoryToken(UserEntity)) private readonly repo: unknown` | `no-injected-repository` | The decorator name is `Inject`, not `InjectRepository`, and the type is not on the list. The injection succeeds and the rule says nothing |
| `this.entityManager.getRepository(UserEntity)` inside a method | `no-injected-repository` | A repository obtained from a legally injected manager is a call expression in a method body. The rule watches parameters only, so the most common way a repository actually appears is unwatched |
| A repository handed in as a method parameter or a function argument | `no-injected-repository` | Not a constructor parameter |
| `@Entity("")` | `require-entity-table-name` | An empty string is a `Literal` whose value is a string, so the check passes. The ORM then falls back to the class name — the exact outcome the rule exists to prevent, reached through the rule's own accepting branch |
| `` @Entity(`${prefix}_items`) `` | `require-entity-table-name` | A `TemplateLiteral` is accepted unconditionally, substitutions and all. `` @Entity(``) `` — an empty template — also passes |
| `@Entity` written with no parentheses | `require-entity-table-name` | The expression is an `Identifier`, and the first guard requires a `CallExpression`. The rule returns before it looks at anything |
| `import { Entity as Table }`, then `@Table("cart_items")` or `@Table()` | `require-entity-table-name` | The callee name is compared to the literal string `Entity`. An alias makes the rule not exist for that file |
| `@Orm.Entity()` | `require-entity-table-name` | A member-expression callee fails `callee.type === "Identifier"` |
| `@ViewEntity()`, `@ChildEntity()`, and every other entity-declaring decorator | `require-entity-table-name` | Only the exact name `Entity` is watched |
| A schema object built in code rather than declared with a decorator | `require-entity-table-name` | There is no decorator node. An entity declared this way is outside the rule entirely |
| Everything `DATA-4` and `DATA-5` forbid — a helper run outside the caller's transaction, a relation the entity decides instead of the query | neither | No rule exists. Both need the call graph or the purpose of the answer, and neither is available from written shape |

## Rules

1. A rule's identity is its published name. No rule carries a numeric code, and no message is
   addressed by anything but the rule name.
2. Every rule reports at a node a reader can put a cursor on: the offending parameter, or the whole
   decorator.
3. No rule reads type information, resolves an import, follows a call or reads a file path. Everything
   in this module is decided from written shape.
4. Two rules share one constructor walk and one decorator reader, so they agree exactly on what counts
   as a constructor parameter and on what a decorator is called.
5. A decorator's NAME is evidence; a decorator's ARGUMENTS are never read by any rule here.
6. Message text names the replacement and the consequence, not only the offence.
7. The rules are shape rules and cannot see intent. Every one of them is deliberately narrow because
   of it, and the cost of that narrowness is the open table above.

## Exceptions

- **A runtime-acquired handle is not an exception, it is a blind spot.** Nothing permits
  `dataSource.manager` or `manager.getRepository(...)`; the rules simply have no parameter to look at.
  Treat it as unenforced law, not as permitted writing.
- **A bare datasource-naming decorator is not permitted.** The rule accepts it because its regex
  allows an empty middle, not because the law does. The law wants the connection NAMED, and a
  decorator with no name in it satisfies neither the law nor the message the rule prints.
- **A custom repository class is not permitted.** The three-name list bounds what a machine will
  claim, not what the law forbids. Review remains the enforcement for everything the list omits.
- **An indirect table name is refused, and that refusal is the rule's cost, not the law's.** A
  constant or an imported table map is a legitimate way to name a table, and `require-entity-table-name`
  reports it anyway. Prefer the literal here rather than disabling the rule for the file; disabling it
  once removes the guard from every entity in that file.
- **A generated or vendored file** is outside every rule here by way of the consuming glob, not by way
  of any rule-level exemption.

## Output

One block per finding:

```text
rule: <must-inject-entity-manager | no-injected-repository | require-entity-table-name>
code: <DATA-1 | DATA-2 | DATA-3>
node: <the exact node the rule visits>
verdict: <fires | silent>
hatch: <none | the open row from the table above that explains the silence>
```

A clean file emits one block per rule that ran, each with `verdict: silent` and `hatch: none` — a
claim that the writing was judged and found clean. A `silent` verdict that names a hatch is a claim
that the writing is unreviewed: a different fact, and the one this module exists to keep sayable. A
file outside the consuming glob emits no block at all, and the absence must be recorded as *not
judged*, never as clean — no visitor was installed and the rules did not exist for that file.
