---
title: Tokens · Vietnamese
module: tokens
kind: pattern
codes: [TOKEN-1, TOKEN-2, TOKEN-3, TOKEN-4, TOKEN-5, TOKEN-6, TOKEN-7, TOKEN-8, TOKEN-9, TOKEN-10]
---

# Token

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | bộ máy frontend đã phát hành mà bản ghi này viện dẫn |
| `@canon-fe-contracts` | `@starci/eslint-canon-fe/contracts` | npm package | các kiểu contract frontend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã được duyệt — một layout, một block, một surface, một control,
một dấu trạng thái. Quyết định đó coi như đã đóng; file này không mở lại nó. Kết quả là kiến trúc
source: chuỗi class nào được phép viết, tầng file nào được phép viết nó, thành viên mới thêm vào danh
sách nào, stylesheet nào phải định nghĩa biến mà một cái tên đang xin, và component nào sở hữu một
quyết định thay vì ghép nó lại từ các class. Shape nói màn hình trông ra sao. Pattern này nói phần
code giữ nó phải trông ra sao.

## Luật

Token là **thành viên của một tập đóng**. Không phải một giá trị mà mọi người đồng ý là nên dùng — mà
là giá trị duy nhất **gõ ra được**. Một màn hình lệch thang không phải màn hình trượt review; nó là
màn hình **không biên dịch được**.

Vì thế phần lớn luật này do **type** giữ, và phần còn lại tồn tại để phủ đúng những chỗ type với
không tới. Toàn bộ hình dạng module nằm ở chỗ chia đó: **union bảo vệ cái bảng, và rule bảo vệ cái
thư mục mà union không nhìn thấy.**

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi số đo, mọi màu và mọi chiều cao control mà một
màn hình phát ra đều rơi vào đúng một mã dưới đây. Không có giá trị nào nhỏ đến mức được miễn: một
`size-3.5` trên một glyph là `TOKEN-3` đúng theo cái lý mà một mã màu thô là `TOKEN-4`. Câu "có mỗi
một class thôi mà" không phải một ngoại lệ — nó chính là chỗ giá trị lệch thang cuối cùng của một
codebase thật đã sống sót qua mọi rule đang có.

**Thang, đúng như nó vốn có.** Sáu bậc cho seam giữa các thứ, khoảng cách không đều.

| Bậc | Class | Đọc ra là |
|---|---|---|
| 4px | `gap-1` | hai dòng của MỘT danh tính — tên trên handle, con số trên chữ gọi tên nó, tiêu đề trên phụ đề mờ, giá trên caption bổ nghĩa cho nó |
| 8px | `gap-2` | các phần tử ngang hàng, sát nhau, trong một cụm chức năng — glyph với nhãn, các tab ngang hàng, các card gom nhóm, hoặc một input với hành động inline trực tiếp của nó |
| 12px | `gap-3` | quan hệ sở hữu, hoặc các đơn vị cục bộ tự đọc được — nhãn với card/input, field với field, card với caption, toolbar với phần nội dung nó điều khiển, hoặc các nhóm không liên quan chung một hàng |
| 16px | `gap-4` | hai bên mà mỗi bên **đã là** một cụm — một stack trên stack bên dưới, một cụm danh tính đối với dữ kiện ở đầu kia của hàng, một câu hỏi đối với hành động trả lời nó, hoặc các card ngang hàng lặp lại trên một grid |
| 24px | `gap-6` | hai block trên một trang |
| 32px | `gap-8` | seam của layout — một rail đối với cột nằm cạnh nó |

`gap-2` đòi hai sự kiện cùng lúc: các phần tử **ngang** VÀ chúng hợp thành **một cụm chức năng**.
Hỏng một trong hai thì seam là `gap-3`. Token chọn theo quan hệ và cách gom nhóm, không bao giờ theo
tên component hay theo hướng. `gap-4` chỉ chọn theo hai bên tham gia: một khi mỗi bên tự nó đã được
kết hợp, seam giữa chúng phải cao hơn các seam bên trong chúng — trong cột, trong hàng và trong grid
đều như nhau.

**Không có bậc không, và sự vắng mặt đó là cố ý.** "Chạm nhau" và "gần chạm nhau" không phải một phân
biệt mà tác giả thứ hai tái lập lại được từ trí nhớ, nên bề mặt bị thay thế trước đây đã viết cùng
một identity stack theo cả hai kiểu. Chỉ bậc 4px sống sót, và nó sống sót vì nó đặt tên cho một quan
hệ chứ không phải cho một lượng — dòng thứ hai bổ nghĩa cho dòng thứ nhất. Một container không muốn
có seam thì **không khai** class gap nào, và đó là một phát biểu khác với việc gọi tên một bậc đo
bằng không.

**Inset lấy 16px và 24px đối xứng, hoặc 12/8 và 16/12 bất đối xứng.** Và cái quan hệ khiến một bề mặt
lạ trở nên quyết được nằm ngay trong bảng chứ không phải được khẳng định bên trên nó: **surface của
nhà mang inset 16px quanh một seam nội bộ 16px.** Mép thở theo đúng nhịp của nội dung, nên hai thứ đó
là một quyết định chứ không phải hai. Một surface thông thường vì vậy dùng `p-4`. Một surface dạng
joined list giữ nguyên mép ngoài 16px đó mà không pad các đường kẻ: vendor surface và phần chứa nội
dung của nó là `p-0`, gốc danh sách là `p-0`, một row đơn lẻ là `p-4`, còn row đầu / row giữa / row
cuối lần lượt là `px-4 pt-4 pb-3`, `px-4 py-3` và `px-4 pt-3 pb-4`. Khi inset chung được ép bằng
`!important`, gốc joined list phải thắng **ở cùng sức mạnh cascade** bằng một selector ngữ nghĩa
`data-component`; sự có mặt của utility là không đủ, và bằng chứng là computed padding bằng `0px`
trên trang đã render.

