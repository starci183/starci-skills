---
title: starci-fe-design-block · Vietnamese
---

# starci-fe-design-block

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | ranh giới approval và báo cáo dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và kiểm tra route frontend |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | tách revision bền vững khỏi draft tạm |
| `@business` | `contexts/business/vi.md` | vi | resolve data, action và state reachable thật |
| `@grammar` | `grammars` | module | load product-family fact, block outcome và owner đã route |
| `@principles` | `compilers/principles` | module | audit anatomy được chọn sau sáng tạo |
| `@blocks` | `brainstorms/blocks/vi.md` | vi | luật ownership, anatomy, state và contract của block |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | review HTML trong exact parent và hợp đồng bundle bất biến |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | kiểm tra vocabulary đã bind bởi parent layout |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | tính lại block grammar decision và receipt tất định |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | chứng minh grammar package trước anatomy |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate và hash design artifact |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | kiểm tra accepted parent và block heads |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish cache review và accepted preview bundle |

## NESTED SKILLS

Không có.

## Run

Capability này thiết kế một block đã khai báo dưới exact accepted composed-page revision. Nó resolve page sở
hữu region trong page set, đưa ra ba hoặc bốn bản HTML khác biệt đáng kể trong toàn parent page, xếp hạng và tự
chọn phương án mạnh nhất, hoàn tất mọi state tất định rồi publish một revision
bất biến. Nó không ghi frontend source.

**Thẩm quyền.**

- `design.json` sở hữu `(layoutId, blockId)`, parent `layoutHash`, grammar fact/decision/receipt, data ownership,
  contract verdicts, anatomy, reachable state IDs và viewport.
- `preview.html` sở hữu composition của block và mọi state đã render trong exact accepted parent.

Draft chỉ ở cache. Accepted bundle chỉ gồm:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

Design record mang `schemaVersion`, `kind: "block"`, `layoutId`, `blockId`, parent `layoutHash`, accepted artifact,
state viewport manifest và `previewSha256`. `revisionHash` bind canonical metadata với preview digest. Revision map
và scoped block head là authority; legacy object chỉ để đọc lịch sử.

## Process

1. Đọc `@skill-shape`; kiểm tra route `fe`, registry sạch và current layout revision. `blockId` phải là exact
   region thuộc đúng một composed page và kế thừa direction/geometry của parent. Proposed layout, stale parent hay vocabulary mismatch
   phải dừng.
2. Đọc đúng business surface/flow chạm region và liệt kê mọi state reachable trước khi vẽ. `optional` không phân
   biệt pending, empty và failed. Ownership/action/outcome chưa rõ là product decision phải trả owner.
   Với block parity theo current/legacy, cũng phải inventory mọi visible direct owner trong đúng source subtree:
   path/header content, identity/persona/media, surface branch, controls cùng intrinsic/fill behavior, actions,
   overlays và local scroll. Mọi candidate giữ inventory này trừ khi feedback yêu cầu bỏ một item rõ ràng.
3. Validate cặp grammar/profile và parent grammar receipt. Đọc `@blocks`, phân loại tình huống block có bằng chứng
   thành closed fact, chạy `@resolve-grammar`, bind outcome/owner rồi resolve parts theo business reason và viết **3–4 block HTML/CSS hoàn chỉnh** trong exact parent
   `preview.html`, exact region bounds, cùng data và viewport. Candidate phải khác thật về anatomy/composition;
   model xếp hạng theo business fit, precedent, hierarchy, reuse, accessibility và boundary ownership rồi tự chọn.
4. QA cả parent page ở desktop và narrow. Mọi nested layout, sibling region và overlay ngoài block phải y nguyên
   accepted parent. Canvas chỉ có authored product UI; cấm template sinh tự động, rough
   child, part card, schema/debug label, hash hay evidence chrome.
5. Hiển thị ranking và block candidate model tự chọn. Owner có thể override nhưng không phải vận hành A/B/C/D
   gate. Chỉ mở `### NEED APPROVALS` khi product truth không resolve được; feedback mở draft round mới.
6. Render mọi state reachable của candidate đã chọn, không hỏi approval lần hai. Product decision mới
   về data owner, action hay outcome phải mở round mới thay vì đoán.
7. Validate states/viewports, tính digest/hash, ghi bundle hai file bất biến, đăng ký revision, nâng block head,
   rebuild parent review và chạy registry check. Candidate thua chỉ ở cache.

## Visual quality

1. Desktop/mobile chrome không xuất hiện đồng thời trong parent breakpoints.
2. Title, primary action, data và supporting detail có hierarchy rõ.
3. Text và repeated content có readable measure chủ ý.
4. Divider/boundary thuộc grouping mà nó phân tách và được bỏ khi không có boundary.
5. Region có đúng một scroll owner mỗi trục, trừ independent viewport có bằng chứng.
6. Mọi reachable state có authored HTML đúng viewport và giữ visual language đã chọn.

`ScrollBranch`, `SurfaceListCard` và divider là ví dụ theo tình huống, không phải wrapper bắt buộc.

## Stops

- Thiếu accepted parent, grammar/profile/receipt, block không khai báo hoặc stale parent binding → dừng.
- Data ownership, action, outcome hay state chưa rõ → trả product decision.
- Thiếu candidate HTML, exact-parent embedding, selected-state HTML hoặc viewport → không approval/publish.
- Thiếu contract/vocabulary support → dừng, không bịa component.
- Proposed/legacy object không được thành current authority ngoài acceptance.

Mọi candidate là block HTML/CSS/JS functional trong exact accepted page. Inventory condition viewport, overlay,
disclosure, async, data, permission và interaction; render mọi modal, drawer, menu/popover, expanded/collapsed,
loading, empty, error, locked và disabled state reachable. In-page native control chạy transition tất định;
review selector, static render và network behavior không được tính.

Mỗi state có business-content matrix cùng entity, fact, count, status, action, consequence và production-like
density. Generic card, toy row, filler và owned surface bị render thiếu đều bị từ chối.

## OUTPUT

Trước approval, nêu `layoutId`, `blockId`, parent `layoutHash`, 3–4 lựa chọn, recommendation và review URL. Chỉ
một approval checkpoint. Sau `OK`, nêu accepted `revisionHash` và state/viewport đã chứng minh. Không dùng bảng.
