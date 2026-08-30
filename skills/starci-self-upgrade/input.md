# `starci-self-upgrade` input

Provide one frozen runtime mission scope, exact benchmark/acceptance and fixture references, the
requested `calibrate|upgrade` intent, every diagnostic layer required by the case, metrics, and the
stability policy. Two fresh consecutive passes are mandatory; repair attempts are capped at three and
must stop on a repeated fingerprint.

For `observationMode=multi-task`, also provide two or three actor specifications and a supervision
policy. Each actor binds one independent Codex task, action, product scope/write root, expected Skill,
and separate product-mutation authority. Two actors are primary; a third is a user-requested fixture
or an evidence-backed discriminator, never a default token-expansion step.

Calibration write roots may name only `.claude/upgrades/`; upgrade roots may name only explicitly
approved `.claude` owners. Product source is never an implicit write root. Grammar and UI are required
for UI-output cases and explicitly `not-applicable` with evidence for cases they do not own.
