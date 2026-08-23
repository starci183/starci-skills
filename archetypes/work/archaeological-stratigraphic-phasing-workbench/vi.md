# Archaeological stratigraphic phasing workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `archaeological-stratigraphic-phasing-workbench` |
| Family | Work |
| Dominant task | Dựng và bảo vệ một chuỗi địa tầng khảo cổ từ các interface vật lý đã ghi nhận, phát hiện quan hệ bất khả thi và nhóm context hợp lệ thành phase mà không xóa quan sát gốc. |
| Search aliases | Harris matrix, stratigraphic phasing, context sequence |
| Authority | Authority topology page trung lập với product; archetype không chọn product semantics, visual direction, token, component, geometry chính xác hoặc breakpoint. |

### Invariants

- `stratigraphic-phasing` sở hữu toàn bộ dominant task, work state và recovery boundary.
- Dựng và bảo vệ một chuỗi địa tầng khảo cổ từ các interface vật lý đã ghi nhận, phát hiện quan hệ bất khả thi và nhóm context hợp lệ thành phase mà không xóa quan sát gốc.
- Mọi region bắt buộc giữ owner, quan hệ và stable identity đã đặt tên; Grammar chỉ gắn owner theo product.
- Wide, intermediate và compact đổi topology khi một quan hệ đã đặt tên thất bại, không theo device label.
- Transformation giữ selection, draft, pending work, error, recovery, reading order và nghĩa của focus.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `STR-01` | Dựng và bảo vệ một chuỗi địa tầng khảo cổ từ các interface vật lý đã ghi nhận, phát hiện quan hệ bất khả thi và nhóm context hợp lệ thành phase mà không xóa quan sát gốc. | Bằng chứng dương bắt buộc. |
| `STR-02` | Mọi region và quan hệ bắt buộc trong graph đều cần để hoàn tất task. | Yêu cầu graph đầy đủ. |
| `STR-03` | Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Verify interface evidence for 101 → 102 → Add direct relation with keyboard-operable controls → Expose cycle from contradictory 102 → 103 edge → Reject the unsupported edge and restore acyclicity → Apply terminus and approve Phase 2 → Export reviewed sequence HM-006. | Yêu cầu proof path đặc thù của domain. |
| `STR-04` | Work state phải tồn tại qua cả ba topology response đã đặt tên. | Yêu cầu responsive parity. |
| `STR-05` | Các state literal của domain được giữ nguyên để đồng bộ runtime: context unrecorded/draft/verified, interface observed/inferred/disputed, relation proposed/direct/rejected, graph acyclic/cyclic/incomplete, redundancy intentional/unnecessary, dating evidence open/accepted/conflicting, phase unassigned/proposed/approved, interpretation superseded and archive export valid/blocked. | Yêu cầu bao phủ state và recovery. |
| `STR-90` | Từ chối khi candidate thuộc adjacent archetype `critical-path-schedule-workbench`, `dependency-topology-monitor` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state. | Reject. |
| `STR-91` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |
| `STR-92` | Một adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |

### Selection rule

