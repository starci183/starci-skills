---
title: Props-and-slots · Vietnamese
module: props-and-slots
kind: pattern
codes: [SLOTS-1, SLOTS-2, SLOTS-3, SLOTS-4, SLOTS-5, SLOTS-6, SLOTS-7]
---

# Props và slot

Đầu vào của pattern này là một shape đã được duyệt — một layout, một block, một capability hay một
contract mà ai đó đã quyết định là đúng. Quyết định ấy không được mở lại ở đây. Đầu ra là kiến trúc
source: component nằm ở file nào, alias tầng nào định kiểu cho tham số của nó, alias đó mở ra những
slot nào, kiểu dữ liệu tên là gì, và vì thế component bị cấm nhận những gì. Pattern này hạ một shape
đã duyệt xuống thành code có kiểu.

## Luật

Props của một component là **một tập slot có tên, đóng**, và tập đó được viết thành **một type alias
cho mỗi tầng**, không phải lắp lại ở từng file. Khi hỏi "component này nhận được gì?", câu trả lời
không nằm ở trí nhớ của ai cả — nó là thứ duy nhất biên dịch được.

Chỗ phân biệt quyết định tất cả những gì bên dưới: **một quy ước thì đúng hôm nay, một hàng rào thì
đúng tháng sau.** `interface XProps { props: XData; isLoading?: boolean }` là quy ước: đúng lúc viết,
và cách một chữ `extends` là nó mang được styling riêng của caller. Một alias **chính là** toàn bộ
hình dạng thì là hàng rào: không có chỗ nào để nhét slot thứ tư, nên người muốn thêm buộc phải quay
lại quyết định mình đang viết tầng nào.

Năm slot tồn tại trong cả hệ thống, và không component nào có đủ năm. `props` là thứ nó vẽ. `on` là
thứ nó làm. `contract` là khoá nó render và `render` là một component có tên cho từng slot mà khoá đó
khai báo — có đủ hai thứ ấy mới làm một container thành container. `isLoading` là cờ được trao xuống,
không bao giờ tự quyết tại chỗ.

**Đây là luật bắt buộc, không phải lời khuyên.** Component nào nhận bất cứ thứ gì đều rơi vào một
tình huống slot, và tình huống ấy có mã ở dưới. Câu "có mỗi một prop thôi mà" không phải một trường
hợp được miễn; đó chính là chỗ hàng rào bị thay bằng một shape viết tay nhiều nhất — và hai thứ đó
giống hệt nhau đúng vào ngày viết ra.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `SLOTS-<n>`. Mã gọi tên TÌNH HUỐNG; alias tầng gọi
tên thứ mà tình huống ấy sinh ra. Các số là cố định và được trích dẫn từ ngoài module, nên không bao
giờ đánh số lại khi danh sách thay đổi.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `SLOTS-1` | Có thứ mang **hành vi** muốn đi chung đường với dữ liệu | Đòi: slot dữ liệu chỉ chứa dữ liệu — thứ mà một tài liệu JSON chứa được. Cấm: một hàm, một component hay bất kỳ giá trị nào mang hành vi nằm trong `props` |
| `SLOTS-2` | Đang khai báo shape dữ liệu của một component | Đòi: dữ liệu của component được khai bằng type alias. Cấm: `interface` cho một shape dữ liệu |
| `SLOTS-3` | Tham số của một component cần một kiểu | Đòi: tham số nhận đúng một kiểu có tên, `XProps` cho component `X`. Cấm: kiểu object viết thẳng tại chỗ, hoặc một intersection lắp ngay tại tham số |
| `SLOTS-4` | Caller muốn quyết định **phần bên trong** của component | Đòi: container khai `contract` và `render`; shape đóng không khai cái nào. Cấm: một lỗ markup ngoài các shell đóng; `render` trên một shape đóng |
| `SLOTS-5` | Có chỗ đang chờ dữ liệu về | Đòi: component nằm dưới tầng sở hữu request **nhận** `isLoading`. Cấm: component tự quyết trạng thái chờ của mình |
| `SLOTS-6` | Caller muốn một chỗ **trông khác đi** | Đòi: ngoại hình là một variant có tên, quyết định ở bên trong. Cấm: `className`, `style`, prop khoảng cách, hook styling cho từng phần |
| `SLOTS-7` | Một surface dùng chung phải hiển thị một collection theo domain | Đòi: surface list dùng chung nhận collection dưới tên domain của nó, bên trong `props`. Cấm: một làn `items` chung ở cấp cao nhất trên surface đó |

