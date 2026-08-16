---
id: fe-patterns-comments-example
title: example.md
slug: /fe/patterns/comments/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã COMMENTS-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `comments` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Không component library, không design system riêng, không tên
sản phẩm. Chỗ nào luật chạm tới một component riêng, ví dụ gọi **vai trò** của nó — *leaf reaction*,
*bộ từ vựng icon* — chứ không gọi tên định danh của nó trong một codebase.

Mỗi mã có **nhiều case**, mỗi case đặt **SAI** và **ĐÚNG** cạnh nhau, rồi tới mục **ngoại lệ và nhầm
lẫn**. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một mã duy nhất.

---

## `COMMENTS-1` — mọi export mở đầu bằng một khối tài liệu

### Case: một hook được export

**SAI** — người gọi phải mở thân hook mới biết `null` nghĩa là gì.

```tsx
export const useInvoiceTotal = (invoiceId: string) => {
  const { data } = useInvoice(invoiceId)
  if (!data) return null
  return data.lines.reduce((sum, line) => sum + line.amount, 0)
}
```

**ĐÚNG** — khối nói người nhận kết quả phải làm gì với nó.

```tsx
/**
 * Total of an invoice, summed from its lines rather than read from a stored field.
 *
 * Returns null while the invoice has not arrived. A caller that gets null must render the pending
 * shape, never a zero: a total of nothing and a total nobody has fetched are different facts, and a
 * zero on screen is a claim about money.
 */
export const useInvoiceTotal = (invoiceId: string) => {
  const { data } = useInvoice(invoiceId)
  if (!data) return null
  return data.lines.reduce((sum, line) => sum + line.amount, 0)
}
```

### Case: khối chép lại chữ ký

**SAI** — mọi dòng trong khối này đã có sẵn trong chữ ký, và sẽ lạc hậu ngay khi chữ ký đổi.

```tsx
/**
 * Formats a date.
 *
 * @param value - The value.
 * @param locale - The locale.
 * @returns The formatted date.
 */
export const formatDate = (value: Date, locale: string) => new Intl.DateTimeFormat(locale).format(value)
```

**ĐÚNG** — khối nói thứ chữ ký không nói được: cái bẫy khi dùng nó.

```tsx
/**
 * Render a date the way the viewer's region writes it.
 *
 * The locale comes from the request, not from the machine running this code, so a server render and
 * a client render agree. Formatting on the client alone puts the server's region on screen for one
 * frame and then swaps it, which reads as a bug on every slow connection.
 */
export const formatDate = (value: Date, locale: string) => new Intl.DateTimeFormat(locale).format(value)
```

### Case: component được export

**SAI**

```tsx
export const OrderRow = ({ order }: OrderRowProps) => (
  <li className="flex items-center justify-between p-4">
    <span>{order.reference}</span>
    <span className="tabular-nums">{order.total}</span>
  </li>
)
```

**ĐÚNG**

```tsx
/**
 * One row of an order list: the reference a customer quotes, and what it cost.
 *
 * Renders an `li` and nothing around it, so the list that owns the rhythm stays the list's decision.
 * A component that wrapped itself in its own list would force every caller to fight it.
 */
export const OrderRow = ({ order }: OrderRowProps) => (
  <li className="flex items-center justify-between p-4">
    <span>{order.reference}</span>
    <span className="tabular-nums">{order.total}</span>
  </li>
)
```

### Case: type công khai

**SAI**

```tsx
export interface OrderRowProps {
  order: Order
  onSelect?: (id: string) => void
}
```

**ĐÚNG**

```tsx
/**
 * What a row needs to render one order, and the one thing it may report back.
 *
 * `onSelect` is optional because the same row appears inside a printed summary, where nothing is
 * selectable. A required handler would have forced that caller to pass a function that does nothing.
 */
export interface OrderRowProps {
  order: Order
  onSelect?: (id: string) => void
}
```

### Case: ranh giới phạm vi — helper nội bộ

**ĐÚNG** — helper không export thì không bắt buộc khối. Chỉ export mới có hợp đồng.

