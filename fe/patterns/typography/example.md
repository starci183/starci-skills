---
id: fe-patterns-typography-example
title: example.md
slug: /fe/patterns/typography/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã TYPESET-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `typography` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Không component library, không design system riêng, không tên
sản phẩm. Chỗ duy nhất xuất hiện một component là `Heading` — vì ở mã `TYPESET-1` và `TYPESET-2`,
**ranh giới component chính là luật**, nên viết bằng markup thô sẽ giấu mất điều đang được nói.

`text-muted` trong các ví dụ là **token tông phụ** của hệ thống bất kỳ; đọc nó như "tông muted", đừng
đọc nó như tên class của một sản phẩm cụ thể.

Mỗi mã có **nhiều case**, mỗi case đặt ĐÚNG cạnh SAI, rồi tới mục **ngoại lệ và nhầm lẫn**. Cuối
trang ánh xạ từ yêu cầu bằng lời sang một bộ cỡ/đậm/tông duy nhất.

---

## `TYPESET-1` — heading là một cấp

### Case: tên của một section

```tsx
// ĐÚNG
<Heading content={sectionTitle} level={2} />
```

```tsx
// SAI
<h2 className="text-2xl font-bold">{sectionTitle}</h2>
```

Khác nhau ở đúng một chỗ: outline mà trình đọc màn hình dựng có khớp với thứ mắt người đọc thấy hay
không. Bản SAI còn kéo theo hai bậc mà thang không có (`text-2xl`, `font-bold`).

### Case: "heading" ghép từ cỡ và độ đậm, không có tag

```tsx
// ĐÚNG
<Heading content={groupName} level={3} />
```

```tsx
// SAI
<div className="text-base font-semibold">{groupName}</div>
```

Bản SAI là một heading mà **không hệ thống nào biết**: nó không nằm trong outline, nên trang nhìn thì
có cấu trúc mà nghe thì không.

### Case: tag đúng nhưng dáng tự chế

```tsx
// ĐÚNG
<Heading content={pageTitle} level={1} />
```

```tsx
// SAI
<h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
```

Tag đúng vẫn không cứu được: cỡ và độ đậm đặt tay ở đây sẽ trôi khỏi mọi `h1` khác trong sản phẩm
ngay lần sửa kế tiếp.

### Case: heading trong một card lặp lại

```tsx
// ĐÚNG
<article className="flex flex-col gap-1">
    <Heading content={course.title} level={2} />
    <p className="text-sm text-muted">{course.summary}</p>
</article>
```

```tsx
// SAI
<article className="flex flex-col gap-1">
    <h2 className="text-sm font-medium">{course.title}</h2>
    <p className="text-sm text-muted">{course.summary}</p>
</article>
```

Bản SAI viết tay một cấp 2 nhưng đặt nó ở metrics của cấp 3 — outline nói "cấp 2", con mắt nói "cấp
3", và không bên nào sai một mình.

### Ngoại lệ và nhầm lẫn

- **File component heading là ngoại lệ duy nhất.** Đúng một file được viết tag, vì nó sở hữu `level`:

  ```tsx
  // Trong chính component heading — hợp lệ ở đây và chỉ ở đây.
  const TAGS = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" } as const
  const Tag = TAGS[level]
  return <Tag className={LEVEL_CLASSES[level]}>{content}</Tag>
  ```

- **File test dựng markup thô để assert** không thuộc phạm vi luật này.
- **`role="heading"` cũng không phải lối thoát:**

  ```tsx
  // SAI
  <div role="heading" aria-level={2} className="text-base font-semibold">{title}</div>
  ```

---

## `TYPESET-2` — bốn cấp, cấp thứ năm là lỗi cấu trúc

### Case: có người xin bậc thứ năm

```tsx
// ĐÚNG — làm phẳng, rồi đặt tên bằng một cấp mà thang có
<section className="flex flex-col gap-6">
    <Heading content={sectionTitle} level={2} />
    <div className="flex flex-col gap-3">
        <Heading content={groupTitle} level={3} />
        <ul className="divide-y rounded-lg border">{rows}</ul>
    </div>
</section>
```

```tsx
// SAI
<h5 className="text-xs font-semibold uppercase">{groupTitle}</h5>
```

Khác nhau ở đúng một chỗ: bản ĐÚNG sửa **độ sâu lồng nhau**, bản SAI sửa **cỡ chữ** và để nguyên cái
lồng nhau đã gây ra yêu cầu.

