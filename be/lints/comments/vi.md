---
id: be-lints-comments-vi
title: vi.md
slug: /be/lints/comments/vi
sidebar_label: vi.md
sidebar_position: 1
description: Ba quy tắc giữ luật chú thích, giữ được tới đâu và còn bỏ sót điều gì.
---

# vi.md

> Version: `2.00`

# Chú thích — phần máy giữ được

Luật chú thích có **năm mã**, từ `COMMENT-1` đến `COMMENT-5`, còn bộ quy tắc chỉ có **ba**.

Chênh lệch đó không phải thiếu sót cần lấp cho tròn. Một luật là câu mà người đọc tuân theo; một
quy tắc là khuôn mà chương trình khớp. Hai thứ không bao giờ bằng nhau, và toàn bộ nội dung tài liệu
này chính là khoảng chênh ấy.

Điều nguy hiểm không phải là một luật không có quy tắc — luật đó ai cũng biết là chưa có máy giữ.
Điều nguy hiểm là **một quy tắc hở mà người ta tưởng đã kín**: bản dựng xanh, và cả đội đọc màu xanh
đó thành "luật đã được tuân thủ".

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `require-export-jsdoc` | `COMMENT-1` | Một lớp, giao diện, bí danh kiểu, enum, hàm khai báo, hoặc `const` gán thẳng vào một biểu thức hàm, được xuất ra mà không có khối `/** … */` đứng trước |
| `require-enum-member-jsdoc` | `COMMENT-2`, chỉ nửa "có tồn tại" | Một thành viên của enum được xuất ra mà không có khối `/** … */` đứng trước |
| `no-non-ascii-source` | `COMMENT-4`, mang theo `COMMENT-5` làm dấu miễn | Một dòng mã nguồn mang chữ cái tiếng Việt có dấu, biểu tượng cảm xúc, hoặc một trong mười hai ký hiệu trang trí được liệt kê |

Hai điều cần nói ngay từ bảng này.

**`COMMENT-3` không có quy tắc nào giữ.** "Chú thích nói *vì sao*, mã nguồn nói *cái gì*" hiện không
ai kiểm. Đây không phải một quy tắc còn thiếu chờ viết: muốn biết một câu có đang chép lại dòng lệnh
ngay dưới nó hay không thì phải hiểu cả hai, và đó là việc của người đọc.

**`COMMENT-5` không phải quy tắc, nó là cửa miễn của quy tắc thứ ba.** Chuỗi mà chương trình **so
khớp** hoặc **phát ra** thì được giữ nguyên, kèm dấu `vn-ok`.

---

## `require-export-jsdoc`

**Bắt gì.** Một thứ được xuất ra khỏi tệp mà không mở đầu bằng khối tài liệu. Cụ thể: `class`,
`interface`, `type`, `enum`, hàm khai báo, và `const` được gán **trực tiếp** bằng một hàm mũi tên
hoặc một biểu thức hàm. Cả dạng `export` có tên lẫn `export default` đều bị soi.

**Giữ mã nào.** `COMMENT-1`, gần như trọn vẹn trong phần máy có thể nhìn thấy: khối tài liệu
**có tồn tại** hay không. Nội dung bên trong khối đó thì không.

**Cách phát hiện.** Quy tắc thăm hai nút `ExportNamedDeclaration` và `ExportDefaultDeclaration`. Nếu
`node.declaration` không có thì thoát ngay. Nếu là `VariableDeclaration` thì chỉ xét
`declarations[0].init`, và chỉ đi tiếp khi init đó là `ArrowFunctionExpression` hoặc
`FunctionExpression`. Ngoài ra phải là một trong năm loại: `TSInterfaceDeclaration`,
`TSTypeAliasDeclaration`, `TSEnumDeclaration`, `ClassDeclaration`, `FunctionDeclaration`. Cuối cùng
gọi `sourceCode.getCommentsBefore(node)` và cho qua nếu **bất kỳ** chú thích trả về nào có
`type === "Block"` và `value` bắt đầu bằng `*`.

**Vì sao luật này đáng có máy giữ.** Vì thứ được xuất ra là **bề mặt mà tệp khác dựa vào**. Người ta
đọc nó lúc đang quyết định có nên dùng hay không, và cái tên cộng chữ ký chỉ nói được nó **nhận** gì
— không bao giờ nói nó **để làm gì**, cũng không nói khi nào nên với tay lấy nó thay vì thứ nằm ngay
bên cạnh. Đây cũng là loại thiếu sót mà con người soi rất tệ: một tệp sáu trăm dòng đủ để không ai
  nhận ra có hai thứ đã được xuất ra mà không có tài liệu.

