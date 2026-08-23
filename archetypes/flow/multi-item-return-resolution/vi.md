# Multi item return resolution

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `multi-item-return-resolution` |
| Family | Flow |
| Dominant task | Resolve return nhiều line item bằng eligibility riêng, heterogeneous outcome, reverse logistics và refund reconciliation. |
| Search aliases | multi-line return, mixed refund, reverse logistics |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `return-resolution` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Resolve return nhiều line item bằng eligibility riêng, heterogeneous outcome, reverse logistics và refund reconciliation.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-MIR-01` | Resolve return nhiều line item bằng eligibility riêng, heterogeneous outcome, reverse logistics và refund reconciliation. | Positive evidence bắt buộc. |
| `AR-MIR-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-MIR-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-MIR-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-MIR-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-MIR-91` | Reject cho checkout, generic refund form, order detail or batch action table; per-line eligibility/outcome plus conserved refund reconciliation and reverse logistics are mandatory | Reject. |
| `AR-MIR-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `multi-item-return-resolution` khi và chỉ khi `AR-MIR-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-MIR-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
return-resolution
├─ order-and-return-window
├─ line-item-return-board
├─ selected-item-condition-reason-evidence
├─ item-eligibility-and-outcome
├─ shipment-dropoff-or-no-return-logistics
├─ refund-credit-exchange-ledger
└─ review-submit-receipt
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `return-resolution` | Sở hữu dominant task, complete state và recovery boundary của multi-item-return-resolution. |
| `order-and-return-window` | Sở hữu order and return window; giữ relationship bắt buộc với upstream `return-resolution` and downstream `line-item-return-board` và không nhận owner từ vùng khác. |
| `line-item-return-board` | Sở hữu line item return board; giữ relationship bắt buộc với upstream `order-and-return-window` and downstream `selected-item-condition-reason-evidence` và không nhận owner từ vùng khác. |
| `selected-item-condition-reason-evidence` | Sở hữu selected item condition reason evidence; giữ relationship bắt buộc với upstream `line-item-return-board` and downstream `item-eligibility-and-outcome` và không nhận owner từ vùng khác. |
| `item-eligibility-and-outcome` | Sở hữu item eligibility and outcome; giữ relationship bắt buộc với upstream `selected-item-condition-reason-evidence` and downstream `shipment-dropoff-or-no-return-logistics` và không nhận owner từ vùng khác. |
| `shipment-dropoff-or-no-return-logistics` | Sở hữu shipment dropoff or no return logistics; giữ relationship bắt buộc với upstream `item-eligibility-and-outcome` and downstream `refund-credit-exchange-ledger` và không nhận owner từ vùng khác. |
| `refund-credit-exchange-ledger` | Sở hữu refund credit exchange ledger; giữ relationship bắt buộc với upstream `shipment-dropoff-or-no-return-logistics` and downstream `review-submit-receipt` và không nhận owner từ vùng khác. |
| `review-submit-receipt` | Sở hữu review submit receipt; giữ relationship bắt buộc với upstream `refund-credit-exchange-ledger` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Line items, selected item resolution, logistics and refund ledger remain visible
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Line board and selected outcome remain primary; logistics/refund summary stays adjacent or below
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Item list → item reason/evidence → eligible outcomes → logistics → next item → total refund/review → submit; heterogeneous statuses remain visible
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `return-resolution → order-and-return-window → line-item-return-board → selected-item-condition-reason-evidence → item-eligibility-and-outcome → shipment-dropoff-or-no-return-logistics → refund-credit-exchange-ledger → review-submit-receipt`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm order loading, item eligible/ineligible/conditional, reason/evidence incomplete, quantity conflict, refund/exchange/credit selected, label pending/failure, mixed logistics, amount mismatch, submit pending and partial acceptance.

## State obligations

Task-specific states: order loading, item eligible/ineligible/conditional, reason/evidence incomplete, quantity conflict, refund/exchange/credit selected, label pending/failure, mixed logistics, amount mismatch, submit pending and partial acceptance.

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

- Template must resolve at least three lines differently, explain one ineligible outcome, reconcile refund totals, generate mixed logistics and recover a failed label without duplicate submission
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho checkout, generic refund form, order detail or batch action table; per-line eligibility/outcome plus conserved refund reconciliation and reverse logistics are mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-MIR-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Shopify returns and exchanges](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns) | Cung cấp evidence official về order and return window. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [FTC returns and refunds](https://consumer.ftc.gov/articles/solving-problems-business-returns-refunds-and-other-resolutions) | Cung cấp evidence official về line item return board. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `multi-item-return-resolution`. |
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
{"archetypeId":"multi-item-return-resolution","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
