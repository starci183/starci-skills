# migration.release

## Việc

Áp một kế hoạch migration source đã đóng băng đúng một lần lên một target phi production đã khai qua
runner do source sở hữu, và chứng minh bằng lần gọi thứ hai rằng không còn gì chờ và journal không
dịch chuyển.

## Xong khi

Xong khi `migration-release` cùng `migration-release-proof` của nó ghi nhận tập migration đã khai
được áp dụng một lần qua runner do source sở hữu với mọi dòng journal trước đó được giữ nguyên, một
lần gọi thứ hai chứng minh không còn migration chờ và journal không đổi, và mọi giá trị runner đã giải
mã được giữ ngoài biên bản, log và proof.

## Kế hoạch được đóng băng trước khi có gì chạy

Requirement `migration` khác null là toàn bộ những gì chạy. `planRef` là
`request/migration-release.json`; `sha256` đóng băng đúng các byte theo
`templates/kinds/migration-release-plan.schema.json`. Input route cung cấp checkout; biên bản backend
và input quality đạt chứng minh cùng source commit. Plan nêu đúng các tệp migration, runner do chủ
source cung cấp, cấu hình, tham chiếu custody kết nối và biên journal migration. Chủ backend viết và
chứng minh runner trước khi operator này dùng. Thiếu runner thì trả về chủ đó; operator không tạo
runner. Một plan mà digest, bản khai báo môi trường, target, các producer hay các tệp đã ghim không
khớp với thứ trên đĩa là `MIGRATION_PLAN_INVALID`, và không gì chạy trên nó.

## Thẩm quyền là lớp release của môi trường

Operator này chỉ dùng môi trường phi production đã tồn tại và lớp thẩm quyền `release` của môi
trường. Plan đóng băng byte khai báo môi trường bằng `environmentSha256` và khớp đúng một mục
`migrationTargets` theo project, target và tham chiếu kết nối. Fingerprint kết nối và schema journal
phải khớp thẩm quyền đó. Với `usernameRef` được niêm phong, dùng commitment toàn kết nối do chủ môi
trường chuẩn bị riêng; executor không giải mã hay ghi lại username. Grant seed hoặc runtime không cấp
quyền cho nó, và một request mà `approval` không phải id phê duyệt lẫn tham chiếu bản khai báo với lớp
release là `declared` thì là `APPROVAL_REQUIRED`.

## Runner cố định và được gate hai lần

Gate request kiểm biên bản producer, tệp bất biến và head checkout thực trước tác động. Chạy
`scripts/migration-release-run.mjs <runtime-root> <branch>` qua grant shell đã khai; gate bên trong
kiểm lại thẩm quyền và source ngay trước mỗi apply. Runner cố định chỉ nhận JSON theo
`migration-release-input.schema.json` và trả kind đóng `migration-release-runner`. Runner tự so khớp
kết nối mong đợi, toàn bộ tập pending, sự tồn tại journal và fingerprint toàn hàng journal ngay trước
tác động. Inspect chỉ đọc, không tạo journal. Khởi tạo journal cần quyền nêu rõ trong plan.

Apply đầu điền đúng tập migration đã khai; đọc lại giữ nguyên mọi hàng journal trước đó. Invocation
thứ hai chứng minh không còn pending và journal không đổi. Stdout thành công được giữ nguyên trong
transcript có hash chỉ sau khi qua schema đóng; tiến trình lỗi hoặc sai dạng chỉ trả hash output và
loại lỗi. Không lưu giá trị đã giải mã hay output tiến trình tùy ý. Lỗi hoặc bất định là
`MIGRATION_FAILED`: block, không thử lại tác động dở dang hoặc chạy down migration, và journal được
giữ đúng như runner để lại.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| journal có frozen set và không pending | tái dùng applied state; không apply | inspect hai chứng minh journal y hệt và prior row giữ | phát no-op proof |
| declared set pending và chưa journal | apply exact digest một lần qua source runner | inspect/replay chứng minh journaled set và replay no-op | phát proof |
| plan/runner/object thiếu hoặc sai | không apply và edit | nêu artifact và digest mismatch | handoff `backend.generate`; plan sửa là attempt mới |
| apply partial/không chắc hoặc mất transcript | không reapply/down-migrate/đoán | giữ log và uncertain effect | block tới khi inspect chứng minh remaining set an toàn |