Hằng số dữ liệu được cố tình bỏ ra ngoài. `export const MAX_ATTEMPTS = 3` đã tự mô tả xong bằng
chính cái tên của nó, và ép viết một câu bên cạnh chỉ đẻ ra những câu chép lại tên — đúng thứ mà
`COMMENT-3` cấm và không quy tắc nào bắt được.

**Cửa còn mở.**

- **Xuất lại thì tàng hình.** `export { Thing }`, `export { Thing } from "./thing"` — không có
  `declaration` nên quy tắc thoát tức thì. `export * from "./thing"` thì thậm chí không có nút nào
  được thăm. Một tệp gom đầu mối có thể công bố toàn bộ bề mặt mà không một dòng tài liệu nào.
- **Gói hàm vào một lời gọi là thoát.** `export const run = memo(() => {})`, `= make(1)`,
  `= other.bind(null)`, `= class {}` — init không còn là biểu thức hàm nguyên dạng, nên một thứ gọi
  được bị coi là hằng số dữ liệu.
- **`export default () => {}` không bị báo**, trong khi `export const f = () => {}` thì bị bắt. Miễn trừ
  ở đây phụ thuộc vào **hình thức xuất**, không phụ thuộc vào thứ được xuất.
- **Chỉ khai báo đầu tiên được xét.** `export const MAX = 3, run = () => {}` lọt sạch. Đảo thứ tự
  lại thì bắt.
- **`/** */` rỗng là hợp lệ**, vì `value` của nó bắt đầu bằng `*`.
- **Bất kỳ khối tài liệu nào đứng trước cũng tính.** Một dòng tiêu đề tệp, hay một khối tài liệu mồ
  côi còn sót lại sau khi xoá khai báo cũ, đều đủ để thứ ngay dưới nó được coi là đã có tài liệu.
- **Chữ ký nạp chồng không bị đòi.** Chữ ký không thân hàm là `TSDeclareFunction`, không nằm trong
  năm loại. Tài liệu bị đòi ở **phần cài đặt** — đúng cái chữ ký mà người gọi không bao giờ đọc.
- **Thành viên của lớp nằm ngoài tầm.** Một phương thức công khai trên một lớp đã có tài liệu thì
  không bị đòi gì, dù tệp khác dựa vào nó y hệt.
- **Nội dung khối tài liệu không được kiểm.** Một câu chép lại cái tên vẫn xanh.

---

## `require-enum-member-jsdoc`

**Bắt gì.** Một thành viên của enum **được xuất ra** mà không có khối tài liệu riêng.

**Giữ mã nào.** `COMMENT-2`, và chỉ **nửa đầu** của nó. Luật đòi thành viên nói ra **hệ quả của việc
chọn nó**; quy tắc chỉ thấy được là có hay không có một khối tài liệu. Thông điệp lỗi tự nói ra giới
hạn này thay vì giả vờ.

**Cách phát hiện.** Thăm nút `TSEnumDeclaration`, thoát nếu `node.parent.type` không phải
`ExportNamedDeclaration`. Với mỗi phần tử trong `node.members`, áp đúng phép thử
`getCommentsBefore` / `Block` / mở đầu bằng `*` như quy tắc trên.

**Vì sao luật này đáng có máy giữ.** Vì một thành viên enum **được chọn ở một nơi rất xa cái `switch`
cho nó ý nghĩa**. Người viết dòng `state = PaymentState.Settled` thường không mở tệp chứa nhánh xử
lý; họ chọn theo cái tên. Nếu cái tên là tất cả những gì họ có, họ sẽ chọn sai đúng vào lúc hậu quả
đắt nhất — quyền truy cập đã mở, tiền đã ghi nhận, đơn đã coi như xong.

Đây cũng là chỗ con người bỏ sót đều đặn nhất: thêm một thành viên thứ tám vào một enum đã có bảy
thành viên có tài liệu là thao tác một dòng, và một dòng thì không ai nhớ phải kèm gì.

**Cửa còn mở.**

