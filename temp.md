# temp — chốt kiến trúc operator v8 (bản làm việc, xóa khi xong)

Bản này gom toàn bộ ý tưởng đã bàn thành một chỗ để thầy phản biện từng phần. Phần A là khung chung,
phần B đi từng operator theo thứ tự chain; mỗi operator chỉ được đóng dấu "chốt" sau khi thầy gật.

## A. Khung chung

### A1. Ba loại nội dung, ba nơi

| Loại | Ví dụ | Nằm ở | Kiểu hóa bởi |
| --- | --- | --- | --- |
| Chữ cho người và AI đọc | request, response, changes, critique, decision | `*.md` | `templates/kinds/<kind>.template.md` (template-contract, parser hiện có) |
| Dữ liệu máy, chính xác đến ký tự | fingerprint, inventory class, số đo capture, coverage matrix | `data/<name>.json` | `templates/kinds/<kind>.schema.json` (JSON Schema) |
| Artifact không phải chữ | `<candidateId>.html`, `<target>.resolved.tsx`, ảnh capture | `artifacts/` | chỉ kiểm tồn tại và có được trỏ tới |

JSON không kể chuyện, markdown không chứa số cần so từng bit. Gate hai đầu là JSON vì gate là thứ máy đọc.

### A2. Một phiên, một bước, một nhánh (CHỐT 2026-09-03 theo lệnh thầy)

```text
.worktrees/sessions/<sessionId>/
├─ state.json                    chain [["1/1"],["2/1","2/2"]], steps {"N/M": operatorId}, current, leases, requestHashes
└─ step-N/                       N = vị trí trong chain
   └─ parallel-M/                M = nhánh song song (≤3); parallel-1 luôn có
      ├─ request/
      │  └─ request.json         GATE VÀO, orchestrator ghi: operatorId, step, parallel, contexts, requirements, inputs, resume
      ├─ response/               agent ghi, và chỉ ghi ở đây
      │  ├─ response.json        GATE RA: status done|blocked|waiting, stop, awaiting, fallbacks, fields, commits, next
      │  ├─ response.md          kind md chính; kind md khác (changes.md, …) nằm cạnh
      │  ├─ data/                json máy, có schema
      │  └─ artifacts/           html, tsx, png; chỉ kiểm tồn tại
      └─ <exchange>/             cuộc trao đổi lồng (vd critique): request/request.json + response/…, agent mới ghi
```

Không có `request.md`: đề bài cho agent render lúc chạy từ `request.json` + `operator.md`, không lưu.
Đường dẫn trong `request.json.inputs` tính từ gốc phiên (`step-1/parallel-1/response/response.md`), do
orchestrator ghi tường minh; trong `response.json.fields` và bảng Outputs tính từ nhánh (`response/response.md`,
`critique/response/critique.md`). Song song: hai nhánh cùng N chỉ chạy đồng thời khi Writes không chạm chung alias.
`waiting`: nhánh tạm ngưng, orchestrator chạy cuộc trao đổi lồng rồi resume cùng agent; nhánh khác vẫn chạy.
Resume sau `blocked` là nhánh mới `step-(N+1)/parallel-1`, nhánh bị chặn giữ làm bằng chứng. Xóa cả phiên khi
`git.publish` done.

### A3. Một operator = `operator.md` (+ `.vi.md`)

```text
# <operator.id>
## Job            một câu
## <luật>         mục tự do bằng văn xuôi
## Context        | Alias | Bind | Required |          tĩnh, lấy từ alias/INDEX.md
## Inputs         | Kind | From | Required |           động, kind = tên trong templates/kinds
## Requirements   | Field | Type | Default | Ask |     người nhập; Default — = bắt buộc
## Steps          | # | Step | Params | Reads | Writes | Stops with |   Params = field bước này đọc
## Outputs        | Kind | File | Type | Required |    file tính từ nhánh: response/…, <exchange>/response/…
## Stops          | Code | Disposition |               nghĩa và xử lý nằm ở errors/
## Next           | When | Operator |
```

Gói 6 file: `operator.md`, `operator.vi.md`, `operator.json` (id, domain, resources), `errors.json` (mã riêng),
`validate.mjs` (gọi `scripts/validate-step.mjs` rồi luật riêng), `self-test.mjs`.

### A4. Gate chung (`templates/step/`)

`request.schema.json`: `operatorId`, `step`, `parallel`, `sessionId`, `exchange?`, `contexts[{alias, head}]`,
`requirements{}`, `inputs{kind → đường dẫn từ gốc phiên}`, `resume`.
`response.schema.json`: `operatorId`, `step`, `parallel`, `exchange?`, `status`, `stop` (khi blocked),
`awaiting{exchange, kind}` (khi waiting), `fallbacks[]`, `fields{kind → đường dẫn từ nhánh}`, `commits[]`, `next[]`.

### A5. Hợp đồng kind và ba script kiểm

`templates/kinds/<kind>.contract.json` là hợp đồng JSON thuần (kiểm bằng `contract.schema.json`): regex tiêu đề,
mục theo thứ tự, header bảng, `minRows`/`exactRows`/`rows`/`cell`. `<kind>.skeleton.md` là bộ xương để chép và
**tự nó phải qua hợp đồng** trong `npm test`. Kind máy: `<kind>.schema.json`.

| Script | Chạy khi | Kiểm |
| --- | --- | --- |
| `validate-request.mjs <nhánh>` | trước khi spawn agent | gate; requirement ⊆ bảng Requirements, field bắt buộc có giá trị; input bắt buộc có và tồn tại; hash khớp `state.json` |
| `validate-response.mjs <nhánh>` | sau khi agent phát `response.json` | gate; mỗi Output có khi bắt buộc, md qua contract, data qua schema, artifact tồn tại; stop/fallback đúng disposition sau `unless`; `waiting` trỏ exchange đã khai |
| `validate-step.mjs <nhánh>` | self-test, audit | hai cái trên + mọi cuộc trao đổi lồng |

Cổng cây (`npm test`): `validate-operator` đối chiếu Params↔Requirements, Steps↔Stops↔errors, Writes↔Outputs↔kinds,
exchange↔bước `waiting`, en↔vi; `validate-alias` đọc bảng Context; `generate-operators-index` đọc Inputs/Outputs/Steps.

