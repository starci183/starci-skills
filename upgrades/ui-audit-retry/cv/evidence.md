# CV new — pixels-first evidence

## Authority and immutable identity

- Course-page craft benchmark: `C:/Users/Cuong/AppData/Local/Temp/codex-clipboard-2aab4a15-687d-4147-8391-30e27992560d.png`
  - original raster: `2560x1528`
  - SHA-256: `315ba206eed954b8e559be7a0e743328e976a8d5ffd571efbf5053776f0cd749`
- CV output: `C:/Users/Cuong/AppData/Local/Temp/codex-clipboard-c8bf4b95-18ba-4629-9473-deaf124bf1bd.png`
  - original raster: `2560x1528`
  - SHA-256: `4d7baaeb710379e1a88def23c68805c0500d333f63c05b6d28cd66c85dd093a2`
- Read-only fixture: `C:/Repositories/ac/starci-academy-fe-worktrees/cv-new`
- Git origin: `https://github.com/starci-lab/starci-academy-fe.git`
- Branch/head: `codex/cv-new` / `4e571affa5880440df256dd7894273a06e692493`
- Working-tree changes observed in `ProfilePublicCv`, `ProfileCvDocument`, page test, and locale messages. A pre-existing `.artifacts/cv-new/` directory is part of the fixture. No fixture file was changed by this calibration.

## Direct visual observation before producer rationale

[AI REVIEW][image: cv-output]

[FINDING][outcome][PROBLEM] The core requested output is absent. Under `CV công khai`, the page shows `The public CV couldn't be loaded.` and a retry button instead of a CV.

[FINDING][state][PROBLEM] An error/recovery state may be useful as one supported case, but it cannot satisfy a `new CV` outcome. The screenshot proves recovery UI, not the intended CV content.

[FINDING][localization][PROBLEM] The surrounding page is Vietnamese while the core error message is English, producing a visible language inconsistency.

[FINDING][composition][PROBLEM] The profile header has structure, but the primary content area collapses into a small error cluster and a very large empty canvas. The benchmark's bounded information groups, intentional density, section rhythm, and supporting visual hierarchy are absent from the outcome region.

[FINDING][behavior][PROBLEM] Retry success, loaded CV content, share/edit consequences, and responsive CV behavior are unproved. Exact measurements are unavailable because no loaded-output raster or interaction receipt was supplied.

[FINDING][stability][PROBLEM] There are zero correct passes. A stability attempt cannot begin from an incorrect baseline.

[VERDICT] BLOCKED

## Accountable causal record

- Earlier apparent decision: the new CV work could be treated as delivered because profile/CV components, locale strings, tests, and a recovery surface were implemented.
- Why that could appear valid: the route renders, profile chrome is composed, and the core area handles an error case with retry.
- Contradiction: the direct user-visible output contains no CV; it is an error state with a language mismatch and an empty outcome region.
- Missing check: validation did not assert that the primary CV payload was visibly present before success, and proof did not require loaded, recovery, responsive, and repeated output evidence.

## Evidence gaps preserved as unavailable

- Loaded CV output raster: unavailable.
- Successful retry interaction receipt: unavailable.
- Producer prompt, normalized input, transition trace, and operator receipts: unavailable.
- Independent visual-review receipt: unavailable.
- Measured spacing, typography, contrast, overflow, document paging, and responsive values: unavailable.
- Baseline elapsed time, time to first action, step count, redundant step count, and context bytes: unavailable.
- Any correct pass, including a second fresh stability pass: unavailable.

An error state is not a correct `new CV` output. Verdict remains `BLOCKED` regardless of procedural progress.
