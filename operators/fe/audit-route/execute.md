# Execute `fe/audit-route`

Bind the latest failed visual review to its source, evidence, and finding-batch fingerprints, then
route mechanically. Shared-owner, business, backend, and runtime-auth findings route to those owners
before any visual score route. A score of `7` or `8` returns `repair`. A score below `7` returns
`reconstruct` only when at least one direct-owner structural finding proves composition failure;
otherwise return `repair`. Use `dominant` direction mode unless the active request explicitly asks
to compare alternatives.

If the frozen level is `refine` and the required route is reconstruction, return
`authorization-required`; never pretend repeated element patches can close a structurally rejected
composition. An audit-to-target request should already have frozen `reconstruct`, so this wait is for
an explicit narrow user boundary, not the default audit path.
