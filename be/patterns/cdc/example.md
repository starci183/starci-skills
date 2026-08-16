---
id: be-patterns-cdc-example
title: example.md
slug: /be/patterns/cdc/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã CDC-N, viết bằng TypeScript/NestJS thường.
---

# example.md

> Version: `2.00` · Module: `cdc` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một class dáng NestJS**. Không tên sản phẩm, không
tên repository, không tên module riêng của ai. Một luật CDC chỉ đúng khi nó đúng ở bất kỳ service
nào projection dữ liệu — nên nếu một ví dụ cần tên riêng của một hệ thống mới đọc được, ví dụ đó sai
chỗ.

Mỗi mã có **nhiều case**, mỗi case đặt ĐÚNG cạnh SAI, rồi tới mục **ngoại lệ và nhầm lẫn**. Phần
cuối trang ánh xạ từ yêu cầu bằng lời sang một mã duy nhất.

---

## `CDC-1` — vòng đời Kafka thuộc về base

### Case: khai báo một listener mới

ĐÚNG — listener chỉ khai báo bốn thứ nó thật sự sở hữu:

```ts
@Injectable()
export class UserPointsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "user-points-projection"

    protected readonly topics = [
        `${envConfig().kafka.cdcTopicPrefix}activities`,
    ]

    constructor(
        kafkaService: KafkaService,
        winstonService: WinstonService,
        private readonly userPointsProjectionService: UserPointsProjectionService,
    ) {
        super(kafkaService, winstonService)
    }
}
```

SAI — cùng một projection, nhưng vòng đời Kafka bị nhân bản vào đây:

```ts
@Injectable()
export class UserPointsProjectionListener implements OnModuleInit {
    async onModuleInit(): Promise<void> {
        const consumer = this.kafka.consumer({ groupId: "user-points-projection" })
        await consumer.connect()
        await consumer.subscribe({ topics: ["primary.public.activities"] })
        await consumer.run({ eachMessage: (payload) => this.handle(payload) })
    }
}
```

Khác nhau ở chỗ: mười bảy listener có chung **một** hợp đồng giao nhận, hay mười bảy hợp đồng sẽ dần
bất đồng với nhau về offset, về tombstone, về `fromBeginning`.

### Case: vòng đời giấu trong constructor

Lint bắt được `onModuleInit`. Nó **không** bắt được cái này, và cái này vi phạm cùng một mã:

