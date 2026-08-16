---
id: fe-patterns-lint-adoption-audit
title: audit.md
slug: /fe/patterns/lint-adoption/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật lint adoption.
---

# audit.md

> Version: `2.00` · Module: `lint-adoption`

Audit này kiểm xem luật có quyết định được **một hành động duy nhất** từ config đã resolve, và chỉ
từ đó — chứ không từ tên file, tên package hay cảm giác "repo này chắc ổn".

## Verdict

Chấp nhận. Năm mã đóng, phân định được bằng bốn trường mà audit in ra, và không mã nào cần tên riêng
của một sản phẩm để đọc.

Kèm một điều kiện phải nói thẳng: **không mã nào trong module này được giữ bởi một lint rule.**
Module publish `rules = {}`, nên cả năm dòng trong bảng `Tầng giữ` đều là `documented`. Đó là kết
quả đúng, không phải thiếu sót — nhưng nó có nghĩa là luật này sống bằng người đọc và bằng một script
mà ai đó phải chọn chạy.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `LINT-ADOPTION-1` vs `LINT-ADOPTION-2` | Loại trừ được: mã 1 là cách gắn, mã 2 là bằng chứng đã gắn |
| `LINT-ADOPTION-1` vs `LINT-ADOPTION-3` | Loại trừ được bằng trường in ra: `missing` về mã 1, `nonError` về mã 3 |
| `LINT-ADOPTION-3` vs `LINT-ADOPTION-4` | Loại trừ được: mức của rule, so với việc directive có tác dụng hay không |
| `LINT-ADOPTION-2` vs `LINT-ADOPTION-5` | Loại trừ được: chưa đo, so với đã đo ra đỏ mà vẫn đi tiếp |
| `LINT-ADOPTION-4` vs `lint-escape-hatch` | Loại trừ được: điều kiện của config, so với directive nằm trong source |
| Luật nói gì vs luật áp ở đâu | Loại trừ được: glob thuộc repo, rule và mức thì không |
| Thiếu dữ kiện | Không suy đoán. Chạy audit với một probe production rồi mới kết luận |

## Findings

- Bốn trường của kết quả audit (`missing`, `nonError`, `refusesInlineConfig`, `ok`) ánh xạ gần như
  một-một sang bốn mã đầu. Đó là lý do luật này phân định được mà không cần câu hỏi phụ nào.
- "Đã import plugin" bị loại hẳn khỏi tập bằng chứng. Nó mô tả repo **có gì**, còn luật hỏi ESLint
  **làm gì**.
- Mã 1 và mã 3 hay bị gộp làm một trong lúc nói chuyện, nhưng cách sửa của chúng khác nhau hoàn
  toàn: mã 1 sửa bằng cách mirror lại, mã 3 sửa bằng cách trả nợ rồi bật đủ mức.
- `LINT-ADOPTION-4` phụ thuộc một giá trị **không do module này publish**: linter options được viết ở
  module `lint-escape-hatch`. Luật vẫn đúng, nhưng chỗ giữ nó nằm ở nơi khác, và người sửa cần biết
  điều đó trước khi đi tìm.
- Mã 5 là mã duy nhất nói về **hành vi của người làm việc**, không về nội dung một file. Đó cũng là
  mã neo yếu nhất.
- Ngoại lệ "glob thuộc repo" là ngoại lệ được dùng sai nhiều nhất: nó mở đúng một thứ, và từng bị
  hiểu rộng ra thành "cấu hình thì tuỳ repo".

## Decisions

- Giữ đúng năm mã: `LINT-ADOPTION-1`…`LINT-ADOPTION-5`, nguyên số và nguyên nghĩa của luật phẳng
  trước đó. Các mã này đã được trích dẫn từ nơi khác; đánh số lại là làm gãy một trích dẫn có sẵn.
- Giữ nguyên phán quyết trung tâm: adoption là **config đã resolve cho một file production thật**.
- Giữ nguyên bốn dòng trong bảng Forbidden của luật phẳng, chuyển thành cột "What it forbids" của
  bảng Situation Codes chứ không bỏ đi cái nào.
- Ghi cả năm dòng `Tầng giữ` là `documented` thay vì gọi audit repo là "enforced". Audit là một
  script, không phải một lint rule; gọi khác đi là làm bảng này nói dối đúng vào chỗ nó tồn tại để
  phản ánh đúng thực tế.
- Rút mọi neo về đường dẫn trong cây trust. Luật phẳng nêu neo bằng tên một repository cụ thể; ở
  shelf này ví dụ phải đúng với bất kỳ front end nào, nên neo giữ ở artifact và script — thứ vẫn
  kiểm chứng được mà không cần một repo có tên.
