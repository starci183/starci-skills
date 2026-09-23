# fable.md

## ghost-context

**Định nghĩa.** Một câu trong file canonical chỉ có nghĩa khi người đọc biết trạng thái
*cũ* của repo. Người đọc mới thấy một phủ định của thứ họ chưa từng thấy, nên không hiểu
câu đó đang nói gì và tại sao nó đứng ở đầu.

**Ví dụ.** `CONTEXT.md:1` mở đầu bằng "StarCi is a **distless** source layout". Chữ
`distless` chỉ có nghĩa với người biết repo từng build ra `.dist`. Chat mới hoặc dự án
mới đọc thấy một từ không tồn tại trong tiếng Anh, phủ định một thứ không có trong tree.

**Luật rút ra.** File canonical (`CONTEXT.md`, `README.md`, `modules/**`, `docs/**`) mô tả
hiện tại bằng câu khẳng định: "this tree is the runtime; `node` reads it directly". Lịch sử
"từng là gì, nay không còn" đi vào `CHANGELOG.md` hoặc `.experiments/practices/`, không đi
vào câu đầu của context.

**Cách nhận ra.** Từ ghép với `-less`/`no-`/`former`/`legacy`/`không còn` ở vị trí định
nghĩa, mà thứ bị phủ định không xuất hiện ở đâu khác trong tree.

**Nơi còn ghost-context cần rà.**

- [ ] `CONTEXT.md:1` `distless`
- [ ] `CONTEXT.md:35`, `README.md:53`, `docs/runtime-distribution.md:3` "no build step"
      (giữ được nếu viết thành khẳng định, ví dụ "the source is the runtime")
- [ ] `CONTRIBUTING.md:48` "former top-level dirs (`kernel/`, `core/`, `cli/`, ...)"
- [ ] `modules/kernel/api.yaml:315,316,479` `legacy`
- [ ] `docs/architecture-check.md:65,89,100`, `docs/backend-source-pattern.md:130`,
      `docs/source-layout.md:75` `legacy` (cần đọc từng chỗ, có thể là legacy của dự án
      đích chứ không phải của runtime)

## feedback-sediment

**Định nghĩa.** Mỗi lần feedback đắp thêm một lớp luật lên file mà không gỡ hay gộp lớp
cũ. Sau nhiều lần, file chứa các tầng trầm tích: trên nói A, dưới nói B, dưới nữa nói
"nếu không phải C thì A và B". Từng câu đều từng đúng ở thời điểm nó được viết; đọc cả
file thì mâu thuẫn. Người đọc mới không biết tầng nào là luật hiện hành, và LLM đọc nó sẽ
chọn ngẫu nhiên một tầng hoặc bịa ra một luật dung hoà, tức là hallucinate.

**Ví dụ.** Vai trò của chat trong `CONTEXT.md` có bốn tầng:

| Tầng | Vị trí | Nói gì |
|---|---|---|
| A | `CONTEXT.md:3` | "Chat is the trigger only." |
| B | `CONTEXT.md:3` | "With explicit unattended authority, `watchdog.mjs` owns the five-minute cadence" |
| C | `CONTEXT.md:5` | Chat chạy supervisor loop: quan sát, vá `.claude`, restart kernel |
| D | `CONTEXT.md:33` | "One chat monitors one workflow ... no unattended solo runner and no second control plane" |

A và C mâu thuẫn trực tiếp: trigger-only không thể vá contract và restart kernel. B và D
mâu thuẫn: có "unattended authority" nhưng "no unattended solo runner". C và D mâu thuẫn:
một chat giám sát nhiều workflow qua `poll.mjs --workflow <id>...` nhưng "one chat monitors
one workflow". Mỗi tầng đến từ một lần feedback: watchdog thêm sau, supervisor thêm sau
nữa, câu D có lẽ viết để chặn một đề xuất cũ về solo runner. Không câu nào bị gỡ.

**Khác với ghost-context.** Ghost-context là một câu tham chiếu quá khứ không còn tồn tại.
Feedback-sediment là nhiều câu cùng tồn tại ở hiện tại nhưng phủ định nhau.

**Luật rút ra.** Feedback sửa luật thì thay câu cũ, không viết thêm câu mới bên dưới. Một
khái niệm có một đoạn, đoạn đó là bản mới nhất. Nếu cần điều kiện ("nếu không phải C") thì
điều kiện nằm trong cùng đoạn với luật mà nó sửa. Lịch sử "trước nói A nay nói B" đi vào
`.experiments/practices/`, không nằm trong file canonical.

**Cách nhận ra.** Cùng một danh từ chủ ngữ (chat, kernel, watchdog, op) xuất hiện với động
từ "only" / "never" / "no other" ở hai đoạn cách xa nhau. Grep chủ ngữ rồi đặt các câu
cạnh nhau; nếu phải giải thích "câu này viết trước, câu kia viết sau" là có sediment.

**Nơi cần rà.**

- [ ] `CONTEXT.md` chủ ngữ "chat": gộp A/B/C/D thành một đoạn duy nhất về ba vai chat có
      thể đảm nhận (trigger, workflow-chat monitor, supervisor) và điều kiện của từng vai
- [ ] `CONTEXT.md` chủ ngữ "kernel" và "watchdog": rà cùng cách
- [ ] `docs/architecture.md:12` "spawned, not supervised, by chat" so với supervisor
- [ ] `modules/kernel/driver-loop.yaml` header "chat = goal creator + trigger only" (dòng
      ~12) so với `modules/supervisor/supervise.yaml`

### Case: `modules/ops/ops/interface.draw.yaml` (360 dòng, 7 commit trong 2 ngày)

Đọc thử một file bất kỳ, kết quả:

1. **Câu cụt do vá.** Step 1: "When a screen's direction is genuinely owner-level taste — a
   novel surface, a brand moment, or materially different layout architectures that all
   satisfy the accepted requirements." Hết câu, không có mệnh đề chính. Commit `614e67d55`
   thay vế sau ("the representative set may hold alternative candidates...") bằng luật mới
   "The default is one candidate per screen" nhưng để nguyên vế điều kiện của luật cũ.
2. **Câu lặp do chèn.** Step 2 có "Include real product-shaped content:" rồi 5 dòng luật
   mới, rồi lại "Include real product-shaped content," tiếp câu cũ. Commit `0b0b9e33a` chèn
   khối mới vào giữa câu cũ thay vì viết lại câu.
3. **Đầu file nói A, cuối file nói B.** Steps: mặc định một candidate mỗi screen. Khối
   `business.whenNeeded` cuối file: "When the owner must pick between visual candidates".
   Commit `614e67d55` sửa steps, không sửa business.
4. **Một luật, bốn chỗ.** "Không được đoán tên image model" xuất hiện 4 lần (read `profile`,
   write `designSource`, step 2, proof `imagegen-provenance`). "typed blocker" 4 lần.
   Luật skeleton 3 lần (step 2, step 3, và ngầm ở step 1). Mỗi lần feedback lại đắp luật
   vào mọi chỗ đang đọc được, nên sửa một chỗ sẽ lệch ba chỗ còn lại.
5. **Ghost-context nhẹ.** Read `knowledge` hard-code danh sách rule id của `concepts.yaml`
   (SURFACE-UNIT-1, LABEL-EXTERNAL-1, ...). Đây là bản sao của authority nằm trong package
   Grammar; package đổi thì dòng này thành ghost.

Nhận xét chung: file này không sai luật nào, nhưng có ba tầng trầm tích nhìn thấy được bằng
mắt thường (câu cụt, câu lặp, đầu-cuối lệch) và một tầng chỉ thấy khi đếm (luật lặp 3–4
lần). Cách sửa không phải thêm câu: viết lại mỗi step thành một đoạn, mỗi luật đứng một
chỗ, `business` block sinh từ steps hoặc bỏ.

- [ ] Sửa câu cụt step 1
- [ ] Gộp hai "Include real product-shaped content" step 2
- [ ] Đồng bộ `business.whenNeeded` với mặc định một candidate
- [ ] Mỗi luật một chỗ: model-name, typed-blocker, skeleton

**Ai bị rối, rối kiểu gì.**

| Người đọc | Đọc block nào | Hậu quả |
|---|---|---|
| Agent `[Op]` nhận dispatch | `steps[].action.en` | Gặp câu cụt thì tự đoán mệnh đề chính, thường đoán ra luật cũ vừa bị bỏ |
| Kernel khi settle | `proofs`, `blockers` | Luật chỉ nằm ở step, không ở proof, nên không có căn cứ fail |
| Chat sau nhận feedback để vá | cả file | Thấy một luật ở bốn chỗ, không biết chỗ nào gốc, sửa một để ba lệch hoặc thêm chỗ thứ năm. Đây là cơ chế trầm tích tự nhân lên |
| Người lạ đọc open-source | `business` block vì ngắn | Tin bản tóm tắt cũ, hiểu sai mặc định hiện tại |

**Nguyên tắc sửa.** Mỗi luật có một chỗ "làm" (một step) và tối đa một chỗ "chấm" (một
proof). Read/write block chỉ mô tả dữ liệu, không chứa luật. Vế điều kiện của luật cũ xoá
hẳn khi luật mới có điều kiện riêng. `business` block sinh từ steps cùng commit, hoặc bỏ.

**Ví dụ sửa step 1 (câu cụt).**

Trước: `When a screen's direction is genuinely owner-level taste — ... requirements. The
default is one candidate per screen: alternative candidates are generated only when the
owner explicitly asked ...`

Sau: `Generate one candidate per screen. Generate alternatives only when the owner asked
for options in the goal, a directive or a prior review note; then park an owner ask so the
owner picks, keep every candidate as direction, and retain the unchosen ones as evidence.`

**Ví dụ sửa step 2 (câu lặp).**

Trước: `Include real product-shaped content: every visible datum ... non-conformant.
Include real product-shaped content, screen purpose, component regions, ...`

Sau: `Include screen purpose, component regions, state, viewport, accessibility and
forbidden treatments. Every visible datum is concrete plausible data derived from the
accepted business record: numbers, currency, dates, names, statuses, copy. Skeleton or
shimmer appears only when the directed state is the loading state.`

Step 3 thay đoạn lặp bằng: `Reject any direction that breaks a step-2 rule and regenerate
within the bounded set.` Luật skeleton thêm vào một proof để kernel chấm được.

## Quyết định của thầy (2026-09-22)

- `.experiments/` giữ nguyên, không promote.
- Version về nhánh `1.0.0-alpha.N`. `2.0.0` là số của package cũ; tag `v2.x`/`v6.x` cũng vậy.
- Đang chuẩn bị `1.0.0-alpha.2`. Chủ đề: file canonical nói một điều, một lần
  (de-sediment, no ghost-context, một danh sách verb).
- Authority version duy nhất là `package.json`; không tạo file `VERSION`.

## op-shape: một op hiện tại là gì, và vì sao response không đồng đều

Đo trên 35 op trong `modules/ops/ops/` (13.512 dòng, từ 156 đến 1.287 dòng mỗi op).

**Một op hôm nay, theo đúng những gì máy đọc:**

| Chiều | Cái gì được type | Cái gì chỉ là prose |
|---|---|---|
| Input | Packet từ `api dispatch`: `op`, `brief` (đường dẫn yaml), `context{workflow, records, owned_paths}`, `constraints{model, budget, lease}` | Mọi tham số nghiệp vụ: số candidate, số round audit, ngưỡng file. Không op nào có key `params`/`inputs` |
| Context | `reads[]` liệt kê đường dẫn record | `purpose.en` của mỗi read chứa cả luật, không chỉ mô tả dữ liệu |
| Return | `starci/op-report@1` JSON qua `api report`: `outcome`, `summary` ≤600 ký tự, `files`, `checks`, `open`, `question`, `blocker`. Chỉ cái này được validate (`report-envelope.mjs`) | `writes[]` khai thêm `handoff` (E/response.yaml, 7 op), `matrixHandoff` (E/job-result.yaml, 23 op), và file riêng từng op: draws, flows, apiDelivery, assetManifest, intake, decision, scope, goal, verification |

**Ba nguyên nhân response không đồng đều:**

1. **Không có schema cho op manifest.** 35 op chung 14 key lõi, nhưng 17 op thêm 15 key
   tự đặt: `commitPolicy`, `qualityPolicy`, `deliveryPolicy`, `assetPolicy`, `modePolicy`,
   `executionModes`, `proposalAuthority`, `migrationAuthority`, `cutSetAuthority`,
   `refactorPolicy`, `docsPolicy`, `goalPolicy`, `intakePolicy`, `adHocPolicy`,
   `canonicalWorkPolicy`... `build-ops-registry.mjs` ghi rõ "fields absent are omitted, never
   invented", tức là không từ chối gì cả. Chỉ `interface.audit` có spec riêng.
2. **Tham số nằm trong prose.** "one candidate per screen" (`interface.draw:195`), "five-round
   loop" (`interface.audit`, lặp 5 lần), "at least two options" (`provision.ask:64`), "more
   than twelve files, more than eight proof demands, three or more" (`work.author:212`).
   Owner muốn 3 candidate thì phải viết vào goal, op phải đọc goal prose để tìm. Đó là chỗ
   hallucinate: agent đọc "owner explicitly asked" và tự quyết thế nào là "asked".
3. **23 op được bảo viết file không ai đọc.** Grep toàn bộ `scripts/ engine/ skills/`: chỉ
   `serve-ask.mjs` đọc `draws.yaml`. Không script nào đọc `job-result.yaml` hay
   `response.yaml`. Agent viết file theo prose mô tả, mỗi agent một kiểu, kernel không
   validate vì không consume. Đây là nguồn trực tiếp của "op responses không đồng đều".

**Thêm:** `modules/ops/_common.yaml` còn vocabulary "matrix 3 rows × 3 parallel cells",
"coordinator", "secondary types", "cell" từ mô hình cũ, trong khi `CONTEXT.md` nói một op
một agent, không fan-out. Ghost-context ngay trong file common mọi op đều đọc.

