# Analysis facade

## LOADS

Không có.

## Purpose

Route pre-implementation analysis tới đúng capability technical-decision hoặc business-authority.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `architecture` | `starci-architecture-analyze` | so sánh viable cross-system technical solution và trade-off |
| `business` | `starci-business-analyze` | thiết lập actor, flow, rule, state và feature head có evidence |

## Input

Dùng câu hỏi gốc, project đã route, known evidence boundary và xác định authority còn thiếu là technical choice hay business truth.

## Output

Trả một mode và physical skill, discriminating fact, unresolved fact và invocation envelope không đổi.

## Permissions

Facade chỉ selection, không ghi gì và không chuyển giao decision hay source authority.

## Stops

Dừng khi technical decision và business truth còn bị trộn, project route chưa resolve, source write chưa công bố, hoặc request thuộc capability khác.

## Authority boundary

Dispatcher khởi động physical skill được chọn như một run riêng. Mỗi physical skill giữ record boundary, owner decision, stop và output riêng. Facade không có orchestration profile.
