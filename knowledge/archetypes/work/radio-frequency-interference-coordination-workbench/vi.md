# Radio frequency interference coordination workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `radio-frequency-interference-coordination-workbench` |
| Family | Work |
| Dominant task | Điều phối một radio assignment đề xuất bằng cách tính wanted/unwanted signal tại protected receiver, tìm failure pairwise và aggregate rồi thương lượng điều kiện kỹ thuật chấp nhận được. |
| Search aliases | frequency coordination, interference margin, spectrum assignment |
| Authority | Authority topology page trung lập với product; archetype không chọn product semantics, visual direction, token, component, geometry chính xác hoặc breakpoint. |

### Invariants

- `frequency-coordination` sở hữu toàn bộ dominant task, work state và recovery boundary.
- Điều phối một radio assignment đề xuất bằng cách tính wanted/unwanted signal tại protected receiver, tìm failure pairwise và aggregate rồi thương lượng điều kiện kỹ thuật chấp nhận được.
- Mọi region bắt buộc giữ owner, quan hệ và stable identity đã đặt tên; Grammar chỉ gắn owner theo product.
- Wide, intermediate và compact đổi topology khi một quan hệ đã đặt tên thất bại, không theo device label.
- Transformation giữ selection, draft, pending work, error, recovery, reading order và nghĩa của focus.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `RFI-01` | Điều phối một radio assignment đề xuất bằng cách tính wanted/unwanted signal tại protected receiver, tìm failure pairwise và aggregate rồi thương lượng điều kiện kỹ thuật chấp nhận được. | Bằng chứng dương bắt buộc. |
| `RFI-02` | Mọi region và quan hệ bắt buộc trong graph đều cần để hoàn tất task. | Yêu cầu graph đầy đủ. |
| `RFI-03` | Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Enter transmitter, antenna, and emission facts → Rank protected receivers and select R-17 → Calculate pairwise and aggregate margins → Compare lower-power and alternate-channel options → Record affected party conditional response → Issue coordinated application RF-017. | Yêu cầu proof path đặc thù của domain. |
| `RFI-04` | Work state phải tồn tại qua cả ba topology response đã đặt tên. | Yêu cầu responsive parity. |
| `RFI-05` | Các state literal của domain được giữ nguyên để đồng bộ runtime: rule version current/changed, assignment licensed/planned/expired, path model valid/insufficient, receiver protected/unprotected, wanted signal adequate/weak, interferer individual/aggregate, margin pass/marginal/fail, counterfactual unsolved/viable, notice unsent/sent/responded, objection open/resolved and condition agreed/expired. | Yêu cầu bao phủ state và recovery. |
| `RFI-90` | Từ chối khi candidate thuộc adjacent archetype `capacity-allocation-overview`, `airspace-volume-deconfliction-planner`, `scenario-sensitivity-modeler`, `map-led-situation-monitor` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state. | Reject. |
| `RFI-91` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |
| `RFI-92` | Một adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |

### Selection rule

