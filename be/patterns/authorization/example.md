---
id: be-patterns-authorization-example
title: example.md
slug: /be/patterns/authorization/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã AUTHZ-N, viết bằng TypeScript NestJS thường.
---

# example.md

> Version: `2.00` · Module: `authorization` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng có hình dạng NestJS**. Không có tên sản phẩm,
không tên repository, không tên module riêng. Một luật chỉ đúng khi nó đúng ở bất kỳ back end nào —
nên nếu một ví dụ cần tên riêng của một hệ thống mới đọc được, ví dụ đó không phù hợp ở đây.

Tên decorator đọc danh tính (`CurrentUser`) giữ nguyên vì đó là **danh tính thi hành**: lint rule khớp
theo đúng cái tên ấy, đổi tên là rule không còn bắt được gì.

Mỗi mã có **nhiều case**, sau đó là mục **Ngoại lệ và nhầm lẫn**. Phần cuối trang ánh xạ một yêu cầu
bằng lời sang một mã duy nhất.

---

## `AUTHZ-1` — handler tự sở hữu điều kiện tiên quyết

### Case: điều kiện tiên quyết đứng trên mọi cổng khác

```ts
protected override async process(command: CancelOrderCommand): Promise<OrderEntity> {
    const { request, user } = command.params

    // handler tự sở hữu điều kiện của nó: guard chỉ phủ MỘT cửa, còn command này
    // với tới được từ CLI, từ job và từ harness
    if (!user) {
        throw new UnauthenticatedCallerException({})
    }

    const order = await this.entityManager.findOne(OrderEntity, {
        where: { id: request.orderId },
    })
    if (!order) {
        throw new OrderNotFoundException({ id: request.orderId })
    }
    // ...
}
```

Check đứng **trên** cả validation rẻ tiền lẫn các câu query, vì một request không có danh tính không
đáng phải trả giá của một request hợp lệ.

### Case: cái mà "dọn cho gọn" thực sự xoá mất

```ts
// SAI: bỏ đi vì "resolver đã có guard rồi"
protected override async process(command: CancelOrderCommand): Promise<OrderEntity> {
    const { request, user } = command.params
    const order = await this.entityManager.findOne(OrderEntity, {
        where: { id: request.orderId, userId: user.id }, // user có thể là undefined
    })
    // ...
}
```

Operation này chỉ an toàn **cho đến khi** có một chỗ mới gọi nó. Đó không phải là một điều
kiện bạn có thể kiểm tra bằng cách đọc file này.

### Case: caller thứ hai xuất hiện, và nó không có cửa nào

```ts
@Injectable()
export class ExpireStaleOrdersJob {
    constructor(private readonly commandBus: CommandBus) {}

    /** Dispatch cùng một command, không có request, không có guard, không có transport. */
    async run(): Promise<void> {
        for (const orderId of await this.staleOrderIds()) {
            await this.commandBus.execute(
                new CancelOrderCommand({
                    request: { orderId },
                    user: await this.systemActor(),
                }),
            )
        }
    }
}
```

Không có resolver nào ở đây cả. Điều kiện tiên quyết của handler là thứ duy nhất còn đứng.

### Case: `AUTHZ-1` xong thì `AUTHZ-3` mới bắt đầu

```ts
if (!user) {
    throw new UnauthenticatedCallerException({})       // AUTHZ-1: có ai không
}

const draft = await this.entityManager.findOne(DraftEntity, {
    where: { id: request.draftId },
})
if (!draft) {
    throw new DraftNotFoundException({ id: request.draftId })
}
if (draft.authorId !== user.id) {
    throw new DraftNotOwnedException({ id: request.draftId })  // AUTHZ-3: có phải người này không
}
```

Hai câu hỏi khác nhau, hai check khác nhau, và câu thứ hai cần một dòng dữ liệu mà câu thứ nhất không
cần.

### Ngoại lệ và nhầm lẫn

- **Luật phân quyền viết trong service cạnh handler là sai chỗ:**

  ```ts
  // SAI: service không có message, nên cửa thứ hai không với tới được luật này
  // và nó sẽ mọc một bản sao của riêng nó
  @Injectable()
  export class OrderPolicyService {
      assertMayCancel(user: UserEntity | undefined, order: OrderEntity): void {
          if (!user || order.userId !== user.id) {
              throw new OrderNotOwnedException({ id: order.id })
          }
      }
  }
  ```

  Luật ấy thuộc về handler, chỗ mà mọi caller của bus đều đi qua.

