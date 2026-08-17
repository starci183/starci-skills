---
title: Loading · Vietnamese
module: loading
kind: pattern
codes: [LOADING-1, LOADING-2, LOADING-3, LOADING-4, LOADING-5, LOADING-6, LOADING-7]
---

# Trạng thái chờ

Đầu vào là một shape đã được duyệt — một layout, một block, một capability hoặc một contract đã có
người chốt. Pattern này không mở lại quyết định đó. Đầu ra của nó là kiến trúc source: file nào vẽ lúc
chờ, tầng nào sở hữu tình huống và tầng nào sở hữu dáng nghỉ, file đó export gì, nhận được gì, và bị
cấm nhận sẵn cái gì từ bên ngoài. Shape nói surface trông thế nào khi dữ liệu đã về; pattern này chốt
source phải trông thế nào trong đúng một giây trước đó.

## Luật

Một surface đang chờ dữ liệu phải vẽ **đúng cái hình mà nó sẽ vẽ khi dữ liệu về**, chỉ bỏ các giá trị
ra. Không phải một cây khác, không phải một chồng thanh xám trông na ná — mà cùng những component đó,
cùng cách sắp xếp đó, ở trạng thái nghỉ.

Lý do là **drift**, và nó không phải chuyện giả định. Một cây thứ hai mô tả cây thứ nhất là một bản mô
tả không ai cập nhật: nó đúng vào ngày được viết, và sai ngay lần đầu hình thật đổi. Không có gì đỏ
lên cả, vì một hình đang nghỉ thì không có assertion nào để fail — nó chỉ đơn giản là sai trên màn
hình, và chỉ sai trong đúng một giây có người tình cờ nhìn vào.

Câu hỏi chốt hạ: **ngày mai component này đổi hình, thì bản đang chờ có đổi theo không?** Nếu không —
đó là một bản mô tả thứ hai, và nó sẽ drift.

**Đây là luật bắt buộc, không phải lời khuyên.** Bất cứ thứ gì render ra trước khi dữ liệu của nó về
đều rơi vào một trong bảy tình huống dưới đây. Không có surface nào nhỏ đến mức được miễn: một dòng
chữ đơn lẻ là `LOADING-2`, đúng cùng một lý do mà cả một cột dashboard là `LOADING-6`. Câu "có mỗi cái
spinner thôi mà" không phải một ngoại lệ — đó là chỗ luật này bị bỏ qua nhiều nhất.

Chỗ hai nửa gặp nhau là mối nối bị làm sai nhiều nhất, nên nó được viết ra chứ không để suy đoán.
Block và leaf diễn đạt việc chờ theo hai cách khác nhau, và bản dịch giữa chúng chỉ dài một dòng:

| Tầng | Việc chờ được diễn đạt thế nào |
|---|---|
| block | `pending` là một thành viên của state union — một tình huống thật, đứng cạnh `ready`, `empty`, `failed` |
| leaf, composite | `isLoading` — một cờ được nhận, không bao giờ được quyết |
| mối nối | `const isLoading = input.state === "pending"` ở nửa thuần trình bày |

Block sở hữu TÌNH HUỐNG, vì chỉ nó biết câu trả lời đã về hay chưa. Leaf sở hữu DÁNG NGHỈ, vì chỉ nó
biết giải phẫu của chính nó. Không bên nào làm được nửa của bên kia, và một dòng ở giữa là chỗ chúng
gặp nhau.

## Mã tình huống

Mỗi tình huống module này cai quản đều mang một mã, `LOADING-<n>`. Mã gọi tên TÌNH HUỐNG; cột yêu cầu
nói source của một surface trong tình huống đó phải trông thế nào.

