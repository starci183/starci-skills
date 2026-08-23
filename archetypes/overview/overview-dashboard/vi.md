# Bảng tổng quan

## LOADS

Không có.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Mã archetype | `overview-dashboard` |
| Họ | Tổng quan |
| Nhiệm vụ trội | Quét nhiều tín hiệu khác loại về cùng một phạm vi hiện tại, hiểu điều gì cần chú ý và chọn hành động hoặc điểm đi sâu tiếp theo. |
| Bí danh tìm kiếm | `dashboard`, `home dashboard`, `overview`, `status overview`, `KPI overview`, `operational overview`, `role overview`, `command center`, `cockpit`, `progress dashboard`, `activity dashboard`, `trang tổng quan`, `bảng điều khiển`, `màn hình tổng quan`, `bảng tiến độ` |
| Cấp thẩm quyền | Bố cục vĩ mô dùng chung, trung lập với sản phẩm. |

### Tuyên bố thẩm quyền

Archetype này quyết định các vùng ngữ nghĩa mà một màn tổng quan cần có, độ ưu tiên tương đối, thứ tự
đọc và cách các vùng đang xuất hiện đồng thời biến đổi khi không gian hoặc áp lực nội dung không còn cho
phép giữ tính đồng thời. Nó không quyết định ý nghĩa sản phẩm, chủ sở hữu source có tên, cách trang trí,
hình học chính xác, component triển khai, token, class hay breakpoint bằng số.

Việc có nhiều ô chữ nhật không phải bằng chứng cho archetype này. Sự thật quyết định là một nhiệm vụ
quay lại thường xuyên để quét rồi hành động trên các tín hiệu khác loại nhưng cùng thuộc về một diễn viên,
vai trò, nơi chốn, chương trình, hoạt động hoặc phạm vi hiện tại.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết hoặc nghĩa vụ |
|---|---|---|
| `AR-OD-01` | Một bề mặt quay lại gom nhiều họ tín hiệu khác loại về cùng một phạm vi hiện tại. | Ứng viên. |
| `AR-OD-02` | Người dùng quét để tìm ý nghĩa hoặc mức khẩn rồi chọn nơi tiếp tục; đọc tuần tự mọi vùng không phải nhiệm vụ. | Bắt buộc để chọn. |
| `AR-OD-03` | Các vùng có độ ưu tiên tương đối ổn định: tiếp tục, rủi ro, hạn chót, tiến độ và hoạt động không thể hoán đổi. | Giữ thứ bậc trong mọi cách trình bày. |
| `AR-OD-04` | Các vùng có thể tải, làm mới, rỗng, cũ hoặc lỗi theo những vòng đời khác nhau. | Trao chủ sở hữu trạng thái độc lập cho từng vùng bị ảnh hưởng. |
| `AR-OD-05` | Không gian khả dụng không còn cho phép các vùng wide cùng hiện diện. | Chuyển sang thứ tự đọc intermediate hoặc compact đã khai báo mà không làm mất quyền truy cập. |
| `AR-OD-06` | Nội dung là một tập item đồng cấp, đồng loại với nhiệm vụ chính là duyệt, lọc và so sánh. | Từ chối; giải một archetype danh mục hoặc collection. |
| `AR-OD-07` | Một nhiệm vụ ngắn hoặc một đối tượng chiếm ưu thế, còn các phần tóm tắt xung quanh chỉ là phụ. | Từ chối; giải archetype focused task hoặc detail. |
| `AR-OD-08` | Nhiệm vụ trội là phân tích lâu một dataset qua điều khiển dày, lọc chéo hoặc thao tác trực tiếp. | Từ chối; giải analytical workspace. |

### Bộ phân giải

Chỉ chọn `overview-dashboard` khi có bằng chứng cho cả `AR-OD-01` và `AR-OD-02`, đồng thời không có
`AR-OD-06`, `AR-OD-07` hay `AR-OD-08` mô tả nhiệm vụ trội đúng hơn. Áp dụng `AR-OD-03`,
`AR-OD-04` và `AR-OD-05` bất cứ khi nào sự thật tương ứng xuất hiện; đó là nghĩa vụ, không phải biến
thể tuỳ chọn.

Giải từ công việc lặp lại của người dùng và quan hệ giữa các họ thông tin. Không giải từ số lượng ô, việc
có biểu đồ, tên route là “dashboard”, hay vẻ giống một ảnh tham khảo. Khi bằng chứng lẫn nhau, gọi tên
hành động mà bề mặt tồn tại để làm dễ hơn và loại được ranh giới gần nhất trước khi chọn archetype.

