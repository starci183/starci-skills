# Peer review exchange cycle

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `peer-review-exchange-cycle` |
| Family | Flow |
| Dominant task | Chạy reciprocal peer-review cycle qua allocation artifact, identity policy, phase gate, recovery review thiếu và release feedback công bằng. |
| Search aliases | reciprocal review, anonymous allocation, feedback release |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `peer-review-cycle` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Chạy reciprocal peer-review cycle qua allocation artifact, identity policy, phase gate, recovery review thiếu và release feedback công bằng.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-PRE-01` | Chạy reciprocal peer-review cycle qua allocation artifact, identity policy, phase gate, recovery review thiếu và release feedback công bằng. | Positive evidence bắt buộc. |
| `AR-PRE-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-PRE-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-PRE-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-PRE-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-PRE-91` | Reject cho task list, rubric grading studio, comment thread or approval workflow; reciprocal allocation, anonymity policy, phase gates and coverage recovery are mandatory | Reject. |
| `AR-PRE-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `peer-review-exchange-cycle` khi và chỉ khi `AR-PRE-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-PRE-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
peer-review-cycle
├─ assignment-and-phase-policy
├─ participant-artifact-pool
├─ allocation-and-anonymity-map
├─ assigned-review-work
├─ submission-and-quality-check
├─ coverage-and-exception-board
└─ feedback-release-and-author-response
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `peer-review-cycle` | Sở hữu dominant task, complete state và recovery boundary của peer-review-exchange-cycle. |
| `assignment-and-phase-policy` | Sở hữu assignment and phase policy; giữ relationship bắt buộc với upstream `peer-review-cycle` and downstream `participant-artifact-pool` và không nhận owner từ vùng khác. |
| `participant-artifact-pool` | Sở hữu participant artifact pool; giữ relationship bắt buộc với upstream `assignment-and-phase-policy` and downstream `allocation-and-anonymity-map` và không nhận owner từ vùng khác. |
| `allocation-and-anonymity-map` | Sở hữu allocation and anonymity map; giữ relationship bắt buộc với upstream `participant-artifact-pool` and downstream `assigned-review-work` và không nhận owner từ vùng khác. |
| `assigned-review-work` | Sở hữu assigned review work; giữ relationship bắt buộc với upstream `allocation-and-anonymity-map` and downstream `submission-and-quality-check` và không nhận owner từ vùng khác. |
| `submission-and-quality-check` | Sở hữu submission and quality check; giữ relationship bắt buộc với upstream `assigned-review-work` and downstream `coverage-and-exception-board` và không nhận owner từ vùng khác. |
| `coverage-and-exception-board` | Sở hữu coverage and exception board; giữ relationship bắt buộc với upstream `submission-and-quality-check` and downstream `feedback-release-and-author-response` và không nhận owner từ vùng khác. |
| `feedback-release-and-author-response` | Sở hữu feedback release and author response; giữ relationship bắt buộc với upstream `coverage-and-exception-board` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Cycle status, allocation map, selected review work and coverage/exception rail remain visible to authorized roles
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Assigned review work remains primary; allocation and coverage become role-scoped drawers
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Assigned artifact → rubric/evidence review → submit → next assignment → release status → author response; identities remain masked wherever policy requires
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `peer-review-cycle → assignment-and-phase-policy → participant-artifact-pool → allocation-and-anonymity-map → assigned-review-work → submission-and-quality-check → coverage-and-exception-board → feedback-release-and-author-response`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm enrollment open/locked, artifact missing, allocation pending/conflict, identity masked/revealed, review draft/submitted/late, quality check failed, coverage incomplete, feedback held/released and author response.

## State obligations

Task-specific states: enrollment open/locked, artifact missing, allocation pending/conflict, identity masked/revealed, review draft/submitted/late, quality check failed, coverage incomplete, feedback held/released and author response.

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

- Template must allocate reviews without leaking identity, block feedback before phase release, recover a missing reviewer and let authors respond to released feedback
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho task list, rubric grading studio, comment thread or approval workflow; reciprocal allocation, anonymity policy, phase gates and coverage recovery are mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-PRE-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Moodle Workshop activity](https://docs.moodle.org/405/en/Workshop_activity) | Cung cấp evidence official về assignment and phase policy. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [1EdTech LTI](https://www.1edtech.org/standards/lti) | Cung cấp evidence official về participant artifact pool. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Accessible Authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `peer-review-exchange-cycle`. |
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
{"archetypeId":"peer-review-exchange-cycle","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
