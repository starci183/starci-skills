---
title: Cache-key · Vietnamese
---

# Cache key

Đầu vào là một shape đã được duyệt: một surface, một block, một capability hay một contract mà nhu cầu
dữ liệu đã chốt. Pattern này không mở lại quyết định đó. Nó hạ quyết định đó xuống source: file hook
nào đặt tên cho câu trả lời, biểu thức key chứa những gì, fetcher đọc tham số ra từ đâu, khi nào key
phải là `null`, và một kết quả `null` được phép mang nghĩa gì.

## Luật

Cache key là **tên của một câu trả lời**. Mọi thứ dùng chung một key là dùng chung câu trả lời đó —
dữ liệu, lỗi, và với một mutation thì cả trạng thái đang chạy. Nên key không phải cái nhãn dán vào
request sau khi đã gọi. Nó **là câu hỏi, viết ra thành chữ**.

Vì thế key là một lời khẳng định, và lời khẳng định đó kiểm được: *câu trả lời này đúng với bất kỳ ai
hỏi đúng câu hỏi này.* Nếu hai người gọi cùng sinh ra một key mà cần hai câu trả lời khác nhau, thì
key đang đặt tên cho một thứ thô hơn câu trả lời nó đang giữ — và một trong hai người sẽ đọc phải
phần của người kia.

Câu hỏi quyết định một mảnh: **nếu giá trị này khác đi, câu trả lời có khác đi không?** Khác thì mảnh
đó thuộc về key. Không khác thì đó là nhiễu: nó xé một entry thành nhiều entry và bắt fetch lại mà
chẳng đổi được gì.

Key cũng chỉ có hai trạng thái: đủ, hoặc vắng mặt. Không có key dở dang, vì một key dựng từ một mảnh
chưa tới là một câu hỏi khác — câu hỏi không ai đặt ra — và câu trả lời nó cache được xếp dưới một cái
tên sẽ không bao giờ có ai hỏi lại nữa.

**Đây là luật bắt buộc, không phải lời khuyên.** Mỗi hook đặt tên cho một câu trả lời được cache đều
mang một mã dưới đây. Không có query nào nhỏ đến mức được miễn: một danh sách công khai chỉ có một
mảnh vẫn là `CACHE-1`, đúng theo cái lẽ mà một mutation trên từng dòng là `CACHE-3`. "Có mỗi một chuỗi
thôi mà" không phải một ngoại lệ — đó chính là chỗ một câu trả lời riêng tư đánh mất người đọc của nó
nhiều nhất.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `CACHE-<n>`. Mã đặt tên cho TÌNH HUỐNG; cột thứ ba nói
tình huống ấy buộc source phải trông như thế nào.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `CACHE-1` | Câu trả lời đổi theo một giá trị nào đó — một bộ lọc, một trang, một ngôn ngữ, một khoảng ngày, một id bản ghi | Mọi giá trị câu trả lời phụ thuộc vào đều là một mảnh của key, và fetcher đọc tham số ra từ key. Không có mảnh nào câu trả lời đổi theo mà nằm ngoài key; không fetcher nào đóng gói tham số thay vì đọc từ key; không có mảnh nhiễu xé một entry thành nhiều entry cho không |
| `CACHE-2` | Câu trả lời được tính ra từ chính người đang hỏi | Câu trả lời riêng tư mang trong key một fingerprint ổn định, không đảo ngược được, của người đọc. Không bao giờ lấy một chuỗi hằng làm toàn bộ key cho một câu trả lời riêng tư, và không bao giờ lấy chính credential làm mảnh người đọc |
| `CACHE-3` | Một hành động được bấm trên từng dòng của một danh sách | Hành động trên từng item mang item đó trong key, mỗi item một hook. Không bao giờ dùng một key mutation duy nhất trải khắp danh sách, vì như thế `isMutating` bị chia chung cho mọi dòng |
| `CACHE-4` | Còn một mảnh chưa biết | Key là `null` cho tới khi mọi mảnh đã biết. Không bao giờ dựng key trong lúc một mảnh còn là `undefined`, và không bao giờ để một placeholder (`""`, `0`, `"guest"`) đứng thay cho mảnh còn thiếu |
| `CACHE-5` | Kết quả có thể là `null` | Thất bại vẫn nằm ở `error` của hook, và nghĩa của `null` được viết ngay tại chỗ bóc kết quả sinh ra nó. Không bao giờ có fetcher trả `null` khi thất bại, và không bao giờ để nghĩa của một `null` do phía gọi tự quyết |

