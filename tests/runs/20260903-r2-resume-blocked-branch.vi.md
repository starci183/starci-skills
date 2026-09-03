# Lượt chạy — chạy lại một nhánh bị chặn trên `frontend-reconstruct` (2026-09-03, vòng 2)

Một phiên khô của StarCi Skills 1.0.3 mà chủ đề duy nhất là lần chạy lại: đẩy `workspace.bind` trên
route `starci-academy/fe` vào một lần chặn thật, để `routing.json` trả lời, vào lại operator như một
bước mới với đúng liên kết resume mà bố cục phiên quy định, rồi đưa chuỗi đi thêm hai bước nữa. Gốc
phiên là `.worktrees/sessions/20260903-r2-resume/`, đã gitignore và giữ nguyên trên đĩa.

Mỗi nhánh dưới đây gọi tên profile mà `operator.json` của nó ràng buộc, và mọi nhánh đều thực sự chạy
bằng **Claude Opus** đứng thay theo `profileEquivalents` trong `resources/orchestrator.json`. Hai trong
ba operator ràng buộc `luna`, mà tương đương phía Claude là `sonnet`, nên những nhánh đó chạy trên một
model cao hơn một bậc so với ràng buộc; `frontend.direction.decide` ràng buộc `sol-fresh`, mà tương
đương khai báo *chính là* `opus`, nên đó là chỗ duy nhất trong phiên này mà người đứng thay và ràng
buộc cùng một hạng. Không một ranh giới profile nào được thử ở đâu cả. Không commit gì, không ghi gì
vào checkout frontend, không sửa file runtime nào trong `.claude`, và không chạy lệnh ghi git ở bất kỳ
đâu.

## Tóm tắt yêu cầu

| Trường | Giá trị |
| --- | --- |
| Workflow | `frontend-reconstruct` |
| Mục tiêu | `/[lang]/dashboard` — `src/app/[lang]/dashboard/page.tsx` gắn `DashboardPage`, và trang này soạn mọi block `src/components/blocks/dashboard/*` |
| Head frontend đã đóng băng | `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, chỉ đọc, cây sạch, nhánh `main`) |
| Head tri thức | `.claude` tại `3d30a88e4b5a4e56fab5502b54621b738be5654b` |
| Chuỗi yêu cầu | 1 `workspace.bind` (fe, `runtimeNeed: consume` từ preset của workflow) → 2 `frontend.direction.decide` → 3 `frontend.presentation.resolve`, rồi dừng |
| Chuỗi thực chạy | 4 nhánh cộng 2 nhánh dò có nhãn: 1 `workspace.bind` **blocked**, 2 `workspace.bind` **resume, done**, 3 `frontend.direction.decide` done, 4 `frontend.presentation.resolve` done; `step-9/parallel-1` và `step-9/parallel-2` là hai nhánh dò `UNKNOWN_STOP` viết tay, không thuộc chuỗi |
| Kết thúc | do chủ bài kiểm dừng sau bước resolve; `frontend.source.apply`, `frontend.surface.audit`, `quality.verify` và `git.publish` chưa từng được điều phối |

Các yêu cầu đến từ preset của workflow cộng với mặc định mỗi operator tự nêu. Một giá trị mà
orchestrator phải tự cấp là `declaredWriteRoots` — khoảng trống G3 của vòng 1 vẫn chưa vá, workflow vẫn
không preset gì cho nó. Một giá trị thì cố tình *không* cấp: `gitPolicy` được bỏ trống để mặc định đã
ghi trong tài liệu — "chính sách mà khai báo route mang theo" — được áp dụng, và đó là cách lượt chạy
này chạm tới chính sách `session-only` mà vòng 1 không diễn đạt nổi.

---

## Bước 1 — `workspace.bind`, parallel-1: lần chặn

**Trạng thái** `blocked`. **Mã dừng** `RUNTIME_NOT_READY`.
**Profile** `operator.json` ràng buộc `luna`; chạy bởi Claude Opus đứng thay (`luna` ↔ `sonnet`).

**Validator**

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-1/parallel-1
step valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

**Hiện vật đã ghi** chỉ `response/response.json`.

**Vì sao là lần chặn này chứ không phải lần kia.** Lần chặn do chính checkout chọn, không phải do dàn
dựng. Ứng viên đầu là `CHECKOUT_DIRTY`, mã mà vòng 1 đã thử trên route backend: nó cần một thứ gì đó
bẩn nằm ngoài các write root đã khai. Checkout frontend không cho gì cả —
`git -C D:\Repositories\starci-academy-fe status --porcelain` in ra không dòng nào — nên bước 1 đến 4 của
operator đều qua và không có cách trung thực nào bắt bước 4 dừng. Ứng viên thứ hai mới là thứ máy thật
sự đưa ra. `frontend-reconstruct` preset `runtimeNeed: consume`, nên bước 5 chạy, và bước 5 đọc sổ đăng
ký chủ runtime dùng chung:

```text
$ cat .worktrees/sessions/central-runtime/owner.json   # trích
  "generation": 6,
  "status": "ready",
  "endpoints": { "frontend": "http://localhost:3000", "api": "http://localhost:3001", "identity": "http://localhost:8080" },
  "updatedAt": "2026-09-01T19:54:08.2134007Z"

