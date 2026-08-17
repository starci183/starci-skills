---
title: Distribution · Vietnamese
---

# Phân bố

Đầu vào là một yêu cầu viết bằng lời thường — "một hàng tệp gồm biểu tượng, tên tệp, kích thước và
nút xoá" — và đầu ra là, với **mỗi người tham gia** mà yêu cầu đó ngụ ý, một mã tình huống và một
className. Yêu cầu không bao giờ nói ra một bề rộng, và không được phép ước lượng một bề rộng: bề
rộng suy ra từ việc mỗi người tham gia làm gì khi **còn thừa** chỗ và làm gì khi **thiếu** chỗ.

## Luật

Một hàng chỉ có một bề rộng, nhưng có nhiều thứ đòi phần trong đó. Phân bố là quyết định **ai lấy
phần dư, ai nhường phần thiếu, và ai đứng yên qua cả hai**.

Chỗ được chia cho những **người tham gia**. Một người tham gia là một phần tử con trực tiếp của phần
tử cha phân phối, hoặc là một khoảng nối giữa hai phần tử con. Mọi người tham gia đều trả lời đúng
hai câu — khi còn thừa chỗ thì làm gì, khi thiếu chỗ thì làm gì — và cặp câu trả lời đó chính là mã.

**Khi hai câu trả lời mâu thuẫn, câu về phần thiếu quyết định mã.** Một phần tử con có thể vừa lấy
phần dư vừa từ chối nhường; nó được gọi tên bằng sự **từ chối**, vì đó mới là dữ kiện làm vỡ hàng.
Phần dư quyết định hàng *trông* thế nào. Phần thiếu quyết định hàng còn **giữ được nội dung** hay
không.

**Đây là luật bắt buộc.** Bất cứ phần tử cha nào xếp con theo một trục — hàng flex, cột flex, lưới —
đều tạo ra tình huống phân bố cho **từng** người tham gia, và tình huống đó có một mã ở dưới. Không
có hàng nào nhỏ đến mức được miễn: một biểu tượng đứng cạnh một nhãn là `DIST-3` cạnh `DIST-1`, đúng
cùng một lý do mà một thanh dọc cố định đứng cạnh vùng kết quả là `DIST-5` cạnh `DIST-1`. Câu "có mỗi
biểu tượng với chữ thôi mà" không phải một ngoại lệ — đó chính là hàng mà cái tên dài đầu tiên trong
dữ liệu thật sẽ đẩy biểu tượng rơi ra khỏi thẻ.

## Mã tình huống

Mã gọi tên TÌNH HUỐNG — vai trò của một người tham gia trong việc chia một trục của một phần tử cha.
Cột className gọi tên thứ mà tình huống đó phát ra, và có một mã không phát ra gì cả.

| Mã | Tình huống | className |
|---|---|---|
| `DIST-0` | Người tham gia lấy đúng kích thước tự nhiên và không có gì được khai báo về nó | *không khai báo* |
| `DIST-1` | Một phần tử con ôm trọn phần dư và gánh trọn phần thiếu | `min-w-0 flex-1` |
| `DIST-2` | Nhiều phần tử con chia đều trục với nhau | `min-w-0 flex-1` mỗi cái · `grid-cols-<n>` |
| `DIST-3` | Phần tử con **không bao giờ** được co, dù hàng phải chứa gì | `shrink-0` |
| `DIST-4` | Phần tử con **phải được phép co**, dù không lấy phần dư | `min-w-0` |
| `DIST-5` | Phần tử con giữ một số đo do bố cục quyết định, không phải do nội dung | `w-64 shrink-0` · rãnh `16rem` |
| `DIST-6` | Không phần tử con nào lấy phần dư; một khoảng nối được chọn để lấy | `ml-auto` · phần tử cha `justify-between` |

