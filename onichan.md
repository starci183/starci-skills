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

### Session-first (từ phiên Codex nivo overview)

Thầy hỏi vì sao không có gì cho thầy xem phương án đã trực quan hoá, ảnh chụp kèm phê phán, hay luồng
UAT. Trò đi kiểm và câu trả lời gọn hơn trò tưởng: **chưa từng có phiên nào.**
`.worktrees/sessions/20260903-nivo-overview-core042/` chỉ có một thư mục `checkout` — mà thư mục ấy
còn không phải worktree của repo được route: nó chứa `apps/` với `node_modules/`, và
`git rev-parse --show-toplevel` từ trong đó rơi về chính repo Source. Không `state.json`, không
`step-N/parallel-M`, không request, không response, không `coverage.json`, không `<candidateId>.html`,
không `captures/`, không `verdicts.json`, không `<matrixId>.png`, không gì thuộc `uat/`. Nhánh
`session/20260903-nivo-overview-core042` cũng không còn trong `nivo-fe`, trong khi hai phiên anh em
cùng ngày vẫn là worktree thật trên nhánh thật.

Rollout (13.148.356 byte) cho thấy agent **không hề thiếu thông tin**: `20260903-nivo-overview-core042`
300 lần, `response.json` 182, `request.json` 181, `operator.md` 145, `sessionId` 135,
`frontend.direction.decide` 86, `state.json` 53, `validate-request`/`validate-response` 22/22,
`candidateId` 8, `@tools/visualize` 4 — rồi `step-1/parallel-1` đúng 5 lần, validator chạy 0 lần,
trang phương án render 0, và `git commit` 1. Nó tường thuật runtime rồi làm việc bên cạnh runtime.

**Vì sao không cổng nào kêu.** Cả bốn validator đều nhận một thư mục nhánh làm tham số. Không có nhánh
thì không có gì để chỉ chúng vào; chúng báo được request *sai*, không báo được request *thiếu*. Còn
luật của `git.publish` cho tới hôm nay chỉ nói về lần publish — boundary, phê duyệt, hook, mode, head,
tag, dọn dẹp — không một dòng nào hỏi nhánh nó đang merge có từng được cái gì sinh ra. Và câu trong
`orchestrator.json` (`create: the orchestrator writes state.json …`) là **mô tả việc orchestrator
làm**, không phải **tiền điều kiện lên việc agent được phép làm**. Bỏ qua câu ấy không phá vỡ thứ gì
đo được. Zero phát hiện trong khi việc sai hoàn toàn — đúng cái hình dạng thầy vẫn bảo là đáng ngờ.

**Trò đã vá, bằng luật có mã đứng sau, không phải bằng lời khuyên.**

- **Phiên là hành động đầu tiên** (`SKILL.md` Chuẩn bị bước 4, `orchestrator.json`
  `session.lifecycle.create`): trước khi bất kỳ file nào ngoài thư mục phiên bị đọc để sửa hay bị ghi,
  `state.json` và `step-1/parallel-1/request/request.json` đã có và `validate-request` xanh. Và trò
  đưa đúng một câu vào **bootstrap** mà `bin/starci-skills.mjs` ghi ra `CLAUDE.md`/`AGENTS.md` —
  *Nothing is designed, written or committed outside a session: the first act of a mission is the
  session folder and a validated request.json* — vì đó là chữ đầu tiên mọi agent đọc, kể cả agent
  không bao giờ mở tới `orchestrator.json`. `scripts/install-cli.spec.mjs` ghim câu ấy lại.
- **`SESSION_MISSING`** (`operators/errors.json`): scope `backend.source.apply`,
  `frontend.source.apply`, `git.publish`; domain `caller`, `terminate`, route về `user`. Có mặt trong
  bảng Dừng và dòng Bước của cả ba, và trong `operators/INDEX.md` sinh ra.
- **`git.publish` không merge một nhánh vô thừa nhận** (bước 6 + `validate.mjs` + self-test): phiên
  phải còn trên đĩa, phải có một nhánh `frontend.source.apply`/`backend.source.apply` `done` mà
  `commits` chứa head đem publish, và khi `state.json` nói chuỗi có khai bước `frontend.surface.audit`
  hoặc `uat.verify` thì nhánh ấy phải `done` với artifact `screenshot` còn nguyên. 6 nhánh hợp lệ, 30
  đột biến bị bác.
