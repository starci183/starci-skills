---
id: be-lints-cqrs-vi
title: vi.md
slug: /be/lints/cqrs/vi
sidebar_label: vi.md
sidebar_position: 1
description: Ba quy tắc lint giữ luật CQRS — bắt gì, phát hiện bằng cách nào và còn bỏ sót điều gì.
---

# vi.md

> Version: `2.00` · Mô-đun: `cqrs`

# Ba quy tắc máy giữ luật CQRS

Luật CQRS có bảy mã, `CQRS-1` đến `CQRS-7`. **Chỉ ba mã là hình dạng mà một bộ phân tích cú pháp
nhìn thấy được.** Bốn mã còn lại — công việc nằm ở đâu, lớp điều phối mỏng đến mức nào, thất bại
được ném ra hay trả về, người gọi có đang đợi một sự kiện hay không — là **phán đoán**. Một quy tắc
đoán mò mấy thứ đó sẽ báo nhầm trên code đúng đủ nhiều lần để mọi người học được cách tắt nó đi, và một quy
tắc bị tắt thì không giữ gì cả trong khi trông vẫn như đang giữ.

Tài liệu này không chép lại luật. Nó nói **máy thấy được đến đâu** và **hết thấy từ chỗ nào**.

Một mã không có quy tắc thì ai cũng biết là chưa có ai giữ, nên vẫn còn được đọc bằng mắt. Một quy
tắc bị tin là kín mà thật ra hở thì tệ hơn: nó mua sự im lặng và trả bằng cảm giác đã được che.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `handler-overrides-process` | `CQRS-3` | Lớp xử lý có decorator mà khai báo `execute`; hoặc lớp xử lý không kế thừa ai mà không có cả `execute` lẫn `process` |
| `message-carries-params-only` | `CQRS-2` | Lớp thông điệp (không decorator, trong tệp `.command.ts`/`.query.ts`) có phương thức ngoài hàm dựng; hoặc hàm dựng không nhận đúng một tham số tên `params` |
| `handler-has-twin-spec` | `CQRS-7` | Tệp `<thao-tác>.handler.ts` mà danh sách cấu hình đưa vào không chứa `<thao-tác>.handler.spec.ts` |

Cả ba quy tắc đều có mã luật để giữ. Chiều ngược lại mới là chỗ trống: `CQRS-1`, `CQRS-4`, `CQRS-5`
và `CQRS-6` **không có quy tắc nào**, và không quy tắc nào ở đây nhận vơ chúng.

---

## `handler-overrides-process`

**Bắt gì.** Hai chuyện khác nhau, hai thông điệp khác nhau.

- `overridesExecute` — một lớp mang decorator xử lý mà khai báo phương thức `execute`. Nó **tự bước
  ra khỏi phương thức khuôn mẫu** ở lớp cơ sở: `execute` công khai là chỗ gọi vào `process` được bảo
  vệ, nên ghi đè `execute` là cắt đứt đoạn nối đó.
- `noProcess` — một lớp mang decorator xử lý, **không kế thừa ai**, mà không khai báo `process`.
  Lớp cơ sở khai `process` là trừu tượng và gọi nó từ `execute`; một lớp xử lý không cài đặt cái
  nào thì không có việc gì để điều phối tới.

**Giữ mã nào.** `CQRS-3`.

**Cách phát hiện.** Chỉ thăm `ClassDeclaration`. Cổng đầu tiên: lớp phải mang một decorator mà tên
khớp `/^(?:Command|Query|Events)Handler$/` — tên đọc từ `Identifier` trần, hoặc từ `callee` kiểu
`Identifier` của một `CallExpression`. Sau đó duyệt `node.body.body` tìm `MethodDefinition` có
`key.name === "execute"`; thấy thì báo ngay tại khoá của phương thức và dừng. Không thấy: nếu
`node.superClass` tồn tại thì thôi, còn không thì tìm `MethodDefinition` có `key.name === "process"`
và báo nếu vắng. **Không có cổng theo tên tệp** — quy tắc này sống ở mọi tệp.

