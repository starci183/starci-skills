---
title: Flow · Vietnamese
---

# Luồng

Đầu vào là một yêu cầu viết bằng lời thường — "thanh dọc lọc bên trái, thẻ khoá học bên phải" — và
đầu ra là, với **mỗi vùng chứa** mà yêu cầu đó ngụ ý, một mã tình huống và một className. Yêu cầu
không bao giờ nói ra một trục, và không được phép đoán trục: trục suy ra từ việc các con là gì, và
từ điều bắt buộc phải xảy ra khi hết bề rộng.

## Luật

Trước khi có thể nói tới khoảng cách, canh lề hay kích thước, phải khai báo xong một sự thật: **các
phần chạy dọc theo trục nào, và trục đó ra sao khi hết bề rộng.**

Cha khai báo trục đó. Con **không bao giờ** tự khai báo trục mà nó đang nằm trên, vì trục là một
phát biểu về cả tập, mà không thành viên nào nói thay được cho tập.

Một bố cục không khai báo gì thì vẫn đã trả lời. Nó trả lời bằng đúng mặc định của các phần tử, mà
mặc định ấy là một sự thật về HTML chứ không phải một sự thật về nội dung: con dạng khối thì xếp
chồng, con nội tuyến thì chạy dọc một dòng và ngắt ở dấu cách. Đôi khi như thế là đúng — và khi nó
đúng, nó đúng vì có người đã kiểm tra, không phải vì không ai nhìn tới.

**Đây là luật bắt buộc.** Mọi vùng chứa hiển thị ra nhiều hơn một thứ đều có một tình huống luồng,
và tình huống đó có một mã ở dưới. Không có tập nào nhỏ đến mức được miễn: hai cái nút đứng cạnh
nhau mang một mã, cùng một lý do mà một thanh dọc đứng cạnh vùng kết quả mang một mã. Câu "có mỗi
hai cái thôi mà" là chỗ luật này bị bỏ qua nhiều nhất — và đúng chỗ đó, một nhãn dài hơn, một dòng
thứ hai hay một màn hình hẹp hơn sẽ làm vỡ hàng.

## Mã tình huống

Mã gọi tên TÌNH HUỐNG. Cột className gọi tên thứ mà tình huống đó phát ra — và có hai mã không phát
ra gì cả, vì "trình duyệt vốn đã sắp xếp đúng rồi" là một quyết định, không phải sự vắng mặt của một
quyết định.

| Mã | Tình huống | className |
|---|---|---|
| `FLOW-0` | Đúng một con, ở **mọi** trạng thái vùng chứa có thể rơi vào | *không khai báo luồng* |
| `FLOW-1` | Chữ và thành phần nội tuyến trong một câu; ngắt dòng đã sắp xếp hộ rồi | *không khai báo luồng* |
| `FLOW-2` | Một hàng bắt buộc nằm trên một dòng | `flex` |
| `FLOW-3` | Một chồng đọc từ trên xuống | `flex flex-col` |
| `FLOW-4` | Một hàng các phần tử độc lập, được phép tràn xuống dòng sau | `flex flex-wrap` |
| `FLOW-5` | Một hàng đổi thành chồng khi hết bề rộng | `flex flex-col <bp>:flex-row` |
| `FLOW-6` | Các phần tử hoán đổi được, số cột do sản phẩm quyết | `grid <bp>:grid-cols-<n>` |
| `FLOW-7` | Các phần tử hoán đổi được, số cột đi theo bề rộng tối thiểu của phần tử | `grid grid-cols-[repeat(auto-fill,minmax(<min>,1fr))]` |
| `FLOW-8` | Các rãnh có vai trò khác nhau, mỗi rãnh tự sở hữu bề rộng | `grid <bp>:grid-cols-[<track>_minmax(0,1fr)]` |

Cách đánh số gom theo họ chứ không theo độ lớn. `FLOW-0` và `FLOW-1` không khai báo gì. `FLOW-2` tới
`FLOW-5` là họ một trục: mỗi lúc một trục, với hai câu trả lời khác nhau cho việc hết bề rộng.
`FLOW-6` tới `FLOW-8` là họ lưới: hai trục cùng lúc, chỉ khác nhau ở chỗ **ai quyết số cột** — sản
phẩm, ngưỡng đọc được của phần tử, hay chính vai trò của các rãnh.

