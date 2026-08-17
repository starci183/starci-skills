---
title: Icon · Vietnamese
---

# Icon

Đầu vào là một shape đã có người duyệt — một layout, một block, một row, một chip, một plated tile.
Quyết định đó đã đóng, module này không mở lại. Đầu ra là kiến trúc source: file nào giữ glyph, tầng
nào được phép gọi tên thư viện glyph, người gọi được nói gì, icon leaf phải sở hữu gì, và source phải
trông ra sao sau khi shape đã hạ xuống code.

## Luật

Icon là **một ý nghĩa sản phẩm đã đóng**, được vẽ ra qua **một** bộ từ vựng glyph duy nhất. Người gọi
nói glyph đó NGHĨA LÀ GÌ và nó đang làm VIỆC GÌ; chỉ riêng icon leaf mới chọn hình vẽ cụ thể.

Câu hỏi phân loại vai trò là: **nó đang mở đầu một vùng nội dung, đang dẫn một control hay một row
bình thường, hay đang nằm trong một chip gọn?** Glyph heading không phải glyph leading phóng to, và
glyph chip cũng không phải một trong hai bản kia thu nhỏ. Bộ từ vựng đã vẽ những bản riêng cho từng
việc, ở đúng optical size đó, và CSS không phục hồi được hình học chưa từng có trong đường vẽ.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi glyph một màn hình vẽ ra đều có một tình huống ở
dưới, và tình huống đó có một mã. "Chỉ có mỗi cái caret thôi mà" không phải một trường hợp được miễn —
đó chính là ca đã sinh ra luật này: một leaf import thẳng từ package glyph, ở một size lệch cả hai bậc
và trong một cut mà icon leaf không hề cung cấp, và không có gì báo cả.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `ICON-<n>`. Mã gọi tên TÌNH HUỐNG; nó không phải một
component, một kích thước hay một tên package.

| Mã | Tình huống | Source phải trông ra sao |
|---|---|---|
| `ICON-1` | Chọn vai trò cho một glyph | Đúng ba vai trò ngữ nghĩa: `heading`, `leading`, `chip`. Không có vai trò thứ tư; người gọi không truyền px, không truyền class size, không truyền weight |
| `ICON-2` | Glyph mở đầu một vùng nội dung | Glyph heading là bản 24 outline ở `size-6`. Không lấy artwork mini hay micro phóng vào hộp heading |
| `ICON-3` | Glyph dẫn một row, tab, field hay icon control | Glyph leading là bản outline ở `size-5`. Không dùng trọng lượng heading, không dùng nén kiểu chip, cho điều hướng, row, field và icon control bình thường |
| `ICON-4` | Glyph nằm trong một chip đã có vỏ riêng | Glyph chip là bản 16 solid micro nguyên bản ở `size-4`. Không thu nhỏ glyph 24 outline; không dùng family mini 20px làm chip |
| `ICON-5` | Glyph nằm trong vùng đang mang state (disabled, muted, selected) | Glyph vẽ bằng `currentColor`. Không glyph sản phẩm nào mang màu riêng |
| `ICON-6` | Một màn cần một hình chưa có | Chỉ icon leaf được gọi tên thư viện glyph; người gọi gọi tên ý nghĩa. Không import component glyph tại call site, và không có đường thứ hai vào thư viện từ một file cạnh bên |
| `ICON-7` | Có người muốn thêm một bộ icon nữa | Chỉ hai family: 24 outline và 16 solid. Không package glyph nào khác, kể cả bên trong icon leaf; không lấy hình gần giống trong package tổng hợp làm brand mark |
| `ICON-8` | Row hẹp lại, chữ dài ra | Mọi vai trò mang `shrink-0`. Không glyph nào được méo khi row chật |
| `ICON-9` | Thêm một ý nghĩa mới vào sản phẩm | Bảng nguồn sở hữu việc chọn ý nghĩa → hình, và tên, map, bảng đổi cùng lúc. Không hai ý nghĩa không liên quan dùng chung một hình; không có dòng cũ hay dòng thiếu |
| `ICON-10` | Ô số liệu, mục tiêu, nhãn loại, caption streak hay cell dữ kiện | Một dữ kiện nghiệp vụ gọn mà reference chỉ có chữ thì giữ nguyên chữ. Không thêm glyph trang trí vào đó |
| `ICON-11` | Glyph nằm trên một plate (icon tile) | Mọi plated icon tile vẽ glyph `leading` ở `size-5`; chỉ plate đổi. Không suy vai trò glyph từ kích thước plate |
| `ICON-12` | Một row tóm tắt đứng một mình dưới một heading | Glyph leading thuộc về một tập peer khác loại — lựa chọn hoặc đích đến. Không đặt glyph leading lên một row tóm tắt hay một header đã được section gọi tên |
| `ICON-13` | Reaction của người dùng | Reaction sản phẩm là artwork đã check-in kèm attribution, truyền bằng identity qua reaction leaf. Không emoji Unicode, không đường dẫn ảnh hay `<img>` do người gọi truyền, không import bộ artwork đó như một catalogue glyph |

