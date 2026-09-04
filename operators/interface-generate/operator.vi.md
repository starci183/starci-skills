# interface.generate

## Việc

Sinh một bề mặt frontend mù, từ Grammar, lời hứa, source trước đó và tham chiếu của người: render
và in các phương án, quyết một hướng, resolve mọi giá trị do ứng dụng sở hữu về một luật đã publish,
rồi ghi cây trong một commit.

## Xong khi

Xong khi, dưới mode apply, `frontend-source-application` cùng `changes` của nó ghi nhận đúng một
commit trên nhánh phiên mà `writes` mang mọi đường dẫn đã khai với cả hai hash và chỉ những giá trị mà
`inventory` đóng băng cạnh `frontend-presentation-resolution` và `resolved-tree` công bố, với lượt
quét sạch và cây đã commit bằng cây đã resolve, cây ấy hiện thực hướng mà `frontend-direction-decision`
đã chọn trên các `candidates` phục vụ qua `host`, được in, bị phản chứng và được chấm điểm, với lớp
bề mặt trong `ui-coverage`; hoặc, dưới mode dry, y như vậy với commit null và checkout không bị đụng
tới; hoặc, khi hướng đã khai delta trình bày là none, owner map rỗng, không chọn luật nào và một
inventory rỗng.

## Một agent, một trang

Direction, resolution và application từng là ba operator chuyền biên nhận cho nhau, và các chỗ chuyền
tay chính là nơi việc khựng lại: một resolution không nói được rằng thay đổi không nợ giá trị trình
bày nào, một lần apply đọc một inventory đã cũ, một hướng chưa ai render. Operator này là ba việc ấy
trong một agent mù: nó chỉ thấy các alias mà bảng Context nêu và các file mà request nêu, hình thành
hướng, resolve giá trị và ghi cây, rồi để lại ba biên nhận cạnh nhau để audit, cổng chất lượng và
lượt đi UAT vẫn giữ nguyên đầu vào chúng vẫn có. Mọi luật bên dưới vẫn áp dụng ở đúng bước từng sở
hữu nó; điều thay đổi là cùng một agent bị ràng bởi tất cả cùng lúc, và không thể tự chuyền cho mình
một giá trị bịa.

## Change level quyết định phải bind những gì

Change level là thẩm quyền của chính lời yêu cầu, và source hiện tại không bao giờ chứng minh được
nó: một lượt audit đòi bề mặt phải pass là `reconstruct`, không phải `refine`. `new` cần lời hứa
nghiệp vụ, và nó đóng tập trạng thái cùng các lối ra trước khi vẽ bất cứ thứ gì. `reconstruct` chỉ
cần lời hứa khi tập trạng thái đổi, và nó giữ nguyên các sự thật nghiệp vụ, thẩm quyền hành vi và
ngữ nghĩa API mà nó thừa hưởng. `refine` không cần thẩm quyền đầu vào nào cả, vì nó không đổi thứ gì
mà một lời hứa có thể phản bác. Backend implementation là bắt buộc khi một contract dữ liệu đổi,
architecture decision khi một ranh giới đổi; ngoài ra không bắt buộc, và không bao giờ được bịa ra.
`create` đi cùng `new` và chỉ đi cùng nó.

Quyết định cũng khai delta trình bày của nó, ở dòng `Presentation delta` trong `## Decision`:
`app-owned` khi ít nhất một thuộc tính trình bày do ứng dụng sở hữu thay đổi và lượt resolve theo sau
nợ một luật cho nó, `none` khi thay đổi chỉ là chữ, hành vi hay binding và lượt resolve không nợ gì.
Một hướng không mang dòng ấy được đọc là `app-owned`. Khai `none` chính là thứ cho phép một lượt dịch
hay một lần sửa hành vi tới được lần ghi mà không phải bịa một dòng trình bày để thoả contract; hướng
khai `none` rồi lại đổi class thì bị lượt resolve từ chối, chứ không được tha.

## Bằng chứng phản bác, chứ không uỷ quyền

Hiện trạng implementation, một test xanh, DOM đã render, một lần UAT pass trước và tham chiếu của
chính người — một ảnh chụp, một mô tả — đều là bằng chứng, và mỗi quan sát được ghi lại thành một
path kèm head lúc đọc, hoặc đúng là tham chiếu đã đưa. Bằng chứng phải được quan sát trước khi viết
bất kỳ đề xuất nào: lấy các artifact trực tiếp của target mà bỏ lý lẽ của người tạo ra chúng, hoặc,
với target mới, chứng minh target chưa tồn tại rồi chỉ quan sát host được uỷ quyền và context cùng họ
sản phẩm. Không mảnh nào trong số đó uỷ quyền cho một hướng chỉ vì nó đang chạy sẵn. Một trang đang
tồn tại không phải lý do để dựng lại đúng trang ấy, và một ảnh chụp người đưa là chuẩn để nhắm tới,
không bao giờ là trang để chép.

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
phương án cùng sống, chúng được chấm điểm và xếp hạng, và `DIRECTION_CHOICE_REQUIRED` chỉ được nêu
lên theo chính sách chọn và [chính sách tương tác](../../resources/interaction.md).

