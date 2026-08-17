---
title: Responsive · Vietnamese
---

# Thiết kế đáp ứng

Đầu vào là một yêu cầu viết bằng lời thường — "một thanh bộ lọc đứng cạnh vùng kết quả, kết quả là các
thẻ" — và đầu ra là, với **mỗi vùng** mà yêu cầu đó ngụ ý, một mã tình huống và một className. Yêu cầu
không bao giờ nói ra một điểm ngắt, và không được phép ước lượng một điểm ngắt: phép biến đổi suy ra từ
**lỗi nội dung đã quan sát được**, còn ngưỡng chính là bề rộng mà lỗi đó được quan sát.

## Luật

Một bố cục đổi hình học **tại đúng điểm nội dung bắt đầu hỏng**, và đổi bằng **phép biến đổi nhỏ nhất**
sửa được chỗ hỏng đó. Chọn phép biến đổi từ lỗi quan sát được, không bao giờ từ tên một màn hình, một
ảnh chụp thiết bị, hay mong muốn cho bố cục "trông thiết bị di động hơn".

Thành phần nào sở hữu hình học thì thành phần đó sở hữu các class thiết kế đáp ứng. Bên sử dụng không
với tay vào vá điểm ngắt cho ruột của con, vì một điểm ngắt viết từ bên ngoài là một điểm ngắt viết mà
không có phép đo biện minh cho nó.

Ở mọi bề rộng, bản hiển thị giữ **một** thứ tự DOM, **một** thứ tự đọc, **một** thứ tự tiêu điểm và
**một** tập việc người dùng làm được. Thiết kế đáp ứng đổi chỗ ngồi. Nó không đổi màn hình đó dùng để
làm gì, nói cái gì, hay người ta làm được gì trên đó.

**Đây là luật bắt buộc.** Mọi vùng hiển thị ra đều rơi vào đúng một mã dưới đây, kể cả những vùng không
cần class nào — đó là `RESPONSIVE-1`, và `RESPONSIVE-1` là một **quyết định phải bảo vệ được**, không
phải chỗ luật bị bỏ quên. Không có kích thước nào nhỏ đến mức được miễn: một hàng hai nút có tình huống
thiết kế đáp ứng của nó, đúng cùng một lý do mà một khung trang có thanh bộ lọc cũng có. Câu "có mỗi hai
cái nút thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `RESPONSIVE-<chỉ số>`. Mã gọi tên TÌNH HUỐNG; cột
className gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có một mã không phát ra
gì cả.

Các mã được xếp theo mức độ can thiệp của phép sửa, cũng chính là thứ tự người đọc gặp chúng: trước hết
hỏi xem có gì hỏng không, rồi với tay lấy phép sửa rẻ nhất và dừng ở phép sửa đầu tiên hết hỏng.

