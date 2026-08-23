# Bridge Defect Load Rating Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `bridge-defect-load-rating-workbench` |
| Family | Work |
| Dominant task | Chuyển khuyết tật cầu đã đo thành sức kháng cấu kiện và hiệu ứng tải đã cập nhật, xác định cấu kiện cùng vehicle case chi phối và ban hành quyết định rating, posting, sửa chữa hoặc kiểm tra lại. |
| Search aliases | `bridge`, `defect`, `rating`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Chuyển khuyết tật cầu đã đo thành sức kháng cấu kiện và hiệu ứng tải đã cập nhật, xác định cấu kiện cùng vehicle case chi phối và ban hành quyết định rating, posting, sửa chữa hoặc kiểm tra lại.
- Required region graph luôn là `bridge-rating → bridge-version-and-inspection-scope → component-hierarchy ↔ defect-location-measurement-and-evidence → section-and-member-property-reduction → rating-vehicle-and-load-effect-cases → capacity-demand-factor-ledger → controlling-member-and-load-path → posting-repair-or-reinspection-scenarios → engineer-review-and-versioned-rating`.
- Quan hệ bắt buộc luôn là: each rating result must trace through one load case and defect-adjusted component capacity.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must select a measured defect, reduce the affected section property, rerun two load cases, expose the governing factor and component, compare posting with repair and preserve the engineer-approved rating version.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-11-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-11-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-11-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-11-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-11-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-11-90` | Dominant task thực chất là `finite-element-mesh-convergence-workbench`. | Reject. |
| `AR-B13-11-91` | Dominant task thực chất là `evidence-led-case-resolution-dossier`. | Reject. |
| `AR-B13-11-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `bridge-defect-load-rating-workbench` chỉ khi `AR-B13-11-01` đến `AR-B13-11-05` đều có bằng chứng và không có mã `AR-B13-11-90` đến `AR-B13-11-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
bridge-rating
└─ bridge-version-and-inspection-scope
   └─ component-hierarchy
      ↔─ defect-location-measurement-and-evidence
         └─ section-and-member-property-reduction
            └─ rating-vehicle-and-load-effect-cases
               └─ capacity-demand-factor-ledger
                  └─ controlling-member-and-load-path
                     └─ posting-repair-or-reinspection-scenarios
                        └─ engineer-review-and-versioned-rating
```

