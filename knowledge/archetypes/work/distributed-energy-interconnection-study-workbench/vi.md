# Distributed Energy Interconnection Study Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `distributed-energy-interconnection-study-workbench` |
| Family | Work |
| Dominant task | Quyết định một dự án DER có thể đấu nối tại một điểm feeder hay không bằng cách đi đúng thứ tự screen, chỉ chạy study case đã được mở khóa và xử lý mọi ô phần-tử-feeder × case vi phạm bằng điều kiện hoặc nâng cấp đã kiểm thử. |
| Search aliases | `distributed`, `energy`, `interconnection`, `study`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Quyết định một dự án DER có thể đấu nối tại một điểm feeder hay không bằng cách đi đúng thứ tự screen, chỉ chạy study case đã được mở khóa và xử lý mọi ô phần-tử-feeder × case vi phạm bằng điều kiện hoặc nâng cấp đã kiểm thử.
- Required region graph luôn là `interconnection-study → project-export-envelope-and-rule-version → point-of-interconnection → ordered-source-to-feeder-point-element-path ↔ model-input-completeness → ordered-technical-screen-gates → unlocked-study-case-set → feeder-element-by-case-violation-matrix → selected-cell-electrical-evidence → mitigation-or-upgrade-and-rerun → cost-schedule-owner-and-conditional-verdict → agreement-conditions-and-model-receipt`.
- Quan hệ bắt buộc luôn là: screen order controls case eligibility, while the matrix preserves the exact feeder element and operating case behind every condition.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must select a feeder point, traverse its ordered element path, block a downstream study until prerequisite screens finish, populate at least two cases across multiple elements, trace one violating cell, validate its mitigation by rerun and issue a conditional verdict with explicit export envelope and upgrade owner.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-04-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-04-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-04-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-04-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-04-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-04-90` | Dominant task thực chất là `waitlist-offer-allocation-board`. | Reject. |
| `AR-B13-04-91` | Dominant task thực chất là `regulatory-filing-package-validator`. | Reject. |
| `AR-B13-04-92` | Dominant task thực chất là `jurisdiction-authority-resolution`. | Reject. |
| `AR-B13-04-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `distributed-energy-interconnection-study-workbench` chỉ khi `AR-B13-04-01` đến `AR-B13-04-05` đều có bằng chứng và không có mã `AR-B13-04-90` đến `AR-B13-04-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
interconnection-study
└─ project-export-envelope-and-rule-version
   └─ point-of-interconnection
      └─ ordered-source-to-feeder-point-element-path
         ↔─ model-input-completeness
            └─ ordered-technical-screen-gates
               └─ unlocked-study-case-set
                  └─ feeder-element-by-case-violation-matrix
                     └─ selected-cell-electrical-evidence
                        └─ mitigation-or-upgrade-and-rerun
                           └─ cost-schedule-owner-and-conditional-verdict
                              └─ agreement-conditions-and-model-receipt
```

