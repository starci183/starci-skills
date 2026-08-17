---
title: State · Vietnamese
---

# Trạng thái

Đầu vào là một yêu cầu viết bằng lời thường — "một nút Lưu gọi lên máy chủ" — và đầu ra là, với **mỗi
phần tử** mà yêu cầu đó ngụ ý, tập mã tình huống nó sở hữu cùng một className. Yêu cầu không bao giờ
liệt kê ra phần tử phải có bao nhiêu hình dạng, và không được phép tự chọn con số đó: nó **suy ra** từ
việc phần tử làm được gì.

## Luật

Một phần tử không có một hình dạng. Nó có đúng bằng số điều kiện mà nó có thể rơi vào, và con số đó
suy ra từ năng lực của chính nó. Không ai chọn con số ấy, và nó cũng không phụ thuộc vào việc ai đó
kịp vẽ bao nhiêu biến thể.

Đếm hai lần. Lần một: đếm những trạng thái phần tử **có thể vào**, tính từ năng lực của nó — con trỏ
trỏ tới, bàn phím rơi vào, đang bị nhấn, bị tắt, đang là cái được chọn, đang chạy việc của mình, giá
trị bị từ chối, giá trị bị đóng băng. Lần hai: đếm những trạng thái nó **thật sự vẽ ra**. Nếu số thứ
hai nhỏ hơn số thứ nhất thì phần tử đó chưa xong, và những trạng thái còn thiếu chính là những trạng
thái không ai báo lại — vì người cần chúng không phải người đang nhìn vào màn hình.

**Đây là luật bắt buộc.** Mọi phần tử hiển thị ra đều mang một tình huống trạng thái, và mọi tình
huống trạng thái đều có một mã ở dưới. Không có phần tử nào nhỏ đến mức được miễn: một liên kết nằm
giữa câu văn sở hữu `STATE-3` đúng cùng một lý do mà nút gửi biểu mẫu sở hữu nó, và một dòng trong
danh sách sở hữu `STATE-6` đúng cùng một lý do mà một thẻ tab điều hướng sở hữu nó. Câu "có mỗi cái
liên kết thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

Tính đầy đủ là luật, và **cái thiếu ở đây không nhìn thấy được**. Một điều khiển vẽ rê chuột mà không
vẽ focus-visible trông hoàn chỉnh trong mọi ảnh chụp màn hình từng chụp về nó, và không ai dùng bàn
phím thao tác được. Duyệt bằng cách nhìn một tấm ảnh sẽ không bao giờ bắt được lỗi này, vì lỗi được
định nghĩa bằng sự **vắng mặt** của thứ mà tấm ảnh vốn không có lý do gì để chứa. Vì vậy phép đếm phải
được **viết ra**, không được ước lượng bằng mắt.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `STATE-<chỉ số>`. Mã gọi tên TÌNH HUỐNG; cột
className gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có hai mã không phát
ra biến thể nào cả — vì việc chỉ có đúng một hình dạng là một quyết định, không phải sự vắng mặt của
quyết định.

