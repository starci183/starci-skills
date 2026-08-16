---
id: fe-principles-motion-vi
title: vi.md
slug: /fe/principles/motion/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống MOTION-N, nhận diện bằng thứ đã thật sự thay đổi chứ không bằng cảm giác.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `motion`

# Chuyển động

Chuyển động là **một lời khẳng định rằng hai khung hình là cùng một vật**. Nó được chọn theo **thứ
đã thật sự đổi** giữa hai khung hình đó: sự có mặt, lớp sơn, hình học, hay không gì cả.

Đừng chọn thời lượng bằng cảm giác "hơi giật" hay "hơi lê". Hãy nhìn vào hai khung hình và hỏi:

> Giữa hai khung này, cái gì đã đổi — và người dùng có cần **bám theo** nó không?

Nếu người dùng cần bám theo một vật đang di chuyển, chuyển động là thông tin. Nếu không ai cần bám
theo, chuyển động chỉ là thời gian bị lấy mất.

**Đây là luật bắt buộc.** Bất cứ thứ gì có thể trông khác đi giữa hai khung hình đều rơi vào đúng một
mã dưới đây. Không có thay đổi nào nhỏ đến mức được miễn: một nút đậm màu lên khi rê chuột là
`MOTION-2`, đúng cùng một lý do mà một ngăn trượt trượt vào là `MOTION-1`. Câu "có mỗi cái rê chuột thôi
mà" là chỗ luật này bị bỏ qua nhiều nhất, và cũng là chỗ `transition-all` được viết ra.

Chuyển động không mang nghĩa là **trang trí**, và trang trí mà nhúc nhích là **nhiễu**. Mã của nó là
`MOTION-0`, và `MOTION-0` không phát ra class CSS nào.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `MOTION-0` | Không có gì đổi mà chuyển động giải thích thêm được | *không khai báo chuyển tiếp* |
| `MOTION-1` | Một vật **xuất hiện** hoặc **biến mất** khỏi cây | `transition-opacity duration-200 ease-out` · thoát `duration-100 ease-in` |
| `MOTION-2` | Vật vẫn ở đó, chỉ **đổi lớp sơn** hoặc **xoay tại chỗ** | `transition-colors duration-150 ease-out` |
| `MOTION-3` | Vật vẫn ở đó, nhưng **đổi chỗ** hoặc **đổi lượng không gian** nó chiếm | `transition-transform duration-300 ease-in-out` |
| `MOTION-4` | Đang chờ **không biết bao lâu**, không có đích để chạy tới | `animate-spin` · `animate-pulse` (vô hạn, `linear`) |
| `MOTION-5` | Người dùng đã **xin bớt chuyển động** | `motion-reduce:*` · `motion-safe:*` |

Thang thời lượng là `100 · 150 · 200 · 300`. Nó **thủng** ở `250`, `500`, `700`, `1000` một cách cố
ý: thang liền mời người ta chia đôi, còn thang thủng bắt người ta quyết định **ý nghĩa**. Không thứ
gì trong giao diện được vượt `300`, trừ vòng lặp `MOTION-4`. Thời gian trong giao diện bị chặn bởi
**sự chú ý**, không phải bởi số điểm ảnh: một bề mặt phủ kín màn hình vẫn đi hết trong `300`.

---

## `MOTION-0` — không có gì để bám theo

**Tình huống.** Giữa hai khung hình, hoặc chẳng có gì đổi về sự tồn tại và hình học, hoặc thứ đổi là
thứ người ta **đọc** chứ không **theo dõi**. Vật không cần được dẫn từ đâu tới đâu, vì nó không đi
đâu cả.

**Dấu hiệu nhận biết**

- Nội dung chữ trong một ô được thay bằng nội dung chữ khác, ô vẫn nguyên chỗ.
- Thay đổi do **hệ thống đẩy xuống**, không phải do người dùng bấm.
- Chuyển động nếu có sẽ chỉ **trì hoãn** việc đọc, chứ không giải thích thêm điều gì.
- Chuyển động được đề xuất chỉ để "cho đẹp", "cho sinh động", "cho có hồn".

**Tự hỏi.** Có ai cần bám mắt theo một vật đang di chuyển ở đây không? Nếu không — `MOTION-0`.

**Ranh giới**

- `MOTION-2`: `MOTION-2` là **phản hồi cho một hành vi của người dùng**. Người dùng rê chuột lên
  nút và nút đổi màu — đó là câu trả lời. Con số tự đổi vì máy chủ đẩy dữ liệu xuống thì không trả lời
  ai cả.
