# Font presentation

File này trả lời đúng một câu hỏi: một dòng chữ mà ứng dụng đã xếp hạng xong thì render bằng prop
typography công khai nào.

Bước composition đã chọn xong cây DOM và các Grammar object. Ứng dụng quyết định hạng thông tin,
Grammar render hạng đó. Ứng dụng không bao giờ viết class cỡ chữ, độ đậm, line height hay tracking,
và không ghi đè typography bên trong một Grammar component khác.

## Thang giá trị

Thang chữ là thang đóng, dùng chung cho `Text` và `Heading`. Số của rule là thứ tự trên thang đó,
nhỏ trước. Nó không phải bậc Tailwind và cũng không phải cấp heading.

| Rule | Render ra | `Text` | `Heading` |
| --- | --- | --- | --- |
| FONT-1 | `text-xs` / `leading-4` | `size="xs"` | `level={4}` |
| FONT-2 | `text-sm` / `leading-5` | `size="sm"` | `level={3}` |
| FONT-3 | `text-base` / `leading-6` | `size="md"`, mặc định | `level={2}` |
| FONT-4 | `text-xl` | không có | `level={1}` |
| FONT-5 | `text-3xl` / `leading-9` | `size="metric-lead"` | không có |
| FONT-6 | `text-4xl` / `leading-tight` | không có | `scale="display"` |

`Text` và `Heading` không thay thế nhau được dù cùng cỡ. Heading khai báo cấu trúc tài liệu, còn một
dòng text thì không. Chọn `Heading` để lấy cỡ chữ, hoặc chọn `Text` để né một mục trong dàn bài, là
lỗi cấu trúc chứ không phải lỗi typography.

Tracking không phải quyết định của ứng dụng. `Heading` chỉ áp `tracking-tight` ở FONT-4 và FONT-6.

## Owner

Typography thuộc về Grammar. Ô owner gọi tên component nào render hạng đó.

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| Tên component | `Text` hoặc `Heading` render hạng này | Chỉ truyền prop |
| `—` | Hạng này chưa có prop công khai | Không viết gì, báo là thiếu |

File này không có owner `App`. Một class typography do ứng dụng viết là `APP_OVERRIDE`, và một
`font-size` hay `font-weight` thô làm đổi hạng ngữ nghĩa thì bị từ chối kể cả khi pixel trùng khớp.

## FONT-1 — `text-xs` / `leading-4`

Cỡ công khai nhỏ nhất, cho hạng thông tin phụ thấp nhất.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Metadata ngắn, vẫn hiểu được ở cỡ nhỏ nhất | `Text` | `<Text size="xs">Optional</Text>` |
| Case 2 | Nhãn của một vùng lồng bên trong một section đã có tiêu đề | `Heading` | `<Heading level={4}>Card details</Heading>` |

`Text size="xs"` luôn quy về muted và không nâng lên tone khác được. `Heading level={4}` mang đúng
cách xử lý muted đó.

Không phải rule này: câu văn thường, hoặc bất kỳ dữ kiện nào người đọc không được bỏ sót. Dùng
FONT-2 hoặc FONT-3.

## FONT-2 — `text-sm` / `leading-5`

Cỡ đọc gọn cho phần copy phụ nhưng vẫn thành câu hoàn chỉnh.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một dòng hoàn chỉnh xếp dưới body copy thường, kiểu mốc thời gian hay một dữ kiện ngắn | `Text` | `<Text size="sm">Updated 2 minutes ago</Text>` |
| Case 2 | Tiêu đề vùng cấp ba bên trong một section | `Heading` | `<Heading level={3}>Payment method</Heading>` |

Không phải rule này: thu nhỏ body copy cho vừa một container quá chật. Sửa cái container.

## FONT-3 — `text-base` / `leading-6`

Cỡ đọc thường, và là giá trị mặc định khi không truyền size.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Copy giải thích thông thường, ưu tiên đọc ở mức bình thường | `Text` | `<Text>Your subscription renews on 12 March.</Text>` |
| Case 2 | Tiêu đề của một section bên trong trang | `Heading` | `<Heading level={2}>Billing</Heading>` |

## FONT-4 — `text-xl`

Cỡ tiêu đề cấp trang, mang tracking chặt.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Tiêu đề duy nhất gọi tên cả trang hoặc cả route | `Heading` | `<Heading level={1}>Account</Heading>` |

Không phải rule này: một `level={1}` thứ hai trên cùng trang. Một tài liệu, một tiêu đề cấp cao nhất.

## FONT-5 — `text-3xl` / `leading-9`

Cách trình bày số lớn cho một giá trị vốn đã quan trọng.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Chỉ số hoặc giá trị ngắn duy nhất, là dữ kiện chính của vùng đó | `Text` | `<Text size="metric-lead" weight="semibold">84%</Text>` |

Không phải rule này: câu văn, trang trí, hoặc giả làm tiêu đề. Nó không tạo ra ngữ nghĩa heading nào.

## FONT-6 — `text-4xl` / `leading-tight`

Nhấn mạnh cỡ display áp lên một heading vẫn giữ nguyên cấp ngữ nghĩa của nó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Tiêu đề gốc trang cần sức nặng kiểu landing hoặc marketing | `Heading` | `<Heading level={1} scale="display">Learn without limits</Heading>` |

Không phải rule này: phóng to một heading lồng bên trong. `scale` đổi công thức hiển thị chứ không
bao giờ đổi vị trí trong dàn bài.

## Độ đậm

Độ đậm là trục thứ hai, không phải một vị trí trên thang cỡ chữ. Tập giá trị công khai của nó là
tập đóng.

| Prop | Render ra | Dùng cho |
| --- | --- | --- |
| `weight="normal"` | `font-normal`, mặc định | Copy để đọc và các dữ kiện thường |
| `weight="medium"` | `font-medium` | Một nhãn gọn, hoặc một tiêu đề nằm trên phần mô tả của chính nó |
| `weight="semibold"` | `font-semibold` | Dữ kiện phải tìm thấy đầu tiên trong vùng của nó |

Độ đậm chỉ tinh chỉnh một hạng mà ứng dụng đã chọn. Nó không đẻ ra một cấp phân cấp mới, và không
thay thế được một heading. `Heading` tự áp độ đậm theo từng cấp và không nhận prop weight.

Đậm hơn `semibold` chưa có prop công khai. Ý đồ nào cần tới nó thì coi là thiếu capability, đừng
viết class.

## File này không quyết định

Màu nào diễn đạt hạng đó thuộc về [Tone](tone.md). Dòng chữ xuống dòng, canh lề hay cắt bớt ra sao
thuộc về [Text flow](text-flow.md). Vùng chữ được bao nhiêu chỗ thuộc về [Measure](measure.md).