| Mã | Tình huống | Source phải trông thế nào |
|---|---|---|
| `LOADING-1` | Có người dựng thêm một component thứ hai để vẽ lúc chờ | Chính component vẽ dữ liệu là component vẽ lúc chờ. Không twin chỉ để nhại lại hình của file khác; không prop đưa sẵn hình nghỉ từ ngoài vào |
| `LOADING-2` | Phần tử lúc chờ là một phần tử khác với phần tử thật | Vẫn đúng thẻ đó, đúng cách xếp đó, đúng measure đó — giá trị bị rút ra, thay bằng một mặt nghỉ. Không ternary ở call site chọn giữa hai component KHÁC NHAU |
| `LOADING-3` | Cả một vùng co lại trong lúc chờ | Vùng nghỉ đứng cao bằng vùng thật; số dòng lặp là một quyết định được khai báo. Không có vùng nào vẽ rỗng khi chờ |
| `LOADING-4` | Markup đang nghỉ vẫn nằm trong cây trợ năng | Phần tử đang nghỉ được giấu khỏi trợ năng. Không đọc shimmer, không đọc một giá trị đã bị rút ruột như thể nó là nội dung |
| `LOADING-5` | Control được vẽ trước khi có đích | Control chỉ xuất hiện khi đã có nơi để đi. Không vẽ đích bấm lên trên một đích chưa tồn tại |
| `LOADING-6` | Nhiều vùng độc lập chờ chung một cờ | Mỗi vùng tự giải quyết request của mình và về lúc nào thì hiện lúc đó. Không dùng chung một cờ chờ cho nhiều request độc lập |
| `LOADING-7` | Việc chờ bị mô hình hoá thành sự vắng mặt của dữ liệu | `pending` là một thành viên của state union và mang theo phần khung. Không coi việc chờ là `undefined`, `null` hay "chưa có dữ liệu" |

Đánh số chạy từ `1` đến `7`, không lỗ hổng, không nấc để dành. Khác với một thang đo, đây không phải
những mức độ của cùng một thứ: `LOADING-3` không phải là `LOADING-2` nhưng nhiều hơn. Đó là bảy cách
khác nhau mà cùng một surface có thể nói dối về điều nó biết, và một surface có thể rơi vào nhiều
tình huống cùng lúc.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói cái cây khi câu trả lời đã về: thẻ nào, xếp ra sao, measure nào,
   control nào, vùng nào lặp.
2. **Gọi tên phần shape không nói, và do đó không giải quyết.** Một shape đã duyệt không nói request
   nào nuôi vùng nào, một vùng lặp nghỉ bằng mấy dòng, đích của một control đã tồn tại hay chưa, hay
   `pending` có nằm trong state union hay không. Những thứ đó được giải ở đây, không phải ở đó — và
   chỗ shape im lặng thì ghi lại sự im lặng ấy, không đoán bừa vào.
3. **Giải từ ngoài vào trong.** Bắt đầu ở vùng sở hữu một request (`LOADING-6`, `LOADING-7`), rồi đến
   chiều cao và số dòng lặp của vùng (`LOADING-3`), rồi đến phần tử bên trong (`LOADING-1`,
   `LOADING-2`), rồi đến trợ năng (`LOADING-4`) và các control của nó (`LOADING-5`). Một phần tử bên
   trong nghỉ đúng luật mà nằm trong một vùng co về 0 thì vẫn sai.
4. **Hỏi lần lượt câu hỏi của từng mã.** Ai vẽ lúc chờ? Có đúng là cùng một phần tử không? Vùng có giữ
   chiều cao không, và số dòng có được khai báo không? Markup nghỉ có im lặng không? Control đã có đích
   chưa? Mỗi request có cờ riêng chưa? `pending` đã nằm trong union chưa, và nó có mang theo phần khung
   không?
5. **Khi hai mã cùng khớp thì ghi cả hai.** Một surface có thể rơi vào nhiều tình huống cùng lúc, và
   đây không phải những mức độ của một thứ. Ghi mọi mã khớp, mỗi mã một khối đầu ra riêng; đừng gộp
   chúng vào cái mã trông có vẻ lớn nhất.