**Chiều cao control có hai token, chọn theo vị trí đặt chứ không theo mức quan trọng.**

| Token | Vị trí đặt |
|---|---|
| `sm` | Hành động **nhúng** trong một row, list item, toolbar gọn, cụm card, hoặc trong seam cục bộ của một control khác |
| `md` | Hành động **đứng riêng**, chiếm một dòng hoặc neo cả một form hay một surface |

Trục `variant` giữ độc lập: nó nói hành động là primary, secondary, outline hay tertiary; nó không
chọn chiều cao. Một hành động primary vẫn có thể là `sm` trong một cụm chật, và một hành động
tertiary vẫn có thể là `md` khi nó đứng riêng. Độ dài nhãn không bao giờ đổi token kích cỡ.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `TOKEN-<n>`. Mã đặt tên cho TÌNH HUỐNG; cột yêu cầu
nói source phải trông ra sao một khi tình huống đó đã được nhận ra. Mã được trích dẫn từ các file
luật khác và từ record công việc, nên một con số là vĩnh viễn kể cả khi chữ nghĩa quanh nó đổi.

| Mã | Tình huống | Source phải trông ra sao |
|---|---|---|
| `TOKEN-1` | Cần một giá trị layout không có trong bảng từ vựng | Thang layout là một union đóng, nên giá trị lệch thang **không gõ ra được**. Không bao giờ là chuyện tuần tra bằng quy ước một giá trị mà type lẽ ra đã từ chối |
| `TOKEN-2` | Cần **thêm** thật một giá trị vào bảng từ vựng | Thành viên mới được thêm **có chủ ý**, trong danh sách có tên, ở chỗ diff nhìn thấy. Không bao giờ là một giá trị xuất hiện bên trong một component không ai đọc kỹ |
| `TOKEN-3` | Xuất hiện nửa bậc: `gap-1.5`, `py-1.5`, `size-3.5` | Chỉ bậc nguyên; phân vân thì lấy bậc gần nhất. Không bao giờ có bước thập phân, ở bất kỳ họ nào có đo đạc |
| `TOKEN-4` | Xuất hiện một độ dài trong ngoặc như `[13px]`, hoặc một mã màu thô | Một thành viên của bảng từ vựng, hoặc một token màu ngữ nghĩa. Không bao giờ là độ dài trong ngoặc hay màu thô, kể cả khi hôm nay nó bằng đúng một bậc |
| `TOKEN-5` | Chữ to cộng chữ đậm được ghép tay thành một tiêu đề | Thứ bậc đến từ component sở hữu **cả thẻ lẫn cỡ chữ**. Không bao giờ là chữ to cộng chữ đậm ghép lại từ class thô |
| `TOKEN-6` | Class được viết trong leaf, hoặc bị nhấc lên một hằng số module | Rule đọc chuỗi class **trong source**, kể cả chuỗi đã nhấc lên hằng số module. Không bao giờ giả định rằng thư mục leaf đã được phủ chỉ vì các tầng trên nó đã gõ kiểu |
| `TOKEN-7` | Cần màu ngữ nghĩa: dấu trần, nền mềm, hay nền đặc | Dấu trần dùng `text-*`; một mặt nền ghép `bg-*-soft` với `text-*-soft-foreground`, hoặc `bg-*` với `text-*-foreground`. Không bao giờ dùng token nền `*-soft` làm màu mực |
| `TOKEN-8` | Phải chọn chiều cao cho một control | Kích cỡ chọn theo **vị trí đặt**, variant chọn theo **mức ưu tiên**. Không bao giờ suy chiều cao từ variant, từ số chữ, hay từ việc control trông "to tiếng" đến đâu; không dùng padding tự chế để bóp một control |
| `TOKEN-9` | Một class gọi tên một token mà theme chưa định nghĩa | Cái tên phải là thành viên union **VÀ** biến nó xin phải tồn tại trong stylesheet. Không báo cáo những tên do framework tự phân giải — `screen`, `full`, `fit`, các đơn vị viewport |
| `TOKEN-10` | Một experience render cả trong app boundary cục bộ lẫn document-level portal | Semantic theme variable nằm tại document theme hook chung trong global stylesheet do app sở hữu. Boundary cục bộ được alias hoặc consume chúng, không được là nơi duy nhất định nghĩa chúng |

## Đọc một shape đã duyệt

1. **Đọc cái shape phát biểu.** Nó phát biểu một quan hệ: seam này tách hai cụm, surface này là một
   joined list, hành động này nằm nhúng trong một row, dấu này là một glyph success trần, con số này
   là thứ bậc của card chứa nó.
2. **Gọi tên cái shape không phát biểu, và vì thế không giải quyết.** Một shape không bao giờ nói một
   giá trị pixel, một mã hex, một họ class, một tầng file, một thành viên union, một biến stylesheet
   hay một `variant`. Những thứ đó được giải ở đây, theo mã; và một shape có vẻ đang nói một trong số
   đó là đang bị đọc như một bức ảnh chứ không phải như một quyết định.
