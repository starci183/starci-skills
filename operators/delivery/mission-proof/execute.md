# Execute delivery/mission-proof

## Context

Read only the closed context fields and declared context references.

## Input

Use the exact closed input for this one job.

## Action

Perform exactly one mission proof job. Do not route, loop, wait, branch to another operator, or retain session state.

## Output

Return one typed output.outcome and bounded evidence. The parent Skill machine owns routing.

## Stop

Stop on a declared condition or before exceeding the exact mutation boundary.
