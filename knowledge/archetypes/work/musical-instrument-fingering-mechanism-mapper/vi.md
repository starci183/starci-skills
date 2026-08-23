# Musical instrument fingering mechanism mapper

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `musical-instrument-fingering-mechanism-mapper` |
| Family | Work |
| Dominant task | Ánh xạ note, chord hoặc passage sang fingering chơi được trên đúng cơ cấu nhạc cụ, so sánh trạng thái vật lý thay thế và xác thực transition trong chuỗi biểu diễn. |
| Search aliases | instrument fingering, mechanism state map, playable transition |
| Authority | Authority topology page trung lập với product; archetype không chọn product semantics, visual direction, token, component, geometry chính xác hoặc breakpoint. |

### Invariants

- `fingering-mapper` sở hữu toàn bộ dominant task, work state và recovery boundary.
- Ánh xạ note, chord hoặc passage sang fingering chơi được trên đúng cơ cấu nhạc cụ, so sánh trạng thái vật lý thay thế và xác thực transition trong chuỗi biểu diễn.
- Mọi region bắt buộc giữ owner, quan hệ và stable identity đã đặt tên; Grammar chỉ gắn owner theo product.
- Wide, intermediate và compact đổi topology khi một quan hệ đã đặt tên thất bại, không theo device label.
- Transformation giữ selection, draft, pending work, error, recovery, reading order và nghĩa của focus.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `FIN-01` | Ánh xạ note, chord hoặc passage sang fingering chơi được trên đúng cơ cấu nhạc cụ, so sánh trạng thái vật lý thay thế và xác thực transition trong chuỗi biểu diễn. | Bằng chứng dương bắt buộc. |
| `FIN-02` | Mọi region và quan hệ bắt buộc trong graph đều cần để hoàn tất task. | Yêu cầu graph đầy đủ. |
| `FIN-03` | Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Bind instrument mechanism C-21 → Prove two fingerings sound F♯5 → Reject standard fingering on prior transition → Select alternate using labeled mechanism controls → Validate transition into next G5 → Export performer-reviewed sequence FG-021. | Yêu cầu proof path đặc thù của domain. |
| `FIN-04` | Work state phải tồn tại qua cả ba topology response đã đặt tên. | Yêu cầu responsive parity. |
| `FIN-05` | Các state literal của domain được giữ nguyên để đồng bộ runtime: instrument profile current/wrong, event unassigned/assigned, candidate standard/alternate/extended/unreachable, pitch correct/out-of-register, mechanism state valid/conflicting, transition easy/difficult/impossible, hand span within/exceeded, performer test pending/accepted/rejected and export current/stale. | Yêu cầu bao phủ state và recovery. |
| `FIN-90` | Từ chối khi candidate thuộc adjacent archetype `spatial-route-constraint-planner`, `canvas-inspector-workspace`, `score-to-part-extraction-proof-workbench` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state. | Reject. |
| `FIN-91` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |
| `FIN-92` | Một adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |

### Selection rule

