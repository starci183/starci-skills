---
id: fe-principles-colour-vi
title: vi.md
slug: /fe/principles/colour/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống COLOUR-N, nhận diện bằng nghiệp vụ chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `colour`

# Màu sắc

Màu nói **ý nghĩa** của một phần tử, không nói sở thích của người viết mã. Chọn màu từ **vai trò
nghiệp vụ** mà phần tử đang đóng: nội dung, tương tác, trạng thái, bề mặt, hay ranh giới.

Trước khi gõ một class CSS màu, hãy hỏi:

> Nếu bỏ hết màu đi, câu chuyện này còn đọc được không?

Nếu không còn — nghĩa là ý nghĩa chưa bao giờ được mã hoá, nó chỉ đang được **gợi ý** bằng sắc độ.
Người dùng mù màu, màn hình đen trắng, chế độ forced-màu sắc và ảnh chụp in ra giấy đều sẽ đọc sai.

**Đây là luật bắt buộc.** Mọi phần tử được hiển thị đều rơi vào đúng một mã dưới đây. Không có phần tử
nào nhỏ đến mức được miễn: một dòng thời gian dưới tiêu đề là `COLOUR-2`, đúng cùng một lý do mà một
dòng "Thanh toán thất bại" là `COLOUR-6`. Câu "có mỗi mấy chữ xám thôi mà" là chỗ luật này bị bỏ qua
nhiều nhất.

**Một phần tử, một vai trò.** Mã bề mặt phát ra cặp nền-và-chữ của nó rồi dừng lại; mọi vai trò khác
— trạng thái, tương tác, trạng thái chọn — thuộc về phần tử **con**. Các mã **lồng** vào nhau chứ không gộp
lên cùng một nút DOM.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `COLOUR-1` | Nội dung chính — câu mang quyết định | `text-foreground` |
| `COLOUR-2` | Nội dung hỗ trợ, siêu dữ liệu, xuất xứ | `text-muted-foreground` |
| `COLOUR-3` | Đích tương tác hoặc mục đang được chọn | `text-primary` (vùng chọn: `bg-primary/10 text-primary`) |
| `COLOUR-4` | Một kết quả đã hoàn tất thành công | `text-success` + dấu hiệu ngoài màu |
| `COLOUR-5` | Rủi ro còn cứu được, chưa hỏng | `text-warning` + dấu hiệu ngoài màu |
| `COLOUR-6` | Thất bại, dữ liệu không hợp lệ, hành động phá huỷ | `text-danger` / `border-danger` + thông điệp |
| `COLOUR-7` | Tiêu điểm bàn phím | `focus-visible:ring-2 focus-visible:ring-ring` |
| `COLOUR-8` | Thành phần điều khiển bị vô hiệu hoá | `text-muted-foreground opacity-50` |
| `COLOUR-9` | Mặt phẳng gốc của trang | `bg-background text-foreground` |
| `COLOUR-10` | Bề mặt nổi lên trên nền trang | `bg-card text-foreground` |
| `COLOUR-11` | Vùng nhóm nhẹ bên trong một bề mặt | `bg-muted text-foreground` |
| `COLOUR-12` | Đường ranh trung tính | `border-border` |
| `COLOUR-13` | Các hạng mục dữ liệu độc lập | bảng màu phân loại có thứ tự + nhãn |
| `COLOUR-14` | Tác phẩm đồ hoạ thương hiệu | bảng màu thương hiệu đã duyệt |
| `COLOUR-15` | Chữ nằm trên ảnh | phần tử chồng lớp chọn theo độ tương phản |

Số thứ tự là **thứ tự người đọc gặp**, không phải một thang. `COLOUR-8` không "lớn hơn" `COLOUR-4`,
và giữa `COLOUR-2` với `COLOUR-3` không có gì để chia đôi. Mô-đun này không có thang số nào cả.

---

## `COLOUR-1` — nội dung chính

**Tình huống.** Đây là câu mà người dùng phải đọc để ra quyết định: tên khoá học, số tiền phải trả,
nội dung câu hỏi, tên người gửi. Bỏ nó đi thì màn hình mất lý do tồn tại.

