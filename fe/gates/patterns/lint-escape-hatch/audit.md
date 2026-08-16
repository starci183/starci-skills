---
id: fe-patterns-lint-escape-hatch-audit
title: audit.md
slug: /gates/patterns/lint-escape-hatch/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật lint escape hatch.
---

# audit.md

> Version: `2.00` · Module: `lint-escape-hatch`

Audit này kiểm xem luật có quyết định được **một hành động duy nhất** từ ba dữ kiện — text trong
file, điều kiện của config, và hình dạng của ngoại lệ được xin — và chỉ từ đó.

## Verdict

Chấp nhận. Ba mã đóng, phân định được bằng **chỗ mà sai lầm nằm** chứ không bằng mức độ nghiêm trọng,
và không mã nào cần tên riêng của một sản phẩm để đọc.

Kèm một điều kiện phải nói thẳng: **chỉ một trong ba mã được giữ bởi một lint rule.** Module publish
đúng một rule, `no-inline-lint-config`, và rule đó giữ `LINT-ESCAPE-1`. Hai mã còn lại là
`documented`. Đó là kết quả đúng chứ không phải thiếu sót — nhưng nó có nghĩa là hai phần ba luật này
sống bằng người đọc, bằng một twin test chứng minh artifact, và bằng một audit thuộc module khác.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `LINT-ESCAPE-1` vs `LINT-ESCAPE-2` | Loại trừ được: text nằm trong source, so với điều kiện của config đã resolve |
| `LINT-ESCAPE-1` vs `LINT-ESCAPE-3` | Loại trừ được: một file tự miễn trừ, so với repo dựng sẵn chỗ miễn trừ |
| `LINT-ESCAPE-2` vs `LINT-ESCAPE-3` | Loại trừ được: directive còn tác dụng không, so với rule còn với tới đường dẫn đó không |
| `LINT-ESCAPE-1` vs prose hợp lệ | Loại trừ được bằng vị trí: ký tự không-trắng đầu tiên của comment |
| `LINT-ESCAPE-3` vs glob của repo | Loại trừ được: luật **nói gì**, so với luật **áp ở đâu** |
| `LINT-ESCAPE-2` vs `LINT-ADOPTION-4` | Loại trừ được: bên xuất bản options, so với bên tiêu thụ đã resolve ra chúng |
| Thiếu dữ kiện | Không suy đoán. Hỏi ca mà bypass đang bảo vệ, rồi mới quyết |

## Findings

- Ba mã ánh xạ gọn sang ba **chỗ** một escape hatch có thể sống: trong file, trong điều kiện của
  config, trong hình dạng của ngoại lệ. Đó là lý do chúng phân định được mà không cần bàn xem cái nào
  tệ hơn cái nào.
- Mã 1 và mã 2 là hai nửa của **một** hàng rào. Luật phẳng đã nói điều này và nó được bảo toàn: một
  repo chỉ có mã 1 đang báo cáo những cú bypass đã thành công.
- Áp lực không biến mất khi mã 1 được giữ, nó **chuyển chỗ** sang mã 3. Đó là quan sát quan trọng
  nhất của module: mã 3 nguy hiểm hơn mã 1 vì nó không để lại dấu vết trong bất kỳ file source nào,
  nên không ai đọc code mà thấy được.
- Ca "prose về directive" từng là một lỗi thật của artifact, không phải một giả định. Pattern không
  neo đã báo lỗi đúng cái comment giải thích vì sao file không có directive — nên cách duy nhất để
  gate xanh là xoá lời giải thích. Ca đó nay là ngoại lệ đóng và có twin test.
- `schema: []` là một neo mạnh hơn nó trông: nó không cấm allowlist bằng lời, nó làm allowlist
  **không có chỗ để viết vào** bên trong rule. Nhưng nó chỉ đóng được đường đi qua rule.
- Mã 2 phụ thuộc một giá trị mà artifact **publish được** nhưng **không quan sát được**. Chỗ quan sát
  nằm ở `refusesInlineConfig` của module `lint-adoption` — nghĩa là mã này đúng, và chỗ giữ nó nằm ở
  nơi khác.

## Decisions

- Giữ đúng ba mã: `LINT-ESCAPE-1`, `LINT-ESCAPE-2`, `LINT-ESCAPE-3`, nguyên số và nguyên nghĩa của
  luật phẳng trước đó. Các mã này đã được trích dẫn từ nơi khác; đánh số lại là làm gãy một trích dẫn
  ai đó đã viết.
- Giữ nguyên phán quyết trung tâm: escape hatch là text làm đổi tập luật áp cho chính file chứa nó,
  và cái sai nằm ở **ai quyết**, không ở độ rộng của cú bypass.
- Giữ nguyên bốn dòng trong bảng Forbidden của luật phẳng, chuyển thành cột "What it forbids" của
  bảng Situation Codes: `eslint-disable` trong source sản phẩm và `eslint-disable-next-line` kèm lý do
  về mã 1; allowlist theo đường dẫn và rule kiến trúc mức `warn` về mã 3. Không dòng nào bị bỏ.
- Ghi mã 2 và mã 3 là `documented` thay vì gọi twin test hoặc audit repo là "enforced". Twin test
  chứng minh **artifact**, không chứng minh một repo; audit là script chứ không phải lint rule. Gọi
  khác đi là làm bảng này nói dối đúng vào chỗ nó tồn tại để phản ánh đúng thực tế.
- Rút mọi neo về đường dẫn trong cây trust. Luật phẳng nêu neo triển khai bằng tên một repository cụ
  thể (`eslint.config.mjs` và thư mục plugin của nó); ở shelf này ví dụ phải đúng với bất kỳ front end
  nào, nên neo giữ ở artifact và twin test — thứ vẫn kiểm chứng được mà không cần một repo có tên.
