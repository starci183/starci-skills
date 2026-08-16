---
id: fe-blocks-laws-b4-empty-is-a-state-vi
title: vi.md
slug: /gates/blocks/laws/b4-empty-is-a-state/vi
sidebar_label: vi.md
sidebar_position: 1
description: Rỗng là một câu trả lời của sản phẩm; khi nào khối được phép biến mất và khi nào không.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b4-empty-is-a-state` · Luật: [`INDEX.md`](./INDEX.md)

# Rỗng là một trạng thái

Khi danh sách không có gì, sản phẩm vẫn đang **trả lời**. Câu trả lời đó là "chưa có gì", và nó phải
được nói ra ở đúng chỗ mà nội dung sẽ xuất hiện, dưới đúng cái tên mà khối vẫn mang.

Giấu cả vùng đi là đổi câu trả lời thành sự im lặng. Người đọc không phân biệt được "chưa có gì" với
"trang này hỏng" hay "mình nhìn nhầm chỗ".

## Bảng tra

| Mã | Tình huống | Vẽ gì |
|---|---|---|
| `B4-1` | Đã trả lời, tập rỗng | vỏ của khối, giữ nguyên nhãn, `EmptyNotice` bên trong |
| `B4-2` | Hỏng | cùng vỏ đó, **cộng** nút thử lại |
| `B4-3` | Chưa trả lời | cây sẵn sàng với `isLoading`, **không** phải notice rỗng |
| `B4-4` | Khối vô nghĩa với người xem này | trả `null`, và docstring ghi rõ vì sao |
| `B4-5` | Giấu vùng vì danh sách rỗng | bị bác |
| `B4-6` | Nhét câu rỗng vào danh sách như một hàng | bị bác |
| `B4-7` | Một điều khiển trỏ vào tập không thể tồn tại | bị bác — bỏ điều khiển |

## `undefined` khác `null`

Đây là chỗ sai nhiều nhất và nó nằm ở tầng envelope, không ở tầng giao diện:

- `undefined` — **chưa** trả lời → `B4-3`, pending.
- `null` hoặc mảng rỗng — **đã** trả lời, và câu trả lời là không có gì → `B4-1`.

Trộn hai cái vào nhau làm notice rỗng nhấp nháy trong mỗi lần tải bình thường. Có một bài test khoá
đúng chuyện này trên mười ba khối dashboard: khi khoá request chưa giải, phải có `[data-loading="true"]`
và **không** được có `EmptyNotice`.

## Rỗng khác lỗi

Hai nhánh, không phải một câu hai lời:

- Rỗng: một phát biểu, **không** nút. Không có gì để thử lại — máy chủ đã trả lời rồi.
- Lỗi: cùng vỏ, cùng chỗ, **có** nút đọc lại.

## Khi nào khối được biến mất

Đúng một trường hợp: khi cả khối vô nghĩa với người xem này, và lý do được **viết ra**. Bốn hàng
danh tính trên rail trả `null` khi người đọc chưa đăng nhập, và mỗi khối ghi rõ điều đó trong
docstring. Chính câu ghi ấy làm chúng thành `B4-4` chứ không phải vi phạm.

Chín khối đang trả `null` ở một trạng thái đã settle. Bốn khối có lý do viết ra. Năm khối còn lại —
các khối dùng tên state `hidden` — thì không, và cho tới khi có lý do, chúng là `B4-5`.

## Hình dạng bị bác nặng nhất

Nhóm sáu ô ở tab tổng quan hồ sơ gộp rỗng và lỗi thành **một** chuỗi rồi nhét vào danh sách như một
**hàng giả** mang `globalId: 'state'`. Kết quả: câu "chưa có gì" được đọc bằng đúng văn phạm của một
dòng dữ liệu thật — cùng khoảng đệm, cùng đường phân cách, cùng cách quét mắt. Người đọc không có
cách nào biết đó không phải một khoá học tên là "chưa có gì".
