# Output của `content.generate`

Operator trả về một vỏ đóng với `outcome` bằng `generated` hoặc `blocked`. Nó không bao giờ phát ra
handoff hay chỉ dẫn điều phối dạng văn xuôi tự do.

## Receipt khi đã dựng xong

Một receipt `generated` chứa:

- các binding chính xác về project, source, đơn vị, ngôn ngữ, chế độ từng khâu, sàn điểm, curriculum,
  brief, input và tiến độ;
- brief người dạy đã đóng băng cùng các outcome, claim, ví dụ và quyết định của nó;
- mỗi ngôn ngữ đã khai một bản viết, mỗi bản gọi tên những outcome nó phủ;
- hình cùng prompt của nó, những claim nó mã hoá, và bài soi của nó;
- mỗi ngôn ngữ đã khai một track hiện thực, kèm lệnh build và exit code;
- phần kiểm tra thực thi với fingerprint contract trước và sau, số vòng lặp, và mỗi track một lần
  chạy;
- phần phê bình độc lập với execution, điểm, finding và phán quyết của nó;
- những artifact mà phê bình đã duyệt.

Receipt chứng minh đơn vị này được dựng dựa trên một brief đã đóng băng và đã sống sót qua một lần đọc
độc lập. Nó không chứng minh đơn vị đã được publish, và không mang lời khai nào về kết quả học tập
ngoài đời.

## Brief là thước đo

Mỗi bản viết gọi tên những outcome nó phủ, và chúng chỉ được là outcome mà brief đã publish. Trên
receipt `generated`, mọi bản viết đều phủ trọn tập đã publish. Một bản chỉ phủ một phần của brief
nghĩa là bài học đầy đủ ở ngôn ngữ này và thiếu ở ngôn ngữ kia, đúng cái lỗi âm thầm mà phép kiểm tra
này sinh ra để bắt.

## Bằng chứng, không phải lời văn

Một track mang lệnh build và exit code của nó. Một lần chạy mang lệnh, exit code và các assertion của
nó. Không cái nào mang một câu văn tuyên bố là đã thành công. Fingerprint contract được ghi hai lần,
trước và sau vòng lặp sửa, và hai lần đó phải bằng nhau.

## Phần phê bình

Phê bình là bước cuối và là bước duy nhất được phán. Nó chạy mới tinh, không thừa kế lượt nào, không
bao giờ là execution đã viết brief hay một bản viết, và ghi `producerRationaleReceived` bằng false.
`receivedArtifactRefs` liệt kê những gì nó được đưa, và mọi artifact đã sản xuất đều phải có mặt ở đó.

Duyệt đòi mọi điểm áp dụng được đều từ `minimumScore` đã bind là `85` trở lên và không còn finding lỗi
nào mở. Phán quyết đòi sửa phải gọi tên ít nhất một finding lỗi, gán cho đúng một khâu sở hữu, và khâu
đó phải là khâu đã thật sự chạy.

## Receipt khi bị chặn

Receipt `blocked` không có phần đơn vị. Nó chứa đúng một failure có kiểu, gọi tên khâu sở hữu, các
tham chiếu liên quan, domain sở hữu, tính retry được, và chỉ khi retry được mới có token resume dùng
một lần kèm phần vật liệu còn thiếu.

## Mã lỗi

