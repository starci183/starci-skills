---
id: fe-patterns-tokens-example
title: example.md
slug: /fe/patterns/tokens/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã TOKEN-N, viết bằng TSX thường và class thường.
---

# example.md

> Version: `2.00` · Module: `tokens` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường với class thường**. Không tên sản phẩm, không component library
riêng. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một ví dụ cần tên riêng của một
sản phẩm mới đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều case**, mỗi case đặt **ĐÚNG** cạnh **SAI**, rồi tới mục **ngoại lệ và nhầm lẫn**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định duy nhất.

---

## `TOKEN-1` — union làm cho giá trị lệch thang không gõ ra được

### Case: bảng từ vựng, viết ra cho thấy nó đóng

```ts
export type LayoutClassName =
    | "flex" | "grid" | "flex-col" | "flex-row" | "items-center"
    | "gap-1" | "gap-2" | "gap-3" | "gap-4" | "gap-6" | "gap-8"
    | "p-0" | "p-4" | "p-6" | "px-4" | "py-3"
```

### Case: một entry hợp lệ và một entry không tồn tại được

```ts
// ĐÚNG — mọi phần tử đều là thành viên
const spec = { classes: ["flex", "flex-col", "gap-4"] } satisfies Entry
```

```ts
// SAI — không biên dịch được. `gap-[15px]` không bị cấm; nó không phải thành viên.
const spec = { classes: ["flex", "flex-col", "gap-[15px]"] } satisfies Entry
```

Hai đoạn khác nhau đúng một chỗ: đoạn dưới **không compile**. Đó là lý do không rule nào cần có ý
kiến về nó.

### Case: mép và ruột phải là một quyết định

```tsx
// ĐÚNG — mép 16px quanh seam 16px: mép thở đúng nhịp của thứ nó chứa
const spec = { classes: ["flex", "flex-col", "gap-4", "p-4"] } satisfies Entry
```

```tsx
// SAI — mép chật hơn ruột. Từng giá trị đều nằm trên thang, tổng thể vẫn đọc ra là chật.
const spec = { classes: ["flex", "flex-col", "gap-4", "px-3", "py-2"] } satisfies Entry
```

Không giá trị nào ở đây sai. Cái sai là **mép và ruột không đồng ý với nhau** — và union không có gì
để nói về chuyện đó, vì cả hai đều là thành viên.

### Case: thang có sáu bậc, và chúng cách nhau không đều

```tsx
<div className="flex flex-col gap-1">   {/* 4px  — dòng dưới bổ nghĩa dòng trên */}
  <strong>Nguyễn Văn An</strong>
  <span className="text-sm text-neutral-500">@an.nguyen</span>
</div>
```

```tsx
<div className="flex flex-col gap-6">   {/* 24px — hai khối của một trang */}
  <section>…</section>
  <section>…</section>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Không có bậc số không.** Muốn không có seam thì **không khai báo class gap**:

  ```tsx
  {/* SAI */}  <ul className="divide-y gap-0">…</ul>
  {/* ĐÚNG */} <ul className="divide-y">…</ul>
  ```

- **Selector theo vị trí được nhận, nhưng chỉ trong entry.** Một joined list phải pad từng row mà
  không pad đường kẻ:

  ```ts
  const spec = {
      classes: ["p-0", "[&>*]:px-4", "[&>*]:py-3", "[&>*:first-child]:pt-4", "[&>*:last-child]:pb-4"],
  } satisfies Entry
  ```

- **Union không cứu được leaf.** Xem `TOKEN-6`.

---

## `TOKEN-2` — thêm thành viên là sửa thang

### Case: thêm đúng chỗ, để diff đọc ra được

```ts
// ĐÚNG — thành viên mới nằm trong danh sách có tên, một dòng diff nhìn thấy được
export type LayoutClassName =
    | "gap-1" | "gap-2" | "gap-3" | "gap-4" | "gap-6" | "gap-8"
    | "p-0" | "p-2" | "p-4" | "p-6"