`DIST-0` LÀ MỘT TÌNH HUỐNG, KHÔNG PHẢI MỘT CHỖ TRỐNG. Một phần tử con flex không khai báo gì thì
không hề trung lập: nó **đã** từ chối giãn, và nó **đã** đồng ý co — nhưng chỉ tới đúng bề rộng nội
dung của chính nó, không thêm một điểm ảnh nào. Cái sàn đó vô hình trong mọi bản thiết kế và quyết
định mọi thứ trong dữ liệu thật. Mã này tồn tại vì "không khai báo gì" là một trường hợp người đọc
phải nhận ra, trích dẫn được và bị bắt lỗi được. Một tình huống không có tên là một tình huống không
ai chứng minh được là đã làm sai, và đây đúng là tình huống bị làm sai nhiều nhất — không phải vì
người ta chọn nó, mà vì người ta rơi vào nó.

`min-w-0` là một **quyền**, không phải một kiểu trang trí. Kích thước tối thiểu của một phần tử con
flex chính là nội dung của nó. Chừng nào cái tối thiểu đó chưa được gỡ, phần tử con không co: nó giữ
nguyên bề rộng nội dung và đẩy phần tử cùng cấp văng ra khỏi hàng. Trong danh sách class không có gì
trông hỏng cả — chỉ có hàng là không còn là hàng. Đó là lý do `DIST-4` tồn tại thành một mã riêng, và
lý do `DIST-1` cùng `DIST-2` mang sẵn `min-w-0` trong phần phát ra thay vì để người viết phải tự nhớ.
**Một `truncate`, một `line-clamp` hay một vùng cuộn nằm trong hàng đều nằm im cho tới khi mọi mắt
xích giữa hàng và chính phần tử đó được cấp quyền co.** Một `min-w-0` ở phần tử con ngoài cùng không
mở khoá cho một phần tử con nằm sâu ba tầng bên trong. Trên trục dọc, cùng luật đó đọc là `min-h-0`.

Viết bề rộng ra thôi thì không giữ được. Viết một bề rộng lên một phần tử con flex là nêu một nguyện
vọng, không phải một luật. Flex mặc định **bật** co, nên phần tử con đó buông số đo đã khai ngay khi
hàng hẹp — âm thầm, theo tỉ lệ, và không để lại dấu hiệu nào cho biết đã từng có một con số ở đó.
Cho nên `DIST-5` luôn là **hai** tuyên bố: số đo, và lời từ chối nhường nó. Trong lưới, cùng sự thật
ấy đọc khác đi: rãnh `1fr` có sàn tự động, nên một rãnh chứa nội dung dài sẽ từ chối co và kéo giãn
cả lưới vượt khỏi vùng chứa. `minmax(0,1fr)` là cách viết `min-w-0` của lưới, và nó cần thiết vì đúng
lý do đó.

Khoảng nối cũng là một người tham gia. Chỗ trống không phần tử con nào đòi thì không biến mất; nó dồn
về đâu đó. `DIST-6` là quyết định đưa nó vào một khoảng nối được chọn thay vì nhét vào trong một phần
tử con — khác biệt giữa một tiêu đề bị kéo dài ra và một tiêu đề giữ nguyên bề rộng của mình trong
khi nút hành động dịch ra tận mép. Mô-đun này sở hữu câu hỏi **ai** nhận chỗ; khoảng cách lúc nghỉ
giữa các phần tử cùng cấp là một quyết định khác. Một khoảng nối nở ra vì `DIST-6` là một khoảng nối
**bị giãn**, không phải một khoảng nối được chọn to hơn.

## Đọc một yêu cầu

1. **Liệt kê những phần tử cha phân phối mà yêu cầu nói ra**, và với mỗi cái, gọi tên trục của nó.
   "Một hàng tệp gồm biểu tượng, tên tệp, kích thước và nút xoá" nói ra một phần tử cha, một trục
   ngang.
2. **Không bịa ra người tham gia mà yêu cầu không hề nhắc.** Thanh dọc, cột thứ hai hay trình đơn
   không nằm trong yêu cầu đó. Giải cái được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong**, rồi tới từng phần tử cha phân phối lồng bên trong. Mã của một người
   tham gia thuộc về một trục của một phần tử cha; phần tử con không bao giờ thừa hưởng mã của hàng
   nằm bên trong nó.
