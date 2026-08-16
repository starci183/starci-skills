---
id: fe-patterns-typography-vi
title: vi.md
slug: /fe/patterns/typography/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống TYPESET-N, nhận diện bằng quyền sở hữu nội dung chứ không bằng mắt.
---

# vi.md

> Version: `2.00` · Module: `typography`

# Typography

Chữ mang **thứ bậc**. Cỡ chữ, độ đậm và tông màu không phải ba lựa chọn độc lập — cộng lại chúng nói
cho người đọc biết **thứ gì trên màn hình là quan trọng nhất**, và người đọc quyết định nhìn vào đâu
trước khi kịp đọc một chữ nào.

Vì vậy thang chữ nhỏ, và các bậc đi **theo cặp** chứ không tự do. Một heading không phải là "một cỡ
cộng một độ đậm chọn cùng nhau"; nó là một **cấp**, và cấp quyết định cả hai — kể cả cái tag mà trình
đọc màn hình dùng để dựng outline.

Đừng hỏi "chữ này nên to cỡ nào". Hãy hỏi:

> Dòng này **sở hữu** cái gì?

Sở hữu một trang hay một section thì nó là heading. Sở hữu một object quan trọng thì nó là title. Chỉ
bổ nghĩa cho một dòng khác thì nó là supporting copy. Còn "trông cho nó nổi" không phải một loại sở
hữu.

**Đây là luật bắt buộc.** Mọi dòng chữ render ra đều rơi vào đúng một mã dưới đây. Không có dòng nào
ngắn tới mức được miễn: một category ba chữ nằm trên tên card là `TYPESET-5`, cũng vì lý do đó mà
tên trang là `TYPESET-1`. Câu "có mỗi cái label thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, vì một
dòng ngắn chính là chỗ người viết với tay lấy đại cỡ chữ nào nhìn thuận mắt.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `TYPESET-1` | Một dòng là **tên** của trang hoặc của một section | Heading component, truyền `level` |
| `TYPESET-2` | Cần cấp heading thứ năm | Không có bậc đó — làm phẳng section |
| `TYPESET-3` | Muốn một dòng được chú ý hơn | Cỡ, độ đậm, tông — **không** phải khung viền |
| `TYPESET-4` | Nhiều thứ cùng tranh sự chú ý | Hạ những thứ xung quanh xuống |
| `TYPESET-5` | Eyebrow, count, category, meta đi kèm một title | Nhỏ hơn hoặc nhẹ hơn title, không bao giờ ngang |
| `TYPESET-6` | Muốn heading đậm hơn | Cấp đã quyết độ đậm; không có trục thứ hai |
| `TYPESET-7` | Copy phụ trợ 12px | Luôn đi kèm tông muted |
| `TYPESET-8` | "Hôm nay", "Hôm qua" chia nhóm kết quả | Subtitle 14px muted, đặt ngoài surface |
| `TYPESET-9` | Chọn 16px hay 14px cho một title trong body | Theo chủ sở hữu nội dung, không theo hover hay chỗ trống |

---

## `TYPESET-1` — heading là một cấp, và cấp quyết định cả tag lẫn dáng

**Tình huống.** Một dòng **đặt tên** cho trang hoặc cho một section. Cái tag mà trình đọc màn hình
dùng để dựng outline, và cái cỡ mà mắt người đọc thấy, là **hai sự thật của cùng một thứ**.

**Dấu hiệu nhận biết**

- Bỏ dòng này đi thì phần bên dưới mất tên gọi, chứ không mất nội dung.
- Nó xuất hiện trong mục lục của trang nếu trang có mục lục.
- Người ta hay viết nó bằng một tag `h*` gõ tay kèm vài class cỡ chữ.

**Tự hỏi.** Nếu một người mù nghe outline của trang này, dòng này có nằm trong outline không? Nếu
có — nó là heading, và cấp của nó phải do một prop quyết định.

**Ranh giới**

- ↔ `TYPESET-9`: title của một card **không** nhất thiết là heading. Câu hỏi phân định là outline, chứ
  không phải độ to.
