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

- `design.json` sở hữu task binding, journey/business/component synthesis, grammar facts và receipt, candidate metadata, page contract, UI-condition inventory và viewport obligations. States-stage design còn sở hữu complete `renderContract` cùng canonical `executionPrompt`.
- authored HTML sở hữu composition, hierarchy, responsive behavior và executable in-memory behavior cho từng declared state; state-review capture là một bounded representative sample.

Schema 7 page review chỉ bind canonical `pageContract`. Nó phủ complete page anatomy, representative state,
state inventory và reference viewport nhưng không có write authority. Sau `OK #1`, state review giữ page hash
đó và thêm `renderContract`, phủ mọi page/region/state/transition cùng exact source files,
owner/component/contract, anatomy, data mapping và visual obligation. `renders` chọn tối đa năm cặp page/state
đại diện trên toàn flow và phủ mọi reference viewport cho mỗi state đã chọn. Canonical prompt lặp identities cùng
boundary, bắt exact implementation và cấm reinterpretation. Chỉ `OK #2` biến exact contract đó thành
implementation authority.
Transition evidence gọi tên page/state ở cả hai endpoint, gồm cross-page navigation. Representative preview
content được đánh dấu fixture-only; runtime value vẫn do source sở hữu.

Mọi material nằm dưới:

```text
.worktrees/<project>/cache/design/<session-id>/
```

Không có accepted bundle, revision map, layout head, block head hoặc design branch. Candidate digest chỉ là cache key.

## Review flow

### Layout

Layout publish hai review có nhãn. `pages` hiển thị một complete long page hoặc full flow ở một representative
populated state mỗi page và mọi reference viewport. Nó prove customer journey, business obligation, component
anatomy, hierarchy và density trước states. `OK #1` chỉ tác động cache. `states` sau đó giữ mọi declared
condition executable mà không đổi approved page contract, chỉ hiển thị tối đa năm state đại diện được chọn theo
risk và transition coverage, rồi disclose exact source files cho `OK #2`. Chỉ explicit
page-stage `brainstorm` mới hiển thị ba hoặc bốn targeted alternative.

### Block

Default `audit` hiển thị một Layout-generated block trong complete parent page và trả pass hoặc exact correction. Chỉ explicit block `brainstorm` mới hiển thị ba hoặc bốn anatomy trong cùng parent geometry.

## Canvas law

Product canvas chỉ chứa authored product HTML. Nó không chèn generic template, rough card, schema label, hash hoặc evidence chrome. Review control nằm ngoài canvas.

Mỗi candidate là HTML document tự chứa với deterministic in-memory behavior. Nó phủ mọi evidenced viewport, overlay, disclosure, async, data, permission và interaction condition. Condition family không liên quan được khai `not-applicable`. Product control, không phải QA-only switcher, đi tới declared transition. Cấm network access và backend mutation.

Representative content phải trung thực với business và có production-like density. Lorem, generic card, toy count, filler lặp và partial owned surface là blocking defect.

## Quality proof

Trước mỗi layout approval, schema 2 maturity evidence bind page contract (`reviewStage: pages`) hoặc bounded
selected pairs của render contract (`reviewStage: states`) vào real full-viewport capture và zero defect. Sau
implementation, review mọi selected preview/source pair ở exact baseline viewport/state. `visual-proof.json`
schema 2 bind selected candidate
và render-contract identities, ghi distinct real preview/source capture paths cho từng cặp, bắt parity cùng
`mismatches: []` tường minh, zero known defect và requested delivery state. Computed CSS chỉ support, không thay
những capture này.

Creativity đi trước principles review. Chỉ selected candidate được audit thành class-free `principleObligations`; source implementation resolve obligation qua current principles và patterns.

## Rules

1. Mọi review artifact là ignored project cache.
2. Candidate digest chỉ định danh cache entry, không trở thành durable design identity.
3. Layout dùng cache-only page approval rồi state/source approval; block dùng displayed source approval. Implementation vẫn ở cùng invocation.
4. Task khác phải dựng lại design evidence từ current authority; không được resume từ cache.
5. Block luôn được review trong exact current parent page và region.
6. Preview navigation không ghi state và không tính là approval.
7. Source code, test và browser proof là accepted outcome bền vững.
8. Creativity đi trước principles review; implementation theo source patterns và gates.
9. MASTER dùng chung cho mọi candidate; page file chỉ ghi deviation và principles chỉ inspect delta.
10. Generate/audit mode có đúng một result; 3–4 alternative cần explicit page-stage brainstorm mode và reviewed baseline.
11. Page-stage review không bao giờ chứa render contract hay execution prompt; state-stage review giữ exact approved page hash.

## Stops

- Từ chối output ngoài exact project cache.
- Từ chối page review thiếu journey/business/component synthesis, representative full-page HTML, maturity evidence hoặc viewport coverage.
- Từ chối state review thiếu condition coverage, executable interaction, exact source files hoặc approved page contract không còn nguyên.
- Từ chối block không có current parent page hoặc same-session parent preview.
- Task không thể tiếp tục tới source implementation có thể hiển thị design-only evidence, nhưng phải báo kết quả hết hiệu lực và không phải accepted authority.
- Post-choice state cần product truth mới phải quay lại owner approval.

## Output and proof

Ghi một static review có nhãn cho complete pages và nhận cache-only `OK #1`. Bung states dưới page hash không đổi, ghi labeled state review, disclose exact files và nhận `OK #2`. Implement trong cùng invocation rồi báo changed source paths cùng real-product proof.