**Hai mã không phát ra gì không phải là một mã.** `FLOW-0` nói rằng không có trục nào để khai báo:
một con, mà một con thì không có phương hướng so với bất cứ cái gì. `FLOW-1` nói rằng trục có tồn
tại và **đã thuộc về ngắt dòng**: một câu chạy dọc trục nội tuyến và xuống dòng ở ranh giới giữa các
chữ, không class nào cần nói ra điều đó. Chúng là hai mã riêng vì chúng hỏng theo hai hướng ngược
nhau. Sai `FLOW-0` nghĩa là một vùng chứa sau này mọc thêm con thứ hai và sắp xếp nó một cách tình
cờ. Sai `FLOW-1` nghĩa là có người viết `flex` lên một đoạn văn, và từ đó mỗi chữ thành một phần tử
flex, dấu cách giữa các chữ thôi làm dấu cách, và văn bản thôi xuống dòng như văn bản. Lỗi đó không
thể gọi tên được nếu tình huống không có mã.

**Số cột luôn được khai báo ở đâu đó.** Một lưới không khai báo số cột thì không phải lưới, nó là
một chồng mượn nhầm tên họ. `FLOW-6` — **sản phẩm** quyết: ba lợi ích trên một hàng, hai trường một
hàng; con số là một quyết định nội dung, nên nó đổi tại những điểm ngắt do người viết đặt ra.
`FLOW-7` — **phần tử** quyết, thông qua bề rộng mà dưới đó nó không còn đọc được; người viết nêu một
bề rộng tối thiểu và không viết điểm ngắt nào, số cột là bao nhiêu vừa thì bấy nhiêu. `FLOW-8` —
**vai trò** quyết; các rãnh không hoán đổi được, một thanh dọc là một thanh dọc ở bề rộng riêng của
nó, còn rãnh nội dung ăn phần còn lại.

**Xuống dòng và dựng lưới không phải cùng một câu trả lời.** Một hàng xuống dòng và một lưới trông
giống nhau trên màn hình rộng, rồi tách nhau ra ngay khi các phần tử khác cỡ. Dòng xuống dòng không
thẳng cột với dòng trên nó; hàng của lưới thì có. Nên tiêu chí phân định không bao giờ là trông thế
nào lúc còn vừa — nó là:

> Phần tử thứ tư có bắt buộc nằm thẳng cột dưới phần tử thứ nhất, hay chỉ cần tìm được chỗ ngồi?

Nếu việc thẳng cột **mang nghĩa** — để so sánh thẻ, để đọc các trường của một biểu mẫu, để đọc bảng
giá — thì tình huống là lưới. Nếu đó là một túi nhãn nhỏ, thẻ hay bộ lọc mà thứ tự có nghĩa còn cột
thì không, tình huống là một hàng xuống dòng.

## Đọc một yêu cầu

1. **Liệt kê những vùng chứa mà yêu cầu nói ra.** "Thanh dọc lọc bên trái, thẻ bên phải" nói ra hai:
   vùng trang chứa thanh dọc và vùng kết quả, và vùng chứa các thẻ.
2. **Không bịa ra vùng chứa mà yêu cầu không hề nhắc.** Phần đầu trang, thanh phân trang hay chân
   thẻ không nằm trong yêu cầu đó. Giải cái được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong**, rồi tới từng vùng chứa lồng bên trong. Mỗi vùng chứa có đáp án
   riêng; cha không bao giờ thừa hưởng mã của con nó. Một mã áp cho một tập phần tử cùng cấp, không
   áp cho cả cây.
4. **Với mỗi vùng chứa, gọi tên các con trực tiếp và hỏi câu hỏi của từng mã** nằm trong phần của mã
   đó. Nói ra có bao nhiêu con ở trạng thái tải, trạng thái rỗng, trạng thái một phần tử và trạng
   thái lỗi, vì mã đi theo **tập**, không đi theo dữ liệu của hôm nay.
5. **Nếu một vùng chứa trộn hai trục, phải tách phân cấp trước rồi mới chọn.** Hai trục trong cùng
   một tập con nghĩa là đang thiếu một cha. Nếu hai mã cùng có vẻ khớp, đoạn ranh giới trong phần
   của từng mã nêu rõ sự thật phân định chúng; `FLOW-2` và `FLOW-4` loại trừ nhau, khai báo cả hai
   là không khai báo gì.
6. **Nếu thật sự thiếu một dữ kiện quyết định, hỏi một câu cụ thể rồi dừng.** Câu trả lời phải là
   một chuỗi class hoặc một câu hỏi — không bao giờ cả hai.

## `FLOW-0` — chỉ có một con, không có trục nào để khai báo

