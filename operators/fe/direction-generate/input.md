# `fe/direction-generate` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.

## Input

- `input.compiledRequestRef`: Exact compiled request artifact authorizing this generation.
- `input.compiledRequestFingerprint`: Fingerprint of that exact author-once compiled request.
- `input.grammarBinding`: Exact Grammar package, manifest, exports, hash, and revision from compilation.
- `input.targetRef`: The one target owned by this invocation.
- `input.mode`: `dominant` for exactly one evidenced direction. Use `alternatives` when valid Grammar
  evidence leaves no materially dominant direction or the user explicitly requests comparison.
- `input.constraints`: Non-empty closed constraints for this atomic job.
