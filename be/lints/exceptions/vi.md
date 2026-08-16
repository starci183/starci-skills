---
id: be-lints-exceptions-vi
title: vi.md
slug: /be/lints/exceptions/vi
sidebar_label: vi.md
sidebar_position: 1
description: Bốn quy tắc giữ luật ngoại lệ — bắt gì, nhìn bằng gì, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `exceptions`

# Bốn quy tắc giữ luật ngoại lệ

Luật nói: **một thất bại là một thứ có tên và có dữ liệu đi kèm, không phải một câu chữ.** Tài liệu
này không nhắc lại luật. Nó ghi lại **phần cưỡng chế**: máy nhìn thấy gì trong một tệp, nhìn bằng cơ
chế nào, và — phần thường không ai viết ra — cách viết nào đi lọt qua máy mà không bị chạm tới.

Tên quy tắc chính là **danh tính** của nó. Không có mã số riêng cho quy tắc, vì tên đó mới là chuỗi
in ra trong log build, trong dòng tắt cảnh báo và trong mọi cuộc trao đổi về lỗi.

Bốn quy tắc chia làm hai cặp. Hai quy tắc canh **chỗ ném**, hai quy tắc canh **chỗ khai báo**. Thiếu
nửa nào cũng thủng: một lớp kế thừa lớp nền của framework vẫn được ném ra bằng cái tên nhà mình, nên
quy tắc canh chỗ ném đọc thấy hoàn toàn bình thường.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `throw-abstract-exception` | `EXCEPTION-1` | `throw new Error(...)`, và `throw new <Ngoại lệ framework>(...)` với 17 tên có trong danh sách |
| `require-exception-object-arg` | `EXCEPTION-2` | `new XException()` không tham số, nhiều hơn một tham số, hoặc tham số đầu không phải object literal |
| `exception-extends-abstract` | `EXCEPTION-3` | Lớp tên kết thúc bằng `Exception` mà lớp cha trực tiếp không phải `AbstractException` |
| `exception-in-errors-folder` | `EXCEPTION-4` | Lớp tên kết thúc bằng `Exception`, có lớp cha, khai báo ngoài thư mục `exceptions/errors/` |

`EXCEPTION-5` và `EXCEPTION-6` **không có quy tắc nào giữ**. `EXCEPTION-6` chỉ xuất hiện trong nguồn
dưới dạng một **miễn trừ** nằm trong `EXCEPTION-1`; miễn trừ khỏi một quy tắc không phải là cưỡng chế
một quy tắc. Cả hai được ghi trong `audit.md`.

---

## `throw-abstract-exception`

**Bắt gì.** Hai thông điệp riêng. `bareError` bắt `throw new Error(...)`: một câu chữ không mang mã
ổn định, nên phía sau không thể gom nhóm, khớp mẫu hay quyết định thử lại mà không đi phân tích tiếng
Anh. `framework` bắt `throw new BadRequestException(...)` và mười sáu tên anh em của nó: chúng mang
một mã trạng thái HTTP và không mang danh tính, nên hai thất bại chẳng liên quan gì tới nhau đi tới
client giống hệt nhau, và thứ duy nhất phân biệt chúng là câu thông báo — đúng cái phần hay bị viết
lại nhất.

**Giữ mã nào.** `EXCEPTION-1`.

**Cách phát hiện.** Thăm nút `ThrowStatement`. Đòi `node.argument.type === "NewExpression"` **và**
`callee.type === "Identifier"`. So `callee.name` với chuỗi `"Error"` trước, rồi với một `Set` mười
bảy tên. Hai cổng chặn theo `context.filename`: làn kiểm thử (`/\.spec\.ts$/`, `/-spec\.ts$/`, hoặc
đường dẫn chứa `/src/tests/`) tắt hẳn quy tắc; làn probe
(`/\/health(?:z)?\.controller\.ts$|\/health\//`) chỉ tắt nhánh framework, còn nhánh `Error` vẫn bắn.