**Dấu hiệu nhận biết**

- Nếu chỉ được đọc **một** dòng trên màn hình này, người dùng sẽ đọc dòng đó.
- Nó không phụ thuộc vào một dòng nào khác để có nghĩa.
- Nó không mang trạng thái thành công / cảnh báo / nguy hiểm nào.
- Nó là mặc định an toàn: chưa xác lập được vai trò nào khác thì dùng mã này.

**Tự hỏi.** Câu này có tự đứng được và có mang quyết định của màn hình không?

**Ranh giới**

- `COLOUR-2`: `COLOUR-1` mang quyết định; `COLOUR-2` **giải thích** cho một `COLOUR-1` đang có mặt.
  Nếu quanh đó không có nội dung chính nào để hỗ trợ, thì nó không phải nội dung hỗ trợ.
- `COLOUR-3`: chữ tĩnh không bấm được thì không bao giờ là `COLOUR-3`, dù muốn nó nổi bật đến đâu.
- `COLOUR-4/5/6`: chỉ đổi mã khi **dữ liệu** thật sự mang trạng thái, không phải khi nội dung nghe
  có vẻ tích cực hay tiêu cực.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề khoá học · nội dung câu hỏi · tên người gửi trong hộp thư ·
số tiền của một hoá đơn · tên tệp · nội dung một bình luận · nhãn của một trường nhập liệu · câu hướng dẫn bắt
buộc phải làm theo · tên sản phẩm trong giỏ hàng.

---

## `COLOUR-2` — nội dung hỗ trợ

**Tình huống.** Nội dung vẫn có ích nhưng **không dẫn nhịp đọc**: nó nói thêm về một nội dung chính
đang đứng ngay cạnh. Xoá đi thì màn hình vẫn dùng được, chỉ kém rõ.

**Dấu hiệu nhận biết**

- Nó trả lời "khi nào", "bao nhiêu cái", "từ đâu ra", "loại gì" cho một nội dung chính.
- Có một `COLOUR-1` rõ ràng ở gần để nó bám vào.
- Nó không chứa mệnh lệnh, không chứa điều kiện quyết định.

**Tự hỏi.** Nếu người dùng bỏ qua dòng này, họ có mất một thông tin bắt buộc để hành động không? Nếu
không — `COLOUR-2`.

**Ranh giới**

- `COLOUR-1`: câu mang **chỉ dẫn hoặc điều kiện chính** thì không được làm mờ. "Hoàn tiền trong 7
  ngày kể từ ngày mua" là điều kiện, không phải chú thích.
- `COLOUR-8`: giảm nhấn là **cấp bậc đọc**; bị vô hiệu hoá là **trạng thái tương tác**. Chữ mờ vẫn đọc và vẫn
  bấm được; thành phần điều khiển bị vô hiệu hoá thì không bấm được và phải có thuộc tính nói ra điều đó.
- `COLOUR-11`: muốn nhóm nội dung lại thì đó là việc của nền (`bg-muted`), không phải của chữ.

**Tình huống nghiệp vụ hay gặp.** Thời gian cập nhật · "12 chương · 36 bài" · tên tác giả dưới bài
viết · đơn vị đo · văn bản gợi ý đã được thay bằng nội dung mô tả · đường dẫn phân cấp đã đi qua · dung lượng
tệp · số lượt xem · dòng "còn 3 chỗ" mang tính tham khảo.

---

## `COLOUR-3` — tương tác và mục đang chọn

**Tình huống.** Phần tử **có thể bấm/đi tới**, hoặc đang là **mục hiện tại** trong một tập lựa chọn.
Màu ở đây nói "chỗ này hành động được" hoặc "bạn đang ở đây".

**Dấu hiệu nhận biết**

- Có `href`, có `onClick`, hoặc có `aria-current` / `aria-selected`.
- Bỏ màu đi thì người dùng không biết còn chỗ nào để bấm.
- Trạng thái trạng thái chọn **tồn tại lâu**, không biến mất khi chuột rời đi.

