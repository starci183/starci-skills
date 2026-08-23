# Referral negotiation exchange

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `referral-negotiation-exchange` |
| Family | Flow |
| Dominant task | Thương lượng referral giữa sender và recipient tiềm năng bằng cách làm rõ need, capacity, acceptance requirement và alternative trước khi responsibility chuyển giao. |
| Search aliases | referral counter, recipient capacity, transfer receipt |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `referral-exchange` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Thương lượng referral giữa sender và recipient tiềm năng bằng cách làm rõ need, capacity, acceptance requirement và alternative trước khi responsibility chuyển giao.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-RNE-01` | Thương lượng referral giữa sender và recipient tiềm năng bằng cách làm rõ need, capacity, acceptance requirement và alternative trước khi responsibility chuyển giao. | Positive evidence bắt buộc. |
| `AR-RNE-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-RNE-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-RNE-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-RNE-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-RNE-91` | Reject cho multi-party consensus, support chat, completed cross-party handoff, provider directory or appointment booking; one sender and one candidate recipient must exchange structured capability/requirement offers and counters until that recipient accepts or declines a binding service commitment—there is no shared proposal or group consensus rule | Reject. |
| `AR-RNE-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `referral-negotiation-exchange` khi và chỉ khi `AR-RNE-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-RNE-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
referral-exchange
├─ referral-need-and-urgency
├─ sender-evidence-package
├─ recipient-capability-and-capacity
├─ requirement-question-counter-loop
├─ alternative-recipient-or-service-options
├─ acceptance-decline-expiry
└─ responsibility-transfer-and-receipt
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `referral-exchange` | Sở hữu dominant task, complete state và recovery boundary của referral-negotiation-exchange. |
| `referral-need-and-urgency` | Sở hữu referral need and urgency; giữ relationship bắt buộc với upstream `referral-exchange` and downstream `sender-evidence-package` và không nhận owner từ vùng khác. |
| `sender-evidence-package` | Sở hữu sender evidence package; giữ relationship bắt buộc với upstream `referral-need-and-urgency` and downstream `recipient-capability-and-capacity` và không nhận owner từ vùng khác. |
| `recipient-capability-and-capacity` | Sở hữu recipient capability and capacity; giữ relationship bắt buộc với upstream `sender-evidence-package` and downstream `requirement-question-counter-loop` và không nhận owner từ vùng khác. |
| `requirement-question-counter-loop` | Sở hữu requirement question counter loop; giữ relationship bắt buộc với upstream `recipient-capability-and-capacity` and downstream `alternative-recipient-or-service-options` và không nhận owner từ vùng khác. |
| `alternative-recipient-or-service-options` | Sở hữu alternative recipient or service options; giữ relationship bắt buộc với upstream `requirement-question-counter-loop` and downstream `acceptance-decline-expiry` và không nhận owner từ vùng khác. |
| `acceptance-decline-expiry` | Sở hữu acceptance decline expiry; giữ relationship bắt buộc với upstream `alternative-recipient-or-service-options` and downstream `responsibility-transfer-and-receipt` và không nhận owner từ vùng khác. |
| `responsibility-transfer-and-receipt` | Sở hữu responsibility transfer and receipt; giữ relationship bắt buộc với upstream `acceptance-decline-expiry` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Referral evidence, recipient response/capability and negotiation thread remain visible with the disposition rail
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Active negotiation and requirements own the workspace; evidence and alternatives become drawers
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Need summary → recipient requirements/questions → sender response/evidence → accept/decline/alternative → transfer receipt; chronology does not replace structured requirements
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `referral-exchange → referral-need-and-urgency → sender-evidence-package → recipient-capability-and-capacity → requirement-question-counter-loop → alternative-recipient-or-service-options → acceptance-decline-expiry → responsibility-transfer-and-receipt`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm draft/sent/viewed, evidence incomplete, recipient capacity unknown/full, question open/answered, counter proposed, accepted/declined/expired, alternate pending and transfer failed/completed.

## State obligations

Task-specific states: draft/sent/viewed, evidence incomplete, recipient capacity unknown/full, question open/answered, counter proposed, accepted/declined/expired, alternate pending and transfer failed/completed.

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

- Template must surface a recipient requirement, attach responsive evidence, propose an alternative on capacity failure and transfer responsibility only after explicit acceptance
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho multi-party consensus, support chat, completed cross-party handoff, provider directory or appointment booking; one sender and one candidate recipient must exchange structured capability/requirement offers and counters until that recipient accepts or declines a binding service commitment—there is no shared proposal or group consensus rule
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-RNE-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [NHS e-Referral Service](https://digital.nhs.uk/services/e-referral-service) | Cung cấp evidence official về referral need and urgency. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [HL7 FHIR ServiceRequest](https://hl7.org/fhir/servicerequest.html) | Cung cấp evidence official về sender evidence package. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `referral-negotiation-exchange`. |
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
{"archetypeId":"referral-negotiation-exchange","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
