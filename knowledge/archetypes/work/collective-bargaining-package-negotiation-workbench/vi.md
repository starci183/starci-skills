# Collective bargaining package negotiation workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `collective-bargaining-package-negotiation-workbench` |
| Family | Work |
| Dominant task | Hợp nhất mandate versioned của đúng hai bargaining side thành một package thỏa ước chung qua offer/counter theo issue, costing, tentative agreement và ratification độc lập. |
| Search aliases | bargaining package, bilateral counter, tentative agreement |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `bargaining-workbench` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Hợp nhất mandate versioned của đúng hai bargaining side thành một package thỏa ước chung qua offer/counter theo issue, costing, tentative agreement và ratification độc lập.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-CBN-01` | Hợp nhất mandate versioned của đúng hai bargaining side thành một package thỏa ước chung qua offer/counter theo issue, costing, tentative agreement và ratification độc lập. | Positive evidence bắt buộc. |
| `AR-CBN-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-CBN-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-CBN-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-CBN-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-CBN-91` | Reject cho `multi-party-consensus-workbench`, referral negotiation, multi-creditor hardship, meeting facilitation, chat or generic contract editor; exactly two sides, private mandate boundaries, immutable bilateral package counters, non-final tentative issue agreements, cross-issue package consistency and two independent terminal ratifications are mandatory—no quorum/shared proposal, recipient acceptance or independently settled creditor decides the result | Reject. |
| `AR-CBN-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `collective-bargaining-package-negotiation-workbench` khi và chỉ khi `AR-CBN-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-CBN-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
bargaining-workbench
├─ recognized-two-party-bargaining-unit-and-private-mandates
├─ governed-issue-register
├─ immutable-versioned-offer-counteroffer-ledger
├─ costing-and-operational-impact (peer synchronization)
├─ tentative-issue-agreement-set
├─ unresolved-package-dependencies-and-reservations
├─ whole-package-consolidation
├─ independent-party-ratification-authorities
└─ signed-collective-agreement-and-implementation-record
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `bargaining-workbench` | Sở hữu dominant task, complete state và recovery boundary của collective-bargaining-package-negotiation-workbench. |
| `recognized-two-party-bargaining-unit-and-private-mandates` | Sở hữu recognized two party bargaining unit and private mandates; giữ relationship bắt buộc với upstream `bargaining-workbench` and downstream `governed-issue-register` và không nhận owner từ vùng khác. |
| `governed-issue-register` | Sở hữu governed issue register; giữ relationship bắt buộc với upstream `recognized-two-party-bargaining-unit-and-private-mandates` and downstream `immutable-versioned-offer-counteroffer-ledger` và không nhận owner từ vùng khác. |
| `immutable-versioned-offer-counteroffer-ledger` | Sở hữu immutable versioned offer counteroffer ledger; giữ relationship bắt buộc với upstream `governed-issue-register` and downstream `costing-and-operational-impact` và không nhận owner từ vùng khác. |
| `costing-and-operational-impact` | Sở hữu costing and operational impact; giữ relationship bắt buộc với upstream `immutable-versioned-offer-counteroffer-ledger` and downstream `tentative-issue-agreement-set` và không nhận owner từ vùng khác. |
| `tentative-issue-agreement-set` | Sở hữu tentative issue agreement set; giữ relationship bắt buộc với upstream `costing-and-operational-impact` and downstream `unresolved-package-dependencies-and-reservations` và không nhận owner từ vùng khác. |
| `unresolved-package-dependencies-and-reservations` | Sở hữu unresolved package dependencies and reservations; giữ relationship bắt buộc với upstream `tentative-issue-agreement-set` and downstream `whole-package-consolidation` và không nhận owner từ vùng khác. |
| `whole-package-consolidation` | Sở hữu whole package consolidation; giữ relationship bắt buộc với upstream `unresolved-package-dependencies-and-reservations` and downstream `independent-party-ratification-authorities` và không nhận owner từ vùng khác. |
| `independent-party-ratification-authorities` | Sở hữu independent party ratification authorities; giữ relationship bắt buộc với upstream `whole-package-consolidation` and downstream `signed-collective-agreement-and-implementation-record` và không nhận owner từ vùng khác. |
| `signed-collective-agreement-and-implementation-record` | Sở hữu signed collective agreement and implementation record; giữ relationship bắt buộc với upstream `independent-party-ratification-authorities` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Issue register, active bilateral offer lineage, combined costing and tentative/package status remain visible; no issue appears final while whole-package reservations remain open
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Active issue/counter and global package impact stay primary; mandates and prior versions become role-scoped drawers while tentative-versus-ratified state persists
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Mandate boundary → package version/counter → issue deltas/tentatives → combined impact → unresolved dependency → whole-package validation → each side’s ratification → signed record; chronology never replaces issue ownership
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `bargaining-workbench → recognized-two-party-bargaining-unit-and-private-mandates → governed-issue-register → immutable-versioned-offer-counteroffer-ledger → costing-and-operational-impact → tentative-issue-agreement-set → unresolved-package-dependencies-and-reservations → whole-package-consolidation → independent-party-ratification-authorities → signed-collective-agreement-and-implementation-record`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm side recognized/authority-unverified, mandate private/released/expired, issue open/offered/countered/withdrawn/tentatively-agreed/reserved, proposal version stale, package impact calculating/over-mandate, tentative set consistent/conflicted, impasse/mediation, ratification pending/approved/rejected and agreement signed/superseded.

## State obligations

Task-specific states: side recognized/authority-unverified, mandate private/released/expired, issue open/offered/countered/withdrawn/tentatively-agreed/reserved, proposal version stale, package impact calculating/over-mandate, tentative set consistent/conflicted, impasse/mediation, ratification pending/approved/rejected and agreement signed/superseded.

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

- Template must exchange two versioned counters, tentatively agree one issue without finalizing it, show another issue pushing the package beyond mandate, reopen/reserve it, require both ratifications and preserve issue/version/package state through compact stages
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho `multi-party-consensus-workbench`, referral negotiation, multi-creditor hardship, meeting facilitation, chat or generic contract editor; exactly two sides, private mandate boundaries, immutable bilateral package counters, non-final tentative issue agreements, cross-issue package consistency and two independent terminal ratifications are mandatory—no quorum/shared proposal, recipient acceptance or independently settled creditor decides the result
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CBN-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [ILO collective bargaining](https://www.ilo.org/topics-and-sectors/collective-bargaining-and-labour-relations) | Cung cấp evidence official về recognized two party bargaining unit and private mandates. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [NLRB employer and union obligations](https://www.nlrb.gov/about-nlrb/rights-we-protect/your-rights/employer-union-rights-and-obligations) | Cung cấp evidence official về governed issue register. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [GOV.UK collective bargaining](https://www.gov.uk/working-with-trade-unions/collective-bargaining) | Cung cấp evidence official về immutable versioned offer counteroffer ledger. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `collective-bargaining-package-negotiation-workbench`. |
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
{"archetypeId":"collective-bargaining-package-negotiation-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
