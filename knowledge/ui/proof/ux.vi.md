# UX proof

File này trả lời đúng một câu hỏi: một người ngồi xuống với sản phẩm đang chạy và cố làm xong một
việc, vậy họ có làm xong không. Canon quyết định ai sở hữu một giá trị, taste quyết định cả bố cục
cộng lại thành cái gì, còn chủ đề này quyết định bề mặt có dùng được với một người tới đây mang theo
một nhiệm vụ chứ không mang theo cuốn luật. Một bề mặt có thể đúng owner, nhìn thuyết phục trong một
khung hình tĩnh, mà vẫn bỏ rơi giữa đường chính người cần nó, nên bằng chứng ở đây là một lượt chạy
chứ không phải một ảnh chụp.

Dụng cụ đo thông thường là lượt UAT: `uat.verify` lái một flow đã đóng băng tại commit đã ghim và
phán lane `ux` trên chính capture của nó, nên một ô `Quan sát` gọi tên một bước của một lần thử thật —
assertion đã tới được, số bước đã tốn, độ trễ giữa lúc kích hoạt và thay đổi nhìn thấy đầu tiên,
trạng thái sau khi tải lại. Ở đâu một tiêu chí đã ngã ngũ chỉ với một bản render và không cần một lần
thử, `frontend.surface.audit` được phép đo nó từ capture nó đã chụp sẵn; mỗi rule dưới đây gọi tên
dụng cụ nào trả lời nó. Không dụng cụ nào được thay quan sát bằng ý định: một tài liệu flow đã duyệt
không chứng minh một nhiệm vụ đã xong, và một spinner nằm trong markup không chứng minh một tín hiệu
tiến trình từng xuất hiện.

Sources: phán quyết của chủ sở hữu rằng mọi thứ cần để quyết định một bề mặt đã đạt hay chưa đều phải
là một rule có ngưỡng, rằng UX được phán trên một lượt chạy nhiệm vụ chứ không trên ảnh chụp tĩnh, và
rằng một con số trung bình không bao giờ được che một lỗi chí mạng; cộng với hai flow đã ẩn danh, một
lần đăng nhập và một lần mua, chấm điểm trọn vẹn tại
[bản ghi bằng chứng UX scorecard](../../../tests/evidence/20260903-ux-scorecard.md).

## UX-1 — Nhiệm vụ hoàn tất

Chi phối việc mục tiêu flow đã khai báo có thật sự tới được không, và tới mà không cần ai mách. Đo
trong một lượt UAT; một lần fail đi về phía chủ flow, vì chỉ một con người mới quyết định flow này
sinh ra để làm gì.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Lượt chạy tới được assertion cuối của flow | Trạng thái mục tiêu mà `flow.md` gọi tên có mặt trong capture và trong store. Một lượt kết thúc ở màn hình cuối mà thiếu bản ghi mục tiêu nói tới sẽ bác bỏ nó |
| Case 2 | Lượt chạy được lái mà không cần kiến thức nào ngoài thứ bề mặt bày ra | Mọi bước đều chọn từ một nhãn nhìn thấy được, không bước nào cần gõ tay một URL, một câu lệnh console, hay một lời mách của tác giả flow. Một lần can thiệp như vậy sẽ bác bỏ nó |
| Case 3 | Flow khai báo một nhánh khác như từ chối, huỷ hay thử lại | Nhánh đó cũng tới được một assertion cuối có tên. Một nhánh hết màn hình giữa chừng sẽ bác bỏ nó |
| Case 4 | Nhiệm vụ hoàn tất | Nó hoàn tất trong ngân sách thời gian flow đã khai báo, tính từ lần kích hoạt đầu tới assertion cuối. Vượt ngân sách được ghi là fail kèm thời lượng đo được, không được bỏ qua |

Không phải rule này: backend có thật sự làm xong việc hay không thuộc lane `behavior`, không thuộc đây.

## UX-2 — Số bước nằm trong ngân sách của flow

