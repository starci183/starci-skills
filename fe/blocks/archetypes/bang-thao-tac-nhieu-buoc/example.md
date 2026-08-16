---
id: fe-blocks-archetypes-bang-thao-tac-nhieu-buoc-example
title: example.md
slug: /fe/blocks/archetypes/bang-thao-tac-nhieu-buoc/example
sidebar_label: example.md
sidebar_position: 2
description: Ba máy bước đang chạy và cách chúng khác thang tải.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `bang-thao-tac-nhieu-buoc` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## Ba máy bước

| Khối | Bước |
|---|---|
| `AuthenticationPanel` | `details` → `code` → `done` |
| `StarCiAiChat` | `renaming`, `archiving` |
| Thảo luận | `submitting` |

Không cái nào có `pending`, `empty`, `failed`, `ready` làm bước. Thang tải, nếu có, sống song song
dưới dạng cờ của từng control.

---

## `A6-3` — hai trường, không một

```tsx
readonly statusMessage: string
readonly isError: boolean
readonly isPending: boolean
```

Câu nói, và loại của câu nói. Gộp chúng lại là mất khả năng announce.

---

## Ánh xạ

| Yêu cầu nghe được | Archetype |
|---|---|
| "màn đăng nhập có bước nhập OTP" | `A6` |
| "chat có nút đổi tên và lưu trữ" | `A6`, hai cờ |
| "form này đang tải" | hỏi lại: tải là bước, hay là một cờ của một nút |
