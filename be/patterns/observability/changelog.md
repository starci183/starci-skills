---
id: be-patterns-observability-changelog
title: changelog.md
slug: /be/patterns/observability/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Observability.
---

# changelog.md

> Current version: `2.00` · Module: `observability`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã tình huống **không** được đánh số lại trong bất kỳ phiên bản nào. Một mã đã được trích dẫn từ file
luật khác và từ các bản ghi công việc cũ; đổi số một mã là làm hỏng một trích dẫn ai đó đã tạo, mà
không ai nhận ra. Mã sai thì được giữ nguyên và nói ra ở `audit.md`.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của module đổi: từ **một file luật phẳng** thành **năm record**.

- **Tách năm record.** `be/canon/patterns/observability.md` được diễn đạt lại thành
  `be/patterns/observability/` gồm `INDEX.md` (máy đọc, tiếng Anh), `vi.md` (tình huống nghiệp vụ),
  `example.md` (case và ngoại lệ), `audit.md` (phản biện) và `changelog.md`. File luật phẳng vẫn nằm
  nguyên chỗ cũ; bản này **diễn đạt lại đầy đủ hơn**, không thay thế bằng một luật khác.
- **Giữ nguyên tám mã.** `OBSERVABILITY-1` … `OBSERVABILITY-8` giữ nguyên số và nguyên nghĩa của luật
  phẳng: một service duy nhất, tên là thành viên enum, dữ liệu đi cạnh tên, log quyết định, thất bại
  ghi danh tính, lối ra cho chương trình đứng một mình, Minimal rồi mới Full, và mỗi tiến trình
  telemetry trả giá vòng đời của nó. Không mã nào được thêm, gộp hay đánh số lại.
- **Thêm bảng `Tầng giữ`.** Mỗi mã nói rõ tầng nào đang thật sự giữ nó: `unrepresentable`, `enforced`
  (kèm **tên rule**), hay `documented`. Kết quả đo được là hai `enforced` và sáu `documented`. Khoảng
  trống đó là **nội dung** của bảng, không phải lỗi của bảng: sáu dòng `documented` chỉ đúng chỗ luật
  sẽ vỡ trước.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật kèm thứ phải tìm ở đó, vì một luật không trỏ được
  vào code thật thì là một đề xuất, không phải một luật. Hai neo trỏ vào chỗ luật **đang bị bỏ** —
  đó đúng là việc của một neo. Nửa "khai đủ vòng đời" của `OBSERVABILITY-8` ghi `chưa neo được` và
  nằm trong Rủi ro còn mở.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới với
  mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt ĐÚNG cạnh SAI, kèm mục ngoại lệ
  và nhầm lẫn. Thêm ánh xạ yêu cầu bằng lời sang một quyết định, bảng phân định ranh giới, và danh
  sách sai lầm lặp lại nhiều nhất.
- **Rút mọi ví dụ về TypeScript/NestJS thường.** Tên module riêng trong luật phẳng được tổng quát hoá
  thành glob của "chương trình đứng một mình"; ví dụ nghiệp vụ chuyển sang đơn hàng, thanh toán, job
  và thuê bao. Hai định danh `winstonService` và `WinstonLog` được giữ vì rule khoá theo chúng.
- **Ghi lệch thay vì sửa lặng.** `audit.md` ghi hai lệch đã đo được giữa luật và source — `catch` ghi
  `error.message` làm khoá group, và lối ra `-6` bị lấy bằng comment tắt rule trên từng dòng thay vì
  khai một lần theo path — cùng một lệch về tên rule ở repo tiêu thụ. Không lệch nào được giải quyết
  bằng cách hạ luật xuống cho khớp code.
- **Không có `prompt.md`.** Ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định. Module còn năm
  record.
