---
id: be-lints-authorization-audit
title: audit.md
slug: /be/lints/authorization/audit
sidebar_label: audit.md
sidebar_position: 3
description: Đánh giá độ phủ thực của quy tắc authorization và ghi lại mọi kẽ hở còn tồn tại.
---

# audit.md

> Version: `2.00` · Mô-đun: `authorization`

Bản đánh giá này kiểm tra xem tài liệu có mô tả đúng **những gì máy thật sự thấy**, và chỉ những gì đó. Mọi khẳng định
về hành vi ở đây đều được đo bằng cách chạy quy tắc qua trình kiểm với bộ phân tích cú pháp mà gói
đang dùng, không suy từ việc đọc code.

## Verdict

Chấp nhận, kèm hai ghi nhận nghiêm trọng.

Mô-đun nguồn công bố **đúng một quy tắc**, `identity-needs-guard`, và tài liệu này ghi đúng một quy
tắc. Con số khớp với dự kiến. Quy tắc giữ đúng mã nó nhận — `AUTHZ-2` — và không nhận vơ mã nào khác;
năm mã còn lại được ghi là **không có máy giữ**, chứ không được gán bừa cho quy tắc gần nhất.

Hai ghi nhận nghiêm trọng: quy tắc **so khớp theo cách viết** ở cả hai đầu (danh tính và cổng), nên nó vừa bỏ
lọt code sai vừa báo nhầm vào code đúng; và nó **đếm sự có mặt của cổng chứ không đo tác dụng của cổng**,
nên "im lặng" của nó là một lời khẳng định yếu hơn nhiều so với cách đọc tự nhiên của tên quy tắc.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Cửa đọc danh tính, không cổng | Báo — đo được |
| Cổng trên phương thức, viết có ngoặc hoặc không ngoặc | Im cả hai — đo được |
| Cổng trên lớp trực tiếp | Im — đo được |
| Cổng trên một phương thức **khác** của cùng lớp | Báo — phân định đúng, theo từng phương thức |
| Bộ chặn thay cho cổng | Báo — phân định đúng |
| Đổi tên tham số, đổi vị trí tham số, phá cấu trúc tham số | Báo cả ba — không lệ thuộc tên |
| Tham số thuộc tính ở hàm dựng (`TSParameterProperty`) | Báo — đo được |
| `static`, `private`, `async` trên phương thức | Không ảnh hưởng |
| Đổi tên tệp, đổi thư mục | Không ảnh hưởng — **không có cổng theo tên tệp** |
| Cửa không đọc danh tính | Im — phân định đúng |
| Hai tham số danh tính trên một phương thức | Một báo lỗi, tại tham số đầu tìm thấy |
| `@UseGuards()` không tham số | **Im** — phân định hỏng |
| Danh tính đọc qua `@Context()` / `@Req()` | **Im** — phân định hỏng |
| Cổng hoặc danh tính viết dạng `a.B()` | Cổng: **báo nhầm**. Danh tính: **im** |

## Findings

1. **Số quy tắc khớp.** `sources/be/authorization.mjs` xuất `rules` gồm một khoá,
   `"identity-needs-guard"`, và `recommended` bật đúng khoá đó ở mức `error`. Không có quy tắc thứ hai
   ẩn trong tệp.
2. **Tên quy tắc rộng hơn hành vi của nó.** Đọc "identity-needs-guard" ra là "đọc danh tính thì phải
   có cổng". Hành vi thật là "một **tham số mang một trong ba decorator** thì phải có **một decorator
   viết đúng chữ `UseGuards`**". Khoảng cách giữa hai câu đó chính là toàn bộ mặt hở của mô-đun này.
   Đây không phải lý do đổi tên — tên là định danh in ra trong nhật ký dựng — nhưng là lý do tài liệu
   phải nói thẳng, và `INDEX.md` nói thẳng.
3. **Nhánh dự phòng cho `TSParameterProperty` là code chết.** Biểu thức
   `parameter.decorators || (carrier && carrier.decorators) || []` xuất hiện hai lần. Với bộ phân tích
   cú pháp đang dùng, **mọi** nút tham số đều có sẵn khoá `decorators` là một mảng — rỗng khi không
   trang trí — và **một mảng rỗng là giá trị đúng** trong JavaScript. Nhánh sau dấu `||` do đó không
   bao giờ chạy. Hiện tại vô hại, vì bộ phân tích đặt decorator ở nút **ngoài** (`TSParameterProperty`)
   nên nhánh đầu đã đủ. Nhưng nếu một phiên bản sau chuyển decorator vào nút trong, quy tắc sẽ **im
   lặng trên mọi tham số thuộc tính**, và đúng đoạn code viết ra để cứu tình huống đó sẽ không chạy.
   Bộ kiểm thử hiện tại **không có ca nào** cho tham số thuộc tính, nên không có gì ghim hành vi này.
