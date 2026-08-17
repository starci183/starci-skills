---
title: Typography · Vietnamese
---

# Kiểu chữ

Đầu vào là một shape đã được duyệt — một layout, một block, một card, một section feed mà nội dung và
cách sắp xếp đã chốt. Pattern này không mở lại quyết định đó. Nó cầm từng dòng chữ mà shape ấy render
ra và hạ xuống source: element nào viết dòng đó, component nào sở hữu nó, prop nào mang thứ bậc của
nó, và cuối cùng code giữ cỡ, độ đậm, tông nào. Câu hỏi lúc thiết kế là "surface này hiện cái gì". Câu
hỏi ở đây là "file viết ra cái gì".

## Luật

Chữ mang **thứ bậc**. Cỡ chữ, độ đậm và tông màu không phải ba lựa chọn độc lập — cộng lại chúng nói
cho người đọc biết **thứ gì trên màn hình là quan trọng nhất**, và người đọc quyết định nhìn vào đâu
trước khi kịp đọc một chữ nào.

Vì vậy thang chữ nhỏ, và các bậc đi **theo cặp** chứ không tự do. Một heading không phải là "một cỡ
cộng một độ đậm chọn cùng nhau"; nó là một **cấp**, và cấp quyết định cả hai — kể cả cái tag mà trình
đọc màn hình dùng để dựng outline.

Heading có bốn cấp:

| Cấp | Cỡ | Độ đậm |
|---|---|---|
| 1 | 20px | semibold |
| 2 | 16px | semibold |
| 3 | 14px | medium |
| 4 | 12px | medium |

Body dùng 14px và 16px. Bậc thứ ba, 12px, là bậc **hạn chế**, chỉ dành cho copy phụ trợ nằm dưới hoặc
cạnh một dòng chính hay một surface ghép; nó không phải một cỡ body dùng chung nữa, và vì bản thân nó
đã có nghĩa "phụ trợ" nên mọi dòng 12px đều muted. Ở bậc đó cỡ và tông là **một** thứ bậc: không có
ngoại lệ 12px nào giữ tông mặc định hay tông foreground. Thang chữ có ba độ đậm và hai tông, và người
gọi không tự nghĩ ra bậc mới từ những pixel gần đó.

Hãy để ý điều bảng heading **không** làm: nó không bao giờ ghép cỡ lớn nhất với độ đậm nặng nhất. Thứ
bậc đến từ **bậc thang**, không đến từ việc gào một dòng to hết mức hệ thống chữ cho phép — cũng vì
thế trần thang đủ thấp để "nâng một dòng lên" hiếm khi còn là nước đi có sẵn.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi dòng chữ render ra đều rơi vào đúng một mã dưới
đây. Không có dòng nào ngắn tới mức được miễn: một category ba chữ nằm trên tên card là `TYPESET-5`,
cũng vì lý do đó mà tên trang là `TYPESET-1`. Câu "có mỗi cái label thôi mà" không phải một ngoại lệ —
đó là chỗ luật này bị bỏ qua nhiều nhất, vì một dòng ngắn chính là chỗ người viết với tay lấy đại cỡ
chữ nào nhìn thuận mắt.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `TYPESET-<n>`. Mã gọi tên **tình huống**; cột thứ ba
nói source khi đó phải trông ra sao, kể cả những gì nó không được chứa.

| Mã | Tình huống | Source phải trông ra sao |
|---|---|---|
| `TYPESET-1` | Một dòng là **tên** của trang hoặc của một section | Heading được render bởi heading component từ một `level`, và `level` quyết cả tag lẫn dáng. Cấm: tag heading gõ tay; một cỡ ghép một độ đậm cho ra thứ trông như heading |
| `TYPESET-2` | Cần cấp heading thứ năm | Bốn cấp; cấp thứ năm nghĩa là section đã lồng sâu hơn mức một người đọc giữ nổi, nên phải làm phẳng. Cấm: cấp heading thứ năm, hoặc một bậc nhỏ hơn được nghĩ ra để đóng thế |
| `TYPESET-3` | Muốn một dòng được chú ý hơn | Thứ bậc đi qua cỡ, độ đậm và tông. Cấm: khung viền, nền hay chip vẽ ra để làm một dòng trở nên quan trọng |
| `TYPESET-4` | Nhiều thứ trên cùng surface cùng tranh sự chú ý | Giải quyết tranh chấp bằng cách hạ những thứ xung quanh xuống. Cấm: nâng dòng đang tranh chấp lên, vì thế là nâng sàn cho cả tác giả kế tiếp |
| `TYPESET-5` | Eyebrow, count, category, meta đi kèm một title | Dòng phụ — eyebrow, count, category, meta — đặt dưới thứ bậc của title mà nó thuộc về. Cấm: dòng phụ cùng cỡ, to hơn hoặc đậm hơn title; lấy tông làm toàn bộ khác biệt |
| `TYPESET-6` | Muốn heading đậm hơn | Độ đậm chỉ được chọn trên body text; độ đậm của heading đến từ cấp của nó. Cấm: prop độ đậm hay class độ đậm đẩy vào một heading |
| `TYPESET-7` | Copy phụ trợ ở 12px | Bậc 12px luôn đi kèm tông muted, chỉ dành cho copy phụ trợ. Cấm: 12px ở tông foreground; 12px dùng như copy chính bản gọn |
| `TYPESET-8` | "Hôm nay", "Hôm qua" chia nhóm kết quả | Nhãn mốc thời gian render như subtitle 14px muted, đặt ngoài surface mà nó chia. Cấm: cho một mốc thời gian một cấp heading, hoặc cách đặt nhãn riêng của surface ghép |
| `TYPESET-9` | Chọn 16px hay 14px cho một title trong body | Bậc title trong body đọc từ chủ sở hữu nội dung: title của object chiếm ưu thế ở 16px medium, title gọn hoặc lặp lại ở 14px medium, giá trị thường ở 14px normal. Cấm: chọn bậc vì card có hover, vì giá trị là con số, hay vì còn chỗ trống |

