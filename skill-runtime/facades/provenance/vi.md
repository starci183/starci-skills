# Provenance facade

## LOADS

Không có.

## Purpose

Cung cấp discovery surface hẹp cho conversation-to-artifact provenance thay vì đặt nó dưới analysis, operations hoặc catchall knowledge skill.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `conversation` | `starci-conversation-record` | record hoặc query provider-neutral conversation snapshot và exact FE/BE artifact link |

## Input

Dùng yêu cầu gốc, project đã route, provider-neutral conversation identity, artifact identity/hash và operation record hoặc query được yêu cầu nhưng không dùng secret value.

## Output

Trả mode và physical skill, selection reason, unresolved fact và invocation envelope không đổi.

## Permissions

Facade không ghi snapshot, transcript, artifact, cache, secret hay registry và không chuyển giao approval.

## Stops

Dừng khi project hoặc artifact identity chưa resolve, request sẽ commit raw transcript hay secret, conversation bị dùng như product truth, hoặc request thuộc capability khác.

## Authority boundary

Dispatcher khởi động `starci-conversation-record` riêng. Custody, redaction, encryption, immutable-head và proof boundary của nó giữ nguyên. Facade không có orchestration profile.
