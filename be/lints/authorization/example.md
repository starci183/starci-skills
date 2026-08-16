---
id: be-lints-authorization-example
title: example.md
slug: /be/lints/authorization/example
sidebar_label: example.md
sidebar_position: 2
description: Ví dụ bị báo lỗi, không bị báo lỗi và lọt qua quy tắc authorization.
---

# example.md

> Version: `2.00` · Mô-đun: `authorization` · Luật: [`INDEX.md`](./INDEX.md) · Từng quy tắc: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mục dưới đây trình bày **một quy tắc**, với nhiều cặp **SAI** (quy tắc báo lỗi) và **ĐÚNG** (quy tắc không báo), rồi tới
**Cửa lách và nhầm lẫn** — nơi chứa code **lọt qua được**.

Đọc kỹ nhãn ở mục cuối: code trong đó **không phải code được phép viết**. Nó là code vi phạm luật mà
quy tắc **không thấy**. Luật vẫn cấm; chỉ là máy không bắt được.

Bốn định danh `KeycloakGraphQLUser`, `KeycloakUser`, `CurrentUser` và `UseGuards` được viết nguyên
văn ở mọi ví dụ, vì quy tắc so **đúng từng ký tự** với chúng. Đổi cách viết là đổi kết quả, và đó
chính là nội dung của nửa sau tài liệu này.

Quy tắc này **không có cổng theo tên tệp**: nó sống ở mọi tệp mà cấu hình trỏ tới. Tên tệp ghi trên
mỗi khối chỉ để đọc cho dễ, không tham gia phép kiểm.

---

## `identity-needs-guard`

Quy tắc chỉ thăm `MethodDefinition`, mở ra khi một tham số của phương thức mang decorator danh tính,
và tha khi `UseGuards` có mặt trên phương thức hoặc trên lớp trực tiếp.

### Cặp 1 — cánh cửa đọc thứ chưa ai chứng minh

**SAI** — `orders/submit-order.resolver.ts`

```ts
@Resolver()
export class SubmitOrderResolver {
    @Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
    async execute(
        @KeycloakGraphQLUser() user: UserEntity,
        @Args("request") request: SubmitOrderRequest,
    ): Promise<OrderEntity> {
        return this.commandBus.execute(new SubmitOrderCommand({ request, user }))
    }
}
```

Báo `unguarded` ngay tại tham số `user`. Tệp này biên dịch, chạy, và mọi bài kiểm tra viết bằng một
yêu cầu đã đăng nhập đều xanh. Thứ duy nhất vắng mặt là dòng chứng minh `user` thuộc về người gọi.

**ĐÚNG** — cùng tệp

```ts
@Resolver()
export class SubmitOrderResolver {
    @UseGuards(SessionGraphQLGuard)
    @Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
    async execute(
        @KeycloakGraphQLUser() user: UserEntity,
        @Args("request") request: SubmitOrderRequest,
    ): Promise<OrderEntity> {
        return this.commandBus.execute(new SubmitOrderCommand({ request, user }))
    }
}
```

Khác nhau đúng một chuyện: có hay không thứ chứng minh danh tính mà cánh cửa đọc.

### Cặp 2 — cổng đặt ở cấp lớp

**SAI** — `drafts/drafts.resolver.ts`

```ts
@Resolver()
export class DraftsResolver {
    @Query(() => DraftListResponse, { name: "myDrafts" })
    async list(@CurrentUser() user: UserEntity): Promise<Array<DraftEntity>> {
        return this.queryBus.execute(new ListDraftsQuery({ user }))
    }

    @Mutation(() => ArchiveDraftResponse, { name: "archiveDraft" })
    async archive(
        @CurrentUser() user: UserEntity,
        @Args("request") request: ArchiveDraftRequest,
    ): Promise<DraftEntity> {
        return this.commandBus.execute(new ArchiveDraftCommand({ request, user }))
    }
}
```

Hai báo lỗi, mỗi phương thức một cái. Cổng ở một phương thức khác **không** cứu được phương thức này —
phép kiểm chạy riêng cho từng phương thức.