```ts
// SAI: vẫn là consumer riêng, chỉ đổi chỗ đứng.
@Injectable()
export class ReviewStatsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "review-stats-projection"
    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}reviews`]

    constructor(private readonly kafka: Kafka) {
        super(kafkaService, winstonService)
        void this.startPrivateConsumer()
    }
}
```

Đọc `Tầng giữ` trong [`INDEX.md`](./INDEX.md): mã này là mã **duy nhất** được đánh `enforced`, và
đây đúng là phần dư mà rule không thấy. Người review vẫn phải nhìn.

### Case: parse envelope là việc của base

ĐÚNG — chỉ có một chỗ trong toàn hệ thống biết Debezium gói dữ liệu thế nào:

```ts
private unwrapRow(payload: unknown): unknown | null {
    if (!payload || typeof payload !== "object") {
        return payload
    }
    if (!("after" in payload)) {
        return payload
    }
    return (payload as { after?: unknown }).after ?? null
}
```

SAI — mỗi listener tự đoán hình dạng envelope:

```ts
// SAI: khi connector bật/tắt SMT unwrap, chỉ một nửa số projection còn chạy.
protected deriveTargets({ row }: ProjectionCdcMessage): Array<string> {
    const parsed = JSON.parse(String(row)) as { payload: { after: { user_id: string } } }
    return [parsed.payload.after.user_id]
}
```

### Ngoại lệ và nhầm lẫn

- **Boot best-effort nằm trong base, và đó là ngoại lệ hợp lệ:**

  ```ts
  try {
      await this.projectionKafkaService.ensureTopics({ topics: this.topics })
      // ... subscribe + run
  } catch (error) {
      // broker chết không được kéo API chết theo
      this.winstonService.log(WinstonLog.CdcListenerDisabled, {
          op: "projection.cdc.disabled",
          meta: { groupId: this.groupId },
      })
  }
  ```

  Nó là ngoại lệ về **tính sẵn sàng**, không phải giấy phép để listener cụ thể mọc vòng đời riêng.

- **`AbstractProjectionListener` không phải chỗ để nhét logic của một projection.** Base nhận thêm
  một `if (this.groupId === "...")` là base đã hỏng.
- **Một helper riêng gọi `consumer.run` rồi được listener gọi vào** vẫn là consumer riêng. Vị trí
  của dòng code không đổi được quyền sở hữu.

---

## `CDC-2` — danh tính consumer và tập nguồn

### Case: group cố định

ĐÚNG:

```ts
protected readonly groupId = "course-stats-projection"
```

SAI:

```ts
// SAI: mỗi lần boot là một consumer group mới -> replay lại toàn bộ lịch sử topic.
protected readonly groupId = `course-stats-${randomUUID()}`
```

Một `groupId` ngẫu nhiên không làm sai **con số** (vì `CDC-4` giữ điều đó), nhưng nó biến mỗi lần
restart thành một lần đọc lại toàn bộ lịch sử, và biến "vì sao deploy xong DB nghẽn" thành một câu
hỏi không ai trả lời được.

### Case: group không được mang tên tiến trình

```ts
// SAI: 4 replica -> 4 group -> mỗi message được xử lý 4 lần.
protected readonly groupId = `points-projection-${os.hostname()}`
```

```ts
// ĐÚNG: 4 replica -> 1 group -> partition được chia cho nhau.
protected readonly groupId = "points-projection"
```

Đây là chỗ `CDC-2` trả tiền: consumer group là **cơ chế chia việc**, không phải nhãn để phân biệt
tiến trình.

### Case: topic liệt kê đủ

ĐÚNG — prefix lấy từ env, danh sách bảng thì viết ra:

```ts
protected readonly topics = [
    `${envConfig().kafka.cdcTopicPrefix}xp_histories`,
    `${envConfig().kafka.cdcTopicPrefix}users`,
]
```

SAI:

```ts
// SAI: pattern subscribe kéo về cả những bảng projection này không hiểu,
// và vẫn im lặng bỏ sót bảng chưa tồn tại lúc subscribe.
protected readonly topics = [/^primary\.public\..*$/ as unknown as string]
```

### Case: thiếu một topic là projection sai, không phải projection chậm

```ts
// SAI: tổng điểm gồm cả số dư ví, nhưng chỉ nghe ledger.
protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}xp_histories`]
```

```ts
// ĐÚNG: mọi bảng có mặt trong câu SQL recompute đều phải có mặt ở đây.
protected readonly topics = [
    `${envConfig().kafka.cdcTopicPrefix}xp_histories`,
    `${envConfig().kafka.cdcTopicPrefix}users`,
]
```

Phép thử của case này: **mở câu SQL recompute ra, đếm bảng**. Mọi bảng xuất hiện trong `FROM` hoặc
`JOIN` mà không có trong `topics` là một nguồn có thể đổi mà projection không bao giờ biết.

### Ngoại lệ và nhầm lẫn

- **Prefix từ env là hợp lệ**, vì nó là địa chỉ môi trường chứ không phải danh tính nghiệp vụ. Danh
  sách bảng thì không.
- **Đổi `groupId` = mất offset.** Đổi tên group là một quyết định vận hành (projection sẽ đọc lại từ
  đâu?), không phải một lần đổi tên biến.
- **`fromBeginning: false` nằm trong base là cố ý.** Một projection cần backfill thì chạy job
  recompute trực tiếp — cùng một hàm mà `recomputeTarget` gọi — chứ không replay topic.

---

## `CDC-3` — listener định tuyến, service tính lại

### Case: ánh xạ theo topic

ĐÚNG:

```ts
protected deriveTargets({ topic, row }: ProjectionCdcMessage): Array<string> {
    if (topic.endsWith("users")) {
        const userRow = row as { id?: string }
        return userRow.id ? [userRow.id] : []
    }
    const activityRow = row as { user_id?: string }
    return activityRow.user_id ? [activityRow.user_id] : []
}
```

SAI — cùng chỗ đó, nhưng có một business command lẻn vào:

```ts
// SAI: replay 10.000 message cũ = gửi lại 10.000 email.
protected async deriveTargets({ row }: ProjectionCdcMessage): Promise<Array<string>> {
    const activityRow = row as { user_id: string; amount: number }
    if (activityRow.amount > 100) {
        await this.notificationService.sendMilestoneEmail(activityRow.user_id)
    }
    return [activityRow.user_id]
}
```

Khác nhau ở chỗ: replay có lặp lại hiệu ứng ra **bên ngoài** projection hay không.

