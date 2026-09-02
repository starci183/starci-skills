# Output của `release.deploy`

Operator trả về đúng một vỏ đóng với `outcome` bằng `deployed`, `rolled-back` hoặc `blocked`. Nó không
bao giờ phát ra handoff hay chỉ dẫn định tuyến dạng tự do.

## Receipt đã triển khai

Một receipt `deployed` chứa:

- các binding chính xác về project, release, artifact, digest, source head, target, môi trường, chiến
  lược, release bị thay thế, cho phép, manifest, ý định, cửa sổ, deadline, input và tiến độ;
- những handle credential đã phân giải, chỉ dưới dạng tên;
- các mã probe đã khai;
- một bản ghi cho mỗi bước đã chạy, kèm trạng thái, revision quan sát được của chính ranh giới nó sở
  hữu trước và sau, lời phát biểu, và bằng chứng;
- chuỗi giám sát: deadline, thời gian đã trôi, backoff, mọi lần quan sát, và điều kiện cuối;
- trạng thái ổn định đã được chứng minh;
- các phát hiện, gồm cả mọi no-op bất biến.

## Receipt đã rollback

Một receipt `rolled-back` là một điểm cuối của riêng nó. Nó mang bản ghi rollback nêu release được
khôi phục, digest của nó, revision trước và sau, ranh giới dữ liệu được giữ nguyên, và thời điểm xác
minh. Nó không bao giờ mang trạng thái ổn định cho release mà nó vừa từ chối, và tuyệt đối không được
đọc như một lần giao hàng thành công của release đó.

## Receipt bị chặn

Receipt bị chặn không khai trạng thái ổn định nào. Nó mang đúng một thất bại có kiểu, các bước và tham
chiếu liên quan, miền sở hữu, khả năng thử lại, và chỉ khi thử lại được mới kèm một token resume dùng
một lần cùng phần vật liệu bắt buộc phải thêm.

## Các bước và revision

Một bước hoặc làm thay đổi một ranh giới, hoặc không.

| Loại | Các bước | Revision |
| --- | --- | --- |
| Thay đổi | `host-prepare`, `artifact-publish`, `migrate`, `domain-reconcile`, `rollout`, `recover`, `rollback` | Bắt buộc cả trước lẫn sau |
| Chỉ đọc | `authorize`, `manifest-validate`, `plan`, `execution-root-init`, `credential-resolve`, `artifact-build`, `monitor`, `proof` | Bị cấm |

Mọi tác động đều là compare-and-set. Bước thay đổi ở trạng thái `applied` phải đã dịch chuyển revision
của nó; bước báo `no-op` hay `skipped` thì không được dịch chuyển. Một bước chỉ đọc mà ghi revision là
đã bịa ra một sự thật về ranh giới nó chưa từng chạm.

## Credential

`credentialRefs` chỉ chứa các handle `secret-ref://`, không gì khác. Không có trường nào trong receipt
nhận một giá trị credential, nên "đừng bao giờ log bí mật" là một hình dạng chứ không phải một kỷ luật:
một token viết vào chỗ của handle sẽ bị loại như dữ liệu hỏng.

## Mã thất bại

| Mã | Vấn đề sở hữu | Delta vật liệu hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | Input đã sửa. |
| `AUTHORIZATION_MISSING` | Không giấy phép đã khai nào phủ project, môi trường, target hay hành động này. | Giấy phép đã khai. |
| `MANIFEST_INVALID` | Manifest đã kiểm bị ghim vào release khác. | Manifest kiểm đúng release này. |
| `ARTIFACT_MISSING` | Không phân giải được digest bất biến. | Artifact đã publish ở đúng digest đó. |
| `CREDENTIAL_UNAVAILABLE` | Một handle đã khai không phân giải được qua custody sẵn có. | Khôi phục custody, không bao giờ là một giá trị nhúng thẳng. |
| `HOST_UNAVAILABLE` | Không chuẩn bị được host đã khai. | Một host chạm tới được và đã chuẩn bị. |
| `MIGRATION_BLOCKED` | Không áp được migration đã khai một cách an toàn. | Ranh giới migration đã được duyệt. |
| `DOMAIN_UNRECONCILED` | Không đưa được trạng thái domain hay TLS về đúng khai báo. | Trạng thái provider hoặc thẩm quyền provider. |
| `ROLLOUT_FAILED` | Rollout không đặt được release lên target. | Target hoặc kế hoạch đã sửa. |
| `STEADY_STATE_UNPROVEN` | Cửa sổ chưa từng khép lại trước deadline có chặn. | Một chuỗi quan sát mới sau khi target hồi lại. |
| `CONCURRENT_DRIFT` | Một release không phải cái này cũng không phải cái tiền nhiệm đã lên chạy. | Lập kế hoạch lại theo trạng thái quan sát mới. |
| `RECOVERY_EXHAUSTED` | Đã cạn những hành động thuận nghịch được duyệt. | Thẩm quyền rollback, hoặc phê duyệt cho một hành động không an toàn. |
| `ROLLBACK_IDENTITY_MISSING` | Cần rollback nhưng đúng release an toàn đó không còn. | Một release an toàn được khôi phục. |
| `APPROVAL_REQUIRED` | Mất mát không hồi lại, xoay vòng, hoặc host, domain, tenant, project mới. | Một quyết định phê duyệt nằm ngoài operator này. |
| `NO_PROGRESS` | Một resume không thêm delta hữu hiệu nào. | Cho phép, manifest, credential hay quan sát thật sự mới. |