Thang mã dừng ở chín và ở nguyên chín. Một mã gọi tên một tình huống mà người ta có thể bị chỉ ra là
đã làm sai; đánh số lại một mã là âm thầm làm gãy một trích dẫn đã viết ở nơi khác.

## Đọc một shape đã duyệt

1. Đọc những gì shape **nói ra**. Nó nói trên surface có những dòng nào, mỗi dòng viết gì, thuộc về
   cái gì, và đứng ở đâu so với các dòng còn lại.
2. Đọc những gì shape **không nói**, và do đó không giải quyết. Shape không nói cấp heading, không nói
   cỡ pixel, độ đậm, tông, cũng không nói dòng nào thuộc outline của tài liệu. Những thứ đó không vì
   thế mà thành tự do; chúng được quyết ở đây, bằng các mã, đọc từ chủ sở hữu nội dung.
3. Giải từ ngoài vào trong. Lấy tên trang trước, rồi tên section, rồi title của từng object, rồi các
   dòng phụ của title đó, cuối cùng là giá trị và dòng bổ nghĩa. Thứ bậc của một dòng bên trong chỉ
   đọc được sau khi thứ bậc bên trên nó đã cố định, vì `TYPESET-5` ràng buộc một **quan hệ**.
4. Hỏi câu hỏi của từng mã với từng dòng, theo thứ tự mã. Dòng này có nằm trong outline không
   (`TYPESET-1`)? Trả lời nó có đòi một cấp mà thang không có không (`TYPESET-2`)? Có cái khung nào
   đang làm thay việc của thứ bậc không (`TYPESET-3`)? Cách sửa đang là nâng lên thay vì hạ xung quanh
   xuống phải không (`TYPESET-4`)? Dòng này có đang nói thêm về một dòng khác không (`TYPESET-5`)? Có
   độ đậm nào đang bị đẩy vào heading không (`TYPESET-6`)? 12px có đang bị dùng như copy chính bản gọn
   không (`TYPESET-7`)? Đây có phải một mốc thời gian sinh ra từ dữ liệu không (`TYPESET-8`)? Và với
   phần còn lại, chủ sở hữu nội dung nào đặt bậc cho title trong body (`TYPESET-9`)?
5. Khi hai mã cùng khớp, chúng gần như không bao giờ mâu thuẫn — một mã gọi tên phương tiện, mã kia
   gọi tên hướng đi; hoặc một mã chốt bậc, mã kia ràng buộc cặp đôi. `TYPESET-3` và `TYPESET-4` là
   phương tiện và hướng đi của cùng một mong muốn. `TYPESET-9` chọn bậc cho một title; `TYPESET-5` chỉ
   ràng buộc quan hệ giữa title đó và các dòng phụ của nó, nên cả hai có thể cùng áp vào một cụm mà
   không mã nào đè mã nào. Với một mốc thời gian thì `TYPESET-8` đứng trên `TYPESET-7`: nó ở lại 14px
   muted. Và một dòng đã nằm trong outline thì là `TYPESET-1` trước khi là bất cứ thứ gì khác — không
   chọn bậc body cho nó.

## `TYPESET-1` — heading là một cấp, và cấp quyết định cả tag lẫn dáng

**Tình huống.** Một dòng **đặt tên** cho trang hoặc cho một section. Cái tag mà trình đọc màn hình dùng
để dựng outline, và cái cỡ mà mắt người đọc thấy, là **hai sự thật của cùng một thứ**.

