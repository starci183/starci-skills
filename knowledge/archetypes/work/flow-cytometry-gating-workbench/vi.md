# Workbench gating flow cytometry

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `flow-cytometry-gating-workbench` |
| Family | Work |
| Dominant task | Định nghĩa và xác thực population tế bào lồng nhau từ đo lường flow cytometry đa biến, trong đó mỗi gate kế thừa event set của parent. |
| Search aliases | `population gating tree`, `recursive cell gate`, `parent event inheritance`, `gating QC` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Định nghĩa và xác thực population tế bào lồng nhau từ đo lường flow cytometry đa biến, trong đó mỗi gate kế thừa event set của parent.
- Required region graph luôn là `gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection ↔ gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-FG-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-FG-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-FG-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-FG-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-FG-05` | Template must create a child gate with numeric and keyboard alternatives, show inherited event counts, invalidate descendants after parent change and expose compensation/QC evidence. | Required evidence. |
| `AR-FG-90` | media annotation | Từ chối. |
| `AR-FG-91` | scatterplot viewer | Từ chối. |
| `AR-FG-92` | generic tree editor | Từ chối. |
| `AR-FG-93` | image segmentation | Từ chối. |

### Quy tắc chọn

Chỉ chọn `flow-cytometry-gating-workbench` khi `AR-FG-01` đến `AR-FG-05` đều có evidence và không có mã `AR-FG-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
gating-workbench
   `-- sample-and-channel-selector
      `-- population-gating-hierarchy
         `-- selected-parent-population
            `-- scatter-or-density-projection
               `-- gate-boundary-editor
                  `-- derived-child-statistics
                     `-- compensation-and-qc-rail
```

Biểu thức relationship đã khai báo: `gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection ↔ gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `gating-workbench` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `sample-and-channel-selector` | Sở hữu evidence, action, state và recovery của sample and channel selector. | Theo sau `gating-workbench` trong semantic order và dùng đúng selected context của vùng đó. |
| `population-gating-hierarchy` | Sở hữu evidence, action, state và recovery của population gating hierarchy. | Theo sau `sample-and-channel-selector` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-parent-population` | Sở hữu evidence, action, state và recovery của selected parent population. | Theo sau `population-gating-hierarchy` trong semantic order và dùng đúng selected context của vùng đó. |
| `scatter-or-density-projection` | Sở hữu evidence, action, state và recovery của scatter or density projection. | Đồng bộ hai chiều với `selected-parent-population` trong cùng selected context. |
| `gate-boundary-editor` | Sở hữu evidence, action, state và recovery của gate boundary editor. | Đồng bộ hai chiều với `scatter-or-density-projection` trong cùng selected context. |
| `derived-child-statistics` | Sở hữu evidence, action, state và recovery của derived child statistics. | Theo sau `gate-boundary-editor` trong semantic order và dùng đúng selected context của vùng đó. |
| `compensation-and-qc-rail` | Sở hữu evidence, action, state và recovery của compensation and qc rail. | Theo sau `derived-child-statistics` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Gating hierarchy, selected projection/gate, child statistics and compensation/QC remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `scatter-or-density-projection` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Hierarchy becomes a drawer; projection remains primary and statistics/QC move below.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `scatter-or-density-projection` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Population breadcrumb → one projection → numeric threshold or point-list gate editor → child statistics → QC → next child; drawing is never the only input.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `scatter-or-density-projection` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection → gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail`.
- Text zoom, translation dài và control phóng to kích hoạt cùng named topology change.
- CSS không reorder visual content lệch khỏi keyboard hoặc assistive-technology order.
- Label và identifier dài được wrap; detail ẩn có accessible reveal rõ ràng.
- Nội dung thường không tạo page-level horizontal scroll.

### Ngang bằng tương tác

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable tại intermediate và compact.
- Topology change giữ selected entity, version, filter, pending state, validation result và recovery point.
- Dynamic update dùng một contextual status message mà không di chuyển focus.
- Modal nhận và giữ focus, hỗ trợ Escape hoặc Cancel, rồi trả focus về đúng trigger.
- Drag, drawing, fader, spatial hoặc point movement có parity bằng button, numeric hoặc list.
- Color, position, geometry và motion luôn có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| State | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi đầu / loading | `sample-and-channel-selector` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `population-gating-hierarchy` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `selected-parent-population` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `scatter-or-density-projection` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `derived-child-statistics` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `compensation-and-qc-rail` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `compensation-and-qc-rail` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `sample-and-channel-selector` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `compensation-and-qc-rail` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `gating-workbench` | Giữ selected entity, query, state và recovery khi topology đổi. |
| sample loading/empty | `sample-and-channel-selector` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| channel unavailable | `population-gating-hierarchy` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| parent population stale | `selected-parent-population` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| gate draft/valid/invalid | `scatter-or-density-projection` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| compensation warning | `gate-boundary-editor` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| too few events | `derived-child-statistics` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| child created/empty | `compensation-and-qc-rail` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| QC pass/fail and export. | `compensation-and-qc-rail` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must create a child gate with numeric and keyboard alternatives, show inherited event counts, invalidate descendants after parent change and expose compensation/QC evidence.

### Từ chối

- Từ chối media annotation; đây là evidence `AR-FG-90` và phải route sang archetype khác.
- Từ chối scatterplot viewer; đây là evidence `AR-FG-91` và phải route sang archetype khác.
- Từ chối generic tree editor; đây là evidence `AR-FG-92` và phải route sang archetype khác.
- Từ chối image segmentation; đây là evidence `AR-FG-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-FG-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

## Bàn giao

- **Grammar handoff:** Bind product-specific owner, label, permission, truthful state meaning và permitted action vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization và relationship-driven transition points.
- Hai handoff không được xóa required region, thay dominant task hoặc làm yếu keyboard, focus, responsive hay recovery parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là advisory evidence, không phải product truth. Nó hỗ trợ synthesis của task relationship, responsive transformation, interaction và accessibility obligation. Nó không đặt tên StarCi owner, chọn exact geometry, tạo product fact hoặc cấp quyền copy source interface.

### Nguồn

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [ISAC — Data Standards](https://isac-net.org/data-runtime/standards/) | Hỗ trợ gating exchange, populations, compensation, and reproducibility. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [NIST — Cell Phenotype Quantification](https://www.nist.gov/mml/bbd/quantification-cells-specific-phenotypic-characteristics) | Hỗ trợ gating strategies and measurement QC. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Hỗ trợ keyboard navigation for recursive populations. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "flow-cytometry-gating-workbench",
  "situationCodes": [
    "<matched AR-FG-* codes>"
  ],
  "searchAliases": [
    "population gating tree",
    "recursive cell gate",
    "parent event inheritance",
    "gating QC"
  ],
  "dominantTask": "Define and validate recursively nested cell populations from multivariate flow-cytometry measurements, with each gate inheriting its parent event set.",
  "regions": [
    "gating-workbench",
    "sample-and-channel-selector",
    "population-gating-hierarchy",
    "selected-parent-population",
    "scatter-or-density-projection",
    "gate-boundary-editor",
    "derived-child-statistics",
    "compensation-and-qc-rail"
  ],
  "regionRelationships": [
    "gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection ↔ gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection → gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "scatter-or-density-projection",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "sample loading/empty",
    "channel unavailable",
    "parent population stale",
    "gate draft/valid/invalid",
    "compensation warning",
    "too few events",
    "child created/empty",
    "QC pass/fail and export."
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

