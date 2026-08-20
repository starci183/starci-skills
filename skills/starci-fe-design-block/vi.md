---
title: Frontend design block · Vietnamese
---

# starci-fe-design-block

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@block-schema` | `brainstorms/blocks/schema.json` | file | kiểm tra JSON mô tả anatomy của block |
| `@design-registry-schema` | `contexts/worktrees/design-registry.schema.json` | file | kiểm tra layout head và block head identity-centric |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | validate current layout/block identities mà không đọc legacy maps |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | tái tạo digest token đã bind trong layout |
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng báo cáo chung mà mọi skill đều đọc |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và kiểm tra checkout frontend |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | kiểm tra registry và preview root |
| `@business` | `contexts/business/vi.md` | vi | bind anatomy vào flow, state, contract và surface region hiện hành |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate và hash candidate artifact |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | định nghĩa Vite graph cha-con, block-detail routes và authority boundary dùng chung |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | build review app dùng chung từ block JSON đã validate thay vì HTML riêng |

## NESTED SKILLS

Không có. Skill này không tự gọi skill khác.

## Cách chạy

Đọc `@skill-shape` trước. Skill nhận `layoutId` và `blockId` ổn định do caller cung cấp; không tự chọn
identity. Accepted layout và current block head trong design registry là authority; review chỉ là audit
history.

**JSON mới là artifact; Vite review dùng chung chỉ là cách quan sát.** Approval bind vào hash của canonical
JSON, không bind vào manifest hay application đã render.

## QUY TRÌNH

### 1 — Lập context lock

`Phase` là `block`. `Touching` chỉ gọi tên project registry. Caller bắt buộc cung cấp `layoutId` và `blockId`.

### 2 — Resolve layout head accepted và block identity đã khai báo

Chạy `@design-registry-check`, rồi đọc `@design-registry-schema` và
`registries/design-registry-v2.json`; resolve `layoutHeads[layoutId].head` qua `objects.byHash` immutable. Head là
layout accepted và lookup authority duy nhất; review history không được chọn layout khác. `blockId` phải là
member chính xác trong danh sách `regions` của head accepted. BlockId tùy ý, layout head
proposed, object thiếu hoặc schema mismatch đều phải dừng trước khi design block.

Resolve direction qua layout object accepted, không nhận direction hash thứ hai từ caller. Revision block giữ
identity `(layoutId, blockId)` và parent `layoutHash` accepted; anatomy mới nhận `blockHash` immutable mới.

### 3 — Kiểm tra route và các root

Đọc `@workspaces` và kiểm tra route `fe` trước khi đọc (`WORKSPACE-5`), rồi đọc `@worktrees` để kiểm tra lock, độ sạch và owner của registry
(`WORKTREE-1`, `WORKTREE-4`). Preview phải nằm trong `cache/preview` (`WORKTREE-2`), không bao giờ nằm dưới
`.claude` (`WORKTREE-3`).

Chạy `@inventory-visual-language`; digest mới phải bằng `direction.vocabularyAt`. Khác digest thì dừng
trước khi một preview stale sinh ra quyết định block mới.

### 4 — Đọc tám input

Trước hết resolve business feature và surface hiện hành của layout đã accept. Check head với commit FE/BE
đã route; refresh và commit truth thiếu hoặc stale. Load `CONTEXT.md`, surface đã chọn và chỉ flow chạm
block này. Content, state hay action không được chứng minh vẫn là unknown.

| Input | Nội dung đọc |
|---|---|
| region | region đã accepted và lý do nghiệp vụ |
| direction | object đã chọn được resolve từ accepted layout |
| contract | key, `why`, `host`, tên children, `repeats`, `optional` — không đọc class array |
| vocabulary | leaf, composite và block đã tồn tại mà contract viện dẫn |
| axes | tập anatomy đóng: data owner, repetition, weight, composition |
| precedents | anatomy accepted của project cùng các lần bị bác |
| states | dữ liệu của region thực sự lỗi thế nào, đọc từ page và block source |
| laws | các luật block |

`optional` chỉ nói về **sự hiện diện**, không nói vắng mặt theo kiểu nào. Pending, failed và empty cùng đi
qua một `optional`; phải đọc source để phân biệt, không được đoán từ registry.

### 5 — Liệt kê state trước khi thiết kế

Liệt kê mọi trạng thái region có thể vào: populated, empty, pending, failed, partial, forbidden. Anatomy
phải bao phủ cả tập, không chỉ happy path. State reachable mà anatomy không vẽ là defect, không phải việc
để sau.

### 6 — Resolve part theo contract và vocabulary

Tìm bằng `why`. Mỗi part nhận đúng một verdict: `reuse <key>`, `generalize <key> -> <key>` kèm số call site
đã đo, hoặc `new <key>` kèm `why`. Mọi leaf và composite được viện dẫn phải có trong vocabulary; tên không
kiểm tra được là tên tự bịa.

### 7 — Sinh 3–4 anatomy

Mỗi anatomy khai giá trị các axis: ai sở hữu data, có lặp không và resting count, state nào mang block,
cách composition. Trùng toàn bộ axis nghĩa là cùng một anatomy. Ít nhất một phương án phải khác nearest
precedent.

### 8 — Từ chối quyết định chỉ owner mới được đưa ra

Ai sở hữu data, empty region có phải outcome thật không, resting count là bao nhiêu khi request không nói
— đó là product decision. Gửi refusal block cùng candidates, không tự đoán.

### 9 — Validate, hash, ghi JSON, rồi render preview

```bash
node @validate-artifact \
  --schema @block-schema \
  --data <batch.json> --hash