**Nó sinh ra gì trong source.** Một lời gọi heading component kèm prop `level`. Đúng một prop đó vừa
được truyền vào tag outline **vừa** dùng để chọn tập class — một prop, hai sự thật, trong một biểu
thức. Ở chỗ gọi không có tag `h*` nào được gõ tay, và không có cặp cỡ-cộng-độ-đậm nào được ghép lại để
giả làm heading.

**Dấu hiệu nhận biết.**

- Bỏ dòng này đi thì phần bên dưới mất tên gọi, chứ không mất nội dung.
- Nó xuất hiện trong mục lục của trang nếu trang có mục lục.
- Người ta hay viết nó bằng một tag `h*` gõ tay kèm vài class cỡ chữ.
- Tự hỏi: nếu một người mù nghe outline của trang này, dòng này có nằm trong outline không? Nếu có, nó
  là heading, và cấp của nó phải do một prop quyết định.

**Ranh giới.** Không phải `TYPESET-9`: title của một card **không** nhất thiết là heading — câu hỏi
phân định là outline, chứ không phải độ to. Không phải `TYPESET-8`: một nhãn thời gian không phải
heading dù nó đứng trên cả nhóm kết quả. Viết tag và viết cỡ ở hai chỗ thì chúng **trôi ra khỏi nhau**:
dòng chữ to thứ ba trên màn hình trở thành heading đầu tiên của tài liệu, và outline thôi mô tả trang.
Một prop quyết cả hai thì chúng không thể mâu thuẫn.

**Tình huống nghiệp vụ hay gặp.** Tên trang · tên section trong dashboard · tên card danh mục · tiêu đề
panel · tiêu đề dialog · tên nhóm trong trang cài đặt.

## `TYPESET-2` — bốn cấp, và cấp thứ năm nghĩa là trang đã lồng quá sâu

**Tình huống.** Ai đó cần một heading nhỏ hơn cấp bốn, vì bên trong một section đã có section, mà bên
trong nữa lại còn một nhóm nữa.

**Nó sinh ra gì trong source.** Không sinh ra gì mới. Union cấp giữ nguyên đóng ở `1 | 2 | 3 | 4`, và
phần lồng nhau của shape được làm phẳng ngay trong source cho tới khi title đặt được bằng một cấp mà
thang có. Không có bậc nhỏ hơn nào được nghĩ ra, và không có dòng body in đậm nào được viết để đóng thế
một cấp năm.

**Dấu hiệu nhận biết.**

- Yêu cầu đến dưới dạng "cho mình thêm một bậc nhỏ nữa".
- Trong cây DOM đã có ba tầng heading trước khi tới nội dung thật.
- Người viết định thay thế bằng một dòng body in đậm cho "giống heading cấp năm".
- Tự hỏi: đây là vấn đề **cỡ chữ**, hay là vấn đề **cấu trúc** đang mặc áo của vấn đề cỡ chữ?

**Ranh giới.** Không phải `TYPESET-1`: `TYPESET-1` nói heading phải đến từ một cấp; `TYPESET-2` nói tập
hợp các cấp là đóng. Không phải `TYPESET-6`: đừng giải quyết bằng cách cho heading cấp 4 một độ đậm
khác — đó là vi phạm khác. Câu trả lời **không phải** một bậc nhỏ hơn. Câu trả lời là section đã lồng
sâu hơn mức một người đọc giữ nổi trong đầu, nên hãy làm phẳng nó rồi mới đặt tên.

**Tình huống nghiệp vụ hay gặp.** Trang cài đặt nhiều nhóm lồng nhau · tài liệu có mục con của mục con ·
form dài chia nhóm nhiều tầng · trang khoá học có chương trong chương.

## `TYPESET-3` — thứ bậc đến từ cỡ, độ đậm, tông; không bao giờ từ một cái khung

**Tình huống.** Một dòng cần được chú ý, và phản xạ đầu tiên là vẽ quanh nó một cái viền, một nền màu,
hoặc bỏ nó vào một cái chip.

**Nó sinh ra gì trong source.** Chỉ có class cỡ, độ đậm và tông. Leaf chữ không vẽ viền và không vẽ nền,
nên cái hộp luôn là element của người khác; danh sách class của dòng mang copy không có mục `border-*`
nào và không có mục `bg-*` nào.

**Dấu hiệu nhận biết.**

- Cái khung không tương ứng với một trạng thái nào cả — nó chỉ ở đó để "nổi".
- Trên cùng một surface đã có sẵn vài cái khung tương tự.
- Bỏ khung đi thì thông tin **không** mất gì, chỉ bớt nổi.
- Tự hỏi: cái khung này đang nói lên **sự thật** gì mà cỡ, độ đậm và tông không nói được?

