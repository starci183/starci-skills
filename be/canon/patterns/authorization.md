# ủy quyền

## Định nghĩa

Xác thực hỏi **đây là ai**. Ủy quyền hỏi **người đó có được phép làm việc này trên đối tượng này hay không**. Đây là hai câu hỏi khác nhau, được trả lời ở hai nơi khác nhau: một câu có thể trả lời mà không cần đọc dữ liệu, còn câu kia thì không.

Guard nhìn thấy request. Nó có thể xác minh token, phân giải người dùng và từ chối caller ẩn danh — đó là toàn bộ phạm vi của nó, vì row mà caller muốn truy cập vẫn chưa được tải. Người dùng này có sở hữu review này, có enrollment trong course này, hay có thuộc tenant sở hữu record này không đều là câu hỏi về một row; chỉ handler mới đồng thời giữ row và identity.

Câu hỏi quyết định vị trí của phép kiểm tra là: **câu trả lời có phụ thuộc vào dữ liệu của request không?** “Có ai đăng nhập không?” không phụ thuộc, nên thuộc về cánh cửa. “Người này có được sửa *đối tượng đó* không?” có phụ thuộc, nên thuộc về handler.

Phần có thể kiểm tra bằng máy nằm trong [`sources/be/authorization.mjs`](../../../sources/be/authorization.mjs). Phần đó chỉ là AUTHZ-2 — không hơn — vì các phần còn lại phụ thuộc vào row đang được truy cập và ý nghĩa của quyền sở hữu; parser không biết những điều đó. Module ghi lại những gì đã đo và cố ý không chạm vào phần còn lại, để người đọc sau không “làm nốt” bằng cách viết một rule kích hoạt trên mọi handler đúng trong cây.

## Quy tắc

**AUTHZ-1 · Handler sở hữu các điều kiện tiên quyết của chính nó, và identity là một trong số đó.**

Handler kiểm tra rằng nó có user không phải là lặp lại guard. Guard thuộc về MỘT cánh cửa, còn handler thuộc về mọi cánh cửa — CLI, job, harness và transport tiếp theo đều có thể gọi nó mà không có resolver đứng trước. Đây cũng là lập luận của CQRS khi đặt công việc trong handler, nay áp dụng cho điều kiện tiên quyết của công việc.

Vì vậy, phép kiểm tra này chỉ mang tính phòng thủ. Xóa nó đi thì operation chỉ an toàn chừng nào chưa có ai gọi từ một nơi mới.

**AUHZ-2 · Cánh cửa ĐỌC identity phải mang guard thiết lập identity đó.**

Resolver method nhận tham số authenticated user nhưng không có guard trên method hoặc class đang đọc một user từ request mà chưa có gì xác thực. Mã vẫn biên dịch, vẫn im lặng, và thứ được chuyển cho handler chỉ là giá trị pipeline tình cờ để lại.

Đây là nửa đáng để thành rule, vì lỗi này trông như không có lỗi: cánh cửa vẫn nhắc đến user, handler vẫn nhận được user, chỉ thiếu dòng chứng minh user đó thuộc về caller.

**AUHZ-3 · Quyền sở hữu được quyết định dựa trên row đã tải, không bao giờ dựa trên request.**

`request.reviewId` cho biết caller ĐẶT TÊN row nào, không cho biết caller sở hữu row nào. Hãy tải row, so sánh owner với authenticated identity rồi từ chối theo kết quả so sánh. Phép kiểm tra dựa trên id do caller cung cấp là phép kiểm tra mà caller có thể vượt qua bằng cách cung cấp id khác.

**AUTHZ-4 · Từ chối mà làm lộ sự tồn tại của private row phải là not-found.**

“Bạn không được sửa đối tượng này” và “đối tượng này không tồn tại” là hai sự thật khác nhau, nên thông thường mỗi trường hợp cần exception riêng. Ngoại lệ là row mà caller không thể biết trước: trả lời “forbidden” ở đó sẽ xác nhận row tồn tại, trong khi chính sự tồn tại là bí mật. Hãy trả lời not-found và để log mang lý do thật.

Khi viết phép từ chối, hãy nói rõ nó thuộc loại nào trong hai loại trên. Chọn sai sẽ gây lỗi theo cả hai hướng: not-found ở nơi cần forbidden khiến caller hợp lệ đi tìm một bug không tồn tại; forbidden ở nơi cần not-found tạo ra một oracle cho phép enumeration.

**AUTHZ-5 · Entitlement là một STATE; có row không đồng nghĩa với có state đó.**

Enrollment, membership, subscription, trial. Một row cho biết ai đó có quan hệ với course, nhưng không cho biết quan hệ nào: trial và paid đều là enrollment nhưng cấp các quyền khác nhau. Phép kiểm tra coi sự TỒN TẠI của row là entitlement sẽ cấp cho trial mọi thứ vốn chỉ được mở sau khi mua.

Hãy đọc field mang sự phân biệt đó và nêu field ngay trong query, thay vì mô tả trong comment. Đây là loại phép kiểm tra thường được viết đúng một lần rồi sao chép sang nơi mà sự phân biệt vẫn quan trọng nhưng field đã bị bỏ đi.

