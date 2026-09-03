# platform.operate

## Việc

Vận hành một dịch vụ dùng chung có ranh giới từ bằng chứng chính xác — observability, Sonar, tunnel,
sổ đăng ký runtime, hay danh tính mà một route đã bind xác thực vào: kiểm kê nó, hội tụ đúng phần
delta đã duyệt, chứng minh mọi phép kiểm mà tri thức đã ràng đòi hỏi, và dừng ở khoảng trống sở hữu
nhỏ nhất thay vì nhận lấy quyền deploy sản phẩm.

## Hạ tầng dùng chung, không phải sản phẩm

Operator này phục vụ hạ tầng dùng chung và không bao giờ nhận quyền deploy sản phẩm. Ranh giới đó
không phải lời khuyên: một tài nguyên chỉ đổi được nếu inventory đã ràng liệt kê nó dưới cùng một
service kind, và một đích deploy sản phẩm thì không bao giờ là tài nguyên observability, Sonar hay
tunnel. Một kế hoạch với tay sang đó là đầu vào không hợp lệ chứ không phải chuyện cân nhắc lúc chạy,
và yêu cầu restart một dịch vụ sản phẩm để dọn chỗ cho một dịch vụ dùng chung sẽ đi ra bằng phát hiện
`PRODUCT_DEPLOYMENT_DECLINED` chứ không bằng một lần mutate.

## Một việc, năm nhánh

Kiểu dịch vụ mà inventory ghi lại chọn nhánh, và năm nhánh là năm nhánh của cùng một việc chứ không phải năm operator. Mỗi
nhánh công bố ba tập đóng, và cả ba đều được thi hành. Observability áp `update-config`,
`restart-service`, `upsert-dashboard` và `update-remote-write`, chứng minh `service-health`,
`target-boundary`, `label-boundary`, `remote-write-delivery`, `sample-ordering`, `retry-backoff` và
`sensitive-data-filter`, và cần `metrics:remote-write`. Sonar áp `create-project`, `assign-profile`,
`assign-gate` và `enforce-setting`, chứng minh `service-available`, `project-exists`,
`source-revision`, `profile-assigned`, `gate-assigned` và `enforcement-active`, và cần
`sonar:project-admin`. Tunnel áp `create-tunnel`, `update-tunnel-route` và `upsert-proxied-dns`,
chứng minh `dns-target`, `tunnel-route`, `tls` và `public-https`, và cần `tunnel:write` cùng
`dns:write`. Runtime áp `register-runtime-entry`, `attest-runtime-entry`, `bring-up-infra-stack`,
`locate-routed-checkouts`, `start-role-runtime`, `merge-into-integration-branch`,
`serve-runtime-head`, `restart-runtime-server`, `reset-runtime-server`, `stop-runtime-server` và
`queue-runtime-lease`, chứng minh `entry-declared`, `endpoints-served`, `head-observed`,
`generation-advanced`, `infra-ports-open`, `cors-origin-admitted`, `checkout-located`,
`integration-merged`, `server-pid-owned` và `lease-honoured`, và cần
`runtime:registry-write`. Identity áp `provision-identity` và `seed-flow-fixtures`, chứng minh
`provider-reachable`, `credential-resolvable`, `account-exists`, `account-signs-in` và
`no-credential-recorded`, và cần `identity:account-admin`. Giữ hai nhánh cuối tách nhau là thứ giữ cho
mỗi tập chứng minh còn thật: không thể bắt một lần chứng thực chứng minh một tài khoản, và không thể
báo cáo một lần cấp tài khoản bằng cách ping một cổng. Một effect hay một check nộp nhầm nhánh là đầu vào không hợp lệ chứ không phải cảnh báo,
vì effect nộp chéo chính là cách một thay đổi chưa duyệt khoác lên mình vẻ ngoài của thẩm quyền. Tập
chứng minh bắt buộc là trọn tập mà nhánh công bố: người gọi không được xin ít hơn, vì một dashboard
xanh tự nó chưa bao giờ chứng minh được delivery, ordering hay redaction. Nhánh runtime là nhánh công
bố tập của mình theo từng bậc thay vì theo cả nhánh, vì một bậc nằm dưới server thì không ping nổi một
endpoint chưa có gì phục vụ; tập của mỗi bậc được nêu cùng cái thang bên dưới, và một bậc cũng không
được xin ít hơn tập của chính nó, y như một nhánh.

## Sổ đăng ký có một entry cho mỗi route

