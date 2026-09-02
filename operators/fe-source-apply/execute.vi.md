# Thực thi `fe.source.apply`

## Một việc duy nhất

Ghi một cây đã resolve xong vào product source, bên trong một trần owner đã đóng băng và một tập file
đã khai, và không làm gì khác. Đây là một lần gọi operator tuyến tính. Nó không gọi operator khác,
không điều phối workflow, không tự dừng giữa chừng, và không trả về chỉ dẫn điều khiển.

Cấu trúc, thứ tự, việc chọn Grammar component, câu chữ, hành vi, mọi giá trị presentation và mọi lời
khai contract đều đã được quyết sẵn trong resolution receipt. Operator này chỉ trả lời những byte đó
rơi vào đâu, và chứng minh rằng không có gì khác bị xê dịch.

## Ranh giới đột biến

Đây là operator duy nhất trong pipeline frontend ghi vào product source. Direction quyết xây cái gì và
không ghi gì. Resolution quyết mọi giá trị và chỉ ghi artifact của chính nó. Audit quan sát và không
ghi gì. Người ghi duy nhất tồn tại để một receipt có thể giải trình mọi byte đã vào repository, điều
bất khả thi khi ba operator mỗi cái ghi một ít.

Vì là người ghi duy nhất, nó cũng là chỗ duy nhất một giá trị bịa có thể lọt vào source. Chính vì thế
nó không có cách nào sinh ra một giá trị như vậy.

## Không bịa giá trị

Mọi class mà lần ghi sinh ra đều phải có sẵn trong `context.resolution.classNames`, và mọi mã rule nó
mang vào thuộc tính contract đều phải có sẵn trong `context.resolution.appliedRuleIds`. Cả hai danh
sách đều đầy đủ và bị đóng băng bằng fingerprint.

Ba điều cấm gánh việc này, và mỗi điều đều được kiểm tra chứ không phải chỉ khuyên:

1. Một class không có trong resolution là `WRITE_REJECTED`. Không làm tròn về giá trị gần đúng, không
   chép từ file bên cạnh, và không format lại theo kiểu làm đổi một bậc.
2. Một file mà lần ghi sẽ đụng tới nhưng write set không khai là `WRITE_REJECTED`, kể cả khi nó rõ
   ràng cần được sửa. Bước tiếp theo đúng là một write set đã sửa, không phải một lần ghi rộng hơn.
3. Một đường đã khai mà gốc owner của nó không chứa là `OWNER_CONFLICT`. Chỉ thuộc về owner thôi thì
   chưa phải là trần.

Operator không bao giờ sửa resolution. Một cây resolve ra thứ mà source không diễn đạt được thì được
trả về cho người resolve, và chính source đó được ghi lại sau khi một resolution mới được publish và
fingerprint của nó được bind lại.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Validate input và resume | input, `@receipt/fe-presentation-resolution/<invocationId>`, `@fe` (binding head đã đóng băng) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | `@receipt/fe-presentation-resolution/<invocationId>` (fingerprint, danh sách `classNames`, danh sách rule, cây đã resolve), `@fe` (source head đã route, write set đã khai kèm các gốc owner), `@receipt/fe-direction-decision/<invocationId>` (ý đồ) | — | `RESOLUTION_STALE`, `OWNER_CONFLICT` |
| 3 | Xác nhận head | `@fe` (checkout quan sát được tại route đang dùng) | — | — |
| 4 | Fingerprint trước | `@fe` (mọi đường đã khai mà đang tồn tại) | — | — |
| 5 | Chiếu cây đã resolve lên các đường đã khai | `@receipt/fe-presentation-resolution/<invocationId>` (cây đã resolve), `@fe` (các đường đã khai) | — | — |
| 6 | Đối chiếu mọi giá trị sinh ra với danh sách | `@receipt/fe-presentation-resolution/<invocationId>` (danh sách class và rule đã đóng băng) | — | `WRITE_REJECTED` |
| 7 | Ghi, rồi fingerprint sau | `@fe` (nội dung hiện tại của từng đường) | `@fe` (`<đường trong write set>`) | — |
| 8 | Báo cáo mọi đường đã khai | `@fe` (write set và kết quả từng lần ghi) | — | — |
| 9 | Phát ra rồi dừng | tất cả những gì ở trên | `@artifacts/application-receipt.json` | — |