```

```tsx
// SAI — "thành viên mới" xuất hiện lần đầu bên trong một component không ai đọc kỹ
const CARD = "flex flex-col gap-4 p-5"
```

Hai đoạn khác nhau đúng một chỗ: đoạn dưới **không có ai duyệt một quyết định về nhịp của cả nhà** —
vì không có quyết định nào được trình bày cả.

### Case: hai repo tự mọc hai union rồi cùng sai

```ts
// SAI — cùng một khái niệm, hai cái tên, không cái nào chứa cái kia
export type ContractHost = "div" | "ul" | "li" | "form" | "section"
export type HostTagName  = "div" | "ul" | "ol" | "main" | "section"
```

```ts
// ĐÚNG — gộp tại nguồn, giữ một tên, và mọi nơi lấy về từ đó
export type ContractHost =
    | "div" | "ul" | "ol" | "li" | "form" | "nav" | "main" | "section" | "header" | "footer" | "aside"
```

Một type bị **đổi tên** là một phân kỳ mà **không import nào báo cáo**. Cả hai bên đều xanh, và cả
hai đều thiếu.

### Ngoại lệ và nhầm lẫn

- **Một màn hình trông hơi lệch không phải lý do thêm bậc.** Thang khi đó mô tả **màn hình** chứ
  không còn mô tả **quan hệ**. Hỏi lại: seam này ngăn cách **cấp gộp nhóm** nào?
- **Nửa bậc không bao giờ là ứng viên.** Xem `TOKEN-3`.
- **Không ai giữ hộ mã này.** Union chỉ từ chối được người ngoài; nó không phán được rằng thành viên
  mới đã được cân nhắc.

---

## `TOKEN-3` — nửa bậc nằm ngoài thang

### Case: khoảng cách trong một cụm leaf

```tsx
// ĐÚNG — trên thang
const GLUE = "inline-flex items-center gap-2"
```

```tsx
// SAI — nửa bậc, và luật entry không nhìn vào đây
const GLUE = "inline-flex items-center gap-1.5"
```

Hai đoạn khác nhau đúng một chỗ: **giá trị đó có tồn tại ở bất kỳ chỗ nào khác trong sản phẩm hay
không.**

### Case: kích thước một glyph

```tsx
// ĐÚNG
<svg aria-hidden="true" className="size-4" />
```

```tsx
// SAI — `size-3.5` sinh ra để glyph "vừa mắt" với đúng một dòng chữ
<svg aria-hidden="true" className="size-3.5" />
```

### Case: padding dọc của một control

```tsx
// ĐÚNG
<button className="rounded-md border px-3 py-2 text-sm" type="button">Áp dụng</button>
```

```tsx
// SAI — `py-1.5` là cách một chiều cao control thứ ba ra đời mà không ai đặt tên cho nó
<button className="rounded-md border px-3 py-1.5 text-sm" type="button">Áp dụng</button>
```

### Ngoại lệ và nhầm lẫn

- **Không có ngoại lệ nào.** Đây là mã **chính xác**: không tồn tại trường hợp mà đáp án đúng là một
  nửa của một bậc.
- **`x.5` trong ngoặc vuông là hai mã cùng lúc:**

  ```tsx
  {/* SAI — vừa nửa bậc vừa giá trị tuỳ ý */}
  <div className="p-[6px] gap-[10px]" />
  ```

- **Đừng nhầm với opacity hay z-index.** Mã này nói về các họ **có đo đạc**.

---

## `TOKEN-4` — giá trị tuỳ ý thoát khỏi hệ thống

### Case: một chiều rộng ghim tay

```tsx
// ĐÚNG — thành viên của thang, đi theo thang khi thang đổi
<aside className="w-64 shrink-0">…</aside>
```

```tsx
// SAI — hôm nay bằng đúng `w-64`, ngày mai vẫn đứng yên khi `w-64` đổi nghĩa
<aside className="w-[16rem] shrink-0">…</aside>
```

### Case: một màu lấy từ file thiết kế

```tsx
// ĐÚNG — màu gọi tên theo **ý nghĩa**, nên nó đi theo theme
<span className="text-success">+12%</span>
```

```tsx
// SAI — màu gọi tên theo **chính nó**, nên nó đứng yên trong cái theme mà nó sai
<span className="text-[#16a34a]">+12%</span>
```

### Case: giá trị tuỳ ý trong một chuỗi được ghép

```tsx
// SAI — nằm trong hằng số, nhưng vẫn là cùng một giá trị chọn một lần cho một màn hình
const PANEL = "grid gap-4 max-h-[38rem] overflow-y-auto"
```

```tsx
// ĐÚNG — nếu thật sự cần một chiều cao có tên, đặt tên cho nó trong theme rồi gọi tên đó
const PANEL = "grid gap-4 max-h-panel overflow-y-auto"
```

Lưu ý: đổi sang tên token **chưa xong việc**. Xem `TOKEN-9` — biến `--max-height-panel` phải tồn tại,
nếu không thì vừa đổi một lỗi ồn ào thành một lỗi im lặng.

### Ngoại lệ và nhầm lẫn

- **"Nhưng nó bằng đúng một bậc mà."** Đó chính là lý do nó nguy hiểm: nó **trông** đúng, không ai
  tra thang mà tìm ra nó, và nó không di chuyển khi thang di chuyển.
- **Grid template không phải một độ dài đo đạc:**

  ```tsx
  {/* ĐÚNG — cấu trúc cột là một quyết định layout, không phải một bậc trên thang khoảng cách */}
  <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">…</div>
  ```

- **Màu trong ảnh, icon, canvas nằm ngoài phạm vi.** Mã này nói về **class**.

---

## `TOKEN-5` — thứ bậc đến từ thang chữ

### Case: một tiêu đề

```tsx
// ĐÚNG — component sở hữu **cả thẻ lẫn cỡ**, nên outline và mắt không bao giờ bất đồng
<Heading props={{ content: title, level: 2 }} />
```

```tsx
// SAI — một tiêu đề mà outline không chứa
<span className="text-2xl font-bold">{title}</span>
```

Hai đoạn khác nhau đúng một chỗ: **outline mà screen reader dựng lên có chứa cái tiêu đề này hay
không.**

### Case: số liệu lớn trên một thẻ thống kê

```tsx
// ĐÚNG — số to nhưng **không đậm**: nó là một giá trị, không phải một tiêu đề
<div className="flex flex-col gap-1">
  <span className="text-2xl font-semibold tabular-nums">42</span>
  <span className="text-sm text-neutral-500">bài đã hoàn thành</span>
