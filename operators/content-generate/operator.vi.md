# content.generate

## Việc

Sinh hoặc viết lại một đơn vị nội dung giáo dục trong một lượt tuyến tính: một brief người dạy ràng
buộc mọi thứ sau nó, một bản viết cho mỗi ngôn ngữ đã khai, hình ảnh làm theo một tuyên bố đã nêu, mã
nguồn và các phép kiểm chạy được thật, và một phản biện độc lập nhận các artifact mà không có lý lẽ
của người sản xuất.

## Brief đi trước và ràng buộc mọi thứ sau nó

Brief người dạy được viết trước mọi thứ khác, từ chương trình học và bằng chứng nguồn, trong một lượt
chạy mới không thừa hưởng lượt nào. Nó công bố đầu vào của người học, các kết quả quan sát được, các
tuyên bố mà một hình ảnh được phép mã hoá, các ví dụ, và các disposition thêm, đổi, bỏ tường minh,
rồi được lấy fingerprint để không gì phía sau nới nó ra. Mọi thứ sau đó được đo theo nó: một bản viết
chỉ được nhận phủ một kết quả mà brief đã công bố, một hình ảnh chỉ được mã hoá một tuyên bố brief đã
công bố, và mọi bản viết đã khai phải phủ trọn tập kết quả trước khi đơn vị được ship. Một bản viết
chỉ phủ một phần brief là một bài học thiếu ở ngôn ngữ này và đủ ở ngôn ngữ kia, đúng là khiếm khuyết
lặng lẽ mà phép kiểm này sinh ra để bắt. Một disposition đổi hay bỏ phải nêu tên thứ nó tác động, vì
một disposition không có đích chỉ là một mong muốn.

## Mã sinh ra phải chạy được thật

Mỗi track cài đặt được build bằng đúng câu lệnh mà `commands` nêu cho nó, và mã thoát được đọc và ghi
vào `response/data/e2e.json`. Một mã thoát khác không thì không được ship, vì bài học sẽ nói với người
học rằng đoạn code chạy được mà không có bằng chứng của ai cả. Bước 7 chạy câu lệnh đã khai cho từng
track trong một vòng lặp chạy, đọc và sửa có trần là `maxE2eIterations`; vòng lặp nằm bên trong bước,
nên `E2E_FAILED` được nêu một lần, khi hết số vòng, chứ không phải ngay lượt chạy đỏ đầu tiên. Vòng
lặp được sửa phần cài đặt hoặc bộ khung kiểm. Nó không bao giờ được dời contract mà nó bị đo theo, nên
fingerprint contract được lấy trước lượt chạy đầu và so lại sau lượt cuối: một test bị xoá, bị bỏ qua,
bị nới hay bị đặc cách để lượt chạy thành xanh chính là thất bại mà phép so ấy sinh ra để bắt, và nó
là `CONTRACT_WEAKENED`. Một track mang câu lệnh build và mã thoát của nó, một lượt chạy mang câu lệnh,
mã thoát và các assertion có tên, và không cái nào mang một câu tuyên bố thành công.

## Hình ảnh làm theo một ý định đã nêu

Hình ảnh được dẫn ra từ các tuyên bố của brief, prompt nói ý định ấy được lưu cạnh kết quả, và kết quả
được soi về độ đọc được, thứ bậc và độ trung thành với tuyên bố. Bước 5 chỉ chạy khi `stageModes` bật
hình ảnh; khi tắt, bước không sinh gì cả, không hình và không prompt, và biên nhận ghi
`STAGE_DISABLED`, vì một quyết định không để lại dấu vết sau này đọc thành một sự bỏ sót. Một tuyên bố
brief chưa công bố thì không được xuất hiện, và một hình ảnh trượt chính phép soi trung thành của nó
thì không được ship. Hình ảnh không phải đồ trang trí thêm vào lúc cuối; nó là một trong các tuyên bố,
được vẽ ra.

## Phản biện là một cuộc trao đổi lồng, và sửa lại là fallback có trần

