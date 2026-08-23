---
title: starci-fe-ui-reconcile · Tiếng Việt
---

# starci-fe-ui-reconcile

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | boundary chung cho approval, execution và reporting |
| `@orchestration` | `runtime/orchestration/vi.md` | vi | cô lập evidence declared/observed, giữ authority write và join proof |
| `@classify-fe-change` | `scripts/classify-frontend-change.mjs` | script | từ chối local fix hoặc new-layout work |
| `@workspaces` | `knowledge/contexts/workspaces/vi.md` | vi | frontend route và source boundary chính xác |
| `@business` | `knowledge/contexts/business/vi.md` | vi | product truth cố định |
| `@grammar` | `knowledge/grammars` | module | meaning, semantic owner và behavior theo product family |
| `@principles` | `knowledge/compilers/principles` | module | visual situation không phụ thuộc product |
| `@patterns-fe` | `knowledge/compilers/patterns/fe` | module | binding từ authority đến source |
| `@lints-fe` | `runtime/gates/fe/lints` | module | frontend proof |
| `@standards` | `runtime/standards` | module | trách nhiệm từ law đến proof |
| `@frontend-quality` | `knowledge/brainstorms/frontend-quality/vi.md` | vi | phản biện consistency tích hợp |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | outcome và owner hiện hành |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | grammar proof |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | principle proof |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | product evidence được compute |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | proof product truth không đổi |
| `@compile-context` | `scripts/compile-context.mjs` | script | rebuild runtime context |
| `@check-deps` | `scripts/check-deps.mjs` | script | dependency graph proof |

## NESTED SKILLS

None.

## IMPACT ROUTING

Dùng skill này cho một tập surface hiện hữu đã đóng với ít nhất hai consumer được implement độc lập, hoặc một
systemic authority audit được owner yêu cầu rõ, có counterexample cụ thể và consumer inventory đầy đủ. Local fix
chính xác đi plain path hoặc Layout Refactor. Anatomy mới trả về Layout; product-truth change trả về business
authority.

## PIPELINE

Topology: `reconciliation`.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| bind | shared | FE role đã route, closed surface set và consistency question | freeze truth, state, viewport, source head và authority root được write | immutable reconciliation envelope | mọi comparison đều reproducible |
| declared | declared | grammar, principles, patterns, gates và owner chain hiện hành | resolve expected outcome mà không thích nghi theo source hiện tại | declared-authority matrix | mỗi expectation cite đúng một durable owner |
| observed | observed | live source và các rendered surface ở state khớp nhau | inventory structure, behavior, accessibility và interaction mà chưa đề xuất law | observed-surface matrix | mỗi observation có source và product evidence |
| reconcile | join | hai matrix đã pass | phản biện và classify từng discrepancy tại layer cao nhất bị fail | consistency verdict và impact cone | local drift tách khỏi systemic authority gap |
| approve-apply | execution | verdict, consumers, cases và exact write boundary | sau exact `OK`, evolve authority nhỏ nhất trước khi cần rồi align approved consumers | authority receipts, bounded FE diff và green gates | mỗi target một writer; lower-layer patch không che upper-layer failure |
| proof | proof | authority và product stable | validate authority/dependencies và compute cross-surface product evidence | final consistency proof | không còn known in-boundary inconsistency |

## Run

### 1. Bind comparison

Đọc `@skill-shape` và `@orchestration`, resolve `defaultLang`, rồi bind project, FE role, closed surface set và
consistency question cụ thể. Freeze business truth, state, viewport, source head và writable root.

### 2. Resolve declared authority độc lập

Resolve grammar/principle owner mà không uốn theo source hiện tại. Record required shared outcome, intentional
variation và exact durable owner của mỗi expectation.

### 3. Measure real product độc lập

Đo live source cùng real state/viewport khớp nhau mà không cho track này xem proposed law change. Record source,
visual, responsive, accessibility và interaction evidence.

### 4. Reconcile và classify

Giữ declared authority và observed product evidence độc lập cho đến khi cả hai pass, rồi classify từng discrepancy
thành intentional variation, local application drift, grammar gap/misruling, principle gap/misruling,
pattern-or-gate gap hoặc product-truth conflict. Đóng full consumer impact cone.

### 5. Approve và apply một boundary

Chỉ evolve durable authority khi một binding invariant bị vi phạm, ít nhất hai independent case hỗ trợ cùng một
generalization, hoặc owner ruling rõ correction là systemic. Dưới exact `OK`, update
highest failed authority trước, thêm executable positive/counterexample cases, compile runtime context và pass
grammar/principle/dependency gates trước khi align mọi FE consumer được approve.

### 6. Prove stable consistency

Prove cùng real state và viewport bằng FE gates cùng computed visual, accessibility và interaction evidence.

## Rules

1. Reconcile UI hiện hữu; không invent journey, capability hoặc page anatomy.
2. Majority implementation là evidence, không phải authority theo phiếu số đông.
3. Preserve intentional variation do product truth hoặc semantic owner yêu cầu.
4. Grammar change cần product-family evidence; principle change cần product-neutral evidence.
5. Một local preference, screenshot hoặc outlier không thể tạo shared law.
6. Mọi authority change đều có paired publications, compiled context và executable cases.
7. Authority change đi trước dependent FE change và cover approved impact cone.
8. Product truth, backend source, seed và provider state giữ nguyên.
9. Completion cần authority, dependency, FE và real-product proof đều green.

## Stops

- Comparison chỉ local, không route được hoặc không reproduce được.
- Product truth stale hoặc kết quả cần behavior/anatomy mới, backend work hay seed change.
- Systemic claim thiếu independent cases, exact owner hoặc closed consumer impact cone.
- Red gate không thể repair trong approved boundary.

## Output

Report surface set, verdicts, intentional variations, highest failed owners, approved boundary, authority changes
(nếu có), aligned consumers và computed proof. Nói rõ khi authority vốn sound và chỉ product application hoặc
enforcement thay đổi.
