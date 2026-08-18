---
title: Frontend design layout · Vietnamese
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | cung cấp interaction và approval contract chung |
| `@workspaces` | `contexts/workspaces` | module | resolve và kiểm tra checkout frontend |
| `@worktrees` | `contexts/worktrees` | module | tách record bền khỏi preview dùng xong bỏ |
| `@directions` | `brainstorms/directions` | module | sinh lựa chọn thị giác được nhúng vào layout |
| `@layouts` | `brainstorms/layouts` | module | định nghĩa region, axis và contract verdict của layout |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract theo reason mà không trả class array |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | sinh kiểm kê token sống cho direction |
| `@layout-schema` | `brainstorms/layouts/schema.json` | file | validate JSON layout candidate |
| `@session` | `skills/skill-shape/session.schema.json` | file | hình dạng design session |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate artifact, session và sinh hash |

## NESTED SKILLS

Không có. Một điểm dừng kết thúc lượt chạy này. Skill không tự gọi skill khác để phục hồi.

## Cách chạy

Đọc `@skill-shape` trước. Không có orchestrator, nên skill này tự mở hoặc resume session.

**JSON mới là artifact; HTML chỉ là cách quan sát.** Approval bind vào hash của canonical JSON, không bind
vào trang render.

## QUY TRÌNH

### 1 — Lập context lock

Resolve `Phase: layout`; `Touching` chỉ gồm project registry, session và cache, không gồm frontend source.
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

### 4 — Resume hoặc mở session

Bản ghi viết theo đúng hình dạng `@session` khai, tại `registries/decisions/<surface>.json`. Nó mang một
chuỗi băm, nên ghi thêm một round là niêm phong round đó: sửa lén một round cũ thì nó thôi khớp — điều mà
một mảng round trần không bao giờ phát hiện được.

**Surface quyết định identity của session**, không phải cách viết prompt. Hai request khác lời cho cùng
page vẫn là một session; prompt viết lại chỉ mở round mới. In `resumed <id>` hoặc `opened <id>` và giữ mọi
accepted hash khi resume.

### 5 — Sinh các direction choice

Chạy `@inventory-visual-language`; dùng digest sinh ra làm `vocabularyAt`. Đọc `@directions`, sinh 3–4
direction từ request, audience, feeling, token sống, màn đã duyệt, brand, vendor guidance, closed axes và
precedent. Validate bằng `@validate-artifact` với vocabulary, không dùng `--hash`; mọi preview dùng cùng
content và reference skeleton.

### 6 — Yêu cầu owner chọn một direction

Hiện preview, evidence reuse/new, rejection và trade-off. Owner chọn exact object hoặc feedback; không sinh
`directionHash`. Ghi nguyên candidates cùng selection hoặc lời feedback vào `directionReview` của layout
round, rồi validate session bằng `@validate-artifact` và `@session`. Chưa chọn thì chưa sinh layout.

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

Nhúng cùng direction object vào mọi candidate, chỉ thay closed layout axes. Trùng axis set là một
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

Render mỗi candidate thành một trang HTML trong `cache/preview`, rồi serve:

```bash
npx -y http-server .worktrees/<project>/cache/preview -p 8080 -c-1 --silent
```

**8080 là chỗ bắt đầu tìm, không phải chỗ dừng.** Thử bind nó; bị chiếm thì thử 8081, 8082, cứ thế cho tới
khi bind được, rồi **in ra URL thật sự đang phục vụ**. Một lượt chạy chết vì dev server của người khác đang
giữ 8080 là chết ở chỗ chẳng ai hỏi tới, còn in ra một URL không ai mở được thì tệ hơn là không in. Chặn số
lần thử lại — hai mươi cổng là máy đang bận, hai trăm là có lỗi — và nếu không cổng nào bind được thì nói
ra, đừng lặng lẽ phục vụ vào hư không.


CSS preview chỉ là documentation chrome: vẽ region, tên, axis, entry và branch dưới direction đã chọn;
không vẽ block internals hay mang product class.

### 12 — Queue approval và đóng

Queue hash trong registry. Khi replacement accepted, đánh dấu layout accepted cũ là `superseded` và đặt
`supersededBy`. Feedback mở sealed round mới. Validate session bằng `@validate-artifact`. Đánh dấu một
layout có bằng chứng làm default. `OK` accept hash đó ngay; không bắt owner nhận diện lại. Chỉ đóng sau
khi mọi record và validation thuộc Layout đã hoàn tất.

## Điểm dừng

- Route không có hoặc stale → dừng; báo đúng bằng chứng route đã fail rồi kết thúc lượt chạy.
- Registry không lock, dirty hoặc thuộc Git khác → dừng; báo đúng bằng chứng ownership đã fail và không ghi.
- Visual inventory rỗng hoặc không đọc được → dừng; không suy token từ screenshot.
- Chưa chọn đúng một direction → giữ lựa chọn direction mở; chưa sinh layout.
- Class cần dùng không nằm trong closed set của contract → đây là **contract change**, trả owner.
- Hai candidate còn trùng axis set → chúng là một; sinh lại thay vì đưa ra lựa chọn giả.

Không điểm dừng nào tự gọi skill khác. Nếu owner muốn phục hồi, đó là request riêng và lượt chạy riêng.

## ĐẦU RA

Trình direction đã chọn, layout candidate, recommended default, hash và preview URL bằng văn xuôi ngắn.
Chỉ dùng `### NEED APPROVALS` cho selection hiện tại hoặc quyết định accept/feedback. Không in bảng.
