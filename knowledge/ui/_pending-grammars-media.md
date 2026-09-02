> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> mechanics, not an application decision. It has no successor under composition, presentation, or
> proof. Do not load it as runtime authority.

# Media

`ui.media` owns reusable media jobs, frame ratios, fit, treatment, crop integrity, accessible intent,
fallback geometry, and provenance proof. Classify findings with the
[canonical verdict model](INDEX.md#canonical-verdict-model). Keep approved source/provenance,
intrinsic dimensions, Common props, computed frame/fit, visible crop, and accessibility output as
separate evidence. Common owns `MediaFrame` anatomy and metrics; a family may change paint but not
those contracts. The application owns the user job, approved asset and rights, factual content,
alt/caption words, page canvas, and placement. Asset generation decisions remain in the feature workflow.

## MEDIA-1 — Choose one explicit user job

### When

A region proposes a photograph, illustration, diagram, video, provider mark, or generated bitmap.
An asset that only fills space or follows a visual trend does not qualify.

### Apply

- Name one user job before choosing media: orientation, recognition, comparison, instruction, or approved identity.
- Present the selected asset through Common `MediaFrame`; choose its real `aspect`, `fit`, and `treatment` from that job.
- Prove the job, approved source/rights, one dominant region anchor, and visible result at all material viewports.
- Families may repaint the frame; applications may choose/position the approved asset but must not create a parallel reusable frame.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A central crop-safe photograph orients learners to a course topic. | `PASS` | The asset has one clear job and an owned Common frame. |
| A stock image is added only to fill an empty card. | `APP_REIMPLEMENTATION` · `WRONG_OWNER` | Remove filler media; improve the content/composition instead. |
| A decorative hero competes with the page's primary decision. | `APP_OVERRIDE` · `VALUE_DRIFT` | Remove or demote media so one dominant anchor remains. |
| The approved asset already performs the exact job. | `PASS` | Reuse it; novelty is not a reason to generate replacement art. |

## MEDIA-2 — Aspect and crop preserve the subject

### When

Approved raster or video content may be cropped without losing a declared focal subject or any
must-preserve region. Edge-to-edge diagrams and marks select contain instead.

### Apply

- Use actual Common aspects: `landscape` 16:10, `portrait` 4:5, `square` 1:1, or `auto`; use `fit="cover"` only for crop-safe content.
- Require `visible_fraction = 1.0` for every must-preserve region at narrow, intermediate, and wide widths; never stretch intrinsic ratio.
- Prove intrinsic/rendered dimensions, computed aspect/`object-fit`, crop rectangle, focal point, and each visible fraction separately.
- `MediaFrame` has no focal-point/object-position prop; a required non-default crop is a Common capability gap, not app descendant CSS.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A centered subject remains fully visible in a 16:10 `cover` frame at all three widths. | `PASS` | Every declared region has visible fraction 1.0. |
| A portrait crop removes part of the person's face on compact width. | `PROOF_MISSING` · `STATE_OR_VIEWPORT_DRIFT` | Change asset/fit or add the missing Common crop capability, then recapture all widths. |
| A required focal point is off-center and cannot be expressed by `MediaFrame`. | `COMMON_CAPABILITY_MISSING` | Common needs a typed focal-position contract before using cover. |
| App CSS adds `object-position` to a `MediaFrame` child. | `APP_OVERRIDE` · `WRONG_OWNER` | Remove the reach-through and resolve the Common gap. |

## MEDIA-3 — Diagrams and marks use contain

### When

Every edge, label, symbol, code line, instruction step, or approved mark contour carries meaning.
Crop-safe atmospheric imagery is excluded.

### Apply

- Use Common `MediaFrame fit="contain"`; use `treatment="framed"` for an independent region and `plain` when surrounding material already owns the edge.
- Preserve intrinsic aspect; provider/brand marks use the approved asset rather than a generated approximation.
- Prove the entire meaningful graphic is visible, embedded text has an accessible real-text equivalent, and there is exactly one material boundary.
- Families may repaint the frame; applications own the approved source, accessible explanation, and placement, not local fit/border recipes.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A routing diagram uses `contain`; every node and label remains visible. | `PASS` | No meaningful pixel is cropped. |
| A provider SVG is stretched to fill a square. | `APP_OVERRIDE` · `VALUE_DRIFT` | Restore the approved intrinsic ratio and `contain`. |
| A diagram's only explanation is tiny text inside the bitmap. | `PROOF_MISSING` | Add real text or a complete accessible alternative. |
| A framed diagram inside an already bounded surface draws a second box. | `APP_OVERRIDE` · `DOUBLE_OWNER` | Use `treatment="plain"` or remove the surrounding duplicate boundary. |

## MEDIA-4 — Accessibility intent and caption are explicit

### When

Media is informative, decorative, or duplicates information already stated nearby. Filename,
generation prompt, and visual style do not determine accessible intent.

### Apply

- Informative media children provide an alternative that conveys the declared job and relevant meaning; decorative media uses an empty alternative and stays silent.
- Use Common `MediaFrame caption` for visible context, credit, or instruction; do not repeat the same identity in alt, caption, and nearby heading.
- Prove the figure/figcaption relationship, exact accessibility-tree name/description, and equivalent task information with images unavailable.
- Families may replace the renderer compatibly but preserve the same result; applications own concise alt/caption content.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| An informative topology image has concise alt; its caption adds source context. | `PASS` | Alternative and caption have different useful jobs. |
| A decorative flourish is announced as “purple abstract background”. | `APP_OVERRIDE` · `WRONG_OWNER` | Use an empty alternative so decoration stays silent. |
| Alt, caption, and heading repeat the same course title. | `APP_OVERRIDE` · `DOUBLE_OWNER` | Keep one identity and make the other text add distinct context. |
| Removing the image also removes an instruction available nowhere else. | `PROOF_MISSING` | Provide an equivalent accessible instruction before pass. |

## MEDIA-5 — Loading and failure preserve the task

### When

A source is slow, missing, denied, unavailable, or fails decoding. A deliberately omitted optional
asset is absence, not a media loading/error state.

### Apply

- Preserve the selected frame's aspect, fit, treatment, owner, and caption across loading, success, and failure.
- Require an honest Common-owned loading/error representation with stable geometry and a useful text or approved fallback.
- Prove equal outer frame dimensions, explicit state text, silent loading decoration, no broken asset, and no fabricated replacement claim.
- `MediaFrame` currently has no loading/error prop or state renderer; classify this requirement as a Common capability gap and forbid app-local frame/CSS workarounds.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A network diagram needs a reserved loading and decode-failure state. | `COMMON_CAPABILITY_MISSING` | Common cannot represent those states yet; add the typed capability. |
| App overlays a local skeleton inside `MediaFrame`. | `APP_WORKAROUND` · `WRONG_OWNER` | Remove the parallel state anatomy and resolve the Common gap. |
| A failed image collapses from 16:10 to zero height. | `APP_OVERRIDE` · `STATE_OR_VIEWPORT_DRIFT` | Failure must keep the task's frame geometry. |
| Failure swaps in unrelated attractive artwork. | `APP_REIMPLEMENTATION` · `VALUE_DRIFT` | Use honest text or an approved factual fallback, never invented meaning. |

## MEDIA-6 — Provenance and generated-media truth

### When

Media is reused, licensed, captured, supplied by a provider, or generated. Common presentation alone
does not prove that source selection was authorized or accurate.

### Apply

- Before render, retain source, rights/provenance, selection or generation decision, intrinsic dimensions, focal point, and must-preserve regions with feature evidence.
- For generated assets, retain the brief and forbidden claims; never fabricate product UI, results, endorsements, status, authorization, brand identity, or readable pseudo-interface text.
- Prove the approved asset hash/reference matches the rendered source and that crop/accessibility evidence belongs to the same revision.
- Common `MediaFrame` only presents the approved outcome; families and applications do not trigger, evaluate, or claim generation through it.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A licensed illustration has rights record, intrinsic size, and matching rendered source. | `PASS` | Provenance and render refer to the same approved asset. |
| Generated art shows a fictional “100% secure” product result. | `APP_OVERRIDE` · `VALUE_DRIFT` | Remove the invented claim and regenerate from an approved truthful brief. |
| A provider logo is approximated by generated pixels. | `APP_REIMPLEMENTATION` · `WRONG_OWNER` | Use the approved provider asset and preserve its identity. |
| The image looks correct but source and rights evidence are absent. | `PROOF_MISSING` | Visual quality cannot establish authorization; attach provenance before pass. |
| `MediaFrame` presence is cited as proof that generation was approved. | `PROOF_MISSING` | The component is presentation only; provide the feature-workflow decision evidence. |
