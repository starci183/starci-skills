---
id: be-patterns-testing-vi
title: vi.md
slug: /be/patterns/testing/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống TESTING-N, nhận diện bằng câu hỏi mà test trả lời chứ không bằng chỗ nó nằm.
---

# vi.md

> Version: `2.00` · Module: `testing`

# Testing

Một test được mua bằng **câu hỏi nó trả lời**, không phải bằng thứ nó chạm vào.

- **e2e** trả lời: *nghiệp vụ có chạy không?*
- **unit spec** trả lời: *quyết định này có ra đúng không?*
- **harness** trả lời: *câu trả lời của model có chấp nhận được không?*

Câu hỏi phân lane không phải "test này gọi tới đâu" mà là:

> Thứ này có thể vỡ trên production mà test không hề hay biết không?

Nếu có, test đang **không** phủ cái mà nó trông như đang phủ. Với một flow, gần như lúc nào lý do
cũng là một: nó assert cái response thay vì assert cái hệ quả.

**Đây là luật bắt buộc.** Mọi file test đều rơi vào đúng một lane và mang đúng một nghĩa vụ hình
dạng. Không có kích thước nào nhỏ đến mức được miễn: một bảng ba nhánh là `TESTING-5` đúng cùng lý do
mà một flow checkout-tới-entitlement là `TESTING-2`.

Phần lớn luật này **không** máy kiểm được. Năm trên mười một mã có lint rule đứng sau; sáu mã còn lại
chỉ có người đọc. Bảng `Tầng giữ` trong [`INDEX.md`](./INDEX.md) nói rõ mã nào thuộc loại nào, để
không ai đọc nhầm rằng cả mười một mã đều được máy giữ.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Lane | Tầng giữ |
|---|---|---|---|
| `TESTING-1` | Một file e2e = một câu chuyện nghiệp vụ, tên file là câu chuyện đó | e2e | `documented` |
| `TESTING-2` | Assert hệ quả: hàng đã ghi, số dư đã đổi, quyền đã mở, event đã ra | e2e | `enforced` |
| `TESTING-3` | Vào bằng đúng cửa production vào; bước async thì **chờ trạng thái**, không chờ đồng hồ | e2e | `enforced` |
| `TESTING-4` | Happy path là chủ thể; unhappy path chỉ vào lane này khi kéo theo một flow trọng yếu | e2e | `documented` |
| `TESTING-5` | Phủ **nhánh quyết định**, kể cả biên | unit | `documented` |
| `TESTING-6` | Assert giá trị trả về hoặc trạng thái đã đổi, không phải "đã gọi" | unit | `enforced` |
| `TESTING-7` | Lane khai bằng **hậu tố tên file**, không phải bằng thư mục | mọi lane | `documented` |
| `TESTING-8` | Lane có test, hoặc xoá lane đi | mọi lane | `documented` |
| `TESTING-9` | Flow đi qua model: giữ thật mọi thứ, chỉ thay **kết quả của provider**, bằng JSON thật dạng | e2e | `enforced` |
| `TESTING-10` | Harness gọi thẳng SDK provider bằng key server thật, một hai case mỗi capability | harness | `enforced` |
| `TESTING-11` | Seed demo dựng một **thế giới** có dữ liệu đa dạng, rồi để read path thật dựng lại màn hình | seed | `documented` |

---

## `TESTING-1` — một file e2e là một câu chuyện nghiệp vụ

**Tình huống.** Bạn sắp đặt tên cho một file flow. Tên đó quyết định file sẽ chứa gì trong hai năm
tới, vì người sau sẽ thêm test vào file mà tên nó cho phép.

**Dấu hiệu nhận biết**

- Tên trung thực của file là một **câu** về nghiệp vụ: "mua khoá học", "hoàn tiền", "đổi thưởng".
- Nếu tên trung thực lại là một **danh ngữ chỉ một phần của API** — `*-queries`, `*-mutations`,
  `*-resolvers` — thì file đang sai hình dạng, không phải sai tên.
- File chạy xanh mà không ai dám nói "nghiệp vụ chạy được" là dấu hiệu chắc chắn nhất.

**Tự hỏi.** Nếu phải kể cho một người không đọc code, câu tôi kể có phải là một lời hứa của sản phẩm
không? Hay tôi chỉ đang liệt kê "vài endpoint có trả lời"?

**Ranh giới**

- ↔ `TESTING-4`: `TESTING-1` nói file **là** cái gì; `TESTING-4` nói file được phép chứa **nhánh
  nào**. Một file tên đúng vẫn có thể chứa sai nhánh.
