---
id: fe-patterns-translation-vi
title: vi.md
slug: /fe/patterns/translation/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã COPY-N, nhận diện bằng nghiệp vụ chứ không bằng cảm giác "chỗ này chắc dịch được".
---

# vi.md

> Version: `2.00` · Module: `translation`

# Translation

Chữ là **dữ liệu**. Nó đến từ một cuốn từ điển, nó đổi mà không cần deploy, và nó khác nhau tuỳ người
đọc. Vì vậy nó được **nửa sở hữu request** quyết định xong rồi mới truyền xuống — y hệt mọi dữ liệu
khác trong hệ thống này.

Hệ quả duy nhất cần nói thẳng, vì đây là chỗ người ta hay với tay qua:

> Không component nào nằm dưới block được tự nói một chữ nào của riêng nó.

Leaf chỉ render chuỗi nó được đưa. Composite chỉ sắp xếp những chuỗi nó được đưa. Cả hai đều **không
biết mình đang ở ngôn ngữ nào**, và vì thế không thể bị bản dịch về muộn làm cho sai.

Câu hỏi phân định mọi trường hợp:

> Một người đọc ở ngôn ngữ khác có nhìn thấy thứ khác ở đây không?

Nếu có — đó là copy, và copy được resolve ở một file phía trên.

**Đây là luật bắt buộc.** Mọi chuỗi người đọc nhìn thấy hoặc nghe thấy đều rơi vào đúng một mã dưới
đây, kể cả những chuỗi không trông giống câu. Một chữ `alt` duy nhất vẫn là `COPY-2`, đúng cùng lý do
mà cả một đoạn văn là `COPY-2`. Câu "có mỗi một chữ thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `COPY-1` | Nửa connected sở hữu request chọn câu đúng cho tình huống nó vừa settle | Chữ được resolve tại đó |
| `COPY-2` | Tier dưới block đang ôm một literal người đọc thấy hoặc nghe | Nhấc chuỗi lên nửa connected |
| `COPY-3` | Có ý định truyền `labelKey` xuống cho con tự tra | Truyền chuỗi đã resolve |
| `COPY-4` | Chữ đã resolve rồi thì đi đường nào xuống | Đi trong `props`, như mọi value khác |
| `COPY-5` | File trong thư mục locale bị đem ra soi luật "source viết bằng tiếng Anh" | Miễn theo **đường dẫn**, không xét từng file |
| `COPY-6` | Một chuỗi mà **chương trình so khớp**, không phải để người đọc đọc | Giữ nguyên, đánh dấu lý do ngay trên dòng đó |

---

## `COPY-1` — nửa connected chọn từng chữ

**Tình huống.** Block sở hữu request cũng sở hữu những chữ mô tả câu trả lời của request đó. Lý do
không phải là thói quen chia file: chỉ nửa đó mới biết người đọc đang ở tình huống nào — đang tải,
rỗng, lỗi, hay đã có số liệu — nên chỉ nó mới biết **câu nào là câu đúng**.

**Dấu hiệu nhận biết**

- File đang gọi một hook resolve chữ nằm cùng chỗ với hook gọi dữ liệu.
- Câu chữ đổi theo state: pending nói một kiểu, settled nói kiểu khác.
- Nửa còn lại nhận vào toàn `string` đã xong, không nhận id, không nhận điều kiện.

**Tự hỏi.** Ai là người biết tình huống này là tình huống nào? Chữ phải được chọn ở đúng chỗ đó.

**Ranh giới**

- ↔ `COPY-2`: `COPY-1` nói **chỗ chữ được chọn**; `COPY-2` nói **chỗ chữ không được phép có mặt**.
  Một leaf gọi hook dịch vi phạm `COPY-1`; một leaf viết thẳng `"Tìm khoá học"` vi phạm `COPY-2`. Hai
  lỗi khác nhau, hai cách sửa khác nhau.
- ↔ `COPY-3`: nếu nửa connected chọn **key** rồi đưa key xuống thì nó chưa quyết định gì cả — đó là
  `COPY-3`, không phải đã tuân thủ `COPY-1`.

**Tình huống nghiệp vụ hay gặp.** Hạn mức còn lại trong tuần · trạng thái đơn hàng · số ngày streak ·
thông báo lỗi thanh toán · nhãn của một tab phụ thuộc quyền · câu tóm tắt kết quả bài kiểm tra.

---

## `COPY-2` — dưới block thì không giữ chữ nào người đọc thấy

**Tình huống.** Một leaf, composite, branch hay shell đang chứa literal mà người đọc nhìn thấy hoặc
**nghe thấy**. Không chỉ trong nội dung: `aria-label`, `placeholder`, `title`, `alt` là bốn chỗ copy
trốn nhiều nhất, vì khi lướt file thì cả bốn đều **không trông giống một câu**.

`aria-label` không phải trường hợp nhỏ. Screen reader đọc nó như **văn bản chính**, nên một nhãn
tiếng Anh nằm trên một màn hình tiếng Việt là lỗi to nhất trang, rơi đúng vào người ít có cách xoay
xở nhất.