**Tự hỏi.** Phần tử này dẫn tới một hành động, hay đang khai báo vị trí hiện tại của người dùng?

**Ranh giới**

- `COLOUR-1`: đây là ranh giới bị vi phạm nhiều nhất. Tô chính cho một tiêu đề tĩnh để nó "quan
  trọng hơn" là **sai**: cấp bậc đọc do kiểu chữ quyết định.
- `COLOUR-7`: trạng thái chọn là **trạng thái dữ liệu**, tiêu điểm là **vị trí bàn phím**. Một hàng đang chọn
  vẫn đang chọn khi tiêu điểm đã đi chỗ khác, nên hai thứ phải nhìn ra được cùng lúc.
- rê chuột: rê chuột là tạm thời và **không được** trông giống trạng thái chọn. Một mục rê chuột xong rồi thôi thì
  không có gì được ghi nhớ.
- `COLOUR-4`: nút "Xác nhận" không phải màu thành công. Nó là hành động, chưa phải kết quả.

**Tình huống nghiệp vụ hay gặp.** Liên kết trong nội dung · mục điều hướng đang mở · thẻ tab đang chọn · hàng đang
chọn trong danh sách · nút hành động chính · bước hiện tại của một trình hướng dẫn · nhãn nhỏ bộ lọc đang bật ·
"Xem tất cả" cuối một phần nội dung.

---

## `COLOUR-4` — kết quả thành công

**Tình huống.** Một việc đã **thật sự hoàn tất**, và hệ thống biết điều đó. Không phải "nội dung nghe
có vẻ vui".

**Dấu hiệu nhận biết**

- Có một sự kiện đã xảy ra: đã thanh toán, đã publish, đã nộp, đã đồng bộ.
- Có một trường nhập liệu trạng thái trong dữ liệu để trỏ vào.
- Kèm được một chữ hoặc một biểu tượng nói ra chính trạng thái đó.

**Tự hỏi.** Trong dữ liệu có một trạng thái tên là "thành công/hoàn tất" để mã này trỏ vào không?

**Ranh giới**

- `COLOUR-1`: một con số đẹp, một mức giảm giá, một lời khen — đều **không** phải thành công. Đó là
  nội dung, không phải trạng thái.
- `COLOUR-3`: nút gây ra thành công là tương tác; chỉ **kết quả** mới là `COLOUR-4`.
- `COLOUR-5`: nếu việc đã xong nhưng còn hạn chót phía sau, hai điều đó là **hai** phần tử với hai
  mã, không phải một màu trung gian.

**Tình huống nghiệp vụ hay gặp.** "Đã thanh toán" · "Đã xuất bản" · "Đã nộp bài" · "Đã xác minh
thư điện tử" · "Đồng bộ thành công" · nhãn trạng thái hoàn thành của một chương · kết quả kiểm tra đạt.

---

## `COLOUR-5` — cảnh báo còn cứu được

**Tình huống.** Chưa có gì hỏng, nhưng nếu người dùng **không làm gì** thì sẽ hỏng. Luôn có một hành
động phòng ngừa đi kèm.

**Dấu hiệu nhận biết**

- Có một mốc thời gian hoặc một ngưỡng đang tiến tới.
- Người dùng vẫn còn cách để tránh hậu quả.
- Nội dung hiện tại vẫn hợp lệ, chỉ là sắp không còn hợp lệ.

**Tự hỏi.** Việc này **đã** hỏng chưa, hay chỉ **sắp** hỏng nếu không ai can thiệp?

**Ranh giới**

- `COLOUR-6`: "Thẻ hết hạn sau 3 ngày" là `COLOUR-5`; "Thẻ đã hết hạn" là `COLOUR-6`. Ranh giới là
  thì của động từ, và nó nằm trong dữ liệu chứ không nằm ở cảm giác khẩn cấp.
- `COLOUR-2`: một ghi chú trung tính không phải cảnh báo. Chỉ dùng cảnh báo khi **có hậu quả** nếu bỏ
  qua.

