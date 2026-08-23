# Chart specification authoring studio

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `chart-specification-authoring-studio` |
| Family | Work |
| Dominant task | Author chart specification bằng cách map field vào visual encoding, cấu hình scale và annotation, validate kết quả, đồng thời duy trì data explanation tương đương và accessible. |
| Search aliases | chart authoring, visual encoding, accessible chart spec |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `chart-studio` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Author chart specification bằng cách map field vào visual encoding, cấu hình scale và annotation, validate kết quả, đồng thời duy trì data explanation tương đương và accessible.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-CSA-01` | Author chart specification bằng cách map field vào visual encoding, cấu hình scale và annotation, validate kết quả, đồng thời duy trì data explanation tương đương và accessible. | Positive evidence bắt buộc. |
| `AR-CSA-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-CSA-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-CSA-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-CSA-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-CSA-91` | Reject cho query builder, palette/token editor, pivot table, dashboard composition, generic code playground or chart viewer; semantic data fields must be bound to visual channels/transforms/scales and compile into both a chart and equivalent table/narrative—database retrieval and color selection are not the dominant task | Reject. |
| `AR-CSA-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `chart-specification-authoring-studio` khi và chỉ khi `AR-CSA-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-CSA-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
chart-studio
├─ data-field-schema
├─ mark-and-encoding-specification
├─ live-chart-preview (peer synchronization)
├─ scale-legend-annotation-inspector
├─ validation-ledger
├─ accessible-table-and-narrative
└─ publish-export
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `chart-studio` | Sở hữu dominant task, complete state và recovery boundary của chart-specification-authoring-studio. |
| `data-field-schema` | Sở hữu data field schema; giữ relationship bắt buộc với upstream `chart-studio` and downstream `mark-and-encoding-specification` và không nhận owner từ vùng khác. |
| `mark-and-encoding-specification` | Sở hữu mark and encoding specification; giữ relationship bắt buộc với upstream `data-field-schema` and downstream `live-chart-preview` và không nhận owner từ vùng khác. |
| `live-chart-preview` | Sở hữu live chart preview; giữ relationship bắt buộc với upstream `mark-and-encoding-specification` and downstream `scale-legend-annotation-inspector` và không nhận owner từ vùng khác. |
| `scale-legend-annotation-inspector` | Sở hữu scale legend annotation inspector; giữ relationship bắt buộc với upstream `live-chart-preview` and downstream `validation-ledger` và không nhận owner từ vùng khác. |
| `validation-ledger` | Sở hữu validation ledger; giữ relationship bắt buộc với upstream `scale-legend-annotation-inspector` and downstream `accessible-table-and-narrative` và không nhận owner từ vùng khác. |
| `accessible-table-and-narrative` | Sở hữu accessible table and narrative; giữ relationship bắt buộc với upstream `validation-ledger` and downstream `publish-export` và không nhận owner từ vùng khác. |
| `publish-export` | Sở hữu publish export; giữ relationship bắt buộc với upstream `accessible-table-and-narrative` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Field schema, encoding editor, preview and accessibility/validation rail remain visible
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Field schema becomes a drawer; specification and preview retain a split while validation/accessibility moves below
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Choose mark → map fields → configure scale/annotation → inspect preview → review accessible table/narrative → validate; no precision drag is required
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `chart-studio → data-field-schema → mark-and-encoding-specification → live-chart-preview → scale-legend-annotation-inspector → validation-ledger → accessible-table-and-narrative → publish-export`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm data loading/empty, field compatible/incompatible, spec valid/error, preview pending/failure, annotation missing, contrast/label warning, accessible equivalent stale and publish success.

## State obligations

Task-specific states: data loading/empty, field compatible/incompatible, spec valid/error, preview pending/failure, annotation missing, contrast/label warning, accessible equivalent stale and publish success.

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

- Template must map fields to encodings, surface an invalid mapping, update preview and accessible table from the same spec and return focus to the exact edited encoding
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho query builder, palette/token editor, pivot table, dashboard composition, generic code playground or chart viewer; semantic data fields must be bound to visual channels/transforms/scales and compile into both a chart and equivalent table/narrative—database retrieval and color selection are not the dominant task
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CSA-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Vega-Lite encoding](https://vega.github.io/vega-lite/docs/encoding.html) | Cung cấp evidence official về data field schema. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [Microsoft chart accessibility](https://support.microsoft.com/en-us/office/make-your-excel-charts-accessible-19e81ce7-88af-4a3f-a4ef-a26c344527b3) | Cung cấp evidence official về mark and encoding specification. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `chart-specification-authoring-studio`. |
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
{"archetypeId":"chart-specification-authoring-studio","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
