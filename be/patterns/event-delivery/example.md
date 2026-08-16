---
id: be-patterns-event-delivery-example
title: example.md
slug: /be/patterns/event-delivery/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã DELIVERY-N, viết bằng TypeScript/NestJS thường.
---

# example.md

> Version: `2.00` · Module: `event-delivery` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng có dáng NestJS**. Không dùng tên sản
phẩm, tên repository hay tên module riêng. Một luật chỉ đúng khi nó đúng ở bất kỳ back end nào — vì
vậy nếu một ví dụ cần tên riêng của một hệ thống mới đọc được, ví dụ đó không phù hợp ở đây.

Mỗi mã có **nhiều case**, sau đó là mục **ngoại lệ và nhầm lẫn**. Cuối trang ánh xạ một yêu cầu bằng
lời sang đúng một mã.

---

## `DELIVERY-1` — envelope mang danh tính và digest

### Case: dựng envelope quanh payload

Danh tính lấy từ dịch vụ biết instance này là ai; digest băm từ **nội dung**, nên hai bản sao của
cùng một sự thật băm ra cùng một chuỗi.

```ts
@Injectable()
export class MessageFactoryService {
    constructor(
        private readonly serializer: Serializer,
        private readonly instanceService: InstanceService,
    ) {}

    create<T extends object>({ message, withoutHash = false }: CreateMessageParams<T>): string {
        return this.serializer.stringify({
            data: message,
            digest: withoutHash ? undefined : createHash(message),
            id: this.instanceService.getId(),
        })
    }
}
```

```ts
// SAI: subject là tên event, không phải người phát. Envelope này không cho phía nhận
// trả lời được câu "ai phát ra cái này", và digest theo thời điểm thì hai bản sao của
// cùng một sự thật lại băm ra hai chuỗi khác nhau.
create<T extends object>({ message, subject }: CreateMessageParams<T>): string {
    return this.serializer.stringify({
        data: message,
        digest: createHash(`${subject}:${Date.now()}`),
        id: subject,
    })
}
```

Hai đoạn khác nhau ở chỗ danh tính đến từ **instance** hay từ **tên event**, và digest băm từ **nội
dung** hay từ **thời điểm**.

### Case: phía nhận đọc envelope, không đọc subject

```ts
const parsed = this.messageFactoryService.parse<OrderShippedPayload>(raw)
const producerId = parsed.id
const digest = parsed.digest
```

```ts
// SAI: suy ra người phát từ đường đi. Cùng một subject được mọi instance dùng chung,
// nên biến này luôn bằng nhau ở mọi pod và không phân biệt được ai với ai.
const producerId = subject
```

### Case: digest băm từ payload đã chuẩn hoá

```ts
// Digest phải ổn định qua hai lần tuần tự hoá cùng một sự thật.
const digest = createHash({
    orderId: payload.orderId,
    status: payload.status,
})
```

```ts
// SAI: đưa cả trường thời gian nhận vào digest. Bản giao lại có `receivedAt` khác,
// nên nó băm ra khoá khác và đi lọt qua mọi lớp chống trùng.
const digest = createHash({
    ...payload,
    receivedAt: new Date(),
})
```

### Ngoại lệ và nhầm lẫn

- **Heartbeat được phép không có digest.** Nó không mang sự thật nghiệp vụ nào, và bị bỏ qua trước
  mọi xử lý.

  ```ts
  // ĐÚNG: heartbeat khai rõ ý định bỏ digest, ngay tại nơi phát.
  this.producerService.publish({
      subject: EventName.Ping,
      payload: this.messageFactoryService.create({
          message: { status: "ok" },
          withoutHash: true,
      }),
  })
  ```

  ```ts
  // SAI: một event nghiệp vụ mượn cùng lối tắt đó. Sự thật này gây ra hậu quả,
  // nên bỏ digest là bỏ luôn khoá chống trùng của chính hậu quả ấy.
  this.producerService.publish({
      subject: EventName.OrderShipped,
      payload: this.messageFactoryService.create({
          message: payload,
          withoutHash: true,
      }),
  })
  ```

- **"Broker của chúng ta đảm bảo đúng một lần" không thay được digest.** Câu đó là một cấu hình phải
  chỉ ra được, không phải một niềm tin. Chừng nào chưa chỉ ra được, envelope vẫn phải tự mang khoá.