**Tình huống nghiệp vụ hay gặp.** "Gói cước hết hạn sau 3 ngày" · "Còn 2 chỗ trống" khi sắp hết ·
"Bản nháp chưa lưu" · "Dung lượng đã dùng 90%" · "Chưa bật xác thực hai lớp" · "Phiên đăng nhập sắp
hết hạn".

---

## `COLOUR-6` — thất bại và hành động phá huỷ

**Tình huống.** Một trong ba việc: một thao tác **đã** thất bại, một dữ liệu **đang** không hợp lệ,
hoặc một hành động **sẽ** phá huỷ thứ gì đó không lấy lại được.

**Dấu hiệu nhận biết**

- Có một lỗi thật để hiển thị, kèm lý do đọc được.
- Hoặc trường nhập liệu đang ở trạng thái `aria-invalid` sau khi đã kiểm tra tính hợp lệ.
- Hoặc nút sẽ xoá, huỷ, thu hồi, chấm dứt.

**Tự hỏi.** Có một thất bại đã xảy ra, hay một mất mát không hoàn tác được sắp xảy ra?

**Ranh giới**

- `COLOUR-5`: xem trên — đã hỏng so với sắp hỏng.
- `COLOUR-2`: **trường nhập liệu bắt buộc mà chưa nhập** thì chưa phải lỗi. Tô đỏ một biểu mẫu ngay khi vừa mở là
  nói dối về trạng thái.
- `COLOUR-3`: nút "Xoá tài khoản" mang cả hai vai trò — nó là hành động **và** là phá huỷ. Vai trò
  phá huỷ thắng, vì hậu quả của việc đọc nhầm lớn hơn.

**Đường viền không đủ.** Viền đỏ nói "có gì đó sai" nhưng không nói **sai cái gì**. Luôn giữ một thông
điệp nhìn thấy được.

**Tình huống nghiệp vụ hay gặp.** "Thanh toán thất bại" · thư điện tử sai định dạng sau khi gửi · "Không
tải được dữ liệu" · nút xoá vĩnh viễn · "Mật khẩu không khớp" · hạn nộp đã quá · "Đã bị từ chối".

---

## `COLOUR-7` — tiêu điểm bàn phím

**Tình huống.** Bàn phím đang đứng ở đâu. Đây là thông tin **của thiết bị nhập**, không phải của dữ
liệu.

**Dấu hiệu nhận biết**

- Chỉ xuất hiện khi điều hướng bằng bàn phím (`focus-visible`).
- Di chuyển liên tục khi bấm Thẻ tab; không có gì được ghi nhớ.
- Phải nhìn thấy trên **mọi** bề mặt, kể cả khi phần tử đang được chọn.

**Tự hỏi.** Thứ này biến mất khi người dùng bấm Thẻ tab đi chỗ khác đúng không? Nếu đúng — đó là tiêu điểm,
không phải trạng thái chọn.

**Ranh giới**

- `COLOUR-3`: trạng thái chọn còn lại sau khi tiêu điểm rời đi. Nếu chỉ có một trong hai được nhìn thấy, người
  dùng bàn phím sẽ lạc.
- rê chuột: rê chuột không thay được tiêu điểm. Chuột và bàn phím là hai đường vào khác nhau.

**Không được xoá.** Bỏ `outline` mà không thay bằng vòng là gỡ mất đường đi duy nhất của người dùng
bàn phím.

**Tình huống nghiệp vụ hay gặp.** Ô nhập liệu trong biểu mẫu · nút · liên kết · hàng bấm được trong danh sách · thẻ tab ·
phần tử trong lệnh trình đơn · hộp kiểm và nút chọn.

---

## `COLOUR-8` — bị vô hiệu hoá

**Tình huống.** Thành phần điều khiển **có mặt** nhưng **chưa dùng được**, vì một điều kiện nghiệp vụ chưa thoả.

**Dấu hiệu nhận biết**

- Có thuộc tính `disabled` hoặc `aria-disabled` thật, không chỉ là màu nhạt.
- Có một lý do nghiệp vụ nói được thành lời: chưa chọn xong, chưa đủ quyền, đang xử lý.
- Bấm vào không xảy ra gì cả.

