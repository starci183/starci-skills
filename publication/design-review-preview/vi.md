# Preview review thiết kế dùng chung

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | Định nghĩa input review chung cho layout và block. |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | Chuyển artifact đã validate cùng registry thành preview Vite dùng chung. |

## Bản ghi

Module này sở hữu lớp human rendering dùng chung cho frontend layout và block design. Một Vite application
render mọi project từ `review-manifest.json` dùng xong bỏ được; skill không tự viết HTML, CSS hay JavaScript
riêng cho từng candidate.

## Luật

Layout hoặc block JSON canonical cùng hash vẫn là authority. Manifest, Vite bundle, HeroUI documentation
chrome, shell, content đại diện,
inspectors và interactions chỉ là publication evidence có thể build lại. Chúng được phép hiển thị fact từ
registry nhưng không được thêm product decision không có trong artifact.

Renderer có hai adapter trên cùng interface:

- layout render route geometry và region click được; region modal hiện contract citation, assembler, mount
  lifetime và trạng thái block head hiện tại;
- block render mọi state đã liệt kê và part click được; part modal hiện citation, optionality và ownership evidence.

## Input

Input bắt buộc gồm `phase`, `project`, artifact batch đã validate, project design registry, visual vocabulary
đã sinh và output dưới `.worktrees/<project>/cache/preview`. Block review còn cần `layoutId` và `blockId` ổn
định. Direction batch, shell descriptor và representative-content descriptor là input tùy chọn; default trung
tính không mang claim riêng của project.

## Quy trình

Chạy adapter sau khi artifact đã validate và hash:

```bash
node scripts/render-design-review.mjs \
  --phase layout \
  --project <project> \
  --layout-id <layoutId> \
  --artifact <layout-batch.json> \
  --directions <direction-batch.json> \
  --registry .worktrees/<project>/registries \
  --vocabulary .worktrees/<project>/cache/preview/visual-vocabulary.json \
  --content <representative-content.json> \
  --shell <shell-descriptor.json> \
  --recommended-id <candidateId> \
  --out .worktrees/<project>/cache/preview/<layoutId>
```

Với block review, dùng `--phase block`, `--layout-id`, `--block-id` và block batch. Adapter resolve direction
của parent accepted từ registry; không nhận direction cạnh tranh.

Script chỉ cài runtime Vite đã pin khi dependency chưa có, build cùng một application vào cache root đã khai
báo rồi ghi `review-manifest.json`. Serve thư mục sinh ra bằng port search 8080–8099 có giới hạn do design
skill gọi sở hữu.

## Quy tắc

1. Design skill sinh JSON cùng manifest; không tạo preview markup riêng.
2. Output phải nằm dưới preview cache của project đã khai báo.
3. Project identity, shell và representative content là data input, không hard-code trong Vite app.
4. Layout modal được đọc block status nhưng không hiển thị hay quyết block anatomy.
5. Block preview hiện mọi state đã liệt kê với cùng direction, copy và representative data.
6. Candidate, direction, viewport, evidence và approval inspectors dùng chung control ở mọi project.
7. Preview interaction không mutate registry và không tính là approval.
8. HeroUI được pin theo vendor family của frontend chỉ cho modal và control mechanics; nó không phải bằng chứng product anatomy.

## Đầu ra

Một Vite bundle self-contained cùng `review-manifest.json` dưới project cache. URL mở một review application
có candidate switching, responsive viewport controls và typed inspector modals.

## Điểm dừng

- Từ chối output ngoài project preview cache.
- Từ chối block artifact có `layoutHash` không phải accepted registry head.
- Từ chối khi thiếu artifact, registry object, visual vocabulary hoặc recommended candidate.
- Từ chối khi không resolve được direction từ layout artifact hoặc accepted parent layout.

## Bằng chứng

Chạy renderer tests, Vite typecheck và build. Review hợp lệ phải mở không có console error, đổi được candidate
và viewport, mở được region hoặc part inspector mà không thay artifact hay registry.
