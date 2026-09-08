# Radius presentation

File này trả lời đúng một câu hỏi: với một boundary do ứng dụng sở hữu, góc của nó tròn tới đâu?

Composition đã chọn xong cây DOM và các object Grammar. Radius presentation chỉ giải góc của những
surface, mark và pill do ứng dụng sở hữu. Góc của một card, input, button hay bất kỳ object Grammar
nào thuộc về Grammar, và Grammar vẽ nó từ token của chính nó chứ không bao giờ từ một class ứng dụng
truyền vào.

## Thang giá trị

Mỗi bước là một bội số của cùng một con số. Theme công bố `--radius` rồi suy ra cả cái ramp từ đó,
nên cả ramp dịch chuyển thành một khối khi một visual family đổi con số ấy: gốc ứng dụng đặt
`--radius: .5rem`, family core của Grammar đặt nó bằng `--starci-core-control-radius` (`.75rem`), còn
family heritage đặt nó bằng `0`. Số hiệu rule là vị trí thứ tự trên ramp ấy. Nó không phải một từ chỉ
kích cỡ và không phải một variant của component.

| Rule | Class | Hệ số | Giá trị khi `--radius: .5rem` |
| --- | --- | --- | --- |
| — | `rounded-none` | `0` | `0` |
| — | `rounded-xs` | `× .25` | `.125rem` |
| RADIUS-2 | `rounded-sm` | `× .5` | `.25rem` |
| — | `rounded-md` | `× .75` | `.375rem` |
| RADIUS-4 | `rounded-lg` | `× 1` | `.5rem` |
| RADIUS-5 | `rounded-xl` | `× 1.5` | `.75rem` |
| RADIUS-6 | `rounded-2xl` | `× 2` | `1rem` |
| RADIUS-7 | `rounded-3xl` | `× 3` | `1.5rem` |
| — | `rounded-4xl` | `× 4` | `2rem` |
| RADIUS-9 | `rounded-full` | không có | một góc lớn hơn cả cái hộp |

Số hiệu rule là vị trí của hàng trên ramp, tính `rounded-none` là không, và nó là một địa chỉ ổn định:
ramp được in trọn vẹn nên các số đã công bố không bao giờ xê dịch khi thêm một bước. Một bước chỉ nhận
số hiệu của mình, và nhận bảng case bên dưới, khi đã có hai block được uỷ quyền viết nó; bốn bước đang
ghi `—` là những địa chỉ đã giữ chỗ, vì xuất hiện một lần là quyết định sản phẩm, chưa phải rule.

Vì các hệ số cố định và chỉ `--radius` di chuyển, một ứng dụng viết thẳng giá trị rem —
`rounded-[1.25rem]` — đóng băng quyết định của một family vào mọi family và bỏ ramp lại phía sau.

`rounded-field` không phải một bước. Nó là utility field của vendor, giải về `--field-radius`, và
thuộc về family field chứ không phải một lựa chọn của ứng dụng.

## Owner

Mỗi case gọi tên ai sở hữu góc. Chủ sở hữu quyết định ứng dụng có được viết class hay không.

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Boundary thuộc về ứng dụng | Class |
| Tên một component | Common đã bo góc này bên trong component đó | Không gì cả. Ghép nó vào |
| `—` | Common không mở đường công khai nào cho boundary này | Class, ghi lại như một cách chữa cháy |

Viết class ở nơi chủ là một component là `APP_REIMPLEMENTATION`. Với tay vào trong một component
Grammar bằng selector hay bằng class truyền vào để đổi góc của nó là `APP_OVERRIDE`.

## Những class nằm ngoài thang

`rounded-small`, `rounded-medium` và `rounded-large` không nằm trên thang này và cũng không phải
utility mà app này công bố. Chúng là tên plugin Tailwind 3 của vendor, và stylesheet đã biên dịch của
head hiện tại không phát ra quy tắc nào cho chúng cả: `rounded-` chỉ in ra `none`, `sm`, `md`, `lg`,
`xl`, `2xl`, `3xl`, `full` và `field`, không gì khác. Một boundary viết bằng một trong ba tên ấy vì
thế render vuông trong khi source đọc lên như thể đã chọn một góc.

