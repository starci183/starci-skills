---
id: fe-principles-padding-changelog
title: changelog.md
slug: /gates/principles/padding/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Khoảng đệm trong.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `padding`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: nhóm và hình dạng mô-đun.

- **Chuyển nhóm.** `fe/design/padding/` → `gates/principles/padding/`. Nhóm `design` bị tách làm ba:
  `principles/` giữ các nguyên tắc dựng hình bắt buộc, `senses/` giữ những gì người đọc cảm nhận,
  `governance/` giữ ngoại lệ và tính đồng nhất. Toàn bộ `id` và `slug` đổi theo.
- **Đặt mã tình huống.** Mỗi tình huống mang một mã `PADDING-<rung>`: `PADDING-0`, `PADDING-2`,
  `PADDING-3`, `PADDING-4`, `PADDING-6`. Mã đặt tên cho **tình huống**, class CSS đặt tên cho **giá trị
  khoảng đệm bên trong**; hai thứ không phải một. `PADDING-0` là mã duy nhất có hai thể phát ra — *không khai báo
  class CSS* khi không có ranh giới thật, và `p-0` khi một ranh giới thật uỷ quyền khoảng đệm bên trong cho hàng hoặc cho
  một nội dung phần tử con. Phân biệt này đã có từ `1.01`; bản này chỉ nâng nó từ mục ngoại lệ lên thẳng
  bảng mã, vì đó là chỗ bị viết sai nhiều nhất.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi phần tử hiển thị ra đều rơi vào đúng một mã —
  kể cả lớp bọc trong suốt — và không có kích thước nào nhỏ tới mức được miễn. "Nó chỉ là cái lớp bọc
  thôi mà" nay là một mã có tên, không phải một vùng xám.
- **Gộp `prompt.md` vào `example.md`.** Bảng ánh xạ yêu cầu bằng lời sang class CSS và bảng phân định ranh
  giới nay nằm cùng chỗ với chính những ví dụ mà chúng phân định, thay vì ở một tài liệu riêng mà người
  đọc phải nhớ mở ra. Mô-đun còn **năm** tài liệu; `prompt.md` bị xoá.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với bậc kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống nhưng
  không phải mã này". Thêm các ví dụ **mã lồng mã** — thẻ chứa khối nhấn mạnh, thẻ uỷ quyền cho ảnh rồi
  chứa danh sách uỷ quyền cho hàng, và một trang có cả năm mã — vì luật *một ranh giới, một khoảng đệm bên trong* chỉ nhìn
  thấy được khi các mã nằm lồng nhau.
- **Nói thẳng rằng khoảng đệm trong không đẩy phần tử cùng cấp.** Khoảng cách giữa các phần tử cùng cấp thuộc về `gap` của
  phần tử cha. Luật cũ đã có ý này ở mục Luật; nay nó nằm ngay trong phần Law của `INDEX.md`.
- **Rút mọi ví dụ về `className` thuần.** Bỏ toàn bộ bản xem trước trực tiếp hiển thị bằng thành phần của một sản
  phẩm cụ thể — mười ba khối bản xem trước gắn với kho đăng ký riêng đã bị xoá khỏi `example.md`. Một luật ở
  nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một sản phẩm mới đọc được là
  ví dụ đứng sai chỗ.
- **Giữ nguyên mọi quyết định cũ.** Thang vẫn đóng ở không class CSS, `p-0`, `p-2`, `p-3`, `p-4`, `p-6`.
  Tính đồng nhất trạng thái, bất biến thiết kế đáp ứng, cấm bên sử dụng vá khoảng đệm bên trong của thành phần điều khiển, và yêu cầu vị trí hình học bố cục
  cho cạnh phần tử chồng lớp đều giữ nguyên. Những chỗ còn tranh cãi được ghi vào mục **Rủi ro còn mở** của
  `audit.md` thay vì bị sửa lặng lẽ.

## 1.04 — 2026-08-16

- Làm bộ quy tắc tổng quát, ranh giới-đầu tiên và `className`-đầu tiên.
- Bỏ kho đăng ký riêng, tuyến trang riêng và bằng chứng chuyển đổi gắn với một ứng dụng.
- Đóng đầu ra về: không class CSS, `p-0`, `p-2`, `p-3`, `p-4`, `p-6`.
- Làm bề mặt-in-bề mặt xác định được: mỗi ranh giới thật một khoảng đệm bên trong, lớp bọc trong suốt không có.
- Thay điểm dừng giả bằng một câu hỏi cụ thể về quyền sở hữu hoặc về vị trí.
- Lấy "không phát khoảng đệm trong từ bên sử dụng" làm mặc định công khai khi chưa rõ ai sở hữu ranh giới.
- Viết lại hướng dẫn công khai và ví dụ bằng TSX thường.

## Các phiên bản trước

`1.01`–`1.03` dựng quyền sở hữu ranh giới, uỷ quyền khoảng đệm bên trong trong liền mạch danh sách, khoảng đệm bên trong của ranh giới lồng
nhau, tính đồng nhất trạng thái, và phân biệt giữa bề mặt thông thường với mặt phẳng chính.
