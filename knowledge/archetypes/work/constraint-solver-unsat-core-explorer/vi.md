# Bộ khám phá unsat core của constraint solver

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `constraint-solver-unsat-core-explorer` |
| Family | Work |
| Dominant task | Giải thích vì sao constraint model không có solution, cô lập minimal conflicting sets, thử relaxation rõ ràng và tạo satisfiable witness hoặc impossibility receipt. |
| Search aliases | `unsat core explorer`, `minimal conflict set`, `constraint relaxation`, `satisfiable witness` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Giải thích vì sao constraint model không có solution, cô lập minimal conflicting sets, thử relaxation rõ ràng và tạo satisfiable witness hoặc impossibility receipt.
- Required region graph luôn là `unsat-explorer → model-version-and-solve-context → variable-domain-register ↔ constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-UC-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-UC-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-UC-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-UC-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-UC-05` | Template must expose at least two cores, trace a constraint to source, preview a relaxation, rerun to a witness or receipt and preserve core/constraint/focus identity across topology changes. | Required evidence. |
| `AR-UC-90` | configuration-dependency-resolver | Từ chối. |
| `AR-UC-91` | formal-proof-obligation-workbench | Từ chối. |
| `AR-UC-92` | rule/query builder | Từ chối. |
| `AR-UC-93` | generic error list | Từ chối. |

### Quy tắc chọn

Chỉ chọn `constraint-solver-unsat-core-explorer` khi `AR-UC-01` đến `AR-UC-05` đều có evidence và không có mã `AR-UC-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
unsat-explorer
   `-- model-version-and-solve-context
      `-- variable-domain-register
         `-- constraint-dependency-graph
            `-- solve-result-and-core-set
               `-- selected-core-constraint-provenance
                  `-- relaxation-candidates-and-counterfactuals
                     `-- rerun-witness-or-impossibility-receipt
```

Biểu thức relationship đã khai báo: `unsat-explorer → model-version-and-solve-context → variable-domain-register ↔ constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `unsat-explorer` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `model-version-and-solve-context` | Sở hữu evidence, action, state và recovery của model version and solve context. | Theo sau `unsat-explorer` trong semantic order và dùng đúng selected context của vùng đó. |
| `variable-domain-register` | Sở hữu evidence, action, state và recovery của variable domain register. | Đồng bộ hai chiều với `model-version-and-solve-context` trong cùng selected context. |
| `constraint-dependency-graph` | Sở hữu evidence, action, state và recovery của constraint dependency graph. | Đồng bộ hai chiều với `variable-domain-register` trong cùng selected context. |
| `solve-result-and-core-set` | Sở hữu evidence, action, state và recovery của solve result and core set. | Theo sau `constraint-dependency-graph` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-core-constraint-provenance` | Sở hữu evidence, action, state và recovery của selected core constraint provenance. | Theo sau `solve-result-and-core-set` trong semantic order và dùng đúng selected context của vùng đó. |
| `relaxation-candidates-and-counterfactuals` | Sở hữu evidence, action, state và recovery của relaxation candidates and counterfactuals. | Theo sau `selected-core-constraint-provenance` trong semantic order và dùng đúng selected context của vùng đó. |
| `rerun-witness-or-impossibility-receipt` | Sở hữu evidence, action, state và recovery của rerun witness or impossibility receipt. | Theo sau `relaxation-candidates-and-counterfactuals` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Constraint graph, core set, selected provenance and relaxation/witness comparison remain simultaneous.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `constraint-dependency-graph` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Core list and selected provenance remain primary; graph and candidate relaxations become synchronized panes while solve context persists.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `constraint-dependency-graph` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Failed solve → one core → implicated constraints/provenance → choose relaxation → rerun → witness or receipt; graph becomes an accessible relation/path ledger.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `constraint-dependency-graph` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `unsat-explorer → model-version-and-solve-context → variable-domain-register → constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt`.
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
| Khởi đầu / loading | `model-version-and-solve-context` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `variable-domain-register` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `constraint-dependency-graph` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `solve-result-and-core-set` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `relaxation-candidates-and-counterfactuals` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `rerun-witness-or-impossibility-receipt` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `rerun-witness-or-impossibility-receipt` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `model-version-and-solve-context` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `rerun-witness-or-impossibility-receipt` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `unsat-explorer` | Giữ selected entity, query, state và recovery khi topology đổi. |
| parse/compile failure | `model-version-and-solve-context` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| solve sat/unsat/unknown | `variable-domain-register` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| core unavailable/nonminimal/multiple | `constraint-dependency-graph` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| source mapping missing | `solve-result-and-core-set` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| relaxation valid/unsafe | `selected-core-constraint-provenance` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| rerun pending/timeout | `relaxation-candidates-and-counterfactuals` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| witness found and impossibility receipt issued. | `rerun-witness-or-impossibility-receipt` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must expose at least two cores, trace a constraint to source, preview a relaxation, rerun to a witness or receipt and preserve core/constraint/focus identity across topology changes.

### Từ chối

- Từ chối configuration-dependency-resolver; đây là evidence `AR-UC-90` và phải route sang archetype khác.
- Từ chối formal-proof-obligation-workbench; đây là evidence `AR-UC-91` và phải route sang archetype khác.
- Từ chối rule/query builder; đây là evidence `AR-UC-92` và phải route sang archetype khác.
- Từ chối generic error list; đây là evidence `AR-UC-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-UC-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [Microsoft — Z3 Guide](https://microsoft.github.io/z3guide/docs/logic/basiccommands/) | Hỗ trợ solver results, models, and assertions. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [MiniZinc — FindMUS](https://docs.minizinc.dev/en/latest/find_mus.html) | Hỗ trợ minimal unsatisfiable subsets and source locations. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [SMT-LIB — Current Language](https://smt-lib.org/language.shtml) | Hỗ trợ solver language and result interoperability. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ stable focus across graph-to-ledger transformations. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "constraint-solver-unsat-core-explorer",
  "situationCodes": [
    "<matched AR-UC-* codes>"
  ],
  "searchAliases": [
    "unsat core explorer",
    "minimal conflict set",
    "constraint relaxation",
    "satisfiable witness"
  ],
  "dominantTask": "Explain why one constraint model has no solution, isolate minimal conflicting constraint sets, test explicit relaxations and produce either a satisfiable witness or an impossibility receipt.",
  "regions": [
    "unsat-explorer",
    "model-version-and-solve-context",
    "variable-domain-register",
    "constraint-dependency-graph",
    "solve-result-and-core-set",
    "selected-core-constraint-provenance",
    "relaxation-candidates-and-counterfactuals",
    "rerun-witness-or-impossibility-receipt"
  ],
  "regionRelationships": [
    "unsat-explorer → model-version-and-solve-context → variable-domain-register ↔ constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "unsat-explorer → model-version-and-solve-context → variable-domain-register → constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "constraint-dependency-graph",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "parse/compile failure",
    "solve sat/unsat/unknown",
    "core unavailable/nonminimal/multiple",
    "source mapping missing",
    "relaxation valid/unsafe",
    "rerun pending/timeout",
    "witness found and impossibility receipt issued."
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