## Xếp hạng bằng chứng và giữ lựa chọn của người dùng

Các tier hoặc hướng khác nhau về bản chất dùng `approval-required`; so sánh nội bộ bên trong hướng
đã chọn dùng `automatic`. Điểm số hỗ trợ đề xuất, không thay lựa chọn của người dùng giữa các hướng.
Khi có nhiều hơn một phương án được render, bước 7 chấm từng phương án đã render ở từng viewport nó
đã được in theo các tiêu chí của `@knowledge/ui/proof` mà một bản render tĩnh trả lời được — trọn lens
thẩm mỹ, chấm theo cách `TASTE-13` Case 1 chấm, và mọi tiêu chí trải nghiệm mà luật của nó gọi bức
chụp là công cụ đo — rồi ghi từng điểm dưới `## Scores`, cạnh các phương án đã in. Một điểm là một
tuyên bố về phương án được chấm, và một tuyên bố mâu thuẫn với phương án đó là một lỗi của quyết
định, không phải chuyện xét đoán: khi mô tả của chính một phương án khai, dưới `## Candidate limits`,
rằng nó không thoả một tiêu chí, cặp đó bị từ chối ở đầu đạt bất cứ nơi nào `## Scores` mang nó, và
một giới hạn đã khai mà không có dòng khớp nào trong `## Scores` cũng bị từ chối, vì một giới hạn
không ai chấm thì chẳng ràng buộc gì. Một phương án là trội khi điểm trung bình của nó cao nhất và ở
cùng viewport nó không thấp hơn bất kỳ phương án nào khác trên mọi tiêu chí mà bất kỳ phương án nào đã
rớt trong lần chấm ấy. Phương án trội được chọn dưới `automatic`; khi không có phương án trội,
fallback tự phá thế hoà và ghi lại. Dưới `approval-required`, lần chạy dừng với
`DIRECTION_CHOICE_REQUIRED` tới khi người dùng chọn, kể cả khi một phương án có điểm cao hơn.
Quyết định trên nhiều phương án đã render vẫn phải có đủ điểm và giới hạn đã khai.

## Hình là thứ operator tự xét, không chờ yêu cầu

Một tấm hình là quyết định composition như mọi quyết định khác: khi một ứng viên để lại vùng đọc lên
thấy trống (hero không có chủ thể, empty state chỉ có một câu, hàng card mà chữ không gánh nổi chiều
rộng), operator thêm hình làm theo đúng một claim của hướng (`@tools/imagegen`) và ghi lý do vào
bảng `## Images`. Nó không chờ người nói, và cũng không trang trí: vùng mà chữ và Grammar object đã
gánh được thì không thêm hình, và hình không bao giờ mã hoá claim mà lời hứa nghiệp vụ không hề nêu.
Asset và prompt nằm dưới `response/artifacts/images/`, và bước 11 ghi chúng cùng write set đã khai.

## Cấu trúc quyết trước, giá trị quyết sau

Cấu trúc, thứ tự phần tử, việc chọn component Grammar, chữ, dữ liệu và hành vi do hướng quyết, và
trần owner cũng vậy: lượt resolve làm việc bên trong những gì bước 7 đã quyết và không khai lại thứ
gì. Resolve chỉ trả lời, cho từng node ứng dụng sở hữu, mỗi thuộc tính trình bày nhận giá trị nào và
luật nào uỷ quyền cho giá trị ấy; nó không đổi gì về thứ cây render ra. `Presentation delta` của hướng
nói ở đây có nợ gì hay không: dưới `app-owned` biên nhận resolution resolve ít nhất một thuộc tính do
ứng dụng sở hữu; dưới `none` nó mang owner map rỗng, không chọn luật nào và inventory rỗng, vì thay
đổi chỉ chữ, hành vi hay binding không nợ giá trị trình bày nào, và một giá trị bịa ra để lấp bảng
chính là thứ bịa đặt mà operator này tồn tại để từ chối.

## Không có luật bịa

Một luật chỉ tồn tại khi topic kiến thức được bind publish đúng identifier của nó, và kho luật ấy
đóng băng suốt lần chạy. Một identifier phát ra mà không có trong kho là `UNKNOWN_RULE`. Một class
chỏi với identifier của nó bị từ chối: số hiệu luật là số thứ tự trên thang giá trị, nên `GAP-5`
render ra `gap-6` và `PADDING-5` render ra `p-6`, và viết số thứ tự thành bước thang chính là lỗi mà
phép kiểm này sinh ra để bắt. Khi không case nào đã publish khớp điều kiện quan sát được, lần chạy
dừng với `RULE_MISSING` gọi tên đúng node đó; nó không chọn giá trị gần, không làm tròn về bước gần
nhất, không chép của node bên cạnh. Operator không bao giờ sửa knowledge: case còn thiếu được trả về
cho chủ knowledge, và bề mặt được sinh lại sau khi case được publish.

