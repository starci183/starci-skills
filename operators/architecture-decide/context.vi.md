# Context cho `architecture.decide`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để quyết một kiến trúc. Nó trả lời câu "operator này được đọc
những gì?" trước khi bất kỳ mục tiêu nào được đề xuất. Context không bao giờ nới rộng mục tiêu, và
không bao giờ để một thứ chỉ vì đang tồn tại mà trở thành một thứ đúng.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Thẩm quyền nghiệp vụ | Lời hứa mà kiến trúc phải giữ. | Bắt buộc. Phân tích kiến trúc phụ thuộc vào nó và không bao giờ thay nó. |
| Source đã route | Checkout đã xác minh và head của nó. | Bắt buộc. Mọi quan sát về hiện trạng đều đến từ đây. |
| Inventory quan sát được | Runtime, framework, lưu trữ, giao tiếp, build, triển khai và quyền sở hữu vận hành được chứng thực bởi manifest, cấu hình và file triển khai. | Bằng chứng bắt buộc. Không bao giờ là đích đến và không bao giờ là lý do biện minh. |
| Pattern kiến trúc | Một pattern tái dùng mà phạm vi có thể bind. | Bằng chứng. Nó gợi ý một hình dạng; nó không chọn hộ. |
| Quyết định trước | Một quyết định cũ trên cùng ranh giới hoặc ranh giới kề. | Bằng chứng và phả hệ. Có thể bị bác, nhưng không được lờ đi. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. ít nhất một tham chiếu thẩm quyền nghiệp vụ;
2. tham chiếu source đã route, với head bằng đúng `input.project.sourceHead`;
3. inventory quan sát được, mỗi thành phần đều gọi tên file chứng thực cho nó.

Đọc source đã route là việc thu thập bằng chứng. Nó không bao giờ là giấy phép để sửa source đó.

## Sự tồn tại sẵn không phải là thẩm quyền

Inventory nói hệ thống hôm nay chạy bằng gì. Đó vừa là phần context hữu ích nhất vừa là phần nguy hiểm
nhất mà operator này nhận được.

Một framework, kho dữ liệu, broker hay hình dạng triển khai đang có đi vào quyết định trong đúng hai
vai: như một ràng buộc đo được mà mục tiêu phải thoả, hoặc như bằng chứng quan sát được về một hành vi
đã được chứng minh. Nó không bao giờ đi vào như một lý do tự thân. Một thành phần được biện minh chỉ vì
nó đã ở đó thì bị từ chối thẳng, vì "chúng ta đang chạy nó rồi" trả lời một câu hỏi mà không ai đặt ra
về tính đúng, quyền sở hữu hay lỗi.

## Điều kiện chính đáng

Phân tích kiến trúc chỉ chính đáng khi có một đánh đổi liên ranh giới thật sự: tính đúng, quyền sở hữu,
tính nhất quán, bảo mật, lỗi, phục hồi, sức chứa, chi phí, độ trễ, di trú hoặc khả năng vận hành. Mục
tiêu gọi tên ít nhất một trục như vậy, và sau đó mọi phương án đều được đánh giá trên tất cả các trục
đã gọi tên. So hai phương án trên các tiêu chí khác nhau chỉ tạo ra một sở thích, không phải một quyết
định.

## Tách bạch ràng buộc

Ràng buộc đến đã được tách thành ý định cố định, ràng buộc đo được, sở thích, giả định và ẩn số. Cần ít
nhất một ý định cố định và một ràng buộc đo được. Không có ràng buộc đo được thì không gì phân biệt một
phương án với một khẩu vị, và về sau không ai bác lại phép so sánh ấy được.

## Ranh giới

Context là chỉ đọc. Operator chỉ ghi receipt của nó, hiện trạng quan sát được, bản so sánh phương án đã
render, mô hình stack và bản phản biện, tất cả dưới `input.project.artifactRootRef`. Nó không sửa source
đã route, không publish thẩm quyền nghiệp vụ, không khởi động hay cấu hình lại dịch vụ runtime, và
không khẳng định rằng một lần hiện thực, một cổng chất lượng hay một lượt UAT đã đạt.