Chi phối lượng việc người dùng phải tự làm để đi tới đích. Đo trong một lượt UAT, đối chiếu ngân sách
flow khai báo, và đối chiếu dải theo lớp mà chính rule này sở hữu; một lần fail đi về `direction`.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Lượt chạy hoàn tất | Số bước đã commit — mỗi lần điều hướng, gửi đi hay xác nhận mà người dùng phải tự làm — nhiều nhất bằng ngân sách `flow.md` khai báo cho flow đó. Vượt qua sẽ bác bỏ nó |
| Case 2 | Flow không khai báo ngân sách | Dải theo lớp được dùng thay và receipt gọi tên nó: trên `console`, mọi hành động bề mặt sở hữu cách lối vào nhiều nhất ba bước; trên `form`, nhiều nhất ba bước cho một mục đích đơn và nhiều nhất bảy bước cho một flow nhiều bước đã khai; trên `landing`, chuyển đổi nhiều nhất hai bước; trên `catalog`, từ list sang detail đúng một bước và đường về một bước; trên `reader`, đường về list gốc là một bước. Một lượt chấm mà không có con số nào là vô hiệu |
| Case 3 | So hai bước với nhau | Không bước nào tồn tại chỉ để xác nhận bước trước. Một màn chen giữa để xác nhận một hành động không huỷ hoại sẽ bác bỏ nó |
| Case 4 | Cùng nhiệm vụ được một người quay lại làm lần nữa trong lượt chạy | Lần lặp không tốn thêm bước nào: thứ người đó đã cung cấp không bị hỏi lại |

Không phải rule này: bề mặt bày ra những hành động nào thuộc [CTA-1](../composition/cta.vi.md).

## UX-3 — Nhập sai được sửa ngay tại chỗ

Chi phối việc phục hồi: người dùng làm sai, và cái sai đó tốn của họ bao nhiêu. Đo trong một lượt UAT;
một lần fail đi về `direction`.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Lượt chạy gửi đi một giá trị sai có chủ ý | Sửa ngay tại field đang giữ giá trị sai, và flow tới được assertion cuối trong tối đa hai bước nữa. Phải chạy lại cả flow để sửa một field sẽ bác bỏ nó |
| Case 2 | Chụp lại bản render lúc báo lỗi | Mọi giá trị người dùng đã nhập vẫn còn đó và vẫn sửa được. Một field bị xoá trắng sẽ bác bỏ nó |
| Case 3 | Giá trị sai là một cam kết huỷ hoại hoặc một cam kết đã trả tiền | Có một đường hoàn tác, huỷ hay đảo ngược tới được từ màn hình cuối, và lượt chạy đi thử đường đó. Một cam kết không có đường lui sẽ bác bỏ nó |
| Case 4 | Đọc thông báo lỗi từ capture | Nó gọi tên field sai và dạng được chấp nhận, để lần thử thứ hai có thông tin. Một thông báo chỉ nói rằng có gì đó không hợp lệ sẽ bác bỏ nó |

Không phải rule này: lỗi thuộc về owner nào là [FEEDBACK-1](../composition/feedback.vi.md), còn thông
báo có được đọc lên cho công nghệ trợ giúp hay không là [A11Y-1](accessibility.vi.md).

## UX-4 — Bề mặt trả lời trong các dải độ trễ

Chi phối việc người dùng có bao giờ phải chờ mà không biết mình đang chờ. Đo trong một lượt UAT bằng
cách bấm giờ từ lúc kích hoạt tới lúc render đổi; một lần fail đi về `direction`, vì thiếu tín hiệu là
vấn đề của bố cục kể cả khi phần việc chậm thì không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Bất kỳ control nào được kích hoạt | Có một thay đổi nhìn thấy được trong vòng `100ms` — một dấu hiệu đã bấm, một control bị khoá, một chỉ báo đang chạy. Không có thay đổi nào trong cửa sổ đó sẽ bác bỏ nó |
| Case 2 | Phần việc kéo dài quá `1s` | Tới lúc đó đã có tín hiệu tiến trình hiển thị, và nó nằm trên kẻ khởi động hoặc trên vùng sắp đổi. Tiến trình chỉ báo bằng một toast ở góc sẽ bác bỏ nó |
| Case 3 | Phần việc kéo dài quá `10s` | Có một lối ra hiện diện và dùng được: một nút huỷ, một lựa chọn chạy nền, hoặc một kỳ vọng được nói rõ kèm đường thoát. Một khung hình chỉ quay quá mười giây sẽ bác bỏ nó |
| Case 4 | So tín hiệu tiến trình với kết cục | Tín hiệu dừng khi kết cục đã biết, và không bao giờ tuyên bố xong trước khi store xác nhận, đúng như [TRUTH-3](render-truth.vi.md) đòi |

Không phải rule này: pending có nằm trên kẻ khởi động theo thiết kế hay không là
[ACTION-2](../composition/action.vi.md), còn dấu hiệu pending có nhìn thấy trong một ảnh tĩnh hay
không là [TASTE-11](taste.vi.md).

## UX-5 — Tìm ra được điểm đến

