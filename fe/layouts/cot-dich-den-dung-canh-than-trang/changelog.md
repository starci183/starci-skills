---
id: fe-layouts-cot-dich-den-dung-canh-than-trang-changelog
title: changelog.md
slug: /fe/layouts/cot-dich-den-dung-canh-than-trang/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun cột đích đến đứng cạnh thân trang.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `cot-dich-den-dung-canh-than-trang`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
hoặc bớt một mã `SPINE-` là thay đổi luật. Một frame thứ ba gia nhập archetype cũng là thay đổi luật,
vì nó kiểm định xem `SPINE-7` là một khiếm khuyết hay một hình dạng thứ hai hợp lệ.

## 1.00 — 2026-08-16

Lần đầu. Sinh ra từ mũi đo scope `layouts` trên repo sống `D:\Repositories\starci-academy-fe`
(branch `main`) cộng kho phán quyết `D:\Repositories\starci-academy-backend\.workflows`.

- **Đặt archetype.** `cot-dich-den-dung-canh-than-trang` phục vụ 33 page: 30 route learn qua
  `learn-shell-frame`, 3 route personal-project qua `personal-project-workspace-frame`.
- **Bảy mã tình huống.** `SPINE-1` cột tự cuộn dưới băng, `SPINE-2` cột thành thanh đáy, `SPINE-3`
  bỏ cột cho bài đánh giá, `SPINE-4` nhắm bằng danh tính, `SPINE-5` chủ sở hữu chiều rộng, `SPINE-6`
  route mang nội dung so với route làm cửa vào, `SPINE-7` tuyên bố có cột mà không có slot.
- **Nhận hai luật LAYOUT.** L5 vào `SPINE-6`, L10 vào `SPINE-5`.
- **L5 viết thành tiêu chí phân loại.** Giữ đủ **cả hai** phán quyết — A cấm stub/redirect làm route
  xanh, B chốt `/learn` là cửa vào `/learn/content` theo legacy — và một câu phân định duy nhất: bỏ
  route này thì có nội dung nào không còn tồn tại ở đâu khác không. Không bên nào là mặc định.
- **Thêm nghĩa vụ mang theo giá của cú lật.** Nhận một cú lật route entry thì phải liệt kê page
  owner, nhánh và contract chết theo, và cho chúng một chỗ đi hoặc ghi vào `owed`. Nghĩa vụ này sinh
  ra từ đúng bốn thứ đang chết trong repo sống sau cú lật `/learn`.
- **Ghi thẳng rằng hai thành viên không cùng chất lượng.** `learn-shell-frame` bọc cột thành contract
  riêng và nhắm bằng `data-node`; `personal-project-workspace-frame` không bọc gì và nhắm bằng
  `*:first-child`, nên nó không thật sự có cột. Mô-đun mô tả cả hai thay vì mô tả cái tốt hơn.
- **`SPINE-2` nói rõ thanh đáy là NAV.** Nó chia hình dáng với action bar và khác nhau ở thứ nằm bên
  trong; phân biệt bằng nội dung, không bằng silhouette.
- **`SPINE-3` khai predicate dùng chung là một phần của luật**, không phải một chi tiết kỹ thuật.
