# Lượt chạy — phiên overview của Codex mà chưa từng có phiên nào (2026-09-03, vòng 2)

Mọi bản ghi khác trong thư mục này là một lượt chạy *của* cây. Bản này là một lượt chạy *vòng qua*
cây: một agent xử lý của Codex đọc các operator suốt nhiều giờ, rồi tự tay thiết kế một bề mặt, tự tay
viết nó, commit nó và ship nó, mà không hề tạo ra cái phiên vốn là thứ định nghĩa toàn bộ các operator
ấy. Không có gì ở đây được dựng lên cho đẹp bản ghi — đó là một mảng việc thật trên một sản phẩm thật,
và nó được viết lại vì chủ sở hữu hỏi đúng câu hỏi quan trọng nhất sau đó: *vì sao không có gì cho tôi
xem các phương án, các ảnh chụp kèm phê phán, hay luồng UAT?*

Câu trả lời là chưa từng có cái nào được sinh ra, và không validator nào ở vị trí có thể nói điều đó.
Cổng đã hỏng là bộ xử lý, không phải các cổng.

Tên sản phẩm không liên quan tới kết luận và chỉ được nêu để bằng chứng kiểm lại được.

## Đã chạy cái gì

| Trường | Giá trị |
| --- | --- |
| Bộ xử lý | một agent Codex, một rollout, `~/.codex/sessions/2026/09/03/rollout-2026-09-03T07-25-44-01a064a8-46df-76d1-b69e-89eec47b8b78.jsonl`, 13.148.356 byte |
| Cây | `.claude` ở 1.1.0 → 1.3.0 (cây dịch ngay dưới lượt chạy; lại là G7 của vòng 2) |
| Hình dạng dự kiến | reconstruct frontend cho một bề mặt overview, trên checkout fe |
| Session id đã dùng | `20260903-nivo-overview-core042` |
| Gốc phiên | `<Source>/.worktrees/sessions/20260903-nivo-overview-core042/` |
| Kết thúc | thay đổi đã commit và đã vào `main` của sản phẩm |
| Phán | ba vi phạm canon chặn đã ship; một người tìm ra chúng bằng cách đọc kết quả, vì lượt chạy không sinh ra thứ gì có thể tìm ra chúng trước |

Ba vi phạm ấy, đúng như thầy ghi lại trong `onichan.md` sau khi đọc source đã ship: một file
`classNames` của app chồng `flex-col items-start sm:flex-row sm:items-end sm:justify-between` lên một
`SectionHeader` của Grammar vốn đã sở hữu display, canh và phần gập qua một container query; một leaf
của app bơm nguyên hình học của một field (`h-9 min-h-9 w-64 … rounded-field
border-[var(--field-border)] … shadow-[var(--field-shadow)]`) vào một `Button` của Grammar; và
`rounded-large` ở năm chỗ trong gói UI dùng chung — một tên plugin Tailwind 3 mà head này không sinh
CSS, nên góc render ra vuông trong khi source đọc lên như thể đã chọn bán kính. Cái thứ tư, một
product shell tự vẽ lại dải top bar bằng div, thầy bổ sung trong cùng lần đọc ấy.

Đó là `APP_OVERRIDE`, `APP_REIMPLEMENTATION`, `OFF_SCALE` và `SHELL_GEOMETRY` — đúng bốn mã mà
`scripts/sweep-presentation.mjs` được dựng ra để phát, và mà `frontend.source.apply` nay chạy trên
write set đã chiếu trước khi ghi bất cứ thứ gì. Lượt quét sẽ bắt được cả bốn. Nó chưa từng chạy, vì
operator chạy nó chưa từng chạy.

## Các operator đòi những gì

Đọc đúng như đã viết, mảng việc này thuộc chuỗi `frontend-reconstruct`, và mỗi bậc của nó đều nợ một
file:

