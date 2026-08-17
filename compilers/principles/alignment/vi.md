---
title: Alignment · Vietnamese
---

# Căn chỉnh

## LOADS

None.


## Bản ghi

Nguyên tắc này nhận một yêu cầu viết bằng lời thường — "một hàng cài đặt có nhãn và một công tắc" — rồi trả về
là, với **mỗi vùng chứa** mà yêu cầu đó ngụ ý, một mã tình huống cho mỗi trục và một className. Yêu
cầu không bao giờ nói ra một cách căn chỉnh, và không được phép ước lượng: căn chỉnh suy ra từ **bản
chất của các con**, không bao giờ từ chỗ ta muốn chúng trông như đang đứng.

## Luật

Những phần tử con có chiều đo khác nhau thì luôn phải treo vào một cái gì đó. Căn chỉnh nói ra CÁI GÌ —
một chiều đo trục chéo dùng chung, một điểm giữa, một mép đầu, một mép cuối, hay một dòng viết — và
nó được chọn từ bản chất của các con, không bao giờ từ chỗ ta muốn chúng trông như đang đứng.

Một vùng chứa trả lời hai câu hỏi độc lập với nhau. Vuông góc với hướng chảy, **trục chéo** quyết
định các con treo vào đâu. Dọc theo hướng chảy, **trục chính** quyết định cả cụm nằm ở đâu và chỗ
trống mà không ai đòi sẽ thuộc về ai. Không câu trả lời nào suy ra câu kia, và không câu nào được
phép bỏ trống: một vùng chứa không tuyên bố gì là một vùng chứa đã trả lời cả hai câu bằng mặc định,
mà mặc định là những quyết định có hậu quả — kéo dãn khiến một phần tử con có viền mọc ra một ranh giới
nó không kiếm được, còn dồn về đầu thì đem toàn bộ chỗ thừa giao cho mép cuối.

**Đây là luật bắt buộc.** Mọi vùng chứa `flex` và `grid` đều rơi vào đúng một mã trục chéo và đúng
một mã trục chính ở dưới, kể cả những vùng chứa không phát ra gì. Không có hàng nào nhỏ tới mức được
miễn cả hai: một biểu tượng cạnh một nhãn là `ALIGN-1`, đúng cùng một lý do mà một khung trang cạnh
một thanh dọc là `ALIGN-0`. Câu "nhìn đã đúng rồi mà" không phải một quyền miễn trừ — đó là chỗ luật
này bị bỏ qua nhiều nhất, vì căn chỉnh là quyết định mà vi phạm của nó vô hình cho tới khi dữ liệu
đổi. Hai con cao bằng nhau thì mọi mã trong mô-đun này hiển thị giống hệt nhau. Chúng thôi giống nhau
đúng vào ngày một con xuống dòng thứ hai.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `ALIGN-<số>`. Mã gọi tên TÌNH HUỐNG; cột className
gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có hai mã không phát ra gì cả.

Các mã được đánh số theo thứ tự người đọc gặp chúng: trục chéo trước, vì đó là câu hỏi mô-đun này
nhận lấy; trường hợp một con đi chệch nằm ngay sau luật mà nó đi chệch khỏi; trục chính kế tiếp; và
trường hợp nhiều dòng đứng cuối, vì nó chỉ tồn tại khi vùng chứa đã được gán một chiều đo trục chéo
mà nó phải biện minh.

**Trục chéo — các con treo vào đâu.**

| Mã | Tình huống | className |
|---|---|---|
| `ALIGN-0` | Các con dùng chung một chiều đo trục chéo; con nào cũng lấp đầy dòng | *không khai báo* |
| `ALIGN-1` | Các con có chiều đo trục chéo khác nhau nhưng phải đọc thành một dòng | `items-center` |
| `ALIGN-2` | Mỗi con có chiều dài trục chéo riêng và chúng phải bắt đầu cùng nhau | `items-start` |
| `ALIGN-3` | Mỗi con có chiều dài trục chéo riêng và chúng phải kết thúc cùng nhau | `items-end` |
| `ALIGN-4` | Chữ khác cỡ phải đứng trên cùng một dòng viết | `items-baseline` |
| `ALIGN-5` | Một con đi chệch khỏi luật mà cha nó đã tuyên bố | `self-*` |

**Trục chính — cả cụm nằm ở đâu và chỗ thừa thuộc về ai.**

| Mã | Tình huống | className |
|---|---|---|
| `ALIGN-6` | Cụm bắt đầu ở mép nội dung; chỗ thừa rơi về phía sau | *không khai báo* |
| `ALIGN-7` | Cả cụm thuộc về mép cuối theo hướng chảy của chính nó | `justify-end` |
| `ALIGN-8` | Cụm không thuộc về mép nào và nằm giữa chỗ thừa | `justify-center` |
| `ALIGN-9` | Chỗ thừa thuộc về KHOẢNG GIỮA các con, do hai đầu đối nghịch hoặc do ngang quyền | `justify-between` · `justify-around` · `justify-evenly` |

