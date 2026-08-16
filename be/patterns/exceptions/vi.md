---
id: be-patterns-exceptions-vi
title: vi.md
slug: /be/patterns/exceptions/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống EXCEPTION-N, nhận diện bằng người đọc ở đầu bên kia chứ không bằng cảm giác viết code.
---

# vi.md

> Version: `2.00` · Module: `exceptions`

# Exceptions

Mọi thất bại mà back end này sinh ra đều là **một class**, khai báo trong **một thư mục**, và được
throw kèm **một object metadata**. Ba câu đó nói về cùng một ý:

> Một thất bại là **một thứ có tên, mang theo dữ liệu** — không phải một câu văn.

`new Error("không tìm thấy bản ghi")` mang theo một câu tiếng Anh. Không ai group được theo nó, khớp
được theo nó, quyết định được nó có retry được không, dịch được nó, hay lấy lại được cái id — trừ khi
đi parse câu văn đó. Exception của framework khá hơn một chút thôi: nó mang một HTTP status và không
mang gì khác, tức là lấy một mối quan tâm về **transport** đứng thay cho một mối quan tâm về
**nghiệp vụ**.

Câu hỏi quyết định:

> Có ai ở phía dưới — một caller, một pipeline log, một client — muốn xử lý thất bại này **khác** với
> thất bại khai báo ngay cạnh nó không?

Nếu có, nó cần class riêng. Và câu trả lời gần như luôn là có.

**Đây là luật bắt buộc.** Mọi `throw` trong product code đều rơi vào một mã dưới đây, và mọi khai báo
`*Exception` cũng vậy. Không có thất bại nào "nội bộ" tới mức được miễn: câu "cái này có ai bắt đâu"
chính là chỗ luật này bị bỏ qua nhiều nhất — và đó cũng là dòng sẽ hiện lên trong alert lúc 3 giờ
sáng mà không có tên.

Còn **tên nào**, code nào, type metadata tên gì — đó là việc của module `exception-identity` bên
cạnh. Module này chỉ quyết: có class hay không, class extends đúng base hay không, nằm đúng chỗ hay
không, và throw có mang dữ liệu hay không.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `EXCEPTION-1` | Viết một `throw` trong product code | Throw một subclass của `AbstractException` |
| `EXCEPTION-2` | Truyền dữ liệu vào chỗ throw | Đúng **một** object metadata, `{}` khi không có gì để nói |
| `EXCEPTION-3` | Khai báo một class lỗi mới | `extends AbstractException`, không phải base của framework |
| `EXCEPTION-4` | Chọn chỗ đặt file khai báo | Trong thư mục exceptions, cùng chỗ với tất cả các lỗi khác |
| `EXCEPTION-5` | Quyết định metadata mang gì | Id, trạng thái, giới hạn — không phải một câu đã render |
| `EXCEPTION-6` | Một spec cần dừng vì setup hỏng | `throw new Error` — đó là runner bỏ cuộc, không phải lỗi nghiệp vụ |

---

## `EXCEPTION-1` — throw một class có tên, không phải một câu

**Tình huống.** Bạn đang ở giữa một handler, một service, một guard, và một điều kiện vừa sai. Câu
lệnh tiếp theo bạn viết quyết định **mọi người phía sau** còn làm được gì với thất bại này.

Có ba lựa chọn và chỉ một lựa chọn đúng. `throw new Error("...")` mang một câu và không mang code, nên
không có gì group, khớp hay retry được nếu không parse tiếng Anh. Exception của framework mang một
status và không mang danh tính: hai thất bại chẳng liên quan gì nhau tới client trông y hệt nhau, và
thứ duy nhất phân biệt chúng là message — đúng cái phần sẽ bị sửa lại chữ ở lần refactor sau.

**Dấu hiệu nhận biết**

- Trong `throw` có một chuỗi tiếng Anh mô tả chuyện gì vừa xảy ra.
- Client phải đọc `message` mới biết đã trúng nhánh nào.
- Alert group theo status code, nên một alert 400 gom chung sáu thất bại khác nhau.
- Có người vừa hỏi "lỗi này retry được không" và không ai trả lời được nếu không mở source ra đọc.

**Tự hỏi.** Nếu thất bại này và thất bại ngay bên dưới cùng tới client, có thứ gì phân biệt được
chúng mà **không cần đọc tiếng Anh** không?

**Ranh giới**

- ↔ `EXCEPTION-3`: đây là cùng một cái bẫy nhìn từ hai đầu. `EXCEPTION-1` nhìn chỗ **throw**;
  `EXCEPTION-3` nhìn chỗ **khai báo**. Một class extends base framework sẽ qua được `EXCEPTION-1`, vì
  ở chỗ throw nó mang đúng tên nhà.
