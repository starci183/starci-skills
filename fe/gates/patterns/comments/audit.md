---
id: fe-patterns-comments-audit
title: audit.md
slug: /gates/patterns/comments/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo vào code thật của luật Comments.
---

# audit.md

> Version: `2.00` · Module: `comments`

Audit này kiểm hai thứ. Một: sáu mã có phân định được **từ dữ kiện đã nêu**, và chỉ từ đó, hay không.
Hai: bảng `Tầng giữ` có phản ánh đúng thực tế hay không — vì một bảng làm tròn "giữ được một nửa" thành `enforced`
là cách một repository tin rằng mình đang được bảo vệ.

## Verdict

Chấp nhận, kèm bốn chênh lệch giữa **luật** và **rule** được ghi lại nguyên vẹn ở dưới. Không chênh
lệch nào được sửa âm thầm trong lần chuyển shelf này: luật gốc quyết định nội dung, và bất đồng thì
xuống mục "Rủi ro còn mở".

Sáu mã, đúng sáu, bảo toàn số và nguyên nghĩa. Ba rule. Bốn mã có rule mang tên gọi được, hai mã
không. Sáu mã đều neo được vào code thật.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `COMMENTS-1` vs `COMMENTS-5` | Loại trừ được: hỏi khối nói thêm gì so với chữ ký. Không thêm gì thì là restatement |
| `COMMENTS-1` vs helper nội bộ | Loại trừ được bằng một dữ kiện cứng: có `export` hay không |
| `COMMENTS-2` vs `COMMENTS-3` | Loại trừ được: dịch sang tiếng Anh mà chương trình chạy sai thì là literal chức năng |
| `COMMENTS-3` giữa ba ngoại lệ | Loại trừ được bằng đường dẫn cộng dấu, không cần phán đoán |
| `COMMENTS-4` vs bộ từ vựng icon | Loại trừ được: ký hiệu chung hay reaction sản phẩm |
| `COMMENTS-5` vs `COMMENTS-6` | Loại trừ được: xoá đi thì người đọc mất gì |
| `COMMENTS-6` đủ hay chưa | Loại trừ được: có nêu hình dạng bị từ chối và tình huống hỏng hay không |
| Thiếu dữ kiện | Hỏi **một** câu ở [`example.md`](./example.md) § Bảng phân định ranh giới rồi dừng |

## Findings

- **Luật với xa hơn tên gọi của nó, và đó là chỗ đúng nhất của module này.** Phạm vi không phải
  "comment" mà là mọi vị trí chữ nghĩa. Twin test tại
  [`sources/fe/comments.test.mjs`](../../../../sources/fe/comments.test.mjs) chứng minh bằng ba invalid
  case là **một câu** ở ba chỗ: comment, string, mảnh template.

- **`COMMENTS-1` chỉ được giữ ở phần "có hay không".** `requireExportJsdoc` kiểm sự tồn tại của một
  block bắt đầu bằng `*`. Nội dung block không được đọc, nên một khối chép lại chữ ký **qua** rule mà
  vẫn vi phạm `COMMENTS-5`. Hai mã này phải được đọc cùng nhau, và đó là lý do `example.md` đặt một
  case khối-tài-liệu-restatement nằm trong mục `COMMENTS-5` chứ không nằm trong `COMMENTS-1`.

- **`COMMENTS-1` bỏ sót ba dạng khai báo.** Danh sách `kinds` trong rule gồm `VariableDeclaration`,
  `TSInterfaceDeclaration`, `FunctionDeclaration`, `TSTypeAliasDeclaration`. Một `export class`, một
  `export enum`, hay `export default () => {}` không rơi vào dạng nào trong đó và **không bị báo**.
  Luật vẫn áp cho chúng — đây là lỗ của rule, không phải một miễn trừ.

- **`export { X }` không bị báo, và đó là một quyết định đã ghi**, không phải một lỗ. Twin test nêu
  rõ: re-export không có khai báo nào để tài liệu hoá. Hệ quả cần biết: toàn bộ bề mặt công khai của
  một barrel file là vô hình với rule.

- **`COMMENTS-2` không với tới regex literal.** `proseVisitors` chỉ báo `Literal` khi
  `typeof node.value === "string"`, mà giá trị của một regex literal là một `RegExp`. Bằng chứng nằm
  ngay trong chính file rule: hằng số `ENDONYM = /Tiếng Việt/` mang chữ ngôn ngữ thứ hai, **không**
  đánh dấu `vn-ok:`, và không bị báo — không phải vì được miễn, mà vì không bao giờ được ghé thăm.