## `LOADING-1` — một hình, hai trạng thái; không bao giờ hai cây

**Tình huống.** Dữ liệu chưa về, và có người muốn dựng thêm một component thứ hai để vẽ lúc chờ: một
file `…Skeleton`, hoặc một prop nhận sẵn markup nghỉ từ bên ngoài đưa vào. Component thật thì vẫn nằm
đó, không biết gì.

**Nó sinh ra gì trong source.** Một file duy nhất. Chính component vẽ dữ liệu nhận việc chờ như một
trạng thái của bản thân nó và nghỉ dưới dạng chính nó. Không có file anh em nào chỉ để nhại lại nó, và
không có prop tên `skeleton`, `placeholder` hay `fallback` nhận vào một element.

**Dấu hiệu nhận biết.** Có một file mà nhiệm vụ duy nhất là nhại lại hình của một file khác. Có prop
tên `skeleton`, `placeholder` hoặc `fallback` nhận vào một element. Sửa component thật xong, phải nhớ
sang sửa thêm một chỗ nữa — và không có gì nhắc. Tự hỏi: nếu ngày mai component này thêm một dòng, bản
đang chờ có tự có dòng đó không?

**Ranh giới.** Không phải `LOADING-2`: `LOADING-1` là việc TỒN TẠI một cây thứ hai — một file, một
prop. `LOADING-2` là cây thứ hai được viết NGAY TẠI CALL SITE bằng một ternary. Cùng một sai lầm, khác
vị trí. Không phải `LOADING-7`: `LOADING-1` nói AI VẼ; `LOADING-7` nói TÌNH HUỐNG ĐÃ CÓ TÊN CHƯA. Một
block có `pending` trong union vẫn có thể vi phạm `LOADING-1` nếu nhánh `pending` render một twin. Và
một primitive nghỉ dùng chung — thứ mà component nghỉ BẰNG nó — không phải twin: nó không mô tả hình
của ai cả, nên không thể drift khỏi hình nào.

**Tình huống nghiệp vụ hay gặp.** Card khoá học · row hoá đơn · ô thống kê trên dashboard · dòng thông
báo · thẻ hồ sơ · bảng xếp hạng · card sản phẩm trong giỏ.

## `LOADING-2` — vẫn là phần tử đó, chỉ rút ruột ra

**Tình huống.** Component đúng là một, nhưng lúc chờ nó bị thay bằng một element khác — thường bởi một
ternary ở call site: `isLoading ? <A/> : <B/>` với `A` và `B` là hai thứ khác nhau.

**Nó sinh ra gì trong source.** Một element duy nhất trên cả hai đường. Class set và việc thay ký tự
có thể đổi; thẻ và cách sắp xếp thì không. Measure nằm trong component, không được viết lại bằng tay ở
call site.

**Dấu hiệu nhận biết.** Hai nhánh của ternary có tên element khác nhau. Kích thước, khoảng cách hoặc
đường bo của bản nghỉ được viết lại bằng tay ở call site. Lúc dữ liệu về, chữ nhảy sang chỗ khác một
chút — vì hai element không cùng measure. Tự hỏi: hai nhánh có phải cùng một element không? Nếu không,
cái nào đang nói dối về measure?

**Ranh giới.** Không phải `LOADING-1`: xem trên — đó là cây thứ hai tồn tại dưới dạng một file hoặc
một prop, còn cái này được viết ngay tại chỗ. Không phải `LOADING-3`: `LOADING-2` là MỘT PHẦN TỬ bảo
toàn hình; `LOADING-3` là CẢ VÙNG bảo toàn chiều cao. Một dòng chữ nghỉ đúng luật vẫn có thể nằm trong
một section co lại còn 0 pixel. Không phải `LOADING-5`: ternary có một nhánh là `null` không thuộc mã
này — đó là `LOADING-5`, và nó đúng.

