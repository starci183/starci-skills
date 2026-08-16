---
id: fe-blocks-laws-b2-chip-or-text-changelog
title: changelog.md
slug: /gates/blocks/laws/b2-chip-or-text/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật B2.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `b2-chip-or-text`

## Quy tắc phiên bản

Tăng cả năm tài liệu thêm `0.01` cho một thay đổi luật được chấp nhận. Thêm một hàng vào bảng tra là
bump nhỏ và **phải** đi kèm cái neo biện minh cho hàng đó.

## 2.00 — 2026-08-16

Lập lần đầu, từ sáu dòng từ chối trên ba hồ sơ, cộng một lần đếm toàn bộ mười một chỗ dựng `Badge`
trong tầng block.

- **Viết thành bảng tra thay vì văn xuôi.** Bảy mã đặt theo **loại field**, không theo cảm nhận, để
  câu hỏi "chip hay chữ" trả lời được bằng một dòng.
- **Thêm ba câu hỏi phân định.** Tự đổi hay không, có hệ quả hay không, tone có nghĩa hay không.
  Câu ba là câu bắt được nhiều look-alike nhất.
- **Ghi rõ chỗ chip là đúng.** Bốn trường hợp, để bảng không bị đọc thành lệnh cấm chip.
- **Ghi bốn mâu thuẫn đang sống** và phân biệt chúng: bốn cái đầu là vi phạm đã có phán quyết hoặc
  trượt hẳn ba câu hỏi; nhánh `results` của Global Search chỉ là mâu thuẫn đo được và được ghi vào
  `audit.md` như một câu hỏi còn mở.
- **Ghi thẳng chỗ suy luận.** Ngưỡng bốn kết cục không có neo và được đánh dấu như vậy.
- **Thêm `B2-8`** — con số kiêm phán quyết — sau khi cả ba bản dựng mù đều phải tự quyết cho mức giảm giá. Đây là ngoại lệ hẹp duy nhất của `B2-1`.
