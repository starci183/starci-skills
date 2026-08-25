---
title: Vendor boundary · Vietnamese
---

# Ranh giới vendor

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | bộ máy frontend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã được duyệt — một overlay, một field, một block điều hướng, một
liên kết, một thẻ. Chuyện nó trông ra sao đã chốt xong, pattern không mở lại. Kết quả là kiến trúc
source: file nào giữ import HeroUI, file nào giữ class nhìn thấy, file đó phải export cái gì, và nó
không bao giờ được nhận cái gì. HeroUI sở hữu cơ chế tương tác; contract của StarCi sở hữu hình dạng
nhìn thấy. Một import vendor chỉ hợp lệ ở nơi quyền sở hữu ấy gọi được tên và test được.

## Luật

HeroUI sở hữu cơ chế tương tác; contract của StarCi sở hữu hình dạng nhìn thấy. Một import vendor chỉ
hợp lệ ở nơi quyền sở hữu ấy gọi được tên và test được.

## Mã tình huống

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `VENDOR-1` | Một file bất kỳ trong tầng component với tay sang HeroUI | Leaf, các mechanics branch có tên, và họ SurfaceCard có tên là những chủ sở hữu HeroUI duy nhất ở tầng component. Cấm import vendor trong block, layout, overlay, page, composite hoặc branch không liên quan |
| `VENDOR-2` | Một mechanics branch đang tồn tại, hoặc có người đề xuất một tầng wrapper chung | `ModalBranch`, `DrawerBranch` và `DropdownBranch` mỗi cái bọc đúng primitive tương tác vendor của nó. Cấm mechanics branch rỗng và cấm mọi thư mục `components/shells` |
| `VENDOR-6` | Một overlay đã duyệt có phần ruột cuộn được | `ModalBranch` sở hữu đúng một vùng cuộn `Modal.Body` không inset. Cấm thiếu body, cấm chồng padding giữa body và contract |
| `VENDOR-7` | Shape có một ô nhập văn bản | `Field` của nhà dùng HeroUI Input `variant="secondary"`. Cấm dựng một bề mặt input mặc định cạnh tranh |
| `VENDOR-8` | Một overlay đã duyệt chứa nội dung trông như thẻ | Overlay dùng thẳng heading, hàng, khoảng cách và control. Cấm đặt một SurfaceCard branch có tên thứ hai bên trong một overlay vốn đã được đóng khung |
| `VENDOR-9` | Một field muốn ra hiệu nó nhận loại giá trị gì | Nhãn của field vẫn thuần chữ. Cấm icon trang trí suy ra từ kiểu input |
| `VENDOR-10` | Shape có một liên kết | `TextLink` bọc `Link` của HeroUI. Cấm hành vi liên kết kiểu raw-button và cấm dựng lại hover/underline tại chỗ |
| `VENDOR-11` | Điều hướng mang theo một menu tài khoản | `DropdownBranch` sở hữu cơ chế Dropdown; `AccountMenu` sở hữu các lựa chọn; `ShellNav` ghép block. Cấm giải phẫu vendor rò vào block và cấm hành động tài khoản trực tiếp trong điều hướng |
| `VENDOR-12` | Một overlay auth đã duyệt cần chỗ chứa nội dung | Overlay auth chiếu đúng một content contract có tên vào cơ chế `ModalBranch` không inset. Cấm trùng lặp Tree/content host và cấm inset dọc thứ hai |
| `VENDOR-13` | Một checkbox có nhãn | Control và Indicator của Checkbox nằm bên trong Checkbox Content. Cấm nhãn nhìn thấy nằm ngoài vùng bấm của checkbox |
| `VENDOR-14` | Shape điều hướng sang một chỗ khác bên trong StarCi | Điều hướng nội bộ báo một action lên code routing đã nối. Cấm giá trị `href` nội bộ StarCi trong leaf hay component |
| `VENDOR-15` | Shape trình bày hàng và cột dưới dạng bảng | `TableBranch` sở hữu HeroUI `Table` cùng các bộ phận compound và chiếu vào những ô đã validate. Cấm `<table>` thô trong tầng component và cấm dựng tay một lưới thay thế |

