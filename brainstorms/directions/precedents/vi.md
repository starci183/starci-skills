---
title: Tiền lệ direction
---

# Tiền lệ direction

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@direction-precedent-schema` | `brainstorms/directions/precedents/schema.json` | file | Defines the accepted and rejected evidence this module returns. |

Đầu vào là các hướng thị giác đã được chấp nhận của một project, và đầu ra là tiền lệ, nếu có, mà mỗi
candidate mới đang trả lời, cùng khác biệt đáng kể giữa chúng. Tiền lệ là bằng chứng về gu của sản phẩm
này. Nó không phải kho style dùng chung.

## Luật

Chỉ đọc tiền lệ của project do workspace route đã xác minh khai ra. Direction đã duyệt của sản phẩm
khác là cảm hứng, không phải tiền lệ. Giữ các phương án bị từ chối cùng lý do của người chủ: chính cái
thua ngăn một direction không mong muốn quay lại dưới tên mới.

## Tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `DIRECTION-PRECEDENT-0` | chưa có direction nào được chấp nhận | mọi candidate trích `none` |
| `DIRECTION-PRECEDENT-1` | cùng đối tượng, tác vụ và cảm giác dự kiến lặp lại | trích tiền lệ và nói các vai trò không đổi |
| `DIRECTION-PRECEDENT-2` | nhu cầu giao nhau nhưng một hay nhiều trục khác | trích tiền lệ và nói delta của trục |
| `DIRECTION-PRECEDENT-3` | token được trích không còn tồn tại | đánh dấu stale; không bắt chước |
| `DIRECTION-PRECEDENT-4` | một candidate hợp lệ cố tình rời đi | trích `none` và nói lý do |
| `DIRECTION-PRECEDENT-5` | người chủ đảo direction đã chấp nhận | đánh dấu overruled và giữ cả hai quyết định |

## Quy tắc

1. Mỗi tiền lệ chỉ thuộc một project.
2. So lý do trước tên hay screenshot.
3. Kiểm mọi token dùng lại với kiểm kê hiện tại.
4. Ghi layout hash làm lựa chọn trở thành bền vững, bộ trục bị từ chối và lý do của người chủ.
5. Không xoá bằng chứng stale hay overruled; thay nó bằng một hậu thân có tên.
6. Có ít nhất một candidate rời đi khi tiền lệ tồn tại.

## Đầu ra

Một bản ghi khớp `@direction-precedent-schema`, với direction đã chấp nhận được tham chiếu từ schema
cha thay vì chép lại ở đây.

## Phạm vi

Mô-đun này quyết định cách trích một quyết định thị giác trước đó. Nó không chọn direction mới hay giữ
tiền lệ trong cây quy tắc dùng chung; bản ghi đã chấp nhận thuộc registry của project.
