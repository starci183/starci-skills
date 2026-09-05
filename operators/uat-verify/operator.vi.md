# uat.verify

## Việc

Kiểm chứng một luồng sản phẩm từ đầu đến cuối trên sản phẩm đang chạy tại commit đã ghim, rồi phát
một hồ sơ lượt chạy chỉ-thêm với ba làn được xét độc lập, hoặc dừng đúng chỗ không sẵn sàng thay vì
chế ra một phán quyết.

## Xong khi

Xong khi `uat-snapshot` đã đóng băng trước mọi hành động trên sản phẩm, gọi tên commit đã ghim, head
được phục vụ có chứa nó, các case theo thứ tự cùng các khẳng định của chúng, hồ sơ tài khoản chỉ gồm
tên và fingerprint của seed, mọi case đã đóng băng có `uat-capture` và `screenshot` đã che của nó
chụp sau khi redirect đăng nhập đã đến chỉ qua các điều khiển được render, `uat-verdicts` phán quyết
các làn hành vi, trải nghiệm và giao diện trên bằng chứng riêng của mỗi làn với làn trải nghiệm được
chấm theo từng tiêu chí, handoff rollback chính xác của namespace đã được `data.seed` nhận, hồ sơ lượt chạy
chỉ-thêm tồn tại cùng con trỏ và dòng lịch sử của nó, và `uat-flow-verification` liệt kê `sheet`
cùng bảng phán quyết nó đã in cho người xem, mang `audit-scope` nguyên vẹn khi audit được nhận vào
có nó.

## Lượt chạy khởi động theo nhu cầu; thẩm quyền của nó thuộc về môi trường

Chạm tới operator này chính là nhu cầu: một chain đi thẳng vào đây sau khi một bề mặt đã được dựng và
chứng minh, hay một session quyết định một luồng phải được đi qua trước khi tin vào nó, đều là
trường hợp thường lệ mà operator này tồn tại để phục vụ, không phải ngoại lệ cần canh chừng. Thứ giữ
cho một lượt chạy trung thực không phải một cái tên trong trường yêu cầu, mà là dấu vết nó không thể
tránh để lại: thư mục lượt chạy chỉ-thêm (`runs/<runId>/`), con trỏ `latest.json`, dòng
`history.md` và bản tóm tắt chụp-theo-bước được in ra. `runId` và `lease` không phải câu hỏi dành cho
người: orchestrator sinh mã lượt chạy và cấp lease độc quyền trên thư mục luồng trước khi nhánh bắt
đầu, và một lần gọi đến mà thiếu chúng là `INVALID_INPUT` ở bước 1 chứ không phải một lời hỏi. Vì thế
Mặc định của chúng là `—`: một ô Mặc định ghi "mã lượt chạy của orchestrator" là lời văn chứ không
phải một giá trị cổng dùng được, và một cổng chấp nhận lời văn là một cổng chấp nhận ô rỗng.
`LEASE_INVALID` là một thất bại khác và giữ chỗ riêng của nó: đó là cái lease có tồn tại nhưng đã hết
hạn, thuộc về nơi khác, hoặc đang ràng vào một lượt chạy khác, và nó bị phát hiện ở bước 6 trên chính
thư mục luồng mà lượt chạy này đang giữ.

Thứ mà lượt chạy này chạm tới ngoài việc đọc của chính nó — đăng nhập như tài khoản riêng của luồng — được cấp quyền theo đúng cách mọi thao
tác nền tảng trong cài đặt này được cấp: bởi chính khai báo của môi trường, và bởi một con người chỉ
khi khai báo đó nói cần một con người. `.stacks/<env>/environment.json` đánh dấu lớp
`identity-provisioning` là `declared` hay `person` cho `env`, còn
`readiness/initialization/stacks/environment.schema.json` nêu hình dạng, khuôn dạng tham chiếu và
mặc định cho production một lần duy nhất, được đọc từ đó chứ không sao chép lại ở đây. Một môi
trường không phải production mà chưa siết lớp đó thì không cần gì thêm: `approval`
mang tham chiếu của khai báo đó — đường dẫn của nó và hash của nội dung — và lượt chạy tiếp tục mà
không cần một con người trong vòng lặp. Một môi trường đánh dấu lớp đó là `person`, điều
mà production luôn làm, thì cần một approval id thay vào đó, và `approval` không có mặc định: im
lặng không phải là đồng ý, bất kể điều gì đã chạm tới operator này.

