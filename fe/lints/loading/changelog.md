---
id: fe-lints-loading-changelog
title: changelog.md
slug: /fe/lints/loading/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thi hành luật loading.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `loading`

## Version Policy

Tăng cả **năm** tài liệu thêm `0.01` khi:

- một quy tắc được thêm, bị bỏ, hoặc đổi tên trong `export const rules`;
- một quy tắc đổi thứ nó phát hiện, đổi `messageId`, hoặc đổi mức nghiêm trọng mà plugin đề nghị;
- một **cửa còn mở** được đóng lại;
- một **cửa còn mở mới** được phát hiện và ghi vào tài liệu.

Trường hợp cuối cần nói rõ, vì dễ bị coi là "chỉ sửa tài liệu": lỗ hổng đã tồn tại từ trước khi được
viết ra, nhưng cái mà kệ tài liệu này bán là **hiểu biết về vùng mù**, nên hiểu biết đổi thì phiên
bản đổi. Một lỗ hổng chưa biết nguy hiểm hơn một luật không có quy tắc nào: luật không có quy tắc thì
ai cũng biết là không được giữ, còn một quy tắc rò rỉ thì bị tin là đã đóng.

Đổi số chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Quy tắc được đóng gói và phát hành trong `@starci/eslint-canon-fe`; tên quy tắc xuất hiện trong nhật
ký build dưới tiền tố `starci-fe/`.

## 2.00 — 2026-08-16

Tạo mới. Mô-đun này ghi **phần thi hành** của luật `loading`, không ghi lại luật.

- **Ghi ba quy tắc**, đúng bằng số mà `sources/fe/loading.mjs` công bố trong `export const rules`:
  `no-resting-twin-component`, `no-placeholder-prop`, `no-resting-branch-at-call-site`. Không quy tắc
  nào được suy ra, không quy tắc nào được ghi vì "đáng lẽ nên có".
- **Ánh xạ mã luật: hai trên bảy.** Hai quy tắc đầu giữ `LOADING-1` (một bản sao khai báo thành tệp,
  và một bản sao trao vào từ ngoài). Quy tắc thứ ba giữ `LOADING-2`. `LOADING-3` tới `LOADING-7`
  **không có quy tắc nào**, và điều đó được nói thẳng ở `INDEX.md` thay vì bịa một ánh xạ cho bảng
  trông cho đầy.
- **Danh tính là tên công bố.** Không đặt mã số riêng cho quy tắc; tiêu đề mục là tên quy tắc, chép
  nguyên văn. Tên định danh có chứa tên sản phẩm vẫn giữ nguyên vì đó là chuỗi mà bản dựng in ra;
  lệnh cấm tên sản phẩm chỉ áp vào phần văn xuôi và ví dụ.
- **Ghi bảng cửa đóng và cửa mở.** Cửa đóng có 10 hàng. **Cửa mở có 19 hàng**, mỗi quy tắc ít nhất
  ba hàng, tất cả đọc ra từ mã chứ không phải suy đoán. Bốn cửa nặng nhất: phạm vi chỉ là một phép
  kiểm tra chuỗi con trên đường dẫn; quy tắc bản sao chỉ nhìn **tên tệp** chứ chưa từng đọc khai báo;
  một hằng số trung gian rửa sạch phần tử JSX khỏi tầm nhìn của quy tắc prop; và quy tắc nhánh so
  **tên thẻ gốc** chứ không so cây, nên `div` đối đầu `div` đi lọt.
- **Ghi bốn chỗ hành vi thật lệch khỏi cái tên hoặc cái ý định.** `no-placeholder-prop` có một nửa là
  quy tắc nhập chứ không phải quy tắc prop; `no-resting-twin-component` báo cả tệp nguyên thuỷ tên
  trần `Skeleton` mà quy tắc kia cố ý miễn; phần mở rộng `.ts` cũng khớp nên một tệp chỉ chứa kiểu
  vẫn bị gọi là bản sao; và `fallback` trùng tên prop dành riêng của ranh giới tải chậm.
- **Ghi chỗ mờ về ánh xạ** của quy tắc nhánh: dấu phân mục trong nguồn ghi `LOADING-2`, câu tiêu đề
  của `LOADING-1` cũng mô tả đúng tội đó. Theo nguồn, ghi chỗ mờ, không tự chọn lại.
- **`example.md` có 45 khối mã**, mỗi quy tắc nhiều cặp **SAI**/**ĐÚNG**, kèm một mục riêng mang mã
  **lọt qua** — dán nhãn rõ là lỗ hổng, không phải cách viết được phép.
- **Năm tài liệu, không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với
  ví dụ mà chúng phân định.