Không có `SLOTS-8`. Danh sách chạy từ `SLOTS-1` tới `SLOTS-7`, và một khoảng trống trong dãy số nghĩa
là một mã đã bị rút, chứ không phải thiếu mất một mã.

## Đọc một shape đã duyệt

1. **Đọc những gì shape phát biểu.** Tầng là một trong leaf, composite, branch hoặc block, và nó được
   quyết trước khi viết kiểu props. Shape nêu ra những giá trị component vẽ, những handler nó gọi,
   caller có được đưa vào phần bên trong hay không và dưới khoá contract nào, tầng nào sở hữu request,
   và mọi ngoại hình mà caller đã xin.
2. **Gọi tên những gì shape không phát biểu, và do đó không giải quyết.** Một shape đã duyệt không
   chọn `type` thay cho `interface`, không đặt tên cho kiểu tham số, không quyết `render` đi làn nào,
   và không nói ai tính trạng thái chờ. Những thứ đó được giải quyết ở đây, bằng mã — không bao giờ
   suy ra từ sự im lặng của shape.
3. **Giải quyết từ ngoài vào trong.** Bắt đầu ở container. Việc component ngoài cùng có khai `contract`
   và `render` hay không sẽ chốt alias tầng cho mọi thứ nằm dưới nó; chỉ khi đó các component bên
   trong mới có một tầng để được định kiểu theo.
4. **Hỏi câu hỏi của từng mã, theo thứ tự.** Có thứ nào mang hành vi ngồi trong slot dữ liệu không
   (`SLOTS-1`)? Shape dữ liệu có được khai bằng type alias không (`SLOTS-2`)? Tham số có nhận đúng một
   `XProps` có tên không (`SLOTS-3`)? Caller có được quyết định phần bên trong không (`SLOTS-4`)? Ai
   sở hữu request, và do đó ai ghi `isLoading` (`SLOTS-5`)? Có ai xin styling không, và tên nghiệp vụ
   của variant đó là gì (`SLOTS-6`)? Một surface dùng chung có nhận collection không, và dưới tên nào
   (`SLOTS-7`)?
5. **Khi hai mã cùng khớp, đường ranh giới quyết định.** Một handler lọt vào `props` là `SLOTS-1`; một
   component lọt vào `props` là `SLOTS-4` đội lốt `SLOTS-1`, vì caller đang quyết phần bên trong mà
   không khai `contract`. Một chuỗi class là dữ liệu hợp lệ về kiểu, nên `SLOTS-1` không chặn nó còn
   `SLOTS-6` chặn, vì lý do quyền sở hữu. `SLOTS-4` hỏi caller có được đổ nội dung vào không;
   `SLOTS-7` hỏi dữ liệu chạy theo đường nào khi câu trả lời của `SLOTS-4` đã là có. Một `interface`
   có tên thoả `SLOTS-3` mà vẫn sai `SLOTS-2`. Ghi cả hai mã khi cả hai cùng áp dụng; đừng gộp lại
   thành một.

## `SLOTS-1` — slot dữ liệu chỉ chứa DỮ LIỆU

**Tình huống.** Có một thứ mang hành vi — một handler, một component, một factory — và chỗ tiện nhất
để đặt nó là ngay cạnh những giá trị mà nó tác động lên. Luật nói không: dữ liệu là những gì một tài
liệu JSON chứa được, và chỉ vậy.

**Nó sinh ra gì trong source.** `props` được định kiểu bằng một alias dữ liệu mà mọi thành viên đều có
hình dạng JSON. Hành vi muốn đi ké được chuyển sang slot `on`, và không thứ gì mang hành vi còn với
tới được từ `props`.

