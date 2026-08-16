---
id: be-lints-comments-audit
title: audit.md
slug: /be/lints/comments/audit
sidebar_label: audit.md
sidebar_position: 3
description: Đánh giá độ phủ của ba quy tắc so với năm mã luật và ghi lại mọi kẽ hở còn tồn tại.
---

# audit.md

> Version: `2.00`

Bản đánh giá này chỉ hỏi một câu: **màu xanh của bản dựng chứng minh được điều gì, và không chứng minh
được điều gì.**

Mọi khẳng định dưới đây được **đo**, không suy ra từ tên quy tắc: từng cấu trúc được chạy qua chính
ba quy tắc đó với bộ phân tích cú pháp thật, rồi ghi lại trường hợp bị báo hay không bị báo.

## Verdict

**Chấp nhận, kèm ba điều phải nói ra thành lời.**

Ba quy tắc giữ được phần mà máy giữ được, và giữ đúng. Không quy tắc nào bịa ra một luật chặt hơn
luật, không quy tắc nào giả vờ kiểm được thứ nó không kiểm được — thông điệp của
`require-enum-member-jsdoc` tự khai giới hạn của chính nó, và đó là hành vi đúng.

Nhưng mức phủ **không** bằng luật, và khoảng cách đủ lớn để phải in ra:

1. **`COMMENT-3` không có quy tắc nào giữ.** Không phải thiếu, mà là không giữ được bằng máy.
2. **`COMMENT-2` chỉ được giữ nửa đầu.** Nửa quan trọng hơn — thành viên nói ra **hệ quả** — nằm ngoài
   tầm của mọi phép kiểm tự động.
3. **`no-non-ascii-source` không làm điều mà tên nó hứa.** Nó không cấm ký tự ngoài ASCII; nó cấm ba
   lớp ký tự được liệt kê tay. Dấu gạch dài, nháy cong, `naïve`, `façade`, khung kẻ hộp đều qua — và
   đó là **chủ ý**, được ghi rõ trong tệp nguồn sau khi một bản đầu tiên cấm mọi điểm mã ngoài ASCII
   đã báo 857 chỗ mà không chỗ nào là lỗi. Vấn đề không nằm ở hành vi, nằm ở cái tên.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số quy tắc công bố | **Ba**, đúng như dự kiến. `rules` và `recommended` khớp nhau, cùng ba tên, cùng mức `error`, tiền tố `starci-be/` |
| Quy tắc nào cũng chỉ ra được một mã luật | Hai chỉ ra trọn vẹn, một chỉ ra nửa mã. Không quy tắc nào mồ côi |
| Mã luật nào cũng có quy tắc | **Không.** `COMMENT-3` không có; `COMMENT-5` không phải quy tắc mà là cửa miễn của quy tắc thứ ba |
| Phép kiểm "có tồn tại" bị nhầm thành phép kiểm "nội dung" | Không, ở tầng quy tắc. Nhưng cực dễ nhầm ở tầng người đọc bản dựng — đây là rủi ro chính |
| Quy tắc có bịa ra luật chặt hơn luật không | Không. Miễn hằng số dữ liệu, miễn thư mục nội dung hiển thị, miễn làn dữ liệu thử — cả ba đều lần ngược được về một câu trong luật |
| Có quy tắc nào lách được bằng cách đổi tên tệp | Có, đúng một: `no-non-ascii-source`. Hai quy tắc `jsdoc` không đọc tên tệp |
| Có quy tắc nào lách được bằng cách gom chuỗi vào hằng, mảng, đối tượng | Không. Quét theo dòng thô nên miễn nhiễm với kiểu lách này |
| Có quy tắc nào lách được bằng cách đổi hình thức khai báo | Có, nhiều: xuất lại, bọc lời gọi, `as const`, hợp kiểu chuỗi, tách từ khoá `export` |
| Có báo nhầm đã đo được không | Có một: khối tài liệu đặt **trên** bộ trang trí vẫn bị báo thiếu |

## Findings

