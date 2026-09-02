# Thực thi `quality.verify`

## Một việc duy nhất

Chạy những gate đã khai cho đúng một bản giao có ranh giới, trên đúng một head đã đóng băng, và trả về
receipt đo được chính xác. Đây là một lần gọi operator tuyến tính. Nó không gọi operator khác, không
route workflow, không tự tạm dừng bên trong, và không trả về chỉ dẫn điều khiển dạng tự do.

Cái gì đã được dựng, dựng để làm gì, và đó có phải ý hay không đều đã được quyết trước. Operator này
trả lời một câu cho mỗi gate: lệnh đã ghim trả về cái gì, và điều đó nghĩa là gì theo chính sách phân
loại đã khai.

## Chỉ thẩm định

Chất lượng không bao giờ sửa và không bao giờ thiết kế lại. Operator không đụng vào source sản phẩm,
không chỉnh lệnh gate hay cấu hình của nó, và không thay một phép kiểm khó bằng một phép kiểm dễ hơn.

Một gate trượt thì được báo cáo chứ không được vá. Receipt nêu tên gate, mã thoát, bằng chứng và cách
phân loại, rồi người có thể sửa sẽ đọc nó. Một receipt đỏ là một lần gọi trọn vẹn và thành công của
operator này; chỉ khi không thể đi tới bất kỳ phán quyết nào thì mới là bị chặn.

Vì không có gì ngoài bằng chứng gate được ghi, `artifactRefs` đúng bằng tập tham chiếu bằng chứng mà
các kết quả nêu tên. Một tham chiếu xuất hiện ở đó mà không kết quả nào nêu là một lần ghi operator này
không được phép làm, và nó bị từ chối đúng như thế.

## Kết quả gate là đo được, không phải kể lại

Mỗi gate đã chạy đều mang tham chiếu lệnh, mã thoát và tham chiếu bằng chứng. Đạt nghĩa là mã thoát
bằng không cùng bằng chứng nằm bên cạnh. Trượt nghĩa là mã thoát khác không, kèm bằng chứng và một cách
phân loại.

Cách phân loại được rút ra từ chẩn đoán có cấu trúc sau khi lệnh đã chạy, không bao giờ chọn trước:

- `in-boundary` khi chủ bản giao sửa được;
- `boundary-drift` khi sửa nó sẽ đổi một ranh giới đã duyệt;
- `flaky` khi cùng source và cùng môi trường lại cho kết quả mâu thuẫn theo chính sách xác nhận có giới
  hạn đã khai;
- `external-blocker` khi môi trường hay một phụ thuộc ngăn không cho có phán quyết nào cả.

Chạy lại tồn tại để phân biệt bốn thứ đó. Nó không bao giờ tồn tại để biến một thất bại chưa giải thích
được thành đạt, và một kết quả cache không bao giờ được nâng hạng: một thất bại đã cache vẫn là thất
bại, và một lần trúng cache chỉ đáng tin khi fingerprint đầy đủ trên head, lệnh, cấu hình, toolchain và
môi trường đều khớp.

## Hai sự thật của codebase này

**Sonar chỉ đo code mới.** Cổng đã ghim chỉ soi phần thay đổi, nên một kết quả Sonar xanh là phát biểu
về phần diff chứ không phải về dự án, và dự án hoàn toàn có thể đang đỏ bên dưới nó. Khi `sonarScope`
là `new-code`, một kết quả Sonar đạt phải đi kèm finding `SONAR_NEW_CODE_ONLY`. Thiếu nó, người đọc sau
này sẽ hiểu cổng xanh là sức khoẻ dự án, và đó đúng là cách hiểu sai mà operator này sinh ra để ngăn.

**End-to-end không bao giờ chạy trừ khi được yêu cầu tường minh.** Bộ này chỉ chạy khi người gọi yêu
cầu trong chính lần gọi này. Ngoài ra, gate được ghi thành `skipped-not-requested` kèm finding
`E2E_NOT_REQUESTED`: không lệnh, không mã thoát, không bằng chứng, và không hàm ý nào rằng hành vi đã
được chứng minh.

## Trình tự thi hành

1. **Kiểm tra input và resume.** Áp `input.schema.json` cùng phần kiểm tra ngữ nghĩa. Từ chối các head
   tiền nhiệm bất đồng, binding source đã cũ, kế hoạch e2e không được yêu cầu, kế hoạch Sonar mâu thuẫn
   với phạm vi của nó, khoản nợ có phê duyệt đã hết hạn, bản giao frontend mang nợ, và resume không đổi
   gì.