| Mã | Tình huống | className |
|---|---|---|
| `RESPONSIVE-1` | Không có gì hỏng ở mọi bề rộng được hỗ trợ; bố cục gốc tự nó đã đúng | *không khai báo class thiết kế đáp ứng* |
| `RESPONSIVE-2` | Các phần tử ngang hàng nội tuyến vẫn là một chuỗi, chỉ cần thêm dòng | `flex flex-wrap` |
| `RESPONSIVE-3` | Một hàng hết dùng được, nhưng vẫn đúng những vế đó và đúng thứ tự đó khi xếp dọc | `flex flex-col sm:flex-row` tại ngưỡng đã thử |
| `RESPONSIVE-4` | Các phần tử lặp lại ngang hàng cần bớt rãnh khi bề rộng giảm | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` tại các ngưỡng đã thử |
| `RESPONSIVE-5` | Nội dung mà ý nghĩa nằm ở CHÍNH sự sắp ngang, không dàn lại được | chủ sở hữu `max-w-full overflow-x-auto`; con `min-w-max` |
| `RESPONSIVE-6` | Một vùng thường trực đổi thành một thành phần điều khiển gọn, tương đương và vẫn tới được | cặp `hidden md:block` và `md:hidden`, một trạng thái, một đường tiêu điểm |

`RESPONSIVE-1` LÀ MỘT TÌNH HUỐNG, KHÔNG PHẢI MỘT PHÉP BIẾN ĐỔI. Nó không phát ra class nào, và nó không
được diễn đạt bằng một điểm ngắt lặp lại đúng cơ sở — `sm:flex-row` trên thứ vốn đã là hàng,
`lg:grid-cols-3` trên lưới vốn đã ba cột, `md:block` trên khối vốn đang hiện. Những thứ đó tuyên bố rằng
có một bề rộng quan trọng, trong khi không bề rộng nào quan trọng cả. Mã này tồn tại vì "chỗ này không
có gì hỏng" là một trường hợp người đọc phải nhận ra, trích dẫn được và bị bắt lỗi được; một tình huống
không có tên là một tình huống không ai chứng minh được là đã làm sai.

Các tiền tố điểm ngắt trong bảng (`sm:`, `md:`, `lg:`) chỉ là **chỗ điền** cho một ngưỡng ĐÃ ĐO, không
phải một phần của đáp án. Tiền tố được đưa vào sản phẩm là tiền tố tại bề rộng mà nội dung được quan sát
là hết dùng được. Một tiền tố chọn vì thiết bị đó được gọi là máy tính bảng là một con số bịa mặc áo tiện
ích class.

## Đọc một yêu cầu

1. **Liệt kê những vùng mà yêu cầu nói ra.** "Một thanh bộ lọc đứng cạnh vùng kết quả, kết quả là các
   thẻ" nói ra ba vùng: khung trang chứa thanh lọc và cột kết quả, cột kết quả, và danh sách thẻ bên
   trong nó.
2. **Không bịa ra vùng mà yêu cầu không hề nhắc.** Ruột một thẻ, phần chân trang hay một cái bảng không
   nằm trong yêu cầu đó. Giải cái được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong**, rồi tới từng chủ sở hữu lồng bên trong. Mỗi chủ sở hữu có đáp án riêng;
   chủ sở hữu không bao giờ thừa hưởng mã của con nó, và ngưỡng thuộc về vùng chứa chứ không thuộc về
   khung nhìn.
4. **Với mỗi chủ sở hữu, gọi tên các con trực tiếp và lỗi quan sát được**, rồi hỏi câu hỏi nằm trong
   phần của từng mã, bắt đầu từ `RESPONSIVE-1` và dừng ở mã đầu tiên có tình huống khớp. Phép sửa rẻ
   nhất khiến lỗi hết chính là đáp án.
5. **Nếu không quan sát được lỗi nào, đáp án là `RESPONSIVE-1`.** Thiếu phép đo không phải giấy phép để
   đoán: một lưới không có bề rộng tối thiểu đã thử thì rơi về một cột.
6. **Nếu một chủ sở hữu trộn nhiều tình huống, phải lồng phân cấp trước rồi mới chọn.** Nếu hai mã liền
   kề cùng khớp, chọn mã có chỉ số nhỏ hơn.

## `RESPONSIVE-1` — không có gì hỏng

**Tình huống.** Ở mọi bề rộng được hỗ trợ, không có va chạm, không bị cắt, không có thành phần điều
khiển nào nhỏ dưới mức bấm được, không có chữ nào bị đẩy ra ngoài ô của nó. Bố cục gốc — vốn đã viết cho
trạng thái hẹp nhất — tự nó đã đúng. Vùng này **không sở hữu** một phép biến đổi nào.

**Dấu hiệu nhận biết**

- Thu khung nhìn về bề rộng hẹp nhất được hỗ trợ mà không thấy thứ gì hỏng.
- Nội dung vốn đã tự xuống dòng được, hoặc vốn đã là một cột.
- Yêu cầu duy nhất nghe được là "cho nó thiết kế đáp ứng đi", "nhìn thiết bị di động hơn" — không ai chỉ
  ra được cái gì hỏng.
- Chỗ hẹp bị kêu thật ra là một dòng chữ dài trong một phần tử con flex, sửa bằng `min-w-0` chứ không
  phải bằng điểm ngắt.

**Tự hỏi.** Ở bề rộng hẹp nhất được hỗ trợ, CÁI GÌ đang hỏng? Nếu không gọi tên được — dừng lại, đây là
`RESPONSIVE-1`.

**Ranh giới**

- `RESPONSIVE-2`: chỉ lên `2` khi đã THẤY các phần tử ngang hàng đè nhau hoặc bị đẩy tràn, không phải
  khi đoán rằng có ngày chúng sẽ tràn.
- `RESPONSIVE-3`: một hàng chật chưa phải một hàng hỏng. Hỏng nghĩa là có phần tử tụt xuống dưới bề rộng
  dùng được của nó, hoặc bị cắt mất.
- Mọi mã khác: thiếu bằng chứng thì đáp án luôn là mã này. Đây là mặc định an toàn của cả mô-đun.

**Không viết điểm ngắt rỗng.** `sm:flex-row` trên thứ vốn đã là hàng, `lg:grid-cols-3` trên lưới vốn đã
ba cột, `md:block` trên khối vốn đang hiện — mỗi cái đều tuyên bố rằng có một bề rộng quan trọng, trong
khi không có. `RESPONSIVE-1` là mã tình huống, không phải tên class.

**Tình huống nghiệp vụ hay gặp.** Một cột nội dung đọc dọc · biểu mẫu một cột · một khối văn bản · thẻ
đơn lẻ · trạng thái rỗng có một dòng chữ và một nút · hộp thoại nội dung ngắn · một cụm nhãn trạng thái ·
đường dẫn phân cấp ngắn · bảng điều khiển chỉ có một biểu đồ đã tự co giãn.

## `RESPONSIVE-2` — vẫn một chuỗi, chỉ cần thêm dòng

**Tình huống.** Các phần tử là phần tử ngang hàng nội tuyến: chúng không có gì bắt buộc phải nằm chung
một dòng, số lượng có thể không biết trước, và việc phần tử cuối rơi xuống dòng dưới không làm mất nghĩa
gì cả. Chuỗi vẫn là một chuỗi, chỉ dài ra theo chiều dọc.

**Dấu hiệu nhận biết**

- Số lượng phần tử do dữ liệu quyết định: thẻ, nhãn nhỏ lọc, nhãn, tác giả, kỹ năng.
- Độ dài nhãn thay đổi theo ngôn ngữ hoặc theo dữ liệu người dùng nhập.
- Bỏ một phần tử ra khỏi dòng đầu không làm ai hiểu sai điều gì.
- Không có phần tử nào là "vế trái" hay "vế phải" của một quan hệ hai bên.

**Tự hỏi.** Nếu phần tử cuối rơi xuống dòng dưới, có ai hiểu sai gì không? Nếu không — `RESPONSIVE-2`.

**Ranh giới**

- `RESPONSIVE-1`: `2` cần một tràn QUAN SÁT ĐƯỢC, không phải một dự đoán.
- `RESPONSIVE-3`: `3` dành cho một quan hệ hai vế (tiêu đề và nhóm hành động, ô nhập liệu và nút) mà cả
  hai vế cùng đổi trục một lần. `2` là nhiều phần tử ngang hàng đồng hạng tự tìm chỗ. Nếu bạn phải hỏi
  "vế nào xuống trước", đó là `3`.
- `RESPONSIVE-4`: `4` dành cho các phần tử lặp lại có bề rộng tối thiểu đo được và cần thẳng rãnh. Nếu
  việc thẳng cột không quan trọng thì `2` rẻ hơn và đúng hơn.
- `RESPONSIVE-5`: nếu vị trí ngang của các phần tử LÀ thông tin — thứ tự thời gian, cột so sánh — thì
  xuống dòng sẽ phá nghĩa, đó là `5`.

**Tình huống nghiệp vụ hay gặp.** Danh sách thẻ · nhãn nhỏ bộ lọc đang bật · nhóm nút phụ trong thanh
công cụ · siêu dữ liệu dưới tiêu đề (tác giả · ngày · thời lượng · mức độ) · danh sách kỹ năng trong hồ
sơ · nhãn trạng thái của một đơn hàng · các nút chia sẻ · danh sách người tham gia dạng ảnh đại diện +
tên · nhóm nhãn trạng thái chứng chỉ.

## `RESPONSIVE-3` — hàng hết dùng được, xếp dọc thì vẫn đúng

**Tình huống.** Hai (hoặc vài) nhóm tạo thành một quan hệ có hai vế trên một hàng. Khi hẹp, ít nhất một
vế tụt xuống dưới bề rộng dùng được của nó — chữ bị cắt, ô nhập liệu còn vài ký tự, nút chồng lên nhau.
Cũng những vế đó, cũng thứ tự đó, xếp dọc thì vẫn đọc đúng.

**Dấu hiệu nhận biết**

- Có thể gọi tên từng vế: "cụm tiêu đề" và "cụm hành động"; "ô nhập" và "nút gửi".
- Ở trạng thái hẹp, đọc từ trên xuống vẫn ra đúng câu chuyện như đọc từ trái sang phải khi rộng.
- Không vế nào biến mất, không vế nào đổi mức ưu tiên.
- Chỉ có TRỤC đổi. Khoảng cách giữa hai vế, khoảng đệm trong và phân cấp đều giữ nguyên.

**Tự hỏi.** Vẫn đúng những vế đó và đúng thứ tự đó khi xếp dọc chứ? Nếu phải đảo thứ tự mới xuôi thì
DỪNG — đó là thiết kế lại tác vụ, không phải thiết kế đáp ứng.

**Ranh giới**

- `RESPONSIVE-2`: xem trên. `2` không có khái niệm "vế".
- `RESPONSIVE-4`: `3` là những vế KHÁC NHAU đổi trục; `4` là những phần tử GIỐNG NHAU đổi số rãnh. Tiêu
  đề cạnh nhóm hành động là `3`; mười hai thẻ khoá học là `4`.
- `RESPONSIVE-6`: `3` giữ cả hai vế hiện ra, chỉ đổi trục. Nếu một vế BIẾN MẤT và được thay bằng một
  thành phần điều khiển khác thì đó là `6`, và `6` phải trả được các điều kiện của nó.

**Tình huống nghiệp vụ hay gặp.** Phần đầu trang: tiêu đề + mô tả bên trái, nhóm nút bên phải · ô nhập
mã giảm giá + nút áp dụng · thanh tìm kiếm + nút lọc · phần cuối của hộp thoại với Huỷ và Xác nhận · một
hàng tóm tắt hoá đơn: tên gói bên trái, giá bên phải · khối giá + nút ghi danh · cụm ảnh đại diện + tên +
nút theo dõi.

## `RESPONSIVE-4` — các phần tử lặp lại cần bớt rãnh

**Tình huống.** Một tập phần tử cùng loại, ngang hàng, lặp lại, mỗi phần tử có một bề rộng tối thiểu ĐÃ
ĐO mà hẹp hơn thế thì hết đọc được hoặc hết dùng được. Khi vùng chứa hẹp lại, số rãnh giảm dần. Thứ tự
các phần tử không đổi; chỉ số rãnh đổi.

**Dấu hiệu nhận biết**

- Các phần tử hiển thị ra từ một vòng lặp trên cùng một loại dữ liệu.
- Mỗi phần tử có cùng cấu trúc bên trong, cùng vai trò.
- Việc thẳng cột, thẳng hàng giữa các phần tử có ý nghĩa với người đọc — đó chính là thứ khiến người ta
  so sánh và quét mắt được.
- Bạn có một con số thật cho "hẹp hơn mức này thì phần tử không đọc được nữa".

**Tự hỏi.** Đây là những phần tử giống nhau lặp lại, và bạn có bề rộng tối thiểu đo được cho một phần tử
chưa? Nếu chưa có con số đó, đừng bịa ngưỡng — để một cột.

**Ranh giới**

- `RESPONSIVE-2`: xuống dòng cũng chứa hết được, nhưng xuống dòng không thẳng cột. Nếu người đọc cần so
  sánh giữa các phần tử thì `4`; nếu chỉ cần đọc hết thì `2` rẻ hơn.
- `RESPONSIVE-3`: xem trên.
- `RESPONSIVE-5`: nếu THỨ TỰ NGANG của các phần tử là thông tin — mốc thời gian, các cột của một phép so
  sánh — thì việc rớt xuống dòng dưới sẽ phá nghĩa, đó là `5`.

**Tình huống nghiệp vụ hay gặp.** Lưới thẻ khoá học · lưới sản phẩm · thư viện ảnh · lưới ô số liệu ·
danh sách bài viết dạng thẻ · lưới thành viên nhóm · các gói giá đặt cạnh nhau · lưới bài tập · danh
sách tệp dạng tile.

## `RESPONSIVE-5` — nghĩa nằm ở chính sự sắp ngang

**Tình huống.** Nội dung mà quan hệ giữa các phần chính là vị trí ngang của chúng: cột của một bảng, các
mốc trên một trục thời gian, các nút và đường nối của một sơ đồ. Xuống dòng hay xếp dọc không phải là
sắp xếp lại, mà là xoá mất thông tin. Vì vậy vùng đó được cuộn ngang — nhưng cuộn BÊN TRONG CHỦ SỞ HỮU
CỦA NÓ, và trang thì không bao giờ cuộn ngang.

**Dấu hiệu nhận biết**

- Có thể chỉ ra một câu người dùng đọc được NHỜ sự thẳng hàng: "cột này so với cột kia".
- Bỏ một cột đi hoặc đẩy nó xuống dòng là mất một phép so sánh.
- Nội dung có bề rộng nội tại: bảng, sơ đồ, dòng mã, khuông nhạc, biểu đồ gantt.

**Tự hỏi.** Nếu cho phần này dàn lại sang trục khác, có phép so sánh nào BIẾN MẤT không? Phải trả lời
được có, kèm một ví dụ cụ thể, mới được dùng mã này.

**Ranh giới**

- `RESPONSIVE-2` và `RESPONSIVE-4`: đây là mã CUỐI CÙNG được chọn, không phải mã tiện nhất. Cuộn ngang
  bắt người dùng làm thêm việc; chỉ trả cái giá đó khi dàn lại thật sự phá nghĩa.
- `RESPONSIVE-6`: nếu bạn định GIẤU BỚT CỘT khi hẹp, đó không còn là `5`. Giấu nội dung phải đi qua các
  điều kiện của `6`, và cột số liệu thiết yếu thì không được giấu.

**Bề rộng nội tại, không phải số cứng.** Con trong vùng cuộn dùng `min-w-max` — để chính nội dung khai
báo bề rộng của nó. Một con số cứng (`min-w-[720px]`) hay một biến riêng của dự án là một lời đoán, và
nó sai ngay khi ngôn ngữ đổi hoặc dữ liệu dài ra.

**Tình huống nghiệp vụ hay gặp.** Bảng dữ liệu nhiều cột · bảng so sánh gói dịch vụ · trục thời gian có
mốc và đường nối · sơ đồ kiến trúc · biểu đồ gantt · lịch theo tuần · khối mã có dòng dài · bảng kết quả
benchmark.

## `RESPONSIVE-6` — vùng thường trực đổi thành thành phần điều khiển tương đương

**Tình huống.** Ở bề rộng lớn, một vùng thường trực luôn hiện (thanh dọc lọc, điều hướng mở rộng, khung
phụ). Ở bề rộng hẹp, vùng đó không còn chỗ, và nó được thay bằng MỘT thành phần điều khiển gọn dẫn tới
đúng nội dung ấy. Đây là mã đắt nhất, vì nó là mã duy nhất khiến DOM có hai cách biểu diễn cho một việc.

**Dấu hiệu nhận biết**

- Vùng đó là một VÙNG BỐ CỤC có hình học riêng, không phải một cụm chữ.
- Có thể gọi tên thành phần điều khiển thay thế — một nút mở khung, một nút trình đơn — và nó ĐÃ TỒN
  TẠI, không phải sẽ làm sau.
- Cả hai cách biểu diễn đọc CÙNG MỘT trạng thái: cùng số bộ lọc đang bật, cùng mục đang chọn.

**Tự hỏi.** Có ĐÚNG MỘT thành phần điều khiển thay thế dẫn tới cùng tác vụ đó với cùng trạng thái đó, và
tiêu điểm quay về đúng chỗ khi đóng, không? Thiếu một trong ba — từ chối mã này và giữ nội dung hiện ra.

**Ranh giới**

- `RESPONSIVE-3`: `3` giữ cả hai vế hiện ra và chỉ đổi trục. Chỉ dùng `6` khi việc xếp dọc THẬT SỰ không
  dùng được, chứ không phải vì trông rườm rà.
- "giấu cho gọn": giấu mà không có đường thay thế KHÔNG PHẢI một mã. Đó là một lỗi. Nội dung thiết yếu
  không bao giờ được giấu.

**Hai biểu diễn, một trạng thái.** Nếu mỗi bên giữ trạng thái riêng, người dùng xoay máy một cái là thấy
bộ lọc của mình biến mất. Trạng thái nằm ở chủ sở hữu, cả hai bên chỉ đọc nó.

**Tình huống nghiệp vụ hay gặp.** Thanh bộ lọc dọc được thay bằng nút "Bộ lọc · 3" · thanh điều hướng
ngang được thu vào nút trình đơn · mục lục bên cạnh được thay bằng nút "Nội dung khoá học" · khung chi
tiết cạnh danh sách chuyển thành trang chi tiết riêng · phần tóm tắt giỏ hàng chuyển thành thanh tổng
tiền ghim dưới đáy.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| chủ sở hữu | Đúng một thành phần sở hữu phần hình học đang đổi |
| các phần tham gia | Các con trực tiếp có cách sắp đặt thay đổi |
| lỗi | `none`, `wrap-needed`, `row-unusable`, `tracks-too-narrow`, `horizontal-meaning`, `region-to-control` |
| bề rộng tối thiểu dùng được | Một ngưỡng đã đo hoặc đã thử cho từng phần tham gia, không phải bề rộng thiết bị |
| tính thiết yếu | Nội dung hoặc tác vụ đó có bắt buộc cho mục đích của trang không |
| đường thay thế | `none`, hoặc đúng một thành phần điều khiển có tên dẫn tới cùng tác vụ với cùng trạng thái |
| các trạng thái | Đang tải, rỗng, lỗi và sẵn sàng cùng một chủ sở hữu |

Thứ gì không có trong danh sách này thì không được coi là lý do. Mật độ thẩm mỹ, một ảnh chụp điện
thoại, và câu "nhìn chật quá" không chọn ra được gì cả.

## Quy tắc

1. Class gốc mô tả trạng thái hẹp nhất được hỗ trợ; mọi điểm ngắt là ghi đè min-width chồng lên trên.
   Mô-đun này không có tư duy max-width.
2. Điểm ngắt đánh dấu một điểm nội dung hỏng. Nó không bao giờ đánh dấu một thiết bị.
3. Một thứ tự DOM, một thứ tự đọc, một thứ tự tiêu điểm, ở mọi bề rộng. CẤM `order-*` theo điểm ngắt: nó
   kể một câu chuyện thứ hai mà DOM không kể, còn trình đọc màn hình và bàn phím chỉ nhận được câu
   chuyện thứ nhất.
4. Đổi trục không đổi khoảng cách, khoảng đệm trong, phân cấp hay ngữ nghĩa. Một cụm xếp dọc và một hàng
   của cùng những phần tham gia mang cùng một quan hệ, nên mang cùng một đường nối.
5. Chủ sở hữu hình học viết các class thiết kế đáp ứng. Bên sử dụng không vá vào ruột của con.
6. Không bao giờ giấu nội dung thiết yếu. Cặp khả năng hiển thị chỉ được chấp nhận khi có đường thay thế
   tương đương, trạng thái dùng chung và đường tiêu điểm xác định.
7. Xuống dòng hoặc xếp dọc TRƯỚC, rồi mới tính tới thu nhỏ. Không bao giờ hạ chữ, vùng bấm hay thành
   phần điều khiển xuống dưới mức dùng được chỉ để giữ một dòng.
8. Đang tải, rỗng, lỗi và sẵn sàng dùng cùng chủ sở hữu, cùng rãnh, cùng điểm neo. Trạng thái mạng không
   phải là một bố cục.

Ngoài ra: một mã tình huống ứng với đúng một phép biến đổi, không phép biến đổi nào phục vụ hai mã, và
mọi vùng hiển thị ra đều rơi vào đúng một mã. Không vùng nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Không có lỗi quan sát được.** Không có va chạm, không có chỗ bị cắt, không có lỗi dùng được chứng
  minh ra thì đáp án là `RESPONSIVE-1`: giữ bố cục gốc, không thêm gì. "Làm cho nó thiết kế đáp ứng"
  không phải bằng chứng.
- **Không có bề rộng tối thiểu được khai báo.** Đừng bịa ngưỡng lưới. `RESPONSIVE-4` thiếu con số đã thử
  thì rơi về một cột — số cột duy nhất không thể sai.
- **Chưa chứng minh dàn lại phá nghĩa.** `RESPONSIVE-5` đòi bằng chứng rằng một trục mới phá mất quan
  hệ. Chỗ nào xuống dòng hoặc xếp dọc mà nghĩa vẫn còn thì `RESPONSIVE-2` hoặc `RESPONSIVE-3` thắng;
  cuộn có biên là phương án cuối, không phải phương án tiện.
- **Không có đường thay thế.** Thiếu một thành phần điều khiển có tên dẫn tới cùng tác vụ với cùng trạng
  thái thì `RESPONSIVE-6` bị từ chối và nội dung ở nguyên chỗ hiện ra.
- **Chữ tràn trước, bố cục tràn sau.** Một tiêu đề dài sửa trong chính ô của nó trước — `min-w-0`, cho
  xuống dòng, hoặc truncate nhưng giữ đủ giá trị cho trợ năng — trước khi nghĩ tới bất kỳ mã nào trên
  `RESPONSIVE-1`. Phần tử con flex mặc định không nhỏ hơn nội dung của nó, nên rất nhiều "vỡ ở màn hẹp"
  là thiếu `min-w-0` chứ không phải thiếu điểm ngắt.
- **Hai mã liền kề cùng khớp.** Chọn mã có chỉ số nhỏ hơn — phép sửa rẻ hơn. Chỉ hỏi MỘT câu phân định
  khi bên yêu cầu nói rõ họ cần phép biến đổi can thiệp nhiều hơn mà không nêu được lỗi bắt buộc nó.
- **Tính đồng nhất trạng thái.** Khung chờ, rỗng và lỗi hiển thị trong cùng chủ sở hữu và mang cùng mã
  với trạng thái đã tải xong. Đổi mã lúc đang tải là nói dối về hình học.

## Đầu ra

Mỗi vùng một khối, từ ngoài vào trong:

```text
owner: <thành phần sở hữu hình học>
participants: <các con trực tiếp có cách sắp đặt thay đổi>
situation: <RESPONSIVE-1 | RESPONSIVE-2 | RESPONSIVE-3 | RESPONSIVE-4 | RESPONSIVE-5 | RESPONSIVE-6>
className: <không class thiết kế đáp ứng | chuỗi class chính xác, viết từ cơ sở lên>
threshold: <bề rộng lỗi đã đo, hoặc "none">
reason: <lỗi nội dung quan sát được, loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Trang danh mục khoá học: một thanh bộ lọc đứng cạnh vùng kết quả. Phía trên kết quả có một
dòng ghi số khoá phù hợp và một ô sắp xếp. Dưới đó là các thẻ khoá học. Đã đo: dưới `sm` thì một thẻ đã
chiếm hết bề rộng đọc được, tại `sm` hai thẻ vẫn trên mức tối thiểu, và trong cột kết quả thì ba thẻ chỉ
vừa từ `xl`. Khi thanh lọc không còn chỗ, nó đổi thành nút Bộ lọc mở đúng các bộ lọc ấy, đọc cùng lựa
chọn ấy, và trả tiêu điểm về nút khi đóng."

