---
id: fe-patterns-type-safety-audit
title: audit.md
slug: /fe/patterns/type-safety/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật type-safety.
---

# audit.md

> Version: `2.00` · Module: `type-safety`

Audit này kiểm hai thứ: luật có chọn được **một** mã từ dữ kiện đã nêu hay không, và mỗi mã có
**thật sự được ai đó giữ** hay không — bằng rule, bằng hệ kiểu, hay chỉ bằng người đọc.

## Verdict

Chấp nhận, kèm một khoảng cách được ghi nhận chứ không bị che. Năm mã phân định được bằng ba dữ kiện
khách quan — đường dẫn file, hình dạng của việc xoá kiểu, và nguồn gốc của giá trị. Nhưng **chỉ một
trên năm mã có rule giữ**, và đó là con số phải nói ra chứ không phải con số phải chữa.

Bốn mã còn lại chia làm hai loại khác hẳn nhau, và gộp chúng lại là cách đọc sai bản audit này:

- **Bàn giao có chủ đích** — `TYPE-SAFETY-2`, `TYPE-SAFETY-3`. Có rule giữ, chỉ là rule của người
  khác, và module này nói rõ tên rule ấy.
- **Không cơ chế nào giữ được** — `TYPE-SAFETY-4`, `TYPE-SAFETY-5`. Đây là phần của luật mà một
  checker không thể nhận lấy nếu không biến thành thủ tục.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `TYPE-SAFETY-1` vs `TYPE-SAFETY-2` | Loại trừ được bằng bán kính: một dòng, hay một kiểu đi theo giá trị |
| `TYPE-SAFETY-1` vs `TYPE-SAFETY-4` | Loại trừ được bằng **đường dẫn**, không cần phán đoán |
| `TYPE-SAFETY-1` vs `TYPE-SAFETY-5` | Loại trừ được bằng cú pháp: có đi xuyên `unknown` hay không |
| `TYPE-SAFETY-2` vs `TYPE-SAFETY-5` | Loại trừ được: lý do biện hộ cho một dòng, không biện hộ cho một kiểu |
| `TYPE-SAFETY-3` vs mọi mã | Loại trừ được: mã duy nhất không nói về việc tắt kiểm |
| Cast đi **vào** `unknown` | Không thuộc mã nào; đi ngược chiều xoá kiểu và được nêu thành ngoại lệ đóng |
| Thiếu dữ kiện nguồn gốc giá trị | Hỏi **một** câu: giá trị này từ ngoài chương trình vào, hay dựng bên trong? |

## Findings

- **`no-double-cast` khớp đúng một hình dạng cú pháp, và khớp đủ cho hình dạng ấy.** Nó nhận diện
  cast ngoài của cặp `x as unknown as T` bằng cách nhìn `TSAsExpression` có operand cũng là
  `TSAsExpression` với `typeAnnotation` là `TSUnknownKeyword`. Không có false positive nào đáng kể vì
  hình dạng ấy không xuất hiện vì lý do nào khác.
- **Phạm vi của rule là `/src/` và loại trừ `.test.`/`.spec.`**, đúng như `TYPE-SAFETY-4` phát biểu.
  Miễn trừ nằm trong `isTestFile`, tức trong chính rule, nên không có chỗ thứ hai để nó trôi.
- **Bằng chứng trên cây nguồn thật hiện là một số không.** Toàn bộ bốn lần `as unknown as` đều nằm
  trong file `.test.`/`.spec.`; không có file sản phẩm nào mang một lần. Neo của `TYPE-SAFETY-1` vì
  vậy là một **sự vắng mặt** — dạng neo yếu hơn một dòng code, nhưng là dạng neo đúng cho một luật
  cấm.
- **`any` cũng đang ở số không trên cây nguồn.** Bốn lần khớp chữ "any" đều là văn xuôi trong
  comment. Điều này khẳng định rule ngoại đang chạy thật, nhưng **module này không đọc được severity
  của nó** — xem "Rủi ro còn mở".