- ↔ `TYPESET-8`: một nhãn thời gian **không** phải heading dù nó đứng trên cả nhóm kết quả.

Viết tag và viết cỡ ở hai chỗ thì chúng **trôi ra khỏi nhau**: dòng chữ to thứ ba trên màn hình trở
thành heading đầu tiên của tài liệu, và outline thôi mô tả trang. Một prop quyết cả hai thì chúng
không thể mâu thuẫn.

**Tình huống nghiệp vụ hay gặp.** Tên trang · tên section trong dashboard · tên card danh mục · tiêu
đề panel · tiêu đề dialog · tên nhóm trong trang cài đặt.

---

## `TYPESET-2` — bốn cấp, và cấp thứ năm nghĩa là trang đã lồng quá sâu

**Tình huống.** Ai đó cần một heading nhỏ hơn cấp bốn, vì bên trong một section đã có section, mà bên
trong nữa lại còn một nhóm nữa.

**Dấu hiệu nhận biết**

- Yêu cầu đến dưới dạng "cho mình thêm một bậc nhỏ nữa".
- Trong cây DOM đã có ba tầng heading trước khi tới nội dung thật.
- Người viết định thay thế bằng một dòng body in đậm cho "giống heading cấp năm".

**Tự hỏi.** Đây là vấn đề **cỡ chữ**, hay là vấn đề **cấu trúc** đang mặc áo của vấn đề cỡ chữ?

**Ranh giới**

- ↔ `TYPESET-1`: `TYPESET-1` nói heading phải đến từ một cấp; `TYPESET-2` nói tập hợp các cấp là
  đóng.
- ↔ `TYPESET-6`: đừng giải quyết bằng cách cho heading cấp 4 một độ đậm khác — đó là vi phạm khác.

Câu trả lời **không phải** một bậc nhỏ hơn. Câu trả lời là section đã lồng sâu hơn mức một người đọc
giữ nổi trong đầu, nên hãy làm phẳng nó rồi mới đặt tên.

**Tình huống nghiệp vụ hay gặp.** Trang cài đặt nhiều nhóm lồng nhau · tài liệu có mục con của mục
con · form dài chia nhóm nhiều tầng · trang khoá học có chương trong chương.

---

## `TYPESET-3` — thứ bậc đến từ cỡ, độ đậm, tông; không bao giờ từ một cái khung

**Tình huống.** Một dòng cần được chú ý, và phản xạ đầu tiên là vẽ quanh nó một cái viền, một nền
màu, hoặc bỏ nó vào một cái chip.

**Dấu hiệu nhận biết**

- Cái khung không tương ứng với một trạng thái nào cả — nó chỉ ở đó để "nổi".
- Trên cùng một surface đã có sẵn vài cái khung tương tự.
- Bỏ khung đi thì thông tin **không** mất gì, chỉ bớt nổi.

**Tự hỏi.** Cái khung này đang nói lên **sự thật** gì mà cỡ, độ đậm và tông không nói được?

**Ranh giới**

- ↔ `TYPESET-4`: `TYPESET-3` cấm một loại phương tiện; `TYPESET-4` chỉ ra hướng đi đúng khi cả hai
  bên đều muốn nổi.
- ↔ trạng thái: một chip nói "đã hoàn thành" hay "còn 3 ngày" **không** thuộc mã này — nó vẽ một sự
  thật, không phải một thứ bậc.

Khi một surface đã dạy người đọc rằng những cái khung ở đây chẳng có nghĩa gì, thì **cái khung thật
sự có nghĩa cũng trở nên vô hình**. Đó là cái giá mà người vẽ khung đầu tiên không phải trả.

**Tình huống nghiệp vụ hay gặp.** Badge category trên card · viền quanh giá tiền · nền màu cho một
dòng metric · chip bọc tên tác giả · box quanh một câu mô tả.

---

## `TYPESET-4` — thứ gì đang tranh chú ý thì hạ hàng xóm của nó xuống

**Tình huống.** Hai ba thứ trên cùng một surface cùng muốn được nhìn thấy trước, và cách sửa quen tay
là nâng cái quan trọng nhất lên một bậc.