**ĐÚNG** — cùng tệp

```ts
@UseGuards(SessionGraphQLGuard)
@Resolver()
export class DraftsResolver {
    @Query(() => DraftListResponse, { name: "myDrafts" })
    async list(@CurrentUser() user: UserEntity): Promise<Array<DraftEntity>> {
        return this.queryBus.execute(new ListDraftsQuery({ user }))
    }

    @Mutation(() => ArchiveDraftResponse, { name: "archiveDraft" })
    async archive(
        @CurrentUser() user: UserEntity,
        @Args("request") request: ArchiveDraftRequest,
    ): Promise<DraftEntity> {
        return this.commandBus.execute(new ArchiveDraftCommand({ request, user }))
    }
}
```

Một decorator ở cấp lớp tha cho cả hai. Tiện, và cái giá của nó nằm ở mục **Cửa lách**.

### Cặp 3 — thứ trông giống cổng nhất mà không phải cổng

**SAI** — `carts/add-to-cart.resolver.ts`

```ts
@Resolver()
export class AddToCartResolver {
    @UseInterceptors(GraphQLTransformInterceptor)
    @Mutation(() => AddToCartResponse, { name: "addToCart" })
    async execute(@KeycloakGraphQLUser() user: UserEntity): Promise<CartEntity> {
        return this.commandBus.execute(new AddToCartCommand({ user }))
    }
}
```

Một bộ chặn nằm cùng chồng xử lý và đọc lên nghe y hệt, nhưng nó không xác thực ai cả. Chỉ đúng chữ
`UseGuards` mới tha.

**ĐÚNG** — cùng tệp

```ts
@UseGuards(SessionGraphQLGuard)
@UseInterceptors(GraphQLTransformInterceptor)
@Mutation(() => AddToCartResponse, { name: "addToCart" })
async execute(@KeycloakGraphQLUser() user: UserEntity): Promise<CartEntity> {
    return this.commandBus.execute(new AddToCartCommand({ user }))
}
```

Thứ tự các decorator không quan trọng: phép kiểm duyệt qua **mọi** decorator của phương thức.

### Cặp 4 — đổi tên tham số, đổi vị trí tham số

**SAI** — `orders/cancel-order.resolver.ts`

```ts
@Mutation(() => CancelOrderResponse, { name: "cancelOrder" })
async execute(
    @Args("request") request: CancelOrderRequest,
    @CurrentUser() caller: UserEntity,
): Promise<OrderEntity> {
    return this.commandBus.execute(new CancelOrderCommand({ request, user: caller }))
}
```

Tham số tên `caller` chứ không phải `user`, và đứng thứ hai. Quy tắc vẫn báo: **tên tham số không bao
giờ được đọc**, chỉ decorator trên nó mới được đọc, và mọi tham số đều được duyệt.

**ĐÚNG** — cùng tệp

```ts
@UseGuards(SessionGraphQLGuard)
@Mutation(() => CancelOrderResponse, { name: "cancelOrder" })
async execute(
    @Args("request") request: CancelOrderRequest,
    @CurrentUser() caller: UserEntity,
): Promise<OrderEntity> {
    return this.commandBus.execute(new CancelOrderCommand({ request, user: caller }))
}
```

### Cặp 5 — danh tính nằm ở hàm dựng

**SAI** — `reports/report.gateway.ts`

```ts
export class ReportGateway {
    constructor(
        @CurrentUser() private readonly user: UserEntity,
        private readonly queryBus: QueryBus,
    ) {}
}
```

Hàm dựng là một `MethodDefinition` như mọi phương thức khác, và một tham số vừa có kiểu vừa có bổ ngữ
truy cập được bọc trong `TSParameterProperty` — quy tắc mở lớp bọc đó ra. Vẫn báo.

**ĐÚNG** — cùng tệp

```ts
@UseGuards(SessionGuard)
export class ReportGateway {
    constructor(
        @CurrentUser() private readonly user: UserEntity,
        private readonly queryBus: QueryBus,
    ) {}
}
```

