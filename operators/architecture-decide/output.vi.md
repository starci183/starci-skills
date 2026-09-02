# Output của `architecture.decide`

Operator trả về một vỏ đóng với `outcome` bằng `decided` hoặc `blocked`. Nó không bao giờ phát ra đối
tượng handoff hay chỉ dẫn điều phối dạng văn xuôi tự do.

## Receipt khi decided

Một receipt đã decided chứa:

- các binding chính xác về project, source, gốc artifact, quyết định, mục tiêu, trục đánh đổi, chính
  sách chọn, nghiệp vụ, inventory, ràng buộc, hiện trạng, input và tiến độ;
- hiện trạng quan sát được, fingerprint của nó, head mà nó được quan sát tại đó, và các ranh giới đang
  tồn tại hôm nay;
- hai đến bốn phương án, một cái được chọn và ít nhất một cái bị bác kèm lý do, mỗi cái được đánh giá
  trên mọi trục đã gọi tên, cùng artifact so sánh đã render;
- các ranh giới đích kèm trách nhiệm, chủ sở hữu, giao diện và câu trả lời về dữ liệu;
- mô hình quyền sở hữu dữ liệu: mỗi kho một dòng với ranh giới sở hữu, người ghi, người đọc, người di
  trú, phạm vi giao dịch, sao lưu và phục hồi;
- mô hình stack: mỗi thành phần một dòng với trạng thái, loại lý do biện minh, bằng chứng, và khả năng
  tương thích đã kiểm chứng trên cả năm trục;
- bản phản biện độc lập, người rà soát, và mỗi đường bất lợi một đòn tấn công vào phương án đã chọn;
- handoff đã đóng băng: bất biến, rủi ro, hợp đồng bị ảnh hưởng, di trú và quay lui, kỳ vọng chứng
  minh, và các ẩn số.

Receipt cho phép công việc backend và nền tảng bắt đầu dựa trên một quyết định đã đóng băng. Nó không
chứng minh rằng bất cứ thứ gì đã được xây, và không mang phán quyết nào về phần hiện thực.

## Các phương án

Một phương án chỉ được tính khi nó khác về chất — khác về quyền sở hữu hoặc cơ chế, không phải khác câu
chữ — và chỉ khi nó được đánh giá đúng trên các trục mà mục tiêu đã gọi tên.

Đúng một phương án `selected`; ít nhất một phương án `rejected` và nêu vì sao. Một lần bác không kèm lý
do chỉ ghi lại một sở thích. Một bảng so sánh mà một lựa chọn bị chấm trên ít trục hơn lựa chọn khác
thì không chứng minh được gì, và bị từ chối.

## Quyền sở hữu dữ liệu

Mỗi ranh giới khai nó có sở hữu dữ liệu hay không. Ranh giới khai có thì sở hữu ít nhất một kho; ranh
giới khai không thì sở hữu đúng con số không.

Mỗi kho gọi tên đúng một ranh giới sở hữu, và ranh giới đó phải nằm trong số những người ghi. Người ghi
thứ hai được phép, nhưng chỉ kèm một biện minh chia sẻ ghi tường minh, vì một lần chia sẻ ghi không
biện minh chính là cách một kho rốt cuộc không còn chủ thật nào.

## Phản biện độc lập

Bản phản biện là một lần thực thi mới trên đúng profile của operator này, không thừa hưởng lượt nào,
chỉ được đưa các artifact cùng những khẳng định trong đó và không bao giờ được đưa lý lẽ của tác giả.
Nó tấn công đúng phương án đã được chọn dưới cả tám đường bất lợi: lỗi bộ phận, thử lại và tính bất biến khi lặp, tương tranh, trạng
thái cũ, xoá, phục hồi, phụ thuộc ngoài chết, và quay lui.

Các đòn nhắm vào những phương án đã bị bác được chấp nhận như bối cảnh nhưng không thoả yêu cầu. Kể lại
vì sao các phương án thua thì không phải là rà soát phương án thắng.

## Receipt khi blocked

Receipt đã blocked không có quyết định. Nó chứa đúng một failure có kiểu, các tham chiếu liên quan,
domain sở hữu, tính lặp lại được, và chỉ khi lặp lại được thì mới có token resume dùng một lần kèm phần
delta vật chất cần bổ sung và những phương án ứng viên còn sống sót.

## Mã lỗi

