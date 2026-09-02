# Output của `workspace.bind`

Operator trả về đúng một vỏ đóng với `outcome` bằng `bound` hoặc `blocked`. Nó không bao giờ phát ra
handoff hay chỉ dẫn định tuyến tự do.

## Receipt khi đã ràng

Một receipt đã ràng chứa:

- các binding chính xác về project, role, route portable, route đã hydrate, danh tính, head, input và
  tiến độ;
- checkout đã phân giải cùng đường dẫn đĩa, Git root, kho, branch, loại kho và head của nó;
- chính sách Git đã route, và việc sửa đổi có sẵn sàng trên branch quan sát được hay không;
- các write root đã khai;
- runtime mà bên gọi được tiêu thụ, hoặc null;
- tham chiếu provenance head, hoặc null;
- các finding cho lần hydrate, từng gợi ý bị từ chối, roster đã niêm phong, runtime được tiêu thụ,
  chính sách cấm worktree, và route cache được tái dùng nếu có.

Receipt cho phép công việc về sau mở đúng checkout này ở đúng head này. Nó không chứng minh gì về sản
phẩm, và không mang phán quyết, điểm số hay tuyên bố đạt nào.

## Route

| Trường | Ý nghĩa |
| --- | --- |
| `checkout` | Đúng một kho đã xác minh mà project và role này phân giải ra. |
| `gitPolicy` | Chính sách worktree đã route và branch sửa đổi đã khai. |
| `mutationReadiness` | `ready` chỉ trên branch sửa đổi; ngoài ra là `read-only`. |
| `writeRoots` | Những đường dẫn duy nhất mà công việc sau được ghi. |
| `runtime` | Endpoint của chủ sở hữu, tiêu thụ với tư cách `consumer`, hoặc null. |
| `provenanceHeadRef` | Head hội thoại đã redact, hoặc null. |

`consumerRole` là hằng `consumer`. Không có output nào mà bên gọi sở hữu một cổng, một tiến trình hay
một generation runtime.

## Các finding

| Mã | Ý nghĩa |
| --- | --- |
| `ROUTE_HYDRATED_FROM_PORTABLE` | Khai báo portable đã phân giải ra route cục bộ này. Bắt buộc trên mọi route đã ràng. |
| `HINT_REJECTED` | Một tên na ná, thư mục anh em, thư mục làm việc hoặc URL trình duyệt đã được cấp và không quyết định gì. |
| `IDENTITY_ROSTER_SEALED` | Roster credential được ràng bằng tham chiếu và không hề bị đọc. |
| `RUNTIME_CONSUMED_NOT_OWNED` | Bên gọi tiêu thụ endpoint của chủ sở hữu và không sở hữu vòng đời nào. Bắt buộc mỗi khi ràng một runtime. |
| `WORKTREE_BRANCH_FORBIDDEN` | Chính sách đã route cấm branch task, feature và worktree. Bắt buộc mỗi khi chính sách đó được ràng. |
| `PROVENANCE_HEAD_BOUND` | Một head hội thoại đã redact được gắn vào. Bắt buộc mỗi khi có head. |
| `CACHED_ROUTE_REUSED` | Một receipt cache khớp danh tính và fingerprint đã được tái dùng. |

## Receipt khi bị chặn

Một receipt bị chặn không có route. Nó chứa đúng một failure có kiểu, các chủ thể và tham chiếu liên
quan, domain sở hữu, khả năng thử lại, và chỉ khi thử lại được thì mới kèm token dùng một lần cùng
phần vật liệu còn thiếu.

## Các mã failure