### Cặp 6 — cửa không phải GraphQL

**SAI** — `webhooks/payout.controller.ts`

```ts
@Controller("payouts")
export class PayoutController {
    @Get(":id")
    async find(@KeycloakUser() user: UserEntity, @Param("id") id: string) {
        return this.queryBus.execute(new FindPayoutQuery({ user, id }))
    }
}
```

Quy tắc không hỏi cửa thuộc giao vận nào. Nó hỏi phương thức có đọc danh tính không, và lớp có cổng
không.

**ĐÚNG** — cùng tệp

```ts
@UseGuards(SessionGuard)
@Controller("payouts")
export class PayoutController {
    @Get(":id")
    async find(@KeycloakUser() user: UserEntity, @Param("id") id: string) {
        return this.queryBus.execute(new FindPayoutQuery({ user, id }))
    }
}
```

### Cặp 7 — cửa công khai và cửa vừa thôi công khai

**ĐÚNG** — `catalog/list-courses.resolver.ts`

```ts
@Resolver()
export class ListCoursesResolver {
    @Query(() => CourseListResponse, { name: "courses" })
    async execute(@Args("request") request: ListCoursesRequest): Promise<Array<CourseEntity>> {
        return this.queryBus.execute(new ListCoursesQuery({ request }))
    }
}
```

Không đọc danh tính thì không có gì để chứng minh. Quy tắc im, và đó là điều đúng: coi một truy vấn
công khai là lỗi là cách nhanh nhất để cả quy tắc bị tắt.

**SAI** — cùng tệp, một tuần sau, khi cần đánh dấu khoá đã ghi danh

```ts
@Resolver()
export class ListCoursesResolver {
    @Query(() => CourseListResponse, { name: "courses" })
    async execute(
        @Args("request") request: ListCoursesRequest,
        @CurrentUser() user: UserEntity,
    ): Promise<Array<CourseEntity>> {
        return this.queryBus.execute(new ListCoursesQuery({ request, user }))
    }
}
```

Thêm một tham số là đổi một cánh cửa công khai thành một cánh cửa đọc danh tính, và cổng thì chưa ai
thêm. Đây là hình dạng mà quy tắc bắt được đắt giá nhất, vì bản khác biệt trông như "thêm một tham
số".

### Cặp 8 — phá cấu trúc tham số danh tính

**SAI** — `profile/profile.resolver.ts`

```ts
@Query(() => ProfileResponse, { name: "myProfile" })
async execute(@CurrentUser() { id }: UserEntity): Promise<ProfileEntity> {
    return this.queryBus.execute(new FindProfileQuery({ userId: id }))
}
```

Phá cấu trúc không giấu được decorator: decorator nằm trên **nút tham số**, dù bên trong nó là mẫu
đối tượng hay một định danh.

**ĐÚNG** — cùng tệp

```ts
@UseGuards(SessionGraphQLGuard)
@Query(() => ProfileResponse, { name: "myProfile" })
async execute(@CurrentUser() { id }: UserEntity): Promise<ProfileEntity> {
    return this.queryBus.execute(new FindProfileQuery({ userId: id }))
}
```

### Cửa lách và nhầm lẫn

**Toàn bộ code dưới đây vi phạm luật `AUTHZ-2` mà quy tắc KHÔNG báo gì.** Không đoạn nào trong số này
được phép viết. Chúng có mặt ở đây vì một cửa còn mở mà không ai biết thì nguy hiểm hơn một luật không
có máy giữ: luật không có máy thì ai cũng biết là phải đọc bằng mắt.

**Lách 1 — đọc danh tính qua ngữ cảnh.** Lỗ lớn nhất.

```ts
// KHÔNG BÁO GÌ. Cánh cửa đọc đúng cái danh tính chưa ai chứng minh, chỉ bằng một cách viết khác.
@Mutation(() => ArchiveDraftResponse, { name: "archiveDraft" })
async execute(@Context() ctx: GraphQLContext, @Args("request") request: ArchiveDraftRequest) {
    const user = ctx.req.user
    return this.commandBus.execute(new ArchiveDraftCommand({ request, user }))
}
```

