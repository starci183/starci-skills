---
id: be-patterns-comments-audit
title: audit.md
slug: /be/patterns/comments/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức enforcement thật và khả năng chống bịa của luật Comments.
---

# audit.md

> Version: `2.00` · Module: `comments`

Audit này kiểm hai việc, và **chỉ** hai việc: luật có phân định được từng tình huống bằng dữ kiện
đã nêu không, và bảng `Tầng giữ` có nói thật về mức mà cơ chế **thực sự** giữ được không.

## Verdict

Chấp nhận. Năm mã đã khép kín, ba mã có rule đứng sau, hai mã chỉ có người đọc giữ — và bảng tầng nói đúng như
thế thay vì làm tròn lên.

Điểm mạnh nhất của phiên bản này không phải ba rule. Nó là chỗ luật **tự khai** rằng hai trong ba
rule hẹp hơn mã mà chúng giữ, kèm ví dụ sống chứng minh. Một bảng tầng làm tròn "một nửa" thành
`enforced` là đúng loại nói dối mà `COMMENT-3` đang cấm.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `COMMENT-1` vs hằng số dữ liệu | Loại trừ được bằng câu hỏi "khai báo này có bề mặt không". Rule cũng cắt đúng chỗ đó: chỉ ghé thăm class/interface/type/enum/function, và ghé `const` chỉ khi nó gắn với function |
| `COMMENT-1` vs re-export | Loại trừ được: `export ... from` không có node khai báo để gắn doc |
| `COMMENT-1` vs `COMMENT-2` | Loại trừ được: một bên là doc của cả khai báo, một bên là doc của từng member |
| `COMMENT-1` vs `COMMENT-3` | **Không** loại trừ được bằng máy. Doc chép lại tên thoả `COMMENT-1` ở tầng lint và vi phạm `COMMENT-3` ở tầng người đọc. Đây là lỗ hổng lớn nhất còn lại, và đã được nói rõ ở cả ba record |
| `COMMENT-2` vs `COMMENT-3` | Cùng dạng lỗ hổng trên: rule thấy doc tồn tại, không thấy doc có nói hậu quả hay không |
| `COMMENT-3` vs `COMMENT-4` | Loại trừ được: một bên hỏi comment **nói gì**, một bên hỏi comment **viết bằng gì**. Một câu tiếng Việt giải thích đúng một race vi phạm `COMMENT-4` và thoả `COMMENT-3` |
| `COMMENT-4` vs `COMMENT-5` | Loại trừ được bằng đúng một câu: chuỗi này có phải của mình để đổi không. Chương trình so khớp hoặc phát ra nó thì nó là dữ liệu |
| `COMMENT-4` vs dấu câu kiểu chữ | Loại trừ được bằng ba lớp ký tự đã liệt kê. Em dash, middle dot, khung kẻ banner không thuộc lớp nào |
| `COMMENT-5` vs lạm dụng marker | Loại trừ được **bằng người đọc**, không bằng máy: rule chỉ thấy chuỗi `vn-ok`, không đọc được vế lý do đằng sau nó |
| Thiếu dữ kiện | Hỏi đúng một câu phân định trong bảng ở `example.md`, rồi dừng |

## Findings

- **Ba rule, năm mã.** `require-export-jsdoc` giữ `COMMENT-1`, `require-enum-member-jsdoc` giữ nửa
  `COMMENT-2`, `no-non-ascii-source` giữ `COMMENT-4`. `COMMENT-3` và `COMMENT-5` không có gì máy móc
  đứng sau.
- **`unrepresentable` trống là trống có cấu trúc.** Comment không phải giá trị. Không union đóng nào,
  không branded type nào làm cho một câu văn sai trở thành không viết được, vì hệ kiểu **không đọc
  câu văn**. Đây là lý do module này tồn tại dưới dạng prose chứ không phải dưới dạng type.
- **`no-non-ascii-source` là chỗ luật đã một lần suýt bị bịa nghiêm hơn.** Bản đầu cấm mọi codepoint
  ngoài ASCII, đo trên một back end thật thì ra 857 chỗ, và **toàn bộ** là em dash, khung kẻ trong
  banner comment, hoặc middle dot. Cách đọc hiển nhiên là "repo nợ 857 chỗ cần sửa". Repo không nợ
  chỗ nào; **rule** nợ một định nghĩa. Ba lớp ký tự hiện tại là bản ghi lại luật thật.
