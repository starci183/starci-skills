---
id: fe-principles-state-vi
title: vi.md
slug: /gates/principles/state/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống STATE-N, nhận diện bằng khả năng của phần tử chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `state`

# Trạng thái

Trạng thái là **số lớp hình ảnh** mà một phần tử sở hữu, và lớp nào trong số đó là **bắt buộc**.

Số lớp không do ai chọn. Nó **suy ra** từ việc phần tử đó **làm được gì**. Hãy nhìn một phần tử và
hỏi:

> Có bao nhiêu tình huống mà phần tử này có thể rơi vào?

Đếm hai lần. Lần một: đếm những trạng thái phần tử **có thể vào** — con trỏ trỏ tới, bàn phím rơi
vào, đang bị nhấn, bị tắt, đang là cái được chọn, đang chạy việc của mình, giá trị bị từ chối, giá
trị bị đóng băng. Lần hai: đếm những trạng thái nó **thật sự vẽ ra**. Số thứ hai nhỏ hơn số thứ nhất
thì phần tử đó **chưa xong**.

**Đây là luật bắt buộc.** Mọi phần tử hiển thị ra đều rơi vào đúng một mã dưới đây. Không có phần tử
nào nhỏ đến mức được miễn: một liên kết nằm giữa câu văn sở hữu `STATE-3` đúng cùng một lý do mà nút gửi
biểu mẫu sở hữu nó. Câu "có mỗi cái liên kết thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