## Grammar đọc ở bản đã publish, và được hỏi trước

Các quan hệ đã sở hữu lấy từ chính lời khai data-contract của gói đã publish, không bao giờ lấy từ
source của Grammar. Một thuộc tính mà component đã sở hữu sẽ resolve về component ấy, không phát class
ứng dụng nào, và gọi tên luật mà component thoả; thứ tự đó làm việc hiện thực lại thành bất khả thi
chứ không chỉ là điều bị khuyên can. Một class ứng dụng hiện thực lại quan hệ đã có chủ, đè lên giải
phẫu Grammar hay nằm ngoài thang đóng sẽ bị bỏ kèm một dòng ghi của chính nó, theo từng node và không
bao giờ im lặng.

## Phạm vi là mọi thư mục write set chạm tới

Cây mà hướng đặt tên là bề mặt, không phải ranh giới. Một trang đi tới diện mạo cuối cùng của nó qua
những leaf và branch nó compose, nên một leaf sơn lại một control, hay một branch dựng lại dải của một
shell, cũng đổi đúng bề mặt ấy như trang và được resolve trong cùng một lượt. Vì vậy phạm vi là mọi
thư mục leaf và branch do ứng dụng sở hữu mà write set đã khai chạm tới, chứ không chỉ cây của riêng
bề mặt đích. Một thư mục write set không chạm thì nằm ngoài phạm vi, vì resolve nó là nới rộng một
thay đổi không ai yêu cầu; một thư mục write set có chạm thì nằm trong phạm vi kể cả khi hướng chưa
từng gọi tên nó, vì đằng nào cũng là một trang đã resolve ngồi trên một leaf chưa resolve.

## className của một đối tượng Grammar không bao giờ là đích resolve

Có đúng một thứ operator này không được resolve, dù cây trình bày nó thế nào: một `className` trên một
đối tượng Grammar. Trình bày không được thêm padding, typography hay paint bên trong một đối tượng
Grammar, nên class ấy không phải một thuộc tính đang chờ giá trị — nó là một cú thò qua phần anatomy
mà family sở hữu. Nó bị gỡ ở bước 9 và ghi dưới `## Removed`, với `overrides Grammar anatomy` khi nó
sơn lại anatomy, hoặc với `refused by <RULE> Case <n>` gọi tên đúng case đã trả lời không. Khi quan hệ
mà class ấy với tới là có thật mà component không publish prop nào cho nó, lần gỡ đi kèm một dòng
`## Gaps` và câu hỏi về tay chủ family. Điều không bao giờ xảy ra là chọn một rule cho nó: chọn một
giá trị là hợp thức hoá cú thò và trao cho node hai chủ cho một thuộc tính.

## Class bị cấm thì gỡ, không phải thiếu rule

Khi case duy nhất gọi tên một class của ứng dụng nêu điều kiện mà node không thoả, thuộc tính đó
không thiếu rule: rule đã trả lời, và câu trả lời là không. Class bị gỡ ở bước gỡ bỏ, thuộc tính rơi
về giá trị node kế thừa, và việc gỡ được ghi kèm case đã từ chối nó. `RULE_MISSING` chỉ dành cho thuộc
tính không case nào đã publish nhắc tới.

## Thiếu đường công khai là một khoảng trống, không phải một lần dừng

Khi Common không mở đường công khai nào cho một quan hệ mà ứng dụng cần một cách chính đáng, node giữ
lại class ứng dụng của nó và biên nhận ghi một dòng vào `## Gaps` gọi tên node, thuộc tính và đường
còn thiếu. Nhánh không dừng: một cách chữa cháy có ghi sổ thì chủ họ và lượt audit sau đều thấy, còn
dừng ở đây chỉ đổi một giá trị im lặng lấy một chuỗi bị chặn.

## Contract là lời khai, không phải phán quyết

Mọi node do ứng dụng sở hữu đều công bố các identifier nó khai. `data-contract` ghi lại node khai
thoả những luật nào và không bao giờ khẳng định node đó pass; lời khai tồn tại để một lượt audit sau
có thể phản bác, và một luật vẫn chọn được trực tiếp bằng `[data-contract~="GAP-4"]`. Khi tắt chế độ
phát, cây không mang gì và một mình biên nhận giữ lời khai.

## Vòng lặp được đếm

Một lượt audit gửi phát hiện ngược về đây là mở thêm một vòng, và một vòng lặp lại chính nó thì không
phải tiến triển. Số biên nhận audit mà phiên này đã đẩy ngược về được đếm ngay ở gate, và một lần
chạy vượt `maxRounds` sẽ dừng với `NO_PROGRESS` thay vì sinh cùng một bề mặt tới lần thứ ba.

