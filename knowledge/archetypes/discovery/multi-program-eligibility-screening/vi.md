# Multi program eligibility screening

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `multi-program-eligibility-screening` |
| Family | Discovery |
| Dominant task | Screen một person hoặc household theo nhiều program độc lập bằng shared fact model trong khi giữ criteria, unknown và next step riêng của từng program. |
| Search aliases | benefit screening, shared facts, program verdicts |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `eligibility-screening` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Screen một person hoặc household theo nhiều program độc lập bằng shared fact model trong khi giữ criteria, unknown và next step riêng của từng program.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-MPE-01` | Screen một person hoặc household theo nhiều program độc lập bằng shared fact model trong khi giữ criteria, unknown và next step riêng của từng program. | Positive evidence bắt buộc. |
| `AR-MPE-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-MPE-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-MPE-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-MPE-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-MPE-91` | Reject cho `multi-service-life-event-orchestrator`, troubleshooting wizard, service hub, plan comparison or application flow; one read-only fact set must produce side-by-side eligible/ineligible/unknown verdicts from autonomous program rule sets, with no downstream service submissions, handoffs or receipts | Reject. |
| `AR-MPE-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `multi-program-eligibility-screening` khi và chỉ khi `AR-MPE-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-MPE-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
eligibility-screening
├─ person-household-facts
├─ program-catalog-and-scope
├─ program-criteria-evaluators
├─ eligible-possibly-not-eligible-results
├─ missing-fact-and-evidence-plan
└─ comparison-and-next-actions
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `eligibility-screening` | Sở hữu dominant task, complete state và recovery boundary của multi-program-eligibility-screening. |
| `person-household-facts` | Sở hữu person household facts; giữ relationship bắt buộc với upstream `eligibility-screening` and downstream `program-catalog-and-scope` và không nhận owner từ vùng khác. |
| `program-catalog-and-scope` | Sở hữu program catalog and scope; giữ relationship bắt buộc với upstream `person-household-facts` and downstream `program-criteria-evaluators` và không nhận owner từ vùng khác. |
| `program-criteria-evaluators` | Sở hữu program criteria evaluators; giữ relationship bắt buộc với upstream `program-catalog-and-scope` and downstream `eligible-possibly-not-eligible-results` và không nhận owner từ vùng khác. |
| `eligible-possibly-not-eligible-results` | Sở hữu eligible possibly not eligible results; giữ relationship bắt buộc với upstream `program-criteria-evaluators` and downstream `missing-fact-and-evidence-plan` và không nhận owner từ vùng khác. |
| `missing-fact-and-evidence-plan` | Sở hữu missing fact and evidence plan; giữ relationship bắt buộc với upstream `eligible-possibly-not-eligible-results` and downstream `comparison-and-next-actions` và không nhận owner từ vùng khác. |
| `comparison-and-next-actions` | Sở hữu comparison and next actions; giữ relationship bắt buộc với upstream `missing-fact-and-evidence-plan` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Shared facts, program result matrix and selected criteria explanation remain visible
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Result matrix becomes primary; facts and selected program evidence use synchronized drawers
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Facts summary → program result list → selected program criteria/unknowns → evidence or next action; no wide matrix is required
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `eligibility-screening → person-household-facts → program-catalog-and-scope → program-criteria-evaluators → eligible-possibly-not-eligible-results → missing-fact-and-evidence-plan → comparison-and-next-actions`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm facts incomplete/stale, program loading/closed, criterion met/not-met/unknown, conflicting evidence, eligible/possibly/not-eligible, manual review, application unavailable and screening saved.

## State obligations

Task-specific states: facts incomplete/stale, program loading/closed, criterion met/not-met/unknown, conflicting evidence, eligible/possibly/not-eligible, manual review, application unavailable and screening saved.

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

- Template must evaluate at least three programs, explain each verdict separately, request one missing fact without erasing completed evidence and route an uncertain result to manual review
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho `multi-service-life-event-orchestrator`, troubleshooting wizard, service hub, plan comparison or application flow; one read-only fact set must produce side-by-side eligible/ineligible/unknown verdicts from autonomous program rule sets, with no downstream service submissions, handoffs or receipts
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-MPE-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [USAGov Benefit Finder](https://www.usa.gov/benefit-finder) | Cung cấp evidence official về person household facts. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [GOV.UK benefits calculators](https://www.gov.uk/benefits-calculators) | Cung cấp evidence official về program catalog and scope. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `multi-program-eligibility-screening`. |
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
{"archetypeId":"multi-program-eligibility-screening","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
