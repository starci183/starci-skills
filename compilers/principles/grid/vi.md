---
title: Grid · Vietnamese
---

# Lưới

Đầu vào là một yêu cầu viết bằng lời thường — "bộ lọc bên trái, kết quả bên phải" — và đầu ra là, với
**mỗi phần tử** mà yêu cầu đó ngụ ý, một mã tình huống và một className. Yêu cầu không cho phép bịa ra
một số cột: số cột suy ra từ lời hứa mà cả trang đã cam kết, và từ việc phần tử đang được gọi tên là
**trường**, là **vùng chứa tạo cột**, hay là **một đứa con nằm trong rãnh**.

## Luật

Cột là một lời hứa trang đưa ra một lần rồi giữ ở mọi nơi: nội dung rơi đúng vào những mép dọc dùng
chung, để người đọc đoán được thứ tiếp theo bắt đầu ở đâu trước cả khi nó tải xong. Vì vậy số cột là
thuộc tính của **trường** mà cả trang đã thoả thuận, không phải sở thích mà từng phần nội dung được
phép đặt lại.

Hai phần tử mang hai quyết định khác nhau và không được là cùng một phần tử. **Trường** sở hữu độ dài
dòng và lề ngoài — nơi nội dung được phép tồn tại. **Vùng chứa tạo cột** sở hữu việc có bao nhiêu cột
bên trong độ dài dòng ấy. **Đứa con** chỉ sở hữu thứ nó đòi từ các rãnh đó: một cột, nhiều cột, hoặc
một lần cố ý thoát ra ngoài.

**Đây là luật bắt buộc.** Mọi vùng bày các phần tử ngang hàng lặp lại đều có một tình huống lưới, mọi
con của một vùng chứa tạo cột cũng vậy, và cái vỏ trang bọc chúng cũng vậy. Không có kích thước nào nhỏ
đến mức được miễn: hai ô số liệu đứng cạnh nhau là `GRID-1` đúng cùng một lý do mà cả trang danh mục là
`GRID-1`, và một ảnh nổi bật chạm mép khung nhìn là `GRID-7` dù nó xuất hiện một lần hay ở mọi trang.
Câu "có mỗi hai cái hộp thôi mà" không phải một trường hợp được miễn — đó là chỗ luật này bị bỏ qua
nhiều nhất, và bỏ qua đủ nhiều lần thì một cơ sở mã có mười mấy con số cột không liên quan gì đến nhau,
và **không có trường nào cả**.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `GRID-<số>`. Mã gọi tên TÌNH HUỐNG; cột className
gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có hai mã không phát ra gì cả.

| Mã | Tình huống | className |
|---|---|---|
| `GRID-0` | Các phần tử lặp lại chỉ đọc theo một chiều; không đòi hỏi hệ cột nào | *không khai báo lưới* |
| `GRID-1` | Vùng chứa chốt có bao nhiêu cột, theo từng điểm ngắt | `grid grid-cols-2 lg:grid-cols-3` |
| `GRID-2` | Vùng chứa để số cột suy ra từ bề rộng tối thiểu của phần tử | `grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]` |
| `GRID-3` | Vùng chứa gán vai trò cố định cho từng rãnh được đặt tên | `grid grid-cols-[16rem_minmax(0,1fr)]` |
| `GRID-4` | Trường: lề ngoài và độ dài dòng mà các cột sống bên trong | `mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8` |
| `GRID-5` | Một con chiếm đúng một cột | *không khai báo cách đặt* |
| `GRID-6` | Một con trải qua nhiều cột, hoặc toàn bộ | `col-span-2 lg:col-span-3` |
| `GRID-7` | Một con cố ý phá ra ngoài lề của trường | `col-span-full -mx-4 sm:-mx-6 lg:-mx-8` |

Mã `GRID-0` đến `GRID-4` nói về VÙNG CHỨA hoặc về trường. Mã `GRID-5` đến `GRID-7` nói về một ĐỨA CON
được đặt vào rãnh. Đọc trục trước — "mình đang gọi tên vùng chứa, trường, hay một đứa con?" — rồi cả
tập mã trả lời chỉ trong một bước.