Một máy chạy route của nhiều sản phẩm cùng lúc, nên sổ đăng ký runtime giữ một entry cho mỗi
`<project>/<role>` và mỗi người đọc lấy đúng entry của route mình. Một sổ chỉ có một khối endpoint thì
chứng thực được đúng một route, và mọi lần bind khác đọc ra chưa sẵn sàng trong khi dịch vụ chúng cần
đang lắng nghe — một âm tính giả không phân biệt được với sự cố. Hình dạng một-khối trước đây vẫn được
đọc thêm một release, như entry của route mà nó nêu tên, và một sổ mang cả hai thì hai bên phải khớp;
release kế tiếp bỏ nó.

## Thang runtime, leo từng bậc một

Một cái máy vừa bật lên thì chưa có cơ sở dữ liệu, chưa có nhà cung cấp danh tính, chưa checkout nào
được phân giải và chưa có gì phục vụ, và mỗi thứ đó là một thứ thiếu khác nhau với một người chủ khác
nhau. Vì vậy nhánh runtime leo một cái thang theo đúng một thứ tự, mỗi bậc là một thao tác đóng do
người gọi nêu tên và mỗi bậc được chứng thực trước khi thử bậc kế, để một entry trong sổ đăng ký luôn
nói rõ nó đang ở đâu thay vì hoặc sẵn sàng hoặc không hiểu vì sao chưa.

| Bậc | Nó làm gì | Chứng minh |
| --- | --- | --- |
| `stack-up` | Dựng hạ tầng mà môi trường đó khai, bằng đúng công cụ môi trường đó khai, chờ các probe sẵn sàng, và xác nhận luật origin đã khai có nhận origin đang phục vụ | `infra-ports-open`, `cors-origin-admitted`, `generation-advanced` |
| `locate` | Phân giải các role của project ra checkout đã route qua workspace route, không bao giờ theo tên thư mục, và ghi head quan sát được ở mỗi cái | `checkout-located`, `head-observed`, `generation-advanced` |
| `start-role` | Khởi động server của một role từ worktree tích hợp, backend trước frontend, bằng lệnh dev mà khai báo route hay package scripts của nó publish | `entry-declared`, `endpoints-served`, `head-observed`, `generation-advanced`, `integration-merged`, `server-pid-owned`, `lease-honoured` |
| `serve` | Merge phần việc của một phiên vào nhánh tích hợp, tự giải xung đột (nếu có) theo luật rồi chấm gate trên head đã gộp, và cho server chạy kết quả đó, theo luật cache build | đúng bộ của `start-role` cộng `gates-passed` |
| `restart` | Khởi động lại đúng head đó, cùng nhánh, cùng cổng, theo luật cache build | đúng bộ của `start-role` |
| `reset` | Dừng, xoá cache build theo yêu cầu đích danh, khởi động lại | đúng bộ của `start-role` |
| `stop` | Dừng server: cả cây tiến trình của pid đã ghi bị dừng, cổng được chứng minh là trống, và lease được nhả | `entry-declared`, `generation-advanced`, `server-pid-owned`, `lease-honoured` |

Một bậc không leo được thì dừng bằng đúng mã gọi tên người chủ của khoảng trống đó và không mã nào
khác: hạ tầng không lên nổi, hay một backend mà luật origin đã khai không nhận origin đang phục vụ, là
`PROVISIONING_UNAVAILABLE` nêu tên thứ đang thiếu và dòng khai báo cần thêm; một route không publish
lệnh dev nào là `INVALID_INPUT` nêu tên trường nó thiếu. Một lần merge xung đột không thuộc nhóm này:
nó thuộc về chính `serve`, được xử lý ngay lúc tích hợp chứ không đẩy lên cho con người, và đó chính là
lý do lần merge diễn ra ở đây.

## Xung đột do người tích hợp xử lý, không đẩy lên cho con người

`serve` tự giải một xung đột merge theo một tập luật đóng, thay vì dừng lại và đẩy nó cho con người: với
một hunk chỉ một bên đụng tới, bên đó thắng; với một hunk cả hai bên đụng tới, cả hai hành vi được giữ
lại nếu chúng cộng dồn được — import riêng, khai báo anh em, dòng bảng riêng; với mọi hunk khác mà cả
hai bên đụng tới, bản của phiên đang xin được ưu tiên trong file thuộc tập ghi của phiên đó, còn bản của
nhánh thắng ở mọi nơi khác. Mọi hunk được giải theo cách này đều được ghi lại trên đúng lần merge của
nó, trong `runtimeLadder.integration.merges[].resolutions`, nêu tên file, khoảng dòng của hunk và luật
nào trong bốn luật đã áp — bản ghi đó là thứ cho người đọc sau này phân biệt một lần merge sạch với một
lần đã lấy một bên.