- `MOTION-3`: một hàng bị đẩy sang vị trí khác **vì người dùng vừa bấm sắp xếp** là `MOTION-3`.
  Cũng hàng đó bị đẩy đi **vì có bản ghi mới từ máy chủ** trong lúc người dùng đang đọc là `MOTION-0`:
  làm mục tiêu chạy khỏi con trỏ là lỗi nặng hơn nhảy hình.
- `MOTION-4`: một vòng quay chờ hiện ra rồi biến mất trong tích tắc đọc như **lỗi**, không đọc như
  đang làm việc. Chờ ngắn hơn ngưỡng cảm nhận thì không có vòng quay.

**Không có `duration-0`.** Không chuyển động là **trạng thái vắng mặt**, không phải một bậc mới trong
thang. Chỉ viết `transition-none` khi có một phần tử cha hoặc một biến thể khác sẽ áp chuyển động vào nếu
mình không nói gì — tức là khi cần **phủ định** một quyết định có sẵn.

**Tình huống nghiệp vụ hay gặp.** Bộ đếm cập nhật tại chỗ · dòng lỗi kiểm tra tính hợp lệ đổi nội dung trong ô đã
chừa sẵn · vòng tiêu điểm xuất hiện · bảng dữ liệu được refresh khi con trỏ đang ở trên · luồng tin thời gian
thực chèn bản ghi mới lên đầu · giá trị biểu đồ đổi theo polling · nhãn trạng thái số lượng trong giỏ hàng đổi
con số · trạng thái "đã lưu" thay chữ trong cùng một chỗ.

---

## `MOTION-1` — một vật vào hoặc rời khỏi cây

**Tình huống.** Vật **không tồn tại** ở một trong hai khung hình. Nó vừa được gắn vào DOM, hoặc sắp
bị gỡ ra. Chuyển động ở đây trả lời câu "cái này từ đâu ra" và "cái này đi đâu mất".

**Dấu hiệu nhận biết**

- Trước và sau, số phần tử trong cây **khác nhau**.
- Có một trạng thái mở/đóng, hiện/ẩn, đã gắn/chưa gắn điều khiển nó.
- Nếu bỏ hết chuyển động, vật vẫn **bật ra** đúng chỗ đó — chứ không phải trượt từ chỗ khác tới.

**Tự hỏi.** Vật này có tồn tại ở **cả hai** phía của thay đổi không? Nếu không — `MOTION-1`.

**Ranh giới**

- `MOTION-0`: nếu vật vốn đã có sẵn và chỉ đổi nội dung bên trong, nó không hề vào hay ra.
- `MOTION-2`: một dòng thông báo **luôn có mặt** và chỉ đổi màu từ xám sang đỏ là `MOTION-2`. Một
  dòng thông báo **chỉ tồn tại khi có lỗi** là `MOTION-1`.
- `MOTION-3`: khối vùng thu gọn mở ra vừa **có nội dung mới xuất hiện** (`MOTION-1`) vừa **đẩy mọi
  thứ bên dưới xuống** (`MOTION-3`). Đó là hai mã trên hai phần tử khác nhau, không phải một mã trung
  bình.

**Vào và ra không đối xứng, và đó chính là nội dung của mã này.** Vật đang tới cần được **tìm thấy**,
nên nó giảm tốc khi vào chỗ và được cho `200`. Vật đang đi thì đã bị người dùng gạt bỏ rồi, nên nó
tăng tốc rời đi và chỉ được `100`. Cho hai vế bằng nhau là cách phổ biến nhất khiến giao diện bắt đầu
thấy chậm trong khi từng con số nhìn riêng vẫn hợp lý.

**Tình huống nghiệp vụ hay gặp.** Thông báo nổi xác nhận · hộp thoại và nền mờ của nó · trình đơn thả xuống ·
cửa sổ nổi gợi ý · khung bộ lọc trên thiết bị di động · dòng mới được chèn vào giỏ hàng khi bấm thêm · biểu ngữ
thông báo sau khi lưu · chú giải · bước tiếp theo của một biểu mẫu nhiều bước · nội dung thật thay chỗ
khung chờ.

---

## `MOTION-2` — vật vẫn ở đó, chỉ đổi lớp sơn

