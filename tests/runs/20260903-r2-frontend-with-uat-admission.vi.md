# Lượt chạy — frontend-with-uat trên `/[lang]/subscriptions`, chốt admission của UAT (2026-09-03, vòng 2)

Đây là một phiên chạy khô của StarCi Skills: một orchestrator cùng một agent cho mỗi operator, tất cả
nằm trong một tiến trình. Gốc phiên là `.worktrees/sessions/20260903-r2-frontend-with-uat/` (bị git
bỏ qua) và được giữ lại trên đĩa. Điểm cần thử của ca này là cổng admission của `uat.verify`: liệu
operator có từ chối một cách trung thực khi không ai yêu cầu lượt chạy, không có thư mục luồng nào tồn
tại, không có mật khẩu niêm phong, không có gì phục vụ sản phẩm, và cả hai biên nhận admission đều
chưa từng được sinh ra hay không. Nó có từ chối. Nó từ chối sớm hơn và dứt khoát hơn cả những gì văn
bản của chính operator dự đoán, nên kết quả đáng chú ý nằm ở chỗ *nơi* lời từ chối xảy ra, chứ không
phải ở việc nó có xảy ra hay không.

Mỗi nhánh dưới đây đều nêu profile mà `operator.json` của nó ràng, và trên thực tế Claude Opus đã chạy
thay, đúng như `resources/orchestrator.json` → `profileEquivalents` cho phép khai báo. Với
`uat.verify` thì đó là cặp tương đương đã đăng ký (`sol-fresh` ↔ `opus`); với `workspace.bind` thì
không, vì operator ấy nay ràng `luna`, mà tương đương đã đăng ký của `luna` là `sonnet`, nên Opus đã
đứng thay cho người đứng thay và không một ranh giới profile nào được thử thật trong cả lượt chạy này.
Không có commit nào, không có gì được ghi vào bất kỳ checkout nào, phiên này không sửa file runtime
nào trong `.claude`, không một lệnh ghi git nào được chạy ở bất cứ đâu, không trình duyệt nào bị điều
khiển, không bí mật nào bị đọc hay giải mã, và không thư mục `uat/`, tài khoản hay thông tin đăng nhập
nào được tạo ra.

## Tóm tắt yêu cầu

| Trường | Giá trị |
| --- | --- |
| Workflow | `frontend-with-uat` (`workflows/frontend-with-uat.json`, `when`: một thay đổi frontend mà có người muốn tự đi qua) |
| Target | `/[lang]/subscriptions` |
| Cây runtime | head đã publish `3d30a88e`; `INDEX.md` đọc ra `# StarCi Skills 1.0.3` lúc phiên bắt đầu và `# StarCi Skills 1.1.0` chưa đầy một giờ sau, do một phiên khác sửa ngay dưới lượt chạy (xem G7) |
| Head backend đóng băng | `90ef7fcb8dfbe83129af877e15a2c5fc029358de` (`git rev-parse HEAD`, nhánh `mtp`, cây bẩn ở hai đường dẫn) |
| Head frontend đóng băng | `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, nhánh `main`, sạch) |
| Chuỗi yêu cầu | bind (be) ∥ bind (fe, `runtimeNeed: consume`) → direction → resolve → apply (`dry`) → audit (matrix) → quality → uat → publish |
| Chuỗi chạy thật | chỉ bước 1, cả hai nhánh `blocked`; sau đó `uat.verify` được điều phối ngoài chuỗi như phép thử admission mà ca này đòi |
| Dừng ở | cổng UAT. `frontend.direction.decide`, `frontend.presentation.resolve`, `frontend.source.apply`, `frontend.surface.audit`, `quality.verify` và `git.publish` không bao giờ được điều phối, vì bước 1 đã chặn ở cả hai nhánh |

Yêu cầu lấy từ preset của workflow cộng với mặc định mà mỗi operator tự nêu. Riêng `project` thì
orchestrator phải tự cấp ở cả hai nhánh bind, vì không preset lẫn mặc định nào phủ — đúng lỗ hổng G3
của vòng 1, chưa đổi. Không hỏi gì một con người, bởi vì trong vòng lặp này không có con người nào cả;
và chính điều đó là phát hiện đầu tiên.

---

## Bước 1 — `workspace.bind` (be), parallel-1

Nhánh này `blocked` với stop `CHECKOUT_DIRTY` (`operators/workspace-bind/errors.json`, domain
`source`, disposition `terminate`; `routing.json` đưa `source` quay lại chính operator ấy dưới dạng
`resume`). `operator.json` ràng profile `luna`, còn Claude Opus là thứ thực sự chạy. Cả bốn validator
đều xanh:

```text
$ node .claude/scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-1/parallel-1
step valid