```

Validator từ chối class token, hai anatomy trùng axis set, anatomy `repeats` thiếu `restingCount`, hoặc
batch không có anatomy nào viện dẫn `none`. Hash chỉ phủ anatomy, không phủ envelope.

Đọc `@design-review`, ghi representative-content data tùy chọn vào project cache, rồi build một universal
review application cho anatomy batch:

```bash
node @render-design-review \
  --phase block --project <project> \
  --layout-id <layoutId> --block-id <blockId> \
  --artifact <block-batch.json> \
  --registry .worktrees/<project>/registries \
  --vocabulary .worktrees/<project>/cache/preview/visual-vocabulary.json \
  --content <representative-content.json> \
  --recommended-id <candidateId> \
  --out .worktrees/<project>/cache/preview/design-review
```

Block route riêng là `#/layouts/<layoutId>/<layoutHash>/blocks/<blockId>`. Route hiện rõ parent `layoutId`
và exact `layoutHash`, so anatomy candidates và giải thích mọi state ngay trên page, không dùng modal.
Proposed candidates chỉ hiện ở block route; layout canvas tiếp tục render child accepted hiện tại hoặc rough
content khi chưa có compatible child. Mọi anatomy dùng cùng direction, copy và representative data; đổi các
dữ kiện đó giữa candidates hoặc chỉ hiện populated state làm comparison invalid. Không tự viết HTML, CSS hay
JavaScript riêng cho candidate.

Serve thư mục đã build:

```bash
npx -y http-server .worktrees/<project>/cache/preview/design-review -p 8080 -c-1 --silent
```

**8080 là chỗ bắt đầu tìm, không phải chỗ dừng.** Thử bind nó; bị chiếm thì thử 8081, 8082, cứ thế cho tới
khi bind được, rồi **in ra URL thật sự đang phục vụ**. Một lượt chạy chết vì dev server của người khác đang
giữ 8080 là chết ở chỗ chẳng ai hỏi tới, còn in ra một URL không ai mở được thì tệ hơn là không in. Chặn số
lần thử lại — hai mươi cổng là máy đang bận, hai trăm là có lỗi — và nếu không cổng nào bind được thì nói
ra, đừng lặng lẽ phục vụ vào hư không.


Shared Vite UI và dedicated block-detail routes là documentation chrome, không phải product class hay behavior.

### 10 — Đưa vào hàng phê duyệt và ghi verdict

Queue candidate review trong audit history tùy chọn của registry. Ghi
`(layoutId, blockId)`, parent `layoutHash` accepted và `blockHash` độc lập. Khi `OK`, cập nhật
`blockHeads[layoutId/blockId].head` và region head tương ứng, giữ block head cũ làm immutable history
superseded. Feedback không đổi head. Đánh dấu candidate có bằng chứng làm default; `OK` bind hash ngay,
không hỏi lại approval. Validate design registry và artifact trước khi đóng. Sau `OK`, build lại project
graph để layout route thay rough content bằng accepted child parts; projection phải tiếp tục ghi parent
`layoutHash` rõ ràng.

### 11 — Đóng phase

Trước khi làm tiếp, nói thân thiện các region còn nợ rồi hoàn tất mọi region thuộc quyền skill. Chỉ đóng
khi `own = 0` hoặc một mục `NEED APPROVALS` thật đang chặn region.

## Điểm dừng

- Không có accepted layout head hoặc không resolve được direction → dừng.
- `blockId` không được liệt kê trong `layoutHeads[layoutId].regions` → dừng; không tạo block head mồ côi.
- Digest vocabulary không còn khớp → dừng vì visual evidence stale.
- Part viện dẫn leaf/composite không tồn tại → dừng; vocabulary là thẩm quyền.
- Không xác định được state từ source → refusal, không đoán.
- Registry không lock, dirty hoặc thuộc Git khác → dừng, không ghi.

## ĐẦU RA

Theo output văn xuôi của skill shape; nêu `layoutId`, `blockId`, parent `layoutHash` và block head mới. Không in bảng trạng thái.
