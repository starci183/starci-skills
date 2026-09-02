# Input cho `git.publish`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
ranh giới cần publish cùng đúng những head nó đẩy lên. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `git.publish`.
- `context`: các binding thẩm quyền và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một lần publish đã đóng băng.

## Các binding context

`context.routeReceipt` là bắt buộc và `status` của nó là hằng `bound`; một lần publish không bao giờ
tự phân giải checkout của mình. Project của nó phải bằng `input.project`.

`context.approval` là bắt buộc và `scopeUnit` của nó phải bằng `input.boundary.unit`. Một phê duyệt
cho đơn vị khác là một phê duyệt thật, nhưng cho ranh giới của người khác.

`context.gitPolicy` mang chính sách worktree đã route và branch sửa đổi, cùng `forcePush` và
`historyRewrite` ở dạng hằng `false`.

`context.hookInventory` liệt kê các hook đã cài, mỗi cái mang hằng `enforced: true`, và phải có
`pre-push`. `context.remote` quan sát đúng ref đang được publish, và `remoteHead` của nó bằng null khi
ref chưa tồn tại.

`context.completionProofRefs` không được rỗng. Nó ghi lại các cổng mà ranh giới đã qua. Nó là bằng
chứng, không bao giờ thay được phê duyệt.

## Ranh giới publish

`input.boundary` gọi tên một đơn vị, các target, các write root và các loại trừ của nó. Một đường dẫn
không thể vừa là target vừa là loại trừ.

`input.sourceHeads` ràng từng checkout đóng góp bằng tham chiếu, branch, head chính xác, head upstream,
và số commit ahead cùng behind. Mỗi checkout xuất hiện nhiều nhất một lần, ít nhất một head phải đi
trước upstream của nó, và dưới `worktreeBranches: forbidden` thì mọi head đều nằm trên branch sửa đổi.
Một head không có upstream thì không thể báo là đang đi sau upstream nào cả.

`input.workingTree.dirtyPaths` phải nằm hết dưới một write root đã khai. Thứ gì bẩn ngoài ranh giới là
phần việc mà lần publish này không sở hữu.

`input.publication.branchRef` là ref duy nhất đang được publish, `mode` là hằng `fast-forward-only`,
và `annotatedTag` hoặc bằng null hoặc là đúng một tag continuation có chú thích. `context.remote.ref`
phải chính là ref đó.

## Các thao tác phá huỷ là không biểu diễn được

`input.destructiveOperations` là một object đóng mà mọi thành viên đều là hằng `false`: `forcePush`,
`historyRewrite`, `resetHard`, `clean`, `stash`, `branchDelete`, `hookBypass`. Không có input nào yêu
cầu được bất kỳ thứ nào trong số đó, ở bất kỳ tổ hợp nào, dưới bất kỳ lý do nào. Trường này tồn tại để
lệnh cấm được hợp đồng thi hành, thay vì phải nhớ ra trong lúc căng thẳng.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó. Project, đơn vị ranh giới, phê duyệt và
artifact root phải bằng đúng receipt đã blocked. Một resume không thêm được delta nào về head, phê
duyệt, hook hay remote thì không hợp lệ và trả `NO_PROGRESS`.
