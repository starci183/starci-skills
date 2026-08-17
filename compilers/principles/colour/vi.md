---
title: Colour · Vietnamese
---

# Màu sắc

## LOADS

None.


## Bản ghi

Nguyên tắc này nhận một yêu cầu viết bằng lời thường — "một thẻ đơn hàng có mã đơn, ngày đặt và tình trạng đã
thanh toán" — rồi trả về là, với **mỗi phần tử** mà yêu cầu đó ngụ ý, một mã tình huống và một
className. Yêu cầu không bao giờ nói ra một sắc độ, và không được phép tự chọn một sắc độ: màu suy ra
từ **vai trò** mà phần tử đang đóng trong nghiệp vụ.

## Luật

Màu nói phần tử **có nghĩa gì**. Chọn màu từ vai trò mà phần tử đang đóng trong nghiệp vụ — nội dung,
tương tác, trạng thái, bề mặt, ranh giới — không bao giờ từ việc nhìn thấy sắc độ đó đẹp hay không.

Một quyết định về màu phải sống sót khi mất sắc độ. Nếu ý nghĩa biến mất lúc màn hình chuyển đen
trắng, lúc người đọc mù màu, hay lúc chủ đề bị ép sang tương phản cao, thì ý nghĩa đó chưa bao giờ
được mã hoá; nó chỉ đang được **gợi ý**.

**Đây là luật bắt buộc.** Mọi phần tử được hiển thị đều rơi vào đúng một mã dưới đây. Không có phần tử
nào nhỏ đến mức được miễn: một dòng thời gian dưới tiêu đề là `COLOUR-2`, đúng cùng một lý do mà một
dòng "Thanh toán thất bại" là `COLOUR-6`. Câu "có mỗi mấy chữ xám thôi mà" là chỗ luật này bị bỏ qua
nhiều nhất.

Một phần tử diễn đạt một vai trò. Mã bề mặt phát ra cặp nền-và-chữ của nó rồi dừng lại; mọi vai trò
khác — trạng thái, tương tác, trạng thái chọn — thuộc về phần tử **con**. Các mã lồng vào nhau chứ
không gộp lên cùng một nút DOM.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `COLOUR-<số thứ tự>`. Mã gọi tên TÌNH HUỐNG; cột
className gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau.

| Mã | Tình huống | className |
|---|---|---|
| `COLOUR-1` | Nội dung chính — câu mang quyết định | `text-foreground` |
| `COLOUR-2` | Nội dung hỗ trợ, siêu dữ liệu, xuất xứ | `text-muted-foreground` |
| `COLOUR-3` | Đích tương tác hoặc mục đang được chọn | `text-primary` (vùng chọn: `bg-primary/10 text-primary`) |
| `COLOUR-4` | Một kết quả đã hoàn tất thành công | `text-success-soft-foreground` + dấu hiệu ngoài màu |
| `COLOUR-5` | Rủi ro còn cứu được, chưa hỏng | `text-warning-soft-foreground` + dấu hiệu ngoài màu |
| `COLOUR-6` | Thất bại, dữ liệu không hợp lệ, hành động phá huỷ | `text-danger-soft-foreground` / `border-danger` + thông điệp nhìn thấy được |
| `COLOUR-7` | Tiêu điểm bàn phím | `focus-visible:ring-2 focus-visible:ring-ring` |
| `COLOUR-8` | Thành phần điều khiển bị vô hiệu hoá | `text-muted-foreground opacity-50` |
| `COLOUR-9` | Mặt phẳng gốc của trang | `bg-background text-foreground` |
| `COLOUR-10` | Bề mặt nổi lên trên nền trang | `bg-card text-foreground` |
| `COLOUR-11` | Vùng nhóm nhẹ bên trong một bề mặt | `bg-muted text-foreground` |
| `COLOUR-12` | Đường ranh trung tính | `border-border` |
| `COLOUR-13` | Các hạng mục dữ liệu độc lập | bảng màu phân loại có thứ tự + nhãn hoặc hoa văn |
| `COLOUR-14` | Tác phẩm đồ hoạ thương hiệu | bảng màu thương hiệu đã duyệt |
| `COLOUR-15` | Chữ nằm trên ảnh | phần tử chồng lớp chọn theo độ tương phản |

Số thứ tự là **thứ tự người đọc gặp**, không phải một thang. `COLOUR-8` không "lớn hơn" `COLOUR-4`, và
giữa `COLOUR-2` với `COLOUR-3` không có gì để chia đôi. Mô-đun này không có thang số class nào cả, nên
những con số hoàn toàn không mang phép tính — chúng chỉ là tên.

