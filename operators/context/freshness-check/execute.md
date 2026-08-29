# Execute `context/freshness-check`

## Context

Read only `context.currentReceipt` metadata.

## Input

Use the exact project, context kind, source fingerprint, generator fingerprint, and contract version in `input`.

## Action

Compare the five-field expected identity tuple with the cached receipt once. Do not load source, regenerate context, mutate the cache, or select another operator.

## Output

Return the observed outcome, its one reason, the current receipt only when reusable, and the metadata evidence inspected.

## Stop

Reject malformed expected identities. Report an invalid cached identity as `blocked`; do not repair it here.