- **Neo mà luật phẳng nêu cho `TYPE-SAFETY-4` đã lệch.** File phẳng ghi
  `src/components/pages/ProfileSkillsPage/component.test.tsx` là anchor; file ấy hiện **không còn
  một cast nào**. Neo đã được thay bằng `src/modules/api/graphql/clients/links/bearer.test.ts`, là
  chỗ ví dụ trong luật phẳng thật ra đang trích. Đây là một **sửa neo**, không phải sửa luật.
- **Có đúng một cast không lý do trong source sản phẩm.** `src/app/sitemap.ts` cast body của một
  response sang một kiểu có tên, không kèm mệnh đề nào. `no-double-cast` không báo cáo nó và không
  nên báo cáo — nó là cast một tầng. Đây là `TYPE-SAFETY-5` đúng như mã ấy mô tả: nhìn thấy được bởi
  người đọc, vô hình với mọi cơ chế.
- **Việc không chép lại `no-explicit-any` và `array-type` là quyết định đúng và có giá.** Một bản sao
  thứ hai của rule người khác là một thứ thứ hai phải giữ đồng bộ, và bản không ai sửa là bản ngừng
  khớp. Giá phải trả: module này khẳng định được *có rule*, không khẳng định được *rule ấy đang ở mức
  error*.

## Decisions

- **Giữ đúng năm mã, đúng số, đúng nghĩa:** `TYPE-SAFETY-1` … `TYPE-SAFETY-5`. Không thêm, không bớt,
  không đánh số lại. Các mã này đã được trích dẫn ở nơi khác; một lần đánh số lại âm thầm làm hỏng
  một trích dẫn đã có người viết ra.
- **Giữ nguyên mọi quyết định của luật phẳng.** Miễn trừ là đường dẫn; `unknown` là câu trả lời cho
  hình dạng chưa biết; `Array<T>` là cách viết duy nhất; cast sống sót phải mang lý do; cast xuyên
  `unknown` bị từ chối trong source sản phẩm.
- **Ghi tầng giữ một cách trung thực: 1 `enforced`, 4 `documented`.** Không nâng mã nào lên
  `enforced` vì "có rule ở đâu đó". Tầng `enforced` trong bảng này chỉ có nghĩa: một rule trong
  `sources/fe/type-safety.mjs` báo cáo nó, và rule ấy được gọi tên.
- **Nêu tên rule ngoại ở cột "What holds it"** thay vì để trống. Một mã bàn giao có địa chỉ khác hẳn
  một mã không ai giữ, và bảng phải phân biệt được hai thứ đó.
- **Neo bằng đường dẫn thật, kể cả khi neo là một sự vắng mặt.** Một luật cấm được neo bằng số đếm
  bằng không, và một lần khớp mới chính là toàn bộ finding.
- **Giữ mọi ví dụ ở dạng TS/TSX thuần**, vendor viết là `@vendor/*`. Không tên sản phẩm, không tên
  thư viện thật.

## Rủi ro còn mở

Mục này liệt kê **mọi mã chỉ ở tầng `documented`**, và với mỗi mã nói rõ một rule sẽ phải **nhìn
thấy điều gì** mới giữ được nó — hoặc vì sao không rule nào giữ được.

- **`TYPE-SAFETY-2` — `any`.** *Giữ được, nhưng cố ý giao ra ngoài.*
  `@typescript-eslint/no-explicit-any` đã làm đúng việc này. Điều module này **không** biết là rule ấy
  đang chạy ở severity nào trong một repository cụ thể: một repository hạ nó xuống `warn` sẽ vẫn
  "có rule" mà không có cổng nào. Muốn đóng khoảng này mà không chép lại rule, thứ cần kiểm không
  phải AST mà là **effective config**: một gate đọc cấu hình đã phân giải và khẳng định
  `@typescript-eslint/no-explicit-any` ở mức `error` cho `**/*.{ts,tsx}`. Đó là một gate adoption,
  không phải một rule của module này.
- **`TYPE-SAFETY-3` — cách viết mảng.** *Giữ được, cùng lý do và cùng khoảng trống.*
  `@typescript-eslint/array-type` với `{ default: "generic", readonly: "generic" }` giữ hình dạng.
  Phần **không** ai giữ là *lý do* — rằng dạng generic còn đọc được khi kiểu phần tử tự nó generic.
  Một rule không thể giữ một lý do; chỉ record này giữ được.
