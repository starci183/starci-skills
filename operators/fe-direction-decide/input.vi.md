# Input của `fe.direction.decide`

Input có hai phần đóng: `context` khai báo chính xác vật liệu đã có mà operator được đọc, còn `input`
khai báo decision boundary cần thực thi. Field không được khai báo là invalid.

## Envelope

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `fe.direction.decide`.
- `context`: authority và evidence binding theo contract context.
- `input`: một frontend direction decision đã đóng băng.

## Context binding

`context.business` và `context.grammar` luôn bắt buộc. `context.backend` và
`context.architecture` phải là binding accepted đầy đủ hoặc `null`; binding chỉ có reference hay chỉ có
fingerprint đều invalid.

Knowledge, source, UAT, audit, visual, previous-direction và external-reference dùng cùng immutable
record: `ref` chính xác, content `fingerprint`, `sourceHead` tùy trường hợp và `observedAt`. Array chứa
record quyết định vai trò của nó. Mọi source observation phải dùng đúng source head đã quan sát.

## Decision boundary

- `input.project` bind frontend source đã verify và artifact write root duy nhất.
- `input.target` xác định đúng một page, layout, modal, drawer, flow, block hoặc component.
- `input.intent` là `create`, `modify`, `audit-repair` hoặc `reconcile`.
- `input.changeLevel` là đúng một trong `new`, `reconstruct` hoặc `refine`.
- `input.scope.ownerCeiling` chia owner thành mutable và observation-only. Hai tập unique, không giao
  nhau và target owner phải mutable.
- `input.constraints` chỉ chứa constraint đã có authority. Nó không được tạo behavior mới.

## Direction policy

`decisionPolicy.mode` là:

- `preserve` cho `refine`, hoặc khi dùng lại chính xác direction `new`/`reconstruct` đã duyệt;
- `dominant` cho quyết định mặc định gồm một direction;
- `compare` chỉ khi user yêu cầu compare rõ ràng hoặc đã chứng minh còn material ambiguity sau khi
  Grammar đầy đủ.

`compare` yêu cầu `alternativeCount` bằng `3` hoặc `4`. Mode khác yêu cầu `null`.

Approved direction chỉ hợp lệ khi có đúng bộ ba `directionRef`, `directionFingerprint` và
direction-specific `approvalRef`. Trường hợp này phải dùng `preserve`. Generic approval không cho phép
reuse.

## Invariant của change level

- `create` và `new` luôn đi cùng nhau.
- `modify`, `audit-repair` và `reconcile` dùng `reconstruct` hoặc `refine`.
- `refine` dùng `preserve`, không có generated/approved-direction reuse object và phải khóa region
  ownership/order, navigation, task sequence, interaction container, responsive structure cùng
  primary/secondary span.
- `reconstruct` có thể thay cấu trúc UI hiện tại nhưng không được thay business/backend authority.

## Resume input

`resume` là `null` với invocation mới. Invocation resume truyền exact blocked receipt, single-use
token, context reference mới thêm và tùy trường hợp một selected alternative ID.

Mission, project, source, target, change level, owner ceiling và mọi authority fingerprint không đổi
phải bằng blocked receipt. Selected ID phải có trong receipt đó. Resume không thêm authority, evidence,
source binding mới, Grammar đã publish hay exact selection phải bị từ chối bằng `NO_PROGRESS`.

