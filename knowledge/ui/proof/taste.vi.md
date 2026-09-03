# Taste proof

File này trả lời đúng một câu hỏi: bề mặt đã qua sạch mọi rule của canon, vậy nó có đẹp không. Một
bản render có thể thoả mãn từng owner, từng token và từng hợp đồng mà vẫn bị vứt, bởi canon quyết
định ai sở hữu một giá trị còn taste quyết định cả bố cục cộng lại thành cái gì. Các rule dưới đây
biến phán đoán đó thành tiêu chí đo được từ ảnh chụp, để một lần từ chối gọi tên được một con số chứ
không phải một tâm trạng, và để sự tuân thủ một mình không mua được một lần chấp nhận.

Không điều gì ở đây được chốt bằng cách đọc source. Mọi ô `Quan sát` đều gọi tên một thứ đếm được
trong ảnh chụp mà audit đã có sẵn: danh sách diện tích các phần tử xếp hạng, hình chữ nhật của một
dải trống, tập các mép trái, số điểm nhấn, số cỡ chữ. Ở đâu một tiêu chí chồng lên một quyết định đã
đưa ra từ trước khi có cây render, file này trích rule composition đó thay vì chép lại, vì taste kiểm
chứng kết quả còn composition đã kiểm chứng ý định.

Sources: phán quyết của chủ sở hữu rằng một bề mặt đúng grammar mà xấu thì vẫn vứt, và ví dụ thực tế
về một trang tổng quan dạng console đã qua sạch canon mà chỉ đạt khoảng ba trên năm, ghi tại
[bản ghi bằng chứng taste rubric](../../../tests/evidence/20260903-taste-rubric.md); và phán quyết rằng
một lựa chọn mà thang điểm đã cho sẵn câu trả lời thì không bao giờ là một lần dừng, cùng tiêu chí mật
độ đo trên dữ liệu đã seed và lựa chọn của chính người, ghi trong
[bản ghi bằng chứng phương án trội](../../../tests/evidence/20260903-dominant-candidate.md).

## TASTE-1 — Một điểm nhìn trong ba giây

Chi phối việc cái nhìn đầu tiên có chỗ đáp xuống không, và chỉ một chỗ thôi.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Ảnh chụp được nhìn trong ba giây | Đúng một phần tử là thứ to nhất và nặng nhất trong khung. Hai ứng viên chênh nhau chừng mười phần trăm về sức nặng thị giác sẽ bác bỏ nó |
| Case 2 | Trang có tiêu đề trang và các tiêu đề mục | Tiêu đề trang cao hơn mọi tiêu đề mục ít nhất một bậc thang, bằng cỡ chữ, bằng độ đậm, hoặc cả hai. Hai cỡ render bằng nhau sẽ bác bỏ nó |
| Case 3 | Đo phần tử nặng nhất khung | Nó chính là phần tử mà direction đã gọi tên là việc của bề mặt. Một mảng trang trí hay một artwork thắng cả khung sẽ bác bỏ nó |
| Case 4 | Một vùng có nhiều ứng viên cho neo của chính nó | Mỗi vùng chỉ một neo thắng, thắng bằng một bậc nhìn thấy được, ở mọi viewport đã chụp |

Không phải rule này: nội dung nào đáng được cấp mạnh nhất ngay từ đầu thuộc
[HIERARCHY-2](../composition/hierarchy.vi.md).

## TASTE-2 — Không có khoảng trống vô nghĩa

Chi phối phần diện tích trống không trả tiền thuê chỗ.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đo một dải, một ô hay một mảng trong ảnh chụp | Không vùng nào cao hơn `64px` mà vừa không mang nội dung vừa không mang chức năng như phân tách, gom nhóm hay một quãng nghỉ có chủ ý giữa các vùng |
| Case 2 | Có một dải được tô nền hoặc kẻ viền | Phần tô đánh dấu một ranh giới thật. Một dải tô nền mà cư dân duy nhất là một hình ảnh hay một icon sẽ bác bỏ nó |
| Case 3 | Một hàng lưới chỉ được lấp một phần | Các ô còn lại hoặc có nội dung, hoặc hàng đó thu lại. Nửa hàng ô trắng ở bề rộng đã chụp sẽ bác bỏ nó |
| Case 4 | Bề mặt được chụp ở viewport hẹp nhất | Khoảng trống không phình ra: một dải chật khi rộng và hoang vắng khi hẹp sẽ bác bỏ cả bố cục |