**F1 — `COMMENT-3` không có quy tắc.** "Chú thích nói vì sao, mã nguồn nói cái gì" là mã duy nhất
trong năm mã hoàn toàn không có máy giữ. Đây là mã dễ vi phạm nhất và cũng là mã không thể tự động
hoá: muốn biết một câu có chép lại dòng dưới nó hay không thì phải hiểu cả hai. Ghi nhận là **chưa có
máy giữ**, không gán tạm cho quy tắc gần nhất.

**F2 — nửa sau của `COMMENT-2` nằm ngoài tầm.** Quy tắc đếm được khối tài liệu, không đọc được câu.
`/** Trạng thái đang chờ. */` — đúng câu mà luật in ra làm ví dụ phản diện — vẫn xanh. Quy tắc nói
thẳng điều này trong thông điệp của nó, và đó là cách xử lý đúng: nói ra giới hạn thay vì giả vờ.

**F3 — tên `no-non-ascii-source` hứa nhiều hơn hành vi.** Xem Verdict. Hành vi đúng, tên sai. Đổi tên
là một thay đổi luật, không phải một lần sửa chữ, vì cái tên đó đã nằm trong nhật ký bản dựng và
trong mọi chú thích tắt quy tắc đã viết.

**F4 — `require-export-jsdoc` phủ theo *hình thức khai báo*, không theo *bề mặt*.** Một hàm là hàm dù
nó được gán thẳng hay đi qua `memoize`; một lớp là lớp dù nó là `ClassDeclaration` hay
`ClassExpression`. Quy tắc chỉ thấy dạng thứ nhất. Hệ quả: `export const f = () => {}` bị đòi tài
liệu, `export const f = memoize(() => {})` thì không, và hai dòng đó công bố cùng một bề mặt.

**F5 — chữ ký nạp chồng bị đảo ngược.** Tài liệu bị đòi ở phần cài đặt — chữ ký duy nhất người gọi
không đọc — trong khi các chữ ký nạp chồng, thứ thật sự tạo nên bề mặt, không bị đòi gì. Một tệp chỉ
có chữ ký thì hoàn toàn không bị báo.

**F6 — báo nhầm khi có bộ trang trí.** Đã đo: `/** … */` đặt **trên** một bộ trang trí thì lớp bên
dưới vẫn bị báo thiếu tài liệu; đặt **giữa** bộ trang trí và `export` thì qua. Trong một nền tảng
dùng bộ trang trí dày đặc, đây là báo nhầm phổ biến nhất, và cách "sửa" mà nó dạy — đẩy khối tài liệu
xuống dưới bộ trang trí — lại là chỗ người đọc không tìm.

**F7 — cửa miễn `vn-ok` không có điều kiện nào.** Biểu thức là `\bvn-ok\b`. Không đòi lý do dù thông
điệp có xin, không đòi nằm trong chú thích, và miễn **cả dòng**. Đã đo: một dòng vừa mang chuỗi nhà
cung cấp hợp lệ vừa mang một câu lý lẽ chưa dịch thì qua trọn vẹn.

**F8 — miễn theo thư mục là miễn toàn tệp.** Với đường dẫn khớp `messages/`, `locales/` hay `i18n/`,
quy tắc trả về bộ thăm rỗng. Nghĩa là **chú thích** trong tệp đó cũng thoát, không riêng phần nội
dung hiển thị — vượt quá lý do được nêu ("soi nội dung hiển thị là soi chính sản phẩm").

**F9 — làn dữ liệu thử buộc vào tên tệp và bị phá vỡ khi dọn dẹp.** Đã đo: `foo.spec.ts` miễn phần
chuỗi, `foo.test.ts` và `__tests__/helper.ts` thì không. Tách dữ liệu thử ra một mô-đun riêng — thao
tác dọn dẹp bình thường — làm nó rơi khỏi làn và sinh ra hàng loạt lỗi mới trên đúng thứ dữ liệu vốn
hợp lệ.

**F10 — phép cắt tên gọi ngôn ngữ không toàn cục.** `line.replace(ENDONYM, "")` chỉ cắt lần xuất hiện
đầu tiên, nên một dòng mang nhãn đó hai lần vẫn bị báo. Lệch nhỏ, nghiêng về phía chặt hơn.

