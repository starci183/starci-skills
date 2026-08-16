# hợp đồng

## Định nghĩa

Hợp đồng là mô tả của MỘT nút. Nó là một chiếc chìa khóa, và chiếc chìa khóa đó sở hữu ba thứ
ngoài giá trị vô giá trị: các lớp mà nút mặc, phần tử nó mở và lý do nó giữ vị trí
theo cách đó. Một tác giả cần một hình dạng sẽ gõ phím. Đó là toàn bộ quyết định bố trí có.

Mọi thứ phía trên những chiếc lá đều tạo nên các phím. Một nhánh biểu hiện một, một tập hợp sắp xếp nhiều, một
khối yêu cầu một cái, một trang sẽ yêu cầu chúng - và không ai trong số chúng viết một chuỗi lớp, bởi vì
thời điểm người gọi có thể gõ`flex gap-3`, cây được quyết định ở bao nhiêu nơi cũng có gọi là site
và không có gì ở trên có thể được dự đoán từ chìa khóa nữa.

Câu hỏi giải quyết vấn đề đó: **phần tử này có chứa các phần tử khác không?** Nếu có, nó là một nút,
và một nút đến từ một khóa. Một tập tin mở một`div`đã trả lời một câu hỏi bảng hợp đồng
lẽ ra phải trả lời.

Điều giữ luật này là[`sources/contract.mjs`](../../../sources/fe/contract.mjs)và hơn thế nữa
quan trọng là hai công đoàn khép kín ở[`sources/contracts.ts`](../../../sources/fe/contracts.ts). các
các công đoàn quan trọng hơn các quy tắc: một lớp hoặc một thành phần không phải là thành viên không bị cấm, nó
là không thể trình bày được và không có gì cần cảnh sát xử lý khi không thể nhập sai giá trị.

Implementation anchors in `starci-academy-fe`: `src/components/contracts/index.ts` and `src/components/branches/Tree/index.tsx`.

## Quy tắc

