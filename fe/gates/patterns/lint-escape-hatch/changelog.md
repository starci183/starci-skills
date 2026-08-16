---
id: fe-patterns-lint-escape-hatch-changelog
title: changelog.md
slug: /gates/patterns/lint-escape-hatch/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật lint escape hatch.
---

# changelog.md

> Current version: `2.00` · Module: `lint-escape-hatch`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã `LINT-ESCAPE-<n>` **không** đi theo version. Mã được trích dẫn từ các file luật khác và từ các
task record đã đóng; đánh số lại một mã là làm gãy một trích dẫn ai đó đã viết. Bất đồng với một mã
được ghi vào `audit.md` mục "Rủi ro còn mở", không bao giờ được sửa im lặng vào chỗ khác.

## 2.00 — 2026-08-16

Đổi số chính vì **hình dạng** của luật đổi, không phải nội dung của nó: từ **một file phẳng** thành
**module năm record**. Không luật nào bị thêm, bớt hay nới ra trong lần này.

- **Chuyển hình dạng.** `fe/canon/patterns/lint-escape-hatch.md` → `gates/patterns/lint-escape-hatch/`
  với năm record: `INDEX.md` (luật, máy đọc trước), `vi.md` (tình huống), `example.md` (case và ngoại
  lệ), `audit.md` (phản biện), `changelog.md` (lịch sử). File phẳng cũ vẫn nằm nguyên chỗ của nó;
  module này là bản diễn đạt đầy đủ hơn của cùng một luật.
- **Giữ nguyên ba mã.** `LINT-ESCAPE-1` source sản phẩm không chứa inline directive ·
  `LINT-ESCAPE-2` flat config làm inline configuration vô hiệu · `LINT-ESCAPE-3` không có allowlist.
  Nguyên số, nguyên nghĩa.
- **Thêm bảng `Tầng giữ`.** Mỗi mã làm rõ tầng nào đang thực sự giữ nó. `LINT-ESCAPE-1` là
  `enforced` bởi `no-inline-lint-config` — rule duy nhất module này publish. `LINT-ESCAPE-2` và
  `LINT-ESCAPE-3` là `documented`, và lý do được viết ra thay vì để trống: một ESLint rule chạy **bên
  trong** cái config mà hai mã kia phải phán xét, nên nó không nhìn thấy được `linterOptions` đã
  merge, cũng không nhìn thấy được cái vừa gỡ nó ra khỏi một đường dẫn — rule bị `off` thì không chạy
  để mà báo rằng nó đang `off`.
- **Thêm bảng `Anchor`.** Cả ba mã trỏ vào `sources/fe/lint-escape-hatch.mjs` kèm thứ cần tìm ở đó:
  `INLINE_DIRECTIVE` neo ở đầu comment, vòng duyệt `getAllComments()` và `isProductSource` cho mã 1;
  `linterOptions` đóng băng và xuất khẩu cạnh `rules` cho mã 2; `schema: []` cùng `recommended` chỉ
  có một mức và không có key đường dẫn cho mã 3. Bằng chứng phụ ở twin test,
  `sources/fe/index.mjs`, `sources/fe/lint-adoption.mjs` và `scripts/audit-fe-lint-adoption.mjs`.
- **Ghi ra chỗ chưa neo được.** Mã 2 neo được bên **xuất bản** và `chưa neo được` bên **tiêu thụ**:
  không file nào trong module quan sát được một repo có thật sự spread linter options hay không. Mã 3
  neo được đường viết allowlist **vào trong** rule và `chưa neo được` đường dựng allowlist **quanh**
  rule bằng `ignores`, block ghi đè mức hoặc glob thu hẹp. Cả hai ghi vào `audit.md` thay vì làm tròn
  thành đã neo.
- **Chuyển bảng Forbidden thành cột.** Bốn dòng "Never" của luật phẳng nay là cột "What it forbids"
  của bảng Situation Codes, mỗi dòng đứng cạnh đúng mã mà nó cấm: `eslint-disable` trong source sản
  phẩm và `eslint-disable-next-line` kèm lý do về mã 1; allowlist theo đường dẫn cho một component và
  rule kiến trúc ở mức `warn` về mã 3. Không dòng nào bị bỏ.
- **Đặt ngoại lệ thành tập đóng.** Năm ngoại lệ, mỗi cái nêu rõ mã nó áp vào: prose về directive ·
  fixture dựng ra chuỗi cấm · glob là *ở đâu* không phải *cho ai* · config dùng chung sở hữu cú pháp
  hợp lệ · sửa rule không phải miễn trừ. Hai cái đầu vốn đã sống trong artifact và twin test; ba cái
  sau vốn đã sống trong prose của luật phẳng. Lần này chúng được gom về một chỗ và đóng lại.
- **Tổng quát hoá phần neo triển khai.** Luật phẳng nêu anchor bằng tên một repository cụ thể và một
  component riêng của một sản phẩm. Ở shelf này, ví dụ phải đọc được ở bất kỳ front end nào, nên neo
  giữ ở artifact và twin test, còn ví dụ dùng TSX thường, flat config thường và một namespace plugin
  chỉ để đọc được. Cặp connected/presentational trong ví dụ kiến trúc được viết lại bằng tên chung;
  phán quyết của nó không đổi.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục ngoại lệ
  và mục "trông giống nhưng không phải mã này"; đóng lại bằng ánh xạ yêu cầu, bảng phân định ranh
  giới và danh sách sai lầm lặp lại.
- **Không có `prompt.md`.** Ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định. Module có đúng
  năm record.

## Trước 2.00

Luật sống trong một file phẳng `fe/canon/patterns/lint-escape-hatch.md` với các mục `Definition`,
`Rules`, `Forbidden`, `Examples`. Chính file đó đặt ra ba mã và phán quyết trung tâm — escape hatch
là text làm đổi tập luật áp cho chính file chứa nó, nên tác giả của vi phạm trở thành tác giả của
việc đó có phải vi phạm hay không — và cả hai được mang sang đây nguyên vẹn.