| Mã | Vấn đề sở hữu | Chủ sở hữu | Delta hợp lệ |
| --- | --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | caller | Input đã sửa. |
| `ROUTE_UNDECLARED` | Không có khai báo portable cho project và role này. | workspace | Route được khai ra. |
| `ROUTE_UNHYDRATED` | Khai báo có, nhưng không route cục bộ nào chiếu nó xuống đây. | workspace | Route đã hydrate. |
| `ROUTE_MISMATCH` | Route đã hydrate lệch với route portable đóng. | workspace | Một lần hydrate đã sửa. |
| `IDENTITY_UNVERIFIED` | Danh tính máy hoặc roster mã hoá của nó thiếu hoặc cũ. | identity | Danh tính đã xác minh. |
| `BRANCH_POLICY_VIOLATION` | Branch đang hoạt động vi phạm chính sách worktree đã route. | workspace | Checkout quay lại branch sửa đổi. |
| `CHECKOUT_DIRTY` | Có thứ bẩn nằm ngoài các write root đã khai. | source | Ranh giới sạch, hoặc write root đã sửa. |
| `SOURCE_DRIFT` | Head quan sát được khác head đã đóng băng. | source | Một binding head được làm mới. |
| `ENDPOINT_AUTHORITY_STALE` | Endpoint binding không phải phép chiếu đóng, hoặc fingerprint đã cũ. | runtime | Fingerprint thẩm quyền được tính lại. |
| `RUNTIME_NOT_READY` | Registry chủ sở hữu thiếu, cũ, hoặc chưa sẵn sàng. | runtime | Một generation chủ sở hữu đã sẵn sàng. |
| `NO_PROGRESS` | Một resume không thêm delta nào. | caller | Route, danh tính, runtime hoặc provenance mới thật sự. |

`ROUTE_UNDECLARED` và `ROUTE_UNHYDRATED` là kết quả dự kiến khi workspace chưa được chuẩn bị, không
phải lỗi của yêu cầu. Khởi tạo và sửa route là công việc riêng, không bao giờ là hành vi âm thầm bên
trong operator này.

## Bất biến xuyên trường

- `outcome="bound"` đòi `receipt.status="bound"`, `route` khác null, `failure` null và `resume` null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `route` null và `failure` khác null. Failure thử
  lại được thì cần resume; failure không thử lại được thì cấm resume.
- Mỗi mã failure mang domain sở hữu riêng; lỗi của workspace, source, identity hay runtime không bao
  giờ được ghi cho caller.
- `binding.sourceHead` bằng `route.checkout.sourceHead`.
- Checkout loại `source` báo directory null; checkout loại `sibling` báo đường dẫn tương đối của nó.
- `mutationReadiness="ready"` đòi branch của checkout bằng `gitPolicy.mutationBranch`.
- Chính sách worktree `forbidden` chỉ ràng được trên branch sửa đổi và luôn ghi
  `WORKTREE_BRANCH_FORBIDDEN`.
- Mọi route đã ràng đều ghi `ROUTE_HYDRATED_FROM_PORTABLE` gọi tên `binding.hydratedRouteRef`.
- `provenanceHeadRef` khác null thì ghi `PROVENANCE_HEAD_BOUND` gọi tên đúng head đó.
- Một runtime đã ràng có `status="ready"`, ghi `RUNTIME_CONSUMED_NOT_OWNED` gọi tên task chủ sở hữu,
  thuộc về đúng project đã ràng, có các khoá service phân biệt, và phơi ba endpoint chỉ-origin dạng
  `http://localhost:<cổng>` trên ba cổng khác nhau.
- Một receipt bị chặn không ghi `ROUTE_HYDRATED_FROM_PORTABLE` lẫn `RUNTIME_CONSUMED_NOT_OWNED`.
- Không finding nào lặp lại cùng cặp mã và chủ thể.
- `artifactRefs` đăng ký artifact của receipt route.
- `handoff` luôn là `null`.

## Kết quả thực tế

Ràng `starci-academy/be` trên branch sửa đổi cùng runtime dùng chung: receipt gọi tên gốc Source làm
checkout, báo sửa đổi đã sẵn sàng, từ chối hai gợi ý được cấp, và ràng origin frontend, api, identity
của chủ sở hữu với tư cách người tiêu thụ.

Ràng một project mà chủ sở hữu runtime còn đang khởi động: lần gọi trả `RUNTIME_NOT_READY` do domain
runtime sở hữu, không route nào được phát ra, và bên gọi phát một yêu cầu điều phối thay vì tự dựng
một server.