Module này công bố mười hai mã. Các số `VENDOR-3`, `VENDOR-4` và `VENDOR-5` không được công bố ở đây;
đừng tự nghĩ ra chúng để lấp chỗ trống.

## Đọc một shape đã duyệt

1. Đọc xem shape nói gì: nó là bề mặt nào, chứa những gì, mở và đóng ra sao, người đọc bấm được cái gì.
2. Gọi tên những gì shape không nói. Shape không nói file nào giữ import HeroUI, tầng nào giữ padding,
   hay component phải export gì. Những thứ đó shape không giải quyết, và phải do các mã ở đây giải.
3. Giải từ ngoài vào trong. Container overlay hay điều hướng được giải trước các hàng bên trong nó, vì
   chính kết quả ở vòng ngoài quyết định phần bên trong đã được đóng khung hay chưa.
4. Lần lượt hỏi câu hỏi của từng mã: shape này có cơ chế vendor, vùng cuộn, ô nhập, vùng trông như
   thẻ, liên kết, menu tài khoản, checkbox hay điều hướng nội bộ không?
5. Khi hai mã cùng khớp thì chúng không phải hai lựa chọn thay nhau — mỗi mã gọi tên một file khác.
   `VENDOR-2` và `VENDOR-6` cùng ràng buộc `ModalBranch`: một mã bảo nó phải bọc primitive vendor, mã
   kia bảo `Modal.Body` của nó không inset và chỉ có một. Áp cả hai. Chỉ ở chỗ một mã nói rằng thứ đó
   *đã được đóng khung rồi* — `VENDOR-8` bên trong overlay — thì kết quả vòng ngoài mới chặn kết quả
   vòng trong.

## `VENDOR-1` — Chủ sở hữu vendor ở tầng component

**Khi nào gặp.** Một file tầng component trong shape đã duyệt cần đến HeroUI.

**Source phải thể hiện gì.** Import HeroUI đáp xuống một leaf, một mechanics branch có tên, hoặc họ
SurfaceCard có tên — không chỗ nào khác. Mọi file còn lại trong shape nhận kết quả từ những chủ sở hữu
đó, chứ không nhận giải phẫu vendor.

**Cách nhận ra.** Một import `@heroui/react` nằm trong block, layout, overlay, page, composite,
hoặc một branch không phải chủ sở hữu cơ chế có tên.

**Ranh giới.** Đây không phải `VENDOR-2`. `VENDOR-1` hỏi import vendor được phép sống ở đâu;
`VENDOR-2` hỏi một file đã nhận danh nghĩa sở hữu cơ chế có thật sự sở hữu cơ chế nào không.

**Tình huống nghiệp vụ hay gặp.** Một block marketing với tay lấy Button của HeroUI; một page kéo Card
của HeroUI để dựng phần tóm tắt; một feature branch import Chip vendor vì nhanh hơn là thêm một leaf.

## `VENDOR-2` — Các mechanics branch có tên

**Khi nào gặp.** Shape mở ra, đóng lại, portal hoặc đặt vị trí một thứ gì đó, hoặc có người đề xuất một
tầng wrapper chung cho nó.

**Source phải thể hiện gì.** `ModalBranch`, `DrawerBranch` và `DropdownBranch`, mỗi cái bọc đúng
primitive tương tác vendor của nó. Không có mechanics branch rỗng, và không có thư mục
`components/shells` — mọi thư mục như vậy đều là drift và đã bị xóa.

**Cách nhận ra.** Một branch đứng ở vị trí cơ chế nhưng không import vendor; một thư mục mới lập
ra để chứa "wrapper"; một đường dẫn `components/shells` xuất hiện lại.