## Sơ đồ vùng

### Các vùng chuẩn

```text
context-header
└─ overview-body
   ├─ identity-and-summary-region
   └─ prioritized-main-region
      ├─ primary-continuation
      ├─ status-and-progress
      ├─ alerts-or-deadlines
      └─ secondary-activity
```

- `context-header` xác định phạm vi hiện tại và thời gian, chế độ hoặc trạng thái cần để diễn giải nó.
  Đây là ngữ cảnh trang, không phải shell toàn cục của sản phẩm.
- `identity-and-summary-region` trả lời đây là tổng quan của ai hoặc của cái gì, đồng thời cung cấp phần
  tóm tắt ổn định nhỏ nhất cần có trước khi các tín hiệu chi tiết mang nghĩa.
- `primary-continuation` phơi ra bước tiếp theo hoặc điểm đi sâu có giá trị cao nhất ở hiện tại.
- `status-and-progress` giải thích chuyển động, mức hoàn tất, sức khoẻ hoặc vị thế trong một khoảng có nghĩa.
- `alerts-or-deadlines` mang các tuyên bố chú ý ngoại lệ mà độ khẩn có thể đổi thứ tự thông thường.
- `secondary-activity` cung cấp ngữ cảnh gần đây hoặc ưu tiên thấp hơn mà không cạnh tranh với bước tiếp.

Sản phẩm không phải bịa nội dung cho mọi lá. Một lá vắng mặt thì được bỏ cùng với ý nghĩa và không gian
của nó; không thay bằng một vùng rỗng để trang trí. Hai trách nhiệm cấp cao trong body và ít nhất một lá
chính dẫn tới quyết định vẫn phải nhận diện được.

### Bất biến quan hệ

1. Context header đứng trước overview body trong thứ tự đọc logic.
2. Identity và summary thiết lập phạm vi trước vùng main có ưu tiên, kể cả khi cách trình bày wide đặt
   chúng cạnh nhau.
3. Các lá main là những trách nhiệm có xếp hạng, không phải một khảm có thể hoán đổi. Diện tích thị giác
   không được âm thầm viết lại độ ưu tiên.
4. Một cảnh báo khẩn chỉ được đứng trước primary continuation khi mức nghiêm trọng nghiệp vụ thật sự đòi
   hỏi ngắt quãng; activity thông thường thì không.
5. Một vùng có thể dẫn đến công việc sâu hơn, nhưng dashboard không hấp thụ workflow đó chỉ để giữ người
   dùng trên cùng một bề mặt.
6. Chủ sở hữu trạng thái đi theo vùng ngữ nghĩa, để một vùng chậm hoặc lỗi không xoá ngữ cảnh và hành động
   không bị ảnh hưởng.

## Hợp đồng responsive

### Wide

- Trình bày đồng thời `identity-and-summary-region` và `prioritized-main-region` khi cả hai vẫn giữ được
  chiều đo hữu ích. Summary có thể thành rail hỗ trợ hoặc dải dẫn đầu theo product grammar.
- Continuation và thông tin nhạy thời gian nhận vị trí đọc đầu. Status, progress và activity chỉ chia hàng
  khi thứ bậc vẫn đọc được.
- Giữ một luồng đọc dọc cấp trang. Overflow cục bộ chỉ được phép khi thông tin vốn dĩ cần; trang không có
  thêm một trục duyệt ngang chỉ để trang trí.
- Hành vi sticky phải do một nhiệm vụ dai dẳng kiếm được, không phải do wide còn chỗ. Không vùng overview
  nào mặc định sticky.

### Intermediate

- Biến đổi khi summary, nhãn, hành động hoặc tín hiệu main không còn dùng được cùng nhau; không suy ra loại
  thiết bị.
- Giảm số nhóm xuất hiện đồng thời trước khi ép nội dung. Identity và summary có thể thành dải dẫn đầu,
  summary ngắn hơn hoặc section đầu trong flow.
- Giữ primary continuation và mọi cảnh báo khẩn trước secondary activity. Vùng phụ đi xuống dưới; không
  biến mất.
- Nếu rail wide mang điều hướng cục bộ, thay bằng tóm tắt điều hướng trong flow hoặc một điều khiển mở rõ
  ràng mà trạng thái hiện tại vẫn nhìn thấy.