### A6. `errors/` — sổ mã dừng, một nơi

```text
errors/
├─ errors.json          mã dùng chung: code → { scope[], domain, disposition, meaning, fallback?, unless?, resume? }
│  (mã riêng một operator: operators/<id>/errors.json, cùng hình, không scope)
└─ INDEX.md (+vi)       sinh từ errors.json, bảng cho người đọc
```

Một mã có đúng một trong hai disposition:

| Disposition | Nghĩa | Khi nào |
| --- | --- | --- |
| `terminate` | dừng ngay, `response.json.status = blocked`, `stop = <code>`, không Output nào được coi là done | thiếu bằng chứng, mâu thuẫn, head trôi, không còn phương án |
| `fallback` | không dừng; làm đúng hành động ghi trong `fallback`, ghi lại trong `response.md` mục "Fallbacks taken", chạy tiếp | có một lựa chọn máy làm được và ghi được lý do |

`scope` là mảng id operator hoặc `["*"]` cho mã dùng chung (nằm ở `errors/errors.json`); mã chỉ một operator phát nằm trong `operators/<id>/errors.json` không có scope; `scripts/errors-registry.mjs` gộp hai nơi và từ chối mã định nghĩa hai lần. Luật cứng: mã xuất hiện trong `## Steps` mà không có trong sổ gộp → `validate-operator` đỏ; runtime gặp mã lạ thì terminate với `UNKNOWN_STOP`. Không có "code tạm".

Ví dụ hàng:

```json
"CHOICE_REQUIRED": { "meaning": "nhiều phương án còn material sau khi chấm",
  "disposition": "fallback",
  "fallback": "chọn phương án điểm cao nhất theo tradeoffAxes; hòa thì chọn ít thay đổi stack nhất; ghi bảng điểm vào response.md#decision",
  "unless": { "param": "selectionPolicy", "equals": "approval-required", "then": "terminate" } }
```

`unless` là cách duy nhất một mã đổi disposition: theo đúng một param của Requirements, không theo cảm giác.

### A7. Params trên từng bước

Mỗi hàng `## Steps` có cột **Params** ghi field của Requirements mà bước đó đọc. Validator kiểm hai chiều:
param trong Steps phải có trong Requirements; field trong Requirements phải được ít nhất một bước dùng
(field không ai dùng là field thừa → đỏ). Cột này cũng là thứ orchestrator dùng để biết khi `blocked` thì
hỏi người đúng field nào.

### A8. Thứ tự thực thi

0. `errors/errors.json` + generator INDEX; nhập 12 mã của B1 trước, các operator sau thêm dần.
1. `templates/kinds/` (khuôn md + schema data), `templates/operator.template.md`, `templates/step/*.schema.json`.
2. `scripts/validate-step.mjs` + mở rộng cổng cây.
3. Viết lại 14 gói, ba agent thư mục rời: A = architecture-decide, business-decide, workspace-bind,
   backend-source-apply, content-generate; B = frontend-direction-decide, frontend-presentation-resolve, frontend-source-apply,
   frontend-surface-audit; C = quality-verify, git-publish, release-deploy, platform-operate, uat-verify.
   Mỗi gói: gộp 4 md → `operator.md`, mã dừng → `## Stops`, refs → `## Context`, `validate.mjs` + fixture
   dương/âm trong `self-test.mjs` xanh, xóa file cũ, rồi mới sang gói kế. Không `git add -A`.
4. `resources/orchestrator.json`: session layout `step-N-M`, `session.json`, xóa phiên sau `git.publish`.
5. Dry run chain 5 bước (business.decide → frontend.direction.decide → frontend.presentation.resolve → frontend.source.apply
   [dry] → frontend.surface.audit) trên route subscriptions, ghi `audits/1.0.1/a5-fe-chain-subscriptions.md`.

---

## B. Từng operator (theo thứ tự chain; chốt từng cái)

**Đổi tên đồng bộ (chốt 2026-09-03, áp ở bước gộp cuối sau khi ba agent trả gói):** tiền tố `fe.` → `frontend.` cho cả bốn operator FE và kind của chúng (`frontend-direction-decision` → `frontend-direction-decision`, `frontend-presentation-resolution` → `frontend-presentation-resolution`, `frontend-source-application` → `frontend-source-application`, `frontend-surface-audit` → `frontend-surface-audit`); `backend.source.apply` → `backend.source.apply` (đối xứng với `frontend.source.apply`), kind `backend-source-application` → `backend-source-application`. Thư mục gói, routing.json, alias writers, orchestrator, SKILL/INDEX, audits đổi theo. Alias `@workspaces/fe` / `@workspaces/be` GIỮ vì chúng soi đúng tên thư mục thật của route (`routes/<project>/fe|be`); đổi chúng là đổi khai báo workspace ở repo backend, không nằm trong đợt này.

Trạng thái: ☐ chờ thầy · ☑ chốt.

### B1. ☐ `architecture.decide` — ĐÃ DỰNG trong cây theo layout A2 (commit de1492ee) (`operators/architecture-decide/`), chờ thầy chốt

Đã dựng: `operator.md` (+vi) theo đúng bảng dưới; `errors.json` riêng của gói (8 mã) + `errors/errors.json`
chung (5 mã, `scope` là mảng, `["*"]` = mọi operator); `validate.mjs` gọi `scripts/validate-step.mjs` rồi
kiểm luật riêng; `self-test.mjs` 3 bước hợp lệ + 22 đột biến bị từ chối; khuôn `templates/kinds/`
(`architecture-decision`, `independent-critique`, `request`, `changes` dạng md; `current-state`,
`stack-model` dạng schema) và hai gate `templates/step/{input,output}.schema.json`. Gói cũ 15 file đã xóa.
Khác với bản nháp dưới: cột Params đã có; `## Stops` chỉ hai cột `Code | Disposition`, nghĩa và fallback
nằm ở `errors/`; `approval` mặc định `null` (chỉ bắt buộc dưới `approval-required`); routing của operator
này còn 4 domain (architecture, business, workspace, caller) vì 3 domain kia không mã dừng nào phát tới.

