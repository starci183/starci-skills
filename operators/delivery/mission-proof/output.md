# `delivery/mission-proof` output

Return `pass` with one joined delivery-proof reference and final source-head reference, or `blocked` with evidence-linked findings.

## JSON architecture

`state` declares pass or blocked. `produced` contains the joined proof and routed heads, `context` identifies contributing proofs, and `cleanup` purges all scratch refs at `skill-terminal`.