**Vì sao luật này đáng có máy giữ.** Đây là loại lỗi không ai cố tình gây ra và không ai nhìn thấy
trong review. `throw new Error("không tìm thấy khoá học")` đọc lên hoàn toàn hợp lý; cái sai chỉ lộ
ra sáu tháng sau, khi có người cần đếm xem lỗi đó xảy ra bao nhiêu lần và phát hiện cách duy nhất là
so khớp chuỗi. Một cảnh báo ngay lúc gõ rẻ hơn một pipeline log phải hiểu tiếng Anh.

**Cửa còn mở.**

- `const e = new Error(...)` rồi `throw e` — nút tại `ThrowStatement` là một `Identifier`, quy tắc
  thoát ngay dòng đầu.
- `Promise.reject(new Error(...))`, `callback(new Error(...))` — không có `ThrowStatement` nào cả.
- `throw new TypeError(...)` — không phải chuỗi `"Error"`, cũng không có trong `Set`.
- Một ngoại lệ framework ngoài danh sách mười bảy tên: vô hình. Danh sách là chuỗi viết tay, framework
  thì thêm lớp mới theo phiên bản của nó.
- Đổi tên khi import (`import { BadRequestException as BadRequest }`) — quy tắc so **định danh cục
  bộ**, nên một dòng import đã tắt cả danh sách chặn cho tệp đó.
- Tệp tên `*-spec.ts` bất kỳ: cổng làn kiểm thử là hậu tố tên tệp. Một tệp sản xuất đặt tên như vậy
  được miễn toàn bộ.
- Mọi tệp nằm dưới thư mục tên `health`: cổng probe khớp **đoạn thư mục**, không phải controller. Cả
  service, mapper lẫn repository trong đó đều thừa hưởng miễn trừ mà nguồn mô tả là hẹp.

---

## `require-exception-object-arg`

**Bắt gì.** Ba thông điệp. `zero` bắt `new XException()` — phải viết `new XException({})` kể cả khi
không có gì để nói, để mọi lần ném trong toàn bộ mã nguồn có **một** cách viết và người đọc không
phải tra xem ngoại lệ này có nhận tham số hay không. `extra` bắt nhiều hơn một tham số. `notObject`
bắt tham số đầu không phải object literal — một hình dạng theo vị trí thì không lớn lên được: ngày
thất bại đó cần thêm một trường, mọi chỗ ném đều phải sửa, và những chỗ sửa sai vẫn biên dịch trót
lọt.

**Giữ mã nào.** `EXCEPTION-2`.

**Cách phát hiện.** Cũng thăm `ThrowStatement` với cùng yêu cầu `NewExpression` + `Identifier`. Lọc
tên bằng `/Exception$/`, rồi bỏ `AbstractException` và bỏ mọi tên có trong `Set` framework — hình
dạng hàm khởi tạo của framework không phải thứ luật nhà mình được quyền áp đặt; việc có được ném nó
hay không là câu hỏi của `EXCEPTION-1`. Sau đó đọc `arguments.length` cho `zero` và `extra`, và
`arguments[0].type !== "ObjectExpression"` cho `notObject`. **Không có cổng chặn theo tên tệp nào.**

**Vì sao luật này đáng có máy giữ.** Đây là luật thuần hình dạng, và hình dạng thì máy giữ tốt hơn
người. Không ai đọc review mà đếm được rằng hai trăm chỗ ném trong repo có cùng một cách viết; một
quy tắc thì đếm được, ở mọi commit, miễn phí.

**Cửa còn mở.**

- **Cửa mở ngược.** `const meta = { id }` rồi `throw new CourseNotFoundException(meta)` là hình dạng
  **đúng**, nhưng quy tắc vẫn báo lỗi, vì nó kiểm `arguments[0].type` tại chỗ gọi chứ không kiểm giá
  trị. Hằng số làm lẫn literal theo cả hai chiều.
- `new XException({} as SomeMeta)` — nút là `TSAsExpression`, không phải `ObjectExpression`, nên bị
  báo dù nội dung đúng.
- `const e = new XException(); throw e` — lại thoát ở yêu cầu `NewExpression`.
- Một ngoại lệ nhà mình đặt tên `CourseNotFoundError` — không khớp `/Exception$/`, quy tắc không thấy.
- `new errors.XException()` — `callee.type` là `MemberExpression`, thoát.
- Với `new XException(1, 2)` quy tắc báo **hai** lần trên cùng một chỗ ném: `extra` rồi `notObject`,
  vì sau khi báo `extra` nó không `return`.