**Nhiều dòng — khi đã có nhiều dòng thì các dòng treo vào đâu.**

| Mã | Tình huống | className |
|---|---|---|
| `ALIGN-10` | Vùng chứa xuống dòng thành nhiều dòng và sở hữu chỗ trống trục chéo mà các dòng không lấp hết | `content-*` |

`ALIGN-0` VÀ `ALIGN-6` LÀ TÌNH HUỐNG, KHÔNG PHẢI SỰ VẮNG MẶT. Trong công việc thường ngày không có
`items-stretch` hay `justify-start` nào để viết ra, và thêm chúng vào cũng không phát biểu điều gì mà
mặc định chưa phát biểu. Hai mã này tồn tại vì một mặc định không ai gọi tên là một mặc định không ai
chứng minh được là đã chọn sai — và kéo dãn là mặc định có hậu quả nặng nhất trong cả mô-đun, bởi nó
âm thầm đổi kích thước các phần tử con có nền, có viền hoặc có mảng màu.

`ALIGN-5` là mã duy nhất do một phần tử con mang, chứ không do vùng chứa mang. Nó tồn tại để một sự đi
chệch được đọc ra đúng là đi chệch: vùng chứa vẫn giữ luật đã tuyên bố, và đúng một phần tử con nói to
lên rằng nó không bị luật ấy ràng buộc.

## Đọc một yêu cầu

1. **Liệt kê những vùng chứa mà yêu cầu nói ra.** "Một hàng cài đặt có nhãn và một công tắc" nói ra
   một vùng chứa: chính cái hàng giữ nhãn và công tắc.
2. **Không bịa ra vùng chứa mà yêu cầu không hề nhắc.** Một cái thẻ bao quanh hàng đó, một tiêu đề
   đặt trên nó hay một hàng thứ hai đều không nằm trong yêu cầu. Giải cái được nói ra; phần còn lại
   giải khi nó xuất hiện.
3. **Với mỗi vùng chứa, xét xem nó có thật sự là vùng chứa không.** Class căn chỉnh chỉ hợp lệ trên
   phần tử khai báo `flex`, `inline-flex` hoặc `grid`. Nếu yêu cầu không ngụ ý một phần tử như vậy,
   mô-đun này không phát ra gì cho nó.
4. **Gọi tên hướng chảy**, vì chính nó quyết định trục nào là trục chéo. Một hàng chảy ngang thì trục
   chéo là chiều dọc; một cột chảy dọc thì trục chéo là chiều ngang. Cùng một tên class mang hai nghĩa
   khác nhau tuỳ hướng chảy.
5. **Giải từ ngoài vào trong**, rồi tới từng vùng chứa lồng bên trong. Mỗi vùng chứa có hai câu trả
   lời của riêng nó; vùng chứa không bao giờ thừa hưởng mã của con nó.
6. **Trả lời trục chéo một lần bằng cách hỏi câu hỏi của từng mã trục chéo**, theo thứ tự. Mã đầu tiên
   có tình huống khớp chính là đáp án. Sau đó gọi tên đúng một con đi chệch, nếu có, là `ALIGN-5`.
7. **Trả lời trục chính một lần theo đúng cách ấy**, rồi hỏi xem vùng chứa có xuống dòng và có sở hữu
   chỗ thừa trục chéo không, tức `ALIGN-10`.
8. **Nếu hai mã cùng khớp, quyết theo bản chất của các con, không theo cái dữ liệu hôm nay hiển thị.**
   Nếu một vùng chứa trộn nhiều tình huống — có con phải kéo dãn, có con thì không — thì hoặc nó có
   một luật cộng một con đi chệch, hoặc chính luật ấy sai và phải tách các con thành vùng chứa lồng.

## `ALIGN-0` — dùng chung một chiều đo, không khai báo

**Khi nào gặp.** Các con KHÔNG có chiều đo riêng theo trục chéo, hoặc phải cùng nhận chiều đo của con
dài nhất. Đây là mặc định của flex và lưới, và tuyệt đại đa số vùng chứa đúng ở đây.

**Cách nhận ra**

- Mỗi con là một VÙNG cần cao bằng nhau: hai cột thẻ cạnh nhau, hai ô trong một lưới.
- Có con cần một nền, một viền hoặc một vùng bấm chạy hết chiều cao của hàng.
- Không con nào có chiều cao nội dung mà việc kéo dãn sẽ nói dối.

**Tự hỏi.** Nếu con cao nhất cao thêm nữa, những con còn lại CÓ NÊN cao theo không?

**Ranh giới**

- `ALIGN-2`: khi các con tình cờ cao bằng nhau, hai mã hiển thị y hệt. Phân biệt bằng QUYỀN SỞ HỮU
  RANH GIỚI: con nào có nền, viền hoặc bóng đổ mà bị kéo dãn sẽ trở thành một hộp to hơn nội dung nó
  có — lúc đó không còn là `ALIGN-0`.
