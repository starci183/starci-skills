# Thực thi `fe.surface.audit`

## Một việc duy nhất

Quan sát một bề mặt đã render và trả về các finding. Đây là một lần gọi operator tuyến tính. Nó không
gọi operator khác, không điều phối workflow, không tự dừng giữa chừng, và không trả về chỉ dẫn điều
khiển. Nó không sửa gì, không restyle gì, và không ghi product source.

Ở đây, sẵn sàng, chụp và phán xét là một việc chứ không phải ba. Chia nhỏ ra đã sinh ra một kiểu hỏng
quen thuộc: một ảnh chụp lấy trước lúc bề mặt sẵn sàng, được phán xét bởi một bước không còn biết điều
đó, dựa trên bằng chứng mà chính nó không thu thập. Một operator vừa chờ, vừa đo, vừa phán xét dưới
cùng một receipt thì không thể đánh mất mối liên hệ ấy.

## Phép đo luôn thắng lời khai

Mỗi node mang những mã nó khai là mình thoả. Audit đo đúng thứ bề mặt render ra và đối chiếu phép đo
với lời khai.

Lời khai không bao giờ là bằng chứng đạt. Một node khai `GAP-4` trong khi gap tính ra đo được
`1.5rem` là một finding, và khai bao nhiêu cũng không đổi được phép đo. Đây chính là toàn bộ cơ chế:
lời khai tồn tại để bị bác lại.

## Ba loại finding

1. **Lời khai và phép đo chỏi nhau.** Node nêu tên một rule, giá trị render ra không phải thứ rule đó
   khai. Finding mang cause tag `VALUE_DRIFT` và gọi tên rule bị lệch, mà rule đó phải là một rule
   node ấy thật sự đã khai. Lệch khỏi một rule không ai khai thì không phải là lệch.
2. **Một node mang giá trị presentation mà không khai gì.** Không ai làm chủ giá trị đó, nên không có
   gì để đối chiếu. Finding là `PROOF_MISSING`, thường kèm `WRONG_OWNER`. Một giá trị render ra mà
   không ai khai và cũng không sinh finding nào chính là kiểu hỏng im lặng mà operator này sinh ra để
   chấm dứt.
3. **Một mã được khai không có trong danh sách đã bind.** Node nêu tên một thứ mà knowledge đã publish
   không chứa. Finding là `PROOF_MISSING`, nó ghi mã chưa publish đó vào trường riêng, và không viện
   dẫn rule nào, vì viện dẫn sẽ cho mã bịa ấy vẻ ngoài của một chỗ đứng.

Loại thứ ba là một finding về lời khai mà audit đọc được, không phải lỗi của audit. `UNKNOWN_RULE` là
failure riêng cho trường hợp chính audit với tới một mã ngoài danh sách, và nó chặn lần gọi lại thay
vì sinh ra finding.

## Từ vựng phán quyết

Các finding dùng canonical verdict model đã publish trong knowledge index của UI, và không dùng gì
khác.

Base verdict đúng là `PASS`, `COMMON_CAPABILITY_MISSING`, `COMMON_IMPLEMENTATION_GLITCH`,
`FAMILY_OVERRIDE_GLITCH`, `APP_REIMPLEMENTATION`, `APP_OVERRIDE`, `APP_WORKAROUND`, và
`PROOF_MISSING`.

Cause tag đúng là `VALUE_DRIFT`, `VENDOR_LEAK`, `WRONG_OWNER`, `OFF_SCALE_VALUE`, `DOUBLE_OWNER`,
`PHYSICAL_SIDE_DRIFT`, và `STATE_OR_VIEWPORT_DRIFT`.

