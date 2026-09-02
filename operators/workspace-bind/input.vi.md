# Input cho `workspace.bind`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
danh tính cần ràng cùng ranh giới nó được ghi. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `workspace.bind`.
- `context`: các binding thẩm quyền và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một yêu cầu ràng project và role đã đóng băng.

## Các binding context

`context.bootstrapRefs` không được rỗng. `context.portableRoute` và `context.hydratedRoute` luôn bắt
buộc, và cả hai phải khai đúng `input.project` và `input.role`. `context.identity` luôn bắt buộc và
roster credential của nó đã được mã hoá; không có input nào biểu diễn được một bí mật ở dạng thô.

`context.runtime` có mặt đúng khi `input.runtimeNeed` là `consume`, và bằng null trong trường hợp còn
lại. Trường `endpointBinding.authority` của nó là hằng `workspace-route-port-projection`, nên một URL
do bên gọi tự chọn không có đường nào lọt vào làm endpoint.

`context.provenance` và `context.cachedRouteReceipt` là bằng chứng và được phép null.

`context.hints` ghi lại những thứ chỉ trông giống route: một cái tên na ná, một thư mục anh em, thư
mục làm việc, một URL trên trình duyệt. Mỗi gợi ý mang hằng `authoritative: false`. Trường này tồn tại
để một gợi ý được gọi tên và bị từ chối, chứ không bao giờ để tra cứu.

## Sự khớp nhau của route

Khai báo portable và route đã hydrate phải khớp nhau về project, role, kho Git và branch. Loại kho
`source` mang directory null và hydrate xuống chính gốc Source; loại `sibling` mang một đường dẫn
tương đối không đi ngược lên và hydrate sang bên cạnh. Workspace root của route đã hydrate phải là
`.workspaces` nằm dưới chính Source root của nó, còn disk path và Git root phải là cùng một checkout.

`input.observedCheckout.diskPath` phải chính là checkout đã hydrate đó. Một quan sát lấy ở chỗ khác là
quan sát của một kho khác.

## Ranh giới sửa đổi

`input.gitPolicy` mang chính sách đã route. Khi `worktreeBranches` là `forbidden`, branch quan sát
được phải là `mutationBranch`; việc tạo hay chuyển sang một branch task, feature hay worktree không
phải là trạng thái mà input này mô tả được.

`input.declaredWriteRoots` không được rỗng, và mọi đường dẫn trong `observedCheckout.dirtyPaths` phải
nằm dưới một trong số đó. Thứ gì bẩn ngoài ranh giới đã khai là thuộc về phần việc mà lần gọi này
không sở hữu.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó. Project, role, head đã đóng băng và
artifact root phải bằng đúng receipt đã blocked. Một resume không thêm được delta nào về route, danh
tính, runtime hay provenance thì không hợp lệ và trả `NO_PROGRESS`.

`input.frozenSourceHead` là head mà nhiệm vụ đã đóng băng. Nó được so với `observedCheckout.head`
trong lúc thực thi, và một khác biệt là `SOURCE_DRIFT` chứ không phải một lần ràng lại âm thầm.
