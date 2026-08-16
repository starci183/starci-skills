---
id: be-lints-authorization-vi
title: vi.md
slug: /be/lints/authorization/vi
sidebar_label: vi.md
sidebar_position: 1
description: Quy tắc lint duy nhất giữ luật authorization - bắt gì, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `authorization`

# Một cái máy giữ một nửa của luật authorization

Luật authorization có sáu mã, `AUTHZ-1` đến `AUTHZ-6`. **Chỉ một mã là hình dạng mà một bộ phân tích
cú pháp nhìn thấy được.** Năm mã còn lại đều xoay quanh **một hàng dữ liệu đã nạp**: ai sở hữu hàng
này, từ chối kiểu nào thì lộ ra hàng này tồn tại, quyền lợi nằm ở ô nào của hàng, và chủ thể đứng sau
cánh cửa là ai. Không bộ phân tích cú pháp nào biết một lớp xử lý đang với tới hàng nào, càng không
biết "sở hữu" hàng đó nghĩa là gì.

`AUTHZ-1` thì khác: nó **đo rồi và cố tình để yên**. Một lớp xử lý tự kiểm tra rằng mình có danh tính
trông giống chép lại việc của cổng, nhưng không phải — cổng thuộc về một cánh cửa, còn lớp xử lý
thuộc về mọi người gọi. Một quy tắc từ chối chuyện đó sẽ nổ vào phần lớn code **đúng** trong cây này,
tức là một cái cổng đi ngược canon chứ không phải giữ canon.

Cái còn kiểm được trong phạm vi một tệp là **cánh cửa**: một phương thức **đọc** danh tính đã xác thực
trong khi không có gì trên phương thức đó hay trên lớp của nó chứng minh danh tính ấy.

Tài liệu này không chép lại luật. Nó nói **máy thấy được đến đâu** và **hết thấy từ chỗ nào**.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `identity-needs-guard` | `AUTHZ-2` | Một phương thức của lớp nhận tham số mang một trong ba decorator danh tính, mà cả phương thức lẫn lớp trực tiếp của nó đều không mang decorator tên `UseGuards` |

Quy tắc duy nhất này có mã luật để giữ. Chiều ngược lại mới là chỗ trống: `AUTHZ-1`, `AUTHZ-3`,
`AUTHZ-4`, `AUTHZ-5` và `AUTHZ-6` **không có quy tắc nào**, và quy tắc ở đây không nhận vơ mã nào cả.

---

## `identity-needs-guard`

**Bắt gì.** Một thông điệp duy nhất, `unguarded`. Một phương thức của lớp có tham số được trang trí
bằng `@KeycloakGraphQLUser()`, `@KeycloakUser()` hoặc `@CurrentUser()` — nghĩa là nó **đọc** một danh
tính đã được xác thực — trong khi không decorator nào tên `UseGuards` nằm trên chính phương thức đó
hoặc trên lớp chứa nó. Báo lỗi ngay tại **tham số**, và thông điệp gọi đúng tên decorator danh tính
mà nó tìm thấy.

**Giữ mã nào.** `AUTHZ-2`.

**Cách phát hiện.** Chỉ một trình thăm: `MethodDefinition`. Không có mã nào khác, và **`context.filename`
không bao giờ được đọc** — quy tắc sống ở mọi tệp mà cấu hình trỏ tới.

Với mỗi phương thức, nó duyệt `node.value.params`. Tham số kiểu `TSParameterProperty` được mở ra lấy
`parameter` bên trong làm vật mang dự phòng; danh sách decorator lấy theo thứ tự `parameter.decorators`,
rồi tới của vật mang, rồi tới mảng rỗng. Tên một decorator đọc được từ một `Identifier` trần, hoặc từ
`CallExpression` có `callee.type === "Identifier"`; **mọi hình dạng biểu thức khác trả về `undefined`**.

