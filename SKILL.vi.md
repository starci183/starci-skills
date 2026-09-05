# StarCi

Một cửa vào, các operator được liệt kê trong mục lục, một bảng định tuyến đóng. File này vẽ chuỗi
từ nhiệm vụ đã xác nhận, chọn operator đầu tiên và sắp xếp các operator còn lại. Nó không tự làm việc gì: không quyết một giá trị, không ghi source, không
phán xét một kết quả.

## Chuẩn bị

Trước khi đặt câu hỏi, áp dụng [chính sách tương tác](resources/interaction.md).
Điều này chỉ thay đổi giao tiếp: mọi chuyển bước định tuyến, ranh giới operator và thẩm quyền bắt
buộc bên dưới vẫn giữ nguyên. Cột Ask hay reason chẩn đoán không phải câu hỏi tự động đem chuyển.

Mỗi prompt người dùng trước hết chạy `scripts/session-open.mjs open`: tạo hoặc dùng lại đúng một
ledger StarCi đã bind với task Codex hay session Claude gốc và worktree người dùng. Việc này xảy ra
trước xác nhận scope, plan, dispatch, design hay mutation. Agent, helper, exchange lồng nhau và retry
bind về host session đó; không mục nào tạo thêm một user session.

Trong v2.2, draft scope được trình bằng bảng Goal, Target, Trong scope, Ngoài scope, Đầu ra, Đạt khi,
Phạm vi kiểm và Ví dụ. Prompt đã nêu rõ và cấp quyền đúng bảng đó được ghi làm `as-stated`, không hỏi
lặp thường lệ. Sửa tạo version kế tiếp; từ chối hoặc im lặng giữ draft và chặn dispatch. Trước mỗi
invocation, `attempt-gate open` đóng băng expected, input sidecar và environment; `worker-slots`
cấp một trong ba slot chung toàn host session và ghi profile thực sự được dispatch. Input nội bộ chỉ
được chuyển tiếp từ attempt đã match khi manifest bằng chứng được chấp nhận vẫn niêm phong đúng kind.
Helper thuộc mission phải ghi `templates/step/helper-request.schema.json`, rồi dùng `acquire-helper`
để lease các support owner cụ thể từ cùng ba slot và dùng lệnh release chung khi nhả slot.
`attempt-gate accept` chỉ cho advance khi actual có
bằng chứng và match từng expected bắt buộc. Mismatch được giữ để repair, retry hoặc blocked; retry
không được hạ expected. Attempt có ghi dữ liệu phải lease owner cụ thể; source-writing tự lease
worktree thật sau khi chuẩn hóa junction, symlink và chữ hoa/thường của đường dẫn Windows. Chỉ tín
hiệu close-success riêng mới compact và kiểm bundle dưới
`@worktrees/done` rồi xóa đúng folder session tạm; publish không đóng session, không xóa worktree hay
branch người dùng.