`CACHE-1` LÀ TRƯỜNG HỢP TỔNG QUÁT, VÀ NHỮNG MÃ CÒN LẠI KHÔNG PHẢI TẬP CON CỦA NÓ. `CACHE-2` và
`CACHE-3` đặt tên cho hai mảnh bị bỏ sót nhiều hơn hẳn phần còn lại, và hỏng theo những kiểu mà
`CACHE-1` không mô tả được: người đọc hỏng khi đăng xuất, item hỏng ở trạng thái đang chạy của cả một
danh sách. Gộp chúng ngược vào `CACHE-1` thì đúng mà vô dụng — một tình huống không có tên riêng là
một tình huống không ai chỉ ra được là đã làm sai.

`CACHE-4` và `CACHE-5` quản hai đầu mà key không với tới: chuyện gì xảy ra trước khi câu hỏi tồn tại,
và câu trả lời được phép mang nghĩa gì khi nó đã về.

## Đọc một shape đã duyệt

1. Đọc những gì shape đã nói. Nó nói surface nào hiển thị dữ liệu gì, hành động nào nằm trên dòng nào,
   và phần nào trong dữ liệu ấy là riêng của người đọc. Những điều đó đã chốt; nhận lấy nguyên vẹn.
2. Đọc những gì shape không nói, và do đó không giải quyết. Shape không nói biểu thức key, không nói
   chữ ký fetcher, không nói cái cổng sinh ra một key `null`, cũng không nói nghĩa của một kết quả
   `null`. Đó là đầu ra của pattern này, không phải đầu vào của nó.
3. Giải từ ngoài vào trong. Đặt tên cho câu trả lời mà một entry giữ, dưới dạng một câu hỏi, trước khi
   đặt tên cho bất cứ mảnh nào; một mảnh chỉ có nghĩa khi soi vào câu trả lời nó làm đổi.
4. Hỏi lần lượt câu hỏi của từng mã, soi vào câu trả lời đó:
   - `CACHE-1` — nếu giá trị này khác đi, câu trả lời có khác đi không?
   - `CACHE-2` — hai người cùng đăng nhập, cùng gọi query này, có nhận về hai kết quả khác nhau không?
   - `CACHE-3` — trên màn hình có bao nhiêu cái nút đang tồn tại cùng lúc cho hành động này? Nhiều hơn
     một nghĩa là key phải phân biệt được chúng.
   - `CACHE-4` — trong lần render ĐẦU TIÊN, mảnh nào còn là `undefined`? Mảnh đó có nằm trong key
     không?
   - `CACHE-5` — khi thấy `null` ở chỗ bóc kết quả, người đọc màn hình nên thấy chữ gì? Nếu câu trả
     lời phụ thuộc vào việc request có tới nơi hay không, thì `null` đang gánh hai nghĩa.
5. Khi hai mã cùng khớp thì cả hai cùng áp dụng. Chúng không phải hai lựa chọn thay nhau. Một query
   riêng tư giải ra `CACHE-2` và `CACHE-4` đi cùng nhau, vì một mã nói mảnh người đọc phải có, mã kia
   nói làm gì trong lúc chưa biết người đọc là ai. Ghi mọi mã áp dụng vào khối đầu ra; một hook chỉ
   giải ra một mã trong khi có hai mã mô tả nó là một hook mới đọc được một nửa.