$ node .claude/operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

Nhánh chỉ ghi ra `response/response.json`, đó là hình dạng duy nhất mà một nhánh bị chặn có, và trường
`reason` gánh phần văn xuôi, nên lượt chạy này không lặp lại lỗi O3 của vòng 1 với operator này.

Hai nửa của route đồng ý với nhau về project `starci-academy`, role `be`, kho
`https://github.com/starci-lab/starci-academy-backend` và nhánh `mtp`; kho loại `source` phân giải về
chính gốc Source. Bước 4 mới là chỗ từ chối: `git status --porcelain` báo
` M .workspaces/projects/tayson/fe.json` và `?? .workspaces/projects/tayson/be.json`. Workflow không
đặt sẵn `declaredWriteRoots` nào và mặc định của Requirements là rỗng, nên mọi đường dẫn bẩn đều nằm
ngoài tập ghi đã khai. Hai file bẩn ấy thuộc về một project hoàn toàn khác, nên không một write root
trung thực nào của một nhiệm vụ subscriptions có thể phủ chúng, mà operator thì không bao giờ stash,
clean hay reset. Không có lần resume nào được thử: một resume khai file khai báo của project khác thành
write root của nhiệm vụ này là bẻ cong cổng chứ không phải dọn cổng.

---

## Bước 1 — `workspace.bind` (fe, `runtimeNeed: consume`), parallel-2

Nhánh này `blocked` với stop `RUNTIME_NOT_READY` (`operators/workspace-bind/errors.json`, domain
`runtime`, disposition `terminate`; `routing.json` đưa `runtime` sang `external`). `operator.json` ràng
`luna`, chạy ở đây bởi Claude Opus. Cả bốn validator đều xanh:

```text
$ node .claude/scripts/validate-request.mjs <session>/step-1/parallel-2
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-1/parallel-2
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-1/parallel-2
step valid

$ node .claude/operators/workspace-bind/validate.mjs <session>/step-1/parallel-2
valid workspace.bind branch
```

Bốn bước đầu đều giữ được. Hai nửa route đồng ý về project, role `fe`, kho
`https://github.com/starci-lab/starci-academy-fe.git` và nhánh `main`; checkout sibling phân giải về
`D:\Repositories\starci-academy-fe`, đang ở `main`, sạch tại `8d8ed9a1…`, và `worktreeBranches` của nó
là `session-only`, nghĩa là một bước ghi source hẳn đã được phép — bản vá của vòng 1 đang sống.

Bước 5 có chạy, và đó chính là bản vá thứ hai của vòng 1: `frontend-with-uat` đặt sẵn nhánh bind fe
với `runtimeNeed: consume`, nên việc ràng endpoint được thử ngay ở bước 1 thay vì đợi tới lượt audit
mới phát hiện là không có. Phép chiếu cổng đóng và nhất quán — offset 0, slot ứng dụng `main` bằng 0,
nên frontend 3000 và api 3001, đúng những gì registry của chủ runtime quảng cáo — nên thẩm quyền
endpoint không hề cũ. Cái không chứng minh được là sự sẵn sàng:

```text
$ cat .worktrees/sessions/central-runtime/owner.json   # generation 6, status "ready"
$ curl -s -o /dev/null -w "%{http_code}" --max-time 6 http://localhost:3000/en/subscriptions
000
$ curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/
000
$ netstat -ano | grep LISTENING | grep -E ":(3000|3001|8089|5432|8080) "
  TCP    0.0.0.0:5432           0.0.0.0:0              LISTENING       20388
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       20388
```

