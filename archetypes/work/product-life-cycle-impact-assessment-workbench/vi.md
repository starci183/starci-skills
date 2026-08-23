# Product Life Cycle Impact Assessment Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `product-life-cycle-impact-assessment-workbench` |
| Family | Work |
| Dominant task | Thực hiện và phản biện một LCA sản phẩm bằng cách cố định functional unit và reference flow, vạch system boundary rõ ràng, giải quyết allocation/cutoff và chuyển inventory flow đã chuẩn hóa qua characterization factor có phiên bản thành kết quả tác động được diễn giải. |
| Search aliases | `product`, `cycle`, `impact`, `assessment`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Thực hiện và phản biện một LCA sản phẩm bằng cách cố định functional unit và reference flow, vạch system boundary rõ ràng, giải quyết allocation/cutoff và chuyển inventory flow đã chuẩn hóa qua characterization factor có phiên bản thành kết quả tác động được diễn giải.
- Required region graph luôn là `life-cycle-assessment → goal-scope-functional-unit-reference-flow-and-method-version → product-system-boundary-and-process-network → functional-unit-normalized-inventory-flow-ledger → multifunction-process-allocation-and-cutoff-decision-register → elementary-flow-to-characterization-factor-matrix → impact-category-results → process-flow-and-decision-contribution-hotspots → sensitivity-uncertainty-and-interpretation → independent-critical-review-issues-and-study-release`.
- Quan hệ bắt buộc luôn là: functional-unit scaling precedes inventory comparison, boundary/allocation/cutoff decisions own included flows and characterization maps each elementary flow into category-specific potential impacts.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must set a functional unit/reference flow, include or exclude one process with visible inventory consequence, resolve one multifunction allocation and one cutoff decision, trace an elementary flow through versioned factors into two impact categories, reveal a sensitivity-dependent interpretation and block release until critical review closes.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-15-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-15-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-15-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-15-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-15-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-15-90` | Dominant task thực chất là `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-15-91` | Dominant task thực chất là `bridge-contribution-waterfall-overview`. | Reject. |
| `AR-B13-15-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `product-life-cycle-impact-assessment-workbench` chỉ khi `AR-B13-15-01` đến `AR-B13-15-05` đều có bằng chứng và không có mã `AR-B13-15-90` đến `AR-B13-15-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
life-cycle-assessment
└─ goal-scope-functional-unit-reference-flow-and-method-version
   └─ product-system-boundary-and-process-network
      └─ functional-unit-normalized-inventory-flow-ledger
         └─ multifunction-process-allocation-and-cutoff-decision-register
            └─ elementary-flow-to-characterization-factor-matrix
               └─ impact-category-results
                  └─ process-flow-and-decision-contribution-hotspots
                     └─ sensitivity-uncertainty-and-interpretation
                        └─ independent-critical-review-issues-and-study-release
```

