---
name: starci-fe-design-layout
description: Thiết kế, duyệt theo giai đoạn, implement, seed và browser-prove một long page hoặc end-to-end flow mature. Flow có xác thực phải để Playwright tự nhập test credentials qua UI đăng nhập thật trước khi protected-page parity được pass. Mặc định một direction; 3–4 chỉ khi owner explicit brainstorm.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | staged approval và reporting boundary |
| `@orchestration` | `orchestration/vi.md` | vi | phase map coordinator/worker cho decision, HTML, source và proof |
| `@classify-fe-change` | `scripts/classify-frontend-change.mjs` | script | từ chối ceremony lớn hơn frontend impact đã đo |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | frontend route đã verify |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | disposable session evidence bị ignore |
| `@composition` | `brainstorms/composition/vi.md` | vi | Scope, Owner, Invariant và Proof |
| `@business` | `contexts/business/vi.md` | vi | routed business truth |
| `@grammar` | `grammars` | module | product-family facts và owners |
| `@principles` | `compilers/principles` | module | audit visual decision |
| `@patterns-fe` | `compilers/patterns/fe` | module | source ownership |
| `@lints-fe` | `gates/fe/lints` | module | source proof |
| `@layouts` | `brainstorms/layouts/vi.md` | vi | schema 9 synthesis, capability proof và staged contracts |
| `@frontend-quality` | `brainstorms/frontend-quality/vi.md` | vi | integrated review craft, UX, accessibility, engineering và detector trước HTML |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | staged HTML review |
| `@contract-search` | `scripts/contract-search.mjs` | script | component contract evidence |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | routed grammar decisions |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | grammar proof |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | refuse drift |
| `@validate-layout-grammar` | `scripts/validate-layout-grammar.mjs` | script | exact semantic owner của child target |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | current visual vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate schema 9 page/state và quality-review |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | composition proof |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | principle proof |
| `@maturity-schema` | `publication/design-review-preview/maturity.schema.json` | file | staged maturity evidence |
| `@validate-maturity` | `scripts/validate-design-maturity.mjs` | script | mature-page refusal gate |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | cache review publisher |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | final parity proof |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | source-write authority |

## NESTED SKILLS

Không có. Layout sở hữu design đến implementation và QA.

## Routing theo impact

Phân loại trước. Layout chỉ nhận page, capability và cross-domain; micro sửa trực tiếp, component dùng Block. Source capability/cross-domain cần blind read-only reviewer và challenge được close bằng evidence.

## PIPELINE

Topology: `dual-track` tới khi tổng hợp page, sau đó `linear` qua implementation và proof. Một owner top-down
biệt lập chỉ nhận normalized evidence cùng business authority; một owner bottom-up biệt lập chỉ nhận scope,
source, contract và current capability evidence. Hai bên không thấy draft của nhau. Một coordinator chỉ join
output đã pass gate, sở hữu decision/shared artifact và chỉ delegate source write đã duyệt, tách rời.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| evidence | shared | request, authority, baseline | chuẩn hóa fact, constraint, example và unknown | evidence pack cùng context envelope | đủ provenance và scope |
| orchestration | coordination | immutable evidence envelope và measured runtime | áp dụng Layout dependency graph cùng one-writer registry | runtime adapter, task batch, coordinator reservation và sequential fallback | không approval; mọi task bounded |
| page-synthesis | join | evidence, business head, source, contract, data, grammar và MASTER | chạy journey và capability subphase biệt lập, in direction, join, chạy integrated quality review rồi author complete desktop/narrow anatomy | page map, capability evidence, binding matrix, direction receipt, quality review và schema 9 page contract | cả hai origin cùng required lens/detector pass, không còn item chưa bind, rồi `OK #1`; chỉ cache |
| states | execution | approved direction-quality-page hash và state truth | bung state, owner, transition, seed và boundary không review drift | schema 9 render contract cùng canonical prompt | `OK #2`; exact files đầy đủ |
| implementation | execution | approved prompt | code, gate và seed không reinterpret | implementation, gate và seed receipts | mọi obligation tới product evidence |
| parity | proof | preview và seeded product | phân loại authentication, chạy login bắt buộc qua product UI rồi tính PNG, DOM, axe và Playwright evidence | `visual-proof.json` schema 4 | proof có auth tự nhập credentials trên browser, không session shortcut; parity và delivery pass |

