---
title: Contract · Vietnamese
---

# Contract

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | bộ máy frontend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã được duyệt — một layout, một block, một capability hay một contract đã có
người chốt. Module này không mở lại quyết định đó. Nó trả về kiến trúc source: node được mô tả
ở file nào, tầng nào giữ nó, nó được import gì, phải export gì, và mang tên gì. Một shape đã duyệt đi
vào dưới dạng hình vẽ; nó đi ra dưới dạng một key trong bảng, một element mở ra ở đúng một frame, và
một lý do ghi ngay cạnh cả hai.

## Luật

Contract là mô tả của MỘT node. Nó là một key, và key sở hữu ba thứ mà tách ra thì cả ba đều vô
nghĩa: class mà node mặc, element mà node mở ra, và lý do những thứ bên trong nó lại đứng như vậy.
Người viết cần một hình dạng thì gõ key. Đó là toàn bộ quyết định layout mà họ được phép ra.

Mọi tầng phía trên leaf chỉ hợp thành key. Branch vẽ một key, composite xếp vài key, block xin một
key, page sắp thứ tự các key — và không tầng nào viết một chuỗi class, bởi ngay khi caller được gõ
`flex gap-3` thì cái cây bị quyết ở đúng bằng số call site đang có, và không còn gì phía trên đoán ra
được từ key nữa.

Câu hỏi phân định duy nhất: **element này có chứa element khác không?** Có thì nó là node, và node đến
từ một key. Một file tự mở `div` là một file đã tự trả lời câu hỏi mà bảng contract sinh ra để trả
lời.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi element cấu trúc đi vào production đều rơi vào
đúng một mã dưới đây. Không có hình dạng nào nhỏ tới mức được miễn: một hàng hai con là `CONTRACT-1`
cũng vì đúng cái lý do khiến một page shell là `CONTRACT-1`. Câu "có mỗi wrapper thôi mà" không
phải một ngoại lệ — đó là chỗ luật này bị bỏ qua nhiều nhất.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `CONTRACT-<n>`. Mã gọi tên TÌNH HUỐNG; ai giữ nó
là câu hỏi khác, trả lời ở phần *Tầng giữ* bên dưới.

| Mã | Tình huống | Source phải trông ra sao |
|---|---|---|
| `CONTRACT-1` | Đang định gõ `flex gap-3` thẳng vào một file | Node cấu trúc lấy class từ một key; không literal class cấu trúc ở call site, kể cả khi đã nhấc lên thành hằng số module |
| `CONTRACT-2` | Có hai trạng thái thật, định ghép class lúc chạy để phân biệt | Một phân biệt giữa hai hình dạng xứng đáng có key hoặc prop có tên; không ghép, không nội suy class lúc chạy |
| `CONTRACT-3` | Cần một giá trị khoảng cách/căn lề chưa có trong bảng từ vựng | Từ vựng layout là một union đóng, sửa một cách cố ý; không giá trị class nào nằm ngoài union đó |
| `CONTRACT-4` | Node cần là `ul`, `form`, `main` — không phải `div` | Entry tự đặt tên host của mình, và chỉ frame mặc nó; không prop `host`/`as`, không spread node props lên element do caller chọn |
| `CONTRACT-5` | Đang đặt tên cho một key mới | Tên của key nói cái gì được nằm bên trong nó; không `card`, `box`, `wrapper`, `row` hay bất cứ cái tên nào nhận vào mọi thứ |
| `CONTRACT-6` | Đang viết `why` cho một entry | Mỗi entry nói bỏ node đi thì cái gì vỡ; không phải một lý do dựng lại từ chính các chữ có trong key |
| `CONTRACT-7` | Đang mở một thẻ bằng tay ở ngoài frame | Đúng một file biến key thành element; không hộp trung tính viết tay, không element ngữ nghĩa mang class |
| `CONTRACT-8` | Đang viết tay `data-node` / `data-why` | Frame vẽ marker của node từ entry; không attribute marker contract nào viết tay |
| `CONTRACT-9` | Định thêm key vì key cũ "hơi chật" | Key mới được biện minh bằng một hình dạng chưa key nào diễn đạt; không entry thứ hai đánh vần hình dạng entry khác đã đánh vần |
| `CONTRACT-10` | Cần bọc node trong một vendor wrapper cố định | Surface branch có tên sở hữu vendor wrapper cố định của nó như code branch; không từ vựng contract thứ hai cho cơ chế wrapper, không contract node mặc TRÊN body vendor |
| `CONTRACT-11` | Đang khai báo bên trong một entry có gì | Entry khai mọi slot bên trong, từng cái có tên; không `children`, không danh sách con theo vị trí, không arrow trần trong slot, không slot lặp thiếu resting count |
| `CONTRACT-12` | Entry đang muốn mang `cursor-pointer`, `bg-surface`, `shadow-*` | Class của entry mô tả các con đứng với nhau thế nào; không hành vi, không sơn, không nền và không độ nổi trong một entry |
| `CONTRACT-13` | Có key trong bảng mà không màn nào vẽ | Mọi key trong bảng đều được vẽ ở đâu đó; không giữ key cho phần việc chưa bắt đầu |

Cách đánh số là CỐ ĐỊNH. Các mã này được trích dẫn từ những file luật khác và từ các task record đã
viết, nên đánh số lại là âm thầm làm hỏng một trích dẫn ai đó đã đặt. Một mã bị cho là sai thì vẫn
giữ nguyên và đem ra tranh luận trong bản audit, không bao giờ sửa lặng lẽ.

Danh sách dừng ở mười ba. Một tình huống mới là một lần đổi luật kèm nâng version, không phải một dòng
thứ mười bốn thêm vào lúc không ai đọc.

## Đọc một shape đã duyệt

1. **Đọc cái shape đã nói.** Nó nói có những vùng nào, vùng nào chứa vùng nào, các con của một vùng
   đứng với nhau ra sao, và cái gì lặp lại. Đó là những sự thật bạn không được quyết lại.
2. **Đọc cái shape KHÔNG nói, và vì thế không giải quyết.** Một hình vẽ không nói vùng đó mở ra
   element nào, key tên gì, vùng đó tồn tại vì cái gì, và có key nào sẵn đã đánh vần đúng vùng đó
   chưa. Những thứ này giải ở đây, từ bảng, không phải từ hình vẽ.
