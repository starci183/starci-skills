# Output của `backend.implement`

Operator trả về đúng một phong bì đóng với `outcome` bằng `implemented` hoặc `blocked`. Nó không bao
giờ phát handoff hay chỉ dẫn định tuyến dạng tự do.

## Receipt đã hiện thực

Một receipt đã hiện thực chứa:

- các binding chính xác về project, source, outcome, contract, thẩm quyền, input và tiến độ;
- những operation đã được lấp đầy, mỗi cái nhắc lại các mặt, loại proof và quyết định đã duyệt mà nó
  được ràng vào, để receipt đọc được mà không cần đặt input bên cạnh;
- một bản ghi thay đổi cho mỗi file bị chạm, kèm loại, hash trước, hash sau và operation sở hữu;
- một bản ghi đối chiếu cho mỗi mặt đã khai, nêu tên bằng chứng đã đo nó;
- một bản ghi proof cho mỗi loại proof đã khai, nêu lệnh đã chạy và kết quả nó sinh ra;
- các finding về pattern đã bind, quy ước bị từ chối, snapshot đã kiểm lại và migration được mang theo.

Receipt cho thấy contract đã đóng băng được lấp đầy. Nó không chứng minh rằng bản giao đã sẵn sàng cho
production, và nó không mang phán quyết chất lượng, thị giác hay UAT nào.

## Các thay đổi

| Loại | Hash trước | Hash sau |
| --- | --- | --- |
| `added` | Null | Bắt buộc |
| `modified` | Bắt buộc | Bắt buộc, và phải khác |
| `deleted` | Bắt buộc | Null |

Một bản ghi `modified` mà hai hash bằng nhau đang mô tả một mutation chưa từng xảy ra, nên cặp hash
được đem so chứ không chỉ cần có mặt. Mỗi thay đổi đều nêu operation nó phục vụ, và không file nào xuất
hiện hai lần.

## Đối chiếu

Mỗi mặt đã khai có đúng một bản ghi và một phán quyết:

| Phán quyết | Ý nghĩa | Được phép trong receipt đã hiện thực |
| --- | --- | --- |
| `conforms` | Code làm đúng điều contract nói cho mặt này | Có |
| `widened` | Code với ra ngoài contract | Không |
| `narrowed` | Code giao ít hơn contract | Không |

Mọi bản ghi đều mang `evidenceRef`, kể cả bản ghi đã đạt. Một bản ghi không có bằng chứng chỉ là lời
khẳng định, mà lời khẳng định thì người đọc sau này không phản bác được, và như thế thì việc ghi lại
mất sạch ý nghĩa.

Một mặt đã khai mà không có bản ghi thì bị từ chối. Sự im lặng về một mặt đọc lên y hệt như đã đạt, và
đó là cách rẻ nhất để một contract lặng lẽ không được lấp đầy.

## Các proof

Mỗi loại proof đã khai sinh ra một bản ghi kèm tham chiếu lệnh, tham chiếu kết quả và kết quả của nó.
Cả hai tham chiếu đều bắt buộc: lệnh nói cái gì đã chạy, kết quả nói cái gì trả về, và chỉ một trong
hai thì người chưa chạy gì cũng viết ra được.

Một receipt đã hiện thực đòi mọi proof đều đạt, và `artifactRefs` đăng ký mọi kết quả proof để người
audit mở được mà không phải đi hỏi.

## Receipt khi blocked

Một receipt bị chặn không có phần hiện thực. Nó chứa đúng một failure có kiểu, chính xác những
operation, file và tham chiếu liên quan, miền sở hữu, khả năng thử lại, và chỉ khi thử lại được thì có
thêm một token dùng một lần kèm phần delta vật liệu cần thiết.

## Mã lỗi

| Mã | Vấn đề thuộc về | Delta vật liệu hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Contract input đóng không đạt. | Input đã sửa. |
| `SOURCE_DRIFT` | Source quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `CONTRACT_UNFROZEN` | Contract chưa đóng băng hoặc fingerprint đã cũ. | Contract đã đóng băng. |
| `CONTRACT_WIDENED` | Outcome cần một ranh giới mà contract không mang. | Contract được mở lại và đóng băng lại. |
| `BUSINESS_AUTHORITY_MISSING` | Một câu hỏi nghiệp vụ còn mở và chưa quyết định nào đã duyệt giải quyết. | Quyết định đã duyệt, kèm fingerprint thẩm quyền ràng lại. |
| `OWNER_CONFLICT` | Một file cần sửa nằm ngoài trần được sửa. | Quyền trên file được chỉnh lại. |
| `PATTERN_UNBOUND` | Một khía cạnh bị chạm mà không có họ anh em nào bind cho nó. | Binding pattern còn thiếu. |
| `PROOF_UNAVAILABLE` | Một proof đã khai không chạy được ở đây. | Môi trường chạy proof hoạt động được. |
| `NO_PROGRESS` | Một resume không thêm delta hữu hiệu nào. | Thẩm quyền, contract, pattern hoặc scope mới về mặt vật chất. |

`BUSINESS_AUTHORITY_MISSING` và `CONTRACT_WIDENED` là hai lối ra được trông đợi, không phải khuyết tật.
Cái thứ nhất thuộc về người sở hữu nghiệp vụ, cái thứ hai thuộc về người sở hữu contract, và trong cả
hai trường hợp, hiện thực lại cùng outcome sau khi quyết định được công bố mới là bước tiếp theo đúng.

## Bất biến liên trường

- `outcome="implemented"` đòi `receipt.status="implemented"`, `implementation` khác null, `failure`
  null và `resume` null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `implementation` null và `failure` khác null.
  Một failure thử lại được thì đòi resume; một failure không thử lại được thì cấm resume.
- Mã operation không trùng, và `appliedOperationIds` đúng bằng tập operation đã khai.
- Mỗi thay đổi nêu một operation đã khai, mỗi file xuất hiện một lần, và cặp hash khớp với loại thay
  đổi.
- Mỗi mặt đã khai có đúng một bản ghi đối chiếu, mọi bản ghi đều nhắm vào một mặt đã khai, và mọi phán
  quyết trong receipt đã hiện thực đều là `conforms`.
- Mỗi loại proof đã khai có đúng một bản ghi proof, mọi bản ghi đều nhắm vào một loại đã khai, và mọi
  proof trong receipt đã hiện thực đều đạt.
- `artifactRefs` đăng ký mọi kết quả proof.
- Receipt đã hiện thực không mang finding `BUSINESS_QUESTION_RAISED`, và mọi finding có nêu operation
  đều nêu một operation đã khai.
- `handoff` luôn là `null`.

## Kết quả thực tế

Hiện thực đường đi tới cổng thanh toán cho việc ghi danh khoá học: handler mutation kiểm ma trận năng
lực theo loại thanh toán và từ chối to một tổ hợp trả góp hay voucher không được hỗ trợ trước khi tạo
bất kỳ dòng dữ liệu nào, các bản ghi đối chiếu phủ transport, writer, transaction, idempotency, danh
tính exception và phân quyền, còn proof unit lẫn integration đều chạy và đều đạt.

Hiện thực cùng outcome ấy trong trường hợp thẩm quyền đã duyệt chưa từng quyết voucher phẳng có áp
được trên một cổng ngoại tệ hay không: lần gọi trả `BUSINESS_AUTHORITY_MISSING` nêu đúng câu hỏi đó,
không ghi gì cả, và không nhánh nào được chọn.