## Endpoint là cái đã ràng, không phải cái suy lại

Luồng được lái theo endpoint mà đầu vào `route` mang, chính cái mà nhánh `workspace.bind` của chuỗi
này đã quan sát và đóng lại. Operator này không suy lại sự sẵn sàng từ sổ đăng ký runtime: một sổ
đăng ký báo `ready` trong khi không ai lắng nghe đúng là nguồn đẩy trình duyệt vào một cổng chết, và
bước ràng đã từ chối một cổng chỉ-lắng-nghe thay cho chuỗi này rồi. Khi endpoint đã ràng không trả
lời, mã dừng là `RUNTIME_UNAVAILABLE` trên một endpoint có tên, chứ không phải một phỏng đoán xem
origin nào mới là origin được nhắc tới.

Endpoint đó phục vụ một nhánh tích hợp mang việc của mọi phiên đã xin, nên head nó đang chạy gần như
không bao giờ là commit lượt chạy này kiểm. Vì vậy snapshot đóng băng cả hai: commit đã ghim và head
đang phục vụ, kèm bản ghi phép thử quan hệ tổ tiên giữa chúng. Một head đang phục vụ không chứa commit
đã ghim là trôi, và trôi là một mã dừng chưa lái gì cả — còn một head đang phục vụ có chứa nó cùng với
việc của người khác thì đúng là hình hài của một nhánh tích hợp dùng chung, và không phải phát hiện gì
hết.

## Hai phiên trên một sản phẩm

Luật cô lập được công bố đúng một lần, ở operator sở hữu runtime, và operator này làm việc bên trong
luật đó chứ không chép lại. Ba điều khoản của nó là những thứ chỉ biên bản này mang được, nên snapshot
nêu ra và chúng được kiểm: lượt chạy này thuộc về phiên mà request nêu tên và không ghi thư mục của
phiên nào khác; nó lái profile trình duyệt của riêng mình, vì hai lượt chạy dùng chung một profile là
dùng chung một phiên đăng nhập, rồi lượt này lại chứng minh cho lượt kia; và nó chỉ nhận receipt của
`data.seed` khi mọi định danh cùng rollback set đều nằm dưới namespace của lượt chạy này.

## Prerequisite thiếu được route về đúng owner

Verifier này không draft flow, case sheet hay seed. Flow material thiếu hoặc sai được handoff có kiểu
cho `uat.plan`; seed material thiếu hoặc sai được handoff cho `data.plan` rồi `data.seed`. Tài khoản
thiếu hoặc sai trả `IDENTITY_MISSING` cho `identity.provision`, và attempt mới chỉ bắt đầu sau khi có
bằng chứng đăng nhập thật vào sản phẩm. Provider, file niêm phong hay store không thể kết nối là
`PROVISIONING_UNAVAILABLE`; request không gọi tên flow là `INVALID_INPUT`.

## Thư mục luồng có đúng một hình dạng

`flow.md` nêu mục tiêu, vai, tiền đề, ngân sách theo số bước và số giây, và các bước cùng kết quả mong
đợi, bằng chứng và tiêu chí được chấm, mỗi bước nêu alias nó đóng vai. `accounts.<env>.json` chỉ mang
những cái tên, mỗi alias một tài khoản, theo từng môi trường. `seed/` giữ thứ phải có
trước lượt chạy, nói một lần và đặt lại được. `snapshots/` là bản tham chiếu chuẩn và chỉ đổi khi một
con người duyệt. `runs/<runId>/` là lịch sử chỉ-thêm, `runId` gồm dấu thời gian của lượt chạy và commit
rút gọn nó kiểm, nên hai lượt chạy cùng luồng tại cùng commit vẫn phân biệt được và không lượt nào đè
lượt nào. `latest.json` nêu lượt mới nhất — một file chứa một run id, không bao giờ là symlink — và
`history.md` thêm một dòng cho mỗi lượt. Hình dạng này được thi hành chứ không chỉ được mô tả, vì một
hồ sơ lượt chạy mà không ai đoán được thư mục là một hồ sơ không ai đọc.