- **`digest` khai `optional` trong type không có nghĩa là tuỳ chọn trong nghiệp vụ.** Type chỉ đang
  chừa chỗ cho đúng ngoại lệ heartbeat ở trên.

---

## `DELIVERY-2` — transport khai theo event, không chọn ở nơi gọi

### Case: một event cần tới pod khác

```ts
export const configMap = {
    // Mỗi pod giữ những client khác nhau. Phát cả qua broker lẫn local để một lần ghi
    // ở pod A tới được phòng đang cắm vào pod B.
    [EventName.MessageCreated]: {
        useNats: true,
        useLocal: true,
        eventPayload: {} as MessageChangedEventPayload,
    },
}
```

### Case: một event chỉ dành cho worker ở process khác

```ts
// Không có listener nào trong chính process phát ra sự thật này, nên `useLocal` là false
// — và nó vẫn được khai ra chứ không bị bỏ trống.
[EventName.JobStatusUpdated]: {
    useNats: true,
    useLocal: false,
    eventPayload: {} as JobStatusUpdatedEventPayload,
},
```

### Case: một event cố ý còn single-instance

```ts
// Reaction hiện chỉ fan-out trong process. `useNats` sẽ lật thành true khi bridge
// phát lại event này trên mọi pod; điều kiện lật cờ được ghi ngay tại đây.
[EventName.ReactionChanged]: {
    useNats: false,
    useLocal: true,
    eventPayload: {} as ReactionChangedEventPayload,
},
```

```ts
// SAI: thiếu một cờ. Người đọc không biết đây là "cố ý chỉ local" hay "quên khai",
// và hai thứ đó dẫn tới hai hành động sửa hoàn toàn khác nhau.
[EventName.ReactionChanged]: {
    useLocal: true,
    eventPayload: {} as ReactionChangedEventPayload,
},
```

### Case: nơi gọi chỉ nêu sự thật, không nêu đường đi

```ts
await this.eventEmitterService.emit({
    event: EventName.MessageCreated,
    payload: { conversationId, messageId, authorId },
})
```

```ts
// SAI: quyết định triển khai bị lôi vào một handler. Sáu tháng sau, hai nơi gọi cùng
// một event bằng hai transport khác nhau và không ai biết cái nào mới là hợp đồng.
await this.eventEmitterService.emit({
    event: EventName.MessageCreated,
    payload,
    options: { useNats: true, useLocal: false },
})
```

### Ngoại lệ và nhầm lẫn

- **`useNats: false` không phải vi phạm.** Vi phạm là **cờ vắng mặt**. Một sự thật chỉ có người nghe
  trong chính process này thì `false` là câu trả lời đúng.
- **Override ở nơi gọi được giữ lại cho một mục đích hẹp.** Nó tồn tại cho các trường hợp vận hành
  như replay hay công cụ nội bộ, không phải để một handler nghiệp vụ tự chọn transport.
- **Đừng đọc `useLocal: true` thành "chỉ pod này".** Với event có cả hai cờ, mỗi pod khác cũng emit
  local **một lần** sau khi bridge nhận được — đó là fan-out, không phải nhân bản.

---

## `DELIVERY-3` — bỏ envelope của chính mình trước khi emit

### Case: guard đúng, đặt đúng chỗ

```ts
for await (const payload of stream) {
    const { subject, data } = payload
    const parsed = this.messageFactoryService.parse(new TextDecoder().decode(data) || "{}")
    // `subject` gọi tên event; danh tính người phát nằm trong envelope.
    if (parsed.id === this.instanceService.getId()) {
        continue
    }
    this.eventEmitter.emit(getEventName(subject as EventName), parsed.data)
}
```

```ts
// SAI: so subject với id instance. Phép so này không bao giờ khớp, nên nó không lọc
// gì cả và vẫn trông như một guard đang chạy — pod vừa phát sẽ emit local lần thứ hai.
if (subject === this.instanceService.getId()) {
    continue
}
```

### Case: guard đứng trước emit, không đứng sau

```ts
if (parsed.id === this.instanceService.getId()) {
    continue
}
this.eventEmitter.emit(eventName, parsed.data)
```

```ts
// SAI: hậu quả đã xảy ra rồi mới kiểm tra. Câu lệnh sau không rút lại được thông báo
// đã gửi, dòng đã ghi hay khoản đã trừ.
this.eventEmitter.emit(eventName, parsed.data)
if (parsed.id === this.instanceService.getId()) {
    continue
}
```

