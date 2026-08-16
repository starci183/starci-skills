---
id: be-lints-cqrs-audit
title: audit.md
slug: /be/lints/cqrs/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức bao phủ thật của ba quy tắc CQRS và liệt kê mọi cửa còn mở.
---

# audit.md

> Version: `2.00` · Mô-đun: `cqrs`

Phản biện này hỏi đúng một câu: **luật CQRS được máy giữ tới đâu, và từ đâu trở đi chỉ còn con
người?**

## Verdict

Chấp nhận, kèm một điều kiện đọc.

Nguồn công bố **đúng ba** quy tắc — `handler-overrides-process`, `message-carries-params-only`,
`handler-has-twin-spec` — khớp với con số ba mà nhiệm vụ dự đoán. Cả ba đều ánh xạ được vào một mã
luật có thật, không quy tắc nào phải bịa ánh xạ, và không quy tắc nào ở đây thiếu bản cài đặt.

Điều kiện đọc: **mô-đun này không được đọc như "luật CQRS đã có máy giữ".** Bốn trên bảy mã không có
quy tắc nào, và trong ba mã còn lại, một mã được giữ bởi một quy tắc ship ở mức `off`. Số mã thật sự
được chặn ở cổng dựng là **hai**.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Ba quy tắc trong `rules` có đủ `meta` và `create` | Có; bản kiểm thử song sinh khẳng định đúng điều này cho từng tên công bố |
| Mỗi quy tắc ánh xạ được vào một mã `CQRS-<n>` | Được: `CQRS-3`, `CQRS-2`, `CQRS-7` — chú thích phân đoạn trong nguồn ghi rõ từng mã |
| Có quy tắc nào không ánh xạ được vào mã nào | Không |
| Có mã nào không có quy tắc | Có bốn: `CQRS-1`, `CQRS-4`, `CQRS-5`, `CQRS-6` |
| Tên quy tắc có bị viết lại trong tài liệu | Không; ba tên được chép nguyên văn làm tiêu đề mục |
| Có quy tắc nào đọc hệ thống tệp | Không; `handler-has-twin-spec` cố ý so với danh sách do cấu hình truyền vào |
| Mức nghiêm khắc có khớp số đo | Có: hai quy tắc ở `error` sau khi nợ về không (3/141 và 2/138 đã trả), một quy tắc ở `off` vì cần cấu hình |
| Miễn trừ có kèm bằng chứng | Có cả ba: 10 sai/3 đúng cho miễn trừ lớp cha, 19/21 cho miễn trừ decorator trong tệp thông điệp, và lý do tái lập được cho miễn trừ thiếu danh sách |
| Ranh giới "lớp xử lý" có bị đặt theo tên lớp | Không; đặt theo decorator — đúng, vì một lớp tên `...Handler` có thể là bộ chuyển đổi hay chiến lược |

## Findings

1. **Ba quy tắc, ba mã, không có ánh xạ bịa.** Đây là trường hợp hiếm và đáng ghi: mỗi quy tắc gắn
   với đúng một mã, và chú thích phân đoạn trong nguồn nói ra mã đó trước cả phần cài đặt.

2. **Bốn mã không có ai giữ, và nguồn nói thẳng điều đó.** `CQRS-1` (một thao tác một thư mục),
   `CQRS-4` (lớp điều phối chỉ điều phối), `CQRS-5` (lớp xử lý ném ngoại lệ miền), `CQRS-6` (sự kiện
   là cho việc phải xảy ra dù sao) là phán đoán. Ghi lại làm nhận định, không phải làm khuyết điểm:
   một quy tắc đoán mò mấy thứ đó sẽ bị tắt, và một quy tắc bị tắt giữ được ít hơn một quy tắc không
   tồn tại — vì nó còn tạo ra ảo giác đã được che.

   Trong bốn mã đó, `CQRS-1` là mã **gần nhất với khả năng đo được**: "mọi tệp trong thư mục thao
   tác phải mang tên thao tác" là một phép so chuỗi trên đường dẫn, không phải một phán đoán. Nó
   chưa có quy tắc, và đó là chỗ đáng cân nhắc nhất nếu mô-đun này lớn thêm.

