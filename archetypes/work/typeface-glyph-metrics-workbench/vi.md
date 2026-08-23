# Workbench metric và glyph typeface

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `typeface-glyph-metrics-workbench` |
| Family | Work |
| Dominant task | Author repertoire font nhất quán bằng cách reconcile glyph outline, anchor và metrics với pair/class spacing, shaping tests và whole-font specimen proof. |
| Search aliases | `glyph metrics editor`, `kerning pair workbench`, `font shaping proof`, `outline anchor validation` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Author repertoire font nhất quán bằng cách reconcile glyph outline, anchor và metrics với pair/class spacing, shaping tests và whole-font specimen proof.
- Required region graph luôn là `typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor ↔ metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-TG-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-TG-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-TG-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-TG-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-TG-05` | Template must edit a glyph through coordinate controls, update metrics, inspect a kerning pair and shaping run, expose a validation failure and update the specimen from the same source. | Required evidence. |
| `AR-TG-90` | generic canvas inspector | Từ chối. |
| `AR-TG-91` | vector editor | Từ chối. |
| `AR-TG-92` | asset grid | Từ chối. |
| `AR-TG-93` | typography settings | Từ chối. |

### Quy tắc chọn

Chỉ chọn `typeface-glyph-metrics-workbench` khi `AR-TG-01` đến `AR-TG-05` đều có evidence và không có mã `AR-TG-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
typeface-workbench
   `-- glyph-repertoire-grid
      `-- selected-glyph-outline-editor
         `-- metrics-and-anchor-inspector
            `-- kerning-pair-or-class-editor
               `-- script-shaping-test-runs
                  `-- specimen-proof
                     `-- font-validation-and-export
```

Biểu thức relationship đã khai báo: `typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor ↔ metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `typeface-workbench` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `glyph-repertoire-grid` | Sở hữu evidence, action, state và recovery của glyph repertoire grid. | Theo sau `typeface-workbench` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-glyph-outline-editor` | Sở hữu evidence, action, state và recovery của selected glyph outline editor. | Đồng bộ hai chiều với `glyph-repertoire-grid` trong cùng selected context. |
| `metrics-and-anchor-inspector` | Sở hữu evidence, action, state và recovery của metrics and anchor inspector. | Đồng bộ hai chiều với `selected-glyph-outline-editor` trong cùng selected context. |
| `kerning-pair-or-class-editor` | Sở hữu evidence, action, state và recovery của kerning pair or class editor. | Theo sau `metrics-and-anchor-inspector` trong semantic order và dùng đúng selected context của vùng đó. |
| `script-shaping-test-runs` | Sở hữu evidence, action, state và recovery của script shaping test runs. | Theo sau `kerning-pair-or-class-editor` trong semantic order và dùng đúng selected context của vùng đó. |
| `specimen-proof` | Sở hữu evidence, action, state và recovery của specimen proof. | Theo sau `script-shaping-test-runs` trong semantic order và dùng đúng selected context của vùng đó. |
| `font-validation-and-export` | Sở hữu evidence, action, state và recovery của font validation and export. | Theo sau `specimen-proof` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Glyph repertoire, outline editor, metrics inspector and bounded kerning/shaping/specimen regions remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `glyph-repertoire-grid` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Repertoire becomes a drawer; outline stays primary while metrics, pair tests and proof become synchronized tabs.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `glyph-repertoire-grid` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Glyph selector → outline editor → numeric metrics/anchors → pair or shaping test → specimen/validation; point movement has coordinate and keyboard alternatives.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `glyph-repertoire-grid` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor → metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export`.
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
| Khởi đầu / loading | `glyph-repertoire-grid` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `selected-glyph-outline-editor` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `metrics-and-anchor-inspector` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `kerning-pair-or-class-editor` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `specimen-proof` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `font-validation-and-export` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `font-validation-and-export` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `glyph-repertoire-grid` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `font-validation-and-export` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `typeface-workbench` | Giữ selected entity, query, state và recovery khi topology đổi. |
| font loading | `glyph-repertoire-grid` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| glyph missing/draft/complete | `selected-glyph-outline-editor` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| contour open/invalid | `metrics-and-anchor-inspector` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| metric conflict | `kerning-pair-or-class-editor` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| anchor missing | `script-shaping-test-runs` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| pair override/class conflict | `specimen-proof` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| shaping pass/fail | `font-validation-and-export` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| specimen stale and export warning/failure. | `font-validation-and-export` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must edit a glyph through coordinate controls, update metrics, inspect a kerning pair and shaping run, expose a validation failure and update the specimen from the same source.

### Từ chối

- Từ chối generic canvas inspector; đây là evidence `AR-TG-90` và phải route sang archetype khác.
- Từ chối vector editor; đây là evidence `AR-TG-91` và phải route sang archetype khác.
- Từ chối asset grid; đây là evidence `AR-TG-92` và phải route sang archetype khác.
- Từ chối typography settings; đây là evidence `AR-TG-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-TG-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [Microsoft — OpenType Kerning](https://learn.microsoft.com/en-us/typography/opentype/spec/kern) | Hỗ trợ kerning pairs, classes, and font units. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Apple — TrueType Reference Manual](https://developer.apple.com/fonts/TrueType-Reference-Manual/index.html) | Hỗ trợ glyph outlines, anchors, metrics, and font tables. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Hỗ trợ non-drag coordinate alternatives. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "typeface-glyph-metrics-workbench",
  "situationCodes": [
    "<matched AR-TG-* codes>"
  ],
  "searchAliases": [
    "glyph metrics editor",
    "kerning pair workbench",
    "font shaping proof",
    "outline anchor validation"
  ],
  "dominantTask": "Author a coherent font repertoire by reconciling glyph outlines, anchors and metrics with pair or class spacing, shaping tests and whole-font specimen proof.",
  "regions": [
    "typeface-workbench",
    "glyph-repertoire-grid",
    "selected-glyph-outline-editor",
    "metrics-and-anchor-inspector",
    "kerning-pair-or-class-editor",
    "script-shaping-test-runs",
    "specimen-proof",
    "font-validation-and-export"
  ],
  "regionRelationships": [
    "typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor ↔ metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor → metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "glyph-repertoire-grid",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "font loading",
    "glyph missing/draft/complete",
    "contour open/invalid",
    "metric conflict",
    "anchor missing",
    "pair override/class conflict",
    "shaping pass/fail",
    "specimen stale and export warning/failure."
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