### Case: nhánh heartbeat nằm sau guard danh tính

```ts
if (parsed.id === this.instanceService.getId()) {
    continue
}
if (subject === EventName.Ping) {
    resetTimeout()
    continue
}
```

```ts
// SAI: đảo hai nhánh thì heartbeat của chính pod này cũng phải đi qua đường xử lý
// nghiệp vụ trước khi bị loại, và guard danh tính không còn là việc đầu tiên xảy ra.
if (subject === EventName.Ping) {
    resetTimeout()
    continue
}
if (parsed.id === this.instanceService.getId()) {
    continue
}
```

### Ngoại lệ và nhầm lẫn

- **Nhầm lẫn hay gặp nhất: tưởng broker không giao lại cho người phát.** Với một subscription thường,
  nó có giao. Guard này tồn tại chính vì điều đó.
- **Không bỏ lần emit local lúc publish.** Nơi phát emit local một lần theo `useLocal`; guard chỉ bỏ
  **envelope quay về** qua broker.

  ```ts
  // SAI: bỏ luôn nhánh local ở nơi phát rồi trông chờ envelope quay về thay thế nó.
  // Nếu broker chậm hoặc mất kết nối, chính pod vừa ghi dữ liệu lại là pod không thấy gì.
  if (useNats) {
      this.producerService.publish({ subject: eventName, payload: serialized })
  }
  ```

- **Id instance phải sống theo process, không theo request.** Một id sinh lại mỗi lần nhận message
  sẽ không bao giờ khớp và guard trở lại thành vô hiệu.

---

## `DELIVERY-4` — giành digest trước khi emit

### Case: đọc, ghi, rồi mới emit

```ts
const cached = await this.cacheService.get({
    key: CacheKey.MessageDigest,
    args: [parsed.digest],
    cacheType: CacheType.Memory,
})
if (cached) {
    continue
}
await this.cacheService.set({
    key: CacheKey.MessageDigest,
    args: [parsed.digest],
    cacheResult: true,
    cacheType: CacheType.Memory,
})
this.eventEmitter.emit(eventName, parsed.data)
```

```ts
// SAI: hai bản giao lại chạy song song đều đọc thấy "chưa có" và cả hai cùng emit,
// vì việc ghi diễn ra sau khi hậu quả đã đi qua ranh giới nghiệp vụ.
this.eventEmitter.emit(eventName, parsed.data)
await this.cacheService.set({
    key: CacheKey.MessageDigest,
    args: [parsed.digest],
    cacheResult: true,
})
```

### Case: chống trùng thuộc về bridge, không thuộc về listener

```ts
// Bridge là chỗ duy nhất biết envelope; mọi listener phía sau chỉ thấy payload.
@OnEvent(EventName.OrderShipped)
async handle(payload: OrderShippedPayload): Promise<void> {
    await this.notifyService.send(payload)
}
```

```ts
// SAI: mỗi listener tự chống trùng. Listener thứ tư sẽ quên, và nó là listener gửi email.
@OnEvent(EventName.OrderShipped)
async handle(payload: OrderShippedPayload): Promise<void> {
    if (this.seen.has(payload.orderId)) {
        return
    }
    this.seen.add(payload.orderId)
    await this.notifyService.send(payload)
}
```

### Case: claim cục bộ trong process, không dùng chung toàn cụm

```ts
// Mỗi instance giữ sổ digest của riêng nó: pod B vẫn phải emit local dù pod C đã emit.
cacheType: CacheType.Memory,
```

```ts
// SAI: dùng store chia sẻ toàn cụm. Instance đầu tiên giành được digest, mọi instance
// còn lại đọc thấy "đã xử lý" và im lặng — fan-out biến mất, và biến mất một cách êm ru.
cacheType: CacheType.Distributed,
```

### Ngoại lệ và nhầm lẫn

- **Sổ digest có hạn dùng.** Nó là cửa sổ chống giao lại, không phải kho lịch sử. Điều đó không nới
  luật: cửa sổ phải phủ được khoảng thời gian broker có thể giao lại.
- **Không có digest thì đây không phải chỗ sửa.** Lỗi khi đó là `DELIVERY-1`; thêm một khoá tự chế ở
  bridge chỉ giấu đi việc envelope đang thiếu thứ nó phải mang.

