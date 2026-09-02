# Kế hoạch bổ sung Common spacing

Trạng thái: chỉ là planning evidence. File này không phải runtime UI knowledge và không claim
capability nào được liệt kê đã implement.

## Mục tiêu

Hoàn thiện public semantic consumption của Common spacing mà không đổi scale hiện có
`0 / .25 / .5 / .75 / 1 / 1.5 / 2rem`. Các value chỉ bằng `0 / 4 / 8 / 12 / 16 / 24 / 32 CSS px`
tại computed root `16px`. Runtime proof dùng
`expectedPx = remFactor * observedRootFontPx` trong epsilon. Làm một owner quan sát được từ Common qua family đến route thật,
sau đó chỉ migrate application khi capability cần thiết đã tồn tại. Audit emit một canonical base
verdict cho mỗi layer fail cùng cause tag; `COMMON_CAPABILITY_MISSING` và `APP_WORKAROUND` là linked findings,
không phải một composite verdict.

## Bound source findings

### Spacing

- `COMMON_SPACING_SCALE` tồn tại nhưng public semantic consumption chưa đầy đủ.
- `SurfaceCopyGroup` chỉ expose `compact=.5rem` và `comfortable=.75rem` (8/12 CSS px tại root 16px);
  compact identity `.25rem` chưa có public consumable path rõ ràng.
- Scale value `2rem` (32 CSS px tại root 16px) chưa có public major-transition binding.
- Alias private `--starci-core-*` cạnh tranh với variable public `--grammar-*` và che ownership chain
  Common→family.
- Application evidence hiện có recipe Tailwind `gap-1` = `.25rem` (4 CSS px tại root 16px) và
  `gap-0.5` = `.125rem` (2 CSS px tại root 16px) lặp lại. Đây là evidence để phân tích capability,
  không phải fixed-pixel authority hay permission thêm tier/copy implementation.

### Padding

- HeroUI `Card.Root` cộng với rule `.card` global/application có thể leak outer inset `1rem` (16 CSS px
  tại root 16px) vào Grammar
  root. Common cần một neutralization boundary rõ và computed-route proof.
- Joined face cần Common capability rõ để child band sở hữu seam mà không inherit ordinary content
  inset.
- Input trailing reserve phải aware logical direction và do Input anatomy sở hữu, không patch ở route.
- Geometry `PageContainer` hiện có thể escape qua override `className`/`style` rộng; cần boundary chính
  xác giữa public placement flexibility và protected internal inset.

### Margin

- Hook renderer của `MarkdownArticle` và CSS binding bị disconnected nên rhythm dự kiến có thể không
  tới rendered output.
- Parent `gap` cộng child margin có thể nhân đôi vertical rhythm và tạo hai owner.
- `PageContainer className/style` có thể override geometry thay vì chỉ place toàn object.
- `WorkspaceShell` chứa margin `1.5rem` chưa được đặt tên (24 CSS px tại root 16px); cần semantic owner
  hoặc removal.

## Kế hoạch theo priority

### P0 — Thiết lập public ownership và computed proof

1. Mở rộng registry `COMMON_SPACING_TOKENS` và CSS hook public hiện có bằng named compact-identity
   path `.25rem`; không tạo lại registry hay expose arbitrary raw spacing.
2. Hoàn thiện và chứng minh consumable Common anatomy binding cho compact identity (`.25rem`), cùng các
   hook hiện có inline/control (`.5rem`), peer row/field (`.75rem`), block/section (`1rem`) và region
   (`1.5rem`). Mỗi binding có
   đúng một parent owner, child margin zero và không có missing-child residue.
3. Thêm isolated computed test xuyên `Common → each family → representative route`; assert exact
   computed value thay vì chỉ source token hay class string.
4. Neutralize vendor inset của Card root bên trong Common và chứng minh route/global CSS không thể
   đưa outer padding `1rem` trở lại qua reach-through `.card` hay `data-slot`.
5. Repair và test logical Input trailing reserve ở cả hai inline direction dưới một Input-anatomy
   owner; positioning offset không phải padding và phải nằm ngoài contract này.
6. Reconnect hook renderer `MarkdownArticle` với CSS binding và bỏ rhythm parent-gap cộng child-margin
   bị nhân đôi.
7. Thêm layered one-owner enforcement phát hiện duplicate owner cùng app/family delta, emit canonical
   base verdict với cause tag thay vì first-match hay composite verdict.

Dependency: freeze name và ownership của compact identity trước khi mở rộng registry hiện có;
consumable Common anatomy binding trước family binding; family binding trước route assertion.

Acceptance evidence:

- registry hiện có sau khi mở rộng cùng consumable anatomy binding author chính xác
  `.25/.5/.75/1/1.5rem`;
- computed proof bao phủ ít nhất root `16px` và `20px`: các factor đó resolve lần lượt thành
  4/8/12/16/24 và 5/10/15/20/30 CSS px trong epsilon;
- computed test pass cho Common, mọi published family và ít nhất một route thật mỗi family;
- bỏ optional child không để spacing residue;
- family paint change không đổi computed spacing;
- app CSS không reach-through Grammar anatomy để đổi metric;
- Input reserve đúng ở cả hai logical direction;
- MarkdownArticle binding tác động computed output và không còn gap+margin double owner.

### Kiến trúc gắn rule cho audit

1. Common reusable component expose các anchor ổn định `data-component`, `data-slot` và relationship.
   Anchor chỉ nhận diện anatomy đã render; không mang verdict và không lặp lại rule formula.