- ↔ `EXCEPTION-6`: cùng một dòng `throw new Error`, khác nhau ở **file nó nằm**. Trong product code là
  vi phạm; trong spec là lối ra được cấp phép.
- ↔ `EXCEPTION-2`: `EXCEPTION-1` hỏi **cái gì** được throw; `EXCEPTION-2` hỏi nó mang theo **gì**.
  Throw đúng class mà truyền sai hình dạng vẫn là vi phạm, chỉ là vi phạm mã khác.

**Tình huống nghiệp vụ hay gặp.** Không tìm thấy bản ghi theo id · số dư không đủ · vượt hạn mức
gọi API · token hết hạn · trạng thái không cho phép chuyển tiếp · một dependency ngoài trả về lỗi ·
một biến môi trường bắt buộc không được set · upload sai định dạng.

---

## `EXCEPTION-2` — đúng một object, kể cả khi rỗng

**Tình huống.** Bạn đã có class đúng. Giờ là câu hỏi truyền gì vào constructor — và đây là chỗ hai
thói quen khác nhau lẻn vào cùng một codebase.

Object rỗng **không phải là thủ tục thừa**. Nó giữ cho mọi `throw` trong cả cây code có **một cách
viết duy nhất**, để người đọc không bao giờ phải dừng lại kiểm tra xem cái exception này có nhận tham
số hay không. Còn tham số vị trí bị từ chối vì lý do khác hẳn: hình dạng đó **không lớn lên được**.
Ngày mà thất bại này cần thêm trường thứ hai, mọi chỗ throw đều phải sửa — và những chỗ sửa sai vẫn
compile qua.

**Dấu hiệu nhận biết**

- Trong cùng một file có cả `new XException()` và `new YException({...})`.
- Constructor nhận `(id: string, status: string)` thay vì một object.
- Một chỗ throw truyền hai tham số vì "thêm cho đủ thông tin".
- Ai đó vừa phải grep cả repo để sửa thứ tự tham số sau khi thêm một trường.

**Tự hỏi.** Nếu ngày mai thất bại này cần thêm **một trường nữa**, tôi phải sửa bao nhiêu chỗ, và có
chỗ nào sửa sai mà vẫn compile không?

**Ranh giới**

- ↔ `EXCEPTION-1`: xem trên.
- ↔ `EXCEPTION-5`: `EXCEPTION-2` nói về **hình dạng** của tham số — phải là một object. `EXCEPTION-5`
  nói về **nội dung** của object đó. `new XException({})` thoả `EXCEPTION-2` tuyệt đối, và có thể vẫn
  đang trốn `EXCEPTION-5` nếu thất bại đó thật ra có id để kể.
- ↔ Exception của framework: luật này **không** áp lên constructor của framework. Hình dạng đó không
  phải của mình để mà quy định; còn chuyện có được throw nó hay không là câu hỏi của `EXCEPTION-1`.

**Tình huống nghiệp vụ hay gặp.** Lỗi cấu hình không có id nào để kể (`{}`) · lỗi tra cứu mang đúng
một id · lỗi hạn mức mang giá trị hiện tại và ngưỡng · lỗi chuyển trạng thái mang trạng thái nguồn và
đích · lỗi bọc một exception của thư viện ngoài, mang `originalError`.

---

## `EXCEPTION-3` — class extends base của nhà, không phải của framework

**Tình huống.** Bạn đang khai báo một class lỗi mới, và trong tầm mắt có một base rất tiện: base của
framework, sẵn status, sẵn serialize, sẵn mọi thứ. Đây là chỗ cái bẫy nguy hiểm nhất của cả module
này nằm.

Class đó được throw **bằng chính tên của nó**. Nên ở mọi chỗ throw, dòng code đọc lên đúng như một
exception của nhà, và rule canh chỗ throw **không thấy gì sai cả**. Đó không phải giả thuyết: đúng một
class như vậy đã sống trong cây code, được throw từ bốn call site, trong khi gate vẫn xanh.

**Dấu hiệu nhận biết**

- Chỗ throw trông hoàn toàn bình thường, nhưng client nhận về một status "sạch" mà không có code.
- Class nằm đúng thư mục errors, đặt tên đúng hậu tố, chỉ có dòng `extends` là khác.
- Bắt `AbstractException` ở filter mà thất bại này không bao giờ rơi vào đó.

**Tự hỏi.** Tôi có đang đọc **chỗ throw** để kết luận về một class không? Nếu có, tôi chưa đọc bằng
chứng — bằng chứng nằm ở dòng `extends` trong file khai báo.

**Ranh giới**

- ↔ `EXCEPTION-1`: xem trên. Hai mã này là một luật đọc từ hai đầu, và bỏ một đầu là để lại đúng cái
  lỗ mà đầu kia bịt.