Khâu validate từ chối binding source cũ, resolution được nêu tên nhưng không được bind, owner chồng
lấn, đường dẫn trùng, đường nằm ngoài gốc owner của nó, và tiến độ không đổi. Head được quan sát lại ở
bước 3 trước khi bất cứ file nào được mở, và một head khác `input.project.sourceHead` trả về đúng lỗi
trôi đó mà không file nào bị đụng vào.

Việc lấy fingerprint trước khi ghi là thứ biến "không đổi" thành một phép đo thay vì một ý kiến. Bản
chiếu sinh ra, cho mỗi đường, nội dung mà resolution đã quyết sẵn; đường nào resolution không nói gì
thì không sinh ra gì. Phép kiểm danh sách chạy trên bản chiếu chứ không phải sau khi ghi, nên một lần
ghi bị từ chối để source y nguyên: một class nằm ngoài resolution bị từ chối, không làm tròn về giá
trị gần đó, không chép từ file bên cạnh, và không định dạng lại theo kiểu đổi mất một nấc; còn một
file mà write set không khai thì bị từ chối ngay cả khi nó rõ ràng cần thay đổi.

Mỗi đường có bản chiếu khác nội dung hiện tại thì được tạo hoặc sửa; đường có bản chiếu trùng nội dung
hiện tại thì ghi nhận là `unchanged` và không phát class nào. Không mục nào trong write set bị bỏ qua
im lặng: đường đã khai mà không có lần ghi nào thì báo `WRITE_SET_PATH_UNUSED`, còn file được tạo mới
thì báo `FILE_CREATED`. Khâu phát ra ghi application receipt dưới `input.project.artifactRootRef`,
đăng ký mọi đường đã ghi vào `artifactRefs`, bind mọi fingerprint, và không claim đã có bằng chứng
visual, quality hay UAT: operator này biết nó đã ghi gì, không bao giờ biết thứ đó render ra sao.

## Chế độ phát contract là thứ thừa hưởng

`contractEmission` được chép lại từ resolution và không bao giờ được quyết lại ở đây. Với `attribute`,
mọi lần ghi mang class đã resolve đều mang theo các lời khai `data-contract` tương ứng. Với
`receipt-only`, không lần ghi nào mang thuộc tính đó, và resolution receipt vẫn là bản ghi bền.

Một lần ghi mang class đã resolve mà không mang lời khai thì bị từ chối, vì khi đó lần audit sau sẽ
gặp một giá trị không có ý định nào được nói ra để mà bác lại.

## Thực thi khi resume

Một lần resume bắt đầu lại từ bước validate, chỉ dùng lại những quan sát có fingerprint không đổi, rồi
tiêu thụ đúng phần delta. Resume không thêm được thay đổi nào về resolution, write set hay scope thì
trả `NO_PROGRESS`. Cây được resolve lại phải đến dưới dạng fingerprint mới của resolution; cùng một
fingerprint không thể cho ra một lần ghi khác.

## Các đòn tấn công bắt buộc

Operator không được báo cáo một lần ghi khi còn bất kỳ mục nào sau đây chưa xử lý:

- một class hoặc mã sinh ra không có trong danh sách của resolution;
- một file cần được sửa mà write set không khai nó;
- một đường đã khai nằm ngoài gốc của chính owner đã khai nó;
- một đường đã khai không sinh ra gì mà không có gì nói ra điều đó;
- một lần ghi báo là đã sửa trong khi fingerprint không hề đổi;
- class đã resolve được ghi mà thiếu lời khai contract của nó;
- mọi đường đã khai đều trả về không đổi mà lần gọi vẫn báo thành công.
