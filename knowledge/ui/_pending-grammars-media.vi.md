> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> mechanics, not an application decision. It has no successor under composition, presentation, or
> proof. Do not load it as runtime authority.

# Media

`ui.media` sở hữu reusable media job, frame ratio, fit, treatment, crop integrity, accessible intent,
fallback geometry và provenance proof. Phân loại finding theo
[canonical verdict model](INDEX.vi.md#canonical-verdict-model). Tách approved source/provenance,
intrinsic dimension, Common prop, computed frame/fit, visible crop và accessibility output thành
evidence riêng. Common sở hữu `MediaFrame` anatomy/metric; family được đổi paint nhưng không đổi các
contract đó. Application sở hữu user job, approved asset/rights, factual content, alt/caption word,
page canvas và placement. Quyết định generate asset nằm trong feature workflow.

## MEDIA-1 — Chọn một user job rõ ràng

### When

Region đề xuất photograph, illustration, diagram, video, provider mark hay generated bitmap. Asset
chỉ lấp chỗ trống hoặc chạy theo visual trend không đủ điều kiện.

### Apply

- Gọi tên một user job trước khi chọn media: orientation, recognition, comparison, instruction hoặc approved identity.
- Trình bày selected asset qua Common `MediaFrame`; chọn `aspect`, `fit`, `treatment` thật theo job đó.
- Chứng minh job, approved source/rights, một dominant region anchor và visible result ở mọi material viewport.
- Family được repaint frame; application được chọn/position approved asset nhưng không dựng parallel reusable frame.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Central crop-safe photograph giúp learner định hướng course topic. | `PASS` | Asset có một job rõ và Common frame có owner. |
| Stock image được thêm chỉ để lấp card trống. | `APP_REIMPLEMENTATION` · `WRONG_OWNER` | Bỏ filler media; cải thiện content/composition. |
| Decorative hero cạnh tranh với primary decision của page. | `APP_OVERRIDE` · `VALUE_DRIFT` | Bỏ hoặc hạ media để giữ một dominant anchor. |
| Approved asset hiện có đã làm đúng job. | `PASS` | Reuse nó; novelty không phải lý do generate art thay thế. |

## MEDIA-2 — Aspect và crop giữ subject

### When

Approved raster/video có thể crop mà không mất declared focal subject hay must-preserve region.
Edge-to-edge diagram và mark chọn contain.

### Apply

- Dùng Common aspect thật: `landscape` 16:10, `portrait` 4:5, `square` 1:1 hoặc `auto`; chỉ dùng `fit="cover"` cho crop-safe content.
- Yêu cầu `visible_fraction = 1.0` cho mọi must-preserve region ở width hẹp, trung gian và rộng; không stretch intrinsic ratio.
- Chứng minh intrinsic/rendered dimension, computed aspect/`object-fit`, crop rectangle, focal point và từng visible fraction riêng.
- `MediaFrame` không có focal-point/object-position prop; required non-default crop là Common capability gap, không phải app descendant CSS.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Centered subject hiện đủ trong frame 16:10 `cover` ở cả ba width. | `PASS` | Mọi declared region có visible fraction 1.0. |
| Portrait crop mất một phần khuôn mặt ở compact width. | `PROOF_MISSING` · `STATE_OR_VIEWPORT_DRIFT` | Đổi asset/fit hoặc thêm Common crop capability rồi recapture mọi width. |
| Required focal point lệch tâm và `MediaFrame` không biểu diễn được. | `COMMON_CAPABILITY_MISSING` | Common cần typed focal-position contract trước khi dùng cover. |
| App CSS thêm `object-position` vào child của `MediaFrame`. | `APP_OVERRIDE` · `WRONG_OWNER` | Bỏ reach-through và giải Common gap. |

## MEDIA-3 — Diagram và mark dùng contain

### When

Mọi edge, label, symbol, code line, instruction step hay approved mark contour đều mang meaning.
Crop-safe atmospheric imagery không thuộc rule này.

### Apply

- Dùng Common `MediaFrame fit="contain"`; dùng `treatment="framed"` cho independent region và `plain` khi surrounding material đã sở hữu edge.
- Giữ intrinsic aspect; provider/brand mark dùng approved asset, không dùng generated approximation.
- Chứng minh toàn meaningful graphic visible, embedded text có accessible real-text equivalent và đúng một material boundary.
- Family được repaint frame; application sở hữu approved source, accessible explanation và placement, không sở hữu local fit/border recipe.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Routing diagram dùng `contain`; mọi node và label đều visible. | `PASS` | Không meaningful pixel nào bị crop. |
| Provider SVG bị stretch để lấp square. | `APP_OVERRIDE` · `VALUE_DRIFT` | Khôi phục approved intrinsic ratio và `contain`. |
| Explanation duy nhất của diagram là tiny text trong bitmap. | `PROOF_MISSING` | Thêm real text hoặc complete accessible alternative. |
| Framed diagram trong bounded surface sẵn có vẽ box thứ hai. | `APP_OVERRIDE` · `DOUBLE_OWNER` | Dùng `treatment="plain"` hoặc bỏ surrounding duplicate boundary. |

## MEDIA-4 — Accessibility intent và caption rõ ràng

### When

Media informative, decorative hoặc duplicate information đã nói gần đó. Filename, generation prompt
và visual style không quyết định accessible intent.

### Apply

- Informative media child cung cấp alternative truyền declared job/meaning; decorative media dùng empty alternative và silent.
- Dùng Common `MediaFrame caption` cho visible context, credit hay instruction; không lặp cùng identity trong alt, caption và nearby heading.
- Chứng minh figure/figcaption relationship, exact accessibility-tree name/description và equivalent task information khi image unavailable.
- Family được thay renderer tương thích nhưng giữ cùng result; application sở hữu alt/caption content ngắn gọn.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Informative topology image có concise alt; caption thêm source context. | `PASS` | Alternative và caption có job hữu ích khác nhau. |
| Decorative flourish được announce “purple abstract background”. | `APP_OVERRIDE` · `WRONG_OWNER` | Dùng empty alternative để decoration silent. |
| Alt, caption và heading lặp cùng course title. | `APP_OVERRIDE` · `DOUBLE_OWNER` | Giữ một identity, để text khác thêm context riêng. |
| Bỏ image cũng làm mất instruction không có ở đâu khác. | `PROOF_MISSING` | Cung cấp equivalent accessible instruction trước khi pass. |

## MEDIA-5 — Loading và failure giữ task

### When

Source load chậm, missing, denied, unavailable hoặc decode fail. Optional asset cố ý bỏ là absence,
không phải media loading/error state.

### Apply

- Giữ aspect, fit, treatment, owner và caption của selected frame qua loading, success và failure.
- Yêu cầu honest Common-owned loading/error representation với stable geometry và useful text hoặc approved fallback.
- Chứng minh equal outer frame dimension, explicit state text, silent loading decoration, không broken asset và không fabricated replacement claim.
- `MediaFrame` hiện không có loading/error prop hay state renderer; phân loại là Common capability gap và cấm app-local frame/CSS workaround.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Network diagram cần reserved loading và decode-failure state. | `COMMON_CAPABILITY_MISSING` | Common chưa biểu diễn được state; thêm typed capability. |
| App overlay local skeleton trong `MediaFrame`. | `APP_WORKAROUND` · `WRONG_OWNER` | Bỏ parallel state anatomy và giải Common gap. |
| Failed image collapse từ 16:10 xuống zero height. | `APP_OVERRIDE` · `STATE_OR_VIEWPORT_DRIFT` | Failure phải giữ frame geometry của task. |
| Failure thay bằng attractive artwork không liên quan. | `APP_REIMPLEMENTATION` · `VALUE_DRIFT` | Dùng honest text hay approved factual fallback, không invent meaning. |

## MEDIA-6 — Provenance và generated-media truth

### When

Media được reuse, licensed, captured, provider supply hoặc generate. Common presentation không tự
chứng minh source selection được authorize hay chính xác.

### Apply

- Trước render, giữ source, rights/provenance, selection/generation decision, intrinsic dimension, focal point và must-preserve region cùng feature evidence.
- Với generated asset, giữ brief/forbidden claim; không bịa product UI, result, endorsement, status, authorization, brand identity hay readable pseudo-interface text.
- Chứng minh approved asset hash/reference khớp rendered source và crop/accessibility evidence thuộc cùng revision.
- Common `MediaFrame` chỉ trình bày approved outcome; family/application không trigger, evaluate hay claim generation qua nó.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Licensed illustration có rights record, intrinsic size và matching rendered source. | `PASS` | Provenance và render cùng trỏ tới một approved asset. |
| Generated art hiện fictional result “100% secure”. | `APP_OVERRIDE` · `VALUE_DRIFT` | Bỏ invented claim và regenerate từ approved truthful brief. |
| Provider logo bị approximate bằng generated pixel. | `APP_REIMPLEMENTATION` · `WRONG_OWNER` | Dùng approved provider asset và giữ identity. |
| Image nhìn đúng nhưng thiếu source/rights evidence. | `PROOF_MISSING` | Visual quality không chứng minh authorization; attach provenance trước pass. |
| `MediaFrame` presence được cite làm proof generation đã approve. | `PROOF_MISSING` | Component chỉ presentation; cung cấp feature-workflow decision evidence. |
