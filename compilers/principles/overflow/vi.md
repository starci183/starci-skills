---
title: Overflow · Vietnamese
---

# Tràn nội dung

## LOADS

None.


## Bản ghi

Nguyên tắc này nhận một yêu cầu viết bằng lời thường — "danh sách tệp đính kèm, mỗi hàng có tên tệp và dung
lượng" — rồi trả về là, với **mỗi hộp** mà yêu cầu đó ngụ ý, một mã tình huống và một className. Yêu
cầu không bao giờ nói dữ liệu thật sẽ dài đến đâu, và không được ngồi chờ màn hình vỡ rồi mới vá: hãy
nhìn cái hộp **trước khi có dữ liệu** và hỏi ai nhường khi giá trị thật dài nhất tới.

## Luật

Chỗ thì hữu hạn, nội dung thì không. Phải quyết **từ trước** bên nào nhường: nội dung bị **cắt**, nội
dung **xuống dòng**, hộp **cuộn**, hay hộp **nở ra**.

Một bố cục không quyết thì vẫn là đã quyết — nó giao quyết định cho trình duyệt, và trình duyệt trả
lời bằng cách làm vỡ bố cục. Một cái tên đẩy con số giá ra khỏi cột, một thanh dọc dài quá khung nhìn
và bỏ rơi chính hành động cuối của nó, một cái bảng làm cả trang cuộn ngang: không cái nào là lỗi
hiển thị. Mỗi cái là một tình huống tràn nội dung chưa được khai.

**Đây là luật bắt buộc.** Bất kỳ hộp nào có thể nhận nội dung không giới hạn độ dài đều mang một tình
huống tràn, và tình huống đó có một mã ở dưới. "Trong bản mô phỏng chữ ngắn mà" không phải lý do miễn
— đó chính là giả định sinh ra mọi lần vỡ bố cục ở lần đầu gặp dữ liệu thật.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `OVERFLOW-<n>`. Mã gọi tên TÌNH HUỐNG; cột
className gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có hai mã không phát
ra gì cả, vì quyết định để nội dung nở ra là một quyết định chứ không phải chỗ trống.

| Mã | Tình huống | className |
|---|---|---|
| `OVERFLOW-0` | Giá trị lấy từ tập đóng, độ dài biết trước — không hộp nào bị vỡ được | *không khai báo* |
| `OVERFLOW-1` | Một dòng, nhận ra được từ đầu chuỗi; mất đuôi vẫn nhận ra | `truncate` |
| `OVERFLOW-2` | Văn xuôi đọc lấy ý; một số dòng cố định là đủ | `line-clamp-<n>` |
| `OVERFLOW-3` | Cắt là sai nghĩa hoặc mất nghĩa; buộc phải xuống dòng đủ | `break-words` |
| `OVERFLOW-4` | Hộp tự sở hữu trần chiều cao, nội dung cuộn bên trong nó | `max-h-* overflow-y-auto` |
| `OVERFLOW-5` | Nội dung rộng hơn cột và cuộn ngang trong khung riêng của nó | `overflow-x-auto` |
| `OVERFLOW-6` | Các phần tử cùng cấp trên một hàng tranh bề rộng; phải khai ai nhường | `min-w-0 flex-1` · `flex-none` |
| `OVERFLOW-7` | Nội dung sở hữu chiều cao; trần là của tổ tiên, không phải của đây | *không khai báo* |

HAI MÃ KHÔNG PHÁT RA CLASS KHÔNG PHẢI MỘT MÃ. `OVERFLOW-0` nói tràn **không thể xảy ra** — giá trị
đến từ một tập đóng, hoặc là một con số có bề rộng biết trước. `OVERFLOW-7` nói tràn **được phép xảy
ra** và trần thuộc về người khác: một phần nội dung dài ra theo nội dung của nó và khung nhìn chịu
trách nhiệm cuộn. Đặt một cái trần lên hộp `OVERFLOW-7` là cách phổ biến nhất khiến một màn hình có
hai thanh cuộn. Chúng là hai mã riêng vì chúng hỏng theo hai kiểu khác nhau. Sai `OVERFLOW-0` nghĩa
là rồi sẽ có dữ liệu thật làm vỡ một cái hộp không ai canh. Sai `OVERFLOW-7` nghĩa là cái hộp bị canh
hai lần.