`COLOUR-13`, `COLOUR-14` và `COLOUR-15` là ba tình huống đóng, trong đó một bảng màu nằm ngoài tập
ngữ nghĩa được phép dùng. Chúng là mã chứ không phải kẽ hở: đặt tên cho một tình huống chính là điều
khiến người ta nói được rằng một lần dùng nó là sai.

## Đọc một yêu cầu

1. **Liệt kê những phần tử mà yêu cầu nói ra.** "Một thẻ đơn hàng có mã đơn, ngày đặt và tình trạng đã
   thanh toán" nói ra một thẻ, một mã đơn, một ngày và một nhãn trạng thái — bốn phần tử, mỗi phần tử
   nhận class của riêng mình.
2. **Không bịa ra phần tử mà yêu cầu không hề nhắc.** Nút xoá, biểu đồ hay ảnh bìa không nằm trong yêu
   cầu đó. Giải cái được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong** — nền trang, rồi bề mặt nổi, rồi các vùng bên trong nó, rồi tới lá.
   Một bề mặt không bao giờ thừa hưởng vai trò của thứ nó chứa.
4. **Với mỗi phần tử, gọi tên vai trò và hỏi câu hỏi** nằm trong phần của mã đó: đây là nội dung,
   tương tác, trạng thái, bề mặt hay ranh giới; và nếu là nội dung thì chính hay hỗ trợ. Mã đầu tiên
   có tình huống khớp chính là đáp án.
5. **Nếu hai mã cùng khớp trên một nút, tức là nút đó đang mang hai vai trò.** Một phần tử chỉ diễn
   đạt một vai trò; vai trò thứ hai thuộc về một phần tử con, nên phải lồng trước rồi mới chọn. Nếu
   vai trò thật sự mơ hồ, hỏi đúng **một** câu về ý nghĩa rồi dừng — câu trả lời là một chuỗi class
   **hoặc** một câu hỏi, không bao giờ cả hai.

## `COLOUR-1` — nội dung chính

**Khi nào gặp.** Đây là câu mà người dùng phải đọc để ra quyết định: tên khoá học, số tiền phải trả,
nội dung câu hỏi, tên người gửi. Bỏ nó đi thì màn hình mất lý do tồn tại.

**Cách nhận ra**

- Nếu chỉ được đọc **một** dòng trên màn hình này, người dùng sẽ đọc dòng đó.
- Nó không phụ thuộc vào một dòng nào khác để có nghĩa.
- Nó không mang trạng thái thành công / cảnh báo / nguy hiểm nào.
- Nó là mặc định an toàn: chưa xác lập được vai trò nào khác thì dùng mã này.

**Tự hỏi.** Câu này có tự đứng được và có mang quyết định của màn hình không?

**Ranh giới**

- `COLOUR-2`: `COLOUR-1` mang quyết định; `COLOUR-2` **giải thích** cho một `COLOUR-1` đang có mặt.
  Nếu quanh đó không có nội dung chính nào để hỗ trợ, thì nó không phải nội dung hỗ trợ.
- `COLOUR-3`: chữ tĩnh không bấm được thì không bao giờ là `COLOUR-3`, dù muốn nó nổi bật đến đâu.
- `COLOUR-4/5/6`: chỉ đổi mã khi **dữ liệu** thật sự mang trạng thái, không phải khi nội dung nghe có
  vẻ tích cực hay tiêu cực.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề khoá học · nội dung câu hỏi · tên người gửi trong hộp thư ·
số tiền của một hoá đơn · tên tệp · nội dung một bình luận · nhãn của một trường nhập liệu · câu hướng
dẫn bắt buộc phải làm theo · tên sản phẩm trong giỏ hàng.

## `COLOUR-2` — nội dung hỗ trợ

**Khi nào gặp.** Nội dung vẫn có ích nhưng **không dẫn nhịp đọc**: nó nói thêm về một nội dung chính
đang đứng ngay cạnh. Xoá đi thì màn hình vẫn dùng được, chỉ kém rõ.

**Cách nhận ra**

- Nó trả lời "khi nào", "bao nhiêu cái", "từ đâu ra", "loại gì" cho một nội dung chính.
- Có một `COLOUR-1` rõ ràng ở gần để nó bám vào.
- Nó không chứa mệnh lệnh, không chứa điều kiện quyết định.

**Tự hỏi.** Nếu người dùng bỏ qua dòng này, họ có mất một thông tin bắt buộc để hành động không? Nếu
không — `COLOUR-2`.

**Ranh giới**