$ node -e "<mở TCP tới 127.0.0.1 trên từng cổng đã khai>"
3000:ECONNREFUSED
3001:ECONNREFUSED
8080:open
```

Sổ công bố một generation `ready` đã hai ngày tuổi mà listener frontend và API đều biến mất; chỉ
container danh tính còn trả lời. Luật của chính operator giải quyết chuyện đó: một sổ "thiếu, cũ hoặc
chưa sẵn sàng trong khi người gọi phải tiêu thụ nó" là `RUNTIME_NOT_READY`, người gọi là người tiêu
thụ chứ không bao giờ là chủ, và một thẩm quyền endpoint đã cũ thì "bị từ chối chứ không được tính lại
cho khớp". Nên nhánh dừng, và dừng mà không đụng vào gì — không khởi động tiến trình nào, không chiếm
cổng nào, không tính lại fingerprint nào.

**Định tuyến, giải bằng máy chứ không bằng mắt.**

```text
RUNTIME_NOT_READY -> domain runtime -> routing.json routes["workspace.bind"]["runtime"] = {"kind":"external"}  (disposition terminate, home operators/workspace-bind/errors.json, mayEmit true)
CHECKOUT_DIRTY    -> domain source  -> routing.json routes["workspace.bind"]["source"]  = {"kind":"resume"}    (disposition terminate, home operators/workspace-bind/errors.json, mayEmit true)
```

Đó là phát hiện thật đầu tiên của lượt chạy, và nó là một mâu thuẫn chứ không phải một bất ngờ.
`routing.json` nói `external`: dừng lại, và báo cái gì bên ngoài runtime phải thay đổi. Bảng `## Next`
của chính operator ấy nói ngược lại — "chủ runtime thiếu hoặc chưa sẵn sàng và phải nêu một yêu cầu
phối hợp → `platform.operate`" — và phần `resume` của chính mã đứng về phía bảng chứ không về phía bản
đồ: "Nêu một yêu cầu phối hợp tới chủ đã đăng ký và chờ một generation sẵn sàng." Ba câu nói về một lần
dừng, hai câu trả lời khác nhau. Nhánh ghi `next: ["external"]`, vì `routing.json` là bản đồ đóng mà
vòng lặp đọc còn bảng `## Next` thì không gì kiểm. Xem D1.

**Một nhánh bị chặn nói được những gì.** `response.json` là toàn bộ hồ sơ; `workspace.bind` không khai
loại output nào cho một lần dừng, và bộ từ vựng `Findings` của `workspace-route-binding` không có mã
nào phát biểu được một điều kiện chặn. Trường `reason` thêm ở 1.0.2 chính là thứ cứu nhánh này khỏi
cảnh chỉ còn trơ một mã: kết quả dò cổng, đoạn trích sổ đăng ký và lời từ chối tính lại đều nằm trong
một đoạn văn tự do dài 1 100 ký tự. Như vậy đã hơn sự im lặng của vòng 1, và vẫn chỉ là văn xuôi. Xem
D4.

## Bước 2 — `workspace.bind`, parallel-1 của bước 2: lần chạy lại

**Trạng thái** `done`. Không dừng, không fallback.
**Profile** `luna`; chạy bởi Claude Opus đứng thay.

**Validator**

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-2/parallel-1
step valid

$ node operators/workspace-bind/validate.mjs <session>/step-2/parallel-1
valid workspace.bind branch
```

**Hiện vật đã ghi** `response/response.md` (loại `workspace-route-binding`),
`response/data/route.json` (loại `route`), `response/response.json`.

**Lần chạy lại được bố trí thế nào.** `resources/orchestrator.json` quy định nó trong đúng một câu —
"một nhánh bị chặn vào lại chính operator ấy như một agent mới ở `step-(N+1)/parallel-1`, với
`request.json.resume` gọi tên bước và nhánh đã chặn; nhánh bị chặn nằm lại trên đĩa làm bằng chứng" —
và lượt chạy này theo đúng từng chữ. Request mới mang liên kết ấy hai lần, ở hai chỗ khác nhau, vì cây
hỏi nó hai lần:

```json
{
  "step": 2, "parallel": 1,
  "requirements": { "…": "…", "runtimeNeed": "none", "resume": "step-1-parallel-1-runtime-not-ready" },
  "resume": { "step": 1, "parallel": 1, "token": "step-1-parallel-1-runtime-not-ready" }
}
```

Đối tượng `resume` ở cấp cao nhất là trường của cổng, do `templates/step/request.schema.json` kiểm;
token `requirements.resume` là trường Requirements mà chính `workspace.bind` khai, do `validate-request`
đối chiếu với bảng Requirements của operator. Không validator nào so hai cái đó với nhau, và không cái
nào kiểm rằng `resume.step` gọi tên một nhánh thật sự đang bị chặn, hay rằng nó bị chặn trong *phiên
này*. Liên kết ấy là quy ước được hai schema chẳng liên quan gì nhau đỡ hộ. Dù vậy nó vẫn đúng hình
dạng vòng 1 đã dùng trên route backend, nên ít ra quy ước là ổn định qua các lượt chạy.

**Delta, nói thẳng.** Đúng một yêu cầu dịch chuyển: `runtimeNeed` từ `consume` sang `none`. Không ai
làm gì với runtime cả — sổ chủ vẫn công bố một generation sẵn sàng mà không có listener, và operator
này không được phép khởi động cái nào. Cái đổi là cái mà chuỗi yêu cầu: phiên này kết thúc ở
`frontend.presentation.resolve` và không bao giờ điều phối `frontend.surface.audit`, operator duy nhất
trong `frontend-reconstruct` cần một route được phục vụ, nên việc ràng buộc endpoint là yêu cầu của
*preset workflow* chứ không phải của công việc đang thật sự làm. Biên nhận nói thẳng điều đó ngay đoạn
mở đầu thay vì giấu chuyện thu hẹp, và việc thu hẹp là thật: chuỗi này không còn tới được một lần audit
nữa, và hồ sơ cũng ghi luôn điều đó.

Như vậy delta là trung thực dưới góc nhìn của `NO_PROGRESS`, mã có nghĩa là "lần chạy lại không thêm
bằng chứng, ràng buộc, inventory hay phê duyệt nào". Một yêu cầu bị thu hẹp là một delta ràng buộc.
Cũng cần gọi tên cái nó *không* phải: nó không phải bên ngoài thay đổi cái gì, mà đó lại đúng là điều
kind `external` của `routing.json` đòi. Xem D2.

**Nhánh đã ràng buộc gì.** `starci-academy/fe` → checkout anh em `D:\Repositories\starci-academy-fe`,
nhánh `main`, head `8d8ed9a1…`, loại kho `sibling` (nên mang theo thư mục tương đối `starci-academy-fe`
đúng như validator đòi), `authorityRoots.businesses` là `null` vì một checkout anh em không mang thẩm
quyền nghiệp vụ, `runtime` là `null` vì `runtimeNeed` giờ là `none`. Bước 1 đến 4 được chạy lại chứ
không tái dùng: luật resume chỉ cho tái dùng những quan sát có fingerprint không đổi, mà checkout thì
có thể đã dịch chuyển giữa hai nhánh. Nó đã không dịch chuyển.

Có hai thứ ràng buộc này diễn đạt được mà vòng 1 thì không. Chính sách được route là
`worktreeBranches: session-only`, lấy từ khai báo chứ không bịa, và `templates/kinds/route.schema.json`
giờ đã nhận — lỗi O1 của vòng 1 đã vá, và đây là lượt chạy đầu tiên chứng minh điều đó từ đầu đến cuối.
Và `writeRoots` không còn bị ép phải có ít nhất một phần tử trong schema (O10 của vòng 1, đã vá ở phía
dữ liệu). Phía tài liệu của O10 thì chưa: xem D11.

Thứ nó vẫn không nói được là chính sách *đang là* `session-only`. `## Findings` công bố
`WORKTREE_BRANCH_FORBIDDEN` mà không có đối ứng, và `operators/workspace-bind/validate.mjs` đòi finding
`forbidden` còn với `session-only` thì không đòi gì, nên chính sách duy nhất cho phép một operator ghi
nguồn được chạy lại là chính sách mà biên nhận im lặng. Xem D3.