- **Phương án phải nhìn được** (`frontend.direction.decide`): dưới `new` và `reconstruct`, mọi phương
  án hình thành đều render thành `response/artifacts/<candidateId>.html`, bất kể `preview`; số trang
  phải bằng số phương án. `refine` giữ nguyên trang tuỳ chọn. Không tốn gì: đó là `@tools/visualize`,
  không cần cấp quyền, mọi runtime đều làm được.
- **Mọi ví dụ workflow thành dòng dài**: `apply` → `workspace.bind` (fe, `runtimeNeed: consume`) →
  `audit` → `quality` → `uat` → `publish`, cho `frontend-refine`, `frontend-reconstruct`,
  `frontend-new-surface`, `frontend-with-uat`, `full-feature`; `validate-workflows.mjs` từ chối một
  chuỗi publish bề mặt đã apply mà thiếu một trong hai bằng chứng. `backend-feature` không có chúng và
  `when` của nó nay nói rõ vì sao (nó không ghi bề mặt; `uat.verify` cần đầu vào
  `frontend-surface-audit` và một route fe đã bind). `runtimeNeed: consume` dời từ bậc 1 của
  `frontend-with-uat` xuống lần bind sau apply của cả năm chuỗi — bề mặt cần phục vụ là bề mặt mà lần
  ghi vừa sinh ra, không phải bề mặt đã bind trước đó.
- **Nói thẳng khi nào UAT chạy** (`docs/getting-started.mdx` +vi, `tests/README.md`): chỉ trong
  workflow có bước `uat.verify`, và chỉ khi đã có người yêu cầu đích danh, thư mục
  `uat/<flow>/{flow.md,account.json,seed/}`, mật khẩu dùng chung đã niêm, và cả hai giấy thông hành
  lấy tại commit đã ghim. Thiếu cái nào cũng là một lần dừng có mã, để sự vắng mặt đọc ra được.

**Bản ghi**: `tests/runs/20260903-r2-codex-overview-nonconformance.md` (+vi), thêm một dòng vào bảng
vòng 2 của `tests/README.md`. Ba vi phạm gốc thì trùng đúng ba cái thầy đã ghi ở mục "Gate quét
presentation" bên trên — nghĩa là `sweep-presentation.mjs` **sẽ** bắt được cả bốn; nó chỉ không bao
giờ chạy, vì operator chạy nó không bao giờ chạy.

**Còn mở, trò báo chứ không tự quyết**: session-first vẫn là kỷ luật mà bootstrap phát biểu và cổng
publish bắt được *về sau*. Không gì chặn được khoảnh khắc một agent mở editor lên checkout được route.
Nếu thầy muốn chặn ngay tại đó thì phải là một hook bên ngoài cây (pre-commit trên checkout được
route, từ chối commit khi không có phiên nào đang giữ lease) — trò chưa làm, vì nó nằm ngoài
`.claude` và là quyết định của thầy.

### Lens thẩm mỹ (taste) trong audit

Thầy chốt: một bề mặt đúng ngữ pháp mà nhìn xấu thì vẫn vứt. Trò nối `knowledge/ui/proof/taste.md`
(TASTE-1..13) vào đúng chỗ nó có răng, chứ không để nó nằm làm một topic ai đọc thì đọc.

- **`frontend.surface.audit` bậc 6 nay phát hai lens trên cùng một bộ chụp.** Lens canon giữ nguyên;
  lens thẩm mỹ chấm đủ mười hai tiêu chí `TASTE-1..12` cho **mỗi mục ma trận**, mỗi tiêu chí một phép
  đo, một điểm 1..5, một phán quyết và một `routeTo`. `validate.mjs` bắt: thiếu một tiêu chí là hỏng;
  trung bình và `ship`/`fix-first` phải là thứ `TASTE-13` **tính ra**, không phải thứ được khai; một
  tiêu chí hỏng chỉ được đi về `direction`, không bao giờ về `resolve` — đổi một giá trị không vá được
  một bố cục.
