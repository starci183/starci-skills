---
id: fe-layouts-laws-l4-tab-switches-panel-route-switches-page-vi
title: vi.md
slug: /fe/layouts/laws/l4-tab-switches-panel-route-switches-page/vi
sidebar_label: vi.md
sidebar_position: 1
description: Bảy mã L4-N nhận diện bằng việc người đọc đi đâu khi bấm, và vì sao bốn dải tab trông y hệt nhau trong repo lại làm bốn việc khác nhau.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l4-tab-switches-panel-route-switches-page` · Luật: [`INDEX.md`](./INDEX.md)

# Tab đổi panel, route đổi trang

Bấm một cái tab và bấm một cái link trông giống nhau trên màn hình, nhưng chúng hứa hai điều khác
nhau với người đọc. Link nói rằng bạn sắp rời khỏi trang này, nên nút Back sẽ đưa bạn về. Tab nói
rằng bạn vẫn đang ở đây, chỉ nhìn sang phần khác, nên Back phải đưa bạn về trang trước đó chứ không
phải về cái tab vừa nãy. Khi một cái tab đẩy lịch sử, người đọc bấm Back bốn lần mà vẫn chưa ra khỏi
dashboard, và họ không hiểu vì sao.

Câu luật dừng ở đó thì chưa đủ. Còn một câu hỏi thứ hai mà câu đầu không trả lời được: cái panel
đang mở có cần sống sót qua một lần F5 và một lần gửi link cho người khác hay không. Repo sống trả
lời cả hai chiều. Dashboard giữ tab trong query nên gửi được, còn dải tab trên bản mobile của trang
học thì cố tình không đụng vào URL. Không chiều nào là mặc định, và thầy đã phán riêng cho từng
chiều.

Rồi còn một loại điều khiển nữa không thuộc về điều hướng chút nào. Cái nút chọn năm trên biểu đồ
đóng góp chỉ đổi một tham số của đúng một khối, nên nó giữ đúng bề rộng của mấy chữ trên nó và ngồi
trong cột của khối đó. Đây chính là chỗ thầy tự lật, và bản luật này viết ra từ lần lật ấy.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Layout phát ra gì |
|---|---|---|
| `L4-1` | Điều khiển đưa người đọc sang một page owner khác | `router.push(path)`, sinh một bước lịch sử |
| `L4-2` | Điều khiển đổi vùng nội dung chính của cùng một trang, và lựa chọn đó phải gửi được | `router.replace` một query param; trang tự đọc key và tự về panel nghỉ khi key lạ |
| `L4-3` | Điều khiển đổi panel của cùng một trang, và lựa chọn là chỗ đọc riêng của người dùng | state cục bộ, **không đụng URL** |
| `L4-4` | Điều khiển đổi một tham số của một khối, không phải vùng nội dung của trang | state cục bộ, bề rộng tự nhiên, nằm trong cột của khối |
| `L4-5` | Điều khiển kéo màn hình đến một chỗ khác trong cùng một tài liệu dài | cuộn tới section gọi theo danh tính, không đổi panel, không đổi route |
| `L4-6` | Chọn một hàng thì phải xem thêm trước khi quyết | preview ghi lựa chọn cục bộ, một nút riêng mới `push` |
| `L4-7` | Chưa ai nói panel này có cần gửi được hay không | **không gì cả**, hỏi lại |

## `L4-1` — đổi trang

Tình huống: bấm vào một destination trên navbar, bấm một hàng trong cột điều hướng của trang học,
bấm nút mở kết quả trong Global Search. Người đọc rời trang hiện tại và đến một trang có chủ riêng,
có metadata riêng và có landmark riêng.

Dấu hiệu kiểm được: có `router.push` với một path, và ở đầu kia có một file route thật đang chờ. Nếu
đầu kia không có gì thì đó không phải `L4-1` mà là một cái cửa, và cửa thuộc về
[`SPINE-6`](../../archetypes/destination-column/INDEX.md) chứ không thuộc luật này.

Ranh giới với `L4-2`: `L4-1` sinh một bước lịch sử vì người đọc thật sự đã đi đâu đó.

## `L4-2` — đổi panel, và giữ lại được trong link

Tình huống: bốn tab của dashboard. Người đọc chuyển sang Community rồi F5, và Community vẫn ở đó.
Họ copy thanh địa chỉ gửi cho bạn, và bạn mở ra thấy đúng cái tab ấy.

Cơ chế có hai nửa và cả hai đều bắt buộc. Nửa thứ nhất là cái điều khiển ghi key bằng `replace` chứ
không phải `push`, nên URL đổi mà lịch sử không dài thêm. Nửa thứ hai là **trang tự đọc key** và tự
quyết. Navbar chỉ ghi, trang mới là nơi biết `overview`, `explore`, `courses`, `community` nghĩa là
gì, và cũng là nơi xử lý trường hợp ai đó gõ tay một key không tồn tại. Key lạ phải rơi về panel
nghỉ, không được để trống vùng chính và cũng không được chuyển hướng, vì một key panel không phải
một route nên nó không có quyền 404.

Chỗ dễ sai nhất ở mã này là dùng nó vì thấy tiện. Query param nhìn thì linh hoạt, nhưng nó là một
lời hứa công khai rằng cái link ấy gửi được, và gỡ một lời hứa như vậy về sau khó hơn nhiều so với
hỏi trước một câu.

## `L4-3` — đổi panel, không đụng URL

Tình huống: trên màn hình hẹp, trang học thay cột điều hướng bằng một dải tab dưới đáy để đổi giữa
danh sách bài, nội dung bài và dàn ý. Người đọc đang ở đúng một bài, và việc họ đang nhìn dàn ý hay
nhìn nội dung là tư thế đọc riêng của họ chứ không phải địa chỉ của cái gì.

Thầy đã bác thẳng cách làm nửa vời ở đây: một dải tab chỉ đổi cái gạch chân đang sáng mà panel bên
dưới đứng yên thì không phải là tab. Panel đổi chính là bằng chứng duy nhất cho thấy cái nút vừa
hoạt động.

Ranh giới với `L4-2`: hỏi xem người đọc có lý do gì để gửi cái tư thế đọc này cho người khác không.
Nếu câu trả lời là không, đừng bắt URL mang nó.

## `L4-4` — tham số của một khối

Tình huống: chọn năm cho biểu đồ đóng góp, đổi phạm vi bảng xếp hạng, đổi kiểu hiển thị lưới hay
danh sách cho danh mục khoá. Cả ba đều đổi cách một khối tự vẽ lại chính nó, và không cái nào đổi
trang đang xem hay đổi vùng nội dung.

Hệ quả về hình dạng không phải chuyện thẩm mỹ mà là chuyện đọc hiểu. Một điều khiển kéo ngang hết
chiều rộng sẽ được đọc như một dải chia trang, và người đọc sẽ tưởng nó điều hướng vùng. Cho nên
tham số giữ bề rộng của mấy chữ trên nó và ngồi ở mép của khối, còn cột giá trị bên dưới vẫn là thứ
đang được đọc chứ không phải thứ đang bị đóng khung.

Đây là mã có lịch sử. Thầy từng yêu cầu kéo dài dải chọn năm cho bằng navbar, trò làm đúng như thế,
rồi thầy nhìn kết quả và lật lại. Chi tiết nằm ở [`changelog.md`](./changelog.md).

## `L4-5` — cuộn trong cùng một tài liệu

Tình huống: bốn nút Tổng quan, Chương trình, Đánh giá, Giảng viên trên trang chi tiết khoá học. Chúng
nằm trên một dải dính đầu trang, rộng hết chiều ngang, dùng đúng cái leaf mà dashboard dùng, nên nhìn
thì không phân biệt được với `L4-2`. Nhưng bấm vào thì không có panel nào bị thay, không có key nào
được ghi, và trang chỉ trượt xuống chỗ tương ứng.

Điều đó hợp lệ vì trang chi tiết khoá học là **một tài liệu liền mạch**, và bốn cái nút chỉ nói bạn
đang đọc tới đâu trong tài liệu đó. Contract của dải này khai đúng như vậy khi nói bốn điều khiển
cùng di chuyển bên trong một tài liệu khoá học.

Cái phải kiểm ở mã này là cách gọi đích. Đích phải được gọi theo danh tính của section, vì gọi theo
thứ tự trong một danh sách quét được sẽ trỏ sai ngay lần đầu có ai đó chèn thêm một section. Repo
sống đang gọi theo thứ tự và đó là một khoản nợ đã đo, ghi trong [`audit.md`](./audit.md).

## `L4-6` — xem trước rồi mới quyết

Tình huống: Global Search. Người dùng đi xuống danh sách kết quả, và mỗi lần dừng ở một hàng thì cột
bên phải nạp chi tiết của hàng đó. Không có chuyển hướng nào xảy ra cho tới khi họ bấm nút mở.

Thầy phán rất gọn cho chỗ này: nếu bấm hàng là điều hướng ngay thì người dùng không bao giờ đọc được
cái panel chi tiết, và như vậy panel ấy không có lý do tồn tại. Cho nên chọn và mở là hai hành vi
tách rời, ứng với hai handler tách rời, và chỉ handler thứ hai được chạm vào router.

Panel chi tiết vẫn được phép có vòng đời riêng của nó, nghĩa là nó có thể đang tải, có thể hỏng và
có thể thử lại, mà nút mở thì không đổi.

## `L4-7` — chưa biết thì hỏi

Tình huống: bản yêu cầu nói "trang này có ba tab" và dừng ở đó. Không có câu nào nói tab có gửi được
hay không.

Đây không phải chỗ để đoán. Không có gì trong cây component gợi ý được câu trả lời, vì cả `L4-2` lẫn
`L4-3` đều dựng bằng cùng một leaf và trông y hệt nhau. Chọn bừa `L4-2` cho chắc là cách đắt nhất,
bởi một khi query param đã ra sản phẩm thì nó thành đường link người ta đã lưu, và gỡ nó đi là phá
link của người khác.

Câu hỏi để hỏi ngắn thôi: *người đọc có bao giờ cần gửi cho ai đó đúng cái tab này không?*

## Vì sao luật này bị lật một lần

Sáu dòng từ chối trên ba hồ sơ, và một trong sáu dòng đó bác chính cái mà một dòng khác trong cùng
hồ sơ đã yêu cầu. Vòng đầu, thầy nhìn dải chọn năm và nói nó phải là một line dài như ShellNav. Trò
làm đúng, kéo nó thành một hàng gạch chân rộng hết cột. Vòng sau, thầy nhìn kết quả và bác, với lý do
rằng nó chỉ đổi một tham số của một hình vẽ chứ không đổi vùng nội dung của trang, và rằng một hàng
gạch chân rộng hết cột được đọc như điều hướng vùng.

Hai vòng không mâu thuẫn, chúng nói về hai chuyện khác nhau. Vòng đầu nói về **cách vẽ**, rằng điều
khiển này phải trông là điều khiển chính chứ không phải phụ. Vòng sau nói về **vai trò**, rằng vai
trò chính không kéo theo quyền chiếm cả chiều ngang. Bản luật cũ trộn hai chuyện đó vào một chữ
"primary", nên nó bị lật. Bản này tách ra, và tiêu chí phân định là câu hỏi *cái nút này đổi cái gì*
chứ không phải câu hỏi nó quan trọng đến đâu.