**Tự hỏi.** Có một điều kiện nghiệp vụ cụ thể khiến thành phần điều khiển này chưa dùng được không, và điều kiện đó
đã được nói ra ở đâu chưa?

**Ranh giới**

- `COLOUR-2`: đây là ranh giới nguy hiểm nhất của mô-đun, vì **hai mã dùng chung biến thiết kế**. Chỉ
  `opacity-50` **cộng với** trạng thái bị vô hiệu hoá thật mới tách được chúng. Chữ mô tả bị làm mờ thêm
  `opacity-50` sẽ bị đọc thành "hỏng", và nút bị vô hiệu hoá thiếu `opacity-50` sẽ bị bấm hoài không hiểu.
- `COLOUR-6`: bị vô hiệu hoá **không** phải lỗi. Không tô đỏ một nút chỉ vì chưa bấm được.

**Tình huống nghiệp vụ hay gặp.** Nút gửi khi biểu mẫu chưa hợp lệ · "Bước tiếp theo" khi chưa chọn xong ·
tính năng ngoài gói cước · nút đang gửi · lựa chọn đã hết hàng · hành động thiếu quyền.

---

## `COLOUR-9` — mặt phẳng gốc

**Tình huống.** Nền của cả trang. Mọi thứ khác nằm **trên** nó.

**Dấu hiệu nhận biết**

- Không có bề mặt nào phía dưới nó nữa.
- Nó là chỗ chủ đề quyết định "sáng hay tối".

**Tự hỏi.** Bên dưới phần tử này còn bề mặt nào nữa không? Nếu không — `COLOUR-9`.

**Ranh giới**

- `COLOUR-10`: nền trang **không** được viết bằng `bg-card`. Nếu mọi thứ đều là thẻ thì không còn
  gì nổi lên được nữa.

**Tình huống nghiệp vụ hay gặp.** Thân trang · nền của một bố cục đầy màn hình · nền của một trang in
· nền của một màn hình rỗng.

---

## `COLOUR-10` — bề mặt nổi

**Tình huống.** Một khối **tự đứng được** nằm trên nền trang: nó gom một nhóm nội dung thành một đơn
vị có ranh giới riêng.

**Dấu hiệu nhận biết**

- Nó có ranh giới riêng (viền, bóng, bo góc).
- Nội dung bên trong thuộc về nhau và tách khỏi phần còn lại của trang.
- Chữ bên trong **không đổi nghĩa** khi vào trong nó — vẫn `text-foreground`.

**Tự hỏi.** Khối này có phải một đơn vị nội dung tự đứng được trên nền trang không?

**Ranh giới**

- `COLOUR-9`: xem trên.
- `COLOUR-11`: `bg-card` **nổi lên**; `bg-muted` **lún xuống**. Một khối nằm trong thẻ mà lại dùng
  `bg-card` nữa thì không có tầng nào cả, chỉ có hai mảng cùng màu.

**Tình huống nghiệp vụ hay gặp.** Thẻ khoá học · khung tóm tắt đơn hàng · hộp thoại · cửa sổ nổi · một mục
trong luồng tin có ranh giới riêng · thành phần tiện ích trên bảng điều khiển.

---

## `COLOUR-11` — vùng nhóm nhẹ

**Tình huống.** Một vùng **bên trong** một bề mặt, cần được đọc thành một nhóm phụ nhưng **không**
được nâng lên thành một khối tự đứng.

**Dấu hiệu nhận biết**

- Nó luôn nằm trong một `COLOUR-10` hoặc `COLOUR-9`.
- Nó không có tiêu đề riêng ở cấp trang, không tự tồn tại nếu tách ra.
- Nó chỉ nói "mấy thứ này đi với nhau".

**Tự hỏi.** Vùng này có tự đứng được nếu mang ra khỏi bề mặt cha không? Nếu không — `COLOUR-11`.

**Ranh giới**

- `COLOUR-10`: xem trên.
- `COLOUR-12`: nếu chỉ cần **tách** hai vùng chứ không cần **gom** một vùng, dùng đường ranh, không
  dùng nền.