- Tổng quát hoá ví dụ kiến trúc của luật phẳng: component riêng của một sản phẩm được đổi thành một
  cặp connected/presentational thường. Phán quyết của ví dụ không đổi — hai bản khác nhau ở chỗ ranh
  giới còn tồn tại hay không.
- Giữ ngoại lệ "glob là *ở đâu*, không phải *cho ai*" như một ngoại lệ **đóng**, kèm câu chặn đường
  lạm dụng: glob bẻ cong đúng bằng chỗ vừa đỏ là allowlist mặc áo config.

## Rủi ro còn mở

Hai trong ba mã chỉ ở tầng `documented`. Dưới đây là, với từng mã, thứ mà một lint rule **sẽ phải
nhìn thấy** mới giữ được nó — hoặc lý do không rule nào làm được.

- **`LINT-ESCAPE-2` — rule không nhìn thấy được `linterOptions`.** Một rule của module này sẽ phải
  đọc được `linterOptions.noInlineConfig` của config **đã merge**. Giá trị đó không nằm trong context
  mà ESLint đưa cho rule: rule nhận file, AST và option của chính nó, không nhận quyết định cấu hình
  đã sinh ra nó. Và đây là ranh giới cứng chứ không phải một thiếu sót có thể vá — thứ phải phán xét
  chính là cái đã quyết định rule có chạy hay không, nên nó phải đứng **ngoài** ESLint và đọc
  `eslint --print-config`. Việc đó đang được `refusesInlineConfig` làm, ở module `lint-adoption`,
  bằng một script mà ai đó phải chọn chạy. Nửa nhìn thấy được — directive nằm trong source — đã có
  rule của module này giữ, nhưng đó là mã 1 chứ không phải mã 2.

  Phần **`chưa neo được`** của mã này là bên tiêu thụ: không file nào trong module quan sát được một
  repo có thật sự spread options hay không. Neo hiện có chỉ chứng minh artifact publish đúng và twin
  test chạy đúng.

- **`LINT-ESCAPE-3` — rule không nhìn thấy được cái đã gỡ nó ra khỏi một đường dẫn.** Một rule bị
  `off` hoặc bị `ignores` cho một thư mục thì **không chạy**, nên không có gì để báo rằng nó không
  chạy — và đó chính xác là ca cần bắt. Đây là chế độ hỏng im lặng: thư mục được miễn trừ lint sạch,
  và con số lỗi giảm xuống trông như một cải thiện.

  Thứ gần nhất một rule làm được là lint **chính file config**: bắt một block `files` mang tên đúng
  một component, bắt một `ignores` trỏ vào cây source sản phẩm, bắt một mức khác `error` cho tên rule
  thuộc namespace canon. Nó bắt được ca lộ liễu và bỏ sót ca dựng danh sách bằng code hoặc đọc từ
  biến môi trường. Thứ giữ được đầy đủ vẫn là audit trên config đã in — lại là script.

  Phần đã neo được của mã 3 là hướng còn lại: `schema: []` đóng đường viết allowlist **vào trong**
  rule, và `recommended` publish đúng một mức không kèm key đường dẫn. Phần **`chưa neo được`** là
  allowlist dựng **quanh** rule: một `ignores` thêm vào sau, một block ghi đè mức, một glob thu hẹp
  bằng tay.

Ba rủi ro nữa, không thuộc một mã cụ thể:

- **`isProductSource` là path gate duy nhất trong artifact, và nó là một chuỗi.** Rule chỉ soi file
  có `/src/` trong đường dẫn. Điều đó đúng cho fixture — twin test cố ý dựng directive — nhưng nó
  cũng có nghĩa là một cây source sản phẩm **không** đặt dưới `src/` sẽ không bị soi, và sẽ không có
  ai được báo. Đây là một bất đồng được ghi lại chứ không phải một sửa đổi im lặng: cách chữa nằm ở
  chỗ khác, vì nó chạm tới cách mọi module định nghĩa "source sản phẩm", không chỉ module này.
- **Bảng `Tầng giữ` có thể bị đọc thành thước đo độ quan trọng.** Mã 3 là mã `documented`, và nó cũng
  là mã có sức phá lớn nhất, vì nó không để lại dấu vết trong file nào. Ai dùng bảng đó làm lý do coi
  nhẹ mã 3 là đang đọc ngược nó.
- **`LINT-ESCAPE-1` và `LINT-ESCAPE-3` từng bị gộp làm một trong lúc nói chuyện**, vì kết quả giống
  nhau: một chỗ không bị luật soi. Nếu thực tế cho thấy chúng cần tách rõ hơn nữa, đó là một đề xuất
  rule change có version, không phải một lần đọc linh hoạt.

## Re-audit Triggers

- Module publish rule thứ hai của nó — bảng `Tầng giữ` phải đổi trong cùng một lần.
- Có ai đó đề nghị mở `schema` của rule để nhận option, dù với tên gì.
- Có `ignores`, block ghi đè mức, hoặc glob thu hẹp xuất hiện trong một config tiêu thụ canon.
- Một repo có đủ rule ở `error` nhưng `refusesInlineConfig` là `false`.
- Có cây source sản phẩm không nằm dưới `src/`, khiến path gate của rule bỏ sót.
- Pattern bắt directive được sửa — phải kiểm lại rằng prose về directive vẫn hợp lệ.
- Một rule lint chính file config được đề xuất; hai dòng `documented` phải được đọc lại.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
