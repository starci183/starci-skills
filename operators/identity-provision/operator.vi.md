# identity.provision

## Việc

Cấp danh tính mà một luồng đăng nhập bằng: tạo tài khoản của từng alias tại nhà cung cấp danh tính mà
entry sổ đăng ký của route đã bind khai, đặt mật khẩu của nó từ thông tin xác thực niêm phong được phân
giải theo tên, chứng minh tài khoản đăng nhập được, và công bố hồ sơ chỉ gồm tên mà thư mục luồng
giữ; hoặc xoay custody quản trị mà chính nhà cung cấp ấy đứng trên.

## Xong khi

Xong khi tài khoản của luồng tồn tại tại provider đã khai và đăng nhập được bằng thông tin xác thực
niêm phong được phân giải theo tên, `checks` chứng minh bộ proof danh tính không thiếu hay thất bại
phép kiểm nào, `uat-account` chỉ mang tên và được ghi vào thư mục luồng cạnh tài liệu luồng đã phác,
và `delta` ghi từng tài khoản đã tạo theo entry của route; hoặc, dưới `identityRotation`, `delta`
chứng minh thông tin xác thực mới dùng được và cái cũ thất bại, và không hồ sơ tài khoản nào được
công bố.

## Hồ sơ thiếu thì tạo ra, không phải báo lỗi

Cấp phát là nhánh mặc định, không phải ngoại lệ. Một luồng chưa có thư mục, chưa có tài liệu luồng và
chưa có tài khoản là một luồng chưa ai chạy, và operator này tạo cả ba: tài liệu luồng được phác từ
khuôn đi kèm cây và được đánh dấu là bản nháp trong biên bản, tài khoản được tạo tại provider mà
entry khai, mật khẩu của nó đặt từ thông tin đăng nhập niêm phong dùng chung giải theo tên. Báo bất
kỳ điều nào ở trên như một lỗi là sai, và dừng ở "phải có người tạo tài khoản" cũng là đúng cái sai
đó với một câu lịch sự hơn. Chỉ hai thứ thực sự không phải để operator này bịa ra, và chúng là hai mã
dừng duy nhất trên lối này: một entry không khai danh tính nào cả là `INVALID_INPUT` nêu tên trường
còn thiếu, và một provider hay file niêm phong không tới được là `PROVISIONING_UNAVAILABLE`. Seed cũng
không phải của operator này: nó do operator sở hữu dữ liệu đặt, theo tài khoản mà operator này đã
tạo.

## Thông tin đăng nhập là một cái tên, và nó đi vào một form hay một body

Trước khi resolve giá trị, áp dụng [preflight danh tính](../../resources/identity.vi.md) cho thao tác
đã chọn qua helper tiêu thụ cố định của nó.

Mỗi môi trường niêm phong đúng một mật khẩu và tài khoản của mọi luồng được đặt từ nó, còn mỗi luồng sở
hữu username riêng. Nó được giải theo tên đúng lúc gọi, và giá trị của nó chỉ được phép tới đúng hai
chỗ: body của lời gọi quản trị tới provider, và ô của một form đăng ký trong trình duyệt đang được điều
khiển. Nó không bao giờ vào một file, một fixture, một lệnh được ghi lại, một ảnh chụp hay một biên bản.
Vì thế hồ sơ tài khoản operator này công bố mang username, vai trò, tên thông tin đăng nhập, đường dẫn
file niêm phong và entry nó thuộc về, và không có chỗ nào để đặt một bí mật kể cả do sơ ý.

Một lệnh chẩn đoán không phải là chỗ thứ ba. Một lệnh chạy chỉ để chứng minh rằng một giá trị niêm
phong giải được báo cáo kết quả của việc giải — rằng nó đã giải được, tên nó giải theo, và độ dài hay
digest khi cần thêm gì đó để phân biệt lần giải này với lần khác — chứ không bao giờ báo cáo giá trị.
Giá trị vẫn chỉ đi từ kho của nó tới đúng form hay body tiêu thụ nó, không có gì ở giữa hiển thị nó ra:
không một biến trung gian nào mà lệnh in, trả về hay echo cho một người hay một transcript đọc được.
Một lệnh chẩn đoán không thể viết theo cách đó, vì cách chứng minh duy nhất nó biết là in ra chính giá
trị, thì không được chạy; operator báo cáo điều mình không kiểm được thay vì kiểm nó theo cách mất an
toàn.

## Credential được phân giải, không bao giờ được ghi lại

Một capability là một handle cùng bằng chứng custody của nó. Credential đứng sau nó được phân giải để
dùng đúng lúc gọi và không bao giờ được log, vọng vào evidence hay lưu lại. Biên bản từ chối cả cái
handle chứ không riêng giá trị, vì biên bản là thứ bền, và một bản ghi bền của một capability là một
credential rò rỉ có độ trễ; một chuỗi mang vật liệu credential ở bất cứ đâu trong request hay
response đều bị từ chối như dữ liệu sai dạng.

