# Context cho `backend.implement`

## Mục đích

Context là đúng phần vật liệu đã được quyết xong trước khi viết bất kỳ dòng code backend nào. Nó trả
lời câu "operator này được đọc gì, và quyết định của ai đã có sẵn?" Context không bao giờ nới rộng
ranh giới mutation và không bao giờ biến bằng chứng thành thẩm quyền.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Thẩm quyền nghiệp vụ | Những quyết định đã duyệt mà backend được phép mã hoá: ai được hành động, thu bao nhiêu, từ chối cái gì, một chuyển trạng thái nghĩa là gì. | Bắt buộc. Nguồn duy nhất của hành vi nghiệp vụ. |
| Mutation contract đã đóng băng | Các operation, writer, store, ranh giới transaction, idempotency, migration và những proof bắt buộc. | Bắt buộc. Ranh giới mà phần hiện thực được lấp đầy chứ không được nới rộng. |
| Pattern anh em | Các họ đã quan sát được mà thay đổi này phải soi theo: phân tầng module, transport, validation, phân quyền, truy cập dữ liệu, ranh giới transaction, tranh chấp đồng thời, idempotency, phát sự kiện, danh tính exception, cách đặt tên, an toàn kiểu. | Luật tái dùng bắt buộc. Nguồn duy nhất của quy ước hợp lệ. |
| Backend source | Checkout đã route và head của nó. | Bằng chứng rằng ranh giới thuộc về source đã đóng băng. |
| Knowledge | Luật hiện thực backend đã ghi lại. | Luật tái dùng. Không bao giờ thay thế được contract. |
| Receipt trước đó | Các receipt hiện thực hoặc đối chiếu trước đó của cùng outcome. | Bằng chứng và lịch sử hồi quy. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. thẩm quyền nghiệp vụ đã duyệt với ít nhất một quyết định;
2. mutation contract đã đóng băng với ít nhất một operation;
3. ít nhất một pattern anh em được bind;
4. tham chiếu backend source đã route, với head bằng đúng `input.project.sourceHead`.

## Ref

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@business/<featureId>` | `<Source>/.worktrees/businesses/features/<featureId>/model.json` | content address from &lt;Source&gt;/.worktrees/businesses/business-registry-v1.json (featureHeads.&lt;featureId&gt;.head) with its authorityStatus | Bắt buộc: The only source of business behaviour. |
| `@receipt/architecture-decision/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Bắt buộc: The frozen mutation contract the implementation fills and may not widen. |
| `@knowledge/patterns/be` | `<Source>/.claude/knowledge/<group>/  (every canonical .md inside; a single file may be named as <group>/<topic>.md)` | fingerprint per file; the rule inventory is the set of `## PREFIX-n` headings across the folder's canonical files | Bắt buộc: Sibling patterns: the only source of valid conventions. |
| `@source/starci-academy/be` | `<checkout:project/role>` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc: The backend checkout the boundary belongs to; the one place this operator writes product source. |
| `@receipt/backend-implementation/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Tuỳ chọn: Prior implementation receipts; regression history. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/` | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Bắt buộc: Where conformance, proofs, and the receipt are written. |

## Contract đóng băng trước khi có code

`input.contract` đến với `status: "frozen"` và một fingerprint. Ranh giới đã chốt trước lần ghi sản
phẩm đầu tiên, và phần hiện thực lấp đầy nó chứ không thương lượng với nó. Mỗi operation nêu rõ
transport, writer duy nhất, những store nó chạm tới, ranh giới transaction, kiểu idempotency, các
migration nó mang theo, những mặt của contract phải được chứng minh, và những loại proof sẽ chứng minh.

Với tay ra ngoài danh sách đó không phải là một thay đổi nhỏ hơn việc mở lại contract; nó chính là
thay đổi ấy nhưng không để lại dấu vết. Operator dừng với `CONTRACT_WIDENED` và trả câu hỏi ranh giới
về cho người sở hữu contract.

## Thẩm quyền nghiệp vụ là input, không phải thứ tự nghĩ ra

`context.authority.decisions` là tập đầy đủ những phát biểu nghiệp vụ mà lần hiện thực này được phép
mã hoá, và mỗi operation trích dẫn những quyết định nó hiện thực qua `authorityDecisionIds`. Một mã
không có trong tập đó là input không hợp lệ, bởi một luật nghiệp vụ không ai duyệt chính là thứ mà một
bài test xanh có thể hợp thức hoá.

Backend sở hữu thẩm quyền nghiệp vụ, nên một câu hỏi nghiệp vụ chưa có lời giải không phải chuyện tự
quyết tại chỗ. Đó là một lối ra có kiểu, `BUSINESS_AUTHORITY_MISSING`, gửi tới người sở hữu nghiệp vụ,
và cùng outcome ấy được hiện thực lại sau khi quyết định được duyệt và bind lại.

## Pattern anh em là nguồn quy ước duy nhất

`context.patterns` bind mỗi khía cạnh một tham chiếu. Phần hiện thực soi theo đúng họ mà nó nêu tên:
command handler `ICQRSHandler` dưới `src/features/api/core/graphql/mutations/`, exception dẫn xuất từ
`AbstractException`, truy cập entity qua entity manager primary được inject, migration nằm dưới
datasource primary. Một quy ước không pattern nào publish thì bị từ chối chứ không được đưa vào, và
việc từ chối được ghi lại thành `NEW_CONVENTION_REFUSED`.

Một khía cạnh mà thay đổi có chạm tới nhưng không có pattern nào bind cho nó là `PATTERN_UNBOUND`. Đoán
họ theo trí nhớ chính là cách một phong cách nhà thứ hai lọt vào codebase mà không ai hay.

## Ranh giới

Context là chỉ đọc. Operator chỉ ghi source sản phẩm bên trong `input.scope.mutableFileRefs`, và ghi
receipt cùng mọi kết quả proof dưới `input.project.artifactRootRef`. Nó không sửa contract, không
publish thẩm quyền nghiệp vụ, không đụng file chỉ quan sát, và không ghi phán quyết chất lượng, thị
giác hay UAT.

## Tài nguyên

Operator này chạy trọn trên profile `opus` (`claude-opus-5`, runtime `claude`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: ghi source. Nó không bao giờ tìm trên mạng, không ràng với Grammar, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