Có hai class quyết định việc một khai báo trông đúng có làm được gì hay không, và cả hai đều đi ngược
trực giác. **`min-w-0` trên một phần tử con flex**: bề rộng tối thiểu mặc định của một phần tử flex
chính là nội dung của nó, nên `truncate` đặt trên con của một hàng bị bỏ qua — phần tử đó không chịu
hẹp hơn chữ của mình mà đẩy phần tử bên cạnh ra khỏi hàng. `OVERFLOW-1`, `OVERFLOW-2` và `OVERFLOW-6`
nằm trong một hàng đều cần nó. **`min-h-0` trên một phần tử con flex có cuộn**: cũng luật đó trên trục
đứng. Một hộp cuộn nằm trong cột flex sẽ nở ra theo nội dung và vượt qua trần của cha nó thay vì cuộn,
cho tới khi chiều cao tối thiểu của nó được giải phóng. Khai báo thiếu hai class này không hỏng ồn ào
— nó hỏng im lặng, và như thế còn tệ hơn.

## Đọc một yêu cầu

1. **Liệt kê những hộp mà yêu cầu nói ra.** "Danh sách tệp đính kèm, mỗi hàng có tên tệp và dung
   lượng" nói ra bốn hộp: vùng danh sách, hàng, ô tên và ô dung lượng.
2. **Không bịa ra hộp mà yêu cầu không hề nhắc.** Hộp thoại, ô tìm kiếm, phần đầu hay một chiều cao cố
   định không nằm trong yêu cầu đó. Giải cái được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong**, rồi tới từng hộp bên trong. Mỗi hộp có đáp án riêng; **mã áp cho một
   hộp, không áp cho cả cây**. Một lưới có thể là `OVERFLOW-7` trong khi các thẻ bên trong nó là
   `OVERFLOW-1` và `OVERFLOW-2`.
4. **Với mỗi hộp, gọi tên giá trị thật dài nhất nó có thể nhận rồi hỏi câu hỏi** nằm trong phần của
   từng mã: độ dài có đóng không, mất đuôi có mất nghĩa không, có đường lấy lại không, tràn theo trục
   ngang hay trục đứng, và tổ tiên nào sở hữu trần. Mã đầu tiên có tình huống khớp chính là đáp án.
5. **Hàng và các ô bên trong nó là hai quyết định khác nhau.** Hàng quyết ai nhường (`OVERFLOW-6`);
   mỗi ô quyết chuyện gì xảy ra với giá trị của chính nó. Một hàng có hai mã là bình thường, ba mã là
   chuyện hay gặp.
6. **Nếu hai mã cùng khớp, có đúng một dữ kiện phân định.** Tập giá trị còn đóng ở mọi ngôn ngữ hay
   không; người đọc **thiếu** thông tin hay **hiểu sai** thông tin; tràn là không thể hay là được
   phép; có phần tử anh em phải luôn hiển thị hay không. Nếu dữ kiện đó thật sự thiếu trong yêu cầu,
   hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class hoặc một câu hỏi — không bao
   giờ cả hai.

## `OVERFLOW-0` — không có gì để tràn

**Khi nào gặp.** Giá trị đến từ một **tập đóng** mà bạn kiểm soát được, hoặc là một con số có bề rộng
biết trước. Không tồn tại dữ liệu thật nào làm vỡ hộp này, nên khai báo tràn nội dung ở đây là nói dối
về một rủi ro không có.

**Cách nhận ra**

- Chuỗi dài nhất có thể liệt kê ra được, ngay bây giờ, bằng tay.
- Nội dung không đến từ người dùng, không đến từ bên thứ ba, không đến từ bản dịch mở.
- Bề rộng tối đa suy ra được từ định dạng: hai chữ số phần trăm, một ký hiệu tiền tệ, một nhãn trạng
  thái trong bốn nhãn.

**Tự hỏi.** Tôi có liệt kê được **toàn bộ** giá trị mà ô này có thể nhận không? Nếu liệt kê được và
danh sách đó không đổi theo dữ liệu — `OVERFLOW-0`.

**Ranh giới**

- `OVERFLOW-1`: nếu tập chỉ đóng **trong một ngôn ngữ**, nó chưa bao giờ đóng. Nhãn trạng thái dịch
  sang ngôn ngữ khác dài gấp ba là `OVERFLOW-1`.
