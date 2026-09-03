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

### Grammar (đã publish `@starci/grammar@0.4.1`, FE `main` f7167fa)

- `StaticStateRow` claim `GAP-3 PADDING-4` (trước là `GAP-2 PADDING-2`, lệch CSS); trigger của `SurfaceAccordionCard` chỉ còn `PADDING-4`; `HorizontalScrollRegion` tự mang class `starci-core-horizontal-scroll-region` và claim `PADDING-1 MEASURE-3 OVERFLOW-3 OVERFLOW-5`; `VerticalScrollRegion` claim `MEASURE-7 OVERFLOW-3` ở nhánh cuộn; `SectionHeader` claim `GAP-5` ở gốc và `GAP-2` ở cột copy. **Thay đổi hình nhìn thấy được duy nhất:** gap cột copy của `SectionHeader` từ 0.375rem lên 0.5rem (2px) để về thang đóng. Bốn hàng Gaps tương ứng rút khỏi `family.md`; DNA và bảng "Common already owns" sinh lại. Test gói 33 file / 123 case xanh trước khi publish.

### Resources

- `orchestrator.json#profileEquivalents`: `opus ↔ sol-fresh`, `sonnet ↔ luna`, `fable ↔ sol-reviewer`; processor thiếu runtime của profile ràng thì chạy profile tương đương cùng grants và ghi cả hai vào response. `validate-resources` kiểm đối xứng và khác runtime. Vì thầy chạy Codex mà 7 operator đang ràng profile Claude.

### Workflows / docs / cây

- Năm workflow frontend ràng `workspace.bind fe` với `runtimeNeed: consume` để audit có endpoint (hai phiên thử đều chặn `RUNTIME_UNAVAILABLE` vì preset mặc định `none`).
- `.gitignore` bỏ dòng `sites/` (tàn dư v7) để `sites/docs` và `sites/skills` vào được repo; `docs:check` vào `npm test`; sửa chữ cũ (`context.md`, `execute.md`, "Refs table") trong `resources/INDEX`, `alias/INDEX`.
- `templates/README`: ghi rõ kind `artifact` cố ý không có hợp đồng.

### Luật resources thầy chốt (áp lên cả 14 gói)

- `webSearch: bounded` cho mọi operator; mọi profile được phép tìm mạng có giới hạn (Claude cũng vậy).
- `imageGeneration`: `judged` cho `frontend.direction.decide`, `frontend.presentation.resolve`, `frontend.source.apply`; `required` cho `content.generate`; `never` cho phần còn lại. **Trò để `frontend.surface.audit` là `never`** dù là FE, vì audit chụp màn hình chứ không vẽ; thầy muốn `judged` luôn cho đồng bộ thì nói.
- Phân biệt: `imageGeneration` = **artwork** (digital art do image model của OpenAI sinh); **visualize** bằng HTML (ứng viên, sheet, preview) không phải grant, runtime nào cũng render được. Ghi ở `orchestrator.json#profileEquivalents.imageVersusVisualize`.
- Ràng lại profile về OpenAI vì processor là Codex: `sol-fresh` cho ba operator quyết (business, architecture, direction), `sol-reviewer` cho hai operator quan sát (audit, uat), `luna` cho chín operator thực thi/ghi. Profile Claude giữ làm tương đương (`opus ↔ sol-fresh`, `sonnet ↔ luna`, `fable ↔ sol-reviewer`); chạy bên Claude thì bước hình `judged` ghi "không sinh được" và đi tiếp vì Claude không vẽ.

### Sổ tool (1.0.3)

- `resources/tools.json`: 15 tool thật của hai runtime — `fileread`, `sourcewrite`, `git` (read / commit-session-branch / merge-and-push), `shell`, `websearch`, `imagegen`, `visualize`, `browsercontrol`, `http`, `registry`, `container`, `ci`, `objectstorage`, `secrets`, `database` — mỗi tool có mode và cột `support` theo runtime ghi rõ nền tảng cung cấp bằng gì (Codex `browsercontrol` = computer use mở Chrome của thầy → bắt buộc profile trình duyệt UAT riêng; Claude = Browser pane / Claude in Chrome; `imagegen` chỉ OpenAI).
- `operator.json → resources.tools` (`@tools/<id>: mode`) thay `requires` + `policy`; `grammarBound` giữ. Profile khai `capabilities` (runtime làm được gì) và `permits` (profile được làm gì) theo tool. `validate-resources` kiểm tool có trong sổ, mode hợp lệ, profile cho phép, runtime hỗ trợ; `validate-alias` kiểm tool khai phải được một bước gọi và bước không gọi tool chưa khai. Bảng Steps ghi `@tools/<id>` ngay cạnh alias.
- `uat.verify` đổi profile từ `sol-reviewer` sang `sol-fresh` vì nó ghi worktree UAT (`runs/`, snapshot), còn reviewer theo định nghĩa không được ghi; audit vẫn là `sol-reviewer`.
- `backend.source.apply` có `mode: dry` giống frontend (kế hoạch `mutations.json` với `commit: null`, không ghi cây); `conformance`/`proof` thành Output tuỳ chọn nhưng `validate.mjs` vẫn đòi chúng khi `mode = apply` done.

### Grammar 0.4.2 — `/core` re-export toàn bộ Common (thầy chốt)

- `@starci/grammar/core` giờ `export * from "../common"`: mọi renderer của Common (cùng object) + `CoreGrammarRoot`, token, DNA. Test cũ "Core không re-export component owner" được đảo thành "Core re-export mọi renderer Common". `FE-IMPORTS-7` Case 5 đổi từ "cấm import renderer từ /core" thành "import từ entry family /core hoặc /common; cấm gốc gói và cấm trộn family". Luật cũ đặt ra để một renderer chỉ có một chủ; luật mới giữ một chủ (vẫn là Common) nhưng cho một đường import duy nhất cho family, vì agent (Codex ở nivo) đoán `/core` là hợp lý.

### Gói npm @starci/skills (1.1.0)

- Cây .claude giờ là gói npm `@starci/skills` (repo starci-skills chính là gói; `files` chỉ đóng các đường dẫn runtime + `bin/` + README, không đóng sites/docs/tests/onichan). `bin/starci-skills.mjs` không có dependency, Node 20+: `init` chép cây vào `<repo>/.claude`, viết `CLAUDE.md` (Claude Code) và `AGENTS.md` (Codex) cùng một đoạn bootstrap như backend đang dùng khi chưa có, thêm `.worktrees/sessions/` vào .gitignore, ghi manifest `.claude/.starci-skills.json` (phiên bản + hash từng file); `update` thay các đường dẫn runtime, giữ và liệt kê file thầy sửa tay (`--force` lấy bản gói), không đụng file ngoài runtime; `doctor` chạy đúng chuỗi validator của npm test (trừ docs) trên bản đã cài và báo file lệch so với lúc cài. Spec `scripts/install-cli.spec.mjs` kiểm bốn điều đó và tự skip trong cây đã cài. Docs: trang Install (en/vi) + README gói.
