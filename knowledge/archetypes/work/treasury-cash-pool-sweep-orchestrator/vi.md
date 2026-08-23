# Treasury cash pool sweep orchestrator

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `treasury-cash-pool-sweep-orchestrator` |
| Family | Work |
| Dominant task | Di chuyển một nhóm bank account về target balance đã khai báo qua directed physical cash-pool hierarchy, tuân sweep precedence, cutoff, currency conversion, intercompany-loan evidence và bank acknowledgement. |
| Search aliases | physical cash pool, target balance sweep, account graph orchestration |
| Authority | Page-topology authority trung lập sản phẩm; không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `cash-pool-sweep` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Mọi sweep đi qua authorized directed edge, mutate projection của cả hai endpoint, tạo loan/FX consequence trước dependent edge và chỉ final khi bank acknowledge.
- Mỗi required region giữ named owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft input, pending work, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-TCS-01` | Di chuyển một nhóm bank account về target balance đã khai báo qua directed physical cash-pool hierarchy, tuân sweep precedence, cutoff, currency conversion, intercompany-loan evidence và bank acknowledgement. | Positive evidence bắt buộc. |
| `AR-TCS-02` | Mọi required region và relationship đều cần để complete. | Yêu cầu complete graph. |
| `AR-TCS-03` | Ba transformation wide, intermediate và compact giữ cùng work state. | Yêu cầu responsive parity. |
| `AR-TCS-04` | Failure, pending, conflict, permission hoặc recovery có thể xảy ra sau khi state tồn tại. | Giữ state và focus meaning. |
| `AR-TCS-90` | Adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |
| `AR-TCS-91` | Reject multicurrency-netting-settlement-workbench, dual-list-transfer, capacity-allocation-overview, or generic payment queues when directed node/edge authority, target bands, dependent sweeps, two-endpoint mutations, intercompany consequences, and bank acknowledgements are absent. | Reject. |
| `AR-TCS-92` | Candidate chỉ khác noun, density, color, component, card count hoặc state variation. | Reject thành `duplicate-or-variation`. |

### Selection rule

Chọn `treasury-cash-pool-sweep-orchestrator` khi và chỉ khi có evidence cho `AR-TCS-01` đến `04`, đủ mọi required region và relationship, và không có `AR-TCS-90` đến `92`. Trả `needs-evidence` khi dominant task, owner relationship, overflow owner hoặc completion consequence chưa được chứng minh. Trả `reject` khi có rejection code.

## Region graph

```text
cash-pool-sweep
  ├─ entity-bank-business-date-policy-and-cutoff-version
  ├─ bank-account-node-graph
  ├─ observed-and-projected-node-balances
  ├─ target-minimum-maximum-and-trapped-cash-constraints
  ├─ directed-zero-balance-target-balance-and-concentration-edges
  ├─ precedence-ordered-sweep-and-fx-plan
  ├─ intercompany-loan-principal-interest-and-limit-ledger
  ├─ bank-instruction-acknowledgement-and-reject-stream
  └─ achieved-targets-residuals-and-close-receipt
