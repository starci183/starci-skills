# Collateral margin call substitution workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `collateral-margin-call-substitution-workbench` |
| Family | Work |
| Dominant task | Đáp ứng margin requirement hoặc thực thi collateral substitution bằng asset eligible có haircut-adjusted value cover call mà không release collateral cũ trước khi replacement settlement final. |
| Search aliases | margin call coverage, collateral substitution, deliver-before-release |
| Authority | Page-topology authority trung lập sản phẩm; không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `collateral-substitution` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Candidate adjusted value đi vào coverage ledger; replacement delivery và old-asset release tạo dependency pair, còn release gate chỉ mở sau custodian settlement xác nhận continuous coverage.
- Mỗi required region giữ named owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft input, pending work, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-CMS-01` | Đáp ứng margin requirement hoặc thực thi collateral substitution bằng asset eligible có haircut-adjusted value cover call mà không release collateral cũ trước khi replacement settlement final. | Positive evidence bắt buộc. |
| `AR-CMS-02` | Mọi required region và relationship đều cần để complete. | Yêu cầu complete graph. |
| `AR-CMS-03` | Ba transformation wide, intermediate và compact giữ cùng work state. | Yêu cầu responsive parity. |
| `AR-CMS-04` | Failure, pending, conflict, permission hoặc recovery có thể xảy ra sau khi state tồn tại. | Giữ state và focus meaning. |
| `AR-CMS-90` | Adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |
| `AR-CMS-91` | Reject capacity-allocation-overview, dual-list-transfer, waitlist-offer-allocation-board, or inventory-replenishment-planner when agreement-specific requirement, adjusted eligibility, concentration, held state, deliver-before-release dependency, and custodian proof are absent. | Reject. |
| `AR-CMS-92` | Candidate chỉ khác noun, density, color, component, card count hoặc state variation. | Reject thành `duplicate-or-variation`. |

### Selection rule

Chọn `collateral-margin-call-substitution-workbench` khi và chỉ khi có evidence cho `AR-CMS-01` đến `04`, đủ mọi required region và relationship, và không có `AR-CMS-90` đến `92`. Trả `needs-evidence` khi dominant task, owner relationship, overflow owner hoặc completion consequence chưa được chứng minh. Trả `reject` khi có rejection code.

## Region graph

```text
collateral-substitution
  ├─ agreement-counterparty-call-date-and-dispute-state
  ├─ exposure-threshold-and-margin-requirement
  ├─ pledged-collateral-inventory
  ├─ candidate-asset-eligibility-haircut-fx-and-concentration-checks
  ├─ coverage-and-buffer-ledger
  ├─ proposed-deliver-release-pair
  ├─ custodian-settlement-and-timing-dependency
  ├─ confirmed-substitution-and-updated-shortfall
  └─ call-closure-and-dispute-receipt
