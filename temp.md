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