**Ranh giới.** Đây không phải `VENDOR-1`. `VENDOR-1` soi những file import vendor mà không có quyền;
`VENDOR-2` soi những file có quyền mà chẳng import gì — giữ đặc quyền nhưng không giữ cơ chế nào.

**Tình huống nghiệp vụ hay gặp.** Thêm một drawer cho bộ lọc trên mobile; thêm một dropdown đổi ngôn
ngữ; một đợt refactor đề xuất tầng wrapper dùng chung "cho các overlay đồng bộ".

## `VENDOR-6` — Một modal body duy nhất, không inset

**Khi nào gặp.** Overlay đã duyệt có phần ruột cuộn được.

**Source phải thể hiện gì.** `ModalBranch` giữ đúng một `Modal.Body` và body đó không mang inset;
padding ở lại trong contract. Thiếu body cũng sai, mà chồng padding giữa body và contract cũng sai.

**Cách nhận ra.** Hai vùng cuộn trong một overlay; `className="p-4"` trên `Modal.Body`; nội dung
đặt thẳng vào `Modal` mà không có body.

**Ranh giới.** Đây không phải `VENDOR-12`. `VENDOR-6` ràng buộc body và inset trong file cơ chế;
`VENDOR-12` ràng buộc thứ mà overlay auth chiếu vào body đó.

**Tình huống nghiệp vụ hay gặp.** Một overlay điều khoản dài phải cuộn; một overlay thanh toán có
footer phải đứng yên; một overlay biểu mẫu mà khoảng cách của designer bị đẩy vào body của vendor.

## `VENDOR-7` — Bề mặt field của nhà

**Khi nào gặp.** Shape có một ô nhập văn bản.

**Source phải thể hiện gì.** `Field` của nhà, dùng HeroUI Input `variant="secondary"`. Không dựng
thêm một bề mặt input mặc định cạnh tranh bên cạnh nó.

**Cách nhận ra.** Một component input thứ hai với bề mặt mặc định riêng; một HeroUI Input dùng ở
variant khác để lấy một vẻ ngoài khác.

**Ranh giới.** Đây không phải `VENDOR-9`. `VENDOR-7` ràng buộc bề mặt input; `VENDOR-9` ràng buộc thứ
mà nhãn được phép hiện.

**Tình huống nghiệp vụ hay gặp.** Một ô tìm kiếm "cần trông nhẹ hơn"; một form cài đặt tự đẻ ra input
riêng cho khớp bản mock; một Input vendor thả thẳng vào một block.

## `VENDOR-8` — Nội dung overlay vốn đã được đóng khung

**Khi nào gặp.** Overlay đã duyệt chứa nội dung trông như một thẻ.

**Source phải thể hiện gì.** Overlay dùng thẳng heading, hàng, khoảng cách và control. Không đặt một
SurfaceCard branch có tên thứ hai vào bên trong một overlay vốn đã được đóng khung.

**Cách nhận ra.** Một `SurfaceCard` render bên trong modal hay drawer; một viền nhìn thấy nằm
trong một bề mặt vốn đã có viền.

**Ranh giới.** Đây không phải `VENDOR-1`. `VENDOR-1` cho phép họ SurfaceCard import vendor; `VENDOR-8`
nói rằng ngay cả một chủ sở hữu hợp lệ cũng không thuộc về bên trong một overlay đã đóng khung.

**Tình huống nghiệp vụ hay gặp.** Một overlay xác nhận bọc phần tóm tắt vào một thẻ; một drawer mà mỗi
mục được cho một thẻ riêng; một bản mock vẽ thẻ vì phần khung overlay không nằm trong khung hình.

## `VENDOR-9` — Nhãn field thuần chữ

**Khi nào gặp.** Một field muốn ra hiệu nó nhận loại giá trị gì.

**Source phải thể hiện gì.** Nhãn vẫn thuần chữ. Không suy ra icon trang trí từ kiểu input.

