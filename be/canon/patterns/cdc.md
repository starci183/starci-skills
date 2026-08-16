# cdc

## Định nghĩa

CDC biến các source row đã commit thành những read projection được tính lại. Projection listener không phát lại business command và cũng không áp dụng delta lần thứ hai; nó chuyển một thay đổi trong database thành identity ổn định của projection, rồi dựng lại projection từ source truth.

Câu hỏi quyết định là: **xử lý cùng một thay đổi row hai lần có tạo ra cùng một projection không?** Nếu không, đó không phải CDC projection.

Hình dạng listener có thể kiểm tra bằng máy nằm trong [`sources/be/cdc.mjs`](../../../sources/be/cdc.mjs).

## Quy tắc

**CDC-1 · Shared listener sở hữu vòng đời Kafka.**

Mọi `*projection.listener.ts` cụ thể đều kế thừa `AbstractProjectionListener`. Connection, subscription, parsing Debezium envelope và isolation khi lỗi phải nằm trong base, vì một listener tự quản lý consumer sẽ sớm bất đồng về offset hoặc tombstone.

**CDC-2 · Listener khai báo group ổn định và topic rõ ràng.**

`groupId` là identity bền vững của projection consumer, còn `topics` là toàn bộ source set có thể làm projection mất hiệu lực. Không giá trị nào được tạo theo từng process. Group ngẫu nhiên sẽ replay history sau mỗi lần boot; topic ngầm định sẽ âm thầm để projection stale.

**CDC-3 · Listener ánh xạ change sang target; service tính lại target.**

`deriveTargets` đọc row đã thay đổi và trả về các projection identity. `recomputeTarget` ủy quyền cho projection service. Listener sở hữu việc định tuyến, không sở hữu chính sách SQL, để replay và repair trực tiếp cùng đi qua một đường recompute.

**CDC-4 · Recompute là idempotent và bắt nguồn từ source.**

Projection được dựng lại bằng UPSERT từ các row authoritative. Không bao giờ cập nhật projection bằng cách cộng delta trong event, vì delivery trùng lặp sẽ nhân đôi kết quả còn event bị mất thì không thể tự hồi phục.

**CDC-5 · Tombstone không được bịa ra current state.**

Debezium payload không có `after` image thì không có current row để ánh xạ. Shared listener bỏ qua payload đó; projection cần repair khi xóa phải suy ra target từ một source khác còn lưu, hoặc dùng deletion stream được thiết kế riêng.

**CDC-6 · Một message lỗi không được dừng consumer.**

Lỗi parsing hoặc recompute phải được log cùng topic và consumer group, rồi cô lập ở message đó. Recompute idempotent là điều cho phép một source change sau này sửa lại cùng target.

**CDC-7 · Delivery semantics phải được chứng minh với broker thật.**

Operational E2E publish qua Redpanda/Kafka rồi chờ database projection. Gọi trực tiếp `deriveTargets`, `recomputeTarget` hoặc method của listener chỉ chứng minh mapping code, không chứng minh CDC.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Projection listener có consumer `onModuleInit` riêng | Nó tách subscription, parsing và failure semantics thành một nhánh khác | Kế thừa `AbstractProjectionListener` |
| Consumer group ngẫu nhiên hoặc chỉ tồn tại theo instance | Mỗi lần restart trở thành consumer mới và replay history | Khai báo `groupId` ổn định, riêng cho projection |
| Tăng projection bằng event delta | Delivery trùng lặp sẽ đếm hai lần và delivery bị mất không thể tự sửa | Tính lại từ source row và UPSERT |
| Đặt business command trong `deriveTargets` | CDC replay sẽ lặp lại business side effect | Chỉ trả về projection identity |
| Coi tombstone là entity rỗng | Nó bịa ra current row không tồn tại | Bỏ qua hoặc consume source dành riêng cho deletion |
| Gọi thẳng listener trong E2E | Nó loại bỏ serialization của broker và hành vi consumer group | Publish qua broker thật rồi poll projection |

## Ví dụ

### Tính lại từ source truth

```ts
protected async recomputeTarget(target: UserCourseTarget): Promise<void> {
    await this.projectionService.recompute(target)
}
```

```ts
// Wrong: a duplicate CDC delivery adds the same points twice.
protected async recomputeTarget(target: UserCourseTarget): Promise<void> {
    await this.projectionService.increment(target.userId, target.pointsDelta)
}
```

Chúng khác nhau ở việc replay có làm thay đổi kết quả hay không.

### Giữ vòng đời trong base

```ts
export class UserXpProjectionListener extends AbstractProjectionListener<UserTarget> {
    protected readonly groupId = "projection-user-xp"
    protected readonly topics = ["primary.public.activities"]
}
```

```ts
// Wrong: this projection now owns a private Kafka lifecycle.
export class UserXpProjectionListener implements OnModuleInit {
    async onModuleInit(): Promise<void> { await this.consumer.run({ eachMessage: this.handle }) }
}
```

Chúng khác nhau ở việc mọi projection có dùng chung một delivery contract hay không.

### Chứng minh delivery qua broker

```ts
await world.cdc.publish(activityRow)
await until(() => world.db.userXp(userId).then((xp) => xp === expectedXp))
```

```ts
// Wrong: no serialization, group, offset or broker delivery is exercised.
await listener.recomputeTarget({ userId })
```

Chúng khác nhau ở việc CDC thật có được kiểm thử hay không.
