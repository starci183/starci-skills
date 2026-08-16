---
id: fe-lints-file-layout-changelog
title: changelog.md
slug: /gates/lints/file-layout/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thực thi file-layout.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `file-layout`

## Quy ước phiên bản

Tăng cả năm tài liệu thêm `0.01` khi một luật lint đổi hành vi, khi một luật được thêm vào hoặc bỏ
khỏi mã nguồn, hoặc khi một cửa lách chuyển giữa bảng **Closed** và bảng **Open**. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc của mô-đun hoặc của nhóm mà nó nằm trên.

Mô-đun này mô tả **thực thi**, nên nguồn sự thật của nó không phải một cuộc thảo luận mà là một file
mã. Khi mã nguồn và tài liệu này lệch nhau, mã nguồn thắng và tài liệu này phải tăng phiên bản.

## 2.00 — 2026-08-16

Dựng mới. Mô-đun này ra đời để ghi lại **thực thi**, tách hẳn khỏi tài liệu luật: luật nói nên đặt
file ở đâu, mô-đun này nói máy nhìn thấy được bao nhiêu phần của điều đó.

- **Nguồn.** Sáu luật lint publish trong `sources/fe/file-layout.mjs`, đóng gói trong
  `@starci/eslint-canon-fe`. Tài liệu này đọc bảng `export const rules` làm nguồn sự thật, không đọc
  phần chú thích đầu file — vốn còn nói "bốn luật" và đã được ghi thành một `Finding`.

- **Sáu luật được ghi hồ sơ**, mỗi luật giữ đúng một mã:
  `surface-folder-two-files-only` (`FILE-2`), `route-tree-holds-routes-only` (`FILE-6`),
  `no-helper-folder-in-components` (`FILE-3`), `export-matches-folder` (`FILE-1`),
  `no-runtime-namespace` (`FILE-4`), `monorepo-tier-belongs-to-its-side` (`FILE-5`).
  Ánh xạ một-đối-một, không mã nào thiếu máy giữ và không luật nào không neo vào một mã.

- **Danh tính là tên đã publish.** Không đặt mã số riêng cho luật lint. Tên là chuỗi mà bản dựng in
  ra, mà một comment tắt luật gọi tên, và mà mọi báo cáo lỗi dùng tới; đặt thêm một định danh thứ hai
  là tạo ra một luật có hai tên và không cách nào biết thông điệp đến từ tên nào. Tên luật được chép
  nguyên văn, kể cả khi trong đó có một từ thuộc về một sản phẩm.

- **Bảng `Detection`.** Ghi cơ chế thật của từng luật — biểu thức trên `context.filename`, loại nút
  AST, danh sách tên khe của khung nền, thứ tự các cổng miễn trừ. Đây là phần làm cho bảng kế tiếp
  viết được.

- **Bảng `Escape Hatches`, hai nửa.** **Closed**: chín cách viết mà người đọc có thể tưởng là lách
  được, kèm lý do chúng vẫn đỏ. **Open**: **34 cửa còn mở**, mỗi cửa kèm mã hoặc cây thư mục cụ thể
  — 6 cho luật thư mục màn hình, 6 cho luật định tuyến, 4 cho luật thư mục tiện ích, 6 cho luật khớp
  tên export, 8 cho luật namespace, 4 cho luật monorepo. Không dòng nào ghi "không có".

- **Mọi kết luận đều được chạy thật.** Từng cửa lách được kiểm bằng chính các luật lint đó trước khi
  viết ra, không suy ra từ tên luật. Ba luật hoá ra có hành vi khác điều tên gọi hoặc phần mô tả của
  chúng gợi ra, và cả ba đã vào phần `Findings` của `audit.md`.

- **`audit.md` ghi 11 `Finding`** và, ở phần `Rủi ro còn mở`, nêu với từng cửa xem luật lint sẽ phải
  soi thêm cái gì mới đóng được — hoặc vì sao đóng nó đắt hơn để mở. Bốn cửa đóng được bằng một dòng
  sửa; một cửa có lẽ không đóng được bằng máy, và điều đó được nói ra thay vì để người đọc tưởng luật
  đã kín.

- **`example.md` viết bằng mã thật**, 53 khối mã: mỗi luật vài cặp SAI/ĐÚNG, rồi một mục
  **Chỗ lách và chỗ dễ nhầm** mang đúng đoạn mã lọt qua — dán nhãn rõ là **thứ luật không thấy**, không
  phải thứ được phép viết.

- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cuối
  `example.md`, cạnh chính những ví dụ mà chúng phân định.

- **Không tên sản phẩm trong văn xuôi và ví dụ.** Mọi đường dẫn, thành phần và `className` trong tài
  liệu này là thứ đọc được ở bất kỳ giao diện nào. Ngoại lệ duy nhất là những định danh thật sự được
  publish: tên luật, `messageId`, và tên gói `@starci/eslint-canon-fe`.
