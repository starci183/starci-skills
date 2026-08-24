# Offset Pop object: navigation and Sidebar

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-offset-pop-object-navigation` |
| Package | `@starci/grammar/offset-pop` |
| Operators | `grammar-convergence` |
| Search tags | `navigation, Sidebar, selected field, offset marker, disclosure, drawer` |
| Dependencies | `fe.grammar-offset-pop-overview, fe.grammar-common-states-accessibility` |

Navigation owns destination selection and hierarchy disclosure. Bold selected fields, contour shifts, or offset markers may express the current destination, but identity and focus remain primary.

- Use one stable alignment across repeated destinations.
- Distinguish current, hover, focus, expanded, disabled, and current-descendant without motion alone.
- Keep counts/status subordinate and geometrically stable.
- Deep hierarchy uses disclosure; do not stack offset surfaces for each level.
- Collapse preserves accessible names and current destination.
- Sticky Sidebar uses one scroll owner and avoids contour/shadow clipping.
- Mobile uses the package-declared drawer, sheet, or alternate object.

Reject route tabs or Sidebar selection as journey progress, random marker placement, and decorative labels that become false destinations.
