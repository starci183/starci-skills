---
name: starci-fe-design-layout
description: Chốt một composed page hoặc end-to-end page flow, rồi challenge, preview, duyệt, implement và visual proof đúng frontend scope đó trong cùng invocation bằng routed business truth, grammar, contract và current source. Preview là cache tạm; không tạo design registry.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | approval và reporting boundary dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và verify frontend route |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | giữ review evidence trong session cache |
| `@business` | `contexts/business/vi.md` | vi | bind page với current product truth |
| `@grammar` | `grammars` | module | load routed facts, outcomes và owners |
| `@principles` | `compilers/principles` | module | audit selected visual decisions |
| `@patterns-fe` | `compilers/patterns/fe` | module | chọn source file và ownership trước khi ghi |
| `@lints-fe` | `gates/fe/lints` | module | prove implemented source |
| `@directions` | `brainstorms/directions/vi.md` | vi | evidence-select visual direction |
| `@layouts` | `brainstorms/layouts/vi.md` | vi | compose page, region và ownership |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | authored HTML review trong cache |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract reason không lộ class |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | emit selected grammar decisions |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove routed grammar package |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | refuse theme hoặc receipt drift |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | bind candidate với current vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate session design artifacts |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish cache review |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove business authority trước source write |

## NESTED SKILLS

None. Skill này sở hữu design tới implementation và QA trong một invocation.

## Run

Chốt đúng một scope: `page` cho một composed route cùng mọi state/overlay reachable, hoặc `flow` cho sequence start-to-end rõ ràng. Resolve FE, grammar/profile, business, contract và source baseline. Tạo một ignored session pack dưới `.worktrees/<project>/cache/design/<session-id>`.

Inventory mọi UI condition và business content reachable trước khi vẽ. Author ba hoặc bốn complete functional HTML candidate khác biệt đáng kể, chứa mọi owned region. Rank và chỉ audit recommendation qua principles. Render cache review, disclose exact candidate và source path, rồi chờ một `OK`.

Sau approval, lấy target baseline, implement ngay selected outcome vào current source, chạy patterns, gates, tests và browser proof ở mọi viewport/state bị ảnh hưởng, rồi reconcile business authority khi cần. Cache không trở thành authority và task khác không được resume nó.

## Rules

1. Design, approval, implementation và QA xảy ra trong cùng invocation.
2. Review artifact chỉ sống trong ignored project cache.
3. Không có design registry, durable head hoặc immutable preview revision.
4. Complete page/flow chứa mọi owned region và reachable condition.
5. Exact source path cần approval trước khi ghi.
6. Source cùng executable proof là durable outcome.

## Stops

- Thiếu route, grammar/profile, business truth, contract, source baseline hoặc scope boundary.
- Fabricated content, state thiếu, preview không functional hoặc ít hơn ba alternative thật.
- Product truth mới chưa có business authority.
- Work bắt buộc nằm ngoài approved source boundary.

## OUTPUT

Báo candidate, recommendation, cache review URL và exact source boundary; sau `OK`, báo changed source paths và real-product proof. Không báo registry head hay revision hash.
