---
name: starci-fe-design-layout
description: Generate, preview, duyệt, implement và prove một complete long page hoặc full end-to-end flow. Mặc định emit một coherent baseline; chỉ tạo 3–4 alternative sau explicit owner brainstorm request.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | approval và reporting boundary dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và verify frontend route |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | giữ review evidence trong session cache |
| `@composition` | `brainstorms/composition/vi.md` | vi | khóa Scope, Owner, Invariant và Proof |
| `@business` | `contexts/business/vi.md` | vi | bind page với current product truth |
| `@grammar` | `grammars` | module | load routed facts, outcomes và owners |
| `@principles` | `compilers/principles` | module | audit selected visual decisions |
| `@patterns-fe` | `compilers/patterns/fe` | module | chọn source file và ownership trước khi ghi |
| `@lints-fe` | `gates/fe/lints` | module | prove implemented source |
| `@layouts` | `brainstorms/layouts/vi.md` | vi | compose page, region và ownership |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | authored HTML review trong cache |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract reason không lộ class |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | emit selected grammar decisions |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove routed grammar package |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | refuse theme hoặc receipt drift |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | bind candidate với current vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate session design artifacts |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | từ chối parent sai hoặc thiếu full-page proof |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | từ chối phantom principle concern |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | enforce parity và delivery completion |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish cache review |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove business authority trước source write |

## NESTED SKILLS

None. Skill này sở hữu design tới implementation và QA trong một invocation.

## Run

Chốt đúng một scope: `page` cho một composed route cùng mọi state/overlay reachable, hoặc `flow` cho sequence start-to-end rõ ràng. Resolve FE, grammar/profile, business, contract và source baseline. Tạo một ignored session pack dưới `.worktrees/<project>/cache/design/<session-id>`.

Inventory mọi condition và viết baseline bốn lock. Default `generate` emit đúng một complete result: long page có mọi section/block/state; flow có mọi page/step, shared layout và transition từ start tới end. Layout sở hữu toàn bộ block anatomy cần cho implementation.

Chỉ explicit `brainstorm` sau owner review mới emit 3–4 targeted alternative trên baseline đó. “80%” là owner signal, không phải numeric gate.

Sau approval, implement ngay rồi so full page, target và preserved region với mọi same-viewport reference. Known defect hoặc delivery state chưa đạt cấm nói hoàn tất.

## Rules

1. Một complete page/flow là default; alternative cần explicit brainstorm.
2. Review artifact chỉ sống trong ignored project cache.
3. Không có design registry, durable head hoặc immutable preview revision.
4. Complete page/flow chứa mọi owned region và reachable condition.
5. Exact source path cần approval trước khi ghi.
6. Source cùng executable proof là durable outcome.
7. MASTER được chọn một lần; principles chỉ resolve evidenced delta.

## Stops

- Thiếu route, grammar/profile, business truth, contract, source baseline hoặc scope boundary.
- Fabricated content, state thiếu, preview không functional hoặc ít hơn ba alternative thật.
- Product truth mới chưa có business authority.
- Work bắt buộc nằm ngoài approved source boundary.

## OUTPUT

Báo candidate, recommendation, cache review URL và exact source boundary; sau `OK`, báo changed source paths và real-product proof. Không báo registry head hay revision hash.
