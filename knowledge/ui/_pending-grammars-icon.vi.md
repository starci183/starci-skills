> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> mechanics, not an application decision. It has no successor under composition, presentation, or
> proof. Do not load it as runtime authority.

# Icon

`ui.icon` sở hữu reusable icon role, measured box, placement, motion limit và accessible identity.
Phân loại finding theo [canonical verdict model](INDEX.vi.md#canonical-verdict-model). Tách semantic
glyph mapping, Common role source, runtime computed box, final pixel và accessibility output thành
evidence riêng. Common sở hữu role geometry/behavior; family chỉ được đổi paint, không đổi metric hay
meaning. Application sở hữu product meaning, reviewed glyph source, visible label, state truth, page
canvas và placement.

## ICON-1 — Source priority và measured role

### When

Semantic meaning được hỗ trợ bởi standalone icon hoặc icon đi cùng text. Decoration không meaning
vẫn cần role box nhưng không cần accessible name.

### Apply

- Resolve product meaning một lần qua reviewed glyph registry của application rồi truyền Common `Icon source` thật.
- Dùng closed role `heading`, `leading`, `chip`; ở root 16 px, nominal box là 24×24, 20×20 và 16×16 CSS px.
- Chứng minh registry mapping, role prop, computed width/height, peer alignment và accessibility output named/hidden riêng.
- Family được recolor glyph; application được chọn/placement nhưng không import vendor icon vào reusable anatomy hay size SVG cục bộ.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Labelled workspace row dùng decorative `Icon role="leading"` compute 20×20 px. | `PASS` | Text sở hữu identity, Common sở hữu stable box. |
| App import Heroicon và thêm `size-5` cạnh reusable row. | `APP_REIMPLEMENTATION` · `VENDOR_LEAK` | Route meaning qua reviewed registry và Common `Icon`. |
| Equal peer compute mixed icon box 16 px và 20 px. | `APP_OVERRIDE` · `VALUE_DRIFT` | Chọn một shared role và bỏ local sizing. |

## ICON-2 — Compact chip và explicit status

### When

Compact attribute hay verified state được hỗ trợ bởi glyph cạnh short text. Heading, decorative dot
hay unresolved state không đủ điều kiện.

### Apply

- Dùng Common `Badge` với visible word và Common `Icon role="chip"` trong public `startContent`.
- Giữ chip icon ở nominal role 16×16 và chọn `Badge` tone khớp verified state.
- Chứng minh explicit text, tone, glyph shape, computed box và một accessible status identity; bỏ color và xác nhận meaning còn nguyên.
- Family được repaint badge/icon; application sở hữu state word và glyph source, không sở hữu chip anatomy.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| “Khỏe” dùng success `Badge` với chip icon 16 px và visible text. | `PASS` | Word, tone và glyph hỗ trợ cùng verified state. |
| Green check icon xuất hiện một mình cho success. | `APP_REIMPLEMENTATION` · `WRONG_OWNER` | Thêm explicit state text qua Common `Badge`; glyph/color chưa đủ. |
| Pending data được hiện bằng success chip trước khi resolve. | `APP_OVERRIDE` · `STATE_OR_VIEWPORT_DRIFT` | Giữ wording/tone neutral hay pending tới khi có evidence. |

## ICON-3 — Mọi tab giữ icon và label identity

### When

Peer destination dùng icon-led Common tab set. Text-only tab design nhất quán cho mọi peer là pattern
khác, không cho phép mixed identity.

### Apply

- Cho mọi Common `Tabs` item một stable `label` và `leading` Common `Icon role="leading"`; dùng `labelVisibility="responsive|always"` có chủ đích.
- Giữ nominal leading box 20×20, accessible tab name và non-color selected indicator 2 px của Common.
- Chứng minh icon/label presence cho mọi peer, equal computed box, compact/wide output và selected/focus state.
- `TabItem.leading` hiện optional nên reusable enforcement là Common capability gap; family được paint nhưng application không hide unfamiliar identity.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Mọi profile tab có leading icon 20 px, stable label và selected indicator. | `PASS` | Peer identity và selection nhất quán. |
| Reusable icon-led tab contract cần ngăn một icon bị thiếu. | `COMMON_CAPABILITY_MISSING` | `leading` đang optional; làm required pattern representable trong Common. |
| Compact CSS hide label khi một tab không có icon nhận diện được. | `APP_OVERRIDE` · `STATE_OR_VIEWPORT_DRIFT` | Giữ label visible hoặc cung cấp complete Common identity trước khi compact. |
| Family bỏ selected indicator và chỉ giữ accent text. | `FAMILY_OVERRIDE_GLITCH` · `WRONG_OWNER` | Khôi phục inherited non-color selection anatomy. |

## ICON-4 — Directional action arrow

### When

Labelled action move forward/next/continue hoặc trở về context trước. Identity mark và
physical-direction symbol không mirror chỉ vì text direction đổi.

### Apply

- Đặt arrow source do app chọn trong Common `Icon role="chip"`; dùng `endContent` cho forward và `startContent` cho back trên Common action.
- Giữ arrow nominal 16×16 px; logical navigation có thể mirror, physical direction/brand identity giữ literal.
- Nếu có motion, chứng minh chỉ arrow translate, action outer box đứng yên và reduced motion compute đúng 0 px translation.
- Common expose content slot nhưng không có arrow-motion anchor; reusable arrow motion được yêu cầu là capability gap, static arrow có thể pass.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| “Tiếp tục” có static arrow 16 px trong `endContent`; pending bỏ adornment. | `PASS` | Direction hỗ trợ labelled Common action và state vẫn truthful. |
| Family muốn moving arrow nhưng Common chưa có motion wrapper/anchor. | `COMMON_CAPABILITY_MISSING` | Thêm reusable Common motion owner trước animation. |
| App CSS move toàn button 4 px khi hover. | `APP_OVERRIDE` · `WRONG_OWNER` | Target và label phải đứng yên; bỏ local choreography. |
| Reduced-motion vẫn translate arrow 2 px. | `FAMILY_OVERRIDE_GLITCH` · `STATE_OR_VIEWPORT_DRIFT` | Đặt computed translation về 0 rồi retest. |

## ICON-5 — Utility icon-only action

### When

Utility quen thuộc universal vẫn rõ khi không có persistent text label. Primary decision hay product
command lạ phải giữ text label.

### Apply

- Dùng Common `IconButton`; `label` bắt buộc sở hữu accessible name và Common `Icon role="leading"` sở hữu glyph box.
- Yêu cầu computed target tối thiểu 24×24 CSS px nơi WCAG 2.2 target size áp dụng; ưu tiên 44×44 px cho coarse-pointer quality.
- Compose Common `Tooltip` với resolved word khi recognition không chắc; chứng minh keyboard/pointer reveal mà không thay accessible name.
- Family được repaint control; application chọn label, glyph, handler và placement mà không dựng lại circular button.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Close utility dùng `IconButton` label “Đóng” và computed target 40×40 px. | `PASS` | Action có name và vượt normative target floor. |
| Icon-only primary “Gửi” không có visible word. | `APP_OVERRIDE` · `WRONG_OWNER` | Primary decision giữ text label; dùng Common `Button`. |
| Utility lạ có accessible name nhưng không visible explanation khi focus. | `PROOF_MISSING` | Thêm/verify Common `Tooltip` khi audience không nhận ra tin cậy. |
| App build circular button quanh Common `Icon`. | `APP_REIMPLEMENTATION` | Common `IconButton` đã sở hữu control semantic và geometry. |

## ICON-6 — Accessibility, fallback và state truth

### When

Icon meaningful standalone, đi cùng named content, decorative/loading, fail source resolution hoặc
đổi theo product state.

### Apply

- Cho standalone meaningful Common `Icon` một `ariaLabel` ngắn; omit cạnh equivalent visible text để Common emit `aria-hidden`.
- Giữ decorative/skeleton icon silent; pair state glyph với explicit word và verified state.
- Chứng minh exact accessibility name, không duplicate announcement, stable computed box, forced-color visibility và honest fallback identity.
- Application registry được chọn approved fallback glyph hay visible text; nếu reusable failure behavior cần hơn `source`, ghi Common capability gap.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Standalone warning icon có `ariaLabel="Cảnh báo"` và stable role geometry. | `PASS` | Icon tự sở hữu một concise identity. |
| Companion icon của labelled row lặp cùng accessible name. | `APP_OVERRIDE` · `DOUBLE_OWNER` | Omit `ariaLabel` để Common hide decorative companion. |
| Missing registry mapping làm icon slot collapse. | `PROOF_MISSING` · `STATE_OR_VIEWPORT_DRIFT` | Cung cấp approved registry fallback hay visible text rồi remeasure. |
| Reusable source-error state được yêu cầu nhưng Common chỉ nhận `source`. | `COMMON_CAPABILITY_MISSING` | Thêm typed fallback/state contract thay vì app error CSS. |
| Status glyph đổi sang success nhưng visible word vẫn là pending. | `APP_OVERRIDE` · `VALUE_DRIFT` | Đồng bộ glyph, word và verified state. |