2. **Tiêu thụ tiền nhiệm nguyên trạng.** Ràng từng receipt thượng nguồn bằng tham chiếu, loại,
   fingerprint và head. Không dựng lại, không hoạch định lại, không xét lại điều họ đã quyết. Ghi
   `PREDECESSOR_CONSUMED`.
3. **Xác minh head.** Xác minh lại head quan sát được so với head đã đóng băng trước khi gate đầu tiên
   chạy. Khác biệt là `SOURCE_DRIFT`, vì một gate đo trên head khác là đang đo một bản giao khác.
4. **Chạy các gate theo thứ tự đã khai.** Format chỉ kiểm, lint không lỗi và không cảnh báo, typecheck
   và build qua entrypoint của repo, unit là nơi duy nhất sinh độ phủ, integration cho những ranh giới
   kết nối đã khai, e2e chỉ khi được yêu cầu, Sonar cuối cùng và không thừa hưởng gì. Mỗi lần chạy ghi
   bằng chứng của nó dưới artifact root.
5. **Áp chính sách độ phủ.** Câu lệnh, dòng, hàm và nhánh được so với ngưỡng riêng của chúng. Nhánh mang
   ngưỡng độc lập, vì gộp nó vào con số câu lệnh chính là cách một đường lỗi chưa được test đi lọt. Một
   chỉ số dưới ngưỡng làm cổng unit thành thất bại và ghi `COVERAGE_BELOW_THRESHOLD`; nó không bao giờ
   trở thành một ghi chú nhỏ bên cạnh một kết quả xanh.
6. **Phân loại từng thất bại.** Đọc chẩn đoán có cấu trúc và gán đúng một cách phân loại. Không bao giờ
   bỏ qua, chặn tiếng, thay thế hay `passWithNoTests` một gate để đẩy nó đi. Một lần chạy không có bài
   test nào không phải là đạt.
7. **Áp nợ đã duyệt.** Một gate chỉ được để đỏ dưới một khoản nợ đã được chủ sở hữu duyệt, còn hạn, phủ
   một thất bại `in-boundary`, ghi thành `DEBT_DECLARED`. Nợ đặt lên một gate đã đạt hoặc lên một thất
   bại `boundary-drift` thì bị từ chối.
8. **Phát và dừng.** Tính phán quyết, ghi receipt dưới `input.project.artifactRootRef`, đăng ký mọi
   tham chiếu bằng chứng vào `artifactRefs`, phát đúng một output tuân theo `output.schema.json`, và
   ràng mọi fingerprint.

## Phán quyết

`verdict: "pass"` đòi mọi gate bắt buộc đều đạt, hoặc trượt `in-boundary` dưới một khoản nợ đã khai.
Mọi hình dạng khác là `verdict: "fail"`, kể cả một gate bắt buộc bị môi trường chặn: một gate không đo
được thì không phải một gate đã đạt.

Một gate không bắt buộc mà trượt thì được ghi lại và tự nó không làm phán quyết đỏ. Đó chính là lý do
`required` tồn tại, và nó là lời khai của người gọi chứ không bao giờ là phán đoán của operator này.

## Thực thi khi resume

Một resume bắt đầu lại từ khâu kiểm tra, chỉ tái dùng những quan sát có fingerprint không đổi, và tiêu
thụ đúng phần delta. Resume không thêm thay đổi nào về tiền nhiệm, gate, nợ hay source thì trả
`NO_PROGRESS`. Một bản giao đã sửa sẽ đến dưới dạng head mới và fingerprint tiền nhiệm mới; cùng một
fingerprint không thể cho ra một đáp án khác.

## Các đòn tấn công bắt buộc

Operator không được báo cáo một lần thẩm định khi còn bất kỳ mục nào áp dụng được mà chưa giải quyết:

- một gate đã hoạch định không có kết quả, hoặc một kết quả nêu tên gate không ai hoạch định;
- một kết quả đạt mang mã thoát khác không, hoặc không có bằng chứng để mở;
- một thất bại không có cách phân loại, hoặc phân loại được chọn trước khi lệnh chạy;
- gate e2e đã chạy mà không có yêu cầu tường minh;
- một kết quả Sonar xanh trên phạm vi new-code được ghi mà không nói rõ điều đó;
- một chỉ số độ phủ nằm dưới ngưỡng ngay bên cạnh một cổng unit đạt;
- một khoản nợ phủ lên gate đã đạt, lên một thất bại boundary-drift, hoặc không có phê duyệt còn sống;
- xuất hiện một tham chiếu artifact mà không kết quả gate nào sinh ra.
