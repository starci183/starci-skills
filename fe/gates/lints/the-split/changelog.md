---
id: fe-lints-the-split-changelog
title: changelog.md
slug: /gates/lints/the-split/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thực thi the split.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `the-split`

## Quy ước phiên bản

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Ở giá này, "một thay đổi" nghĩa là: một luật được thêm hoặc bỏ, một cơ chế phát hiện đổi, hoặc một cửa
còn mở được đóng hay được phát hiện. **Đổi tên một luật không phải một thay đổi nhỏ** — tên là danh
tính, và nó đã nằm trong mọi build log cùng mọi dòng comment tắt luật đang tồn tại.

## 2.00 — 2026-08-16

Dựng mới. Mô-đun này ra đời để ghi lại **mức thực thi**, không phải để nhắc lại luật: `principles/` và
`patterns/` nói luật là gì, còn kệ này nói máy nhìn thấy được đến đâu — và, phần không ai chịu viết,
máy **không** nhìn thấy cái gì.

- **Phủ hai luật, đúng bằng số luật tệp nguồn xuất ra.** `presentational-purity` và
  `connected-block-has-presentational-twin`. Không tài liệu hoá luật nào chưa tồn tại: một luật không
  chỉ tay vào được là một đề xuất, không phải một luật.
- **Danh tính là tên đã công bố.** Không đặt mã số cho luật. Tiêu đề mục là tên luật, đúng từng ký tự,
  vì đó là chuỗi hiện ra trong build log, trong dòng tắt luật và trong mọi cuộc trao đổi về lần đỏ đó.
- **Ánh xạ đủ hai mã.** `presentational-purity` giữ `SPLIT-1`; `connected-block-has-presentational-twin`
  giữ `SPLIT-5`. Không luật nào lơ lửng ngoài văn bản luật, và bốn mã còn lại — `SPLIT-2`, `SPLIT-3`,
  `SPLIT-4`, `SPLIT-6` — được ghi thẳng là **chưa có máy giữ**.
- **Ghi cơ chế phát hiện ở mức đọc được từ mã nguồn.** Biểu thức chính quy phạm vi, loại node AST,
  điều kiện `Identifier`, ba bộ thu và một điểm quyết ở `Program:exit`.
- **Kê 13 cửa còn mở** ở bảng Open của `INDEX.md`, cùng 8 lối viết đã đóng ở bảng Closed. Cửa lớn nhất
  là điểm hỏng chung: hai luật dùng chung một bộ dò thế giới, nên một hàm bọc mang tên bình thường hạ
  cả hai cùng lúc.
- **Công bố hai chỗ tên luật hứa nhiều hơn hành vi.** `connected-block-has-presentational-twin` không
  mở tệp bản sao ra xem lần nào — nó quyết bằng một cái tên; và "purity" ở luật kia nghĩa là "không gọi
  bốn họ tên hàm", không phải thuần khiết theo nghĩa hàm.
- **`audit.md` kê từng cửa mở kèm cái luật sẽ phải nhìn thêm để đóng**, hoặc lý do đóng đắt hơn để mở.
  Ghi kèm nhận định rằng `SPLIT-6` là mã duy nhất trong bốn mã còn thiếu mà bộ dò hiện có đã đủ dữ kiện
  để giữ.
- **Gộp `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với ví dụ mà chúng phân
  định. Mô-đun đúng năm tài liệu.
- **Ví dụ không mang tên sản phẩm.** Chỉ còn tên luật, mã thông điệp và tiền tố plugin — những chuỗi
  thật sự xuất xưởng — được giữ nguyên văn.

Hai luật này xuất xưởng trong gói `@starci/eslint-canon-fe`, dưới tiền tố `starci-fe/`, và
`export const recommended` của tệp nguồn đặt cả hai ở mức `error`. Cả hai khai báo `schema: []`: kho mã
tiêu thụ không có núm nào ngoài mức nghiêm trọng.
