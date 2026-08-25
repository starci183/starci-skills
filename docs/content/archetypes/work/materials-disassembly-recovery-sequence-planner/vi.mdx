# Materials Disassembly Recovery Sequence Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `materials-disassembly-recovery-sequence-planner` |
| Family | Work |
| Dominant task | Suy ra và kiểm chứng trình tự tháo rời an toàn từ dependency mối nối, giới hạn tiếp cận, hazard, tool và tình trạng cấu phần; sau đó định tuyến vật thu hồi đến reuse, remanufacture, recycle hoặc disposal. |
| Search aliases | `materials`, `disassembly`, `recovery`, `sequence`, `planner` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Suy ra và kiểm chứng trình tự tháo rời an toàn từ dependency mối nối, giới hạn tiếp cận, hazard, tool và tình trạng cấu phần; sau đó định tuyến vật thu hồi đến reuse, remanufacture, recycle hoặc disposal.
- Required region graph luôn là `disassembly-planner → product-assembly-version-and-recovery-goal → bill-of-materials-hierarchy ↔ connection-access-and-dependency-graph → hazard-tool-and-destructive-step-constraints → reversible-disassembly-sequence → component-condition-and-recovery-yield → reuse-remanufacture-recycle-disposal-routes → residual-waste-value-and-compliance-summary → validated-instructions-and-passport-export`.
- Quan hệ bắt buộc luôn là: removing one component changes what becomes accessible and which recovery routes remain possible.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must expose a blocked component, choose a prerequisite removal through buttons rather than drag, require a hazard control and tool, record damage that changes the recovery route, recalculate yield and export the validated sequence.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-19-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-19-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-19-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-19-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-19-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-19-90` | Dominant task thực chất là `workflow-automation-builder`. | Reject. |
| `AR-B13-19-91` | Dominant task thực chất là `print-signature-imposition-planner`. | Reject. |
| `AR-B13-19-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `materials-disassembly-recovery-sequence-planner` chỉ khi `AR-B13-19-01` đến `AR-B13-19-05` đều có bằng chứng và không có mã `AR-B13-19-90` đến `AR-B13-19-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
disassembly-planner
└─ product-assembly-version-and-recovery-goal
   └─ bill-of-materials-hierarchy
      ↔─ connection-access-and-dependency-graph
         └─ hazard-tool-and-destructive-step-constraints
            └─ reversible-disassembly-sequence
               └─ component-condition-and-recovery-yield
                  └─ reuse-remanufacture-recycle-disposal-routes
                     └─ residual-waste-value-and-compliance-summary
                        └─ validated-instructions-and-passport-export
```