1. Đóng băng một phạm vi nhiệm vụ: đơn vị, đích, phần bao gồm và phần loại trừ, các gốc được ghi,
   hiệu ứng ra bên ngoài, và thứ sẽ được tính là bằng chứng. Hai cách đọc làm đổi bất kỳ điểm nào
   trong số đó là một câu hỏi tập trung, không phải một phỏng đoán. Đóng băng không diễn ra trong im
   lặng: với nhiệm vụ sẽ ghi source đã route hay chạm tới một runtime, phạm vi đã đóng băng được in
   cho người thành một khối tối đa năm dòng bằng ngôn ngữ hiển thị (`resources/settings.json#language`
   đè lên `settings.example.json`, mặc định `vi`; người viết bằng ngôn ngữ khác thì được trả lời bằng
   ngôn ngữ đó) — mục tiêu, cái gì trong và cái gì ngoài, các dòng "xong khi", việc kiểm chứng với
   tới đâu, một câu hỏi — và được xác nhận một lần qua lựa chọn `goal-confirm` trước bước 2. Dòng
   phạm vi là nơi duy nhất phần thu hẹp được đưa ra cho người: nó được điền từ chính các con số đếm
   của mọi kế hoạch phiên này đã cho tới nơi, tại mỗi lần một kế hoạch tới
   (`state.json.mission.scope`, `resources/interaction.json#rule`),
   và thứ nó nói là đã hoãn thì đứng trên sổ chưa kiểm dưới `@worktrees/unchecked` chứ không đứng
   trong một câu hỏi thứ hai. Khối đó là câu hỏi duy nhất một prompt mới đặt ra; từ đó lượt chạy phải mượt: log transition in ra mà không chờ, vẽ lại dưới cùng goal và
   vào lại theo route không hỏi gì, và chỉ route `user`, một `budget-choice` hay goal được sửa mới dừng
   để hỏi người (`resources/interaction.json#asks`). Mỗi dòng "xong khi" gọi tên operator mà biên nhận của nó là bằng chứng ấy, và một
   yêu cầu không viết nổi dòng "xong khi" nào thì không bắt đầu. Khối và câu trả lời là thứ bước 4 ghi
   thành `state.json.mission` và `choices["goal:<sessionId>:v<version>"]`: `corrected` viết phiên
   bản kế tiếp rồi hỏi lại, và nhiệm vụ mà phiên bản mới nhất chưa là `as-stated` thì không chạy gì
   (`scripts/validate-request.mjs`). Một nhiệm vụ mở ra từ một mục đã được duyệt trong kho
   (`@worktrees/banked/<product>`, `state.json.mission.bankRef`) in khối đó ra và không chờ: người đã
   duyệt cả hàng đợi một lần, và câu trả lời duy nhất ấy là goal-confirm của mọi nhiệm vụ hàng đợi liệt
   kê, được ghi lại thành lựa chọn của chính phiên này với phê duyệt ấy làm `sourceRef`
   (`scripts/validate-session.mjs#bankRefErrors`). Một goal bị sửa lúc mở thì không nằm trong phạm vi
   đó: mục trong kho được viết lại, phê duyệt hết hiệu lực, và phiên bản kế tiếp được hỏi như thường.
   Việc chỉ đọc không hỏi gì.
2. Chạy `environment.preflight` trước cho mọi nhiệm vụ chạm tới source đã route hay một runtime:
   mọi bức tường nhiệm vụ có thể gặp — route chưa khai hay gần trùng tên, thiếu chính sách git,
   checkout bẩn, đăng nhập thất bại, head đang phục vụ không chứa head đã bind, port bị giữ, thiếu
   trình duyệt hay container, một phê duyệt mà môi trường giữ lại cho người — được báo cùng lúc trong
   một báo cáo sẵn sàng có kiểu, thay vì mỗi giờ một bức khi chuỗi đâm vào chúng. Rồi chạy
   `workspace.bind` cho mọi nhiệm vụ có đọc hoặc ghi source đã route. Không thứ gì khác được phép tự
   tìm checkout, và một thư mục trùng tên không bao giờ là thẩm quyền route.
3. Vẽ chuỗi từ nhiệm vụ đã xác nhận, không bao giờ từ một ví dụ: không còn `when` nào để tra.
   `scripts/plan-chain.mjs` đi ngược từ các operator mà những dòng "xong khi" gọi tên, qua bảng Đầu
   vào, Context và Kế tiếp của các operator (`workflows/README.md` nêu cách suy và các luật), mở
   chuỗi bằng `environment.preflight` khi một operator trong chuỗi cầm tool có tác dụng phụ, bind mọi
   vai mà nhiệm vụ khai hay một bảng Context đòi, cho operator được hơn một dòng "xong khi" gọi tên
   chạy sau người anh em `<domain>.plan` của nó để bậc execute toả ra theo đơn vị — mỗi nhánh một đơn
   vị, tối đa ba nhánh một bậc — và áp luật dòng dài: chuỗi nào ghi source frontend dưới
   `mode: apply` và tới `git.publish` thì chứng minh bề mặt bằng operator audit có primary output là
   `frontend-surface-audit` và đi qua `uat.verify` ở giữa, vì một bản giao mà không ai nhìn và không
   ai đi thử thì không phải một bản giao. Kế hoạch được in cho người theo hai dòng mỗi nhánh — goal,
   rồi vì sao nhánh đó có mặt — và `scripts/validate-chain.mjs` chấp nhận nó trước bước 5; chuỗi mà
   các bảng để mập mờ là một lời từ chối gọi tên chỗ mập mờ, không bao giờ là một phỏng đoán. Mỗi
   lần dừng làm đổi thứ nhiệm vụ cần thì vẽ lại chuỗi theo đúng cách đó và ghi thành transition
   `replanned` kèm ghi chú và phiên bản goal.