`GRID-0` VÀ `GRID-5` LÀ HAI TÌNH HUỐNG KHÔNG PHÁT RA GÌ. Không có class `grid-cols-1` mặc định cho một
danh sách xếp chồng, và không có `col-span-1` trên một ô bình thường. Hai mã này tồn tại vì **vắng mặt**
một khai báo cũng là một quyết định ai đó đã ra, và một quyết định không có tên là một quyết định không
ai chứng minh được là đã làm sai. Viết `col-span-1` là tuyên bố đứa con đã thương lượng với lưới trong
khi thực ra nó chỉ nhận mặc định; viết `grid grid-cols-1` là tuyên bố trường có một cột trong khi nó
không có cột nào.

Trường mang một số cột cho mỗi điểm ngắt, và số cột của `GRID-1` phải chia hết số đó:

| Điểm ngắt | Số cột của trường | Số cột vùng chứa được phép khai |
|---|---|---|
| cơ sở | 4 | 1, 2, 4 |
| `sm` / `md` | 8 | 1, 2, 4, 8 |
| `lg` trở lên | 12 | 1, 2, 3, 4, 6, 12 |

Thang 4 / 8 / 12 lấy theo lưới bố cục Material, không lấy 4 / 8 / 16 của lưới Carbon 2x, vì một lý do
kiểm được chứ không phải vì đẹp: 12 chia hết cho 2, 3, 4 và 6, nên một hàng ba-phần-tử rơi đúng mép
trường; 16 không chia hết cho 3, nên mọi hàng ba-phần-tử bên trong nó hoặc lẻ rãnh hoặc lệch trường.
Một số cột nằm ngoài hàng của nó trong bảng này — `grid-cols-5`, `grid-cols-7`, `lg:grid-cols-9` — là
đổi luật, không phải một lựa chọn bố cục.

## Đọc một yêu cầu

1. **Liệt kê những phần tử mà yêu cầu nói ra.** "Bộ lọc bên trái, kết quả bên phải, mỗi kết quả là một
   thẻ không hẹp hơn 16rem" nói ra vùng giữ hai vai trò, vùng giữ các thẻ, và một cái thẻ.
2. **Không bịa ra phần tử mà yêu cầu không hề nhắc.** Tiêu đề trang, hàng phân trang hay dải nổi bật
   không nằm trong yêu cầu đó. Giải cái được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong** — trường trước, rồi tới từng vùng chứa tạo cột, rồi tới từng đứa con.
   Một phần tử không bao giờ thừa hưởng mã của cha nó, và một vùng chứa không thừa hưởng mã của con nó.
4. **Với mỗi phần tử, đọc trục trước rồi mới hỏi câu hỏi của mã.** Mình đang gọi tên vùng chứa, trường,
   hay một đứa con? Trong cùng một trục, mã đầu tiên có tình huống khớp chính là đáp án.
5. **Nếu một phần tử đang gánh hai quyết định, phải tách trước rồi mới chọn.** Một nút DOM vừa giữ
   `mx-auto max-w-*` vừa giữ `grid-cols-*` là trường và vùng chứa bị dính làm một; tách thành hai nút
   DOM rồi giải từng cái. Nếu hai mã liền kề cùng khớp, chọn mã **đòi ít hơn**: `GRID-0` trước `GRID-1`,
   `GRID-5` trước `GRID-6`, `GRID-6` trước `GRID-7`.

## `GRID-0` — không có hệ cột, chảy là đủ

**Tình huống.** Các phần tử lặp lại nhưng chỉ được đọc theo MỘT chiều. Không ai cần phần tử ở hàng dưới
thẳng mép với phần tử ở hàng trên, vì "hàng" không phải là một khái niệm của khối này.

**Dấu hiệu nhận biết**

- Danh sách xếp chồng, luồng tin, dòng thời gian, trình đơn điều hướng.
- Một hàng nhãn nhỏ tự xuống dòng khi hết chỗ: có xuống hàng nhưng không có cột, vì mỗi phần tử rộng
  theo nội dung của chính nó.
- Thêm hoặc bớt một phần tử không làm hỏng bố cục của các phần tử còn lại.
- Bề rộng phần tử là hệ quả của nội dung hoặc của cha, không phải một quyết định.