Xét theo thứ tự: capability, output Common cô lập, delta của family, delta của app, rồi bằng chứng về
chủ sở hữu và trạng thái. Một finding mang đúng một base verdict và không hoặc nhiều cause tag. Nhiều
tầng cùng hỏng thì sinh ra các finding liên kết; chúng không bao giờ bị gộp thành một verdict tổng hợp
hay bị nuốt bởi logic khớp-đầu-tiên. `PASS` chỉ hợp lệ ở nơi không có finding hỏng nào đứng.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Validate input và resume | input, `@dynamic/fe-source-application.json`, `@workspaces/fe` (binding head đã đóng băng và applied head) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | `@knowledge/ui/proof` (từng topic kèm fingerprint và danh sách mã), `@dynamic/fe-source-application.json` (các lời khai của nó), `@workspaces/fe` (source head đã route), `@worktrees/sessions/central-runtime` (endpoint đang phục vụ) | — | — |
| 3 | Xác nhận bề mặt | `@workspaces/fe` (checkout quan sát được tại route đang dùng) | — | — |
| 4 | Đạt mức sẵn sàng | input (mục matrix cùng viewport, color scheme, trạng thái và điều kiện sẵn sàng đã khai), `@worktrees/sessions/central-runtime` | — | `RUNTIME_UNAVAILABLE` |
| 5 | Chụp | `@worktrees/sessions/central-runtime` (bề mặt đã sẵn sàng của một mục matrix) | `@dynamic/<matrixId>.capture.json` | `EVIDENCE_MISSING` |
| 6 | Đo | `@dynamic/<matrixId>.capture.json`, `@workspaces/fe` (các owner được quan sát và những mã từng node khai) | — | — |
| 7 | Đối chiếu và phán xét | `@dynamic/<matrixId>.capture.json`, `@dynamic/fe-source-application.json` (các lời khai), `@knowledge/ui/proof` (danh sách mã đã bind), `@knowledge/grammars/starci` (luật hiện thực hoá của family) | — | `UNKNOWN_RULE` |
| 8 | Phát ra rồi dừng | tất cả những gì ở trên | `@dynamic/fe-surface-audit.json` | — |

Khâu validate từ chối binding source cũ, applied head khác head quan sát được, topic trùng, mã xếp
nhầm topic, hai matrix id cho cùng một điều kiện, và tiến độ không đổi. Checkout đã route được quan
sát lại trước khi chụp bất cứ thứ gì, và một head khác applied head trả về đúng lỗi trôi đó mà không
chụp gì cả, vì bề mặt đó sẽ không phải bề mặt đã được ghi.

Mọi mã được khai đều được tra lại danh sách đã bind và xếp vào nhóm đã biết hoặc chưa publish; không
bao giờ ghi phán quyết cho một node chưa được đo, và mỗi finding đều lấy từ từ vựng canonical. Khâu
phát ra trả đúng một output theo `output.schema.json`, đăng ký mọi ảnh chụp vào `artifactRefs`, và
bind mọi fingerprint. Nó không sửa gì và không bao giờ biến một đề xuất sửa thành phán quyết.

## Audit không đổi gì cả

Không finding nào là một bản sửa, một workaround, hay một chỉ thị. Một chỗ lệch vẫn là chỗ lệch trong
receipt cho tới khi một resolution publish giá trị mới và bên ghi source ghi nó vào, rồi chính bề mặt
đó được audit lại.

Sự tách bạch này chính là lý do receipt có giá trị: một operator có thể tự sửa thứ nó tìm ra thì lúc
nào cũng có thể báo về một bề mặt sạch.

## Thực thi khi resume

Một lần resume bắt đầu lại từ bước validate, chỉ dùng lại những quan sát có fingerprint không đổi, rồi
tiêu thụ đúng phần delta. Resume không thêm được thay đổi nào về knowledge, applied source, matrix hay
runtime thì trả `NO_PROGRESS`. Knowledge publish lại phải đến dưới dạng fingerprint mới của topic;
cùng một fingerprint không thể cho ra một phán quyết khác.

## Các đòn tấn công bắt buộc

Operator không được báo cáo một lần audit khi còn bất kỳ mục nào sau đây chưa xử lý:

- một mục matrix đã khai không sinh ra ảnh chụp nào;
- một finding viện dẫn bằng chứng không phải ảnh chụp của mục nó gọi tên;
- một phán quyết được ghi cho một node và thuộc tính chưa từng được đo;
- một giá trị render ra không mang lời khai nào mà không có gì nói ra điều đó;
- một mã được khai tra ra không có gì mà không finding nào gọi tên nó;
- một chỗ lệch gọi tên một rule mà node đó chưa bao giờ khai;
- một `PASS` đứng trên cùng node và cùng thuộc tính với một finding hỏng;
- một lời khai được chấp nhận như bằng chứng rằng node đó đạt.
