---
id: fe-lints-tokens-example
title: example.md
slug: /gates/lints/tokens/example
sidebar_label: example.md
sidebar_position: 2
description: Mã nguồn thật cho từng luật — chỗ luật nổ, chỗ luật im, và chỗ luật nhìn xuyên qua.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `tokens` · Cơ chế: [`INDEX.md`](./INDEX.md) · Giải thích: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây có nhiều cặp **SAI** (luật nổ) và **ĐÚNG** (luật im), rồi tới một mục **Cửa lách và
nhầm lẫn**. Mã trong mục cuối cùng ấy **không phải là mã được phép** — nó là mã luật **không nhìn
thấy**. Chép nó về dùng thì bạn không hợp lệ hơn, bạn chỉ không bị báo.

Mọi ví dụ là mã đánh dấu thường với `className` thường, đặt trong một tệp có `/src/` trong đường dẫn.
Ngoài cổng đó thì không ví dụ nào ở đây nổ cả.

---

## `no-fractional-step`

### Trường hợp: bậc lẻ ngay trên thuộc tính

**SAI**

```tsx
<div className="flex items-center gap-1.5 px-2.5">
  <Icon name="clock" />
  <span>{label}</span>
</div>
```

**ĐÚNG**

```tsx
<div className="flex items-center gap-2 px-3">
  <Icon name="clock" />
  <span>{label}</span>
</div>
```

### Trường hợp: nhấc ra hằng số cũng không giấu được

Đây chính là ca đã sinh ra bộ luật này. Một luật chỉ duyệt thuộc tính JSX sẽ nhìn xuyên qua cả hai
dòng dưới.

**SAI**

```tsx
const GLUE = "inline-flex items-center gap-1.5"
const ROW = "flex items-center justify-between py-1.5"
```

**ĐÚNG**

```tsx
const GLUE = "inline-flex items-center gap-2"
const ROW = "flex items-center justify-between py-2"
```

### Trường hợp: nằm trong mảng của một entry

**SAI**

```ts
export const cardEntry = {
  classes: ["flex", "flex-col", "gap-4", "p-4", "size-3.5"],
}
```

**ĐÚNG**

```ts
export const cardEntry = {
  classes: ["flex", "flex-col", "gap-4", "p-4", "size-4"],
}
```

### Trường hợp: biến thể, dấu quan trọng, giá trị âm — vẫn nổ

Ranh giới từ khớp ngay sau `:`, sau `!` và sau dấu trừ, nên cả ba dòng dưới đều bị báo.

**SAI**

```tsx
<section className="md:p-2.5 !gap-1.5 -mt-1.5" />
```

**ĐÚNG**

```tsx
<section className="md:p-3 !gap-2 -mt-2" />
```

### Chỗ lách và chỗ dễ nhầm

Ba đoạn dưới đây **không bị báo**. Không đoạn nào hợp lệ hơn phần SAI ở trên.

Một biểu thức nội suy duy nhất làm cả chuỗi biến mất khỏi tầm nhìn của luật — kể cả phần chữ tĩnh
đứng ngay đó:

```tsx
<div className={`gap-1.5 ${dense ? "p-2" : "p-3"}`} />
```

Một cấp lồng trong object là đủ: bộ duyệt chỉ mở khoá đúng chữ `classes`, còn `row` thì không:

```tsx
const STYLES = { row: "flex items-center gap-1.5", cell: "py-2.5" }
```

Bốn họ kích thước không có trong danh sách, nên bậc lẻ ở đó đi qua sạch sẽ:

```tsx
<aside className="min-w-3.5 max-w-2.5 min-h-1.5 max-h-1.5" />
```

---

## `no-arbitrary-value`

### Trường hợp: độ dài trong ngoặc vuông

**SAI**

```tsx
<div className="w-[420px] max-w-[62rem] gap-[13px]" />
```

**ĐÚNG**

```tsx
<div className="w-full max-w-app-lg gap-3" />
```

### Trường hợp: màu hex thô

**SAI**

```tsx
<span className="text-[#2563eb] border-[#e5e7eb]">{count}</span>
```

**ĐÚNG**

```tsx
<span className="text-primary border-default">{count}</span>
```

### Trường hợp: một chuỗi, hai thông điệp