Chúng bị gỡ chứ không được dịch sang. Lý do gỡ là `off the closed scale`, và thứ thay thế là bước ramp
mà case của boundary ấy gọi tên, không phải bước có từ ngữ tình cờ trùng khớp.

Một giá trị tuỳ tiện như `rounded-[1.25rem]` cũng nằm ngoài thang, vì một lý do ngắn hơn: đó là con số
không ai dẫn được và không ai dịch chuyển được.

## Radius mà Common đã sở hữu

Common bo góc các object của nó từ ba token do `@grammar/core` công bố, và không class ứng dụng nào
với tới được: `--starci-core-surface-radius` (`1rem`) bo mọi surface, gồm cả `.starci-core-surface` và
viewport của `MediaFrame`; `--starci-core-control-radius` (`.75rem`) bo các control và nội dung
tooltip; `--starci-core-pill-radius` (`999px`) bo các hình pill. Một visual family có thể đặt những
token ấy thành con số của riêng nó, và đó chính là lý do một ứng dụng chép lại con số hiện tại đã đóng
băng quyết định của một family vào mọi family.

`scripts/generate-presentation-owned.mjs` chưa mang topic `RADIUS`, nên file này chưa có bảng sở hữu
được sinh ra. Cho tới khi có, người đọc loại trừ việc viết class bằng cách tìm boundary ấy trong ba
token ở trên.

## RADIUS-2 — `rounded-sm` / `.25rem`

Góc nhỏ nhất mà vẫn đọc ra là cố ý, dành cho một mark nhỏ tới mức một góc lớn hơn sẽ ăn mất thân nó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một ô lưới dày hoặc ô chú giải chỉ vài pixel mỗi cạnh | `App` | `<span className="size-3 rounded-sm bg-default" />` |
| Case 2 | Một dòng skeleton thay chỗ cho chữ trong lúc tải | `App` | `<div className="h-4 w-40 rounded-sm" />` |

Không phải rule này: một container chứa nội dung đọc được, cần góc tương xứng với inset của nó. Dùng
RADIUS-5.

## RADIUS-4 — `rounded-lg` / `.5rem`

Một boundary tương tác gọn: một badge vuông nhỏ hoặc một vùng cỡ control do ứng dụng sở hữu.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một marker vuông cố định mang một con số hay một glyph | `App` | `<span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft">` |
| Case 2 | Một đoạn của segmented control do ứng dụng sở hữu | `App` | `<button className="min-h-9 rounded-lg px-3">` |
| Case 3 | Một notice nhỏ có viền nằm bên trong một surface lớn hơn | `App` | `<div className="rounded-lg border border-separator p-3">` |

Không phải rule này: một object mà Common đã vẽ sẵn như một control. Ghép component vào và không
truyền class nào.

## RADIUS-5 — `rounded-xl` / `.75rem`

Góc tiêu chuẩn cho một vùng do ứng dụng sở hữu nằm lồng trong một surface: một band, một notice, một
nhóm có viền là phần của card chứ không phải một card riêng.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một nhóm nội dung có viền bên trong một section | `App` | `<div className="rounded-xl border border-separator p-4">` |
| Case 2 | Một notice hay band trạng thái tông mềm | `App` | `<div className="rounded-xl bg-accent-soft px-3 py-2">` |
| Case 3 | Một ô icon vuông đứng cạnh một hàng chữ | `App` | `<span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft">` |

Không phải rule này: surface ngoài cùng của một vùng, vốn lấy góc surface. Dùng RADIUS-6.

## RADIUS-6 — `rounded-2xl` / `1rem`

