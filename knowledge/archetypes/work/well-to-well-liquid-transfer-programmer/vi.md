# Bộ lập trình chuyển chất lỏng giữa well

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `well-to-well-liquid-transfer-programmer` |
| Family | Work |
| Dominant task | Lập trình và xác minh transfer chất lỏng theo tọa độ trong khi bảo toàn volume nguồn/đích, thứ tự operation, tip use và constraint contamination. |
| Search aliases | `microplate transfer program`, `well coordinate transfer`, `tip contamination control`, `volume conservation` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Lập trình và xác minh transfer chất lỏng theo tọa độ trong khi bảo toàn volume nguồn/đích, thứ tự operation, tip use và constraint contamination.
- Required region graph luôn là `transfer-programmer → labware-and-reagent-setup → source-well-grid ↔ destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-LT-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-LT-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-LT-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-LT-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-LT-05` | Template must create transfers without drag, update both well volumes, catch overflow and tip-contamination conflicts, reorder with buttons and validate the final executable sequence. | Required evidence. |
| `AR-LT-90` | dual-list transfer | Từ chối. |
| `AR-LT-91` | spreadsheet | Từ chối. |
| `AR-LT-92` | generic workflow | Từ chối. |
| `AR-LT-93` | sample lineage viewer | Từ chối. |

### Quy tắc chọn

Chỉ chọn `well-to-well-liquid-transfer-programmer` khi `AR-LT-01` đến `AR-LT-05` đều có evidence và không có mã `AR-LT-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
transfer-programmer
   `-- labware-and-reagent-setup
      `-- source-well-grid
         `-- destination-well-grid
            `-- ordered-transfer-program
               `-- selected-transfer-volume-and-tip-policy
                  `-- volume-and-contamination-validator
                     `-- run-review-and-export
```

Biểu thức relationship đã khai báo: `transfer-programmer → labware-and-reagent-setup → source-well-grid ↔ destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `transfer-programmer` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `labware-and-reagent-setup` | Sở hữu evidence, action, state và recovery của labware and reagent setup. | Theo sau `transfer-programmer` trong semantic order và dùng đúng selected context của vùng đó. |
| `source-well-grid` | Sở hữu evidence, action, state và recovery của source well grid. | Đồng bộ hai chiều với `labware-and-reagent-setup` trong cùng selected context. |
| `destination-well-grid` | Sở hữu evidence, action, state và recovery của destination well grid. | Đồng bộ hai chiều với `source-well-grid` trong cùng selected context. |
| `ordered-transfer-program` | Sở hữu evidence, action, state và recovery của ordered transfer program. | Theo sau `destination-well-grid` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-transfer-volume-and-tip-policy` | Sở hữu evidence, action, state và recovery của selected transfer volume and tip policy. | Theo sau `ordered-transfer-program` trong semantic order và dùng đúng selected context của vùng đó. |
| `volume-and-contamination-validator` | Sở hữu evidence, action, state và recovery của volume and contamination validator. | Theo sau `selected-transfer-volume-and-tip-policy` trong semantic order và dùng đúng selected context của vùng đó. |
| `run-review-and-export` | Sở hữu evidence, action, state và recovery của run review and export. | Theo sau `volume-and-contamination-validator` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Source and destination grids, selected transfer, ordered program and invariant ledger remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `source-well-grid` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Plate grids stack around the transfer program; connector arcs yield while coordinate labels remain explicit.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `source-well-grid` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Select source coordinates → select destinations → set volume/tip policy → review ordered operations → validate/run; persistent totals replace simultaneous miniature plates.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `source-well-grid` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `transfer-programmer → labware-and-reagent-setup → source-well-grid → destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export`.
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
| Khởi đầu / loading | `labware-and-reagent-setup` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `source-well-grid` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `destination-well-grid` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `ordered-transfer-program` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `volume-and-contamination-validator` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `run-review-and-export` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `run-review-and-export` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `labware-and-reagent-setup` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `run-review-and-export` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `transfer-programmer` | Giữ selected entity, query, state và recovery khi topology đổi. |
| labware loading/mismatch | `labware-and-reagent-setup` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| well empty/over-capacity | `source-well-grid` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| source insufficient | `destination-well-grid` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| destination overflow | `ordered-transfer-program` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| tip policy safe/unsafe | `selected-transfer-volume-and-tip-policy` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| contamination conflict | `volume-and-contamination-validator` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| operation reordered | `run-review-and-export` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| validation stale | `run-review-and-export` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| run blocked and export success. | `run-review-and-export` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must create transfers without drag, update both well volumes, catch overflow and tip-contamination conflicts, reorder with buttons and validate the final executable sequence.

### Từ chối

- Từ chối dual-list transfer; đây là evidence `AR-LT-90` và phải route sang archetype khác.
- Từ chối spreadsheet; đây là evidence `AR-LT-91` và phải route sang archetype khác.
- Từ chối generic workflow; đây là evidence `AR-LT-92` và phải route sang archetype khác.
- Từ chối sample lineage viewer; đây là evidence `AR-LT-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-LT-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [SLAS — Microplate Standards](https://www.slas.org/resources/standards/ansi-slas-microplate-runtime/standards/) | Hỗ trợ well geometry and plate interoperability. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [SiLA — Core Specification](https://sila-standard.com/wp-content/uploads/2022/03/SiLA-2-Part-A-Overview-Concepts-and-Core-Specification-v1.1.pdf) | Hỗ trợ executable laboratory operations and validation. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Hỗ trợ keyboard-operable coordinate grids. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "well-to-well-liquid-transfer-programmer",
  "situationCodes": [
    "<matched AR-LT-* codes>"
  ],
  "searchAliases": [
    "microplate transfer program",
    "well coordinate transfer",
    "tip contamination control",
    "volume conservation"
  ],
  "dominantTask": "Program and verify coordinate-addressed liquid transfers while preserving source and destination volume, operation order, tip use and contamination constraints.",
  "regions": [
    "transfer-programmer",
    "labware-and-reagent-setup",
    "source-well-grid",
    "destination-well-grid",
    "ordered-transfer-program",
    "selected-transfer-volume-and-tip-policy",
    "volume-and-contamination-validator",
    "run-review-and-export"
  ],
  "regionRelationships": [
    "transfer-programmer → labware-and-reagent-setup → source-well-grid ↔ destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "transfer-programmer → labware-and-reagent-setup → source-well-grid → destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "source-well-grid",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "labware loading/mismatch",
    "well empty/over-capacity",
    "source insufficient",
    "destination overflow",
    "tip policy safe/unsafe",
    "contamination conflict",
    "operation reordered",
    "validation stale",
    "run blocked and export success."
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

