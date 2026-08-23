# Shift handoff acknowledgement board

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `shift-handoff-acknowledgement-board` |
| Family | Flow |
| Dominant task | Chuyển responsibility của một shift cohort bằng unresolved item, risk, context, acknowledgement nhận theo item và chỉ close outgoing shift khi coverage rõ. |
| Search aliases | shift transfer, item acknowledgement, coverage close |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `shift-handoff` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Chuyển responsibility của một shift cohort bằng unresolved item, risk, context, acknowledgement nhận theo item và chỉ close outgoing shift khi coverage rõ.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-SHA-01` | Chuyển responsibility của một shift cohort bằng unresolved item, risk, context, acknowledgement nhận theo item và chỉ close outgoing shift khi coverage rõ. | Positive evidence bắt buộc. |
| `AR-SHA-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-SHA-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-SHA-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-SHA-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-SHA-91` | Reject cho cross-party handoff, task board, inbox or checklist; one shift cohort, per-item receiving proof and a global closure gate are mandatory | Reject. |
| `AR-SHA-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `shift-handoff-acknowledgement-board` khi và chỉ khi `AR-SHA-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-SHA-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
shift-handoff
├─ outgoing-incoming-shift-identity
├─ cohort-summary
├─ handoff-item-board
├─ selected-item-context-and-risk
├─ receiver-acknowledgement-per-item
├─ exception-and-question-loop
└─ coverage-summary-and-global-close
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `shift-handoff` | Sở hữu dominant task, complete state và recovery boundary của shift-handoff-acknowledgement-board. |
| `outgoing-incoming-shift-identity` | Sở hữu outgoing incoming shift identity; giữ relationship bắt buộc với upstream `shift-handoff` and downstream `cohort-summary` và không nhận owner từ vùng khác. |
| `cohort-summary` | Sở hữu cohort summary; giữ relationship bắt buộc với upstream `outgoing-incoming-shift-identity` and downstream `handoff-item-board` và không nhận owner từ vùng khác. |
| `handoff-item-board` | Sở hữu handoff item board; giữ relationship bắt buộc với upstream `cohort-summary` and downstream `selected-item-context-and-risk` và không nhận owner từ vùng khác. |
| `selected-item-context-and-risk` | Sở hữu selected item context and risk; giữ relationship bắt buộc với upstream `handoff-item-board` and downstream `receiver-acknowledgement-per-item` và không nhận owner từ vùng khác. |
| `receiver-acknowledgement-per-item` | Sở hữu receiver acknowledgement per item; giữ relationship bắt buộc với upstream `selected-item-context-and-risk` and downstream `exception-and-question-loop` và không nhận owner từ vùng khác. |
| `exception-and-question-loop` | Sở hữu exception and question loop; giữ relationship bắt buộc với upstream `receiver-acknowledgement-per-item` and downstream `coverage-summary-and-global-close` và không nhận owner từ vùng khác. |
| `coverage-summary-and-global-close` | Sở hữu coverage summary and global close; giữ relationship bắt buộc với upstream `exception-and-question-loop` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Cohort board, selected item detail, acknowledgements and closure summary remain visible
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Cohort and acknowledgement status remain primary; item detail becomes a drawer
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Risk-prioritized item list → item context → acknowledge/question/reject → coverage summary → global close; unresolved items remain reachable
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `shift-handoff → outgoing-incoming-shift-identity → cohort-summary → handoff-item-board → selected-item-context-and-risk → receiver-acknowledgement-per-item → exception-and-question-loop → coverage-summary-and-global-close`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm handoff not-started/in-progress/closed, item ready/incomplete/high-risk, receiver absent, acknowledged/questioned/rejected, context stale, partial coverage, close blocked and late correction.

## State obligations

Task-specific states: handoff not-started/in-progress/closed, item ready/incomplete/high-risk, receiver absent, acknowledged/questioned/rejected, context stale, partial coverage, close blocked and late correction.

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

- Template must acknowledge items independently, open a clarification loop, block global close on uncovered risk and preserve incoming/outgoing responsibility evidence
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho cross-party handoff, task board, inbox or checklist; one shift cohort, per-item receiving proof and a global closure gate are mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-SHA-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [WHO patient handovers](https://cdn.who.int/media/docs/default-source/patient-safety/patient-safety-solutions/ps-solution3-communication-during-patient-handovers.pdf?sfvrsn=7a54c664_8) | Cung cấp evidence official về outgoing incoming shift identity. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [AHRQ TeamSTEPPS handoff](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html) | Cung cấp evidence official về cohort summary. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `shift-handoff-acknowledgement-board`. |
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
{"archetypeId":"shift-handoff-acknowledgement-board","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