Registry khai `ready` trong khi không listener nào trả lời ở cả hai endpoint; chỉ Postgres và Keycloak
còn sống. Operator không bao giờ tự khởi động một tiến trình dùng chung, nên lời khai ấy không sửa
được ở đây và việc ràng route dừng lại. Hệ quả với cả chuỗi là toàn phần: khi route fe chưa ràng được
thì toàn bộ nửa frontend — direction, resolve, apply khô, audit — đều không tới được, và `quality.verify`
cũng vậy. Vòng 1 đã dời bức tường này từ bước 5 về bước 1, và đó là hướng đúng, vì hỏng sớm còn hơn để
bốn operator làm ra thứ mà audit sẽ vứt đi; nhưng nó cũng có nghĩa là `frontend-with-uat` không thể
tới `uat.verify` bằng chính chuỗi của nó trên máy này.

---

## Bước 2 — `uat.verify`, parallel-1 — phép thử admission

Nhánh này không phải một bước chuyển của chuỗi. Bước 1 đã chặn ở cả hai nhánh và routing đưa một nhánh
sang `resume`, một nhánh sang `external`, nên một orchestrator theo đúng `SKILL.md` sẽ dừng tại đó. Ca
này đòi đích danh chốt admission của UAT, nên `uat.verify` được điều phối ngoài chuỗi, với đúng cái
request mà một orchestrator trung thực sẽ viết cho nó: không ai yêu cầu nên `requestedBy` là null;
không thứ gì trên đĩa khai một luồng cho bề mặt này nên `flow` là null; không biên nhận admission nào
tồn tại trong phiên nên `inputs` rỗng; và lease độc quyền không cấp được, vì lease được cấp trên một
thư mục luồng không tồn tại.

Nhánh dừng `blocked` với stop `INVALID_INPUT` (`operators/errors.json`, scope `*`, domain `caller`,
disposition `terminate`; `routing.json` đưa `caller` sang `user`). `operator.json` ràng `sol-fresh`,
chạy ở đây bởi Claude Opus, đúng cặp tương đương đã đăng ký.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-2/parallel-1
request.json: required field requestedBy has no value
request.json: required field flow has no value
request.json: required input frontend-surface-audit is absent
request.json: required input quality-verification is absent

$ node .claude/scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-2/parallel-1
request.json: required field requestedBy has no value
request.json: required field flow has no value
request.json: required input frontend-surface-audit is absent
request.json: required input quality-verification is absent

