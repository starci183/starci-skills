---
id: fe-blocks-laws-b10-state-enumeration-vi
title: vi.md
slug: /gates/blocks/laws/b10-state-enumeration/vi
sidebar_label: vi.md
sidebar_position: 1
description: Cách phân biệt một state với một props, và vì sao liệt kê đủ phải xảy ra trước khi vẽ.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b10-state-enumeration` · Luật: [`INDEX.md`](./INDEX.md)

# Liệt kê đủ trước khi vẽ

Thầy hỏi một câu và câu đó thành luật: *rồi bôi đen thì sao, vô từng bài đọc, làm từng challenges
thì sao??? xác định đủ state chứ*.

Ba tình huống trong câu hỏi đó không phải ba biến thể của một màn hình. Chúng là ba **chỗ đứng khác
nhau** của người dùng, và mỗi chỗ đứng cần một cây khác. Vẽ trước rồi phát hiện sau nghĩa là gắn
thêm cành vào một hình vốn không định giữ chúng.

## Câu hỏi phân biệt

> **Một state là một tình huống chọn một CÂY khác.**

Nếu bốn tình huống vẽ **cùng một cây** và chỉ khác con số, thì chúng là props, và cái duy nhất cần
là một cờ `isLoading`.

Câu hỏi này thường **xoá** state chứ không thêm. Bốn hàng chỉ số trên rail hoá ra không có state
nào: chờ, rỗng, hỏng, xong đều vẽ đúng một hàng, chỉ đổi con số.

## Bảng tra

| Mã | Tình huống | Luật |
|---|---|---|
| `B10-1` | Tình huống vẽ cây khác | là state, và có tên |
| `B10-2` | Nhiều tình huống vẽ cùng cây | là props cộng một `isLoading` |
| `B10-3` | Khối tự chủ dữ liệu | thang settle chạy `failed → pending → empty → ready` |
| `B10-4` | Envelope có thể `undefined` hoặc `null` | `undefined` là chờ, `null` là rỗng |
| `B10-5` | Hai tên cho một việc | chọn tên đồng nghĩa phải có lý do |
| `B10-6` | Người dùng đang làm việc theo bước | state là **máy bước**, không phải thang tải |
| `B10-7` | Máy chủ khai N kết cục | khối liệt kê N **cộng** những tình huống chỉ client mới ở trong được |

## `B10-3` — vì sao lỗi phải đọc trước

```tsx
const state = challenge.error !== undefined && data === undefined
    ? "failed"
    : data === undefined ? "pending" : data === null ? "empty" : "ready"
```

Đọc `pending` trước là cái bẫy im lặng: thư viện fetch thử lại một khoá hỏng theo backoff và mỗi lần
lại báo `isLoading`, nên một hàng chỉ đọc cờ đó sẽ **shimmer vĩnh viễn** chừng nào backend còn chết.

## `B10-7` — cái thứ mười một không ai khai

`JudgeStatusStrip` có mười một tình huống. Chín cái đến từ máy chủ. Cái thứ mười là *chưa gửi gì*.
Cái thứ mười một là **socket đứt**: client điếc trong khi máy chấm vẫn chạy. Nó phải **không** được
đọc như một bài nộp trượt — việc vẫn đang chạy — nên nó nói đúng điều đó và mời đọc lại thay vì nộp
lại.

Không schema backend nào kể cho ai nghe về tình huống thứ mười một. Đó là lý do liệt kê state là
việc của sản phẩm, không phải việc chép kiểu dữ liệu.

## `B10-6` — máy bước không phải thang tải

Đăng nhập có `details | code | done`. Chat có `renaming | archiving`. Thảo luận có `submitting`.
Đây là **bước công việc**, không phải bậc tải, nên chúng không xếp theo thang `failed → pending →
empty → ready` và mỗi nút trong đó mang cờ chờ riêng.

## Hai hình dạng state, cả hai đều hợp lệ

- **Union rời rạc**: mỗi nhánh mang props riêng, nên không thể truyền dữ liệu của tình huống mình
  không ở trong, và không thể bỏ sót dữ liệu của tình huống mình đang ở.
- **Enum phẳng**: một tên trạng thái cộng một object props chung.

Không có luật nào chọn giữa hai. Kế hoạch phải nói mình dùng cái nào.