- Giữ ngoại lệ "sửa wiring không phải sửa sản phẩm" như một ngoại lệ **đóng**, có boundary duyệt
  trước.

## Rủi ro còn mở

Cả năm mã chỉ ở tầng `documented`. Dưới đây là, với từng mã, thứ mà một lint rule **sẽ phải nhìn
thấy** mới giữ được nó — hoặc lý do không rule nào làm được.

- **`LINT-ADOPTION-1` — không rule nào nhìn thấy "một khối".** Rule chạy trên AST của một file; nó
  không biết `rules` trong config tới từ một spread hay từ ba mươi dòng gõ tay, vì tới lúc rule chạy
  thì cả hai đã thành cùng một object. Thứ gần nhất là một rule lint **chính file config** — bắt
  `eslint.config.mjs` không được có key `rules` chứa tên namespace canon, chỉ được spread. Nó bắt
  được ca gõ tay lộ liễu, và bỏ sót ca dựng danh sách bằng code. Hiện tại thứ bắt được drift là script
  mirror với digest nội dung, và nó chỉ chạy khi có người gọi.
- **`LINT-ADOPTION-2` — không rule nào chứng minh được một phép đo đã xảy ra.** Đây là ranh giới
  cứng: mã này nói về một hành động ngoài source. Chỉ có gate ở tầng cao hơn mới giữ được — một job
  CI chạy audit và fail build khi `ok: false`, hoặc một pre-push hook. Ở tầng lint thì không.
- **`LINT-ADOPTION-3` — rule không nhìn thấy được mức của chính nó.** Một rule chỉ được gọi khi nó
  đã được bật; rule bị `off` không chạy để mà báo là nó đang `off`, và đó chính là ca cần bắt. Muốn
  giữ được, thứ chạy phải đứng **ngoài** ESLint và đọc `--print-config` — đúng việc mà audit đang
  làm. Rủi ro còn lại: audit chỉ so với `recommended` **hiện có trong cây trust**, nên bảy rule đang
  nợ (ghi ở sổ nợ) không xuất hiện trong `missing`. Repo có thể `ok: true` mà vẫn đang được lint bởi
  ít rule hơn ngày hôm trước. Con số đúng, phạm vi thì chưa đủ, và đó là khoản nợ chứ không phải một
  cách đọc khác.
- **`LINT-ADOPTION-4` — rule nhìn thấy được directive, nhưng không nhìn thấy được `linterOptions`.**
  Một rule của module này sẽ phải đọc được `linterOptions.noInlineConfig` của config đã merge, thứ
  không nằm trong context mà ESLint đưa cho rule. Nửa nhìn thấy được — directive trong source — đã có
  rule giữ, nhưng rule đó thuộc module `lint-escape-hatch`, nên theo đúng định nghĩa của bảng
  `Tầng giữ` ở đây nó không được tính là `enforced` cho mã này.
- **`LINT-ADOPTION-5` — neo một phần, và phần chưa neo là phần hay hỏng nhất.** Điều kiện đóng pass
  chỉ tồn tại trong skill lint-sync; **không file nào trong các skill Apply của design và fidelity
  đọc audit này**, nên câu "Apply dừng lại khi audit đỏ" ở đó là prose và không có gì kiểm. Muốn giữ
  được thì phải là một bước bắt buộc trong chính các skill đó, hoặc một hook chạy audit trước lần
  ghi source sản phẩm đầu tiên. Đây là mục `chưa neo được` của module.

Hai rủi ro nữa, không thuộc một mã cụ thể:

- **Người đọc dễ tưởng năm dòng `documented` là dấu hiệu luật yếu.** Ngược lại: nó là chỗ luật này
  trung thực nhất. Nhưng nếu có ai đó dùng bảng đó làm lý do bỏ qua luật thì đó là một hiểu sai cần
  bị bắt ngay, không phải một lần chọn khác đi.
- **`LINT-ADOPTION-2` và `LINT-ADOPTION-5` gần nhau tới mức từng bị coi là một.** Nếu thực tế cho
  thấy chúng phải tách rõ hơn nữa, đó là một đề xuất rule change có version, không phải một lần đọc
  linh hoạt.

## Re-audit Triggers

- Module publish rule đầu tiên của nó — bảng `Tầng giữ` phải đổi trong cùng một lần.
- Bảy rule đang nợ được mang về, hoặc danh sách nợ dài thêm.
- Có repo `ok: true` mà vẫn để lọt một vi phạm canon đã biết.
- Có ai đó đề nghị thêm allowlist theo đường dẫn, hoặc một mức thấp hơn `error` cho bất kỳ glob nào.
- Một skill Apply bắt đầu đọc audit này — mã 5 chuyển từ `chưa neo được` sang có neo.
- Ngoại lệ "glob thuộc repo" được viện dẫn cho một thứ không phải glob.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
