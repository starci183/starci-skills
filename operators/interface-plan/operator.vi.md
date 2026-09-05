# interface.plan

## Việc

Gọi tên mọi trang và modal của một tính năng đúng một lần, quyết định shell chung đúng một lần, và
cho mỗi đơn vị một dòng goal của riêng nó, để những generator mù theo sau mỗi cái dựng một đơn vị
trong một shell thay vì mỗi cái tự bịa một shell.

## Xong khi

Xong khi `surface-map` gọi tên mọi trang và modal mà tham chiếu hay source cho thấy, mỗi cái với
route hay host, một dòng goal và tier của nó, quyết định shell chung đúng một lần, và file `units`
mang một đơn vị trang hay modal cho mỗi dòng Map với cùng id, goal và tier.

## Đơn vị của một agent mù là một trang hay một modal

Một agent bắt đầu với ngữ cảnh trống giữ trọn được một trang hay một modal: route của nó, goal của
nó, nó đọc gì và ghi gì, và cái shell nó nằm trong. Nó không giữ nổi một tính năng, và một tính năng
giao cho một agent biến thành phiên mười tám giờ trong đó mọi trang đều dựng dở và shell được vẽ ba
lần. Operator này là nơi duy nhất nhìn thấy cả tính năng cùng lúc. Nó đọc tham chiếu của người, source
đã có sẵn và lời hứa khi có một lời hứa được ràng, rồi biến chúng thành một danh sách đóng: một dòng
cho mỗi trang, một dòng cho mỗi modal, mỗi dòng với route nó trả lời hay đơn vị chứa nó. Danh sách
được viết hai lần một cách có chủ ý — thành bảng Map mà người đọc và thành dữ liệu `units` mà
orchestrator toả nhánh — và hai bản là một danh sách: validator từ chối một dòng Map không có entry,
một entry không có dòng, và một goal khác nhau giữa hai bên, vì generator đọc hai goal cho một trang
thì không dựng cái nào.

## Shell được quyết định ở đây và không ở đâu khác

Sidebar, header, breadcrumb và thứ tự điều hướng được quyết định một lần, trong bảng Shell, trước
khi bất kỳ đơn vị nào tồn tại. Mỗi dòng nêu phần tử, chủ sở hữu render nó — layout của tính năng,
hay đúng một đơn vị mang nó — và điều đã quyết định, theo các composition mà family publish dưới
`@grammar/core`. Generator ràng shell ấy và không bao giờ vẽ lại; một đơn vị cần một phần tử shell mà
bảng không mang là khuyết điểm của bản đồ này, không phải giấy phép để generator tự bịa. Bảng có ít
nhất một dòng, vì một tính năng không có shell chung là một tính năng chưa được nhìn như một tổng
thể.

## Một bản đồ hoặc đầy đủ hoặc không phải bản đồ

Một route hay host mà tham chiếu hay source cho thấy nhưng không dòng Map nào gọi tên là
`MAP_INCOMPLETE`. Mã dừng là của chính operator này và định tuyến về chính nó: cùng bản đồ chạy lại
với đơn vị còn thiếu được gọi tên, hoặc với lý do được ghi vì sao route ấy nằm ngoài tính năng. Nó
không bao giờ là lỗi của bên gọi và không bao giờ thành `INVALID_INPUT`, vì bên gọi đã cung cấp tham
chiếu và source và chính operator này đã không đọc được chúng. Một route mà source phục vụ nhưng bản
đồ gọi là mới, hay một trang bản đồ mô tả mà checkout không mang, là `EVIDENCE_MISSING`: một khẳng
định về hệ thống không có file nào đứng sau.

## Goal và contract dữ liệu đi cùng đơn vị