3. **Giải từ ngoài vào trong.** Lấy vùng ngoài cùng, chốt mã, chốt key và chốt host của nó, rồi mới đi
   xuống. Một vùng bên trong giải trước cha nó sẽ đẻ ra một key mà entry của cha đã khai sẵn thành
   một slot.
4. **Hỏi câu hỏi của từng mã cho từng vùng.** Element này có chứa element khác không (`CONTRACT-1`,
   `CONTRACT-7`)? Phân biệt giữa hai trạng thái của nó có thật không (`CONTRACT-2`)? Mọi class nó cần
   đã có trong union chưa (`CONTRACT-3`)? Nó mở ra element nào (`CONTRACT-4`)? Tên của nó có cố định
   được các con không (`CONTRACT-5`)? Bỏ nó đi thì cái gì vỡ (`CONTRACT-6`)? Ai vẽ marker cho nó
   (`CONTRACT-8`)? Có key nào sẵn đã đánh vần nó chưa (`CONTRACT-9`)? Quanh nó có vendor wrapper cố
   định không (`CONTRACT-10`)? Mọi phần tử con của nó đã có tên chưa (`CONTRACT-11`)? Có class nào nó mang
   là hành vi, sơn hay độ nổi không (`CONTRACT-12`)? Key nó resolve tới có thật sự được vẽ không
   (`CONTRACT-13`)?
5. **Khi hai mã cùng khớp thì cả hai cùng áp, và cả hai cùng phải sửa.** Chúng không phải hai lựa
   chọn. Một `cn` chỉ để bật `hover:` là `CONTRACT-2` và `CONTRACT-12` cùng lúc: ghép lúc chạy, và
   hành vi nằm sai chỗ. Một `<ul>` mở tay mà mang `flex gap-3` là `CONTRACT-7` cho cái thẻ và
   `CONTRACT-1` cho chuỗi class. Sửa cái ngoài trước — `CONTRACT-5` trước `CONTRACT-6`, vì một cái tên
   sai làm một câu `why` đúng không thể tồn tại.

## `CONTRACT-1` — class cấu trúc đến từ key, không từ literal

**Khi nào gặp.** Bạn đang ở trong một block, một page hoặc một composite, và cần hai thứ đứng cạnh
nhau. Tay bạn định gõ `className="flex items-center gap-3"`. `flex`, `grid`, `gap-*`, `items-*`,
`justify-*`, `col-*` và họ `position` quyết định hình dạng của một cây, không phải vẻ ngoài của một
giá trị. Một hình dạng được quyết ở call site là một hình dạng không ai tìm ra được từ bất cứ chỗ nào
khác.

**Source phải thể hiện gì.** Class rơi vào mảng `classes: [...]` của entry trong bảng contract, còn
call site chỉ mang mỗi cái key. Tầng block, page và composite không chứa một literal `className=` nào.

**Cách nhận ra.** Chuỗi class có ít nhất một token thuộc họ cấu trúc; element đang mở ra để CHỨA
thứ khác chứ không phải để hiển thị một giá trị; bạn vừa nhấc chuỗi class lên thành hằng số module
"cho gọn". Tự hỏi: nếu ngày mai cần biết node này rộng bao nhiêu và các con xếp thế nào, tôi tra ở
đâu? Nếu câu trả lời là "phải grep", đó là `CONTRACT-1`. Nhấc lên hằng số không cứu được gì —
`const ROW = "flex items-center gap-3"` chỉ đẩy quyết định lên một dòng và làm nó vô hình với cả người
đọc bảng lẫn mọi rule đọc JSX.

**Ranh giới.** Không phải `CONTRACT-2`: đây là chuỗi TĨNH viết sai chỗ, còn kia là chuỗi được ghép lúc
chạy — hai lỗi khác nhau, hai cách sửa khác nhau. Không phải `CONTRACT-3`: mã này hỏi *ai được viết
class này*, mã kia hỏi *class này có tồn tại không*; một `gap-[13px]` viết trong bảng vẫn sai, nhưng
sai vì `CONTRACT-3`. Không phải `CONTRACT-7`: nếu bạn vừa mở cả một `div` mới thì đó là `CONTRACT-7`;
mã này áp cho class trên một element bạn đã có quyền mở.

**Tình huống nghiệp vụ hay gặp.** Hàng avatar và tên; lưới thẻ khoá học; toolbar lọc; cột trái của
trang chi tiết; footer của một form; thanh hành động dính đáy trên mobile.

## `CONTRACT-2` — không ghép chuỗi class lúc chạy

**Khi nào gặp.** Có hai trạng thái thật (`isCompact`, `isSelected`, `variant`), và bạn định diễn đạt nó
bằng `cn(base, isCompact && "gap-2")` hoặc bằng template string.

**Source phải thể hiện gì.** Một entry thứ hai trong bảng, hoặc một prop có tên trên component sở
hữu node. Không một call site `cn`, `clsx`, `twMerge`, `cva` hay `tv` nào trong cây được cai quản, và
không một `className` nội suy nào.

**Cách nhận ra.** Có `cn`, `clsx`, `twMerge`, `cva`, `tv` trong file; có
`className={`…`${x}`…`}` hoặc `className={a + b}`; có một biến boolean đang chọn giữa hai chuỗi class.
Tự hỏi: sau khi build, có ai đọc được đầy đủ chuỗi class mà node này sẽ mặc, mà không cần chạy
component không? Phân biệt là thật, chỉ cách diễn đạt mới sai. Thứ bạn đang rẽ nhánh là một sự khác
biệt có thật trong nghiệp vụ, và nó xứng đáng có TÊN: hoặc là key thứ hai, hoặc là một prop có tên
trên component sở hữu node.

**Ranh giới.** Không phải `CONTRACT-1` — xem trên. Không phải `CONTRACT-9`: khi phân biệt là thật,
`CONTRACT-2` bảo *đặt cho nó một cái tên*, còn `CONTRACT-9` bảo *chỉ đặt tên khi hình dạng thật sự
khác*; hai key chỉ khác nhau một `gap` thì `CONTRACT-9` bác. Không phải riêng `CONTRACT-12`: một `cn`
chỉ để bật `hover:` là cả hai lỗi cùng lúc.

