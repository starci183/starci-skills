# Execute `platform.operate`

## Một việc duy nhất

Đưa đúng một dịch vụ observability, Sonar hoặc tunnel dùng chung về trạng thái đã duyệt và chứng minh
kết quả. Đây là một lần gọi operator tuyến tính. Nó không gọi operator khác, không điều phối workflow,
không tự dừng giữa chừng, và không phát ra chỉ dẫn điều khiển dạng văn xuôi tự do.

Ở hình dạng v7, việc này bị chia cho `observability-reconcile`, `sonar-service-reconcile`,
`tunnel-plan` và `tunnel-apply`. Nay chúng là các bước và các nhánh bên trong một trình tự thực thi
duy nhất. Lập kế hoạch không còn là operator riêng: plan được suy ra từ inventory ngay trong cùng
lượt áp dụng nó, và chính plan hash đã duyệt làm cho điều đó an toàn.

## Hạ tầng dùng chung, không phải product

Operator này phục vụ hạ tầng dùng chung và không bao giờ nhận quyền deploy product. Nó không có
effect deploy nào để với tới, và tập resource duy nhất nó chạm được là những gì inventory đã bind
liệt kê dưới đúng loại dịch vụ. Yêu cầu restart một dịch vụ product để dọn chỗ cho dịch vụ dùng chung
sẽ đi ra qua finding `PRODUCT_DEPLOYMENT_DECLINED`, không qua một mutation.

## Kiểm kê trước khi đổi

Một dịch vụ dùng chung phải được kiểm kê trước khi bị thay đổi. Inventory bị ràng bằng fingerprint,
và receipt nhắc lại đúng những resource đã được kiểm kê. Bất cứ thứ gì bị thay đổi đều phải có trong
phần nhắc lại đó, nên một thay đổi lên resource chưa ai nhìn tới trước thì không thể được báo cáo như
một lần vận hành.

## Cổng bận là một phát hiện cần phối hợp

Một cổng đã bị tiến trình khác giữ là sự thật về một máy dùng chung, không phải giấy phép đòi lại nó.
Lần vận hành ghi `PORT_COORDINATION_REQUIRED` gọi tên cả cổng lẫn tiến trình đang giữ, trả về
`PORT_CONFLICT`, rồi dừng. Nó không dừng, không kill, không restart và không cấu hình lại tiến trình
đang giữ; output contract từ chối mọi mutation nhắm vào một tiến trình đã bị quan sát là đang giữ cổng
được claim.

Phối hợp là bước tiếp theo bắt buộc, và nó thuộc về hai chủ sở hữu chứ không thuộc lần gọi này.

## Credential được resolve, không được ghi lại

Credential đứng sau một capability handle được resolve để dùng ngay tại lúc gọi, và không bao giờ bị
log, bị chép vào bằng chứng hay bị lưu lại. Receipt từ chối cả handle lẫn giá trị: receipt là bản ghi
lâu dài, và một bản ghi lâu dài của capability chính là credential bị lộ có độ trễ.

## Trình tự thực thi

1. **Validate input và resume.** Áp `input.schema.json` cùng validate ngữ nghĩa. Từ chối binding
   source cũ, effect hay check xếp nhầm nhánh, bộ chứng minh bị thu hẹp, resource chưa kiểm kê,
   capability còn thiếu, vật liệu credential lọt vào contract, và tiến độ không đổi.
2. **Bind authority.** Bind knowledge record của nhánh, phê duyệt cùng plan hash, từng capability
   handle kèm bằng chứng custody, fingerprint của inventory, và source head đã route.
3. **Kiểm lại inventory.** Quan sát lại các resource đã khai đúng một lượt. Revision khác với
   inventory đã bind là `INVENTORY_DRIFT` và dừng lần gọi trước mọi thay đổi.
4. **Xử lý các claim cổng.** Đối chiếu từng cổng được claim với những tiến trình đang giữ. Xung đột
   thành finding phối hợp cùng `PORT_CONFLICT`; cổng rảnh thì được effect cần nó bind bình thường.
5. **Suy ra delta.** So mong muốn với quan sát và chỉ giữ những effect còn thật sự cần. Một dịch vụ
   đã hội tụ sẵn là một no-op đã được chứng minh, không mutation nào cả, không phải lỗi và cũng không
   phải cớ để viết lại.
6. **Áp delta đã duyệt.** Chỉ áp các effect nằm trong tập đã duyệt, mỗi lần một resource, ghi revision
   trước và sau của từng cái. Áp dở dang được báo cáo bằng `PARTIAL_MUTATION` kèm revision chính xác;
   nó không bao giờ bị giấu sau một blocker chung chung.
7. **Chứng minh mọi check bắt buộc.** Đọc lại dịch vụ và chạy trọn bộ chứng minh của nhánh. Một check
   thiếu, không đọc được hoặc thất bại thì không thể kết thúc bằng kết quả đã vận hành.
8. **Phát ra rồi dừng.** Ghi receipt dưới `input.project.artifactRootRef`, phát đúng một output theo
   `output.schema.json`, và ràng mọi fingerprint. Không claim sự sẵn sàng của product, không claim
   phê duyệt release hay bằng chứng UAT.

## Resume

Một lần resume bắt đầu lại từ validate, chỉ tái dùng những quan sát có fingerprint không đổi, và tiêu
thụ đúng phần delta. Resume không thêm thay đổi nào về thẩm quyền, inventory, desired state hay phạm
vi thì trả về `NO_PROGRESS`. Inventory quan sát lại phải đến dưới một fingerprint mới; cùng một
fingerprint không thể cho ra câu trả lời khác.

## Những đòn phải tự đánh

Lần vận hành không được báo cáo là đã vận hành khi còn bất kỳ mục nào áp dụng được mà chưa giải quyết:

- một resource bị thay đổi mà phần nhắc lại inventory không chứa;
- một effect đã áp nằm ngoài tập đã duyệt hoặc ngoài nhánh;
- một check bắt buộc thiếu, không đọc được, hoặc thất bại;
- một cổng được claim đang bị tiến trình khác giữ mà không finding nào gọi tên người giữ;
- một mutation nhắm vào tiến trình đã bị quan sát là đang giữ cổng được claim;
- một capability handle hay chuỗi có hình dạng credential xuất hiện ở bất kỳ đâu trong receipt;
- một lần áp dở dang được báo cáo mà thiếu một trong hai revision.