- **Rule cho endonym `Tiếng Việt` đi qua; luật chỉ nêu ba ngoại lệ.** Đây là **con đường thứ tư** qua
  luật ngôn ngữ. Lý do của nó chính đáng — một bộ chọn ngôn ngữ buộc phải hiển thị đúng chữ của chính
  nó — nhưng nó chưa từng được viết vào luật. Lần chuyển shelf này **không** tự thêm nó thành ngoại lệ
  thứ tư.

- **`COMMENTS-3` đọc được cái dấu, không đọc được lý do.** `OK_PRAGMA = /\bvn-ok:/` khớp cả khi phía
  sau dấu hai chấm không có gì. Trong khi đó toàn bộ lập luận của ngoại lệ thứ ba là "cái dấu chấm dứt
  một lần suy đoán". Một dấu rỗng không chấm dứt gì cả.

- **Dấu miễn cả dòng và dòng kế tiếp.** Tập `marked` nạp `comment.loc.start.line` và
  `comment.loc.end.line + 1`. Đây là hành vi cố ý, đã được giải thích trong chính block comment của
  rule — một ví dụ sách giáo khoa của `COMMENTS-6`, ghi lại đúng cách viết cũ đã hỏng ra sao và vì sao
  không câu chữ nào cứu được nó. Hệ quả cần biết: một comment quên dịch **nằm cùng dòng** với một dấu
  hợp lệ cũng được miễn theo.

- **Luật và rule mâu thuẫn thẳng ở emoji trong locale data.** `COMMENTS-4` viết: reaction dùng artwork
  đã check-in, *"không bao giờ là pictograph Unicode trong source hoặc trong locale data"*. Nhưng
  `noEmojiInSource` thoát ngay ở dòng đầu khi `isContentFile` đúng, và twin test khẳng định
  `{ filename: LOCALE, code: 'const t = "done 🎉"' }` là **valid**. Rule đang cho phép đúng thứ luật
  cấm. Ghi lại, không sửa.

- **Một mục trong `CONTENT_PATHS` không thể chạy thử được.** Chính twin test đã nói: từ điển là
  `.json`, mà parser TypeScript từ chối, và eslint mặc định không lint JSON. Mục đó là **lá chắn**,
  không phải đường đi sống.

- **Neo được cả sáu mã, nhưng neo ở đâu mới là điều đáng nói.** Mọi anchor trong `INDEX.md` đều trỏ
  vào lint source `.mjs` **bên trong cây trust**. Đó là code repository này thật sự mở được. Không có
  anchor nào là TSX sản phẩm, vì cây component không nằm trong repository này để kiểm.

## Decisions

- Giữ đúng sáu mã: `COMMENTS-1` … `COMMENTS-6`, nguyên số, nguyên nghĩa. Không đổi số, không thêm mã.
- Giữ **ba** ngoại lệ là ba. Endonym không được nâng thành ngoại lệ thứ tư trong lần này.
- Giữ phạm vi `COMMENTS-1` ở đúng "exports only". Nới ra mọi helper là cách làm cho không khối nào
  còn được đọc.
- Giữ nguyên tắc "ngoại lệ là đường dẫn, không phải phán đoán". Một ngoại lệ dựa trên phán đoán sẽ bị
  tranh cãi lại ở từng file, mãi mãi.
- Bảng `Tầng giữ` ghi cả phần **không** với tới, ngay trong bảng. Một mã chỉ được ghi `enforced` khi
  đã tìm ra rule và gọi được tên nó.
- Mọi ví dụ là TSX thường. Chỗ luật chạm vào component riêng, gọi **vai trò** của nó — leaf reaction,
  bộ từ vựng icon — không gọi tên định danh trong một codebase.
- Bốn chênh lệch luật/rule ở trên xuống "Rủi ro còn mở", không thành edit lặng lẽ.

## Rủi ro còn mở

### Các mã chỉ ở tầng `documented`

- **`COMMENTS-5` — comment chép lại dòng bên dưới.** Không rule nào giữ. Để giữ được, một rule phải
  **so được nghĩa** của một câu tiếng Anh với nghĩa của câu lệnh ngay dưới nó — tức là phát hiện
  diễn giải trùng, không phải phân tích cú pháp. Xấp xỉ rẻ tiền thì có: báo khi mọi từ trong comment,
  sau khi bỏ stop-word, đều là token của định danh trên dòng kế tiếp (`// increment the counter` trên
  `counter += 1`). Nhưng xấp xỉ đó báo nhầm ngay lập tức với một comment hợp lệ dùng lại chính tên của
  thứ nó giải thích — mà đó là hầu hết comment hợp lệ. Một rule phải bị tắt tiếng mới tồn tại được là
  rule không ai tin, đúng như chính file rule đã viết khi giải thích `hasEmoji`. Nên mã này ở lại
  `documented` một cách có chủ ý, không phải vì chưa ai làm.