**Cách nhận ra.** Một hình phong thư cạnh field email; một hình ổ khóa cạnh field mật khẩu, thêm
vào vì kiểu input chứ không vì ý nghĩa.

**Ranh giới.** Đây không phải `VENDOR-7`. `VENDOR-7` ràng buộc chính bề mặt input; `VENDOR-9` ràng buộc
cái nhãn nằm bên cạnh nó.

**Tình huống nghiệp vụ hay gặp.** Một form đăng nhập được trang trí cho thân thiện hơn; một form hồ sơ
mà mỗi field được gán một hình tương ứng; một design system nhập về vốn mặc định có icon cho field.

## `VENDOR-10` — Liên kết đi qua TextLink

**Khi nào gặp.** Shape có một liên kết.

**Source phải thể hiện gì.** `TextLink`, bọc `Link` của HeroUI. Không có hành vi liên kết kiểu
raw-button và không dựng lại hover hay underline tại chỗ.

**Cách nhận ra.** Một button được style cho giống liên kết; một `hover:underline` cục bộ trên
thẻ neo; một thẻ neo tự làm lại phần trạng thái đã thăm và hover.

**Ranh giới.** Đây không phải `VENDOR-14`. `VENDOR-10` ràng buộc liên kết được làm bằng gì;
`VENDOR-14` ràng buộc chuyện một đích đến nội bộ có được xuất hiện dưới dạng `href` hay không.

**Tình huống nghiệp vụ hay gặp.** Một footer đầy thẻ neo tự style; một "tìm hiểu thêm" render thành
ghost button; một liên kết nội dòng trong đoạn văn dựng lại bằng class cục bộ.

## `VENDOR-11` — Cách ghép menu tài khoản

**Khi nào gặp.** Điều hướng mang theo một menu tài khoản.

**Source phải thể hiện gì.** Ba file với ba việc: `DropdownBranch` sở hữu cơ chế Dropdown,
`AccountMenu` sở hữu các lựa chọn, `ShellNav` ghép block. Giải phẫu vendor không rò vào block, và điều
hướng không tự thực hiện hành động tài khoản nào.

**Cách nhận ra.** Giải phẫu item của Dropdown viết bên trong `ShellNav`; một lệnh đăng xuất gọi
thẳng từ layout điều hướng.

**Ranh giới.** Đây không phải `VENDOR-2`. `VENDOR-2` chỉ đòi `DropdownBranch` phải sở hữu một cơ chế;
`VENDOR-11` còn tách phần lựa chọn và phần ghép ra thành file riêng.

**Tình huống nghiệp vụ hay gặp.** Thêm mục "đổi workspace"; thêm đăng xuất vào header; chuyển menu
avatar sang một thiết kế điều hướng mới.

## `VENDOR-12` — Projection của overlay auth

**Khi nào gặp.** Một overlay auth đã duyệt cần chỗ chứa nội dung.

**Source phải thể hiện gì.** Đúng một content contract có tên, được chiếu vào cơ chế `ModalBranch`
không inset. Không trùng lặp Tree hay content host, và không có inset dọc thứ hai.

**Cách nhận ra.** Hai content host trong một overlay auth; một `div` bọc thêm padding dọc chồng
lên phần padding vốn có của contract.

**Ranh giới.** Đây không phải `VENDOR-6`. `VENDOR-6` ràng buộc body và inset trong file cơ chế;
`VENDOR-12` ràng buộc nội dung của overlay auth về đúng một projection contract có tên.

**Tình huống nghiệp vụ hay gặp.** Đăng nhập và đăng ký dùng chung một overlay; thêm bước quên mật khẩu
trong cùng modal; bước OTP được cho một host riêng nằm cạnh host sẵn có.

## `VENDOR-13` — Nhãn checkbox nằm trong vùng bấm

**Khi nào gặp.** Một checkbox có nhãn.

