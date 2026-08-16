---
id: fe-blocks-laws-b4-empty-is-a-state-changelog
title: changelog.md
slug: /gates/blocks/laws/b4-empty-is-a-state/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật B4.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `b4-empty-is-a-state`

## Quy tắc phiên bản

Tăng cả năm tài liệu thêm `0.01` cho một thay đổi luật được chấp nhận.

## 2.00 — 2026-08-16

Lập lần đầu, từ năm dòng từ chối trên bốn hồ sơ.

- **Tách `B4-3` ra thành một mã riêng** vì `undefined` và `null` là hai câu trả lời khác nhau ở tầng
  envelope, và nhầm chúng là lỗi hay gặp nhất của luật này.
- **Đặt điều kiện cho `B4-4`.** Trả `null` chỉ hợp lệ khi có **điều kiện người xem có tên** được
  viết ra; không có thì rơi về `B4-5`.
- **Đặt tên cho hình dạng bị bác `B4-6`** — câu rỗng nhét vào danh sách như một hàng giả — thay vì
  chỉ nói chung chung là "rỗng phải hiện rõ".
- **Ghi câu hỏi còn mở** về năm khối `hidden` vào `audit.md` thay vì phán chúng là vi phạm.
- **Thêm `B4-8`** — pending của trang phải xuống thành trạng thái nghỉ của khối; truyền chuỗi rỗng kèm `ready` là vẽ một khối ready rỗng ruột.