- ↔ `EXCEPTION-4`: `EXCEPTION-3` hỏi class **extends gì**; `EXCEPTION-4` hỏi nó **nằm đâu**. Một class
  có thể nằm đúng chỗ và vẫn extends sai base — đó chính là ca đã xảy ra thật.
- ↔ File của base: class mà mọi class khác extends thì không thể tự extends chính nó. Ngoại lệ đó cấp
  theo **tên file**, không cấp theo thư mục, để nó không lan sang hàng xóm.

**Tình huống nghiệp vụ hay gặp.** Port một lỗi cũ từ code legacy sang · lỗi ở guard cần giữ đúng 401
nên có người tiện tay extends base của framework · lỗi ở tầng upload cần 413 · một class được sinh ra
trong lúc migration và không ai review lại dòng `extends`.

---

## `EXCEPTION-4` — mọi lỗi khai báo trong một thư mục

**Tình huống.** File khai báo lỗi mới sắp được tạo, và chỗ tiện nhất là ngay cạnh service throw nó.
Đây là quyết định trông vô hại nhất trong cả module.

Một thư mục giữ tất cả, để câu hỏi "ứng dụng này có thể throw ra những gì?" có **một** chỗ để nhìn, và
để một reviewer **thấy một failure mode mới đi vào** trong diff. Một exception khai báo cạnh code
throw nó thì vô hình cho tới khi có thứ gì đó throw nó trên production.

**Dấu hiệu nhận biết**

- Một `class ...Exception` nằm cuối một file service, dưới cùng, sau khi đã đọc hết logic.
- Có hai lỗi gần trùng nhau ở hai module, vì người viết cái thứ hai không biết cái thứ nhất tồn tại.
- Không ai trả lời được "danh sách lỗi của ứng dụng" mà không grep.

**Tự hỏi.** Một người mới vào, muốn biết ứng dụng này có thể thất bại theo những cách nào, sẽ mở cái
gì ra đọc?

**Ranh giới**

- ↔ `EXCEPTION-3`: xem trên.
- ↔ Nhiều ứng dụng trong một repository: luật đòi **một chỗ cho mỗi ứng dụng**, không đòi một đường
  dẫn cố định. Một repository chứa nhiều app thì mỗi app có thư mục exceptions của mình và vẫn thoả,
  vì câu hỏi "ứng dụng này có thể throw gì" vẫn có đúng một câu trả lời.

**Tình huống nghiệp vụ hay gặp.** Lỗi nội bộ của một adapter · lỗi của một job nền · lỗi của một
migration chạy một lần · lỗi khai báo tạm "để refactor sau" · lỗi được sinh ra trong một file test
helper rồi bị import ngược vào product code.

---

## `EXCEPTION-5` — metadata mang thứ người đọc sẽ cần

**Tình huống.** Class đúng, hình dạng đúng, chỗ đặt đúng. Còn lại một câu hỏi mà không rule nào trả
lời hộ được: **object đó chứa gì.**

Message dành cho **một con người đang đọc log**. Metadata dành cho **mọi thứ còn lại**: client quyết
định hiển thị gì, retry policy quyết định có thử lại không, alert group theo code và cần biết đây là
tenant nào. Nên metadata phải mang id, mang trạng thái đã làm cho thao tác thành bất khả, mang cái
ngưỡng vừa bị vượt — không mang một câu đã render sẵn.

**Dấu hiệu nhận biết**

- Metadata có đúng một trường và trường đó tên là `message`, `detail`, `reason` hoặc `description`.
- Message đã ghép sẵn id vào bằng template string, còn metadata thì rỗng.
- Có người đang viết regex trên message trong dashboard log.
- Client hiển thị được lỗi nhưng không link được tới bản ghi gây lỗi.

**Tự hỏi.** Người **tiếp theo** đọc thất bại này là ai, và họ cần biết gì để hành động? Nếu câu trả
lời có chữ "id" trong đó, id phải nằm trong metadata chứ không nằm trong câu.

**Ranh giới**

- ↔ `EXCEPTION-2`: xem trên. Hình dạng và nội dung là hai câu hỏi khác nhau, và mã này là câu hỏi
  không đo được bằng máy.
- ↔ `exception-identity`: `code` là danh tính, thuộc module bên cạnh. `EXCEPTION-5` chỉ nói về payload
  đi kèm danh tính đó.

**Lưu ý về người đọc thật.** Ở trạng thái hiện tại, filter HTTP gửi ra `statusCode`, `code` và
`message` — **không** gửi metadata. Nghĩa là người đọc metadata hôm nay là dòng log và caller
in-process, chưa phải HTTP client. Điều đó không làm luật yếu đi, nhưng nó thay đổi câu "ai sẽ cần
trường này": trước khi thêm một trường vì "client cần", hãy kiểm xem client có nhận được nó không.

