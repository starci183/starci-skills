# Multi rendition creative adaptation workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `multi-rendition-creative-adaptation-workbench` |
| Family | Work |
| Dominant task | Adapt một creative master đã duyệt thành nhiều rendition target trong khi giữ message hierarchy, asset lineage, safe area và override rõ theo từng target. |
| Search aliases | creative rendition, master adaptation, safe-area override |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `adaptation-workbench` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Adapt một creative master đã duyệt thành nhiều rendition target trong khi giữ message hierarchy, asset lineage, safe area và override rõ theo từng target.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-MCA-01` | Adapt một creative master đã duyệt thành nhiều rendition target trong khi giữ message hierarchy, asset lineage, safe area và override rõ theo từng target. | Positive evidence bắt buộc. |
| `AR-MCA-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-MCA-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-MCA-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-MCA-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-MCA-91` | Reject cho localization workbench, canvas inspector, responsive page preview or asset gallery; one-to-many master propagation with target-specific safe-area and override provenance is mandatory | Reject. |
| `AR-MCA-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `multi-rendition-creative-adaptation-workbench` khi và chỉ khi `AR-MCA-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-MCA-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
adaptation-workbench
├─ master-creative-and-message-rules
├─ target-rendition-matrix
├─ selected-rendition-stage
├─ crop-layout-content-overrides (peer synchronization)
├─ cross-rendition-consistency-ledger
└─ approval-and-export-manifest
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `adaptation-workbench` | Sở hữu dominant task, complete state và recovery boundary của multi-rendition-creative-adaptation-workbench. |
| `master-creative-and-message-rules` | Sở hữu master creative and message rules; giữ relationship bắt buộc với upstream `adaptation-workbench` and downstream `target-rendition-matrix` và không nhận owner từ vùng khác. |
| `target-rendition-matrix` | Sở hữu target rendition matrix; giữ relationship bắt buộc với upstream `master-creative-and-message-rules` and downstream `selected-rendition-stage` và không nhận owner từ vùng khác. |
| `selected-rendition-stage` | Sở hữu selected rendition stage; giữ relationship bắt buộc với upstream `target-rendition-matrix` and downstream `crop-layout-content-overrides` và không nhận owner từ vùng khác. |
| `crop-layout-content-overrides` | Sở hữu crop layout content overrides; giữ relationship bắt buộc với upstream `selected-rendition-stage` and downstream `cross-rendition-consistency-ledger` và không nhận owner từ vùng khác. |
| `cross-rendition-consistency-ledger` | Sở hữu cross rendition consistency ledger; giữ relationship bắt buộc với upstream `crop-layout-content-overrides` and downstream `approval-and-export-manifest` và không nhận owner từ vùng khác. |
| `approval-and-export-manifest` | Sở hữu approval and export manifest; giữ relationship bắt buộc với upstream `cross-rendition-consistency-ledger` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Master, rendition matrix, selected stage and consistency ledger remain concurrently visible
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Master becomes a comparison drawer; selected rendition and override/consistency regions remain primary
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Target selector → inherited master rules → rendition stage → explicit overrides → cross-target warnings → approval/export; target previews become a list, not a miniature wall
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `adaptation-workbench → master-creative-and-message-rules → target-rendition-matrix → selected-rendition-stage → crop-layout-content-overrides → cross-rendition-consistency-ledger → approval-and-export-manifest`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm master loading/locked, target missing, inherited/overridden, crop unsafe, copy overflow, asset unavailable, consistency warning, approval pending/rejected and export partial/complete.

## State obligations

Task-specific states: master loading/locked, target missing, inherited/overridden, crop unsafe, copy overflow, asset unavailable, consistency warning, approval pending/rejected and export partial/complete.

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

- Template must switch among target renditions, show inherited versus overridden properties, detect an unsafe crop and prove that a master change propagates without erasing an approved override
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho localization workbench, canvas inspector, responsive page preview or asset gallery; one-to-many master propagation with target-specific safe-area and override provenance is mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-MCA-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Google Ads specifications](https://support.google.com/google-ads/answer/13676244?hl=en) | Cung cấp evidence official về master creative and message rules. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [Meta ad aspect ratios](https://www.facebook.com/business/help/103816146375741) | Cung cấp evidence official về target rendition matrix. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C image alternatives](https://www.w3.org/WAI/tutorials/images/) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `multi-rendition-creative-adaptation-workbench`. |
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
{"archetypeId":"multi-rendition-creative-adaptation-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