Giải xung đột không đồng nghĩa với tin kết quả. Trước khi server khởi động lại trên head đã gộp,
`serve` chạy các gate phát hành của sản phẩm trên head đó — typecheck, lint, architecture lint và unit
test, đúng danh sách mà `quality.verify` chạy — và chỉ một gate đỏ mới dừng bậc này, với
`INTEGRATION_FAILED` nêu tên gate hỏng và những chỗ đã được giải xung đột. Audit và UAT chạy tiếp trên
nhánh tích hợp mới là thứ bắt được một kết quả hỏng mà gate không thấy; gate ở đây chỉ từ chối phục vụ
một head hỏng thứ nó thấy được. `INTEGRATION_FAILED` được nối lại khi một người hoặc chính phiên sở hữu
sửa trên nhánh phiên rồi xin serve lại — không bao giờ bằng cách rebase, force hay bỏ qua lần merge đã
sinh ra head hỏng đó.

## Một nhánh, một server, một cổng cố định

Runtime phục vụ một nhánh tích hợp của mỗi sản phẩm, và cổng phục vụ nhánh đó không bao giờ dời. Đó
không phải chuyện tiện tay: redirect URI của identity client, danh sách origin được phép của backend
và mọi callback đăng ký ở bất kỳ nhà cung cấp nào đều khai theo một cổng, nên một runtime dời cổng để
lấy chỗ cho phiên thứ hai sẽ làm hỏng đăng nhập của phiên thứ nhất, rồi lại phải sửa allow-list của
nhà cung cấp ngay lúc chạy để vá đúng thứ nó vừa làm hỏng. Ở đây không có gì đăng ký origin, vì ở đây
không có gì dời cổng.

Vậy hai phiên trên cùng một sản phẩm không phải hai server. Mỗi phiên xin commit của mình được phục
vụ, và `serve` merge nhánh của phiên đó vào nhánh tích hợp — một merge commit, không bao giờ rebase —
rồi khởi động lại đúng một server trên kết quả. Head đang phục vụ khi đó mang việc của cả hai, và entry
ghi `contains`: những commit head đó chắc chắn có. Xung đột lộ ra ở đây, sớm, ngay nơi hai thay đổi
thật sự gặp nhau, thay vì lúc publish nơi nó sẽ chặn một phần việc đã xong — và cũng được giải ngay ở
đây, theo luật và dưới một gate, chứ không đẩy cho con người giữa chừng merge. Nhánh tích hợp cũng được
merge từ mainline theo chu kỳ để không trôi vào một trạng thái không ai khác chia sẻ.

## Commit của chính người tiêu thụ nằm trong một head dùng chung

Vì một head mang việc của nhiều phiên, một người tiêu thụ đòi head đang phục vụ phải bằng đúng commit
mình vừa áp sẽ hỏng mỗi lần có phiên thứ hai, và hỏng vì số học chứ không vì bằng chứng. Phép thử là
quan hệ tổ tiên: commit đã áp phải là tổ tiên của head đang phục vụ. Một bề mặt thoả điều đó có mang
phần việc đang được audit, bất kể nó còn mang gì khác. Cả hai commit đều được ghi — cái đã áp và cái
đang phục vụ — vì người đọc không thấy đủ hai thì không kiểm được lời khẳng định. Chỉ một phép thử tổ
tiên hỏng mới là trôi.

## Một server sống lâu hơn nhánh đã khởi động nó

Server mà một bậc khởi động là tiến trình detached. Nó phải vậy: nhánh khởi động nó kết thúc, còn lần
audit hay hành trình cần nó lại chạy ở nhánh khác, đôi khi ở phiên khác. Một tiến trình không ai ghi
lại là một tiến trình không ai tìm ra, nên entry mang trọn nó — đúng lệnh, pid, tệp log dưới thư mục
phiên và tệp pid nằm cạnh. Cây này ship sẵn helper làm việc đó (`scripts/serve-runtime.mjs`), và nó
được gọi tên ở đây để khởi động một server là một hành vi có ghi chép, không phải một dòng shell ai đó
tự ứng biến. Pid đã ghi thường là một tiến trình bọc ngoài còn tiến trình thật sự trả lời trên cổng
là con của nó, nên bản ghi nêu cả hai khi chúng khác nhau, và một lần `stop` dừng trọn cây tiến trình
của pid đã ghi chứ không cây nào khác, rồi kết nối thử để chứng minh cổng không còn trả lời trước khi
xoá bản ghi; khi vẫn có thứ trả lời, bản ghi được giữ nguyên và kết quả nêu đích danh listener còn
sống bằng pid mà bảng socket đưa ra, vì một bản ghi đã xoá trên một cổng còn bị giữ chính là xung đột
cổng cố định mà lần khởi động kế tiếp sẽ từ chối.

