# Product Proof output

The output validates against `output.schema.json` and has four possible routes.

## Complete

`proof.review / complete` with `proof-pass` means all required gates and browser scenarios passed against the approved hashes, exact source boundary and seeded business states.

## In-boundary repair

`code.repair / repair` with `in-boundary-repair` returns precise failures to Implementation. This route is allowed only when the fix preserves the approved journey, page/block structure, responsive behavior, package ownership and source boundary. It requires no new approval.

## Boundary drift

`layout.review / rejected` with `boundary-drift` and `layout-feedback-recorded` sends the failure through Layout regeneration, then back to the existing layout approval checkpoint. It is the second app approval, not a third approval type. The output names the violated boundary and invalidates the old layout hash for further source writes.

## Blocked

`proof.review / blocked` records an environmental, evidence or safety condition that prevents a valid verdict. A blocked result never masquerades as repair or success.
