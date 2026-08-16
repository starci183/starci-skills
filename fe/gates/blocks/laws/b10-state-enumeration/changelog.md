---
id: fe-blocks-laws-b10-state-enumeration-changelog
title: changelog.md
slug: /gates/blocks/laws/b10-state-enumeration/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật B10.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `b10-state-enumeration`

## Quy tắc phiên bản

Tăng cả năm tài liệu thêm `0.01` cho một thay đổi luật được chấp nhận. Thêm một literal vào từ vựng
state là bump nhỏ và phải cập nhật cả `gate.schema.json`.

## 2.00 — 2026-08-16

Lập lần đầu, từ ba dòng từ chối và từ một docstring ghi lại chính tiêu chí phân biệt.

- **Nâng câu "một state là một tình huống chọn một cây khác" thành tiêu chí chính thức.** Trước đây
  nó chỉ sống trong docstring của một khối.
- **Thêm `B10-7`** sau khi đo được một khối liệt kê mười một tình huống trong khi máy chủ chỉ khai
  chín.
- **Thêm `B10-4`** tách `undefined` khỏi `null` ở tầng envelope.
- **Ghi rõ từ vựng chưa đóng** và hai cặp đồng nghĩa vào `audit.md`.
- **Thêm `B10-8`** — cụm nhận chuỗi đã chốt không có thang state, chỉ có slot có hoặc slot vắng. Một mình câu này gây năm dòng lệch trong một bản chấm.