**Vì sao luật này đáng có máy giữ.** Vì đây đúng là loại sai lầm mà con người không nhìn ra. Ghi đè
`execute` **vẫn biên dịch và vẫn chạy**. Không có gì đỏ lên. Tệp đó nằm sai chỗ một cách yên lặng
cho tới ngày ai đó thêm một mối quan tâm cắt ngang vào lớp cơ sở — một phép đo thời gian, một giao
dịch, một lần thử lại — và đúng tệp này là tệp duy nhất không nhận được. Sai ở chỗ vô hình tại điểm
  gọi, đắt về sau: đó là lý do cần có máy kiểm tra.

**Cửa còn mở.**

- **Trường của lớp thay cho phương thức.** `override execute = async (command: C) => { … }` là
  `PropertyDefinition`, không phải `MethodDefinition`. Nó vẫn che phương thức của lớp cơ sở lúc chạy
  — nghĩa là khuôn mẫu **thật sự** bị bỏ — mà quy tắc không thấy gì.
- **Khoá dạng chuỗi hoặc khoá tính toán.** `async ["execute"](command: C) {}` không có `key.name`,
  nên phép so sánh diễn ra với `undefined`.
- **Có kế thừa là thoát nửa quy tắc.** `if (node.superClass) return` khiến phép kiểm "thiếu
  `process`" chỉ áp cho lớp đứng một mình. Nhưng lớp xử lý đúng chuẩn thì **luôn** kế thừa lớp cơ sở
  khuôn mẫu, nên hình dạng phổ biến nhất lại đúng là hình dạng nửa quy tắc này không bao giờ soi.
- **Decorator gọi qua không gian tên hoặc đổi tên khi nhập.** `@core.CommandHandler(C)` cho `callee`
  kiểu `MemberExpression` nên không ra tên nào; `import { CommandHandler as Handles }` rồi
  `@Handles(C)` cũng vậy. Cổng khớp **cách viết tại chỗ**, không khớp thứ mà nó phân giải ra.
- **Decorator bọc của riêng dự án.** Tập tên decorator là một biểu thức chính quy đóng. Một lớp bọc
  đặt tên khác làm mọi lớp xử lý bên dưới nó biến mất khỏi quy tắc.

---

## `message-carries-params-only`

**Bắt gì.** Cũng hai thông điệp.

- `method` — lớp thông điệp khai báo bất kỳ phương thức nào ngoài hàm dựng. Một thông điệp biết tính
  toán là đã dời một quyết định vào tệp không ai đọc để tìm quyết định, và hai chỗ phát cùng một
  thông điệp sẽ hiểu nó khác nhau.
- `shape` — hàm dựng không nhận **đúng một** tham số tên `params`. Thông điệp là ngữ cảnh yêu cầu —
  yêu cầu, người dùng, ngôn ngữ — trao nguyên khối cho lớp xử lý; thông điệp nhiều trường bắt mỗi
  chỗ phát tự lắp lấy một kiểu.

**Giữ mã nào.** `CQRS-2`.

**Cách phát hiện.** Cổng tên tệp trước tiên: đường dẫn đổi hết dấu gạch chéo ngược thành gạch chéo,
rồi khớp `/\/([a-z0-9-]+)\.(command|query)\.ts$/`. Không khớp thì quy tắc trả về một bộ duyệt rỗng —
nó **không tồn tại** với tệp đó. Khớp rồi mới thăm `ClassDeclaration`, và bỏ qua toàn bộ lớp nếu lớp
mang **bất kỳ** decorator nào. Còn lại: báo mọi `MethodDefinition` có `kind` khác `constructor`; rồi
tìm hàm dựng, gỡ `TSParameterProperty` về tham số bên trong, và đòi `params.length === 1` cùng
`.name === "params"`.

**Vì sao luật này đáng có máy giữ.** Vì một thông điệp là thứ dễ phình nhất trong cả cụm: nó là chỗ
gần nhất với người viết khi họ cần "chỉ thêm một hàm nhỏ thôi". Một hàm nhỏ trong thông điệp không
làm gì hỏng hôm nay; nó chỉ khiến câu trả lời cho "thao tác này làm gì" nằm ở hai tệp thay vì một.
Máy giữ được chỗ này vì hình dạng của một thông điệp đúng là **một hàm dựng, một tham số** — đủ hẹp
để so sánh, không cần phán đoán.

