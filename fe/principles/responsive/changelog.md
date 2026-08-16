---
id: fe-principles-responsive-changelog
title: changelog.md
slug: /fe/principles/responsive/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Thiết kế đáp ứng.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `responsive`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên. Các mục cũ giữ nguyên.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: nhóm và hình dạng mô-đun.

- **Chuyển nhóm.** `fe/design/responsive/` → `fe/principles/responsive/`. Nhóm `design` bị tách làm
  ba: `principles/` giữ các nguyên tắc dựng hình bắt buộc, `senses/` giữ những gì người đọc cảm nhận,
  `governance/` giữ ngoại lệ và tính đồng nhất. Toàn bộ `id` và `slug` đổi theo nhóm mới; không còn tiền tố
  hay đường dẫn của nhóm cũ nào sống sót trong mô-đun này.
- **Đặt mã tình huống.** Tập phép biến đổi vốn đã đóng nay mang tên: `RESPONSIVE-1` (không đổi gì),
  `RESPONSIVE-2` (xuống dòng), `RESPONSIVE-3` (đổi trục), `RESPONSIVE-4` (lưới thiết kế đáp ứng), `RESPONSIVE-5`
  (cuộn ngang có biên), `RESPONSIVE-6` (cặp khả năng hiển thị). Đánh số theo mức xâm lấn tăng dần, cũng là
  thứ tự người đọc gặp. Mã đặt tên cho **tình huống**, class CSS đặt tên cho **phép biến đổi**; hai thứ
  không phải một, và `RESPONSIVE-1` không phát ra class CSS nào.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi vùng hiển thị ra đều rơi vào đúng một mã, kể
  cả vùng không cần class CSS nào, và không có kích thước nào nhỏ tới mức được miễn. `RESPONSIVE-1` từ chỗ
  là "trường hợp mặc định" trở thành một quyết định phải bảo vệ được, kèm lệnh cấm điểm ngắt rỗng —
  `sm:flex-row` trên thứ vốn đã là hàng, `lg:grid-cols-3` trên lưới vốn đã ba cột.
- **Gộp `prompt.md` vào `example.md`.** Mười tám yêu cầu bằng lời, mười bảy đáp án xác định và một câu
  hỏi có bảo vệ nay nằm cùng chỗ với các ví dụ mà chúng phân định, cùng bảng phân định ranh giới.
  Mô-đun còn năm tài liệu.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với từng mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống nhưng
  không phải mã này". Thêm ba ví dụ **mã lồng mã** để nói rõ luật *một chủ sở hữu, một quan hệ hình học* —
  trong đó ví dụ `RESPONSIVE-6` bọc `RESPONSIVE-4` phơi ra một lỗi chưa từng được ghi: ngưỡng lưới
  thuộc về **vùng chứa**, không thuộc về khung nhìn.
- **Rút mọi ví dụ về `className` thuần và bỏ bản xem trước trực tiếp.** Sáu ID hiển thị của phiên bản `1.02`
  (`responsive-course-sections`, `responsive-filter-region`, `responsive-enrollment-actions`,
  `responsive-review-evidence`, `responsive-long-copy`, `responsive-state-matrix`) và mọi thẻ bản xem trước
  gắn với kho đăng ký của một sản phẩm cụ thể **bị gỡ khỏi luật**. Một luật ở nhóm này phải đúng với bất
  kỳ giao diện nào; bằng chứng thị giác chỉ chạy được trong một kho mã nguồn là bằng chứng đứng sai chỗ.
- **Ghi rõ chuyện `min-w-0`.** Bổ sung ngoại lệ: chữ tràn được sửa trong chính ô của nó trước khi bất
  kỳ mã nào trên `RESPONSIVE-1` được xét, vì phần tử con flex mặc định không co nhỏ hơn nội dung của nó —
  rất nhiều "vỡ ở màn hẹp" là thiếu `min-w-0` chứ không phải thiếu điểm ngắt.
- **Giữ nguyên mọi quyết định luật cũ.** Ưu tiên kiểu cơ sở, ngưỡng phải đo, cấm `order-*` theo điểm ngắt,
  chủ sở hữu sở hữu điểm ngắt, không giấu nội dung thiết yếu, `min-w-max` thay cho số cứng, tính đồng nhất trạng
  thái, và quy ước dùng `text-muted-foreground` cho sao chép phụ. Phản đối với quy ước màu này được ghi ở
  mục **Rủi ro còn mở** của `audit.md` thay vì được sửa im lặng.

## 1.03 — 2026-08-16

### Đã thêm
- Thêm `prompt.md` với 18 trường hợp biên dịch yêu cầu thuần văn bản.
- Thêm một câu hỏi có điều kiện cho yêu cầu rõ ràng về phép biến đổi không mặc định nhưng chưa có bằng chứng lỗi.

### Đã thay đổi
- Chuẩn hoá các ví dụ đầu ra có văn bản giảm nhấn về `text-muted-foreground`.
- Viết lại bộ quy tắc thành các phép biến đổi tổng quát, ưu tiên className.
- Giới hạn đầu ra ở xuống dòng, đổi giữa hàng và cụm xếp dọc, lưới, tràn có giới hạn, cặp hiển thị và không thay đổi.
- Bỏ tên tuyến trang, tên sản phẩm và hướng dẫn chọn điểm ngắt theo thiết bị.
- Lấy bố cục cơ sở ưu tiên thiết bị di động, không thêm điểm ngắt, làm mặc định công khai khi nội dung chưa hỏng.
- Thay chiều rộng tối thiểu riêng tư hoặc ghi cứng cho dữ liệu ngang bằng phần tử cha có giới hạn
  `max-w-full overflow-x-auto` và phần tử con hoặc bảng có chiều rộng nội tại `min-w-max`.
- Thay năm đầu ra cần làm rõ bằng các mặc định an toàn, xác định: giữ nguyên bố cục cơ sở,
  một cột, nội dung hiển thị và thứ tự DOM.

### Phản biện các quyết định
- Giữ nguyên cả sáu ID hiển thị hiện có.
- Giữ một thứ tự nguồn, thứ tự đọc và thứ tự lấy tiêu điểm ở mọi chiều rộng và trạng thái.
- Chỉ giữ cơ chế làm rõ bằng một câu hỏi trong prompt và audit cho phép biến đổi không mặc định được yêu cầu rõ ràng.

### Xác minh
- Sáu tệp cùng mang phiên bản `1.03`.
- Các trường hợp yêu cầu thuần văn bản không chứa đáp án JSX trong phần mô tả yêu cầu.

## 1.02 — 2026-08-16
- Thêm sáu bộ hiển thị thiết kế đáp ứng trực tiếp và xác minh việc tích hợp với kho đăng ký và bản dựng.

## 1.01 — 2026-08-16
- Bổ sung hướng dẫn về tính đồng nhất ngữ nghĩa, quyền sở hữu thiết kế đáp ứng và đường thay thế.