**Tình huống.** Vật tồn tại ở cả hai khung hình, **chiếm đúng chỗ cũ, đúng kích thước cũ**, và chỉ
đổi những gì thuộc về lớp sơn: màu nền, màu chữ, viền, bóng, độ mờ của trạng thái, hoặc xoay tại chỗ
mà không xê dịch ai.

**Dấu hiệu nhận biết**

- Không có phần tử nào khác phải nhích đi vì thay đổi này.
- Thay đổi là **câu trả lời cho một hành vi**: rê chuột, tiêu điểm, nhấn giữ, chọn, vô hiệu hoá.
- Nếu chụp lại bố cục trước và sau, hai bố cục **trùng khít**.

**Tự hỏi.** Có phần tử nào khác phải dịch chuyển vì thay đổi này không? Nếu không có, và vật vẫn tồn
tại ở cả hai phía — `MOTION-2`.

**Ranh giới**

- `MOTION-1`: xem trên. Câu hỏi phân định là **tồn tại**, không phải **nhìn thấy được**.
- `MOTION-3`: mũi tên vùng thu gọn **xoay tại chỗ** là `MOTION-2` vì hộp của nó không đổi và không ai
  phải nhích. Thanh chỉ báo thẻ tab **trượt sang thẻ tab khác** là `MOTION-3` vì nó đổi chỗ trong vùng chứa.
- `MOTION-0`: vòng tiêu điểm phải hiện **ngay khung hình đó**. Người dùng bàn phím đi nhanh hơn mọi
  thời lượng, và một vòng tiêu điểm tới trễ là một vòng tiêu điểm bị mất.

**Rê chuột phải nằm trong truy vấn rê chuột.** Thiết bị cảm ứng không có trạng thái rê chuột; nếu không
chặn, một cú chạm sẽ để lại nút mắc kẹt ở khung hình đã-rê chuột cho tới khi chạm chỗ khác.

**Tình huống nghiệp vụ hay gặp.** Nút đổi nền khi rê chuột · liên kết đổi màu · thẻ nổi bóng lên khi rê
· hàng trong bảng sáng lên · nút bị vô hiệu hoá mờ đi · nhãn nhỏ bộ lọc chuyển sang trạng thái đã chọn ·
mũi tên vùng thu gọn xoay · nút gạt đổi màu rãnh · ô nhập đổi màu viền khi lỗi · nút lún nhẹ khi nhấn
giữ.

---

## `MOTION-3` — vật vẫn ở đó, nhưng đổi chỗ hoặc đổi cỡ

**Tình huống.** Vật tồn tại ở cả hai khung hình nhưng **hình học của nó đổi**: nó nằm ở vị trí khác,
hoặc nó chiếm nhiều/ít không gian hơn. Vì cả hai đầu đều nằm trên màn hình, chuyển động ở đây là thứ
duy nhất chứng minh rằng vật ở khung sau **chính là** vật ở khung trước.

**Dấu hiệu nhận biết**

- Ít nhất một phần tử khác phải nhích theo, hoặc vật tự trượt trong vùng chứa của nó.
- **Đích đã biết** ngay tại thời điểm chuyển động bắt đầu.
- Thay đổi do **người dùng chủ động gây ra**: bấm mở, kéo thả, đổi sắp xếp, thu gọn.

**Tự hỏi.** Vật này có đích đến đã biết, và người dùng có cần tin rằng nó vẫn là cùng một vật không?

**Ranh giới**

- `MOTION-2`: xem trên. Ranh giới là **bố cục**, không phải kích thước cảm giác.
- `MOTION-4`: thanh tiến trình **biết mình phải chạy tới 62%** là `MOTION-3`. Thanh tiến trình
  **không biết bao giờ xong** là `MOTION-4`. Đích đã biết hay chưa là câu hỏi duy nhất.
- `MOTION-0`: nếu chuyển động do hệ thống gây ra trong lúc người dùng đang đọc hoặc đang trỏ vào,
  đừng di chuyển gì cả.

**Cả hai đầu đều trên màn hình, nên nhịp phải đối xứng.** `ease-in-out` là đúng ở đây và sai ở
`MOTION-1`: không có đầu nào là "từ hư không tới" hay "về hư không".

**Tình huống nghiệp vụ hay gặp.** Vùng thu gọn mở/đóng đẩy nội dung bên dưới · thanh bên thu gọn · thanh
chỉ báo thẻ tab trượt · hàng đổi vị trí sau khi bấm sắp xếp · thẻ được kéo sang cột khác · thanh tiến
trình có phần trăm thật · phần đầu dính thu nhỏ khi cuộn · khung chi tiết đẩy danh sách hẹp lại · ô
nhập nở ra thành nhiều dòng khi gõ.

