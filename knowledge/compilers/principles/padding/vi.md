---
title: Padding · Vietnamese
---

# Khoảng đệm trong

## LOADS

None.


## Bản ghi

Nguyên tắc này nhận một yêu cầu viết bằng lời thường — "một thẻ thanh toán, bên trong có danh sách hoá đơn" —
rồi trả về là, với **mỗi phần tử** mà yêu cầu đó ngụ ý, một mã tình huống và một className. Yêu cầu
không bao giờ nói ra một khoảng đệm, và không được phép ước lượng một khoảng đệm: khoảng đệm suy ra
từ việc **ranh giới nào sở hữu** phần tử đó và ranh giới ấy **chịu trách nhiệm cho cái gì**.

## Luật

Khoảng đệm trong là khoảng đệm mà một **ranh giới** dành cho nội dung trực tiếp của chính nó. Ranh
giới là phần tử **vẽ ra một ranh giới** — nền, viền, đổ bóng, ô kẻ — hoặc **sở hữu ranh giới đó về
mặt ngữ nghĩa**, ví dụ mặt phẳng mà cả một tuyến trang sinh ra để phục vụ.

Chọn khoảng đệm từ việc ranh giới đó chịu trách nhiệm cho cái gì, không bao giờ từ việc kết quả trông
có vẻ rộng rãi tới đâu. Kích thước, ảnh chụp màn hình, và những chữ "thoáng", "chật", "to" đều không
phải bằng chứng.

Khoảng đệm trong không bao giờ đẩy phần tử cùng cấp. Khoảng cách giữa các phần tử cùng cấp là việc
của `gap` trên phần tử cha; một phần tử phình khoảng đệm của mình để đẩy hàng xóm là đang trả lời một
câu hỏi không ai hỏi.

**Đây là luật bắt buộc.** Mọi phần tử hiển thị ra đều hoặc là ranh giới hoặc không, và cả hai câu trả
lời đều có mã ở dưới. Không có kích thước nào nhỏ đến mức được miễn: một ô hai dòng trong dải chia kẻ
là `PADDING-2`, đúng cùng một lý do mà mặt phẳng đọc tài liệu là `PADDING-6`. Câu "nó chỉ là cái lớp
bọc thôi mà" không phải một trường hợp được miễn — đó là chỗ luật này bị bỏ qua nhiều nhất, và nó có
mã riêng chính để việc bỏ qua ấy gọi được thành tên.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `PADDING-<bậc>`. Mã gọi tên TÌNH HUỐNG; cột
className gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có một mã phát ra hai
thứ khác nhau, vì đúng một lý do nêu ngay dưới đây.

| Mã | Tình huống | className |
|---|---|---|
| `PADDING-0` | Phần tử không sở hữu khoảng đệm trong nào của riêng nó | *không khai báo class khoảng đệm*, hoặc `p-0` khi một ranh giới thật uỷ quyền |
| `PADDING-2` | Ô lặp lại gọn, chỉ chứa một dữ kiện ngắn hoặc một hành động | `p-2` |
| `PADDING-3` | Ô lặp lại hoặc ô kẻ thường, chứa một nhóm nội dung nhỏ | `p-3` |
| `PADDING-4` | Bề mặt thông thường, hàng đã cấu thành, hoặc khối nhấn mạnh lồng bên trong | `p-4` |
| `PADDING-6` | Mặt phẳng đọc hoặc làm việc chính của tuyến trang | `p-6` |

`PADDING-0` LÀ MỘT TÌNH HUỐNG, KHÔNG PHẢI MỘT BẬC, và nó là mã duy nhất phát ra hai thứ. Tình huống
là "phần tử này không sở hữu khoảng đệm trong nào". Hai thứ nó phát ra trả lời một câu hỏi thứ hai,
đóng — *ở đây có tồn tại một ranh giới thật hay không?*

- **Không có ranh giới.** Một lớp bọc trong suốt chỉ dựng một cụm xếp dọc, một lưới hay một hàng. Nó
  không sở hữu gì để mà đệm, nên nó phát ra **không class khoảng đệm nào**. Viết `p-0` lên nó là
  tuyên bố rằng một ranh giới đã ra quyết định, ở nơi không có ranh giới nào tồn tại.