- **`TYPE-SAFETY-4` — miễn trừ cho test.** *Nửa cơ học đã có, nửa còn lại không cơ học hoá được.*
  Nửa đã có: một file sản phẩm **không thể** giành lấy miễn trừ, vì `isGoverned` quyết định bằng
  đường dẫn — nhưng vi phạm đó được báo cáo dưới tên `TYPE-SAFETY-1`, nên bảng không ghi mã này là
  `enforced`. Nửa còn lại: rằng giá trị sai **chính là thứ đang được chứng minh**. Để giữ nửa ấy,
  một rule sẽ phải nhìn thấy rằng giá trị vừa cast **được truyền vào chính hàm dưới test** và kết quả
  của nó **xuất hiện trong một assertion về việc từ chối** — tức là phải hiểu ý định của một bài test.
  Xấp xỉ khả thi nhất: yêu cầu mỗi cast trong test đứng trong thân một `it`/`test` có assertion, và
  từ chối cast ở scope module dùng chung cho nhiều case. Xấp xỉ ấy vẫn bỏ lọt cast vì lười trong đúng
  một `it`, tức bỏ lọt đúng trường hợp phổ biến nhất. Chưa viết, và ghi nhận là chưa viết.
- **`TYPE-SAFETY-5` — cast mang lý do.** *Không rule nào giữ được, và điều này là kết luận chứ không
  phải việc còn nợ.* Máy nhìn thấy comment **tồn tại**; nó không nhìn thấy comment **đúng**. Một rule
  đòi "cast phải có comment" sẽ được thoả mãn bởi chữ `// cast`, và khi đó nó không còn giữ luật nữa
  — nó dạy người ta cách đi vòng qua luật, mà lại còn dạy bằng một cổng xanh. Thứ duy nhất có thể cơ
  học hoá là một dấu hiệu **hẹp hơn hẳn**: chẳng hạn cấm cast trong một danh sách đóng các biểu thức
  biên (`response.json()`, `JSON.parse`, `localStorage.getItem`), nơi câu trả lời đúng luôn là
  `unknown` cộng một guard. Đó sẽ là một mã mới, không phải mã này.

Ngoài tầng giữ, ba rủi ro nữa còn mở:

- **`TYPE-SAFETY-3` có thể bị cho là đứng sai module.** Nó không nói về việc tắt kiểm — bốn mã kia
  đều nói. Lập luận giữ nó ở đây: cùng một cơ chế hỏng, là "không có thứ gì sửa cách viết thứ hai".
  Lập luận phản đối: module này tự phát biểu mình chỉ có **một** việc, và mã này không phải việc ấy.
  **Luật giữ nguyên năm mã**; nếu tách, đó là một rule change có changelog, không phải một lần đọc
  khác đi.
- **Neo của `TYPE-SAFETY-1` là một sự vắng mặt**, nên nó **hết hạn khi cây nguồn đổi**. Đúng một
  lần khớp mới là đủ để neo này sai, và không có ai canh việc đó ngoài chính rule.
- **`src/app/sitemap.ts` là một `TYPE-SAFETY-5` chưa đóng.** Không rule nào báo cáo nó; nó nằm đây để
  lần audit sau không phải tìm lại.

## Re-audit Triggers

- Xuất hiện một lần `as unknown as` trong file **không** phải `.test.`/`.spec.` — neo vắng mặt của
  `TYPE-SAFETY-1` hết hiệu lực ngay lúc đó.
- Xuất hiện một `any` thật trong source, hoặc `@typescript-eslint/no-explicit-any` bị hạ severity
  hoặc tắt ở bất kỳ block config nào.
- `@typescript-eslint/array-type` bị đổi option khỏi `{ default: "generic", readonly: "generic" }`.
- Có đề xuất chép `no-explicit-any` hoặc `array-type` vào `sources/fe/type-safety.mjs` — đó là quyết
  định đã bị từ chối có lý do, và mở lại nó cần lý do mới.
- Có đề xuất nới miễn trừ test từ **đường dẫn** sang **phán đoán**.
- Một file trong cây nguồn được nêu làm neo bị đổi tên, xoá, hoặc mất chính dòng được neo.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm hoặc một thư viện thật mới đọc được.
