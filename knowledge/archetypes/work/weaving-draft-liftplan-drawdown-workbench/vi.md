# Weaving draft liftplan drawdown workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `weaving-draft-liftplan-drawdown-workbench` |
| Family | Work |
| Dominant task | Tạo một loom draft thi hành được bằng threading, tie-up hoặc liftplan và treadling liên kết, rồi suy ra drawdown và sửa lỗi cấu trúc hoặc khả thi của loom. |
| Search aliases | weaving draft, liftplan drawdown, loom feasibility |
| Authority | Authority topology page trung lập với product; archetype không chọn product semantics, visual direction, token, component, geometry chính xác hoặc breakpoint. |

### Invariants

- `weaving-draft` sở hữu toàn bộ dominant task, work state và recovery boundary.
- Tạo một loom draft thi hành được bằng threading, tie-up hoặc liftplan và treadling liên kết, rồi suy ra drawdown và sửa lỗi cấu trúc hoặc khả thi của loom.
- Mọi region bắt buộc giữ owner, quan hệ và stable identity đã đặt tên; Grammar chỉ gắn owner theo product.
- Wide, intermediate và compact đổi topology khi một quan hệ đã đặt tên thất bại, không theo device label.
- Transformation giữ selection, draft, pending work, error, recovery, reading order và nghĩa của focus.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `WEA-01` | Tạo một loom draft thi hành được bằng threading, tie-up hoặc liftplan và treadling liên kết, rồi suy ra drawdown và sửa lỗi cấu trúc hoặc khả thi của loom. | Bằng chứng dương bắt buộc. |
| `WEA-02` | Mọi region và quan hệ bắt buộc trong graph đều cần để hoàn tất task. | Yêu cầu graph đầy đủ. |
| `WEA-03` | Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Edit threading cell E14/S5 → Change pick 9 lift selection → Recompute drawdown and expose 7-end float → Correct lift set with button controls → Recompute selvedge and loom checks → Approve executable draft WD-009. | Yêu cầu proof path đặc thù của domain. |
| `WEA-04` | Work state phải tồn tại qua cả ba topology response đã đặt tên. | Yêu cầu responsive parity. |
| `WEA-05` | Các state literal của domain được giữ nguyên để đồng bộ runtime: loom profile valid/mismatched, threading incomplete/valid, tie-up asymmetric/valid, liftplan conflict, treadling draft/complete, drawdown stale/recomputed, float acceptable/excessive, selvedge stable/open, repeat aligned/broken, sample pending/accepted and export current/superseded. | Yêu cầu bao phủ state và recovery. |
| `WEA-90` | Từ chối khi candidate thuộc adjacent archetype `palette-and-token-workbench`, `canvas-inspector-workspace` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state. | Reject. |
| `WEA-91` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |
| `WEA-92` | Một adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |

### Selection rule

