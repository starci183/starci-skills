# Hedge accounting designation rebalancing workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `hedge-accounting-designation-rebalancing-workbench` |
| Family | Work |
| Dominant task | Designation một quan hệ hedge accounting từ hedged item và hedging instrument cụ thể, kiểm tra economic relationship cùng hedge ratio còn qualifying, rồi ghi nhận rebalancing hoặc discontinuation mà không viết lại prior period. |
| Search aliases | hedge designation, effectiveness test, hedge ratio rebalancing |
| Authority | Page-topology authority trung lập sản phẩm; không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `hedge-accounting` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Hedged-item profile và hedging-instrument profile là peer evidence owner; documented ratio nối chúng, effectiveness và diagnostics đồng bộ như peer, còn accounting attribution đi sau designation state.
- Mỗi required region giữ named owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft input, pending work, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-HDR-01` | Designation một quan hệ hedge accounting từ hedged item và hedging instrument cụ thể, kiểm tra economic relationship cùng hedge ratio còn qualifying, rồi ghi nhận rebalancing hoặc discontinuation mà không viết lại prior period. | Positive evidence bắt buộc. |
| `AR-HDR-02` | Mọi required region và relationship đều cần để complete. | Yêu cầu complete graph. |
| `AR-HDR-03` | Ba transformation wide, intermediate và compact giữ cùng work state. | Yêu cầu responsive parity. |
| `AR-HDR-04` | Failure, pending, conflict, permission hoặc recovery có thể xảy ra sau khi state tồn tại. | Giữ state và focus meaning. |
| `AR-HDR-90` | Adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |
| `AR-HDR-91` | Reject scenario-sensitivity-modeler, reconciliation-diff-workbench, portfolio-health-matrix, or generic derivative valuation when the documented objective, designation ratio, qualifying tests, accounting attribution, and rebalance-versus-discontinue lineage are absent. | Reject. |
| `AR-HDR-92` | Candidate chỉ khác noun, density, color, component, card count hoặc state variation. | Reject thành `duplicate-or-variation`. |

### Selection rule

Chọn `hedge-accounting-designation-rebalancing-workbench` khi và chỉ khi có evidence cho `AR-HDR-01` đến `04`, đủ mọi required region và relationship, và không có `AR-HDR-90` đến `92`. Trả `needs-evidence` khi dominant task, owner relationship, overflow owner hoặc completion consequence chưa được chứng minh. Trả `reject` khi có rejection code.

## Region graph

```text
hedge-accounting
  ├─ reporting-entity-period-standard-and-policy-version
  ├─ hedged-item-risk-component-profile
  ├─ hedging-instrument-terms-and-exposure-profile
  ├─ documented-risk-management-objective
  ├─ designation-ratio-and-qualifying-criteria
  ├─ prospective-and-period-effectiveness-tests
  ├─ source-of-ineffectiveness-diagnostics
  ├─ oci-pnl-and-basis-adjustment-attribution
  ├─ rebalance-or-discontinue-decision
  └─ posted-accounting-and-designation-lineage
