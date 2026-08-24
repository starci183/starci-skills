# `fe/preflight` output

Return one frozen-scope receipt and one preflight receipt.

## JSON architecture

`payload.state` emits `flow.generate / ready`; `payload.produced` holds session refs only; `payload.context.used` lists exactly the request, route, and fresh-business receipts. All scratch and receipts are purged at skill-terminal.