- **Nửa quan trọng hơn không kiểm được.** `/** Trạng thái đang chờ. */` — đúng câu mà luật in ra làm
  ví dụ phản diện — vẫn qua. Máy đếm được khối tài liệu, không đọc được nó.
- **`/** */` rỗng vẫn qua.**
- **Tách từ khoá `export` ra là tắt quy tắc.** Viết `enum State { … }` rồi `export { State }` ở dòng
  sau thì `parent` không còn là nút xuất, và mọi yêu cầu biến mất.
- **Đối tượng hằng thay cho enum thì cả hai quy tắc đều không báo.**
  `export const State = { Pending: "pending" } as const` là hằng số dữ liệu với quy tắc thứ nhất, và
  không phải `TSEnumDeclaration` với quy tắc thứ hai. Cấu trúc hay được dùng thay enum nhất lại đúng
  là cấu trúc không quy tắc nào phủ.
- **Hợp kiểu chuỗi cũng vậy.** `export type State = "pending" | "settled"` chỉ cần **một** khối tài
  liệu cho cả bí danh; từng lựa chọn thì không cần gì. Quan hệ mà `COMMENT-2` sinh ra để bảo vệ biến
  mất sạch, và bản dựng vẫn xanh.

---

## `no-non-ascii-source`

**Bắt gì.** Một **dòng** mã nguồn mang một trong ba thứ: chữ cái tiếng Việt có dấu, biểu tượng cảm
xúc, hoặc một ký hiệu trang trí nằm trong danh sách mười hai ký tự.

**Giữ mã nào.** `COMMENT-4`. Nó mang theo `COMMENT-5` không phải như một điều kiện bắt, mà như **cửa
miễn**: dấu `vn-ok` trên dòng nào thì dòng đó được bỏ qua.

**Cách phát hiện.** Đọc `context.filename`, đổi dấu gạch ngược thành gạch chéo, và trả về bộ thăm
rỗng nếu đường dẫn khớp `/(?:messages|locales|i18n)/`. Tính "làn dữ liệu thử" từ `\.spec\.ts$`,
`-spec\.ts$` hoặc `/src/tests/`; trong làn đó nó dựng một tập số dòng từ khoảng trải của
`sourceCode.getAllComments()`. Đến `Program:exit` thì duyệt `sourceCode.getLines()` — **văn bản
thô, không phải cây cú pháp** — bỏ qua dòng khớp `\bvn-ok\b`, bỏ qua dòng không phải chú thích khi
đang trong làn, cắt lần xuất hiện **đầu tiên** của chuỗi `Tiếng Việt`, rồi thử ba lớp ký tự theo thứ
tự.

**Vì sao luật này đáng có máy giữ.** Vì hệ quả của nó không hiện ra ở người viết mà ở **người đọc
tiếp theo** — và người đó thường chưa có mặt lúc dòng chú thích được gõ. Một kho mã có hai ngôn ngữ
trong nó là một kho mã có ai đó không đọc được một nửa lý lẽ, và đúng cái nửa họ không đọc được lại
là nửa giải thích những chỗ bất ngờ. Không ai cố ý gây ra chuyện này; nó xảy ra từng dòng một, mỗi
dòng đều có lý do chính đáng vào lúc đó. Chỉ có máy mới đếm nổi.

Quy tắc này thay thế ba quy tắc riêng lẻ ở bộ tham chiếu — một cho tiếng Việt, một cho biểu tượng
cảm xúc, một cho ký hiệu trang trí. Ba lớp ký tự đó trả lời **một** câu hỏi, và người chạm phải quy
tắc biểu tượng cảm xúc thì không học được gì về hai cái kia. Một quy tắc một lý do thì dễ tuân hơn,
và không thể lách bằng cách đổi bảng chữ cái — trừ những chỗ dưới đây.

**Cửa còn mở.**

- **Tiếng Việt không dấu lọt sạch.** Lớp ký tự khớp **dấu phụ**, nên một câu viết không dấu không
  mang một điểm mã nào khớp cả. Quy tắc nhận diện một **lối viết**, không nhận diện một **ngôn ngữ**.
- **Mọi ngôn ngữ khác đều lọt.** Tiếng Nga, Trung, Nhật, Hàn, Thái, Hy Lạp — không chữ nào thuộc ba
  lớp. Luật từ chối "kho mã có hai ngôn ngữ"; quy tắc từ chối đúng một bảng chữ cái.
