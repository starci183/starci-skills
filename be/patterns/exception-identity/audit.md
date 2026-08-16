---
id: be-patterns-exception-identity-audit
title: audit.md
slug: /be/patterns/exception-identity/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật exception identity.
---

# audit.md

> Version: `2.00` · Module: `exception-identity`

Bản audit này kiểm tra ba việc: luật có đưa ra một verdict chỉ từ **những dữ kiện đã nêu** hay không;
mỗi mã có được **gắn với code thật** không; và **tầng giữ** ghi trong `INDEX.md` có khớp với source
hay không.

## Verdict

Chấp nhận, có bảo lưu. Năm mã đã được chốt, phân định được, và cả năm đều gắn được với source thật.
Bảo lưu nằm ở hai điểm: **số lượng mã trong brief không khớp luật gốc** (mục Findings 1), và **ba
trong bốn rule của gate không nhìn thấy đầy đủ hình dạng khai báo thật** (Findings 4-6).

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `IDENTITY-1` vs `EXCEPTION-3` | Loại trừ được: một bên hỏng ở **tên**, một bên hỏng ở **base** |
| `IDENTITY-1` vs `IDENTITY-2` | Loại trừ được, nhưng **có thứ tự**: sai `IDENTITY-1` thì `IDENTITY-2` không được kiểm, vì rule của nó cũng khớp hậu tố |
| `IDENTITY-2` vs `IDENTITY-3` | Loại trừ được khi đã nêu khai báo là mới hay đã có client |
| `IDENTITY-2` vs `IDENTITY-5` | Loại trừ được khi đã nêu client khớp cái gì |
| `IDENTITY-4` vs `EXCEPTION-2` | Loại trừ được: nhận-một-object là `EXCEPTION-2`, object-có-tên-riêng là `IDENTITY-4` |
| `IDENTITY-5` vs mặc định | Loại trừ được khi đã nêu có caller nào cam kết status hay không |
| Thiếu dữ kiện | Không có mặc định an toàn nào cho module này. Danh tính sai thì im lặng, nên khi thiếu dữ kiện phải **hỏi**, không được đoán |

Chỗ phân định yếu nhất là `IDENTITY-5`: nó phán về **ý định** ("status được chọn để làm gì"), và ý
định không nằm trong bất kỳ dữ kiện nào đọc được từ file. Phép thử thay thế đã dùng — "có caller nào
đã cam kết chưa" — chuyển câu hỏi sang một dữ kiện kiểm được, nhưng dữ kiện đó nằm ngoài repository
back end.

## Findings

1. **Brief nói module có 8 mã; luật gốc chỉ có 5.** Đếm trong
   `be/canon/patterns/exception-identity.md`: `IDENTITY-1` … `IDENTITY-5`, và không mã nào khác trong
   toàn bộ cây trust. Con số 8 nhiều khả năng là 5 mã `IDENTITY-` cộng 3 lần trích dẫn chéo
   `EXCEPTION-1`, `EXCEPTION-2`, `EXCEPTION-3` nằm trong cùng file. Module này giữ **đúng 5** mã, giữ
   nguyên số và nghĩa của từng mã, và **không bịa thêm** `IDENTITY-6`, `IDENTITY-7`, `IDENTITY-8` —
   bịa thêm mã sẽ tạo ra ba trích dẫn không có nội dung nào chống lưng, đúng thứ mà luật cấm ở chiều
   ngược lại khi cấm đánh số lại.

2. **Số rule trong `sources/be/exception-identity.mjs` đánh số lệch với luật.** File lint chia ba
   khối comment `IDENTITY-1`, `IDENTITY-2`, `IDENTITY-3`, nhưng khối thứ ba giữ ruling **`IDENTITY-4`**
   của luật (type metadata mang tên exception), còn `IDENTITY-3` thật (đổi tên) thì không có rule
   nào. Ai đọc file lint trước rồi trích `IDENTITY-3` sẽ trích nhầm ruling. Module này giữ nguyên
   đánh số **của luật**, và ghi lệch này lại thay vì sửa im lặng ở một trong hai phía.

3. **Luật gốc nói "Two of its rulings are held there"; thật ra là ba.** File lint publish ba rule,
   giữ `IDENTITY-1`, `IDENTITY-2` và `IDENTITY-4`. Hai mã còn review giữ là `IDENTITY-3` và
   `IDENTITY-5` — đúng như câu sau của chính đoạn đó. Con số "two" là một chỗ trượt, không phải một
   quyết định; bảng `Tầng giữ` chép theo source, không chép theo câu văn.

