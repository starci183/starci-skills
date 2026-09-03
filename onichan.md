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

### Vòng test 2 (1.2.0) — 5 ca, 40+ lỗi ghi nhận, những gì đã sửa

Record đầy đủ ở `tests/runs/20260903-r2-*.md`, bảng tổng hợp ở `tests/README.md`. Dưới đây là những gì trò đã thêm hoặc đổi trong cây vì vòng này, và lý do.

**Gate và orchestrator**
- `unquote` trong bốn script gate chỉ bỏ backtick khi ô được quote trọn; trước đó một câu trong bảng Gaps mở đầu bằng code span bị ăn mất một backtick nên không bao giờ khớp `inventory.gaps`.
- `UNKNOWN_STOP` không cần có trong bảng Stops của operator (không operator nào khai nó, nên trước đây nó không thể phát ra); `orchestrator.json#handoff.stop` nói rõ orchestrator là bên đổi mã lạ thành `UNKNOWN_STOP`, giữ mã gốc làm bằng chứng và ghi vào `state.json.substitutions`.
- `response.next` phải nằm trong bảng `## Next` của operator (hoặc `user`/`external`): workflow không được thêm hand-off mà operator không khai.
- `boundProfile`/`ranProfile` vào `response.schema.json` theo cặp; `boundProfile` phải đúng profile `operator.json` ràng. Cả hai vòng đều chạy stand-in mà không ghi được ở đâu.
- `templates/step/state.schema.json` mới; `validate-request` kiểm `state.json` ở mọi nhánh và kiểm liên kết resume: nhánh được resume phải tồn tại, cùng operator, và `state.json.resumes` phải ghi. Trạng thái có thêm `stopped`, `stoppedAt` (cả trường hợp done nhưng rớt validator, `stop: null`), `transitions`.
- `orchestrator.json`: vòng đời `block` nói rõ ba trường hợp `resume | operator | user/external` quay lại chuỗi thế nào; `sourceWrites.policy` miễn cho `mode dry`; `agent.grants` không cấp `sourcewrite`/`git` cho dry; `agent.fills` = `project, runId, lease` là field orchestrator tự điền.
- `validate-workflows`: mọi field Requirements không có Default phải được preset hoặc nằm trong `asks` của nhánh (trừ `agent.fills`); `asks` được sinh từ chính bảng Requirements và ghi vào 8 workflow. Trước đó `validate-defaults` điền chuỗi `placeholder` nên "closed" mà không chạy được.
- Routing: `workspace.bind` domain `runtime` → `platform.operate` (trước là `external`, mâu thuẫn với bảng Next và text resume của chính mã lỗi). Trò đã thử thêm luật "mọi route kind operator phải nằm trong bảng Next" nhưng gỡ ngay: routing là hand-off khi dừng, Next là hand-off khi xong, hai ngữ nghĩa khác nhau (19 route hợp lệ sẽ đỏ).
- Workflows: `runtimeNeed: consume` chỉ còn ở `frontend-with-uat` (UAT cần sản phẩm đang chạy); các chuỗi frontend khác để `frontend.surface.audit` tự dừng `RUNTIME_UNAVAILABLE` → `platform.operate`. Vòng 1 đưa consume lên bước 1 đã khoá toàn bộ chuỗi khi runtime tắt.