- **Hai lớp check không phải trùng lặp.** Guard trả lời cho **một cửa**; handler trả lời cho **mọi
  caller**. Đây đúng là lập luận mà CQRS dùng để đặt công việc vào handler, áp lên điều kiện tiên
  quyết của công việc đó.

---

## `AUTHZ-2` — cửa đọc danh tính thì mang guard

### Case: cửa đúng

```ts
@Resolver()
export class UpdateDraftResolver {
    @UseGuards(SessionAuthGuard)
    @Mutation(() => UpdateDraftResponse, { name: "updateDraft" })
    async execute(
        @CurrentUser() user: UserEntity,
        @Args("request") request: UpdateDraftRequest,
    ): Promise<DraftEntity> {
        return this.service.execute(user, request)
    }
}
```

### Case: cửa sai — và nó im lặng

```ts
// SAI: tham số vẫn tên `user`, handler vẫn nhận được một `user`, và không có gì
// chứng minh nó thuộc về người gọi
@Resolver()
export class UpdateDraftResolver {
    @Mutation(() => UpdateDraftResponse, { name: "updateDraft" })
    async execute(
        @CurrentUser() user: UserEntity,
        @Args("request") request: UpdateDraftRequest,
    ): Promise<DraftEntity> {
        return this.service.execute(user, request)
    }
}
```

Hai đoạn trên khác nhau **đúng một thứ**: có cái gì đã chứng minh danh tính mà cửa đang đọc hay không.
Không có exception, không có log, không có 401 — nên lỗi này không tự lộ ra bao giờ.

### Case: guard ở cấp class phủ mọi method

```ts
@UseGuards(SessionAuthGuard)
@Resolver()
export class DraftMutationsResolver {
    @Mutation(() => UpdateDraftResponse, { name: "updateDraft" })
    async update(@CurrentUser() user: UserEntity): Promise<DraftEntity> { /* ... */ }

    @Mutation(() => DeleteDraftResponse, { name: "deleteDraft" })
    async remove(@CurrentUser() user: UserEntity): Promise<DeleteDraftResult> { /* ... */ }
}
```

### Case: method tách ra khỏi class đã có guard

```ts
// SAI: method được chuyển sang một resolver mới, guard ở cấp class cũ không đi theo
@Resolver()
export class DraftArchiveResolver {
    @Mutation(() => ArchiveDraftResponse, { name: "archiveDraft" })
    async archive(@CurrentUser() user: UserEntity): Promise<DraftEntity> { /* ... */ }
}
```

Đây là đường mà lỗi này đi vào thực tế nhiều nhất: không ai viết một cửa không guard từ đầu, người ta
**tách** một cửa ra khỏi chỗ đã có guard.

### Case: danh tính tuỳ chọn vẫn là danh tính được dựng ra

```ts
// ĐÚNG: guard cho người vô danh đi qua và chỉ điền danh tính khi có.
// Danh tính vẫn được DỰNG RA, không bị GIẢ ĐỊNH.
@UseGuards(OptionalSessionAuthGuard)
@Query(() => ArticleResponse, { name: "article" })
async execute(
    @CurrentUser() viewer: UserEntity | undefined,
    @Args("slug") slug: string,
): Promise<ArticleEntity> { /* ... */ }
```

### Ngoại lệ và nhầm lẫn

- **Interceptor không phải guard:**

  ```ts
  // SAI: interceptor chạy SAU khi request đã được nhận, nó không quyết định
  // request có được vào hay không
  @UseInterceptors(TransformResponseInterceptor)
  @Mutation(() => UpdateDraftResponse, { name: "updateDraft" })
  async execute(@CurrentUser() user: UserEntity): Promise<DraftEntity> { /* ... */ }
  ```

- **Cửa không đọc danh tính thì không thuộc mã này** — nó không có danh tính để phân quyền, và đó là
  một sự thật khác, phải nói ra chứ không phải im lặng bỏ qua.

- **Throttler, CSRF, captcha đều là guard nhưng không dựng ra danh tính.** Đếm decorator không đủ;
  phải là guard **xác thực**.

---

## `AUTHZ-3` — quyền sở hữu quyết định trên dòng đã load

### Case: load rồi mới so sánh

```ts
const review = await this.entityManager.findOne(ReviewEntity, {
    where: { id: request.reviewId },
})
if (!review) {
    throw new ReviewNotFoundException({ id: request.reviewId })
}
// quyết định trên dòng đã load, không trên id người gọi đưa vào
if (review.userId !== user.id) {
    throw new ReviewNotOwnedException({ id: request.reviewId, userId: user.id })
}
await this.entityManager.remove(review)
```

