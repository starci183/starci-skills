# Context cho `git.publish`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để publish một ranh giới đã được duyệt. Nó trả lời câu
"operator này được đọc những gì?" trước khi bất cứ thứ gì chạm tới remote. Context không bao giờ nới
rộng ranh giới và không bao giờ biến một thay đổi đã hoàn thành thành một sự phê duyệt.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
lấy từ một checkout thì ràng thêm cả head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Receipt route | Checkout đã xác minh, head của nó, và chính sách Git đã route. | Bắt buộc. Một lần publish không bao giờ tự phân giải checkout của mình. |
| Phê duyệt | Bản ghi cho phép publish đúng đơn vị ranh giới này. | Thẩm quyền bắt buộc. Hoàn thành không phải là phê duyệt. |
| Chính sách Git | Chính sách branch worktree, branch sửa đổi, và hai hằng cấm force. | Luật bắt buộc. Đóng ngay từ cấu trúc. |
| Danh mục hook | Các hook đã cài trên checkout này, mỗi cái đều được thi hành. | Bắt buộc. Một lần publish luôn chạy `pre-push`. |
| Quan sát remote | Tên remote, ref, và head mà nó đang mang. | Bằng chứng bắt buộc. Quyết định tính fast-forward. |
| Bằng chứng hoàn thành | Các cổng mà ranh giới đã qua trước khi được duyệt. | Bằng chứng. Không bao giờ thay thế được phê duyệt. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. đúng một receipt route có project khớp yêu cầu và trạng thái là `bound`;
2. đúng một phê duyệt gọi tên đúng `input.boundary.unit`;
3. chính sách Git đã route;
4. một danh mục hook có chứa `pre-push`;
5. đúng một quan sát remote cho đúng ref đang được publish.

## Route được đọc, không bao giờ được tìm lại

Operator này không phân giải một project thành một checkout. `workspace.bind` làm việc đó, và receipt
của nó tới đây đã ở trạng thái đã ràng. Một lần publish tự phân giải đường dẫn của mình có thể publish
từ một checkout không ai xác minh, và đó chính là thất bại mà sự tách bạch này sinh ra để ngăn. Một
receipt route không ở trạng thái `bound`, hoặc gọi tên một project khác, là `ROUTE_UNVERIFIED`.

## Cấm force là chuyện cấu trúc, không phải lời khuyên

`context.gitPolicy.forcePush` và `context.gitPolicy.historyRewrite` là hằng `false`, còn
`input.destructiveOperations` là một object đóng mà mọi thành viên đều là hằng `false`: `forcePush`,
`historyRewrite`, `resetHard`, `clean`, `stash`, `branchDelete`, `hookBypass`. Không có input nào biểu
diễn được một yêu cầu như thế.

Lý do chúng là hằng thay vì lời văn: mỗi thứ trong số đó hấp dẫn nhất đúng vào lúc một lần publish vừa
thất bại. Một cú push bị từ chối, một hook đỏ, và một file bẩn bất ngờ đều có một câu trả lời một dòng
rất hiển nhiên, và câu trả lời đó phá công việc hoặc bằng chứng của người khác. Làm cho yêu cầu đó
không biểu diễn được nghĩa là gỡ quyết định ra khỏi đúng khoảnh khắc mà nó sẽ bị ra một cách tệ nhất.

## Một hook chặn lại là một kết quả

Hook được thi hành, và `enforced: true` là hằng trên mọi mục trong danh mục. Một hook `pre-push` hỏng
sinh ra `HOOK_BLOCKED` kèm tên hook. Đó là một failure có kiểu do source sở hữu, và delta để gỡ nó là
một ranh giới đã được sửa. Nó không bao giờ là lý do để thử lại kèm một đường vòng, và ngay từ đầu
cũng không có đường vòng nào biểu diễn được.

## Một cú push bị từ chối là một kết quả

Khi remote mang những commit mà ref cục bộ không có, cú push không phải fast-forward. Operator trả
`NON_FAST_FORWARD` kèm tên head remote đã quan sát. Nó không rebase, không amend, không squash, không
force, không lease-force. Hoà giải lịch sử phân nhánh là một quyết định có chủ, và chủ đó không phải
operator này.

## Ranh giới

Context là chỉ đọc. Operator chỉ ghi receipt publication dưới `input.artifactRootRef`, cộng với chính
cú push: các head đã duyệt trên ref đã khai, và nhiều nhất một tag continuation có chú thích trỏ vào
một head do chính lần publish này đẩy lên.
