---
id: be-patterns-type-safety-vi
title: vi.md
slug: /be/patterns/type-safety/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống TYPE-N, nhận diện bằng nghiệp vụ chứ không bằng cảm giác "code chạy được rồi".
---

# vi.md

> Version: `2.00` · Module: `type-safety`

# Type safety

Trình biên dịch là **người review rẻ nhất** mà một back end có: nó đọc từng dòng, không bao giờ mệt
và nó phản đối **trước khi** code chạy.

Mọi mã dưới đây đều xoay quanh một việc: **đừng tắt nó đi.**

Điều khó là mỗi cách tắt đều trông hợp lý **ngay tại lúc viết**, và vô hình **ngay sau đó**. Không ai
gõ `any` vì muốn bỏ kiểm tra; người ta gõ `any` vì đang vội và vì dòng đó "chỉ là tạm". Dòng tạm ấy
không bao giờ được đọc lại.

Câu hỏi phân định mọi trường hợp:

> Sau dòng này, trình biên dịch **còn biết** thứ nó vừa có không?

Nếu câu trả lời là không, dòng đó đã **tiêu mất một bảo đảm**. Tiêu thì được, nhưng phải có lý do
tốt hơn "cho tiện", và lý do ấy phải đọc được ngay tại chỗ.

**Đây là luật bắt buộc.** Mọi giá trị đi qua một ranh giới, mọi danh sách tham số, mọi enum và mọi
tập trạng thái đều thuộc đúng một mã dưới đây. Không có ranh giới nào nhỏ đến mức được miễn: một
params hai field trả lời `TYPE-3` đúng cùng một lý do mà một kết quả chấm bốn trạng thái trả lời
`TYPE-5`. Câu "có mỗi cái helper thôi mà" là chỗ luật này bị bỏ qua nhiều nhất — và helper chính là
thứ có thêm caller thứ hai mà không ai đọc lại.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Điều phải làm |
|---|---|---|
| `TYPE-1` | Giá trị từ ngoài vào mà mình không kiểm soát hình dạng | Nhận là `unknown`, thu hẹp **một lần**, công khai |
| `TYPE-2` | Trình biên dịch nói hai kiểu không giao nhau | Sửa kiểu, hoặc dùng guard **thật sự kiểm tra** |
| `TYPE-3` | Hàm nhận một object đã destructure | Kiểu **có tên**, đặt trong `types/` của module |
| `TYPE-4` | Một tập hằng có tên | `enum` thường, giữ lại object lúc chạy |
| `TYPE-5` | Một tình huống có nhiều trạng thái | Union phân biệt bằng discriminant |
| `TYPE-6` | Một làn code cần lối thoát hợp lệ | Khai báo **một lần tại làn**, không rắc từng dòng |

---

## `TYPE-1` — không dùng `any`, hãy thu hẹp từ `unknown`

**Tình huống.** Một giá trị đi vào từ chỗ mình không kiểm soát: body của một webhook, lỗi mà SDK của
nhà cung cấp ném ra, một cột `jsonb` đọc lên từ database, một file cấu hình do người khác sửa. Mình
**không biết** hình dạng của nó.

`any` **không** có nghĩa là "tôi không biết kiểu này". Nó có nghĩa là **"thôi đừng kiểm tra nữa"** —
và cái "thôi" ấy **lan ra**: mọi property đọc ra từ nó, mọi giá trị dẫn xuất từ nó, mọi chỗ nó được
truyền vào đều không còn được kiểm tra. Một `any` ở tầng parser có thể làm mù cả một chuỗi gọi mà
không ai viết thêm chữ `any` nào nữa.

`unknown` nói **đúng cái điều thật lòng đó**, nhưng bắt việc thu hẹp phải xảy ra **một lần**, ở nơi
người đọc nhìn thấy giả định.

**Dấu hiệu nhận biết**

- Giá trị đến từ mạng, từ SDK bên thứ ba, từ `JSON.parse`, từ một cột jsonb, từ `catch`.
- Mình đang gõ `any` vì "kiểu thật dài quá" hoặc "SDK khai báo sai".
- Sau dòng đó, IDE ngừng gợi ý — dấu hiệu trực quan nhất của một bảo đảm vừa mất.

**Tự hỏi.** Nếu mình khai `unknown` ở đây, dòng nào sẽ đỏ? Mỗi dòng đỏ đó là **một giả định mình vừa
định giấu đi**.

**Ranh giới**

- ↔ `TYPE-2`: `any` **thú nhận** rằng nó không kiểm tra gì; double cast thì **nói dối** rằng nó là
  `T`. `any` hỏng theo hướng lan ra, double cast hỏng theo hướng lặn xuống.