- **Ranh giới uỷ quyền.** Một ranh giới thật giao toàn bộ khoảng đệm của mình cho các hàng, các ô
  trực tiếp, hoặc cho đúng một nội dung con — để đường kẻ chạm tới mép, hoặc để ảnh tràn sát viền. Nó
  phát ra **`p-0`**, viết thành chữ, vì việc uỷ quyền là một quyết định và người đọc sau phải thấy
  được rằng quyết định ấy đã được đưa ra chứ không phải bị quên.

Vì vậy, vắng mặt một class và `p-0` không thể thay thế cho nhau, và đây là quyết định lâu đời nhất
của mô-đun này. Cả hai vẫn nằm chung một mã vì cả hai cùng mô tả một khoảng đệm — bằng không — và
tách chúng thành hai mã sẽ ngụ ý rằng thang có hai bậc không, điều không đúng.

Thang này thủng ở `1`, `5` và mọi giá trị trên `6`. Một thang đóng và có lỗ hổng buộc người viết phải
quyết định vai trò của ranh giới; một thang liền mời người ta chia đôi khoảng cách, tức là để thẩm mỹ
quay lại quyết định thông qua phép tính. Thêm một bậc là đổi luật, không bao giờ là một lần chọn khác
đi tại chỗ.

## Đọc một yêu cầu

1. **Liệt kê những phần tử mà yêu cầu nói ra.** "Một thẻ thanh toán, bên trong có danh sách hoá đơn"
   nói ra ba: thẻ, danh sách, và từng hàng hoá đơn.
2. **Không bịa ra phần tử mà yêu cầu không hề nhắc.** Tiêu đề trang, thanh bộ lọc hay hộp thoại không
   nằm trong yêu cầu đó. Giải cái được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong**, rồi tới từng phần tử lồng bên trong. Mỗi phần tử có đáp án riêng;
   ranh giới không bao giờ thừa hưởng mã của con nó, và con cũng không thừa hưởng mã của ranh giới.
4. **Với mỗi phần tử, hỏi xem nó có vẽ ra hoặc sở hữu về ngữ nghĩa một ranh giới không.** Nếu không,
   nó là `PADDING-0` thể không class, và không có gì khác được quyết định về nó nữa.
5. **Nếu nó là một ranh giới, gọi tên nội dung trực tiếp của nó rồi hỏi câu hỏi của từng mã** trong
   phần của mã đó. Mã đầu tiên có tình huống khớp chính là đáp án. Một ranh giới giao toàn bộ khoảng
   đệm cho hàng, ô hoặc một nội dung con là `PADDING-0` thể `p-0`.
6. **Nếu một phần tử trộn nhiều vai trò, phải tách ranh giới trước.** Một lớp bọc vừa bị bắt làm việc
   xếp đặt vừa bị bắt làm bề mặt thì không có đáp án đúng nào. Nếu hai bậc liền kề cùng khớp, chọn
   bậc nhỏ hơn.
7. **Nếu yêu cầu chưa xác lập ai sở hữu ranh giới hoặc ranh giới ấy đóng vai trò gì, không phát
   khoảng đệm nào từ phía bên sử dụng**, và chỉ hỏi đúng một câu cụ thể khi bên yêu cầu nói rõ họ cần
   một khoảng đệm khác mặc định. Câu trả lời phải là một className hoặc một câu hỏi, không bao giờ cả
   hai.

## `PADDING-0` — phần tử không sở hữu khoảng đệm trong nào

**Khi nào gặp.** Phần tử không sở hữu khoảng đệm trong nào của riêng nó. Đứng sau một tình huống ấy là
hai chuyện khác nhau. Ở thể thứ nhất, hoàn toàn không có ranh giới: lớp bọc tồn tại chỉ để xếp đặt —
dựng cụm xếp dọc, dựng lưới, dựng một hàng — nó không vẽ nền, không vẽ viền, không mang ngữ nghĩa
ranh giới nào, nên không có gì để đệm và phát ra không class khoảng đệm nào. Ở thể thứ hai, có ranh
giới thật, và nó cố ý giao toàn bộ khoảng đệm cho các hàng, các ô trực tiếp, hoặc cho đúng một nội
dung con, để đường kẻ chạm tới mép hoặc để ảnh tràn sát viền; nó phát ra `p-0`.

**Cách nhận ra**