## Không ghi gì bên ngoài một phiên

Trước khi một byte nguồn được route bị đọc để sửa hay bị ghi, nhánh mà operator này chạy trong đó đã
tồn tại: một thư mục phiên có `state.json` và `step-N/parallel-M/request/request.json` của chính nhánh
ấy, xanh dưới `validate-request`. Thứ tự đó chính là lý do phiên tồn tại — request nói được phép chạm
vào cái gì trước khi có gì bị chạm, và mọi biên nhận sau đều treo vào nó. Một lần gọi phát hiện mình
sắp sửa nguồn được route mà không có `step-N/parallel-M` nào dưới một phiên thì dừng với
`SESSION_MISSING` và báo lại; nó không dựng thư mục phiên ngược về sau, vì một phiên viết sau khi việc
đã xong là bản ghi của việc chứ không phải cổng chặn việc, và không thứ gì trong đó từng được kiểm
lại với những gì thực sự đã làm.

## Nhánh phiên

Operator không bao giờ ghi lên nhánh mà người dùng đang checkout. Nó chỉ ghi trên
`session/<sessionId>` của checkout được route, trong git worktree mà orchestrator đã dựng sẵn từ head
đóng băng, và nó giữ một lease độc quyền trên worktree ấy suốt lúc ghi. Write set đã khai được commit
đúng một lần; `response.json` mang đúng một sha đó trong `commits`, dòng Checkout của `changes.md` ghi
`@workspaces/fe` ở head gốc rồi tới sha mới trên `session/<sessionId>`, và các request sau ghim
`@workspaces/fe` ở sha đó. Ở đây không push và không merge: `git.publish` sở hữu cả hai việc ấy.

## Không có giá trị tự nghĩ ra

Mọi class mà lần ghi tạo ra đều đã có sẵn trong kho class mà nhánh này đã đóng băng, và mọi identifier
nó mang vào một lời khai đều đã có sẵn trong kho luật đã áp dụng. Cả hai danh sách đều đầy đủ và đóng
băng ở bước 9, và `treeFingerprint` của `inventory` là hash của chính `resolved-tree` mà nó được đóng
băng cho: một lần ghi đọc một inventory mà fingerprint không còn khớp với cây bên cạnh nó là
`RESOLUTION_STALE`. Một class không có trong kho là `WRITE_REJECTED`: không làm tròn về giá trị gần,
không chép từ file bên cạnh, không định dạng lại theo kiểu đổi mất một bước thang. Một file mà lần ghi
sẽ chạm tới nhưng write set không khai cũng là `WRITE_REJECTED`, kể cả khi rõ ràng nó cần đổi; bước
đúng tiếp theo là sửa write set, không phải ghi rộng ra. Một path đã khai mà gốc owner của nó không
chứa là `OWNER_CONFLICT`, vì thuộc về owner nào chưa phải là trần. Phép kiểm kho chạy trên bản chiếu,
trước khi ghi bất cứ thứ gì, nên một lần áp dụng bị từ chối để source y nguyên.

## Phép kiểm tuân thủ đọc write set, không đọc bản kế hoạch

Phép kiểm kho trả lời đúng một câu hỏi: mọi giá trị có đến từ resolution không? Nó không trả lời được
câu còn lại: source, đúng như nó sẽ nằm trên đĩa, có còn chứa một class mà luật đã cấm sẵn không? Một
resolution có thể publish `flex-col` một cách trung thực mà ứng dụng vẫn viết đúng class ấy lên một
component có CSS tự sở hữu phần gập, bởi kho chỉ ghi những class nào tồn tại chứ không ghi chúng đáp
xuống node nào. Vì vậy bước 10 còn chạy `node scripts/sweep-presentation.mjs` trên write set đã
chiếu, qua `@tools/shell`, và đọc bốn mã của nó: `APP_OVERRIDE`, một class thò vào một đối tượng
Grammar; `APP_REIMPLEMENTATION`, một tiện ích layout đặt lên một đối tượng vốn đã sở hữu hình học của
mình; `OFF_SCALE`, một giá trị nằm ngoài thang đóng mà topic của nó publish; và `SHELL_GEOMETRY`, một
product shell tự vẽ dải mà lẽ ra phải compose. Bất kỳ phát hiện nào cũng là `WRITE_REJECTED`, với đầu
ra của lượt quét trích vào `response.md` dưới `## Rejections`, và bản ghi `sweep` nằm trong
`writes.json`. Đó vẫn là mã mà phép kiểm kho phát ra, vì đó vẫn là một lời từ chối như nhau: một giá
trị mà lần ghi không được uỷ quyền tạo ra. Giống phép kiểm kho, lượt quét chạy trên bản chiếu, trước
khi ghi bất cứ thứ gì, nên một lần áp dụng bị từ chối để source y nguyên. Lượt quét là một cổng chứ
không phải một tác giả: nó không bao giờ sửa một class, và bước đúng tiếp theo là một resolution đã
sửa hoặc một write set đã sửa.