### Compact

- Dùng một flow dọc chính: context, identity hoặc scope summary, chú ý khẩn nếu có, primary continuation,
  status và progress, rồi secondary activity.
- Loại bỏ sự phụ thuộc vào bố cục cạnh nhau. Summary có thể ngắn hoặc mở dần, nhưng phạm vi và trạng thái
  thiết yếu vẫn hiện trước nội dung phụ thuộc.
- Mọi hành động wide vẫn truy cập được gần nội dung chúng tác động. Không gom các hành động không liên quan
  vào một điều khiển compact mơ hồ.
- Ưu tiên cuộn trang. Một vùng cuộn cục bộ phải có lý do hai chiều vốn có và không được bẫy luồng đọc hay
  di chuyển bằng bàn phím thông thường.
- Hành động cố định trên hoặc dưới chỉ được phép khi thật sự xuyên vùng và không thể che nội dung đang
  focus, trạng thái hay cuối trang.

### Reflow

- Reflow đi theo áp lực nội dung: không gian hẹp, chữ phóng lớn, zoom, bản dịch dài, định danh dài, đổi
  hướng viết và nội dung do người dùng tạo đều thực thi cùng hợp đồng.
- Giữ thứ tự source ngữ nghĩa. Sắp xếp thị giác không được làm thứ tự đọc bằng mắt, bàn phím và công nghệ
  hỗ trợ mâu thuẫn nhau.
- Chữ và vùng thông thường reflow mà không làm trang phải cuộn hai chiều hay mất thông tin. Biểu đồ hoặc
  sơ đồ hai chiều vốn có tự sở hữu ngoại lệ có giới hạn và cung cấp summary tương đương hoặc đường tới
  cùng sự thật.
- Nhãn và giá trị dài được xuống dòng hoặc có đường mở đầy đủ truy cập được; cắt chữ không bao giờ là đường
  duy nhất tới ý nghĩa. Tiêu đề vùng và hành động của vùng vẫn gắn với nhau sau khi xuống dòng.
- Các cách trình bày loading, empty, error, stale và populated giữ cùng thứ tự vùng để hoàn tất bất đồng bộ
  không làm dashboard xáo trộn.

### Ngang bằng tương tác

- Mọi hành động, điểm đi sâu, lời giải thích, làm mới, đường phục hồi và trạng thái có ở wide vẫn truy cập
  được trong intermediate và compact.
- Điều hướng thay thế giữ vị trí hiện tại và cùng đích đến. Đóng nội dung mở dần phải trả focus về điều
  khiển đã mở nó.
- Refresh và retry giữ phạm vi hiện tại, không tự dịch focus hoặc vị trí đọc nếu không có lý do được thông
  báo.
- Thông tin được mã hoá bằng sự kề nhau hoặc bằng màu ở wide phải có tương đương bằng chữ hoặc cấu trúc sau
  reflow.
- Thứ tự vùng chỉ đổi theo luật ưu tiên đã khai báo; thứ tự response về, cá nhân hoá và đổi viewport không
  được âm thầm đổi nghĩa trang.

## Nghĩa vụ trạng thái

### Ma trận trạng thái bắt buộc

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Tải lần đầu | Từng vùng mang dữ liệu | Giữ vị trí ngữ nghĩa và cho biết điều gì đang chờ mà không chặn ngữ cảnh trang đã biết. |
| Làm mới tăng dần | Vùng đang làm mới | Giữ giá trị cũ còn an toàn, báo hoạt động refresh và không reset vùng không liên quan. |
| Dữ liệu một phần | Vùng bị ảnh hưởng và phần phụ thuộc | Nói rõ cái gì có và cái gì thiếu; không trình bày dữ liệu chưa đủ thành tổng quan hoàn chỉnh. |
| Dữ liệu cũ | Vùng bị ảnh hưởng | Phơi độ cũ và đường phục hồi trong khi giữ cách diễn giải an toàn gần nhất. |
| Vùng rỗng | Vùng bị ảnh hưởng | Giải thích sự vắng mặt có nghĩa hoặc bỏ lá tuỳ chọn; không giả dạng loading. |
| Cả overview rỗng | Overview body | Giải thích vì sao chưa có tín hiệu và cung cấp đường tiếp hợp lệ nếu tồn tại. |
| Lỗi phục hồi được | Vùng bị ảnh hưởng | Giữ vùng không bị ảnh hưởng dùng được và cung cấp retry cục bộ hoặc đường thay thế. |
| Lỗi phạm vi hoặc quyền | Ngữ cảnh trang | Ngăn dữ liệu sai phạm vi gây hiểu nhầm, xác định phạm vi bị chặn và cung cấp phục hồi hoặc lối thoát an toàn. |
| Tín hiệu khẩn mới | Alerts hoặc deadlines | Thông báo mà không bất ngờ cướp focus; chỉ đổi thứ tự theo luật mức nghiêm trọng đã khai báo. |