`ICON-1` LÀ MÃ MÀ MỌI MÃ KHÁC TREO VÀO. Vai trò là tên ngữ nghĩa, không phải cách viết tắt của style.
Một khi người gọi được nói "cỡ này" thay vì "việc này", `ICON-2`, `ICON-3` và `ICON-4` chẳng còn gì để
mà đúng nữa: một bậc thứ ba xuất hiện, nó được chọn vì một lý do chỉ đúng trên một màn, và mọi người
sau đó cứ chép lấy bậc gần nhất trong ba bậc.

## Đọc một shape đã duyệt

1. Đọc xem shape nói gì. Nó nói glyph đứng ở đâu: trước một heading vùng, trước một row hay một
   control, bên trong vỏ chip, trên một plate, trong một ô số liệu, trong một reaction picker.
2. Đọc xem shape KHÔNG nói gì, và vì thế không giải quyết gì. Shape không bao giờ nói package glyph,
   family, kích thước px, độ dày nét hay màu. Đó không phải những câu hỏi còn mở mà shape để lại cho
   người gọi — chúng thuộc về icon leaf, và người gọi mà trả lời chúng chính là cái sai mà `ICON-1` và
   `ICON-6` mô tả.
3. Giải từ ngoài vào trong. Vùng trước row, row trước chip, plate trước glyph. Plate là khoảng thở của
   bề mặt; vai trò của glyph do vị trí của nó trong nội dung quyết định, không phải do đường kính cái
   đĩa nó đứng lên.
4. Hỏi câu hỏi của từng mã, theo thứ tự. Đây là một công việc hay một kích thước (`ICON-1`)? Nó mở đầu
   một vùng (`ICON-2`), dẫn một dòng (`ICON-3`), hay nằm trong một vỏ đã tự vẽ ranh giới (`ICON-4`)?
   Màu này là của ai (`ICON-5`)? Được import ở đâu (`ICON-6`) và được import cái gì (`ICON-7`)? Khi row
   hết chỗ thì cái gì nhường (`ICON-8`)? Bảng nguồn đã sở hữu ý nghĩa này chưa (`ICON-9`)? Chữ ngay bên
   cạnh đã đóng ý nghĩa đó rồi phải không (`ICON-10`)? Cái đang đổi là plate hay là vai trò (`ICON-11`)?
   Có peer nào để phân biệt không (`ICON-12`)? Tôi đang truyền một identity hay một tài nguyên
   (`ICON-13`)?
5. Khi hai mã cùng khớp, chúng đang trả lời hai câu hỏi khác nhau và cả hai đều đúng. `ICON-3` nói
   leading vẽ bằng gì; `ICON-12` nói nó có được phép xuất hiện không. `ICON-6` nói package được import ở
   đâu; `ICON-7` nói package nào. `ICON-9` nói hình nào; `ICON-12` nói có nên vẽ không. Có một dòng
   trong bảng nguồn không phải giấy phép đặt glyph ở mọi chỗ. Thoả mã cấm trước, rồi mới đến mã vẽ.

## `ICON-1` — ba vai trò, không có bậc thứ tư

**Tình huống.** Người gọi cần một glyph. Thứ họ được phép quyết định là VIỆC glyph đang làm, chứ không
phải kích thước của nó.

**Nó sinh ra gì trong source.** Một union vai trò đóng lại còn ba tên — `heading`, `leading`, `chip` —
và một map vai trò → class nằm trong icon leaf. Prop shape của leaf không có ô nào cho size, class hay
màu, nên vai trò thứ tư không compile được và một giá trị px không có đường nào để đi vào.

**Dấu hiệu nhận biết.** Có người muốn truyền `size`, một class `size-*`, một `strokeWidth` hay một con
số px. Có người mô tả nhu cầu bằng "to hơn một chút", "nhỏ hơn cái kia". Xuất hiện một bậc nằm giữa hai
bậc đang có.

**Ranh giới.** Không phải `ICON-2`/`ICON-3`/`ICON-4`: mã này nói có đúng ba vai trò; ba mã kia nói mỗi
vai trò vẽ bằng bản nào. Không phải `ICON-11`: plate to hay nhỏ không phải một vai trò — đó là kích
thước của cái đĩa, không phải của glyph.

**Tình huống nghiệp vụ hay gặp.** Một caret trong disclosure · icon trong nút · icon đầu row menu ·
icon trong empty state · icon cạnh nhãn trạng thái.

## `ICON-2` — glyph mở đầu một vùng

**Tình huống.** Glyph đứng trước một tiêu đề vùng, một empty state, một khối giới thiệu. Nó GIỚI THIỆU
chứ không DẪN.

**Nó sinh ra gì trong source.** Khối import 24 outline trong icon leaf, và một entry `heading` đọc là
`size-6 shrink-0`.

