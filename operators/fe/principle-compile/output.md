# `fe/principle-compile` output

- `output.outcome`: Legacy semantic result consumed only by the Skill machine.
- `output.result`: The atomic job result, including the selected direction, exact versioned UI-law
  authority, one satisfied check per mandatory law, and the issued `uiLawBindingRef`; or null when blocked.
- `output.gaps`: Exact missing authority or evidence; empty when complete.
- `output.evidenceRefs`: Exact evidence used to produce the result.