Phương thức trở thành ứng viên khi có tên decorator tham số nằm trong tập chữ đóng
`{ KeycloakGraphQLUser, KeycloakUser, CurrentUser }`. Nó được tha nếu có decorator nào **trên phương
thức** tên đúng `UseGuards`; nếu không, quy tắc đi từ `node.parent` (là `ClassBody`) lên `parent` của
nút đó để lấy lớp, và tha tiếp nếu lớp mang `UseGuards`. Còn lại thì báo.

Hai tính chất của cơ chế này quyết định mọi thứ ở dưới. **Danh tính chỉ được nhận ra dưới dạng
decorator tham số, qua đúng ba chuỗi ký tự.** Và **cổng chỉ được nhận ra qua một decorator viết đúng
chữ `UseGuards`, tính bằng sự có mặt — không bao giờ tính bằng thứ nó áp vào.**

**Vì sao luật này đáng có máy giữ.** Vì đây đúng là loại sai lầm **con người không nhìn ra**. Thiếu
cổng thì code vẫn biên dịch, vẫn chạy, và tuyệt nhiên không có gì đỏ lên. Tham số vẫn tên `user`, lớp
xử lý vẫn nhận được một `user`, mọi bài kiểm tra viết bằng một yêu cầu đã đăng nhập vẫn xanh. Thứ duy
nhất vắng mặt là **dòng chứng minh danh tính ấy thuộc về người gọi** — và cái vắng mặt thì không hiện
lên trong bản khác biệt, không hiện lên trong lần đọc lại, không hiện lên ở đâu cả.

Thêm một lý do nữa: đây là sai lầm **rẻ để tạo ra**. Sao chép một cánh cửa cũ rồi sửa nội dung là thao
tác thường ngày, và decorator cổng là dòng dễ rơi rụng nhất trong lúc sao chép, vì nó là dòng duy nhất
không nói gì về nghiệp vụ. Sai ở chỗ vô hình lúc viết, đắt về sau: đó là định nghĩa của việc cần một
cái máy.

**Cửa còn mở.**

- **Đọc danh tính qua ngữ cảnh thay vì qua decorator.** `@Context() ctx` rồi `ctx.req.user`, hoặc
  `@Req() req` rồi `req.user`. Đây là **lỗ lớn nhất**: toàn bộ khái niệm "đọc danh tính" của quy tắc
  là ba decorator tham số, còn thân phương thức thì không có gì nhìn tới. Cánh cửa đó đọc đúng cái
  danh tính chưa ai chứng minh, và máy im lặng hoàn toàn.
- **Một nhịp trung gian.** Cửa nhận `@Context() ctx`, một phương thức riêng tư trong cùng lớp móc
  `user` ra từ đó. Quy tắc không đi theo lời gọi bao giờ, nên cả cửa lẫn phương thức phụ đều im.
- **Decorator có không gian tên.** `@auth.CurrentUser()` sau `import * as auth`. Callee là
  `MemberExpression`, tên đọc ra là `undefined`, không nằm trong tập — phương thức thậm chí không
  thành ứng viên.
- **Đổi tên lúc nhập khẩu.** `import { CurrentUser as Who }` rồi `@Who()`. Tập chữ được so với cách
  viết **tại chỗ dùng**, không bao giờ so với thứ mà lệnh nhập khẩu phân giải ra.
- **Một decorator danh tính thứ tư.** Tập là chữ đóng gồm ba chuỗi. Thêm một decorator danh tính mới
  — kể cả một lớp bọc do chính cây này viết ra — là mọi cánh cửa dùng nó trở nên vô hình, và không có
  gì báo cho ai biết chuyện đó.
- **`@UseGuards()` rỗng, hoặc cổng không xác thực.** Đã đo: `@UseGuards()` không tham số **làm im**
  quy tắc. `@UseGuards(RolesGuard)` hay một cổng luôn trả về đúng cũng vậy. "Có cổng" và "danh tính
  đã được chứng minh" là hai dữ kiện khác nhau, và quy tắc chỉ giữ được dữ kiện thứ nhất.
