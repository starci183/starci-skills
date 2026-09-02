# Output của `uat.verify`

Operator trả về đúng một vỏ đóng với `outcome` bằng `passed`, `failed` hoặc `blocked`. Nó không bao giờ
phát ra handoff hay chỉ dẫn định tuyến dạng tự do.

## Receipt đã có phán quyết

Một receipt `passed` hoặc `failed` chứa:

- các binding chính xác về project, backend source, source head, feature, flow, lần chạy, giao thức,
  template, runtime, giấy phép vào, input và tiến độ;
- phần đóng băng: tham chiếu snapshot chuẩn, fingerprint nội dung của nó, thời điểm đóng băng,
  namespace fixture, bản ghi danh tính không chứa bí mật, và các case đã đóng băng kèm checkpoint bắt
  buộc của chúng;
- phần công bố: tham chiếu result chuẩn, fingerprint nội dung của nó, fingerprint snapshot mà nó ràng,
  và phán quyết đã công bố;
- một phán quyết độc lập cho từng làn Behavior, UX và UI;
- một kết quả cho mỗi case đã đóng băng, kèm thời điểm chạy, các ảnh chụp, và việc có đột biến sau hành
  trình nào chạm vào lần chạy hay không;
- bản ghi dọn dẹp có phạm vi và mọi phát hiện.

Receipt bị chặn thì không công bố gì. Nó mang đúng một thất bại có kiểu, các case và tham chiếu liên
quan, miền sở hữu, khả năng thử lại, và chỉ khi thử lại được mới kèm một token resume dùng một lần cùng
phần vật liệu bắt buộc phải thêm.

## Bản ghi tài khoản không thể chứa bí mật

Bản ghi danh tính đóng băng vào snapshot là đóng, và mọi trường đều bị ràng buộc:

| Trường | Hình dạng |
| --- | --- |
| `accountRef` | `account://fresh/...` |
| `provisioningMode` | hằng `control-panel-auto-create` |
| `provisioningOwnerRef` | `control-panel://...` |
| `identityRecordRef` | `keycloak-user://...` |
| `applicationRecordRef` | `database-user://...` |
| `principalFingerprint` | một fingerprint `sha256:` |
| `fixtureNamespace` | một namespace mang tiền tố `uat-` |
| `credentialCustody` | hằng `control-panel-ephemeral` |
| `state` | hằng `authenticated` |

Không có chuỗi tự do nào trong bản ghi và không thuộc tính phụ nào được chấp nhận, nên mật khẩu,
cookie, token hay OTP không thể đặt vào đó. Luật này được thi hành bằng hình dạng chứ không bằng rà
soát, và đó là lý do một trường `password` được thêm vào bị loại thẳng như bản ghi không hợp lệ, thay
vì chỉ bị đánh dấu như một phát hiện.

## Các phán quyết

| Kết cục | Ý nghĩa | Công bố |
| --- | --- | --- |
| `passed` | Mọi case đã đóng băng đều pass và cả ba làn đồng thuận. | Có ghi `result.json` |
| `failed` | Ít nhất một làn mâu thuẫn với kỳ vọng đã đóng băng. | Có ghi `result.json` |
| `blocked` | Runtime, bằng chứng, cấp phát hoặc quyền ghi file chuẩn không dùng được. | Không ghi gì |

Mâu thuẫn là `FAIL`, còn không dùng được là `BLOCKED`. Hai thứ này không bao giờ được đổi chỗ cho nhau:
tính việc không dùng được thành thất bại là đổ lỗi cho một sản phẩm chưa ai quan sát, còn kể một mâu
thuẫn thành bị chặn là che đi một khiếm khuyết có thật.

## Mã thất bại

