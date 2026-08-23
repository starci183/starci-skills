# Danh mục thẻ có tìm kiếm

## LOADS

Không có.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Mã archetype | `searchable-card-catalog` |
| Họ | Khám phá |
| Nhiệm vụ trội | Khám phá, thu hẹp, quét và so sánh một tập item đồng cấp, đồng loại trước khi mở hoặc hành động lên một item. |
| Bí danh tìm kiếm | `catalog`, `catalogue`, `card catalog`, `searchable catalog`, `browse`, `discovery`, `library`, `course catalog`, `marketplace grid`, `filtered collection`, `resource gallery`, `searchable card grid`, `danh mục`, `thư viện`, `danh sách thẻ`, `tìm kiếm và lọc` |
| Cấp thẩm quyền | Bố cục vĩ mô dùng chung, trung lập với sản phẩm. |

### Tuyên bố thẩm quyền

Archetype này quyết định quan hệ giữa ngữ cảnh khám phá, các điều khiển, một result set gồm item đồng cấp
và cách tiếp tục đi qua tập đó. Nó cũng quyết định cách các trách nhiệm này giữ nhất quán khi toolbar wide
hoặc rail lọc không còn có thể hiện cạnh kết quả.

Nó không quyết định một item mang nghĩa gì, field nào hiện trên item, giá trị lọc nào khả dụng, owner
source, cách xử lý thị giác, hình học chính xác, component triển khai, token, class hay breakpoint bằng
số. Chỉ có bề ngoài lặp lại dạng card chưa phải bằng chứng; phải có ngữ nghĩa đồng cấp và nhiệm vụ
duyệt-rồi-thu-hẹp.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết hoặc nghĩa vụ |
|---|---|---|
| `AR-SC-01` | Bề mặt phơi một tập item đồng cấp, đồng loại với một anatomy ngữ nghĩa có thể so sánh. | Ứng viên. |
| `AR-SC-02` | Người dùng có thể đến mà chưa biết chính xác item và cần duyệt, tìm, thu hẹp, sắp xếp hoặc so sánh trước khi chọn. | Bắt buộc để chọn. |
| `AR-SC-03` | Search, filter, sort, lựa chọn view, tiêu chí đang áp dụng, result count và continuation mô tả cùng một committed result set. | Giữ mọi điều khiển và summary gắn với cùng dataset state. |
| `AR-SC-04` | Mỗi peer phơi đủ bằng chứng so sánh để đánh giá việc mở hoặc hành động lên nó có đáng hay không. | Giữ khả năng quét so sánh trong mọi cách trình bày. |
| `AR-SC-05` | Không gian khả dụng không còn cho phép toàn bộ điều khiển khám phá và kết quả cùng hiện diện. | Thay cách trình bày mà không mất tiêu chí đang áp dụng, vị trí hay quyền truy cập. |
| `AR-SC-06` | Các vùng lặp lại là tín hiệu khác loại với công việc và độ ưu tiên không bằng nhau. | Từ chối; giải archetype overview. |
| `AR-SC-07` | Quan hệ cha-con hoặc điều hướng theo đường dẫn là cách chính để tìm item. | Từ chối; giải hierarchical browser. |
| `AR-SC-08` | So sánh dày theo từng field, chọn hàng loạt, xử lý queue hoặc sửa inline là nhiệm vụ trội. | Từ chối; giải table, worklist hoặc operational collection. |

### Bộ phân giải

Chỉ chọn `searchable-card-catalog` khi có bằng chứng cho `AR-SC-01` và `AR-SC-02`, đồng thời không có
`AR-SC-06`, `AR-SC-07` hay `AR-SC-08` mô tả nhiệm vụ trội đúng hơn. Áp dụng `AR-SC-03`, `AR-SC-04` và
`AR-SC-05` bất cứ khi nào sự thật tương ứng xuất hiện.

Giải từ tính đồng cấp của item và hành vi khám phá, không từ việc có search, filter hay ranh giới trông
giống card. Search qua các đích đến khác loại là bài toán search-results; filter trên operational table
không biến nó thành archetype này. Nếu không chứng minh được anatomy item có thể so sánh hoặc một danh
tính result set thống nhất, trả `needs-evidence` thay vì bịa ra.

## Sơ đồ vùng

### Các vùng chuẩn

```text
catalog-header
├─ location-and-title
└─ discovery-toolbar
   ├─ search
   ├─ filters
   ├─ sort
   ├─ view-switch
   └─ result-count

result-region
├─ active-filter-summary
├─ peer-item-grid-or-list
├─ empty-or-no-result-guidance
└─ pagination-or-continuation
```