Chọn `radio-frequency-interference-coordination-workbench` khi và chỉ khi các code `RFI-01`–`05` đều có bằng chứng và không có code `RFI-90`–`92`. Trả `needs-evidence` nếu dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
frequency-coordination
├─ service-band-jurisdiction-and-rule-version (downstream)
├─ existing-and-planned-assignment-register (downstream)
├─ proposed-transmitter-receiver-location-antenna-and-emission (downstream)
├─ propagation-path-and-terrain-model (downstream)
├─ wanted-vs-unwanted-signal-at-protected-receivers (downstream)
├─ pairwise-and-aggregate-interference-margin-matrix (downstream)
├─ channel-power-time-antenna-or-site-counterfactuals (downstream)
├─ affected-party-notice-response-and-agreement (downstream)
└─ coordinated-application-and-condition-record (downstream)
```

Biểu thức quan hệ binding là `frequency-coordination → service-band-jurisdiction-and-rule-version → existing-and-planned-assignment-register → proposed-transmitter-receiver-location-antenna-and-emission → propagation-path-and-terrain-model → wanted-vs-unwanted-signal-at-protected-receivers → pairwise-and-aggregate-interference-margin-matrix → channel-power-time-antenna-or-site-counterfactuals → affected-party-notice-response-and-agreement → coordinated-application-and-condition-record`; các operator giữ nghĩa directed, peer hoặc joint-axis đã khai báo trong prompt.

### Region obligations

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `frequency-coordination` | frequency-coordination sở hữu bằng chứng và trạng thái của chính vùng này; sở hữu boundary của dominant task và truyền identity không đổi tới `service-band-jurisdiction-and-rule-version`. Vùng này không hấp thụ owner của vùng khác. |
| `service-band-jurisdiction-and-rule-version` | service-band-jurisdiction-and-rule-version sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `frequency-coordination` và truyền identity không đổi tới `existing-and-planned-assignment-register`. Vùng này không hấp thụ owner của vùng khác. |
| `existing-and-planned-assignment-register` | existing-and-planned-assignment-register sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `service-band-jurisdiction-and-rule-version` và truyền identity không đổi tới `proposed-transmitter-receiver-location-antenna-and-emission`. Vùng này không hấp thụ owner của vùng khác. |
| `proposed-transmitter-receiver-location-antenna-and-emission` | proposed-transmitter-receiver-location-antenna-and-emission sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `existing-and-planned-assignment-register` và truyền identity không đổi tới `propagation-path-and-terrain-model`. Vùng này không hấp thụ owner của vùng khác. |
| `propagation-path-and-terrain-model` | propagation-path-and-terrain-model sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `proposed-transmitter-receiver-location-antenna-and-emission` và truyền identity không đổi tới `wanted-vs-unwanted-signal-at-protected-receivers`. Vùng này không hấp thụ owner của vùng khác. |
| `wanted-vs-unwanted-signal-at-protected-receivers` | wanted-vs-unwanted-signal-at-protected-receivers sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `propagation-path-and-terrain-model` và truyền identity không đổi tới `pairwise-and-aggregate-interference-margin-matrix`. Vùng này không hấp thụ owner của vùng khác. |
| `pairwise-and-aggregate-interference-margin-matrix` | pairwise-and-aggregate-interference-margin-matrix sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `wanted-vs-unwanted-signal-at-protected-receivers` và truyền identity không đổi tới `channel-power-time-antenna-or-site-counterfactuals`. Vùng này không hấp thụ owner của vùng khác. |
| `channel-power-time-antenna-or-site-counterfactuals` | channel-power-time-antenna-or-site-counterfactuals sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `pairwise-and-aggregate-interference-margin-matrix` và truyền identity không đổi tới `affected-party-notice-response-and-agreement`. Vùng này không hấp thụ owner của vùng khác. |
| `affected-party-notice-response-and-agreement` | affected-party-notice-response-and-agreement sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `channel-power-time-antenna-or-site-counterfactuals` và truyền identity không đổi tới `coordinated-application-and-condition-record`. Vùng này không hấp thụ owner của vùng khác. |
| `coordinated-application-and-condition-record` | coordinated-application-and-condition-record sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `affected-party-notice-response-and-agreement`; phát hành completion evidence. Vùng này không hấp thụ owner của vùng khác. |

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
- **Topology response:** Tái cấu trúc dominant task thành một route primary theo semantic order `frequency-coordination → service-band-jurisdiction-and-rule-version → existing-and-planned-assignment-register → proposed-transmitter-receiver-location-antenna-and-emission → propagation-path-and-terrain-model → wanted-vs-unwanted-signal-at-protected-receivers → pairwise-and-aggregate-interference-margin-matrix → channel-power-time-antenna-or-site-counterfactuals → affected-party-notice-response-and-agreement → coordinated-application-and-condition-record`; support mở theo stage và không tạo horizontal scroll cấp trang.
- **Navigation replacement:** Route stage một-pane có label thay simultaneous columns và giữ chính xác active object cùng recovery target.
- **Sticky boundary:** Chỉ action của current stage được sticky với safe-area spacing; landscape hoặc short height đưa nó về flow.
- **Overflow owner:** Không horizontal scroll cấp page; bằng chứng hai chiều dùng một bounded region có label hoặc semantic list thay thế.

### Reflow

- DOM order, reading order, and meaningful focus order are `frequency-coordination → service-band-jurisdiction-and-rule-version → existing-and-planned-assignment-register → proposed-transmitter-receiver-location-antenna-and-emission → propagation-path-and-terrain-model → wanted-vs-unwanted-signal-at-protected-receivers → pairwise-and-aggregate-interference-margin-matrix → channel-power-time-antenna-or-site-counterfactuals → affected-party-notice-response-and-agreement → coordinated-application-and-condition-record`; CSS never reorders semantics.
- Label dài, bản dịch, zoom 400% và text phóng lớn wrap mà không mất action hoặc nghĩa state.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape hoặc Cancel và trả về đúng trigger với work context nguyên vẹn.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics bên cạnh color rồi announce mà không cướp focus.
- Validation giữ input, lộ inline error, focus summary cho nhiều lỗi và cung cấp recovery cụ thể.
- Các state literal của domain được giữ nguyên để đồng bộ runtime: rule version current/changed, assignment licensed/planned/expired, path model valid/insufficient, receiver protected/unprotected, wanted signal adequate/weak, interferer individual/aggregate, margin pass/marginal/fail, counterfactual unsolved/viable, notice unsent/sent/responded, objection open/resolved and condition agreed/expired.

## State obligations

Các state literal của domain được giữ nguyên để đồng bộ runtime: rule version current/changed, assignment licensed/planned/expired, path model valid/insufficient, receiver protected/unprotected, wanted signal adequate/weak, interferer individual/aggregate, margin pass/marginal/fail, counterfactual unsolved/viable, notice unsent/sent/responded, objection open/resolved and condition agreed/expired.

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

- Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Enter transmitter, antenna, and emission facts → Rank protected receivers and select R-17 → Calculate pairwise and aggregate margins → Compare lower-power and alternate-channel options → Record affected party conditional response → Issue coordinated application RF-017.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Từ chối khi candidate thuộc adjacent archetype `capacity-allocation-overview`, `airspace-volume-deconfliction-planner`, `scenario-sensitivity-modeler`, `map-led-situation-monitor` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `RFI-90`–`92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [ITU Radiocommunication terrestrial coordination guidance](https://www.itu.int/en/ITU-R/terrestrial/Pages/by-categories-faq.aspx?categorizedby=35) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [NTIA United States Frequency Allocation Chart](https://www.ntia.gov/page/united-states-frequency-allocation-chart) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |

## Output

| Trường | Contract |
|---|---|
| `archetypeId` | Fixed value `radio-frequency-interference-coordination-workbench`. |
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
{"archetypeId":"radio-frequency-interference-coordination-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
