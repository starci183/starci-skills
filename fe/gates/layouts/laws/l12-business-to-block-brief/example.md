---
id: fe-layouts-l12-example
title: L12 — Example
description: A minimal contrast between honest decomposition and premature component design.
---

# L12 — Example

Version: `1.00`

## Accepted

```json
{
  "id": "gift-catalog",
  "status": "new",
  "usage": "used-repeatedly",
  "contractDecision": "new-required",
  "contract": null,
  "businessPurpose": "Cho học viên duyệt các phần thưởng có thể đổi bằng số dư hiện có.",
  "renderBrief": "Một run các món quà lặp lại, ưu tiên khả năng đổi và chi phí trước chi tiết phụ.",
  "cssStatus": "proposed"
}
```

The complete machine object also supplies data, states, placement, evidence, reason, proposed CSS and
the full new-block brief required by the schema.

## Rejected

```json
{ "component": "GiftCardGrid", "className": "grid grid-cols-4" }
```

It invents anatomy and CSS without business decomposition or registry evidence.