**Tình huống nghiệp vụ hay gặp.** Row đang chọn và không chọn; card compact và rộng; sidebar thu và
mở; badge đổi màu theo trạng thái; nút đang loading.

## `CONTRACT-3` — từ vựng class là một union đóng

**Khi nào gặp.** Bạn cần một giá trị mà bảng từ vựng chưa có: `gap-[13px]`, `w-[42%]`,
`items-stretch`.

**Source phải thể hiện gì.** Hoặc hình dạng được diễn đạt bằng những member đã có, hoặc một member
mới được thêm một cách cố ý vào `export type LayoutClassName` trong file bảng contract, như một lần
sửa có tên vào một danh sách có tên.

**Cách nhận ra.** TypeScript báo đỏ ngay tại phần tử trong mảng `classes`; bạn đang định thêm
`as string` hoặc `as LayoutClassName` để cho qua. Tự hỏi: giá trị này là một bậc mới của hệ, hay chỉ
là một lần chỉnh cho vừa mắt ở đúng một màn hình? Đây là mã mạnh nhất trong module, chính vì nó không
phải một rule: `gap-[13px]` không bị *cấm*, nó **không viết ra được**. Không có gì để đi tuần khi giá
trị sai không gõ nổi. Thêm một member là một lần sửa cố ý vào một danh sách có tên, không phải một
dòng lọt vào diff mà không ai đọc kỹ.

**Ranh giới.** Không phải `CONTRACT-1`: mã kia nói ai được viết, mã này nói viết được cái gì. Không
phải `CONTRACT-9`: mã này mở rộng từ vựng CLASS, mã kia mở rộng từ vựng KEY — cả hai đều là lạm phát,
nhưng ở hai bảng khác nhau.

**Tình huống nghiệp vụ hay gặp.** Rail bên phải cần một bề rộng mới; một breakpoint mới; một track
grid mới cho bảng xếp hạng; một inset shadow mới cho verdict band.

## `CONTRACT-4` — element thuộc về entry, không thuộc về caller

**Khi nào gặp.** Node này LÀ một danh sách, hoặc LÀ một form, hoặc LÀ landmark chính của tài liệu.
`div` không diễn đạt được điều đó.

**Source phải thể hiện gì.** Host được đặt tên trên entry, lấy từ union đóng `ContractHost`, và
frame đọc nó ra — `const Host = spec.host ?? "div"`. Props của frame không mang `host` và không mang
`as` để caller truyền vào.

**Cách nhận ra.** Bạn đang muốn thêm prop `as` hoặc `host` vào frame; bạn đang định spread node
props của một entry lên một element của riêng bạn; assistive technology sẽ đọc sai nếu element bị đổi.
Tự hỏi: nếu hai call site của cùng một key mở ra hai element khác nhau, chúng còn là một node không?
Không — chúng là hai node mặc chung một cái tên. Đây là lỗi không có màu đỏ ở đâu cả: hàm trả node
props đưa lại class và marker, KHÔNG đưa element, nên spread chúng lên một body vendor thì entry nói
`ol` mà tài liệu nhận `div` — danh sách rời khỏi accessibility tree, không còn gì báo có bao nhiêu
mục, trong khi key vẫn resolve, marker vẫn đọc đúng, và mọi gate vẫn xanh. Vậy nên node của entry phải
đứng BÊN TRONG body vendor, không phải TRÊN nó.

Lịch sử của mã này đáng nhớ. Trước khi entry được đặt tên element, frame chỉ vẽ `div`, nên mọi hình
dạng cần `<ul>` không có chỗ hợp pháp để sống và bị đẩy xuống tầng leaf — nơi duy nhất được tự viết
class. Cả một tầng đầy lên bằng arrangement vì một chỗ trống.

**Ranh giới.** Không phải `CONTRACT-7`: mã kia nói *đừng tự mở thẻ*, mã này nói *thẻ nào là quyết định
của entry*; một `<ul>` viết tay vi phạm `CONTRACT-7`, một `<ul>` do caller chọn qua prop vi phạm
`CONTRACT-4`. Không phải `CONTRACT-10`: surface branch ĐƯỢC PHÉP mở wrapper vendor của nó; cái nó
không được làm là mặc node của entry lên wrapper đó.

**Tình huống nghiệp vụ hay gặp.** Chuỗi ngày streak; danh sách module của khoá học; form thanh toán;
landmark `main` của trang; nav đích của sidebar; row của một joined list.

## `CONTRACT-5` — TÊN của key cố định thứ nằm bên trong nó

**Khi nào gặp.** Bạn vừa dựng xong một node và phải đặt tên cho nó.

**Source phải thể hiện gì.** Một key trong bảng mà cái tên cố định được một phần tử con —
`label-fact-over-progress`, `page-header-stack`, `title-with-baseline-fact`, `weekday-run` — và không
bao giờ là những cái tên chung `card`, `box`, `wrapper`, `row`, `container`, `content`,
`section-inner`, `main-wrapper`.

**Cách nhận ra.** Cái tên bạn định đặt là `card`, `box`, `wrapper`, `row`, `container` hoặc
`content`; bạn không viết nổi một câu `why` đúng cho MỌI chỗ sẽ dùng key này; bạn thấy key này "chắc
dùng được cho nhiều thứ". Tự hỏi: nếu ai đó đặt nhầm một phần tử con vào key này, người đọc code có nhìn
ra ngay không? Cái tên chung luôn thắng anh em cụ thể của nó ở mọi call site, vì nó là cái không ai
phải suy nghĩ — và một key vẽ hai mươi vùng thì không nói nổi vì sao MỘT vùng nào trong đó lại ở đó.

Đảo chiều ở đây đã được ghi lại, không im lặng. Bản đồ con từng bị bỏ vì không kiểm được gì khi nội
dung đến dưới dạng markup: một `.map`, một ternary và một subtree vô danh trông y hệt nhau với mọi
rule. Nay nội dung đến dưới dạng COMPONENT, một cái cho mỗi slot có tên, nên phép kiểm không còn là
rule — nó là TYPE. Quyết định cũ đúng với hình dạng nó được ra, và sai với hình dạng này.