- *Không có ranh giới:* xoá phần tử này đi thì không có ranh giới nào biến mất, chỉ có bố cục vỡ;
  class của nó chỉ gồm `flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `min-w-0`; nội dung bên trong
  đã tự có bề mặt riêng, hoặc đang nằm trong một bề mặt của cha.
- *Ranh giới uỷ quyền:* có `border`, `bg-*` hoặc `rounded-*` trên phần tử này; các con trực tiếp tự
  thêm khoảng đệm và tự là vùng bấm được; nếu cha giữ lại khoảng đệm, đường phân cách sẽ hụt hai đầu
  và danh sách trông như bị cắt cụt.

**Tự hỏi.** Nếu bỏ hết class trang trí đi, phần tử này còn vẽ ra ranh giới nào không? Nếu không, đó
là thể không class. Nếu còn, ranh giới đó có thật và có đang *cố ý* giao khoảng đệm cho con không?
Nếu có, đó là thể `p-0`.

**Ranh giới**

- Giữa hai thể: `p-0` là quyết định của một ranh giới thật. Lớp bọc trong suốt không có quyền ra
  quyết định đó, vì nó không sở hữu ranh giới nào để mà uỷ quyền. Đây là khác biệt lâu đời nhất của
  mô-đun này và cũng là chỗ bị viết sai nhiều nhất.
- `PADDING-4`: một lớp bọc được thêm `border` hoặc `bg-*` là vừa TRỞ THÀNH ranh giới — và lúc đó nó
  phải nhận một khoảng đệm, không được để trống. Một danh sách mà gốc giữ `p-4` *và* vẫn kẻ `divide-y`
  là đang nói ranh giới hai lần theo hai cách mâu thuẫn.

**Viết `p-0` ra thành chữ, đừng bỏ trống.** Uỷ quyền là một quyết định; người đọc sau phải phân biệt
được "đã quyết định giao đi" với "quên chưa đặt".

**Tình huống nghiệp vụ hay gặp.** *Không có ranh giới:* cụm xếp dọc giữa tiêu đề và biểu mẫu bên
trong một khung có sẵn · lưới xếp các thẻ · cột nội dung của trang · hàng bọc hai nút · lớp bọc
`min-w-0` để cắt chữ · vùng bọc chỉ để đặt `gap`. *Ranh giới uỷ quyền:* danh sách có đường phân cách
· khung bảng dữ liệu · dải số liệu chia cột · thẻ có ảnh bìa tràn viền · trình đơn lệnh · luồng tin
thông báo · khung chứa bảng cuộn ngang.

## `PADDING-2` — ô lặp lại gọn

**Khi nào gặp.** Một ô lặp lại trong một tập ô giống nhau, và nó chỉ chứa một dữ kiện ngắn hoặc một
hành động. Ô tồn tại để đếm được, quét mắt được, không phải để đọc.

**Cách nhận ra**

- Nội dung là một con số, một nhãn, một ngày, một phím tắt, một trạng thái.
- Các ô cùng bộ đều giống nhau về cấu trúc; đọc một ô là hiểu cả bộ.
- Ô nằm trong một cha đã uỷ quyền khoảng đệm của mình (`PADDING-0` thể `p-0`).

**Tự hỏi.** Ô này chứa MỘT dữ kiện, hay chứa MỘT NHÓM dữ kiện?

**Ranh giới**

- `PADDING-3`: có nhóm — nhãn cộng giá trị cộng trạng thái — thì lên `PADDING-3`. Một con số kèm đơn
  vị của chính nó vẫn là MỘT dữ kiện.
- `PADDING-4`: ô lặp lại không phải bề mặt dùng lại được. Nếu phần tử đó tự đứng một mình ở chỗ khác
  cũng đúng nghĩa thì nó là bề mặt, không phải ô.

**Không dùng `PADDING-2` để "cho gọn hơn".** Gọn là hệ quả của việc ô chỉ có một dữ kiện, không phải
tiêu chí để chọn.

**Tình huống nghiệp vụ hay gặp.** Ô số liệu trong dải chia cột · ô ngày trong lịch · ô phím tắt · ô
chú giải biểu đồ · hàng dày đặc chỉ có một nhãn · ô nhãn màu trong bảng trạng thái · ô đơn vị trong
bảng quy đổi.

## `PADDING-3` — ô lặp lại có một nhóm nhỏ

**Khi nào gặp.** Vẫn là ô lặp lại hoặc ô kẻ, nhưng bên trong đã là một nhóm nội dung nhỏ: nhãn và giá
trị, tiêu đề và dòng phụ, tên và trạng thái.

**Cách nhận ra**

- Bên trong ô đã cần tới `gap` để tổ chức các phần của nó.
- Ô vẫn thuộc một bộ đồng dạng, vẫn không tự đứng một mình được.
- Đường kẻ hoặc lưới vẫn là thứ phân tách các ô, không phải khoảng trắng.

**Tự hỏi.** Ô này đã cần cấu trúc bên trong chưa, và nó có còn phụ thuộc vào bộ của mình không?

**Ranh giới**

- `PADDING-2`: xem trên.
- `PADDING-4`: câu hỏi quyết định là tự đứng được hay không. Một hàng trong danh sách kẻ là
  `PADDING-3`; cũng nội dung đó nhưng bọc trong một thẻ có viền riêng, rời khỏi danh sách vẫn đúng,
  là `PADDING-4`.

**Tình huống nghiệp vụ hay gặp.** Ô lưới có nhãn + giá trị + trạng thái · hàng danh sách có dòng
chính và dòng phụ · ô bảng số liệu · dòng lịch sử giao dịch · dòng thành viên có vai trò · ô so sánh
gói dịch vụ.

## `PADDING-4` — bề mặt thông thường

**Khi nào gặp.** Một bề mặt dùng lại được: nó tự vẽ ranh giới, ôm một cụm nội dung đã cấu thành, và
mang đi chỗ khác vẫn đọc được nguyên nghĩa. Đây là bậc mặc định của mọi thẻ, khung và khối nhấn mạnh
lồng bên trong.

**Cách nhận ra**

- Có ranh giới thật và có nhiều loại nội dung bên trong: tiêu đề, mô tả, số liệu, hành động.
- Bên cạnh nó có những bề mặt ngang hàng khác.
- Nó KHÔNG phải lý do tồn tại của cả tuyến trang.

**Tự hỏi.** Đây là một bề mặt dùng lại được nằm giữa những bề mặt khác, hay là mặt phẳng chính của
tuyến trang?

**Ranh giới**

- `PADDING-3`: xem trên.
- `PADDING-6`: chỉ lên `PADDING-6` khi tuyến trang CHỈ tồn tại vì mặt phẳng này. Một thẻ to vẫn là
  thẻ; kích thước không nâng bậc.

**Khối nhấn mạnh lồng bên trong cũng là `PADDING-4`.** Nó thêm nền hoặc viền của riêng nó, nên nó là
ranh giới thật, nên nó phải có khoảng đệm. Nhưng cụm xếp dọc nằm giữa thẻ và khối nhấn mạnh thì
KHÔNG — cụm xếp dọc là `PADDING-0` thể không class.

**Tình huống nghiệp vụ hay gặp.** Thẻ khoá học · khung hồ sơ · khối tóm tắt thanh toán · khối nhấn
mạnh cảnh báo hạn mức · hàng đã cấu thành trong một danh sách · thẻ trạng thái rỗng · thẻ thông báo
lỗi · khối biểu mẫu có viền.

## `PADDING-6` — mặt phẳng chính

**Khi nào gặp.** Tuyến trang này sinh ra để phục vụ đúng một việc, và đây là mặt phẳng chứa việc đó:
một bài đọc, một luồng làm bài, một tài liệu, một biểu mẫu dài. Không có bề mặt nào ngang hàng cạnh
tranh sự chú ý với nó.

**Cách nhận ra**

- Chỉ có một mặt phẳng như thế trên tuyến trang.
- Nội dung bên trong là dòng chảy dài, cần biên nghỉ mắt để đọc liên tục.
- Bỏ mặt phẳng này đi thì tuyến trang mất lý do tồn tại.

**Tự hỏi.** Nếu bỏ mặt phẳng này, tuyến trang còn nghĩa gì không?

**Ranh giới**

- `PADDING-4`: xem trên. "To hơn", "thoáng hơn", một ảnh chụp màn hình — KHÔNG phải bằng chứng. Bằng
  chứng duy nhất là vai trò trên tuyến trang. Hai mặt phẳng chính trên một tuyến trang là mâu thuẫn:
  hoặc một trong hai là `PADDING-4`, hoặc tuyến trang đang làm hai việc, và đó là vấn đề của tuyến
  trang chứ không phải của khoảng đệm trong.

**Tình huống nghiệp vụ hay gặp.** Mặt phẳng đọc bài học · vùng làm bài kiểm tra · trang tài liệu ·
một biểu mẫu dài chiếm cả tuyến trang · vùng nội dung của hộp thoại khi hộp thoại chỉ có một việc ·
trang kết quả sau khi nộp bài.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| chủ ranh giới | Phần tử vẽ ra hoặc sở hữu về ngữ nghĩa ranh giới đó |
| nội dung trực tiếp | Một dữ kiện, một nhóm nhỏ, một bề mặt đã cấu thành, hoặc việc chính của tuyến trang |
| uỷ quyền | Hàng, ô trực tiếp hoặc một nội dung con có đang sở hữu khoảng đệm thay cho nó không |
| lồng nhau | Phần tử bên trong là lớp bọc trong suốt hay là một ranh giới thật thứ hai |
| vai trò | Bề mặt thông thường dùng lại được, hay mặt phẳng mà tuyến trang sinh ra để phục vụ |

## Quy tắc

1. Tìm phần tử vẽ ra hoặc sở hữu về ngữ nghĩa ranh giới đó trước. Nó là chủ sở hữu khoảng đệm, và
   không phần tử nào khác được thêm khoảng đệm thay nó.
2. Chỉ nội dung TRỰC TIẾP của ranh giới đó quyết định bậc.
3. Một ranh giới nhận đúng một quyết định khoảng đệm.
4. Lớp bọc chỉ xếp đặt thì không có class khoảng đệm nào cả — không phải `p-0`.
5. Bề mặt nằm trong bề mặt chỉ có khoảng đệm riêng khi nó thật sự thêm nền, viền hoặc ranh giới ngữ
   nghĩa.
6. Khoảng đệm trong không dùng để tách phần tử cùng cấp; khoảng cách đó thuộc `gap` của phần tử cha.
7. Đang tải, rỗng, lỗi và sẵn sàng hiển thị chung một cây khoảng đệm.
8. Đổi trục hay đổi khung nhìn không đổi khoảng đệm, trừ khi vai trò của ranh giới thật sự đổi.
9. Thành phần điều khiển tương tác sở hữu khoảng đệm nội tại của nó ở nơi nó được định nghĩa; bên sử
   dụng không vá thêm `px-*` hay `py-*` từ bên ngoài.
10. Một phần tử đặt ở mép của phần tử khác cần một vị trí và một quy tắc hình học được nêu rõ, không
    phải một khoảng đệm đoán thêm vào hàng xóm.
11. Nếu còn hai bậc liền kề cùng hợp lý, mặc định chọn bậc NHỎ HƠN; chỉ hỏi khi bên yêu cầu nói rõ họ
    cần vai trò lớn hơn.

Ngoài ra: một mã tình huống ứng với đúng một giá trị khoảng đệm — `PADDING-0` ứng với không, được
diễn đạt hai cách vì lý do tồn tại-ranh-giới nêu trên — và mọi phần tử hiển thị ra đều rơi vào đúng
một mã. Không lớp bọc, ô hay mặt phẳng nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là MỘT PHẦN của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó
áp dụng vào.

- **Uỷ quyền tường minh.** `p-0` là quyết định của một ranh giới thật, thuộc `PADDING-0`. Nó không
  bao giờ là cách viết gọn gàng hơn cho "chỗ này không có khoảng đệm" trên một lớp bọc — trường hợp
  ấy là thể không class của `PADDING-0`. Chọn nhầm thể là một lỗi, không phải một cách viết khác.
- **Bề mặt lồng nhau.** Phần tử bên trong chỉ giành được khoảng đệm riêng — `PADDING-4` — khi nó đưa
  vào một ranh giới thật của chính nó. Hai nền, hai khoảng đệm. Một nền và một cụm xếp dọc, một
  khoảng đệm.
- **Khoảng đệm của thành phần điều khiển.** Khoảng đệm đã được thiết lập của thành phần điều khiển
  thì để nguyên. Ai thấy nó sai thì đề xuất sửa ở nơi thành phần điều khiển được định nghĩa; vá tại
  một nơi sử dụng biến cùng một thành phần điều khiển thành hai hình dạng.
- **Từ ngữ không phải bằng chứng.** "To", "thoáng", "chật", cùng một ảnh chụp màn hình — không phân
  biệt được `PADDING-4` với `PADDING-6`.
- **Chưa rõ ai sở hữu ranh giới.** Khi yêu cầu chưa xác lập ai sở hữu ranh giới hoặc ranh giới ấy
  đóng vai trò gì, không phát khoảng đệm nào từ phía bên sử dụng. Chỉ hỏi đúng một câu cụ thể khi bên
  yêu cầu nói rõ họ cần một khoảng đệm khác mặc định.
- **Hai bậc liền kề cùng khớp.** Chọn bậc nhỏ hơn. Chỉ hỏi một câu phân định khi bên yêu cầu nói rõ
  họ cần vai trò lớn hơn.
- **Tính đồng nhất trạng thái.** Khung chờ, rỗng, lỗi và có dữ liệu dùng chung một cây khoảng đệm.
  Đổi khoảng đệm khi đang tải làm bố cục nhảy đúng vào lúc người dùng đang nhìn.
- **Thiết kế đáp ứng.** Chỉ đổi bậc khi vai trò của ranh giới THẬT SỰ đổi, không phải khi màn hình
  rộng ra.
- **Phần tử ở mép.** Chỉ được chừa khoảng đệm cho một thành phần điều khiển đặt đè lên mép của phần
  tử khác sau khi vị trí và hình học của nó đã được nêu rõ. Chưa nêu thì không bịa khoảng đệm.

## Đầu ra

Mỗi phần tử một khối, từ ngoài vào trong:

```text
boundary owner: <phần tử, hoặc "none — transparent arranger">
direct content role: pass-through | delegated | compact-cell | regular-cell |
                     ordinary-surface | primary-plane
