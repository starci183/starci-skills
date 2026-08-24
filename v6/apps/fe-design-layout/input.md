# Input

The app accepts one request envelope with:

- a stable `runId`;
- the raw frontend request;
- references to business evidence, never invented business facts;
- the target workspace;
- an optional continuation artifact from an earlier wait or repair route.

The initial stage is `request.received`, status is `ready`, and facts are empty unless the request supplies verifiable receipts.

An approval continuation must preserve `runId` and artifact references. It changes only the review status, selected direction reference, feedback, and corresponding selection fact.