## Bất biến liên trường

- `outcome` bằng `receipt.status`, và `handoff` luôn là `null`.
- Mỗi bước xuất hiện nhiều nhất một lần. Bước thay đổi ghi cả hai revision còn bước chỉ đọc không ghi
  cái nào; `applied` dịch chuyển revision còn `no-op` hay `skipped` thì không.
- Bất kỳ release quan sát được nào không phải release đã ràng cũng không phải release nó thay thế đều
  ép kết cục thành `blocked` với `CONCURRENT_DRIFT`, và cấm cả phục hồi lẫn rollback trong receipt đó.
- Giám sát tuân đúng deadline đã ràng, tiến theo thời gian, và báo `deadline-exceeded` khi chạy quá.
  Điều kiện cuối `steady` đòi lần quan sát cuối cùng phải là steady.
- Trạng thái ổn định đòi có giám sát, điều kiện cuối là steady, digest đang chạy bằng digest đã ràng,
  mọi target đã khai đều sẵn sàng, không target bị thay thế nào còn hoạt động ngoài `blue-green`, cửa
  sổ đã trôi ít nhất bằng cửa sổ đã ràng, và mọi probe đã khai đều pass.
- `branch: "none"` cấm phục hồi và rollback; `recover` đòi bản ghi phục hồi; `rollback` đòi bản ghi
  rollback, và một bản ghi rollback đòi nhánh rollback.
- Một bản ghi phục hồi đòi ít nhất hai lần quan sát thất bại, đánh số các lần thử liên tục từ một, chỉ
  hành động lên đúng danh tính release đã ràng, và bị coi là cạn kiệt khi mọi lần thử đều thất bại.
- Phục hồi đã cạn kiệt không thể kết thúc bằng một lần triển khai thành công.
- `deployed` đòi trạng thái ổn định, giám sát, một bước rollout không thất bại, một bước monitor, không
  rollback, không thất bại, không resume, và giấy phép đã khai nằm trong bằng chứng.
- `rolled-back` đòi nhánh rollback, một bước rollback đã applied, release và digest khôi phục khác với
  cái bị từ chối, một revision đã dịch chuyển, và không trạng thái ổn định, thất bại hay resume nào.
- `blocked` đòi đúng một thất bại có kiểu và không trạng thái ổn định. Thất bại thử lại được thì đòi
  resume; thất bại không thử lại được thì cấm resume.

## Kết cục thực tế

Triển khai API production: host vốn đã chuẩn bị nên ghi một no-op, digest được publish đúng một lần,
một migration cộng thêm được áp, domain không đổi, cú đẩy `main` dời target từ revision 4 sang 5, giám
sát theo dõi trong chín phút trong lúc boot hoàn tất, probe typename và probe landing đều trả `200`
suốt một cửa sổ năm phút, và receipt trả `deployed`.

Triển khai cùng release đó lên một target không bao giờ hồi: hai hành động thuận nghịch đã duyệt được
lặp lại và đều thất bại, release trước được khôi phục từ đúng digest của nó với ranh giới dữ liệu giữ
nguyên, và receipt trả `rolled-back` — một điểm cuối, không bao giờ là một lần giao hàng.