---

## `exception-extends-abstract`

**Bắt gì.** Thông điệp `base`: một lớp tên kết thúc bằng `Exception` mà lớp cha trực tiếp là một tên
khác `AbstractException`. Đây là quy tắc làm cho `EXCEPTION-1` trở nên có căn cứ. Canh chỗ ném là
không đủ: một lớp kế thừa lớp nền framework vẫn được ném bằng chính tên nó, nên chỗ ném **đọc lên
giống hàng nhà mình** và quy tắc canh chỗ ném không thấy gì bất thường.

**Giữ mã nào.** `EXCEPTION-3`.

**Cách phát hiện.** Thăm `ClassDeclaration`. Đòi có `node.id` và tên khớp `/Exception$/`. Đọc
`node.superClass`; thoát khi không có lớp cha, khi `type` của lớp cha không phải `Identifier`, hoặc
khi tên lớp cha đúng bằng `AbstractException`. Một cổng theo tên tệp:
`/exceptions\/errors\/abstract\.ts$/` miễn cho chính tệp của lớp nền — lớp duy nhất được phép kế thừa
thứ khác.

**Vì sao luật này đáng có máy giữ.** Vì nó bắt đúng thứ mà mắt người bỏ sót. Một lớp như vậy từng
sống trong mã nguồn và được ném từ bốn chỗ gọi trong khi cổng kiểm tra vẫn xanh — không phải vì ai
đó cố tình, mà vì không có chỗ nào trong quy trình review đặt câu hỏi "lớp này kế thừa cái gì".

**Cửa còn mở.**

- `export const X = class XException extends ConflictException {}` — `ClassExpression` là nút khác,
  không được thăm.
- `class XException extends mixin(Base) {}` hoặc `extends ns.Base {}` — lớp cha là `CallExpression`
  hoặc `MemberExpression`, quy tắc im lặng chứ không phải cho qua.
- Đổi hậu tố tên thành `Error` là ra khỏi tầm nhìn của mọi quy tắc khai báo.
- **Đòi kế thừa trực tiếp.** Một lớp nền trung gian hợp lệ — `class HttpishException extends
  AbstractException {}` rồi `class XException extends HttpishException {}` — vẫn bị báo, dù xét bắc
  cầu thì nó đúng luật.
- Đổi tên tệp lớp nền thành `base.ts` là chính lớp nền bị báo lỗi. Cổng miễn trừ neo vào một tên tệp
  duy nhất.

---

## `exception-in-errors-folder`

**Bắt gì.** Thông điệp `place`: một lớp tên kết thúc bằng `Exception`, có lớp cha, khai báo ở ngoài
thư mục ngoại lệ. Gom một chỗ để câu hỏi "ứng dụng này có thể ném ra những gì?" có **một** chỗ tra,
và để người review nhìn thấy một dạng thất bại mới **đi vào** trong diff thay vì phát hiện nó ngoài
môi trường chạy thật.

**Giữ mã nào.** `EXCEPTION-4`.

**Cách phát hiện.** Cổng tệp chạy trước: `/\/exceptions\/errors\//` khớp trên đường dẫn đã chuẩn hoá
dấu gạch thì trả về bộ thăm rỗng. Ngược lại thăm `ClassDeclaration`, đòi `node.id`, đòi `/Exception$/`
và đòi `node.superClass` tồn tại ở bất kỳ hình dạng nào — một lớp không kế thừa gì được coi là một
hình dạng dữ liệu, không phải một ngoại lệ.

**Vì sao luật này đáng có máy giữ.** Vì cái giá của việc bỏ sót không rơi vào người viết. Người khai
báo ngoại lệ ngay cạnh chỗ ném nó thì không mất gì; người mất là người sáu tháng sau phải trả lời
"hệ thống này ném ra những gì" và không có chỗ nào để đọc. Một quy tắc chuyển chi phí đó về đúng lúc
viết.

**Cửa còn mở.**