**Ranh giới.** Không phải `TYPESET-4`: `TYPESET-3` cấm một loại phương tiện; `TYPESET-4` chỉ ra hướng đi
đúng khi cả hai bên đều muốn nổi. Cũng không phải chuyện trạng thái: một chip nói "đã hoàn thành" hay
"còn 3 ngày" không thuộc mã này — nó vẽ một sự thật, không phải một thứ bậc. Khi một surface đã dạy
người đọc rằng những cái khung ở đây chẳng có nghĩa gì, thì **cái khung thật sự có nghĩa cũng trở nên
vô hình**. Đó là cái giá mà người vẽ khung đầu tiên không phải trả.

**Tình huống nghiệp vụ hay gặp.** Badge category trên card · viền quanh giá tiền · nền màu cho một dòng
metric · chip bọc tên tác giả · box quanh một câu mô tả.

## `TYPESET-4` — thứ gì đang tranh chú ý thì hạ hàng xóm của nó xuống

**Tình huống.** Hai ba thứ trên cùng một surface cùng muốn được nhìn thấy trước, và cách sửa quen tay là
nâng cái quan trọng nhất lên một bậc.

**Nó sinh ra gì trong source.** Một diff **hạ** những dòng xung quanh xuống — về tông muted, về độ đậm
nhẹ hơn hoặc về bậc nhỏ hơn — trong khi dòng đang tranh chấp giữ nguyên dáng nó vốn có. Trần thang ở
nguyên chỗ cũ; cấp 1 là `text-xl font-semibold`, không phải `text-3xl font-bold`.

**Dấu hiệu nhận biết.**

- Diff chỉ tăng cỡ hoặc tăng độ đậm, không hạ thứ gì cả.
- Trên surface đó số dòng ở tông mặc định nhiều hơn số dòng muted.
- Lần sửa trước cũng đã tăng một bậc, vì cùng một lý do.
- Tự hỏi: mình đang làm cái này **to lên**, hay đang làm những cái quanh nó **im đi**?

**Ranh giới.** Không phải `TYPESET-3`: nếu đang định nâng bằng một cái khung thì đó là `TYPESET-3`.
Không phải `TYPESET-5`: nếu cái đang tranh chú ý là **dòng phụ của chính title đó** thì đó là
`TYPESET-5`, và hạ nó xuống là bắt buộc chứ không phải một lựa chọn. Nhấn mạnh là chuyện **tương đối**.
Nâng cái quan trọng lên tức là nâng sàn cho mọi thứ, và tác giả kế tiếp lại nâng tiếp. Phần lớn lỗi thứ
bậc được giải quyết sớm hơn một bước, ở chỗ hạ mọi thứ xung quanh xuống. Thang chữ ở đây cố tình có
**trần thấp** để việc leo lên là không rẻ.

**Tình huống nghiệp vụ hay gặp.** Card có cả tên, giá, số học viên và nhãn khuyến mãi · row danh sách có
bốn dữ kiện · toolbar có ba nút đều muốn là primary · dashboard nhiều ô số liệu.

## `TYPESET-5` — dòng phụ luôn xếp dưới title mà nó thuộc về

**Tình huống.** Một eyebrow, một con số đếm, một category, một dòng meta đứng cạnh hoặc dưới một title.
Nó **nói thêm** về title, nó không phải một đối tượng ngang hàng.

**Nó sinh ra gì trong source.** Hai dòng có dáng khác nhau ở cỡ hoặc ở độ đậm, với dòng phụ nằm hẳn bên
dưới: title giữ thứ bậc của nó trong khi các dữ kiện quanh nó ở lại bậc thấp hơn và tông muted. Nó
không bao giờ được sinh ra cùng cỡ, cùng độ đậm với title mà chỉ đổi mỗi tông.

**Dấu hiệu nhận biết.**

- Đọc riêng dòng phụ thì không biết nó nói về cái gì.
- Nó ngắn hơn title nhưng lại đang cùng cỡ với title.
- Nó đang được làm nổi để "cho có nhịp".
- Tự hỏi: nếu chỉ được đọc **một** dòng trong cụm này, người dùng cần đọc dòng nào? Dòng còn lại phải
  xếp dưới.

**Ranh giới.** Không phải `TYPESET-7`: nếu dòng phụ tụt xuống bậc 12px thì tông muted là bắt buộc — đó
là `TYPESET-7`. Không phải `TYPESET-9`: `TYPESET-9` chọn bậc cho **title**; `TYPESET-5` chỉ ràng buộc
**quan hệ** giữa title và dòng phụ của nó. Chỉ đổi tông là **chưa đủ**: hai dòng cùng cỡ vẫn đòi cùng
một thứ bậc kể cả khi một dòng đã xám. Một card mà phần tử to nhất là cái nhãn category là một card
**không ai đọc tên**, và đó là lỗi chứ không phải một cách nhấn mạnh thành công.

