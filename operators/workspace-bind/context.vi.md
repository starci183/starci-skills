# Context cho `workspace.bind`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để ràng một project và một role vào đúng một checkout đã xác
minh. Nó trả lời câu "operator này được đọc những gì?" trước khi bất kỳ đường dẫn nào được phân giải.
Context không bao giờ nới rộng yêu cầu và không bao giờ biến một sự giống nhau thành thẩm quyền.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
lấy từ một checkout thì ràng thêm cả head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Bằng chứng bootstrap | Các file entry và việc phát hiện agent, chứng minh Source này sở hữu runtime. | Bắt buộc. Xác lập rằng route được phép đọc. |
| Khai báo portable | `.workspaces/projects/<project>/<role>.json`, đã compile và được Git theo dõi. | Thẩm quyền route bắt buộc. Nơi duy nhất route được khai. |
| Route đã hydrate | `.workspaces/local/routes/<project>/<role>/config.json`, cục bộ theo máy và bị ignore. | Bắt buộc. Chiếu khai báo portable xuống ổ đĩa của máy này. |
| Danh tính máy | Danh tính thiết bị và roster credential đã mã hoá của nó. | Bắt buộc. Chứng minh máy được phép giữ roster; không bao giờ là nguồn bí mật. |
| Chủ sở hữu runtime | Mục registry, generation, bằng chứng health, và endpoint binding đóng. | Chỉ bắt buộc khi bên gọi tiêu thụ runtime dùng chung. Không bao giờ chuyển nhượng được. |
| Provenance head | Head hội thoại đã redact cho project và role này. | Bằng chứng về tính liên tục. Không bao giờ là quyết định về route. |
| Receipt route đã cache | Một lần bind trước đó của cùng bộ danh tính. | Chỉ là bằng chứng và để so tươi cũ. |
| Gợi ý | Tên na ná, thư mục anh em, thư mục làm việc hiện tại, một URL trên trình duyệt. | Không bao giờ là thẩm quyền. Được ghi lại và bị từ chối. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. ít nhất một tham chiếu bootstrap;
2. đúng một khai báo portable cho đúng project và role được yêu cầu;
3. đúng một route đã hydrate thuộc về Source này;
4. đúng một danh tính máy đã xác minh, với roster credential được mã hoá.

Bên gọi nào tiêu thụ runtime dùng chung thì cần thêm binding của chủ sở hữu runtime.

## Thẩm quyền route nằm ở khai báo, không nằm ở sự giống nhau

Một route tồn tại vì `.workspaces/projects/<project>/<role>.json` khai nó ra, và route cục bộ đã
hydrate chiếu nó xuống máy này. Ngoài hai thứ đó ra, không gì xác lập được một route.

`context.hints` tồn tại để những thứ trông giống route được gọi tên và bị từ chối, thay vì bị âm thầm
tra cứu. Một thư mục có tên na ná tên project, một checkout anh em tình cờ nằm cạnh Source, thư mục
làm việc hiện tại của shell, và origin đang mở trên trình duyệt đều được ghi lại với
`authoritative: false`. Không có cách nào biểu diễn được một gợi ý mang thẩm quyền, bởi một gợi ý được
nâng lên thành thẩm quyền chính là cách công việc rơi vào nhầm checkout mà không ai kịp nhận ra.

Hai nửa của route phải khớp nhau về project, role, kho Git và branch. Loại kho `source` mang directory
null và phân giải về chính gốc Source; loại `sibling` mang một đường dẫn tương đối an toàn và phân
giải sang bên cạnh Source. Route đã hydrate phải nhận đúng Source này là của mình và nhận `.workspaces`
bên dưới nó làm workspace root, nếu không thì nó thuộc về Source của một máy khác và bị từ chối.

## Endpoint binding là một phép chiếu đóng

Endpoint không bao giờ là một URL do ai đó chọn. Nó là `workspace-route-port-projection` mô tả trong
`runtime/contracts/endpoint-authority.mjs` trên nhánh `v7` của starci-skills: route frontend và backend đã xác minh, offset của
project và slot step lấy từ `.workspaces/ports/`, slot ứng dụng, và `portServices` mà backend đã route
khai ra, tất cả gộp thành một fingerprint. Binding mang theo fingerprint đó, và một fingerprint cũ thì
bị từ chối chứ không được tính lại cho khớp.

Chỉ những giá trị chỉ-origin dạng `http://localhost:<cổng-chuẩn>` mới là endpoint. Một URL tự do,
`127.0.0.1`, một host từ xa, một ứng dụng khác, một service không được khai, hay một cổng tình cờ đang
lắng nghe đều không xác lập được gì.

## Bên gọi là người tiêu thụ, không bao giờ là chủ sở hữu

Runtime cục bộ dùng chung thuộc về đúng một task chủ sở hữu được uỷ nhiệm. Operator này ràng bên gọi
vào endpoint của chủ sở hữu đó với tư cách người tiêu thụ. Nó không start, stop, restart, thay thế hay
kill một tiến trình nào, và nó không nhận cổng, PID hay vòng đời runtime về mình. Một registry thiếu,
cũ hoặc chưa sẵn sàng sẽ cho ra một khối chặn có kiểu để bên gọi phát đúng một yêu cầu điều phối; nó
không bao giờ cho phép dựng một task thay thế.

## Ranh giới

Context là chỉ đọc, trừ phần route đã hydrate cục bộ theo máy vốn bị Git bỏ qua. Operator chỉ ghi
receipt route của nó dưới `input.artifactRootRef`. Nó không sửa route, không khởi tạo workspace, không
cấp tài khoản, không publish gì, và không ghi một quyết định sản phẩm nào.

## Tài nguyên

Operator này chạy trọn trên profile `sonnet` (`claude-sonnet-5`, runtime `claude`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: không có. Nó không bao giờ tìm trên mạng, không ràng với Grammar, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
