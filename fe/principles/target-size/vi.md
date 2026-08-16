---
id: fe-principles-target-size-vi
title: vi.md
slug: /fe/principles/target-size/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống TARGET-N, nhận diện bằng số đo và hành vi chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `target-size`

# Kích thước mục tiêu

Mục tiêu là **vùng nhận cú chạm**, không phải hình được vẽ ra. Hai thứ đó là hai hình chữ nhật khác
nhau, và luật này chỉ ràng buộc cái thứ hai.

Đừng hỏi "nút này trông có đủ to không". Hãy hỏi:

> Ngón tay đặt xuống đây thì vùng nào nhận, và vùng đó rộng bao nhiêu điểm ảnh?

Câu trả lời là một con số đo được. Nó không đổi khi thiết kế gọn hơn, không đổi khi biểu tượng nhỏ đi, và
không đổi khi ai đó thấy giao diện "đã cân đối rồi".

| Nguồn | Sàn |
|---|---|
| WCAG 2.5.5 Kích thước mục tiêu (Enhanced) — AAA | 44 × 44 CSS px |
| WCAG 2.5.8 Kích thước mục tiêu (Minimum) — AA | 24 × 24 CSS px |
| Apple Human Interface Guidelines | 44 × 44 pt |
| Chất liệu Thiết kế | 48 × 48 dp |

**Sàn của mô-đun này là 44 × 44 CSS px, đo trên vùng chạm.** Con số 24 không phải một lựa chọn nhỏ
hơn, nó là mức chặn pháp lý: từ 24 đến 43 là **lỗi bộ quy tắc**, dưới 24 là **lỗi tuân thủ**. Khi báo
cáo phải nói rõ đang ở mức nào, vì hai mức đó được xếp lịch sửa khác nhau.

**Đây là luật bắt buộc.** Bất cứ thứ gì nhận cú chạm đều rơi vào đúng một mã dưới đây. Không có
thành phần điều khiển nào nhỏ tới mức được miễn: dấu X 16 px ở góc một phần tử chồng lớp là `TARGET-2`, đúng cùng một lý do
mà nút gửi biểu mẫu là `TARGET-1`. Câu "có mỗi cái biểu tượng bé tí thôi mà" là chỗ luật này bị bỏ qua nhiều
nhất — và cũng đúng là chỗ khó bấm nhất.

**Hai trục.** `TARGET-0`, `TARGET-1`, `TARGET-2`, `TARGET-4`, `TARGET-5` phân loại **một mục tiêu**.
`TARGET-3` phân loại **cái khoảng cách giữa các phần tử giữa hai mục tiêu kề nhau**. Ba nút trên một thanh công cụ mang ba mã mục tiêu
và hai mã khoảng cách giữa các phần tử. Làm đúng kích thước không trả lời được câu hỏi khoảng cách, và ngược lại.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `TARGET-0` | Không có gì ở đây nhận cú chạm — chữ, số, ảnh, nhãn trạng thái trạng thái | *không khai báo* |
| `TARGET-1` | Thành phần điều khiển bình thường; hình vẽ tự gánh sàn 44 | `min-h-11 min-w-11` |
| `TARGET-2` | Hình vẽ buộc phải nhỏ; nới vùng chạm quanh nó mà **không** vẽ lại | `relative after:absolute after:-inset-2.5 after:content-['']` |
| `TARGET-3` | Hai mục tiêu kề nhau; khoảng cách giữa hai vùng chạm | `gap-2` |
| `TARGET-4` | Mục tiêu nằm trong một câu chữ, cỡ do dòng chữ quyết định | *không khai báo* |
| `TARGET-5` | Vị trí chính là thông tin, và có thành phần điều khiển tương đương đủ cỡ gánh cùng chức năng | *không khai báo ở đây* |

---

## `TARGET-0` — không có mục tiêu

**Tình huống.** Không có gì trong vùng này nhận cú chạm. Nó chỉ được đọc, được nhìn, được sao chép
bằng thao tác của trình duyệt.

**Dấu hiệu nhận biết**

