# Review thiết kế cha-con dùng chung

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | Định nghĩa project graph dùng chung cho layout canvas và block-detail routes. |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | Chuyển registry heads cùng review batch tùy chọn thành Vite application dùng chung. |

## Bản ghi

Module render một Vite review application cho mỗi project. Manifest là graph cha-con: một
`layoutId/layoutHash` chính xác sở hữu regions đã khai báo, và mỗi region resolve một child scoped
`(layoutId, layoutHash, blockId)` với block candidate được hash độc lập.

## Luật

Layout/block JSON canonical và registry heads vẫn là authority. Vite bundle, graph manifest, HeroUI controls
và content đại diện chỉ là publication evidence có thể build lại.

Layout route render toàn page với content trong mọi region. Child missing hoặc stale dùng impressionistic brief
đã hash của layout candidate để render wireframe rough có label, đủ hình dung purpose và đánh giá geometry,
density cùng reading order; nó không được
ngụ ý fields, actions, states, block parts hay copy cuối. Child accepted
có `layoutHash` đã ghi khớp parent đang hiển thị được render parts accepted chính xác hơn.

Mọi brief là manifest data bám business truth và phải render đủ items đã khai báo. Application không cắt brief,
không thay bằng generic skeleton lines và không tự bịa product values. Region chỉ hiểu được nhờ documentation
label không phải prototype hợp lệ.

Click region navigate sang block-detail route riêng, không mở modal. Block route nêu exact parent layout
version và luôn mở ba tabs: `Layout brief`, `Block candidates`, `Evidence`. `Layout brief` là tab mặc định,
render prototype của parent region khi block missing hoặc stale. Anatomy/state controls chỉ xuất hiện sau khi
candidates tồn tại. Khi block accepted, registry head thay đổi; build lại graph sẽ thay rough content trên layout
route bằng child accepted.

## Input

Input bắt buộc gồm project, registry, visual vocabulary và output dưới
`.worktrees/<project>/cache/preview`. `--all-current` render mọi accepted layout cùng compatible child head.
Layout hoặc block review được overlay một artifact batch đã validate; block overlay còn bắt buộc stable
`layoutId`, `blockId` và parent `layoutHash` accepted.

Shell và representative-content descriptor tùy chọn là project data, không phải application rule hard-code.

## Quy trình

Build current project graph:

```bash
node scripts/render-design-review.mjs \
  --all-current --project <project> \
  --registry .worktrees/<project>/registries \
  --vocabulary .worktrees/<project>/cache/preview/visual-vocabulary.json \
  --out .worktrees/<project>/cache/preview/design-review
```

Trong layout review, thêm `--phase layout --layout-id <layoutId> --artifact <batch.json>`,
`--directions <batch.json>` và `--recommended-id <candidateId>`. Trong block review, dùng
`--phase block --layout-id <layoutId> --block-id <blockId> --artifact <batch.json>`.

Với review nhiều layout đầu tiên trong cùng một graph, dùng `--layout-draft-index <index.json>`. Index có
mảng `layouts` không rỗng; mỗi entry khai báo `layoutId`, `artifact`, `directions` tùy chọn, `content` tùy
chọn, `shell` tùy chọn và `recommendedId`; đường dẫn entry tính tương đối từ index. `flows` tùy chọn chứa
các node có thứ tự tham chiếu layout và block region đã khai báo nếu có. Renderer resolve route review bất
biến cùng edge kề. Tất cả layout đề xuất dùng chung một manifest mà chưa cần accepted head.

Application dùng hash routes:

```text
#/layouts/<layoutId>/<layoutHash>
#/layouts/<layoutId>/<layoutHash>/blocks/<blockId>
```

Region layout schema 3 mang `placement`, `width`, `height`, `align` và impressionistic child brief đã hash. Preview
tuân theo bounding và render content đại diện có label trong wireframe rõ là rough kể cả khi child còn thiếu; không dàn phẳng thành stack chung hay thay form,
navigation hoặc flow đã khai báo bằng skeleton. Fallback schema 1–2 chỉ tồn tại cho lịch sử accepted bất biến.

Script chỉ cài Vite/HeroUI dependencies đã pin khi còn thiếu, build một lần vào project cache rồi ghi một
`review-manifest.json`.

## Quy tắc

1. Một project có một review application và một graph manifest, không có một HTML page cho từng candidate.
2. Mọi block record mang `layoutId`, exact parent `layoutHash` và `blockId`.
3. Child chỉ render trên layout canvas khi block head bind đúng layout hash đang hiển thị.
4. Child missing/stale render content thô; child accepted render accepted parts.
5. Click layout region navigate sang block-detail route; cấm publication modal.
6. Block detail hiện mọi state với cùng direction, copy và representative data.
7. Proposed block candidate hiện ở block route nhưng không thay accepted layout content trước approval.
8. Layout hash mới làm child bind hash cũ thành stale.
9. HeroUI chỉ là documentation chrome, không phải product anatomy evidence.
10. Preview navigation không mutate registry hay tính là approval.
11. Render đủ mọi brief item đã khai báo; cấm arbitrary item cap và placeholder-only region.
12. Block route missing/stale mặc định mở `Layout brief`; anatomy/state controls chưa được hiện trước block round.

## Đầu ra

Một Vite bundle self-contained cùng schema-2 graph manifest dưới project cache. Default route mở layout
canvas; mọi region đã khai báo link tới block-detail page bind đúng version.

## Điểm dừng

- Từ chối output ngoài project preview cache.
- Từ chối block artifact có `layoutHash` không phải accepted registry head.
- Từ chối blockId không nằm trong regions của parent accepted.
- Từ chối khi thiếu registry object, vocabulary, layout hoặc recommended candidate.
- Child head bind layout hash khác chỉ hiện stale, không bao giờ render như accepted.

## Bằng chứng

Chạy graph-adapter tests, manifest validation, Vite typecheck/build và browser QA. Browser proof phải thấy
rough block missing/stale, accepted block chính xác, navigation layout → block detail, parent hash nhìn thấy,
tab `Layout brief` mặc định với representative content đầy đủ, candidate/state controls chỉ khi có dữ liệu,
state switching và back navigation không có console error. Check mọi candidate ở desktop và một narrow viewport.