- `ALIGN-1`: một biểu tượng 16px bị kéo cao bằng đoạn văn hai dòng là dấu hiệu `ALIGN-0` bị dùng nhầm.
  Biểu tượng có kích thước riêng và không được kéo.

**Không bao giờ viết `items-stretch`.** Nó không nói thêm điều gì so với mặc định. `ALIGN-0` là mã
TÌNH HUỐNG, không phải tên class CSS.

**Tình huống nghiệp vụ hay gặp.** Hai cột thẻ cao bằng nhau · ô trong lưới danh mục · thanh bên và
vùng nội dung cùng cao · một hàng gồm các nút cùng chiều cao · ô trong bảng · hai khung của một màn
hình chia đôi.

## `ALIGN-1` — cao thấp khác nhau nhưng đọc thành một dòng

**Khi nào gặp.** Các con có chiều đo riêng theo trục chéo và KHÔNG thứ nào nên bị kéo. Chúng cùng tạo
thành MỘT DÒNG mà mắt đọc một lượt.

**Cách nhận ra**

- Có ít nhất một con là HÌNH hoặc HỘP CỐ ĐỊNH: biểu tượng, ảnh đại diện, nhãn trạng thái, hộp kiểm,
  công tắc, biểu tượng đang tải.
- Chữ trong hàng chắc chắn chỉ một dòng.
- Kéo dãn con nào cũng vô nghĩa: một biểu tượng cao bằng hai dòng chữ là một biểu tượng méo.

**Tự hỏi.** Có con nào là hình hoặc hộp cố định mà việc kéo dãn sẽ làm nó sai đi không?

**Ranh giới**

- `ALIGN-4`: `ALIGN-1` treo vào GIỮA HỘP; `ALIGN-4` treo vào DÒNG VIẾT. Nếu MỌI con đều là chữ và
  người đọc đọc chúng thành một giá trị hoặc một câu — dùng `ALIGN-4`. Chỉ cần một con là hình thì
  quay về `ALIGN-1`.
- `ALIGN-2`: `ALIGN-1` chỉ đúng khi phần chữ CHẮC CHẮN một dòng. Nếu tên, tiêu đề hay mô tả có thể
  xuống dòng thứ hai — đó là `ALIGN-2`, kể cả khi dữ liệu hôm nay còn ngắn.
- `ALIGN-0`: `ALIGN-0` là các con CÙNG NHẬN một chiều đo; `ALIGN-1` là các con GIỮ chiều đo riêng và
  gặp nhau ở giữa.

**Tình huống nghiệp vụ hay gặp.** Biểu tượng + nhãn trong một nút · ảnh đại diện + tên một dòng · hộp
kiểm + nhãn ngắn · nhãn trạng thái cạnh tiêu đề · công tắc + tên cài đặt · phần đầu của một hàng có
tiêu đề và một nút · một ô vuông chỉ chứa chữ cái viết tắt (`grid place-items-center`).

## `ALIGN-2` — mỗi con có chiều dài riêng, bắt đầu cùng nhau

**Khi nào gặp.** Ít nhất một con có thể DÀI RA theo trục chéo, và phần đầu của các con mới là chỗ mắt
neo vào. Treo vào giữa sẽ khiến những con cố định TRÔI mỗi khi con dài kia đổi độ dài.

**Cách nhận ra**

- Trong một hàng: có đoạn chữ có thể xuống dòng thứ hai, thứ ba.
- Một con là hình cố định (ảnh đại diện, biểu tượng) cần đứng ngang DÒNG ĐẦU TIÊN của con kia.
- Trong một cột: các con phải dạt về MÉP ĐẦU theo hướng đọc, không phải mép cuối.

**Tự hỏi.** Nếu con dài nhất dài gấp đôi, con cố định kia CÓ ĐƯỢC PHÉP TRÔI XUỐNG theo không? Nếu
không — `ALIGN-2`.

**Ranh giới**

- `ALIGN-1`: phân định bằng KHẢ NĂNG DÀI RA, không bằng dữ liệu hiện tại. Một tên người hôm nay một
  dòng, ngày mai một dòng rưỡi, vẫn là `ALIGN-2` ngay từ đầu.
- `ALIGN-0`: `ALIGN-2` GIỮ chiều đo tự nhiên của mỗi con; `ALIGN-0` XOÁ nó. Con có viền hay nền thì
  khác biệt này nhìn thấy ngay.
- `ALIGN-3`: cùng là "một mép", nhưng `ALIGN-2` neo vào chỗ nội dung BẮT ĐẦU, `ALIGN-3` neo vào chỗ
  nội dung KẾT THÚC.