Khái niệm "đọc danh tính" của quy tắc là ba decorator tham số. Thân phương thức không có gì nhìn tới.

**Lách 2 — một nhịp trung gian.**

```ts
// KHÔNG BÁO GÌ. Cửa không mang decorator danh tính, phương thức phụ cũng không.
@Mutation(() => RefundOrderResponse, { name: "refundOrder" })
async execute(@Context() ctx: GraphQLContext, @Args("request") request: RefundOrderRequest) {
    return this.commandBus.execute(new RefundOrderCommand({ request, user: this.who(ctx) }))
}

private who(ctx: GraphQLContext): UserEntity {
    return ctx.req.user
}
```

**Lách 3 — decorator có không gian tên.**

```ts
import * as auth from "./decorators"

// KHÔNG BÁO GÌ. Callee là MemberExpression, tên đọc ra là undefined, không nằm trong tập.
@Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
async execute(@auth.CurrentUser() user: UserEntity) {
    return this.commandBus.execute(new SubmitOrderCommand({ user }))
}
```

**Lách 4 — đổi tên lúc nhập khẩu.**

```ts
import { CurrentUser as Who } from "./decorators"

// KHÔNG BÁO GÌ. Tập chữ so với cách viết tại chỗ dùng, không so với thứ lệnh nhập khẩu phân giải ra.
@Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
async execute(@Who() user: UserEntity) {
    return this.commandBus.execute(new SubmitOrderCommand({ user }))
}
```

**Lách 5 — một decorator danh tính thứ tư.**

```ts
// KHÔNG BÁO GÌ. Tập là chữ đóng gồm ba chuỗi; @AuthUser không nằm trong đó.
// Ngày ai đó thêm decorator này, mọi cánh cửa dùng nó rơi ra ngoài tầm nhìn của quy tắc, im lặng.
@Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
async execute(@AuthUser() user: UserEntity) {
    return this.commandBus.execute(new SubmitOrderCommand({ user }))
}
```

**Lách 6 — cổng rỗng.**

```ts
// KHÔNG BÁO GÌ. Đã đo. Sự có mặt của decorator là toàn bộ lời khẳng định; danh sách tham số của nó
// không bao giờ được đọc.
@UseGuards()
@Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
async execute(@KeycloakGraphQLUser() user: UserEntity) {
    return this.commandBus.execute(new SubmitOrderCommand({ user }))
}
```

**Lách 7 — cổng không xác thực ai cả.**

```ts
// KHÔNG BÁO GÌ. Một cổng giới hạn tần suất, hoặc một cổng vai trò giả định rằng ai đó đã xác thực
// trước nó, đều làm quy tắc im hoàn toàn. "Có cổng" ≠ "danh tính đã được chứng minh".
@UseGuards(ThrottlerGuard)
@Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
async execute(@KeycloakGraphQLUser() user: UserEntity) {
    return this.commandBus.execute(new SubmitOrderCommand({ user }))
}
```

**Lách 8 — một `UseGuards` nội bộ.**

```ts
// KHÔNG BÁO GÌ. Phép kiểm là cách viết, không phải thứ mà cách viết đó phân giải ra.
export const UseGuards = (..._guards: Array<unknown>) => (..._args: Array<unknown>) => {}

@UseGuards(Nothing)
@Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
async execute(@KeycloakGraphQLUser() user: UserEntity) {
    return this.commandBus.execute(new SubmitOrderCommand({ user }))
}
```

**Lách 9 — tấm chăn ở cấp lớp, sáu tháng sau.**