Mỗi đơn vị mang một dòng goal dài tối đa như schema `units` cho phép, và đó là toàn bộ thứ nhánh
thực thi được đối chiếu; một đơn vị không có goal bị schema từ chối trước khi validator nào đọc tới.
Mỗi đơn vị cũng có đúng một dòng Data contracts nói nó đọc gì và ghi gì, theo tên mà lời hứa hay
source đặt cho các thao tác, để một generator mù học được các thao tác trang của nó ràng từ bảng này
hoặc không từ đâu cả. Phụ thuộc giữa các đơn vị — một modal cần trang chứa nó, một trang chi tiết cần
trang danh sách — được ghi trong `dependsOn` để orchestrator sắp thứ tự toả nhánh chỉ từ bản kế hoạch.

## Hành trình được audit, còn mọi thứ khác là chưa kiểm

Một bản đồ gọi tên mọi trang và modal mà tính năng có; các dòng "xong khi" của nhiệm vụ gọi tên một
hành trình đi qua một số trong đó. Đó là các đơn vị `journey`, và chúng là những đơn vị mà lượt audit
theo sau được toả nhánh lên. Mọi đơn vị còn lại là `secondary`, mang đúng một câu nói vì sao hành
trình không đi qua nó, và được ghi xuống là chưa kiểm ở làn audit dưới `@worktrees/unchecked`
thay vì được kiểm chứng — để một lượt chạy bị thu hẹp là bị thu hẹp trên giấy trắng mực đen, và không
lượt nào đo mọi màn hình nó tìm thấy chỉ vì chẳng ai nói màn hình nào mới quan trọng. Một đơn vị mà
tính năng đang mang một mục chưa kiểm còn mở thì hoặc được bản đồ này lấy trở lại vào hành trình, và
lượt audit chạy sẽ kiểm nó, hoặc được gia hạn bằng một dòng secondary với lý do của chính bản đồ này; một bản đồ
chỉ đơn giản bỏ nó ra ngoài là hoãn nó lần thứ hai mà không ai đồng ý, và bị từ chối. Việc sinh không
bị thu hẹp theo cách ấy: mọi đơn vị bản đồ gọi tên đều được dựng, vì dựng gì là mục tiêu của người,
còn chỉ chứng minh gì mới là chuyện của hành trình.

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: bản đồ, danh sách đơn vị và
`response.json`. Nó không quyết định gì bên trong một đơn vị — không composition, không giá trị trình
bày, không copy — không ghi source, không render ứng viên, không khởi động server và không sinh ảnh;
thiết kế của một đơn vị thuộc về generator nhận nó. Nó không publish Grammar chung và không mang phán
quyết nào về source.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@grammar/core` | Grammar đã publish như app được ràng resolve: các composition shell và điều hướng mà một dòng Shell được gọi tên, và các composition một đơn vị có thể ràng sau này | có |
| `@knowledge/ui/composition` | mọi file, luật và Case composition trong manifest chính xác đã đóng băng | có |
| `@knowledge/grammars/<family>` | INDEX, DNA, family, idioms và playbook của family theo route, đọc trước khi chọn shell | có |
| `@workspaces/fe` | checkout frontend được route ở head đã đóng băng: các route, layout, modal và drawer đã tồn tại, đọc như bằng chứng về thứ bản đồ phải gọi tên và không bao giờ như chính bản đồ | có |
| `@worktrees/unchecked/<product>` | phần chưa kiểm mà tính năng này đang mang trong làn audit: mọi đơn vị một nhiệm vụ trước đã hoãn, để bản đồ này kiểm nó hay gia hạn nó thay vì lại lặng lẽ hoãn thêm lần nữa | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `business-promise-authority` | `business.decide`; lời hứa có các hành trình, trạng thái và thao tác mà các đơn vị phải bao phủ, khi tính năng có một lời hứa | không |
| `knowledge-repair-receipt` | `knowledge.repair`, khi đây là lần thử lại với manifest đã bind lại | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `feature` | id | — | Tính năng có các trang và modal được bản đồ gọi tên; nó là tiêu đề bản đồ và là khoá mọi đơn vị thuộc về |
| `reference` | text | — | Tham chiếu của người: một đường dẫn ảnh chụp hay văn xuôi mô tả bề mặt; mọi route hay host nó cho thấy là thứ bản đồ phải gọi tên |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume` | `request/request.json`, bản đồ bị chặn khi chạy lại | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Đọc tham chiếu: mọi route, host và modal mà ảnh chụp hay văn xuôi cho thấy dưới tính năng | `reference`, `feature` | tham chiếu mà request mang | — | — |
| 3 | Đọc source: mọi route, layout, modal và drawer mà checkout đã phục vụ dưới tính năng, ở head đã đóng băng | — | @workspaces/fe, @tools/git | — | `EVIDENCE_MISSING` |
| 4 | Đọc lời hứa khi được ràng: các hành trình, trạng thái và thao tác mà các đơn vị phải bao phủ | — | đầu vào `business-promise-authority` | — | — |
| 5 | Đóng băng coverage knowledge chính xác và bản hiểu family, rồi quyết shell một lần | — | @knowledge/ui/composition, @knowledge/grammars/<family>, @grammar/core, tham chiếu, source | `knowledge-coverage`, `family-understanding`, hoặc `knowledge-question` khi mâu thuẫn | `KNOWLEDGE_QUESTION` |
| 6 | Gọi tên mọi đơn vị: một dòng cho mỗi trang và mỗi modal, với route hay host và một dòng goal | — | tham chiếu, source, lời hứa | — | `MAP_INCOMPLETE` |
| 7 | Xếp tier cho từng đơn vị theo các dòng "xong khi" của nhiệm vụ: `journey` nơi hành trình đi qua nó, `secondary` kèm một câu lý do nơi hành trình không đi qua, và mọi mục chưa kiểm còn mở của tính năng này được lấy lại hay gia hạn | — | các dòng "xong khi" của nhiệm vụ, các đơn vị, @worktrees/unchecked/<product> | — | — |
| 8 | Khai contract dữ liệu của từng đơn vị: nó đọc gì và ghi gì | — | các đơn vị, đầu vào `business-promise-authority` | — | — |
| 9 | Ghi danh sách đơn vị: một entry cho mỗi dòng Map với cùng id, goal và tier, lý do hoãn của nó khi nó có một lý do, và các đơn vị mỗi cái phụ thuộc | — | bản đồ | `units` | — |
| 10 | Phát bản đồ và biên nhận | — | mọi thứ ở trên | `surface-map`, `response/response.json` | — |