```

Candidate adjusted value đi vào coverage ledger; replacement delivery và old-asset release tạo dependency pair, còn release gate chỉ mở sau custodian settlement xác nhận continuous coverage.

### Region obligations

| Region | Owner và relationship obligation |
|---|---|
| `collateral-substitution` | Sở hữu toàn bộ task requirement, eligibility, continuous coverage, settlement và closure. |
| `agreement-counterparty-call-date-and-dispute-state` | Ràng buộc call vào agreement, counterparty, date và dispute state. |
| `exposure-threshold-and-margin-requirement` | Derive amount phải được cover. |
| `pledged-collateral-inventory` | Sở hữu collateral đang held, pending và releasable. |
| `candidate-asset-eligibility-haircut-fx-and-concentration-checks` | Sở hữu eligibility và adjusted-value evidence theo candidate. |
| `coverage-and-buffer-ledger` | Chứng minh continuous coverage trước/sau từng proposed movement. |
| `proposed-deliver-release-pair` | Ràng buộc replacement delivery và old-asset release thành một ordered dependency pair. |
| `custodian-settlement-and-timing-dependency` | Sở hữu acknowledgement, failure, retry và release gate. |
| `confirmed-substitution-and-updated-shortfall` | Recalculate coverage chỉ từ confirmed settlement state. |
| `call-closure-and-dispute-receipt` | Close hoặc reopen call cùng complete coverage và dispute evidence. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison không còn đủ measure cho profile, evidence, control và unobscured focus.
- **Topology response:** Margin calculation, held and candidate collateral, eligibility evidence, coverage ledger, paired movements, and settlement status remain visible together.
- **Navigation replacement:** Không có khi direct region access còn operable.
- **Sticky boundary:** Chỉ current scope hoặc primary receipt được persist sau khi reserve space.
- **Overflow owner:** Một region nội tại là table hoặc graph được own bounded overflow; page không own horizontal overflow.

### Intermediate

- **Failure trigger:** Lowest-priority support không còn coexist mà không compress dominant relationship.
- **Topology response:** Requirement, selected asset, and coverage effect remain primary; full inventory, agreement clauses, and custodian history move to synchronized drawers.
- **Navigation replacement:** Labeled contextual drawer mở đúng support region và giữ selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary receipt được persist; short height trả về normal flow.
- **Overflow owner:** Cùng bounded evidence region vẫn là overflow owner duy nhất.

### Compact

- **Failure trigger:** Peer region không còn cùng lúc readable và operable.
- **Topology response:** Call and agreement → requirement → candidate → eligibility, haircut, FX, concentration → deliver/release pair → settle replacement → release old asset → close or dispute; allocation exposes add/remove and ordered-list controls instead of drag-only operation.
- **Navigation replacement:** Labeled stage navigator expose một primary pane mỗi lần và đưa focus tới heading của stage.
- **Sticky boundary:** Relationship receipt chỉ được persist khi reserve space và yield ở short height.
- **Overflow owner:** Numeric table thành labeled route hoặc một bounded navigator; page không horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order theo `collateral-substitution → agreement-counterparty-call-date-and-dispute-state → exposure-threshold-and-margin-requirement → pledged-collateral-inventory → candidate-asset-eligibility-haircut-fx-and-concentration-checks → coverage-and-buffer-ledger → proposed-deliver-release-pair → custodian-settlement-and-timing-dependency → confirmed-substitution-and-updated-shortfall → call-closure-and-dispute-receipt`.
- CSS không reorder semantic content.
- Long label, translation, enlarged text và zoom wrap mà không mất action hoặc state.
- Modal drawer focus heading, giữ modal focus, hỗ trợ Escape và Cancel, rồi trả về exact trigger.

### Interaction parity

- Pointer, keyboard và assistive technology chạm được mọi core action.
- Drag hoặc gesture có alternative add, remove hoặc ordered list.
- Topology change giữ selection, completed step, pending guard, error và recovery.
- Dynamic status dùng text và semantic ngoài color, rồi announce mà không steal focus.
- Multi-error validation giữ input và chuyển focus tới summary.
- Task parity gồm exposure current/disputed; call draft/sent/agreed; collateral held/pending/released; asset eligible/ineligible/conditionally eligible; price or FX current/stale; concentration inside/exceeded; coverage short/sufficient/excess; substitution proposed/matched/settling/failed/complete; custodian acknowledged/rejected; dispute open/resolved; call closed/reopened.

## State obligations

Task-specific states: exposure current/disputed; call draft/sent/agreed; collateral held/pending/released; asset eligible/ineligible/conditionally eligible; price or FX current/stale; concentration inside/exceeded; coverage short/sufficient/excess; substitution proposed/matched/settling/failed/complete; custodian acknowledged/rejected; dispute open/resolved; call closed/reopened.

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

- Calculate a call, reject ineligible and concentration-breaching assets, apply haircut and FX, form a sufficient ordered substitution pair, block early release, recover settlement failure, and close fully covered.
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject capacity-allocation-overview, dual-list-transfer, waitlist-offer-allocation-board, or inventory-replenishment-planner when agreement-specific requirement, adjusted eligibility, concentration, held state, deliver-before-release dependency, and custodian proof are absent.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CMS-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth không chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [BCBS-IOSCO margin requirements](https://www.bis.org/bcbs/publ/d499.htm) | Margin, eligible collateral, haircuts, and risk-control context. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [BCBS-IOSCO 2025 implementation review](https://www.bis.org/bcbs/publ/d606.htm) | Current implementation evidence and operational margin context. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [SWIFT securities settlement and reconciliation](https://www.swift.com/securities/settlement-and-reconciliation) | Collateral-exchange settlement and acknowledgement context. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [W3C Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Single-pointer and keyboard alternatives to drag allocation. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Announcements for coverage and settlement state. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `collateral-margin-call-substitution-workbench`. |
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
{"archetypeId":"collateral-margin-call-substitution-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```

