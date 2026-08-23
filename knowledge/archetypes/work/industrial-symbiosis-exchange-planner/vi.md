# Industrial Symbiosis Exchange Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `industrial-symbiosis-exchange-planner` |
| Family | Work |
| Dominant task | Thiết kế một trao đổi tài nguyên liên cơ sở khả thi bằng cách ghép output stream của một cơ sở với input specification của cơ sở khác theo số lượng, chất lượng, thời điểm, vị trí, tiền xử lý, lưu trữ, logistics và cam kết đối ứng. |
| Search aliases | `industrial`, `symbiosis`, `exchange`, `planner` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Thiết kế một trao đổi tài nguyên liên cơ sở khả thi bằng cách ghép output stream của một cơ sở với input specification của cơ sở khác theo số lượng, chất lượng, thời điểm, vị trí, tiền xử lý, lưu trữ, logistics và cam kết đối ứng.
- Required region graph luôn là `symbiosis-planner → park-region-and-participant-roster → offered-output-stream-catalog ↔ required-input-specification-catalog → quantity-quality-time-location-compatibility → preprocessing-storage-and-logistics-chain → candidate-bilateral-or-multilateral-exchanges → substituted-input-and-residual-output-balance → participant-commitments-and-contingencies → baseline-monitoring-and-exchange-activation`.
- Quan hệ bắt buộc luôn là: resource compatibility and conserved substitution/residual quantities jointly own feasibility.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must match one offered stream to a need, expose a quality mismatch, add preprocessing and storage, reconcile substituted and residual quantities, obtain both facility commitments and suspend the exchange when supply timing violates its contingency.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-16-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-16-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-16-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-16-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-16-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-16-90` | Dominant task thực chất là `dual-list-transfer`. | Reject. |
| `AR-B13-16-91` | Dominant task thực chất là `inventory-replenishment-planner`. | Reject. |
| `AR-B13-16-92` | Dominant task thực chất là `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-16-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `industrial-symbiosis-exchange-planner` chỉ khi `AR-B13-16-01` đến `AR-B13-16-05` đều có bằng chứng và không có mã `AR-B13-16-90` đến `AR-B13-16-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
symbiosis-planner
└─ park-region-and-participant-roster
   └─ offered-output-stream-catalog
      ↔─ required-input-specification-catalog
         └─ quantity-quality-time-location-compatibility
            └─ preprocessing-storage-and-logistics-chain
               └─ candidate-bilateral-or-multilateral-exchanges
                  └─ substituted-input-and-residual-output-balance
                     └─ participant-commitments-and-contingencies
                        └─ baseline-monitoring-and-exchange-activation
```