4. Tạo phiên trước khi bất cứ điều gì khác xảy ra. Không có gì được thiết kế, ghi hay commit bên
   ngoài một phiên: hành động đầu tiên của một nhiệm vụ sẽ ghi bất cứ thứ gì, theo đúng thứ tự, là
   thư mục phiên, nhánh mà chính sách git của route đặt tên cho việc của phiên, rồi một
   `request.json` đã hợp lệ — không bao giờ là một câu hỏi đặt ra cho người, hỏi có nên mở phiên hay
   nên làm cái nào trong số đó, vì cây đã trả lời sẵn cả hai, và không bao giờ là việc làm sau khi đã
   ghi lần đầu. Trước khi bất kỳ file nào ngoài thư mục phiên bị đọc để sửa, và trước khi bất kỳ file
   nào ngoài thư mục phiên bị ghi, `<Source>/.worktrees/sessions/<sessionId>/state.json` và
   `step-1/parallel-1/request/request.json` đã có trên đĩa và `scripts/validate-request.mjs` xanh
   trên nhánh đó. Một agent phát hiện mình đang sửa hay công bố nguồn được route mà không có
   `step-N/parallel-M` nào dưới một phiên thì dừng và báo `SESSION_MISSING`. Cách sửa của nó là cố
   định, không phải một lựa chọn đem hỏi: mở phiên ngay bây giờ, chuyển thay đổi đã ghi sang nhánh mà
   chính sách git đặt tên cho việc của phiên, rồi chạy các operator còn nợ biên nhận cho nó — đúng
   cách khắc phục mà chính `SESSION_MISSING` đã nêu — không bao giờ viết phiên sau đó để làm cho quá
   khứ trông như đã được chặn, vì như vậy là ghi chép việc chứ không phải chặn việc. Thiết kế
   bằng tay rồi commit lên một nhánh phiên trong khi không có phiên nào trên đĩa cũng là đúng vi
   phạm ấy: các phương án không ai thấy, các ảnh chụp không ai chụp và UAT không ai chạy chính là
   những thứ thư mục thiếu kia lẽ ra phải chứa.
5. Chọn operator đầu tiên của chuỗi đó. Chỉ đọc `operator.md` và `operator.json` của đúng
   operator đó.
6. Chạy operator đó, từ đầu tới cuối, trên đúng một profile mà `operator.json` của nó gọi tên dưới
   `resources`, với đúng những quyền nó liệt kê. Một operator không có model khác, không thừa hưởng lượt nào,
   và không có quyền nào mà assignment bỏ sót.

Bằng chứng giữa các phiên dùng scripts/producer-import.mjs. Chép bundle request/response của producer đã hoàn tất vào tọa độ step-N/parallel-M chưa dùng của phiên nhận, giữ nguyên từng byte và metadata session/step gốc. import.json bind tọa độ nguồn, đích và digest từng file. Gate input kiểm request gốc đã đóng băng, output hoàn tất đã khai, byte nguồn và bản chép; slot nhập chỉ là bằng chứng, không được đưa vào chain, steps, request hashes hay lease của phiên nhận. Dùng đường input step-N/parallel-M/response thông thường. Không chạy lại operator và không nhập quyền ghi source. Các kind mà một slot nhập khai được tính là đã sinh đối với chuỗi, cả trong plan lẫn ở gate (`workflows/README.md`, Chuỗi được suy ra thế nào).

## Cửa vào