## Node do ứng dụng sở hữu thành một file lá rỗng

Khi hướng đánh dấu một node là do ứng dụng sở hữu, chẳng hạn một canvas, bản chiếu ghi ra một file lá
rỗng mang contract của node đó, tức props và states của nó, để cây biên dịch được và bề mặt render ra
đo được. Operator không bao giờ viết phần logic của file lá ấy: contract là thứ hướng đã quyết, còn
hành vi phía sau nó thuộc về ai sở hữu node.

## Không đổi là một phép đo

Mọi path đã khai đều được băm trước bản chiếu và sau commit. Path có bản chiếu khác nội dung hiện tại
thì được tạo hoặc sửa; path có bản chiếu bằng đúng nội dung hiện tại được ghi `unchanged`. Sau commit,
cây được đọc lại và đối chiếu với cây đã resolve, và một chỗ lệch là `WRITE_REJECTED` chứ không phải
một thành công lặng lẽ. Dưới `mode = dry` không có gì được ghi cả: nhánh phát ra bản kế hoạch trong
`response/data/writes.json` với commit rỗng rồi dừng ở đó.

## Ranh giới

Context chỉ đọc, trừ các path trong write set đã khai trên nhánh phiên của `@workspaces/fe`, mỗi path
nằm dưới một gốc owner được sửa. Operator ghi những path ấy và `response/` của nhánh mình: biên nhận
quyết định, bản liệt kê coverage, các trang phương án đã render, biên nhận resolution, kho, cây đã
resolve, biên nhận áp dụng, bản ghi thay đổi và `response.json`. Nó không sửa source thẩm quyền, không
bịa hành vi nghiệp vụ, backend, kiến trúc, xác thực, lưu trữ hay dữ liệu, không publish Grammar dùng
chung, không sửa knowledge, không ghi class, giá trị hay identifier vắng mặt trong kho đã đóng băng
của chính nó, không thò tay vào giải phẫu Grammar bằng selector hay class truyền vào, không chạm file
ngoài write set đã khai, không commit lên nhánh nào khác, không push, không merge, không khởi động hay
cấu hình lại dịch vụ runtime, và không ghi phán quyết, điểm số hay tuyên bố pass lên source đã ghi:
nó biết nó đã quyết gì và ghi gì, không bao giờ biết nó render ra sao.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@grammar/core` | Grammar đã publish như app đang bind resolve ra: các composition mà một hướng được phép ràng và các quan hệ đã sở hữu mà lượt resolve đọc ở bản publish, không bao giờ từ source Grammar | có |
| `@knowledge/ui/composition` | các khẳng định mà biên nhận quyết định phải thoả, `COVERAGE-1` là khẳng định về toàn bộ biên nhận | có |
| `@knowledge/ui/presentation` | kho luật đóng, đọc ở fingerprint của nó; nguồn duy nhất của identifier hợp lệ | có |
| `@workspaces/fe` | checkout frontend được route, đọc ở head đóng băng; hiện trạng là bằng chứng, không bao giờ là hướng được yêu cầu, và là cây mà lần ghi đáp xuống, trên nhánh phiên của nó và không đâu khác | có |
| `@knowledge/grammars/<family>` | họ mà route đã bind gọi tên (`context.grammarId`) được kỳ vọng hiện thực hoá Common ra sao; luật về Grammar, không phải chính Grammar | không |
| `@knowledge/ui/proof` | các tiêu chí mà mọi phương án đã render được chấm theo trước khi chọn một; cùng thang điểm mà audit sau này đo, chỉ đọc khi có nhiều hơn một phương án được render | không |
| `@worktrees/uat/<flow>/<case>` | quan sát hành vi, UX và UI của lần trước kèm ảnh chụp; bằng chứng và phản chứng, một lần pass cũ không phải thẩm quyền hiện tại | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `business-promise-authority` | `business.decide`; bắt buộc với `new`, và với `reconstruct` khi tập trạng thái đổi | không |
| `backend-source-application` | `backend.generate`; bắt buộc khi một contract dữ liệu đổi | không |
| `architecture-decision` | `architecture.decide`; bắt buộc khi một ranh giới đổi | không |
| `frontend-direction-decision` | một lần chạy `interface.generate` trước trên cùng target, đọc khi chạy lại | không |
| `frontend-surface-audit` | `interface.audit`, các phát hiện mở ra vòng này; chỉ có mặt khi đây là một vòng lặp | không |
| `units` | `interface.plan`; bản đồ bề mặt mà nhánh này sinh đúng một đơn vị, gọi tên bằng `request.unit` | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `target` | id | — | Đúng một route, page, layout, modal, drawer, flow, block hay component mà bề mặt này là |
| `intent` | choice | modify | create, modify, audit-repair hay reconcile; `create` đi cùng change level `new` và chỉ đi cùng nó |
| `changeLevel` | choice | — | new, reconstruct hay refine; một lượt audit phải kết thúc bằng bề mặt pass là reconstruct |
| `ownerCeiling` | choice | surface-and-nested-layouts | surface-only, surface-and-nested-layouts hay ancestor-layouts-authorized |
| `candidates` | number 1–3 | 1 | Hình thành bao nhiêu hướng; nhiều hơn một chỉ khi muốn so sánh |
| `preview` | choice | no | yes thì render phương án duy nhất thành một trang xem được |
| `references` | list | [] | Tham chiếu của người: mỗi cái là một URL, một đường dẫn ảnh chụp hay một mô tả; nghiên cứu có giới hạn chỉ chạy khi ô này rỗng |
| `selectionPolicy` | choice | automatic | `automatic` cho so sánh nội bộ trong hướng đã chọn; `approval-required` cho các tier/hướng khác nhau về bản chất theo chính sách tương tác |
| `approval` | id | null | Id phương án người dùng thực sự chọn; bắt buộc dưới `approval-required`, dùng lại khi tiếp tục |
| `maxRounds` | number | 2 | Bề mặt này được đi bao nhiêu vòng audit rồi sinh lại trước khi gọi dừng vòng lặp |
| `contractEmission` | choice | on | `on` ghi danh sách token lời khai lên cây, `off` để một mình biên nhận resolution làm bằng |
| `mode` | choice | apply | `apply` ghi rồi commit, `dry` chỉ phát bản kế hoạch và không ghi gì |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại, đếm số vòng audit, xác nhận phiên và head đóng băng | `resume`, `approval`, `mode`, `maxRounds` | `request/request.json`, `state.json` của phiên và `step-N/parallel-M` của nhánh này, đầu vào `frontend-direction-decision` khi chạy lại và `frontend-surface-audit` khi đây là vòng lặp, @workspaces/fe ở head đóng băng | — | `INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Soát lời yêu cầu và bind các đầu vào mà change level đòi | `target`, `intent`, `changeLevel`, `ownerCeiling` | @workspaces/fe ở head đóng băng, @tools/git, đầu vào `business-promise-authority`, `backend-source-application` và `architecture-decision` | — | `ROUTE_UNVERIFIED`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED` |
| 3 | Quan sát context đang có và tham chiếu của người, rồi biên UI contract, coverage của nó và lớp bề mặt | `references` | @workspaces/fe (artifact trực tiếp của target, hoặc host được uỷ quyền và họ sản phẩm khi target chưa tồn tại), @worktrees/uat/<flow>/<case> nếu có, @knowledge/ui/composition (`COVERAGE-1` Case 7 publish bộ từ vựng lớp), đầu vào `business-promise-authority` nếu có | `ui-coverage` | `EVIDENCE_MISSING`, `SCOPE_UNFROZEN` |
| 4 | Chốt các chuẩn tham chiếu theo lớp, có giới hạn | `references`, `changeLevel` | @knowledge/ui/composition (khoảng trống mà nghiên cứu phải lấp), @tools/websearch | — | `REFERENCE_EVIDENCE_EXHAUSTED`, `REFERENCE_MISSING` |
| 5 | Hình thành các phương án và áp bộ lọc Grammar | `candidates`, `ownerCeiling` | UI contract vừa biên, @grammar/core (component sở hữu gì và có prop nào), @knowledge/grammars/<family> | — | `NO_VIABLE_DIRECTION`, `GRAMMAR_REQUIRED` |
| 6 | Render mọi phương án còn sống kèm hình đã tự xét, phục vụ các trang cho một người xem rồi in ra | `candidates`, `preview` | các phương án còn sống, @knowledge/grammars/<family>, @tools/visualize, @tools/imagegen, @tools/host, @tools/print | `candidates`, `direction-image`, `host` | — |
| 7 | Phản chứng, chấm các phương án đã render rồi viết quyết định | `selectionPolicy`, `approval` | các phương án, đầu vào `business-promise-authority` và `backend-source-application`, `ui-coverage`, @knowledge/ui/proof (các tiêu chí một bản render tĩnh trả lời được, theo từng viewport đã in) | `frontend-direction-decision` | `NO_VIABLE_DIRECTION`, `DIRECTION_CHOICE_REQUIRED` |
| 8 | Bind thẩm quyền trình bày và đi hết cây đã quyết một lượt dưới trần owner | — | @knowledge/ui/presentation (mọi topic kèm fingerprint và kho luật), @grammar/core (các quan hệ đã sở hữu của gói đã publish), @workspaces/fe (cây đóng băng, theo thứ tự tài liệu), `frontend-direction-decision`, @tools/registry | — | `KNOWLEDGE_UNBOUND`, `GRAMMAR_UNPUBLISHED`, `OWNER_CONFLICT` |
| 9 | Chọn một luật đã publish cho mỗi thuộc tính ứng dụng sở hữu, bỏ những gì cây không được mang, ghi các khoảng trống và phát lời khai | `contractEmission` | @knowledge/ui/presentation (các case topic được bind publish), @grammar/core (các quan hệ đã sở hữu, giải phẫu Grammar và thang đóng), @workspaces/fe (thuộc tính mỗi node đang mang) | `inventory`, `resolved-tree`, `frontend-presentation-resolution` | `RULE_MISSING`, `UNKNOWN_RULE` |
| 10 | Chiếu cây đã resolve lên write set đã khai, đối chiếu mọi giá trị với kho rồi quét bản chiếu | `mode` | `inventory` cạnh `resolved-tree`, @workspaces/fe (các path đã khai và gốc owner của chúng), @tools/shell | `writes` | `RESOLUTION_STALE`, `OWNER_CONFLICT`, `WRITE_REJECTED` |
| 11 | Ghi nguyên khối trên nhánh phiên, commit một lần rồi đọc lại cây ở commit | — | @workspaces/fe (nội dung hiện tại của từng path đã khai, dưới một lease độc quyền, rồi cây ở commit), các asset hình đã tự xét | @workspaces/fe/branch/session, `writes`, @tools/sourcewrite, @tools/git | `WRITE_REJECTED` |
| 12 | Phát | — | mọi thứ ở trên | `response/response.md`, `response/changes.md`, `response/response.json` | — |

Bước 3 còn chốt luôn đây là loại bề mặt nào. `COVERAGE-1` Case 7 publish bộ từ vựng, coverage mang
tên ấy ở `surfaceClass`, còn biên nhận quyết định nói đúng cái tên ấy dưới `## Surface class` kèm điều
gì xếp bề mặt vào lớp đó. Hai chỗ phải khớp, vì cái tên ấy là nơi mọi rule proof có dải đọc ngưỡng
của mình về sau: audit lấy lớp từ chính quyết định này chứ không tự chọn, nên một direction không khai
lớp nào là để audit không có dải và dừng nó lại. Mức thay đổi nào cũng khai một lớp; một `refine`
không thừa kế ngầm mà nêu lại.

