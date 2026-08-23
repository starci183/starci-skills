# Backend facade

## LOADS

Không có.

## Purpose

Làm backend discovery nhẹ hơn trong khi giữ hard boundary giữa brief chỉ đọc và production implementation đã được approve.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `plan` | `starci-be-plan` | nêu file, boundary và test trước khi capability code tồn tại |
| `approve` | `starci-be-approve` | challenge và implement một exact backend brief đã có |

## Input

Dùng yêu cầu gốc, backend role đã route, live-schema scope và exact brief identity khi yêu cầu implementation.

## Output

Trả một mode và physical skill, selection reason, unresolved fact và invocation envelope không đổi.

## Permissions

Facade chỉ selection và không thực hiện read/write workflow của capability đã chọn. Nó không chuyển giao approval.

## Stops

Dừng khi chưa resolve backend route, implementation thiếu exact brief, yêu cầu trộn planning với write chưa công bố, hoặc request thuộc capability khác.

## Authority boundary

Dispatcher khởi động physical skill đã chọn như một run riêng. `starci-be-plan` vẫn không ghi product; `starci-be-approve` giữ explicit approval stop trước production write đầu tiên. Không thêm facade orchestration profile.