- **Một rule cho ba lớp ký tự là một quyết định, không phải sự tiện tay.** Ba rule riêng cho tiếng
  Việt, emoji và ký hiệu trang trí từng tồn tại; người đọc chạm vào rule emoji không học được gì về
  hai rule kia. Một rule một lý do thì dễ tuân hơn, và **không lách được bằng cách đổi bảng chữ cái**.
- **Ngoại lệ lane fixture được đo trước khi được viết.** 92 finding trong một back end thì 89 là chuỗi
  fixture và 3 là comment. Bắt đánh dấu `vn-ok` cả 92 nghĩa là đặt marker lên từng dòng của từng hội
  thoại fixture — tức là dạy người đọc thôi nhìn thấy marker, và một marker không ai nhìn thấy nữa thì
  không còn là ngoại lệ, nó là nhiễu.
- **Ngoại lệ đó cố ý chỉ áp cho CHUỖI.** Comment tiếng Việt trong spec vẫn là đúng vấn đề nó là ở mọi
  nơi khác, nên vẫn bị từ chối. Đây là chỗ ngoại lệ dễ bị nới nhất.
- **Drift đã đo được giữa canon và config đang chạy.** Config của repo tham chiếu vẫn bật ba rule cũ
  — `no-vietnamese`, `no-emoji`, `no-ai-symbol` — trong khi canon đã gộp chúng thành
  `no-non-ascii-source`. Cả hai phía đều ở mức `error`, nên **không có luật nào đang bị bỏ**; cái đang
  lệch là **danh tính rule**, và một rule đổi tên thì không trích dẫn được trong config. Đây là finding
  cần một lần sync, không phải một lần chọn khác đi.

## Decisions

- Giữ đúng năm mã: `COMMENT-1`, `COMMENT-2`, `COMMENT-3`, `COMMENT-4`, `COMMENT-5`. Số thứ tự **không
  đổi**, vì chúng đã được trích dẫn ở các luật anh em và ở các bản ghi task cũ.
- Giữ nguyên ngoại lệ hằng số dữ liệu. Bắt viết doc cho `export const MAX_ATTEMPTS = 3` sẽ **tự sinh
  ra** vi phạm `COMMENT-3`, tức là luật tự cắn đuôi mình.
- Giữ `COMMENT-2` ở tầng `enforced`, kèm câu nói rõ rule chỉ giữ được nửa **tồn tại** và không giữ
  được nửa **hậu quả**. Thông điệp của chính rule cũng đã nói câu đó, nên đây là ghi lại chứ không
  phải nới.
- Giữ `COMMENT-4` ở định nghĩa ba lớp ký tự, **không** nâng lên "ASCII only".
- Giữ ngoại lệ file locale: soi `messages/`, `locales/`, `i18n/` là đi soi sản phẩm.
- Giữ mọi ví dụ ở dạng TypeScript thường trong ứng dụng có hình dạng NestJS, không tên sản phẩm, không tên repository.
  Đường dẫn thật chỉ xuất hiện ở bảng `Anchor`, vì một anchor bắt buộc phải là đường dẫn thật — đó
  chính là thứ làm nó thành anchor.

## Rủi ro còn mở

### `COMMENT-3` — `documented`, và **không rule nào giữ được**

Để giữ mã này, một rule sẽ phải **đọc câu văn và so nghĩa của nó với câu lệnh bên dưới**. Nó phải trả
lời được: câu này có nói điều gì mà dòng code không nói không? Đó là bài toán hiểu ngôn ngữ tự nhiên
đối chiếu ngữ nghĩa chương trình, không phải bài toán duyệt AST.

Cái một rule **có thể** thấy — và đây là toàn bộ những gì nên kỳ vọng nếu có ai định viết:

- comment chỉ chứa các định danh xuất hiện nguyên văn trong dòng ngay dưới, ví dụ
  `// find the payment by provider ref` đứng trên một `findOne(PaymentEntity, { where: { providerRef } })`;
- comment là code bị comment lại, nhận ra bằng cách parse thử nội dung comment;
- doc block chỉ là cái tên khai báo được tách camelCase ra thành câu.