**Dấu hiệu nhận biết.** Bên cạnh nó là một heading thật, không phải một dòng chữ trong danh sách. Vùng
đó có thể rỗng, và lúc rỗng glyph là thứ đầu tiên người đọc thấy. Bỏ glyph đi thì vùng vẫn đúng, chỉ
khó định vị hơn.

**Ranh giới.** Không phải `ICON-3`: heading không phải leading phóng to — hai bản vẽ khác nhau, không
phải cùng một bản ở hai cỡ. Không phải `ICON-4`: lấy bản micro rồi cho nó cái hộp 24px là ca sai kinh
điển — hộp đúng, nét sai.

**Tình huống nghiệp vụ hay gặp.** Empty state của một danh sách · header của một section lớn · panel
giới thiệu tính năng · màn hình lỗi toàn trang.

## `ICON-3` — glyph dẫn một control hoặc một row

**Tình huống.** Glyph đứng trước chữ trong điều hướng, list row, field, switch, icon control. Nó dẫn
lối, không đòi trọng lượng của một heading.

**Nó sinh ra gì trong source.** Một entry `leading` đọc là `size-5 shrink-0`, chọn từ đúng khối import
outline mà `heading` dùng.

**Dấu hiệu nhận biết.** Nó lặp lại nhiều lần trong cùng một cây, mỗi lần một ý nghĩa khác. Nó nằm cùng
dòng với chữ, không đứng trên chữ. Bỏ nó đi thì cả cụm vẫn đọc được, chỉ chậm hơn khi quét mắt.

**Ranh giới.** Không phải `ICON-2`: xem trên. Không phải `ICON-12`: mã này nói leading VẼ BẰNG GÌ;
`ICON-12` nói leading ĐƯỢC PHÉP XUẤT HIỆN Ở ĐÂU. Một row tóm tắt đứng một mình vẫn là `size-5` nếu có
glyph — nhưng `ICON-12` bảo nó không nên có.

**Tình huống nghiệp vụ hay gặp.** Tab điều hướng · row trong menu tài khoản · icon trong ô input · nút
chỉ có icon · dropdown item · breadcrumb.

## `ICON-4` — glyph trong một chip

**Tình huống.** Chip đã có vỏ riêng: nền, bo góc, padding. Glyph bên trong chỉ còn việc đọc được ở kích
thước rất nhỏ.

**Nó sinh ra gì trong source.** Một khối import 16 solid riêng, alias theo từng ý nghĩa, và một entry
`chip` đọc là `size-4 shrink-0`.

**Dấu hiệu nhận biết.** Vỏ chip đã tự nói ranh giới; glyph không cần nét mảnh để "nhẹ" nữa. Ở `size-4`,
nét outline 24 bị nhoè thành một vệt xám. Bản micro có ít chi tiết hơn hẳn — đó là chủ ý của người vẽ,
không phải thiếu sót.

**Ranh giới.** Không phải `ICON-2`: hai đầu đối lập của cùng một sai lầm — một bên phóng bản nhỏ, một
bên ép bản lớn. Không phải family `mini` 20px: mini không phải chip, kích thước gần đúng không phải là
family đúng.

**Tình huống nghiệp vụ hay gặp.** Badge trạng thái · tag đã lọc · nút đóng trên chip · chip số lượng ·
nhãn "mới" · pill hiển thị tiến độ.

## `ICON-5` — glyph thừa hưởng màu

**Tình huống.** Glyph nằm trong một vùng đang mang state: disabled, muted, selected, theme tối. Màu của
nó thuộc về vùng đó, không thuộc về nó.

**Nó sinh ra gì trong source.** `stroke="currentColor"` trên những glyph vẽ cục bộ. Trong file brand,
một mark giữ bốn hex fill được vẽ sẵn còn mark đơn sắc dùng `currentColor` — ngoại lệ và luật nằm cạnh
nhau.

**Dấu hiệu nhận biết.** Chữ bên cạnh đổi màu theo state, glyph thì không. Có người viết `text-*` hoặc
`fill="#..."` ngay trên glyph để "cho hợp". Ở theme tối, glyph vẫn còn màu của theme sáng.

**Ranh giới.** Brand mark là ngoại lệ đóng: một mark nhiều màu được nhận ra NHỜ những màu đó, đổi màu
là đổi mark; mark đơn sắc vẫn dùng `currentColor`. Không phải `ICON-13`: artwork reaction vốn nhiều màu
và không phải glyph ngữ nghĩa, nó nằm ngoài mã này.

**Tình huống nghiệp vụ hay gặp.** Icon trong nút disabled · icon trong tab đang chọn · icon trong
callout lỗi · icon nhà cung cấp đăng nhập · icon trong menu hover.

## `ICON-6` — người gọi nói ý nghĩa, không nói vendor

**Tình huống.** Một màn cần một hình mà bản đồ ý nghĩa chưa có. Đường tắt là import thẳng từ package
glyph ngay tại chỗ.