| Mã | Tình huống | className |
|---|---|---|
| `STATE-0` | Nội dung thuần; phần tử không thể đổi hình dạng vì không gì tác động được vào nó | *không khai báo biến thể* |
| `STATE-1` | Trạng thái nghỉ — gốc để đo mọi lớp còn lại | class nền, không có tiền tố biến thể |
| `STATE-2` | Con trỏ đang nằm trên một phần tử thao tác được | `hover:bg-muted` |
| `STATE-3` | Tiêu điểm bàn phím vừa rơi vào phần tử | `outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| `STATE-4` | Cú nhấn đang diễn ra ngay lúc này | `active:bg-muted/80` |
| `STATE-5` | Không dùng được trong ngữ cảnh này | `disabled:pointer-events-none disabled:opacity-50` + thuộc tính `disabled` |
| `STATE-6` | Bền bỉ là cái đang được chọn, đang hiện hành, đã tích hoặc đang mở | `aria-[current=page]:bg-muted` · `aria-selected:bg-muted` |
| `STATE-7` | Việc của chính phần tử đang chạy dở | `aria-busy:cursor-progress` + `disabled` + chỉ báo tiến trình nhìn thấy được |
| `STATE-8` | Giá trị phần tử đang giữ đã bị từ chối | `aria-invalid:border-danger aria-invalid:ring-danger` + thông báo có liên kết |
| `STATE-9` | Giá trị đọc được, tiêu điểm được, nhưng bị đóng băng | `read-only:bg-muted read-only:cursor-default` |

`STATE-0` VÀ `STATE-1` KHÔNG PHẢI CÙNG MỘT MÃ. `STATE-0` nói **không tồn tại** trục trạng thái — không
gì trỏ được vào đoạn văn này, không tiêu điểm được, không nhấn được, không có giá trị để bị từ chối,
nên nó có một hình dạng và như thế là đủ. `STATE-1` nói trục trạng thái **có tồn tại** và đây là gốc
của nó: hình dạng phần tử quay về khi con trỏ rời đi, bàn phím chuyển chỗ và cú nhấn kết thúc. Hai mã
hỏng theo hai kiểu khác nhau. Một phần tử bị gọi nhầm là `STATE-0` là một phần tử tương tác được mà
không có trạng thái nào. Một phần tử thiếu `STATE-1` là một điều khiển có hình dạng khi rê chuột nhưng
không có hình dạng nào để quay về, và đó là cách một cái nút kẹt sáng vĩnh viễn sau cú chạm trên màn
hình cảm ứng.

Các chỉ số có thứ tự, và thứ tự đó mang hai sự thật. `STATE-2`, `STATE-3` và `STATE-4` là các lớp TẠM
THỜI, do thiết bị nhập điều khiển, và chúng được đánh số theo đúng trình tự người dùng gặp: con trỏ
tới, bàn phím rơi vào, cú nhấn cam kết. Đó cũng là thứ tự bắt buộc phải khai báo, vì cùng độ đặc hiệu
thì cái viết sau thắng, và một cú nhấn phải đè được lên một lần rê chuột. `STATE-5` đến `STATE-9` là
các lớp KHAI BÁO, do dữ liệu, quyền hạn hoặc bộ kiểm tra mang, chứ không do vị trí nhất thời của thiết
bị nhập, và chúng **đè** lên các lớp tạm thời: một điều khiển bị tắt thì không vẽ rê chuột, con trỏ
đang làm gì cũng vậy.

**Sàn bắt buộc.** Phần tử nào phản ứng với con trỏ hoặc bàn phím thì sở hữu `STATE-1`, `STATE-2`,
`STATE-3` và `STATE-4` — cả bốn, luôn luôn, không miễn trừ vì kích thước, vì mức quan trọng, hay vì
điều khiển trông đã đủ rõ. Mỗi mã khai báo trở thành bắt buộc ngay khoảnh khắc phần tử có năng lực
tương ứng.

| Phần tử có thể… | …thì nó còn phải vẽ |
|---|---|
| không dùng được, do quyền, hạn mức, bước trước hoặc ngữ cảnh | `STATE-5` |
| là cái hiện hành, được chọn, đã tích hoặc đang mở giữa các phần tử ngang hàng | `STATE-6` |
| khởi động một công việc không xong trong cùng một frame | `STATE-7` |
| giữ một giá trị mà bộ kiểm tra có thể từ chối | `STATE-8` |
| trưng ra một giá trị cố ý không sửa được ở đây | `STATE-9` |

`STATE-3` là mã bắt buộc vô điều kiện và cũng là mã bị bỏ sót nhiều nhất. Bất cứ phần tử nào nhận được
tiêu điểm đều phải vẽ một chỉ báo tiêu điểm nhìn thấy được trên chính nền nó đang nằm, đạt tương phản
3:1 với màu liền kề. Xoá mặc định của trình duyệt mà không thay bằng thứ khác không phải một quyết
định thẩm mỹ; nó xoá tín hiệu duy nhất mà người dùng bàn phím có về chỗ mình đang đứng.

## Đọc một yêu cầu

1. **Liệt kê những phần tử mà yêu cầu nói ra.** "Một nút Lưu gọi lên máy chủ" nói ra một phần tử: một
   cái nút có công việc đi qua mạng.
2. **Không bịa ra năng lực mà yêu cầu không hề nói.** Một quy tắc quyền hạn, một điều kiện được chọn
   hay một bộ kiểm tra không nằm trong yêu cầu đó. Giải năng lực được nói ra; phần còn lại giải khi nó
   xuất hiện.
3. **Giải từ ngoài vào trong.** Dòng bên ngoài và các điều khiển bên trong là những phần tử riêng với
   những tập mã riêng; một phần tử không bao giờ thừa hưởng mã của con nó, và cũng không nhắc lại mã
   của tổ tiên.
4. **Với mỗi phần tử, gọi tên những thứ tác động được vào nó và hỏi câu hỏi của từng mã** trong phần
   của mã đó. Khác với một thang chỉ có một đáp án, phần tử sở hữu **mọi** mã có tình huống khớp — đáp
   án là một tập, không phải một mã.
5. **Viết ra hai phép đếm.** Liệt kê những mã phần tử **có thể vào**, rồi những mã nó **vẽ ra**. Phần
   chênh lệch chính là lỗi; nó bắt buộc phải rỗng.
6. **Nếu hai mã cùng khớp, giữ cả hai và ưu tiên mã khai báo.** Vừa rê chuột vừa bị tắt thì là bị tắt;
   vừa có tiêu điểm vừa không hợp lệ thì viền lỗi nằm dưới vòng tiêu điểm và giữ nguyên cả hai. Nếu
   một phần tử có vẻ trộn quyền sở hữu — vùng đang bận nhưng nút mới là thứ khởi động công việc — phải
   tách quyền sở hữu trước rồi mới chọn.

## `STATE-0` — không có trục trạng thái nào

**Tình huống.** Không có gì tác động được vào phần tử này. Nó không nhận con trỏ, không nhận bàn phím,
không giữ giá trị nào để bị từ chối. Nó có **một** hình dạng và như thế là đủ.

**Dấu hiệu nhận biết**

- Không nhấn được, không đến được bằng phím Tab, không có `tabindex`, không nằm trong `<a>` hay
  `<button>`.
- Xoá hết mọi hàm xử lý đi thì nội dung vẫn nguyên nghĩa.
- Không có gì trong dữ liệu làm phần tử này đổi hình dạng.

**Tự hỏi.** Có thứ gì — con trỏ, bàn phím, dữ liệu, bộ kiểm tra — làm phần tử này đổi hình dạng không?
Nếu không có gì cả, đó là `STATE-0`.

**Ranh giới**

- `STATE-1`: `STATE-0` nói trục trạng thái **không tồn tại**. `STATE-1` nói trục **có tồn tại** và đây
  là gốc của nó. Một đoạn văn là `STATE-0`; một cái nút chưa bị chạm vào là `STATE-1`.
- `STATE-6`: một dòng trong danh sách trông như nội dung thuần, nhưng nếu nó **có thể đang là dòng
  được chọn** thì nó không phải `STATE-0`.
- `STATE-2`: một thẻ có `hover:shadow` là điều khiển trá hình. Đã mở trục trạng thái thì nó đã tự khai
  mình thao tác được, và phải trả đủ `STATE-3` với `STATE-4`.

**Không viết một class biến thể nào.** `STATE-0` là mã tình huống, không phải một lớp rỗng. Viết
`hover:bg-transparent` cho một đoạn văn là nói dối rằng nó thao tác được.

**Tình huống nghiệp vụ hay gặp.** Đoạn mô tả · nhãn tĩnh · số liệu chỉ để đọc · mốc thời gian · biểu
tượng trang trí `aria-hidden` · một chặng trong đường dẫn phân cấp mà không phải liên kết · dòng tóm
tắt dưới tiêu đề · nhãn trạng thái chỉ để phân loại và không lọc được.

## `STATE-1` — trạng thái nghỉ, gốc của mọi lớp khác

**Tình huống.** Phần tử thao tác được, và ngay lúc này chưa có gì đang xảy ra với nó. Đây là hình dạng
nó quay về sau khi con trỏ rời đi, bàn phím chuyển chỗ và cú nhấn kết thúc.

**Dấu hiệu nhận biết**

- Có ít nhất một lớp khác tồn tại; nếu không có lớp nào thì đây là `STATE-0`.
- Mọi thuộc tính hình học của phần tử — chiều cao, viền, khoảng đệm trong — được quyết ở lớp này,
  không ở lớp rê chuột.
- Đọc riêng lớp này vẫn thấy được phần tử là loại gì: nút, liên kết, ô nhập, dòng chọn được.

**Tự hỏi.** Khi mọi thứ buông tay khỏi phần tử này, nó trở về hình dạng nào?

**Ranh giới**

- `STATE-0`: xem trên.
- `STATE-2`: `STATE-1` là hình dạng **mặc định**; `STATE-2` là hình dạng **tạm thời** chồng lên nó.
  Đặt màu nền chỉ ở `hover:` và để mặc định trống là làm ngược, và trên thiết bị cảm ứng con trỏ không
  rời đi nên phần tử đó **kẹt sáng** sau cú chạm.

**Lớp nghỉ giữ toàn bộ hình học.** Viền, chiều cao, chiều rộng, độ đậm chữ đều thuộc `STATE-1`. Lớp
khác chỉ được đổi màu, đổi bóng, đổi vòng — những thứ **không đẩy hàng xóm**.

**Tình huống nghiệp vụ hay gặp.** Nút chưa chạm · liên kết trong đoạn văn · ô nhập trống · thẻ tab
chưa được chọn · dòng danh sách chưa chọn · hộp kiểm chưa tích · thẻ bấm được ở trạng thái thường.

## `STATE-2` — con trỏ đang nằm trên phần tử

**Tình huống.** Con trỏ nằm trên một phần tử thao tác được, và phần tử phải **thừa nhận** điều đó
trước khi người dùng bấm.

**Dấu hiệu nhận biết**

- Phần tử có hàm xử lý, hoặc là `<a>`, `<button>`, `<label>`, hoặc một dòng chọn được.
- Có một hành động sẽ xảy ra nếu người dùng bấm ngay bây giờ.
- Có `cursor-pointer` — đã đặt con trỏ hình bàn tay thì đã hứa là bấm được.

**Tự hỏi.** Nếu người dùng bấm ngay lúc con trỏ đang ở đây, có chuyện gì xảy ra không?

**Ranh giới**

- `STATE-3`: rê chuột là **thiết bị trỏ**; focus-visible là **bàn phím**. Hai lớp khác nhau, hai nhóm
  người dùng khác nhau, và chúng **không** thay thế được cho nhau. Đây là lỗi hay gặp nhất của cả
  mô-đun.
- `STATE-4`: rê chuột là "con trỏ đang ở đây"; `STATE-4` là "nút chuột đang bị giữ xuống".
- `STATE-6`: rê chuột **tạm thời** và do con trỏ quyết; `STATE-6` **bền** và do dữ liệu quyết. Một thẻ
  tab đang được chọn vẫn rê chuột được, nên hai lớp phải phân biệt được với nhau.

**Rê chuột không bao giờ đứng một mình.** Viết `hover:` mà không viết `focus-visible:` là dựng một
điều khiển chỉ dùng được bằng chuột. Nó vẫn đẹp trong ảnh chụp.

**Rê chuột không được là nơi duy nhất chứa thông tin.** Trên thiết bị cảm ứng không có rê chuột. Thứ
gì chỉ hiện ra khi rê chuột thì trên điện thoại nó **không tồn tại** — nếu nó quan trọng, nó không
phải là rê chuột.

**Tình huống nghiệp vụ hay gặp.** Nút · liên kết · dòng danh sách bấm được · thẻ mở chi tiết · mục
trong trình đơn · ô ngày trong lịch · thẻ lọc · nút biểu tượng trong thanh công cụ · dòng bảng bấm
được.

## `STATE-3` — tiêu điểm bàn phím vừa rơi vào phần tử

**Tình huống.** Người dùng đang điều khiển trang bằng bàn phím, và cần biết **mình đang đứng ở đâu**.
Đây là lớp bắt buộc vô điều kiện của mọi phần tử tiêu điểm được.

**Dấu hiệu nhận biết**

- Đến được bằng phím Tab: `<a href>`, `<button>`, `<input>`, `<select>`, `<textarea>`, hoặc có
  `tabindex="0"`.
- Nếu bỏ chuột ra khỏi bàn, người dùng vẫn phải hoàn thành được luồng.
- Có ai đó trong cơ sở mã đã viết `outline-none` — đó là dấu hiệu lớp này đã bị xoá.

**Tự hỏi.** Nếu rút chuột ra, người dùng có nhìn thấy mình đang đứng ở đâu không?

**Ranh giới**

- `STATE-2`: xem trên. Không có chuyện "đã có rê chuột rồi thì thôi".
- `STATE-1`: `focus-visible` chỉ vẽ khi trình duyệt xác định người dùng đang dùng bàn phím. Dùng
  `focus:` thay cho `focus-visible:` khiến vòng dính lại sau mỗi cú bấm chuột, và rồi ai đó sẽ xoá hẳn
  nó cho đỡ xấu — đó chính là con đường mà lớp này biến mất.
- `STATE-8`: một trường vừa có tiêu điểm vừa không hợp lệ thì **giữ cả hai**: vòng tiêu điểm nằm trên,
  viền lỗi nằm dưới. Vòng không được nuốt viền lỗi.

**Chỉ báo tiêu điểm phải nhìn thấy trên nền nó đang nằm.** Đối tượng đồ hoạ dùng để truyền đạt trạng
thái phải đạt tương phản 3:1 với màu liền kề. Một vòng xám nhạt trên nền xám nhạt là **không có vòng**.

**`outline-none` không phải một quyết định thẩm mỹ.** Nó xoá tín hiệu duy nhất mà người dùng bàn phím
có. Nó chỉ hợp lệ khi nằm **cùng một danh sách class** với thứ thay thế nó.

**Tình huống nghiệp vụ hay gặp.** Nút · liên kết · ô nhập · ô chọn · hộp kiểm và nút chọn · thẻ tab ·
dòng trình đơn · nút đóng của hộp thoại · nút chỉ có biểu tượng · dòng danh sách bấm được · nút phân
trang · liên kết bỏ qua điều hướng.

## `STATE-4` — cú nhấn đang diễn ra

**Tình huống.** Nút chuột đang bị giữ xuống, hoặc ngón tay đang chạm. Phần tử phải **xác nhận đã
nhận** cú nhấn, ngay lập tức, trước khi bất cứ kết quả nào kịp về.

**Dấu hiệu nhận biết**

- Bấm vào sẽ cam kết một hành động, không chỉ mở một trình đơn tạm.
- Trên mạng chậm, khoảng trống giữa "đã bấm" và "có kết quả" đủ dài để người dùng bấm lần hai.
- Trên cảm ứng, đây là lớp phản hồi **duy nhất** người dùng nhận được, vì không có rê chuột.

**Tự hỏi.** Người dùng có biết được cú nhấn đã ăn, trước khi kết quả về không?

**Ranh giới**

- `STATE-2`: rê chuột là "con trỏ ở đây"; `STATE-4` là "đang bị giữ xuống". Trên cảm ứng chỉ có
  `STATE-4`.
- `STATE-7`: `STATE-4` kéo dài đúng bằng cú nhấn — hàng chục mili-giây. `STATE-7` bắt đầu **sau khi**
  cú nhấn nhả ra và kéo dài bằng công việc. Một nút gửi biểu mẫu đi qua cả hai, theo thứ tự đó.

**`STATE-4` phải khai báo sau `STATE-2`.** Cùng độ đặc hiệu thì cái viết sau thắng, và cú nhấn phải đè
được lên rê chuột, không phải ngược lại.

**Không đổi hình học.** Đổi độ đậm chữ hay bề dày viền khi nhấn sẽ đẩy hàng xóm, và một điều khiển
**dịch chuyển dưới ngón tay** thì cú nhấn thứ hai rơi ra ngoài. Đổi màu, đổi bóng, hoặc `scale` —
`scale` chạy ở bước vẽ chứ không tính lại bố cục.

**Tình huống nghiệp vụ hay gặp.** Nút gửi · nút thanh toán · nút thêm vào giỏ · dòng danh sách bấm
được · nút tăng giảm số lượng · phím trên bàn phím ảo · nút bấm giữ để ghi âm · nút chuyển trang.

## `STATE-5` — không dùng được trong ngữ cảnh này

**Tình huống.** Phần tử tồn tại, người dùng nhìn thấy nó, nhưng **bây giờ** không dùng được: chưa đủ
quyền, chưa xong bước trước, hết lượt, sai ngữ cảnh.

**Dấu hiệu nhận biết**

- Có một điều kiện nghiệp vụ quyết định phần tử này bật hay tắt.
- Nếu bấm được thì máy chủ cũng sẽ từ chối.
- Nó không biến mất — nghĩa là ta đang cố **cho người dùng biết nó tồn tại**.

**Tự hỏi.** Có một điều kiện nghiệp vụ nào — quyền, hạn mức, bước trước, ngữ cảnh — quyết định phần tử
này bật hay tắt không?

**Ranh giới**

- `STATE-9`: `STATE-5` nói "việc này không dành cho bạn lúc này". `STATE-9` nói "giá trị này có thật,
  đọc được, sao chép được, chỉ là không sửa ở đây". Ô email đã xác thực trong trang hồ sơ là `STATE-9`,
  không phải `STATE-5`.
- `STATE-7`: `STATE-5` là điều kiện **bên ngoài**; `STATE-7` là công việc **của chính phần tử**. Một
  nút đang gửi biểu mẫu thì trạng thái gốc là `STATE-7`; nó *cũng* không bấm được, nhưng lý do nằm ở
  chỗ khác và thông điệp cũng khác.
- `STATE-0`: một phần tử bị tắt **vĩnh viễn ở mọi ngữ cảnh** thì không nên hiển thị ra thành một điều
  khiển.

**Mã khai báo đè mã tạm thời.** Đã tắt thì không vẽ rê chuột, không vẽ đang nhấn. Một nút bị vô hiệu
hoá mà vẫn sáng lên khi rê chuột là đang hứa rằng một cú bấm sẽ ăn.

**Tắt không phải là lời giải thích.** Người dùng nhìn thấy nút xám không biết vì sao. Nếu lý do quan
trọng, dùng ngoại lệ `aria-disabled` để phần tử vẫn đến được bằng phím Tab và vẫn nói được lý do bằng
chữ.

**Tình huống nghiệp vụ hay gặp.** Nút gửi khi biểu mẫu chưa hợp lệ · thao tác cần quyền cao hơn · nút
"Trang trước" ở trang đầu · vị trí đã hết chỗ · tính năng cần gói trả phí · bước tiếp theo khi bước
trước chưa xong · nút xoá khi chưa chọn dòng nào · gửi lại mã khi còn đếm ngược.

## `STATE-6` — đang là cái được chọn, đang mở, đang đứng ở đây

**Tình huống.** Trong một tập phần tử ngang hàng, phần tử này đang mang một điều kiện **bền**: được
chọn, đang là trang hiện tại, đã tích, đang mở. Điều kiện đó do **dữ liệu** quyết, không do con trỏ.

**Dấu hiệu nhận biết**

- Rời con trỏ đi, đóng trang rồi mở lại, nó vẫn còn.
- Có một phần tử — và thường chỉ một — trong nhóm mang trạng thái này.
- Có một thuộc tính ARIA tương ứng: `aria-current`, `aria-selected`, `aria-checked`, `aria-expanded`,
  `aria-pressed`.

**Tự hỏi.** Buông con trỏ ra và tải lại trang, trạng thái này có còn không? Còn thì `STATE-6`.

**Ranh giới**

- `STATE-2`: rê chuột tạm thời và theo con trỏ; `STATE-6` bền và theo dữ liệu. Một thẻ tab đang chọn
  vẫn rê chuột được, nên hai lớp phải **phân biệt được với nhau** — không được dùng cùng một màu nền.
- `STATE-1`: một thẻ tab chưa được chọn là `STATE-1`, không phải một biến thể mờ của `STATE-6`.
- `STATE-5`: được chọn và bị tắt là hai chuyện độc lập; một dòng có thể vừa đang được chọn vừa không
  thao tác được.

**Không mã hoá bằng riêng màu.** Người không phân biệt được màu, và trình duyệt ở chế độ tương phản
cưỡng bức, đều mất lớp này. Kèm theo một dấu hiệu thứ hai: một thanh chỉ báo, một dấu tích, một chữ.

**Trạng thái phải nằm trong DOM, không chỉ trong CSS.** Không có `aria-current` / `aria-selected` thì
trình đọc màn hình không đọc ra được điều mà con mắt đang thấy.

**Tình huống nghiệp vụ hay gặp.** Thẻ tab đang mở · mục điều hướng của trang hiện tại · dòng đã tích
trong bảng · ngày đang chọn trên lịch · bộ lọc đang bật · gói đang dùng · vùng thu gọn đang mở · nút
chuyển đang bật · bước hiện tại trong bộ bước · ngôn ngữ đang chọn.

## `STATE-7` — việc của chính phần tử đang chạy dở

**Tình huống.** Người dùng đã bấm, cú nhấn đã ăn, và **kết quả chưa về**. Phần tử phải nói rằng việc
đang chạy, và phải chặn cú bấm thứ hai.

**Dấu hiệu nhận biết**

- Hành động đi qua mạng, hoặc qua một tính toán không xong trong cùng một frame.
- Bấm hai lần sẽ tạo hai bản ghi, hai lần trừ tiền, hai email.
- Có một khoảng thời gian mà giao diện không có gì mới để nói, nhưng cũng chưa được phép im lặng.

**Tự hỏi.** Giữa lúc bấm và lúc có kết quả, người dùng nhìn vào đâu để biết hệ thống đã nghe?

**Ranh giới**

- `STATE-4`: xem trên. `STATE-4` dài bằng cú nhấn; `STATE-7` dài bằng công việc.
- `STATE-5`: xem trên. Tắt vì điều kiện bên ngoài không phải là bận vì việc của chính mình.
- Nội dung đang tải: nếu **cả một vùng** đang chờ dữ liệu để vẽ lần đầu, đó là nội dung của vùng chứ
  không phải lớp trạng thái của một phần tử. Chuyện đó thuộc mô-đun hàng xóm.

**Không được làm bố cục nhảy.** Thay chữ "Lưu" bằng một chỉ báo đang tải làm nút co lại và mọi thứ bên
cạnh dịch chỗ. Giữ nguyên chữ, thêm chỉ báo, hoặc để sẵn chỗ cho nó.

**Bận thì không vẽ rê chuột, không vẽ đang nhấn.** Và phải chặn được cú nhấn thứ hai thật sự, không
chỉ vẽ cho có.

**Tình huống nghiệp vụ hay gặp.** Nút gửi biểu mẫu · nút thanh toán · nút tải tệp lên · nút gửi lại mã
· nút áp mã giảm giá · nút đồng bộ · ô tìm kiếm đang chờ kết quả · nút chấm bài.

## `STATE-8` — giá trị đang giữ đã bị từ chối

**Tình huống.** Phần tử giữ một giá trị, và một bộ kiểm tra — ở máy khách hay máy chủ — đã **từ chối**
giá trị đó. Phần tử phải nói rằng lỗi nằm ở **chính nó**, và nói lỗi là gì.

**Dấu hiệu nhận biết**

- Có một quy tắc mà giá trị này có thể vi phạm: bắt buộc, định dạng, độ dài, trùng, khoảng giá trị.
- Có một thông báo cần được gắn vào đúng phần tử này, không phải vào cả biểu mẫu.
- Người dùng phải **sửa được** — nghĩa là phần tử vẫn thao tác được.

**Tự hỏi.** Có một quy tắc nào mà giá trị của phần tử này có thể vi phạm không?

**Ranh giới**

- `STATE-5`: một trường đang lỗi **không bị tắt**. Tắt một trường đang lỗi là khoá người dùng ra khỏi
  đúng thứ duy nhất họ cần sửa.
- `STATE-3`: xem trên; hai lớp cùng tồn tại được.
- Lỗi cấp biểu mẫu: một biểu ngữ lỗi ở đầu biểu mẫu **không** thay thế được `STATE-8` trên từng
  trường. Biểu ngữ nói "có lỗi"; `STATE-8` nói "lỗi ở đây".

**Không mã hoá bằng riêng màu viền.** Viền đỏ một mình không đủ. Phải có chữ, và chữ phải được **liên
kết** tới trường bằng `aria-describedby` để trình đọc màn hình đọc ra khi tiêu điểm vào.

**Giữ chỗ sẵn cho thông báo.** Thông báo xuất hiện làm mọi thứ bên dưới tụt xuống, và người dùng đang
định bấm nút gửi sẽ bấm trúng thứ khác.

**Tình huống nghiệp vụ hay gặp.** Email sai định dạng · mật khẩu chưa đủ mạnh · trường bắt buộc bỏ
trống · mã giảm giá không tồn tại · số lượng vượt tồn kho · ngày kết thúc trước ngày bắt đầu · tên
đăng nhập đã có người dùng · tệp quá dung lượng · số thẻ không hợp lệ.

## `STATE-9` — giá trị đọc được nhưng bị đóng băng

**Tình huống.** Giá trị là **thật**, cần đọc được, cần sao chép được, cần đến được bằng phím Tab —
nhưng không được sửa **ở đây**. Đây không phải là bị tắt; đây là một giá trị được trưng ra.

**Dấu hiệu nhận biết**

- Người dùng có lý do chính đáng để chọn và sao chép giá trị này.
- Giá trị có thể sửa được ở **chỗ khác**, hoặc do hệ thống sinh ra.
- Nó vẫn được gửi kèm khi gửi biểu mẫu, hoặc vẫn cần đọc được bằng trình đọc màn hình.

**Tự hỏi.** Người dùng có cần đọc và sao chép giá trị này không? Có thì `STATE-9`, không thì cân nhắc
`STATE-5`.

**Ranh giới**

- `STATE-5`: xem trên. Đây là ranh giới bị làm sai nhiều nhất trong nhóm khai báo: `disabled` làm giá
  trị **mờ đi, không sao chép được, không đến được bằng phím Tab** — ba tổn thất, chỉ để diễn đạt một
  điều mà `readOnly` diễn đạt đúng.
- `STATE-0`: nếu giá trị chỉ để đọc và **không** phải là một trường nhập liệu, đừng hiển thị một
  `<input>`. Một đoạn chữ là `STATE-0` và trung thực hơn.

**Vẫn phải trả `STATE-3`.** Chỉ đọc vẫn đến được bằng phím Tab, nên tiêu điểm vẫn phải nhìn thấy được.

**Tình huống nghiệp vụ hay gặp.** Mã đơn hàng hệ thống sinh · email đã xác thực trong hồ sơ · API key
đã tạo · số dư tính ra từ giao dịch · tổng tiền của giỏ hàng · đường dẫn công khai sinh từ tiêu đề ·
mã mời · thông tin hoá đơn đã chốt.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| phần tử | Nút hiển thị ra và việc có gì tác động được vào nó hay không |
| năng lực | Nó thao tác được bằng con trỏ, tiêu điểm được, nhấn được, chọn được, giữ giá trị hay không |
| khả dụng | Quyền, hạn mức, bước trước hoặc ngữ cảnh có thể giữ nó lại hay không |
| thời lượng | Công việc nó khởi động có xong trong cùng một frame hay không |
| kiểm tra giá trị | Bộ kiểm tra có thể từ chối giá trị nó đang giữ hay không |
| quyền sở hữu | Điều kiện được chọn, đang bận hoặc không hợp lệ thuộc về phần tử này hay thuộc về tổ tiên |

## Quy tắc

1. Mọi phần tử hiển thị ra đều rơi vào `STATE-0`, hoặc vào `STATE-1` cộng với mọi mã mà năng lực của
   nó cho phép.
2. Số lớp trạng thái **suy ra từ năng lực**, không bao giờ từ việc ai đó đã vẽ được bao nhiêu biến thể.
3. `STATE-2` không bao giờ xuất hiện mà thiếu `STATE-3`. Một điều khiển chỉ có rê chuột thì bàn phím
   không dùng được.
4. `outline-none` chỉ hợp lệ khi nằm cùng một danh sách class với chỉ báo tiêu điểm thay thế nó.
5. Lớp tiêu điểm là `focus-visible`, không phải `focus`; một cú bấm chuột không được để lại vòng dính
   phía sau.
6. Không trạng thái nào được mang bằng **riêng sắc màu**. Mỗi trạng thái khai báo phải ghép màu với
   một dấu hiệu thứ hai — chữ, biểu tượng, viền, độ dày chỉ báo — sống sót được qua ảnh xám và qua chế
   độ tương phản cưỡng bức.
7. Chỉ báo trạng thái, và đường viền của một điều khiển vừa đổi trạng thái, đạt tương phản **3:1** với
   thứ nằm liền kề nó.
8. Không trạng thái nào được đổi bố cục. Một trạng thái làm đổi kích thước, độ đậm chữ, bề dày viền
   hay vị trí sẽ đẩy hàng xóm, và một điều khiển dịch chuyển dưới con trỏ thì không bấm trúng được.
9. Mã khai báo đè mã tạm thời. `STATE-5` và `STATE-7` vô hiệu hoá `STATE-2` và `STATE-4`.
10. Thứ tự khai báo trong danh sách class theo đúng thứ tự chỉ số: rê chuột trước, rồi focus-visible,
    rồi đang nhấn.
11. Thông tin chỉ hiện ra nhờ `STATE-2` thì không tồn tại trên thiết bị cảm ứng; nếu nó quan trọng, nó
    không phải là rê chuột.
12. Trạng thái phải có mặt trong DOM (`disabled`, `aria-*`, `readOnly`), không chỉ trong CSS.
13. Một mã tình huống ứng với đúng một nhóm class, và không nhóm class nào phục vụ hai mã.
14. Khung chờ, trạng thái rỗng và **nội dung** lỗi không phải mã của mô-đun này; chỉ các lớp của chính
    phần tử mới thuộc về đây.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Tắt nhưng phải giải thích được.** `STATE-5` bình thường gỡ phần tử khỏi thứ tự Tab, và gỡ luôn lời
  giải thích gắn vào nó. Khi người dùng bắt buộc phải được biết LÝ DO, giữ phần tử tiêu điểm được,
  đánh dấu `aria-disabled="true"` thay cho `disabled`, chặn hành động trong hàm xử lý, và nói lý do
  bằng chữ. Mã vẫn là `STATE-5`; chỉ cơ chế đổi.
- **Bận ở cấp vùng.** Khi công việc thuộc về một vùng chứ không thuộc điều khiển đã khởi động nó,
  `STATE-7` do vùng mang, và điều khiển bên trong vẽ `STATE-5`. Hai phần tử không cùng nhận một công
  việc đang chạy.
- **Chọn do tổ tiên sở hữu.** Một dòng được chọn vẽ `STATE-6` trên chính dòng đó. Các điều khiển bên
  trong giữ lớp của riêng chúng và không nhắc lại trạng thái chọn.
- **Vòng tiêu điểm mặc định đã đủ.** Phần tử không hề đặt `outline-none` và vượt được phép thử 3:1
  trên nền tảng của nó thì đã trả xong `STATE-3` mà không cần một class `focus-visible:` nào. Mã vẫn
  được nợ và vẫn được ghi nhận; nó chỉ không phát ra gì mới.
- **Chỉ đọc so với bị tắt.** `STATE-9` chỉ được chọn khi giá trị phải giữ nguyên khả năng đọc, chọn và
  đến được bằng bàn phím. Nếu điều khiển thật sự không thuộc về việc đang làm, đó là `STATE-5`.
- **Hai mã cùng khớp.** Ưu tiên mã **khai báo**. Vừa rê chuột vừa bị tắt thì là bị tắt; vừa có tiêu
  điểm vừa không hợp lệ thì viền lỗi nằm dưới vòng tiêu điểm và giữ nguyên cả hai.
- **Tính đồng nhất giữa các khung nhìn.** Đổi khung nhìn, đổi chủ đề, đổi ngôn ngữ không làm mất một
  lớp nào. Trên cảm ứng `STATE-2` không bao giờ kích hoạt, nhưng nó vẫn phải được khai báo — cùng một
  thành phần còn chạy trên máy có chuột.

## Đầu ra

Mỗi phần tử một khối, từ ngoài vào trong:

```text
element: <phần tử và những gì tác động được vào nó>
can enter: <mọi mã mà năng lực của nó cho phép>
draws: <mọi mã nó phát ra>
missing: <can enter trừ đi draws — bắt buộc rỗng>
className: <class nền + một nhóm class cho mỗi mã được vẽ>
reason: <năng lực làm cho từng mã khai báo trở thành bắt buộc>
```

## Ví dụ đã giải

**Yêu cầu.** "Một biểu mẫu cài đặt khoá học, có đường dẫn do hệ thống sinh và người dùng không sửa
được, một ô tiêu đề mà máy chủ có thể từ chối, và một nút Lưu gọi lên máy chủ."

Yêu cầu này nói ra ba phần tử: ô đường dẫn, ô tiêu đề và nút Lưu. Nó không nói tới quy tắc quyền hạn,
không nói tới điều kiện được chọn, không nói tới một vùng đang bận, nên `STATE-6` không được giải ở
đâu cả, còn `STATE-7` chỉ được giải trên nút — chỗ duy nhất yêu cầu nói rằng công việc đi qua mạng.

```text
element: ô đường dẫn — hệ thống sinh, tiêu điểm được, không sửa ở đây
can enter: STATE-1, STATE-3, STATE-9
draws: STATE-1, STATE-3, STATE-9
missing: không có
className: h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:bg-muted read-only:cursor-default
reason: giá trị phải giữ nguyên khả năng đọc và sao chép, điều này loại trừ STATE-5; nó là một trường người dùng Tab vào được, và không có cú nhấn nào cam kết hành động nên không nợ STATE-2 và STATE-4
```

```text
element: ô tiêu đề — giữ một giá trị mà bộ kiểm tra có thể từ chối
can enter: STATE-1, STATE-3, STATE-8
draws: STATE-1, STATE-3, STATE-8
missing: không có
className: h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger aria-invalid:ring-danger
reason: người dùng phải sửa được giá trị vừa bị từ chối, điều này loại trừ STATE-5, và thông báo có liên kết nói rằng lỗi nằm ở đây chứ không nằm đâu đó trong biểu mẫu
```

```text
element: nút Lưu — thao tác được bằng con trỏ, nhấn được, khởi động công việc đi qua mạng
can enter: STATE-1, STATE-2, STATE-3, STATE-4, STATE-7
draws: STATE-1, STATE-2, STATE-3, STATE-4, STATE-7
missing: không có
className: inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-primary/80 disabled:pointer-events-none aria-busy:cursor-progress
reason: công việc thuộc về chính cái nút và kéo dài hơn cú nhấn, điều này loại trừ việc chỉ có STATE-4 và loại trừ STATE-5 — mã mà điều kiện phải đến từ bên ngoài phần tử
```

Yêu cầu không nói rằng nút Lưu có thể bị giữ lại vì quyền, vì hạn mức hay vì một bước trước chưa xong,
nên `STATE-5` không được giải; nếu sau này điều đó được nói ra, cái nút nhận thêm
`disabled:pointer-events-none disabled:opacity-50` cùng thuộc tính `disabled`. Yêu cầu cũng không nói
rằng cả vùng biểu mẫu tự tải lại, nên ngoại lệ bận ở cấp vùng không áp dụng.

## Phạm vi

Mô-đun này quyết định NHỮNG TRẠNG THÁI NÀO TỒN TẠI và trạng thái nào là bắt buộc. Nó không quyết định
một trạng thái được tô bằng sắc màu nào — đó là câu hỏi của mô-đun màu bên cạnh — cũng không quyết
định một chỉ báo trạng thái chiếm bao nhiêu chỗ, việc đó thuộc các mô-đun khoảng cách. Nó không chi
phối nội dung mà một vùng hiển thị khi vùng đó chưa có dữ liệu: khung chờ, trạng thái rỗng và bản vẽ
khi tải hỏng đều là nội dung của vùng, không phải lớp trạng thái của một phần tử.

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường.