**Tình huống nghiệp vụ hay gặp.** Category trên tên khoá học · "12 bài" dưới tên chương · tên tác giả
dưới tiêu đề bài viết · "còn 3 ngày" cạnh tên nhiệm vụ · đơn vị dưới một con số.

## `TYPESET-6` — độ đậm là trục của body text; heading không nhận thêm trục nào

**Tình huống.** Một heading trông chưa đủ mạnh, nên người viết thêm một class độ đậm, hoặc mong component
heading có prop `weight`.

**Nó sinh ra gì trong source.** Một lời gọi heading với đúng hai trường, `content` và `level`. Không có
trường độ đậm nào để truyền và không có class `font-*` nào đứng cạnh heading; độ đậm nằm trong tập class
của cấp.

**Dấu hiệu nhận biết.**

- Có một class `font-*` đứng cạnh một heading.
- Có yêu cầu "cho heading cấp 3 đậm hơn ở màn này thôi".
- Hai màn hình có cùng cấp heading nhưng trông khác nhau.
- Tự hỏi: nếu cấp đã quyết độ đậm rồi, thì cái độ đậm mình sắp thêm đang **quyết lại** điều gì?

**Ranh giới.** Không phải `TYPESET-9`: body text **có** trục độ đậm, và đó là chỗ hợp lệ duy nhất để
dùng nó. Còn với `TYPESET-1`: một "heading" ghép từ cỡ to và độ đậm nặng không phải heading — outline
không hề chứa nó, nên nó thuộc `TYPESET-1`. Heading đã mang sẵn độ đậm như một phần của cấp. Đẩy thêm
một độ đậm nữa là bắt **hai hệ thống cùng quyết một việc**, và bên thua là cái mà người đọc nhìn thấy
sau.

**Tình huống nghiệp vụ hay gặp.** Heading trong dialog · heading section muốn "mạnh như trang chủ" ·
tiêu đề card muốn đậm hơn tiêu đề bên cạnh.

## `TYPESET-7` — bậc 12px luôn có nghĩa là copy phụ trợ, và luôn muted

**Tình huống.** Cần một dòng nhỏ. Người viết coi 12px như "phiên bản gọn của chữ chính" và bảo toàn tông
foreground.

**Nó sinh ra gì trong source.** Nhánh union `{ size: "xs"; tone?: "muted" }` — một dòng 12px tông
foreground là thứ không viết ra được, và component tự dẫn lại tông lúc chạy, bỏ qua tông người gọi
truyền vào khi cỡ là `xs`. Copy mà người dùng **phải** đọc mới làm được việc thì được sinh ra ở 14px trở
lên.

**Dấu hiệu nhận biết.**

- Dòng 12px đang mang thông tin mà người dùng **phải** đọc mới làm được việc.
- Nó được chọn 12px vì chỗ đó hẹp, không phải vì nó phụ trợ.
- Nó đứng một mình, không kèm dòng chính nào để bổ nghĩa.
- Tự hỏi: nếu dòng này buộc phải giữ tông chính, nó có còn là copy phụ trợ nữa không? Nếu không, nó phải
  ở lại 14px hoặc lớn hơn.

**Ranh giới.** Không phải `TYPESET-8`: nhãn thời gian chia nhóm kết quả **ở lại 14px** dù cũng muted — nó
chia vùng quét, không giải thích dòng nào cả. Không phải `TYPESET-5`: `TYPESET-5` nói dòng phụ phải xếp
dưới; `TYPESET-7` nói **cái giá** của việc xuống tới 12px là tông muted, không thương lượng. Cỡ và tông ở
bậc này là **một** thứ bậc chứ không phải hai lựa chọn. Chỗ chật không phải một lý do ngữ nghĩa: nếu chữ
phải giữ tông chính thì nó đủ quan trọng để ở lại bậc trên.

**Tình huống nghiệp vụ hay gặp.** "55 phút trước" · caption dưới ảnh · "PDF · 2,4 MB" · dòng giải thích
dưới một ô nhập · dữ kiện bên phải một label 14px · ghi chú hạn mức.

## `TYPESET-8` — nhãn mốc thời gian là subtitle muted, không phải heading

**Tình huống.** Kết quả được chia theo ngày: "Hôm nay", "Hôm qua", "16/08/2026". Nhãn đó **định tính**
cho nhóm kết quả nằm ngay dưới nó.

