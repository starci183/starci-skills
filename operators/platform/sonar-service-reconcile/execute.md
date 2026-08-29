# Execute `platform/sonar-service-reconcile`

## Context

Read only `context.authority`, the opaque `context.credentialCapability`, and `context.observedState` for the declared Sonar service and project keys.

## Input

Use one `input.desiredState` binding the approved plan hash, service, exact project set, source revisions, profiles, gates, enforcement, and effect classes.

## Action

Compare the desired set with the current provider fingerprint, apply only the approved delta through the coordinator, then reread every declared association and setting. Treat an already-converged provider as success. Do not enumerate or mutate undeclared Sonar resources, route the workflow, or manage cleanup.

## Output

Return `proved` with a fresh receipt and passing reread checks, or `blocked` with one reason. Report every partial mutation with before and after revisions.

## Stop

Stop before overwrite on authority or concurrent drift. Never infer successful enforcement from project existence alone.
