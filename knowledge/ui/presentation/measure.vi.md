# Measure presentation

File này trả lời đúng một câu hỏi: một vùng nội dung do ứng dụng sở hữu thì chiếm bao nhiêu chỗ.

Bước composition đã chọn xong cây DOM và các Grammar object. Measure giải quyết ràng buộc chiều rộng
và chiều cao trên những vùng ứng dụng sở hữu. Kích thước bên trong một card, input, control hay shell
đều thuộc về Grammar.

## Danh mục

Chiều cao không có thang giá trị đóng, còn chiều rộng chỉ có thang cho trần (xem Thang chiều rộng),
nên số của rule ở đây là địa chỉ trên tập các kiểu ràng buộc chứ không phải vị trí trên một thang. Ưu tiên rule sớm nhất mà vẫn chạy được: co giãn
trước, vừa nội dung sau, rồi mới tới chặn trần, cuối cùng mới tới cố định.

| Rule | Ràng buộc | Quyết định |
| --- | --- | --- |
| MEASURE-1 | Khổ trang | Một trang được route lấy khổ đóng gói nào |
| MEASURE-2 | Rộng co giãn | Vùng đi theo chiều rộng nó được cấp |
| MEASURE-3 | Rộng theo nội dung | Vùng chỉ nở đúng bằng nội dung của nó |
| MEASURE-4 | Chặn trần chiều rộng | Vùng co giãn ngừng nở khi qua ngưỡng đọc được |
| MEASURE-5 | Chiều cao tối thiểu | Vùng giữ một mức sàn rồi vẫn cao thêm được |
| MEASURE-6 | Chiều cao kế thừa | Vùng lấp đầy một chiều cao mà host đã định |
| MEASURE-7 | Chặn trần chiều cao | Vùng ngừng cao và giao việc cuộn cho một ranh giới |

Chiều rộng hay chiều cao cố định cố ý không có trong danh mục. Một vùng không phản ứng được với nội
dung hay viewport là quyết định layout đã chốt trước bước presentation, và nó được báo cáo chứ không
được viết ở đây.

## Owner

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Vùng thuộc về ứng dụng | Viết class |
| Tên component | Common đã ràng buộc kích thước này | Không viết gì, chỉ truyền prop |
| `—` | Common chưa có đường dùng công khai | Viết class, ghi nhận là workaround |

Mọi vùng có thể nhận nội dung dài đều phải mang thêm `min-w-0`. Thiếu nó, một phần tử con trong flex
hay grid từ chối co nhỏ hơn nội dung của nó và đẩy các phần tử kề ra khỏi viewport. Common áp nó
xuyên suốt các renderer của mình; một vùng của ứng dụng có bọc chữ thì phải làm y như vậy.

## Thang chiều rộng

Một chiều rộng bị chặn trần lấy đúng một bậc của thang đóng này, không gì khác; chiều rộng tuỳ ý như
`max-w-[720px]` nằm ngoài thang và bị `frontend.presentation.resolve` gỡ bỏ. Trần cho văn xuôi `max-w-[65ch]`
là bậc duy nhất tính theo ký tự, vì độ dài dòng đi theo con chữ. Chốt của owner ngày 2026-09-03: thang
này cố định cho mọi ứng dụng, không suy ra theo từng dự án.

| Bậc | Class | Chiều rộng |
| --- | --- | --- |
| W-sm | `max-w-sm` | 24rem |
| W-md | `max-w-md` | 28rem |
| W-lg | `max-w-lg` | 32rem |
| W-xl | `max-w-xl` | 36rem |
| W-2xl | `max-w-2xl` | 42rem |
| W-3xl | `max-w-3xl` | 48rem |
| W-4xl | `max-w-4xl` | 56rem |
| W-5xl | `max-w-5xl` | 64rem |
| W-6xl | `max-w-6xl` | 72rem |
| W-7xl | `max-w-7xl` | 80rem |
| W-prose | `max-w-[65ch]` | 65 ký tự |

## Measure mà Common đã sở hữu

Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.

| Component | Phần tử hoặc điều kiện | Rule |
| --- | --- | --- |
| `NavigationFeatureNav` | root | MEASURE-2 |
| `PageContainer` | root | MEASURE-1 |
| `Progress` | root | MEASURE-2 |
| `Rail` | body, height="fill" | MEASURE-6 |
| `Sidebar` | root, presentation!="drawer" | MEASURE-6 |
| `Sidebar` | root, presentation="drawer" | MEASURE-2 |
| `TextAction` | root | MEASURE-3 |
| `WorkspaceShell` | layout | MEASURE-1 |

## MEASURE-1 — Khổ trang

Một trang được route lấy đúng một khổ đóng gói sẵn thay vì tự chế khổ riêng.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Trang toàn văn xuôi liên tục, phải giữ cho đọc được | `PageContainer` | `<PageContainer measure="reading">` |
| Case 2 | Trang sản phẩm thường gồm card, bảng và control | `PageContainer` | `<PageContainer>`, mặc định product |
| Case 3 | Trang mà nội dung thật sự trải hết viewport, kiểu bảng kéo thả hay canvas | `PageContainer` | `<PageContainer measure="full">` |

