---
id: be-lints-transport-changelog
title: changelog.md
slug: /be/lints/transport/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của shelf cưỡng chế luật cửa vào.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `transport`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Ba loại thay đổi bắt buộc phải tăng phiên bản:

1. Nguồn thêm, bớt hoặc đổi tên một quy tắc.
2. Cơ chế phát hiện của một quy tắc đổi — nút được thăm, cổng chặn, danh sách định danh.
3. **Phát hiện thêm một cửa còn mở.** Một cửa mở được tìm ra mà không ghi lại chính là thất bại mà
   shelf này sinh ra để ngăn: một luật không có quy tắc nào giữ thì ai cũng biết là không được giữ,
   còn một quy tắc thủng thì mọi người tin là kín.

Tên quy tắc là **danh tính** của quy tắc và không bao giờ được viết lại ở đây, kể cả khi tên đó chứa
một từ mà văn xuôi trong cây này không được phép dùng. Tên là chuỗi in ra trong log build.

## 2.00 — 2026-08-16

Tạo mới. Mô-đun này không phát biểu luật cửa vào — luật đã có chỗ của nó — mà ghi lại **phần cưỡng
chế**: máy nhìn thấy gì, nhìn bằng cơ chế nào, và cách viết nào đi lọt.

Các quy tắc được tài liệu hoá xuất xưởng trong gói `@starci/eslint-canon-be`, dưới tiền tố
`starci-be/`.

- **Hai quy tắc, đúng bằng số quy tắc nguồn công bố.** `rest-door-needs-a-reason` và
  `door-lives-in-features`. Cả hai xuất hiện trong `rules` và trong `recommended`, hai danh sách
  khớp nhau, cả hai ở mức `error`.
- **Ánh xạ sang mã luật.** `rest-door-needs-a-reason` giữ `TRANSPORT-2`;
  `door-lives-in-features` giữ `TRANSPORT-3`. `TRANSPORT-1` **không có quy tắc nào giữ** và được ghi
  là ô trống thay vì được gán bừa cho một quy tắc gần đúng.
- **Ghi lại cơ chế phát hiện ở mức node.** Nút `Decorator`, cách lấy tên decorator từ `Identifier`
  hoặc từ callee của `CallExpression`, điều kiện `Literal` chuỗi của `routeOf`, năm phép thử lý do
  theo đúng thứ tự chúng chạy, và cổng chặn đường dẫn `/src/modules/` trả về visitor rỗng.
- **Lập bảng cửa còn mở.** Mười sáu dòng trong bảng **Open** của `INDEX.md`, gom thành mười hai rủi
  ro trong `audit.md`; bảy trong số đó được đề nghị đóng, năm được ghi là không nên hoặc không thể
  đóng bằng một quy tắc đọc một tệp.
- **Nêu tên cửa mở nặng nhất.** Hai phép thử lý do — "byte" và "danh tính vận hành" — so khớp trên
  **văn bản thô của toàn bộ tệp**, nên một chú thích, một import bỏ quên hay một chuỗi trong bảng
  cấu hình biện minh cho mọi `@Controller` trong tệp đó. Cùng cơ chế ấy làm bằng chứng tính theo
  **tệp** chứ không theo **cửa**, nên cửa thứ hai trong một tệp luôn đi nhờ lý do của cửa thứ nhất.
- **Ghi cả chiều báo oan.** `routeOf` chỉ đọc `Literal` chuỗi, nên route viết bằng template literal,
  hằng số hay dạng object `{ path }` mất ba lý do dựa trên route; route khai ở cấp phương thức thì
  không bao giờ được đọc. Một bộ quy tắc chỉ đo bằng số lần bắt được là một bộ quy tắc sắp bị tắt cả
  cụm.
- **Ghi hai chỗ quy tắc lệch khỏi luật.** `door-lives-in-features` **rộng hơn** luật vì cổng chặn
  không loại trừ ứng dụng riêng dưới `apps/`, và **hẹp hơn cái tên của nó** vì nó chỉ nhận
  `@Controller` trong khi luật định nghĩa cửa gồm cả socket gateway và consumer hàng đợi.
- **Năm tài liệu, không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm trong
  `example.md`, cùng chỗ với mã mà chúng phân định.
- **Văn xuôi và ví dụ không mang tên sản phẩm nào.** Tên quy tắc, tên thông điệp, tên decorator, tên
  interceptor và tên gói là **định danh xuất xưởng** và được chép lại nguyên văn; miễn trừ đó không
  phủ thêm bất cứ thứ gì khác.