3. **`handler-has-twin-spec` làm ít hơn tên nó gợi ra.** Tên nói "lớp xử lý có cặp song sinh"; hành
   vi thật là "tên thao tác của tệp này có mặt trong một danh sách chuỗi do cấu hình truyền vào".
   Nó không đọc đĩa, không biết bản kiểm thử nằm ở thư mục nào, không đọc nội dung bản kiểm thử, và
   mặc định là `off`. Quyết định không đọc đĩa là **đúng** — một quy tắc mà câu trả lời phụ thuộc cây
   làm việc thì không tái lập được — nhưng cái tên vẫn hứa nhiều hơn cái máy.

4. **`handler-overrides-process` giữ hai mệnh đề rất lệch nhau về sức mạnh.** Nhánh
   `overridesExecute` gần như kín: nó bắt phương thức ở mọi mức truy cập, mọi loại truy xuất, có hay
   không có lớp cha. Nhánh `noProcess` thì gần như không chạy: nó tự tắt khi lớp có `superClass`, mà
   lớp xử lý đúng chuẩn thì **luôn** kế thừa lớp cơ sở khuôn mẫu. Nói cách khác, nửa sau của quy tắc
   chỉ soi được hình dạng hiếm.

5. **Miễn trừ decorator trong `message-carries-params-only` là miễn trừ rộng nhất trong mô-đun.**
   Nó được mua bằng một phép đo thật (19 trên 21 báo cáo đến từ một họ tệp cùng đuôi nhưng khác bản
   chất), nên là quyết định đúng ở thời điểm đo. Nhưng nó tắt **cả lớp**, chứ không chỉ tắt phép kiểm
   phương thức — nên một thông điệp mọc thêm một decorator vì lý do hoàn toàn khác cũng biến mất khỏi
   phép đo hình dạng.

6. **Hai quy tắc phụ thuộc tên tệp, một quy tắc không.** `handler-overrides-process` không có cổng
   tên tệp và mạnh hơn hẳn nhờ đó. Hai quy tắc còn lại tắt hẳn khi tên tệp đổi. Đây là mẫu chung, và
   nó nói một điều nên nhớ: **cổng tên tệp mua tốc độ và độ hẹp bằng chính sự tồn tại của quy tắc.**

7. **Một chỗ quy tắc nổ quá tay.** `static execute() {}` trong lớp xử lý sẽ bị báo `overridesExecute`
   dù phương thức tĩnh không hề ghi đè phương thức thực thể. Chưa gặp trong thực tế, chi phí thấp,
   nhưng là một báo cáo sai về mặt ngữ nghĩa.

## Decisions

- Ghi **đúng ba** quy tắc có thật, lấy **tên công bố** làm danh tính và làm tiêu đề mục. Không đặt
  thêm mã số cho quy tắc: tên đó đã là chuỗi in ra trong nhật ký dựng và viết trong chú thích tắt
  quy tắc; một danh tính thứ hai nghĩa là một quy tắc hai tên và không cách nào biết thông báo đến từ
  tên nào.
- Ghi bốn mã không có quy tắc là **chưa có ai giữ**, ở đây, thay vì gán chúng cho quy tắc gần nhất.
- Giữ bảng **Cửa còn mở** là phần bắt buộc của `INDEX.md`, không phải phụ lục. Một cửa chưa ai biết
  nguy hiểm hơn một luật chưa có quy tắc: luật chưa có quy tắc thì ai cũng biết là chưa được giữ.
- Giữ nguyên `off` cho `handler-has-twin-spec` trong tài liệu. Ghi mức ship thật, không ghi mức mong
  muốn.
- Không đề xuất sửa nguồn trong mô-đun này. Đây là hồ sơ **thi hành**, và một đề xuất quy tắc mới
  thuộc về `Rủi ro còn mở` cho tới khi có bản cài đặt chỉ tay vào được.

## Rủi ro còn mở

Mỗi mục nói rõ **quy tắc phải soi thêm cái gì** mới đóng được, hoặc vì sao đóng đắt hơn để mở.