- `COLOUR-3`: nền nhóm nhẹ **không** phải nền của mục đang chọn. Mục đang chọn dùng
  `bg-primary/10`, vì nó nói trạng thái chọn chứ không nói nhóm.

**Tình huống nghiệp vụ hay gặp.** Khối mã trong bài viết · vùng tóm tắt trong hộp thoại · hàng tổng
tiền dưới danh sách sản phẩm · trích dẫn lồng · vùng bản xem trước trong trình soạn thảo · hàng nhóm trong bảng.

---

## `COLOUR-12` — đường ranh trung tính

**Tình huống.** Cần nói "hai bên là hai thứ khác nhau", và **không** cần nói gì thêm.

**Dấu hiệu nhận biết**

- Ranh giới không mang trạng thái nào.
- Nó không được đọc như cảnh báo, như trạng thái chọn, hay như lỗi.

**Tự hỏi.** Đường này có đang mang một trạng thái nào không? Nếu không — `border-border`.

**Ranh giới**

- `COLOUR-6`: viền chỉ đổi sang `border-danger` khi **đã kiểm tra tính hợp lệ** và **thật sự** không hợp lệ.
- `COLOUR-3`: viền của mục đang chọn nói trạng thái chọn, và vẫn cần một dấu hiệu ngoài màu.
- `COLOUR-11`: gom bằng nền, tách bằng viền — không làm cả hai để nói một chuyện.

**Tình huống nghiệp vụ hay gặp.** Viền thẻ · đường phân cách giữa các hàng · viền ô nhập liệu ở trạng thái bình
thường · viền bảng · đường ngăn giữa phần đầu và nội dung.

---

## `COLOUR-13` — các hạng mục dữ liệu độc lập

**Tình huống.** Nhiều chuỗi dữ liệu **ngang hàng**, không cái nào là thành công/cảnh báo/nguy hiểm. Chúng chỉ cần
**phân biệt được với nhau**.

**Dấu hiệu nhận biết**

- Số lượng chuỗi dữ liệu do dữ liệu quyết định, không do thiết kế.
- Không chuỗi dữ liệu nào tốt hơn chuỗi dữ liệu nào.
- Có chú giải, nhãn hoặc giá trị đi kèm.

**Tự hỏi.** Đây là nhiều hạng mục ngang hàng, hay là **một** trạng thái đang được vẽ thành nhiều màu?

**Ranh giới**

- `COLOUR-4/5/6`: nếu ba lát của biểu đồ thật ra là "đạt / cảnh báo / hỏng" thì đó là ba **trạng
  thái**, phải dùng đúng ba mã trạng thái, không phải một bảng màu phân loại.

**Bắt buộc.** Cách ánh xạ màu với từng hạng mục phải **ổn định** giữa các lần hiển thị, và mỗi chuỗi dữ liệu phải mang
thêm nhãn, giá trị hoặc hoa văn. Biểu đồ chỉ phân biệt bằng sắc màu là biểu đồ không đọc được khi in đen
trắng.

**Tình huống nghiệp vụ hay gặp.** Tỉ trọng nguồn truy cập · phân bổ thời gian học theo chủ đề · so
sánh nhiều gói cước · nhiều đường trên một biểu đồ thời gian · heatmap theo hạng mục.

---

## `COLOUR-14` — tác phẩm đồ hoạ thương hiệu

**Tình huống.** Bản thân **hình ảnh** của thương hiệu: biểu trưng, mascot, minh hoạ. Bảng màu của nó do
thương hiệu quyết định, không do mô-đun này quyết định.

**Dấu hiệu nhận biết**

- Nó là một tài sản đồ hoạ, không phải một thành phần điều khiển.
- Nó không mang trạng thái nào và không bấm được (nếu bấm được thì vùng bấm là `COLOUR-3`).

**Tự hỏi.** Đây là tác phẩm đồ hoạ, hay là giao diện đang mượn màu thương hiệu?

**Ranh giới**

- toàn bộ các mã còn lại: ngoại lệ này dừng lại **ở mép của tác phẩm đồ hoạ**. Giao diện xung quanh nó vẫn
  theo ngữ nghĩa biến thiết kế. Một biểu trưng cam **không** cho phép một nút cam.

