# Padding presentation

File này trả lời đúng một câu hỏi: một ranh giới do ứng dụng sở hữu thì cách nội dung của nó bao xa.

Bước composition đã chọn xong cây DOM và các Grammar object. Padding presentation chỉ giải quyết
phần inset của page, section và container do ứng dụng sở hữu. Inset bên trong một card, input,
button hay bất kỳ Grammar object nào khác đều thuộc về Grammar.

## Thang giá trị

`COMMON_SPACING_SCALE` là thang đóng. Số của rule là thứ tự trên thang đó. Nó không phải số bậc
Tailwind, và hai số này lệch nhau từ PADDING-5 trở đi.

| Rule | Class | Giá trị | Token Common |
| --- | --- | --- | --- |
| PADDING-0 | `p-0` | `0` | không có |
| PADDING-1 | `p-1` | `.25rem` | không có |
| PADDING-2 | `p-2` | `.5rem` | không có |
| PADDING-3 | `p-3` | `.75rem` | không có |
| PADDING-4 | `p-4` | `1rem` | không có |
| PADDING-5 | `p-6` | `1.5rem` | không có |
| PADDING-6 | `p-8` | `2rem` | không có |

Common không publish token padding nào. Các inset bên dưới chỉ đến được qua chính component sở hữu
chúng, chứ không qua một biến mà ứng dụng được phép đặt.

Page inset là ngoại lệ duy nhất và không nằm trên thang này: `--grammar-page-inset` cho ra
`clamp(1rem, 3vw, 2rem)`, một giá trị responsive do `PageContainer` sở hữu. Ứng dụng không bao giờ
dựng lại nó bằng một class cố định.

Các giá trị rem chỉ quy ra `0 / 4 / 8 / 12 / 16 / 24 / 32` pixel CSS khi root font size tính được là
`16px`. Khi kiểm tra lúc chạy thì dùng `expectedPx = remFactor * observedRootFontPx`.

## Owner

Mỗi case gọi tên ai sở hữu inset. Owner quyết định ứng dụng có được viết class hay không.

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Ranh giới thuộc về ứng dụng | Viết class |
| Tên component | Common đã áp inset bên trong component đó | Không viết gì, chỉ ghép component |
| `—` | Common chưa có đường dùng công khai cho ranh giới này | Viết class, ghi nhận là workaround |

Viết class ở chỗ owner là một component chính là `APP_REIMPLEMENTATION`. Thò vào ruột một Grammar
component bằng selector hoặc bằng class truyền vào để đổi inset của nó là `APP_OVERRIDE`.

## Padding mà Common đã sở hữu

Tra bảng này trước khi viết bất kỳ padding nào. Nếu ranh giới đã có ở đây thì ứng dụng chỉ ghép
component và không viết gì thêm.

| Component Common | Inset bên trong | Rule |
| --- | --- | --- |
| `PageContainer` | `clamp(1rem, 3vw, 2rem)` theo trục inline, kèm canh giữa | ngoài thang |
| Nội dung `Tooltip` | `.25rem` trục block, `.5rem` trục inline | PADDING-1, PADDING-2 |
| `HorizontalScrollRegion` | `.25rem` trục block | PADDING-1 |
| Tab của `Tabs` | `.75rem` trục inline | PADDING-3 |
| Khung `Tabs` khi `inset="page"` | `1.5rem` trục inline | PADDING-5 |
| `Subnav` | `.75rem` trục inline | PADDING-3 |
| `NavigationFeatureNav` | `.75rem` trục inline | PADDING-3 |
| Nội dung `SurfaceCard` | `1rem` | PADDING-4 |
| `SurfaceCard` khi `composition="joined"` | `0` | PADDING-0 |
| Vỏ `SurfaceListCard` | `0` | PADDING-0 |
| Trigger của `SurfaceAccordionCard` | `1rem` | PADDING-4 |
| Panel của `SurfaceAccordionCard` | `0` phía trên, `1rem` hai bên và dưới | PADDING-0, PADDING-4 |
| `EmptyNotice` | `1rem` | PADDING-4 |
| `FencedCodeBlock` | `1rem` | PADDING-4 |

