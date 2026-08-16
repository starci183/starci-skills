---
id: fe-blocks-laws-b13-closed-data-changelog
title: changelog.md
slug: /fe/blocks/laws/b13-closed-data/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật B13.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `b13-closed-data`

## Quy tắc phiên bản

Tăng cả năm tài liệu thêm `0.01` cho một thay đổi luật được chấp nhận.

## 2.00 — 2026-08-16

Lập lần đầu, từ ba dòng từ chối trong một hồ sơ và từ hợp đồng props trong `contracts/props.ts`.

- **Gộp vế `isLoading` vào cùng mô-đun** thay vì để nó sống lạc trong một docstring. Nó là nửa còn
  lại của cùng một hợp đồng props.
- **Đo lại số `ReactNode` và `children`** để phân biệt `children` của React với trường `children`
  của registry — mười một chỗ có chữ đó và không chỗ nào là React.
- **Ghi năm khối đang nhận `isLoading`** kèm nhận định rằng không có gate nào bắt.
