# frontend.direction.decide

## Việc

Quyết một hướng frontend có bằng chứng, đủ để triển khai, cho đúng một target được uỷ quyền, rồi
chứng minh nó bằng lời hứa nghiệp vụ, Grammar đã publish, hiện trạng quan sát được và một lượt phản
chứng mà không phương án nào qua được bằng khẩu vị.

## Change level quyết định phải bind những gì

Change level là thẩm quyền của chính lời yêu cầu, và source hiện tại không bao giờ chứng minh được
nó: một lượt audit đòi bề mặt phải pass là `reconstruct`, không phải `refine`. `new` cần lời hứa
nghiệp vụ, và nó đóng tập trạng thái cùng các lối ra trước khi vẽ bất cứ thứ gì. `reconstruct` chỉ
cần lời hứa khi tập trạng thái đổi, và nó giữ nguyên các sự thật nghiệp vụ, thẩm quyền hành vi và
ngữ nghĩa API mà nó thừa hưởng. `refine` không cần thẩm quyền đầu vào nào cả, vì nó không đổi thứ gì
mà một lời hứa có thể phản bác. Backend implementation là bắt buộc khi một contract dữ liệu đổi,
architecture decision khi một ranh giới đổi; ngoài ra không bắt buộc, và không bao giờ được bịa ra.
`create` đi cùng `new` và chỉ đi cùng nó.

## Bằng chứng phản bác, chứ không uỷ quyền

Hiện trạng implementation, một test xanh, DOM đã render và một lần UAT pass trước đều là bằng chứng,
và mỗi quan sát được ghi lại thành một path kèm head lúc đọc. Bằng chứng phải được quan sát trước khi
viết bất kỳ đề xuất nào: lấy các artifact trực tiếp của target mà bỏ lý lẽ của người tạo ra chúng,
hoặc, với target mới, chứng minh target chưa tồn tại rồi chỉ quan sát host được uỷ quyền và context
cùng họ sản phẩm. Không mảnh nào trong số đó uỷ quyền cho một hướng chỉ vì nó đang chạy sẵn. Một
trang đang tồn tại không phải lý do để dựng lại đúng trang ấy.

## Nghiên cứu có giới hạn, và chỉ ở chỗ còn nợ

Tham chiếu ngoài chỉ được đi tìm khi người dùng không cấp cái nào và change level là `new` hay
`reconstruct`. Một lượt `refine` làm việc bằng idiom của họ là đủ. Mỗi tham chiếu còn lại được ghi
kèm URL và đúng giới hạn nó mang theo; không gì chép lại một trang, một thương hiệu, một bảng màu hay
giải phẫu của một component. Khi nghiên cứu có giới hạn không lấp được câu hỏi nghiệp vụ hay tương
tác mà quyết định dựa vào, lần chạy dừng ở đúng khoảng trống có chủ.

## Tham chiếu được gọi tên theo lớp, không theo tính từ

`## References` là chỗ hướng nói rõ bề mặt này nhắm tới chuẩn nào, và gọi tên nó đúng cách một người
đọc sẽ phân loại: một lớp như `console-grid` hay `plan-comparison`, không bao giờ là một tính từ như
hiện đại, sạch sẽ hay cao cấp, vì tính từ không đem so với một bức chụp được. Mỗi dòng còn ghi thứ
được mượn — một quyết định bố cục, một thứ tự, một mật độ — và chính nó giữ cho việc mượn được lương
thiện, vì không gì chép lại một thương hiệu, một bảng màu hay giải phẫu của một component. Một hướng
`new` hay `reconstruct` mang ít nhất một dòng như thế; một lượt `refine` không mang dòng nào, vì cấu
trúc mà nó dịch chuyển các phần tử bên trong đã được duyệt từ trước. Đây là thứ lần audit về sau đọc:
lens thẩm mỹ đặt bức chụp cạnh các chuẩn đã nêu, và một hướng không nêu chuẩn nào làm lens ấy chết
trước khi có một pixel nào được đo. Một lần chạy tới được quyết định mà không có dòng tham chiếu nào
thì không phải lỗi của người gọi và không bao giờ thành `INVALID_INPUT`: đó là lỗi của chính operator
này, nên nó dừng bằng `REFERENCE_MISSING`, định tuyến về `self` và được trả lời bằng cách nêu tên các
chuẩn rồi chạy lại chính hướng ấy.