3. **Giải từ ngoài vào trong.** Seam của layout trước seam của block, seam của block trước inset của
   surface, inset của surface trước seam bên trong nó — và nhớ rằng mép của một surface với seam bên
   trong nó là **một** quyết định, nên giải xong inset là giải luôn nhịp bên trong. Chỉ sau đó mới
   giải các số đo, màu và chiều cao control ở tầng leaf.
4. **Hỏi câu hỏi của từng mã.** Giá trị này là một kẻ ngoài union (`TOKEN-1`), một thành viên được
   thêm có cân nhắc (`TOKEN-2`), một nửa bậc (`TOKEN-3`), một độ dài tuỳ ý hay một màu thô
   (`TOKEN-4`), một tiêu đề ghép tay (`TOKEN-5`), một chuỗi nằm trong thư mục union không nhìn thấy
   (`TOKEN-6`), một màu dùng sai vai (`TOKEN-7`), một chiều cao control (`TOKEN-8`), hay một tên token
   mà biến của nó có thể không tồn tại (`TOKEN-9`), hay semantic variable chỉ tồn tại dưới một renderer
   sibling cũng cần consume nó (`TOKEN-10`)?
5. **Khi hai mã cùng khớp, tầng file và kiểu hỏng tách chúng ra.** Cùng một `[13px]` là `TOKEN-1` bên
   trong một entry đã gõ kiểu, nơi compiler từ chối nó, và là `TOKEN-4` bên trong một leaf, nơi một
   rule bắt nó. Một control bị bóp bằng padding tự chế vừa là `TOKEN-8` vừa là `TOKEN-4`; mã gốc vẫn
   là `TOKEN-8`, còn giá trị tuỳ ý được báo kèm. Mọi số đo, màu và chiều cao control phát ra đều rơi
   vào đúng **một** mã gốc.

## `TOKEN-1` — thang là một union, nên giá trị lệch thang không gõ ra được

**Khi nào gặp.** Ai đó cần một khoảng cách mà bảng từ vựng không có, và phản xạ đầu tiên là viết đại
`gap-[13px]` rồi đi tiếp.

**Source phải thể hiện gì.** Không sinh ra gì mới. Giá trị đó không được viết, vì nó không phải
thành viên của `LayoutClassName`. Entry lấy bậc gần nhất đang có, hoặc công việc chuyển sang
`TOKEN-2`.

**Cách nhận ra.** Giá trị nằm trong một entry đã gõ kiểu, chứ không nằm trong leaf. Trình biên
dịch đã đỏ trước khi có ai kịp mở review. Không có rule nào phải nói gì về chuyện này cả.

**Ranh giới.** Không phải `TOKEN-4`: cùng một hình dạng giá trị, khác tầng file và khác thứ giữ nó —
trong entry đã gõ kiểu thì compiler từ chối, trong leaf thì union không với tới và rule mới bắt.
Không phải `TOKEN-2`: `TOKEN-1` nói giá trị **không gõ được**; `TOKEN-2` nói muốn gõ được thì phải
làm gì.

**Tình huống nghiệp vụ hay gặp.** Dựng entry cho một card mới · port một màn hình cũ lên tầng entry ·
sửa một seam bị chê chật · nhận một đóng góp từ người mới vào repo.

## `TOKEN-2` — thêm thành viên là sửa thang, và phải đọc ra là như vậy

**Khi nào gặp.** Bảng từ vựng thật sự thiếu một thứ. Việc đúng không phải là né union, mà là mở nó ra
một cách có chủ ý, trong danh sách có tên, ở chỗ mà diff nhìn thấy.

**Source phải thể hiện gì.** Đúng một diff trong chính danh sách từ vựng — cái union các literal —
và tôn trọng lời chú thích bên trên nó: hãy nới danh sách này một cách có chủ ý, để phần thêm vào đọc
ra như một quyết định. Không call site nào được phép là chỗ thành viên mới ra đời.

**Cách nhận ra.** Nhu cầu lặp lại ở nhiều màn hình, không phải một chỗ. Người thêm nói được
**quan hệ** mà bậc mới đặt tên, không chỉ nói được số đo. Thay đổi nằm trong danh sách từ vựng, không
nằm trong một component.

**Ranh giới.** Không phải `TOKEN-1`, vốn chính là hành vi từ chối. Không phải `TOKEN-3`: một nửa bậc
**không bao giờ** là ứng viên thành viên mới, vì thang là các bậc nguyên cách nhau không đều, nên nửa
bậc không nằm giữa hai bậc — nó nằm ngoài thang.

**Tình huống nghiệp vụ hay gặp.** Thêm một breakpoint container · thêm một inset cho một loại surface
mới · nhận về một union song song do repo khác tự mọc ra và phải gộp lại.

## `TOKEN-3` — nửa bậc không nằm giữa hai bậc, nó nằm ngoài thang

**Khi nào gặp.** Một giá trị dạng `x.5` xuất hiện ở bất kỳ họ nào có đo đạc: `gap`, `p`, `m`, `space`,
`size`, `w`, `h`, `inset` và các cạnh của chúng.

