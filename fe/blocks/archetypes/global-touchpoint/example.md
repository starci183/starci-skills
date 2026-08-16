---
id: fe-blocks-archetypes-global-touchpoint-example
title: example.md
slug: /fe/blocks/archetypes/global-touchpoint/example
sidebar_label: example.md
sidebar_position: 2
description: Bốn cửa vào và hai chỗ đang lệch.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `global-touchpoint` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `A8-1` và `A8-2`

```tsx
export type StarCiAiFabData = {
    readonly label: string
    readonly isOpen: boolean
    readonly hasUnread?: boolean
}

export type StarCiAiFabActions = {
    readonly press?: () => void
}
```

---

## `A8-3` — menu host

`AccountMenu` và `LanguageMenu` treo vào `DropdownShell`, nên nửa thuần chỉ mô tả các mục. Chúng vẫn
khai `meta` với `world: "pure"`.

---

## Hai chỗ đang lệch

| Chỗ | Mã | Vấn đề |
|---|---|---|
| `StarCiAiFab` tự đặt `position: fixed` | `A8-4` | khối tự quyết chỗ đứng |
| `StarCiAiFab` vẽ badge `"1"` | `A8-5` | không có producer cho con số |

---

## Ánh xạ

| Yêu cầu nghe được | Archetype |
|---|---|
| "nút AI luôn hiện ở góc" | `A8`, nhưng vị trí do chủ mount quyết |
| "menu tài khoản khi đăng nhập" | `A8`, `guest \| signedIn` |
| "badge số tin chưa đọc" | `A8-5` — hỏi producer trước |