Góc surface: một vùng do ứng dụng sở hữu và tự nó đọc lên như một card, khớp với giá trị Common dành
cho surface của chính nó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một panel do ứng dụng sở hữu, đứng như surface của riêng nó trên trang | `App` | `<div className="min-w-0 overflow-hidden rounded-2xl bg-surface-secondary">` |
| Case 2 | Một notice trải hết bề ngang, chiếm trọn một vùng của trang | `App` | `<div className="rounded-2xl bg-warning-soft p-4">` |
| Case 3 | Một surface chỉ bo ở cạnh đầu khối, vì cạnh cuối chạy thẳng vào thứ tiếp theo | `App` | `<div className="rounded-t-2xl">` |

Không phải rule này: một card mà Common đã vẽ. Ghép `SurfaceCard` và không viết góc nào.

Một surface đã bo mà còn tô hoặc dàn con bên trong thì cắt mất chúng, nên `overflow-hidden` đi cùng
với góc ở mọi chỗ mà một đứa con sẽ vượt qua đường bo ấy.

## RADIUS-7 — `rounded-3xl` / `1.5rem`

Góc ramp lớn nhất đang dùng: một band hero mà kích thước của nó làm góc surface trông chật.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một vùng hero mở đầu trang, trải hết bề ngang nội dung | `App` | `<div className="grid min-w-0 overflow-hidden rounded-3xl bg-accent-soft">` |

Không phải rule này: một panel bình thường, vốn đọc lên như bị thổi phồng ở bán kính này. Dùng
RADIUS-6.

## RADIUS-9 — `rounded-full` / một góc lớn hơn cả cái hộp

Điểm cuối của ramp, và là một hình dạng chứ không phải một giá trị: boundary là hình tròn hoặc hình
pill, và giá trị là bất cứ thứ gì cái hộp cần để thành hình đó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một chấm, khung avatar hay mark tròn đều cạnh khác | `App` | `<span className="size-2 rounded-full bg-accent" />` |
| Case 2 | Một band hay nút hành động nổi hình pill do ứng dụng sở hữu | `App` | `<div className="inline-flex items-center gap-2 rounded-full px-3 py-2">` |

Không phải rule này: một hình chữ nhật rộng, nơi góc pill đọc lên như một lỗi chứ không như một hình
dạng. Dùng bước ramp mà kích thước của nó đòi.

## Biến thể theo góc

`rounded-t-*`, `rounded-b-*`, `rounded-s-*`, `rounded-e-*` và các class một góc không phải rule riêng.
Chúng áp một rule đã có lên đúng những góc chúng gọi tên, cho một boundary mà các cạnh không kết thúc
giống nhau.

| Góc | Class | Nghĩa |
| --- | --- | --- |
| Một cạnh khối | `rounded-t-*`, `rounded-b-*` | Rule đã chọn áp cho hai góc của cạnh đó |
| Một cạnh dòng | `rounded-s-*`, `rounded-e-*` | Rule đã chọn áp cho hai góc của cạnh đó |
| Một góc | `rounded-tl-*`, `rounded-br-*` và anh em | Rule đã chọn chỉ áp cho góc đó |

Một biến thể góc cần một lý do lấy từ cây: một cạnh chạm vào surface khác, hoặc một góc đơn chỉ về thứ
mà phần tử ấy thuộc về. Không có lý do thì nó là trang trí, và mọi góc của boundary đều lấy rule.

Trên cùng một phần tử, class hẹp hơn thắng ở những góc nó gọi tên chứ không cộng thêm, nên
`rounded-2xl rounded-b-none` là `1rem` ở trên và vuông ở dưới.

## File này không quyết định

Vùng ấy lấy surface hay tông nào là [Surface](surface.vi.md). Đường nào vẽ cạnh của nó là
[Boundary](boundary.vi.md). Inset của nó là [Padding](padding.vi.md), còn cắt là
[Overflow](overflow.vi.md); góc và cắt được quyết cùng nhau nhưng ghi lại tách nhau.