## `CACHE-1` — mọi giá trị làm đổi câu trả lời đều nằm trong key

**Tình huống.** Câu trả lời phụ thuộc vào một giá trị: một bộ lọc, một trang, một ngôn ngữ, một khoảng
thời gian. Cache không so sánh request, nó so sánh key. Hai lần gọi cùng một key là MỘT entry, và
người gọi thứ hai được phục vụ bằng câu trả lời của người thứ nhất, không có request nào đi ra cả.

**Nó sinh ra gì trong source.** Một biểu thức key liệt kê đủ mọi mảnh mà câu trả lời đổi theo, và
không có gì khác, cùng một fetcher có chữ ký destructure những mảnh ấy ra từ key rồi đưa CHÍNH CHÚNG
vào request — không bao giờ dùng cái tham số trùng tên đang nằm ở scope ngoài. Key và closure là hai
bản sao của một sự thật, và sau một lần re-render hai bản đó có thể lệch nhau; entry khi ấy được xếp
dưới tên của câu hỏi này nhưng giữ câu trả lời của câu hỏi kia.

**Dấu hiệu nhận biết.** Có một biến xuất hiện trong request nhưng không xuất hiện trong key. Fetcher
không nhận tham số nào từ key mà vẫn gọi được, nghĩa là nó đang đọc từ scope ngoài. Đổi bộ lọc trên
màn hình mà dữ liệu không đổi, hoặc đổi rồi lại nhảy về giá trị cũ. Ngược lại: key chứa một giá trị mà
server không hề dùng tới, và mỗi lần nó đổi lại thấy fetch lại. Cái hỏng ở đây không phải thỉnh thoảng
cho ra dữ liệu cũ — nó cho ra dữ liệu sai một cách tất định, và trông vẫn đúng, vì một câu trả lời hợp
lý cho câu hỏi sai thì không phân biệt được với câu trả lời đúng.

**Ranh giới.** Không phải `CACHE-2`: người đọc cũng là một mảnh, nhưng nó có mã riêng vì nó hỏng theo
một kiểu khác — hỏng khi đăng xuất, không phải khi đổi tham số. Không phải `CACHE-3`: id của item cũng
là một mảnh, nhưng với mutation nó còn quyết định trạng thái đang chạy chứ không chỉ dữ liệu. Không
phải `CACHE-4`: `CACHE-1` nói mảnh nào phải có; `CACHE-4` nói phải làm gì khi mảnh đó chưa có.

**Tình huống nghiệp vụ hay gặp.** Danh sách có bộ lọc và phân trang · tìm kiếm theo từ khoá · báo cáo
theo khoảng ngày · nội dung theo ngôn ngữ đang phục vụ · chi tiết một bản ghi theo id · bảng xếp hạng
theo phạm vi (tuần/tháng) · giỏ hàng theo mã khuyến mãi đang áp.

## `CACHE-2` — câu trả lời riêng tư phải mang người đọc trong key

**Tình huống.** Câu trả lời được tính ra từ chính người đang hỏi. Đó không phải dữ liệu chung tình cờ
nằm sau lớp đăng nhập; đó là mỗi người một câu trả lời khác nhau, và một key không nhắc tới người đọc
thì đang hứa điều ngược lại.

**Nó sinh ra gì trong source.** Một mảnh người đọc nằm trong key, sinh ra bởi một hook riêng biết gấp
phiên đăng nhập thành một fingerprint ổn định, không đảo ngược được, và trả `undefined` khi chưa ai
đăng nhập. Credential không bao giờ rời khỏi file đó. Key được đưa cho devtools, cho mọi công cụ soi
cache, và cho bất cứ chỗ nào log key lại khi một request thất bại; một bearer token nằm ở đó là đúng
cái sai lầm của một bearer token nằm trong web storage. Fingerprint KHÔNG phải một biên giới bảo mật
và không tự nhận là như vậy — nó chỉ cần khác đi khi người đọc khác đi.

