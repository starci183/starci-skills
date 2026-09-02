# Output của `business.decide`

Operator trả về một vỏ đóng với `outcome` bằng `published` hoặc `blocked`. Nó không bao giờ phát ra
handoff hay chỉ dẫn điều phối dạng văn xuôi tự do.

## Receipt khi published

Một receipt đã published chứa:

- các binding chính xác về project, source, gốc thẩm quyền, feature, mục tiêu, bằng chứng, discovery,
  coverage, input và tiến độ;
- lời hứa, chủ thể của nó và điều kiện hưởng, mỗi thứ phát biểu một lần;
- phả hệ: head trước đó, trạng thái trước đó, và bước chuyển được gọi tên;
- mọi claim mà quyết định trích dẫn, kèm loại, vai trò, đường dẫn, khoảng dòng và head;
- tham chiếu ma trận coverage, fingerprint của nó, bề mặt đã tìm thấy mà nó trả lời, và mỗi chiều
  coverage một dòng;
- phần đối chiếu với source đã giao khi trạng thái publish là `implemented`;
- các finding cho phần cùng tồn tại với di sản, các khoản hoãn, và mọi thứ quan sát được nhưng chưa
  được thực thi.

Receipt cho phép hiện thực backend, tích hợp chất lượng và UAT tiêu thụ cùng một fingerprint coverage.
Nó không chứng minh lời hứa đã được hiện thực và không mang phán quyết nào.

## Ma trận coverage

Ma trận là phần bền vững của operator này. Nó là một bảng đóng gồm mười tám chiều:

`actor-eligibility`, `offer-entry`, `read-entry`, `purchase-side-effect`, `external-payment`,
`settlement`, `idempotency`, `entitlement-consumer`, `quota-consumer`, `renewal`, `cancellation`,
`expiry`, `denial`, `recovery`, `refund`, `legacy-create`, `legacy-read`, `legacy-settle`.

Mỗi chiều xuất hiện đúng một lần. Một chiều không ai nghĩ tới thì không thể đơn giản là vắng mặt khỏi
bảng, vì đó chính là cách bản phát hành trước publish một lời hứa mà các consumer của nó không giữ.

Mỗi dòng gọi tên disposition của nó — `preserve`, `replace`, `retire`, `defer` hay `not-applicable` —
cùng chủ sở hữu thực thi, source thực thi, bằng chứng khẳng định và phủ định, các consumer nó định
đoạt, và các claim đứng sau. Một dòng khẳng định có thực thi thì dựa trên ít nhất một claim `fact`.

## Receipt khi blocked

Receipt đã blocked không có quyết định và không đóng băng fingerprint coverage nào. Nó chứa đúng một
failure có kiểu, các chiều và tham chiếu liên quan, domain sở hữu, tính lặp lại được, và chỉ khi lặp
lại được thì mới có token resume dùng một lần kèm phần delta vật chất cần bổ sung.

## Mã lỗi

| Mã | Vấn đề sở hữu | Delta vật chất hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | Input đã sửa. |
| `SOURCE_DRIFT` | Backend source quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `EVIDENCE_MISSING` | Một chiều hoàn toàn không có quan sát nào đứng sau. | Claim quan sát được. |
| `CONTRADICTION_UNRESOLVED` | Hai claim về cùng một hành vi mâu thuẫn nhau. | Phán quyết của chủ sở hữu. |
| `COVERAGE_INCOMPLETE` | Một chiều không mang disposition nào. | Disposition còn thiếu. |
| `CONSUMER_UNPROVEN` | Một consumer đã tìm thấy mà không có disposition hoặc không có bằng chứng. | Disposition kèm bằng chứng khẳng định và phủ định. |
| `LIFECYCLE_TRANSITION_INVALID` | Trạng thái yêu cầu không đi tới được từ head quan sát được. | Một bước chuyển hợp lệ, hoặc lần publish trung gian. |
| `AUTHORITY_CONFLICT` | Head hoặc gốc mâu thuẫn với thẩm quyền đã publish. | Binding thẩm quyền đã sửa. |
| `RECONCILIATION_DISCREPANCY` | Source đã giao khác ma trận đã đóng băng. | Source đã sửa, hoặc ma trận sửa lại. |
| `APPROVAL_REQUIRED` | Bước chuyển cần một phê duyệt chủ sở hữu chưa được bind. | Tham chiếu phê duyệt. |
| `NO_PROGRESS` | Một resume không thêm delta hữu hiệu nào. | Bằng chứng, thẩm quyền, discovery hay phê duyệt thật sự mới. |