- `COLOUR-1`: câu mang **chỉ dẫn hoặc điều kiện chính** thì không được làm mờ. "Hoàn tiền trong 7 ngày
  kể từ ngày mua" là điều kiện, không phải chú thích.
- `COLOUR-8`: giảm nhấn là **cấp bậc đọc**; bị vô hiệu hoá là **trạng thái tương tác**. Chữ mờ vẫn đọc
  và vẫn bấm được; thành phần điều khiển bị vô hiệu hoá thì không bấm được và phải có thuộc tính nói
  ra điều đó.
- `COLOUR-11`: muốn nhóm nội dung lại thì đó là việc của nền (`bg-muted`), không phải của chữ.

**Tình huống nghiệp vụ hay gặp.** Thời gian cập nhật · "12 chương · 36 bài" · tên tác giả dưới bài
viết · đơn vị đo · văn bản gợi ý đã được thay bằng nội dung mô tả · đường dẫn phân cấp đã đi qua ·
dung lượng tệp · số lượt xem · dòng "còn 3 chỗ" mang tính tham khảo.

## `COLOUR-3` — tương tác và mục đang chọn

**Khi nào gặp.** Phần tử **có thể bấm hoặc đi tới**, hoặc đang là **mục hiện tại** trong một tập lựa
chọn. Màu ở đây nói "chỗ này hành động được" hoặc "bạn đang ở đây".

**Cách nhận ra**

- Có `href`, có `onClick`, hoặc có `aria-current` / `aria-selected`.
- Bỏ màu đi thì người dùng không biết còn chỗ nào để bấm.
- Trạng thái chọn **tồn tại lâu**, không biến mất khi chuột rời đi.

**Tự hỏi.** Phần tử này dẫn tới một hành động, hay đang khai báo vị trí hiện tại của người dùng?

**Ranh giới**

- `COLOUR-1`: đây là ranh giới bị vi phạm nhiều nhất. Tô màu chính cho một tiêu đề tĩnh để nó "quan
  trọng hơn" là **sai**: cấp bậc đọc do kiểu chữ quyết định.
- `COLOUR-7`: trạng thái chọn là **trạng thái dữ liệu**, tiêu điểm là **vị trí bàn phím**. Một hàng
  đang chọn vẫn đang chọn khi tiêu điểm đã đi chỗ khác, nên hai thứ phải nhìn ra được cùng lúc.
- rê chuột: rê chuột là tạm thời và **không được** trông giống trạng thái chọn. Một mục rê chuột xong
  rồi thôi thì không có gì được ghi nhớ.
- `COLOUR-4`: nút "Xác nhận" không phải màu thành công. Nó là hành động, chưa phải kết quả.

**Tình huống nghiệp vụ hay gặp.** Liên kết trong nội dung · mục điều hướng đang mở · thẻ tab đang chọn
· hàng đang chọn trong danh sách · nút hành động chính · bước hiện tại của một trình hướng dẫn · nhãn
nhỏ bộ lọc đang bật · "Xem tất cả" cuối một phần nội dung.

## `COLOUR-4` — kết quả thành công

**Khi nào gặp.** Một việc đã **thật sự hoàn tất**, và hệ thống biết điều đó. Không phải "nội dung nghe
có vẻ vui".

**Cách nhận ra**

- Có một sự kiện đã xảy ra: đã thanh toán, đã xuất bản, đã nộp, đã đồng bộ.
- Có một trường trạng thái trong dữ liệu để trỏ vào.
- Kèm được một chữ hoặc một biểu tượng nói ra chính trạng thái đó.

**Tự hỏi.** Trong dữ liệu có một trạng thái tên là "thành công/hoàn tất" để mã này trỏ vào không?

**Ranh giới**

- `COLOUR-1`: một con số đẹp, một mức giảm giá, một lời khen — đều **không** phải thành công. Đó là
  nội dung, không phải trạng thái.
- `COLOUR-3`: nút gây ra thành công là tương tác; chỉ **kết quả** mới là `COLOUR-4`.
- `COLOUR-5`: nếu việc đã xong nhưng còn hạn chót phía sau, hai điều đó là **hai** phần tử với hai mã,
  không phải một màu trung gian.

**Tình huống nghiệp vụ hay gặp.** "Đã thanh toán" · "Đã xuất bản" · "Đã nộp bài" · "Đã xác minh thư
điện tử" · "Đồng bộ thành công" · nhãn trạng thái hoàn thành của một chương · kết quả kiểm tra đạt.

## `COLOUR-5` — cảnh báo còn cứu được

