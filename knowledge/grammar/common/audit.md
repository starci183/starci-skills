# Grammar implementation audit

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-audit` |
| Applies to | Every changed Grammar consumer and reusable composition |
| Contract | `runtime/contracts/grammar-audit.schema.json` |
| Search tags | `grammar, audit, owner, inset, divider, iconography, responsive` |

Audit the rendered implementation against the Grammar decision manifest before visual PASS. This is
not a taste score. Record the exact owner and evidence at wide, intermediate, compact, and each
breakpoint-adjacent state affected by the change.

For each visible surface or rail:

- one property has one visual owner: border/divider, background, radius, elevation, content inset,
  sticky/scroll lifecycle and focus boundary cannot be redundantly drawn by a parent and child;
- a host owns placement, width, sticky behavior and its external separator; the content composition
  owns its internal inset. Reject nested `px-* py-*` or duplicate divider ownership that compounds;
- measure both inline clearances around every 44px interactive footprint. The smaller clearance must
  meet the selected safe-inset token after borders and nested padding are composed;
- count separators in every responsive state. A single semantic boundary renders at most one line,
  including immediately before and after collapse, drawer, sticky and breakpoint transitions;
- every icon role binds the current `iconographyManifestRef`. One visual layer uses one family and
  optical weight. An available exact upstream glyph dominates a custom drawing;
- inspect collapsed, expanded, drawer and compact states independently. A desktop PASS does not cover
  a narrower rail or a transformed navigation mode.

Emit a Grammar audit record through `runtime/contracts/grammar-audit.mjs`. `passed` is invalid when a
required owner is duplicated, a content inset compounds, inline clearance falls below its bound,
one boundary draws multiple dividers, an icon is unbound, or a visual layer mixes families.