**Dấu hiệu nhận biết.** Tên query có chữ "của tôi", "đang theo dõi", "đã mua", "còn lại", "dành cho
bạn". Server đọc danh tính từ header để tính ra kết quả, chứ không chỉ để cho phép truy cập. Đăng xuất
rồi mà màn hình vẫn còn số liệu cũ cho tới khi F5. Vừa đăng nhập xong mà vẫn thấy trạng thái "hãy đăng
nhập". Hai kiểu hỏng nối nhau, và kiểu thứ hai nặng hơn kiểu thứ nhất: đăng nhập vào không thay đổi gì
vì key không đổi, còn đăng xuất ra cũng không thay đổi gì, nên người tiếp theo trên cái tab ấy đọc
được số liệu của người trước — và những con số đó trông hoàn toàn hợp lý.

**Ranh giới.** Không phải `CACHE-1`: nằm sau auth không đồng nghĩa với riêng tư; thêm người đọc vào
một key dùng chung chỉ nhân bản một entry giống hệt nhau cho từng người. Không phải `CACHE-4`: khi
chưa biết người đọc là ai, `CACHE-2` nói phải có mảnh này, còn `CACHE-4` nói chưa có thì key là `null`.
Hai mã luôn đi cùng nhau ở các query riêng tư.

**Tình huống nghiệp vụ hay gặp.** Bảng điều khiển cá nhân · tiến độ học · giỏ hàng · thông báo · số dư
và hạn mức · giá đã áp ưu đãi theo hạng thành viên · danh sách đang theo dõi · quyền truy cập một nội
dung trả phí.

## `CACHE-3` — hành động trên từng dòng phải mang dòng đó trong key

**Tình huống.** Các hook dùng chung một key thì dùng chung TRẠNG THÁI, không chỉ dữ liệu. Với một
mutation, trạng thái đó bao gồm `isMutating` — đúng cái mà một nút bấm đọc để biết mình đang chạy. Nên
một key duy nhất trải khắp một danh sách sẽ tạo ra: bấm MỘT dòng, cả cột nút cùng quay spinner, và mọi
dòng khác bị disable vì một cú bấm mà người đọc không hề thực hiện.

**Nó sinh ra gì trong source.** Một key mutation mang id của item, trên một hook mà phía gọi khởi tạo
mỗi dòng một lần, để trạng thái đang chạy thuộc về đúng một dòng. Item chính là thứ làm cho cú bấm này
khác cú bấm ở dòng bên cạnh; thiếu nó trong key thì với cache, cả danh sách chỉ có đúng một cái nút.

**Dấu hiệu nhận biết.** Hook mutation được gọi trong một component render lặp lại theo `map`. Nút
"Thêm", "Xoá", "Theo dõi", "Thích" nằm trên từng dòng. Bấm một cái, cả lưới cùng hiện trạng thái đang
chạy.

**Ranh giới.** Không phải `CACHE-1`: `CACHE-1` nói về DỮ LIỆU trả về, còn `CACHE-3` nói về TRẠNG THÁI
ĐANG CHẠY dùng chung; một mutation có thể sai `CACHE-3` mà dữ liệu trả về vẫn đúng. Không phải ngoại
lệ hành động hàng loạt: xoá sạch giỏ, đánh dấu đã đọc tất cả — chủ thể thật sự LÀ cả danh sách, chỉ có
một cú bấm và một trạng thái chạy, nên key không mang item. Hành động trên từng dòng và hành động hàng
loạt là hai hành động khác nhau, không phải một hành động đánh key theo hai kiểu.

**Tình huống nghiệp vụ hay gặp.** Thêm vào giỏ trên từng thẻ · theo dõi/bỏ theo dõi trên từng hồ sơ ·
thả cảm xúc trên từng bài · xoá một dòng trong bảng · ghim/bỏ ghim · duyệt từng yêu cầu · gửi lại một
email trong danh sách.

## `CACHE-4` — chưa đủ mảnh thì key là `null`, không phải một key có lỗ