- `OVERFLOW-3`: một con số **có** thể dài bất thường — số tiền lớn, số lượt xem — nhưng vẫn không được
  cắt. Nếu bề rộng không suy ra được thì không còn là `OVERFLOW-0`.
- `OVERFLOW-7`: `OVERFLOW-0` nói tràn **không thể**; `OVERFLOW-7` nói tràn **được phép** và ai đó khác
  chặn.

**Tình huống nghiệp vụ hay gặp.** Nhãn trạng thái trong tập cố định · phần trăm tiến độ · số thứ tự
trang · thứ hạng · số sao · nhãn cấp độ · ký hiệu đơn vị · chữ cái viết tắt trong ảnh đại diện · nhãn
nút do mình viết trong một ngôn ngữ đã chốt · số ngày liên tiếp.

## `OVERFLOW-1` — một dòng, nhận ra từ đầu chuỗi

**Khi nào gặp.** Giá trị là **một danh tính** mà người đọc nhận ra ngay ở phần đầu: tên người, tên tệp,
tiêu đề, thư điện tử. Mất phần đuôi thì mất chi tiết, **không** mất khả năng nhận ra và **không** đổi
nghĩa.

**Cách nhận ra**

- Phần thông tin nặng nhất nằm ở đầu chuỗi.
- Hai giá trị khác nhau gần như không bao giờ trùng nhau ở 20 ký tự đầu.
- Có đường lấy lại giá trị đầy đủ: chú giải, trang chi tiết, hoặc chính hàng này bấm được.

**Tự hỏi.** Nếu chỉ nhìn nửa đầu chuỗi, người đọc có nhận ra **đúng** bản ghi này không?

**Ranh giới**

- `OVERFLOW-2`: `OVERFLOW-1` cắt để **giữ hàng một dòng** — chiều cao là một quy ước của hàng.
  `OVERFLOW-2` cắt để **giữ mật độ** — người đọc thật sự đang đọc nội dung, chỉ không đọc hết.
- `OVERFLOW-3`: nếu cắt làm giá trị **trở nên sai** thay vì thiếu — số tiền, mã đơn, mã lỗi — thì
  không bao giờ là `OVERFLOW-1`.
- `OVERFLOW-6`: `OVERFLOW-1` là quyết định của **ô chữ**; `OVERFLOW-6` là quyết định của **hàng chứa
  nó** về việc ai nhường. Trong một hàng flex, hai mã này gần như luôn đi cùng nhau.

**Không có đường lấy lại thì không phải mã này.** Cắt mà không cho cách xem đủ là xoá dữ liệu trước
mặt người đọc. Cắt cứng không để lại dấu ba chấm còn tệ hơn: đó là mất dữ liệu im lặng, không phải một
mã.

**Tình huống nghiệp vụ hay gặp.** Tên khoá học trong thẻ · tên tệp đính kèm · thư điện tử trong hàng
thành viên · tiêu đề thông báo · tên nhánh · dòng chủ đề trong hộp thư · tên người trong danh sách xếp
hạng · tiêu đề thẻ tab · nhãn đường dẫn phân cấp ở giữa · tên tổ chức trong ô chuyển ngữ cảnh.

## `OVERFLOW-2` — văn xuôi đọc lấy ý

**Khi nào gặp.** Đoạn văn được đọc để **nắm ý**, không để đọc hết tại chỗ. Hai đến bốn dòng đã đủ để
người đọc quyết định có mở ra hay không, và việc giữ mọi thẻ trong lưới cùng chiều cao có giá trị
nghiệp vụ thật: nó cho phép so sánh.

**Cách nhận ra**

- Nội dung là câu, không phải một danh tính.
- Có một nơi để đọc đủ: trang chi tiết, khung, hoặc nút mở rộng.
- Nếu để nở tự do, các phần tử cạnh nhau lệch chiều cao và mất khả năng so sánh.

**Tự hỏi.** Người đọc ở màn này đang **quét** hay đang **đọc**? Quét thì `OVERFLOW-2`; đọc thì
`OVERFLOW-7`.

**Ranh giới**

- `OVERFLOW-1`: một dòng thì dùng `OVERFLOW-1` và nói thẳng ra. `line-clamp-1` là `truncate` mặc áo
  nặng hơn.