**Source phải thể hiện gì.** Một bậc nguyên — bậc gần nhất khi còn phân vân. Pattern `FRACTIONAL`
và rule `noFractionalStep` dựng từ nó giữ điều này trong source sản phẩm.

**Cách nhận ra.** Giá trị có dấu chấm thập phân. Nó được biện minh bằng "cái kia hơi chật một
tí". Tìm cả sản phẩm không ra chỗ thứ hai dùng đúng giá trị đó.

**Ranh giới.** Không phải `TOKEN-4`: `size-3.5` là nửa bậc, `size-[14px]` là giá trị tuỳ ý. Chúng vẽ
ra cùng một thứ và hỏng theo hai kiểu khác nhau, nên chúng là hai mã. Không phải `TOKEN-2`: nửa bậc
không phải một đề xuất thành viên mới.

**Tình huống nghiệp vụ hay gặp.** Căn một glyph cho vừa một dòng chữ · nhích một badge cho khỏi đè ·
thu một control cho lọt vào một row chật · port một số đo lẻ từ ảnh thiết kế.

## `TOKEN-4` — giá trị tuỳ ý thoát khỏi hệ thống, dù nó bằng bao nhiêu

**Khi nào gặp.** Một độ dài trong ngoặc vuông, hoặc một mã màu thô. Được chọn một lần, bởi một người,
cho một màn hình.

**Source phải thể hiện gì.** Với số đo là một thành viên của bảng từ vựng; với màu là một token
màu ngữ nghĩa. `ARBITRARY_LENGTH`, `RAW_COLOUR` và hai message id trong `noArbitraryValue` giữ điều
này — một message cho `length`, một cho `colour`.

**Cách nhận ra.** `[...]` trong một class đo đạc, hoặc `#` trong một class màu. Nó có thể đang
đúng bằng một bậc — và đó chính là cái bẫy. Không ai tìm ra nó khi tra thang, và nó không di chuyển
khi thang di chuyển.

**Ranh giới.** Không phải `TOKEN-1`: cùng hình dạng giá trị, khác tầng file, khác thứ giữ nó. Không
phải `TOKEN-7`: `text-[#16a34a]` là màu thô, còn `text-success-soft` dùng cho một dấu trần là màu ngữ
nghĩa dùng sai vai — một cái đứng ngoài bảng màu, cái kia đứng trong bảng màu nhưng sai vai trò.
Không phải `TOKEN-9`: `max-w-[64rem]` là giá trị tuỳ ý, còn `max-w-app-lg` khi theme chưa có biến là
token chưa phân giải. Cả hai đều hỏng, nhưng chỉ một cái **trông như** đang đúng.

**Tình huống nghiệp vụ hay gặp.** Khớp một màu thương hiệu lấy từ file thiết kế · ghim một chiều rộng
sidebar · chỉnh một shadow cho "giống bản mẫu" · vá gấp một chỗ tràn chữ.

## `TOKEN-5` — thứ bậc đến từ thang chữ, không đến từ tổ hợp ghép tay

**Khi nào gặp.** Chữ to cộng chữ đậm. Đó **là** một heading, dù nó nằm trên thẻ gì.

**Source phải thể hiện gì.** Cái leaf heading, nơi `level` điều khiển thẻ và cỡ chữ như một quyết
định duy nhất. `LARGE_TEXT` và `HEAVY_WEIGHT` được kiểm cùng nhau chính là thứ `noHandRolledHeading`
tìm.

**Cách nhận ra.** Một `span` hoặc `div` mang cả class cỡ lớn lẫn class đậm. Đọc bằng mắt thì nó
là tiêu đề; đọc bằng outline thì nó không tồn tại. Ngày thang chữ đổi, chỗ này ở lại phía sau.

**Ranh giới.** Không phải `TOKEN-4`: `TOKEN-5` không nói gì về việc giá trị có trong thang hay không
— `text-2xl` và `font-bold` **đều** là thành viên hợp lệ; cái sai là ghép chúng lại ở đây. Không phải
`TOKEN-1`: union không cứu được mã này, vì cả hai class đều là thành viên. Thứ bị mất không phải cỡ
chữ mà là **cấu trúc tài liệu**, và cấu trúc thì không nhìn thấy trên ảnh chụp màn hình.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề trong một empty state · số liệu lớn trên một thẻ thống kê ·
tên khoá học trên một card · tiêu đề bên trong một modal · tiêu đề của một section mới thêm gấp.

## `TOKEN-6` — rule tồn tại vì cái thư mục union không nhìn thấy

**Khi nào gặp.** Mọi tầng trên leaf đều lấy class từ một entry đã gõ kiểu, nên union đã giữ chúng.
Leaf **tự viết class của mình** và được miễn luật entry theo chính sách — nên đó là nơi duy nhất một
giá trị lệch thang còn gõ ra được.

**Source phải thể hiện gì.** Một bộ đọc phủ hết thư mục đó: `isSourceFile` và nhánh
`VariableDeclarator` của `classTextVisitors` hiện thực nó, còn `LEAF_DIR_RELATIVE` / `isLeafFile` gọi
tên thư mục được miễn. **Không có gì báo cáo vi phạm mã này** — không rule nào fail được khi phần phủ
bị thiếu, nên khoảng trống ấy nhìn từ bên ngoài là vô hình.

**Cách nhận ra.** File nằm trong thư mục leaf. Class được viết trực tiếp trong markup, hoặc
được nhấc lên một hằng số module. Một rule chỉ đi qua thuộc tính JSX sẽ nhìn thẳng qua hằng số đó.

