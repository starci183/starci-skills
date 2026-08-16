---
id: be-patterns-cdc-audit
title: audit.md
slug: /be/patterns/cdc/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức giữ và khả năng neo của luật CDC.
---

# audit.md

> Version: `2.00` · Module: `cdc`

Audit này kiểm hai việc: luật có chọn được **đúng một mã** từ dữ kiện đã nêu hay không, và mỗi mã
đang được **giữ bằng gì** — chứ không phải nó *nên* được giữ bằng gì.

## Verdict

Chấp nhận. Bảy mã giữ nguyên số và nguyên nghĩa từ luật phẳng. Mọi mã đều neo được vào source có thể đọc
được hôm nay. Một mã `enforced`, sáu mã `documented`, và khoảng cách đó được ghi thẳng vào
[`INDEX.md`](./INDEX.md) thay vì được che.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `CDC-1` vs `CDC-2` | Loại trừ được: nhân bản vòng đời ≠ khai báo danh tính sai |
| `CDC-2` vs `CDC-4` | Loại trừ được: một bên hỏng **tài nguyên**, một bên hỏng **số liệu** |
| `CDC-3` vs `CDC-4` | Loại trừ được khi đã nêu *ai gọi* và *hàm được gọi tính thế nào* |
| `CDC-3` vs `CDC-5` | Loại trừ được: bỏ qua vì cột không liên quan ≠ bỏ qua vì không có ảnh hiện tại |
| `CDC-4` vs `CDC-6` | Loại trừ được: nuốt message có tự lành không, quyết định gốc nằm ở đâu |
| `CDC-5` vs `CDC-4` | Loại trừ được khi đã nêu số 0 đọc từ nguồn hay suy ra từ sự vắng mặt |
| `CDC-7` vs mọi mã | Loại trừ được bằng một câu: khai sai `groupId` thì bài test hiện có có đỏ không |
| Thiếu dữ kiện | Hỏi **một** câu: câu SQL recompute chạm vào những bảng nào |

## Findings

- **Câu hỏi replay là phép thử duy nhất cần thiết** để phân biệt một CDC projection với một
  event handler. Mọi mã còn lại là điều kiện để câu trả lời "có" giữ được dưới tải thật.
- **`CDC-4` là gốc, sáu mã kia là điều kiện của nó.** Điều này chưa được nói rõ trong luật phẳng và
  đã được nói rõ ở bản này: `CDC-6` chỉ an toàn vì `CDC-4` đúng, và `CDC-2` chỉ rẻ vì `CDC-4` đúng.
  Đây là **làm rõ quan hệ**, không phải đổi luật; không mã nào bị thêm, bớt hay đổi nghĩa.
- **Rule `projection-listener-contract` giữ ba mã ở ba mức rất khác nhau.** Nó giữ `CDC-1` gần trọn
  vẹn, nhưng với `CDC-2` và `CDC-3` nó chỉ kiểm **sự tồn tại của member**, không đọc giá trị và
  không nhìn vào thân hàm. Bảng `Tầng giữ` vì thế đánh `documented` cho hai mã đó: yêu cầu quyết
  định của chúng không được giữ, dù lint có nói vài điều về chúng.
- **Kiểm thực địa: 17 listener cụ thể đang tuân thủ.** Mọi file khớp
  `src/modules/**/*projection.listener.ts` đều `extends AbstractProjectionListener`, đều có `groupId`
  là chuỗi hằng, và không file nào khai `onModuleInit`. Đây là điều làm mục `Anchor` khả thi, và
  cũng là lý do sáu dòng `documented` chưa gây thiệt hại quan sát được — chưa, không phải không.
- **`CDC-5` và `CDC-6` documented vì một lý do lành mạnh.** Hành vi nằm tập trung trong base, nên
  phát biểu cưỡng chế được về chúng **chính là** `CDC-1`. Chúng không phải nợ enforcement cùng loại
  với `CDC-2`, `CDC-3`, `CDC-4`, `CDC-7`.

## Decisions

- Giữ đúng bảy mã, đúng số cũ, đúng nghĩa cũ: `CDC-1`…`CDC-7`. Không thêm mã nào cho những điều bản
  này làm rõ.
- Giữ nguyên mọi quyết định của luật phẳng, kể cả bảng `Forbidden` — nó được diễn đạt lại thành cột
  *Forbids* trong `Situation Codes` và thành các case SAI trong [`example.md`](./example.md), không
  bị rút gọn.
- Đánh `enforced` chỉ khi rule bắt được **yêu cầu quyết định** của mã, không phải khi rule tình cờ
  chạm tới mã đó.
- Neo mọi mã vào đường dẫn source thật. Mục `Anchor` là ngoại lệ duy nhất của luật "không nêu tên
  hệ thống", và ngoại lệ đó được tuyên bố công khai trong `Scope`.
- Mọi ví dụ dùng TypeScript/NestJS tổng quát; module riêng tư mà luật phẳng nêu tên đã được tổng
  quát hoá thành projection điểm, projection thống kê review và projection tiến độ.

## Rủi ro còn mở

Sáu mã dưới đây chỉ ở tầng `documented`. Với mỗi mã: **một rule sẽ phải THẤY được cái gì** mới giữ
được nó, hoặc vì sao không rule nào giữ được.