### Case: uỷ quyền tính lại

ĐÚNG:

```ts
protected async recomputeTarget(userId: string): Promise<void> {
    await this.userPointsProjectionService.recompute({ userId })
}
```

SAI:

```ts
// SAI: chính sách SQL của projection nay có hai bản — một trong listener,
// một trong service — và chỉ một bản được dùng khi sửa chữa thủ công.
protected async recomputeTarget(userId: string): Promise<void> {
    await this.entityManager.query(
        `UPDATE user_points_projections SET value = (
             SELECT SUM(amount) FROM activities WHERE user_id = $1
         ) WHERE user_id = $1`,
        [userId],
    )
}
```

Đường tính lại phải có **đúng một** lối vào, vì CDC không phải khách hàng duy nhất của nó: backfill,
sửa chữa sau sự cố và migration đều gọi cùng hàm đó.

### Case: nhiều target từ một dòng

```ts
// ĐÚNG: một dòng ghi danh làm hai projection bẩn -> trả về cả hai danh tính.
protected deriveTargets({ row }: ProjectionCdcMessage): Array<UserCourseTarget> {
    const enrollment = row as { user_id?: string; course_id?: string }
    if (!enrollment.user_id || !enrollment.course_id) {
        return []
    }
    return [{ userId: enrollment.user_id, courseId: enrollment.course_id }]
}
```

### Case: đọc để phân giải cha — được phép

```ts
// ĐÚNG: đây là ĐỌC. Replay lặp lại nó không để lại dấu vết nào.
private async deriveFromSubmissionAttempt(
    row: SubmissionAttemptCdcRow,
): Promise<UserCourseTarget | null> {
    const submission = await this.entityManager.findOne(SubmissionEntity, {
        where: { id: row.submission_id },
        select: { userId: true, courseId: true },
    })
    // cha đã bị xoá / orphan -> bỏ qua
    return submission ? { userId: submission.userId, courseId: submission.courseId } : null
}
```

### Ngoại lệ và nhầm lẫn

- **Mảng rỗng là câu trả lời đúng**, không phải một lần né việc:

  ```ts
  // ĐÚNG: cột đổi không nằm trong công thức projection.
  return []
  ```

- **`recomputeTarget` gọi hai service là dấu hiệu projection bị gộp.** Tách thành hai listener, hoặc
  hai target, chứ không phải hai lời gọi trong một hàm.
- **`deriveTargets` trả về `null` thay vì `[]`** buộc base phải đoán; hợp đồng là một mảng.

---

## `CDC-4` — tính lại từ nguồn, không cộng delta

### Case: chữ ký hàm đã tố cáo tất cả

ĐÚNG:

```ts
async recompute({ userId }: RecomputeUserPointsParams): Promise<void> {
    await this.entityManager.query(this.buildUpsertSql(), [userId])
}
```

SAI:

```ts
// SAI: `amount` tới từ event. Giao trùng -> cộng hai lần.
async applyDelta({ userId, amount }: ApplyPointsDeltaParams): Promise<void> {
    await this.entityManager.increment({ userId }, "totalPoints", amount)
}
```

Không cần đọc thân hàm: một hàm recompute nhận `amount` thì nó không phải hàm recompute.

### Case: câu UPSERT

ĐÚNG:

```sql
INSERT INTO user_points_projections (user_id, value, updated_at)
VALUES ($1, jsonb_build_object(
    'totalPoints', COALESCE((SELECT SUM(a.amount)::int FROM activities a WHERE a.user_id = $1), 0),
    'coinBalance', COALESCE((SELECT u.coin_balance FROM users u WHERE u.id = $1), 0)
), now())
ON CONFLICT (user_id) DO UPDATE SET
    value      = EXCLUDED.value,
    updated_at = now()
```

SAI:

```sql
-- SAI: cộng dồn. Giao trùng nhân đôi, giao thiếu thì không bao giờ tự lành.
UPDATE user_points_projections
SET value = jsonb_set(value, '{totalPoints}',
        to_jsonb((value->>'totalPoints')::int + $2))
WHERE user_id = $1
```

### Case: read-modify-write cũng là cộng delta

```ts
// SAI: hai message của cùng một user chạy song song -> mất một lần cập nhật.
const current = await this.repository.findOneBy({ userId })
await this.repository.save({ userId, total: (current?.total ?? 0) + row.amount })
```

