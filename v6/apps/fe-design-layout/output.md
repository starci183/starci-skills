# Output

Successful execution returns a complete envelope containing:

- selected flow and layout references with approval receipts;
- page, global-block, state, and source-fit models;
- grammar lock and effective source-contract receipts;
- request files for every permitted creation or grammar gap;
- implementation and product-seed evidence;
- gate and browser-proof evidence;
- status `complete` with fact `proof-pass`.

Blocked execution returns status `blocked`, the exact missing or conflicting evidence, and the operation that refused to continue. A grammar gap is blocked until its grammar request is resolved; it is never reconstructed locally.