### Case: thay cấp năm bằng một dòng body in đậm

```tsx
// ĐÚNG
<Heading content={subGroupTitle} level={4} />
```

```tsx
// SAI
<div className="text-xs font-semibold">{subGroupTitle}</div>
```

Bản SAI vừa vi phạm `TYPESET-2` (bịa ra bậc thứ năm) vừa vi phạm `TYPESET-7` (12px mà không muted).
Một lối tắt thường vi phạm nhiều hơn một luật.

### Ngoại lệ và nhầm lẫn

- **Không có ngoại lệ nào cho cấp thứ năm.** Union cấp đóng ở `4`, và rule lint báo `<h5>`/`<h6>` là
  vấn đề cấu trúc chứ không phải vấn đề style:

  ```tsx
  // SAI — cả hai dòng đều bị chặn, với thông điệp khác nhau
  <h5>{title}</h5>
  <h6>{title}</h6>
  ```

- **Card lồng trong card không tự sinh thêm cấp.** Card bên trong thường không cần heading, nó cần
  một title body — xem `TYPESET-9`.

---

## `TYPESET-3` — thứ bậc không đến từ một cái khung

### Case: category trên tên card

```tsx
// ĐÚNG
<div className="flex flex-col gap-1">
    <span className="text-sm text-muted">{course.category}</span>
    <Heading content={course.title} level={3} />
</div>
```

```tsx
// SAI
<div className="flex flex-col gap-1">
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">{course.category}</span>
    <p className="text-sm">{course.title}</p>
</div>
```

Khác nhau ở đúng một chỗ: mắt chạm dòng nào trước — và ở bản SAI, nó chạm cái category.

### Case: làm nổi một con số

```tsx
// ĐÚNG
<div className="flex flex-col gap-1">
    <span className="text-base font-medium tabular-nums">{stat.value}</span>
    <span className="text-xs text-muted">{stat.label}</span>
</div>
```

```tsx
// SAI
<div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-2">
    <span className="text-sm tabular-nums">{stat.value}</span>
</div>
```

Bản SAI mượn một cái khung để nói "quan trọng". Người đọc thứ hai sẽ mượn tiếp, và tới cái thứ tư thì
không cái nào còn nghĩa gì.

### Ngoại lệ và nhầm lẫn

- **Chip nói một trạng thái thì không thuộc mã này.** Nó vẽ một sự thật, không phải một thứ bậc:

  ```tsx
  // ĐÚNG — "đã hoàn thành" là dữ liệu, không phải cách nhấn mạnh
  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Đã hoàn thành</span>
  ```

- **Surface có viền để gom nhóm** cũng không thuộc mã này: nó nói ranh giới, không nói thứ bậc.
- **Nền màu để phân biệt hàng chẵn/lẻ** là chuyện của bảng biểu, không phải của thứ bậc chữ.

---

## `TYPESET-4` — hạ hàng xóm xuống, đừng nâng nó lên

### Case: một dòng cần nổi trong bốn dòng

```tsx
// ĐÚNG — dòng cần đọc giữ mặc định, những dòng quanh nó lùi xuống
<dl className="flex flex-col gap-1">
    <div className="flex justify-between"><dt className="text-sm text-muted">Kỳ hạn</dt><dd className="text-sm text-muted">12 tháng</dd></div>
    <div className="flex justify-between"><dt className="text-sm text-muted">Bắt đầu</dt><dd className="text-sm text-muted">16/08</dd></div>
    <div className="flex justify-between"><dt className="text-sm">Tổng thanh toán</dt><dd className="text-sm font-medium tabular-nums">4.990.000đ</dd></div>
</dl>
```

```tsx
// SAI — mọi dòng vẫn ở mặc định, dòng cần đọc leo lên một bậc
<dl className="flex flex-col gap-1">
    <div className="flex justify-between"><dt className="text-sm">Kỳ hạn</dt><dd className="text-sm">12 tháng</dd></div>
    <div className="flex justify-between"><dt className="text-sm">Bắt đầu</dt><dd className="text-sm">16/08</dd></div>
    <div className="flex justify-between"><dt className="text-base font-semibold">Tổng thanh toán</dt><dd className="text-base font-semibold tabular-nums">4.990.000đ</dd></div>
</dl>
```

Khác nhau ở đúng một chỗ: thang còn chỗ trống ở phía trên hay không. Bản SAI vừa tiêu mất bậc cuối
cùng cho một dòng tổng tiền, và lần sau sẽ không còn gì để tiêu.