## Bộ lọc Grammar từ chối sự bịa đặt, không từ chối quyền sở hữu

Một phương án bịa ra giao diện dùng chung còn thiếu, đi vòng qua trần owner, bắt chước Grammar chưa
publish ngay tại chỗ hay chỏi một composition đã publish thì bị loại. `GRAMMAR_REQUIRED` chỉ dành cho
một component của họ còn thiếu, và nó đi tới một con người để publish; operator không bao giờ ghép
tạm một cái thay thế từ các mảnh. Một node mà ứng dụng sở hữu hợp lệ, chẳng hạn một canvas, không
phải khoảng trống Grammar và không bao giờ làm phát mã ấy.

## Phương án bị phản chứng trước khi được chọn

Phản chứng tấn công vào tính phù hợp với nghiệp vụ và backend, thứ bậc, mật độ nội dung, phản hồi
hành động, đường phục hồi, dòng chảy responsive, sức chịu nội dung, bàn phím và focus, khả năng tiếp
cận, tính nhất quán của họ, khả năng đảo ngược và rò rỉ quyền sở hữu, và mỗi đòn tấn công đều rơi vào
biên nhận kèm phán quyết của nó. Một hướng còn vô hiệu chừng nào còn một mâu thuẫn nghiệp vụ áp dụng
được, một rò rỉ owner, một Grammar tự chế, một lỗi responsive, một lỗi tiếp cận, một trạng thái bất
lợi chưa giải quyết hay một phương án đảo ngược mạnh hơn về bản chất. Dưới `refine`, các phương án là
những nước đi ở cấp phần tử bên trong cấu trúc đã duyệt, không bao giờ là một cấu trúc mới. Khi
phương án duy nhất chết dưới một đòn tấn công, lần chạy dừng với `NO_VIABLE_DIRECTION`; khi nhiều
phương án cùng sống, `DIRECTION_CHOICE_REQUIRED` chọn cái sống sót qua nhiều đòn nhất, trừ khi người
dùng giữ quyền chọn.

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: biên nhận quyết định, bản liệt kê
coverage, các trang phương án đã render và `response.json`. Nó không sửa source sản phẩm hay source
thẩm quyền, không bịa hành vi nghiệp vụ, backend, kiến trúc, xác thực, lưu trữ hay dữ liệu, không
publish Grammar dùng chung, không khởi động hay cấu hình lại dịch vụ runtime, và không tuyên bố rằng
implementation, cổng chất lượng thị giác hay một lượt UAT đã qua.

## Hình là thứ operator tự xét, không chờ yêu cầu