**Tình huống.** Vùng chứa chỉ bọc đúng **một** thứ, và không trạng thái nào làm nó thành nhiều thứ.
Không có "cái thứ hai" thì không có phương hướng nào giữa hai cái cả.

**Dấu hiệu nhận biết**

- Chỉ có một con trực tiếp ở trạng thái tải, trạng thái rỗng và trạng thái lỗi.
- Vùng chứa tồn tại vì một lý do khác: bo góc, nền, chiều rộng tối đa, hoặc một vùng có tên.
- Bỏ `flex` đi thì màn hình không đổi gì cả.

**Tự hỏi.** Có trạng thái nào của dữ liệu làm vùng chứa này mọc ra con thứ hai không? Nếu không —
`FLOW-0`.

**Ranh giới**

- `FLOW-3`: một danh sách hôm nay chỉ có một kết quả **vẫn** là `FLOW-3`. Mã đi theo tập, không đi
  theo dữ liệu của hôm nay.
- `FLOW-1`: `FLOW-0` là một con; `FLOW-1` là nhiều con nhưng chúng là chữ trong một câu.

**Không viết `flex` cho một con.** Viết `flex` ở đây là tuyên bố một trục không tồn tại, và nó âm
thầm đổi hành vi của chính đứa con duy nhất: con đang là khối bỗng co lại theo nội dung, `w-full`
mất tác dụng, lề ngoài bị nuốt khác đi. Một khai báo không có nghĩa vẫn là một khai báo có hậu quả.

**Tình huống nghiệp vụ hay gặp.** Bọc giới hạn bề rộng của trang · vùng nền của một phần nội dung ·
ô bo góc chứa một biểu đồ · lớp bọc chỉ để đặt `position` · khung của một ảnh · vùng chứa một đoạn
văn duy nhất · cổng hiển thị của một phần tử chồng lớp.

## `FLOW-1` — chữ trong câu, ngắt dòng đã lo

**Tình huống.** Các con là chữ, cụm chữ, liên kết, nhãn nhỏ, biểu tượng nằm trong một câu. Trục nội
tuyến đã có sẵn, và cái sắp xếp chúng là thuật toán ngắt dòng của trình duyệt chứ không phải một
class.

**Dấu hiệu nhận biết**

- Đọc thành một câu, không phải đọc thành một danh sách.
- Giữa các phần có **dấu cách thật**, và dấu cách đó có nghĩa.
- Ngắt dòng được phép rơi vào giữa hai chữ bất kỳ, không phải chỉ ở ranh giới giữa các phần.

**Tự hỏi.** Nếu ngắt dòng rơi vào **giữa** một phần, như vậy có đúng không? Nếu đúng — đây là câu,
không phải hàng.

**Ranh giới**

- `FLOW-2`: một hàng đọc theo cụm có thứ tự — biểu tượng rồi nhãn — là `FLOW-2`. Một câu có chèn
  biểu tượng giữa chừng là `FLOW-1`.
- `FLOW-4`: `FLOW-4` xuống dòng theo **phần tử**; `FLOW-1` xuống dòng theo **chữ**.

**Đặt `flex` lên một đoạn văn là hỏng.** Mỗi nút DOM thành một phần tử flex: dấu cách giữa các nút
biến mất, các cụm dính vào nhau hoặc rời ra không kiểm soát, và đoạn văn mất khả năng ngắt dòng giữa
chừng — thứ duy nhất mà văn bản không được phép mất.

**Tình huống nghiệp vụ hay gặp.** Câu mô tả có chèn tên khoá học in đậm · điều khoản có liên kết ·
thông báo lỗi có chèn mã lỗi · câu "còn 3 ngày" có chèn số · chú thích có đơn vị · mô tả có chèn một
nhãn nhỏ · câu chào có tên người dùng.

## `FLOW-2` — một hàng, một dòng, không được xuống dòng

**Tình huống.** Các phần tử chạy ngang và **bắt buộc** ở lại trên một dòng. Xuống dòng ở đây làm vỡ
nghĩa: một thanh công cụ gãy đôi, một dòng trong danh sách tự nhiên cao gấp đôi các dòng khác.

**Dấu hiệu nhận biết**

- Có một phần tử "chính" và một hoặc vài phần tử phụ ở hai đầu.
- Chiều cao của hàng là một hằng số mà mắt người dùng dựa vào để quét dọc.
- Khi hẹp, thứ phải nhường là **bề rộng của một phần tử**, không phải vị trí của nó.

**Tự hỏi.** Nếu phần tử cuối rơi xuống dòng dưới, hàng này có còn đọc đúng không? Nếu không —
`FLOW-2`.