```tsx
const toMinorUnits = (amount: number) => Math.round(amount * 100)

/**
 * Send one payment attempt, in the unit the gateway settles in.
 *
 * Everything above this line works in the display unit. Converting here, once, is why no caller has
 * to remember which unit it is holding - the mistake this prevents is silent and costs a factor of
 * one hundred.
 */
export const submitPayment = (amount: number) => gateway.charge(toMinorUnits(amount))
```

**SAI** — nghi thức trên từng helper. File đầy khối, và khối thật sự quan trọng chìm mất.

```tsx
/** Converts to minor units. */
const toMinorUnits = (amount: number) => Math.round(amount * 100)

/** Checks if positive. */
const isPositive = (amount: number) => amount > 0

/** Rounds the amount. */
const round = (amount: number) => Math.round(amount)
```

### Ngoại lệ và nhầm lẫn

- **Re-export không có khai báo để tài liệu hoá.** Hợp đồng nằm ở chỗ khai báo gốc.

  ```tsx
  export { OrderRow } from "./OrderRow"
  export type { OrderRowProps } from "./OrderRow"
  ```

- **Line comment không phải là khối tài liệu.** Nó không được công cụ đọc, và nó không nằm trong hợp
  đồng.

  ```tsx
  // one row of an order list
  export const OrderRow = ({ order }: OrderRowProps) => <li>{order.reference}</li>
  ```

- **Export mặc định vô danh vẫn là một hợp đồng**, kể cả khi rule không với tới nó — xem
  [`audit.md`](./audit.md).

  ```tsx
  /**
   * The route segment for a single order.
   *
   * Reads the id from params rather than from a store, so a deep link renders the right order
   * before any client state exists.
   */
  export default function OrderPage({ params }: { params: { id: string } }) {
    return <OrderDetail id={params.id} />
  }
  ```

---

## `COMMENTS-2` — source viết bằng tiếng Anh, theo chuẩn người lạ

### Case: comment giải thích quy tắc nghiệp vụ

**SAI**

```tsx
// hạn cuối đã qua thì không cho sửa nữa
const isLocked = (dueAt: Date) => dueAt < new Date()
```

**ĐÚNG**

```tsx
// Past the due date the record is what an auditor will read, so edits stop here rather than at the
// form: a form-only guard leaves the mutation open to anything that calls it directly.
const isLocked = (dueAt: Date) => dueAt < new Date()
```

### Case: câu văn dời xuống một dòng, thành cái tên

**SAI** — dời chỗ không phải là dịch. Đây chính là chỗ một luật "chỉ soi comment" bỏ sót.

```tsx
const kiemTraQuaHan = (dueAt: Date) => dueAt < new Date()
const danhSachDonHang = orders.filter(kiemTraQuaHan)
```

**ĐÚNG**

```tsx
const isOverdue = (dueAt: Date) => dueAt < new Date()
const overdueOrders = orders.filter((order) => isOverdue(order.dueAt))
```

### Case: thông báo lỗi

**SAI** — người đọc câu này là người đang trực, không phải người đã viết nó.

```tsx
if (!response.ok) throw new Error("Không gọi được API đơn hàng")
```

**ĐÚNG**

```tsx
if (!response.ok) throw new Error(`Order request failed with ${response.status}`)
```

### Case: chữ trong JSX và trong template

**SAI** — văn xuôi hiển thị viết cứng trong component, bằng ngôn ngữ thứ hai.

```tsx
export const EmptyOrders = () => (
  <p className="text-sm text-neutral-500">Bạn chưa có đơn hàng nào</p>
)
```

**ĐÚNG** — văn xuôi hiển thị đi qua từ điển locale; component không tự viết chữ.

```tsx
export const EmptyOrders = () => {
  const t = useTranslations("orders")
  return <p className="text-sm text-neutral-500">{t("empty")}</p>
}
```

### Case: key của object cấu hình

**SAI**

```tsx
const trangThai = {
  choXuLy: "pending",
  daGiao: "delivered",
}
```

**ĐÚNG** — tên là tiếng Anh; **giá trị** là thứ hệ thống bên ngoài quy định và không do ta đặt.