### Case: ba nút cùng muốn là chính

```tsx
// ĐÚNG
<div className="flex items-center gap-2">
    <button className="text-sm text-muted" type="button">Xoá</button>
    <button className="text-sm text-muted" type="button">Lưu nháp</button>
    <button className="text-sm font-medium" type="submit">Xuất bản</button>
</div>
```

```tsx
// SAI
<div className="flex items-center gap-2">
    <button className="text-sm font-medium" type="button">Xoá</button>
    <button className="text-sm font-medium" type="button">Lưu nháp</button>
    <button className="text-base font-semibold" type="submit">Xuất bản</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Không có ngoại lệ "màn này đặc biệt".** Một màn hình mà mọi dòng đều ở tông mặc định là một màn
  hình chưa được phân hạng:

  ```tsx
  // Dấu hiệu: đếm số `text-muted` trên surface. Bằng không thường nghĩa là chưa ai hạ thứ gì.
  <section className="flex flex-col gap-2">
      <p className="text-sm">{a}</p>
      <p className="text-sm">{b}</p>
      <p className="text-sm">{c}</p>
  </section>
  ```

- **Hạ hàng xóm không có nghĩa là làm chúng khó đọc.** Muted là một bậc tông đã được kiểm tương phản,
  không phải "xám thêm bao nhiêu cũng được".

---

## `TYPESET-5` — dòng phụ xếp dưới title của nó

### Case: eyebrow trên title

```tsx
// ĐÚNG
<div className="flex flex-col gap-1">
    <span className="text-xs text-muted">{lesson.chapter}</span>
    <p className="text-base font-medium">{lesson.title}</p>
</div>
```

```tsx
// SAI
<div className="flex flex-col gap-1">
    <span className="text-base font-semibold">{lesson.chapter}</span>
    <p className="text-base font-medium">{lesson.title}</p>
</div>
```

### Case: con số đếm cạnh tên chương

```tsx
// ĐÚNG
<div className="flex items-baseline justify-between">
    <span className="text-sm font-medium">{chapter.title}</span>
    <span className="text-sm text-muted tabular-nums">{chapter.lessonCount} bài</span>
</div>
```

```tsx
// SAI
<div className="flex items-baseline justify-between">
    <span className="text-sm font-medium">{chapter.title}</span>
    <span className="text-base font-semibold tabular-nums">{chapter.lessonCount}</span>
</div>
```

Con số **không tự thăng cấp**: nó vẫn chỉ là một dữ kiện về cái tên bên trái.

### Case: chỉ đổi tông là chưa đủ

```tsx
// ĐÚNG — dòng phụ tụt hẳn một bậc, và bậc đó kéo theo tông muted
<div className="flex flex-col gap-1">
    <span className="text-sm font-medium">{file.name}</span>
    <span className="text-xs text-muted">PDF · 2,4 MB</span>
</div>
```

```tsx
// SAI — cùng cỡ, chỉ khác màu
<div className="flex flex-col gap-1">
    <span className="text-sm font-medium">{file.name}</span>
    <span className="text-sm text-muted">PDF · 2,4 MB</span>