**Nó sinh ra gì trong source.** `starci-fe/no-vendor-icon-outside-icon-leaf` — package glyph được khớp
theo prefix, nên một subpath không thể lách qua — cùng với đúng một module path được phép trong
[`starci-eslint/packages/fe/icon.mjs`](../../../../starci-eslint/packages/fe/icon.mjs).

**Dấu hiệu nhận biết.** Trong một file màn hình có `import { XxxIcon } from "..."`. Một file "phụ trợ"
cạnh icon leaf cũng import package đó "cho tiện". Cùng một khái niệm được vẽ bằng hai hình khác nhau ở
hai màn.

**Ranh giới.** Không phải `ICON-7`: mã này là ĐƯỢC IMPORT Ở ĐÂU; `ICON-7` là ĐƯỢC IMPORT CÁI GÌ. Một
file đúng chỗ mà gọi sai package thì `ICON-6` im lặng, `ICON-7` mới bắt. Không phải `ICON-9`: khi không
có ý nghĩa nào khớp, đáp án là thêm một ý nghĩa, chứ không phải import.

**Tình huống nghiệp vụ hay gặp.** Màn mới cần một mũi tên · file brand cần thêm một mark · một block
"tạm dùng" một icon khác · code copy từ ví dụ trên mạng.

## `ICON-7` — một vendor, hai family

**Tình huống.** Có người muốn thêm một bộ icon nữa: đẹp hơn, đủ hình hơn, hoặc "chỉ dùng đúng một cái
thôi".

**Nó sinh ra gì trong source.** `starci-fe/heroicons-is-the-glyph-vendor` — một allow set gồm hai
package, áp dụng cả bên trong icon leaf, tức là đúng nửa phần mà `ICON-6` không nhìn thấy, với ngoại lệ
rank được luồn qua cả hai rule vendor.

**Dấu hiệu nhận biết.** Trong `package.json` xuất hiện một thư viện glyph thứ hai. Một brand mark được
chọn từ một package tổng hợp thay vì vẽ đúng. Có người lập luận "cái này bên kia không có" — đúng, và
đó chính là lúc phải quyết định về Ý NGHĨA, không phải về PACKAGE.

**Ranh giới.** Không phải `ICON-6`: xem trên. `ICON-7` áp dụng CẢ BÊN TRONG icon leaf, chỗ mà `ICON-6`
cố ý không nhìn. Ngoại lệ artwork giải thưởng là đúng một file, đúng một package, đúng bốn identity;
cái thứ năm vẫn bị báo — ngoại lệ đó là một bộ từ vựng, không phải một cánh cửa.

**Tình huống nghiệp vụ hay gặp.** Thêm icon mạng xã hội · icon huy hiệu/giải thưởng · icon minh hoạ
marketing · icon file type · logo đối tác.

## `ICON-8` — glyph không bao giờ co lại

**Tình huống.** Một row flex hẹp dần: tên dài, ngôn ngữ dịch dài ra, màn hình nhỏ lại.

**Nó sinh ra gì trong source.** `shrink-0` được nướng sẵn vào cả ba chuỗi class của ba vai trò — kể cả
`chip`, cái hay bị cho là quá nhỏ để phải bận tâm.

**Dấu hiệu nhận biết.** Icon tròn biến thành hình bầu dục. Icon vuông bị dẹt ở một phía. Chữ vẫn còn
nguyên trong khi glyph đã méo — tức là thứ tự nhường đang ngược.

**Ranh giới.** Không phải `ICON-1`: co méo không tạo ra một vai trò mới, nó chỉ phá vai trò đang có.
Không phải luật text-expansion: chữ dài ra thì wrap hoặc truncate, đó là việc của chữ, không phải của
glyph.

**Tình huống nghiệp vụ hay gặp.** Row có tên rất dài · nút có label dịch dài · breadcrumb trên mobile ·
chip trong một hàng cuộn ngang · toast có nhiều chữ.

## `ICON-9` — bảng nguồn sở hữu việc chọn hình

**Tình huống.** Thêm hoặc đổi một ý nghĩa. Câu hỏi "hình nào cho ý nghĩa này" có đúng một chỗ trả lời.

**Nó sinh ra gì trong source.** Bảng tính năng nằm cạnh union ý nghĩa và glyph map, trong cùng một thư
mục, được cập nhật bằng tay. Bài test parity mà luật phẳng tuyên bố là có thì **không tìm thấy trong
source** — nó được luật gọi tên nhưng chưa neo được vào đâu.

**Dấu hiệu nhận biết.** Union ý nghĩa có tên mới nhưng bảng nguồn thì chưa. Hai ý nghĩa khác nhau trỏ
về cùng một hình "vì trông cũng hợp". Bảng còn tên một component đã đổi tên từ lâu.

**Ranh giới.** Không phải `ICON-6`: `ICON-6` chặn đường tắt, `ICON-9` mô tả con đường chính. Không phải
`ICON-12`: bảng nói HÌNH NÀO, `ICON-12` nói CÓ NÊN VẼ HAY KHÔNG. Có dòng trong bảng không phải giấy
phép đặt glyph ở mọi chỗ.