```tsx
const ORDER_STATUS = {
  pending: "pending",
  delivered: "delivered",
} as const
```

### Ngoại lệ và nhầm lẫn

- **Tiếng Anh mà vô nghĩa vẫn là vi phạm `COMMENTS-5`**, không phải một dòng hợp lệ.

  ```tsx
  // set the flag
  const flag = true
  ```

- **Comment dài không thay được một cái tên đúng.** Nếu phải giải thích cái tên, hãy đổi cái tên.

  ```tsx
  // this is the list of orders that are past their due date
  const list2 = orders.filter((order) => order.dueAt < new Date())
  ```

  ```tsx
  const overdueOrders = orders.filter((order) => order.dueAt < new Date())
  ```

---

## `COMMENTS-3` — ba ngoại lệ, mỗi ngoại lệ tự nói ra ở chỗ nó áp dụng

### Case: nội dung locale — từ điển CHÍNH LÀ ngôn ngữ kia

**ĐÚNG** — file từ điển. Bắt nó theo `COMMENTS-2` thì sản phẩm không còn ngôn ngữ nào để phục vụ.

```tsx
export const orders = {
  empty: "Bạn chưa có đơn hàng nào",
  overdue: "Đơn hàng quá hạn",
}
```

### Case: fixture tái tạo một chuỗi có thật

**ĐÚNG** — dịch fixture đi là đang test một thứ khác với thứ hệ thống thật gửi về.

```tsx
export const cancelledOrderResponse = {
  id: "ord_8412",
  status: "Đã huỷ",
  updatedAt: "2026-08-16T09:12:00Z",
}
```

### Case: literal chức năng — dấu là toàn bộ ý nghĩa của ngoại lệ

**SAI** — không phân biệt được với một comment ai đó quên dịch.

```tsx
const CANCELLED = "Đã huỷ"
```

**ĐÚNG** — dấu nằm trên chính dòng của nó và mang lý do.

```tsx
// vn-ok: the gateway sends this status verbatim and the screen matches on it
const CANCELLED = "Đã huỷ"
```

### Case: đánh dấu ở cuối dòng — chỗ người ta thật sự viết

**ĐÚNG**

```tsx
const PARTNER_LEGAL_NAME = "Công ty Cổ phần Vận chuyển" // vn-ok: printed on the invoice exactly as registered
```

### Case: dấu rỗng

**SAI** — rule cho qua, nhưng người đọc tiếp theo vẫn không biết vì sao chuỗi này ở lại. Cái dấu tồn
tại để **chấm dứt** một lần suy đoán, và một dấu rỗng thì không chấm dứt gì cả.

```tsx
// vn-ok:
const CANCELLED = "Đã huỷ"
```

**ĐÚNG**

```tsx
// vn-ok: the gateway sends this status verbatim; translating it breaks the equality check below
const CANCELLED = "Đã huỷ"
```

### Ngoại lệ và nhầm lẫn

- **Không có ngoại lệ thứ tư.** Nếu một chuỗi không nằm trong ba trường hợp trên, nó là văn xuôi.

  ```tsx
  // vn-ok: mọi người trong đội đều đọc được mà
  const HINT = "Nhập mã đơn hàng"
  ```

- **Chuỗi hiển thị không phải literal chức năng.** Nó thuộc về từ điển locale, kể cả khi hôm nay chỉ
  có một ngôn ngữ.

  ```tsx
  const HINT = "Nhập mã đơn hàng"
  ```

  ```tsx
  const hint = t("orders.searchHint")
  ```

---

## `COMMENTS-4` — không có emoji Unicode trong source

### Case: pictograph trong JSX

**SAI**

```tsx
export const SavedBadge = () => <span className="text-sm">✅ Saved</span>
```

**ĐÚNG** — ký hiệu giao diện chung đến từ bộ từ vựng icon, nơi hình vẽ được kiểm và có nhãn.

```tsx
export const SavedBadge = () => (
  <span className="inline-flex items-center gap-2 text-sm">
    <Icon aria-hidden name="check" />
    Saved
  </span>
)
```