| Yêu cầu nói về | Operator đầu tiên |
| --- | --- |
| Máy này, route, danh tính, runtime và phê duyệt của nó đã sẵn sàng cho nhiệm vụ chưa | `environment.preflight` |
| Dự án nào, checkout nào, hay binding runtime nào | `workspace.bind` |
| Sản phẩm hứa gì, ai được hưởng, hỏng thì ra sao | `business.decide` |
| Ranh giới hệ thống, quyền sở hữu dữ liệu, hay tech stack | `architecture.decide` |
| Hành vi phía server, một hợp đồng API, lưu trữ, hay một job | `backend.generate` |
| Gọi tên mọi trang và modal một tính năng cần, trước khi sinh bất kỳ cái nào | `interface.plan` |
| Tạo mới, dựng lại, hay thiết kế lại một trang hoặc một modal | `interface.generate` |
| Một finding nhỏ trên trang đã có: dưới ba file, không đổi bố cục | `interface.fix` |
| Sửa package thư viện do owner quản lý và tiêu thụ bản phát hành của nó qua metadata dependency chính xác | `workspace.bind`, rồi `library.update` |
| Một surface đã render có thật sự đứng vững không | `interface.audit` |
| Build, lint, typecheck, coverage, hay Sonar | `quality.verify` |
| Gọi tên mỗi hành trình một luồng mà tính năng phải được đi thử | `uat.plan` |
| Một người thật có hoàn thành được một hành trình thật không | `uat.verify` |
| Tài khoản mà một luồng đăng nhập bằng | `identity.provision` |
| Những dòng dữ liệu một luồng cần, quy được nguồn và rút lại được | `data.seed` |
| Phục vụ một head đã commit trên cổng của sản phẩm, giữ lease của nó | `runtime.serve` |
| Observability, một dịch vụ Sonar, hay một tunnel cạnh runtime đang phục vụ | `service.operate` |
| Backend đã phục vụ có làm đúng như suite e2e của chính nó nói không, như một client, trên dữ liệu seed | `api.verify` |
| Áp một bộ migration đã khai đúng một lần | `migration.release` |
| Thứ đã giao có khớp thứ đã hứa không | `business.reconcile` |
| Phát hành một image, hay khôi phục một bản phát hành | `release.deploy` |
| Một đơn vị nội dung giáo dục | `content.generate` |
| Publish một ranh giới Git đã duyệt | `git.publish` |

Một yêu cầu không gọi tên chủ nào, hoặc gọi hai chủ có phạm vi khác nhau đáng kể, dừng lại ở đây với
một câu hỏi tập trung nêu tên các ranh giới đang cạnh tranh.

Một prompt gọi tên kho nhiệm vụ của một sản phẩm chứ không gọi tên một kết quả — "chạy kho cho
<product>" — là route `bank` (`routing.json#kinds.bank`, `resources/orchestrator.json#helpers.bank`), và
nó không chọn dòng nào của bảng trên: nhiệm vụ mà dòng ấy lẽ ra được chọn cho đã được viết sẵn.
Orchestrator lấy `scripts/bank.mjs#next` — mục banked đầu tiên có mọi `dependsOn` đã done, và không lấy
gì cả khi một mục anh em cùng sản phẩm còn đang chạy — đánh dấu mục ấy `running:<sessionId>`, mở phiên
ở bước 4 với `state.json.mission` chép nguyên từ bản nháp goal của mục và `mission.bankRef` gọi tên mục
cùng phê duyệt, rồi vẽ chuỗi của phiên ấy từ chính các dòng "xong khi" của nó như mọi nhiệm vụ khác.
Khi phiên kết thúc `done` thì mục được đánh dấu `done:<sessionId>` và mục kế tiếp được lấy; một phiên
kết thúc blocked hay stopped để mục của nó ở `running`, và đó chính là cách một nhiệm vụ dừng lại vì
người tạm dừng cả kho thay vì để mục sau nó mở ra. Orchestrator là người ghi `queue.json` duy nhất
trong một lượt chạy, và `scripts/validate-session.mjs#bankRefErrors` từ chối một hàng đợi đọc ngược lại
với những gì đã xảy ra.

Việc hỗ trợ không nằm trong bảng đó, vì nó không phải một nhiệm vụ. Một yêu cầu chuẩn bị hay dọn dẹp —
đọc những gì một sản phẩm để lại rồi phác một kho nhiệm vụ từ đó, và bất cứ thứ gì tầng hỗ trợ sẽ có
thêm — là một route kind `helper` (`routing.json#kinds.helper`, `resources/orchestrator.json#helpers`):
người viết `/helper <id> <args>` hoặc nêu tên công việc, helper được liệt kê trong
[`helpers/INDEX.md`](helpers/INDEX.md) chạy trên profile của chính nó mà không mở phiên, và để lại một
bản ghi lần chạy dưới `@worktrees/helpers/<id>/runs/<runId>/`. Helper không mở phiên, không ghi source
sản phẩm, không chạm runtime, không publish và không hỏi gì; cái nào thấy mình phải làm một trong
những việc đó thì đã tìm ra việc của một operator, và bảng trên là nơi có việc ấy.