4. **`exception-name-ends-in-exception` chỉ duyệt `ClassDeclaration`.** Một exception khai bằng class
   expression (`export const X = class extends AbstractException`) không bị bất kỳ rule nào trong file
   này chạm tới. Đây là lỗ, không phải ngoại lệ được cấp, và đã ghi vào `example.md`.

5. **`exception-code-matches-class-name` thoát sớm ở ba nhánh.** Không có constructor, không có
   `super()`, hoặc `super()` ít hơn hai đối số — cả ba đều `return` không báo gì. Một class không khai
   constructor vì thế thừa kế danh tính của cha mà gate không nói gì, dù đó đúng là thứ module này từ
   chối.

6. **`exception-metadata-type-named-for-class` chỉ đọc `TSTypeReference` có `typeName` là
   `Identifier`.** Union, intersection và qualified name (`Foo.Bar`) đi qua sạch. Ngược lại, rule này
   đã **được sửa đúng** ở một chỗ tinh vi và chỗ đó đáng giữ: `{ ... }: Metadata = {}` parse thành
   `AssignmentPattern` bọc `ObjectPattern`, và bản chỉ đọc node ngoài đã bỏ sót **chính** những khai
   báo từ bỏ type có tên.

7. **Cả năm mã đều neo được.** Không mã nào phải ghi `chưa neo được`. Neo mạnh nhất là `IDENTITY-3`:
   các spec e2e ghim đúng chuỗi code, nên chúng là nhân chứng cơ học cho việc code là hợp đồng ra
   ngoài — dù chính chúng không giữ được luật (chúng đỏ khi code đổi, im khi class đổi mà code ở lại,
   và trường hợp thứ hai mới là trường hợp nguy hiểm).

8. **`unrepresentable` đang trống, và có thể không trống mãi.** Một branded `ExceptionCode` suy ra từ
   tên class sẽ khiến code sai **không viết ra được**, thay vì viết ra rồi bị báo. Đó là một đề xuất,
   nên bảng `Tầng giữ` ghi trạng thái hiện tại chứ không ghi trạng thái mong muốn.

9. **Ba rule đều ở mức `error`, và ledger nói rõ vì sao được phép.** Cả ba từng ở `warn` kèm entry
   ghi tên các offender, và chỉ lật sang `error` khi entry đó đóng. Lý do được nêu đáng giữ nguyên
   văn ý: một rule bật lên trên các vi phạm đang tồn tại sẽ dạy người đọc lướt qua nó, và người đã
   học lướt qua một rule thì không đọc rule nào nữa.

## Decisions

- Giữ **đúng năm** mã: `IDENTITY-1`, `IDENTITY-2`, `IDENTITY-3`, `IDENTITY-4`, `IDENTITY-5`. Không
  đánh số lại, không thêm, không bớt.
- Giữ nguyên nghĩa của từng mã như luật phẳng đã chốt, kể cả các carve-out: acronym không bị phán xử,
  client đã phát hành giữ **tên class** cũ, status được set khi status là hợp đồng.
- Bảng `Tầng giữ` chép theo source lint, không chép theo câu văn của luật phẳng.
- Bảng `Anchor` chỉ dùng đường dẫn **thật, tương đối repository**, vì một luật không chỉ được vào code
  thật thì là một đề xuất.
- Mọi ví dụ rút về TypeScript tổng quát: không tên sản phẩm, không tên module riêng, không tên
  repository. Các tên miền riêng trong luật phẳng được tổng quát hoá thành document, workspace,
  invoice, upload, webhook, job.
- Bất đồng với luật phẳng (Findings 1, 2, 3) được **ghi lại**, không sửa im lặng vào một trong hai
  phía.

## Rủi ro còn mở

Hai mã chỉ ở tầng `documented`. Dưới đây là thứ một rule **sẽ phải nhìn thấy** để giữ được chúng — và
chỗ nào thì không rule nào giữ nổi.