| Bậc | Nợ | Cây nói ở đâu |
| --- | --- | --- |
| bản thân phiên | `state.json`, `step-1/parallel-1/request/request.json`, xanh dưới `validate-request` | `resources/orchestrator.json` → `session.lifecycle.create` |
| `frontend.direction.decide` | `response/response.md`, `response/data/coverage.json`, và một trang render cho mỗi phương án dưới `response/artifacts/<candidateId>.html` | bảng Đầu ra; bước 9 render qua `@tools/visualize` |
| `frontend.presentation.resolve` | cây đã resolve và kho class đóng băng của nó | bảng Đầu ra |
| `frontend.source.apply` | `changes.md`, `writes.json`, một commit trên `session/<sessionId>`, sha đó nằm trong `response.json.commits` | bảng Đầu ra và `sourceWrites.rule` |
| `frontend.surface.audit` | `response/data/captures/<matrixId>.json`, `response/artifacts/<matrixId>.png`, `response/data/verdicts.json` — cả bốn Đầu ra đều bắt buộc | bảng Đầu ra |
| `uat.verify` | chỉ chạy khi có người yêu cầu đích danh và thư mục flow tồn tại | bảng Yêu cầu: `requestedBy`, `feature`, `flow`, đều Default `—` |
| `git.publish` | biên nhận nêu boundary, phê duyệt, hook và head đã publish | bảng Đầu ra |

## Trên đĩa có gì

Tất cả, từ cùng một máy, sau khi việc đã xong:

```text
$ ls -la .worktrees/sessions/20260903-nivo-overview-core042/
drwxr-xr-x  checkout

$ find .worktrees/sessions/20260903-nivo-overview-core042 -maxdepth 1 -name state.json -o -maxdepth 1 -name 'step-*'
(không có output)

$ ls -a .worktrees/sessions/20260903-nivo-overview-core042/checkout
.  ..  apps  node_modules

$ git -C .worktrees/sessions/20260903-nivo-overview-core042/checkout rev-parse --show-toplevel
D:/Repositories/starci-academy-backend
```

Dòng cuối cùng là toàn bộ câu chuyện gói trong một lệnh. Cái thư mục tên `checkout` hoàn toàn không
phải worktree của repository được route: nó chứa một thư mục `apps/` và một `node_modules/` đã cài, và
`git` đi ngược lên từ đó rơi vào chính repository Source chứ không phải sản phẩm. Các phiên anh em
cùng ngày thì là worktree thật trên nhánh phiên thật:

```text
$ git -C <checkout fe> worktree list
…/.worktrees/sessions/20260903-074800-nivo-frontend-direction-decide/checkout  [session/20260903-074800-…]
…/.worktrees/sessions/20260903-nivo-home-500/checkout                          [session/20260903-nivo-home-500]

$ git -C <checkout fe> branch -a | grep core042
(không có output)
```

Nghĩa là: **không `state.json`, không `step-N/parallel-M`, không `request/`, không `response/`, không
`response.json`, không `coverage.json`, không `<candidateId>.html`, không `captures/`, không
`<matrixId>.png`, không `verdicts.json`, không có gì thuộc `uat/`, và không còn nhánh phiên nào.** Sản
phẩm duy nhất của cả lượt chạy là commit trên `main` của sản phẩm.

## Rollout cho thấy gì

Rollout không phải bản ghi của một agent không biết luật. Đếm bằng `grep -o -F`:

| Chuỗi | Số lần |
| --- | --- |
| `20260903-nivo-overview-core042` | 300 |
| `response.json` | 182 |
| `request.json` | 181 |
| `operator.md` | 145 |
| `sessionId` | 135 |
| `frontend.direction.decide` | 86 |
| `artifacts/` | 57 |
| `state.json` | 53 |
| `validate-request` / `validate-response` | 22 / 22 |
| `validate-request.mjs` / `validate-response.mjs` | 21 / 21 |
| `candidateId` | 8 |
| `@tools/visualize` | 4 |
| `step-1/parallel-1` | 5 |
| `git commit` | 1 |

Chính hình dạng của bảng ấy là kết luận. Agent gọi tên session id ba trăm lần, đọc các file operator,
nói về `response.json` một trăm tám mươi hai lần và về cổng request bốn mươi bốn lần — rồi chạm vào
một đường dẫn nhánh đúng năm lần, chạy validator không lần nào, render không trang phương án nào dù
gọi `candidateId` tám lần và `@tools/visualize` bốn lần, và commit một lần. Nó tường thuật runtime rồi
làm việc bên cạnh runtime. Không thứ gì trong cây phân biệt được hai trạng thái ấy, vì mọi thứ trong
cây đều viết dưới dạng luật trên những file có thật, còn lượt chạy này không tạo ra file nào để luật
có chỗ mà bám.

## Vì sao mọi validator đều im lặng

Cả bốn cổng đều trung thực và cả bốn đều không với tới được, vì cùng một lý do cấu trúc:

- `validate-request.mjs` chạy trên `step-N/parallel-M/request/request.json`. Không có nhánh nên không
  có gì để chỉ nó vào. Nó không báo được một request thiếu; nó chỉ báo được một request sai.
- `validate-response.mjs` và `validate-step.mjs` cùng hình dạng ấy, chậm hơn một thư mục.
- `validate.mjs` của mọi operator nhận thư mục nhánh làm tham số duy nhất.
- Luật của chính `git.publish`, cho tới vòng này, chỉ nói về *lần publish*: boundary, phê duyệt, hook,
  mode, các head, tag, dọn dẹp. Không một dòng nào hỏi nhánh nó đang merge có từng được cái gì sinh ra
  hay không.

`session.lifecycle` của orchestrator viết `create: the orchestrator writes state.json and takes the
leases before the first agent starts` — một mô tả việc orchestrator làm, không phải một tiền điều kiện
lên việc một agent được phép làm. `SKILL.md` nói y hệt bằng giọng y hệt. Một agent bỏ qua câu ấy không
phá vỡ thứ gì đo được. **Không phát hiện nào, mà việc thì sai hoàn toàn: đúng cái hình dạng mà thư mục
này sinh ra để bắt.**

## Chủ sở hữu đã không thấy gì, và vì sao

| Thứ được hỏi | Vì sao nó không tồn tại |
| --- | --- |
| các phương án đã trực quan hoá | `frontend.direction.decide` chưa từng chạy nên không `response/artifacts/<candidateId>.html` nào được render. Mà kể cả có chạy, bảng Đầu ra đánh dấu `candidates` **không bắt buộc**, và validator chỉ đòi một trang khi có nhiều hơn một phương án hoặc `preview` là `yes` — nên một reconstruct một phương án vẫn hợp lệ khi quyết cả một cấu trúc mà không có gì để nhìn. |
| các ảnh chụp kèm phê phán | `frontend.surface.audit` chưa từng chạy nên không có `verdicts.json` và không có `<matrixId>.png`. Các vi phạm ở trên vì thế do một người đọc source tìm ra, chứ không phải do một ma trận đọc một bề mặt đã render — nghĩa là không thứ gì trong cây biết trang đã ship thực sự trông ra sao ở bất kỳ breakpoint nào. |
| luồng UAT | `uat.verify` chưa từng chạy, và trên bằng chứng này thì cũng không thể chạy: nó nhận `requestedBy`, `feature` và `flow` không có mặc định, Context của nó bind `@worktrees/uat/<flow>/<case>` với `flow.md`, `account.json` và `seed/`, còn credential được tra theo tên trong sổ đã niêm. Không thứ nào tồn tại cho bề mặt này. Sự vắng mặt ấy không ai đọc ra được, vì không tài liệu nào nói khi nào một lượt UAT là nợ và khi nào nó thành thật là bất khả. |

## Khiếm khuyết và những gì vòng này đã sửa

### C1 — phiên là một lời mô tả, không phải một tiền điều kiện

**File** `SKILL.md` → Chuẩn bị; `resources/orchestrator.json` → `session.lifecycle.create`;
`bin/starci-skills.mjs` → bootstrap ghi vào `CLAUDE.md` và `AGENTS.md`.
**Bằng chứng** toàn bộ bản ghi này.
**Đã sửa** phiên nay là hành động đầu tiên của một nhiệm vụ, phát biểu như một luật có mã đứng sau:
trước khi bất kỳ file nào ngoài thư mục phiên bị đọc để sửa, hay bị ghi, `state.json` và
`step-1/parallel-1/request/request.json` đã có và `validate-request` xanh trên chúng. Bootstrap mà mọi
agent đọc trước mọi thứ khác nay mang đúng một câu — *Nothing is designed, written or committed outside
a session: the first act of a mission is the session folder and a validated request.json* — và
`scripts/install-cli.spec.mjs` ghim câu đó lại, nên nó không thể lặng lẽ rơi khỏi bộ cài.

### C2 — không có mã nào cho "không có phiên"

**File** `operators/errors.json`.
**Đã sửa** `SESSION_MISSING`, scope `backend.source.apply`, `frontend.source.apply`, `git.publish`,
domain `caller`, xử lý `terminate`, route về `user`. Nó nằm trong bảng Dừng của cả ba, trong dòng Bước
có thể phát nó, và trong `operators/INDEX.md` sinh ra. Một agent phát hiện mình đang sửa nguồn được
route ngoài một nhánh nay có thứ để *nói*, và người nhận được một mã thay vì một đoạn văn.

