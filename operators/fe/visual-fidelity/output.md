# `fe/visual-fidelity` output

- `output.outcome`: Legacy semantic result consumed only by the Skill machine.
- `output.result`: The atomic job result, or null when blocked.
- `output.result.matrixFingerprint`, `partitionFingerprint`, and `visualRound`: Exact preflight/capture identity reviewed by Sol.
- `output.result.inspectionRecords`: One blind pixel observation record per screenshot, covering purpose/semantic utility, content coherence, inset, surfaces, padding on every edge, alignment, rhythm, hierarchy, visual ownership, pinned-boundary clearance, affordance, wrapping, responsive composition, visual consistency, empty-space balance, clipping, and occlusion.
- `output.result.reviewMode`: Always `ai-adversarial-pixel`; confirmation-oriented or measurement-led review is invalid.
- `output.result.productFamilyEvidence`: Exact opaque Grammar identity and benchmark raster set used
  for the `product-family-quality` lens, copied unchanged from the blind packet.
- `output.result.packetFingerprint`: Exact raster-only packet reviewed.
- `output.result.reviewerExecutionRef`, `reviewerModel`, `reviewerCount`, `contextIsolation`, and `forkTurns`: Provenance for the single fresh Sol reviewer.
- `output.result.lastScreenshotRef` and `lastScreenshotVerdict`: The final post-mutation raster and its controlling verdict.
- `output.result.uncertainty`: Any uncertainty forbids `passed` and returns repair or blocked.
- `output.result.inspectionRecords[].lensVerdicts`: One concrete AI pixel verdict for every required lens; any `problem` forces repair.
- `output.result.inspectionRecords[].challengeRecords`: Potential defects deliberately attacked in all purpose/content, composition/spacing, and interaction/responsive families; any confirmed candidate forces repair.
- `output.result.probeRecords`: Exactly one falsification verdict per requested adversarial probe and lifecycle phase, preserving the attempted attack, raster reference or exact inapplicability reason, and observed contradiction. Counts alone never satisfy this contract.
- `output.gaps`: Exact missing authority or evidence; empty when complete.
- `output.evidenceRefs`: Exact evidence used to produce the result.

With `debug=true`, serialize every inspection record to the terminal as `[AI REVIEW][image: <ref>]`, concrete `[FINDING][<lens>][<status>] <visible observation>` lines for passed and failed lenses/challenges, and one `[VERDICT]` line. Findings such as touching edges, oversized empty cards, wasteful rails, clipping, or nested scroll must be inspection records rather than omitted commentary. Structured debug output never contains hidden reasoning or secrets.
