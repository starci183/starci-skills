---
title: Retired structure
---

# Retired structure

## LOADS

| Alias | Target | Vì sao |
|---|---|---|
| `@file-layout` | `compilers/patterns/fe/file-layout` | component-tier vocabulary đã accept |

## Dấu hiệu stale

Accepted component root còn tier `components/shells` đã retire, kể cả directory có zero file. Candidate,
preview và artifact tree không phải production component root.

## Evidence cho stale list

Đọc `@file-layout`, enumerate accepted root trực tiếp, count recursive từng retired directory, count tracked
file riêng và search import/export qua `/shells/`. Gate theo file không thấy path rỗng.

## Inventory cho repair

Với mỗi live component, resolve identity từ export, mechanic và call site. Boundary gồm folder/name, barrel
export, import, test và contract reference. Destination chưa settle là decision.

## Apply

Xóa directory rỗng và ghi before/after count dù Git không có diff. Với live file, giữ behavior/history và
migrate trọn reference graph sang tier `@file-layout` yêu cầu. Không xóa live behavior chỉ để tier biến mất.
Pass này single-writer.

## Proof

Không accepted root nào còn `components/shells`, không source import/export nào qua `/shells/`, installed
`no-shell-tier` gate active và original repository gate pass.
