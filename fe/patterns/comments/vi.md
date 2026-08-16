---
id: fe-patterns-comments-vi
title: vi.md
slug: /fe/patterns/comments/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống COMMENTS-N, nhận diện bằng nghiệp vụ đọc code chứ không bằng cảm giác "viết cho đẹp".
---

# vi.md

> Version: `2.00` · Module: `comments`

# Comments

Comment là **thứ code không tự nói được về chính nó**. Code đã nói *cái gì đang xảy ra*; comment nói
*vì sao lại làm theo cách đó*, *bỏ đi thì hỏng chỗ nào*, và *phương án nào đã bị từ chối*.

Hai câu hỏi quyết định tất cả:

> Một người lạ chỉ đọc code có tự rút ra được kết luận này không?

Nếu có — comment đó thừa.

> Một người không cùng tiếng mẹ đẻ với người viết có đọc được dòng này không?

Nếu không — dòng đó **chưa được viết xong**.

**Đây là luật bắt buộc.** Phạm vi không phải là "comment". Phạm vi là **mọi chỗ trong file mà chữ
nghĩa có thể trốn vào**: block comment, line comment, tên biến, string literal, mảnh template, chữ
trong JSX, và câu thông báo lỗi. Một luật chỉ soi comment nhìn thì có vẻ chạy, còn câu văn nó được
viết ra để chặn thì chỉ đơn giản là **dời xuống một dòng**, thành một cái tên.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tầng giữ |
|---|---|---|
| `COMMENTS-1` | Một thứ được export ra ngoài file — hợp đồng của nó bị đọc nhiều hơn bị viết | `enforced` · `starci-fe/require-export-jsdoc` |
| `COMMENTS-2` | Chữ nghĩa trong source, ở bất kỳ vị trí nào | `enforced` · `starci-fe/no-second-language-in-source` |
| `COMMENTS-3` | Ba ngoại lệ: nội dung locale, fixture, literal chức năng có đánh dấu | `enforced` (một nửa) · cùng rule trên |
| `COMMENTS-4` | Pictograph Unicode trong source | `enforced` · `starci-fe/no-emoji-in-source` |
| `COMMENTS-5` | Comment chỉ đọc lại dòng bên dưới | `documented` |
| `COMMENTS-6` | Comment phải tranh luận với một quyết định | `documented` |

---

## `COMMENTS-1` — mọi export mở đầu bằng một khối tài liệu

**Tình huống.** Một thứ được `export` là một thứ **file khác phụ thuộc vào**. Hợp đồng của nó bị đọc
nhiều hơn hẳn số lần bị viết, và bị đọc bởi những người **sẽ không bao giờ mở phần thân ra xem**. Khối
tài liệu nói **VAI TRÒ** — đây là cái gì, dùng để làm gì, người nhận kết quả phải làm gì với nó —
chứ không đọc lại chữ ký, vì chữ ký đã tự nói rồi và nó không bao giờ lạc hậu.

**Dấu hiệu nhận biết**

- Có từ khoá `export` trước khai báo.
- Người gọi nó nằm ở file khác, thường là ở tầng khác.
- Bạn đang phải mở phần thân ra mới biết trả về `null` thì nghĩa là gì.

**Tự hỏi.** Người gọi hàm này, nếu không mở thân hàm, có biết phải làm gì với giá trị trả về không?

**Ranh giới**

- ↔ `COMMENTS-5`: một khối chỉ chép lại chữ ký (`@param name - The name`) **là** một restatement.
  Nó rơi vào `COMMENTS-5` và bị **xoá**, không phải "viết cho hay hơn".
- ↔ helper nội bộ: helper không export **không bắt buộc** có khối. Bắt buộc mọi helper phải có khối
  sẽ đẻ ra một file mà nửa số dòng là nghi thức, và khi ấy **không khối nào còn được đọc**.
- ↔ `export { X }`: re-export không có khai báo nào để tài liệu hoá. Hợp đồng nằm ở chỗ `X` được khai
  báo, không nằm ở dòng re-export.

**Tình huống nghiệp vụ hay gặp.** Component export ra ngoài · custom hook · type/interface công khai ·
hằng số cấu hình · hàm định dạng dữ liệu · adapter gọi API · guard/validator · barrel file.

---

## `COMMENTS-2` — source viết bằng tiếng Anh, theo chuẩn người lạ