- **Danh sách trang trí là mười hai ký tự viết tay.** `⭐` (`U+2B50`) có trong danh sách, `⭕`
  (`U+2B55`) thì không. Mũi tên dạng biểu tượng `➡` rơi vào dải `2600–27BF` nên bị bắt, còn `→`
  (`U+2192`) — cái mũi tên người ta thật sự gõ — thì không.
- **Chuỗi thoát hoá thì tàng hình.** `"Đặt hàng"` là ASCII thuần trên dòng, và chương
  trình vẫn phát ra đúng văn bản đó lúc chạy.
- **Cấm theo thư mục không phải cấm theo tệp.** Bất kỳ tệp nào nằm trong thư mục tên `messages`,
  `locales` hay `i18n` đều được miễn **toàn bộ** — quy tắc trả về bộ thăm rỗng, nên chú thích trong
  tệp đó cũng không bị soi, không riêng phần nội dung hiển thị. Cùng nội dung ấy đặt ở
  `payment/messages.ts` thì bị soi đủ.
- **Làn dữ liệu thử buộc vào tên tệp.** `foo.spec.ts` được miễn phần chuỗi; đúng tệp đó đổi tên
  thành `foo.test.ts` thì không, `__tests__/helper.ts` cũng không. Tách dữ liệu thử ra một mô-đun
  riêng cho gọn là làm nó rơi khỏi làn.
- **Dấu `vn-ok` miễn cả dòng và không đòi lý do.** Biểu thức là `\bvn-ok\b`, không hơn. Một dòng vừa
  mang chuỗi nhà cung cấp hợp lệ vừa mang một câu lý lẽ chưa dịch thì qua trọn vẹn.
- **Không gì phân biệt dữ liệu với văn xuôi ngoài lời tự khai của người viết.** Ranh giới của
  `COMMENT-5` nằm hoàn toàn ở chỗ tin nhau.

## Luật

1. Danh tính của một quy tắc là **cái tên nó công bố**. Không đặt thêm mã số cho nó.
2. Tên quy tắc chép nguyên văn, kể cả khi bên trong có tên riêng, vì đó là chuỗi mà bản dựng in ra
   và là chuỗi phải gõ đúng trong một chú thích tắt quy tắc.
3. Chỉ ghi những quy tắc **đang tồn tại** trong tệp nguồn. Một quy tắc đáng có mà chưa có là một đề
   xuất, và chỗ của nó là `audit.md`.
4. Mỗi quy tắc phải có ít nhất **một cửa còn mở** được nêu thật, hoặc một lập luận vì sao nó kín.
5. Một mã luật không có quy tắc thì ghi là **chưa có máy giữ**, không gán tạm cho quy tắc gần nhất.
6. Không bao giờ báo cáo một phép kiểm **có tồn tại** như thể nó là phép kiểm **nội dung**.

## Ngoại lệ

Ngoại lệ ở đây là **thuộc tính của quy tắc**, không phải chỗ để lách.

- **Chuỗi đã đánh dấu.** Dòng khớp `\bvn-ok\b` bị bỏ qua hoàn toàn. Đó là `COMMENT-5` đang hoạt động
  đúng ý đồ, và nó theo từng dòng, không được kiểm chứng, và miễn trọn vẹn.
- **Thư mục nội dung hiển thị.** Đường dẫn chứa `messages/`, `locales/` hay `i18n/` thì tắt hẳn quy
  tắc thứ ba. Soi nội dung hiển thị là soi chính sản phẩm.
- **Làn dữ liệu thử.** Trong `*.spec.ts`, `*-spec.ts` và `src/tests/`, chỉ dòng chú thích bị soi.
  Một câu mà người dùng thật sẽ gõ là **dữ liệu** đang được nạp vào hệ thống, dịch nó đi là đang thử
  một hệ thống không ai dùng. Nhưng chú thích trong tệp thử vẫn là văn xuôi, và vẫn bị từ chối.
- **Hằng số dữ liệu.** `export const MAX_ATTEMPTS = 3` được miễn `require-export-jsdoc` một cách cố
  ý.
- **Tên gọi của chính ngôn ngữ.** Chuỗi `Tiếng Việt` bị cắt **một lần** trước khi thử lớp chữ cái, vì
  nó là một nhãn chứ không phải văn xuôi. Phép cắt không toàn cục, nên một dòng mang nó hai lần vẫn
  bị báo.
