---
title: Review thiết kế bằng HTML được viết thật
---

# Review thiết kế bằng HTML được viết thật

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | validate cache review graph |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish draft review và accepted bundle bất biến |

## Bản ghi

Module này chỉ hiển thị lựa chọn layout/block, không tự thiết kế. Draft review là cache có thể build lại;
accepted composition là HTML bền vững bind vào một revision bất biến.

## Thẩm quyền

JSON và HTML cùng có thẩm quyền nhưng sở hữu hai việc khác nhau:

- `design.json` sở hữu identity, parent binding, business/contract ownership, grammar fact/decision/receipt đã route, accepted artifact,
  `principleObligations` sau sáng tạo, business-content matrix theo state, UI-condition inventory, transition graph và state viewport manifest.
- `preview.html` sở hữu composition, hierarchy, surfaces, responsive behavior và executable authored rendering
  của mọi state đã khai báo.

Một accepted revision có đúng hai file:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

`design.json` mang `schemaVersion`, `kind`, `layoutId`, `blockId`/`layoutHash` khi có, accepted artifact, state
viewport manifest và `previewSha256`. `revisionHash` bind canonical design metadata cộng preview digest. Registry
ghi revisions và trỏ stable heads tới chúng. Legacy object chỉ đọc để tương thích, không phải authority cho
approval/execute mới.

Candidate chưa accepted và review manifest chỉ ở `.worktrees/<project>/cache`. Candidate thua không được copy vào
registry.

## Luồng review

### Layout

Hiển thị các page set HTML/CSS độc lập, hoàn chỉnh, cùng product-backed content và viewport. Review từ ảnh chụp
compose mọi nested layout, page và overlay đang nhìn thấy; review flow gồm mọi page/step được nêu rõ. Node
`existing` bind source/hash và giống hệt giữa các phương án. Hiển thị 3–4 phương án khác biệt đáng kể, ranking
của model và recommendation model tự chọn. Owner có thể override nhưng không phải vận hành candidate gate. Sau
lựa chọn đó, các state tất định của layout đã chọn được
render mà không hỏi approval lần hai; chỉ product decision mới phát hiện mới mở round mới.

### Block

Hiển thị ba hoặc bốn block khác biệt đáng kể trong exact accepted parent `preview.html`, đúng region geometry và
cùng representative data, kèm ranking và recommendation model tự chọn. Parent luôn nhìn thấy để đánh giá
composition trong ngữ cảnh. Owner có thể override nhưng không phải chọn; state tất
định của block đã chọn được render tiếp mà không approval lần hai.

## Luật canvas

Product canvas chỉ hiển thị authored product HTML. Nó không suy composition từ JSON và không chèn generic
template, rough child, anatomy/part card nét đứt, placeholder skeleton, schema/debug label, evidence hay hash.
Review navigation, candidate names, evidence và help nằm ngoài canvas.

Thiếu candidate HTML, exact-parent embedding, accepted state HTML hay declared viewport là lỗi chặn. Warning của
viewer hoặc fallback tự sinh không thể làm review đủ điều kiện approval.

### Luật canvas functional

Mọi candidate và accepted preview là một tài liệu HTML self-contained với behavior in-memory tất định. Nó expose
product control cho mọi transition đã khai báo và đại diện mọi UI condition có evidence: desktop/mobile, modal,
drawer, menu/popover, expanded/collapsed, loading, empty, partial, error, success, locked và disabled. Condition
family không liên quan phải khai `not-applicable` cùng evidence. Resize viewport thật phải điều khiển responsive;
một narrow state được vẽ riêng chưa đủ. QA state switcher nằm ngoài canvas và không tính là interaction proof.
Preview cấm `fetch`, XHR, WebSocket và backend mutation.

Mọi state còn phải bám business: render production-like representative density, đúng entity kind, value, count,
status, metadata, action và consequence từ business surface đã bind. Canvas phải tự giải thích được sản phẩm mà
không dựa vào evidence text bên ngoài. Lorem, placeholder, generic card, toy row count, filler lặp và owned
surface bị render thiếu đều là lỗi chặn.

## Bằng chứng chất lượng

QA mọi candidate và accepted state ở desktop cùng ít nhất một narrow viewport:

1. Desktop/mobile navigation hoặc chrome loại trừ nhau tại breakpoint.
2. Heading, primary action, data và supporting content có hierarchy chủ ý.
3. Reading/repeated content có measure chủ ý.
4. Mỗi divider/boundary thuộc region hoặc grouping mà nó phân tách; không có boundary thì không bắt buộc divider.
5. Mỗi trục scroll có đúng một owner; nested scrolling cần independent viewport có evidence.
6. Mọi reachable state trong manifest có authored HTML đúng viewport.
7. Mọi value trong condition inventory map tới rendered state và mọi transition reachable từ in-page control
   visible, keyboard-operable.
8. Browser proof chạy critical transition graph ở desktop và narrow, gồm mọi modal, drawer, popover/menu cùng
   nhánh async/error reachable, console sạch và không có network request.
9. Mỗi state khớp business-content matrix đủ để entity, status, action và consequence hiểu được bằng thị giác ở
   production-like density.

`ScrollBranch`, `SurfaceListCard` và divider là ví dụ theo tình huống, không phải yêu cầu chung của preview hay
product.

Model tạo và rank 3–4 candidate trước principles review. Chỉ candidate được chọn mới được audit qua principles;
mọi resolution được lưu class-free với target, principle module, canonical situation và reason. Accepted
revision thiếu obligations này là invalid.

## Quy tắc

1. Draft chỉ ở project cache; accepted bundle chỉ dưới `registries/revisions`.
2. Layout và block mỗi phase có một recommendation do model tự chọn; chỉ cần owner approval khi product truth
   hoặc write authority còn chưa resolve.
3. Block review bind exact `layoutId`, parent `layoutHash` và declared `blockId`.
4. Block luôn được review trong exact parent layout và region bounds.
5. Accepted selected states là deterministic completion, không phải approval checkpoint thứ hai.
6. Preview navigation không mutate registry và không tính là approval.
7. Mọi accepted `preview.html` digest và `revisionHash` phải validate lại trước execute.
8. Layout schema 4 bind `scope`, `pages` đã compose, ownership nodes có thứ tự và regions thuộc page.
9. Sáng tạo đi trước principles review; execute resolve accepted obligations trước source patterns.

## Điểm dừng

- Từ chối draft output ngoài project cache hoặc accepted output ngoài exact revision bundle.
- Từ chối thiếu authored candidate/state HTML, condition coverage, executable interaction hoặc viewport coverage.
- Từ chối render-only page hay page có state chỉ reachable qua review chrome.
- Từ chối block bind parent hash khác hoặc không nằm trong parent regions.
- Proposed/legacy-only object không được hiển thị như current accepted authority.
- State sau lựa chọn cần route, owner, action hay outcome mới phải quay lại product approval.

## Đầu ra và proof

Publish một cache review application cho draft và một bundle hai file cho accepted revision. Chạy manifest
validation, preview digest/revision validation, Vite typecheck/build và browser QA cho mọi viewport/state với
console sạch.