- Không có `onClick`, `href`, `type="button"`, `role` tương tác, không nhận `Enter`/`Space`.
- Bỏ chuột và bàn phím đi thì không mất chức năng nào.
- Con trỏ không đổi vì tác giả đặt `cursor-pointer`, mà vì trình duyệt không đổi gì cả.

**Tự hỏi.** Nếu người dùng bấm đúng vào giữa nó, có chuyện gì xảy ra không?

**Ranh giới**

- `TARGET-1`: một ảnh đại diện chỉ để hiển thị là `TARGET-0`; đúng ảnh đại diện đó gắn `onClick` mở hồ sơ thì
  lập tức là `TARGET-1`, dù không có một điểm ảnh nào đổi.
- `TARGET-4`: một đoạn văn không có liên kết là `TARGET-0`; đoạn văn có liên kết thì bản thân đoạn văn vẫn
  `TARGET-0`, còn cái liên kết bên trong là `TARGET-4`.

**Không tồn tại "mục tiêu nhỏ vì nó chỉ trang trí".** Nếu nó nhận cú chạm thì nó không trang trí. Nếu
nó không nhận cú chạm thì nó không cần sàn. Không có ô thứ ba.

**Tình huống nghiệp vụ hay gặp.** Đoạn mô tả · số liệu trong thẻ thống kê · nhãn trạng thái trạng thái đơn hàng ·
ảnh đại diện trong danh sách chỉ để nhận diện · biểu tượng đứng trước một dòng chữ · ảnh minh hoạ · nhãn đơn vị ·
dấu chấm màu chỉ trạng thái · mốc thời gian · tiêu đề phần nội dung.

---

## `TARGET-1` — hình vẽ tự gánh sàn

**Tình huống.** Thành phần điều khiển nhận cú chạm và **được phép** vẽ đủ lớn. Không có ràng buộc thiết kế nào bắt
nó phải nhỏ hơn 44, nên nó tự gánh sàn bằng chính hộp của mình.

**Dấu hiệu nhận biết**

- Nó là nút, liên kết điều hướng, thẻ tab, ô chọn, hàng danh sách bấm được, thẻ bấm được.
- Không ai yêu cầu hình vẽ phải nhỏ; nó nhỏ chỉ vì chưa ai đặt sàn.
- Đặt `min-h-11 min-w-11` vào không làm hỏng bố cục xung quanh.

**Tự hỏi.** Có ràng buộc thiết kế thật nào cấm hình vẽ này chạm mốc 44 không? Nếu không có —
`TARGET-1`.

**Ranh giới**

- `TARGET-2`: `TARGET-1` là **được phép to ra**; `TARGET-2` là **buộc phải nhỏ**. Cùng một dấu X,
  đứng một mình trong phần tử chồng lớp thì là `TARGET-1`, nằm trong một nhãn nhỏ cao 24 px thì là `TARGET-2`.
- `TARGET-4`: liên kết trong một câu là `TARGET-4`; đúng chữ đó đứng riêng một dòng dưới đoạn văn là
  `TARGET-1`.
- `TARGET-0`: xem trên.

**24 không phải một mã khác.** Một thành phần điều khiển cao 24 px vẫn là `TARGET-1` — nó chỉ là `TARGET-1` **đang
sai**. Đừng đặt tên riêng cho một trạng thái hỏng; đặt tên riêng là cách nó sống sót qua đánh giá.

**Ngoại lệ người dùng tác nhân.** Hộp kiểm, nút chọn, tệp ô nhập liệu hay ô chọn **chưa bị tác giả đụng vào kích
thước** đã được trình duyệt gánh sàn, nên không phát ra class CSS. Chạm vào `w-`, `h-`, `p-`,
`appearance` hay `scale` một cái là ngoại lệ mất hiệu lực ngay lập tức.

**Tình huống nghiệp vụ hay gặp.** Nút gửi biểu mẫu · nút phụ Huỷ · nút biểu tượng trên thanh công cụ · thẻ tab · mục
điều hướng trong thanh bên · hàng trong danh sách thông báo bấm được · thẻ khoá học bấm được · nút
phân trang · nút tăng giảm số lượng · nút chuyển ngôn ngữ · nút mở trình đơn tài khoản.

