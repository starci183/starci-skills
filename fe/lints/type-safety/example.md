---
id: fe-lints-type-safety-example
title: example.md
slug: /fe/lints/type-safety/example
sidebar_label: example.md
sidebar_position: 2
description: Mã nổ rule, mã không nổ rule, và mã lọt qua rule mà vẫn sai.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `type-safety` · Luật: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã nguồn thường. Không thư viện thành phần, không kho đăng ký, không tên sản
phẩm. Một rule chỉ đáng tin khi nó đúng ở bất kỳ mã nguồn nào.

Mỗi trường hợp có một cặp **SAI** (rule nổ) và **ĐÚNG** (rule im). Cuối mục là **Cửa lách và nhầm
lẫn**: mã ở đó **lọt qua rule mà vẫn sai**, và nó được ghi ra chính vì thế — không phải vì nó được
phép.

Mặc định của mọi ví dụ: tệp nằm trên đường dẫn có `/src/` và không có đuôi kiểm thử.

---

## `no-double-cast`

### Trường hợp: dữ liệu vừa từ ngoài chương trình đi vào

Đây là chỗ rule tồn tại vì nó.

```ts
// SAI — rule nổ: trình biên dịch biết hình dạng của phần thân trả về, và dòng này bảo nó quên
const response = await fetch(url)
const row = (await response.json()) as unknown as ProfileRow
```

```ts
// ĐÚNG — mở rộng ra `unknown` một cách công khai, rồi thu hẹp bằng một phép kiểm mà máy đi theo được
const response = await fetch(url)
const payload: unknown = await response.json()
if (!isProfileRow(payload)) throw new InvalidPayloadError()
const row = payload // ở đây trình biên dịch đã biết `payload` là gì
```

Hai đoạn khác nhau đúng một thứ: còn có gì kiểm rằng phần thân đúng là thứ nó tự nhận hay không.

### Trường hợp: cast một tầng vẫn hợp lệ

```ts
// SAI — cặp hai tầng, dù đích đến trông rất hợp lý
const config = raw as unknown as Config
```

```ts
// ĐÚNG — một tầng: hai kiểu vẫn phải có phần chung, nên đây là một khẳng định còn kiểm được một phần
const config = raw as Config
```

Rule cố ý dừng ở ranh giới này. Cấm luôn cast một tầng sẽ biến nó từ một đường biên thành một cuộc
tranh cãi.

### Trường hợp: mở rộng sang riêng `unknown`

```ts
// ĐÚNG — đây chính là hình dạng luật đang đòi, không phải thứ nó cấm
const loose = value as unknown
```

```ts
// SAI — câu nói dối bắt đầu ở vế thứ hai, không phải vế thứ nhất
const typed = value as unknown as Session
```

### Trường hợp: cast nằm trong tham số của một lời gọi

```ts
// SAI — vị trí trong biểu thức không giấu được nút; visitor thăm nút chứ không thăm câu lệnh
send(queue, message as unknown as Envelope)
```

```ts
// ĐÚNG — sửa hình dạng ở nơi tạo ra nó, thay vì bịt miệng ở nơi dùng
const envelope = toEnvelope(message)
send(queue, envelope)
```

### Trường hợp: cast trong thuộc tính của thẻ

```tsx
// SAI — vẫn là cùng một nút, đặt trong một biểu thức chèn
<Table rows={data as unknown as Array<ProfileRow>} />
```

```tsx
// ĐÚNG — phân tích một lần, ở biên, rồi mọi nơi khác dùng giá trị đã có hình dạng
const rows = parseProfileRows(data)
return <Table rows={rows} />
```

### Trường hợp: gom vào hằng số **không** rửa được rule này

Ở nhiều rule khác, gom giá trị vào một hằng rồi dùng lại là cách nó biến mất. Ở rule này thì không:
nút vi phạm đi theo giá trị vào phần khởi tạo của hằng và bị thăm y như cũ.

```ts
// SAI — rule vẫn nổ, ngay tại dòng khai báo hằng
const SEED_ROW = fixture as unknown as ProfileRow
export const seed = () => insert(SEED_ROW)
```

```ts
// ĐÚNG — hằng mang một giá trị đã có hình dạng thật, dựng từ một hàm dựng có kiểu
const SEED_ROW: ProfileRow = buildProfileRow({ id: "seed" })
export const seed = () => insert(SEED_ROW)
```

### Trường hợp: mảng và object literal cũng không rửa được

```ts
// SAI — cả hai nút đều nổ, mỗi nút một báo cáo
const rows = [first as unknown as ProfileRow, second as unknown as ProfileRow]
```

```ts
// ĐÚNG — một hàm phân tích trả về đúng kiểu, gọi ở nơi giá trị đi vào
const rows = [first, second].map(parseProfileRow)
```

```ts
// SAI — nằm trong một thuộc tính của object cũng vẫn là một vị trí biểu thức bình thường
const state = { current: draft as unknown as Session, dirty: false }
```

