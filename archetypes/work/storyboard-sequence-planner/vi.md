# Storyboard sequence planner

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `storyboard-sequence-planner` |
| Family | Work |
| Dominant task | Lập chuỗi kể chuyện trực quan bằng cách sắp xếp shot, giữ continuity và coverage của scene, rồi xử lý beat thiếu hoặc mâu thuẫn trước sản xuất. |
| Search aliases | story sequence, shot continuity, coverage ledger |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `storyboard-planner` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Lập chuỗi kể chuyện trực quan bằng cách sắp xếp shot, giữ continuity và coverage của scene, rồi xử lý beat thiếu hoặc mâu thuẫn trước sản xuất.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-SSP-01` | Lập chuỗi kể chuyện trực quan bằng cách sắp xếp shot, giữ continuity và coverage của scene, rồi xử lý beat thiếu hoặc mâu thuẫn trước sản xuất. | Positive evidence bắt buộc. |
| `AR-SSP-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-SSP-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-SSP-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-SSP-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-SSP-91` | Reject cho multi-track timeline editor, media annotation, generic kanban or asset gallery; ordered narrative beats plus cross-shot continuity/coverage are mandatory | Reject. |
| `AR-SSP-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `storyboard-sequence-planner` khi và chỉ khi `AR-SSP-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-SSP-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
storyboard-planner
├─ sequence-outline
├─ scene-and-beat-navigator
├─ shot-card-board
├─ selected-shot-detail (peer synchronization)
├─ continuity-and-coverage-ledger
├─ alternate-take-or-gap-resolution
└─ sequence-review-export
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `storyboard-planner` | Sở hữu dominant task, complete state và recovery boundary của storyboard-sequence-planner. |
| `sequence-outline` | Sở hữu sequence outline; giữ relationship bắt buộc với upstream `storyboard-planner` and downstream `scene-and-beat-navigator` và không nhận owner từ vùng khác. |
| `scene-and-beat-navigator` | Sở hữu scene and beat navigator; giữ relationship bắt buộc với upstream `sequence-outline` and downstream `shot-card-board` và không nhận owner từ vùng khác. |
| `shot-card-board` | Sở hữu shot card board; giữ relationship bắt buộc với upstream `scene-and-beat-navigator` and downstream `selected-shot-detail` và không nhận owner từ vùng khác. |
| `selected-shot-detail` | Sở hữu selected shot detail; giữ relationship bắt buộc với upstream `shot-card-board` and downstream `continuity-and-coverage-ledger` và không nhận owner từ vùng khác. |
| `continuity-and-coverage-ledger` | Sở hữu continuity and coverage ledger; giữ relationship bắt buộc với upstream `selected-shot-detail` and downstream `alternate-take-or-gap-resolution` và không nhận owner từ vùng khác. |
| `alternate-take-or-gap-resolution` | Sở hữu alternate take or gap resolution; giữ relationship bắt buộc với upstream `continuity-and-coverage-ledger` and downstream `sequence-review-export` và không nhận owner từ vùng khác. |
| `sequence-review-export` | Sở hữu sequence review export; giữ relationship bắt buộc với upstream `alternate-take-or-gap-resolution` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Sequence outline, shot board, selected-shot detail and continuity ledger remain visible together
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Scene/beat navigation becomes a drawer; the active shot board and continuity ledger remain synchronized
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Scene → beat → shot sequence → shot detail → continuity/gap review; reorder has move-before/move-after controls and the board never shrinks into illegible thumbnails
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `storyboard-planner → sequence-outline → scene-and-beat-navigator → shot-card-board → selected-shot-detail → continuity-and-coverage-ledger → alternate-take-or-gap-resolution → sequence-review-export`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm sequence loading, scene empty, shot draft/approved, asset missing, continuity pass/conflict, coverage gap, reorder pending, review stale and export success/failure.

## State obligations

Task-specific states: sequence loading, scene empty, shot draft/approved, asset missing, continuity pass/conflict, coverage gap, reorder pending, review stale and export success/failure.

| State family | Behavior bắt buộc |
|---|---|
| Initial / loading | Name loading scope, reserve primary region và chỉ block failed region. |
| Ready | Expose current object, owner relationship và valid action bằng text/semantics. |
| Empty / not-applicable | Phân biệt true empty, no-match và non-applicable cùng next action thích hợp. |
| Error / retry | Name failed scope, giữ input/work state và đưa focus đến retry/correction target. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và giữ context. |
| Pending | Ngăn duplicate, giữ context, cho Cancel khi an toàn và announce progress. |
| Success | Xác nhận exact changed scope, cập nhật summary liên quan và giữ Undo/next step khi cần. |
| Stale / conflict | So sánh local/external state, không overwrite im lặng và giữ deterministic recovery. |
| Focus transition | User-triggered stage change focus new heading; status-only update không move focus; modal trả trigger. |
| Responsive presentation | Wide giữ simultaneity; intermediate làm support thấp nhất temporary; compact dùng một primary stage với parity. |

## Boundaries

### Accept

- Template must reorder shots without drag, expose a continuity conflict across two shots, resolve a missing coverage beat and preserve the selected scene across topology changes
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho multi-track timeline editor, media annotation, generic kanban or asset gallery; ordered narrative beats plus cross-shot continuity/coverage are mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-SSP-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này resolve dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar bind product-semantic owner vào region/state mà không đổi topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow và content-fit breakpoint.
5. Direction biểu đạt visual character bên trong owner đã accept.

## Non-binding research evidence

### Evidence boundary

Research dưới đây là advisory evidence, không phải product truth. Nó không cho phép copy geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi binding claim vẫn route qua business truth, Grammar và Principles.

### Sources

| Source | Hỗ trợ | Không chứng minh |
|---|---|---|
| [ScreenSkills storyboard artist](https://www.screenskills.com/job-profiles/browse/animation/pre-production/storyboard-artist/) | Cung cấp evidence official về sequence outline. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [BBC Academy five essential shots](https://downloads.bbc.co.uk/academy/collegeofproduction/docs/five_essential_shots_ts.pdf) | Cung cấp evidence official về scene and beat navigator. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Cung cấp evidence official về shot card board. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `storyboard-sequence-planner`. |
| `situationCodes` | Matched code từ record này. |
| `searchAliases` | Routed alias dẫn đến match. |
| `dominantTask` | Một câu task trung lập sản phẩm. |
| `regions` | Ordered required region ID. |
| `regionRelationships` | Owner, peer, supporting, temporary và downstream relationship. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific và common state family. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region/state owner để lại cho Grammar. |
| `principlesHandoff` | Exact geometry, fit threshold và emitted layout để lại cho Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence class không invented fact. |

```json
{"archetypeId":"storyboard-sequence-planner","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
