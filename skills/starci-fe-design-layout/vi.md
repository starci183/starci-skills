---
name: starci-fe-design-layout
description: Thiết kế, duyệt theo giai đoạn, implement, seed và prove một long page hoặc end-to-end flow mature bằng cách tổng hợp customer journey và business truth với năng lực component, contract và source. Duyệt page anatomy trước, bung states sau, rồi duyệt exact source-and-seed boundary, code, seed real local product và prove.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | staged approval và reporting boundary |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | frontend route đã verify |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | ignored session cache |
| `@composition` | `brainstorms/composition/vi.md` | vi | Scope, Owner, Invariant và Proof |
| `@business` | `contexts/business/vi.md` | vi | routed business truth |
| `@grammar` | `grammars` | module | product-family facts và owners |
| `@principles` | `compilers/principles` | module | audit visual decision |
| `@patterns-fe` | `compilers/patterns/fe` | module | source ownership |
| `@lints-fe` | `gates/fe/lints` | module | source proof |
| `@layouts` | `brainstorms/layouts/vi.md` | vi | schema 7 synthesis và staged contracts |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | staged HTML review |
| `@contract-search` | `scripts/contract-search.mjs` | script | component contract evidence |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | routed grammar decisions |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | grammar proof |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | refuse drift |
| `@validate-layout-grammar` | `scripts/validate-layout-grammar.mjs` | script | exact semantic owner của child target |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | current visual vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate page/state boundary |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | composition proof |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | principle proof |
| `@maturity-schema` | `publication/design-review-preview/maturity.schema.json` | file | staged maturity evidence |
| `@validate-maturity` | `scripts/validate-design-maturity.mjs` | script | mature-page refusal gate |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | cache review publisher |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | final parity proof |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | source-write authority |

## NESTED SKILLS

Không có. Layout sở hữu design đến implementation và QA.

## Run

Xác nhận một scope `page` hoặc `flow` có start và terminal rõ ràng. Resolve routed frontend, business head, grammar, MASTER, contracts và current source. Tạo một ignored design session và validate four-lock composition baseline.

### 1. Map page trước khi vẽ

Liệt kê mọi page trong scope trước cả hai design track. Mỗi page ghi id, route, actor, entry, customer intent,
decision, successful outcome, failure consequence và closed render intents mà page bắt buộc phải thể hiện.
Flow phải có start, mọi decision page và terminal page trước khi vẽ region.

### 2. Resolve từ hai hướng độc lập

Từ trên xuống, viết customer actors, entry, goal, successful outcome và ordered steps. Mỗi step gọi tên intent, decision, action, consequence và page của nó. Bind toàn bộ business rule, operation, entitlement, data owner và failure consequence vào routed truth.

Từ dưới lên theo contract-first, inspect complete composition, component, contract, data mapping, responsive
behavior, exact source owner và nested visual owner từ legacy/current mà không uốn track theo journey region
đã đề xuất. Phân loại mọi region là `reuse`, `generalize` hoặc `new-required`. Thiếu capability không bao giờ
là lý do làm yếu customer journey.

Chỉ sau khi cả hai track hoàn tất mới merge bằng page-level binding matrix. Mỗi render intent bind journey
steps, business obligations và contract-backed regions; mỗi region phải cite render intent nó phục vụ. Intent,
step, capability hoặc region nào không bind đều stop run. Chỉ binding matrix được phép sinh page anatomy.

### 3. Pages stage — complete anatomy trước states

Emit schema 7 `stage: pages`. Default `generate` tạo một complete mature long page hoặc flow với một representative populated state cho mỗi page, ở desktop và narrow viewport. Phải có full chrome, meaningful content, intentional hierarchy và density, mọi major region và complete block anatomy. Tạo complete future state inventory ngay lúc này nhưng chưa render các state đó.

Page contract bind synthesis, route, region, representative state, hierarchy, density, responsive behavior, visual precedent, state inventory và representative full-viewport render. `renderContract` và `executionPrompt` bị cấm.

Validate artifact và schema 2 maturity review với `reviewStage: pages`. Refuse wireframe, sparse scaffold, generic admin template, dead space không có lý do, control không có anchor, type rank yếu và anatomy chưa hoàn tất.

Publish review nhãn `pages` và disclose `OK #1: PAGE ANATOMY`, candidate, canonical page-contract hash và routes. Approval này chỉ tác động cache: nó freeze page anatomy và mở state expansion; tuyệt đối không cấp quyền ghi source. Ba hoặc bốn page alternative chỉ được tạo sau explicit brainstorm request khi owner đã xem baseline.

### 4. States stage — bung trong page đã duyệt

Sau `OK #1`, emit schema 7 `stage: states`, `mode: expand-states` và approved page hash. Giữ canonical page contract chính xác. Expand mọi loading, empty, ready, error, permission, disabled, unavailable, success và overlay condition trong contract cùng executable in-memory behavior. Thêm transition và source-owned data mapping. Phân loại mỗi condition tại đúng owner: page state chỉ tồn tại khi region arrangement, hierarchy hoặc active page-level composition thay đổi; condition chỉ đổi một subtree vẫn là block state dù evidence chụp cả page quanh nó. Chọn tối đa năm complete-page render target trên toàn flow; mỗi target bind page state nếu có cùng các seeded block state nhìn thấy trong capture, rồi render target ở mọi reference viewport. Exact render contract vẫn giữ complete implementation inventory còn `renders` chỉ là bounded evidence sample này; sau đó tạo canonical execution prompt.