---

## `DELIVERY-5` — khẳng định người nhận và nội dung

### Case: đúng người nhận, đúng sự thật, và người khác không nhận gì

```ts
const delivered = nextMessage<NotificationSocketMessage>(recipientSocket, PublicationEvent.Notification)
const leaked = neverMessage(bystanderSocket, PublicationEvent.Notification)

await this.trigger()

const message = await delivered
expect(message.data.notification.type).toBe(NotificationType.NewFollower)
expect(message.data.notification.userId).toBe(recipient.id)
await leaked
```

```ts
// SAI: con số này đúng cả khi sự thật được giao cho nhầm người, và sai ngay khi hạ tầng
// thêm một subscriber mà nghiệp vụ không đổi.
expect(gateway.server.listenerCount(PublicationEvent.Notification)).toBe(1)
```

### Case: khẳng định nội dung, không khẳng định số lần

```ts
expect(recipientDeliveries).toEqual([payload])
```

```ts
// SAI: chỉ đếm. Một payload rỗng, một payload của người khác, một payload sai phòng —
// tất cả đều làm assertion này xanh.
expect(recipientDeliveries).toHaveLength(1)
```

### Case: đếm ở transport dùng để **đồng bộ**, không dùng để kết luận

```ts
// Chờ cho cả hai bridge đã tiêu thụ envelope. Chỉ sau đó, khẳng định về phía phát mới
// chứng minh được rằng tiếng vọng đã bị lọc, chứ không phải nó chỉ chưa kịp tới.
await until(() => origin.getBrokerMessageCount() === 1)
await until(() => recipient.getBrokerMessageCount() === 1)

expect(recipientDeliveries).toEqual([payload])
expect(originDeliveries).toEqual([payload])
```

```ts
// SAI: lấy chính con số đồng bộ đó làm kết luận cuối. Nó nói về broker, không nói về
// việc ai đã nhận được sự thật gì.
expect(recipient.getBrokerMessageCount()).toBe(1)
```

### Ngoại lệ và nhầm lẫn

- **Khẳng định phủ định là bắt buộc, không phải trang trí.** "Người ngoài cuộc không nhận được gì" là
  nửa còn lại của tính đúng đắn realtime; thiếu nó thì một broadcast toàn hệ thống vẫn xanh.
- **Đừng khẳng định thứ tự giữa các người nhận.** Thứ tự giữa hai instance là hạ tầng, đúng cùng một
  lý do khiến số listener là hạ tầng.

---

## `DELIVERY-6` — hai instance thật trên broker thật

### Case: hai instance, phát một lần

```ts
beforeAll(async () => {
    origin = await createCrossInstanceApp()
    recipient = await createCrossInstanceApp()
    await Promise.all([origin.untilReady(), recipient.untilReady()])
})

it("giao sự thật từ instance A sang instance B đúng một lần, và A không tự vọng lại", async () => {
    await origin.events.emit({ event: EventName.MessageCreated, payload })

    await until(() => recipientDeliveries.length === 1)
    expect(recipientDeliveries).toEqual([payload])
    expect(originDeliveries).toEqual([payload])
})
```

```ts
// SAI: gọi thẳng emitter local rồi kết luận về fan-out. Envelope chưa từng được dựng,
// broker chưa từng tham gia, guard self-origin chưa từng bị thử.
app.eventEmitter.emit(EventName.MessageCreated, payload)
expect(handler).toHaveBeenCalledWith(payload)
```

### Case: chờ trạng thái, không chờ đồng hồ

```ts
const until = async (predicate: () => boolean): Promise<void> => {
    const deadline = Date.now() + 5_000
    while (!predicate()) {
        if (Date.now() >= deadline) {
            throw new Error("Envelope xuyên instance không tới trước hạn")
        }
        await new Promise<void>(resolve => setImmediate(resolve))
    }
}
```

```ts
// SAI: ngủ một khoảng đoán chừng. Trên máy chậm nó đỏ oan, trên máy nhanh nó xanh
// trước cả khi tiếng vọng của instance phát kịp tới — tức là xanh mà chưa kiểm gì.
await new Promise(resolve => setTimeout(resolve, 300))
expect(recipientDeliveries).toEqual([payload])
```

### Case: thay hạ tầng không phải chủ đề, giữ nguyên đường đi của sự thật

