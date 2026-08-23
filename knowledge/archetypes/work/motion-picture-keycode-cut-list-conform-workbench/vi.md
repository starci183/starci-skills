# Motion picture keycode cut list conform workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `motion-picture-keycode-cut-list-conform-workbench` |
| Family | Work |
| Dominant task | Matchback picture edit về film stock bằng cách chuyển timecode của edit event thành KEYKODE frame range, tạo cut/change list và chứng minh conform liên tục theo frame. |
| Search aliases | KEYKODE matchback, film cut list, physical conform |
| Authority | Authority topology page trung lập với product; archetype không chọn product semantics, visual direction, token, component, geometry chính xác hoặc breakpoint. |

### Invariants

- `film-conform` sở hữu toàn bộ dominant task, work state và recovery boundary.
- Matchback picture edit về film stock bằng cách chuyển timecode của edit event thành KEYKODE frame range, tạo cut/change list và chứng minh conform liên tục theo frame.
- Mọi region bắt buộc giữ owner, quan hệ và stable identity đã đặt tên; Grammar chỉ gắn owner theo product.
- Wide, intermediate và compact đổi topology khi một quan hệ đã đặt tên thất bại, không theo device label.
- Transformation giữ selection, draft, pending work, error, recovery, reading order và nghĩa của focus.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `KEY-01` | Matchback picture edit về film stock bằng cách chuyển timecode của edit event thành KEYKODE frame range, tạo cut/change list và chứng minh conform liên tục theo frame. | Bằng chứng dương bắt buộc. |
| `KEY-02` | Mọi region và quan hệ bắt buộc trong graph đều cần để hoàn tất task. | Yêu cầu graph đầy đủ. |
| `KEY-03` | Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Select edit event 042 → Match source timecode to roll and keycode range → Expose one-perf slip and short handle → Regenerate affected cut/change instruction → Verify continuity against adjacent events → Issue conform receipt KC-012. | Yêu cầu proof path đặc thù của domain. |
| `KEY-04` | Work state phải tồn tại qua cả ba topology response đã đặt tên. | Yêu cầu responsive parity. |
| `KEY-05` | Các state literal của domain được giữ nguyên để đồng bộ runtime: edit version current/superseded, source roll identified/missing, keycode readable/partial/absent, correlation calibrated/slipped, event matched/ambiguous/unmatched, handle sufficient/short, dupe required/available/missing, optical block valid/invalid, assembly continuous/gapped/overlapped and conform receipt approved/returned. | Yêu cầu bao phủ state và recovery. |
| `KEY-90` | Từ chối khi candidate thuộc adjacent archetype `multi-track-timeline-editor`, `reconciliation-diff-workbench`, `data-import-mapping-pipeline`, `print-signature-imposition-planner` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state. | Reject. |
| `KEY-91` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |
| `KEY-92` | Một adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |

### Selection rule