Không phải rule này: có những vùng nào tồn tại thuộc [LAYOUT-1](../composition/layout.vi.md).

## TASTE-3 — Lưới và mép

Chi phối việc mắt có tìm được một đường thẳng không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Các khối chữ xếp chồng trong một vùng | Mép trái của chúng về cùng một toạ độ x trong phạm vi `1px`. Một chồng hai ba mép trái khác nhau sẽ bác bỏ nó |
| Case 2 | Các card hoặc cột anh em nằm trên một hàng | Mọi khe giữa chúng đo được bằng nhau. Một khe lệch so với hàng xóm sẽ bác bỏ nó |
| Case 3 | Đo mép ngoài của một vùng so với vùng phía trên | Cả hai canh về cùng mép container, hoặc phần chênh là một inset đã khai báo chứ không phải lệch vài pixel |
| Case 4 | Một phần tử canh giữa trong khi hàng xóm canh trái | Việc canh giữa mang nghĩa. Một mục canh giữa lạc giữa một chồng canh trái sẽ bác bỏ nó |

## TASTE-4 — Nhịp dọc đơn điệu

Chi phối việc khoảng cách dọc còn nói lên điều gì không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đo khoảng cách giữa vùng, giữa mục và giữa hàng | Thứ tự giữ nguyên: khe vùng lớn hơn khe mục, khe mục lớn hơn khe hàng. Bất kỳ đảo chiều nào sẽ bác bỏ nó |
| Case 2 | So hai phần tử anh em cùng loại | Khoảng cách của chúng tới phần tử liền trước là như nhau. Hai khe khác nhau giữa các anh em ngang hàng sẽ bác bỏ nó |
| Case 3 | Đếm số khe dọc khác nhau trong ảnh chụp | Bề mặt dùng một tập bậc nhỏ và đóng, chứ không phải một dải liên tục các giá trị gần bằng nhau |
| Case 4 | Bề mặt được chụp ở một viewport thứ hai | Cùng thứ tự đó sống sót, chỉ các giá trị thay đổi |

Không phải rule này: giá trị spacing chính xác của một boundary do app sở hữu được chốt ở
presentation.

## TASTE-5 — Tiết kiệm màu

Chi phối việc tiêu bao nhiêu màu, và tiêu vào đâu.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đếm các control tô đầy màu nhấn trong ảnh chụp | Đúng một call to action tô đầy màu nhấn cho mỗi view, trừ `landing` được mang hai. Một khối tô nhấn vượt quá mức đã cấp, tranh chấp với khối đã được cấp, sẽ bác bỏ nó |
| Case 2 | Một màu ngữ nghĩa xuất hiện | Nó báo một outcome thật có authority chống lưng. Màu xanh thành công trên một dữ kiện trung tính, hay một sắc trạng thái dùng để trang trí, sẽ bác bỏ nó |
| Case 3 | View có một cảnh báo hoặc một lỗi | Nó khác biệt nhìn thấy được so với một hàng trung tính trong ảnh chụp: khác nền, khác viền hoặc có icon riêng, chứ không phải cùng một hàng xám chỉ đổi chữ |
| Case 4 | Đếm số sắc màu khác nhau trong khung, không tính ảnh chụp thật | Con số nằm trong các vai màu mà family đã công bố. Một trang đọc lên như bảng màu sẽ bác bỏ nó |

Không phải rule này: action nào đáng được màu nhấn thống trị thuộc [CTA-1](../composition/cta.vi.md),
ngân sách điểm nhấn khan hiếm được tiêu ra sao thuộc [ACCENT-1](../composition/accent.vi.md), còn
màu đã chọn có sống sót qua phép đo không thuộc [COLOR-3](contrast.vi.md).

## TASTE-6 — Chữ