- ↔ `TYPE-3`: `any` trên một tham số là mất kiểm tra; kiểu inline trên một tham số **vẫn kiểm tra
  đầy đủ**, chỉ là không ai tham chiếu được. Hai vấn đề khác nhau, đừng gộp.

**Tình huống nghiệp vụ hay gặp.** Parser webhook của cổng thanh toán · `catch (error)` quanh một
lệnh gọi provider AI · đọc cột jsonb lưu snapshot · parse front-matter của file nội dung · kết quả
`JSON.parse` từ response của model · payload của một message queue · biến môi trường trước khi
validate.

---

## `TYPE-2` — không double cast qua `unknown`

**Tình huống.** Mình viết `x as T`, trình biên dịch từ chối vì hai kiểu không giao nhau. Mình sửa
bằng cách chèn `unknown` vào giữa: `x as unknown as T`.

Đây là **trình biên dịch bị bác bỏ hai lần**. Lần một: "hai kiểu này không liên quan". Lần hai:
"kệ".

Nó **tệ hơn `any`** ở đúng một điểm, và điểm đó quyết định. `any` nói "đừng tin tôi", nên mọi thứ
phía sau đều được xét lại. Double cast tạo ra một giá trị **tự nhận là `T`**, nên **mọi thứ phía sau
tin nó tuyệt đối** — và lỗi nổ ra ở một dòng chẳng làm gì sai, cách chỗ gây lỗi hàng chục file.

**Dấu hiệu nhận biết**

- Chuỗi `as unknown as` xuất hiện trong code sản phẩm.
- Mình đang ép một object thiếu field thành một entity đầy đủ.
- Mình đang ép kết quả của một query thô thành kiểu entity mà không kiểm gì.
- Lý do trong đầu là "tôi biết chắc lúc chạy nó đúng mà".

**Tự hỏi.** Nếu điều mình "biết chắc" sai, ai là người phát hiện? Nếu câu trả lời là "khách hàng",
thì đây là `TYPE-2`.

**Ranh giới**

- ↔ `TYPE-1`: xem trên.
- ↔ Một cast đơn: `as unknown` **một mình** là nới rộng ra ngoài, và đó là hành động thật thà — nó
  vứt thông tin đi chứ không nhận thêm thứ gì. Một cast thu hẹp **một mình** là câu hỏi khác, nhỏ
  hơn, và mã này không trả lời.
- ↔ `TYPE-6`: trong spec và test tree, double cast là **hợp lệ và cần thiết** — dựng một giá trị sai
  cố ý là cách chứng minh API đóng từ chối nó. Ranh giới là **làn code**, không phải dòng code.

**Tình huống nghiệp vụ hay gặp.** Ép raw row từ query thô thành entity · ép một object rỗng thành
collaborator trong code sản phẩm · ép request của framework này thành request của framework kia ·
"vá" một kiểu SDK khai sai · ép DTO thành entity để tiết kiệm một hàm map.

---

## `TYPE-3` — tham số destructure phải có kiểu được đặt tên

**Tình huống.** Một hàm nhận một object và destructure ngay tại chữ ký:
`({ userId, courseId }: { userId: string, courseId: string })`.

Kiểu viết thẳng tại chỗ ấy **không tham chiếu được, không import được, không extend được, không
index được**. Cho nên caller thứ hai **gõ lại nó**, và hai bản sao **trôi ra xa nhau trong im lặng**,
vì không có gì nối chúng với nhau. Khi field thứ ba xuất hiện, chỉ **một** trong hai bản sao nhận
được nó.

Một kiểu có tên trong `types/` của module là **đúng lượng thông tin đó, nhưng có tay cầm**.

**Dấu hiệu nhận biết**

- Chữ ký hàm dài hơn thân hàm.
- Có hai chỗ trong repo cùng khai một object gần giống nhau.
- Muốn viết `Params["field"]` mà không có gì để index vào.
- Muốn viết một hàm bọc ngoài mà không gọi tên được kiểu tham số của hàm bên trong.

**Tự hỏi.** Nếu ngày mai có caller thứ hai, họ **import cái gì**? Nếu không có câu trả lời — đây là
`TYPE-3`.

**Ranh giới**

- ↔ `TYPE-1`: xem trên. Kiểu inline **vẫn** được kiểm tra đầy đủ; vấn đề là tái sử dụng, không phải
  an toàn.
- ↔ Tham số positional: `(params: { userId: string })` **không** thuộc mã này. Mã này nói về dạng
  **đã destructure**, vì đó là dạng bị gõ lại. Tham số positional là vấn đề nhỏ hơn, thuốc khác.

**Tình huống nghiệp vụ hay gặp.** Params của một handler CQRS · params của một service method có
ba tham số trở lên · options của một hàm tiện ích · payload của một job · tham số của một hàm
projection · input của một step trong pipeline xử lý.