---

## `MOTION-4` — chờ mà không biết bao lâu

**Tình huống.** Hệ thống đang làm việc, và **không ai biết khi nào xong**. Không có đích để chạy tới,
nên không có gì để "kết thúc". Chuyển động ở đây không dẫn mắt đi đâu; nó chỉ chứng minh rằng hệ
thống **chưa chết**.

**Dấu hiệu nhận biết**

- Không có phần trăm, không có bước thứ mấy trên mấy, không có thời gian còn lại.
- Vòng lặp chạy mãi cho tới khi câu trả lời về.
- Nếu vòng lặp dừng, người dùng phải kết luận là **hỏng**, chứ không phải là **xong**.

**Tự hỏi.** Ngay lúc chuyển động bắt đầu, giá trị cuối cùng đã biết chưa? Nếu chưa — `MOTION-4`.

**Ranh giới**

- `MOTION-3`: xem trên.
- `MOTION-0`: chờ ngắn hơn ngưỡng cảm nhận thì **không có** vòng lặp. Một vòng quay hiện ra rồi
  biến mất trong nháy mắt đọc như một sự cố, không đọc như đang làm việc.

**Vòng lặp chạy `linear` và chạy vô hạn.** Mọi nhịp chuyển động đều hàm ý một điểm bắt đầu và một điểm kết
thúc, mà ở đây không có cái nào. Một vòng quay có gia tốc là một vòng quay đang nói dối rằng nó sắp
xong.

**Chuyển động không bao giờ là thông tin duy nhất.** Vòng lặp phải đi kèm một trạng thái đọc được:
một chữ, một `aria-busy`, một vùng `role="status"`. Trạng thái mà chỉ tồn tại trong hoạt ảnh là
trạng thái mà một trình duyệt đã tắt chuyển động không thể báo lại.

**Tình huống nghiệp vụ hay gặp.** Vòng quay trong nút sau khi bấm gửi · khung chờ nhấp nháy nhẹ chờ
dữ liệu · thanh tiến trình bất định khi tải tệp chưa biết dung lượng · nhãn "đang đồng bộ" · con trỏ
nhấp nháy khi câu trả lời đang được sinh dần · trạng thái đang kết nối lại của một kênh thời gian
thực · đang thanh toán, chờ cổng thanh toán trả kết quả.

---

## `MOTION-5` — người dùng đã xin bớt chuyển động

**Tình huống.** Hệ điều hành đã trả lời thay cho người dùng: `prefers-reduced-motion: reduce`. Trong
tình huống này **quyền quyết định không còn ở người thiết kế**. Đây không phải một sở thích thẩm mỹ;
với một số người, chuyển động biên độ lớn gây chóng mặt và buồn nôn thật sự.

Mã này **không** chồng lên các mã kia: đơn vị được phân loại là **một chuyển động được hiển thị dưới
một tuỳ chọn**. Dưới `no-preference`, phần tử rơi vào đúng một trong `MOTION-0`…`MOTION-4`. Dưới
`reduce`, chính phần tử đó rơi vào `MOTION-5`. Hai tình huống không bao giờ xảy ra cùng lúc, nên tập
mã vẫn đóng và loại trừ lẫn nhau.

**Dấu hiệu nhận biết**

- Chuỗi class CSS đang phát ra `transition-*` hoặc `animate-*` mà **chưa có** vế trả lời cho `reduce`.
- Chuyển động phủ vùng lớn của tầm nhìn: trượt toàn màn hình, phóng to, thị sai theo cuộn.
- Cuộn được điều khiển bằng lệnh chứ không bằng ngón tay.

**Tự hỏi.** Nếu người dùng đã tắt chuyển động, phần tử này **còn nói được điều nó đang nói không**?

**Ranh giới**

- `MOTION-0`: `MOTION-0` là **tác giả** quyết định không có chuyển động. `MOTION-5` là **người
  dùng** quyết định. Hai chuyện khác nhau, và chỉ một trong hai được ghi bằng `motion-reduce:`.
- `MOTION-1` / `MOTION-3`: dưới `reduce`, phần dịch chuyển bị bỏ, phần đổi độ mờ thường được giữ.
  Đổi độ mờ không gây chóng mặt; trượt và phóng thì có.