```ts
// KHÔNG BÁO GÌ ở phương thức thứ hai. Cổng trên lớp là cổng của người dùng sản phẩm; cánh cửa mới
// phục vụ người vận hành, một chủ thể khác hẳn - đúng thứ AUTHZ-6 cấm - và không ai quyết lại.
@UseGuards(SessionGraphQLGuard)
@Resolver()
export class OrdersResolver {
    @Query(() => OrderListResponse, { name: "myOrders" })
    async mine(@CurrentUser() user: UserEntity) { /* ... */ }

    @Mutation(() => ForceRefundResponse, { name: "forceRefund" })
    async forceRefund(@CurrentUser() user: UserEntity, @Args("request") request: ForceRefundRequest) {
        return this.commandBus.execute(new ForceRefundCommand({ request, user }))
    }
}
```

**Lách 10 — cửa không phải phương thức của lớp.**

```ts
// KHÔNG BÁO GÌ. Trình thăm duy nhất là MethodDefinition. Một tuyến đường đăng ký bằng mã nằm hẳn
// ngoài thế giới của quy tắc, kể cả khi nó đọc danh tính ngay dòng đầu tiên.
router.post("/orders/:id/refund", async (req, res) => {
    const user = req.user
    res.json(await commandBus.execute(new RefundOrderCommand({ user, id: req.params.id })))
})
```

**Nhầm lẫn 1 — quy tắc báo nhầm trên code đúng: cổng có không gian tên.**

```ts
// BÁO unguarded, dù cánh cửa này hoàn toàn đúng. Callee là MemberExpression nên tên đọc ra là
// undefined, và quy tắc kết luận không có cổng.
@nest.UseGuards(SessionGraphQLGuard)
@Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
async execute(@KeycloakGraphQLUser() user: UserEntity) { /* ... */ }
```

**Nhầm lẫn 2 — decorator gộp.**

```ts
// BÁO unguarded, dù @Authenticated() gộp đúng cái UseGuards mà quy tắc muốn thấy.
// Đây là nhầm lẫn tốn kém nhất, vì cách gộp decorator là cách một cây code trưởng thành thường đi.
export const Authenticated = () => applyDecorators(UseGuards(SessionGraphQLGuard))

@Authenticated()
@Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
async execute(@KeycloakGraphQLUser() user: UserEntity) { /* ... */ }
```

**Nhầm lẫn 3 — cổng ở lớp cơ sở.**

```ts
// BÁO unguarded ở lớp con. Quy tắc chỉ đọc decorator của lớp TRỰC TIẾP chứa phương thức;
// nó không đi lên chuỗi kế thừa, trong khi siêu dữ liệu của khung thì có.
@UseGuards(SessionGraphQLGuard)
export abstract class GuardedResolver {}

@Resolver()
export class SubmitOrderResolver extends GuardedResolver {
    @Mutation(() => SubmitOrderResponse, { name: "submitOrder" })
    async execute(@KeycloakGraphQLUser() user: UserEntity) { /* ... */ }
}
```

**Nhầm lẫn 4 — một lớp không phải cánh cửa.**

```ts
// BÁO unguarded, dù đây không phải cửa và không có chỗ nào hợp lệ để đặt UseGuards.
// Quy tắc không hỏi lớp có phải resolver hay controller không.
@Injectable({ scope: Scope.REQUEST })
export class AuditTrail {
    constructor(@CurrentUser() private readonly user: UserEntity) {}
}
```

Mỗi lần trong bốn lần này là một lần ai đó viết `// eslint-disable-next-line`, và dòng đó mới là thứ
che mất trường hợp thật tiếp theo. Cách sửa đúng không phải là tắt quy tắc mà là **đổi code về hình
dạng quy tắc đọc được** — hoặc đề xuất sửa quy tắc, kèm phép đo.

## Ánh xạ yêu cầu sang quy tắc