### Case: cái bẫy — hai vế đều do người gọi chọn

```ts
// SAI: người gọi cung cấp CẢ HAI id, nên họ vượt qua check này bằng cách
// cung cấp id khác
if (request.userId !== user.id) {
    throw new ReviewNotOwnedException({ id: request.reviewId })
}
await this.entityManager.delete(ReviewEntity, { id: request.reviewId })
```

Hai đoạn trên khác nhau **đúng một thứ**: check có đọc thứ gì mà người gọi không tự chọn được hay
không.

### Case: đưa chủ sở hữu vào `where`, lấy từ danh tính

```ts
// ĐÚNG: giá trị chủ sở hữu lấy từ danh tính đã xác thực; request chỉ nói
// bản ghi nào, không nói bản ghi đó của ai
const review = await this.entityManager.findOne(ReviewEntity, {
    where: { id: request.reviewId, userId: user.id },
})
if (!review) {
    throw new ReviewNotFoundException({ id: request.reviewId })
}
```

### Case: cùng hình dạng, sai nguồn

```ts
// SAI: `where` trông y hệt case trên, nhưng chủ sở hữu lấy từ REQUEST
const review = await this.entityManager.findOne(ReviewEntity, {
    where: { id: request.reviewId, userId: request.userId },
})
```

Đây là lý do không lint rule nào bắt được `AUTHZ-3`: hai đoạn trên **cùng một AST shape**, chỉ khác
giá trị đến từ đâu.

### Case: cập nhật theo điều kiện, không load gì cả

```ts
// SAI: không có dòng nào được đọc, nên không có gì để so sánh; và số dòng bị
// ảnh hưởng bằng 0 sẽ bị nuốt trong im lặng
await this.entityManager.update(
    ReviewEntity,
    { id: request.reviewId },
    { body: request.body },
)
```

### Ngoại lệ và nhầm lẫn

- **Sở hữu bắc cầu vẫn phải load bản ghi bắc cầu:**

  ```ts
  // ĐÚNG: bình luận thuộc bài viết, bài viết thuộc tác giả -- và tác giả được
  // đọc từ dòng đã load chứ không từ request
  const comment = await this.entityManager.findOne(CommentEntity, {
      where: { id: request.commentId },
      relations: { article: true },
  })
  if (!comment) {
      throw new CommentNotFoundException({ id: request.commentId })
  }
  if (comment.authorId !== user.id && comment.article.authorId !== user.id) {
      throw new CommentNotOwnedException({ id: request.commentId })
  }
  ```

- **Bỏ check `AUTHZ-3` đi thì test vẫn xanh**, vì mọi test đều gửi id của chính nó. Muốn thấy đỏ thì
  phải có một case dùng danh tính **thứ hai**.

---

## `AUTHZ-4` — từ chối kiểu nào là một quyết định

### Case: bản ghi riêng tư — gộp hai sự thật làm một

```ts
const plan = await this.entityManager.findOne(PaymentPlanEntity, {
    where: { id: request.planId },
})
// gộp "không tồn tại" và "của người khác" vào một lỗi, để quyền sở hữu
// không bao giờ rò rỉ ra người gọi
if (!plan || plan.userId !== user.id) {
    throw new PaymentPlanNotFoundException({ planId: request.planId, userId: user.id })
}
```

### Case: cùng logic, tách hai lỗi — và trở thành máy dò

```ts
// SAI: lặp id trong một vòng lặp, đọc mã lỗi, và bạn đã dựng được bản đồ
// mọi kế hoạch trả góp trên hệ thống
if (!plan) {
    throw new PaymentPlanNotFoundException({ planId: request.planId })
}
if (plan.userId !== user.id) {
    throw new PaymentPlanForbiddenException({ planId: request.planId })
}
```

Hai đoạn trên khác nhau **đúng một thứ**: câu từ chối có phải một oracle liệt kê hay không.

### Case: bản ghi người gọi biết chính đáng — gọi tên lý do

```ts
// ĐÚNG: người gọi vừa thấy tài liệu này trong không gian làm việc chung của họ.
// Trả not-found ở đây là bắt một người dùng hợp lệ đi truy một cái bug không có thật.
const document = await this.entityManager.findOne(DocumentEntity, {
    where: { id: request.documentId },
})
if (!document) {
    throw new DocumentNotFoundException({ id: request.documentId })
}
if (!document.editorIds.includes(user.id)) {
    throw new DocumentEditForbiddenException({ id: request.documentId })
}
```