4. **Với mỗi người tham gia, hỏi đủ hai câu** — nó làm gì với phần dư, nó làm gì với phần thiếu — rồi
   đọc các phần bên dưới. Mã đầu tiên có tình huống khớp chính là đáp án. Khi hai câu trả lời mâu
   thuẫn, phần thiếu quyết định.
5. **Kiểm tra hàng có giữ được không.** Mỗi phần tử cha, mỗi trục, nhiều nhất **một** `DIST-1`, và
   phải có ít nhất một người tham gia gánh được phần thiếu. Một hàng chỉ gồm `DIST-3` và `DIST-5` là
   một hàng đã tuyên bố trước rằng nó sẽ tràn.
6. **Nếu hai mã cùng khớp, chọn mã khai báo ít hơn.** Nếu một phần tử cha trộn những vai trò không
   thể cùng tồn tại, phải tách phân cấp trước rồi mới chọn.

## `DIST-0` — không khai báo gì, và đó vẫn là một hành vi

**Tình huống.** Trong hàng không có gì đủ dài để tranh chỗ: mọi phần tử con đều là nội dung ngắn,
đóng, và tổng bề rộng của chúng luôn nhỏ hơn hàng. Không ai cần được ưu tiên, không ai cần được bảo
vệ.

**Dấu hiệu nhận biết**

- Mọi giá trị trong hàng đến từ một tập đóng: nhãn cố định, biểu tượng, số có độ dài biết trước.
- Không có phần tử con nào cần chạm mép phải của hàng.
- Không có phần tử con nào bị cắt, xuống dòng hay cuộn — vì chưa bao giờ có phần thiếu.

**Tự hỏi.** Có dữ liệu thật nào khiến tổng bề rộng các phần tử con vượt quá hàng không? Nếu **không
có** — `DIST-0`.

**Ranh giới**

- `DIST-3`: `DIST-0` là "chưa bao giờ thiếu chỗ"; `DIST-3` là "có thể thiếu, nhưng riêng cái này cấm
  co". Nếu trong hàng có **một** phần tử con sinh ra từ dữ liệu người dùng nhập, hàng đó không còn là
  `DIST-0` nữa.
- `DIST-4`: cùng là "không lấy phần dư", nhưng `DIST-0` co tới **sàn nội dung** rồi dừng và đẩy phần
  tử cùng cấp ra, còn `DIST-4` là khi đúng chỗ dừng đó là thứ phải bỏ đi.

**Tình huống nghiệp vụ hay gặp.** Cụm nhãn trạng thái ngắn · biểu tượng + số đếm · đường dẫn phân cấp
hai cấp cố định · cụm nhãn cấp độ · phân trang theo số trang · cụm biểu tượng mạng xã hội · nhãn đơn
vị cạnh một con số.

## `DIST-1` — một phần tử con ôm cả hàng

**Tình huống.** Trong hàng có đúng **một** thứ là nội dung thật, dài không biết trước, và mọi thứ còn
lại là phụ kiện quanh nó: ảnh đại diện, biểu tượng, nhãn trạng thái, nút, dấu thời gian. Nội dung đó
vừa được lấy hết chỗ thừa, vừa là thứ phải nhường khi thiếu.

**Dấu hiệu nhận biết**

- Có đúng một phần tử con đến từ dữ liệu người dùng hoặc dữ liệu nghiệp vụ.
- Các phần tử con còn lại có bề rộng đoán được trước khi chạy.
- Nếu nội dung đó dài ra, thứ *phải* nhỏ lại chính là nó, không phải các phụ kiện.

**Tự hỏi.** Nếu chuỗi dài nhất có thể xảy ra đổ vào hàng này, ai là người phải nhường? Nếu chỉ có một
người và người đó cũng là người đáng được lấy chỗ thừa — `DIST-1`.

**Ranh giới**

- `DIST-2`: `DIST-1` là **một** người ôm hết; `DIST-2` là **nhiều** người chia nhau. Hai phần tử con
  cùng mang `flex-1` không phải hai `DIST-1` — đó là `DIST-2` viết sai tên.
- `DIST-4`: `DIST-4` **nhường** nhưng **không lấy** phần dư. Nếu phần tử con phải co mà lại không
  được phép giãn ra chạm mép, nó là `DIST-4`, không phải `DIST-1`.
