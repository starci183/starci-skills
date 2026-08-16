---
id: fe-blocks-laws-b9-list-label-owner-example
title: example.md
slug: /gates/blocks/laws/b9-list-label-owner/example
sidebar_label: example.md
sidebar_position: 2
description: Một chỗ đúng, một chỗ sai, đọc cạnh nhau.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b9-list-label-owner` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B9-1` — branch in nhãn

```tsx
return (
    <div data-component="SurfaceListCard" className="flex flex-col gap-3">
        {surfaceProps.isLabelHidden === true ? null : label}
        <Card ... >
```

Nhãn là việc của branch. Cờ chỉ tắt nó, không chuyển quyền sở hữu đi đâu.

---

## `B9-3` — chỗ đúng

```tsx
<SurfaceListCard
    contract="ranked-user-list"
    props={{ label: input.props.label, rows, isNested: true, isLabelHidden: true }}
    ...
/>
/* và SurfaceCard bao ngoài vẽ đúng input.props.label */
```

---

## `B9-2` — chỗ sai

```tsx
<SurfaceListCard
    contract="global-search-surface-list"
    props={{ ...input.props, isNested: true, isLabelHidden: true }}
    ...
/>
```

`resultsLabel` đi vào đây rồi bị ẩn. Không chủ nào bên ngoài vẽ nó. Trên màn hình, cột giữa của
overlay là một danh sách không tên.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "cho cái tiêu đề lên trên danh sách" | `B9-1` | truyền `label`, đừng vẽ heading riêng |
| "tiêu đề bị lặp hai lần" | `B9-3` | ẩn cái trong, và nêu tên chủ ngoài |
| "ẩn tiêu đề đi cho gọn" | hỏi lại | *ai đang vẽ đúng cái nhãn đó?* Không ai thì không được ẩn |
