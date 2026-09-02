# Execute `fe.presentation.resolve`

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

## Trình tự thực thi

1. **Validate input và resume.** Áp `input.schema.json` cùng validate ngữ nghĩa. Từ chối binding
   source cũ, owner chồng lấn, topic trùng, mã xếp nhầm topic, và tiến độ không đổi.
2. **Bind authority.** Bind knowledge index và từng topic kèm fingerprint với danh sách mã, package
   Grammar đã publish cùng các quan hệ nó đã sở hữu, source head đã route, và cây đã đóng băng.
3. **Duyệt cây đúng một lượt.** Đi qua mọi node theo thứ tự tài liệu và ghi một `nodePath` ổn định.
   Node nằm ngoài trần owner được phép sửa thì chỉ quan sát, không bao giờ đụng vào; cần sửa nó là
   `OWNER_CONFLICT`.
4. **Xác định chủ của từng thuộc tính đang có.** Tra các quan hệ Grammar trước. Thuộc tính mà một
   component đã sở hữu thì quy về `owner: "grammar"`, không phát class nào, gọi tên rule mà component
   đó thoả, và ghi `GRAMMAR_OWNED`. Thứ tự này là cố ý: nó làm cho việc dựng lại thành bất khả thi
   chứ không chỉ là bị khuyên can.
5. **Chọn đúng một rule cho mỗi thuộc tính còn lại.** Đối chiếu điều kiện quan sát được với các case
   mà topic đã publish. Chỉ đúng một case được khớp. Hai case cùng khớp nghĩa là knowledge mơ hồ, và
   lần gọi dừng lại thay vì tự chọn.
6. **Phân loại đường công khai còn thiếu.** Khi quan hệ đó không có chủ trong Common và knowledge
   đánh dấu là thiếu capability, quy về `owner: "none"`, phát class mà rule khai báo, và ghi
   `COMMON_CAPABILITY_MISSING`. Class đó là workaround có ghi nhận, không bao giờ là một cái pass
   thầm lặng.
7. **Gỡ những thứ cây không được mang.** Xoá class của ứng dụng nếu nó dựng lại một quan hệ Grammar
   đã sở hữu, ghi đè ruột Grammar, hoặc nằm ngoài thang đóng, và ghi finding tương ứng. Việc xoá
   được báo cáo theo từng node, không bao giờ làm im lặng.
8. **Phát contract.** Mọi node do ứng dụng sở hữu đều công bố các mã nó khai. Với
   `contractEmission: "attribute"`, cây kết quả mang `data-contract` dưới dạng danh sách token cách
   nhau bằng khoảng trắng. Với `receipt-only`, cây không mang gì và chỉ receipt giữ các lời khai.
9. **Phát ra rồi dừng.** Ghi cây kết quả dưới `input.project.artifactRootRef`, phát đúng một output
   theo `output.schema.json`, và bind mọi fingerprint. Không được claim đã có bằng chứng visual,
   quality hay UAT.

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
