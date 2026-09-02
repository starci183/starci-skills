# Context cho `quality.verify`

## Mục đích

Context là đúng phần vật liệu mà operator này được đọc trước khi có một lệnh gate nào chạy. Nó trả lời
câu "đã giao cái gì, trên head nào, và những gate nào đã được khai cho nó?" Context không bao giờ nới
rộng phạm vi thẩm định và không bao giờ biến một lời kể thành một phép đo.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Receipt tiền nhiệm | Những receipt thượng nguồn đã tạo ra bản giao này, được tiêu thụ nguyên trạng. | Bắt buộc. Cố định cái head mà mọi gate chạy trên đó. |
| Cấu hình gate | Lệnh đã ghim, cấu hình và danh tính toolchain của từng gate. | Bắt buộc. Quyết định "cùng một gate" nghĩa là gì qua các lần chạy. |
| Source | Checkout đã route và head của nó. | Bằng chứng bắt buộc. Đối tượng mà mọi gate đo. |
| Knowledge | Luật cổng nguồn và luật sẵn sàng đã ghi lại. | Luật tái dùng. Không bao giờ thay thế được một phép đo. |
| Nợ đã duyệt | Những bản ghi được chủ sở hữu duyệt, cho phép một gate có tên được đỏ. | Bắt buộc nếu muốn mang nợ. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. ít nhất một receipt tiền nhiệm;
2. một tham chiếu cấu hình gate cho mỗi gate đã hoạch định;
3. tham chiếu source đã route, với head bằng đúng `input.project.sourceHead`.

## Ref

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@receipt/<receiptType>/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json  (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Bắt buộc: The producer's receipt; fixes the head every gate runs against. |
| `@workspaces/<project>/<role>/gates` | `<checkout:project/role>  (any routed checkout named explicitly, for cross-project reads: @workspaces/nivo/fe)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc: The pinned gate commands and configuration. |
| `@workspaces/fe` | `<checkout:input.project.id/fe>  (diskPath from <Source>/.workspaces/local/routes/<project>/fe/config.json); a sub-path narrows: @workspaces/fe/husky, @workspaces/fe/gates` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc: The subject every gate measures when the verified boundary is a frontend. |
| `@workspaces/be` | `<checkout:input.project.id/be>  (diskPath from <Source>/.workspaces/local/routes/<project>/be/config.json); a sub-path narrows: @workspaces/be/husky, @workspaces/be/gates` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc: The subject every gate measures when the verified boundary is a backend. |
| `@worktrees/debts` | `<Source>/.worktrees/debts/  (be.md, fe.md, per-item files)` | fingerprint per file | Tuỳ chọn: Owner-approved debts a red gate may carry. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/  (receipt, named artifacts, captures)` | fingerprint per artifact; every artifact written is registered in output.artifactRefs | Bắt buộc: Where gate evidence, coverage, and the receipt are written. |

## Tiền nhiệm được tiêu thụ, không phải dựng lại

`context.predecessors` đến kèm tham chiếu, loại, fingerprint và head đã quan sát của từng receipt. Mọi
head tiền nhiệm phải bằng nhau và bằng `input.project.sourceHead`.

Hai tiền nhiệm trên hai head khác nhau mô tả hai bản giao khác nhau, và gate hợp của chúng là đo một
thứ chưa ai từng dựng. Đó là `PREDECESSOR_MIXED`, và nó bị từ chối ngay ở input chứ không để lộ ra sau
đó dưới dạng một lỗi gate khó hiểu. Một tiền nhiệm có fingerprint không còn khớp source đã đóng băng là
`PREDECESSOR_STALE`.

Operator này không bao giờ dựng lại điều tiền nhiệm đã quyết. Nó không hoạch định lại bản giao, không
mở lại ranh giới, và không hình thành quan điểm về việc thay đổi ấy có hay không.

## Chỉ thẩm định

Chất lượng thì đo. Nó không sửa, không thiết kế lại, không phân loại lại và không mặc cả.

Một gate trượt sinh ra một receipt đỏ nêu tên thất bại và cách phân loại của nó, rồi receipt được trả
về cho người có thể sửa. Operator không đụng vào source sản phẩm, không chỉnh lệnh hay cấu hình gate để
đổi kết quả, và không chạy lại một thất bại với hy vọng nhận câu trả lời khác. Chạy lại chỉ tồn tại để
phân loại một mâu thuẫn thành `flaky` theo chính sách đã khai; nó không bao giờ biến một thất bại chưa
giải thích được thành xanh.

Vì operator không ghi gì ngoài bằng chứng gate, `artifactRefs` đúng bằng tập tham chiếu bằng chứng mà
các kết quả nêu tên. Bất kỳ thứ gì khác xuất hiện ở đó đều là một lần ghi mà operator này không được
phép làm.

## Hai sự thật của codebase này

**Sonar chỉ đo code mới.** Cổng chất lượng đã ghim chỉ soi phần code mới trong thay đổi, nên một cổng
Sonar xanh là phát biểu về phần diff chứ không phải về dự án. Một dự án hoàn toàn có thể đang đỏ bên
dưới một cổng xanh. Khi phạm vi Sonar là `new-code`, một kết quả đạt phải được ghi kèm finding
`SONAR_NEW_CODE_ONLY`, để về sau không ai đọc receipt như sức khoẻ của dự án.

**End-to-end không bao giờ chạy trừ khi được yêu cầu tường minh.** Bộ e2e chỉ chạy khi người gọi yêu
cầu trong chính lần gọi này. Hoạch định gate ấy mà không có yêu cầu là input không hợp lệ. Ghi nó thành
`skipped-not-requested` mới là kết quả trung thực, và nó mang theo finding `E2E_NOT_REQUESTED` để sự
vắng mặt hiện ra rõ ràng chứ không phải suy ra từ một dòng bị thiếu.

## Nợ là tường minh và có chủ

Một gate chỉ được để đỏ khi có bản ghi nợ đã được chủ sở hữu duyệt phủ lên nó, nêu tên khoản nợ, gate,
phê duyệt, chủ sở hữu và hạn. Một phê duyệt đã hết hạn thì không phải nợ, và một khoản nợ đặt lên gate
đã đạt là bản ghi của hư không. Cả hai đều bị từ chối.

Một khoản nợ chỉ phủ được một thất bại `in-boundary`, loại mà chủ bản giao có thể sửa. Một thất bại
`boundary-drift` thuộc về người sở hữu ranh giới và không thể nợ đi ở đây.

## Ranh giới

Context là chỉ đọc. Operator ghi bằng chứng gate và receipt dưới `input.project.artifactRootRef`, và
không ghi gì khác ở bất kỳ đâu.

## Tài nguyên

Operator này chạy trọn trên profile `sonnet` (`claude-sonnet-5`, runtime `claude`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: không có. Nó không bao giờ tìm trên mạng, không ràng với Grammar, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
