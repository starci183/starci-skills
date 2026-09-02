# Output của `git.publish`

Operator trả về đúng một vỏ đóng với `outcome` bằng `published` hoặc `blocked`. Nó không bao giờ phát
ra handoff hay chỉ dẫn định tuyến tự do.

## Receipt khi đã publish

Một receipt đã publish chứa:

- các binding chính xác về project, receipt route, phê duyệt, ranh giới, chính sách, head, input và
  tiến độ;
- remote, ref, `mode: "fast-forward-only"` và `forced: false`;
- một mục cho mỗi head đã đẩy, nêu checkout, branch, head chính xác, head remote mà nó thay thế, và số
  commit đã tiến lên;
- tag continuation có chú thích, hoặc null;
- một kết quả cho mỗi hook đã chạy;
- các finding cho việc thi hành hook, ranh giới sạch, từng ref đã fast-forward, từng ref được tạo mới,
  và tag đã publish.

Receipt chứng minh rằng đúng những head này đã tới đúng ref này dưới đúng những hook này. Nó không
chứng minh gì về chất lượng thay đổi, và không mang phán quyết, điểm số hay tuyên bố đạt nào.

## Các finding

| Mã | Ý nghĩa |
| --- | --- |
| `HOOK_ENFORCED` | Hook này đã chạy và không bị đi vòng. Bắt buộc cho mọi kết quả hook. |
| `BOUNDARY_CLEAN` | Không có gì bẩn nằm ngoài ranh giới đã khai. |
| `REMOTE_FAST_FORWARDED` | Ref này tiến lên từ head remote mà nó mang trước đó. |
| `REMOTE_REF_CREATED` | Ref này chưa tồn tại trên remote trước lần publish này. |
| `CONTINUATION_TAG_PUBLISHED` | Một tag có chú thích đã được đẩy lên. Bắt buộc mỗi khi publish một tag. |

`BOUNDARY_CLEAN` là finding duy nhất mà một receipt bị chặn được mang, vì nó là finding duy nhất mô tả
một quan sát chứ không phải một cú ghi.

## Receipt khi blocked

Một receipt bị chặn không có publication. Nó chứa đúng một failure có kiểu, các chủ thể và tham chiếu
liên quan, domain sở hữu, khả năng thử lại, và chỉ khi thử lại được thì mới kèm token dùng một lần
cùng phần vật liệu còn thiếu.

## Mã lỗi

| Mã | Vấn đề sở hữu | Chủ sở hữu | Delta hợp lệ |
| --- | --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | caller | Input đã sửa. |
| `ROUTE_UNVERIFIED` | Receipt route chưa ràng, hoặc thuộc project khác. | workspace | Một receipt route đã ràng. |
| `APPROVAL_MISSING` | Không phê duyệt nào phủ đúng đơn vị ranh giới này. | caller | Một phê duyệt cho đơn vị này. |
| `BRANCH_POLICY_VIOLATION` | Một head nằm trên branch mà chính sách đã route cấm. | workspace | Các head quay lại branch sửa đổi. |
| `DIRTY_OUTSIDE_BOUNDARY` | Có thứ bẩn nằm ngoài ranh giới đã khai. | source | Cây sạch, hoặc write root đã sửa. |
| `HOOK_BLOCKED` | Một hook Git từ chối lần publish. | source | Một ranh giới đã sửa và một head mới. |
| `NON_FAST_FORWARD` | Remote mang những commit mà ref cục bộ không có. | remote | Một branch đã hoà giải, do chủ của nó quyết. |
| `SOURCE_DRIFT` | Head quan sát được khác head đã đóng băng. | source | Một binding head được làm mới. |
| `NO_PROGRESS` | Một resume không thêm delta nào. | caller | Head, phê duyệt, hook hoặc remote mới thật sự. |

`HOOK_BLOCKED` và `NON_FAST_FORWARD` là hai failure mà một lần publish thật sự gặp trong thực tế, và
cả hai là kết quả chứ không phải chướng ngại. Mỗi cái gọi tên chủ thể của mình để phần sửa có địa chỉ:
hook đã từ chối cú push, và head remote đã phân nhánh.

## Bất biến liên trường

- `outcome="published"` đòi `receipt.status="published"`, `publication` khác null, `failure` null và
  `resume` null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `publication` null và `failure` khác null.
  Failure thử lại được thì cần resume; failure không thử lại được thì cấm resume.
- Mỗi mã failure mang domain sở hữu riêng; lỗi của source, workspace hay remote không bao giờ được ghi
  cho caller.
- `HOOK_BLOCKED` và `NON_FAST_FORWARD` mỗi cái gọi tên ít nhất một chủ thể.
- Một publication mang kết quả hook `pre-push`, ghi `HOOK_ENFORCED` cho mọi hook đã chạy, và không
  chứa kết quả hook nào hỏng.
- Mọi head đã publish đều làm ref tiến lên: `previousRemoteHead` không bao giờ bằng `head`, và
  `commitCount` ít nhất bằng một.
- Mỗi head đã publish ghi `REMOTE_FAST_FORWARDED` khi nó thay một head remote, và `REMOTE_REF_CREATED`
  khi không có head nào để thay.
- Dưới chính sách worktree `forbidden`, mọi head đã publish đều nằm trên branch sửa đổi.
- `branchRef` đã publish gọi tên branch mà có head đã publish nằm trên đó, và không checkout nào xuất
  hiện hai lần.
- Một tag continuation có chú thích phải có ref `refs/tags/<tên>` khớp, trỏ vào một head do lần publish
  này đẩy lên, và được ghi lại.
- Một receipt bị chặn không ghi finding nào ngoài `BOUNDARY_CLEAN`.
- `artifactRefs` đăng ký bản ghi publication.
- `handoff` luôn là `null`.

## Kết quả thực tế

Publish ranh giới `api.core` từ một checkout trên `mtp`: receipt ghi hook pre-push đã qua, một head làm
ref remote tiến lên bốn commit, một tag continuation có chú thích trên head đó, và một ranh giới sạch.

Publish trong lúc người khác vừa đẩy lên cùng ref: lần gọi trả `NON_FAST_FORWARD` do remote sở hữu,
kèm tên head remote đã quan sát. Không gì được đẩy lên, không gì bị rebase, và resume chờ chủ branch
hoà giải.