**Tình huống.** Mọi mảnh phải đã biết thì câu hỏi mới tồn tại. Trong lúc còn một mảnh là `undefined` —
người đọc trước khi phiên giải xong, một id thuộc về một placeholder đang nghỉ, một tham số của một
surface chưa ai mở — hook truyền `null` và không fetch gì cả.

**Nó sinh ra gì trong source.** Một cái cổng đặt trước biểu thức key, trả `null` khi còn bất kỳ mảnh
bắt buộc nào là `undefined`, và không có `??` hay `||` nào cấp hàng thay thế cho mảnh nào. Cái thay
thế còn tệ hơn một request lãng phí: một key dựng quanh một mảnh còn thiếu là đi hỏi một điều không ai
muốn biết, rồi cache câu trả lời dưới một cái tên mà không người gọi nào sau này sinh ra lại được. Một
query cần token mà bắn đi khi chưa có token thì không thất bại một lần: nó thất bại theo một vòng
retry có backoff, và mỗi lần lại tự báo là đang tải — đó chính là cách một màn hình đã đăng xuất cứ
nhấp nháy skeleton trước mặt một người không hề chờ đợi gì. Một placeholder là đúng cái lỗi đó khoác
lên mình một cái key hợp lệ: chuỗi rỗng, số không, hay chữ `guest` sinh ra một entry THẬT, giữ một câu
trả lời THẬT cho một câu hỏi người gọi không hỏi — và về sau chẳng có dấu hiệu nào để nhìn ra là nó
hỏng.

**Dấu hiệu nhận biết.** Trong key có `??`, `||`, hoặc một literal `""` / `0` / `"guest"` /
`"anonymous"`. Có một tham số kiểu `id?: string` nhưng key vẫn được dựng vô điều kiện. Màn hình đã
đăng xuất mà vẫn thấy skeleton chạy mãi. Devtools thấy cùng một request lặp lại theo chu kỳ giãn dần,
đều thất bại.

**Ranh giới.** Không phải `CACHE-1`: `CACHE-1` sai vì THIẾU một mảnh lẽ ra phải có, còn `CACHE-4` sai
vì BỊA ra một mảnh chưa tới. Không phải `CACHE-5`: `CACHE-4` nói về `null` ở vị trí KEY (chưa hỏi), còn
`CACHE-5` nói về `null` ở vị trí KẾT QUẢ (đã hỏi, và câu trả lời là không có gì). Hai chữ `null` này
không liên quan gì đến nhau, và lẫn chúng là hiểu nhầm hay gặp nhất của module này.

**Tình huống nghiệp vụ hay gặp.** Query cần đăng nhập trong lúc phiên đang khôi phục · chi tiết một
bản ghi khi id đến từ route param còn chưa parse · dữ liệu của một tab chưa được mở · nội dung trong
một modal chưa bật · hàng trong danh sách đang ở trạng thái skeleton.

## `CACHE-5` — thất bại và rỗng là hai câu trả lời khác nhau

**Tình huống.** "Request không tới nơi" và "thật sự không có gì" muốn hai câu chữ khác nhau trên màn
hình, và một fetcher gộp lỗi thành `null` đã phá huỷ sự khác biệt đó trước khi bất kỳ người gọi nào
kịp phân biệt.

**Nó sinh ra gì trong source.** Một fetcher không có `try`/`catch` nào nuốt thất bại — một thất bại
vẫn là `error` của hook, nơi người gọi có thể quyết định thử lại, nói ra, hoặc chủ động lùi về một
phương án khác. Nhờ vậy `null` được rảnh tay để mang đúng một nghĩa, và hook là chỗ ghi nghĩa đó
xuống, ngay cạnh đoạn bóc kết quả sinh ra nó: một bản xem trước giá trả `null` khi không tính được mức
giá riêng cho người này, nên màn hình lấy giá niêm yết mà hiển thị — đó là câu trả lời trung thực,
không phải một lỗi bị nuốt. Người gọi không suy ra được điều đó từ kiểu dữ liệu, và không được phép
phải đoán.

