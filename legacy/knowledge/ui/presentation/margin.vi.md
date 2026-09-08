# Margin presentation

File này trả lời đúng một câu hỏi: khi nào một object do ứng dụng sở hữu được phép đẩy ra khỏi xung
quanh bằng một khoảng lệch ngoài, và lệch bao nhiêu.

Margin là ngoại lệ trong hệ này chứ không phải mặc định. Khoảng cách giữa các phần tử ngang hàng
thuộc về gap của cha, còn khoảng cách từ ranh giới tới nội dung thuộc về padding của chính ranh giới
đó. Margin chỉ đúng khi một object cần một khoảng lệch mà không quan hệ cha nào diễn đạt được, và lý
do đó phải gọi được tên.

Common phản ánh đúng như vậy: nó reset `margin` về `0` ở gần như mọi renderer nó sở hữu và để cha
nắm nhịp. Ứng dụng nào với tay tới margin trước là tạo ra hai chủ cho cùng một khoảng cách, tức
`DOUBLE_OWNER`.

## Thang giá trị

`COMMON_SPACING_SCALE` là thang đóng. Số của rule là thứ tự trên thang đó. Nó không phải số bậc
Tailwind, và hai số này lệch nhau từ MARGIN-5 trở đi.

| Rule | Class | Giá trị | Token Common |
| --- | --- | --- | --- |
| MARGIN-0 | `m-0` | `0` | không có |
| MARGIN-1 | `m-1` | `.25rem` | không có |
| MARGIN-2 | `m-2` | `.5rem` | không có |
| MARGIN-3 | `m-3` | `.75rem` | không có |
| MARGIN-4 | `m-4` | `1rem` | không có |
| MARGIN-5 | `m-6` | `1.5rem` | không có |
| MARGIN-6 | `m-8` | `2rem` | không có |

Common không publish token margin nào. `MARGIN-AUTO` đứng riêng và không mang giá trị nào trên thang.

Các giá trị rem chỉ quy ra `0 / 4 / 8 / 12 / 16 / 24 / 32` pixel CSS khi root font size tính được là
`16px`. Khi kiểm tra lúc chạy thì dùng `expectedPx = remFactor * observedRootFontPx`.

## Owner

Mỗi case gọi tên ai sở hữu khoảng lệch. Owner quyết định ứng dụng có được viết class hay không.

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Khoảng lệch là một ngoại lệ đặt chỗ có tên của ứng dụng | Viết class |
| Tên component | Common đã đặt hoặc reset margin bên trong component đó | Không viết gì, chỉ ghép component |
| `—` | Common chưa có đường dùng công khai cho quan hệ này | Viết class, ghi nhận là workaround |

Viết class ở chỗ owner là một component chính là `APP_REIMPLEMENTATION`. Thêm margin cho con trong
khi cha đã có gap diễn đạt đúng khoảng cách đó là `DOUBLE_OWNER`.

## Margin mà Common đã sở hữu

Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.

| Component | Phần tử hoặc điều kiện | Rule |
| --- | --- | --- |
| `Label` | root | MARGIN-0 |
| `MediaFrame` | root | MARGIN-0 |
| `PageContainer` | root | MARGIN-AUTO |
| `SectionHeader` | title | MARGIN-0 |
| `SurfaceAccordionCard` | accordion trigger wrapper | MARGIN-0 |
| `WorkspaceShell` | header, hasHeader | MARGIN-5 |

## MARGIN-0 — `m-0` / `0`

Khoảng lệch bị gỡ đi để một quan hệ của cha trở thành chủ duy nhất của khoảng cách.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một thẻ HTML mang margin mặc định chọi lại composition | `App` | `<h2 className="m-0">` trong section app đã tự nắm gap |
| Case 2 | Nội dung article đã render, nhịp do chính article nắm | `MarkdownArticle` | Ghép article, không viết margin |
| Case 3 | Bất kỳ renderer Common nào đã tự reset margin của nó | Chính component đó | Ghép nó, không viết margin |

Không phải rule này: xóa một khoảng lệch có chủ ý mà không chuyển quyết định đó cho một chủ thật sự
thì quan hệ đó thành vô chủ.

## MARGIN-1 — `m-1` / `.25rem`

Khoảng hở ngoài nhỏ nhất, cho một object đặt chính xác mà chỉ cần vừa đủ rời khỏi mép.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một nhãn đặt tuyệt đối, nếu không lệch thì chạm luôn vào mép khung chứa | `App` | `<span className="absolute left-0 top-0 m-1">` |