- **`IDENTITY-3` — đổi tên class là đổi hợp đồng trên dây.** Một rule lint đọc **một file tại một thời
  điểm**, và một lần đổi tên là **hai phiên bản của một file**. Không có thông tin nào trong file sau
  cho biết file trước tên là gì, nên ESLint về nguyên tắc không giữ được mã này.

  Cái **có thể** giữ được là một gate CI đọc diff: với mỗi file trong thư mục errors, trích cặp
  `(tên class, code literal)` ở cả hai phía của diff, rồi báo hai dáng — (a) tên class đổi mà code
  giữ nguyên, (b) code đổi mà không có spec/ghi chú migration nào trong cùng diff. Dáng (a) là
  nửa-đổi-tên; dáng (b) là đổi hợp đồng không tuyên bố. Gate đó cần quyền đọc `git diff` và một quy
  ước để khai báo migration — cả hai đều nằm ngoài phạm vi một ESLint rule, nên đây là một đề xuất
  công cụ, không phải một rule đang thiếu.

  Rủi ro thực tế cao nhất: **IDE "Rename Symbol"**. Nó đổi tên class ở mọi call site và không chạm vào
  chuỗi trong `super()`, nên nó sản xuất chính xác dáng (a), im lặng, ở quy mô lớn.

- **`IDENTITY-5` — HTTP status không phải danh tính.** Ruling này phán về **ý định**: status được set
  vì một caller đã cam kết, hay vì tác giả muốn lỗi này trông khác lỗi bên cạnh. Ý định không có trong
  AST và cũng không suy ra được từ giá trị status, vì cùng một `HttpStatus.FORBIDDEN` có thể đúng ở
  khai báo này và sai ở khai báo kia.

  Cái **có thể** giữ được là một proxy hẹp: refuse một code mà chữ cái của nó chỉ là tên một status
  HTTP (`FORBIDDEN_EXCEPTION`, `UNAUTHORIZED_EXCEPTION`, `BAD_REQUEST_EXCEPTION`, `NOT_FOUND_EXCEPTION`
  đứng một mình). Đó là dấu vết dễ thấy nhất của một khai báo đã đi hỏi transport thay vì tự đặt tên.
  Proxy này **không** giữ được cả ruling: nó không bắt được một code hoàn toàn hợp lệ đi kèm một
  status không ai yêu cầu, và nó cũng có thể bắn nhầm nếu một ngày ứng dụng thật sự cần một lỗi tên
  `NotFound` ở tầng gateway. Nếu proxy này được bật, nó phải vào ledger ở `warn` trước, đúng như ba
  rule hiện có đã làm.

- **Số lượng mã có thể bị trích dẫn nhầm.** Brief dựng module này nói 8 mã. Nếu con số đó lọt vào một
  task record hoặc một file luật khác, ai đó sẽ đi tìm `IDENTITY-6` … `IDENTITY-8` và không thấy. Ghi
  ở đây để lần tìm ấy kết thúc tại chỗ này: **module có 5 mã, và 5 là con số đúng.**

- **Đánh số trong file lint vẫn lệch.** Cho tới khi các comment `// -- IDENTITY-N --` trong
  `sources/be/exception-identity.mjs` được sửa cho khớp luật, mọi trích dẫn `IDENTITY-3` phải nói rõ
  đang trích **luật** hay trích **file lint**. Sửa các comment đó là một thay đổi thuộc về file lint,
  không thuộc module này, nên module này không tự sửa.

- **`IDENTITY-1` là điều kiện tiên quyết của ba mã còn lại được kiểm.** Vì mọi rule đều khớp hậu tố,
  một class sai `IDENTITY-1` làm `IDENTITY-2` và `IDENTITY-4` cũng không được kiểm. Gate không nói gì,
  và ba khuyết tật cùng đi qua. Đây không phải khiếm khuyết của thiết kế rule — đó là lý do
  `IDENTITY-1` tồn tại — nhưng nó có nghĩa: **số 0 vi phạm không đồng nghĩa với 0 khuyết tật** cho tới
  khi biết chắc mọi class đều được rule nhìn thấy.

## Re-audit Triggers

- Có đề xuất thêm, bớt hoặc đánh số lại một mã `IDENTITY-`.
- `sources/be/exception-identity.mjs` publish thêm rule, đổi tên rule, hoặc đổi mức trong
  `recommended` — bảng `Tầng giữ` phải được đo lại, không được suy đoán.
- Một file trong bảng `Anchor` bị đổi đường dẫn hoặc xoá — một neo chết biến luật thành đề xuất.
- Xuất hiện một exception khai bằng class expression, hoặc một type metadata khai bằng union.
- Có một lần đổi tên class trong thư mục errors mà code không đổi theo.
- Có đề xuất branded `ExceptionCode`, tức là có mã sắp chuyển sang tầng `unrepresentable`.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm hoặc một module riêng mới đọc được.
