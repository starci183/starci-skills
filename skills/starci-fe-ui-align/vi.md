---
name: starci-fe-ui-align
description: Audit một tập frontend surface hiện hữu đã khai để tìm semantic và visual inconsistency, chọn một canonical expression có evidence, rồi align mọi consumer bị ảnh hưởng và chỉ tăng cường grammar, principles, patterns hoặc gates khi authority gap đã được chứng minh thật sự cần. Dùng cho hội tụ chủ động xuyên surface, không dùng để thiết kế page ban đầu hay sửa một feedback owner cụ thể.
---

# starci-fe-ui-align

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | language, approval, baseline và reporting boundary dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | verify frontend route và grammar/profile |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | giữ audit và comparison evidence trong session cache |
| `@composition` | `brainstorms/composition/vi.md` | vi | khóa scope, semantic owner, invariant cần giữ và proof |
| `@business` | `contexts/business/vi.md` | vi | phân biệt product truth với visual expression |
| `@grammar` | `grammars` | module | resolve product-family fact, outcome và owner |
| `@principles` | `compilers/principles` | module | resolve product-neutral visual situation |
| `@patterns-fe` | `compilers/patterns/fe` | module | resolve source ownership và shared-component boundary |
| `@lints-fe` | `gates/fe/lints` | module | bind alignment law quan sát được với executable proof |
| `@standards` | `standards` | module | giữ accountability từ law tới machine |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | render before/after comparison evidence có boundary trong cache |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | emit grammar decision đã route |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove grammar authority trước và sau thay đổi |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | từ chối grammar hoặc receipt drift |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | inventory vocabulary frontend hiện hành |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | prove audit baseline bốn lock |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | từ chối concern không có principle module thật |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove business authority trước source write |
| `@compile-context` | `scripts/compile-context.mjs` | script | rebuild runtime context sau authority change |
| `@check-deps` | `scripts/check-deps.mjs` | script | prove dependency graph runtime và publication |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | từ chối visual convergence thiếu hoặc lệch |

## NESTED SKILLS

Không có.

## Purpose

Chất vấn xem các UI responsibility tương đương có cùng semantic owner và visual expression hay không, đồng thời các responsibility khác nhau có còn phân biệt rõ hay không, trên một tập surface hiện hữu đã khai. Hội tụ theo authority hiện hành có evidence, không theo style chiếm đa số. Chỉ tăng cường durable authority khi counterexample thật chứng minh law hiện hành không biểu đạt được invariant cần thiết.

## Scope boundary

Scope là một frontend đã route và một tập đóng có ít nhất hai occurrence độc lập của cùng semantic responsibility. Audit complete real-page parent. Composition mới, work trên một block anatomy, một owner-feedback correction cụ thể và một local defect đã hiểu rõ đều nằm ngoài capability này.

## Process

1. Audit read-only: resolve route, authority và baseline; inventory complete page, state, viewport, semantic role, contract key và exact owner chain; tách responsibility tương đương khỏi responsibility cố ý khác nhau; classify mọi variance; đồng thời nói rõ từng quan sát của owner là `correct`, `incorrect` hay `partly-correct`, tại sao, vì sao AI chưa thi hành, và hệ quả authority/source chính xác. Tạo một canonical proposal cùng exact authority/source/proof boundary.
2. Sau `OK`, lấy baseline, cập nhật authority gap đã chứng minh trước source, rebuild runtime context và enforcement, align mọi consumer đã duyệt, rồi chạy gate và same-state/same-viewport full-page proof tới khi không còn known defect.

## Classification

Dùng đúng một verdict cho mỗi variance: `justified-deviation`, `source-drift`, `inventory-or-application-miss`, `grammar-gap`, `grammar-misruling`, `principle-gap`, `principle-misruling`, hoặc `pattern-or-gate-gap`. Tần suất không phải authority; misruling cần counterexample, còn law mới cần positive scope, negative boundary và impact search đầy đủ trên mọi consumer đã route.

## Rules

1. Chứng minh semantic equivalence trước visual equality.
2. Style chiếm đa số không bao giờ chọn canonical expression.
3. Authority hiện hữu đã đủ thì sửa source, không thêm law.
4. Grammar sở hữu product-family truth; principles chỉ sở hữu product-neutral visual situation còn unresolved.
5. Shared law mở impact cone tới mọi consumer đã route.
6. Giữ mọi justified deviation và hoàn tất convergence đã khai trong một invocation.
7. Authority change đi trước source và mang paired publication, compiled context cùng executable proof.
8. Cache chỉ tạm; authority, source, test và browser proof mới bền vững.
9. Trước approval, compile một authority-to-write map: một quyết định có một semantic owner, mỗi file được chạm thuộc đúng một write batch, và owner cần giữ nguyên được loại trừ rõ.
10. Defect lặp lại phải tăng cường durable layer nhỏ nhất còn thiếu. Không nhân đôi law đang đúng: thêm case, pattern, gate hoặc source assertion khi enforcement/application đã fail.
11. `Why not executed` phải gọi đúng nguyên nhân: approval boundary, thiếu evidence, external blocker hay lỗi reasoning/reporting của AI. Chỉ ghi `waiting for OK` không phải là giải thích.

## Stops

- Thiếu route, authority, baseline, reproducible real-page parent hoặc closed multi-occurrence scope.
- Page composition mới — larger owner: `starci-fe-design-layout`.
- Một block anatomy — larger owner: `starci-fe-design-block`.
- Một owner-feedback correction cụ thể — larger owner: `starci-fe-feedback-evolve`.
- Một local defect đã hiểu rõ — larger owner: `starci-fe-minor-fix`.
- Canonical choice không có căn cứ, law change đã expressible, hoặc thiếu counterexample/negative boundary.
- Impact ra ngoài cone đã duyệt, thiếu business authority, hoặc defect trong boundary không thể sửa.

## OUTPUT

Render owner-feedback verdict table với `Observation`, `Verdict`, `Why`, `Why not executed`, `Authority correction`, `Source correction` và `Proof`. Báo tập đã audit, justified deviation, canonical recommendation, one-pass authority-to-write map và exact approval boundary; sau đó cập nhật chính bảng đó bằng authority change, consumer đã align, owner được giữ, gate và full-page visual proof.
