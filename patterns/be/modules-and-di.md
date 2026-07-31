# Module structure and DI

Scope: how to WRITE a Nest module in this repo — folder anatomy, providers and DI, the
resolver/controller → service → CQRS-handler flow, feature-module boundaries, and the `index.ts`
barrel. Grounded entirely in the real `src/`. This is code style, not design.

---

## 1. Every module `extends ConfigurableModuleClass` — never a bare `@Module`

The idiom is overwhelming: 511 of 530 modules in `src/` are declared through
`ConfigurableModuleBuilder`, with the class extending `ConfigurableModuleClass`. The 19 bare
`@Module` declarations all sit under `src/features/mock/` — teaching examples, not a pattern to
copy. Each module has one `*.module-definition.ts` in exactly this shape, copied verbatim:

```ts
// src/modules/crypto/crypto.module-definition.ts — identical to start-trial.module-definition.ts
import { ConfigurableModuleBuilder } from "@nestjs/common"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder()
        .setExtras({ isGlobal: false }, (definition, extras) => ({
            ...definition,
            global: extras.isGlobal,
        }))
        .build()
```

The module class declares `providers` and `exports`, exporting only what a consumer genuinely needs —
`CryptoModule` exports exactly two services:

```ts
// src/modules/crypto/crypto.module.ts
@Module({
    providers: [EncryptionService, Sha256Service],
    exports: [EncryptionService, Sha256Service],
})
export class CryptoModule extends ConfigurableModuleClass {}
```

```ts
// Wrong: a bare @Module with no builder and no isGlobal knob — found only under src/features/mock/
@Module({ providers: [MulterService] })
export class MulterModule {}
```

`.register({ isGlobal })` is the builder's default method name; only two modules in the repo rename
it to `forRoot` via `setClassMethodName("forRoot")`.

---

## 2. A leaf GraphQL module is a quartet: resolver, service, handler, command

Every mutation and query is its own FOLDER — one folder, one concern — containing exactly
`*.module.ts`, `*.module-definition.ts`, `*.resolver.ts`, `*.service.ts`, `*.handler.ts`, and
`*.command.ts` (or `.query.ts`), plus `graphql-types/` and `index.ts`. The runtime flow is
**Resolver → Service → CommandBus/QueryBus → Handler**.

Module class naming: a single-operation leaf is suffixed `SingleMutationModule` or
`SingleQueryModule` (88 and 164 occurrences); an aggregator collecting several leaves is
`MutationsModule` or `QueriesModule` (26 and 28).

```ts
// src/features/api/core/graphql/mutations/courses/start-trial/start-trial.module.ts
// a leaf lists only its own providers
@Module({
    providers: [StartTrialService, StartTrialResolver, StartTrialHandler],
})
export class StartTrialSingleMutationModule extends ConfigurableModuleClass {}
```

---

## 3. Resolvers and controllers are THIN — take the request, call the service, hold no business logic

A resolver only attaches decorators (guard, interceptor, throttler), extracts the arguments, and
forwards to `*.service.ts`. A leaf mutation's service is thin too: it packs `params` into a Command
and calls `commandBus.execute`. All business logic — database, exceptions, transactions — lives in
the Handler.

```ts
// courses/start-trial/start-trial.service.ts — the leaf service forwards to the CommandBus
@Injectable()
export class StartTrialService {
    constructor(private readonly commandBus: CommandBus) {}

    async execute(
        params: ExecuteParams<StartTrialRequest>,
    ): Promise<StartTrialResponseData> {
        return this.commandBus.execute(new StartTrialCommand(params))
    }
}
```

```ts
// courses/start-trial/start-trial.resolver.ts — a thin resolver
@Resolver()
export class StartTrialResolver {
    constructor(private readonly startTrialService: StartTrialService) {}

    @UseThrottler(ThrottlerConfig.Medium)
    @UseGuards(KeycloakAuthGraphQLGuard)
    @Mutation(() => StartTrialResponse, { name: "startTrial" /* ... */ })
    async execute(
        @KeycloakGraphQLUser() user: UserEntity,
        @Args("request") request: StartTrialRequest,
        @GraphQLLocale() locale: Locale,
    ): Promise<StartTrialResponseData> {
        return this.startTrialService.execute({ request, user, locale })
    }
}
```