Bước 4 để lại trong biên nhận các chuẩn mà bề mặt này nhắm tới, mỗi chuẩn gọi tên theo lớp, kèm thứ
được mượn và thứ nó không giải quyết. Dưới `new` và `reconstruct` bảng ấy có ít nhất một dòng và bước
4 dừng bằng `REFERENCE_MISSING` khi không sinh nổi một dòng nào; dưới `refine` nó để trống. Bước 6
render trước khi bước 7 ghi quyết định, vì một cấu trúc chưa ai nhìn thấy thì không thể duyệt, và một
phương án chỉ được tả bằng văn xuôi thì không ai phán được. Dưới `new` và `reconstruct`, mọi phương án
mà lượt chạy hình thành đều được render thành trang riêng, bất kể `preview` nói gì và bất kể có bao
nhiêu phương án: đó là `@tools/visualize`, không cần cấp quyền, và mọi runtime đều làm được.

Trang phương án không phải file để người ta tự đi tìm. Bước 6 phục vụ thư mục artifacts qua
`@tools/host` (tool có sẵn trong sổ đăng ký, không viết server mới cho từng lần) trên loopback, ở cổng
trống đầu tiên trong dải của sổ đăng ký, và ghi URL, cổng, thư mục cùng pid vào
`response/artifacts/host.json`; server dừng khi nhánh kết thúc hoặc được resume. Mỗi phương án được
phục vụ một lần cho mỗi viewport của coverage — mỗi viewport một trang, hoặc một trang nhận viewport
qua query string — để người xem thấy bản rộng và bản hẹp trước khi quyết, và đó là chỗ thứ nhất trong
hai chỗ tính đáp ứng được nhìn.

