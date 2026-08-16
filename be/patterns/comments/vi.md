---
id: be-patterns-comments-vi
title: vi.md
slug: /be/patterns/comments/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống COMMENT-N, nhận diện bằng nghiệp vụ chứ không bằng cảm giác "thiếu chú thích".
---

# vi.md

> Version: `2.00` · Module: `comments`

# Comments

Một comment ở đây chỉ trả lời **một** câu mà code không tự trả lời được: **tại sao**.

Code làm gì thì bản thân code đã nói, bằng một ngôn ngữ được thiết kế để diễn đạt điều đó chính xác.
Viết lại điều đó bằng tiếng Anh là tạo ra **bản mô tả thứ hai** cho cùng một sự việc — và bản thứ hai
không có compiler nào đứng sau. Lần đầu tiên code đổi mà không ai sửa câu văn nằm cạnh, bản thứ hai
thành lời nói dối, và **không có gì đỏ lên cả**.

Câu tự hỏi quyết định một comment có đáng tồn tại không:

> Người đọc có tự suy ra được điều này từ đoạn code đang nằm trước mắt họ không?

Có — xoá. Không — viết xuống, vì nếu không, thông tin ấy **sắp mất**.

**Đây là luật bắt buộc.** Mọi export, mọi member của enum được export, mọi comment và mọi ký tự
non-ASCII trong cây source đều rơi vào đúng một mã dưới đây. Không có khai báo nào nhỏ đến mức được
miễn: một arrow function một dòng vẫn là `COMMENT-1`, đúng cùng lý do với một service class. Câu "có
mỗi một helper thôi mà" là chỗ luật này bị bỏ qua nhiều nhất — và helper chính là thứ có thêm ba
người gọi trước khi có ai đọc lại nó.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả phải có |
|---|---|---|
| `COMMENT-1` | Một thứ **rời khỏi file** và file khác import nó | Doc block nói nó DÙNG ĐỂ LÀM GÌ |
| `COMMENT-2` | Một member enum được chọn ở call site, xa chỗ quyết định ý nghĩa | Doc nói **chọn nó thì chuyện gì xảy ra** |
| `COMMENT-3` | Có một lý do nằm **ngoài** dòng code đó | Viết lý do; không viết lại dòng code |
| `COMMENT-4` | Người đọc tiếp theo không cùng tiếng mẹ đẻ với người viết | Prose bằng tiếng Anh, không emoji, không ký hiệu trang trí |
| `COMMENT-5` | Chuỗi mà **chương trình so khớp hoặc phát ra** | Giữ nguyên chuỗi, đánh dấu `vn-ok: <lý do>` |

---

## `COMMENT-1` — mọi export mở đầu bằng một doc block

**Tình huống.** Một class, interface, type, enum, function, hoặc một `const` gắn với một function —
tức là một thứ **có bề mặt** — được export ra. Đây chính là phần mà file khác phụ thuộc vào, và người
quyết định có dùng nó hay không thường **không mở file này ra**. Họ chỉ nhìn thấy cái tên ở dòng
import và chữ ký khi hover.

Tên cùng chữ ký cho biết nó **nhận vào gì**. Chúng không bao giờ nói được nó **để làm gì**, và càng
không nói được **khi nào nên chọn nó thay vì thứ nằm ngay bên cạnh**.

**Dấu hiệu nhận biết**

- Có từ khoá `export` trước một khai báo có bề mặt.
- Có ít nhất một file khác import nó — hoặc sẽ có, ngay khi ai đó cần.
- Có một thứ nằm cạnh trông giống hệt, và người đọc phải chọn giữa hai thứ đó.

**Tự hỏi.** Người đọc ở dòng import có biết vì sao họ nên gọi thứ này không? Nếu không — thiếu doc.

**Ranh giới**

- ↔ hằng số dữ liệu: `export const MAX_ATTEMPTS = 3` **không** thuộc mã này. Cái tên đã là mô tả đầy
  đủ; bắt viết một câu bên cạnh chỉ đẻ ra câu chép lại tên — mà chép lại tên là `COMMENT-3` vi phạm.
- ↔ re-export: `export { X } from "./x"` không khai báo gì cả, nên **không có chỗ** để gắn doc. Doc
  thuộc về nơi khai báo.
- ↔ `COMMENT-3`: một doc block chỉ chép lại cái tên **không** làm mã này thoả. Nó qua được cổng lint
  và vi phạm luật — đây là kiểu vi phạm phổ biến nhất của cả module.