Trước khi compose complete render region, phân rã nó thành closed child target. Ghi một dòng `grammarScopes` cho mỗi target với observable facts và đúng quyết định slot/outcome/component từ routed grammar. Region compose các owner đó và không được thay list, accordion, form hay body surface đã resolve bằng generic card. Chạy `@validate-layout-grammar` trước source approval.

Trước `OK #2`, in source-owner matrix cho từng stateful region: state owner, exact drawing `ComponentBase`, optional connected `Component`, compositor kind cùng exact `PageBase`/`LayoutBase`/`OverlayBase`, connected outer entry, và parent render child nào. Block state bắt buộc có child drawing owner riêng. Nhét state hoặc data của nó dưới props của Page, Layout hay Overlay trong khi outer surface vẫn sở hữu render không phải extraction. Chỉ thêm nested Block chain cho subtree stateful độc lập, không tạo tầng giả. Source boundary phải chứa mọi exact child và outer-surface file trong chain.

Với mỗi selected render target, trước `OK #2` phải in thêm seed-owner row: exact development/test identity, page state và block states cần có, product-native seed owner, exact seed files hoặc existing command, idempotency key, local dependencies và cleanup/safe-repeat behavior. Seed file mới thuộc approved source boundary. Cache fixture không thể hoàn thành contract này.

Validate artifact, layout grammar và schema 2 maturity review với `reviewStage: states`. State không fit approved page anatomy sẽ làm page approval mất hiệu lực. Feedback chỉ đổi cách thể hiện state thì giữ page approval.

Publish review nhãn `states` và disclose `OK #2: STATES + SOURCE BOUNDARY`, page hash không đổi, render contract và exact files. Chỉ approval này mới cấp quyền ghi source.

### 5. Code approved source

Sau `OK #2`, lấy target baseline và implement canonical prompt mà không reinterpret. Condition do block sở hữu phải được real `ComponentBase`/connected `Component` render; `PageBase`, `LayoutBase` hoặc `OverlayBase` compose child đó và không được proxy state hay request data. Chạy canonical lint/tests cho complete state/transition contract.

### 6. Seed real local product

Trước browser proof, materialize mọi selected render target qua approved product-native seed owner. Ưu tiên existing idempotent bootstrap seeder hoặc explicit development/test seed command; chỉ thêm seed source khi exact files của nó đã được duyệt. Seed graph deterministic nhỏ nhất mà real connected page cần, scope vào test identity đã khai, đánh dấu là development/test data và để mọi lần chạy hội tụ mà không tạo duplicate.

Phase này được phép start declared local dependencies cùng real frontend/backend. Nó không được đòi VPS, mutate production data, gọi undeclared external provider hoặc thay backend-owned truth bằng client mock, component props, static HTML hay cache fixture. Prove kết quả qua chính read path của product và ghi command, identity, stable identifiers cùng observed rows/states. Seed thiếu hoặc fail sẽ stop visual proof; repair trong approved boundary hoặc quay lại `OK #2` nếu cần file mới.

### 7. Prove real-product parity

Chạy browser proof cho mọi selected render target, tối đa năm complete-page target. Final proof cần capture từ real connected product với cùng page state, seeded block states và viewport, kèm seed evidence, `parity: passed`, `mismatches: []` và terminal delivery. Repair defect trong boundary mà không cần approval thứ ba.

## Rules

1. Một invocation sở hữu synthesis, hai approval, implementation, deterministic local seeding và QA.
2. Journey/business định nghĩa cái phải tồn tại; component/contract evidence ràng buộc cách build.
3. Một complete result là default; alternative cần explicit brainstorm.
4. `OK #1` chỉ tác động cache; chỉ `OK #2` authorize exact source files.
5. Page drift quay lại page approval; state-only rejection giữ approval đó.
6. Review artifact là disposable cache; source và executable proof là durable.
7. MASTER được chọn một lần và execution không được reinterpret approved preview.
8. Ordered multi-stage progress dùng connected stepper anatomy.
9. Cache fixture không bao giờ thay product-native seed data trong final proof.
10. Mọi render child ở states stage resolve qua một grammar scope; exact component owner của nó là execution authority.

## Stops

- Thiếu route, scope, business authority, grammar/profile, contract, source baseline hoặc flow endpoint.
- Journey step không có page ownership hoặc component capability.
- Fabricated content, incomplete state inventory, immature page evidence hoặc non-functional HTML.
- Dùng `OK #1` như source authority, hoặc `OK #2` không có exact files.
- Giấu page-contract drift hoặc required work nằm ngoài approved boundary.
- Thiếu seed ownership, selected state không seed được, seed không idempotent hoặc final proof chỉ tồn tại trong cache/component mock.

## OUTPUT

Ở page review, báo journey/business/component synthesis, page URL, maturity verdict và cache-only `OK #1`. Ở state review, báo state coverage, page hash không đổi, exact source files, seed-owner rows và `OK #2`. Sau code, báo changed files, tests, seed command/identity/observed data và real-product parity.