Phục vụ chưa phải là nói. Trước khi bước 7 ghi quyết định, bước 6 in qua `@tools/print` URL của từng
phương án cùng một ảnh chụp cho mỗi viewport thẳng vào cuộc trò chuyện người ta đang đọc, và biên nhận
quyết định liệt kê từng artifact đã in dưới `## Printed` kèm lý do. Một phương án phục vụ ở cổng không
ai được báo là phương án không ai thấy, và quyết định lấy trên đó là quyết định lấy một mình.

Cũng chính bảng ấy giữ các tier đã render. Dưới `approval-required`, xuất `interaction` theo
[chính sách tương tác](../../resources/interaction.md), mỗi phương án một trang đã phục vụ và một
ảnh chụp cho mỗi viewport. `reason` nêu URL bảng và hỏi đúng một câu chọn hướng. Không thêm hướng
đã bị loại chỉ để đủ số phương án. Một lựa chọn người lấy từ bảng ấy đóng lại những gì bảng đã cho
thấy: một tiêu chí mà `## Scores` cho thấy rớt ở phương án người đã duyệt được coi là đã định cho phiên
này, và audit sau đó ghi nó là person-accepted, gọi tên nhánh này, thay vì định tuyến ngược lại
(`TASTE-13` Case 7) — thang điểm không bao giờ lật một quyết định người đã lấy trên chính bằng chứng
của mình. Reason của mã dừng vận hành mô tả giới hạn tại owner, không mang câu hỏi tier; thẩm quyền
hiện hành và chính sách tương tác vẫn áp dụng.