```ts
// Retry chạy một lần: chính sách nối lại không phải chủ đề của flow này.
// Publisher, factory envelope, bridge và broker vẫn là bản production.
providers: [
    { provide: RetryService, useClass: OneShotRetryService },
    { provide: CacheService, useValue: new InProcessDigestCache() },
]
```

```ts
// SAI: mock luôn broker. Không còn giao lại, không còn tiếng vọng, không còn gì
// để guard self-origin phải chặn — test này chứng minh đúng những thứ nó đã giả định.
providers: [
    { provide: BrokerConnection, useValue: { publish: jest.fn(), subscribe: jest.fn() } },
]
```

### Ngoại lệ và nhầm lẫn

- **Phép thử âm bản.** Xoá guard self-origin và chạy lại. Nếu test vẫn xanh, nó chưa chứng minh được
  gì về `DELIVERY-3`, dù nó đã boot đủ hai instance.
- **Một flow transport có thể không có hậu quả trong cơ sở dữ liệu.** Khi đó phải nói rõ nó quan sát
  cái gì thay thế; không nói được nghĩa là flow chưa xong, không phải được miễn.

---

## Ánh xạ yêu cầu sang một mã

Nêu sự thật, phạm vi cần tới và hậu quả cục bộ. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu
cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Phát tin nhắn mới cho mọi pod" | Sự thật rời process ⇒ envelope phải khai người phát và digest | `DELIVERY-1` | Dựng envelope qua factory, digest băm từ payload |
| "Event này có cần qua broker không?" | Câu trả lời thuộc về định nghĩa event | `DELIVERY-2` | Khai đủ `useLocal` và `useNats` trong config chung |
| "Người gửi thấy tin nhắn của mình hai lần" | Envelope quay về chính pod phát | `DELIVERY-3` | So `parsed.id` với id instance, trước khi emit |
| "Consumer nối lại xong thì thông báo nhân đôi" | Broker giao lại, digest bị ghi muộn | `DELIVERY-4` | Đọc và ghi digest trước emit |
| "Viết test cho thông báo realtime" | Đúng đắn là ai nhận được gì | `DELIVERY-5` | Khẳng định người nhận, nội dung, và người ngoài cuộc không nhận |
| "Chứng minh chat chạy được khi scale hai pod" | Mệnh đề cần chứng minh không tồn tại trong một process | `DELIVERY-6` | Boot hai instance trên broker thật, phát một lần |
| "Thêm heartbeat giữ kết nối" | Không mang sự thật nghiệp vụ ⇒ ngoại lệ đã đóng của `DELIVERY-1` | `DELIVERY-1` | `withoutHash: true`, vẫn mang id người phát |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `DELIVERY-1` / `DELIVERY-3` | Envelope **có** danh tính người phát chưa, hay đã có mà **dùng sai lúc**? |
| `DELIVERY-1` / `DELIVERY-4` | Digest chưa được sinh ra, hay đã có mà giành sai chỗ? |
| `DELIVERY-2` / `DELIVERY-6` | Đang thiếu **lời khai** transport, hay thiếu **bằng chứng** cho lời khai đó? |
| `DELIVERY-3` / `DELIVERY-4` | Bản sao đến từ **chính pod này**, hay từ **broker giao lại**? |
| `DELIVERY-5` / `DELIVERY-6` | Vấn đề nằm ở **assert cái gì**, hay ở **chạy trên mấy instance**? |

## Sai lầm lặp lại nhiều nhất

1. So `subject` với id instance — một guard không bao giờ khớp nên không bao giờ báo lỗi.
2. Ghi digest **sau** khi emit, rồi gọi đó là chống trùng.
3. Thiếu một cờ trong config và để người đọc đoán xem đó là chủ ý hay là quên.
4. Chọn transport ở nơi gọi cho "trường hợp đặc biệt này thôi".
5. Đếm listener hoặc đếm message thay vì khẳng định ai nhận được gì.
6. Mock broker rồi kết luận về fan-out xuyên instance.
7. Dùng store chia sẻ toàn cụm cho digest, làm chính fan-out biến mất một cách êm ru.
8. Đưa thời điểm nhận vào digest, khiến bản giao lại băm ra khoá khác.
9. Ngủ một khoảng đoán chừng thay vì chờ trạng thái có hạn chót.