**Ranh giới**

- `FLOW-4`: `FLOW-2` cấm xuống dòng, `FLOW-4` cho phép. Hai mã loại trừ nhau; khai báo cả hai là
  không khai báo gì.
- `FLOW-5`: nếu khi hẹp cả hàng nên xếp chồng lại chứ không phải cắt bớt một phần tử, đó là `FLOW-5`.

**Hàng một dòng buộc phải chỉ ra ai nhường.** Ai co lại, ai giữ nguyên, ai bị cắt đuôi — đó là việc
của mô-đun tràn nội dung. `FLOW-2` chỉ nói rằng dòng này **không được** gãy; nó không tự giải quyết
hậu quả của lời hứa đó, nhưng nó bắt người viết phải giải quyết.

**Tình huống nghiệp vụ hay gặp.** Một dòng trong danh sách: tên bên trái, số tiền bên phải · phần
đầu của thẻ: tiêu đề và nút trình đơn · biểu tượng + nhãn trong một nút · ảnh đại diện + tên · đường
dẫn phân cấp ngắn · dòng tổng tiền · nhãn + nhãn trạng thái · thanh điều khiển của một trình phát.

## `FLOW-3` — một chồng đọc từ trên xuống

**Tình huống.** Các con xếp dọc và **thứ tự trên–dưới là thứ tự đọc**. Đây là mã phổ biến nhất và
cũng là mã bị bỏ qua nhiều nhất, vì khối vốn đã tự xếp chồng nên người ta tưởng không cần khai báo.

**Dấu hiệu nhận biết**

- Mỗi con chiếm trọn bề rộng và không cạnh tranh bề rộng với con nào.
- Thứ tự có nghĩa: nhãn trước, ô nhập sau; tiêu đề trước, nội dung sau.
- Số lượng con có thể thay đổi theo trạng thái mà cách đọc không đổi.

**Tự hỏi.** Nếu đảo hai con cho nhau, người đọc có bị hiểu sai không? Nếu có — thứ tự có nghĩa, và
trục dọc phải được nói ra.

**Ranh giới**

- `FLOW-0`: một con thì không có chồng nào cả.
- `FLOW-6`: `grid` chỉ có một cột và **không bao giờ** khai báo số cột ở bất kỳ điểm ngắt nào thì đó
  là `FLOW-3` viết nhầm họ. Nói ra trục bằng `flex-col` để trục hiện lên trong danh sách class.

**Vì sao vẫn phải khai báo dù khối đã tự xếp chồng.** Vì `gap` chỉ sống trong flex và lưới. Một
chồng không khai báo sẽ được nối lại bằng `margin` trên con — và đó chính là lỗi mà mô-đun khoảng
cách cấm. Khai báo trục dọc là điều kiện để khoảng cách giữa các phần tử thuộc về cha.

**Tình huống nghiệp vụ hay gặp.** Nhãn + ô nhập · tiêu đề + nội dung phần · các phần nội dung của
một trang · thân của một thẻ · danh sách bình luận · các bước của một quy trình · nhóm nút xếp dọc
trên thiết bị di động · biểu mẫu.

## `FLOW-4` — một hàng được phép tràn xuống dòng sau

**Tình huống.** Một **túi** các phần tử độc lập, cùng loại, kích thước tự nhiên khác nhau. Thứ tự có
nghĩa, nhưng **cột thì không**. Phần tử nào không đủ chỗ thì xuống dòng, không ai bị cắt.

**Dấu hiệu nhận biết**

- Bề rộng mỗi phần tử do nội dung của chính nó quyết định, và các phần tử dài ngắn khác nhau.
- Số lượng phần tử không biết trước: người dùng thêm thẻ, bộ lọc, kỹ năng.
- Dòng thứ hai **không cần** thẳng cột với dòng thứ nhất.

**Tự hỏi.** Phần tử thứ tư có cần nằm thẳng cột dưới phần tử thứ nhất không? Nếu **không cần** —
`FLOW-4`.

**Ranh giới**

- `FLOW-2`: xem trên.
- `FLOW-6` và `FLOW-7`: nếu việc thẳng cột **mang nghĩa** — để so sánh, để đọc bảng, để các thẻ cùng
  cao — thì đây là họ lưới, không phải xuống dòng.
- `FLOW-1`: `FLOW-4` xuống dòng theo phần tử, `FLOW-1` xuống dòng theo chữ.

