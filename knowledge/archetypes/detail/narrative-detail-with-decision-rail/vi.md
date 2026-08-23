# Chi tiết tự sự với vùng quyết định bên cạnh

## LOADS

Không có.


## Danh tính

### Bản ghi archetype

`narrative-detail-with-decision-rail` là archetype màn chi tiết dùng lại được cho một đối tượng có ý
nghĩa được giải thích bằng nội dung tự sự đáng kể và có bước quyết định hệ trọng tiếp theo phụ thuộc vào
một tập dữ kiện gọn. Nó giữ phần giải thích làm vùng chính và trao cho quyết định một vùng hỗ trợ có ranh
giới rõ. Vùng hỗ trợ là **decision rail** vì nó giúp một người phán đoán rồi cam kết; chỉ nằm cạnh nội
dung chưa đủ để một vùng trở thành rail này.

Các bí danh tìm kiếm gồm `narrative detail`, `detail with CTA`, `detail with purchase rail`, `detail
with enrolment rail`, `detail with application rail`, `content with decision summary`, và `long-form
detail with action`.

### Nhiệm vụ trội

Hiểu đủ rõ một đối tượng để đưa ra một quyết định hệ trọng chính mà không đánh mất dữ kiện quyết định,
điều kiện, cảnh báo hay đường phục hồi cần thiết cho quyết định đó.

### Cam kết

- Phần tự sự vẫn là một câu chuyện mạch lạc, dễ đọc thay vì một tập tile quảng bá.
- Vùng quyết định vẫn phụ thuộc rõ vào đối tượng nhưng luôn dễ tìm.
- Dữ kiện quyết định và hành động chính mô tả cùng đối tượng, cùng trạng thái hiện tại với phần tự sự.
- Góc nhìn hẹp hơn hoặc được phóng đại vẫn giữ quyết định, bằng chứng để đánh giá nó và mọi điều kiện;
  nó không giữ hình bóng desktop bằng cách hy sinh những thứ đó.
- Bố cục không tự bịa dữ kiện sản phẩm, luật đủ điều kiện, giá, trạng thái hay hệ quả hành động.


## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-ND-01` | Một đối tượng cần được giải thích đáng kể trước một cam kết chính | tín hiệu dương bắt buộc |
| `AR-ND-02` | Một tập gọn dữ kiện quyết định, điều kiện hoặc cảnh báo phải luôn gắn với cam kết đó | tín hiệu dương bắt buộc; trao cho các dữ kiện ấy một decision rail ở góc nhìn đủ rộng |
| `AR-ND-03` | Phần tự sự và rail không còn có thể nằm cạnh nhau mà không làm hại việc đọc, thao tác hay tính toàn vẹn dữ kiện | chuyển rail thành vùng quyết định trong luồng ổn định |
| `AR-ND-04` | Một hành động gọn luôn hiện giúp đáng kể cho việc tiếp tục và có thể tránh nội dung, focus, UI hệ thống cùng vùng an toàn | cho phép hành động quyết định ghim dưới đáy |
| `AR-ND-90` | Vùng hỗ trợ chủ yếu liệt kê đề mục, thể hiện vị trí đọc hoặc di chuyển giữa các phần | từ chối; đó là outline rail hoặc navigation rail |
| `AR-ND-91` | Nhiệm vụ trội là so sánh các mục ngang hàng, khám phá catalog, thao tác dữ liệu hoặc hoàn thành form dài | từ chối; định tuyến sang archetype sở hữu nhiệm vụ đó |

### Chọn khi

- Có đúng một đối tượng chi tiết ở cấp trang.
- Nội dung chính có nhiều phần có ý nghĩa mà một người có thể cần trước khi cam kết.
- Một cam kết chính chiếm ưu thế, chẳng hạn sở hữu, ghi danh, ứng tuyển, đặt chỗ, chấp thuận, bắt đầu
  hoặc gia hạn; động từ và hệ quả chính xác đến từ authority sản phẩm.
