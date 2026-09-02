# Output của `quality.verify`

Operator trả về đúng một phong bì đóng với `outcome` bằng `verified` hoặc `blocked`. Nó không bao giờ
phát handoff hay chỉ dẫn định tuyến dạng tự do.

`verified` nghĩa là đã đi tới một phán quyết, không phải phán quyết ấy xanh. Một receipt đỏ là một lần
gọi trọn vẹn; `blocked` chỉ dành cho những trường hợp không tồn tại phán quyết trung thực nào.

## Receipt đã thẩm định

Một receipt đã thẩm định chứa:

- các binding chính xác về project, source, bản giao, tiền nhiệm, kế hoạch gate, input và tiến độ;
- những gate đã hoạch định và những gate bắt buộc, được nhắc lại để receipt đọc được mà không cần đặt
  input bên cạnh;
- một kết quả cho mỗi gate đã hoạch định, kèm lệnh, mã thoát, bằng chứng và cách phân loại;
- phép đo độ phủ so với ngưỡng riêng của nó, khi cổng unit có chạy;
- phạm vi Sonar đã được đo, khi Sonar có trong kế hoạch;
- mọi khoản nợ đã được chủ sở hữu duyệt đang giữ một gate ở trạng thái đỏ;
- phán quyết.

## Các kết quả

| Trạng thái | Mã thoát | Bằng chứng | Phân loại |
| --- | --- | --- | --- |
| `pass` | Đúng bằng `0` | Bắt buộc | Không có |
| `fail` | Khác không | Bắt buộc | `in-boundary`, `boundary-drift` hoặc `flaky` |
| `external-blocker` | Bất kỳ | Bắt buộc | `external-blocker` |
| `skipped-not-requested` | Không có | Không có | Không có |

`skipped-not-requested` chỉ dành riêng cho gate `e2e`, và nó mang theo finding `E2E_NOT_REQUESTED`. Mọi
gate khác thì hoặc đã chạy, hoặc lần gọi bị chặn, vì một gate lặng lẽ không chạy đọc lên y hệt một gate
đã đạt.

Một kết quả đạt mà không có tham chiếu bằng chứng chỉ là lời kể. Bằng chứng là thứ người đọc sau này mở
ra để bất đồng với receipt này, nên nó bắt buộc với mọi gate đã chạy, kể cả những gate xanh.

## Độ phủ

Độ phủ chỉ tồn tại khi cổng unit có chạy, và nó nêu tên bằng chứng của chính nó. Câu lệnh, dòng, hàm và
nhánh mỗi thứ được so với ngưỡng riêng; một ngưỡng nhánh bị gộp vào con số câu lệnh chính là cách một
đường lỗi chưa được test đi lọt.

Một chỉ số dưới ngưỡng làm kết quả unit-coverage thành thất bại. Nó không phải một ghi chú bên cạnh một
cổng xanh, và receipt ghi lại `COVERAGE_BELOW_THRESHOLD`.

## Sonar

Khi Sonar có trong kế hoạch, receipt phát biểu phạm vi là `new-code` hay `overall`.

Một kết quả `new-code` đạt thì đòi finding `SONAR_NEW_CODE_ONLY`. Cổng đã ghim đo phần thay đổi, nên
một kết quả xanh là phát biểu về diff còn dự án bên dưới vẫn có thể đang đỏ. Ghi lại phạm vi chính là
thứ ngăn một cổng xanh về sau bị đọc thành sức khoẻ dự án.

## Nợ

Một khoản nợ giữ một gate ở trạng thái đỏ một cách có chủ ý. Nó nêu mã, gate, phê duyệt, chủ sở hữu và
hạn, và nó chỉ phủ một thất bại `in-boundary`: loại mà chủ bản giao sửa được.

Một khoản nợ đặt lên gate đã đạt thì ghi lại hư không, còn một khoản nợ đặt lên thất bại
`boundary-drift` thì đang nợ đi thứ thuộc về người sở hữu ranh giới. Cả hai đều bị từ chối, và đó là
thứ giữ cho nợ đã khai khác biệt với nợ âm thầm.

