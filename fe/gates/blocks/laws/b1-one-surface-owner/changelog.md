---
id: fe-blocks-laws-b1-one-surface-owner-changelog
title: changelog.md
slug: /gates/blocks/laws/b1-one-surface-owner/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật B1.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `b1-one-surface-owner`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì `b8` và `b9` đều rẽ vào đây.

## 2.00 — 2026-08-16

Mô-đun được lập lần đầu trên kệ `gates/blocks/`, từ chín dòng từ chối trên năm hồ sơ và từ một lần đo
toàn bộ tầng block của repo sống.

- **Phát biểu lại từ tuyệt đối sang điều kiện.** Bản cũ nói "cấm card trong card" và bị bác chín
  lần. Bản này nói một viền phải trả lời được nó sở hữu nhóm nào, và đưa ra ba điều kiện kiểm được
  cho `B1-4`.
- **Đặt bảy mã tình huống.** `B1-1` đến `B1-7`, trong đó `B1-3` và `B1-6` phát ra **không gì cả** và
  vẫn là tình huống được phân loại.
- **Tách chuyện ẩn nhãn ra khỏi chuyện lồng.** `isNested` không kéo theo `isLabelHidden`; việc ẩn
  nhãn chuyển hẳn sang [`b9`](../b9-list-label-owner/INDEX.md).
- **Ghi hai khoản nợ đo được**, một ở API sản phẩm và một ở gate lint, vào `audit.md` thay vì để
  luật nói như thể chúng đã xong.
- **Thêm ngoại lệ "một phần tử, hai cách đọc"** sau khi phép thử giữ kín đáp án cho thấy gate không phân xử được lưới so với hàng: một component, một discriminant, và ở chế độ hàng thì danh sách sở hữu nền.
