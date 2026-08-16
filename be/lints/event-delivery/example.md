---
id: be-lints-event-delivery-example
title: example.md
slug: /be/lints/event-delivery/example
sidebar_label: example.md
sidebar_position: 2
description: Mã nổ luật, mã không nổ luật, và mã lọt qua luật — từng trường hợp một.
---

# example.md

> Version: `2.00` · Mô-đun: `event-delivery` · Luật máy: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây nằm trong đúng một tệp — tệp mà cổng tên tệp nhận:

```text
/src/modules/platform/event/nats/nats-bridge.service.ts
```

Không tên sản phẩm, không tên kho mã, không tên thư viện. Các định danh mà biểu thức chính quy đóng
cứng — `parsed`, `this.instanceService.getId()`, `this.eventEmitter.emit` — được chép nguyên văn, vì
chúng là **chuỗi mà luật máy thật sự tìm**.

Luật máy có **nhiều cặp** **SAI** (luật nổ) và **ĐÚNG** (luật im), rồi tới mục **Cửa lách và nhầm
lẫn**. Xin đọc kỹ mục cuối đó: mã trong mục ấy là mã luật máy **không bắt được**, chứ **không** phải
mã được cho phép. Nó vẫn sai theo luật; chỉ là cổng không nhìn thấy nó.

---

## `nats-bridge-delivery-contract`

### Trường hợp: không có gì chặn cả

```ts
// SAI — nổ cả `origin` lẫn `digest`
for await (const message of subscription) {
    const parsed = this.codec.decode(message.data)
    this.eventEmitter.emit(getEventName(message.subject), parsed.data)
}
```

Không có phép so danh tính nơi sinh, không có chuỗi `parsed.digest`. Cả hai vị trí đều là `-1`, cả
hai điều kiện đều đúng, và cả hai thông điệp cùng báo lên đầu tệp.

```ts
// ĐÚNG — cả hai vị trí đều nhỏ hơn vị trí lời gọi phát sự kiện
for await (const message of subscription) {
    const parsed = this.codec.decode(message.data)
    if (parsed.id === this.instanceService.getId()) continue
    if (await this.cacheService.get({ key: DIGEST_KEY, args: [parsed.digest] })) continue
    await this.cacheService.set({ key: DIGEST_KEY, args: [parsed.digest], cacheResult: true })
    this.eventEmitter.emit(getEventName(message.subject), parsed.data)
}
```

### Trường hợp: chặn đúng, nhưng viết sau chỗ phát

```ts
// SAI — nổ `origin`: originIndex > emitIndex
for await (const message of subscription) {
    const parsed = this.codec.decode(message.data)
    this.eventEmitter.emit(getEventName(message.subject), parsed.data)
    if (parsed.id === this.instanceService.getId()) continue
}
```

```ts
// ĐÚNG — cùng hai câu lệnh, đảo lại thứ tự
for await (const message of subscription) {
    const parsed = this.codec.decode(message.data)
    if (parsed.id === this.instanceService.getId()) continue
    this.eventEmitter.emit(getEventName(message.subject), parsed.data)
}
```

Thứ tự là một nửa phép kiểm. Có mặt mà đứng sau thì bị báo đúng bằng không có mặt.

### Trường hợp: đảo chiều điều kiện — chặn nhầm đúng chỗ nguy hiểm nhất

```ts
// SAI — nổ `origin`: `!==` không khớp biểu thức chính quy
for await (const message of subscription) {
    const parsed = this.codec.decode(message.data)
    if (parsed.id !== this.instanceService.getId()) continue
    this.eventEmitter.emit(getEventName(message.subject), parsed.data)
}
```

Đoạn này bỏ đi **mọi** phong bì trừ chính bản vọng về mình — tức là đảo ngược hẳn ý định. Luật máy
bắt được, nhưng bắt được vì nó đọc thành "không có phép so nào", chứ không phải vì nó hiểu chiều của
điều kiện.

```ts
// ĐÚNG
if (parsed.id === this.instanceService.getId()) continue
this.eventEmitter.emit(getEventName(message.subject), parsed.data)
```

### Trường hợp: ghi dấu vân tay sau khi đã phát

```ts
// SAI — nổ `digest`: digestIndex > emitIndex
this.eventEmitter.emit(getEventName(message.subject), parsed.data)
await this.cacheService.set({ key: DIGEST_KEY, args: [parsed.digest], cacheResult: true })
```

```ts
// ĐÚNG
if (await this.cacheService.get({ key: DIGEST_KEY, args: [parsed.digest] })) continue
await this.cacheService.set({ key: DIGEST_KEY, args: [parsed.digest], cacheResult: true })
this.eventEmitter.emit(getEventName(message.subject), parsed.data)
```