**"Bây giờ vẫn vừa" không phải một lý lẽ.** Hai nhãn nhỏ vừa khít hôm nay sẽ không vừa khi bản dịch
dài hơn, khi tên người dùng dài hơn, hoặc khi người dùng phóng to chữ. Nếu tập có thể dài ra, mã là
`FLOW-4` ngay từ đầu.

**Tình huống nghiệp vụ hay gặp.** Thẻ · bộ lọc dạng nhãn nhỏ · danh sách kỹ năng · các nhãn trạng
thái của một khoá học · nhóm nút phụ · danh sách người tham gia dạng ảnh đại diện + tên · các tuỳ
chọn trả lời ngắn · chú giải biểu đồ.

## `FLOW-5` — hàng khi rộng, chồng khi hẹp

**Tình huống.** Cùng một tập, hai trục ở hai bề rộng. Khi hết chỗ, cả tập **đổi trục** chứ không
phải gãy dòng: mỗi phần tử chiếm trọn bề rộng và tập đọc từ trên xuống.

**Dấu hiệu nhận biết**

- Các phần tử **không** hoán đổi được: một bên là nội dung, một bên là hành động hoặc số liệu.
- Khi hẹp, phần tử nào cũng cần trọn bề rộng để đọc hoặc để bấm.
- Chỉ có hai hoặc ba phần tử, và chúng không tạo thành một túi.

**Tự hỏi.** Khi hẹp, tập này nên **gãy dòng** hay nên **đổi trục**? Nếu các phần tử cần trọn bề rộng
— đổi trục, `FLOW-5`.

**Ranh giới**

- `FLOW-4`: xuống dòng giữ nguyên trục ngang và chỉ ngắt dòng; `FLOW-5` bỏ hẳn trục ngang ở bề rộng
  hẹp. Một túi nhãn nhỏ không bao giờ là `FLOW-5`; hai nút hành động thì thường là.
- `FLOW-2`: `FLOW-2` giữ một dòng ở mọi bề rộng và trả giá bằng việc cắt bớt; `FLOW-5` không trả giá
  đó.
- `FLOW-6`: nếu các phần tử hoán đổi được và cần thẳng cột thì đây là lưới có số cột đổi theo điểm
  ngắt.

**Viết theo hướng hẹp trước.** `flex flex-col sm:flex-row`, không phải `flex flex-row sm:flex-col`.
Trạng thái mặc định phải là trạng thái an toàn nhất, để một bề rộng chưa ai nghĩ tới vẫn đọc được.
Đây cũng là chỗ duy nhất `flex-row` có lý do tồn tại: nó **huỷ** `flex-col` ở một điểm ngắt.

**Tình huống nghiệp vụ hay gặp.** Nội dung + nhóm nút của một khối kêu gọi hành động · tiêu đề trang
+ hành động chính · ảnh + mô tả của một khối giới thiệu · phần cuối của biểu mẫu: nút phụ và nút
chính · ô tìm kiếm + nút lọc · cụm số liệu + cụm chú thích · thẻ ngang trên máy tính, thẻ dọc trên
thiết bị di động.

## `FLOW-6` — số cột do sản phẩm quyết

**Tình huống.** Các phần tử **hoán đổi được** và phải **thẳng cột**, với số cột là một quyết định
nội dung: ba lợi ích trên một hàng, hai trường nhập liệu một hàng, bốn số liệu một hàng.

**Dấu hiệu nhận biết**

- Các phần tử cùng loại, cùng vai trò, và người đọc so sánh chúng với nhau.
- Có một con số "đúng" cho số cột, và con số đó đến từ nội dung chứ không từ bề rộng màn hình.
- Các ô trong cùng một hàng nên cao bằng nhau.

**Tự hỏi.** Con số cột này đến từ **nội dung** (ba lợi ích, hai trường nhập liệu) hay từ **bề rộng**
(nhét được bao nhiêu thì nhét)? Nếu từ nội dung — `FLOW-6`.

**Ranh giới**

- `FLOW-7`: `FLOW-6` viết ra số cột và các điểm ngắt; `FLOW-7` không viết điểm ngắt nào. Nếu đang
  phân vân "mấy cột ở màn hình vừa", có lẽ câu hỏi thật là bề rộng tối thiểu của phần tử — `FLOW-7`.
- `FLOW-4`: xem trên.
- `FLOW-3`: `grid` không khai báo số cột ở bất kỳ đâu là `FLOW-3` viết nhầm họ.