**Tình huống.** Comment, JSDoc, **tên biến** và **câu thông báo lỗi** đều là chữ nghĩa. Chuẩn không
phải là "cả đội hiểu là được" — chuẩn là **một người vào làm sau một năm, không cùng tiếng mẹ đẻ với
người viết dòng đó**.

Vì sao khắt khe đến vậy: một codebase có hai ngôn ngữ thì có **hai nhóm người đọc**, và nhóm nhỏ hơn
sẽ **im lặng ngừng đọc** đúng những phần họ không đọc được. Không ai báo cáo việc đó cả.

**Dấu hiệu nhận biết**

- Chữ có dấu ở bất kỳ đâu trong file authoring.
- Câu văn vừa bị "dời" từ comment sang tên biến, tên hàm, hoặc key của object.
- Thông báo lỗi hiển thị cho người trực hệ thống, không phải cho người viết ra nó.

**Tự hỏi.** Nếu người đọc dòng này là người trực on-call lúc 2 giờ sáng, họ có đọc được không?

**Ranh giới**

- ↔ `COMMENTS-3`: nếu chuỗi đó là **giá trị chương trình thật sự khớp hoặc phát ra** thì nó không phải
  chữ nghĩa — nó là dữ liệu, và nó ở lại kèm dấu.
- ↔ `COMMENTS-5`: `COMMENTS-2` hỏi *đọc được không*; `COMMENTS-5` hỏi *có đáng đọc không*. Một comment
  tiếng Anh chỉ chép lại dòng dưới vẫn bị xoá.

**Ghi chú về rule.** Rule đang cho `Tiếng Việt` — endonym mà một bộ chọn ngôn ngữ buộc phải hiển thị
đúng chữ của chính nó — đi qua. Luật ở `INDEX.md` chỉ nêu **ba** ngoại lệ, nên chênh lệch này được ghi
ở [`audit.md`](./audit.md) chứ không được lặng lẽ thêm vào luật thành ngoại lệ thứ tư.

**Tình huống nghiệp vụ hay gặp.** Comment giải thích quy tắc nghiệp vụ · tên biến theo nghiệp vụ nội
địa · message trong `throw` · log · tên key trong object cấu hình · text trong JSX viết cứng · chuỗi
trong template literal.

---

## `COMMENTS-3` — ba ngoại lệ, và mỗi ngoại lệ tự nói ra ở chỗ nó áp dụng

**Tình huống.** Có đúng **ba** chỗ mà ngôn ngữ thứ hai không phải là lỗi:

1. **Nội dung locale.** Từ điển dịch **CHÍNH LÀ** ngôn ngữ kia. Bắt nó theo `COMMENTS-2` là làm rỗng
   sản phẩm.
2. **Fixture của test.** Fixture tái tạo một chuỗi có thật thì phải tái tạo **đúng nguyên văn**, nếu
   không nó đang test một thứ khác.
3. **Literal chức năng.** Một giá trị mà chương trình đang chạy **khớp vào hoặc phát ra** — đó là dữ
   liệu, không phải văn xuôi. Nó ở lại, và **được đánh dấu trên chính dòng của nó, kèm lý do**.

**Dấu vết bắt buộc.** Cái dấu chính là toàn bộ ý nghĩa của ngoại lệ thứ ba. Một literal không đánh dấu
thì **không phân biệt được** với một comment ai đó quên dịch — nên người đọc phải tự đoán, và người
đọc tiếp theo đoán khác đi.

**Dấu hiệu nhận biết**

- File nằm trong đường dẫn nội dung: từ điển locale, thư mục resources, fixture, `.test.*`, `.spec.*`.
- Chuỗi được so sánh bằng `===`, dùng làm key, hoặc gửi thẳng ra ngoài hệ thống.

**Tự hỏi.** Nếu dịch chuỗi này sang tiếng Anh, chương trình có chạy sai không? Nếu **có** — nó là
literal chức năng. Nếu **không** — nó là văn xuôi, và nó phải là tiếng Anh.

**Ranh giới**

- ↔ `COMMENTS-2`: ngoại lệ là **đường dẫn và dấu**, không phải **phán đoán**. Một ngoại lệ dựa trên
  phán đoán sẽ bị tranh cãi lại ở từng file, mãi mãi, và phần thắng luôn thuộc về người đang vội.
