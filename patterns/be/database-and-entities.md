# BE code style — Database and entities (TypeORM)

Scope: how to WRITE a TypeORM entity and a query in this backend, where the schema is applied by
`synchronize` rather than by migrations. Every rule is grounded in
`src/modules/databases/postgresql/primary` and in real handlers and resolvers. Paths are relative as
`src/…`.

---

## 1. An entity extends the abstract base — never redeclare `id`, `createdAt`, `updatedAt`

Every UUID entity extends `UuidAbstractEntity`, which already carries a uuid `id` plus `createdAt`
and `updatedAt` as `timestamptz`. Do not repeat those columns.

```ts
// src/modules/databases/postgresql/primary/entities/enrollment.entity.ts
@Entity("enrollments")
export class EnrollmentEntity extends UuidAbstractEntity {
```

`id`, `createdAt`, and `updatedAt` live in `src/.../entities/abstract.ts` as
`@PrimaryGeneratedColumn("uuid")`, `@CreateDateColumn`, and `@UpdateDateColumn`.

```ts
// Wrong: redeclaring the primary key and timestamps in a child entity
@PrimaryGeneratedColumn("uuid") id: string
@CreateDateColumn() createdAt: Date
```

---

## 2. `@Entity` takes a plural snake_case table name; one entity per `*.entity.ts` file

Tables are plural snake_case, classes are suffixed `Entity`, and one entity lives in one file under
`entities/`.

`@Entity("challenges")` gives `ChallengeEntity` in `entities/challenge.entity.ts`;
`@Entity("activities")` gives `ActivityEntity`.

Four shapes to reject: `@Entity("Challenge")`, a singular table name, a class named `Challenge`
without the suffix, and two entities sharing one file.

---

## 3. A `@Column` ALWAYS declares a snake_case `name` and an explicit `type`

The TypeScript field is camelCase; the database column is snake_case, declared through `name`. The
`type` is always spelled out (`varchar` with `length`, `int`, `text`, `boolean`, `timestamptz`,
`jsonb`, `enum`), and a `varchar` must carry its `length`.

```ts
// src/.../entities/challenge.entity.ts
@Column({
    name: "display_id",
    type: "varchar",
    length: 255,
})
    displayId: string
```

```ts
// Wrong: no name, so the column becomes "displayId" and breaks snake_case
@Column() displayId: string
// Wrong: a varchar with no length
@Column({ type: "varchar" }) x: string
```

---

## 4. An enum column needs `type: "enum"`, `enum:`, and a fixed `enumName:`

A Postgres enum must declare `enumName` — a stable snake_case type name — so `synchronize` does not
generate a random one.

```ts
// src/.../entities/challenge.entity.ts
@Column({
    name: "difficulty",
    type: "enum",
    enum: ChallengeDifficulty,
    enumName: "challenge_difficulty",
})
    difficulty: ChallengeDifficulty
```

```ts
// Wrong: no enumName, so the type is auto-named and breaks the moment the column is renamed
@Column({ name: "difficulty", type: "enum", enum: ChallengeDifficulty })
```

---

## 5. A status that gains new values uses a `varchar` union, NOT a Postgres enum

`synchronize=true` runs in both development and production here. Adding a value to a Postgres enum
shared by two or more columns crashes the boot — the `DROP _old` fails. For a lifecycle status that
changes often (session state and the like), use a `varchar` with a TypeScript union.

```ts
// src/.../entities/flashcard-quiz-session.entity.ts
@Column({
    name: "status",
    type: "varchar",
    default: "in_progress",
})
    status: "in_progress" | "completed" | "abandoned"
```

The comment explaining WHY — *"avoids the TypeORM `synchronize` `ADD VALUE` footgun"* — travels with
the pattern; keep it when you copy it.

Putting an extensible status into a Postgres enum shared across several tables is what makes the
boot crash when a value is added.

---

## 6. A foreign key is `@ManyToOne` plus `@JoinColumn` with an explicit `name` and constraint name

The owning side declares `@JoinColumn` with a snake_case `name` and a hand-written
`foreignKeyConstraintName` following `fk_<col>_<table>_<reftable>`. `onDelete` is always explicit.

```ts
// src/.../entities/enrollment.entity.ts
@ManyToOne(
    () => UserEntity,
    (user: UserEntity) => user.enrollments,
    { onDelete: "CASCADE" },
)
@JoinColumn({
    name: "user_id",
    foreignKeyConstraintName: "fk_user_id_enrollments_users",
})
    user: UserEntity
```

Two shapes to reject: a bare `@JoinColumn()`, which leaves the constraint name randomly generated
and unstable under `synchronize`, and a relation with no `onDelete`.

---

## 7. Every foreign-key relation carries a `@RelationId` exposing the id

To read a foreign key without a join, declare the virtual `@RelationId` column. This is a required
companion to the relation, not an optional extra.