Yêu cầu này nói ra ba chủ sở hữu: khung trang chứa thanh lọc và cột kết quả, hàng tóm tắt phía trên kết
quả, và danh sách thẻ. Nó không nói gì về ruột một thẻ, không nói gì về chân trang, không nói gì về một
cái bảng, nên không giải những thứ đó.

```text
owner: khung trang danh mục
participants: thanh bộ lọc, cột kết quả
situation: RESPONSIVE-6
className: thanh lọc hidden lg:block; nút mở lg:hidden
threshold: lg
reason: thanh lọc biến mất và đúng một nút có tên dẫn tới cùng bộ lọc với cùng lựa chọn và có đường tiêu điểm quay về, điều này loại trừ RESPONSIVE-3 — RESPONSIVE-3 sẽ giữ cả hai vế hiện ra
```

```text
owner: hàng tóm tắt kết quả
participants: số khoá phù hợp, ô sắp xếp
situation: RESPONSIVE-3
className: flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between
threshold: sm
reason: đây là hai vế khác vai trò của một quan hệ cùng đổi trục một lần, không phải các phần tử đồng hạng tự tìm chỗ, điều này loại trừ RESPONSIVE-2
```

```text
owner: danh sách thẻ kết quả
participants: thẻ khoá học, thẻ khoá học, thẻ khoá học
situation: RESPONSIVE-4
className: grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3
threshold: sm và xl, đo bên trong cột kết quả
reason: các phần tử giống nhau lặp lại có bề rộng tối thiểu đã đo cần thẳng rãnh để so sánh được, điều này loại trừ RESPONSIVE-2
```

Chú ý khối thứ ba dùng `xl:grid-cols-3` chứ không phải `lg:grid-cols-3`: bên trong cột kết quả, thanh
lọc đã chiếm mất một phần bề rộng khả dụng, nên ngưỡng ba rãnh đến muộn hơn. Ngưỡng thuộc về vùng chứa,
không thuộc về khung nhìn.

Yêu cầu không nêu lỗi nào bên trong một thẻ, nên ruột thẻ là `RESPONSIVE-1` cho tới khi quan sát được
một lỗi. Nếu về sau yêu cầu bổ sung một bảng tiến độ nhiều cột nằm trong thẻ, bảng đó là `RESPONSIVE-5`
— chủ sở hữu của nó nhận `max-w-full overflow-x-auto` còn bảng nhận `min-w-max`, và đó cũng chính là thứ
giữ cho vùng cuộn không nở ra làm rộng một rãnh lưới rồi đẩy cả trang cuộn ngang.

## Phạm vi

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup thường.