Chọn `weaving-draft-liftplan-drawdown-workbench` khi và chỉ khi các code `WEA-01`–`05` đều có bằng chứng và không có code `WEA-90`–`92`. Trả `needs-evidence` nếu dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
weaving-draft
├─ loom-shaft-treadle-and-fabric-spec (downstream)
├─ warp-thread-order-and-shaft-threading-matrix (downstream)
├─ treadle-to-shaft-tieup-or-liftplan-matrix (peer synchronization)
├─ pick-by-treadle-sequence (peer synchronization)
├─ derived-warp-weft-interlacement-drawdown (downstream)
├─ float-selvedge-repeat-and-loom-feasibility-validation (downstream)
├─ color-and-structure-simulation (downstream)
├─ corrected-executable-draft (downstream)
└─ export-and-sample-proof (downstream)
```

Biểu thức quan hệ binding là `weaving-draft → loom-shaft-treadle-and-fabric-spec → warp-thread-order-and-shaft-threading-matrix ↔ treadle-to-shaft-tieup-or-liftplan-matrix ↔ pick-by-treadle-sequence → derived-warp-weft-interlacement-drawdown → float-selvedge-repeat-and-loom-feasibility-validation → color-and-structure-simulation → corrected-executable-draft → export-and-sample-proof`; các operator giữ nghĩa directed, peer hoặc joint-axis đã khai báo trong prompt.

### Region obligations

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `weaving-draft` | weaving-draft sở hữu bằng chứng và trạng thái của chính vùng này; sở hữu boundary của dominant task và truyền identity không đổi tới `loom-shaft-treadle-and-fabric-spec`. Vùng này không hấp thụ owner của vùng khác. |
| `loom-shaft-treadle-and-fabric-spec` | loom-shaft-treadle-and-fabric-spec sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `weaving-draft` và truyền identity không đổi tới `warp-thread-order-and-shaft-threading-matrix`. Vùng này không hấp thụ owner của vùng khác. |
| `warp-thread-order-and-shaft-threading-matrix` | warp-thread-order-and-shaft-threading-matrix sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `loom-shaft-treadle-and-fabric-spec` và truyền identity không đổi tới `treadle-to-shaft-tieup-or-liftplan-matrix`. Vùng này không hấp thụ owner của vùng khác. |
| `treadle-to-shaft-tieup-or-liftplan-matrix` | treadle-to-shaft-tieup-or-liftplan-matrix sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ ↔ với upstream `warp-thread-order-and-shaft-threading-matrix` và truyền identity không đổi tới `pick-by-treadle-sequence`. Vùng này không hấp thụ owner của vùng khác. |
| `pick-by-treadle-sequence` | pick-by-treadle-sequence sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ ↔ với upstream `treadle-to-shaft-tieup-or-liftplan-matrix` và truyền identity không đổi tới `derived-warp-weft-interlacement-drawdown`. Vùng này không hấp thụ owner của vùng khác. |
| `derived-warp-weft-interlacement-drawdown` | derived-warp-weft-interlacement-drawdown sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `pick-by-treadle-sequence` và truyền identity không đổi tới `float-selvedge-repeat-and-loom-feasibility-validation`. Vùng này không hấp thụ owner của vùng khác. |
| `float-selvedge-repeat-and-loom-feasibility-validation` | float-selvedge-repeat-and-loom-feasibility-validation sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `derived-warp-weft-interlacement-drawdown` và truyền identity không đổi tới `color-and-structure-simulation`. Vùng này không hấp thụ owner của vùng khác. |
| `color-and-structure-simulation` | color-and-structure-simulation sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `float-selvedge-repeat-and-loom-feasibility-validation` và truyền identity không đổi tới `corrected-executable-draft`. Vùng này không hấp thụ owner của vùng khác. |
| `corrected-executable-draft` | corrected-executable-draft sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `color-and-structure-simulation` và truyền identity không đổi tới `export-and-sample-proof`. Vùng này không hấp thụ owner của vùng khác. |
| `export-and-sample-proof` | export-and-sample-proof sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `corrected-executable-draft`; phát hành completion evidence. Vùng này không hấp thụ owner của vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Một quan hệ bằng chứng đồng thời đã đặt tên không còn đủ measure để đọc, thao tác và giữ focus không bị che.
- **Topology response:** Giữ đồng thời context, chuỗi bằng chứng chính, phép kiểm tra active và completion proof; topology chỉ chuyển khi quan hệ so sánh không còn đủ chỗ đọc và thao tác.
- **Navigation replacement:** Không; truy cập trực tiếp vào region vẫn vừa và bằng chứng liên quan còn đồng thời.
- **Sticky boundary:** Chỉ current scope hoặc primary action được sticky sau khi reserve space; short height đưa nó về normal flow.
- **Overflow owner:** Chỉ region có bản chất table, matrix, graph, timeline, notation hoặc media sở hữu bounded overflow; page không sở hữu horizontal overflow.

### Intermediate

- **Failure trigger:** Toàn bộ support scope không còn có thể persistent cạnh active proof mà vẫn giữ readable measure và focus.
- **Topology response:** Giữ quyết định active cùng bằng chứng trực tiếp làm primary; context tổng thể và history trở thành panel đồng bộ, không làm mất selection hoặc draft.
- **Navigation replacement:** Stage hoặc drawer có label mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Active proof chỉ được sticky khi reserved space giữ mọi focused control hiển thị; short height phải yield.
- **Overflow owner:** Cùng bounded intrinsic region vẫn là overflow owner duy nhất; temporary support không tạo nested page scroll.

### Compact

- **Failure trigger:** Active decision và minimum proof không còn vừa side by side ở readable measure.
- **Topology response:** Tái cấu trúc dominant task thành một route primary theo semantic order `weaving-draft → loom-shaft-treadle-and-fabric-spec → warp-thread-order-and-shaft-threading-matrix ↔ treadle-to-shaft-tieup-or-liftplan-matrix ↔ pick-by-treadle-sequence → derived-warp-weft-interlacement-drawdown → float-selvedge-repeat-and-loom-feasibility-validation → color-and-structure-simulation → corrected-executable-draft → export-and-sample-proof`; support mở theo stage và không tạo horizontal scroll cấp trang.
- **Navigation replacement:** Route stage một-pane có label thay simultaneous columns và giữ chính xác active object cùng recovery target.
- **Sticky boundary:** Chỉ action của current stage được sticky với safe-area spacing; landscape hoặc short height đưa nó về flow.
- **Overflow owner:** Không horizontal scroll cấp page; bằng chứng hai chiều dùng một bounded region có label hoặc semantic list thay thế.

### Reflow

- DOM order, reading order, and meaningful focus order are `weaving-draft → loom-shaft-treadle-and-fabric-spec → warp-thread-order-and-shaft-threading-matrix ↔ treadle-to-shaft-tieup-or-liftplan-matrix ↔ pick-by-treadle-sequence → derived-warp-weft-interlacement-drawdown → float-selvedge-repeat-and-loom-feasibility-validation → color-and-structure-simulation → corrected-executable-draft → export-and-sample-proof`; CSS never reorders semantics.
- Label dài, bản dịch, zoom 400% và text phóng lớn wrap mà không mất action hoặc nghĩa state.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape hoặc Cancel và trả về đúng trigger với work context nguyên vẹn.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics bên cạnh color rồi announce mà không cướp focus.
- Validation giữ input, lộ inline error, focus summary cho nhiều lỗi và cung cấp recovery cụ thể.
- Các state literal của domain được giữ nguyên để đồng bộ runtime: loom profile valid/mismatched, threading incomplete/valid, tie-up asymmetric/valid, liftplan conflict, treadling draft/complete, drawdown stale/recomputed, float acceptable/excessive, selvedge stable/open, repeat aligned/broken, sample pending/accepted and export current/superseded.

## State obligations

Các state literal của domain được giữ nguyên để đồng bộ runtime: loom profile valid/mismatched, threading incomplete/valid, tie-up asymmetric/valid, liftplan conflict, treadling draft/complete, drawdown stale/recomputed, float acceptable/excessive, selvedge stable/open, repeat aligned/broken, sample pending/accepted and export current/superseded.

| Nhóm trạng thái | Hành vi bắt buộc |
|---|---|
| Initial / loading | Nêu scope đang load, giữ chỗ cho primary region và chỉ block vùng thất bại. |
| Ready | Hiển thị object hiện tại, owner relationship và action hợp lệ bằng text cùng semantics. |
| Empty / not-applicable | Phân biệt empty thật, no-match và non-applicable; cung cấp next action phù hợp. |
| Error / retry | Nêu scope lỗi, giữ input/work state và đưa ra target retry hoặc correction có focus. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và vẫn giữ context. |
| Pending | Ngăn duplicate, giữ context, cho phép Cancel khi an toàn và announce progress. |
| Success | Xác nhận scope đã đổi, cập nhật summary liên quan và giữ next step hoặc Undo khi cần. |
| Stale / conflict | So sánh local/external state, không overwrite ngầm và giữ recovery xác định. |
| Focus transition | Stage do user kích hoạt focus heading mới; status-only update không di chuyển focus; modal trả focus về trigger. |
| Responsive presentation | Wide giữ simultaneity; intermediate biến support thấp nhất thành temporary; compact dùng một primary stage với parity. |

## Boundaries

### Accept

- Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Edit threading cell E14/S5 → Change pick 9 lift selection → Recompute drawdown and expose 7-end float → Correct lift set with button controls → Recompute selvedge and loom checks → Approve executable draft WD-009.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Từ chối khi candidate thuộc adjacent archetype `palette-and-token-workbench`, `canvas-inspector-workspace` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `WEA-90`–`92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này resolve dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar gắn product-semantic owner vào region và state mà không đổi topology.
4. Principles resolve grid, measure, gap, size, alignment, overflow và content-fit breakpoint chính xác.
5. Direction biểu đạt visual character bên trong owner đã accept.

