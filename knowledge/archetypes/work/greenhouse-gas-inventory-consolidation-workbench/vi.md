# Greenhouse Gas Inventory Consolidation Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `greenhouse-gas-inventory-consolidation-workbench` |
| Family | Work |
| Dominant task | Lập và xác minh inventory khí nhà kính của tổ chức bằng một cách hợp nhất nhất quán trên cây thực thể, phân loại và tính nguồn phát thải, loại trừ hoạt động nội bộ theo cặp và replay base year khi có trigger cơ cấu hoặc phương pháp. |
| Search aliases | `greenhouse`, `inventory`, `consolidation`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Lập và xác minh inventory khí nhà kính của tổ chức bằng một cách hợp nhất nhất quán trên cây thực thể, phân loại và tính nguồn phát thải, loại trừ hoạt động nội bộ theo cặp và replay base year khi có trigger cơ cấu hoặc phương pháp.
- Required region graph luôn là `ghg-inventory → reporting-period-standard-consolidation-approach-and-base-year → organizational-boundary-and-entity-control-tree → entity-owned-emission-source-register → scope-category-method-and-activity-factor-lineage → entity-subtotal-and-group-consolidation-rollup ↔ paired-intercompany-activity-and-elimination-ledger → structural-methodology-and-significance-trigger-register → base-year-recalculation-replay-and-comparability-bridge → completeness-uncertainty-and-verification-issues → approved-inventory-and-disclosure-export`.
- Quan hệ bắt buộc luôn là: the entity boundary owns consolidation, each elimination binds two counterpart records and every qualifying trigger replays the base-year inventory under preserved lineage.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must change one entity-control boundary, reclassify and calculate a source from visible activity/factor lineage, match both sides of an intercompany activity before elimination, record the structural trigger, replay the base year with a comparability bridge and clear verification before release.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-14-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-14-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-14-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-14-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-14-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-14-90` | Dominant task thực chất là `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-14-91` | Dominant task thực chất là `financial-consolidation-elimination-workbench`. | Reject. |
| `AR-B13-14-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `greenhouse-gas-inventory-consolidation-workbench` chỉ khi `AR-B13-14-01` đến `AR-B13-14-05` đều có bằng chứng và không có mã `AR-B13-14-90` đến `AR-B13-14-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
ghg-inventory
└─ reporting-period-standard-consolidation-approach-and-base-year
   └─ organizational-boundary-and-entity-control-tree
      └─ entity-owned-emission-source-register
         └─ scope-category-method-and-activity-factor-lineage
            └─ entity-subtotal-and-group-consolidation-rollup
               ↔─ paired-intercompany-activity-and-elimination-ledger
                  └─ structural-methodology-and-significance-trigger-register
                     └─ base-year-recalculation-replay-and-comparability-bridge
                        └─ completeness-uncertainty-and-verification-issues
                           └─ approved-inventory-and-disclosure-export
```

