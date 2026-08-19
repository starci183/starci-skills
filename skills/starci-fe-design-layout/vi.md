---
title: Frontend design layout · Vietnamese
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | cung cấp interaction và approval contract chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và kiểm tra checkout frontend |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | tách record bền khỏi preview dùng xong bỏ |
| `@directions` | `brainstorms/directions/vi.md` | vi | sinh lựa chọn thị giác được nhúng vào layout |
| `@layouts` | `brainstorms/layouts/vi.md` | vi | định nghĩa region, axis và contract verdict của layout |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract theo reason mà không trả class array |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | sinh kiểm kê token sống cho direction |
| `@layout-schema` | `brainstorms/layouts/schema.json` | file | validate JSON layout candidate |
| `@design-registry-schema` | `contexts/worktrees/design-registry.schema.json` | file | kiểm tra registry identity-centric và các current head |
| `@design-registry-migrate` | `scripts/migrate-design-registry.mjs` | script | migrate legacy maps không phá huỷ và verify identity heads current |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | validate v2 heads, regions, immutable objects và by-id projections |
| `@session` | `skills/skill-shape/session.schema.json` | file | hình dạng audit history tùy chọn; không phải lookup authority |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate artifact, session và sinh hash |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | định nghĩa manifest, interaction và authority boundary của Vite review dùng chung |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | build review app dùng chung từ layout JSON đã validate thay vì HTML riêng |

## NESTED SKILLS

Không có. Một điểm dừng kết thúc lượt chạy này. Skill không tự gọi skill khác để phục hồi.

## Cách chạy

Đọc `@skill-shape` trước. Skill này nhận `layoutId` ổn định và sở hữu page skeleton; session chỉ là audit
history tùy chọn.

**JSON mới là artifact; Vite review dùng chung chỉ là cách quan sát.** Approval bind vào hash của canonical
JSON, không bind vào manifest hay application đã render. `registries/design-registry-v2.json` là authority: `layoutHeads[layoutId].head` trỏ tới layout object
immutable đã accepted; session hoặc review không bao giờ quyết định lookup hiện tại.

## QUY TRÌNH

### 1 — Lập context lock

Resolve `Phase: layout`; `Touching` chỉ gồm project registry, audit record tùy chọn và cache, không gồm frontend source.
Nói vị trí đó bằng một câu thân thiện; không in context thành bảng.

### 2 — Resolve và kiểm tra workspace route

Đọc `@workspaces` và resolve role `fe`. Trước khi đọc source, kiểm tra checkout tồn
tại và `context.contract` vẫn là file thật. Route stale phải **dừng lượt chạy** (`WORKSPACE-5`); không chọn
checkout gần nhất rồi tiếp tục với contract của sản phẩm khác.

### 3 — Resolve worktree roots

Đọc `@worktrees`. Registry ở `<Source>/.worktrees/<project>/registries` phải lock, sạch, đúng project branch và thuộc Git
của Source này (`WORKTREE-1`, `WORKTREE-4`). Preview nằm tại
`<Source>/.worktrees/<project>/cache/preview` (`WORKTREE-2`), không bao giờ dưới `.claude`
(`WORKTREE-3`).

### 4 — Resolve identity layout ổn định và current head

Nếu v2 chưa có, chạy `@design-registry-migrate --apply`; sau đó chạy `@design-registry-check`, đọc `@design-registry-schema` và
`registries/design-registry-v2.json`. Bắt buộc caller cung cấp `layoutId` ổn định; không suy ra
identity từ prompt, surface label hay session id. Resolve `layoutHeads[layoutId]`, rồi resolve `head` qua
map `objects.byHash` immutable nếu head đã tồn tại. Head là layout accepted và là kết quả lookup hiện tại
duy nhất. Identity thiếu hoặc schema mismatch thì dừng; thiếu head là identity mới, không phải quyền coi
candidate proposed là accepted.

Nếu layout chưa có accepted head, chỉ tiếp tục theo creation path được schema registry cho phép; không tự
đặt head từ candidate proposed. Session hoặc review cũ có thể đọc làm ngữ cảnh và ghi audit history, nhưng
không được chọn, thay hoặc hồi sinh head. Giữ mọi accepted hash trong immutable object và chỉ cập nhật head
tại approval checkpoint.