**Tình huống nghiệp vụ hay gặp.** Biểu trưng trong phần đầu · mascot ở trạng thái rỗng · minh hoạ trang lỗi ·
hình nền vùng nổi bật · huy hiệu đối tác.

---

## `COLOUR-15` — chữ trên ảnh

**Tình huống.** Chữ phải đọc được trên một tấm ảnh mà ta **không biết trước** nó sáng hay tối.

**Dấu hiệu nhận biết**

- Nội dung phía sau do người dùng hoặc do dữ liệu quyết định.
- Không có biến thiết kế nào đảm bảo được độ tương phản, vì nền không xác định.

**Tự hỏi.** Phần tử chồng lớp này đang **bảo đảm độ tương phản**, hay đang làm cho ảnh trông "nghệ" hơn?

**Ranh giới**

- `COLOUR-10`: nếu nền đã xác định và do chủ đề kiểm soát thì đó là bề mặt, không cần phần tử chồng lớp.
- trang trí: phần tử chồng lớp chọn vì thẩm mỹ là vi phạm. Ngoại lệ này chỉ mở cho mục đích đọc được.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề trên ảnh bìa khoá học · chú thích trên ảnh thu nhỏ video · chữ
trên biểu ngữ do người dùng tải lên · nhãn trên ảnh sản phẩm.

---

## Luật

1. Chọn màu theo **ý nghĩa**, không theo sở thích.
2. Nội dung đọc mới, chưa có trạng thái nào, mặc định `text-foreground`.
3. `text-muted-foreground` chỉ dùng khi có một nội dung chính rõ ràng ở gần để nó hỗ trợ.
4. `text-primary` dành cho tương tác hoặc trạng thái chọn; **không** dùng để tạo cấp bậc tiêu đề.
5. Thành công, cảnh báo và nguy hiểm chỉ dùng khi **dữ liệu** thật sự mang trạng thái tương ứng.
6. Không viết hex, RGB hay bảng màu thô trực tiếp trong thành phần.
7. Không truyền đạt trạng thái **chỉ** bằng màu; luôn thêm văn bản, biểu tượng, hình dạng hoặc nhãn trợ năng.
8. Chế độ tối đổi **giá trị** biến thiết kế, không đổi ngữ nghĩa class CSS.
9. Trạng thái chọn và tiêu điểm là hai trạng thái khác nhau và phải phân biệt được khi cùng xuất hiện.
10. Một phần tử một vai trò. Bề mặt không mang thêm màu trạng thái; hãy lồng phần tử con.
11. Từ vựng bề mặt dùng chung là `bg-background`, `bg-card`, `bg-muted`, `border-border`,
    `ring-ring`. Không mô-đun nào đặt tên biến thiết kế bề mặt song song.
12. Chưa xác lập được vai trò thì **giữ nguyên class CSS hiện tại**, không đoán.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Tác phẩm đồ hoạ thương hiệu (`COLOUR-14`).** Bảng màu riêng chỉ áp cho chính tác phẩm đồ hoạ, dừng ở mép
  của nó.
- **Biểu đồ (`COLOUR-13`).** Bảng màu phân loại có thứ tự được phép, với điều kiện ánh xạ ổn định và
  mỗi chuỗi dữ liệu có nhãn, giá trị hoặc hoa văn.
- **Chữ trên ảnh (`COLOUR-15`).** Phần tử chồng lớp được chọn theo độ tương phản đo được, không theo thẩm mỹ.
- **Chưa có ý nghĩa.** Giữ class CSS hiện tại; nội dung đọc mới dùng `COLOUR-1`.
- **Vai trò thật sự mơ hồ.** Hỏi đúng **một** câu về ý nghĩa rồi dừng. Câu trả lời là một chuỗi class CSS
  **hoặc** một câu hỏi — không bao giờ cả hai.
- **Tính đồng nhất trạng thái.** Khung chờ, đang tải và nội dung thật giữ nguyên mã của phần tử. Đổi màu trong
  lúc tải là nói dối về vai trò.