- `location-and-title` gọi tên collection và đủ phạm vi để diễn giải mọi kết quả.
- `search` thu hẹp hoặc định vị peer trong phạm vi collection đã khai báo.
- `filters` giới hạn tập qua các thuộc tính item đã biết.
- `sort` đổi thứ tự kết quả mà không đổi danh tính item.
- `view-switch` đổi cách trình bày cùng một result set; nó chỉ tồn tại khi cả hai view phục vụ một nhiệm
  vụ thật.
- `result-count` mô tả đúng committed query được các kết quả đang thấy đại diện.
- `active-filter-summary` làm constraint hiện tại kiểm tra và đảo ngược được ngay cả khi điều khiển lọc
  không mở.
- `peer-item-grid-or-list` chứa các peer đồng loại, không chứa summary không liên quan.
- `empty-or-no-result-guidance` sở hữu hai lời giải thích vắng mặt khác nhau.
- `pagination-or-continuation` tiến tiếp trong cùng một danh tính result set.

Search được mong đợi khi thuộc tính chữ có nghĩa và quy mô collection hoặc nhiệm vụ kiếm được nó. Catalog
có thể bỏ một điều khiển không áp dụng, nhưng không được hiện điều khiển trơ hay bịa category lọc chỉ để
trông giống một catalog tham khảo.

### Bất biến quan hệ

1. Ngữ cảnh catalog và điều khiển khám phá đứng trước kết quả trong thứ tự đọc logic.
2. Search, filter, sort, tiêu chí đang áp dụng, result count, item đang thấy và continuation là các projection
   của cùng một committed dataset state.
3. Tiêu chí đã áp dụng vẫn kiểm tra và đảo ngược được khi control surface đầy đủ đang đóng.
4. Mọi item kết quả là peer. Item được nhấn mạnh có thể nổi bật nhưng không trở thành một họ thông tin khác
   bên trong vùng kết quả đồng cấp.
5. View switch đổi cách trình bày, không đổi query, selection, ngữ nghĩa item hay hành động khả dụng.
6. Pagination hoặc continuation giữ active query và đứng sau result region; nó không trở thành điều hướng
   toàn trang.
7. Mở một item có thể rời catalog, nhưng khi quay lại phải giữ ngữ cảnh khám phá theo policy sản phẩm do
   grammar giải.

## Hợp đồng responsive

### Wide

- Cho discovery toolbar điều khiển toàn bộ result set. Search nhận vị trí ổn định, nổi bật; result count
  vẫn gắn thấy được với committed results.
- Khi có nhiều category lọc và việc so sánh hưởng lợi từ tính đồng thời, filters có thể chiếm rail hỗ trợ.
  Nếu không, chúng ở trong vùng khám phá dẫn đầu.
- Kết quả có thể dùng peer grid nhiều track hoặc joined list theo nhu cầu so sánh item. Số track đi theo
  measure hữu ích của item, không theo một kho cố định.
- Một vùng điều khiển khám phá chỉ được duy trì khi collection dài cuộn nếu phạm vi và trạng thái của nó
  vẫn rõ, đồng thời không tạo các chủ sở hữu scroll cạnh tranh.

### Intermediate

- Cho search một dòng dùng được riêng trước khi ép hoặc dời các điều khiển phụ.
- Dời filters lớn sau một điều khiển mở rõ ràng khi trình bày đồng thời không còn chừa measure hữu ích cho
  kết quả. Giữ tiêu chí đang áp dụng, số lượng của chúng và đường clear-all ở ngoài.
- Giữ result count, sort và lựa chọn view hợp lệ gắn với cùng result set kể cả khi chúng xuống nhiều dòng.
- Giảm số track kết quả trước khi cắt bằng chứng item. Grid chuyển thành list khi so sánh peer và nội dung
  item rõ hơn theo cách đó; không bắt buộc đi qua mọi số track có thể có.
- Giữ query, filter, sort, item đã chọn và vị trí continuation qua biến đổi.

### Compact

- Dùng một thứ tự dọc chính: location và title, search, quyền truy cập filter hoặc sort, tiêu chí đang áp
  dụng, result count, peer results, rồi continuation.
- Trình bày filter lớn hoặc lựa chọn sort trong một bề mặt cục bộ tạm thời hay thay thế. Điều khiển mở cho
  biết khi có tiêu chí đang áp dụng, và khi đóng trả focus về điều khiển mở.