## Xoay credential quản trị được ràng, được stage và được chứng minh

Xoay credential quản trị dùng capability identity hiện có và cần mã phê duyệt rõ ràng. Chứng minh
custody của đúng provider qua credential mount hoặc môi trường bootstrap đã thu trước khi tiêu thụ giá
trị. Binding `identityRotation` ghi đúng provider, realm, tên credential, fingerprint principal và toàn
bộ file custody được phép ghi; `stagingRefs` cho phép riêng các file staging ciphertext được bảo vệ.
Thao tác chạy riêng, không tạo tài khoản UAT và không cần flow. Delta lặp lại binding và chứng minh
credential mới dùng được, credential cũ bị từ chối, session của đúng quản trị viên đã bị thu hồi và
các bản custody khớp nhau. Vẫn phải đạt đầy đủ bộ check identity. Chỉ stage ciphertext, ghi nhật ký
riêng từng tác động lên provider và file, giữ vật liệu phục hồi mã hóa đến khi chứng minh nhất quán;
provider và nhiều file không phải một giao dịch atomic. Helper tiêu thụ phải tự kiểm tra request đã
đóng băng và quyền platform trước tác động.

## Trạng thái mong muốn là một khai báo đã duyệt

`desiredState` là toàn bộ những gì bên gọi xin: hash của kế hoạch đã duyệt, kiểu dịch vụ (ở đây luôn là
`identity`), entry cần tác động, các effect cần áp — `provision-identity`, hoặc riêng
`rotate-admin-credential` — và hai tập phạm vi nói resource nào được đổi và resource nào chỉ được quan
sát. `approval` phủ lên đúng khai báo đó, kèm cả hash, nên một field sửa sau đó không còn khớp cái
hash mà phê duyệt đã gọi tên. Thẩm quyền đứng sau `approval` đến từ đâu là chuyện của môi trường, theo
từng lớp thao tác, trong hình dạng mà schema môi trường
(`readiness/initialization/stacks/environment.schema.json`) đưa ra: `approval` nhận một id phê duyệt
hoặc tham chiếu tới bản khai báo — đường dẫn cùng hash nội dung — khi bản khai báo đánh dấu việc cấp
danh tính là `declared` cho `env`, và một hash đã đổi giữa lúc viết request và lúc chạy là
`AUTHORITY_DRIFT`. Xoay credential không thuộc lớp khai báo nào và luôn cần một id phê duyệt.
`approval` không có mặc định: một danh tính mà các luồng khác dùng chung không bao giờ bị đổi trên sự
im lặng.

## Ranh giới ghi

