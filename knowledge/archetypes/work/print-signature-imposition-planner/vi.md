# Bộ lập kế hoạch imposition signature in

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `print-signature-imposition-planner` |
| Family | Work |
| Dominant task | Chuyển logical reading order thành press sheet và signature sao cho placement front/back, folding, binding, creep và blank tái tạo publication đúng. |
| Search aliases | `booklet imposition`, `signature sheet planner`, `fold bind reconstruction`, `physical page ordering` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Chuyển logical reading order thành press sheet và signature sao cho placement front/back, folding, binding, creep và blank tái tạo publication đúng.
- Required region graph luôn là `imposition-planner → publication-page-order → binding-stock-press-constraints → signature-plan → sheet-front-back-stage ↔ fold-bind-simulation → creep-bleed-marks-inspector → pagination-exception-ledger → imposed-output`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-PI-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-PI-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-PI-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-PI-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-PI-05` | Template must create signatures, toggle sheet sides, simulate fold/bind, expose a pagination exception and prove reconstructed reading order before output. | Required evidence. |
| `AR-PI-90` | print preflight | Từ chối. |
| `AR-PI-91` | packing optimizer | Từ chối. |
| `AR-PI-92` | generic page sorter | Từ chối. |
| `AR-PI-93` | document preview | Từ chối. |

### Quy tắc chọn

Chỉ chọn `print-signature-imposition-planner` khi `AR-PI-01` đến `AR-PI-05` đều có evidence và không có mã `AR-PI-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
imposition-planner
   `-- publication-page-order
      `-- binding-stock-press-constraints
         `-- signature-plan
            `-- sheet-front-back-stage
               `-- fold-bind-simulation
                  `-- creep-bleed-marks-inspector
                     `-- pagination-exception-ledger
                        `-- imposed-output
```

Biểu thức relationship đã khai báo: `imposition-planner → publication-page-order → binding-stock-press-constraints → signature-plan → sheet-front-back-stage ↔ fold-bind-simulation → creep-bleed-marks-inspector → pagination-exception-ledger → imposed-output`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `imposition-planner` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `publication-page-order` | Sở hữu evidence, action, state và recovery của publication page order. | Theo sau `imposition-planner` trong semantic order và dùng đúng selected context của vùng đó. |
| `binding-stock-press-constraints` | Sở hữu evidence, action, state và recovery của binding stock press constraints. | Theo sau `publication-page-order` trong semantic order và dùng đúng selected context của vùng đó. |
| `signature-plan` | Sở hữu evidence, action, state và recovery của signature plan. | Theo sau `binding-stock-press-constraints` trong semantic order và dùng đúng selected context của vùng đó. |
| `sheet-front-back-stage` | Sở hữu evidence, action, state và recovery của sheet front back stage. | Đồng bộ hai chiều với `signature-plan` trong cùng selected context. |
| `fold-bind-simulation` | Sở hữu evidence, action, state và recovery của fold bind simulation. | Đồng bộ hai chiều với `sheet-front-back-stage` trong cùng selected context. |
| `creep-bleed-marks-inspector` | Sở hữu evidence, action, state và recovery của creep bleed marks inspector. | Theo sau `fold-bind-simulation` trong semantic order và dùng đúng selected context của vùng đó. |
| `pagination-exception-ledger` | Sở hữu evidence, action, state và recovery của pagination exception ledger. | Theo sau `creep-bleed-marks-inspector` trong semantic order và dùng đúng selected context của vùng đó. |
| `imposed-output` | Sở hữu evidence, action, state và recovery của imposed output. | Theo sau `pagination-exception-ledger` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Logical page strip, signature navigator, selected sheet front/back, fold simulation and constraints remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `sheet-front-back-stage` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Signature navigation becomes a drawer; selected sheet and reconstructed result stay synchronized while constraints use a side sheet.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `sheet-front-back-stage` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Signature → sheet front/back → fold sequence → reconstructed reading order → exception resolution → output; no wall of printer spreads is required.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `sheet-front-back-stage` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `imposition-planner → publication-page-order → binding-stock-press-constraints → signature-plan → sheet-front-back-stage → fold-bind-simulation → creep-bleed-marks-inspector → pagination-exception-ledger → imposed-output`.
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
| Khởi đầu / loading | `publication-page-order` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `binding-stock-press-constraints` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `signature-plan` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `sheet-front-back-stage` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `pagination-exception-ledger` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `imposed-output` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `imposed-output` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `publication-page-order` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `imposed-output` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `imposition-planner` | Giữ selected entity, query, state và recovery khi topology đổi. |
| document loading | `publication-page-order` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| page count incompatible | `binding-stock-press-constraints` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| blank inserted | `signature-plan` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| signature valid/invalid | `sheet-front-back-stage` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| side front/back | `fold-bind-simulation` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| fold mismatch | `creep-bleed-marks-inspector` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| creep/bleed warning | `pagination-exception-ledger` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| reconstruction pass/fail and output pending. | `imposed-output` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must create signatures, toggle sheet sides, simulate fold/bind, expose a pagination exception and prove reconstructed reading order before output.

### Từ chối

- Từ chối print preflight; đây là evidence `AR-PI-90` và phải route sang archetype khác.
- Từ chối packing optimizer; đây là evidence `AR-PI-91` và phải route sang archetype khác.
- Từ chối generic page sorter; đây là evidence `AR-PI-92` và phải route sang archetype khác.
- Từ chối document preview; đây là evidence `AR-PI-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-PI-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [Adobe — Booklet Imposition](https://helpx.adobe.com/indesign/desktop/print/print-booklets/impose-documents-for-booklet-printing.html) | Hỗ trợ signatures, spreads, blanks, creep, and binding. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Apple — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Hỗ trợ adaptive region relationships. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ responsive access to two-dimensional sheet evidence. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "print-signature-imposition-planner",
  "situationCodes": [
    "<matched AR-PI-* codes>"
  ],
  "searchAliases": [
    "booklet imposition",
    "signature sheet planner",
    "fold bind reconstruction",
    "physical page ordering"
  ],
  "dominantTask": "Transform logical reading-order pages into press sheets and signatures whose front/back placement, folding, binding, creep and blanks produce the intended publication.",
  "regions": [
    "imposition-planner",
    "publication-page-order",
    "binding-stock-press-constraints",
    "signature-plan",
    "sheet-front-back-stage",
    "fold-bind-simulation",
    "creep-bleed-marks-inspector",
    "pagination-exception-ledger",
    "imposed-output"
  ],
  "regionRelationships": [
    "imposition-planner → publication-page-order → binding-stock-press-constraints → signature-plan → sheet-front-back-stage ↔ fold-bind-simulation → creep-bleed-marks-inspector → pagination-exception-ledger → imposed-output"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "imposition-planner → publication-page-order → binding-stock-press-constraints → signature-plan → sheet-front-back-stage → fold-bind-simulation → creep-bleed-marks-inspector → pagination-exception-ledger → imposed-output",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "sheet-front-back-stage",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "document loading",
    "page count incompatible",
    "blank inserted",
    "signature valid/invalid",
    "side front/back",
    "fold mismatch",
    "creep/bleed warning",
    "reconstruction pass/fail and output pending."
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