```ts
// Wrong: database work and business logic in the resolver — both belong in the Handler
@Mutation(() => StartTrialResponse)
async execute(@Args("request") request: StartTrialRequest) {
    const course = await this.entityManager.findOne(CourseEntity, { /* ... */ })
    if (!course) throw new CourseNotFoundException({})
}
```

---

## 4. The Handler holds the business logic: `extends ICQRSHandler` and `implements ICommandHandler`

A handler both extends `ICQRSHandler<Cmd, Res>` — the base, which provides `process()` — and
implements `ICommandHandler<Cmd, Res>` from `@nestjs/cqrs`, decorated with `@CommandHandler(XCommand)`
and `@Injectable()`. The logic goes in `protected override async process()`, and the constructor
calls `super()`.

There is no separate `*.repository.ts` layer: handlers and services work with the database directly
through an injected `EntityManager`. A grep finds zero `*.repository.ts` files in `src/`.

```ts
// courses/start-trial/start-trial.handler.ts
@CommandHandler(StartTrialCommand)
@Injectable()
export class StartTrialHandler
    extends ICQRSHandler<StartTrialCommand, StartTrialResponseData>
    implements ICommandHandler<StartTrialCommand, StartTrialResponseData>
{
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
    ) {
        super()
    }

    protected override async process(
        command: StartTrialCommand,
    ): Promise<StartTrialResponseData> {
        const { request: { courseId }, user } = command.params
        if (!user) throw new UserNotFoundException({})
        // ... business logic ...
    }
}
```

---

## 5. DI is constructor injection with `private readonly`, never property injection

Inject by type in the constructor, marked `private readonly`. When the provider is a token or a value
rather than a class, use `@Inject(TOKEN)`; the token is a `const` string declared in the module's
`constants/` — one source of truth — never typed by hand at the injection site. Database access uses
the dedicated decorators (`InjectPrimaryPostgreSQLEntityManager` and friends from
`@modules/databases`); do not invent your own database token or reach for a raw `@InjectRepository`.

```ts
// src/modules/bussiness/achievements/achievements.service.ts — a DB injector beside a custom token
@Injectable()
export class AchievementsService {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
        @Inject(ACHIEVEMENT_BADGES)
        private readonly badges: Array<AbstractBadge>,
    ) {}
}
```

```ts
// src/modules/cache/constants/keys.ts — the token is a const string
/** Injection token for the Redis cache manager. */
export const REDIS_CACHE_MANAGER = "REDIS_CACHE_MANAGER"
```

```ts
// Wrong: a bare token typed at the injection site — easy to mistype, no single source
constructor(@Inject("REDIS_CACHE_MANAGER") private readonly cache: Cache) {}
```

Secondary conventions inside a service or handler:

- Logger: `private readonly logger = new Logger(<ClassName>.name)` — declared only when the class
  actually logs, and never `console.log` (see `AssetsService`, `AiModelLatencyService`).
- Config and env: read through `envConfig()` from `@modules/env` (199 call sites). Never
  `process.env` directly in business code.
- Writing to several related tables: `this.entityManager.transaction(async (manager) => { ... })`,
  and every operation inside uses the supplied `manager`, never `this.entityManager` again (see
  `flashcard-quiz-session.service.ts`, `daily-quest.service.ts`).

---

## 6. A complex provider goes in its own `*.providers.ts` with `useFactory` and `inject`

A provider that needs runtime initialisation — a client, a cache, a connection — is written as a
factory `Provider` in a separate `*.providers.ts`: `{ provide, inject, useFactory }`. Do not stuff a
long factory into `@Module({ providers: [...] })`. When several implementations share one abstract
class, collect them into a token array with `useFactory` and `inject` (as `ACHIEVEMENT_BADGES` does).