**Ranh giới.** Không phải `TOKEN-3` và không phải `TOKEN-4`: hai mã kia nói **giá trị nào sai**;
`TOKEN-6` nói **rule phải nhìn vào đâu mới thấy**. Không có `TOKEN-6` thì hai mã kia bỏ sót đúng cái
thư mục mà chúng sinh ra để phủ. Không phải `TOKEN-1`: `TOKEN-1` phủ tầng entry, `TOKEN-6` phủ phần
bù của nó, hai mã cộng lại mới kín. Nhấc lên hằng số là **che**, không phải là được phép — giá trị
lệch thang cuối cùng trong codebase mà bộ rule này được viết cho đã sống trong đúng một hằng số như
vậy.

**Tình huống nghiệp vụ hay gặp.** Thêm một leaf mới · gom class lặp lại thành `const` cho gọn · viết
một bảng `TONE_CLASSES` hay `SIZE_CLASSES` · review một PR chỉ đọc phần JSX.

## `TOKEN-7` — màu ngữ nghĩa được ghép cặp theo mặt nền mang nó

**Khi nào gặp.** Có ba vai, không phải một. Dấu trần dùng `text-success`. Nền mềm ghép
`bg-success-soft` với `text-success-soft-foreground`. Nền đặc ghép `bg-success` với
`text-success-foreground`. Cảnh báo và nguy hiểm theo đúng ba vai đó.

**Source phải thể hiện gì.** Một bảng tone ghép `bg-*-soft` với `text-*-soft-foreground`, và một
dấu trần dùng `text-success` trơn. Không có gì cơ học giữ điều này: ghép cặp là một quan hệ hai class
mà không rule nào trong file rule token đi tìm.

**Cách nhận ra.** Một token có đuôi `-soft` đang đứng ở vị trí màu chữ. Một glyph trần đang
mượn màu vốn dành để làm nền. Trong theme này thì còn đọc được, sang theme kia thì mất tương phản.

**Ranh giới.** Không phải `TOKEN-4`: `TOKEN-7` là **đúng bảng màu, sai vai**, còn `TOKEN-4` là đứng
hẳn ngoài bảng màu. Không phải `TOKEN-1`: union có thể nhận cả hai tên vào, vì cả hai đều là token
hợp lệ; cái sai là **cặp**, và cặp thì không phải một thành viên.

**Tình huống nghiệp vụ hay gặp.** Dấu tích hoàn thành trong một daily quest · badge trạng thái đơn
hàng · dòng cảnh báo hạn thanh toán · mục "Đăng xuất" tô màu nguy hiểm trong một menu · ô thông báo
lỗi của form.

## `TOKEN-8` — kích cỡ theo vị trí đặt, variant theo mức ưu tiên

**Khi nào gặp.** Chọn chiều cao cho một nút. Chỉ có hai token, và cả hai đều đặt tên cho một quan hệ
tái lập được: `sm` là hành động nhúng trong một row, list item, toolbar gọn hay cụm card; `md` là
hành động đứng riêng, chiếm một dòng hoặc neo cả một form.

**Source phải thể hiện gì.** `export type ButtonSize = "sm" | "md"` cùng lời chú thích nói kích cỡ
đi theo vị trí đặt, độc lập với mức ưu tiên thị giác. Union kích cỡ đóng tập ở hai giá trị nên chiều
cao thứ ba là không gõ ra được — nhưng **chọn đúng cái nào trong hai** là một phán đoán về vị trí đặt
mà không có gì kiểm.

**Cách nhận ra.** Cùng một vai trò mà đổi hình học giữa hai màn hình. Chiều cao được suy ra từ
"nút này quan trọng hơn". Có padding tự chế để bóp nhỏ một control.

**Ranh giới.** Không phải `TOKEN-4`: padding tự chế để bóp nút thường kéo theo một nửa bậc hoặc một
giá trị trong ngoặc, lúc đó có hai mã cùng lúc và mã gốc vẫn là `TOKEN-8`. Không phải `TOKEN-1`: tập
kích cỡ đóng ở hai giá trị nên chiều cao thứ ba không gõ được, nhưng chọn sai một trong hai thì vẫn
gõ được — đó là lý do mã này chỉ ở tầng `documented`. Độ dài nhãn không bao giờ đổi token kích cỡ:
một nút chữ dài vẫn là một nút nhúng nếu nó nhúng.

**Tình huống nghiệp vụ hay gặp.** Nút reaction trong một row hoạt động · nút "Áp dụng" cạnh ô mã giảm
giá · nút gửi của một form đăng ký · nút "Xem tất cả" ở góc một card · cụm hành động trong một
toolbar.

## `TOKEN-9` — một class gọi tên token thì chưa có nghĩa gì cho tới khi theme định nghĩa nó

**Khi nào gặp.** `max-w-app-lg` **không phải** một chiều rộng. Nó là một **yêu cầu** gửi tới biến
`--container-app-lg`. Khi biến đó không tồn tại: class vẫn được phát ra, element vẫn render, và không
có chỗ nào đỏ.

**Source phải thể hiện gì.** Một cái tên là thành viên union **VÀ** một stylesheet định nghĩa biến
nó xin — phía rule là `TOKEN_CLASS_FAMILIES` và `TAILWIND_OWN_NAMES`, phía theme là các biến
`--container-app-*` mà các tên `max-w-app-*` đang xin. Do `no-unresolved-token-class` giữ.