## Mật khẩu là một cái tên, không bao giờ là một giá trị

Mọi tài khoản UAT dùng chung một mật khẩu, niêm phong tại `.stacks/<env>/secrets/uat.enc` bằng master
identity dùng chung, còn mỗi luồng giữ username riêng của nó. Operator giải mã thông tin đăng nhập
theo tên qua `@workspaces/device-state` đúng lúc đăng nhập và không lúc nào khác; nó không bao giờ
chép giá trị ấy vào một biến nó ghi ra, một fixture, một câu lệnh nó lưu lại hay một câu nó phát
hành. Mật khẩu không bao giờ nằm ở dạng rõ tại bất kỳ nơi nào operator này ghi: không trong
`response/`, không trong hồ sơ lượt chạy dưới `runs/<runId>/`, không trong log. Ô mật khẩu bị che
trong mọi ảnh chụp, kể cả ảnh chụp trước khi gửi và ảnh chụp sau một lần đăng nhập hỏng, vì một ảnh
chụp là bằng chứng đã phát hành và mật khẩu đã lọt vào ảnh thì đã rời khỏi vòng giữ. Vì thế hồ sơ tài
khoản chỉ mang username, vai trò, tên thông tin đăng nhập và đường dẫn file niêm phong, không mang
thứ gì có thể chứa một bí mật. Bước kiểm tra sơ bộ rằng thông tin đăng nhập giải được (bước 3) là một
lệnh chẩn đoán theo đúng luật mà `identity.provision` đã nêu cho việc của chính nó: nó báo cáo
rằng kho đã trả lời, không bao giờ báo cáo nó trả lời bằng gì, để việc chứng minh sẵn sàng không trở
thành đường thứ hai khiến giá trị rời khỏi vòng giữ.

## Lượt đi thử được viết ra, không bao giờ được lập trình

Dưới `@tools/browsercontrol` chế độ `playwright`, operator viết lượt đi thử và tự mình không thực thi
gì cả: một `uat-walk` gọi tên từng bước bằng vai trò và tên truy cập của điều khiển nó bấm, route vào
đúng một lần ở bước đầu, và thông tin đăng nhập theo tên ở nơi một ô đọc như một bí mật; runner của
cây lái nó trong một ngữ cảnh trình duyệt mới tinh, chép mọi điều khiển từ lượt đi vào bức chụp, dừng
ở bước hỏng đầu tiên và ghi `walk-result` cạnh lượt đi. Một bước mà cây truy cập không gọi tên được
thì không bấm được, và không bước nào gõ địa chỉ sau bước đầu, đó chính là điều giữ cho một lượt đi
không chạm tới sản phẩm ngoài bề mặt của nó. Một biên nhận ghi chế độ này bị giữ đúng chế độ ấy: mọi
bức chụp nêu lượt đi của mình và bước nào của lượt đi sinh ra từng khẳng định, kết quả đứng cạnh lượt
đi ở đúng digest đã chạy, điều khiển của khẳng định bằng đúng target của lượt đi và kết cục của nó
bằng kết cục runner ghi, còn một bức chụp không có lượt đi bên cạnh bị từ chối. Điều runner chưa tới
được là `EVIDENCE_UNAVAILABLE`, không bao giờ là đạt.

## Đóng băng đi trước thực thi