**Source phải thể hiện gì.** Control và Indicator của Checkbox nằm bên trong Checkbox Content. Nhãn
nhìn thấy không bao giờ đặt ngoài vùng bấm của checkbox.

**Cách nhận ra.** Một nhãn render như phần tử anh em của checkbox; một hàng mà chỉ mỗi ô vuông
nhỏ phản hồi khi bấm.

**Ranh giới.** Đây không phải `VENDOR-9`. `VENDOR-9` nói về thứ mà nhãn của field được phép hiện;
`VENDOR-13` nói về chỗ đứng vật lý của nhãn checkbox so với vùng bấm.

**Tình huống nghiệp vụ hay gặp.** Một hàng chấp nhận điều khoản; một danh sách checkbox lọc với nhãn
xếp thành lưới; một danh sách công tắc cài đặt dựng lại từ bản mock.

## `VENDOR-14` — Điều hướng nội bộ là một action

**Khi nào gặp.** Shape điều hướng tới một chỗ nào đó bên trong StarCi.

**Source phải thể hiện gì.** Component báo một action lên code routing đã nối. Giá trị `href` nội bộ
StarCi không xuất hiện trong leaf hay component.

**Cách nhận ra.** Một đường dẫn nội bộ viết cứng trong leaf; một component import router để tự
dựng chuỗi URL nội bộ.

**Ranh giới.** Đây không phải `VENDOR-10`. `VENDOR-10` nói liên kết được làm bằng gì; `VENDOR-14` nói
đích đến nội bộ không phải thứ component được giữ.

**Tình huống nghiệp vụ hay gặp.** Một thẻ mở trang khóa học; một breadcrumb trong dashboard; một CTA
đưa người đọc sang trang giá.

## `VENDOR-15` — Bảng phải đi qua TableBranch

**Tình huống.** Shape đã chốt trình bày hàng và cột dưới dạng một cái bảng — một bảng so sánh trong
tài liệu, một lưới kết quả, một liệt kê schema.

**Nó sinh ra gì trong source.** `TableBranch`, bọc HeroUI `Table` cùng các bộ phận compound:
`Table.Header`, `Table.Column` mang `isRowHeader` ở cột đầu, `Table.Row`, `Table.Cell`, và một
`Table.Content` sở hữu tên trợ năng. Bên gọi đưa ô vào và sắp xếp các hàng; không bao giờ với tay qua
branch để lấy một bộ phận. Cấm `<table>`, `<thead>` hay `<tbody>` thô ở bất kỳ đâu trong tầng
component.

**Nó là branch, và tầng này bị ép chứ không phải được chọn.** Một leaf nhận `ComponentData`, tức JSON
tới tận đáy — string, number, boolean, null, cùng mảng và object của chúng. Một ô bảng thì mang nội
dung inline: một liên kết giữa câu, một đường dẫn file đặt trong code, một chữ được nhấn. Không thứ
nào sống sót qua một slot JSON, nên leaf chỉ có thể nhận những ô đã bị ép phẳng thành chữ, mà ép phẳng
chính là mất mát mà cái bảng sinh ra để ngăn. `CompositeProps` nói đúng kết luận ấy từ phía bên kia —
chỗ nào bên gọi được phép đưa nội dung vào, chỗ đó là branch. Vì vậy `TableBranch` gia nhập danh sách
owner HeroUI đóng, đứng cạnh họ SurfaceCard, và chiếu vào những ô đã validate qua contract đúng cách
họ đó vốn đã chiếu vào một thân đã validate.

**Dấu hiệu nhận ra.** Một phần tử `<table>` mang class bố cục; một hàng tiêu đề dựng bằng `<th>` với
đường viền viết tay; một lưới `<div>` gắn `role="table"`; căn cột được dựng lại bằng `min-w-max` vì
scroll container của chính vendor chưa bao giờ được dùng.