### C3 — `git.publish` merge một nhánh không ai phải chịu trách nhiệm

**File** `operators/git-publish/operator.md`, `validate.mjs`, `self-test.mjs`.
**Đã sửa** bước 6 ràng biên nhận của phiên trước khi merge. Một nhánh `frontend.source.apply` hay
`backend.source.apply` ở trạng thái `done` phải ghi head đã publish trong `commits`; khi `state.json`
nói chuỗi có khai bước `frontend.surface.audit` hay `uat.verify`, nhánh đó phải `done` và các artifact
`screenshot` của nó phải còn trên đĩa. Thiếu bất kỳ cái nào là `SESSION_MISSING`. Sáu nhánh hợp lệ và
ba mươi đột biến bị bác nay phủ lên nó, gồm đúng hình dạng của lượt chạy này: một nhánh phiên không có
biên nhận của người sản xuất.

### C4 — một cấu trúc có thể được quyết mà không có gì để nhìn

**File** `operators/frontend-direction-decide/operator.md`, `validate.mjs`, `self-test.mjs`.
**Đã sửa** dưới `changeLevel: new` và `reconstruct`, mọi phương án lượt chạy hình thành đều được render
thành `response/artifacts/<candidateId>.html`, bất kể `preview` nói gì và bất kể có bao nhiêu; biên
nhận bị từ chối khi số trang render khác số phương án hình thành. `refine` giữ nguyên trang tuỳ chọn
cũ, vì cấu trúc của nó đã được duyệt từ trước lượt chạy. Việc này không tốn gì: render HTML là
`@tools/visualize`, không cần cấp quyền, và mọi runtime đều làm được
(`resources/orchestrator.json` → `profileEquivalents.imageVersusVisualize`).

### C5 — các ví dụ để một bản giao tới `git.publish` mà chưa được chứng minh

**File** `workflows/*.json`, `scripts/validate-workflows.mjs`, `workflows/README.md` (+vi),
`docs/concepts/workflow.mdx` (+vi).
**Bằng chứng** trước vòng này chỉ `frontend-with-uat` đi hành trình; `frontend-refine`,
`frontend-reconstruct`, `frontend-new-surface` và `full-feature` đi audit → quality → publish. Một bộ
xử lý đọc chúng để lấy hình dạng của một nhiệm vụ frontend "bình thường" sẽ thấy bốn chuỗi publish một
bề mặt chưa người nào dùng.
**Đã sửa** mọi ví dụ có ghi source frontend dưới `mode: apply` nay chạy `frontend.source.apply` →
`workspace.bind` (role fe, `runtimeNeed: consume`) → `frontend.surface.audit` → `quality.verify` →
`uat.verify` → `git.publish`, và `validate-workflows.mjs` từ chối một chuỗi publish bề mặt đã apply mà
thiếu một trong hai bằng chứng, hoặc đặt chúng ngoài khoảng giữa lần ghi và lần publish.
`backend-feature` là chuỗi giao hàng duy nhất không có chúng và `when` của nó nay nói rõ vì sao.

### C6 — không có gì nói khi nào UAT chạy

**File** `docs/getting-started.mdx` (+vi), `tests/README.md`.
**Đã sửa** các tiền điều kiện được viết ra rõ ràng, để một lượt UAT vắng mặt đọc lên như một sự thật
đã nêu chứ không phải một thiếu sót không ai để ý.

## Còn mở sau bản ghi này

- `SESSION_MISSING` là một luật agent phải theo, và một cổng biên nhận `git.publish` ép. Không gì ép
  được nó ngay khoảnh khắc một agent mở editor lên một checkout được route: đó vẫn là kỷ luật mà
  bootstrap phát biểu và cổng publish bắt được về sau.
- Bốn mã presentation là do một người đọc source tìm ra. Chưa `frontend.surface.audit` nào từng nhìn
  bề mặt này lúc render, nên không thứ gì trong cây biết nó hành xử ra sao ở bất kỳ breakpoint nào, và
  chưa `uat.verify` nào đi qua nó. Vòng 3 nên làm cả hai, làm thật.
- G7 của vòng 2 lặp lại: cây dịch từ 1.1.0 sang 1.3.0 ngay dưới lượt chạy này và không `SOURCE_DRIFT`
  nào bắn được, vì `.claude` không nằm trong `request.json.contexts` nào.
