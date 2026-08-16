---
id: fe-layouts-laws-l1-persistent-owner-mounts-once-changelog
title: changelog.md
slug: /gates/layouts/laws/l1-persistent-owner-mounts-once/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L1, gồm cả bản 1.00 đã bị bác và lý do nó bắt nhầm.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `l1-persistent-owner-mounts-once`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì
[`invisible-owner`](../../archetypes/invisible-owner/INDEX.md) rẽ `KEEPER-1` vào đây và bảng định tuyến ở
[`../../INDEX.md`](../../INDEX.md) phát biểu luật này thành một dòng riêng.

Một mục cũ không bao giờ được viết lại cho khớp bản mới. Mục `1.00` dưới đây giữ nguyên phát biểu
sai, vì nó là bằng chứng cho việc đã tin điều gì và bắt nhầm ở đâu.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi câu `Law`, không thêm bớt mã tình huống, không đổi `Inputs`,
nên **không bump phiên bản**; đây là sửa lỗi và ghi phát hiện, không phải thay đổi luật.

- **Sửa một liên kết chết trong [`INDEX.md`](./INDEX.md).** Mục `Law` trỏ tới
  `../../../principles/INDEX.md`, nhưng kệ `gates/principles` không có `INDEX.md` gốc — nó là một kệ
  gồm các mô-đun. Đây là chỗ duy nhất trên cả cây trust mắc lỗi ấy. Nay trỏ vào ba mô-đun thật:
  `divider`, `position` và `elevation`.
- **Ghi một mâu thuẫn chéo với `L6`** vào [`audit.md`](./audit.md), ghi đối xứng bên ấy: `L1-7` bắt
  từ chối và báo nợ với đúng tình huống mà câu `Law` của `L6` mô tả như đã chốt.

## 2.00 — 2026-08-16

Lập mô-đun trên kệ `gates/layouts/`, từ ba dòng từ chối trên một hồ sơ và từ một lần đo lại toàn bộ
điểm mount trong repo sống.

- **Phát biểu lại từ hình thức sang nguyên nhân.** Bản cũ cấm theo hình dạng của chỗ mount. Bản này
  hỏi một câu kiểm được: địa chỉ có tính lại được mẩu state đó không. Bốn chủ đang sống trong repo
  trả lời được cả bốn bằng đúng câu hỏi ấy.
- **Bác bản `1.00` bằng mã và bằng test.** Sáu chỗ mount `ShellNav` không vi phạm gì, và
  `src\app\[lang]\authentication\layout-boundary.test.ts:24-25` đang bắt buộc đúng cách bố trí mà
  bản cũ cấm. Chi tiết ở [`audit.md`](./audit.md).
- **Tách `L1-2` khỏi `L1-4`.** Giấu phần nhìn thấy mà giữ mount là một tình huống; không mount ở đâu
  cả là một tình huống khác. Bản cũ không có chỗ cho sự khác biệt này, và gộp chúng làm hỏng theo
  hai hướng ngược nhau.
- **Đặt bảy mã tình huống.** `L1-1` đến `L1-7`, trong đó `L1-4` phát ra **không mount ở đâu cả** và
  `L1-7` phát ra **chưa gì cả** kèm một khoản nợ. Cả hai vẫn là tình huống đã được phân loại.
- **Ghi ba khoản nợ** vào `audit.md`: drawer mở khi chuyển cụm chưa ai đo, bình luận ở
  `content-ai-route-context.ts:63` nói "không mount" trong khi mã vẫn mount, và bảng định tuyến của
  kệ vẫn mang câu cũ.

## 1.00 — trước 2026-08-16

Phát biểu được thừa kế từ bảng định tuyến của kệ `layouts` và từ cách `KEEPER-1` được đọc tách khỏi
ngữ cảnh keeper của nó:

> A global visual owner mounts at the locale root.

Chép thẳng từ cột "chosen" của một dòng từ chối, bỏ mất cột `Why`. Cột `Why` nói chrome lặp sẽ làm
rơi **trạng thái hội thoại** khi đi xuyên cụm, tức là phán quyết về state chứ không phải về hình
dạng. Mất vế đó thì câu còn lại cấm mọi chrome lặp, kể cả chrome không giữ trạng thái nào, và nó
bắt nhầm sáu chỗ mount đúng ngay lần đọc đầu tiên.
