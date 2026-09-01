# Core pattern: PageContainer

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-pattern-page-container` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/core` |
| Operators | `fe/authority-reconcile` |
| Search tags | `page container, content inset, px-3, py-6, peer card rhythm, gap-6` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-semantic-composition` |

## Closed contract

`PageContainer` owns one readable page measure and the outer content rhythm:

- page/content inset is `space.inline.3` (`px-3`) and `space.block.6` (`py-6`);
- peer block surfaces and peer cards use `space.6` (`gap-6`);
- internal card groups, rows, controls, and copy do not inherit the peer gap; their owning object binds
  its own tighter rhythm;
- nested layouts may consume the container boundary but may not add a second full page inset;
- compact transformation preserves the semantic inset owner and must not collapse content against the
  host edge.

The pattern does not force every region into a Card and does not set card-body padding. Surface modes
belong to `fe.grammar-core-object-surface-card`. A right rail using `inset=content` reuses this exact
content inset instead of publishing another numeric rule.

## Proof

Verify wide/intermediate/compact widths, first/last child, peer cards, mixed framed/frameless blocks,
nested layouts, long content, terminal scroll clearance, and alignment with navigation/rail boundaries.

Reject duplicated page padding, an arbitrary per-page inset, `gap-6` applied inside every component,
peer cards touching, and padding used to hide a wrong semantic owner.