**Ranh giới.** Không phải `CONTRACT-6`: tên cố định CÁI GÌ ở bên trong, còn `why` nói VÌ SAO chúng
đứng như vậy; tên sai làm `why` không thể đúng, nên `CONTRACT-5` luôn phải sửa trước. Không phải
`CONTRACT-11`: entry hợp thành khai báo TỪNG slot và compiler kiểm từng cái, nên với entry đó cái tên
không còn là thứ DUY NHẤT giữ phần tử con; với node nhận nội dung từ caller thì tên vẫn là thứ duy nhất.
Không phải `CONTRACT-9`: mã này hỏi *tên này có cố định được gì không*, mã kia hỏi *key này có đáng
tồn tại không*.

**Tình huống nghiệp vụ hay gặp.** `label-figure-over-bar`; `title-with-baseline-fact`;
`page-header-stack`; `weekday-run` — và những cái tên KHÔNG được dùng: `card`, `section-inner`,
`main-wrapper`.

## `CONTRACT-6` — mỗi entry nói vì sao node của nó tồn tại

**Khi nào gặp.** Bạn đang điền trường `why` của một entry.

**Source phải thể hiện gì.** Một câu `why:` trên entry, nêu đúng cái gì vỡ, xuống dòng hay tràn ra
khi không có node — đủ dài để là một mệnh đề, và không phải một lần chép lại chính các chữ trong key.

**Cách nhận ra.** Câu `why` đọc lên chỉ là cái key viết thành chữ thường có dấu cách; câu `why`
ngắn hơn một mệnh đề; bỏ node đi mà câu `why` vẫn "đúng", vì nó không nói gì cả. Tự hỏi: nếu xoá node
này, cái gì vỡ, xuống dòng, tràn ra, hoặc thôi bấm được? Viết đúng cái đó. Đây là thứ duy nhất không
tái tạo được từ markup về sau: class đọc lại được, element đọc lại được, danh sách con đọc lại được;
cái không đọc lại được là vì sao ai đó đã dựng node này. "Một hàng chip" tốn một dòng và không dạy gì;
"tag xuống dòng riêng trước khi tiêu đề xuống dòng" là sự thật đã làm node ra đời.

**Ranh giới.** Không phải `CONTRACT-5` — xem trên. Không phải `CONTRACT-12`: nếu lý do thật là "để nó
bấm được" thì đó không phải lý do của một entry — đó là `CONTRACT-12`, và hành vi phải chuyển sang
branch sở hữu control.

**Tình huống nghiệp vụ hay gặp.** Vì sao fact dính baseline với tiêu đề; vì sao rail phải sticky; vì
sao total tách khỏi các dòng phía trên bằng một đường kẻ; vì sao thumbnail bị ẩn trên màn hẹp.

## `CONTRACT-7` — đúng một file biến key thành element

**Khi nào gặp.** Bạn cần một hộp. Không có key nào vừa.

**Source phải thể hiện gì.** Đúng một `<Host>` mở ra từ một spec, nằm trong contract frame và không
ở đâu khác. Mọi file còn lại chỉ hợp thành key. Chỗ không key nào vừa thì thứ sinh ra là một entry mới
trong bảng, không phải một `div`.

**Cách nhận ra.** Bạn vừa gõ `<div>`, `<section>`, `<main>`, `<header>`, `<footer>`, `<aside>`
hoặc `<nav>` ở ngoài frame; bạn vừa gắn `className` lên một `<ul>`, `<ol>`, `<li>` hay `<form>`. Tự
hỏi: cái hộp này có ghi lại được ở đâu không — nó mặc class gì, phần tử con nào thuộc về nó, và nó tồn tại
vì cái gì? Nếu không có chỗ nào ghi, đó là node không key. Và "không có key nào vừa" là một PHÁT HIỆN,
không phải giấy phép mở `div`.

Element ngữ nghĩa là chuyện khác, và khác đó không phải kẽ hở. `form` tồn tại để submit; `ul` tồn tại
vì nội dung của nó là một danh sách. Assistive technology đọc chính cái element đó, nên nó không thể
bị thay bằng một hộp trung tính, và mở nó quanh một contract node không quyết định hình dạng nào cả.
Thứ vẫn phải đến từ entry là HÌNH DẠNG: ngay khi element ngữ nghĩa mang một class, nó thôi làm wrapper
và trở thành node không key.

**Ranh giới.** Không phải `CONTRACT-1`: một element không key mà KHÔNG mang class cấu trúc vẫn là
`CONTRACT-7`; hai mã bắt hai nửa khác nhau của cùng một thói quen. Không phải `CONTRACT-4` — xem trên.
Không phải `CONTRACT-10`: surface branch có tên là ngoại lệ đã đóng của mã này.

**Tình huống nghiệp vụ hay gặp.** Wrapper "cho dễ căn"; `section` bọc nội dung trang; `div` giữ chỗ
trong lúc loading; `form` có `onSubmit` và không class nào — cái cuối là hợp lệ.

## `CONTRACT-8` — marker do frame vẽ, không viết tay

**Khi nào gặp.** Bạn muốn một element đọc lên như "thuộc về contract" cho test hoặc cho công cụ.

**Source phải thể hiện gì.** `data-node` và `data-why` được sinh ra trong đúng một hàm,
`contractNodeProps`, và do frame gắn lên. Source sản phẩm không viết attribute nào trong hai cái đó.

**Cách nhận ra.** Có `data-node="..."` hoặc `data-why="..."` viết tay trong source sản phẩm. Tự
hỏi: cái marker này đang BÁO CÁO một entry, hay đang KHẲNG ĐỊNH một entry mà không có gì giữ? Marker
viết tay tệ hơn node không marker. Node không marker ít nhất thành thật. Node có marker viết tay khiến
mọi người đọc và mọi test đi qua các attribute đó tin vào một lời khẳng định mà không rule nào giữ.

**Ranh giới.** Không phải `CONTRACT-4`: mã kia là spread cả cụm node props lên element sai, mã này là
gõ tay từng attribute. Kết quả giống nhau ở chỗ tệ nhất: node đọc lên như có contract mà không có.

**Tình huống nghiệp vụ hay gặp.** Thêm `data-node` để selector trong e2e ngắn lại; copy một node đã
render rồi dán vào chỗ khác; fixture của story bị nhấc thành component thật.

## `CONTRACT-9` — key mới được biện minh bằng hình dạng, không bằng một cái gap khác

**Khi nào gặp.** Có key gần đúng, chỉ là "hơi chật" hoặc "hơi thưa".