- `OVERFLOW-7`: nội dung chính của một trang bài viết **không** bị giới hạn dòng. Giới hạn dòng ở đó
  là giấu mất thứ người ta vào để đọc.
- `OVERFLOW-4`: giới hạn dòng **bỏ hẳn** phần thừa; cuộn **giữ lại** phần thừa. Chọn giới hạn dòng khi
  phần thừa không đáng giữ tại chỗ, chọn cuộn khi nó đáng giữ.

**Số dòng là một quyết định nghiệp vụ.** Nó nói "chừng này là đủ để chọn". Đừng chỉnh nó cho vừa mắt
một thẻ cụ thể, cũng đừng đổi nó theo khung nhìn; chỉnh nó khi định nghĩa "đủ để chọn" thay đổi.

**Tình huống nghiệp vụ hay gặp.** Mô tả khoá học trong lưới thẻ · trích đoạn bài viết · nội dung đánh
giá trong danh sách · đề bài rút gọn trong danh sách bài tập · tin nhắn xem trước trong hộp thư · mô
tả sản phẩm trong thẻ · ghi chú trong bảng · tóm tắt thay đổi trong lịch sử.

## `OVERFLOW-3` — cắt là sai, buộc phải xuống dòng

**Khi nào gặp.** Giá trị **mất nghĩa hoặc đổi nghĩa** khi bị cắt. Người đọc không có cách nào biết là
nó đã bị cắt, nên cái họ đọc được là một thông tin **sai**, không phải một thông tin thiếu.

**Cách nhận ra**

- Là số, mã, định danh, đường dẫn, hoặc thông báo lỗi.
- Đuôi chuỗi mang thông tin phân biệt: đuôi mã đơn, phần cuối URL, phần cuối câu lỗi.
- Chuỗi có thể không chứa khoảng trắng nào, nên trình duyệt không có chỗ để xuống dòng.

**Tự hỏi.** Nếu chuỗi này bị cắt mất đuôi, người đọc có **tưởng nhầm** rằng họ đang thấy giá trị đầy
đủ không? Có — `OVERFLOW-3`.

**Ranh giới**

- `OVERFLOW-1`: đây là ranh giới bị vượt nhiều nhất. Tên người cắt được vì nhận ra từ đầu; số tiền
  không cắt được vì `1.299.000đ` cắt còn `1.299` là một con số khác và trông vẫn hợp lệ.
- `OVERFLOW-5`: nếu thứ quá rộng là **một khối có cấu trúc** — bảng, đoạn mã — thì không xuống dòng
  được mà phải cuộn ngang. `OVERFLOW-3` dành cho chuỗi văn bản, không dành cho lưới.
- `OVERFLOW-2`: giới hạn dòng là một dạng cắt. Nội dung `OVERFLOW-3` không được giới hạn dòng.

**Chuỗi không có khoảng trắng cần nói rõ hơn.** Một URL dài hoặc một biến thiết kế là một "từ" duy
nhất dưới mắt trình duyệt; nó cần được phép gãy **giữa từ** thì mới không đẩy vỡ cột. `break-words`
giữ từ nguyên vẹn và chỉ gãy khi một từ dài hơn cả dòng; `break-all` gãy ở bất kỳ đâu và chỉ dành cho
chuỗi máy đọc.

**Tình huống nghiệp vụ hay gặp.** Số tiền · mã đơn hàng · mã lỗi · mã giảm giá · địa chỉ ví · đường
dẫn tệp · URL người dùng dán vào · thông báo lỗi xác thực · địa chỉ thư điện tử trong trang chi tiết ·
số điện thoại · tên tệp trong màn tải lên đang lỗi · giá trị đo có đơn vị.

## `OVERFLOW-4` — hộp tự sở hữu trần và cuộn bên trong

**Khi nào gặp.** Danh sách có thể dài **không giới hạn**, nhưng vùng nó nằm trong phải giữ nguyên hình
dạng để những thứ khác quanh nó vẫn dùng được: nút xác nhận của một hộp thoại phải luôn nhìn thấy, đầu
trang phải đứng yên, khung không được đẩy dài quá màn hình.

**Cách nhận ra**

- Phần thừa **đáng giữ**: người đọc sẽ muốn xem tiếp, không phải bỏ qua.
- Có một phần tử anh em phải luôn hiện diện: phần cuối hành động, phần đầu, thanh tổng kết.
- Số phần tử do dữ liệu quyết định, không do thiết kế quyết định.