Snapshot được ghi trước mọi hành động lên sản phẩm và không bao giờ sửa lại sau đó. Nó nêu commit, các
case theo thứ tự đã đóng băng cùng những khẳng định có tên, hồ sơ tài khoản, fingerprint của seed và
namespace fixture. Thứ tự ấy biến ba thất bại vô hình thành ba thất bại thấy được: một case chưa từng
được đóng băng không thể xuất hiện trong kết quả, một lượt chạy không thể được giải thích lại sau khi
xong bằng cách sửa điều nó nói là mình kiểm, và một admission không thể bị gán ngược vào một commit nó
chưa từng thấy. Cả hai admission — biên bản `frontend-surface-audit` và biên bản `quality-verification` —
phải nêu đúng commit đã ghim; thiếu một trong hai, hoặc một trong hai lấy ở commit khác, là
`ADMISSION_MISSING`, vì một bề mặt sạch và một cổng xanh ở commit khác chẳng nói gì về sản phẩm mà
lượt chạy này đang lái.

Khi frontend và backend là hai bản bàn giao riêng, bind cả @workspaces/fe và @workspaces/be. snapshot.provenance và verdicts.provenance đóng băng {fe, be} từ đúng hai context; commit và đuôi run-id chỉ frontend. Hai entry admission mang role fe và commit frontend. Request thật của owner phải pin head frontend đó, biên nhận owner phát ra phải nêu đúng head; request quality có thể pin thêm context backend mà admission frontend không biến thành backend. Bảng Snapshot in Frontend commit và Backend commit; result nối thêm lưu cả hai. Nếu route hoặc admission frontend mang head khác backend thì bắt buộc dùng dạng tường minh này, kể cả caller bỏ context frontend. Hồ sơ cũ chỉ có backend vẫn hợp lệ khi không có bằng chứng hai vai trò khác nhau. Không đổi nhãn SHA frontend thành SHA backend.

## Làn trải nghiệm được chấm, không phải được khẳng định

Làn `ux` không phải một câu tả cảm giác về lượt chạy. `UX-1` đến `UX-11` đều được mang vào biên nhận
lượt chạy kèm bước chạy hay ảnh chụp đã đo chúng, một điểm từ 1 tới 5 và một phán quyết, rồi `UX-12`
tính ra làn từ chúng; phần số học sống trong rule ấy và không nhắc lại ở đây. Kết quả là đúng một
hàng mà operator này publish dưới `## Verdict`, tên là `experience`, và không gì phía sau chấm lại nó
— `quality.verify` chép hàng ấy rồi ghép với các topic của audit. Một tiêu chí mà bằng chứng duy nhất
là một ảnh chụp, trong khi chính file ấy giao nó cho một lượt chạy, là `EVIDENCE_UNAVAILABLE` chứ
không phải đạt cũng không phải hỏng, và làn còn dở cho tới khi có lần thử thật.

## Ba làn, xét riêng

Hành vi, UX và UI được xét trên bằng chứng của riêng chúng và không bao giờ mượn kết luận của nhau.
Đúng ba làn được phát hành, mỗi làn có pass hoặc fail riêng và tham chiếu bằng chứng riêng; một làn
không có bằng chứng không phải là fail mà là `EVIDENCE_UNAVAILABLE`, vì tính sự không sẵn sàng thành
lỗi là đổ tội cho một sản phẩm chưa ai quan sát. Lỗi UI trên một node do ứng dụng sở hữu đi về
presentation, lỗi hành vi đi về backend, còn lỗi UX đi về người: không ai giải một câu hỏi về ý đồ
bằng cách chạy lại luồng mạnh tay hơn.

## Namespace sở hữu mọi thứ lượt chạy này ghi ra

Mọi bản ghi seed mà lượt chạy tiêu thụ đều mang `is_uat=true` và namespace `runId`, nên chúng tách
bạch với dữ liệu sản phẩm. Verifier không mutate dữ liệu đó. Nó handoff rollback set chính xác của
receipt cho `data.seed`; operator ấy chỉ xoá namespace đó và trả bằng chứng cleanup. Run record vẫn
chỉ-thêm, và seed không bao giờ được tạo ra chính kết quả cần kiểm.

## Hồ sơ lượt chạy chỉ được thêm