### Case: pictograph trong log và thông báo

**SAI** — dòng này sẽ đi vào một terminal không chờ đợi nó, và một hệ thống gom log sắp xếp nó theo
cách không ai đoán được.

```tsx
console.info("🚀 payment worker started")
```

**ĐÚNG**

```tsx
console.info("payment worker started")
```

### Case: cặp regional-indicator

**SAI** — một lá cờ là **hai** ký tự ghép lại, nên phép thử một-pictograph bỏ sót nó; và một lá cờ
mang nghĩa chính trị không giống nhau ở hai quốc gia.

```tsx
const LANGUAGE_OPTIONS = [{ code: "vi", label: "🇻🇳 Tiếng Việt" }]
```

**ĐÚNG** — endonym là thứ bộ chọn ngôn ngữ buộc phải hiển thị đúng chữ của chính nó; lá cờ thì không
phải, vì ngôn ngữ không thuộc về một quốc gia.

```tsx
const LANGUAGE_OPTIONS = [{ code: "vi", label: "Tiếng Việt" }]
```

### Case: reaction của sản phẩm

**SAI** — pictograph render khác nhau trên mọi nền tảng, nên hai người bấm cùng một reaction nhìn thấy
hai hình khác nhau.

```tsx
export const ReactionBar = () => (
  <div className="flex items-center gap-2">
    <button type="button">👍</button>
    <button type="button">🎉</button>
  </div>
)
```

**ĐÚNG** — artwork SVG đã check-in, có ghi nguồn, đi qua leaf chuyên trách reaction.

```tsx
export const ReactionBar = ({ reactions }: ReactionBarProps) => (
  <div className="flex items-center gap-2">
    {reactions.map((reaction) => (
      <ReactionLeaf key={reaction.key} count={reaction.count} reaction={reaction.key} />
    ))}
  </div>
)
```

### Ngoại lệ và nhầm lẫn

- **Pictograph trong tên biến vẫn là vi phạm**, dù trông như một trò đùa vô hại: nó làm gãy grep, gãy
  sắp xếp, và gãy mọi công cụ đọc định danh.

  ```tsx
  const 🎯target = 42
  ```

- **File nội dung được rule miễn, nhưng luật không miễn.** Một pictograph trong từ điển locale vẫn
  render khác nhau trên mọi máy của người dùng — xem [`audit.md`](./audit.md).

  ```tsx
  export const orders = { done: "Hoàn tất 🎉" }
  ```

---

## `COMMENTS-5` — comment chép lại dòng bên dưới thì xoá

### Case: restatement kinh điển

**SAI**

```tsx
// increment the counter
counter += 1
```

**ĐÚNG** — xoá. Dòng code đã nói đủ.

```tsx
counter += 1
```

### Case: cùng chỗ đó, nhưng có thứ đáng nói

**SAI** — comment nói cơ chế, thứ đã hiển nhiên.

```tsx
// get the next step
const next = STEPS[index + 1]
```

**ĐÚNG** — comment nói cái bẫy, thứ không hiển nhiên.

```tsx
// The steps are not evenly spaced, so adding one lands between rungs rather than on the next one.
const next = STEPS[index + 1]
```

### Case: viết lại một restatement không cứu được nó

**SAI** — câu chữ hay hơn, chi phí y hệt: người đọc vẫn phải đọc hết mới biết nó không nói gì.

```tsx
// This handler is invoked whenever the user activates the submit control.
const onSubmit = () => save(values)
```

**ĐÚNG**

```tsx
const onSubmit = () => save(values)
```

### Case: khối tài liệu cũng bị `COMMENTS-5` soi

**SAI** — có khối, nên `COMMENTS-1` im lặng; nhưng khối này chỉ đọc lại chữ ký.

```tsx
/**
 * Gets the order by id.
 *
 * @param id - The id of the order.
 */
export const getOrder = (id: string) => api.get(`/orders/${id}`)
```

**ĐÚNG**

```tsx
/**
 * Fetch one order, without the line items.
 *
 * The lines are a separate request because an order with two thousand lines is not rare in this
 * product, and the list screen that calls this never shows them.
 */
export const getOrder = (id: string) => api.get(`/orders/${id}`)
```