situation: <PADDING-0 | PADDING-2 | PADDING-3 | PADDING-4 | PADDING-6>
className: <no class | p-0 | p-2 | p-3 | p-4 | p-6>
nested boundaries: <none | cây chủ sở hữu, mỗi chủ một mã>
reason: <sự thật nghiệp vụ loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Một thẻ thanh toán chứa một tiêu đề và một danh sách hoá đơn có viền; mỗi hàng hoá đơn
hiển thị tên gói, ngày đã thanh toán và số tiền."

Yêu cầu này nói ra bốn phần tử: thẻ, cụm xếp dọc đặt tiêu đề trên danh sách, danh sách, và từng hàng
hoá đơn. Nó không nói tới cột nội dung của trang, không nói tới thanh bộ lọc, không nói tới hộp
thoại, nên không giải những thứ đó. Nó cũng không nói rằng tuyến trang tồn tại chỉ vì thẻ này, nên
không chạm tới `PADDING-6`; và không nói tới ô nào chỉ chứa một dữ kiện ngắn, nên không chạm tới
`PADDING-2`.

```text
boundary owner: thẻ thanh toán
direct content role: ordinary-surface
situation: PADDING-4
className: p-4
nested boundaries: danh sách hoá đơn (PADDING-0, thể p-0); hàng hoá đơn (PADDING-3)
reason: thẻ là bề mặt dùng lại được, bên cạnh nó có những bề mặt ngang hàng và tuyến trang không tồn tại chỉ vì nó, điều này loại trừ PADDING-6
```