- Required relationship: screen order controls case eligibility, while the matrix preserves the exact feeder element and operating case behind every condition.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `interconnection-study` | Sở hữu bằng chứng, state và action cho interconnection study mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `project-export-envelope-and-rule-version` | Sở hữu bằng chứng, state và action cho project export envelope and rule version mà không mượn product semantics. | Theo sau `interconnection-study` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `point-of-interconnection` | Sở hữu bằng chứng, state và action cho point of interconnection mà không mượn product semantics. | Theo sau `project-export-envelope-and-rule-version` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `ordered-source-to-feeder-point-element-path` | Sở hữu bằng chứng, state và action cho ordered source to feeder point element path mà không mượn product semantics. | Theo sau `point-of-interconnection` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `model-input-completeness` | Sở hữu bằng chứng, state và action cho model input completeness mà không mượn product semantics. | Đồng bộ hai chiều với `ordered-source-to-feeder-point-element-path` trong cùng selection context. |
| `ordered-technical-screen-gates` | Sở hữu bằng chứng, state và action cho ordered technical screen gates mà không mượn product semantics. | Theo sau `model-input-completeness` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `unlocked-study-case-set` | Sở hữu bằng chứng, state và action cho unlocked study case set mà không mượn product semantics. | Theo sau `ordered-technical-screen-gates` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `feeder-element-by-case-violation-matrix` | Sở hữu bằng chứng, state và action cho feeder element by case violation matrix mà không mượn product semantics. | Theo sau `unlocked-study-case-set` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `selected-cell-electrical-evidence` | Sở hữu bằng chứng, state và action cho selected cell electrical evidence mà không mượn product semantics. | Theo sau `feeder-element-by-case-violation-matrix` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `mitigation-or-upgrade-and-rerun` | Sở hữu bằng chứng, state và action cho mitigation or upgrade and rerun mà không mượn product semantics. | Theo sau `selected-cell-electrical-evidence` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `cost-schedule-owner-and-conditional-verdict` | Sở hữu bằng chứng, state và action cho cost schedule owner and conditional verdict mà không mượn product semantics. | Theo sau `mitigation-or-upgrade-and-rerun` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `agreement-conditions-and-model-receipt` | Sở hữu bằng chứng, state và action cho agreement conditions and model receipt mà không mượn product semantics. | Theo sau `cost-schedule-owner-and-conditional-verdict` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Feeder-point path, ordered screen gates, element×case violation matrix, selected evidence, mitigation rerun and conditional verdict remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The current screen or selected element×case violation remains primary; feeder context, complete case matrix, input manifest and agreement conditions move to synchronized routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Project envelope → feeder point and ordered element path → next required screen → unlocked study case → violating element×case cell → mitigation/rerun → owner and condition → verdict; the map becomes a feeder-path sequence and the matrix becomes a scoped case route rather than stacked tables.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `interconnection-study → project-export-envelope-and-rule-version → point-of-interconnection → ordered-source-to-feeder-point-element-path ↔ model-input-completeness → ordered-technical-screen-gates → unlocked-study-case-set → feeder-element-by-case-violation-matrix → selected-cell-electrical-evidence → mitigation-or-upgrade-and-rerun → cost-schedule-owner-and-conditional-verdict → agreement-conditions-and-model-receipt`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must select a feeder point, traverse its ordered element path, block a downstream study until prerequisite screens finish, populate at least two cases across multiple elements, trace one violating cell, validate its mitigation by rerun and issue a conditional verdict with explicit export envelope and upgrade owner.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `project-export-envelope-and-rule-version` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `point-of-interconnection` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `ordered-source-to-feeder-point-element-path` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `model-input-completeness` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `ordered-technical-screen-gates` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `cost-schedule-owner-and-conditional-verdict` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `agreement-conditions-and-model-receipt` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `project-export-envelope-and-rule-version` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `agreement-conditions-and-model-receipt` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `interconnection-study` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: application incomplete/ready/withdrawn, feeder model current/stale/restricted, screen locked/not-required/queued/running/pass/fail/indeterminate, study case locked/nonconvergent/complete, element×case cell within/violating/waived, mitigation untested/validated, upgrade estimate draft/accepted/disputed, restudy triggered and agreement issued/expired.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Quyết định một dự án DER có thể đấu nối tại một điểm feeder hay không bằng cách đi đúng thứ tự screen, chỉ chạy study case đã được mở khóa và xử lý mọi ô phần-tử-feeder × case vi phạm bằng điều kiện hoặc nâng cấp đã kiểm thử.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `waitlist-offer-allocation-board`, `regulatory-filing-package-validator`, `jurisdiction-authority-resolution` or generic hosting-capacity map; a point-specific ordered feeder path, prerequisite screen cascade, element×case violation matrix, tested mitigation rerun and owned engineering condition are mandatory.
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
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DOE DER Interconnection Roadmap](https://www.energy.gov/cmei/i2x/doe-distributed-energy-resource-interconnection-roadmap) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IEEE 1547-2018](https://standards.ieee.org/ieee/1547/5915/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DOE hosting-capacity atlas](https://www.energy.gov/cmei/vehicles/us-atlas-electric-distribution-system-hosting-capacity-maps) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "distributed-energy-interconnection-study-workbench",
  "situationCodes": [
    "<matched AR-B13-04-* codes>"
  ],
  "searchAliases": [
    "distributed",
    "energy",
    "interconnection",
    "study",
    "workbench"
  ],
  "dominantTask": "Determine whether one distributed-energy project can interconnect at one feeder point by traversing the mandated screen order, running only the study cases unlocked by prior outcomes and resolving every violating feeder-element-by-case cell through a tested condition or upgrade.",
  "regions": [
    "interconnection-study",
    "project-export-envelope-and-rule-version",
    "point-of-interconnection",
    "ordered-source-to-feeder-point-element-path",
    "model-input-completeness",
    "ordered-technical-screen-gates",
    "unlocked-study-case-set",
    "feeder-element-by-case-violation-matrix",
    "selected-cell-electrical-evidence",
    "mitigation-or-upgrade-and-rerun",
    "cost-schedule-owner-and-conditional-verdict",
    "agreement-conditions-and-model-receipt"
  ],
  "relationships": [
    "screen order controls case eligibility, while the matrix preserves the exact feeder element and operating case behind every condition."
  ],
  "responsive": {
    "wide": "Feeder-point path, ordered screen gates, element×case violation matrix, selected evidence, mitigation rerun and conditional verdict remain simultaneously visible.",
    "intermediate": "The current screen or selected element×case violation remains primary; feeder context, complete case matrix, input manifest and agreement conditions move to synchronized routes.",
    "compact": "Project envelope → feeder point and ordered element path → next required screen → unlocked study case → violating element×case cell → mitigation/rerun → owner and condition → verdict; the map becomes a feeder-path sequence and the matrix becomes a scoped case route rather than stacked tables.",
    "reflow": [
      "interconnection-study",
      "project-export-envelope-and-rule-version",
      "point-of-interconnection",
      "ordered-source-to-feeder-point-element-path",
      "model-input-completeness",
      "ordered-technical-screen-gates",
      "unlocked-study-case-set",
      "feeder-element-by-case-violation-matrix",
      "selected-cell-electrical-evidence",
      "mitigation-or-upgrade-and-rerun",
      "cost-schedule-owner-and-conditional-verdict",
      "agreement-conditions-and-model-receipt"
    ]
  },
  "stateObligations": "application incomplete/ready/withdrawn, feeder model current/stale/restricted, screen locked/not-required/queued/running/pass/fail/indeterminate, study case locked/nonconvergent/complete, element×case cell within/violating/waived, mitigation untested/validated, upgrade estimate draft/accepted/disputed, restudy triggered and agreement issued/expired.",
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
