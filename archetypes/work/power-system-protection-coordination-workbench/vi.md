# Power System Protection Coordination Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `power-system-protection-coordination-workbench` |
| Family | Work |
| Dominant task | Cấu hình và kiểm chứng thông số thiết bị bảo vệ để mọi sự cố điện đi theo đúng một chuỗi tác động lồng nhau từ bảo vệ chính đến dự phòng, mọi cặp thiết bị kề nhau giữ đủ biên chọn lọc và toàn bộ tập sự cố vẫn phối hợp sau mỗi thay đổi. |
| Search aliases | `power`, `system`, `protection`, `coordination`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Cấu hình và kiểm chứng thông số thiết bị bảo vệ để mọi sự cố điện đi theo đúng một chuỗi tác động lồng nhau từ bảo vệ chính đến dự phòng, mọi cặp thiết bị kề nhau giữ đủ biên chọn lọc và toàn bộ tập sự cố vẫn phối hợp sau mỗi thay đổi.
- Required region graph luôn là `protection-coordination → one-line-and-study-case → fault-location-and-nested-primary-backup-trip-paths → protection-zone-and-device-chain ↔ time-current-selectivity-view → selected-device-settings → adjacent-pair-selectivity-margin-ledger → all-fault-sweep-and-miscoordination-queue → approved-setting-package`.
- Quan hệ bắt buộc luôn là: each fault owns an ordered nested trip chain, each chain owns pairwise margin checks and only the all-fault sweep may approve the shared package.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must select a fault, traverse at least three nested primary/backup devices, expose numeric margin for every adjacent pair, edit one setting through labeled controls, reveal a regression on another fault during the complete sweep and restore the prior approved package.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-01-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-01-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-01-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-01-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-01-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-01-90` | Dominant task thực chất là `dependency-topology-monitor`. | Reject. |
| `AR-B13-01-91` | Dominant task thực chất là `rule-builder-workbench`. | Reject. |
| `AR-B13-01-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `power-system-protection-coordination-workbench` chỉ khi `AR-B13-01-01` đến `AR-B13-01-05` đều có bằng chứng và không có mã `AR-B13-01-90` đến `AR-B13-01-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
protection-coordination
└─ one-line-and-study-case
   └─ fault-location-and-nested-primary-backup-trip-paths
      └─ protection-zone-and-device-chain
         ↔─ time-current-selectivity-view
            └─ selected-device-settings
               └─ adjacent-pair-selectivity-margin-ledger
                  └─ all-fault-sweep-and-miscoordination-queue
                     └─ approved-setting-package
```

