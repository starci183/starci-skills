# Execute `fe/visual-fidelity`

Review one frozen raster-only packet with exactly one fresh `gpt-5.6-sol` execution. Do not inspect
source, DOM, tests, measurements, producer rationale, intended answers, or previous verdicts. Do not
repair source, recapture evidence, or choose another operator. Try to falsify the visible outcome;
never confirm the producer's intended answer.

Before inspection, bind the capture receipt, packet/matrix/partition fingerprints, latest-source
freshness, isolated reviewer identity, exact raster order, and all 22 canonical probe phases. The
packet must include uncropped host context, focused surface views, and wide/intermediate/compact
coverage. A populated settled happy-case hero with representative data, the core task, and major
regions visible is mandatory; loading, skeleton, empty, error, or recovery rasters only supplement it.

If reviewer authority or runtime is unavailable before inspection, return `blocked`. If review ran but
the packet cannot support a conclusion—including a missing populated hero, adjacent lifecycle raster,
or raster/probe parity—return `insufficient-evidence` with `result: null`, non-empty evidence, and exact
recapture gaps. Never turn incomplete evidence into PASS or a numeric score.

Inspect every packet raster once and in packet order. Emit all 20 lens verdicts and all three challenge
families for each raster. Emit one probe verdict for every canonical probe in canonical order: a
`survived` or `contradiction` record retains its exact packet raster ref; `not-applicable` retains a
null image ref and the observed non-applicability. Extra, missing, reordered, or substituted raster
and probe refs invalidate closure.

Emit the separately validated Grammar audit reference/fingerprint bound to the exact decision,
iconography, media, and proof-matrix identities. Return `repair` for any visible problem, failed
Grammar audit, confirmed challenge, probe contradiction, uncertainty, or
non-passing final screenshot. Return `passed` only over the complete latest-source packet with score
at least 9, no retained gaps, no problem or contradiction, `uncertainty=false`, and the one final
post-mutation screenshot passed. The score reports progress; it never overrides the typed verdict.

With `debug=true`, emit normalized call/return provenance, one `[AI REVIEW][image: <ref>]` block per
raster, concrete finding lines, and one final verdict. Return only this typed review receipt; the
parent Skill owns repair recurrence and quality/UAT closure.