</div>
```

```tsx
// SAI — to cộng đậm: mắt đọc ra tiêu đề, outline không có gì
<div className="flex flex-col gap-1">
  <span className="text-3xl font-bold">42</span>
  <span className="text-sm text-neutral-500">bài đã hoàn thành</span>
</div>
```

### Case: tiêu đề của một empty state

```tsx
// ĐÚNG
<div className="flex flex-col items-center gap-3 p-6 text-center">
  <Heading props={{ content: "Chưa có khoá học nào", level: 3 }} />
  <p className="text-sm text-neutral-500">Ghi danh một khoá để bắt đầu.</p>
</div>
```

```tsx
// SAI
<div className="flex flex-col items-center gap-3 p-6 text-center">
  <div className="text-xl font-bold">Chưa có khoá học nào</div>
  <p className="text-sm text-neutral-500">Ghi danh một khoá để bắt đầu.</p>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Cả hai class đều hợp lệ.** `text-2xl` và `font-bold` đều là thành viên; cái sai là **ghép chúng
  ở đây**. Union không cứu được mã này.
- **To mà không đậm thì không phải heading**, và ngược lại. Rule chỉ báo khi **cả hai** cùng có mặt.
- **Đổi thẻ không cứu được:**

  ```tsx
  {/* SAI — `h2` đúng thẻ nhưng cỡ vẫn ghép tay, nên ngày thang chữ đổi nó ở lại phía sau */}
  <h2 className="text-2xl font-bold">{title}</h2>
  ```

---

## `TOKEN-6` — rule phải nhìn vào cái thư mục union không thấy

### Case: cùng một giá trị, hai chỗ đứng, hai thứ bắt nó

```ts
// tầng entry — compiler từ chối
const spec = { classes: ["flex", "gap-1.5"] } satisfies Entry
```

```tsx
// tầng leaf — không có union nào ở đây, nên rule phải bắt
const ROW = "flex items-center gap-1.5"
```

### Case: nhấc lên hằng số là che, không phải được phép