## Approval modes

`manual` là mặc định. Exact `mode=auto` trong invocation bind auto approval với immutable envelope. Khi từng normal
gate pass, coordinator chọn evidence-backed recommendation, ghi auto receipt bind boundary cho `OK #1` và `OK #2`,
rồi đi tiếp không dừng chờ. Cả hai review cùng exact boundary vẫn phải render. Thiếu default, gate đỏ, credential,
destructive/external action hoặc boundary expansion vẫn dừng. Auto hết hiệu lực cùng invocation.

## Run

Đọc `@skill-shape` và `@orchestration`. Xác nhận một scope `page` hoặc `flow` có start và terminal rõ ràng. Resolve routed frontend, business head, grammar, MASTER, contracts và current source. Tạo ignored design session, validate composition baseline rồi lập orchestration plan nội bộ, không in record trừ khi `debug=true`. Coordinator sở hữu journey/UI decision, integrated quality verdict và approval. Worker có thể inventory lens/detector evidence, chỉ sinh HTML từ eligible frozen contract, chỉ implement path tách rời sau source approval, rồi seed, test và capture proof.

User-facing execution table hiển thị các section 1–3 dưới đây như một bước `page-synthesis`. Page mapping, hai
track biệt lập, direction declaration, phần join và desktop/narrow rendering là internal subphase; không được chen
một `OK` trung gian. Direction không phải mode riêng. Approval kế tiếp là `OK #1` cho complete page anatomy và
hai direction đã in cùng integrated quality review.

### 1. Map page trước khi vẽ

Liệt kê mọi page trong scope trước cả hai design track. Mỗi page ghi id, route, actor, entry, customer intent,
decision, successful outcome, failure consequence và closed render intents mà page bắt buộc phải thể hiện.
Flow phải có start, mọi decision page và terminal page trước khi vẽ region.

### 2. Resolve và in journey direction cùng UI direction

Khi có delegation, chạy hai track bằng hai context owner biệt lập; nếu không có thì chạy tuần tự nhưng vẫn giữ context firewall và artifact tách riêng tới bước join. Từ trên xuống, viết customer actors, entry, goal, successful outcome và ordered steps. Mỗi step gọi tên intent, decision, action, consequence và page của nó. Bind toàn bộ business rule, operation, entitlement, data owner và failure consequence vào routed truth, rồi in một flow-level journey direction cho toàn scope thay vì một direction riêng cho mỗi page.

Từ dưới lên theo contract-first, không được thấy proposed journey region hay preferred candidate, inspect complete composition, component, contract, data mapping, responsive
behavior, exact source owner và nested visual owner từ legacy/current. Với mỗi render intent mà region phục vụ,
ghi observable obligation có verdict `supported` hoặc `missing`, exact source evidence và exact required paths
khi còn thiếu. Phân loại region là `reuse`, `generalize` hoặc `new-required`; `reuse` chỉ hợp lệ khi mọi obligation
đều supported. Thiếu capability không bao giờ là lý do làm yếu customer journey.

Chỉ sau khi cả hai track hoàn tất mới merge bằng page-level binding matrix. Mỗi render intent bind journey
steps, business obligations và contract-backed regions; mỗi region phải cite render intent nó phục vụ. Intent,
step, capability hoặc region nào không bind đều stop run. Từ matrix này, in một UI direction cho hierarchy,
composition, responsive và emphasis. In journey direction và UI direction thành hai field riêng trước khi join
thành anatomy. Mặc định là một flow-level receipt; owner explicit brainstorm trước `OK #1` mới sinh 3–4 complete
receipt. Trước HTML phải chạy `@frontend-quality` qua mười lens và sáu detector family trên binding StarCi
evidence; optional external design source chỉ là digest-pinned advisory. Draft không eligible phải sửa hoặc loại.
Mỗi alternative được review riêng trên cùng facts; không nhân alternatives theo từng page.