---

## `TARGET-2` — hình vẽ nhỏ, vùng chạm nới ra

**Tình huống.** Thiết kế buộc hình vẽ phải nhỏ — vì nó nằm trong một hàng dày đặc, trong một nhãn nhỏ,
trong một góc — nhưng vùng chạm vẫn phải đủ 44. Vùng chạm được nới ra quanh hình vẽ, và hình vẽ
**không đổi một điểm ảnh nào**.

**Dấu hiệu nhận biết**

- Hình vẽ dưới 44 vì một lý do thật, nói ra được: mật độ hàng, chiều cao nhãn nhỏ, kích thước biểu tượng quy ước.
- Nới hình vẽ ra 44 sẽ làm vỡ bố cục xung quanh hoặc phá tương quan thị giác đã chốt.
- Sau khi nới vùng chạm, ảnh chụp màn hình **không khác gì** trước đó.

**Tự hỏi.** Nếu tăng hình vẽ này lên 44, có thứ gì khác trên màn hình phải vẽ lại không? Nếu có —
`TARGET-2`.

**Ranh giới**

- `TARGET-1`: xem trên. Không có ràng buộc thật thì đừng chọn `TARGET-2`; nới vùng chạm khi lẽ ra
  chỉ cần vẽ to hơn là tạo ra một vùng bấm vô hình mà không ai nhìn thấy để tránh.
- `TARGET-5`: `TARGET-2` nới được vì quanh hình vẽ **còn chỗ trống**. Khi các mục tiêu sát nhau tới
  mức nới ra là chồng lên nhau, đó không còn là `TARGET-2` nữa.
- `TARGET-3`: nới vùng chạm ăn vào khoảng cách giữa các phần tử. Hai mã này luôn phải tính cùng nhau, không bao giờ tính
  riêng.

**Vùng nới không được tham gia bố cục.** Cách duy nhất được chấp nhận là một giả-phần tử phủ ra
ngoài. `-m-2.5 p-2.5` bị cấm: lề ngoài âm trừ thẳng vào `gap`, nên nó vừa nới vùng chạm vừa bí mật kéo
khoảng cách giữa các phần tử ngắn lại — sửa một luật bằng cách phá luật kia.

**Tình huống nghiệp vụ hay gặp.** Dấu X đóng phần tử chồng lớp · nút xoá trong một hàng dày · dấu X trên nhãn nhỏ
lọc · hộp kiểm vẽ theo thiết kế 20 px · nút sao chép cạnh một đoạn mã · nút ba chấm cuối hàng bảng ·
biểu tượng xoá tệp đính kèm · nút bật tắt mật khẩu trong ô nhập · nút xoá một dòng trong giỏ hàng.

---

## `TARGET-3` — khoảng cách giữa hai vùng chạm

**Tình huống.** Hai mục tiêu đứng cạnh nhau. Câu hỏi không còn là mỗi cái to bao nhiêu, mà là **chạm
trượt một cái thì có trúng cái kia không**.

**Dấu hiệu nhận biết**

- Hai mục tiêu là hai hành động khác nhau, và một trong hai là hành động khó hoàn tác.
- Ít nhất một bên nhỏ hơn 44 theo trục kề nhau, tức là đang sống nhờ `TARGET-2`.
- Hai vùng chạm đã nới ra và bắt đầu chạm vào nhau.

**Tự hỏi.** Hai vùng chạm cách nhau bao nhiêu điểm ảnh — không phải hai hình vẽ, mà hai vùng chạm?

**Ranh giới**

- mọi mã mục tiêu: `TARGET-3` không nằm cùng trục. Nó không thay thế được mã kích thước, và mã kích
  thước không thay thế được nó.
- ngoại lệ mặt liền: hai bên đều đủ 44 theo trục kề nhau thì **không** phát ra class CSS. Segmented
  thành phần điều khiển, cụm tăng/giảm số lượng và danh sách hàng bấm được xếp chồng là đúng khi hai vùng chạm dính
  nhau, vì tâm của mỗi mục tiêu đã cách khoảng cách giữa các phần tử nửa mục tiêu rồi.