**Dấu hiệu nhận biết**

- Chuỗi có dấu cách và bắt đầu bằng chữ hoa — trông như một câu người ta nói ra.
- File nằm dưới `leaves/`, `composites/`, `branches/`, `shells/`.
- Xoá chuỗi đi thì component vẫn dựng được, chỉ là không còn chữ.

**Tự hỏi.** Người đọc ở ngôn ngữ khác có thấy đúng chuỗi này không? Screen reader có đọc nó lên không?

**Ranh giới**

- ↔ `COPY-1`: xem trên.
- ↔ `COPY-6`: một chuỗi mà **chương trình** so khớp thì không phải copy, kể cả khi nó lọt vào tier
  này. Phân định bằng câu hỏi: có đoạn code nào **so sánh** với chuỗi này không?
- Token không phải copy: `"search"` trong `name="search"` là tên icon, không có dấu cách, không ai
  đọc nó lên.

**Tình huống nghiệp vụ hay gặp.** Placeholder ô tìm kiếm · `aria-label` nút đóng modal · `alt` của
ảnh khoá học · `title` của nút icon-only · chữ "Không có dữ liệu" trong empty state của một
composite · nhãn "Xem thêm" trong branch phân trang.

---

## `COPY-3` — key không được vượt biên

**Tình huống.** Có người định truyền `labelKey="quest.title"` xuống, coi như thế là đã "tách i18n ra
ngoài". Không phải: nó **dời chỗ tra cứu**, chứ không dời **quyết định**. Con vẫn phải tra, nên con
vẫn cần toàn bộ runtime dịch mới render được — và như vậy nó không còn dựng được từ một fixture.

**Dấu hiệu nhận biết**

- Prop có tên kết thúc bằng `Key`, `I18nKey`, `MessageId`, và giá trị của nó là một đường dẫn có dấu
  chấm.
- Con phải import hàm tra từ điển để hiển thị được prop mình nhận.
- Test của con phải mount provider ngôn ngữ mới chạy.

**Tự hỏi.** Con có phải tra thêm một bước nữa mới ra chữ không? Nếu có — key đang vượt biên.

**Ranh giới**

- ↔ `COPY-4`: `COPY-4` nói chữ **đã resolve** đi trong `props`; `COPY-3` cấm thứ **chưa resolve** đi
  cùng đường đó. Cùng một đường ống, hai loại hàng khác nhau.
- **Không phải mọi prop tên `*Key` đều vi phạm.** `selectedKey` của một tab hay một hàng danh sách là
  **định danh**, không phải mục từ điển: không có gì phải tra để render nó. Phân định bằng việc hỏi
  key đó tra vào đâu — vào từ điển, hay vào chính danh sách đang render.

**Tình huống nghiệp vụ hay gặp.** `labelKey` cho nút · `emptyMessageId` cho danh sách rỗng ·
`errorKey` cho form · một mảng `{ id, labelKey }` cho menu — mảng là chỗ key hay đi lậu nhất, vì nó
trông như dữ liệu.

---

## `COPY-4` — chữ đã resolve là một value, nên theo đúng hàng rào dữ liệu

**Tình huống.** Sau khi nửa connected chọn xong, chuỗi đó **không còn là chuyện ngôn ngữ nữa**. Nó là
một value như số dư hay tên file, và nó đi đúng con đường mọi value khác đi: `props`.

Đây là mã đổi lấy một thứ cụ thể chứ không phải một nguyên tắc thẩm mỹ: nhờ nó, một component render
được từ fixture với chữ `"anything"` và vẫn đúng. Cái test không cần từ điển chính là bằng chứng chữ
đã đến bằng đường value.

**Dấu hiệu nhận biết**

- Kiểu của prop là `string`, không phải union của key.
- Test dựng component bằng chuỗi bịa, không mount provider nào.
- Đổi từ điển không làm test đổi.

**Tự hỏi.** Nếu xoá sạch từ điển khỏi dự án, component này còn render được không?

**Ranh giới**

- ↔ `COPY-3`: xem trên.
- ↔ `COPY-1`: `COPY-1` nói ai chọn; `COPY-4` nói chữ đi đường nào sau khi đã chọn. Một chữ resolve
  đúng chỗ nhưng chui xuống bằng context toàn cục thì vi phạm `COPY-4` chứ không vi phạm `COPY-1`.

**Tình huống nghiệp vụ hay gặp.** Nhãn và giá trị của một stat row · tiêu đề empty state · nội dung
toast sau khi submit · nhãn cột của bảng · chuỗi đã format sẵn số và đơn vị.

---

## `COPY-5` — từ điển chính là ngôn ngữ kia, nên nó không phải source

**Tình huống.** Luật "source viết bằng tiếng Anh" tồn tại để một người vào dự án sau một năm vẫn đọc
được mọi dòng. Từ điển thì ngược lại: **nội dung của nó buộc phải là ngôn ngữ kia**. Đem luật đó soi
vào thư mục locale là đọc sai cả hai luật.