**Một cột ngầm ở bề rộng gốc là hợp lệ** khi có điểm ngắt khai báo số cột sau đó: `grid
sm:grid-cols-2` nói rõ rằng bề rộng gốc là một cột. Nhưng `grid` đứng trơ trọi thì không khai báo gì
cả.

**Tình huống nghiệp vụ hay gặp.** Hai trường nhập liệu họ và tên · ba ô số liệu tổng quan · bốn lợi
ích của gói dịch vụ · lưới các lựa chọn trắc nghiệm · bảng giá ba gói · lưới ảnh cố định · lưới ngày
trong một tháng.

## `FLOW-7` — số cột do bề rộng tối thiểu của phần tử quyết

**Tình huống.** Một tập **không biết trước độ dài**, mỗi phần tử có một bề rộng mà dưới đó nó không
còn đọc được. Số cột không phải quyết định của sản phẩm; nó là **hệ quả** của bề rộng còn lại.

**Dấu hiệu nhận biết**

- Số phần tử đến từ dữ liệu và thay đổi theo bộ lọc.
- Có thể nói ra một câu kiểu "dưới 16rem thì tiêu đề khoá học rối và ảnh vô nghĩa".
- Vùng chứa này còn được dùng lại ở nhiều bề rộng khác nhau: trang đầy đủ, trong thanh dọc, trong
  hộp thoại.

**Tự hỏi.** Có tồn tại một bề rộng mà **dưới nó phần tử mất nghĩa** không? Nếu có, hãy khai báo bề
rộng đó và để số cột tự suy ra.

**Ranh giới**

- `FLOW-6`: xem trên. Dấu hiệu quyết định là **điểm ngắt**: `FLOW-7` không có cái nào.
- `FLOW-4`: xuống dòng không làm các phần tử bằng nhau và không thẳng cột; `FLOW-7` làm cả hai.

**`auto-fill` và `auto-fit` là hai câu trả lời khác nhau cho trạng thái một phần tử.** `auto-fill`
giữ lại các rãnh rỗng, nên một phần tử duy nhất vẫn đứng đúng bề rộng của một phần tử. `auto-fit`
xoá các rãnh rỗng, nên một phần tử duy nhất kéo dài hết hàng. Chọn theo việc **trạng thái một kết
quả** phải trông như thế nào, và nói ra mình chọn cái nào — đây là chỗ hay bị chọn theo thói quen.

**Tình huống nghiệp vụ hay gặp.** Lưới kết quả tìm kiếm · danh mục khoá học có bộ lọc · thư viện ảnh
· danh sách thành viên · lưới template · danh sách tệp đính kèm · lưới bài viết trên trang blog.

## `FLOW-8` — các rãnh có vai trò khác nhau

**Tình huống.** Các rãnh **không hoán đổi được**. Mỗi rãnh có một công việc riêng và một bề rộng
được sở hữu riêng: một thanh dọc lọc rộng cố định, một vùng nội dung ăn phần còn lại, một khung ghim
bên phải.

**Dấu hiệu nhận biết**

- Đổi chỗ hai rãnh cho nhau là đổi hẳn nghĩa của trang.
- Ít nhất một rãnh có bề rộng là một quyết định bố cục, không phải hệ quả của nội dung.
- Một rãnh có thể biến mất, được ghim, hoặc cuộn độc lập ở màn hình lớn.

**Tự hỏi.** Hai vùng này có hoán đổi cho nhau được không? Nếu **không** — `FLOW-8`.

**Ranh giới**

- `FLOW-6`: `grid-cols-2` nói "hai cột bằng nhau chứa hai thứ cùng loại". `FLOW-8` nói "một thanh
  dọc và một vùng nội dung". Dùng `grid-cols-2` cho thanh dọc là ép thanh dọc rộng bằng nửa trang.
- `FLOW-5`: `FLOW-5` cũng đổi trục khi hẹp, nhưng các phần tử của nó không sở hữu bề rộng riêng.

**Rãnh nội dung luôn là `minmax(0,1fr)`.** `1fr` có sàn là `min-content`, nên rãnh nội dung sẽ từ
chối co lại dưới thứ dài nhất bên trong nó: một tên tệp không xuống dòng, một bảng, một khối mã. Khi
đó thanh dọc bị bóp méo hoặc cả trang trượt ngang, và `truncate` bên trong lặng lẽ không có tác
dụng. Đây là lỗi tốn nhiều thời gian nhất trong cả mô-đun này, vì nó trông như lỗi của mô-đun tràn
nội dung.