## Tiếp xúc theo cạnh

Một ranh giới không phải lúc nào cũng lấy một giá trị cho cả bốn cạnh. Khi một surface để phẳng và
các dải con tự sở hữu inset của mình, mỗi cạnh lấy giá trị theo thứ mà nó chạm vào.

| Cạnh chạm vào | Giá trị | Rule |
| --- | --- | --- |
| Mép ngoài của surface | `1rem` | PADDING-4 |
| Separator giữa hai dải | `.75rem` | PADDING-3 |
| Không chạm gì, vì con đã sở hữu mép | `0` | PADDING-0 |

Separator đã tự vẽ ra đường ranh, nên cạnh chạm vào nó cần ít khoảng hở hơn cạnh chạm mép trần. Hai
cạnh ngang của một dải luôn chạm mép ngoài, nên luôn giữ `1rem`.

Với một chồng dải thì quy ra `px-4` xuyên suốt, `pt-4` ở dải đầu, `pb-4` ở dải cuối, và `.75rem` cho
mọi cạnh chạm separator. Một dải nằm giữa hai separator là `px-4 py-3`.

Common sở hữu bản thân cái surface phẳng qua `composition="joined"`, thứ đặt inset nội dung về `0`.
Nó chưa có đường nào cho inset của các dải, nên phần đó vẫn là workaround của ứng dụng.

## PADDING-0 — `p-0` / `0`

Ranh giới không đóng góp khoảng cách nào, vì nội dung hoặc phần tử con đã tự mang đường bao của nó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Container chỉ gom nhóm, mà mỗi con đã tự mang ranh giới riêng | `App` | `<section className="p-0">` |
| Case 2 | Các dải trong surface phải chạy sát mép card | `SurfaceCard` | `composition="joined"` đã đặt sẵn `0` |
| Case 3 | Danh sách mà mỗi hàng tự sở hữu inset của nó | `SurfaceListCard` | Ghép card, không viết padding |

Không phải rule này: ranh giới duy nhất bảo vệ nội dung đọc được thì phải giữ inset. Dùng PADDING-4.

## PADDING-1 — `p-1` / `.25rem`

Inset đều nhỏ nhất, dành cho một container cố ý làm nhỏ mà nội dung gần như lấp đầy.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một nhãn hoặc chú giải nhỏ nổi trên canvas do app sở hữu | `App` | `<aside className="p-1">` với `<Text size="xs">` |
| Case 2 | Vùng cuộn cần chừa chỗ để focus ring không bị cắt | `HorizontalScrollRegion` | Ghép region, không viết padding |
| Case 3 | Một gợi ý ngắn gắn vào một control | `Tooltip` | Ghép tooltip, không viết padding |

## PADDING-2 — `p-2` / `.5rem`

Container nhỏ gọn do app sở hữu, cần khoảng mép rõ ràng nhưng tiết kiệm.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một dải phụ nhỏ mà cả bốn cạnh dùng chung một inset | `App` | `<aside className="p-2">` với `<Text size="sm">` |
| Case 2 | Một thanh control gọn nằm trên nội dung do app sở hữu | `App` | `<div className="flex items-center gap-2 p-2">` |

Không phải rule này: khoảng cách giữa các phần tử con bên trong container thuộc về gap của cha, không
thuộc padding. Dùng rule GAP tương ứng.

## PADDING-3 — `p-3` / `.75rem`

Inset dày dặn nhưng vẫn đọc được, cho một section hoặc container lồng do app sở hữu.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một container lồng bên trong, sở hữu ranh giới khác với ranh giới của cha | `App` | `<aside className="p-3">` nằm trong section `p-4` |
| Case 2 | Inset ngang của một thanh tab hoặc navigation phụ | `Tabs`, `Subnav` | Ghép component, không viết padding |
| Case 3 | Cạnh của một dải chạm separator bên trong surface phẳng | `—` | `<div className="px-4 py-3">` nằm giữa hai separator |
| Case 4 | Cạnh hướng về separator của một ô metric hoặc một hàng danh sách | `—` | `<div className="p-4 pb-3">`, hoặc `pt-3` khi separator nằm trên |