Không phải rule này: dựng lại khổ trang bằng một cái chặn trần cộng margin canh giữa. Như vậy là chế
lại một component mà trang đã có sẵn.

## MEASURE-2 — Rộng co giãn

Vùng lấy đúng chiều rộng nó được cấp và giữ tính responsive.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một vùng cần đi theo chiều rộng do layout host cấp | `App` | `<section className="w-full">` |
| Case 2 | Một control hoặc field phải trải hết cột của nó | `App` | `w-full` trên wrapper do app sở hữu, không bao giờ viết bên trong control |

Không phải rule này: ép một phần tử con vượt quá khổ mà cha dự định.

## MEASURE-3 — Rộng theo nội dung

Vùng chỉ nở đúng bằng phần nội dung của nó cần.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một vùng gọn mà chiều rộng nên đi theo chính nội dung của nó | `App` | `<aside className="w-fit max-w-full">` |
| Case 2 | Nội dung hàng bên trong một vùng cuộn ngang | `HorizontalScrollRegion` | Ghép region, các con đã tự lấy `max-content` |

Luôn đi kèm `w-fit` với `max-w-full`. Không có cái chặn đó, nội dung dài hơn dự tính sẽ nong vùng
vượt khỏi container và đẻ ra thanh cuộn ngang ở cấp trang.

Không phải rule này: văn xuôi dài, hoặc một vùng phải lấp đầy host của nó.

## MEASURE-4 — Chặn trần chiều rộng

Vùng co giãn ngừng nở khi nở thêm không còn giúp người đọc.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Vùng văn xuôi mà độ dài dòng cần một ngưỡng trên để còn đọc được | `App` | `<article className="max-w-[65ch]">` |
| Case 2 | Vùng nội dung mất tính gom nhóm khi vượt một chiều rộng đã biết | `App` | `<main className="w-full max-w-6xl">`, trần là một bậc của Thang chiều rộng |
| Case 3 | Vùng bị chặn trần mà nội dung hẹp hơn cột chứa nó, khoảng trống sẽ dồn về một bên nếu để nguyên (sân bida, một form, một khung media) | `App` | `<section className="w-full max-w-4xl mx-auto">`: trần cộng `mx-auto`, không bao giờ chặn trần mà canh trái |

Chặn theo số ký tự thì đi theo chính con chữ và thuộc về văn xuôi. Chặn theo độ dài thì thuộc về nội
dung hỗn hợp. Cả hai đều không áp cho bảng, media hay code, vì những thứ đó có chiều rộng nội tại
riêng.

Không phải rule này: thêm chặn trần chỉ vì ảnh chụp nhìn trống.

## MEASURE-5 — Chiều cao tối thiểu

Vùng giữ một mức sàn mà vẫn cao thêm được theo nội dung.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một vùng cần khung ổn định trước khi biết chiều cao nội dung | `App` | `<section className="min-h-[24rem]">` |
| Case 2 | Một vùng mà trạng thái rỗng và trạng thái có dữ liệu không được làm nhảy trang | `App` | Cùng một mức sàn cho cả hai trạng thái |

Không phải rule này: chừa chỗ cho nội dung vốn dĩ không tồn tại. Trạng thái rỗng chiếm vùng của chính
nó chứ không phải một khoảng trống giữ sẵn.

## MEASURE-6 — Chiều cao kế thừa

Vùng lấp đầy một chiều cao mà host đã định sẵn.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một vùng nằm trong host đã cấp chiều cao xác định | `App` | `<section className="h-full">` trong một cha đã có kích thước |
| Case 2 | Một rail phải chạy hết chiều cao shell của nó | `Rail` | `height="fill"` trên rail |

`h-full` quy chiếu theo chiều cao xác định của cha và không làm gì nếu cha không có. Trong một chuỗi
không xác định, nó im lặng không có tác dụng, và điều đó đọc lên như lỗi style chứ không phải như
thiếu chiều cao.

Không phải rule này: kéo giãn nội dung tài liệu thông thường.

## MEASURE-7 — Chặn trần chiều cao

Vùng ngừng cao thêm, và một thứ gì đó bên trong nó cuộn.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một danh sách hoặc panel không được đẩy trang vượt quá viewport | `VerticalScrollRegion` | Ghép region, nó sở hữu ranh giới đó |
| Case 2 | Một vùng do app sở hữu, có chiều cao giới hạn và có cuộn riêng | `App` | `max-h-*` đi cùng rule overflow tương ứng |

Chặn trần chiều cao mà không có chủ cuộn thì cắt cụt nội dung trong im lặng. Hai quyết định đó đi
liền nhau.

Không phải rule này: chặn một vùng để giấu nội dung mà người đọc vẫn cần.

## File này không quyết định

Ranh giới nào cuộn hay cắt thuộc về [Overflow](overflow.md). Chữ hành xử ra sao bên trong vùng thuộc
về [Text flow](text-flow.md). Khoảng cách quanh và bên trong vùng thuộc về [Gap](gap.md) và
[Padding](padding.md).