**CONTRACT-1 · Node cấu trúc lấy class từ key, không bao giờ từ literal.** `flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `col-*`, họ position — những thứ này quyết định
hình dạng của một cái cây chứ không phải là hình thức của một giá trị và hình dạng được quyết định tại vị trí cuộc gọi là hình dạng
không ai có thể tìm thấy từ bất cứ nơi nào khác. Điều quan trọng là cách viết duy nhất. Đây là quy tắc những quy tắc khác tồn tại
để bảo vệ, và mỗi người trong số họ đóng một cánh cửa mà lẽ ra ai đó sẽ bước qua trong khi tin tưởng
họ đã tuân theo nó.

**CONTRACT-2 · Chuỗi lớp không bao giờ được tập hợp trong thời gian chạy.**`cn(base, isActive && "gap-4")`là cùng một cửa thoát hiểm mang lệnh gọi hàm: bảng thứ hai
không có chìa khóa, không có lý do và không có gì mà bất cứ ai cũng có thể đọc lại được. Nội suy lại là điều tương tự -
một chuỗi chỉ tồn tại trong khi thành phần chạy không thể được kiểm tra, tìm kiếm hoặc tranh luận.
Bất cứ điều gì chi nhánh đang thử nghiệm đều là một sự khác biệt thực sự và một sự khác biệt thực sự sẽ mang lại một chìa khóa hoặc một danh hiệu được đặt tên.
chống đỡ.

**CONTRACT-3 · Vocabulary của class là một closed union.**

Các lớp mà một nút có thể sắp xếp cho các con của nó là loại kết hợp, không phải là quy ước.`gap-[13px]`không thất bại trong việc xem xét; nó không biên dịch được. Đây là điều tạo nên cả một hệ thống các quy tắc tuần tra
không cần thiết và đó là lý do tại sao giá trị khoảng cách mới là sự chỉnh sửa có chủ ý đối với danh sách được đặt tên thay vì
một cái gì đó đến bên trong một khác biệt không ai đọc kỹ.

**CONTRACT-4 · Element thuộc về entry, không bao giờ thuộc về caller.**

Một nút không phải lúc nào cũng là một`div`. Một chuỗi ngày LÀ một danh sách; một trường có biểu mẫu gửi IS; một phần tử
được chọn vì ý nghĩa không thể đổi lấy ý nghĩa trung lập mà không thay đổi công nghệ hỗ trợ nào
báo cáo. Vì vậy, mục này đặt tên cho máy chủ của chính nó, từ một liên minh đóng và không có chỗ dựa máy chủ nào cho một
người gọi chuyển - hai trang gọi của một khóa không đồng ý về phần tử sẽ là hai trang khác nhau
các nút mang một tên.

Quy tắc này mang tính chịu tải vì một lý do không rõ ràng. Trước khi nó tồn tại, khung chỉ được vẽ`div`, vì vậy bất kỳ hình dạng nào cần thiết`<ul>`**không có nơi nào hợp pháp để sống** và nằm giữa những chiếc lá
thay vào đó, nơi nó có thể viết các lớp riêng của mình. Đó là cách toàn bộ tầng được lấp đầy
sắp xếp. Một vật chủ bị thiếu không phải là một khoảng cách nhỏ; đó là cái lỗ mà từ vựng chảy vào.

Cách nó thực sự bị hỏng không phải là một`host`chống đỡ; không ai thêm một. Đó là một cành cây mang một
nút của mục nhập trên phần tử nhà cung cấp của chính nó.`contractNodeProps(contract)`trao lại lớp học
và các điểm đánh dấu chứ KHÔNG phải phần tử, vì vậy hãy trải chúng lên`Card.Content`, một thân đàn accordion hoặc một
hộp viết tay xóa máy chủ mục nhập được đặt tên trong khi mọi dấu hiệu có thể nhìn thấy của hợp đồng vẫn còn
chính xác nơi người đọc mong đợi nó. Mục nhập nói`ol`và tài liệu được`div`: danh sách rời đi
cây khả năng truy cập, không có gì thông báo có bao nhiêu mục và khóa vẫn được phân giải,
các điểm đánh dấu vẫn đọc chính xác và mọi cổng vẫn có màu xanh. Đó là sự thất bại không có màu đỏ ở bất cứ đâu. Vì vậy
một nhánh bề mặt hiển thị nút riêng của mục nhập BÊN TRONG phần thân nhà cung cấp của nó chứ không phải trên đó và
khung vẫn là thứ duy nhất từng được đeo.

**CONTRACT-5 · NAME của key quyết định nội dung bên trong nó.** `card` không phải là một tên có ý nghĩa. Nó không nói key chứa gì, nên bất kỳ thứ gì cũng có thể được truyền vào, và entry đó
ngừng ràng buộc bất cứ điều gì - và thành viên chung của một gia đình luôn giành được các địa điểm cuộc gọi từ chính nó
anh chị em cụ thể, vì đó là người không ai phải nghĩ tới.`label-figure-over-bar`nói gì
nó giữ nguyên, vì vậy có thể nhìn thấy một đứa trẻ sai trái.

Cái tên cũng là thứ giữ cho lý do trở nên trung thực. Một phím vẽ hai mươi vùng không thể nói tại sao một vùng nào đó
trong số họ ở đó; lý do một tiêu đề và một sự kiện có chung một đường cơ sở là CÙNG một lý do ở cả hai mươi.

Đối với một nút đơn giản, tên là thứ duy nhất chứa hợp đồng con, bởi vì nội dung
từ một người gọi và có thể là bất cứ điều gì. **Nó không còn là thứ DUY NHẤT ở mọi nơi** — một phím ghép
khai báo mọi vị trí bên trong nó và trình biên dịch sẽ kiểm tra từng vị trí, xem CONTRACT-11.

Sự đảo ngược đó được ghi lại chứ không phải im lặng. Bản đồ con đã bị loại bỏ vì không thể
được kiểm tra khi nội dung đến dưới dạng đánh dấu: a`.map`, một cây ba ngôi và một cây con không tên đều trông giống như
giống nhau theo một quy luật. Nội dung bây giờ đến dưới dạng THÀNH PHẦN, một nội dung cho mỗi vị trí được đặt tên, vì vậy việc kiểm tra không phải là quy tắc tại
tất cả - đó là loại. Quyết định cũ đúng với hình dạng nó được tạo ra và sai đối với hình dạng này.

**CONTRACT-6 · Mỗi entry nêu vì sao node tồn tại, và lý do đó không lặp lại key.**

Lý do là điều mà không ai có thể xây dựng lại từ đánh dấu sau này. Nó đặt tên cho những gì bị phá vỡ,
quấn, tràn hoặc không thể nhấn được khi nút bị loại bỏ. "Một hàng chip" bật`content-row`tốn một dòng và không dạy gì cả; "các thẻ nằm trên dòng riêng của chúng trước khi tiêu đề" là
thực tế đã làm cho nút tồn tại.

**CONTRACT-7 · Một khung biến một khóa thành một phần tử.**

Một mục trở thành đánh dấu thực sự trong chính xác một tệp. Ở mọi nơi khác, một ô TRUNG LẬP được viết bằng tay - một`div`, Một`section`, Một`nav`— là một nút không có khóa: không có gì ghi lại những lớp mà nó phải mang,
đứa trẻ nào thuộc về bên trong nó, hoặc tại sao nó lại ở đó. Nếu không có phím nào phù hợp với hình dạng đang được xây dựng, đó là
phát hiện - không phải là lý do để mở một`div`.

**Yếu tố ngữ nghĩa là khác nhau và sự khác biệt không phải là kẽ hở.** A`form`tồn tại để
nộp; Một`ul`tồn tại vì nội dung của nó là một danh sách. Công nghệ hỗ trợ báo cáo phần tử, vì vậy
nó không thể được hoán đổi cho một hộp trung tính và việc mở một hộp xung quanh nút hợp đồng sẽ quyết định không có hình dạng nào tại
tất cả. Thứ vẫn phải đến từ một mục là HÌNH DẠNG: thời điểm một phần tử ngữ nghĩa mang một lớp,
nó đã ngừng đóng vai trò là một trình bao bọc và trở thành một nút không có khóa và mục nhập thay thế nó có tên
phần tử làm máy chủ của nó.

**CONTRACT-8 · Marker được vẽ từ entry, không bao giờ viết bằng tay.**

Khung phát ra các thuộc tính xác định một nút từ mục mà nó đang hiển thị. Viết bằng tay
họ tuyên bố rằng một hợp đồng không có gì thực thi, và mọi người đọc cũng như mọi bài kiểm tra thực hiện các thuộc tính đó
sau đó tin tưởng một yêu cầu không có quy tắc nào được giữ. Điều đó còn tệ hơn một nút không được đánh dấu, bởi vì một nút không được đánh dấu
nút ít nhất là trung thực.

**CONTRACT-9 · Key mới phải được biện minh bằng shape, không phải bằng một khoảng cách khác.**

Một hình dạng mà không có khóa nào hiện có có thể biểu thị sẽ kiếm được khóa. Muốn hình dạng tương tự chặt chẽ hơn một chút
không: đó là từ vựng được mở rộng từng trang gọi một, cho đến khi các phím mô tả cuộc gọi
trang web thay vì hình dạng và danh sách dài hơn mã đọc nó.

**CONTRACT-10 · Contract cố định content; branch sở hữu wrapper mechanics.**

Hợp đồng mô tả nút sắp xếp nội dung được xác thực. Nó không mô tả nhà cung cấp
thành phần.`Tree`có thể mở máy chủ tên mục;`SurfaceCard`có thể đứng cùng một nút bên trong`Card.Content`ở trong`div > Card > Card.Content`; một bề mặt xếp hoặc danh sách có thể chiếu nó vào
một cái bọc khác. Những trình bao bọc đó là cơ chế chi nhánh, không phải là từ vựng hợp đồng thứ hai.

Nhánh bề mặt được đặt tên sở hữu đường nối bên ngoài cố định như mã nhánh thông thường. Đường may đó không phải là
ngữ pháp nội dung thứ hai: nó không thể thay đổi tùy theo người gọi, nó không thể thừa nhận trẻ em và nó không bao giờ nhận được
dấu hợp đồng. Nút hợp đồng đứng BÊN TRONG máy chủ nội dung (`Card.Content`, thân đàn accordion,
thân danh sách) và không bao giờ có trên đó, bởi vì các đạo cụ nút không mang phần tử nào và việc đeo chúng sẽ dẫn đến
máy chủ của mục nhập cho nhà cung cấp. Một nơi lưu trữ bị ràng buộc`ContractContent`ở đó; bề mặt điều khiển dữ liệu
đặt thành phần có thương hiệu ở đó và chuyển thông thường của nó`props`, `on`, Và`isLoading`. Tạo
phím cho dòng tiêu đề, phần bao bọc bên ngoài và chú thích đơn thuần để tránh viết nhánh sẽ biến
một máy chủ thành ba hợp đồng.

Đây là lý do tại sao không có`CardShell`và không có bảng ghép. Lặp đi lặp lại`Card > Card.Content`chỉ là
hai dòng; việc giải nén nó sẽ thêm tính gián tiếp mà không cần sở hữu chính sách.`SurfaceCard`,
`SurfaceAccordionCard`, `SurfaceListCard`, Và`SurfaceFormCard`được đặt tên là các nhánh vì mỗi nhánh sở hữu một trình bao bọc riêng biệt
và vẫn chấp nhận`contract + render`cho nút nội dung.

**CONTRACT-11 · Entry khai báo mọi slot bên trong nó, và mỗi slot có một tên.** `children` là một record. Mỗi key là tên slot; mỗi value nêu một hoặc nhiều identity đóng:

| đứa trẻ là | khe nói | thành phần khai báo |
|---|---|---|
| nút khác |`{ contract: "key" }` | `ContractComponent<"key">`|
| một chiếc lá |`{ leaf: "icon", props: { size: "sm" } }` | `LeafComponent<"icon", { size: "sm" }>`|

Một nút con đặt tên cho một khóa và khóa đó được kiểm tra trên bảng. Một chiếc lá không thể - một chiếc lá không phải là một
nút và không có khóa - do đó, slot đặt tên cho lá và các đạo cụ mà nó phải lấy và lá đó khai báo
cùng một cặp trên siêu dữ liệu của chính nó. Bảng không bao giờ nhập một thành phần và trình biên dịch vẫn giữ
sự ghép đôi.

**Các vị trí được đặt tên, không bao giờ được tính.** Chèn trẻ vào danh sách vị trí và mọi vị trí sau đó
nó âm thầm có nghĩa là cái gì đó khác; một tên vẫn tồn tại sau khi chèn, đọc tại trang cuộc gọi mà không cần
đếm và đưa ra lý do để tham khảo.

**`repeats: true`cho biết vị trí trực tiếp là một mảng;`restingCount: 6`cho biết có bao nhiêu phần giữ chỗ vẽ
trong khi chờ đợi.** Độ dài trực tiếp là động nên không được nhầm lẫn với số lượng bộ xương. các
cặp được yêu cầu cùng nhau: không`restingCount`trên một khe vô hướng và không có khe lặp lại nào có
hình dạng nghỉ ngơi không xác định.

Các giá trị trong`props`là những ràng buộc theo nghĩa đen, không bao giờ có giá trị được đưa vào khi chạy. Một khai báo vị trí`props: { size: "sm" }`chấp nhận một thành phần lá được gắn nhãn hiệu với ràng buộc chính xác đó; sao chép chẳng hạn như một
nhãn do truy vấn cung cấp di chuyển trong thời gian chạy của thành phần kết xuất`props`và không bao giờ đi vào
cái bàn.

Đối với danh sách đã nối, mối quan hệ giữa các hàng ngang hàng thuộc về hợp đồng gốc.`divide-y`ngồi trên
máy chủ nội dung; một lá hàng không vẽ được một`after`cai trị hoặc kiểm tra`last-child`. Bộ sưu tập của
tên miền (`tasks`, `courses`, `alerts`) vẫn là một trường có tên props của thành phần nội dung
loại. Một cái chung`items`khe sẽ dạy bề mặt mô hình dữ liệu của người gọi và không phải là một phần của
từ vựng nhánh.

Danh sách gốc đã tham gia đó là`p-0`, với các hàng lặp lại là con trực tiếp, do đó mọi dấu chia đều đạt đến cả hai
các cạnh bề mặt. Hợp đồng hàng khôi phục thông thường của Thẻ`p-4`cạnh không đối xứng: một hàng`p-4`; Đầu tiên`px-4 pt-4 pb-3`; ở giữa`px-4 py-3`; cuối cùng`px-4 pt-3 pb-4`. cố định
Tập hợp nhãn/bề mặt/chú thích chứa các đơn vị và mục đích sử dụng của chủ sở hữu`gap-3`.

Máy chủ danh sách cũng sở hữu thông tin tùy chọn ở cuối dòng nhãn của nó. Sự thật đó là`xs muted`bên cạnh một`sm semibold`nhãn và đủ điều kiện cho danh sách đã tham gia. Nó không được chiếu như một
tách biệt anh chị em bởi người gọi và không được đưa vào`description`: mô tả được bảo lưu
cho chú thích toàn bộ danh sách bên dưới bề mặt.

Không ai trong số này là`children`theo nghĩa React, và đó là điều khiến nó có thể kiểm tra được. Đánh dấu đến
đã được xây dựng và xóa hình dạng của nó.`ContractSlots<K>`mang một bản ghi ràng buộc được kiểm tra và không
có thể gọi được.`ContractProjection<K>`mang một sự rõ ràng`project`hoạt động cho một chi nhánh đã
đã vẽ cái bọc của nó.`ContractComponent<K,P>`là làn đường thứ ba: một làn đường thực sự`ComponentType<P>`mang nhãn hiệu với
khóa chính xác, được sử dụng khi dữ liệu thời gian chạy phải được giữ nguyên`props`thay vì bị đóng cửa vào một cái mới
mô tả trên mỗi kết xuất. Sai key, props, Identity, cardinality, thiếu slot và thừa slot
là các lỗi biên dịch.

**CONTRACT-12 · Class của entry là ARRANGEMENT, không bao giờ là behavior hay paint.** `flex`, `grid`, `gap-*`, `items-*`, `justify-*`, nhóm width và inset: những thứ này nói cách
các nút con của một nút đứng cùng nhau, đó là mục đích của một mục nhập. Một con trỏ, di chuột hoặc hoạt động
trạng thái, màu văn bản, căn chỉnh văn bản,`group`: những điều này cho biết một vật sẽ PHẢN ỨNG như thế nào và nó trông như thế nào
thích, và cũng không phải là mối quan hệ giữa trẻ em.

Sự khác biệt không phải là sự ngăn nắp về mặt phong cách. Một nút có mục nhập mang`cursor-pointer`Và`hover:opacity-80`đang tuyên bố là có thể nhấn được, trong khi thứ thực sự được nhấn - nút,
liên kết, điều khiển sở hữu trình xử lý và trạng thái bị vô hiệu hóa - hoàn toàn ở một nơi khác. Hai
chủ sở hữu cho một lời hứa, và cái bàn là cái không thể nói được lời hứa đã tắt: một mục
không thể biết rằng trang cuộc gọi này đã không được xử lý, vì vậy nó tiếp tục vẽ con trỏ lên thứ gì đó
điều đó không có tác dụng gì

Vì vậy hành vi thuộc về thành phần sở hữu hành vi đó. Mục tiêu báo chí là một nhánh được đặt tên
rút ra điều khiển của riêng nó và đặt nút được sắp xếp bên trong nó; lối vào bên trong vẫn trong sáng
sắp xếp và có thể được sử dụng lại bởi một hàng được nhấn và một hàng không được nhấn.

Lớp sơn cũng tuân theo phán quyết tương tự, và nó có một hệ quả đáng nói thẳng: **một bề mặt là một
THÀNH PHẦN, không phải là danh sách lớp.** Các nhánh bề mặt được đặt tên sẽ vẽ mặt đất, bán kính và
độ cao, vì vậy một mục sơn`bg-surface`, `rounded-2xl`hoặc`shadow-surface`là cách thứ hai để
làm một vật đã có chủ. Những chi phí đó được trả bởi mỗi người đọc bảng sau này:
sau đó nó chứa hai loại thẻ - một loại rút nhánh, một loại rút chìa khóa - và không có chìa khóa nào cho ai biết
họ đang xem loại nào. Tác giả tiếp theo sẽ tìm đến nơi nào gần hơn và ngày đó
bề mặt ngôi nhà thay đổi bán kính hoặc độ cao, chỉ một trong hai loại di chuyển.

**CONTRACT-13 · Key không được render không phải vocabulary.**

Một mục nhập là một lời hứa về một nút tồn tại - những lớp này, phần tử này, lý do này, trạng thái
trong tài liệu - vì vậy, một khóa không có người dùng là một lời hứa không có gì và một lời hứa không có gì
không ngồi yên. Nó tồn tại sau mỗi lần đổi tên, bởi vì việc đổi tên tuân theo các trang gọi và nó không có. Nó
được sao chép vào kho lưu trữ tiếp theo, vì bảng sẽ di chuyển toàn bộ và không có gì trong đó cho biết bảng nào
các thành viên đã từng được rút ra. Và nó làm cho bảng dài hơn đoạn mã đọc nó, đó là cách một
Người đọc không còn tin tưởng vào bảng mô tả sản phẩm nữa: một khi một số phím mô tả màn hình và
những người khác mô tả ý định, phân biệt chúng có nghĩa là tìm kiếm nguồn và từ vựng có
được tìm kiếm trước khi có thể tin được không phải là một trong những loại từ ai.

Vì vậy hãy xóa nó đi. Chìa khóa được lưu giữ cho công việc chưa bắt đầu thuộc về bản ghi kế hoạch, trong đó một bản ghi chưa được xây dựng
hình dạng chính xác là những gì người đọc mong đợi tìm thấy chứ không phải trong từ vựng, nơi mọi thứ đều hiện diện.
được đưa lên màn hình.

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Một lớp tương tác hoặc sơn trong một mục (`cursor-*`, `hover:*`, `active:*`, `focus:*`, `group`, `text-left`, màu văn bản) | Nút xác nhận một hành vi mà nó không sở hữu và không thể thông báo cho bảng khi hành vi đó không có | Cung cấp hành vi cho nhánh sở hữu quyền kiểm soát và để lại mục sắp xếp |
| Một nhánh hiển thị khóa của người khác trên máy chủ do chính nó chọn | Hai site gọi một key thì bất đồng về phần tử là CONTRACT-4 mang tên người giúp việc | Vẽ điều khiển của riêng bạn và đặt nút riêng của khóa bên trong nó |
|`contractNodeProps(contract)`lây lan sang một yếu tố nhà cung cấp | Các đạo cụ mang các lớp và các điểm đánh dấu chứ không phải phần tử, vì vậy một mục có nội dung`ol`tiếp cận tài liệu dưới dạng`div`và danh sách để lại cây tiếp cận với mọi cổng vẫn còn xanh | Hiển thị nút riêng của mục nhập bên trong phần thân nhà cung cấp; chỉ có khung đeo máy chủ |
| Một lớp cấu trúc theo nghĩa đen (`flex`, `gap-4`, `items-center`) bên ngoài bảng hoặc máy chủ bề mặt có tên | Hình dạng của nút được quyết định tại một trang web cuộc gọi, nơi không có gì ở trên nó có thể tìm thấy hoặc dự đoán nó | Thêm hoặc sử dụng lại khóa; cơ chế bao bọc nhà cung cấp cố định chỉ thuộc về nhánh bề mặt được đặt tên của họ |
|`cn`, `clsx`, `twMerge`, `cva`hoặc bất kỳ thành phần lớp thời gian chạy nào | Bảng thứ hai không có chìa khóa, không có lý do và không có gì có thể đọc được từ bên ngoài | Cung cấp cho sự phân biệt một khóa hoặc một chỗ dựa có tên trên thành phần sở hữu nút |
| Một nội suy`className`| Chuỗi chỉ tồn tại trong khi thành phần chạy, vì vậy không có gì có thể đọc lại được | Di chuyển toàn bộ chuỗi vào một mục và truyền khóa |
| Một lớp không thuộc đoàn thể | Nó thoát khỏi từ vựng mà toàn bộ hệ thống được xác định bởi | Thêm thành viên một cách có chủ ý hoặc sử dụng thành viên gần nhất tồn tại |
| MỘT`host`hoặc`as`chống đỡ trên khung | Khi đó, hai trang web gọi của một khóa có thể không đồng ý về phần tử, đó là hai nút mang một tên | Đặt tên máy chủ vào mục |
| Khai mạc`<ul>`, `<form>`hoặc`<nav>`bằng tay vì khung "chỉ vẽ div" | Nó không còn nữa. Đây chính xác là lỗ đã lấp đầy tầng lá bằng các cách sắp xếp | Cung cấp cho mục nhập một máy chủ |
| Một khóa có tên`card`, `box`, `wrapper`, `row`| Nó thừa nhận bất cứ điều gì, vì vậy nó không hạn chế gì và loại bỏ các trang web cuộc gọi khỏi các anh chị em cụ thể của nó | Đặt tên cho những gì nó nắm giữ |
| Một lý do trình bày lại chìa khóa | Nó tốn một dòng và không dạy gì, và tác giả tiếp theo không thể biết liệu nút có chịu tải hay không | Nêu rõ những gì bị đứt, bị bao bọc hoặc bị tràn khi không có nút |
| Máy chủ cấu trúc được viết bên ngoài khung hoặc nhánh máy chủ bề mặt được đặt tên | Đó là một nút không có khóa, không có hợp đồng con và không có lý do được ghi lại | Soạn chìa khóa; riêng các nhánh bề mặt có thể mở trình bao bọc cố định xung quanh máy chủ nội dung đã được kiểm tra của chúng |
| Viết tay một thuộc tính đánh dấu hợp đồng | Nút xác nhận một hợp đồng không có gì thực thi và mọi thử nghiệm đọc các thuộc tính đó đều tin vào điều đó | Kết xuất khóa và để khung vẽ chúng |
| Một khóa mới vì khóa hiện có sai kích thước | Từ vựng phát triển từng trang cuộc gọi cho đến khi nó mô tả các trang cuộc gọi chứ không phải hình dạng | Sử dụng khóa tồn tại hoặc thay đổi mục nhập cho mọi người |
| Một khóa trong bảng không có gì hiển thị | Nó hứa hẹn một nút không tồn tại, tồn tại sau mỗi lần đổi tên vì nó không có trang gọi và kéo dài bảng qua mã đọc nó cho đến khi bảng ngừng mô tả sản phẩm | Xóa nó; một hình dạng mong muốn cho công việc chưa bắt đầu thuộc về bản ghi kế hoạch |
|`children`trên một nút cấu trúc | Đánh dấu đã được tạo sẵn nên không có gì ở trên có thể nói những gì bên trong và không có quy tắc nào có thể kiểm tra | Khai báo các vị trí trên mục nhập và chuyển một thành phần cho mỗi vị trí trong`render`|
| Một mũi tên trần hoặc JSX theo nghĩa đen trong một`render`khe | Nó không mang siêu dữ liệu hợp đồng/lá | Gắn nhãn hiệu cho loại thành phần ổn định với`defineContractComponent`; truyền dữ liệu thời gian chạy qua`props`|
| Danh sách vị trí của trẻ em thay vì vị trí được đặt tên | Chèn một cái vào giữa và mỗi khe sau nó âm thầm có ý nghĩa khác | Đặt tên cho từng vị trí; một tên vẫn tồn tại sau khi chèn |
| Một chiếc lá không có`name`trên siêu dữ liệu của nó | Hai chiếc lá lấy cùng một đạo cụ có thể hoán đổi cho nhau và một ô yêu cầu hình tượng sẽ chấp nhận nhãn | Đặt tên cho mỗi chiếc lá bên cạnh điểm đánh dấu cấp của nó |
| Cây xương viết tay bên cạnh danh sách | Đang tải số lượng thẻ trôi ra khỏi hình dạng trực tiếp | Đặt`repeats: true`Và`restingCount`trên khe |
| Một giá trị boolean lựa chọn giữa hai cách sắp xếp | Một trong hai kết thúc không có chìa khóa, không có lý do và không có tên - nó tồn tại trên màn hình và không có trong bảng | Hai hình dạng là hai khóa và cả hai đều được đặt tên |
| Bảng ghép/CardShell dành cho`Card > Card.Content`| Nó mô hình hóa cơ chế bao bọc như một từ vựng thứ hai và thêm hướng dẫn mà không cần chính sách | Hãy để nhánh bề mặt được đặt tên sở hữu trình bao bọc và áp dụng hợp đồng nội dung cho phần thân của nó |

## Ví dụ

### Trường hợp thông thường — node là key

```tsx
// The wrapper passes named runtime props; the branded content draws the one contract root.
export const SurfaceListCard = ({ props, on, contract, render: Content, isLoading }: SurfaceListCardProps) => (
    <div className="flex flex-col gap-3">
        {props.fact === undefined ? (
            <Heading props={{ content: props.label, level: 3 }} />
        ) : (
            <Tree contract="label-with-muted-fact-row" render={labelAndFactFrom(props)} />
        )}
        <Card className="p-0" data-component="SurfaceListCardSurface">
            <Card.Content className="p-0">
                <Content props={props} on={on} isLoading={isLoading} />
            </Card.Content>
        </Card>
        {caption}
    </div>
)