**Cách nhận ra.** Tên class đọc như một token của nhà, thuộc họ có thể suy ra tên biến. Union
chấp nhận tên đó, nên compiler hài lòng. Trang lặng lẽ mất số đo của mình.

**Ranh giới.** Không phải `TOKEN-1`: đây chính là giá trị chết duy nhất mà union không bắt được, và
nó tệ hơn một giá trị lệch thang đúng vì lý do đó — giá trị lệch thang không biên dịch được, còn cái
này qua mọi cổng và lên production. Không phải `TOKEN-4`: một giá trị tuỳ ý đứng ngoài hệ thống, còn
cái này trông như đang đúng. Những tên do framework tự phân giải nằm ngoài phạm vi: `screen`, `full`,
`fit`, `auto`, `none`, `min`, `max`, `prose`, `px` và các đơn vị viewport không hứa gì về theme này,
và báo cáo chúng sẽ đẩy người viết đi định nghĩa một biến không ai đọc — đo trên hai repository ở lần
chạy đầu tiên: hai finding, cả hai đều sai, cả hai đều là danh sách này.

**Tình huống nghiệp vụ hay gặp.** Đổi tên một container token · xoá một biến theme tưởng là không ai
dùng · copy một layout entry sang app khác trong monorepo · dựng app mới mà quên chép phần theme.

## `TOKEN-10` — một theme owner phải phủ mọi renderer root của cùng experience

**Khi nào gặp.** App đặt semantic colour variable dưới một visual boundary cục bộ trong khi vendor menu,
drawer, popover hay overlay được render làm document sibling của boundary đó. Variable vẫn tồn tại nên
`TOKEN-9` đạt trong app, nhưng surface qua portal rơi về màu vendor.

**Source phải thể hiện gì.** Khai semantic palette cùng light/dark hook trong global stylesheet do app sở
hữu, tại document ancestor gần nhất dùng chung cho routed content và renderer-owned portal. Theme boundary
cục bộ được alias grammar role, đặt typography hay consume palette; component và mechanics branch không
được nhân raw colour để vá riêng một portal.

**Cách nhận ra.** Routed content có đúng accent nhưng dropdown hay drawer lại xanh; dark mode đổi document
ground nhưng để boundary cục bộ trong suốt hoặc giữ content role sáng; selector ở component sửa được một
overlay nhưng portal khác vẫn fallback.

**Ranh giới.** Không phải `TOKEN-9`: mọi variable có thể tồn tại mà vẫn bị scope dưới một consumer, nên
unresolved-token gate vẫn xanh. Không phải `VENDOR-2`: mechanics branch có thể sở hữu portal lifecycle đúng;
`TOKEN-10` sở hữu nơi semantic variable mà branch consume phải reachable. Embed cố ý độc lập và đã khai
theme owner riêng nằm ngoài mã này.

**Tình huống nghiệp vụ hay gặp.** Account dropdown · locale menu · modal · drawer · tooltip · toast render
ngoài app subtree cục bộ · dashboard dark mode có body và content boundary không cùng theme.

## Tầng giữ

Tầng nào thật sự giữ mã nào. Một rule chỉ được gọi tên ở chỗ đã tìm thấy và đọc được nó trong
`tokens.mjs`; mọi chỗ còn lại là `documented`, và khoảng trống đó là một **phép đo**, không phải một
thất bại.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `TOKEN-1` | `unrepresentable` | Union đóng `LayoutClassName`. `gap-[13px]` không bị từ chối; nó **không phải thành viên** |
| `TOKEN-2` | `documented` | Không có gì cơ học. Union từ chối được người ngoài; nó không phán được rằng một thành viên mới đã được cân nhắc hay chưa |
| `TOKEN-3` | `enforced` | `no-fractional-step` |
| `TOKEN-4` | `enforced` | `no-arbitrary-value` (hai message: `length` và `colour`) |
| `TOKEN-5` | `enforced` | `no-hand-rolled-heading` |
| `TOKEN-6` | `documented` | Không có gì báo cáo vi phạm của nó. `isSourceFile` và visitor `VariableDeclarator` trong `tokens.mjs` HIỆN THỰC nó; không rule nào fail được khi phần phủ bị thiếu |
| `TOKEN-7` | `documented` | Không có gì cơ học. Ghép cặp là quan hệ hai class mà không rule nào trong `tokens.mjs` đi tìm |
| `TOKEN-8` | `documented` | Union kích cỡ đóng tập ở hai giá trị nên chiều cao thứ ba là không gõ ra được — nhưng CHỌN cái nào trong hai là phán đoán về vị trí đặt mà không có gì kiểm |
| `TOKEN-9` | `enforced` | `no-unresolved-token-class` |
| `TOKEN-10` | `documented` | Browser computed-style proof giữa routed content và một renderer-owned portal; chưa có static rule published chứng minh cascade reach |

Bốn mã `enforced`, một mã `unrepresentable`, năm mã `documented`. Type từ vựng sở hữu tầng entry, còn
thư mục leaf đứng ngoài nó theo chính sách; file rule sở hữu source sản phẩm dưới `src/`, và tooling
cùng config đứng ngoài toàn bộ chuyện này vì chúng không render gì.

## Điểm neo