Ba thứ đó bắt được đúng **loại** vi phạm dễ thấy nhất, và bỏ lọt loại nguy hiểm hơn: câu văn từng
đúng, code đổi, câu văn ở lại. Không dấu vết cú pháp nào phân biệt được một câu **đã** đúng với một
câu **đang** đúng.

### `COMMENT-5` — `documented`, và rule hiện tại chỉ **tiêu thụ** marker chứ không **kiểm** nó

`no-non-ascii-source` có thấy chuỗi `vn-ok` và bỏ qua dòng đó. Nó không kiểm bất cứ điều gì về mã này:

- không kiểm marker **có lý do** đi kèm (`vn-ok` trần vẫn tắt được cổng);
- không kiểm lý do đó có **đúng** không;
- không kiểm thứ được đánh dấu là **chuỗi** hay là **comment** — nên marker dùng để giữ một câu tiếng
  Việt vẫn lọt;
- không phát hiện được chiều ngược lại, tức là một chuỗi mà chương trình **thật sự** phụ thuộc nhưng
  đã bị ai đó dịch mất. Chiều đó là chiều gây hại nhất, và nó **không để lại dấu vết cú pháp nào cả**:
  code vẫn compile, test vẫn xanh, chỉ có một nhánh thôi khớp.

Cái một rule **có thể** thấy nếu được viết ra:

- `vn-ok` không có dấu hai chấm và một vế lý do phía sau → báo lỗi. Đây là phần rẻ nhất và nên có.
- marker nằm trên một dòng mà node ở đó là `Line`/`Block` comment chứ không phải string literal →
  báo lỗi, vì ngoại lệ này chỉ dành cho chuỗi.

Cả hai đều khả thi và đều **không** giữ được phần quan trọng nhất: liệu chuỗi đó có thật sự là dữ liệu
chương trình phụ thuộc hay không. Chỉ người viết mới biết bên kia đường dây gửi gì sang.

### Hai lỗ hổng bên trong hai mã đang mang nhãn `enforced`

- **`COMMENT-1`**: rule thấy **sự vắng mặt** của doc block. Nó không thấy doc đó nói gì. Một
  `/** Marks a handler as replayable. */` đứng trên `Replayable` là doc chép lại tên: cổng xanh, luật
  đỏ. Một rule có thể thấy phần này ở mức thô — doc block sau khi bỏ ký tự không phải chữ trùng với
  tên khai báo tách camelCase — và chỉ ở mức thô đó.
- **`COMMENT-2`**: cùng hình dạng. `/** The settled state. */` qua cổng. Rule không có cách nào biết
  "hậu quả" khác "tên viết dài ra".

### Rủi ro đọc nhầm

- **`COMMENT-4` bị đọc thành "chỉ ASCII".** Đây là chỗ dễ đọc nhầm nhất, đã hỏng một lần rồi, và cách
  hỏng là **tạo ra 857 việc không có thật**. Ba record đều nói lại định nghĩa ba lớp ký tự, và
  changelog ghi lại lần hỏng đó để lần sau không phải đo lại.
- **Ngoại lệ lane fixture bị đọc thành "trong test thì thoải mái".** Nó chỉ miễn cho **chuỗi**.
- **Tên rule lệch giữa canon và config đang chạy.** Xem finding cuối ở trên: cần một lần sync có chủ
  đích, và cho tới lúc đó, trích dẫn `no-non-ascii-source` trong một config chưa sync sẽ không resolve.

## Re-audit Triggers

- Có đề xuất thêm hoặc bỏ một mã `COMMENT-<n>`, hoặc đánh số lại một mã đang có.
- Có ai đề xuất nâng `COMMENT-4` thành "ASCII only", hoặc báo cáo một số lượng lớn vi phạm mà phần lớn
  là dấu câu kiểu chữ.
- Có một rule mới ra đời cho `COMMENT-3` hoặc `COMMENT-5`; lúc đó bảng `Tầng giữ` phải đổi cùng lúc ở
  cả `INDEX.md` và ở đây.
- Ngoại lệ lane fixture bị nới sang comment, hoặc có ai dùng `vn-ok` để giữ một comment.
- Số lượng dòng `vn-ok` tăng tới mức không ai đọc lý do nữa; lúc đó marker đã thành nhiễu và ngoại lệ
  cần đo lại.
- Danh tính rule trong config đang chạy được sync với canon, hoặc lệch thêm.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Một anchor trong `INDEX.md` trỏ vào đường dẫn không còn tồn tại.