Chọn `motion-picture-keycode-cut-list-conform-workbench` khi và chỉ khi các code `KEY-01`–`05` đều có bằng chứng và không có code `KEY-90`–`92`. Trả `needs-evidence` nếu dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
film-conform
├─ project-gauge-perforation-frame-rate-and-edit-version (downstream)
├─ source-roll-reel-keycode-and-timecode-correlation (downstream)
├─ edit-event-decision-list (downstream)
├─ event-to-keycode-frame-range-matchback (downstream)
├─ cut-list-change-list-and-optical-blocks (downstream)
├─ dupe-handle-perf-slip-and-missing-keycode-ledger (downstream)
├─ physical-negative-or-di-assembly-order (downstream)
├─ frame-count-continuity-and-conform-reconciliation (downstream)
└─ approved-list-and-conform-receipt (downstream)
```

Biểu thức quan hệ binding là `film-conform → project-gauge-perforation-frame-rate-and-edit-version → source-roll-reel-keycode-and-timecode-correlation → edit-event-decision-list → event-to-keycode-frame-range-matchback → cut-list-change-list-and-optical-blocks → dupe-handle-perf-slip-and-missing-keycode-ledger → physical-negative-or-di-assembly-order → frame-count-continuity-and-conform-reconciliation → approved-list-and-conform-receipt`; các operator giữ nghĩa directed, peer hoặc joint-axis đã khai báo trong prompt.

### Region obligations

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `film-conform` | film-conform sở hữu bằng chứng và trạng thái của chính vùng này; sở hữu boundary của dominant task và truyền identity không đổi tới `project-gauge-perforation-frame-rate-and-edit-version`. Vùng này không hấp thụ owner của vùng khác. |
| `project-gauge-perforation-frame-rate-and-edit-version` | project-gauge-perforation-frame-rate-and-edit-version sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `film-conform` và truyền identity không đổi tới `source-roll-reel-keycode-and-timecode-correlation`. Vùng này không hấp thụ owner của vùng khác. |
| `source-roll-reel-keycode-and-timecode-correlation` | source-roll-reel-keycode-and-timecode-correlation sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `project-gauge-perforation-frame-rate-and-edit-version` và truyền identity không đổi tới `edit-event-decision-list`. Vùng này không hấp thụ owner của vùng khác. |
| `edit-event-decision-list` | edit-event-decision-list sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `source-roll-reel-keycode-and-timecode-correlation` và truyền identity không đổi tới `event-to-keycode-frame-range-matchback`. Vùng này không hấp thụ owner của vùng khác. |
| `event-to-keycode-frame-range-matchback` | event-to-keycode-frame-range-matchback sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `edit-event-decision-list` và truyền identity không đổi tới `cut-list-change-list-and-optical-blocks`. Vùng này không hấp thụ owner của vùng khác. |
| `cut-list-change-list-and-optical-blocks` | cut-list-change-list-and-optical-blocks sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `event-to-keycode-frame-range-matchback` và truyền identity không đổi tới `dupe-handle-perf-slip-and-missing-keycode-ledger`. Vùng này không hấp thụ owner của vùng khác. |
| `dupe-handle-perf-slip-and-missing-keycode-ledger` | dupe-handle-perf-slip-and-missing-keycode-ledger sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `cut-list-change-list-and-optical-blocks` và truyền identity không đổi tới `physical-negative-or-di-assembly-order`. Vùng này không hấp thụ owner của vùng khác. |
| `physical-negative-or-di-assembly-order` | physical-negative-or-di-assembly-order sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `dupe-handle-perf-slip-and-missing-keycode-ledger` và truyền identity không đổi tới `frame-count-continuity-and-conform-reconciliation`. Vùng này không hấp thụ owner của vùng khác. |
| `frame-count-continuity-and-conform-reconciliation` | frame-count-continuity-and-conform-reconciliation sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `physical-negative-or-di-assembly-order` và truyền identity không đổi tới `approved-list-and-conform-receipt`. Vùng này không hấp thụ owner của vùng khác. |
| `approved-list-and-conform-receipt` | approved-list-and-conform-receipt sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `frame-count-continuity-and-conform-reconciliation`; phát hành completion evidence. Vùng này không hấp thụ owner của vùng khác. |

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
- **Topology response:** Tái cấu trúc dominant task thành một route primary theo semantic order `film-conform → project-gauge-perforation-frame-rate-and-edit-version → source-roll-reel-keycode-and-timecode-correlation → edit-event-decision-list → event-to-keycode-frame-range-matchback → cut-list-change-list-and-optical-blocks → dupe-handle-perf-slip-and-missing-keycode-ledger → physical-negative-or-di-assembly-order → frame-count-continuity-and-conform-reconciliation → approved-list-and-conform-receipt`; support mở theo stage và không tạo horizontal scroll cấp trang.
- **Navigation replacement:** Route stage một-pane có label thay simultaneous columns và giữ chính xác active object cùng recovery target.
- **Sticky boundary:** Chỉ action của current stage được sticky với safe-area spacing; landscape hoặc short height đưa nó về flow.
- **Overflow owner:** Không horizontal scroll cấp page; bằng chứng hai chiều dùng một bounded region có label hoặc semantic list thay thế.

### Reflow

- DOM order, reading order, and meaningful focus order are `film-conform → project-gauge-perforation-frame-rate-and-edit-version → source-roll-reel-keycode-and-timecode-correlation → edit-event-decision-list → event-to-keycode-frame-range-matchback → cut-list-change-list-and-optical-blocks → dupe-handle-perf-slip-and-missing-keycode-ledger → physical-negative-or-di-assembly-order → frame-count-continuity-and-conform-reconciliation → approved-list-and-conform-receipt`; CSS never reorders semantics.
- Label dài, bản dịch, zoom 400% và text phóng lớn wrap mà không mất action hoặc nghĩa state.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape hoặc Cancel và trả về đúng trigger với work context nguyên vẹn.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics bên cạnh color rồi announce mà không cướp focus.
- Validation giữ input, lộ inline error, focus summary cho nhiều lỗi và cung cấp recovery cụ thể.
- Các state literal của domain được giữ nguyên để đồng bộ runtime: edit version current/superseded, source roll identified/missing, keycode readable/partial/absent, correlation calibrated/slipped, event matched/ambiguous/unmatched, handle sufficient/short, dupe required/available/missing, optical block valid/invalid, assembly continuous/gapped/overlapped and conform receipt approved/returned.

## State obligations

Các state literal của domain được giữ nguyên để đồng bộ runtime: edit version current/superseded, source roll identified/missing, keycode readable/partial/absent, correlation calibrated/slipped, event matched/ambiguous/unmatched, handle sufficient/short, dupe required/available/missing, optical block valid/invalid, assembly continuous/gapped/overlapped and conform receipt approved/returned.

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

- Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Select edit event 042 → Match source timecode to roll and keycode range → Expose one-perf slip and short handle → Regenerate affected cut/change instruction → Verify continuity against adjacent events → Issue conform receipt KC-012.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Từ chối khi candidate thuộc adjacent archetype `multi-track-timeline-editor`, `reconciliation-diff-workbench`, `data-import-mapping-pipeline`, `print-signature-imposition-planner` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `KEY-90`–`92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Kodak KEYKODE edge-number guidance](https://www.kodak.com/en/motion/page/keykode-numbers/) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [Avid FilmScribe User's Guide](https://resources.avid.com/SupportFiles/attach/FilmScr_UG_10_2.pdf) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |

## Output

| Trường | Contract |
|---|---|
| `archetypeId` | Fixed value `motion-picture-keycode-cut-list-conform-workbench`. |
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
{"archetypeId":"motion-picture-keycode-cut-list-conform-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