**AUHZ-6 · Operator là một subject khác với viewer.**

Platform operator, service token và product user là ba identity khác nhau. Gắn cả ba vào một guard có thể khiến administrator của một academy vận hành toàn bộ platform. Subject quyết định guard; cánh cửa phục vụ subject không phải viewer phải nói rõ điều đó — xem `transport.md`, nơi đặt một cánh cửa như vậy và nêu lý do duy nhất cho phép nó không phải GraphQL.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Resolver đọc authenticated user mà không có guard trên method hoặc class | Nó đọc identity từ một request chưa được xác thực và chuyển cho handler bất cứ thứ gì pipeline để lại | Đặt guard trên cánh cửa đọc identity |
| Quyết định ownership từ các id trong request | Caller đã chọn các id đó, nên có thể vượt qua phép kiểm tra bằng cách chọn id khác | Tải row và so sánh owner của nó với authenticated identity |
| Trả lời “forbidden” cho row mà caller không thể biết tồn tại | Từ chối sẽ xác nhận row tồn tại, trong khi sự tồn tại là bí mật | Trả lời not-found; ghi lý do thật vào log |
| Trả lời “not found” ở nơi caller biết rõ row | Nó khiến caller hợp lệ đi tìm một bug không tồn tại | Đặt tên cho kiểu từ chối |
| Coi sự tồn tại của entitlement row là entitlement | Trial và paid đều là row nhưng cấp các quyền khác nhau | Đọc field phân biệt chúng |
| Dùng một guard cho operator, service token và product user | Administrator của một tenant có thể vận hành toàn bộ platform | Một guard cho mỗi subject |
| Xóa điều kiện identity của handler vì resolver đã có guard | Guard chỉ che một cánh cửa; handler có nhiều caller như bus có người gọi | Giữ lại; đó là điều kiện của handler, không phải của cánh cửa |
| Viết rule authorization trong service cạnh handler | Nó không có message, nên cánh cửa thứ hai không thể dùng lại và sẽ tạo bản sao riêng | Đặt rule trong handler |

## Ví dụ

### Cánh cửa đọc một identity chưa được chứng minh

```ts
@UseGuards(KeycloakAuthGraphQLGuard)
@Mutation(() => SubmitCourseReviewResponse, { name: "submitCourseReview" })
async execute(
    @KeycloakGraphQLUser() user: UserEntity,
    @Args("request") request: SubmitCourseReviewRequest,
): Promise<CourseReviewEntity> { /* ... */ }
```

```ts
// Wrong: the parameter still says `user`, the handler still receives one, and nothing
// established that it belongs to the caller.
@Mutation(() => SubmitCourseReviewResponse, { name: "submitCourseReview" })
async execute(
    @KeycloakGraphQLUser() user: UserEntity,
    @Args("request") request: SubmitCourseReviewRequest,
): Promise<CourseReviewEntity> { /* ... */ }
```

Chúng chỉ khác nhau ở một điểm: cánh cửa có chứng minh identity mà nó đọc hay không.

### Bẫy ownership

```ts
// the row decides, and the row was loaded
const review = await this.entityManager.findOne(CourseReviewEntity, {
    where: { id: reviewId },
    relations: { user: true },
})
if (!review) throw new CourseReviewNotFoundException({ id: reviewId })
if (review.user.id !== user.id) throw new CourseReviewNotOwnedException({ id: reviewId })
```

```ts
// Wrong: the caller supplied both ids, so they satisfy this by supplying different ones.
if (request.userId !== user.id) {
    throw new CourseReviewNotOwnedException({ id: request.reviewId })
}
await this.entityManager.delete(CourseReviewEntity, { id: request.reviewId })
```

Chúng chỉ khác nhau ở một điểm: phép kiểm tra có đọc dữ liệu mà caller không tự chọn hay không.

### Bẫy entitlement

```ts
// the field that distinguishes a purchase from a trial is named in the query
const isEntitled = await this.entityManager.exists(EnrollmentEntity, {
    where: { course: { id: courseId }, user: { id: user.id }, isEnrolled: true },
})
```

```ts
// Wrong: a trial row satisfies this, so everything gated behind it is free.
const isEntitled = await this.entityManager.exists(EnrollmentEntity, {
    where: { course: { id: courseId }, user: { id: user.id } },
})
```

Chúng chỉ khác nhau ở một điểm: trial có vượt qua được cổng vốn chỉ purchase mới mở hay không.

### Từ chối làm lộ thông tin

```ts
// a draft nobody may read: the refusal does not confirm it exists
if (!draft || draft.author.id !== user.id) {
    throw new DraftNotFoundException({ id: draftId })
}
```

```ts
// Wrong: iterate ids, and "forbidden" maps every draft in the system.
if (!draft) throw new DraftNotFoundException({ id: draftId })
if (draft.author.id !== user.id) throw new DraftNotOwnedException({ id: draftId })
```

Chúng chỉ khác nhau ở một điểm: lời từ chối có trở thành enumeration oracle hay không.
