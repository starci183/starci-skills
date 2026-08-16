---
id: fe-patterns-contract-changelog
title: changelog.md
slug: /fe/patterns/contract/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Contract.
---

# changelog.md

> Current version: `2.00` · Module: `contract`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

**Mã không bao giờ được đánh số lại và không bao giờ bị xoá.** `CONTRACT-<n>` được trích dẫn từ những
file luật khác và từ những task record đã viết xong; đổi số một mã là làm gãy trong im lặng một trích
dẫn ai đó đã đặt. Một tình huống bị rút lại vẫn giữ số của nó và nói rõ là đã rút.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, không phải nội dung của luật đổi.

- **Chuyển từ một file luật phẳng sang module năm record.** `fe/canon/patterns/contract.md` là một
  file duy nhất gồm `Definition`, `Rules`, `Forbidden`, `Examples`. Nay nó là
  `fe/patterns/contract/` với `INDEX.md` (máy đọc trước, tiếng Anh), `vi.md` (tình huống nghiệp vụ),
  `example.md` (case và ngoại lệ), `audit.md` (phản biện) và `changelog.md`. File luật phẳng **không
  bị xoá và không bị sửa**; module này là cách diễn đạt đầy đủ hơn của cùng một luật đó.

- **Giữ nguyên mười ba mã.** `CONTRACT-1` đến `CONTRACT-13`, đúng số và đúng nghĩa như luật phẳng đã
  đặt. Không mã nào được thêm, gộp, tách hay đánh số lại. Chỗ nào module này không đồng ý với luật
  phẳng thì **giữ nguyên luật phẳng** và ghi bất đồng vào *Rủi ro còn mở* của `audit.md` — cụ thể là
  `text-left` (luật cấm, rule cố ý cho phép).

- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ tầng thật sự giữ nó: `unrepresentable` khi một union đóng
  hoặc một branded type làm giá trị sai **không viết ra được**, `enforced` khi một rule trong
  `sources/fe/contract.mjs` bắt được và **gọi được tên rule đó**, `documented` khi chỉ có người đọc
  giữ. Kết quả: 9 `enforced`, 2 `unrepresentable`, 2 `documented`.

  Con số này **không** suy ra được bằng phép trừ 13 mã − 10 rule = 3 hàng `documented`, và lý do đã
  ghi trong `audit.md`: hai mã được type giữ chứ không cần rule, và `CONTRACT-9` được **hai** rule
  giữ. Bảng nói cái đo được, không nói cái tính ra được.

- **Thêm bảng `Anchor`.** Mỗi mã chỉ vào một đường dẫn code thật và nói rõ nhìn cái gì ở đó. Luật
  không chỉ được vào code thật là một đề xuất, không phải một luật. Cả mười ba mã đều neo được; không
  mã nào phải ghi `chưa neo được`.

  Neo của `CONTRACT-12` là một neo vào **mâu thuẫn** — union hiện vẫn nhận vài token mà rule của chính
  mã đó bác. Nó vẫn là neo hợp lệ, vì thứ luật nói tới chỉ được ra bằng ngón tay, và bất đồng được ghi
  ở `audit.md` thay vì được sửa lặng ở một bên.

- **Viết lại theo từng mã.** `vi.md` cho mỗi mã một mục gồm tình huống, dấu hiệu nhận biết, câu tự
  hỏi, ranh giới với các mã kề, và danh sách tình huống nghiệp vụ hay gặp. `example.md` cho mỗi mã
  nhiều case, mỗi case đặt ĐÚNG cạnh SAI, kèm mục ngoại lệ và nhầm lẫn.

- **Rút mọi ví dụ về TSX thường.** Bỏ tên sản phẩm, tên repository và tên component riêng. Chỗ luật
  gốc gọi tên một component private, ví dụ gọi bằng vai trò: frame là `Tree`, primitive vendor là
  `Panel`, surface branch giữ tên vai trò của nó.

- **Giữ lại mọi quyết định thật của luật phẳng**, kể cả những quyết định nghe như chi tiết triển
  khai: công thức lề bất đối xứng của row trong joined list, luật fact thuộc list host và
  `description` dành cho caption của cả list, lệnh cấm bảng compound cho `Card > Card.Content`, lệnh
  cấm prop boolean chọn giữa hai sắp xếp, và hai lần đảo chiều đã được ghi (bản đồ con bị bỏ rồi quay
  lại dưới dạng type; union host mở rộng để một arrangement không còn phải trốn xuống tầng leaf).

- **Không có `prompt.md`.** Ánh xạ yêu cầu sang mã và bảng phân định ranh giới nằm cuối `example.md`,
  cùng chỗ với những ví dụ mà chúng phân định. Module có đúng năm record.

## Các phiên bản trước

Trước `2.00`, luật này sống dưới dạng một file phẳng ở `fe/canon/patterns/contract.md` và không mang
số phiên bản riêng. Lịch sử thay đổi của nó nằm trong lịch sử git của chính file đó, và trong những
đoạn ghi lại quyết định mà file đó vẫn giữ: vì sao bản đồ con bị bỏ, vì sao nó quay lại, và vì sao
union host phải nhận `ul`, `ol`, `li` và `form`.