**Ranh giới.** Đây không phải `VENDOR-1`. `VENDOR-1` từ chối một import vendor viết sai file, và nó
chỉ nhìn thấy được những import **có tồn tại** — một cái bảng dựng tay thì không import gì cả, nên
`VENDOR-1` im lặng đúng ở ca cần nói nhất. `VENDOR-15` gọi tên chính sự vắng mặt đó: chỗ nào cái bảng
chính là nghĩa của shape, thì branch là cách viết duy nhất.

**Một cái bảng bị tràn là hai quyết định, không phải một.** Branch sở hữu vendor; cái khung quanh nó là
`SURFACE-IN-SURFACE-7` còn chỗ cuộn ngang là `OVERFLOW-5`. Root của vendor vốn là một grid mà scroll
container bên trong không lan `min-width` ra ngoài, nên một cái bảng rộng để trần sẽ đẩy cả cột đọc
vượt viewport. Khung block thuần chính là thứ cho phép cột co lại — nó do hai mã kia bắt buộc, và
không phải thứ module này phát ra.

**Tình huống nghiệp vụ hay gặp.** Bảng so sánh trong một bài học; ma trận giá trên trang marketing;
lịch sử chạy trong console vận hành; bảng tra cứu trường dữ liệu trong tài liệu.

## Tầng giữ

Contract giữ hình dạng nhìn thấy. Mechanics branch chỉ giữ vòng đời, focus, portal, dismiss, placement
và vùng cuộn của HeroUI — chúng là ba owner có tên, `ModalBranch`, `DrawerBranch`, `DropdownBranch`, và
chúng không tạo ra một tầng kiến trúc riêng. Block, layout, overlay, page và composite hoàn toàn không
biết đến giải phẫu vendor: chúng nhận kết quả, không nhận import. `ShellNav` là tên sản phẩm, không
phải giấy miễn trừ cho bất kỳ luật ownership nào. `TableBranch` đứng cùng họ SurfaceCard chứ không
đứng với các leaf, vì ô của nó tới từ bên gọi mà một slot leaf thì không chở nổi.

Ranh giới vendor bị vượt theo hai chiều và module này giữ cả hai. Một file có thể với tay lấy giải
phẫu vendor mà nó không có quyền — đó là `VENDOR-1`, và cái import làm chuyện đó lộ ra. Một file cũng
có thể dựng tay lại đúng thứ mà một leaf đã sở hữu, không import gì cả: cái `<table>` thô mà
`VENDOR-15` từ chối. Cái thứ hai mới là kiểu hỏng lặng lẽ, vì không có gì trong file gọi tên cái
vendor mà nó đang đứng thay.

## Điểm neo

Rule nằm ở `@canon-fe` cùng test song sinh ở
`@canon-fe`. Điểm neo sản phẩm là `components/branches/ModalBranch`,
`DrawerBranch`, `DropdownBranch`, họ SurfaceCard, `components/leaves/Field`, `components/branches/TableBranch`, `TextLink`,
`Checkbox`, `components/blocks/auth/AccountMenu` và `components/layouts/ShellNav`.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| Shape đã duyệt | Nó là bề mặt nào, chứa những gì, và mở, đóng hay điều hướng ra sao |
| Vị trí trong tầng component | File là leaf, mechanics branch có tên, thành viên họ SurfaceCard, hay block/layout/overlay/page/composite |
| Điểm neo sản phẩm sẵn có | Đường dẫn dưới `components/…` đang sở hữu mối quan tâm này, lấy từ danh sách Điểm neo |
| Nguồn rule | `@canon-fe` và test song sinh `@canon-fe` |
| Nguồn gốc route, nếu có | Giá trị có đến từ route của framework và có được đóng thành một projection contract có tên trước khi vào tầng component hay không |

## Quy tắc

1. Leaf, các mechanics branch có tên và họ SurfaceCard có tên là những chủ sở hữu HeroUI duy nhất ở
   tầng component; cấm import vendor trong block, layout, overlay, page, composite hoặc branch không
   liên quan.