- ↔ `COMMENTS-4`: file nội dung được miễn ngôn ngữ, nhưng luật **không** miễn pictograph cho locale
  data. Rule hiện tại miễn cả hai; xem [`audit.md`](./audit.md).

**Tình huống nghiệp vụ hay gặp.** Từ điển `messages/*.json` · thư mục resources · fixture tái tạo
payload thật · mã trạng thái server trả về nguyên văn · tên riêng của một tổ chức trong hợp đồng ·
chuỗi so khớp với hệ thống bên thứ ba.

---

## `COMMENTS-4` — không có emoji Unicode trong source

**Tình huống.** Không có trong tên biến, comment, thông báo lỗi, hay chuỗi không phải nội dung. Một
pictograph **render khác nhau trên mọi nền tảng**, **sắp xếp không lường trước được**, **làm vỡ một
terminal không chờ đợi nó**, và **mang nghĩa không giống nhau ở hai quốc gia**.

**Dấu hiệu nhận biết**

- Một ký tự hình vẽ nằm trong chuỗi log, chuỗi thông báo, hoặc chữ trong JSX.
- Một cặp regional-indicator (cờ) — thứ mà phép thử một-pictograph bỏ sót.

**Tự hỏi.** Ký hiệu này đang mang nghĩa gì, và nghĩa đó có ổn định khi đổi nền tảng, đổi ngôn ngữ,
đổi quốc gia không?

**Thay bằng gì**

- Ký hiệu giao diện chung → **bộ từ vựng icon**.
- Reaction của sản phẩm → **artwork SVG đã check-in, có ghi nguồn**, đi qua leaf chuyên trách
  reaction. Đây là trường hợp hẹp hơn và là trường hợp duy nhất, chứ không phải một cửa mở.

**Ranh giới**

- ↔ `COMMENTS-3`: file nội dung được miễn *ngôn ngữ*. Luật nói pictograph **không** được miễn kể cả
  trong locale data — đây là chỗ luật và rule đang lệch nhau, ghi ở [`audit.md`](./audit.md).

**Tình huống nghiệp vụ hay gặp.** Log "đã xong" · badge trạng thái · nút reaction · tiêu đề section ·
message commit sinh ra từ code · thông báo lỗi cho người dùng cuối · chuỗi trong CLI.

---

## `COMMENTS-5` — comment chép lại dòng bên dưới thì **xoá**, không sửa

**Tình huống.** `// tăng biến đếm` đứng trên một phép tăng: tốn một dòng và không dạy được gì. Nhưng
nó **tệ hơn mức vô hại**: một người đọc gặp ba comment loại đó sẽ **thôi đọc cái thứ tư** — đúng cái
nói vì sao biến đếm được reset vào Chủ nhật.

**Dấu hiệu nhận biết**

- Xoá comment đi, không thông tin nào mất.
- Comment dùng đúng những từ có sẵn trong tên hàm và tên biến ngay dưới nó.
- Comment mô tả **cơ chế** (`gọi API`, `lặp qua mảng`) chứ không mô tả **nguyên nhân**.

**Tự hỏi.** Xoá dòng comment này đi thì người đọc mất mát cái gì? Nếu câu trả lời là "không gì cả" —
đó là câu trả lời, hãy xoá.

**Ranh giới**

- ↔ `COMMENTS-1`: một khối tài liệu chép lại chữ ký cũng là restatement. `COMMENTS-1` đòi **có** khối;
  `COMMENTS-5` quyết định khối ấy có được **giữ** không.
- ↔ `COMMENTS-6`: nếu bạn thấy mình đang muốn viết dài để bảo vệ dòng code — đó không phải restatement
  nữa, đó là `COMMENTS-6`, và hãy viết.

**Vì sao là "xoá" chứ không phải "viết lại".** Viết lại một restatement thành một restatement hay hơn
vẫn bảo toàn chi phí: người đọc vẫn phải đọc nó để phát hiện ra nó không nói gì. Chi phí nằm ở **sự
tồn tại**, không nằm ở chất lượng câu chữ.

**Tình huống nghiệp vụ hay gặp.** Comment sinh tự động trên getter/setter · `// handle click` trên
`onClick` · `@param` chép lại tên tham số · comment tiêu đề ngăn cách các phần trong file đã có cấu
trúc rõ · comment mô tả một `map` là "duyệt mảng".

---

## `COMMENTS-6` — comment phải tranh luận là đang tranh luận với một quyết định, và nêu tên nó