- Giữ query hiện tại và tiêu chí đã áp dụng nhìn thấy hoặc kiểm tra ngay được trong lúc đọc kết quả.
- Dùng một result flow hữu ích trừ khi nhiều hơn một track vẫn đọc được dưới áp lực nội dung thật. Danh
  tính item, bằng chứng so sánh quyết định, trạng thái và đường chính vẫn còn.
- Tránh cuộn dọc lồng nhau cho kết quả thông thường. Page flow sở hữu scroll; chỉ media vốn có hoặc vùng
  hai chiều thật sự khác được sở hữu overflow có giới hạn.
- Nếu continuation tự động, nó vẫn phải thông báo nội dung mới, giữ vị trí, phơi lỗi và điểm hoàn tất, đồng
  thời cung cấp cách thay thế khi continuation vô tận cản định hướng.

### Reflow

- Reflow phải chịu được chữ phóng lớn, zoom, bản dịch dài, tên item dài, nhãn lọc lớn, đổi hướng viết,
  media vắng và nội dung do người dùng tạo.
- Giữ thứ tự source ngữ nghĩa: ngữ cảnh catalog, điều khiển khám phá, tiêu chí đang áp dụng, summary kết
  quả, peers và continuation. Di chuyển thị giác không tạo thứ tự đọc bằng bàn phím hay công nghệ hỗ trợ
  mâu thuẫn.
- Quyền truy cập search và filter không bao giờ biến mất. Điều khiển được phép dời hoặc mở dần, nhưng chức
  năng, nhãn, trạng thái đang áp dụng và đường clear vẫn còn.
- Chữ và item thông thường reflow mà không làm trang phải cuộn hai chiều. Media preview vốn có tự sở hữu
  ngoại lệ có giới hạn mà không làm result region rộng ra.
- Bằng chứng item xuống dòng hoặc có đường mở đầy đủ truy cập được. Cắt chữ, hover, màu hay ảnh một mình
  không bao giờ là thứ duy nhất mang danh tính, trạng thái hoặc thông tin so sánh quyết định.

### Ngang bằng tương tác

- Search, mọi category filter áp dụng, lựa chọn sort, lựa chọn view hợp lệ, result count, hành động item và
  continuation vẫn vận hành được trong wide, intermediate và compact.
- Điều khiển bị dời giữ ngữ nghĩa draft-so-với-applied. Đóng, apply, cancel hay clear có cùng tác động lên
  dataset trong mọi cách trình bày.
- Focus ở lại điều khiển khởi phát hoặc đi tới summary kết quả được thông báo rõ sau committed update; kết
  quả refresh không trả focus về đầu trang.
- Query và tiêu chí đã áp dụng sống qua reflow, quay lại từ item detail và request failure phục hồi được
  theo policy grammar.
- Cách trình bày dày hơn không được tạo đường chỉ dùng hover, sắp xếp chỉ dùng pointer hay trạng thái chỉ
  dùng màu.
- Result count, empty state, pagination và kết quả đang thấy không bao giờ mô tả các phiên bản query khác
  nhau.

## Nghĩa vụ trạng thái

### Ma trận trạng thái bắt buộc

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Tải collection lần đầu | Result region | Giữ ngữ cảnh catalog và điều khiển; cho biết tập peer đầu đang chờ. |
| Search hoặc filter draft | Discovery toolbar | Phân biệt tiêu chí chưa commit với result set hiện đang thấy. |
| Query update đang chờ | Result region và result summary | Giữ ngữ cảnh committed query, báo update và ngăn commit trùng. |
| Continuation tăng dần | Pagination hoặc continuation | Giữ peer hiện có dùng được, xác định nơi nội dung mới sẽ nối và giữ vị trí. |
| Collection rỗng | Result region | Giải thích chính collection chưa có item và cung cấp đường tiếp hợp lệ khi tồn tại. |
| Không có kết quả khớp | Empty hoặc no-result guidance | Giữ query và tiêu chí, hiện zero count và cung cấp phục hồi đảo ngược được mà không giả rằng collection rỗng. |
| Query lỗi | Result region | Giữ query, tiêu chí đã áp dụng và kết quả an toàn trước đó khi có thể; cung cấp retry đúng phạm vi. |
| Dữ liệu item một phần | Peer bị ảnh hưởng | Giữ danh tính và hành động an toàn rõ, xác định bằng chứng thiếu và không bịa giá trị so sánh. |
| Continuation lỗi | Continuation region | Giữ peer đã tải và ngữ cảnh khám phá; retry không nhân đôi item. |
| Hết kết quả | Continuation region | Thông báo hoàn tất và giữ item cuối cùng cùng đường quay lại truy cập được. |
| Kết quả bị giới hạn quyền | Ngữ cảnh catalog hoặc peer bị ảnh hưởng | Nói rõ giới hạn phạm vi mà không ám chỉ các peer không truy cập được là không tồn tại. |

