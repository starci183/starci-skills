---
id: fe-layouts-bang-chrome-tren-than-trang-changelog
title: changelog.md
slug: /fe/layouts/bang-chrome-tren-than-trang/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun băng chrome trên thân trang.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `bang-chrome-tren-than-trang`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
hoặc bớt một mã `CHROME-` là thay đổi luật. Đọc thêm một dòng từ chối chỉ **xác nhận** mã đã có thì
không phải.

Đổi số chính (`x.00`) dành cho thay đổi hình dạng mô-đun, hoặc cho một thay đổi ở
[`../gate.schema.json`](../gate.schema.json) làm đổi thứ mô-đun này phát ra.

## 1.00 — 2026-08-16

Lần đầu. Mô-đun sinh ra từ mũi đo scope `layouts` trên repo sống
`D:\Repositories\starci-academy-fe` (branch `main`) cộng 552 dòng từ chối thật trong
`D:\Repositories\starci-academy-backend\.workflows`.

- **Đặt archetype.** `bang-chrome-tren-than-trang` phục vụ 6 cụm route và 49/51 page, tất cả dùng
  cùng một công thức `nav-over-body-page`.
- **Tám mã tình huống.** `CHROME-1` băng một hàng, `CHROME-2` băng hai hàng dính liền, `CHROME-3`
  điều khiển đổi vùng nội dung, `CHROME-4` điều khiển đổi một tham số của một hình, `CHROME-5` tab so
  với route, `CHROME-6` băng khi hẹp, `CHROME-7` panel mà băng sở hữu, `CHROME-8` không lặp điều hàng
  dưới đã nói.
- **Nhận bốn luật LAYOUT.** L3 vào `CHROME-2`/`CHROME-8`, L4 vào `CHROME-5`, L6 và L7 vào `CHROME-7`,
  L9 vào `CHROME-1`/`CHROME-2`, L11 vào `CHROME-3`/`CHROME-4`.
- **L11 viết thành tiêu chí phân loại.** Giữ đủ **cả bốn** vòng phán quyết — hai vòng founder đòi
  full-width, hai vòng chính founder lật lại đòi gọn — và một câu phân định duy nhất: sau khi bấm,
  vùng nội dung đổi hay một hình vẽ lại. Không bên nào là mặc định.
- **Gộp L9 vào mô tả của `CHROME-1`/`CHROME-2` thay vì tách mã riêng.** Số hàng của băng quyết định
  token offset; tách ra là mời người ta chọn số mà quên đếm hàng.
- **Khai `CHROME-6` chỉ có neo code.** Hành vi "không hamburger" là cái đo được, không phải cái nên
  có, và mô-đun cấm suy ra phần còn thiếu.
- **Nhận phép thử tab-so-với-route từ bảng điểm mù.** Mode song song trong cùng một page owner đi
  bằng query param trên một route; route con chỉ đúng khi mỗi mode có breadcrumb, metadata hoặc
  landmark riêng. Và khi yêu cầu im lặng về việc mode có cần chia sẻ được bằng link hay không thì đó
  là câu hỏi ngược người dùng, không phải chỗ suy diễn. Neo:
  [`../proofs/INDEX.md`](../proofs/INDEX.md) dòng 30-31.
- **Ghi ba vi phạm sống vào [`audit.md`](./audit.md)** thay vì sửa trong lúc đo: route lặp trên trang
  chi tiết khoá học, khoảng cách giữa record và nguồn về `routes: []`, và `<main>` lồng `<main>` dưới
  toàn bộ `/courses`.