- Một tóm tắt quyết định nhỏ có thể nêu các dữ kiện chi phối cam kết mà không lặp lại toàn bộ phần tự sự.
- Ở góc nhìn rộng, giữ tóm tắt đó cạnh phần tự sự làm giảm gánh nhớ hoặc việc di chuyển không cần thiết
  giữa bằng chứng và hành động.
- Đối tượng vẫn hữu ích để đọc ngay cả khi quyết định không khả dụng hoặc đã hoàn tất.

### Từ chối khi

- Vùng bên chỉ tồn tại để trang trông cân đối.
- Hành động là quảng bá không liên quan, bán chéo, quảng cáo hoặc điều hướng tới một đối tượng khác.
- Nhiều mục ngang hàng hoặc nhiều hành động chính cạnh tranh cần được so sánh đồng thời.
- Phần được gọi là tự sự chỉ là một thông báo ngắn và một control; archetype tác vụ đơn tập trung là
  hình dạng nhỏ hơn và trung thực hơn.
- Công việc đòi hỏi sửa, kiểm tra hoặc thao tác dữ liệu liên tục; workbench hoặc editor sở hữu topology đó.
- Mục đích chính của rail là điều hướng phần. `AR-ND-90` áp dụng ngay cả khi rail đó cũng chứa
  một hành động phụ.


## Đồ thị vùng

### Các vùng chuẩn

```text
detail-surface
├─ detail-header
│  ├─ subject-identity
│  ├─ concise-summary
│  └─ optional-section-navigation
└─ detail-body
   ├─ narrative-main
   │  ├─ overview
   │  ├─ evidence-or-capabilities
   │  ├─ requirements-or-conditions
   │  └─ supporting-content
   └─ decision-region
      ├─ decisive-facts
      ├─ qualification-or-warning
      ├─ primary-decision-action
      └─ policy-or-recovery
```

`optional-section-navigation` thuộc về phần tự sự, không thuộc vùng quyết định. Nó có thể vắng mặt.
Bốn phần tự sự được gọi tên biểu đạt vai trò, không phải một taxonomy nội dung bắt buộc; grammar được
định tuyến có thể đổi tên, bỏ hoặc mở rộng chúng trong khi vẫn giữ một phần tự sự chính mạch lạc.

### Quan hệ giữa các vùng

1. `subject-identity` thiết lập một đối tượng duy nhất được mọi vùng phía sau chia sẻ.
2. `concise-summary` định hướng; nó không trở thành một đoạn giới thiệu dài thứ hai.
3. `narrative-main` sở hữu bằng chứng và lời giải thích. Các phần của nó có thứ tự được biên soạn và vẫn
   hiểu được khi không có rail trực quan đứng cạnh.
4. `decisive-facts` là phép chiếu gọn của các đầu vào quyết định hiện tại. Nó có thể tóm tắt nhưng không
   được mâu thuẫn hoặc âm thầm tách nhánh dữ kiện khỏi phần tự sự hay trạng thái sản phẩm.
5. `qualification-or-warning` xuất hiện trước cam kết bất cứ khi nào nó có thể thay đổi đáng kể sự đồng
   thuận, chi phí, tính đủ điều kiện, khả dụng, rủi ro hoặc kết quả.
6. `primary-decision-action` cam kết hoặc bắt đầu một hệ quả trội. Link phụ không được cạnh tranh với nó
   về mặt trực quan hoặc ngữ nghĩa.
7. `policy-or-recovery` giải thích một điều kiện chi phối hoặc cung cấp đường đi từ quyết định không khả
   dụng hay thất bại; nó không phải một danh sách link tạp.
8. Vùng quyết định là một vùng logic xuyên suốt mọi hình dạng responsive. Rail bên cạnh, phần trong
   luồng và hành động ghim được phép đều là các cách trình bày cùng quyết định đó, không phải các nguồn
   sự thật riêng biệt.


## Hợp đồng responsive