Sau phép kiểm chạy được, nhánh tạm ngưng: nó phát `response/response.json` với status `waiting` và
`awaiting { exchange: review, kind: content-review }`. Orchestrator ghi `review/request/request.json`
với các artifact đã sản xuất và các tuyên bố chúng đưa ra làm đầu vào, không bao giờ kèm lý lẽ của
người sản xuất, và chạy một agent mới trên chính profile của operator này, không thừa hưởng lượt nào;
agent ấy không bao giờ là lượt chạy đã viết brief hay một bản viết, và nó chỉ ghi `review/response/`.
Nó chấm độ đúng, sư phạm, giá trị phỏng vấn và ngôn ngữ, cùng độ trung thành thị giác, chất lượng mã
và bằng chứng chạy được ở những giai đoạn đã chạy. Duyệt đòi mọi điểm áp dụng được từ 85 trở lên và
không còn finding lỗi nào mở. Một yêu cầu sửa trả về không phải một mã dừng: nó là fallback
`REVIEW_REVISION_REQUIRED`, và nhánh sửa đúng những artifact mà các finding của phản biện nêu tên,
theo giai đoạn chủ, rồi mở lại cuộc trao đổi cho vòng kế. Trần là `maxReviewRounds`; khi hết số vòng
ấy mà phản biện vẫn trả về yêu cầu sửa, `REVIEW_ROUNDS_EXHAUSTED` dừng hẳn, vì một đơn vị bị viết lại
cho vừa lòng người phản biện qua vô số vòng là một đơn vị do người phản biện viết. Một đơn vị tự tác
giả của nó duyệt thì chưa được phản biện, và đó là lý do lượt chạy chung, lượt thừa hưởng và lý lẽ của
người sản xuất là ba điều bị từ chối riêng biệt.

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: brief, biên nhận, bản ghi máy của phần
build và phép kiểm chạy được, cùng các bản viết, hình, prompt và track dưới `response/artifacts/`;
agent phản biện chỉ ghi `review/response/`. Nó chỉ chạy các câu lệnh build và kiểm đã khai. Nó không
bao giờ viết một bài trước khi brief được đóng băng hay vượt ra ngoài những gì brief công bố, không
nhận một kết quả học tập, ví dụ hay tuyên bố thị giác mà brief không công bố, không báo cáo một lần
build hay một phép kiểm chưa chạy hoặc chưa đọc mã thoát, không đổi contract chạy được trong vòng lặp
sửa, không để người sản xuất một artifact tự thực hiện, lái hay ra đề cho phản biện của chính nó, và
không duyệt một đơn vị khi còn một điểm áp dụng được nằm dưới mức tối thiểu đã công bố. Nó không sửa
chương trình học, không publish đơn vị lên đối tượng được phục vụ, và không tuyên bố mức sẵn sàng nào
vượt quá các phép kiểm nó thực sự đã chạy.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@remote/minio/<contentId>/<locale>` | bài học như đang được phục vụ, theo fingerprint của đối tượng đã tải; đơn vị đang được viết hoặc sửa | có |
| `@worktrees/sessions/central-runtime` | runtime AI chạy, đọc và sửa mã sinh ra, theo generation | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `content-generation-receipt` | một lượt chạy trước của `content.generate` trên cùng đơn vị; lịch sử hồi quy, vắng mặt ở lượt đầu | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `unit` | id | — | Đơn vị nội dung đang được viết hoặc sửa |
| `naturalLanguages` | list | vi | Các ngôn ngữ đơn vị được viết bằng; mỗi ngôn ngữ phủ trọn tập kết quả |
| `implementationLanguages` | list | empty | Các ngôn ngữ mà track cài đặt được viết bằng; rỗng nghĩa là không có mã và không có phép kiểm chạy được |
| `stageModes` | list `{image}` | image off | Giai đoạn tuỳ chọn nào chạy; `image on` bật bước 5 |
| `commands` | list `{language, buildCommand, checkCommand}` | the commands the unit declares | Đúng câu lệnh build và kiểm cho mỗi track |
| `maxE2eIterations` | number 1–20 | 2 | Bước 7 được tiêu bao nhiêu vòng chạy, đọc và sửa trước khi `E2E_FAILED` |
| `maxReviewRounds` | number 1–20 | 2 | Fallback sửa lại được tiêu bao nhiêu vòng phản biện trước khi `REVIEW_ROUNDS_EXHAUSTED` |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume` | `request/request.json`, đầu vào `content-generation-receipt` nếu có, @remote/minio/<contentId>/<locale> ở ràng buộc đơn vị đã đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng đơn vị đang phục vụ và runtime | `unit` | @remote/minio/<contentId>/<locale> cho chương trình học và văn phong như đang phục vụ, @worktrees/sessions/central-runtime cho cấu hình runtime | — | — |
| 3 | Viết và đóng băng brief | `naturalLanguages`, `implementationLanguages` | @remote/minio/<contentId>/<locale> cho chương trình học và bằng chứng nguồn | `response/brief.md` | `BRIEF_UNBOUND` |
| 4 | Viết mọi bản đã khai | `naturalLanguages` | `response/brief.md` như brief đã đóng băng | `response/artifacts/article.<language>.md` | `OUTCOME_UNCOVERED` |
| 5 | Sinh hình theo các tuyên bố của nó, chỉ khi `stageModes` bật | `stageModes` | `response/brief.md` cho các tuyên bố và ý định hình ảnh đã nêu | `response/artifacts/image.<name>`, `response/artifacts/prompt.<name>.txt` | `IMAGE_UNAVAILABLE` |
| 6 | Cài đặt mọi track đã khai | `implementationLanguages`, `commands` | `response/brief.md`, @worktrees/sessions/central-runtime nơi mỗi câu lệnh build chạy | `response/artifacts/track.<language>.<extension>` | `CODE_BUILD_FAILED` |
| 7 | Chạy phép kiểm chạy được, tối đa `maxE2eIterations` vòng | `maxE2eIterations` | @worktrees/sessions/central-runtime nơi mỗi câu lệnh đã khai chạy | `response/data/e2e.json` | `E2E_FAILED`, `CONTRACT_WEAKENED` |
| 8 | Chờ phản biện: tạm ngưng, một agent mới đọc các artifact mà không có lý lẽ của người sản xuất, sửa và mở lại khi còn vòng | `maxReviewRounds` | `review/response/review.md` khi cuộc trao đổi done | `response/response.json` (waiting, awaiting review) | `REVIEW_REVISION_REQUIRED`, `REVIEW_ROUNDS_EXHAUSTED` |
| 9 | Viết biên nhận và phát | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | — |

Với mặc định, đơn vị là một bản tiếng Việt, không hình, không track và không phép kiểm chạy được, và
chất lượng của nó dựa hoàn toàn vào bước 8. Chạy lại thì bắt đầu lại từ bước 1, chỉ dùng lại quan sát
có fingerprint không đổi, và tiêu thụ đúng phần delta; một brief đã sửa tới dưới dạng một fingerprint
mới, vì cùng một fingerprint không thể cho một câu trả lời khác. Biên nhận không tuyên bố việc
publish, không tuyên bố kết quả học tập trong sản phẩm thật, và không tuyên bố mức chấp nhận nào vượt
quá các phép kiểm đã thực sự chạy.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `content-generation-receipt` | `response/response.md` | md | có |
| `content-brief` | `response/brief.md` | md | có |
| `e2e` | `response/data/e2e.json` | data | không |
| `content-review` | `review/response/review.md` | md | có |
| `article` | `response/artifacts/article.<language>.md` | artifact | có |
| `image` | `response/artifacts/image.<name>` | artifact | không |
| `image-prompt` | `response/artifacts/prompt.<name>.txt` | artifact | không |
| `track` | `response/artifacts/track.<language>.<extension>` | artifact | không |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `BRIEF_UNBOUND` | terminate |
| `OUTCOME_UNCOVERED` | terminate |
| `IMAGE_UNAVAILABLE` | terminate |
| `CODE_BUILD_FAILED` | terminate |
| `E2E_FAILED` | terminate |
| `CONTRACT_WEAKENED` | terminate |
| `REVIEW_REVISION_REQUIRED` | fallback |
| `REVIEW_ROUNDS_EXHAUSTED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| đối tượng nội dung được route hoặc runtime dùng chung không trả lời ở ràng buộc đã đóng băng | `workspace.bind` |