**Đề xuất hình dạng một op (`starci/op@1`), cố định, có schema và check:**

```yaml
id: interface.draw
goal: {en: ...}                 # một câu
params:                         # tham số typed, có default, ai được set
  candidatesPerScreen: {type: integer, default: 1, min: 1, max: 3, setBy: owner}
  representativeScreensMax: {type: integer, default: 5, setBy: kernel}
context:                        # dữ liệu op được đọc; chỉ mô tả, không chứa luật
  reads: [{id, path, purpose}]
effects:                        # op được ghi gì
  writes: [{id, path, schema}]
steps: [{reads, writes, action}] # luật "làm", mỗi luật một chỗ
returns:                        # đúng op-report@1 + outputs typed riêng op
  outputs: {draws: {schema: starci/draws@1}}
proofs: [{id, requirement}]     # luật "chấm"
blockers: [{code, condition}]
policy: {}                      # một map thay cho 15 key tự đặt
route: {...}
```

Bỏ `business` block (sinh từ steps hoặc để registry sinh). Bỏ `handoff`/`matrixHandoff`
khi không có consumer. Params đi theo đường: goal → `api enqueue --params` → packet →
op đọc `params.candidatesPerScreen`; api validate params theo schema của op trước khi
dispatch. Khi đó "gen 2-3 hình" là một giá trị, không phải một câu.

Bằng chứng kết thúc: `scripts/checks/check-op-manifest.mjs` chạy trên 35 op, từ chối key
lạ, params không default, writes không schema, và số hard-code trong `action.en` khi op có
param cùng nghĩa.

- [ ] Schema `starci/op@1`
- [ ] Check `check-op-manifest.mjs`
- [ ] `api enqueue --params` + validate + packet.params
- [ ] Chuyển `interface.draw` sang shape mới làm mẫu (candidatesPerScreen)
- [ ] Rà `_common.yaml` bỏ vocabulary matrix/cell/coordinator

## host-boundary: mọi call tới Orca đi qua scripts, agent không đọc contract

**Hiện trạng đo được.**

| Câu hỏi | Kết quả |
|---|---|
| Script nào spawn `orca` trực tiếp ngoài `scripts/api/orca/`? | Không có. Mọi spawn đi qua `orcaRun()` trong `scripts/api/orca/lib.mjs`. 27 wrapper, mỗi verb một file |
| Wrapper có đọc `modules/host/orca/calls.yaml` để lắp argv không? | Không. Argv hard-code trong từng wrapper (`['terminal','send','--terminal',...]`) |
| Có script nào gọi `orca agent-context` để so live schema không? | Không. `providers.mjs` chỉ so YAML với YAML, không chạy orca |
| `calls.yaml` nói gì về chính nó? | "wrappers build argv only from these entries, verify each command and flag against the live agent-context before the first effect". Cả hai vế đều không có code thực hiện |
| Ai được bảo phải đọc contract và check live schema? | `CONTEXT.md:31`: agent phải load 7 file `modules/host/orca/*.yaml`, chạy `providers.mjs`, và "the live `orca agent-context --json` signature is checked before effects" |

Kết luận: ranh giới trong code đã đúng, nhưng prose đẩy việc kiểm tra host lên agent. Agent
đọc 2.088 dòng contract Orca để "check" một thứ mà script lẽ ra phải check. Đây là nguồn
hallucinate: agent lắp lệnh `orca` từ `calls.yaml` thay vì gọi wrapper, hoặc "kiểm tra" live
schema bằng cách tưởng tượng.

Hai authority cho một argv: wrapper code (thật) và `calls.yaml` (tự nhận là nguồn). Comment
trong `worker-start.mjs`/`worker-stop.mjs`/`worker-release.mjs` ghi "calls.yaml classify,
evaluated in contract order" nhưng là chép tay, không load file.

Đường thứ ba: `skills/orca-cli/SKILL.md` dạy agent chạy `orca` CLI trực tiếp và
`orca skills get orca-cli`. Skill này cho chat của người, nhưng nằm cùng cây skill mà kernel
và op đọc.

**Luật đề xuất.** Không agent nào (kernel, op, chat, supervisor) chạy `orca` hay đọc
`modules/host/orca/*`. Kernel gọi `api.mjs`. Chat và supervisor gọi
`scripts/api/orca/<verb>.mjs` cho các verb đọc và `terminal-send`. Contract Orca là dữ liệu
cho `lib.mjs`, không phải tài liệu cho agent.

**Việc cụ thể.**

- [ ] `lib.mjs` load `calls.yaml`: `orcaRun(verb, params)` lắp argv từ `command` + `flags`,
      từ chối flag không khai. Wrapper thành thin, hết hard-code. Một authority.
- [ ] `lib.mjs` chạy `agent-context` một lần mỗi process (cache), so `compare: [command,
      flags]` trước mutation đầu tiên, `onMismatch` dừng như `calls.yaml` đã hứa. `providers.mjs`
      thêm `--live`.
- [ ] `CONTEXT.md:31` rút còn một câu: host calls đi qua `scripts/api/orca/`, agent không chạy
      `orca` và không đọc host contract. Xoá danh sách 7 file và câu check agent-context.
- [ ] `check-host-boundary.mjs`: đỏ nếu có `spawn*('orca'` ngoài `scripts/api/orca/`, hoặc
      prose agent-facing (`CONTEXT.md`, `modules/kernel/*`, `modules/ops/*`, `skills/{define-goal,
      start-kernel,workflow-chat}`) chứa lệnh `orca <verb>` thay vì đường dẫn wrapper.
- [ ] `skills/orca-cli` tách khỏi load path của kernel/op, hoặc ghi rõ ở đầu: chỉ cho chat của
      người, kernel và op không đọc.
- [ ] `modules/host/claude` và `modules/host/codex` rà cùng cách: contract nào không có script
      đọc thì hoặc có script, hoặc bỏ.

## supervisor-poll: đối chiếu `DEVIN_POLL_BUG.md` (2026-09-22)

Devin giám sát hai workflow AUTH và WSPV qua `poll.mjs`, ghi 7 mục runtime (A1–A7) và 8
finding sản phẩm (B1–B8). Trò kiểm tra từng mục A với code tại HEAD `6279f4895`.

| Mục | Devin nói | Trò kiểm tra | Nhận định |
|---|---|---|---|
| A1 impl→audit evidence | fixed `e881f0159` | `interface.implement.yaml:174` khai `E/screens/**/*.png + E/runtime.json + E/measurements.json`; audit đọc ở `:104` | Đúng. Nhưng câu hỏi mở của Devin quan trọng hơn fix: producer tự đo `measurements.json` rồi audit tin số đó. Audit phải tự đo bằng Playwright runner đã lock (cơ chế có sẵn ở `uat.assisted.prepare`) |
| A2 liveness classifier | fixed `6279f4895` | Regex có `esc (?:twice )?to` và braille `[⠀-⣿]…\d` | Đúng |
| A3 claude worker-start không mở circuit | open | `api.mjs:1011-1081` chỉ ghi circuit khi `authFailure` hoặc nhánh `readiness`; worker-start lỗi rỗng rơi ra ngoài → `providerHealth: null` | Đúng. `runtimes.yaml allocation.cooldownMs` đã là map theo `failureKind`, chỉ cần thêm key `worker-start` (data) và một nhánh trong code |
| A4 URL ask chết | open | `poll.mjs openAsks()` lấy event `ask-serving` cuối, không probe. **Nhưng** `serve-ask.mjs:568` đã emit `ask-serving-expired` và poll không đọc | Sửa rẻ hơn Devin đề xuất: poll đọc `ask-serving-expired` trước, HTTP probe chỉ cho URL chưa expired. `supervise.yaml:41` đã hứa "relayed only after re-verifying they answer 200", là prose-only contract |
| A5 ask bị supersede vẫn ASK-OPEN | open | Chỉ có 3 kind: `ask-serving`, `ask-serving-expired`, `ask-answered`. Không có `ask-withdrawn` | Đúng. Kind mới phải vào `serve-ask.mjs` hoặc `api.mjs` khi park ask thay thế, poll đọc |
| A6 kernel chỉ được watchdog đánh thức | watching | `api report` đã wake kernel sau khi commit row (practice 21/9, Derived 10). Lỗ còn lại là race trong chính turn của kernel: consume report rồi mới quyết định yield | Không đồng ý với phương án (a) poll tự wake: supervisor thành actor liveness thứ hai, trùng watchdog và trái `supervise.yaml never`. Sửa đúng chỗ: kernel chỉ yield sau khi `api status` mới nhất trả về không có frontier actionable. Một dòng trong `driver-loop.yaml` + `kernel-prompt.md` |
| A7 codex thiếu browser tooling | watching | `interface.draw` đã dùng `route.riskHints: [host-tool-required:image_gen.imagegen]` | Cơ chế có sẵn, chưa áp: `interface.audit` khai `host-tool-required:browser-dom`, agent card khai capability, route-model lọc |

**Sạn trong chính `poll.mjs` mà Devin chưa thấy.**

- `reportsSince` lấy `LIMIT 30` rồi mới lọc `report_id > since`. Hơn 30 report trong một
  interval thì report cũ hơn bị bỏ, và `lastReportId` nhảy qua chúng vĩnh viễn. Phải là
  `WHERE report_id > ?`.
- Interval 180000 ghi ở ba chỗ: `supervise.yaml:30`, `:31`, `poll.mjs:30`.
- `poll.mjs` là mechanism nằm dưới `modules/` (đã ghi ở mục host-boundary).

**Sạn trong chính file log của Devin.**

- Nằm ở `starci-academy-backend/DEVIN_POLL_BUG.md`, ngoài `.claude`. Repo quy định practice
  log ở `.experiments/practices/YYYY-MM-DD-<slug>.md` với Practiced/Observed/Derived/Open.
  Để ngoài thì lần supervise sau không đọc được.
- Mục B (finding sản phẩm) không thuộc file runtime; nó là evidence của audit, thuộc
  `.starciwork` của dự án. Devin đã tách nhãn đúng, chỉ sai chỗ để.
- A1 và A6 là hai quyết định thiết kế đang chờ thầy, không phải bug. Cần tách ra khỏi
  danh sách bug để không bị "fixed" nhầm bằng patch nhỏ.

**Việc đề xuất từ vòng này.**

- [ ] Chuyển `DEVIN_POLL_BUG.md` thành `.experiments/practices/2026-09-22-supervisor-round1.md`
- [ ] `poll.mjs`: `WHERE report_id > ?`; đọc `ask-serving-expired`; probe URL còn lại
- [ ] `api.mjs`: worker-start lỗi không phân loại → `failureKind: 'worker-start'`, cooldown từ `runtimes.yaml`
- [ ] `ask-superseded` event khi park ask thay thế
- [ ] `driver-loop.yaml` + `kernel-prompt.md`: yield chỉ sau `api status` mới nhất không có việc
- [ ] `interface.audit` `route.riskHints` + capability trên agent card
- [ ] Quyết định của thầy: audit tự đo hay tin producer (A1)

### Bổ sung A7 mới của Devin: dispatch bị reject vẫn chiếm binding

`rejectDispatch` (`api.mjs:1043-1046`) cố ý ghi `payload.managed = {dispatchId: <rejected>,
rejectedBeforeContract: true}` để reconcile có bằng chứng. Nhưng `explicitReportDispatchIdOf`
(`api.mjs:2016-2019`) và `reportDispatchIdOf` (`:2011`) đọc `managed.dispatchId` mà không
nhìn cờ `rejectedBeforeContract`, còn `requireDispatchedReportBinding` (`:2020`) so với
`contracts.dispatch_id`. Contracts đúng (ctx mới), payload sai (ctx cũ), nên report hợp lệ bị
từ chối `report-contract-unbound`. Một field mang hai nghĩa: "binding sống" và "bằng chứng
reject", chỉ phân biệt bằng một cờ mà người đọc không kiểm tra.

Không nên xoá binding khi reject như Devin đề xuất: mất bằng chứng cho reconcile (practice
21/9, Derived 4). Sửa đúng: report binding lấy từ `contracts` row (đã là nguồn thật), và
dispatch bị reject đi vào `payload.rejectedDispatches[]` thay vì đè `managed.dispatchId`.

- [ ] `report`/`check`/`settle` lấy dispatch từ `contracts`, không từ `payload.managed`
- [ ] `rejectDispatch` ghi vào `payload.rejectedDispatches[]`, không đè `managed.dispatchId`

## Tổng hợp sạn toàn repo (2026-09-22, HEAD `6279f4895`)

Bốn agent rà bốn mảng, trò xác minh trực tiếp các mục đánh dấu ✓. Số trong ngoặc là
file:dòng. Ưu tiên: P0 sai chức năng hoặc lừa người đọc; P1 gây hallucinate hoặc drift;
P2 vệ sinh.

### P0: sai chức năng, hoặc tài liệu hứa mà máy không làm

1. ✓ CI `todo-app-example.yml:89,166` gọi `node cli/main.mjs`, thư mục `cli/` không tồn tại;
   `--config architecture.json` cũng không có. Workflow không thể xanh.
2. ✓ Không workflow nào chạy `npm test`; CI chỉ chạy 1/86 spec. `example-coverage.yml:5` nhắc
   "root ci.yml" không tồn tại. Trigger `schemas/**` (`:12,18`) là đường dẫn đã bỏ.
3. ✓ `api.yaml:224-229` khai 5 refusal cho `enqueue` (`workflow-finished`, `unknown-op`,
   `already-queued`, `empty-paths`, `workflow-unknown`); `cmdEnqueue` không kiểm tra cái nào.
   Cùng file: `route-refused`, `spawn-failed`, `path-collision`, `path-illegal`,
   `plan-lineage-missing`, `contested-lease`, `effect-unknown` không xuất hiện trong `.mjs` nào.