**Khi nào gặp.** Chưa có gì hỏng, nhưng nếu người dùng **không làm gì** thì sẽ hỏng. Luôn có một hành
động phòng ngừa đi kèm.

**Cách nhận ra**

- Có một mốc thời gian hoặc một ngưỡng đang tiến tới.
- Người dùng vẫn còn cách để tránh hậu quả.
- Nội dung hiện tại vẫn hợp lệ, chỉ là sắp không còn hợp lệ.

**Tự hỏi.** Việc này **đã** hỏng chưa, hay chỉ **sắp** hỏng nếu không ai can thiệp?

**Ranh giới**

- `COLOUR-6`: "Thẻ hết hạn sau 3 ngày" là `COLOUR-5`; "Thẻ đã hết hạn" là `COLOUR-6`. Ranh giới là thì
  của động từ, và nó nằm trong dữ liệu chứ không nằm ở cảm giác khẩn cấp.
- `COLOUR-2`: một ghi chú trung tính không phải cảnh báo. Chỉ dùng cảnh báo khi **có hậu quả** nếu bỏ
  qua.

**Tình huống nghiệp vụ hay gặp.** "Gói cước hết hạn sau 3 ngày" · "Còn 2 chỗ trống" khi sắp hết ·
"Bản nháp chưa lưu" · "Dung lượng đã dùng 90%" · "Chưa bật xác thực hai lớp" · "Phiên đăng nhập sắp
hết hạn".

## `COLOUR-6` — thất bại và hành động phá huỷ

**Khi nào gặp.** Một trong ba việc: một thao tác **đã** thất bại, một dữ liệu **đang** không hợp lệ,
hoặc một hành động **sẽ** phá huỷ thứ gì đó không lấy lại được.

**Cách nhận ra**

- Có một lỗi thật để hiển thị, kèm lý do đọc được.
- Hoặc trường nhập liệu đang ở trạng thái `aria-invalid` **sau khi** đã kiểm tra tính hợp lệ.
- Hoặc nút sẽ xoá, huỷ, thu hồi, chấm dứt.

**Tự hỏi.** Có một thất bại đã xảy ra, hay một mất mát không hoàn tác được sắp xảy ra?

**Ranh giới**

- `COLOUR-5`: xem trên — đã hỏng so với sắp hỏng.
- `COLOUR-2`: **trường nhập liệu bắt buộc mà chưa nhập** thì chưa phải lỗi. Tô đỏ một biểu mẫu ngay
  khi vừa mở là nói dối về trạng thái.
- `COLOUR-3`: nút "Xoá tài khoản" mang cả hai vai trò — nó là hành động **và** là phá huỷ. Vai trò phá
  huỷ thắng, vì hậu quả của việc đọc nhầm lớn hơn.

**Đường viền không đủ.** Viền đỏ nói "có gì đó sai" nhưng không nói **sai cái gì**. Luôn giữ một thông
điệp nhìn thấy được.

**Tình huống nghiệp vụ hay gặp.** "Thanh toán thất bại" · thư điện tử sai định dạng sau khi gửi ·
"Không tải được dữ liệu" · nút xoá vĩnh viễn · "Mật khẩu không khớp" · hạn nộp đã quá · "Đã bị từ
chối".

## `COLOUR-7` — tiêu điểm bàn phím

**Khi nào gặp.** Bàn phím đang đứng ở đâu. Đây là thông tin **của thiết bị nhập**, không phải của dữ
liệu.

**Cách nhận ra**

- Chỉ xuất hiện khi điều hướng bằng bàn phím (`focus-visible`).
- Di chuyển liên tục khi bấm Tab; không có gì được ghi nhớ.
- Phải nhìn thấy trên **mọi** bề mặt, kể cả khi phần tử đang được chọn.

**Tự hỏi.** Thứ này biến mất khi người dùng bấm Tab đi chỗ khác đúng không? Nếu đúng — đó là tiêu
điểm, không phải trạng thái chọn.

**Ranh giới**

- `COLOUR-3`: trạng thái chọn còn lại sau khi tiêu điểm rời đi. Nếu chỉ có một trong hai được nhìn
  thấy, người dùng bàn phím sẽ lạc.
- rê chuột: rê chuột không thay được tiêu điểm. Chuột và bàn phím là hai đường vào khác nhau.

**Không được xoá.** Bỏ `outline` mà không thay bằng vòng là gỡ mất đường đi duy nhất của người dùng
bàn phím.

**Tình huống nghiệp vụ hay gặp.** Ô nhập liệu trong biểu mẫu · nút · liên kết · hàng bấm được trong
danh sách · thẻ tab · phần tử trong lệnh trình đơn · hộp kiểm và nút chọn.