Route đã hydrate vẫn ghi head `14e0c20f…`, chậm hai commit so với `8d8ed9a1…` quan sát được. Head quan
sát được mới là ràng buộc, còn bản ghi cũ chỉ là văn xuôi trong biên nhận, y hệt vòng 1, vì không mã
finding nào phủ được nó.

## Bước 3 — `frontend.direction.decide`, parallel-1

**Trạng thái** `done`. Không dừng, không fallback.
**Profile** `operator.json` ràng buộc `sol-fresh`; chạy bởi Claude Opus, chính là tương đương khai báo
của `sol-fresh`.

**Validator**

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-3/parallel-1
step valid

$ node operators/frontend-direction-decide/validate.mjs <session>/step-3/parallel-1
valid frontend.direction.decide branch
```

**Hiện vật đã ghi** `response/response.md` (loại `frontend-direction-decision`),
`response/data/coverage.json` (loại `ui-coverage`), `response/response.json`. Không trang ứng viên và
không ảnh: một ứng viên dưới `preview: no` không dựng trang nào, và validator từ chối một trang trong
cấu hình đó.

**Quyết định, và điều mà quan sát lại thay đổi.** Hướng là `dashboard-rail-owned-column`, đúng hướng
vòng 1 đã quyết trên bề mặt này: dashboard tự tay dựng một rail bên cạnh một track chính bằng class
ứng dụng và một listener `matchMedia` của ứng dụng, trong khi `PrimaryRailLayout` vốn đã sở hữu quan hệ
ấy và đang sống ba chỗ trong cùng checkout. Mười chín phần tử hợp đồng UI, tám vùng, sáu trạng thái, ba
nhánh responsive; mười ba đòn phản chứng, tất cả đều `holds`; không dòng tham chiếu và không dòng ảnh.

Việc quan sát lại không phải thủ tục và nó sinh ra hai dòng bằng chứng mới. Giữa head của vòng 1 và head
này, frontend đi thêm hai commit, và `git diff --stat 14e0c20f..8d8ed9a1` chạm chín file, tất cả nằm
dưới `packages/grammar/`. Mọi hiện vật dashboard mà hướng này trích dẫn đều giống hệt từng byte, nên mọi
quan sát mang sang được với hậu tố head viết lại thành `@8d8ed9a` — và hai dòng đã được thêm để nói đúng
điều đó, thay vì để một trích dẫn không đổi ngầm hiểu thành một trích dẫn không kiểm. Chuyện thực chất
duy nhất là `@starci/grammar` 0.4.0 → 0.4.2, trong đó `HorizontalScrollRegion` nhận thêm
`data-contract="PADDING-1 MEASURE-3 OVERFLOW-3 OVERFLOW-5"` và class riêng; đó là bản vá claim Grammar
của vòng 1 đáp xuống, và nó làm đổi bước 4.

Có một dòng lượt chạy này phải sửa chứ không chép: vòng 1 trích sổ composition là
`.claude/knowledge/grammars/starci/DNA.md:95-135@14e0c20`, tức một file `.claude` ghim vào head *frontend*.
`.claude` là kho git riêng của nó, và ô bằng chứng không có khái niệm head thuộc checkout nào; trích
dẫn nay là `DNA.md:107-125@3d30a88`, head của `.claude`. Không gì trong hợp đồng bắt được lỗi gốc — mẫu
của ô là `` `path@sha` `` và bất kỳ chuỗi hex 7 đến 40 ký tự nào cũng thoả.

**Ảnh, phán trên một runtime vốn không tạo được ảnh.** Bảng `## Images` rỗng vì phán quyết là không vùng
nào của bề mặt này đọc ra trống. Phán quyết ấy là thật, nhưng nó được đưa ra trên một runtime mà lựa
chọn không còn nghĩa: `operator.json` cấp `@tools/imagegen: judged`, còn
`profileEquivalents.imageVersusVisualize` giới hạn sinh ảnh cho profile OpenAI, nên người đứng thay phía
Claude dù quyết thế nào cũng không tạo được artwork. Hợp đồng ghi lại được kết cục đó — một dòng có ô
`File` là `—` là hợp lệ — nhưng không gì bắt buộc, và một bảng rỗng bây giờ đồng thời có nghĩa "không
cần ảnh" và "không thể có ảnh", không cách nào phân biệt.

## Bước 4 — `frontend.presentation.resolve`, parallel-1