**Dấu hiệu nhận biết.** Trong `props` xuất hiện một `() =>`, một tên viết hoa đầu, hoặc một biến giữ
component; có người lập luận rằng "nó gắn với dữ liệu này nên để chung cho gần"; shape được truyền vào
đang do **caller** định nghĩa chứ không phải component. Tự hỏi: nếu serialize toàn bộ `props` ra JSON
rồi đọc lại, có mất thứ gì không? Mất — thì thứ mất đi đó không thuộc `props`.

**Ranh giới.** Đây không phải `SLOTS-4`: một handler đi lạc vào `props` là `SLOTS-1`, nhưng một
**component** đi lạc vào `props` là `SLOTS-4` đội lốt `SLOTS-1` — caller đang muốn quyết định phần bên
trong mà không khai `contract`. Cũng không phải `SLOTS-2`: `SLOTS-1` nói về **giá trị** được truyền,
`SLOTS-2` nói về **cách khai báo kiểu** của giá trị đó, và vi phạm `SLOTS-2` là cách phổ biến nhất để
một vi phạm `SLOTS-1` lọt qua mà không đỏ.

**Tình huống nghiệp vụ hay gặp.** Row có nút xoá riêng · card có `onRetry` gắn theo từng item · cell
tự vẽ badge · list truyền hàm format tiền · empty state kèm CTA riêng cho từng loại rỗng.

## `SLOTS-2` — dữ liệu khai bằng `type`, không bao giờ bằng `interface`

**Tình huống.** Đang khai báo shape dữ liệu cho một component. Hai cách viết trông tương đương, và chỉ
một cách còn giữ được hàng rào của `SLOTS-1`.

**Nó sinh ra gì trong source.** `type XData = { … }` trong module sở hữu nó, thoả ràng buộc
`D extends ComponentData` mà mọi alias tầng đều áp. Đây **không** phải sở thích code style: TypeScript
cấp *implicit index signature* cho type alias và **không** cấp cho interface, nên một interface **âm
thầm** trượt ràng buộc dữ liệu — nó biên dịch được ngay tại chỗ khai báo, rồi thôi không còn thoả mãn
ràng buộc đang giữ hàm ra khỏi `props`.

**Dấu hiệu nhận biết.** Lỗi biên dịch xuất hiện ở **chỗ dùng** chứ không ở chỗ khai báo, và người đọc
kết luận nhầm rằng alias tầng đang hỏng; có ai đó vừa "sửa" bằng cách nới ràng buộc của alias tầng
thay vì đổi `interface` thành `type`. Tự hỏi: kiểu dữ liệu này có bao giờ được truyền qua một slot
alias không? Có — thì nó phải là `type`.

**Ranh giới.** Đây không phải `SLOTS-1`: alias là **điều kiện cần** để `SLOTS-1` còn hiệu lực, và
interface không phá `SLOTS-1` một cách ồn ào — nó làm `SLOTS-1` vắng mặt. Cũng không phải `SLOTS-3`:
`SLOTS-3` đòi kiểu **có tên**, `SLOTS-2` đòi kiểu được khai **bằng đúng công cụ**, và một interface có
tên vẫn đủ tên cho `SLOTS-3` mà vẫn sai ở `SLOTS-2`.

**Tình huống nghiệp vụ hay gặp.** Shape dữ liệu của một card · payload của một row trong bảng · shape
của một item trong danh sách · kiểu dữ liệu dùng lại giữa nhiều leaf.

## `SLOTS-3` — hình dạng của tham số phải có TÊN

**Tình huống.** Viết một component và gõ luôn shape vào ngay tại tham số. Nó biên dịch, nó chạy, và nó
là một shape **không có chỗ nào để được đọc từ đó**: không import được, không tham chiếu được từ twin
test, không tìm được bởi người đang hỏi "component này nhận gì?".

**Nó sinh ra gì trong source.** Một kiểu có tên cho mỗi component, `XProps` cho component `X`, khai
trong chính module của component ấy và gọi tên **toàn bộ input** trước khi hàm bắt đầu. Tham số nhận
đúng cái tên đó và không nhận gì khác.