| Yêu cầu nghe được | Quy tắc chạm tới | Kết quả |
|---|---|---|
| "Thêm một mutation cần đăng nhập" | `identity-needs-guard` | Đặt `UseGuards` lên phương thức hoặc lớp; thiếu là đỏ |
| "Trang này công khai, bỏ đăng nhập đi" | `identity-needs-guard` | Bỏ luôn tham số danh tính; giữ tham số mà bỏ cổng là đỏ |
| "Cho tôi biết người dùng để hiện trạng thái đã ghi danh" | `identity-needs-guard` | Thêm tham số danh tính là thêm nghĩa vụ cổng |
| "Gom mấy decorator xác thực lại cho gọn" | `identity-needs-guard` | Sẽ **nổ nhầm**; xem Nhầm lẫn 2 trước khi gom |
| "Chuyển guard lên lớp cơ sở dùng chung" | `identity-needs-guard` | Sẽ **nổ nhầm**; xem Nhầm lẫn 3 |
| "Chỉ chủ sở hữu mới sửa được bản ghi này" | *không quy tắc nào* | `AUTHZ-3`, đọc bằng mắt |
| "Trả về không tìm thấy thay vì bị từ chối" | *không quy tắc nào* | `AUTHZ-4`, đọc bằng mắt |
| "Bản dùng thử không được mở nội dung trả phí" | *không quy tắc nào* | `AUTHZ-5`, đọc bằng mắt |
| "Thêm một cửa cho người vận hành" | *không quy tắc nào* | `AUTHZ-6`, đọc bằng mắt — và cẩn thận tấm chăn ở Lách 9 |

## Bảng phân định ranh giới

| Tình huống | Quy tắc | Vì sao |
|---|---|---|
| Cửa đọc danh tính, không cổng ở đâu cả | **Báo** | Đúng trọng tâm `AUTHZ-2` |
| Cửa đọc danh tính, cổng trên phương thức | Im | Đã chứng minh |
| Cửa đọc danh tính, cổng trên lớp trực tiếp | Im | Tha cho mọi phương thức của lớp |
| Cửa đọc danh tính, cổng trên lớp **cơ sở** | **Báo** | Chỉ lớp trực tiếp được đọc — nhầm lẫn |
| Cửa đọc danh tính, cổng đăng ký ở cấp ứng dụng | **Báo** | Nằm ngoài tệp — nhầm lẫn |
| Cửa không đọc danh tính | Im | Không có gì để chứng minh |
| Cửa đọc danh tính qua ngữ cảnh | Im | **Cửa còn mở** |
| Cửa đọc danh tính qua decorator ngoài tập ba | Im | **Cửa còn mở** |
| `UseGuards` có mặt nhưng rỗng hoặc không xác thực | Im | **Cửa còn mở** |
| Lớp phục vụ không phải cửa, hàm dựng nhận danh tính | **Báo** | Không có cổng lọc theo loại lớp — nhầm lẫn |

## Sai lầm lặp lại nhiều nhất

1. **Sao chép một cánh cửa cũ và làm rơi dòng `UseGuards`.** Đây là đường sinh ra vi phạm phổ biến
   nhất, vì dòng cổng là dòng duy nhất không nói gì về nghiệp vụ nên mắt lướt qua. Quy tắc tồn tại
   gần như chỉ vì trường hợp này.
2. **Thêm một tham số danh tính vào cửa công khai mà quên rằng vừa đổi loại cửa.** Bản khác biệt trông
   như "thêm một tham số"; thực chất là "cửa này từ nay đọc danh tính".
3. **Tưởng bộ chặn là cổng.** Chúng nằm cùng chồng xử lý, viết giống nhau, và chỉ một trong hai chứng
   minh được ai đang gọi.
4. **Tưởng `UseGuards` có mặt là xong.** Một cổng vai trò hay một cổng giới hạn tần suất làm quy tắc
   im hệt như cổng xác thực. Quy tắc đếm sự có mặt; con người phải đọc tham số.
5. **Tắt quy tắc khi nó nổ nhầm.** Bốn nhầm lẫn ở trên đều có cách sửa không cần `eslint-disable`, và
   dòng `eslint-disable` để lại thì không hết hạn.
6. **Tưởng cổng đã lo hết phần authorization.** Cổng chỉ trả lời "có ai đăng nhập không". Sở hữu hàng,
   hình dạng lời từ chối, trạng thái quyền lợi và chủ thể của cửa đều **không có máy nào giữ**.