### Bất biến trạng thái

1. Độ trễ hoặc lỗi của một vùng không tạo loading hay error toàn trang khi ngữ cảnh trang và vùng khác vẫn
   hợp lệ.
2. Loading, empty, unavailable, stale và error mang những nghĩa khác nhau.
3. Placeholder hoàn tất không đổi thứ tự logic hay làm nhiệm vụ chính nhảy giữa các vùng.
4. Summary được suy ra phải nói rõ khi vùng nguồn chưa đủ và không báo sự chắc chắn giả.
5. Phục hồi được sở hữu cục bộ ngang với lỗi, trừ khi danh tính trang, quyền hoặc phạm vi không hợp lệ.

## Ranh giới

### Dùng khi

- Một người quay lại định kỳ để định hướng trước khi chọn giữa nhiều bước tiếp theo có nghĩa.
- Nhiều họ tín hiệu mô tả cùng một phạm vi hiện tại với độ khẩn hoặc giá trị quyết định không bằng nhau.
- Góc nhìn bức tranh lớn vẫn hữu ích dù công việc chi tiết diễn ra ở nơi khác.
- Khả dụng một phần phải suy giảm theo từng vùng thay vì làm sập cả trang.

### Từ chối và định tuyến

| Bằng chứng | Lý do từ chối | Định tuyến |
|---|---|---|
| `AR-OD-06`: item đồng cấp có cùng anatomy so sánh và điều khiển khám phá quyết định result set. | Bề mặt là một collection, kể cả khi từng item nằm trong ô. | `searchable-card-catalog` hoặc archetype collection khác. |
| `AR-OD-07`: một hành động ngắn mới là công việc thật. | Các summary xung quanh làm phân tán hoàn tất. | Archetype focused single-task. |
| `AR-OD-07`: một đối tượng và quyết định về nó chiếm ưu thế. | Đây là hiểu đối tượng, không phải định hướng khi quay lại. | Archetype detail. |
| `AR-OD-08`: thao tác dày trên một dataset chiếm cả phiên. | Thứ bậc summary không mang nổi công việc phân tích. | Analytical workspace. |
| Một chuỗi hữu hạn câu hỏi hoặc bước sở hữu tiến độ và submit. | Người dùng đang tiến hành một phiên, không quét overview. | Archetype assessment hoặc guided-work. |

### Biến thể, không phải archetype mới

- Overview trình bày, vận hành, tiến độ học, cá nhân, nhóm và điều hành vẫn là archetype này khi nhiệm vụ
  trội và quan hệ vùng khớp.
- Rail hỗ trợ so với dải summary dẫn đầu là quyết định responsive hoặc grammar.
- Khác số lượng metric, biểu đồ, cảnh báo hoặc activity record không tạo archetype mới.
- Màu, mật độ, cách xử lý card, minh hoạ và chuyển động không bao giờ phân biệt archetype.

## Bàn giao

### Archetype → Grammar

Chuyển các mã tình huống đã chọn, nhiệm vụ trội, danh sách mã vùng có thứ tự, quan hệ, phần được phép bỏ,
ngoại lệ đổi thứ tự theo mức nghiêm trọng, biến đổi responsive và nghĩa vụ trạng thái. Grammar giải phạm
vi có nghĩa gì trong product family đã chọn, semantic owner nào thực hiện từng vùng, hành động và trạng
thái nào hợp lệ, cùng capability sản phẩm sẵn có nào được dùng.

Grammar được chuyên biệt nhãn và ý nghĩa nhưng không được biến các vùng khác loại có xếp hạng thành
catalog đồng cấp, xoá đường phục hồi bắt buộc hay bỏ quyền truy cập compact tới một hành động wide mà
không quay lại phân giải archetype.

### Grammar → Principles

Sau khi grammar chọn semantic owner, principles giải grid, flow, measure, spacing, alignment, cách hiện
thực thứ tự, cách hiện thực sticky, containment overflow và điểm chuyển theo nội dung chính xác.
Principles được điều chỉnh hình học; không được đổi nhiệm vụ trội, quyền sở hữu vùng, độ ưu tiên hay ngang
bằng tương tác.