**Tình huống nghiệp vụ hay gặp.** Thanh dọc lọc + kết quả · điều hướng + nội dung · cây thư mục +
trình soạn thảo · danh sách hội thoại + khung trò chuyện · nội dung + mục lục ghim · danh mục + giỏ
hàng · biểu mẫu + khung xem trước.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| số con | Có bao nhiêu con trực tiếp ở trạng thái tải, rỗng, một phần tử và lỗi |
| khả năng hoán đổi | Các con là thành viên của một tập, hay là những phần có công việc khác nhau |
| thứ tự đọc | Nghĩa phụ thuộc vào trái–phải, trên–dưới, hay không phụ thuộc cái nào |
| thẳng cột giữa các dòng | Phần tử sau có phải thẳng hàng với phần tử trước, hay chỉ cần vừa chỗ |
| ai sở hữu bề rộng | Bề rộng của một phần tử đến từ nội dung, từ vùng chứa, hay từ một quyết định sản phẩm |
| ngưỡng đọc được | Có bề rộng nào mà dưới đó phần tử không còn đọc được không |

## Quy tắc

1. Cha khai báo luồng. Con **không** khai báo trục mà nó đang nằm trên.
2. Một cha, một luồng. Hai trục trong cùng một tập con nghĩa là đang thiếu một cha.
3. Hàng là trục mặc định: `flex` một mình đã là hàng. `flex-row` chỉ viết để huỷ `flex-col` ở một
   điểm ngắt, tức là `FLOW-5`.
4. Một hàng hoặc giữ một dòng, hoặc được xuống dòng. `FLOW-2` và `FLOW-4` loại trừ nhau; khai báo cả
   hai là không khai báo gì.
5. Dòng xuống dòng không bao giờ thẳng cột với dòng trên. Cần thẳng cột thì tình huống chuyển sang
   họ lưới.
6. Chồng dọc không xuống dòng. `flex-col flex-wrap` mà không khai báo chiều cao thì không xuống dòng
   gì cả, và đọc như một quyết định chưa từng được đưa ra.
7. Mọi lưới khai báo số cột: bằng số, bằng bề rộng tối thiểu, hoặc bằng vai trò của rãnh.
8. Rãnh nội dung trong `FLOW-8` là `minmax(0,1fr)`, không bao giờ là `1fr`.
9. Thứ tự nhìn thấy bằng thứ tự trong DOM. Các tiện ích đảo chiều và sắp xếp lại không phải khai báo
   luồng.
10. Màn hình hẹp đi **không** làm đổi mã. `FLOW-5`, `FLOW-6` và `FLOW-7` đã chứa sẵn câu trả lời cho
    việc hết bề rộng.
11. Trạng thái rỗng, trạng thái một phần tử và khung chờ giữ nguyên mã của cha.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Một con mà trạng thái có thể nhân lên thì không phải `FLOW-0`.** Danh sách hôm nay trả về một
  kết quả là cùng một tình huống với danh sách trả về chín kết quả. Khai báo luồng mà tập đòi hỏi,
  không khai báo luồng mà dữ liệu hôm nay tình cờ cho phép.
- **Câu có chèn nhãn nhỏ, liên kết hay biểu tượng vẫn là `FLOW-1`.** Con nội tuyến không tạo thành
  hàng. Bọc chúng trong `flex` là lấy đi khả năng ngắt dòng giữa các chữ, thứ duy nhất mà văn bản
  không được phép mất.
- **Hai phần tử lúc nào cũng vừa vẫn là `FLOW-4`** nếu một bản dịch dài hơn, một tên dài hơn hay một
  cỡ chữ lớn hơn có thể làm chúng không vừa. "Trong bản thiết kế thì vừa" là một phát biểu về bản
  thiết kế.
- **Một cột ngầm là `FLOW-6` chỉ khi có điểm ngắt khai báo số cột sau đó.** `grid` không khai báo số
  cột ở bất kỳ bề rộng nào là `FLOW-3` viết nhầm họ.
- **`auto-fit` và `auto-fill` là một mã với hai hành vi.** `auto-fill` giữ lại các rãnh rỗng, nên
  một phần tử duy nhất đứng đúng bề rộng tối thiểu của nó; `auto-fit` xoá các rãnh rỗng, nên một
  phần tử duy nhất kéo dài hết hàng. Chọn theo việc trạng thái một phần tử phải trông như thế nào,
  và nói ra mình chọn cái nào.
- **Khung chờ và nội dung thật dùng chung một mã.** Một trạng thái nghỉ xếp chồng trong khi trạng
  thái đã tải xếp hàng là vẽ trước một bố cục sẽ không bao giờ xuất hiện.