**Dấu hiệu nhận biết.** Dấu `{` mở ra ngay sau dấu `:` của tham số; một intersection được lắp tại chỗ,
kiểu `Frame & { signOutLabel: string }` — có tên một nửa vẫn là ẩn danh, vì nửa còn lại không ai gọi
tên được; twin test phải chép lại shape thay vì import nó. Tự hỏi: có thứ gì khác trong repo tham
chiếu được tới shape này không?

**Ranh giới.** Đây không phải `SLOTS-2` — xem trên. Cũng không phải trường hợp tham số vô hướng:
`(value: string)` không phải shape, không có chỗ nào cần được đọc từ đó, và không thuộc mã này.

**Tình huống nghiệp vụ hay gặp.** Component mới viết nhanh trong lúc dựng màn · page component có
thêm vài chuỗi copy · component được refactor tách ra từ một file lớn · helper render nhận một object
"tạm".

## `SLOTS-4` — có `contract` và `render` là ranh giới tầng

**Tình huống.** Đang quyết định component này là **shape đóng** hay **container mở**. Shape đóng không
có cả hai slot; container mở có cả hai. Cả hai chiều đều **nhìn thấy được trong props alias**, nên một
file đã trôi qua ranh giới sẽ lộ ra từ kiểu của nó, không cần đợi review.

**Nó sinh ra gì trong source.** Một container sinh ra `contract` cùng `render` đi với nhau trong một
tham số `BranchProps`, một component có tên cho mỗi slot mà khoá đó khai báo; một shape đóng sinh ra
tham số `LeafProps`, `CompositeProps` hoặc `BlockProps` không có cả hai slot và không có lỗ markup nào.
Slot không tên là `children`, và cái tên không phải chuyện thẩm mỹ: một lỗ markup nhận vào thứ **đã
dựng xong** — một `.map`, một ternary, một cây con không ai đặt tên — nên phần bên trong một container
sẽ không bao giờ phát biểu được ở đâu cả. `render` nhận **một component cho mỗi slot có tên**, và đó
là thứ biến ranh giới thành một sự thật do compiler giữ thay vì một thói quen do reviewer giữ.

**Dấu hiệu nhận biết.** Một shape đóng vừa mọc thêm slot cho caller đổ nội dung vào; một container mà
caller **không** đổ nội dung vào được — nó thuộc tầng dưới, dù tên gọi là gì; có người đề nghị "cho
nhận markup một lần này thôi". Tự hỏi: caller có được quyết định phần bên trong không? Có ⇒ khai
`contract` + `render`. Không ⇒ component này thuộc tầng đóng, và slot đang bàn không tồn tại.

**Ranh giới.** Đây không phải `SLOTS-1` — xem trên. Cũng không phải `SLOTS-7`: `SLOTS-4` hỏi **caller
có được đổ nội dung không**, `SLOTS-7` hỏi **dữ liệu chạy theo đường nào** khi câu trả lời của
`SLOTS-4` đã là có.

**Tình huống nghiệp vụ hay gặp.** Card có phần thân do màn hình quyết định · list surface dùng chung ·
section có nội dung khác nhau theo trang · wrapper layout · modal.

## `SLOTS-5` — `isLoading` được NHẬN, không được tự quyết

**Tình huống.** Một component nằm dưới tầng sở hữu request được **báo cho biết** thứ nó vẽ đã về hay
chưa. Nó không tự hỏi. Tầng sở hữu request ghi cờ đó **một lần** khi trao cây xuống, và bản thân tầng
đó không bao giờ nhận cờ — vì props của nó mang một **tình huống nghiệp vụ** thay vì một cờ chờ.

**Nó sinh ra gì trong source.** `isLoading` do tầng sở hữu request ghi ra rồi trao xuống; props alias
của chính tầng đó không mang cờ nào như vậy. Không `useState`, `useEffect` hay hook fetch nào tính
trạng thái chờ bên trong một leaf hay một composite.

