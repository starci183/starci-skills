# Quality facade

## LOADS

Không có.

## Purpose

Route quality request mà không để read-only audit âm thầm trở thành repair hoặc provider mutation.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `stale-list` | `starci-stale-list` | inventory stale và check-only rộng trên routed Source |
| `diagnose-skill` | `starci-diagnose` | trace một skill và xác định correct stop |
| `repair` | `starci-repair` | đưa Source đã đo là đỏ hoặc thiếu assurance về xanh |
| `debt` | `starci-debt-repay` | repay existing owner-approved debt record |

## Input

Dùng yêu cầu gốc, Source/project và role route, measurement hay mutation được yêu cầu, cùng exact repair/debt/provider scope khi liên quan.

## Output

Trả một mode và physical skill, selection reason, risk class, unresolved fact và invocation envelope không đổi.

## Permissions

Facade là read-only selection metadata. Nó không chuyển giao approval, credential, mutation authority hay proof claim.

## Stops

Dừng khi chưa rõ measurement hay mutation, route chưa resolve, repair/debt scope chưa công bố, provider credential thiếu authority, hoặc request thuộc capability khác.

## Authority boundary

Dispatcher khởi động physical skill được chọn như một run riêng. Read-only skill vẫn chỉ đọc; repair và debt giữ approval, gate và source boundary hiện hữu. Facade không cần orchestration profile.