4. `api.yaml:106` "a read never mutates the ledger" nhưng `observe` append events (`:403`).
5. `supervise.yaml:41` hứa URL ask "relayed only after re-verifying they answer 200";
   `poll.mjs` không probe (Devin A4).
6. `calls.yaml:5-9` hứa wrapper lắp argv từ contract và so live agent-context; không code nào
   làm (mục host-boundary).
7. `providers.mjs` được `CONTEXT.md:31` gọi là validator fail-closed; với claude/codex nó chỉ
   kiểm tra file parse được.
8. ✓ Private age key `examples/todo-app-backend/.starcistacks/dev/runtime/env/demo.agekey`
   tracked trong git, CI `live` job decrypt bằng nó. Nếu là demo key cố ý thì ghi rõ; nếu
   không thì rotate.
9. `dispatch.yaml:32` và `driver-loop.yaml:618` cite `engine/constants.mjs` cho TTL/limits;
   file 11 dòng chỉ export `ENGINE_SCHEMA` + `isEnrolled`. TTL thật ở `api.mjs:1095`.
10. `modules/goal/{anatomy,legality,archetypes,existing}.yaml` ~20 cite tới hàm không tồn tại
    (`cutOpFor`, `goalPhase`, `reviseGoal`, `openOwnerAsk`, `applyWorkflowAmendment`...).
11. `selection.yaml:223` cite `model-policy.mjs`, không tồn tại. `driver-loop.yaml:498`,
    `verdict-contract.yaml:139` cite `init/CLAUDE.md`; `init/` chỉ có `AGENTS.md`.

### P1: mâu thuẫn contract, hai authority, ghost-context

12. Mô hình cũ còn sống: `_common.yaml:95` "3 rows × 3 cells, coordinator, secondary";
    `registry.yaml:15,43` `executionModes.solo` + `levels: [user-coordinator,...]`;
    `host/claude|codex/index.yaml:11,22` solo mode + coordinator roles. `driver-loop.yaml:769`
    nói "there is no Coordinator". Vocabulary `coordinator` còn trong `api.mjs:1397,1438,1550`.
13. Concurrency: `profile-registry.schema.yaml:30` `const: 3`; `runtimes.yaml:21` `20`;
    `host/claude/*` bốn chỗ `3`; `_common.yaml` `3`.
14. `driver-loop.yaml:167` `cutExecution` chia một op thành N job song song; `dispatch.yaml:316`
    và `registry.yaml:41` `fanOutWithinOperation: forbidden`. Cần một câu nói rõ cut khác fan-out.
15. Verb list api ở 7 chỗ, 7 số khác nhau (README 8, CHANGELOG 8, CONTEXT 13, kernel-prompt 15,
    docs/cli 14, start-workflow.yaml ~13, api.yaml 17, code 18, `bin/starci.mjs:21` thiếu 5).
16. Blocker kinds ở 3 chỗ: `report-envelope.mjs:9`, `kinds.yaml:80`, `verdict-contract.yaml:79`,
    mỗi chỗ một câu "keep in step" trỏ chỗ khác. Outcome list ở 3 chỗ. Effort vocabulary
    viết 2 lần trong một hàm (`config.mjs:30,38`).
17. `normalizeOwnedPath` có 2 bản khác semantics: `api.mjs:1096` chấp nhận glob/absolute/`..`,
    `engine/admission.mjs:12` từ chối. Test giữ bản thứ 3 (`op-ipc.spec.mjs:63`).
18. `readOwnerConfig()` copy-paste ở `start-workflow.mjs:60` và `route-model.mjs:57`, mỗi bản
    lại dynamic-import `engine/config.mjs` như bản thứ 3 "preferred".
19. `workflows.phase` queued→running UPDATE + event trùng nguyên văn `api.mjs:1124` và
    `start-workflow.mjs:616`.
20. `jobs.status` không có CHECK; vocabulary chỉ ở `ledger-db.mjs:12` và `api.mjs:72-74`.
21. `CONTEXT.md:7` ghi enum của `settle` là `done|partial|failed|ask|blocked`; đó là enum của
    report. `verdict-contract.yaml:60` `settle` là `pass|fail|blocked`.
22. `CONTEXT.md:43,61,63` mô tả layout `features/<f>/{business,architecture,ui,...}`;
    `work-layout.yaml:9,12` dùng family `br, ac, fr, nfr, data, journey, decision, sds, ui,
    impl, uat`. `schemas/index.yaml:495,545,549` gọi cây SRS/SDS vừa "retired/dormant" vừa
    "current".
23. `supervise.yaml:26` "never writes the ledger" nhưng bước `kernel-dead` chạy start-workflow
    (claim inbox row). `CONTEXT.md:5` chat vá `.claude` mid-flight vs `CONTEXT.md:75` runtime
    maintenance là authority riêng.
24. Số trong prose: retry ×3/×5/×2 ở 4 chỗ; watchdog 300000 ở 7 chỗ; observe 180000 ở 3 chỗ
    và trùng số với supervisor poll và một Orca timeout; wedge 10 phút (`kernel-prompt.md:178`)
    vs stall 5-8 phút (`driver-loop.yaml:667`), không hằng số nào trong code.
25. Ghost `.json`: 8 profile `registry.json`/`runtimes.json`; `dispatch.yaml:154` `goal-plan.json`;
    `runtimes.yaml:5,23` `config.json`; ✓ `engine/config.mjs` 6 error string "Invalid
    config.json" trong khi file là `config.yaml`; `docs/config-format.md:10` liệt kê
    `config.example.json` không tồn tại.
26. Ghost khác: `engine/constants.mjs:3` trỏ `bin/starci-skills.mjs`; `runtime-root.mjs:24`
    hàm tên `readDistJson`; `start-workflow.mjs:101-110` "half-landed lane" merge mọi file
    trong `scripts/api/orca/`; `ledger-db.mjs:28-32` postmortem viết thành docstring;
    `.gitignore:29` giữ ignore chỉ để kể một thư mục đã xoá.
27. Docs vs code: `docs/installation.md:5` Node 20 vs engines 22.13; `:30` cài 6 skill, code
    cài 2; `docs/cli.md:5` phủ nhận `starci <verb>` mà bin có; `docs/ops.md:9` "31 manifests"
    thực 35; `docs/ledger-db.md:5` cite `LEDGER_DDL` không còn; `docs/releasing.md:20` dựa vào
    `prepack` không có; `config.example.yaml:37` `model/runtimes.yaml` sai path;
    `skills/define-goal:64`, `start-kernel:24`, `workflow-chat:31` mô tả label output
    (`LEDGER`, `WILL-WRITE`) mà script in khác.
28. Schema: ~28 `schema:` const dùng trong `modules/` không có trong catalog
    `schemas/index.yaml`; 2 file stamp const khác `id` (`agent-hierarchy`, `goal-plan`);
    `verdict-contract.yaml:152` cite `starci/workflow-report@1` không tồn tại;
    `knowledge/code-examples` hai spelling schema id được alias trong schema.
29. Ngôn ngữ: tiếng Việt trong `skills/define-goal:30-31,80`, `CONTEXT.md:5`,
    `supervise.yaml:8`, `modules/goal/{anatomy,archetypes,legality}`, `verdict-contract:115`,
    `driver-loop:484`, `knowledge/patterns/be/comment.yaml:234`. `docs/` sạch.

### P2: dead code, test, package, vệ sinh

30. ✓ 10 wrapper `scripts/api/orca/*` không ai gọi (orch-check/reply/send, run-show/use,
    task-list/update, worker-abandon/list/read). `scripts/agent/{health,kill,spawn}.mjs` chỉ
    được `docs/cli.md` nhắc. `admission.mjs` export `ownedPathLeaseRequests`,
    `retryDisposition`, `deriveRetryLineage` chỉ test dùng. `bias.mjs` export không ai import
    dù `--routing-bias` có trong define-goal.
31. ✓ 3 check không ai chạy: `sanitize-orca-fixture`, `probe-reference-conventions`,
    `spec/assets`. 3 check 28-38 KB chỉ spec của chính nó gọi: `check-work-surfaces`,
    `check-work-history`, `check-work-replay`. Chỉ 2/28 check được op yaml gọi.
32. Test: 6 spec chiếm gần hết 272s (`npm-package` 261s vì cpSync 503 MB `packages/`);
    4 spec hard-skip (`work-record-schemas` ×2, `work-change` ×2); 4 spec giữ scaffold
    "lane has not landed" đã vô nghĩa; 3 spec chủ yếu `assert.match` trên prose YAML
    (`progressive-spec-authoring` 57/64, `interface-audit-contract` 65/114); stub Orca thứ hai
    inline trong `start-workflow-restart.spec` với env var khác helper chung.
33. Packages: `packages/grammar/reference-renders/` 15 MB PNG tracked, không ai đọc;
    `packages/package.json` workspaces chỉ `eslint/*`, engines 20.9 vs root 22.13;
    `e2e-kit`/`fe-kit` chỉ examples dùng. `examples/todo-app-backend/coverage/` tracked
    dù CONTRIBUTING cấm generated output.
34. `package.json`: không `check`/`lint`; `tests/` + `scripts/` ship trong tarball;
    `.experiments/` tracked. `config.yaml` local đã drift so với example (`debug: true`
    không được document).
35. `api.mjs` 2248 dòng dưới header "One thin command"; `engine/index.mjs` import
    `scripts/checks/spec/` ngược tầng; `sleep` trong `orca/lib.mjs` là block đồng bộ.
36. Missing docs được cite: `docs/kinds.md` (work-layout, check-example-work),
    `docs/model-catalog.md` (4 profile), `docs/examples/todo-app-grit.md`,
    `examples/application-stacks/tiny-stateful`, `tests/sds-payload.spec.mjs`.

### Thứ tự đề nghị cho alpha.2

1. **Mặt tiền**: P0.1–2 CI (`ci.yml` + sửa hoặc xoá todo-app workflow), P0.8 quyết định key.
2. **Contract nói thật**: P0.3–7, 9–11. Mỗi refusal hoặc cite hoặc có code, hoặc bị xoá khỏi
   yaml. Bằng chứng: `check-contract-cites.mjs` đọc mọi `citation:`/`enforcedBy:`/`source:`
   và grep cái được cite.
3. **Một authority**: P1.15–20. Verb list, blocker kinds, normalizeOwnedPath, readOwnerConfig.
4. **Chôn mô hình cũ**: P1.12–14. Xoá coordinator/matrix/solo, chốt concurrency, cut khác fan-out.
5. **De-sediment CONTEXT.md**: P1.21–23 cộng mục feedback-sediment ở trên.
6. **Số vào data**: P1.24. Mỗi số một chỗ trong `runtimes.yaml` hoặc `driver-loop.yaml`, code đọc.
7. P1.25–29 và P2 theo sức.

## alpha.2 lanes (2026-09-22, base `f87a8f34b`)

Nguyên tắc sửa nằm ở `CONTRIBUTING.md` mục "Editing contracts and prose". Mỗi lane một
worktree, một allowlist, commit trên nhánh riêng, không push. Fable merge theo thứ tự
A, D, B, C rồi mới cắm E. Devin làm trên `main` trực tiếp theo allowlist riêng.

