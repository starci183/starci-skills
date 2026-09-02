# Context cho `fe.surface.audit`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để phán xét một bề mặt đã render. Nó trả lời câu "operator này
được đọc những gì?" trước khi ảnh chụp đầu tiên được lấy. Context không bao giờ nới rộng phạm vi nhiệm
vụ và không bao giờ biến bằng chứng thành thẩm quyền.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Knowledge index | Danh mục rule và khuôn detector mà mọi topic phải theo. | Bắt buộc. Nêu topic nào được phép bind. |
| Knowledge topic | Một họ rule, tiền tố của nó, và đúng những mã nó publish. | Luật tái dùng bắt buộc. Nguồn duy nhất của mã rule hợp lệ. |
| Application receipt | Source head đã ghi, chế độ phát contract, và lời khai của từng node. | Bắt buộc. Chính ý định đã nói ra mà lần audit này sinh ra để bác lại. |
| Frontend source | Checkout đã route và head của nó. | Bằng chứng rằng bề mặt đang quan sát chính là bề mặt đã được ghi. |
| Owner audit | Các phát hiện trước đó của cùng owner. | Bằng chứng và lịch sử hồi quy. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. knowledge index cùng ít nhất một topic;
2. application receipt, với `appliedSourceHead` bằng đúng `input.project.sourceHead`;
3. tham chiếu frontend source đã route, với head bằng đúng `input.project.sourceHead`.

`context.auditRefs` là bằng chứng và được phép rỗng.

## Ref

Mọi nơi operator này được đọc, theo alias. `refs.json` ở gốc `.claude` phân giải từng alias; nơi nào
không có trong bảng thì operator này không được đọc, và `@artifacts` là nơi duy nhất nó ghi.

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@knowledge/ui/proof/<topic>` | <Source>/.claude/knowledge/<group>/<topic>.md | fingerprint; the rule inventory is the set of `## PREFIX-n` headings of the file | Bắt buộc: What only becomes true once rendered; the audit's rule inventory. |
| `@receipt/fe-source-application/<invocationId>` | <@artifacts of the producing invocation>/<receipt file> | fingerprint + the sourceHead the receipt binds | Bắt buộc: The stated intention this audit exists to contradict. |
| `@source/starci-academy/fe` | <checkout:project/role> | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc: Proves the observed surface is the applied surface. |
| `@runtime` | <Source>/.worktrees/sessions/central-runtime/owner.json | fingerprint + generation | Bắt buộc: The endpoint that serves the route under observation. |
| `@artifacts` | input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/ | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Bắt buộc: Where captures and the audit receipt are written. |

## Danh sách mã rule

`context.knowledge.topics[].ruleIds` là danh sách đầy đủ và đã đóng băng những mã lần audit này được
phép viện dẫn. Nó không phải gợi ý, cũng không phải một tập con. Mỗi topic tự khai `rulePrefix` của
mình, và mọi mã nó publish đều phải mang tiền tố đó. Một mã chỉ thuộc về đúng một topic.

Liệt kê một mã dưới một topic mà nó không mang tiền tố, hoặc liệt kê nó hai lần, là input không hợp lệ
chứ không phải cảnh báo. Cả hai đều là cách để một mã không file nào publish có được vẻ ngoài của thẩm
quyền.

Một phán quyết chỉ được viện dẫn mã nằm trong danh sách này. Mã nằm ngoài là `UNKNOWN_RULE`.

## Lời khai là đối tượng, không phải thẩm quyền

`context.applied.claims` mang các lời khai `data-contract` mà resolution đã công bố: với mỗi node, là
những mã node đó nói mình thoả.

Lời khai là một ý định đã nói ra, không bao giờ là bằng chứng đạt. Audit tồn tại chính là để đo kết
quả render và bác lại lời khai khi hai bên chỏi nhau. Một node khai `GAP-4` trong khi gap tính ra đo
được `1.5rem` là một finding, không phải một cái pass, và khai bao nhiêu cũng không đổi được điều đó.

Các lời khai cũng chính là lý do một giá trị không ai khai mới phát hiện được. Một node render ra
khoảng cách mà không khai gì thì không có chủ, và sự vắng mặt đó tự nó là một finding.

## Runtime là bằng chứng, không phải thẩm quyền

Endpoint runtime đã bind phục vụ bề mặt đó. Thứ nó render ra là phép đo; nó không bao giờ là luật và
không bao giờ đè lên knowledge đã publish. Một bề mặt render sai một cách nhất quán thì vẫn là sai một
cách nhất quán, và audit nói thẳng ra điều đó.

## Ranh giới

Context là chỉ đọc, và operator này cũng vậy. Nó không sửa gì, không restyle gì, không ghi product
source, không sửa knowledge, không publish Grammar, và không khởi động service nào. Nó chỉ ghi bằng
chứng chụp được và receipt của nó dưới `input.project.artifactRootRef`.

## Tài nguyên

Operator này chạy trọn trên profile `sol-reviewer` (`gpt-5.6-sol`, runtime `openai`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: trình duyệt. Nó không bao giờ tìm trên mạng, tuân thủ Grammar đã publish, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