### 3. Pages stage — complete anatomy trước states

Emit schema 9 `stage: pages`. Default `generate` tạo complete mature long page hoặc flow cho một direction receipt;
explicit brainstorm tạo 3–4 complete candidate. Dùng một representative populated state cho mỗi page ở desktop
và narrow viewport. Phải có full chrome, meaningful content, intentional hierarchy và density, mọi major region
và complete block anatomy. Tạo complete future state inventory ngay lúc này nhưng chưa render các state đó.

Page contract bind synthesis, route, region, representative state, hierarchy, density, responsive behavior, visual precedent, state inventory và representative full-viewport render. `renderContract` và `executionPrompt` bị cấm.

Validate artifact và schema 2 maturity review với `reviewStage: pages`. Refuse wireframe, sparse scaffold, generic admin template, dead space không có lý do, control không có anchor, type rank yếu và anatomy chưa hoàn tất.

Publish review nhãn `pages`, in cả hai direction cùng quality verdict cho từng candidate và disclose
`OK #1: DIRECTION + QUALITY + PAGE ANATOMY`, candidate, canonical direction-quality-page hash và routes. Approval
này chỉ tác động cache: nó select direction duy nhất hoặc gọi tên `A`–`D`, freeze direction, quality review và page
anatomy rồi mở state expansion; tuyệt đối không cấp quyền ghi source.

### 4. States stage — bung trong page đã duyệt

Sau `OK #1`, emit schema 9 `stage: states`, `mode: expand-states` và SHA-256 của canonical selected
`{directionReceipt, qualityReview, pageContract}`. Giữ chính xác cả ba. Expand mọi loading, empty, ready, error, permission,
disabled, unavailable, success và overlay condition trong contract cùng executable in-memory behavior. Thêm
transition và source-owned data mapping. Phân loại mỗi condition tại đúng owner: page state chỉ tồn tại khi region
arrangement, hierarchy hoặc active page-level composition thay đổi; condition chỉ đổi một subtree vẫn là block
state dù evidence chụp cả page quanh nó. Chọn tối đa năm complete-page render target trên toàn flow; mỗi target
bind page state nếu có cùng các seeded block state nhìn thấy trong capture, rồi render target ở mọi reference
viewport. Mọi route mới và từng family capability `generalize`/`new-required` khác biệt phải được đại diện; nếu
năm target không đủ thì split scope trước `OK #2`. Exact render contract vẫn giữ complete implementation inventory
còn `renders` chỉ là bounded evidence sample này; sau đó tạo canonical execution prompt.

Ở schema 9, mọi viewport row của cùng một selected target phải mang cùng một tập `visibleBlockStates`, và từng tên
phải resolve về data owner của render region. `renderContract.seedOwners.requiredStates` tương ứng phải đúng bằng
page/state identity đã chọn cộng tập block state nhìn thấy đó; thiếu, tự chế hoặc lệch giữa viewport đều fail trước
`OK #2`.

Trước khi compose complete render region, phân rã nó thành closed child target. Ghi một dòng `grammarScopes` cho mỗi target với observable facts và đúng quyết định slot/outcome/component từ routed grammar. Region compose các owner đó và không được thay list, accordion, form hay body surface đã resolve bằng generic card. Chạy `@validate-layout-grammar` trước source approval.

