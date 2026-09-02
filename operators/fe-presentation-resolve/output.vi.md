# Output của `fe.presentation.resolve`

Operator trả về một vỏ đóng với `outcome` bằng `resolved` hoặc `blocked`. Nó không bao giờ phát ra
handoff hay chỉ dẫn điều phối dạng văn xuôi tự do.

## Receipt khi resolved

Một receipt đã resolved chứa:

- các binding chính xác về project, source, target, cây, knowledge, Grammar, input và tiến độ;
- tham chiếu cây kết quả cùng fingerprint của nó;
- mỗi node và mỗi thuộc tính một quyết định, gọi tên chủ sở hữu, rule, class phát ra, và điều kiện
  quan sát được đã chọn ra rule đó;
- mỗi node do ứng dụng sở hữu một contract, liệt kê những mã node đó khai;
- toàn bộ tập mã đã áp dụng;
- các finding cho thuộc tính do Grammar sở hữu, capability còn thiếu, và class đã bị gỡ.

Receipt cho phép một lần audit sau đo kết quả render và đối chiếu với các lời khai. Nó không chứng
minh cây render đúng, và không mang phán quyết, điểm số hay lời khẳng định đạt nào.

## Các quyết định

Mỗi quyết định gọi tên đúng một chủ sở hữu:

| Owner | Nghĩa | Class | Contract |
| --- | --- | --- | --- |
| `app` | Ứng dụng sở hữu ranh giới này | Bắt buộc | Có công bố |
| `grammar` | Một component Common đã sở hữu nó | Cấm | Không có |
| `none` | Common chưa có đường công khai | Bắt buộc, dưới dạng workaround | Có công bố |

`owner: "grammar"` vẫn gọi tên rule mà component đó thoả, để một lần audit có thể kiểm chính component
ấy theo cùng một luật với ứng dụng. `owner: "none"` bắt buộc phải có finding
`COMMON_CAPABILITY_MISSING` đi kèm; một workaround không ghi nhận gì sẽ đọc lên như một cái pass bình
thường.

## Contract

Contract là lời khai, không phải phán quyết. Nó nói node đó định thoả những rule nào, để một lần audit
sau có thể bác lại.

Mọi node do ứng dụng sở hữu đều công bố một contract. Một node mang class presentation mà không có
contract thì bị từ chối, vì một giá trị không ai khai chính là thứ mà không lần audit nào kiểm được.

## Receipt khi blocked

Receipt đã blocked không có phần resolution. Nó chứa đúng một failure có kiểu, các node và tham chiếu
liên quan, domain sở hữu, tính lặp lại được, và chỉ khi lặp lại được thì mới có token resume dùng một
lần kèm phần delta vật chất cần bổ sung.

## Mã lỗi

| Mã | Vấn đề sở hữu | Delta vật chất hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | Input đã sửa. |
| `SOURCE_DRIFT` | Source quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `OWNER_CONFLICT` | Một node cần sửa nằm ngoài trần được phép sửa. | Thẩm quyền owner đã sửa. |
| `KNOWLEDGE_UNBOUND` | Một thuộc tính có trong cây mà không topic nào bind cho nó. | Binding topic còn thiếu. |
| `UNKNOWN_RULE` | Một mã ngoài danh sách đã bind bị với tới. | Topic publish nó, hoặc một mã đã sửa. |
| `RULE_MISSING` | Không case nào đã publish khớp điều kiện quan sát được. | Case được publish, và fingerprint topic bind lại. |
| `GRAMMAR_UNPUBLISHED` | Package Grammar chưa publish hoặc fingerprint đã cũ. | Package đã publish. |
| `NO_PROGRESS` | Một resume không thêm delta nào. | Knowledge, Grammar, cây hoặc scope mới thật sự. |

`RULE_MISSING` là kết quả dự kiến khi knowledge chưa đủ, không phải lỗi của cây. Nó thuộc về người
viết knowledge, và giải quyết lại chính cây đó sau khi publish mới là bước tiếp theo đúng.

## Bất biến liên trường

- `outcome="resolved"` đòi `receipt.status="resolved"`, `resolution` khác null, `failure` null, và
  `resume` null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `resolution` null, và `failure` khác null. Một
  failure lặp lại được thì đòi có resume; một failure không lặp lại được thì cấm có resume.
- Mỗi quyết định giải quyết đúng một thuộc tính trên đúng một node, đúng một lần.
- Mọi quyết định do ứng dụng sở hữu hoặc dạng workaround đều gọi tên một rule có trong
  `appliedRuleIds`.
- Mọi quyết định do Grammar sở hữu đều có class null và gọi tên rule mà component đó thoả.
- Mọi mã trong contract đều đã được áp dụng, và node của nó có một quyết định tương ứng.
- Mọi node do ứng dụng sở hữu đều công bố một contract.
- Mọi quyết định `owner: "none"` đều có finding `COMMON_CAPABILITY_MISSING` trên cùng node và cùng
  thuộc tính.
- Class của một topic có thang phải đồng ý với thứ tự trong mã của nó. `GAP-5` render ra `gap-6`,
  `PADDING-5` render ra `p-6`, và `MARGIN-AUTO` render ra một token `auto`.
- `artifactRefs` có đăng ký cây kết quả.
- `handoff` luôn là `null`.

## Kết quả thực tế

Giải quyết một cây dashboard: chồng vùng của trang lấy `GAP-5`, chồng khối bên trong một section lấy
`GAP-4`, nội dung card quy về card làm chủ và không phát class nào, còn cặp danh tính gọn phát `gap-1`
dưới dạng workaround có ghi nhận. Ba node công bố contract và một node thì không, vì chủ của nó là một
component.

Giải quyết một cây có quan hệ chưa được biểu diễn: lần gọi trả `RULE_MISSING` gọi tên node đó, và
không giá trị nào được chọn ở bất kỳ đâu trong cây.
