# `fe/product-potential` output

- `output.outcome`: Legacy semantic result consumed only by the Skill machine.
- `output.result`: The exhaustive `ADD / CHANGE / REMOVE / KEEP` capability decisions, required flow
  relations, smallest likely owner for each delta, and atomic evidence; null when blocked.
- `output.gaps`: Exact missing authority or evidence; empty when complete.
- `output.evidenceRefs`: Exact evidence used to produce the result.