</div>
```

Hai dòng cùng cỡ vẫn đòi cùng một thứ bậc kể cả khi một dòng đã xám. Ở đây caption **giải thích** cho
dòng trên, nên nó thuộc bậc 12px hạn chế.

### Ngoại lệ và nhầm lẫn

- **Hai peer cùng 14px, khác độ đậm** là hợp lệ — đây là ngoại lệ đã đóng:

  ```tsx
  // ĐÚNG — label medium, giá trị normal; cùng cỡ nhưng vẫn có thứ bậc
  <div className="flex items-baseline justify-between">
      <span className="text-sm font-medium">Trạng thái</span>
      <span className="text-sm text-muted">Đang xử lý</span>
  </div>
  ```

- **Không phải mọi dòng thứ hai đều là dòng phụ.** Trong một record hai dữ kiện ngang hàng, cả hai có
  thể ở cùng bậc — lúc đó không có title nào để xếp dưới.

---

## `TYPESET-6` — heading không nhận độ đậm riêng

### Case: heading "chưa đủ mạnh"

```tsx
// ĐÚNG
<Heading content={title} level={2} />
```

```tsx
// SAI
<Heading content={title} level={2} className="font-bold" />
```

Khác nhau ở đúng một chỗ: có bao nhiêu hệ thống đang quyết độ đậm của dòng này. Hai hệ thống thì
người đọc thấy bên thua.

### Case: kiểu dữ liệu đã chặn sẵn

```tsx
// Kiểu dữ liệu của heading, viết ở dạng tổng quát
type HeadingData = {
    readonly content?: string
    readonly level?: 1 | 2 | 3 | 4
}
```

```tsx
// SAI — không compile được: không có trường `weight` nào để nhận
<Heading content={title} level={3} weight="semibold" />
```

Đây là chỗ hiếm hoi luật được giữ bằng **kiểu**, không phải bằng người đọc: cái sai không phải bị
phát hiện, nó **không viết ra được**.

### Ngoại lệ và nhầm lẫn

- **Body text thì được.** Độ đậm là trục hợp lệ của body, và là cách hạng hai peer cùng cỡ:

  ```tsx
  // ĐÚNG
  <p className="text-sm font-medium">{rowTitle}</p>
  <p className="text-sm">{rowValue}</p>
  ```

- **"Cho màn này đậm hơn thôi"** là yêu cầu đổi luật, không phải một lần chọn khác đi. Nếu cấp 3 chưa
  đủ mạnh ở khắp nơi thì thứ cần sửa là **thang**, ở đúng một chỗ.

---

## `TYPESET-7` — bậc 12px luôn muted

### Case: thời gian tương đối

```tsx
// ĐÚNG
<span className="text-xs text-muted">55 phút trước</span>
```

```tsx
// SAI
<span className="text-xs">55 phút trước</span>
```

### Case: dữ kiện bên phải một label

```tsx
// ĐÚNG
<div className="flex items-baseline justify-between">
    <span className="text-sm">Hạn mức còn lại</span>
    <span className="text-xs text-muted tabular-nums">120 / 500</span>
</div>
```

```tsx
// SAI — chữ nhỏ nhưng vẫn đòi tông chính
<div className="flex items-baseline justify-between">
    <span className="text-sm">Hạn mức còn lại</span>
    <span className="text-xs font-medium tabular-nums">120 / 500</span>
</div>
```

### Case: nội dung chính bị nhét xuống 12px vì chỗ hẹp

```tsx
// ĐÚNG — thông tin phải đọc thì ở lại bậc trên, dù chật
<p className="text-sm">{errorMessage}</p>
```

```tsx
// SAI
<p className="text-xs">{errorMessage}</p>
```

Chỗ chật không phải một lý do ngữ nghĩa. Nếu dòng chữ buộc phải giữ tông chính thì nó đủ quan trọng
để ở lại 14px.

### Case: kiểu dữ liệu ghép cỡ với tông

```tsx
// Kiểu dữ liệu của một dòng body, viết ở dạng tổng quát
type TextData =
    | { readonly size: "xs"; readonly tone?: "muted" }
    | { readonly size?: "sm" | "base"; readonly tone?: "default" | "muted" | "accent" }
```

```tsx
// SAI — không compile được: nhánh `xs` không có tông nào khác `muted`
<Text content={hint} size="xs" tone="default" />
```

Cỡ và tông ở bậc này là **một** quyết định, nên chúng được viết thành **một** union thay vì trông chờ
mọi call site nhớ luật.

### Ngoại lệ và nhầm lẫn

- **Nhãn mốc thời gian không xuống 12px** — xem `TYPESET-8`. Muted không kéo theo 12px; 12px mới kéo
  theo muted, một chiều thôi.
- **Caption dài quá ba dòng** thường không phải caption nữa, mà là nội dung — lúc đó nó về 14px:

  ```tsx
  // SAI — một đoạn văn thật đang mặc áo caption
  <p className="text-xs text-muted">{threeParagraphExplanation}</p>
  ```

---

## `TYPESET-8` — mốc thời gian là subtitle muted

### Case: feed chia theo ngày

```tsx
// ĐÚNG — nhãn nằm NGOÀI surface, và surface bên dưới ẩn nhãn của chính nó
<div className="flex flex-col gap-3">
    {days.map((day) => (
        <section className="flex flex-col gap-2" key={day.id}>
            <span className="text-sm text-muted">{day.label}</span>
            <ul className="divide-y rounded-lg border">
                {day.rows.map((row) => <li className="p-4" key={row.id}>{row.text}</li>)}
            </ul>
        </section>
    ))}
</div>
```

```tsx
// SAI — mỗi mốc thời gian được thăng chức thành một section của trang
<div className="flex flex-col gap-3">
    {days.map((day) => (
        <section key={day.id}>
            <Heading content={day.label} level={3} />
            <ul className="divide-y rounded-lg border">{/* … */}</ul>
        </section>
    ))}