`runs/<runId>/` được ghi một lần, ở cuối, dưới lease độc quyền, rồi `latest` được dời sang trỏ vào nó.
Một thư mục lượt chạy đã tồn tại thì không bao giờ bị ghi đè, bị cắt bớt hay bị "sửa cho đúng": lần
thử thứ hai là một `runId` mới, còn hồ sơ cũ ở lại làm bằng chứng cho điều đã quan sát được lúc ấy.
Lịch sử mà sửa được thì không còn là lịch sử.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| plan, account login thật và seed receipt hợp lệ theo env/namespace/revision | tái dùng prerequisite; mở run/browser profile mới; freeze trước action | snapshot fingerprint plan, actor, seed, FE/BE head, endpoint, case, expected | đi qua product |
| prerequisite thiếu/sai | không browser action và không seed effect | nêu exact UAT, identity, data, runtime hoặc admission delta | typed owner handoff rồi UAT attempt mới |
| walk chạy | ghi actual/evidence mọi assertion kể cả unreached/inconclusive | append attempt dưới runId mới; giữ fail/incomplete | chỉ advance khi mọi required assertion match |
| tìm thấy defect có owner | không sửa owner source, không overwrite run | phân loại owner và case ảnh hưởng | owner sửa; run mới chạy lại case fail và ảnh hưởng |
| cần cleanup | handoff exact rollback set cho `data.seed` | cleanup receipt chỉ chứng minh owned namespace bị xóa | verifier không mutation database |

## Ranh giới ghi