**Tình huống nghiệp vụ hay gặp.** Decorator inject đúng connection · service class trong tầng dùng
chung · interface làm payload giữa hai module · type alias mô tả một shape trả về · guard · pipe ·
factory dựng client cho một hệ thống ngoài · util được ba nơi gọi.

---

## `COMMENT-2` — mỗi member enum nói **hậu quả** của việc chọn nó

**Tình huống.** Một enum được export ra. Member của nó được **chọn ở call site**, còn ý nghĩa của
member thì nằm ở một `switch` hoặc một bảng tra **ở file khác**. Người viết call site không mở file
kia ra.

Vì thế doc của member phải trả lời: **chọn cái này thì hệ thống làm gì?**, chứ không chỉ nói nó tên là gì.

`Pending` viết thành "trạng thái pending" là một dòng **không dạy được gì cả**. "Chưa có khoản thanh
toán nào settle, nên chưa cấp quyền gì và giỏ hàng vẫn sửa được" mới là dữ kiện người viết tiếp theo
cần và **không tự suy ra được**.

**Dấu hiệu nhận biết**

- Enum có `export`.
- Có ít nhất một chỗ `switch` trên nó, hoặc một bảng map từ member sang hành vi.
- Đọc riêng tên member thì không đoán được hệ thống sẽ làm gì.

**Tự hỏi.** Nếu tôi chọn member này ở một call site, cái gì thay đổi ở phía sau? Câu trả lời đó
**chính là** nội dung doc.

**Ranh giới**

- ↔ `COMMENT-1`: `COMMENT-1` là doc của **cả enum** — enum này để làm gì. `COMMENT-2` là doc của
  **từng member** — chọn member này thì sao. Một enum có doc ở trên và member trống rỗng vẫn vi phạm.
- ↔ `COMMENT-3`: doc chép lại tên member (`/** Trạng thái settled. */`) là `COMMENT-3` vi phạm, dù
  cổng lint xanh.

**Tình huống nghiệp vụ hay gặp.** Trạng thái thanh toán · phân loại lỗi để quyết định retry hay
disable · trạng thái key trong pool · loại quyền · mức độ nghiêm trọng của log · loại sự kiện phát ra
ngoài · lý do từ chối · giai đoạn của một phiên chấm.

---

## `COMMENT-3` — comment nói **tại sao**, code nói **cái gì**

**Tình huống.** Có một lý do **nằm ngoài dòng code** khiến dòng đó phải viết như vậy: một hệ thống
ngoài gửi webhook hai lần, một ràng buộc từ schema, một thứ tự trông tuỳ tiện mà không tuỳ tiện, một
bug mà hình dạng này ngăn được, một race giữa hai replica.

Comment chép lại dòng bên dưới **tệ hơn không có comment**: nó nhân đôi chi phí bảo trì và trở thành phần
sẽ **âm thầm sai**, vì không có gì hỏng khi một câu văn thôi đúng.

**Dấu hiệu nhận biết**

- Xoá câu comment đi thì code vẫn compile, vẫn chạy, nhưng **không còn giải thích được**.
- Câu comment nói về một thứ không xuất hiện trong dòng bên dưới: một hệ thống khác, một lần chạy
  khác, một trường hợp biên, một lần đã hỏng trong quá khứ.
- Ngược lại, dấu hiệu vi phạm: đọc câu comment rồi đọc dòng code, thấy **cùng một thông tin hai lần**.

**Tự hỏi.** Câu này có nói điều gì mà dòng code bên dưới **không** nói không?

**Ranh giới**

- ↔ `COMMENT-1`: doc block của một export cũng phải thoả `COMMENT-3`. Doc "Inject the primary entity
  manager" đứng trên `InjectPrimaryEntityManager` là chép lại tên — có doc mà vẫn sai.
- ↔ `COMMENT-4`: `COMMENT-3` hỏi comment **nói gì**; `COMMENT-4` hỏi comment **viết bằng gì**. Một
  câu tiếng Việt giải thích một race vi phạm `COMMENT-4` chứ không vi phạm `COMMENT-3`.

