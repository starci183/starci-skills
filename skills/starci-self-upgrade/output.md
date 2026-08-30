# `starci-self-upgrade` output

The terminal result names source heads, immutable evidence, benchmark policy, measured or unavailable
efficiency metrics, every required layer check, ordered output attempts and fingerprints, consecutive
pass count, the causal failure record, smallest owner refs, exactly one ADD/CHANGE/REMOVE disposition
each, and produced upgrade artifacts.

`complete` or `not-needed` requires two fresh consecutive correct outputs and no missing layer proof.
An incorrect final output, a single pass, repeated fingerprint, or missing required layer is invalid.

Multi-task output additionally records every actor result, one cross-case decision, and the runtime
fingerprint transition/notification/resume receipts. Consecutive passes are counted per actor; they
must never be assembled from different actors. Successful completion requires every required actor to
pass under one final runtime fingerprint.
Calibration always reports `changeSetApplied=false`; a completed upgrade reports `true`.