**Tình huống nghiệp vụ hay gặp.** Thêm một mục điều hướng · đổi tên một tính năng · gộp hai tính năng ·
thêm một trạng thái mới cho bài học.

## `ICON-10` — dữ kiện nghiệp vụ gọn thì để nguyên chữ

**Tình huống.** Một ô số liệu, một mục tiêu, một nhãn loại, một caption streak, một cell dữ kiện — mà
reference gốc CHỈ CÓ CHỮ.

**Nó sinh ra gì trong source.** `starci-fe/no-decorative-icon-in-metric-cell`, buộc vào đúng một
composite path, nên rule giữ đúng cái cell đó và không cell nào khác. Composite nó buộc vào render một
label, một con số và một thanh bar, không có glyph nào.

**Dấu hiệu nhận biết.** Glyph đang lặp lại đúng thứ mà chữ ngay cạnh đã nói (một quyển sách cạnh chữ
"Nội dung"). Trong một lưới, mỗi ô mọc một glyph khác nhau và tạo ra MỘT TRỤC THỊ GIÁC THỨ HAI. Người
thêm glyph giải thích bằng "cho đỡ trống", không phải bằng "để phân biệt".

**Ranh giới.** Ngoại lệ đóng: các ngữ nghĩa generic về state/action mà reference thật sự có — complete,
failed, pending, close, disclosure — vẫn được giữ. Điều hướng, entry point có tên và heading của vùng
rỗng lớn vẫn giữ glyph reference, vì ở đó glyph là một phần của việc ĐỊNH VỊ vùng. Không phải
`ICON-12`: mã này nói về ô dữ kiện LẶP LẠI, `ICON-12` nói về row ĐỨNG MỘT MÌNH.

**Tình huống nghiệp vụ hay gặp.** Ô tiến độ khoá học · mục tiêu tuần · nhãn loại nội dung · caption
chuỗi ngày học · lưới thống kê hồ sơ.

## `ICON-11` — plate đổi, glyph không đổi

**Tình huống.** Glyph nằm trên một đĩa nền (icon tile). Đĩa có hai bậc; glyph thì không.

**Nó sinh ra gì trong source.** Hai bậc plate trong size map của tile, và ngay dưới đó một dòng truyền
`role: "leading"` vô điều kiện, nên mọi plated tile đều vẽ glyph `leading` ở `size-5`.

**Dấu hiệu nhận biết.** Có người muốn glyph "to theo" khi plate to lên. Cùng một ý nghĩa xuất hiện ở
hai màn với hai trọng lượng khác nhau, chỉ vì plate khác nhau. Người gọi đang tự suy ra role từ `size`
của tile.

**Ranh giới.** Không phải `ICON-1`: plate không phải một vai trò thứ tư. Không phải `ICON-2`: một tile
lớn vẫn không biến glyph thành heading — heading là VỊ TRÍ TRONG NỘI DUNG, không phải đường kính của
cái đĩa.

**Tình huống nghiệp vụ hay gặp.** Row khoá học có tile · quick action list · row thông báo · card tính
năng · item trong menu có nền.

## `ICON-12` — leading phải phân biệt được peer

**Tình huống.** Glyph leading chỉ có nghĩa khi nó giúp nhận ra MỘT mục giữa NHIỀU mục khác loại. Một
row tóm tắt đứng một mình thì không có peer nào để phân biệt.

**Nó sinh ra gì trong source.** Ba recipe trong composite fact-row; recipe peer là ca đúng của mã này.
Recipe label-led đã render fact phụ nhỏ và muted **mà vẫn vẽ một glyph** — đúng nửa phần của mã này mà
source chưa giữ được. Khi một shape rơi vào mã này, source render label chính bình thường và fact phụ
đứng cuối để `text-xs muted`, không có glyph.

**Dấu hiệu nhận biết.** Trong cả section chỉ có MỘT row mang glyph. Section đã có heading nói đúng khái
niệm mà glyph đang lặp lại. Cả tập là đồng nhất — mười row cùng loại — nên glyph giống nhau ở mọi row
cũng không phân biệt được gì.

**Ranh giới.** Không phải `ICON-3`: `ICON-3` là VẼ BẰNG GÌ, `ICON-12` là CÓ ĐƯỢC VẼ KHÔNG. Không phải
`ICON-10`: `ICON-10` bảo vệ ô dữ kiện LẶP LẠI, `ICON-12` bảo vệ row ĐƠN LẺ. Một cái là lưới, một cái là
dòng.

**Tình huống nghiệp vụ hay gặp.** Row "Tổng số bài" dưới heading "Kỹ năng" · dòng tổng tiền dưới heading
"Thanh toán" · một dòng trạng thái duy nhất trong panel · header của một card đã có tiêu đề.

## `ICON-13` — reaction là artwork, không phải glyph

