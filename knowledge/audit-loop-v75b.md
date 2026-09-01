# Frontend linear delivery machine

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.audit-loop-v75b` |
| Contract revision | `7.6.0` |
| Owner | `starci-fe-process` |
| Scope | Every UI/UX create, reconstruct, refine, audit, repair, redesign, debug, or reconcile mission |

## Single visible machine

Every frontend mission uses one linear machine:

```text
compile
  -> generate?                 # only new/reconstruct without an approved direction
  -> apply
  -> capture/preflight
  -> blind review
  -> quality
  -> UAT
```

Target resolution, business binding, journey reasoning, state modeling, page/block modeling, source
fit, Grammar convergence, owner classification, runtime observation, and evidence shaping are
helpers inside these stages. They are not user-visible stages, alternate routes, checkpoints, or
independent loops. No knowledge record may introduce a second frontend route around this machine.

## `compile`

Compile one closed contract before product mutation. It binds the verified project/source, business
facts, complete direct owner group, change level, layout owner ceiling, exact write set and hashes,
selected Grammar, reachable UX/UI states, representative populated case, adverse/recovery cases,
responsive owners, proof matrix, and explicit exclusions. Existing source and product examples are
evidence; neither is authority by incumbency.

Compile classifies every known gap before continuing:

- a frontend-local decision inside the frozen owner and change level remains in the compiled contract;
- a missing semantic rule, token, component/export, state, or extension axis is a `grammar-gap`, not
  visual ambiguity: emit the exact Grammar-owner repair/publish request and recompile only after the
  new package identity is available; application CSS or copied local anatomy is forbidden;
- missing business, backend, shared-owner, runtime, identity, or other domain authority produces one
  typed cross-domain exit with exact evidence and required continuation;
- when Grammar is complete but no reversible visual direction dominates, continue to `generate` for
  three or four realistic directions and an exact selection;
- unavailable proof produces a typed evidence gap, never an invented fixture or narrated PASS.

An audit-to-target compile may authorize reconstruct inside its frozen direct owner group, but it does
not widen the separately frozen layout ceiling. A render-only contract preserves business behavior
and forbids new API operations, remote mutations, persistence, auth/session behavior, fixtures, or
previously absent product actions.

## Optional `generate`

Run `generate` only for `new` or `reconstruct` when compile did not bind an already approved direction.
When one direction materially dominates, render one realistic Grammar-valid preview and continue.
When the complete Grammar admits several material directions and none dominates—or the owner
explicitly asks to compare—render three or four realistic directions and bind the exact selection.
Any selection pause remains internal to this stage. `refine` and `grammar-gap` never enter `generate`.

The generated contract fixes journey boundaries, semantic block ownership, responsive transformation,
state presentation, product-family signatures, and selected-Grammar bindings needed by `apply`.
Visual artifacts guide implementation but do not become business authority.

## `apply`

Apply the compiled or generated contract through one source writer and the exact frozen write set.
Use public component and Grammar interfaces before local CSS or anatomy overrides. After every write,
compare the actual tracked and untracked changes with the allowed set; an unowned path, forbidden
capability, source-head change, or contract-changing repair is typed boundary drift.

Liveness requires a recent tool event, validated receipt, or owned source change. A badge or narrated
progress is insufficient. A silent writer receives one checkpoint request; a second writer starts
only after an explicit handoff and stable-diff proof. Late overlapping writes stop mutation until the
exact diff is reconciled and one writer is named.

Focused implementation checks are apply evidence only. They cannot replace capture, blind review,
quality, or UAT.

## `capture/preflight`

Use one mission-scoped browser lease over the verified centralized runtime generation. Freeze and
exercise the complete applicable state/viewport/lifecycle/probe matrix from compile. Preflight is
binary: every required readiness cell passes or capture is non-ready. Readiness counts are never a
visual score.

The packet includes a settled, populated happy-case full-page raster with all major regions and the
primary task visible. Empty, loading, skeleton, error, denied, and recovery rasters are additional
state cells and never replace that hero. An absent bounded container is recorded as
`container-not-present`; an applicable state is never simulated away because tooling cannot reach it.

Reuse an authenticated read-only lease only when role, locale, fixture visibility, origin, runtime
generation, and prior-lease release match. Product UAT and state-mutating/reset-sensitive flows use a
fresh run-scoped identity. Never inspect or expose cookies, tokens, passwords, storage, autofill, or
temporary credentials. A cross-task tab interruption changes delivery mode, not proven identity;
broker-executed capture may continue on the same valid lease.

## `blind review`

One fresh-context independent reviewer consumes only the validated raster packet and returns the
typed verdict defined by `fe.ui-render-review`. Source, DOM, tests, measurements, intended answers,
producer rationale, prior findings, and prior scores are withheld until the pixel verdict is frozen.

`PASS` proceeds to final quality. A frontend-local `FAIL` permits exactly one repair cycle:

```text
blind review FAIL
  -> one batched FE-local repair through apply
  -> fresh capture/preflight
  -> one fresh blind review
```

The repair may change only the already compiled owner and contract. It never reopens generation,
widens scope, changes business behavior, or creates another repair loop. A second `FAIL`, repeated
finding fingerprint, boundary drift, missing authority, or non-frontend owner returns a typed terminal
failure or cross-domain exit with exact evidence. `SUSPENSE` is legal only when Grammar is complete,
no contradiction exists, and a finite visual choice remains unresolved; missing Grammar is an exact
owner repair/publish exit, while runtime/evidence unavailability is `BLOCKED`.

## Typed exits and final gates

Cross-domain work exits the frontend machine through one typed handoff naming owner, source/evidence
fingerprints, exact gap, requested product, and safe resume input. Prose, helper names, Control Panel
requests, or a proposed next stage cannot substitute for that exit. A caller may later begin or resume
an explicitly bound mission; this record defines no hidden cross-domain loop.

Quality and UAT run only after the final latest-source blind review is `PASS`. Quality validates the
exact delivered source and gates. Quality `PASS` returns to the caller, which enters UAT; this record
does not invent a Quality repair edge beyond the existing typed Quality contract. UAT then validates
the approved journey and persisted outcome. UAT canonical `PASS` returns to the caller and completes
the machine.

Neither gate repairs frontend source. Fresh UAT counterevidence may return one single-use typed
handoff to the exact frontend mission and `reapply` resume state. The caller validates mission,
invocation, compiled boundary, source/evidence fingerprints, finding owner, and progress fingerprint;
then it invalidates downstream proof and runs the exact path again:

```text
UAT counterevidence RETURN
  -> reapply
  -> recapture/preflight
  -> blind review
  -> quality PASS RETURN
  -> UAT PASS RETURN
```

This explicit resume is not UAT self-repair, does not reopen compilation or direction generation, and
cannot loop without a new canonical UAT run. Replayed/unchanged counterevidence, repeated progress fingerprint, scope drift,
`grammar-gap`, or a non-frontend owner stops with its exact typed exit. No waiver closes the mission;
fresh final PASS remains mandatory.

Completion requires final blind `PASS`, final quality `PASS`, final UAT `PASS`, current source/evidence
fingerprints, and the audited handoff state left visible. Progress updates are not terminals, and no
intermediate baseline, helper result, static check, or numeric score can certify completion.