Luật chạy hai biểu thức chính quy tách rời trên cùng một nút, nên dòng dưới bị báo **hai lần** —
một lần cho độ dài, một lần cho màu.

**SAI**

```tsx
const PLATE = "max-w-[62rem] bg-[#0b1220] p-4"
```

**ĐÚNG**

```tsx
const PLATE = "max-w-app-lg bg-surface p-4"
```

### Trường hợp: trong entry, và có biến thể

Biểu thức chính quy không neo đầu chuỗi, nên tiền tố biến thể không cứu được gì.

**SAI**

```ts
export const railEntry = {
  classes: ["grid", "lg:max-w-[18rem]", "p-[14px]"],
}
```

**ĐÚNG**

```ts
export const railEntry = {
  classes: ["grid", "lg:max-w-app-sm", "p-4"],
}
```

### Chỗ lách và chỗ dễ nhầm

Tên luật hứa "mọi giá trị tuỳ ý". Ba đoạn dưới **không bị báo**, và cả ba đều là giá trị tuỳ ý.

Sáu họ hay dùng nhất cho ngoặc vuông không có trong danh sách độ dài:

```tsx
<h2 className="text-[28px] tracking-[0.2em] leading-[1.15]">{title}</h2>
<div className="grid grid-cols-[14rem_1fr] duration-[250ms] aspect-[4/3]" />
```

Màu không viết bằng hex thì không khớp `-[#`, nên nó ra khỏi bảng màu ngữ nghĩa mà không ai báo:

```tsx
<div className="bg-[rgb(37,99,235)] text-[hsl(210_20%_98%)] shadow-[0_1px_2px_rgba(0,0,0,.08)]" />
```

Và cách trực tiếp nhất để viết ra đúng hai thứ luật này cấm thì không phải là class:

```tsx
<div style={{ padding: "6px", gap: "13px", color: "#2563eb" }} />
```

---

## `no-hand-rolled-heading`

### Trường hợp: tiêu đề ráp tay trên thẻ thường

**SAI**

```tsx
<span className="text-2xl font-bold">{title}</span>
```

**ĐÚNG**

```tsx
<Heading level={2}>{title}</Heading>
```

Hai dòng khác nhau đúng một điều: dàn ý mà trình đọc màn hình dựng ra có chứa tiêu đề này hay không.

### Trường hợp: nhấc ra hằng số

**SAI**

```tsx
const TITLE = "text-3xl font-extrabold tracking-tight"

export const PageTitle = ({ children }) => <div className={TITLE}>{children}</div>
```

**ĐÚNG**

```tsx
export const PageTitle = ({ children }) => <Heading level={1}>{children}</Heading>
```

### Trường hợp: tách ra hai phần tử của mảng vẫn bị nối lại

Các phần tử mảng được nối bằng dấu cách **trước khi** biểu thức chính quy chạy, nên tách ra không
giấu được cặp.

**SAI**

```ts
export const bannerEntry = {
  classes: ["block", "text-xl", "font-black"],
}
```

**ĐÚNG**

```ts
export const bannerEntry = {
  classes: ["block"],
}
```

### Chỗ lách và chỗ dễ nhầm

Ba đoạn dưới **không bị báo**, và cả ba đều là tiêu đề ráp tay.

Nét đậm phổ biến nhất của tiêu đề không nằm trong danh sách nét đậm nặng:

```tsx
<span className="text-2xl font-semibold">{title}</span>
```

Danh sách cỡ dừng ở `5xl`, còn cỡ trong ngoặc vuông thì không luật nào ở đây nhìn thấy:

```tsx
<span className="text-6xl font-bold">{hero}</span>
<span className="text-[2rem] font-bold">{hero}</span>
```

Cặp phải nằm trong **một** chuỗi; tách cỡ và nét đậm ra hai nút là đủ để luật không thấy gì:

```tsx
<p className="text-2xl">
  <strong>{title}</strong>
</p>
```

---

## `no-unresolved-token-class`

Luật này chỉ chạy khi nó tìm được một tệp kiểu dáng ở đâu đó phía trên tệp đang lint. Mọi ví dụ
dưới đây giả định đã tìm được, và đây là nội dung tệp ấy:

```css
@theme {
  --container-app-sm: 18rem;
  --container-app-md: 42rem;
  --min-height-panel: 24rem;
}
```

### Trường hợp: tên có trong union, biến thì không có trong chủ đề

Đây là giá trị chết duy nhất mà kiểu đóng không bắt được: trình biên dịch hài lòng vì tên nằm trong
union, class vẫn được phát ra, và phần tử không nhận được chiều rộng nào.

**SAI**

```tsx
<main className="mx-auto w-full max-w-app-lg" />
```

**ĐÚNG**

```tsx
<main className="mx-auto w-full max-w-app-md" />
```

Hoặc giữ nguyên class và bổ sung biến, vì thêm một thành viên vào thang là một quyết định có chủ ý:

```css
@theme {
  --container-app-lg: 62rem;
}
```

### Trường hợp: trong entry, và tên framework tự phân giải thì không bị báo

**SAI**

```ts
export const drawerEntry = {
  classes: ["flex", "flex-col", "max-h-drawer"],
}
```

**ĐÚNG**

```ts
export const drawerEntry = {
  classes: ["flex", "flex-col", "max-h-screen"],
}
```

`max-h-screen` không bị báo vì `screen` nằm trong tập tên framework tự phân giải. Báo nó lên là đẩy
người viết đi định nghĩa một biến không ai đọc — lần chạy đầu tiên trên hai kho, luật đưa ra đúng
hai phát hiện và cả hai đều thuộc loại này.

### Trường hợp: một biến thể thì vẫn bị bắt

Bộ gỡ tiền tố xử lý được **một** biến thể, nên dòng dưới vẫn nổ đúng như không có tiền tố.

**SAI**

```tsx
<section className="lg:min-h-editor" />
```

**ĐÚNG**

```tsx
<section className="lg:min-h-panel" />
```

### Chỗ lách và chỗ dễ nhầm

Ba đoạn dưới **không bị báo**, và cả ba đều là class chết.

Biến thể thứ hai, hoặc một biến thể bắt đầu bằng chữ số, làm khuôn neo đầu chuỗi không khớp nữa:

```tsx
<section className="lg:hover:min-h-editor 2xl:min-h-editor" />
```

Chỉ ba họ được kiểm, nên cùng một cái chết ở một họ khác thì không ai canh:

```tsx
<div className="w-app-lg rounded-app-lg shadow-app-raised gap-app-tight" />
```

Phép kiểm là tìm chuỗi con trong văn bản tệp kiểu dáng, nên **dùng biến được tính là định nghĩa
biến** — tệp dưới đây làm cho `min-h-editor` trở nên hợp lệ trong mắt luật, dù không có khai báo
nào:

```css
.legacy-editor {
  /* --min-height-editor: 32rem; */
  min-height: var(--min-height-editor);
}
```

---

## Ánh xạ yêu cầu sang luật máy

Nêu bạn định viết gì, rồi tra xem có luật nào chỉ tay vào được không. Nếu cột "Luật bắt" ghi *không
luật nào*, đó **không** phải giấy phép — đó là chỗ luật văn bản vẫn ràng buộc còn máy thì không đỡ
được cho bạn.

| Bạn định viết | Luật bắt | Mã | Kết quả |
|---|---|---|---|
| `gap-1.5` trên một thẻ trong thư mục lá | `no-fractional-step` | `TOKEN-3` | Báo lỗi, nêu đúng `gap-1.5` |
| `gap-1.5` trong một hằng số module | `no-fractional-step` | `TOKEN-3` | Báo lỗi — nhấc ra không giấu được |
| `min-w-3.5` ở bất cứ đâu | *không luật nào* | `TOKEN-3` | Im lặng; họ này thiếu trong danh sách |
| `w-[420px]` | `no-arbitrary-value` | `TOKEN-4` | Báo lỗi độ dài |
| `text-[#2563eb]` | `no-arbitrary-value` | `TOKEN-4` | Báo lỗi màu |
| `bg-[rgb(37,99,235)]` | *không luật nào* | `TOKEN-4` | Im lặng; chỉ khớp `-[#` |
| `text-[28px]` | *không luật nào* | `TOKEN-4` | Im lặng; họ `text` không có trong danh sách độ dài |
| `text-2xl font-bold` trong một chuỗi | `no-hand-rolled-heading` | `TOKEN-5` | Báo lỗi cặp, không nêu class |
| `text-2xl font-semibold` | *không luật nào* | `TOKEN-5` | Im lặng; `semibold` không phải nét đậm nặng |
| `max-w-app-lg` khi biến chưa có | `no-unresolved-token-class` | `TOKEN-9` | Báo lỗi, nêu `--container-app-lg` |
| `max-h-screen` | *không luật nào* | `TOKEN-9` | Im lặng có chủ đích; framework tự phân giải |
| `w-app-lg` khi biến chưa có | *không luật nào* | `TOKEN-9` | Im lặng; họ không được kiểm |
| Bất cứ thứ gì ở trên, đặt trong `cn(...)` | *không luật nào* | — | Im lặng; bộ đọc không có ca cho lời gọi hàm |
| Bất cứ thứ gì ở trên, trong tệp không có `/src/` | *không luật nào* | — | Im lặng; cổng đường dẫn tắt hết bốn luật |