### `handler-overrides-process`

- **`execute` viết thành trường của lớp.** Đóng được, và rẻ: thêm `PropertyDefinition` vào phép quét
  thành viên, so cùng tên khoá. Rủi ro sai thấp, vì một lớp xử lý có trường tên `execute` gần như
  chắc chắn đang che phương thức của lớp cơ sở. **Nên đóng.**
- **Khoá dạng chuỗi hoặc khoá tính toán.** Đóng được với khoá chuỗi (`key.type === "Literal"` thì so
  `key.value`). Khoá tính toán thật sự thì không đóng được nếu không suy luận giá trị, và một lớp xử
  lý dùng khoá tính toán cho `execute` là chuyện hầu như không xảy ra. **Đóng nửa dễ, nửa còn lại bỏ
  qua có ý thức.**
- **Có lớp cha là thoát phép kiểm thiếu `process`.** Đóng được **chỉ khi** quy tắc đọc được lớp cha,
  nghĩa là đi ra khỏi một tệp — phân giải `import`, mở tệp lớp cơ sở, xem lớp đó có `process` không.
  Đó là phân tích liên tệp, đắt hơn hẳn mọi thứ trong mô-đun này, và chính phép đo đã cho thấy cách
  làm rẻ (báo bất kể lớp cha) cho 10 sai trên 3 đúng. **Giữ mở có ý thức.** Cái giá phải nói ra: hình
  dạng lớp xử lý phổ biến nhất không được nửa quy tắc này soi.
- **Decorator đổi tên khi nhập, gọi qua không gian tên, hoặc bọc lại.** Đóng một phần được: nhận
  thêm `MemberExpression` callee và so phần thuộc tính cuối. Đóng hẳn thì cần lần theo `import` để
  biết định danh tại chỗ phân giải ra cái gì — lại là phân tích liên tệp. **Đóng phần
  `MemberExpression`; phần đổi tên khi nhập giữ mở.**

### `message-carries-params-only`

- **Thông điệp không có hàm dựng.** Đóng được, và đây là cửa đáng đóng nhất trong mô-đun: khi không
  tìm thấy hàm dựng, quy tắc đang thoát êm thay vì kết luận. Chỉ cần soi `PropertyDefinition`: không
  có hàm dựng mà có từ hai trường trở lên, hoặc có một trường không tên `params`, là đúng hình dạng
  mà luật cấm. **Nên đóng.**
- **Logic nằm trong thân hàm dựng.** Đóng được ở mức thô: một thân hàm dựng có bất kỳ câu lệnh nào
  ngoài phép gán thẳng tham số vào trường là đáng báo. Có rủi ro sai với các lớp gán từng trường một
  cách vô hại, nên cần đo trước. **Nên đo rồi đóng.**
- **Logic viết thành trường (`isValid = () => …`).** Cùng một sửa đổi với mục đầu: đọc
  `PropertyDefinition`, và một trường có giá trị là hàm thì báo như `method`. **Nên đóng.**
- **Một decorator bất kỳ là tắt cả lớp.** Đóng được bằng cách thu hẹp miễn trừ: chỉ bỏ qua khi
  decorator thuộc tập tên đã biết của họ tệp kia, thay vì bỏ qua mọi decorator. Cần đo lại trên
  nguồn thật trước khi thu, vì phép đo cũ chỉ nói "họ đó chiếm 19/21", không nói tập tên của họ đó
  ổn định. **Nên đo rồi thu hẹp.**
- **`params` là tên, không phải nội dung.** Không đóng được bằng lint mà không đọc kiểu qua thông
  tin kiểu — nghĩa là bật lint có nhận biết kiểu, đắt hơn nhiều lần cho một phép kiểm mà lợi ích
  không rõ. **Giữ mở; đây là chỗ con người đọc.**