**Dấu hiệu nhận biết.** Trong fetcher có `try { … } catch { return null }`. Kiểu trả về là `T | null`
mà không có một dòng nào nói `null` nghĩa là gì. Màn hình hiện "chưa có dữ liệu" trong khi mạng đang
hỏng. Mỗi component tự diễn giải `null` theo một cách, và chúng không giống nhau.

**Ranh giới.** Không phải `CACHE-4`: như đã nói ở trên, `null` của key và `null` của kết quả là hai
thứ. Không phải ngoại lệ `null` là thất bại theo hợp đồng: fetcher vẫn được trả `null` cho một dạng
thất bại mà người gọi PHẢI xử lý như rỗng — nhưng chỉ khi chính server phân biệt được hai thứ đó và
hook ghi sự phân biệt ấy xuống tại chỗ bóc. Một `catch` không có kiểu không bao giờ là trường hợp này.

**Tình huống nghiệp vụ hay gặp.** Xem trước giá riêng · trạng thái ưu đãi đang áp dụng · hồ sơ mở rộng
có thể chưa tạo · phiên gần nhất có thể chưa từng có · bản nháp chưa lưu · số liệu của một kỳ chưa
chốt.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là một union đóng hay một branded type làm cho
giá trị sai không viết ra được; `enforced` nghĩa là có một lint rule bắt được và rule đó có tên;
`documented` nghĩa là không có gì cơ học giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Người giữ |
|---|---|---|
| `CACHE-1` | `documented` | không có — không rule nào nhìn được bên trong một key có gì |
| `CACHE-2` | `documented` | không có — không rule nào nhìn được bên trong một key có gì |
| `CACHE-3` | `documented` | không có — không rule nào nhìn được bên trong một key có gì |
| `CACHE-4` | `documented` | không có — không rule nào nhìn được bên trong một key có gì |
| `CACHE-5` | `documented` | không có — không rule nào nhìn được bên trong một key có gì |

Không có `starci-eslint/packages/fe/cache-key.mjs`. Module này công bố **không** rule nào, nên cả năm mã đều do
review và do chính file này giữ. Đó không phải một chỗ khuyết đang chờ lấp: một ESLint rule nhìn thấy
BIỂU THỨC key, còn thứ làm cho một key đúng lại là chuyện các giá trị trong đó có phải là những giá
trị mà câu trả lời đổi theo hay không — một sự thật về server, không phải về cú pháp. Rule nhìn được
rằng key là một mảng ba định danh. Nó không nhìn được rằng cái thứ ba lẽ ra phải là cái thứ tư.

Hàng xóm cơ học gần nhất là `starci-eslint/packages/fe/the-split.mjs`, với rule `presentational-purity` giữ mọi lời
gọi `useSWR` nằm ở nửa connected. Cái đó giữ CHỖ dựng key — trong file có sẵn người đọc và tham số
route để dựng — và hoàn toàn không giữ gì về chuyện cái gì được bỏ vào trong. Đó là chuyện kề cận,
không phải chuyện cưỡng chế, và nó không được tính vào bảng trên.

## Điểm neo

Code thật để đối chiếu từng mã. Đường dẫn tính từ gốc repository ứng dụng front-end.