## `COLOUR-8` — bị vô hiệu hoá

**Khi nào gặp.** Thành phần điều khiển **có mặt** nhưng **chưa dùng được**, vì một điều kiện nghiệp vụ
chưa thoả.

**Cách nhận ra**

- Có thuộc tính `disabled` hoặc `aria-disabled` thật, không chỉ là màu nhạt.
- Có một lý do nghiệp vụ nói được thành lời: chưa chọn xong, chưa đủ quyền, đang xử lý.
- Bấm vào không xảy ra gì cả.

**Tự hỏi.** Có một điều kiện nghiệp vụ cụ thể khiến thành phần điều khiển này chưa dùng được không, và
điều kiện đó đã được nói ra ở đâu chưa?

**Ranh giới**

- `COLOUR-2`: đây là ranh giới nguy hiểm nhất của mô-đun, vì **hai mã dùng chung một biến thiết kế**.
  Chỉ `opacity-50` **cộng với** trạng thái bị vô hiệu hoá thật mới tách được chúng. Chữ mô tả bị làm
  mờ thêm `opacity-50` sẽ bị đọc thành "hỏng", và nút bị vô hiệu hoá thiếu `opacity-50` sẽ bị bấm hoài
  không hiểu.
- `COLOUR-6`: bị vô hiệu hoá **không** phải lỗi. Không tô đỏ một nút chỉ vì chưa bấm được.

**Tình huống nghiệp vụ hay gặp.** Nút gửi khi biểu mẫu chưa hợp lệ · "Bước tiếp theo" khi chưa chọn
xong · tính năng ngoài gói cước · nút đang gửi · lựa chọn đã hết hàng · hành động thiếu quyền.

## `COLOUR-9` — mặt phẳng gốc

**Khi nào gặp.** Nền của cả trang. Mọi thứ khác nằm **trên** nó.

**Cách nhận ra**

- Không có bề mặt nào phía dưới nó nữa.
- Nó là chỗ chủ đề quyết định "sáng hay tối".

**Tự hỏi.** Bên dưới phần tử này còn bề mặt nào nữa không? Nếu không — `COLOUR-9`.

**Ranh giới**

- `COLOUR-10`: nền trang **không** được viết bằng `bg-card`. Nếu mọi thứ đều là thẻ thì không còn gì
  nổi lên được nữa.

**Tình huống nghiệp vụ hay gặp.** Thân trang · nền của một bố cục đầy màn hình · nền của một trang in
· nền của một màn hình rỗng.

## `COLOUR-10` — bề mặt nổi

**Khi nào gặp.** Một khối **tự đứng được** nằm trên nền trang: nó gom một nhóm nội dung thành một đơn
vị có ranh giới riêng.

**Cách nhận ra**

- Nó có ranh giới riêng (viền, bóng, bo góc).
- Nội dung bên trong thuộc về nhau và tách khỏi phần còn lại của trang.
- Chữ bên trong **không đổi nghĩa** khi vào trong nó — vẫn `text-foreground`.

**Tự hỏi.** Khối này có phải một đơn vị nội dung tự đứng được trên nền trang không?

**Ranh giới**

- `COLOUR-9`: xem trên.
- `COLOUR-11`: `bg-card` **nổi lên**; `bg-muted` **lún xuống**. Một khối nằm trong thẻ mà lại dùng
  `bg-card` nữa thì không có tầng nào cả, chỉ có hai mảng cùng màu.

**Tình huống nghiệp vụ hay gặp.** Thẻ khoá học · khung tóm tắt đơn hàng · hộp thoại · cửa sổ nổi · một
mục trong luồng tin có ranh giới riêng · thành phần tiện ích trên bảng điều khiển.

## `COLOUR-11` — vùng nhóm nhẹ

**Khi nào gặp.** Một vùng **bên trong** một bề mặt, cần được đọc thành một nhóm phụ nhưng **không** được
nâng lên thành một khối tự đứng.

**Cách nhận ra**

- Nó luôn nằm trong một `COLOUR-10` hoặc một `COLOUR-9`.
- Nó không có tiêu đề riêng ở cấp trang, không tự tồn tại nếu tách ra.
- Nó chỉ nói "mấy thứ này đi với nhau".

**Tự hỏi.** Vùng này có tự đứng được nếu mang ra khỏi bề mặt cha không? Nếu không — `COLOUR-11`.

**Ranh giới**

- `COLOUR-10`: xem trên.
- `COLOUR-12`: nếu chỉ cần **tách** hai vùng chứ không cần **gom** một vùng, dùng đường ranh, không
  dùng nền.