```ts
// ĐÚNG: một câu lệnh, tính từ nguồn, không đọc trạng thái cũ của projection.
await this.entityManager.query(this.buildUpsertSql(), [userId])
```

Điểm mấu chốt không phải "ít câu SQL hơn". Là: projection **không được** là input của chính nó.

### Case: đếm cũng phải đếm từ nguồn

```ts
// SAI: mỗi review mới +1. Consumer restart giữa chừng là số đếm sai vĩnh viễn.
await this.repository.increment({ courseId }, "reviewCount", 1)
```

```ts
// ĐÚNG: đếm lại. Kết quả không phụ thuộc vào việc đã có bao nhiêu message đi qua.
await this.entityManager.query(
    `INSERT INTO course_review_stats_projections (course_id, review_count, average_rating)
     SELECT $1, COUNT(*), COALESCE(AVG(rating), 0) FROM reviews WHERE course_id = $1
     ON CONFLICT (course_id) DO UPDATE SET
         review_count   = EXCLUDED.review_count,
         average_rating = EXCLUDED.average_rating`,
    [courseId],
)
```

### Ngoại lệ và nhầm lẫn

- **"Recompute cả bảng thì chậm" không phải ngoại lệ.** Recompute **một target** mới là hợp đồng;
  nếu một target vẫn quá nặng thì đó là bài toán index hoặc bài toán chia nhỏ target, không phải giấy
  phép cộng delta.
- **Một `entityManager` truyền từ ngoài vào là hợp lệ**, để chỗ gọi khác gói recompute trong
  transaction của nó:

  ```ts
  const manager = entityManager ?? this.entityManager
  ```

- **Projection có cột `updated_at` là bình thường**; nó không phải trạng thái, nó là dấu vết. Nhưng
  một cột `last_event_offset` để "biết đã xử lý tới đâu" là dấu hiệu ai đó đang dựng lại cơ chế
  offset của Kafka bên trong projection.

---

## `CDC-5` — tombstone không dựng ra trạng thái hiện tại

### Case: không có ảnh `after` thì không có gì để ánh xạ

ĐÚNG — base bỏ qua trước khi listener kịp thấy:

```ts
const row = this.unwrapRow(payload)
if (row === null) {
    return
}
```

SAI:

```ts
// SAI: bịa ra một entity rỗng rồi ghi cái rỗng đó xuống.
const row = (payload as { after?: unknown }).after ?? ({} as UserCdcRow)
const targets = await this.deriveTargets({ topic, row })
```

### Case: message value rỗng

```ts
// ĐÚNG: tombstone thật của Kafka là message có key, value null.
if (!message.value) {
    return
}
```

```ts
// SAI: `String(null)` -> "null" -> JSON.parse ra null -> nhánh sau đoán mò.
const envelope = JSON.parse(String(message.value))
```

### Case: projection thật sự cần sửa chữa khi xoá

```ts
// SAI: lấy id từ key của tombstone rồi ghi 0.
protected deriveTargets({ row }: ProjectionCdcMessage): Array<string> {
    const deleted = row as { id?: string } | null
    return deleted?.id ? [deleted.id] : []
}
```

```ts
// ĐÚNG: nghe một nguồn CÒN GIỮ danh tính. Bảng ghi danh vẫn còn dòng
// `is_enrolled = false`, nên target vẫn phân giải được và recompute
// tự nhìn thấy nội dung đã biến mất.
protected readonly topics = [
    `${envConfig().kafka.cdcTopicPrefix}enrollments`,
    `${envConfig().kafka.cdcTopicPrefix}user_contents`,
]
```

Cách nghĩ ở đây: soft delete và deletion stream **giữ lại danh tính**; hard delete thì không. Luật
không cấm xử lý xoá — nó cấm lấy danh tính từ chỗ không có danh tính.

### Ngoại lệ và nhầm lẫn

- **Một `after` tồn tại nhưng thiếu cột khoá vẫn là bỏ qua**, và nó thuộc `CDC-3`:

  ```ts
  return row.user_id ? [row.user_id] : []
  ```

- **`__deleted: "true"` do SMT sinh ra là một dòng có ảnh hiện tại** — đó là soft-delete flag, không
  phải tombstone. Xử lý nó như một thay đổi bình thường.
- **Đừng cấu hình connector bỏ tombstone rồi coi như luật đã được giữ.** Cấu hình đổi được; base thì
  vẫn phải đúng khi nó đổi.

---

## `CDC-6` — một message hỏng không giết consumer

### Case: cô lập đúng một message