**Source phải thể hiện gì.** Không entry mới nào cả. Hoặc entry cũ đổi cho TẤT CẢ, hoặc dùng đúng
cái key đang có. Một entry mới chỉ được viết ở chỗ không key nào diễn đạt được hình dạng đó.

**Cách nhận ra.** Key mới khác key cũ đúng một token khoảng cách; đúng một `restingCount`; hoặc
chỉ khác ở `why` và ở tên. Tự hỏi: trừ cái tên, cái lý do và số placeholder ra, hai entry này còn khác
nhau ở đâu? Nếu không còn gì, chúng là MỘT entry dưới hai cái tên. Từ vựng phình lên theo từng call
site cho tới khi các key mô tả CALL SITE chứ không mô tả HÌNH DẠNG, và danh sách dài hơn cả đoạn code
đọc nó.

**Ranh giới.** Không phải `CONTRACT-3` — xem trên. Không phải `CONTRACT-13`: mã này chặn key thừa LÚC
SINH, mã kia xoá key ĐÃ CHẾT. Không phải `CONTRACT-2` — xem trên.

**Tình huống nghiệp vụ hay gặp.** "Cái này giống card kia nhưng thưa hơn"; "cần đúng cái đó nhưng
loading 4 dòng thay vì 3"; "y hệt nhưng dùng ở trang khác".

## `CONTRACT-10` — contract cố định nội dung; branch sở hữu cơ chế wrapper

**Khi nào gặp.** Nội dung đã có contract, nhưng nó phải nằm trong một vendor wrapper cố định: thân
card, thân accordion, thân list.

**Source phải thể hiện gì.** Cái seam vendor cố định đó được viết như code branch bình thường trong
các surface branch có tên — `SurfaceCard`, `SurfaceListCard`, `SurfaceFormCard` — với contract node
đứng BÊN TRONG content body. Không bảng compound nào, và không node props nào trên `Card.Content`.

**Cách nhận ra.** Bạn định tạo key cho dòng tiêu đề, cho wrapper ngoài và cho caption chỉ để
khỏi phải viết branch; bạn định tạo một bảng "compound" mô hình hoá `Card > Card.Content`; bạn định
spread node props lên `Card.Content`. Tự hỏi: cái seam này có BIẾN ĐỔI THEO CALLER không? Nó có NHẬN
CON không? Nếu cả hai đều không, nó là cơ chế của branch, không phải một từ vựng thứ hai.

Vì sao không có bảng compound: lặp lại `Card > Card.Content` chỉ tốn hai dòng, còn trích nó ra thì
thêm một lớp gián tiếp mà KHÔNG SỞ HỮU CHÍNH SÁCH NÀO. Ngược lại, tạo key cho heading line, wrapper
ngoài và caption sẽ biến MỘT host thành BA contract.

**Ranh giới.** Không phải `CONTRACT-7`: surface branch có tên là ngoại lệ của mã đó, và không branch
nào khác được thế. Không phải `CONTRACT-4`: contract node đứng BÊN TRONG content host, không TRÊN nó —
đây là chỗ hai mã gặp nhau và là chỗ sai nhiều nhất. Không phải `CONTRACT-11`: quan hệ giữa các row
NGANG HÀNG thuộc về root contract, không thuộc về wrapper.

**Tình huống nghiệp vụ hay gặp.** Card có tiêu đề ngoài và caption dưới; accordion có body cuộn;
joined list nằm trong card `p-0`; form card có footer hành động cố định.

## `CONTRACT-11` — entry khai báo mọi slot bên trong, và mỗi slot có tên

**Khi nào gặp.** Bạn đang nói cho entry biết bên trong nó có gì.

**Source phải thể hiện gì.** Một record slot có tên trên entry — `ContractSlots`,
`ContractProjection`, `ContractComponent`, `defineContractComponent` — với identity, tính tuỳ chọn và
lực lượng cho từng slot, cùng union `ContractChildCardinality` / `ChildrenOf` khiến `repeats: true`
mà thiếu `restingCount` không viết ra được.

**Cách nhận ra.** Bạn định dùng `children` theo nghĩa React; định truyền một mảng con THEO THỨ
TỰ; định viết một arrow trực tiếp vào một slot; hoặc bạn có slot lặp mà không nói bao nhiêu placeholder
vẽ lúc chờ. Tự hỏi: nếu ngày mai ai đó chèn thêm một phần tử con vào GIỮA, có gì bị đổi nghĩa trong im
lặng không?

Slot có TÊN, không ĐẾM. Chèn một phần tử con vào danh sách theo vị trí thì mọi vị trí sau nó âm thầm mang
nghĩa khác; một cái tên sống sót qua lần chèn đó, đọc được ngay tại call site mà không phải đếm, và
cho `why` một thứ để nhắc đến.

`repeats: true` nói slot lúc sống là mảng; `restingCount` nói lúc chờ vẽ bao nhiêu placeholder. Độ dài
thật là động, nên không được lẫn với số skeleton. Cặp này bắt buộc đi cùng nhau: không có
`restingCount` trên slot vô hướng, và không có slot lặp nào để trống hình dạng lúc nghỉ.

Với joined list: quan hệ giữa các row ngang hàng thuộc về root contract. Tên miền nghiệp vụ của tập
hợp (`tasks`, `courses`, `alerts`) là FIELD trong kiểu props có tên của content component; một slot
chung tên `items` sẽ dạy cho surface biết mô hình dữ liệu của caller và không thuộc từ vựng branch.
Root của joined list là `p-0`, row là con trực tiếp, nên mọi divider chạm được hai mép. Row contract
trả lại lề `p-4` của card một cách BẤT ĐỐI XỨNG: một row `p-4`; row đầu `px-4 pt-4 pb-3`; row giữa
`px-4 py-3`; row cuối `px-4 pt-3 pb-4`. Cụm label/surface/caption cố định chứa các đơn vị
sở-hữu-và-được-sở-hữu nên dùng `gap-3`.

List host cũng sở hữu fact tuỳ chọn ở cuối dòng label. Fact đó là `xs muted` đứng cạnh label
`sm semibold` và ĐỊNH TÍNH cho chính joined list. Nó không được caller chiếu ra thành sibling riêng,
và không được nhét vào `description`: `description` dành cho caption của cả list, nằm dưới surface.