Chi phối việc người dùng có định vị được thứ họ tới để tìm. Đo trong một lượt UAT cho các điểm đến của
chính flow, và từ capture của audit cho phần điều hướng bề mặt bày ra lúc nghỉ; một lần fail đi về
`direction`.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Lượt chạy điều hướng tới điểm đến của flow | Tới nơi trong độ sâu điều hướng mà lớp đã khai cho phép: hai cấp với `console`, `catalog` hay `reader`, một cấp với `form` hay `landing`. Một cấp vượt quá, hoặc một ô tìm kiếm là đường duy nhất, sẽ bác bỏ nó |
| Case 2 | Đọc nhãn điều hướng từ capture | Mỗi nhãn là từ mà người dùng gọi thứ đó, không phải tên nội bộ của module. Một nhãn gọi tên một service, một bảng hay một bản phát hành sẽ bác bỏ nó |
| Case 3 | Đã tới được điểm đến | Bề mặt nói rõ người dùng đang ở đâu: mục điều hướng đang active, tiêu đề và địa chỉ đồng ý với nhau. Hai trong ba thứ đó lệch nhau sẽ bác bỏ nó |
| Case 4 | Một điểm đến tới được bằng hơn một đường | Các đường đều đáp xuống cùng một bề mặt ở cùng một trạng thái. Hai đường cho ra hai bản render khác nhau của cùng điểm đến sẽ bác bỏ nó |

Không phải rule này: trang có những vùng nào và ai sở hữu chúng là
[LAYOUT-1](../composition/layout.vi.md).

## UX-6 — Không có ngõ cụt

Chi phối mọi trạng thái lượt chạy có thể đáp xuống. Đo trong một lượt UAT, và từ capture của audit cho
các bản render tĩnh của trạng thái rỗng, lỗi và thành công; một lần fail đi về `direction`.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Chụp lại bất kỳ trạng thái nào lượt chạy đáp xuống | Nó bày ra ít nhất một hành động kế tiếp hoặc một đường lui, cả hai đều dùng được. Một màn hình mà lối ra duy nhất là nút của trình duyệt sẽ bác bỏ nó |
| Case 2 | Tới được trạng thái rỗng | Hành động chấm dứt sự rỗng có mặt và tới được ngay trong cùng vùng đó. Một trạng thái rỗng chỉ biết giải thích sẽ bác bỏ nó |
| Case 3 | Tới được trạng thái thành công cuối cùng | Nó gọi tên việc kế tiếp hoặc đưa người dùng về một bề mặt làm việc được. Một màn xác nhận không dẫn đi đâu sẽ bác bỏ nó |
| Case 4 | Tới được một lỗi hoặc một lần từ chối quyền | Nó bày ra một lần thử lại, một lựa chọn thay thế, hoặc đầu mối liên hệ giải quyết được, và lượt chạy đi thử thứ được bày ra |

Không phải rule này: sự vắng mặt có được render trọn vẹn hay không là
[STATE-3](../composition/state.vi.md), còn trạng thái đó có bố cục được thiết kế hay không là
[TASTE-10](taste.vi.md).

## UX-7 — Chỗ đứng sống sót qua back, tải lại và một link được chia sẻ

Chi phối tính liên tục: người dùng rời đi rồi quay lại. Đo trong một lượt UAT; một lần fail đi về phía
chủ flow, vì một route được phép tiếp tục ở đâu là quyết định của sản phẩm.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Lượt chạy bấm back giữa flow | Bước trước quay lại nguyên vẹn cùng các giá trị đã nhập, và không bước nào bị commit lại trong im lặng. Một cú back làm flow chạy lại từ đầu sẽ bác bỏ nó |
| Case 2 | Lượt chạy tải lại bước hiện tại | Đúng bước đó render lại, cùng lựa chọn, bộ lọc hay tab, và không mất thứ gì người dùng đã nhập trước lần commit gần nhất |
| Case 3 | Mở địa chỉ của một bước giữa flow trong một phiên mới | Nó hoặc tiếp tục đúng bước đó, hoặc nói thẳng vì sao không thể và phải bắt đầu từ đâu. Một bề mặt trắng hay một cú chuyển hướng lặng lẽ về gốc sẽ bác bỏ nó |
| Case 4 | Lượt chạy rời sang bề mặt khác rồi quay lại | Vị trí cuộn, các nhóm đang mở và view đang chọn vẫn như lúc rời đi, trừ khi flow đã khai báo khác |

Không phải rule này: lựa chọn nào là lựa chọn bền vững giữa các view ngang hàng thuộc
[STATE-6](../composition/state.vi.md).

## UX-8 — Cái form điền được

