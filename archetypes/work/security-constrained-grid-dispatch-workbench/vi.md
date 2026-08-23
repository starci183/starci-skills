# Security Constrained Grid Dispatch Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `security-constrained-grid-dispatch-workbench` |
| Family | Work |
| Dominant task | Tạo và giải thích một phương án điều độ khả thi cho một khoảng vận hành, cân bằng injection–withdrawal tại mọi nút, giữ giới hạn nguồn lực và dự phòng trong base case lẫn contingency, đồng thời truy được hệ quả nghẽn đến đúng phần tử ràng buộc. |
| Search aliases | `security`, `constrained`, `dispatch`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Tạo và giải thích một phương án điều độ khả thi cho một khoảng vận hành, cân bằng injection–withdrawal tại mọi nút, giữ giới hạn nguồn lực và dự phòng trong base case lẫn contingency, đồng thời truy được hệ quả nghẽn đến đúng phần tử ràng buộc.
- Required region graph luôn là `grid-dispatch → operating-interval-state-estimate-and-network-version → node-injection-withdrawal-balance-ledger ↔ resource-offer-ramp-capacity-and-reserve-register → base-and-contingency-branch-flow-constraint-cube → feasible-resource-and-load-dispatch → nodal-balance-and-reserve-receipt → binding-element-contingency-and-congestion-attribution → nodal-price-and-resource-impact-explanation → approve-publish-and-rerun`.
- Quan hệ bắt buộc luôn là: nodal conservation owns feasibility, while each congestion component names the contingency, monitored element and affected nodes/resources that caused it.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must alter one resource limit, expose a binding monitored-element/contingency pair, rebalance affected nodes through a feasible redispatch, prove system and reserve conservation, attribute one congestion component to that exact pair and retain the superseded interval solution.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-03-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-03-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-03-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-03-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-03-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-03-90` | Dominant task thực chất là `capacity-allocation-overview`. | Reject. |
| `AR-B13-03-91` | Dominant task thực chất là `scenario-sensitivity-modeler`. | Reject. |
| `AR-B13-03-92` | Dominant task thực chất là `market-depth-order-entry-monitor`. | Reject. |
| `AR-B13-03-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `security-constrained-grid-dispatch-workbench` chỉ khi `AR-B13-03-01` đến `AR-B13-03-05` đều có bằng chứng và không có mã `AR-B13-03-90` đến `AR-B13-03-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
grid-dispatch
└─ operating-interval-state-estimate-and-network-version
   └─ node-injection-withdrawal-balance-ledger
      ↔─ resource-offer-ramp-capacity-and-reserve-register
         └─ base-and-contingency-branch-flow-constraint-cube
            └─ feasible-resource-and-load-dispatch
               └─ nodal-balance-and-reserve-receipt
                  └─ binding-element-contingency-and-congestion-attribution
                     └─ nodal-price-and-resource-impact-explanation
                        └─ approve-publish-and-rerun
```