### Ngoại lệ và nhầm lẫn

- **Comment phân đoạn trong một file đã có cấu trúc là restatement dạng khác.** Nó mô tả thứ mà thứ
  tự khai báo đã nói.

  ```tsx
  // ----- helpers -----
  const toMinorUnits = (amount: number) => Math.round(amount * 100)
  ```

- **`@param` chỉ đáng viết khi nó nói thêm điều gì đó.**

  ```tsx
  /**
   * @param retries - How many times to retry.
   */
  ```

  ```tsx
  /**
   * @param retries - Anything above three has never helped here: the failures this sees are quota
   *   rejections, which do not clear inside a request.
   */
  ```

---

## `COMMENTS-6` — comment phải tranh luận thì nêu tên quyết định

### Case: một hình dạng lạ, không có lý do

**SAI** — người refactor tiếp theo sẽ gộp hai lời gọi này thành `Promise.all`, và làm hỏng thứ họ
không nhìn thấy.

```tsx
const profile = await loadProfile(userId)
const settings = await loadSettings(userId)
```

**ĐÚNG** — nêu tên hình dạng hiển nhiên, và nêu nó hỏng ở đâu.

```tsx
// Sequential, not Promise.all: the settings request needs the tenant the profile response carries,
// and running both together sends the settings call to the default tenant. That failure is silent -
// it returns a valid object, just somebody else's.
const profile = await loadProfile(userId)
const settings = await loadSettings(userId)
```

### Case: số ma thuật

**SAI**

```tsx
const CHUNK_SIZE = 47
```

**ĐÚNG** — có nguồn gốc, có điều kiện hết hiệu lực.

```tsx
// 47, not 50: the upstream endpoint rejects a batch whose serialized body passes 64 KB, and 50 rows
// of the widest record shape lands just above it. Raise this only after the body limit changes.
const CHUNK_SIZE = 47
```

### Case: comment tranh luận nhưng không nêu tên quyết định

**SAI** — người đọc biết có chuyện, nhưng không biết chuyện gì, nên vẫn không dám sửa và cũng không
dám giữ.

```tsx
// careful here, this is tricky and it broke before
useEffect(() => {
  syncScrollPosition()
}, [])
```

**ĐÚNG**

```tsx
// Runs once on mount, deliberately without the scroll dependency: adding it re-runs the sync on
// every scroll frame, which fights the user's own scrolling and reads as the page grabbing back.
// The stale value this closes over is only the initial offset, which is what we want restored.
useEffect(() => {
  syncScrollPosition()
}, [])
```

### Case: ghi lại một lần từ chối trong quá khứ

**ĐÚNG** — đây là loại comment đáng giá nhất, vì nó là thứ duy nhất ngăn một vòng lặp sửa-rồi-hoàn-tác.

```tsx
/**
 * Formats money as a string here rather than returning a number.
 *
 * A number was tried and rolled back: every call site formatted it again, three of them chose a
 * different rounding, and two invoices disagreed with each other by a cent for a week. Rounding
 * happens once, here, and the type prevents a caller from doing it a second time.
 */
export const formatMoney = (amount: number, currency: string) => intlFormat(amount, currency)
```

### Ngoại lệ và nhầm lẫn

- **Không phải mọi thứ lạ đều là quyết định.** Nếu code lạ vì viết vội, hãy sửa code, đừng viết comment
  bảo vệ nó.
- **Một comment `COMMENTS-6` bị bỏ sai chỗ thì không cứu được ai.** Nó phải nằm ở đúng dòng mà người
  refactor sẽ chạm vào, không phải ở đầu file.

  ```tsx
  /**
   * Note: some calls in this file are intentionally sequential.
   */
  ```

- **Khi quyết định hết hiệu lực, comment phải chết theo.** Một lý do đã sai là chỉ dẫn sai, tệ hơn
  không có gì.

---

## Ánh xạ yêu cầu sang một mã

