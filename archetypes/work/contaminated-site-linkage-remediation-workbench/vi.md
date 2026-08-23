# Contaminated Site Linkage Remediation Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `contaminated-site-linkage-remediation-workbench` |
| Family | Work |
| Dominant task | Xây dựng và kiểm thử conceptual model cho khu đất ô nhiễm, xác định linkage source–pathway–receptor nào hoàn chỉnh và chọn remedy bẻ gãy từng linkage trọng yếu với bằng chứng residual risk và verification. |
| Search aliases | `contaminated`, `linkage`, `remediation`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Xây dựng và kiểm thử conceptual model cho khu đất ô nhiễm, xác định linkage source–pathway–receptor nào hoàn chỉnh và chọn remedy bẻ gãy từng linkage trọng yếu với bằng chứng residual risk và verification.
- Required region graph luôn là `site-remediation → site-use-geology-and-objectives → contaminant-source-register → pathway-and-environmental-media-network ↔ receptor-register → sample-location-result-and-criteria-evidence → complete-incomplete-and-uncertain-linkage-matrix → remedy-options-bound-to-link-breaks → residual-risk-and-monitoring-model → selected-remedy-and-verification-plan`.
- Quan hệ bắt buộc luôn là: risk exists only through an evidenced complete linkage, and each selected remedy names the linkage element it changes.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must assemble one complete and one uncertain linkage, bind samples and criteria to each, reject a remedy that leaves a pathway intact, select a remedy that breaks the material link and define monitoring plus verification for residual risk.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-17-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-17-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-17-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-17-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-17-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-17-90` | Dominant task thực chất là `risk-bow-tie-control-overview`. | Reject. |
| `AR-B13-17-91` | Dominant task thực chất là `evidence-led-case-resolution-dossier`. | Reject. |
| `AR-B13-17-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `contaminated-site-linkage-remediation-workbench` chỉ khi `AR-B13-17-01` đến `AR-B13-17-05` đều có bằng chứng và không có mã `AR-B13-17-90` đến `AR-B13-17-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
site-remediation
└─ site-use-geology-and-objectives
   └─ contaminant-source-register
      └─ pathway-and-environmental-media-network
         ↔─ receptor-register
            └─ sample-location-result-and-criteria-evidence
               └─ complete-incomplete-and-uncertain-linkage-matrix
                  └─ remedy-options-bound-to-link-breaks
                     └─ residual-risk-and-monitoring-model
                        └─ selected-remedy-and-verification-plan
```

