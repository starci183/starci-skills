---
id: fe-blocks-laws-b13-closed-data-example
title: example.md
slug: /fe/blocks/laws/b13-closed-data/example
sidebar_label: example.md
sidebar_position: 2
description: Hình dạng bị bác, hình dạng thay thế, và năm khối đang nhận isLoading.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b13-closed-data` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B13-1` — hợp đồng props của một khối

```ts
export type BlockProps<S extends string, D extends ComponentData> = {
    readonly state: S
    readonly props: D
}
```

Hai chỗ. Không có chỗ thứ ba cho một node.

---

## `B13-2` — bị bác và cái thay thế

| Bị bác | Thay bằng | Vì sao |
|---|---|---|
| `endComponent: ReactNode` | `endText` cộng một contract fact tuỳ chọn | nội dung tuỳ ý biến composite thành branch |

---

## `B13-5` — năm khối đang nhận

```tsx
export type GlobalSearchResultsProps = {
    readonly props: GlobalSearchResultsData
    readonly on?: GlobalSearchResultsActions
    readonly isLoading?: boolean
}
```

Cùng với `StarCiAiFab`, `FeedExplorer`, `LearnSpine`, `SkillSnapshot`.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "cho tôi truyền custom content vào" | `B13-1` | đưa dữ liệu, không đưa node |
| "cuối hàng cần một component riêng" | `B13-2` | một trường chữ đóng |
| "modal thì nhận children chứ?" | `B13-3` | shell được, khối không |
| "truyền `isLoading` xuống nhé" | `B13-5` | khối tự tính |