- ↔ `TESTING-7`: `TESTING-7` chỉ nói hậu tố. Hậu tố đúng không cứu được một cái tên sai hình dạng.
- ↔ `TESTING-2`: tên đúng mà assert envelope thì vẫn hỏng — hai mã này hỏng độc lập với nhau.

**Tình huống nghiệp vụ hay gặp.** Mua khoá học · hoàn tiền sau khi capture · trả góp tới hạn · đổi
thưởng · nộp bài chấm điểm · liên kết tài khoản ngoài · mở khoá thành tựu · gia hạn gói.

---

## `TESTING-2` — assert hệ quả, không assert phong bì

**Tình huống.** Flow đã chạy xong. Bây giờ phải chứng minh **cái gì đó đã thay đổi trong thế giới**,
chứ không phải server còn sống.

**Dấu hiệu nhận biết**

- Assertion cuối cùng nhìn vào `status`, `__typename`, `errors === undefined`, hoặc đọc lại chính
  cái response vừa trả về.
- File không hề chạm tới `entityManager`, `dataSource`, `getRepository` hay `queryRunner`.
- Nếu ai đó xoá dòng `await repository.save(...)` trong handler, file này vẫn xanh.

**Tự hỏi.** Nếu tầng lưu trữ im lặng ngừng ghi, file này có đỏ không? Nếu không — chưa đạt
`TESTING-2`.

**Ranh giới**

- ↔ `TESTING-3`: `TESTING-3` nói **vào bằng cửa nào và chờ ra sao**; `TESTING-2` nói **nhìn vào đâu
  khi đã tới nơi**. Vào đúng cửa mà nhìn nhầm chỗ vẫn là vi phạm `TESTING-2`.
- ↔ `TESTING-6`: cùng một bệnh ở hai lane — `TESTING-6` là spec chỉ assert lời gọi, `TESTING-2` là
  flow chỉ assert lời đáp.

**Ngoại lệ.** Một flow thật sự không để lại hệ quả bền vững nào thì cần một `eslint-disable` **nêu
tên thứ nó quan sát thay thế**. Không nêu được thì đó không phải ngoại lệ, đó là test chưa xong.

**Tình huống nghiệp vụ hay gặp.** Ghi danh mở ra sau webhook thanh toán · số dư ví trở về sau hoàn
tiền · quota bị trừ sau một lượt hỏi · streak tăng sau khi hoàn thành bài · projection được dựng lại
sau khi CDC chạy · thông báo được đẩy tới đúng người nhận.

---

## `TESTING-3` — test đi đúng đường mà flow đi

**Tình huống.** Flow trên production vào bằng GraphQL, HTTP, socket, message broker hoặc scheduler.
Test phải vào bằng đúng cửa đó.

**Dấu hiệu nhận biết**

- Test gọi `commandBus.execute(...)`, `handler.execute(...)`, `resolver.execute(...)` hay
  `worker.process(...)`. Tất cả đều **bắt đầu sau** routing, guard, validation và serialization.
- Sau một bước bất đồng bộ, dòng ngay kế tiếp đã assert luôn.
- Flow một nửa HTTP một nửa socket, nhưng test chỉ nói HTTP.

**Tự hỏi.** Guard, pipe và serializer của production có nằm **bên trong** phạm vi test này không? Nếu
không, chúng có thể vỡ mà file vẫn xanh.

**Ranh giới**

- ↔ `TESTING-2`: xem trên.
- ↔ lane integration: `commandBus.execute(...)` **không** phải cái xấu — nó là công dân hợp lệ của
  lane `*.int-spec.ts`. Vi phạm là dùng nó **trong lane e2e**.

**Ngoại lệ.** Không có ngoại lệ cho "vào từ bên trong". Có ngoại lệ cho **cách chờ**: mọi bước async
đều chờ bằng deadline cộng predicate, và bản thân deadline cũng là một assertion về hệ thống.

**Tình huống nghiệp vụ hay gặp.** Webhook của cổng thanh toán · job nền chấm bài · encode media ·
đẩy notification qua socket · message qua broker giữa hai instance · cron gia hạn gói.

---

## `TESTING-4` — happy path là chủ thể

**Tình huống.** Bạn có một nhánh thất bại và đang phân vân đưa nó vào lane nào.

**Dấu hiệu nhận biết**

- Thất bại này **kéo theo** một việc khác bắt buộc phải đúng: đã capture rồi settle hỏng ⇒ phải
  refund; charge tới hai lần ⇒ idempotency phải giữ; hai writer đua ⇒ constraint phải bắt.