- `DIST-3` mang `grow`: nếu phần tử con này giãn nhưng **cấm bị cắt**, phần thiếu quyết định — nó là
  `DIST-3`, và hàng phải tìm người khác để nhường.

`min-w-0` là phần bắt buộc của mã này, không phải phần thêm. Thiếu nó, phần tử con vẫn giãn đúng như
mong đợi khi rộng, và **không** co khi hẹp — nó đẩy phần tử cùng cấp văng ra khỏi hàng. Đây là kiểu
hỏng không báo lỗi: danh sách class nhìn vẫn đúng, chỉ có hàng là không còn là hàng.

**Tình huống nghiệp vụ hay gặp.** Tên người + nút hành động · tiêu đề bài học + nhãn tiến độ · tên
tệp + kích thước · tiêu đề hội thoại + dấu thời gian · tên khoá học + giá · ô tìm kiếm trong thanh
công cụ · tiêu đề thẻ + trình đơn ba chấm · tên nhánh + trạng thái bản dựng · địa chỉ ví + nút văn
bản.

## `DIST-2` — nhiều phần tử con chia đều

**Tình huống.** Không ai trong hàng quan trọng hơn ai. Các phần tử con là những mục **đồng hạng**, và
bề rộng bằng nhau chính là thông điệp: chúng có thể so sánh với nhau.

**Dấu hiệu nhận biết**

- Các phần tử con cùng loại, cùng vai trò, thường sinh ra từ cùng một mảng dữ liệu.
- Bề rộng bằng nhau là điều người đọc **dựa vào** để so sánh, không phải hệ quả tình cờ.
- Thêm hoặc bớt một mục là chuyện bình thường của màn hình này.

**Tự hỏi.** Bề rộng bằng nhau ở đây có phải là một tuyên bố nghiệp vụ ("mấy thứ này ngang hàng nhau")
không, hay chỉ là ngẫu nhiên trông đều?

**Ranh giới**

- `DIST-1`: xem trên.
- `DIST-5`: nếu **một** trong các cột phải có số đo cố định thì cột đó là `DIST-5`, và phần còn lại
  mới chia nhau.
- **Chia đều trục** so với **chia đều phần dư** là hai chuyện khác nhau. `flex-1` cho ra các cột bằng
  nhau; `grow` giữ nguyên bề rộng nội dung của từng phần tử con rồi chỉ chia đều chỗ thừa. Cả hai vẫn
  là `DIST-2`; câu hỏi phân định là: cái phải bằng nhau là **các cột**, hay là **phần được thêm vào**?

Số cột là một quyết định bố cục, không phải quyết định của từng phần tử con. Khi số mục thay đổi theo
dữ liệu, khai số cột ở phần tử cha; đừng để mỗi phần tử con tự tính phần của mình bằng phân số.

**Tình huống nghiệp vụ hay gặp.** Ba ô số liệu tổng quan · nhóm nút phân đoạn · lưới thẻ khoá học ·
bảng giá ba gói · nhóm nút chọn đáp án · dải bảy ngày · dải thống kê trong phần đầu · cụm hai nút
Huỷ/Xác nhận trải đều toàn bề rộng trên thiết bị di động.

## `DIST-3` — cấm co, bất kể hàng phải chứa gì

**Tình huống.** Có một thứ trong hàng mà **mất một phần là mất tất cả**: một biểu tượng bị bóp thành
hình oval, một nút bị nuốt mất chữ, một con số bị cắt còn nửa. Những thứ này không được phép là người
nhường.

**Dấu hiệu nhận biết**

- Đọc thiếu một phần của nó thì người đọc **hiểu sai**, chứ không phải hiểu ít đi.
- Nó vuông, tròn, hoặc có tỉ lệ phải giữ.
- Nó là thứ người dùng phải bấm được — vùng chạm không được co lại theo bề rộng của phần tử cùng cấp.

**Tự hỏi.** Nếu thứ này nhỏ lại 30%, người đọc có bị hiểu **sai** không, hay chỉ đọc được ít hơn? Nếu
hiểu sai — `DIST-3`.

**Ranh giới**

