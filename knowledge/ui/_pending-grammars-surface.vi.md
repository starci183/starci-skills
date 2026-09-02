# Surface

`ui.surface` sở hữu reusable region anatomy, material-boundary placement, depth, state, action,
scroll và responsive continuity. Phân loại finding theo [canonical verdict model](INDEX.vi.md#canonical-verdict-model).
Source chứng minh Common API/slot owner; computed geometry, final pixel, interaction và accessibility
tree chứng minh bản render. Family được đổi scoped paint nhưng không đổi Common semantic hay metric.
Application sở hữu purpose, content, data, effect, page canvas và placement hợp lệ.

## SURFACE-1 — Một compound-card anatomy của Common

### When

Reusable region cần một surface có label hoặc tự có name với một content owner. Product-only layout
wrapper không có reusable region semantic không chọn anatomy này.

### Apply

- Dùng Common `SurfaceCard`; anatomy HeroUI 3.2.4 đã cài là `Card.Root` với optional `Card.Header` và đúng một `Card.Content`.
- Giữ `Card.Root variant="transparent"`, section owner và published surface anchor của Common; application không import vendor card.
- Chứng minh một `data-slot="card"`, zero/một `card-header`, đúng một `card-content` và một accessible region name.
- Family được paint published anchor; application truyền prop/content và đặt complete component mà không copy DOM.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Labelled `SurfaceCard` render một card, một header và một content slot. | `PASS` | Common sở hữu complete compound region. |
| App import HeroUI `Card` để bắt chước surface. | `APP_REIMPLEMENTATION` · `VENDOR_LEAK` | Dùng Common `SurfaceCard`; vendor anatomy là internal implementation. |
| Common emit hai `card-content` slot cho một surface. | `COMMON_IMPLEMENTATION_GLITCH` · `DOUBLE_OWNER` | Sửa Common renderer để khôi phục một content owner. |

## SURFACE-2 — Family chọn nơi paint một material duy nhất

### When

Cùng bounded Common surface cần nhận material language của family nhưng giữ nguyên prop, content
geometry, semantic và state behavior.

### Apply

- Giữ Common DOM và chỉ dùng scoped family selector trên published surface/frame/label anchor.
- Paint đúng một material boundary: Core có thể paint labelled root; Heritage/Offset Pop có thể paint bounded content slot khi root transparent.
- Chứng minh một visible edge/background/shadow owner, content metric không đổi và label vẫn trong Common region/accessibility owner.
- Family được đổi paint location giữa published anchor; application được style surrounding canvas nhưng không patch surface slot.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Core paint labelled root và để content slot transparent. | `PASS` | Một material chứa label/content mà không tạo card thứ hai. |
| Heritage giữ root transparent và paint bounded content slot một lần. | `PASS` | Material đổi, Common anatomy/metric vẫn nguyên. |
| Root và content cùng có background, border và shadow. | `FAMILY_OVERRIDE_GLITCH` · `DOUBLE_OWNER` | Bỏ một painted layer rồi kiểm lại mọi edge. |
| App CSS reach `[data-slot="card-content"]` để đổi family. | `APP_OVERRIDE` · `WRONG_OWNER` | Chọn hoặc sửa family; app không patch Common slot. |

## SURFACE-3 — Frame, depth, composition, measure và height là closed prop

### When

Content ở top/nested, đã sở hữu boundary, chứa touching child band, dùng form measure hoặc phải
stretch cùng peer surface.

### Apply

- Chỉ dùng Common prop hiện có: `depth="top|nested"`, `frame="bounded|frameless"`, `composition="single|joined"`, `measure="content|form|formCompact"`, `height="auto|fill"`.
- Frameless phải bỏ paint/inset, joined content dùng zero body inset và fill stretch toàn surface anatomy.
- Chứng minh prop value, computed frame/inset/overflow, content measure và equal outer height; đếm một owner mỗi edge/inset.
- Family được repaint closed geometry; application chỉ dùng public placement/width hook, không descendant selector hay compensating wrapper.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Touching plan band dùng `composition="joined"`, Common body compute zero inset. | `PASS` | Child band sở hữu seam, Common sở hữu outer clipping. |
| Media đã có boundary nên surface dùng `frame="frameless"`. | `PASS` | Common giữ semantic owner mà không vẽ shell khác. |
| App thêm negative margin để triệt Common surface padding. | `APP_WORKAROUND` · `DOUBLE_OWNER` | Chọn đúng closed prop hoặc thêm Common capability còn thiếu. |
| `height="fill"` chỉ stretch inner body, không stretch card root. | `COMMON_IMPLEMENTATION_GLITCH` | Sửa complete Common height chain. |

## SURFACE-4 — State, whole action, scroll và highlight giữ một owner

### When

Surface pending, unavailable, có outcome, interactive như một target, scroll nội bộ hoặc là một
highlighted surface duy nhất đã duyệt.

### Apply

- Dùng `SurfaceCard state`, `wholeAction`, `scroll="page|contained"`/`isScrollable` và `isHighlight`; giữ state trong `PresentationState`.
- Pending/unavailable bỏ operability của whole action, contained scroll tạo một vertical owner và pending suppress highlight.
- Chứng minh một native link/button overlay, một same-axis scroll owner, disabled focus behavior, không pending highlight và stable outer geometry.
- Family paint emitted state/highlight anchor; application truyền verified state/effect, không copy overlay, scroll shadow hay sweep layer.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Whole-card link mất focusability khi surface pending. | `PASS` | State và interaction cùng Common owner. |
| Contained surface có cả page-axis và nested vertical scrollbar. | `APP_OVERRIDE` · `DOUBLE_OWNER` | Giữ một same-axis scroll owner và bỏ app overflow wrapper. |
| Highlight vẫn animate trong pending. | `COMMON_IMPLEMENTATION_GLITCH` · `STATE_OR_VIEWPORT_DRIFT` | Common phải suppress decorative sweep ở pending. |
| App thêm absolute link thứ hai trên `wholeAction`. | `APP_REIMPLEMENTATION` · `DOUBLE_OWNER` | Bỏ duplicate action overlay. |

## SURFACE-5 — Heading ownership là Common gap chính xác hiện tại

### When

Labelled surface xuất hiện dưới outline parent khác nhau hoặc cạnh labelled Common compound khác.
Self-named surface không visible label không cần generated heading.

### Apply

- Inspect label renderer thật: `SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard` hiện emit Common `Label as="h3"`.
- Yêu cầu typed Common level hay labelled-by capability khi contextual level đúng không phải `h3`.
- Chứng minh page outline, region-name relationship và không duplicate hidden heading trước khi pass.
- Family được style label hiện có; application không thêm local heading hay slot CSS để sửa gap.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Surface đúng là level 3 và label đặt tên content. | `PASS` | Fixed Common output hiện tại khớp context. |
| Surface trực tiếp dưới `h1` cần label `h2`. | `COMMON_CAPABILITY_MISSING` | Common không chọn được level cần; thêm typed capability. |
| Hai peer surface cần level dẫn xuất từ parent khác nhau. | `COMMON_CAPABILITY_MISSING` | Fixed `h3` không biểu diễn an toàn cả hai context. |
| App đặt `h2` trước surface rồi hide built-in label. | `APP_WORKAROUND` · `DOUBLE_OWNER` | Bỏ duplicate và giải heading ownership trong Common. |
