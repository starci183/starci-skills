# Thực thi `fe.presentation.resolve`

## Một việc duy nhất

Biến một cây đã dựng xong thành chính cây đó, với mọi thuộc tính presentation do ứng dụng sở hữu đã
được quy về đúng một rule đã publish. Đây là một lần gọi operator tuyến tính. Nó không gọi operator
khác, không điều phối workflow, không tự dừng giữa chừng, và không đổi thứ mà cây render ra.

Cấu trúc, thứ tự phần tử, việc chọn Grammar component, câu chữ, dữ liệu và hành vi đều đã được quyết
từ trước. Operator này chỉ trả lời, cho từng node ứng dụng sở hữu, mỗi thuộc tính presentation lấy
giá trị nào và rule nào cho phép giá trị đó.

## Không bịa luật

Một rule chỉ tồn tại khi topic knowledge được bind có publish mã của nó. Danh sách đó đến qua
`context.knowledge.topics[].ruleIds` và bị đóng băng bằng fingerprint trong suốt lần gọi.

Bốn điều cấm gánh việc này, và mỗi điều đều được kiểm tra chứ không phải chỉ khuyên:

1. Mã phát ra mà không có trong danh sách là `UNKNOWN_RULE`.
2. Mã nằm dưới một topic không publish nó là input không hợp lệ, vì mã bị xếp nhầm topic chính là
   đường để một rule bịa lọt vào mà không ai thấy.
3. Class mâu thuẫn với mã của chính nó thì bị từ chối. Số của rule là thứ tự trên thang giá trị, nên
   `GAP-5` render ra `gap-6` và `PADDING-5` render ra `p-6`. Viết số thứ tự thành số bậc chính là lỗi
   mà phép kiểm tra này sinh ra để bắt.
4. Khi không case nào trong rule khớp điều kiện quan sát được, lần gọi dừng lại với `RULE_MISSING`
   gọi tên node đó. Nó không chọn một giá trị gần đúng, không làm tròn về bậc gần nhất, và không chép
   từ node bên cạnh.

Operator không bao giờ sửa knowledge. Một case còn thiếu được trả về cho chủ knowledge, và chính cây
đó được resolve lại sau khi case được publish và fingerprint của topic được bind lại.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Validate input và resume | input, receipt trước đó, binding source đã đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | knowledge index và từng topic kèm fingerprint với danh sách mã, package Grammar đã publish cùng các quan hệ nó sở hữu, source head đã route, cây đã đóng băng | — | `KNOWLEDGE_UNBOUND`, `GRAMMAR_UNPUBLISHED` |
| 3 | Duyệt cây đúng một lượt | cây đã đóng băng, trần owner được phép sửa | — | `OWNER_CONFLICT` |
| 4 | Xác định chủ của từng thuộc tính đang có | các quan hệ Grammar, những thuộc tính node đang mang | — | — |
| 5 | Chọn đúng một rule cho mỗi thuộc tính còn lại | điều kiện quan sát được, các case mà topic đã publish | — | `RULE_MISSING` |
| 6 | Phân loại đường công khai còn thiếu | quan hệ đang xét, dấu thiếu capability trong knowledge | — | — |
| 7 | Gỡ những thứ cây không được mang | các class của ứng dụng trên node, ruột Grammar, thang đóng | — | — |
| 8 | Phát contract | các thuộc tính đã quy chủ, `contractEmission`, danh sách mã đã đóng băng | — | `UNKNOWN_RULE` |
| 9 | Phát ra rồi dừng | tất cả những gì ở trên | `<target>.resolved.tsx` | — |

Khâu validate từ chối binding source cũ, owner chồng lấn, topic trùng, mã xếp nhầm topic, và tiến độ
không đổi. Lượt duyệt đi qua mọi node theo thứ tự tài liệu và ghi một `nodePath` ổn định; node nằm
ngoài trần owner được phép sửa thì chỉ được quan sát, không bao giờ bị đụng vào.

Các quan hệ Grammar được tra trước, nên thuộc tính mà một component đã sở hữu thì quy về
`owner: "grammar"`, không phát class nào, gọi tên rule mà component đó thoả, và ghi `GRAMMAR_OWNED`.
Thứ tự này là cố ý: nó làm cho việc dựng lại thành bất khả thi chứ không chỉ là bị khuyên can. Chỉ
đúng một case đã publish được khớp với một điều kiện quan sát được; hai case cùng khớp nghĩa là
knowledge mơ hồ, và lần gọi dừng lại thay vì tự chọn.

Khi quan hệ đó không có chủ trong Common và knowledge đánh dấu là thiếu capability, thuộc tính quy về
`owner: "none"`, phát class mà rule khai báo, và ghi `COMMON_CAPABILITY_MISSING`; class đó là
workaround có ghi nhận, không bao giờ là một cái pass thầm lặng. Một class của ứng dụng dựng lại quan
hệ Grammar đã sở hữu, ghi đè ruột Grammar, hoặc nằm ngoài thang đóng thì bị xoá kèm finding tương
ứng, báo cáo theo từng node và không bao giờ làm im lặng.

Mọi node do ứng dụng sở hữu đều công bố các mã nó khai. Với `contractEmission: "attribute"`, cây kết
quả mang `data-contract` dưới dạng danh sách token cách nhau bằng khoảng trắng; với `receipt-only`,
cây không mang gì và chỉ receipt giữ các lời khai. Khâu phát ra ghi cây kết quả dưới
`input.project.artifactRootRef`, phát đúng một output theo `output.schema.json`, bind mọi fingerprint,
và không claim đã có bằng chứng visual, quality hay UAT.

## Contract là lời khai, không phải phán quyết

`data-contract` ghi lại node đó khai là mình thoả những rule nào. Nó không bao giờ khẳng định node đó
đạt. Lời khai tồn tại để một lần audit sau đo được kết quả render thật rồi đối chiếu với ý định đã
nói ra, và điều đó biến ba kiểu hỏng im lặng thành phát hiện được:

- một node khai `GAP-4` trong khi gap tính ra là `1.5rem`, tức lời khai và pixel chỏi nhau;
- một node có khoảng cách mà không khai gì, tức không ai làm chủ giá trị đó;
- một node khai một mã mà knowledge đã publish không hề chứa.

Thuộc tính này là danh sách token nên chọn được thẳng một rule, bằng `[data-contract~="GAP-4"]`. Nó
có thể bị gỡ lúc build, và receipt vẫn là bản ghi bền, nên audit một cây production vẫn tra lại được
mọi lời khai.

## Thực thi khi resume

Một lần resume bắt đầu lại từ bước validate, chỉ dùng lại những quan sát có fingerprint không đổi, rồi
tiêu thụ đúng phần delta. Resume không thêm được thay đổi nào về knowledge, Grammar, cây hay scope thì
trả `NO_PROGRESS`. Knowledge publish lại phải đến dưới dạng fingerprint mới của topic; cùng một
fingerprint không thể cho ra một đáp án khác.

## Các đòn tấn công bắt buộc

Operator không được resolve khi còn bất kỳ mục nào sau đây chưa xử lý:

- một thuộc tính có trong cây mà không topic nào được bind cho nó;
- hai case trong cùng một rule cùng khớp một điều kiện quan sát được;
- một class và mã của nó không đồng ý với nhau về giá trị;
- một node mang class presentation mà không công bố contract;
- một workaround được phát ra mà không ghi nhận capability còn thiếu;
- một quan hệ Grammar đã sở hữu lại bị ứng dụng viết thêm;
- một class bị gỡ đi mang theo ý nghĩa mà cây kết quả không còn diễn đạt được nữa.