Đây không phải `children` của React, và chính điều đó làm nó kiểm được. Markup đến nơi thì đã dựng
xong và đã xoá mất hình dạng của chính nó. Sai key, sai props, sai identity, sai số lượng, thiếu slot
và thừa slot đều là LỖI BIÊN DỊCH.

**Ranh giới.** Không phải `CONTRACT-5` — xem trên. Không phải `CONTRACT-10`: `divide-y` ngồi trên
content host, còn row leaf KHÔNG tự vẽ luật `after` và không soi `last-child`. Không phải
`CONTRACT-12`: `props` trong slot là RÀNG BUỘC LITERAL, không phải giá trị bơm lúc chạy; chữ do query
trả về đi qua `props` runtime của render component và KHÔNG BAO GIỜ vào bảng.

**Tình huống nghiệp vụ hay gặp.** Danh sách quest hằng ngày; lưới thẻ khoá học; bảng xếp hạng; danh
sách module có skeleton; dòng label có fact đứng cuối.

## `CONTRACT-12` — class của entry là SẮP XẾP, không phải hành vi và không phải sơn

**Khi nào gặp.** Node cần bấm được, hoặc cần nền, hoặc cần đổ bóng.

**Source phải thể hiện gì.** Một entry chỉ mang sắp xếp. Hành vi chuyển sang branch sở hữu control;
nền và độ nổi chuyển sang component surface vốn đã sở hữu chúng.

**Cách nhận ra.** Entry mang `cursor-*`, `hover:*`, `active:*`, `focus:*`, `group`; entry mang
màu chữ, `underline`, `decoration-*`; entry mang `bg-surface*` hoặc `shadow-*`. Tự hỏi: class này nói
CÁC CON ĐỨNG VỚI NHAU THẾ NÀO, hay nói NODE NÀY PHẢN ỨNG RA SAO / TRÔNG NHƯ CÁI GÌ?

Hai chủ cho một lời hứa. Node mà entry cho `cursor-pointer` + `hover:opacity-80` đang TỰ NHẬN LÀ BẤM
ĐƯỢC, trong khi thứ thật sự bấm — nút, link, control giữ handler và trạng thái disabled — nằm ở chỗ
khác hẳn. Bảng là bên KHÔNG THỂ ĐƯỢC BÁO rằng lời hứa đã tắt: entry không biết call site này không
truyền handler, nên nó cứ vẽ con trỏ lên một thứ chết.

Nền và độ nổi thì có hậu quả riêng. Bảng sẽ chứa HAI LOẠI CARD — một loại do branch vẽ, một loại do
key vẽ — và không key nào nói cho ai biết họ đang nhìn loại nào. Người sau với lấy cái gần tay hơn, và
hôm surface của nhà đổi radius hoặc đổi elevation, chỉ MỘT trong hai loại đổi theo.

Một dải (band) là ngoại lệ đã đóng. Nền đơn thuần chưa làm nên vật thể nổi: một landing page có các
section đổi nền để đếm được vẫn không phải card. Dải chạy HẾT BỀ NGANG và tự kẻ ranh giới với dải kế
tiếp; vật thể thì dừng trước mép và được bao bởi chính nó.

**Ranh giới.** Không phải `CONTRACT-6` — xem trên. Không phải `CONTRACT-10`: surface là một COMPONENT,
không phải một danh sách class; entry vẽ nền và bóng là cách thứ hai để làm ra thứ đã có chủ. Không
phải `CONTRACT-3`: union hiện vẫn CHỨA vài token thuộc họ này — `cursor-pointer`, `group`,
`bg-surface`, `shadow-surface`. Đó là nợ đã đo được nằm phơi ra, không phải giấy phép; nó được tranh
luận trong bản audit.

**Tình huống nghiệp vụ hay gặp.** Row bấm được trong danh sách; card có hover; section landing đổi
nền; hàng có shadow riêng bên trong một card đã có shadow.

## `CONTRACT-13` — key không ai vẽ thì không phải từ vựng

**Khi nào gặp.** Trong bảng có key mà không màn nào render.

**Source phải thể hiện gì.** Chỉ những key với tới được từ một `contract="…"`, một
`defineContractComponent("…")` hoặc từ slot của entry khác mới sống sót trong `CONTRACT_KEYS`. Một
hình dạng chưa dựng thì sinh ra trong plan record thay vì trong bảng.

**Cách nhận ra.** Không `contract="key"`, không `defineContractComponent("key")`, không slot nào
của entry khác gọi; key được thêm "để tuần sau dùng"; key sống sót qua một đợt đổi tên mà không ai
chạm. Tự hỏi: có màn hình nào đang đứng trong tài liệu nhờ key này không?

Key chết không nằm yên. Nó sống qua mọi lần đổi tên, vì đổi tên đi theo call site và nó không có call
site nào. Nó được chép nguyên vào repository kế tiếp, vì bảng đi cả cụm và không có gì trong bảng nói
member nào từng được vẽ. Và nó làm bảng dài hơn đoạn code đọc bảng — tới lúc đó người đọc thôi tin
bảng là mô tả của sản phẩm.

Chỗ đúng của một hình dạng chưa dựng là plan record, nơi một node chưa tồn tại đúng là thứ người đọc
mong gặp; không phải bảng từ vựng, nơi mọi thứ có mặt đều được hiểu là đang trên màn hình.

**Ranh giới.** Không phải `CONTRACT-9` — xem trên. Không phải `CONTRACT-5`: một key chết vì tên nó quá
chung nên không ai với tới cũng là `CONTRACT-5` chưa được sửa.

**Tình huống nghiệp vụ hay gặp.** Key còn lại sau khi một trang bị gỡ; key sinh ra từ một bản preview
chưa được duyệt; key copy sang repository mới cùng cả bảng.

## Tầng giữ