Chi phối việc phần chữ nói bằng bao nhiêu giọng.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đếm các cỡ chữ đã render trong một vùng | Nhiều nhất ba cỡ khác nhau và nhiều nhất hai độ đậm. Một vùng có năm cỡ sẽ bác bỏ nó |
| Case 2 | Đo một đoạn văn chạy | Bề ngang chữ rơi vào khoảng 45 tới 80 ký tự ở bề rộng đã chụp. Một dòng chạy hết bề ngang một viewport rộng sẽ bác bỏ nó |
| Case 3 | Một heading hoặc một label bị xuống dòng | Không dòng cuối nào trơ lại một chữ mồ côi, và không heading nào gãy giữa cụm trong ảnh chụp |
| Case 4 | Hai đoạn chữ mang cùng một cấp | Chúng render cùng cỡ và cùng độ đậm. Hai label cùng cấp render khác nhau sẽ bác bỏ nó |

## TASTE-7 — Nhất quán hình khối

Chi phối việc bề mặt có do một bàn tay cắt ra không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Thu thập các bán kính bo góc trong ảnh chụp | Chúng về cùng một họ bậc. Một view trộn card sắc cạnh, card bo mềm và một container hình viên thuốc mà không có lý do sẽ bác bỏ nó |
| Case 2 | Đếm độ sâu lồng nhau của card | Không card nào nằm sâu quá hai tầng. Một hộp kẻ viền trong một card trong một card sẽ bác bỏ nó |
| Case 3 | So viền và đổ bóng giữa các phần tử ngang hàng | Các phần tử ngang hàng mang cùng cách xử lý độ nổi. Một card có bóng giữa các anh em phẳng sẽ bác bỏ nó |
| Case 4 | Một control nằm trong một container | Bán kính của control bằng hoặc nhỏ hơn của container, để hai hình lồng vào nhau chứ không cấn nhau |

## TASTE-8 — Hình ảnh phải xứng chỗ nó chiếm

Chi phối ảnh, minh hoạ và artwork trang trí.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một hình ảnh render | Nó mang nghĩa hoặc mang identity thương hiệu. Một minh hoạ mà gỡ đi không đổi gì ngoài lượng khoảng trống sẽ bác bỏ nó |
| Case 2 | Đếm số hình trang trí trong view | Nhiều nhất một. Từ hai món trang trí trở lên trong một view sẽ bác bỏ nó |
| Case 3 | Một hình nằm trong một dải vốn trống | Nó không phải lý do tồn tại của dải: gỡ hình ra, vùng đó vẫn phải đọc lên như một vùng có chủ ý, nếu không dải đó hỏng luôn cả TASTE-2 |
| Case 4 | Đo hình đó so với phần tử điểm nhìn | Nó không phải thứ nặng nhất khung, trừ khi việc của bề mặt chính là bức hình |

## TASTE-9 — Mật độ hợp với lớp bề mặt

Chi phối việc bao nhiêu phần bề mặt đang thật sự làm việc.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Lấy mật độ của một ảnh chụp | Đó là tổng hình chữ nhật bao của các node nội dung và hành động chia cho diện tích đã chụp. Lớp mà coverage đã khai đặt ra dải: `console` ít nhất sáu mươi phần trăm, `catalog` ít nhất năm mươi, `reader` giữa bốn mươi và bảy mươi, `form` giữa hai mươi lăm và năm mươi, `landing` nhiều nhất bốn mươi |
| Case 2 | Dải của lớp là trần chứ không phải sàn, như với `landing` và với nửa trên của `form` và `reader` | Phần thở giữ mật độ ở dưới trần ấy là liên tục chứ không phải những túi trống rải rác. Vùng trống bị cắt thành những khoảng rời rạc sẽ bác bỏ nó |
| Case 3 | Phép ước lượng được thực hiện | Các hình chữ nhật được đếm đều được gọi tên trong receipt, để người đọc thứ hai lặp lại được và ra kết quả lệch chừng mười phần trăm |
| Case 4 | Một lớp bề mặt dày được chụp ở viewport hẹp | Mật độ đạt được bằng sắp thứ tự và gom nhóm, không phải bằng cách thu nhỏ mục tiêu xuống dưới ngưỡng của chúng |
| Case 5 | Mật độ phụ thuộc vào số bản ghi mà dữ liệu cung cấp | Nó được đo ở khối lượng seed đại diện của luồng: số bản ghi mà seed của luồng đặt cho thực thể mà bề mặt liệt kê. Một workspace đang phục vụ dưới khối lượng ấy thì không được phán: ô Measured ghi `below-volume` kèm khối lượng đang phục vụ và khối lượng seed đặt, và hàng ấy định tuyến về `seed` — operator sở hữu dữ liệu đưa workspace lên đủ khối lượng rồi mục ấy được chụp lại — không bao giờ về `direction` và không bao giờ tới một người |
| Case 6 | Mật độ vẫn hỏng ở khối lượng đại diện | Ô Measured ghi `data-bound` kèm khối lượng đã đo; hàng ấy giữ điểm và kết luận hỏng của nó, và `TASTE-13` Case 6 để nó ngoài verdict, nên nó không chặn quality cũng không chặn UAT |