Một tấm hình là quyết định composition như mọi quyết định khác: khi một ứng viên để lại vùng đọc lên
thấy trống (hero không có chủ thể, empty state chỉ có một câu, hàng card mà chữ không gánh nổi chiều
rộng), operator thêm hình làm theo đúng một claim của hướng và ghi lý do vào bảng `## Images`. Nó
không chờ người nói, và cũng không trang trí: vùng mà chữ và Grammar object đã gánh được thì không
thêm hình, và hình không bao giờ mã hoá claim mà lời hứa nghiệp vụ không hề nêu. Asset và prompt nằm
dưới `response/artifacts/images/`; `frontend.source.apply` ghi chúng cùng write set đã khai.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@grammar/core` | Grammar đã publish như app đang bind resolve ra; các composition mà một hướng được phép ràng | có |
| `@knowledge/ui/composition` | các khẳng định mà biên nhận phát ra phải thoả, `COVERAGE-1` là khẳng định về toàn bộ biên nhận | có |
| `@workspaces/fe` | checkout frontend được route, đọc ở head đóng băng; hiện trạng là bằng chứng, không bao giờ là hướng được yêu cầu | có |
| `@knowledge/grammars/starci` | họ Core được kỳ vọng hiện thực hoá Common ra sao; luật về Grammar, không phải chính Grammar | không |
| `@worktrees/uat/<flow>/<case>` | quan sát hành vi, UX và UI của lần trước kèm ảnh chụp; bằng chứng và phản chứng, một lần pass cũ không phải thẩm quyền hiện tại | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `business-promise-authority` | `business.decide`; bắt buộc với `new`, và với `reconstruct` khi tập trạng thái đổi | không |
| `backend-source-application` | `backend.source.apply`; bắt buộc khi một contract dữ liệu đổi | không |
| `architecture-decision` | `architecture.decide`; bắt buộc khi một ranh giới đổi | không |
| `frontend-direction-decision` | một lần chạy `frontend.direction.decide` trước trên cùng target, đọc khi chạy lại | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `target` | id | — | Đúng một route, page, layout, modal, drawer, flow, block hay component mà hướng này nhắm tới |
| `intent` | choice | modify | create, modify, audit-repair hay reconcile; `create` đi cùng change level `new` và chỉ đi cùng nó |
| `changeLevel` | choice | — | new, reconstruct hay refine; một lượt audit phải kết thúc bằng bề mặt pass là reconstruct |
| `ownerCeiling` | choice | surface-and-nested-layouts | surface-only, surface-and-nested-layouts hay ancestor-layouts-authorized |
| `candidates` | number 1–3 | 1 | Hình thành bao nhiêu hướng; nhiều hơn một chỉ khi muốn so sánh |
| `preview` | choice | no | yes thì render phương án duy nhất thành một trang xem được |
| `references` | list | [] | Tham chiếu ngoài do người dùng cấp; nghiên cứu có giới hạn chỉ chạy khi ô này rỗng |
| `selectionPolicy` | choice | automatic | `automatic`: operator chọn và ghi lý do; `approval-required`: người chọn |
| `approval` | id | null | Id phương án được duyệt; chỉ bắt buộc dưới `approval-required`, nhập khi chạy lại sau `DIRECTION_CHOICE_REQUIRED` |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume`, `approval` | `request/request.json`, đầu vào `frontend-direction-decision` khi chạy lại, @workspaces/fe ở head đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Soát lời yêu cầu: route, scope, change level, trần owner | `target`, `intent`, `changeLevel`, `ownerCeiling` | @workspaces/fe ở head đóng băng, @tools/git | — | `ROUTE_UNVERIFIED`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID` |
| 3 | Bind các đầu vào mà change level đòi | `changeLevel` | đầu vào `business-promise-authority`, `backend-source-application` và `architecture-decision` | — | `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED` |
| 4 | Quan sát context đang có | — | @workspaces/fe (artifact trực tiếp của target, hoặc host được uỷ quyền và họ sản phẩm khi target chưa tồn tại), @worktrees/uat/<flow>/<case> nếu có | — | `EVIDENCE_MISSING` |
| 5 | Biên một UI contract và coverage của nó | — | @knowledge/ui/composition, đầu vào `business-promise-authority` nếu có, context đã quan sát | `response/data/coverage.json` | `SCOPE_UNFROZEN` |
| 6 | Chốt các chuẩn tham chiếu theo lớp, có giới hạn | `references`, `changeLevel` | @knowledge/ui/composition (khoảng trống mà nghiên cứu phải lấp), @tools/websearch | — | `REFERENCE_EVIDENCE_EXHAUSTED`, `REFERENCE_MISSING` |
| 7 | Hình thành các phương án | `candidates` | UI contract vừa biên | — | `NO_VIABLE_DIRECTION` |
| 8 | Áp bộ lọc Grammar | `ownerCeiling` | @grammar/core (component sở hữu gì và có prop nào), @knowledge/grammars/starci | — | `GRAMMAR_REQUIRED` |
| 9 | Render bằng chứng quyết định và hình đã tự xét, rồi phục vụ cho một người xem | `candidates`, `preview` | các phương án còn sống, @knowledge/grammars/starci | `response/artifacts/<candidateId>.html`, `response/artifacts/images/<slot>.png`, `response/artifacts/host.json`, @tools/visualize, @tools/imagegen, @tools/host | — |
| 10 | Phản chứng | — | các phương án, đầu vào `business-promise-authority` và `backend-source-application`, `response/data/coverage.json` | — | `NO_VIABLE_DIRECTION` |
| 11 | Quyết | `selectionPolicy`, `approval` | bảng phản chứng | — | `DIRECTION_CHOICE_REQUIRED` |
| 12 | Phát | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | — |

Bước 6 để lại trong biên nhận các chuẩn mà bề mặt này nhắm tới, mỗi chuẩn gọi tên theo lớp, kèm thứ
được mượn và thứ nó không giải quyết. Dưới `new` và `reconstruct` bảng ấy có ít nhất một dòng và bước
6 dừng bằng `REFERENCE_MISSING` khi không sinh nổi một dòng nào; dưới `refine` nó để trống. Bước 9
render trước khi bước 11 ghi quyết định, vì một cấu trúc chưa ai nhìn thấy thì không thể duyệt,
và một phương án chỉ được tả bằng văn xuôi thì không ai phán được. Dưới `new` và `reconstruct`, mọi
phương án mà lượt chạy hình thành đều được render thành trang riêng, bất kể `preview` nói gì và bất kể
có bao nhiêu phương án: đó là `@tools/visualize`, không cần cấp quyền, và mọi runtime đều làm được.

Trang phương án không phải file để người ta tự đi tìm. Bậc 9 phục vụ thư mục artifacts qua
`@tools/host` trên loopback, ở cổng trống đầu tiên từ 60000 lên tới 60100, và ghi URL, cổng, thư mục
cùng pid vào `response/artifacts/host.json`; server dừng khi nhánh kết thúc hoặc được resume. Mỗi
phương án được phục vụ một lần cho mỗi viewport của coverage — mỗi viewport một trang, hoặc một trang
nhận viewport qua query string — để người xem thấy bản rộng và bản hẹp trước khi quyết, và đó là chỗ
thứ nhất trong hai chỗ tính đáp ứng được nhìn.
Dưới `refine` trang vẫn là tuỳ chọn — cấu trúc đã được duyệt từ trước lượt chạy này — và chỉ render
khi có nhiều hơn một phương án được hình thành hoặc `preview` là yes; một phương án refine duy nhất
dưới mặc định không sinh trang nào và dựa vào bước 10. Dưới `automatic`,
`DIRECTION_CHOICE_REQUIRED` chọn phương án sống sót qua nhiều đòn tấn công nhất và ghi lại bảng; dưới
`approval-required` nó dừng và người dùng quay lại với `approval`. Biên nhận uỷ quyền cho domain kế
tiếp resolve và triển khai bên trong trần owner đã đóng băng, và không chứng minh gì về việc kết quả
render ra sao.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `frontend-direction-decision` | `response/response.md` | md | có |
| `ui-coverage` | `response/data/coverage.json` | data | có |
| `candidates` | `response/artifacts/<candidateId>.html` | artifact | không |
| `direction-image` | `response/artifacts/images/<slot>.png` | artifact | không |
| `host` | `response/artifacts/host.json` | artifact | không |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `ROUTE_UNVERIFIED` | terminate |
| `SOURCE_DRIFT` | terminate |
| `SCOPE_UNFROZEN` | terminate |
| `CHANGE_LEVEL_AMBIGUOUS` | terminate |
| `OWNER_CEILING_INVALID` | terminate |
| `BUSINESS_REQUIRED` | terminate |
| `BACKEND_REQUIRED` | terminate |
| `ARCHITECTURE_REQUIRED` | terminate |
| `GRAMMAR_REQUIRED` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `REFERENCE_EVIDENCE_EXHAUSTED` | terminate |
| `REFERENCE_MISSING` | terminate |
| `NO_VIABLE_DIRECTION` | terminate |
| `DIRECTION_CHOICE_REQUIRED` | fallback |
| `NO_PROGRESS` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| hướng đã quyết; mọi hướng đều resolve giá trị trình bày trước khi ghi source | `frontend.presentation.resolve` |
| một component của họ mà hướng cần chưa được publish, nên một người publish nó rồi chính hướng ấy chạy lại | `frontend.direction.decide` |
