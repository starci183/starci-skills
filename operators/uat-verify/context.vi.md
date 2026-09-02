# Context cho `uat.verify`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để kiểm chứng một luồng quyết định sản phẩm. Nó trả lời câu
"operator này được đọc gì, và cái gì đã cho phép nó bắt đầu?" trước hành động sản phẩm đầu tiên.
Context không bao giờ nới rộng luồng đang kiểm chứng và không bao giờ biến bằng chứng thành thẩm
quyền.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Backend Source | Checkout đã route, sở hữu thẩm quyền UAT chuẩn tại `.worktrees/uat/`. | Bắt buộc. Nơi duy nhất được ghi cặp file chuẩn. |
| Giao thức UAT | Luật bằng chứng, vòng đời fixture, thực thi tuần tự và tính chung cuộc. | Luật tái dùng bắt buộc. Không bao giờ bị sửa ở đây. |
| Thẩm quyền template | Schema chuẩn của snapshot và result mà file ghi ra phải thoả. | Bắt buộc. Chỉ tiêu thụ, không sửa. |
| Giấy phép vào | Blind visual PASS cuối và quality PASS cuối, thứ cho phép UAT sản phẩm bắt đầu. | Bắt buộc. Thiếu là dừng, không phải cảnh báo. |
| Runtime owner | Artifact owner đã sẵn sàng, generation của nó, và đúng các origin FE, API, identity. | Bằng chứng bắt buộc rằng có một runtime quan sát được. |
| Tham chiếu bằng chứng | Receipt, ảnh chụp và quan sát runtime trước đó. | Chỉ là bằng chứng. Không bao giờ là phán quyết. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. backend Source đã route, với head bằng đúng `input.sourceHead`;
2. binding giao thức và template kèm fingerprint của chúng;
3. cả hai receipt cho phép vào, kèm thời điểm chúng pass;
4. một runtime owner đã sẵn sàng, với origin frontend bằng đúng origin của lease.

Thiếu một receipt cho phép vào là `ADMISSION_MISSING`. Runtime owner chưa sẵn sàng là
`RUNTIME_UNAVAILABLE`. Không cái nào được sửa ở đây: UAT quan sát một sản phẩm chứ không dựng ra sản
phẩm.

## Ref

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@worktrees/uat/<flow>/<case>` | `<Source>/.worktrees/uat/<flow>/<case>/  (snapshot.json, result.json)` | fingerprint of snapshot.json and result.json | Bắt buộc · tĩnh: The canonical snapshot and result pair for the flow. |
| `@worktrees/_templates` | `<Source>/.worktrees/_templates/  (businesses/, debts/, sessions/, uat/)` | fingerprint per file | Bắt buộc · tĩnh: UAT protocol and template authority; consumed, never modified. |
| `@worktrees/sessions/central-runtime` | `<Source>/.worktrees/sessions/central-runtime/owner.json  (generation-<n>-ready.json and logs/ beside it)` | fingerprint + generation | Bắt buộc · tĩnh: A runtime that can be observed; readiness is proved, not assumed. |
| `@workspaces/be` | `<checkout:input.project.id/be>  (diskPath from <Source>/.workspaces/local/routes/<project>/be/config.json); friendly segments: /husky, /package, /gates (see segments)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc · tĩnh: The checkout whose behaviour the flow verifies. |
| `@dynamic/uat-flow-verification.json` | `<Source>/.worktrees/sessions/<sessionId>/steps/<n>.<operator.id>/<file>. Writing: <n>.<operator.id> is the current step, and input.project.artifactRootRef must equal that folder. Reading: the nearest earlier step of the same session that wrote <file>; @dynamic/steps/<n>/<file> names a specific step. The session folder is created by the orchestrator and deleted when the run completes; a blocked run keeps it for resume` | fingerprint per file; every file written is registered in output.artifactRefs | Bắt buộc · động: This step's own receipt, and beside it every artifact the Sequence names; the folder input.project.artifactRootRef must equal. |

## Danh tính được cấp tự động, không bao giờ đi xin

Luồng có đăng nhập tiêu thụ đúng một danh tính run-scoped mà control plane đã tạo trong cả Keycloak
lẫn database ứng dụng, rồi tự xác thực trong một Browser context do broker giữ. Operator chỉ nhận
những tham chiếu mờ: `account://fresh/...`, `keycloak-user://...`, `database-user://...` và
`browser-lease://...`.

Yêu cầu người dùng đăng nhập, mượn tài khoản hay dán một credential là điều bị cấm ở mọi nhánh. Khi
thẩm quyền cấp phát, provisioner cục bộ, hoặc xác thực qua broker không dùng được, kết quả đúng là
`BLOCKED`.

Luồng ẩn danh thì hoàn toàn không ghi tài khoản nào. Nó khai `anonymous://explicit/...` và không giữ
lease đã xác thực, nên một trình duyệt đang đăng nhập sẵn không bao giờ đội lốt được lối vào ẩn danh.

## Bản ghi tài khoản không chứa bí mật

Bản ghi được đóng băng vào snapshot là một tập trường đóng: tham chiếu tài khoản, tham chiếu bản ghi
Keycloak và database, fingerprint principal, namespace fixture, chủ sở hữu và chế độ cấp phát, chế độ
giữ credential, và trạng thái đã xác thực.

Mỗi trường trong đó đều là hằng, fingerprint, hoặc tham chiếu mờ ràng theo scheme. Không có trường tự
do nào, nên mật khẩu, cookie, token hay OTP không có chỗ để nằm, kể cả do sơ suất. Đây là một hình
dạng chứ không phải một quy tắc mà ai đó phải nhớ.

## Ranh giới

Context là chỉ đọc. Operator ghi snapshot và result chuẩn dưới backend Source đã route, ghi receipt
dưới `input.project.artifactRootRef`, và chỉ xoá những bản ghi fixture mang cả `is_uat=true` lẫn đúng
namespace đã đóng băng. Nó không sửa giao thức, không publish template, không sửa product source, và
không nâng bằng chứng UI lên trên bằng chứng Behavior hay UX.

## Tài nguyên

Operator này chạy trọn trên profile `sol-reviewer` (`gpt-5.6-sol`, runtime `openai`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: trình duyệt. Nó không bao giờ tìm trên mạng, không ràng với Grammar, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
