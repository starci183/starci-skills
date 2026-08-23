# Bộ khám phá litmus nhất quán bộ nhớ

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `memory-consistency-litmus-explorer` |
| Family | Work |
| Dominant task | Quyết định outcome của concurrent program được phép hay bị cấm dưới memory model đã chọn và giải thích ordering relation, read source hoặc fence chịu trách nhiệm. |
| Search aliases | `memory model litmus`, `allowed outcome witness`, `happens-before explorer`, `fence legality` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Quyết định outcome của concurrent program được phép hay bị cấm dưới memory model đã chọn và giải thích ordering relation, read source hoặc fence chịu trách nhiệm.
- Required region graph luôn là `litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-MC-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-MC-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-MC-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-MC-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-MC-05` | Template must switch models, classify an outcome, expose a textual read-from/happens-before witness, show how adding a fence changes legality and preserve the selected outcome. | Required evidence. |
| `AR-MC-90` | distributed trace monitor | Từ chối. |
| `AR-MC-91` | code runner | Từ chối. |
| `AR-MC-92` | dependency graph | Từ chối. |
| `AR-MC-93` | log viewer | Từ chối. |

### Quy tắc chọn

Chỉ chọn `memory-consistency-litmus-explorer` khi `AR-MC-01` đến `AR-MC-05` đều có evidence và không có mã `AR-MC-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
litmus-explorer
   `-- litmus-program
      `-- per-thread-program-order-lanes
         `-- memory-model-selector
            `-- candidate-outcome-set
               `-- selected-outcome
                  `-- happens-before-and-read-from-witness
                     `-- rule-or-fence-explanation
```

Biểu thức relationship đã khai báo: `litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `litmus-explorer` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `litmus-program` | Sở hữu evidence, action, state và recovery của litmus program. | Theo sau `litmus-explorer` trong semantic order và dùng đúng selected context của vùng đó. |
| `per-thread-program-order-lanes` | Sở hữu evidence, action, state và recovery của per thread program order lanes. | Theo sau `litmus-program` trong semantic order và dùng đúng selected context của vùng đó. |
| `memory-model-selector` | Sở hữu evidence, action, state và recovery của memory model selector. | Theo sau `per-thread-program-order-lanes` trong semantic order và dùng đúng selected context của vùng đó. |
| `candidate-outcome-set` | Sở hữu evidence, action, state và recovery của candidate outcome set. | Theo sau `memory-model-selector` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-outcome` | Sở hữu evidence, action, state và recovery của selected outcome. | Theo sau `candidate-outcome-set` trong semantic order và dùng đúng selected context của vùng đó. |
| `happens-before-and-read-from-witness` | Sở hữu evidence, action, state và recovery của happens before and read from witness. | Theo sau `selected-outcome` trong semantic order và dùng đúng selected context của vùng đó. |
| `rule-or-fence-explanation` | Sở hữu evidence, action, state và recovery của rule or fence explanation. | Theo sau `happens-before-and-read-from-witness` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Thread lanes, outcome matrix, selected relation witness and rule explanation remain linked.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `per-thread-program-order-lanes` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Thread lanes stack above outcomes; the selected witness opens beside them while model rules use a drawer.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `per-thread-program-order-lanes` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Outcome list → selected per-thread witness sequence → relations → satisfied/violated rule explanation; graph transforms to an accessible relation ledger.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `per-thread-program-order-lanes` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation`.
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
| Khởi đầu / loading | `litmus-program` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `per-thread-program-order-lanes` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `memory-model-selector` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `candidate-outcome-set` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `happens-before-and-read-from-witness` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `rule-or-fence-explanation` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `rule-or-fence-explanation` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `litmus-program` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `rule-or-fence-explanation` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `litmus-explorer` | Giữ selected entity, query, state và recovery khi topology đổi. |
| program parsing/error | `litmus-program` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| model loading | `per-thread-program-order-lanes` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| outcome allowed/forbidden/unknown | `memory-model-selector` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| exploration running/partial | `candidate-outcome-set` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| witness found/missing | `selected-outcome` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| relation cycle | `happens-before-and-read-from-witness` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| fence added | `rule-or-fence-explanation` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| result stale and share/export. | `rule-or-fence-explanation` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must switch models, classify an outcome, expose a textual read-from/happens-before witness, show how adding a fence changes legality and preserve the selected outcome.

### Từ chối

- Từ chối distributed trace monitor; đây là evidence `AR-MC-90` và phải route sang archetype khác.
- Từ chối code runner; đây là evidence `AR-MC-91` và phải route sang archetype khác.
- Từ chối dependency graph; đây là evidence `AR-MC-92` và phải route sang archetype khác.
- Từ chối log viewer; đây là evidence `AR-MC-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-MC-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [RISC-V — RVWMO](https://docs.riscv.org/reference/isa/unpriv/rvwmo.html) | Hỗ trợ memory ordering rules and legal executions. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Linux Kernel — Litmus Tests](https://docs.kernel.org/dev-tools/lkmm/docs/litmus-tests.html) | Hỗ trợ litmus outcomes, witnesses, and fences. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Accessible Tables](https://www.w3.org/WAI/tutorials/tables/) | Hỗ trợ structural equivalents for outcome matrices. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "memory-consistency-litmus-explorer",
  "situationCodes": [
    "<matched AR-MC-* codes>"
  ],
  "searchAliases": [
    "memory model litmus",
    "allowed outcome witness",
    "happens-before explorer",
    "fence legality"
  ],
  "dominantTask": "Determine whether a concurrent program outcome is permitted under a selected memory model and explain the ordering relation, read source or fence responsible.",
  "regions": [
    "litmus-explorer",
    "litmus-program",
    "per-thread-program-order-lanes",
    "memory-model-selector",
    "candidate-outcome-set",
    "selected-outcome",
    "happens-before-and-read-from-witness",
    "rule-or-fence-explanation"
  ],
  "regionRelationships": [
    "litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "per-thread-program-order-lanes",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "program parsing/error",
    "model loading",
    "outcome allowed/forbidden/unknown",
    "exploration running/partial",
    "witness found/missing",
    "relation cycle",
    "fence added",
    "result stale and share/export."
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

