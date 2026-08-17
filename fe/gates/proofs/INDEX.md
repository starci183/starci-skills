# FE design journey proofs

- [`one-page-layout.json`](one-page-layout.json): one target → one set of 3.
- [`multi-surface-layout.json`](multi-surface-layout.json): two targets → two independent sets.
- [`page-discovers-modal.json`](page-discovers-modal.json): accepted Page A fully queues Modal B.
- [`five-block-cardinality.json`](five-block-cardinality.json): five blocks → five sets and 17 proposals.

Schema, immutability, stale-head, FTS and memory-pack proof lives in focused Node tests under
`sources/fe-design-*.test.mjs`.