2. `ModalBranch`, `DrawerBranch` và `DropdownBranch` mỗi cái bọc đúng primitive tương tác vendor của
   nó; cấm mechanics branch rỗng, và cấm mọi thư mục `components/shells`.
3. `ModalBranch` sở hữu đúng một vùng cuộn `Modal.Body` không inset; cấm thiếu body và cấm chồng
   padding giữa body và contract.
4. `Field` của nhà dùng HeroUI Input `variant="secondary"`; cấm một bề mặt input mặc định cạnh tranh.
5. Overlay dùng thẳng heading, hàng, khoảng cách và control; cấm một SurfaceCard branch có tên thứ hai
   bên trong một overlay vốn đã được đóng khung.
6. Nhãn của field vẫn thuần chữ; cấm icon trang trí suy ra từ kiểu input.
7. `TextLink` bọc `Link` của HeroUI; cấm hành vi liên kết kiểu raw-button và cấm dựng lại hover hay
   underline tại chỗ.
8. `DropdownBranch` sở hữu cơ chế Dropdown, `AccountMenu` sở hữu các lựa chọn, `ShellNav` ghép block;
   cấm giải phẫu vendor rò vào block và cấm hành động tài khoản trực tiếp trong điều hướng.
9. Overlay auth chiếu đúng một content contract có tên vào cơ chế `ModalBranch` không inset; cấm trùng
   lặp Tree/content host và cấm inset dọc thứ hai.
10. Control và Indicator của Checkbox nằm bên trong Checkbox Content; cấm nhãn nhìn thấy nằm ngoài vùng
    bấm của checkbox.
11. Điều hướng nội bộ báo một action lên code routing đã nối; cấm giá trị `href` nội bộ StarCi trong
    leaf hay component.
12. `TableBranch` sở hữu HeroUI `Table` cùng các bộ phận compound và chiếu vào những ô đã validate;
    cấm `<table>` thô trong tầng component và cấm dựng tay một lưới thay thế.
13. Không tạo tầng wrapper chung, không re-export giải phẫu vendor, không truyền markup thô qua các
    container component, và không chuyển class nhìn thấy ra khỏi contract cho tiện phần cơ chế.

## Ngoại lệ

**Route của framework, đối với `VENDOR-1`.** Route của framework được phép nhận nội dung của framework,
nhưng phải đóng nó thành một projection contract có tên trước khi vào tầng component. Đây là ranh giới
route, không phải một thư mục component đặc quyền — việc đóng diễn ra bên ngoài tầng component, và
không lập thư mục wrapper nào cho nó.

Nguồn v2 không ghi nhận ngoại lệ nào khác. Mọi mã còn lại ở trên đều đóng.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra là một khối.

```text
file: src/components/branches/ModalBranch/index.tsx
tier: branch (named mechanics owner)
codes: VENDOR-2, VENDOR-6
owns: HeroUI Modal lifecycle, focus, portal, dismiss, placement; exactly one zero-inset Modal.Body scroll region
imports: @heroui/react
exports: ModalBranch
forbidden: children passthrough; padding on Modal.Body; any components/shells directory
anchor: @canon-fe
```

```text
file: src/components/blocks/auth/<AuthOverlay>/contract.ts
tier: block
codes: VENDOR-12, VENDOR-8
owns: the single named content contract projected into ModalBranch; all visible padding
imports: none from @heroui/react
exports: <authOverlayContract>
forbidden: duplicate Tree/content hosts; a second vertical inset; a named SurfaceCard branch inside the overlay
anchor: @canon-fe
```

## Ví dụ đã giải

**Shape đã duyệt.** Một overlay đăng nhập mở đè lên trang, giữ một cột cuộn gồm một heading, một field
email, một field mật khẩu, một checkbox "ghi nhớ đăng nhập", một control gửi đi và một liên kết "quên
mật khẩu".