**Kinds và operator** (agent làm, trò duyệt; chi tiết lựa chọn hình dạng ở dưới)
- `BA-<n>` bỏ: `mutations.schema.json` đổi `authorityDecisionIds` → `authorityDimensionIds` (kebab, là `dimension` của ma trận bao phủ của head nghiệp vụ đã ràng, kèm fingerprint ma trận). Không kind nào trong cây từng phát hành `BA-<n>`, nên kế hoạch backend không bao giờ trích dẫn được.
- Quyết định kiến trúc (`stack-model.schema.json` + contract + skeleton) có `operations` bắt buộc: mỗi write mà quyết định cam kết (id, transport, writerRef, storeRefs, transactionBoundary, idempotencyKind, migrationRefs, authorityDimensionIds). `backend.source.apply` tiêu thụ nó. Trước đó handoff architecture → backend không typecheck (`CONTRACT_UNFROZEN` ở full-feature). `facets`/`proofKinds` cố ý không đưa vào vì đó là thứ implementation đo, không phải thứ quyết định cam kết. Luật "handoff không nêu file implementation" có ngoại lệ cho writer của operation đã khai.
- `uat.verify`: `requestedBy` chỉ kiểm khi `decided` (nhánh blocked vì thiếu nó phải hợp lệ); hai kiểm admission ra khỏi `if (snapshot)` nên `ADMISSION_MISSING` phát được; custody scan quét cả `response.json`; `runId`/`lease` Default `—` (orchestrator điền); Input `route` bắt buộc từ bind fe và bước 6 chạy vào endpoint của receipt thay vì registry; hàng `@worktrees/_templates` mô tả `flow.md`, `account.json` không chứa secret, `seed/`. Chưa tạo gì dưới `.worktrees`.
- `workspace.bind`: câu luật cho nhánh blocked (`response.json.reason` là toàn bộ hồ sơ); cách suy `mutationReadiness` và không nhận từ request; `gitPolicy` thiếu = `INVALID_INPUT`; hàng Next → `frontend.surface.audit`; `WORKTREE_BRANCH_SESSION_ONLY` trong Findings; bỏ `minRows: 1` ở Write roots (bind read-only có receipt hợp lệ); mô tả cách tính `routeFingerprint`/`identityFingerprint`; `repository.head` của route hydrate chỉ là giá trị lúc hydrate.
- `frontend.presentation.resolve`: `## Removed` có lý do `refused by <RULE> Case n`; bỏ kiểm data-contract cho rule mà mọi node của nó nằm trong Gaps (className trên component Grammar không có chỗ gắn attribute); thông báo lệch Gaps nêu hàng đầu tiên lệch.
- `backend.source.apply`: hàng Next cho dry → `user`; câu dry không được cấp tool ghi (cả frontend.source.apply). `quality.verify`: predecessor dry là `PREDECESSOR_STALE` ở bước 2. `architecture.decide`/`backend.source.apply`: Input tuỳ chọn `model` từ business.decide, khi có thì là thẩm quyền của lần chạy. `business.decide` validate: `model.claimsFingerprint` phải bằng `claims.fingerprint`.
- Knowledge mới `knowledge/ui/presentation/radius.md` (+vi): thang bán kính thật của theme ở head hiện tại là Tailwind v4 `rounded-none|sm|md|lg|xl|2xl|3xl|full` (+`field` của HeroUI); `rounded-small|medium|large` là tên plugin Tailwind 3 và **không sinh CSS** ở head này (19 chỗ đang viết chúng render vuông). Thầy lưu ý điểm này. Chỉ 6 bậc đủ ≥2 nguồn thành rule (RADIUS-2,4,5,6,7,9); `generate-presentation-owned.mjs` chưa có topic RADIUS vì Grammar chưa phát hành claim radius.
- Ngoài cây: `.workspaces/projects/starci-academy/be.json` đã khai `gitPolicy session-only` (commit trên mtp, chưa push).

**Còn để ngỏ** (ghi ở `tests/README.md`): head của `.claude` chưa nằm trong `request.json.contexts` nên sửa cây giữa phiên không bị `SOURCE_DRIFT` bắt; `toleratedDirtRoots` mới là đề xuất; exchange lồng cạnh nhánh song song chưa workflow nào tập; `.worktrees/_templates/uat` và 7 flow còn hình v7; registry runtime báo `ready` khi không gì lắng nghe.

### Gate quét presentation (từ vụ nivo overview)

Một phiên Codex trong `nivo-fe` (`main` `b3f4691`) đã giao ba thứ mà luật cấm sẵn và không cổng nào
bắt được, nên trò dựng cổng cho chúng.