**Job.** Quyết một kiến trúc với stack, ranh giới hệ thống và quyền sở hữu dữ liệu, chứng minh nó bằng
hiện trạng quan sát được, các phương án bị loại, tương thích đã kiểm và một phản biện độc lập.

**Resources.** profile `sol-fresh`; `webSearch: bounded`; `grammarBound: false`; `imageGeneration: never`.

**Context (tĩnh).**

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/be` | checkout được route, đọc ở head đã đóng băng; inventory lấy từ manifest và file deploy | có |
| `@worktrees/businesses/<featureId>` | head đã publish của lời hứa nghiệp vụ mà kiến trúc phải giữ | có |
| `@knowledge/patterns` | mẫu tái dùng mà scope có thể ràng; là hình dạng, không phải lựa chọn | không |

**Inputs (động).**

| Kind | From | Required |
| --- | --- | --- |
| `architecture-decision` | lần chạy trước trên cùng hoặc kề ranh giới (lineage) | không — lần đầu không có |

> Hiện tại gói khai `@dynamic/architecture-decision.json` là *required*; lần chạy đầu không thể có, nên
> chuyển thành optional. Đây là điểm trò tự phản biện số 1.

**Requirements (người nhập).**

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `objective` | prompt | — (bắt buộc) | Mục tiêu phải đạt, một đoạn |
| `decisionId` | id | slug từ objective | Tên quyết định, đặt tên artifact |
| `alternatives` | number 1–4 | **1** | Số phương án sinh ra; >1 chỉ khi người yêu cầu so sánh |
| `tradeoffAxes` | choice (1–11, nhiều) | cost, complexity, reversibility | Trục chấm phương án khi >1, và là trục critique bám |
| `constraints[]` | list {id, kind, statement} | — (bắt buộc ≥1 fixed-intent) | kind ∈ fixed-intent · measurable · preference · assumption · unknown |
| `selectionPolicy` | choice | **automatic** | `automatic` = máy chọn và ghi lý do; `approval-required` = người chọn |
| `approval` | id + fingerprint | null | Chỉ khi resume sau `CHOICE_REQUIRED` dưới `approval-required` |
| `resume` | token | null | Chỉ khi chạy lại từ một bước blocked |

Bỏ khỏi người nhập vì gate cấp: `invocationId`, `missionId`, `project.backendSourceRef`, `project.sourceHead`
(orchestrator điền `heads`), `project.artifactRootRef` (chính là `step-N-M/`).

**Steps.**

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và resume | `resume`, `approval` | `input.json`, `request.md`, Input `architecture-decision` (nếu có), `@workspaces/be` (head đóng băng) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Quan sát hiện trạng | — | `@workspaces/be` ở head đóng băng | `data/current-state.json` | `CURRENT_STATE_UNOBSERVED` |
| 3 | Ràng inventory với lời hứa nghiệp vụ | — | `data/current-state.json`, `@worktrees/businesses/<featureId>` | — | `BUSINESS_AUTHORITY_REQUIRED`, `EVIDENCE_MISSING` |
| 4 | Đóng khung quyết định | `objective`, `decisionId`, `constraints`, `tradeoffAxes` | `request.md#requirements` | — | `CONSTRAINT_CONTRADICTION` |
| 5 | Sinh `alternatives` phương án khác cơ chế | `alternatives` | `data/current-state.json`, `@knowledge/patterns` | `artifacts/<decisionId>-alternatives.html` **chỉ khi `alternatives` > 1** | `NO_VIABLE_ALTERNATIVE` |
| 6 | Chọn | `selectionPolicy`, `tradeoffAxes`, `approval` | html trên (nếu có) | — | `CHOICE_REQUIRED` |
| 7 | Đào sâu phương án đã chọn | `constraints` | `data/current-state.json` | `data/stack-model.json` | `DATA_OWNERSHIP_UNASSIGNED`, `COMPATIBILITY_UNVERIFIED` |
| 8 | Phản biện độc lập — agent mới, không thừa hưởng lượt | — | `data/stack-model.json` và claim của nó | `critique.md` | `CRITIQUE_UNRESOLVED` |
| 9 | Xác nhận hoặc trả lại lựa chọn | `selectionPolicy` | `critique.md`, `data/stack-model.json` | — | `CHOICE_REQUIRED`, `NO_VIABLE_ALTERNATIVE` |
| 10 | Viết handoff và phát | — | mọi thứ trên | `response.md`, `output.json` | — |

Với `alternatives = 1` (mặc định): bước 5 sinh một thiết kế, không render html; bước 6 không có gì để chọn;
chất lượng quyết định dựa vào bước 8. Bước 9 trả lựa chọn chỉ có nghĩa khi critique cho thấy phương án đã
chọn chết dưới một attack; khi `alternatives = 1` thì đó là `NO_VIABLE_ALTERNATIVE` (terminate), không phải
`CHOICE_REQUIRED`.

Từ 11 bước còn 10: "Freeze the handoff" và "Emit and stop" gộp vì handoff chính là phần cuối của
`response.md`. Bước 9 hiện không có mã dừng dù văn bản nói "trả lựa chọn về owner" → thêm `CHOICE_REQUIRED`.

**Outputs.**

| Kind | File | Type | Khuôn |
| --- | --- | --- | --- |
| `architecture-decision` | `response.md` | md | Decision · Boundaries (trách nhiệm, owner, interface, có dữ liệu không) · Data ownership (store → boundary, writers, readers, migrators, transaction, backup, restore) · Stack delta (existing/added/replaced/removed + loại biện minh) · Rejected alternatives · Handoff (invariants, risks, contracts, migration, rollback, proof expectations, unknowns) — **không nêu tên file implementation** |
| `current-state` | `data/current-state.json` | data | inventory component + evidence (path, line, head) |
| `stack-model` | `data/stack-model.json` | data | boundaries, stores, components, compatibility 5 trục |
| `alternatives` | `artifacts/<decisionId>-alternatives.html` | artifact | so sánh 2–4 phương án, inspectable |
| `independent-critique` | `critique.md` | md | mỗi attack (partial failure, retry/idempotency, concurrency, stale, deletion, recovery, outage, rollback) → resolution |

**Stops.**