## Đầu ra

Mỗi vùng chứa một khối, từ ngoài vào trong:

```text
parent: <vùng chứa>
children: <các con trực tiếp, và bao nhiêu con ở mỗi trạng thái>
axis: <none | inline | row | column | grid>
wrap: <not allowed | may wrap | reflows to a column | grid rows>
situation: <FLOW-0 | FLOW-1 | FLOW-2 | FLOW-3 | FLOW-4 | FLOW-5 | FLOW-6 | FLOW-7 | FLOW-8>
className: <no class | flex | flex flex-col | flex flex-wrap | flex flex-col <bp>:flex-row | grid <bp>:grid-cols-<n> | grid grid-cols-[repeat(auto-fill,minmax(<min>,1fr))] | grid <bp>:grid-cols-[<track>_minmax(0,1fr)]>
reason: <sự thật nghiệp vụ loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Danh mục khoá học: thanh dọc lọc bên trái, kết quả bên phải; phía trên kết quả có một
dải nhãn lọc mà người dùng thêm được; kết quả là các thẻ, tìm ra bao nhiêu hiện bấy nhiêu; mỗi thẻ
hiện tiêu đề và một nhãn cấp độ đứng cạnh trên cùng một dòng."

Yêu cầu này nói ra năm vùng chứa: vùng trang chứa thanh dọc và vùng kết quả, vùng kết quả chứa dải
nhãn lọc và tập thẻ, dải nhãn lọc, tập thẻ, và dòng tiêu đề bên trong một thẻ. Nó không nói tới phần
đầu trang, không nói tới phân trang, không nói tới chân thẻ, nên không giải những thứ đó.

```text
parent: vùng trang
children: thanh dọc lọc, vùng kết quả — 2 ở mọi trạng thái
axis: grid
wrap: grid rows
situation: FLOW-8
className: grid lg:grid-cols-[16rem_minmax(0,1fr)]
reason: đổi chỗ thanh dọc và kết quả là đổi nghĩa của trang, và bề rộng thanh dọc là một quyết định bố cục, điều này loại trừ FLOW-6
```

```text
parent: vùng kết quả
children: dải nhãn lọc, tập thẻ — 2 ở mọi trạng thái
axis: column
wrap: not allowed
situation: FLOW-3
className: flex flex-col
reason: nhãn lọc được đọc trước kết quả và không bên nào cạnh tranh bề rộng, điều này loại trừ FLOW-5
```

```text
parent: dải nhãn lọc
children: các nhãn lọc — số lượng không biết trước, dài ra khi người dùng thêm bộ lọc
axis: row
wrap: may wrap
situation: FLOW-4
className: flex flex-wrap
reason: nhãn thứ tư không cần nằm thẳng cột dưới nhãn thứ nhất, điều này loại trừ FLOW-7
```

```text
parent: tập thẻ
children: các thẻ khoá học — tìm ra bao nhiêu hiện bấy nhiêu, một thẻ ở trạng thái một kết quả, không thẻ nào khi rỗng
axis: grid
wrap: grid rows
situation: FLOW-7
className: grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]
reason: số cột là hệ quả của bề rộng còn lại chứ không phải một con số do sản phẩm quyết, điều này loại trừ FLOW-6
```

```text
parent: dòng tiêu đề của thẻ
children: tiêu đề, nhãn cấp độ — 2 ở mọi trạng thái
axis: row
wrap: not allowed
situation: FLOW-2
className: flex
reason: nhãn rơi xuống dòng thứ hai sẽ làm một thẻ cao hơn các thẻ cùng hàng lưới, điều này loại trừ FLOW-4
```

Yêu cầu không nói trạng thái một kết quả phải trông như thế nào, nên `auto-fill` được chọn và được
nói ra ở đây: một thẻ duy nhất giữ đúng bề rộng của một thẻ thay vì kéo dài hết hàng. Yêu cầu cũng
không nói bên trong thanh dọc có gì, nên luồng của chính thanh dọc không được giải; giải nó khi yêu
cầu nói ra thứ nằm trong đó.

## Phạm vi

Mô-đun này chỉ quyết định **trục và việc xuống dòng**. Canh lề trục ngang, độ lớn của khoảng cách,
ai nhường bề rộng khi hàng quá chật, và khoảng đệm của mọi hộp đều thuộc các mô-đun bên cạnh; ví dụ
có mang những class đó để mã đánh dấu đọc như mã đánh dấu thật, nhưng chúng không bao giờ là lý do
một mã được chọn.

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường.