- **Biên nhận có mục `## Taste`** (`| Rule | Measured | Score | Verdict |`, rồi dòng `- Mean:` và
  `- Verdict:`), xếp ngay sau `## Verdicts by owner`. Biên nhận publish lens đã **gộp** qua các mục:
  điểm thấp nhất và phán quyết hỏng thắng, vì một bề mặt chỉ tốt bằng viewport tệ nhất đã chụp.
- **`fix-first` chặn cổng.** `response.json.next` phải gọi tên `frontend.direction.decide`, và
  **không được** gọi `quality.verify` — các cổng của chính checkout chỉ chạy sau một `ship`. Đây là
  chỗ `TASTE-13` Case 3 có hiệu lực thật: canon xanh toàn tập vẫn có thể `fix-first`.
- **Vòng lặp mới trong cả năm workflow frontend**: `frontend.surface.audit → frontend.direction.decide`,
  `maxRounds: 2`, when là "taste fix-first". Vòng cũ về `frontend.presentation.resolve` giữ nguyên.
- **`frontend.direction.decide` nay phải nêu chuẩn tham chiếu theo lớp.** `## References` đổi thành
  `| Standard | Class | URL | What is borrowed | Limitation |` — trò **giữ** `URL` và `Limitation` chứ
  không xoá, vì luật nghiên cứu có giới hạn (mỗi tham chiếu ghi URL và đúng giới hạn nó mang) là luật
  đã publish và không có nhà nào khác. `new`/`reconstruct` phải có ít nhất một dòng; `refine` vẫn
  không dòng nào. Không có dòng nào dưới `new`/`reconstruct` **không phải** `INVALID_INPUT`: đó là lỗi
  của chính operator, nên trò đăng ký `REFERENCE_MISSING` (domain `self`, terminate) trong
  `operators/frontend-direction-decide/errors.json`, có mặt ở bậc 6 và trong bảng Dừng.
- **Self-test**: audit 3 nhánh hợp lệ / 30 đột biến bị bác (thêm ship, fix-first, thiếu tiêu chí, sai
  số học, hỏng mà đi về resolve, fix-first mà next là `quality.verify`, biên nhận giấu một cái hỏng);
  direction 6 nhánh hợp lệ / 30 đột biến (thêm nhánh dừng `REFERENCE_MISSING`, reconstruct không nêu
  chuẩn, chuẩn không có lớp).

**Trò báo, không tự quyết**: `tests/runs/` không có tài liệu nào thuộc kind `frontend-surface-audit`
(`validate-templates` chỉ nhận `knowledge/**`, `operators/*/operator.md` và skeleton của từng kind), nên
không bản ghi nào cần thêm `## Taste` để giữ xanh. Bản ghi audit thật duy nhất ở đó,
`20260903-r3-starci-dashboard-subscriptions-audit.md`, là văn xuôi tự do có bảng riêng và chạy trước khi
lens được publish; trò không viết điểm ngược vào nó. Nếu thầy muốn nó mang lens, trò chấm lại từ chính
ảnh chụp đã lưu trong `tests/evidence/`.

### Pass gom 1.5.0

Thầy chốt: đo bằng **số nhà trên một khái niệm**, không đo bằng số dòng. Trò đếm trước rồi mới sửa,
và bảng trước/sau đầy đủ nằm ở `tests/evidence/20260903-consolidation.md`. Tổng: 44 nhà xuống còn 19
trên các khái niệm hôm nay chạm tới, mười một id và một file nghỉ hẳn, không id nào bị đánh số lại.

**Chuẩn cập nhật, viết trung lập.** `UPDATE.md` (+ `UPDATE.vi.md`) ở gốc cây, không nêu StarCi, sản
phẩm hay lịch sử nào; chỉ dòng phả hệ nói chuẩn được đúc ra từ việc vận hành một cây. Bốn câu hỏi theo
thứ tự (đã bị cấm chưa → sửa cổng; chưa có nhà → một rule, chỉ hình dạng; rule sai hay hẹp → sửa Case
và giữ id; hai nhà → gom, bên kia trích dẫn), được thêm gì và không được thêm gì, sửa và cho nghỉ một
id thế nào, mức bằng chứng ≥2 lần, luật ngôn ngữ, cưỡng chế trước lời khuyên, file nào sinh ra và bằng
lệnh gì, patch/minor/major nghĩa là gì, và danh mục kiểm trước khi commit có mục "đếm số nhà". Được
nối vào `INDEX.md` như mục 0 của thứ tự nạp và được `docs/contributing.mdx` trích chứ không chép lại.

