# Authored HTML design review

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | kiểm tra review graph chỉ sống trong phiên |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | render authored candidate dưới project cache |

## Record

Module này hiển thị lựa chọn layout và block nhưng không trở thành product authority. Mọi candidate, selected composition, screenshot và manifest đều là session evidence tạm thời. Skill nhận owner approval phải triển khai kết quả đã chọn vào frontend source trước khi cùng invocation kết thúc.

## Authority

Business authority, routed grammar, contract và current source ràng buộc design. Cache review pack chứng minh owner đã xem gì trong invocation nhưng không trở thành durable head hay input cho task khác.

Trong một session:

- `design.json` sở hữu task binding, business/contract ownership, grammar facts và receipt, candidate metadata, principle obligations, UI-condition inventory, transition graph và viewport obligations.
- authored HTML sở hữu composition, hierarchy, responsive behavior và executable rendering cho từng state.

Mọi material nằm dưới:

```text
.worktrees/<project>/cache/design/<session-id>/
```

Không có accepted bundle, revision map, layout head, block head hoặc design branch. Candidate digest chỉ là cache key.

## Review flow

### Layout

Hiển thị ba hoặc bốn candidate page/page-flow authored đầy đủ, dùng cùng product-backed content và viewport set. Existing source-bound node giữ nguyên giữa các lựa chọn. Rank và recommend một candidate. Sau approval, cùng skill invocation implement composition được chọn và prove trong product.

### Block

Hiển thị ba hoặc bốn block candidate khác biệt đáng kể bên trong exact current parent page và region geometry. Parent đến từ current routed source hoặc parent preview tạo trước đó trong cùng invocation. Sau approval, cùng skill invocation cập nhật frontend source sở hữu block và prove toàn trang.

## Canvas law

Product canvas chỉ chứa authored product HTML. Nó không chèn generic template, rough card, schema label, hash hoặc evidence chrome. Review control nằm ngoài canvas.

Mỗi candidate là HTML document tự chứa với deterministic in-memory behavior. Nó phủ mọi evidenced viewport, overlay, disclosure, async, data, permission và interaction condition. Condition family không liên quan được khai `not-applicable`. Product control, không phải QA-only switcher, đi tới declared transition. Cấm network access và backend mutation.

Representative content phải trung thực với business và có production-like density. Lorem, generic card, toy count, filler lặp và partial owned surface là blocking defect.

## Quality proof

Review mọi candidate và selected product result ở desktop và narrow viewport. Prove hierarchy, readable measure, boundary ownership, một scroll owner mỗi axis, breakpoint exclusivity, state coverage đầy đủ, keyboard-operable transition, clean console và không có preview network request. Sau source implementation, lặp critical interaction và viewport proof trên product thật.

Creativity đi trước principles review. Chỉ selected candidate được audit thành class-free `principleObligations`; source implementation resolve obligation qua current principles và patterns.

## Rules

1. Mọi review artifact là ignored project cache.
2. Candidate digest chỉ định danh cache entry, không trở thành durable design identity.
3. Layout/block approval và source implementation xảy ra trong cùng skill invocation.
4. Task khác phải dựng lại design evidence từ current authority; không được resume từ cache.
5. Block luôn được review trong exact current parent page và region.
6. Preview navigation không ghi state và không tính là approval.
7. Source code, test và browser proof là accepted outcome bền vững.
8. Creativity đi trước principles review; implementation theo source patterns và gates.

## Stops

- Từ chối output ngoài exact project cache.
- Từ chối khi thiếu authored candidate/state HTML, condition coverage, executable interaction hoặc viewport coverage.
- Từ chối block không có current parent page hoặc same-session parent preview.
- Task không thể tiếp tục tới source implementation có thể hiển thị design-only evidence, nhưng phải báo kết quả hết hiệu lực và không phải accepted authority.
- Post-choice state cần product truth mới phải quay lại owner approval.

## Output and proof

Publish một cache review application, nêu recommended candidate và exact source boundary, xin approval một lần, implement trong cùng invocation, rồi báo changed source paths và real-product proof. Không báo revision hash hoặc registry head.