- Required relationship: functional-unit scaling precedes inventory comparison, boundary/allocation/cutoff decisions own included flows and characterization maps each elementary flow into category-specific potential impacts.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `life-cycle-assessment` | Sở hữu bằng chứng, state và action cho life cycle assessment mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `goal-scope-functional-unit-reference-flow-and-method-version` | Sở hữu bằng chứng, state và action cho goal scope functional unit reference flow and method version mà không mượn product semantics. | Theo sau `life-cycle-assessment` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `product-system-boundary-and-process-network` | Sở hữu bằng chứng, state và action cho product system boundary and process network mà không mượn product semantics. | Theo sau `goal-scope-functional-unit-reference-flow-and-method-version` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `functional-unit-normalized-inventory-flow-ledger` | Sở hữu bằng chứng, state và action cho functional unit normalized inventory flow ledger mà không mượn product semantics. | Theo sau `product-system-boundary-and-process-network` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `multifunction-process-allocation-and-cutoff-decision-register` | Sở hữu bằng chứng, state và action cho multifunction process allocation and cutoff decision register mà không mượn product semantics. | Theo sau `functional-unit-normalized-inventory-flow-ledger` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `elementary-flow-to-characterization-factor-matrix` | Sở hữu bằng chứng, state và action cho elementary flow to characterization factor matrix mà không mượn product semantics. | Theo sau `multifunction-process-allocation-and-cutoff-decision-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `impact-category-results` | Sở hữu bằng chứng, state và action cho impact category results mà không mượn product semantics. | Theo sau `elementary-flow-to-characterization-factor-matrix` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `process-flow-and-decision-contribution-hotspots` | Sở hữu bằng chứng, state và action cho process flow and decision contribution hotspots mà không mượn product semantics. | Theo sau `impact-category-results` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `sensitivity-uncertainty-and-interpretation` | Sở hữu bằng chứng, state và action cho sensitivity uncertainty and interpretation mà không mượn product semantics. | Theo sau `process-flow-and-decision-contribution-hotspots` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `independent-critical-review-issues-and-study-release` | Sở hữu bằng chứng, state và action cho independent critical review issues and study release mà không mượn product semantics. | Theo sau `sensitivity-uncertainty-and-interpretation` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Functional unit/reference flow, system boundary, normalized inventory, allocation/cutoff decisions, characterization lineage, impact results and critical-review issues remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The selected impact category and its flow-to-factor lineage remain primary; boundary, allocation/cutoff decision and review issue stay synchronized while the complete process network and other categories move to routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Goal and functional unit → reference flow and system boundary → inventory flow → allocation/cutoff decision → characterization factor and category result → sensitivity/interpretation → critical-review issue → release; the process network transforms into a semantic boundary path rather than starting from a hotspot card.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `life-cycle-assessment → goal-scope-functional-unit-reference-flow-and-method-version → product-system-boundary-and-process-network → functional-unit-normalized-inventory-flow-ledger → multifunction-process-allocation-and-cutoff-decision-register → elementary-flow-to-characterization-factor-matrix → impact-category-results → process-flow-and-decision-contribution-hotspots → sensitivity-uncertainty-and-interpretation → independent-critical-review-issues-and-study-release`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must set a functional unit/reference flow, include or exclude one process with visible inventory consequence, resolve one multifunction allocation and one cutoff decision, trace an elementary flow through versioned factors into two impact categories, reveal a sensitivity-dependent interpretation and block release until critical review closes.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `goal-scope-functional-unit-reference-flow-and-method-version` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `product-system-boundary-and-process-network` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `functional-unit-normalized-inventory-flow-ledger` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `multifunction-process-allocation-and-cutoff-decision-register` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `elementary-flow-to-characterization-factor-matrix` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `sensitivity-uncertainty-and-interpretation` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `independent-critical-review-issues-and-study-release` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `goal-scope-functional-unit-reference-flow-and-method-version` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `independent-critical-review-issues-and-study-release` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `life-cycle-assessment` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: goal/scope incomplete/approved, functional unit invalid/changed, reference flow unresolved/resolved, process in/out/boundary-disputed, flow missing/estimated/measured, allocation unresolved/selected, cutoff proposed/accepted/rejected, factor unavailable/current/superseded, characterization queued/failed/complete, hotspot stable/sensitivity-dependent, uncertainty high, critical review open/cleared and study released/revised.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Thực hiện và phản biện một LCA sản phẩm bằng cách cố định functional unit và reference flow, vạch system boundary rõ ràng, giải quyết allocation/cutoff và chuyển inventory flow đã chuẩn hóa qua characterization factor có phiên bản thành kết quả tác động được diễn giải.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `process-mass-balance-analyzer`, `bridge-contribution-waterfall-overview`, systematic evidence synthesis or chart authoring; functional-unit normalization, explicit product-system boundary, allocation and cutoff authority, elementary-flow characterization and independent critical review are mandatory.
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
| [ISO 14040:2006](https://www.iso.org/standard/37456.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA TRACI](https://www.epa.gov/chemical-research/tool-reduction-and-assessment-chemicals-and-other-environmental-impacts-traci) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [European Commission Environmental Footprint methods](https://green-forum.ec.europa.eu/environmental-footprint-methods_en) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "product-life-cycle-impact-assessment-workbench",
  "situationCodes": [
    "<matched AR-B13-15-* codes>"
  ],
  "searchAliases": [
    "product",
    "cycle",
    "impact",
    "assessment",
    "workbench"
  ],
  "dominantTask": "Perform and critically review one product life-cycle assessment by fixing a functional unit and reference flow, drawing an explicit product-system boundary, resolving allocation and cutoff choices, and transforming normalized inventory flows through versioned characterization factors into interpreted impact results.",
  "regions": [
    "life-cycle-assessment",
    "goal-scope-functional-unit-reference-flow-and-method-version",
    "product-system-boundary-and-process-network",
    "functional-unit-normalized-inventory-flow-ledger",
    "multifunction-process-allocation-and-cutoff-decision-register",
    "elementary-flow-to-characterization-factor-matrix",
    "impact-category-results",
    "process-flow-and-decision-contribution-hotspots",
    "sensitivity-uncertainty-and-interpretation",
    "independent-critical-review-issues-and-study-release"
  ],
  "relationships": [
    "functional-unit scaling precedes inventory comparison, boundary/allocation/cutoff decisions own included flows and characterization maps each elementary flow into category-specific potential impacts."
  ],
  "responsive": {
    "wide": "Functional unit/reference flow, system boundary, normalized inventory, allocation/cutoff decisions, characterization lineage, impact results and critical-review issues remain simultaneously visible.",
    "intermediate": "The selected impact category and its flow-to-factor lineage remain primary; boundary, allocation/cutoff decision and review issue stay synchronized while the complete process network and other categories move to routes.",
    "compact": "Goal and functional unit → reference flow and system boundary → inventory flow → allocation/cutoff decision → characterization factor and category result → sensitivity/interpretation → critical-review issue → release; the process network transforms into a semantic boundary path rather than starting from a hotspot card.",
    "reflow": [
      "life-cycle-assessment",
      "goal-scope-functional-unit-reference-flow-and-method-version",
      "product-system-boundary-and-process-network",
      "functional-unit-normalized-inventory-flow-ledger",
      "multifunction-process-allocation-and-cutoff-decision-register",
      "elementary-flow-to-characterization-factor-matrix",
      "impact-category-results",
      "process-flow-and-decision-contribution-hotspots",
      "sensitivity-uncertainty-and-interpretation",
      "independent-critical-review-issues-and-study-release"
    ]
  },
  "stateObligations": "goal/scope incomplete/approved, functional unit invalid/changed, reference flow unresolved/resolved, process in/out/boundary-disputed, flow missing/estimated/measured, allocation unresolved/selected, cutoff proposed/accepted/rejected, factor unavailable/current/superseded, characterization queued/failed/complete, hotspot stable/sensitivity-dependent, uncertainty high, critical review open/cleared and study released/revised.",
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