### Trường hợp: gom giá trị vào một hằng số — ở đây làm luật máy **to tiếng hơn**

```ts
// SAI — nổ `origin`: biểu thức chính quy đòi đúng `this.instanceService.getId()` ngay trong phép so
const selfId = this.instanceService.getId()
for await (const message of subscription) {
    const parsed = this.codec.decode(message.data)
    if (parsed.id === selfId) continue
    this.eventEmitter.emit(getEventName(message.subject), parsed.data)
}
```

```ts
// ĐÚNG — viết thẳng lời gọi vào phép so
if (parsed.id === this.instanceService.getId()) continue
```

Ở phần lớn luật máy khớp chuỗi, gom vào hằng số là cách quen thuộc nhất để **lách**. Ở luật máy này
thì ngược lại: gom vào hằng số làm nó **nổ**. Đây là báo thừa, và cách chữa đúng nằm ở biểu thức
chính quy, không nằm ở đoạn mã đang đúng.

### Trường hợp: đặt tên khác cho bộ phát sự kiện

```ts
// SAI — nổ CẢ HAI: emitIndex = -1, nên hai điều kiện đều đúng
const bus = this.eventEmitter
bus.emit(getEventName(message.subject), parsed.data)
```

```ts
// ĐÚNG
this.eventEmitter.emit(getEventName(message.subject), parsed.data)
```

Đổi tên không mua được sự im lặng: mất chuỗi `this.eventEmitter.emit` thì luật máy báo **hai** lỗi
chứ không phải không lỗi nào.

### Trường hợp: đảo hai vế của phép so

```ts
// SAI — nổ `origin`, dù đoạn mã này đúng nghĩa hệt bản ĐÚNG ở trên
if (this.instanceService.getId() === parsed.id) continue
this.eventEmitter.emit(getEventName(message.subject), parsed.data)
```

```ts
// ĐÚNG — chỉ vì thứ tự hai vế
if (parsed.id === this.instanceService.getId()) continue
this.eventEmitter.emit(getEventName(message.subject), parsed.data)
```

Biểu thức chính quy đóng cứng thứ tự hai vế. Đây là báo thừa rõ rệt nhất của luật máy, và nó dạy
người viết một cách viết chứ không dạy một điều luật.

### Trường hợp: xoá hẳn lời gọi phát sự kiện

```ts
// SAI — nổ CẢ HAI, dù tệp này không thể vi phạm điều gì
for await (const message of subscription) {
    const parsed = this.codec.decode(message.data)
    if (parsed.id === this.instanceService.getId()) continue
    await this.localFanOut.publish(parsed)
}
```

Không còn chuỗi `this.eventEmitter.emit` nào, nên `emitIndex` bằng `-1` và cả hai điều kiện đúng.
Nguyên nhân thật là "tệp không phát cục bộ nữa", còn câu thông điệp thì nói về thứ tự. Người đọc nhận
được một câu trả lời sai cho một câu hỏi đúng.

### Cửa lách và nhầm lẫn

Toàn bộ mã dưới đây **luật máy không bắt được**. Nó vẫn sai theo luật.

- **Phép so có mà không chặn** — cửa nặng nhất mô-đun.

  ```ts
  // LỌT — luật máy im, và mọi bản vọng về chính mình đều được phát
  if (parsed.id === this.instanceService.getId()) {
      this.logger.debug("bản vọng về chính mình")
  }
  await this.cacheService.get({ key: DIGEST_KEY, args: [parsed.digest] })
  this.eventEmitter.emit(getEventName(message.subject), parsed.data)
  ```

  Luật máy chứng minh phép so **tồn tại**, không bao giờ chứng minh nó **bỏ qua**. Thiếu `continue`
  là thiếu toàn bộ điều luật, và văn bản vẫn khớp.

- **Chú thích rửa sạch cả hai chuỗi.**

  ```ts
  // LỌT — hai dòng chú thích này đứng đầu tệp và làm cả hai vị trí trở nên nhỏ
  // Trước đây bản đồ chặn nằm ở đây:
  //   if (parsed.id === this.instanceService.getId()) continue
  //   await cache.get(parsed.digest)
  for await (const message of subscription) {
      const parsed = this.codec.decode(message.data)
      this.eventEmitter.emit(getEventName(message.subject), parsed.data)
  }
  ```

  Vị trí ký tự không mang theo xuất xứ. Một dòng chú thích, một chuỗi ký tự, một khối đã tắt và một
  phương thức chết đều là bằng chứng ngang nhau đối với cổng này.

