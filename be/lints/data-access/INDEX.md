---
id: be-lints-data-access-index
title: INDEX.md
slug: /be/lints/data-access
sidebar_label: data-access
sidebar_position: 0
description: What the three data-access rules mechanically see, and — the part nobody writes down — what they do not.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `data-access`

## Law

The law is `patterns/data-access.md`. It states five things. An injected manager names the datasource
it belongs to (`DATA-1`). Persistence never arrives as a repository (`DATA-2`). An entity names its
table (`DATA-3`). A transaction is passed to everything that must run inside it (`DATA-4`). A query
states what it needs, and the entity does not decide it (`DATA-5`).

This shelf does not restate the law. It records ENFORCEMENT: the exact node a machine looks at, and
the ways of writing that walk past it untouched. A law with no rule is known to be unenforced and
gets read by a person. A leaky rule is BELIEVED to be closed, and nobody reads it at all — so the
open table below is the reason this file exists, not an appendix to it.

Two of the five codes have no rule and are not meant to have one. That is a decision the source
states in its own header, and it is recorded in `audit.md` rather than mapped here.

## Rules

Three rules are published. The identity of each is its name; there is no numeric code for a rule,
because the name is already the string that appears in a build log, in a disable comment and in every
conversation about the failure.

| Rule | Law code | What it reports |
|---|---|---|
| `must-inject-entity-manager` | `DATA-1` | A constructor parameter annotated `EntityManager` that carries no decorator whose name matches the datasource-naming family, reported at the parameter itself |
| `no-injected-repository` | `DATA-2` | A constructor parameter that either carries an `InjectRepository` decorator or is annotated with one of three repository type names, reported at the parameter |
| `require-entity-table-name` | `DATA-3` | An `@Entity(...)` call whose arguments contain no string table name, reported at the whole decorator |

Every published rule maps to a code, and the mapping is one-to-one. `DATA-4` and `DATA-5` have no
rule: whether a helper was handed the caller's transactional manager needs the call graph, and
whether a relation should have been asked for at the call site needs to know what the answer is for.
Both are recorded in `audit.md`.

## Detection

| Rule | Mechanism |
|---|---|
| `must-inject-entity-manager` | Visits `MethodDefinition` and continues only when `node.kind === "constructor"` and `node.value.params` exists. For each parameter: unwraps `TSParameterProperty` to its `.parameter`, then reads `param.typeAnnotation.typeAnnotation` and requires `TSTypeReference` whose `typeName.type === "Identifier"`. Continues only when that identifier's `name` is exactly `EntityManager`. Collects decorator names from TWO carriers — the original node and, when it is a `TSParameterProperty`, its inner parameter — taking `expression.callee.name` for a `CallExpression` with an `Identifier` callee and `expression.name` for a bare `Identifier`. Silent when any collected name matches `/^Inject\w*EntityManager$/`; otherwise reports on the unwrapped parameter. |
| `no-injected-repository` | Same constructor walk, same unwrap, same decorator collection. Fires when the collected names contain the exact string `InjectRepository`, OR when the parameter's type-reference identifier matches `/^(?:Repository\|TreeRepository\|MongoRepository)$/`. One report per parameter regardless of which branch matched. Type arguments are never read: the identifier alone decides. |
| `require-entity-table-name` | Visits `Decorator`. Requires `node.expression.type === "CallExpression"`, `callee.type === "Identifier"` and `callee.name === "Entity"` — three conditions, each of which returns early. A table name counts when some argument is a `Literal` with `typeof value === "string"`, or a `TemplateLiteral`, or an `ObjectExpression` holding a non-computed `Property` whose key `name` or `value` is `name` and whose value is one of those two literal forms. Otherwise reports on the `Decorator` node. The node the decorator is attached to is never inspected. |

All three decide from the syntax tree alone. No rule reads type information, resolves an import,
follows a call, or looks at a file path.

## Escape Hatches

### Closed — looks like it would slip past, does not

| Way of writing | Rule | Why it still fires |
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

### Open — genuinely not caught

| Way of writing | Rule | Why the rule cannot see it |
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

## Inputs

| Input | Evidence required |
|---|---|
| source | A parsed file; all three rules work on the syntax tree alone, with no type information |
| parser | TypeScript with decorator and parameter-property support. Without it `TSParameterProperty`, `TSTypeReference` and `Decorator` never appear and all three rules go permanently silent |
| glob | The consuming configuration decides which files are linted. A file no glob names is a file no rule here exists for |
| severity | The rules' own opinion is `error` for all three, measured at zero debt in the reference tree. A repository adopting them into an existing tree measures first and lands anything above zero at `warn` with the count beside it |

## Invariants

- A rule's identity is its published name. No rule carries a numeric code, and no message is
  addressed by anything but the rule name.
- Every rule reports at a node a reader can put a cursor on: the offending parameter, or the whole
  decorator.
- No rule reads type information, resolves an import, follows a call or reads a file path. Everything
  in this shelf is decided from written shape.
- Two rules share one constructor walk and one decorator reader, so they agree exactly on what counts
  as a constructor parameter and on what a decorator is called.
- A decorator's NAME is evidence; a decorator's ARGUMENTS are never read by any rule here.
- Message text names the replacement and the consequence, not only the offence.
- The rules are shape rules and cannot see intent. Every one of them is deliberately narrow because
  of it, and the cost of that narrowness is the open table above.

## Exceptions

- **A runtime-acquired handle is not an exception, it is a blind spot.** Nothing permits
  `dataSource.manager` or `manager.getRepository(...)`; the rules simply have no parameter to look
  at. Treat it as unenforced law, not as permitted writing.
- **A bare datasource-naming decorator is not permitted.** The rule accepts it because its regex
  allows an empty middle, not because the law does. The law wants the connection NAMED, and a
  decorator with no name in it satisfies neither the law nor the message the rule prints.
- **A custom repository class is not permitted.** The three-name list bounds what a machine will
  claim, not what the law forbids. Review remains the enforcement for everything the list omits.
- **An indirect table name is refused, and that refusal is the rule's cost, not the law's.** A
  constant or an imported table map is a legitimate way to name a table, and
  `require-entity-table-name` reports it anyway. Prefer the literal here rather than disabling the
  rule for the file; disabling it once removes the guard from every entity in that file.
- **A generated or vendored file** is outside every rule here by way of the consuming glob, not by
  way of any rule-level exemption.

## Output

```text
rule: <must-inject-entity-manager | no-injected-repository | require-entity-table-name>
code: <DATA-1 | DATA-2 | DATA-3>
node: <the exact node the rule visits>
verdict: <fires | silent>
hatch: <none | the open row from the table above that explains the silence>
```

A `silent` verdict with `hatch: none` is a claim that the writing is clean. A `silent` verdict that
names a hatch is a claim that the writing is unreviewed — a different fact, and the one this shelf
exists to keep sayable.

## Load Policy

Read this file first. Read `vi.md` for each rule stated in business terms and for the open door under
each one, `example.md` for the code that fires and the code that slips through, `audit.md` while
reviewing whether these rules still deserve trust, and `changelog.md` for what changed and when.

## Scope

This module documents only rules that exist in the source file that publishes them. A rule that ought
to exist and does not is not documented here — it is a finding in `audit.md`. A rule that cannot be
pointed at is a proposal, not a rule.

## Version Rule

Increment all five records by `0.01` for an accepted change to what these rules do or to what this
shelf claims about them, and record it in `changelog.md`. A new rule in the source is a change to
this module even when the law does not move. A newly discovered open hatch is also a change: the open
table is the content of this shelf, not a footnote to it.