Context là chỉ-đọc, trừ thư mục luồng. Operator ghi snapshot và hồ sơ lượt chạy dưới
`@worktrees/uat/<flow>/<case>` trong khi còn giữ lease độc quyền, và chỉ ghi trong `response/` của
nhánh mình: `data/snapshot.json`, `data/captures/<case>.json`, `data/verdicts.json`, các ảnh chụp và
tấm ghép dưới `response/artifacts/`, `response.md` và `response.json`. Nó không đọc cũng không ghi mật
khẩu dưới dạng giá trị, không nhờ người đăng nhập hay đưa thông tin đăng nhập, không sửa sản phẩm cho
một case đậu, không sửa snapshot đã đóng băng sau khi bắt đầu chạy, không ghi đè hay xoá một hồ sơ
lượt chạy, không tạo seed hay cleanup effect, và không làm điều gì xảy ra
ngoài qua control mà mỗi capture nêu tên: một lượt đi chỉ là bằng chứng cho cái nó đã nhấn, nên một
bước chạm tới sản phẩm bằng cách khác — một endpoint, một mutation, một lệnh console thay cho control
đã render (`UX-1` Case 2) — không phải là một bước của lượt đi, và một tiêu chí được chấm từ đó là
`EVIDENCE_UNAVAILABLE`, không bao giờ là một pass.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/uat/<flow>/<case>` | thư mục luồng ở đúng một hình dạng: `flow.md`, `accounts.<env>.json`, `seed/`, `snapshots/` đã duyệt, lịch sử chỉ-thêm `runs/<runId>/`, con trỏ `latest.json` và `history.md`, bind theo fingerprint từng file và chỉ ghi khi giữ lease độc quyền | có |
| `@worktrees/_templates` | hợp đồng hình dạng thư mục UAT, chỉ dùng để validate flow đã plan; việc tạo canonical thuộc `uat.plan` và `data.plan`; tiêu thụ, không sửa | có |
| `@worktrees/sessions/central-runtime` | generation của chủ runtime đứng sau endpoint đã ràng; sự sẵn sàng do đầu vào `route` chứng minh, không bao giờ suy lại từ sổ đăng ký này | có |
| `@workspaces/device-state` | sổ thông tin đăng nhập niêm phong; mật khẩu UAT dùng chung được giải theo tên ở đây lúc đăng nhập và không đọc ở đâu khác | có |
| `@workspaces/be` | checkout backend được route tại commit đã ghim, nơi luồng kiểm hành vi và nơi store giữ các bản ghi có namespace | có |
| `@workspaces/fe` | head frontend khi bề mặt trình duyệt và backend tách biệt; bắt buộc khi route hoặc admission nêu head frontend khác | không |
| `@knowledge/ui/proof` | topic UX: các tiêu chí làn trải nghiệm chấm và rule biến chúng thành phán quyết của làn | có |
| `@worktrees/unchecked/<product>` | phần chưa kiểm của feature này ở làn walk: những flow mà các nhiệm vụ trước để lại chưa đi, và cái nào trong số đó lần chạy này kiểm | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `frontend-surface-audit` | lượt soi bề mặt kết luận frontend sạch, lấy tại commit đã ghim | có |
| `quality-verification` | cổng chất lượng đã xanh, lấy tại đúng commit đã ghim ấy | có |
| `route` | `workspace.bind` ở vai fe; route đã ràng mà lượt chạy này lái theo endpoint của nó | có |
| `uat-account` | `identity.provision`; mọi actor alias, provider account, observation role/membership và proof login product thật cho environment này | có |
| `units` | `uat.plan`; danh sách luồng mà nhánh này đi đúng một luồng, gọi tên bằng `request.unit` | không |
| `uat-plan` | `uat.plan`; flow entry, budget, actor alias và namespace | có |
| `uat-case-sheet` | `uat.plan`; bảng máy đọc bất biến có actor, precondition, action, assertion, expected và fixture ref | có |
| `seed-receipt` | `data.seed`; những dòng luồng này đi trên đó, quy được về namespace của nó, kèm rollback | có |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `approval` | id | — | Thẩm quyền cho đăng nhập bằng tài khoản của flow: approval id, hoặc tham chiếu khai báo môi trường — path và hash nội dung — khi `identity-provisioning` là `declared` cho `env`; không có mặc định vì im lặng không phải đồng ý |
| `feature` | id | — | Khoá feature dùng để địa chỉ hoá thư mục luồng |
| `flow` | id | — | Luồng sản phẩm duy nhất mà lần gọi này kiểm chứng |
| `env` | id | dev | Stack mà lượt chạy này lái: nó chọn file tài khoản, bí mật niêm phong, entry trong sổ đăng ký runtime, đích của seed và bản tham chiếu đã duyệt |
| `cases` | list `caseId` | every case of the flow | Chạy những case đã đóng băng nào; mặc định là mọi case `flow.md` khai, theo đúng thứ tự của nó |
| `runId` | id | — | Không hỏi người: orchestrator điền nó, và nó namespace mọi bản ghi lượt chạy này ghi ra |
| `lease` | token | — | Không hỏi người: orchestrator điền nó, cấp lease độc quyền trên thư mục luồng trước khi nhánh bắt đầu |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate, lần chạy lại, lease độc quyền và thẩm quyền của lượt chạy | `approval`, `lease`, `resume` | `request/request.json`, @worktrees/uat/<flow>/<case> để lấy `latest` và hồ sơ lượt chạy trước, @workspaces/be tại commit đã ghim, khai báo của môi trường khi `approval` tham chiếu tới nó, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT` |
| 2 | Xác nhận admission bề mặt sạch và chất lượng xanh tại head frontend, giữ riêng head backend | — | đầu vào `frontend-surface-audit`, đầu vào `quality-verification` | — | `ADMISSION_MISSING` |
| 3 | Validate runtime, real product login proof và `seed-receipt` theo exact environment, actor alias, namespace, FE/BE revision; handoff prerequisite thiếu/sai cho owner trước browser action | `env` | @workspaces/device-state để lấy thông tin đăng nhập mà `accounts.<env>.json` nêu tên, @worktrees/sessions/central-runtime để lấy entry của route đã bind, generation và các origin, đầu vào `uat-account` khi danh tính đã được cấp, @tools/secrets, @tools/http | — | `PROVISIONING_UNAVAILABLE`, `IDENTITY_MISSING` |
| 4 | Đóng băng machine case sheet đã plan, account ref, seed receipt, endpoint, revision và expected assertion; verifier không draft canonical flow data hay đổi expected | `feature`, `flow`, `env`, `cases` | @worktrees/uat/<flow>/<case>, @worktrees/_templates để lấy khuôn luồng | @worktrees/uat/<flow>/<case> (snapshot), `response/data/snapshot.json`, @tools/sourcewrite | `CANONICAL_WRITE_DENIED` |
| 5 | Xác minh seed receipt read-only theo run namespace và planned precondition; không tạo seed hay cleanup effect trong operator này | `runId` | đầu vào `seed-receipt`, `response/data/snapshot.json`, @workspaces/be | — | `FIXTURE_VIOLATION` |
| 6 | Viết lượt đi thử cho các case đã đóng băng theo thứ tự: một vai trò và một tên cho mỗi điều khiển, route vào đúng một lần ở bước 1, thông tin đăng nhập theo tên ở nơi một ô đọc như một bí mật, một bức chụp mỗi case sau khi chuyển hướng đăng nhập đã hạ | — | `response/data/snapshot.json`, đầu vào `route` để lấy endpoint lượt chạy này lái theo, @worktrees/uat/<flow>/<case> để lấy các bước `flow.md` khai | `uat-walk` | `LEASE_INVALID` |
| 7 | Chạy lượt đi qua runner của cây dưới @tools/browsercontrol chế độ `playwright` — một ngữ cảnh trình duyệt mới tinh tại endpoint mà route đã ràng mang, tại commit đã ghim, thông tin đăng nhập phân giải theo tên ngay lúc điền và che trong mọi khung hình — hoặc lái các case đã đóng băng qua trình duyệt dưới chế độ `required` khi không viết lượt đi nào | — | `uat-walk`, đầu vào `route` để lấy endpoint lượt chạy này lái theo, @worktrees/sessions/central-runtime để lấy generation đứng sau endpoint đó, @workspaces/device-state để lấy thông tin đăng nhập chỉ lúc đăng nhập, @tools/browsercontrol, @tools/secrets, @tools/websearch | `walk-result`, `response/data/captures/<case>.json`, `response/artifacts/<case>.png` | `RUNTIME_UNAVAILABLE` |
| 8 | Ghi actual và evidence cho mọi assertion, kể cả unreached và inconclusive, và stitch sheet mà không biến thiếu evidence thành pass | — | `response/data/snapshot.json`, `walk-result`, @worktrees/sessions/central-runtime để lấy bằng chứng runtime trực tiếp nhất | `response/data/captures/<case>.json`, `response/artifacts/<case>.png`, `response/artifacts/sheet.png`, @tools/visualize, @tools/print | `EVIDENCE_UNAVAILABLE` |
| 9 | Xét ba làn tách rời nhau, và chấm làn trải nghiệm theo từng tiêu chí | — | @knowledge/ui/proof (topic UX và rule đóng của nó), `response/data/captures/<case>.json` | `response/data/verdicts.json` | — |
| 10 | Chuẩn bị exact cleanup handoff từ rollback set của seed receipt cho `data.seed`; không mutation database ở đây | `runId` | đầu vào `seed-receipt`, `response/data/verdicts.json` | — | — |
| 11 | Append mọi attempt completed, failed hoặc incomplete dưới `runId` mới, update latest pointer tới immutable result đó, thêm history và emit | `runId` | mọi thứ ở trên | @worktrees/uat/<flow>/<case> (runs/<runId>/, latest.json và history.md), `response/response.md`, `response/response.json`, `audit-scope`, `findings`, @tools/sourcewrite, @tools/print | — |

