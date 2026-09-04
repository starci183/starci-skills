# StarCi Skills 1.8.0

Cây này chính là runtime. Đọc tiếp `SKILL.md` (bản tiếng Anh là bản được nạp; `SKILL.vi.md` chỉ để người đọc); đó là cửa vào duy nhất,
đóng băng phạm vi của một nhiệm vụ, chọn đúng một operator sở hữu kết quả, rồi định tuyến giữa các
operator dựa trên kết quả có kiểu.

## Thứ tự nạp

0. [`UPDATE.md`](UPDATE.md) (bản soi [`UPDATE.vi.md`](UPDATE.vi.md)): đọc trước khi sửa cây này, không
   bao giờ để chạy một nhiệm vụ. Đó là chuẩn cập nhật một cây skills hình dạng này: bốn câu hỏi theo
   thứ tự, được thêm gì và không được thêm gì, sửa một id thế nào và cho một id nghỉ thế nào, mức bằng
   chứng, luật ngôn ngữ, cưỡng chế trước lời khuyên, file nào được sinh ra, phát hành nghĩa là gì, và
   danh mục kiểm trước khi commit. Một thay đổi chưa đi qua nó thì chưa commit được.
1. `SKILL.md`: cửa vào, vòng lặp định tuyến, và tuyên bố về thẩm quyền.
2. `routing.json`: bảng đóng ánh xạ mọi domain mà mã dừng bàn giao tới (xem bảng Mã dừng trong
   `operators/INDEX.md`) sang bước kế tiếp. Bảng được kiểm đối chiếu với bảng Dừng của các operator,
   nên thiếu một route là lỗi build. `workflows/` giữ các chuỗi mẫu mà cửa vào dùng lại.
3. `resources/`: profile thực thi nào chạy từng vai trò của operator, nó được dùng quyền nào lúc
   chạy, và câu trả lời thường trực về tìm mạng, ràng Grammar, sinh hình. Cũng được kiểm.
4. Đúng một operator mà nhiệm vụ cần: `operator.md` (Việc, Context, Đầu vào, Yêu cầu, Các bước, Đầu ra,
   Dừng, Kế tiếp) cùng `operator.json` (id, domain, resources). Mã dừng tra ở bảng Mã dừng trong `operators/INDEX.md`.
5. Chỉ những topic knowledge mà operator đó bind.

Không nạp trước cả cây. Một operator bind tập topic nhỏ nhất mà quyết định của nó cần, mỗi topic kèm
fingerprint và danh sách rule đầy đủ, và không được phát ra mã nào ngoài danh sách ấy.

## Bố cục

```text
SKILL.md                 một cửa vào, mười bốn operator, một bảng định tuyến
routing.json             14 operator, 68 route, bốn loại: operator | resume | user | external
alias/                   alias.json (sổ cho máy: vị trí, scheme, bind, ai ghi, vùng) + INDEX.md (bản đồ sinh theo vùng); operator chỉ đọc qua alias
resources/               tools.json (sổ tool đóng: mode và hỗ trợ theo runtime, gọi bằng @tools/<id>) + agents/profiles/{openai,claude}.json (6 profile, quyền theo tool) + orchestrator.json (mỗi operator một agent, tối đa 3, profile tương đương); có kiểm
workflows/               chuỗi mẫu (các bậc gồm nhánh song song, vòng lặp, preset) mà cửa vào dùng lại khi request khớp when; không khớp thì tự ghép theo cùng luật; có kiểm
operators/INDEX.md       sinh tự động: mỗi operator đọc gì, tiêu thụ và sinh kind nào, số bước, và mọi mã dừng kèm cách xử lý; operators/errors.json giữ mã dùng chung
operators/<id>/          operator.md (+vi) một file viết tay cho mỗi operator, operator.json (id, domain, resources), errors.json (mã riêng), validate.mjs, self-test.mjs
knowledge/
  ui/composition/        cây phải chứa gì, trước khi nó tồn tại      -> frontend.direction.decide
  ui/presentation/       ranh giới do app sở hữu lấy giá trị CSS nào -> frontend.presentation.resolve
  ui/proof/              thứ chỉ đúng sai sau khi đã render          -> frontend.surface.audit
  patterns/fe, be        quy ước code trích từ hai source thật
  grammars/<họ>/         cách một họ hình ảnh hiện thực Common
templates/               mỗi loại tài liệu một template; mỗi template mang khối json template-contract dùng để kiểm cả cây;
                         kinds/ định kiểu mọi file đi qua giữa các bước (<kind>.contract.json + <kind>.skeleton.md cho markdown, <kind>.schema.json cho dữ liệu); step/ giữ hai gate request.json và response.json
scripts/                 validate-routing.mjs, validate-resources.mjs, validate-knowledge-citations.mjs, validate-alias.mjs, validate-templates.mjs, validate-operator.mjs, validate-workflows.mjs, validate-request.mjs, validate-response.mjs, validate-step.mjs, run-operator-self-tests.mjs;
                         device-state.mjs và workspace-portable.mjs (+ spec), thứ package.json của backend gọi tới
readiness/               các schema workspaces/ mà khai báo route portable và hydrate gọi tên trong $schema
```