### Rộng

- Trình bày `narrative-main` và `decision-region` thành vùng chính và vùng hỗ trợ đứng cạnh nhau chỉ khi
  phần tự sự vẫn giữ độ dài dòng dễ đọc và mọi giá trị cùng control quyết định vẫn rõ, dùng được.
- Để detail header thiết lập một đối tượng phía trên cả hai vùng. Điều hướng phần, khi có, vẫn gắn với
  phần tự sự thay vì bị nuốt vào decision rail về mặt trực quan.
- Decision rail có thể ở lại trong tầm nhìn khi trang cuộn nếu toàn bộ nội dung bắt buộc của nó vừa mà
  không bị cắt. Nếu rail cao hơn góc nhìn sẵn có, nó tham gia luồng trang thay vì sinh một vùng cuộn cùng
  trục cạnh tranh.
- Lỗi phần tự sự và quyết định được giải quyết độc lập: một dữ kiện quyết định đến chậm không thay phần
  tự sự đang đọc được bằng trạng thái chờ toàn trang, và một phần tự sự đến chậm không xóa trạng thái
  quyết định đã biết.

### Trung gian

- Chỉ giữ bố cục hai vùng khi cả hai vẫn đáp ứng nhu cầu nội dung; không bóp văn bản, bẻ giá trị quyết
  định thành mơ hồ, cắt nhãn hoặc thu nhỏ control chỉ để trì hoãn đổi topology.
- Bỏ hoặc chuyển trang trí cấp ba và vật liệu hỗ trợ tùy chọn trước khi di chuyển dữ kiện, điều kiện,
  cảnh báo hoặc control phục hồi bắt buộc.
- Khi việc đứng cạnh nhau ngừng hoạt động, áp dụng `AR-ND-03`: đặt vùng quyết định tại vị trí
  logic ổn định của nó trong luồng trang. Việc này có thể xảy ra trước một loại thiết bị quy ước vì phép
  biến đổi do nội dung dẫn dắt.
- Outline hoặc section navigator có thể độc lập biến thành disclosure hay jump control. Thay đổi đó
  không bao giờ biến nó thành vùng quyết định và không bao giờ bỏ mất đường tới các phần đã được biên
  soạn của trang.

### Gọn

- Dùng một cột trang dễ đọc. Giữ danh tính đối tượng, thứ tự tự sự đã biên soạn, dữ kiện quyết định,
  điều kiện hoặc cảnh báo quan trọng, quyết định chính và đường phục hồi.
- Phép biến đổi mặc định là `decision-region` nằm trong luồng ở vị trí logic ổn định của nó.
- `AR-ND-04` cho phép hành động quyết định chính biến thành hành động ghim dưới đáy chỉ khi
  trạng thái liên quan không mơ hồ và cách trình bày chừa hoặc nhả đủ chỗ để nội dung trang, control có
  focus, validation, UI trình duyệt hay hệ điều hành và vùng an toàn không bị che.
- Nếu quyết định cần dữ kiện hoặc đồng thuận không thể nằm có nghĩa trong hành động luôn hiện, giữ các
  dữ kiện đó trong luồng và bảo đảm hành động không thể đi vòng qua chúng. Không nén cảnh báo thành icon
  không nhãn hoặc trạng thái bị giấu.
- Không giữ một rail bên hẹp, sinh cuộn ngang cả trang hay đặt phần tự sự dài vào modal chỉ để bảo toàn
  việc đứng cạnh nhau của góc nhìn rộng.

### Reflow và tính ngang bằng

Ở chiều rộng hẹp, độ phóng đại, khoảng cách chữ tăng, bản dịch dài và nội dung phát triển, trang phải
vẫn hiểu được như một trải nghiệm đọc dọc. Văn bản và giá trị quyết định bắt buộc được bẻ dòng hoặc lớn
lên; chúng không bị cắt để giữ chiều cao surface. Phép biến đổi do việc nội dung còn hoạt động hay không
dẫn dắt, không do tên thiết bị cố định hay breakpoint cố định ghi trong archetype này.