**Tình huống.** Người dùng bày tỏ cảm xúc. Đây là ARTWORK BIỂU CẢM của sản phẩm, không phải một ký hiệu
giao diện.

**Nó sinh ra gì trong source.** Một danh sách identity đóng nằm trong reaction leaf, và những file
artwork đã check-in với attribution đi kèm; call site chỉ truyền identity.

**Dấu hiệu nhận biết.** Có người định render emoji Unicode "cho nhanh". Một call site truyền đường dẫn
ảnh hoặc `<img>`. Có người muốn import cả bộ artwork đó như một catalogue glyph thứ hai.

**Ranh giới.** Không phải `ICON-7`: đây là một biên artwork HẸP, nó không mở thêm vendor glyph; điều
hướng, state và action vẫn thuộc bộ từ vựng duy nhất. Không phải `ICON-5`: artwork nhiều màu là bản
chất của nó, nên `currentColor` không áp dụng. Emoji Unicode bị từ chối vì font mỗi nền tảng vẽ khác
nhau — cùng một reaction sẽ là hai hình khác nhau trên hai máy.

**Tình huống nghiệp vụ hay gặp.** Reaction dưới bài viết · reaction trong feed hoạt động · tóm tắt số
lượng reaction · picker chọn reaction.

## Tầng giữ

Icon leaf sở hữu vendor, family, hình vẽ và kích thước; mọi tầng gọi phải hoàn toàn không biết gì về cả
bốn thứ đó. Còn đây là tầng thực sự đang giữ từng mã hôm nay: `unrepresentable` nghĩa là một union đóng
hay một prop shape làm cho giá trị sai không viết ra được; `enforced` nghĩa là một rule trong
[`starci-eslint/packages/fe/icon.mjs`](../../../../starci-eslint/packages/fe/icon.mjs) báo được, và rule đó được gọi tên ngay ở đây;
`documented` nghĩa là chỉ người đọc giữ.

| Mã | Tầng | Cái gì đang giữ |
|---|---|---|
| `ICON-1` | `unrepresentable` | Union vai trò đóng lại còn ba tên, và prop shape của leaf không có ô nào cho size, class hay màu, nên vai trò thứ tư không compile được và giá trị px không có đường vào. Phần dư — một `size-*` lệch scale viết trên bất kỳ element nào — còn được `starci-fe/no-off-scale-glyph-size` báo thêm |
| `ICON-2` | `documented` | Không có gì mang tính cơ học ghép `heading` với bản 24 outline; cặp đôi đó sống trong một map bên trong leaf, và một twin test chỉ khẳng định cái hộp `size-6` |
| `ICON-3` | `documented` | Cùng map đó, cùng sự vắng mặt đó: bậc `size-5` là một dòng source không rule nào đọc |
| `ICON-4` | `documented` | Không rule nào phân biệt family 16 solid micro với một glyph 24 outline đặt trong hộp `size-4`; hai thứ sinh ra CSS y hệt nhau |
| `ICON-5` | `documented` | Glyph thừa hưởng màu vì leaf vẽ nó như vậy, không phải vì có thứ gì từ chối một fill hard-code |
| `ICON-6` | `enforced` | `starci-fe/no-vendor-icon-outside-icon-leaf` — package glyph khớp theo prefix, nên một subpath không lách qua được |
| `ICON-7` | `enforced` | `starci-fe/heroicons-is-the-glyph-vendor` — áp dụng cả bên trong icon leaf, tức là nửa phần mà `ICON-6` không nhìn thấy |
| `ICON-8` | `documented` | `shrink-0` được nướng vào chuỗi class của mọi vai trò; một glyph viết tay đứng ngay cạnh thì không có gì giữ |
| `ICON-9` | `documented` | Map và bảng nằm cùng thư mục và được cập nhật bằng tay. Bài test parity mà luật phẳng tuyên bố là có thì không tìm thấy trong source |
| `ICON-10` | `enforced` | `starci-fe/no-decorative-icon-in-metric-cell` — buộc vào đúng một composite path, nên rule giữ đúng cell đó và không cell nào khác |
| `ICON-11` | `documented` | Plate leaf truyền `leading` trong một dòng; không có gì ngăn một plated leaf thứ hai chọn khác đi |
| `ICON-12` | `documented` | Peer là một phán đoán về cả một tập, và không rule nào đọc được một tập |
| `ICON-13` | `documented` | Các identity reaction là một tập đóng trong leaf; không rule nào từ chối một pictograph Unicode hay một đường dẫn tài nguyên tại call site |

CÓ NĂM RULE, BỐN MÃ MỖI MÃ MANG MỘT. Rule thứ năm, `starci-fe/rank-artwork-is-a-closed-set`, canh một
ngoại lệ có tên của `ICON-7` — một file, một package, bốn identity artwork — và chính comment của nó
lại trích `ICON-11`, mã mà trong luật này nghĩa là plated tile. Va chạm số hiệu đó là thật, và nó được
GHI LẠI chứ không được sửa bằng cách đánh số lại, vì một mã đã có người trích dẫn thì không thể lặng lẽ
đổi nghĩa.

