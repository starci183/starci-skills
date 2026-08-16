---
id: fe-lints-landmark-changelog
title: changelog.md
slug: /gates/lints/landmark/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun enforcement landmark.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `landmark`

## Quy ước phiên bản

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm nó nằm trên.

Có **ba** loại thay đổi bắt buộc tăng phiên bản ở đây, và loại thứ ba là loại hay bị bỏ sót:

1. Nguồn thêm, bớt hoặc đổi tên một rule.
2. Cơ chế phát hiện của một rule đổi — vị từ đường dẫn, node AST, cách đọc bảng.
3. **Một cửa trong bảng Open đổi trạng thái.** Một cửa được đóng, hoặc một cửa mới được phát hiện, là
   thay đổi về **thứ luật này thật sự bảo đảm**, dù không một dòng rule nào đổi. Tài liệu enforcement
   nói sai về lỗ hổng thì tệ hơn tài liệu không nói gì.

Danh tính của một rule là **tên publish** của nó. Đổi tên là thay đổi phá vỡ tương thích: nó làm hỏng
mọi comment tắt rule và mọi log build đang tham chiếu tên cũ.

## 2.00 — 2026-08-16

Tạo mô-đun. Đây là bản ghi đầu tiên nói về **enforcement** của luật landmark, tách khỏi bản ghi nói về
chính luật đó.

- **Lập nhóm mới.** `gates/lints/` giữ tài liệu về cái máy giữ được. `gates/principles/` và `gates/patterns/`
  giữ tài liệu về luật. Hai câu hỏi khác nhau, và trộn chúng vào một chỗ là cách một luật không có
  rule bị đọc thành một luật đã được giữ.
- **Bao phủ đúng hai rule**, cả hai đọc trực tiếp từ nguồn:
  - `routed-page-is-a-main-landmark` — giữ `LANDMARK-4`.
  - `main-landmark-belongs-to-a-route-file` — giữ `LANDMARK-5`.
  Số rule publish khớp con số dự kiến. Không rule nào được suy diễn, không rule nào được bịa thêm.
- **Ghi ba mã luật không có rule.** `LANDMARK-1`, `LANDMARK-2`, `LANDMARK-3` không có gì giữ ở mô-đun
  này. Chúng được ghi thành finding ở `audit.md` chứ **không** được gán bừa cho một rule để bảng nhìn
  cho kín.
- **Bảng Open là trọng tâm của mô-đun.** Ghi lại **16 cửa còn mở**: 8 cửa riêng của rule thứ nhất, 6 cửa
  riêng của rule thứ hai, 2 cửa chung cho cả hai. Cửa nghiêm trọng nhất — chuyển chrome vào một component
  vỏ — làm **cả hai rule cùng im** trên một tài liệu không có landmark nào, và không đóng được bằng lint.
- **Mỗi cửa mở đi kèm chi phí đóng.** `audit.md` nói rule sẽ phải **nhìn thêm cái gì** mới đóng được,
  và bốn cửa được kết luận là **không nên đóng bằng lint** kèm lý do.
- **Không đặt mã số cho rule.** Tiêu đề mục là tên publish, nguyên văn. Một rule mang hai tên là một
  rule mà không ai truy được thông điệp lỗi về nguồn.
- **Ghi hai finding về chính rule.** Tên rule thứ hai nói hẹp hơn hành vi thật (bề mặt trang được phép
  ở một trong hai hình dạng, không phải cả hai), và vị từ đường dẫn ở đây bất đồng với vị từ đường dẫn
  dùng chung của mô-đun contract.
- **Gói phát hành.** Cả hai rule ship trong `@starci/eslint-canon-fe`, publish ở mức `error`. Kho tiêu
  thụ vẫn là nơi quyết định rule nào thật sự được bật; một rule ở mức `error` nghĩa là build gãy, không
  phải cảnh báo để xếp hàng xử lý.
- **Năm tài liệu, không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với
  ví dụ mà chúng phân định.
