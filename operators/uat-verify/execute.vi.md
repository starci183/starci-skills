# Thực thi `uat.verify`

## Một việc duy nhất

Kiểm chứng một luồng quyết định sản phẩm dựa trên những input đã đóng băng trước khi thực thi, rồi
công bố cặp snapshot và result chuẩn của nó. Đây là một lần gọi operator tuyến tính. Nó không gọi
operator khác, không định tuyến workflow, không tự dừng giữa chừng, và không trả về chỉ dẫn điều khiển
dạng tự do.

Luồng, các case, danh tính và fixture đều đã quyết xong khi tới đây. Operator chỉ trả lời một câu: sản
phẩm đang chạy có làm đúng điều snapshot đã đóng băng nói nó phải làm hay không, dựa trên bằng chứng
thu được sau thời điểm đóng băng.

## Đóng băng đi trước thực thi

Snapshot được ghi trước và sau đó không bao giờ bị sửa. Nó nêu ý định, các case, những checkpoint bắt
buộc, namespace fixture, và bản ghi tài khoản không chứa bí mật. Result được ghi sau cùng, và nó ràng
fingerprint của snapshot anh em đã được đọc lại.

Thứ tự đó chính là toàn bộ mấu chốt. Ba kiểu hỏng trở nên phát hiện được thay vì vô hình:

1. Một case chạy trước hoặc đúng lúc đóng băng thì không thể tự nhận là đã được snapshot khung lại.
2. Một case chưa từng có trong danh sách đóng băng thì không được xuất hiện trong result.
3. Một lần upsert hay finalize sau hành trình không thể chế tạo ra kết cục kỳ vọng, vì case nào có ghi
   nhận đột biến kiểu đó thì không được phép pass.

Operator không bao giờ sửa sản phẩm để một case pass, và cũng không bao giờ viết lại snapshot cho khớp
với chuyện đã xảy ra.

## Xác thực được cấp tự động, không bao giờ đi xin

Với luồng có đăng nhập, control plane đã tạo sẵn một learner run-scoped mới trong cả Keycloak lẫn
database ứng dụng, đã xác thực một Browser context do broker giữ, và trả về những tham chiếu mờ. Lần
gọi này chỉ tiêu thụ chúng.

Yêu cầu người dùng đăng nhập, mượn tài khoản hay dán credential là điều bị cấm ở mọi nhánh, kể cả nhánh
mà việc cấp phát đã thất bại. Cấp phát không dùng được, provisioner không dùng được, hoặc xác thực qua
broker không dùng được đều trả `PROVISIONING_UNAVAILABLE` dưới dạng `BLOCKED`.

Bản ghi tài khoản đóng băng vào snapshot là một tập trường đóng và không chứa bí mật. Mật khẩu, cookie,
token hay OTP không có chỗ nào để đi, nên việc giữ credential là một hình dạng chứ không phải một kỷ
luật.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Kiểm tra input và resume | input, receipt trước đó, source head đã đóng băng, lease | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Xác nhận giấy phép vào | blind visual PASS cuối, quality PASS cuối | — | `ADMISSION_MISSING` |
| 3 | Chạy preflight ràng buộc | danh tính tài khoản và fixture, mọi kho vật lý | — | `PROVISIONING_UNAVAILABLE` |
| 4 | Đóng băng snapshot | định nghĩa luồng, schema template của snapshot | `snapshot.json` | `CANONICAL_WRITE_DENIED` |
| 5 | Chuẩn bị fixture | snapshot đã đóng băng, namespace của lần chạy | — | `FIXTURE_VIOLATION` |
| 6 | Chạy các case đã đóng băng theo đúng thứ tự đã khai | thứ tự case đã đóng băng, origin, fingerprint principal, generation runtime và hạn của lease | — | `LEASE_INVALID`, `RUNTIME_UNAVAILABLE` |
| 7 | Chụp theo những khẳng định có tên | khẳng định có tên và bằng chứng runtime trực tiếp nhất hiện có | — | `EVIDENCE_UNAVAILABLE` |
| 8 | Phán ba làn độc lập | bằng chứng behavior, UX và UI, mỗi làn giữ riêng | — | — |
| 9 | Xác minh chỉ đọc, rồi dọn dẹp | các bản ghi mang cả `is_uat=true` lẫn namespace đã đóng băng | — | — |
| 10 | Công bố rồi dừng | tất cả những gì ở trên | `result.json` | — |