**Số học của khoảng cách giữa các phần tử khi có `TARGET-2`.** Vùng nới không tham gia bố cục, nên `gap` đo trên **hình vẽ**
chứ không đo trên vùng chạm. Muốn hai vùng chạm cách nhau 8 px thì khoảng cách giữa các phần tử giữa hai hình vẽ phải là
`2 × inset + 8`. Hai biểu tượng 24 px nới bằng `-inset-2.5` cần khoảng cách giữa các phần tử 28 px, không phải 8.

**Tình huống nghiệp vụ hay gặp.** Huỷ cạnh Xoá · Lưu cạnh Xoá bản nháp · nhóm biểu tượng thanh công cụ · nhãn nhỏ lọc
xếp hàng ngang · nút thích cạnh nút chia sẻ cạnh nút lưu · phân trang nhiều số · nút sửa cạnh nút xoá
cuối hàng bảng · nút đóng cạnh nút phóng to trong nội dung đa phương tiện trình xem.

---

## `TARGET-4` — mục tiêu nằm trong câu chữ

**Tình huống.** Mục tiêu là một đoạn chữ nằm **trong dòng chảy của một câu**. Cỡ của nó do dòng-chiều cao
của phần chữ không phải mục tiêu quyết định, và tác giả không có quyền quyết định điều đó mà không phá
đoạn văn.

**Dấu hiệu nhận biết**

- Nó nằm giữa các từ khác, cùng một dòng chảy văn bản.
- Nó tự xuống dòng theo chiều rộng của đoạn văn.
- Làm nó cao 44 sẽ làm giãn dòng chữ quanh nó.

**Tự hỏi.** Nếu bỏ mục tiêu này ra, phần chữ còn lại có còn là một câu hoàn chỉnh không? Nếu còn — nó
đang nằm trong câu, `TARGET-4`.

**Ranh giới**

- `TARGET-1`: "Xem thêm" đứng riêng một dòng, một liên kết trong trình đơn điều hướng, một nhãn nhỏ, một liên kết
  đứng một mình trong ô bảng — **không** cái nào nằm trong câu. Tất cả là `TARGET-1`.
- `TARGET-0`: đoạn văn chứa liên kết vẫn là `TARGET-0`; chỉ cái liên kết là `TARGET-4`.

**Ngoại lệ này treo luôn cả `TARGET-3`.** Hai liên kết nội tuyến cạnh nhau không mang nghĩa vụ khoảng cách giữa các phần tử, vì chỗ
chúng rơi xuống là do ngắt dòng quyết định. Một luật mà tác giả không thể thoả mãn là một luật sẽ bị
bỏ qua ở cả những chỗ khác.

**Tình huống nghiệp vụ hay gặp.** Liên kết điều khoản trong câu đồng ý · liên kết tài liệu trong một đoạn
hướng dẫn · chú thích đánh số trên cao · tên người trong một dòng hoạt động · hashtag trong nội dung
bài viết · liên kết "khoá học này" trong mô tả · liên kết thư điện tử trong đoạn liên hệ.

---

## `TARGET-5` — vị trí chính là thông tin

**Tình huống.** Mục tiêu nhỏ vì **toạ độ của nó mang nghĩa**. Đẩy nó to ra hoặc nới vùng chạm là làm
sai dữ liệu, hoặc là chồng vùng chạm của nó lên hàng xóm. Bù lại, phải có một thành phần điều khiển **đủ cỡ, cùng
chức năng, trên cùng màn hình**.

**Dấu hiệu nhận biết**

- Di chuyển mục tiêu 10 px là nói sai một sự thật: sai vị trí trên bản đồ, sai ghế, sai giá trị trên trục.
- Các mục tiêu cùng loại nằm sát nhau ở mật độ do dữ liệu quyết định, không do thiết kế quyết định.
- Có sẵn hoặc dựng được một danh sách, một ô nhập, một cụm nút đi từng bước làm đúng việc đó.

**Tự hỏi.** Nếu dời mục tiêu này ra chỗ dễ bấm hơn, có thông tin nào trở thành sai không?