```text
boundary owner: none — transparent arranger
direct content role: pass-through
situation: PADDING-0
className: no class
nested boundaries: none
reason: cụm xếp dọc chỉ đặt tiêu đề trên danh sách và không vẽ nền hay viền, nên không sở hữu ranh giới nào để uỷ quyền, điều này loại trừ thể p-0
```

```text
boundary owner: danh sách hoá đơn
direct content role: delegated
situation: PADDING-0
className: p-0
nested boundaries: hàng hoá đơn (PADDING-3)
reason: danh sách có viền và giao toàn bộ khoảng đệm cho các hàng để đường kẻ chạm tới mép, điều này loại trừ PADDING-4
```

```text
boundary owner: hàng hoá đơn
direct content role: regular-cell
situation: PADDING-3
className: p-3
nested boundaries: none
reason: hàng chứa một nhóm — tên gói, ngày thanh toán và số tiền — và vẫn phụ thuộc vào bộ của nó, điều này loại trừ PADDING-2
```

Khi yêu cầu bổ sung rằng thẻ có một ảnh bìa tràn sát viền, thẻ chuyển thành `PADDING-0` thể `p-0` và
phần chữ bên dưới ảnh nhận `p-4`. Khi yêu cầu bổ sung một khối nhấn mạnh hạn mức có nền riêng nằm
trong thẻ, khối đó là một ranh giới thật thứ hai và nhận `PADDING-4` của riêng nó, còn cụm xếp dọc ở
giữa vẫn không nhận class nào.

## Phạm vi

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường.