#### Thứ tự đọc

Dùng một thứ tự logic có nghĩa xuyên suốt mọi chiều rộng: danh tính đối tượng, tóm tắt ngắn, các phần tự
sự theo thứ tự biên soạn, dữ kiện quyết định, điều kiện hoặc cảnh báo quan trọng, quyết định chính, rồi
chính sách hoặc phục hồi. Nếu bằng chứng sản phẩm đòi vùng quyết định sớm hơn, đặt nó sớm hơn trong thứ
tự logic đó ở **mọi** chiều rộng; không dùng sắp xếp lại cột trực quan để làm thứ tự đọc bằng bàn phím
hay công nghệ trợ giúp thay đổi tại một breakpoint. Heading hoặc landmark phải khiến cả phần tự sự lẫn
quyết định được điều hướng trực tiếp khi trang dài.

#### Thay thế điều hướng

Khi outline hoặc section navigator tùy chọn không thể tiếp tục đứng cạnh, thay nó bằng jump list trong
luồng có thể thao tác, disclosure hoặc đường tương đương tới cùng các phần. Bản thân decision rail không
được thay bằng điều hướng: nó trở thành vùng quyết định trong luồng, còn hành động ghim được cho phép
riêng chỉ là một cách trình bày hành động chính của vùng đó.

#### Hành vi ghim

Tính luôn hiện là tùy chọn, không bao giờ là danh tính của archetype. Rail ghim trở thành tĩnh khi nội
dung của nó không vừa, khi zoom hoặc chữ lớn làm giảm góc nhìn dùng được, hoặc khi nó sẽ che nội dung
hay focus. Hành động ghim dưới đáy phải tính phần diện tích nó chiếm, có thể được đóng hoặc trở thành
tĩnh khi cần, và không bao giờ che đích của điều hướng bằng bàn phím, switch, giọng nói, validation hay
anchor. Không giữ một hành động chính cạnh tranh thứ hai chỉ vì một cách trình bày được ghim.

#### Chủ sở hữu overflow

Mặc định trang sở hữu overflow dọc. Phần tự sự và vùng quyết định không tạo cuộn lồng cùng trục chỉ để
tiếp tục đứng cạnh nhau hoặc nằm trong card. Một disclosure có biên có thể tạm sở hữu overflow chỉ khi
mô hình tương tác và nơi trả focus của nó rõ ràng; mặc định nó không được chứa phần tự sự dài thiết yếu.
Media hai chiều ngoại lệ giữ cách xử lý phù hợp riêng mà không làm cả trang cuộn ngang.

#### Tính ngang bằng tương tác

Cách trình bày rộng, trung gian, gọn, được zoom, bằng bàn phím và bằng công nghệ trợ giúp đều phơi cùng
hệ quả quyết định, trạng thái hiện tại, dữ kiện quyết định, điều kiện hoặc cảnh báo quan trọng, đường
chính sách hay phục hồi, phản hồi đang chờ và kết quả thành công hay thất bại. Cách trình bày có thể đổi;
khả năng và ý nghĩa thì không. Focus trở về nơi dự đoán được sau disclosure và chỉ chuyển tới phản hồi
lỗi hay thành công có thể hành động khi việc đó giúp tiếp tục.


## Nghĩa vụ trạng thái

### Trạng thái nội dung và dữ kiện

- `content-loading`: giữ anatomy trang đã biết và nhận diện vùng tự sự nào đang chờ.
- `content-partial`: giữ các phần sẵn có đọc được và nhận diện bằng chứng thiếu hay trễ mà không trình
  bày trang như đã hoàn chỉnh.
- `content-ready`: hiển thị một phiên bản đối tượng nhất quán nội bộ.
- `content-empty`: giải thích vì sao nội dung đối tượng dự kiến vắng mặt và cung cấp bước tiếp theo có
  bằng chứng khi nó tồn tại.