**Gom nhà.** Bốn vụ chính:
- Hình học shell: `FE-IMPORTS-7` Case 9 gộp vào Case 7; comment của `sweep-presentation.mjs` thành
  câu trích; và cổng nay **đọc danh sách tên đơn vị shell ra từ chính Case 7** thay vì gõ cứng, nên
  sửa rule là cổng đổi theo.
- Spec theo cặp: `FE-TEST-7` nghỉ, gộp vào `FE-TEST-1` Case 7. Hai Case "không thay được nhau" của nó
  vốn chỉ nhắc lại `FE-TEST-2` Case 4 và `FE-TEST-3` Case 3, nay là trích dẫn.
- Ngưỡng theo lớp bề mặt: mật độ về `TASTE-9`, số accent về `TASTE-5`, độ sâu điều hướng về `UX-5`,
  ngân sách bước về `UX-2`, kích thước mục tiêu về `A11Y-4`. Đây là chỗ trò tìm ra một **mâu thuẫn
  thật**: `TASTE-5` nói "đúng một accent" còn `UI-9` cho landing hai cái — đúng cái hình dạng hai nhà
  rồi trôi khỏi nhau mà thầy vẫn cảnh báo.
- Số liệu khảo sát (49/49, 215/272, 28/101…) và tên sản phẩm rời khỏi text của Case, sang
  `tests/evidence/`.

**Bỏ tầng id thứ hai (thầy chốt giữa chừng).** `knowledge/ui/proof/ui.md` với `UI-1..UI-11` đã nghỉ
hẳn — một file mà toàn bộ nội dung là trỏ sang file khác thì chỉ thêm địa chỉ chứ không thêm quyết
định. Thay vào đó mỗi topic proof tự đóng lại bằng rule verdict của chính nó: `TASTE-13` và `UX-12` đã
có sẵn, trò thêm `A11Y-5`, `FOCUS-6`, `CONTRAST-1` (ban đầu lỡ đặt là COLOR-6 theo tiền tố đã nghỉ; đã sửa), `MOTION-5`, `TRUTH-5`, cùng một hình dạng (tập chặn
cửa, ngưỡng, verdict, đường đi). Bộ từ vựng lớp bề mặt rút về năm tên — `console`, `form`, `landing`,
`catalog`, `reader` — và sống ở `COVERAGE-1` Case 7, **không mang con số nào**. Mỗi `UI-n` cũ nay tra
về đúng rule đã sống sót thay nó; bảng ánh xạ ở file bằng chứng. Đếm rule ui: 159 → 153 (proof 55 →
49).

**"ĐẠT CHƯA" thành hợp đồng biên nhận, không thành rule.** Bảng `## Verdict` một hàng mỗi topic
(`| Topic | Verdict | Route |`) có mặt ở cả ba biên nhận: audit đóng tám topic, uat đóng `experience`,
còn `quality.verify` chép cả chín và viết đúng một dòng `Verdict: ship | fix-first | blocked` — thiếu
hàng hay `blocked` thì `blocked`; có `fail`/`fix-first` thì `fix-first` kèm tên hàng và đường đi; còn
lại là `ship`. Không trung bình qua các hàng, không chấm lại. Validator của cả ba kiểm bản chép có
trung thực không: audit đối chiếu từng hàng với kết quả của chính topic ấy, uat đối chiếu hàng
`experience` với lens, quality kiểm dòng cuối tính đúng từ các hàng và một topic `blocked` thì không
được có chủ để đẩy về.

**Còn lại của phần nối dây.** `uat.verify` mang bộ điểm `UX-1..UX-11` trong biên nhận (mục
`## Experience` + `- Mean`/`- Verdict`), lane `ux` phải khớp verdict mà `UX-12` tính; audit khai lớp bề
mặt trong `## Surface class` và dừng `SURFACE_CLASS_MISSING` (domain `direction`, route mới về
`frontend.direction.decide`) khi coverage không khai; `@worktrees/_templates` nói rõ phần uat nằm ở
`templates/uat/` mà gói ship sẵn; `knowledge/ui/INDEX.md` ghi `ux.md` còn được `uat.verify` đọc.