### Case: lỗi gương — làm mềm chỗ không cần mềm

```ts
// SAI: người gọi thấy tài liệu này trong danh sách, giờ hệ thống nói nó
// không tồn tại. Họ sẽ đi báo bug, và bug đó không có.
if (!document || !document.editorIds.includes(user.id)) {
    throw new DocumentNotFoundException({ id: request.documentId })
}
```

### Case: log giữ lý do thật

```ts
if (!plan || plan.userId !== user.id) {
    // người gọi nhận câu trả lời đã làm mềm; log nhận sự thật, nếu không thì
    // lần điều tra sau không còn gì để đọc
    this.logger.warn("payment plan refused", {
        planId: request.planId,
        callerId: user.id,
        reason: plan ? "not-owned" : "missing",
    })
    throw new PaymentPlanNotFoundException({ planId: request.planId, userId: user.id })
}
```

### Ngoại lệ và nhầm lẫn

- **Nói ra mình đang chọn cái nào.** Cả hai chiều đều vô hình khi đọc code: một not-found ở chỗ đáng
  ra forbidden thì hại người dùng hợp lệ, một forbidden ở chỗ đáng ra not-found thì rò rỉ dữ liệu.
- **Không dùng cùng một exception cho cả hai chủ ý.** Một exception có tên riêng cho mỗi ý nghĩa là
  cách duy nhất để người đọc sau biết quyết định này là **cố ý**.

---

## `AUTHZ-5` — entitlement là trạng thái, không phải dòng

### Case: gọi tên cột trạng thái trong câu query

```ts
// cột phân biệt "đã mua" với "dùng thử" được nêu ngay trong query
const isEntitled = await this.entityManager.exists(MembershipEntity, {
    where: {
        productId: request.productId,
        userId: user.id,
        isPaid: true,
    },
})
```

### Case: cái bẫy — sự tồn tại của dòng

```ts
// SAI: một dòng dùng thử cũng thoả check này, nên mọi thứ đứng sau nó là miễn phí
const isEntitled = await this.entityManager.exists(MembershipEntity, {
    where: { productId: request.productId, userId: user.id },
})
```

Hai đoạn trên khác nhau **đúng một thứ**: một bản dùng thử có mở được cái cổng mà một lần mua đáng ra
mới mở hay không.

### Case: vì sao dòng quan hệ gần như miễn phí

```ts
// hệ thống TỰ TẠO dòng quan hệ cho bất kỳ ai chạm vào sản phẩm, ở trạng thái
// chưa trả tiền -- nên `exists` trên bảng này gần như luôn đúng
async resolveOrCreateTrialMembership(userId: string, productId: string): Promise<MembershipEntity> {
    const existing = await this.entityManager.findOne(MembershipEntity, {
        where: { userId, productId },
    })
    if (existing) {
        return existing
    }
    return this.entityManager.save(
        this.entityManager.create(MembershipEntity, { userId, productId, isPaid: false }),
    )
}
```

Đọc đoạn này rồi đọc lại case "cái bẫy" ở trên là đủ để thấy check tồn tại từ chối được **không ai**.

### Case: hai guard trên cùng một quan hệ

```ts
// guard A -- dựng ngữ cảnh, luôn cho qua
@Injectable()
export class MembershipContextGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = GqlExecutionContext.create(context).getContext().req
        request.membership = await this.service.resolveOrCreateTrialMembership(
            request.user.id,
            request.headers["x-product-id"],
        )
        return true
    }
}

// guard B -- đọc trạng thái, có từ chối
@Injectable()
export class PaidMembershipGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = GqlExecutionContext.create(context).getContext().req
        const isPaid = await this.service.hasPaidMembership(
            request.user.id,
            request.headers["x-product-id"],
        )
        if (!isPaid) {
            throw new PaidMembershipRequiredException({ userId: request.user.id })
        }
        return true
    }
}
```

Hai guard, một quan hệ. Cặp này chính là bằng chứng rằng **dòng** và **trạng thái** là hai sự thật
khác nhau — và là lý do gắn nhầm guard vào một cửa trả phí không hề vỡ ở compile time.

### Case: trạng thái mang thời hạn

