# Bộ thiết kế construct trình tự vòng

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `circular-sequence-construct-designer` |
| Family | Work |
| Dominant task | Author và xác thực construct sinh học phân tử dạng vòng trong khi giữ tọa độ, feature và constraint của projection vòng và tuyến tính đồng bộ. |
| Search aliases | `circular construct editor`, `linear sequence coordinates`, `wraparound feature authoring`, `construct validation` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Author và xác thực construct sinh học phân tử dạng vòng trong khi giữ tọa độ, feature và constraint của projection vòng và tuyến tính đồng bộ.
- Required region graph luôn là `construct-designer → construct-identity-and-length → circular-projection ↔ linear-base-sequence → feature-register → selected-feature-coordinate-editor → sequence-constraint-and-conflict-ledger → validation-and-export`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-CS-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-CS-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-CS-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-CS-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-CS-05` | Template must edit a wraparound feature through numeric controls, highlight it in both projections, catch an overlap/constraint error and preserve coordinates through projection changes. | Required evidence. |
| `AR-CS-90` | generic canvas inspector | Từ chối. |
| `AR-CS-91` | genomic read inspector | Từ chối. |
| `AR-CS-92` | diagram editor | Từ chối. |
| `AR-CS-93` | text sequence viewer | Từ chối. |

### Quy tắc chọn

Chỉ chọn `circular-sequence-construct-designer` khi `AR-CS-01` đến `AR-CS-05` đều có evidence và không có mã `AR-CS-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
construct-designer
   `-- construct-identity-and-length
      `-- circular-projection
         `-- linear-base-sequence
            `-- feature-register
               `-- selected-feature-coordinate-editor
                  `-- sequence-constraint-and-conflict-ledger
                     `-- validation-and-export
```

Biểu thức relationship đã khai báo: `construct-designer → construct-identity-and-length → circular-projection ↔ linear-base-sequence → feature-register → selected-feature-coordinate-editor → sequence-constraint-and-conflict-ledger → validation-and-export`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `construct-designer` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `construct-identity-and-length` | Sở hữu evidence, action, state và recovery của construct identity and length. | Theo sau `construct-designer` trong semantic order và dùng đúng selected context của vùng đó. |
| `circular-projection` | Sở hữu evidence, action, state và recovery của circular projection. | Đồng bộ hai chiều với `construct-identity-and-length` trong cùng selected context. |
| `linear-base-sequence` | Sở hữu evidence, action, state và recovery của linear base sequence. | Đồng bộ hai chiều với `circular-projection` trong cùng selected context. |
| `feature-register` | Sở hữu evidence, action, state và recovery của feature register. | Theo sau `linear-base-sequence` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-feature-coordinate-editor` | Sở hữu evidence, action, state và recovery của selected feature coordinate editor. | Theo sau `feature-register` trong semantic order và dùng đúng selected context của vùng đó. |
| `sequence-constraint-and-conflict-ledger` | Sở hữu evidence, action, state và recovery của sequence constraint and conflict ledger. | Theo sau `selected-feature-coordinate-editor` trong semantic order và dùng đúng selected context của vùng đó. |
| `validation-and-export` | Sở hữu evidence, action, state và recovery của validation and export. | Theo sau `sequence-constraint-and-conflict-ledger` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Circular map, linear sequence, selected feature editor and validation ledger remain linked and visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `circular-projection` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: One projection is primary through an explicit circular/linear switcher; feature register and validation remain adjacent.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `circular-projection` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Linear coordinate owner → feature list → start/end/strand editor → circular overview → validation/export; all spatial movement has numeric and list alternatives.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `circular-projection` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `construct-designer → construct-identity-and-length → circular-projection → linear-base-sequence → feature-register → selected-feature-coordinate-editor → sequence-constraint-and-conflict-ledger → validation-and-export`.
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
| Khởi đầu / loading | `construct-identity-and-length` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `circular-projection` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `linear-base-sequence` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `feature-register` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `sequence-constraint-and-conflict-ledger` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `validation-and-export` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `validation-and-export` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `construct-identity-and-length` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `validation-and-export` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `construct-designer` | Giữ selected entity, query, state và recovery khi topology đổi. |
| sequence loading/empty | `construct-identity-and-length` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| feature selected/overlapping/out-of-range | `circular-projection` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| coordinate wraparound | `linear-base-sequence` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| strand changed | `feature-register` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| constraint pass/fail | `selected-feature-coordinate-editor` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| unsaved conflict | `sequence-constraint-and-conflict-ledger` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| validation stale and export success/failure. | `validation-and-export` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must edit a wraparound feature through numeric controls, highlight it in both projections, catch an overlap/constraint error and preserve coordinates through projection changes.

### Từ chối

- Từ chối generic canvas inspector; đây là evidence `AR-CS-90` và phải route sang archetype khác.
- Từ chối genomic read inspector; đây là evidence `AR-CS-91` và phải route sang archetype khác.
- Từ chối diagram editor; đây là evidence `AR-CS-92` và phải route sang archetype khác.
- Từ chối text sequence viewer; đây là evidence `AR-CS-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-CS-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [SBOL — Data Model Specification](https://sbolstandard.org/datamodel-specification/) | Hỗ trợ sequence features, locations, constraints, and validation. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [NCBI GenBank — Feature Table](https://www.ncbi.nlm.nih.gov/genbank/feature_table/) | Hỗ trợ feature coordinates, strands, and multi-interval locations. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) | Hỗ trợ text equivalents for complex projections. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "circular-sequence-construct-designer",
  "situationCodes": [
    "<matched AR-CS-* codes>"
  ],
  "searchAliases": [
    "circular construct editor",
    "linear sequence coordinates",
    "wraparound feature authoring",
    "construct validation"
  ],
  "dominantTask": "Author and validate a circular biomolecular construct while keeping circular and linear sequence coordinates, features and constraints synchronized.",
  "regions": [
    "construct-designer",
    "construct-identity-and-length",
    "circular-projection",
    "linear-base-sequence",
    "feature-register",
    "selected-feature-coordinate-editor",
    "sequence-constraint-and-conflict-ledger",
    "validation-and-export"
  ],
  "regionRelationships": [
    "construct-designer → construct-identity-and-length → circular-projection ↔ linear-base-sequence → feature-register → selected-feature-coordinate-editor → sequence-constraint-and-conflict-ledger → validation-and-export"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "construct-designer → construct-identity-and-length → circular-projection → linear-base-sequence → feature-register → selected-feature-coordinate-editor → sequence-constraint-and-conflict-ledger → validation-and-export",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "circular-projection",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "sequence loading/empty",
    "feature selected/overlapping/out-of-range",
    "coordinate wraparound",
    "strand changed",
    "constraint pass/fail",
    "unsaved conflict",
    "validation stale and export success/failure."
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

