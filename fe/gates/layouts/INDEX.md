# Gate 1 — layouts

Layout converts raw business input into complete surface and block briefs. Input may name one or
many pages, layouts, modals, drawers or overlays. Every target gets an independent set of 3–4 JSON
candidates in every round; there is no recommended candidate and no implicit acceptance.

Each candidate has exactly three design payloads:

- `business`: interpreted goal, actors, outcomes, constraints and open facts.
- `main`: target kind, distribution, concrete CSS/responsive composition and a detailed block
  inventory. Every block says whether it is used; unused/conditional blocks explain what they would
  render and when.
- `extends`: navbar, modal, drawer or other dependent surface edges with owner, trigger, mount and
  render brief.

Accepting a candidate whitelists its hash and queues every unresolved `extends.surfaceId` for its own
3–4 candidates. A shared surface has one stable node but keeps distinct parent edges. Cycles become
findings. Alteration appends a new round with `basedOnHash`; it never edits the old round.

Goal: [`GOAL.md`](GOAL.md). Contract: [`gate.schema.json`](gate.schema.json). Shared session law:
[`../session.schema.json`](../session.schema.json).