```ts
// src/modules/cache/cache.providers.ts
export const createRedisCacheManagerProvider = (): Provider => ({
    provide: REDIS_CACHE_MANAGER,
    inject: [createRedisKey(RedisInstanceKey.Cache), WinstonService],
    useFactory: async (
        redis: RedisClient,
        winstonService: WinstonService,
    ): Promise<Cache> => {
        const keyv = new Keyv(new KeyvRedis(redis))
        return createCache({ stores: [keyv], ttl: 0 })
    },
})
```

---

## 7. Feature boundary: a leaf never re-declares providers; the aggregator `imports` with `.register()`

A leaf module imports no other module — it declares only its own `providers`. The aggregator
(`*MutationsModule`, `*QueriesModule`) collects the leaves through
`imports: [XSingleMutationModule.register({ isGlobal: true })]`. `isGlobal: true` is how this repo
exposes a provider app-wide, in place of `@Global()` — a grep for `@Global` returns zero hits.

```ts
// courses/courses.module.ts — the aggregator collects the leaves
@Module({
    imports: [
        CourseEnrollSingleMutationModule.register({ isGlobal: true }),
        StartTrialSingleMutationModule.register({ isGlobal: true }),
        AddToCartSingleMutationModule.register({ isGlobal: true }),
        // ...
    ],
})
export class CoursesMutationsModule extends ConfigurableModuleClass {}
```

```ts
// Wrong: the @Global() decorator — not this repo's idiom; it uses the isGlobal extra
@Global()
@Module({ providers: [StartTrialService], exports: [StartTrialService] })
export class StartTrialSingleMutationModule {}
```

A new feature takes two steps that are easy to forget: (1) register the leaf in its parent module,
and (2) add the `export *` line to the parent barrel (`src/modules/bussiness/index.ts` and friends).

---

## 8. Every module folder has an `index.ts` barrel, and imports go through the alias

Each folder exports its public surface through `index.ts` using `export * from "./..."` — always the
`*.module`, the public services and resolvers, and `graphql-types`, `constants`, and `types`. Imports
across modules use the `@modules/*` and `@features/*` path aliases from `tsconfig.json`, never a long
relative climb.

```ts
// courses/start-trial/index.ts
export * from "./start-trial.module"
export * from "./start-trial.resolver"
export * from "./start-trial.service"
export * from "./graphql-types"
```

```ts
// src/modules/crypto/index.ts
export * from "./constants"
export * from "./crypto.module"
export * from "./encryption.service"
export * from "./sha256.service"
export * from "./types"
```

```ts
// importing through the alias
import { UserEntity, Locale } from "@modules/databases"
import { KeycloakAuthGraphQLGuard } from "@modules/keycloak"
```

```ts
// Wrong: a long relative climb reaching deep past a package boundary
import { UserEntity } from "../../../../../../modules/databases/postgresql/primary/entities/user.entity"
```

---

## 9. Naming — kebab-case files with a suffix that states the role

| Suffix | Role |
|---|---|
| `.module.ts` / `.module-definition.ts` | the Nest module and its configurable builder |
| `.resolver.ts` / `.controller.ts` | the GraphQL or REST leaf entry (thin) |
| `.service.ts` | thin orchestration (forwarding to the CommandBus) or a shared business service |
| `.handler.ts` with `.command.ts` / `.query.ts` | the CQRS handler — where business logic lives |
| `.listener.ts` | an event, CDC, or projection listener |
| `.cron.ts` | a cron service |
| `.guard.ts` / `.interceptor.ts` / `.filter.ts` | Nest lifecycle |
| `.spec.ts` | a unit test beside the file it tests |

The class name is PascalCase matching the file: `flashcard-review.service.ts` →
`FlashcardReviewService`.

## The data-key ruling

A new table belonging to one course keys by `enrollment_id` (a foreign key to `enrollments`), not by
`user_id`. Only a course-agnostic table keys by `user_id`.
