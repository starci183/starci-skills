# Context cho `business.decide`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để quyết một lời hứa nghiệp vụ. Nó trả lời câu "operator này
được đọc những gì?" trước khi bắt đầu mô hình hoá. Context không bao giờ nới rộng mục tiêu và không bao
giờ biến một ví dụ thành sự thật sản phẩm.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Evidence index | Tập claim đã chuẩn hoá cho mục tiêu này và fingerprint đóng băng nó. | Bắt buộc. Nơi duy nhất một claim được phép đến từ. |
| Claim | Một quan sát đã tách bạch: fact, intent, example, unknown hay contradiction, có trích vai trò, đường dẫn, khoảng dòng và head. | Bắt buộc. Chỉ fact mới gánh được sự thực thi. |
| Gốc thẩm quyền nghiệp vụ | Gốc `.worktrees/businesses/`: các head `features/<featureId>/`, chỉ mục head `business-registry-v1.json`, và kho nội dung `objects/sha256/`. | Bắt buộc. Quyết định chuyển trạng thái nào là hợp lệ. |
| Backend source | Checkout đã route và head của nó. | Bằng chứng rằng mọi claim và consumer thuộc về source đã đóng băng. |
| Tham chiếu kiến trúc | Các quyết định ranh giới và quyền sở hữu đã duyệt mà lời hứa phải tôn trọng. | Bằng chứng. Không bao giờ là nguồn hành vi nghiệp vụ. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. evidence index cùng ít nhất một claim;
2. gốc thẩm quyền nghiệp vụ và các head đã publish;
3. tham chiếu backend source đã route, với head bằng đúng `input.project.sourceHead`.

Một claim trích tới source mà không ai bind là input không hợp lệ chứ không phải cảnh báo, vì một trích
dẫn không được bind thì không phân biệt được với một trích dẫn bịa ra.

## Ref

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@worktrees/businesses/<featureId>` | `<Source>/.worktrees/businesses/  (features/<featureId>/model.json; business-registry-v1.json is the head index; objects/sha256/ the content store)` | content address from business-registry-v1.json featureHeads.&lt;featureId&gt;.head, with authorityStatus | Bắt buộc: The promise head and its lifecycle state, by content address. |
| `@workspaces/be` | `<checkout:input.project.id/be>  (diskPath from <Source>/.workspaces/local/routes/<project>/be/config.json); a sub-path narrows: @workspaces/be/husky, @workspaces/be/gates` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc: The backend checkout every fact claim cites by path, line range, and head. |
| `@receipt/architecture-decision/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json  (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Tuỳ chọn: Architecture evidence; never a source of business behaviour. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/  (receipt, named artifacts, captures)` | fingerprint per artifact; every artifact written is registered in output.artifactRefs | Bắt buộc: Where the coverage matrix and the published head copy are written. |

## Tách bạch claim

Mô hình hoá nghiệp vụ bắt đầu bằng việc tách fact, intent, example, unknown và contradiction. Việc tách
đó nằm ở `context.evidence.claims[].kind` và đi tiếp vào quyết định được publish.

Sự tách bạch tồn tại để chặn đúng một phép đánh tráo. Một ví dụ, một ảnh chụp màn hình, hay ý định của
chủ sở hữu chỉ minh hoạ cho lời hứa; chỉ một fact quan sát được trong source đã route mới chứng minh
rằng lời hứa được thực thi. Vì thế một dòng coverage khẳng định có thực thi phải trích ít nhất một
claim loại `fact`, và mọi claim `fact` phải ràng source head đã quan sát.

## Ranh giới thẩm quyền

Head nghiệp vụ được publish dưới gốc `.worktrees/businesses/` của backend dự án, vốn là một git
worktree riêng. Một feature sở hữu đúng một thư mục head, `<businessesRootRef>/features/<featureId>`,
mà `model.json` trong đó là head. `business-registry-v1.json` ở gốc lập chỉ mục mọi feature head theo
địa chỉ nội dung cùng `authorityStatus`, `baseHead`, `previousHead` và các head source đã bind;
`objects/sha256/<hash>.json` giữ từng phiên bản đã publish; `history/by-id.json` giữ phả hệ. Fingerprint
của một head là địa chỉ nội dung của nó, nên thẩm quyền bind được ngay cả trước khi commit của worktree
hạ cánh.

`features/` là đoạn duy nhất giữa gốc và một feature. Một đoạn tên dự án chèn xuống dưới gốc sẽ mở ra
một cây thẩm quyền thứ hai mà người đọc về sau không bao giờ tìm thấy, nên operator từ chối mọi head
không đúng bằng `features/<featureId>`. Runtime Source giữ `<Source>/.workspaces/` của riêng nó; đường dẫn đó không bao giờ là gốc thẩm
quyền nghiệp vụ.

## Ranh giới

Context là chỉ đọc. Operator chỉ ghi feature head và ma trận coverage của nó dưới gốc businesses, cùng
receipt có kiểu của chính nó. Nó không sửa thẩm quyền kiến trúc, thẩm quyền frontend hay phần hiện thực
backend, và không bao giờ khẳng định rằng một lần hiện thực, một cổng chất lượng hay một lượt UAT đã
đạt.

## Tài nguyên

Operator này chạy trọn trên profile `sol-fresh` (`gpt-5.6-sol`, runtime `openai`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: tìm trên mạng. Nó được tìm trên mạng trong giới hạn đúng khoảng trống phải lấp, có ghi lại, không ràng với Grammar, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