- Required relationship: each fault owns an ordered nested trip chain, each chain owns pairwise margin checks and only the all-fault sweep may approve the shared package.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `protection-coordination` | Sở hữu bằng chứng, state và action cho protection coordination mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `one-line-and-study-case` | Sở hữu bằng chứng, state và action cho one line and study case mà không mượn product semantics. | Theo sau `protection-coordination` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `fault-location-and-nested-primary-backup-trip-paths` | Sở hữu bằng chứng, state và action cho fault location and nested primary backup trip paths mà không mượn product semantics. | Theo sau `one-line-and-study-case` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `protection-zone-and-device-chain` | Sở hữu bằng chứng, state và action cho protection zone and device chain mà không mượn product semantics. | Theo sau `fault-location-and-nested-primary-backup-trip-paths` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `time-current-selectivity-view` | Sở hữu bằng chứng, state và action cho time current selectivity view mà không mượn product semantics. | Đồng bộ hai chiều với `protection-zone-and-device-chain` trong cùng selection context. |
| `selected-device-settings` | Sở hữu bằng chứng, state và action cho selected device settings mà không mượn product semantics. | Theo sau `time-current-selectivity-view` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `adjacent-pair-selectivity-margin-ledger` | Sở hữu bằng chứng, state và action cho adjacent pair selectivity margin ledger mà không mượn product semantics. | Theo sau `selected-device-settings` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `all-fault-sweep-and-miscoordination-queue` | Sở hữu bằng chứng, state và action cho all fault sweep and miscoordination queue mà không mượn product semantics. | Theo sau `adjacent-pair-selectivity-margin-ledger` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `approved-setting-package` | Sở hữu bằng chứng, state và action cho approved setting package mà không mượn product semantics. | Theo sau `all-fault-sweep-and-miscoordination-queue` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** One-line topology, selected nested trip path, time-current evidence, settings editor, pairwise margin ledger and all-fault sweep status remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The selected fault path and active primary-backup pair remain primary; other pair curves, setting provenance and the sweep queue move to synchronized drawers without changing the fault context.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Study case → fault location → nested device chain → one adjacent primary-backup pair → curve and numeric margin evidence → setting change → every remaining pair on the path → all-fault sweep → approve or rollback; the whole one-line becomes a semantic trip-path route rather than stacked desktop regions.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `protection-coordination → one-line-and-study-case → fault-location-and-nested-primary-backup-trip-paths → protection-zone-and-device-chain ↔ time-current-selectivity-view → selected-device-settings → adjacent-pair-selectivity-margin-ledger → all-fault-sweep-and-miscoordination-queue → approved-setting-package`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must select a fault, traverse at least three nested primary/backup devices, expose numeric margin for every adjacent pair, edit one setting through labeled controls, reveal a regression on another fault during the complete sweep and restore the prior approved package.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `one-line-and-study-case` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `fault-location-and-nested-primary-backup-trip-paths` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `protection-zone-and-device-chain` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `time-current-selectivity-view` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `selected-device-settings` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `all-fault-sweep-and-miscoordination-queue` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `approved-setting-package` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `one-line-and-study-case` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `approved-setting-package` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `protection-coordination` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: model loading/invalid, study case current/stale, fault calculated/failed, trip path complete/ambiguous, device in-service/bypassed/unknown, primary-backup pair coordinated/marginal/miscoordinated, setting draft/invalid/pending approval, sweep queued/running/partial/complete/regressed and package approved/rejected/rolled back.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Cấu hình và kiểm chứng thông số thiết bị bảo vệ để mọi sự cố điện đi theo đúng một chuỗi tác động lồng nhau từ bảo vệ chính đến dự phòng, mọi cặp thiết bị kề nhau giữ đủ biên chọn lọc và toàn bộ tập sự cố vẫn phối hợp sau mỗi thay đổi.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `dependency-topology-monitor`, `rule-builder-workbench`, constrained allocation, traffic-signal timing or a generic one-line viewer; nested electrical fault paths, protection zones, time-current or equivalent selectivity evidence, pairwise margins across every adjacent device and one all-fault validation sweep are mandatory.
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
| [Fluent 2 layout](https://fluent2.microsoft.design/layout) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NERC PRC-027-1](https://www.nerc.com/standards/reliability-standards/prc/prc-027-1) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DOE integrated distribution system planning](https://www.energy.gov/oe/integrated-distribution-system-planning) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "power-system-protection-coordination-workbench",
  "situationCodes": [
    "<matched AR-B13-01-* codes>"
  ],
  "searchAliases": [
    "power",
    "system",
    "protection",
    "coordination",
    "workbench"
  ],
  "dominantTask": "Configure and validate protective-device settings so every modeled electrical fault follows one nested primary-to-backup trip path, every adjacent device pair preserves its required selectivity margin and the complete fault set remains coordinated after any change.",
  "regions": [
    "protection-coordination",
    "one-line-and-study-case",
    "fault-location-and-nested-primary-backup-trip-paths",
    "protection-zone-and-device-chain",
    "time-current-selectivity-view",
    "selected-device-settings",
    "adjacent-pair-selectivity-margin-ledger",
    "all-fault-sweep-and-miscoordination-queue",
    "approved-setting-package"
  ],
  "relationships": [
    "each fault owns an ordered nested trip chain, each chain owns pairwise margin checks and only the all-fault sweep may approve the shared package."
  ],
  "responsive": {
    "wide": "One-line topology, selected nested trip path, time-current evidence, settings editor, pairwise margin ledger and all-fault sweep status remain simultaneously visible.",
    "intermediate": "The selected fault path and active primary-backup pair remain primary; other pair curves, setting provenance and the sweep queue move to synchronized drawers without changing the fault context.",
    "compact": "Study case → fault location → nested device chain → one adjacent primary-backup pair → curve and numeric margin evidence → setting change → every remaining pair on the path → all-fault sweep → approve or rollback; the whole one-line becomes a semantic trip-path route rather than stacked desktop regions.",
    "reflow": [
      "protection-coordination",
      "one-line-and-study-case",
      "fault-location-and-nested-primary-backup-trip-paths",
      "protection-zone-and-device-chain",
      "time-current-selectivity-view",
      "selected-device-settings",
      "adjacent-pair-selectivity-margin-ledger",
      "all-fault-sweep-and-miscoordination-queue",
      "approved-setting-package"
    ]
  },
  "stateObligations": "model loading/invalid, study case current/stale, fault calculated/failed, trip path complete/ambiguous, device in-service/bypassed/unknown, primary-backup pair coordinated/marginal/miscoordinated, setting draft/invalid/pending approval, sweep queued/running/partial/complete/regressed and package approved/rejected/rolled back.",
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
