# Care transition readiness orchestrator

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `care-transition-readiness-orchestrator` |
| Family | Flow |
| Dominant task | Điều phối readiness cho care transition bằng cách hội tụ clinical, medication, equipment, transport, education và recipient acceptance trước transfer. |
| Search aliases | transition readiness, go-no-go, recipient acceptance |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `transition-orchestrator` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Điều phối readiness cho care transition bằng cách hội tụ clinical, medication, equipment, transport, education và recipient acceptance trước transfer.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-CTR-01` | Điều phối readiness cho care transition bằng cách hội tụ clinical, medication, equipment, transport, education và recipient acceptance trước transfer. | Positive evidence bắt buộc. |
| `AR-CTR-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-CTR-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-CTR-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-CTR-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-CTR-91` | Reject cho evidence-led case dossier, task checklist, referral negotiation, single case handoff or appointment booking; coupled clinical/logistical/social readiness domains must converge into an executable transition and explicit receiving-party acceptance—evidence sufficiency or a case verdict alone cannot complete it | Reject. |
| `AR-CTR-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `care-transition-readiness-orchestrator` khi và chỉ khi `AR-CTR-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-CTR-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
transition-orchestrator
├─ transition-subject-and-target
├─ readiness-domain-board
├─ domain-owner-evidence
├─ dependency-and-blocker-graph
├─ recipient-understanding-and-acceptance
├─ go-no-go-review
└─ transfer-receipt-and-follow-up
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `transition-orchestrator` | Sở hữu dominant task, complete state và recovery boundary của care-transition-readiness-orchestrator. |
| `transition-subject-and-target` | Sở hữu transition subject and target; giữ relationship bắt buộc với upstream `transition-orchestrator` and downstream `readiness-domain-board` và không nhận owner từ vùng khác. |
| `readiness-domain-board` | Sở hữu readiness domain board; giữ relationship bắt buộc với upstream `transition-subject-and-target` and downstream `domain-owner-evidence` và không nhận owner từ vùng khác. |
| `domain-owner-evidence` | Sở hữu domain owner evidence; giữ relationship bắt buộc với upstream `readiness-domain-board` and downstream `dependency-and-blocker-graph` và không nhận owner từ vùng khác. |
| `dependency-and-blocker-graph` | Sở hữu dependency and blocker graph; giữ relationship bắt buộc với upstream `domain-owner-evidence` and downstream `recipient-understanding-and-acceptance` và không nhận owner từ vùng khác. |
| `recipient-understanding-and-acceptance` | Sở hữu recipient understanding and acceptance; giữ relationship bắt buộc với upstream `dependency-and-blocker-graph` and downstream `go-no-go-review` và không nhận owner từ vùng khác. |
| `go-no-go-review` | Sở hữu go no go review; giữ relationship bắt buộc với upstream `recipient-understanding-and-acceptance` and downstream `transfer-receipt-and-follow-up` và không nhận owner từ vùng khác. |
| `transfer-receipt-and-follow-up` | Sở hữu transfer receipt and follow up; giữ relationship bắt buộc với upstream `go-no-go-review` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Readiness domains, selected evidence, dependency/blocker graph and recipient acceptance remain visible
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Domain board and blockers remain primary; detailed evidence and acceptance become synchronized sheets
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Readiness summary → blocking domain → owner/evidence/action → recipient understanding → go/no-go → receipt/follow-up; only one domain is expanded at a time
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `transition-orchestrator → transition-subject-and-target → readiness-domain-board → domain-owner-evidence → dependency-and-blocker-graph → recipient-understanding-and-acceptance → go-no-go-review → transfer-receipt-and-follow-up`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm transition proposed/scheduled/delayed/completed, domain ready/blocked/unknown, owner missing, evidence stale, dependency unresolved, recipient not-ready/accepted, go/no-go pending and post-transfer exception.

## State obligations

Task-specific states: transition proposed/scheduled/delayed/completed, domain ready/blocked/unknown, owner missing, evidence stale, dependency unresolved, recipient not-ready/accepted, go/no-go pending and post-transfer exception.

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

- Template must expose independent readiness owners, trace a blocker dependency, record recipient understanding, prohibit go on missing evidence and issue a transition receipt
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho evidence-led case dossier, task checklist, referral negotiation, single case handoff or appointment booking; coupled clinical/logistical/social readiness domains must converge into an executable transition and explicit receiving-party acceptance—evidence sufficiency or a case verdict alone cannot complete it
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CTR-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [AHRQ care transitions](https://www.ahrq.gov/patient-safety/settings/hospital/resource/guide/index.html) | Cung cấp evidence official về transition subject and target. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [eCFR discharge planning](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-482/subpart-C/section-482.43) | Cung cấp evidence official về readiness domain board. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [HL7 FHIR](https://hl7.org/fhir/) | Cung cấp evidence official về domain owner evidence. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `care-transition-readiness-orchestrator`. |
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
{"archetypeId":"care-transition-readiness-orchestrator","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