**Dấu hiệu nhận biết**

- File nằm trong thư mục locale, đuôi `.json`, mỗi khoá là một câu.
- Không có logic nào trong file — chỉ có chữ.

**Tự hỏi.** File này là **tác quyền** (người ta viết code ở đây) hay là **nội dung** (người ta viết
chữ cho người đọc ở đây)?

**Ranh giới**

- Miễn trừ này là một **đường dẫn**, không phải một phán đoán. Đó là quyết định đắt nhất của mã này:
  một miễn trừ dựa trên phán đoán sẽ bị đem ra cãi ở từng file, mãi mãi.
- ↔ `COPY-6`: từ điển được miễn vì nó **là nội dung**; chuỗi matched được giữ vì **chương trình so
  khớp nó**. Hai lý do khác hẳn nhau, đừng gộp.
- Fixture và spec cũng được miễn theo đường dẫn, vì một fixture tái hiện chuỗi thật phải tái hiện
  đúng nguyên văn.

**Tình huống nghiệp vụ hay gặp.** File từ điển từng ngôn ngữ · fixture dựng lại nguyên văn payload
của server · snapshot test giữ nguyên chữ hiển thị.

---

## `COPY-6` — chữ mà **chương trình** so khớp thì không phải copy

**Tình huống.** Server gửi xuống một trạng thái, và màn hình **so sánh** với chuỗi đó để quyết định
render nhánh nào. Dịch nó là làm hỏng phép so sánh — và cái hỏng đó **im lặng**: không có lỗi
TypeScript, không có exception, chỉ có một nhánh không bao giờ chạy nữa.

Nên chuỗi đó ở nguyên, và **được đánh dấu ngay trên dòng của nó cùng lý do**. Dấu đó không phải thủ
tục: nó là thứ nói cho người đọc sau biết đây là một **quyết định**, chứ không phải một chỗ ai đó
quên dịch.

**Dấu hiệu nhận biết**

- Có một phép `===`, một `switch`, hoặc một key của map, so vào đúng chuỗi này.
- Chuỗi đến từ ngoài hệ thống: server, webhook, cổng thanh toán, một enum của bên thứ ba.
- Đổi chuỗi này phải đổi cả phía kia mới đúng.

**Tự hỏi.** Nếu ngày mai từ điển đổi chữ này, phép so sánh còn đúng không? Nếu không — đây là value,
không phải copy.

**Ranh giới**

- ↔ `COPY-2`: cùng là một literal nằm trong source, nhưng `COPY-2` nói về chuỗi **người đọc** đọc,
  còn `COPY-6` nói về chuỗi **chương trình** đọc. Một chuỗi vừa được so khớp vừa được hiển thị thì
  phải tách làm hai: giá trị để so, và chữ để hiện.
- ↔ `COPY-5`: xem trên.
- Dấu **không** biến một chuỗi copy thành value. Đánh dấu một câu chỉ để nó lọt qua cổng ngôn ngữ là
  dùng sai mã này, và không có gì trong hệ thống phát hiện được — xem `audit.md`.

**Tình huống nghiệp vụ hay gặp.** Trạng thái đơn hàng server gửi verbatim · mã lỗi của cổng thanh
toán · tên phương thức thanh toán dùng làm khoá map · giá trị enum trong query string · tên sự kiện
analytics.

---

## Luật

1. Nửa sở hữu request chọn từng chữ mô tả câu trả lời của nó.
2. Component dưới block không giữ literal nào người đọc thấy hoặc nghe — kể cả trong `aria-label`,
   `placeholder`, `title`, `alt`.
3. Chuỗi đã resolve thì vượt biên; key thì không.
4. Chuỗi đã resolve là value, đi trong `props`.
5. Nửa drawing phải render đúng khi không có từ điển nào trong dự án.
6. Thư mục locale là nội dung, miễn theo đường dẫn.
7. Chuỗi chương trình so khớp thì giữ nguyên và đánh dấu lý do trên chính dòng đó.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
dụng vào.

- **Nội dung locale (`COPY-5`).** File trong thư mục locale là ngôn ngữ kia. Miễn theo đường dẫn.
- **Fixture và spec (`COPY-2`, `COPY-4`).** Tái hiện chuỗi thật thì phải giữ nguyên văn; dịch đi là
  đang test một thứ khác. Cũng miễn theo đường dẫn.
- **Giá trị matched (`COPY-6`).** Giữ nguyên, đánh dấu lý do trên dòng.
- **Key không phải key từ điển (`COPY-3`).** `selectedKey` của tab hay hàng danh sách là định danh,
  vượt biên tự do vì không phải tra gì để render.
- **Token không phải chữ (`COPY-2`).** Tên icon, tên variant, tên recipe là định danh nội bộ: không
  dấu cách, không ai đọc lên, không đổi theo ngôn ngữ.
