---
name: starci-fe-feedback-evolve
description: Biến feedback owner cụ thể trên frontend implementation đã accepted thành cải tiến bền vững nhỏ nhất cho evidence, grammar, principles, patterns hoặc gates, rồi sửa và visual proof source trong cùng invocation. Design preview là cache tạm.
---

# starci-fe-feedback-evolve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | approval và reporting boundary dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | verify frontend và grammar/profile |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | giữ preview trong session cache |
| `@composition` | `brainstorms/composition/vi.md` | vi | phân biệt parent sai với law thiếu |
| `@business` | `contexts/business/vi.md` | vi | phân biệt visual correction với product truth |
| `@grammar` | `grammars` | module | test stable facts và owners |
| `@principles` | `compilers/principles` | module | test product-neutral visual law |
| `@patterns-fe` | `compilers/patterns/fe` | module | test source architecture |
| `@lints-fe` | `gates/fe/lints` | module | bind observable law với gate |
| `@standards` | `standards` | module | giữ accountability |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | render correction trong cache |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove grammar authority |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | prove current receipt |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove product write authority |
| `@compile-context` | `scripts/compile-context.mjs` | script | rebuild runtime context |
| `@check-deps` | `scripts/check-deps.mjs` | script | prove dependency graph |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | prove bốn lock |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | từ chối phantom concern |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | từ chối delivery thiếu |

## NESTED SKILLS

None.

## Purpose

Tìm xem feedback lộ ra law, evidence, application, pattern, gate hay source failure. Chỉ cải tiến durable authority đúng tầng, rồi preview, implement và prove correction trong cùng invocation. Preview cache không bao giờ là authority.

## Process

In shared execution table hai dòng: read-only audit, rồi một authority/source/proof batch đã duyệt. Chạy authority gate và baseline bốn lock trước classification; `misdrawn` bắt buộc có counterexample. Với mỗi owner observation, ghi `correct`, `incorrect` hoặc `partly-correct`, giải thích tại sao và vì sao AI chưa thi hành; chỉ ghi `Waiting for OK` không phải giải thích. Lập một authority-to-write map nơi một decision có một semantic owner, mỗi path thuộc đúng một write batch và owner đang đúng được giữ rõ. Với feedback về state/data ownership, bắt đầu từ smallest changing surface và trace concrete chain `ComponentBase → Component → PageBase/LayoutBase/OverlayBase → Page/Layout/Overlay`. Nhét child state hoặc request data dưới outer props vẫn là proxy, không phải extraction; nested Block chain chỉ tồn tại cho subtree stateful độc lập và impact cone phải gồm mọi exact owner file. Apply MASTER một lần, chỉ ghi page deviation và chỉ route delta unresolved tới principles. Ghi authority change trước source trong cùng approved batch, rồi sửa và prove same-viewport full page mà không mở duplicate pass thứ hai.

## Rules

1. Interrogate law trước product.
2. Preview, correction và QA xảy ra trong cùng invocation.
3. Không có design registry hay durable preview identity.
4. Source cùng proof là durable design outcome.
5. Một feedback chain sinh đúng một verdict table và một authority-to-write batch; explanation, durable correction và source consequence không bị tách thành duplicate pass.

## Stops

- Thiếu observable state, authority proof, counterexample bắt buộc hoặc business authorization.
- Work ngoài approved boundary.

## OUTPUT

Render một bảng với `Observation`, `Verdict`, `Why`, `Why not executed`, `Authority correction`, `Source correction` và `Proof`. Báo one-pass authority-to-write map, sound owner được giữ, authority change, source path và executable proof. Không báo design head.
