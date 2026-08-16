---
id: fe-patterns-typography-changelog
title: changelog.md
slug: /fe/patterns/typography/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Typography.
---

# changelog.md

> Current version: `2.00` · Module: `typography`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Bảng `Tầng giữ` và bảng `Anchor` là **một phần của luật**, không phải chú thích. Rule mới, union đổi,
hay một neo chết đều là thay đổi luật và đều phải tăng phiên bản.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: hình dạng của record và vị trí của luật.

- **Từ một file phẳng thành module năm record.** `fe/canon/patterns/typography.md` được diễn đạt lại
  thành `fe/patterns/typography/` gồm `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`.
  Không có `prompt.md`. File luật phẳng **không bị xoá và không bị sửa**: đây là một lần diễn đạt lại
  đầy đủ hơn, không phải một luật mới.
- **Giữ nguyên chín mã.** `TYPESET-1` … `TYPESET-9` giữ đúng số và đúng nghĩa cũ. Không đánh số lại,
  không thêm mã, kể cả ở chỗ audit chỉ ra chồng lấn giữa `TYPESET-5` và `TYPESET-7` — bất đồng đó nằm
  ở "Rủi ro còn mở", không nằm trong một lần sửa im lặng.
- **Thêm bảng `Tầng giữ`.** Mỗi mã khai rõ nó đang được giữ bằng tầng nào: `unrepresentable` (kiểu
  đóng khiến giá trị sai không viết ra được), `enforced` (có rule lint, và rule phải gọi được tên),
  hay `documented` (chỉ người đọc giữ). Kết quả thật: **1 enforced, 3 unrepresentable, 5 documented**.
  Khoảng hở đó là **nội dung** của bảng, không phải khuyết điểm của nó.
- **Thêm bảng `Anchor`.** Mỗi mã chỉ vào code thật kiểm chứng được: đường dẫn cộng thứ cần tìm ở đó.
  Cả chín mã đều neo được; không mã nào phải ghi `chưa neo được`. Hai neo yếu hơn vẻ ngoài
  (`TYPESET-4` neo vào trần thang, `TYPESET-9` neo vào phân bố call site) đã được nêu rõ ở `audit.md`.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới
  với các mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và nhầm lẫn. Bổ sung ánh xạ yêu cầu bằng lời sang một bộ cỡ/đậm/tông, bảng phân định ranh giới,
  và danh sách sai lầm lặp lại.
- **Đóng các ngoại lệ.** Ngoại lệ mốc thời gian giữ 14px, ngoại lệ hai peer cùng cỡ khác độ đậm,
  parity trạng thái, file component heading, và câu trả lời cho yêu cầu cấp thứ năm — tất cả nay được
  viết thành danh sách đóng và mỗi mục nêu rõ nó thuộc mã nào.
- **Tổng quát hoá mọi ví dụ.** Bỏ tên sản phẩm, tên repository, tên component riêng và tên vendor.
  Component chỉ còn xuất hiện ở chỗ ranh giới component **chính là** luật. Tên component riêng mà luật
  phẳng nhắc ở `TYPESET-8` được diễn đạt lại thành "surface danh sách đã có nhãn của chính nó",
  quyết định bảo toàn.
- **Ghi lại các lệch từ vựng thay vì sửa lén.** Luật gọi bậc 16px là `text-base` trong khi leaf gọi nó
  là `size: "md"`; leaf chữ mặc định 16px trong khi bảng quyết định coi 14px là bậc phổ biến; leaf
  heading để `level` tuỳ chọn nên `TYPESET-1` còn hở một đường. Cả ba nằm ở "Rủi ro còn mở".

## Trước 2.00

Luật sống ở `fe/canon/patterns/typography.md` dưới dạng một file phẳng: định nghĩa, bảng thang chữ,
bảng quyết định title body, chín rule `TYPESET-*`, bảng Forbidden và một mục ví dụ. File đó vẫn còn
nguyên; module này diễn đạt lại nó, không thay thế nó.