Chỗ có thể đối chiếu từng mã với code thật. Đường dẫn tính theo repository: `starci-eslint/packages/fe/…` là chính
trust tree này, `src/…` là một repository front-end tiêu thụ nó.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `TOKEN-1` | `@canon-fe-contracts` · `components/contracts/index.ts` | `export type LayoutClassName` — một union các literal, trong đó có sáu bậc gap |
| `TOKEN-2` | `@canon-fe-contracts` | Lời chú thích bên trên union: hãy nới danh sách này có chủ ý, để phần thêm vào đọc ra như một quyết định trong diff |
| `TOKEN-3` | `@canon-fe` | Pattern `FRACTIONAL` và rule `noFractionalStep` dựng từ nó |
| `TOKEN-4` | `@canon-fe` | `ARBITRARY_LENGTH`, `RAW_COLOUR`, và hai message id trong `noArbitraryValue` |
| `TOKEN-5` | `@canon-fe` · `components/leaves/Heading/index.tsx` | `LARGE_TEXT` và `HEAVY_WEIGHT` được kiểm cùng nhau; và cái leaf nơi `level` điều khiển thẻ với cỡ chữ như một quyết định |
| `TOKEN-6` | `@canon-fe` · `@canon-fe` | `isSourceFile`, nhánh `VariableDeclarator` của `classTextVisitors`; và `LEAF_DIR_RELATIVE` / `isLeafFile`, chỗ gọi tên thư mục được miễn |
| `TOKEN-7` | `components/leaves/IconTile/index.tsx` · `components/leaves/RankDeltaCaret/index.tsx` | Một bảng tone ghép `bg-*-soft` với `text-*-soft-foreground`; và một dấu trần dùng `text-success` trơn |
| `TOKEN-8` | `components/leaves/Button/index.tsx` | `export type ButtonSize = "sm" \| "md"` và lời chú thích nói kích cỡ đi theo vị trí đặt, độc lập với mức ưu tiên thị giác |
| `TOKEN-9` | `@canon-fe` · `app/globals.css` | `TOKEN_CLASS_FAMILIES` và `TAILWIND_OWN_NAMES`; và các biến `--container-app-*` mà các tên `max-w-app-*` đang xin |
| `TOKEN-10` | `app/globals.css` · một mechanics portal branch có tên | Document theme hook định nghĩa semantic palette một lần; computed style trong routed content và portalled surface resolve cùng accent và mode pair |
| inset pairing | `app/globals.css` · `components/branches/SurfaceListCard/index.tsx` | `.card { padding: calc(var(--spacing) * 4) !important }` đứng cạnh `.card[data-component="SurfaceListCardSurface"] { padding: 0 !important }` — ngoại lệ ngữ nghĩa ở cùng sức mạnh |
| joined-list rows | `components/contracts/index.ts` | Các entry mang `p-0`, `[&>*]:px-4`, `[&>*]:py-3`, `[&>*:first-child]:pt-4`, `[&>*:last-child]:pb-4` |

Hai hàng cuối neo những quyết định mà luật phẳng đã nói bằng văn xuôi nhưng chưa đánh số. Chúng được
liệt kê ở đây để các quyết định đó vẫn kiểm được; chúng **không phải** mã mới.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| chuỗi class | Đúng phần chữ literal, dù viết trong markup, nhấc lên hằng số module, hay nằm trong một mảng entry |
| tầng | File nằm trong thư mục nào — tầng entry đã gõ kiểu, hay thư mục leaf tự viết class của mình |
| bảng từ vựng | Các thành viên union hiện tại, đọc từ chính union chứ không đọc từ trí nhớ |
| theme | Stylesheet định nghĩa các biến mà một tên token đang xin, cùng mọi renderer root consume các biến đó |
| vị trí đặt | Với một control: nhúng trong một row hay một cụm, so với đứng riêng và chiếm một dòng |
| vai trò | Với một màu: dấu trần, nền mềm, hay nền đặc |

## Token opt-in từ render contract

Scale mặc định đóng vẫn không đổi. Schema 6 render contract được chọn các typed local variant
`Heading.scale="display"`, `Text size="metric-lead"` và `Button size="lg"`; variant table do leaf sở hữu phát token.
`lg` chỉ dành cho standalone page-root primary CTA, còn action trong row/card/toolbar vẫn là `sm` hoặc `md`.
Call site không được viết utility mới hay arbitrary value để bắt chước bất kỳ opt-in nào.

## Quy tắc

1. Giá trị layout lệch thang là **không gõ ra được**, không phải chỉ là bị từ chối.
2. Một thành viên mới của bảng từ vựng là một diff trong danh sách có tên, không bao giờ là một giá
   trị được đưa vào tại call site.
3. Không số đo nào lấy bước thập phân, ở bất kỳ họ nào.
4. Không độ dài trong ngoặc vuông và không màu thô nào xuất hiện trong source sản phẩm, dù nó ra giá
   trị bao nhiêu.