- Required relationship: nodal conservation owns feasibility, while each congestion component names the contingency, monitored element and affected nodes/resources that caused it.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `grid-dispatch` | Sở hữu bằng chứng, state và action cho grid dispatch mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `operating-interval-state-estimate-and-network-version` | Sở hữu bằng chứng, state và action cho operating interval state estimate and network version mà không mượn product semantics. | Theo sau `grid-dispatch` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `node-injection-withdrawal-balance-ledger` | Sở hữu bằng chứng, state và action cho node injection withdrawal balance ledger mà không mượn product semantics. | Theo sau `operating-interval-state-estimate-and-network-version` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `resource-offer-ramp-capacity-and-reserve-register` | Sở hữu bằng chứng, state và action cho resource offer ramp capacity and reserve register mà không mượn product semantics. | Đồng bộ hai chiều với `node-injection-withdrawal-balance-ledger` trong cùng selection context. |
| `base-and-contingency-branch-flow-constraint-cube` | Sở hữu bằng chứng, state và action cho base and contingency branch flow constraint cube mà không mượn product semantics. | Theo sau `resource-offer-ramp-capacity-and-reserve-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `feasible-resource-and-load-dispatch` | Sở hữu bằng chứng, state và action cho feasible resource and load dispatch mà không mượn product semantics. | Theo sau `base-and-contingency-branch-flow-constraint-cube` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `nodal-balance-and-reserve-receipt` | Sở hữu bằng chứng, state và action cho nodal balance and reserve receipt mà không mượn product semantics. | Theo sau `feasible-resource-and-load-dispatch` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `binding-element-contingency-and-congestion-attribution` | Sở hữu bằng chứng, state và action cho binding element contingency and congestion attribution mà không mượn product semantics. | Theo sau `nodal-balance-and-reserve-receipt` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `nodal-price-and-resource-impact-explanation` | Sở hữu bằng chứng, state và action cho nodal price and resource impact explanation mà không mượn product semantics. | Theo sau `binding-element-contingency-and-congestion-attribution` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `approve-publish-and-rerun` | Sở hữu bằng chứng, state và action cho approve publish and rerun mà không mượn product semantics. | Theo sau `nodal-price-and-resource-impact-explanation` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Nodal balance ledger, resource limits, base/contingency constraint cube, dispatch solution, reserve receipt and congestion attribution remain simultaneously inspectable.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** Dispatch quantities, selected node and binding element-contingency pair remain primary; complete topology, offers and other contingency cases move to contextual routes while causal attribution stays synchronized.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Operating interval → unbalanced node or binding element-contingency pair → contributing injections/withdrawals and resource limits → corrective redispatch → nodal and reserve receipt → congestion attribution → publish or rerun; node/resource matrices transform into one causal constraint path with scoped lists.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `grid-dispatch → operating-interval-state-estimate-and-network-version → node-injection-withdrawal-balance-ledger ↔ resource-offer-ramp-capacity-and-reserve-register → base-and-contingency-branch-flow-constraint-cube → feasible-resource-and-load-dispatch → nodal-balance-and-reserve-receipt → binding-element-contingency-and-congestion-attribution → nodal-price-and-resource-impact-explanation → approve-publish-and-rerun`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must alter one resource limit, expose a binding monitored-element/contingency pair, rebalance affected nodes through a feasible redispatch, prove system and reserve conservation, attribute one congestion component to that exact pair and retain the superseded interval solution.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `operating-interval-state-estimate-and-network-version` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `node-injection-withdrawal-balance-ledger` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `resource-offer-ramp-capacity-and-reserve-register` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `base-and-contingency-branch-flow-constraint-cube` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `feasible-resource-and-load-dispatch` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `nodal-price-and-resource-impact-explanation` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `approve-publish-and-rerun` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `operating-interval-state-estimate-and-network-version` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `approve-publish-and-rerun` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `grid-dispatch` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: state estimate loading/stale/invalid, node balanced/unbalanced, demand forecast current/revised, offer accepted/mitigated/unavailable, resource ramp- or capacity-limited, contingency pending/active/invalid, monitored element within/binding/exceeded, solve queued/running/infeasible/feasible, reserve shortfall, congestion attribution complete/disputed, dispatch published/superseded and manual intervention audited.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Tạo và giải thích một phương án điều độ khả thi cho một khoảng vận hành, cân bằng injection–withdrawal tại mọi nút, giữ giới hạn nguồn lực và dự phòng trong base case lẫn contingency, đồng thời truy được hệ quả nghẽn đến đúng phần tử ràng buộc.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `capacity-allocation-overview`, `scenario-sensitivity-modeler`, `market-depth-order-entry-monitor` or generic live operations; simultaneous nodal balance, base-and-contingency network constraints, dispatchable resource limits, reserve receipt and element-plus-contingency congestion attribution are mandatory.
- Reject candidate chỉ khác product noun, count, density, color, component hoặc state dưới verdict `duplicate-or-variation`.

### Boundary verdict

Trả `accept` chỉ khi dominant task, complete region graph, mandatory owner relationship và compact interaction parity đều đúng. Trả `reject` cho mọi rejection code. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa resolve.

## Handoff

- **Grammar handoff:** Gắn product-specific owner, label, permission, action và truthful state meaning vào các region đã khai báo.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow và relationship-driven transition point.
- Không handoff nào được xóa required region, đổi dominant task hoặc làm yếu interaction parity.

## Non-binding research evidence

### Evidence boundary

External research chỉ là advisory evidence, không phải product truth. Nó hỗ trợ task relationship, adaptive behavior và accessibility obligation; nó không đặt tên StarCi owner, không chọn exact geometry và không cấp quyền copy source interface. Các nguồn là trang chính thức hiện hành được kiểm chứng trong batch này.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Fluent 2 layout](https://fluent2.microsoft.design/layout) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WAI-ARIA Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FERC 2024 Energy Primer](https://www.ferc.gov/media/energy-primer-handbook-energy-market-basics) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [PJM Manual 11](https://learn.pjm.com/pjmfiles/directory/manuals/m11/index.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NERC BAL-002-3](https://www.nerc.com/standards/reliability-standards/bal/bal-002-3) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "security-constrained-grid-dispatch-workbench",
  "situationCodes": [
    "<matched AR-B13-03-* codes>"
  ],
  "searchAliases": [
    "security",
    "constrained",
    "dispatch",
    "workbench"
  ],
  "dominantTask": "Produce and explain one feasible operating-interval dispatch whose injection-withdrawal equation balances at every modeled node, whose resource and reserve limits hold in the base case and required contingencies, and whose congestion consequences trace to exact binding elements.",
  "regions": [
    "grid-dispatch",
    "operating-interval-state-estimate-and-network-version",
    "node-injection-withdrawal-balance-ledger",
    "resource-offer-ramp-capacity-and-reserve-register",
    "base-and-contingency-branch-flow-constraint-cube",
    "feasible-resource-and-load-dispatch",
    "nodal-balance-and-reserve-receipt",
    "binding-element-contingency-and-congestion-attribution",
    "nodal-price-and-resource-impact-explanation",
    "approve-publish-and-rerun"
  ],
  "relationships": [
    "nodal conservation owns feasibility, while each congestion component names the contingency, monitored element and affected nodes/resources that caused it."
  ],
  "responsive": {
    "wide": "Nodal balance ledger, resource limits, base/contingency constraint cube, dispatch solution, reserve receipt and congestion attribution remain simultaneously inspectable.",
    "intermediate": "Dispatch quantities, selected node and binding element-contingency pair remain primary; complete topology, offers and other contingency cases move to contextual routes while causal attribution stays synchronized.",
    "compact": "Operating interval → unbalanced node or binding element-contingency pair → contributing injections/withdrawals and resource limits → corrective redispatch → nodal and reserve receipt → congestion attribution → publish or rerun; node/resource matrices transform into one causal constraint path with scoped lists.",
    "reflow": [
      "grid-dispatch",
      "operating-interval-state-estimate-and-network-version",
      "node-injection-withdrawal-balance-ledger",
      "resource-offer-ramp-capacity-and-reserve-register",
      "base-and-contingency-branch-flow-constraint-cube",
      "feasible-resource-and-load-dispatch",
      "nodal-balance-and-reserve-receipt",
      "binding-element-contingency-and-congestion-attribution",
      "nodal-price-and-resource-impact-explanation",
      "approve-publish-and-rerun"
    ]
  },
  "stateObligations": "state estimate loading/stale/invalid, node balanced/unbalanced, demand forecast current/revised, offer accepted/mitigated/unavailable, resource ramp- or capacity-limited, contingency pending/active/invalid, monitored element within/binding/exceeded, solve queued/running/infeasible/feasible, reserve shortfall, congestion attribution complete/disputed, dispatch published/superseded and manual intervention audited.",
  "boundaryVerdict": "accept | reject | needs-evidence | duplicate-or-variation",
  "grammarHandoff": "Bind product-specific owners, labels, permissions, actions, and truthful states.",
  "principlesHandoff": "Resolve exact geometry, measure, spacing, alignment, overflow, and relationship-driven transitions.",
  "confidence": "high | medium | low",
  "evidenceClasses": [
    "dominant-task",
    "region-graph",
    "responsive-parity",
    "state-family",
    "boundary",
    "official-research"
  ]
}
```