**Ranh giới**

- `TARGET-2`: `TARGET-2` là hình vẽ nhỏ vì thẩm mỹ hoặc mật độ **do thiết kế chọn**, và quanh nó còn
  chỗ để nới. `TARGET-5` là mật độ **do dữ liệu áp đặt**, và không còn chỗ.
- `TARGET-1`: thanh công cụ chật, thanh bên hẹp, "nhiều nút quá không đủ chỗ" **không** phải `TARGET-5`.
  Đó là `TARGET-1` chưa sửa, và cách sửa là bớt nút hoặc đổi bố cục.

**Không có thành phần điều khiển tương đương thì không có mã này.** Mật độ bắt buộc mà thiếu đường đi thay thế
không phải một ngoại lệ, nó là một lỗi `TARGET-1` chưa ai chịu trách nhiệm. Đây là chỗ mã này hay bị
dùng để hợp thức hoá nhất.

**Tình huống nghiệp vụ hay gặp.** Ghim trên bản đồ · sơ đồ chỗ ngồi · điểm dữ liệu trên biểu đồ · tay
kéo đổi kích thước trên vùng vẽ · điểm neo trên dòng thời gian · vùng nóng trên ảnh sơ đồ · dải chọn màu ·
đầu kéo trên thanh tua video · nút DOM trên sơ đồ quan hệ.

---

## Luật

1. Đo trên **vùng chạm**, không đo trên hình vẽ, không đo trên hình dạng ký tự, không đo trên chữ nhãn.
2. Sàn là **44 × 44 CSS px**. Từ 24 đến 43 là lỗi bộ quy tắc; dưới 24 còn là lỗi tuân thủ và phải được
   gọi đúng tên đó.
3. Nới vùng chạm **không** được đổi hình vẽ: không dời, không đổi cỡ, không đổi bo góc, không đổi
   vòng tiêu điểm.
4. Hai vùng chạm đã nới **không** được chồng lên nhau.
5. Mỗi mục tiêu mang đúng một mã mục tiêu; mỗi cặp mục tiêu kề nhau mang đúng một mã khoảng cách giữa các phần tử.
6. Trạng thái bị vô hiệu hoá, đang tải, lỗi giữ nguyên mã của trạng thái mà nó thay thế.
7. `cursor-pointer`, hiệu ứng rê chuột, đổ bóng **không** phải bằng chứng của một mục tiêu. Nhận activation
   mới là.
8. Khi hai mã cùng khớp, chọn mã **phát ra class CSS**. Ngoại lệ chỉ được lấy khi điều kiện của chính nó
   đã được chứng minh.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Người dùng tác nhân.** Thành phần điều khiển chưa bị tác giả sửa kích thước là `TARGET-1` đã được trình duyệt gánh sàn,
  không phát ra class CSS. Đụng vào kích thước là mất ngoại lệ ngay.
- **Mặt liền.** `TARGET-3` không phát ra class CSS khi **cả hai** bên đạt 44 theo trục kề nhau. Bộ bước,
  nhóm nút phân đoạn, danh sách hàng xếp chồng có đường phân cách là đúng khi hai vùng chạm dính nhau.
- **Nội tuyến treo khoảng cách giữa các phần tử.** Mục tiêu `TARGET-4` không mang nghĩa vụ `TARGET-3` với các mục tiêu khác trong
  cùng đoạn văn.
- **Mật độ bắt buộc cần bạn đồng hành.** `TARGET-5` chỉ có hiệu lực khi thành phần điều khiển tương đương thật sự
  tồn tại trên cùng màn hình đó.
- **Tính đồng nhất trạng thái.** Khung chờ mang đúng mã của thành phần điều khiển mà nó thay chỗ. Thành phần điều khiển co lại khi đang tải
  là đổi kích thước mục tiêu đúng lúc người dùng có khả năng bấm lại cao nhất.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi vai trò của thành phần điều khiển thật sự đổi. Màn hình hẹp đi **không** phải lý do
  hạ sàn — trên màn hình hẹp thì thiết bị chạm mới là thiết bị chính.
