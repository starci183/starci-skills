# business.reconcile

## Việc

Đối chiếu một lời hứa nghiệp vụ đã publish, theo từng chiều của ma trận phủ đã đóng băng, với source
thực sự đã được giao, rồi publish lại head cùng phần đối chiếu nó mang, hoặc dừng ở sai lệch đầu
tiên còn đứng.

## Xong khi

Xong khi `business-reconciliation` mang đúng một hàng cho mỗi chiều của ma trận phủ đã đóng băng với
bằng chứng đã giao mà mỗi hàng tựa vào và không còn sai lệch nào, `claims` ràng mọi fact đã giao vào
head source đóng băng, và `model` publish lại chính head ấy dưới lease độc quyền cùng phần đối chiếu
đã làm và chuyển trạng thái hợp lệ nó đã đi, được lưu trữ theo địa chỉ nội dung của nó và được chỉ
mục head gọi tên cùng trạng thái nó đang mang.

## Đối chiếu đọc source đã giao, không bao giờ đọc kế hoạch

Ở đây không mô hình hoá gì. Head đã được quyết và ma trận phủ của nó đã được `business.decide` đóng
băng; operator này lấy ma trận đúng như đang có và hỏi, với từng hàng, liệu source mà một lượt
backend đã giao có thực thi điều hàng ấy hứa không. Vì thế Đầu vào `backend-source-application` là
bắt buộc, vì một cuộc đối chiếu không có source đã giao chỉ là ý kiến về đoạn code chưa ai đọc, và
`implemented` không bao giờ được publish dựa trên một kế hoạch: nó được publish ở đây, sau khi đối
chiếu, hoặc không bao giờ. Một feature chưa có head publish thì không có gì để đối chiếu, và một head
mà trạng thái không cho phép chuyển sang đích thì không thể đi; cả hai đều là
`HEAD_NOT_RECONCILABLE`, giao cho người quyết lời hứa, không bao giờ bịa ra ở đây.

## Sai lệch thì dừng, không bao giờ lấy trung bình

Mỗi hàng của ma trận kết thúc ở một trong hai trạng thái: bằng chứng đã giao thực thi nó, được dẫn
bởi một fact claim ràng vào head source đóng băng, hoặc không, và sai lệch được ghi theo chiều đó
bằng lời của người. Một sai lệch còn đứng dừng nhánh bằng `RECONCILIATION_DISCREPANCY` và không
publish head nào, vì một head publish lại trên một khoảng trống đã biết là một lời hứa đúng ở chỗ
chào bán và sai ở chỗ guard. Một ví dụ, một ảnh chụp hay ý định của người chủ chỉ minh hoạ lời hứa;
chỉ một fact quan sát được trong source đã giao mới chứng minh nó được thực thi, và một claim dẫn
nguồn không ai ràng là `EVIDENCE_MISSING`.

## Một gốc thẩm quyền phẳng

Một feature sở hữu đúng một thư mục head, `<gốc businesses>/features/<featureId>`, mà `model.json`
trong đó là head, và head publish lại được ghi dưới lease độc quyền trên alias ấy. `features/` là
đoạn duy nhất giữa gốc và một feature, nên mọi head không đúng `features/<featureId>` đều bị từ
chối. Chuyển trạng thái hợp lệ so với trạng thái head được tìm thấy, head trước được nêu tên chứ
không xoá, và fingerprint phủ đi nguyên vẹn, để quality và UAT chứng minh được rằng chúng tiêu thụ
đúng ma trận ấy chứ không phải một bản diễn giải.

## Publish một head là ba lần ghi, hoặc không lần nào

Một head chỉ ghi vào thư mục feature của nó là một head không người đọc nào khác tìm thấy: chỉ mục
của gốc businesses vẫn gọi tên cái head nó vừa thay, và mọi thứ ràng một lời hứa theo địa chỉ nội
dung vẫn tiếp tục đọc lời hứa đã bị thay. Vì thế publish head là việc của chính operator này chứ
không phải việc người làm sau, và nó là một tập ghi duy nhất: thư mục feature, model chuẩn hoá được
lưu trữ trong kho nội dung theo địa chỉ của chính nó, và mục của feature trong chỉ mục head gọi tên
địa chỉ ấy cùng trạng thái head đang mang, head gốc giữ nguyên, head vừa bị thay, các head source đã
giao mà claim ràng vào, và địa chỉ của claims cùng ma trận đã đóng băng. Một chỉ mục gọi tên một head
source mà không fact claim nào ràng là đặt lời hứa lên bằng chứng chưa ai đọc, và bị từ chối y như
một object thiếu.