```ts
// src/.../entities/challenge.entity.ts
@ManyToOne(() => ContentEntity, (content) => content.challenges, { onDelete: "CASCADE", nullable: false })
@JoinColumn({ name: "content_id", foreignKeyConstraintName: "fk_content_id_challenges_contents" })
    content: ContentEntity

@RelationId((challenge: ChallengeEntity) => challenge.content)
    contentId: string
```

```ts
// Wrong: loading the whole relation just to read its id — challenge.contentId is enough
const c = await em.findOne(ChallengeEntity, { where: { id }, relations: { content: true } })
const contentId = c.content.id
```

---

## 8. An `@OneToMany` always declares its inverse; add `cascade: true` when the child belongs to the parent

A collection is typed `Array<XEntity>`, never `X[]` — the repo uses `Array<>` in 140 places and `[]`
almost nowhere. A child OWNED BY its parent (translations, steps, requirements) sets `cascade: true`
so saving the parent saves the children.

```ts
// src/.../entities/challenge.entity.ts
@OneToMany(
    () => ChallengeTranslationEntity,
    (translation: ChallengeTranslationEntity) => translation.challenge,
    { cascade: true },
)
    translations: Array<ChallengeTranslationEntity>
```

Two shapes to reject: `translations: ChallengeTranslationEntity[]`, which breaks the `Array<>`
convention, and an `@OneToMany` with no inverse function.

---

## 9. A jsonb column declares an `interface` for its shape — never `any`

A `type: "jsonb"` column gets an explicit TypeScript type: an interface exported from the file when
the payload has a structure, or `Array<Record<string, unknown>>` for a free-form rubric. Always add
`| null` when the column is `nullable: true`.

```ts
// src/.../entities/activity.entity.ts — a structured payload
export interface ActivityMetadata { target?: ActivityTargetRef }

@Column({ name: "payload", type: "jsonb", nullable: true })
    payload: ActivityMetadata | null
```

A free-form rubric looks like `outcomeCriteria: Array<Record<string, unknown>> | null` in
`src/.../entities/challenge.entity.ts`.

Both `payload: any` and `payload: object` lose type safety and break the no-`any` rule.

---

## 10. A SENSITIVE or internal field has a `@Column` but no `@Field`, so GraphQL never exposes it

GraphQL exposes through `@Field`. An internal column — a grading rubric, an encrypted token —
deliberately OMITS `@Field` so it cannot reach a client, and says so in a comment.

```ts
// src/.../entities/enrollment.entity.ts — an encrypted token, with no @Field
// **NOT exposed via GraphQL** — the plaintext token must never leave the server.
@Column({ name: "personal_project_github_token_encrypted", type: "text", nullable: true })
    personalProjectGithubTokenEncrypted: string | null
```

`challenge.entity.ts` says the same of `outcomeCriteria` and `approachCriteria` — "deliberately NOT
a `@Field`".

Adding a `@Field()` to an internal token or rubric leaks it straight out of the API.

---

## 11. Query through an injected `EntityManager`, not a per-entity `@InjectRepository`

A handler, resolver, or service injects one primary `EntityManager` with
`@InjectPrimaryPostgreSQLEntityManager()` and calls `em.find(Entity, …)`. This repo does not scatter
`@InjectRepository(XEntity)`.

```ts
// src/features/api/core/graphql/queries/system/platform-stats/platform-stats.handler.ts
constructor(
    @InjectPrimaryPostgreSQLEntityManager()
    private readonly entityManager: EntityManager,
) { super() }
...
await this.entityManager.count(ContentEntity)
```

`@InjectRepository(ContentEntity) private repo: Repository<ContentEntity>` is not this repo's idiom.

---

## 12. Load relations with a nested `relations: { … }` object, not an array of strings

`findOne` and `find` declare `relations` as a nested, typed object so nested relations load, and
filter through a relation with a `where` object.

```ts
// src/.../mutations/contents/mark-as-readed/mark-as-readed.handler.ts
await this.entityManager.findOne(ContentEntity, {
    where: { id: contentId },
    relations: { module: { course: true } },
})
```

`relations: ["module", "module.course"]` is the older string-array form and no longer matches the
codebase.

---

## 13. Avoid N+1: collect ids, run ONE `In(...)` query, index with a `Map`

When each row of a page needs extra data, gather every id, query once with `In(ids)`, and index the
result in a `Map`. `In` is imported from `typeorm`.

```ts
// src/.../queries/courses/courses/courses.resolver.ts
const courseIds = response.data.map((course) => course.id)
const enrollments = courseIds.length > 0
    ? await this.entityManager.find(EnrollmentEntity, {
        where: { user: { id: user.id }, course: { id: In(courseIds) } },
    })
    : []
const isEnrolledByCourseId = new Map(
    enrollments.map((e) => [e.courseId, e.isEnrolled]),
)
response.data.forEach((course) => {
    course.isEnrolled = isEnrolledByCourseId.get(course.id) ?? false
})
```