```tsx
// SAI — một rule chỉ đi qua thuộc tính JSX sẽ nhìn thẳng qua chỗ này
const ICON = "size-3.5 shrink-0"
export const Mark = () => <svg aria-hidden="true" className={ICON} />
```

```tsx
// ĐÚNG — trên thang, và ở đâu cũng đọc được như nhau
const ICON = "size-4 shrink-0"
export const Mark = () => <svg aria-hidden="true" className={ICON} />
```

### Case: bảng tra class trong leaf vẫn là chuỗi class

```tsx
// mọi giá trị ở đây đều phải chịu `TOKEN-3`, `TOKEN-4`, `TOKEN-5` và `TOKEN-7`
const SIZE_CLASSES = { sm: "size-8 rounded-lg", md: "size-10 rounded-xl" } as const
```

### Ngoại lệ và nhầm lẫn

- **Chỉ đọc source sản phẩm.** File dưới `src/`. Tooling và config không render gì.
- **Chuỗi ghép động thì rule không đọc được:**

  ```tsx
  {/* rule im lặng ở đây — và đó là giới hạn đã biết, không phải giấy phép */}
  const CLS = `gap-${step} p-${inset}`
  ```

- **"Tầng trên đã typed rồi nên khỏi quét"** là cách đúng cái thư mục cần quét nhất bị bỏ qua.

---

## `TOKEN-7` — màu ngữ nghĩa đi theo cặp vai

### Case: dấu trần

```tsx
// ĐÚNG — mực trên nền của trang
<span className="text-sm font-semibold text-success">Đã hoàn thành</span>
```

```tsx
// SAI — token nền dùng làm mực: sai vai, và mất tương phản khi đổi theme
<span className="text-sm font-semibold text-success-soft">Đã hoàn thành</span>
```

### Case: nền mềm

```tsx
// ĐÚNG — nền và mực khai cùng một lúc, như một cặp
<span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm text-success-soft-foreground">
  Đã thanh toán
</span>
```

```tsx
// SAI — có đĩa nhưng mực lấy từ vai khác
<span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm text-success">
  Đã thanh toán
</span>
```

### Case: nền đặc

```tsx
// ĐÚNG
<span className="rounded-md bg-danger px-2 py-1 text-xs text-danger-foreground">Quá hạn</span>
```

```tsx
// SAI — `-soft-foreground` là mực cho đĩa **mềm**, không phải cho đĩa đặc
<span className="rounded-md bg-danger px-2 py-1 text-xs text-danger-soft-foreground">Quá hạn</span>
```

### Case: bảng tông màu khai báo sẵn từng cặp

```tsx
// ĐÚNG — cặp là một dòng, nên không ai lấy được nửa cặp
const TONE_CLASSES = {
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
} as const
```

```tsx
// SAI — hai bảng rời nhau là hai chỗ để bất đồng
const BG = { success: "bg-success-soft", danger: "bg-danger-soft" } as const
const FG = { success: "text-success", danger: "text-danger" } as const
```

### Ngoại lệ và nhầm lẫn

- **Cảnh báo và nguy hiểm theo đúng ba vai đó.** Không có vai thứ tư.
- **Đây không phải `TOKEN-4`.** Mọi token ở đây đều **trong** bảng màu; cái sai là **cặp**.
- **Không có rule nào bắt mã này.** Xem "Rủi ro còn mở" trong [`audit.md`](./audit.md).

---

## `TOKEN-8` — kích cỡ theo vị trí đặt, variant theo mức ưu tiên

### Case: hành động nhúng trong một row

```tsx
// ĐÚNG — nhúng trong một row hoạt động
<Button props={{ label: reactionLabel, variant: "ghost", size: "sm" }} />
```

```tsx
// SAI — cùng vai trò đó, nhưng lấy chiều cao của một hành động đứng riêng
<Button props={{ label: reactionLabel, variant: "ghost", size: "md" }} />
```

### Case: hành động neo một form

```tsx
// ĐÚNG — đứng riêng, chiếm một dòng, neo cả form
<Button props={{ label: submitLabel, variant: "primary", size: "md" }} />
```

```tsx
// SAI — vẫn primary, nhưng lấy chiều cao của một hành động nhúng
<Button props={{ label: submitLabel, variant: "primary", size: "sm" }} />
```