- Ngược lại: thất bại này chỉ trả về một thông điệp validation, và không có gì chạy sau đó.

**Tự hỏi.** Khi bước này hỏng, có **thứ hai** nào bắt buộc phải xảy ra không? Có — e2e. Không — unit
spec.

**Ranh giới**

- ↔ `TESTING-5`: một lỗi validation là một **quyết định**. Nó thuộc `TESTING-5`, nơi nó tốn vài mili
  giây thay vì một database.
- ↔ `TESTING-1`: nhánh thất bại đủ tiêu chuẩn vẫn phải nằm trong một file mang tên câu chuyện của
  chính nó, không nhét ké vào flow happy path.

**Tình huống nghiệp vụ hay gặp.** Settle hỏng sau capture ⇒ hoàn tiền và đóng quyền · webhook lặp ⇒
idempotency · hai người cùng nhận suất cuối ⇒ unique constraint · huỷ giữa chừng ⇒ dọn giữ chỗ · trả
góp quá hạn ⇒ chuyển trạng thái và thu hồi quyền.

---

## `TESTING-5` — phủ nhánh quyết định, không phủ dòng

**Tình huống.** Một handler có nhiều đường ra. Bạn đang viết spec cho nó.

**Dấu hiệu nhận biết**

- Có biên: `0`, `cap`, `cap + 1`. Có tập rỗng. Có "đã làm rồi". Có "không được phép".
- Spec hiện tại chọn **một** giá trị nằm giữa dải và tuyên bố đã phủ.
- Báo cáo coverage xanh trong khi một off-by-one ở biên vẫn ship được.

**Tự hỏi.** Nhánh nào có thể **đổi kết quả**? Mỗi nhánh đó đã có một case riêng chưa?

**Ranh giới**

- ↔ `TESTING-4`: `TESTING-5` là nơi mọi nhánh thất bại không kéo theo gì khác đi về.
- ↔ `TESTING-6`: `TESTING-5` nói **bao nhiêu case**; `TESTING-6` nói **case đó assert cái gì**. Đủ
  case mà toàn assert lời gọi thì vẫn không chứng minh được gì.

**Tình huống nghiệp vụ hay gặp.** Số lần thử ở đúng ngưỡng · giỏ hàng rỗng · coupon hết hạn đúng vào
giây cuối · quota còn đúng một lượt · người dùng đã ghi danh rồi · vai trò không đủ quyền · điểm rơi
đúng mốc đậu.

---

## `TESTING-6` — spec chỉ assert lời gọi là spec chép lại source

**Tình huống.** Spec chạy handler rồi kiểm tra rằng một collaborator đã được gọi, và dừng ở đó.

**Dấu hiệu nhận biết**

- Mọi assertion trong file đều là `toHaveBeenCalled`, `toHaveBeenCalledWith`, `toHaveBeenCalledTimes`
  hoặc họ hàng của chúng.
- Đổi tên method của collaborator ⇒ file đỏ. Đổi con số nghiệp vụ thành sai ⇒ file vẫn xanh.
- Spec đọc lên nghe **giống hệt** phần thân của handler.

**Tự hỏi.** Nếu tôi thay giá trị nghiệp vụ bằng một giá trị sai, file này có đỏ không?

**Ranh giới**

- ↔ `TESTING-2`: cùng một bệnh, khác lane.
- ↔ ngoại lệ hợp lệ: khi **bản thân lời gọi là hệ quả quan sát được** — mail đã gửi, event đã publish
  — thì call assertion là **assertion thứ hai**, đứng cạnh một assertion về kết quả.

**Tình huống nghiệp vụ hay gặp.** Handler tính giá sau coupon · service trừ quota · worker chuyển
trạng thái đơn · mapper dựng payload · policy quyết cho phép hay từ chối.

---

## `TESTING-7` — lane nằm ở hậu tố, không nằm ở thư mục

**Tình huống.** Bạn đặt một file test cạnh code nó kiểm, và cần lane chạy nhanh vẫn nhanh.

**Dấu hiệu nhận biết**