## Vòng lặp

```text
request/request.json -> validate-request.mjs -> agent ghi response/ -> validate-response.mjs + validate.mjs của operator -> định tuyến
```

Định tuyến chỉ đọc `response.json`, không đọc gì khác:

1. `done` đưa chuỗi tới bậc kế tiếp mà kế hoạch gọi tên (`state.json.chain`, do `scripts/plan-chain.mjs`
   vẽ và `scripts/validate-chain.mjs` chấp nhận); `request.json` của nhánh sau trỏ tới output của
   nhánh này bằng đường dẫn tường minh.
2. `waiting` chạy cuộc trao đổi lồng mà response đang chờ (`<exchange>/request` và `response` trong
   cùng nhánh), rồi cho chính agent đó chạy tiếp; các nhánh cùng bậc vẫn chạy.
3. `blocked` đọc `stop`, tra mã trong sổ gộp (`operators/errors.json` cộng `errors.json` của chính
   operator) lấy `domain`, rồi tra domain đó trong `routing.json`:
   - `operator` gọi operator được nêu tên, rồi quay lại đây;
   - `resume` vào lại chính operator đó ở một bậc mới, `request.json.resume` gọi tên nhánh đã bị chặn;
   - `chain` thêm owner và prerequisite vào plan động của chính host session này, giữ goal đã xác
     nhận; nhánh bị chặn chờ không giữ slot rồi vào lại với evidence đã accept, không mở user session
     anh em;
   - `user` dừng và báo điều người phải quyết hay công bố;
   - `external` dừng và báo thứ gì ngoài runtime phải thay đổi.
   Mã có cách xử lý `fallback` không bao giờ chặn: agent làm đúng fallback, ghi dưới
   `## Fallbacks taken`, rồi chạy tiếp, trừ khi tham số `unless` của mã nói khác.

Response trượt một trong hai validator thì không định tuyến. Văn xuôi trong `response.md` không định
tuyến. Chỉ một trường đã validate của `response.json` mới định tuyến. Orchestrator ghi `response.json` thành khung `running` lúc dispatch; agent thoát mà không thay
khung ấy thì được follow-up đúng một lần rồi ghi nhận là `RECEIPT_MISSING`, để một nhánh kể lại việc
mình làm mà không ghi receipt hiện rõ trong sổ thay vì bị lặng lẽ bỏ qua.

`routing.json` là bảng đóng và được kiểm: mọi domain mà mã dừng của một operator bàn giao tới đều có
đúng một route, và không route nào gọi tên một domain không mã nào chạm tới. Thiếu một route là lỗi
build, không phải chỗ để phán đoán.

## Tiến độ

Mỗi operator tự mang ngữ nghĩa resume và fingerprint của nó, nên file này không giữ bộ đếm tiến độ
hay trạng thái handoff nào. Một route `resume` trả về `NO_PROGRESS` nghĩa là cùng một input đụng
cùng một bức tường: hãy báo bức tường thay vì thử lại.

Một vòng lặp giữa hai operator chỉ hợp lệ khi fingerprint tiến độ còn thay đổi. Fingerprint lặp
lại, hay cùng một phát hiện đáng kể xuất hiện hai lần, kết thúc vòng lặp và báo cho owner nhỏ hơn.
Một lần lập lại kế hoạch là một chuyển bước `replanned` mang ghi chú và phiên bản mục tiêu nó chuyển
tới, được xác nhận lại qua `goal-confirm`, không bao giờ là viết lại chuỗi trong im lặng.