4. **Quy tắc báo nhầm vào code đúng ở bốn hình dạng, đã đo.** `@nest.UseGuards(G)`; một decorator gộp kiểu
   `@Authenticated()` dựng bằng `applyDecorators`; cổng chỉ đặt ở **lớp cơ sở** trong khi cửa khai ở
   lớp con; và một lớp có phạm vi theo yêu cầu nhận danh tính ở hàm dựng mà không phải cửa. Ba trong
   bốn hình dạng này là những bước một cây code **trưởng thành** thường đi, nghĩa là tỉ lệ báo nhầm sẽ
   **tăng theo thời gian**, không giảm.
5. **Báo nhầm là lỗ hổng, không phải phiền toái.** Mỗi lần báo nhầm sinh ra một dòng
   `eslint-disable-next-line`, và dòng đó không hết hạn. Nó nằm lại đúng chỗ cánh cửa, rồi tiếp tục che lấp
   luôn trường hợp thật tiếp theo tại chỗ đó. Đây là con đường thực tế mà một quy tắc bị vô hiệu.
6. **Quy tắc không có tuỳ chọn nào.** `schema: []`. Tập ba decorator danh tính và chuỗi `UseGuards`
   đều là chữ cứng trong nguồn. Một kho không thể khai báo decorator danh tính của riêng mình mà không
   sửa canon — đúng theo thiết kế của cây trust, nhưng có nghĩa là mọi lần mở rộng đều là một thay đổi
   phiên bản của mô-đun này.
7. **Không có phép kiểm nào chạm tới hệ thống tệp, lệnh nhập khẩu hay thông tin kiểu.** Câu trả lời
   của quy tắc tái lập được hoàn toàn từ một tệp. Đây là điểm mạnh, và cũng là trần của độ phủ.

## Decisions

- **Giữ đúng một quy tắc trong tài liệu.** Một quy tắc đáng lẽ nên tồn tại mà chưa tồn tại thì không
  được ghi vào bảng `Rules`; nó nằm ở **Rủi ro còn mở**. Một quy tắc không chỉ tay vào được là một đề
  xuất, không phải một quy tắc.
- **Không đúc mã số cho quy tắc.** Định danh của quy tắc là **tên công bố** của nó — chuỗi mà nhật ký
  dựng in ra, mà dòng `eslint-disable` gọi, mà tệp cấu hình đặt mức độ. Một định danh thứ hai nghĩa là
  một quy tắc hai tên và không cách nào biết thông điệp đến từ tên nào.
- **Ghi `AUTHZ-1` là *cố tình không giữ*, không phải *chưa giữ*.** Hai chuyện đó khác nhau: một cái
  chờ ai đó viết quy tắc, một cái cấm viết. Ghi nhầm thành "chưa giữ" là mời người đọc sau "làm nốt"
  bằng một quy tắc báo nhầm trên phần lớn code đúng.
- **Giữ mức `error`.** Số đo hiện tại bằng không, và hình dạng bị bắt thì hẹp.
- **Ghi cả bốn hình dạng báo nhầm vào tài liệu người đọc, không giấu trong audit.** Người gặp chúng là
  người viết code, không phải người rà canon.
- **Không đổi tên quy tắc.** Tên đã in ra trong nhật ký dựng; đổi tên là một quy tắc hai tên.

## Rủi ro còn mở

Mỗi mục nói **quy tắc phải soi thêm cái gì** thì mới đóng được, hoặc vì sao đóng đắt hơn để mở.

- **Danh tính đọc qua ngữ cảnh** — `@Context() ctx` rồi `ctx.req.user`, `@Req() req` rồi `req.user`.
  Để đóng, quy tắc phải soi **thân phương thức**, chứ không chỉ danh sách tham số: tìm truy cập thành
  viên `.user` trên đúng định danh của tham số ngữ cảnh, và theo được cả bí danh lẫn phá cấu trúc.
  Bản hẹp làm được ngay bằng phân tích phạm vi cục bộ: *tham số mang `@Context()` hoặc `@Req()` mà
  thân phương thức có truy cập `.user` bắt nguồn từ nó*. Bản rộng — theo lời gọi sang phương thức phụ
  — cần thông tin kiểu và nên coi là mô-đun khác. **Nên đóng, và đây là món đáng làm nhất về mặt an
  toàn.**
- **Decorator có không gian tên và decorator đổi tên lúc nhập khẩu** — `@auth.CurrentUser()`, `@Who()`,
  và ở chiều nổ nhầm là `@nest.UseGuards()`. Để đóng, `decoratorName` phải phân giải định danh cục bộ
  **ngược về lệnh nhập khẩu**: lấy phạm vi qua `context.sourceCode`, tìm biến, đọc `ImportSpecifier`
  và so với `imported.name`; với `MemberExpression` thì so `object` với một `ImportNamespaceSpecifier`.
  Không cần thông tin kiểu. **Đây là món rẻ nhất trên mỗi đơn vị lợi ích**, vì nó đóng đồng thời một
  cửa mở và một nguồn báo nhầm.
- **Decorator danh tính thứ tư** — bất cứ tên nào ngoài ba chuỗi cứng. Để đóng, cần một `schema` với
  tuỳ chọn danh sách decorator danh tính, hoặc nhận diện theo đường dẫn nhập khẩu thay vì theo tên.
  Rẻ, nhưng đổi hình dạng cấu hình của cả gói nên là một thay đổi phiên bản có chủ đích.