### Bất biến trạng thái

1. Collection rỗng và không có kết quả khớp là hai trạng thái khác nhau với cách phục hồi khác nhau.
2. Query failure không xoá query hay filter của người dùng.
3. Result count mô tả cùng committed state với peer đang thấy; trong lúc chuyển nó được đánh pending hoặc
   giữ nghĩa an toàn gần nhất.
4. Tải thêm không thay, đổi thứ tự hay nhân đôi peer đã tải, trừ khi sort hoặc thay đổi dữ liệu đã khai báo
   đòi hỏi và thay đổi được thông báo.
5. Thiếu media item hoặc metadata tuỳ chọn không xoá danh tính item hay đường hợp lệ của nó.
6. Clear tiêu chí đảo ngược được cho tới khi ngữ nghĩa commit nói khác và không để lại constraint đang áp
   dụng nhưng bị ẩn.

## Ranh giới

### Dùng khi

- Item là peer ngữ nghĩa và phơi bằng chứng có thể so sánh trước khi chọn.
- Người dùng hưởng lợi từ khám phá vì có thể chưa biết chính xác item từ đầu.
- Search, filter, sort hay lựa chọn view thu hẹp hoặc đổi thứ tự một tập thống nhất.
- Mở một item thường là chuyển từ khám phá sang detail hoặc công việc.

### Từ chối và định tuyến

| Bằng chứng | Lý do từ chối | Định tuyến |
|---|---|---|
| `AR-SC-06`: các vùng đại diện tín hiệu, độ ưu tiên và hành động khác loại. | Sự lặp lại chỉ là thị giác, không phải đồng cấp ngữ nghĩa. | `overview-dashboard` hoặc archetype overview khác. |
| `AR-SC-07`: việc tìm phụ thuộc vào đi qua cha, con, folder hoặc path. | Một result set đồng cấp phẳng sẽ xoá cấu trúc. | Hierarchical browser. |
| `AR-SC-08`: so sánh cấp cột, bulk operation, queue state hay inline edit là trội. | Peer summary không mang công việc an toàn. | Data table, worklist hoặc operational collection. |
| Kết quả trộn các họ entity không liên quan từ một global query. | Không tồn tại một anatomy item so sánh được và một collection scope. | Archetype federated search-results. |
| Narrative và quyết định của một item chiếm ưu thế. | Khám phá đã kết thúc. | Archetype detail. |
| Một chuỗi recommendation quyết định item tiếp cho người dùng. | Duyệt tự do không phải nhiệm vụ. | Guided hoặc recommendation flow. |

### Biến thể, không phải archetype mới

- Catalog course, product, service, người, template, media và resource vẫn là archetype này khi tính đồng
  cấp và quan hệ khám phá khớp.
- Grid so với list, filter rail so với filter mở dần, submitted so với active search, và phân trang so với
  continuation tăng dần là biến thể do bằng chứng nhiệm vụ và grammar quản.
- Mật độ item, tỉ lệ ảnh, số field, cách xử lý card và phong cách trang trí không tạo archetype mới.
- Peer nổi bật chỉ còn là biến thể khi nó tham gia cùng query, trạng thái và hành động.

## Bàn giao

### Archetype → Grammar

Chuyển mã tình huống đã chọn, collection scope, định nghĩa peer-item, nhiệm vụ khám phá trội, các vùng
chuẩn, quan hệ control-to-result, các điều khiển áp dụng, kỳ vọng persistence, thay thế responsive và nghĩa
vụ trạng thái. Grammar giải ý nghĩa item theo sản phẩm, thuộc tính và tiêu chí khả dụng, ngữ nghĩa hành
động, owner item, route detail, policy commit query và policy giữ trạng thái khi quay lại.

Grammar được bỏ một điều khiển mà sự thật sản phẩm không kiếm được. Nó không được tách một count đang hiện
khỏi kết quả thấy được, ẩn constraint đang áp dụng, trộn entity family không liên quan thành peer hay bỏ
quyền compact truy cập một capability wide hợp lệ.

### Grammar → Principles

Sau khi grammar giải semantic owner, principles quyết định flow chính xác, cách hiện thực grid hoặc list,
measure item hữu ích, spacing, alignment, wrapping điều khiển, hình học disclosure, cách hiện thực sticky,
containment overflow và điểm chuyển theo nội dung. Principles được đổi cách trình bày nhưng không đổi danh
tính result set, tính đồng cấp, thứ tự đọc, phân biệt trạng thái hay ngang bằng tương tác.