**Tự hỏi.** Phần tử ở hàng sau có bắt buộc phải thẳng mép dọc với phần tử ở hàng trước không? Nếu không
— `GRID-0`.

**Ranh giới**

- `GRID-1`: `flex flex-wrap` sinh ra nhiều hàng nhưng không sinh ra cột. Ba thẻ có bề rộng khác nhau tự
  xuống dòng là `GRID-0`; ba thẻ buộc phải bằng nhau và thẳng mép là `GRID-1`.
- `GRID-2`: `GRID-2` cũng để số cột tự suy ra, nhưng nó CÓ cột: mọi phần tử chia nhau một rãnh đều nhau
  và hàng dưới thẳng mép hàng trên.
- `GRID-4`: một danh sách vẫn nằm trong trường. `GRID-0` nói về nội bộ danh sách, không nói về lề ngoài.

**Không bao giờ viết `grid grid-cols-1`.** Một cột không phải là một hệ cột — đó là dòng chảy. Khai
`grid-cols-1` là tuyên bố trường có một cột, trong khi thật ra nó không có cột nào.

**Tình huống nghiệp vụ hay gặp.** Luồng tin hoạt động · danh sách hoá đơn có đường phân cách · dòng thời
gian nộp bài · trình đơn điều hướng dọc · hàng nhãn nhỏ lọc tự xuống dòng · đường dẫn phân cấp · danh
sách bình luận · các bước của một quy trình · danh sách tệp đính kèm.

## `GRID-1` — chốt số cột

**Tình huống.** Thiết kế HỨA một con số: hai-lên ở thiết bị di động, ba-lên ở máy tính. Số phần tử đã
biết trước hoặc đã được cắt cho vừa con số đó, và người đọc được phép trông cậy vào nhịp ấy.

**Dấu hiệu nhận biết**

- Số cột được nói ra thành lời trong yêu cầu: "ba thẻ một hàng".
- Các phần tử đổi chỗ cho nhau được — chúng cùng loại, cùng vai trò.
- Bề rộng phần tử là HỆ QUẢ của số cột, không phải nguyên nhân.
- Thêm một phần tử thứ tư sẽ xuống hàng, và điều đó chấp nhận được.

**Tự hỏi.** Số cột là lời hứa của thiết kế, hay là hệ quả của việc phần tử không được hẹp hơn một
ngưỡng? Lời hứa — `GRID-1`.

**Ranh giới**

- `GRID-0`: xem trên. Không có yêu cầu thẳng mép thì không có cột.
- `GRID-2`: nếu không ai nói được con số, chỉ nói được "đừng để thẻ hẹp hơn 16rem", thì con số là thứ
  suy ra — `GRID-2`. Chốt bừa một số ở đây là đoán.
- `GRID-3`: nếu các con KHÔNG đổi chỗ cho nhau được — rãnh đầu luôn là bộ lọc, rãnh sau luôn là kết quả
  — thì đó là vai trò cố định, `GRID-3`.

**Số cột phải chia hết trường.** `grid-cols-5` và `lg:grid-cols-7` không nằm trong thang; chúng làm mọi
phần tử lệch khỏi mép trường và biến trường thành trang trí.

**Tình huống nghiệp vụ hay gặp.** Bộ ba ô số liệu · lưới gói giá · hàng thẻ tính năng · lưới ảnh vuông ·
thẻ thành viên nhóm · hai cột biểu mẫu (họ / tên) · lưới huy hiệu · bộ thẻ lộ trình học.

## `GRID-2` — số cột suy ra từ bề rộng tối thiểu

**Tình huống.** Số phần tử đến từ DỮ LIỆU, và thứ duy nhất thiết kế nói được là: một phần tử hẹp hơn
ngưỡng nào đó thì không đọc được nữa. Số cột là thứ rơi ra sau, không phải thứ chọn trước.

**Dấu hiệu nhận biết**

