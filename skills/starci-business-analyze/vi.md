---
title: starci-business-analyze · Tiếng Việt
---

# starci-business-analyze

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | sở hữu execution và proof cho user |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và verify route FE/BE |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | verify business root bền vững |
| `@business` | `contexts/business/vi.md` | vi | luật schema, evidence và publication của business |

## NESTED SKILLS

Không có. Một stop kết thúc run; skill này không gọi skill khác để recovery.

## Mục đích

Build hoặc refresh một `featureId` ổn định từ frontend/backend đã route tại committed head. Kết quả là
immutable machine model cùng `CONTEXT.md` gọn, module route theo task và evidence dưới
`.worktrees/<project>/businesses`.

## Biên

Skill đọc product source/test đã route và chỉ ghi business worktree của project. Nó không sửa product
source, design registry, workspace route, deployment state hay imported example. Claim chưa được chứng
minh trở thành unknown rõ ràng.

## Chạy

1. Resolve Source, project, stable `featureId`, requested surface và runtime language.
2. Verify path, branch, committed head, origin và local instruction của mọi role đã route.
3. Verify business worktree đã lock, sạch, do Source sở hữu trên `codex/businesses/<project>`.
4. Đọc route mount và connected UI state, rồi frontend operation/type/test, rồi backend
   operation/schema/service/test. Chỉ đọc sibling để chốt một contract chính xác.
5. Tạo model hợp lệ với `@business/@feature-schema`. Mọi actor, flow, rule, state, entity, operation,
   surface, region và acceptance không phải unknown đều cite evidence trong cùng model.
6. Đặt identity, status, action và state thật vào surface region để render prototype; không bịa total,
   role, API hay behavior.
7. Validate bằng `business-registry.mjs`, apply, kiểm tra generated view và chỉ commit business worktree
   với `docs(business): refresh <featureId>`.
8. Prove currentness bằng `--check --feature <featureId>` rồi report feature hash, routed head, surface
   ID, unknown count và business commit.

## Hợp đồng refresh cho consumer

Consumer phụ thuộc business kiểm tra feature head trước khi suy luận. Truth thiếu hoặc stale phải được
đọc lại và republish từ evidence hiện hành; cấm chỉ đổi recorded source head. Giữ unknown khi current
source không trả lời được product choice.

## Từ chối

- Route FE/BE bắt buộc đang thiếu hoặc stale.
- Cited evidence dirty, thiếu, ngoài routed repository hoặc ngoài line range.
- Business worktree thiếu, dirty, unlocked, foreign hoặc sai branch.
- Claim không có evidence hoặc evidence ID dangling.
- Screenshot, conversation, example hay design candidate bị coi là implemented truth.
- Request thực chất là thay product behavior thay vì phân tích business.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <fe@head, be@head, ...>
surfaces: <ids>
unknowns: <count>
business commit: <hash>
```
