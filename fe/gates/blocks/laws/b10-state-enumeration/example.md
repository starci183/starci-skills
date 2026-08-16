---
id: fe-blocks-laws-b10-state-enumeration-example
title: example.md
slug: /gates/blocks/laws/b10-state-enumeration/example
sidebar_label: example.md
sidebar_position: 2
description: Ba bộ state thật, và cách câu hỏi phân biệt xoá bớt state thay vì thêm.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b10-state-enumeration` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B10-2` — câu hỏi xoá state

```tsx
/**
 * IT HAS NO `state`, AND THAT IS THE MODEL WORKING RATHER THAN AN OMISSION. A state is a situation
 * that picks a different TREE. Loading, empty, failed and ready all draw the same row here - only
 * the figure changes - so none of them is a state. They are props, and the one flag is `isLoading`.
 */
```

Bốn tình huống, một cây, không state nào.

---

## `B10-1` — sáu state thật

`DailyQuest`: `pending | empty | failed | open | claimable | claimed`. Ba cái cuối là nghiệp vụ, và
chúng vẽ ba cây khác nhau: không nút, có nút nhận, có badge đã nhận.

---

## `B10-7` — mười một tình huống

```tsx
export type JudgeVerdictState =
    | "idle" | "pending" | "judging" | "accepted" | "wrongAnswer"
    | "timeLimitExceeded" | "memoryLimitExceeded" | "runtimeError"
    | "compileError" | "internalError" | "socket-lost"
```

---

## Từ vựng state đang dùng

Mười lăm literal qua hai mươi tám union: `pending`, `empty`, `settled`, `ready`, `failed`, `hidden`,
`guest`, `signedIn`, `onboarding`, `open`, `claimed`, `claimable`, `details`, `code`, `done`.

Hai cặp đồng nghĩa: `settled`/`ready` và `empty`/`hidden`. Gate bắt khai lý do khi chọn `settled`
hoặc `hidden`.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "thêm trạng thái đang tải" | `B10-2` | hỏi trước: nó có vẽ cây khác không |
| "backend trả 9 verdict" | `B10-7` | 9 chưa đủ; hỏi client còn ở đâu được nữa |
| "lỗi thì hiện gì?" | `B10-3` | đọc lỗi ở bậc đầu tiên của thang |
| "OTP là một state à?" | `B10-6` | là một bước, và bước có máy bước riêng |