- Số phần tử thay đổi theo tài khoản, theo bộ lọc, theo trang.
- Yêu cầu nói bằng BỀ RỘNG, không nói bằng SỐ LƯỢNG.
- Cùng một khối được nhúng ở nhiều chỗ rộng hẹp khác nhau mà không được sửa lại.
- Hàng cuối thiếu phần tử vẫn phải nhìn ổn.

**Tự hỏi.** Nếu ngày mai dữ liệu trả về mười bảy phần tử thay vì sáu, có ai phải sửa class không? Nếu
không — `GRID-2`.

**Ranh giới**

- `GRID-1`: xem trên. Đây là ranh giới hay bị chọn sai nhất, vì `grid-cols-3` TRÔNG đúng ở màn hình của
  người viết ra nó.
- `GRID-0`: `GRID-2` vẫn phải thẳng mép dọc; `flex flex-wrap` thì không.
- `GRID-3`: `GRID-2` có các rãnh giống hệt nhau; `GRID-3` có các rãnh khác vai trò.

**`auto-fill` hay `auto-fit`.** `auto-fill` giữ nguyên số rãnh kể cả khi thiếu phần tử, nên hàng cuối
không giãn ra. `auto-fit` co các rãnh rỗng lại, nên một phần tử duy nhất sẽ phình hết bề rộng. Chọn
`auto-fill` khi lưới phải giữ nhịp lúc dữ liệu ít, chọn `auto-fit` khi một phần tử duy nhất được phép
chiếm cả hàng.

**Tình huống nghiệp vụ hay gặp.** Kết quả tìm kiếm · danh mục khoá học · thư viện ảnh · danh sách thành
viên · lưới template · kết quả lọc · thẻ thông báo · thanh cuộn ngang.

## `GRID-3` — rãnh có vai trò cố định

**Tình huống.** Các rãnh KHÔNG đổi chỗ cho nhau được. Một bên là thanh dọc, một bên là nội dung; một bên
là vùng vẽ, một bên là bảng kiểm tra. Bề rộng của rãnh là một quyết định bố cục, không phải một phép
chia.

**Dấu hiệu nhận biết**

- Ít nhất một rãnh có bề rộng cố định hoặc bị chặn (`16rem`, `minmax(0,1fr)`).
- Thêm một con thứ ba vào vùng chứa này là SAI, không phải là "xuống hàng".
- Mỗi bên có thể ghim, cuộn riêng, hoặc biến mất ở màn hình hẹp.
- Đổi thứ tự hai con thì trang đọc sai nghĩa, không chỉ xấu đi.

**Tự hỏi.** Nếu đổi chỗ hai con cho nhau, trang có còn đúng nghĩa không? Nếu không — `GRID-3`.

**Ranh giới**

- `GRID-1`: `GRID-1` có các con thay thế được cho nhau; `GRID-3` thì không.
- `GRID-2`: `GRID-2` có rãnh đồng dạng sinh ra hàng loạt; `GRID-3` có rãnh được đặt tên từng cái.
- `GRID-0`: thanh dọc xếp chồng xuống dưới ở thiết bị di động VẪN là `GRID-3`. Thiết kế đáp ứng không
  đổi mã.

**`minmax(0,1fr)` chứ không phải `1fr`.** Rãnh `1fr` có min-width mặc định là `auto`, nên một nội dung
không co được — bảng rộng, khối mã — sẽ đẩy rãnh phình ra và ăn mất thanh dọc. Đây là lỗi runtime, không
phải lỗi thẩm mỹ.

**Tình huống nghiệp vụ hay gặp.** Thanh dọc bộ lọc + vùng kết quả · điều hướng + nội dung · vùng vẽ +
bảng kiểm tra · hộp thư + khung hội thoại · mục lục + bài đọc · danh mục + khung giỏ hàng · cây thư mục +
trình soạn thảo · biểu mẫu + khung tóm tắt đơn hàng.

## `GRID-4` — trường: lề ngoài và độ dài dòng

**Tình huống.** Một phần tử quyết định NỘI DUNG ĐƯỢC PHÉP TỒN TẠI Ở ĐÂU: nó căn giữa, chặn bề rộng tối
đa, và đặt lề ngoài. Nó không nói gì về số cột.

**Dấu hiệu nhận biết**

