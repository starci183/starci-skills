# Fund NAV strike workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `fund-nav-strike-workbench` |
| Family | Work |
| Dominant task | Tạo một official fund NAV tại valuation point đã khai báo bằng cách resolve exception về position, price, FX, corporate action, accrual và share class trước khi release per-unit price. |
| Search aliases | fund valuation point, NAV exception queue, share-class strike |
| Authority | Page-topology authority trung lập sản phẩm; không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `nav-strike` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Mọi unresolved exception block fund strike và propagate qua total net asset vào affected class; release đi sau tolerance gate và correction tạo lineage mới.
- Mỗi required region giữ named owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft input, pending work, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-FNS-01` | Tạo một official fund NAV tại valuation point đã khai báo bằng cách resolve exception về position, price, FX, corporate action, accrual và share class trước khi release per-unit price. | Positive evidence bắt buộc. |
| `AR-FNS-02` | Mọi required region và relationship đều cần để complete. | Yêu cầu complete graph. |
| `AR-FNS-03` | Ba transformation wide, intermediate và compact giữ cùng work state. | Yêu cầu responsive parity. |
| `AR-FNS-04` | Failure, pending, conflict, permission hoặc recovery có thể xảy ra sau khi state tồn tại. | Giữ state và focus meaning. |
| `AR-FNS-90` | Adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |
| `AR-FNS-91` | Reject calculation-estimate-flow, spreadsheet-grid-editor, review-submit-ledger, or reconciliation-diff-workbench when valuation-point lock, strike-blocking exceptions, multi-class propagation, accruals, class share counts, and correction-by-new-strike lineage are absent. | Reject. |
| `AR-FNS-92` | Candidate chỉ khác noun, density, color, component, card count hoặc state variation. | Reject thành `duplicate-or-variation`. |

### Selection rule

Chọn `fund-nav-strike-workbench` khi và chỉ khi có evidence cho `AR-FNS-01` đến `04`, đủ mọi required region và relationship, và không có `AR-FNS-90` đến `92`. Trả `needs-evidence` khi dominant task, owner relationship, overflow owner hoặc completion consequence chưa được chứng minh. Trả `reject` khi có rejection code.

## Region graph

```text
nav-strike
  ├─ fund-share-class-valuation-point-and-policy-version
  ├─ position-and-cash-ledger
  ├─ market-price-fair-value-and-fx-source-lineage
  ├─ corporate-action-income-expense-and-liability-accruals
  ├─ strike-blocking-exception-queue
  ├─ fund-total-net-assets
  ├─ allocation-across-multiple-share-classes-and-share-counts
  ├─ per-class-nav-values
  ├─ reasonableness-review-and-tolerance-gate
  ├─ official-strike-distribution
  └─ correction-as-new-strike-lineage