**Nó sinh ra gì trong source.** Một subtitle 14px muted render **ngoài** surface danh sách, và surface
bên dưới được yêu cầu ẩn nhãn của chính nó đi — để một nhóm kết quả không bị đặt tên hai lần bằng hai
thứ bậc khác nhau. Không có cấp heading nào, và cũng không dùng cách đặt nhãn riêng của surface ghép.

**Dấu hiệu nhận biết.**

- Nhãn được sinh ra từ dữ liệu, không phải từ cấu trúc trang.
- Số lượng nhãn thay đổi theo dữ liệu; hôm nay có ba, ngày mai có một.
- Bên dưới nó là một surface danh sách đã có nhãn riêng của surface đó.
- Tự hỏi: nếu dữ liệu trống đi, dòng này có biến mất không? Nếu có, nó không phải một section của trang.

**Ranh giới.** Không phải `TYPESET-1`: cho nó một cấp heading là **thăng chức nhầm** mỗi mốc thời gian
thành một section của trang, và outline của trang sẽ dài ra theo dữ liệu. Không phải `TYPESET-7`: nó
muted nhưng **không** xuống 12px, vì nó không giải thích dòng nào — nó chia vùng quét.

**Tình huống nghiệp vụ hay gặp.** Feed hoạt động chia theo ngày · lịch sử giao dịch theo tháng · hộp thư
chia "Hôm nay / Tuần này" · nhật ký học tập · thông báo chia theo mốc.

## `TYPESET-9` — bậc của title trong body theo chủ sở hữu nội dung

**Tình huống.** Phải chọn giữa 16px medium và 14px medium cho một dòng title nằm trong body, không phải
heading.

**Nó sinh ra gì trong source.** 16px medium cho một title **ngắn, chiếm ưu thế**, đại diện cho một object
quan trọng hoặc một card lớn; 14px medium cho title gọn, lặp lại hoặc dài; 14px normal cho mô tả,
metadata và giá trị thường của chúng. Bằng chứng cho cách chia này là tỉ lệ trên surface — một prompt
chiếm ưu thế ở 16px medium so với khoảng ba mươi title gọn ở 14px medium.

**Dấu hiệu nhận biết.**

- Lý do đang định dùng là "card này có hover", "đây là con số", hoặc "chỗ này còn rộng".
- Cùng một loại title xuất hiện lặp lại hàng chục lần trong một danh sách.
- Title dài tới mức xuống hai dòng khi ở bậc lớn.
- Tự hỏi: dòng này **đại diện cho một object quan trọng** đang được trưng bày, hay nó là một dòng lặp
  lại trong một danh sách?

**Ranh giới.** Không phải `TYPESET-1`: nếu nó nằm trong outline thì đừng chọn bậc body — nó là heading.
Không phải `TYPESET-5`: mô tả, meta và giá trị thường của cùng object đó ở 14px normal, không phải
medium. Hover có thể xác nhận rằng một surface bấm được, nhưng **không** thăng cấp chữ trong đó. Một con
số vẫn có thể chỉ là một giá trị thường, và chỗ trống không phải một thứ bậc ngữ nghĩa.

**Tình huống nghiệp vụ hay gặp.** Tên khoá học trên card lớn · tên bài trong danh sách chương · label của
accordion · tiêu đề row trong bảng số liệu · tên file trong danh sách · giá trị metric trong ô thống kê.

## Tầng giữ

Tầng nào thật sự giữ từng mã — một kiểu đóng, một lint rule, hay chỉ một người đọc.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `TYPESET-1` | `enforced` | `no-heading-tag-outside-heading-component` trong `@starci/eslint-canon-fe` báo lỗi mọi `h1`–`h6` trong một file source không phải chính heading component |
| `TYPESET-2` | `unrepresentable` | Union cấp đóng `1 \| 2 \| 3 \| 4` trên kiểu dữ liệu heading; nhánh `tooDeep` của cùng lint rule là lớp chặn cho một `<h5>` gõ tay |
| `TYPESET-3` | `documented` | Không có gì máy móc giữ. Leaf chữ không vẽ viền và không vẽ nền, nên cái hộp luôn là element của người khác |
| `TYPESET-4` | `documented` | Không có gì máy móc giữ. Trần thang làm việc leo lên trở nên đắt, nhưng không công cụ nào thấy được tác giả đã đi theo hướng nào |
| `TYPESET-5` | `documented` | Không có gì máy móc giữ. Tách riêng thì cả hai dòng đều hợp lệ; chỉ cặp đôi của chúng mới sai |
| `TYPESET-6` | `unrepresentable` | Kiểu dữ liệu heading đóng quanh `content` và `level`; không có trường độ đậm nào để truyền |
| `TYPESET-7` | `unrepresentable` | Kiểu dữ liệu text là một discriminated union: `{ size: "xs"; tone?: "muted" }` khiến một dòng 12px tông foreground không viết ra được, và component tự dẫn lại tông lúc chạy |
| `TYPESET-8` | `documented` | Không có gì máy móc giữ. Mọi thành phần đều là lời gọi hợp lệ; chỉ ý nghĩa của chuỗi mới làm nó thành một partition |
| `TYPESET-9` | `documented` | Không có gì máy móc giữ. Cả hai cỡ đều hợp lệ; chủ sở hữu nội dung không phải sự thật mà kiểu hay rule nào đọc được |

