---
id: fe-blocks-laws-b3-block-owns-its-frame-changelog
title: changelog.md
slug: /gates/blocks/laws/b3-block-owns-its-frame/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật B3.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `b3-block-owns-its-frame`

## Quy tắc phiên bản

Tăng cả năm tài liệu thêm `0.01` cho một thay đổi luật được chấp nhận.

## 2.00 — 2026-08-16

Lập lần đầu, từ bảy dòng từ chối trên bốn hồ sơ.

- **Đặt sáu mã** theo trục sở hữu, trong đó hai mã (`B3-5`, `B3-6`) được khối trả lời bằng cách
  không phát ra gì.
- **Thêm câu hỏi phân định gốc**: khối có tự trả lời được mà không cần biết trên trang có gì khác
  không.
- **Ghi rõ ngoại lệ viewport có tên** để luật không bị đọc thành "khối không được cuộn".
- **Ghi vi phạm sống của `StarCiAiFab`** kèm nhận định rằng không gate nào đang bắt nó.
- **Thêm bất biến sticky**: khối tự vẽ surface mà dính thì phải khai cả giới hạn chiều cao lẫn vùng cuộn, vì thiếu giới hạn thì người đọc không bao giờ tới được control ở cuối card.