**Dấu hiệu nhận biết.** Trong một leaf hoặc composite có `useState`, `useEffect` hay một hook fetch
quyết định trạng thái chờ; hai component cùng một cây đang chờ **lệch nhau**, vì mỗi cái tự trả lời;
có `isLoading` nằm trong props của tầng đang sở hữu request. Tự hỏi: ai gọi request? Nếu không phải
file này, thì file này **không có quyền** trả lời câu hỏi "đã về chưa".

**Ranh giới.** Đây không phải `SLOTS-1`: cờ chờ là `boolean`, nên nó qua được `SLOTS-1` một cách hợp
lệ. Vấn đề của `SLOTS-5` không phải kiểu của cờ mà là **ai viết ra nó**.

**Đây là mã yếu nhất của module.** Không type nào và không rule nào bắt được một component tự tính
trạng thái chờ của mình; chỉ người đọc bắt được.

**Tình huống nghiệp vụ hay gặp.** Skeleton của card trong dashboard · bảng có phân trang · avatar chờ
hồ sơ · số liệu tổng quan · list gợi ý tải sau nội dung chính.

## `SLOTS-6` — không có slot ngoại hình

**Tình huống.** Caller muốn một chỗ trông khác đi: một class, một style, một khoảng cách, một hook
styling cho từng phần bên trong. Không slot nào trong số đó tồn tại.

**Nó sinh ra gì trong source.** Một variant có tên, quyết định **ở bên trong** component; không prop
nào mang tên ngoại hình xuất hiện ở bất cứ đâu trong alias. Người nào chỉnh được diện mạo của một node
thì đã trở thành **chủ sở hữu thứ hai** của nó, và component lúc đó có hai tác giả không bao giờ nói
chuyện với nhau. Thứ caller đang cố nói ra là một **variant có tên**.

**Dấu hiệu nhận biết.** Một prop có tên kết thúc bằng `ClassName`, `Style`, `Gap`, `Spacing`; một
object `classNames` mở từng phần bên trong ra cho caller; cùng một component trông khác nhau ở hai màn
hình mà không màn nào gọi tên được sự khác nhau đó. Tự hỏi: caller đang muốn nói điều gì về **nghiệp
vụ**? Câu trả lời đó là tên của variant.

**Ranh giới.** Đây không phải `SLOTS-1`: một chuỗi class **là** dữ liệu hợp lệ về kiểu, nên `SLOTS-1`
không chặn nó; `SLOTS-6` chặn vì lý do quyền sở hữu, không phải vì lý do kiểu. Cũng không phải
`SLOTS-4`: mở ngoại hình ra là mở **diện mạo**, mở `render` ra là mở **cấu trúc** — hai lỗ khác nhau,
và lỗ ngoại hình không bao giờ hợp lệ.

**Tình huống nghiệp vụ hay gặp.** Tô đậm dòng của chính mình trong bảng xếp hạng · card nổi bật hơn ở
trang landing · nút nguy hiểm · row đã đọc và chưa đọc · trạng thái được chọn.

## `SLOTS-7` — collection đi theo tên domain trong `props`, không đi qua `items`

**Tình huống.** Một surface dùng chung phải hiển thị một collection: task, khoá học, hoá đơn, hay bất
cứ thứ gì thêm vào sau này. Surface đó là **nơi chứa contract**, không phải một mô hình dữ liệu. Vì
component `render` ổn định của nó đã sở hữu shape props theo domain, collection đi dưới **tên thật của
nó** bên trong `props`.

**Nó sinh ra gì trong source.** Collection là một thành viên mang tên domain nằm trong `props`, và
surface dùng chung không có slot `items` ở cấp cao nhất. Một slot `items` cấp cao nhất tạo ra **làn dữ
liệu thứ hai** chạy song song với `props`, và dạy cho surface dùng chung biết mô hình collection của
từng caller; đến caller thứ ba thì surface đã biết ba mô hình mà đáng lẽ nó không cần biết cái nào.

**Dấu hiệu nhận biết.** Cùng một call site truyền dữ liệu chạy qua hai đường, một phần trong `props`,
một phần trong `items`; có người đang bàn xem "thứ này nên để `props` hay `items`" — câu hỏi đó chỉ
tồn tại khi làn thứ hai đã tồn tại. Tự hỏi: nếu ngày mai có thêm một domain nữa dùng surface này,
surface có phải học thêm gì không?

