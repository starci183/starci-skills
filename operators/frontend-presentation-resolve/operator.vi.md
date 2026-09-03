# frontend.presentation.resolve

## Việc

Resolve mọi thuộc tính trình bày do ứng dụng sở hữu trên một cây đã compose sẵn về đúng một luật đã
publish, phát ra class và lời khai contract kiểm chứng được của nó, và dừng ở khoảng trống có chủ nhỏ
nhất thay vì bịa ra một giá trị.

## Cấu trúc đến nơi là đã quyết xong

Cấu trúc, thứ tự phần tử, việc chọn component Grammar, chữ, dữ liệu và hành vi đến nơi là đã quyết
xong, và trần owner cũng vậy: nó do chính cái hướng mà nhánh này resolve mang theo, không bao giờ
được khai lại ở đây. Operator này chỉ trả lời, cho từng node ứng dụng sở hữu, mỗi thuộc tính trình
bày nhận giá trị nào và luật nào uỷ quyền cho giá trị ấy. Nó không đổi gì về thứ cây render ra.

## Không có luật bịa

Một luật chỉ tồn tại khi topic kiến thức được bind publish đúng identifier của nó, và kho luật ấy
đóng băng suốt lần chạy. Một identifier phát ra mà không có trong kho là `UNKNOWN_RULE`. Một class
chỏi với identifier của nó bị từ chối: số hiệu luật là số thứ tự trên thang giá trị, nên `GAP-5`
render ra `gap-6` và `PADDING-5` render ra `p-6`, và viết số thứ tự thành bước thang chính là lỗi mà
phép kiểm này sinh ra để bắt. Khi không case nào đã publish khớp điều kiện quan sát được, lần chạy
dừng với `RULE_MISSING` gọi tên đúng node đó; nó không chọn giá trị gần, không làm tròn về bước gần
nhất, không chép của node bên cạnh. Operator không bao giờ sửa knowledge: case còn thiếu được trả về
cho chủ knowledge, và chính cây ấy được resolve lại sau khi case được publish.

## Grammar đọc ở bản đã publish, và được hỏi trước

Các quan hệ đã sở hữu lấy từ chính lời khai data-contract của gói đã publish, không bao giờ lấy từ
source của Grammar. Một thuộc tính mà component đã sở hữu sẽ resolve về component ấy, không phát class
ứng dụng nào, và gọi tên luật mà component thoả; thứ tự đó làm việc hiện thực lại thành bất khả thi
chứ không chỉ là điều bị khuyên can. Một class ứng dụng hiện thực lại quan hệ đã có chủ, đè lên giải
phẫu Grammar hay nằm ngoài thang đóng sẽ bị bỏ kèm một dòng ghi của chính nó, theo từng node và không
bao giờ im lặng.

## Class bị cấm thì gỡ, không phải thiếu rule

Khi case duy nhất gọi tên một class của ứng dụng nêu điều kiện mà node không thoả (foreground accent
mà `SURFACE-4` chỉ cho phép trong một dải raised, lại viết lên một hàng không raised), thuộc tính đó
không thiếu rule: rule đã trả lời, và câu trả lời là không. Class bị gỡ ở bước gỡ bỏ, thuộc tính rơi
về giá trị node kế thừa, và việc gỡ được ghi kèm case đã từ chối nó. `RULE_MISSING` chỉ dành cho thuộc
tính không case nào đã publish nhắc tới.

## Thiếu đường công khai là một khoảng trống, không phải một lần dừng

Khi Common không mở đường công khai nào cho một quan hệ mà ứng dụng cần một cách chính đáng, node giữ
lại class ứng dụng của nó và nhánh ghi một dòng vào `## Gaps` gọi tên node, thuộc tính và đường còn
thiếu. Nhánh không dừng: một cách chữa cháy có ghi sổ thì chủ họ và lượt audit sau đều thấy, còn dừng
ở đây chỉ đổi một giá trị im lặng lấy một chuỗi bị chặn.

## Contract là lời khai, không phải phán quyết

Mọi node do ứng dụng sở hữu đều công bố các identifier nó khai. `data-contract` ghi lại node khai
thoả những luật nào và không bao giờ khẳng định node đó pass; lời khai tồn tại để một lượt audit sau
có thể phản bác, và một luật vẫn chọn được trực tiếp bằng `[data-contract~="GAP-4"]`. Khi tắt chế độ
phát, cây không mang gì và một mình biên nhận giữ lời khai.

## Vòng lặp được đếm

