---
title: starci-fe-design-layout · Vietnamese
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | ranh giới approval và báo cáo dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và kiểm tra route frontend |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | tách revision bền vững khỏi draft tạm |
| `@business` | `contexts/business/vi.md` | vi | bind trang vào product truth hiện hành |
| `@grammar` | `compilers/grammars` | module | resolve product-family fact được route rõ thành outcome và owner |
| `@principles` | `compilers/principles` | module | review quyết định thị giác sau sáng tạo |
| `@directions` | `brainstorms/directions/vi.md` | vi | chọn direction có bằng chứng để nhúng vào layout |
| `@layouts` | `brainstorms/layouts/vi.md` | vi | region, axis, ownership và contract verdict của layout |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | review HTML được viết thật và hợp đồng bundle bất biến |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract theo lý do mà không lộ class |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | emit grammar decision tất định và context gọn đã chọn |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | chứng minh grammar package trước khi tạo candidate |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | bind lựa chọn vào vocabulary frontend hiện hành |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate và hash design artifact |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | kiểm tra head và accepted revision hiện hành |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish cache review và accepted preview bundle |

## NESTED SKILLS

Không có.

## Run

Capability này thiết kế hoặc sửa một tập page đã compose dưới một `layoutId` ổn định. Một ảnh chụp nghĩa là
toàn bộ page nhìn thấy: mọi nested layout, routed page, state hiện tại, modal/drawer/panel/floating action đang
hiện, geometry, divider và scroll owner. Một flow được mô tả nghĩa là mọi page/step được nêu rõ trong flow đó.
Nó nhận đúng một lựa chọn, hoàn tất state tất định rồi publish một accepted revision bất biến; không ghi frontend
source.

**Thẩm quyền.**

- `design.json` sở hữu identity, ownership nghiệp vụ/contract, grammar fact/decision/receipt, regions, accepted artifact, state IDs và viewport.
- `preview.html` sở hữu composition, hierarchy, surfaces, responsive behavior và HTML của mọi state.

Draft chỉ sống dưới `.worktrees/<project>/cache`. Khi accepted, chỉ ghi:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

`design.json` mang `schemaVersion`, `kind: "layout"`, `layoutId`, accepted artifact, state viewport manifest và
`previewSha256`. `revisionHash` bind canonical design metadata với exact preview digest. Revision map và stable
layout head trong registry là authority. Legacy object chỉ được đọc để tương thích lịch sử.

Direction không có approval riêng; recommendation có bằng chứng được nhúng vào mọi candidate, nên một lựa chọn
layout chấp thuận cả direction lẫn composition.

## Process

1. Đọc `@skill-shape`; resolve `layoutId`, kiểm tra route `fe`, registry sạch/đúng owner, business surface và
   visual vocabulary hiện hành. Trước khi vẽ, lập pattern sheet từ route tree thật: root/app/feature layouts,
   routed pages, overlays và regions theo thứ tự lồng. Gắn mỗi node là `existing`, `proposed` hoặc `new`;
   `existing` phải có source + source hash và được tái dùng nguyên trạng trong mọi phương án.
2. Validate cặp grammar/profile được route khai rõ. Đọc `@directions` và `@layouts`, phân loại chỉ tình huống có
   bằng chứng thành closed fact rồi chạy `@resolve-grammar`. Outcome/owner emit ra là semantic constraint bắt buộc;
   thiếu fact hoặc owner `new-required` thì trả decision. Chọn một direction recommendation có bằng chứng, resolve region theo lý do
   nghiệp vụ rồi viết **3–4 page-set HTML/CSS độc lập và hoàn chỉnh** với cùng content và viewport. Xếp hạng theo
   business fit, precedent, hierarchy, reuse, accessibility và boundary ownership rồi tự chọn phương án mạnh
   nhất. Candidate phải khác thật ở
   composition, navigation, secondary region hoặc density; đổi màu đơn thuần là trùng.
3. JSON không mang class. Mỗi region có verdict `reuse`, `generalize` đã đo hoặc `new`. Quyết định route,
   mounting hay ownership chưa đủ bằng chứng phải trả về owner, không tự bịa.
4. QA mọi candidate ở desktop và ít nhất một narrow viewport. Canvas chỉ chứa UI sản phẩm được viết thật; cấm
   template chung, rough child, anatomy card nét đứt, placeholder skeleton, schema/debug label, hash hay evidence.
5. Hiển thị ranking và candidate model tự chọn. Owner có thể override nhưng không phải vận hành A/B/C/D gate.
   Chỉ mở `### NEED APPROVALS` khi product truth hoặc write authority không resolve được. Feedback mở draft round
   mới, không sửa revision accepted.
6. Sau `OK`, render mọi state tất định mà layout thực sự có. Responsive/collapsed state chỉ có khi reachable.
   Không hỏi approval lần hai. Nếu state cần quyết định mới về route, owner, action hay outcome, mở một product
   decision round mới thay vì đoán.
7. Validate base và mọi state/viewport, tính digest/hash, ghi bundle hai file bất biến, đăng ký revision, nâng
   layout head, build lại review graph và chạy registry check. Candidate thua chỉ ở cache.

## Visual quality

Mọi candidate và state accepted phải chứng minh:

1. Navigation desktop/mobile không xuất hiện đồng thời ở breakpoint.
2. Heading, primary action và supporting content có hierarchy rõ.
3. Nội dung đọc có measure chủ ý và dễ đọc.
4. Divider/boundary thuộc đúng region phân tách nhóm; không có semantic boundary thì không bắt buộc divider.
5. Mỗi trục scroll có đúng một owner; nested scroll cần independent viewport có bằng chứng.
6. Mọi state reachable trong `design.json` có authored HTML đúng viewport.

`ScrollBranch`, `SurfaceListCard` và divider chỉ là ví dụ về contract resolution, không phải luật áp dụng cho mọi
layout.

## Stops

- Route, business truth, vocabulary hoặc registry ownership thiếu/stale → dừng kèm evidence chính xác.
- Thiếu stable identity, candidate trùng axis hoặc content tự bịa → từ chối draft.
- Thiếu candidate/state HTML hay viewport coverage → không approval/publish.
- State sau lựa chọn cần product decision mới → trả quyết định đó; không hỏi lại deterministic work.
- Proposed/legacy object không được đóng vai current authority.

Mọi candidate phải là page HTML/CSS/JS functional, self-contained, không phải static render. Trước khi vẽ phải
inventory condition viewport, overlay, disclosure, async, data, permission và interaction. Phải render
desktop/mobile, modal, drawer, menu/popover, expanded/collapsed, loading, empty, partial, error, success, locked
và disabled khi business/source evidence cho thấy reachable; family không liên quan phải ghi `not-applicable`
cùng evidence. Product control—not review chrome—phải chạy transition in-memory tất định; cấm network và backend
mutation. Resize thật phải điều khiển responsive behavior.

Mỗi page/state còn có business-content matrix và render production-like representative density: đúng entity
kind, value có nghĩa, count, status, metadata, action và consequence. Lorem, placeholder copy, generic card, toy
row, filler lặp, title-only shell và owned surface bị render thiếu đều là lỗi chặn. Thiếu condition coverage,
executable transition hoặc business fidelity thì không được chọn/publish.

## OUTPUT

Trước approval, nêu `layoutId`, scope `page`/`flow`, số lựa chọn thích ứng, recommendation và review URL bằng văn xuôi ngắn. Chỉ một approval
checkpoint. Sau `OK`, nêu accepted `revisionHash`, grammar receipt, state/viewport đã persist và region còn cần block design.
Không dùng bảng trạng thái.