Hai đoạn khác nhau đúng một chỗ: **vị trí đặt**. Cả hai vẫn là primary — mức ưu tiên không tham gia
vào việc chọn chiều cao.

### Case: tertiary vẫn có thể là `md`

```tsx
// ĐÚNG — ưu tiên thấp nhưng đứng riêng, nên vẫn `md`
<div className="flex flex-col gap-3">
  <p className="text-sm text-neutral-500">Không tìm thấy kết quả nào.</p>
  <Button props={{ label: "Xoá bộ lọc", variant: "tertiary", size: "md" }} />
</div>
```

### Case: đừng bóp control bằng padding

```tsx
// SAI — tạo ra một chiều cao thứ ba, cục bộ, nằm ngoài tập đóng
<button className="rounded-md border px-2 py-1 text-xs" type="button">Áp dụng</button>
```

```tsx
// ĐÚNG — đã có sẵn một token cho hành động nhúng
<Button props={{ label: "Áp dụng", variant: "secondary", size: "sm" }} />
```

### Ngoại lệ và nhầm lẫn

- **Độ dài nhãn không đổi token.** Một nút chữ dài vẫn là nút nhúng nếu nó nhúng.
- **Tập kích cỡ đóng ở hai giá trị**, nên `size="lg"` không gõ ra được — nhưng **chọn nhầm một trong
  hai** thì vẫn gõ được, và đó là toàn bộ lý do mã này chỉ ở tầng `documented`.
- **Bóp bằng padding thường kéo theo `TOKEN-3` hoặc `TOKEN-4`**, nhưng mã gốc vẫn là `TOKEN-8`.

---

## `TOKEN-9` — một tên token chưa có nghĩa cho tới khi theme định nghĩa nó

### Case: hai nửa phải cùng đúng

```css
/* nửa thứ nhất: theme giữ lời hứa */
:root {
  --container-app-sm: 40rem;
  --container-app-md: 48rem;
  --container-app-lg: 64rem;
}
```

```tsx
// nửa thứ hai: tên là thành viên union — và biến nó xin đã tồn tại ở trên
<div className="mx-auto flex w-full max-w-app-lg flex-col gap-6 px-6 py-6">…</div>
```

### Case: lỗi im lặng

```tsx
// SAI — union nhận tên này, compiler hài lòng, class được phát ra, và trang mất số đo
<div className="mx-auto flex w-full max-w-app-xxl flex-col gap-6 px-6 py-6">…</div>
```

Không có chỗ nào đỏ. Đây là **giá trị chết duy nhất mà union không bắt được**, và nó tệ hơn một giá
trị lệch thang đúng vì lý do đó: giá trị lệch thang **không compile**, còn cái này qua mọi cổng và
lên production.

### Case: xoá một biến tưởng là không ai dùng

```css
/* SAI — xoá dòng này mà không tìm chỗ dùng thì mọi `min-h-header` im lặng biến mất */
:root {
  --min-height-header: 4rem;
}
```

### Case: những tên do framework tự phân giải

```tsx
// ĐÚNG — `screen` là viewport, không phải một biến. Không hứa gì về theme này.
<div className="min-h-screen">…</div>
```

```tsx
// ĐÚNG — `full`, `fit`, `auto` cũng vậy
<div className="max-h-full overflow-y-auto">…</div>
```

Một rule báo cáo hai dòng trên sẽ đẩy người viết đi định nghĩa `--min-height-screen`, một biến
**không ai đọc**: rule khi đó tự bịa ra việc và làm hỏng một class đang chạy đúng.

### Ngoại lệ và nhầm lẫn

- **Không tìm thấy stylesheet thì im lặng.** Không có bằng chứng thì không có finding.
- **Chỉ những họ suy ra được tên biến mới thuộc phạm vi.** Một class màu hay một bậc khoảng cách còn
  phân giải qua thang của chính framework, nên một rule đoán mò ở đó sẽ báo cả những class đang chạy.
- **Đổi `[38rem]` thành `max-h-panel` chưa xong việc.** Xem `TOKEN-4` — phải định nghĩa biến, nếu
  không thì vừa đổi một lỗi ồn ào thành một lỗi im lặng.

---

## Ánh xạ yêu cầu sang một quyết định