**Tự hỏi.** Có thứ gì bên cạnh vùng này mà người đọc **phải luôn thấy** không? Có — trần thuộc về đây,
và đây là `OVERFLOW-4`.

**Ranh giới**

- `OVERFLOW-7`: đây là ranh giới sinh ra hai thanh cuộn. Nếu vùng này chỉ cần dài ra và cả trang cuộn
  là được, thì nó là `OVERFLOW-7` và đặt trần ở đây là thừa.
- `OVERFLOW-2`: xem trên — giới hạn dòng bỏ phần thừa, cuộn giữ phần thừa.
- `OVERFLOW-5`: cùng một cơ chế, khác trục. Một hộp có thể vừa `OVERFLOW-4` vừa `OVERFLOW-5`, nhưng
  khi đó nó cuộn hai chiều và phải cố ý.

**Hộp cuộn là một hộp riêng.** Nó không đồng thời là bề mặt: bề mặt giữ khoảng đệm trong, bo góc, đổ
bóng và những phần tử phải luôn thấy; hộp cuộn nằm **bên trong** và chỉ làm một việc là cuộn. Đặt cuộn
lên chính bề mặt thì cái đầu tiên cuộn mất là khoảng đệm trong của nó, đổ bóng bị cắt ở mối nối, và
mọi phần tử dính bên trong bị nhốt trong một cái hộp mà người đọc không nhìn ra ngoài được. Đây là hệ
quả cấu trúc của mã, không phải một sở thích trình bày.

**Một phần tử dính vào nội dung đang cuộn** — ví dụ hàng tiêu đề của một bảng dài — nằm trong hộp cuộn
là đúng, vì nó thuộc về nội dung. Một phần tử phải dính vào **bề mặt** — phần cuối hành động, thanh
tìm kiếm của khung — nằm trong hộp cuộn là sai, vì nó thuộc về khung.

**Cuộn trong lớp phủ phải chặn lan.** Khi hộp cuộn nằm trong phần tử chồng lớp, cuộn hết đáy mà không
chặn thì trang nền cuộn tiếp và người đọc mất chỗ đứng.

**Tình huống nghiệp vụ hay gặp.** Thân hộp thoại có phần cuối hành động · danh sách gợi ý của ô tìm
kiếm · khung hội thoại · khung thông báo · danh sách chọn nhiều mục · giỏ hàng trong khung · nhật ký
hoạt động trong thẻ · danh sách thành viên trong hộp mời · cột kanban.

## `OVERFLOW-5` — khối rộng hơn cột, cuộn ngang trong khung riêng

**Khi nào gặp.** Nội dung có **cấu trúc theo chiều ngang** không rút gọn được: các cột của một bảng,
các dòng của một đoạn mã, một dải thẻ. Bỏ bớt cột là bỏ dữ liệu; ép xuống dòng là phá cấu trúc.

**Cách nhận ra**

- Bề rộng tối thiểu của nội dung là một dữ kiện, không phải một lựa chọn.
- Xuống dòng làm hàng lệch cột và bảng mất khả năng đọc theo cột.
- Chỉ thiếu chỗ trên màn hẹp; trên màn rộng không hề tràn.

**Tự hỏi.** Rút bớt bề rộng ở đây có làm **mất dữ liệu hoặc phá cấu trúc** không? Có — `OVERFLOW-5`.

**Ranh giới**

- `OVERFLOW-3`: chuỗi văn bản dài thì xuống dòng; khối có cấu trúc thì cuộn ngang.
- `OVERFLOW-6`: `OVERFLOW-6` giải quyết tranh chấp **giữa các phần tử cùng cấp trong một hàng** bằng
  cách chỉ định ai co lại. `OVERFLOW-5` là khi **không ai co được** và cả khối phải trượt.
- `OVERFLOW-7`: một phần nội dung chỉ cao ra thì là `OVERFLOW-7`; một khối rộng ra luôn phải có khung
  riêng.

**Cuộn ngang không bao giờ được leo lên phần thân.** Trang cuộn ngang là hỏng, không phải là một cách
hiển thị. Khung cuộn phải đóng lại ở đúng cột chứa nó, và cột đó phải được phép hẹp lại thì khung mới
có tác dụng.