**Tình huống nghiệp vụ hay gặp.** Tên hiển thị · số dư · nhãn hạng · tiêu đề khoá học · avatar · badge
trạng thái · số liệu trong ô thống kê · caption dưới ảnh.

## `LOADING-3` — vùng nghỉ bảo toàn chiều cao của section

**Tình huống.** Vùng đang chờ không vẽ gì cả, nên nó co lại; đến khi câu trả lời về thì cả cột bên
dưới nhảy xuống. Người đọc đang đọc dở một thứ và mất chỗ.

**Nó sinh ra gì trong source.** Một vùng nghỉ đứng cao bằng vùng thật, và một số dòng lặp là quyết
định được khai báo — một hằng số có tên cho số dòng nghỉ thế chỗ cho các dòng thật, chứ không phải một
con số nằm rải rác trong JSX và cũng không phải chuyện tình cờ. Trong child-spec union, `repeats: true`
không thể viết ra mà thiếu `restingCount: number`, và `repeats: false` thì không được mang theo nó.

**Dấu hiệu nhận biết.** Có `isLoading ? null : …` ở cấp VÙNG, không phải cấp control. Danh sách lúc
chờ vẽ 0 dòng, lúc về vẽ 6 dòng. Không ở đâu khai báo "vùng này nghỉ bằng mấy dòng" — con số nằm rải
rác trong JSX hoặc không có. Tự hỏi: nếu bây giờ dữ liệu về, có gì trên màn hình dịch chuyển không? Và
số dòng lúc nghỉ là một QUYẾT ĐỊNH CÓ TÊN, hay là hệ quả tình cờ?

**Ranh giới.** Không phải `LOADING-2`: xem trên. Không phải `LOADING-5`: bỏ một CONTROL vì chưa có đích
là đúng luật; bỏ cả một VÙNG vì chưa có dữ liệu là sai luật. Khác nhau ở chỗ control mất đi không làm
ai mất chỗ đọc, còn vùng mất đi thì có. Không phải `LOADING-6`: `LOADING-3` là chiều cao của MỘT vùng;
`LOADING-6` là NHIỀU vùng chờ lẫn nhau.

**Tình huống nghiệp vụ hay gặp.** Danh sách bài học · feed hoạt động · bảng giao dịch · lưới khoá học ·
danh sách mục tiêu tuần · kết quả tìm kiếm · dòng bình luận.

## `LOADING-4` — phần đang nghỉ được giấu khỏi trợ năng

**Tình huống.** Một shimmer, hoặc một giá trị đã bị rút ruột, vẫn nằm trong cây trợ năng. Screen reader
đọc ra tiếng ồn, hoặc đọc ra một chuỗi rỗng, đúng vào lúc người dùng đang chờ được nêu cho biết một
điều gì đó.

**Nó sinh ra gì trong source.** `aria-hidden` có mặt trên phần tử nghỉ đúng bằng khoảng thời gian nó
nghỉ, và biến mất ngay khi nó mang nội dung. Không có `aria-label` gắn lên từng ô để mô tả chính cái
shimmer.

**Dấu hiệu nhận biết.** Element nghỉ không có `aria-hidden`. Có `aria-label` mô tả chính cái shimmer
("đang tải…") gắn lên từng ô một. Bật screen reader lên nghe thấy một chuỗi khoảng trắng, hoặc nghe
thấy cùng một câu lặp mười lần. Tự hỏi: ở giây này, có NỘI DUNG nào để đọc không? Nếu không có, tại sao
nó còn nằm trong cây trợ năng?

**Ranh giới.** Không phải `LOADING-2`: `LOADING-2` lo phần NHÌN THẤY bảo toàn hình; `LOADING-4` lo phần
NGHE THẤY im lặng. Một element có thể đúng `LOADING-2` mà vẫn sai `LOADING-4`. Không phải `LOADING-7`:
thông báo MỘT lần ở cấp vùng rằng "đang tải" là chuyện của khung — của `LOADING-7`, nơi `pending` mang
theo tên vùng. Thông báo ở TỪNG Ô NGHỈ là tiếng ồn.

