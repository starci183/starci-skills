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

### A2. Một bước trong phiên

```text
.worktrees/sessions/<sessionId>/
├─ session.json                 chain [[1-1],[2-1,2-2],[3-1]] · map step→operatorId · lease · trạng thái
└─ step-N-M/                    N = vị trí trong chain, M = nhánh song song (≤3 agent)
   ├─ input.json                GATE VÀO: operatorId, step, contexts (alias tĩnh), fields (tên → đường dẫn)
   ├─ request.md                Context đã bind · Requirements người nhập · Inputs (trỏ md/data bước trước)
   ├─ response.md               kết quả theo khuôn kind
   ├─ data/                     json máy
   ├─ artifacts/                html, tsx, png …
   └─ output.json               GATE RA: status done|blocked, stop, fields (kind → file), commits, next
```

Quy tắc đọc: một Input kind phân giải tới bước gần nhất đứng trước có `output.json.fields` liệt kê kind đó.
Song song: hai bước cùng N chỉ chạy đồng thời khi cột Writes không chạm chung alias.
Vòng đời: tạo khi operator đầu được dispatch; tiến khi `status: done`; dừng khi `blocked` và chờ đúng
field người nhập mà `stop` gọi tên; xóa cả phiên khi `git.publish` done.

### A3. Một operator = `operator.md` (+ `.vi.md`)

```text
# <operator.id>
## Job            một câu
## Context        | Alias | Bind | Required |          tĩnh, lấy từ alias/INDEX.md
## Inputs         | Kind | From | Required |           động, kind = tên trong templates/kinds
## Requirements   | Field | Type | Default | Ask |     người nhập: choice / number / prompt / path / id; default = chạy không cần hỏi
## Steps          | # | Step | Params | Reads | Writes | Stops with |   Params = field nào của Requirements bước này dùng
## Outputs        | Kind | File | Type |               md / data / artifact
## Stops          | Code | Disposition |                 chỉ liệt kê; nghĩa và xử lý nằm ở errors/
## Next           | When | Operator |
```

Gói còn 4 file: `operator.md`, `operator.vi.md`, `validate.mjs` (parse `response.md` theo khuôn kind, schema
cho `data/*`, đối chiếu `output.json` với `## Outputs`), `self-test.mjs`. `operator.json` giữ lại chỉ phần
máy cần mà markdown không nên chứa: `id`, `resources` (profile, requires, policy). Mọi thứ khác đọc từ
`operator.md`.

### A4. Gate chung (một cặp cho 14 operator)

`templates/step/input.schema.json`: `operatorId`, `step` (`^\d+-\d+$`), `contexts[]` (alias), `heads{}`
(alias → sha đã đóng băng, do orchestrator điền), `fields{}` (tên → `request.md#…` hoặc `../step-N-M/…`).

`templates/step/output.schema.json`: `operatorId`, `step`, `status` (`done|blocked`), `stop` (bắt buộc khi
blocked), `fields{}` (kind → `response.md` | `data/<x>.json` | `artifacts/<x>`), `commits[]`, `next[]`.

### A5. `scripts/validate-step.mjs`

Gọi `node scripts/validate-step.mjs <đường dẫn step-N-M>`:

1. `output.json` qua schema chung.
2. tra `operatorId` → `operators/<id>/operator.md`, parse `## Outputs`.
3. mỗi hàng Outputs: có trong `fields`, tồn tại trên đĩa; md → khuôn `templates/kinds/<kind>.template.md`;
   data → `<kind>.schema.json`; artifact → tồn tại.
4. `status: done` mà một Output bắt buộc hỏng → exit 1, một dòng mỗi lỗi.

Cổng cây trong `npm test`: `validate-alias` đọc `## Context`; `generate-operators-index` đọc `## Inputs`,
`## Outputs`, `## Steps`; thêm "mọi kind được nhắc phải có khuôn trong `templates/kinds/`" và "consumer của
kind X phải có producer đứng trước trong ít nhất một chain của `routing.json`".

### A6. `errors/` — sổ mã dừng, một nơi

```text
errors/
├─ errors.json          sổ máy đọc: code → { meaning, scope, disposition, fallback?, unless?, resume? }
└─ INDEX.md (+vi)       sinh từ errors.json, bảng cho người đọc
```

Một mã có đúng một trong hai disposition:

| Disposition | Nghĩa | Khi nào |
| --- | --- | --- |
| `terminate` | dừng ngay, `output.json.status = blocked`, `stop = <code>`, không Output nào được coi là done | thiếu bằng chứng, mâu thuẫn, head trôi, không còn phương án |
| `fallback` | không dừng; làm đúng hành động ghi trong `fallback`, ghi lại trong `response.md` mục "Fallbacks taken", chạy tiếp | có một lựa chọn máy làm được và ghi được lý do |

`scope` là `shared` (INVALID_INPUT, SOURCE_DRIFT, NO_PROGRESS, EVIDENCE_MISSING dùng chung 14 operator) hoặc tên
operator. Luật cứng: mã xuất hiện trong `## Steps` mà không có trong `errors.json` → `validate-templates`
đỏ; runtime gặp mã lạ thì terminate với `UNKNOWN_STOP`. Không có "code tạm".

Ví dụ hàng:

```json
"CHOICE_REQUIRED": { "scope": "architecture.decide", "meaning": "nhiều phương án còn material sau khi chấm",
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
   backend-implement, content-generate; B = fe-direction-decide, fe-presentation-resolve, fe-source-apply,
   fe-surface-audit; C = quality-verify, git-publish, release-deploy, platform-operate, uat-verify.
   Mỗi gói: gộp 4 md → `operator.md`, mã dừng → `## Stops`, refs → `## Context`, `validate.mjs` + fixture
   dương/âm trong `self-test.mjs` xanh, xóa file cũ, rồi mới sang gói kế. Không `git add -A`.
4. `resources/orchestrator.json`: session layout `step-N-M`, `session.json`, xóa phiên sau `git.publish`.
5. Dry run chain 5 bước (business.decide → fe.direction.decide → fe.presentation.resolve → fe.source.apply
   [dry] → fe.surface.audit) trên route subscriptions, ghi `audits/1.0.1/a5-fe-chain-subscriptions.md`.

---

## B. Từng operator (theo thứ tự chain; chốt từng cái)

Trạng thái: ☐ chờ thầy · ☑ chốt.

### B1. ☐ `architecture.decide` — ĐÃ DỰNG THỬ trong cây (`operators/architecture-decide/`), chờ thầy chốt

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
| kiến trúc đã chốt, có contract backend | `backend.implement` |
| kiến trúc đã chốt, có bề mặt FE | `fe.direction.decide` |

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

### B2. ☐ `business.decide` — viết sau khi B1 chốt
### B3. ☐ `workspace.bind`
### B4. ☐ `backend.implement`
### B5. ☐ `fe.direction.decide`
### B6. ☐ `fe.presentation.resolve`
### B7. ☐ `fe.source.apply`
### B8. ☐ `fe.surface.audit`
### B9. ☐ `quality.verify`
### B10. ☐ `git.publish`
### B11. ☐ `release.deploy`
### B12. ☐ `uat.verify`
### B13. ☐ `content.generate`
### B14. ☐ `platform.operate`
