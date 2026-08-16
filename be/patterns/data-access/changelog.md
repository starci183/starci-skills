---
id: be-patterns-data-access-changelog
title: changelog.md
slug: /be/patterns/data-access/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật data access.
---

# changelog.md

> Current version: `2.00` · Module: `data-access`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã tình huống **không bao giờ được đánh số lại**. Một mã bị rút thì ghi là đã rút và số của nó không
dùng lại — vì mã được trích dẫn từ file luật khác và từ task record cũ, nên đổi số một mã là làm gãy
một trích dẫn ai đó đã viết ra rồi.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: shelf và hình dạng module.

- **Chuyển shelf.** `be/canon/patterns/data-access.md` (một file phẳng) → `be/patterns/data-access/`
  (module năm record). File phẳng **không bị xoá và không bị sửa**; nó vẫn là bản ghi lịch sử của
  luật này. Toàn bộ `id` và `slug` được đặt mới theo shelf `be/patterns/`.
- **Giữ nguyên năm mã.** `DATA-1` … `DATA-5` giữ nguyên số và nguyên nghĩa từ bản phẳng. Không mã nào
  bị đánh số lại, không mã nào bị thêm vào. Module này có năm mã và kết thúc với năm mã.
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ tầng thật sự giữ nó: `DATA-1`, `DATA-2`, `DATA-3` là
  `enforced` và **nêu đích danh** rule giữ chúng (`starci-be/must-inject-entity-manager`,
  `starci-be/no-injected-repository`, `starci-be/require-entity-table-name`); `DATA-4` và `DATA-5` là
  `documented`. Khoảng cách hai mã ấy là **điểm chính** của bảng chứ không phải chỗ hỏng: nó nói ra
  rằng hai luật đó do người đọc giữ, và ai không biết điều đó sẽ tưởng CI đã giữ hộ mình.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào một file thật trong repository tham chiếu, kèm câu "nhìn cái
  gì ở đó". Cả năm mã đều neo được; không mã nào phải ghi `chưa neo được`. `DATA-2` neo bằng hai loại
  bằng chứng — một handler ghi nhiều bảng trong một transaction, cộng với việc repository injection
  xuất hiện không lần nào — vì bằng chứng phủ định đứng một mình chỉ nói "chưa ai vi phạm".
- **Viết lại phần tình huống theo từng mã (`vi.md`).** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận
  biết, câu tự hỏi, ranh giới với các mã kề, và danh sách tình huống hay gặp. Hai mã `documented`
  được ghi thẳng là **không có lint nào giữ**, ngay trong phần của chúng.
- **Viết lại phần ví dụ cho đủ case (`example.md`).** Mỗi mã nhiều case, mỗi case đặt ĐÚNG cạnh SAI,
  kèm mục ngoại lệ và nhầm lẫn. Bốn ví dụ của bản phẳng được giữ lại nguyên ý và bổ sung thêm các
  hình dạng lỗi mà bản phẳng chưa vẽ ra: repository mặc áo kiểu, chuỗi gọi nhiều tầng chỉ đúng ở tầng
  một, chữ ký nhận `manager` nhưng thân hàm không dùng, lock giữ trên một session còn việc chạy trên
  session khác, và chữa N+1 bằng `eager`.
- **Ghi rõ hai ngoại lệ là CÁCH ĐỌC, không phải câu chữ.** Manager lấy từ query runner tự mở, và
  repository dẫn ra từ manager transactional — cả hai đều suy ra từ code thật chứ không có trong chữ
  của bản phẳng. Chúng nằm trong `INDEX.md` và được ghi lại trong "Rủi ro còn mở" của `audit.md`, thay
  vì được nhét vào luật trong im lặng.
- **Không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với ví dụ mà chúng
  phân định. Module đúng năm record.
- **Rút mọi ví dụ về TypeScript trung tính.** Ví dụ không mang tên sản phẩm, tên công ty hay tên
  repository. Bảng `Anchor` là chỗ **duy nhất** mang path của repository, và nó mang path để kiểm
  chứng chứ không phải để minh hoạ.

## Trước 2.00

Luật sống dưới dạng một file phẳng `be/canon/patterns/data-access.md`, gồm phần định nghĩa, năm rule
`DATA-1` … `DATA-5`, một bảng cấm và bốn ví dụ. Ba rule lint giữ nó nằm ở
`sources/be/data-access.mjs` và cả ba đo được không vi phạm ở repository tham chiếu nên ship ở mức
`error`. File phẳng ấy vẫn còn nguyên tại chỗ cũ.