## Bảng phân định ranh giới

Bốn luật này chồng lấn ít hơn tên gọi của chúng gợi ý. Bảng dưới trả lời câu "cái này thuộc luật
nào" cho những cặp hay bị lẫn.

| Ranh giới | Ai bắt, và vì sao |
|---|---|
| `p-1.5` so với `p-[6px]` | Cái đầu là `no-fractional-step`, cái sau là `no-arbitrary-value`. Cùng một khoảng cách, hai luật khác nhau, hai thông điệp khác nhau |
| `max-w-[62rem]` so với `max-w-app-lg` | Cái đầu là giá trị tuỳ ý (`TOKEN-4`); cái sau là **lời hứa** về một biến (`TOKEN-9`). Chỉ cái sau cần đọc tệp kiểu dáng mới kết luận được |
| `min-h-screen` so với `min-h-panel` | Cùng khuôn, khác kết luận: `screen` nằm trong tập dành riêng nên bỏ qua; `panel` phải có `--min-height-panel` |
| `text-[28px]` so với `text-2xl font-bold` | Cái đầu **không luật nào** bắt; cái sau là `no-hand-rolled-heading`. Nghịch lý là cỡ chữ tuỳ ý lại thoát dễ hơn cỡ chữ hợp lệ dùng sai chỗ |
| Chuỗi tĩnh so với chuỗi có nội suy | Chuỗi tĩnh thuộc cả bốn luật; chỉ cần **một** biểu thức trong template là cả bốn cùng mù |
| Khoá `classes` so với mọi khoá khác | Chỉ `classes`, viết không dấu nháy, không tính toán, mới được đọc. `root`, `base`, `"classes"` và `["classes"]` đều không |

## Sai lầm lặp lại nhiều nhất

1. **Đọc bản chạy sạch là bằng chứng.** Tệp ngoài `/src/`, tệp dùng `cn(...)`, kho không có tệp kiểu
   dáng ở đúng đường dẫn — cả ba đều xanh vì luật không chạy, không phải vì mã đúng.
2. **Tin tên luật thay vì tin biểu thức chính quy.** `no-arbitrary-value` không cấm mọi giá trị tuỳ
   ý; nó cấm ngoặc vuông ở họ giãn cách/kích thước và màu hex ở họ màu.
3. **Nhấc giá trị lệch thang ra hằng số cho đỡ chướng mắt.** Nhấc ra **có bị bắt** — và nếu bạn lồng
   thêm một cấp object thì nó thoát, tức là bạn vừa giấu chứ không sửa.
4. **Sửa đúng class được nêu tên rồi kết luận đã xong.** Mỗi nút chỉ báo hit đầu tiên; chuỗi ba bậc
   lẻ cần ba lượt.
5. **Dùng `font-semibold` để "tránh" luật tiêu đề.** Kết quả vẫn là một tiêu đề mà dàn ý không chứa,
   chỉ khác là không ai báo.
6. **Viết `style={{ … }}` khi class bị chặn.** Đó là cùng một vi phạm ở chỗ không luật nào nhìn tới.
7. **Coi `var(--x)` là bằng chứng `--x` đã được định nghĩa.** Luật cuối cùng cũng nhầm y như vậy;
   đừng nhầm theo nó.