Tầng nào thật sự giữ mỗi mã. `unrepresentable` nghĩa là một union đóng hoặc một branded type làm cho
giá trị sai không viết ra được. `enforced` nghĩa là một rule trong `@canon-fe` bắt được
nó. `documented` nghĩa là không có gì cơ học giữ, chỉ có người đọc giữ.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `CONTRACT-1` | `enforced` | `no-literal-structural-class` — cả attribute trong JSX lẫn hằng số module đã nhấc lên |
| `CONTRACT-2` | `enforced` | `no-class-composition-outside-contract` — `cn`/`clsx`/`twMerge`/`cva` và `className` nội suy |
| `CONTRACT-3` | `unrepresentable` | union `LayoutClassName`; giá trị ngoài union không biên dịch được |
| `CONTRACT-4` | `enforced` | `only-the-frame-wears-a-node`; props của frame không mang host nào để truyền |
| `CONTRACT-5` | `documented` | không gì cả. Người đọc quyết định một cái tên có cố định được các con hay không |
| `CONTRACT-6` | `enforced` | `contract-why-is-a-reason` — sàn độ dài, kèm phép kiểm chép lại chính các chữ trong key |
| `CONTRACT-7` | `enforced` | `no-structural-host-outside-contract-frame` — hộp trung tính thì luôn luôn, element ngữ nghĩa thì từ lúc nó mang class |
| `CONTRACT-8` | `enforced` | `no-hand-written-contract-attrs` |
| `CONTRACT-9` | `enforced` | `no-unknown-contract-key` cho key không tồn tại, `no-duplicate-entry-shape` cho key không nên tồn tại |
| `CONTRACT-10` | `documented` | không gì trực tiếp. Các rule chỉ MIỄN cho các surface branch có tên; không rule nào kiểm rằng thứ chúng sở hữu vẫn còn là cơ chế wrapper |
| `CONTRACT-11` | `unrepresentable` + `enforced` | kiểu record slot, các branded component type, và cặp `repeats`/`restingCount` — cộng `contract-children-are-typed`, rule đọc thẳng chính bảng, vì các kiểu chỉ chi phối component **tiêu thụ** một entry, trong khi entry được viết dưới dạng object literal mà chưa gì gán kiểu cho. Một entry không có `children` nào, hay một slot không nêu danh tính chủ, vẫn là cú pháp object hợp lệ và phía component không với tới được |
| `CONTRACT-12` | `enforced` | `no-interaction-class-in-entry` — họ tương tác, họ sơn và họ vật thể nổi |
| `CONTRACT-13` | `enforced` | `no-dead-contract-key`, chạy trên một lượt duyệt tham chiếu toàn repository |

Chín mã do một rule giữ, hai mã do một type giữ, và hai mã chỉ có người đọc giữ. Hai mã do type giữ
được giữ TỐT HƠN chín mã kia: không có gì để đi tuần khi giá trị sai không gõ nổi. Hai mã do người đọc
giữ — `CONTRACT-5` và `CONTRACT-10` — là phần phơi ra thật sự của module, và chúng được liệt kê lại
như rủi ro còn mở trong bản audit kèm điều một rule sẽ phải nhìn thấy.

Các tầng phải hoàn toàn không biết gì về những chuyện này là các tầng trên frame: block, page và
composite chỉ biết key, không biết gì khác — không class, không host, không marker.

## Điểm neo

Một luật không chỉ được vào code thật thì là đề xuất, không phải luật. Mỗi mã đều nêu một đường dẫn và
nêu phải tìm gì ở đó.

| Mã | Đường dẫn | Tìm gì ở đó |
|---|---|---|
| `CONTRACT-1` | `components/contracts/index.ts` | mảng `classes: [...]` của từng entry — và sự vắng mặt của mọi literal `className=` ở tầng block, page và composite |
| `CONTRACT-2` | toàn bộ cây được cai quản dưới `src/` | không một call site `cn`, `clsx`, `twMerge`, `cva` nào; không một `className` nội suy nào |
| `CONTRACT-3` | `components/contracts/index.ts` → `export type LayoutClassName` | chính cái union; một giá trị ngoài nó thì trượt lúc biên dịch chứ không trượt lúc review |
| `CONTRACT-4` | `components/contracts/index.ts` → `export type ContractHost`; `components/branches/Tree/index.tsx` | `const Host = spec.host ?? "div"` — element đọc ra từ entry, và không `host`/`as` nào trên props của frame |
| `CONTRACT-5` | tên key trong `components/contracts/index.ts` | những cái tên cố định được một phần tử con (`label-fact-over-progress`, `page-header-stack`) đối lại những cái tên chung bị cấm (`card`, `row`) |
| `CONTRACT-6` | `components/contracts/index.ts` → mọi trường `why:` | một câu nêu cái gì vỡ, xuống dòng hay tràn ra khi không có node |
| `CONTRACT-7` | `components/branches/Tree/index.tsx` | đúng một `<Host>` mở ra từ một spec trong toàn cây |
| `CONTRACT-8` | `components/contracts/index.ts` → `contractNodeProps` | `data-node` và `data-why` được sinh ra trong đúng một hàm |
| `CONTRACT-9` | `components/contracts/index.ts` → `export type ContractKey = keyof typeof CONTRACTS` | union key mà một call site bị kiểm đối chiếu |
| `CONTRACT-10` | `components/branches/SurfaceCard`, `SurfaceListCard`, `SurfaceFormCard` | cái seam vendor cố định viết như code branch bình thường, với contract node đứng BÊN TRONG content body |
| `CONTRACT-11` | `components/contracts/props.ts` → `ContractSlots`, `ContractProjection`, `ContractComponent`, `defineContractComponent`; `index.ts` → `ContractChildCardinality`, `ChildrenOf` | record slot có tên, và cái union làm cho `repeats: true` mà thiếu `restingCount` không viết ra được |
| `CONTRACT-12` | `components/contracts/index.ts` → `LayoutClassName` | nợ đang sống phơi ra trước mắt: union vẫn nhận `cursor-pointer`, `group`, `bg-surface`, `shadow-surface` mà rule từ chối trong một entry |
| `CONTRACT-13` | `components/contracts/index.ts` → `CONTRACT_KEYS` | mọi key với tới được từ một `contract="…"`, một `defineContractComponent("…")`, hoặc từ slot của entry khác |