Không phải rule này: ở mật độ đó mục tiêu còn thao tác được không thuộc
[A11Y-4](accessibility.vi.md).

## TASTE-10 — State cũng phải được thiết kế

Chi phối những bản render không thuộc đường đi hạnh phúc.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Chụp state đang tải | Nó có bố cục: skeleton chiếm đúng các vùng đó, ở đúng các cấp đó, như nội dung đã giải quyết. Một khung trắng hay một spinner lẻ loi giữa khoảng không sẽ bác bỏ nó |
| Case 2 | Chụp state rỗng | Nó có một tiêu đề, một dòng giải thích và hành động chấm dứt sự rỗng đó. Một câu trần trụi canh giữa vùng sẽ bác bỏ nó |
| Case 3 | Chụp state lỗi | Nó nói rõ cái gì hỏng và làm gì tiếp, ngay trong vùng đã hỏng chứ không thay thế cả trang |
| Case 4 | So các state đó với state đã tải xong | Không vùng nào dịch chỗ hay đổi kích thước khi nội dung về, nên bố cục không giật giữa chúng |

## TASTE-11 — Chạm và phản hồi

Chi phối việc bề mặt có trả lời khi bị chạm không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đo các mục tiêu tương tác | Mọi mục tiêu đạt ngưỡng tối thiểu mà [A11Y-4](accessibility.vi.md) gọi tên, tính cả vùng chạm đã đệm. Một hàng control chỉ có icon nhỏ hơn mức đó sẽ bác bỏ nó |
| Case 2 | So ảnh chụp hover và focus với ảnh chụp lúc nghỉ | Mỗi state khác thấy rõ so với lúc nghỉ và khác nhau. Một hover không phân biệt được với lúc nghỉ sẽ bác bỏ nó |
| Case 3 | Diff ảnh chụp hover hoặc focus với ảnh chụp lúc nghỉ | Không phần tử nào đổi vị trí hay kích thước. Một viền hiện ra khi hover làm xô cả hàng sẽ bác bỏ nó |
| Case 4 | Một control đang chạy việc | Ảnh chụp trong lúc đó cho thấy trạng thái chờ ngay trên chính control, không chỉ ở nơi khác trên trang |

Không phải rule này: chỉ dấu focus có cảm nhận được không và focus đi tới đâu thuộc
[FOCUS-1](focus.vi.md).

## TASTE-12 — Khớp với chuẩn tham chiếu

Chi phối việc bề mặt có thuộc về lớp mà nó tự nhận không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đọc quyết định direction | Nó gọi tên các chuẩn tham chiếu mà bề mặt này nhắm tới, theo lớp chứ không theo tính từ. Một direction không gọi tên chuẩn nào sẽ bác bỏ cả lần audit trước khi chấm bất kỳ ảnh nào |
| Case 2 | Đặt ảnh chụp cạnh các tham chiếu đó | Một người đọc không biết cả hai sản phẩm vẫn xếp bề mặt vào cùng một lớp. Xếp nó vào một lớp xoàng hơn sẽ bác bỏ nó |
| Case 3 | Mô tả khoảng cách | Receipt gọi tên tiêu chí nào ở trên gánh phần chênh đó, để khác biệt là một finding chứ không phải một cảm tưởng |
| Case 4 | Tham chiếu chỏi với một rule của canon | Canon thắng và tham chiếu bị bỏ, vì taste được quyền từ chối một bề mặt tuân thủ nhưng không bao giờ được cấp phép cho một bề mặt không tuân thủ |