- **Cổng tên tệp.** Không đóng được mà không bỏ cổng, mà bỏ cổng thì quy tắc nổ vào mọi lớp trong
  kho mã. Cách rẻ hơn nằm ở chỗ khác: một quy tắc giữ `CQRS-1` (mọi tệp trong thư mục thao tác mang
  tên thao tác) sẽ làm việc đổi tên tệp trở thành lỗi của **chính nó**, và như vậy cửa này đóng gián
  tiếp. **Giữ mở tại đây; ghi lại như lý do để cân nhắc một quy tắc cho `CQRS-1`.**

### `handler-has-twin-spec`

- **Mặc định `off` và trơ khi không có `specs`.** Không phải lỗi của quy tắc; đây là ranh giới thiết
  kế. Nhưng hệ quả phải nói ra: **`CQRS-7` hiện không được chặn ở cổng dựng trừ khi kho mã tự nối
  danh sách thư mục vào.** Đóng nghĩa là chấp nhận đọc đĩa, và đọc đĩa làm câu trả lời phụ thuộc cây
  làm việc. **Giữ mở có ý thức; chỗ đóng đúng là cái cổng bên ngoài, không phải quy tắc.**
- **Danh sách so như tên trần, không kèm thư mục.** Đóng được mà không cần đọc đĩa: đổi hợp đồng
  tuỳ chọn sang đường dẫn tương đối thay vì tên tệp, rồi so đường dẫn thư mục của tệp đang lint. Cần
  đổi cả bên cấp danh sách. **Nên đóng khi có dịp đổi hợp đồng.**
- **Bản kiểm thử rỗng hoặc bị bỏ qua vẫn làm quy tắc im.** Không đóng được ở quy tắc này, vì nó
  không đọc nội dung tệp khác. Chỗ đóng đúng là một quy tắc khác chạy **trên chính tệp kiểm thử** —
  cấm `describe.skip` không kèm lý do, đòi ít nhất một khẳng định. **Giữ mở tại đây; đó là việc của
  mô-đun kiểm thử.**
- **Danh sách cũ hoặc dựng từ sai thư mục gốc.** Không đóng được bên trong quy tắc: ai truyền danh
  sách thì người đó quyết kết quả. **Giữ mở; phải được cổng bên ngoài tự chứng minh.**

### Ngoài phạm vi ba quy tắc

- **`CQRS-1`, `CQRS-4`, `CQRS-5`, `CQRS-6` không có quy tắc nào.** Ba mã sau là phán đoán và nên ở
  lại với con người. `CQRS-1` thì không: nó là phép so chuỗi trên đường dẫn, đo được, và việc chưa có
  quy tắc cho nó cũng chính là thứ giữ hai cửa "đổi tên tệp" ở trên luôn mở. **Đây là đề xuất, không
  phải quy tắc** — nó không được ghi vào `INDEX.md`, đúng theo luật cao nhất: một quy tắc không chỉ
  tay vào được là một đề xuất.
- **Một báo cáo sai về mặt ngữ nghĩa:** `static execute()` bị báo như một lần ghi đè. Đóng được bằng
  cách bỏ qua thành viên `static`. Chi phí gần bằng không, lợi ích cũng gần bằng không cho tới khi
  gặp trường hợp đầu tiên. **Ghi lại, chưa cần làm.**

## Re-audit Triggers

- Nguồn công bố thêm hoặc bớt một quy tắc, hoặc đổi tên một quy tắc đang có.
- Một mức nghiêm khắc đổi — nhất là khi `handler-has-twin-spec` được bật lên trong một kho mã thật.
- Có ai đó viết một quy tắc cho `CQRS-1`, `CQRS-4`, `CQRS-5` hoặc `CQRS-6`.
- Bất kỳ cửa nào trong mục trên được đóng, hoặc một cửa mới được tìm ra trong mã nguồn thật.
- Một miễn trừ được thu hẹp hoặc mở rộng, hoặc phép đo đứng sau nó được chạy lại và cho số khác.
- Một quy tắc bắt đầu đọc hệ thống tệp, thông tin kiểu, hoặc bất cứ thứ gì ngoài tệp đang lint —
  điều đó đổi hẳn tính tái lập của cả mô-đun.
- Có báo cáo sai lặp lại từ người dùng thật, kể cả khi phép đo cũ nói tỉ lệ sai chấp nhận được.