```text
file: src/components/branches/ModalBranch/index.tsx
tier: branch (named mechanics owner)
codes: VENDOR-2, VENDOR-6
owns: Modal open/close, focus, portal, dismiss; exactly one zero-inset Modal.Body
imports: @heroui/react
exports: ModalBranch
forbidden: children passthrough; className padding on Modal.Body
reason: file này import và bọc primitive tương tác của HeroUI, nên nó là owner của VENDOR-2 chứ không phải một vi phạm VENDOR-1; và vì nó là branch giữ Modal.Body nên luật inset đáp xuống đây là VENDOR-6, không phải VENDOR-12 — mã đó ràng buộc phần nội dung được chiếu vào
```

```text
file: src/components/blocks/auth/SignInOverlay/contract.ts
tier: block
codes: VENDOR-12, VENDOR-8
owns: one named content contract; heading, rows, spacing and controls stated directly; all vertical inset
imports: none from @heroui/react
exports: signInOverlayContract
forbidden: a second content host; a second vertical inset; a SurfaceCard branch inside the overlay
reason: overlay đã được ModalBranch đóng khung, chính sự kiện đó loại SurfaceCard của VENDOR-8 khỏi phần ruột; và nó là một block, chính sự kiện đó loại nó khỏi danh sách chủ sở hữu vendor hợp lệ của VENDOR-1
```

```text
file: src/components/leaves/Field/index.tsx
tier: leaf
codes: VENDOR-7, VENDOR-9
owns: the house input surface, HeroUI Input variant="secondary"; a textual label
imports: @heroui/react
exports: Field
forbidden: a competing default input surface; a kind icon inferred from input type
reason: leaf là chủ sở hữu hợp lệ theo VENDOR-1, nên import vendor ở lại đây thay vì nằm trong overlay; field email và mật khẩu không nhận hình trang trí nào vì VENDOR-9 cấm suy icon từ kiểu input
```

```text
file: src/components/leaves/Checkbox/index.tsx
tier: leaf
codes: VENDOR-13
owns: Control and Indicator, both inside Checkbox Content
imports: @heroui/react
exports: Checkbox
forbidden: the visible "remember me" label rendered outside the press target
reason: nhãn thuộc về vùng bấm của checkbox, chính điều đó tách nó khỏi VENDOR-9 — mã kia quản nội dung nhãn của một field, không quản vị trí nhãn của một checkbox
```

```text
file: src/components/leaves/TextLink/index.tsx
tier: leaf
codes: VENDOR-10, VENDOR-14
owns: the wrap of HeroUI Link; reporting the forgot-password navigation as an action
imports: @heroui/react
exports: TextLink
forbidden: raw-button link behaviour; local hover/underline recreation; an internal StarCi href value
reason: đích đến nằm bên trong StarCi, chính sự kiện đó kéo VENDOR-14 vào cạnh VENDOR-10 — liên kết vẫn dựng từ Link của HeroUI, nhưng đường dẫn nội bộ được báo lên code routing đã nối chứ không giữ ở đây
```

**Shape không nói gì, nên không giải được gì.** Shape không nói file nào import HeroUI, padding sống ở
đâu, nhãn checkbox nằm trong hay nằm cạnh vùng bấm, hay liên kết quên mật khẩu có mang `href` không.
Không câu nào trong đó là câu hỏi thiết kế, nên shape không trả lời câu nào; mỗi câu do đúng mã đã gọi
tên nó ở trên trả lời.

## Phạm vi

Luật này đúng cho mọi đoạn code tầng component thuộc loại này trong stack này — mọi leaf, branch,
block, layout, overlay, page và composite có chạm tới HeroUI, tới body của overlay, tới một ô nhập, một
liên kết, một checkbox, một menu tài khoản hay điều hướng nội bộ. Nó không gọi tên bất kỳ feature đơn
lẻ nào.
