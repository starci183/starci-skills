# Bàn làm bài đánh giá

## LOADS

Không có.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| ID archetype | `assessment-workbench` |
| Họ | Work |
| Nhiệm vụ chủ đạo | Hoàn thành một lượt đánh giá hữu hạn trong khi hiểu câu hiện tại, tiến độ còn lại, trạng thái lưu câu trả lời, giới hạn thời gian và hệ quả của lần nộp cuối. |
| Bí danh tìm kiếm | không gian làm quiz, phiên thi, trình làm bài kiểm tra, điều hướng câu hỏi, lượt đánh giá, rà soát và nộp bài |
| Thẩm quyền | Cấu trúc trang và hành vi responsive dùng chung giữa các sản phẩm. Archetype không chọn ngữ nghĩa sản phẩm, cách thể hiện thị giác hay giá trị triển khai. |

Archetype này là một bề mặt làm việc tập trung, không chỉ là một trang tình cờ chứa câu hỏi. Nó giữ một câu hiện tại làm vùng chính đồng thời bảo toàn các dữ kiện phiên cần thiết để người dùng tiến lên an toàn.

### Bất biến

- `question-stage` là vùng làm việc chính duy nhất.
- Phải có bằng chứng cho đúng một chính sách điều hướng trước khi chọn: phi tuyến (`AR-AW-02`) hoặc tuyến tính (`AR-AW-03`).
- `question-navigator` chỉ tồn tại cho lượt làm phi tuyến. Trên bề mặt rộng viết từ trái sang phải, nó là rail hỗ trợ bên phải; lượt làm tuyến tính không được nhận một rail số câu bất hoạt hay chỉ để trang trí.
- Hành vi bộ đếm giờ, lưu câu trả lời và nộp bài đến từ sự thật nghiệp vụ. Archetype bảo toàn chúng khi tồn tại và không tự đặt ra chính sách.
- Thay đổi không gian khả dụng có thể đổi cách trình bày nhưng không được đổi quyền truy cập câu hỏi, trạng thái câu trả lời, trạng thái thời gian, khả năng nộp bài hay ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-AW-01` | Người dùng đang hoàn thành một lượt đánh giá hữu hạn có các câu hỏi xác định được và một sự kiện kết thúc. | Tín hiệu dương bắt buộc. |
| `AR-AW-02` | Lượt làm cho phép người dùng nhảy giữa các câu khả dụng trước lần nộp cuối. | Chọn biến thể phi tuyến và có `question-navigator`. |
| `AR-AW-03` | Lượt làm bắt buộc tiến theo thứ tự và không cho phép truy cập tùy ý các câu. | Chọn biến thể tuyến tính và bỏ `question-navigator`. |
| `AR-AW-04` | Lượt làm có giới hạn thời gian nhìn thấy được hoặc chuyển trạng thái phụ thuộc thời gian. | Bảo toàn trạng thái bộ đếm và hành vi hết giờ ở mọi cỡ trình bày. |
| `AR-AW-05` | Câu trả lời được lưu trong lượt làm, tự động hoặc theo thao tác rõ ràng. | Bảo toàn trạng thái đã sửa, đang lưu, đã lưu và lưu lỗi mà không thay thế câu hiện tại. |
| `AR-AW-06` | Lần nộp cuối cam kết toàn bộ lượt làm hoặc ngăn sửa tiếp. | Bắt buộc có cổng rà soát hoặc hệ quả trước khi cam kết. |
| `AR-AW-90` | Hoạt động là luyện tập mở, hội thoại, đọc nội dung hoặc một luồng không hữu hạn thay vì một lượt làm hữu hạn. | Từ chối archetype này. |
| `AR-AW-91` | Bề mặt dùng để soạn, cấu hình hoặc chấm một bài đánh giá thay vì làm bài. | Từ chối archetype này; đây là không gian soạn hoặc rà soát. |

### Luật lựa chọn

Chỉ chọn `assessment-workbench` khi có bằng chứng cho `AR-AW-01`, không có mã từ chối và đã phân giải đúng một trong `AR-AW-02` hoặc `AR-AW-03`. Nếu chính sách điều hướng chưa rõ hoặc mâu thuẫn, trả về `needs-evidence`; không suy ra rail câu hỏi chỉ từ số lượng câu.

`AR-AW-04`, `AR-AW-05` và `AR-AW-06` bổ sung nghĩa vụ mà không đổi archetype. Việc chúng vắng mặt phải được chứng minh là quy tắc thật của sản phẩm, không được suy ra từ một mockup sơ sài.

## Sơ đồ vùng

```text
assessment-session
├─ session-header
│  ├─ assessment-identity
│  ├─ progress-status
│  ├─ timer-status [AR-AW-04]
│  └─ save-status [AR-AW-05]
└─ assessment-workspace
   ├─ question-stage
   │  ├─ question-context
   │  ├─ prompt-and-stimulus
   │  ├─ answer-region
   │  ├─ validation-or-feedback
   │  └─ question-actions
   ├─ question-navigator [AR-AW-02 only]
   │  ├─ question-index
   │  ├─ question-state-legend
   │  └─ review-entry
   └─ completion-flow
      ├─ attempt-summary
      ├─ consequence-or-warning
      └─ final-submit
