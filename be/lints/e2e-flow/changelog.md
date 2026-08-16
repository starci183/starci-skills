---
id: be-lints-e2e-flow-changelog
title: changelog.md
slug: /be/lints/e2e-flow/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thực thi luật luồng e2e.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `e2e-flow`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc kệ mà nó nằm trên.

Với kệ thực thi này, những thứ sau đều là thay đổi phải ghi:

- Một luật được thêm, bớt hoặc **đổi tên** trong bảng `rules` xuất ra. Đổi tên là thay đổi danh tính,
  vì tên chính là chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật.
- Một cửa còn mở được đóng lại, hoặc một cửa mới bị phát hiện. Bảng **Open** và bảng **Closed** trong
  `INDEX.md` phải đổi cùng nhau.
- `schema` của một luật thôi rỗng, hoặc cổng tệp được chuyển ra cấu hình của kho tiêu thụ. Cả hai đều
  đổi phạm vi thực thi mà không đổi một dòng nào trong phần phát hiện.
- Ánh xạ giữa một luật và một mã trong văn bản luật thay đổi, hoặc một luật bắt đầu giữ thêm nửa còn
  lại của mã nó đang giữ.

## 2.00 — 2026-08-16

Lập mô-đun. Đây là hồ sơ **thực thi** đầu tiên của luật luồng e2e: nó không chép lại luật, mà ghi lại
máy nhìn thấy gì và không nhìn thấy gì. Các luật được ghi ở đây đóng gói trong
`@starci/eslint-canon-be`.

- **Ghi năm luật, đúng bằng số mà mô-đun luật công bố.** Đếm từ bảng `rules` xuất ra:
  `e2e-uses-production-transport`, `e2e-asserts-persisted-state`, `no-model-call-in-e2e`,
  `no-sleep-in-flow`, `no-branch-in-flow-step`. Con số này cũng khớp với con số mà chính văn bản luật
  tự nhận — "năm trong mười hai" — nên không có chênh lệch nào phải giải trình.
- **Danh tính là tên công bố.** Không đặt số cho luật nào. Tiêu đề mỗi mục là tên luật, nguyên văn, kể
  cả khi tên ấy mang một chữ viết tắt của sản phẩm: đó là chuỗi bản build in ra.
- **Ánh xạ mã: năm trên năm.** `E2E-11` (nửa "gọi thẳng diễn viên nội bộ"), `E2E-4` (nửa "đọc lại
  trạng thái đã lưu"), `E2E-12` (nửa "nhập gói nhà cung cấp"), `E2E-3` (nửa "đừng ngủ") và `E2E-7`.
  Không luật nào trên kệ thực thi một quyết định chưa được viết ra, và không mã nào bị bịa ra để khớp
  với một luật.
- **Bảng Detection viết theo nút cú pháp thật**, không viết theo tên luật: nút được duyệt, thuộc tính
  được đọc, biểu thức chính quy được thử, và cổng tệp quyết định luật có được lắp hay không.
- **Bảng Escape Hatches tách làm hai.** Bảng **Closed** ghi mười cách viết trông như sẽ lọt mà không
  lọt. Bảng **Open** ghi **hai mươi tám** cửa còn mở thật, trải trên cả năm luật cộng hai cửa dùng
  chung cho toàn kệ — không luật nào được ghi "không có".
- **Ghi năm khoảng cách giữa tên luật và cơ chế.** `e2e-uses-production-transport` cấm thẳng hai tên
  phương thức mà không nhìn bên nhận; `e2e-asserts-persisted-state` kiểm một lần **nhắc tên** chứ
  không kiểm một phép khẳng định; `no-model-call-in-e2e` phát hiện một câu **nhập** chứ không phát
  hiện một lời **gọi**; `no-sleep-in-flow` giữ nửa "đừng ngủ" và bỏ nửa "có hạn chót"; và
  `no-branch-in-flow-step` định nghĩa "bước" theo văn bản, nên một nhánh trong hàm trợ giúp nằm ngoài.
- **Ghi một mâu thuẫn thật giữa hai luật trên cùng một dòng.** Phép đọc trạng thái thông thường của
  thư viện lưu trữ kết thúc bằng `.execute()`: `e2e-asserts-persisted-state` đòi nó,
  `e2e-uses-production-transport` báo nó. Đây là mâu thuẫn giữa **luật và luật**, và nó được ghi thành
  phát hiện chứ không làm gọn thành một dòng ngoại lệ.
- **Ghi hai chỗ báo thừa nơi không có lối thoát nào**: `import type` từ một gói nhà cung cấp, và một
  `new Promise` chỉ *nhắc tới* `setTimeout` trong một dòng chú thích. Cái giá của phép thử thuần cú
  pháp, và nó rơi trúng người đang làm đúng.
- **Ghi một thứ thực thi thật nhưng không phải luật lint.** Bài kiểm thử sinh đôi của mô-đun khẳng
  định một danh sách tên luồng nghiệp vụ phải tồn tại thành tệp, đúng đuôi `.e2e-spec.ts`. Nó đóng
  một phần cửa mở rộng nhất trên kệ, nhưng nó là một bài kiểm thử chứ không phải một luật, nên nó
  không được ghi thành luật thứ sáu — chỉ được ghi làm chú thích cho cửa ấy.
- **Ghi rõ mô-đun này không có miễn trừ theo tệp, allow-list hay thư mục được tha.** Ba miễn trừ duy
  nhất nằm bên trong từng luật, và một trong ba — bỏ qua lời gọi thành viên bằng ngoặc vuông — không
  được lập luận ở đâu.
- **`example.md` viết bằng mã thật**, năm mươi khối mã, mỗi luật nhiều cặp SAI/ĐÚNG, và mỗi luật có
  một mục mang mã đi lọt — có dán nhãn rõ đó là chỗ luật **không nhìn thấy**, không phải cách viết
  được phép.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cuối
  `example.md`, cạnh chính những ví dụ mà chúng phân định.