| Code | Scope | Disposition | Fallback / Resume |
| --- | --- | --- | --- |
| `INVALID_INPUT` | shared | terminate | sửa `request.md` |
| `SOURCE_DRIFT` | shared | terminate | orchestrator đóng băng head lại |
| `NO_PROGRESS` | shared | terminate | resume phải mang delta thật |
| `EVIDENCE_MISSING` | shared | terminate | bổ sung evidence |
| `CURRENT_STATE_UNOBSERVED` | architecture.decide | terminate | sửa route/checkout |
| `BUSINESS_AUTHORITY_REQUIRED` | architecture.decide | terminate | chạy `business.decide` trước |
| `CONSTRAINT_CONTRADICTION` | architecture.decide | terminate | người sửa constraint |
| `NO_VIABLE_ALTERNATIVE` | architecture.decide | terminate | nới constraint hoặc dừng |
| `CHOICE_REQUIRED` | architecture.decide | **fallback** → điểm cao nhất theo `tradeoffAxes`, hòa thì ít đổi stack nhất, ghi bảng điểm | `unless selectionPolicy = approval-required → terminate`, người nhập `approval` |
| `COMPATIBILITY_UNVERIFIED` | architecture.decide | **fallback** → component giữ lại không có evidence thì đánh dấu `replaced-candidate`, ghi vào Handoff#unknowns | — |
| `DATA_OWNERSHIP_UNASSIGNED` | architecture.decide | terminate | store không chủ là lỗi thiết kế, không fallback |
| `CRITIQUE_UNRESOLVED` | architecture.decide | terminate | attack không resolution là lỗi thật |

**Next.**

| When | Operator |
| --- | --- |
| lời hứa nghiệp vụ cần mô hình lại theo kiến trúc mới | `business.decide` |
| kiến trúc đã chốt, có contract backend | `backend.source.apply` |
| kiến trúc đã chốt, có bề mặt FE | `frontend.direction.decide` |

**Điểm trò tự phản biện, chờ thầy:**

1. Input `architecture-decision` từ required → optional (lần đầu không có).
2. Phản biện độc lập (bước 8) trong mô hình `step-N-M` nên là **agent mới** do orchestrator spawn trong cùng
   step, hay là một bước riêng `step-(N+1)-1` của chính operator này với profile `sol-reviewer`? Trò nghiêng
   về agent mới trong cùng step để chain không dài thêm, nhưng profile reviewer thì rõ vai hơn.
3. `webSearch: bounded` chưa có alias vùng `@remote` tương ứng (hiện chỉ npm/git/ghcr/github-actions/minio).
   Hoặc thêm `@remote/web`, hoặc giữ là policy của resources chứ không phải ref. Trò nghiêng về giữ là policy.
4. Bước 9 thêm `CHOICE_REQUIRED`; 11 bước gộp còn 10.
5. Mặc định `alternatives = 1`, `selectionPolicy = automatic` theo lệnh thầy; hệ quả: html so sánh chỉ sinh khi
   >1, và `CHOICE_REQUIRED` gần như không xảy ra ở mặc định.
6. `COMPATIBILITY_UNVERIFIED` được một fallback (đánh dấu unknown thay vì dừng); thầy muốn chặt thì đổi về terminate.

### B2. ☑ `business.decide` — CHỐT 2026-09-03 (áp sau khi agent A trả gói)

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume | `resume`, `mode` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Chuẩn hoá bằng chứng (+ `architecture-decision` nếu có) | — | `response/data/claims.json` | EVIDENCE_MISSING, CONTRADICTION_UNRESOLVED |
| 3 | Kiểm head và quyền chuyển trạng thái | `featureId`, `targetState`, `approval` | — | LIFECYCLE_TRANSITION_INVALID, AUTHORITY_CONFLICT, APPROVAL_REQUIRED |
| 4 | Mô hình lời hứa (mode model) | — | — | EVIDENCE_MISSING |
| 5 | Đóng băng coverage matrix (mode model) | `dimensions` | `response/data/coverage-matrix.json` | COVERAGE_INCOMPLETE, CONSUMER_UNPROVEN |
| 6 | Xử lý legacy (mode model) | — | — | CONTRADICTION_UNRESOLVED |
| 7 | Đối chiếu với source đã giao (mode reconcile; Input `backend-source-application` bắt buộc) | — | — | RECONCILIATION_DISCREPANCY |
| 8 | Publish head | — | `@worktrees/businesses/<featureId>` (lease độc quyền), `response/data/model.json` | SOURCE_DRIFT |
| 9 | Phát | — | `response/response.md`, `response/response.json` | — |

Requirements: `featureId` (id, —), `mode` (`model` | `reconcile`, default model), `targetState` (choice theo lifecycle, —), `dimensions` (list, default: dimension của head trước), `approval` (null), `resume` (null). Inputs: `architecture-decision` (no), `backend-source-application` (bắt buộc khi mode reconcile). Mọi mã terminate. Kind máy mới: `claims`, `coverage-matrix`, `model` (schema từ output.schema cũ). Next: `frontend.direction.decide`, `backend.source.apply`, `architecture.decide`.

### B3. ☑ `workspace.bind` — CHỐT (trò tự quyết, nhánh backend)