**Ẩn thanh cuộn là bỏ mất tín hiệu duy nhất.** Nếu thanh cuộn bị ẩn đi vì lý do thẩm mỹ thì phải có
tín hiệu khác nói rằng còn nội dung bên phải: một vệt mờ ở mép, một nút mũi tên, hoặc điểm dừng khi
trượt.

**Tình huống nghiệp vụ hay gặp.** Bảng nhiều cột trên thiết bị di động · đoạn mã · dải nhãn nhỏ lọc ·
dòng thời gian ngang · lưới lịch theo tuần · bảng so sánh gói · dải ảnh nhỏ · thanh thẻ tab quá nhiều
mục.

## `OVERFLOW-6` — trên một hàng, ai nhường phải được khai

**Khi nào gặp.** Nhiều phần tử nằm trên **một hàng** và tổng bề rộng mong muốn của chúng lớn hơn hàng.
Không khai ai nhường thì trình duyệt tự xử, và cách nó xử là đẩy phần tử cuối ra khỏi hàng hoặc bóp
méo một phần tử không được phép bóp.

**Cách nhận ra**

- Hàng có một phần **co giãn được** — tên, tiêu đề, mô tả — và một phần **không được co**: nút, nhãn
  trạng thái, giá, ảnh đại diện, biểu tượng.
- Phần không được co có nghĩa cố định: cắt nó là mất chức năng hoặc mất giá trị.
- Trên màn hẹp, đúng phần tử bên phải là thứ biến mất trước.

**Tự hỏi.** Trong hàng này, phần tử nào **được phép** mất chi tiết, và phần tử nào **không**? Trả lời
được là đã có `OVERFLOW-6`.

**Ranh giới**

- `OVERFLOW-1`: `OVERFLOW-1` nói ô chữ đó cắt; `OVERFLOW-6` nói ô chữ đó là bên nhường. Thiếu vế thứ
  hai thì vế thứ nhất **im lặng không có tác dụng** — một phần tử flex mặc định không chịu hẹp hơn nội
  dung của chính nó.
- `OVERFLOW-5`: khi **mọi** phần tử trong hàng đều không được co, hàng không còn tranh chấp để phân
  xử; nó là một khối rộng và thuộc `OVERFLOW-5`.
- `OVERFLOW-0`: một hàng chỉ gồm các giá trị tập đóng không có tranh chấp nào để khai.

**Khai cả hai vế, nếu không thì không vế nào chạy.** `flex-1` không kèm `min-w-0` là khai một nửa, và
nửa còn thiếu chính là nửa có tác dụng. Cho tất cả cùng không co là quay về không có ai nhường. Khi cả
hai bên đều được phép mất chi tiết, vẫn phải nói rõ **bên nào mất trước** — không thì trình duyệt
quyết theo độ dài dữ liệu chứ không theo tầm quan trọng.

**Tình huống nghiệp vụ hay gặp.** Hàng danh sách có tên và nút · phần đầu thẻ có tiêu đề và nhãn trạng
thái · thanh trên cùng có đường dẫn phân cấp và nhóm hành động · hàng tệp có tên và dung lượng · hàng
thành viên có thư điện tử và vai trò · hàng bài học có tiêu đề và thời lượng · hàng giao dịch có mô tả
và số tiền · hàng bình luận có tên và thời điểm.

## `OVERFLOW-7` — nội dung sở hữu chiều cao

**Khi nào gặp.** Vùng này **được phép dài ra bao nhiêu tuỳ nội dung**. Trần duy nhất là khung nhìn, và
khung nhìn đã có sẵn cách cuộn của nó. Ở đây không khai gì cả — và đó là một quyết định, không phải
một chỗ trống.

**Cách nhận ra**

- Không có phần tử anh em nào cần luôn hiển thị.
- Người đọc vào đây để đọc hết, không phải để liếc.
- Đặt một trần vào đây sẽ tạo ra thanh cuộn thứ hai lồng trong thanh cuộn của trang.

**Tự hỏi.** Có ai **ngoài khung nhìn** cần chặn chiều cao của vùng này không? Không — `OVERFLOW-7`.

**Ranh giới**

- `OVERFLOW-4`: chỉ khác nhau ở **ai sở hữu trần**. Cùng một danh sách: nằm trong thân hộp thoại có
  phần cuối thì là `OVERFLOW-4`; nằm thẳng trên trang thì là `OVERFLOW-7`.