Một phán quyết không ai được cho xem là một phán quyết không ai đọc. Bậc 8 in bản tóm tắt các ảnh
chụp theo bước và bậc 11 in bảng `## Verdict` qua `@tools/print`, thẳng vào cuộc trò chuyện mà người
đang đọc, còn biên nhận liệt kê cả hai dưới `## Printed` kèm lý do in; ô đăng
nhập vẫn được che trong mọi khung được in, đúng như trong mọi khung được ghi.

Một block trước action có thể chỉ phát blocked attempt receipt. Sau khi snapshot đã freeze hoặc bất
kỳ browser action nào bắt đầu, attempt được append với trạng thái incomplete, failed hay complete và
evidence đã thật sự quan sát; không được bỏ nó. Resume bắt đầu lại từ validation, chỉ tái dùng quan sát
có fingerprint không đổi; resume không thêm admission, lease, evidence hay case change là
`NO_PROGRESS`. Mỗi retry dùng `runId` mới.


Khi đầu vào audit có phạm vi, chạy `node scripts/audit-scope.mjs <branch>` để chép nguyên
`verdicts.auditScope` vào `response/data/audit-scope.json` và liệt kê kind `audit-scope` trong
response. Biên nhận có `## Audit scope` với bảng `Field | Value` ghi Mode, Coverage claim và
Deferred states đúng nguyên bản. Kết quả chỉ có nghĩa trong phạm vi ấy; state deferred không trở
thành đạt vì gate hoặc UAT đạt. Các gate chất lượng và các case UAT đã đóng băng giữ nguyên.
Snapshot đóng băng cũng chép nguyên phạm vi vào `auditScope` trước khi bắt đầu chạy.