ĐÚNG:

```ts
try {
    // ... parse, derive, recompute
} catch (error) {
    const exception = new KafkaCdcMessageException({
        topic,
        originalError: error instanceof Error ? error : undefined,
    })
    this.winstonService.log(WinstonLog.RequestHandlingFailed, {
        op: "projection.cdc.message-failed",
        error: exception.message,
        meta: { groupId: this.groupId, topic },
    })
}
```

SAI:

```ts
// SAI: ném ra khỏi handler -> kafkajs rebalance/crash -> projection đứng hình
// vì đúng một dòng dữ liệu bẩn.
async handleMessage(payload: EachMessagePayload): Promise<void> {
    const row = JSON.parse(payload.message.value!.toString())
    await this.recomputeTarget(row.user_id)
}
```

### Case: log phải đủ để lần ra

```ts
// SAI: biết có lỗi, không biết lỗi ở topic nào, của projection nào.
catch (error) {
    console.error("cdc failed", error)
}
```

```ts
// ĐÚNG: `groupId` chỉ ra projection, `topic` chỉ ra nguồn. Thiếu một trong
// hai thì log này chỉ chứng minh rằng có gì đó đã hỏng.
this.winstonService.log(WinstonLog.RequestHandlingFailed, {
    op: "projection.cdc.message-failed",
    meta: { groupId: this.groupId, topic },
})
```

### Case: vì sao được phép nuốt

```ts
// Nuốt an toàn CHỈ VÌ câu này đúng: lần thay đổi kế tiếp của cùng dòng nguồn
// dựng lại đúng target đó từ đầu.
await manager.query(this.buildUpsertSql(), [userId])
```

```ts
// Nếu recompute là thế này thì mỗi lần nuốt là một sai số vĩnh viễn,
// và `CDC-6` biến từ cơ chế tự lành thành cơ chế mất dữ liệu im lặng.
await this.repository.increment({ userId }, "total", row.amount)
```

Hai đoạn trên là lý do `INDEX.md` gọi `CDC-4` là gốc: `CDC-6` không phải một quyết định độc lập, nó
là hệ quả được `CDC-4` trả tiền.

### Ngoại lệ và nhầm lẫn

- **Nuốt lỗi không có nghĩa là im lặng.** Không log kèm ngữ cảnh thì đó không phải cô lập, đó là
  giấu.
- **Retry trong handler là một quyết định khác** với cô lập, và nó phải có giới hạn. Retry vô hạn
  trên một message hỏng chính là cách consumer đứng hình mà log vẫn xanh.
- **Đừng bắt lỗi ở vòng lặp ngoài.** `catch` bọc cả `consumer.run` thì message thứ hai không bao giờ
  được xử lý.

---

## `CDC-7` — chứng minh bằng broker thật

### Case: hình dạng của một E2E vận hành

ĐÚNG:

```ts
// ARRANGE: ghi dòng NGUỒN. Không gọi projection service nào.
const user = await world.entityManager.save(
    world.entityManager.create(UserEntity, { keycloakId: "kc-cdc-routing" }),
)
await world.entityManager.save(
    world.entityManager.create(ActivityEntity, { user, amount: 17 }),
)

expect(await world.entityManager.count(UserPointsProjectionEntity)).toBe(0)

// ACT: chỉ chạm vào broker.
await world.publishChange("activities", { user_id: user.id, amount: 17 })

// ASSERT: chờ projection xuất hiện trong DB.
await until(async () => {
    const projection = await world.entityManager.findOne(UserPointsProjectionEntity, {
        where: { userId: user.id },
    })
    return projection?.value.totalPoints === 17
})
```

SAI:

```ts
// SAI: không có serialization, không có consumer group, không có offset,
// không có broker. Bài test này xanh kể cả khi `topics` khai sai hoàn toàn.
await listener.recomputeTarget(user.id)
expect(await repository.findOneBy({ userId: user.id })).toBeDefined()
```

### Case: ARRANGE không được gọi projection service

```ts
// SAI: projection có dữ liệu vì test tự tay ghi vào, không phải vì CDC chạy.
await projectionService.recompute({ userId: user.id })
await world.publishChange("activities", { user_id: user.id, amount: 17 })
```

```ts
// ĐÚNG: khẳng định "trước khi publish, projection rỗng" chính là thứ biến
// bài test thành bằng chứng.
expect(await world.entityManager.count(UserPointsProjectionEntity)).toBe(0)
```