| Mã | Vấn đề sở hữu | Delta vật liệu hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | Input đã sửa. |
| `SOURCE_DRIFT` | Head backend quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `ADMISSION_MISSING` | Thiếu blind visual PASS hoặc quality PASS cuối. | Receipt cho phép vào còn thiếu. |
| `PROVISIONING_UNAVAILABLE` | Control plane không tạo hoặc không xác thực được danh tính run-scoped. | Khôi phục việc cấp phát, không bao giờ là một lần đăng nhập của người dùng. |
| `LEASE_INVALID` | Lease hết hạn, lạ, chưa xác thực, hoặc ràng vào principal khác. | Lease lấy lại. |
| `RUNTIME_UNAVAILABLE` | Runtime owner đã khai chưa sẵn sàng hoặc origin không khớp. | Một owner sẵn sàng từ task runtime. |
| `EVIDENCE_UNAVAILABLE` | Một làn không sinh ra bằng chứng nào để phán. | Phụ thuộc được khôi phục và chạy lại case đã đóng băng. |
| `FIXTURE_VIOLATION` | Không thoả được preflight, namespace hoặc phạm vi dọn dẹp. | Ranh giới fixture đã sửa. |
| `CANONICAL_WRITE_DENIED` | Không ghi và đọc lại được cặp file chuẩn dưới Source đã route. | Khôi phục quyền ghi trên backend Source đã route. |
| `NO_PROGRESS` | Một resume không thêm delta hữu hiệu nào. | Giấy phép vào, lease, bằng chứng hay case thật sự mới. |

`REQUIRE_USER_ACTION` cố ý vắng mặt khỏi danh sách này. Việc xác thực UAT cục bộ thông thường hoặc được
cấp tự động, hoặc bị chặn; nó không bao giờ là một lời thỉnh cầu.

## Bất biến liên trường

- `outcome` bằng `receipt.status`.
- `passed` và `failed` đòi có phần công bố, `failure` rỗng và `resume` rỗng; phán quyết công bố bằng
  đúng kết cục.
- `blocked` đòi phần công bố rỗng và đúng một thất bại có kiểu. Thất bại thử lại được thì đòi resume;
  thất bại không thử lại được thì cấm resume.
- Phần công bố đòi phải có phần đóng băng, ràng đúng fingerprint snapshot của phần đó, và trỏ vào cùng
  thư mục feature/flow chuẩn.
- Đường dẫn snapshot chuẩn bằng đúng feature và flow đã ràng, và `artifactRefs` đăng ký cả hai file
  chuẩn.
- Receipt đã có phán quyết mang đúng một phán quyết cho mỗi làn Behavior, UX và UI.
- Bất kỳ làn nào `fail` đều ép kết cục thành `failed`; bất kỳ làn nào `unavailable` đều ép thành
  `blocked`.
- `passed` đòi mọi làn pass và mọi case đã đóng băng pass.
- Mọi kết quả case đều gọi tên một case đã đóng băng, giữ đúng thứ tự đã đóng băng, và chạy sau thời
  điểm đóng băng một cách nghiêm ngặt.
- Các lần chạy case xếp thứ tự nghiêm ngặt theo thời gian, vì mỗi lúc chỉ một lease đã xác thực hành
  động.
- Case nào có ghi nhận đột biến sau hành trình thì không được pass.
- Mọi ảnh chụp đều nêu một khẳng định, và mọi checkpoint bắt buộc của một case pass đều được che bằng
  ảnh full-viewport.
- `passed` đòi đã dọn dẹp, với bộ chọn mang `is_uat=true` và đúng namespace đã đóng băng.
- `passed` cấm còn phát hiện cứng đang mở và đòi cả hai receipt cho phép vào nằm trong bằng chứng.
- `handoff` luôn là `null`.

## Kết cục thực tế

Kiểm chứng luồng ghi danh trả phí: hai case đã đóng băng chạy đúng thứ tự sau thời điểm đóng băng, các
checkpoint lối vào, cam kết, phản hồi, phục hồi và trạng thái cuối đều có ảnh full-viewport ghép với
bằng chứng runtime, cả ba làn pass, dọn dẹp chỉ xoá những bản ghi `is_uat` của lần chạy, và
`result.json` công bố `passed` ràng vào fingerprint của snapshot.

Kiểm chứng cùng luồng đó khi sandbox thanh toán chết: case bị từ chối thẻ không sinh ra bằng chứng
runtime nào, làn UX là `unavailable`, không có gì được công bố, và receipt trả `EVIDENCE_UNAVAILABLE`
kèm một resume nêu đúng phụ thuộc cần khôi phục.