- `content-failed`: giữ ngữ cảnh đối tượng và cho retry, quay lại hay hỗ trợ theo authority sản phẩm.
- `content-stale`: nhận diện dữ kiện quyết định có thể không còn khớp trạng thái mới nhất trước cam kết.
- `decision-facts-loading`, `decision-facts-ready`, `decision-facts-failed` và
  `decision-facts-stale`: giải quyết độc lập với khả dụng phần tự sự; dữ kiện bắt buộc chưa biết không
  bao giờ giả làm bằng không, miễn phí, sẵn có hay đủ điều kiện.

### Trạng thái quyết định

- `decision-available`: hệ quả và dữ kiện quyết định hiện tại đã biết, và hành động có thể được gọi tên
  chính xác.
- `decision-unavailable`: nêu lý do và chỉ phơi các đường phục hồi hay thay thế hợp lệ.
- `decision-requires-prerequisite`: nhận diện điều kiện chưa đạt trước hành động và giữ đường quay về
  sau khi đáp ứng nó.
- `decision-already-completed`: thay hành động cam kết lỗi thời bằng sự tiếp tục hoặc trạng thái trung
  thực; không mời gây lại cùng hệ quả.
- `decision-pending`: ngăn cam kết trùng do vô tình, giữ ý nghĩa nhãn hành động và hiển thị tiến độ
  trong vùng quyết định.
- `decision-succeeded`: xác nhận kết quả và cung cấp đích đến có nghĩa tiếp theo hoặc trạng thái hoàn
  thành ổn định.
- `decision-failed`: giữ ngữ cảnh đã nhập hay chọn khi an toàn, giải thích điều đã xảy ra tại hành động
  và phơi đường retry hoặc phục hồi hợp lệ.
- `decision-changed`: khi dữ kiện quan trọng đổi trước cam kết, yêu cầu người dùng bắt gặp và thừa nhận
  dữ kiện hiện tại thay vì âm thầm gửi hiểu biết trước đó.

### Thất bại và phục hồi

- Lỗi vùng quyết định không xóa nội dung tự sự đang đọc được.
- Lỗi một phần tự sự không giả đánh dấu quyết định là không khả dụng trừ khi luật sản phẩm thực sự biến
  bằng chứng thiếu thành điều kiện tiên quyết.
- Phản hồi và lỗi hành động xuất hiện cùng hành động logic, kể cả khi cách trình bày gọn của nó được
  ghim; trạng thái không được phân kỳ giữa các cách trình bày responsive.
- Trạng thái điều kiện và cảnh báo bắt buộc dùng nhiều hơn màu và vẫn sẵn có cho công nghệ trợ giúp.
- Phục hồi giữ định hướng tới cùng đối tượng. Retry không được bất ngờ khởi động lại toàn trang hoặc
  lặp một cam kết đã hoàn tất.


## Ranh giới

### Decision rail so với outline rail hoặc navigation rail

Decision rail trả lời: **Dữ kiện nào chi phối quyết định của tôi, điều gì xảy ra nếu tôi hành động, và
tôi có thể hành động ngay không?** Outline rail hoặc navigation rail trả lời: **Tôi đang ở đâu trong nội
dung này, và tôi có thể mở phần nào?**

Sự khác biệt là ngữ nghĩa, không phải hình học:

- Một vùng đầy section link, tiến độ chương hay trạng thái heading hiện tại là điều hướng ngay cả khi
  nó nằm bên phải.
- Một vùng chứa dữ kiện quyết định, cảnh báo quan trọng, một cam kết chính và phục hồi của nó là vùng
  quyết định ngay cả sau khi nó đi vào luồng trang.
- Nếu cần cả hai, giữ chúng thành hai trách nhiệm có tên với phép biến đổi responsive độc lập. Không để
  một rail mơ hồ sở hữu cả điều hướng trang dài lẫn cam kết.