- Bốn hậu tố: `*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `*.harness-spec.ts`.
- Config lane loại trừ nhau bằng **suffix**, không bằng đường dẫn.
- Nếu phải mở file ra mới biết nó thuộc lane nào thì tên file đang không làm việc của nó.

**Tự hỏi.** Nhìn **mỗi tên file**, tôi có biết nó chạy trong lần chạy nào không?

**Ranh giới**

- ↔ `TESTING-8`: `TESTING-7` nói lane được **khai** thế nào; `TESTING-8` nói một lane đã khai thì
  phải **có thật** thế nào.
- ↔ `TESTING-1`: hậu tố đúng không sửa được phần tên phía trước.

**Tình huống nghiệp vụ hay gặp.** Spec unit nằm cạnh handler · int-spec cần container thật · e2e và
harness ở chung thư mục nhưng khác lane chạy · lane nhanh chạy trong pre-commit.

---

## `TESTING-8` — lane rỗng không phải lane xanh

**Tình huống.** Một lane đã được cấu hình, đã có script, đã nằm trong CI — và không có file nào khớp.

**Dấu hiệu nhận biết**

- Script mang cờ cho phép "không có test cũng coi là qua".
- Báo cáo CI hiện màu xanh cho một lane mà không ai nhớ lần cuối nó chạy cái gì.
- Xoá hết test trong lane đó đi, không có gì đỏ lên.

**Tự hỏi.** Nếu lane này còn **đúng không file nào**, có ai biết không?

**Ranh giới**

- ↔ `TESTING-7`: xem trên.
- Cờ "qua khi rỗng" **không** tự nó là vi phạm. Vi phạm là cờ đó cộng với một lane thật sự rỗng, vì
  lúc ấy màu xanh là một tuyên bố về độ phủ mà không có gì đứng sau.

**Tình huống nghiệp vụ hay gặp.** Lane integration mới dựng chưa kịp có file · lane bị đổi glob nên
không match gì nữa · lane bị đổi thư mục sau một lần refactor · lane còn lại sau khi xoá một domain.

---

## `TESTING-9` — e2e không bao giờ gọi model

**Tình huống.** Một flow đi qua model: hỏi đáp có trích dẫn, chấm bài, sinh CV, tóm tắt.

**Dấu hiệu nhận biết**

- Test gọi thật tới provider ⇒ tốn tiền, chậm vài giây, và **trả lời khác nhau mỗi lần**. Cả ba tính
  chất đều chí mạng trong một suite flow.
- Assertion phải nới lỏng dần cho sống sót qua các cách diễn đạt khác nhau, tới lúc nó không còn bắt
  được gì.
- Stub trả về `"stubbed"`, `"ok"`, `"test"` ⇒ parser strict-JSON **không hề chạy**, mà parser chính
  là chỗ dễ vỡ nhất: đó là nơi output của model gặp schema.
- Stub do **từng tác giả flow tự nhớ cài** ⇒ luật phụ thuộc trí nhớ.

**Tự hỏi.** Cái tôi đang chứng minh là *quota, entitlement, parser, persistence* — hay là *chất lượng
câu chữ của model*? Vế sau thuộc harness.

**Ranh giới**

- ↔ `TESTING-10`: hai lane chạy **ngược chiều nhau**. Trong e2e, gọi thật là sai. Trong harness, giả
  lập là sai — vì chủ thể của harness đúng là câu trả lời thật của model.
- ↔ `TESTING-2`: sau khi stub, phần còn lại vẫn phải assert hệ quả. Stub không miễn `TESTING-2`.

**Tình huống nghiệp vụ hay gặp.** Hỏi đáp theo nội dung có trích dẫn · chấm bài tự luận · sinh CV ·
tóm tắt tiến độ · gợi ý lộ trình · phân loại nội dung.

---

## `TESTING-10` — harness gọi thẳng provider, và giữ mình nhỏ

**Tình huống.** Bạn cần biết câu trả lời của model **có chấp nhận được không**. Đó là câu hỏi duy
nhất lane này trả lời.

**Dấu hiệu nhận biết**

- Mỗi lớp nằm giữa harness và provider là một lớp có thể làm harness xanh trong khi production hỏng:
  một tier, một routing override, một wrapper nhà tự chọn model.
- Harness "giả" gateway production bằng một adapter gọi thật ⇒ nó có thể **bịa ra** metadata về
  provider, token và chi phí.
- Credential là OAuth của một CLI, session của một ứng dụng chat, hay một file profile ⇒ đó không
  phải API key do provider cấp cho server, và nó không chứng minh được quyền đã deploy.
- Harness mọc thêm một case cho mỗi edge ⇒ tính tiền theo lượt gọi ⇒ tới lúc không ai chạy nữa, và
  một màu xanh cũ vẫn còn treo trên bảng.

**Tự hỏi.** Thứ đang được kiểm có đúng là **thứ sẽ ship** không? Và nếu lane này đắt lên gấp mười,
tôi có còn chạy nó không?

**Ranh giới**

- ↔ `TESTING-9`: xem trên. Bất đối xứng là cố ý và phải giữ nguyên: e2e giữ thật mọi thứ **trừ** kết
  quả provider; harness gọi thật provider nhưng **chỉ** chứng minh chất lượng prompt/model/parser.
- Harness **không** thay thế độ phủ flow. Nó không biết gì về quota, entitlement hay persistence.

**Ngoại lệ.** Một judge model độc lập được phép, với điều kiện nó khai **bộ bốn của riêng nó**:
provider, model, endpoint, key. Không bên nào thừa kế ngầm bộ bốn của bên kia.

**Tình huống nghiệp vụ hay gặp.** Chấm bài · chấm phỏng vấn thử · chấm CV · kiểm chất lượng câu trả
lời có trích dẫn · so sánh hai prompt trước khi đổi.

---

## `TESTING-11` — seed demo dựng một thế giới, không dựng một ảnh chụp

**Tình huống.** Cần một môi trường local để người đọc **soi trạng thái sản phẩm thật qua đúng read
path của production**.

**Dấu hiệu nhận biết**

- Seed tạo đúng một tài khoản trắng, mọi số đều bằng không ⇒ không có gì chứng minh được list, đếm,
  xếp hạng, tiến độ hay join giữa nhiều người dùng là đúng.
- Seed ghi thẳng JSON hình dạng đúng cái màn hình cần ⇒ màn hình trông đầy đủ, nhưng **không** join
  hay projection nào của production chứng minh nó.
- Seed giả định một identity cứng chính là người đang đăng nhập.
- Chạy lần hai thì nhân đôi dữ liệu.

**Tự hỏi.** Nếu tôi xoá projection đi và để handler thật dựng lại, màn hình có còn đúng như thế
không?

**Ranh giới**

- ↔ `TESTING-2`: cùng một tinh thần "đọc lại từ nơi state thật sống", nhưng `TESTING-11` áp cho môi
  trường demo chứ không phải cho một assertion.
- Trạng thái rỗng **vẫn** đáng được seed. Cái bị từ chối là một thế giới mà mọi thứ đều rỗng.

**Tình huống nghiệp vụ hay gặp.** Dashboard có tiến độ dở dang · chuỗi ngày hoạt động liên tiếp · số
dư thưởng đã kiếm được · bảng xếp hạng nhiều người · feed hoạt động có nhiều tác nhân · hồ sơ công
khai có người theo dõi.

---

## Luật

1. Chọn lane bằng **câu hỏi test trả lời**, không bằng thứ nó chạm vào.
2. Một file e2e là **một** flow, và tên file là flow đó.
3. Assertion là **hệ quả**, không phải phong bì.
4. Vào bằng đúng cửa production vào; bước async thì chờ trạng thái với một deadline.
5. Happy path là chủ thể của lane flow; nhánh hỏng chỉ vào khi nó kéo theo việc khác bắt buộc đúng.
6. Unit spec phủ **nhánh**, và assert **kết quả hoặc trạng thái**.
7. Lane khai bằng hậu tố; lane đã khai thì phải có test thật.
8. Chỉ harness trả tiền cho provider, và chỉ harness gọi thẳng provider.
9. Stub của model trả về payload mà parser production **parse được thật**.
10. Seed demo ghi bản ghi nguồn, rồi để read path production dựng lại phần dẫn xuất.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp vào.

- **Call assertion làm assertion thứ hai** (`TESTING-6`). Hợp lệ khi bản thân lời gọi là hệ quả quan
  sát được, và trong file còn một assertion về kết quả. Rule chỉ nổ khi **cả file** không còn gì
  khác.
- **Flow không có hệ quả bền vững** (`TESTING-2`). Cần một disable **nêu tên thứ nó quan sát thay
  thế**. Không nêu được thì không phải ngoại lệ.
- **Nhánh hỏng vào lane flow** (`TESTING-4`). Chỉ khi thất bại kích hoạt một việc thứ hai bắt buộc
  phải đúng.
- **Opt-out khỏi stub provider** (`TESTING-9`). Phải là quyết định tường minh và được review, không
  phải một dòng ai đó lặng lẽ thêm vào.
- **Judge model riêng** (`TESTING-10`). Khai đủ provider, model, endpoint, key của chính nó.
- **Trạng thái rỗng** (`TESTING-11`). Vẫn seed. Cái bị cấm là một thế giới toàn rỗng.
- **`commandBus.execute(...)` ngoài lane e2e**. Đó là công dân hợp lệ của lane integration; vi phạm
  `TESTING-3` chỉ xảy ra bên trong `*.e2e-spec.ts`.