Dưới `refine` trang vẫn là tuỳ chọn — cấu trúc đã được duyệt từ trước lượt chạy này — và chỉ render
khi có nhiều hơn một phương án được hình thành hoặc `preview` là yes; một phương án refine duy nhất
dưới mặc định không sinh trang nào và dựa vào phản chứng. Dưới `automatic`, chọn phương án trội hoặc
ghi fallback khi hoà; `approval-required` dừng với `DIRECTION_CHOICE_REQUIRED` cho tới khi người quay
lại với `approval`, và lần chạy tiếp tục ở bước 8 với phương án đã duyệt. Biên nhận quyết định uỷ
quyền cho lượt resolve làm việc bên trong trần owner đã đóng băng và không chứng minh gì về việc kết
quả render ra sao.

Bước 8 và 9 đi thăm mọi node theo thứ tự tài liệu và ghi một node path ổn định; node nằm ngoài trần
mà hướng mang theo thì chỉ quan sát chứ không bao giờ bị sửa, nên một cây cho đúng một quyết định cho
mỗi cặp node và thuộc tính. Bước 9 chỉ khai thứ mà một node mang nổi: một thuộc tính do ứng dụng sở
hữu nằm trên `className` của một component Grammar thì không mang thuộc tính nào, bởi component ấy
chuyển tiếp `className` và không công bố prop nào cho quan hệ đó, nên luật của nó được ghi dưới
`## Gaps` thay vì được phát ra. Chuyển tiếp `data-contract` từ mọi component Common có nhận
`className` là một thay đổi của Grammar và thuộc về chủ họ ấy, không thuộc về operator này.

Dưới `mode = dry`, nhánh dừng sau bước 10 với riêng bản kế hoạch: `writes.json` mang commit rỗng,
`response.json` không mang commit nào, và checkout y nguyên. Một lượt dry không được cấp
`@tools/sourcewrite` lẫn `@tools/git`, vì một chế độ không ghi gì thì không cần công cụ nào ghi được;
phần cấp quyền và đoạn này nói cùng một điều nên chúng không thể trôi khỏi nhau. `@tools/shell` được
cấp ở cả hai chế độ và ghim vào đúng một câu lệnh là lượt quét, vì một lượt dry bỏ qua lượt quét sẽ
công bố một bản kế hoạch chưa ai kiểm. Dưới `apply`, bước 11 ghi rồi commit đúng một lần và chứng
minh rằng cây đã commit đúng là cây đã resolve. `changes.md` là bản ghi mà các bước sau đọc: path nào
đã dịch chuyển, chúng mang lời khai nào, checkout ghim cổng nào cho chúng, và bề mặt nào bây giờ phải
được quan sát.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `frontend-direction-decision` | `response/direction.md` | md | có |
| `ui-coverage` | `response/data/coverage.json` | data | có |
| `candidates` | `response/artifacts/<candidateId>.html` | artifact | không |
| `direction-image` | `response/artifacts/images/<slot>.png` | artifact | không |
| `host` | `response/artifacts/host.json` | artifact | không |
| `frontend-presentation-resolution` | `response/resolution.md` | md | có |
| `inventory` | `response/data/inventory.json` | data | có |
| `resolved-tree` | `response/artifacts/<target>.resolved.tsx` | artifact | có |
| `frontend-source-application` | `response/response.md` | md | có |
| `changes` | `response/changes.md` | md | có |
| `writes` | `response/data/writes.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SESSION_MISSING` | terminate |
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
| `KNOWLEDGE_UNBOUND` | terminate |
| `GRAMMAR_UNPUBLISHED` | terminate |
| `OWNER_CONFLICT` | terminate |
| `RULE_MISSING` | terminate |
| `UNKNOWN_RULE` | terminate |
| `RESOLUTION_STALE` | terminate |
| `WRITE_REJECTED` | terminate |
| `NO_PROGRESS` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| source đã commit và một bề mặt đang được phục vụ phải được bind ở head mới trước khi quan sát được | `workspace.bind` |
| source đã commit và head của phiên phải được phục vụ trước khi quan sát được | `runtime.serve` |
| source đã commit và bề mặt render ra phải được đo | `interface.audit` |
| source đã commit và các cổng của chính checkout phải chạy | `quality.verify` |
| một component của họ mà hướng cần chưa được publish, nên một người publish nó rồi bề mặt được sinh lại | `interface.generate` |
