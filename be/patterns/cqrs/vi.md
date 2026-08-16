---
id: be-patterns-cqrs-vi
title: vi.md
slug: /be/patterns/cqrs/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống CQRS-N, nhận diện bằng nghiệp vụ chứ không bằng thói quen gõ code.
---

# vi.md

> Version: `2.00` · Module: `cqrs`

# CQRS

Mọi thao tác backend phơi ra đều là **một message có handler**. Mutation dispatch một
command, query thì dispatch một query, còn việc phụ phải sống lâu hơn request thì là một event.

Resolver không làm việc. Service cũng không làm việc. Cả hai chỉ **chuyển request tới handler**, còn handler là
chỗ công việc thật sự nằm.

Câu hỏi duy nhất để phân định một đoạn code thuộc về đâu là:

> Việc này có thể bị gọi từ **nhiều hơn một cửa** không?

Nếu có — và gần như luôn có, vì CLI và bộ test đã là hai cửa — thì đó là một message có handler,
không phải một method trên service.

**Đây là luật bắt buộc.** Không có thao tác nào nhỏ đến mức được miễn khai báo mã. Một lệnh đọc một
dòng vẫn là `CQRS-1` đúng cùng lý do mà một lệnh tất toán thanh toán là `CQRS-1`. Câu "có mỗi cái
getter thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `CQRS-1` | Một thao tác đứng thành một thư mục, mọi file mang tên thao tác đó | Thư mục là toàn bộ thao tác |
| `CQRS-2` | Message chỉ bê request context, không tính toán gì | Một field `params` duy nhất |
| `CQRS-3` | Handler cắm vào template method của base | `process`, không bao giờ `execute` |
| `CQRS-4` | Service cạnh handler chỉ dispatch | Một dòng, không nghiệp vụ |
| `CQRS-5` | Handler không làm được việc thì nói rõ vì sao | Ném domain exception |
| `CQRS-6` | Việc **kiểu gì cũng phải xảy ra**, người gọi không chờ | Event |
| `CQRS-7` | Quyết định nằm ở handler thì test cũng nằm cạnh handler | `<thao-tác>.handler.spec.ts` |

---

## `CQRS-1` — một thao tác, một thư mục, và thư mục là toàn bộ thao tác

**Tình huống.** Bạn đang thêm một thao tác mới, hoặc đang tìm chỗ đặt một file vừa nảy ra trong lúc
làm. Thư mục của thao tác chứa message, handler, service, cửa, wiring và spec — và mọi file trong đó
đều mang tên thao tác.

**Dấu hiệu nhận biết**

- Biết tên thao tác là đoán ra được **mọi** tên file trong thư mục.
- Grep một tên thao tác ra nguyên cả thao tác, không phải một lát cắt của nó.
- Trong thư mục xuất hiện một file mang cái tên chung chung (`utils`, `helpers`, `mapper`) — dấu hiệu
  có thứ dùng lại được vừa bị sinh ra ở chỗ không ai đi tìm.

**Tự hỏi.** File này có mang tên thao tác không? Nếu không: nó là thứ dùng chung, và nó phải nằm ở
nơi người khác tìm ra được.

**Ranh giới**

- ↔ `CQRS-4`: `CQRS-1` nói file nào **được phép** nằm trong thư mục; `CQRS-4` nói file service ấy
  **được phép chứa gì**. Một service đúng chỗ vẫn có thể sai nội dung.
- ↔ `CQRS-7`: `CQRS-1` nói cái gì được nằm trong thư mục, `CQRS-7` nói cái gì **bắt buộc** phải nằm.
  Một thư mục có thể sạch theo `CQRS-1` mà vẫn thiếu spec.

**Tình huống nghiệp vụ hay gặp.** Thêm một mutation mới · tách một mutation quá tải làm hai · một hàm
tính giá bị viết ngay trong thư mục thao tác rồi thao tác thứ hai chép lại nó · một enum dùng chung
bị nhét vào thư mục của thao tác đầu tiên cần tới nó.

---

## `CQRS-2` — message chỉ bê request context

**Tình huống.** Command hoặc query mang đúng một field `params`, và field đó chở request, người dùng
đã xác thực, và locale. Không method, không default, không logic.

**Dấu hiệu nhận biết**

- Constructor của message có đúng một tham số, tên `params`.
- Không có getter nào tính ra một giá trị mới từ request.
- Không có giá trị mặc định nào được điền ở đây.

**Tự hỏi.** Nếu hai chỗ khác nhau cùng dispatch message này, chúng có thể hiểu message theo hai nghĩa
khác nhau không? Nếu message tự tính thứ gì đó thì câu trả lời là có.

**Ranh giới**

- ↔ `CQRS-4`: cả hai đều là "chỗ không được chứa nghiệp vụ", nhưng lý do khác nhau. Nghiệp vụ trong
  service thì **không cửa nào khác gọi tới được**; nghiệp vụ trong message thì **không ai đọc tới**,
  vì message là chỗ người ta liếc qua chứ không phải chỗ người ta đi tìm quyết định.
