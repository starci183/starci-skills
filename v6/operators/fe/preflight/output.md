# Preflight output

Successful preflight returns `flow.generate / ready` with a frozen request reference and four receipts:

- workspace route receipt;
- business evidence receipt;
- effective source-contract receipt;
- Grammar lock receipt.

Receipts contain stable artifact references and hashes. They do not inline source contracts, component inventories or Grammar instructions. Creative operators receive the product problem and evidence without carrying implementation vocabulary into their input.

The output also records the exact allowed write roots and approval mode. No frontend source is changed by preflight.

Failure is a stop, not a best-effort continuation. A stale route, failed contract export, unresolved Grammar, business request without evidence, or write boundary outside the verified workspace leaves no output artifact for the next stage.