**Ba vi phạm gốc.** `pages/OverviewPage/classNames.ts` chồng `flex-col items-start sm:flex-row
sm:items-end sm:justify-between` lên `SectionHeader`, vốn đã sở hữu display, canh và phần gập qua một
container query. `leaves/PressableInputLike/index.tsx` bơm `h-9 min-h-9 w-64 … rounded-field
border-[var(--field-border)] … shadow-[var(--field-shadow)]` vào một `Button`. Và `rounded-large` nằm
ở 5 chỗ trong `packages/ui`, một tên plugin Tailwind 3 mà head này không sinh CSS, nên góc render
vuông trong khi source đọc như thể đã chọn góc. Thầy bổ sung ca thứ tư: `product-shells/ConsoleTopBar`
dựng lại cả dải top bar bằng div, chỉ import `Text`, còn dải và đường ngăn thì thuộc về
`NavigationFeatureNav`.

**`scripts/sweep-presentation.mjs`** (+ `.spec.mjs`, 10 test, đã nằm trong `node --test scripts/*.spec.mjs`).
Chạy `node scripts/sweep-presentation.mjs <checkout> [--write-set <file>] [--json]`, exit 1 khi có
phát hiện. Bốn mã: `APP_OVERRIDE` (className thò vào một đối tượng Grammar), `APP_REIMPLEMENTATION`
(tiện ích layout đặt lên một đối tượng vốn đã sở hữu hình học), `OFF_SCALE` (giá trị ngoài thang đóng
của topic), `SHELL_GEOMETRY` (product shell tự vẽ dải mà không compose đối tượng shell nào của
Grammar). Điểm trò cố ý làm: **không danh sách nào được gõ tay**. Danh sách đối tượng Grammar và tập
"đã sở hữu hình học" đọc từ bảng `## Renderers` của `grammars/starci/DNA.md` (ai có claim
GAP/PADDING/MARGIN/MEASURE/OVERFLOW là chủ hình học); các thang đọc từ chính bảng `## Scale` của
`gap.md`, `padding.md`, `margin.md`, `radius.md` và `## Width scale` của `measure.md`. Sửa một topic
là cổng đổi theo, không có nhà thứ hai để quên cập nhật.

**Nối vào ba operator.** `frontend.source.apply`: bước 4 (bước tuân thủ) chạy lượt quét qua
`@tools/shell` trên write set đã chiếu, trước khi ghi; mọi phát hiện là `WRITE_REJECTED` (mã cũ, đúng
nghĩa "giá trị lần ghi không được uỷ quyền tạo ra" — không đăng ký mã mới), đầu ra trích vào
`response.md` dưới `## Rejections` và bản ghi `sweep` nằm trong `writes.json` (`writes.schema.json` có
thêm trường ấy; validator đòi nó khi `mode = apply`, kiểm lệnh, kiểm exit code khớp số phát hiện, và
từ chối một phát hiện đi kèm receipt `done`). `quality.verify`: `presentation-sweep` là một gate;
delivery nào mang `frontend-source-application` mà không lên kế hoạch gate ấy là `INVALID_INPUT`.
`frontend.presentation.resolve`: phạm vi là mọi thư mục leaf/branch ứng dụng sở hữu mà write set chạm
tới, không riêng cây của bề mặt đích; và `className` trên một đối tượng Grammar không bao giờ là đích
resolve — nó bị gỡ và ghi dưới `## Removed` kèm case đã từ chối.

**Knowledge.** `FE-FUNCTION-4` Case 5: nửa thuần không được chọn giữa một block nối và Base của nó
(0/150 `component.tsx` ở `starci-academy-fe`; phản ví dụ là OverviewPage:314-317 lặp 4 lần).
`FE-TEST-5` Case 4 thành luật thật (215/272 spec không ghim class) và `FE-TEST-7` mới: phủ sóng tính
theo từng nửa, spec nối không thay được spec thuần và ngược lại. `FE-FOLDER-6` Case 5: hằng triển khai
không sống trong thư mục component (7 lượt `NEXT_PUBLIC_` dưới `src/modules`, 0 dưới `src/components`;
nivo có 3 chỗ trong block). `FE-IMPORTS-7` Case 7 được bổ chứng cứ shell thay vì thêm rule mới.

