> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> mechanics, not an application decision. It has no successor under composition, presentation, or
> proof. Do not load it as runtime authority.

# Trạng thái control

Dùng các rule này để audit cách control mang state transient, persistent, unavailable, pending và
initially unresolved. Business/application authority sở hữu fact và transition;
`@starci/grammar/common` sở hữu public prop, renderer anatomy, DOM semantics và accessibility; family
đã chọn được đổi paint trong scope nhưng không được đổi meaning; application handler sở hữu product
effect. Binding component với rule vẫn nằm trong binding registry, ngoài file invariant này. Ghi
finding theo [mô hình verdict canonical](INDEX.vi.md#canonical-verdict-model), mỗi finding có một base
verdict và dùng finding liên kết khi nhiều layer cùng fail.

## CONTROL-STATE-1 — Identity ổn định qua action state

### When

Một action có thể đi từ idle sang accepted work rồi đến kết quả settled.

### Apply

- Application state chỉ set `Button.isPending` hoặc `TextAction.isPending` sau khi chính action đó
  nhận work, rồi clear khi success, error hoặc cancellation.
- Common giữ `children` làm visible action label. Pending disable native button, chặn handler, expose
  busy state và chỉ được thay leading/trailing decoration bằng spinner của nó.
- Verify một effect được nhận, không có callback thêm khi pending, cùng action name trong
  DOM/accessibility tree và có settlement path reachable.
- Family được paint pending cue trong scope; không được thay label hay đổi transition. Application
  cung cấp handler và result, không cung cấp control anatomy.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Common `Button` pending vẫn đọc “Lưu”, bị disabled, expose busy state và lần nhấn thứ hai không tạo callback. | `PASS` | Identity, semantics và effect count khớp trong toàn transition. |
| Common renderer bỏ `children` khi `isPending` là true. | `COMMON_IMPLEMENTATION_GLITCH` + `STATE_OR_VIEWPORT_DRIFT` | Sửa Common để pending giữ action name, rồi chạy lại proof DOM và callback. |
| Family replacement đổi “Lưu” thành “Đang tải…” trong pending. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Giữ cue của family ở phần visual và khôi phục contract label của Common. |
| App đổi button thành spinner không liên quan sau khi nhận lệnh lưu. | `APP_REIMPLEMENTATION` + `WRONG_OWNER` | Giữ Common initiator mounted và drive published pending prop của nó. |
| Có screenshot pending nhưng chưa capture callback count và accessible name. | `PROOF_MISSING` | Ghi DOM, accessible name và activation count trước khi kết luận PASS. |

## CONTROL-STATE-2 — Unavailable không phải pending

### When

Một control không thể bắt đầu, đang có accepted work chạy, hoặc chỉ là initial geometry chưa resolve.

### Apply

- Map unavailable vào `isDisabled` của owner thật, accepted work vào `isPending`, và initial content
  chưa resolve vào `isSkeleton` đã publish của component; không derive state này từ state kia.
- Với `Button`, cả ba đều chặn activation, nhưng chỉ pending expose action progress và chỉ skeleton
  ẩn label chưa resolve khỏi assistive output. `TextAction` publish cùng ba input; `Input` publish
  `isDisabled` và `isSkeleton`, không có pending.
- Verify rendered element, busy/disabled/accessibility output, callback count và transition vào/ra
  từng meaning thay vì chỉ so paint.
- Business authority cung cấp reason và lifecycle. Common mang state, family paint state, còn app
  không được tự tạo một local state `loading` chung làm gộp các meaning.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Common `Button` unavailable bị disabled, không có spinner hay busy claim; accepted work dùng `isPending`. | `PASS` | Hai public state tạo semantics riêng. |
| Một boolean `loading` của app vừa disable field, vừa đánh dấu submit pending, vừa biểu diễn content chưa resolve. | `APP_REIMPLEMENTATION` + `STATE_OR_VIEWPORT_DRIFT` | Tách business fact rồi drive từng Common owner thật. |
| Family paint `isDisabled` và `isPending` giống nhau khiến không nhận ra progress. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Khôi phục pending cue riêng mà không đổi Common semantics. |
| Một Common component tái sử dụng cần unresolved geometry nhưng chưa expose path `isSkeleton`. | `COMMON_CAPABILITY_MISSING` | Thêm capability vào Common trước khi tạo workaround tạm ở app. |
| Chỉ inspect class name, chưa kiểm tra busy state và assistive visibility. | `PROOF_MISSING` | Inspect semantic tree đã render và activation behavior của cả ba state. |

## CONTROL-STATE-3 — Persistent state có value riêng

### When

Các peer choice phải giữ một selection sau khi hover, press hoặc keyboard focus kết thúc.

### Apply

- Application authority sở hữu persistent key và truyền qua Common `Tabs.selectedKey`; `onSelect`
  request key kế tiếp thay vì lưu thêm một DOM-local value.
- Common sở hữu role tab, selected semantics, peer keyboard behavior và relationship `panelId` khi có
  panel. `items` vẫn là inventory peer theo thứ tự.
- Verify selection trước và sau pointer exit, blur, keyboard movement, rerender và viewport reflow;
  visible cue và `aria-selected` phải gọi cùng một peer.
- Family được paint peer selected nhưng không được dùng color làm carrier duy nhất. App cung cấp
  business view selected và panel content, không cung cấp tab role hay duplicate state.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| `selectedKey="security"` vẫn selected sau blur và tab Bảo mật control panel đã khai báo. | `PASS` | Một application value drive cả visual selection lẫn accessible selection của Common. |
| Clickable text do app viết giữ selected class riêng cạnh Common tabs. | `APP_REIMPLEMENTATION` + `DOUBLE_OWNER` | Bỏ peer control song song và giữ `selectedKey` làm value duy nhất. |
| Family bỏ mọi selected cue ngoài một thay đổi color. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Khôi phục distinction persistent không chỉ dựa color, đồng thời giữ Common tab semantics. |
| Isolated Common output clear selection khi focus rời tab list. | `COMMON_IMPLEMENTATION_GLITCH` + `STATE_OR_VIEWPORT_DRIFT` | Sửa controlled renderer rồi test lại blur và rerender. |
| Selection chỉ được test bằng pointer và chưa inspect panel association. | `PROOF_MISSING` | Bổ sung evidence keyboard, blur, rerender và semantic tree. |

## CONTROL-STATE-4 — Evidence và falsifier

### When

Bất kỳ control state, transition, viewport, input method hoặc family nào làm đổi rendered treatment.

### Apply

- Execute mọi control state reachable và ghi state trước, trigger, state sau, owner, callback count
  cùng settlement result.
- Inspect native disabled/busy/selected semantics, visible label và cue, focus behavior, geometry và
  accessibility tree trong isolated Common, selected family và application output.
- Yêu cầu disabled callback = `0`, callback dư khi pending = `0`, persistent-state loss = `0`, và
  announced skeleton content = `0` tại nơi published skeleton contract ẩn nó.
- Gán mỗi failure cho layer tạo ra nó; failure ở family/app không xóa failure Common độc lập, còn
  source assertion không có runtime output không phải evidence PASS.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Mọi state reachable có evidence source, DOM, accessibility, callback và settlement khớp nhau. | `PASS` | Transition matrix đầy đủ không có falsifier. |
| Isolated Common gọi `onPress` từ button có `isDisabled`. | `COMMON_IMPLEMENTATION_GLITCH` | Disabled behavior trái Common public contract; sửa rồi chạy lại interaction test. |
| Document handler của app fire lần lưu thứ hai trong khi Common button pending. | `APP_OVERRIDE` + `DOUBLE_OWNER` | Bỏ activation owner song song và giữ một handler path Common. |
| Family làm copy thật của skeleton vẫn visible với assistive technology. | `FAMILY_OVERRIDE_GLITCH` + `STATE_OR_VIEWPORT_DRIFT` | Khôi phục Common skeleton accessibility outcome dưới family scope. |
| Đã kiểm tra default và pending nhưng bỏ unavailable, skeleton, settlement hoặc blur. | `PROOF_MISSING` | Hoàn tất các cell state và transition bắt buộc trước closure. |