- `DIST-0`: `DIST-0` là hàng chưa bao giờ thiếu chỗ; `DIST-3` là hàng có thể thiếu và cái này được
  miễn nhường. Khi bên cạnh có một `DIST-1`, mọi phụ kiện trong hàng đều cần được nói rõ là `DIST-3`.
- `DIST-5`: `DIST-3` lấy số đo từ **nội dung của chính nó** rồi khoá lại; `DIST-5` lấy số đo từ một
  **quyết định bố cục**.
- `DIST-1`: một phần tử con vừa mang `grow` vừa mang `shrink-0` vẫn là `DIST-3` — phần thiếu quyết
  định.

`shrink-0` nói đúng một điều; `flex-none` nói hai. `flex-none` vừa cấm co vừa cấm giãn, mà cấm giãn
thì đã là mặc định. Chọn cái nói đúng điều mình muốn nói, để lần đọc sau không phải đoán vế nào là
chủ ý.

**Tình huống nghiệp vụ hay gặp.** Ảnh đại diện · biểu tượng trạng thái · nút chỉ có biểu tượng · nhãn
số thông báo · hộp kiểm trong hàng · giá tiền · mã đơn hàng · thời lượng bài học · nhãn "Mới" · biểu
tượng chữ V mở rộng · ảnh thu nhỏ vuông trong một hàng danh sách.

## `DIST-4` — phải được phép co, nhưng không lấy phần dư

**Tình huống.** Phần tử con này **phải nhường** khi hàng hẹp, nhưng không được phép phình ra khi hàng
rộng. Nó nhận đúng chỗ nó cần, và trả lại chỗ khi bị đòi.

**Dấu hiệu nhận biết**

- Nội dung của nó dài không đoán trước được.
- Nếu nó giãn ra chạm mép, bố cục bị sai nghĩa: một cụm nhận diện bị kéo rời khỏi ảnh đại diện, một
  nhãn nhỏ biến thành một thanh dài.
- Bên trong nó có `truncate`, `line-clamp` hoặc một vùng cuộn — và những thứ đó đang **không chạy**.

**Tự hỏi.** Thứ này có cần **nhỏ lại** khi hàng hẹp không, và khi hàng rộng nó có nên **đứng yên**
không? Nếu cả hai đều đúng — `DIST-4`.

**Ranh giới**

- `DIST-1`: `DIST-1` nhường **và** lấy; `DIST-4` chỉ nhường.
- `DIST-0`: cùng là "không lấy phần dư", nhưng `DIST-0` dừng ở sàn nội dung, còn `DIST-4` là đúng
  trường hợp cái sàn đó phải bị gỡ.

Đây là mã hay bị bỏ sót nhất, và bỏ sót nó không tạo ra lỗi nào để đọc. Mọi `truncate` nằm trong một
hàng đều cần `min-w-0` ở **từng mắt xích** giữa hàng và chính phần tử bị cắt. Một `min-w-0` ở phần tử
con ngoài cùng không mở khoá cho một phần tử con nằm sâu ba tầng bên trong. Trên trục dọc, luật này
đọc là `min-h-0`: một cột phải cuộn bên trong phần tử cha có trần sẽ giãn vượt trần thay vì cuộn, cho
tới khi chiều cao tối thiểu của nó được gỡ.

**Tình huống nghiệp vụ hay gặp.** Cụm tên + tên người dùng nằm cạnh ảnh đại diện · nhãn thẻ tab dài ·
nhãn nhỏ bộ lọc mang chữ do người dùng đặt · tên thư mục trong đường dẫn phân cấp · cụm chữ nằm trong
một `DIST-3` khác · cột lưới `1fr` chứa văn bản dài · vùng cuộn nằm trong cột flex.

## `DIST-5` — số đo do bố cục quyết định

**Tình huống.** Bề rộng của phần tử con này là một **quyết định của bố cục**, không phải hệ quả của
nội dung. Thanh dọc lọc rộng 16rem vì đó là kích thước đã chọn cho thanh dọc, không phải vì nhãn dài
nhất trong đó đo được ngần ấy.

**Dấu hiệu nhận biết**