$ node .claude/operators/uat-verify/validate.mjs <session>/step-2/parallel-1
request.json: required field requestedBy has no value
request.json: required field flow has no value
request.json: required input frontend-surface-audit is absent
request.json: required input quality-verification is absent
request.json: UAT runs only when a person asked; requestedBy has no value
```

Nhánh này không qua được bốn validator của nó, và nó không thể qua được. `validate-response` xanh —
phản hồi bị chặn đúng hình dạng, `INVALID_INPUT` nằm trong bảng Stops của operator, và disposition
hiệu lực của nó là `terminate` — nhưng cổng request từ chối trên bốn lý do độc lập, còn phần kiểm bước
lẫn validator riêng của operator đều thừa hưởng cả bốn. Cách duy nhất làm cho request hợp lệ là nêu
tên một người chưa từng yêu cầu và trỏ vào hai biên nhận admission không tồn tại, tức là bịa chứ không
phải sửa. Vì vậy thất bại được chép nguyên văn thay vì được gia công cho biến mất.

Hai điều kiện tiên quyết còn lại được xác minh chỉ-đọc, để bản ghi nói được cái gì *sẽ* nổ tiếp theo
mà không tạo ra bất cứ thứ gì:

```text
$ ls .stacks/dev
infra  runtime  seeds
$ ls .stacks/dev/secrets
ls: cannot access '.stacks/dev/secrets': No such file or directory
$ find . -maxdepth 5 -name uat.enc         # không có kết quả
$ ls .worktrees/uat/*/*
   result.json  snapshot.json             # ở cả bảy thư mục luồng
$ ls .worktrees/_templates/uat
result.schema.json  result.template.json  snapshot.schema.json  snapshot.template.json
```

Không có `.stacks/dev/secrets/uat.enc`, nên bước 3 hẳn đã dừng ở `PROVISIONING_UNAVAILABLE`; không thư
mục luồng nào mang `flow.md`, `account.json` hay `seed/`, và cũng chẳng có thư mục feature
`subscriptions` nào, nên bước 4 hẳn đã không có gì để đóng băng và không template nào để đóng băng
theo; và không gì phục vụ sản phẩm, nên bước 6 hẳn đã dừng ở `RUNTIME_UNAVAILABLE`. Không thứ gì được
tạo, giải mã, seed, điều khiển hay xoá, và không hồ sơ lượt chạy nào được phát hành — đúng như operator
nói một lượt chạy bị chặn phải làm.

---

## Stop nào nổ trước, và các bảng có đồng ý với nhau không

Stop nổ trước là `INVALID_INPUT`, và nó nổ trong cổng request của orchestrator chứ không phải bên
trong operator. Về mã này thì ba nguồn đồng ý trọn vẹn: bảng Stops của `uat.verify` liệt nó là
`terminate`, `operators/errors.json` đăng ký nó với scope `*`, domain `caller` và disposition
`terminate`, `operators/INDEX.md` chép lại cả hai, `routing.json` ánh xạ `uat.verify` cộng `caller`
sang `user`, còn `operators/uat-verify/validate.mjs` cưỡng chế đúng luật ấy bằng lời của chính nó
(`UAT runs only when a person asked; requestedBy has no value`). Lời từ chối trung thực, sớm, và không
tốn gì.

Còn `ADMISSION_MISSING` thì không nổ, và theo bằng chứng của lượt chạy này thì nó không bao giờ nổ
được cho nửa nghĩa nói rằng biên nhận "đang thiếu". Ba nguồn cùng mô tả trường hợp thiếu admission mà
không nguồn nào chạm tới được: bảng Inputs của `operator.md` đánh dấu cả `frontend-surface-audit` lẫn
`quality-verification` là bắt buộc, nên `scripts/validate-request.mjs` bác request trước khi bất kỳ
agent nào được sinh ra, bằng một thông điệp cổng chung chung không mang mã nào, và orchestrator chỉ có
thể xếp nó vào `INVALID_INPUT`; `operators/uat-verify/errors.json` cho `ADMISSION_MISSING` một nghĩa
mở đầu bằng đúng chữ "đang thiếu"; và `validate.mjs` có sẵn phép kiểm tương ứng —
`request.json: ADMISSION_MISSING — input ${kind} is absent` — nhưng nó nằm lọt trong `if (snapshot)`,
mà snapshot chỉ tồn tại khi lượt chạy đã tới bước 4 của operator. Một nhánh chặn trước khi thực thi thì
không có snapshot nên phép kiểm không chạy; một nhánh có snapshot thì đã qua cổng nên input của nó
không thể thiếu. Dòng ấy chết ở cả hai chiều. Thứ còn tới được là nửa nghĩa kia: cả hai biên nhận đều
có mặt nhưng một cái được lấy ở commit khác head đã ghim, và nửa ấy được phủ tốt bằng ba phép so sánh
riêng trong `validate.mjs`.

---

## Khiếm khuyết và đề xuất sửa

Lượt chạy này không sửa gì trong cây `.claude`. Mỗi mục dưới đây nêu file, bằng chứng, và thay đổi đề
xuất chính xác.

**O13 — một nhánh chặn ngay ở cổng thì không bao giờ qua nổi validator của chính operator.** File là
`operators/uat-verify/validate.mjs`, dòng 40–42. Bằng chứng là kết quả validator thứ tư ở trên: nhánh
chặn với `INVALID_INPUT` *vì* thiếu `requestedBy`, rồi validator lại bác nhánh cũng vì cái thiếu ấy.
Điều đó đáng kể vì `runId` và `lease` đã được chặn theo cờ `decided`, còn `requestedBy` thì không, nên
trong ba trường do orchestrator hoặc con người cấp, đúng cái trường định nghĩa toàn bộ cò súng của
operator lại là cái khiến một lời từ chối hợp pháp không phát hành được — trong khi một `blocked` hợp
lệ đáng lẽ được tính là xanh. Đề xuất: đưa phép kiểm người yêu cầu về cùng dạng với hai phép kia,
`if (decided && empty(requirements.requestedBy)) errors.push(...)`. Không mất gì cả, vì cổng vẫn bác
mọi request không có `requestedBy`.

**O14 — nhánh "thiếu admission" của `ADMISSION_MISSING` là code chết.** File là
`operators/uat-verify/validate.mjs`, khối `for (const kind of ADMISSIONS)` nằm trong `if (snapshot)`,
cùng `operators/uat-verify/errors.json` → `ADMISSION_MISSING.meaning.en`. Bằng chứng là lập luận về
khả năng với tới ở trên. Đề xuất: hoặc (a) đưa hai phép kiểm `request?.inputs?.[kind] === undefined`
ra ngoài khối `if (snapshot)` để một nhánh bị chặn cũng được xét theo chúng, hoặc (b) thu hẹp nghĩa
của mã lại đúng phần với tới được, tức "một trong hai admission được lấy ở commit khác head đã ghim",
và để trường hợp thiếu nằm lại với `INVALID_INPUT` trong cổng. (a) tốt hơn, vì dòng `resume` của mã —
"chạy lại admission còn thiếu tại đúng commit đã ghim" — mới là chỉ dẫn đúng cho một con người, còn
dòng của `INVALID_INPUT`, "sửa request.json", thì không.

**O15 — thiếu lease và thiếu runId là ba chuyện khác nhau ở ba chỗ.** File là
`operators/uat-verify/operator.md` (đoạn "UAT runs only when a person asked", bảng Requirements và
bảng Steps) cùng `operators/uat-verify/validate.mjs` dòng 41–42. Bằng chứng: request của lượt chạy này
mang `lease: null` và cổng chấp nhận, vì bốn lỗi liệt kê ở trên không có lỗi nào về lease. Văn xuôi nói
"một lần gọi tới mà thiếu chúng là `INVALID_INPUT` chứ không phải một câu hỏi"; bảng Requirements lại
cho cả hai trường một Default, mà chính Default là thứ khiến cổng chấp nhận giá trị rỗng; validator
chỉ kiểm chúng khi nhánh `decided`; còn bảng Steps gán cho lease hai mã khác nhau tuỳ lúc phát hiện —
`INVALID_INPUT` ở bước 1 và `LEASE_INVALID` ở bước 6, mà domain của mã sau là `control-panel` và route
của nó là `external`. Đề xuất: đặt Default của `runId` và `lease` thành `—` (orchestrator điền chúng,
y như điền `project`; một ô Default ghi "run id của orchestrator" là văn xuôi chứ không phải giá trị
cổng dùng được), và để `LEASE_INVALID` cho một lease có thật nhưng hết hạn, thuộc chỗ khác hoặc gắn
vào lượt chạy khác — đúng như nghĩa của chính nó đã nói.

**O16 — phép quét custody không đọc `response.json.reason`.** File là
`operators/uat-verify/validate.mjs`, mảng `scanned`. Bằng chứng: phép quét phủ `response.md`,
`snapshot.json`, `verdicts.json` và mọi capture, nhưng `response.json` mang một trường `reason` văn
xuôi tự do dài tới 2000 ký tự — thêm vào sau vòng 1 — và đó lại là file duy nhất mà một lượt chạy bị
chặn luôn luôn ghi, trong khi luật của operator là thông tin đăng nhập không xuất hiện ở bất cứ đâu
operator này ghi. Đề xuất: thêm `'response/response.json'` vào `scanned`.

**O17 — `@worktrees/_templates` không sinh nổi thư mục luồng mà bảng Context mô tả.** File là bảng
Context của `operators/uat-verify/operator.md` và thư mục `.worktrees/_templates/uat/`. Bằng chứng:
dòng Context gọi nó là "template luồng UAT mà một thư mục luồng mới được tạo ra từ đó", còn thư mục
template chỉ chứa `result.schema.json`, `result.template.json`, `snapshot.schema.json` và
`snapshot.template.json` — cặp result/snapshot thời v7 — không có `flow.md`, không `account.json`,
không `seed/`. Bảy thư mục luồng đang sống dưới `.worktrees/uat/` cũng mang đúng cặp cũ ấy. Đây là lỗi
O9 của vòng 1 được xác nhận lần thứ hai và mở rộng sang chính template; nó vẫn còn mở. Đề xuất: publish
đúng template mà operator đọc — `_templates/uat/flow.md`, `_templates/uat/account.json` (username,
role, tên credential, đường dẫn file niêm phong, và không trường nào có thể chứa bí mật) và
`_templates/uat/seed/records.json` — hoặc, nếu cặp thời v7 mới là hình dạng đúng, sửa lại bảng Context
cùng bước 4 và bước 10 cho gọi đúng tên.

**O18 — bảng Next của `workspace.bind` và `routing.json` không đồng ý về một runtime chưa sẵn sàng.**
File là `## Next` của `operators/workspace-bind/operator.md` và `routing.json` →
`workspace.bind.runtime`. Bằng chứng: dòng Next đọc là "chủ runtime thiếu hoặc chưa sẵn sàng và cần
nêu một yêu cầu phối hợp → `platform.operate`", trong khi `RUNTIME_NOT_READY` mang domain `runtime`,
mà `routing.json` ánh xạ sang `external` — một dấu chấm hết, không phải một operator. Vì thế `next` của
nhánh này buộc phải nêu `external`, một lối ra mà chính `operator.md` của nó không hề chào. Cùng họ với
O7 và O8 của vòng 1, khác operator và khác mã, và vẫn chưa có gì đối chiếu bảng Next với `routing.json`.
Đề xuất: dạy `scripts/validate-routing.mjs` đọc bảng `## Next` của mọi operator và đòi rằng mỗi
operator nó nêu phải với tới được từ operator ấy qua `routing.json` hoặc qua một cạnh workflow, rồi sửa
bên nào sai — ở đây nhiều khả năng là `routing.json`, vì `platform.operate` đúng là operator có thể
phục vụ một route.

**G7 — cây `.claude` lại đổi ngay dưới một phiên đang chạy.** Bằng chứng: `INDEX.md` đọc ra
`# StarCi Skills 1.0.3` khi phiên này ràng ngữ cảnh và `# StarCi Skills 1.1.0` chưa đầy một giờ sau;
`package.json` ghi `1.1.0`; `git status` trong kho `.claude` cho thấy mười hai đường dẫn đã sửa hoặc
chưa theo dõi, gồm cả `bin/`, `README.md` và `scripts/install-cli.spec.mjs`, không cái nào do lượt chạy
này viết. `npm test` hỏng ở lần gọi đầu (`install-cli.spec.mjs` đòi `^# StarCi Skills 1\.1\.0$` trên
một `INDEX.md` còn ghi `1.0.3`) và xanh ở lần gọi thứ hai, mà giữa hai lần ấy phiên này không làm gì
cả. Điều đó đáng kể vì đây là G1 của vòng 1 dưới dạng sắc hơn: ở đó thẩm quyền route trong `.workspaces`
dịch chuyển giữa phiên, còn ở đây là chính cây runtime. `SOURCE_DRIFT` chỉ so head checkout mà một
request đóng băng, mà `.claude` thì bị backend gitignore và được version trong kho riêng của nó, nên một
lần sửa cây không dịch head nào request từng ghim và không mã nào nổ. Đề xuất: đưa head của `.claude`
vào request — cho `request.json.contexts` một alias `@trust` (hoặc `@skills`) với `head` là head kho
`.claude` kèm cờ bẩn, rồi để `SOURCE_DRIFT` phủ nó. Một lượt chạy mà luật của chính nó đổi bên dưới thì
phải nói ra, trước khi biên nhận của nó bị đọc như bằng chứng.

**G8 — một workflow có thể "đóng" mà vẫn không điều phối được.** File là
`scripts/validate-workflows.mjs`, `scripts/validate-defaults.mjs` và
`workflows/frontend-with-uat.json`. Bằng chứng: `node scripts/validate-workflows.mjs` in ra
`workflows closed: 8 examples`, trong khi nhánh `uat.verify` của `frontend-with-uat` không đặt sẵn gì
cả, còn ba Requirements của operator ấy có Default `—`: `requestedBy`, `feature` và `flow`. Không
workflow, không `routing.json` và không script nào nói ba giá trị ấy đến từ đâu. `validate-defaults.mjs`
cho operator qua bằng cách điền mọi trường bắt buộc bằng đúng chuỗi `placeholder` và trỏ mọi input bắt
buộc vào file do chính nó viết ra, nên phép kiểm trông giống độ phủ ấy thật ra chỉ là kiểm hình dạng
tĩnh mà một chuỗi thật không bao giờ thoả — và `requestedBy` lại đúng là trường mà operator nói không
bao giờ được đặt mặc định. Đề xuất: mở rộng `validate-workflows.mjs` bằng nửa còn thiếu của chính luật
soạn chuỗi mà nó đã cưỡng chế cho Inputs — mọi trường Requirements của một nhánh có Default `—` phải
hoặc được workflow đặt sẵn, hoặc suy ra được từ target của workflow, hoặc được liệt trong một mảng
`asks` mới trên nhánh, để một chuỗi khai trước những trường nào cần người cấp trước khi nó khởi động.
Riêng `frontend-with-uat`, thêm `"asks": ["requestedBy", "feature", "flow"]` vào nhánh `uat.verify`:
chính `when` của workflow đã nói có người yêu cầu đích danh, mà hiện không có chỗ nào để ghi cái tên ấy.

**G9 — endpoint đã ràng không bao giờ tới được operator cần nó nhất.** File là bảng Inputs và Context
của `operators/uat-verify/operator.md` cùng `workflows/frontend-with-uat.json`. Bằng chứng: bước 1 của
chuỗi tính ra một phép chiếu endpoint đóng và từ chối một cổng chỉ tình cờ đang lắng nghe, thế mà
`uat.verify` không tiêu thụ biên nhận `route` lẫn `workspace-route-binding`: Inputs của nó chỉ có hai
admission, còn Context ràng thẳng `@worktrees/sessions/central-runtime` — đúng cái registry đã quảng
cáo `ready` trong khi không gì lắng nghe. Operator điều khiển trình duyệt thật trên sản phẩm thật lại
tự suy ra sự sẵn sàng từ nguồn ít đáng tin nhất của cả chuỗi. Đề xuất: thêm một Input bắt buộc `route`
(kind `route`, từ nhánh `workspace.bind` fe) cho `uat.verify`, và để bước 6 thực thi trên endpoint mà
biên nhận ấy mang, thay vì trên một origin đọc từ registry. `frontend.surface.audit` xứng đáng được đối
xử y hệt.

**Khoảng trống tri thức.** Không có. Lượt chạy này không ràng topic tri thức nào: `workspace.bind`
không ràng cái nào, và `uat.verify` cũng vậy (`operator.json` → `grammarBound: false`, còn bảng Context
của nó không nêu alias `@knowledge` nào). Sáu khoảng trống tri thức của vòng 1 vẫn nguyên vẹn.

---

## Còn gì trên đĩa

`.worktrees/sessions/20260903-r2-frontend-with-uat/` được giữ lại: `state.json` cùng ba nhánh
(`step-1/parallel-1`, `step-1/parallel-2`, `step-2/parallel-1`), mỗi nhánh có `request/request.json` và
`response/response.json` của nó. Không nhánh nào ghi file `data/` hay `artifacts/`, vì cả ba đều bị
chặn. Checkout backend còn nguyên tại `90ef7fcb8dfbe83129af877e15a2c5fc029358de` với đúng hai đường dẫn
bẩn nó đã có từ trước lượt chạy; checkout frontend còn nguyên và sạch tại
`8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2`; và không file nào dưới `.claude/` bị phiên này sửa, ngoài
bản báo cáo này cùng bản gốc tiếng Anh của nó.
