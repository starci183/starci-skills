---
id: fe-patterns-cache-key-changelog
title: changelog.md
slug: /gates/patterns/cache-key/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật cache key.
---

# changelog.md

> Current version: `2.00` · Module: `cache-key`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Số hiệu mã (`CACHE-<n>`) **không** đi theo phiên bản. Mã được trích dẫn từ những file luật khác và từ
các bản ghi công việc đã đóng, nên đánh số lại một mã là làm hỏng một trích dẫn ai đó đã viết. Thêm
mã thì nối vào cuối; bỏ một mã thì để lại chỗ trống chứ không dồn số.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: shelf và hình dạng module.

- **Chuyển shelf và đổi hình dạng.** Một file luật phẳng `fe/canon/patterns/cache-key.md` trở thành
  một module năm record ở `gates/patterns/cache-key/`. File phẳng vẫn nằm nguyên chỗ cũ; bản này
  **diễn đạt lại** nó đầy đủ hơn, không thay nó bằng một luật khác. Toàn bộ `id` và `slug` đặt theo
  shelf mới.
- **Giữ nguyên năm mã và nghĩa của chúng.** `CACHE-1` đến `CACHE-5` giữ đúng số, đúng phạm vi, đúng
  từng quyết định của file luật phẳng: fetcher đọc tham số ra từ key; fingerprint chứ không phải
  credential; một hook một dòng; `null` thay cho placeholder; lỗi ở `error` chứ không ở dữ liệu;
  nghĩa của `null` viết tại chỗ bóc kết quả. Không mã nào được thêm, bớt hay đánh số lại.
- **Thêm bảng `Tầng giữ`.** Mỗi mã nói ra tầng thật sự đang giữ nó: `unrepresentable`, `enforced` hay
  `documented`. Kết quả của lần đo này là **năm dòng `documented`** — module không có
  `sources/fe/cache-key.mjs` và không publish rule nào. Bảng này tồn tại để khoảng trống đó **được
  nhìn thấy**, chứ không phải để lấp nó.
- **Tách bạch rule của luật hàng xóm.** Bản phẳng có một câu về `sources/fe/the-split.mjs` dễ bị đọc
  thành "đã có lint giữ". Bảng `Tầng giữ` làm rõ: rule `presentational-purity` giữ **chỗ** key được
  dựng — trong nửa connected, nơi có người đọc và tham số route để dựng nó — và không giữ gì về
  **thứ** nằm trong key. Đó là quan hệ hàng xóm, không phải enforcement, và không được đếm vào bảng.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào một đoạn code thật kiểm chứng được, kèm thứ cần tìm ở đó.
  Cả năm mã đều neo được; không mã nào phải ghi `chưa neo được`. Bảng này là chỗ **duy nhất** trong
  module trỏ ra ngoài, và trỏ bằng đường dẫn tương đối tới gốc repo chứ không gọi tên repo.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi hook đặt tên cho một câu trả lời được cache
  đều rơi vào ít nhất một mã, và không có query nào nhỏ tới mức được miễn.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và nhầm lẫn. Thêm bảng ánh xạ yêu cầu, bảng phân định ranh giới và danh sách sai lầm lặp lại.
- **Nói rõ hai nghĩa của chữ `null`.** `null` ở vị trí key (`CACHE-4`, chưa hỏi) và `null` ở vị trí
  kết quả (`CACHE-5`, đã hỏi và câu trả lời là không có gì) được tách bạch ở cả ba record, vì đây là
  chỗ đọc nhầm nhiều nhất của module.
- **Rút mọi ví dụ về hook và TSX thuần.** Bản phẳng gọi tên hai hook riêng của một ứng dụng cụ thể
  ngay trong phần ví dụ; ở bản này chúng được tổng quát hoá, và tên thật chỉ còn xuất hiện trong bảng
  `Anchor` — nơi việc trỏ vào code thật là mục đích chứ không phải rò rỉ.
- **Không có `prompt.md`.** Module đúng năm record.

## Các phiên bản trước

`1.x` là file luật phẳng `fe/canon/patterns/cache-key.md`: phần `Definition`, năm mục `Rules` mang mã
`CACHE-1`…`CACHE-5`, một bảng `Forbidden` tám dòng và năm cặp ví dụ. Toàn bộ nội dung đó được mang
sang bản `2.00`; bảng `Forbidden` phân bổ vào cột "Forbids" của `Situation Codes` và vào các mục
ngoại lệ trong `example.md`.
