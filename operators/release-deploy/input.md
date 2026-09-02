# Input for `release.deploy`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the one release to deploy and the target it may change.
Undeclared fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `release.deploy`.
- `context`: intent, law, manifest, authorization, credential, and observation bindings described by
  `context.md`.
- `input`: one immutable release and one declared target.

## Context bindings

`context.intent` binds the durable `.stacks` declaration by fingerprint, and its environment equals
`input.target.environment`. `context.lifecycle` binds the deployment law. `context.manifest` names the
already-validated manifest and the release identity it was pinned to, which must be this release.

`context.authorization` carries the declared `deploy` grant, its scope, and its validity window. The
scope must match this project, this environment, and this target, and the grant must still be valid at
the moment the target was observed.

`context.credentials` lists opaque `secret-ref://` handles and their custody references. No field
accepts a value.

`context.observed` is the baseline for every compare-and-set: the target reference, its revision, its
active release, its active digest, and the time it was read.

## Release identity

`input.release` is immutable and exact: a release identity, the artifact reference, the `sha256:`
digest that identifies it, the source head it was built from, and the literal `immutable: true`. The
digest is what the deployment means; the tag is not.

## Target and strategy

`input.target` names one target, its environment, its rollout strategy, the number of declared
targets, and `replacedReleaseId`: the release currently active, which must equal the observed active
release. Recording it is what makes concurrent drift detectable, because any other release appearing
during execution belongs to somebody else's run.

## Steady window and probes

`input.steady` declares the window steady state must hold for, the bounded deadline, and the probe
backoff. The deadline must exceed the window it has to contain, and the backoff cannot exceed the
window.

`input.probes` declares what will be measured. At least one probe must be public. On this project the
GraphQL typename probe returning `200` is the readiness signal, and boot after a push to `main` takes
roughly eight to nine minutes, so a deadline is sized against that reality rather than against
optimism.

## Rollback identity

`input.rollbackIdentity` names the exact safe release that can be restored, its artifact, its digest,
and whether the current data and schema state remain compatible with it. It must name a different
release and a different digest than the one being deployed. It may be `null`, and then the rollback
branch is unavailable and an unrecoverable rollout blocks instead.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since. A resume that adds no authorization, manifest,
credential, or observation delta is invalid as `NO_PROGRESS`.