```

Mọi unresolved exception block fund strike và propagate qua total net asset vào affected class; release đi sau tolerance gate và correction tạo lineage mới.

### Region obligations

| Region | Owner và relationship obligation |
|---|---|
| `nav-strike` | Sở hữu toàn bộ task valuation, exception, class allocation, release và correction. |
| `fund-share-class-valuation-point-and-policy-version` | Ràng buộc mọi input và decision vào một fund scope, valuation point và policy version. |
| `position-and-cash-ledger` | Sở hữu position, cash và quantity đã reconcile. |
| `market-price-fair-value-and-fx-source-lineage` | Sở hữu pricing, fair-value, FX source và override cùng lineage. |
| `corporate-action-income-expense-and-liability-accruals` | Sở hữu non-price adjustment vào net asset. |
| `strike-blocking-exception-queue` | Sở hữu mọi unresolved issue block toàn strike. |
| `fund-total-net-assets` | Aggregate asset và liability đã resolve tại valuation point. |
| `allocation-across-multiple-share-classes-and-share-counts` | Allocate common và class-specific amount mà không mất conservation. |
| `per-class-nav-values` | Derive per-unit value từng class từ allocated net asset và share count. |
| `reasonableness-review-and-tolerance-gate` | Block release khi declared tolerance fail. |
| `official-strike-distribution` | Sở hữu released value và distribution acknowledgement. |
| `correction-as-new-strike-lineage` | Giữ correction thành new strike cạnh prior release immutable. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison không còn đủ measure cho profile, evidence, control và unobscured focus.
- **Topology response:** Holdings valuation, exception queue, source evidence, accruals, class allocation, tolerance gate, and strike receipt remain visible together.
- **Navigation replacement:** Không có khi direct region access còn operable.
- **Sticky boundary:** Chỉ current scope hoặc primary receipt được persist sau khi reserve space.
- **Overflow owner:** Một region nội tại là table hoặc graph được own bounded overflow; page không own horizontal overflow.

### Intermediate

- **Failure trigger:** Lowest-priority support không còn coexist mà không compress dominant relationship.
- **Topology response:** Blocking exceptions and provisional strike remain primary; full holdings, source lineage, and prior-strike comparison move to synchronized drawers.
- **Navigation replacement:** Labeled contextual drawer mở đúng support region và giữ selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary receipt được persist; short height trả về normal flow.
- **Overflow owner:** Cùng bounded evidence region vẫn là overflow owner duy nhất.

### Compact

- **Failure trigger:** Peer region không còn cùng lúc readable và operable.
- **Topology response:** Valuation point → highest-impact exception → selected holding/source → resolve or override → class expense/share allocation → provisional NAV → tolerance gate → release or correct; holdings become an exception-first queue.
- **Navigation replacement:** Labeled stage navigator expose một primary pane mỗi lần và đưa focus tới heading của stage.
- **Sticky boundary:** Relationship receipt chỉ được persist khi reserve space và yield ở short height.
- **Overflow owner:** Numeric table thành labeled route hoặc một bounded navigator; page không horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order theo `nav-strike → fund-share-class-valuation-point-and-policy-version → position-and-cash-ledger → market-price-fair-value-and-fx-source-lineage → corporate-action-income-expense-and-liability-accruals → strike-blocking-exception-queue → fund-total-net-assets → allocation-across-multiple-share-classes-and-share-counts → per-class-nav-values → reasonableness-review-and-tolerance-gate → official-strike-distribution → correction-as-new-strike-lineage`.
- CSS không reorder semantic content.
- Long label, translation, enlarged text và zoom wrap mà không mất action hoặc state.
- Modal drawer focus heading, giữ modal focus, hỗ trợ Escape và Cancel, rồi trả về exact trigger.

### Interaction parity

- Pointer, keyboard và assistive technology chạm được mọi core action.
- Drag hoặc gesture có alternative add, remove hoặc ordered list.
- Topology change giữ selection, completed step, pending guard, error và recovery.
- Dynamic status dùng text và semantic ngoài color, rồi announce mà không steal focus.
- Multi-error validation giữ input và chuyển focus tới summary.
- Task parity gồm positions loading/reconciled; price current/stale/missing/overridden; fair-value review pending/approved; FX current/stale; corporate action pending/booked; accrual estimated/final; exception open/waived/resolved and blocking/released; fund NAV provisional/held; class values pending/recalculated/final; strike provisional/released/superseded-by-correction; tolerance pass/fail; distribution pending/acknowledged.

## State obligations

Task-specific states: positions loading/reconciled; price current/stale/missing/overridden; fair-value review pending/approved; FX current/stale; corporate action pending/booked; accrual estimated/final; exception open/waived/resolved and blocking/released; fund NAV provisional/held; class values pending/recalculated/final; strike provisional/released/superseded-by-correction; tolerance pass/fail; distribution pending/acknowledged.

| State family | Required behavior |
|---|---|
| Initial / loading | Nêu loading scope, reserve primary region và chỉ block failed region. |
| Ready | Expose current object, owner relationship, evidence state và valid action bằng text. |
| Empty / not-applicable | Phân biệt true empty, no-match, excluded và non-applicable với next action. |
| Error / retry | Nêu failed scope, giữ input/work state và cho focused retry hoặc correction target. |
| Permission / unavailable | Giải thích restriction; read-only khác disabled và giữ context. |
| Pending | Ngăn duplicate action, giữ context, cho safe cancellation và announce progress. |
| Success | Xác nhận exact changed scope và update dependent receipt. |
| Stale / conflict | So sánh version, không silent overwrite và giữ deterministic recovery. |
| Focus transition | User-triggered stage change focus new heading; status-only update không move focus; modal close trả trigger. |
| Responsive presentation | Wide giữ simultaneity; intermediate làm lower-priority support temporary; compact dùng một primary stage có parity. |

## Boundaries

### Accept

- Load holdings, surface stale and missing price lineage, approve a fair-value override, book accruals, allocate across multiple classes, pass tolerance, and issue a versioned strike.
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject calculation-estimate-flow, spreadsheet-grid-editor, review-submit-ledger, or reconciliation-diff-workbench when valuation-point lock, strike-blocking exceptions, multi-class propagation, accruals, class share counts, and correction-by-new-strike lineage are absent.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-FNS-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth không chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype resolve dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar bind product-semantic owner mà không đổi topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow và content-fit breakpoint.
5. Direction diễn đạt visual character trong accepted owner.

## Non-binding research evidence

### Evidence boundary

Research là advisory evidence, không phải product truth. Nó không cho phép copy geometry, component tree, product noun, breakpoint hoặc visual treatment. Binding product claim vẫn route qua business truth, Grammar và Principles.

### Sources

| Source | Điều nguồn hỗ trợ | Điều nguồn không chứng minh |
|---|---|---|
| [SEC Rule 2a-5 fair-value compliance guide](https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/good-faith-determinations-fair-value-small-entity-compliance-guide) | Fair-value determinations, oversight, and valuation-risk context. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [IOSCO 2025 CIS valuation consultation](https://www.iosco.org/library/pubdocs/pdf/IOSCOPD811.pdf) | Current collective-investment valuation governance and NAV context. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful keyboard order through exception-first work. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Non-disruptive announcements for recalculation and release. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `fund-nav-strike-workbench`. |
| `situationCodes` | Matched code từ record này. |
| `searchAliases` | Routed alias dẫn tới match. |
| `dominantTask` | Một product-neutral task sentence. |
| `regions` | Ordered required region ID. |
| `regionRelationships` | Owner, peer, supporting, temporary và downstream relationship. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific và common state family. |
| `boundaryVerdict` | `accept`, `reject` hoặc `needs-evidence`, kèm reason. |
| `grammarHandoff` | Product-semantic region/state owner để Grammar quyết định. |
| `principlesHandoff` | Exact geometry và fit threshold để Principles quyết định. |
| `confidence` | `high`, `medium` hoặc `low`, kèm evidence completeness. |
| `evidence` | Business, current-source và research evidence class, không invent fact. |

```json
{"archetypeId":"fund-nav-strike-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```

