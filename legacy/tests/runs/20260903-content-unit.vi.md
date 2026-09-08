# Lượt chạy — content-unit ở chế độ diễn tập (2026-09-03)

Đây là một phiên diễn tập của StarCi Skills v8: một orchestrator cùng một agent operator, cả hai chạy
trong cùng một tiến trình này. Thư mục phiên là
`.worktrees/sessions/20260903-dryrun-content-unit/`, được giữ nguyên trên đĩa để soi lại. Workflow
`content-unit` ràng operator `content.generate` vào profile `luna`
(`operators/content-generate/operator.json` → `resources.profile`), profile này về danh nghĩa giải ra
`gpt-5.6-luna` trên runtime OpenAI (`resources/agents/profiles/openai.json`). Trong lượt test này,
nhánh thực sự được chạy bởi Claude Sonnet 5 đứng thay cho profile đó — không ranh giới profile nào
được thực sự thử, và lượt chạy này không nói được liệu `gpt-5.6-luna` có gặp đúng bức tường như vậy
hay không. Không có gì trong `.claude` hay bất kỳ cây nào khác bị sửa bởi lượt chạy này; không lệnh
ghi git nào được chạy ở bất kỳ đâu; MinIO và mọi dịch vụ mạng khác đều bị coi là không tới được theo
đúng ràng buộc của chính bài test, chứ không phải vì đã thử và thất bại.

## Tóm tắt yêu cầu

Workflow là `content-unit` (`workflows/content-unit.json`) — một bước, một nhánh, operator
`content.generate`, kết thúc ở `user`. Đơn vị nội dung là
`courses/1-system-design-mastery/milestones/0-monorepo-and-service-scaffolding`, một id ứng viên có
thật tìm được cục bộ dưới `.gitmounts/data/courses/1-system-design-mastery/milestones/` — bản mirror
nội dung được mount vào backend — chứ không phải đã xác nhận đúng bằng id mà đối tượng MinIO đang
phục vụ thật sự dùng, vì đối tượng đó không đọc được. Requirements gồm `naturalLanguages: [vi]`,
`implementationLanguages: []`, `stageModes: {image: off}`, `commands: []`, `maxE2eIterations: 2`,
`maxReviewRounds: 2` — cái cuối lấy từ preset của workflow, mọi cái còn lại lấy từ default riêng của
operator. Hai context được ràng là `@remote/minio/courses/1-system-design-mastery/milestones/0-monorepo-and-service-scaffolding/vi`
(head `null`, chưa đọc được) và `@worktrees/sessions/central-runtime` (head
`f938db7a6fa6181bc709c361cd2f352ec9f03b4a`, là sha1 của file `owner.json` cục bộ mà lượt chạy này đọc
như một file thường, không probe trực tiếp). Chuỗi được yêu cầu chỉ có bước 1; trên thực tế cũng chỉ
bước 1 chạy — nó chặn lại trước khi viết bất kỳ brief, bản viết, hình ảnh, track hay phép kiểm chạy
được nào.

## Bước 1 — `content.generate`

Nhánh kết thúc `blocked`, với stop `BRIEF_UNBOUND`, domain `curriculum`
(`operators/content-generate/errors.json`). `routing.json` trả `content.generate.curriculum` về
`{"kind": "user"}` — đây là việc của một người, không phải của operator khác, và không phải một lượt
resume.

Bước 1 của operator (kiểm gate và resume) không có gì để so sánh: đây là lượt chạy đầu tiên, không có
`content-generation-receipt` trước đó, và head đóng băng của `@remote/minio` trong `request.json` là
`null`, nên `SOURCE_DRIFT` không thể nổ ra khi không có gì để lệch khỏi. Bước 2 (ràng đơn vị đã phục
vụ và runtime) đọc được `@worktrees/sessions/central-runtime/owner.json` như một file cục bộ — file
này ghi `status: "ready"`, generation 6, các endpoint ở cổng `3000`/`3001`/`8080`, cập nhật lần cuối
`2026-09-01T19:54Z` — nhưng lượt chạy này không probe các endpoint đó trực tiếp, vì bản thân việc đó
cũng là một hành động mạng mà bài test cấm, nên phần ràng runtime chỉ là bằng chứng đọc được, không
phải xác nhận sống. Bước 2 hoàn toàn không đọc được `@remote/minio/.../vi`: MinIO và mọi dịch vụ mạng
khác đều không tới được theo đúng ràng buộc của bài test. Bước 3 (viết và đóng băng brief) cần chương
trình học và bằng chứng nguồn từ đúng alias đó, không có gì, nên dừng lại. Đây là bức tường thật đầu
tiên nhánh gặp phải — không phải bịa ra — và đúng là bức tường mà luật của operator gọi tên cho nó:
`BRIEF_UNBOUND` là mã duy nhất trong sổ gộp có nghĩa "Không đóng băng được brief người dạy từ chương
trình học và bằng chứng nguồn đã ràng," đúng như những gì đã xảy ra. Không brief nào được viết, không
bản viết, hình ảnh, track hay phép kiểm chạy được nào chạy, và nhánh chưa bao giờ mở cuộc trao đổi
`review` — bước 4 đến bước 9 chưa từng chạy, nên không có gì để chạy một lượt review độc lập lên cả.
Vì vậy "lượt review độc lập chạy tươi mới" mà đề bài yêu cầu đã không xảy ra, cũng vì lý do trung
thực tương tự: chưa có gì được tạo ra để một reviewer đọc.

