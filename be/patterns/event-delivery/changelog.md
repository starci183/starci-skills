---
id: be-patterns-event-delivery-changelog
title: changelog.md
slug: /be/patterns/event-delivery/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật event delivery.
---

# changelog.md

> Current version: `2.00` · Module: `event-delivery`

## Version Policy

Mỗi thay đổi luật được chấp nhận sẽ tăng version của module thêm `0.01` và cập nhật cả **năm** record.
Đổi số chính (`x.00`) dành cho thay đổi cấu trúc của module hoặc shelf mà module nằm trên.

Thêm, bớt hoặc đánh số lại một mã `DELIVERY-<n>` là thay đổi **major**, không phải một lần tăng
`0.01`. Các mã này được trích dẫn từ luật anh em và từ task record cũ; đổi số một mã là làm hỏng một
trích dẫn đã có người viết ra.

## 2.00 — 2026-08-16

Đổi số chính vì hai yếu tố thay đổi cùng lúc: shelf và hình dạng module.

- **Chuyển shelf.** `be/canon/patterns/event-delivery.md` (một file phẳng) → `be/patterns/event-delivery/`
  (module năm record). Toàn bộ `id` và `slug` đổi theo. File phẳng vẫn còn nguyên tại chỗ cũ; bản
  này **diễn đạt lại** luật đó đầy đủ hơn, không thay luật.
- **Giữ nguyên sáu mã.** `DELIVERY-1` … `DELIVERY-6`, đúng số và đúng nghĩa như bản phẳng: envelope
  mang danh tính và digest; transport khai theo event; bỏ self-origin trước emit; giành digest trước
  emit; assert người nhận và nội dung; chứng minh bằng hai instance thật. Không mã nào bị gộp, tách
  hay đánh số lại.
- **Thêm bảng `Tầng giữ`.** Mỗi mã nói rõ thứ gì đang thực sự giữ nó: `unrepresentable`, `enforced`
  hay `documented`. Kết quả: **hai `enforced`, bốn `documented`, không mã nào `unrepresentable`**.
  Hai dòng `enforced` cùng trỏ vào một rule, `nats-bridge-delivery-contract`, vì rule đó báo hai
  message độc lập — `origin` giữ `DELIVERY-3`, `digest` giữ `DELIVERY-4`. Bản phẳng chỉ nói "cái giữ
  các bất biến của bridge là file rule kia", câu đó đúng nhưng để người đọc tưởng cả sáu mã đều có
  gate.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật kiểm chứng được: factory dựng envelope, config
  khai hai cờ, guard danh tính và cặp digest trong bridge, test khẳng định người nhận, và world hai
  instance trên broker thật. **Cả sáu mã đều neo được**; không dòng nào ghi `chưa neo được`.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới
  với mã kề, và danh sách tình huống nghiệp vụ hay gặp. Bản phẳng có sáu đoạn văn; nó không nói được
  làm sao phân biệt `DELIVERY-3` với `DELIVERY-4` khi đứng trước một bug nhân đôi thật.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case một cặp ĐÚNG/SAI, kèm mục ngoại
  lệ và nhầm lẫn. Bản phẳng có ba ví dụ cho sáu mã, nên `DELIVERY-1`, `DELIVERY-2` và `DELIVERY-5`
  chưa từng có một dòng code nào minh hoạ.
- **Đóng các ngoại lệ.** Những điều bản phẳng nói rải rác trong văn xuôi nay là ngoại lệ đóng, mỗi
  cái nêu rõ mã nó áp vào: heartbeat được bỏ digest, `useNats: false` là câu trả lời hợp lệ chứ
  không phải cờ vắng mặt, cache digest phải cục bộ trong process, đếm message ở transport chỉ được
  dùng làm điểm đồng bộ, và graph hai instance được phép thu gọn phần không phải chủ đề.
- **Rút mọi ví dụ về TypeScript/NestJS thuần.** Bỏ tên module riêng trong bảng "Forbidden" và trong
  các ví dụ. Một luật ở shelf này phải đúng với bất kỳ back end nào fan-out một sự thật đã quyết
  xong; ví dụ cần tên riêng của một hệ thống mới đọc được là ví dụ đứng sai chỗ. Tên rule là danh từ
  riêng duy nhất còn lại, vì nó là danh tính enforcement và một rule bị đổi tên thì không trích dẫn
  được trong config.
- **Ghi lại bất đồng thay vì sửa im lặng.** `audit.md` nêu rõ: rule chỉ chạy trên đúng một đường dẫn
  file, rule tìm chuỗi chứ không đọc luồng điều khiển, và có lập luận rằng `DELIVERY-3` với
  `DELIVERY-4` nên là một mã. Cả ba đều nằm ở "Rủi ro còn mở"; không cái nào dẫn tới một lần sửa luật.
- **Năm record, không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với
  ví dụ mà chúng phân định, trong `example.md`.

## Các phiên bản trước

`1.x` là file phẳng `be/canon/patterns/event-delivery.md`: một mục `Definition`, sáu mục `Rules`
mang mã `DELIVERY-1` … `DELIVERY-6`, một bảng `Forbidden` năm dòng, và ba ví dụ. Mọi quyết định của
bản đó được giữ nguyên ở `2.00`.