## Decisions

- **Giữ đúng ba quy tắc đang có.** Không đề xuất thêm quy tắc nào trong bản này.
- **Ghi `COMMENT-3` là chưa có máy giữ**, ở cả `INDEX.md` và `vi.md`, thay vì gán nó cho một quy tắc
  gần đúng.
- **Ghi `COMMENT-2` là được giữ nửa đầu**, dùng đúng chữ mà thông điệp của quy tắc đã dùng.
- **Không đổi tên `no-non-ascii-source` trong bản này.** Tên đã ở trong nhật ký bản dựng và trong các
  chú thích tắt quy tắc; đổi tên là thay đổi luật, phải đi qua `changelog.md` và một lần tăng phiên
  bản, không phải một lần sửa chữ.
- **Chép nguyên văn mọi tên quy tắc**, kể cả tiền tố mang tên riêng, vì đó là chuỗi mà máy in ra.
- **Không đặt mã số riêng cho quy tắc.** Danh tính của quy tắc là cái tên nó công bố; đặt thêm số
  nghĩa là một quy tắc có hai tên và không ai truy được thông điệp đến từ tên nào.
- **Mọi ví dụ để ở dạng mã nguồn thường**, không tên sản phẩm, không thư viện riêng.

## Rủi ro còn mở

Mỗi mục dưới đây là một cửa còn mở đã đo được, kèm **thứ mà quy tắc phải soi thêm** để đóng nó — hoặc
lý do vì sao đóng đắt hơn để mở.

### `require-export-jsdoc`

| Cửa còn mở | Đóng bằng cách nào |
|---|---|
| `export { X }`, `export { X } from`, `export * from` | Phải thăm thêm `ExportAllDeclaration` và `ExportSpecifier`, rồi lần theo `X` về nơi khai báo gốc — nghĩa là cần thông tin xuyên tệp. Rẻ hơn nhiều: bắt buộc khai báo phải có tài liệu **tại nơi khai báo**, và chấp nhận rằng tệp đầu mối chỉ chuyển tiếp. Nhưng khi nơi khai báo là một tệp khác không được lint thì vẫn hở |
| `= memoize(() => {})`, `= createHandler(X)`, `= class {}` | Nhận thêm `ClassExpression`, và với `CallExpression` thì phải suy luận kiểu để biết kết quả có gọi được không. `ClassExpression` đóng được rẻ, gần như miễn phí. Phần `CallExpression` cần dịch vụ kiểu — đắt, và làm quy tắc phụ thuộc chương trình biên dịch |
| `export default () => {}` và `export default { … }` | Đóng rẻ: cho `ExportDefaultDeclaration` nhận thêm `ArrowFunctionExpression`, `FunctionExpression`, `ObjectExpression`. Chỉ là một dòng trong tập điều kiện. **Nên đóng.** |
| `export const A = 3, run = () => {}` | Đóng rẻ: duyệt **mọi** phần tử của `declarations` thay vì lấy `[0]`. **Nên đóng.** |
| `/** */` rỗng | Đóng rẻ: đòi `comment.value.replace(/[*\s]/g, "").length > 0`. Không kiểm được chất lượng, nhưng chặn được khối rỗng cố tình |
| Tiêu đề tệp phục vụ thứ nằm dưới nó | Phải lấy **chú thích cuối cùng liền kề** thay vì "bất kỳ chú thích nào", và kiểm khoảng cách dòng giữa chú thích với khai báo. Đóng được, và sẽ đẻ ra một lớp báo nhầm mới ở những tệp mở đầu bằng tiêu đề rồi xuất ngay — cần đo trước khi đổi |
| Chữ ký nạp chồng | Phải nhận thêm `TSDeclareFunction` và chuyển yêu cầu tài liệu từ phần cài đặt sang **chữ ký đầu tiên**. Đây là thay đổi luật chứ không phải sửa quy tắc: nó đổi chỗ mà tác giả phải viết |
| Thành viên công khai của lớp | Phải mở rộng tầm sang `MethodDefinition` và `PropertyDefinition` công khai. Đóng được về mặt kỹ thuật; **chưa nên**, vì luật hiện chỉ nói về "thứ được xuất ra", và mở rộng tầm quy tắc trước khi luật nói tới là bịa luật |
| Nội dung khối tài liệu | **Không đóng được.** Đây là `COMMENT-3`, và nó thuộc về người đọc |
| Báo nhầm khi có bộ trang trí *(F6)* | Phải lấy chú thích đứng trước **bộ trang trí đầu tiên** khi khai báo có `decorators`, chứ không chỉ trước nút xuất. Đóng được, và **nên đóng** — đây là báo nhầm, giá của nó là tác giả bị dạy đặt tài liệu sai chỗ |