Chi phối tính công thái của mọi field lượt chạy chạm tới. Đo từ capture của audit cho cấu trúc và thứ
tự, và trong một lượt UAT cho lượt bàn phím và lượt autofill; một lần fail đi về `direction`.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Chụp lại từng field | Nó mang một nhãn nhìn thấy được và ở lại, không phải một placeholder đóng thế nhãn. Một nhãn biến mất khi bắt đầu gõ sẽ bác bỏ nó |
| Case 2 | Một field bị từ chối | Thông báo render ngay cạnh field đó và ở lại trong lúc field được sửa. Chỉ một bản tóm tắt trên đầu trang mà không đánh dấu ở field sẽ bác bỏ nó |
| Case 3 | Điền cả form chỉ bằng bàn phím | Thứ tự tab bằng đúng thứ tự đọc, nút gửi tới được, và Enter gửi đi từ một field một dòng. Một cái bẫy hay một field bị nhảy qua sẽ bác bỏ nó |
| Case 4 | Đo một field thuộc loại đã biết — email, tên, địa chỉ, mã một lần, thanh toán | Nó khai báo các gợi ý autofill và input-mode mà nền tảng chờ đợi, và trình duyệt có mời giá trị đã lưu trong lượt chạy. Một field số mà bật bàn phím chữ sẽ bác bỏ nó |

Không phải rule này: tên khả truy cập và quan hệ của field có được tính ra hay không là
[A11Y-1](accessibility.vi.md), còn focus có nhìn thấy hay không là [FOCUS-1](focus.vi.md).

## UX-9 — Hành động chính nằm trong tầm ngón cái trên điện thoại

Chi phối việc bề mặt có lái được bằng một tay. Đo từ capture của audit ở viewport hẹp; một lần fail đi
về `direction`.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Chụp bề mặt ở viewport hẹp nhất đã khai báo | Hành động chính của bước nằm ở nửa dưới khung hình, hoặc trong một thanh dính ghim vào mép dưới. Một hành động chính chỉ tới được sau khi cuộn qua nếp gấp sẽ bác bỏ nó |
| Case 2 | Có một thanh hành động dính | Nó không che nội dung người dùng còn cần: hàng nội dung cuối cùng vẫn nhìn thấy trọn vẹn phía trên nó. Nội dung bị giấu vĩnh viễn sau thanh đó sẽ bác bỏ nó |
| Case 3 | Hành động huỷ hoại và hành động chính nằm cùng vùng với tới | Chúng cách nhau ít nhất một bề rộng mục tiêu, để ngón cái không bấm nhầm. Xác nhận và xoá nằm sát nhau sẽ bác bỏ nó |
| Case 4 | Đo các mục tiêu trong vùng với tới | Mỗi mục tiêu đạt kích thước tối thiểu mà [A11Y-4](accessibility.vi.md) gọi tên, ở đúng viewport đó, tính cả vùng chạm đã đệm |

Không phải rule này: cái gì sống sót khi không gian co lại là
[RESPONSIVE-1](../composition/responsive.vi.md).

## UX-10 — Cùng một động từ nằm cùng một chỗ

Chi phối tính nhất quán qua các bề mặt mà một flow đi ngang. Đo trên toàn bộ capture của lượt chạy;
một lần fail đi về `direction`.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một hành động xuất hiện trên hai bề mặt của lượt chạy | Nó mang cùng một động từ ở cả hai. Cùng một thao tác mà màn này ghi Lưu, màn kia ghi Cập nhật sẽ bác bỏ nó |
| Case 2 | So hai bề mặt cùng lớp | Hành động chính chiếm cùng một vị trí tương đối trong vùng của nó. Một bên đặt trên phải, bên kia đặt dưới trái sẽ bác bỏ nó |
| Case 3 | So hình dạng của một control qua cả lượt chạy | Cùng một hệ quả mang cùng một mức nhấn ở mọi lần, đúng như [CTA-1](../composition/cta.vi.md) đã chốt. Một hành động huỷ hoại render thành một link nhạt ở một bề mặt sẽ bác bỏ nó |
| Case 4 | Một mẫu tương tác lặp lại — một picker, một xác nhận, một bộ lọc | Nó hành xử y như nhau ở mọi lần xuất hiện trong lượt chạy |

Không phải rule này: hành động nào xứng đáng nhận accent chủ đạo là
[ACCENT-1](../composition/accent.vi.md).

## UX-11 — Chữ nói đúng thứ đó là gì