- **`COMMENTS-6` — comment ghi lại một lần từ chối.** Không rule nào giữ, và **không rule nào có thể**
  giữ phần cốt lõi. Thứ bị vi phạm ở đây là một **sự vắng mặt**: hình dạng đã bị từ chối không nằm
  trong cây cú pháp, nên không có gì để parser nhìn thấy. Hai lời gọi `await` tuần tự và hai lời gọi
  `await` tuần tự-vì-lý-do trông giống hệt nhau. Cái duy nhất có thể máy hoá là **hình thức**: nếu đội
  chọn một quy ước đánh dấu, rule đọc được rằng chỗ đánh dấu có nêu hình dạng thay thế hay không.
  Nhưng như thế chỉ kiểm được những chỗ **đã** có người viết, tức là kiểm đúng tập hợp không cần kiểm.

### Các mã `enforced` nhưng chỉ một phần

- **`COMMENTS-1`.** Rule cần đọc thêm **nội dung** khối để giữ nốt nửa còn lại, và nửa đó rơi vào cùng
  bài toán của `COMMENTS-5`. Phần rẻ và đáng làm trước là mở rộng danh sách `kinds` cho
  `ClassDeclaration`, `TSEnumDeclaration` và `export default` vô danh — đó là lỗ thuần cơ học, không
  cần hiểu nghĩa.
- **`COMMENTS-2`.** Muốn với tới regex literal, `proseVisitors` phải thêm một nhánh đọc `node.regex`.
  Rủi ro đi kèm: chính `SECOND_LANGUAGE_LETTER` và `ENDONYM` sẽ bị báo, nên việc này đi kèm một quyết
  định về endonym chứ không đứng một mình.
- **`COMMENTS-3`.** Muốn giữ được "dấu mang lý do", rule chỉ cần đòi có ít nhất vài ký tự không phải
  khoảng trắng sau `vn-ok:`. Đây là thứ **duy nhất** trong danh sách này giữ được bằng một thay đổi
  regex, và nó nên là đề xuất rule change tiếp theo.
- **`COMMENTS-4`.** Luật cấm pictograph trong locale data; rule miễn toàn bộ file nội dung. Giữ đúng
  luật thì `noEmojiInSource` phải **không** dùng chung `isContentFile` với luật ngôn ngữ, vì hai luật
  có lý do miễn trừ khác nhau: một từ điển *phải* mang ngôn ngữ kia, nhưng không có gì buộc nó phải
  mang pictograph.

### Các rủi ro khác

- **Ngoại lệ thứ tư không tên.** Endonym đang sống trong rule mà không sống trong luật. Ai đọc luật sẽ
  không biết nó tồn tại; ai đọc rule sẽ tưởng luật đã cho phép. Cần một quyết định: hoặc viết nó thành
  ngoại lệ thứ tư và luật nói "bốn", hoặc bỏ khỏi rule và bắt endonym đánh dấu `vn-ok:` như mọi literal
  chức năng khác.
- **Anchor toàn bộ nằm trong lint source.** Neo được, và neo vào code thật, nhưng là code **thi hành
  luật** chứ không phải code **chịu luật**. Một anchor vào cây component sẽ mạnh hơn, và không kiểm
  được từ repository này.
- **`COMMENTS-3` gánh nhiều tình huống nhất** — locale, fixture, literal chức năng. Nếu thực tế cho
  thấy ba thứ đó cần tách mã riêng, đó là một đề xuất rule change, không phải một lần đọc khác đi.

## Re-audit Triggers

- Có đề xuất thêm một ngoại lệ thứ tư, hoặc endonym được quyết định dứt điểm.
- `sources/fe/comments.mjs` đổi danh sách `kinds`, đổi `CONTENT_PATHS`, hoặc đổi `OK_PRAGMA`.
- Có một `export class`, `export enum` hoặc `export default` vô danh bị phát hiện không có khối.
- Có chữ ngôn ngữ thứ hai được tìm thấy trong một regex literal.
- Có pictograph xuất hiện trong locale data và không ai báo lỗi.
- Một `vn-ok:` rỗng đi qua review.
- Một comment `COMMENTS-6` bị hoàn tác vì nó không nêu tên hình dạng đã bị từ chối.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