- **Một hàm nội bộ tên `UseGuards`.** Phép kiểm là **cách viết**. Một hàm rỗng mang tên đó làm sạch
  mọi cánh cửa trong tệp.
- **Cổng ở cấp lớp là tấm chăn vĩnh viễn.** Lớp đã mang `UseGuards` thì mọi phương thức thêm vào sau
  đó — kể cả một năm sau, kể cả phục vụ một **chủ thể khác** — được tha mà không ai quyết lại. Đây
  cũng là chỗ `AUTHZ-6` hỏng trong im lặng.
- **Cửa không phải phương thức của lớp.** Một tuyến đường đăng ký bằng mã, một lớp xử lý ráp bằng nhà
  máy, một bảng ánh xạ. Trình thăm duy nhất là `MethodDefinition`; thứ gì không phải nó thì nằm hẳn
  ngoài thế giới của quy tắc.

**Nhầm lẫn theo chiều ngược lại** — những chỗ quy tắc **nổ vào code đúng**, đã đo bằng bộ phân tích cú
pháp đang dùng. `@nest.UseGuards(G)` bị báo, vì tên đọc ra là `undefined`. Một decorator gộp kiểu
`@Authenticated()` — bên trong là `applyDecorators(UseGuards(...))` — bị báo. Cổng chỉ đặt trên **lớp
cơ sở** còn cửa khai ở lớp con bị báo. Và một lớp phục vụ có phạm vi theo yêu cầu, nhận `@CurrentUser()`
ở hàm dựng mà không phải một cánh cửa, cũng bị báo. Mỗi lần như vậy là một lần ai đó viết
`eslint-disable`, và dòng `eslint-disable` mới là thứ che mất trường hợp thật tiếp theo.

## Luật

Luật nằm ở [`patterns/authorization.md`](../../canon/patterns/authorization.md). Rút gọn phần liên
quan tới tài liệu này:

- `AUTHZ-1` — Một lớp xử lý sở hữu điều kiện tiên quyết của chính nó, và danh tính là một trong số đó.
  **Cố tình không có máy giữ.**
- `AUTHZ-2` — Một cánh cửa **đọc** danh tính thì mang cái cổng chứng minh danh tính ấy. **Có máy giữ:**
  `identity-needs-guard`.
- `AUTHZ-3` — Quyền sở hữu quyết định dựa trên hàng đã nạp, không bao giờ dựa trên yêu cầu. Không máy.
- `AUTHZ-4` — Một lời từ chối làm lộ ra sự tồn tại của hàng riêng tư thì phải trả lời là không tìm
  thấy. Không máy.
- `AUTHZ-5` — Quyền lợi là một **trạng thái**; có hàng không phải là có trạng thái. Không máy.
- `AUTHZ-6` — Người vận hành là một chủ thể khác với người dùng. Không máy.

## Ngoại lệ

Mỗi miễn trừ dưới đây là cố ý và đã đóng.

- **Cửa không đọc danh tính thì không bị báo.** Một truy vấn công khai không có gì để chứng minh, và
  coi nó là lỗi là cách nhanh nhất để cả quy tắc bị tắt.
- **Cổng trên lớp tha cho mọi phương thức của lớp.** Từ chối chuyện này sẽ đẩy người viết tới việc lặp
  decorator ở từng phương thức, không phải cách cây này đang làm. Cái giá là tấm chăn đã ghi ở trên.
- **Không có cổng theo tên tệp.** Cố ý: quy tắc rộng đúng bằng cấu hình nạp nó, kể cả những tệp không
  ai nghĩ là cửa.
- **`AUTHZ-1` không có quy tắc.** Đã đo và cố tình để yên.
- **`AUTHZ-3`, `AUTHZ-4`, `AUTHZ-5` không có quy tắc.** Cả ba quyết định dựa trên một hàng đã nạp.
- **`AUTHZ-6` không có quy tắc.** Chủ thể là dữ kiện nghiệp vụ, không phải hình dạng cú pháp.