- **Đọc dấu vân tay mà không bao giờ ghi** — đúng cuộc đua mà điều luật sinh ra để đóng.

  ```ts
  // LỌT — không có lần ghi nào, nên hai bản sao cùng trượt bộ nhớ đệm và cùng phát
  if (parsed.id === this.instanceService.getId()) continue
  if (await this.cacheService.get({ key: DIGEST_KEY, args: [parsed.digest] })) continue
  this.eventEmitter.emit(getEventName(message.subject), parsed.data)
  ```

- **Lời gọi phát sự kiện thứ hai trở đi không được so với gì cả.**

  ```ts
  // LỌT — chỉ lời gọi đầu tiên được đo; lời gọi thứ hai không chặn gì
  if (parsed.id === this.instanceService.getId()) continue
  await this.cacheService.set({ key: DIGEST_KEY, args: [parsed.digest], cacheResult: true })
  this.eventEmitter.emit(getEventName(message.subject), parsed.data)

  for await (const retry of this.retryQueue) {
      this.eventEmitter.emit(getEventName(retry.subject), retry.data)
  }
  ```

- **Thứ tự trên trang không phải thứ tự lúc chạy** — chiều lọt.

  ```ts
  // LỌT — phép so nằm trên, nhưng nó chạy ở một nhánh khác và không hề chặn vòng lặp này
  private isSelfEcho(parsed: Envelope): boolean {
      return parsed.id === this.instanceService.getId()
  }

  private async fanOut(parsed: Envelope, subject: string): Promise<void> {
      await this.cacheService.get({ key: DIGEST_KEY, args: [parsed.digest] })
      this.eventEmitter.emit(getEventName(subject), parsed.data)
  }
  ```

  Không ai gọi `isSelfEcho`. Cổng vẫn im, vì nó chỉ hỏi câu lệnh ấy **nằm ở đâu trên trang**.

- **Đổi tên tệp là tắt luật.**

  ```text
  LỌT — bộ thăm rỗng, không một dòng nào bị đọc
  /src/modules/platform/event/nats/nats-bridge.ts
  /src/modules/platform/event/bridge/nats-bridge.service.ts
  /src/modules/platform/event/nats/nats-bridge.consumer.ts
  ```

  Trong nhật ký dựng, bộ thăm rỗng trông y hệt một tệp sạch.

- **Cây cầu thứ hai không phải cây cầu.**

  ```text
  LỌT — luật quản mọi cây cầu xuyên bản chạy, cổng gọi tên đúng một đường dẫn
  /src/modules/platform/event/nats/nats-bridge-v2.service.ts
  /src/modules/platform/event/kafka/kafka-bridge.service.ts
  /apps/worker/src/modules/platform/event/bus/bridge.service.ts
  ```

- **Dời phần phát sự kiện sang tệp cộng tác, giữ lại một lời gọi đủ thoả chuỗi.**

  ```ts
  // LỌT — tệp cầu vẫn có đủ ba chuỗi theo đúng thứ tự
  if (parsed.id === this.instanceService.getId()) continue
  await this.cacheService.set({ key: DIGEST_KEY, args: [parsed.digest], cacheResult: true })
  this.eventEmitter.emit(READY_EVENT, undefined)

  await this.fanOutService.deliver(parsed, message.subject)
  ```

  Lời gọi phát sự kiện thật nằm trong `fanOutService`, ở một tệp mà cổng không bao giờ mở. Luật máy
  đọc một tệp và không giải lệnh nhập nào.

- **`parsed.digest` khớp theo kiểu chuỗi con.**

  ```ts
  // LỌT — không có ranh giới từ, không có kiểu nút
  this.logger.debug(`nhận lúc ${parsed.digestedAt}`)
  this.eventEmitter.emit(getEventName(message.subject), parsed.data)
  ```

  ```ts
  // LỌT — một chuỗi ký tự cũng đủ
  this.metrics.increment("parsed.digest.missing")
  this.eventEmitter.emit(getEventName(message.subject), parsed.data)
  ```

- **Không gì kiểm rằng `parsed` là phong bì, hay `getId()` trả về danh tính bản chạy.**

  ```ts
  // LỌT — một đối tượng giả thoả cả hai phép kiểm
  const parsed = { id: "unknown", digest: "" }
  if (parsed.id === this.instanceService.getId()) continue
  this.eventEmitter.emit(getEventName(message.subject), raw)
  ```

  ```ts
  // LỌT — chủ đề bị dùng làm danh tính, đúng cách viết sai mà điều luật gọi tên đích danh
  const parsed = { id: message.subject, digest: message.subject }
  if (parsed.id === this.instanceService.getId()) continue
  this.eventEmitter.emit(getEventName(message.subject), payload)
  ```

- **Một dòng tắt luật mở lại mọi cửa đã đóng.**

  ```ts
  /* eslint-disable starci-be/nats-bridge-delivery-contract */
  this.eventEmitter.emit(getEventName(message.subject), parsed.data)
  ```

