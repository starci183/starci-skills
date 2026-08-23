# Workspace facade

## LOADS

Không có.

## Purpose

Giữ Source và machine readiness tách khỏi product repair và runtime operation.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `init` | `starci-init` | decrypt identity, bootstrap, workspace declaration compile/hydration hoặc worktree/session readiness |

## Input

Dùng yêu cầu gốc, Source identity, machine/project/role target và readiness root cụ thể đang thiếu hoặc stale.

## Output

Trả mode và physical skill, selection reason, unresolved fact và invocation envelope không đổi.

## Permissions

Facade không thực hiện initialization write, target-repository edit, credential intake hay approval transfer.

## Stops

Dừng khi Source identity chưa resolve, request gồm target product edit, intent là deployment hoặc product repair, hay request thuộc capability khác.

## Authority boundary

Dispatcher khởi động `starci-init` riêng. Các readiness root được approve độc lập và boundary không sửa target repository của nó giữ nguyên. Facade không có orchestration profile.
