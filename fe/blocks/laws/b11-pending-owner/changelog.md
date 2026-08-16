---
id: fe-blocks-laws-b11-pending-owner-changelog
title: changelog.md
slug: /fe/blocks/laws/b11-pending-owner/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật B11.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `b11-pending-owner`

## Quy tắc phiên bản

Tăng cả năm tài liệu thêm `0.01` cho một thay đổi luật được chấp nhận.

## 2.00 — 2026-08-16

Lập lần đầu, từ một dòng từ chối và từ một docstring ghi lại cái giá đo được của việc gộp cờ.

- **Thêm `B11-3`** — một khối một đơn vị settle — với con số 80ms so với 600ms.
- **Thêm `B11-4`** cho phần tử nhận state từ nơi gọi: mutation đè state, không mở rộng tập state.
- **Ghi hai khoảng trống** vào `audit.md`: lỗi của một hành động, và việc kiểm mutation có thật.
- **Thêm `B11-6` và `B11-7`**: kiểm mutation có thật trước khi vẽ control, và mọi leaf trong cây nghỉ đều nhận `isLoading` kể cả nút.