```ts
// ĐÚNG: "còn hiệu lực" cũng là một trạng thái, và nó cũng phải nằm trong query
const isEntitled = await this.entityManager.exists(SubscriptionEntity, {
    where: {
        userId: user.id,
        status: SubscriptionStatus.Active,
        expiresAt: MoreThan(this.clock.now()),
    },
})
```

### Case: check đúng bị copy sang chỗ cột bị rơi

```ts
// SAI: copy từ một chỗ mà quan hệ chỉ có một nghĩa, dán sang chỗ có hai nghĩa
const mayDownloadCertificate = await this.entityManager.exists(MembershipEntity, {
    where: { productId: request.productId, userId: user.id },
})
```

### Ngoại lệ và nhầm lẫn

- **Quan hệ chỉ có một trạng thái thì check tồn tại là đủ** — và chỉ đủ đến đúng ngày ai đó thêm cột
  trạng thái thứ hai. Từ ngày đó, mọi check tồn tại trên quan hệ ấy là lỗi.
- **Đừng viết trạng thái trong comment:**

  ```ts
  // SAI: comment nói "chỉ thành viên trả phí", query không nói gì cả
  // only paid members
  const isEntitled = await this.entityManager.exists(MembershipEntity, {
      where: { productId: request.productId, userId: user.id },
  })
  ```

---

## `AUTHZ-6` — operator là chủ thể khác

### Case: hai chủ thể, hai guard

```ts
// cửa của người dùng
@UseGuards(SessionAuthGuard)
@Query(() => MyOrdersResponse, { name: "myOrders" })
async myOrders(@CurrentUser() user: UserEntity): Promise<Array<OrderEntity>> { /* ... */ }

// cửa vận hành -- khoá máy trên header, không phải session người dùng
@UseGuards(OperatorKeyGuard)
@Query(() => QueueDepthResponse, { name: "queueDepth" })
async queueDepth(): Promise<QueueDepthResult> { /* ... */ }
```

### Case: một guard cho cả hai chủ thể

```ts
// SAI: guard trả "được" cho cả session người dùng lẫn khoá máy, nên quản trị
// viên của một khách hàng với tới được cửa vận hành
@Injectable()
export class AnyAuthenticatedGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        return Boolean(request.user) || Boolean(request.headers["x-operator-key"])
    }
}
```

### Case: cờ trên bảng người dùng không dựng ra một chủ thể

```ts
// SAI: `isAdmin` là một thuộc tính của người dùng sản phẩm; nó nâng quyền
// TRONG phạm vi sản phẩm, không biến người đó thành người vận hành nền tảng
@UseGuards(SessionAuthGuard)
@Query(() => AllTenantsResponse, { name: "allTenants" })
async allTenants(@CurrentUser() user: UserEntity): Promise<Array<TenantEntity>> {
    if (!user.isAdmin) {
        throw new ForbiddenException()
    }
    return this.service.listEveryTenant()
}
```

### Case: operator đọc dữ liệu của một người dùng — hợp lệ, nếu nói rõ của ai

```ts
// ĐÚNG: xác thực bằng danh tính operator, và nói rõ đang đọc dữ liệu của ai
@UseGuards(OperatorKeyGuard)
@Query(() => UserOrdersResponse, { name: "ordersOfUser" })
async ordersOfUser(
    @Args("userId") userId: string,
): Promise<Array<OrderEntity>> {
    return this.service.listOrdersOf(userId)
}
```

### Case: hai guard operator cho hai transport, không dùng chung base người dùng

```ts
// REST: request nằm trên switchToHttp()
@Injectable()
export class OperatorKeyRestGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        return this.matches(context.switchToHttp().getRequest().headers["x-operator-key"])
    }
}

// GraphQL: resolver không có HTTP request trên switchToHttp(), nó nằm trên context.req
@Injectable()
export class OperatorKeyGraphQLGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const gql = GqlExecutionContext.create(context).getContext()
        return this.matches(gql.req?.headers?.["x-operator-key"])
    }
}
```

### Ngoại lệ và nhầm lẫn

- **Chủ thể quyết định cả transport.** Một cửa phục vụ chủ thể không-phải-người-dùng nói ra điều đó,
  và đó là một trong số ít lý do hợp lệ để cửa ấy không phải GraphQL — xem `transport.md`.
- **Service token là chủ thể thứ ba,** không phải "operator hạng nhẹ". Một pod tự đăng ký lúc khởi
  động không có session người dùng nào để mang, và cũng không nên cầm khoá vận hành.