**Dấu hiệu nhận biết**

- Diff chỉ tăng cỡ hoặc tăng độ đậm, không hạ thứ gì cả.
- Trên surface đó số dòng ở tông mặc định nhiều hơn số dòng muted.
- Lần sửa trước cũng đã tăng một bậc, vì cùng một lý do.

**Tự hỏi.** Mình đang làm cái này **to lên**, hay đang làm những cái quanh nó **im đi**?

**Ranh giới**

- ↔ `TYPESET-3`: nếu đang định nâng bằng một cái khung thì đó là `TYPESET-3`.
- ↔ `TYPESET-5`: nếu cái đang tranh chú ý là **dòng phụ của chính title đó** thì đó là `TYPESET-5`, và
  hạ nó xuống là bắt buộc chứ không phải một lựa chọn.

Nhấn mạnh là chuyện **tương đối**. Nâng cái quan trọng lên tức là nâng sàn cho mọi thứ, và tác giả kế
tiếp lại nâng tiếp. Phần lớn lỗi thứ bậc được giải quyết sớm hơn một bước, ở chỗ hạ mọi thứ xung
quanh xuống. Thang chữ ở đây cố tình có **trần thấp** để việc leo lên là không rẻ.

**Tình huống nghiệp vụ hay gặp.** Card có cả tên, giá, số học viên và nhãn khuyến mãi · row danh sách
có bốn dữ kiện · toolbar có ba nút đều muốn là primary · dashboard nhiều ô số liệu.

---

## `TYPESET-5` — dòng phụ luôn xếp dưới title mà nó thuộc về

**Tình huống.** Một eyebrow, một con số đếm, một category, một dòng meta đứng cạnh hoặc dưới một
title. Nó **nói thêm** về title, nó không phải một đối tượng ngang hàng.

**Dấu hiệu nhận biết**

- Đọc riêng dòng phụ thì không biết nó nói về cái gì.
- Nó ngắn hơn title nhưng lại đang cùng cỡ với title.
- Nó đang được làm nổi để "cho có nhịp".

**Tự hỏi.** Nếu chỉ được đọc **một** dòng trong cụm này, người dùng cần đọc dòng nào? Dòng còn lại
phải xếp dưới.

**Ranh giới**

- ↔ `TYPESET-7`: nếu dòng phụ tụt xuống bậc 12px thì tông muted là bắt buộc — đó là `TYPESET-7`.
- ↔ `TYPESET-9`: `TYPESET-9` chọn bậc cho **title**; `TYPESET-5` chỉ ràng buộc **quan hệ** giữa title
  và dòng phụ của nó.

Chỉ đổi tông là **chưa đủ**: hai dòng cùng cỡ vẫn đòi cùng một thứ bậc kể cả khi một dòng đã xám.
Một card mà phần tử to nhất là cái nhãn category là một card **không ai đọc tên**, và đó là lỗi chứ
không phải một cách nhấn mạnh thành công.

**Tình huống nghiệp vụ hay gặp.** Category trên tên khoá học · "12 bài" dưới tên chương · tên tác giả
dưới tiêu đề bài viết · "còn 3 ngày" cạnh tên nhiệm vụ · đơn vị dưới một con số.

---

## `TYPESET-6` — độ đậm là trục của body text; heading không nhận thêm trục nào

**Tình huống.** Một heading trông chưa đủ mạnh, nên người viết thêm một class độ đậm, hoặc mong
component heading có prop `weight`.

**Dấu hiệu nhận biết**

- Có một class `font-*` đứng cạnh một heading.
- Có yêu cầu "cho heading cấp 3 đậm hơn ở màn này thôi".
- Hai màn hình có cùng cấp heading nhưng trông khác nhau.

**Tự hỏi.** Nếu cấp đã quyết độ đậm rồi, thì cái độ đậm mình sắp thêm đang **quyết lại** điều gì?

**Ranh giới**