const DailyQuestContentView = ({ props }) => (
    <Tree contract="daily-quest-list" render={rowsFrom(props.tasks)} />
)
const DailyQuestContent = defineContractComponent("daily-quest-list", DailyQuestContentView)
<SurfaceListCard
    contract="daily-quest-list"
    render={DailyQuestContent}
    props={{ label, fact, description, tasks }}
/>
```

```tsx
// Wrong: the wrapper accepts untyped markup, so the contract cannot prove what the card contains.
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => (
    <div className="flex flex-col gap-3">{children}</div>
)
```
Chúng khác nhau ở một điều: liệu nội dung có được kiểm tra theo hợp đồng mà nó yêu cầu hay không.

### Bẫy host — lỗ hổng làm thất thoát vocabulary

```ts
// The entry names its element, so a run of days is a list and still comes from a key - and
// `repeats` says both that the slot holds many and how many rest while they load.
"weekday-run": {
    classNames: ["flex", "flex-row", "flex-wrap", "items-center", "gap-2"],
    children: { day: { leaf: "day-cell", props: { size: "sm" }, repeats: true, restingCount: 6 } },
    host: "ul",
    why: "a run of equal columns only reads as one span of time while the columns stay on one line",
}
```

```tsx
// Wrong: no host was available, so the shape was filed among the leaves where it could write
// its own classes - and the same class string now exists in two places that no rule reads together.
const RUN_CLASSES = "flex flex-row flex-wrap items-center gap-2"
export const StreakWeekRun = ({ props }: StreakWeekRunProps) => <ul className={RUN_CLASSES}>{/* ... */}</ul>
```
Chúng khác nhau ở một điều: liệu phần tử đó có thể biểu thị được trong một mục hay không.

### Bẫy composition — helper không phải ngoại lệ

```tsx
// Two shapes are two keys. The distinction was real, so it got a name.
<Tree contract={props.isCompact ? "stacked-peer-controls" : "stacked-sections"} render={render} />
```

```tsx
// Wrong: a second table with no keys and no reasons, and `gap-4` is now invisible to every
// rule and every reader that looks at the entry table.
<div className={cn("flex flex-col", props.isCompact ? "gap-2" : "gap-4")}>{children}</div>
```
Chúng khác nhau ở một điều: liệu sự khác biệt đó có được đặt tên hay được sử dụng nội tuyến.

### Bẫy naming — key chấp nhận mọi thứ

```ts
// The name fixes the inside, so a wrong child is visible on sight, and one reason is true for
// every place the key is used.
"title-with-baseline-fact": {
    classes: ["flex", "flex-row", "flex-wrap", "items-baseline", "gap-2"],
    why: "the fact reads as part of the heading sentence, so it sits on the title's baseline and wraps under it",
}
```

```ts
// Wrong: `card` will hold a list here, a form there and a chart next month, and no single
// sentence can say why all three sit that way.
"card": {
    classes: ["flex", "flex-col", "gap-4", "p-4", "rounded-2xl", "bg-surface"],
    why: "a card",
}
```
Chúng khác nhau ở một điều: liệu tên có hạn chế những gì có thể được thông qua hay không.

### Bẫy reason — label không phải là `why`

```ts
why: "the tags wrap onto their own line before the title does, so a long title never breaks mid-word"
```

```ts
why: "row of chips"
```
Chúng khác nhau ở một điều: liệu câu có nói điều gì bị ngắt khi nút bị loại bỏ hay không.