Chọn `musical-instrument-fingering-mechanism-mapper` khi và chỉ khi các code `FIN-01`–`05` đều có bằng chứng và không có code `FIN-90`–`92`. Trả `needs-evidence` nếu dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
fingering-mapper
├─ instrument-model-tuning-and-mechanism-version (downstream)
├─ note-chord-and-articulation-sequence (downstream)
├─ physical-key-hole-valve-string-state-model (downstream)
├─ candidate-fingering-set-per-event (downstream)
├─ sounding-pitch-register-and-alternate-fingering-proof (downstream)
├─ transition-path-hand-span-and-technique-constraints (downstream)
├─ difficult-transition-and-unreachable-queue (downstream)
├─ selected-fingering-sequence-and-notation (downstream)
└─ performer-validation-and-export (downstream)
```

Biểu thức quan hệ binding là `fingering-mapper → instrument-model-tuning-and-mechanism-version → note-chord-and-articulation-sequence → physical-key-hole-valve-string-state-model → candidate-fingering-set-per-event → sounding-pitch-register-and-alternate-fingering-proof → transition-path-hand-span-and-technique-constraints → difficult-transition-and-unreachable-queue → selected-fingering-sequence-and-notation → performer-validation-and-export`; các operator giữ nghĩa directed, peer hoặc joint-axis đã khai báo trong prompt.

### Region obligations

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `fingering-mapper` | fingering-mapper sở hữu bằng chứng và trạng thái của chính vùng này; sở hữu boundary của dominant task và truyền identity không đổi tới `instrument-model-tuning-and-mechanism-version`. Vùng này không hấp thụ owner của vùng khác. |
| `instrument-model-tuning-and-mechanism-version` | instrument-model-tuning-and-mechanism-version sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `fingering-mapper` và truyền identity không đổi tới `note-chord-and-articulation-sequence`. Vùng này không hấp thụ owner của vùng khác. |
| `note-chord-and-articulation-sequence` | note-chord-and-articulation-sequence sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `instrument-model-tuning-and-mechanism-version` và truyền identity không đổi tới `physical-key-hole-valve-string-state-model`. Vùng này không hấp thụ owner của vùng khác. |
| `physical-key-hole-valve-string-state-model` | physical-key-hole-valve-string-state-model sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `note-chord-and-articulation-sequence` và truyền identity không đổi tới `candidate-fingering-set-per-event`. Vùng này không hấp thụ owner của vùng khác. |
| `candidate-fingering-set-per-event` | candidate-fingering-set-per-event sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `physical-key-hole-valve-string-state-model` và truyền identity không đổi tới `sounding-pitch-register-and-alternate-fingering-proof`. Vùng này không hấp thụ owner của vùng khác. |
| `sounding-pitch-register-and-alternate-fingering-proof` | sounding-pitch-register-and-alternate-fingering-proof sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `candidate-fingering-set-per-event` và truyền identity không đổi tới `transition-path-hand-span-and-technique-constraints`. Vùng này không hấp thụ owner của vùng khác. |
| `transition-path-hand-span-and-technique-constraints` | transition-path-hand-span-and-technique-constraints sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `sounding-pitch-register-and-alternate-fingering-proof` và truyền identity không đổi tới `difficult-transition-and-unreachable-queue`. Vùng này không hấp thụ owner của vùng khác. |
| `difficult-transition-and-unreachable-queue` | difficult-transition-and-unreachable-queue sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `transition-path-hand-span-and-technique-constraints` và truyền identity không đổi tới `selected-fingering-sequence-and-notation`. Vùng này không hấp thụ owner của vùng khác. |
| `selected-fingering-sequence-and-notation` | selected-fingering-sequence-and-notation sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `difficult-transition-and-unreachable-queue` và truyền identity không đổi tới `performer-validation-and-export`. Vùng này không hấp thụ owner của vùng khác. |
| `performer-validation-and-export` | performer-validation-and-export sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `selected-fingering-sequence-and-notation`; phát hành completion evidence. Vùng này không hấp thụ owner của vùng khác. |

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
- **Topology response:** Tái cấu trúc dominant task thành một route primary theo semantic order `fingering-mapper → instrument-model-tuning-and-mechanism-version → note-chord-and-articulation-sequence → physical-key-hole-valve-string-state-model → candidate-fingering-set-per-event → sounding-pitch-register-and-alternate-fingering-proof → transition-path-hand-span-and-technique-constraints → difficult-transition-and-unreachable-queue → selected-fingering-sequence-and-notation → performer-validation-and-export`; support mở theo stage và không tạo horizontal scroll cấp trang.
- **Navigation replacement:** Route stage một-pane có label thay simultaneous columns và giữ chính xác active object cùng recovery target.
- **Sticky boundary:** Chỉ action của current stage được sticky với safe-area spacing; landscape hoặc short height đưa nó về flow.
- **Overflow owner:** Không horizontal scroll cấp page; bằng chứng hai chiều dùng một bounded region có label hoặc semantic list thay thế.

### Reflow

- DOM order, reading order, and meaningful focus order are `fingering-mapper → instrument-model-tuning-and-mechanism-version → note-chord-and-articulation-sequence → physical-key-hole-valve-string-state-model → candidate-fingering-set-per-event → sounding-pitch-register-and-alternate-fingering-proof → transition-path-hand-span-and-technique-constraints → difficult-transition-and-unreachable-queue → selected-fingering-sequence-and-notation → performer-validation-and-export`; CSS never reorders semantics.
- Label dài, bản dịch, zoom 400% và text phóng lớn wrap mà không mất action hoặc nghĩa state.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape hoặc Cancel và trả về đúng trigger với work context nguyên vẹn.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics bên cạnh color rồi announce mà không cướp focus.
- Validation giữ input, lộ inline error, focus summary cho nhiều lỗi và cung cấp recovery cụ thể.
- Các state literal của domain được giữ nguyên để đồng bộ runtime: instrument profile current/wrong, event unassigned/assigned, candidate standard/alternate/extended/unreachable, pitch correct/out-of-register, mechanism state valid/conflicting, transition easy/difficult/impossible, hand span within/exceeded, performer test pending/accepted/rejected and export current/stale.

## State obligations

Các state literal của domain được giữ nguyên để đồng bộ runtime: instrument profile current/wrong, event unassigned/assigned, candidate standard/alternate/extended/unreachable, pitch correct/out-of-register, mechanism state valid/conflicting, transition easy/difficult/impossible, hand span within/exceeded, performer test pending/accepted/rejected and export current/stale.

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

- Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Bind instrument mechanism C-21 → Prove two fingerings sound F♯5 → Reject standard fingering on prior transition → Select alternate using labeled mechanism controls → Validate transition into next G5 → Export performer-reviewed sequence FG-021.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Từ chối khi candidate thuộc adjacent archetype `spatial-route-constraint-planner`, `canvas-inspector-workspace`, `score-to-part-extraction-proof-workbench` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `FIN-90`–`92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Yamaha instrument fingering charts](https://www.yamaha.com/en/musical_instrument_guide/feature/fingering/) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [Music Encoding Initiative common music notation guidance](https://music-encoding.org/guidelines/v5/content/cmn.html) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |

## Output

| Trường | Contract |
|---|---|
| `archetypeId` | Fixed value `musical-instrument-fingering-mechanism-mapper`. |
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
{"archetypeId":"musical-instrument-fingering-mechanism-mapper","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
