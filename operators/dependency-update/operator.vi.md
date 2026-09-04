# dependency.update

## Việc

Nhận một bản package đã kiểm chứng bằng cách chỉ đổi metadata dependency chính xác, rồi chứng minh
regression consumer không đổi cùng toàn bộ gate bàn giao trước một commit session.

## Ranh giới

Plan pin base consumer, phiên bản, manifest consumer và npm lockfile chính xác, URL/integrity của
tarball đã phát hành và artifact session cùng digest. Base được chọn có thể là hậu duệ đã kiểm
chứng của head route chuẩn nhưng phải cùng repository Git. Chỉ giá trị dependency được gọi tên
trong dependencies hiện có được đổi. Lock chỉ đổi các entry dependency manifest đó và entry cài
đặt của chính package đó. Phiên bản workspace khác dùng được giữ nguyên. Không đổi dependency
gián tiếp, script, option, UI, test, source hoặc presentation. Không publish, push, merge, tag, serve.

Chạy install.mjs <branch> baseline trước preflight và install.mjs <branch> release sau proof before. Hai chế độ suy ra cwd session consumer từ route đã kiểm, dùng argv npm cố định; không nhận cwd tùy ý hay lệnh install riêng. Helper release dừng nếu npm đổi metadata ngoài phạm vi; chỉ hoàn nguyên phần ngoài phạm vi trước proof tiếp. test:ci nhận COVERAGE_BASE_SHA từ base đã pin và ghi vào proof.

Chạy preflight trước ghi. Chạy `run-proof.mjs <branch> before` trên phiên bản cũ và regression đang
thất bại. Cài bản đã kiểm chứng bằng install.mjs, chỉ đổi metadata đã khai. Chạy
helper cho `after` và mọi gate. Helper so từng file thường đã cài với tarball đã kiểm digest; nhãn
version không đủ. Log thô nằm trong artifact có hash. Không sửa test. Chạy đầy đủ gate test, lint,
typecheck, build đã pin từ manifest gốc; regression có filter không thay gate đầy đủ. Commit đúng
một lần rồi kiểm commit thật, diff metadata, cài đặt và hash proof.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/fe` | repository consumer và worktree session đã kiểm chứng tại base hậu duệ được chọn | yes |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `route` | `workspace.bind`; danh tính checkout chuẩn, source head và write roots chính xác | yes |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `plan` | object | — | Schema dependency-plan đóng với danh tính bản phát hành, base consumer, đường metadata, regression hiện có và gate đầy đủ |
| `resume` | token | null | Token nhánh bị chặn sau khi bản phát hành hoặc cài đặt thay đổi |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm request, session, ancestry và artifact trước ghi | `plan`, `resume` | `request/request.json`, input `route`, @workspaces/fe, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `DEPENDENCY_BOUNDARY_REJECTED` |
| 2 | Cài baseline bằng install.mjs rồi chạy nguyên regression với dependency cũ | `plan` | @workspaces/fe, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 3 | Cài bản package đã kiểm bằng install.mjs release trong trần metadata chính xác | `plan` | @workspaces/fe và artifact bản phát hành đã kiểm, @tools/shell | @workspaces/fe/branch/session trong trần metadata, @tools/sourcewrite | `DEPENDENCY_BOUNDARY_REJECTED` |
| 4 | Kiểm byte cài đặt và chạy regression cùng gate đầy đủ | `plan` | @workspaces/fe, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 5 | Commit một lần rồi kiểm diff metadata thật cùng hash proof | `plan` | @workspaces/fe, @tools/git | @workspaces/fe/branch/session, `dependency-update`, `changes`, `response/response.json` | `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED` |

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `dependency-update` | `response/data/dependency.json` | data | yes |
| `dependency-proof` | `response/data/proofs/<phase>.json` | data | yes |
| `dependency-log` | `response/artifacts/proofs/<phase>.log` | artifact | yes |
| `changes` | `response/changes.md` | md | yes |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `DEPENDENCY_BOUNDARY_REJECTED` | terminate |
| `DEPENDENCY_PROOF_FAILED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| commit metadata cần kiểm chất lượng độc lập | `quality.verify` |
