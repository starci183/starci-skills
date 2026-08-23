---
title: StarCi frontend design request resolver
---

# starci-fe-design-resolve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | shared approval, progress và reporting boundary |
| `@orchestration` | `orchestration/vi.md` | vi | coordinate authority, source và proof không split decision |
| `@requests` | `requests/vi.md` | vi | chọn và đóng durable feedback record |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve project và FE role |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | resolve durable authority/product write roots |
| `@business` | `contexts/business/vi.md` | vi | preserve hoặc block rõ ràng trên product truth |
| `@grammar` | `grammars` | module | sở hữu product-family outcome, meaning, owner và behavior |
| `@principles` | `compilers/principles` | module | sở hữu reusable product-neutral visual situation |
| `@patterns-fe` | `compilers/patterns/fe` | module | bind correction vào exact FE owner |
| `@frontend-quality` | `brainstorms/frontend-quality/vi.md` | vi | challenge unresolved UI direction khi cần |
| `@classify-fe-change` | `scripts/classify-frontend-change.mjs` | script | chọn proportional execution depth |
| `@validate-request` | `scripts/validate-design-request.mjs` | script | validate request transition và closure |
| `@compile-context` | `scripts/compile-context.mjs` | script | rebuild runtime context sau authority change |
| `@check-deps` | `scripts/check-deps.mjs` | script | prove authority dependency graphs |
| `@lints-fe` | `gates/fe/lints` | module | prove implemented frontend source |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | enforce same-state, same-viewport proof khi visual |

## NESTED SKILLS

Không có.

## IMPACT ROUTING

Chạy frontend classifier cho từng request đã chọn. Exact specified correction dùng `micro`; một component dùng
`component`; page/flow anatomy dùng `page`; reusable/cross-surface change dùng `capability`/`cross-domain`. Chỉ
batch request có expected outcome, authority target tương thích và source boundary không xung đột.

Explicit owner ruling đủ để evolve routed product grammar cho product đó. Chỉ evolve principle khi situation
product-neutral và có reusable evidence. Mỗi resolved request phải để lại durable executable regression trong
grammar/principle được route, kể cả khi law cũ đúng và lỗi nằm ở source application/enforcement.

## PIPELINE

Topology: `reconciliation` từ queued owner feedback qua authority và product evidence.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| select | shared | explicit ids hoặc mọi `open` request | validate, order, deduplicate và lock compatible batch | immutable request batch và impact classification | không conflicting outcome/foreign dirt |
| audit-source | reconciliation | request evidence, routed business truth và source-first correction | reproduce outcome, accept attempt hoặc chuẩn bị reject/replacement, rồi classify durable lesson | source verdict, proposed reject refs, impact cone và authority disposition | audit chưa đè source; business change accepted/blocked |
| source-authority-boundary | decision | source verdict, grammar, principles và unresolved UI/flow choice | chỉ review direction nơi decision còn mở, rồi publish exact reject/source/authority/proof batch | approved immutable write batch | manual approval hoặc bound `mode=auto`; không widen scope |
| correct-source | execution | approved source verdict và replacement | nếu sai, append reject row trước, đè source, update chính request và prove replacement | final source attempt, reject refs và source proof | rejected evidence tồn tại trước replacement; expected outcome observable |
| encode-authority | execution | approved lesson và correct source evidence | update grammar/principle record và executable regression nhỏ nhất, compile/check deps | authority receipts bind final source | authority diễn đạt accepted outcome không false generalization |
| prove-close | proof | final source, evolved authority và selected requests | rerun targeted gates/real-product proof, update chính requests rồi close | passing proof và `resolved` records | mọi request có authority/final source/proof/reject refs; zero known defect |

## Approval modes

`manual` là mặc định. Exact `mode=auto` bind approval vào immutable request set/write boundary đã hiển thị. Nó
không được thêm request, authority root, product repo, credential, external publication, package release, push hay
deploy. Các action đó vẫn cần authority trong request của user.

## Run

Đọc shared shape, requests và orchestration, resolve `defaultLang`, rồi chọn explicit request ids. Nếu invocation
nói xử lý queue mà không nêu id, chọn mọi `open` request theo `(createdOn, id)` và split incompatible batch.

Reproduce exact state và audit source-first attempt đã ghi trong request. Nếu sai, chuẩn bị một reject row và
replacement trong displayed write boundary. Sau approval, append immutable row đó vào `requests/rejects.json` trước
khi đè source, thêm reject id vào chính request và prove replacement. Không tạo request thứ hai cho cùng expected
outcome. Classify durable lesson thành business-authority gap, grammar ruling/gap, principle gap, pattern-or-gate
gap, source application miss hoặc drift.

UI feedback có expected outcome hoàn toàn rõ không cần alternative direction. Với design/flow choice còn mở, hiển
thị một complete functional direction mặc định; chỉ hiển thị 3–4 khi owner yêu cầu brainstorm rõ ràng. User-flow
change chỉ reorder/làm rõ outcome và transition hiện có khi routed business truth support; actor, operation,
entitlement, route hoặc backend capability mới sẽ block request chờ business authority.

Sau khi final source attempt đúng, update English/Vietnamese authority record và executable case từ evidence đó,
compile runtime context và chạy dependency/authority gates. Rerun real connected product ở state/viewport phủ risk
để authority không làm hỏng source result. Chỉ sau đó giữ implementation `applied`, proof `passed`, ghi
resolution/reject refs và mark request `resolved`.

## Rules

1. Chỉ process valid record dưới `.claude/requests`; không resolve feedback từ memory.
2. Source được sửa trước authority learning; mỗi resolved request cite ít nhất một final product source path và đổi ít nhất một routed grammar/principle path.
3. Grammar sở hữu product-specific meaning/behavior; principles sở hữu reusable product-neutral visual situation.
4. Owner feedback quyết định expected product outcome nhưng vẫn là evidence, không phải diagnosis tự động.
5. Không bịa business truth, backend capability, route, state hay data operation.
6. Wrong source attempt được ghi vào `requests/rejects.json` trước khi đè; chính request nhận reject ref.
7. Micro correction giữ micro khi anatomy/ownership cố định; authority regression không ép full layout ceremony.
8. Conflicting outcome cần owner reconcile trước implementation.
9. Giữ unrelated dirty file và dùng exact write boundary.
10. Closure cần authority compilation, targeted source gates, real-product proof và valid request/reject records.
11. Push, publish, release, deploy và provider change chỉ chạy khi được authorize rõ.

## Stops

- Selected request invalid, đã do active resolution khác sở hữu hoặc conflict batch.
- Thiếu required business truth/backend capability.
- Không resolve được authority target hoặc principle generalization thiếu reusable evidence.
- Không thể giữ failed source attempt trong rejects table trước replacement.
- Không thể attribute/preserve pre-existing target change an toàn.
- Thiếu credential, approval hoặc real-product state bắt buộc.
- Còn known defect hoặc closure thiếu authority/source/proof refs.

## OUTPUT

Report selected request ids, per-request verdict, grammar/principle changes, affected product owners, tests và real
product proof, final status và blocked requests. Phân biệt authority gap với application/enforcement miss.
