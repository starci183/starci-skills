---
id: fe-patterns-lint-adoption-changelog
title: changelog.md
slug: /gates/patterns/lint-adoption/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật lint adoption.
---

# changelog.md

> Current version: `2.00` · Module: `lint-adoption`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã `LINT-ADOPTION-<n>` **không** đi theo version. Mã được trích dẫn từ các file luật khác và từ các
task record đã đóng; đánh số lại một mã là làm gãy một trích dẫn ai đó đã viết. Bất đồng với một mã
được ghi vào `audit.md` mục "Rủi ro còn mở", không bao giờ được sửa im lặng vào chỗ khác.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, không phải nội dung của nó: từ **một file phẳng** thành
**module năm record**. Không luật nào bị thêm, bớt hay nới ra trong lần này.

- **Chuyển hình dạng.** `fe/canon/patterns/lint-adoption.md` → `gates/patterns/lint-adoption/` với năm
  record: `INDEX.md` (luật, máy đọc trước), `vi.md` (tình huống), `example.md` (case và ngoại lệ),
  `audit.md` (phản biện), `changelog.md` (lịch sử). File phẳng cũ vẫn nằm nguyên chỗ của nó; module
  này là bản diễn đạt đầy đủ hơn của cùng một luật.
- **Giữ nguyên năm mã.** `LINT-ADOPTION-1` gắn nguyên khối · `LINT-ADOPTION-2` đo trên file
  production thật · `LINT-ADOPTION-3` mọi rule ở `error` · `LINT-ADOPTION-4` config đã resolve từ
  chối inline config · `LINT-ADOPTION-5` audit đỏ thì dừng trước khi sửa source. Nguyên số, nguyên
  nghĩa.
- **Thêm bảng `Tầng giữ`.** Mỗi mã làm rõ tầng nào đang thực sự giữ nó. Cả năm dòng là `documented`,
  vì artifact của module publish `rules = {}`. Lý do được viết ra thay vì để trống: một ESLint rule
  chạy **bên trong** cái config mà luật này phải phán xét, nên nó không nhìn thấy được rule nào vắng
  mặt, rule nào bị hạ mức, hay directive có bị vô hiệu hay không. Thứ giữ luật này là một audit chạy
  trên `eslint --print-config`, và một audit là script chứ không phải rule.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật kèm thứ cần tìm ở đó: artifact
  `sources/fe/lint-adoption.mjs` cho mã 1, 3, 4; script `scripts/audit-fe-lint-adoption.mjs` cho mã
  2; điều kiện đóng pass trong skill lint-sync cho mã 5. Kèm bằng chứng phụ ở
  `scripts/sync-fe-lint.mjs`, `sources/fe/index.mjs` và `sources/fe/lint-escape-hatch.mjs`.
- **Ghi ra chỗ chưa neo được.** Mã 5 chỉ có neo cho công việc lint-sync; không skill Apply nào của
  design hay fidelity đọc audit này, nên phần "Apply dừng lại" ở đó là prose. Ghi vào `audit.md`
  thay vì làm tròn thành đã neo.
- **Chuyển bảng Forbidden thành cột.** Bốn dòng "Never" của luật phẳng nay là cột "What it forbids"
  của bảng Situation Codes, mỗi dòng đứng cạnh đúng mã mà nó cấm. Không dòng nào bị bỏ.
- **Đặt ngoại lệ thành tập đóng.** Năm ngoại lệ, mỗi cái nêu rõ mã nó áp vào: config thuộc về repo ·
  plugin khác của repo · source candidate không được miễn · sửa wiring không phải sửa sản phẩm · nợ
  được ghi chứ không được hạ. Chúng đã có sẵn trong artifact và trong luật vận hành; lần này được
  gom về một chỗ và đóng lại.
- **Tổng quát hoá phần neo triển khai.** Luật phẳng nêu anchor bằng tên một repository cụ thể. Ở
  shelf này, ví dụ phải đọc được ở bất kỳ front end nào, nên neo giữ ở artifact và script, còn ví dụ
  dùng flat config thường, TSX thường và một namespace plugin chỉ để đọc được.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục ngoại lệ
  và mục "trông giống nhưng không phải mã này"; đóng lại bằng ánh xạ yêu cầu, bảng phân định ranh
  giới và danh sách sai lầm lặp lại.
- **Không có `prompt.md`.** Ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định. Module có đúng
  năm record.

## Trước 2.00

Luật sống trong một file phẳng `fe/canon/patterns/lint-adoption.md` với các mục `Definition`,
`Rules`, `Forbidden`, `Examples`. Chính file đó đặt ra năm mã và phán quyết trung tâm — adoption là
config đã resolve cho một file production thật — và cả hai được mang sang đây nguyên vẹn.