</div>
```

Khác nhau ở đúng một chỗ: outline của trang có dài ra theo **dữ liệu** hay không. Bản SAI khiến số
heading của trang phụ thuộc vào hôm nay có bao nhiêu ngày có hoạt động.

### Case: đừng để surface tự đặt tên lần thứ hai

```tsx
// ĐÚNG
<span className="text-sm text-muted">{day.label}</span>
<ListSurface label={day.label} isLabelHidden rows={day.rows} />
```

```tsx
// SAI — cùng một nhóm kết quả bị đặt tên hai lần, bằng hai thứ bậc khác nhau
<span className="text-sm text-muted">{day.label}</span>
<ListSurface label={day.label} rows={day.rows} />
```

Nhãn vẫn được truyền vào surface vì **trình đọc màn hình cần tên cho vùng đó**; thứ bị ẩn là bản vẽ,
không phải cái tên.

### Ngoại lệ và nhầm lẫn

- **Nhãn giữ 14px, không xuống 12px.** Nó chia vùng quét chứ không giải thích dòng nào:

  ```tsx
  // SAI
  <span className="text-xs text-muted">{day.label}</span>
  ```

- **"Tháng 8/2026" trong một trang báo cáo tĩnh** có thể là section thật — lúc đó nó là `TYPESET-1`.
  Phép thử: dữ liệu trống đi thì dòng đó có biến mất không?

---

## `TYPESET-9` — bậc title theo chủ sở hữu nội dung

### Case: title chiếm ưu thế của một object lớn

```tsx
// ĐÚNG — một card lớn đại diện một object quan trọng
<article className="flex flex-col gap-2 rounded-lg border p-4">
    <p className="text-base font-medium">{course.title}</p>
    <p className="text-sm text-muted">{course.summary}</p>
</article>
```

```tsx
// SAI — cùng bậc đó áp cho mọi dòng trong danh sách lặp lại
{modules.map((module) => (
    <p className="text-base font-medium" key={module.id}>{module.title}</p>
))}
```

### Case: hover không thăng cấp chữ

```tsx
// ĐÚNG — hover xác nhận bấm được, cỡ chữ không đổi
<button className="group flex w-full flex-col gap-1 p-4 text-left" type="button">
    <span className="text-sm font-medium underline-offset-4 group-hover:underline">{item.title}</span>
    <span className="text-sm text-muted">{item.description}</span>
</button>
```

```tsx
// SAI — "card này bấm được" bị đọc thành "chữ này quan trọng hơn"
<button className="flex w-full flex-col gap-1 p-4 text-left" type="button">
    <span className="text-base font-semibold">{item.title}</span>
    <span className="text-sm text-muted">{item.description}</span>
</button>
```

### Case: con số vẫn có thể chỉ là một giá trị thường

```tsx
// ĐÚNG
<div className="flex items-baseline justify-between">
    <span className="text-sm">Bài đã nộp</span>
    <span className="text-sm tabular-nums">128</span>
</div>
```

```tsx
// SAI
<div className="flex items-baseline justify-between">
    <span className="text-sm">Bài đã nộp</span>
    <span className="text-base font-semibold tabular-nums">128</span>
</div>
```

### Case: title dài trong accordion

```tsx
// ĐÚNG
<button className="flex w-full items-center justify-between gap-2 p-4 text-left" type="button">
    <span className="text-sm font-medium">{section.title}</span>
    <span className="text-sm text-muted tabular-nums">{section.duration}</span>
</button>
```

```tsx
// SAI — chỗ còn rộng nên title được nâng bậc
<button className="flex w-full items-center justify-between gap-2 p-4 text-left" type="button">
    <span className="text-base font-medium">{section.title}</span>
    <span className="text-sm text-muted tabular-nums">{section.duration}</span>