- Nếu nội dung bên trong đổi, bề rộng vẫn phải giữ nguyên.
- Bề rộng đó lặp lại giống nhau ở nhiều màn hình khác — nó là một hằng số của sản phẩm.
- Bên còn lại của hàng mới là bên phải thích nghi.

**Tự hỏi.** Con số này đến từ đâu — từ nội dung dài nhất bên trong, hay từ một quyết định bố cục đã
chốt? Nếu từ quyết định bố cục — `DIST-5`.

**Ranh giới**

- `DIST-3`: xem trên. `DIST-3` khoá **kích thước nội dung**; `DIST-5` khoá **một con số**.
- `DIST-2`: nếu tất cả các cột đều do bố cục quyết định và **bằng nhau**, đó là `DIST-2` dạng lưới,
  không phải nhiều `DIST-5`.

Viết bề rộng ra thôi thì không giữ được. Flex mặc định **bật** co, nên phần tử con có `w-64` vẫn âm
thầm nhỏ hơn 64 khi hàng hẹp — không có dấu hiệu nào cho biết đã từng có một con số ở đó. `DIST-5`
luôn là **hai** tuyên bố: số đo, và lời từ chối nhường nó. Trong lưới, cùng một sự thật đọc khác đi:
rãnh `1fr` có sàn tự động, nên một rãnh chứa nội dung dài sẽ **kéo giãn cả lưới** vượt khỏi vùng
chứa. `minmax(0,1fr)` là cách viết `min-w-0` của lưới, và cần vì đúng lý do đó.

**Tình huống nghiệp vụ hay gặp.** Thanh dọc lọc · thanh bên điều hướng · khung giỏ hàng ghim bên phải
· cột bảng kiểm tra · cột số thứ tự trong bảng · cột ảnh đại diện cố định trong danh sách hội thoại ·
cột nhãn của biểu mẫu hai cột.

## `DIST-6` — phần dư rơi vào khoảng nối, không rơi vào phần tử con nào

**Tình huống.** Mọi phần tử con trong hàng đều muốn giữ nguyên bề rộng của mình, nhưng hàng vẫn phải
trải hết bề rộng: một bên nằm sát trái, một bên nằm sát phải. Chỗ thừa phải đi đâu đó — và nó đi vào
**khoảng giữa**.

**Dấu hiệu nhận biết**

- Có một mép mà một phần tử con bắt buộc phải chạm tới.
- Không phần tử con nào nên phình ra: phình ra là làm sai nghĩa (một tiêu đề bị kéo dài ra, một nút
  bị kéo rộng vô cớ).
- Đọc yêu cầu ra thành lời thì nó là "đẩy cái này sang phải", không phải "cho cái kia rộng ra".

**Tự hỏi.** Thứ tôi muốn to ra là một **phần tử con**, hay là **khoảng nối** giữa các phần tử con?

**Ranh giới**

- `DIST-1`: đây là nhầm lẫn đắt nhất trong mô-đun này. `flex-1` trên tiêu đề cũng đẩy được nút sang
  phải — nhưng nó đồng thời biến tiêu đề thành người gánh cả phần thiếu, và vùng bấm của tiêu đề tự
  nhiên kéo dài qua cả khoảng trống. Nếu ý định là **đẩy**, dùng `DIST-6`.
- Khoảng cách lúc nghỉ giữa các phần tử cùng cấp là một quyết định riêng; `DIST-6` sở hữu câu hỏi ai
  nhận **chỗ thừa**. Một khoảng nối nở ra vì `DIST-6` là một khoảng nối **bị giãn**, không phải một
  khoảng nối được chọn to hơn.

Không dùng phần tử rỗng để đẩy. Một `<div className="flex-1" />` là một phần tử con không có nội
dung, không có nghĩa, và vẫn được trình đọc màn hình duyệt qua như một phần tử. Chỗ thừa được đòi bởi
một khoảng nối, không bởi một phần tử con giả. Và `justify-between` với ba phần tử con là câu trả lời
cho một câu hỏi khác: nó chia chỗ thừa cho **mọi** khoảng nối. Khi chỉ một khoảng nối nên nở, hãy gom
các phần tử con thành hai nhóm, hoặc đặt `ml-auto` lên đúng phần tử con mở khoảng nối đó.

