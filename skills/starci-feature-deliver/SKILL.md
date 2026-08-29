---
name: starci-feature-deliver
description: Coordinate one cross-domain feature mission by calling domain skills and resuming exact receipts; never implement or self-certify.
---

# starci-feature-deliver

Coordinate one cross-domain feature mission by calling domain skills and resuming exact receipts; never implement or self-certify.

Hold the mission identity while business, backend, frontend, quality, and UAT skills work. Emit typed handoffs and consume exact receipts before resuming. Never edit product source, implement a domain outcome, or certify your own work.

## Runtime continuation

Every peer call emits a typed CALL and is resumed only by consuming a correlated runtime `RETURN` receipt. Mission id, parent-child id, authority/source heads, resume state, and progress fingerprint must match. Repeated repair or peer-call fingerprints block as no-progress cycles.