---

## `TYPE-4` — enum thường, không bao giờ `const enum`

**Tình huống.** Một tập hằng có tên: trạng thái đơn hàng, loại thông báo, nhà cung cấp model.

`const enum` được **nội tuyến lúc biên dịch** và **không để lại object nào lúc chạy**. Cái nó tiết
kiệm là vài byte. Cái nó lấy đi là **cả một họ việc đơn giản bỗng không làm được nữa**:

- không `Object.values()` được, nên không duyệt được để dựng danh sách chọn;
- không map ngược từ giá trị về member được, nên không "hồi phục" được một giá trị đã lưu trong DB;
- không truyền chính enum đó **như một giá trị** vào một hàm generic được;
- không đi qua được ranh giới `isolatedModules` mà repo này đang biên dịch dưới đó.

**Dấu hiệu nhận biết**

- Có ai đó thêm `const` vào trước `enum` "cho nhẹ bundle" — trong một tiến trình Node.
- Một hàm coerce nhận `enumObject` làm tham số: đó là bằng chứng enum **phải** tồn tại lúc chạy.
- Một `registerEnumType` hoặc một cột enum trong DB: cả hai đều cần object thật.

**Tự hỏi.** Có chỗ nào duyệt, map ngược, hoặc truyền chính enum này như một giá trị không? Trong một
back end, câu trả lời gần như luôn là có — kể cả khi hôm nay chưa có.

**Ranh giới**

- ↔ `TYPE-5`: enum là **một trục** giá trị; union phân biệt là **nhiều trạng thái, mỗi trạng thái
  mang dữ liệu khác nhau**. Nếu mỗi nhánh cần field riêng thì enum không đủ, phải lên `TYPE-5`.
- ↔ `declare enum`: khai báo ambient **mô tả** một thứ đã tồn tại ở nơi khác, nó không phát sinh gì,
  nên không thuộc mã này.

**Tình huống nghiệp vụ hay gặp.** Trạng thái đơn hàng · loại giao dịch · nhà cung cấp model AI ·
kênh thông báo · loại lỗi được phân nhóm để retry · vai trò người dùng · cách sắp xếp của một query
danh sách.

---

## `TYPE-5` — union phân biệt thắng một túi boolean

**Tình huống.** Một tình huống có vài trạng thái, và người ta mô tả nó bằng mấy cái cờ:
`isPending`, `isGraded`, `isFailed`, cộng thêm `score?`.

Bốn boolean cho phép **mười sáu tổ hợp**. Có lẽ **ba** trong số đó tồn tại. Mười ba tổ hợp còn lại
**biên dịch sạch sẽ**, và một trong số chúng là thứ một caller truyền vào lúc bốn giờ sáng.

`isGraded && isFailed` biên dịch. `isGraded` mà không có `score` biên dịch. Không có cái nào trong
hai thứ đó là một trạng thái thật của nghiệp vụ, nhưng trình biên dịch không có cách nào biết —
mình **chưa hề nói cho nó biết**.

Union của những trạng thái **có thật** thì **không thể viết ra** một trạng thái không có thật. Đây là
mã duy nhất trong module này không cấm điều gì cả: nó **bật trình biên dịch lên mạnh hơn** thay vì
ngăn ai đó tắt bớt.

**Dấu hiệu nhận biết**

- Hai boolean trở lên cùng mô tả **một** thứ.
- Có field optional mà "chỉ có khi cờ kia bật" — và điều đó chỉ được viết trong comment.
- Code đọc lên có `if (a && !b && c)` để tái tạo lại một trạng thái lẽ ra phải có tên.
- Có một comment giải thích tổ hợp nào là hợp lệ. Comment đó chính là kiểu dữ liệu bị viết nhầm chỗ.

**Tự hỏi.** Liệt kê hết những trạng thái **thật sự tồn tại**. Hình dạng hiện tại cho phép viết ra bao
nhiêu trạng thái? Nếu hai con số khác nhau, phần chênh lệch là **bề mặt lỗi mình vừa tự tạo ra**.

**Ranh giới**

- ↔ `TYPE-4`: xem trên.
- ↔ Nhiều boolean độc lập: mã này nói về nhiều boolean mô tả **một** tình huống. Hai boolean trả lời
  hai câu hỏi độc lập thì đúng là hai boolean, không phải một union bị viết sai.
- ↔ Kiểu transport: một class response đã đăng ký schema, hoặc một cột lưu trữ, **không** mang được
  union. Union sống ở kết quả nội bộ; hình dạng transport mang bản phẳng; việc map giữa hai bên xảy
  ra **một lần, một chỗ**.