### 5 — Sinh các direction choice

Chạy `@inventory-visual-language`; dùng digest sinh ra làm `vocabularyAt`. Đọc `@directions`, sinh 3–4
direction từ request, audience, feeling, token sống, màn đã duyệt, brand, vendor guidance, closed axes và
precedent. Validate bằng `@validate-artifact` với vocabulary, không dùng `--hash`; mọi preview dùng cùng
content và reference skeleton.

### 6 — Chọn direction đề xuất bằng evidence

So mọi direction hợp lệ với request, audience, feeling, vocabulary sống, brand evidence và precedent đã
chấp nhận. Chọn đúng một object làm đề xuất dựa trên evidence và nói rõ vì sao nó phù hợp nhất. Đây là
default tạm thời, không phải approval của owner, nên không dừng, không in `### NEED APPROVALS` và không
sinh `directionHash` ở đây.

Ghi direction batch với `schema: 2` cùng object `recommended`. Trong `directionReview` của layout round,
ghi nguyên candidates, `state: recommended`, `recommendedId`, `selectionSource: evidence` và
`selectionReason`, rồi validate cả hai artifact. Nếu evidence không đủ chọn một đề xuất, trả product
decision còn thiếu dưới dạng refusal; chưa sinh layout.

### 7 — Đọc structural input

Đọc `@layouts`: request nguyên văn; contract query từng need qua `@contract-search`; branch, route,
persistent layout, closed axes và accepted precedent. Layout chỉ quyết region, geometry ownership, lifetime
và route relationship; không quyết block internals.

### 8 — Resolve từng region theo contract

```bash
node @contract-search <project> <role> --need "<the region stated as a need>"
```

Hỏi bằng **lý do**, không hỏi bằng shape. Kết quả có dấu `~` chỉ khớp từ ngẫu nhiên, không phải câu trả
lời. Mỗi region nhận đúng một verdict:

- `reuse <key>` — `why` hiện có đã trả lời region;
- `generalize <key> -> <key>` — entry đúng nghĩa nhưng mang tên feature; phải đo call-site count trước;
- `new <key>` — không entry nào trả lời reason; ghi `why` entry mới sẽ mang.

Không có call-site count thì từ chối `generalize`, không đoán.

Query không có kết quả exit 1 và cho hai dữ kiện: với lượt này là verdict `new`; với tree là finding rằng
một surface thật không tìm được entry theo need. Đưa nguyên need vào `WARNINGS` để chỉ đúng reason đã fail.

### 9 — Sinh 3–4 layout skeleton

Nhúng cùng direction object được đề xuất vào mọi candidate, chỉ thay closed layout axes. Trùng axis set là một
candidate; ít nhất một phải rời nearest precedent. Chỉ trả một khi thật sự chỉ có một skeleton hợp lệ.

### 10 — Từ chối product decision bằng chứng không giải được

Product decision mà request không nói và luật không suy ra được phải tạo refusal block. Refusal đi cùng
candidates để phần còn lại của batch vẫn đọc được.

### 11 — Validate, hash và render skeleton

```bash
node @validate-artifact \
  --schema @layout-schema \
  --data <batch.json> --vocabulary <visual-vocabulary.json> --hash
```

Schema dùng `additionalProperties: false` để class trở thành unrepresentable. Validator còn từ chối class
token, candidate trùng axis set và batch không candidate nào viện dẫn `none`. Hash chỉ phủ candidate,
không phủ envelope; cùng quyết định phải sinh cùng hash ở round sau.

Đọc `@design-review`. Ghi shell descriptor và representative-content descriptor tùy chọn vào project cache,
rồi build một universal review application cho cả batch:

```bash
node @render-design-review \
  --phase layout --project <project> --layout-id <layoutId> \
  --artifact <layout-batch.json> --directions <direction-batch.json> \
  --registry .worktrees/<project>/registries \
  --vocabulary .worktrees/<project>/cache/preview/visual-vocabulary.json \
  --content <representative-content.json> --shell <shell-descriptor.json> \
  --recommended-id <candidateId> \
  --out .worktrees/<project>/cache/preview/<layoutId>
```

