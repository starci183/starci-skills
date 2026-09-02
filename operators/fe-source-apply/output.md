# Output of `fe.source.apply`

The operator returns one closed envelope with `outcome` equal to `applied` or `blocked`. It never
emits a handoff or free-form routing instruction.

## Applied receipt

An applied receipt contains:

- exact project, source, target, resolution, owner ceiling, input, and progress bindings;
- the resolution actually read, with its fingerprint and resolved tree fingerprint;
- the declared write set, repeated in full so the ceiling and the result read side by side;
- one write entry per touched path, naming the owner, the action, the fingerprint before and after,
  the nodes carried, the classes written, the identifiers claimed, and whether the contract attribute
  was written;
- the class inventory and rule inventory the resolution published;
- findings for created files, unchanged files, and declared paths that produced nothing.

The receipt accounts for every byte that entered the repository. It does not prove that the result
renders correctly, and it carries no verdict, score, or pass claim.

## Write actions

Each write names one action:

| Action | Meaning | Fingerprint before | Classes |
| --- | --- | --- | --- |
| `created` | The path did not exist and now does | `null` | Allowed |
| `modified` | The path existed and its content moved | Required, and different from after | Allowed |
| `unchanged` | The projection equalled the current content | Required, and equal to after | Forbidden |

`unchanged` is a measurement, not an opinion: the fingerprint taken before the projection and the
fingerprint taken after must be identical. An `unchanged` entry that emits classes is rejected,
because a class written is a change by definition.

An applied receipt requires at least one `created` or `modified` write. An application in which every
declared path came back unchanged is `NO_PROGRESS`, not a quiet success.

## Declared paths that produced nothing

A declared path with no write entry must carry a `WRITE_SET_PATH_UNUSED` finding. The write set is a
ceiling and it is normal for a ceiling to be wider than the result, but a path that vanishes from the
report is indistinguishable from a path that was silently skipped.

## Blocked receipt

A blocked receipt has no application, and no file was written. It contains one typed failure, the
exact paths and references involved, the owning domain, retryability, and, only when retryable, a
single-use resume token with the required material delta.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed source no longer matches the frozen head. | Refreshed source binding. |
| `OWNER_CONFLICT` | A declared path lies outside every mutable owner root, or under an observation-only owner. | Corrected owner authority. |
| `RESOLUTION_STALE` | The resolution read differs from the resolution bound. | The current resolution receipt and its fingerprint. |
| `WRITE_REJECTED` | A file or a value the write would produce is outside what was authorised. | A corrected write set, or a new resolution that publishes the value. |
| `NO_PROGRESS` | Nothing changed, or a resume adds no effective delta. | A materially new resolution, write set, or scope. |

`WRITE_REJECTED` is the expected outcome when the write set is narrower than the change, not a defect
in the resolution. It is owned by the caller who declared the ceiling, and applying the same source
again with a corrected write set is the correct next step.

## Cross-field invariants

- `outcome="applied"` requires `receipt.status="applied"`, non-null `application`, null `failure`, and
  null `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `application`, and non-null `failure`.
  A retryable failure requires a resume; a non-retryable failure forbids one.
- The applied resolution reference and fingerprint equal the bound resolution reference and
  fingerprint.
- Every written path appears in the declared write set, under the same owner.
- Every declared path lies under the root of its own mutable owner, and never under an
  observation-only owner.
- Every declared path is written at most once.
- A declared `create` intent never reports a modification, and a declared `modify` intent never
  reports a creation.
- Every class written appears in the resolution class inventory, and every identifier carried appears
  in the applied rule inventory.
- A write that carries classes names the nodes that carry them.
- `created` has a null fingerprint before; `modified` has a differing one; `unchanged` has an equal
  one and emits no classes.
- At least one write is a creation or a modification.
- `receipt-only` emission writes no contract attribute; `attribute` emission writes one wherever
  resolved classes were written.
- Every declared path with no write carries a `WRITE_SET_PATH_UNUSED` finding.
- Every finding names a declared path and agrees with that path's recorded action.
- `artifactRefs` registers every created or modified path.
- `handoff` is always `null`.

## Practical outcomes

Apply a resolved dashboard tree: the page file is modified and carries `GAP-5` with its claim, a new
summary section file is created and carries `GAP-4` and `GAP-1`, and the declared legend path produces
nothing and is reported unused. Two paths enter `artifactRefs`, and one does not, because nothing was
written to it.

Apply a resolved tree whose change reaches the shell: the invocation returns `WRITE_REJECTED` naming
the shell path, and no file anywhere is written.