Một head mang hai con số và không bao giờ được thay con này bằng con kia. **Địa chỉ** của nó — thứ
kho lưu trữ đặt tên file theo và thứ chỉ mục gọi tên — là tài liệu đúng như đang có, kể cả trường
fingerprint của chính nó, và đó là lý do một object đã lưu trữ băm ra đúng tên của mình.
**Fingerprint** của nó là tài liệu sau khi bỏ trường ấy, và đó là thứ một receipt dùng để đối chiếu
một ma trận hay một tập claim. Đọc con này khi cần con kia thì publish một head dưới một cái tên kho
lưu trữ không hề giữ.

`previousHeadRef` gọi tên object đã lưu trữ của head nó vừa thay, không bao giờ là một file session:
session bị xoá thì một lineage trỏ vào đó thôi không phân giải được nữa, nên lineage là một chuỗi
object. Khi head bị thay chưa từng được lưu trữ, operator này lưu trữ nó trước, từ thư mục feature
đúng như đang đứng, và bảng `## Lineage` của receipt nói rõ đã xảy ra trường hợp nào trong hai.

## Head đã đối chiếu được đối chiếu lại khi bản giao dời đi

Một head đã công bố `implemented` ràng các fact claim của nó vào một source head. Khi source đã giao dời
đi sau đó — một lần sửa dưới cổng đỏ, một lần kiểm lại ở commit mới — lời hứa được so lại ở head mới và,
khi không còn sai lệch nào, được công bố lại `implemented` qua transition `implemented->implemented`: cùng
trạng thái, ràng buộc mới, vì một head đã công bố mà trích một commit các cổng chưa từng pass là một lời hứa
đặt trên bằng chứng sai. Chỉ operator này đi transition ấy; một quyết định đổi lời hứa vẫn đổi trạng thái.

## Một lời hứa chỉ được chứng minh xa đúng bằng mức đã được đo

Một bản giao được so với lời hứa của nó, và chuyện đã có ai nhìn tới đâu trong bản giao ấy cũng là một
phần của phép so đó. Bảng `## Unchecked` chép phần chưa kiểm còn mở của feature vào receipt, để người đọc một
lần đối chiếu thấy được giới hạn của bản giao ngay cạnh các claim của nó, thay vì phải suy ra từ một
lượt chạy mà họ không có mặt. Một mục tier `secondary` là một đơn vị mà hành trình của nhiệm vụ
chưa từng bước vào và không cản đường `implemented`. Một mục tier `journey` là một state của một
bề mặt mà chính hành trình đi qua nhưng không làn nào đo: lời hứa mới được mang đi xa đúng bằng mức nó
đã được mang, không hơn, và đó chính là điều `in-progress` vốn đã có nghĩa, nên head được công bố lại ở
trạng thái ấy chứ không được tuyên bố là đã thực thi. Không có gì mới được bịa ra để nói điều đó; vòng
đời đã sẵn có từ ấy.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| promise và delivery khớp | tái dùng content; update lifecycle/lineage được phép | so mọi dimension và evidence | publish reconciled head |
| promise thiếu hoặc sai | không sửa ở đây | ghi trọn tập thiếu/sai | handoff `business.decide` |
| delivery lệch | ghi mọi mismatch | mỗi row nêu promise, actual, evidence | handoff `backend.generate`; retry trên head mới |
| evidence thiếu | không publish claim implemented | comparison inconclusive và unchecked coverage | phát typed replan/repair evidence |

## Ranh giới