**Tình huống nghiệp vụ hay gặp.** Ảnh đại diện + tên + bình luận nhiều dòng · biểu tượng + tiêu đề +
mô tả trong một khối nhấn mạnh · hộp kiểm + điều khoản dài · số thứ tự + câu hỏi dài · hai cột nội
dung phải cùng bắt đầu ở mép trên · một cột chứa nhãn và mô tả, dạt về mép đầu.

## `ALIGN-3` — mỗi con có chiều dài riêng, kết thúc cùng nhau

**Khi nào gặp.** Mép CUỐI mới là chỗ có nghĩa. Trong một CỘT, đây là cách một cụm dạt về phía cuối theo
hướng đọc. Trong một HÀNG, đây là các con cùng đứng trên một sàn chung.

**Cách nhận ra**

- Cột: cụm giá, cụm thời gian, cụm hành động ở ô cuối của một tài liệu.
- Hàng: các cột của một biểu đồ cùng mọc lên từ một sàn.
- Con số đọc từ phía cuối (tiền, phần trăm) và cần thẳng mép cuối với nhau.

**Tự hỏi.** Cái người đọc so sánh giữa các con là chỗ chúng KẾT THÚC, hay chỗ chúng BẮT ĐẦU?

**Ranh giới**

- `ALIGN-4`: trong một HÀNG, `items-end` gần như luôn là nhầm lẫn của `items-baseline`. Chữ có phần
  dưới dòng (`g`, `y`, `p`) và khoảng đệm của hộp chữ khiến "cùng đáy hộp" KHÔNG bằng "cùng dòng
  viết". Nếu các con là chữ — dùng `ALIGN-4`.
- `ALIGN-2`: trong một CỘT, hai mã này là hai mép đối nhau. Chọn theo mép nào mang nghĩa so sánh.
- `ALIGN-7`: `ALIGN-3` là TRỤC CHÉO, `ALIGN-7` là TRỤC CHÍNH. Trong một cột, dạt các con sang mép cuối
  là `ALIGN-3`; dồn cả cụm xuống đáy cột là `ALIGN-7`.

**Tình huống nghiệp vụ hay gặp.** Cột chứa số tiền dạt mép cuối · cụm thời gian ở ô cuối một dòng danh
sách · nhóm nút trong một cột biểu mẫu · các cột biểu đồ mọc từ một sàn · cụm trạng thái dạt về cuối
một thẻ.

## `ALIGN-4` — chữ khác cỡ đứng trên một dòng viết

**Khi nào gặp.** Hai hay nhiều mẩu chữ KHÁC CỠ phải được đọc thành MỘT GIÁ TRỊ hoặc MỘT CÂU. Đây là mã
làm cho một con số và đơn vị của nó đọc thành một thứ chứ không phải hai.

**Cách nhận ra**

- Mọi con đều là chữ, không con nào là hình.
- Cỡ chữ giữa các con lệch nhau rõ rệt: một số lớn cạnh một nhãn nhỏ.
- Đọc to lên thì thành MỘT cụm từ: "42 bài", "799.000đ mỗi tháng", "4,9 trên 5".

**Tự hỏi.** Đọc to cả hàng lên, nó là MỘT cụm từ hay hai mẩu tin rời nhau?

**Vì sao không phải `ALIGN-1`.** `items-center` treo các con vào TÂM HỘP CHỮ của chúng. Hộp chữ của cỡ
nhỏ thấp hơn hộp chữ của cỡ lớn, nên khi hai tâm trùng nhau thì HAI CHÂN CHỮ LỆCH NHAU. Mắt người đọc
theo chân chữ, không theo tâm hộp — nên cụm bị đọc thành hai thứ. `items-baseline` cho chúng đứng
chung một chân, và cụm trở lại thành một giá trị.

**Ranh giới**

- `ALIGN-1`: có BẤT KỲ con nào là biểu tượng, ảnh đại diện, nhãn trạng thái có nền, ô vuông màu — quay
  về `ALIGN-1`. Ngoại lệ duy nhất là khi "biểu tượng" thực chất là một ký tự chữ.
- `ALIGN-3`: cùng đáy hộp không phải cùng dòng viết. Xem trên.
- `ALIGN-2`: nếu một con là đoạn nhiều dòng, dòng viết chung chỉ còn là dòng ĐẦU TIÊN của nó — đúng
  khi đó là câu tiếp diễn, sai khi đó là một khối riêng.

**Tình huống nghiệp vụ hay gặp.** Số liệu + đơn vị · giá + chu kỳ · điểm + thang điểm · số lượng +
danh từ đếm · giá hiện tại + giá gạch + mức giảm · tên + nhãn phụ cùng dòng · số trang + tổng số trang
· tiêu đề + số đếm nhỏ bên cạnh.

## `ALIGN-5` — một con đi chệch khỏi luật của cha

**Khi nào gặp.** Cha đã tuyên bố một luật đúng cho HẦU HẾT các con, và ĐÚNG MỘT con có lý do nghiệp vụ
riêng để không theo.

