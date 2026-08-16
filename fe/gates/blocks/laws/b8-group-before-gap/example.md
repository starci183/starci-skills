---
id: fe-blocks-laws-b8-group-before-gap-example
title: example.md
slug: /gates/blocks/laws/b8-group-before-gap/example
sidebar_label: example.md
sidebar_position: 2
description: Ba hình dạng bị bác và một entry contract đúng chuẩn.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b8-group-before-gap` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B8-1` — một entry đúng chuẩn

```ts
"ranked-user-list": {
    classes: ["overflow-hidden", "divide-y", "divide-separator", "p-0", ...],
    children: { user: { composite: "ranked-user-row", repeats: true, restingCount: 5 } },
    why: "Ranked identities are comparable peers in one joined list, so rank, identity, points and row action align across the board.",
}
```

Cấu trúc, khoảng cách và lý do trong cùng một chỗ.

---

## `B8-2` — hình dạng bị bác

| Bị bác | Thay bằng | Vì sao |
|---|---|---|
| Một `gap-1` phẳng cho giá, ghi chú và cảnh báo | `gap-1` lồng trong `gap-2` | cảnh báo không cùng nhóm ý nghĩ với phép tính giá |
| Một `gap-2` hoặc `gap-3` phẳng cho mọi hậu duệ | nhóm copy/actions và nhóm trigger/content tách rõ | khoảng cách theo quan hệ, không theo tiện tay |
| Giữ `gap-4` vì "contract đang ghi vậy" | `gap-2` cho hai lưới card gọn | contract là belief có thể cũ |

---

## `B8-4` — hai ý, một mặt phẳng

Hai card lồng cho *mua* và *học thử* bị bác; thay bằng hai nhóm ngữ nghĩa có tên trong cùng một
`SurfaceCard`. Xem [`b1`](../b1-one-surface-owner/INDEX.md) cho vế mặt phẳng của cùng phán quyết.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "chật quá, thu lại đi" | `B8-3` | đổi bố cục trước, gap sau |
| "hai cái này phải sát nhau hơn" | `B8-1` | nêu quan hệ, rồi mới xuống `gates/principles/gap` |
| "contract ghi `gap-4` rồi mà" | `B8-5` | feedback ràng buộc thắng contract |
| "tách hai phần này bằng hai card" | `B8-4` | hai nhóm có tên, một mặt phẳng |
