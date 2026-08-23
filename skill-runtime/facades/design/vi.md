# Design facade

## LOADS

Không có.

## Purpose

Giảm chi phí discovery cho yêu cầu thiết kế frontend mà không tạo thêm executable capability. Facade chọn một physical skill hiện hữu và có thể đính kèm compact design-knowledge query result.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `layout` | `starci-fe-design-layout` | trang hoàn chỉnh hoặc flow đầu-cuối mới |
| `block` | `starci-fe-design-block` | phần bổ sung component-impact trong complete parent không đổi |
| `refactor` | `starci-fe-design-refactor` | feedback cụ thể được sửa source-first |
| `reconcile` | `starci-fe-ui-reconcile` | tính nhất quán trên tập existing surface đóng |
| `resolve` | `starci-fe-design-resolve` | source correction đã chấp nhận được học vào durable authority |
| `refresh-references` | `starci-grammar-refresh-references` | refresh stale optional immutable provenance mà không đổi authority |

Extension có page impact route sang `layout`. Thay đổi micro chính xác dùng plain edit path. `refresh-references` là maintenance, không phải `resolve`.

## Input

Dùng yêu cầu gốc, observable impact, Source/project đã route và chỉ grammar/profile identifier được route rõ ràng. Similarity không được tự đoán grammar hay profile.

## Output

Trả selected mode và physical skill, discriminating fact, query provenance hoặc typed stop, unresolved fact và invocation envelope không đổi.

## Permissions

Selection và pre-dispatch query đều chỉ đọc. Chúng không bao giờ dùng `--rebuild-if-stale`; index thiếu hoặc stale sẽ dừng selection để một cache-maintenance action tường minh rebuild bên ngoài facade. Facade không ghi product, authority, provider, credential, cache hay external state và không chuyển giao approval.

## Stops

Dừng khi không chọn được đúng một mode, chưa resolve project route, explicit filter không hợp lệ, query thoát mã `2`, `3` hoặc `4`, còn nhiều owner, hoặc cần boundary mới.

## Authority boundary

Dispatcher khởi động physical skill được chọn như một run riêng. Chỉ skill đó sở hữu topology, source boundary, staged approval, write, gate và proof. Facade này không có orchestration profile mới.
