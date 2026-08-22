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

## PIPELINE

Topology: `reconciliation`.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| bằng chứng | dùng chung | phát biểu owner, routed source evidence và feature head hiện tại | tách fact, intent, example, unknown và contradiction | normalized evidence pack | mọi claim có provenance và example không tạo product truth |
| mô hình | đối chiếu | evidence pack và predecessor head | reconcile actor, goal, rule, state, operation và failure | proposed business model và delta | mọi thay đổi truy được về evidence và giữ lineage |
| xuất bản | thực thi | model đã nhận và lifecycle transition được yêu cầu | ghi immutable model, compact context, module và evidence links | feature head mới và publication receipt | schema, predecessor và lifecycle transition hợp lệ |
| hòa giải | proof | head đã publish và implemented source khi áp dụng | đối chiếu declared truth với implementation quan sát được | implemented hoặc discrepancy receipt | không còn claim thiếu evidence hay source baseline chưa bind |

## Mục đích

Build, advance hoặc reconcile một `featureId` ổn định từ source đã route và owner intent rõ ràng. Kết quả là
immutable machine model cùng `CONTEXT.md` gọn, module route theo task và evidence dưới
`.worktrees/<project>/businesses`.

## Biên

Skill đọc product source/test đã route và chỉ ghi business worktree của project. Nó không sửa product
source, design preview cache, workspace route, deployment state hay imported example. Claim chưa được chứng
minh trở thành unknown rõ ràng.

## Chạy

1. Resolve Source, project, stable `featureId`, requested surface và runtime language.
2. Verify path, branch, committed head, origin và local instruction của mọi role đã route.
3. Verify business worktree đã lock, sạch, do Source sở hữu trên `codex/businesses/<project>`.
4. Đọc route mount và connected UI state, rồi frontend operation/type/test, rồi backend
   operation/schema/service/test. Chỉ đọc sibling để chốt một contract chính xác.
5. Chọn đúng một authority operation: ghi implemented truth mới, publish `pending`, advance sang
   `in-progress`, publish `rejected`, hoặc reconcile source thành `implemented`. Không được bỏ qua write boundary.
6. Tạo model hợp lệ với `@business/@feature-schema`. Mọi actor, flow, rule, state, entity, operation,
   surface, region và acceptance không phải unknown đều cite evidence trong cùng model.
7. Đặt identity, status, action và state thật vào surface region để render prototype; không bịa total,
   role, API hay behavior.
8. Validate bằng `business-registry.mjs`, apply, kiểm tra generated view và chỉ commit business worktree
   với `docs(business): refresh <featureId>`.
9. Prove currentness bằng `--check --feature <featureId>` rồi report status, base head, feature hash, routed head, surface
   ID, unknown count và business commit.

## Hợp đồng refresh cho consumer

Consumer tin cả head lẫn state: `pending` cho design/planning, `in-progress` cho đúng implementation đó,
`implemented` là runtime truth, còn `rejected` từ chối work. Thay đổi thuần kỹ thuật bind implemented
truth với `businessImpact: none`; không bịa feature.

## Từ chối

- Route FE/BE bắt buộc đang thiếu hoặc stale.
- Cited evidence dirty, thiếu, ngoài routed repository hoặc ngoài line range.
- Business worktree thiếu, dirty, unlocked, foreign hoặc sai branch.
- Claim không có evidence hoặc evidence ID dangling.
- Screenshot, conversation, example hay design candidate bị coi là implemented truth.
- Transition bỏ qua state machine hoặc làm mất implemented base/immediate predecessor.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <fe@head, be@head, ...>
surfaces: <ids>
unknowns: <count>
business commit: <hash>
```