**Ba chỗ trò phải nói thật, không tô.**
- Số liệu không ủng hộ hai điều thầy nêu như đã thành nếp. "Block/page mới ship cả hai spec": thực
  tế chỉ 28/101 block và 22/49 page có cả hai, nên trò viết `FE-TEST-7` như luật ràng unit mới, có
  đúng số, và ghi 73 block còn lại vào câu hỏi để ngỏ chứ không giả vờ cây đang sạch. "Hằng tiền tệ
  và locale sống dưới `@/modules`": bằng chứng ngược lại — `currency: "VND"` có 8 chỗ trong nửa nối
  dưới `src/components` và 0 chỗ dưới `src/modules`, vì formatter dựng ngay nơi đọc `useLocale()`.
  Trò chỉ luật hoá phần hằng triển khai (bằng chứng sạch 7–0) và để tiền tệ ở câu hỏi để ngỏ.
- `ShellNav` của `starci-academy-fe` — ví dụ sạch mà thầy dẫn — thật ra có 11 export layout/spacing
  trong `classNames.ts`. Điều tách nó khỏi `ConsoleTopBar` không phải "không có class" mà là **có
  compose một đối tượng shell của Grammar**: `ShellNav` compose `NavigationFeatureNav` và chỉ sắp xếp
  nội dung *bên trong slot*, còn `ConsoleTopBar` chỉ import `Text` rồi tự dựng dải. Trò cài
  `SHELL_GEOMETRY` theo lằn ranh ấy, nên nó bắt `ConsoleTopBar` và tha `ShellNav`, `LearnShellLayout`,
  `ConsoleLayout`, `Sidebar`. Nếu cài theo chữ ("mọi tiện ích layout trong thư mục shell là phát
  hiện") thì chính nguồn tham chiếu đỏ 11 chỗ.
- `PressableInputLike` truyền class vào `Button` của **HeroUI**, không phải `Button` của Grammar, nên
  lượt quét bắt nó bằng `OFF_SCALE` (3 token) chứ không phải `APP_OVERRIDE`. Đó là đúng luật hiện
  hành: `FE-IMPORTS-4` Case 3 cho phép leaf dùng vendor. Nếu thầy muốn class trên control vendor cũng
  là `APP_OVERRIDE` thì đó là một luật mới, trò chưa tự viết.

**Nền của lượt quét trên `starci-academy-fe`** (1474 file, gói `@starci/grammar` được loại vì nó là
thẩm quyền chứ không phải bên tiêu thụ): 12 `APP_OVERRIDE`, 1 `APP_REIMPLEMENTATION`, 36
`SHELL_GEOMETRY`, 337 `OFF_SCALE`. Phần `OFF_SCALE` do `p-5` (33), `max-w-full` (24), `gap-5` (23),
`rounded-medium` (14) dẫn đầu. Hai chỗ đáng thầy ngó: `max-w-full` không nằm trên thang cap của
`measure.md` nên bị báo — có thể thang cần một bậc "không cap", hoặc 24 chỗ kia cần sửa; và
`SHELL_GEOMETRY` bắt cả `CoursePricingRail`/`IdentityRail` là block chứ không phải shell, vì luật
nhận diện theo hậu tố tên thư mục ("…Rail") như thầy khai. Cả hai đều là quyết định của thầy, trò
không tự nới.

**Câu hỏi để ngỏ (chưa luật hoá, chờ thầy chốt).** `data-contract` do ứng dụng tự phát: khi nào một
node do ứng dụng sở hữu được tự viết token `data-contract`, và ai đối chiếu nó — `frontend.presentation.resolve`
đang là bên duy nhất phát token ấy (`contractEmission`), nhưng nivo có node ứng dụng tự gõ tay. Trò
không đụng vào vì thầy chưa quyết. `knowledge/ui/presentation/INDEX.md` không có mục open-questions
nên ghi ở đây.

**Bổ sung sau hai phán quyết của thầy trong cùng phiên.**
- Thầy chốt: text của rule và Case phải **không dính sản phẩm** (Skills đang chuẩn hoá cho bất kỳ ai
  cài). Trò đã viết lại mọi Case trò thêm hôm nay theo hình dạng thay vì theo tên: `FE-FUNCTION-4`
  Case 5 nói `props.data === null ? <X /> : <XBase {...props.data} />`; `FE-FOLDER-6` Case 5 nói
  "hằng triển khai" chứ không kể tên block; `FE-IMPORTS-7` Case 7 nói phép thử là "có compose một
  đối tượng shell của Grammar hay không", Case 9 (mới) nói dải được mount trong route layout, ngang
  hàng phía trên page, còn `WorkspaceShell.header` là hero tầng page. Tên đối tượng Grammar được giữ
  vì đó là API công khai của gói. Toàn bộ số liệu cụ thể (repo, file:line, count) dời sang
  `tests/evidence/20260903-presentation-sweep.md` và ở lại đây. Comment fixture trong
  `scripts/sweep-presentation.spec.mjs` cũng đã bỏ tên sản phẩm.
- `FE-IMPORTS-7` Case 9 và lượt quét: `WorkspaceShell` bọc slot `header` trong `<header>` của nó
  (`WorkspaceShell/index.tsx:52`) còn `NavigationFeatureNav` vốn đã là `<header>`
  (`NavigationFeatureNav/index.tsx:53`), nên lồng vào nhau ra hai banner. Sweep giờ báo
  `SHELL_GEOMETRY` khi một phần tử JSX tên `NavigationFeatureNav`, hay một adapter có tên kết thúc
  bằng `Nav`/`TopBar`, đứng làm giá trị của prop `header=` trên `WorkspaceShell`. Đã thử trên file
  thật của sản phẩm thứ hai: bắt đúng một phát hiện; adapter shell của sản phẩm tham chiếu (không
  truyền `header`) vẫn sạch.
- Thầy chốt: runtime chỉ đọc file tiếng Anh. Trò đã rà `scripts/`, `docs/scripts/`,
  `sites/skills/scripts/`, `alias/alias.json`, `routing.json`, `resources/*.json`: **không có chỗ nào
  nạp `.vi.md` làm thẩm quyền**, và không có gì trò thêm hôm nay đọc `.vi.md`
  (`sweep-presentation.mjs` đọc đúng `knowledge/ui/presentation/{gap,padding,margin,measure,radius}.md`
  và `knowledge/grammars/starci/DNA.md`). Chỗ duy nhất `.vi.md` bị *đọc* là các generator ghi ra
  chính bản mirror (`generate-alias-doc`, `generate-operators-index`, `generate-grammar-dna`,
  `generate-presentation-owned`) và các validator đối chiếu mirror có trôi khỏi bản Anh hay không
  (`validate-operator.mjs`, `validate-alias.mjs`). Trò **không gỡ** hai validator ấy: chúng không lấy
  thẩm quyền từ `.vi.md`, chúng chỉ chứng minh mirror khớp bản Anh, và gỡ đi là mất cổng chống trôi.
  Nhưng câu "`.vi.md` không bao giờ vào ... validator input" ở `INDEX.md` đang nói quá so với thực tế
  ấy — thầy quyết: hoặc nới câu đó, hoặc trò gỡ cổng parity.
- Còn một chỗ trò cố ý không đụng: `knowledge/patterns/fe/INDEX.md` và dòng `Sources:` của
  `folder.md` vẫn nêu tên repo và cả đường dẫn Windows tuyệt đối. Chúng có từ trước phiên này và là
  phần khai xuất xứ của cả nhóm `patterns/fe`, không phải text của rule; sửa là phải làm lại mô hình
  xuất xứ của cả nhóm. Trò để nguyên và báo.