```

Hedged-item profile và hedging-instrument profile là peer evidence owner; documented ratio nối chúng, effectiveness và diagnostics đồng bộ như peer, còn accounting attribution đi sau designation state.

### Region obligations

| Region | Owner và relationship obligation |
|---|---|
| `hedge-accounting` | Sở hữu toàn bộ task designation, effectiveness, accounting và lineage. |
| `reporting-entity-period-standard-and-policy-version` | Ràng buộc mọi quyết định vào một reporting scope và policy version. |
| `hedged-item-risk-component-profile` | Sở hữu độc lập eligibility của item, evidence risk component và exposure được designation. |
| `hedging-instrument-terms-and-exposure-profile` | Sở hữu độc lập terms, lifecycle và exposure của instrument. |
| `documented-risk-management-objective` | Nối hai profile bằng một objective được document mà không gộp evidence. |
| `designation-ratio-and-qualifying-criteria` | Sở hữu ratio được document và mọi qualification gate. |
| `prospective-and-period-effectiveness-tests` | Sở hữu effectiveness evidence có thể lặp lại cho ratio được designation. |
| `source-of-ineffectiveness-diagnostics` | Giải thích effectiveness fail hoặc drift cạnh test đã tạo kết quả. |
| `oci-pnl-and-basis-adjustment-attribution` | Nhận accounting attribution chỉ từ designation state qualifying. |
| `rebalance-or-discontinue-decision` | Chọn continue, prospective rebalance hoặc discontinue mà không mutate retrospective. |
| `posted-accounting-and-designation-lineage` | Giữ posted result và prior version thành immutable lineage. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison không còn đủ measure cho profile, evidence, control và unobscured focus.
- **Topology response:** Hedged-item and instrument profiles, ratio, effectiveness evidence, diagnostics, attribution, and decision remain visible together.
- **Navigation replacement:** Không có khi direct region access còn operable.
- **Sticky boundary:** Chỉ current scope hoặc primary receipt được persist sau khi reserve space.
- **Overflow owner:** Một region nội tại là table hoặc graph được own bounded overflow; page không own horizontal overflow.

### Intermediate

- **Failure trigger:** Lowest-priority support không còn coexist mà không compress dominant relationship.
- **Topology response:** The ratio, failed criterion, and effectiveness result remain primary; profile detail, policy evidence, and prior versions move to an anchored contextual drawer.
- **Navigation replacement:** Labeled contextual drawer mở đúng support region và giữ selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary receipt được persist; short height trả về normal flow.
- **Overflow owner:** Cùng bounded evidence region vẫn là overflow owner duy nhất.

### Compact

- **Failure trigger:** Peer region không còn cùng lúc readable và operable.
- **Topology response:** Policy → item and risk component → instrument → ratio → criteria → effectiveness → attribution → continue, rebalance, or discontinue; peer profiles become an alternating comparison route with a persistent relationship receipt.
- **Navigation replacement:** Labeled stage navigator expose một primary pane mỗi lần và đưa focus tới heading của stage.
- **Sticky boundary:** Relationship receipt chỉ được persist khi reserve space và yield ở short height.
- **Overflow owner:** Numeric table thành labeled route hoặc một bounded navigator; page không horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order theo `hedge-accounting → reporting-entity-period-standard-and-policy-version → hedged-item-risk-component-profile → hedging-instrument-terms-and-exposure-profile → documented-risk-management-objective → designation-ratio-and-qualifying-criteria → prospective-and-period-effectiveness-tests → source-of-ineffectiveness-diagnostics → oci-pnl-and-basis-adjustment-attribution → rebalance-or-discontinue-decision → posted-accounting-and-designation-lineage`.
- CSS không reorder semantic content.
- Long label, translation, enlarged text và zoom wrap mà không mất action hoặc state.
- Modal drawer focus heading, giữ modal focus, hỗ trợ Escape và Cancel, rồi trả về exact trigger.

### Interaction parity

- Pointer, keyboard và assistive technology chạm được mọi core action.
- Drag hoặc gesture có alternative add, remove hoặc ordered list.
- Topology change giữ selection, completed step, pending guard, error và recovery.
- Dynamic status dùng text và semantic ngoài color, rồi announce mà không steal focus.
- Multi-error validation giữ input và chuyển focus tới summary.
- Task parity gồm item eligible/ineligible/partially designated; instrument active/matured/novated; risk component identifiable/not-qualifying; designation draft/documented/rejected; ratio aligned/imbalanced/rebalanced; test pending/pass/fail; ineffectiveness unmeasured/measured/posted; accounting OCI/P&L/basis-adjusted; relationship continuing/discontinued; prior period locked/corrected-by-new-version.

## State obligations

Task-specific states: item eligible/ineligible/partially designated; instrument active/matured/novated; risk component identifiable/not-qualifying; designation draft/documented/rejected; ratio aligned/imbalanced/rebalanced; test pending/pass/fail; ineffectiveness unmeasured/measured/posted; accounting OCI/P&L/basis-adjusted; relationship continuing/discontinued; prior period locked/corrected-by-new-version.

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

- Pair separately evidenced item and instrument profiles, fail and correct a qualifying criterion, test effectiveness, attribute ineffectiveness, rebalance prospectively, and preserve discontinuation lineage.
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject scenario-sensitivity-modeler, reconciliation-diff-workbench, portfolio-health-matrix, or generic derivative valuation when the documented objective, designation ratio, qualifying tests, accounting attribution, and rebalance-versus-discontinue lineage are absent.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-HDR-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth không chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [IFRS 9 Financial Instruments](https://www.ifrs.org/issued-runtime/standards/list-of-runtime/standards/ifrs-9-financial-instruments/) | Hedge-accounting policy, instrument recognition, and version context. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [FASB ASU 2025-09 Hedge Accounting Improvements](https://storage.fasb.org/ASU%202025-09.pdf) | Current U.S. hedge-accounting improvement context and ongoing risk assessment. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful keyboard order across paired profiles and stage changes. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [Microsoft Fluent layout](https://fluent2.microsoft.design/layout) | Advisory evidence for adaptive dense-work topology. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `hedge-accounting-designation-rebalancing-workbench`. |
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
{"archetypeId":"hedge-accounting-designation-rebalancing-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```