**Tình huống nghiệp vụ hay gặp.** Phần đầu thẻ: tiêu đề trái, trình đơn phải · phần cuối hộp thoại:
nút phụ trái, nút chính phải · hàng bảng: nhãn trái, giá trị phải · thanh công cụ: nhóm bộ lọc trái,
nút tạo mới phải · hàng danh sách: nội dung trái, biểu tượng chữ V phải · dòng tổng tiền.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| phần tử cha | Phần tử cha phân phối trực tiếp: hàng flex, cột flex, hoặc lưới |
| trục | Ngang (bề rộng) hoặc dọc (chiều cao); mỗi trục là một tình huống riêng |
| người tham gia | Các con trực tiếp, cộng thêm mọi khoảng nối đã được giao vai trò |
| luật phần dư | Người tham gia nào được quyền lấy chỗ thừa |
| luật phần thiếu | Người tham gia nào nhường trước, và ai không bao giờ được nhường |
| nguồn số đo | Kích thước đến từ nội dung hay từ một quyết định bố cục |

## Quy tắc

1. Mỗi người tham gia của một phần tử cha phân phối rơi vào **đúng một** mã, trên **đúng một** trục.
2. **Phần thiếu quyết định mã.** Hành vi khi thừa chỗ không bao giờ lật ngược được kết luận đó.
3. Mỗi hàng phải có ít nhất một người tham gia gánh được phần thiếu. Một hàng chỉ gồm `DIST-3` và
   `DIST-5` là một hàng đã tuyên bố trước rằng nó sẽ tràn.
4. Mỗi phần tử cha, mỗi trục, nhiều nhất **một** `DIST-1`. Hai phần tử con cùng đòi hết phần dư là
   `DIST-2` viết sai tên.
5. `min-w-0` phải có ở **mọi mắt xích** giữa hàng và phần tử thật sự phải nhường.
6. Số đo khai báo luôn đi kèm lời từ chối co.
7. Không dùng phần tử rỗng để đẩy chỗ. Chỗ thừa được đòi bởi một khoảng nối, không bởi một phần tử
   con đệm.
8. Bề rộng phần trăm hay phân số không phải là tuyên bố phân bố trong một phần tử cha có vẽ khoảng
   nối: khoảng nối được cộng thêm **lên trên** chúng và hàng tràn.
9. Mã không đổi theo khung nhìn. Màn hình hẹp hơn làm phần thiếu **dễ xảy ra hơn**, không làm nó khác
   đi.
10. Khung chờ và nội dung đã tải dùng chung một mã trên cùng một người tham gia.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Phần tử con vừa giãn vừa cấm cắt.** Một phần tử con lấy phần dư nhưng phải giữ nguyên vẹn nội
  dung là `DIST-3` mang thêm `grow`, không phải `DIST-1`. Phần thiếu quyết định. Khi đó phải có một
  người tham gia khác trong hàng là `DIST-1`, `DIST-2` hoặc `DIST-4`, nếu không hàng chẳng còn ai
  nhường.
- **Chia đều cột hay chia đều phần thêm.** `DIST-2` phát ra `flex-1` khi các cột phải bằng nhau, và
  `grow` khi mỗi phần tử con giữ bề rộng nội dung của mình và chỉ chỗ thừa được chia. Cả hai là
  `DIST-2`; câu hỏi phân định là điều phải bằng nhau nằm ở các cột hay ở phần được thêm vào.
- **Số, giá, mã định danh và thành phần điều khiển là `DIST-3` ngay cả khi đứng cạnh một `DIST-1`.**
  Một giá trị mà người đọc không kiểm chứng được sau khi bị cắt thì không được phép là người nhường.
- **Một phần tử con thì không có tình huống phân bố.** Một mình nó không chia gì cả. Chỉ gán mã khi
  có người tham gia thứ hai.