- Required relationship: the entity boundary owns consolidation, each elimination binds two counterpart records and every qualifying trigger replays the base-year inventory under preserved lineage.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `ghg-inventory` | Sở hữu bằng chứng, state và action cho ghg inventory mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `reporting-period-standard-consolidation-approach-and-base-year` | Sở hữu bằng chứng, state và action cho reporting period standard consolidation approach and base year mà không mượn product semantics. | Theo sau `ghg-inventory` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `organizational-boundary-and-entity-control-tree` | Sở hữu bằng chứng, state và action cho organizational boundary and entity control tree mà không mượn product semantics. | Theo sau `reporting-period-standard-consolidation-approach-and-base-year` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `entity-owned-emission-source-register` | Sở hữu bằng chứng, state và action cho entity owned emission source register mà không mượn product semantics. | Theo sau `organizational-boundary-and-entity-control-tree` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `scope-category-method-and-activity-factor-lineage` | Sở hữu bằng chứng, state và action cho scope category method and activity factor lineage mà không mượn product semantics. | Theo sau `entity-owned-emission-source-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `entity-subtotal-and-group-consolidation-rollup` | Sở hữu bằng chứng, state và action cho entity subtotal and group consolidation rollup mà không mượn product semantics. | Theo sau `scope-category-method-and-activity-factor-lineage` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `paired-intercompany-activity-and-elimination-ledger` | Sở hữu bằng chứng, state và action cho paired intercompany activity and elimination ledger mà không mượn product semantics. | Đồng bộ hai chiều với `entity-subtotal-and-group-consolidation-rollup` trong cùng selection context. |
| `structural-methodology-and-significance-trigger-register` | Sở hữu bằng chứng, state và action cho structural methodology and significance trigger register mà không mượn product semantics. | Theo sau `paired-intercompany-activity-and-elimination-ledger` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `base-year-recalculation-replay-and-comparability-bridge` | Sở hữu bằng chứng, state và action cho base year recalculation replay and comparability bridge mà không mượn product semantics. | Theo sau `structural-methodology-and-significance-trigger-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `completeness-uncertainty-and-verification-issues` | Sở hữu bằng chứng, state và action cho completeness uncertainty and verification issues mà không mượn product semantics. | Theo sau `base-year-recalculation-replay-and-comparability-bridge` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `approved-inventory-and-disclosure-export` | Sở hữu bằng chứng, state và action cho approved inventory and disclosure export mà không mượn product semantics. | Theo sau `completeness-uncertainty-and-verification-issues` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Entity-control boundary, source calculations, consolidation rollup, paired intercompany eliminations, base-year replay and verification issues remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The selected entity/source and consolidated result remain primary; its counterparty elimination and any base-year trigger stay synchronized while the full tree and other methodology evidence move to routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Reporting period and consolidation approach → entity path → source activity/factor lineage → scope/category → linked counterparty elimination → structural or method trigger → base-year replay/comparability result → verification; the hierarchy transforms into an entity path with exact linked records rather than stacked ledgers.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `ghg-inventory → reporting-period-standard-consolidation-approach-and-base-year → organizational-boundary-and-entity-control-tree → entity-owned-emission-source-register → scope-category-method-and-activity-factor-lineage → entity-subtotal-and-group-consolidation-rollup ↔ paired-intercompany-activity-and-elimination-ledger → structural-methodology-and-significance-trigger-register → base-year-recalculation-replay-and-comparability-bridge → completeness-uncertainty-and-verification-issues → approved-inventory-and-disclosure-export`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must change one entity-control boundary, reclassify and calculate a source from visible activity/factor lineage, match both sides of an intercompany activity before elimination, record the structural trigger, replay the base year with a comparability bridge and clear verification before release.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `reporting-period-standard-consolidation-approach-and-base-year` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `organizational-boundary-and-entity-control-tree` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `entity-owned-emission-source-register` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `scope-category-method-and-activity-factor-lineage` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `entity-subtotal-and-group-consolidation-rollup` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `completeness-uncertainty-and-verification-issues` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `approved-inventory-and-disclosure-export` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `reporting-period-standard-consolidation-approach-and-base-year` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `approved-inventory-and-disclosure-export` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `ghg-inventory` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: boundary draft/approved/changed, entity included/excluded/partial, source missing/actual/estimated/not-applicable, scope disputed/resolved, factor current/superseded, unit conversion pass/fail, intercompany pair unmatched/matched/eliminated/reopened, recalculation trigger absent/proposed/approved, base-year replay queued/complete/failed, verification issue open/cleared and inventory draft/assured/published/revised.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Lập và xác minh inventory khí nhà kính của tổ chức bằng một cách hợp nhất nhất quán trên cây thực thể, phân loại và tính nguồn phát thải, loại trừ hoạt động nội bộ theo cặp và replay base year khi có trigger cơ cấu hoặc phương pháp.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `process-mass-balance-analyzer`, `financial-consolidation-elimination-workbench`, bridge waterfall or spreadsheet accounting; GHG-specific consolidation approach, scope/category classification, activity-to-factor lineage, paired intercompany activity elimination and trigger-driven base-year replay are mandatory—financial journal consolidation or physical conservation alone is insufficient.
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
| [GHG Protocol Corporate Standard FAQ](https://ghgprotocol.org/corporate-standard-frequently-asked-questions) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [GHG Protocol standards update](https://ghgprotocol.org/ghg-protocol-corporate-suite-standards-and-guidance-update-process) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA GHG Emission Factors Hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ISO 14064-1:2018](https://www.iso.org/standard/66453.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "greenhouse-gas-inventory-consolidation-workbench",
  "situationCodes": [
    "<matched AR-B13-14-* codes>"
  ],
  "searchAliases": [
    "greenhouse",
    "inventory",
    "consolidation",
    "workbench"
  ],
  "dominantTask": "Build and verify an organizational greenhouse-gas inventory by fixing one consolidation approach across an entity hierarchy, classifying and calculating sources, eliminating paired intercompany activity and replaying an approved base year whenever a structural or methodology trigger requires recalculation.",
  "regions": [
    "ghg-inventory",
    "reporting-period-standard-consolidation-approach-and-base-year",
    "organizational-boundary-and-entity-control-tree",
    "entity-owned-emission-source-register",
    "scope-category-method-and-activity-factor-lineage",
    "entity-subtotal-and-group-consolidation-rollup",
    "paired-intercompany-activity-and-elimination-ledger",
    "structural-methodology-and-significance-trigger-register",
    "base-year-recalculation-replay-and-comparability-bridge",
    "completeness-uncertainty-and-verification-issues",
    "approved-inventory-and-disclosure-export"
  ],
  "relationships": [
    "the entity boundary owns consolidation, each elimination binds two counterpart records and every qualifying trigger replays the base-year inventory under preserved lineage."
  ],
  "responsive": {
    "wide": "Entity-control boundary, source calculations, consolidation rollup, paired intercompany eliminations, base-year replay and verification issues remain simultaneously visible.",
    "intermediate": "The selected entity/source and consolidated result remain primary; its counterparty elimination and any base-year trigger stay synchronized while the full tree and other methodology evidence move to routes.",
    "compact": "Reporting period and consolidation approach → entity path → source activity/factor lineage → scope/category → linked counterparty elimination → structural or method trigger → base-year replay/comparability result → verification; the hierarchy transforms into an entity path with exact linked records rather than stacked ledgers.",
    "reflow": [
      "ghg-inventory",
      "reporting-period-standard-consolidation-approach-and-base-year",
      "organizational-boundary-and-entity-control-tree",
      "entity-owned-emission-source-register",
      "scope-category-method-and-activity-factor-lineage",
      "entity-subtotal-and-group-consolidation-rollup",
      "paired-intercompany-activity-and-elimination-ledger",
      "structural-methodology-and-significance-trigger-register",
      "base-year-recalculation-replay-and-comparability-bridge",
      "completeness-uncertainty-and-verification-issues",
      "approved-inventory-and-disclosure-export"
    ]
  },
  "stateObligations": "boundary draft/approved/changed, entity included/excluded/partial, source missing/actual/estimated/not-applicable, scope disputed/resolved, factor current/superseded, unit conversion pass/fail, intercompany pair unmatched/matched/eliminated/reopened, recalculation trigger absent/proposed/approved, base-year replay queued/complete/failed, verification issue open/cleared and inventory draft/assured/published/revised.",
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