- ↔ `CQRS-6`: event cũng là message, nhưng nó chở payload của việc phải làm, không chở request
  context của một người gọi đang chờ.

**Tình huống nghiệp vụ hay gặp.** Message tự chuẩn hoá email · message tự điền `page = 1` · message
tự tính `totalAmount` từ danh sách item · message tách một chuỗi id thành mảng · message có
`isAdmin()` đọc từ user.

---

## `CQRS-3` — handler cắm vào `process`, không bao giờ `execute`

**Tình huống.** Base handler là một **template method**: `execute` là cửa công khai và nó gọi
`process` mà handler tự cài. Cái seam đó tồn tại để một mối quan tâm cắt ngang — đo thời gian, ghi
log, mở transaction, retry — được thêm **một lần** ở base thay vì một trăm lần ở từng handler.

**Dấu hiệu nhận biết**

- Handler khai báo `protected override async process(...)`.
- Nếu handler khai báo `execute`, nó đã **tự bước ra khỏi template**: vẫn compile, vẫn chạy, và là
  đúng cái file mà thay đổi cắt ngang lần sau sẽ bỏ sót trong im lặng.

**Tự hỏi.** Nếu tuần sau ai đó thêm transaction vào base, file này có nhận được không?

**Ranh giới**

- ↔ `CQRS-4`: service **cũng** có method tên `execute`, và đó là đúng — service không kế thừa
  template nào cả. `execute` sai chỗ là `execute` trên **handler**.
- ↔ ngoại lệ handler trừu tượng trung gian: một handler kế thừa một handler trừu tượng khác có thể
  **thừa hưởng** `process`. Nó không khai báo gì cả và vẫn đúng.

**Tình huống nghiệp vụ hay gặp.** Copy một handler cũ viết từ trước khi có base · một họ query gợi ý
dùng chung một cách tìm · thêm log thời gian chạy cho toàn bộ handler và phát hiện ba file không hề
xuất hiện trong log.

---

## `CQRS-4` — service chỉ dispatch, và chỉ có thế

**Tình huống.** Service nằm cạnh handler tồn tại để **cửa không phải import bus**. Nó dài một dòng,
và nó dài một dòng có chủ đích.

**Dấu hiệu nhận biết**

- Thân method là một lời gọi `commandBus.execute(new …Command(params))`.
- Service không import repository, không import entity manager, không import service nghiệp vụ nào.
- Nếu thấy một câu `if` mang tính nghiệp vụ ở đây: luật đó vừa rơi vào chỗ **không có message**, nên
  CLI cũng làm cùng việc ấy sẽ không với tới được và sẽ mọc ra bản sao của riêng nó.

**Tự hỏi.** Nếu ngày mai một job chạy nền cần đúng thao tác này, nó có gọi được không? Nếu phải dựng
cả cửa lên mới gọi được, luật đang nằm sai chỗ.

**Ranh giới**

- ↔ `CQRS-2`: xem trên.
- ↔ `CQRS-5`: một service tự ném exception nghiệp vụ vẫn sai — không phải vì ném là sai, mà vì
  **quyết định** ném nằm ngoài handler. Đúng chỗ thì cùng exception ấy được ném từ `process`.

**Tình huống nghiệp vụ hay gặp.** Kiểm tra đã sở hữu khoá học trước khi thêm vào giỏ · kiểm tra quyền
ngay trong service · map DTO ngay trong service · service gọi hai bus liên tiếp để "ghép" hai thao
tác.

---

## `CQRS-5` — handler sở hữu thất bại, và thất bại là một domain exception

**Tình huống.** Handler không làm được việc thì **ném đúng cái exception nói vì sao**. Nó không trả
`null`, và nó không trả một shape thành công có chứa chuỗi lỗi.

**Dấu hiệu nhận biết**

- Mỗi nhánh từ chối có một tên riêng, và cái tên ấy chở theo dữ liệu người gọi sẽ cần.
- Không có `return null` nào mang nghĩa "không được".
- Không có `{ ok: false, error }` nào — mỗi người gọi sẽ tự giải mã nó một kiểu.

**Tự hỏi.** Người gọi có đủ thông tin để phân biệt "không tồn tại", "đã bị xoá" và "không có quyền
đọc" không? Nếu cả ba về tới nơi dưới dạng cùng một `null` thì lý do đã chết trên đường về.

**Ranh giới**

- ↔ `CQRS-4`: xem trên. Cùng một exception, khác chỗ ném, khác kết luận.
- ↔ `CQRS-6`: một việc phụ thất bại **không** biến thao tác chính thành thất bại. Mail không gửi được
  là chuyện của handler event; nó không được nhấn chìm câu trả lời người gọi đang chờ.