**Tình huống nghiệp vụ hay gặp.** Kết quả chấm bài · kết quả một bước đăng nhập (challenge hay đã có
session) · trạng thái thanh toán · kết quả đồng bộ (thành công / lệch / hỏng) · trạng thái một job
nền · kết quả gọi model (có nội dung / bị chặn / hết quota).

---

## `TYPE-6` — lối thoát hợp lệ được khai báo tại làn, không rắc từng dòng

**Tình huống.** Có những chỗ **phải** được phép làm điều luật cấm. Rõ nhất: spec và test tree được
phép double cast, vì **dựng một giá trị sai cố ý chính là cách chứng minh một API đóng biết từ
chối**. Không có lối thoát này thì không viết được test cho chính cái luật kia.

Vấn đề không phải là có lối thoát. Vấn đề là **lối thoát được khai ở đâu**.

Khai **một lần tại làn** — trong rule hoặc trong config — thì lối thoát **đếm được**: đọc một hàm là
biết hết mọi chỗ nó đang có hiệu lực. Rắc `eslint-disable` từng dòng thì lối thoát **thôi hiện hữu
và bắt đầu thành thói quen**: không ai biết có bao nhiêu cái, không ai biết cái nào còn cần, và cái
thứ năm mươi được thêm vào vì bốn mươi chín cái trước đã ở đó rồi.

**Dấu hiệu nhận biết**

- Một `eslint-disable-next-line` trong code sản phẩm cho một luật thuộc module này.
- Cùng một dòng suppression xuất hiện ở ba file trở lên — đó là một làn chưa được khai báo.
- Một file sản phẩm cần lối thoát của test: nghĩa là **file đang nằm sai làn**, không phải luật sai.

**Tự hỏi.** Nếu xoá hết mọi suppression trong repo, mình còn **đọc ra được** những chỗ nào được phép
ngoại lệ không? Nếu không — lối thoát đang ở sai chỗ.

**Ranh giới**

- ↔ `TYPE-2`: `TYPE-2` nói **cái gì** bị cấm; `TYPE-6` nói **lệnh miễn trừ được viết ở đâu**. Một
  spec double cast không phải là vi phạm `TYPE-2` rồi được tha — nó **không thuộc phạm vi**
  `TYPE-2` ngay từ đầu.
- ↔ Ngoại lệ nghiệp vụ: một ngoại lệ **đóng** đã nêu trong `## Ngoại lệ` là một phần của luật. Một
  suppression là một phần của **sự mệt mỏi**.

**Tình huống nghiệp vụ hay gặp.** Spec dựng collaborator thiếu method · e2e dựng payload sai để
chứng minh validation chặn · harness gọi provider thật · helper trong test tree dựng entity giả ·
fixture cố tình thiếu field bắt buộc.

---

## Luật

1. Không `any` — ở bất kỳ vị trí nào: tham số, giá trị trả về, field, tham số generic, đích của
   cast.
2. Giá trị chưa biết hình dạng vào bằng `unknown`, và được thu hẹp **đúng một lần**, công khai.
3. Không `x as unknown as T` trong code sản phẩm.
4. Tham số đã destructure mang **kiểu có tên**, đặt ở nơi caller thứ hai import được.
5. `enum` khai thường, giữ object lúc chạy.
6. Một tình huống nhiều trạng thái là **union phân biệt**, không phải tích của mấy cái cờ.
7. Lối thoát hợp lệ khai **một lần tại làn**, không rắc từng dòng.
8. Câu hỏi phân định cuối cùng: sau dòng này, trình biên dịch còn biết thứ nó vừa có không?

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Spec và test tree được dựng giá trị sai cố ý.** `TYPE-2` không áp vào làn test. Lối thoát thuộc
  về **làn**, không thuộc về **dòng** — nó khai một lần trong rule, và một suppression từng dòng bên
  trong một làn đã có lối thoát nghĩa là file đang nằm sai làn.
- **Nới rộng ra ngoài là thật thà.** `TYPE-2` cấm **cặp** cast. `as unknown` một mình vứt thông tin
  đi và không nhận thêm gì; đó là chiều hỏng ngược lại, và nó không bị cấm.
- **Tham số positional không phải tham số destructure.** `TYPE-3` chỉ nói về dạng đã destructure, vì
  đó là dạng bị caller thứ hai gõ lại.
- **Kiểu transport không mang được union.** `TYPE-5` không áp vào hình dạng đi trên dây hoặc xuống
  ổ đĩa khi định dạng đó không có kiểu tổng. Union ở kết quả nội bộ, bản phẳng ở transport, map một
  lần một chỗ.
- **Nhiều boolean độc lập vẫn là nhiều boolean.** `TYPE-5` nói về nhiều cờ mô tả **một** tình huống.
- **`declare enum` không thuộc `TYPE-4`.** Khai báo ambient mô tả thứ đã tồn tại ở nơi khác và không
  phát sinh gì.