- `COLOUR-3`: nền nhóm nhẹ **không** phải nền của mục đang chọn. Mục đang chọn dùng `bg-primary/10`,
  vì nó nói trạng thái chọn chứ không nói nhóm.

**Tình huống nghiệp vụ hay gặp.** Khối mã trong bài viết · vùng tóm tắt trong hộp thoại · hàng tổng
tiền dưới danh sách sản phẩm · trích dẫn lồng · vùng bản xem trước trong trình soạn thảo · hàng nhóm
trong bảng.

## `COLOUR-12` — đường ranh trung tính

**Khi nào gặp.** Cần nói "hai bên là hai thứ khác nhau", và **không** cần nói gì thêm.

**Cách nhận ra**

- Ranh giới không mang trạng thái nào.
- Nó không được đọc như cảnh báo, như trạng thái chọn, hay như lỗi.

**Tự hỏi.** Đường này có đang mang một trạng thái nào không? Nếu không — `border-border`.

**Ranh giới**

- `COLOUR-6`: viền chỉ đổi sang `border-danger` khi **đã kiểm tra tính hợp lệ** và **thật sự** không
  hợp lệ.
- `COLOUR-3`: viền của mục đang chọn nói trạng thái chọn, và vẫn cần một dấu hiệu ngoài màu.
- `COLOUR-11`: gom bằng nền, tách bằng viền — không làm cả hai để nói một chuyện.

**Tình huống nghiệp vụ hay gặp.** Viền thẻ · đường phân cách giữa các hàng · viền ô nhập liệu ở trạng
thái bình thường · viền bảng · đường ngăn giữa phần đầu và nội dung.

## `COLOUR-13` — các hạng mục dữ liệu độc lập

**Khi nào gặp.** Nhiều chuỗi dữ liệu **ngang hàng**, không cái nào là thành công, cảnh báo hay nguy
hiểm. Chúng chỉ cần **phân biệt được với nhau**.

**Cách nhận ra**

- Số lượng chuỗi dữ liệu do dữ liệu quyết định, không do thiết kế.
- Không chuỗi dữ liệu nào tốt hơn chuỗi dữ liệu nào.
- Có chú giải, nhãn hoặc giá trị đi kèm.

**Tự hỏi.** Đây là nhiều hạng mục ngang hàng, hay là **một** trạng thái đang được vẽ thành nhiều màu?

**Ranh giới**

- `COLOUR-4/5/6`: nếu ba lát của biểu đồ thật ra là "đạt / cảnh báo / hỏng" thì đó là ba **trạng
  thái**, phải dùng đúng ba mã trạng thái, không phải một bảng màu phân loại.

**Bắt buộc.** Cách ánh xạ màu với từng hạng mục phải **ổn định** giữa các lần hiển thị, và mỗi chuỗi
dữ liệu phải mang thêm nhãn, giá trị hoặc hoa văn. Biểu đồ chỉ phân biệt bằng sắc màu là biểu đồ không
đọc được khi in đen trắng.

**Tình huống nghiệp vụ hay gặp.** Tỉ trọng nguồn truy cập · phân bổ thời gian học theo chủ đề · so
sánh nhiều gói cước · nhiều đường trên một biểu đồ thời gian · heatmap theo hạng mục.

## `COLOUR-14` — tác phẩm đồ hoạ thương hiệu

**Khi nào gặp.** Bản thân **hình ảnh** của thương hiệu: biểu trưng, mascot, minh hoạ. Bảng màu của nó
do thương hiệu quyết định, không do mô-đun này quyết định.

**Cách nhận ra**

- Nó là một tài sản đồ hoạ, không phải một thành phần điều khiển.
- Nó không mang trạng thái nào và không bấm được (nếu bấm được thì vùng bấm là `COLOUR-3`).

**Tự hỏi.** Đây là tác phẩm đồ hoạ, hay là giao diện đang mượn màu thương hiệu?

**Ranh giới**

- toàn bộ các mã còn lại: ngoại lệ này dừng lại **ở mép của tác phẩm đồ hoạ**. Giao diện xung quanh nó
  vẫn theo biến thiết kế ngữ nghĩa. Một biểu trưng cam **không** cho phép một nút cam.

**Tình huống nghiệp vụ hay gặp.** Biểu trưng trong phần đầu · mascot ở trạng thái rỗng · minh hoạ
trang lỗi · hình nền vùng nổi bật · huy hiệu đối tác.

## `COLOUR-15` — chữ trên ảnh

