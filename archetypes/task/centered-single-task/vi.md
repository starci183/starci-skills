# Nhiệm vụ đơn tập trung giữa màn hình

## LOADS

Không có.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| ID archetype | `centered-single-task` |
| Họ | Task |
| Nhiệm vụ chủ đạo | Hoàn thành hoặc xác nhận một nhiệm vụ hữu hạn với ít ngữ cảnh xung quanh, một kết quả chính rõ ràng và đường khôi phục hoặc thoát minh bạch khi cần. |
| Bí danh tìm kiếm | nhiệm vụ tập trung, card giữa màn hình, nhiệm vụ đơn, đăng nhập, xác minh, đặt lại, mã mời, xác nhận, trạng thái hoàn tất |
| Thẩm quyền | Cấu trúc trang và hành vi responsive dùng chung giữa các sản phẩm. Archetype không chọn ngữ nghĩa sản phẩm, cách thể hiện thị giác hay giá trị triển khai. |

Archetype này được định nghĩa bằng tính hữu hạn của nhiệm vụ, không chỉ bằng việc căn giữa thị giác. Một card giữa màn hình là cách biểu đạt rộng hợp lệ, nhưng đơn vị ngữ nghĩa là `bounded-task-region`; ranh giới trang trí của nó có thể biến mất khi không gian bị giới hạn.

### Bất biến

- Trang có đúng một nhiệm vụ chủ đạo và một kết quả chính tại một thời điểm.
- `bounded-task-region` là một đơn vị ngữ nghĩa có thứ tự. Định danh, ngữ cảnh, thân nhiệm vụ, trạng thái, hành động chính và khôi phục không trở thành các vùng dashboard độc lập.
- Nội dung hỗ trợ ngắn gọn và trực tiếp giúp hoàn thành, tạo niềm tin, hiểu hệ quả hoặc khôi phục.
- Viewport có thể căn giữa nhiệm vụ khi đủ chỗ, nhưng việc căn giữa phải nhường trước khi nội dung bị cắt, focus bị che hoặc xuất hiện chủ sở hữu cuộn thứ hai.
- Trình bày gọn có thể bỏ ranh giới card trang trí mà không đổi thứ tự nhiệm vụ, measure nhiệm vụ, hành vi trạng thái hay khả năng tương tác.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-CS-01` | Bề mặt có một nhiệm vụ chủ đạo và một kết quả chính; mọi nội dung hỗ trợ đều phục vụ nhiệm vụ đó. | Tín hiệu dương bắt buộc. |
| `AR-CS-02` | Trạng thái đầu vào là nhập liệu hữu hạn, xác thực, xác minh, khôi phục hoặc một hành động xác nhận ngắn. | Chọn biến thể tương tác. |
| `AR-CS-03` | Trạng thái đầu vào là trạng thái kết thúc hoặc xác nhận hữu hạn với một bước tiếp theo rõ ràng. | Chọn biến thể trạng thái. |
| `AR-CS-04` | Thất bại, hủy hoặc không thể tiếp tục đòi hỏi một đường khôi phục hoặc thoát rõ ràng. | Có `recovery-or-exit` và chứng minh nó trong mọi cách trình bày. |
| `AR-CS-90` | Nhiệm vụ dài, chia section, có bản nháp đáng kể để tiếp tục hoặc cần điều hướng tiến độ nhiều bước. | Từ chối archetype này; dùng archetype form hoặc luồng có hướng dẫn. |
| `AR-CS-91` | Việc hoàn thành cần nội dung tham chiếu, so sánh, lịch sử hoặc một vùng làm việc khác tồn tại đồng thời. | Từ chối archetype này; dùng archetype detail, split hoặc workbench. |
| `AR-CS-92` | Nhiều nhiệm vụ, kết quả hoặc lời kêu gọi hành động đồng cấp cạnh tranh độ ưu tiên. | Từ chối archetype này; bề mặt không phải nhiệm vụ đơn. |

### Luật lựa chọn

Chỉ chọn `centered-single-task` khi có bằng chứng cho `AR-CS-01` và đúng một chế độ đầu vào, `AR-CS-02` hoặc `AR-CS-03`, đồng thời không có mã từ chối. Một nhiệm vụ tương tác về sau có thể đạt trạng thái thành công cuối mà không đồng thời khớp chế độ đầu vào trạng thái.

Nếu độ dài nội dung, số quyết định hoặc nhu cầu tham chiếu ngoài làm ranh giới chưa chắc chắn, trả về `needs-evidence`. Không chọn archetype này chỉ vì mockup đặt một card giữa màn hình.

## Sơ đồ vùng

```text
focused-viewport
└─ bounded-task-region
   ├─ task-identity
   ├─ concise-context
   ├─ task-body
   ├─ task-status
   ├─ task-actions
   │  ├─ primary-outcome
   │  └─ secondary-safe-action [when required]
   └─ recovery-or-exit [AR-CS-04 or evidenced need]
