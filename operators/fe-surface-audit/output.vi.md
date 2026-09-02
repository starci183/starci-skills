# Output của `fe.surface.audit`

Operator trả về một vỏ đóng với `outcome` bằng `audited` hoặc `blocked`. Nó không bao giờ phát ra
handoff hay chỉ dẫn điều phối dạng văn xuôi tự do.

## Receipt khi audited

Một receipt đã audited chứa:

- các binding chính xác về project, source, target, application receipt, knowledge, runtime, input và
  tiến độ;
- danh sách rule đã bind đầy đủ, và đó là từ vựng duy nhất một phán quyết được viện dẫn;
- mỗi mục matrix đã khai một ảnh chụp, kèm fingerprint và đúng điều kiện nó được chụp;
- mỗi node, thuộc tính và mục matrix một quan sát, nêu giá trị đo được, những mã node đó khai, và
  những mã nó khai mà tra ra không có gì;
- các finding lấy từ canonical verdict model.

Receipt ghi lại đúng thứ bề mặt render ra. Nó không sửa gì, không đề xuất bản vá nào, và không cho
phép thay đổi nào.

## Các quan sát

Một quan sát là một phép đo. Nó luôn mang `measuredValue`, vì một node không có phép đo thì không thể
bị phán xét.

`claimedRuleIds` liệt kê những mã tra được trong danh sách đã bind.
`unknownClaimedIdentifiers` liệt kê những mã không tra được. Xếp một mã chưa publish vào nhóm đã biết
là rửa nó thành thẩm quyền, còn bỏ nó đi là giấu nó, nên nó có trường riêng và finding riêng.

## Các finding

Mỗi finding mang đúng một base verdict và không hoặc nhiều cause tag từ canonical verdict model, và
viện dẫn ảnh chụp của chính mục matrix nó gọi tên.

| Loại | Phán quyết | Rule | Lời khai chưa publish |
| --- | --- | --- | --- |
| Lời khai và phép đo chỏi nhau | Một verdict hỏng kèm `VALUE_DRIFT` | Rule đã khai | `null` |
| Có giá trị, không khai gì | `PROOF_MISSING`, thường kèm `WRONG_OWNER` | `null` | `null` |
| Mã được khai không được publish | `PROOF_MISSING` | `null` | Chính mã đó |

Một phán quyết chỉ được viện dẫn mã rule có trong danh sách đã bind. Mã nằm ngoài là `UNKNOWN_RULE`,
và nó chặn lần gọi chứ không sinh finding: loại finding thứ ba báo cáo một lời khai mà audit đọc được,
không bao giờ là một rule mà audit với tới.

Một finding `VALUE_DRIFT` phải gọi tên rule mà nó lệch khỏi, và rule đó phải là một rule node ấy thật
sự đã khai. Lệch khỏi một rule không ai khai thì không phải là lệch.

`PASS` không mang cause tag nào, và chỉ hợp lệ ở nơi không có finding hỏng nào đứng trên cùng node và
cùng thuộc tính. Nhiều tầng cùng hỏng thì sinh ra các finding liên kết; chúng không bao giờ bị gộp
thành một verdict tổng hợp.

## Receipt khi blocked

Receipt đã blocked không có phần audit. Nó chứa đúng một failure có kiểu, các mục matrix, node và tham
chiếu liên quan, domain sở hữu, tính lặp lại được, và chỉ khi lặp lại được thì mới có token resume
dùng một lần kèm phần delta vật chất cần bổ sung.

Một receipt blocked được phép ghi applied head và observed head thành hai giá trị khác nhau, vì báo
cáo đúng khoảng chênh đó chính là việc của `SOURCE_DRIFT`.

## Mã lỗi

| Mã | Vấn đề sở hữu | Delta vật chất hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | Input đã sửa. |
| `SOURCE_DRIFT` | Source quan sát được không còn khớp applied head. | Source được ghi lại, hoặc application receipt làm mới. |
| `RUNTIME_UNAVAILABLE` | Endpoint không phục vụ được route đã bind, hoặc không bao giờ sẵn sàng. | Một endpoint đang phục vụ đúng route đã bind. |
| `EVIDENCE_MISSING` | Một mục matrix đã khai không sinh ảnh chụp nào. | Ảnh chụp còn thiếu, hoặc một matrix đã sửa. |
| `UNKNOWN_RULE` | Audit với tới một mã ngoài danh sách đã bind. | Topic publish nó, hoặc một mã đã sửa. |
| `NO_PROGRESS` | Một resume không thêm delta nào. | Knowledge, applied source, matrix hoặc runtime mới thật sự. |

`RUNTIME_UNAVAILABLE` thuộc về người vận hành service, không thuộc về frontend đang bị audit. Operator
này không bao giờ khởi động, dừng hay cấu hình lại một service nào.

## Bất biến liên trường

- `outcome="audited"` đòi `receipt.status="audited"`, `audit` khác null, `failure` null, và `resume`
  null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `audit` null, và `failure` khác null. Một
  failure lặp lại được thì đòi có resume; một failure không lặp lại được thì cấm có resume.
- Một bề mặt được audit thì được đo tại đúng applied source head.
- `boundRuleIds` không lặp mã nào.
- Mỗi mục matrix sinh nhiều nhất một ảnh chụp, và mọi ảnh chụp đều được đăng ký trong `artifactRefs`.
- Mọi quan sát và mọi finding đều gọi tên một mục matrix đã sinh ra ảnh chụp.
- Mọi finding đều viện dẫn tham chiếu bằng chứng của ảnh chụp thuộc chính mục matrix của nó.
- Mỗi node đo mỗi thuộc tính nhiều nhất một lần trên mỗi mục matrix.
- Mọi finding đều phán xét một node và một thuộc tính đã được đo.
- Mọi mã được ghi là đã biết đều có trong danh sách đã bind, và mọi mã khai chưa publish đều không có
  trong đó.
- Mọi mã khai chưa publish đều có một finding gọi tên nó.
- Mọi giá trị đo được mà hoàn toàn không có lời khai nào đều mang một finding `PROOF_MISSING`.
- Mọi finding có viện dẫn rule đều viện dẫn một rule có trong danh sách đã bind.
- Một finding báo cáo lời khai chưa publish thì không viện dẫn rule nào và mang verdict
  `PROOF_MISSING`.
- Một finding `VALUE_DRIFT` gọi tên một rule mà node đó đã khai.
- `PASS` không mang cause tag nào và không bao giờ đứng cạnh một finding hỏng trên cùng node và cùng
  thuộc tính.
- `handoff` luôn là `null`.

## Kết quả thực tế

Audit một bề mặt dashboard qua hai điều kiện: chồng khối trong section đo ra đúng giá trị mà rule đã
khai của nó khai báo và được ghi `PASS`; chồng vùng của trang khai cùng một rule ở cả hai bề rộng
nhưng render thấp hơn một bậc ở viewport hẹp, sinh ra một finding `APP_OVERRIDE` gắn tag `VALUE_DRIFT`
và `STATE_OR_VIEWPORT_DRIFT`; một aside render ra một khoảng đệm mà không contract nào khai, sinh ra
một finding `PROOF_MISSING` gắn tag `WRONG_OWNER`; và một node khai một mã mà knowledge đã publish
không hề chứa, sinh ra một finding `PROOF_MISSING` gọi tên chính mã đó và không viện dẫn rule nào.

Audit một bề mặt mà runtime không bao giờ phục vụ được route: lần gọi trả `RUNTIME_UNAVAILABLE`, không
ảnh chụp nào được lấy, và không phán quyết nào được ghi ở bất kỳ đâu.
