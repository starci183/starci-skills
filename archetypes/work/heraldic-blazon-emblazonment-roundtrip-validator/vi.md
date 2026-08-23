# Heraldic blazon emblazonment roundtrip validator

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `heraldic-blazon-emblazonment-roundtrip-validator` |
| Family | Work |
| Dominant task | Xác thực blazon chuẩn hóa theo thẩm quyền và emblazonment biểu đạt cùng một arms bằng parse–render–recapture, đồng thời giải thích mọi semantic delta. |
| Search aliases | blazon validator, emblazonment roundtrip, heraldic recapture |
| Authority | Authority topology page trung lập với product; archetype không chọn product semantics, visual direction, token, component, geometry chính xác hoặc breakpoint. |

### Invariants

- `heraldic-roundtrip` sở hữu toàn bộ dominant task, work state và recovery boundary.
- Xác thực blazon chuẩn hóa theo thẩm quyền và emblazonment biểu đạt cùng một arms bằng parse–render–recapture, đồng thời giải thích mọi semantic delta.
- Mọi region bắt buộc giữ owner, quan hệ và stable identity đã đặt tên; Grammar chỉ gắn owner theo product.
- Wide, intermediate và compact đổi topology khi một quan hệ đã đặt tên thất bại, không theo device label.
- Transformation giữ selection, draft, pending work, error, recovery, reading order và nghĩa của focus.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `HER-01` | Xác thực blazon chuẩn hóa theo thẩm quyền và emblazonment biểu đạt cùng một arms bằng parse–render–recapture, đồng thời giải thích mọi semantic delta. | Bằng chứng dương bắt buộc. |
| `HER-02` | Mọi region và quan hệ bắt buộc trong graph đều cần để hoàn tất task. | Yêu cầu graph đầy đủ. |
| `HER-03` | Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Parse normalized blazon clause tree → Map tincture, charge, and attitude to scene → Recapture accessible structure and expose tincture delta → Correct scene semantics without dragging → Re-run tincture and position rules → Approve register proof HR-204. | Yêu cầu proof path đặc thù của domain. |
| `HER-04` | Work state phải tồn tại qua cả ba topology response đã đặt tên. | Yêu cầu responsive parity. |
| `HER-05` | Các state literal của domain được giữ nguyên để đồng bộ runtime: grant draft/registered/superseded, clause parsed/ambiguous/invalid, tincture resolved/conflicting, charge attitude known/unknown, marshalling complete/incomplete, scene generated/stale, recapture equivalent/divergent, rule pass/warn/fail, difference mark verified and review approved/returned. | Yêu cầu bao phủ state và recovery. |
| `HER-90` | Từ chối khi candidate thuộc adjacent archetype `canvas-inspector-workspace`, `media-annotation-review-console`, `reconciliation-diff-workbench` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state. | Reject. |
| `HER-91` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |
| `HER-92` | Một adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |

### Selection rule

