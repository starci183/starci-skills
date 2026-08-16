---
id: be-lints-observability-changelog
title: changelog.md
slug: /be/lints/observability/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun tài liệu enforcement observability.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `observability`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Những thay đổi bắt buộc phải tăng phiên bản:

- Một quy tắc được thêm vào hoặc bỏ khỏi `sources/be/observability.mjs`.
- Cơ chế phát hiện của một quy tắc đổi, kể cả khi tên quy tắc giữ nguyên.
- Mức nghiêm trọng trong bộ khuyến nghị đổi.
- Danh sách đường dẫn miễn trừ đổi.
- Một cửa còn mở được đóng, hoặc một cửa mới được tìm ra.

Điều **không** làm tăng phiên bản: sửa lỗi chính tả, và làm rõ câu chữ mà không đổi điều đang được
khẳng định.

## 2.00 — 2026-08-16

Dựng mới mô-đun. Nhóm `be/lints/` tài liệu hoá **enforcement**, không tài liệu hoá luật:
`be/canon/patterns/observability.md` nói luật là gì, còn trang này nói **máy thấy được đến đâu và
hết thấy từ chỗ nào**.

- **Phủ hai quy tắc.** `no-framework-logger` và `no-interpolated-log-message`, đúng bằng số quy tắc
  mà `sources/be/observability.mjs` công bố trong đối tượng `rules`. Chúng ship trong gói
  `@starci/eslint-canon-be`, dưới không gian tên `starci-be/`.
- **Danh tính là tên đã công bố.** Không đúc mã số cho quy tắc. Tiêu đề mục chính là tên quy tắc,
  nguyên văn, vì đó là chuỗi mà bản dựng in ra và chú thích tắt gọi tên.
- **Ghi rõ chỗ trống của luật.** Tám mã, hai mã có quy tắc, một mã (`OBSERVABILITY-6`) được giữ bằng
  danh sách đường dẫn `standaloneProgramGlobs` — là cấu hình chứ không phải quy tắc — và năm mã
  (`-3`, `-4`, `-5`, `-7`, `-8`) không ai giữ. Không mã nào bị gán bừa cho quy tắc gần nhất.
- **Nói rõ `no-console` là quy tắc chuẩn.** Nó có mặt trong bộ khuyến nghị nên `recommended` có ba
  dòng trong khi chỉ có hai quy tắc nhà. Chênh lệch ấy được ghi ở `audit.md` thay vì được làm cho
  gọn mắt.
- **Bảng Escape Hatches hai phần.** Phần **Closed** ghi cách viết trông như lách được mà không lách
  được; phần **Open** ghi cách viết quy tắc **thật sự không bắt**. Lần dựng này ghi **18 cửa còn
  mở**, và không mục nào viết "không có".
- **Ba khuôn cửa mở được đặt tên.** Danh tính theo cách viết chứ không theo kiểu; chỉ đối số được đọc
  mới được giữ, nên vi phạm chỉ cần dịch sang phải một ô; và thư mục không phải tệp, nên miễn trừ
  theo đường dẫn rộng hơn ngoại lệ mà nó được mua về.
- **Ghi một báo cáo sai.** `import type { Logger }` bị báo dù không đi vòng qua gì cả, vì
  `importKind` không được đọc. Đây là lỗi chứ không phải giới hạn, và nó nằm ở `audit.md` kèm cách
  sửa.
- **Ghi hai chỗ tên quy tắc rộng hơn hành vi thật.** `no-framework-logger` chỉ canh đúng một cách
  viết của đúng một cái tên; `no-interpolated-log-message` rộng hơn tên gọi ở chỗ bắt cả chữ chuỗi
  trần, và hẹp hơn ở chỗ bỏ qua mọi nội suy không nằm ở đối số thứ nhất.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm trong
  `example.md`, cùng chỗ với ví dụ mà chúng phân định.