```

### Nghĩa vụ của vùng

| Vùng | Nghĩa vụ |
|---|---|
| `session-header` | Xác lập lượt làm, tiến độ hiện tại và mọi trạng thái thời gian hoặc lưu dữ liệu mà không cạnh tranh với câu hỏi. |
| `question-stage` | Sở hữu đề bài hiện tại, tương tác trả lời, kiểm tra cục bộ và hành động trước/sau được cho phép. Nó luôn là vùng chính ở mọi cỡ. |
| `question-navigator` | Bộc lộ các câu có thể truy cập cùng trạng thái không chỉ dựa vào màu. Nó hỗ trợ vùng làm câu và chỉ tồn tại theo `AR-AW-02`. |
| `completion-flow` | Tóm tắt câu chưa trả lời, không hợp lệ hoặc đã đánh dấu theo chính sách, truyền đạt hệ quả cam kết và sở hữu lần nộp cuối. |

### Quan hệ giữa các biến thể

Với biến thể phi tuyến, cấu trúc rộng là `question-stage` ở bên trái và `question-navigator` làm rail hỗ trợ bên phải trong cách trình bày từ trái sang phải. Rail có thể dẫn vào `completion-flow` nhưng không được trở thành không gian làm việc chính thứ hai. Trong locale từ phải sang trái, cạnh hỗ trợ logic có thể đảo chiều trong khi quan hệ ngữ nghĩa không đổi.

Với biến thể tuyến tính, `question-stage` là một luồng làm việc duy nhất. Tiến độ thuộc `session-header`; hành động trước và sau thuộc vùng làm câu khi chính sách cho phép; chỉ đi vào `completion-flow` tại bước kết thúc hoặc rà soát được phép. Một lưới số câu bị vô hiệu hóa không phải vật thay thế hợp lệ cho quyền truy cập phi tuyến vốn không tồn tại.

## Hợp đồng responsive

### Rộng

- Header phiên trải theo bề mặt làm việc và giữ định danh, tiến độ, bộ đếm cùng trạng thái lưu ở vai trò thị giác phụ so với câu hỏi.
- Theo `AR-AW-02`, vùng làm câu là vùng chính bên trái và bộ điều hướng câu là rail hỗ trợ bên phải. Vùng làm câu nhận phần không gian hữu dụng lớn hơn.
- Theo `AR-AW-03`, không chừa rail hỗ trợ. Vùng làm câu dùng measure chính khả dụng mà không tạo đối xứng rỗng giả tạo.
- Rail chỉ có thể được giữ nhìn thấy khi vùng làm câu di chuyển nếu nó không tạo một bẫy cuộn cạnh tranh hoặc che nội dung đang được focus.
- `completion-flow` nằm sau việc trả lời. Có thể đi vào nó từ bộ điều hướng phi tuyến hoặc bước kết thúc được phép, nhưng lần nộp cuối không bao giờ bị nhập nhằng với điều hướng sang câu kế tiếp thông thường.

### Trung gian

- Chuyển đổi theo độ vừa vặn của nội dung, không theo tên thiết bị hay breakpoint cố định.
- Chỉ giữ rail hỗ trợ phi tuyến khi đề bài, điều khiển trả lời, nhãn trạng thái và nhãn điều hướng đều còn vận hành được ở measure cần thiết.
- Khi không còn vừa, thay rail bằng một trigger điều hướng rõ ràng và một bề mặt điều hướng mở theo nhu cầu. Không nén nó thành dải khó đọc hoặc giấu trạng thái câu.
- Header phiên có thể xuống dòng hoặc thu gọn, nhưng tiến độ hiện tại, trạng thái bộ đếm, lỗi lưu và đường tới nộp bài vẫn phải nhận biết được.
- Biến thể tuyến tính tiếp tục là một luồng; nó không được tự có thêm bộ điều hướng trong quá trình chuyển đổi.

### Gọn

- Trình bày một vùng làm câu theo chiều dọc. Điều hướng hỗ trợ không đứng cạnh câu hỏi.
- Theo `AR-AW-02`, thay rail bằng một trigger có tên rõ ràng để mở bề mặt điều hướng câu tạm thời. Bề mặt đó bảo toàn trạng thái câu hiện tại, chưa trả lời, đã trả lời, đã đánh dấu và không hợp lệ, chú giải, lối vào rà soát cùng đường tới nộp bài.
- Theo `AR-AW-03`, chỉ giữ đường trước/sau hoặc tiếp tục được cho phép. Không bộc lộ các câu tương lai không thể truy cập bằng một index trang trí.
- Thu gọn tiến độ, bộ đếm và trạng thái lưu vào ngữ cảnh phiên nhưng không biến chúng thành màu hoặc icon không nhãn. Cảnh báo, hết giờ hay lỗi lưu vẫn có nội dung chữ.
- Giữ hành động cục bộ cùng câu hỏi. Lần nộp cuối vẫn nằm trong `completion-flow`, cùng hệ quả và tóm tắt lượt làm, thay vì biến thành nút kế tiếp cố định đầy nhập nhằng.
- Mở bộ điều hướng tạm thời sẽ đưa focus vào ngữ cảnh có tên của nó; đóng sẽ trả focus về trigger. Chọn một câu sẽ đóng bề mặt tạm thời và đặt focus tại ngữ cảnh câu mới. Lỗi kiểm tra và lỗi nộp bài đặt focus tại tóm tắt lỗi liên quan hoặc mục không hợp lệ đầu tiên.

### Reflow

- Thứ tự đọc là `session-header`, `question-stage`, điều hướng hỗ trợ phi tuyến khi được mở, rồi `completion-flow`; việc sắp xếp lại bằng thị giác phải giữ nguyên ý nghĩa này.
- Nội dung đề, nhãn câu trả lời, chữ trạng thái và bản dịch dài được xuống dòng mà không gây cuộn ngang toàn trang hoặc mất hành động.
- Một stimulus vốn cần hai chiều có thể sở hữu vùng điều hướng hai chiều hữu hạn chỉ khi ý nghĩa thực sự đòi hỏi; phần còn lại của bài đánh giá vẫn reflow độc lập và bản tương đương truy cập được vẫn là nghĩa vụ sản phẩm.
- Chữ phóng to, nhãn bản địa hóa dài, zoom trình duyệt, bàn phím phần mềm và chiều cao viewport giảm không được che câu trả lời hiện tại, cảnh báo thời gian, lỗi lưu, điều khiển đang focus hay hệ quả nộp bài.
- Trang sở hữu luồng cuộn chính. Bộ điều hướng tạm thời có thể sở hữu luồng cuộn khi mở, với focus được giữ và trả lại; vùng làm câu và rail rộng không được đồng thời trở thành hai chủ sở hữu cuộn nhập nhằng.
- Trình bày sticky không phải bất biến. Nếu giữ bộ điều hướng rộng hoặc trạng thái phiên gọn luôn nhìn thấy, chúng không được che nội dung hay focus bàn phím và phải nhường khi chiều cao khả dụng không đủ.

### Tương đương tương tác

- Mọi cỡ đều bảo toàn cùng chính sách truy cập câu, quyền sửa câu trả lời, thao tác đánh dấu hoặc rà soát, thử lưu lại, hành vi cảnh báo và hết giờ, rà soát lượt làm cùng lần nộp cuối.
- Đổi cách trình bày không được đặt lại câu trả lời, xóa cờ, khởi động lại bộ đếm, nộp trùng hay âm thầm bỏ thay đổi chưa lưu.
- Trạng thái câu dùng chữ, hình dạng hoặc một tín hiệu xác định được bằng chương trình khác ngoài màu.
- Tiến độ lưu và cảnh báo thời gian được thông báo mà không cướp focus. Một lần đổi câu do người dùng kích hoạt có thể đưa focus tới ngữ cảnh câu mới; tự động lưu thì không.
- Người dùng bàn phím, con trỏ và công nghệ hỗ trợ có quyền truy cập tương đương tới bộ điều hướng, chú giải trạng thái, hành động câu và luồng hoàn tất.

## Nghĩa vụ trạng thái

| Họ trạng thái | Trạng thái và hành vi bắt buộc |
|---|---|
| Phiên | `initializing`, `ready`, `access-blocked`, `reconnecting`, `expired`, `completed`. Một chuyển đổi chặn phải giải thích điều gì còn làm được và không xóa câu trả lời đã nhập. |
| Câu hỏi | `current`, `unvisited`, `visited-unanswered`, `answered`, `flagged`, `invalid`; chỉ có `locked` khi sự thật nghiệp vụ cho phép. Các tổ hợp vẫn phân biệt được mà không chỉ dùng màu. |
| Lưu dữ liệu | Theo `AR-AW-05`: `dirty`, `saving`, `saved`, `save-failed`, và `offline-pending` khi có tiếp tục ngoại tuyến. Lỗi phải giữ câu trả lời cục bộ và đưa ra đường thử lại hoặc khôi phục rõ ràng. |
| Thời gian | Theo `AR-AW-04`: `running`, `warning`, chỉ có `paused` nếu chính sách cho phép, và `expired`. Cảnh báo không cướp focus; hết giờ tạo đúng một chuyển đổi xác định và được thông báo. |
| Điều hướng | Câu hiện tại, câu có thể truy cập, câu không khả dụng và trạng thái quay về từ bộ điều hướng. Việc di chuyển giữa các câu bảo toàn câu trả lời đã cam kết và đang chờ cục bộ theo chính sách. |
| Kiểm tra | Nghỉ, đang kiểm tra, không hợp lệ và đã chấp nhận. Lỗi xác định câu trả lời bị ảnh hưởng bằng chữ và vẫn liên kết với ngữ cảnh câu. |
| Nộp bài | `not-ready`, `ready`, `confirming`, `submitting`, `submitted`, `submit-failed`. Không thể kích hoạt cam kết hai lần; lỗi giữ lượt làm và một đường khôi phục an toàn. |
| Phản hồi | `not-evaluated`, `correct`, `incorrect`, `partially-correct` và phản hồi giải thích chỉ khi chính sách đánh giá cho phép công bố tại thời điểm đó. |
| Focus | Focus lúc vào, focus khi đổi câu, lúc vào và quay về từ bộ điều hướng tạm thời, focus lỗi kiểm tra, focus hết giờ và focus kết quả nộp bài đều có đích rõ ràng. Chỉ cập nhật trạng thái thì không di chuyển focus. |
| Lỗi dữ liệu | Lỗi tải ban đầu, lỗi tải câu, lỗi trạng thái bộ điều hướng và phiên cũ. Lỗi một phần xác định phạm vi và không biến toàn bộ lượt làm thành trạng thái trống không giải thích. |

## Ranh giới

### Chấp nhận

- Một lượt quiz, kiểm tra, thi hoặc chứng nhận có tập câu hữu hạn và một nhiệm vụ trả lời hiện tại.
- Một bài đánh giá dài chia thành section khi nó vẫn giữ lượt làm hữu hạn, một vùng làm câu chính và chính sách tuyến tính hoặc phi tuyến có bằng chứng.
- Các biến thể có giờ, không giờ, tự động lưu hoặc lưu rõ ràng khi quy tắc chính xác đến từ thẩm quyền nghiệp vụ.

### Từ chối

- Một câu độc lập hoặc giao dịch một bước nhỏ không có điều hướng cấp lượt làm hay cam kết hoàn tất.
- Flashcard, drill hoặc luyện tập thích ứng không có tập kết thúc hữu hạn được chứng minh.
- Trình đọc học liệu có nhiệm vụ chủ đạo là tiêu thụ nội dung thay vì trả lời bài đánh giá.
- Phỏng vấn hội thoại, phòng giám sát trực tiếp hoặc phiên cộng tác có nhiệm vụ chủ đạo là trao đổi thời gian thực.
- Soạn, cấu hình, chấm hoặc phân tích bài đánh giá.
- Survey chung hoặc hồ sơ dài có cấu trúc chủ đạo là thu thập dữ liệu và đi qua section thay vì một lượt đánh giá.

### Phán quyết ranh giới

Chỉ trả `accept` khi luật lựa chọn đạt. Trả `reject` khi có bằng chứng cho `AR-AW-90` hoặc `AR-AW-91`, hoặc một archetype khác rõ ràng sở hữu nhiệm vụ chủ đạo. Trả `needs-evidence` khi tính hữu hạn, chính sách điều hướng, chính sách thời gian, chính sách lưu hay hệ quả nộp bài có thể thay đổi đáng kể cấu trúc hoặc hợp đồng trạng thái.

## Bàn giao

1. Sự thật nghiệp vụ cung cấp ranh giới lượt làm, quyền truy cập câu, thời gian, lưu dữ liệu, kiểm tra, phản hồi và hệ quả nộp bài.
2. Archetype này phân giải các vùng vĩ mô, cấu trúc tuyến tính hoặc phi tuyến, cách thay thế responsive và nghĩa vụ trạng thái.
3. Grammar ánh xạ từng vùng và trạng thái sang owner ngữ nghĩa của họ sản phẩm, và chỉ có thể thu hẹp hành vi khi có thẩm quyền được định tuyến; nó không được thêm bộ điều hướng phi tuyến vào một lượt làm tuyến tính.
4. Principles phân giải hình học, khoảng cách, kích thước, độ ưu tiên thị giác, chuyển động và chuyển đổi theo độ vừa nội dung sau khi cấu trúc này được chấp nhận.
5. Direction biểu đạt cá tính bên trong các vùng đã chấp nhận mà không đổi quyền sở hữu hay tính tương đương tương tác.

Đầu ra archetype không nêu component sản phẩm, đường dẫn source, class, token hay breakpoint cố định.

## Bằng chứng nghiên cứu không ràng buộc

Các nguồn này chỉ là bằng chứng tham khảo. Chúng giúp kiểm tra archetype nhưng không lấn át sự thật nghiệp vụ, grammar hay principles đã được định tuyến.

- [Material Design 3 canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) phân biệt vùng chính với supporting pane và điều chỉnh canonical layout theo không gian khả dụng; nguồn này hỗ trợ nhưng không bắt buộc cấu trúc rộng phi tuyến.
- [MoodleDocs: Using Quiz](https://docs.moodle.org/405/en/Using_Quiz) thể hiện việc nhảy câu, trạng thái đánh dấu và chưa trả lời, thông báo lỗi tự động lưu, rà soát và nộp cuối trong một luồng đánh giá phi tuyến trưởng thành.
- [GOV.UK Design System: Question pages](https://design-system.service.gov.uk/patterns/question-pages/) hỗ trợ việc tập trung vào câu hiện tại, bảo toàn đường quay lại và chỉ dùng chỉ báo tiến độ đơn giản khi có ích.
- [Hướng dẫn Ofqual về bài đánh giá truy cập được](https://www.gov.uk/government/consultations/consultation-on-designing-and-developing-accessible-assessments/guidance-on-designing-and-developing-accessible-assessments) nhấn mạnh hướng dẫn rõ ràng, cấu trúc câu dễ đọc và khả năng tiếp cận sẵn sàng tới thông tin cần cho nhiệm vụ.
- [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) và [Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) hỗ trợ reflow không mất chức năng cùng chuỗi focus bảo toàn ý nghĩa khi các vùng di chuyển.
- [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) hỗ trợ thông báo trạng thái lưu, thời gian và nộp bài mà không di chuyển focus không cần thiết.

## Đầu ra

Trả về đúng các trường cấp cao nhất sau. `responsive` chứa đúng các trường con được liệt kê.

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Giá trị cố định `assessment-workbench`. |
| `situationCodes` | Các mã khớp từ bản ghi này; kết quả được chấp nhận phải có đúng một trong `AR-AW-02` hoặc `AR-AW-03`. |
| `searchAliases` | Các bí danh khám phá liên quan dùng để tìm archetype này. |
| `dominantTask` | Một câu mô tả lượt đánh giá hữu hạn trong ngữ cảnh sản phẩm đã định tuyến. |
| `regions` | Các ID vùng canonical theo thứ tự và có áp dụng; bỏ các vùng điều kiện không áp dụng. |
| `regionRelationships` | Quan hệ chính, hỗ trợ, có điều kiện và xuôi dòng rõ ràng, gồm cả biến thể điều hướng đã chọn. |
| `responsive` | Object chứa `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner` và `interactionParity`. |
| `stateObligations` | Các họ trạng thái áp dụng và những trạng thái triển khai phải chứng minh. |
| `boundaryVerdict` | `accept`, `reject` hoặc `needs-evidence`, kèm lý do ngắn. |
| `grammarHandoff` | Các quyết định ngữ nghĩa sản phẩm mà grammar đã định tuyến phải phân giải mà không đổi cấu trúc. |
| `principlesHandoff` | Chi tiết hình học, phân cấp và thích ứng để lại cho principles. |
| `confidence` | `high`, `medium` hoặc `low`, dựa trên độ đầy đủ và nhất quán của bằng chứng. |
| `evidence` | Các quan sát được định tuyến chính xác đã tạo ra kết quả khớp; nghiên cứu ngoài phải ghi là tham khảo và không thể tự xác lập sự thật sản phẩm. |

```json
{
  "archetypeId": "assessment-workbench",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "",
    "intermediate": "",
    "compact": "",
    "reflow": "",
    "readingOrder": "",
    "navigationReplacement": "",
    "stickyBehavior": "",
    "overflowOwner": "",
    "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