Archetype này không phát component triển khai, class, token, kích thước chính xác hay breakpoint bằng số.

## Bằng chứng nghiên cứu không ràng buộc

### Bằng chứng chính thức bên ngoài

- [Carbon Design System — Dashboards](https://carbondesignsystem.com/data-visualization/dashboards/)
  củng cố góc nhìn bức tranh lớn, thứ bậc rõ, giảm phân tán và ranh giới giữa dashboard trình bày với
  dashboard khám phá.
- [SAP Fiori — Overview Page](https://experience.sap.com/fiori-design-web/v1-78/overview-page/)
  mô tả overview theo vai trò, nơi người dùng nhận ra vấn đề cần chú ý rồi đi tới công việc sâu hơn.
- [Material Design — Canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
  cung cấp tiền lệ feed và supporting pane thích ứng qua nhiều cấu hình không gian khả dụng.
- [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) yêu cầu nội dung
  thông thường giữ nguyên khả dụng và chức năng qua reflow, đồng thời giới hạn ngoại lệ hai chiều thật sự.

Các nguồn này giúp thử thách quyết định; không nguồn nào chọn ý nghĩa StarCi, cách triển khai hay xử lý
thị giác.

### Bằng chứng StarCi

Dashboard học tập hiện tại của StarCi cung cấp product fact quan sát được cùng implementation capability
cho scope, continuation, progress, attention, activity và narrow reflow. Nó không chứng minh composition
hiện tại là đúng. Chỉ quan hệ nào độc lập pass record này mới corroborate archetype; xung đột là
`layout-drift`. Source không bao giờ cho phép sao chép content, owner, geometry hay styling.

### Ranh giới bằng chứng

Nghiên cứu và source hiện tại là provenance tư vấn. Thẩm quyền ràng buộc ở đây là luật nhận diện, sơ đồ
vùng, hợp đồng responsive, nghĩa vụ trạng thái, ranh giới và bàn giao. Thay đổi source hay cập nhật
guideline ngoài không âm thầm viết lại thẩm quyền đó.

## Đầu ra

### Bản ghi runtime

Phát đúng tập trường JSON đóng này; không thêm, bỏ hay đổi tên trường:

```json
{
  "archetypeId": "overview-dashboard",
  "situationCodes": ["<các mã AR-OD-* khớp>"],
  "searchAliases": [
    "dashboard",
    "home dashboard",
    "overview",
    "status overview",
    "KPI overview",
    "operational overview",
    "role overview",
    "command center",
    "cockpit",
    "progress dashboard",
    "activity dashboard",
    "trang tổng quan",
    "bảng điều khiển",
    "màn hình tổng quan",
    "bảng tiến độ"
  ],
  "dominantTask": "<một câu quét-rồi-hành-động có bằng chứng>",
  "regions": ["<các mã vùng chuẩn có thứ tự còn lại sau phần bỏ có bằng chứng>"],
  "regionRelationships": ["<các quan hệ cha, ưu tiên và sở hữu trạng thái có thứ tự>"],
  "responsive": {
    "wide": "<cách trình bày vùng đồng thời>",
    "intermediate": "<biến đổi theo nội dung đầu tiên>",
    "compact": "<cách trình bày một flow>",
    "reflow": "<nghĩa vụ về zoom, nội dung dài, hướng viết và overflow>",
    "readingOrder": "<một thứ tự logic chung cho mắt nhìn, bàn phím và công nghệ hỗ trợ>",
    "navigationReplacement": "<thứ thay cho điều hướng cục bộ bị dời, hoặc none>",
    "stickyBehavior": "<hành vi cố định đã kiếm được và điều kiện thả, hoặc none>",
    "overflowOwner": "<page hoặc vùng hai chiều vốn có được gọi tên>",
    "interactionParity": "<cách mọi hành động và trạng thái wide vẫn truy cập được>"
  },
  "stateObligations": ["<các nghĩa vụ trạng thái và phục hồi áp dụng>"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<quyết định ý nghĩa sản phẩm và semantic owner chưa giải>"],
  "principlesHandoff": ["<quyết định hình học và hiện thực chưa giải>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<sự thật nghiệp vụ>", "<capability source đã xác minh>", "<nghiên cứu không ràng buộc>"]
}
```