Nêu vị trí chữ nghĩa, đường dẫn file, và thứ dòng đó khẳng định. Nếu thiếu **một** dữ kiện quyết
định, hỏi **một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm một hook mới và export nó ra | Hợp đồng bị đọc bởi người không mở thân hàm | `COMMENTS-1` | Khối tài liệu nói vai trò và ý nghĩa của giá trị trả về |
| Ghi chú vì sao chỗ này khoá không cho sửa | Chữ nghĩa trong file authoring | `COMMENTS-2` | Comment tiếng Anh, theo chuẩn người lạ |
| Đặt tên biến theo đúng từ nghiệp vụ nội địa | Dời câu văn sang cái tên không phải là dịch | `COMMENTS-2` | Tên tiếng Anh |
| Giữ nguyên chuỗi trạng thái server gửi về | Giá trị chương trình khớp vào, không phải văn xuôi | `COMMENTS-3` | Giữ, kèm `vn-ok: <lý do>` trên dòng của nó |
| Thêm bản dịch mới vào từ điển | Từ điển chính là ngôn ngữ kia | `COMMENTS-3` | Viết bình thường, không cần đánh dấu |
| Cho một dấu tick nhỏ cạnh chữ "Đã lưu" | Ký hiệu giao diện chung | `COMMENTS-4` | Icon từ bộ từ vựng icon |
| Cho người dùng thả reaction | Ý nghĩa sản phẩm là reaction | `COMMENTS-4` | Artwork SVG đã check-in, qua leaf reaction |
| Comment lại cho dễ hiểu chỗ tăng biến đếm | Comment không nói thêm gì so với dòng dưới | `COMMENTS-5` | Xoá comment |
| Giải thích vì sao hai lời gọi này không chạy song song | Có một hình dạng hiển nhiên đã bị từ chối | `COMMENTS-6` | Comment nêu tên hình dạng đó và tình huống hỏng |
| Thêm comment cảnh báo "chỗ này khó, cẩn thận" | Cảnh báo không nêu tên quyết định thì không dùng được | `COMMENTS-6` | Viết lại thành: hình dạng hiển nhiên là gì, hỏng ở đâu |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `COMMENTS-1` / `COMMENTS-5` | Khối này nói thêm điều gì mà chữ ký chưa nói? Nếu không có — nó là restatement |
| `COMMENTS-1` / helper nội bộ | Có file khác phụ thuộc vào cái tên này không? |
| `COMMENTS-2` / `COMMENTS-3` | Dịch chuỗi này sang tiếng Anh thì chương trình có chạy sai không? |
| `COMMENTS-3` ngoại lệ nào | Đây là từ điển, là fixture, hay là một giá trị chương trình khớp vào? |
| `COMMENTS-4` / bộ từ vựng icon | Ký hiệu này là ký hiệu giao diện chung, hay là reaction của sản phẩm? |
| `COMMENTS-5` / `COMMENTS-6` | Xoá dòng comment này thì người đọc mất mát cái gì? |
| `COMMENTS-6` có đủ chưa | Người refactor có biết hình dạng nào bị từ chối, và nó hỏng ở đâu không? |

## Sai lầm lặp lại nhiều nhất

1. Viết khối tài liệu bằng cách chép lại chữ ký, rồi tin rằng `COMMENTS-1` đã xong.
2. Dời câu tiếng Việt từ comment xuống thành tên biến, và tưởng thế là đã xử lý.
3. Giữ một literal chức năng mà **không** đánh dấu, khiến người sau không phân biệt được với văn xuôi
   quên dịch.
4. Đánh dấu `vn-ok:` rỗng, không kèm lý do — dấu tồn tại để chấm dứt suy đoán, dấu rỗng thì không.
5. Dùng emoji cho "thân thiện" trong log, rồi mất buổi chiều vì một terminal không render được.
6. Viết lại một restatement cho hay hơn thay vì xoá nó.
7. Để lại một hình dạng code lạ mà không nêu tên hình dạng đã bị từ chối, rồi bị hoàn tác sau ba tháng.
8. Viết comment `COMMENTS-6` ở đầu file, xa chỗ người refactor thật sự chạm vào.
