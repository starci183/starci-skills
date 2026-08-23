# Sealed bid multi lot award workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `sealed-bid-multi-lot-award-workbench` |
| Family | Work |
| Dominant task | Mở tập sealed bid gắn version chỉ sau deadline, test responsibility/responsiveness, allocate nhiều lot theo disclosed cross-lot constraint và tạo award auditable không negotiation hậu mở. |
| Search aliases | sealed bid, multi-lot award, responsiveness matrix |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `sealed-award-workbench` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Mở tập sealed bid gắn version chỉ sau deadline, test responsibility/responsiveness, allocate nhiều lot theo disclosed cross-lot constraint và tạo award auditable không negotiation hậu mở.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-SBA-01` | Mở tập sealed bid gắn version chỉ sau deadline, test responsibility/responsiveness, allocate nhiều lot theo disclosed cross-lot constraint và tạo award auditable không negotiation hậu mở. | Positive evidence bắt buộc. |
| `AR-SBA-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-SBA-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-SBA-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-SBA-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-SBA-91` | Reject cho market-depth order entry, waitlist/quota allocation, comparison matrix, filing validator, generic procurement scoring, auction or negotiated proposal workspace; deadline-bound concealment, authorized opening, no post-opening bargaining, responsiveness to one immutable invitation and disclosed multi-lot allocation rules are mandatory | Reject. |
| `AR-SBA-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `sealed-bid-multi-lot-award-workbench` khi và chỉ khi `AR-SBA-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-SBA-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
sealed-award-workbench
├─ solicitation-version-lot-and-award-rules
├─ sealed-submission-register
├─ deadline-and-authorized-opening-ceremony
├─ bidder-responsibility-and-bid-responsiveness
├─ bid-by-lot-price-factor-matrix
├─ cross-lot-award-constraints (peer synchronization)
├─ lowest-valid-aggregate-award-scenario
├─ conflict-recusal-and-approval
└─ award-unsuccessful-notices-and-opening-record
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `sealed-award-workbench` | Sở hữu dominant task, complete state và recovery boundary của sealed-bid-multi-lot-award-workbench. |
| `solicitation-version-lot-and-award-rules` | Sở hữu solicitation version lot and award rules; giữ relationship bắt buộc với upstream `sealed-award-workbench` and downstream `sealed-submission-register` và không nhận owner từ vùng khác. |
| `sealed-submission-register` | Sở hữu sealed submission register; giữ relationship bắt buộc với upstream `solicitation-version-lot-and-award-rules` and downstream `deadline-and-authorized-opening-ceremony` và không nhận owner từ vùng khác. |
| `deadline-and-authorized-opening-ceremony` | Sở hữu deadline and authorized opening ceremony; giữ relationship bắt buộc với upstream `sealed-submission-register` and downstream `bidder-responsibility-and-bid-responsiveness` và không nhận owner từ vùng khác. |
| `bidder-responsibility-and-bid-responsiveness` | Sở hữu bidder responsibility and bid responsiveness; giữ relationship bắt buộc với upstream `deadline-and-authorized-opening-ceremony` and downstream `bid-by-lot-price-factor-matrix` và không nhận owner từ vùng khác. |
| `bid-by-lot-price-factor-matrix` | Sở hữu bid by lot price factor matrix; giữ relationship bắt buộc với upstream `bidder-responsibility-and-bid-responsiveness` and downstream `cross-lot-award-constraints` và không nhận owner từ vùng khác. |
| `cross-lot-award-constraints` | Sở hữu cross lot award constraints; giữ relationship bắt buộc với upstream `bid-by-lot-price-factor-matrix` and downstream `lowest-valid-aggregate-award-scenario` và không nhận owner từ vùng khác. |
| `lowest-valid-aggregate-award-scenario` | Sở hữu lowest valid aggregate award scenario; giữ relationship bắt buộc với upstream `cross-lot-award-constraints` and downstream `conflict-recusal-and-approval` và không nhận owner từ vùng khác. |
| `conflict-recusal-and-approval` | Sở hữu conflict recusal and approval; giữ relationship bắt buộc với upstream `lowest-valid-aggregate-award-scenario` and downstream `award-unsuccessful-notices-and-opening-record` và không nhận owner từ vùng khác. |
| `award-unsuccessful-notices-and-opening-record` | Sở hữu award unsuccessful notices and opening record; giữ relationship bắt buộc với upstream `conflict-recusal-and-approval` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Sealed/opening status, bid-by-lot matrix, responsiveness exceptions and candidate award scenario remain visible; only the matrix owns bounded two-axis overflow and each exclusion links to its exact rule
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `bid-by-lot-price-factor-matrix` owns bounded two-axis overflow; the page owns none.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Lot-ranked evaluation and proposed awards stay primary; opening history and bidder evidence become synchronized drawers while solicitation version, lot caps and recusals persist
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `bid-by-lot-price-factor-matrix` owns bounded two-axis overflow; the page owns none.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Solicitation/opening receipt → lot → responsive bid evidence → global cross-lot allocation impact → exception/recusal → proposed award → approval/notices; grouped lot records replace the matrix and preserve the candidate allocation
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `bid-by-lot-price-factor-matrix` owns bounded two-axis overflow; the page owns none.

### Reflow

- DOM order, reading order và meaningful focus order là `sealed-award-workbench → solicitation-version-lot-and-award-rules → sealed-submission-register → deadline-and-authorized-opening-ceremony → bidder-responsibility-and-bid-responsiveness → bid-by-lot-price-factor-matrix → cross-lot-award-constraints → lowest-valid-aggregate-award-scenario → conflict-recusal-and-approval → award-unsuccessful-notices-and-opening-record`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm before-deadline concealed/late/withdrawn, opening locked/authorized/opened/interrupted, bidder responsible/ineligible/unknown, bid responsive/nonresponsive/irregular, lot valid/no-valid-bid/ceased, constraint satisfied/violated, scenario calculating/stale, recusal required, award draft/approved/blocked and notices/opening record issued.

## State obligations

Task-specific states: before-deadline concealed/late/withdrawn, opening locked/authorized/opened/interrupted, bidder responsible/ineligible/unknown, bid responsive/nonresponsive/irregular, lot valid/no-valid-bid/ceased, constraint satisfied/violated, scenario calculating/stale, recusal required, award draft/approved/blocked and notices/opening record issued.

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

- Template must conceal bids before deadline, perform an authorized opening, mark one nonresponsive bid, recompute a multi-lot award under a supplier cap, block conflicted approval and issue accessible opening, award and unsuccessful-notice records with compact parity
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho market-depth order entry, waitlist/quota allocation, comparison matrix, filing validator, generic procurement scoring, auction or negotiated proposal workspace; deadline-bound concealment, authorized opening, no post-opening bargaining, responsiveness to one immutable invitation and disclosed multi-lot allocation rules are mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-SBA-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Acquisition.gov FAR Part 14](https://www.acquisition.gov/far/part-14) | Cung cấp evidence official về solicitation version lot and award rules. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [European Commission eForms](https://single-market-economy.ec.europa.eu/single-market/public-procurement/digital-procurement/eforms_en) | Cung cấp evidence official về sealed submission register. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [GOV.UK lots guidance](https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-lots-html) | Cung cấp evidence official về deadline and authorized opening ceremony. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `sealed-bid-multi-lot-award-workbench`. |
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
{"archetypeId":"sealed-bid-multi-lot-award-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