Không phải rule này: lặp lại trên nhiều phần tử ngang hàng là đang dựng lại một cái gap. Dùng GAP-1
trên cha.

## MARGIN-2 — `m-2` / `.5rem`

Khoảng lệch gọn cho một object đặt độc lập.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Chú thích hoặc control phủ lên, neo vào một góc canvas do app sở hữu | `App` | `<aside className="absolute bottom-0 right-0 m-2">` |

Không phải rule này: dùng thay cho padding của container hoặc gap giữa các phần tử. Dùng PADDING-2
hoặc GAP-2.

## MARGIN-3 — `m-3` / `.75rem`

Khoảng lệch dày dặn nhưng vẫn thấy rõ, cho một ngoại lệ đặt chỗ có tên.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một object đặt trên nền nhiều chi tiết, để `.5rem` thì đọc thành chật | `App` | `<aside className="absolute right-0 top-0 m-3">` |

Không phải rule này: các mục lặp lại trong một danh sách. Dùng GAP-3 trên cha.

## MARGIN-4 — `m-4` / `1rem`

Khoảng lệch ngoài chuẩn cho một object có ngoại lệ đặt chỗ tường minh.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một object đứng riêng cần khoảng hở đều với khung chứa mà khung đó không sở hữu được | `App` | `<aside className="m-4">` |
| Case 2 | Khoảng trống phía sau một khối code trong nội dung article | `FencedCodeBlock` | Ghép khối, không viết margin |
| Case 3 | Nhịp trục block quanh một đường kẻ ngang trong nội dung article | `MarkdownArticle` | Ghép article, không viết margin |

Không phải rule này: ghép nó với padding của cha cho cùng một mục đích mép tới nội dung là tạo hai
chủ cho một khoảng cách.

## MARGIN-5 — `m-6` / `1.5rem`

Khoảng lệch lớn, làm một object đứng riêng tách hẳn khỏi khung chứa của nó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một ngoại lệ có tên cần rời khỏi ranh giới xa hơn mức lệch chuẩn | `App` | `<aside className="m-6">` |
| Case 2 | Khoảng tách bên dưới header của một workspace | `WorkspaceShell` | Ghép shell, không viết margin |

Không phải rule này: khoảng tách giữa các phần tử ngang hàng cỡ lớn. Dùng GAP-5 trên cha.

## MARGIN-6 — `m-8` / `2rem`

Khoảng hở ngoài lớn nhất, cho một object cố ý tách rời.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một object phải đọc lên là tách khỏi mọi thứ quanh nó, và có lý do nói được | `App` | `<aside className="m-8">` |

Không phải rule này: nhịp chung của trang, hoặc lặp lại trên nhiều phần tử ngang hàng. Dùng GAP-6
trên cha.

## MARGIN-AUTO — `mx-auto`

Margin ngang tự động chia đều khoảng trống còn lại và canh giữa một container đã giới hạn chiều rộng.
Nó không mang giá trị nào trên thang và không phải một quyết định về khoảng lệch.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một container do app sở hữu, tự giới hạn chiều rộng và phải nằm giữa | `App` | `<main className="mx-auto max-w-3xl">` |
| Case 2 | Một trang dùng khổ và inset đóng gói sẵn | `PageContainer` | Ghép container, nó đã canh giữa sẵn |

Không phải rule này: một phần tử rộng hết khung, hoặc dùng để rải đều khoảng cách giữa các phần tử.
Việc rải đều thuộc về layout của cha.

## Biến thể theo trục

`mx-*` và `my-*` không phải rule riêng. Chúng áp một rule đã có lên một trục, khi chỉ một trục mang
ngoại lệ đó.

| Trục | Class | Nghĩa |
| --- | --- | --- |
| Inline | `mx-*` | Rule đã chọn chỉ áp cho cạnh đầu và cuối theo chiều ngang |
| Block | `my-*` | Rule đã chọn chỉ áp cho cạnh trên và dưới |

Trên cùng một phần tử, `m-*` và `mx-*` tranh nhau hai cạnh ngang chứ không cộng vào nhau. Margin
trục block của hai phần tử kề nhau còn bị gộp lại, và đó là lý do thứ hai để gap của cha mới là chủ
đáng tin của nhịp giữa các phần tử.

## File này không quyết định

Khoảng cách giữa các phần tử ngang hàng thuộc về [Gap](gap.md). Khoảng cách từ ranh giới tới nội
dung thuộc về [Padding](padding.md). Giới hạn chiều rộng thuộc về [Measure](measure.md).