Nêu giá trị, tầng file và vai trò. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi
dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Chỗ này cần thưa hơn một chút, cho `gap-[13px]`" | Không phải thành viên; trong entry thì compiler đã từ chối | `TOKEN-1` | Lấy bậc gần nhất |
| "Cả sản phẩm cần thêm một inset 8px cho surface nhỏ" | Nhu cầu lặp lại, là quyết định về nhịp của nhà | `TOKEN-2` | Thêm thành viên vào danh sách có tên |
| "Icon hơi to, giảm còn `size-3.5`" | Nửa bậc, không nằm giữa hai bậc | `TOKEN-3` | `size-4` hoặc `size-3` |
| "Khớp đúng màu xanh trong file thiết kế" | Màu thô đứng ngoài bảng màu ngữ nghĩa | `TOKEN-4` | Token màu theo ý nghĩa |
| "Cho tiêu đề section này to và đậm lên" | To cộng đậm **là** heading | `TOKEN-5` | Component sở hữu cả thẻ lẫn cỡ |
| "Gom class lặp lại thành một `const` cho gọn" | Hằng số vẫn là chuỗi class | `TOKEN-6` | Giữ nguyên thang; rule vẫn phải đọc được |
| "Dấu tích màu xanh nhạt cho dịu mắt" | `-soft` là vai nền, không phải vai mực | `TOKEN-7` | `text-success`, hoặc ghép đủ cặp |
| "Nút gửi quan trọng nên cho nó cao hơn" | Ưu tiên không chọn chiều cao | `TOKEN-8` | Chọn theo vị trí đặt |
| "Đổi `max-w-[64rem]` thành `max-w-app-lg`" | Đúng một nửa — còn nửa biến | `TOKEN-9` | Đổi tên **và** kiểm biến trong stylesheet |
| "Nút này trong row nhưng nhãn dài, cho `md` nhé" | Độ dài nhãn không đổi token | `TOKEN-8` | `sm` |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TOKEN-1` / `TOKEN-4` | Giá trị này nằm trong entry đã gõ kiểu, hay trong leaf tự viết class? |
| `TOKEN-1` / `TOKEN-2` | Đang hỏi "gõ ra được không", hay hỏi "muốn gõ được thì phải làm gì"? |
| `TOKEN-2` / `TOKEN-3` | Nhu cầu này lặp lại trên nhiều màn hình, hay là nửa bậc cho một màn hình? |
| `TOKEN-3` / `TOKEN-4` | Giá trị có dấu chấm thập phân, hay nằm trong ngoặc vuông? |
| `TOKEN-4` / `TOKEN-7` | Token này đứng **ngoài** bảng màu, hay **trong** bảng màu nhưng sai vai? |
| `TOKEN-4` / `TOKEN-9` | Tên này là một độ dài viết thẳng, hay là một **yêu cầu** gửi tới một biến theme? |
| `TOKEN-5` / `TOKEN-1` | Từng class có hợp lệ không, hay cái sai nằm ở **tổ hợp**? |
| `TOKEN-6` / mọi mã đo đạc | Rule có đọc được chuỗi này khi nó bị nhấc lên hằng số không? |
| `TOKEN-8` / `TOKEN-4` | Chiều cao sai vì chọn nhầm token, hay vì có padding tự chế? |

## Sai lầm lặp lại nhiều nhất

1. Viết một độ dài trong ngoặc vuông vì "nó bằng đúng một bậc thôi mà".
2. Nhấc chuỗi class lên hằng số rồi tưởng như thế là đã dọn dẹp.
3. Ghép chữ to với chữ đậm thành một tiêu đề mà outline không có.
4. Dùng token có đuôi `-soft` làm màu chữ cho một dấu trần.
5. Suy chiều cao nút từ mức ưu tiên hoặc từ độ dài nhãn.
6. Bóp một control bằng padding tự chế thay vì dùng token nhúng.
7. Đổi sang tên token mà quên định nghĩa biến — đổi lỗi ồn ào thành lỗi im lặng.
8. Cho mép chật hơn ruột, dù từng giá trị đều nằm trên thang.
9. Viết `gap-0` thay vì bỏ hẳn class.
10. Tin rằng "tầng trên đã typed rồi" nên khỏi quét tầng leaf.