`npm test` chạy kiểm định tuyến, kiểm resources, kiểm trích dẫn knowledge, kiểm template, mọi self-test của operator, và các spec của script. Head đã publish phải xanh, không xanh
thì không được publish.

## Luật áp dụng khắp nơi

- Một operator làm đúng một việc trong một lượt tuyến tính. Nó không gọi operator khác, không điều
  phối workflow, không tự dừng giữa chừng, không trả chỉ dẫn điều khiển dạng văn xuôi. Chỉ cha mới
  ánh xạ một output đã validate sang bước chuyển kế tiếp.
- Chỉ trường đã validate mới định tuyến được. Văn xuôi trong receipt, kết quả kể bằng lời, hay
  output trượt validator đều không định tuyến.
- Thẩm quyền nằm trong schema của operator, không nằm ở file này hay ở `SKILL.md`. `git.publish`
  không diễn đạt được force push; `release.deploy` không chạy nổi khi thiếu authorization đã khai;
  `uat.verify` không có trường nào chứa nổi credential.
- File `.md` tiếng Anh là authority duy nhất lúc chạy. File `.vi.md` cùng tên là bản đọc cho người,
  không bao giờ vào context manifest, danh sách phụ thuộc, hay binding của
  operator; validator đối chiếu chỉ đọc chúng để chứng minh bản gương không lệch, không bao giờ coi là authority.
- Mã rule là địa chỉ công khai ổn định. Chỉ thêm; không đánh số lại, không dùng lại, không lặng lẽ
  đổi nghĩa.

## Dòng dõi

1.8.0 (2026-09-04): tương tác có một chính sách giao tiếp cùng gate câu hỏi/lựa chọn có kiểu; người dùng chọn hướng khác biệt dựa trên bằng chứng render, lựa chọn đã ghi được dùng tiếp, và bỏ hỏi xác nhận thường lệ trong việc đã được giao; quyền thao tác và định tuyến giữ nguyên.