**Trạng thái** `done`. Không dừng, không fallback. `contractEmission: on`, `maxRounds: 2`.
**Profile** `operator.json` ràng buộc `luna`; chạy bởi Claude Opus đứng thay.

**Validator**

```text
$ node scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-4/parallel-1
step valid

$ node operators/frontend-presentation-resolve/validate.mjs <session>/step-4/parallel-1
valid frontend.presentation.resolve branch
```

**Hiện vật đã ghi** `response/response.md` (loại `frontend-presentation-resolution`),
`response/data/inventory.json` (loại `inventory`),
`response/artifacts/dashboard.resolved.tsx` (loại `resolved-tree`), `response/response.json`.

**Kết quả giải.** Mười một dòng bản đồ chủ sở hữu, năm thuộc Grammar và sáu thuộc ứng dụng; ba mã luật
(`GAP-4`, `GAP-5`, `MEASURE-2`), bảy token class, hai mươi bảy lần gỡ bỏ trên sáu nút. Không một
`RULE_MISSING` nào: mọi thuộc tính mà lượt duyệt chạm tới đều giải về một case đã công bố. Phép kiểm
thứ tự sang bậc đã qua — `GAP-5` dựng ra `gap-6`, không bao giờ `gap-5` — và validator của operator xác
nhận mọi class trong inventory đều có mặt trong cây đã giải, và mọi luật đã áp đều được một nút nhận
dưới token `data-contract`.

**Dòng duy nhất mà lần dịch chuyển Grammar làm đổi.** Vòng 1 ghi đúng một dòng `## Gaps` và biện minh
bằng hai mệnh đề: Common không phơi ra đường công khai nào để chặn trục inline của lịch đóng góp từ bên
ngoài, *và* `HorizontalScrollRegion` không sở hữu gì mà một lần audit đo được. Mệnh đề thứ hai nay sai.
Ở `@starci/grammar` 0.4.2 composite ấy mang `starci-core-horizontal-scroll-region` và nhận
`MEASURE-3 OVERFLOW-3 OVERFLOW-5 PADDING-1`, và `knowledge/grammars/starci/DNA.md:117@3d30a88` ghi đúng
bốn luật ấy cho nó. Khoảng trống sống sót nhờ mệnh đề đầu, và được viết lại: chỉ block dựng lịch mới
soạn được vùng cuộn ấy, còn `OverviewContributions` không công bố prop nào để bề mặt này nhờ vả. Dòng
trong biên nhận và `inventory.gaps[0].missingPath` mang đúng cùng một câu mới, và đó chính là thứ
validator của operator đem so.

Hai khoảng trống tri thức của vòng 1 đã kiểm lại tại `3d30a88` và vẫn còn mở: `padding.md:64-65` vẫn
liệt `` `Rail` | body, inset="content" `` hai lần, một lần là `PADDING-3` và một lần là `PADDING-5`, nên
biên nhận nhận inset của rail vẫn không nói được là cái nào (K3 vòng 1); và `overflow.md:55` vẫn điều
kiện `Rail` theo `height!="fill"` cho `OVERFLOW-3` trong khi bảng owned điều kiện theo `height="fill"`
cho `MEASURE-6`, nên một rail vẫn không thể vừa lấp đầy vừa cuộn (K2 vòng 1). `PADDING-9` thì đã đáp
xuống và được công bố ở `padding.md:251`.

---

## `state.json` ghi lại được gì qua lần chặn và lần chạy lại

`state.json` là file duy nhất trải qua cả hai nhánh, và đọc ngược nó là cách sạch nhất để thấy bố cục
mang được gì và không mang được gì.

| Khoá | Qua lần chặn và lần chạy lại |
| --- | --- |
| `chain` | `[["1/1"],["2/1"],["3/1"],["4/1"]]` — bốn vị trí cho một workflow ba operator. Lần chặn ăn mất một vị trí, nên `frontend.direction.decide` là bước 3 của một chuỗi mà workflow gọi nó là bước 2. Khoảng trống orchestrator số 1 của vòng 1, chưa vá. |
| `steps` | `1/1` và `2/1` đều trỏ về `workspace.bind`. Không gì trong hình dạng đã tài liệu hoá nói cái thứ hai là cái thứ nhất chạy lại chứ không phải một lần bind route khác. |
| `current` | `4/1`. Nó đi qua lần chặn mà không ghi rằng đã có một lần chặn. |
| `requestHashes` | sáu mục, một cho mỗi request kể cả hai nhánh dò; `validate-request` đối chiếu từng cái và cả sáu đều khớp. Đây là phần duy nhất của `state.json` mà một script thật sự đọc. |
| `leases` | bốn, mỗi cái gọi tên profile ràng buộc và người đứng thay: `workspace.bind@luna-profile/run-by-claude-opus`. Lease là văn xuôi; không gì đối chiếu nó với `operator.json`. |
| `status` | `stopped-by-test-owner`, một giá trị không có trong enum đã tài liệu hoá (`running \| blocked \| done`). Vòng 1 cũng ghi đúng giá trị ấy; cả hai lần đều không bị từ chối. |

Hai khoá được bịa ra cho lượt chạy này vì lần chặn và lần chạy lại vốn vô hình:
`resumes: { "2/1": { "resumes": "1/1", "stop": "RUNTIME_NOT_READY", "delta": "runtimeNeed consume -> none" } }`
và `probes`, gán nhãn `9/1` và `9/2` là hai nhánh cố ý nằm ngoài chuỗi. Cả hai đều được nhận mà không ai
phàn nàn, và đó chính là phát hiện: `state.json` không có schema, nên một lần chạy lại có thể được ghi
trong một khoá bịa hoặc không ghi gì cả, và cả hai đều qua. Xem D10.

## `validate-step` nói gì về bước bị chặn so với bước chạy lại

Cả hai đều nói `step valid`, và đó là đúng chứ không phải dễ dãi. `validate-step` chạy
`validate-request` rồi `validate-response` trên cùng một nhánh, và `validate-response` chỉ bắt buộc một
Output khi `response.status === 'done'`:

```js
if (files.length === 0) { if (isYes(row.required) && response.status === 'done') errors.push(`… required output ${kind} is not in fields`); continue; }
```

Nên nhánh bị chặn, với `fields` là `{}` và không có `response.md` lẫn `route.json`, xanh đúng theo tinh
thần của cây: một lần chặn hợp lệ là một kết cục hợp lệ. Nhánh chạy lại xanh theo đúng chiều ngược lại —
đủ cả hai output bắt buộc, phần markdown đối chiếu với `workspace-route-binding.contract.json`, phần dữ
liệu đối chiếu với `route.schema.json`, rồi `operators/workspace-bind/validate.mjs` đọc chéo hai cái ấy
với nhau qua hơn hai chục khẳng định.

Điều hai phán quyết ấy **không** phân biệt được là bất cứ thứ gì về chính lần chạy lại. `validate-step`
không hề nhìn `request.json.resume`; nó không kiểm rằng `1/1` đang bị chặn, rằng `2/1` gọi tên nó, rằng
hai operator id trùng nhau, rằng delta khác rỗng, hay rằng nhánh chạy lại thuộc cùng một phiên. Một
request `step-2` với `resume: {"step": 47, "parallel": 3, "token": "x"}` sẽ qua cả hai nửa. Lần chạy lại
được bảo đảm bởi văn xuôi của orchestrator và bởi không đoạn mã nào.

Có một sự bất đối xứng đáng gọi tên: nhánh bị chặn xanh *vì* nó bị chặn, nên một lần chặn bịa là màu
xanh rẻ nhất trong cây này. Thứ duy nhất đứng giữa một lần dừng thật và một lần dừng bịa là đoạn văn
`reason`, mà không validator nào đọc.

## Nhánh dò `UNKNOWN_STOP` — hai nhánh có nhãn, giữ nguyên

Câu hỏi là liệu đường `UNKNOWN_STOP` có tới được bằng cách viết tay một response mang mã ngoài sổ hay
không. Không tới được, và bản thân `UNKNOWN_STOP` cũng không. Cả hai nhánh nằm dưới `step-9/`, có nhãn
trong `state.json.probes`, và không thuộc chuỗi.

`operators/errors.json` lẫn `operators/INDEX.md` đều công bố luật: "Runtime gặp một mã mà sổ gộp không
có thì dừng với `UNKNOWN_STOP`." `UNKNOWN_STOP` được đăng ký với `scope: ["*"]`, `domain: caller`,
`disposition: terminate`.

**Nhánh dò A — `step-9/parallel-1`, một mã chưa đăng ký.** Response dừng với `RUNTIME_GENERATION_STALE`,
một cái tên hợp lý cho đúng thứ bước 1 đã quan sát, và không được đăng ký ở đâu cả.

```text
$ node scripts/validate-request.mjs <session>/step-9/parallel-1
request valid
exit=0

$ node scripts/validate-response.mjs <session>/step-9/parallel-1
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not in the Stops table of workspace.bind
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not a registered code workspace.bind may emit
exit=1

$ node scripts/validate-step.mjs <session>/step-9/parallel-1
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not in the Stops table of workspace.bind
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not a registered code workspace.bind may emit
exit=1

$ node operators/workspace-bind/validate.mjs <session>/step-9/parallel-1
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not in the Stops table of workspace.bind
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not a registered code workspace.bind may emit
exit=1
```

Hai lần từ chối, cả hai đều đúng và đều cụ thể. Không có chuyển đổi nào xảy ra: response không trở thành
một `UNKNOWN_STOP`, nó trở thành một response không hợp lệ, và theo `SKILL.md` một response không hợp lệ
thì không định tuyến gì cả. Nên chỗ đáp mà luật mô tả không bao giờ tới được từ chính hướng mà luật mô
tả.

**Nhánh dò B — `step-9/parallel-2`, chính `UNKNOWN_STOP`.** Nếu runtime thực hiện đúng phép chuyển đổi
mà ghi chú quy định và viết ra mã đã đăng ký, đây là điều sẽ xảy ra:

```text
$ node scripts/validate-request.mjs <session>/step-9/parallel-2
request valid
exit=0

$ node scripts/validate-response.mjs <session>/step-9/parallel-2
step-9/parallel-2/response/response.json: stop UNKNOWN_STOP is not in the Stops table of workspace.bind
exit=1

$ node scripts/validate-step.mjs <session>/step-9/parallel-2
step-9/parallel-2/response/response.json: stop UNKNOWN_STOP is not in the Stops table of workspace.bind
exit=1

$ node operators/workspace-bind/validate.mjs <session>/step-9/parallel-2
step-9/parallel-2/response/response.json: stop UNKNOWN_STOP is not in the Stops table of workspace.bind
exit=1
```

Phép kiểm sổ đăng ký thì qua — mã ấy *có* đăng ký và `workspace.bind` *được phép* phát nó — còn phép
kiểm bảng Stops thì trượt, vì `validate-response` đòi mọi mã dừng phải có mặt trong bảng `## Stops` của
chính operator phát ra nó, mà không operator nào liệt nó:

```text
$ node -e "<nạp mọi gói operator.md và quét bảng ## Stops của chúng>"
operators whose ## Stops table lists UNKNOWN_STOP: none of 14
```

Vậy `UNKNOWN_STOP` là một mã đã đăng ký, đã có route, đã tài liệu hoá mà không operator nào trong cây
phát ra được một cách hợp lệ. Route của nó tồn tại và được trả lời (`workspace.bind`/`caller` →
`{"kind":"user"}`); không gì có thể đi vào đó. Xem D5 và D6.

---

# Lỗi và đề xuất sửa

Lượt chạy này không sửa file nào dưới `.claude/`. Mỗi mục dưới đây gọi tên file, bằng chứng, và đúng
thay đổi được đề xuất.

## D1 — `routing.json` và bảng `## Next` của chính `workspace.bind` bất đồng về một lần dừng runtime