**`@tools/host` (thầy thêm, là cổng chứ không phải rule).** Phục vụ một thư mục HTML tĩnh trên
loopback, mode `loopback`, thử cổng từ **60000** lên tới 60100, ghi URL/port/folder/pid vào
`response/artifacts/host.json`, dừng khi nhánh kết thúc hoặc resume, không bao giờ bind `0.0.0.0`. Hai
runtime đều hỗ trợ qua shell (Claude thêm preview). Khai ở `frontend.direction.decide` (bậc 9 phục vụ
ứng viên **một lần cho mỗi viewport của coverage**, để thầy thấy 1280 và 390 trước khi quyết) và ở
`frontend.surface.audit` (phục vụ bảng chụp). Không rule mới; tính đáp ứng được kiểm hai lần thì ghi
đúng một chỗ, ở `RESPONSIVE-4` Case 6.

**Một cổng phải nới.** `validate-knowledge-citations.mjs`: một dòng nói "retired/đã nghỉ" nay được
phép nêu cả một **tiền tố** không còn file nào publish, không chỉ những con số. Không nới thì không
ghi nổi việc `UI-` đã nghỉ.

**Trò báo, không tự quyết.** `knowledge/patterns/**` vẫn nêu đường dẫn nguồn tương đối và số đếm: đó
là chính mô hình xuất xứ của nhóm ấy, cổng trích dẫn dựng trên nó, và `contributing` phát biểu nó.
Trò chỉ dời số liệu ra khỏi những Case thêm hôm nay. Phần còn lại — tên repo và đường dẫn Windows
tuyệt đối trong `patterns/fe/INDEX.md` và dòng `Sources:` của `folder.md` — vẫn là việc phải làm lại
mô hình xuất xứ cho cả nhóm, không phải sửa một Case; trò để nguyên và báo lần nữa.

### UAT tự cấp tài khoản (từ phiên mù AgentOS)

**Chỗ hỏng.** Một phiên dừng `RUNTIME_UNAVAILABLE` vì route console nằm sau một guard phía client, với
lý do "không operator nào tạo được danh tính hay nhập được thông tin đăng nhập", và `platform.operate`
"cũng không đúc được danh tính". Cả hai câu đều là khoảng trống thi hành chứ không phải sự thật: một
route trả về màn hình đăng nhập là đang phục vụ, và thứ còn thiếu là một danh tính — thứ runtime có.

**Luật thầy đặt, trò đã đóng đinh vào cây.** Trong UAT, hồ sơ thiếu thì **tạo ra**, không báo lỗi. Mỗi
luồng có tài khoản riêng; mật khẩu UAT dùng chung niêm phong một lần cho mỗi môi trường tại
`.stacks/<env>/secrets/*.enc` dưới master identity; giá trị chỉ đi vào body của một lời gọi quản trị
hoặc ô của một form trong trình duyệt, không bao giờ vào file, ảnh chụp, log hay biên nhận.

**Ai sở hữu gì.** `platform.operate` nhận thêm hai nhánh — `runtime` (`register-runtime-entry`,
`attest-runtime-entry`) và `identity` (`provision-identity`, `seed-flow-fixtures`) — mỗi nhánh có tập
effect, tập check và capability đóng của riêng nó, nên một lần chứng thực không bị bắt chứng minh một
tài khoản, và một lần cấp tài khoản không được báo cáo bằng cách ping một cổng. Nhánh `runtime` chứng
thực một tiến trình **đang chạy** đúng như nó đang là: không khởi động lại, vì khởi động lại để được
phép mô tả sẽ phá đúng trạng thái mà bước sau định kiểm.

**Sổ đăng ký giờ theo từng route.** `runtimes: { "<project>/<role>": { endpoints, head, generation,
status, healthEvidenceRefs, identity } }`. Hình dạng một-khối cũ còn đọc thêm một release, như entry
của route mà nó nêu tên. `workspace.bind` đọc entry của chính route mình và ghi lại khoá entry ấy —
đó là thứ khiến "một máy nhiều sản phẩm, sổ chỉ trả lời cho một" lộ ra thay vì chỉ dễ xảy ra.

