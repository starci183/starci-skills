---
id: fe-blocks-laws-b2-chip-or-text-example
title: example.md
slug: /gates/blocks/laws/b2-chip-or-text/example
sidebar_label: example.md
sidebar_position: 2
description: Mã sống cho từng mã B2-N, kèm bốn chỗ đang vi phạm và cách đọc chúng.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b2-chip-or-text` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B2-1` — số đếm là chữ

### Đúng: dòng giá dùng `endText`

```tsx
<IconLabelFactRow
    props={{ icon: LINE_ICONS[line.id] ?? "cart", label: line.label, endText: line.value, recipe: "label-led" }}
/>
```

Mọi dòng của bảng chi tiết giá đều là chữ. Không dòng nào đeo chip, kể cả dòng tổng.

### Đúng: nhánh phạm vi của `SelectionList` sau khi sửa

```tsx
<IconLabelFactRow props={{ icon: item.icon, label: item.title, endText: item.badge, recipe: "compact-action" }} />
```

Số đếm đi vào `endText`, đúng như phán quyết.

### Còn sai: nhánh kết quả của cùng leaf đó

```tsx
<span className="shrink-0 rounded-full bg-default px-2 py-1 text-xs text-muted">{item.badge}</span>
```

Vẫn nguyên văn cái pill đã bị bác, chỉ đổi nhánh. Khối nạp vào đó `result.statusLabel ?? result.kindLabel`.

---

## `B2-2` — nhãn phân loại là chữ

### Đúng: chức danh và số người theo dõi trong `ProfileHero`

```tsx
role: defineLeafComponent("text", { size: "sm" }, () => (
    <Text props={{ content: input.props.role, size: "sm", weight: "medium" }} isLoading={isLoading} />
)),
```

### Sai trong cùng khối: nơi ở và hình thức làm việc

```tsx
fact: factValues.map((fact) => defineLeafComponent("badge", {}, () => (
    <Badge props={{ content: fact }} isLoading={isLoading} />
))),
```

Không tone, tức không nghĩa. Trượt câu hỏi ba.

### Sai: tên giai đoạn giá

```tsx
phase: defineLeafComponent("badge", {}, () => (
    <Badge props={{ content: activePhase.name, tone: "accent" }} />
)),
```

Có một dòng từ chối viết đúng cho field này: so sánh giai đoạn cần typography đồng cấp, không cần
chip chrome.

### Sai: tag bài toán

```tsx
topic: tags.map((tag) => defineLeafComponent("badge", {}, () => (
    <Badge props={{ content: tag, tone: "neutral" }} />
))),
```

---

## `B2-3` — trạng thái thật đeo chip

```tsx
? defineLeafComponent("badge", {}, () => <Badge props={{ content: input.props.claimedLabel ?? "", tone: "success" }} />)
```

Ba câu hỏi: máy chủ đổi (có), chặn quyền nhận lần nữa (có), `success` không hoán đổi với `danger`
(có). Đủ ba.

Hai chip khác của cột giá cũng qua đủ ba: `discountLabel` tone `success` và `scarcityLabel` tone
`warning`.

---

## `B2-4` — cái đang chọn không đeo gì

Hàng phạm vi đang chọn dùng sơn của chính nó — `data-[selected=true]:bg-accent-soft` — chứ không
mọc thêm tick. Thầy nói đúng bốn chữ: "không có dấu tick".

### Trông giống nhưng không phải `B2-3`: nhãn testcase khi chưa chạy

```tsx
tone: testcase.passed === undefined ? "neutral" : testcase.passed ? "success" : "danger",
```

Nhánh `undefined` là một chip không mang trạng thái nào — nó đang làm tab. Hai nhánh còn lại là
`B2-3` thật.

---

## `B2-5` — nhiều kết cục thì dùng chấm và chữ

`JudgeStatusStrip` có mười một tình huống và **từ chối** tạo một leaf `VerdictChip`, dùng
`StatusDot` cộng `Text`. Docstring ghi thẳng lý do: chỉ có hai nơi gọi, và một bản đồ đóng trong một
khối nhỏ hơn một leaf mới.

Đây là chỗ mỉa mai nhất của tầng block: cái **không** phải trạng thái thì đeo chip, còn cái **là**
trạng thái thì không.

---

## `B2-6` — glyph nhắc lại thì bỏ

Icon tím `review` sau từng bài xem trước bị bác, thay bằng danh sách chữ thuần có đánh số.

---

## `B2-7` — không có dữ liệu thì không vẽ

```tsx
badge: input.props.hasUnread === true
    ? defineLeafComponent("badge", {}, () => <Badge props={{ content: "1", tone: "accent" }} />)
    : undefined,
```

Kiểu dữ liệu chỉ có `hasUnread?: boolean`. Con số `1` là bịa. Cách đúng đã có phán quyết từ trước ở
menu tài khoản: không badge cho tới khi API có count thật; nếu chỉ cần nói "có tin mới" thì dùng một
dấu hiệu không mang số.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "cho cái số này nổi lên tí" | `B2-1` | đổi typography, không bọc pill |
| "đánh dấu loại của nó" | `B2-2` | chữ; chip chỉ khi tone mang nghĩa |
| "cho biết cái nào đang chọn" | `B2-4` | sơn của hàng, không tick |
| "hiện trạng thái chấm bài" | `B2-5` | chấm và chữ, không chip |
| "thêm badge thông báo" | `B2-7` | hỏi backend có count không trước |
| "cho nó cái chip cho đẹp" | `B2-2` | "cho đẹp" là câu trả lời "không" cho câu hỏi hai |
