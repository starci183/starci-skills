# Function

This file answers one question: given a backend handler, service, resolver, module or helper, what
shape does it take, what does it receive, and what does it return?

Sources: `features/api/core/graphql/mutations/courses/add-to-cart/*`,
`features/api/core/graphql/queries/courses/course/course.handler.ts`,
`modules/platform/cqrs/icqrs-handler.ts`, `features/api/core/types/execute.ts`,
`modules/bussiness/projections/user-stats/kpi-current.util.ts`,
`modules/api/apollo/server/interceptors/graphql-transform.interceptor.ts`.

## BE-FUNCTION-1 — Handler: extend the template, override `process`

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Class head | `@CommandHandler(AddToCartCommand) @Injectable() export class AddToCartHandler extends ICQRSHandler<AddToCartCommand, CartItemEntity> implements ICommandHandler<AddToCartCommand, CartItemEntity>` (140 handlers extend `ICQRSHandler`; 138 also implement the Nest interface) |
| Case 2 | Query variant | `@QueryHandler(CourseQuery) @Injectable() export class CourseHandler extends ICQRSHandler<CourseQuery, CourseEntity> implements IQueryHandler<CourseQuery, CourseEntity>` |
| Case 3 | The one method | `protected override async process(command: AddToCartCommand): Promise<CartItemEntity> { … }` (140/140; lint `handler-overrides-process`) |
| Case 4 | The public door | inherited: `async execute(params: TParams): Promise<TResponse> { return await this.process(params) }` in `ICQRSHandler` |
| Case 5 | First statement | `const { request, user } = command.params` then guards |

## BE-FUNCTION-2 — Message: an inert envelope

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Command | `export class AddToCartCommand { constructor(readonly params: ExecuteParams<AddToCartRequest>) {} }` |
| Case 2 | Query | `export class CourseQuery { constructor(readonly params: ExecuteParams<CourseRequest>) {} }` |
| Case 3 | The envelope type | `interface ExecuteParams<T> { request: T; locale?: Locale; user?: UserEntity; enrollmentId?: string; keycloakToken?: KeycloakTokenIntrospectResponse }` |
| Case 4 | Nothing else | no methods, no derived fields (lint `message-carries-params-only`) |

## BE-FUNCTION-3 — Service: forward to the bus

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Shape | `@Injectable() export class AddToCartService { constructor(private readonly commandBus: CommandBus) {} async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> { return this.commandBus.execute(new AddToCartCommand(params)) } }` |
| Case 2 | Query variant | same with `QueryBus` and `new CourseQuery(params)` |

## BE-FUNCTION-4 — Resolver: decorate the door, build the envelope

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Method decorators, in this order | `@UseThrottler(ThrottlerConfig.Medium)` · `@UseGuards(KeycloakAuthGraphQLGuard)` · `@GraphQLSuccessMessage({ [Locale.En]: "…", [Locale.Vi]: "…" })` · `@UseInterceptors(GraphQLTransformInterceptor)` · `@Mutation(() => AddToCartResponse, { name: "addToCart", description: "…" })` |
| Case 2 | Parameters | `@KeycloakGraphQLUser() user: UserEntity, @Args("request", { description: "…" }) request: AddToCartRequest, @GraphQLLocale() locale: Locale` |
| Case 3 | Body | `return this.addToCartService.execute({ request, user, locale })` — one call, no logic |
| Case 4 | Return type | the entity or object the `Response.data` field declares: `Promise<CartItemEntity>` |

## BE-FUNCTION-5 — Constructor injection

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Required dependency | `constructor(private readonly s3ReadService: S3ReadService, private readonly s3NameResolverService: S3NameResolverService) { super() }` (2489 `private readonly` against 26 `private` without `readonly`) |
| Case 2 | Entity manager | `@InjectPrimaryPostgreSQLEntityManager() private readonly entityManager: EntityManager` — never a repository (lint `must-inject-entity-manager`, `no-injected-repository`) |
| Case 3 | Optional dependency | `@Optional() private readonly mountFilesystemService?: MountFilesystemService` |
| Case 4 | Handler | calls `super()` because `ICQRSHandler` is an abstract class |

## BE-FUNCTION-6 — Guards, then work, then return

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Authentication | `if (!user) { throw new UserNotFoundException({}) }` before any query |
| Case 2 | Existence | `const courseExists = await this.entityManager.exists(CourseEntity, { where: { id: courseId } }); if (!courseExists) { throw new CourseNotFoundException({ id: courseId }) }` |
| Case 3 | Idempotent read-before-write | `const existing = await this.entityManager.findOne(CartItemEntity, { where: { course: { id: courseId }, user: { id: user.id } } }); if (existing) { return existing }` |
| Case 4 | Persist | `const cartItem = this.entityManager.create(CartItemEntity, { user: { id: user.id }, course: { id: courseId } }); return this.entityManager.save(cartItem)` |

## BE-FUNCTION-7 — Helpers

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Pure mapping shared by two callers | `export const getKpiCurrentValues = (stats: UserStatsResult): Record<KpiKey, number> => ({ [KpiKey.Lessons]: stats.weeklyLessons, … })` in `kpi-current.util.ts` (245 exported arrow consts against 20 `export function` under `src/modules`) |
| Case 2 | Decorator factory | `export const GraphQLSuccessMessage = (message: GraphQLSuccessMessage) => SetMetadata(SUCCESS_MESSAGE_METADATA, message)` |
| Case 3 | Parameter list | a named interface, not an inline object (lint `no-inline-param-type`); single primitive params stay positional |
| Case 4 | Where it lives | beside its consumer as `<name>.util.ts`, or under the module's `utils/` |

## BE-FUNCTION-8 — Module

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Definition file | `export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder().setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal })).build()` |
| Case 2 | Module file | `@Module({ providers: [AddToCartService, AddToCartResolver, AddToCartHandler] }) export class AddToCartSingleMutationModule extends ConfigurableModuleClass {}` |
| Case 3 | Registration by the parent | `AddToCartSingleMutationModule.register({ … })` in `courses.module.ts` |