- `OVERFLOW-0`: `OVERFLOW-0` là *không thể tràn*; `OVERFLOW-7` là *tràn được phép và có người khác
  chịu trách nhiệm*.
- `OVERFLOW-2`: một vùng `OVERFLOW-2` khi được mở rộng ra sẽ **chuyển sang** `OVERFLOW-7` trong thời
  gian nó mở. Nó không mọc thêm một trần thứ hai.

**Mỗi trục chỉ một trần trên một chuỗi tổ tiên.** Hai tổ tiên cùng chặn chiều cao là hai thanh cuộn,
và người đọc sẽ cuộn nhầm cái ít nhất một lần trước khi hiểu. Một chiều cao truyền xuống một chuỗi mà
không ai thật sự đặt là không có tác dụng: trần phải có một chủ thật — khung nhìn, hoặc một tổ tiên có
chiều cao xác định.

**`OVERFLOW-7` không phải "quên khai".** Nó là kết luận rằng vùng này được phép dài ra, và kết luận đó
phải nói được thành lời khi đánh giá hỏi.

**Tình huống nghiệp vụ hay gặp.** Thân bài viết · phần nội dung trên trang chủ · cột biểu mẫu dài ·
lưới thẻ trên trang danh mục · trang chi tiết đơn hàng · danh sách kết quả tìm kiếm phân trang · nội
dung thẻ tab trên trang · vùng nội dung chính giữa hai thanh dọc.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| giới hạn nội dung | Độ dài là đóng, hay dữ liệu thật có thể dài tuỳ ý? |
| mức chịu mất | Mất đuôi là mất nghĩa, hay chỉ mất chi tiết? |
| đường lấy lại | Người đọc có lấy lại được giá trị đầy đủ không — chú giải, mở rộng, trang chi tiết? |
| trục | Nó tràn theo trục ngang (bề rộng) hay trục đứng (chiều cao)? |
| chủ của trần | Tổ tiên nào sở hữu giới hạn chiều cao: hộp này, một thanh dọc, hay khung nhìn? |

## Quy tắc

1. Xét **từng hộp**, trước khi có dữ liệu, theo độ dài lớn nhất mà dữ liệu thật có thể đạt tới.
2. Mọi hộp nhận nội dung không giới hạn đều thuộc đúng **một** mã.
3. Cắt phải kèm **đường lấy lại** giá trị đầy đủ; không có thì đổi mã.
4. Số, mã và định danh **không bao giờ** cắt.
5. Hộp cuộn không đồng thời là bề mặt: khoảng đệm trong, bo góc, đổ bóng và phần tử phải-luôn-thấy nằm
   ngoài nó.
6. Cuộn ngang đóng trong khung của nó; **phần thân không bao giờ cuộn ngang**.
7. Một trục, một trần, trên một chuỗi tổ tiên.
8. Trong hàng flex, phải khai **cả hai** vế: ai nhường và ai giữ.
9. Đổi khung nhìn **không** đổi mã. Màn hẹp làm tràn dễ xảy ra hơn, không làm nó thành chuyện khác.
10. `min-w-0` trên phần tử con flex có cắt hoặc có co, và `min-h-0` trên phần tử con flex có cuộn, là
    điều kiện để khai báo có bất kỳ tác dụng nào.

Ngoài ra: một mã tình huống ứng với đúng một className, không className nào phục vụ hai mã, và mọi hộp
có thể nhận nội dung không giới hạn đều rơi vào đúng một mã. Không bố cục nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Số và mã không cắt.** Chúng là `OVERFLOW-3` ngay cả khi nhãn nằm ngay cạnh là `OVERFLOW-1`. Một
  hàng hoàn toàn được phép có hai mã khác nhau ở hai ô.
- **Hai dòng là sàn của `line-clamp`.** `line-clamp-1` không tồn tại trong luật này: nó là `truncate`
  mặc áo nặng hơn, nên hãy chọn `OVERFLOW-1` và nói thẳng ra.
- **Tập đóng chỉ đóng khi đóng ở mọi ngôn ngữ được phát hành.** Nếu bản dịch làm một nhãn cố định dài
  tuỳ ý thì nó chưa từng là `OVERFLOW-0`, nó là `OVERFLOW-1`.