Bước 6 là bước duy nhất dừng vì chính bản đồ: một route hay host mà bước 2 và 3 tìm thấy nhưng không
dòng nào gọi tên là `MAP_INCOMPLETE`, với reason nêu nó trong một đoạn, và không phát gì cả. Chạy lại
bắt đầu lại từ bước 1 và đọc lại tham chiếu và source; một lần vào lại mà bản đồ gọi tên cùng những
đơn vị như nhánh nó chạy lại là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `surface-map` | `response/response.md` | md | có |
| `units` | `response/data/units.json` | data | có |
| `knowledge-question` | `response/data/knowledge-question.json` | data | không |
| `knowledge-coverage` | `response/data/knowledge-coverage.json` | data | không |
| `family-understanding` | `response/data/family-understanding.json` | data | không |

## Kết quả tốt nhất

Với plan thành công, `outcome.primary` trỏ tới surface map đã khai hoặc bản table, diagram hay
document rõ nhất của nó. Nhãn gọi tên quyết định lập kế hoạch mà một người có thể xem; units và
coverage có thể làm bằng chứng phụ. Nó không trỏ tới bản trực quan nháp chưa khai hoặc gọi một plan
blocked hay mismatch là kết quả tốt nhất.

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `MAP_INCOMPLETE` | terminate |
| `KNOWLEDGE_QUESTION` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| knowledge đã bind mâu thuẫn với bằng chứng tác vụ hay tham chiếu đã kiểm, nên owner chuẩn sửa nó trước khi thử lại chính bản đồ này | `knowledge.repair` |
| bản đồ đã đầy đủ: mỗi đơn vị được sinh trên nhánh riêng, mỗi nhánh một trang hay modal, mang id đơn vị của nó | `interface.generate` |
| một route tham chiếu cho thấy là thứ người không yêu cầu, nên người nói nó có thuộc tính năng hay không | `user` |