- `MOTION-4`: vòng lặp bị dừng **phải để lại** một chỉ báo tĩnh và một câu chữ. Bỏ vòng quay đi và
  không thay bằng gì là làm mất thông tin, không phải là hỗ trợ.

**Ba nghĩa vụ, theo thứ tự.** Thay thế trước, rút gọn sau, xoá sau cùng. Chuyển động biên độ lớn
thuần trang trí thì đi lối ngược lại: nó chỉ được **bật lên** bằng `motion-safe:`, tức là mặc định
không tồn tại.

**Không bao giờ đem nội dung ra làm điều kiện của truy vấn này.** Người xin bớt chuyển động không xin
bớt thông tin.

**Tình huống nghiệp vụ hay gặp.** Hộp thoại bỏ phần trượt, giữ phần mờ dần · vùng thu gọn nhảy thẳng
tới chiều cao cuối · thanh chỉ báo thẻ tab đổi vị trí tức thì · khung chờ bỏ nhấp nháy, giữ khối xám ·
vòng quay đổi thành chấm tĩnh kèm chữ "đang xử lý" · cuộn mượt tới neo trở thành cuộn tức thì ·
biểu ngữ đầu trang bỏ hiệu ứng thị sai.

---

## Luật

1. Phần tử nào đổi thì phần tử đó sở hữu chuyển tiếp của mình. Phần tử cha **không** làm thay con.
2. `transition-*` chỉ thuộc `MOTION-1`, `MOTION-2`, `MOTION-3`. `animate-*` vô hạn chỉ thuộc
   `MOTION-4`. `motion-reduce:` và `motion-safe:` chỉ thuộc `MOTION-5`.
3. **Cấm `transition-all`.** Nó chạy cả những thuộc tính chưa ai quyết định, kể cả thuộc tính được
   thêm vào sáu tháng sau.
4. Thời lượng lấy từ **mã**, không lấy từ quãng đường hay kích thước.
5. Nhịp chuyển động lấy từ **đầu nào nằm trên màn hình**: tới thì giảm tốc, đi thì tăng tốc, ở lại cả hai đầu
   thì đối xứng, không bao giờ kết thúc thì `linear`.
6. Chuyển động không bao giờ là thông tin duy nhất.
7. Không gì được nhấp nháy quá ba lần một giây, ở bất kỳ mã nào, dưới bất kỳ tuỳ chọn nào.
8. Mỗi chuỗi class CSS phát ra chuyển động phải mang sẵn vế `MOTION-5` của nó.
9. Nếu hai mã liền kề cùng hợp lý, chọn mã **im hơn**; chỉ hỏi khi yêu cầu bắt buộc chuyển động lớn
   hơn.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Vòng tiêu điểm.** Bản thân chỉ báo tiêu điểm là `MOTION-0`, luôn luôn. Chỉ màu nền xung quanh mới được
  là `MOTION-2`.
- **Chữ để đọc chứ không để theo dõi.** Thay chữ trong một ô là `MOTION-0`. Cross-fade giữ hai chuỗi
  chữ mờ chồng nhau trên màn hình và không mua được gì, vì không ai đang dõi theo từng con chữ.
- **Thay đổi người dùng không yêu cầu.** Chèn, sắp xếp lại hoặc đổi cỡ do hệ thống đẩy xuống trong
  lúc người dùng đang đọc hoặc đang trỏ là `MOTION-0`, không phải `MOTION-3`.
- **Chờ ngắn hơn ngưỡng cảm nhận.** Không dựng vòng lặp `MOTION-4` cho một tác vụ thường xong trước
  khi mắt kịp nhận ra.
- **Rê chuột trên thiết bị không có rê chuột.** Trạng thái con trỏ của `MOTION-2` phải nằm trong truy vấn
  rê chuột, nếu không một cú chạm sẽ để lại nút mắc kẹt ở khung đã-rê chuột.
- **`MOTION-5` thay thế chứ không xoá.** Vòng lặp bị gỡ dưới `reduce` phải để lại chỉ báo tĩnh và câu
  chữ tương ứng.
- **Khung chờ và nội dung thật.** Khung chờ là `MOTION-4`; nội dung thật thế chỗ nó là `MOTION-1`. Đó
  là hai phần tử, hai mã, không phải một hiệu ứng chung.
- **Hai mã liền kề cùng khớp.** Chọn mã im hơn. Chỉ hỏi **một** câu phân định khi bên yêu cầu nói rõ
  họ cần chuyển động lớn hơn.