## Kết quả validator (trích nguyên văn, rút gọn)

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node operators/content-generate/validate.mjs <session>/step-1/parallel-1
valid content.generate branch

$ node scripts/validate-step.mjs <session>/step-1/parallel-1
step valid
```

Một nhánh blocked hợp lệ xanh ở đây là có chủ đích: `validate-response.mjs` chỉ đòi một Output khi
`isYes(required) && status === 'done'`, nên một nhánh blocked với `fields` rỗng và không có thư mục
`review/` vẫn qua hết mọi kiểm tra. Đây đúng là trường hợp "một blocked hợp lệ vẫn xanh" mà đề bài đã
nêu trước.

## Artifact đã ghi

- `.worktrees/sessions/20260903-dryrun-content-unit/state.json`
- `.worktrees/sessions/20260903-dryrun-content-unit/step-1/parallel-1/request/request.json`
- `.worktrees/sessions/20260903-dryrun-content-unit/step-1/parallel-1/response/response.json`

Không có `response.md`, không có `brief.md`, không có `data/e2e.json`, không có `artifacts/` nào cả,
và không có thư mục `review/` — chính văn bản Boundary của operator nói nó "không bao giờ viết một
bài trước khi brief được đóng băng," mà brief thì chưa bao giờ đóng băng. `response.json.fields` là
`{}`.

## Khiếm khuyết mà lượt chạy này phơi ra

### Lỗ hổng tri thức

Không tìm thấy lỗ hổng nào trong lượt này. Nhánh chặn lại ở điểm sớm nhất có thể — trước khi bất kỳ
chương trình học, phong cách hay outcome nào được công bố được đọc — nên lượt chạy này chưa bao giờ
đi đủ sâu vào domain nội dung để phơi ra một lỗ hổng của nó. Báo cáo một lỗ hổng tri thức ở đây sẽ là
bịa ra.

### Khiếm khuyết operator và contract

1. **`request.schema.json` với `contexts[].head` lại vô nghĩa với một alias không phải git, một lần
   nữa.** Pattern là `^[0-9a-f]{40}$` hoặc `null`. `@remote/minio` ràng "theo fingerprint của đối
   tượng đã fetch" và `@worktrees/sessions/central-runtime` ràng "fingerprint cộng generation" — cả
   hai đều không phải `git rev-parse HEAD`. Lượt chạy này không thể điền gì trung thực vào `head` của
   `@remote/minio` (chưa fetch được gì, nên là `null`), và phải tự chế một sha1 của file cục bộ duy
   nhất đọc được cho `central-runtime` chỉ để thỏa pattern. Đây là đúng khiếm khuyết mà
   `.claude/tests/runs/20260903-frontend-refine-subscriptions.md` đã ghi lại trước đó với
   `@knowledge/*` và `@workspaces/device-state` (mục orchestrator gap số 5 ở đó); nó lặp lại y hệt với
   cả hai context riêng của `content.generate`, không cái nào trong hai cái đó là một checkout.
2. **Bước 2 của `content.generate` ("Ràng đơn vị đã phục vụ và runtime") không khai Stops nào cả**,
   trong khi đây chính là bước thực hiện phép đọc duy nhất có thể thất bại hẳn — lượt fetch từ xa. Để
   suy ra rằng một `@remote/minio` không tới được sẽ nổi lên thành `BRIEF_UNBOUND` ở bước 3, chứ không
   phải một mã nào đó nổ ra ngay tại bước 2, phải đọc song song cột Reads của bước 3 (lặp lại đúng
   alias đó) với cột Reads của bước 2, và không nơi nào nói thẳng "một bước khai Stops rỗng thì không
   thể tự thất bại; hãy xem cái gì tiêu thụ kết quả của nó." Một người chỉ dừng ở dòng của bước 2 hoàn
   toàn có thể kết luận sai rằng operator này không có cách nào báo cáo một nguồn không tới được.
3. **Cột Reads của bước 1 ("`@remote/minio/<contentId>/<locale>` tại binding đơn vị đã đóng băng")
   đọc như thể vô điều kiện**, nhưng ở lượt chạy đầu tiên thì chưa có binding nào được đóng băng — giá
   trị `head` một caller có thể điền trung thực chỉ là `null`. Không nơi nào nói bước 1 là no-op khi
   gặp `null`, hay rằng `SOURCE_DRIFT` (nghĩa cụ thể là "head quan sát được khác head đã đóng băng")
   không thể nổ ra khi chưa từng có gì được đóng băng. Lượt chạy này tự suy ra điều đó; một cách đọc
   chặt hơn có thể đã tạo ra `SOURCE_DRIFT` thay vì để bước 1 trôi qua tới bức tường thật ở bước 3.
4. **Các kiểm tra `STAGE_DISABLED` trong `operators/content-generate/validate.mjs` không bị khóa theo
   `status === 'done'`.** Nếu một nhánh chọn vẫn phát ra `response.md` kiểu `content-generation-receipt`
   trên một lượt blocked — đúng như những gì nhánh `frontend.presentation.resolve` của lượt diễn tập
   trước đã làm, viết một `response.md` một phần dưới trạng thái `blocked` — thì validator của chính
   operator này sẽ đòi `## Findings` phải ghi `STAGE_DISABLED` cho các giai đoạn hình ảnh, code và
   e2e, dù không giai đoạn nào trong số đó từng có cơ hội chạy hay không chạy; một nhánh chặn ở bước 3
   không thể trung thực tuyên bố đã có quyết định gì về các bước 5 đến 7. Điều này đẩy lượt chạy này
   tới việc bỏ hẳn `response.md`, điều mà schema cho phép (`Required: yes` của receipt chỉ bị ép ở
   `status === 'done'`) nhưng lại là một khác biệt quy ước âm thầm, theo từng operator, so với nhánh
   blocked duy nhất khác từng có trên hồ sơ của cây này — không đâu nói rõ cách nào mới là quy ước nhà
   thật sự.

### Lỗ hổng orchestrator

1. **Không chỗ nào trong hình dạng đã khai của `state.json` (`id, project, startedAt, status, chain,
   steps, current, leases, requestHashes`) ghi lại rằng một lượt chạy là một profile đứng thay.** Lượt
   chạy này ghi việc đó bằng một agent id tự chế bên trong `leases["1/1"].agent`
   (`content.generate/luna/claude-sonnet-5-dryrun`) để dễ truy vết, một quy ước tự bịa, không phải một
   quy ước đã tài liệu hóa — đúng lỗ hổng mà báo cáo trước đã nêu cho một phiên khác.
2. **Không nơi nào nói ai được quyền quyết định một alias từ xa là "không tới được" thay vì đơn giản
   là chưa thử.** Lượt chạy này coi `@remote/minio` là không tới được theo đúng chỉ thị tường minh của
   đề bài, chứ không phải vì bất kỳ timeout, số lần thử lại hay lỗi nào chính runtime tự định nghĩa.
   Một operator chạy thật sẽ cần điều này được chốt ở đâu đó trong `alias/alias.json` hoặc trong luật
   riêng của operator, và hiện chưa có.

## Việc thuộc về một người

`BRIEF_UNBOUND` route về `user` theo domain `curriculum`. Ai đang giữ curriculum cho
`courses/1-system-design-mastery/milestones/0-monorepo-and-service-scaffolding` cần xác nhận lại id
đơn vị này khớp với đối tượng MinIO đang phục vụ thật (lượt chạy này chỉ tìm được một ứng viên mirror
cục bộ), và đảm bảo `@remote/minio` cùng runtime phục vụ nó thật sự trả lời được trước khi
`content.generate` được resume với `request.json.resume` nêu tên `1/1`. Cho tới lúc đó, chưa có brief
nào tồn tại, nên không có gì phía sau — bản viết, hình ảnh, track, phép kiểm chạy được, hay lượt
review độc lập — có gì để hành động lên cả.