Trước `OK #2`, in source-owner matrix cho từng stateful region: state owner, exact drawing `ComponentBase`, optional connected `Component`, compositor kind cùng exact `PageBase`/`LayoutBase`/`OverlayBase`, connected outer entry, và parent render child nào. Block state bắt buộc có child drawing owner riêng. Nhét state hoặc data của nó dưới props của Page, Layout hay Overlay trong khi outer surface vẫn sở hữu render không phải extraction. Chỉ thêm nested Block chain cho subtree stateful độc lập, không tạo tầng giả. Source boundary phải chứa mọi exact child và outer-surface file trong chain cùng mọi `requiredPath` của missing obligation. Boundary chỉ chứa consumer nhưng bỏ contract, branch, leaf hay data owner mà approved anatomy cần là không hợp lệ.

Với mỗi selected render target, trước `OK #2` phải in một machine-validated `renderContract.seedOwners` row: exact
development/test identity, page state và block states cần có, product-native seed owner, exact seed files hoặc
existing command, idempotency key, local dependencies, safe-repeat behavior cùng product read path. Seed file mới
thuộc approved source boundary. Cache fixture không thể hoàn thành contract này.

Trước `OK #2`, phân loại authentication của flow là `required` hoặc `not-applicable`. Protected actor route làm
authentication thành required. Page map và selected proof scope khi đó phải có product login entry, form
username/password, invalid-credential state, successful session transition và protected landing. Thiếu bất kỳ
phần nào thì mở lại pages; không được lập kế hoạch direct session mutation, cookie injection hay proof-only login
helper. Exact source boundary phải chứa login page, form owner, session client, route transition và tests cần thiết.

Validate artifact, layout grammar và schema 2 maturity review với `reviewStage: states`. State không fit approved page anatomy sẽ làm page approval mất hiệu lực. Feedback chỉ đổi cách thể hiện state thì giữ page approval.

Publish review nhãn `states` và disclose `OK #2: STATES + SOURCE BOUNDARY`, direction-quality-page hash không đổi,
render contract và exact files. Chỉ approval này mới cấp quyền ghi source.

### 5. Code approved source

Sau `OK #2`, lấy target baseline và implement canonical prompt mà không reinterpret. Condition do block sở hữu phải được real `ComponentBase`/connected `Component` render; `PageBase`, `LayoutBase` hoặc `OverlayBase` compose child đó và không được proxy state hay request data. Chạy canonical lint/tests cho complete state/transition contract.

### 6. Seed real local product

Trước browser proof, materialize mọi selected render target qua approved product-native seed owner. Ưu tiên existing idempotent bootstrap seeder hoặc explicit development/test seed command; chỉ thêm seed source khi exact files của nó đã được duyệt. Seed graph deterministic nhỏ nhất mà real connected page cần, scope vào test identity đã khai, đánh dấu là development/test data và để mọi lần chạy hội tụ mà không tạo duplicate.

Phase này được phép start declared local dependencies cùng real frontend/backend. Nó không được đòi VPS, mutate production data, gọi undeclared external provider hoặc thay backend-owned truth bằng client mock, component props, static HTML hay cache fixture. Prove kết quả qua chính read path của product và ghi command, identity, stable identifiers cùng observed rows/states. Seed thiếu hoặc fail sẽ stop visual proof; repair trong approved boundary hoặc quay lại `OK #2` nếu cần file mới.

Khi authentication là required, resolve một development/test operator riêng và chỉ đưa username/password cho
browser automation qua process environment hoặc encrypted workspace reference. Không persist value vào source,
cache JSON, trace action, screenshot, command-line argument hay log.

### 7. Prove real-product parity

Chạy browser proof cho mọi selected render target. Năm complete-page target là default review budget, không phải coverage cap. Với flow có auth, bắt đầu bằng Playwright chưa đăng nhập, đi tới product login entry, tự điền username và password từ test identity đã khai, submit form nhìn thấy được, chờ protected route rồi mới capture protected states. Trace phải ghi `auth-open-login`, `auth-fill-username`, `auth-fill-password`, `auth-submit` và `auth-reach-protected-route` bằng UI method thật nhưng không ghi entered values. Direct API session, cookie/header injection, preloaded `storageState`, `document.cookie` và proof-only switch đều không hợp lệ. `visual-proof.json` schema 4 bind authentication trace đó với PNG/DOM/axe/state traces của real connected product ở cùng state và viewport; validator tự tính verdict. Repair defect trong boundary mà không cần approval thứ ba.