| Lane | Ai | Allowlist | Việc |
|---|---|---|---|
| A | Opus | `.github/**`, `package.json` scripts, `.gitignore`, `packages/package.json` engines | `ci.yml`, script `check`, trigger `modules/schemas/**`, ignore coverage |
| B | Opus | `modules/kernel/**`, `engine/**`, `scripts/kernel/{api,start-workflow,report-envelope,watchdog}.mjs` trừ vùng Devin, `route-model.mjs`, `runtimes.yaml allocation:`, `kinds.yaml blockers` | verb surface + check, refusal thật, observe, cites check, một authority cho list/hàm, số vào data, ghost engine |
| C | Opus | `modules/models/**` trừ 2 vùng của B, `modules/host/**`, `_common.yaml`, `modules/goal/**`, `modules/schemas/**`, `modules/quality/**`, `providers.mjs` | xoá coordinator/matrix/solo, concurrency một số, dead cites, `.json` ghost, catalog schema + check, host claims |
| D | Opus | `scripts/api/orca/**` xoá, `scripts/agent/**`, 3 check mồ côi, `tests/**`, `reference-renders`, `examples/**/coverage` | wrapper chết, scaffold test, stub Orca chung, `npm-package.spec` < 60s, untrack coverage |
| E | Opus, sau B+C | `CONTEXT.md`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/**`, `skills/**`, `.experiments/**`, `knowledge/` rename | de-sediment chat/kernel/watchdog, ghost `distless`, verb list cite, docs vs code, tiếng Việt |
| Devin | Devin | `modules/supervisor/**`, `scripts/kernel/serve-ask.mjs`, `scripts/kernel/api.mjs` chỉ `rejectDispatch`, `reportDispatchIdOf`, `explicitReportDispatchIdOf`, `requireDispatchedReportBinding`, `writeProviderCircuit` và nhánh readiness/auth; `scripts/kernel/terminal-liveness.mjs`; `modules/ops/ops/interface.{implement,audit}.yaml` | A3–A8 trong `DEVIN_POLL_BUG.md`, theo nhận định ở mục supervisor-poll |

**Nhắn Devin (thầy chuyển giúp):**

1. Đọc `CONTRIBUTING.md` mục "Editing contracts and prose" trước khi sửa tiếp.
2. Commit `1cc1f19ed` thêm câu "stale form URLs ... relayed only after re-verifying they answer
   200" vào `supervise.yaml` nhưng `poll.mjs` không probe. Hoặc probe, hoặc bỏ câu. Cùng commit
   câu "only the watchdog wakes them" sai: `api report` wake kernel sau khi commit row
   (`op-ipc.spec`). Sửa câu.
3. Commit `e881f0159` nhét luật vào `writes[].content` và ghép ba path bằng `+` trong một
   trường `path`. Luật vào `steps[].action`, mỗi path một entry hoặc một glob.
4. A7: không xoá `managed.dispatchId` khi reject. Report binding lấy từ bảng `contracts`;
   dispatch bị reject vào `payload.rejectedDispatches[]`.
5. A6: không cho `poll.mjs` wake kernel. Sửa ở kernel: yield chỉ sau `api status` mới nhất
   không có frontier actionable.
6. `DEVIN_POLL_BUG.md` chuyển vào `.claude/.experiments/practices/2026-09-22-supervisor-round1.md`
   theo format Practiced/Observed/Derived/Open; mục B đưa vào `.starciwork` của dự án.
7. `poll.mjs`: `reportsSince` phải `WHERE report_id > ?`, không `LIMIT 30` rồi lọc.

**Gate chờ thầy:** `demo.agekey` demo hay rotate; `todo-app-example.yml` sửa hay xoá; agent
được sửa record `examples/` không; A1 audit tự đo hay tin producer.

## Quyết định của Fable (2026-09-22, thầy uỷ quyền toàn bộ cho tới khi ra `1.0.0-alpha.2`)

1. **`demo.agekey`: giữ, là demo cố ý.** Key chỉ mở env demo của example `todo-app-backend`
   và CI `live` job cần nó để chạy không secret. Điều kiện: mọi thứ mã hoá bằng key này là
   giá trị demo, không có credential thật; `examples/todo-app-backend/README.md` và header
   workflow ghi một câu "demo key, committed on purpose, encrypts demo values only". Nếu sau
   này example cần secret thật thì key đi vào GitHub secret và rotate, không phải bây giờ.
2. **`todo-app-example.yml`: sửa cho chạy được bằng script hiện có, bước nào không có script
   thì xoá.** `node cli/main.mjs architecture check` thay bằng
   `node scripts/checks/check-scoped-lint.mjs --profile <nest|next> --root examples/<app> --all`
   và check architecture tương đương trong `scripts/checks/` nếu example có config; không có
   thì bước đó bị xoá. Không giữ `if: false`: bước hoặc chạy, hoặc không tồn tại. Workflow
   phải xanh trên tree hiện tại trước khi merge.
3. **Agent được sửa `examples/`.** Checker và schema dưới `modules/schemas/` là authority;
   record trong example phải khớp schema, không phải ngược lại. Evidence sinh lại bằng script
   sở hữu (`scripts/example/*`), không sửa tay. `tests/work-change.spec.mjs` và
   `tests/work-record-schemas.spec.mjs` bỏ skip: viết 8 schema còn thiếu từ record thật, sửa
   record cho khớp, hoặc sửa checker nếu checker mới là cái lệch so với `work-layout.yaml`.
4. **A1: audit tự đo.** `interface.audit` đo DOM/computed-style bằng Playwright runner đã lock
   (cơ chế của `uat.assisted.prepare`), qua `E/screens` + origin đang serve ghi trong
   `E/runtime.json` của producer. `E/measurements.json` của producer là self-report, audit có
   thể so chiếu nhưng không bao giờ là proof. Áp trước audit round 2. Vùng này thuộc allowlist
   Devin; nếu Devin chưa làm khi lane B, C, D merge xong thì lane G làm.

**Phạm vi `1.0.0-alpha.2`: mọi drift đã tìm thấy trong file này, không để lại gì.** Thầy chốt
2026-09-22: "tất cả các drift trò tìm thấy". Lane theo phụ thuộc:

| Lane | Chờ | Việc |
|---|---|---|
| E prose | B, C | mục feedback-sediment + ghost-context + P1.21–23, 25–29 phần docs/skills/CONTEXT |
| F2 examples | C | 8 schema thiếu từ record thật, bỏ 4 skip, evidence sinh lại bằng script |
| G supervisor | Devin | những mục Devin chưa landed khi B, C, D xong: poll.mjs sang scripts/supervisor, `WHERE report_id > ?`, ask-serving-expired, ask-superseded, worker-start failureKind, A7 contracts binding, A1 audit tự đo, riskHints |
| H op-shape | B, C | schema `starci/op@1`, `check-op-manifest.mjs`, `params` typed + `api enqueue --params` + packet.params, bỏ handoff/matrixHandoff không consumer, bỏ `business` block, migrate 35 op, sửa case interface.draw |
| I host-boundary | C, D | `lib.mjs` đọc `calls.yaml`, live `agent-context` một lần mỗi process, `providers.mjs --live`, `check-host-boundary.mjs`, `orca-cli` skill tách khỏi load path kernel |
| J quality-bar | C | QUALITY-BAR nhóm Evidence thành check (`done` → artifact tồn tại + digest khớp), tick checkbox bằng tên check |

**Điều kiện ra alpha.2:** `npm run check` xanh, `npm test` không skip nào ngoài PowerShell
7, CI `ci.yml` và `todo-app-example.yml` xanh trên `main`, CHANGELOG mục alpha.2 liệt kê
đúng những gì đã landed, tag `v1.0.0-alpha.2` sau khi thầy xem diff.

### Lane J landed: `check-evidence-binding.mjs` và ba lỗ schema cho F2/C

Check chạy trên example thật: todo-app-backend 122 `EVIDENCE_DIGEST_MISMATCH` (61 record) +
25 `ASSERTED_NOT_OBSERVED`; ecommerce-app-be 385 mismatch (10 record) + 2. Đây là drift thật,
evidence cũ hơn source. F2 sinh lại bằng `scripts/example/example-evidence.mjs`, không sửa tay.

Lỗ schema (C/F2 phải đóng trước khi F2 bỏ skip):

1. `codeDigest` là field mà cả example tree và `scripts/example/example-ownership.mjs` dùng,
   nhưng không schema nào dưới `modules/schemas/` khai. `work-evidence.schema.yaml` là
   `additionalProperties: false` nên mọi `evidence.yaml` trong example fail chính schema của nó.
2. `work-evidence.schema.yaml` require `provenance.servedVersions[].{repository,commit,artifact}`;
   0 record nào có. Field require mà không ai dùng thì hoặc bỏ require, hoặc example sai.
3. `work-implementation.schema.yaml` require `directory`, `files`, `revision`, `verification`;
   `work-layout.yaml` nói gate từ chối `directory`/`files` và dùng `owners[]`. Schema và
   layout phủ nhau; `work-layout.yaml` là authority, schema sửa theo.
4. `work-ui-screen.schema.yaml` không có viewport/breakpoint/theme/assets; `work-uat-flow.schema.yaml`
   không có video/recording/failure-path. Hai bullet QUALITY-BAR §5 chưa check được vì không
   có field để đọc. F2 thêm field khi viết 8 schema thiếu.

Check chưa vào `npm run check`: lane I hoặc lane cuối wire vào `package.json` `check`.

### Lane F1 landed: `todo-app-example.yml` chạy đúng những gì có

Bốn job `records`, `backend`, `frontend`, `live`; job `uat` cũ (npm ci vào thư mục không có
manifest, artifact glob không ai ghi) gộp vào `live`. Demo key mở 10 file `.enc`, tất cả là
cụm chữ thường ngắn, không vendor prefix, không DSN. Quyết định 1 đứng.

Hai bước còn đỏ trên tree hiện tại, để nguyên vì là drift thật:

- `check-example-work.mjs` từ chối 207 record (180 todo-app-backend, 27 ecommerce) vì
  `recordDigest`/`codeDigest` stale. F2 sinh lại bằng `scripts/example/*`.
- `check-scoped-lint.mjs` cả hai profile trả `ARCH_CONFIG_INVALID` vì `package.json` của
  example khai `file:../../packages/{e2e,fe}-kit` nằm ngoài `--root`. Cần check hiểu dependency
  path ngoài root khi nó nằm trong cùng repo (`scripts/checks/check-scoped-lint.mjs`, giao F2).
  Profile `next` thêm `CANON_VERSION_MISMATCH`: `modules/models/code-patterns.yaml:456` pin
  fe canon `3.0.2`, `packages/eslint/fe/package.json:3` là `3.1.0` (lane C).
- `modules/ops/ops/uat.verify.yaml:165` khai evidence dưới `E/`; harness thật
  `examples/todo-app-frontend/uat/lib/paths.ts:36` ghi `runs/<runId>/...` không có `E/` (lane H
  khi migrate op).
- 18 `.webm` UAT tracked dưới `.starciwork/**/videos/`: là evidence sinh bằng runner, giữ.

### Lane D landed: 10 wrapper, 3 CLI shell, 2 check mồ côi xoá; stub Orca chung; coverage untracked

Giữ lại có lý do: `terminal-list` (workflow-chat skill gọi), `bias.mjs` (`--routing-bias` sống
end-to-end qua define-goal → goal row → `cmdRoute`), `probe-reference-conventions.mjs`
(knowledge cite), `reference-renders/` (interface.audit và QUALITY-BAR cite).

Việc rơi sang lane khác:

- C: `calls.yaml` còn 10 entry không có wrapper (`run-use:60`, `run-show:66`, `task-update:79`,
  `task-list:85`, `worker-read:144`, `worker-list:150`, `worker-abandon:174`, `check:199`,
  `send:206`, `reply:212`) và `:34` nói reconcile đọc `task-list`/`worker-list` trong khi chỉ
  `worker-show` có code. Xoá entry hoặc ghi rõ "not issued by StarCi".
- E: `docs/cli.md:56,59,60` và `docs/host-contract.md:111` trỏ `scripts/agent/{spawn,health,kill}.mjs` đã xoá.
- B: `engine/ledger-db.mjs:296` comment nhắc `sleep` đã đổi tên `sleepSync`.
- H: `interface.implement.yaml:268-283` khai shape asset-manifest mà validator `spec/assets.mjs`
  (đã xoá, chưa ai gọi) từng check; giờ contract không có executable. Cho nó một check hoặc
  hạ claim.
- F2: 4 file critique trong `examples/*/.starciwork/_derived/` mang stamp path cũ, sinh lại.
- Chưa ai wire: `check-work-{surfaces,history,replay}` chỉ spec của chính nó gọi. Chỉ 2/24
  check được op gọi. H quyết định khi migrate op (proofs cite check nào).
- `probe-reference-conventions.mjs` cần `eslint` + `@typescript-eslint/parser` không có trong
  tree; Fable quyết: giữ như external-only workflow, header ghi rõ, không thêm devDependency.

Lưu ý cho mọi lane: worktree không có `config.yaml` (untracked) nên `goal-entry.spec` ×2
và `json-exceptions.spec` fail trong worktree, không fail trên `main`. Đó không phải regression.

### Lane C landed: mô hình cũ đã chôn, một số concurrency, catalog schema có check

`registry.yaml` một `executionModel`; `host/claude|codex` còn một `index.yaml` thật mỗi host;
`_common.yaml` hết matrix/cell; `runtimes.<pool>.maxParallel` là số duy nhất được code enforce;
~25 cite hàm ma trong `modules/goal/` đã thành luật do yaml tự sở hữu; `.json` ghost hết;
`check-schema-catalog.mjs` phủ 54 stamp; `json-exceptions.spec` xanh lại (đỏ từ trước vì 4
path storybook không có trên đĩa).

Việc rơi sang lane khác:

- E: `knowledge/code-examples/index.yaml:1` phải đổi stamp thành `starci/code-example-catalog@1`
  (alias đã bỏ); `CONTEXT.md:1` `distless`; `CONTEXT.md:31` live agent-context (lane I đang
  làm cho nó thành thật, E viết lại câu); `supervise.yaml:8` "theo dõi" (Devin/G).
- B: `driver-loop.yaml:289` cite `maxParallelOps` không ai enforce, hoặc enforce hoặc bỏ cite;
  `driver-loop.yaml:484`, `verdict-contract.yaml:115` còn `cấn cấn`; `engine/config.mjs` 6
  string `config.json` (đã trong brief B).
- H: ~15 op còn `reads: matrix` / `writes: matrixHandoff`, giữ vocabulary matrix sống qua
  registry sinh ra. Bỏ khi migrate op-shape.
- `maxParallelOps: 20` giữ tạm vì B cite; sau khi B quyết, C hoặc H xoá.

### Lane B landed: kernel contracts nói thật, một authority cho verb, list, hàm, số

18 verb ở mọi bề mặt + `check-api-surface.mjs`; refusal chỉ còn cái code in ra (`empty-paths`,
`unknown-op`, `workflow-finished` implement có spec; 3 refusal ma xoá; 5 đổi tên theo string
thật); `observe` chuyển sang nhóm write trong `api.yaml`; `check-contract-cites.mjs` phủ
`modules/kernel`; blocker kinds/outcomes/effort/job status mỗi cái một chỗ;
`normalizeOwnedPath`, `readOwnerConfig`, phase transition mỗi cái một implementation; số vào
`runtimes.yaml allocation.*`; ghost engine/kernel hết. Fable wire ba check mới vào
`npm run check` (`check-api-surface`, `check-contract-cites`, `check-schema-catalog`).

Quyết định của Fable trên các điểm B để mở:

- `already-queued` bỏ vì `cutExecution` cố ý enqueue N job cùng op; fence thật là path lease.
  Không thêm refusal cut-aware trong alpha.2.
- Không thêm `CHECK(status IN ...)` vào `jobs`; `JOB_STATUSES` trong `ledger-db.mjs` là vocabulary.
- `readDistJson` đổi tên: lane cuối (K) làm cùng `check-scoped-lint.mjs:7,186`.
- Refusal của `report` (`report-contract-unbound`, `report-dispatch-unbound`,
  `report-job-not-active`) document sau khi Devin/G sửa A7.

Việc rơi sang lane khác:

- E: `README.md:17` 8 verb; `docs/ledger-db.md:149-153`, `docs/host-contract.md:131`,
  `docs/workflow-kernel.md:89` còn tên refusal đã xoá; `docs/examples/todo-app-standard.md:111,194`
  path `scripts/example-evidence.mjs`; `runtimes.yaml:5,23` "config.json"; bare filename trong
  `citation:` ở `modules/goal/anatomy.yaml:344`, `legality.yaml:310-425`,
  `modules/schemas/relationships.yaml:46-137` (E hoặc H, chạy
  `node scripts/checks/check-contract-cites.mjs --scan modules --scan docs --scan CONTEXT.md --scan skills`).
- C đã xử lý: `selection.yaml` model-policy cites, profiles model-catalog, `work-layout.yaml:38`,
  `schemas/index.yaml:520`.

### Lane I landed: host boundary thực thi

`lib.mjs` đọc `calls.yaml` để lắp argv, live `agent-context` chạy một lần mỗi process trước
mutation đầu tiên, `providers.mjs --live`, `check-host-boundary.mjs` vào `npm run check`,
ba skill orca-cli/orchestration/computer-use ghi rõ "for the owner's chat only". 8 entry
`calls.yaml` không có wrapper đã xoá; `check` và `send` giữ vì recipes cần, ghi rõ thiếu wrapper.
Fable xoá fallback `orca account list` inline trong `scripts/api/quota/orca-account.mjs`.

### Lane E landed: prose nói một điều, một lần

`CONTEXT.md` 38 đoạn → 29, chín mâu thuẫn gỡ (chat ba vai, watchdog liveness-only, settle enum,
work layout cite, host boundary một câu). README/CONTRIBUTING/CHANGELOG cite authority; docs
khớp code; skills nêu người đọc và label đúng script in; `.experiments` S* row là layout thật.

Còn lại cho lane chốt K (sau H, G, F2):

- 16 cite bare filename cần path đầy đủ: `modules/goal/anatomy.yaml:345`,
  `modules/goal/legality.yaml:313,326,352,415,422,429`,
  `modules/schemas/relationships.yaml:46,49,52,55,55,58,61,64,137`.
- `config.example.yaml:37` `model/runtimes.yaml` → `modules/models/runtimes.yaml`.
- `scripts/example/example-render-proof.mjs:9` cite `docs/examples/todo-app-grit.md`;
  `scripts/checks/check-example-work.mjs:484,504` cite `docs/kinds.md` (F2 có thể đã sửa).
- `engine/schema.sql:118` cite `ledger-db.mjs:46-51` sai dòng → cite tên symbol, không số dòng.
- `.gitignore:2` `/.dist*/` ghost.
- `readDistJson` đổi tên + `check-scoped-lint.mjs:7,186`.
- `check-contract-cites --scan modules --scan docs --scan CONTEXT.md --scan skills` phải sạch;
  wire scan rộng này vào `npm run check` thay vì chỉ `modules/kernel`.
- `check-evidence-binding.mjs` và `check-op-manifest.mjs` (H) vào `npm run check`.

### Lane H landed: `starci/op@1`, params typed, 36 op migrated

619 finding → 0; catalog 13.522 → 10.829 dòng; `business`/`handoff`/`matrixHandoff` hết;
params: `interface.draw.candidatesPerScreen=1` (owner, max 3), `interface.audit.maxRounds=5`,
`provision.ask.minOptions=2`, `work.author.{maxFiles=12,maxProofDemands=8,componentsTriggeringCut=3}`,
`*.decide.readingsStated=3`. A1 audit tự đo landed. Hai corruption ngầm được sửa: blocker
`AUDIT_SCOPE_INCOMPLETE`/`AUDIT_INPUT_CHANGED` từng parse thành key `null`; `uat.verify` path `E/`.

## orca-hierarchy: vì sao sidebar Orca lộn xộn (2026-09-23, ledger nivo-backend)

Thầy thấy trong Orca: hai `[Kernel] wf-nivo-workspace-provision`, hai `[Op] interface.implement`
gpt-5.6-luna 18h nằm ở gốc, op "Idle" dưới một kernel. Đối chiếu:

| Sidebar | Ledger/Orca thật | Nguyên nhân |
|---|---|---|
| 2 kernel WSPV | signal `kernel` trỏ `term_d2f101cf`; terminal `term_aef50872` "Kernel orchestration…" vẫn sống, không có trong signal; kernel job đang ở attempt 4 | Restart kernel (watchdog/supervisor `start-workflow --goal`) tạo terminal mới nhưng không đóng terminal cũ |
| `[Op] interface.audit - Idle` dưới kernel | job `interface.audit a4` **failed** 15:52, dispatch `ctx_23ab4762` bị reject ở worker-start (chính là A7 của Devin), terminal `term_b6fa4c43` vẫn mở | `rejectDispatch` giải phóng lease nhưng không đóng terminal đã tạo |
| 2 `[Op] interface.implement` luna 18h ở gốc, có tick | `interface.implement a19` succeeded qua managed worker codex `ctx_427183f`; các Task managed cũ | Settle chỉ `worker-stop` + `worker-release`, không xoá Task; Task thuộc Run bind với terminal kernel **cũ**, kernel restart có terminal mới nên Task rơi ra gốc |
| Tiêu đề "devin.exe: Kernel orchestration for…" | `[Kernel] <wf>` chỉ áp lên Task display name | Rename terminal chỉ có cho managed worker, không cho terminal Devin |

`api hierarchy` của ledger thì đúng: mọi op đều `parent = agent:kernel:<wf>`. Cái sai là cây
Orca (Run → Task → terminal) không được đồng bộ khi kernel restart và khi job kết thúc.

**Luật:** một workflow có đúng một terminal kernel sống; job kết thúc (settle, reject, finish)
không để lại terminal hay Task sống; Run của workflow luôn bind với terminal kernel hiện tại.

**Lane L (sau G, vì cùng đụng `rejectDispatch` và settle):**

- [ ] `start-workflow.mjs` restart: đóng terminal kernel cũ (`terminal-close`) trước khi ghi signal
      mới; nếu đóng không được thì incident, không im lặng
- [ ] `rejectDispatch`: terminal/worker đã tạo thì đóng (`terminal-close` hoặc `worker-stop` +
      `worker-release`) trong cùng transaction reject
- [ ] settle/finish: đóng terminal cho mọi adapter, và với managed worker thì Task về trạng thái
      done/archived qua wrapper có contract (khôi phục `task-update.mjs` mà lane D xoá vì chưa ai
      gọi; giờ có người gọi)
- [ ] Kernel restart: Run của workflow re-bind với terminal kernel mới (khôi phục `run-use.mjs`
      nếu Orca cần lệnh đó), để Task mới nằm dưới kernel mới
- [ ] Terminal Devin/command-terminal: đặt title `[Kernel] <wf>` / `[Op] <op> a<n>` ngay khi tạo
      (`terminal-create --title`) thay vì để provider tự đặt
- [ ] `check`: một check đọc ledger + `terminal-list` và báo terminal sống không thuộc job
      sống nào (`ORPHAN_TERMINAL`), workflow có >1 terminal kernel (`DUPLICATE_KERNEL`)
- [ ] Practice entry cho vòng này

**Root cause chính xác (đọc code 2026-09-23):**

1. `scripts/kernel/start-workflow.mjs:563-565`: restart kernel `UPDATE jobs SET payload_json=?`
   thay **toàn bộ** payload của kernel job, nên `orca.runId` mất. Dispatch kế tiếp gọi
   `ensureWorkflowRun` (`api.mjs:1465`), không thấy runId, `run-create` một Run **mới** bind
   với terminal kernel mới. Task cũ ở Run cũ, Task mới ở Run mới: đó là hai cây trong sidebar.
2. `start-workflow.mjs:438-455`: kernel stale chỉ được `releaseManagedWorker` khi là managed
   dispatch; kernel Devin (`launch: terminal`) không bao giờ bị `terminal-close`. Signal bị xoá,
   job bị đánh `stopped`, nhưng terminal sống tiếp.
3. `createOperationTask` (`api.mjs:1506`) tạo Task với `run` + `from`, không dùng flag `parent`
   mà `task-create` có. Cây Orca suy từ Run, nên (1) là đủ để vỡ.

`.claude` **có** enforce lúc tạo: mọi op là một Task trong Run của workflow, `from` terminal
kernel, và ledger `hierarchy` là nguồn quan hệ. `.claude` **không** enforce liên tục: restart
không giữ Run, không đóng terminal cũ; reject không đóng terminal; settle không dọn Task; không
check nào so ledger với `terminal-list`. Lane L sửa đúng ba điểm này: giữ `orca.runId` qua
restart (merge payload thay vì thay), đóng terminal kernel cũ mọi adapter, và check.

## parallel-gear: số agent song song theo cỡ task, owner vặn một nút (2026-09-23)

Ý thầy: task dài 3 agent, siêu dài 6; vặn lên thì 5 và 10. Owner chỉ chỉnh một thứ.

**Hiện trạng.** `config.yaml budgets.maxOps` chỉ được validate, không ai enforce. Số thật là
`runtimes.<pool>.maxParallel`. `api estimate` tính slice từ `allocation.slicing` theo cửa sổ
15–30 phút, không theo lớp cỡ. Owner không có nút nào.

**Thiết kế.**

```yaml
# config.yaml (owner)
parallel:
  gear: 1          # 1 = thường, 2 = cao; mở rộng được, không đổi tên