Một lượt audit gửi phát hiện ngược về đây là mở thêm một vòng, và một vòng lặp lại chính nó thì không
phải tiến triển. Số biên nhận audit mà phiên này đã đẩy ngược về được đếm ngay ở gate, và một lần
chạy vượt `maxRounds` sẽ dừng với `NO_PROGRESS` thay vì resolve cùng một cây tới lần thứ ba.

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: biên nhận resolution, bản kiểm kê và
cây đã resolve. Nó không đổi cấu trúc DOM, thứ tự phần tử, việc chọn component Grammar, chữ hay hành
vi, không viết class cho thuộc tính mà một component Grammar đã sở hữu, không thò tay vào giải phẫu
Grammar bằng selector hay class truyền vào, không sửa knowledge, không publish Grammar, không ghi
source sản phẩm, và không ghi phán quyết, điểm số hay tuyên bố pass lên bất kỳ node nào.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@knowledge/ui/presentation` | kho luật đóng, đọc ở fingerprint của nó; nguồn duy nhất của identifier hợp lệ | có |
| `@grammar/core` | các quan hệ đã sở hữu của gói đã publish, đọc ở bản publish chứ không bao giờ từ source Grammar | có |
| `@workspaces/fe` | checkout được route mà cây đã compose thuộc về, đọc ở head đóng băng | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `frontend-direction-decision` | `frontend.direction.decide`, ý đồ và trần owner mà lượt resolve này làm việc bên trong; không bao giờ là nguồn giá trị trình bày | có |
| `frontend-surface-audit` | `frontend.surface.audit`, các phát hiện mở ra vòng này; chỉ có mặt khi đây là một vòng lặp | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `maxRounds` | number | 2 | Bề mặt này được đi bao nhiêu vòng audit rồi resolve trước khi gọi dừng vòng lặp |
| `contractEmission` | choice | on | `on` ghi danh sách token lời khai lên cây, `off` để một mình biên nhận làm bằng |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate, chạy lại, và đếm số vòng audit | `resume`, `maxRounds` | `request/request.json`, đầu vào `frontend-surface-audit` khi đây là vòng lặp, @workspaces/fe ở head đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind thẩm quyền | — | @knowledge/ui/presentation (mọi topic kèm fingerprint và kho luật), @grammar/core (các quan hệ đã sở hữu của gói đã publish), @workspaces/fe (head được route và cây đã đóng băng), đầu vào `frontend-direction-decision`, @tools/git, @tools/registry | — | `KNOWLEDGE_UNBOUND`, `GRAMMAR_UNPUBLISHED` |
| 3 | Đi hết cây một lượt dưới trần owner mà hướng mang theo | — | @workspaces/fe (cây đóng băng, theo thứ tự tài liệu), đầu vào `frontend-direction-decision` | — | `OWNER_CONFLICT` |
| 4 | Xác định chủ của từng thuộc tính đang có | — | @grammar/core (các quan hệ đã sở hữu), @workspaces/fe (thuộc tính node đang mang) | `response/data/inventory.json` | — |
| 5 | Chọn một luật trình bày cho mỗi thuộc tính ứng dụng còn sở hữu | — | @knowledge/ui/presentation (các case topic được bind publish) | — | `RULE_MISSING` |
| 6 | Xếp một đường công khai còn thiếu thành khoảng trống Grammar | — | @grammar/core (quan hệ đang xét), @knowledge/ui/presentation (dấu khoảng trống năng lực) | — | — |
| 7 | Bỏ những gì cây không nên mang | — | @workspaces/fe (class ứng dụng trên node), @grammar/core (giải phẫu Grammar và thang đóng) | — | — |
| 8 | Phát lời khai contract lên các node do ứng dụng sở hữu | `contractEmission` | @knowledge/ui/presentation (kho luật đã đóng băng) | — | `UNKNOWN_RULE` |
| 9 | Phát | — | mọi thứ ở trên | `response/artifacts/<target>.resolved.tsx`, `response/data/inventory.json`, `response/response.md`, `response/response.json` | — |

Lượt đi thăm mọi node theo thứ tự tài liệu và ghi một node path ổn định; node nằm ngoài trần mà hướng
mang theo thì chỉ quan sát chứ không bao giờ bị sửa. Bước 4 đến 8 chạy theo từng node, nên một cây cho
đúng một quyết định cho mỗi cặp node và thuộc tính. Biên nhận uỷ quyền cho một lượt audit sau đo kết
quả render đối chiếu với lời khai; nó không chứng minh gì về việc cây render ra sao.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `frontend-presentation-resolution` | `response/response.md` | md | có |
| `inventory` | `response/data/inventory.json` | data | có |
| `resolved-tree` | `response/artifacts/<target>.resolved.tsx` | artifact | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `OWNER_CONFLICT` | terminate |
| `KNOWLEDGE_UNBOUND` | terminate |
| `UNKNOWN_RULE` | terminate |
| `RULE_MISSING` | terminate |
| `GRAMMAR_UNPUBLISHED` | terminate |
| `NO_PROGRESS` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| cây đã resolve và các giá trị của nó phải được ghi vào source sản phẩm | `frontend.source.apply` |
| một khoảng trống cần component của họ trước vòng sau, nên một người publish nó rồi chính cây ấy được resolve lại | `frontend.presentation.resolve` |