Renderer dùng chung sở hữu candidate, direction và viewport switching. Nó luôn khoanh mọi layout-owned
region, ghi entry citation, assembler và mount lifetime; click region mở typed inspector modal cùng trạng
thái block head hiện tại. Content đại diện và imagery có evidence làm reading order và density nhìn thấy
được, nhưng manifest không được chốt block parts, states, data ownership hay final copy. Canvas rỗng hoặc
layout không có region overlay là invalid.

Không tự viết HTML, CSS hay JavaScript riêng cho candidate. Project shell và content là manifest data;
Vite application trung lập với project và interaction của nó không mutate registry. Serve thư mục đã build:

```bash
npx -y http-server .worktrees/<project>/cache/preview/<layoutId> -p 8080 -c-1 --silent
```

**8080 là chỗ bắt đầu tìm, không phải chỗ dừng.** Thử bind nó; bị chiếm thì thử 8081, 8082, cứ thế cho tới
khi bind được, rồi **in ra URL thật sự đang phục vụ**. Một lượt chạy chết vì dev server của người khác đang
giữ 8080 là chết ở chỗ chẳng ai hỏi tới, còn in ra một URL không ai mở được thì tệ hơn là không in. Chặn số
lần thử lại — hai mươi cổng là máy đang bận, hai trăm là có lỗi — và nếu không cổng nào bind được thì nói
ra, đừng lặng lẽ phục vụ vào hư không.


Dashed overlay và inspector modals là documentation chrome; chúng giúp prototype đọc được như một page thật
nhưng không biến thành block anatomy hay mang product class.

### 12 — Queue approval và đóng

Trình các direction cùng lý do đề xuất một direction bên cạnh các layout đã nhúng direction đó. Mở đúng
một `### NEED APPROVALS` cho round này: layout hash được đề xuất là default, và `OK` duyệt đồng thời
direction được nhúng với skeleton. Feedback có thể phản biện direction hoặc structure và mở audit review tùy chọn.

Khi `OK`, validate immutable object rồi cập nhật `layoutHeads[layoutId].head` thành `layoutHash` accepted
(cùng danh sách region ID ổn định đã khai báo) trong design registry. Khi replacement accepted, giữ head cũ trong audit history
với trạng thái superseded và trỏ sang replacement; không sửa object cũ. Session/review chỉ ghi lời owner,
không phải lookup authority. Validate registry và artifact, đánh dấu layout có bằng chứng làm default, rồi
chỉ đóng sau khi mọi write thuộc Layout hoàn tất.

## Điểm dừng

- Route không có hoặc stale → dừng; báo đúng bằng chứng route đã fail rồi kết thúc lượt chạy.
- Registry không lock, dirty hoặc thuộc Git khác → dừng; báo đúng bằng chứng ownership đã fail và không ghi.
- Visual inventory rỗng hoặc không đọc được → dừng; không suy token từ screenshot.
- Chưa có direction recommendation dựa trên evidence → trả quyết định còn thiếu; chưa sinh layout.
- Class cần dùng không nằm trong closed set của contract → đây là **contract change**, trả owner.
- Hai candidate còn trùng axis set → chúng là một; sinh lại thay vì đưa ra lựa chọn giả.
- `layoutId` ổn định thiếu, mơ hồ hoặc trỏ tới registry head malformed → dừng; không fallback về session hay prompt.
- Hash proposed không phải registry head → dừng; chỉ approval checkpoint được advance accepted head.

Không điểm dừng nào tự gọi skill khác. Nếu owner muốn phục hồi, đó là request riêng và lượt chạy riêng.

## ĐẦU RA

Trình `layoutId`, accepted head hiện tại/sau cập nhật, direction, recommendation dựa trên evidence, layout
candidate, layout hash mặc định và preview URL bằng văn xuôi ngắn. Chỉ dùng một `### NEED APPROVALS` cho
quyết định kết hợp accept/feedback. Không in bảng.