Phiên chạy dưới một budget (`state.json.budget`, lấy từ `resources/orchestrator.json#budget`): trần
số bậc và trần cùng-operator. Request nào vượt một trong hai là `BUDGET_EXHAUSTED`, và người trả lời
một `budget-choice` có kiểu — thu hẹp, tiếp tục, dừng — được ghi vào `state.json.choices`; tiếp tục
nới trần có ghi nhận. Trí nhớ của chính orchestrator là `state.json.brief` — đã chứng minh gì, đang
kẹt ở đâu và chờ ai, tiếp theo là gì, phiên anh em nào giữ head nào, và bản báo cáo cuối người đã
nhận — viết lại sau mỗi chuyển bước và đọc lại sau mỗi lần nén ngữ cảnh; không file ghi chú nào bên
cạnh được công nhận. `scripts/validate-session.mjs` kiểm cả sổ sau mỗi chuyển bước.

Trong một nhiệm vụ, mỗi nhánh gọi tên mục tiêu của nó trước khi chạy: `request.json.goal` trỏ về đúng
một dòng `state.json.mission.doneWhen` mà `producedBy` là operator của nhánh, hoặc khai nhánh mà nó là
`prerequisite`, và `scripts/validate-request.mjs#branchGoalErrors` từ chối nhánh không trỏ về đâu.
Biên nhận trả lời mục tiêu ấy: nhánh done phục vụ một dòng "xong khi" mang `response.json.goalCheck`
— `achieved`, và những file đã khai của response là `evidence` — và
`scripts/validate-response.mjs#goalCheckErrors` chỉ chấp nhận khi mọi đường dẫn bằng chứng là một
output biên nhận đã khai và có trên đĩa, với ít nhất một cái đứng sau `achieved: true`. Chỉ goalCheck
đã qua validator mới vào `brief.proven`, dưới dạng `doneWhen:<n> …`; ba nhánh done liên tiếp không
thêm bằng chứng cho dòng "xong khi" nào thì chuỗi dừng và hỏi người, không bao giờ điều phối nhánh
thứ tư (`scripts/validate-session.mjs`). Sau mỗi chuyển bước orchestrator in vào chat gốc đúng hai
dòng mà `resources/interaction.json#transitionLog` khai — mục tiêu của nhánh, rồi kết quả kèm số dòng
"xong khi" đã có bằng chứng, đường dẫn artifact và ô kế tiếp. Với v2.2 done đã nghiệm thu, chạy thêm
`scripts/render-outcome.mjs <branch>` và hiện Markdown/media **The best outcome** ngay trong chat:
hình render của UI được chọn phải được nhúng thành ảnh, còn operator khác hiện source/diff, sơ đồ,
bảng, tài liệu hoặc kết quả đo dễ xem. `response.json.outcome` và `resources/outcomes.json` xác định
phần cần hiển thị. Chỉ sau bản ghi hai dòng và khối outcome bắt buộc mới ghi `logged: true`; bằng
chứng đầy đủ vẫn ở thư mục session. Attempt lỗi hoặc chưa hoàn tất hiện đúng trạng thái cùng bước
sửa tiếp, không được mang lời khẳng định best outcome đã thành công.

Một luật người nêu bằng lời của họ được nói lại cho họ trước khi thiết kế bất cứ gì trên đó:
`business.decide` và `architecture.decide` viết một `restatement` tối đa năm dòng bằng ngôn ngữ của
người và dừng với `RESTATEMENT_UNCONFIRMED` cho tới khi người chọn `as-stated` hay `corrected` trên
một lựa chọn `restatement-confirm`; cách đọc đã sửa đến dưới dạng yêu cầu đã sửa và cùng nhánh đó
chạy lại. Mỗi lượt orchestrator kết thúc với người là một trong các dạng báo cáo mà
`resources/interaction.json` khai — đã giao, đang chờ anh quyết, đang làm — bằng ngôn ngữ của người;
bàn giao cho phiên anh em là một nhánh `waiting` có điều kiện đánh thức, không bao giờ là kết thúc
lượt.

## Thẩm quyền

File này không cấp gì cả. Mọi ranh giới thẩm quyền đều do các bảng trong `operator.md` và
`validate.mjs` của chính operator thực thi, và file này không nới rộng được:

- `git.publish` không có yêu cầu nào gọi tên được force push, hook bị bỏ qua, reset, clean, stash hay
  xoá nhánh; nó merge nhánh phiên, push không force, và một hunk xung đột mà bộ luật dùng chung không
  phủ là `NON_FAST_FORWARD` cho người xử.