- **Khung chờ dùng chung mã với nội dung.** Một khung chờ xuống dòng ở chỗ mà giá trị thật sẽ cắt là
  một lời hứa về bố cục sẽ không bao giờ xảy ra.
- **Nút mở rộng đổi mã, không thêm hộp.** "Đọc thêm" chuyển một vùng từ `OVERFLOW-2` sang `OVERFLOW-7`
  trong suốt thời gian nó mở; nó không mọc thêm trần thứ hai.
- **Phần tử dính trong hộp cuộn** chỉ hợp lệ khi nó thuộc về **nội dung đang cuộn** — hàng tiêu đề của
  bảng dài. Phần tử thuộc về **bề mặt** phải nằm ngoài hộp cuộn của tình huống `OVERFLOW-4` đó.
- **Cắt cứng không dấu hiệu bị cấm.** Che phần thừa mà không có dấu ba chấm, không có khung cuộn,
  không có nút mở là mất dữ liệu im lặng — không phải một mã, mà là một lỗi.
- **Ẩn thanh cuộn phải trả lại một tín hiệu khác.** Một khung `OVERFLOW-5` không có bất kỳ tín hiệu
  nào là một khung cuộn mà người đọc không biết là có thể cuộn.

## Đầu ra

Mỗi hộp một khối, từ ngoài vào trong:

```text
box: <phần tử nhận nội dung>
axis: <inline | block>
bound: <closed | unbounded>
situation: <OVERFLOW-0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>
className: <không class | truncate | line-clamp-n | break-words | max-h-* overflow-y-auto | overflow-x-auto | min-w-0 flex-1 | flex-none>
recovery: <cách người đọc lấy lại giá trị đầy đủ, hoặc "không cần">
reason: <sự thật nghiệp vụ loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Một trang liệt kê các tệp đính kèm của một đơn hàng. Mỗi hàng hiện tên tệp và dung lượng
tệp, và cả hàng dẫn sang trang chi tiết của tệp đó."

Yêu cầu này nói ra bốn hộp: vùng danh sách trên trang, hàng, ô tên và ô dung lượng. Nó không nói tới
hộp thoại, không nói tới phần đầu phải luôn hiển thị, không nói tới một chiều cao cố định, nên không
giải hộp cuộn nào. Nó cũng không nói tới đoạn mô tả và không nói tới nhãn trạng thái, nên không giải ô
giới hạn dòng và không giải ô tập đóng.

```text
box: vùng danh sách tệp đính kèm
axis: block
bound: unbounded
situation: OVERFLOW-7
className: không class
recovery: không cần
reason: không có gì bên cạnh danh sách phải luôn hiển thị khi nó dài ra, nên ngoài khung nhìn không tổ tiên nào sở hữu trần, điều này loại trừ OVERFLOW-4
```

```text
box: hàng tệp đính kèm
axis: inline
bound: unbounded
situation: OVERFLOW-6
className: min-w-0 flex-1 · flex-none
recovery: không cần
reason: tên tệp được phép mất chi tiết còn dung lượng thì không, nên hàng này có một bên nhường để khai, điều này loại trừ OVERFLOW-5
```

```text
box: ô tên tệp
axis: inline
bound: unbounded
situation: OVERFLOW-1
className: truncate
recovery: cả hàng dẫn sang trang chi tiết của tệp
reason: tên tệp nhận ra được từ đầu chuỗi và cắt nó chỉ làm người đọc thiếu chi tiết chứ không cho họ một giá trị sai, điều này loại trừ OVERFLOW-3
```

```text
box: ô dung lượng tệp
axis: inline
bound: unbounded
situation: OVERFLOW-3
className: break-words
recovery: không cần
reason: một giá trị đo bị cắt đọc ra thành một con số nhỏ hơn mà vẫn trông hợp lệ, điều này loại trừ OVERFLOW-1
```

Khi yêu cầu chuyển danh sách này vào một hộp thoại có nút xác nhận phải luôn thấy, vùng danh sách trở
thành `OVERFLOW-4` và trần chuyển về cho nó; hàng và hai ô giữ nguyên mã của mình. Còn nếu yêu cầu bổ
sung thêm bốn cột phải đọc theo cột, hàng không còn bên nào nhường được nữa và trở thành `OVERFLOW-5`.

## Phạm vi

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường.