**Tình huống nghiệp vụ hay gặp.** Trả `null` khi không tìm thấy bản ghi · nuốt lỗi rồi trả mảng rỗng ·
trả `{ success: false, message }` cho tầng trên tự đoán · ném `Error` trần thay vì exception có danh
tính.

---

## `CQRS-6` — event là cho việc **kiểu gì cũng phải xảy ra**

**Tình huống.** Dispatch event khi việc phải xảy ra **dù người gọi còn đó hay không** — một email,
một projection, một lần đồng bộ. Còn thứ mà câu trả lời của người gọi phụ thuộc vào thì ở lại trong
command.

**Dấu hiệu nhận biết**

- Không ai `await` kết quả của event để trả lời request.
- Event không trả về giá trị, và không ai cần nó trả về giá trị.
- Nếu resolver sau khi publish event lại đi **hỏi lại** database xem dòng đã có chưa: đó là một
  command bị viết thành event.

**Tự hỏi.** Người gọi có cần biết việc này xong chưa mới trả lời được không? Nếu có, đó là command.

**Ranh giới**

- ↔ `CQRS-2`: cả hai đều là message. Khác nhau ở **ai chờ**: command có người chờ kết quả, event thì
  không.
- ↔ `CQRS-5`: xem trên.

**Tình huống nghiệp vụ hay gặp.** Gửi mail xác nhận · cập nhật projection đọc · đồng bộ sang kho dữ
liệu thứ hai · phát thông báo · ghi audit log · thêm người dùng vào một nhóm bên ngoài.

---

## `CQRS-7` — handler có spec song sinh nằm cạnh

**Tình huống.** `<thao-tác>.handler.spec.ts`, cùng thư mục. Handler là chỗ các quyết định nằm, nên
đó cũng là chỗ unit test nằm.

**Dấu hiệu nhận biết**

- Mở thư mục thao tác là thấy ngay spec.
- Người sửa handler nhìn thấy spec **mà không cần đi tìm**; spec nằm trong một cây test riêng thì chỉ
  người đi tìm test mới thấy.

**Tự hỏi.** Người sửa file này ngày mai có bị spec đập vào mắt không, hay phải nhớ ra là có nó?

**Ranh giới**

- ↔ `CQRS-1`: xem trên. `CQRS-1` là "được phép nằm", `CQRS-7` là "bắt buộc phải nằm".

**Tình huống nghiệp vụ hay gặp.** Handler mới chưa có spec · spec bị chuyển sang cây test tập trung
cho "gọn" · spec đặt tên khác tên thao tác nên grep không ra · một nhánh từ chối mới được thêm vào
handler mà spec không đổi.

---

## Luật

1. Công việc nằm trong handler. Cửa và service chỉ bê request đi.
2. Một thao tác, một thư mục; mọi file trong thư mục mang tên thao tác.
3. Message chở request context và không tính toán gì.
4. Handler cài `process`; `execute` là của base.
5. Thất bại là một domain exception được ném ra, không phải một giá trị trả về đã mã hoá.
6. Event chỉ dành cho việc mà người gọi không chờ.
7. Handler nào cũng có spec song sinh cùng thư mục.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều khép kín và nêu rõ mã nó áp
vào.

- **Handler trừu tượng trung gian** (`CQRS-3`). Một họ thao tác làm cùng một việc với tham số khác
  nhau được phép cài `process` một lần ở một handler trừu tượng rồi cho kế thừa. Lớp con không khai
  báo gì cả là **đúng**, vì nó thừa hưởng công việc. Luật chỉ soi lớp đứng một mình.
- **`.command.ts` có decorator là một cửa, không phải message** (`CQRS-2`). Một framework CLI dùng
  đúng hậu tố ấy cho một class có `run`. Đó là cửa, và message CQRS là class trần.
- **Type transport trong thư mục thao tác** (`CQRS-1`). Request/response chỉ phục vụ cửa của chính
  thao tác này được phép nằm trong một thư mục con mang tên vai trò của chúng. Chúng là **một phần**
  của thao tác, không phải thứ vừa được phát minh trong đó. Đây là một mâu thuẫn đã ghi nhận với cách
  đọc chặt nhất của luật, xem `audit.md`.
- **Nợ khi mới bật rule.** Một rule của module này ra mắt ở mức `warn` kèm số vi phạm, được đốt về
  không, rồi mới lật sang `error`. Ra mắt ở `error` khi còn nợ thì chặn mọi commit chạm vào file vi
  phạm, và đó là cách một rule đúng bị gỡ bỏ.
- **Đếm đúng report của rule đang đo.** Khi đo số vi phạm, chỉ đếm report **của chính rule đó**.
  Comment disable nội tuyến trỏ tới các rule mà config đo tối giản không nạp cũng bị báo là lỗi, và
  đếm cả chúng thì mọi phép đo đều phồng lên cùng một chiều.
