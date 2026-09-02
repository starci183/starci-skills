> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> anatomy, not an application decision. Its SURFACE-n and BOUNDARY-n identifiers are superseded by
> knowledge/ui/presentation/, which now owns those prefixes for app-owned token selection. Do not
> load this file as runtime authority.
# Boundary

`ui.boundary` decides which reusable owner draws, names, clips, separates, or elevates a region.
Classify findings with the [canonical verdict model](INDEX.md#canonical-verdict-model). Common owns
boundary anatomy, metrics, semantics, focus/state behavior, and clipping; a family may change scoped
paint only. The application owns business content, page canvas, product media, and legitimate placement.

## BOUNDARY-1 — One reusable boundary owner

### When

Content needs a visible region box, semantic grouping, or peer separator. A page background or
application-owned media canvas is not automatically a reusable component boundary.

### Apply

- Choose an existing Common owner such as `SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard`, or `Divider`.
- Let that owner emit the complete box or separator; do not add a second app border, radius, background, or shadow.
- Prove one semantic region owner and one painted edge at every side from computed styles and final pixels.
- Families may repaint emitted anchors; applications may place the complete owner without reaching through it.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| Account content sits in one bounded Common `SurfaceCard`. | `PASS` | One component owns semantics and the complete edge. |
| An app wraps `SurfaceCard` in another rounded bordered card. | `APP_REIMPLEMENTATION` · `DOUBLE_OWNER` | Two shells claim one region; remove the app wrapper. |
| A family paints an extra pseudo-element border outside the Common anchor. | `FAMILY_OVERRIDE_GLITCH` · `DOUBLE_OWNER` | Bind paint to the published owner instead of creating a second edge. |

## BOUNDARY-2 — Nesting and seams

### When

A bounded region contains a genuinely different nested job or several touching child bands. Visual
decoration alone does not justify another surface.

### Apply

- Use Common `SurfaceCard depth="top|nested"`, `frame="bounded|frameless"`, and `composition="single|joined"` for their actual relationships.
- Give each seam exactly one owner; joined children may own separators while the outer surface owns clipping.
- Prove distinct semantic jobs, one outer edge, one separator per seam, and no doubled inset in computed geometry.
- Families repaint the same anchors; applications compose content through props and public placement, not descendant CSS.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A joined plan surface contains touching detail and action bands with one separator. | `PASS` | Outer clipping and inner seam have separate owners. |
| A nested card repeats the parent's job only to add shadow. | `APP_REIMPLEMENTATION` · `DOUBLE_OWNER` | Remove ornamental nesting; one job needs one boundary. |
| Parent and first child both draw the same top seam. | `COMMON_IMPLEMENTATION_GLITCH` · `DOUBLE_OWNER` | Repair the reusable joined anatomy so one side owns the line. |

## BOUNDARY-3 — Labelled alternatives and dividers

### When

A boundary names a region or separates peer alternatives. A decorative line with no relationship
does not select a semantic divider.

### Apply

- Keep a surface label inside its Common component/accessibility relationship; use Common `Divider label` only between real peer alternatives.
- Require the divider's visible localized label and separator name to describe what lies on both sides.
- Prove `aria-labelledby`/`aria-label`, visible label text, separator role, and adjacency in the accessibility tree.
- Families may paint the line and label; applications supply the region or alternative wording without moving label ownership outside Common.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| “Or continue with” separates password and provider sign-in paths. | `PASS` | The Common divider names two genuine alternatives. |
| A divider is inserted only to fill empty space. | `APP_REIMPLEMENTATION` · `WRONG_OWNER` | Remove decoration or use a real layout relationship. |
| A visible surface title sits outside the component that it names. | `APP_WORKAROUND` · `WRONG_OWNER` | Restore the Common label relationship or add the missing Common capability. |

## BOUNDARY-4 — Elevation follows occlusion

### When

One layer temporarily covers another and needs an interaction-owned stacking relationship. Stronger
emphasis on ordinary in-flow content is not sufficient.

### Apply

- Keep placement, stacking, focus/dismissal behavior, and elevation with the same Common overlay owner.
- Common `Tooltip` owns its annotation placement; there is no general reusable overlay-elevation prop for arbitrary content.
- Prove actual occlusion, stacking order, focus path, dismissal path, and final shadow/outline pixels; a shadow alone is not proof.
- Families may repaint an existing overlay; applications must record a Common capability gap rather than add arbitrary z-index/shadow recipes.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A Common `Tooltip` appears above its trigger and disappears with its owner. | `PASS` | Placement and occluding annotation share one reusable owner. |
| A product needs a generic elevated overlay not represented in Common. | `COMMON_CAPABILITY_MISSING` | Add a reusable overlay contract before product styling. |
| A normal card receives a large shadow only to look important. | `APP_OVERRIDE` · `WRONG_OWNER` | Elevation is not hierarchy; restore the surface treatment. |

## BOUNDARY-5 — State, clipping, and responsive flattening

### When

A boundary loads, becomes unavailable/selected, contains focus or overflow, or visually flattens at
a responsive composition. A hidden decorative edge with unchanged ownership is not flattening.

### Apply

- Keep the same Common region owner across states; bounded surfaces own clipping and frameless surfaces intentionally expose overflow.
- Preserve focus visibility, required content, controls, and one scroll owner when paint or layout changes.
- Test overflow, focus outline, loading/outcome transitions, narrow/intermediate/wide widths, and 200% zoom; compare owner and edge counts.
- Families may remove or change paint only when ownership and metrics persist; applications may recompose placement without stranding content.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A bounded surface keeps its owner and clips media while its internal focus ring remains visible. | `PASS` | Clipping is intentional and does not hide interaction evidence. |
| Mobile CSS removes the only boundary and leaves controls visually attached to the next region. | `APP_OVERRIDE` · `STATE_OR_VIEWPORT_DRIFT` | Flattening erased ownership; keep a structural cue or valid Common surface. |
| A selected-state outline is cut off by the Common frame. | `COMMON_IMPLEMENTATION_GLITCH` | Repair focus/selection placement inside the clipping owner. |