Cả mười ba đều có neo. Neo của `CONTRACT-12` cố ý là neo vào một MÂU THUẪN và được tranh luận trong
bản audit; nó vẫn là một cái neo, vì thứ mà luật nói đến chỉ ra được.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| element | Nó có chứa element khác không, vì đó là thứ làm nó thành node |
| key | Entry mà nó resolve tới, hoặc phát hiện rằng không có entry nào vừa |
| classes | Mảng của entry, mọi member lấy từ union layout đóng |
| host | Element mà entry đặt tên, lấy từ union host đóng |
| slots | Record con có tên, kèm identity, tính tuỳ chọn và lực lượng cho từng slot |
| reason | Cái gì vỡ, xuống dòng, tràn ra hoặc thôi bấm được khi không có node |
| call sites | Mọi chỗ key được vẽ, kể cả slot của một entry khác |

## Quy tắc

1. Class của một node cấu trúc đến từ key của nó và không đến từ đâu khác.
2. Không chuỗi class nào được ghép hay nội suy trong lúc component chạy.
3. Mọi giá trị class là member của union layout đóng.
4. Element thuộc về entry; frame là kẻ duy nhất mặc nó.
5. Đúng một file biến key thành element.
6. Marker contract do chính frame đó phát ra, không bao giờ viết tay.
7. Mọi slot đều có tên; không phần tử con nào được với tới bằng cách đếm.
8. Slot lặp luôn khai resting count, và slot vô hướng không bao giờ khai.
9. Hai entry không bao giờ đánh vần một hình dạng dưới hai cái tên.
10. Class của entry là sắp xếp, không bao giờ là hành vi, là sơn hay là vật thể.
11. Mọi key trong bảng đều được vẽ ở đâu đó.
12. Tên của key cố định thứ được phép nằm bên trong nó.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp vào.

- **Tầng leaf sở hữu ruột của chính nó.** `CONTRACT-1` và `CONTRACT-7`. Leaf bọc MỘT primitive vendor
  và viết đúng phần keo giữ một dòng lại với nhau, nên hai mã đó không với tới nó. Ngoại lệ này là một
  THƯ MỤC, nên nó là ranh giới chính sách chứ không phải một type: ai nộp file vào đó cũng thoát theo
  đường ấy. Còn câu hỏi giữ một vùng ở ngoài — file này có sắp xếp hai nội dung không? — thì
  `no-structural-arrangement-in-leaf` hỏi, bằng cách đọc chính JSX mà leaf mở ra. Thứ nó không đọc được
  là một leaf sắp xếp thông qua một helper hay một prop của vendor, nên thư mục vẫn nhận vào những gì
  không trông có vẻ cấu trúc trong source.
- **Surface branch có tên sở hữu wrapper vendor cố định của nó.** `CONTRACT-10`. Seam đó không biến
  đổi theo caller, không nhận con, và không bao giờ nhận marker contract.
- **Element ngữ nghĩa mở ra vì NGHĨA và không mang class thì không phải node.** `CONTRACT-7`. `form`
  để submit và `ul` là một danh sách; bọc một contract node trong nó không quyết định hình dạng nào
  cả. Ngay khi nó mang một class, nó đã thành node không key.
- **Twin test được dựng markup fixture bằng tay.** `CONTRACT-8`. Source sản phẩm thì không, và một
  test tự spread node props chỉ chứng minh fixture của chính nó chứ không chứng minh gì về sản phẩm.
- **Plan record mang một bản sao của từ vựng.** `CONTRACT-13`. Một bản design candidate chỉ vẽ đúng
  trang nó sinh ra để trả lời, nên phần lớn bản sao đó không ai vẽ — đó chính là ĐỊNH NGHĨA của plan
  record, không phải một danh sách cần xoá.

## Đầu ra

Một block cho mỗi file mà shape đã duyệt sinh ra.

```text
element: <the element being written>
holds-others: <yes | no>
code: <CONTRACT-1 … CONTRACT-13>
key: <existing key | new key justified by a shape | none, this is a leaf>
host: <element the entry names>
slots: <name: identity, per slot>
reason: <what breaks, wraps or overflows without this node>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một panel quest hằng ngày: một card mà thân của nó là một joined list các row
quest, mỗi row là một label có fact tuỳ chọn đứng cuối, và lúc loading thì vẽ bốn row placeholder.

Cái shape KHÔNG nói, và vì thế không giải ở đây: list mở ra element nào, key tên gì, list tồn tại vì
cái gì, có key sẵn nào đã đánh vần đúng cái row chưa, và ai vẽ marker. Những thứ đó giải từ bảng,
không phải từ hình vẽ.

```text
element: the joined list that holds the quest rows
holds-others: yes
code: CONTRACT-11
key: new key justified by a shape — quest-run
host: ul
slots: rows: quest row component, repeats: true, restingCount: 4
reason: without it the rows lose their shared divider and each row draws its own edge, so the dividers stop reaching both sides of the card
```

`reason` của mã: entry khai một slot CÓ TÊN và LẶP kèm resting count, và chính điều đó loại
`CONTRACT-5` — cái tên không còn là thứ duy nhất giữ phần tử con, record slot mới là.

```text
element: the row that holds the label and the trailing fact
holds-others: yes
code: CONTRACT-4
key: existing key — label-fact-over-progress
host: li
slots: label: label leaf; fact: fact leaf, optional
reason: without it the fact drops below the label instead of sitting on its baseline, and the progress bar loses the line it aligns to
```

`reason` của mã: entry TỰ ĐẶT TÊN `li` và frame đọc nó ra từ spec, không caller nào truyền host — và
chính điều đó loại `CONTRACT-7`, vì không ai đang mở thẻ bằng tay.

```text
element: the card body the list sits inside
holds-others: yes
code: CONTRACT-10
key: none, this is a leaf
host: the vendor content body, opened by SurfaceListCard as ordinary branch code
slots: none; the contract node stands inside the content body
reason: the seam does not vary by caller and does not accept children, so it is branch mechanics and never receives contract markers
```

`reason` của mã: contract node đứng BÊN TRONG body vendor thay vì được mặc TRÊN nó — và chính điều đó
loại `CONTRACT-4`, cái lỗi mà node props bị spread lên body vendor rồi mọi gate vẫn xanh trong khi
danh sách đã rời khỏi accessibility tree.

## Phạm vi

Quy tắc này đúng với mọi đoạn code cùng loại trong stack này: bất cứ front end nào giữ một registry
các node layout. Nó không nêu tên sản phẩm, không nêu tên tính năng và không nêu tên repository. Các
đường dẫn trong bảng *Điểm neo* là đường dẫn cây component bình thường, và mọi ví dụ đều là TSX bình
thường.