Chọn `archaeological-stratigraphic-phasing-workbench` khi và chỉ khi các code `STR-01`–`05` đều có bằng chứng và không có code `STR-90`–`92`. Trả `needs-evidence` nếu dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
stratigraphic-phasing
├─ excavation-area-recording-version (downstream)
├─ context-register-and-type (downstream)
├─ physical-interface-and-section-evidence (downstream)
├─ direct-earlier-later-relationship-ledger (downstream)
├─ Harris-directed-acyclic-graph (downstream)
├─ contradiction-cycle-and-redundancy-queue (peer synchronization)
├─ dating-finds-and-terminus-evidence (downstream)
├─ phase-grouping-and-interpretive-event-model (downstream)
└─ reviewed-sequence-and-archive-export (downstream)
```

Biểu thức quan hệ binding là `stratigraphic-phasing → excavation-area-recording-version → context-register-and-type → physical-interface-and-section-evidence → direct-earlier-later-relationship-ledger → Harris-directed-acyclic-graph ↔ contradiction-cycle-and-redundancy-queue → dating-finds-and-terminus-evidence → phase-grouping-and-interpretive-event-model → reviewed-sequence-and-archive-export`; các operator giữ nghĩa directed, peer hoặc joint-axis đã khai báo trong prompt.

### Region obligations

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `stratigraphic-phasing` | stratigraphic-phasing sở hữu bằng chứng và trạng thái của chính vùng này; sở hữu boundary của dominant task và truyền identity không đổi tới `excavation-area-recording-version`. Vùng này không hấp thụ owner của vùng khác. |
| `excavation-area-recording-version` | excavation-area-recording-version sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `stratigraphic-phasing` và truyền identity không đổi tới `context-register-and-type`. Vùng này không hấp thụ owner của vùng khác. |
| `context-register-and-type` | context-register-and-type sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `excavation-area-recording-version` và truyền identity không đổi tới `physical-interface-and-section-evidence`. Vùng này không hấp thụ owner của vùng khác. |
| `physical-interface-and-section-evidence` | physical-interface-and-section-evidence sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `context-register-and-type` và truyền identity không đổi tới `direct-earlier-later-relationship-ledger`. Vùng này không hấp thụ owner của vùng khác. |
| `direct-earlier-later-relationship-ledger` | direct-earlier-later-relationship-ledger sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `physical-interface-and-section-evidence` và truyền identity không đổi tới `Harris-directed-acyclic-graph`. Vùng này không hấp thụ owner của vùng khác. |
| `Harris-directed-acyclic-graph` | Harris-directed-acyclic-graph sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `direct-earlier-later-relationship-ledger` và truyền identity không đổi tới `contradiction-cycle-and-redundancy-queue`. Vùng này không hấp thụ owner của vùng khác. |
| `contradiction-cycle-and-redundancy-queue` | contradiction-cycle-and-redundancy-queue sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ ↔ với upstream `Harris-directed-acyclic-graph` và truyền identity không đổi tới `dating-finds-and-terminus-evidence`. Vùng này không hấp thụ owner của vùng khác. |
| `dating-finds-and-terminus-evidence` | dating-finds-and-terminus-evidence sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `contradiction-cycle-and-redundancy-queue` và truyền identity không đổi tới `phase-grouping-and-interpretive-event-model`. Vùng này không hấp thụ owner của vùng khác. |
| `phase-grouping-and-interpretive-event-model` | phase-grouping-and-interpretive-event-model sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `dating-finds-and-terminus-evidence` và truyền identity không đổi tới `reviewed-sequence-and-archive-export`. Vùng này không hấp thụ owner của vùng khác. |
| `reviewed-sequence-and-archive-export` | reviewed-sequence-and-archive-export sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `phase-grouping-and-interpretive-event-model`; phát hành completion evidence. Vùng này không hấp thụ owner của vùng khác. |

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
- **Topology response:** Tái cấu trúc dominant task thành một route primary theo semantic order `stratigraphic-phasing → excavation-area-recording-version → context-register-and-type → physical-interface-and-section-evidence → direct-earlier-later-relationship-ledger → Harris-directed-acyclic-graph ↔ contradiction-cycle-and-redundancy-queue → dating-finds-and-terminus-evidence → phase-grouping-and-interpretive-event-model → reviewed-sequence-and-archive-export`; support mở theo stage và không tạo horizontal scroll cấp trang.
- **Navigation replacement:** Route stage một-pane có label thay simultaneous columns và giữ chính xác active object cùng recovery target.
- **Sticky boundary:** Chỉ action của current stage được sticky với safe-area spacing; landscape hoặc short height đưa nó về flow.
- **Overflow owner:** Không horizontal scroll cấp page; bằng chứng hai chiều dùng một bounded region có label hoặc semantic list thay thế.

### Reflow

- DOM order, reading order, and meaningful focus order are `stratigraphic-phasing → excavation-area-recording-version → context-register-and-type → physical-interface-and-section-evidence → direct-earlier-later-relationship-ledger → Harris-directed-acyclic-graph ↔ contradiction-cycle-and-redundancy-queue → dating-finds-and-terminus-evidence → phase-grouping-and-interpretive-event-model → reviewed-sequence-and-archive-export`; CSS never reorders semantics.
- Label dài, bản dịch, zoom 400% và text phóng lớn wrap mà không mất action hoặc nghĩa state.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape hoặc Cancel và trả về đúng trigger với work context nguyên vẹn.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics bên cạnh color rồi announce mà không cướp focus.
- Validation giữ input, lộ inline error, focus summary cho nhiều lỗi và cung cấp recovery cụ thể.
- Các state literal của domain được giữ nguyên để đồng bộ runtime: context unrecorded/draft/verified, interface observed/inferred/disputed, relation proposed/direct/rejected, graph acyclic/cyclic/incomplete, redundancy intentional/unnecessary, dating evidence open/accepted/conflicting, phase unassigned/proposed/approved, interpretation superseded and archive export valid/blocked.

## State obligations

Các state literal của domain được giữ nguyên để đồng bộ runtime: context unrecorded/draft/verified, interface observed/inferred/disputed, relation proposed/direct/rejected, graph acyclic/cyclic/incomplete, redundancy intentional/unnecessary, dating evidence open/accepted/conflicting, phase unassigned/proposed/approved, interpretation superseded and archive export valid/blocked.

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

- Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Verify interface evidence for 101 → 102 → Add direct relation with keyboard-operable controls → Expose cycle from contradictory 102 → 103 edge → Reject the unsupported edge and restore acyclicity → Apply terminus and approve Phase 2 → Export reviewed sequence HM-006.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Từ chối khi candidate thuộc adjacent archetype `critical-path-schedule-workbench`, `dependency-topology-monitor` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `STR-90`–`92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Historic England Archaeological Recording Manual](https://historicengland.org.uk/content/docs/research/historic-england-archaeological-recording-manual-2018) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [Archaeology Data Service files and metadata guidance](https://archaeologydataservice.ac.uk/help-guidance/instructions-for-depositors/files-and-metadata/) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |

## Output

| Trường | Contract |
|---|---|
| `archetypeId` | Fixed value `archaeological-stratigraphic-phasing-workbench`. |
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
{"archetypeId":"archaeological-stratigraphic-phasing-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