</button>
```

### Ngoại lệ và nhầm lẫn

- **Một object quan trọng đang được trưng bày thì được 16px** — kể cả khi nó nằm trong một danh sách,
  miễn danh sách đó chỉ có một hoặc hai phần tử **theo thiết kế**, không phải theo dữ liệu hôm nay.
- **Mô tả và metadata của chính object đó ở 14px normal**, không phải medium:

  ```tsx
  // SAI — mọi dòng trong card đều medium, nên card không còn title nào
  <article className="flex flex-col gap-1">
      <p className="text-base font-medium">{course.title}</p>
      <p className="text-sm font-medium text-muted">{course.summary}</p>
      <p className="text-sm font-medium text-muted">{course.author}</p>
  </article>
  ```

- **Nếu dòng đó nằm trong outline thì đừng chọn bậc body** — nó là `TYPESET-1`.

---

## Ánh xạ yêu cầu sang một bộ cỡ, độ đậm và tông

Nêu dòng chữ, chủ sở hữu của nó và hàng xóm của nó. Nếu thiếu **một** dữ kiện quyết định, hỏi **một**
câu cụ thể rồi dừng. Câu trả lời phải là một bộ set hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Đặt tên cho section này | Nằm trong outline | `TYPESET-1` | `Heading` với `level` |
| Cần một cấp heading nhỏ hơn nữa | Section đã lồng quá sâu | `TYPESET-2` | Làm phẳng, rồi dùng cấp có sẵn |
| Làm cái giá nổi bật hơn | Thứ bậc không đi qua khung | `TYPESET-3` | `text-base font-medium`, bỏ viền |
| Trên card cái gì cũng nổi | Nhấn mạnh là tương đối | `TYPESET-4` | Hạ hàng xóm xuống `text-muted` |
| Hiện category phía trên tên khoá học | Category bổ nghĩa cho tên | `TYPESET-5` | `text-xs text-muted` trên `text-base font-medium` |
| Cho heading này đậm hơn | Cấp đã quyết độ đậm | `TYPESET-6` | Giữ nguyên; đổi cấp nếu thứ bậc thật sự khác |
| Thêm dòng ghi chú nhỏ dưới ô nhập | Copy phụ trợ | `TYPESET-7` | `text-xs text-muted` |
| Chia feed theo "Hôm nay / Hôm qua" | Nhãn chia vùng quét | `TYPESET-8` | `text-sm text-muted`, đặt ngoài surface |
| Tên bài trong danh sách chương | Title lặp lại | `TYPESET-9` | `text-sm font-medium` |
| Tên khoá học trên card lớn ngoài trang chi tiết | Title chiếm ưu thế của một object | `TYPESET-9` | `text-base font-medium` |
| Card này có hover, title có nên to hơn không | Hover không phải thứ bậc | `TYPESET-9` | Giữ nguyên bậc theo chủ sở hữu |

Chỉ một câu hỏi phân định được phép, và chỉ khi thiếu chủ sở hữu: *"Dòng này đại diện cho một object
đang được trưng bày, hay là một dòng lặp lại trong danh sách?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TYPESET-1` / `TYPESET-9` | Dòng này có nằm trong outline của tài liệu không? |
| `TYPESET-1` / `TYPESET-8` | Dữ liệu trống đi thì dòng này có biến mất không? |
| `TYPESET-2` / `TYPESET-9` | Cần thêm một cấp, hay cần một title body bên trong một cấp đã có? |
| `TYPESET-3` / `TYPESET-4` | Đang định nâng bằng phương tiện gì, và có thể hạ hàng xóm thay không? |
| `TYPESET-5` / `TYPESET-7` | Dòng phụ này ở 12px hay 14px — nó giải thích, hay nó là một dữ kiện ngang? |
| `TYPESET-6` / `TYPESET-9` | Dòng đang cần độ đậm là heading hay body? |
| `TYPESET-7` / `TYPESET-8` | Dòng muted này giải thích một dòng, hay chia một nhóm kết quả? |
| `TYPESET-9` / `TYPESET-5` | Đang chọn bậc cho title, hay đang ràng buộc quan hệ title với dòng phụ? |

## Sai lầm lặp lại nhiều nhất

1. Viết tag heading bằng tay rồi tự đặt cỡ — outline và mắt nhìn trôi khỏi nhau.
2. Ghép một cỡ to với một độ đậm nặng và gọi đó là heading.
3. Xin thêm cấp thứ năm thay vì làm phẳng section.
4. Vẽ một cái khung để nói "quan trọng".
5. Nâng dòng quan trọng lên thay vì hạ hàng xóm xuống.
6. Cho dòng phụ cùng cỡ với title rồi chỉ đổi màu.
7. Đẩy `font-bold` lên một heading.
8. Dùng 12px làm bản gọn của chữ chính, giữ nguyên tông foreground.
9. Cho "Hôm nay" một cấp heading.
10. Chọn 16px vì card có hover, vì đó là con số, hoặc vì còn chỗ trống.