**Tình huống nghiệp vụ hay gặp.** Avatar nghỉ · dòng tiêu đề nghỉ · icon nghỉ · ô số liệu nghỉ · chú
giải biểu đồ nghỉ · lưới đóng góp nghỉ.

## `LOADING-5` — chưa có nơi để đi thì chưa vẽ control

**Tình huống.** Một card đang nghỉ vẫn vẽ ra cái nút của nó, hoặc vẽ một link ở dạng shimmer. Người
đọc bấm vào, và không có gì xảy ra — hoặc tệ hơn, có một cái gì đó sai xảy ra.

**Nó sinh ra gì trong source.** Slot chứa lối ra bị bỏ hẳn khỏi record trong lúc item chưa được giải —
không render `disabled`, cũng không render dạng nghỉ. Một ternary có nhánh `null` chính là hình đúng ở
đây.

**Dấu hiệu nhận biết.** Có control mà `href`, `id` đích hoặc handler của nó đang là `undefined`.
Control được vẽ ở dạng `disabled` "cho đỡ trống". Nhãn của control chưa được dịch xong nhưng khung nút
đã có mặt. Tự hỏi: nếu người đọc bấm vào cái này NGAY BÂY GIỜ, họ học được điều gì? Nếu câu trả lời là
"rằng surface này không đáng tin" — thì đừng vẽ nó.

**Ranh giới.** Không phải `LOADING-3`: xem trên — bỏ control thì không ai mất chỗ đọc, bỏ vùng thì có.
Không phải `LOADING-2`: đây là ngoại lệ ĐÓNG của `LOADING-2` — một ternary có nhánh `null` không phải
cây thứ hai. Và là VẮNG MẶT, không phải `disabled`: một nút xám vẫn là một lời hứa; nó nói "sắp bấm
được", trong khi sự thật là "chưa biết có đích hay không".

**Tình huống nghiệp vụ hay gặp.** Nút "Học tiếp" trên card khoá học · link "Xem thêm" · nút tải hoá
đơn · nút chia sẻ hồ sơ · nút mở phòng thi · nút thanh toán khi chưa có giỏ.

## `LOADING-6` — mỗi vùng tự sở hữu việc chờ của mình

**Tình huống.** Một cờ `isLoading` duy nhất được kéo qua bốn vùng độc lập. Vùng nào cũng phải đợi vùng
chậm nhất, và bốn tình huống thật bị gộp thành một.

**Nó sinh ra gì trong source.** Một cờ chờ cho một request. Mỗi vùng tự giải quyết request của mình và
về lúc nào thì hiện lúc đó, và mỗi block được assert ở trạng thái nghỉ đối chiếu với request chưa giải
của CHÍNH NÓ, mỗi lần một cái.

**Dấu hiệu nhận biết.** `const isLoading = a.isLoading || b.isLoading || c.isLoading`. Một
`Promise.all` gom nhiều request không liên quan chỉ để có một trạng thái. Cả trang trắng ba giây rồi
hiện ra một lượt, thay vì lấp dần trong một giây. Tự hỏi: hai vùng này có CÙNG MỘT CÂU TRẢ LỜI không?
Nếu không, tại sao chúng dùng chung một cờ?

**Ranh giới.** Không phải `LOADING-3`: xem trên. Không phải `LOADING-7`: `LOADING-7` nói MỘT vùng phải
có tình huống `pending` có tên; `LOADING-6` nói MỖI vùng phải có tình huống của RIÊNG nó. Một trang có
thể đúng `LOADING-7` ở mọi block mà vẫn sai `LOADING-6` nếu chúng cùng nhận một cờ từ trên xuống. Và
cùng một request thì không phải nhiều vùng: hai phần đọc từ cùng một câu trả lời thì chờ cùng nhau là
đúng — chúng chỉ có một câu trả lời để chờ.