**Cách nhận ra**

- Cha là `ALIGN-2` cho phần chữ dài, nhưng một nút hành động phải nằm giữa hàng.
- Cha là `ALIGN-0` cho các cột cao bằng nhau, nhưng một ô chỉ chứa một biểu tượng và không được kéo.
- Số con đi chệch là MỘT. Từ hai con trở lên thì luật của cha đã sai, không phải con đi chệch.

**Tự hỏi.** Nếu bỏ con này ra, luật của cha còn ĐÚNG CHO TẤT CẢ những con còn lại không? Nếu có —
`ALIGN-5`. Nếu không — sửa luật của cha.

**Ranh giới**

- mọi mã trục chéo: `ALIGN-5` KHÔNG thay thế câu trả lời của cha; nó chỉ miễn trừ cho một con. Cha vẫn
  phải mang mã của mình, đọc được, khai báo rõ.
- `ALIGN-7`: một con TỰ dạt về mép cuối trên TRỤC CHÍNH không phải việc của mô-đun này. Đó là một con
  dùng khoảng trắng tự động để đẩy chính nó, và nó thuộc luật lề ngoài.

**Tình huống nghiệp vụ hay gặp.** Một nút nằm giữa hàng trong khi phần chữ neo mép trên · một biểu
tượng không bị kéo trong hàng các cột cao đều · một ô lưới tự kéo hết chiều cao trong khi các ô khác
neo mép trên · một nhãn trạng thái treo giữa trong cụm chữ nhiều dòng.

## `ALIGN-6` — cụm bắt đầu ở mép nội dung, không khai báo

**Khi nào gặp.** Nội dung thuộc về MÉP ĐẦU của luồng đọc, và chỗ trống thừa rơi về phía sau. Đây là mặc
định và là câu trả lời đúng cho tuyệt đại đa số hàng.

**Cách nhận ra**

- Các con nối tiếp nhau theo thứ tự đọc, không con nào "thuộc về" mép cuối.
- Vùng chứa không rộng hơn nội dung, hoặc chỗ thừa không mang nghĩa gì.

**Tự hỏi.** Chỗ trống thừa có MANG NGHĨA không? Nếu không — để nó rơi về sau và không khai báo gì.

**Ranh giới**

- `ALIGN-9`: xem `ALIGN-9`. Đây là ranh giới bị vượt sai nhiều nhất trong cả mô-đun.
- `ALIGN-8`: nội dung thuộc về mép đọc thì ở lại mép đọc. Chỉ nội dung KHÔNG THUỘC VỀ MÉP NÀO mới ra
  giữa.

**Không bao giờ viết `justify-start`.** Nó không nói thêm gì so với mặc định.

**Tình huống nghiệp vụ hay gặp.** Hàng biểu tượng + chữ · cụm nhãn nhỏ lọc · đường dẫn phân cấp · hàng
thẻ phân loại · hàng nút trong một thanh công cụ · mọi hàng nội dung thông thường.

## `ALIGN-7` — cả cụm thuộc về mép cuối

**Khi nào gặp.** TOÀN BỘ nội dung của vùng chứa thuộc về mép cuối theo hướng chảy. Không phải một con
bị đẩy đi — mà cả cụm vốn dĩ ở đó.

**Cách nhận ra**

- Vùng chứa chỉ chứa MỘT LOẠI thứ: một nhóm nút, một cụm meta.
- Thêm một con nữa thì con mới cũng thuộc về mép cuối, đứng cạnh những con đang có.
- Trong cột (`flex-col`), đây là dồn cả cụm về ĐÁY vùng cao hơn nội dung.

**Tự hỏi.** Nếu thêm một con nữa vào vùng chứa này, nó sẽ đứng CẠNH cụm hiện tại ở mép cuối, hay sẽ
tách ra mép đối diện?

**Ranh giới**

- `ALIGN-9`: `ALIGN-7` là MỘT cụm ở mép cuối; `ALIGN-9` là HAI phía đối nghịch. Một chân hộp thoại chỉ
  có nút là `ALIGN-7`; một phần đầu có tiêu đề bên này và nút bên kia là `ALIGN-9`.
- luật lề ngoài: nếu vùng chứa có nhiều thứ bắt đầu từ mép đầu và MỘT con phải nhảy về cuối, đó là con
  tự đẩy mình bằng khoảng trắng tự động — vùng chứa không hề đổi cách xếp.
- `ALIGN-3`: `ALIGN-3` là trục chéo. Trong một hàng, dạt cụm sang mép cuối là `ALIGN-7`; cho các con
  đứng chung một sàn là `ALIGN-3`.

**Tình huống nghiệp vụ hay gặp.** Nhóm nút ở chân một hộp thoại · nhóm nút ở chân biểu mẫu · cụm hành
động ở chân một thẻ · phân trang dạt mép cuối · cụm meta ở cuối một dòng.

