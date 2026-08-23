# Earthwork Cut Fill Mass Haul Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `earthwork-cut-fill-mass-haul-planner` |
| Family | Work |
| Dominant task | Lập và phê duyệt kế hoạch vận chuyển đất theo giai đoạn thi công, nối nguồn đào với nhu cầu đắp tương thích dọc tuyến, bảo toàn thể tích đã hiệu chỉnh và làm rõ balance point, haul limit, borrow, waste cùng stockpile. |
| Search aliases | `earthwork`, `planner` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Lập và phê duyệt kế hoạch vận chuyển đất theo giai đoạn thi công, nối nguồn đào với nhu cầu đắp tương thích dọc tuyến, bảo toàn thể tích đã hiệu chỉnh và làm rõ balance point, haul limit, borrow, waste cùng stockpile.
- Required region graph luôn là `mass-haul-planner → alignment-design-version-and-construction-stage → station-range-cut-and-fill-quantity-ledger → material-class-suitability-and-shrink-swell-adjustment → cumulative-mass-curve-and-balance-points ↔ haul-path-cost-barrier-and-stage-access-network → cut-source-to-fill-demand-movement-plan → borrow-waste-and-stockpile-options → plant-environmental-and-sequencing-constraints → revised-movement-plan-and-adjusted-volume-receipt → approved-earthwork-sequence-and-export`.
- Quan hệ bắt buộc luôn là: cumulative balance constrains how much material can move between station ranges, while suitability and access determine which source-to-demand edges are legal.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must edit cut and fill quantities across multiple station ranges, reject an unsuitable source, apply a visible shrink/swell factor, route compatible material around one haul barrier, update the cumulative balance point, expose borrow or waste for the remaining deficit/surplus and refuse approval until adjusted source, destination, stockpile and residual volumes reconcile.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-12-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-12-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-12-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-12-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-12-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-12-90` | Dominant task thực chất là `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-12-91` | Dominant task thực chất là `constrained-quota-allocation-editor`. | Reject. |
| `AR-B13-12-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `earthwork-cut-fill-mass-haul-planner` chỉ khi `AR-B13-12-01` đến `AR-B13-12-05` đều có bằng chứng và không có mã `AR-B13-12-90` đến `AR-B13-12-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
mass-haul-planner
└─ alignment-design-version-and-construction-stage
   └─ station-range-cut-and-fill-quantity-ledger
      └─ material-class-suitability-and-shrink-swell-adjustment
         └─ cumulative-mass-curve-and-balance-points
            ↔─ haul-path-cost-barrier-and-stage-access-network
               └─ cut-source-to-fill-demand-movement-plan
                  └─ borrow-waste-and-stockpile-options
                     └─ plant-environmental-and-sequencing-constraints
                        └─ revised-movement-plan-and-adjusted-volume-receipt
                           └─ approved-earthwork-sequence-and-export
```