- Required relationship: each rating result must trace through one load case and defect-adjusted component capacity.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `bridge-rating` | Sở hữu bằng chứng, state và action cho bridge rating mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `bridge-version-and-inspection-scope` | Sở hữu bằng chứng, state và action cho bridge version and inspection scope mà không mượn product semantics. | Theo sau `bridge-rating` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `component-hierarchy` | Sở hữu bằng chứng, state và action cho component hierarchy mà không mượn product semantics. | Theo sau `bridge-version-and-inspection-scope` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `defect-location-measurement-and-evidence` | Sở hữu bằng chứng, state và action cho defect location measurement and evidence mà không mượn product semantics. | Đồng bộ hai chiều với `component-hierarchy` trong cùng selection context. |
| `section-and-member-property-reduction` | Sở hữu bằng chứng, state và action cho section and member property reduction mà không mượn product semantics. | Theo sau `defect-location-measurement-and-evidence` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `rating-vehicle-and-load-effect-cases` | Sở hữu bằng chứng, state và action cho rating vehicle and load effect cases mà không mượn product semantics. | Theo sau `section-and-member-property-reduction` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `capacity-demand-factor-ledger` | Sở hữu bằng chứng, state và action cho capacity demand factor ledger mà không mượn product semantics. | Theo sau `rating-vehicle-and-load-effect-cases` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `controlling-member-and-load-path` | Sở hữu bằng chứng, state và action cho controlling member and load path mà không mượn product semantics. | Theo sau `capacity-demand-factor-ledger` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `posting-repair-or-reinspection-scenarios` | Sở hữu bằng chứng, state và action cho posting repair or reinspection scenarios mà không mượn product semantics. | Theo sau `controlling-member-and-load-path` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `engineer-review-and-versioned-rating` | Sở hữu bằng chứng, state và action cho engineer review and versioned rating mà không mượn product semantics. | Theo sau `posting-repair-or-reinspection-scenarios` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Component hierarchy, defect evidence, rating cases, capacity-demand factors and decision scenarios remain visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** Controlling component, evidence and rating result remain primary; bridge overview, all load cases and decision history move to drawers.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Bridge → controlling component → defect measurement → adjusted property → governing vehicle/load case → rating factor → post, repair or reinspect; drawing selection has a component-list alternative.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `bridge-rating → bridge-version-and-inspection-scope → component-hierarchy ↔ defect-location-measurement-and-evidence → section-and-member-property-reduction → rating-vehicle-and-load-effect-cases → capacity-demand-factor-ledger → controlling-member-and-load-path → posting-repair-or-reinspection-scenarios → engineer-review-and-versioned-rating`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must select a measured defect, reduce the affected section property, rerun two load cases, expose the governing factor and component, compare posting with repair and preserve the engineer-approved rating version.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `bridge-version-and-inspection-scope` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `component-hierarchy` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `defect-location-measurement-and-evidence` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `section-and-member-property-reduction` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `rating-vehicle-and-load-effect-cases` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `posting-repair-or-reinspection-scenarios` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `engineer-review-and-versioned-rating` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `bridge-version-and-inspection-scope` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `engineer-review-and-versioned-rating` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `bridge-rating` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: inspection current/overdue/incomplete, defect unconfirmed/measured/progressing, evidence loading/unavailable, component property provisional/approved, load case queued/running/invalid, rating pass/restricted/critical, controlling case changed, posting proposed/issued, repair scenario unverified and engineer review signed/rejected/superseded.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Chuyển khuyết tật cầu đã đo thành sức kháng cấu kiện và hiệu ứng tải đã cập nhật, xác định cấu kiện cùng vehicle case chi phối và ban hành quyết định rating, posting, sửa chữa hoặc kiểm tra lại.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `finite-element-mesh-convergence-workbench`, `evidence-led-case-resolution-dossier`, portfolio health or generic structural viewer; inspection-located deterioration, defect-adjusted member capacity, code-defined rating vehicles, a controlling load path and an issued operational rating are mandatory.
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
| [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FHWA Bridge Load Rating](https://www.fhwa.dot.gov/bridge/loadrating/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FHWA Bridge Inspection resources](https://www.fhwa.dot.gov/bridge/inspection/index.cfm) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "bridge-defect-load-rating-workbench",
  "situationCodes": [
    "<matched AR-B13-11-* codes>"
  ],
  "searchAliases": [
    "bridge",
    "defect",
    "rating",
    "workbench"
  ],
  "dominantTask": "Convert measured bridge defects into updated member capacity and load effects, identify the controlling component and vehicle case, and issue a load rating, posting, repair or inspection decision.",
  "regions": [
    "bridge-rating",
    "bridge-version-and-inspection-scope",
    "component-hierarchy",
    "defect-location-measurement-and-evidence",
    "section-and-member-property-reduction",
    "rating-vehicle-and-load-effect-cases",
    "capacity-demand-factor-ledger",
    "controlling-member-and-load-path",
    "posting-repair-or-reinspection-scenarios",
    "engineer-review-and-versioned-rating"
  ],
  "relationships": [
    "each rating result must trace through one load case and defect-adjusted component capacity."
  ],
  "responsive": {
    "wide": "Component hierarchy, defect evidence, rating cases, capacity-demand factors and decision scenarios remain visible.",
    "intermediate": "Controlling component, evidence and rating result remain primary; bridge overview, all load cases and decision history move to drawers.",
    "compact": "Bridge → controlling component → defect measurement → adjusted property → governing vehicle/load case → rating factor → post, repair or reinspect; drawing selection has a component-list alternative.",
    "reflow": [
      "bridge-rating",
      "bridge-version-and-inspection-scope",
      "component-hierarchy",
      "defect-location-measurement-and-evidence",
      "section-and-member-property-reduction",
      "rating-vehicle-and-load-effect-cases",
      "capacity-demand-factor-ledger",
      "controlling-member-and-load-path",
      "posting-repair-or-reinspection-scenarios",
      "engineer-review-and-versioned-rating"
    ]
  },
  "stateObligations": "inspection current/overdue/incomplete, defect unconfirmed/measured/progressing, evidence loading/unavailable, component property provisional/approved, load case queued/running/invalid, rating pass/restricted/critical, controlling case changed, posting proposed/issued, repair scenario unverified and engineer review signed/rejected/superseded.",
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