Chọn `heraldic-blazon-emblazonment-roundtrip-validator` khi và chỉ khi các code `HER-01`–`05` đều có bằng chứng và không có code `HER-90`–`92`. Trả `needs-evidence` nếu dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
heraldic-roundtrip
├─ jurisdiction-grant-and-register-authority (downstream)
├─ normalized-blazon-clause-tree (downstream)
├─ tincture-ordinary-charge-attitude-and-marshalling-semantics (downstream)
├─ deterministic-emblazonment-scene-graph (downstream)
├─ accessible-structural-description (peer synchronization)
├─ visual-to-semantic-recapture (downstream)
├─ tincture-rule-positional-and-difference-mark-validation (downstream)
├─ blazon-vs-recaptured-roundtrip-delta (downstream)
└─ herald-review-and-register-proof (downstream)
```

Biểu thức quan hệ binding là `heraldic-roundtrip → jurisdiction-grant-and-register-authority → normalized-blazon-clause-tree → tincture-ordinary-charge-attitude-and-marshalling-semantics → deterministic-emblazonment-scene-graph ↔ accessible-structural-description → visual-to-semantic-recapture → tincture-rule-positional-and-difference-mark-validation → blazon-vs-recaptured-roundtrip-delta → herald-review-and-register-proof`; các operator giữ nghĩa directed, peer hoặc joint-axis đã khai báo trong prompt.

### Region obligations

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `heraldic-roundtrip` | heraldic-roundtrip sở hữu bằng chứng và trạng thái của chính vùng này; sở hữu boundary của dominant task và truyền identity không đổi tới `jurisdiction-grant-and-register-authority`. Vùng này không hấp thụ owner của vùng khác. |
| `jurisdiction-grant-and-register-authority` | jurisdiction-grant-and-register-authority sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `heraldic-roundtrip` và truyền identity không đổi tới `normalized-blazon-clause-tree`. Vùng này không hấp thụ owner của vùng khác. |
| `normalized-blazon-clause-tree` | normalized-blazon-clause-tree sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `jurisdiction-grant-and-register-authority` và truyền identity không đổi tới `tincture-ordinary-charge-attitude-and-marshalling-semantics`. Vùng này không hấp thụ owner của vùng khác. |
| `tincture-ordinary-charge-attitude-and-marshalling-semantics` | tincture-ordinary-charge-attitude-and-marshalling-semantics sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `normalized-blazon-clause-tree` và truyền identity không đổi tới `deterministic-emblazonment-scene-graph`. Vùng này không hấp thụ owner của vùng khác. |
| `deterministic-emblazonment-scene-graph` | deterministic-emblazonment-scene-graph sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `tincture-ordinary-charge-attitude-and-marshalling-semantics` và truyền identity không đổi tới `accessible-structural-description`. Vùng này không hấp thụ owner của vùng khác. |
| `accessible-structural-description` | accessible-structural-description sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ ↔ với upstream `deterministic-emblazonment-scene-graph` và truyền identity không đổi tới `visual-to-semantic-recapture`. Vùng này không hấp thụ owner của vùng khác. |
| `visual-to-semantic-recapture` | visual-to-semantic-recapture sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `accessible-structural-description` và truyền identity không đổi tới `tincture-rule-positional-and-difference-mark-validation`. Vùng này không hấp thụ owner của vùng khác. |
| `tincture-rule-positional-and-difference-mark-validation` | tincture-rule-positional-and-difference-mark-validation sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `visual-to-semantic-recapture` và truyền identity không đổi tới `blazon-vs-recaptured-roundtrip-delta`. Vùng này không hấp thụ owner của vùng khác. |
| `blazon-vs-recaptured-roundtrip-delta` | blazon-vs-recaptured-roundtrip-delta sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `tincture-rule-positional-and-difference-mark-validation` và truyền identity không đổi tới `herald-review-and-register-proof`. Vùng này không hấp thụ owner của vùng khác. |
| `herald-review-and-register-proof` | herald-review-and-register-proof sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `blazon-vs-recaptured-roundtrip-delta`; phát hành completion evidence. Vùng này không hấp thụ owner của vùng khác. |

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
- **Topology response:** Tái cấu trúc dominant task thành một route primary theo semantic order `heraldic-roundtrip → jurisdiction-grant-and-register-authority → normalized-blazon-clause-tree → tincture-ordinary-charge-attitude-and-marshalling-semantics → deterministic-emblazonment-scene-graph ↔ accessible-structural-description → visual-to-semantic-recapture → tincture-rule-positional-and-difference-mark-validation → blazon-vs-recaptured-roundtrip-delta → herald-review-and-register-proof`; support mở theo stage và không tạo horizontal scroll cấp trang.
- **Navigation replacement:** Route stage một-pane có label thay simultaneous columns và giữ chính xác active object cùng recovery target.
- **Sticky boundary:** Chỉ action của current stage được sticky với safe-area spacing; landscape hoặc short height đưa nó về flow.
- **Overflow owner:** Không horizontal scroll cấp page; bằng chứng hai chiều dùng một bounded region có label hoặc semantic list thay thế.

### Reflow

- DOM order, reading order, and meaningful focus order are `heraldic-roundtrip → jurisdiction-grant-and-register-authority → normalized-blazon-clause-tree → tincture-ordinary-charge-attitude-and-marshalling-semantics → deterministic-emblazonment-scene-graph ↔ accessible-structural-description → visual-to-semantic-recapture → tincture-rule-positional-and-difference-mark-validation → blazon-vs-recaptured-roundtrip-delta → herald-review-and-register-proof`; CSS never reorders semantics.
- Label dài, bản dịch, zoom 400% và text phóng lớn wrap mà không mất action hoặc nghĩa state.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape hoặc Cancel và trả về đúng trigger với work context nguyên vẹn.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics bên cạnh color rồi announce mà không cướp focus.
- Validation giữ input, lộ inline error, focus summary cho nhiều lỗi và cung cấp recovery cụ thể.
- Các state literal của domain được giữ nguyên để đồng bộ runtime: grant draft/registered/superseded, clause parsed/ambiguous/invalid, tincture resolved/conflicting, charge attitude known/unknown, marshalling complete/incomplete, scene generated/stale, recapture equivalent/divergent, rule pass/warn/fail, difference mark verified and review approved/returned.

## State obligations

Các state literal của domain được giữ nguyên để đồng bộ runtime: grant draft/registered/superseded, clause parsed/ambiguous/invalid, tincture resolved/conflicting, charge attitude known/unknown, marshalling complete/incomplete, scene generated/stale, recapture equivalent/divergent, rule pass/warn/fail, difference mark verified and review approved/returned.

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

- Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Parse normalized blazon clause tree → Map tincture, charge, and attitude to scene → Recapture accessible structure and expose tincture delta → Correct scene semantics without dragging → Re-run tincture and position rules → Approve register proof HR-204.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Từ chối khi candidate thuộc adjacent archetype `canvas-inspector-workspace`, `media-annotation-review-console`, `reconciliation-diff-workbench` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `HER-90`–`92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [College of Arms official guidance and records](https://www.college-of-arms.gov.uk/) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [Canadian Heraldic Authority Public Register](https://www.gg.ca/en/heraldry/public-register/project/1698) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |

## Output

| Trường | Contract |
|---|---|
| `archetypeId` | Fixed value `heraldic-blazon-emblazonment-roundtrip-validator`. |
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
{"archetypeId":"heraldic-blazon-emblazonment-roundtrip-validator","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
