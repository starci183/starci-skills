# Output của `fe.direction.decide`

Operator trả một closed envelope có `outcome` bằng `decided` hoặc `blocked`. Nó không phát handoff hay
free-form routing instruction.

## Decided receipt

Decided receipt chứa:

- binding chính xác của project, source, target, intent, change level, owner ceiling, business,
  backend, architecture, Grammar, context, input và progress;
- một direction classification: `locked-refine`, `approved-reuse`, `dominant` hoặc
  `selected-alternative`;
- UI contract sẵn sàng cho implementation, gồm purpose, actor, region, action, state, responsive
  transformation, accessibility, content, media, Grammar, phần giữ nguyên, phần thay đổi và
  implementation constraint;
- inspectable visual artifact khi có generation hoặc comparison;
- finding add/change/remove và contradiction;
- exact evidence cùng artifact reference.

Receipt cho phép downstream implementation áp dụng direction trong frozen owner ceiling. Nó không
chứng minh implementation đã tồn tại hay đã PASS visual, quality hoặc UAT.

## Blocked receipt

Blocked receipt không có decision. Nó chứa một typed failure, exact reference thiếu hoặc mâu thuẫn,
owning domain, retryability và—chỉ khi retry được—single-use resume token cùng material delta bắt buộc.

`DIRECTION_CHOICE_REQUIRED` còn chứa đúng ba hoặc bốn rendered alternative. Đây là operator result đã
kết thúc, không phải internal wait. Caller lấy một lựa chọn có exact product authority rồi gọi lại
chính operator bằng correlated resume payload.

## Failure code

| Code | Vấn đề sở hữu | Material delta hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract fail. | Input đã sửa. |
| `ROUTE_UNVERIFIED` | Project hoặc checkout identity chưa verify. | Verified route binding. |
| `SOURCE_DRIFT` | Observed source không còn khớp frozen head. | Source evidence mới và scope check. |
| `SCOPE_UNFROZEN` | Target, inclusion, exclusion hoặc boundary chưa đóng. | Frozen scope. |
| `CHANGE_LEVEL_AMBIGUOUS` | Authority giữa `new`, `reconstruct`, `refine` chưa rõ. | Exact change-level authority. |
| `OWNER_CEILING_INVALID` | Owner set giao nhau hoặc required owner bị loại trừ. | Owner authority đã sửa. |
| `BUSINESS_REQUIRED` | Actor, promise, permission, adverse outcome hoặc recovery truth chưa chốt. | Accepted business receipt. |
| `BACKEND_REQUIRED` | UI phụ thuộc API, state, auth, persistence hay failure behavior chưa duyệt. | Accepted backend receipt. |
| `ARCHITECTURE_REQUIRED` | UI phụ thuộc system/data boundary chưa chốt. | Accepted architecture receipt. |
| `GRAMMAR_REQUIRED` | Reusable interface bắt buộc chưa publish. | Exact Grammar package đã publish. |
| `EVIDENCE_MISSING` | Material claim không thể quan sát hay falsify. | Exact evidence mới. |
| `REFERENCE_EVIDENCE_EXHAUSTED` | Bounded research không support được decision. | Owning authority hoặc evidence mới có tính material. |
| `NO_VIABLE_DIRECTION` | Mọi candidate trái authority hoặc fail mandatory attack. | Authority/constraint thay đổi, không phải cosmetic variant. |
| `DIRECTION_CHOICE_REQUIRED` | Còn ba/bốn material direction hợp lệ mà không có lựa chọn trội hơn. | Chọn đúng một candidate với product authority. |
| `NO_PROGRESS` | Resume không thêm delta có hiệu lực. | Authority, evidence, source, Grammar hoặc selection mới có tính material. |

## Cross-field invariant

- `outcome="decided"` yêu cầu `receipt.status="decided"`, `decision` khác null, `failure` null,
  `resume` null, không có error finding và có ít nhất một evidence reference.
- `outcome="blocked"` yêu cầu `receipt.status="blocked"`, `decision` null và `failure` khác null.
- Failure retry được yêu cầu `resume` khác null; failure không retry yêu cầu `resume` null.
- `DIRECTION_CHOICE_REQUIRED` yêu cầu đúng ba/bốn alternative; mỗi alternative có identity,
  fingerprint, visual reference, material difference và trade-off unique. Resume candidate ID phải
  bằng tập alternative ID.
- `locked-refine` bind `changeLevel="refine"` và giữ structural invariant đã khóa.
- `approved-reuse` bind exact approved direction triple từ input.
- `dominant` có generated decision artifact và không có alternative.
- `selected-alternative` giữ mọi alternative và chọn một ID trong đó mà không generate lại.
- Mọi decision visual reference phải đăng ký trong `output.artifactRefs`; mọi receipt evidence
  reference phải đăng ký trong `output.evidenceRefs`.
- `handoff` luôn là `null`.

## Outcome thực dụng

Tạo trang A: `intent=create`, `changeLevel=new` và `dominant` mode mặc định tạo một realistic,
reversible direction receipt khi business, backend và Grammar authority đã đầy đủ.

Sửa trang B: `intent=modify`, `changeLevel=reconstruct` và `compare` mode đã được cấp quyền tạo blocked
choice receipt có ba/bốn rendered alternative; correlated selection resume tạo
`selected-alternative` mà không mutate source.

