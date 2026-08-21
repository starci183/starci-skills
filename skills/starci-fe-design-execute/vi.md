---
title: starci-fe-design-execute · Vietnamese
---

# starci-fe-design-execute

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | ranh giới write approval và báo cáo dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và kiểm tra frontend checkout |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | kiểm tra accepted revision authority |
| `@business` | `contexts/business/vi.md` | vi | chứng minh behavior accepted còn khớp product truth |
| `@grammar` | `grammars` | module | load product-family fact/outcome/owner đã accept để verify |
| `@principles` | `compilers/principles` | module | resolve accepted principle obligations |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | hợp đồng accepted bundle và screenshot parity |
| `@patterns-fe` | `compilers/patterns/fe` | module | resolve product files, exports và boundary trước write |
| `@lints-fe` | `gates/fe/lints` | module | chứng minh source ở canonical frontend gate |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | kiểm tra token đã bind bởi accepted layout |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | so receipt hiện hành với design authority đã accept |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | chứng minh capsule, case, template trước khi ghi source |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | tính lại fact đã accept và từ chối receipt, locked-token hay preview palette drift |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | resolve và validate current revision heads |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | kiểm tra accepted metadata và preview digest |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove authority trước source write |

## NESTED SKILLS

Không có.

## Run

Capability này implement một accepted frontend composed page hoặc page flow và có quyền ghi product source. Exact path phải được nêu
trong một `Touching` approval, rồi lấy clean baseline trước write đầu tiên.

Current layout head và mọi declared block head phải resolve tới:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

`design.json` sở hữu identity, ownership, grammar fact/decision/receipt, contract/anatomy và state viewport manifest. `preview.html` sở hữu
composition. Phải kiểm tra `previewSha256` và tính lại `revisionHash` từ canonical metadata cộng preview digest.
Registry revision heads là implementation authority; legacy objects chỉ là lịch sử đọc được.

Validate route grammar/profile rõ ràng rồi tính lại mọi accepted receipt từ fact. Chỉ capsule, template và
principle concern đã chọn được vào implementation context; hash drift phải quay lại design.

## Process

1. Chạy registry check; resolve mọi page và nested ownership node có thứ tự trong current layout revision, rồi
   mọi declared block revision theo page sở hữu. Bắt buộc exact parent
   `layoutHash`, accepted artifacts, preview digest hợp lệ và state viewport manifest đầy đủ.
2. Kiểm tra routed frontend, business heads và vocabulary. Nếu behavior hiện hành đổi route, data owner, action
   hay reachable state, quay lại design thay vì implement authority stale.
3. Đọc source và `@patterns-fe`, nêu smallest exact frontend path boundary dưới `### NEED APPROVALS`. `OK` chỉ
   authorize các path đó. Lấy clean baseline trước first write; unrelated dirty work phải dừng.
4. Tái dùng mọi node `existing` đã bind source, không nhân bản hay redesign. Implement accepted page-set
   composition, giữ hierarchy, readable measure, surface/boundary ownership, breakpoint
   exclusivity, selected treatment, icon meaning và đúng một scroll owner mỗi trục. Ưu tiên contract owner hiện có.
   Preview CSS là evidence, không phải code để copy mù; token/pattern source vẫn là luật implementation.
5. Implement mọi viewport/state pair trong từng `design.json`. Divider, `ScrollBranch` hay `SurfaceListCard` chỉ
   bắt buộc khi accepted situation dùng nó; ví dụ không trở thành luật kiến trúc chung.
6. Chạy canonical lint/tests và chụp product ở exact accepted viewport/state. So breakpoint chrome, hierarchy,
   measure, region/surface bounds, divider ownership, scroll ownership và state treatment. Lint xanh nhưng visual
   drift vẫn fail và phải sửa trong `Touching`.
7. Đóng với applied revision heads, baseline, exact changed paths và proof chạy được. Path hay product decision
   mới phải trả owner; deterministic repair không tạo approval checkpoint mới.

## Stops

- Revision thiếu/proposed/legacy-only, grammar/profile/receipt drift, digest sai, state thiếu hoặc stale parent → dừng và gọi identity.
- Business behavior/vocabulary stale → quay lại design.
- Target tree dirty hoặc cần path ngoài `Touching` → dừng.
- Contract class/pattern không biểu diễn được → trả contract decision, không xấp xỉ.
- Không sửa được lint/visual parity trong boundary → trả boundary, không suppress gate.

Implementation phải tái tạo accepted condition inventory, business-content matrix và transition graph. Browser
proof phải tới mọi accepted state qua product control, resize cùng một page qua breakpoint và exercise mọi modal,
drawer, menu/popover, expanded/collapsed, loading, empty, error, locked và disabled condition reachable.
Render-only implementation hay screenshot-only parity đều fail.

## OUTPUT

Nêu `layoutId`, applied layout/block revision hashes, grammar receipt, baseline, material paths và code/visual proof bằng văn xuôi
ngắn. Chỉ authority decision mới được nằm dưới `### NEED APPROVALS`. Không dùng bảng trạng thái.