**Tình huống nghiệp vụ hay gặp.** Dashboard nhiều thẻ · trang hồ sơ có tiến độ và hoạt động · trang
khoá học có nội dung và đánh giá · trang thanh toán có giỏ và địa chỉ · sidebar điều hướng cạnh nội
dung.

## `LOADING-7` — chờ là một tình huống thật, không phải sự vắng mặt của tình huống

**Tình huống.** Component coi việc chờ là "chưa có dữ liệu": `data === undefined` thì trả về `null`,
hoặc trả về đúng cái giao diện của "không có gì". Từ đó nó không phân biệt được CHƯA VỀ với KHÔNG CÓ,
mà hai thứ đó cần hai câu chữ khác nhau.

**Nó sinh ra gì trong source.** `pending` đứng trong state union bên cạnh `ready`, `empty` và `failed`,
mang theo phần khung chứ không mang theo con số không: nhãn của vùng, heading của nó — những thứ đã
biết trước khi request được gửi đi. Chỉ phần nội dung là chưa biết.

**Dấu hiệu nhận biết.** Union chỉ có `ready`, `empty`, `failed` — thiếu `pending`. Nhánh chờ trả về
`null`, hoặc trả về đúng empty state. Nhánh chờ không có `props`, nên tên của vùng biến mất trong lúc
nội dung đang trên đường về. Tự hỏi: người đọc nhìn vào surface này lúc chờ, họ có còn biết HỌ ĐANG Ở
VÙNG NÀO không?

**Ranh giới.** Không phải `LOADING-1`: xem trên — có `pending` trong union chưa cứu được gì nếu nhánh
đó vẽ một twin. Không phải `LOADING-3`: `LOADING-7` là CÓ TÊN TÌNH HUỐNG; `LOADING-3` là CÓ KÍCH
THƯỚC. Thiếu tên thì không viết nổi nhánh nghỉ; có tên rồi vẫn có thể viết nhánh nghỉ rỗng.

**Tình huống nghiệp vụ hay gặp.** Section "Học tiếp" · thẻ tín chỉ AI · lịch sử giao dịch · danh sách
thử thách tuần · feed cộng đồng · kết quả tìm kiếm · giỏ hàng.

## Tầng giữ

Tầng nào thực sự giữ từng mã. `unrepresentable` nghĩa là một union đóng hoặc một branded type làm cho
giá trị sai không viết ra được; `enforced` nghĩa là một lint rule trong `sources/fe/loading.mjs` báo
nó; `documented` nghĩa là không có gì cơ học giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `LOADING-1` | `enforced` | `no-resting-twin-component` và `no-placeholder-prop` |
| `LOADING-2` | `enforced` | `no-resting-branch-at-call-site` |
| `LOADING-3` | `unrepresentable` | Child-spec union: `repeats: true` không thể viết ra mà thiếu `restingCount: number`, và `repeats: false` thì không được mang theo nó |
| `LOADING-4` | `documented` | Không có gì. Thiếu `aria-hidden` trên một phần tử nghỉ vẫn compile, vẫn qua lint, vẫn render |
| `LOADING-5` | `documented` | Không có gì. Rule về nhánh MIỄN cho nhánh `null` chứ không đòi phải có nó — miễn trừ không phải cưỡng chế |
| `LOADING-6` | `documented` | Không có gì. Một cờ kéo qua bốn vùng là code bình thường, kiểu hoàn toàn đúng |
| `LOADING-7` | `documented` | Không có gì. Một union hoàn toàn hợp lệ khi thiếu `pending`; hệ kiểu không thể biết là đang thiếu một thành viên |

Bốn mã chỉ dựa vào người đọc. Đó chính là lý do phải nêu tầng chứ không chỉ nêu luật: một luật không
ghi tầng sẽ bị đọc như thể đã có cưỡng chế, và người đầu tiên tin vào cách đọc đó sẽ ship đúng cái lỗi
mà luật được viết ra để chặn.