### `require-enum-member-jsdoc`

| Cửa còn mở | Đóng bằng cách nào |
|---|---|
| Khối tài liệu chép lại tên thành viên | **Không đóng được thật.** Có thể chặn thô: từ chối khối mà sau khi bỏ dấu câu chỉ còn đúng các từ trong tên thành viên. Bắt được `/** The pending state. */`, không bắt được `/** Used when pending. */` — và nó đẻ ra báo nhầm ở những thành viên mà tên **đúng là** lời giải thích ngắn nhất |
| `/** */` rỗng | Như trên, đóng rẻ |
| `enum X {}` rồi `export { X }` | Bỏ điều kiện `node.parent.type === "ExportNamedDeclaration"` và thay bằng: enum có được xuất ra ở bất kỳ đâu trong tệp không. Cần một lượt quét các `ExportSpecifier` trong cùng tệp — vừa sức, **nên đóng**, vì hiện tại một từ khoá dời chỗ là tắt cả quy tắc |
| `export const X = { … } as const` | Phải nhận diện khuôn "đối tượng đóng vai enum": `ObjectExpression` + `as const` + được xuất ra. Nhận diện được, và sẽ bắt nhầm mọi bảng tra cứu hằng — cần một tín hiệu hẹp hơn trước khi thử |
| `export type X = "a" \| "b"` | Phải đòi tài liệu cho từng nhánh của `TSUnionType` gồm toàn `TSLiteralType`. Cú pháp cho phép chú thích giữa các nhánh, nên đòi được. Đây là thay đổi luật: hiện luật chỉ nói "enum" |

### `no-non-ascii-source`