**Tình huống nghiệp vụ hay gặp.** Webhook gửi trùng · `RETURNING id` để biết txn nào thắng race ·
thứ tự gọi bắt buộc vì một bên ghi cache · một `try/catch` nuốt lỗi có chủ ý vì lần chạy sau tự lành ·
một index bắt buộc phải có vì query này quét toàn bảng · một giá trị hằng số lấy từ giới hạn của bên
thứ ba.

---

## `COMMENT-4` — prose trong source là tiếng Anh, không emoji, không trang trí

**Tình huống.** Không phải vì tiếng Anh hay hơn. Một codebase có **hai ngôn ngữ** là một
codebase có ít nhất một người đọc mà **một nửa phần lập luận không đọc được** — và đúng nửa đó là nửa
giải thích những chỗ bất ngờ. Chỗ hiển nhiên thì ai cũng đọc được từ code; chỗ cần comment mới là chỗ
mất.

Emoji và ký hiệu trang trí bị từ chối vì lý do khác: chúng mang **sắc thái** chứ không mang **thông
tin**, và sắc thái là thứ mỗi người đọc ra một kiểu. Một dấu ✅ trong comment không nói được nó nghĩa
là "đã kiểm", "đã xong", hay "đúng".

**Đây KHÔNG phải "chỉ được dùng ASCII".** Đây là chỗ dễ đọc nhầm nhất của module. Luật từ chối **ba
lớp ký tự**, mỗi lớp một lý do:

1. **Chữ cái tiếng Việt** — vì người đọc không cùng tiếng mẹ đẻ mất nửa lập luận.
2. **Emoji** — vì mang sắc thái thay vì thông tin.
3. **Ký hiệu trang trí đứng thay một từ** — dấu tích, dấu nhân, mũi tên dùng làm trang trí — cùng lý
   do với emoji.

Dấu câu kiểu chữ (em dash, middle dot, ellipsis, khung kẻ trong banner comment) **không thuộc ba lớp
trên và được giữ**. Bản đầu tiên của rule cấm mọi codepoint ngoài ASCII, đo trên một back end thật thì
báo 857 chỗ — và **tất cả** đều là em dash, khung kẻ hoặc middle dot. Đó không phải luật đang được ghi
lại; đó là một luật nghiêm hơn đang được **bịa ra**, và bịa luật là thứ duy nhất canon không được làm.

**Dấu hiệu nhận biết**

- Một comment giải thích lý do, viết bằng tiếng Việt.
- Một emoji trong log message hoặc trong banner.
- Một dấu ✅ / ❌ / ⭐ đứng thay cho một từ.

**Tự hỏi.** Một người không đọc được tiếng Việt mở file này ra, họ mất phần nào của lập luận?

**Ranh giới**

- ↔ `COMMENT-5`: đây là ranh giới quan trọng nhất của cả module. `COMMENT-4` nói về **prose**;
  `COMMENT-5` nói về **dữ liệu tình cờ có hình dạng văn xuôi**. Một câu tiếng Việt **chương trình so
  khớp hoặc phát ra** không phải comment, và dịch nó là làm hỏng chương trình.
- ↔ lane fixture: trong spec hoặc trong cây test, **chuỗi là dữ liệu** và comment vẫn là prose. Một
  spec đưa cho hệ thống đúng câu mà người dùng thật sẽ gõ là đang đưa **dữ liệu**; dịch nó ra tiếng
  Anh là đi test một hệ thống không ai dùng. Đo trước khi viết ngoại lệ này: 92 finding trong một back
  end thì 89 là chuỗi fixture, 3 là comment. Bắt đánh dấu cả 92 nghĩa là đặt marker lên từng dòng của
  từng hội thoại fixture — tức là dạy người đọc **thôi nhìn thấy marker**.
- ↔ file locale: file nằm dưới `messages/`, `locales/`, `i18n/` là **toàn bộ** product copy. Đi soi
  chúng là đi soi sản phẩm, nên mã này không áp vào đó.
- ↔ endonym: `Tiếng Việt` viết ra như **tên của một locale** là một nhãn, không phải prose bằng tiếng
  Việt, và được miễn.

**Tình huống nghiệp vụ hay gặp.** Comment giải thích một quyết định trong service · banner phân đoạn
trong một file dài · TODO còn lại từ một phiên trước · log message · tên biến · message của một
exception nội bộ.

---

## `COMMENT-5` — chuỗi chương trình phụ thuộc **không phải** comment

**Tình huống.** Một chuỗi tiếng Việt nằm trong source, nhưng nó **không phải lời của lập trình viên
nói với lập trình viên**. Nó là **dữ liệu**:

- một message trả về cho client theo locale,
- một chuỗi hệ thống ngoài gửi sang mà mình đem ra so sánh,
- một pattern khớp vào nội dung người dùng thật đã viết,
- một nhãn mà một model bắt buộc phải phát ra đúng như thế,
- một fixture mô phỏng đúng câu người dùng sẽ gõ.

Dịch những thứ này **làm hỏng chương trình**, và hỏng theo kiểu tệ nhất: **im lặng**. Một regex dịch
sai không ném lỗi, nó chỉ **không bao giờ khớp nữa**. Một nhánh so sánh dịch sai không đỏ, nó chỉ
không bao giờ đúng nữa.

Vì thế chúng **ở lại** và được đánh dấu bằng một ghi chú ngắn nói **vì sao** — để đợt rà soát
sau không "sửa" chúng thành bug.

**Dấu hiệu nhận biết**

- Chuỗi nằm ở vế phải của một phép so sánh, trong một regex, trong một map theo locale, hoặc trong
  một prompt template mà model phải phát lại đúng nguyên văn.
- Có một hệ thống **bên ngoài** quyết định nội dung chuỗi đó, không phải mình.
- Đổi chuỗi thì **hành vi** đổi, chứ không phải chỉ chữ hiển thị đổi.

**Tự hỏi.** Chuỗi này có phải **của mình** để đổi không? Nếu không — nó là dữ liệu.

**Ranh giới**

- ↔ `COMMENT-4`: xem trên. Prose thì dịch; dữ liệu thì giữ và đánh dấu.
- ↔ marker rỗng: một `vn-ok` **không có lý do** không phải ngoại lệ. Marker tồn tại để đợt rà soát sau
  đọc được vì sao dòng đó ở lại; không có lý do thì nó chỉ là một cách tắt cổng.
- ↔ lạm dụng marker: dùng `vn-ok` để giữ một **comment** tiếng Việt là biến ngoại lệ thành lỗ hổng.
  Ngoại lệ này dành cho **chuỗi**, không dành cho lời giải thích.

**Tình huống nghiệp vụ hay gặp.** Message thành công theo locale trả cho client · so sánh với message
của cổng thanh toán · regex bắt heading trong bài viết thật · nhãn cố định model phải phát ra · nội
dung mẫu trong prompt template · fixture hội thoại trong spec · nội dung email theo locale.

---

## Luật

1. Mọi export **có bề mặt** mở đầu bằng một doc block nói nó dùng để làm gì.
2. Mọi member của enum export ra có doc riêng, và doc nói **hậu quả** của việc chọn member đó.
3. Comment nói **tại sao**; code nói **cái gì**. Câu chép lại dòng bên dưới thì xoá.
4. Prose trong source là tiếng Anh, không chữ cái tiếng Việt, không emoji, không ký hiệu trang trí
   đứng thay một từ. Dấu câu kiểu chữ được giữ.
5. Chuỗi chương trình **so khớp hoặc phát ra** thì giữ nguyên và đánh dấu `vn-ok: <lý do>`.
6. Một doc block chép lại cái tên là vi phạm, dù cổng lint xanh.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp vào.

- **Hằng số dữ liệu.** `COMMENT-1` không đụng tới `export const MAX_ATTEMPTS = 3`. Tên đã là mô tả;
  bắt viết thêm một câu chỉ đẻ ra câu chép lại tên.
- **Re-export.** `export { X } from "./x"` không khai báo gì để gắn doc vào. Doc thuộc về nơi khai báo.
- **Dấu câu kiểu chữ.** `COMMENT-4` từ chối ba lớp: chữ tiếng Việt, emoji, ký hiệu trang trí. Em dash,
  middle dot, ellipsis, khung kẻ trong banner **không** thuộc ba lớp đó.
- **Endonym.** `Tiếng Việt` dùng làm **tên** của một locale là nhãn, không phải prose.
- **File locale.** File dưới `messages/`, `locales/`, `i18n/` là product copy toàn phần; `COMMENT-4`
  không áp vào đó.
- **Lane fixture.** Trong spec và trong cây test, `COMMENT-4` chỉ soi **dòng comment**. Chuỗi ở đó là
  dữ liệu và là mục đích của fixture. Comment tiếng Việt trong spec vẫn bị từ chối y như mọi nơi khác.
