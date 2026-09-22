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
