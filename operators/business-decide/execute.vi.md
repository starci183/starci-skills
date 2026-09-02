# Thực thi `business.decide`

## Một việc duy nhất

Biến một tập bằng chứng có ranh giới thành một lời hứa nghiệp vụ được publish mà phần thực thi của nó
đã được định đoạt trọn vẹn. Đây là một lần gọi operator tuyến tính. Nó không gọi operator khác, không
điều phối workflow, không tự dừng giữa chừng, và không trả về chỉ dẫn điều khiển dạng văn xuôi tự do.

Năm chặng của v7 — chuẩn hoá bằng chứng, mô hình hoá feature, kiểm tra head còn mới hay đã cũ, publish
head, và đối chiếu source đã giao — là các bước bên trong trình tự dưới đây, không phải các operator
riêng.

## Không có lời hứa nào thiếu coverage

Một lời hứa chỉ publish được khi cả mười tám chiều coverage đều mang đúng một disposition, và mọi
consumer cùng nhánh vòng đời mà người gọi tìm ra đều được định đoạt đích danh.

Luật đó tồn tại vì "full access" từng được mô hình hoá, hiện thực và publish trong khi các consumer
phía sau — khoá học, cộng đồng, blog, AI, phỏng vấn thử, bán hàng di sản, hạn mức, tất toán, gia hạn,
huỷ và phục hồi — chưa được chứng minh đầy đủ. Lời hứa đúng ở chỗ chào bán và sai ở chỗ chốt chặn. Bốn
điều cấm gánh phần sửa chữa, và mỗi điều đều được cưỡng chế chứ không chỉ khuyên:

1. Một consumer đã tìm thấy mà không có dòng nào trong ma trận là `CONSUMER_UNPROVEN`. Đó không phải
   cảnh báo.
2. Một chiều bắt buộc — chủ thể và điều kiện hưởng, cửa chào bán, cửa đọc, tác dụng phụ khi mua, tất
   toán, tính bất biến khi lặp, consumer của quyền lợi, và đường từ chối — không bao giờ được
   `not-applicable`.
3. Một chiều có nhánh đã quan sát được trong source cũng không bao giờ được `not-applicable`. Nó đã
   được tìm thấy, tức là nó có áp dụng.
4. Một disposition `preserve` hay `replace` mà thiếu bằng chứng phủ định thì bị từ chối. Chỉ bằng chứng
   khẳng định thì chỉ cho thấy lời hứa được cấp, không bao giờ cho thấy nó bị từ chối đúng lúc cần.

Operator không bao giờ bịa ra chủ thể, quyền lợi, hạn mức, thanh toán, tất toán hay hành vi vòng đời.
Phần vật liệu còn thiếu được báo cáo như một failure và trả về cho chủ sở hữu của nó.

## Trình tự thực thi

1. **Kiểm tra input và resume.** Áp `input.schema.json` và kiểm tra ngữ nghĩa. Từ chối binding source
   đã cũ, claim trích tới source không được bind, head không đúng bằng `features/<featureId>` dưới gốc
   businesses, consumer trùng, trạng thái đích không hợp lệ với head quan sát được, và tiến độ không
   đổi.
2. **Chuẩn hoá bằng chứng.** Tách mỗi claim thành fact, intent, example, unknown hay contradiction,
   mỗi cái trích vai trò, đường dẫn, khoảng dòng và head. Một mâu thuẫn chưa giải quyết làm lần gọi
   dừng với `CONTRADICTION_UNRESOLVED`; nó không bao giờ được lấy trung bình cho qua.
3. **Kiểm tra head đã publish.** Đọc head hiện tại của feature và phân loại nó là chưa có, còn mới hay
   đã cũ so với bằng chứng và source head đã đóng băng. Phân loại đó quyết định bước chuyển vòng đời
   nào hợp lệ, và một bước chuyển không hợp lệ là `LIFECYCLE_TRANSITION_INVALID`.
4. **Mô hình hoá lời hứa.** Phát biểu lời hứa, chủ thể của nó và điều kiện hưởng, mỗi thứ một câu, chỉ
   từ các claim loại fact. Claim ý định có thể định hình câu chữ; chúng không bao giờ trở thành sự thực
   thi.
