# Context cho `release.deploy`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để triển khai một bản phát hành. Nó trả lời câu "cái gì được
khai, cái gì được cho phép, và cái gì đang chạy?" trước mũi thay đổi đầu tiên. Context không bao giờ
nới rộng target và không bao giờ biến một tiền lệ thành một sự cho phép.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Ý định triển khai | Khai báo bền do sản phẩm sở hữu trong `.stacks`: môi trường, topology, host, chủ domain, workflow, probe. | Bắt buộc. Nguồn duy nhất nói cái gì phải tồn tại. |
| Luật vòng đời | Luật compare-and-set, ngữ nghĩa giám sát, giới hạn phục hồi, điều kiện rollback hợp lệ. | Luật tái dùng bắt buộc. Không bao giờ sửa ở đây. |
| Manifest đã kiểm | Đúng một manifest đã được kiểm, ghim vào đúng một release. | Bắt buộc. Kiểm chứng đi trước build bất biến và rollout. |
| Sự cho phép | Giấy phép đã khai, phủ đúng project, môi trường, target và hành động `deploy`. | Bắt buộc. Triển khai không bao giờ được ngầm hiểu từ một task thường. |
| Handle credential | Những cái tên mờ, được phân giải qua kho custody sẵn có. | Bắt buộc ở nơi kế hoạch cần. Giá trị không bao giờ xuất hiện. |
| Trạng thái quan sát | Revision hiện tại của target, release đang chạy, digest đang chạy, tại một thời điểm nêu rõ. | Bằng chứng bắt buộc. Mốc nền cho mọi lần compare-and-set. |
| Tham chiếu bằng chứng | Lần chạy workflow, bản ghi registry, quan sát host và provider. | Chỉ là bằng chứng. Không bao giờ là phán quyết. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. ý định đã khai, với môi trường bằng đúng môi trường của target;
2. binding luật vòng đời;
3. một manifest đã kiểm đúng với release này;
4. một sự cho phép còn hạn, phủ đúng project, môi trường và target này;
5. trạng thái quan sát của chính target đó, với release đang chạy là release mà lần này thay thế.

Thiếu sự cho phép hoặc cho phép sai phạm vi là `AUTHORIZATION_MISSING`. Manifest ghim vào release khác
là `MANIFEST_INVALID`. Không cái nào được sửa ở đây: một lần triển khai không được phép sẽ không trở
thành được phép chỉ vì nó hữu ích.

## Ref

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@dynamic/quality-verification.json` | `<Source>/.worktrees/sessions/<sessionId>/steps/<n>.<operator.id>/<file>. Writing: <n>.<operator.id> is the current step, and input.project.artifactRootRef must equal that folder. Reading: the nearest earlier step of the same session that wrote <file>; @dynamic/steps/<n>/<file> names a specific step. The session folder is created by the orchestrator and deleted when the run completes; a blocked run keeps it for resume` | fingerprint per file; every file written is registered in output.artifactRefs | Bắt buộc · động: Verification precedes an immutable build. |
| `@remote/ghcr/<image>` | `ghcr.io/<image>@<digest>` | digest | Bắt buộc · tĩnh: The immutable image, by digest. |
| `@workspaces/device-state` | `<Source>/.workspaces/device-state.json  (sealed keys live in <Source>/.workspaces/local/credentials/*.key.enc and are bound by name, never read)` | fingerprint | Bắt buộc · tĩnh: Credential handles by name; values never appear. |
| `@remote/github-actions/<runId>` | `GitHub Actions run <runId> of the routed repository` | run id + conclusion | Tuỳ chọn · tĩnh: CI evidence of the build and rollout. |
| `@dynamic/release-deployment.json` | `<Source>/.worktrees/sessions/<sessionId>/steps/<n>.<operator.id>/<file>. Writing: <n>.<operator.id> is the current step, and input.project.artifactRootRef must equal that folder. Reading: the nearest earlier step of the same session that wrote <file>; @dynamic/steps/<n>/<file> names a specific step. The session folder is created by the orchestrator and deleted when the run completes; a blocked run keeps it for resume` | fingerprint per file; every file written is registered in output.artifactRefs | Bắt buộc · động: This step's own receipt, and beside it every artifact the Sequence names; the folder input.project.artifactRootRef must equal. |

## Credential là cái tên, không bao giờ là giá trị

`context.credentials` mang các handle `secret-ref://` cùng tham chiếu custody của chúng. Không có
trường nào trong toàn bộ hợp đồng này nhận một giá trị credential, nên một token dán vào chỗ của handle
sẽ bị loại như input hỏng, thay vì lặng lẽ đi vào một kế hoạch, một dòng log, hay một danh sách tham
số.

Việc phân giải diễn ra qua custody sẵn có vào lúc thực thi. Receipt chỉ ghi lại những handle nào đã
được phân giải, không gì hơn.

## Những ràng buộc cụ thể của dự án này

Đẩy `main` sẽ kích hoạt workflow GitHub Actions, và quá trình boot mất khoảng tám tới chín phút, nên
một deadline giám sát ngắn hơn cửa sổ ổn định mà nó phải chứa sẽ tạo ra một thất bại giả chắc chắn.
Probe GraphQL typename trả `200` chính là tín hiệu sẵn sàng, và đó là lý do phải có ít nhất một probe
công khai: một lần chạy chỉ quan sát sức khoẻ container thì không chứng minh được điều gì người dùng
nhìn thấy.

## Ranh giới

Context là chỉ đọc. Operator chỉ áp những thay đổi đã khai về host, migration, domain và rollout lên
đúng release đã đóng băng, ghi receipt dưới `input.project.artifactRootRef`, và khôi phục đúng release
rollback đã khai khi đi vào nhánh đó. Nó không sửa ý định, không kiểm lại manifest thành một thứ khác,
không dựng lại artifact bất biến, và không nhận nuôi một release do lần chạy khác sinh ra.

## Tài nguyên

Operator này chạy trọn trên profile `opus` (`claude-opus-5`, runtime `claude`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: ghi source. Nó không bao giờ tìm trên mạng, không ràng với Grammar, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