## Phán quyết

`pass` đòi mọi gate bắt buộc đều đạt, hoặc trượt `in-boundary` dưới một khoản nợ đã khai. Mọi thứ khác
là `fail`, kể cả một gate bắt buộc bị môi trường chặn: một gate không đo được thì không phải một gate
đã đạt.

## Receipt bị chặn

Một receipt bị chặn không có phần thẩm định. Nó chứa đúng một failure có kiểu, những gate và tham chiếu
liên quan, miền sở hữu, khả năng thử lại, và chỉ khi thử lại được thì có thêm một token dùng một lần
kèm phần delta vật liệu cần thiết.

## Mã thất bại

| Mã | Vấn đề thuộc về | Delta vật liệu hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Contract input đóng không đạt. | Input đã sửa. |
| `SOURCE_DRIFT` | Source quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `PREDECESSOR_MIXED` | Hai tiền nhiệm mô tả hai head khác nhau. | Một tập tiền nhiệm nhất quán. |
| `PREDECESSOR_STALE` | Fingerprint tiền nhiệm không còn khớp source đã đóng băng. | Một receipt thượng nguồn làm mới. |
| `GATE_UNAVAILABLE` | Một gate bắt buộc hoàn toàn không chạy được ở đây. | Môi trường gate hoạt động được. |
| `DEBT_UNAPPROVED` | Một khoản nợ không có phê duyệt còn sống của chủ sở hữu. | Phê duyệt của chủ sở hữu, còn hạn. |
| `NO_PROGRESS` | Một resume không thêm delta hữu hiệu nào. | Tiền nhiệm, gate, nợ hoặc source mới về mặt vật chất. |

Không có mã cho việc sửa chữa, vì sửa chữa không phải việc của operator này. Một thất bại `in-boundary`
được trả về dưới dạng phán quyết đỏ cho người sửa được nó, và bản giao đã sửa quay lại dưới dạng một
head mới với một fingerprint tiền nhiệm mới.

## Bất biến liên trường

- `outcome="verified"` đòi `receipt.status="verified"`, `verification` khác null, `failure` null và
  `resume` null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `verification` null và `failure` khác null. Một
  failure thử lại được thì đòi resume; một failure không thử lại được thì cấm resume.
- `plannedGates` không trùng, `results` phủ đúng những gate đã hoạch định mỗi cái một lần, và
  `requiredGates` là tập con của `plannedGates`.
- Mã thoát, bằng chứng và cách phân loại của mỗi kết quả đều khớp trạng thái của nó.
- `skipped-not-requested` chỉ xuất hiện trên `e2e`, và chỉ cùng finding `E2E_NOT_REQUESTED`.
- `coverage` khác null đúng khi cổng unit-coverage được đo, và không chỉ số nào nằm dưới ngưỡng bên
  cạnh một kết quả unit-coverage đạt.
- `sonarScope` khác null đúng khi Sonar có trong kế hoạch, và một kết quả `new-code` đạt mang theo
  finding `SONAR_NEW_CODE_ONLY`.
- Mỗi khoản nợ nêu một gate đã hoạch định mà kết quả trượt `in-boundary`, và mã nợ không trùng.
- `verdict="pass"` đòi mọi gate bắt buộc đều đạt hoặc được nợ phủ.
- `artifactRefs` đúng bằng tập tham chiếu bằng chứng mà các kết quả nêu tên.
- `handoff` luôn là `null`.

## Kết quả thực tế

Thẩm định một bản giao backend: format, lint, typecheck, build và unit-coverage đều đạt kèm bằng chứng,
Sonar đạt trên phạm vi new-code và receipt nói rõ điều đó, e2e được ghi là bỏ qua vì không ai yêu cầu,
và phán quyết xanh, không nợ.

Thẩm định cùng bản giao ấy sau một lần tụt độ phủ: nhánh rơi xuống dưới ngưỡng riêng của nó, cổng
unit-coverage trượt `in-boundary`, phán quyết đỏ, và receipt được trả về cho chủ backend mà không một
dòng source nào bị đụng tới ở đây.