**Khi nào gặp.** Chữ phải đọc được trên một tấm ảnh mà ta **không biết trước** nó sáng hay tối.

**Cách nhận ra**

- Nội dung phía sau do người dùng hoặc do dữ liệu quyết định.
- Không có biến thiết kế nào đảm bảo được độ tương phản, vì nền không xác định.

**Tự hỏi.** Phần tử chồng lớp này đang **bảo đảm độ tương phản**, hay đang làm cho ảnh trông "nghệ"
hơn?

**Ranh giới**

- `COLOUR-10`: nếu nền đã xác định và do chủ đề kiểm soát thì đó là bề mặt, không cần phần tử chồng
  lớp.
- trang trí: phần tử chồng lớp chọn vì thẩm mỹ là vi phạm. Ngoại lệ này chỉ mở cho mục đích đọc được.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề trên ảnh bìa khoá học · chú thích trên ảnh thu nhỏ video ·
chữ trên biểu ngữ do người dùng tải lên · nhãn trên ảnh sản phẩm.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| phần tử | Đúng một nút DOM nhận class |
| vai trò | nội dung, tương tác, trạng thái, bề mặt hoặc ranh giới |
| cấp bậc | chính hay hỗ trợ — chỉ dành cho nội dung |
| trạng thái | trung tính, đang chọn, thành công, cảnh báo, nguy hiểm hoặc bị vô hiệu hoá |
| quan hệ bề mặt | gốc, nổi, lồng bên trong hoặc chồng lớp |
| dấu hiệu ngoài màu | chữ, biểu tượng, hình dạng, hoa văn hoặc nhãn trợ năng |
| chủ đề | sáng, tối và forced-colour phải ra cùng một vai trò |

## Quy tắc

1. Dùng biến thiết kế ngữ nghĩa. Một thành phần không tự viết hex, RGB hay một sắc độ trong bảng màu.
2. Mỗi mã phát ra đúng một biểu thức class. Hai mã chỉ được dùng chung một biến thiết kế khi có một
   class thứ hai tách chúng ra: `COLOUR-2` và `COLOUR-8` cùng dùng `text-muted-foreground`, và
   `opacity-50` cộng với trạng thái `disabled` / `aria-disabled` thật là thứ phân biệt chúng.
3. Kiểu chữ sở hữu cấp bậc đọc. Màu không bao giờ nâng chữ thường lên thành tiêu đề.
4. Mỗi `COLOUR-4`, `COLOUR-5` và `COLOUR-6` đều mang kèm chữ, biểu tượng hoặc nhãn trợ năng tương ứng.
5. Trạng thái chọn (`COLOUR-3`) và tiêu điểm (`COLOUR-7`) là hai trạng thái khác nhau và phải phân
   biệt được khi cùng xuất hiện trên một phần tử.
6. Cùng một vai trò ngữ nghĩa giữ nguyên qua chủ đề sáng, tối và forced-colour. Chủ đề đổi **giá trị**
   của biến thiết kế; nó không bao giờ đổi mã nào được áp dụng.
7. Từ vựng bề mặt dùng chung là `bg-background`, `bg-card`, `bg-muted`, `border-border` và
   `ring-ring`. Không mô-đun nào đặt ra một tên biến thiết kế bề mặt song song.
8. Một phần tử, một vai trò. Một nút bề mặt không mang thêm màu trạng thái.
9. Màu trạng thái luôn viết bằng biến **foreground** của nó: `text-success-soft-foreground`,
   `text-warning-soft-foreground`, `text-danger-soft-foreground`. Biến `-soft` trần là một **bề
   mặt**, không phải chữ, nên `text-success-soft` là đang lấy một mảng nền dịu đặt vào chỗ đáng lẽ
   phải là một tông chữ đọc được. Khi phần tử có tô nền dịu thì cặp là cố định: `bg-success-soft` đi
   với `text-success-soft-foreground`, warning và danger cũng vậy.
10. Mọi phần tử được hiển thị đều rơi vào đúng một mã. Không phần tử nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Tác phẩm đồ hoạ thương hiệu (`COLOUR-14`).** Biểu trưng, mascot hoặc minh hoạ được dùng bảng màu
  thương hiệu đã duyệt. Ngoại lệ này bao trùm chính tác phẩm đồ hoạ, không bao giờ bao trùm giao diện
  quanh nó.
- **Biểu đồ (`COLOUR-13`).** Biểu đồ được dùng bảng màu phân loại có thứ tự, với điều kiện ánh xạ ổn
  định và mỗi chuỗi dữ liệu còn mang thêm nhãn, giá trị hoặc hoa văn.