- **`CDC-2` — `groupId` bền và `topics` đủ.** Rule sẽ phải thấy: giá trị gán cho `groupId` là một
  `Literal` (hoặc một template không chứa lời gọi hàm), và mọi phần tử của `topics` là template chỉ
  ghép một hằng env-prefix với một tên bảng viết cứng. Phần này **viết được ngay** và là món nợ dễ
  trả nhất. Phần *đủ* thì không: "topics phải phủ hết bảng trong câu SQL recompute" đòi đọc chuỗi
  SQL ở một file khác và parse nó — nằm ngoài tầm ESLint. Đó là việc của `CDC-7`.
- **`CDC-3` — không business command trong `deriveTargets`.** Rule sẽ phải thấy: trong thân
  `deriveTargets` không có `await` nào tới một identifier ngoài danh sách trắng đọc-dữ-liệu
  (`find*`, `count`, `query` chỉ-SELECT). Viết được ở dạng heuristic, nhưng mọi heuristic ở đây đều
  sai theo cả hai chiều: `this.service.resolve(...)` có thể là đọc thuần, `this.repository.query(...)`
  có thể là `UPDATE`. Bắt cho đúng đòi phân tích liên thủ tục — không phải việc của lint.
- **`CDC-4` — recompute idempotent, dựng từ nguồn.** Rule sẽ phải thấy: hàm mà `recomputeTarget`
  gọi không nhận tham số số lượng (`amount`, `delta`, `points`, `count`), và câu SQL nó chạy có
  `ON CONFLICT ... DO UPDATE` chứ không có `SET x = x + ...`. Hai mảnh này **nằm ở hai file khác
  nhau**, và cầu nối giữa chúng là một lời gọi method — thứ ESLint không đi theo được. Chặn được
  phần dễ (`increment(`, `decrement(` bên trong file listener) chỉ là chặn kiểu ngây thơ nhất; mọi
  vi phạm thật sẽ nằm trong service.
- **`CDC-5` — tombstone không sinh ghi.** Không rule nào giữ được ở tầng listener, vì hành vi đã
  nằm trong base và listener cụ thể không có gì để kiểm. Cái giữ nó thật sự là `CDC-1`. Rủi ro còn
  lại là ở **chính base**: `unwrapRow` phân biệt "envelope Debezium có `after: null`" với "dòng đã
  phẳng do SMT" bằng sự hiện diện của khoá `after`. Một envelope không có `after` và cũng không phải
  dòng phẳng sẽ đi tiếp như một dòng hợp lệ. Đây là **hạn chế đã biết và đã được nói rõ trong
  comment ở base**, không phải một phát hiện mới; nó chỉ trở thành lỗi nếu ai đó đổi cấu hình
  connector mà không đọc.
- **`CDC-6` — một message hỏng không giết consumer.** Cùng lý do với `CDC-5`: cơ chế nằm trong base.
  Một rule *có thể* cấm `try/catch` quanh xử lý message trong file listener cụ thể, nhưng nó sẽ chỉ
  lặp lại `CDC-1` bằng một thông điệp khác. Không đề xuất viết.
- **`CDC-7` — chứng minh qua broker thật.** Rule sẽ phải thấy: với mỗi
  `*projection.listener.ts`, tồn tại ít nhất một spec ở `src/tests/e2e/` nhắc tới `groupId` của nó
  hoặc publish vào một topic của nó. ESLint đọc được filesystem, nên **kỹ thuật là làm được**, nhưng
  nó sẽ khớp bằng chuỗi và sẽ xanh với một bài test chỉ *nhắc tên*. Một cổng CI đếm coverage của
  spec CDC là công cụ đúng hơn cho việc này; nó không thuộc `sources/be/cdc.mjs`.

Hai rủi ro không thuộc bảng tầng:

- **Rule khớp superclass bằng TÊN.** `node.superClass.name !== "AbstractProjectionListener"` không
  phân giải import. Một class cùng tên khai báo tại chỗ sẽ qua cửa. Chi phí sửa cao, xác suất xảy ra
  thấp; ghi lại ở đây để lần sau không ai kết luận rằng `CDC-1` được giữ tuyệt đối.
- **Phạm vi rule dựa vào tên file.** Chỉ file kết thúc bằng `projection.listener.ts` được kiểm. Một
  CDC listener đặt tên khác nằm hoàn toàn ngoài mọi cưỡng chế của module này. Quy ước đặt tên đang
  là thứ duy nhất giữ điều đó, và quy ước không phải cơ chế.

## Re-audit Triggers

- Có `sources/be/cdc.mjs` publish thêm rule, hoặc rule hiện có đổi tập kiểm tra.
- Xuất hiện một CDC listener có tên file không kết thúc bằng `projection.listener.ts`.
- Một projection lệch số liệu ở môi trường thật mà không rule nào từng đỏ.
- `AbstractProjectionListener` đổi cách phân giải envelope, offset hoặc cô lập lỗi.
- Có đề xuất thêm mã `CDC-8`, hoặc đề xuất đổi nghĩa của một mã đang có.
- Một anchor trong `INDEX.md` trỏ vào đường dẫn không còn tồn tại.
- Một ví dụ trong `example.md` cần tên riêng của một hệ thống mới đọc được.