```

### Nghĩa vụ của vùng

| Vùng | Nghĩa vụ |
|---|---|
| `focused-viewport` | Cung cấp khoảng trống yên tĩnh xung quanh và một chủ sở hữu cuộn cấp trang; nó không được trở thành yêu cầu thị giác rỗng trên bề mặt hạn chế. |
| `bounded-task-region` | Chứa trọn nhiệm vụ như một chuỗi ngữ nghĩa và giữ measure dễ đọc, dễ vận hành. Ranh giới card thị giác là tùy chọn. |
| `task-identity` | Gọi tên chính xác nhiệm vụ hoặc kết quả để người dùng xác nhận họ đang ở đâu. |
| `concise-context` | Chỉ giải thích thông tin cần thiết để hành động, tin tưởng yêu cầu hoặc hiểu hệ quả. |
| `task-body` | Sở hữu các input hữu hạn, nội dung xác minh, xác nhận hoặc kết quả. |
| `task-status` | Sở hữu trạng thái kiểm tra, chờ, thành công, thất bại và bị chặn mà không đẩy lệch vùng không liên quan. |
| `task-actions` | Làm cho một kết quả chính rõ ràng, đồng thời giữ mọi hành động phụ ở vai trò phụ thấy được. |
| `recovery-or-exit` | Cung cấp cách an toàn để thử lại, khôi phục, đổi đường hoặc rời đi khi người dùng không thể hoàn tất đường chính. |

### Quan hệ giữa các vùng

Thứ tự ngữ nghĩa cố định là: định danh, ngữ cảnh ngắn, thân nhiệm vụ, trạng thái liên quan tới thân đó, hành động, rồi khôi phục hoặc thoát. Lỗi inline có thể xuất hiện cạnh đích của chúng trong khi vẫn thuộc `task-status`.

Không có rail hỗ trợ, lưới card đồng cấp, pane detail cố định hay vùng điều hướng độc lập. Shell sản phẩm toàn cục chỉ có thể bao quanh archetype khi nó không cạnh tranh với nhiệm vụ đơn; quyền sở hữu shell nằm ngoài bản ghi này.

Với trạng thái đầu vào kết thúc, `task-body` chứa kết quả hoặc xác nhận thay vì cấu trúc form rỗng. Với đầu vào tương tác, trạng thái thành công có thể thay thế hoặc phân giải thân nhiệm vụ bên trong cùng chuỗi hữu hạn, đồng thời bảo toàn hành động an toàn tiếp theo.

## Hợp đồng responsive

### Rộng

- Căn giữa `bounded-task-region` theo chiều ngang trong viewport nhiệm vụ khả dụng và cho nó một measure đọc hữu hạn.
- Chỉ được căn giữa dọc khi toàn bộ nhiệm vụ có ý nghĩa, lỗi, khôi phục và điều khiển đang focus vẫn dễ tiếp cận. Khi nội dung tăng, căn về đầu và để trang cuộn.
- Một ranh giới thị giác giống card có thể nhóm nhiệm vụ, nhưng không được tạo container trang trí lồng nhau hoặc ngụ ý thêm vùng.
- Giữ hành động chính cùng thân nhiệm vụ. Khôi phục hoặc thoát vẫn đủ gần để tìm thấy nhưng ở vai trò phụ so với kết quả chính.
- Khoảng trống xung quanh chỉ có thể mang định danh sản phẩm hoặc thông tin trấn an khi chúng không đưa vào một nhiệm vụ cạnh tranh.

### Trung gian

- Bảo toàn measure hữu hạn của nhiệm vụ trong khi giảm khoảng trống xung quanh. Nới căn giữa dọc trước khi giảm chiều rộng nội dung hữu dụng hoặc giấu khôi phục.
- Để nhãn dài, chữ kiểm tra và bản địa hóa làm vùng cao lên; không nén nhiệm vụ vào một card cuộn bên trong.
- Giữ nguyên chuỗi ngữ nghĩa và độ ưu tiên hành động chính. Không tạo cột bên chỉ vì vẫn còn một ít không gian ngang.
- Nếu bàn phím phần mềm, zoom hoặc chiều cao giảm làm việc căn giữa bất ổn, chuyển sang luồng trang căn đầu mà không chờ một breakpoint có tên.

### Gọn

- Dùng một luồng trang dọc và chiều rộng an toàn khả dụng. Có thể bỏ ranh giới card trang trí, elevation hoặc nền ngoài tương phản để nhiệm vụ không trở thành card chật chội bên trong viewport hẹp.
- Việc bỏ ranh giới không được xóa ngữ nghĩa `bounded-task-region`, measure dễ đọc, thứ tự bên trong hay sự tách biệt với điều hướng toàn cục.
- Bảo toàn định danh nhiệm vụ, ngữ cảnh bắt buộc, toàn bộ input hoặc nội dung kết quả, kiểm tra, hành động chính và khôi phục. Không có gì bị chuyển vào vị trí chỉ hiện khi hover hoặc chỉ tìm thấy trong overflow.
- Giữ hành động chính trong luồng nhiệm vụ bình thường. Hành động cố định không thuộc archetype này và chỉ có thể được thẩm quyền sau đưa vào khi chứng minh nó không che nội dung hoặc focus.
- Khi bàn phím phần mềm mở, input đang hoạt động, nhãn, lỗi và hành động bắt buộc kế tiếp vẫn truy cập được qua luồng cuộn duy nhất của trang.

### Reflow

- Thứ tự đọc và focus vẫn là `task-identity`, `concise-context`, `task-body`, `task-status` liên quan, `task-actions`, `recovery-or-exit`.
- Chữ, nhãn, mã, thông báo lỗi và chuỗi bản địa hóa xuống dòng mà không cuộn ngang toàn trang, cắt hoặc chồng lấn.
- Trang sở hữu overflow. `bounded-task-region` không được trở thành panel cuộn độc lập; nếu nhiệm vụ cần tài liệu hoặc dataset lớn bên trong, phải xét lại phán quyết ranh giới.
- Nội dung tăng sẽ đẩy vùng về đầu block thay vì bảo toàn căn giữa toán học bằng cái giá nội dung không thể truy cập.
- Mặc định không có hành vi sticky. Chrome trình duyệt hoặc sản phẩm toàn cục nằm ngoài hợp đồng này; mọi sticky được thêm bởi thẩm quyền sau phải giữ focus nhìn thấy và chuỗi nhiệm vụ trọn vẹn.

### Tương đương tương tác

- Mọi cách trình bày đều bảo toàn hành vi vào nhiệm vụ, kiểm tra, gửi, thành công, lỗi có thể khôi phục, bị chặn, thử lại và thoát áp dụng cho nhiệm vụ.
- Đổi cách trình bày không xóa giá trị đã nhập, khởi động lại tiến trình xác minh, lặp thao tác hoặc giấu đường khôi phục.
- Lỗi kiểm tra xác định input bị ảnh hưởng bằng chữ; focus chỉ chuyển tới đích lỗi hữu ích sau một sự kiện kiểm tra hoặc gửi do người dùng kích hoạt.
- Trạng thái đang chờ và thành công có thể được thông báo mà không cướp focus; chuyển trạng thái cuối có đích focus rõ ràng và một hành động tiếp theo minh bạch.
- Người dùng bàn phím, con trỏ và công nghệ hỗ trợ nhận cùng nhiệm vụ, trạng thái, kết quả chính và khả năng khôi phục.

## Nghĩa vụ trạng thái

| Họ trạng thái | Trạng thái và hành vi bắt buộc |
|---|---|
| Đầu vào | `resting`, `prefilled` khi có dữ liệu được định tuyến, và `unavailable` khi nhiệm vụ không thể bắt đầu. Điền sẵn không bao giờ giấu nội dung sẽ được gửi. |
| Nhập liệu | `untouched`, `dirty`, `validating`, `valid`, `invalid`. Lỗi có nội dung chữ, liên kết với đích và giữ giá trị người dùng trừ khi an toàn đòi hỏi khác. |
| Thao tác | `ready`, `submitting`, `succeeded`, `submit-failed`. Không thể kích hoạt thao tác chính hai lần khi đang chờ. |
| Xác minh | Khi áp dụng: `code-requested`, `code-ready`, `checking`, `incorrect`, `expired`, `resend-available`, `resending`, `resend-failed`. Thay đổi phụ thuộc thời gian vẫn được thông báo và có thể khôi phục. |
| Khôi phục | `recovery-available`, `recovering`, `recovery-sent`, `recovery-failed`, cùng một đường thoát an toàn khi không thể khôi phục. |
| Trạng thái cuối | `success`, `recoverable-error`, `blocked`, `cancelled`. Mỗi trạng thái giải thích điều đã xảy ra, công việc trước có được giữ không và một bước tiếp theo an toàn nhất. |
| Focus | Focus nhiệm vụ ban đầu, focus mục sai đầu tiên, thông báo trạng thái chờ, focus kết quả cuối và focus quay về từ khôi phục đều có đích rõ ràng. Chỉ cập nhật trạng thái thì không đổi ngữ cảnh bất ngờ. |
| Lỗi dữ liệu | Lỗi tải ban đầu, lời mời cũ hoặc không hợp lệ, dependency không khả dụng và lỗi mạng. Lỗi nằm trong nhiệm vụ hữu hạn và bộc lộ thử lại hoặc thoát thay vì render viewport trống. |

## Ranh giới

### Chấp nhận

- Đăng nhập, xác minh ngắn, khôi phục mật khẩu, mã mời, đồng ý gọn hoặc một hành động xác nhận hữu hạn.
- Xác nhận thành công, thất bại hoặc hoàn tất với một hành động tiếp theo rõ ràng.
- Một form rất nhỏ chỉ khi mọi trường phục vụ một kết quả, không cần điều hướng section và có thể hiểu mà không cần nội dung tham chiếu đồng thời.

### Từ chối

- Form dài hoặc chia section, onboarding, hồ sơ hoặc checkout cần các bước, tiếp tục bản nháp hay mô hình tiến độ.
- Trang detail mà người dùng phải đọc bằng chứng đáng kể trước khi quyết định.
- Nhiệm vụ cần preview song song, lịch sử, tài liệu chính sách, so sánh hoặc dữ liệu tham chiếu trực tiếp.
- Dashboard, catalog, tập settings hoặc trang có nhiều hành động đồng cấp.
- Tương tác modal nhúng trong trang khác; modal là hành vi container, không phải archetype trang này.
- Mọi bề mặt được chọn chỉ vì thiết kế thị giác hiện tại có card căn giữa.

### Phán quyết ranh giới

Chỉ trả `accept` khi luật lựa chọn đạt và toàn bộ nhiệm vụ có thể nằm trong một chuỗi ngữ nghĩa hữu hạn. Trả `reject` khi có bằng chứng cho `AR-CS-90`, `AR-CS-91` hoặc `AR-CS-92`, hoặc một archetype khác sở hữu nhiệm vụ chủ đạo. Trả `needs-evidence` khi độ dài nhiệm vụ, độ ưu tiên kết quả, khôi phục, tham chiếu ngoài hoặc hành vi tiếp tục chưa được phân giải.

## Bàn giao

1. Sự thật nghiệp vụ cung cấp kết quả chính xác, input bắt buộc, ràng buộc bảo mật, kiểm tra, hệ quả, khôi phục và đích đến tiếp theo.
2. Archetype này phân giải một vùng hữu hạn, thứ tự của nó, việc bỏ ranh giới responsive, overflow cấp trang và nghĩa vụ trạng thái.
3. Grammar ánh xạ các vùng và trạng thái sang owner ngữ nghĩa cùng vocabulary của họ sản phẩm; nó không được biến ngữ cảnh hỗ trợ thành nhiệm vụ cạnh tranh.
4. Principles phân giải measure, khoảng cách, căn chỉnh, ranh giới thị giác, phân cấp, chuyển động và chuyển đổi theo độ vừa nội dung sau khi cấu trúc này được chấp nhận.
5. Direction biểu đạt cá tính sản phẩm bên trong chuỗi hữu hạn mà không thêm rail, card đồng cấp hay hành động chính thứ hai.

Đầu ra archetype không nêu component sản phẩm, đường dẫn source, class, token hay breakpoint cố định.

## Bằng chứng nghiên cứu không ràng buộc

Các nguồn này chỉ là bằng chứng tham khảo. Chúng giúp kiểm tra archetype nhưng không lấn át sự thật nghiệp vụ, grammar hay principles đã được định tuyến.

- [PatternFly Bullseye layout](https://www.patternfly.org/layouts/bullseye/html) mô tả việc căn giữa một phần tử con duy nhất trong phần tử cha, hỗ trợ cách biểu đạt không gian rộng mà không biến việc căn giữa thành định danh ngữ nghĩa.
- [USWDS authentication pages](https://designsystem.digital.gov/templates/authentication-pages/) khuyên giải thích ngữ cảnh cần thiết và loại bỏ yếu tố phân tán không cần thiết; [hướng dẫn sign-in](https://designsystem.digital.gov/templates/authentication-pages/sign-in/) của họ cũng nhấn mạnh nhiệm vụ rõ ràng, gọn, thân thiện mobile với khôi phục và phản hồi lỗi an toàn.
- [GOV.UK Design System question pages](https://design-system.service.gov.uk/patterns/question-pages/) hỗ trợ bắt đầu bằng một câu hỏi tập trung trên mỗi trang cùng đường quay lại hoặc tiến lên rõ ràng.
- [Material Design 3 canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) ghi nhận layering có thể tạo trải nghiệm tập trung vào nhiệm vụ, trong khi các ví dụ thích ứng củng cố việc cách trình bày đổi theo không gian khả dụng.
- [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow), [Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) và [Understanding Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification) hỗ trợ một chuỗi reflow duy nhất, focus có ý nghĩa và lỗi bằng chữ gắn với đích cụ thể.

## Đầu ra

Trả về đúng các trường cấp cao nhất sau. `responsive` chứa đúng các trường con được liệt kê.

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Giá trị cố định `centered-single-task`. |
| `situationCodes` | Các mã khớp từ bản ghi này; kết quả được chấp nhận có `AR-CS-01`, đúng một chế độ đầu vào và không có mã từ chối. |
| `searchAliases` | Các bí danh khám phá liên quan dùng để tìm archetype này. |
| `dominantTask` | Một câu gọi tên kết quả hữu hạn duy nhất trong ngữ cảnh sản phẩm đã định tuyến. |
| `regions` | Các ID vùng canonical theo thứ tự và có áp dụng; bỏ các vùng tùy chọn không có bằng chứng. |
| `regionRelationships` | Chuỗi ngữ nghĩa cố định, hành động chính/phụ và mọi quan hệ khôi phục có điều kiện. |
| `responsive` | Object chứa `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner` và `interactionParity`. |
| `stateObligations` | Các họ trạng thái áp dụng và những trạng thái triển khai phải chứng minh. |
| `boundaryVerdict` | `accept`, `reject` hoặc `needs-evidence`, kèm lý do ngắn. |
| `grammarHandoff` | Các quyết định ngữ nghĩa sản phẩm mà grammar đã định tuyến phải phân giải mà không thêm nhiệm vụ chủ đạo khác. |
| `principlesHandoff` | Measure, căn chỉnh, ranh giới thị giác và chi tiết thích ứng để lại cho principles. |
| `confidence` | `high`, `medium` hoặc `low`, dựa trên độ đầy đủ và nhất quán của bằng chứng. |
| `evidence` | Các quan sát được định tuyến chính xác đã tạo ra kết quả khớp; nghiên cứu ngoài phải ghi là tham khảo và không thể tự xác lập sự thật sản phẩm. |

```json
{
  "archetypeId": "centered-single-task",
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