| Mã | Vấn đề sở hữu | Delta vật liệu hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Contract input đóng đã fail. | Input đã sửa. |
| `SOURCE_DRIFT` | Source quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `BRIEF_UNBOUND` | Không thể đóng băng brief từ curriculum và source đã bind. | Bằng chứng curriculum hoặc source còn thiếu. |
| `OUTCOME_UNCOVERED` | Một bản viết để hở một outcome đã publish. | Bản viết đã viết lại, hoặc một brief hẹp hơn. |
| `CODE_BUILD_FAILED` | Một track đã khai không build được. | Track đã sửa. |
| `E2E_FAILED` | Một kiểm tra thực thi đã khai fail trong giới hạn số vòng. | Phần hiện thực đã sửa, rồi chạy lại. |
| `CONTRACT_WEAKENED` | Contract thực thi bị dịch chuyển trong vòng lặp sửa. | Contract đã khôi phục, và một lần chạy không đụng tới nó. |
| `IMAGE_UNAVAILABLE` | Hình bắt buộc không tạo được theo các claim của brief. | Bộ tạo ảnh hoạt động, hoặc tắt khâu hình. |
| `REVIEW_REVISION_REQUIRED` | Phê bình độc lập trả về yêu cầu sửa. | Đúng những sửa chữa mà finding gọi tên, theo khâu sở hữu. |
| `REVIEW_ROUNDS_EXHAUSTED` | Số vòng review đã duyệt đã dùng hết. | Thêm vòng đã duyệt, hoặc một đơn vị hẹp hơn. |
| `NO_PROGRESS` | Một resume không thêm delta thực chất nào. | Curriculum, source, finding hoặc phạm vi mới thật sự. |

`REVIEW_REVISION_REQUIRED` là kết cục dự kiến của một lần review thật, không phải lỗi. Các finding gọi
tên khâu sở hữu để lần gọi sau sửa đúng chỗ thay vì viết lại tất cả.

## Bất biến liên trường

- `outcome="generated"` đòi `receipt.status="generated"`, `unit` khác null, `failure` null và `resume`
  null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `unit` null và `failure` khác null. Failure
  retry được thì phải có resume; failure không retry được thì cấm có resume.
- Mọi khâu bị tắt đều được ghi thành finding `STAGE_DISABLED`.
- Các bản viết phủ đúng tập ngôn ngữ đã khai, mỗi ngôn ngữ một lần.
- Mọi outcome được khai phủ đều do brief publish, và trên receipt `generated`, mọi bản viết đều phủ
  mọi outcome đã publish.
- Quyết định sửa hoặc bỏ đều gọi tên thứ mà nó tác động.
- Khâu hình bị tắt thì không có hình, khâu bắt buộc thì phải có, và mọi claim được mã hoá đều do brief
  publish. Receipt `generated` đòi bài soi độ trung thành claim phải đạt.
- Các track hiện thực phủ đúng tập ngôn ngữ hiện thực đã khai, mỗi ngôn ngữ một lần, và receipt
  `generated` đòi mọi lần build đều exit 0.
- Kiểm tra thực thi đụng tới mọi track đã khai, exit 0 trên receipt `generated`, và fingerprint
  contract của nó không đổi trước và sau vòng lặp sửa.
- Phê bình chạy mới tinh không thừa kế lượt, không phải một execution sản xuất, nhận mọi artifact đã
  sản xuất, và không nhận lý lẽ của người sản xuất.
- Phán quyết duyệt đòi mọi điểm áp dụng được đều từ `minimumScore` trở lên và không còn finding lỗi
  nào mở; phán quyết đòi sửa thì phải có ít nhất một; không finding nào gọi tên một khâu đã tắt.
- Receipt `generated` đòi phán quyết duyệt cùng ít nhất một artifact được duyệt, và mọi artifact được
  duyệt đều do đơn vị này sản xuất ra.
- `artifactRefs` đăng ký brief, phần phê bình, và mọi artifact được duyệt.
- `handoff` luôn là `null`.

## Kết cục thực tế

Dựng một bài về ghi idempotent: brief publish hai outcome và hai claim, cả bản tiếng Việt lẫn bản
tiếng Anh đều phủ cả hai outcome, sơ đồ mã hoá một claim, track TypeScript và track Go đều build được
và cùng qua một contract thực thi, và một người phê bình mới tinh duyệt với điểm thấp nhất là 86.

Dựng cùng bài đó khi track Go vẫn áp dụng hai lần lúc retry: không đơn vị nào ra, receipt trả về
`E2E_FAILED` gọi tên track và lần chạy đạt còn thiếu, và resume chờ phần sửa.
