# tổ chức sự kiện

## Định nghĩa

Event delivery đưa một sự thật đã được quyết định ở một application instance đến mọi instance cần phản ứng cục bộ. Envelope nhận diện producer và mô tả delivery; event payload mang sự thật. NATS là transport, còn local event emitter vẫn là boundary phân phối trong process.

Câu hỏi quyết định là: **cùng một envelope có thể quay lại producer hoặc đến hai lần mà không tạo ra cùng một local consequence hai lần không?** Một event liên instance chỉ an toàn khi cả hai câu trả lời đều là có.

Invariant của central bridge được giữ bởi [`sources/be/event-delivery.mjs`](../../../sources/be/event-delivery.mjs).

## Quy tắc

** GIAO HÀNG-1 · Mỗi transport envelope đều mang producer identity và notification.**

Producer identity ngăn một instance nhận lại chính phát hành local của mình; notification cung cấp stable idempotency key cho mọi consumer group. Topic name dùng để định tuyến event type, không bao giờ dùng làm producer id.

**DELIVERY-2 · Local publication và NATS được khai báo rõ cho từng event.**

Mỗi event trong `configMap` khai báo `useLocal` và `useNats`. Sự thật cần đến các group khác thì dùng cả hai; event private trong process chỉ dùng local. Transport là phần được khai báo trong event contract, không được suy ra ở call site.

**DELIVERY-3 · Bridge loại bỏ self-origin trước khi emit local.**

Bridge so sánh id của envelope đã parse với `InstanceService.getId()`. So sánh NATS subject với instance id là sai: subject đặt tên event và không bao giờ nhận diện producer.

**DELIVERY-4 · Bridge yêu cầu notification trước khi emit local.**

Duplicate delivery phải được kiểm tra và ghi nhận trước `EventEmitter2.emit`. Ghi nhận sau đó tạo race trong đó hai bản sao đều vượt qua boundary nghiệp vụ.

**DELIVERY-5 · Consumer xác nhận recipient và payload, không xác nhận số listener.**

Độ đúng của realtime nằm ở việc actor nào nhận được sự thật nào. Số listener là plumbing detail và thay đổi khi topology hoặc socket thay đổi.

**DELIVERY-6 · Hành vi multi-instance được chứng minh bằng hai application instance thật.**

E2E mở client trên các instance riêng, publish một lần và chứng minh remote delivery mà không self-echo. Mock NATS hoặc gọi local emitter không thể thiết lập contract này.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| So sánh NATS subject với instance id | Subject xác định event type, không xác định producer | So sánh producer id trong envelope đã parse |
| Deduplicate sau khi emit local | Hai bản sao đồng thời đều có thể tạo consequence | Require/check notification trước khi emit |
| Bỏ qua `useLocal` hoặc `useNats` trong event config | Deployment behavior trở thành lựa chọn ngầm tại call site | Khai báo cả hai cờ cho mọi event |
| Assert số message | Pod và listener topology trở thành một phần của business correctness | Assert recipient và payload |
| Kiểm thử multi-instance bằng một instance | Nó không phát hiện self-echo hoặc remote-delivery failure | Khởi động hai instance với NATS thật |

## Ví dụ

### Từ chối self-origin

```ts
if (parsed.id === this.instanceService.getId()) continue
this.eventEmitter.emit(getEventName(subject), parsed.data)
```

```ts
// Wrong: subject is an event name, so this comparison never filters the producer.
if (subject === this.instanceService.getId()) continue
```

Chúng khác nhau ở việc producer identity có được lấy từ envelope hay không.

### Ghi nhận trước khi emit

```ts
if (await this.cacheService.get({ key, args: [parsed.digest] })) continue
await this.cacheService.set({ key, args: [parsed.digest], cacheResult: true })
this.eventEmitter.emit(eventName, parsed.data)
```

```ts
// Wrong: both redeliveries can emit before either records the digest.
this.eventEmitter.emit(eventName, parsed.data)
await this.cacheService.set({ key, args: [parsed.digest], cacheResult: true })
```

Chúng khác nhau ở việc deduplication có bảo vệ consequence hay không.

### Chứng minh topology

```ts
await podA.publish(message)
expect(await podBClient.nextMessage()).toMatchObject(message.data)
await expectNoMessage(podAClient, message.event)
```

```ts
// Wrong: this proves only the local emitter.
podA.eventEmitter.emit(message.event, message.data)
```

Chúng khác nhau ở việc NATS và instance identity có thực sự tham gia hay không.
