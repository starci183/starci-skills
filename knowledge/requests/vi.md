---
title: Frontend design requests
---

# Frontend design requests

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@request-schema` | `knowledge/requests/request.schema.json` | file | validate một frontend design request bền vững |
| `@rejects-schema` | `knowledge/requests/rejects.schema.json` | file | validate bảng rejected source attempts |
| `@validate-request` | `scripts/validate-design-request.mjs` | script | validate một request hoặc toàn bộ queue |

## Record

`knowledge/requests/*.request.json` là queue bền giữa bước nhận feedback và bước resolve design. Request có thể mô tả mọi
sai lệch frontend UI hay user flow quan sát được, gồm hierarchy, navigation, interaction, responsive behavior,
accessibility, state presentation, content structure hoặc iconography.

Request là evidence và work intent. Nó không phải product truth, grammar, principle hay bằng chứng rằng nguyên nhân
được nêu là đúng. `starci-fe-design-refactor` reproduce feedback, sửa và prove product source trước rồi mới tạo/cập
nhật request. `starci-fe-design-resolve` audit source attempt đó, thay nếu sai, cập nhật durable authority rồi đóng.

## Law

Mỗi request giữ nguyên feedback của owner và expected outcome mà chưa kết luận sớm failed layer. Resolver ghi
authority disposition cuối cùng:

- product-specific meaning, outcome, semantic ownership và durable behavior thuộc routed grammar;
- product-neutral visual situation chỉ thuộc principles khi reusable evidence đủ để generalize;
- application/enforcement miss vẫn phải có executable grammar/principle regression case nhỏ nhất để feedback đã
  accepted không tái diễn âm thầm.

Intake rộng không cho phép bịa business capability. Feedback thay actor, entitlement, operation, backend
capability hay product truth giữ trạng thái `blocked` cho tới khi business authority sở hữu nó được accepted.

`knowledge/requests/rejects.json` là bảng append-only cho source attempt bị reject trong resolution. Một reject giữ request
id, affected paths, reason và evidence trước khi resolver đè product bằng attempt đúng. Reject update chính request
cũ, không tạo duplicate request cho cùng expected outcome.

## Lifecycle

| Status | Owner | Ý nghĩa |
|---|---|---|
| `open` | `starci-fe-design-refactor` | source đã sửa/prove hoặc request ghi rõ lý do source bị block; còn authority resolution |
| `in-progress` | `starci-fe-design-resolve` | exact request set và write boundary đang được xử lý |
| `blocked` | resolver | thiếu evidence, business authority, access hoặc approval |
| `resolved` | resolver | authority, source và proof đã hoàn tất |
| `superseded` | resolver | request khác sở hữu cùng outcome và replacement đã được ghi |

Request vẫn nằm trong thư mục này sau khi resolved. Status đổi tại chỗ để link và review history ổn định. Tên file
là `<id>.request.json`; `id` là immutable.

## Rules

1. Nhận mọi feedback UI/user-flow cụ thể có project và recoverable surface hoặc expected outcome; phần chưa chắc
   được ghi thành hypothesis, không bị từ chối.
2. Redact secret và private provider/tool output. Durable evidence dùng stable reference hoặc summary ngắn.
3. Intake sửa và prove exact product source trước, rồi tạo/cập nhật request; không sửa grammar/principles.
4. Resolution audit source attempt. Nếu sai, append một reject row trước khi đè source và update chính request với
   replacement paths/proof.
5. Trước khi request thành `resolved`, resolution phải cập nhật ít nhất một routed grammar/principle authority path;
   request cũng phải giữ final applied source paths và passing proof.
6. Principle change cần reusable product-neutral evidence. Product owner ruling có thể cập nhật routed grammar mà
   không giả làm universal law.
7. Không resolve các request xung đột trong cùng batch trước khi expected outcome được reconcile.
8. External publication, package release, push và deploy chỉ dùng authority user đã cấp; queue không tự cấp quyền.
9. Chạy `node scripts/validate-design-request.mjs --all` trước khi commit request change.

## Output

```text
request: <id>
status: <open | in-progress | blocked | resolved | superseded>
scope: <project/role and surfaces>
feedback: <preserved owner outcome>
authority: <pending | grammar | principle | both>
implementation: <pending | planned | applied>
proof: <pending | passed | failed | blocked>
```

## Stops

- Request sắp lưu credential, raw private conversation content hoặc temporary signed URL.
- Không resolve được project identity và không có safe durable project key.
- Source attempt fail nhưng resolver đè mà chưa ghi reject row.
- Resolver cố đóng request khi chưa có authority change, final applied source và passing proof.
- Hai request đã chọn yêu cầu outcome loại trừ nhau nhưng chưa có owner ruling reconcile.