**Cửa còn mở.**

- **Thông điệp không có hàm dựng.** `export class ArchiveOrderCommand { readonly request: R; readonly user: U }`
  đi qua sạch: phép kiểm hình dạng thoát sớm khi không tìm thấy hàm dựng, và các trường là
  `PropertyDefinition` mà quy tắc không hề đọc. Đây đúng là vi phạm mà `CQRS-2` mô tả, viết ở dạng
  quy tắc không nhìn thấy.
- **Logic nằm trong thân hàm dựng.** `constructor(readonly params: P) { this.params = normalise(params) }`.
  Chỉ danh sách tham số bị soi; thân hàm dựng không bao giờ được thăm. Chỗ duy nhất một thông điệp có
  thể tính toán một cách vô hình lại là chỗ duy nhất không có ai nhìn.
- **Logic viết thành trường.** `isValid = () => true` — vẫn là `PropertyDefinition`, cùng một lỗ.
- **Một decorator bất kỳ là tắt cả lớp.** Miễn trừ này được mua để một họ tệp cùng đuôi nhưng khác
  bản chất không báo oan. Cái giá: thông điệp nào mọc thêm một decorator vì lý do gì cũng thành không
  đo được.
- **Tên `params` là quy ước, không phải nội dung.** Một tham số duy nhất tên `params` chứa gì cũng
  qua — một kho dữ liệu, một bộ nhớ đệm, một hàm gọi lại. Quy tắc kiểm **tên**, không kiểm kiểu.
- **Đổi tên tệp là quy tắc biến mất.** `addToCart.command.ts` (có chữ hoa), `add_to_cart.command.ts`
  (có gạch dưới), `commands.ts`, hay một thông điệp khai trong tệp gom — cổng đòi `[a-z0-9-]+` ngay
  trước `.command.ts` hoặc `.query.ts`. Tên tệp là thứ rẻ nhất trong một kho mã để thay đổi.

---

## `handler-has-twin-spec`

**Bắt gì.** Một tệp `<thao-tác>.handler.ts` mà danh sách tên tệp do cấu hình đưa vào không chứa
`<thao-tác>.handler.spec.ts`. Quyết định nằm trong lớp xử lý, nên một lớp xử lý không có kiểm thử là
một quyết định không có kiểm thử — và bản kiểm thử nằm **cùng thư mục** thì người sửa lớp xử lý gặp
nó, thay vì chỉ người đi tìm trong cây kiểm thử mới gặp.

**Giữ mã nào.** `CQRS-7`.

**Cách phát hiện.** Cổng tên tệp: đường dẫn chuẩn hoá, khớp `/\/([a-z0-9-]+)\.handler\.ts$/`, lấy ra
tên thao tác. Rồi đọc `context.options[0].specs`; nếu đó không phải mảng thì quy tắc trả bộ duyệt
rỗng. Là mảng thì hỏi mảng đó có chứa chuỗi `<thao-tác>.handler.spec.ts` không. Không có thì đăng ký
`Program:exit` và báo trên nút `Program`.

**Điểm quan trọng nhất: quy tắc này không hề đụng vào hệ thống tệp.** Một quy tắc đi `stat` đĩa sẽ
trả lời khác nhau tuỳ theo cây làm việc đang có gì, và một quy tắc mà câu trả lời phụ thuộc cây làm
việc thì không ai tái lập lại được lúc rà soát. Nó báo tên tệp *đáng lẽ phải có*; việc đếm là của
cổng bên ngoài.

**Vì sao luật này đáng có máy giữ.** Vì cặp song sinh là thứ dễ quên nhất và khó nhận ra nhất khi thiếu:
không có gì đỏ lên khi một thư mục thao tác thiếu bản kiểm thử, và mỗi lần thiếu lại làm chuẩn "ở
đây luôn có cặp song sinh" yếu đi một chút. Máy nói tên tệp còn thiếu, ngay tại tệp mà người ta đang
mở.

**Cửa còn mở.**