- Required relationship: cumulative balance constrains how much material can move between station ranges, while suitability and access determine which source-to-demand edges are legal.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `mass-haul-planner` | Sở hữu bằng chứng, state và action cho mass haul planner mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `alignment-design-version-and-construction-stage` | Sở hữu bằng chứng, state và action cho alignment design version and construction stage mà không mượn product semantics. | Theo sau `mass-haul-planner` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `station-range-cut-and-fill-quantity-ledger` | Sở hữu bằng chứng, state và action cho station range cut and fill quantity ledger mà không mượn product semantics. | Theo sau `alignment-design-version-and-construction-stage` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `material-class-suitability-and-shrink-swell-adjustment` | Sở hữu bằng chứng, state và action cho material class suitability and shrink swell adjustment mà không mượn product semantics. | Theo sau `station-range-cut-and-fill-quantity-ledger` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `cumulative-mass-curve-and-balance-points` | Sở hữu bằng chứng, state và action cho cumulative mass curve and balance points mà không mượn product semantics. | Theo sau `material-class-suitability-and-shrink-swell-adjustment` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `haul-path-cost-barrier-and-stage-access-network` | Sở hữu bằng chứng, state và action cho haul path cost barrier and stage access network mà không mượn product semantics. | Đồng bộ hai chiều với `cumulative-mass-curve-and-balance-points` trong cùng selection context. |
| `cut-source-to-fill-demand-movement-plan` | Sở hữu bằng chứng, state và action cho cut source to fill demand movement plan mà không mượn product semantics. | Theo sau `haul-path-cost-barrier-and-stage-access-network` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `borrow-waste-and-stockpile-options` | Sở hữu bằng chứng, state và action cho borrow waste and stockpile options mà không mượn product semantics. | Theo sau `cut-source-to-fill-demand-movement-plan` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `plant-environmental-and-sequencing-constraints` | Sở hữu bằng chứng, state và action cho plant environmental and sequencing constraints mà không mượn product semantics. | Theo sau `borrow-waste-and-stockpile-options` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `revised-movement-plan-and-adjusted-volume-receipt` | Sở hữu bằng chứng, state và action cho revised movement plan and adjusted volume receipt mà không mượn product semantics. | Theo sau `plant-environmental-and-sequencing-constraints` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `approved-earthwork-sequence-and-export` | Sở hữu bằng chứng, state và action cho approved earthwork sequence and export mà không mượn product semantics. | Theo sau `revised-movement-plan-and-adjusted-volume-receipt` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Alignment quantities, cumulative mass curve, selected source-to-fill movement, haul network, material suitability and conserved-volume receipt remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The active balance segment and selected source-fill pair remain primary; full alignment, other stages, plant options and movement history move to synchronized routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Construction stage → deficit fill range → compatible cut source and adjusted volume → haul route/barriers → balance point and haul quantity → borrow/waste/stockpile consequence → conserved receipt → commit movement; the longitudinal diagram transforms into a station-range ledger and one source-to-demand path rather than a miniature chart stack.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `mass-haul-planner → alignment-design-version-and-construction-stage → station-range-cut-and-fill-quantity-ledger → material-class-suitability-and-shrink-swell-adjustment → cumulative-mass-curve-and-balance-points ↔ haul-path-cost-barrier-and-stage-access-network → cut-source-to-fill-demand-movement-plan → borrow-waste-and-stockpile-options → plant-environmental-and-sequencing-constraints → revised-movement-plan-and-adjusted-volume-receipt → approved-earthwork-sequence-and-export`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must edit cut and fill quantities across multiple station ranges, reject an unsuitable source, apply a visible shrink/swell factor, route compatible material around one haul barrier, update the cumulative balance point, expose borrow or waste for the remaining deficit/surplus and refuse approval until adjusted source, destination, stockpile and residual volumes reconcile.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `alignment-design-version-and-construction-stage` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `station-range-cut-and-fill-quantity-ledger` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `material-class-suitability-and-shrink-swell-adjustment` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `cumulative-mass-curve-and-balance-points` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `haul-path-cost-barrier-and-stage-access-network` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `revised-movement-plan-and-adjusted-volume-receipt` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `approved-earthwork-sequence-and-export` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `alignment-design-version-and-construction-stage` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `approved-earthwork-sequence-and-export` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `mass-haul-planner` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: design current/superseded, stage locked/open/complete, quantity missing/current/recalculated, material suitable/conditional/unsuitable, shrink-swell factor provisional/approved, balance segment surplus/deficit/balanced, haul path open/constrained/blocked, movement draft/feasible/overallocated, stockpile unavailable/ready/full, borrow or waste unapproved/approved, volume receipt balanced/unbalanced and sequence draft/approved/revised.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Lập và phê duyệt kế hoạch vận chuyển đất theo giai đoạn thi công, nối nguồn đào với nhu cầu đắp tương thích dọc tuyến, bảo toàn thể tích đã hiệu chỉnh và làm rõ balance point, haul limit, borrow, waste cùng stockpile.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `process-mass-balance-analyzer`, `constrained-quota-allocation-editor`, transport network assignment, timeline scheduler or generic cost optimization; station-indexed cut/fill quantities, material transformations, a cumulative mass curve with balance points, explicit cut-to-fill haul edges, stage-access limits and borrow/waste/stockpile consequences are mandatory.
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
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FHWA Earthwork Representation Guide](https://highways.fhwa.dot.gov/federal-lands/design/tools/cfl/earthwork-representation-guide.pdf) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Caltrans Construction Manual — Earthwork](https://dot.ca.gov/programs/construction/construction-manual/section-4-19-earthwork) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [UK Planning Inspectorate A12 mass-haul technical note](https://nsip-documents.planninginspectorate.gov.uk/published-documents/TR010060-001649-9-12-Borrow-Pits-Supplementary-Technical-Note-13842-1.pdf) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "earthwork-cut-fill-mass-haul-planner",
  "situationCodes": [
    "<matched AR-B13-12-* codes>"
  ],
  "searchAliases": [
    "earthwork",
    "planner"
  ],
  "dominantTask": "Build and approve a construction-stage earthwork movement plan that connects compatible cut sources to fill demands along an alignment, preserves adjusted material volume and exposes balance points, haul limits, borrow, waste and stockpile consequences.",
  "regions": [
    "mass-haul-planner",
    "alignment-design-version-and-construction-stage",
    "station-range-cut-and-fill-quantity-ledger",
    "material-class-suitability-and-shrink-swell-adjustment",
    "cumulative-mass-curve-and-balance-points",
    "haul-path-cost-barrier-and-stage-access-network",
    "cut-source-to-fill-demand-movement-plan",
    "borrow-waste-and-stockpile-options",
    "plant-environmental-and-sequencing-constraints",
    "revised-movement-plan-and-adjusted-volume-receipt",
    "approved-earthwork-sequence-and-export"
  ],
  "relationships": [
    "cumulative balance constrains how much material can move between station ranges, while suitability and access determine which source-to-demand edges are legal."
  ],
  "responsive": {
    "wide": "Alignment quantities, cumulative mass curve, selected source-to-fill movement, haul network, material suitability and conserved-volume receipt remain simultaneously visible.",
    "intermediate": "The active balance segment and selected source-fill pair remain primary; full alignment, other stages, plant options and movement history move to synchronized routes.",
    "compact": "Construction stage → deficit fill range → compatible cut source and adjusted volume → haul route/barriers → balance point and haul quantity → borrow/waste/stockpile consequence → conserved receipt → commit movement; the longitudinal diagram transforms into a station-range ledger and one source-to-demand path rather than a miniature chart stack.",
    "reflow": [
      "mass-haul-planner",
      "alignment-design-version-and-construction-stage",
      "station-range-cut-and-fill-quantity-ledger",
      "material-class-suitability-and-shrink-swell-adjustment",
      "cumulative-mass-curve-and-balance-points",
      "haul-path-cost-barrier-and-stage-access-network",
      "cut-source-to-fill-demand-movement-plan",
      "borrow-waste-and-stockpile-options",
      "plant-environmental-and-sequencing-constraints",
      "revised-movement-plan-and-adjusted-volume-receipt",
      "approved-earthwork-sequence-and-export"
    ]
  },
  "stateObligations": "design current/superseded, stage locked/open/complete, quantity missing/current/recalculated, material suitable/conditional/unsuitable, shrink-swell factor provisional/approved, balance segment surplus/deficit/balanced, haul path open/constrained/blocked, movement draft/feasible/overallocated, stockpile unavailable/ready/full, borrow or waste unapproved/approved, volume receipt balanced/unbalanced and sequence draft/approved/revised.",
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
