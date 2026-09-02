# Context cho `fe.presentation.resolve`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để giải quyết presentation. Nó trả lời câu "operator này được
đọc những gì?" trước khi bắt đầu duyệt cây. Context không bao giờ nới rộng phạm vi nhiệm vụ và không
bao giờ biến bằng chứng thành thẩm quyền.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Knowledge index | Danh mục presentation và khuôn rule mà mọi topic phải theo. | Bắt buộc. Nêu topic nào được phép bind. |
| Knowledge topic | Một thuộc tính presentation, thang đóng của nó, các case, và đúng những mã nó publish. | Luật tái dùng bắt buộc. Nguồn duy nhất của mã rule hợp lệ. |
| Grammar đã publish | Package, manifest, và các quan hệ mà component của nó đã sở hữu. | Thẩm quyền UI tái dùng bắt buộc. Quyết định thuộc tính nào ứng dụng không được viết. |
| Frontend source | Checkout đã route và head của nó. | Bằng chứng rằng cây thuộc về source đã đóng băng. |
| Cây đã dựng | Cấu trúc, thứ tự và việc chọn Grammar object đã quyết xong. | Đối tượng của lần gọi, không bao giờ bị viết lại. |
| Direction receipt | Direction frontend đã duyệt mà cây này hiện thực hoá. | Bằng chứng về ý định. Không bao giờ là nguồn giá trị presentation. |
| Owner audit | Các phát hiện trước đó của cùng owner. | Bằng chứng và lịch sử hồi quy. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. knowledge index cùng ít nhất một topic;
2. một binding Grammar đã publish;
3. tham chiếu frontend source đã route, với head bằng đúng `input.project.sourceHead`;
4. cây đã dựng, kèm fingerprint và số node.

Phải có topic được bind cho mọi thuộc tính presentation mà cây thật sự mang. Một thuộc tính có mặt mà
thiếu topic của nó là `KNOWLEDGE_UNBOUND`, vì giải quyết nó đồng nghĩa với chọn một giá trị không có
rule nào đứng sau.

## Danh sách mã rule

`context.knowledge.topics[].ruleIds` là danh sách đầy đủ và đã đóng băng những mã mà operator được
phép phát ra. Nó không phải gợi ý, cũng không phải một tập con.

Mỗi mã phải mang tiền tố mà topic của nó publish: `GAP-` dưới gap, `PADDING-` dưới padding, `MARGIN-`
dưới margin, `FONT-` dưới font, `TONE-` dưới tone, `MEASURE-` dưới measure, `FLOW-` dưới text flow,
`OVERFLOW-` dưới overflow. Một mã chỉ thuộc về đúng một topic.

Bind một mã dưới sai topic, hoặc liệt kê nó hai lần, là input không hợp lệ chứ không phải cảnh báo.
Cả hai đều là cách để một mã không file nào publish có được vẻ ngoài của thẩm quyền.

## Quyền sở hữu của Grammar

`context.grammar.ownedRelationships` nêu component nào đã sở hữu thuộc tính nào, và quyền sở hữu đó
thoả rule nào. Mọi quan hệ đều phải gọi tên một mã mà knowledge đã publish, nên Grammar cũng không thể
claim một rule không tồn tại.

Danh sách này được tra trước mọi quyết định của ứng dụng. Đây chính là thứ làm cho việc dựng lại thành
bất khả thi chứ không chỉ bị khuyên can: một thuộc tính đã có component làm chủ thì không bao giờ đi
tới bước khớp case.

## Ranh giới

Context là chỉ đọc. Operator chỉ ghi cây kết quả và receipt của nó dưới
`input.project.artifactRootRef`. Nó không sửa knowledge, không publish Grammar, không đụng vào product
source ngoài phần artifact kết quả, và không ghi phán quyết lên bất kỳ node nào.

## Tài nguyên

Operator này chạy trọn trên profile `sonnet` (`claude-sonnet-5`, runtime `claude`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: không có. Nó không bao giờ tìm trên mạng, tuân thủ Grammar đã publish, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