Một rule, ba kiểu đóng, năm mã chỉ do người đọc giữ. Khoảng trống đó là trạng thái thật thà của luật
này, không phải khiếm khuyết của bảng: cái một kiểu từ chối được là một **giá trị**, cái một lint rule
nhìn thấy được là một **hình dạng**, còn phần lớn luật này nói về quan hệ giữa hai dòng mà tách riêng ra
thì dòng nào cũng ổn.

## Điểm neo

Một luật không chỉ được vào code thật thì chỉ là một đề xuất. Đường dẫn tính từ gốc repository.

| Mã | Đường dẫn | Nhìn cái gì |
|---|---|---|
| `TYPESET-1` | `components/leaves/Heading/index.tsx` | `level` được truyền vào tag outline **và** dùng để chọn tập class — một prop, hai sự thật, trong một biểu thức |
| `TYPESET-2` | `components/leaves/Heading/index.tsx` · `@starci/eslint-canon-fe` | Union cấp dừng ở `4`; hằng `DEEPEST_LEVEL` của rule cũng đúng `4` đó |
| `TYPESET-3` | `components/leaves/Text/index.tsx` | Danh sách class không có mục `border-*` và không có mục `bg-*`: leaf vẽ copy không vẽ nổi cái hộp quanh chính nó |
| `TYPESET-4` | `components/leaves/Heading/index.tsx` | Cấp 1 là `text-xl font-semibold`, không phải `text-3xl font-bold` — trần thấp, nên "to hơn nữa" phần lớn là không tồn tại |
| `TYPESET-5` | `components/blocks/courses/CourseCatalogCard/component.tsx` | Title của card là heading cấp 2 trong khi các dữ kiện ở lại 14px muted — dòng phụ không bao giờ với tới thứ bậc của title |
| `TYPESET-6` | `components/leaves/Heading/index.tsx` | Kiểu dữ liệu heading có đúng hai trường; không nhận độ đậm nào, và độ đậm nằm trong tập class của cấp |
| `TYPESET-7` | `components/leaves/Text/index.tsx` | Nhánh union `{ size: "xs"; tone?: "muted" }`, và đoạn dẫn lại tông bỏ qua tông người gọi truyền khi cỡ là `xs` |
| `TYPESET-8` | `components/blocks/dashboard/ActivityFeed/component.tsx` | Nhãn ngày render 14px muted **ngoài** surface danh sách, và surface bên dưới được yêu cầu ẩn nhãn riêng của nó |
| `TYPESET-9` | `components/pages/CourseFlashcardSessionPage/component.tsx` · `components/blocks/` | Một prompt chiếm ưu thế ở 16px medium so với khoảng ba mươi title gọn ở 14px medium — tỉ lệ chính là bằng chứng |

Mọi mã đều đã neo; không mã nào chưa neo được. Hai điểm neo chứng minh ít hơn vẻ ngoài của chúng: neo
`TYPESET-4` chứng minh cái trần chứ không chứng minh thói quen, còn neo `TYPESET-9` chứng minh một phân
bố chứ không chứng minh một quyết định ở từng chỗ gọi.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| thứ bậc outline | Dòng này có phải một bậc của outline tài liệu không, và section đã lồng sâu tới đâu |
| chủ sở hữu nội dung | Object mà dòng này đặt tên: một trang, một section, một object quan trọng, một row lặp lại, một giá trị, một dòng bổ nghĩa |
| hàng xóm | Trên cùng surface còn thứ gì đang tranh chấp, và hiện đang ở thứ bậc nào |
| quyền sở hữu surface | Một surface ghép có sẵn nhãn riêng cho đoạn chữ này hay không |
| vai trò partition | Dòng này có đang đặt tên một mốc thời gian trên tập kết quả, thay vì một section của trang, hay không |

## Quy tắc