| Mã | Đường dẫn | Nhìn vào đâu |
|---|---|---|
| `CACHE-1` | `src/hooks/swr/useQueryCoursePricePreviewSwr.ts` | Chữ ký fetcher `async ([, , id]: [string, string, string])` — nó destructure id ra từ key rồi đưa CHÍNH cái đó vào request, trong khi tham số trùng tên vẫn nằm trong scope mà không ai dùng |
| `CACHE-2` | `src/hooks/auth/useViewerKey.ts` | `fingerprint()` gấp session token thành một chuỗi base-36 ngắn, và hook trả `undefined` khi chưa ai đăng nhập. Bản thân token không bao giờ rời khỏi file này |
| `CACHE-3` | `src/hooks/swr/useMutateAddToCartSwr.ts` | Key `[MUTATE_ADD_TO_CART_SWR_KEY, courseId]` trên một `useSWRMutation` mà phía gọi khởi tạo mỗi dòng một lần, nên `isMutating` thuộc về đúng một dòng |
| `CACHE-4` | `src/hooks/swr/useQueryCoursePricePreviewSwr.ts` | Cái cổng `viewer === undefined \|\| courseId === undefined ? null : [...]` — hai mảnh, cả hai đều bắt buộc, và không có `??` nào cấp hàng thay thế cho mảnh nào |
| `CACHE-5` | `src/hooks/swr/useQueryCoursePricePreviewSwr.ts` | Fetcher không có `try`/`catch`; chỗ `?? null` duy nhất nằm ở đoạn bóc một response đã có, và doc comment nói rõ `null` đó nghĩa là gì |

Mọi mã đều đã neo được. Không mã nào ghi `chưa neo được`.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| answer | Một entry dưới key này giữ cái gì, phát biểu thành một câu hỏi |
| fragments | Mọi giá trị câu trả lời đổi theo, kèm lý do vì sao nó làm đổi |
| viewer | Câu trả lời có được tính ra từ người đang hỏi hay không |
| cardinality | Một hook đặt tên cho một item hay cho cả một danh sách |
| readiness | Mảnh nào còn có thể là `undefined`, và khi nào chúng giải xong |
| null meaning | Một `null` trong kết quả đã bóc khẳng định điều gì, nếu kết quả có thể là `null` |

## Quy tắc

1. Key chứa mọi giá trị câu trả lời đổi theo, và không chứa gì khác.
2. Fetcher lấy tham số ra từ key, không bao giờ lấy từ scope ngoài.
3. Câu trả lời riêng tư nêu tên người đọc; câu trả lời chung thì không.
4. Mảnh người đọc là fingerprint, không bao giờ là credential.
5. Hành động trên từng item nêu tên item đó, và một hook phục vụ một item.
6. Key chưa đủ mảnh là `null`. Không có mảnh thay thế.
7. Thất bại tới tay người gọi qua `error` của hook, không bao giờ qua dữ liệu.
8. Nghĩa của một `null` được ghi ngay tại chỗ sinh ra nó.
9. Mỗi hook đặt tên cho một câu trả lời được cache đều giải ra ít nhất một mã. Không hook nào nằm
   ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó
áp dụng vào.

- **Câu trả lời thật sự dùng chung.** `CACHE-2` không áp dụng cho câu trả lời giống hệt nhau với mọi
  người đọc. Một catalog công khai nằm trong route đã đăng nhập vẫn là dữ liệu chung; nằm sau lớp đăng
  nhập là một dữ kiện khác với được tính ra từ người đọc.
- **Token làm mới thì fetch lại.** Ở `CACHE-2`, token được gia hạn làm fingerprint đổi và tốn một lần
  fetch lại. Chấp nhận có chủ đích: phương án còn lại là giải mã credential để lấy claim định danh,
  tức là đẩy một hook cache vào việc phân tích credential.
- **Key chỉ có prefix, không có mảnh nào.** Ở `CACHE-1`, một key hằng là đúng khi câu trả lời thật sự
  là một câu trả lời cho tất cả mọi người, mãi mãi — một tài liệu cấu hình tĩnh, một changelog công
  khai. Nó hết đúng ngay khi câu trả lời bắt đầu đổi theo bất cứ thứ gì.
- **Hành động hàng loạt.** Ở `CACHE-3`, hành động mà chủ thể thật sự LÀ cả danh sách — xoá sạch giỏ,
  đánh dấu đã đọc tất cả — thì key không mang item, vì chỉ có một cú bấm và một trạng thái chạy. Hành
  động trên từng dòng và hành động hàng loạt là hai hành động khác nhau, không phải một hành động đánh
  key theo hai kiểu.