Context chỉ đọc, trừ đúng một head nó publish. Operator chỉ ghi `response/` của nhánh mình —
`response.md`, `response/data/claims.json`, `response/data/model.json` và `response.json` — cùng
head ấy dưới `@worktrees/businesses`, gồm ba chỗ và không chỗ nào khác: thư mục feature
`features/<featureId>`, các object mà lần publish lưu trữ dưới `objects/sha256/<địa chỉ>.json`, và
mục của feature trong chỉ mục head `business-registry-v1.json`. Nó không bao giờ mô hình hoá một lời
hứa, đóng băng hay sửa ma trận phủ, nói lại lời hứa, nâng một ví dụ hay ý định thành sự thật sản
phẩm, publish head khi còn sai lệch, để một head đã publish mà không lưu trữ hay không được chỉ mục
gọi tên, viết đè mục của feature khác hay một object đã lưu trữ, đẩy head qua một chuyển trạng thái
vòng đời không cho phép, sửa source sản phẩm, hay tuyên bố rằng một cổng chất lượng hay một lượt UAT
đã qua.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/businesses/<featureId>` | head đã publish, trạng thái và ma trận phủ đã đóng băng của nó, theo địa chỉ nội dung từ chỉ mục head; nơi duy nhất operator này ghi ngoài nhánh của mình, gồm thư mục feature, các object đã lưu trữ và mục chỉ mục của feature đi cùng nhau | có |
| `@workspaces/be` | checkout backend được route, đọc ở head đã đóng băng; mọi fact claim dẫn nó theo path, khoảng dòng và head | có |
| `@worktrees/unchecked/<product>` | phần chưa kiểm còn mở của feature: những đơn vị và state mà chính lần kiểm chứng của bản giao đã không lấy, được liệt kê trong receipt cạnh các claim | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `backend-source-application` | `backend.generate`; source đã giao mà cuộc đối chiếu đọc | có |
| `quality-verification` | `quality.verify`; các gate đã đạt trên head đã giao, chỉ đọc như bằng chứng | không |
| `uat-flow-verification` | `uat.verify`; hành trình đã đi trên head đã giao, chỉ đọc như bằng chứng | không |
| `api-verification` | `api.verify`; bộ kiểm end-to-end chạy như một client đối với head đã giao, chỉ đọc như bằng chứng | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `featureId` | id | — | Một feature duy nhất có lời hứa đã publish được đối chiếu |
| `targetState` | choice | — | `implemented` khi source đã giao thực thi mọi hàng, hay `in-progress` khi head được publish lại với những gì đã giao tới lúc này |
| `approval` | id | null | Phê duyệt của chủ mà chuyển trạng thái cần, nhập khi chạy lại sau `APPROVAL_REQUIRED` |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate, đầu vào source đã giao và resume | `resume` | `request/request.json`, đầu vào `backend-source-application`, @workspaces/be ở head đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Kiểm promise và phân loại reusable, missing hoặc invalid trước transition check; handoff promise thiếu/sai cho business.decide và không tạo ở đây | `featureId`, `targetState`, `approval` | @worktrees/businesses/<featureId>: head hiện tại, trạng thái, ma trận và các fingerprint của nó | — | `HEAD_NOT_RECONCILABLE`, `APPROVAL_REQUIRED` |
| 3 | Chuẩn hoá source đã giao thành fact claim, mỗi claim kèm path, khoảng dòng và head | — | đầu vào `backend-source-application`, @workspaces/be ở head đóng băng, đầu vào `quality-verification` và `uat-flow-verification` chỉ như bằng chứng, @tools/git | `response/data/claims.json` | `EVIDENCE_MISSING` |
| 4 | Đối chiếu mọi matrix row với delivery, ghi toàn bộ discrepancy và unchecked, và phát typed repair hoặc replan evidence mà không viết lại goal | — | `response/data/claims.json`, @worktrees/businesses/<featureId> cho ma trận ở head đã publish, @worktrees/unchecked/<product> cho thứ lần kiểm chứng của bản giao đã không lấy | `response/response.md` | `RECONCILIATION_DISCREPANCY` |
| 5 | Publish head dưới lease độc quyền cùng phần đối chiếu nó đang mang: thư mục feature, object nó được lưu trữ dưới, và mục gọi tên nó | — | `response/data/claims.json`, @worktrees/businesses/<featureId> ở head trước, object đã lưu trữ của nó và mục chỉ mục head gọi tên nó | @worktrees/businesses/<featureId> thành model.json head mới, object của nó trong kho nội dung và mục của feature trong chỉ mục head, `response/data/model.json`, @tools/sourcewrite | `SOURCE_DRIFT` |
| 6 | Phát | — | mọi thứ ở trên | `response/response.json` | — |

Chạy lại thì bắt đầu lại từ bước 1, chỉ dùng lại quan sát có fingerprint không đổi, và đọc lại
source đã giao; một lần chạy lại không thêm thay đổi đã giao, phê duyệt hay bằng chứng nào là
`NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `business-reconciliation` | `response/response.md` | md | có |
| `claims` | `response/data/claims.json` | data | có |
| `model` | `response/data/model.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `HEAD_NOT_RECONCILABLE` | terminate |
| `APPROVAL_REQUIRED` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `RECONCILIATION_DISCREPANCY` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| head đã được đối chiếu với source đã giao và bản giao có thể được publish | `git.publish` |
| còn một sai lệch và source đã giao phải được sửa | `backend.generate` |
| chính lời hứa phải được quyết lại trước khi đối chiếu được | `business.decide` |