Khởi động lại không phải là build lại. Dev server của một framework biên dịch vào một cache build
dưới worktree rồi phục vụ từ đó, và cache ấy chỉ mới bằng lần cài đặt mà nó được biên dịch dựa trên:
khi head đang phục vụ chuyển sang một head mà manifest phụ thuộc hay lockfile — những manifest mà
route khai, và các lockfile nằm cạnh chúng — khác với của bản ghi đã phục vụ trước đó, một lần khởi
động lại đơn thuần vẫn phục vụ thứ mà các phụ thuộc cũ đã biên dịch trong khi gói đã cài đã là bản
mới, và thứ mà lần audit sau đó đo là một stylesheet hay một chunk không ai còn ship nữa. Vì vậy mọi
bậc khởi động server đều quyết định về cache trước khi khởi động, và helper là bên ra quyết định đó
chứ không phải người vận hành phải nhớ: nó băm các manifest và lockfile đã khai, so digest với digest
mà bản ghi trước mang, và xoá các thư mục build quy ước của các package trong worktree khi digest
khác, khi không biết bản ghi trước nào, hoặc khi `--clean` — thứ `reset` luôn truyền — yêu cầu đích
danh. Bản ghi server mang quyết định ấy: cache có bị xoá không, vì lý do nào trong số đó, những thư
mục nào đã đi và nó được so với head trước nào. Một bản ghi nói cache được giữ trong khi head trước
không rõ, hay nói `reset` đã giữ nó, bị từ chối, vì một cache không ai chứng minh được là đã xoá cũng
chính là lỗi đó với một dòng log lịch sự hơn.

`serve` là idempotent theo head. Khi head của server đang chạy đã chứa commit được xin và endpoint của
nó trả lời, thao tác chỉ chứng thực rồi trả lại: không merge gì, không khởi động lại gì, không có pid
mới, và biên bản ghi rằng head đã được dùng lại. Khởi động lại một server đang khoẻ chỉ để được phép
mô tả nó sẽ phá đúng trạng thái mà bước sau định đo, cũng là lý do việc chứng thực không bao giờ khởi
động lại thứ gì. `restart` và `reset` tồn tại cho lúc một con người thật sự muốn điều đó, và chúng
được gọi đích danh.

## Lease chính là thứ tự merge

Mỗi lúc chỉ một phiên tích hợp. Phiên nào serve thì giữ lease trong lúc merge và khởi động lại, rồi
nhả khi server trả lời trở lại; phiên nào hỏi trong lúc người khác đang giữ thì được ghi vào hàng đợi,
được cho biết vị trí và ai đang giữ, và chờ. Nó không bao giờ được phát một server thứ hai, vì server
thứ hai đúng là sự tranh chấp mà lease sinh ra để dẹp. Thời gian chờ ngắn theo thiết kế: lease giữ cho
một lần merge và một lần khởi động lại, không phải cho cả một lượt audit.

## Chứng thực một runtime không ai khởi động lại

Một tiến trình đang phục vụ là bằng chứng, không phải vấn đề. Nhánh runtime ping các endpoint mà entry
khai, ghi lại head quan sát được cùng các bản ghi ping đứng sau, rồi đặt trạng thái của entry theo cái
đã trả lời. Không có gì bị khởi động, dừng hay khởi động lại để làm được điều đó: dịch vụ đang chạy của
một người được đăng ký đúng như nó đang là, vì lựa chọn còn lại — khởi động lại một runtime để được
phép mô tả nó — phá huỷ chính trạng thái mà bước sau định kiểm. Một entry có endpoint không trả lời là
`SERVICE_UNAVAILABLE` nêu đích danh endpoint hỏng, không bao giờ là một trạng thái operator này tự
khẳng định.

## Hồ sơ thiếu thì tạo ra, không phải báo lỗi