## Điểm neo

Chỗ có thể đối chiếu từng mã với code thật. Đường dẫn dưới `src/` là source sản phẩm front-end; đường
dẫn dưới `starci-eslint/packages/fe/` là các rule trong trust tree này.

| Mã | Đường dẫn | Nhìn cái gì |
|---|---|---|
| `ICON-1` | `src/components/leaves/Icon/index.tsx` · `src/components/contracts/props.ts` | Union ba tên vai trò và map vai trò → class; prop shape của leaf đúng gồm `props`, `on`, `isLoading` — và do đó không có chỗ nào để viết một size |
| `ICON-2` | `src/components/leaves/Icon/index.tsx` · `src/components/leaves/Icon/index.test.tsx` | Khối import 24 outline; entry `heading` đọc là `size-6 shrink-0`; twin test khẳng định `size-6` |
| `ICON-3` | `src/components/leaves/Icon/index.tsx` | Entry `leading` đọc là `size-5 shrink-0`, chọn từ đúng khối import outline mà `heading` dùng |
| `ICON-4` | `src/components/leaves/Icon/index.tsx` | Khối import 16 solid riêng, alias theo từng ý nghĩa, và entry `chip` đọc là `size-4 shrink-0` |
| `ICON-5` | `src/components/leaves/Icon/index.tsx` · `src/components/leaves/Icon/brands.tsx` | `stroke="currentColor"` trên những glyph vẽ cục bộ; trong file brand, một mark giữ bốn hex fill được vẽ sẵn còn mark đơn sắc dùng `currentColor` — ngoại lệ và luật nằm cạnh nhau |
| `ICON-6` | `starci-eslint/packages/fe/icon.mjs` | `noVendorIconOutsideIconLeaf`; đúng một module path được phép; danh sách package khớp theo prefix |
| `ICON-7` | `starci-eslint/packages/fe/icon.mjs` | `heroiconsIsTheGlyphVendor`; allow set hai package; ngoại lệ rank luồn qua cả hai rule vendor |
| `ICON-8` | `src/components/leaves/Icon/index.tsx` | Cả ba chuỗi vai trò đều kết thúc bằng `shrink-0` — kể cả `chip`, cái hay bị cho là quá nhỏ để phải bận tâm |
| `ICON-9` | `src/components/leaves/Icon/icon.md` · `src/components/leaves/Icon/index.tsx` | Bảng tính năng nằm cạnh union ý nghĩa và glyph map, trong một thư mục. Bài test parity mà luật gọi tên: chưa neo được |
| `ICON-10` | `starci-eslint/packages/fe/icon.mjs` · `src/components/composites/LabelledProgressRow/index.tsx` | `noDecorativeIconInMetricCell` và đường dẫn nó buộc vào; composite đó render một label, một con số và một thanh bar, không glyph |
| `ICON-11` | `src/components/leaves/IconTile/index.tsx` | Hai bậc plate trong size map, và một dòng ngay dưới truyền `role: "leading"` vô điều kiện |
| `ICON-12` | `src/components/composites/IconLabelFactRow/index.tsx` | Ba recipe; recipe peer là ca đúng của mã này. Recipe label-led đã render fact phụ nhỏ và muted **mà vẫn vẽ một glyph** — nửa phần của mã mà source chưa giữ được |
| `ICON-13` | `src/components/leaves/ReactionPicker/index.tsx` · `public/reactions/` | Danh sách identity đóng trong leaf; sáu file artwork đã check-in và attribution đi kèm chúng |

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| meaning | Một tính năng, trạng thái hay hành động sản phẩm đã có sẵn trong bảng nguồn |
| role | Mở đầu một vùng, dẫn một control/row bình thường, hay nằm trong một chip gọn |
| placement | Tập mà glyph đang đứng trong đó: peer, một row tóm tắt đơn lẻ, một ô số liệu lặp lại, một plated tile |
| reference | Reference được nêu tên thực sự vẽ gì ở chỗ đó — chỉ có chữ, hay có glyph |
| container | Node bao quanh đang mang state nào: disabled, muted, selected, themed |

## Quy tắc

1. Người gọi nói ý nghĩa và vai trò; icon leaf sở hữu vendor, family, hình vẽ và kích thước.
2. Một ý nghĩa ứng với một hình, và một hình phục vụ một ý nghĩa.
3. Vai trò không suy ra từ kích thước plate, kích thước container, viewport hay density.
4. Glyph thừa hưởng màu; một identity mark giữ đúng những màu làm nên identity đó.
5. Glyph không bao giờ co lại; chữ nhường trước.
6. Glyph chỉ xuất hiện ở nơi nó phân biệt được một thứ mà chữ chưa đóng lại.
7. Một mã tình huống ứng với đúng một yêu cầu, và không yêu cầu nào phục vụ hai mã.
8. Các bộ từ vựng artwork — reaction, giải thưởng — là tập đóng do đúng một leaf sở hữu, không bao giờ
   là catalogue.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp dụng