- `mx-auto` cộng một `max-w-*`.
- Khoảng đệm trong ngang đổi theo điểm ngắt — chính khoảng đệm ấy là lề ngoài.
- Mọi phần nội dung của trang đều nằm trong nó và không tự khai lại một `max-w` riêng.
- Bỏ nó đi thì chữ chạy dài hết màn hình 27 inch.

**Tự hỏi.** Phần tử này đang quyết định NỘI DUNG KẾT THÚC Ở ĐÂU, hay CÓ BAO NHIÊU CỘT? Kết thúc ở đâu —
`GRID-4`.

**Ranh giới**

- `GRID-1`, `GRID-2`, `GRID-3`: trường không khai rãnh. Một nút DOM vừa `max-w-6xl mx-auto px-4` vừa
  `grid grid-cols-3` đang gánh hai quyết định; phải tách làm hai nút DOM.
- `GRID-7`: phá ra ngoài lề là một lần thoát ra rồi quay lại. Một trường rộng hơn thì vẫn là trường.

**Lề ngoài không bao giờ nhỏ hơn khe cột.** Nếu `gap-6` mà lề chỉ `px-4`, cột ngoài cùng dính vào mép
màn hình chặt hơn các cột dính vào nhau — người đọc thấy lưới bị lệch mà không nói được vì sao.

**Giá trị khe cột không được chọn ở đây.** Nó thuộc về mô-đun khoảng cách. Thứ mô-đun này sở hữu là:
MỘT trường, MỘT khe cột cho mỗi điểm ngắt, và khe cột là khoảng cách ngang duy nhất giữa các cột.

**Tình huống nghiệp vụ hay gặp.** Vỏ trang · khung của bố cục đã đăng nhập · vùng chứa của một phần nội
dung trên landing · vùng đọc của bài viết dài (`max-w-prose`) · vùng nội dung của hộp thoại · vùng nội
dung in ấn.

## `GRID-5` — một con, đúng một cột

**Tình huống.** Một đứa con NHẬN đúng cái rãnh mà vùng chứa đưa cho nó. Nó không thương lượng gì cả. Đây
là tình huống phổ biến nhất trong toàn mô-đun, và cũng là tình huống hay bị viết thừa class nhất.

**Dấu hiệu nhận biết**

- Không có class cách đặt nào trên con.
- Bề rộng của nó do vùng chứa quyết, không do nó quyết.
- Đưa nó sang một vùng chứa khác thì nó tự vừa, không cần sửa.

**Tự hỏi.** Con này có ĐÒI gì từ lưới không? Nếu không — `GRID-5`, và không viết gì cả.

**Ranh giới**

- `GRID-6`: `GRID-6` đòi nhiều hơn một cột. Đòi thì phải nói ra bằng `col-span-*`.
- `GRID-7`: `GRID-7` đi ra khỏi lề của trường. `GRID-5` không bao giờ ra khỏi rãnh của nó.

**Không bao giờ viết `col-span-1`.** Không đòi hỏi là **trạng thái vắng mặt** của một yêu cầu, không
phải một yêu cầu bằng một. `GRID-5` là mã tình huống, không phải tên class CSS. Ngoại lệ duy nhất là khi
`col-span-1` là một bậc thật: nó huỷ một độ trải cột đã khai ở điểm ngắt khác, như trong
`col-span-2 lg:col-span-1`, và đó là một phần của thang `GRID-6`.

**`min-w-0` không phải class cách đặt.** Nó chặn nội dung không co được — bảng, khối mã, chuỗi dài — làm
phình rãnh. Một `GRID-5` có `min-w-0` vẫn là `GRID-5`.

**Tình huống nghiệp vụ hay gặp.** Một thẻ khoá học trong lưới danh mục · một ô số liệu · một ảnh trong
thư viện · một trường nhập liệu trong biểu mẫu hai cột · một thẻ thành viên · một bảng nằm trọn trong
một cột.

## `GRID-6` — một con trải nhiều cột

**Tình huống.** Một đứa con QUAN TRỌNG HƠN hoặc RỘNG HƠN phần còn lại, và nó nói điều đó bằng số cột nó
chiếm — chứ không bằng bề rộng riêng.