Cấp phát là nhánh mặc định, không phải ngoại lệ. Một luồng chưa có thư mục, chưa có tài liệu luồng,
chưa có seed và chưa có tài khoản là một luồng chưa ai chạy, và runtime tạo cả bốn: tài liệu luồng và
seed được phác từ khuôn đi kèm cây và được đánh dấu là bản nháp trong biên bản, tài khoản được tạo tại
provider mà entry khai, mật khẩu của nó đặt từ thông tin đăng nhập niêm phong dùng chung giải theo tên,
rồi seed được áp. Báo bất kỳ điều nào ở trên như một lỗi là sai, và dừng ở "phải có người tạo tài
khoản" cũng là đúng cái sai đó với một câu lịch sự hơn. Chỉ hai thứ thực sự không phải để operator này
bịa ra, và chúng là hai mã dừng duy nhất trên lối này: một entry không khai danh tính nào cả là
`INVALID_INPUT` nêu tên trường còn thiếu, và một provider, file niêm phong hay kho dữ liệu không tới
được là `PROVISIONING_UNAVAILABLE`.

## Thông tin đăng nhập là một cái tên, và nó đi vào một form hay một body

Mỗi môi trường niêm phong đúng một mật khẩu và tài khoản của mọi luồng được đặt từ nó, còn mỗi luồng sở
hữu username riêng. Nó được giải theo tên đúng lúc gọi, và giá trị của nó chỉ được phép tới đúng hai
chỗ: body của lời gọi quản trị tới provider, và ô của một form đăng ký trong trình duyệt đang được điều
khiển. Nó không bao giờ vào một file, một fixture, một lệnh được ghi lại, một ảnh chụp hay một biên bản.
Vì thế hồ sơ tài khoản operator này công bố mang username, vai trò, tên thông tin đăng nhập, đường dẫn
file niêm phong và entry nó thuộc về, và không có chỗ nào để đặt một bí mật kể cả do sơ ý.

## Kiểm kê trước khi đổi

Một dịch vụ dùng chung được kiểm kê trước khi bị đổi. Inventory được ràng bằng fingerprint, nên biên
bản nói đúng dịch vụ là gì tại lúc quyết định, và một revision chạy song song hiện ra thành
`INVENTORY_DRIFT` thay vì bị ghi đè lặng lẽ. Lần kiểm lại xảy ra trước mọi mutation, nên một revision
khác đi sẽ dừng lượt chạy khi chưa có gì thay đổi. Mọi thứ bị mutate đều xuất hiện trong phần vọng
lại của inventory, nên một thay đổi lên tài nguyên chẳng ai nhìn trước thì không thể báo là một lần
vận hành. Một dịch vụ đã hội tụ sẵn là một no-op đã được chứng minh, không mutation nào, không phải
lỗi và cũng không phải viết lại; còn một lần vận hành báo là đã hội tụ mà không có mutation nào thì
bị từ chối vì một trong hai phát biểu của nó là sai. Việc áp chỉ chạm các effect nằm trong tập đã
duyệt, mỗi lần một tài nguyên, ghi lại revision trước và sau của từng cái; áp một phần được báo là
`PARTIAL_MUTATION` kèm đúng hai revision và không bao giờ bị giấu sau một mã chặn chung chung.

## Một cổng đang bận là phát hiện cần phối hợp

Một cổng đã bị tiến trình khác chiếm là một sự thật về máy dùng chung, không phải giấy phép giành lại
nó. Lần vận hành ghi `PORT_COORDINATION_REQUIRED` nêu cả cổng lẫn tiến trình đang giữ nó, trả
`PORT_CONFLICT`, rồi dừng. Nó không dừng, không giết, không restart và không cấu hình lại kẻ đang
giữ, và không mutation nào được nhắm vào một tiến trình đã quan sát thấy đang giữ một cổng được
claim. Phối hợp là bước kế bắt buộc và nó thuộc về hai người chủ, không thuộc lượt chạy này;
`PORT_CONFLICT` là kết quả bình thường trên một máy dùng chung bận, không phải khiếm khuyết của kế
hoạch.

## Hai phiên, một sản phẩm

Đây là chỗ duy nhất luật cô lập được viết ra; operator audit và operator hành trình trích dẫn nó chứ
không chép lại. Hai phiên có thể làm trên cùng một sản phẩm cùng lúc khi cả năm điều sau đều đúng, và
mỗi điều là một cổng chứ không phải một ý định.

- Một sản phẩm, một nhánh tích hợp, một server, một cổng: các head được merge lần lượt dưới lease, còn
  backend, realm danh tính và cơ sở dữ liệu thì dùng chung và được scope chứ không nhân bản.
- Diễn viên của mỗi luồng là các alias tài khoản của riêng luồng đó, được cấp cho luồng đó và nêu tên
  trong hồ sơ của nó.
- Mỗi phiên lái profile trình duyệt của riêng nó, ghi trong snapshot của chính lượt chạy, để cookie
  của phiên này không bao giờ là phiên đăng nhập của phiên kia.