- **Hai mã cùng khớp.** Chọn mã **khai báo ít hơn**: `DIST-0` thay vì `DIST-3` khi trong hàng không
  có gì đẩy được; `DIST-4` thay vì `DIST-1` khi phần tử con phải nhường nhưng vốn không nhằm lấp đầy.
  Chỉ hỏi một câu phân định khi bên yêu cầu nói rõ họ cần vai trò lớn hơn.
- **Thiết kế đáp ứng.** Một người tham gia chỉ đổi mã khi phần tử cha của nó đổi — một thanh dọc trở
  thành khối xếp chồng phía trên nội dung là một **phần tử cha khác**, không phải cùng một thanh dọc
  cư xử khác đi.
- **Trục dọc.** Cùng bộ mã, đọc bằng `min-h-0`, `shrink-0` và `flex-1` trên trục khối. Một vùng cuộn
  trong cột flex không cuộn cho tới khi chiều cao tối thiểu của nó được gỡ.

## Đầu ra

Mỗi người tham gia một khối, từ phần tử cha ngoài cùng vào trong:

```text
parent: <flex row | flex column | grid>
axis: <inline | block>
participant: <phần tử con, hoặc khoảng nối>
surplus: <takes all | equal share | none | into the seam>
deficit: <absorbs | refuses | content floor>
situation: <DIST-0 | DIST-1 | DIST-2 | DIST-3 | DIST-4 | DIST-5 | DIST-6>
className: <no class | min-w-0 flex-1 | shrink-0 | min-w-0 | w-* shrink-0 | ml-auto>
reason: <sự thật nghiệp vụ loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Một hàng tệp: biểu tượng loại tệp, tên tệp, kích thước tệp và nút xoá."

Yêu cầu này nói ra một phần tử cha phân phối trên một trục: hàng, trục ngang. Nó nói ra bốn người
tham gia. Nó không nói tới thanh dọc, không nói tới cột thứ hai, không nói tới mép phải bắt buộc phải
chạm tới, nên chưa có khoảng nối nào được giao vai trò và không có `DIST-6` để giải. Nó cũng không
nói tới trục dọc, nên không giải tình huống chiều cao nào.

```text
parent: flex row
axis: inline
participant: biểu tượng loại tệp
surplus: none
deficit: refuses
situation: DIST-3
className: shrink-0
reason: một biểu tượng bị bóp méo làm người đọc hiểu sai chứ không phải đọc ít hơn, điều này loại trừ DIST-0 trong một hàng đã có dữ liệu người dùng
```

```text
parent: flex row
axis: inline
participant: tên tệp
surplus: takes all
deficit: absorbs
situation: DIST-1
className: min-w-0 flex-1
reason: tên tệp là nội dung không đoán trước duy nhất của hàng và cũng là thứ đáng được lấy chỗ thừa, điều này loại trừ DIST-4
```

```text
parent: flex row
axis: inline
participant: kích thước tệp
surplus: none
deficit: refuses
situation: DIST-3
className: shrink-0
reason: một số đo mà người đọc không kiểm chứng được sau khi bị cắt thì không được phép là người nhường, điều này loại trừ DIST-4
```

```text
parent: flex row
axis: inline
participant: nút xoá
surplus: none
deficit: refuses
situation: DIST-3
className: shrink-0
reason: vùng bấm phải sống sót qua cái tên tệp dài nhất, điều này loại trừ DIST-4
```

Hàng này giữ được vì có đúng một người tham gia, tên tệp, gánh được phần thiếu. Khi yêu cầu về sau
nói thêm rằng kích thước phải nằm sát mép phải trong khi tên vẫn giữ nguyên bề rộng của mình, tên trở
thành `DIST-4` và chỗ thừa chuyển vào một khoảng nối được chọn — `DIST-6`.

## Phạm vi

Mô-đun này chi phối một trục của một phần tử cha phân phối: flex hoặc lưới. Một phần tử cha dạng khối
mà các con đã chiếm trọn bề rộng thì không chia gì cả và không có tình huống nào ở đây. Chuyện xảy ra
với nội dung *bên trong* một người tham gia sau khi nó đã nhường — bị cắt, xuống dòng, kẹp dòng hay
cuộn — là một quyết định khác; mô-đun này chỉ quyết định việc nhường có được phép hay không.

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường.