- ↔ `TYPESET-9`: body text **có** trục độ đậm, và đó là chỗ hợp lệ duy nhất để dùng nó.
- ↔ `TYPESET-1`: một "heading" ghép từ cỡ to và độ đậm nặng không phải heading — outline không hề
  chứa nó, nên nó thuộc `TYPESET-1`.

Heading đã mang sẵn độ đậm như một phần của cấp. Đẩy thêm một độ đậm nữa là bắt **hai hệ thống cùng
quyết một việc**, và bên thua là cái mà người đọc nhìn thấy sau.

**Tình huống nghiệp vụ hay gặp.** Heading trong dialog · heading section muốn "mạnh như trang chủ" ·
tiêu đề card muốn đậm hơn tiêu đề bên cạnh.

---

## `TYPESET-7` — bậc 12px luôn có nghĩa là copy phụ trợ, và luôn muted

**Tình huống.** Cần một dòng nhỏ. Người viết coi 12px như "phiên bản gọn của chữ chính" và bảo toàn
tông foreground.

**Dấu hiệu nhận biết**

- Dòng 12px đang mang thông tin mà người dùng **phải** đọc mới làm được việc.
- Nó được chọn 12px vì chỗ đó hẹp, không phải vì nó phụ trợ.
- Nó đứng một mình, không kèm dòng chính nào để bổ nghĩa.

**Tự hỏi.** Nếu dòng này buộc phải giữ tông chính, nó có còn là copy phụ trợ nữa không? Nếu không —
nó phải ở lại 14px hoặc lớn hơn.

**Ranh giới**

- ↔ `TYPESET-8`: nhãn thời gian chia nhóm kết quả **ở lại 14px** dù cũng muted — nó chia vùng quét,
  không giải thích dòng nào cả.
- ↔ `TYPESET-5`: `TYPESET-5` nói dòng phụ phải xếp dưới; `TYPESET-7` nói **cái giá** của việc xuống
  tới 12px là tông muted, không thương lượng.

Cỡ và tông ở bậc này là **một** thứ bậc chứ không phải hai lựa chọn. Chỗ chật không phải một lý do
ngữ nghĩa: nếu chữ phải giữ tông chính thì nó đủ quan trọng để ở lại bậc trên.

**Tình huống nghiệp vụ hay gặp.** "55 phút trước" · caption dưới ảnh · "PDF · 2,4 MB" · dòng giải
thích dưới một ô nhập · dữ kiện bên phải một label 14px · ghi chú hạn mức.

---

## `TYPESET-8` — nhãn mốc thời gian là subtitle muted, không phải heading

**Tình huống.** Kết quả được chia theo ngày: "Hôm nay", "Hôm qua", "16/08/2026". Nhãn đó **định tính**
cho nhóm kết quả nằm ngay dưới nó.

**Dấu hiệu nhận biết**

- Nhãn được sinh ra từ dữ liệu, không phải từ cấu trúc trang.
- Số lượng nhãn thay đổi theo dữ liệu; hôm nay có ba, ngày mai có một.
- Bên dưới nó là một surface danh sách đã có nhãn riêng của surface đó.

**Tự hỏi.** Nếu dữ liệu trống đi, dòng này có biến mất không? Nếu có, nó không phải một section của
trang.

**Ranh giới**

- ↔ `TYPESET-1`: cho nó một cấp heading là **thăng chức nhầm** mỗi mốc thời gian thành một section
  của trang, và outline của trang sẽ dài ra theo dữ liệu.
- ↔ `TYPESET-7`: nó muted nhưng **không** xuống 12px, vì nó không giải thích dòng nào — nó chia vùng
  quét.

Nhãn nằm **ngoài** surface, và surface bên dưới được yêu cầu ẩn nhãn của chính nó đi, để một nhóm kết
quả không bị đặt tên hai lần bằng hai thứ bậc khác nhau.

**Tình huống nghiệp vụ hay gặp.** Feed hoạt động chia theo ngày · lịch sử giao dịch theo tháng · hộp
thư chia "Hôm nay / Tuần này" · nhật ký học tập · thông báo chia theo mốc.

---

