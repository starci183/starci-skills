# Same-state parity gate

Apply compares an approved Preview state with production only when both sides share the same state
identity.

## Comparison identity

The following must match before visual comparison begins:

- `stateId`, route and owner;
- viewport width, height and DPR;
- locale and theme;
- auth persona and permissions;
- fixture or backend seed hash;
- candidate/design-record revision and reference commit.

If any field differs, mark the comparison `invalid`, not `pass`, `fail` or “expected state
difference”. Capture the corresponding production state or return to Preview to add it.

## Tolerance

| Dimension | Tolerance |
|---|---|
| Component/owner tree | Zero unapproved substitutions |
| Contract keys and slots | Exact |
| DOM anatomy and interaction semantics | Exact except recorded framework internals |
| Copy and fixture-derived values | Exact |
| Token classes, variants, icon meaning | Exact |
| Geometry | Pixel comparison with documented rendering-noise threshold only |
| Font rasterization, anti-aliasing | May use a small measured threshold; never excuses layout drift |

Generate a parity matrix per rendered `stateId` with approved screenshot, production screenshot,
structural result, visual result and explanation for measured rendering noise. Missing evidence or
unapproved hierarchy, spacing, card anatomy, separators, typography, icons or interactions blocks
handoff and returns to Preview.