```ts
// ĐÚNG
const state = { current: toSession(draft), dirty: false }
```

### Trường hợp: chuỗi ba tầng không mua được sự im lặng

```ts
// SAI — vế ngoài cùng không nổ (chú thích của nó là `Draft`, không phải `unknown`),
// nhưng vế GIỮA thì nổ, vì toán hạng của nó lại cast sang `unknown`
const session = raw as unknown as Draft as Session
```

```ts
// ĐÚNG
const draft: unknown = raw
if (!isDraft(draft)) return null
const session = toSession(draft)
```

### Trường hợp: ngoặc đơn không cứu được

```ts
// SAI — dấu ngoặc không sinh ra nút nào trong cây cú pháp, nên hai phép cast vẫn là cha con trực tiếp
const row = (payload as unknown) as ProfileRow
```

```ts
// ĐÚNG
const row = parseProfileRow(payload)
```

### Trường hợp: tệp kiểm thử được miễn, và vì sao

Chứng minh một API đóng **từ chối** dữ liệu sai thì phải dựng được dữ liệu sai, mà không có cách nào
dựng một giá trị mà kiểu cấm nếu không bảo trình biên dịch quên kiểu đi.

```ts
// bearer.test.ts — ĐÚNG: cổng tệp loại tệp này ra, rule không tồn tại ở đây
it("từ chối một thao tác dị dạng", () => {
  const malformed = { headers: null } as unknown as Operation
  expect(() => link.execute(malformed)).toThrow()
})
```

```ts
// bearer.ts — SAI: cùng một cách viết, trong một tệp mà việc của nó không phải dựng giá trị sai
export const execute = (input: RawOperation) => run(input as unknown as Operation)
```

Hai đoạn khác nhau đúng một thứ: dựng một giá trị sai có phải **việc** của tệp đó hay không.

### Chỗ lách và chỗ dễ nhầm

Mọi đoạn dưới đây **lọt qua rule**. Không đoạn nào trong số này là cách viết được phép — chúng là
thứ rule **không thấy**, và biết một cửa còn mở thì đỡ nguy hiểm hơn nhiều so với tưởng rằng nó đã
đóng.

**Cách viết ngoặc nhọn** — cùng một phép xoá, khác loại nút:

```ts
// LỌT (và vẫn sai) — `TSTypeAssertion`, rule không thăm loại nút này
const row = <ProfileRow><unknown>payload
```

**Đổi từ khoá ở giữa** — vế trong phải đúng là từ khoá `unknown`:

```ts
// LỌT (và vẫn sai) — ba dòng, ba mức xoá y hệt nhau
const a = payload as any as ProfileRow
const b = payload as never as ProfileRow
const c = payload as {} as ProfileRow
```

**Đặt tên khác cho từ khoá** — vế trong thành tham chiếu kiểu:

```ts
// LỌT (và vẫn sai) — trông còn gọn hơn thứ nó thay thế, đó mới là chỗ nguy hiểm
type Loose = unknown
const row = payload as Loose as ProfileRow
```

**Chèn một nút vào giữa** — rule khớp quan hệ kề nhau:

```ts
// LỌT (và vẫn sai) — một ký tự phá vỡ cặp cha con
const row = (payload as unknown)! as ProfileRow
```

**Tách thành hai câu lệnh** — cửa sắc nhất trên tầng này:

```ts
// LỌT (và vẫn sai) — không có cast hai tầng nào, mà phép xoá thì nguyên vẹn,
// vì giữa hai dòng KHÔNG có phép kiểm nào cả
const loose: unknown = payload
const row = loose as ProfileRow
```

So sánh với bản đúng — khác nhau ở đúng ba dòng ở giữa, và rule không đòi ba dòng ấy:

```ts
// ĐÚNG — cùng hình dạng cú pháp với đoạn trên, khác ở chỗ có một phép kiểm
const loose: unknown = payload
if (!isProfileRow(loose)) throw new InvalidPayloadError()
const row = loose
```

**Một hàm generic** — rửa sạch cả cây, và trông như một tiện ích:

```ts
// LỌT — bên trong chỉ có MỘT cast, hoàn toàn hợp lệ với rule
export const coerce = <T,>(value: unknown): T => value as T
```

```ts
// LỌT (và vẫn sai) — mọi nơi gọi sạch bong, không còn cast nào để nhìn
const row = coerce<ProfileRow>(payload)
const session = coerce<Session>(raw)
```

**Từ khoá nằm sâu một tầng trong kiểu**:

```ts
// LỌT (và vẫn sai) — chú thích vế trong là một tham chiếu kiểu CÓ THAM SỐ là từ khoá,
// rule chỉ đọc nút trên cùng
const rows = payload as Array<unknown> as Array<ProfileRow>
const config = payload as Record<string, unknown> as Config
```

**Xoá mà không có cast nào để nhìn**:

```ts
// LỌT (và vẫn sai) — hàm phân tích trả về dạng viết tắt, gán thẳng vào hình dạng đã khai báo,
// không có nút cú pháp nào để báo
const row: ProfileRow = JSON.parse(text)
```

**Tên tệp, dùng để thoát**:

```ts
// LỌT — cùng một dòng, chỉ đổi tên tệp từ `mapper.ts` thành `mapper.spec.ts`
// Miễn trừ là một hậu tố, và đổi tên tệp là thứ rẻ nhất trong một kho mã
const row = payload as unknown as ProfileRow
```

**Tên tệp, dùng để báo oan** — cùng một dòng lệnh, chiều ngược lại:

```ts
// BÁO OAN — `fixtures.ts` dựng giá trị sai có chủ đích, đúng như tệp kiểm thử,
// nhưng đuôi tên không nằm trong bốn đuôi được nhận, nên rule vẫn nổ
export const malformed = { headers: null } as unknown as Operation
```

**Ngoài `/src/`**:

```ts
// LỌT — tệp ở thư mục cấu hình hoặc script dựng: cổng không cho rule tồn tại ở đó,
// và giá trị đã xoá kiểu vẫn được export ra dưới một cái tên trông lương thiện
export const settings = raw as unknown as Config
```

---

## Ánh xạ yêu cầu sang một phán quyết của máy

| Mã trong tệp được lint | Máy thấy gì | Phán quyết |
|---|---|---|
| `value as Target` | Một `TSAsExpression`, toán hạng không phải cast | Im |
| `value as unknown` | Một `TSAsExpression` sang từ khoá, không có vế ngoài | Im |
| `value as unknown as Target` | Vế ngoài có toán hạng là cast sang từ khoá | **Nổ**, tại vế ngoài |
| `(value as unknown) as Target` | Ngoặc không sinh nút; vẫn là cha con trực tiếp | **Nổ** |
| `value as unknown as A as B` | Vế ngoài im, vế giữa khớp | **Nổ**, tại vế giữa |
| `value as any as Target` | Vế trong là từ khoá khác | Im — uỷ thác cho rule của bộ plugin TypeScript |
| `<Target><unknown>value` | `TSTypeAssertion`, không phải loại nút được thăm | Im — cửa còn mở |
| `(value as unknown)! as Target` | Có một nút chen giữa | Im — cửa còn mở |
| `const l: unknown = v` rồi `l as Target` | Hai câu lệnh, mỗi câu một cast đơn | Im — cửa còn mở |
| Cùng một dòng, trong `*.test.ts` | Cổng tệp hỏng, visitor không được cài | Im — miễn trừ theo luật |
| Cùng một dòng, ngoài `/src/` | Cổng tệp hỏng | Im — ngoài phạm vi |
| Cùng một dòng, trong `fixtures.ts` dưới `/src/` | Cổng tệp qua | **Nổ** — báo oan đã biết |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| Cast một tầng / cast hai tầng | Trình biên dịch còn kiểm được phần nào của khẳng định này không? Còn thì là thu hẹp; không còn gì thì là xoá. |
| Xoá / mở rộng | Dòng này nói "tôi chưa biết đây là gì", hay nói "đây chắc chắn là `Đích`" mà không kiểm gì? |
| Rule im vì hợp lệ / rule im vì mù | Cách viết ấy có nằm trong bảng cửa còn mở không? Nếu có, im **không** phải là một lời chứng nhận. |
| Miễn trừ / lọt lưới | Dựng một giá trị sai có phải **việc** của tệp này không? Nếu phải mà tên tệp không nói ra được, đó là báo oan; nếu không phải mà tên tệp vẫn được miễn, đó là một lỗ. |
| Rule này / rule được uỷ thác | Vế trong là từ khoá `unknown` hay dạng viết tắt? Từ khoá thì thuộc rule này; dạng viết tắt thuộc bộ plugin TypeScript, với comment tắt rule riêng của nó. |

## Sai lầm lặp lại nhiều nhất

1. Đọc "rule im" thành "cách viết này đã được duyệt". Rule im ở tám hình dạng khác nhau mà bảy trong
   số đó vẫn xoá kiểu.
2. Sửa báo cáo bằng cách đổi `as unknown as` thành `as any as`. Đó là đổi rule đang canh mình, không
   phải sửa lỗi.
3. Tách phép xoá thành hai câu lệnh rồi coi là đã thu hẹp, trong khi không có phép kiểm nào ở giữa.
4. Viết một hàm `coerce` generic để "cho gọn", rồi phát hiện sáu tháng sau rằng không còn nút cú
   pháp nào để đếm.
5. Đặt tên tệp thành `.spec.ts` cho một tệp không phải kiểm thử.
6. Chờ một bản vá tự động. Không có, và không thể có: mọi bản sửa thật đều phải chọn cho giá trị một
   hình dạng.
7. Tưởng rằng gom cast vào một hằng số sẽ giấu được nó. Ở rule này thì không — nhưng phản xạ ấy đến
   từ những rule khác, nơi nó **có** tác dụng.
