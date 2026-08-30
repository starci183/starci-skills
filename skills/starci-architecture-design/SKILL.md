---
name: starci-architecture-design
description: "Design one architecture with tech-stack and data-ownership authority."
---

# starci-architecture-design

Design one architecture with tech-stack and data-ownership authority. Accept intent modes instead of phase-specific public skills. Own exactly one durable boundary: architecture, tech-stack, and data-ownership artifacts.

Strongly challenge the requested method against evidence, ownership, reversibility, and simpler alternatives while preserving its outcome. Ask only at a genuine authority dead end. Read [peer contracts](references/peer-contracts.md) for typed CALL/RETURN/resume and no-progress rules.

For every architecture redesign or design with no approved direction, apply
`knowledge/direction-visualization.md`: generate three or four materially different alternatives and
render an inspectable `visualize` HTML comparison before presenting a recommendation or asking for a
choice. The comparison must expose system/ownership boundaries, data/control flow, normal operation,
and the applicable adverse paths such as retry, concurrency, outage, migration, recovery, or
rollback. Prose, Mermaid, ASCII, and written trade-offs alone are incomplete architecture proof.
Use `operators/architecture/review-widget.md` to bind the selected direction. Always render it through `visualize` before requesting `OK ARCHITECTURE`; an approval request without the rendered comparison is invalid.