Từ 8 bước còn 6: "Reject every hint" nhập vào gate (hint trong request là `INVALID_INPUT`); "Bind provenance" nhập vào Phát.

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume, từ chối mọi hint | `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Ràng bootstrap và identity (`@workspaces/device-state`) | — | — | IDENTITY_UNVERIFIED |
| 3 | Phân giải route (`@workspaces/projects/<project>/<role>` ↔ `@workspaces/local/routes/<project>/<role>`) | `project`, `role` | — | ROUTE_UNDECLARED, ROUTE_UNHYDRATED, ROUTE_MISMATCH |
| 4 | Kiểm checkout: policy nhánh, cây sạch, write roots | `gitPolicy`, `declaredWriteRoots` | — | BRANCH_POLICY_VIOLATION, CHECKOUT_DIRTY |
| 5 | Ràng runtime caller cần (chỉ khi `runtimeNeed` ≠ none) | `runtimeNeed` | — | ENDPOINT_AUTHORITY_STALE, RUNTIME_NOT_READY |
| 6 | Phát | — | `response/response.md`, `response/data/route.json`, `response/response.json` | — |

Requirements: `project` (—), `role` (choice fe\|be, —), `gitPolicy` (default: policy trong khai báo route), `declaredWriteRoots` ([]), `runtimeNeed` (none), `resume` (null). Mọi mã terminate; `CHECKOUT_DIRTY` không bao giờ fallback (luật: không stash). `RUNTIME_NOT_READY` domain platform. Kind máy mới: `route` (diskPath, head, policy, ports, writeRoots). Next: `git.publish`, `backend.source.apply`, `frontend.source.apply`, `platform.operate` (khi runtime chưa sẵn).

### B4. ☑ `backend.source.apply` — CHỐT (trò tự quyết)

Giữ 8 bước; ghi mutation thành kind máy; bằng chứng facet và proof là data.

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume | `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Ràng thẩm quyền: `@worktrees/businesses/<featureId>`, Input `architecture-decision`, `@knowledge/patterns/be` | `featureId` | — | CONTRACT_UNFROZEN, BUSINESS_AUTHORITY_MISSING, PATTERN_UNBOUND |
| 3 | Điền từng operation của contract vào `@workspaces/be` (lease độc quyền) | `mutableFileRefs` | `@workspaces/be` | CONTRACT_WIDENED, OWNER_CONFLICT |
| 4 | Ghi mọi mutation (hash trước/sau) | — | `response/data/mutations.json` | — |
| 5 | Kiểm lại snapshot đã persist theo patterns/be | — | — | — |
| 6 | Chứng minh từng facet đã khai | — | `response/data/conformance/<operationId>.<facet>.json` | — |
| 7 | Chạy từng proof đã khai (lệnh pin trong contract) | — | `response/data/proofs/<operationId>.<kind>.json` | PROOF_UNAVAILABLE |
| 8 | Phát | — | `response/response.md`, `response/changes.md`, `response/response.json` | — |

Requirements: `featureId` (—), `outcome` (prompt, —), `mutableFileRefs` (list, —), `resume`. Inputs: `architecture-decision` (yes). Mọi mã terminate: contract rộng ra hay owner sai là lỗi thiết kế, proof không có là caller. Kind máy: `mutations`, `conformance`, `proof`. Next: `quality.verify`, `business.decide` (mode reconcile), `frontend.direction.decide`.

### B5. ☑ `frontend.direction.decide` — CHỐT 2026-09-03 (thầy: theo ý trò)

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume | `resume`, `approval` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Kiểm request: route, scope, change level, ceiling | `target`, `changeLevel`, `ownerCeiling` | — | ROUTE_UNVERIFIED, SCOPE_UNFROZEN, CHANGE_LEVEL_AMBIGUOUS, OWNER_CEILING_INVALID |
| 3 | Ràng Inputs theo changeLevel: `new` → business bắt buộc (trạng thái đóng + exit trước khi vẽ); `reconstruct` → business chỉ khi tập state đổi, giữ nguyên fact nghiệp vụ; `refine` → không cần ai; backend khi contract dữ liệu đổi; architecture khi ranh giới đổi | `changeLevel` | — | BUSINESS_REQUIRED, BACKEND_REQUIRED, ARCHITECTURE_REQUIRED |
| 4 | Quan sát context hiện có → `## Observed` (path@head) | — | — | EVIDENCE_MISSING |
| 5 | Biên dịch UI contract + coverage (mọi state/enumeration) | — | `response/data/coverage.json` | SCOPE_UNFROZEN |
| 6 | Tham chiếu ngoài bounded, chỉ khi `references` rỗng và changeLevel là `new` hoặc `reconstruct` (refine dùng idioms sẵn có) | `references`, `changeLevel` | — | REFERENCE_EVIDENCE_EXHAUSTED |
| 7 | Tạo `candidates` ứng viên | `candidates` | — | NO_VIABLE_DIRECTION |
| 8 | Lọc qua Grammar (`@grammar/core`, `@knowledge/grammars/starci`) | `ownerCeiling` | — | GRAMMAR_REQUIRED (terminate; gap → người, không tự chế) |
| 9 | Render bằng chứng khi candidates > 1 hoặc preview | `candidates`, `preview` | `response/artifacts/<candidateId>.html` | — |
| 10 | Falsify → `## Falsification` | — | — | NO_VIABLE_DIRECTION |
| 11 | Quyết | `selectionPolicy`, `approval` | — | DIRECTION_CHOICE_REQUIRED (fallback: sống sót nhiều đòn nhất, hòa thì ít node mới nhất; unless approval-required) |
| 12 | Phát | — | `response/response.md`, `response/response.json` | — |

Requirements: `target` (—), `intent` (create / modify / audit-repair / reconcile, default modify; create ⇔ new), `changeLevel` (new / reconstruct / refine, — vì source không tự chứng minh được mức; audit-to-target mặc định reconstruct như v7), `ownerCeiling` (surface-only / surface-and-nested-layouts / ancestor-layouts-authorized, default surface-and-nested-layouts), `candidates` (1), `preview` (no), `references` ([]), `selectionPolicy` (automatic), `approval` (null), `resume` (null). Inputs: ba kind đều Required no, điều kiện ở luật. `refine` chạy không cần business (chỉ sửa trong cấu trúc đã duyệt: typography, spacing, label, state, token, conformance Grammar; không di chuyển, thêm, bớt vùng). `reconstruct` được dựng lại cấu trúc nhưng giữ fact nghiệp vụ. `new` phải ràng vào business và đóng tập state trước khi vẽ. Với refine, bước 5 ràng cấu trúc đã duyệt và bước 7 chỉ sinh ứng viên ở mức phần tử. Kind máy: `coverage`. Next: chỉ `frontend.presentation.resolve` và người (gap Grammar); không có đường tắt sang `frontend.source.apply` vì inventory phải tồn tại.