**Tình huống.** Những comment đáng giữ là những comment **ghi lại một lần từ chối**: đã thử gì, cái đó
tốn gì, và vì sao hình dạng hiển nhiên lại **sai ở chỗ này**. Đó chính xác là những thứ mà nếu không
ghi, người đọc tiếp theo sẽ **hoàn tác**.

Không phải vì họ ẩu. Mà vì đứng từ phía họ, code đang ở một hình dạng lạ và không có lý do nào giải
thích — và "dọn cho gọn" là phản xạ đúng đắn của một kỹ sư tốt.

**Dấu hiệu nhận biết**

- Có một cách viết ngắn hơn/rõ hơn mà bạn **cố ý không dùng**.
- Có một workaround, một thứ tự thực thi bắt buộc, một hằng số "trông tuỳ tiện".
- Có một lần đã sửa theo cách hiển nhiên rồi phải quay lại.

**Tự hỏi.** Nếu ngày mai có người refactor chỗ này theo cách hiển nhiên nhất, họ sẽ làm hỏng cái gì —
và code có nói cho họ biết không?

**Bốn thứ một comment loại này phải có**

1. Hình dạng hiển nhiên là gì.
2. Vì sao nó sai **ở đây** — bằng một tình huống hỏng cụ thể, không phải bằng tính từ.
3. Cái giá đã trả để biết điều đó, nếu có.
4. Điều gì sẽ khiến quyết định này hết hiệu lực.

**Ranh giới**

- ↔ `COMMENTS-5`: `COMMENTS-5` xoá thứ không nói gì; `COMMENTS-6` **bắt viết** thứ chỉ có bạn biết.
  Hai mã này không mâu thuẫn — chúng cùng nói một câu: **chỉ chữ nghĩa mang thông tin mới được ở lại**.
- ↔ `COMMENTS-1`: khối tài liệu nói vai trò cho người **gọi**; comment `COMMENTS-6` nói lý do cho người
  **sửa**. Một khối đầu file không thay được một comment tại đúng dòng lạ.

**Tình huống nghiệp vụ hay gặp.** Workaround cho lỗi của thư viện bên ngoài · thứ tự effect bắt buộc ·
số ma thuật đến từ giới hạn của hệ thống bên ngoài · một `any` được cân nhắc · nơi cố ý không memo hoá ·
nơi cố ý gọi tuần tự thay vì song song · một truy vấn viết "kém tối ưu" để tránh một khoá.

---

## Luật

1. Mọi `export` mở đầu bằng một khối tài liệu; khối đó nói **vai trò**, không đọc lại chữ ký.
2. Helper nội bộ **không** bắt buộc có khối.
3. Mọi vị trí chữ nghĩa trong file authoring là tiếng Anh: comment, JSDoc, tên, literal, template,
   chữ JSX, thông báo lỗi.
4. Dời một câu từ comment sang một cái tên **không** phải là dịch nó.
5. Ngoại lệ có đúng **ba**, đóng, và là **đường dẫn cộng một dấu**, không phải phán đoán.
6. Literal chức năng ở lại **kèm lý do trên chính dòng của nó**.
7. Không pictograph Unicode ở vị trí authoring. Ký hiệu chung dùng bộ từ vựng icon; reaction dùng
   artwork đã check-in qua leaf reaction.
8. Comment chép lại dòng bên dưới thì **xoá**.
9. Comment ghi lại một lần từ chối thì **nêu tên quyết định** đó.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đóng và nêu rõ mã nó áp dụng.

- **Nội dung locale** (`COMMENTS-3`). Từ điển dịch chính là ngôn ngữ kia.
- **Fixture** (`COMMENTS-3`). Tái tạo nguyên văn, nếu không là test thứ khác.
- **Literal chức năng có đánh dấu** (`COMMENTS-3`). Dấu nằm trên dòng của nó và mang lý do.
- **Helper nội bộ** (`COMMENTS-1`). Không bắt buộc khối tài liệu.
- **Re-export** (`COMMENTS-1`). `export { X }` không có khai báo để tài liệu hoá.
- **Ngoại lệ là đường dẫn, không phải phán đoán** (`COMMENTS-3`). Đây là ngoại lệ về *hình thức của
  ngoại lệ*: nó tồn tại để chặn ngoại lệ thứ tư mọc ra từ một cuộc tranh luận.