- Required relationship: risk exists only through an evidenced complete linkage, and each selected remedy names the linkage element it changes.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `site-remediation` | Sở hữu bằng chứng, state và action cho site remediation mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `site-use-geology-and-objectives` | Sở hữu bằng chứng, state và action cho site use geology and objectives mà không mượn product semantics. | Theo sau `site-remediation` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `contaminant-source-register` | Sở hữu bằng chứng, state và action cho contaminant source register mà không mượn product semantics. | Theo sau `site-use-geology-and-objectives` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `pathway-and-environmental-media-network` | Sở hữu bằng chứng, state và action cho pathway and environmental media network mà không mượn product semantics. | Theo sau `contaminant-source-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `receptor-register` | Sở hữu bằng chứng, state và action cho receptor register mà không mượn product semantics. | Đồng bộ hai chiều với `pathway-and-environmental-media-network` trong cùng selection context. |
| `sample-location-result-and-criteria-evidence` | Sở hữu bằng chứng, state và action cho sample location result and criteria evidence mà không mượn product semantics. | Theo sau `receptor-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `complete-incomplete-and-uncertain-linkage-matrix` | Sở hữu bằng chứng, state và action cho complete incomplete and uncertain linkage matrix mà không mượn product semantics. | Theo sau `sample-location-result-and-criteria-evidence` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `remedy-options-bound-to-link-breaks` | Sở hữu bằng chứng, state và action cho remedy options bound to link breaks mà không mượn product semantics. | Theo sau `complete-incomplete-and-uncertain-linkage-matrix` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `residual-risk-and-monitoring-model` | Sở hữu bằng chứng, state và action cho residual risk and monitoring model mà không mượn product semantics. | Theo sau `remedy-options-bound-to-link-breaks` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `selected-remedy-and-verification-plan` | Sở hữu bằng chứng, state và action cho selected remedy and verification plan mà không mượn product semantics. | Theo sau `residual-risk-and-monitoring-model` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Site/context map, linkage network, sample evidence, linkage matrix and remedy/residual-risk comparison remain visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** Selected linkage and remedy evidence remain primary; complete site map, source/receptor registers and monitoring history move to drawers.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Receptor or source → candidate pathway → sample/criteria evidence → linkage verdict → remedy break point → residual risk/monitoring → select and verify; every map path has a semantic chain alternative.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `site-remediation → site-use-geology-and-objectives → contaminant-source-register → pathway-and-environmental-media-network ↔ receptor-register → sample-location-result-and-criteria-evidence → complete-incomplete-and-uncertain-linkage-matrix → remedy-options-bound-to-link-breaks → residual-risk-and-monitoring-model → selected-remedy-and-verification-plan`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must assemble one complete and one uncertain linkage, bind samples and criteria to each, reject a remedy that leaves a pathway intact, select a remedy that breaks the material link and define monitoring plus verification for residual risk.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `site-use-geology-and-objectives` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `contaminant-source-register` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `pathway-and-environmental-media-network` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `receptor-register` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `sample-location-result-and-criteria-evidence` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `residual-risk-and-monitoring-model` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `selected-remedy-and-verification-plan` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `site-use-geology-and-objectives` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `selected-remedy-and-verification-plan` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `site-remediation` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: site model draft/current/stale, source suspected/confirmed/removed, pathway plausible/complete/interrupted/uncertain, receptor present/absent/future, sample planned/pending/qualified/rejected, criterion applicable/disputed, linkage material/not-material/unknown, remedy untested/effective/insufficient, residual risk acceptable/unacceptable and verification pending/complete/failed.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Xây dựng và kiểm thử conceptual model cho khu đất ô nhiễm, xác định linkage source–pathway–receptor nào hoàn chỉnh và chọn remedy bẻ gãy từng linkage trọng yếu với bằng chứng residual risk và verification.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `risk-bow-tie-control-overview`, `evidence-led-case-resolution-dossier`, map-led monitor or impact-likelihood matrix; site-specific environmental media, source–pathway–receptor completeness, sampling criteria, remedy-to-linkage break semantics and residual verification are mandatory—there is no single central event.
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
| [Environment Agency LCRM Stage 1](https://www.gov.uk/government/publications/land-contamination-risk-management-lcrm/lcrm-stage-1-risk-assessment) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Land contamination risk management](https://www.gov.uk/government/publications/land-contamination-risk-management-lcrm) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA Superfund risk assessment](https://www.epa.gov/risk/superfund-risk-assessment) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "contaminated-site-linkage-remediation-workbench",
  "situationCodes": [
    "<matched AR-B13-17-* codes>"
  ],
  "searchAliases": [
    "contaminated",
    "linkage",
    "remediation",
    "workbench"
  ],
  "dominantTask": "Build and test a contaminated-site conceptual model, determine which source–pathway–receptor linkages are complete, and choose a remedy that breaks each material linkage with residual-risk and verification evidence.",
  "regions": [
    "site-remediation",
    "site-use-geology-and-objectives",
    "contaminant-source-register",
    "pathway-and-environmental-media-network",
    "receptor-register",
    "sample-location-result-and-criteria-evidence",
    "complete-incomplete-and-uncertain-linkage-matrix",
    "remedy-options-bound-to-link-breaks",
    "residual-risk-and-monitoring-model",
    "selected-remedy-and-verification-plan"
  ],
  "relationships": [
    "risk exists only through an evidenced complete linkage, and each selected remedy names the linkage element it changes."
  ],
  "responsive": {
    "wide": "Site/context map, linkage network, sample evidence, linkage matrix and remedy/residual-risk comparison remain visible.",
    "intermediate": "Selected linkage and remedy evidence remain primary; complete site map, source/receptor registers and monitoring history move to drawers.",
    "compact": "Receptor or source → candidate pathway → sample/criteria evidence → linkage verdict → remedy break point → residual risk/monitoring → select and verify; every map path has a semantic chain alternative.",
    "reflow": [
      "site-remediation",
      "site-use-geology-and-objectives",
      "contaminant-source-register",
      "pathway-and-environmental-media-network",
      "receptor-register",
      "sample-location-result-and-criteria-evidence",
      "complete-incomplete-and-uncertain-linkage-matrix",
      "remedy-options-bound-to-link-breaks",
      "residual-risk-and-monitoring-model",
      "selected-remedy-and-verification-plan"
    ]
  },
  "stateObligations": "site model draft/current/stale, source suspected/confirmed/removed, pathway plausible/complete/interrupted/uncertain, receptor present/absent/future, sample planned/pending/qualified/rejected, criterion applicable/disputed, linkage material/not-material/unknown, remedy untested/effective/insufficient, residual risk acceptable/unacceptable and verification pending/complete/failed.",
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