Khâu kiểm tra từ chối source head cũ, danh tính đã đăng nhập mà thiếu lease, lease ràng vào principal,
mission, generation, origin hay flow khác, thứ tự case không liên tục, và resume không đổi gì. UAT sản
phẩm chỉ bắt đầu sau khi cả hai giấy phép vào được ràng: những lần chụp hay preflight trước đó chỉ
chuẩn bị bằng chứng thị giác tái dùng được, chúng không phải một lần thực thi và không phải phán
quyết. Preflight chạy trước khi danh tính ngoại vi đầu tiên tồn tại.

Snapshot được ghi tại `.worktrees/uat/<feature>/<flow>/snapshot.json` dưới backend Source đã route,
kiểm với schema template, đọc lại, và lấy fingerprint nội dung; một chuỗi đường dẫn mà không có file
hợp lệ đọc lại được thì không phải snapshot đã đóng băng. Fixture gieo tập nhỏ nhất mang namespace của
lần chạy, đủ để render có nghĩa, rồi dừng trước khi Browser thực thi — không bao giờ tạo ra kết cục
đang kiểm chứng.

Mỗi lúc chỉ một lease đã xác thực hành động trên Browser mà người dùng nhìn thấy. Trước mỗi lần chụp
có đăng nhập, origin, fingerprint principal, generation runtime và hạn của lease đều được kiểm; khi
lệch thì chỉ phần bằng chứng bị ảnh hưởng bị vô hiệu rồi lease được lấy lại, và không bao giờ khởi
động lại API hay frontend để sửa danh tính. Mỗi ảnh chụp chứng minh đúng một khẳng định có tên và được
ghép với bằng chứng runtime trực tiếp nhất hiện có; các checkpoint lối vào, cam kết vật chất, phản hồi
chờ hoặc thất bại vật chất, phục hồi và trạng thái cuối đều đòi ảnh full-viewport, còn ảnh cắt chỉ là
bổ trợ và không bao giờ thay thế được checkpoint bắt buộc.

Behavior, UX và UI không bao giờ được mượn kết luận của nhau: mâu thuẫn giữa chúng là `FAIL`, còn
runtime không dùng được hay một làn không có bằng chứng là `BLOCKED`. Bước xác minh chỉ đọc, không
ghi, và bước dọn dẹp chỉ xoá những bản ghi mang cả `is_uat=true` lẫn đúng namespace đã đóng băng. Khâu
công bố ghi `result.json` bên cạnh snapshot đã kiểm, ràng fingerprint snapshot của nó, đọc lại, rồi
ghi fingerprint nội dung. Trường hợp bị chặn thì không công bố result nào cả.

## Result là phán quyết về một luồng, không phải lệnh sửa

Một result đã công bố ghi lại điều sản phẩm đang chạy đã làm, đối chiếu với một ý định đã đóng băng. Nó
không bao giờ mở quyền ghi lên source, không xếp lại thứ bậc giữa các làn bằng chứng, và không biến một
quan sát UI thành thẩm quyền đè lên Behavior. Nguyên nhân gốc được ghi lại chứ không được sửa ở đây.

Hai nguyên nhân gốc chỉ gộp làm một khi thẩm quyền, chủ sở hữu ngữ nghĩa, cơ chế nhân quả, hành động
sửa cần thiết và ranh giới source đều trùng khớp.

## Thực thi khi resume

Resume bắt đầu lại từ bước kiểm tra, chỉ tái dùng những quan sát còn nguyên fingerprint, và tiêu thụ
đúng phần delta. Resume không thêm được thay đổi nào về giấy phép vào, lease, bằng chứng hay case thì
trả `NO_PROGRESS`. Việc tiếp nối nối thêm vào cùng lần chạy đang giữ lease; một lần chạy bất biến mới
chỉ bắt đầu khi đã chứng minh được tính liên tục đã mất.

## Các đòn tấn công bắt buộc

Operator không được công bố pass khi còn bất kỳ mục nào áp dụng được mà chưa xử lý:

- một case chạy trước hoặc đúng lúc đóng băng, hoặc một case snapshot chưa từng đóng băng;
- một checkpoint bắt buộc chỉ được che bằng ảnh cắt, hoặc một ảnh chụp không nêu khẳng định nào;
- một lần chạy có fixture bị đột biến sau hành trình;
- một làn bất đồng với làn khác, hoặc một làn hoàn toàn không có bằng chứng;
- bộ chọn dọn dẹp thiếu cờ UAT hoặc thiếu đúng namespace;
- còn một phát hiện cứng đang mở;
- một result có binding snapshot không bằng snapshot anh em đã đọc lại.