- **Mặc định là tắt.** Quy tắc giữ `CQRS-7` trực tiếp nhất lại đang được phát hành ở mức `off`, và kể cả bật
  lên thì vẫn trơ nếu cấu hình không truyền `specs`. Nó là bộ báo cáo cho một cái cổng nằm ngoài nó.
- **Có tệp không có nghĩa là có kiểm thử.** Một bản kiểm thử rỗng, bị `describe.skip`, hoặc chỉ có
  một khẳng định luôn đúng vẫn làm quy tắc im. Nó kiểm một cái tên trong một danh sách, không đọc nội
  dung. "Có cặp song sinh" và "có được kiểm thử" là hai mệnh đề, và chỉ mệnh đề đầu được giữ.
- **Danh sách là tên trần, không kèm thư mục.** Hai thao tác trùng tên ngắn ở hai thư mục khác nhau:
  một bản kiểm thử làm cả hai cùng qua.
- **Vẫn là cổng tên tệp.** `<thao-tác>.handler.tsx`, `.handler.mts`, hay lớp xử lý khai trong tệp
  gom đều nằm ngoài.
- **Danh sách cũ là câu trả lời sai mà không bị phát hiện.** Ai truyền `specs` thì người đó quyết kết quả. Một
  danh sách dựng một lần rồi nhớ đệm, hoặc dựng từ sai thư mục gốc, làm mọi lớp xử lý qua hết trong
  khi không có gì được kiểm.

---

## Luật

1. Danh tính của một quy tắc là **tên nó công bố**. Không đặt thêm mã số cho quy tắc; tên đó đã là
   chuỗi in ra trong nhật ký dựng, viết trong chú thích tắt quy tắc, và gọi trong mọi cuộc trao đổi.
2. Tài liệu này chỉ ghi những quy tắc **có thật** trong nguồn. Một quy tắc đáng có mà chưa có thì
   thuộc về `audit.md`, không thuộc về đây.
3. Một mã luật không có quy tắc được ghi là **chưa có ai giữ**, không được gán bừa cho quy tắc gần
   nhất.
4. Không quy tắc nào đọc hệ thống tệp.
5. Một quy tắc chỉ lên `error` khi số đo bằng không. Còn nợ thì `warn` kèm số đếm, hoặc `off` nếu nó
   cần cấu hình mới chạy được.
6. Khi đo, **chỉ đếm báo cáo của chính quy tắc đó**. Các chú thích tắt quy tắc trong mã nguồn trỏ tới
   những quy tắc mà một cấu hình đo tối thiểu không hề nạp, và mỗi chú thích như vậy lại bị báo thành
   một vấn đề riêng.

## Ngoại lệ

Mỗi miễn trừ dưới đây là cố ý, được mua bằng một phép đo, và đóng.

- **Không decorator thì không phải lớp xử lý.** Một lớp tên là `...Handler` mà không mang decorator
  có thể là lớp xử lý ổ cắm, một chiến lược, một bộ chuyển đổi. Quy tắc nổ theo **tên** sẽ dành cả
  đời bị tắt bởi những người tắt đúng.
- **Lớp có kế thừa được miễn phép kiểm thiếu `process`.** Báo bất kể lớp cha cho ra **mười** báo cáo
  sai trên **ba** báo cáo đúng, vì một lớp xử lý trừu tượng trung gian — một họ truy vấn gợi ý cùng
  tìm theo một cách, cài `process` một lần rồi được kế thừa — là hình dạng hợp lệ.
- **Lớp có decorator trong tệp thông điệp được miễn.** Một khung nền khác dùng đúng đuôi tệp đó cho
  một lớp có decorator và có phương thức `run` — đó là một **cánh cửa**, không phải một thông điệp,
  và cửa thì mang phương thức. Họ tệp đó chiếm **mười chín** trên **hai mươi mốt** báo cáo trước khi
  có miễn trừ này.
- **Quy tắc cặp song sinh im lặng khi không có danh sách.** Không có tuỳ chọn thì nó không làm gì,
  thay vì đoán — vì đoán ở đây nghĩa là hai máy cho hai kết quả.