- **Guard vận hành phải fail closed:**

  ```ts
  // ĐÚNG: bí mật chưa mount thì từ chối, chứ không phải chấp nhận mọi header
  private readOperatorKey(): string {
      const key = this.secrets.operatorKey
      if (!key) {
          throw new OperatorKeyNotConfiguredException({})
      }
      return key
  }
  ```

---

## Ánh xạ yêu cầu sang một mã

Nêu chủ thể, cửa, bản ghi và cách từ chối. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng. Câu trả lời phải là một mã kèm chỗ đặt check, hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Thêm mutation mới, copy từ mutation cũ" | Cửa mới đọc danh tính, guard rơi lúc copy | `AUTHZ-2` | `@UseGuards(...)` trên method hoặc class |
| "Bỏ cái `if (!user)` trong handler đi cho gọn" | Guard phủ một cửa; handler phủ mọi caller của bus | `AUTHZ-1` | Giữ nguyên check trong handler |
| "Cho người dùng xoá bình luận của chính họ" | Phải biết bình luận đó của ai | `AUTHZ-3` | Load dòng, so `row.ownerId` với danh tính |
| "Người khác gọi tới bản nháp riêng tư thì trả gì" | Người gọi không có đường hợp lệ nào để biết nó tồn tại | `AUTHZ-4` | Not-found, log giữ lý do thật |
| "Trong danh sách chung có tài liệu này, nhưng họ không được sửa" | Người gọi biết bản ghi một cách chính đáng | `AUTHZ-4` | Forbidden có tên |
| "Chặn nội dung này cho người chưa mua" | Quan hệ có cả trạng thái dùng thử | `AUTHZ-5` | Nêu cột trạng thái trong query |
| "Dựng trang trạng thái hạ tầng cho đội vận hành" | Chủ thể không phải người dùng sản phẩm | `AUTHZ-6` | Guard operator riêng, transport riêng |
| "Thêm cờ `isAdmin` để mở trang vận hành" | Cờ trên bảng người dùng không dựng ra chủ thể mới | `AUTHZ-6` | Guard operator, không phải cờ |
| "Query công khai nhưng muốn biết ai đang xem" | Danh tính vẫn phải được dựng ra, chỉ là được phép vắng | `AUTHZ-2` | Guard xác thực tuỳ chọn |

Ở dòng cuối, câu hỏi phân định **chỉ** được hỏi khi yêu cầu chưa nói rõ: *"Người vô danh có được phép
đọc query này không, hay chỉ là không bắt buộc đăng nhập để thấy phần công khai?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `AUTHZ-1` / `AUTHZ-2` | Check này nằm ở chỗ danh tính được **dựng ra**, hay chỗ danh tính được **dùng**? |
| `AUTHZ-1` / `AUTHZ-3` | Câu hỏi là "có ai không", hay "có phải người này không"? |
| `AUTHZ-2` / `AUTHZ-6` | Vấn đề là **không có** guard, hay là **sai** guard cho chủ thể này? |
| `AUTHZ-3` / `AUTHZ-4` | Đã quyết định **có từ chối** chưa, hay đang chọn **từ chối bằng câu nào**? |
| `AUTHZ-3` / `AUTHZ-5` | Câu hỏi là "dòng này của ai", hay "quan hệ này đang ở trạng thái nào"? |
| `AUTHZ-4` / mọi mã | Người gọi có đường hợp lệ nào để biết bản ghi này tồn tại không? |
| `AUTHZ-5` / `AUTHZ-6` | Cùng một chủ thể ở trạng thái khác, hay hai chủ thể khác nhau? |

## Sai lầm lặp lại nhiều nhất

1. Tách một method ra khỏi class đã có guard, và guard không đi theo.
2. Xoá `if (!user)` trong handler vì "resolver có guard rồi".
3. So sánh hai id mà cả hai đều nằm trong request.
4. `exists` trên bảng quan hệ mà không nêu cột trạng thái.
5. Trả forbidden cho một bản ghi mà sự tồn tại của nó mới là bí mật.
6. Trả not-found cho một bản ghi người gọi vừa thấy trong danh sách của họ.
7. Làm mềm câu trả lời cho người gọi **và** làm mềm luôn cả dòng log.
8. Dựng một guard trả "được" cho cả session người dùng lẫn khoá vận hành.
9. Viết luật phân quyền trong service cạnh handler, nơi caller thứ hai không với tới.
10. Copy một check entitlement đúng sang một chỗ mà cột phân biệt có ý nghĩa, và làm rơi cột đó.