**Dấu hiệu nhận biết**

- Phần tử đầu tiên của lưới là phần tử nổi bật, các phần tử sau bình thường.
- Một biểu đồ cần bề ngang mới đọc được, trong khi các ô cạnh nó thì không.
- Một hàng tiêu đề hoặc một trạng thái rỗng phải nằm hết bề ngang của lưới.
- Số cột chiếm được đổi theo điểm ngắt, nhưng vai trò thì không.

**Tự hỏi.** Con này có đòi NHIỀU HƠN MỘT CỘT của chính lưới đang chứa nó không?

**Ranh giới**

- `GRID-5`: xem trên.
- `GRID-7`: `col-span-full` vẫn nằm TRONG lề của trường. Chỉ khi nó tiếp tục đi ra ngoài lề đó thì mới
  là `GRID-7`.
- `GRID-3`: nếu MỌI con đều có độ trải cột riêng và cố định, thứ đang được dựng là rãnh có vai trò —
  hãy khai `GRID-3` ở vùng chứa thay vì rải độ trải cột lên từng con.

**Không bao giờ giả độ trải cột bằng bề rộng.** `w-2/3` hay `basis-2/3` trên một con của lưới không cho
nó hai cột; nó cho hai phần ba của MỘT cột, và mọi thứ dưới nó lệch mép. Độ trải cột cũng không được
lớn hơn số cột ở điểm ngắt đó: `col-span-3` trong một lưới hai cột ở bậc cơ sở bị kẹp về hai một cách im
lặng, nên một độ trải có điểm ngắt phải có đủ bậc — `col-span-2 lg:col-span-3`.

**Tình huống nghiệp vụ hay gặp.** Thẻ nổi bật đầu lưới · biểu đồ rộng trong bảng điều khiển · trạng thái
rỗng chiếm cả lưới · biểu ngữ thông báo trong lưới thẻ · ô ghi chú dài trong biểu mẫu nhiều cột · hàng
tổng kết cuối lưới số liệu.

## `GRID-7` — cố ý phá ra ngoài trường

**Tình huống.** Một khối BUỘC phải chạm mép — hoặc mép của trường, hoặc mép khung nhìn — trong khi mọi
thứ trước và sau nó vẫn tôn trọng lề. Đây là ngoại lệ được KHAI BÁO, không phải một lần lách.

**Dấu hiệu nhận biết**

- Nền có màu hoặc có ảnh, và phần nền hở ra hai bên trông như lỗi.
- Một thanh cuộn ngang phải "chảy" ra khỏi mép để người đọc biết còn nữa ở bên phải.
- Trước và sau khối đó, nội dung quay lại đúng lề cũ.

**Tự hỏi.** Khối này có buộc phải chạm mép để nói đúng ý nó không, hay chỉ là muốn rộng hơn một chút?
Muốn rộng hơn một chút thì đó là một `GRID-4` sai số, không phải `GRID-7`.

**Ranh giới**

- `GRID-6`: `col-span-full` là trải hết CỘT; `GRID-7` là ra khỏi LỀ.
- `GRID-4`: nếu cả trang cần rộng hơn thì sửa trường, đừng cho từng khối tự phá ra.

**Phá lề là do trường cho phép, không do con tự lấy.** Một `-mx-*` chỉ đúng khi nó triệt tiêu ĐÚNG
khoảng đệm trong của trường ở CÙNG điểm ngắt. Con nằm sâu ba tầng mà tự `-mx-8` là đang đoán khoảng đệm
của tổ tiên nó. Một lần phá lề phải là con trực tiếp của trường, hoặc phải `col-span-full` trước rồi mới
rời lề.

**Phá hết khung nhìn có giá phải trả.** `w-screen` bằng `100vw`, và `100vw` TÍNH CẢ THANH CUỘN, nên trên
trình duyệt có scrollbar chiếm chỗ nó tạo tràn ngang. Muốn dùng thì một tổ tiên phải nhận
`overflow-x-clip`, và đó là quyết định của trang chứ không phải của khối. Bên trong khối phá lề, trường
được khai lại để chữ vẫn nằm đúng độ dài dòng: phá lề là việc của nền, không phải của nội dung.