| Cửa còn mở | Đóng bằng cách nào |
|---|---|
| Tiếng Việt không dấu | **Rất khó đóng, và không nên thử bằng ký tự.** Không có điểm mã nào để bắt; phải nhận dạng ngôn ngữ theo từ, nghĩa là một danh sách từ — thứ sẽ bắt nhầm mọi định danh, mọi tên biến viết tắt, mọi mã nhà cung cấp. Đây là chỗ mà luật phải do người giữ, và tài liệu phải nói rõ là quy tắc **không** giữ |
| Tiếng Nga, Trung, Nhật, Hàn, Thái, Hy Lạp | Đóng được và **nên đóng**: thêm các dải chữ cái tương ứng vào lớp thứ nhất. Chi phí gần bằng không, và nó khép lại chỗ hở buồn cười nhất — hiện có thể viết chú thích bằng bất kỳ ngôn ngữ nào ngoại trừ đúng một ngôn ngữ |
| `→`, `⇒`, `●`, `⬛`, `⭕`, khung kẻ hộp | Danh sách mười hai ký tự viết tay là chỗ yếu về bản chất. Đóng đúng cách không phải là kéo dài danh sách mà là đổi tiêu chí: chặn theo **thể loại Unicode** cho các ký hiệu, rồi liệt kê ngoại lệ cho những gì mã nguồn vẫn dùng hợp lệ (khung kẻ hộp trong biểu ngữ, dấu chấm giữa). Đây là việc phải đo trước, đúng như bản đầu tiên của quy tắc này đã phải đo |
| Chuỗi thoát hoá `Đ…` | Phải giải mã chuỗi thoát trước khi thử, tức là phải rời khỏi cách quét theo dòng thô và đọc giá trị chuỗi từ cây cú pháp. Đổi cả cơ chế để bắt một trường hợp hiếm và không phải phá hoại — **chưa đáng**. Nhưng phải ghi ra, vì im lặng ở đây trông giống như đã kiểm |
| Thư mục miễn thì miễn cả chú thích *(F8)* | Đóng rẻ và **nên đóng**: thay `return {}` bằng chế độ chỉ-soi-chú-thích, đúng như làn dữ liệu thử đang làm. Lý do được nêu chỉ biện minh cho việc miễn phần nội dung hiển thị, không biện minh cho việc miễn phần lý lẽ |
| Làn dữ liệu thử theo tên tệp *(F9)* | Không có cách đóng nào sạch bằng đường dẫn. Có thể nới thêm `\.test\.ts$` và `/__tests__/`, nhưng mọi lần nới đều để lại một cái tên khác ở ngoài. Cách đúng hơn là gắn làn vào **cấu hình lint** của thư mục thử thay vì vào biểu thức trong quy tắc — và đó là thay đổi ở tầng cấu hình, không ở tầng quy tắc |
| `vn-ok` miễn cả dòng, không đòi lý do *(F7)* | Đòi lý do thì rẻ: đổi thành `\bvn-ok:\s*\S`. Thu hẹp phạm vi trong dòng thì đắt hơn — phải biết dấu đứng ở đâu và chuỗi nào nó bảo vệ, tức là phải đọc cây cú pháp. Bước đầu **nên làm**: đòi lý do |
| Không gì phân biệt dữ liệu với văn xuôi ngoài lời tự khai | **Không đóng được, và không nên.** Chỉ người viết mới biết chuỗi đó có phải thứ chương trình so khớp hay không. Giá trị của dấu không nằm ở chỗ nó được kiểm chứng, mà ở chỗ nó **để lại một câu giải thích** cho đợt quét sau |
| Cắt tên gọi ngôn ngữ không toàn cục *(F10)* | Đóng bằng một cờ `g`. Lệch nhỏ và nghiêng về phía chặt hơn, nên không gấp |

### Rủi ro không thuộc quy tắc nào

- **Màu xanh bị đọc thành "đã tuân thủ luật".** Đây là rủi ro lớn nhất của cả mô-đun và không quy
  tắc nào chữa được. Ba quy tắc giữ hai mã rưỡi trên năm mã; hai mã rưỡi còn lại do người đọc giữ.
- **Thông điệp của quy tắc thứ ba dạy đặt dấu `vn-ok` ở khắp nơi.** Vì nó quét dòng thô, nó không
  phân biệt được định danh, hàng dữ liệu gieo mầm, kiểu chữ và đường dẫn nhập — đã đo, cả bốn đều bị
  báo — và mọi thông điệp đều mời đặt dấu. Ngoài ba thư mục được miễn, đây là con đường để dấu miễn
  lan xuống dữ liệu sản phẩm, tới lúc người đọc thôi nhìn thấy dấu.

## Re-audit Triggers

- Tệp nguồn công bố thêm, bớt hoặc đổi tên một quy tắc.
- Một mã luật mới được thêm vào `COMMENT-*`, hoặc một mã hiện có đổi nghĩa.
- Có đề xuất đổi tên `no-non-ascii-source` cho khớp hành vi.
- Có đề xuất mở rộng tầm của `require-export-jsdoc` xuống thành viên của lớp.
- Một cửa còn mở ở trên bị dùng thật trong mã sản phẩm — dù cố ý hay do dọn dẹp.
- Số lần báo nhầm do vị trí bộ trang trí đủ để tác giả bắt đầu tắt quy tắc bằng chú thích.
- Một lớp ký tự mới được thêm vào lớp chữ cái, hoặc danh sách ký hiệu trang trí bị kéo dài thêm lần
  nữa — dấu hiệu cho thấy tiêu chí đang sai chứ không phải danh sách đang thiếu.
- Làn dữ liệu thử được nới thêm một khuôn tên tệp nữa.