budgets:
  maxOps: 8        # trần op đang chạy của một workflow, giờ enforce thật

# modules/models/runtimes.yaml (runtime data)
allocation:
  slicing:
    size:                                   # lớp cỡ theo closure đo được
      l:  {from: {files: 12, assertions: 40},  agents: {1: 3, 2: 5}}
      xl: {from: {files: 40, assertions: 150}, agents: {1: 6, 2: 10}}
```

- `api estimate` trả `size: s|m|l|xl`, `agentsRequested` (từ bảng × gear), `agentsAchievable`
  (số slice path-disjoint thực tế cắt được) và `reason` khi achievable < requested.
- Task `s`/`m` luôn 1 agent. Bảng chỉ áp cho `l`, `xl`.
- Trần cứng vẫn là `runtimes.<pool>.maxParallel` + slot provider + `budgets.maxOps`. Gear
  không nới trần; thiếu slot thì slice còn lại queued và `api status` nói vì sao.
- Ngưỡng `from` lấy từ số liệu thật: closure của các job implement/refactor trong ledger
  nivo (đọc bản copy, read-only), không đoán.
- `api status` thêm `queuedBecause` cho mỗi job queued: `pool-full`, `path-lease`,
  `dependency`, `circuit-open`, `max-ops`.

Lane M (Opus) làm việc này.

### Lane F2 landed: 8 schema, 4 skip bỏ, evidence replay, boundary `file:` sửa

Record bị từ chối 292 → 2 (hai `accounts.yaml` chứa credential literal của ecommerce, để
nguyên). Schema là cái lệch, không phải record, trừ 23 input sửa tay có liệt kê trong report.
`check-scoped-lint` profile `next` giờ chạy thật: 108 `ARCHITECTURE_VIOLATION` thật trong
`todo-app-frontend`, trước đây bị `ARCH_CONFIG_INVALID` che. 10 manifest ui/brand từng
claim pass giờ fail thật vì `verify-*.mjs` của chúng trước không load nổi.

**Còn đỏ, và vì sao:**

- `check-example-work` còn 88 record stale digest; 58 evidence cần Docker (Postgres/Keycloak,
  compose, SePay sandbox) để replay. Máy này Docker Desktop tắt. → Thầy bật Docker Desktop, trò
  cắm lane F3 replay nốt. Không có bước này thì job `records` của `todo-app-example.yml` đỏ.
- 26 `ASSERTED_NOT_OBSERVED` đều là `work/gap@1`: gap là record authored-by-nature, cần thêm
  vào `AUTHORED_BY_NATURE` của `check-evidence-binding.mjs` (lane K).
- `examples/todo-app-backend/architecture.json`: 8/10 owner entry trỏ barrel `<module>/index.ts`
  không tồn tại và bị chính rule `must-deep-module-import` cấm. Contract của example tự mâu
  thuẫn; lane K sửa owner entries theo rule.
- `CANON_VERSION_MISMATCH`: `code-patterns.yaml:456` pin fe canon 3.0.2 vs `packages/eslint/fe`
  3.1.0 (lane K).

### Lane L landed: cây Orca theo ledger liên tục

Run sống qua restart (payload merge thay vì thay), terminal kernel cũ đóng trước khi ghi signal
mới, Task có `parent` và title `[Op] <op> a<n> · <wf>` ngay khi tạo, reject/settle/finish đóng
terminal, worker và Task (`task-update --status done`, wrapper khôi phục), `check-orca-tree.mjs`
báo `DUPLICATE_KERNEL`/`ORPHAN_TERMINAL`/`DEAD_KERNEL`/`TASK_OUTSIDE_RUN` mỗi vòng poll. Luật ở
`modules/kernel/start-workflow.yaml orcaTree.rule`. Còn mở: Orca không có verb archive Task;
`TASK_OUTSIDE_RUN` chỉ báo, không reparent được.

## Model catalog (thầy chốt 2026-09-23)

Bỏ hẳn `gpt-6-astra`, Claude Fable (pool `claude-fable`, `fable-astra`), mọi `gpt-5.6-*`,
`claude-opus-5`. Catalog chỉ còn:

| Model | Id | Giá in/out per MTok | Nguồn |
|---|---|---|---|
| GPT‑6 Sol | `gpt-6-sol` | $2 / $10 | thầy, 2026-09-23 |
| GPT‑6 Luna | `gpt-6-luna` | $0.10 / $0.50 | thầy, 2026-09-23 |
| Claude Opus 5.5 | `claude-opus-5-5` | $4 / $20 | platform.claude.com models overview; 1M ctx, 128K out, adaptive thinking luôn bật, effort mặc định API `medium` |

Codex pool: easy/medium `gpt-6-luna`, hard/insane `gpt-6-sol`. Claude pool mọi tier
`claude-opus-5-5`. Devin, qwen giữ nguyên. Catalog không lưu giá. Lane N làm, kèm danh sách key
trong `config.yaml` local của thầy cần đổi.

## supervisor night log 2026-09-23

Supervisor: phiên "Nâng cấp .claude context", poll 10 phút (`config.yaml supervisor.pollIntervalMs`),
theo `modules/supervisor/supervise.yaml`. Hai workflow: AUTH `wf-nivo-app-auth-mub1d7gs`,
WSPV `wf-nivo-workspace-provision-mub1hxxt`.

- 03:05 WSPV kernel báo mọi dispatch chết ở `task-create`. Nguyên nhân: lane L truyền terminal
  handle vào `--parent`, Orca chỉ nhận task id; fake Orca chấp nhận nên suite xanh. Vá
  `3861d7723`, fake Orca giờ từ chối parent không phải task, `calls.yaml` ghi kiểu giá trị. Báo
  kernel qua `terminal-send`; kernel dispatch lại, audit round 2 bắt đầu báo `done` lúc 20:11.
- 03:08 `supervisor.pollIntervalMs` vào config (`e749d0c76`); lane M merge (`93536d4b5`).
- 03:12 `queuedBecause` báo sai: leg intake `request.analyze` chưa từng có job bị coi là chặn
  mọi job, `actionable` vẫn true. Vá `bd1647a4b`: leg trước chỉ chặn khi có job đang chờ/chạy;
  `readyOperations` chỉ đếm job `ready`. Lộ ra lỗi thật ở WSPV: 4 cell audit song song cùng giữ
  path `.starciwork/kernel-evidence/<wf>` nên path lease xếp chúng thành hàng (mở, xem dưới).
- 03:14 Một phiên khác replace mù `gpt-5.6`→`gpt-6` và ghi output `interface.draw` thẳng vào cây
  `main`; commit của trò cuốn nhầm rename, đã tách lại. Thay đổi lạ được stash (stash@{0}, không
  xoá). 03:17 phiên đó commit `43ddc335a` giữa lúc trò giải conflict merge lane N: nội dung đúng
  (lane N + phần giải conflict), message sai ("astra, Fable unchanged"). Đã nhắn phiên
  "Starci backend prompt batching".
- 03:20 Lane N vào `main`: catalog chỉ còn `gpt-6-sol`, `gpt-6-luna`, `claude-opus-5-5`.
  `config.yaml` của thầy đổi pool `fable-astra`/`opus-sol` → `sol-opus`, validate OK. Spec
  pool-full của lane M sửa sang `claude-agent` (`9be80cf96`).

- 03:30 Vá `path-kernel-custody` (`1f69780ec`): enqueue từ chối owned path trong
  `kernel-evidence|kernel-strays|kernel-approvals`. Digest gộp `TASK_OUTSIDE_RUN` (`c7cee13da`).
  Phiên draw xác nhận `43ddc335a` là của nó (commit nhầm cả index); nó sẽ tự land ui records
  bằng `git commit --only`. Phiên fork mở lane archetype spec-foundation/greenfield-scaffold,
  supervisor sẽ merge.

- 03:50 Thầy uỷ quyền: "thầy ngủ trò tự duyệt, miễn dậy xong workflows". Supervisor trả lời ask
  giao diện/direction thay thầy, ghi rõ trong note của receipt là trả lời theo uỷ quyền, kèm lý do.
  Không làm: UAT có người (đăng nhập, OAuth consent của thầy), chốt nhà cung cấp thanh toán
  (`decision.workspace-provision.payment-provider-shortlist` còn open). Vá thêm: ask theo ngôn
  ngữ thầy + mỗi lựa chọn có hình (`759b02af0`), runner UAT spawn npx trên Windows (`ca21ddb89`,
  `cc3d29d93`), watchdog `--repair` + chỉ wake khi actionable (`e21a2e77d`).

- 04:00 Theo uỷ quyền, supervisor trả lời ask login AUTH `ctx_1db4e4509029`: Desktop A + Mobile A
  (bố cục chia đôi, form phẳng; mobile cùng họ phẳng), lý do ghi trong note receipt. Kernel AUTH
  chạy tiếp implement a12 → audit a3. WSPV đang soạn lại ask checkout-review tiếng Việt có hình.
  F3 xong (53/65 replay, 19 fail thật) nhưng giữ chưa merge vì phiên draw chưa land ui records
  cùng file. F3 báo hai lỗi script: `example-derive.mjs:215` bỏ qua outcome evidence (record fail
  vẫn derive `done`), `check-example-work.mjs:557` cho qua record `done` có evidence fail.

- 04:10 Ask WSPV mới `ctx_8cc8fa06b8bd` đúng chuẩn (tiếng Việt, 4 chỗ lệch, mỗi hướng có hình và chi
  phí). Supervisor chọn A (giữ như sản phẩm thật): không hiển thị điều chưa có thật; A không chốt
  nhà cung cấp thanh toán. Thống kê từ 21/9 09:27: AUTH 24 succeeded / 23 failed (13 blocked,
  10 verdict fail); WSPV 39 / 54 (24 blocked, 30 verdict fail). Blocked là chỗ lãng phí cần đào.

- 04:40 Thầy chốt: chạy trên `main` mặc định, worktree chỉ khi prompt yêu cầu (`3557748a4`). Xoá worktree
  accounting (đã nằm trong main); commit WIP refactor 206 file vào nhánh của nó (`bab51287`), không merge.
  Thầy yêu cầu hai workflow mới (3 module + AgentOS; Collab chat nhóm): plan in chuỗi sai vì thiếu
  archetype full-stack; phiên fork thêm `feature-build-fullstack` trong lane archetype, chưa persist goal.
  Lane P (4 vá lãng phí) đang chạy trong worktree vì sửa api.mjs kernel đang chạy. `check-orca-tree` bỏ
  qua terminal của ledger khác (`0c434ed88`).

- 04:45 Thầy gõ `ok` cho hai goal mới (nivo-modules-agentos, nivo-collab-group-chat), có điều kiện: chỉ
  persist + start-kernel khi plan lập lại in đúng chuỗi `request.analyze > scope.define > business.decide >
  architecture.decide > interface.draw > work.author > backend.implement > interface.implement >
  interface.audit > e2e.verify > uat.verify > review.verify` (brand.decide chỉ khi chưa có brand đã duyệt).
  Lệch thì không persist, để sáng.

- 05:05 Merge lane archetype của phiên fork (`533f76be1`). Plan lại hai goal: prompt gốc khớp nhầm
  spec-foundation (5 leg, không implement) vì cụm "đóng SRS/SDS còn thiếu"; prompt modules khớp nhầm refactor
  vì tên nhánh WIP. Diễn đạt lại (giữ ý, bỏ hai cụm gây nhầm) thì cả hai ra 13 leg full-stack, nhưng có
  `brand.decide` trong khi nivo đã có brand duyệt (rev 1, 21/9) → trái điều kiện của thầy, KHÔNG persist.
  Phiên fork sửa cả hai lỗi planner (ưu tiên spec-foundation, điều kiện brand) trong nhánh mới.
  Prompt đã diễn đạt lại dùng để persist: bỏ "SRS/SDS còn thiếu" → "chốt nốt quyết định nghiệp vụ và kiến
  trúc"; bỏ câu nhánh refactor WIP khỏi prompt modules (WIP chỉ tham khảo, ghi ở đây).

- 05:20 Lane Q (routing theo độ khó của phiên fork) xanh nhưng HOÃN merge tới sáng: nó đổi route của mọi op
  cho hai kernel đang chạy; việc suy nghĩ sẽ thử claude-agent trước, mà Claude Code trên máy chưa xong
  onboarding (probe quota vẫn báo ok, không thấy màn onboarding) → mỗi dispatch think bị readiness từ
  chối, nghỉ 5 phút, rồi vẫn sang codex; implement medium chuyển sang qwen3.8-flash giữa các vòng sửa
  audit. Sáng: thầy xong onboarding Claude Code → merge lane Q (trial merge chỉ conflict
  tests/config.spec.mjs) → thầy quyết pin kernel.

- 05:40 Thầy cho merge luôn: lane Q (`6342c1e1d`) và planner fix (`5ea28d7d2`) vào main. Plan lại ra đúng 12 leg,
  brand ghi assumed → persist theo ok của thầy: `wf-nivo-modules-agentos-mud6zg6y`,
  `wf-nivo-collab-group-chat-mud6zgff`. Kernel Collab chạy (devin). Kernel modules: devin chết ngay 2 lần
  ("prompt was not consumed", terminal exited trống) — nghi trần phiên Devin vì app Devin desktop của thầy còn
  ~24 process từ 20h; codex 2 lần "Timed out waiting for terminal handle" phía Orca. Chưa chạy. Lane P xong
  (4 vá, replay không đổi job nào) nhưng đụng lane Q ở 6 file routing → agent lane P đang merge main vào nhánh.

- 06:00 Thầy tắt app Devin desktop (36 → 10 process devin) → kernel modules boot ngay trên devin
  (`term_b33015f6`). Watchdog `--repair` cho hai workflow mới. Merge lane P (`1aacfc3c5`, gộp với lane Q):
  audit và draw route sang codex (agent có trình duyệt/ImageGen trong nhóm think). Phiên fork báo Orca
  không tạo được terminal Codex tương tác từ ~21:45 giờ Orca (mọi repo) → audit/draw sẽ không dispatch
  được tới khi Orca hết kẹt; đã báo 4 kernel giữ job codex ở queued, một incident, không retry vòng.
  Lane Q2 (kernel theo nhóm) conflict với lane P → phiên fork merge main vào Q2.

- 06:05 tick: WSPV implement a27 done, 1 implement đang chạy, 1 ask chờ re-enqueue. Modules: scope.define a1
  done, frontier orphaned-frontier (kernel sắp suy leg kế). Collab: scope.define a1 blocked, a2 done. AUTH: kernel
  đang đọc report draw a5 để serve lại ask login (unserved > 1h). Không vá gì.

- 06:15 Merge lane Q2 (`6dd4bdd20`): kernel không ghim tự chọn trong nhóm Claude Opus 5.5 → GPT-6 Sol theo quota,
  boot tự chuyển thành viên khi launch hỏng không để lại gì. config.example ship nhóm; config.yaml của thầy vẫn
  ghim devin/swe-2-max, load OK. check + 63 spec xanh.

- 06:30 tick: Modules chạy 6 cut business.decide song song; Collab scope.define xong (a3). Ask login AUTH live nhưng
  form hiện 4 nhóm radio mua workspace của WSPV: serve-ask lấy draws.yaml mới nhất toàn cây khi report chỉ liệt kê
  draws.yaml. Supervisor trả lời Desktop B + Mobile B theo uỷ quyền (bỏ trống 4 nhóm lạc đề, ghi lý do). Vá
  serve-ask (`c2e4564cb`): ảnh lấy từ draws.yaml của report, bỏ fallback toàn cục, có options thì không suy picks.
  Merge lane P3 của phiên fork (`f68c490be`): baseline ghim phiên bản toolchain nest/next.

- 06:45 tick: Modules 6 cut business.decide (3 partial, 1 done); Collab business.decide 2 done 1 partial, 9 job ready;
  AUTH interface.draw đang chạy trên gpt-6-sol (worker-start managed vẫn chạy được, chỉ terminal Codex tương tác
  hỏng); WSPV implement a29 partial. 8 lần claude bị từ chối ở worker-start trong 50 phút (onboarding) → circuit 2
  phút reset → vòng lặp. Vá backoff (`7a8281413`): mở lại cùng lỗi trong 1h thì nghỉ x5, tối đa 1h.

- 06:55 tick: AUTH interface.draw a6 done (direction B+B). Collab business.decide 6 done, 1 partial, 1 blocked,
  transition-ready. Modules 3 job ready. Watchdog đúng việc: thấy active thì không đụng, AUTH báo idle-waiting khi
  frontier không actionable. Không vá gì.

- 07:00 Phiên fork báo Orca tạo lại được terminal Codex tương tác từ ~22:30 giờ Orca; đã báo 4 kernel nivo thôi giữ
  job Codex. Phiên fork mở lane P4: baseline Nest/Next qua được check-scoped-lint (layout module + architecture
  config, canon một authority).

- 07:15 AUTH bị watchdog đánh thức lặp: kernel ghi "[owner-gate-pending]" bằng văn xuôi, status vẫn báo 2 cut
  integration.verify là ready. Vá `6b6f0579f`: `api incident --kind owner-gate --holds` giữ job (queuedBecause
  owner-gate, route/dispatch từ chối), `--resolve` đóng incident (cũng là verb resolve còn thiếu). Kernel AUTH đã
  chuyển sang gate có cấu trúc (inc-4f9f44eb513a), actionable=false. Collab kẹt ở hộp thoại hỏi của Devin CLI;
  watchdog gõ lời đánh thức vào ô "Other" vì con trỏ ❭ giống prompt. Vá `134fee6a0`: gate agent-question-dialog
  + kernel-prompt cấm hỏi owner qua dialog. Trò Esc hộp thoại, trả lời 3 quyết định Collab theo ủy quyền:
  read-scope shared-office-read, safe-mode mandatory-category-gate, quality-targets ngưỡng tạm 2s/5s/3s p95.
  Mâu thuẫn scope.define (ghi work/node@1) với work-layout (cấm work/node mới) giao cho một lane nền.

- 07:35 Lane nền xong `b3469b05d`: scope.define ghi scope lên bản ghi feature (extensions.work3.scope), bỏ
  work/node@1; spec scope-define-layout. Trò thêm `034fbe6bb`: business.decide giữ nguyên scope khi viết lại
  overview. Báo kernel Modules về bản ghi work/node lạc ở features/project-overview/scope. Collab: 6 slice
  business.decide done với câu trả lời ủy quyền. WSPV audit vòng 3 blocked vì bằng chứng lệch revision
  (aae8d15 vs 02b3c0d) và hash accessibility tính trên JSON thu gọn; lỗi op (runtime.json do op tự viết),
  kernel đang xử lý. Backlog: workspace.manage vẫn ghi "setup scope record" gốc (work/node@1) và _common.yaml
  vẫn nói bản ghi gốc mang work/node@1; kinds.yaml còn work/node@1 cho workspace.manage và scope.finish.

- 07:45 Merge lane P4 `a26456e6d`: baseline Nest/Next qua check-scoped-lint, typecheck, test, build và boot.
  Đã review 4 thay đổi checker: settingMatches chỉ nhận đúng defaultOptions, bỏ spec khỏi NEST-FEATURE-FILE-SHAPE,
  cho phép transports rỗng, và export default định danh được tính là subject. Sau merge: check xanh, spec 31/31.
  Yêu cầu fork đặt test e2e baseline (~4.5 phút, cài package) sau cờ env, chạy ở checklist release.

- 08:00 Trả lời ask Modules (business.decide a8, tuyến công khai Sales) theo ủy quyền: phương án 1, đăng ký
  thao tác Sales có phiên bản trong Shared, giữ ý nghĩa đã duyệt; kernel đã được đánh thức. Câu hỏi hiện "Ch?n
  tuy?n": 7 report business.decide bị PowerShell ghi bằng code page cũ, còn bản ghi yaml thì nguyên vẹn. Vá
  `d3932b804`: api report từ chối văn xuôi mất ký tự non-ASCII, packet dặn ghi report.json dạng UTF-8. Merge
  `lane-p4/e2e-flag` (test e2e baseline chỉ chạy khi STARCI_E2E_BASELINE=1). Fork báo gap stale-input (job đã
  settle không bị đánh dấu cũ khi file knowledge đầu vào đổi digest); giao fork làm lane P5.

- 08:10 Yên. Collab architecture.decide 8 slice done; WSPV implement a31 done, kernel đang xử lý (transition-ready);
  Modules business.decide a10 partial, chờ op; AUTH owner-gate 4 + dependency 3, idle-waiting đúng. Không vá gì.

- 08:25 WSPV transition-ready 13 phút mà kernel báo active: câu tóm tắt "Running now:" của kernel bị đọc như spinner,
  nên wake theo report và watchdog đều bỏ qua. Vá `667195c4c` (từ trạng thái + ":"/"now" là văn xuôi) + spec; đã đánh
  thức WSPV, kernel đang chạy. Modules đã tiêu thụ báo cáo, chạy 7 op song song và dọn bản ghi scope lạc. AUTH, Collab chờ đúng.

- 08:35 Yên. Collab sang interface.draw (worker active). Modules 7 op chạy, scope.define a2 done (dọn scope lạc).
  WSPV kernel active, 1 job leased đang dispatch. AUTH chờ owner-gate. Watchdog: 3 idle-waiting, 1 active. Không vá gì.

- 08:50 Fork báo work-record-schemas đỏ trên main: lỗi của trò ở b3469b05d (object scope mở). Vá `2e6a0630e`: đóng
  request/nodes/deps/exclusions/openQuestions theo shape Collab+Login (cả hai validate), scope.define nêu đúng tên trường;
  project-overview (Modules) và public-website còn shape tự chế, không bị gate chặn. Merge lane P5 `5da28577c`
  (stale-input: digest input luật ghi trong contracts.context_json, không DDL; dòng cũ không bao giờ stale). Check xanh,
  82/82 spec; status live trên ledger nivo chạy, staleInput rỗng.

- 09:05 Modules architecture.decide: 3 slice done, 3 blocked vì quyết định SRS còn mở (accounting intake/budget/tax-estimation,
  5 quyết định chatbot, instance-management shell-api-authentication); kernel đang xử lý, có thể thành ask ở vòng sau
  (tax-estimation có thể mang tính pháp lý, sẽ hoãn cho thầy). WSPV audit a25 blocked do ảnh tablet sai viewport (op-defect).
  Collab interface.draw a1 done. Context kernel Devin 62-69%, theo dõi. Không vá gì.

- 09:20 Hai gap hợp đồng. (1) provision.ask Modules hỏi qua tin nhắn orchestration Orca, chờ 10 phút rồi blocked:
  hợp đồng chỉ nói "chờ". Vá `0171b19af`: op nộp report outcome ask (serve-ask phục vụ), không chờ trong lượt; đã báo
  kernel Modules chạy lại ask shell-api-authentication. (2) work.author Collab chạy trước backend.implement nhưng đòi
  nguồn/test đã tồn tại (a1, a3 blocked); giao lane nền thêm planned mode, đã báo kernel Collab không lặp retry.
  Kernel Modules đã tự compact (context 24%).

- 09:30 Lane planned mode xong `57273647a`: work.author trên feature greenfield lấy owner theo thiết kế (bản ghi todo), check
  dùng runner có thật + đường dẫn test mà op implement phải tạo, tài khoản vai trò là identity resource có blockers
  (không đổi schema). Validator đã khớp work-layout, không cần sửa. Check xanh, spec 126/126. Đã báo kernel Collab.

- 09:45 Modules đã hỏi owner theo kênh mới (4 ask). Lỗi: serve-ask supersede theo op id, nên ask Accounting xoá luôn
  ask Chatbot và Shell đang mở. Vá `76aaa2164` (supersede chỉ khi cùng params.subject/question.refs) và `52e9f12d6` (poll hiện
  ask phục vụ lại). Kernel đã phục vụ lại hai ask đó. Trả lời theo ủy quyền: Accounting 4 lựa chọn đề xuất; Chatbot 4 đề xuất,
  riêng giới hạn vận hành chọn cấu hình theo từng cài đặt (không bịa số); Shell: cookie HttpOnly + Bearer cho Core. Để thầy:
  ước tính thuế Accounting (a12) và ask WSPV checkout A/B/C (VNPAY/SePay; audit a28 đã chỉ ra đúng câu trả lời A trước đây của
  trò chạm vào nhóm payment-provider bị loại). Merge lane P6 `505fc60d2` (brand.decide có điều kiện cho spec-foundation).

- 07:45 (giờ thật) Sửa nhãn giờ: các dòng ghi 08:00 đến 09:45 ở trên thực ra chạy trong khoảng 07:05 đến 07:30 +07; trò đã
  ghi sai giờ. Vòng này: Collab work.author a5/a6 blocked vì owned_paths chỉ có features/collab/uat, planned mode chưa có slot
  environment/fixture, và a5 lại hỏi qua Orca ask thread. Vá `a9d886062`: _common.yaml một kênh hỏi owner cho mọi op; work.author
  thêm slot environment/fixture, kernel cấp thư mục slot. Modules chờ "ba ask" dù hai đã trả lời: wake lúc nộp gặp kernel active
  nên bị bỏ, và status awaitingOwner chỉ hiện attempt mới nhất của op. Vá `9945ae813` (theo subject/cut). Đã đánh thức Modules,
  báo Collab thư mục slot.

- 07:45 Tiến triển, không vá. Collab work.author a7 done (UAT slice sau vá slot), 7 job ready đang dispatch. Modules nhận
  ba câu trả lời, architecture.decide a7 done, kernel active. WSPV implement repair-round5 đang chụp lại ảnh; ask thanh toán chờ
  thầy. AUTH chờ owner-gate. Status Modules hiện đủ 3 provision.ask answered (vá 9945ae813 chạy đúng trên ledger thật).

- 07:55 Collab giữ 7 job backend.implement sau job composition "trong đầu" kernel; status báo ready nên watchdog đánh thức
  mỗi 5 phút vô ích. Vá `d5218813a`: enqueue --after ghi thứ tự vào ledger, status coi job có --after hoặc seam cut chưa xong là
  dependency; kernel-prompt dặn dùng. 7 job hiện tại đã enqueue trước vá nên vẫn bị đánh thức tới khi composition xong. WSPV
  implement a34 done. Fork báo gap: settle cho pass khi owned paths chưa commit/push dù commitPolicy đòi main-line; giao fork làm P7.

- 08:05 Modules architecture.decide a8 blocked: hợp đồng revise đòi extensions.work3.decisionLog nhưng 16 schema flat đóng
  work3 chỉ cho integrations; thêm mâu thuẫn "sửa deployment record" với "cấm sửa bản ghi legacy". Giao lane nền; báo kernel
  Modules giữ slice. Sửa phạm vi P7 của fork: ops nivo khai báo push:false (nivo-backend đi trước origin 198 commit), nên
  landed-check chỉ đòi owned paths sạch và commit có trong HEAD local; origin chỉ khi push:true.

- 08:20 Lane xong `09c3af799`: decisionLog (đóng, rev/at/gap/chosen/why/alternatives?) thêm vào extensions.work3 của 16 schema
  flat; phát hiện 15/16 schema chưa hề nối extensions vào properties (cả integrations mà business.decide đang ghi cũng bị từ
  chối). Luật legacy: phần chỉ nằm trong work/node cũ được sửa ở bản ghi flat tương ứng (rev 1 = chép lại, rev 2 = sửa,
  change.reason nêu bản legacy bị thay). Check xanh, spec 104/104. Đã báo kernel Modules chạy lại a8.

- 08:15 Không vá. WSPV audit a29/a31 failed vì lỗi thật (loading co/nhảy kích thước; 21 trạng thái thiếu dải chu kỳ
  thanh toán và gia hạn), a30 blocked vì route ma trận (/purchases/:id vs /provisioning) mâu thuẫn trong bản ghi: op-defect,
  kernel lo qua vòng sửa implement. Modules đang chạy lại a8 (leased). Collab chờ composition. AUTH chờ owner-gate.

- 08:25 P7 xanh nhưng chưa merge: 23/25 report implement gần đây của nivo thiếu head, nên settle pass sẽ bị từ chối hàng loạt.
  Yêu cầu fork: envelope đòi head cho op có commitPolicy (lỗi lúc report, worker còn sống sửa được) + luật chuyển tiếp ở settle
  (report cũ thiếu head: bỏ kiểm tra ancestor, vẫn đòi owned paths sạch). Scaffold/content/workspace commit "khi được phép" mà
  không có commitPolicy: đưa vào danh sách buổi sáng (quyết định quyền push).

- 08:25 Không vá. Modules architecture.decide a9 (Shell, chạy lại sau 09c3af799) done: vá decisionLog chạy đúng trên việc thật.
  WSPV kernel đang sửa theo audit. Collab composition vẫn active (worker còn output). AUTH chờ owner-gate. P7 chờ fork bổ sung.

- 08:35 Modules chỉ còn S1 Accounting chờ ask thuế của thầy, nhưng status báo orphaned-frontier (ask a12 mất lineage vì a13
  sau đó) nên watchdog đánh thức mỗi 5 phút. Vá `0213b58fb`: ask chưa trả lời luôn nằm trong awaitingOwner; không còn op mở +
  có ask chờ = frontier awaiting-owner, không actionable. Live: Modules awaiting-owner, liệt kê ctx_596b59ca7bd4.

- 08:50 Worker composition Collab treo 60 phút trên `... | xargs grep` đọc stdin; spinner làm nó trông active. Vá `45841bcc5`:
  liveness wedged (lượt > 30 phút, lệnh shell vẫn No output yet), frontier worker-wedged + wedgedJobs; live đúng. Kernel Collab đã
  dispatch lại composition. Merge P7 `71853d655` (report op commit phải có head; settle pass đòi owned paths sạch; report cũ thiếu
  head chỉ kiểm owned paths). Check xanh, 86/86. Báo kernel WSPV và Collab nhắc hai worker đang chạy ghi head.

- 09:05 WSPV kẹt: tin nhắn head của trò tới giữa lượt, Devin xếp hàng đợi và prompt idle chờ Enter; kernel đã consume report
  implement a35 (có head) nhưng chưa settle, frontier báo engaged nên không ai đánh thức. Trò bấm Enter, kernel chạy lại. Vá
  `febe53d87`: frontier settle-ready (report đã consume, job còn running) actionable + settleReadyJobs; liveness queued-input
  (chỉ khi idle), watchdog và wake của api/serve-ask bấm Enter. Live: WSPV settle-ready đúng a35. Collab backend.implement a1
  partial (composition), kernel đang xử lý.

- 09:15 WSPV đã settle a35 và chạy tiếp (Enter đã gỡ kẹt). Collab composition xong (a9), kernel chạy 7 slice backend.implement
  theo đúng dependsOn của bản ghi impl (gần như một chuỗi), nhưng status báo ready nên watchdog đánh thức vô ích. Vá `3b2767b26`:
  status đọc dependsOn của bản ghi Work trong owned_paths; owner đã succeeded thì giải phóng. Live: 6 slice dependency, không
  actionable.

- 09:20 Fork báo 3 lỗi. (1) của trò: workspace.manage prepare vẫn ghi bản ghi scope gốc .starciwork/<scope>/index.yaml mà
  layout cấm, nên dự án mới (Mia Mia) không bắt đầu được spec-foundation; giao lane nền (đích hợp lệ, schema đóng, spec bắt ghi
  gốc). (2) lineage retry của cut sai và (3) kernel báo active 3.7 giờ vì dòng spinner cũ: fork làm lane P8. Nivo không dính (3).

- 09:40 Lane xong `3edefde1b`: workspace.manage prepare/import/stacks ghi setup lên catalog gốc .starciwork/index.yaml tại
  extensions.work3.setup.<workflow>.<mode> (schema đóng, dùng lại các trường của scope); evidence ở .starciwork/evidence/<wf>.<mode>/;
  spec từ chối mọi manifest ghi bản ghi gốc ngoài layout. Check xanh, 46/46 (lane: 155 pass). Đã gửi fork các bước cho kernel Mia
  Mia. Còn mở: node fields của scope.finish vẫn liệt kê state/blocker/completion.

- 09:40 Không vá. WSPV audit a32 done, a33 failed, kernel đang xử lý (transition-ready). Collab 6 slice dependency theo
  dependsOn, watchdog idle-waiting (vá 3b2767b26 chạy đúng). Modules awaiting-owner (thuế). AUTH owner-gate. Ủy quyền hết 10:00;
  hai ask còn mở (WSPV thanh toán, Modules thuế) đều thuộc nhóm để thầy quyết.

- 09:50 WSPV yield dưới tiêu đề " Running (codex):" bị đọc thành spinner, 2 report audit chờ 20 phút. Vá `36be1bf2c` (dòng có từ
  trạng thái kết thúc bằng ":" là văn xuôi); đã đánh thức WSPV. Phát hiện: kernel WSPV sửa owned_paths trong payload job (ghi thẳng
  ledger, tự khai trong inc-f3f8d80df3dc) vì landed-check của P7 tìm đường dẫn frontend trong nivo-backend; giao fork P7b (resolve
  theo repo đích). Kernel cũng commit 94MB evidence vào nivo-backend với ALLOW_SECRET_SCAN=1: đưa vào danh sách buổi sáng.

- 09:55 Không vá. WSPV đã xử lý a32/a33 sau khi được đánh thức (vá 36be1bf2c đúng), một worker audit đang chạy. Collab 6 slice
  dependency, membership chạy. Modules awaiting-owner (thuế). AUTH owner-gate. Ủy quyền hết 10:00: từ đây trò không trả lời ask
  thay thầy nữa. Chờ fork: P7b (landed-check theo repo đích) và P8 (lineage retry cut, spinner cũ).

- 10:03 Ủy quyền đã hết, không trả lời ask. Collab membership xong (a10 done sau a2 partial), còn 5 slice dependency. WSPV một
  worker audit đang chạy. Modules awaiting-owner. AUTH owner-gate. Không vá.

- 10:13 Yên, không vá. WSPV worker audit active (có output), Collab slice conversation đang chạy, 5 dependency. Modules và
  AUTH chờ thầy.

- 10:23 Yên. WSPV worker interface.implement (ab51c9eaa9) nghĩ 35 phút nhưng lệnh đã xong và đang ra chữ: không treo.
  Collab slice kế tiếp chạy. Modules, AUTH chờ thầy. Không vá.

- 10:33 Yên. Collab backend.implement a3 (conversation) done, còn 4 slice dependency. WSPV worker implement vẫn active.
  Modules, AUTH chờ thầy. Không vá.

- 10:45 Kernel Collab bị báo active dù đã yield: dòng ngắt bắt đầu bằng "running." chữ thường khớp regex không phân biệt
  hoa thường. Vá `ddda061f1`: từ trạng thái phân biệt hoa thường. Live: cả 4 kernel turn-idle đúng. Collab 3/8
  slice backend.implement pass, routing đang chạy.

- 10:58 Phát hiện gốc: watchdog là tiến trình chạy lâu, nạp terminal-liveness một lần lúc khởi động (03:37-05:18), nên mọi
  vá classifier trong đêm không tới watchdog (Collab bị báo active). Vá `9270d970e`: vòng lặp chạy mỗi nhịp bằng một tiến trình con
  --once mới. Đã dừng và khởi động lại 4 watchdog nivo (log nối tiếp), cả 4 báo idle-waiting đúng. Báo fork khởi động lại 4 watchdog
  starci-next và mia-mia.

- 11:03 Yên. 4 watchdog mới chạy đúng (idle-waiting, không lỗi). Collab backend.implement a4 (routing) done, 4/8 pass, tasks
  đang chạy, còn 3 dependency. WSPV worker implement active. Modules, AUTH chờ thầy. Không vá.

- 11:13 Yên. WSPV interface.implement a37 done, kernel active đang settle (settle-ready đúng). Collab tasks đang chạy (4/8
  pass). Modules, AUTH chờ thầy. Không vá.

- 11:25 Form ask thuế của Modules hết ttl 4 giờ (dead) trong khi kernel awaiting-owner: thầy bấm vào link chết, không ai phục
  vụ lại. Vá `b2c0ce8ab`: ask chờ mà không có form sống = askReserveDispatches, frontier ask-reserve actionable. Đã báo kernel
  Modules phục vụ lại ctx_596b59ca7bd4. Form thanh toán WSPV vẫn sống (phục vụ ~07:26, hết ~11:26); bản vá sẽ bắt khi nó hết hạn.

- 11:35 ask-reserve chạy đúng: Modules đã phục vụ lại ask thuế (http://127.0.0.1:6970/a-2e190e5a4ba7e57e62, ttl mới 4 giờ),
  quay về awaiting-owner. Form thanh toán WSPV hết hạn đúng dự đoán, frontier liệt kê ctx_b77ce6a3b9a7, watchdog đã đánh thức
  kernel WSPV. WSPV audit a34 failed (kernel lo). Nhiễu: watchdog Modules một lần kernel-failed-screen thoáng qua, màn hình hiện
  không khớp mẫu lỗi, không restart.

- 11:45 Kernel WSPV bị đánh thức 2 lần vì form thanh toán hết hạn nhưng vẫn dẫn link chết: status dạng text không in reason hay
  askReserveDispatches. Vá `e4faf58ff`: text in reason và dòng ask-reserve kèm lệnh serve-ask; driver-loop nói link chết là việc, không
  phải chờ owner. Đã báo WSPV phục vụ lại. Collab tasks done (a5), approval và notification chạy song song, còn gateway.

- 11:53 WSPV đã phục vụ lại ask thanh toán: http://127.0.0.1:6969/a-a5b6a272f6c5354503 (vá e4faf58ff có tác dụng). Hai ask sống,
  không còn reserve. Collab approval và notification chạy song song, còn gateway. Không vá.

- 12:03 Yên. WSPV interface.implement a38 done và đã settle (rail height), 1 job ready kernel đang dispatch. Collab approval
  và notification chạy, còn gateway. Modules, AUTH chờ thầy; hai ask sống. Không vá.

- 12:13 Collab approval (a6) done, 6/8 pass; gateway ready (dependsOn không gồm notification), watchdog đã đánh thức kernel để
  dispatch song song với notification: record-deps (3b2767b26) chỉ ra song song đúng. WSPV audit chạy lại đang chạy. Không vá.

- 12:23 Collab notification (a7) done, 7/8 pass, gateway đang chạy. WSPV audit a35 failed nhưng hội tụ: F10, F12, F11 đã đóng
  qua a33-a35, chỉ còn F3 ("Provisioning order" hiện mã mua hàng thay vì mã đơn cấp phát riêng, có thể backend chưa có mã này).
  Kernel lo. Không vá.

- 12:33 Yên. Collab gateway đang chạy (7/8). WSPV worker sửa F3 đang chạy. Modules, AUTH chờ thầy; hai ask sống. Không vá.

- 12:43 Yên. Collab gateway và WSPV worker F3 vẫn active có output. Modules, AUTH chờ thầy. Không vá.

- 12:53 Yên. Collab gateway và WSPV worker F3 chạy khoảng 40 phút, vẫn có output, không wedged. Modules, AUTH chờ thầy. Không vá.

- 12:55 Fork: đã chuyển bước 3edefde1b cho kernel Mia Mia; thầy đã chọn offset-pop trước cho Mia Mia base-repos; 4 watchdog
  starci-next và mia-mia đã khởi động lại trên main (re-exec mỗi nhịp). P8 xanh nhưng đang merge main (giữ các hành vi liveness đêm
  qua), thêm api reconcile --retry-lineage cho job queued chưa dispatch. P7b đang làm (landed-check theo repo đích).

- 13:30 Thầy dậy, thấy sidebar nivo loạn (op mất tên, worker nằm ngoài, 58 agent) và chọn "xóa hết và restart", kernel
  mặc định Opus 5.5. Đã làm: snapshot 4 goal; dừng 4 watchdog; settle blocked 12 job mở; api finish 4 workflow; đóng mọi
  terminal nivo; đóng 160 task Orca (run-use terminal tạm vào từng run cũ, task-update completed); đang giải phóng 341 worker
  (abandon + release). Gốc rễ tìm ra và vá: settle/finish đóng Task bằng "done" mà Orca chỉ nhận completed nên chưa bao
  giờ đóng được (`8f2623030`); CLI ghi đè tên terminal, watchdog đặt lại [Kernel]/[Op] (`705cda9ef`); supervisor thêm kiểm
  tra hình thức TITLE_DRIFT, STRAY_TERMINAL và bước form mỗi vòng (`36ee7fe11`). config.yaml kernel = claude/opus-5-5.
  Merge P8 `fab36d654`, P7b `d1cb38455`, R `12a1ddb74`.

- 13:55 Test đầy đủ sau merge: 1208 pass, 0 fail, 4 skip. Đã tạo lại 4 workflow (chuỗi như đã duyệt, AUTH/WSPV bỏ brand vì
  brand đã xong): wf-nivo-app-auth-mudqjob3, wf-nivo-workspace-provision-mudqjokb, wf-nivo-modules-agentos-mudqjov6,
  wf-nivo-collab-group-chat-mudqjp5g. Kernel Claude Opus 5.5 không khởi động được (Orca hết giờ chờ handle) vì Claude Code
  chưa onboarding (~/.claude.json thiếu hasCompletedOnboarding); cần thầy chạy claude một lần. 242 bản ghi worker Orca giữ
  lại (identity_unproven) không giải phóng được bằng CLI; chỉ orchestration reset (toàn cục) xóa được.

- 13:44 Chờ thầy onboarding Claude Code (hasCompletedOnboarding vẫn chưa có). 4 workflow mới queued, chưa kernel, chưa watchdog.
  Hai worker cũ nộp report muộn (Collab backend.implement a8 done 05:59, WSPV interface.implement a39 done 06:01) vào workflow đã finish:
  code của chúng đã commit trong repo, workflow mới sẽ khảo sát lại.

- 14:00 Fork báo lane R lỗi: terminal create hết giờ chờ handle nhưng terminal vẫn được tạo và bị bỏ lại (R2 đang sửa: adopt-or-close,
  paste kẹt). Nivo dính y hệt: 3 terminal claude mồ côi đứng ở màn onboarding; đã đóng. Giữ nivo tới khi R2 xong và thầy onboarding.
  TITLE_DRIFT: tên bị CLI ghi đè liên tục (OSC mỗi lượt), đổi tên 5 phút không thắng; đề xuất CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1
  trong card claude, Codex/Devin đổi tên sau attest và mỗi lần wake. Lane S (fork) sửa bản ghi repository resource cho Mia Mia.

- 13:53 Vẫn chờ: thầy chưa onboarding Claude Code, R2 chưa về. 4 workflow nivo queued, không terminal nivo nào. Không vá.

- 14:05 Thầy chỉnh: supervisor là poll trong chat, chế độ debug, không có thân xác trong Orca. Trò đã sai khi tạo terminal
  [Supervisor] cleanup/probe; đã đóng, ghi luật chat-only-debug-mode vào supervise.yaml (`0c9f04b3c`); fork đã theo. Reset --tasks
  theo lệnh thầy: Orca về 0 task, 0 worker. Merge lane S `6b9d6d565` (repository ở workspace.yaml, không ở _resources); kernel Mia
  Mia chạy lại prepare. Còn chờ: thầy hoàn tất bước chọn giao diện của Claude Code, và lane R2.

- 14:15 Thầy hoàn tất onboarding Claude Code (hasCompletedOnboarding=true). Khởi động kernel Collab vẫn lỗi create: Orca hết giờ
  chờ handle, lần này không để lại terminal. Lane R không đổi phần tạo terminal, nên lỗi ở phía Orca với TUI agent tương tác
  (cmd và claude --version tạo được; claude --model ... thì không), cùng dấu hiệu sự cố Codex 21:45 tối qua. Đã gửi dữ kiện
  cho R2 (fork). 4 workflow nivo chờ R2.

### Vì sao job hỏng (đào 2026-09-23 04:20, 79 job failed của AUTH + WSPV từ 21/9)

| Nhóm | Số | Bản chất | Hướng vá |
|---|---|---|---|
| Audit/e2e/integration fail thật | ~20 | vòng chất lượng bắt lỗi sản phẩm | giữ |
| Chết không report | 27 | hạ tầng: dispatch reject, worker chết, đêm nay lỗi `--parent` | đã vá `--parent`, rejectDispatch đóng terminal (L) |
| Ask bị tính failed | ~16 | outcome `ask` settle thành blocked, đốt attempt, thổi phồng tỉ lệ hỏng | ask là trạng thái chờ: settle `awaiting-owner`, không tốn attempt |
| Dispatch khi điều kiện chưa đủ | ~7 | SRS/SDS todo, record audit chưa có, lineage draw chưa có | `api dispatch` kiểm `route.prerequisites` trước khi spawn |
| `provision.ask` không nói rõ hỏi gì | 5 | kernel gọi op hỏi mà không đưa câu hỏi → `QUESTION_UNCLEAR` | enqueue `provision.ask` bắt buộc params câu hỏi có cấu trúc |
| Sai công cụ theo provider | 3 | ImageGen/trình duyệt giao cho agent không có | route lọc `riskHints host-tool-required` theo capability agent card |
| Sai owned path | 1 | | |

Phát hiện lớn nhất: quyền uỷ nhiệm của thầy không tồn tại trong runtime, nên op draw AUTH a5 từ
chối câu trả lời A+A của supervisor. Vá `dab1859b8`: `config.yaml delegation` (asks, until,
excludes), packet mang `owner_delegation`, serve-ask ghi `answeredBy`. Op cũng cảnh báo Desktop A
có nguy cơ trái anatomy Grammar; supervisor sẽ chọn B+B khi ask mới lên để audit sau không fail cứng.

Mở:
- AUTH chờ hai gate của thầy: chọn direction login (form `ctx_1db4e4509029` đã `dead`, cần
  kernel re-serve khi thầy dậy) và chạy assisted OAuth run-04 (Docker đã bật; cần `npm run
  dev:env`, API :3068, FE :3067, rồi skill `run-assisted-uat`).
- ORPHAN_TERMINAL `term_b6fa4c43` (audit a4 failed trước lane L) vẫn mở.
- `owner-gate` chưa là một `queuedBecause`: job chờ thầy vẫn hiện `ready`.
