# Execute `fe/ux-flow`

## Step 1 — Model the primary task

**Read:** approved UI direction and exact business capabilities. **Context:** ignore unrelated pages and current implementation convenience. **Session write:** entry, work, review/confirmation, result, error, and exit nodes needed by the task. **Stop:** if no primary user outcome is identifiable.

## Step 2 — Model control and recovery

**Read:** exact journey and state knowledge. **Context:** orchestration may split normal path, interruption/recovery, and edge-state analysis. Model interaction jobs without prematurely assuming page, modal, drawer, popover, or inline placement. **Session write:** previous, next, jump, submit, confirm, retry, resume, and exit transitions only when relevant; include guards and recovery. **Stop:** if the user can enter a non-terminal state with no escape.

## Step 3 — Route product potential

**Read:** transitions and persistence effects. **Context:** label new backend or storage behavior as hypothesis and hand every meaningful interaction to container classification. **Session write:** typed potential signals with necessity, risk, evidence, and resume capability. **Stop:** before implementing or approving a business/database change, or before review when interaction jobs have not been exposed for container comparison.
