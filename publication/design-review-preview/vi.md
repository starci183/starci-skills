# Authored HTML design review

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | kiểm tra review graph chỉ sống trong phiên |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | ghi static HTML preview dưới project cache, không build app |
| `@baseline-schema` | `brainstorms/composition/schema.json` | file | bind reference bốn lock và owner tree |
| `@visual-proof-schema` | `publication/design-review-preview/visual-proof.schema.json` | file | prove same-viewport parity và delivery completion |

## Record

Module này ghi static `index.html` cùng một raw HTML file cho mỗi candidate/state. Không còn React/Vite review app, dependency install hay viewer build. Mọi output vẫn là session evidence tạm thời.

## Authority

Business authority, legacy/current baseline, MASTER, routed grammar, contract và current source ràng buộc design theo thứ tự đó. Page override chỉ chứa deviation. Cache review pack chứng minh owner đã xem gì nhưng không trở thành authority.

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

Default `generate` hiển thị một complete long page hoặc full flow start-to-end chứa mọi block, page/step, state và transition cần cho implementation. Chỉ explicit `brainstorm` mới hiển thị ba hoặc bốn targeted alternative trên reviewed baseline đó.

### Block

Default `audit` hiển thị một Layout-generated block trong complete parent page và trả pass hoặc exact correction. Chỉ explicit block `brainstorm` mới hiển thị ba hoặc bốn anatomy trong cùng parent geometry.

## Canvas law

Product canvas chỉ chứa authored product HTML. Nó không chèn generic template, rough card, schema label, hash hoặc evidence chrome. Review control nằm ngoài canvas.

Mỗi candidate là HTML document tự chứa với deterministic in-memory behavior. Nó phủ mọi evidenced viewport, overlay, disclosure, async, data, permission và interaction condition. Condition family không liên quan được khai `not-applicable`. Product control, không phải QA-only switcher, đi tới declared transition. Cấm network access và backend mutation.

Representative content phải trung thực với business và có production-like density. Lorem, generic card, toy count, filler lặp và partial owned surface là blocking defect.

## Quality proof

Review mọi candidate và result ở exact baseline viewport/state. Prove full viewport, target region và preserved region; computed CSS chỉ support, không thay comparison này. `visual-proof.json` phải ghi zero known defect và đạt requested delivery state.

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
9. MASTER dùng chung cho mọi candidate; page file chỉ ghi deviation và principles chỉ inspect delta.
10. Generate/audit mode có đúng một result; 3–4 alternative cần explicit brainstorm mode và reviewed baseline.

## Stops

- Từ chối output ngoài exact project cache.
- Từ chối khi thiếu authored candidate/state HTML, condition coverage, executable interaction hoặc viewport coverage.
- Từ chối block không có current parent page hoặc same-session parent preview.
- Task không thể tiếp tục tới source implementation có thể hiển thị design-only evidence, nhưng phải báo kết quả hết hiệu lực và không phải accepted authority.
- Post-choice state cần product truth mới phải quay lại owner approval.

## Output and proof

Ghi một static cache `index.html` cùng raw candidate/state files, nêu result và exact source boundary, xin approval một lần, implement trong cùng invocation, rồi báo changed source paths và real-product proof.