**File** `routing.json`; `operators/workspace-bind/operator.md` (`## Next`);
`operators/workspace-bind/errors.json` (`RUNTIME_NOT_READY.resume`, `ENDPOINT_AUTHORITY_STALE.resume`).
**Bằng chứng** `routes["workspace.bind"]["runtime"] = {"kind":"external"}`, trong khi dòng bảng `## Next`
đọc là "chủ runtime thiếu hoặc chưa sẵn sàng và phải nêu một yêu cầu phối hợp | `platform.operate`", và
phần resume của chính mã đọc là "Nêu một yêu cầu phối hợp tới chủ đã đăng ký và chờ một generation sẵn
sàng". `ENDPOINT_AUTHORITY_STALE` dùng chung domain ấy và phần resume của nó là "Tính lại fingerprint
thẩm quyền ở phía chủ của nó" — cũng là việc của chủ, không phải của bên ngoài.
`frontend.surface.audit` định tuyến domain `platform` của nó tới `platform.operate` cho cùng một tình
huống thực tế.
**Đề xuất** trong `routing.json`, thay

```json
"workspace.bind": { "…": "…", "runtime": { "kind": "external" } }
```

bằng

```json
"workspace.bind": { "…": "…", "runtime": { "kind": "operator", "target": "platform.operate" } }
```

`platform.operate` là một operator trong cây này, nó sở hữu sổ đăng ký chủ runtime (`alias/alias.json`
liệt nó là writer duy nhất của `@worktrees/sessions/central-runtime`), và định tuyến tới đó làm cho bảng
`## Next` của operator, phần resume của hai mã và bản đồ cùng nói một điều. Phương án bị loại: xoá dòng
`## Next`, vì như thế phần resume của cả hai mã sẽ mô tả một hành động mà không route nào tới được.

## D2 — một lần dừng `user` hay `external` không có đường quay lại chuỗi, dù vòng đời lại quy định một đường

**File** `resources/orchestrator.json` (`session.lifecycle.block`, `handoff.resume`); `SKILL.md`
(`## The loop`); `routing.json` (`kinds`).
**Bằng chứng** `routing.json` định nghĩa `user` và `external` là "Dừng." — hết, không có phần tiếp.
`resources/orchestrator.json` định nghĩa vòng đời chặn mà không kèm điều kiện nào: "status blocked giữ
phiên trên đĩa; orchestrator hỏi người trường mà mã dừng gọi tên, rồi vào lại operator ở
step-(N+1)/parallel-1 với resume đã đặt." Bước 2 của phiên này hợp lệ theo câu thứ hai và không có chỗ
đứng nào theo câu thứ nhất. Không gì phân biệt "người đã cấp trường mà mã dừng gọi tên" với "người đã
ghi đè một preset workflow để đi vòng qua lần dừng", mà cái sau mới gần với điều thật sự xảy ra ở đây.
**Đề xuất** trong `resources/orchestrator.json`, `session.lifecycle`, thay mục `block` bằng:

```text
"block: status blocked keeps the session on disk. When routing.json answers the stop's domain with kind resume, the orchestrator asks the person for the field the stop names and re-enters the operator in step-(N+1)/parallel-1 with resume set. When it answers operator, user or external, the branch stays blocked and the chain continues only after the named operator, the person, or the outside party has changed something the stop names; that continuation is also a step-(N+1)/parallel-1 re-entry with resume set, and request.json must carry the changed requirement or input, because a re-entry with no delta is NO_PROGRESS."
```

## D3 — một route `session-only` không nói được điều đó trong biên nhận của chính nó

**File** `templates/kinds/workspace-route-binding.contract.json` (enum `Code` của `## Findings`);
`operators/workspace-bind/validate.mjs`.
**Bằng chứng** enum là
`^`(ROUTE_HYDRATED_FROM_PORTABLE|RUNTIME_CONSUMED_NOT_OWNED|IDENTITY_ROSTER_SEALED|PROVENANCE_HEAD_BOUND|CACHED_ROUTE_REUSED|WORKTREE_BRANCH_FORBIDDEN)`$`,
và validator bắt buộc `WORKTREE_BRANCH_FORBIDDEN` cho chính sách forbidden còn với `session-only` thì
không đòi gì. `operator.md` mô tả cả hai giá trị trong cùng một câu, nên sự bất đối xứng nằm ở hợp đồng
chứ không ở luật của operator. Bước 2 của lượt chạy này ràng buộc `session-only` và bảng `## Findings`
của nó không nói gì về chính sách cả.
**Đề xuất** thêm `WORKTREE_BRANCH_SESSION_ONLY` vào enum, và trong
`operators/workspace-bind/validate.mjs` thêm bản đối ứng của phép kiểm hiện có, ngay sau nó:

```js
if (route.gitPolicy.worktreeBranches === 'session-only' && !findingKeys.has(`WORKTREE_BRANCH_SESSION_ONLY|${route.gitPolicy.mutationBranch}`)) errors.push('response/response.md: a session-only worktree policy must be recorded on the bound route');
```

## D4 — một nhánh `workspace.bind` bị chặn không có luật nào về việc nó được ghi gì

**File** `operators/workspace-bind/operator.md` (`## Nothing is repaired here`).
**Bằng chứng** operator khai hai Output, cả hai chỉ bắt buộc cho nhánh `done`, và không loại output nào
phủ một lần dừng; bộ từ vựng `Findings` của `workspace-route-binding` không có mã chặn nào. Nên bước 1
của lượt chạy này đặt đoạn trích sổ đăng ký và ba lần dò cổng vào `response.json.reason`, một trường tự
do mà không validator nào đọc. Vòng 1 đã ghi đúng hình dạng này thành một lỗi và trường `reason` của
1.0.2 là bản vá một phần; thứ còn thiếu là bất kỳ câu nào nói rằng `reason` là nơi bằng chứng đi vào,
nên hai lượt chạy có thể hợp lý mà chẳng ghi gì cả.
**Đề xuất** thêm một câu vào cuối mục `## Nothing is repaired here` của
`operators/workspace-bind/operator.md`:

```text
A blocked branch emits no receipt and no route: `response.json` is the whole record, and `reason` carries the observation that justified the stop, including the registry generation, the endpoints probed and what each answered.
```

## D5 — `UNKNOWN_STOP` đã đăng ký, đã có route, và không phát ra được

**File** `scripts/validate-response.mjs`; `operators/errors.json` (note); `operators/INDEX.md` (sinh tự
động, nên là `scripts/generate-operators-index.mjs`).
**Bằng chứng** kết quả nhánh dò B nguyên văn ở trên, cộng với: không operator nào liệt `UNKNOWN_STOP`
trong bảng `## Stops` (không cái nào trong 14, quét qua `loadOperatorPackages`). `validate-response`
kiểm bảng Stops trước sổ đăng ký, nên phép kiểm lẽ ra sẽ qua chẳng bao giờ quyết định điều gì.
**Đề xuất** trong `scripts/validate-response.mjs`, bên trong nhánh `status === 'blocked'`, thay

```js
if (!stopsTable.has(response.stop)) errors.push(`${rel('response/response.json')}: stop ${response.stop} is not in the Stops table of ${op.id}`);
```

bằng

```js
// UNKNOWN_STOP is the one code no operator declares: it is what a runtime writes when it meets a code the merged registry does not list.
if (response.stop !== 'UNKNOWN_STOP' && !stopsTable.has(response.stop)) errors.push(`${rel('response/response.json')}: stop ${response.stop} is not in the Stops table of ${op.id}`);
```

và thêm vào `note` của `operators/errors.json`: "`UNKNOWN_STOP` là mã duy nhất một operator phát ra mà
không khai trong bảng `## Stops` của chính nó." Phương án bị loại: thêm dòng ấy vào cả mười bốn bảng
Stops, vì như thế sẽ in một mã mà không operator nào chọn ra mười bốn lần trong index sinh tự động.

## D6 — không ai sở hữu phép chuyển đổi sang `UNKNOWN_STOP`

**File** `resources/orchestrator.json` (`handoff.stop`); `operators/errors.json` (note).
**Bằng chứng** luật được viết ở thể bị động ("runtime gặp một mã … thì dừng với `UNKNOWN_STOP`") và
không thành phần nào thực hiện nó. Agent không thể: nó không đọc sổ gộp và không có cách nào biết mã của
mình chưa đăng ký trước khi viết ra. `validate-response` không thể: nó kiểm chứ không viết lại, và nhánh
dò A cho thấy nó làm gì thay vào đó. Giữa hai bên không còn gì chạm vào response.
**Đề xuất** thay `handoff.stop` trong `resources/orchestrator.json` bằng:

```text
"stop": "response.json status blocked with stop = code; errors/ says whether the code terminates or falls back, and routing.json says where a terminated step hands to. A code the merged registry does not list is read by the orchestrator as UNKNOWN_STOP and routed on domain caller; the branch keeps the code the agent wrote as evidence and the orchestrator records the substitution in state.json."
```

## D7 — `routeFingerprint` vẫn không có cách chuẩn hoá được công bố

**File** `templates/kinds/route.schema.json` (`routeFingerprint`).
**Bằng chứng** `identityFingerprint` tái lập chính xác qua hai vòng (`sha256:27a787a3…` = sha256 của
`.workspaces/device-state.json`), nên cái đó coi như đã được đặc tả trên thực tế. `routeFingerprint` thì
không: lượt chạy này tính `sha256(bytes portable ‖ bytes hydrated)` = `sha256:e76b23d1…`, còn vòng 1 ghi
`sha256:1e488f3b…` cho cùng cặp file bằng một phương pháp nó không nêu. Hai lượt chạy của một operator
trên một route sinh ra hai fingerprint không so được với nhau, và như vậy là phá đúng mục đích của
trường ấy. Mang sang từ lỗi số 8 trong hồ sơ backend vòng 1, vẫn mở.
**Đề xuất** thêm `description` cho `routeFingerprint` trong `templates/kinds/route.schema.json`:

```json
"routeFingerprint": { "$ref": "#/$defs/fingerprint", "description": "sha256 over the bytes of the portable declaration followed by the bytes of the hydrated route, each exactly as stored on disk, with no normalisation." }
```

và cùng một câu cho `identityFingerprint`, gọi tên `.workspaces/device-state.json`.

## D8 — `mutationReadiness` vẫn không có cách suy ra được nêu ra

**File** `operators/workspace-bind/operator.md` (bảng Steps, dòng 4);
`templates/kinds/route.schema.json`.
**Bằng chứng** lỗi O11 của vòng 1, chưa vá: trên nhánh mutation, cả `ready` lẫn `read-only` đều qua mọi
validator, và hai lượt chạy fe của vòng 1 trong cùng thư mục phiên đã chọn khác nhau trên cùng một
route. Lượt chạy này chọn `ready` và cũng chẳng gì phản đối `read-only`. Chính sách `session-only` thêm
một hình dạng nhánh hợp lệ thứ hai mà sự mơ hồ ấy nay cũng phủ luôn.
**Đề xuất** thêm vào đoạn dưới bảng Steps trong `operators/workspace-bind/operator.md`:

```text
`mutationReadiness` is `ready` when the observed branch is one the routed policy permits a write on — the mutation branch, or a `session/<sessionId>` branch under `session-only` — and the working tree is clean outside the declared write roots; it is `read-only` in every other case, including a route bound with no declared write roots.
```

## D9 — preset `runtimeNeed: consume` chuyển lần chặn chắc chắn từ bước 5 về bước 1