## `ALIGN-8` — cụm không thuộc về mép nào

**Khi nào gặp.** Nội dung là một thông báo VỀ CHÍNH vùng chứa nó: nó không tiếp nối luồng đọc từ mép
nào cả, nên đứng giữa chỗ trống.

**Cách nhận ra**

- Vùng chứa rộng hơn hẳn nội dung, và chỗ trống hai bên là CỐ Ý.
- Nội dung nói về CẢ VÙNG: trạng thái rỗng, trạng thái đang tải, lỗi của cả khối.
- Bỏ nội dung đi thì vùng đó trống hoàn toàn.

**Tự hỏi.** Nội dung này TIẾP NỐI luồng đọc từ một mép, hay nó nói về CẢ VÙNG đang trống?

**Ranh giới**

- `ALIGN-6`: nội dung tiếp nối luồng đọc thì ở lại mép đọc, kể cả khi vùng rất rộng.
- luật lề ngoài: căn giữa MỘT KHỐI CÓ BỀ RỘNG GIỚI HẠN trong một cha KHÔNG PHẢI flex là việc của lề
  ngoài. `ALIGN-8` chỉ áp dụng khi cha thật sự là flex hoặc lưới.
- luật kiểu chữ: căn giữa CHỮ BÊN TRONG một hộp là căn chữ, không phải căn hộp. Hai thứ này hay bị
  viết nhầm cho nhau và thường phải viết CẢ HAI mới ra kết quả mong muốn.

**Tình huống nghiệp vụ hay gặp.** Trạng thái rỗng của một danh sách · biểu tượng đang tải giữa một
vùng đang tải · thông báo lỗi của cả khối · một ô vuông chứa ảnh đại diện chữ cái · phân trang căn
giữa · một lời kêu gọi hành động đơn độc giữa một dải.

## `ALIGN-9` — chỗ thừa thuộc về khoảng giữa

**Khi nào gặp.** Hai đầu của vùng chứa có TUYÊN BỐ ĐỐI NGHỊCH lên hai mép, hoặc mọi con NGANG QUYỀN
chia nhau cả chiều dài. Chỗ trống thừa không thuộc về phía nào cả, nên nó nằm GIỮA.

**Cách nhận ra**

- Đầu này là "cái này là gì", đầu kia là "làm gì với nó".
- Hai vai trò KHÔNG đổi chỗ được cho nhau mà nghĩa vẫn giữ nguyên.
- Hoặc: các con là một tập ngang quyền chia đều một dải (`justify-evenly`).

**Tự hỏi.** Nếu thêm một con thứ ba vào, nó có CHỖ ĐỨNG CHÍNH ĐÁNG Ở GIỮA không? Nếu không — hai con
này không đối nghịch, và mã đúng là `ALIGN-6` với con cuối tự đẩy mình.

**Vì sao câu hỏi đó là câu quyết định.** `justify-between` phát biểu rằng MỌI con đều có tuyên bố lên
chỗ trống. Khi người viết chỉ muốn đẩy một con sang cuối, phát biểu đó sai, và cái sai lộ ra đúng lúc
số con thay đổi: một con hiển thị có điều kiện biến mất thì hai con còn lại VĂNG RA HAI MÉP, và bố cục
đổi hình mà không ai sửa gì.

**Ranh giới**

- `ALIGN-6`: xem trên.
- `ALIGN-7`: `ALIGN-7` là một cụm ở mép cuối, `ALIGN-9` là hai phía đối nghịch.
- luật khoảng cách: `justify-between` TIÊU chỗ trống sẵn có, `gap` TẠO khoảng cách. Vùng chứa không
  rộng hơn nội dung thì `justify-between` không làm gì cả — nó "chạy được" trên bản mô phỏng rộng rồi
  hỏng trong một cột hẹp.
- `justify-around` và `justify-evenly` chỉ đúng khi các con NGANG QUYỀN. `around` cho mỗi con một phần
  lề riêng nên mép ngoài hẹp hơn khoảng giữa; `evenly` chia đều mọi khoảng. Nếu không nói được vì sao
  mép ngoài phải hẹp hơn thì dùng `evenly`.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề phần nội dung bên này + nút "Xem tất cả" bên kia · tên mục +
giá trị của mục trong một dòng danh sách · nhãn + giá trị trong một dòng tóm tắt · nút Quay lại + nút
Tiếp tục ở hai đầu · thanh điều hướng dưới cùng chia đều các mục · nhãn cực trị hai đầu một thanh
trượt.

## `ALIGN-10` — các dòng treo vào đâu

**Khi nào gặp.** Vùng chứa cho phép xuống dòng, thực tế đã có NHIỀU DÒNG, và vùng chứa SỞ HỮU một chiều
đo trục chéo lớn hơn tổng các dòng. Lúc đó phải nói các dòng treo vào đâu trong chỗ thừa ấy.