Context chỉ đọc, trừ phần delta đã duyệt. Operator tạo tài khoản tại provider mà entry sổ đăng ký khai,
ghi thư mục luồng của luồng nó cấp cho — hồ sơ tài khoản và tài liệu luồng đã phác — và chỉ ghi
`response/` của nhánh mình: `data/delta.json`, `data/checks.json`, `data/account.json`, `response.md`
và `response.json`. Dưới `identityRotation` nó còn stage ciphertext vào đúng các ref custody và
staging mà binding nêu tên. Nó không seed dữ liệu, không phục vụ runtime, không khởi động hay dừng
tiến trình, không ghi entry runtime; không ghi giá trị credential, handle capability hay token dạng bí
mật ở bất kỳ đâu trong đầu ra, trong hồ sơ tài khoản hay trong thư mục luồng; không nhờ người đăng
nhập, tạo tài khoản hay dán credential; không sửa knowledge, không viết bản khai báo của một môi
trường, hay bằng cách nào khác tự cấp phê duyệt cho mình; và không tuyên bố đã cấp xong khi còn một
check bắt buộc vắng mặt hay hỏng.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/sessions/central-runtime` | entry của route đã bind: nhà cung cấp danh tính và realm nó khai, đọc theo fingerprint và generation | có |
| `@workspaces/device-state` | thông tin xác thực niêm phong theo tên và custody của nó; giá trị không bao giờ xuất hiện | có |
| `@worktrees/uat/<flow>` | thư mục luồng mà operator này ghi: hồ sơ tài khoản và tài liệu luồng đã phác | không |
| `@worktrees/_templates` | khuôn luồng dùng để phác một tài liệu luồng còn thiếu, chỉ tiêu thụ chứ không sửa | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `environment-readiness` | `environment.preflight`; các phép kiểm custody và provider đã được trả lời một lần, đọc như bằng chứng chứ không bao giờ như phê duyệt | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `routeKey` | id | — | Entry `<project>/<role>` mà nhà cung cấp danh tính nó khai là nơi tài khoản được tạo |
| `flow` | id | null | Luồng có danh tính riêng được cấp, và có thư mục nhận hồ sơ tài khoản cùng tài liệu đã phác; bắt buộc trừ khi `identityRotation` được ràng |
| `env` | id | dev | Stack mà các tài khoản được cấp thuộc về; tài khoản của stack này không phải tài khoản của stack khác |
| `approval` | id | — | Thẩm quyền phủ lên trạng thái mong muốn này: một id phê duyệt, hoặc tham chiếu tới bản khai báo môi trường — đường dẫn cùng hash nội dung — khi bản khai báo đó đánh dấu việc cấp danh tính là `declared` cho `env`; không có mặc định, vì im lặng không phải đồng thuận |
| `desiredState` | `{planSha256, serviceKind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs}` | — | Khai báo đã duyệt: kế hoạch nào, kiểu `identity`, entry nó tác động, các effect — cấp phát, hoặc riêng xoay credential — và cái gì được đổi so với cái gì chỉ được quan sát |
| `identityRotation` | `{provider, realm, credentialName, principalFingerprint, custodyRefs, stagingRefs}` | null | Chỉ bắt buộc khi xoay credential quản trị; đúng principal và bộ file custody được ghi |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm cổng vào và resume theo generation đã đóng băng | `resume` | `request/request.json`, @worktrees/sessions/central-runtime tại generation đã đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng thẩm quyền — một id phê duyệt, hoặc bản khai báo của môi trường được đọc lại và băm lại — và chạy preflight danh tính `scripts/identity-custody.mjs` qua @tools/shell, chứng minh custody theo tên chứ không bao giờ theo giá trị | `approval`, `env` | @workspaces/device-state cho tên và custody của thông tin xác thực niêm phong, bản khai báo của môi trường khi `approval` tham chiếu tới nó, @tools/secrets | — | `AUTHORITY_DRIFT`, `PROVISIONING_UNAVAILABLE` |
| 3 | Đọc khai báo danh tính của entry và thư mục luồng, và phác tài liệu luồng từ khuôn khi nó còn thiếu | `routeKey`, `flow` | @worktrees/sessions/central-runtime cho provider và realm mà entry khai, @worktrees/uat/<flow> cho hồ sơ và tài liệu hiện có, @worktrees/_templates cho khuôn luồng | @worktrees/uat/<flow>, @tools/sourcewrite | `INVALID_INPUT` |
| 4 | Tạo tài khoản của từng alias tại provider với thông tin xác thực niêm phong được phân giải theo tên vào body của request, hoặc xoay custody quản trị dưới principal đã ràng và stage ciphertext của nó | `desiredState`, `identityRotation` | @worktrees/uat/<flow> cho các alias mà tài liệu luồng nêu, @workspaces/device-state cho thông tin xác thực theo tên, @tools/secrets, @tools/http | `response/data/delta.json` | `PROVISIONING_UNAVAILABLE` |
| 5 | Chứng minh bộ proof danh tính: provider tới được, thông tin xác thực giải được, từng tài khoản tồn tại và đăng nhập được qua @tools/browsercontrol hay endpoint token, và không thông tin xác thực nào được ghi ở bất cứ chỗ nào đã viết | — | @worktrees/sessions/central-runtime cho provider, @tools/http, @tools/browsercontrol | `response/data/checks.json` | `IDENTITY_UNPROVEN` |
| 6 | Ghi hồ sơ tài khoản chỉ gồm tên vào thư mục luồng và công bố nó | `flow`, `env` | `response/data/delta.json` cho các tài khoản đã tạo | @worktrees/uat/<flow>, `response/data/account.json` | — |
| 7 | Viết biên bản và phát | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | — |

Một lần resume bắt đầu lại từ cổng vào, chỉ dùng lại quan sát có fingerprint không đổi, và tiêu thụ
đúng phần delta; một lần resume không thêm thẩm quyền, provider hay trạng thái mong muốn nào là
`NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `platform-operation-receipt` | `response/response.md` | md | có |
| `delta` | `response/data/delta.json` | data | có |
| `checks` | `response/data/checks.json` | data | có |
| `uat-account` | `response/data/account.json` | data | không |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `PROVISIONING_UNAVAILABLE` | terminate |
| `IDENTITY_UNPROVEN` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| checkout đã route hay head của nó không còn khớp ràng buộc đã đóng băng | `workspace.bind` |
| danh tính của luồng đã được cấp và seed của nó phải được đặt theo tài khoản ấy | `data.seed` |
| danh tính của luồng đã được cấp và bề mặt từng đòi nó có thể được quan sát | `interface.audit` |
| danh tính của luồng đã được cấp và lượt chạy đang chờ nó có thể kiểm luồng | `uat.verify` |
