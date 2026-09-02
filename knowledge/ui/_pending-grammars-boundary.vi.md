# Boundary

`ui.boundary` quyết định reusable owner nào vẽ, đặt tên, clip, phân cách hay elevate một region. Phân
loại finding theo [canonical verdict model](INDEX.vi.md#canonical-verdict-model). Common sở hữu
boundary anatomy, metric, semantic, focus/state behavior và clipping; family chỉ được đổi paint có
scope. Application sở hữu business content, page canvas, product media và placement hợp lệ.

## BOUNDARY-1 — Một reusable boundary owner

### When

Content cần visible region box, semantic grouping hoặc peer separator. Page background hay media
canvas thuộc application không tự thành reusable component boundary.

### Apply

- Chọn Common owner hiện có như `SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard` hoặc `Divider`.
- Để owner emit complete box/separator; không thêm app border, radius, background hay shadow thứ hai.
- Chứng minh một semantic region owner và một painted edge ở mỗi side từ computed style và final pixel.
- Family được repaint emitted anchor; application được đặt complete owner mà không reach-through.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Account content nằm trong một bounded Common `SurfaceCard`. | `PASS` | Một component sở hữu semantic và complete edge. |
| App bọc `SurfaceCard` bằng một rounded bordered card khác. | `APP_REIMPLEMENTATION` · `DOUBLE_OWNER` | Hai shell claim cùng region; bỏ app wrapper. |
| Family paint pseudo-element border ngoài Common anchor. | `FAMILY_OVERRIDE_GLITCH` · `DOUBLE_OWNER` | Bind paint vào published owner thay vì tạo edge thứ hai. |

## BOUNDARY-2 — Nesting và seam

### When

Bounded region chứa nested job thật sự khác hoặc nhiều touching child band. Visual decoration đơn
thuần không justify surface khác.

### Apply

- Dùng Common `SurfaceCard depth="top|nested"`, `frame="bounded|frameless"` và `composition="single|joined"` đúng relationship.
- Cho mỗi seam đúng một owner; joined child được sở hữu separator, outer surface sở hữu clipping.
- Chứng minh semantic job khác nhau, một outer edge, một separator mỗi seam và không doubled inset trong computed geometry.
- Family repaint cùng anchor; application compose content qua prop/public placement, không qua descendant CSS.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Joined plan surface có touching detail/action band với một separator. | `PASS` | Outer clipping và inner seam có owner riêng. |
| Nested card lặp job của parent chỉ để thêm shadow. | `APP_REIMPLEMENTATION` · `DOUBLE_OWNER` | Bỏ ornamental nesting; một job cần một boundary. |
| Parent và first child cùng vẽ top seam. | `COMMON_IMPLEMENTATION_GLITCH` · `DOUBLE_OWNER` | Sửa reusable joined anatomy để một side sở hữu line. |

## BOUNDARY-3 — Labelled alternative và divider

### When

Boundary đặt tên region hoặc tách peer alternative. Decorative line không relationship không chọn
semantic divider.

### Apply

- Giữ surface label trong Common component/accessibility relationship; chỉ dùng Common `Divider label` giữa peer alternative thật.
- Yêu cầu visible localized label và separator name mô tả nội dung ở hai phía.
- Chứng minh `aria-labelledby`/`aria-label`, visible label text, separator role và adjacency trong accessibility tree.
- Family được paint line/label; application truyền wording nhưng không đưa label ownership ra ngoài Common.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| “Hoặc tiếp tục với” tách password và provider sign-in. | `PASS` | Common divider đặt tên hai alternative thật. |
| Divider được chèn chỉ để lấp khoảng trống. | `APP_REIMPLEMENTATION` · `WRONG_OWNER` | Bỏ decoration hoặc dùng layout relationship thật. |
| Visible surface title nằm ngoài component nó đặt tên. | `APP_WORKAROUND` · `WRONG_OWNER` | Khôi phục Common label relationship hoặc thêm capability còn thiếu. |

## BOUNDARY-4 — Elevation theo occlusion

### When

Một layer tạm che layer khác và cần stacking relationship do interaction owner quản lý. Emphasis
mạnh hơn trên ordinary in-flow content chưa đủ.

### Apply

- Giữ placement, stacking, focus/dismissal behavior và elevation cùng một Common overlay owner.
- Common `Tooltip` sở hữu annotation placement; chưa có general reusable overlay-elevation prop cho arbitrary content.
- Chứng minh actual occlusion, stacking order, focus path, dismissal path và final shadow/outline pixel; shadow alone không đủ.
- Family được repaint overlay hiện có; application phải ghi Common capability gap thay vì thêm arbitrary z-index/shadow recipe.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Common `Tooltip` hiện trên trigger và biến mất cùng owner. | `PASS` | Placement và occluding annotation cùng reusable owner. |
| Product cần generic elevated overlay chưa có trong Common. | `COMMON_CAPABILITY_MISSING` | Thêm reusable overlay contract trước product styling. |
| Ordinary card nhận shadow lớn chỉ để trông quan trọng. | `APP_OVERRIDE` · `WRONG_OWNER` | Elevation không phải hierarchy; khôi phục surface treatment. |

## BOUNDARY-5 — State, clipping và responsive flattening

### When

Boundary load, thành unavailable/selected, chứa focus/overflow hoặc visually flatten trong responsive
composition. Decorative edge ẩn mà ownership không đổi không phải flattening.

### Apply

- Giữ cùng Common region owner qua state; bounded surface sở hữu clipping, frameless surface cố ý expose overflow.
- Giữ focus visibility, required content, control và một scroll owner khi paint/layout đổi.
- Test overflow, focus outline, loading/outcome transition, width hẹp/trung gian/rộng và zoom 200%; so owner/edge count.
- Family chỉ được bỏ/đổi paint khi ownership/metric tồn tại; application được recompose placement nhưng không strand content.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Bounded surface giữ owner, clip media và vẫn cho thấy internal focus ring. | `PASS` | Clipping có chủ đích và không hide interaction evidence. |
| Mobile CSS bỏ boundary duy nhất làm control dính với region kế. | `APP_OVERRIDE` · `STATE_OR_VIEWPORT_DRIFT` | Flattening xóa ownership; giữ structural cue hoặc Common surface hợp lệ. |
| Selected-state outline bị Common frame cắt. | `COMMON_IMPLEMENTATION_GLITCH` | Sửa focus/selection placement bên trong clipping owner. |