**Ranh giới.** Đây không phải `SLOTS-4` — xem trên. Cũng không phải `SLOTS-1`: cả hai đều nói về
`props`, nhưng `SLOTS-1` nói **cái gì được vào** còn `SLOTS-7` nói **đường nào được dùng**.

**Tình huống nghiệp vụ hay gặp.** Card nhiệm vụ hằng ngày · danh sách khoá học đang học · lịch sử
thanh toán · danh sách thông báo · bảng thành viên.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là một union đóng, hoặc một alias chính là toàn
bộ hình dạng, làm cho giá trị sai không viết ra được; `enforced` nghĩa là một rule có tên trong
`@starci/eslint-canon-fe` báo lỗi nó; `documented` nghĩa là không có cơ chế nào giữ nó và chỉ
người đọc giữ.

| Mã | Tầng | Ai giữ | Cái gì vẫn lọt |
|---|---|---|---|
| `SLOTS-1` | `unrepresentable` | `DataValue` trong `@starci/eslint-canon-fe/props` — một union đóng không có thành viên nào là hàm | Không gì cả, ở mọi chỗ dùng alias tầng |
| `SLOTS-2` | `unrepresentable` | Ràng buộc `D extends ComponentData` trên mọi alias tầng | Lỗi rơi ở slot, không rơi ở `interface`; một kiểu dữ liệu không bao giờ đi qua slot thì vẫn biên dịch được |
| `SLOTS-3` | `enforced` | `no-inline-parameter-type` | Một kiểu có tên nhưng không phải `XProps` cho component `X` — cái tên được đọc, không được kiểm |
| `SLOTS-4` | `enforced` | `no-children-slot`, cộng `BranchProps` cho nửa khẳng định | Rule thấy lỗ markup; không gì thấy một shape đóng mọc thêm `render` |
| `SLOTS-5` | `documented` | Không gì cả. `BlockProps` chứng minh một block không bao giờ NHẬN cờ; không gì chứng minh một leaf không bao giờ TỰ QUYẾT | Bất kỳ trạng thái chờ cục bộ nào một component tự tính cho mình |
| `SLOTS-6` | `unrepresentable` + `enforced` | Ba alias tầng đóng không mang thành viên ngoại hình nào, và JSX từ chối một attribute lạ. Cái lỗ mà alias để lại — một kiểu props viết tay — được bốn rule bịt: `no-public-classname-prop` ở chỗ khai báo và ở chỗ gọi, `no-per-part-classname-prop` cho `<part>ClassName`, `no-public-frame-css-props` cho các prop hình dạng CSS ở trên tầng leaf, và `no-css-door-type-laundering` cho một cánh cửa giấu sau `Omit`/`Pick`/`Exclude` | Một cánh cửa mang cái tên mà không rule nào trong bốn cái nhận ra — chúng đọc **tên** prop, nên một quyết định ngoại hình đi dưới tên `tone` hay `density` là câu chuyện đặt tên, không phải cái slot mà hệ kiểu nhìn thấy được |
| `SLOTS-7` | `enforced` | `no-surface-list-items-slot` | Mọi surface dùng chung khác — rule chỉ bind vào đúng một import path |

Bốn mã do một type giữ và ba mã do một rule giữ, và đó là bố cục luật này muốn chứ không phải trùng
hợp: một hình dạng biết từ chối thì mạnh hơn một rule biết báo cáo, và các rule tồn tại đúng ở chỗ mà
type không có gì để nhìn. `SLOTS-3` là trường hợp rõ nhất — mọi ràng buộc mà alias áp đều được một
shape viết tại chỗ thoả mãn, mà nó vẫn sai, vì cái sai không nằm ở chuyện có những field nào mà ở
chuyện không thứ gì khác tham chiếu tới chúng được.

## Điểm neo

Từng mã, và code thật để đối chiếu.