### Case: assert phải có timeout, không phải sleep

```ts
// SAI: nhanh thì flaky, chậm thì tốn phút của mọi lần chạy CI.
await new Promise((resolve) => setTimeout(resolve, 3000))
expect(await repository.count()).toBe(1)
```

```ts
// ĐÚNG: poll cho tới khi đúng, hoặc hết hạn.
await until(async () => (await repository.count()) === 1)
```

### Ngoại lệ và nhầm lẫn

- **Unit test cho `deriveTargets` là hợp lệ và nên có.** Nó chỉ không được tính là bằng chứng CDC:

  ```ts
  expect(listener["deriveTargets"]({ topic: "primary.public.users", row: { id: "u1" } }))
      .toEqual(["u1"])
  ```

- **Mock producer không phải broker.** Nếu producer bị thay bằng một hàm gọi thẳng handler thì bài
  test đã quay về case SAI ở trên, chỉ dài hơn.
- **Một E2E cho một projection không chứng minh cho projection khác.** `groupId` và `topics` là khai
  báo riêng của từng listener, và chúng chính là thứ bài test này tồn tại để bắt.

---

## Ánh xạ yêu cầu sang một mã

Nêu projection, các bảng nguồn và cách một dòng phân giải thành danh tính. Nếu thiếu **một** dữ kiện
quyết định, hỏi **một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm một projection mới nghe bảng `reviews` | Vòng đời giao nhận đã có chủ | `CDC-1` | `extends AbstractProjectionListener` |
| Deploy 4 replica, mỗi message đang bị xử lý 4 lần | `groupId` mang tên tiến trình | `CDC-2` | Một hằng số group duy nhất |
| Projection lệch dù listener chạy, số dư không bao giờ đổi | Bảng `users` có trong SQL nhưng không có trong `topics` | `CDC-2` | Bổ sung topic còn thiếu |
| Muốn gửi email khi người dùng vượt mốc điểm | Replay sẽ gửi lại toàn bộ | `CDC-3` | Đưa ra ngoài CDC, sang luồng lệnh |
| Điểm bị nhân đôi sau khi broker giao trùng | Projection đang cộng delta | `CDC-4` | UPSERT tính lại từ nguồn |
| Xoá một dòng nguồn thì projection còn số cũ | Tombstone không mang danh tính | `CDC-5` | Nghe nguồn còn giữ danh tính |
| Một dòng JSON bẩn làm projection ngừng cập nhật | Lỗi ném ra khỏi handler | `CDC-6` | Cô lập + log kèm group và topic |
| Test xanh nhưng lên staging projection không chạy | Test gọi thẳng method của listener | `CDC-7` | E2E publish qua broker rồi poll DB |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `CDC-1` / `CDC-2` | Vòng đời đang bị nhân bản, hay chỉ là khai báo danh tính bị sai? |
| `CDC-2` / `CDC-4` | Restart làm **tốn tài nguyên**, hay làm **sai số liệu**? |
| `CDC-3` / `CDC-4` | Sai ở chỗ *ai gọi*, hay ở chỗ *hàm được gọi tính thế nào*? |
| `CDC-3` / `CDC-5` | Bỏ qua vì cột không liên quan, hay vì không có ảnh hiện tại? |
| `CDC-4` / `CDC-6` | Nuốt message có repairable không? Nếu không, gốc nằm ở `CDC-4`. |
| `CDC-5` / `CDC-4` | Số 0 kia đọc từ nguồn, hay suy ra từ sự vắng mặt của event? |
| `CDC-7` / mọi mã khác | Nếu khai sai `groupId` hoặc thiếu một topic, bài test hiện có có đỏ không? |

## Sai lầm lặp lại nhiều nhất

1. Cộng delta của event vào projection vì "một event thì chỉ tới một lần".
2. `groupId` sinh động lúc chạy, rồi ngạc nhiên vì mỗi lần deploy DB lại nghẽn.
3. Khai thiếu một topic có mặt trong câu SQL recompute.
4. Nhét business command (email, notification, trừ tiền) vào `deriveTargets`.
5. Coi tombstone như một entity rỗng rồi ghi cái rỗng đó xuống.
6. Ném lỗi ra khỏi handler, để một dòng bẩn làm đứng cả projection.
7. Viết SQL của projection trong listener, khiến backfill và CDC đi hai đường khác nhau.
8. Gọi thẳng `recomputeTarget` trong test rồi ghi vào biên bản là "CDC đã được chứng minh".