- Required relationship: resource compatibility and conserved substitution/residual quantities jointly own feasibility.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `symbiosis-planner` | Sở hữu bằng chứng, state và action cho symbiosis planner mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `park-region-and-participant-roster` | Sở hữu bằng chứng, state và action cho park region and participant roster mà không mượn product semantics. | Theo sau `symbiosis-planner` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `offered-output-stream-catalog` | Sở hữu bằng chứng, state và action cho offered output stream catalog mà không mượn product semantics. | Theo sau `park-region-and-participant-roster` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `required-input-specification-catalog` | Sở hữu bằng chứng, state và action cho required input specification catalog mà không mượn product semantics. | Đồng bộ hai chiều với `offered-output-stream-catalog` trong cùng selection context. |
| `quantity-quality-time-location-compatibility` | Sở hữu bằng chứng, state và action cho quantity quality time location compatibility mà không mượn product semantics. | Theo sau `required-input-specification-catalog` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `preprocessing-storage-and-logistics-chain` | Sở hữu bằng chứng, state và action cho preprocessing storage and logistics chain mà không mượn product semantics. | Theo sau `quantity-quality-time-location-compatibility` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `candidate-bilateral-or-multilateral-exchanges` | Sở hữu bằng chứng, state và action cho candidate bilateral or multilateral exchanges mà không mượn product semantics. | Theo sau `preprocessing-storage-and-logistics-chain` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `substituted-input-and-residual-output-balance` | Sở hữu bằng chứng, state và action cho substituted input and residual output balance mà không mượn product semantics. | Theo sau `candidate-bilateral-or-multilateral-exchanges` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `participant-commitments-and-contingencies` | Sở hữu bằng chứng, state và action cho participant commitments and contingencies mà không mượn product semantics. | Theo sau `substituted-input-and-residual-output-balance` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `baseline-monitoring-and-exchange-activation` | Sở hữu bằng chứng, state và action cho baseline monitoring and exchange activation mà không mượn product semantics. | Theo sau `participant-commitments-and-contingencies` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Offer/need catalogs, compatibility evidence, selected exchange chain, residual balance and participant commitments remain visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** Ranked feasible exchanges and selected chain remain primary; complete catalogs, map and contingency history move to drawers.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Input need or output offer → compatibility evidence → quality/quantity gap → preprocessing/logistics → bilateral commitments → substituted input/residual receipt → activate; catalogs become scoped search routes.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `symbiosis-planner → park-region-and-participant-roster → offered-output-stream-catalog ↔ required-input-specification-catalog → quantity-quality-time-location-compatibility → preprocessing-storage-and-logistics-chain → candidate-bilateral-or-multilateral-exchanges → substituted-input-and-residual-output-balance → participant-commitments-and-contingencies → baseline-monitoring-and-exchange-activation`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must match one offered stream to a need, expose a quality mismatch, add preprocessing and storage, reconcile substituted and residual quantities, obtain both facility commitments and suspend the exchange when supply timing violates its contingency.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `park-region-and-participant-roster` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `offered-output-stream-catalog` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `required-input-specification-catalog` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `quantity-quality-time-location-compatibility` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `preprocessing-storage-and-logistics-chain` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `participant-commitments-and-contingencies` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `baseline-monitoring-and-exchange-activation` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `park-region-and-participant-roster` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `baseline-monitoring-and-exchange-activation` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `symbiosis-planner` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: stream unknown/available/intermittent/withdrawn, specification incomplete/validated, match incompatible/conditional/feasible, sample pending/pass/fail, quantity shortfall/surplus, preprocessing unavailable/confirmed, logistics constrained, participant invited/committed/declined, contingency triggered and exchange pilot/active/suspended/closed.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Thiết kế một trao đổi tài nguyên liên cơ sở khả thi bằng cách ghép output stream của một cơ sở với input specification của cơ sở khác theo số lượng, chất lượng, thời điểm, vị trí, tiền xử lý, lưu trữ, logistics và cam kết đối ứng.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `dual-list-transfer`, `inventory-replenishment-planner`, scoped federated search or `process-mass-balance-analyzer`; independently owned output and input specifications, cross-facility compatibility, transformation/logistics chain, reciprocal commitments and residual substitution balance are mandatory.
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
| [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [UNIDO Implementation Handbook for Eco-Industrial Parks](https://www.unido.org/learning-resources/implementation-handbook-eco-industrial-parks) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [UNIDO Eco-Industrial Park publications](https://hub.unido.org/eco-industrial-parks-publications) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [UNIDO/World Bank/GIZ practitioner handbook](https://ipp.unido.org/sites/default/files/knowledge/2022-06/English.pdf) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "industrial-symbiosis-exchange-planner",
  "situationCodes": [
    "<matched AR-B13-16-* codes>"
  ],
  "searchAliases": [
    "industrial",
    "symbiosis",
    "exchange",
    "planner"
  ],
  "dominantTask": "Design a feasible cross-facility resource exchange by matching one facility's output stream to another's input specification across quantity, quality, timing, location, preprocessing, storage, logistics and reciprocal commitments.",
  "regions": [
    "symbiosis-planner",
    "park-region-and-participant-roster",
    "offered-output-stream-catalog",
    "required-input-specification-catalog",
    "quantity-quality-time-location-compatibility",
    "preprocessing-storage-and-logistics-chain",
    "candidate-bilateral-or-multilateral-exchanges",
    "substituted-input-and-residual-output-balance",
    "participant-commitments-and-contingencies",
    "baseline-monitoring-and-exchange-activation"
  ],
  "relationships": [
    "resource compatibility and conserved substitution/residual quantities jointly own feasibility."
  ],
  "responsive": {
    "wide": "Offer/need catalogs, compatibility evidence, selected exchange chain, residual balance and participant commitments remain visible.",
    "intermediate": "Ranked feasible exchanges and selected chain remain primary; complete catalogs, map and contingency history move to drawers.",
    "compact": "Input need or output offer → compatibility evidence → quality/quantity gap → preprocessing/logistics → bilateral commitments → substituted input/residual receipt → activate; catalogs become scoped search routes.",
    "reflow": [
      "symbiosis-planner",
      "park-region-and-participant-roster",
      "offered-output-stream-catalog",
      "required-input-specification-catalog",
      "quantity-quality-time-location-compatibility",
      "preprocessing-storage-and-logistics-chain",
      "candidate-bilateral-or-multilateral-exchanges",
      "substituted-input-and-residual-output-balance",
      "participant-commitments-and-contingencies",
      "baseline-monitoring-and-exchange-activation"
    ]
  },
  "stateObligations": "stream unknown/available/intermittent/withdrawn, specification incomplete/validated, match incompatible/conditional/feasible, sample pending/pass/fail, quantity shortfall/surplus, preprocessing unavailable/confirmed, logistics constrained, participant invited/committed/declined, contingency triggered and exchange pilot/active/suspended/closed.",
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