- **`null` là thất bại theo hợp đồng.** Ở `CACHE-5`, fetcher vẫn được trả `null` cho một dạng thất bại
  mà người gọi phải xử lý như rỗng — nhưng chỉ khi chính server phân biệt được hai thứ đó và hook ghi
  sự phân biệt ấy xuống tại chỗ bóc kết quả. Một `catch` không có kiểu không bao giờ là trường hợp
  này.

## Đầu ra

Mỗi file hook mà shape đã duyệt sinh ra là một khối.

```text
answer: <the question one entry names>
fragments: <every value the answer varies by>
codes: <CACHE-1 | CACHE-2 | CACHE-3 | CACHE-4 | CACHE-5, all that apply>
key: <the key expression, or null and its gate>
null means: <what a null result asserts, or "result is never null">
reason: <the business fact that puts each fragment in, and keeps the others out>
```

## Ví dụ đã giải

Shape đã duyệt: màn hình chi tiết một khoá học hiển thị mức giá riêng của người đang đăng nhập cho
khoá học đó, và mỗi thẻ trong danh sách khoá học liên quan mang một nút thêm vào giỏ của riêng nó.

Shape đó sinh ra hai file hook.

```text
answer: what does this course cost for this particular reader?
fragments: viewer fingerprint, courseId
codes: CACHE-1, CACHE-2, CACHE-4, CACHE-5
key: viewer === undefined || courseId === undefined ? null : [QUERY_COURSE_PRICE_PREVIEW_SWR_KEY, viewer, courseId]
null means: no personal price could be computed for this reader, so the list price stands; a failed request is the hook's error, not a null
reason: giá được tính ra từ người đang hỏi nên người đọc nằm trong key — đây là CACHE-2 chứ không phải CACHE-1 thuần, vì dữ kiện làm nó hỏng là một cú đăng xuất chứ không phải một lần đổi tham số; fingerprint nằm trong key còn credential thì không bao giờ; ngôn ngữ bị loại khỏi key vì server trả về cùng một con số ở mọi ngôn ngữ; cả hai mảnh đều khởi đầu là undefined nên cái cổng giữ key ở null thay vì thay bằng "guest"
```

```text
answer: is this one course being added to the cart right now, and did it succeed?
fragments: courseId
codes: CACHE-1, CACHE-3
key: [MUTATE_ADD_TO_CART_SWR_KEY, courseId]
null means: result is never null
reason: mỗi thẻ khởi tạo một hook nên isMutating chỉ thuộc về đúng thẻ đó — đây là CACHE-3 chứ không phải ngoại lệ hành động hàng loạt, vì chủ thể của cú bấm là một khoá học chứ không phải cả danh sách; người đọc bị loại khỏi key vì trạng thái đang chạy của một cái nút không được tính ra từ ai đang hỏi, và chính dữ kiện đó loại CACHE-2
```

Những gì shape không nói, và do đó không giải quyết: nó không nói bản xem trước giá có được fetch trên
từng thẻ hay chỉ trên màn hình chi tiết, không nói màn hình hiển thị gì trong lúc phiên đang khôi
phục, và không nói một khoá học liên quan đã nằm trong giỏ thì còn hiện nút hay không. Đó là những câu
hỏi còn mở của shape, không phải những câu trả lời pattern này được phép bịa ra.

## Phạm vi

Quy tắc này đúng cho mọi code cùng loại trong stack này: bất kỳ front end nào cache theo key. Nó không
gọi tên một tính năng nào, một sản phẩm nào, một thư viện component nào, một registry key nào hay một
repository nào — mọi tình huống ở trên đều là một hook bình thường trên TSX bình thường. Bảng `Điểm
neo` là ngoại lệ có chủ đích duy nhất: nó chỉ ra ngoài, tới những đường dẫn tương đối trong repo, vì
một luật không chỉ được vào code thật thì chỉ là một đề xuất chứ chưa phải một luật.