1.7.9 (2026-09-04): mở phiên là hành động đầu tiên của một nhiệm vụ có viết, không phải câu hỏi đặt cho người và không phải việc làm sau lần viết đầu tiên — nhiệm vụ đã lỡ viết ngoài phiên thì mở phiên rồi chuyển việc lên nhánh của nó; một lần bind thấy source chưa commit trên nhánh mutation thì từ chối, dù write root đã khai có phủ nó hay không.
1.7.8 (2026-09-04): một giá trị niêm phong chỉ được phân giải tại đúng chỗ tiêu thụ — một lệnh chẩn đoán chứng minh tham chiếu phân giải được thì báo kết quả, tên, độ dài hay digest, không bao giờ báo giá trị, và lệnh nào không viết được như vậy thì không chạy; receipt trước đây chỉ có mục fallback nay có mục finding để ghi sự cố ấy.
1.7.7 (2026-09-04): một lượt đi bộ chỉ là bằng chứng cho thứ nó đã bấm — mỗi khẳng định được chấm trong một capture UAT phải nêu tên control trên bề mặt mà bước đó tác động, nên một bước làm cho việc gì đó xảy ra không qua bề mặt thì không được chấm.
1.7.6 (2026-09-04): điểm là một lời khẳng định về chính ứng viên được chấm — quyết định khai rõ ứng viên không mang gì, và tiêu chí đã khai là không thoả thì không được chấm ở đầu đạt, cũng không được bỏ trống.
1.7.5 (2026-09-04): một lần chạy UAT khởi động vì nhu cầu và lấy thẩm quyền từ khai báo môi trường cho lớp seed và định danh, không phải từ một người được nêu tên trong request; topic đọc theo trạng thái — composition, accessibility, lens taste — bị blocked kèm tên các khoảng thiếu khi ma trận không phủ đủ trạng thái direction khai, và một vòng thu hẹp không được chốt vòng lặp hay tuyên đã cạn ngân sách; bậc serve chạy bộ gate giao hàng do sản phẩm khai, gồm patch coverage đo theo base đã merge.
1.7.4 (2026-09-03): thẩm quyền đến từ khai báo môi trường — .stacks/<env>/environment.json đánh dấu từng lớp thao tác là declared hay person, ngoài production mặc định declared cho cấp tài khoản và runtime, production mặc định person, và trường approval nhận tham chiếu khai báo kèm hash; nhiều ứng viên đã render được xếp hạng theo rubric proof và ứng viên trội được chọn, chỉ hỏi người khi điểm số chứng minh hoà; tiêu chí phụ thuộc khối lượng dữ liệu đo ở khối lượng seed đại diện của flow, thiếu thì route sang seed, đủ mà vẫn fail thì là data-bound; tiêu chí mà lựa chọn in ra của người đã biết là fail thì là person-accepted và không chặn quality hay uat.
1.7.3 (2026-09-03): quyết định trao cho người được in thành ứng viên đã render — mỗi lựa chọn một ứng viên, ít nhất ba cho composition hay taste, một ảnh mỗi viewport, câu hỏi một dòng — và validator của direction và audit từ chối route user in ít hơn; family bind theo grammarId của route dưới dạng @knowledge/grammars/<family>; hàng Steps nêu việc và kind, cơ chế nằm ở contract của kind; UPDATE.md mang hai nguyên tắc viết (không cụ thể, không đính chính) và cả cây được quét theo cả hai.
1.7.2 (2026-09-03): khởi động lại không phải là build lại — scripts/serve-runtime.mjs ghi head đã serve và digest của manifest/lockfile theo route, xoá cache build của framework khi chúng đổi, khi head trước không rõ hoặc khi được yêu cầu --clean, và dừng trọn cây tiến trình của server rồi kiểm tra bằng kết nối rằng cổng đã trống; receipt platform-operation bắt buộc có hàng cache và validator từ chối cache giữ nguyên trên head trước không rõ.
1.7.1 (2026-09-03): INTEGRATION_CONFLICT nghỉ hưu vào INTEGRATION_FAILED — serve tự giải xung đột merge theo bốn luật đóng, ghi từng cách giải trên lần merge, chạy gate giao hàng trên head đã gộp trước khi khởi động lại, và chỉ dừng khi gate đỏ; Served surface của audit nêu phiên bản family quan sát được và phiên bản lúc resolve, lệch thì ghi vào bằng chứng của verdict có thể lật.
1.7.0 (2026-09-03): runtime là nhánh tích hợp uat của mỗi sản phẩm trên cổng cố định — platform.operate leo đủ thang stack-up → locate → start-role → serve → attest, serve = merge nhánh phiên vào uat rồi khởi động lại idempotent theo head, server chạy ngầm có pid/log (scripts/serve-runtime.mjs), lease theo thứ tự merge, RUNTIME_BUSY và INTEGRATION_CONFLICT; bind theo tổ tiên (head serve chứa commit đã pin); audit có input route và mục Served surface; UAT có isolation trong snapshot; luật hai phiên một sản phẩm ở một chỗ; schema projection cổng với sessionSlots mặc định 0.

1.6.1 (2026-09-03): @tools/print — direction in URL và ảnh mỗi candidate theo viewport trước khi viết quyết định, audit in sheet + ảnh tệ nhất mỗi topic + bảng Verdict, UAT in tóm tắt ảnh từng bước; receipt có bảng ## Printed và validator từ chối quyết định mà người chưa thấy.