- Nếu điều hướng chiếm ưu thế, `AR-ND-90` từ chối archetype này để dùng reader-with-outline hoặc
  archetype chi tiết dẫn bởi điều hướng tương đương.

### Các archetype liền kề

| Nhu cầu trội | Phán quyết ranh giới |
|---|---|
| Duyệt hoặc lọc nhiều đối tượng ngang hàng | dùng archetype searchable catalogue hoặc collection |
| So sánh thuộc tính quyết định giữa nhiều mục ngang hàng | dùng archetype comparison |
| Chọn một mục từ danh sách trong khi xem chi tiết của nó | dùng archetype list-detail |
| Đọc nội dung dài trong khi điều hướng outline, không có cam kết chính | dùng archetype reader-with-outline |
| Hoàn thành một hành động ngắn với ít nội dung hỗ trợ | dùng archetype centered single-task |
| Nhập một khối thông tin dài hoặc theo giai đoạn | dùng archetype form hoặc workflow |
| Thao tác dữ liệu liên tục trong khi kiểm tra thông tin hỗ trợ | dùng archetype workbench hoặc analytical workspace |
| Đọc một đối tượng và đưa ra một cam kết chính có bằng chứng | dùng `narrative-detail-with-decision-rail` |

Không tạo rail khi cùng kết quả trung thực đó rõ hơn dưới dạng phần quyết định ngắn trong luồng.
Archetype gọi tên một quan hệ xứng đáng có rail ở góc nhìn rộng, không phải yêu cầu mọi trang chi tiết
phải mọc cột thứ hai.

### Phán quyết ranh giới

Chỉ trả `accept` khi có bằng chứng cho cả `AR-ND-01` và `AR-ND-02` đồng thời không có mã từ chối nào.
Trả `reject` khi có bằng chứng cho `AR-ND-90` hoặc `AR-ND-91`, hoặc một archetype khác rõ ràng sở hữu
nhiệm vụ trội. Trả `needs-evidence` khi một đối tượng duy nhất, hệ quả chính, dữ kiện quyết định, mục
đích rail, vị trí đọc logic hoặc phép biến đổi responsive chưa được phân giải và có thể làm thay đổi
đáng kể topology hay hợp đồng trạng thái.


## Bàn giao

### Grammar

Grammar sản phẩm được chọn cung cấp danh tính đối tượng thật; ý nghĩa phần tự sự; dữ kiện quyết định;
ngữ nghĩa về tính đủ điều kiện, khả dụng, quyền sở hữu và điều kiện tiên quyết; động từ cùng hệ quả hành
động; nghĩa vụ cảnh báo và chính sách; chuyển trạng thái; cùng các owner ngữ nghĩa được phép render
chúng. Grammar cũng quyết định vị trí logic sớm hay muộn của quyết định có được chứng minh cho sản phẩm
hay không. Archetype này không được suy ra các dữ kiện ấy từ ví dụ thương mại, học tập, media hay ứng
tuyển quen thuộc.

### Principles

Principles giải tình huống đã chấp nhận thành độ dài dòng, tỷ lệ vùng, căn chỉnh, khoảng cách, cách xử lý
surface, typography, ngưỡng responsive, offset ghim, xử lý vùng an toàn, chừa focus và motion chính xác.
Chúng chỉ được chọn giá trị cài đặt sau khi đã biết áp lực nội dung và hệ thống được định tuyến. Không
class name, token, component, chiều rộng cố định hay breakpoint cố định nào thuộc archetype này.

### Điều archetype này sở hữu

Archetype này sở hữu nhiệm vụ trội, vai trò vùng chuẩn, quan hệ giữa phần tự sự và quyết định, phép biến
đổi từ rộng sang trong luồng, invariant về thứ tự đọc và overflow, ranh giới cho phép ghim, tính ngang
bằng tương tác, các họ trạng thái bắt buộc và ranh giới từ chối. Nó trả về topology cùng nghĩa vụ của
topology. Nó không trả về visual direction, hành vi sản phẩm, tệp nguồn, import hay giá trị layout đã
compile.


## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Các nguồn dưới đây là bằng chứng đối chiếu mang tính tư vấn. Chúng củng cố hoặc thách thức hình dạng dùng
chung; chúng không định nghĩa dữ kiện sản phẩm, chọn grammar owner, chọn component hay ghi đè authority
của Source này. Thuật ngữ nguồn không được chép vào hợp đồng runtime trừ khi archetype độc lập phát biểu
cùng một quan hệ trung lập với sản phẩm.

### Nguồn

| Nguồn | Quan sát liên quan | Ảnh hưởng lên archetype này |
|---|---|---|
| [Material Design 3 — Canonical layout examples](https://m3.material.io/foundations/layout/canonical-examples/overview) | Bố cục supporting pane tách một vùng chính chiếm ưu thế khỏi vùng hỗ trợ và có cấu hình cho các điều kiện compact, medium và expanded. | Củng cố quan hệ vùng chính/hỗ trợ và nghĩa vụ biến đổi theo không gian sẵn có; nó không xác lập rằng một supporting pane là decision rail. |
| [Apple Human Interface Guidelines — Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Các pane đứng cạnh cần không gian ngang; môi trường compact nên tránh split khó đọc hay khó dùng, và pane bị ẩn cần đường quay lại logic. | Củng cố việc co theo nội dung và giữ khả năng truy cập khi một vùng đứng cạnh không còn khả thi. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Nội dung hẹp hoặc được phóng đại thường reflow dọc; nội dung bên ghim nên trở thành tĩnh hoặc cho người dùng bật/tắt khi nó cản việc đọc. | Củng cố reflow một cột, overflow do trang sở hữu và nhả tính luôn hiện dưới áp lực nội dung. |
| [W3C WAI — Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Nội dung ghim do tác giả tạo không được che hoàn toàn component đang nhận focus bàn phím. | Thiết lập ranh giới tối thiểu cho rail ghim hay hành động đáy gọn; archetype này ưu tiên kết quả mạnh hơn là không che focus hoặc nội dung thiết yếu. |
| [Carbon Design System — 2x Grid usage](https://carbondesignsystem.com/elements/2x-grid/usage/) | Side panel làm thay đổi không gian dành cho grid chính và hữu ích khi người dùng phải giữ ngữ cảnh trang trong lúc làm tác vụ liên quan. | Củng cố việc kiểm tra nội dung chính dưới áp lực thật của rail thay vì coi rail là overlay không gây hệ quả. |
| Các tìm kiếm `responsive supporting pane reflow` và `focus not obscured sticky action` trong `ux-guidelines.csv` cục bộ của UI/UX Pro Max | Trả về hướng dẫn ưu tiên text reflow, tránh cuộn ngang cả trang và khả năng thấy focus quanh UI luôn hiện. | Đối chứng nghĩa vụ reflow và sticky-focus; nó vẫn là dữ liệu tư vấn cục bộ, không phải luật sản phẩm hay kho mã. |


## Đầu ra

Trả về một bản ghi archetype đã giải bằng đúng các trường sau:

```json
{
  "archetypeId": "narrative-detail-with-decision-rail",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "",
    "intermediate": "",
    "compact": "",
    "reflow": "",
    "readingOrder": "",
    "navigationReplacement": "",
    "stickyBehavior": "",
    "overflowOwner": "",
    "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```

Không trả về class, token, tên component, đường dẫn nguồn, breakpoint cố định hay dữ kiện sản phẩm tự
bịa. Phán quyết `accept` chỉ hợp lệ khi `AR-ND-01` và `AR-ND-02` áp dụng đồng thời cả `AR-ND-90` lẫn
`AR-ND-91` đều không có mặt. Hành động gọn ghim chỉ hợp lệ khi `AR-ND-04` mang
bằng chứng rõ rằng nội dung và focus không bị che.