## Ranh giới ghi

Context chỉ đọc, trừ migration mà runner áp. Operator chỉ áp tập migration đã khai lên source head
đóng băng và target đã khai, và chỉ ghi `response/` của nhánh mình: `migration-release.md`,
`data/migration-release.json`, transcript có hash `artifacts/migration-1.log` và
`artifacts/migration-2.log`, cùng `response.json`. Nó không deploy image, không rollout, không giám
sát hay rollback; không tạo, sửa hay chọn runner; không giải mã, log, lưu, in ra hay trả về giá trị
credential hay username niêm phong; không chạy down migration hay thử lại tác động dở dang; không
chạm môi trường production; và không tuyên bố đã migrate mà không có replay chứng minh.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/be` | checkout backend từ input route ở source commit đóng băng, đọc để lấy runner, cấu hình và các tệp migration đã ghim | có |
| `@workspaces/device-state` | custody kết nối theo tên; giá trị không bao giờ xuất hiện | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `route` | `workspace.bind`; checkout source và thẩm quyền route mà plan ghim vào | có |
| `backend-source-application` | `backend.generate`; contract migration đã apply và runner do source sở hữu mà nó đã chứng minh | có |
| `quality-verification` | `quality.verify`; verification đạt ở cùng source commit | có |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `release` | id | — | Danh tính release mà migration này thuộc về, dạng `release:<id>` |
| `target` | id | — | Đúng một target phi production mà plan nêu, cùng môi trường nó nằm trong |
| `approval` | id | — | Thẩm quyền release: một id phê duyệt, hoặc tham chiếu tới bản khai báo môi trường — đường dẫn cùng hash nội dung — khi bản khai báo đó đánh dấu `release` là `declared`; không bao giờ `declared` ở môi trường production |
| `migration` | `{planRef, sha256}` | null | Plan migration source chính xác, ghim theo digest; orchestrator bind nó trước khi dispatch, và cổng riêng của operator từ chối nhánh không nêu plan nào |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm cổng vào, ba đầu vào producer ở cùng một source commit, và resume | `resume` | `request/request.json`, đầu vào `route`, `backend-source-application` và `quality-verification` | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Bind và inspect plan đóng băng theo digest, runner file, target, journal, phân loại set đã applied, safely pending, missing/sai, hoặc partial/uncertain trước thực thi | `release`, `target`, `approval`, `migration` | `request/migration-release.json`, bản khai báo của môi trường, @workspaces/be ở source head đóng băng, @tools/git | — | `MIGRATION_PLAN_INVALID`, `APPROVAL_REQUIRED`, `SOURCE_DRIFT` |
| 3 | Chỉ chạy inspect-apply-inspect cho pending set hoàn toàn an toàn; tái dùng set đã applied như no-op, handoff owner artifact thiếu/sai, và không reapply effect partial/uncertain | — | @workspaces/be cho runner và cấu hình, @workspaces/device-state cho custody theo tên, @tools/secrets, @tools/shell cho frozen command | `migration-log`: response/artifacts/migration-1.log and migration-2.log | `MIGRATION_FAILED` |
| 4 | Chứng minh replay — không còn migration chờ, journal không đổi, mọi hàng trước đó được giữ — và ghi proof | — | `response/artifacts/migration-1.log`, `response/artifacts/migration-2.log` | `migration-release-proof` | `MIGRATION_FAILED` |
| 5 | Viết biên bản và phát | — | mọi thứ ở trên | `migration-release`, `response/response.json` | — |

Một lần resume bắt đầu lại từ cổng vào, giữ nguyên digest plan, và không bao giờ áp lại tập mà
journal đã mang; một lần resume không thêm thẩm quyền, plan hay thay đổi source nào là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `migration-release` | `response/migration-release.md` | md | có |
| `migration-release-proof` | `response/data/migration-release.json` | data | có |
| `migration-log` | `response/artifacts/migration-<n>.log` | artifact | không |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `APPROVAL_REQUIRED` | terminate |
| `MIGRATION_PLAN_INVALID` | terminate |
| `MIGRATION_FAILED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| migration đã áp và image phụ thuộc vào nó có thể được release | `release.deploy` |
| runner hay một tệp migration mà plan ghim phải được chủ của nó sửa | `backend.generate` |