| Mã | Đường dẫn | Nhìn cái gì |
|---|---|---|
| `SLOTS-1` | `@starci/eslint-canon-fe/props` | Union `DataValue` và `ComponentData`; xác nhận không thành viên nào là kiểu hàm, rồi thử gán một handler vào `props` |
| `SLOTS-2` | `@starci/eslint-canon-fe/props` | `LeafProps<D extends ComponentData>`; khai một shape dữ liệu bằng `interface` rồi truyền vào — ràng buộc sẽ hỏng |
| `SLOTS-3` | `@starci/eslint-canon-fe` | `isInlineObjectType`, hàm đi xuyên intersection và dấu ngoặc, cùng các fixture invalid trong `props-and-slots.test.mjs` |
| `SLOTS-4` | `@starci/eslint-canon-fe/props` · `@starci/eslint-canon-fe` | `BranchProps` mang `contract` + `render` và không có lỗ markup; rồi `CHILDREN_SHELLS` và `isGoverned` cho các shell được miễn và các tầng rule quản |
| `SLOTS-5` | `@starci/eslint-canon-fe/props` | `BlockProps` — hai slot, không có `isLoading`, tức chỉ neo được nửa NHẬN. Nửa TỰ QUYẾT thì chưa neo được |
| `SLOTS-6` | `@starci/eslint-canon-fe/props` | `LeafProps`, `CompositeProps`, `BranchProps`; xác nhận không có thành viên ngoại hình và không có index signature nào cho phép một thành viên như vậy lọt vào |
| `SLOTS-7` | `@starci/eslint-canon-fe` · `@starci/eslint-canon-fe/props` | `noSurfaceListItemsSlot` — phép kiểm import source bind nó, và phép kiểm attribute `items`; rồi `ContractRenderBranchProps`, nơi dữ liệu runtime ở lại trong `props` |

Điểm neo không phải đồ trang trí. Một luật không chỉ ra được trong code thật thì chỉ là một đề nghị,
và cái dòng neo được có một nửa ở trên là cái giá thành thật của việc giữ `SLOTS-5`.

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| tier | leaf, composite, branch hay block — quyết trước khi viết kiểu props |
| data | Những giá trị component vẽ, và bằng chứng từng giá trị có hình dạng JSON |
| behaviour | Những handler component gọi, giữ ở ngoài phần dữ liệu |
| fill | Caller có được đưa vào phần bên trong hay không, và dưới khoá contract nào |
| request ownership | Tầng nào sở hữu fetch, và do đó tầng nào ghi `isLoading` |
| appearance intent | Mọi styling caller muốn, phát biểu lại thành một variant có tên |

## Quy tắc

1. Alias tầng **chính là** hình dạng. Không có slot thứ tư để thêm.
2. Dữ liệu và hành vi đi **hai slot khác nhau**.
3. Mọi shape của tham số đều có tên trong module khai ra nó, và tên đó là `XProps`.
4. `contract` và `render` xuất hiện **cùng nhau** hoặc không xuất hiện.
5. Tầng sở hữu request **ghi** `isLoading` và không bao giờ nhận nó.
6. Ngoại hình được quyết định bên trong, dưới một cái tên.
7. Surface dùng chung không học mô hình collection của bất kỳ caller nào.
8. Một component dùng **một** alias tầng; cần alias khác nghĩa là đã chọn sai tầng.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ nới ra. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Shell đóng (`SLOTS-4`).** Các shell trao thẳng phần bên trong cho cơ chế của vendor — modal,
  drawer, dropdown — được miễn vì chúng **không sắp xếp gì cả** và không có quyền từ chối shape mà
  vendor khai. Rule còn miễn thêm chỗ nối route: nơi chuyển đổi thứ mà layout của framework trao
  xuống. Không có thư mục nào được miễn cả; danh sách là **bốn file có tên**.
- **Bảng registry (`SLOTS-4`).** `SLOTS-4` không áp vào chính bảng contract, nơi một ngữ pháp "con có
  tên" mô tả một khoá nhận được những gì. Báo lỗi nó là bắt file đã xoá lỗ ẩn danh phải thôi mô tả
  thứ đã thay thế nó.