5. Thứ bậc do component sở hữu cả thẻ lẫn cỡ chữ phát ra, không bao giờ ghép lại từ class.
6. Một rule đọc chuỗi class thì đọc cả hằng số lẫn markup.
7. Một token nền không bao giờ được dùng làm token màu chữ.
8. Kích cỡ đến từ vị trí đặt và variant đến từ mức ưu tiên; hai trục không bao giờ chọn hộ nhau.
9. Một class gọi tên token của theme chỉ phân giải được khi stylesheet định nghĩa biến của nó.
10. Mép của một surface và seam bên trong nó là **một** quyết định.
11. Mọi số đo, màu và chiều cao control phát ra đều rơi vào đúng **một** mã.
12. Semantic theme variable được routed content và renderer-owned portal consume phải nằm tại document
    theme hook chung trong global stylesheet do app sở hữu; boundary cục bộ không bao giờ là owner duy nhất.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Selector theo vị trí trong entry.** `TOKEN-1` nhận các thành viên dạng `[&>*]:px-4` **chỉ** trong
  bảng entry và không ở đâu khác, vì một joined list phải pad từng row mà không được pad đường kẻ
  giữa các row.
- **Tên do framework tự phân giải.** `TOKEN-9` không áp cho `screen`, `full`, `fit`, `auto`, `none`,
  `min`, `max`, `prose`, `px` hay các đơn vị viewport. Chúng không hứa gì về theme này, và báo cáo
  chúng sẽ đẩy người viết đi định nghĩa một biến không ai đọc.
- **Không tìm thấy stylesheet.** `TOKEN-9` **im lặng** thay vì tuyên bố mọi token đã chết. Một bộ đọc
  không tìm ra theme thì không có bằng chứng, và không có bằng chứng thì không có finding.
- **Chỉ đọc source sản phẩm.** `TOKEN-3`, `TOKEN-4`, `TOKEN-5` và `TOKEN-9` đọc file dưới `src/`.
  Tooling và config nằm ngoài phạm vi, vì chúng không render gì.
- **Cùng sức mạnh cascade.** Khi inset chung được ép bằng `!important`, sở thích dùng utility của
  `TOKEN-1` phải nhường cho một selector ngữ nghĩa `data-component` — một utility không thắng nổi một
  khai báo important, và bằng chứng của ngoại lệ này là computed padding trên trang đã render.
- **Parity trạng thái.** Áp cho mọi mã: skeleton và nội dung thật dùng chung mọi token. Đổi inset hay
  đổi kích cỡ control khi đang tải là nói dối về quan hệ, và làm layout nhảy khi dữ liệu về.

## Đầu ra

Một block cho mỗi file mà shape đã duyệt sinh ra, và một block cho mỗi giá trị bên trong file đó mà
pattern này giải.

```text
value: <the class or token as written>
tier: <entry | leaf>
code: <TOKEN-1 … TOKEN-10>
holder: <unrepresentable | enforced:<rule-name> | documented>
verdict: <member | replace with <member> | define <variable> | pair with <token>>
reason: <the fact that excludes the adjacent code>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một surface chứa một joined list các row; mỗi row mang một cụm danh tính bên
trái, một dấu success nhỏ, và một hành động "Áp dụng" nhúng ở đầu cuối; surface nằm trong một cột bị
giới hạn theo container lớn của app.

Shape chỉ phát biểu quan hệ. Nó **không** nói giá trị pixel của inset từng row, không nói mã hex của
dấu success, không nói chiều cao của hành động, không nói tầng file nào chứa những thứ đó, cũng không
nói theme có định nghĩa biến container hay không — nên không thứ nào trong số đó được shape giải, và
tất cả chúng được giải ở đây.

File entry, `components/contracts/index.ts`:

```text
value: p-0
tier: entry
code: TOKEN-1
holder: unrepresentable
verdict: member
reason: the surface is a joined list, so the outer 16px edge is carried by the rows, not by an inset that would also inset the dividers
```

```text
value: [&>*]:px-4
tier: entry
code: TOKEN-1
holder: unrepresentable
verdict: member
reason: a positional selector in the entry table is the closed exception to TOKEN-1, so this is not the arbitrary-value situation of TOKEN-4
```

```text
value: max-w-app-lg
tier: entry
code: TOKEN-9
holder: enforced:no-unresolved-token-class
verdict: define --container-app-lg
reason: the name is a union member, so the compiler is satisfied — which excludes TOKEN-1 and leaves only the missing stylesheet variable
```

File leaf, `components/leaves/StatusMark/index.tsx`:

```text
value: text-success
tier: leaf
code: TOKEN-7
holder: documented
verdict: member
reason: the mark is bare, with no plate behind it, which excludes the bg/foreground pairing and excludes TOKEN-4 because the token is in the palette
```

```text
value: size-3.5
tier: leaf
code: TOKEN-3
holder: enforced:no-fractional-step
verdict: replace with size-4
reason: the value is a half step rather than a bracketed length, which is what separates it from TOKEN-4
```

File leaf, `components/leaves/Button/index.tsx`:

```text
value: sm
tier: leaf
code: TOKEN-8
holder: documented
verdict: member
reason: the action is embedded at the trailing end of a row, and placement alone selects the height — its priority does not, which excludes any variant-driven reading
```

## Phạm vi

Quy tắc này đúng với mọi code cùng loại trong stack này: mọi front end đóng bảng từ vựng class của
mình trong một type. Nó không gọi tên sản phẩm nào, feature nào hay thư viện component nào. Mọi ví dụ
đều là TSX thông thường với chuỗi class thông thường. Bảng Điểm neo trích đường dẫn theo repository
như là BẰNG CHỨNG rằng luật kiểm được — những đường dẫn đó không phải một phần của bảng từ vựng mà
luật định nghĩa.