- Required relationship: removing one component changes what becomes accessible and which recovery routes remain possible.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `disassembly-planner` | Sở hữu bằng chứng, state và action cho disassembly planner mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `product-assembly-version-and-recovery-goal` | Sở hữu bằng chứng, state và action cho product assembly version and recovery goal mà không mượn product semantics. | Theo sau `disassembly-planner` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `bill-of-materials-hierarchy` | Sở hữu bằng chứng, state và action cho bill of materials hierarchy mà không mượn product semantics. | Theo sau `product-assembly-version-and-recovery-goal` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `connection-access-and-dependency-graph` | Sở hữu bằng chứng, state và action cho connection access and dependency graph mà không mượn product semantics. | Đồng bộ hai chiều với `bill-of-materials-hierarchy` trong cùng selection context. |
| `hazard-tool-and-destructive-step-constraints` | Sở hữu bằng chứng, state và action cho hazard tool and destructive step constraints mà không mượn product semantics. | Theo sau `connection-access-and-dependency-graph` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `reversible-disassembly-sequence` | Sở hữu bằng chứng, state và action cho reversible disassembly sequence mà không mượn product semantics. | Theo sau `hazard-tool-and-destructive-step-constraints` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `component-condition-and-recovery-yield` | Sở hữu bằng chứng, state và action cho component condition and recovery yield mà không mượn product semantics. | Theo sau `reversible-disassembly-sequence` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `reuse-remanufacture-recycle-disposal-routes` | Sở hữu bằng chứng, state và action cho reuse remanufacture recycle disposal routes mà không mượn product semantics. | Theo sau `component-condition-and-recovery-yield` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `residual-waste-value-and-compliance-summary` | Sở hữu bằng chứng, state và action cho residual waste value and compliance summary mà không mượn product semantics. | Theo sau `reuse-remanufacture-recycle-disposal-routes` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `validated-instructions-and-passport-export` | Sở hữu bằng chứng, state và action cho validated instructions and passport export mà không mượn product semantics. | Theo sau `residual-waste-value-and-compliance-summary` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Assembly/dependency graph, ordered steps, selected joint/constraint, component recovery routes and yield summary remain visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** Current sequence and selected component remain primary; full assembly graph, tool bank and residual summary move to drawers.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Assembly → next removable component → joint/tool/hazard proof → remove or choose alternative → record condition → recovery route → unlocked successor; graph editing has move buttons and a topological list alternative.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `disassembly-planner → product-assembly-version-and-recovery-goal → bill-of-materials-hierarchy ↔ connection-access-and-dependency-graph → hazard-tool-and-destructive-step-constraints → reversible-disassembly-sequence → component-condition-and-recovery-yield → reuse-remanufacture-recycle-disposal-routes → residual-waste-value-and-compliance-summary → validated-instructions-and-passport-export`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must expose a blocked component, choose a prerequisite removal through buttons rather than drag, require a hazard control and tool, record damage that changes the recovery route, recalculate yield and export the validated sequence.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `product-assembly-version-and-recovery-goal` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `bill-of-materials-hierarchy` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `connection-access-and-dependency-graph` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `hazard-tool-and-destructive-step-constraints` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `reversible-disassembly-sequence` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `residual-waste-value-and-compliance-summary` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `validated-instructions-and-passport-export` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `product-assembly-version-and-recovery-goal` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `validated-instructions-and-passport-export` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `disassembly-planner` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: assembly version unknown/current/superseded, connection known/unknown/inaccessible, step blocked/available/destructive, tool unavailable/ready, hazard unidentified/controlled, component intact/damaged/contaminated, route eligible/ineligible/pending test, yield estimated/confirmed, sequence invalid/valid and instructions draft/reviewed/exported.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Suy ra và kiểm chứng trình tự tháo rời an toàn từ dependency mối nối, giới hạn tiếp cận, hazard, tool và tình trạng cấu phần; sau đó định tuyến vật thu hồi đến reuse, remanufacture, recycle hoặc disposal.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `workflow-automation-builder`, `print-signature-imposition-planner`, sample lineage or inventory replenishment; physical connection/access dependencies, hazard- and tool-constrained removal, component condition and recovery-route yield are mandatory.
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
| [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ISO 20887:2020](https://www.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/06/93/69370.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [European Commission Digital Product Passport](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EU Ecodesign Regulation guidance](https://environment.ec.europa.eu/news/new-eu-sustainability-rules-explained-ecodesign-regulation-faqs-2024-09-27_en) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "materials-disassembly-recovery-sequence-planner",
  "situationCodes": [
    "<matched AR-B13-19-* codes>"
  ],
  "searchAliases": [
    "materials",
    "disassembly",
    "recovery",
    "sequence",
    "planner"
  ],
  "dominantTask": "Derive and validate a safe disassembly sequence from a product or construction assembly's connection dependencies, access constraints, hazards, tools and component conditions, then route recovered items to reuse, remanufacture, recycle or disposal.",
  "regions": [
    "disassembly-planner",
    "product-assembly-version-and-recovery-goal",
    "bill-of-materials-hierarchy",
    "connection-access-and-dependency-graph",
    "hazard-tool-and-destructive-step-constraints",
    "reversible-disassembly-sequence",
    "component-condition-and-recovery-yield",
    "reuse-remanufacture-recycle-disposal-routes",
    "residual-waste-value-and-compliance-summary",
    "validated-instructions-and-passport-export"
  ],
  "relationships": [
    "removing one component changes what becomes accessible and which recovery routes remain possible."
  ],
  "responsive": {
    "wide": "Assembly/dependency graph, ordered steps, selected joint/constraint, component recovery routes and yield summary remain visible.",
    "intermediate": "Current sequence and selected component remain primary; full assembly graph, tool bank and residual summary move to drawers.",
    "compact": "Assembly → next removable component → joint/tool/hazard proof → remove or choose alternative → record condition → recovery route → unlocked successor; graph editing has move buttons and a topological list alternative.",
    "reflow": [
      "disassembly-planner",
      "product-assembly-version-and-recovery-goal",
      "bill-of-materials-hierarchy",
      "connection-access-and-dependency-graph",
      "hazard-tool-and-destructive-step-constraints",
      "reversible-disassembly-sequence",
      "component-condition-and-recovery-yield",
      "reuse-remanufacture-recycle-disposal-routes",
      "residual-waste-value-and-compliance-summary",
      "validated-instructions-and-passport-export"
    ]
  },
  "stateObligations": "assembly version unknown/current/superseded, connection known/unknown/inaccessible, step blocked/available/destructive, tool unavailable/ready, hazard unidentified/controlled, component intact/damaged/contaminated, route eligible/ineligible/pending test, yield estimated/confirmed, sequence invalid/valid and instructions draft/reviewed/exported.",
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