**File** `workflows/frontend-reconstruct.json`.
**Bằng chứng** khoảng trống G2 của vòng 1 nói workflow tự bảo đảm rằng lần audit của chính nó sẽ chặn, và
bản vá thêm `runtimeNeed: consume` vào preset của `workspace.bind`. Trên máy này runtime dùng chung đang
tắt, nên bản vá dời lần chặn về bước *đầu tiên* của chuỗi: `frontend.direction.decide`,
`frontend.presentation.resolve` và `frontend.source.apply` đều cần không endpoint nào, và không cái nào
chạy được. Như vậy còn tệ hơn hẳn việc chặn ở lần audit, vì chặn ở đó ít ra cũng có bốn bước đã quyết
trước.
**Đề xuất** trong `workflows/frontend-reconstruct.json`, bỏ `"runtimeNeed": "consume"` khỏi preset
`workspace.bind` của bước 1 và để `frontend.surface.audit` tự nêu `RUNTIME_UNAVAILABLE` của nó, mã mà
`routing.json` vốn đã trả lời bằng `platform.operate`. Nếu thật sự muốn có endpoint đã ràng buộc trước
lần audit thì hình dạng trung thực là một bước `workspace.bind` thứ hai ngay trước nó:

```json
[ { "operator": "workspace.bind", "requirements": { "role": "fe", "runtimeNeed": "consume" } } ],
[ { "operator": "frontend.surface.audit", "fanout": "matrix", "maxParallel": 3 } ]
```

`workflows/frontend-refine.json` và `frontend-new-surface.json` mang cùng preset ấy và muốn cùng thay
đổi ấy.

## D10 — `state.json` không có schema, nên lần chạy lại vừa không được ghi vừa không ghi được

**File** `resources/orchestrator.json` (`session.manifest`); `scripts/`; `templates/step/`.
**Bằng chứng** khoảng trống G6 của vòng 1, chưa vá. Enum `status` đã tài liệu hoá là
`running | blocked | done` và cả hai vòng đều ghi `stopped-by-test-owner` mà không bị chặn; lượt chạy này
thêm hai khoá (`resumes`, `probes`) mà không hình dạng nào chứa và không gì phản đối; `chain` cấp cho
lần chạy lại một vị trí riêng mà không có cách nào nói đó là một lần vào lại; và khoá duy nhất script
nào đọc là `requestHashes`.
**Đề xuất** thêm `templates/step/state.schema.json` phủ các trường mà `session.manifest` trong
`resources/orchestrator.json` vốn đã gọi tên, với `status` mở rộng thành
`running | blocked | done | stopped` và một khoá mới bắt buộc khi có mặt:

```json
"resumes": {
  "type": "object",
  "additionalProperties": {
    "type": "object", "additionalProperties": false,
    "required": ["resumes", "stop"],
    "properties": {
      "resumes": { "type": "string", "pattern": "^[0-9]+/[0-9]+$" },
      "stop": { "type": "string", "pattern": "^[A-Z][A-Z0-9_]+$" }
    }
  }
}
```

và kiểm `state.json` theo nó ngay trong `scripts/validate-request.mjs`, vốn đã mở file ấy để đối chiếu
hash, nên không thêm lần đọc nào. Có khoá ấy rồi thì `validate-request` cũng khẳng định được điều hôm nay
không gì khẳng định: rằng một request mang `resume: {step, parallel, token}` gọi tên một nhánh mà
`state.json` ghi là bị chặn, và rằng nhánh chạy lại chạy đúng `operatorId` ấy.

## D11 — một ràng buộc chỉ đọc diễn đạt được trong dữ liệu mà không diễn đạt được trong biên nhận

**File** `templates/kinds/workspace-route-binding.contract.json` (`## Write roots`).
**Bằng chứng** `route.schema.json` nay cho phép `writeRoots` với `minItems: 0` (O10 vòng 1, đã vá),
trong khi hợp đồng tài liệu vẫn mang `"minRows": 1` trên `## Write roots`. Một ràng buộc có
`declaredWriteRoots` bằng đúng mặc định đã tài liệu hoá — rỗng — qua được nửa dữ liệu và không phát nổi
biên nhận của chính nó.
**Đề xuất** bỏ `"minRows": 1` khỏi mục `## Write roots` của
`templates/kinds/workspace-route-binding.contract.json`.

---

## Những gì đã chạy đúng

Cơ chế chạy lại chạy đúng như `resources/orchestrator.json` viết: một bước mới, một `request.json` mới,
`resume` gọi tên nhánh bị chặn, nhánh bị chặn nằm nguyên trên đĩa, và chính operator ấy vào lại với đúng
một yêu cầu đã đổi. Bản thân lần dừng là tìm được chứ không dàn dựng — một checkout sạch đóng đường
`CHECKOUT_DIRTY` còn tình trạng runtime của chính máy mở đường kia — và việc tra domain qua `errors.json`
vào `routing.json` không cần diễn giải, chỉ cần đọc. Mọi lần từ chối theo schema trong lượt chạy này đều
đúng: hai nhánh dò trượt đúng theo cái cách chứng minh được điều chúng được viết ra để thử, với văn bản
lỗi cụ thể đến mức gọi tên được cái bảng đang thiếu. Những bản vá của vòng 1 mà lượt chạy này xác nhận
đã đáp xuống: `route.schema.json` nhận `session-only` và `writeRoots` rỗng, `response.json.reason` cho
một nhánh bị chặn chỗ để nói, `PADDING-9` đã công bố, và các claim Grammar nay khớp CSS đủ để đóng một
nửa của một khoảng trống đã ghi.

## Trên đĩa còn gì

`.worktrees/sessions/20260903-r2-resume/`, giữ nguyên: `state.json`, bốn nhánh chuỗi dưới
`step-1/parallel-1`, `step-2/parallel-1`, `step-3/parallel-1` và `step-4/parallel-1`, cùng hai nhánh dò
có nhãn dưới `step-9/parallel-1` và `step-9/parallel-2` mà không bao giờ được đọc như kết cục của
`workspace.bind`. Checkout frontend còn nguyên và sạch tại
`8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2`; sổ đăng ký chủ runtime dùng chung được đọc chứ không ghi;
không file nào dưới `.claude/` bị sửa ngoài báo cáo này và bản gương tiếng Anh của nó.