**Cái thiếu ở đây không nhìn thấy được.** Một thành phần điều khiển vẽ rê chuột mà không vẽ tiêu điểm-hiển thị trông
**hoàn chỉnh trong mọi ảnh chụp màn hình từng chụp về nó**, và không ai dùng bàn phím thao tác được.
Duyệt bằng mắt sẽ không bao giờ bắt được lỗi này, vì lỗi được định nghĩa bằng sự **vắng mặt** của
thứ mà tấm ảnh vốn không có lý do gì để chứa. Vì vậy phép đếm phải được **viết ra**, không được nhìn.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `STATE-0` | Nội dung thuần, không gì tác động được vào nó | *không khai báo biến thể* |
| `STATE-1` | Trạng thái nghỉ — gốc để đo mọi lớp còn lại | class CSS nền, không có tiền tố biến thể |
| `STATE-2` | Con trỏ đang nằm trên một phần tử thao tác được | `hover:bg-muted` |
| `STATE-3` | Bàn phím vừa rơi vào phần tử | `outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| `STATE-4` | Cú nhấn đang diễn ra ngay lúc này | `active:bg-muted/80` |
| `STATE-5` | Không dùng được trong ngữ cảnh này | `disabled:pointer-events-none disabled:opacity-50` + thuộc tính `disabled` |
| `STATE-6` | Đang là cái được chọn / đang mở / đang đứng ở đây | `aria-[current=page]:bg-muted` · `aria-selected:bg-muted` |
| `STATE-7` | Việc của chính phần tử đang chạy dở | `aria-busy:cursor-progress` + `disabled` + chỉ báo tiến trình nhìn thấy được |
| `STATE-8` | Giá trị phần tử đang giữ đã bị từ chối | `aria-invalid:border-danger aria-invalid:ring-danger` + thông báo có liên kết |
| `STATE-9` | Giá trị đọc được, tiêu điểm được, nhưng bị đóng băng | `read-only:bg-muted read-only:cursor-default` |

**Sàn bắt buộc.** Phần tử nào phản ứng với con trỏ hoặc bàn phím thì sở hữu **cả bốn**: `STATE-1`,
`STATE-2`, `STATE-3`, `STATE-4`. Mỗi mã khai báo (`STATE-5`…`STATE-9`) trở thành bắt buộc ngay khi
phần tử có năng lực tương ứng.

---

## `STATE-0` — không có trục trạng thái nào

**Tình huống.** Không có gì tác động được vào phần tử này. Nó không nhận con trỏ, không nhận bàn
phím, không giữ giá trị nào để bị từ chối. Nó có **một** hình dạng và như thế là đủ.

**Dấu hiệu nhận biết**

- Không nhấn được, không đến được bằng phím Thẻ tab, không có `tabindex`, không nằm trong `<a>` hay `<button>`.
- Xoá hết mọi hàm xử lý đi thì nội dung vẫn nguyên nghĩa.
- Không có gì trong dữ liệu làm phần tử này đổi hình dạng.

**Tự hỏi.** Có thứ gì — con trỏ, bàn phím, dữ liệu, bộ kiểm tra — làm phần tử này đổi hình dạng không?
Nếu không có gì cả, đó là `STATE-0`.

**Ranh giới**

- `STATE-1`: `STATE-0` nói **không tồn tại** trục trạng thái. `STATE-1` nói trục **có tồn tại** và
  đây là gốc của nó. Một đoạn văn là `STATE-0`; một nút chưa bị chạm vào là `STATE-1`.
- `STATE-6`: một dòng trong danh sách trông như nội dung thuần, nhưng nếu nó **có thể đang là dòng
  được chọn** thì nó không phải `STATE-0`.
- `STATE-2`: một thẻ có `hover:shadow` là thành phần điều khiển trá hình. Đã vẽ rê chuột thì nó đã tự khai mình
  thao tác được, và phải trả đủ `STATE-3`, `STATE-4`.

**Không viết một class CSS biến thể nào.** `STATE-0` là mã tình huống, không phải một lớp rỗng. Viết
`hover:bg-transparent` cho một đoạn văn là nói dối rằng nó thao tác được.

**Tình huống nghiệp vụ hay gặp.** Đoạn mô tả · nhãn tĩnh · số liệu chỉ để đọc · mốc thời gian · biểu tượng
trang trí `aria-hidden` · đường dẫn phân cấp ở đoạn không phải liên kết · dòng tóm tắt dưới tiêu đề · nhãn trạng thái chỉ
để phân loại và không lọc được.

---

## `STATE-1` — trạng thái nghỉ, gốc của mọi lớp khác

**Tình huống.** Phần tử thao tác được, và **chưa có gì đang xảy ra với nó**. Đây là hình dạng nó
quay về sau khi con trỏ rời đi, bàn phím chuyển chỗ và cú nhấn kết thúc.

**Dấu hiệu nhận biết**

- Có ít nhất một lớp khác tồn tại; nếu không thì đây là `STATE-0`.
- Mọi thuộc tính hình học của phần tử — chiều cao, viền, khoảng đệm trong — được quyết ở lớp này, không ở lớp
  rê chuột.
- Đọc riêng lớp này vẫn thấy được phần tử là loại gì: nút, liên kết, ô nhập, dòng chọn được.

**Tự hỏi.** Khi mọi thứ buông tay khỏi phần tử này, nó trở về hình dạng nào?

**Ranh giới**

- `STATE-0`: xem trên.
- `STATE-2`: `STATE-1` là hình dạng **mặc định**; `STATE-2` là hình dạng **tạm thời** chồng lên nó.
  Đặt màu nền chỉ ở `hover:` và để mặc định trống là làm ngược, và trên thiết bị cảm ứng con trỏ
  không rời đi nên phần tử đó **kẹt sáng** sau cú chạm.

**Lớp nghỉ giữ toàn bộ hình học.** Viền, chiều cao, chiều rộng, cân nặng chữ đều thuộc `STATE-1`. Lớp
khác chỉ được đổi màu, đổi bóng, đổi vòng — những thứ **không đẩy hàng xóm**.

**Tình huống nghiệp vụ hay gặp.** Nút chưa chạm · liên kết trong đoạn văn · ô nhập trống · thẻ tab chưa được
chọn · dòng danh sách chưa chọn · hộp kiểm chưa vạch chia · thẻ bấm được ở trạng thái thường.

---

## `STATE-2` — con trỏ đang nằm trên phần tử

**Tình huống.** Con trỏ nằm trên một phần tử thao tác được, và phần tử phải **thừa nhận** điều đó
trước khi người dùng bấm.

**Dấu hiệu nhận biết**

- Phần tử có hàm xử lý, hoặc là `<a>`, `<button>`, `<label>`, hoặc dòng chọn được.
- Có một hành động sẽ xảy ra nếu người dùng bấm ngay bây giờ.
- Có `cursor-pointer` — nếu đã đặt con trỏ tay thì đã hứa là bấm được.

**Tự hỏi.** Nếu người dùng bấm ngay lúc con trỏ ở đây, có chuyện gì xảy ra không?

**Ranh giới**

- `STATE-3`: rê chuột là **thiết bị trỏ**; tiêu điểm-hiển thị là **bàn phím**. Hai lớp khác nhau, hai nhóm
  người dùng khác nhau, **không** thay thế được cho nhau. Đây là lỗi hay gặp nhất của cả mô-đun.
- `STATE-4`: rê chuột là "con trỏ đang ở đây"; `STATE-4` là "nút chuột đang bị giữ xuống".
- `STATE-6`: rê chuột **tạm thời** và do con trỏ quyết; `STATE-6` **bền** và do dữ liệu quyết. Một thẻ tab
  đang được chọn vẫn rê chuột được, và hai lớp phải phân biệt được với nhau.

**Rê chuột không bao giờ đứng một mình.** Viết `hover:` mà không viết `focus-visible:` là dựng một
thành phần điều khiển chỉ dùng được bằng chuột. Nó vẫn đẹp trong ảnh chụp.

**Rê chuột không được là nơi duy nhất chứa thông tin.** Trên thiết bị cảm ứng, không có rê chuột. Thứ gì
chỉ hiện ra khi rê chuột thì trên điện thoại nó **không tồn tại** — nếu nó quan trọng, nó không phải là
rê chuột.

**Tình huống nghiệp vụ hay gặp.** Nút · liên kết · dòng danh sách bấm được · thẻ mở chi tiết · mục
trong trình đơn · ô ngày trong lịch · thẻ thẻ lọc được · biểu tượng-nút trong thanh công cụ · dòng bảng bấm được.

---

## `STATE-3` — bàn phím vừa rơi vào phần tử

**Tình huống.** Người dùng đang điều khiển trang bằng bàn phím, và cần biết **mình đang đứng ở đâu**.
Đây là lớp bắt buộc vô điều kiện của mọi phần tử tiêu điểm được.

**Dấu hiệu nhận biết**

- Đến được bằng phím Thẻ tab: `<a href>`, `<button>`, `<input>`, `<select>`, `<textarea>`, hoặc có `tabindex="0"`.
- Nếu bỏ chuột ra khỏi bàn, người dùng vẫn phải hoàn thành được luồng.
- Có ai đó trong cơ sở mã đã viết `outline-none` — đó là dấu hiệu lớp này đã bị xoá.

**Tự hỏi.** Nếu rút chuột ra, người dùng có nhìn thấy mình đang đứng ở đâu không?

**Ranh giới**

- `STATE-2`: xem trên. Không có chuyện "đã có rê chuột rồi thì thôi".
- `STATE-1`: `focus-visible` chỉ vẽ khi trình duyệt xác định người dùng đang dùng bàn phím. Dùng
  `focus:` thay cho `focus-visible:` khiến vòng dính lại sau mỗi cú bấm chuột, và rồi ai đó sẽ xoá
  hẳn nó cho đỡ xấu — đó chính là đường mà lớp này biến mất.
- `STATE-8`: trường nhập liệu vừa có tiêu điểm vừa không hợp lệ thì **giữ cả hai**: vòng tiêu điểm nằm trên, viền lỗi nằm
  dưới. Vòng không được nuốt viền lỗi.

**Chỉ báo tiêu điểm phải nhìn thấy trên nền nó đang nằm.** Đối tượng đồ hoạ dùng để truyền đạt trạng
thái phải đạt tương phản 3:1 với màu liền kề. Một vòng xám nhạt trên nền xám nhạt là **không có
vòng**.

**`outline-none` không phải một quyết định thẩm mỹ.** Nó xoá tín hiệu duy nhất mà người dùng bàn phím
có. Nó chỉ hợp lệ khi nằm **cùng một class CSS danh sách** với thứ thay thế nó.

**Tình huống nghiệp vụ hay gặp.** Nút · liên kết · ô nhập · ô chọn · hộp kiểm và nút chọn · thẻ tab · dòng trình đơn
· nút đóng của hộp thoại · nút biểu tượng không chữ · dòng danh sách bấm được · nút phân trang · bỏ qua liên kết.

---

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
- `STATE-7`: `STATE-4` kéo dài đúng bằng cú nhấn — hàng chục mili-giây. `STATE-7` bắt đầu **sau
  khi** cú nhấn nhả ra và kéo dài bằng công việc. Một nút gửi biểu mẫu đi qua cả hai, theo thứ tự.

**`STATE-4` phải khai báo sau `STATE-2`.** Cùng độ đặc hiệu thì cái viết sau thắng, và cú nhấn phải
đè được lên rê chuột, không phải ngược lại.

**Không đổi hình học.** Đổi cân nặng chữ hay bề dày viền khi nhấn sẽ đẩy hàng xóm, và một thành phần điều khiển
**dịch chuyển dưới ngón tay** thì cú nhấn thứ hai rơi ra ngoài. Đổi màu, đổi bóng, hoặc `scale` —
`scale` biến đổi khi vẽ chứ không tính lại bố cục.

**Tình huống nghiệp vụ hay gặp.** Nút gửi · nút thanh toán · nút thêm vào giỏ · dòng danh sách bấm
được · nút tăng giảm số lượng · phím trên bàn phím ảo · nút bấm giữ để ghi âm · nút chuyển trang.

---

## `STATE-5` — không dùng được trong ngữ cảnh này

**Tình huống.** Phần tử tồn tại, người dùng nhìn thấy nó, nhưng **bây giờ** không dùng được: chưa đủ
quyền, chưa xong bước trước, hết lượt, sai ngữ cảnh.

**Dấu hiệu nhận biết**

- Có một điều kiện nghiệp vụ quyết định phần tử này bật hay tắt.
- Nếu bấm được thì máy chủ cũng sẽ từ chối.
- Nó không biến mất — nghĩa là ta đang cố **cho người dùng biết nó tồn tại**.

**Tự hỏi.** Có một điều kiện nghiệp vụ nào — quyền, hạn mức, bước trước, ngữ cảnh — quyết định phần
tử này bật hay tắt không?

**Ranh giới**

- `STATE-9`: `STATE-5` nói "việc này không dành cho bạn lúc này". `STATE-9` nói "giá trị này có
  thật, đọc được, văn bản được, chỉ là không sửa ở đây". Ô thư điện tử trong trang hồ sơ đã xác thực là
  `STATE-9`, không phải `STATE-5`.
- `STATE-7`: `STATE-5` là điều kiện **bên ngoài**; `STATE-7` là công việc **của chính phần tử**.
  Một nút đang gửi biểu mẫu thì trạng thái gốc là `STATE-7`; nó *cũng* không bấm được, nhưng lý do nằm ở
  chỗ khác và thông điệp cũng khác.
- `STATE-0`: một phần tử bị tắt **vĩnh viễn ở mọi ngữ cảnh** thì không nên hiển thị ra một thành phần điều khiển.

**Mã khai báo đè mã tạm thời.** Đã tắt thì không vẽ rê chuột, không vẽ đang hoạt động. Một nút bị vô hiệu hoá mà vẫn
sáng lên khi rê chuột là đang hứa một cú bấm sẽ ăn.

**Tắt không phải là lời giải thích.** Người dùng nhìn thấy nút xám không biết vì sao. Nếu lý do quan
trọng, dùng ngoại lệ `aria-disabled` để phần tử vẫn đến được bằng phím Thẻ tab và vẫn nói được lý do bằng chữ.

**Tình huống nghiệp vụ hay gặp.** Nút gửi khi biểu mẫu chưa hợp lệ · thao tác cần quyền cao hơn · nút
"Trang trước" ở trang đầu · vị trí đã hết chỗ · tính năng cần gói trả phí · bước tiếp theo khi bước
trước chưa xong · nút xoá khi chưa chọn dòng nào · gửi lại mã khi còn đếm ngược.

---

## `STATE-6` — đang là cái được chọn, đang mở, đang đứng ở đây

**Tình huống.** Trong một tập phần tử ngang hàng, phần tử này đang mang một điều kiện **bền**: được
chọn, đang là trang hiện tại, đang vạch chia, đang mở. Điều kiện đó do **dữ liệu** quyết, không do con trỏ.

**Dấu hiệu nhận biết**

- Rời con trỏ đi, đóng trang rồi mở lại, nó vẫn còn.
- Có một phần tử — và thường chỉ một — trong nhóm mang trạng thái này.
- Có một thuộc tính ARIA tương ứng: `aria-current`, `aria-selected`, `aria-checked`, `aria-expanded`,
  `aria-pressed`.

**Tự hỏi.** Buông con trỏ ra và tải lại trang, trạng thái này có còn không? Còn thì `STATE-6`.

**Ranh giới**

- `STATE-2`: rê chuột tạm thời và theo con trỏ; `STATE-6` bền và theo dữ liệu. Một thẻ tab đang chọn vẫn
  rê chuột được, nên hai lớp phải **phân biệt được với nhau** — không được dùng cùng một màu nền.
- `STATE-1`: một thẻ tab chưa được chọn là `STATE-1`, không phải một biến thể mờ của `STATE-6`.
- `STATE-5`: được chọn và bị tắt là hai chuyện độc lập; một dòng có thể vừa đang chọn vừa không
  thao tác được.

**Không mã hoá bằng riêng màu.** Người không phân biệt được màu, và trình duyệt ở chế độ tương phản
cưỡng bức, đều mất lớp này. Kèm theo một dấu hiệu thứ hai: một thanh chỉ báo, một dấu vạch chia, một chữ.

**Trạng thái phải nằm trong DOM, không chỉ trong CSS.** Không có `aria-current`/`aria-selected` thì
trình đọc màn hình không đọc ra được điều mà con mắt đang thấy.

**Tình huống nghiệp vụ hay gặp.** Thẻ tab đang mở · mục điều hướng của trang hiện tại · dòng đã vạch chia
trong bảng · ngày đang chọn trên lịch · bộ lọc đang bật · gói đang dùng · vùng thu gọn đang mở · nút
nút chuyển đang bật · bước hiện tại trong bộ bước · ngôn ngữ đang chọn.

---

## `STATE-7` — việc của chính phần tử đang chạy dở

**Tình huống.** Người dùng đã bấm, cú nhấn đã ăn, và **kết quả chưa về**. Phần tử phải nói rằng việc
đang chạy, và phải chặn cú bấm thứ hai.

**Dấu hiệu nhận biết**

- Hành động đi qua mạng, hoặc qua một tính toán không xong trong cùng một frame.
- Bấm hai lần sẽ tạo hai bản ghi, hai lần trừ tiền, hai thư điện tử.
- Có một khoảng thời gian mà giao diện không có gì mới để nói, nhưng cũng chưa được im lặng.

**Tự hỏi.** Giữa lúc bấm và lúc có kết quả, người dùng nhìn vào đâu để biết hệ thống đã nghe?

**Ranh giới**

- `STATE-4`: xem trên. `STATE-4` dài bằng cú nhấn; `STATE-7` dài bằng công việc.
- `STATE-5`: xem trên. Tắt vì điều kiện bên ngoài ≠ bận vì việc của chính mình.
- nội dung đang tải: nếu **cả một vùng** đang chờ dữ liệu để vẽ lần đầu, đó là nội dung của vùng
  chứ không phải lớp trạng thái của một phần tử. Chuyện đó thuộc mô-đun hàng xóm.

**Không được làm bố cục nhảy.** Thay chữ "Lưu" bằng một biểu tượng đang tải làm nút co lại và mọi thứ bên cạnh
dịch chỗ. Giữ nguyên chữ, thêm chỉ báo, hoặc để sẵn chỗ cho nó.

**Bận thì không vẽ rê chuột, không vẽ đang hoạt động.** Và phải chặn được cú nhấn thứ hai thật sự, không chỉ vẽ
cho có.

**Tình huống nghiệp vụ hay gặp.** Nút gửi biểu mẫu · nút thanh toán · nút tải tệp · nút gửi lại mã ·
nút áp mã giảm giá · nút đồng bộ · ô tìm kiếm đang chờ kết quả · nút chấm bài.

---

## `STATE-8` — giá trị đang giữ đã bị từ chối

**Tình huống.** Phần tử giữ một giá trị, và một bộ kiểm tra — ở máy khách hay máy chủ — đã **từ chối**
giá trị đó. Phần tử phải nói rằng lỗi nằm ở **chính nó**, và nói lỗi là gì.

**Dấu hiệu nhận biết**

- Có một quy tắc mà giá trị này có thể vi phạm: bắt buộc, định dạng, độ dài, trùng, khoảng giá trị.
- Có một thông báo cần được gắn vào đúng phần tử này, không phải vào cả biểu mẫu.
- Người dùng phải **sửa được** — nghĩa là phần tử vẫn thao tác được.

**Tự hỏi.** Có một quy tắc nào mà giá trị của phần tử này có thể vi phạm không?

**Ranh giới**

- `STATE-5`: trường nhập liệu lỗi **không bị tắt**. Tắt một trường nhập liệu lỗi là khoá người dùng ra khỏi thứ duy nhất
  họ cần sửa.
- `STATE-3`: xem trên; hai lớp cùng tồn tại được.
- lỗi cấp biểu mẫu: một biểu ngữ lỗi ở đầu biểu mẫu **không** thay thế được `STATE-8` trên từng trường nhập liệu. Biểu ngữ
  nói "có lỗi"; `STATE-8` nói "lỗi ở đây".

**Không mã hoá bằng riêng màu viền.** Viền đỏ một mình không đủ. Phải có chữ, và chữ phải được **liên
kết** tới trường nhập liệu bằng `aria-describedby` để trình đọc màn hình đọc ra khi tiêu điểm vào.

**Giữ chỗ cho thông báo.** Thông báo xuất hiện làm mọi thứ bên dưới tụt xuống, và người dùng đang định
bấm nút gửi sẽ bấm trúng thứ khác.

**Tình huống nghiệp vụ hay gặp.** Thư điện tử sai định dạng · mật khẩu chưa đủ mạnh · trường bắt buộc bỏ
trống · mã giảm giá không tồn tại · số lượng vượt tồn kho · ngày kết thúc trước ngày bắt đầu · tên
đăng nhập đã có người dùng · tệp quá dung lượng · số thẻ không hợp lệ.

---

## `STATE-9` — giá trị đọc được nhưng bị đóng băng

**Tình huống.** Giá trị là **thật**, cần đọc được, cần văn bản được, cần đến được bằng phím Thẻ tab — nhưng không được
sửa **ở đây**. Đây không phải là bị tắt; đây là một giá trị được trưng ra.

**Dấu hiệu nhận biết**

- Người dùng có lý do chính đáng để chọn và văn bản giá trị này.
- Giá trị có thể sửa được ở **chỗ khác**, hoặc do hệ thống sinh ra.
- Nó vẫn được gửi kèm khi gửi biểu mẫu, hoặc vẫn cần đọc được bằng trình đọc màn hình.

**Tự hỏi.** Người dùng có cần đọc và sao chép giá trị này không? Có thì `STATE-9`, không thì cân nhắc
`STATE-5`.

**Ranh giới**

- `STATE-5`: xem trên. Đây là ranh giới bị làm sai nhiều nhất trong nhóm khai báo: `disabled` làm
  giá trị **mờ đi, không văn bản được, không đến được bằng phím Thẻ tab** — ba tổn thất, chỉ để diễn đạt một điều mà
  `readOnly` diễn đạt đúng.
- `STATE-0`: nếu giá trị chỉ để đọc và **không** phải là một trường nhập liệu, đừng hiển thị một `<input>`. Một
  đoạn chữ là `STATE-0` và trung thực hơn.

**Vẫn phải trả `STATE-3`.** Chỉ đọc vẫn đến được bằng phím Thẻ tab, nên vẫn phải nhìn thấy tiêu điểm.

**Tình huống nghiệp vụ hay gặp.** Mã đơn hàng hệ thống sinh · thư điện tử đã xác thực trong hồ sơ · API key
đã tạo · số dư tính ra từ giao dịch · tổng tiền của giỏ hàng · đường dẫn công khai sinh từ tiêu đề ·
mã mời · thông tin hoá đơn đã chốt.

---

## Luật

1. Số lớp trạng thái **suy ra từ năng lực** của phần tử, không do ai chọn.
2. Phần tử phản ứng với con trỏ hoặc bàn phím sở hữu đủ `STATE-1`, `STATE-2`, `STATE-3`, `STATE-4`.
3. `STATE-2` không bao giờ đứng một mình. Có `hover:` thì phải có `focus-visible:`.
4. `outline-none` chỉ hợp lệ khi nằm cùng class CSS danh sách với thứ thay thế nó.
5. Không trạng thái nào được mã hoá bằng **riêng màu**; mỗi mã khai báo phải có một dấu hiệu thứ hai.
6. Chỉ báo trạng thái đạt tương phản **3:1** với màu liền kề.
7. Không trạng thái nào được đổi **hình học**. Đổi màu, đổi bóng, đổi vòng, `scale` — không đổi kích
   thước, cân nặng chữ, bề dày viền hay vị trí.
8. Mã khai báo (`STATE-5`…`STATE-9`) **đè** mã tạm thời (`STATE-2`, `STATE-4`).
9. Thứ tự khai báo trong class CSS danh sách theo đúng thứ tự chỉ số: rê chuột trước, tiêu điểm-hiển thị, rồi đang hoạt động.
10. Thứ chỉ hiện ra khi rê chuột thì **không tồn tại** trên thiết bị cảm ứng.
11. Trạng thái phải có mặt trong **DOM** (`disabled`, `aria-*`, `readOnly`), không chỉ trong CSS.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Tắt nhưng phải giải thích được.** `disabled` gỡ phần tử khỏi thẻ tab thứ tự, và gỡ luôn lời giải thích
  gắn vào nó. Khi lý do quan trọng, giữ phần tử tiêu điểm được, đánh dấu `aria-disabled="true"`, chặn
  hành động trong hàm xử lý, và nói lý do bằng chữ. Mã vẫn là `STATE-5`; chỉ cơ chế đổi.
- **Bận ở cấp vùng.** Khi công việc thuộc về **một vùng** chứ không thuộc thành phần điều khiển đã khởi động nó,
  `STATE-7` do vùng mang, và thành phần điều khiển bên trong vẽ `STATE-5`. Hai phần tử không cùng nhận một công
  việc đang chạy.
- **Chọn do tổ tiên sở hữu.** Dòng được chọn vẽ `STATE-6` **trên dòng**. Các thành phần điều khiển bên trong giữ
  lớp của riêng chúng và không nhắc lại trạng thái chọn.
- **Vòng tiêu điểm mặc định đã đủ.** Phần tử không hề đặt `outline-none` và vượt được phép thử 3:1 trên
  nền tảng của nó thì đã trả xong `STATE-3` mà không cần thêm class CSS. Mã vẫn được ghi nhận; nó chỉ
  không phát ra gì mới.
- **Hai mã cùng khớp.** Ưu tiên mã **khai báo**. Vừa rê chuột vừa bị vô hiệu hoá thì là bị vô hiệu hoá; vừa tiêu điểm
  vừa không hợp lệ thì vòng nằm trên, viền lỗi nằm dưới, giữ cả hai.
- **Tính đồng nhất giữa các khung nhìn.** Đổi khung nhìn, đổi chủ đề, đổi ngôn ngữ **không** làm mất một lớp. Trên
  cảm ứng `STATE-2` không được kích hoạt, nhưng nó vẫn phải được khai báo — cùng một thành phần còn
  chạy trên máy có chuột.