Không phải rule này: lồng cùng một inset cho cùng một ranh giới và cùng mục đích là nhân đôi nó.
Padding của cha và của con cộng dồn trên đường từ mép ngoài tới nội dung cuối.

## PADDING-4 — `p-4` / `1rem`

Inset đều chuẩn cho nội dung đọc được bên trong một ranh giới do app sở hữu.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một section của app sở hữu trọn khoảng cách từ đường viền tới nội dung | `App` | `<section className="p-4">` với `<Heading level={2}>` |
| Case 2 | Nội dung bên trong một card | `SurfaceCard` | Ghép card, không viết padding |
| Case 3 | Trigger của disclosure và panel xổ ra của nó | `SurfaceAccordionCard` | Ghép card, không viết padding |
| Case 4 | Một thông báo trạng thái rỗng | `EmptyNotice` | Ghép notice, không viết padding |
| Case 5 | Một khối code có khung | `FencedCodeBlock` | Ghép khối, không viết padding |
| Case 6 | Cạnh của một dải chạm mép ngoài của surface phẳng | `—` | `pt-4` ở dải đầu, `pb-4` ở dải cuối |
| Case 7 | Hai cạnh ngang của mọi dải bên trong surface phẳng | `—` | `px-4` cho mọi dải, không đổi theo vị trí |

## PADDING-5 — `p-6` / `1.5rem`

Một section lớn do app sở hữu, cố ý thoáng hơn mức inset chuẩn.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Section mà cả bốn cạnh dùng chung một quyết định ranh giới rộng rãi | `App` | `<section className="p-6">` |
| Case 2 | Khung tab mang inset ngang ở cấp trang | `Tabs` | `inset="page"` đã đặt sẵn `1.5rem` |

Không phải rule này: khoảng cách giữa các section con là gap chứ không phải inset. Dùng GAP-5.

## PADDING-6 — `p-8` / `2rem`

Một khung rộng rãi có chủ ý bao quanh vùng lớn, mật độ thấp.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Vùng trang cần khoảng trống đều và mạnh ở mọi cạnh | `App` | `<section className="p-8">` |
| Case 2 | Vùng rỗng hoặc đang chờ, chiếm gần hết viewport | `App` | `<section className="p-8">` với `<EmptyNotice>` |

Không phải rule này: lấy làm mặc định cho container thường là phí viewport. Dùng PADDING-4.

## Inset ghép

`PADDING-0` tới `PADDING-6` là thang: một rule, một giá trị. Từ `PADDING-7` trở đi, rule là những
công thức có tên mà các cạnh cố ý lấy giá trị khác nhau. Số vẫn đếm tiếp, nhưng thôi mang nghĩa vị
trí trên thang, nên một rule ghép không bao giờ xuất hiện trong bảng thang và không tự đẻ ra giá trị
mới. Mọi cạnh của một công thức ghép đều quy về một rule gốc.

Thêm số tiếp theo khi xuất hiện một pattern lệch cạnh thật sự mới. Phải nêu lý do vì sao từng cạnh
khác nhau; một công thức không có lý do thì là quyết định riêng của sản phẩm chứ không phải rule.

### PADDING-7 — Nhích inset lên ở breakpoint rộng

Cùng một ranh giới giữ nguyên ý nghĩa qua các khổ màn hình nhưng lấy rộng hơn khi có chỗ. Giá trị ở
khổ hẹp và khổ rộng là hai rule liền kề, không bao giờ nhảy hai bậc, và trục block chỉ nhích theo ở
những cạnh mà chính ranh giới đó làm chủ.