### B6. ☑ `frontend.presentation.resolve` — CHỐT 2026-09-03

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume, đếm vòng audit↔resolve | `resume`, `maxRounds` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Ràng `@knowledge/ui/presentation`, Grammar đã publish (`@grammar/core` qua npm), head | — | — | KNOWLEDGE_UNBOUND, GRAMMAR_UNPUBLISHED |
| 3 | Duyệt cây theo trần owner lấy từ Input direction | — | — | OWNER_CONFLICT |
| 4 | Owner từng property (Grammar claim vs class app) | — | `response/data/inventory.json` | — |
| 5 | Một rule presentation cho property app còn lại | — | — | RULE_MISSING |
| 6 | Gap Grammar → `## Gaps`, node giữ class app-owned, KHÔNG dừng | — | — | — |
| 7 | Bỏ class trùng Grammar hoặc ngoài closed scale | — | — | — |
| 8 | Phát `data-contract` lên node app sở hữu | `contractEmission` | — | UNKNOWN_RULE |
| 9 | Phát | — | `response/artifacts/<target>.resolved.tsx`, `response/data/inventory.json`, `response/response.md`, `response/response.json` | — |

Requirements: `maxRounds` (2), `contractEmission` (on), `resume` (null). Inputs: `frontend-direction-decision` (yes; mang ownerCeiling), `frontend-surface-audit` (no; chỉ khi lặp). Mọi mã terminate. Kind máy: `inventory` (treeFingerprint, classNames[], ruleIds[], gaps[]). response.md: Owner map, Rules chosen, Removed, Gaps, Fallbacks taken. Next: `frontend.source.apply`; người khi có gap (→ family.md#Gaps).

### B7. ☑ `frontend.source.apply` — CHỐT 2026-09-03 (thầy: theo ý trò; áp cho cả backend.source.apply)

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume, xác nhận head | `resume`, `mode` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Ràng resolution (fingerprint, inventory, cây), direction (ý định), write set và owner root | — | — | RESOLUTION_STALE, OWNER_CONFLICT |
| 3 | Chiếu cây đã resolve lên path khai báo; node app-owned thành leaf rỗng có contract (props, state) | — | — | — |
| 4 | Kiểm từng giá trị với inventory; `mode = dry` dừng ở đây và phát kế hoạch | `mode` | `response/data/writes.json` (plan) | WRITE_REJECTED |
| 5 | Ghi nguyên tử lên nhánh `session/<sessionId>` (worktree riêng, lease), hash trước/sau, commit một lần | — | `@workspaces/fe` (branch/session), `response/data/writes.json` | — |
| 6 | Kiểm lại sau ghi: cây tại commit khớp resolved tree | — | — | WRITE_REJECTED |
| 7 | Phát | — | `response/response.md`, `response/changes.md`, `response/response.json` (commits: [sha]) | — |

Requirements: `mode` (apply / dry, default apply), `resume` (null). Inputs: `frontend-presentation-resolution` (yes), `frontend-direction-decision` (yes). Mọi mã terminate. Kind máy: `writes` {base, branch, commit, files[{path, before, after, change}]}. Luật nhánh phiên ghi ở `resources/orchestrator.json#sourceWrites` và segment alias `/branch/session`, `/commit/<sha>`. Next: `frontend.surface.audit`, `quality.verify`.

### B8. ☑ `frontend.surface.audit` — CHỐT 2026-09-03

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume, head `@workspaces/fe` tại commit của apply, route được serve từ worktree phiên | `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Ràng `@knowledge/ui/proof`, claim của source-application, inventory của resolve, runtime | — | — | — |
| 3 | Chọn entry: suy từ `coverage.json` (state × viewport × scheme), người chỉ thu hẹp qua `matrix`; orchestrator chia ≤3 nhánh song song | `matrix` | — | — |
| 4 | Đợi readiness từng entry; probe tự nâng `route-and-data-served` theo state cần dữ liệu | `readinessProbe` | — | RUNTIME_UNAVAILABLE (→ platform.operate) |
| 5 | Capture và đo từng entry: ảnh + số đo px trên mọi node có data-contract | — | `response/artifacts/<matrixId>.png`, `response/data/captures/<matrixId>.json` | EVIDENCE_MISSING |
| 6 | So với claim và proof, phán theo chủ, phát | — | `response/data/verdicts.json`, `response/response.md`, `response/response.json` | UNKNOWN_RULE |

Requirements: `matrix` (default: toàn bộ coverage), `readinessProbe` (route-served), `resume` (null). Inputs: `frontend-source-application` (yes), `frontend-presentation-resolution` (yes), `frontend-direction-decision` (yes). Mọi mã terminate. Kind máy: `capture`, `verdicts`. Luật phán theo chủ: lỗi node app-owned → Next `frontend.presentation.resolve` (trần maxRounds bên đó); lỗi render của chính component Grammar → gap về người (family.md#Gaps), không quay lại resolve; nội thất node app-owned không audit. Next: `frontend.presentation.resolve`, `quality.verify`, người.

### B9. ☑ `quality.verify` — CHỐT (trò tự quyết)

Từ 8 bước còn 7: "Verify the head" nhập vào gate. Đỏ ở một gate không phải mã dừng, là verdict trong response.

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume, xác nhận head | `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Tiêu thụ predecessor nguyên vẹn (≥1 trong `backend-source-application`, `frontend-source-application`, `changes`) | — | — | PREDECESSOR_MIXED, PREDECESSOR_STALE |
| 3 | Chạy gate theo thứ tự khai (`@workspaces/<project>/<role>/gates`) | `gates`, `explicitE2eRequest` | `response/data/gates/<gate>.json` | GATE_UNAVAILABLE |
| 4 | Áp chính sách coverage | `thresholds` | `response/data/coverage.json` | — |
| 5 | Phân loại từng lỗi | — | — | — |
| 6 | Áp nợ đã duyệt (`@worktrees/debts`) | `declaredDebts` | — | DEBT_UNAPPROVED |
| 7 | Phát | — | `response/response.md`, `response/response.json` | — |

Requirements: `gates` (default: gate plan của route), `thresholds` (default: từ cấu hình gates), `explicitE2eRequest` (false; luật: không e2e khi không được yêu cầu), `sonarScope` (new-code), `declaredDebts` ([]), `resume`. Mọi mã terminate. Kind máy: `gate-result`, `coverage`. Next: `git.publish` (khi xanh), `backend.source.apply` / `frontend.source.apply` (khi đỏ, theo domain của lỗi), `release.deploy`.

### B10. ☑ `git.publish` — CHỐT (trò tự quyết)

Giữ 8 bước; tag chỉ khi được yêu cầu; không có thao tác phá hoại nào là tham số.

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume | `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Ràng route (Input `workspace-route-binding`) | — | — | ROUTE_UNVERIFIED |
| 3 | Ràng approval cho đúng boundary (Input `quality-verification`) | `boundary`, `approval` | — | APPROVAL_MISSING |
| 4 | Kiểm cây: dirty ngoài boundary, policy nhánh | — | — | DIRTY_OUTSIDE_BOUNDARY, BRANCH_POLICY_VIOLATION |
| 5 | Chạy hook (`@workspaces/<project>/<role>/husky`, kể cả pre-push) | — | — | HOOK_BLOCKED |
| 6 | Push non-force (lease `@remote/git/<project>/<role>`) | — | `@remote/git/<project>/<role>` | NON_FAST_FORWARD |
| 7 | Push tag tiếp nối (chỉ khi `tag`) | `tag` | `@remote/git/<project>/<role>` | — |
| 8 | Phát | — | `response/response.md`, `response/response.json` | — |

Requirements: `boundary` (—), `approval` (—: publish ra remote là hành động hướng ngoại, luôn cần người), `tag` (null), `resume`. Mọi mã terminate; `NON_FAST_FORWARD` không fallback (không rebase/force hộ). Luật: `--no-verify`, force, amend, reset không có chỗ trong Requirements nên không diễn đạt được. Sau done orchestrator xoá phiên. Next: `release.deploy`, người.

### B11. ☑ `release.deploy` — CHỐT (trò tự quyết)

Giữ 10 bước; hai nhánh phục hồi là fallback có thứ tự.

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume, Input `quality-verification` là uỷ quyền | `resume` | — | INVALID_INPUT, AUTHORIZATION_MISSING, NO_PROGRESS |
| 2 | Ràng release và kế hoạch (`@remote/ghcr/<image>`, `@remote/github-actions/<runId>`) | `release`, `target`, `approval` | — | MANIFEST_INVALID, APPROVAL_REQUIRED |
| 3 | Khởi tạo execution root, phân giải credential theo tên (`@workspaces/device-state`) | — | — | CREDENTIAL_UNAVAILABLE |
| 4 | Chuẩn bị host, publish artifact theo digest, migrate, đối chiếu domain | — | — | HOST_UNAVAILABLE, ARTIFACT_MISSING, MIGRATION_BLOCKED, DOMAIN_UNRECONCILED |
| 5 | Roll out | — | — | ROLLOUT_FAILED |
| 6 | Theo dõi trong deadline có backoff | `steadyDeadline`, `probes` | `response/data/probes.json` | — |
| 7 | Phát hiện drift đồng thời trước khi hành động | — | — | CONCURRENT_DRIFT |
| 8 | Nhánh phục hồi khi lỗi còn dai dẳng | — | — | RECOVERY_EXHAUSTED |
| 9 | Nhánh rollback khi phục hồi không giữ được | `rollbackIdentity` | — | ROLLBACK_IDENTITY_MISSING |
| 10 | Chứng minh trạng thái ổn định, phát | — | `response/response.md`, `response/response.json` | STEADY_STATE_UNPROVEN |

Requirements: `release` (—), `target` (—), `approval` (—: production), `probes` (default: từ manifest), `steadyDeadline` (600s, theo thời gian boot đã quan sát), `rollbackIdentity` (—), `resume`. Fallback có thứ tự: `ROLLOUT_FAILED` → nhánh phục hồi (chỉ hành động đảo được đã duyệt); `RECOVERY_EXHAUSTED` → rollback về `rollbackIdentity` theo digest; `ROLLBACK_IDENTITY_MISSING`, `STEADY_STATE_UNPROVEN`, `CONCURRENT_DRIFT` terminate. Kind máy: `probes`. Next: `platform.operate`, người.

### B12. ☑ `uat.verify` — CHỐT 2026-09-03

Mỗi luồng một thư mục `@worktrees/uat/<flow>/`: `flow.md` (case theo thứ tự, assertion có tên, kỳ vọng ba lane), `account.json` { username, role, credential: ".stacks/<env>/secrets/uat.enc" } (MỘT password dùng chung cho mọi account UAT, username riêng theo luồng; file mã hoá SOPS/age với người nhận là master identity dùng chung nên ai giữ identity đều giải mã được, giải mã lúc đăng nhập qua `@workspaces/device-state`, không bao giờ plaintext trong response/runs/log, ô mật khẩu che khi chụp; file .enc giữ LF), `seed/records.json` (is_uat=true, namespace <runId>) + `seed/expected.json`, `runs/<runId>/` chỉ thêm { result.json: commit, sessionId, snapshotFingerprint, seedFingerprint, runtimeGeneration, ba lane; verdicts.json; captures/<case>.png; sheet.png ghép cả luồng }, `latest` → run mới nhất. UAT là phiên riêng do người yêu cầu, account riêng, namespace riêng; dọn dẹp chỉ xoá dữ liệu trong namespace, không xoá hồ sơ run.

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume, lease, người yêu cầu | `requestedBy`, `lease`, `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Admission: Inputs `frontend-surface-audit` sạch và `quality-verification` xanh tại cùng commit | — | — | ADMISSION_MISSING |
| 3 | Preflight runtime: account giải mã được, fixture identity, store | — | — | PROVISIONING_UNAVAILABLE |
| 4 | Đóng băng snapshot từ flow.md + account.json + seed/ | `flow`, `cases` | `@worktrees/uat/<flow>` (snapshot), `response/data/snapshot.json` | CANONICAL_WRITE_DENIED |
| 5 | Chèn seed vào namespace runId | `runId` | — | FIXTURE_VIOLATION |
| 6 | Chạy case theo thứ tự trên worktree phiên tại commit | — | — | LEASE_INVALID, RUNTIME_UNAVAILABLE |
| 7 | Capture tại assertion từng case, ghép sheet | — | `response/data/captures/<case>.json`, `response/artifacts/<case>.png`, `response/artifacts/sheet.png` | EVIDENCE_UNAVAILABLE |
| 8 | Phán ba lane độc lập | — | `response/data/verdicts.json` | — |
| 9 | Kiểm chỉ-đọc, dọn namespace | — | — | — |
| 10 | Ghi runs/<runId>/ + latest, phát | — | `@worktrees/uat/<flow>` (runs/<runId>), `response/response.md`, `response/response.json` | — |

Requirements: `requestedBy` (—), `feature` (—), `flow` (—), `cases` (default mọi case), `runId` (orchestrator sinh), `lease` (orchestrator cấp), `resume`. Inputs: `frontend-surface-audit` (yes), `quality-verification` (yes). Mọi mã terminate. Kind máy: `snapshot`, `captures`, `verdicts`. Next: `git.publish` (ba lane pass), `frontend.presentation.resolve` (UI fail app-owned), `backend.source.apply` (behavior fail), người (UX fail).


Giữ 10 bước; chỉ chạy khi có người yêu cầu (luật e2e).

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume, lease | `requestedBy`, `lease`, `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Xác nhận admission (visual PASS, quality PASS) | — | — | ADMISSION_MISSING |
| 3 | Preflight ràng buộc trên runtime | — | — | PROVISIONING_UNAVAILABLE |
| 4 | Đóng băng snapshot (`@worktrees/_templates`) | `flow` | `@worktrees/uat/<flow>/<case>` (snapshot.json) | CANONICAL_WRITE_DENIED |
| 5 | Chuẩn bị fixture trong namespace run | `runId` | — | FIXTURE_VIOLATION |
| 6 | Chạy case theo thứ tự đóng băng | `cases` | — | LEASE_INVALID, RUNTIME_UNAVAILABLE |
| 7 | Capture theo assertion có tên | — | `@worktrees/uat/<flow>/<case>` (captures), `response/data/captures.json` | EVIDENCE_UNAVAILABLE |
| 8 | Phán ba lane độc lập (behavior, UX, UI) | — | `response/data/verdicts.json` | — |
| 9 | Kiểm chỉ-đọc rồi dọn (`is_uat=true`) | — | — | — |
| 10 | Publish result.json và phát | — | `@worktrees/uat/<flow>/<case>` (result.json), `response/response.md`, `response/response.json` | — |

Requirements: `requestedBy` (—: người yêu cầu rõ ràng), `feature` (—), `flow` (—), `cases` (default: mọi case của flow), `runId` (sinh), `lease` (—), `resume`. Mọi mã terminate; `RUNTIME_UNAVAILABLE` domain platform. Kind máy: `captures`, `verdicts`. Next: `git.publish`, người.

### B13. ☑ `content.generate` — CHỐT (trò tự quyết)

Phản biện độc lập thành cuộc trao đổi lồng `review` (cùng mẫu `critique`); vòng sửa là fallback có trần.

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume | `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Ràng `@remote/minio/<contentId>/<locale>`, `@worktrees/sessions/central-runtime` | `unit` | — | — |
| 3 | Viết và đóng băng brief | `naturalLanguages`, `implementationLanguages` | `response/brief.md` | BRIEF_UNBOUND |
| 4 | Viết từng ấn bản ngôn ngữ | `naturalLanguages` | `response/articles/<language>.md` | OUTCOME_UNCOVERED |
| 5 | Sinh hình theo claim (chỉ khi `stageModes.image`) | `stageModes` | `response/artifacts/<imageTargetRef>` | IMAGE_UNAVAILABLE |
| 6 | Hiện thực từng track code | `implementationLanguages`, `commands` | `response/artifacts/<track>/` | CODE_BUILD_FAILED |
| 7 | Chạy kiểm thực thi, tối đa `maxE2eIterations` | `maxE2eIterations` | `response/data/e2e.json` | E2E_FAILED, CONTRACT_WEAKENED |
| 8 | Chờ review: pause, agent mới đọc mọi artifact và claim | `maxReviewRounds` | `response/response.json` (waiting, awaiting review) | REVIEW_REVISION_REQUIRED, REVIEW_ROUNDS_EXHAUSTED |
| 9 | Phát | — | `response/response.md`, `response/response.json` | — |

Requirements: `unit` (—), `naturalLanguages` ([vi]), `implementationLanguages` ([]), `stageModes` (image: off), `commands` (từ unit), `maxE2eIterations` (2), `maxReviewRounds` (2), `resume`. `REVIEW_REVISION_REQUIRED` là **fallback**: sửa theo review rồi mở lại exchange, tới khi hết `maxReviewRounds` thì `REVIEW_ROUNDS_EXHAUSTED` terminate. `E2E_FAILED` terminate sau khi hết `maxE2eIterations` (vòng lặp bên trong bước 7). Kind md: `content-brief`, `content-article`, `content-review`; kind máy: `e2e`. Next: người (publish nội dung lên MinIO là quyền người).

### B14. ☑ `platform.operate` — CHỐT (trò tự quyết)

Giữ 8 bước; ghi vào runtime chỉ qua alias có lease.

| # | Bước | Params | Writes | Stops |
| --- | --- | --- | --- | --- |
| 1 | Gate, resume | `resume` | — | INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS |
| 2 | Ràng thẩm quyền: runtime, device-state, projects, approval | `service`, `approval` | — | AUTHORITY_DRIFT, CAPABILITY_MISSING |
| 3 | Kiểm lại inventory một lần | — | — | INVENTORY_DRIFT |
| 4 | Phân giải port claim (`@workspaces/ports/<project>`) | `portClaims` | — | PORT_CONFLICT |
| 5 | Suy ra delta giữa quan sát và mong muốn | `desiredState` | `response/data/delta.json` | — |
| 6 | Áp delta đã duyệt, từng resource (lease `@worktrees/sessions/central-runtime`) | — | `@worktrees/sessions/central-runtime` | EFFECT_UNAUTHORIZED, SERVICE_UNAVAILABLE |
| 7 | Chứng minh mọi check bắt buộc | — | `response/data/checks.json` | PROOF_FAILED |
| 8 | Phát | — | `response/response.md`, `response/response.json` | — |

Requirements: `service` (—), `desiredState` (—), `portClaims` ([]), `approval` (—: đổi runtime dùng chung), `resume`. Mọi mã terminate. Kind máy: `delta`, `checks`. Next: `workspace.bind`, `frontend.surface.audit`, `uat.verify` (những ai cần runtime).

