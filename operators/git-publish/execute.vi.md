# Thực thi `git.publish`

## Một việc duy nhất

Publish một ranh giới đã được duyệt, từ đúng những source head do nhiệm vụ sở hữu, lên đúng một remote
ref đã khai, không force và không viết lại lịch sử. Đây là một lần gọi operator tuyến tính. Nó không
gọi operator khác, không định tuyến workflow, không tự dừng giữa chừng, và không trả về chỉ dẫn tự do.

Nó không quyết định gì về bản thân thay đổi. Việc công việc có đúng hay không đã được các cổng sinh ra
`completionProofRefs` chốt lại, còn việc nó có được publish hay không đã do phê duyệt chốt lại.
Operator này chỉ thực hiện cú ghi, hoặc báo chính xác vì sao nó không ghi.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Kiểm tra input và resume | input, `@dynamic/workspace-route-binding.json`, `@workspaces/local/routes/<project>/<role>` (head đã đóng băng), `@remote/git/<project>/<role>` (quan sát remote) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng route | `@dynamic/workspace-route-binding.json` (checkout đã xác minh, head của nó, chính sách đã route), `@workspaces/local/routes/<project>/<role>` | — | `ROUTE_UNVERIFIED` |
| 3 | Ràng phê duyệt | input (phê duyệt gọi tên đơn vị ranh giới này, bằng chứng hoàn thành) | — | `APPROVAL_MISSING` |
| 4 | Xác minh cây làm việc | `@workspaces/local/routes/<project>/<role>` (head quan sát được, các đường dẫn bẩn, các write root đã khai, mọi branch, chính sách đã route) | — | `DIRTY_OUTSIDE_BOUNDARY`, `BRANCH_POLICY_VIOLATION` |
| 5 | Chạy hook | `@workspaces/<project>/<role>/husky` (danh mục hook, trong đó có `pre-push`) | — | `HOOK_BLOCKED` |
| 6 | Push không force | `@workspaces/local/routes/<project>/<role>` (các head đã duyệt, ref đã khai), `@remote/git/<project>/<role>` (head remote quan sát được) | `@remote/git/<project>/<role>` | `NON_FAST_FORWARD` |
| 7 | Push tag continuation | input (tag được yêu cầu), `@remote/git/<project>/<role>` (các head mà lần publish này đã đẩy) | `@remote/git/<project>/<role>` (tag continuation) | — |
| 8 | Phát ra và dừng | tất cả những gì ở trên | `@dynamic/git-publication.json` | — |

Khâu kiểm tra từ chối một receipt route ràng ở nơi khác, một phê duyệt cho đơn vị khác, một danh mục
thiếu `pre-push`, một quan sát remote của ref khác, một checkout liệt kê hai lần, một branch mà chính
sách đã route cấm, một lần publish không có gì đi trước upstream, một đường dẫn bẩn ngoài ranh giới,
và một resume không đổi gì. Head quan sát được còn được đối chiếu lại với head đã đóng băng trong lúc
xác minh cây làm việc, và một khác biệt ở đó trả về đúng lỗi trôi ấy trước khi có gì được đẩy lên.

Việc ràng route không tự phân giải đường dẫn nào: một receipt không ở trạng thái `bound`, hoặc thuộc
project khác, thì bị từ chối. Bằng chứng hoàn thành cho thấy công việc đã xong; nó không bao giờ cho
thấy công việc được phép publish, nên phải có đúng một phê duyệt gọi tên chính đơn vị ranh giới này.

Khâu xác minh ghi `BOUNDARY_CLEAN` khi không có gì đi lạc ra ngoài một write root đã khai. Hook được
thi hành trên cú push và mỗi hook đã chạy ghi một `HOOK_ENFORCED`; một hook hỏng thì kèm tên hook đó
và do source sở hữu. Một remote từ chối cú push vì nó mang những commit mà ref cục bộ không có thì kèm
tên head remote đã quan sát và do remote sở hữu, còn mỗi ref đã tiến lên ghi `REMOTE_FAST_FORWARDED`
và mỗi ref do lần publish này tạo ra ghi `REMOTE_REF_CREATED`. Khi có yêu cầu tag continuation, đúng
một tag có chú thích được đẩy lên tại một head do chính lần publish này đẩy, rồi ghi
`CONTINUATION_TAG_PUBLISHED`. Khâu phát ra ghi bản ghi publication dưới `input.artifactRootRef`, phát
đúng một output hợp với `output.schema.json`, và ràng mọi fingerprint.

## Hook chặn là một failure có kiểu, không phải cái cớ để thử lại

`HOOK_BLOCKED` là một kết quả. Delta để gỡ nó là một ranh giới đã sửa và một head mới, cấp qua đường
resume.

Nó không phải lý do để chạy lại cú push với hook bị tắt, để dời thay đổi sang một branch có hook nhẹ
hơn, hay để commit chính cấu hình hook ra khỏi đường. Không cái nào biểu diễn được:
`input.destructiveOperations.hookBypass` là hằng `false`, mọi mục trong danh mục mang `enforced: true`,
và một publication ghi lại một hook hỏng sẽ bị hợp đồng output từ chối.

## Push bị từ chối là một failure có kiểu, không phải cái cớ để rebase

`NON_FAST_FORWARD` nghĩa là remote đã đi tiếp. Commit của người khác đang nằm trên ref đó, và lần gọi
này đã quan sát một head remote mà các head cục bộ của nó không chứa.

Operator dừng lại và gọi tên head đó. Nó không rebase lên đó, không amend một commit cho cú push áp
được, không squash phần phân nhánh đi, không force, không lease-force. Hoà giải lịch sử phân nhánh làm
đổi thứ mà người khác đã pull về, nên việc đó thuộc về ai sở hữu branch. `forced` là hằng `false` trên
mọi publication, và `mode` là hằng `fast-forward-only`.

Cùng lập luận đó áp cho ba câu lệnh hấp dẫn nhất khi một lần publish thất bại, và cả ba đều không biểu
diễn được ở đây: `reset --hard` phá phần việc chưa commit mà không receipt nào ghi lại, `clean` phá
những file untracked chưa ai xem, và `stash` giấu một ranh giới bẩn thay vì giải quyết nó. Xoá branch,
dù cục bộ hay trên remote, cũng không bao giờ là một phần của việc publish.

## Thực thi khi resume

Một lần resume bắt đầu lại từ khâu kiểm tra, chỉ tái dùng những quan sát có fingerprint không đổi, và
tiêu thụ đúng phần delta. Một resume không thêm được thay đổi nào về head, phê duyệt, hook hay remote
sẽ trả `NO_PROGRESS`. Một remote được quan sát lại phải đến dưới dạng một remote head mới; cùng một
quan sát không thể cho ra một kết quả khác.

## Các đòn tấn công bắt buộc

Operator không được phép publish khi còn bất kỳ mục nào áp dụng được mà chưa xử lý:

- receipt route chưa ở trạng thái đã ràng, hoặc thuộc project khác;
- phê duyệt gọi tên một đơn vị ranh giới khác;
- một hook đã hỏng mà publication vẫn sắp được phát ra;
- kết quả `pre-push` vắng mặt trong publication;
- một ref được báo là đã publish nhưng thực ra không tiến lên;
- một tag continuation trỏ vào commit mà lần publish này không đẩy lên;
- một head được publish từ branch mà chính sách đã route cấm;
- một đường dẫn bẩn ngoài ranh giới sắp đi ké theo;
- một failure sắp bị ghi cho một domain không thể cấp được delta của nó.