| Cạnh | Khổ hẹp | Khổ rộng | Rule |
| --- | --- | --- | --- |
| Hai cạnh ngang của surface | `1rem` | `1.5rem` | PADDING-4, PADDING-5 |
| Cạnh trục block chạm mép ngoài | `1rem` | `1.5rem` | PADDING-4, PADDING-5 |
| Cạnh trục block chạm separator | `.75rem` | `.75rem` | PADDING-3 |

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một surface quyết định, inset ngang mở rộng ra ở viewport lớn hơn | `—` | `<div className="px-4 sm:px-6">` |
| Case 2 | Cạnh trục block chạm mép ngoài của chính surface đó, nhích theo cùng | `—` | `<div className="px-4 pt-4 pb-4 sm:px-6 sm:pt-6 sm:pb-6">` |
| Case 3 | Cạnh hướng về separator bên trong surface đó | `—` | `pt-3` giữ `.75rem` ở cả hai khổ |

Không phải rule này: cạnh chạm separator thì không nhích, vì separator vẫn vẽ đúng một đường ở mọi
khổ màn hình.

### PADDING-8 — Nội dung con thụt vào ở đầu trục inline

Nội dung thuộc về hàng nằm trên nó, chứ không phải đứng ngang với nó, thì thụt vào một bậc ở đầu
trục inline. Chỉ cạnh đầu mang nghĩa phân cấp. Cạnh cuối không mang nghĩa đó nên giữ thẳng hàng với
cha, và khổ đọc không bị bóp từ cả hai phía.

| Cạnh | Giá trị | Rule |
| --- | --- | --- |
| Đầu trục inline | Cao hơn inset của surface một bậc, `1.5rem` khi surface là `1rem` | PADDING-5 |
| Cuối trục inline | Đúng inset của surface, giữ nguyên | PADDING-4 |
| Hai cạnh trục block | Theo thứ mà cạnh đó chạm, dùng luật tiếp xúc | PADDING-3, PADDING-4 |

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Phần thân disclosure, đọc lên là câu trả lời thuộc về trigger phía trên | `—` | `<div className="ps-6 pe-4 py-3">` |
| Case 2 | Một nhóm lồng mà các hàng thuộc về một hàng cha có tên | `—` | Cùng công thức, mỗi cấp lồng thêm một bậc |

Không phải rule này: thụt vào cả hai bên, vì như vậy là canh giữa nội dung và đọc lên thành một khối
inset riêng chứ không phải nội dung con.

Disclosure của Common hiện áp `1rem` cho cả hai cạnh ngang, nên dạng thụt vào chưa có đường công
khai. Việc sửa thuộc về chính component disclosure, không phải một override ở tầng ứng dụng.

## Biến thể theo trục

`px-*` và `py-*` không phải rule riêng. Chúng áp một rule đã có lên một trục, khi hai trục mang hai
quyết định ranh giới khác nhau.

| Trục | Class | Nghĩa |
| --- | --- | --- |
| Inline | `px-*` | Rule đã chọn chỉ áp cho cạnh đầu và cuối theo chiều ngang |
| Block | `py-*` | Rule đã chọn chỉ áp cho cạnh trên và dưới |
| Một cạnh | `pt-*`, `pb-*`, `ps-*`, `pe-*` | Rule đã chọn chỉ áp cho đúng cạnh đó |

Class theo từng cạnh chính là thứ luật tiếp xúc cần đến, vì hai cạnh trục block của cùng một dải
thường lấy hai giá trị khác nhau. `px-4 pt-4 pb-3` là PADDING-4 ở ba cạnh và PADDING-3 ở cạnh chạm
separator, và mỗi cạnh vẫn phải gọi tên case của riêng nó.

Trên cùng một phần tử, class hẹp hơn thắng ở những cạnh nó gọi tên chứ không cộng vào nhau, nên
`p-4 pb-3` cho ra `1rem` ở ba cạnh và `.75rem` ở cạnh dưới. Giữa hai phần tử lồng nhau thì padding
cộng dồn, và đó là lý do một wrapper thêm vào chỉ để sửa một cạnh lại tạo ra inset không ai muốn.

## File này không quyết định

Khoảng cách giữa các phần tử ngang hàng thuộc về [Gap](gap.md). Khoảng lệch ra ngoài thuộc về
[Margin](margin.md). Page inset thuộc về `PageContainer` và không phải quyết định của ứng dụng.