**Cách nhận ra**

- Vùng chứa có `flex-wrap` VÀ một chiều cao (hoặc chiều cao tối thiểu) do nó tự đặt.
- Số dòng thay đổi theo dữ liệu, còn chiều cao thì không.

**Tự hỏi.** Vùng chứa này có THẬT SỰ sở hữu một chiều đo trục chéo lớn hơn nội dung không? Nếu không —
không có chỗ thừa nào để chia, và mã này không phát ra gì.

**Ranh giới**

- `ALIGN-0` … `ALIGN-4`: những mã kia nói CÁC CON TRONG MỘT DÒNG treo vào đâu; `ALIGN-10` nói CÁC DÒNG
  TRONG VÙNG CHỨA treo vào đâu. Một vùng chứa xuống dòng có thể mang cả hai, và chúng trả lời hai câu
  khác nhau.
- **Câu trả lời đúng thường là bỏ chiều cao đi.** Phần lớn trường hợp cần `content-*` là trường hợp
  vùng chứa được gán một chiều cao mà nó không kiếm được. Chỉ khai báo khi chiều cao đó có lý do nghiệp
  vụ thật.

**Tình huống nghiệp vụ hay gặp.** Dải nhãn nhỏ lọc trong một thanh công cụ cao cố định · lưới huy hiệu
trong một ô cao cố định · nhóm nút xuống dòng trong một thanh có chiều cao tối thiểu.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| vùng chứa | Phần tử có thật sự khai báo `flex`, `inline-flex` hoặc `grid` hay không |
| trục | Hướng chảy của cụm, từ đó suy ra trục nào là trục chéo |
| các con | Chỉ các con trực tiếp, và chiều đo trục chéo mà mỗi con sở hữu |
| bản chất | Mỗi con là chữ, là hộp có ranh giới, hay là điều khiển kích thước cố định |
| khả năng dài ra | Chiều đo trục chéo của con nào có thể đổi theo dữ liệu thật |
| chỗ thừa | Vùng chứa có thể dài hơn nội dung trên trục chính hay không |
| vai trò | Hai con ở hai đầu có tuyên bố đối nghịch lên hai mép đó hay không |

## Quy tắc

1. Class căn chỉnh chỉ hợp lệ trên phần tử khai báo `flex`, `inline-flex` hoặc `grid`. Trên thứ khác,
   nó không hiển thị gì và không phát biểu gì.
2. Mỗi vùng chứa trả lời trục chéo một lần và trục chính một lần. Hai câu trả lời độc lập, được phép
   cùng có mặt trên một nút DOM.
3. Căn chỉnh tiêu chỗ trống đã có. Nó không bao giờ tạo khoảng cách giữa các con; đó là `gap` của cha.
4. Căn chỉnh dịch chuyển hộp. Nó không bao giờ căn hình dạng ký tự bên trong một hộp.
5. Căn chỉnh không bao giờ đổi chiều đo của một con. Con phải rộng bằng anh em nó là quyết định về
   kích thước, không phải về căn chỉnh.
6. `start` và `end` là lô-gic. Không có luật nào trong mô-đun này nói tới trái hay phải.
7. Chọn mã theo BẢN CHẤT của các con, không theo cái dữ liệu hôm nay hiển thị ra.
8. Một con nhảy sang mép cuối một mình KHÔNG phải câu trả lời trục chính của vùng chứa.

Ngoài ra: mọi vùng chứa flex hoặc lưới được hiển thị ra đều rơi vào đúng một mã cho mỗi trục. Không
vùng chứa nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là MỘT PHẦN của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó
áp dụng vào.

- **Biểu tượng cạnh chữ.** Luôn là `ALIGN-1`, không bao giờ là `ALIGN-4`. Chân của một biểu tượng là hệ
  quả của cái hộp bao nó, không phải một dòng viết; treo một hình vào dòng viết sẽ đặt nó thấp hơn chỗ
  mắt người đọc chờ đợi.
- **Chữ có thể xuống dòng.** Một hàng mà phần chữ có thể dài sang dòng thứ hai là `ALIGN-2` chứ không
  phải `ALIGN-1`, ngay từ đầu, kể cả khi dữ liệu hôm nay còn một dòng. Treo vào giữa một khối đang dài
  ra sẽ làm con cố định dịch chỗ mỗi lần câu chữ đổi độ dài.
- **Các con cao bằng nhau.** `ALIGN-0` và `ALIGN-2` hiển thị y hệt cho tới ngày một con có ranh giới
  riêng hoặc dài ra. Chọn theo quyền sở hữu ranh giới, không theo cái nhìn thấy.
- **Hai con và một con thứ ba tuỳ chọn.** `ALIGN-9` chỉ đúng khi hai đầu đối nghịch về vai trò. Nếu
  con thứ ba không có chỗ đứng chính đáng ở giữa thì con cuối đang tự đẩy mình đi, và trục chính vẫn là
  `ALIGN-6`.