**Tình huống nghiệp vụ hay gặp.** Vùng nổi bật có ảnh nền · dải chứng thực nền màu · thanh cuộn ngang
trên thiết bị di động · bảng rộng cần cuộn ngang · dải phân cách toàn chiều rộng · bản đồ nhúng · băng
thông báo trên cùng trang.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| trường | Phần tử sở hữu độ dài dòng và lề ngoài, cùng số cột của nó ở mỗi điểm ngắt |
| vùng chứa | Phần tử khai rãnh, và liệu nó có chính là trường hay không |
| nguồn phần tử | Số lượng phần tử do người viết đặt hay đến từ dữ liệu |
| vai trò phần tử | Các con thay thế được cho nhau hay mỗi rãnh có một vai trò riêng |
| căn mép | Các phần tử ở những hàng kế tiếp có bắt buộc chung một mép dọc không |
| hình học | Phần tử nào quyết định bề rộng, phần tử nào chỉ lấp đầy chỗ được cấp |

## Quy tắc

1. Trường sở hữu độ dài dòng và lề ngoài; vùng chứa sở hữu rãnh. **Một nút DOM không giữ cả hai.**
2. Số cột khai báo phải chia hết số cột của trường ở điểm ngắt đó.
3. Khe cột là khoảng cách ngang **duy nhất** giữa các cột; cột không tự thêm lề ngang để tạo khoảng
   cách.
4. Giá trị khe cột thuộc mô-đun khoảng cách; mô-đun này chỉ giữ luật MỘT trường, MỘT khe cột mỗi điểm
   ngắt.
5. Lề ngoài không bao giờ nhỏ hơn khe cột.
6. Mỗi con của vùng chứa tạo cột rơi vào đúng một trong `GRID-5`, `GRID-6`, `GRID-7`.
7. Con không bao giờ dùng `width` hay `basis` của chính nó để giả một độ trải cột.
8. Đổi số cột theo điểm ngắt KHÔNG đổi mã.
9. Khi hai mã liền kề cùng hợp lý, chọn mã đòi ít hơn: `GRID-0` trước `GRID-1`, `GRID-5` trước `GRID-6`,
   `GRID-6` trước `GRID-7`.

Ngoài ra: một mã tình huống ứng với đúng một hình dạng className, và không hình dạng className nào phục
vụ hai mã.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Bảng.** `<table>` chạy thuật toán cột riêng của nó. Với mô-đun này, một bảng là MỘT đứa con —
  `GRID-5` hoặc `GRID-6` — và cột bên trong bảng nằm ngoài phạm vi.
- **Độ dài dòng đọc.** Văn bản dài bị chặn bởi độ dài dòng đọc được, không bởi số cột của trường. Một độ
  dài dòng hẹp hơn lồng trong trường là một `GRID-4` thứ hai, và đó là trường lồng duy nhất được phép.
- **Đúng một phần tử, mãi mãi.** Vùng chứa chỉ hiển thị một thứ và sẽ luôn như vậy là `GRID-0`, không
  phải `GRID-1` với số cột bằng một.
- **Số phần tử không biết trước.** Khi số lượng đến từ dữ liệu và thiết kế chỉ nói được bề rộng tối
  thiểu, tình huống là `GRID-2`, và chốt một con số ở đó là đoán.
- **Thanh cuộn ngang.** Là `GRID-2` theo trục cuộn của nó; nếu đồng thời vươn ra ngoài lề của trường thì
  nó cũng mang `GRID-7` với tư cách một đứa con. Hai mã, hai phần tử — không bao giờ hai mã trên cùng
  một phần tử.
- **Tính đồng nhất trạng thái.** Khung chờ, trạng thái rỗng và nội dung thật dùng chung một mã. Lưới
  rỗng đổi số cột là nói dối về hệ cột, và người dùng thấy bố cục nhảy đúng lúc dữ liệu về.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi vai trò bố cục thật sự đổi, không phải khi màn hình hẹp đi. Thanh
  dọc xếp chồng ở thiết bị di động vẫn là `GRID-3`.