- **`@UseGuards()` rỗng, và cổng không xác thực** — cổng vai trò, cổng giới hạn tần suất, cổng luôn
  đúng. Bản rẻ: đòi decorator có **ít nhất một tham số**; đóng được ca rỗng, không đóng được ca cổng
  sai. Bản đủ: một danh sách các cổng **được coi là xác thực**, khai báo qua tuỳ chọn hoặc nhận diện
  theo đường dẫn nhập khẩu. Chi phí thật nằm ở chỗ danh sách đó phải được nuôi; một danh sách cũ làm
  mọi cánh cửa xanh trong khi không ai kiểm gì.
- **Một hàm `UseGuards` nội bộ rỗng** — đóng cùng lúc với việc phân giải lệnh nhập khẩu ở trên.
- **Tấm chăn ở cấp lớp** — một `UseGuards` trên lớp tha cho mọi phương thức thêm vào sau, kể cả phương
  thức phục vụ một chủ thể khác. Để đóng, quy tắc phải biết **chủ thể** của từng cửa, và chủ thể là dữ
  kiện nghiệp vụ chứ không phải hình dạng cú pháp. **Đóng đắt hơn để mở**: `AUTHZ-6` ở lại với mắt
  người, và tài liệu nói rõ chỗ đó.
- **Cửa không phải phương thức của lớp** — tuyến đường đăng ký bằng mã, lớp xử lý ráp bằng nhà máy.
  Hình dạng không có biên, nên không có trình thăm nào phủ được. Không đóng.
- **Nổ nhầm ở cổng của lớp cơ sở** — để đóng, quy tắc phải đi theo `superClass` tới khai báo lớp cơ sở;
  làm được **trong cùng một tệp**, không làm được khi lớp cơ sở ở tệp khác, và một phép kiểm chỉ đúng
  khi hai lớp cùng tệp là phép kiểm không tái lập được. Cách rẻ và trung thực hơn: khi phương thức nằm
  trong lớp **có kế thừa** mà không thấy cổng, hạ thông điệp xuống dạng nghi vấn thay vì khẳng định.
  Cần một phép đo trước khi đổi.
- **Nổ nhầm ở decorator gộp** — đóng cùng lúc với phân giải lệnh nhập khẩu chỉ khi quy tắc chịu đi vào
  **thân của hàm gộp**, tức là phải phân giải một hàm chứ không phải một tên. Nếu không làm, cách sống
  chung là: cây code cam kết không gộp cổng, và cam kết đó phải nằm trong canon chứ không nằm trong
  trí nhớ.
- **Nổ nhầm ở lớp không phải cửa** — để đóng, thêm cổng "lớp phải mang `@Resolver()` hoặc
  `@Controller()`". Rẻ, nhưng **thu hẹp độ phủ**: mọi cửa mang decorator lớp khác sẽ rơi ra ngoài. Đây
  là một đánh đổi cần đo, không phải một lỗi hiển nhiên.
- **Nhánh dự phòng chết ở `TSParameterProperty`** — để đóng, thay `||` bằng phép kiểm độ dài
  (`parameter.decorators?.length ? … : carrier?.decorators ?? []`) và thêm ca kiểm thử cho tham số
  thuộc tính. Rất rẻ, và hiện chưa có gì ghim hành vi này.
- **`AUTHZ-3`, `AUTHZ-4`, `AUTHZ-5`** — quyền sở hữu, hình dạng lời từ chối, trạng thái quyền lợi. Cả
  ba cần **hàng dữ liệu đã nạp** mới trả lời được; không bộ phân tích cú pháp nào có nó. Đóng bằng
  hình dạng cú pháp nghĩa là nổ theo hình dạng, và một quy tắc nổ theo hình dạng là quy tắc người ta
  học cách tắt. **Cố tình để mở**, và đây là những mã đắt nhất khi hỏng.

## Re-audit Triggers

- Có một decorator danh tính thứ tư xuất hiện trong cây, dù chỉ ở một tệp.
- Cây code bắt đầu gộp cổng bằng một decorator tổng hợp, hoặc chuyển cổng lên một lớp cơ sở dùng chung.
- Một cổng được đăng ký ở cấp ứng dụng, làm tiền đề "cổng phải nằm trên cửa" không còn đúng.
- Đổi phiên bản bộ phân tích cú pháp, hoặc đổi cờ decorator — đo lại ngay ca tham số thuộc tính.
- Xuất hiện `eslint-disable` gọi tên quy tắc này ở bất kỳ đâu: đó là một phép đo về báo nhầm, không
  phải một lần ngoại lệ.
- Quy tắc được thêm `schema` tuỳ chọn, hoặc tập ba decorator đổi.
- Một cánh cửa được dựng ngoài dạng phương thức của lớp.
- Có ai đề xuất quy tắc cho `AUTHZ-3`, `AUTHZ-4` hoặc `AUTHZ-5`: đề xuất đó phải mang theo phép đo số
  lần báo nhầm trên code đúng, trước khi bàn tiếp.