| Mã | Vấn đề sở hữu | Delta vật chất hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | Input đã sửa. |
| `SOURCE_DRIFT` | Source quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `CURRENT_STATE_UNOBSERVED` | Không đọc được hệ thống hôm nay tại head đã đóng băng. | Một quan sát source đọc được. |
| `BUSINESS_AUTHORITY_REQUIRED` | Lời hứa mà kiến trúc phải giữ đang thiếu hoặc đã cũ. | Head nghiệp vụ đã publish. |
| `EVIDENCE_MISSING` | Một khẳng định về hệ thống không có file nào đứng sau. | Bằng chứng quan sát được. |
| `CONSTRAINT_CONTRADICTION` | Hai ràng buộc cố định không thể cùng đúng. | Phán quyết của chủ sở hữu. |
| `NO_VIABLE_ALTERNATIVE` | Không gì sống sót qua các ràng buộc đã đóng băng. | Một ràng buộc nới ra, hoặc một phương án mới. |
| `CHOICE_REQUIRED` | Chủ sở hữu phải chọn: nhiều phương án vẫn ngang sức, hoặc chính sách cần phê duyệt mà chưa bind phê duyệt nào. | Lựa chọn của chủ sở hữu về một ứng viên được gọi tên. |
| `COMPATIBILITY_UNVERIFIED` | Một thành phần giữ lại không có bằng chứng tương thích. | Lần kiểm tương thích và bằng chứng của nó. |
| `DATA_OWNERSHIP_UNASSIGNED` | Một kho không có ranh giới sở hữu. | Quyết định về quyền sở hữu. |
| `CRITIQUE_UNRESOLVED` | Một đòn tấn công vào kiến trúc đã chọn chưa có cách xử lý. | Cách xử lý, hoặc một lựa chọn khác. |
| `NO_PROGRESS` | Một resume không thêm delta hữu hiệu nào. | Bằng chứng, ràng buộc, inventory hay phê duyệt thật sự mới. |

`CHOICE_REQUIRED` là kết quả đúng khi hai thiết kế thật sự khác nhau và không cái nào áp đảo, và cũng
đúng khi một chính sách `approval-required` chưa có phê duyệt nào được bind. Chúng gộp làm một mã vì
cả hai đều thiếu đúng một thứ: lựa chọn của chủ sở hữu. Thông điệp của nó gọi tên các ứng viên, phần
resume mang chúng trong `candidateAlternativeIds`, nó thuộc thẩm quyền sản phẩm, và quyết lại sau khi
lựa chọn được bind là bước tiếp theo đúng đắn.

## Bất biến liên trường

- `outcome="decided"` đòi `receipt.status="decided"`, quyết định khác null, `failure` null, `resume`
  null, và không còn finding mức lỗi nào mở.
- `outcome="blocked"` đòi `receipt.status="blocked"`, quyết định null, và một failure có kiểu. Failure
  lặp lại được thì cần resume; failure không lặp lại được thì cấm có resume.
- `receipt.evidenceRefs` và `output.evidenceRefs` là cùng một tập, và mọi tham chiếu artifact đều nằm
  dưới `artifactRootRef`.
- Hiện trạng được quan sát tại `binding.sourceHead`, và `binding.currentStateFingerprint` bằng đúng
  fingerprint của nó.
- Artifact so sánh là một trang HTML kiểm tra được, và bản so sánh, hiện trạng, mô hình stack cùng bản
  phản biện đều được đăng ký trong `artifactRefs`.
- Đúng một phương án được chọn và bằng `selectedAlternativeId`; ít nhất một phương án bị bác kèm lý do;
  phương án được chọn không mang lý do bác; mọi phương án được đánh giá đúng trên các trục đánh đổi đã
  bind, mỗi trục một lần.
- Với `approval-required`, phương án được chọn bằng phương án đã duyệt; với `automatic`, không có
  phương án duyệt nào được bind.
- Mã ranh giới và mã kho là duy nhất; mọi ranh giới được kho nhắc tới đều tồn tại; ranh giới sở hữu ghi
  vào kho của nó; hơn một người ghi thì cần biện minh chia sẻ ghi, và đúng một người ghi thì cấm có nó;
  ranh giới sở hữu dữ liệu thì sở hữu một kho, và ranh giới không sở hữu dữ liệu thì không sở hữu kho
  nào.
- Mọi mã thành phần stack là duy nhất; không cái nào được biện minh bằng sự tồn tại sẵn; thành phần giữ
  lại đã được kiểm chứng trên cả năm trục tương thích kèm bằng chứng; thành phần bị gỡ không mang phán
  quyết nào.
- Bản phản biện mang tham chiếu thực thi của riêng nó chứ không phải của tác giả, mọi đòn tấn công gọi tên một phương án đã biết, và cả tám
  đường bất lợi đều tấn công phương án được chọn.
- Một thất bại `CHOICE_REQUIRED` gọi tên ít nhất một ứng viên còn sống trong `resume.candidateAlternativeIds`.
- Không tham chiếu hợp đồng bị ảnh hưởng nào gọi tên một file hiện thực.
- `handoff` luôn là `null`.

## Kết quả thực tế

Quyết một đường đọc quyền lợi: hiện trạng ghi lại ba ranh giới cùng tự suy ra một câu trả lời một cách
độc lập, ba phương án được so trên tính đúng, tính nhất quán, khả năng vận hành, độ trễ và di trú,
phương án ranh giới chung được chọn còn chốt chặn theo từng tính năng và claim cache ở biên bị bác kèm
lý do, kho quyền lợi có đúng một người ghi sở hữu trong khi sổ tất toán giữ người ghi thứ hai đã được
biện minh, phần bắt thay đổi được thêm vào với tương thích đã kiểm chứng, cache bị gỡ không mang phán
quyết nào, và bản phản biện tấn công ranh giới được chọn dưới cả tám đường bất lợi.

Quyết cùng mục tiêu đó khi hai phương án cùng sống sót qua các ràng buộc: lần gọi trả về
`CHOICE_REQUIRED` kèm cả hai ứng viên được gọi tên trong thông điệp và bản so sánh đã render, và không
ranh giới, kho hay thành phần nào được bind.