**Tình huống nghiệp vụ hay gặp.** Id của bản ghi không tìm thấy · trạng thái nguồn và trạng thái đích
của một chuyển tiếp bị từ chối · số dư hiện tại và số tiền yêu cầu · hạn mức và giá trị đã dùng · tên
biến môi trường bị thiếu · `originalError` khi bọc lỗi của thư viện ngoài.

---

## `EXCEPTION-6` — assertion của test runner không phải lỗi nghiệp vụ

**Tình huống.** Một spec đang chạy và fixture không seed được. Test không thể đi tiếp. Bạn viết
`throw new Error("fixture did not seed")` — và đó là **đúng**.

Ở đó, câu lệnh nghĩa là "runner bỏ cuộc", chứ không đặt tên cho một thất bại mà sản phẩm có thể sinh
ra. Một lane test bị cấm tự làm hỏng setup của chính nó sẽ phải bịa ra một domain exception cho việc
"thiếu fixture" — tức là đưa một thất bại **của bài test** vào đúng bộ từ vựng mà sản phẩm dùng để mô
tả những thất bại thật. Lúc đó danh sách lỗi của ứng dụng có thêm một dòng mà người dùng không bao giờ
chạm tới được.

Lối ra này được cấp phép **ở nơi nó áp dụng, và không ở đâu khác**.

**Dấu hiệu nhận biết**

- Dòng `throw new Error` nằm trong file spec hoặc trong cây test, và mô tả một điều kiện của môi
  trường test chứ không của nghiệp vụ.
- Ngược lại: một domain exception được khai báo mà chỉ có spec throw nó.
- Một helper của test bị import vào product code, mang theo lối ra này.

**Tự hỏi.** Có người dùng nào **có thể chạm tới** dòng này không? Nếu không ai chạm tới được, đó là
runner bỏ cuộc. Nếu có, đó là một thất bại cần tên.

**Ranh giới**

- ↔ `EXCEPTION-1`: cùng một dòng code, khác nhau ở file. Ranh giới là **đường dẫn**, và nó được viết
  hai lần: một lần trong rule, một lần trong config của repository dùng rule.
- ↔ `EXCEPTION-4`: một exception chỉ để phục vụ test vẫn sẽ nằm trong thư mục errors nếu ai đó tạo ra
  nó — và nó sẽ trông y hệt một lỗi thật. Đó chính là thứ mã này ngăn.

**Tình huống nghiệp vụ hay gặp.** Fixture không seed · điều kiện chờ quá deadline · một stub bị gọi
với tham số ngoài kịch bản · script mock hết bước · dependency của môi trường test không sẵn sàng.

---

## Luật

1. Mọi thất bại trong product code là một subclass của `AbstractException`.
2. Chỗ throw truyền đúng **một** object metadata; `{}` khi không có gì để nói.
3. Class **tự nó** extends base của nhà — đọc dòng `extends`, đừng đọc chỗ throw.
4. Mọi exception khai báo trong thư mục exceptions, một chỗ cho mỗi ứng dụng.
5. Message cho người; metadata cho mọi thứ còn lại.
6. `throw new Error` chỉ sống trong lane test, và nghĩa của nó ở đó là "runner bỏ cuộc".

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Lane test.** `EXCEPTION-6` cấp phép `throw new Error` cho spec và cây test. Product code import
  một helper từ những lane đó **không** thừa hưởng quyền này.
- **Health probe.** `EXCEPTION-1` cho phép exception của framework trong controller liveness hoặc
  readiness, vì chính lý do của luật đảo chiều ở đó: framework exception bị từ chối vì "mang status mà
  không mang danh tính", còn probe là endpoint duy nhất mà orchestrator chỉ đọc status và không đọc gì
  khác. `throw new Error` vẫn bị từ chối kể cả ở đó — status của probe là hợp đồng, còn một cú crash
  không tên thì không.
- **File của base.** `EXCEPTION-3` không thể áp lên chính class mà mọi class khác extends. Ngoại lệ
  cấp theo **tên file**, không theo thư mục.
- **Hình dạng của framework.** `EXCEPTION-2` không quy định constructor của class framework. Viết lại
  nó cho hợp quy ước nhà sẽ đổi luôn thứ framework gửi đi.
- **Payload rỗng.** `EXCEPTION-2` vẫn đòi object kể cả khi thất bại không có gì để kể — vì đó là chỗ
  trường đầu tiên sẽ rơi vào.
- **Nhiều ứng dụng một repository.** `EXCEPTION-4` đòi một chỗ cho mỗi **ứng dụng**, không đòi một
  đường dẫn cố định.
