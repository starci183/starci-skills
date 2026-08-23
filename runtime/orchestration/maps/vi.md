---
title: Router phase-map orchestration
---

# Router phase-map orchestration

## LOADS

Không có.

## Routes

Resolve physical skill đã chọn qua `runtime/orchestration/profiles.json`, sau đó chỉ đọc đúng một phase-map record.

| Map | Skill đã chọn | Target |
|---|---|---|
| Frontend design | Layout, Block và Layout Refactor | `runtime/orchestration/frontend/vi.md` |
| Capability pipelines | Mọi StarCi capability còn lại | `runtime/orchestration/capabilities/vi.md` |

Thiếu entry trong machine registry là stop. Skill không fallback sang một map gần đúng.