- Seed được scope bằng tiền tố của chính luồng và không đụng hàng dùng chung: mọi định danh được seed
  đều mang tiền tố đó, và phần rollback liệt kê đúng những định danh đó, không gì khác.
- Không operator nào ghi lease, tài khoản hay thư mục lượt chạy của phiên khác: lease, phần ghi công
  cấp tài khoản và snapshot của lượt chạy đều nêu tên phiên đã hỏi, và một lần ghi mà phiên khác đi thì
  bị từ chối chứ không hoà vào.

## Credential được phân giải, không bao giờ được ghi lại

Một capability là một handle cùng bằng chứng custody của nó. Credential đứng sau nó được phân giải để
dùng đúng lúc gọi và không bao giờ được log, vọng vào evidence hay lưu lại. Biên bản từ chối cả cái
handle chứ không riêng giá trị, vì biên bản là thứ bền, và một bản ghi bền của một capability là một
credential rò rỉ có độ trễ; một chuỗi mang vật liệu credential ở bất cứ đâu trong request hay
response đều bị từ chối như dữ liệu sai dạng.

## Trạng thái mong muốn là một khai báo đã duyệt

`desiredState` là toàn bộ những gì bên gọi xin: hash của kế hoạch đã duyệt, kiểu dịch vụ mà kế hoạch
được viết cho, các resource cần đưa về đúng trạng thái, các effect cần áp, và hai tập phạm vi nói
resource nào được đổi và resource nào chỉ được quan sát. Giữ nó thành một khai báo duy nhất chính là
thứ làm cho phê duyệt có nghĩa: `approval` phủ lên đúng khai báo đó, kèm cả hash, nên một field sửa
sau đó không còn khớp cái hash mà phê duyệt đã gọi tên.

Thẩm quyền đứng sau `approval` đến từ đâu là chuyện của môi trường. Mỗi môi trường của bản cài đặt
khai báo, theo từng lớp thao tác nền tảng — cấp danh tính, seed, các bậc của runtime dùng chung, dựng
stack, release — rằng chính bản khai báo của nó là phê duyệt (`declared`) hay cần một id phê duyệt của
con người (`person`). Hình dạng của bản khai báo, chỗ của nó trong thư mục môi trường, các mặc định
mà một lớp bị bỏ trống nhận lấy tuỳ theo môi trường có phải production hay không, và lần nới duy nhất
mà một bản khai báo production bị từ chối, tất cả đều thuộc về schema môi trường
(`readiness/initialization/stacks/environment.schema.json`), được nói ở đó một lần và được cổng kiểm
đọc từ đó. Vì thế `approval` nhận hoặc một id phê duyệt, hoặc tham chiếu tới bản khai báo
— đường dẫn của nó cùng hash nội dung — và dòng Approval của biên nhận ghi lại đúng cái đã được ràng.
Validator suy ra lớp của thao tác từ nhánh và các effect của nó, đọc bản khai báo mà tham chiếu gọi
tên, và từ chối tham chiếu khi bản khai báo vắng mặt, có hash khác, thuộc môi trường khác, bị chính
schema của nó từ chối, hay đánh dấu lớp đó là `person`; một hash đã đổi giữa lúc viết request và lúc
chạy là `AUTHORITY_DRIFT`. `approval` vẫn không có mặc định: một runtime mà phiên khác và người khác
dùng chung không bao giờ bị đổi trên sự im lặng, và điều bản khai báo thay đổi là câu trả lời thường
trực của môi trường được tính là phê duyệt, chứ không phải câu hỏi thôi được đặt ra. `portClaims` mặc
định là danh sách rỗng, vì phần lớn thao tác không cần cổng nào, và một claim không ai đặt thì không
thể đụng ai.

## Ranh giới ghi

