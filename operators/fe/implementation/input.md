# Implementation input

This operator receives one approved layout direction, its exact source boundary and the resolved source-fit plan. It writes product source; it does not reopen direction generation.

The input must validate against `input.schema.json`.

## Normal entry

Implementation may begin directly from `requests.review / ready` when no creation request is required, or from `request.result / ready` after every required request has been persisted. Both routes must be free of `grammar-gap`.

## Repair entry

`code.repair / repair` is accepted only with `in-boundary-repair` and without `boundary-drift`. The repair input must identify failed proof checks and preserve the same approved layout hash and source boundary.

## Source law

Application-owned work starts at Product Blocks and may extend upward through layouts and pages. A local composite, branch or leaf may change only when `permittedLowerTierExtensions` names its exact path, declared extension axis, effective source-contract reference and durable request path.

The operator must never:

- recreate a package-owned Grammar primitive locally;
- introduce business-bearing elements into Grammar;
- modify `global.css` except approved color-token values;
- write outside `exactSourceBoundary`;
- merge a base contract with a source delta itself. It consumes the resolved effective contract.
