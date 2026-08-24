# Preflight input

Preflight accepts one normalized frontend design invocation at `request.received / ready`.

The input contains:

- a stable run id and the current routing facts;
- the user request, requested scope, actor and business-impact classification;
- references to business evidence, never an invented summary presented as evidence;
- the verified workspace and intended write roots;
- the selected Grammar id and approval mode.

The operation needs enough information to resolve the source boundary and freeze the invocation. It does not need a proposed journey, page model or layout.

`businessEvidenceRefs` may be empty only when `businessImpact` is `none`. A product-facing journey must have at least one evidence reference before it can continue.

The input is invalid when the workspace route, Grammar selection or write boundary is implicit.