Note the `courseIds.length > 0` guard before firing an `In([])`.

```ts
// Wrong: N+1 — one query per row
for (const course of response.data) {
    course.isEnrolled = !!(await em.findOne(EnrollmentEntity, { where: { course: { id: course.id }, user: { id: user.id } } }))
}
```

---

## 14. Related writes go in one `entityManager.transaction`, passing the transaction's manager down

A chain of writes that must be atomic — create or update, plus XP, plus an activity, plus a
projection recompute — is wrapped in `em.transaction(async (entityManager) => …)`, and every helper
receives the transaction's `entityManager` rather than reaching for the outer `this.entityManager`.

```ts
// src/.../mutations/contents/mark-as-readed/mark-as-readed.handler.ts
await this.entityManager.transaction(async (entityManager) => {
    const saved = await entityManager.save(UserContentEntity, userContent)
    await writeXpHistory({ entityManager, userId: user.id, ... })
    await writeActivity({ entityManager, ... })
    await this.progressProjectionService.recompute({ userId: user.id, courseId, entityManager })
})
```

When `EntityManager` is used only as a type, import it as
`import type { EntityManager } from "typeorm"`.

Two ways to get this wrong: a series of loose `this.entityManager.save(...)` calls with no
transaction, which leaves debris behind on a mid-way failure; and calling `this.entityManager` from
inside a transaction, which silently drops the atomicity.

---

## 15. A heavy aggregate or COUNT uses `createQueryBuilder` with `getRawOne`, run in parallel with `Promise.all`

Counting and aggregating do not need hydrated entities, so use the raw query builder; independent
statistics are gathered with `Promise.all`. The raw row type is declared in an interface (`types.ts`),
and the value is coerced with `Number(row?.count ?? 0)`.

```ts
// src/.../queries/system/platform-stats/platform-stats.handler.ts
const [learnersRow, totalLessons, totalCourses] = await Promise.all([
    this.entityManager
        .createQueryBuilder(EnrollmentEntity, "enrollment")
        .select("COUNT(DISTINCT enrollment.user_id)", "count")
        .getRawOne<DistinctLearnersRow>(),
    this.entityManager.count(ContentEntity),
    this.entityManager.count(CourseEntity),
])
return { totalLearners: Number(learnersRow?.count ?? 0), totalLessons, totalCourses }
```

Two ways to get this wrong: `find()`ing a whole table and then counting with `.length` or a reduce in
JavaScript; and calling `getRawOne()` with no row type, since raw values are always strings and the
`Number(...)` gets forgotten.

---

## 16. Unique constraints and indexes are class-level decorators with explicit names

Idempotency and uniqueness are declared with `@Unique("UQ_...", [...])` or `@Unique([...])`; a
read-heavy index with `@Index([...])`. The names are written by hand so they stay stable under
`synchronize`.

`src/.../entities/enrollment.entity.ts` uses
`@Unique("UQ_enrollments_user_course", ["user", "course"])`;
`src/.../entities/activity.entity.ts` uses `@Unique(["type", "idempotencyKey"])` together with
`@Index(["user"])`.

Enforcing uniqueness by calling `findOne` before an insert is a race condition, not a constraint.

---

## 17. A GraphQL enum is a TypeScript `enum` plus `createEnumType` plus `registerEnumType`, one per file

An enum lives in `enums/<kebab>.ts`: declare the `enum` with camelCase string values, export
`GraphQLType<Name> = createEnumType(...)`, then call `registerEnumType` with a descriptive
`valuesMap`. The entity imports both the enum and `GraphQLType<Name>`, using one for the column and
the other for `@Field`.

```ts
// src/.../enums/activity-type.ts
export enum ActivityType { LessonRead = "lessonRead", ... }
export const GraphQLTypeActivityType = createEnumType(ActivityType)
registerEnumType(GraphQLTypeActivityType, { name: "ActivityType", description: "...", valuesMap: { ... } })
```

Two ways to get this wrong: declaring a string union for a GraphQL enum column without calling
`registerEnumType`, which GraphQL will not accept; and piling several enums into one file.

---

## The idioms worth restating, with where to verify them

1. **A `@RelationId` accompanies every foreign-key relation** — reading `contentId`, `userId`, or
   `courseId` needs no join. Confirmed in `challenge.entity.ts` (`contentId`) and
   `enrollment.entity.ts` (`userId`, `courseId`).
2. **N+1 is prevented by collecting ids, one `In(...)`, and a `Map`** — the live example is
   `courses.resolver.ts`, whose own comment says the data is "looked up in ONE batched query … never
   N+1 per row", with the `courseIds.length > 0` guard.
3. **A lifecycle status is a `varchar` union, never a Postgres enum** — to dodge the `synchronize`
   `ADD VALUE` footgun. Real in `flashcard-quiz-session.entity.ts` as
   `status: "in_progress" | "completed" | "abandoned"`, matching MockInterviewSession.