Chi phối phần copy mà lượt chạy thật sự đọc. Đo từ capture của lượt chạy; một lần fail đi về phía chủ
flow, vì thẩm quyền với copy không thuộc người thiết kế.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đọc nhãn và tiêu đề từ các capture | Chúng là danh từ gọi tên sự vật, còn control là động từ gọi tên hiệu ứng. Một control ghi Thông tin, hay một tiêu đề ghi Quản lý, sẽ bác bỏ nó |
| Case 2 | Một con số, một ngày hay một trạng thái được render | Nó mang đơn vị, đơn vị tiền, múi giờ hay thang đo khiến nó thành một dữ kiện. Một con số trần mà nghĩa của nó tuỳ người đọc đoán sẽ bác bỏ nó |
| Case 3 | Quét các capture tìm copy tạm | Không còn chữ placeholder, không key chưa dịch, không lorem, không chuỗi debug, không câu bị cắt cụt ở bất kỳ trạng thái nào lượt chạy đã tới |
| Case 4 | Cùng một khái niệm xuất hiện hai lần trong lượt chạy | Nó được gọi tên y hệt cả hai lần. Hai cái tên cho một đối tượng trong một flow sẽ bác bỏ nó |

Không phải rule này: tuyên bố có truy về được authority thật hay không là
[TRUTH-1](render-truth.vi.md).

## UX-12 — Chấm điểm và verdict của UX

Chi phối cách các tiêu chí trên gộp thành một quyết định.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Lens UX chạy | Mỗi tiêu chí từ `UX-1` tới `UX-11` mang một pass hoặc fail và một điểm từ 1 tới 5, mỗi điểm dựa trên bước chạy hoặc capture mà chính rule đó gọi tên |
| Case 2 | Tính verdict | `ship` đòi không fail ở `UX-1`, `UX-3`, `UX-4`, `UX-6` hay `UX-7`, và điểm trung bình ít nhất 4 trên cả mười một tiêu chí. Mọi trường hợp khác là `fix-first` |
| Case 3 | Một tiêu chí chặn cửa bị fail trong khi trung bình vẫn từ 4 trở lên | Verdict vẫn là `fix-first` bất kể trung bình. Một receipt ship dựa trên mỗi con số trung bình sẽ bác bỏ lens này |
| Case 4 | Bằng chứng của một tiêu chí chỉ là ảnh chụp mà không có lần thử nào phía sau, với một rule file này giao cho lượt chạy | Mục đó là `EVIDENCE_UNAVAILABLE`, không phải pass và cũng không phải fail, và lens còn dở |
| Case 5 | Một lần fail được định tuyến | Nó đi đúng nơi rule của chính nó gọi tên — `direction` cho một lỗi bố cục, chủ flow cho một lỗi về ý định, authority hay copy — và không bao giờ đi về `resolve`, vì không phép đổi giá trị nào sửa được một flow |

Tập được chấm điểm là `UX-1` tới `UX-11`; rule này là phần số học và bản thân nó không được chấm. Năm
tiêu chí chặn cửa `ship` là năm thứ bỏ rơi một người giữa nhiệm vụ: việc không bao giờ xong, cái sai
không hoàn tác được, lần chờ không được giải thích, trạng thái không có lối ra, hoặc mất chỗ đứng trên
đường quay lại. Điểm 3 nghĩa là tiêu chí được đáp ứng mà không có sức thuyết phục, nên một flow không
bao giờ thật sự hỏng vẫn có thể là `fix-first` chỉ vì trung bình, và đó đúng là kết quả mong muốn cho
một flow chỉ dừng ở mức chạy được. Finding của UX không bao giờ mang base verdict của canon và không
bao giờ thành `grammar-gap`. Kết quả đã chấm chính là lane `ux` của run record, và là hàng
`experience` của mọi bảng `## Verdict` phía sau nó.

## File này không quyết định

Sản phẩm có làm xong phần việc hay không thuộc lane `behavior` của lượt chạy, không phải một rule
knowledge. Bản render có cảm nhận được và thao tác được hay không là [Accessibility](accessibility.vi.md)
và [Focus](focus.vi.md), khác biệt có sống sót qua phép đo hay không là [Contrast](contrast.vi.md),
chuyển động có giữ được ý nghĩa hay không là [Motion](motion.vi.md), tuyên bố đã render có truy về
authority hay không là [Render truth](render-truth.vi.md), và bố cục có đủ đẹp để nhìn hay không là
[Taste](taste.vi.md). Direction đã chọn cấp độ, action, vùng, state hay điểm nhấn nào thuộc
[Hierarchy](../composition/hierarchy.vi.md), [CTA](../composition/cta.vi.md),
[Layout](../composition/layout.vi.md), [State](../composition/state.vi.md) và
[Accent](../composition/accent.vi.md). Các lens gộp lại thành một verdict ship được ra sao thuộc
[scorecard](ui.vi.md).
