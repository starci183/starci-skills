# `fe/ui-detail-freeze` output

- `output.outcome`: Legacy semantic result consumed only by the Skill machine.
- `output.result`: The atomic job result with the exact direction, UI-law binding, and immutable
  `uiDetailBindingRef` consumed by layout and Grammar compilation; or null when blocked.
- `output.gaps`: Exact missing authority or evidence; empty when complete.
- `output.evidenceRefs`: Exact evidence used to produce the result.