Tầng của `LOADING-3` giữ phần KHAI BÁO, không giữ phần render. Một vùng lặp không thể khai báo mà không
nói nó nghỉ bằng mấy dòng; nhưng không có gì ép những dòng đó lên màn hình.

## Điểm neo

Code thật để đối chiếu từng luật. Một luật không chỉ được vào code thật thì là đề xuất, không phải
luật. Đường dẫn tính từ cây component của front end.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `LOADING-1` | `src/components/leaves/Text/index.tsx` | Leaf nhận `isLoading` và nghỉ dưới dạng chính nó. Không có file thứ hai nằm cạnh mô tả lại cùng một dòng đó |
| `LOADING-2` | `src/components/leaves/Text/index.tsx` (~133–160) | Một element trên cả hai đường: class set và việc thay ký tự thì đổi, thẻ và cách sắp xếp thì không |
| `LOADING-3` | `src/components/contracts/index.ts` (~146–147) và `src/components/blocks/dashboard/WeeklyGoals/component.tsx` (~60, ~109) | Union ghép `repeats` với `restingCount`; và một hằng số có tên cho số dòng nghỉ thế chỗ cho các dòng thật |
| `LOADING-4` | `src/components/leaves/Avatar/index.tsx` (~67) | `aria-hidden` chỉ có mặt trong lúc leaf nghỉ, và biến mất khi nó mang một cái tên |
| `LOADING-5` | `src/components/blocks/dashboard/ContinueLearning/component.tsx` (~145–147) | Slot chứa lối ra bị bỏ hẳn khỏi record trong lúc item chưa được giải — không render `disabled`, không render dạng nghỉ |
| `LOADING-6` | `src/components/blocks/dashboard/pending-gate.test.tsx` | Mỗi block được assert ở trạng thái nghỉ đối chiếu với request chưa giải của CHÍNH NÓ, mỗi lần một cái |
| `LOADING-7` | `src/components/blocks/dashboard/ContinueLearning/component.tsx` (~68–73) | `pending` đứng trong union bên cạnh `onboarding`, `empty`, `failed` và `ready`, mang theo phần khung chứ không mang theo con số không |

Mọi mã đều đã neo được. Không mã nào chưa neo.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| region | Component hoặc section đang chờ, và request mà nó chờ |
| tier | block, composite hay leaf — file này nằm ở nửa nào của mối nối |
| situation | Câu trả lời chưa về, đã về mà rỗng, hay đã hỏng |
| shape | Cây mà surface này vẽ khi câu trả lời về |
| repeat count | Với một vùng lặp, nó nghỉ bằng mấy dòng |
| destination | Với mỗi control, thứ nó dẫn tới đã tồn tại chưa |

## Quy tắc

1. Một component, hai trạng thái. Bản đang chờ và bản thật là cùng một file — không file thứ hai,
   không prop đưa hình nghỉ từ ngoài vào.
2. Block sở hữu tình huống; leaf sở hữu dáng nghỉ. Không bên nào làm nửa của bên kia, và mối nối giữa
   chúng dài đúng một dòng.
3. Phần tử nghỉ bảo toàn thẻ, cách sắp xếp và measure của nó.
4. Vùng nghỉ bảo toàn chiều cao của một vùng thật, và số dòng lặp là một quyết định được khai báo.
5. Phần tử nghỉ được giấu khỏi trợ năng đúng bằng khoảng thời gian nó nghỉ.
6. Control chưa có đích thì vắng mặt, không phải `disabled`, cũng không phải dạng nghỉ.
7. Một cờ chờ cho một request. Nhiều request độc lập thì không dùng chung một cờ.
8. `pending` là một thành viên của state union, và nó mang theo phần khung để khung tự vẽ được mình.
9. Không có gì được dịch chuyển vào đúng khoảnh khắc dữ liệu về.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó
áp dụng vào.

