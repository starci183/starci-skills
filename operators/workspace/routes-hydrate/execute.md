# Execute `workspace/routes-hydrate`

## Context

Resolve only the supplied exact references with default repository or file search. Verify their frozen fingerprint and routed project identity.

## Input

Bind all work to the verified project and one bounded objective.

## Action

Hydrates machine-local routes from portable declarations. Do not route later work, own workflow state, broaden source scope, or perform another operator's job.

Canonical V6 hydration emits `schemaRevision: 2` and a paired `contract` / `contractSource`. The
immediately preceding unrevisioned V6 declaration remains readable only for Source-readiness
migration; when it predates contract discovery, both fields default to `null` together.

## Output

Return only one atomic result: `outcome`, `resultRef`, `evidenceRefs`, `findings`, and `reason`.

## Stop

Return the applicable non-success outcome when evidence is missing, fingerprints drift, or the requested work exceeds this single job.