Context chỉ đọc, trừ phần delta đã duyệt. Operator chỉ áp delta effect đã duyệt lên dịch vụ dùng chung
đã kiểm kê, dưới một lease độc quyền trên `@worktrees/sessions/central-runtime`, và chỉ ghi
`response/` của nhánh mình: `data/delta.json`, `data/checks.json`, `response.md` và `response.json`.
Nó là chủ duy nhất của vòng đời một runtime đang phục vụ: nó merge vào nhánh tích hợp rồi khởi động,
khởi động lại, reset và dừng server của một route mà sổ đăng ký ghi nhận, dưới một bậc có tên, và nó
chỉ dừng đúng cây tiến trình của pid mà chính entry đã ghi. Nó không hành động trong lúc phiên khác giữ lease; không
rebase, force hay bỏ dở một lần merge để nó áp được; không dời một cổng đang phục vụ; và không sửa
danh sách origin của một dịch vụ đang chạy thay cho khai báo lẽ ra phải mang nó.
Nó không deploy, restart, migrate hay theo cách nào khác nhận quyền sở hữu một dịch vụ sản phẩm; không
làm đổi một resource mà inventory đã ràng không liệt kê; không phát một effect hay một check mà nhánh
dịch vụ đã ràng không công bố; không giải phóng một cổng bằng cách dừng, giết hay cấu hình lại tiến
trình đang giữ nó; không ghi giá trị credential, handle capability hay token dạng bí mật ở bất kỳ đâu
trong đầu ra; không sửa knowledge, không viết bản khai báo của một môi trường, hay bằng cách nào khác tự cấp phê duyệt cho mình; và không tuyên bố một kết quả đã vận
hành khi còn một check bắt buộc vắng mặt hay hỏng, cũng không tuyên bố readiness sản phẩm, phê duyệt
release hay bằng chứng UAT nào.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/sessions/central-runtime` | chủ sở hữu runtime dùng chung: inventory, generation và health, ràng theo fingerprint và generation, chỉ ghi dưới một lease độc quyền | có |
| `@workspaces/ports/<project>` | phép chiếu cổng mà runtime ràng vào | có |
| `@workspaces/device-state` | handle capability theo tên và custody của chúng; giá trị không bao giờ xuất hiện | có |
| `@workspaces/projects/<project>/<role>` | những project mà các dịch vụ dùng chung phục vụ | không |
| `@worktrees/uat/<flow>` | thư mục luồng mà nhánh identity ghi: hồ sơ tài khoản, tài liệu luồng đã phác và seed | không |
| `@worktrees/_templates` | khuôn luồng dùng để phác một thư mục luồng còn thiếu, chỉ tiêu thụ chứ không sửa | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `service` | id | — | Đúng một dịch vụ dùng chung đang được vận hành |
| `desiredState` | `{planSha256, serviceKind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs}` | — | Khai báo đã duyệt: kế hoạch nào, nhánh nào, resource nào, effect nào, và cái gì được đổi so với cái gì chỉ được quan sát |
| `portClaims` | list of `{port, resourceRef}` | [] | Trạng thái mong muốn cần những cổng nào, và cho resource sở hữu nào |
| `approval` | id | — | Thẩm quyền phủ lên trạng thái mong muốn này: một id phê duyệt, hoặc tham chiếu tới bản khai báo môi trường — đường dẫn cùng hash nội dung — khi bản khai báo đó đánh dấu lớp của thao tác này là `declared` cho `env`; không có mặc định, vì im lặng không phải đồng thuận |
| `routeKey` | id | null | Entry `<project>/<role>` mà lượt vận hành này chứng thực hoặc cấp tài khoản vào; null khi lượt chạy không đụng route nào |
| `operation` | choice | serve | Bậc thang runtime mà lần gọi này leo: `stack-up`, `locate`, `start-role`, `serve`, `restart`, `reset` hay `stop` |
| `commit` | id | null | Commit mà phiên này cần được phục vụ, được merge vào nhánh tích hợp khi head đang phục vụ chưa chứa nó |
| `flow` | id | null | Luồng có danh tính riêng được cấp, và có thư mục nhận hồ sơ tài khoản, tài liệu đã phác cùng seed |
| `env` | id | dev | Stack mà entry được chứng thực và các tài khoản được cấp thuộc về; tài khoản của stack này không phải tài khoản của stack khác |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm cổng vào và resume | `resume` | `request/request.json`, @worktrees/sessions/central-runtime tại generation đã đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng thẩm quyền: runtime, device-state, projects và phê duyệt — một id, hoặc bản khai báo của môi trường được đọc lại và băm lại | `service`, `approval`, `env` | @worktrees/sessions/central-runtime cho fingerprint và generation của inventory, @workspaces/device-state cho từng handle capability kèm bằng chứng custody, @workspaces/projects/<project>/<role>, bản khai báo của môi trường khi `approval` tham chiếu tới nó, @tools/secrets | — | `AUTHORITY_DRIFT`, `CAPABILITY_MISSING` |
| 3 | Kiểm lại inventory một lần trước khi có gì thay đổi | — | @worktrees/sessions/central-runtime, các resource đã khai được quan sát lại một lần, @tools/git | — | `INVENTORY_DRIFT` |
| 4 | Phân giải các port claim theo phép chiếu, và quan sát ai đang giữ từng cổng | `portClaims` | @workspaces/ports/<project> cho các cổng được chiếu ra, @worktrees/sessions/central-runtime cho chủ giữ quan sát được của chúng | — | `PORT_CONFLICT` |
| 5 | Suy ra delta giữa cái quan sát được và cái mong muốn | `desiredState` | @worktrees/sessions/central-runtime cho trạng thái quan sát được, `request/request.json` cho trạng thái mong muốn | `response/data/delta.json` | — |
| 6 | Áp delta đã duyệt, từng resource một, dưới một lease độc quyền | — | @worktrees/sessions/central-runtime, @workspaces/device-state cho các handle theo tên | @worktrees/sessions/central-runtime, `response/data/delta.json`, @tools/container, @tools/shell | `EFFECT_UNAUTHORIZED`, `SERVICE_UNAVAILABLE` |
| 7 | Leo đúng bậc đã nêu cho route đã bind — dựng hạ tầng của môi trường, phân giải checkout của nó, khởi động một role, hoặc merge commit của phiên này vào nhánh tích hợp rồi serve, restart, reset hay stop đúng một server detached, xếp hàng sau lease mà phiên khác đang giữ — rồi chứng thực entry: ping các endpoint, ghi head đang phục vụ, những gì nó chứa và bằng chứng, rồi đặt trạng thái | `routeKey`, `operation`, `commit`, `env` | @worktrees/sessions/central-runtime cho entry của route đó cùng server, lease và hàng đợi của nó, @workspaces/projects/<project>/<role> cho lệnh dev của role, worktree tích hợp và nhánh phiên được merge vào đó, hạ tầng đã khai của môi trường, các endpoint được quan sát lại một lần, @tools/git, @tools/http, @tools/container, @tools/shell | @worktrees/sessions/central-runtime, `response/data/delta.json` | `SERVICE_UNAVAILABLE`, `PROVISIONING_UNAVAILABLE`, `INTEGRATION_FAILED`, `INVALID_INPUT` |
| 8 | Cấp danh tính của luồng theo entry đó: đọc hồ sơ tài khoản hoặc tạo tài khoản, đặt mật khẩu từ tên niêm phong, ghi hồ sơ, phác phần còn thiếu và seed | `routeKey`, `flow`, `env` | @worktrees/uat/<flow> cho hồ sơ tài khoản, tài liệu luồng và seed, @worktrees/_templates cho phần còn thiếu, @worktrees/sessions/central-runtime cho khai báo danh tính của entry, @workspaces/device-state cho thông tin đăng nhập theo tên, @tools/secrets, @tools/http, @tools/browsercontrol, @tools/database | @worktrees/uat/<flow>, `response/data/account.json`, `response/data/delta.json`, @tools/sourcewrite | `INVALID_INPUT`, `PROVISIONING_UNAVAILABLE` |
| 9 | Chứng minh mọi check bắt buộc | — | @worktrees/sessions/central-runtime đọc lại theo bộ chứng minh đầy đủ của nhánh, @tools/http | `response/data/checks.json` | `PROOF_FAILED` |
| 10 | Viết biên bản và phát | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | — |

Một lần resume bắt đầu lại từ cổng vào, chỉ dùng lại quan sát có fingerprint không đổi, và tiêu thụ
đúng phần delta; một lần resume không thêm thẩm quyền, inventory, trạng thái mong muốn hay phạm vi nào
là `NO_PROGRESS`, và một inventory quan sát lại phải tới dưới dạng một fingerprint mới vì cùng một
fingerprint không thể cho một câu trả lời khác.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `platform-operation-receipt` | `response/response.md` | md | có |
| `delta` | `response/data/delta.json` | data | có |
| `checks` | `response/data/checks.json` | data | có |
| `uat-account` | `response/data/account.json` | data | không |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `CAPABILITY_MISSING` | terminate |
| `INVENTORY_DRIFT` | terminate |
| `PORT_CONFLICT` | terminate |
| `EFFECT_UNAUTHORIZED` | terminate |
| `SERVICE_UNAVAILABLE` | terminate |
| `PROVISIONING_UNAVAILABLE` | terminate |
| `INTEGRATION_FAILED` | terminate |
| `PROOF_FAILED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| checkout đã route hay head của nó không còn khớp ràng buộc đã đóng băng | `workspace.bind` |
| runtime mà một bề mặt frontend phải được audit trên đó nay đã phục vụ | `frontend.surface.audit` |
| dịch vụ dùng chung đã vận hành xong và release đang chờ nó có thể chạy tiếp | `release.deploy` |
| danh tính của luồng đã được cấp và lượt chạy đang chờ nó có thể kiểm luồng | `uat.verify` |