2. Một audit registry được generate hoặc đặt cạnh component map từng component tới target slot hay
   between-slot relationship chính xác, điều kiện chọn `when` (variant, state hoặc composition),
   expected owner anchor, một binding/version ID ổn định và một `ruleId` GAP/PADDING/MARGIN. Flat array
   rule ID ở cấp component là không đủ vì không cho biết đo cái gì và khi nào áp dụng.
3. Knowledge vẫn là owner duy nhất của metric hoặc formula. Không author thủ công array `x` hay
   `data-v8-rules` trong app JSX và không đưa chúng vào production DOM.
4. Auditor resolve registry binding từ rendered anchor, chạy metric check và ghi applied rule ID vào
   audit result. App không thể tự gắn nhãn `PASS`.
5. Build validation reject target slot bị thiếu, rule ID unknown/orphan, stale anchor và
   binding/version ID không còn khớp rendered anatomy.

Binding đầu tiên chỉ dùng owner có source hiện tại chứng minh: `PageContainer` → `PADDING-1` và
`MARGIN-2`; `SurfaceCard` → `PADDING-2`; `MarkdownArticle` → `MARGIN-3` sau khi hook được repair.
Chỉ thêm compact-identity binding sau khi Common capability đó tồn tại.

Acceptance evidence:

- mỗi binding ghi `ruleId`, target hoặc relationship chính xác, `when`, expected owner anchor và
  binding/version ID ổn định mà không copy metric của rule;
- registry và rendered anchor phải khớp; missing slot, unknown/orphan ID và stale anchor đều làm
  validation fail;
- audit output ghi resolved rule ID và measured evidence độc lập với application markup.

### P1 — Hoàn thiện role thiếu và freeze geometry boundary

1. Thêm named public major-transition binding `2rem` với selection condition khác ordinary region
   relationship `1.5rem` (32 và 24 CSS px chỉ tại root 16px).
2. Thay alias metric private `--starci-core-*` bằng semantic hook public `--grammar-*` nơi metric là
   universal; chỉ giữ family-private variable cho paint.
3. Freeze và đặt tên Common control-padding baseline, sau đó bind mà không trộn positioning offset vào
   padding.
4. Freeze và publish selection contract cho `formPageClassName` cùng CSS formula hiện có. Chọn branch
   theo đúng CSS media-query semantics, được chứng minh bằng
   `matchMedia('(min-width: 40rem)').matches`; đổi styled root font size không làm breakpoint này di
   chuyển. Sau khi chọn branch, resolve property value theo observed computed root: `1.5rem` block /
   `1rem` inline dưới breakpoint, và `2.5rem` block / `1rem` inline từ breakpoint trở lên. Thêm
   isolated computed proof; không tạo lại formula.
5. Định nghĩa và test joined-face padding cùng PageContainer extension contract cho phép whole-object
   placement/width mà không override internal inset.
6. Constrain PageContainer geometry escape và đặt tên hoặc bỏ margin `1.5rem` của WorkspaceShell.

Dependency: registry extension, consumable binding và computed harness P0; xác định exact anatomy
owner cho mỗi padding/margin finding.

Acceptance evidence:

- major transition author `2rem` và compute theo observed root chỉ dưới named condition;
- không universal metric nào phụ thuộc private family alias;
- Common control-padding baseline được freeze, đặt tên và compute độc lập;
- FormPage proof ghi `matchMedia('(min-width: 40rem)').matches` tách biệt với root font size. Kết quả
  media query chọn branch `1.5rem/1rem` hoặc `2.5rem/1rem`; root `16px` resolve các property thành
  24/16 hoặc 40/16 CSS px, còn root `20px` resolve thành 30/20 hoặc 50/20 CSS px trong epsilon. Root
  font size đổi property value, không đổi breakpoint selection;
- positioning offset không được classify hay implement như padding;
- joined face có đúng một inset/seam owner;
- public extension của PageContainer không mutate protected inset;
- PageContainer và WorkspaceShell mỗi thành phần có một measurable rhythm owner.

### P2 — Migrate consumer và tự động phát hiện regression

1. Inventory spacing usage ở StarCi, Nivo, Tayson và classify mỗi occurrence thành product placement,
   public Common consumption, reach-through override, `APP_WORKAROUND` cho missing capability hoặc
   reimplementation của capability đã có.
2. Chỉ migrate sau khi matching Common capability và family binding đều green. Giữ CSS hợp lệ cho
   page canvas, product layout/content/media và public placement.
3. Bỏ application reimplementation/reach-through rule, rồi thêm static boundary check cho protected
   Grammar slot/private metric alias mà không cấm stylesheet application thông thường.
4. Chạy computed probe cho state, viewport, optional child, zoom và translated content để chặn drift.

Dependency: hoàn tất P0 cùng capability P1 liên quan; route owner duyệt từng consumer migration.

Acceptance evidence:

- không consumer migration nào đi trước capability availability;
- không app selector nào reach vào protected Grammar anatomy hay rewrite semantic spacing;
- application-owned placement vẫn hoạt động;
- computed metric ổn định qua family, state và viewport matrix.

## Trình tự migration

1. Ghi baseline computed metric và selector ownership.
2. Publish Common semantic capability nhỏ nhất.
3. Bind mọi family mà không đổi metric.
4. Chứng minh computed output Common→family→route.
5. Migrate từng application owner và chỉ xóa rule đã được thay thế.
6. Chạy lại route, state, viewport, optional-child và accessibility evidence trước khi tiếp tục.

## Non-goals

- Không thêm arbitrary scale value hay utility escape hatch.
- Không blanket-ban application CSS.
- Không visual redesign hay đổi business behavior, route, data, copy, interaction.
- Không migrate application trước khi public Common capability tồn tại.
- Không có family-specific universal metric; family chỉ giữ paint character.
- Không claim planned work đã implement trong invariant knowledge.