Archetype này không phát component triển khai, class, token, kích thước chính xác hay breakpoint bằng số.

## Bằng chứng nghiên cứu không ràng buộc

### Bằng chứng chính thức bên ngoài

- [Carbon Design System — Search](https://carbondesignsystem.com/patterns/search-pattern/) gọi catalog
  discovery là một tình huống dùng active search, đồng thời yêu cầu result count, phản hồi loading, truy
  cập bàn phím và phục hồi khỏi ngõ cụt no-results.
- [Carbon Design System — Filtering](https://carbondesignsystem.com/patterns/filtering/) phân biệt các
  mô hình commit filter, giữ trạng thái filter đang áp dụng nhìn thấy khi điều khiển đóng và đặt nghĩa vụ
  clear/reset.
- [Material Design — Canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
  mô tả feed là cách sắp peer content có thể cấu hình và xem compact, intermediate cùng expanded space là
  các cấu hình thích ứng.
- [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) yêu cầu nội dung
  và chức năng giữ khả dụng qua reflow, đồng thời cảnh báo việc điều khiển biến mất sau biến đổi.

Các nguồn này thử thách và củng cố topology; không nguồn nào quyết định filter sản phẩm, anatomy item,
source ownership hay cách xử lý thị giác.

### Bằng chứng StarCi

Bề mặt khám phá khóa học hiện tại của StarCi cung cấp product fact quan sát được cùng implementation
capability cho collection identity, search, result count, peer presentation, view choice, empty handling,
continuation và narrow reflow. Nó không chứng minh composition hiện tại là đúng. Chỉ quan hệ nào độc lập
pass record này mới corroborate archetype; xung đột là `layout-drift`. Source không bao giờ cho phép sao
chép field, control, geometry, styling hay business meaning.

### Ranh giới bằng chứng

Nghiên cứu và source hiện tại là provenance tư vấn. Thẩm quyền ràng buộc ở đây là luật nhận diện, sơ đồ
vùng, hợp đồng responsive, nghĩa vụ trạng thái, ranh giới và bàn giao. Thay đổi source hay cập nhật
guideline ngoài không âm thầm viết lại thẩm quyền đó.

## Đầu ra

### Bản ghi runtime

Phát đúng tập trường JSON đóng này; không thêm, bỏ hay đổi tên trường:

```json
{
  "archetypeId": "searchable-card-catalog",
  "situationCodes": ["<các mã AR-SC-* khớp>"],
  "searchAliases": [
    "catalog",
    "catalogue",
    "card catalog",
    "searchable catalog",
    "browse",
    "discovery",
    "library",
    "course catalog",
    "marketplace grid",
    "filtered collection",
    "resource gallery",
    "searchable card grid",
    "danh mục",
    "thư viện",
    "danh sách thẻ",
    "tìm kiếm và lọc"
  ],
  "dominantTask": "<một câu khám phá có bằng chứng>",
  "regions": ["<các mã vùng chuẩn có thứ tự còn lại sau phần bỏ có bằng chứng>"],
  "regionRelationships": ["<các quan hệ phạm vi, dataset, ưu tiên và sở hữu trạng thái có thứ tự>"],
  "responsive": {
    "wide": "<điều khiển và kết quả cùng hiện diện>",
    "intermediate": "<biến đổi điều khiển hoặc kết quả đầu tiên theo nội dung>",
    "compact": "<cách trình bày một flow và điều khiển bị dời>",
    "reflow": "<nghĩa vụ về zoom, nội dung dài, hướng viết và overflow>",
    "readingOrder": "<một thứ tự logic chung cho mắt nhìn, bàn phím và công nghệ hỗ trợ>",
    "navigationReplacement": "<thứ thay cho filter hoặc điều hướng collection bị dời, hoặc none>",
    "stickyBehavior": "<hành vi khám phá cố định đã kiếm được và điều kiện thả, hoặc none>",
    "overflowOwner": "<page hoặc vùng hai chiều vốn có được gọi tên>",
    "interactionParity": "<cách mọi điều khiển, hành động và trạng thái wide vẫn truy cập được>"
  },
  "stateObligations": ["<các nghĩa vụ trạng thái và phục hồi áp dụng>"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<quyết định ý nghĩa sản phẩm, query và semantic owner chưa giải>"],
  "principlesHandoff": ["<quyết định hình học và hiện thực chưa giải>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<sự thật nghiệp vụ>", "<capability source đã xác minh>", "<nghiên cứu không ràng buộc>"]
}
```