- **Cổng khớp theo tên thư mục, không theo số lượng.** Bất kỳ cặp thư mục nào đánh vần
  `exceptions/errors/`, ở bất kỳ đâu, đều thoả. Repo có thể mọc hai mươi thư mục như vậy và vẫn xanh
  — thứ được cưỡng chế là "một thư mục viết đúng chữ", không phải "một chỗ để tra".
- Một lớp `XException` không kế thừa gì, khai báo ngoài thư mục: quy tắc thoát theo thiết kế.
- `ClassExpression` không được thăm, y như quy tắc trên.
- `type XException = ...` hoặc `interface XException` — không phải `ClassDeclaration`.
- Thư mục viết `exception/errors/` (thiếu chữ `s`) thì bị báo dù ý định đúng; đó là cùng một khe hở
  nhìn từ chiều ngược lại.

---

## Luật

1. Danh tính của một quy tắc là **tên đã công bố** của nó. Không đặt mã số cho quy tắc; một quy tắc
   hai tên là một quy tắc không thể truy nguyên.
2. Chỉ ghi lại quy tắc **có thật trong nguồn**. Một quy tắc đáng có mà chưa có thì thuộc về
   `audit.md`, không thuộc về bảng ở trên.
3. Mỗi quy tắc giữ đúng một mã luật; không mã nào bị hai quy tắc cùng giữ.
4. Cổng chặn theo tên tệp trả về **bộ thăm rỗng** — tệp bị chặn không phải là tệp kiểm một nửa, mà là
   tệp không được kiểm.
5. Mọi cửa còn mở là khe hở của **quy tắc**, không bao giờ là quyền được viết như vậy của **luật**.
   Mã đi lọt vẫn là mã sai.
6. Nói "cổng xanh" và nói "quy tắc đã nhìn" là hai câu khác nhau; chỉ một trong hai là bằng chứng.

## Ngoại lệ

Ngoại lệ ở đây là những miễn trừ **đã nằm sẵn trong nguồn**, không phải chỗ để lách.

- **Làn kiểm thử.** Họ `.spec.ts`, `-spec.ts` và cây `/src/tests/` được phép `throw new Error` —
  ở đó câu đó nghĩa là "bộ chạy kiểm thử không đi tiếp được", khác hẳn một thất bại mà sản phẩm có
  thể sinh ra. Miễn trừ này từng được cấp trong lời văn nhưng thiếu trong quy tắc, và một repo áp
  dụng đã thừa hưởng 69 phát hiện mà chính luật của nó đã tha. Miễn trừ chỉ áp cho
  `throw-abstract-exception`; `require-exception-object-arg` vẫn bắn trong làn kiểm thử.
- **Probe sống/sẵn sàng.** Nơi **mã trạng thái** là toàn bộ hợp đồng. Chính lý do từ chối ngoại lệ
  framework là thứ cấp phép cho ngoại lệ này: framework bị từ chối vì "mang mã trạng thái mà không
  mang danh tính" — ở probe thì câu đó đảo ngược, vì phía đọc chỉ đọc mã trạng thái và không bao giờ
  đọc thân phản hồi. `Error` **vẫn** bị từ chối ở đây: trạng thái của probe là hợp đồng, còn một cú
  sập không tên thì không.
- **Hàm khởi tạo của framework.** `require-exception-object-arg` bỏ qua mọi tên có trong `Set`
  framework. Hình dạng đó do framework công bố, và sửa nó là đổi thứ được gửi đi.
- **Tệp của lớp nền.** `exceptions/errors/abstract.ts` được miễn `exception-extends-abstract`, vì nó
  là lớp duy nhất được phép kế thừa thứ khác.
- **Thư mục ngoại lệ theo từng ứng dụng.** Cổng thư mục cố tình không neo vào một đường dẫn tuyệt đối.
  Bản trước neo vào một đường dẫn của đúng một repo và báo 83 phát hiện ở một back end khác, mà phần
  lớn là các tệp **đã** nằm trong một thư mục `exceptions/errors/` — chỉ không phải thư mục đó. Một
  quy tắc bắn vào mã đúng còn tệ hơn không có quy tắc, vì người sau học được thói quen cuộn qua nó.