5. **Đóng băng ma trận coverage.** Ghi đúng một dòng cho mỗi chiều. Mỗi dòng nêu disposition, chủ sở
   hữu thực thi, source thực thi, bằng chứng khẳng định và phủ định, các consumer nó định đoạt, và các
   claim đứng sau. Đánh địa chỉ theo nội dung cho ma trận và mang fingerprint của nó vào phần binding,
   để hiện thực backend, tích hợp chất lượng và UAT chứng minh được rằng họ đọc đúng ma trận đó chứ
   không phải một bản diễn giải lại.
6. **Định đoạt phần cùng tồn tại với di sản.** Tạo, đọc và tất toán di sản mỗi thứ chiếm một dòng
   riêng. Một đường bán mới chỉ được khai tử phần tạo di sản khi các quyền đã mua vẫn đọc được và phần
   tất toán di sản còn treo vẫn chạy xong, và việc khai tử phải kèm bằng chứng rằng đường tạo đã đóng.
7. **Đối chiếu khi đích là implemented.** So source đã giao với ma trận đã đóng băng. Mọi sai lệch làm
   lần gọi dừng với `RECONCILIATION_DISCREPANCY`; `implemented` không bao giờ được publish dựa trên
   một bản kế hoạch.
8. **Publish đúng một head.** Ghi `model.json` tại `<businessesRootRef>/features/<featureId>`, lưu
   phiên bản dưới `objects/sha256/`, cập nhật `business-registry-v1.json` và `history/by-id.json`, rồi
   đăng ký head và ma trận vào `artifactRefs`. Việc từ chối giữ lại phả hệ bằng cách gọi tên
   head trước đó thay vì xoá nó đi.
9. **Phát ra và dừng.** Trả về một output đúng `output.schema.json` với mọi fingerprint đã ràng. Không
   khẳng định bằng chứng hiện thực, chất lượng hay UAT.

## Các disposition

| Disposition | Nghĩa | Vật liệu bắt buộc |
| --- | --- | --- |
| `preserve` | Phần thực thi sẵn có được giữ và được chứng minh. | Chủ sở hữu, source, bằng chứng khẳng định, bằng chứng phủ định, một claim fact. |
| `replace` | Phần thực thi đổi và đường mới được chứng minh. | Chủ sở hữu, source, bằng chứng khẳng định, bằng chứng phủ định, một claim fact. |
| `retire` | Đường đi bị đóng có chủ đích. | Chủ sở hữu, source, bằng chứng rằng đường đã đóng, một claim fact. |
| `defer` | Nhánh được hoãn có ý thức cho một chủ sở hữu có tên. | Một tham chiếu hoãn, và tuyệt đối không claim bằng chứng nào. |
| `not-applicable` | Nhánh không thể xảy ra với lời hứa này. | Không gì cả: không chủ sở hữu, không source, không bằng chứng, không consumer, không claim. |

`defer` là một disposition, nên một nhánh được hoãn không chặn việc publish. Thứ chặn việc publish là
sự im lặng. Một dòng hoãn mà vẫn khai bằng chứng thì bị từ chối, vì bằng chứng cho công việc chưa xảy
ra là loại pass giả thuyết phục nhất.

## Thực thi khi resume

Một lần resume bắt đầu lại từ khâu kiểm tra, chỉ tái dùng những quan sát có fingerprint không đổi, và
tiêu thụ đúng phần delta. Một resume không thêm thay đổi nào về bằng chứng, thẩm quyền, discovery hay
phê duyệt sẽ trả về `NO_PROGRESS`. Bằng chứng publish lại phải đến dưới một fingerprint mới; cùng một
fingerprint không thể cho ra câu trả lời khác.

## Các đòn tấn công bắt buộc

Operator không được publish khi còn bất kỳ mục nào áp dụng mà chưa giải quyết:

- một consumer hay nhánh vòng đời đã tìm thấy mà không có disposition;
- một chiều bắt buộc bị đánh dấu không áp dụng;
- một khẳng định thực thi chỉ dựa trên ví dụ, ảnh chụp màn hình hay ý định của chủ sở hữu;
- đường được cấp thì có bằng chứng còn đường từ chối thì không;
- trạng thái được publish đi tới qua một bước chuyển mà vòng đời không cho phép;
- `implemented` được khai trong khi source đã giao còn khác ma trận;
- fingerprint coverage trong phần binding khác với ma trận đã ghi;
- còn một finding mức lỗi đang mở.