- **Ngoài các tầng component (`SLOTS-4`).** Một page có route không chịu `SLOTS-4`; nhận thứ framework
  trao cho nó là việc hợp lệ duy nhất của một page.
- **Hai làn cho `render` (`SLOTS-4`).** `SLOTS-4` được thoả bằng slot có tên đã bind, hoặc bằng một
  component type ổn định mang brand. Chọn làn theo việc dữ liệu runtime có lặp hay không, không theo
  sở thích.
- **Tham số vô hướng (`SLOTS-3`).** `SLOTS-3` quản các shape. Một tham số kiểu `string` không phải một
  shape không có chỗ nào để được đọc từ đó, nên không cần alias.
- **Không có ngoại lệ cho `SLOTS-6`.** Một lần "chỉ lần này thôi" là một lần trao quyền sở hữu thứ
  hai, và quyền đó không lấy lại được bằng review.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra thì một khối.

```text
component: <name>
tier: <leaf | composite | branch | block>
data: <XData, declared with type>
props: <XProps = LeafProps<XData> | CompositeProps<XData> | BranchProps<XData, K> | BlockProps<S, XData>>
slots: <props | props + on | props + on + contract + render | state + props>
situation: <SLOTS-1 … SLOTS-7>
reason: <business fact that excludes the adjacent code>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một list surface dùng chung trên dashboard hiển thị nhiệm vụ hằng ngày của học
viên: màn hình sở hữu request, surface render đúng thứ mà khoá contract khai báo, và mỗi nhiệm vụ được
vẽ bởi một component row có hành động hoàn thành nhiệm vụ riêng.

Nó giải ra thành hai file.

```text
component: DailyTaskSurface
tier: branch
data: DailyTaskSurfaceData, declared with type
props: DailyTaskSurfaceProps = BranchProps<DailyTaskSurfaceData, K>
slots: props + on + contract + render
situation: SLOTS-4, SLOTS-7
reason: màn hình quyết định phần bên trong của surface này, nên contract và render xuất hiện cùng nhau — và nhiệm vụ hằng ngày đi dưới tên domain của nó bên trong props, không đi qua làn items ở cấp cao nhất, vì domain tiếp theo dùng surface này không được bắt nó học thêm gì; đây không phải chỉ SLOTS-4, vì câu trả lời cho "caller có được đổ nội dung không" đã là có và câu còn để ngỏ là dữ liệu đi làn nào
```

```text
component: DailyTaskRow
tier: leaf
data: DailyTaskRowData, declared with type
props: DailyTaskRowProps = LeafProps<DailyTaskRowData>
slots: props + on
situation: SLOTS-1, SLOTS-2, SLOTS-3
reason: handler hoàn thành nhiệm vụ đi trong on chứ không bao giờ nằm trong props, vì một handler đi lạc vào props là SLOTS-1 chứ không phải SLOTS-4 — ở đây không có gì cho caller quyết định phần bên trong của row; kiểu dữ liệu khai bằng type chứ không bằng interface nên ràng buộc tầng vẫn còn hiệu lực; và tham số nhận đúng tên DailyTaskRowProps để twin test import được shape thay vì chép lại nó
```

**Shape không phát biểu gì, và do đó không giải quyết gì.** Nó không nói kiểu dữ liệu viết bằng `type`
hay `interface`, không đặt tên cho kiểu tham số, không chọn giữa hai làn cho `render` — slot có tên đã
bind, hay một component type ổn định mang brand, chọn theo việc dữ liệu runtime có lặp hay không — và
không nói ai tính trạng thái chờ. Chỉ điều cuối là có chủ được gọi tên trong shape: màn hình sở hữu
request, nên màn hình ghi `isLoading` và không bao giờ nhận nó, còn surface và row thì nhận. Mà
`SLOTS-5` không được cơ chế nào giữ, nên nếu row có ngày tự tính trạng thái chờ của mình, chỉ người
đọc bắt được.

## Phạm vi

Module này phát biểu một luật đúng với bất kỳ front end nào viết bằng component có kiểu. Nó không gọi
tên sản phẩm nào, thư viện component nào, khoá registry nào hay repository nào. Mọi ví dụ đều là TSX
thông thường.