- **Chữ trên ảnh (`COLOUR-15`).** Phần tử chồng lớp được chọn theo độ tương phản đo được trên một tấm
  ảnh không đoán trước được, không bao giờ vì trang trí.
- **Chưa xác lập được vai trò.** Giữ nguyên class hiện tại. Nội dung đọc mới, chưa có trạng thái nào,
  thì mặc định an toàn là `COLOUR-1`.
- **Vai trò thật sự mơ hồ.** Hỏi đúng **một** câu về ý nghĩa rồi dừng. Câu trả lời là một chuỗi class
  **hoặc** một câu hỏi — không bao giờ cả hai.
- **Tính đồng nhất trạng thái.** Khung chờ, đang tải và nội dung thật giữ nguyên mã của phần tử. Đổi
  màu trong lúc tải là nói dối về vai trò.

## Đầu ra

Mỗi phần tử một khối, từ ngoài vào trong:

```text
element: <nút DOM nhận class>
situation: <COLOUR-1 … COLOUR-15>
className: <các class ngữ nghĩa>
non-colour cue: <text | icon | shape | pattern | none>
reason: <sự thật nghiệp vụ loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Một trang có thẻ đơn hàng hiện mã đơn, ngày đặt, tình trạng đã thanh toán, một hàng tổng
tiền, và một liên kết xem chi tiết đơn hàng."

Yêu cầu này nói ra một nền trang, một thẻ, một viền thẻ, bốn mẩu nội dung, một trạng thái và một liên
kết. Nó không nói tới thanh toán thất bại, không nói tới điều kiện chưa thoả, không nói tới biểu đồ,
tác phẩm đồ hoạ hay ảnh nằm sau chữ, nên `COLOUR-5`, `COLOUR-6`, `COLOUR-8`, `COLOUR-13`, `COLOUR-14`
và `COLOUR-15` không được giải ở đây.

```text
element: thân trang
situation: COLOUR-9
className: bg-background text-foreground
non-colour cue: none
reason: bên dưới nó không còn bề mặt nào, điều này loại trừ COLOUR-10
```

```text
element: thẻ đơn hàng
situation: COLOUR-10
className: bg-card text-foreground
non-colour cue: none
reason: nó là một đơn vị tự đứng được trên nền trang, điều này loại trừ COLOUR-11
```

```text
element: viền thẻ
situation: COLOUR-12
className: border-border
non-colour cue: none
reason: đường ranh này không mang trạng thái nào, điều này loại trừ COLOUR-6
```

```text
element: mã đơn hàng
situation: COLOUR-1
className: text-foreground
non-colour cue: none
reason: đây là dòng nhận diện đơn hàng, điều này loại trừ COLOUR-2
```

```text
element: ngày đặt
situation: COLOUR-2
className: text-muted-foreground
non-colour cue: none
reason: nó trả lời "khi nào" cho mã đơn và không bắt buộc để hành động, điều này loại trừ COLOUR-1
```

```text
element: nhãn trạng thái đã thanh toán
situation: COLOUR-4
className: text-success-soft-foreground
non-colour cue: chữ "Đã thanh toán" + biểu tượng dấu tích
reason: dữ liệu mang một trạng thái thanh toán đã hoàn tất chứ không phải một giá trị nghe tích cực, điều này loại trừ COLOUR-1
```

```text
element: hàng tổng tiền
situation: COLOUR-11
className: bg-muted text-foreground
non-colour cue: none
reason: nó không tự đứng được khi tách khỏi thẻ, điều này loại trừ COLOUR-10
```

```text
element: số tiền tổng
situation: COLOUR-1
className: text-foreground
non-colour cue: none
reason: đây là con số người dùng ra quyết định trên đó, điều này loại trừ COLOUR-2
```

```text
element: liên kết xem chi tiết
situation: COLOUR-3
className: text-primary
non-colour cue: gạch chân khi rê chuột
reason: nó dẫn đi nơi khác chứ không báo cáo một kết quả, điều này loại trừ COLOUR-4
```

`COLOUR-7` không phải thứ lời văn được phép bỏ qua: liên kết chi tiết đi tới được bằng bàn phím, nên
nó mang thêm `focus-visible:ring-2 focus-visible:ring-ring`. Tiêu điểm nói thiết bị nhập đang ở đâu,
không nói nghiệp vụ yêu cầu gì. Và bản thân thẻ vẫn là `COLOUR-10` — nó không chuyển sang màu thành
công chỉ vì đơn hàng đã thanh toán; trạng thái đó thuộc về nhãn trạng thái, là một phần tử con.

## Phạm vi

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường.
