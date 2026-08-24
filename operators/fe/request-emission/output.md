# Request emission output

The operator returns a complete receipt for the request files it wrote. The artifact must validate against `output.schema.json`.

For every obligation, the receipt includes its stable ID, exact repository-relative path and content hash. `requestPaths` and `receipts` must describe the same set.

## Ready result

Ordinary Block creation or a declared lower-tier extension emits `request.result / ready` with `requests-emitted`. Implementation may start only from this receipt.

## Blocked result

A Grammar gap still emits its durable request, then returns `request.result / blocked` with `grammar-gap` and `requests-emitted`. The block is intentional: application source may not reconstruct a missing reusable leaf, branch, composite, invariant, variable axis or complex-case owner.

Writing a request is not approval to publish a package, change Grammar, or widen the approved source boundary.
