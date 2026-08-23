# Editorial rundown control board

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `editorial-rundown-control-board` |
| Family | Overview |
| Dominant task | Vận hành live editorial rundown bằng sequence segment, xác nhận readiness, phát cue, ghi actual timing và thích nghi phần chương trình còn lại mà không mất editorial intent. |
| Search aliases | live rundown, cue control, as-run log |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `rundown-control` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Vận hành live editorial rundown bằng sequence segment, xác nhận readiness, phát cue, ghi actual timing và thích nghi phần chương trình còn lại mà không mất editorial intent.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-ERB-01` | Vận hành live editorial rundown bằng sequence segment, xác nhận readiness, phát cue, ghi actual timing và thích nghi phần chương trình còn lại mà không mất editorial intent. | Positive evidence bắt buộc. |
| `AR-ERB-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-ERB-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-ERB-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-ERB-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-ERB-91` | Reject cho timeline monitor, generic queue, meeting agenda or video player; live cue issuance, role readiness, current-next ownership and as-run reconciliation are mandatory | Reject. |
| `AR-ERB-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `editorial-rundown-control-board` khi và chỉ khi `AR-ERB-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-ERB-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
rundown-control
├─ program-clock-and-live-state
├─ segment-rundown
├─ current-next-on-deck
├─ selected-segment-cues-and-assets
├─ role-readiness-matrix
├─ actual-versus-planned-time
├─ hold-skip-reorder-controls
└─ as-run-log
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `rundown-control` | Sở hữu dominant task, complete state và recovery boundary của editorial-rundown-control-board. |
| `program-clock-and-live-state` | Sở hữu program clock and live state; giữ relationship bắt buộc với upstream `rundown-control` and downstream `segment-rundown` và không nhận owner từ vùng khác. |
| `segment-rundown` | Sở hữu segment rundown; giữ relationship bắt buộc với upstream `program-clock-and-live-state` and downstream `current-next-on-deck` và không nhận owner từ vùng khác. |
| `current-next-on-deck` | Sở hữu current next on deck; giữ relationship bắt buộc với upstream `segment-rundown` and downstream `selected-segment-cues-and-assets` và không nhận owner từ vùng khác. |
| `selected-segment-cues-and-assets` | Sở hữu selected segment cues and assets; giữ relationship bắt buộc với upstream `current-next-on-deck` and downstream `role-readiness-matrix` và không nhận owner từ vùng khác. |
| `role-readiness-matrix` | Sở hữu role readiness matrix; giữ relationship bắt buộc với upstream `selected-segment-cues-and-assets` and downstream `actual-versus-planned-time` và không nhận owner từ vùng khác. |
| `actual-versus-planned-time` | Sở hữu actual versus planned time; giữ relationship bắt buộc với upstream `role-readiness-matrix` and downstream `hold-skip-reorder-controls` và không nhận owner từ vùng khác. |
| `hold-skip-reorder-controls` | Sở hữu hold skip reorder controls; giữ relationship bắt buộc với upstream `actual-versus-planned-time` and downstream `as-run-log` và không nhận owner từ vùng khác. |
| `as-run-log` | Sở hữu as run log; giữ relationship bắt buộc với upstream `hold-skip-reorder-controls` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Rundown, current/next stage, readiness rail and program clock/as-run status remain visible
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Current and next segments own the main view; full rundown becomes a drawer and readiness moves below
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Now → next → cue/confirm → record outcome → advance; complete rundown and as-run history are secondary routes, with no compressed timeline dependency
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `rundown-control → program-clock-and-live-state → segment-rundown → current-next-on-deck → selected-segment-cues-and-assets → role-readiness-matrix → actual-versus-planned-time → hold-skip-reorder-controls → as-run-log`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm off-air/rehearsal/live/paused, segment ready/blocked/skipped, asset missing, role unconfirmed, cue pending/acknowledged, over/under time, rundown changed and as-run logging failure.

## State obligations

Task-specific states: off-air/rehearsal/live/paused, segment ready/blocked/skipped, asset missing, role unconfirmed, cue pending/acknowledged, over/under time, rundown changed and as-run logging failure.

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

- Template must cue the current segment, acknowledge a role, handle a blocked next segment, update planned versus actual time and preserve the live state when the rundown drawer opens
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho timeline monitor, generic queue, meeting agenda or video player; live cue issuance, role readiness, current-next ownership and as-run reconciliation are mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-ERB-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [BBC editorial guidelines](https://www.bbc.com/editorialguidelines/) | Cung cấp evidence official về program clock and live state. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [EBU production technology](https://tech.ebu.ch/) | Cung cấp evidence official về segment rundown. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `editorial-rundown-control-board`. |
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
{"archetypeId":"editorial-rundown-control-board","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