Đầu ra `findings` không phải của lượt chạy này để ghi. Khi biên nhận được chấp nhận, orchestrator ghi
thêm mọi làn, tiêu chí, khẳng định và hàng `## Findings` bị hỏng vào sổ cái findings và vật chất hoá
các dòng đang mở của sổ cái cho luồng này cạnh biên nhận, theo luật và script mà
[mục lục findings](../../knowledge/findings/INDEX.vi.md) nêu; gate phiên từ chối một lượt chạy đã
xong mà sổ cái không giữ các lần hỏng của nó.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `uat-flow-verification` | `response/response.md` | md | có |
| `uat-snapshot` | `response/data/snapshot.json` | data | có |
| `uat-capture` | `response/data/captures/<case>.json` | data | có |
| `uat-verdicts` | `response/data/verdicts.json` | data | có |
| `audit-scope` | `response/data/audit-scope.json` | data | không |
| `findings` | `response/data/findings.json` | data | không |
| `uat-walk` | `response/data/walks/<walk>/walk.json` | data | không |
| `walk-result` | `response/data/walks/<walk>/walk-result.json` | data | không |
| `screenshot` | `response/artifacts/<case>.png` | artifact | có |
| `sheet` | `response/artifacts/sheet.png` | artifact | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `ADMISSION_MISSING` | terminate |
| `PROVISIONING_UNAVAILABLE` | terminate |
| `IDENTITY_MISSING` | terminate |
| `LEASE_INVALID` | terminate |
| `RUNTIME_UNAVAILABLE` | terminate |
| `EVIDENCE_UNAVAILABLE` | terminate |
| `FIXTURE_VIOLATION` | terminate |
| `CANONICAL_WRITE_DENIED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| cả ba làn đều pass | `git.publish` |
| cả ba làn đều pass và lời hứa phải được đối chiếu với hành trình thực sự đã đi | `business.reconcile` |
| lượt đi đã pass và một checkout khác của nhiệm vụ vẫn còn chờ gate của nó | `quality.verify` |
| làn UI fail trên một node do ứng dụng sở hữu | `interface.generate` |
| làn hành vi fail | `backend.generate` |
| luồng chưa có tài khoản riêng, nên danh tính được cấp trước khi lượt chạy đi tiếp | `identity.provision` |
| flow hoặc machine case sheet thiếu hay sai | `uat.plan` |
| seed plan hoặc seed receipt thiếu hay sai | `data.plan` |
| cần tạo seed receipt hợp lệ hoặc rollback exact namespace sau attempt đã action, dù complete, failed hay incomplete | `data.seed` |
| làn UX fail: người quyết định trải nghiệm phải thế nào, và luồng chỉ được kiểm lại sau quyết định ấy | `user` |
| lượt chạy sinh ra bản tham chiếu đầu tiên của luồng, nên một con người nâng bản ứng viên trước khi nó thành chuẩn | `user` |