1. Tag của heading và dáng của nó đến từ **một** prop.
2. Thang chữ là bốn cấp heading, hai cỡ body, một cỡ phụ trợ hạn chế.
3. Cỡ, độ đậm và tông là những phương tiện duy nhất của thứ bậc; khung viền thì không.
4. Bậc 12px và tông muted là **một** quyết định, không bao giờ là hai.
5. Dòng phụ nằm hẳn dưới title của nó bằng cỡ hoặc độ đậm, không chỉ bằng tông.
6. Heading không nhận độ đậm riêng.
7. Thứ bậc theo chủ sở hữu nội dung, không theo tương tác, kiểu dữ liệu hay chỗ trống.
8. Mọi dòng render ra đều giải về đúng một mã. Không dòng nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Mốc thời gian giữ 14px.** Thuộc `TYPESET-8`. Mốc thời gian ở lại cỡ body với tông muted thay vì tụt
  xuống bậc phụ trợ, vì nó đặt tên một vùng quét chứ không giải thích dòng nằm trên nó. Đây là trường
  hợp muted-subtitle duy nhất **không** phải `TYPESET-7`.
- **Độ đậm là toàn bộ khác biệt giữa hai peer.** Thuộc `TYPESET-5` và `TYPESET-9`. Hai dòng gọn ngang
  hàng được phép cùng 14px, miễn một bên medium và bên kia normal hoặc muted. Cùng cỡ khác đậm là một
  thứ bậc; cùng cỡ cùng đậm chỉ khác tông thì không.
- **Parity trạng thái.** Dòng đang nghỉ hoặc đang tải giữ đúng mã và đúng metrics của dòng mà nó sẽ trở
  thành. Skeleton đổi cỡ là hứa một thứ bậc mà trạng thái thật sẽ nuốt lời.
- **Chính component heading.** Thuộc `TYPESET-1`. Đúng một file được phép viết tag heading: file sở hữu
  `level`. Lint rule miễn trừ đường dẫn đó và các file test dựng markup thô để assert.
- **Có người xin cấp thứ năm.** Thuộc `TYPESET-2`. Không có đáp án về mặt kiểu chữ. Làm phẳng section
  trước, rồi mới đặt tên bằng một cấp mà thang có.

## Đầu ra

Một khối cho mỗi dòng chữ mà shape render ra.

```text
line: <the text and where it sits>
owner: <page | section | object | repeated row | value | qualifier | partition>
situation: <TYPESET-1 … TYPESET-9>
element: <heading level N | body line>
set: <size + weight + tone>
reason: <the ownership fact that excludes the adjacent code>
```

## Ví dụ đã giải

Shape đã duyệt: một section feed hoạt động trên dashboard, kết quả chia nhóm theo ngày, và mỗi nhóm là
một surface danh sách gồm các row mang một title và một mốc thời gian tương đối.

Shape nói rằng section đó tồn tại, rằng các nhóm chia theo ngày, rằng mỗi row có một title và một mốc
thời gian. Nó **không** nói cấp heading, không nói cỡ pixel, độ đậm, tông, cũng không nói nhãn ngày có
thuộc outline của tài liệu hay không. Những thứ đó không vì thế mà thành tự do — chúng được giải ở đây.

```text
line: "Recent activity", the section name above the feed
owner: section
situation: TYPESET-1
element: heading level 2
set: 16px + semibold + default tone
reason: the section keeps its name whether or not any activity exists, so it is a rung of the outline — which is exactly what excludes TYPESET-8
```

```text
line: "Today", above the first group of rows
owner: partition
situation: TYPESET-8
element: body line, outside the list surface, and the surface below hides its own label
set: 14px + normal + muted
reason: the label is generated from data and disappears when the data goes empty, so it is not a section of the page — that excludes TYPESET-1; and it partitions a scan region rather than explaining the line above it, which excludes TYPESET-7 and keeps it at 14px
```

```text
line: the row title inside a group
owner: repeated row
situation: TYPESET-9
element: body line
set: 14px + medium + default tone
reason: the same kind of title repeats down the whole list rather than standing for one dominant object on display, so it takes the compact step — the fact that the row hovers is not a rank, which is what excludes the 16px medium branch
```

```text
line: "55 minutes ago", beneath the row title
owner: qualifier
situation: TYPESET-7
element: body line
set: 12px + normal + muted
reason: it says more about the row title and cannot be read alone, and it drops to the supporting step, so muted tone comes with the size as one decision — it explains the line above it rather than partitioning results, which excludes TYPESET-8
```

## Phạm vi

Quy tắc này đúng với mọi đoạn code cùng loại trong stack này. Nó không gọi tên sản phẩm nào, thư viện
component nào, khoá registry nào, repository nào, và cũng không gọi tên một feature đơn lẻ nào. Ví dụ
là TSX bình thường: markup thường với class thường, cộng thêm một heading component ở đúng chỗ mà ranh
giới component **chính là** luật.
