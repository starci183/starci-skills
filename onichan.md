# onichan — những gì trò tự bổ sung hoặc sửa, để thầy đọc lại

Mỗi mục: cái gì, ở đâu, bằng chứng, vì sao. Mục nào thầy không đồng ý thì nói, trò rút.

## 2026-09-03

### Knowledge

- **`PADDING-9` — inset trục dọc của một block được route ở breakpoint rộng** (`knowledge/ui/presentation/padding.md`, +vi).
  Case 1: `main` của block được route nằm ngay dưới shell lấy `py-6 sm:py-8` (PADDING-5 → PADDING-6, chỉ trục dọc; trục ngang thuộc `PageContainer`).
  Bằng chứng: bốn block viết đúng cặp này: `ProSubscriptionBlock/classNames.ts` (`proPageClassName`), `CoursePlaygroundCatalog/classNames.ts`, `PlaygroundSession/classNames.ts`, `PlaygroundSetup/classNames.ts`.
  Vì sao: phiên thử `frontend-refine` chặn `RULE_MISSING` ở đúng chỗ này; `PADDING-7` chỉ nói bước nhích của inset ngang 1rem → 1.5rem của một surface, không nói inset dọc của trang.
  Đếm rule `knowledge/ui/INDEX.md` từ 114 lên 115 (presentation 59 → 60).

### Luật operator

- **`frontend.presentation.resolve` — "Class bị cấm thì gỡ, không phải thiếu rule"** (`operator.md` +vi, mục luật mới).
  Ca thật: app đặt `text-accent-soft-foreground` lên `IncludedMark` trong hàng benefit không raised; `SURFACE-4` Case 2 chỉ cho phép trong dải raised. Đây không phải thiếu Case mà là Case đã trả lời "không"; class bị gỡ ở bước 7, marker rơi về foreground kế thừa (đúng thiết kế của `IncludedMark`: `color: inherit`, "inherited foreground" trong docblock của gói).
  `RULE_MISSING` từ nay chỉ dành cho thuộc tính không Case nào nhắc tới. Không có Case mới vì `IncludedMark` chỉ xuất hiện đúng một chỗ trong app (không đủ ≥2).

### Workspace / policy

- **`gitPolicy.worktreeBranches` có thêm giá trị `session-only`** (`readiness/initialization/workspaces/*.schema.json`, `templates/kinds/route.schema.json`, `workspace.bind` luật + validator, spec `workspace-portable`; route FE `.workspaces/projects/starci-academy/fe.json` đổi từ `forbidden`, đã hydrate lại, commit backend `90ef7fcb8`).
  Vì sao: thầy chọn phương án A; luật `sourceWrites` cần nhánh `session/<sessionId>` trong worktree, còn route cũ cấm.

### Validator / hợp đồng (lỗi phiên thử lộ ra, đã vá)

- `scripts/validate-response.mjs`: CLI đếm thừa một cấp thư mục nên coi mọi nhánh là exchange lồng. Đã sửa.
- `templates/kinds/route.schema.json`: `writeRoots` đòi `minItems: 1` trong khi `declaredWriteRoots` mặc định rỗng (bind chỉ đọc là hợp lệ). Nới về 0. Kế thừa mù từ gói cũ.
- Thêm cổng tĩnh `scripts/validate-defaults.mjs`: request toàn mặc định của mỗi operator phải qua `validate-request`, để lệch giữa Requirements và gate không lọt tới phiên thật.

### Ghi nhận không sửa (agent báo nhưng kiểm lại không đúng)

- "`BOUNDARY-3`/`-4` không được publish": sai, `boundary.md` có cả sáu; không đụng.
- "`COVERAGE-1` nêu `regionModel`": không có chữ đó trong `coverage.md`; không đụng.

### Từ phiên thử `frontend-new-surface` (bida)

- **`business.decide` nhận lời hứa mới do người nêu.** Thêm Requirement `promise` (prompt; mặc định "lời hứa của head trước", bắt buộc lần đầu); luật mới "Lần chạy đầu bắt đầu từ lời hứa của người"; `claims.schema.json` cho claim `intent`/`unknown` được là một `statement` ràng vào `request/request.json#requirements.promise` thay vì dòng source; claim `fact`/`example`/`contradiction` vẫn bắt buộc path + dòng + head. Bằng chứng của lỗ: phiên bida chặn `EVIDENCE_MISSING` ở bước 2 chỉ vì chưa có code, tức operator chỉ tả được lời hứa mà backend đã giữ, không quyết được lời hứa mới. Đây là sửa thiết kế, không phải knowledge; thầy xem có đúng ý "business quyết trước, code làm sau" không.
- **`workspace.bind` có hàng Next → `business.decide`.** Chuỗi bind → business đã có trong workflow nhưng bảng Next chưa cho phép.
- **`workflows/frontend-new-surface` ràng cả `be` lẫn `fe`** vì `business.decide` đọc `@workspaces/be` bắt buộc; `validate-workflows` giờ kiểm hai điều: mỗi cặp bậc liền kề phải có trong bảng Next của bậc trước, và `@workspaces/<role>` bắt buộc của một operator phải có `workspace.bind` role đó ở bậc trước.
- **`response.json` có `reason` tuỳ chọn** để nhánh chặn sớm (chưa viết được `response.md`) vẫn ghi được vì sao chặn, thay vì lý do chỉ nằm trong transcript của agent.
- **Bảng Next được bổ sung cạnh mà workflow đã dùng nhưng bảng chưa cho:** `workspace.bind` → `frontend.direction.decide`, `quality.verify`; `quality.verify` → `business.decide` (reconcile), `uat.verify`; `business.decide` → `git.publish`. `quality.verify` đổi `@workspaces/fe` và `@workspaces/be` từ "cả hai bắt buộc" thành "một trong hai" (luật của nó vốn đã nói một delivery, một head). `frontend-with-uat` ràng cả `be`.
