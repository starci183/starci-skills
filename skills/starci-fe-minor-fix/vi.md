---
title: starci-fe-minor-fix · Vietnamese
---

# starci-fe-minor-fix

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | dùng contract chung về context, ownership, approval và báo cáo |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và kiểm tra checkout frontend được yêu cầu |
| `@business` | `contexts/business/vi.md` | vi | bind correction vào implemented truth |
| `@principles` | `compilers/principles` | module | resolve existing visual situations |
| `@patterns-fe` | `compilers/patterns/fe` | module | chỉ nạp pattern module mà component hiện hữu và correction thực sự chạm tới |
| `@lints-fe` | `gates/fe/lints` | module | route lint finding chuẩn mà không suppress hoặc đoán unknown rule |
| `@scope-check` | `scripts/check-fe-minor-fix-scope.mjs` | script | ép biên folder hiện hữu, số file và production churn trước/sau patch |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove technical-only business boundary |

## NESTED SKILLS

Không có. Khi reject, skill chỉ gọi tên workflow lớn hơn; không tự chạy workflow đó.

## Cách chạy

Đây là fast lane cho một correction đã hiểu rõ. Caller cung cấp project, role frontend, một component
identity hiện hữu, defect quan sát được và behavior mong muốn. “Atom” trong request được map sang tier
`leaves` hiện hành; skill không tạo lại tier `atoms`.

## Hàng rào đủ điều kiện

Chỉ nhận một folder hiện hữu dưới `blocks`, `composites` hoặc `leaves`; không đổi public shape, visual
anatomy, contract, state hay data owner. Patch tối đa hai production file hiện hữu, hai test colocated và
40 dòng production thêm-cộng-xóa. Target phải sạch trước write; dirt không liên quan ở nơi khác được giữ nguyên.

Reject trước write nếu cần route, page, layout, folder/component mới, contract/token, translation,
dependency/config, public API, caller, query/mutation, cache, async owner, state mới hoặc nhiều component.

## Quy trình

1. Resolve ngôn ngữ và route frontend đã verify.
2. Chạy scope checker không có `--base`; giữ HEAD nó in ra làm baseline.
3. Chỉ đọc target, test colocated, caller thật sự cần thiết và contract entry target đang cite.
4. Route qua frontend pattern shelf và nạp đúng child record đạt tới trước write.
5. Áp dụng patch behavior nhỏ nhất, không refactor lân cận.
6. Chạy lại scope checker với `--base`; nếu reject, chỉ undo hunk của lượt này bằng `apply_patch`.
7. Chạy test colocated, typecheck repo và canonical lint scoped vào target. Chỉ sửa trong boundary;
   unknown rule hoặc finding cần path ngoài target làm lượt chạy bị reject.
8. Báo baseline, path, production churn và proof. Chỉ commit/push khi request nói rõ.

## Điểm dừng

- Route thiếu/stale; target thiếu, dirty, mới, mơ hồ hoặc sai tier.
- Bất kỳ semantic fence nào bị vượt trước write.
- Hơn hai production file, hai test hoặc 40 dòng production changed.
- Cần suppression, gặp unknown lint rule hoặc cần path ngoài target.
- Anatomy hoặc state của block — owner lớn hơn: `starci-fe-design-block`.
- Persistent geometry hoặc address ownership — owner lớn hơn: `starci-fe-design-layout`.
- Design nhiều region đã accepted — owner lớn hơn: `starci-fe-design-execute`.
- Quality repair rộng — owner lớn hơn: `starci-repair`.
- Public API hoặc data ownership — owner lớn hơn: task coding có plan bình thường.

## Đầu ra

Trả `minor fix applied` cùng identity và proof, hoặc `MINOR-FIX-REJECTED` cùng boundary đầu tiên bị vượt và
workflow lớn đúng. Không dùng status table.