## Rules

1. Một invocation sở hữu synthesis, hai approval, implementation, deterministic local seeding và QA.
2. Journey/business định nghĩa cái phải tồn tại; component/contract evidence ràng buộc cách build.
3. Direction bắt buộc nằm trong page synthesis. Layout in journey direction và UI direction riêng trước khi join.
4. Mặc định một flow-level direction; 3–4 chỉ khi owner explicit brainstorm trước `OK #1` và không nhân theo page.
5. Manual `OK #1` hoặc bound auto receipt chỉ tác động cache; exact source file cần manual `OK #2` hoặc exact-boundary auto receipt.
6. Page drift quay lại page approval; state-only rejection giữ approval đó.
7. Review artifact là disposable cache; source và executable proof là durable.
8. MASTER được chọn một lần và execution không được reinterpret approved preview.
9. Ordered multi-stage progress dùng connected stepper anatomy.
10. Cache fixture không bao giờ thay product-native seed data trong final proof.
11. Mọi render child ở states stage resolve qua một grammar scope; exact component owner của nó là execution authority.
12. `reuse` cần observable source evidence cho mọi bound render-intent obligation; ownership của state/data không tự chứng minh anatomy.
13. Mọi route mới và distinct non-reuse capability family phải vào final parity proof; thiếu `visual-proof.json` thì run chưa hoàn tất.
14. Journey obligations, FE capability, hai direction, phần join và page anatomy là một displayed `page-synthesis` step; internal gate vẫn bắt buộc nhưng không trở thành approval riêng của owner.
15. Layout sở hữu first synthesis. Concrete owner feedback từ chối emitted/implemented output vì sai
    Grammar/Principles thì rời first-synthesis scope và vào correction owner.
16. Mọi candidate pass shared quality review trước HTML; external UX/UI evidence chỉ là advisory.
17. State expansion giữ approved quality review byte-identical; đổi review phải mở lại pages.
18. Layout có authentication không được kết thúc trước khi signed-out Playwright điền cả hai credential control
    qua product form và tới protected route. API-created session hay injected state không bao giờ pass.

## Stops

- Thiếu route, scope, business authority, grammar/profile, contract, source baseline hoặc flow endpoint.
- Journey step không có page ownership hoặc component capability.
- Fabricated content, incomplete state inventory, immature page evidence hoặc non-functional HTML.
- Thiếu quality lens/detector closure hoặc advisory evidence bị trình bày như authority.
- Dùng `OK #1` như source authority, hoặc `OK #2` không có exact files.
- Giấu page-contract drift hoặc required work nằm ngoài approved boundary.
- Thiếu seed ownership, selected state không seed được, seed không idempotent hoặc final proof chỉ tồn tại trong cache/component mock.
- Protected route thiếu product login entry đã render, test credential owner hoặc schema-4 authentication trace
  điền cả hai control và tới route mà không dùng session shortcut.
- Concrete owner feedback chỉ ra semantic owner, visual law hoặc repeated skill decision sai trong emitted output — owner: `starci-fe-design-refactor`.

## OUTPUT

Ở page review, in journey direction, UI direction cùng quality verdict cho từng candidate rồi báo joined page URL,
maturity verdict và cache-only `OK #1`. Ở state review, báo state coverage, direction-quality-page hash không đổi, exact source files,
seed-owner rows và `OK #2`. Sau code, báo changed files, tests, seed command/identity/observed data,
authentication applicability và—khi required—login route cùng credential source class không có value, rồi real-product parity.