- `release.deploy`, `migration.release`, `runtime.serve` và `uat.verify` đòi `approval`, lấy từ chính khai báo của môi
  trường khi khai báo đó đánh dấu lớp thao tác bị chạm là `declared`, và từ một con người chỉ khi môi
  trường đánh dấu là `person`; `release.deploy` chỉ chạy trên đầu vào `quality-verification`.
- Bản ghi tài khoản của `uat.verify` từ chối trường password, và validator của nó bác mọi chuỗi có
  hình dạng credential trong bất cứ thứ gì nó ghi.
- `interface.generate` và `interface.audit` chỉ được gọi tên những mã rule mà knowledge được bind
  có publish; `interface.generate` và `interface.fix` chỉ ghi class có trong inventory đã resolve.
- Operator ghi source chỉ commit trên `session/<sessionId>`; nhánh của người không bao giờ bị đụng.

Nếu một nhiệm vụ có vẻ cần nhiều hơn mức một operator cho phép, thì đó chính là câu trả lời, không
phải chướng ngại để lách.

## Knowledge

Operator tự bind knowledge của mình; file này không nạp trước.

| Thư mục | Được bind bởi |
| --- | --- |
| `knowledge/ui/composition/` | `interface.plan`, `interface.generate` |
| `knowledge/ui/presentation/` | `interface.generate` |
| `knowledge/ui/proof/` | `interface.audit` |
| `knowledge/patterns/fe/`, `knowledge/patterns/be/` | `interface.generate`, `interface.fix`, `backend.generate` |
| `knowledge/grammars/<họ>/` | mọi operator có dựng họ đó |

File `.md` tiếng Anh là authority duy nhất lúc chạy. File `.vi.md` cùng tên là bản đọc cho người và
không bao giờ vào context manifest, danh sách phụ thuộc, input của validator, hay binding của
operator.

## Điều phối

Một lần gọi một operator là một lần chạy, theo chế độ mà `operator.json` khai dưới `resources.mode`
(`resources/orchestrator.json#modes`): `inline`, orchestrator tự thực hiện các bước của operator ngay
trong chat như một checklist dưới chính validator của operator đó (bind route, chạy gate, công bố);
`dispatch`, một agent mới kế thừa transcript của orchestrator trong số lượt mà `forkTurns` của profile
cho phép, tối đa một agent như vậy cùng lúc (`#concurrency.maxDispatch`); hoặc `isolated`, một agent
mới bắt đầu với ngữ cảnh trống và chỉ thấy `operators/<id>/brief.md` sinh ra, `request.json` của nó
và những file mà `inputs` cùng `contexts` gọi tên, trong worktree và hồ sơ trình duyệt riêng. Agent
dispatch hay isolated chạy trên profile operator gọi tên, với đúng những alias mà bảng Context của nó
khai và những tool mà `operator.json` của nó khai (`@tools/<id>` từ `resources/tools.json`, mỗi tool
một mode), không hơn, và được chờ theo sự kiện hoàn tất, không bao giờ theo đồng hồ. `resources/orchestrator.json` chốt luật: tối đa ba agent
cùng lúc, các nhánh cùng bậc không bao giờ chung alias ghi, điều phối theo chuỗi đã vẽ và `routing.json`,
bàn giao chỉ qua các trường của `response.json` trong phiên (`state.json`,
`step-N/parallel-M/{request,response}`). Publish không xóa session. Chỉ close-success đã compact và
kiểm bundle bền mới xóa đúng folder session tạm; session blocked/failed vẫn resumable. Agent
không bao giờ khởi động agent khác; một cuộc trao đổi lồng (phản biện, review) là một agent mới do
orchestrator tạo cho nhánh đang `waiting`. Mọi file agent ghi dưới `response/` được gate response quét
giá trị hình dạng bí mật (`scripts/sweep-secrets.mjs`) trước khi nhánh được định tuyến. `alias/alias.json` là nơi duy nhất một alias phân giải ra vị
trí, và `alias/INDEX.md` là bản đồ đọc được của nó theo vùng (workspaces, grammar, knowledge, worktrees,
remote, dynamic); operator chỉ đọc những gì bảng Context của nó gọi tên.
