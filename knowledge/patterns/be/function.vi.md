# Hàm

Tệp này trả lời một câu hỏi: cho một handler, service, resolver, module hay helper backend, nó có
hình dạng gì, nhận gì, và trả về gì?

Nguồn: `features/api/core/graphql/mutations/courses/add-to-cart/*`,
`features/api/core/graphql/queries/courses/course/course.handler.ts`,
`modules/platform/cqrs/icqrs-handler.ts`, `features/api/core/types/execute.ts`,
`modules/bussiness/projections/user-stats/kpi-current.util.ts`,
`modules/api/apollo/server/interceptors/graphql-transform.interceptor.ts`.

## BE-FUNCTION-1 — Handler: kế thừa khuôn, ghi đè `process`

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Đầu lớp | `@CommandHandler(AddToCartCommand) @Injectable() export class AddToCartHandler extends ICQRSHandler<AddToCartCommand, CartItemEntity> implements ICommandHandler<AddToCartCommand, CartItemEntity>` (140 handler kế thừa `ICQRSHandler`; 138 đồng thời implement giao diện của Nest) |
| Trường hợp 2 | Biến thể query | `@QueryHandler(CourseQuery) @Injectable() export class CourseHandler extends ICQRSHandler<CourseQuery, CourseEntity> implements IQueryHandler<CourseQuery, CourseEntity>` |
| Trường hợp 3 | Phương thức duy nhất | `protected override async process(command: AddToCartCommand): Promise<CartItemEntity> { … }` (140/140; lint `handler-overrides-process`) |
| Trường hợp 4 | Cửa công khai | kế thừa: `async execute(params: TParams): Promise<TResponse> { return await this.process(params) }` trong `ICQRSHandler` |
| Trường hợp 5 | Câu lệnh đầu tiên | `const { request, user } = command.params` rồi các chốt chặn |

## BE-FUNCTION-2 — Thông điệp: một phong bì trơ

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Command | `export class AddToCartCommand { constructor(readonly params: ExecuteParams<AddToCartRequest>) {} }` |
| Trường hợp 2 | Query | `export class CourseQuery { constructor(readonly params: ExecuteParams<CourseRequest>) {} }` |
| Trường hợp 3 | Kiểu phong bì | `interface ExecuteParams<T> { request: T; locale?: Locale; user?: UserEntity; enrollmentId?: string; keycloakToken?: KeycloakTokenIntrospectResponse }` |
| Trường hợp 4 | Không gì khác | không phương thức, không trường suy diễn (lint `message-carries-params-only`) |

## BE-FUNCTION-3 — Service: chuyển tiếp lên bus

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Hình dạng | `@Injectable() export class AddToCartService { constructor(private readonly commandBus: CommandBus) {} async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> { return this.commandBus.execute(new AddToCartCommand(params)) } }` |
| Trường hợp 2 | Biến thể query | tương tự với `QueryBus` và `new CourseQuery(params)` |

## BE-FUNCTION-4 — Resolver: trang trí cánh cửa, dựng phong bì

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Decorator phương thức, theo thứ tự này | `@UseThrottler(ThrottlerConfig.Medium)` · `@UseGuards(KeycloakAuthGraphQLGuard)` · `@GraphQLSuccessMessage({ [Locale.En]: "…", [Locale.Vi]: "…" })` · `@UseInterceptors(GraphQLTransformInterceptor)` · `@Mutation(() => AddToCartResponse, { name: "addToCart", description: "…" })` |
| Trường hợp 2 | Tham số | `@KeycloakGraphQLUser() user: UserEntity, @Args("request", { description: "…" }) request: AddToCartRequest, @GraphQLLocale() locale: Locale` |
| Trường hợp 3 | Thân | `return this.addToCartService.execute({ request, user, locale })` — một lời gọi, không logic |
| Trường hợp 4 | Kiểu trả về | entity hoặc object mà trường `Response.data` khai báo: `Promise<CartItemEntity>` |

## BE-FUNCTION-5 — Tiêm qua constructor

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Phụ thuộc bắt buộc | `constructor(private readonly s3ReadService: S3ReadService, private readonly s3NameResolverService: S3NameResolverService) { super() }` (2489 `private readonly` so với 26 `private` không `readonly`) |
| Trường hợp 2 | Entity manager | `@InjectPrimaryPostgreSQLEntityManager() private readonly entityManager: EntityManager` — không bao giờ là repository (lint `must-inject-entity-manager`, `no-injected-repository`) |
| Trường hợp 3 | Phụ thuộc tùy chọn | `@Optional() private readonly mountFilesystemService?: MountFilesystemService` |
| Trường hợp 4 | Handler | gọi `super()` vì `ICQRSHandler` là lớp trừu tượng |

## BE-FUNCTION-6 — Chốt chặn, rồi việc, rồi trả về

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Xác thực | `if (!user) { throw new UserNotFoundException({}) }` trước mọi truy vấn |
| Trường hợp 2 | Tồn tại | `const courseExists = await this.entityManager.exists(CourseEntity, { where: { id: courseId } }); if (!courseExists) { throw new CourseNotFoundException({ id: courseId }) }` |
| Trường hợp 3 | Đọc-trước-ghi lũy đẳng | `const existing = await this.entityManager.findOne(CartItemEntity, { where: { course: { id: courseId }, user: { id: user.id } } }); if (existing) { return existing }` |
| Trường hợp 4 | Lưu | `const cartItem = this.entityManager.create(CartItemEntity, { user: { id: user.id }, course: { id: courseId } }); return this.entityManager.save(cartItem)` |

## BE-FUNCTION-7 — Helper

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Ánh xạ thuần dùng chung bởi hai bên gọi | `export const getKpiCurrentValues = (stats: UserStatsResult): Record<KpiKey, number> => ({ [KpiKey.Lessons]: stats.weeklyLessons, … })` trong `kpi-current.util.ts` (245 arrow const được export so với 20 `export function` dưới `src/modules`) |
| Trường hợp 2 | Nhà máy decorator | `export const GraphQLSuccessMessage = (message: GraphQLSuccessMessage) => SetMetadata(SUCCESS_MESSAGE_METADATA, message)` |
| Trường hợp 3 | Danh sách tham số | một interface có tên, không phải object nội tuyến (lint `no-inline-param-type`); tham số nguyên thủy đơn lẻ giữ dạng vị trí |
| Trường hợp 4 | Nơi sống | cạnh bên tiêu thụ dưới tên `<name>.util.ts`, hoặc dưới `utils/` của module |

## BE-FUNCTION-8 — Module

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Tệp định nghĩa | `export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder().setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal })).build()` |
| Trường hợp 2 | Tệp module | `@Module({ providers: [AddToCartService, AddToCartResolver, AddToCartHandler] }) export class AddToCartSingleMutationModule extends ConfigurableModuleClass {}` |
| Trường hợp 3 | Đăng ký bởi cha | `AddToCartSingleMutationModule.register({ … })` trong `courses.module.ts` |