## `TYPESET-9` — bậc của title trong body theo chủ sở hữu nội dung

**Tình huống.** Phải chọn giữa 16px medium và 14px medium cho một dòng title nằm trong body, không
phải heading.

**Dấu hiệu nhận biết**

- Lý do đang định dùng là "card này có hover", "đây là con số", hoặc "chỗ này còn rộng".
- Cùng một loại title xuất hiện lặp lại hàng chục lần trong một danh sách.
- Title dài tới mức xuống hai dòng khi ở bậc lớn.

**Tự hỏi.** Dòng này **đại diện cho một object quan trọng** đang được trưng bày, hay nó là một dòng
lặp lại trong một danh sách?

**Ranh giới**

- ↔ `TYPESET-1`: nếu nó nằm trong outline thì đừng chọn bậc body — nó là heading.
- ↔ `TYPESET-5`: mô tả, meta và giá trị thường của cùng object đó ở 14px normal, không phải medium.

16px medium thuộc về một title **ngắn, chiếm ưu thế**, đại diện cho một object quan trọng hoặc một
card lớn. Title gọn, lặp lại hoặc dài thì ở 14px medium; mô tả, metadata và giá trị thường của chúng
ở 14px normal. Hover có thể xác nhận rằng một surface bấm được, nhưng **không** thăng cấp chữ trong
đó. Một con số vẫn có thể chỉ là một giá trị thường, và chỗ trống không phải một thứ bậc ngữ nghĩa.

**Tình huống nghiệp vụ hay gặp.** Tên khoá học trên card lớn · tên bài trong danh sách chương · label
của accordion · tiêu đề row trong bảng số liệu · tên file trong danh sách · giá trị metric trong ô
thống kê.

---

## Luật

1. Heading đến từ component heading, và `level` quyết định **cả tag lẫn dáng**.
2. Thang heading có **bốn** cấp. Cần cấp thứ năm nghĩa là phải làm phẳng cấu trúc.
3. Body dùng 14px và 16px. Bậc 12px là bậc **hạn chế**, chỉ dành cho copy phụ trợ, và luôn muted.
4. Thứ bậc chỉ đi qua cỡ, độ đậm và tông. Khung viền, nền và chip không phải phương tiện của thứ bậc.
5. Muốn một thứ nổi lên thì **hạ hàng xóm xuống**, đừng nâng nó lên.
6. Dòng phụ luôn xếp dưới title của nó bằng cỡ hoặc độ đậm, không chỉ bằng tông.
7. Heading **không** nhận độ đậm riêng; độ đậm là trục của body text.
8. Nhãn mốc thời gian là subtitle 14px muted đặt ngoài surface, không phải heading.
9. Bậc title trong body theo chủ sở hữu nội dung, không theo hover, kiểu dữ liệu hay chỗ trống.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Mốc thời gian giữ 14px.** Thuộc `TYPESET-8`. Đây là trường hợp muted-subtitle duy nhất **không**
  phải `TYPESET-7`, vì nó chia vùng quét chứ không giải thích dòng nào.
- **Độ đậm là toàn bộ khác biệt giữa hai peer.** Thuộc `TYPESET-5` và `TYPESET-9`. Hai dòng cùng 14px
  được phép, miễn một bên medium và bên kia normal hoặc muted. Cùng cỡ khác đậm là một thứ bậc; cùng
  cỡ cùng đậm chỉ khác tông thì không.
- **Parity trạng thái.** Dòng đang tải giữ đúng mã và đúng metrics của dòng mà nó sẽ trở thành.
  Skeleton đổi cỡ là hứa một thứ bậc mà trạng thái thật sẽ nuốt lời.
- **Chính component heading.** Thuộc `TYPESET-1`. Đúng một file được phép viết tag heading: file sở
  hữu `level`. File test dựng markup thô để assert cũng nằm ngoài phạm vi.
- **Có người xin cấp thứ năm.** Thuộc `TYPESET-2`. Không có đáp án về mặt kiểu chữ. Làm phẳng section
  trước, rồi mới đặt tên bằng một cấp mà thang có.