- **Cha không phải flex hay lưới.** Mô-đun này không phát ra gì. Căn giữa một khối có bề rộng giới hạn
  trong chỗ trống nội tuyến của cha là quyết định về lề ngoài.
- **Trục chính không có chỗ thừa.** `ALIGN-7`, `ALIGN-8` và `ALIGN-9` không làm gì khi nội dung đã lấp
  đầy vùng chứa. Khai báo vẫn đúng; trông cậy vào chúng để tạo khoảng cách thì sai.
- **Tính đồng nhất trạng thái.** Giữ nguyên mã qua mọi khung nhìn, mọi hướng chảy và mọi trạng thái
  tải, trừ khi chính vùng chứa đổi. Khung chờ và nội dung thật treo vào cùng một thứ.
- **Đổi hàng thành cột.** Khi `flex-row` đổi thành `flex-col` ở màn hình hẹp, TRỤC CHÉO XOAY, nên
  `items-center` đang có nghĩa "cùng cao" bỗng có nghĩa "cùng dạt vào giữa theo chiều ngang". Đây không
  phải ngoại lệ cho phép đổi mã tuỳ ý — nó là lý do phải nêu lại mã ở mỗi điểm ngắt mà hướng chảy đổi.

## Đầu ra

Mỗi phần tử một khối, từ ngoài vào trong:

```text
container: <flex | inline-flex | grid | none>
axis:      <row | column>
children:  <các con trực tiếp và chiều đo trục chéo mà mỗi con sở hữu>
cross:     <ALIGN-0 | ALIGN-1 | ALIGN-2 | ALIGN-3 | ALIGN-4>
departure: <ALIGN-5 trên con được gọi tên, hoặc none>
main:      <ALIGN-6 | ALIGN-7 | ALIGN-8 | ALIGN-9>
lines:     <ALIGN-10 khi vùng chứa xuống dòng và sở hữu chỗ thừa trục chéo, hoặc none>
className: <không khai báo căn chỉnh | items-* | self-* | justify-* | content-*>
reason:    <sự thật nghiệp vụ loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Một hàng cài đặt, tên cài đặt một bên và một công tắc bên kia; ngay dưới đó là một bình
luận gồm ảnh đại diện tròn đứng cạnh tên người bình luận và nội dung bình luận."

Yêu cầu này nói ra ba vùng chứa: hàng cài đặt, hàng bình luận, và cụm chữ bên trong bình luận giữ tên
người bình luận phía trên nội dung. Nó không nói tới thẻ bao quanh, không nói tới tiêu đề, không nói
tới chiều cao cố định và không nói tới việc xuống dòng, nên không có gì rơi vào `ALIGN-10`; cũng không
con nào được mô tả là đi chệch khỏi luật của cha, nên không phát ra `ALIGN-5` nào.

```text
container: flex
axis:      row
children:  tên cài đặt (một dòng chữ), công tắc (điều khiển kích thước cố định)
cross:     ALIGN-1
departure: none
main:      ALIGN-9
lines:     none
className: flex items-center justify-between gap-4
reason:    công tắc là điều khiển cố định mà kéo dãn sẽ làm méo, điều này loại trừ ALIGN-0; tên nói cài đặt này là gì còn công tắc tác động lên nó, hai vai trò không đổi chỗ được, điều này loại trừ ALIGN-6
```

```text
container: flex
axis:      row
children:  ảnh đại diện (kích thước cố định), cụm chữ (dài ra được thành nhiều dòng)
cross:     ALIGN-2
departure: none
main:      ALIGN-6
lines:     none
className: flex items-start gap-3
reason:    nội dung bình luận có thể xuống dòng thứ hai và ảnh đại diện phải đứng ngang dòng đầu tiên, điều này loại trừ ALIGN-1; chỗ trống sau bình luận không mang nghĩa gì, điều này loại trừ ALIGN-9
```

```text
container: flex
axis:      column
children:  tên người bình luận (chữ), nội dung bình luận (chữ, nhiều dòng)
cross:     ALIGN-2
departure: none
main:      ALIGN-6
lines:     none
className: flex flex-col items-start gap-1
reason:    trong một cột, trục chéo là chiều ngang và cả hai con phải dạt về mép đầu chứ không nhận bề rộng của con dài nhất, điều này loại trừ ALIGN-0
```

Nếu về sau yêu cầu nói hàng cài đặt là một tiêu đề có tên và một số đếm nhỏ bên cạnh, thì cặp đó toàn
là chữ hai cỡ đọc thành một cụm từ, tức `ALIGN-4`. Nếu yêu cầu nói bình luận có thêm một nút hành động
phải nằm giữa hàng trong khi phần chữ vẫn neo mép trên, thì cha giữ nguyên `ALIGN-2` và một mình cái
nút khai báo `ALIGN-5`.

## Phạm vi

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường.