- **In ấn và thư điện tử.** Trường vẫn tồn tại, chỉ là độ dài dòng khác. Bỏ hẳn trường trong bản in là
  bỏ luật, không phải thích nghi với môi trường.
- **Hai mã liền kề cùng khớp.** Chọn mã đòi ít hơn. Chỉ hỏi MỘT câu phân định khi bên yêu cầu nói rõ họ
  cần lời tuyên bố mạnh hơn.

## Đầu ra

Mỗi phần tử một khối, từ ngoài vào trong. Khoá `child` chỉ xuất hiện khi tình huống là tình huống của
một đứa con:

```text
field: <phần tử sở hữu độ dài dòng, lề ngoài, số cột của trường ở điểm ngắt này>
container: <phần tử sở hữu rãnh>
child: <phần tử đang được đặt, khi tình huống là của một đứa con>
situation: <GRID-0 | GRID-1 | GRID-2 | GRID-3 | GRID-4 | GRID-5 | GRID-6 | GRID-7>
className: <không class | grid-cols-* | rãnh đặt tên | độ dài dòng | col-span-* | phá lề>
reason: <sự thật nghiệp vụ loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Một trang danh mục khoá học: nội dung đừng chạy dài hết màn hình lớn; bộ lọc bên trái, kết
quả bên phải; mỗi kết quả là một thẻ và thẻ không được hẹp hơn 16rem; khi không có gì khớp thì hiện một
dòng thông báo chiếm hết cả lưới."

Yêu cầu này nói ra trường, vùng giữ hai vai trò, hai con của vùng đó, vùng giữ các thẻ, một cái thẻ, và
dòng thông báo khi rỗng. Nó không nói tới tiêu đề trang, không nói tới phân trang, không nói tới dải nổi
bật, không nói tới phá lề, nên không giải những thứ đó.

```text
field: vỏ trang, mx-auto max-w-6xl, 4 / 8 / 12 cột
container: vỏ trang
situation: GRID-4
className: mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8
reason: nó quyết định nội dung kết thúc ở đâu chứ không quyết định có bao nhiêu cột, điều này loại trừ GRID-1
```

```text
field: vỏ trang
container: vùng bộ lọc và kết quả
situation: GRID-3
className: grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]
reason: hai rãnh không đổi chỗ cho nhau được — đổi bộ lọc với kết quả thì trang đọc sai nghĩa — điều này loại trừ GRID-1
```

```text
field: vỏ trang
container: vùng bộ lọc và kết quả
child: thanh dọc bộ lọc
situation: GRID-5
className: không class cách đặt
reason: thanh dọc nhận đúng rãnh 16rem được cấp và không đòi thêm gì, điều này loại trừ GRID-6
```

```text
field: vỏ trang
container: vùng bộ lọc và kết quả
child: vùng kết quả
situation: GRID-5
className: không class cách đặt
reason: vùng kết quả lấp đầy rãnh được cấp chứ không đòi thêm một rãnh thứ hai, điều này loại trừ GRID-6
```

```text
field: vỏ trang
container: lưới kết quả
situation: GRID-2
className: grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]
reason: yêu cầu nói bằng bề rộng tối thiểu của thẻ và số kết quả đến từ dữ liệu, điều này loại trừ GRID-1
```

```text
field: vỏ trang
container: lưới kết quả
child: thẻ kết quả
situation: GRID-5
className: không class cách đặt
reason: thẻ nhận đúng một rãnh suy ra và không bao giờ tự đặt bề rộng, điều này loại trừ GRID-6
```

```text
field: vỏ trang
container: lưới kết quả
child: dòng thông báo khi rỗng
situation: GRID-6
className: col-span-full
reason: thông báo phải chiếm hết mọi cột nhưng vẫn nằm trong lề của trường, điều này loại trừ GRID-7
```

Yêu cầu không hề nói danh mục là ba-lên cố định, nên không chốt số cột nào; nó cũng không nói khối nào
chạm mép màn hình, nên không có gì rơi vào `GRID-7`; và vì khung chờ với trạng thái rỗng dùng chung mã
với nội dung thật, lưới lúc đang tải vẫn giữ nguyên `GRID-2`.

## Phạm vi

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành phần
nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup thường.
