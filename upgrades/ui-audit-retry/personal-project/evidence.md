# Personal Project reconstruct — pixels-first evidence

## Authority and immutable identity

- Course-page craft benchmark: `C:/Users/Cuong/AppData/Local/Temp/codex-clipboard-2aab4a15-687d-4147-8391-30e27992560d.png`
  - original raster: `2560x1528`
  - SHA-256: `315ba206eed954b8e559be7a0e743328e976a8d5ffd571efbf5053776f0cd749`
- Personal Project output: `C:/Users/Cuong/AppData/Local/Temp/codex-clipboard-ad489817-db73-4202-bb05-dc420df2b176.png`
  - original raster: `2560x1528`
  - SHA-256: `cbe094e51f3898d200964f0391c69409060c239c61062958a1d7793c5ba70cb0`
- Read-only fixture: `C:/Repositories/ac/starci-academy-fe-worktrees/personal-project-reconstruct`
- Git origin: `https://github.com/starci-lab/starci-academy-fe.git`
- Branch/head: `codex/personal-project-reconstruct` / `4e571affa5880440df256dd7894273a06e692493`
- Working-tree changes observed in `CoursePersonalProject` styling/component and its page test. No fixture file was changed by this calibration.

## Direct visual observation before producer rationale

[AI REVIEW][image: personal-project-output]

[FINDING][outcome][PROBLEM] The page is present, but the output is not demonstrated to meet the Course-page craft benchmark. The benchmark has a deliberately composed main/aside relationship, clear information grouping, strong CTA hierarchy, bounded content cards, visual media, and progressive section rhythm. The Personal Project surface reads primarily as a functional dashboard scaffold: a broad next-task card, a long internally scrolling milestone list, and a sparse metrics/repository rail.

[FINDING][hierarchy][PROBLEM] The main task, roadmap, progress, submission evidence, and repository state do not form a strong decision hierarchy. The long milestone list dominates the viewport while the right rail has low information density and weak visual balance.

[FINDING][composition][PROBLEM] The benchmark's main column and supporting panel reinforce one outcome. Here, the sidebar, main list, and secondary rail compete as three separate frames; the large list viewport and sparse right rail create an uneven composition.

[FINDING][craft][PROBLEM] No supplied evidence demonstrates comparable editorial detail, meaningful visual support, state richness, or responsive refinement. Exact spacing, contrast, typography, and responsive measurements are unavailable because no measurement receipt or additional viewport rasters were supplied.

[FINDING][behavior][PROBLEM] The screenshot does not prove milestone search, continuation, repository recovery, or list navigation behavior. Behavior must remain unavailable rather than inferred from static pixels.

[FINDING][stability][PROBLEM] Only one immutable output raster is available. There are zero proven consecutive passes against the unchanged acceptance contract; the required count is two.

[VERDICT] BLOCKED

## Accountable causal record

- Earlier apparent decision: implementation changes and a page test were treated as sufficient evidence that the reconstruct output was ready.
- Why that could appear valid: the requested surface renders, major regions exist, and code/test changes are present in the fixture.
- Contradiction: direct output comparison shows the surface is functionally organized but does not demonstrate the Course benchmark's craft, composition, or proof depth.
- Missing check: no pixels-first acceptance gate tied the terminal verdict to benchmark-level UI quality, and no second fresh visual pass established repeatability.

## Evidence gaps preserved as unavailable

- Producer prompt and normalized input receipt: unavailable.
- Original state-machine execution trace and operator receipts: unavailable.
- Independent visual-review receipt: unavailable.
- Measured spacing, typography, contrast, overflow, and responsive values: unavailable.
- Baseline elapsed time, time to first action, step count, redundant step count, and context bytes: unavailable.
- Fresh second output for stability: unavailable.

Wrong output plus missing stability proof is terminally `BLOCKED`; procedural completion cannot override it.