**Mã mới.** `IDENTITY_MISSING` (domain `platform`, phạm vi `frontend.surface.audit` + `uat.verify`) là
một lần **bàn giao** chứ không phải phán quyết: luồng chưa có tài khoản thì `platform.operate` cấp,
rồi nhánh chạy lại. `PROVISIONING_UNAVAILABLE` dời sang sổ chung với hai chủ, và chỉ dành cho phụ
thuộc **không tới được**. Route có cổng canh không còn là `RUNTIME_UNAVAILABLE` nữa.

**Thư mục luồng có một hình dạng, và nó được thi hành.** `flow.md` (mục tiêu, vai, tiền đề, ngân sách,
bảng bước có cột `as`), `accounts.<env>.json` (một tài khoản cho mỗi alias, theo môi trường),
`seed/`, `snapshots/` (bản chuẩn, chỉ người nâng), `runs/<runId>/` chỉ-thêm với
`runId = <yyyymmdd-HHMMss>-<commit7>`, `latest.json` (một file, không phải symlink) và `history.md`.
Validator kiểm: dạng runId khớp commit, alias mỗi case có tài khoản, môi trường của golden khớp môi
trường của lượt chạy, luồng phác thì golden phải là ứng viên, con trỏ và lịch sử đúng chỗ, và quét mật
khẩu trên **toàn bộ** thư mục luồng chứ không chỉ bốn file nhánh publish.

**Repo chủ theo dõi `.worktrees/uat/`.** Không phải một repo riêng. Trò phát hiện `.gitignore` của
`.claude` có dòng `runtime/` không neo, và nó đã nuốt luôn `readiness/initialization/runtime/` — đúng
cái bẫy thầy nói: một dòng ignore biến hồ sơ thành file cục bộ không ai đọc. Đã neo về gốc, và
validator của `uat.verify` nay từ chối một thư mục luồng bị ignore, nêu đích danh dòng ấy.

**Một nới quyền, trò báo chứ không tự quyết.** `platform.operate` chạy profile `luna`, mà `luna` và
`sonnet` đều `permits.browsercontrol: false`. Cấp tài khoản qua form đăng ký của sản phẩm cần một
trình duyệt, nên trò bật `permits` cho hai profile ấy (`capabilities` vốn đã true). Grant vẫn theo
`operator.json`, nên không operator nào khác rộng thêm — nhưng đây là chính sách profile, thầy xem lại
giúp trò.

**Môi trường là một trường, và bộ từ vựng là thư mục.** `uat.verify`, `frontend.surface.audit` và
`platform.operate` nhận `env` (mặc định `dev`). Nó chọn `accounts.<env>.json`, bí mật niêm phong
`.stacks/<env>/secrets/*.enc`, entry runtime của môi trường ấy, đích của seed và `snapshots/` đã duyệt.
Tên hợp lệ đọc từ `.stacks/`, không liệt kê cứng ở đâu cả — một bản cài đặt cạnh bộ stack khác phải
chấp nhận bộ ấy — và một `env` không ứng với thư mục nào bị từ chối ngay ở cổng, nêu đích danh
`.stacks/<env>` còn thiếu. Luật này có đúng một nhà: `missingStack()` trong `validate-request.mjs`,
ba validator gọi nó.

**Ví dụ mới `staging-uat`.** bind ×2 (fe consume) → direction → resolve → apply (`mode: dry`, nên luật
dòng dài không với tới) → audit (`env: staging`) → quality → uat (`env: staging`, hỏi `requestedBy`,
`feature`, `flow`), kết thúc ở `user`: hai biên nhận trong tay thầy mới là kết quả, còn đưa lên một môi
trường vẫn là việc của `release`. Trò không preset `env` lên `workspace.bind` vì operator ấy không khai
trường đó — route chọn theo project/role, không theo môi trường — và cổng workflow sẽ bác một preset
cho trường không tồn tại; nếu thầy muốn bind cũng theo môi trường thì đó là một thay đổi riêng, thầy
gật là trò làm.