`CONSUMER_UNPROVEN` là kết quả đúng khi việc tìm ra đi nhanh hơn việc chứng minh. Nó thuộc sở hữu của
nghiệp vụ, và publish lại cùng lời hứa sau khi consumer được định đoạt là bước tiếp theo đúng đắn.

## Bất biến liên trường

- `outcome="published"` đòi `receipt.status="published"`, quyết định khác null, `failure` null,
  `resume` null, và không còn finding mức lỗi nào mở.
- `outcome="blocked"` đòi `receipt.status="blocked"`, quyết định null, một failure có kiểu, và
  `coverageFingerprint` null. Failure lặp lại được thì cần resume; failure không lặp lại được thì cấm
  có resume.
- `receipt.evidenceRefs` và `output.evidenceRefs` là cùng một tập.
- Head đúng bằng `<businessesRootRef>/features/<featureId>`, được đăng ký trong `artifactRefs`, và mọi tham
  chiếu artifact đều nằm dưới gốc businesses.
- `binding.featureId`, `binding.targetState` và `binding.coverageFingerprint` bằng đúng feature, trạng
  thái và fingerprint ma trận của quyết định.
- Bước chuyển trong phả hệ khớp cả trạng thái trước lẫn trạng thái được publish; lần publish đầu tiên
  không gọi tên head trước đó, và mọi bước chuyển sau đều gọi.
- `implemented` đòi một lần đối chiếu không còn sai lệch.
- Đúng một dòng cho mỗi chiều coverage, và đủ cả mười tám chiều.
- Một chiều bắt buộc không bao giờ là `not-applicable`, và một nhánh vòng đời đã tìm thấy cũng vậy.
- `preserve` và `replace` mang chủ sở hữu, source, bằng chứng khẳng định và phủ định; `retire` mang
  chủ sở hữu, source và bằng chứng đóng đường; `defer` mang tham chiếu hoãn và không bằng chứng;
  `not-applicable` không mang gì cả.
- Mọi claim của mỗi dòng đều có trong `citedClaims`, và mỗi dòng có thực thi đều trích ít nhất một
  `fact`.
- Mọi consumer đã tìm thấy được định đoạt đúng một lần, dưới đúng chiều nó được tìm thấy, và không
  dòng nào định đoạt một consumer chưa từng được tìm thấy.
- `artifactRefs` đăng ký ma trận coverage.
- `handoff` luôn là `null`.

## Kết quả thực tế

Publish một lời hứa truy cập trả phí: ma trận định đoạt chốt chặn khoá học và cộng đồng dưới
`entitlement-consumer`, bộ đếm AI dưới `quota-consumer`, webhook thanh toán dưới `settlement`, khai tử
phần tạo checkout di sản trong khi vẫn giữ đọc và tất toán di sản được thực thi, hoãn phần phục hồi
tất toán thất bại cho một mục tiêu có tên, và đánh dấu hoàn tiền là không áp dụng. Head tiến từ
`pending` sang `in-progress` và mang theo head trước đó.

Publish cùng lời hứa đó khi một consumer quyền lợi đã được tìm thấy nhưng chưa được định đoạt: lần gọi
trả về `CONSUMER_UNPROVEN` gọi tên consumer ấy, không head nào được ghi, và không fingerprint coverage
nào được đóng băng.