---

## Ánh xạ yêu cầu sang một luật máy

| Yêu cầu bằng lời | Luật máy giữ nó | Ghi chú |
|---|---|---|
| "Cây cầu phải bỏ phong bì do chính bản chạy này sinh ra" | `nats-bridge-delivery-contract`, thông điệp `origin` | Chỉ kiểm **có viết phép so** và **viết trước chỗ phát** |
| "Phải nhận dấu vân tay trước khi phát cục bộ" | `nats-bridge-delivery-contract`, thông điệp `digest` | Chỉ kiểm **có nhắc tới `parsed.digest`** trước chỗ phát |
| "Phong bì phải mang danh tính nơi sinh và dấu vân tay" (`DELIVERY-1`) | **Không có luật máy** | Phía sinh phong bì hoàn toàn không được đọc |
| "Mỗi sự kiện phải khai `useLocal` và `useNats`" (`DELIVERY-2`) | **Không có luật máy** | Bảng cấu hình sự kiện không được mở |
| "Bản kiểm phải khẳng định ai nhận và nhận gì, không đếm số lần gọi" (`DELIVERY-5`) | **Không có luật máy** trong tệp nguồn này | Do người rà soát giữ |
| "Phải chứng minh bằng hai bản chạy thật" (`DELIVERY-6`) | **Không có luật máy** trong tệp nguồn này | Do người rà soát giữ |
| "Đừng so chủ đề với danh tính bản chạy" | **Không có luật máy** | Một đối tượng giả gán `id` bằng chủ đề vẫn qua sạch |
| "Chỉ dùng đúng một cây cầu" | **Không có luật máy** | Cổng nhận đúng một đường dẫn và im lặng với mọi đường dẫn khác |

## Bảng phân định ranh giới

| Phân định | Bên này | Bên kia |
|---|---|---|
| `origin` so với `digest` | Thiếu hoặc đặt sau phép so danh tính nơi sinh | Thiếu hoặc đặt sau chuỗi `parsed.digest` |
| Hai thông điệp | Tính độc lập, có thể cùng nổ trên một tệp | Không thông điệp nào che thông điệp nào |
| "Trước" | Vị trí ký tự nhỏ hơn trong văn bản tệp | **Không** phải chạy trước |
| Chỗ báo | Nút `Program`, tức dòng đầu tệp | **Không bao giờ** là lời gọi phát sự kiện có lỗi |
| Phạm vi | Đúng một hậu tố đường dẫn ba đoạn | Mọi tệp khác: bộ thăm rỗng, im lặng tuyệt đối |
| Bằng chứng | Chuỗi ký tự trong văn bản tệp | **Không** phân biệt câu lệnh sống, chú thích, chuỗi hay mã chết |
| Lời gọi phát sự kiện | Lần xuất hiện đầu tiên | Mọi lần sau: không được đo |
| Không có lời gọi phát sự kiện | Bị coi là vi phạm, nổ cả hai | **Không** phải được miễn |
| Nới lỏng | Chỉ bằng một dòng tắt luật, nhìn thấy được | `schema: []` nên không có tuỳ chọn nào |

## Sai lầm lặp lại nhiều nhất

1. **Đọc "cổng xanh" thành "hợp đồng chuyển phát đã được giữ".** Cổng giữ hai trên sáu điều, và giữ
   hai điều ấy trên đúng một tệp, bằng cách tìm chuỗi. Bốn điều còn lại không có ai giữ.
2. **Tưởng phép so đã chặn.** Cửa nặng nhất mô-đun là một điều kiện không có `continue`. Khi đọc lại
   đoạn mã này, hãy tìm câu lệnh **bỏ qua**, đừng tìm phép so.
3. **Tưởng có nhắc `parsed.digest` là đã khử trùng lặp.** Đọc mà không ghi vẫn qua, và đó chính là
   cuộc đua điều luật sinh ra để đóng.
4. **Sửa đoạn mã đang đúng cho vừa biểu thức chính quy.** Đảo hai vế và gom vào hằng số đều làm luật
   máy nổ, và cả hai đều là **báo thừa**. Cách chữa đúng là mở rộng biểu thức chính quy, không phải
   viết lại đoạn mã theo ý cổng.
5. **Đổi tên tệp trong một lần dọn dẹp.** Đây là cách rẻ nhất để tắt toàn bộ mô-đun, và nó không để
   lại dấu vết nào: một tệp không được kiểm và một tệp sạch in ra giống hệt nhau.
6. **Thêm một lời gọi phát sự kiện thứ hai ở cuối tệp.** Lời gọi ấy vĩnh viễn không được đo, và không
   có thông điệp nào nói cho ai biết điều đó.