1.6.0 (2026-09-03): hồ sơ UAT thiếu thì được tạo, không báo lỗi — platform.operate cấp tài khoản tại identity provider của registry với mật khẩu chung niêm phong và seed dữ liệu; registry runtime theo <project>/<role> (owner.schema.json) có identity; audit đăng nhập bằng tài khoản của flow, IDENTITY_MISSING chuyển sang provisioning; kiến trúc thư mục UAT (flow.md, accounts.<env>.json, seed, snapshots golden, runs append-only, latest.json, history.md) là contract; tham số env ở uat/audit/platform; workflow ví dụ staging-uat.

1.5.4 (2026-09-03): host dò cổng bằng cách kết nối trước khi bind (Windows cho hai server cùng bind một cổng loopback); 1.5.3 đã phát hành với spec host đỏ.

1.5.3 (2026-09-03): @tools/host có script đi kèm (scripts/host-artifacts.mjs), không phiên nào phải tự viết server nữa; .gitattributes khoá LF.

1.5.2 (2026-09-03): quyết định direction khai surface class (coverage.surfaceClass + ## Surface class, đọc từ COVERAGE-1), audit chép class từ decision thay vì tự khai.

1.5.1 (2026-09-03): rule kết luận của topic contrast lấy tiền tố của chính topic (CONTRAST-1); COLOR-6 nghỉ, trỏ sang nó.

1.5.0 (2026-09-03): UPDATE.md, chuẩn cập nhật trung lập cho một cây skills, đứng đầu thứ tự nạp và đi theo gói cài; session-first và SESSION_MISSING; git.publish đòi receipt; mọi workflow ví dụ là luồng dài (bind runtime → audit chụp màn → quality → uat → publish); lens taste (TASTE) và experience (UX) tự kết luận trong topic của mình, verdict cuối là bảng trong receipt của quality.verify; @tools/host phục vụ candidate theo viewport; pass gom: 44 chỗ → 19 cho các khái niệm thêm trong ngày, ui.md và FE-TEST-7 nghỉ.

1.3.0 (2026-09-03): gate quét presentation chạy máy (scripts/sweep-presentation.mjs: APP_OVERRIDE, APP_REIMPLEMENTATION, OFF_SCALE, SHELL_GEOMETRY) nối vào frontend.source.apply và quality.verify; phạm vi resolve gồm mọi thư mục leaf/branch app sở hữu; luật twin, spec cặp và hằng số triển khai; luật viết product-agnostic.

1.2.0 (2026-09-03): vòng test thứ hai (tests/) và các sửa từ đó: state.json có schema và liên kết resume được kiểm; workflow khai asks; response.next phải nằm trong bảng Next; UNKNOWN_STOP phát được; quyết định kiến trúc công bố các operation mà kế hoạch backend tiêu thụ và trích dẫn dimension của ma trận bao phủ thay cho BA-<n>; uat.verify chấp nhận lời từ chối hợp luật của chính nó; chủ đề radius.

1.1.0 (2026-09-03): cây phát hành thành gói npm @starci/skills; npx @starci/skills init cài nó làm runtime .claude của một repository kèm bootstrap CLAUDE.md và AGENTS.md, update giữ sửa đổi tay, doctor chạy validator trên bản đã cài; @starci/grammar 0.4.2 (entry core re-export Common).

1.0.3 (2026-09-03): sổ tool thay cho grant và policy (resources/tools.json, @tools/<id> trong Các bước, hỗ trợ theo runtime, profile tương đương); mọi operator ràng profile OpenAI cho processor Codex; vòng test đầu (tests/) và các sửa từ đó; docs/ và sites/ trở lại.

1.0.2 (2026-09-03): mọi operator là một operator.md viết tay với layout nhánh request/response, hợp đồng kind JSON, sổ mã dừng có cách xử lý, workflow mẫu, và tên frontend.* / backend.source.apply; 1.0.1 là vòng chạy khô đã lộ ra dạng cũ.


Cây này thay thế runtime v7.6 vào ngày 2026-09-02. Toàn bộ cây v7.6, gồm 13 skill, 113 operator,
template và các contract runtime, được giữ nguyên trên nhánh `v7` của cùng repository. Tài liệu v8
nào dẫn tới một file chỉ có ở v7 thì gọi tên nhánh đó.