```

Mọi sweep đi qua authorized directed edge, mutate projection của cả hai endpoint, tạo loan/FX consequence trước dependent edge và chỉ final khi bank acknowledge.

### Region obligations

| Region | Owner và relationship obligation |
|---|---|
| `cash-pool-sweep` | Sở hữu toàn bộ task account-graph feasibility, sweep, acknowledgement và close. |
| `entity-bank-business-date-policy-and-cutoff-version` | Ràng buộc graph vào entity, bank, business date, policy và cutoff version. |
| `bank-account-node-graph` | Sở hữu account node và directed authorized connectivity. |
| `observed-and-projected-node-balances` | Sở hữu current và projected balance evidence theo node. |
| `target-minimum-maximum-and-trapped-cash-constraints` | Sở hữu target band và feasibility constraint theo node. |
| `directed-zero-balance-target-balance-and-concentration-edges` | Sở hữu authorized movement edge và edge type. |
| `precedence-ordered-sweep-and-fx-plan` | Sắp thứ tự dependent sweep cùng required FX effect. |
| `intercompany-loan-principal-interest-and-limit-ledger` | Ghi both-endpoint intercompany consequence trước downstream movement. |
| `bank-instruction-acknowledgement-and-reject-stream` | Sở hữu instruction, acknowledgement, rejection và reroute evidence. |
| `achieved-targets-residuals-and-close-receipt` | Chứng minh achieved target, accepted residual và close state của toàn graph. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison không còn đủ measure cho profile, evidence, control và unobscured focus.
- **Topology response:** Account graph, target deltas, ordered edges, FX effect, loan ledger, bank acknowledgement stream, and whole-pool receipt remain visible together.
- **Navigation replacement:** Không có khi direct region access còn operable.
- **Sticky boundary:** Chỉ current scope hoặc primary receipt được persist sau khi reserve space.
- **Overflow owner:** Một region nội tại là table hoặc graph được own bounded overflow; page không own horizontal overflow.

### Intermediate

- **Failure trigger:** Lowest-priority support không còn coexist mà không compress dominant relationship.
- **Topology response:** Critical residuals and the active sweep edge remain primary; full hierarchy, account evidence, and closed-day history move to synchronized drawers.
- **Navigation replacement:** Labeled contextual drawer mở đúng support region và giữ selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary receipt được persist; short height trả về normal flow.
- **Overflow owner:** Cùng bounded evidence region vẫn là overflow owner duy nhất.

### Compact

- **Failure trigger:** Peer region không còn cùng lúc readable và operable.
- **Topology response:** Cutoff and pool → breached node → authorized upstream/downstream edge → both endpoint and loan/FX preview → instruct → acknowledge or reject → recalculate graph; the network becomes a node-and-edge route with a persistent feasibility receipt.
- **Navigation replacement:** Labeled stage navigator expose một primary pane mỗi lần và đưa focus tới heading của stage.
- **Sticky boundary:** Relationship receipt chỉ được persist khi reserve space và yield ở short height.
- **Overflow owner:** Numeric table thành labeled route hoặc một bounded navigator; page không horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order theo `cash-pool-sweep → entity-bank-business-date-policy-and-cutoff-version → bank-account-node-graph → observed-and-projected-node-balances → target-minimum-maximum-and-trapped-cash-constraints → directed-zero-balance-target-balance-and-concentration-edges → precedence-ordered-sweep-and-fx-plan → intercompany-loan-principal-interest-and-limit-ledger → bank-instruction-acknowledgement-and-reject-stream → achieved-targets-residuals-and-close-receipt`.
- CSS không reorder semantic content.
- Long label, translation, enlarged text và zoom wrap mà không mất action hoặc state.
- Modal drawer focus heading, giữ modal focus, hỗ trợ Escape và Cancel, rồi trả về exact trigger.

### Interaction parity

- Pointer, keyboard và assistive technology chạm được mọi core action.
- Drag hoặc gesture có alternative add, remove hoặc ordered list.
- Topology change giữ selection, completed step, pending guard, error và recovery.
- Dynamic status dùng text và semantic ngoài color, rồi announce mà không steal focus.
- Multi-error validation giữ input và chuyển focus tới summary.
- Task parity gồm balance observed/projected/stale; account active/blocked/trapped; target inside/breached/unreachable; edge authorized/conditional/disabled; cutoff open/near/closed; sweep proposed/instructed/acknowledged/rejected; FX current/stale; loan capacity available/exceeded; pool feasible/partially feasible/infeasible; residual accepted/escalated; day open/closed/reopened.

## State obligations

Task-specific states: balance observed/projected/stale; account active/blocked/trapped; target inside/breached/unreachable; edge authorized/conditional/disabled; cutoff open/near/closed; sweep proposed/instructed/acknowledged/rejected; FX current/stale; loan capacity available/exceeded; pool feasible/partially feasible/infeasible; residual accepted/escalated; day open/closed/reopened.

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

- Model a directed multilevel account graph, resolve breached and trapped nodes through authorized precedence, preview both endpoints and loan/FX effects, process bank responses, and close with explicit residuals.
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject multicurrency-netting-settlement-workbench, dual-list-transfer, capacity-allocation-overview, or generic payment queues when directed node/edge authority, target bands, dependent sweeps, two-endpoint mutations, intercompany consequences, and bank acknowledgements are absent.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-TCS-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth không chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [OECD financial-transactions transfer-pricing guidance](https://www.oecd.org/en/publications/transfer-pricing-guidance-on-financial-transactions-inclusive-framework-on-beps-actions-4-8-10_794bcddd-en.html) | Cash-pooling and intercompany financial-transaction evidence. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [CPMI-IOSCO Principles for Financial Market Infrastructures](https://www.bis.org/cpmi/publ/d101a.htm) | Operational-risk, settlement, and acknowledgement context. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful order through node, edge, instruction, and recovery stages. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Announcements for bank acknowledgement and residual recalculation. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual treatment. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `treasury-cash-pool-sweep-orchestrator`. |
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
{"archetypeId":"treasury-cash-pool-sweep-orchestrator","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```