## TASTE-13 — Chấm điểm và verdict của taste

Chi phối việc các tiêu chí trên gộp thành một quyết định như thế nào.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Ống kính taste chạy | Mọi tiêu chí từ `TASTE-1` tới `TASTE-12` đều mang một kết luận đạt hoặc hỏng và một điểm từ 1 tới 5, mỗi cái có phép đo mà chính rule đó gọi tên chống lưng |
| Case 2 | Tính verdict | `ship` đòi không hỏng ở `TASTE-1`, `TASTE-2`, `TASTE-5`, `TASTE-8` và `TASTE-12`, cùng điểm trung bình ít nhất 4 trên mười hai tiêu chí. Mọi trường hợp khác là `fix-first` |
| Case 3 | Mọi rule của canon đều đạt mà verdict taste là `fix-first` | Bề mặt vẫn là `fix-first`. Một receipt cho ship vì canon xanh sẽ bác bỏ cả ống kính |
| Case 4 | Một tiêu chí taste hỏng | Nó định tuyến về `direction`, không bao giờ về `resolve`, vì đổi một giá trị không sửa được một bố cục |
| Case 5 | Một điểm được ghi mà không có phép đo | Mục đó vô hiệu, và ống kính chưa hoàn tất cho tới khi phép đo được chụp |
| Case 6 | Một hàng là `below-volume` hay `data-bound` (`TASTE-9` Case 5 và 6) | Hàng `below-volume` làm verdict thành `blocked`, định tuyến về `seed`, cho tới khi mục ấy được chụp ở đủ khối lượng; hàng `data-bound` được để ngoài điểm trung bình và ngoài tập chặn cửa, nên verdict được tính trên các tiêu chí mà dữ liệu trả lời được |
| Case 7 | Người đã chọn phương án của bề mặt từ một bảng đã in mà bảng điểm cho thấy tiêu chí này rớt ở chính phương án ấy vào lúc chọn | Ô Measured ghi `person-accepted` và gọi tên nhánh của quyết định người đã duyệt, cạnh phép đo; hàng ấy giữ điểm và kết luận hỏng của nó và được để ngoài điểm trung bình lẫn tập chặn cửa, vì thang điểm không bao giờ lật một quyết định người đã lấy trên chính bằng chứng của mình trong cùng phiên. Một hàng `person-accepted` không gọi tên nhánh nào, gọi tên một quyết định operator tự lấy, hay phủ lên một tiêu chí mà phương án được chọn không được cho thấy là rớt, thì vô hiệu |

Tập được chấm là `TASTE-1` tới `TASTE-12`; rule này là phần số học và bản thân nó không được chấm.
Năm tiêu chí chặn cửa `ship` đúng là năm thứ người đọc nhận ra trước khi đọc chữ nào: điểm nhìn,
khoảng trống, mức tiêu màu, hình ảnh, và cái lớp mà bề mặt rơi vào. Điểm 3 nghĩa là tiêu chí được đáp
ứng nhưng không có sức thuyết phục, nên một bề mặt có thể đạt mọi tiêu chí mà vẫn `fix-first` chỉ vì
điểm trung bình, và đó đúng là kết cục dành cho một trang chỉ vô thưởng vô phạt. Finding của taste
không bao giờ mang base verdict của canon và không bao giờ thành `grammar-gap`: một tiêu chí không
thể đáp ứng bằng family đã công bố vẫn là vấn đề của direction cho tới khi composition chứng minh
ngược lại.

## File này không quyết định

Direction đã chọn cấp độ, action, vùng hay điểm nhấn nào thuộc
[Hierarchy](../composition/hierarchy.vi.md), [CTA](../composition/cta.vi.md),
[Layout](../composition/layout.vi.md) và [Accent](../composition/accent.vi.md). Giá trị CSS nào cho
một boundary do app sở hữu thuộc presentation. Bản render có cảm nhận và thao tác được không thuộc
[Accessibility](accessibility.vi.md) và [Focus](focus.vi.md), khác biệt có sống sót qua phép đo
không thuộc [Contrast](contrast.vi.md), chuyển động có giữ được ý nghĩa không thuộc
[Motion](motion.vi.md), còn tuyên bố đã render có truy về authority không thuộc
[Render truth](render-truth.vi.md).
