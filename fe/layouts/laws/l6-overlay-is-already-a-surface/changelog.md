---
id: fe-layouts-laws-l6-overlay-is-already-a-surface-changelog
title: changelog.md
slug: /fe/layouts/laws/l6-overlay-is-already-a-surface/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L6.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l6-overlay-is-already-a-surface`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì
[`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) `CHROME-7` và
[`b1-one-surface-owner`](../../../blocks/laws/b1-one-surface-owner/INDEX.md) `B1-7` đều rẽ vào đây.
Đổi `buildsCardInside` là thay đổi GATE và phải làm ở [`gate.schema.json`](../../gate.schema.json)
trước.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi câu `Law`, không thêm bớt mã tình huống, nên **không bump
phiên bản**.

- **Ghi một mâu thuẫn chéo với `L1`** vào [`audit.md`](./audit.md), ghi đối xứng bên ấy. Câu `Law`
  của mô-đun này nói "The layout mounts it once for a whole route cluster" bằng giọng đã chốt, trong
  khi `L1-7` giữ đúng chỗ mount ấy ở trạng thái nợ và bắt từ chối. Hai kết quả cho một tình huống.
  Cách sửa được ghi ra nhưng chưa làm, vì cả hai đường đều là thay đổi luật.
- **Ghi rõ mục `Scope` còn thiếu một tên.** Câu đẩy "ai mount overlay" sang `invisible-owner` và
  `CHROME-7` bỏ sót `l1-persistent-owner-mounts-once`, là nơi số lần mount và độ cao mount nay
  thuộc về.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `fe/layouts/`, tách `L6` ra khỏi vế ngắn mà nó đang nằm trong
`CHROME-7`. Nguồn: ba dòng từ chối trên hai hồ sơ, cộng một lần đọc hết sáu file component dưới
`src/components/overlays/` và các contract gốc của chúng.

- **Đặt sáu mã tình huống.** `L6-1` đến `L6-6`, trong đó `L6-2` phát ra **không gì cả** và `L6-6`
  phát ra một lời từ chối, mà cả hai vẫn là tình huống được phân loại chứ không phải chỗ trống.
- **Thêm điều kiện thứ ba cho `L6-4`.** Bản cũ chỉ nói ngoại lệ tồn tại. Bản này bắt lời khai phải
  đến từ một **block** ở tầng dưới, vì đó là điều kiện duy nhất trong ba điều kiện mà đường dẫn file
  kiểm được, và vì `no-surface-branch-in-overlay` khiến file overlay không nói được câu ấy.
  Neo: `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:289` và
  `D:\Repositories\starci-academy-fe\src\components\blocks\search\GlobalSearchResults\component.tsx:63-66`.
- **Tách `L6-2` và `L6-3` thành mã riêng.** Cái tên panel và lớp đệm là hai hệ quả trực tiếp của
  "overlay đã là mặt phẳng", cả hai đều có neo code, và cả hai là chỗ luật hay bị trượt hơn hẳn so
  với việc ai đó viết `SurfaceCard` vào một dialog.
- **Viết `L6-2` có điều kiện thay vì tuyệt đối.** Một bản phát biểu ngắn gọn kiểu "trong overlay
  không có tiêu đề" sẽ sai ngay ở overlay thứ hai được đo: `ModalShell` không dựng header nào, nên
  `course-price-detail-stack` mở đầu bằng một slot `heading` và phải giữ nó. Điều kiện là shell chứ
  không phải chữ overlay.
  Neo: `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:42` và
  `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2164-2167`.
- **Đặt `L6-5` để cái tên thôi làm bằng chứng.** `global-search-context-card` mang chữ `card` trong
  khoá mà không dựng mặt phẳng nào, nên mã này nói thẳng rằng chỉ mảng `classes` mới là bằng chứng.
- **Đẩy chiều rộng ra khỏi mô-đun.** Dòng từ chối về chiều rộng ở
  `.workflows\designs\starci-academy\global-search-modal-20260815.md:259` thuộc `L7`, và trộn nó vào
  đây sẽ làm hai quyết định khác nhau dùng chung một câu.
- **Ghi hai rủi ro đo được vào `audit.md`** thay vì để luật nói như thể đã xong: `buildsCardInside`
  là `const: false` nên gate không biểu diễn được chính ngoại lệ mà luật cho phép, và
  `no-surface-branch-in-overlay` chỉ đọc file dưới `overlays/` nên cùng một khe vừa chứa ngoại lệ
  hợp lệ vừa chứa một vi phạm tương lai.
- **Sửa một neo sai trong bằng chứng nhận được.** Neo ngoại lệ được giao ở dòng `1224` của
  `global-search-modal-spacing-listbox-20260815-01.md`; file đó chỉ có 812 dòng. Dòng thật mang đúng
  câu ấy là `289`, và bảng `Anchor` dùng dòng `289`.