## Non-binding research evidence

### Evidence boundary

Research dưới đây chỉ là bằng chứng tư vấn, không phải product truth. Nó không cấp quyền sao chép geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi claim binding vẫn đi qua business truth, Grammar và Principles.

### Sources

| Nguồn | Nguồn hỗ trợ | Nguồn không chứng minh |
|---|---|---|
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Cung cấp bằng chứng chính thức về hành vi accessibility, reflow, focus và status. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Cung cấp bằng chứng chính thức về hành vi accessibility, reflow, focus và status. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [Weavers' Guild of Boston weaving-draft definitions](https://www.weaversguildofboston.org/_files/ugd/c50db8_b78ed82b8ca74e45ac7203fa3b087bd3.pdf) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [Black Mountain College Museum digital weaving project](https://www.blackmountaincollege.org/?p=37224) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |

## Output

| Trường | Contract |
|---|---|
| `archetypeId` | Fixed value `weaving-draft-liftplan-drawdown-workbench`. |
| `situationCodes` | Các code đã match từ record này. |
| `searchAliases` | Các alias đã route tới match. |
| `dominantTask` | Một câu task trung lập với product. |
| `regions` | Các required region ID có thứ tự. |
| `regionRelationships` | Các quan hệ owner, peer, joint-axis, supporting, temporary và downstream. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Các state family task-specific và common áp dụng được. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Owner region và state theo product-semantic để lại cho Grammar. |
| `principlesHandoff` | Geometry, fit threshold và emitted layout chính xác để lại cho Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Các lớp evidence business, current-source và research không bịa fact. |

```json
{"archetypeId":"weaving-draft-liftplan-drawdown-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