- **Test được dựng hình nghỉ bằng tay.** Một twin nằm trong file `.test.tsx` hoặc `.spec.tsx` là
  fixture để assert, không phải bản mô tả thứ hai được ship cho người đọc. `LOADING-1` không với tới
  đó.
- **Primitive nghỉ dùng chung không phải twin.** Một mặt nghỉ tổng quát mà component nghỉ BẰNG nó là
  điều ngược lại với twin: nó không mô tả hình của ai cả, nên không thể drift khỏi hình nào.
  `LOADING-1` cấm nhại một component CÓ TÊN, không cấm một primitive.
- **Control mà bề rộng chính là nhãn của nó thì không nghỉ được.** Một dòng chữ có measure khai báo sẵn
  nên nghỉ được mà chưa cần biết sẽ nói gì; một control lấy chữ làm bề rộng thì không. Đó là lý do
  `LOADING-5` bỏ hẳn nó thay vì rút ruột nó.
- **Dữ liệu đã có trong cache thì không phải tình huống chờ.** Vùng đang fetch lại phía sau dữ liệu nó
  đang hiển thị vẫn là `ready`; nó không phải `pending`, và xoá trắng nó là `LOADING-2` bị lộn ngược —
  một cái hình đi giật lùi.
- **Nhánh `null` là đúng.** Ternary có một nhánh `null` là `LOADING-5`, không phải cây thứ hai, và
  `LOADING-2` không áp vào đó.

## Đầu ra

Mỗi file mà shape sinh ra thì một khối.

```text
region: <the component or section that waits>
tier: <block | composite | leaf>
situation: <LOADING-1 | LOADING-2 | LOADING-3 | LOADING-4 | LOADING-5 | LOADING-6 | LOADING-7>
expression: <state: "pending" | isLoading flag | const isLoading = input.state === "pending">
resting shape: <the same tree, named — and what is emptied out of it>
held by: <unrepresentable | enforced: <rule> | documented>
reason: <the business fact that excludes the adjacent code>
```

## Ví dụ đã giải

Shape đã duyệt: một section trên dashboard có heading "Học tiếp", hiển thị tiêu đề khoá học, một dòng
tiến độ, và một nút "Học tiếp" dẫn vào bài học hiện tại.

Shape nói cái cây khi câu trả lời đã về. Nó không nói request nào nuôi section này, section nghỉ bằng
mấy dòng, bài học mà nút dẫn tới đã tồn tại hay chưa, hay `pending` có nằm trong state union của
section hay không — nên nó không giải quyết những thứ đó. Chúng được giải ở đây.

```text
region: ContinueLearning section
tier: block
situation: LOADING-7
expression: state: "pending"
resting shape: the same section — heading and region label kept, course title and progress emptied
held by: documented
reason: the section's heading is known before the request goes out, so waiting is a named situation carrying the frame — not LOADING-1, because nothing here builds a second component; the same file draws both states
```

```text
region: course title line
tier: leaf
situation: LOADING-2
expression: const isLoading = input.state === "pending"
resting shape: the same Text element — same tag, same arrangement, same measure, characters swapped out
held by: enforced: no-resting-branch-at-call-site
reason: the line has a declared measure and can rest without knowing what it will say — not LOADING-5, because removing it would cost the reader their place
```

```text
region: "Continue" button
tier: block
situation: LOADING-5
expression: state: "pending"
resting shape: absent — the slot holding the way out is omitted from the record entirely
held by: documented
reason: the lesson it leads to is not yet resolved, so there is no destination — not LOADING-2, because a ternary with a null arm is not a second tree
```

## Phạm vi

Luật này đúng cho mọi code cùng loại trong stack này. Nó không gọi tên sản phẩm nào, feature nào,
component library nào, registry key nào hay repository nào. Mọi ví dụ đều là TSX thông thường.
