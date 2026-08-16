---
id: be-patterns-cdc-changelog
title: changelog.md
slug: /be/patterns/cdc/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật CDC.
---

# changelog.md

> Current version: `2.00` · Module: `cdc`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã `CDC-<n>` **không bao giờ được đánh số lại**. Các mã này được trích dẫn từ file luật khác và từ
biên bản task cũ; đổi số một mã là làm hỏng một trích dẫn người khác đã viết. Một mã bị coi là sai
thì vẫn giữ nguyên và được ghi vào mục *Rủi ro còn mở* của [`audit.md`](./audit.md). Số của một mã
đã rút cũng không được dùng lại cho việc khác.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, không phải vì nội dung luật đổi.

- **Từ một file phẳng thành module năm record.** `be/canon/patterns/cdc.md` được diễn đạt lại thành
  `be/patterns/cdc/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`. File luật
  phẳng vẫn nằm nguyên chỗ cũ; bản này **không** xoá và **không** sửa nó.
- **Giữ nguyên bảy mã.** `CDC-1` … `CDC-7` giữ đúng số và đúng nghĩa của luật phẳng. Không mã nào
  được thêm, bớt, gộp hay đánh số lại. Bảng `Forbidden` của luật phẳng không bị rút gọn: nó trở
  thành cột *Forbids* trong `Situation Codes` và trở thành các case SAI trong `example.md`.
- **Thêm bảng `Tầng giữ`.** Mỗi mã nói rõ nó đang được giữ ở tầng nào —
  `unrepresentable` / `enforced` / `documented` — và tầng đó do cái gì giữ. Kết quả: **một** mã
  `enforced` (`CDC-1`, bằng rule `starci-be/projection-listener-contract`, hai message `base` và
  `lifecycle`), **sáu** mã `documented`. Bảng có thêm cột *Not held* để nói phần dư mà rule không
  thấy, thay vì để người đọc suy đoán.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào source đọc được hôm nay kèm thứ cần đọc nó để tìm: base
  listener cho `CDC-1`, `CDC-5`, `CDC-6`; một listener cụ thể cho `CDC-2`, `CDC-3`; projection
  service cho `CDC-4`; spec E2E CDC cho `CDC-7`. **Không mã nào** phải ghi `chưa neo được`.
- **Ghi rõ `CDC-4` là gốc.** `CDC-6` chỉ an toàn và `CDC-2` chỉ rẻ vì recompute idempotent. Đây là
  làm rõ quan hệ giữa các mã đã có, không phải một luật mới.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi listener projection đều rơi vào các mã
  này, và không có projection nào nhỏ tới mức được miễn — vì broker chỉ hứa *at-least-once*, và
  "event này chỉ tới một lần" là một dự đoán chứ không phải một bảo đảm.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới với
  mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Mở rộng ví dụ.** Ba cặp ĐÚNG/SAI của luật phẳng trở thành hơn bốn mươi block code: mỗi mã nhiều
  case, mỗi case đặt ĐÚNG cạnh SAI, cộng mục *Ngoại lệ và nhầm lẫn*, bảng ánh xạ yêu cầu, bảng phân
  định ranh giới và danh sách sai lầm lặp lại.
- **Đóng gói ngoại lệ.** Năm ngoại lệ được viết ra và khép kín: boot best-effort (`CDC-1`), đọc để
  phân giải cha (`CDC-3`), trả về mảng rỗng (`CDC-3`, `CDC-5`), projection thật sự cần xử lý xoá
  (`CDC-5`), unit test cho mapping (`CDC-7`). Chúng vốn nằm rải trong luật phẳng dưới dạng câu văn.
- **Tổng quát hoá tên riêng.** Module riêng tư mà luật phẳng nêu tên đã thành projection điểm,
  projection thống kê review và projection tiến độ. Ngoại lệ duy nhất là bảng `Anchor`, nơi buộc
  phải nêu đường dẫn source thật — và ngoại lệ đó được tuyên bố công khai trong `Scope`.
- **Không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với ví dụ mà
  chúng phân định. Module có đúng năm record.

## Các phiên bản trước

Luật phẳng `be/canon/patterns/cdc.md` dựng bảy mã `CDC-1`…`CDC-7`, bảng `Forbidden` sáu dòng và ba
cặp ví dụ ĐÚNG/SAI. Bản đó không đánh số phiên bản; `2.00` là số đầu tiên module này mang.
