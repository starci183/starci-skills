---
id: fe-blocks-laws-b5-no-invented-field-example
title: example.md
slug: /gates/blocks/laws/b5-no-invented-field/example
sidebar_label: example.md
sidebar_position: 2
description: Vi phạm sống duy nhất của B5, và bốn hình dạng bịa field đã bị bác trong kho.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b5-no-invented-field` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B5-2` — vi phạm sống

```tsx
export type StarCiAiFabData = {
    readonly label: string
    readonly isOpen: boolean
    readonly hasUnread?: boolean
}
```

```tsx
badge: input.props.hasUnread === true
    ? defineLeafComponent("badge", {}, () => <Badge props={{ content: "1", tone: "accent" }} />)
    : undefined,
```

Kiểu nói `có hay không`. Màn hình nói `một`.

---

## `B5-1` — bốn hình dạng đã bị bác

| Hình dạng | Chỗ | Vì sao bị bác |
|---|---|---|
| Một dòng "Career track · Fullstack engineering" gõ thẳng | trang chi tiết khoá | backend không phục vụ dữ kiện đó cho mọi khoá |
| Badge `5` mượn của legacy trên menu tài khoản | shell | không có bằng chứng FE hay backend nào có count |
| "Khoá học phổ biến" ở trạng thái rỗng của tìm kiếm | overlay | không có producer công khai chứng minh thứ tự phổ biến |
| Badge `verified` trên từng gạch đầu dòng của CV | CV | editor chưa lưu nguồn dẫn chứng, badge sẽ nói quá contract |

Bốn cái khác nhau về bề ngoài, giống nhau về cấu trúc: màn hình khẳng định nhiều hơn dữ liệu.

---

## `B5-4` — lấy về mà không vẽ

`DailyQuest` lấy về `date` và không vẽ. Cách đọc đúng: đó là một field thừa trong query. Cách đọc
sai — đã xảy ra trong một bản dựng mù — là coi nó như một trục còn thiếu và dựng thêm một state
`ngay-da-lat` cho nó.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "thêm badge số tin chưa đọc" | `B5-2` | hỏi producer trước; boolean thì vẽ dấu hiệu không số |
| "ghi thêm lộ trình nghề cho khoá này" | `B5-1` | không có producer thì không vẽ |
| "hiện khoá phổ biến khi chưa gõ gì" | `B5-1` | không có thứ tự phổ biến công khai |
| "thêm dòng 3/5 việc đã xong" | `B5-5` | suy ra được, nhưng vẫn phải quyết như một câu mới |
| "sao query có `date` mà không hiện?" | `B5-4` | bỏ khỏi query, đừng dựng state cho nó |