vào.

- **Identity mark giữ màu của nó** (`ICON-5`). Một mark chính xác của nhà cung cấp hay của nhà được
  nhận ra nhờ chính màu của nó; đổi màu là tạo ra một mark khác. Mark đơn sắc vẫn dùng `currentColor`.
- **Identity mark là SVG cục bộ** (`ICON-7`). Brand được vẽ đúng, từ một file trong thư mục icon —
  không bao giờ lấy hình gần giống nhất trong một package tổng hợp thay thế.
- **Ngữ nghĩa generic có trong reference thì được giữ** (`ICON-10`). Complete, failed, pending, close
  và disclosure là những ý nghĩa mà một reference gọn thật sự mang. Điều hướng, entry point có tên của
  tính năng và heading của vùng rỗng lớn vẫn giữ glyph reference, vì ở đó glyph là một phần của việc
  định vị vùng.
- **Artwork reaction** (`ICON-13`). Một tập đóng gồm artwork sản phẩm, do một leaf sở hữu, truyền bằng
  identity. Đó là một biên artwork hẹp và nó không mở ra một bộ từ vựng glyph thứ hai.
- **Artwork giải thưởng** (`ICON-7`, theo ngoại lệ rank trong source lint). Đúng một file được gọi tên
  thêm một package, cho bốn identity artwork và không có cái thứ năm. Nó bị chặn ở cả ba phía cùng lúc,
  và nó được ghi lại như một quyết định đưa ra khi đã biết rằng đường check-in mới là cơ chế mạnh hơn.

## Đầu ra

Mỗi quyết định glyph mà shape đã duyệt sinh ra thì một khối.

```text
meaning: <feature, state or action from the source map>
role: <heading | leading | chip>
situation: <ICON-1 … ICON-13>
placement: <peers | lone summary | metric cell | plated tile | chip | heading region>
decision: <the glyph that is drawn, or the decision to draw none>
reason: <the business fact that excludes the adjacent code>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một section mở đầu bằng một heading kèm một glyph giới thiệu, rồi một danh sách
các row đích khác loại nhau, mỗi row có một glyph dẫn và mang một chip trạng thái, và dưới danh sách là
một row tóm tắt đứng một mình nêu con số tổng.

Shape nói vị trí: vùng heading, các row peer, chip nằm trong vỏ, row tóm tắt đơn lẻ. Nó KHÔNG nói
package, family, kích thước px, độ dày nét hay màu, và vì thế không giải quyết gì trong số đó — những
thứ ấy thuộc về icon leaf, không phải câu hỏi còn mở mà shape để lại.

```text
meaning: the section's named feature
role: heading
situation: ICON-2
placement: heading region
decision: the 24 outline drawing at size-6 shrink-0, from the leaf's outline import block
reason: it stands in front of a region heading that can be empty, not in front of one line in a list — that excludes ICON-3
```

```text
meaning: each destination in the list
role: leading
situation: ICON-3
placement: peers
decision: the outline drawing at size-5 shrink-0, one drawing per meaning from the source map
reason: the rows are a heterogeneous set of destinations, so the glyph distinguishes one from its peers — that excludes ICON-12
```

```text
meaning: the row's status
role: chip
situation: ICON-4
placement: chip
decision: the native 16 solid micro drawing at size-4 shrink-0, from the separate solid import block
reason: the chip shell already draws the boundary and the box is 16px, so the 24 outline stroke would smear — that excludes ICON-2 and the 20px mini family
```

```text
meaning: the total stated by the summary row
role: leading
situation: ICON-12
placement: lone summary
decision: no glyph; the label renders normally and the trailing fact renders text-xs muted
reason: it is the only row of its kind in the section and the heading already names the concept, so there is no peer to distinguish — that excludes ICON-10, which protects repeated fact cells rather than a lone row
```

## Phạm vi

Module này nêu một luật đúng với bất kỳ front end nào. Nó không gọi tên sản phẩm, repository, component
library hay registry key nào. Nó CÓ gọi tên một glyph vendor, vì lựa chọn vendor đóng chính là nội dung
của `ICON-7`; thay bằng vendor của bạn thì mọi mã còn lại vẫn đọc y như cũ. Mọi ví dụ đều là TSX bình
thường.

MỘT IDENTIFIER ĐÃ SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một rule được trích bằng đúng tên đã
công bố của nó, kèm cả prefix plugin, vì đó là chuỗi chính xác mà một build log in ra và một disable
comment mang theo. Một trích dẫn không dán được vào ô tìm kiếm thì không phải trích dẫn. Thứ mà lệnh
cấm ở trên chặn là VĂN XUÔI và VÍ DỤ cần biết một sản phẩm mới hiểu được — không bao giờ là một
identifier mà ai đó sẽ đọc thấy trong một lỗi và phải đi tra.
