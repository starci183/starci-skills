---
id: fe-principles-contrast-vi
title: vi.md
slug: /gates/principles/contrast/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống CONTRAST-N, nhận diện bằng vai trò của cặp chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `contrast`

# Độ tương phản

Độ tương phản là thuộc tính của **một cặp**, không phải của một màu. Một biến thiết kế không tự nó dễ đọc hay khó
đọc; nó chỉ trở thành một trong hai khi đã nằm trên một nền cụ thể.

Luật màu chọn biến thiết kế theo **ý nghĩa** của phần tử. Nó không thể trả lời được cặp cuối cùng nằm cạnh
nhau có đọc được không, vì nó chỉ nhìn **một** nút DOM mỗi lần. Hai quyết định đúng riêng lẻ — một dòng
phụ màu mờ, một khung màu mờ — ghép lại thành một cặp **không ai đo và không ai chịu trách nhiệm**.
Chỗ trống đó là chỗ mô-đun này đứng.

Hãy nhìn hai lớp đang chồng lên nhau và hỏi:

> Vai trò của lớp trên là gì, và nó đang nằm trên **nền nào đã được khai báo**?

**Nền là tổ tiên gần nhất có khai báo màu nền.** Nếu suốt chuỗi cha không ai khai báo, cặp này
**chưa được đo** — nó chỉ đang được *giả định*.

**Đây là luật bắt buộc.** Mọi cặp hiển thị ra đều rơi vào đúng một mã dưới đây, và không có trường hợp
nào nhỏ đến mức được miễn. Một mốc thời gian 12px trên khung lồng là `CONTRAST-1`, đúng cùng một lý do mà
một tiêu đề lớn là `CONTRAST-2`. Câu "có mỗi cái chú thích thôi mà", "có mỗi cái đường kẻ thôi mà",
"có mỗi cái văn bản gợi ý thôi mà" là ba chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `CONTRAST-0` | Trang trí hoặc được chuẩn miễn theo **bản chất**; không mang thông tin nào | *không có cặp; `aria-hidden="true"`* |
| `CONTRAST-1` | Chữ thường và mọi chữ dưới ngưỡng lớn — 4.5:1 | cặp khai báo: `bg-card text-foreground` |
| `CONTRAST-2` | Chữ lớn, ≥24px hoặc ≥18.66px in đậm — 3:1 | cặp khai báo ở cỡ lớn: `bg-background text-3xl font-semibold` |
| `CONTRAST-3` | Thành phần điều khiển, đồ hoạ mang thông tin và đường biên cần thiết để nhận biết thành phần — 3:1 | `border-border`, `bg-primary`, biểu tượng `text-foreground` |
| `CONTRAST-4` | Vòng tiêu điểm — 3:1 với **cả** thành phần điều khiển lẫn nền bên ngoài | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| `CONTRAST-5` | Màu không bao giờ là **kênh duy nhất** mang nghĩa | thêm kênh thứ hai: `underline`, biểu tượng, hình dạng, hoa văn, chữ |
| `CONTRAST-6` | Nền **không xác định** — ảnh, video, dải chuyển màu, nội dung người dùng | dựng nền trước: `bg-black/60`, rồi mới áp `CONTRAST-1`/`CONTRAST-2` |
| `CONTRAST-7` | Thành phần điều khiển **thật sự bị vô hiệu hoá**; tạm được miễn yêu cầu về tỉ lệ tương phản | `disabled:opacity-50` + `disabled` / `aria-disabled="true"` thật |

---

## `CONTRAST-0` — trang trí, miễn theo bản chất

**Tình huống.** Thứ này **không mang thông tin nào cả**. Gỡ nó ra, người dùng vẫn biết đủ mọi thứ họ
cần biết. Nó được miễn vĩnh viễn, vì bản chất nó là như vậy chứ không phải vì trạng thái nhất thời.

**Dấu hiệu nhận biết**

- Gỡ nó ra: không có câu nào, con số nào, ranh giới nào biến mất.
- Nó đã bị ẩn khỏi cây trợ năng, hoặc đáng lẽ phải bị ẩn.
- Thông tin mà nó "gợi ý" đã được nói ở chỗ khác bằng chữ.
- Là biểu trưng chữ: chữ nằm **trong** dấu hiệu thương hiệu.

**Tự hỏi.** Nếu thứ này biến mất hoàn toàn, có dữ kiện nào người dùng không còn cách nào khác để
biết không? Nếu không có — `CONTRAST-0`.

**Ranh giới**

- `CONTRAST-3`: đây là điểm phân biệt quan trọng nhất của mô-đun. Nếu khoảng cách và tiêu đề đã thể hiện
  rõ ranh giới giữa hai vùng, đường phân cách chỉ mang tính trang trí ⇒ `CONTRAST-0`. Ngược lại, nếu đường
  kẻ là dấu hiệu duy nhất giúp người dùng nhận ra mép của ô nhập ⇒ `CONTRAST-3`.
- `CONTRAST-7`: `CONTRAST-0` áp dụng cho phần tử vốn không mang thông tin; `CONTRAST-7` áp dụng cho
  thành phần điều khiển chỉ tạm thời không hoạt động. Khi được bật lại, thành phần điều khiển phải đáp ứng
  yêu cầu về độ tương phản; hoa văn trang trí thì không.
- `CONTRAST-6`: ảnh nền của vùng nổi bật có thể chỉ để trang trí, nhưng chữ đặt trên ảnh vẫn phải đọc được.
  Khi nền thay đổi theo ảnh, hãy thêm một lớp nền ổn định rồi mới kiểm tra tỉ lệ tương phản của chữ.

**Không có khái niệm "gần như chỉ để trang trí".** Nếu việc bỏ phần tử đi làm mất thông tin, phần tử đó
không phải là trang trí. Đừng dựa vào phỏng đoán rằng người dùng sẽ không đọc; chỉ coi phần tử là trang trí
khi nó không truyền tải thông tin và được chủ ý loại khỏi trải nghiệm đọc.

**Tình huống nghiệp vụ hay gặp.** Hoa văn nền của biểu ngữ · vệt dải chuyển màu trang trí · biểu tượng lặp lại y hệt
chữ ngay cạnh nó · dấu ngoặc kép cỡ lớn của một trích dẫn · biểu trưng chữ · đường kẻ trang trí giữa hai
phần nội dung đã cách nhau rõ · ảnh minh hoạ cho một câu đã nói đủ nghĩa · hiệu ứng ánh sáng lướt của khung chờ.

---

## `CONTRAST-1` — chữ thường, 4.5:1

**Tình huống.** Mọi thứ đọc được bằng chữ và **chưa** đạt ngưỡng chữ lớn. Đây là mã phổ biến nhất và
cũng là mã bị bỏ sót nhiều nhất, vì chữ phụ thường được chọn màu mờ rồi bị đặt lên nền cũng mờ.

**Dấu hiệu nhận biết**

- Nội dung là chữ, cỡ dưới 24px, hoặc dưới 18.66px khi in đậm.
- Người dùng phải **đọc** nó mới hoàn thành được việc: nhãn, giá, hạn, mã đơn, thông báo lỗi.
- Chữ phụ, văn bản gợi ý, văn bản hỗ trợ, chú thích đều nằm ở đây — không có ngoại lệ nào cho "chữ phụ".

**Tự hỏi.** Có ai đó phải **đọc từng chữ** để làm xong việc của họ không? Nếu có, và cỡ chữ chưa đạt
ngưỡng lớn — `CONTRAST-1`.

**Ranh giới**

- `CONTRAST-2`: ranh giới **duy nhất** là cỡ và độ đậm đã tính ra px, không phải "trông to". Chữ
  20px in thường vẫn là `CONTRAST-1`.
- `CONTRAST-3`: chữ trong một nút là `CONTRAST-1`; **nền** của nút đó so với nền trang là
  `CONTRAST-3`. Một nút vì thế luôn có ít nhất hai cặp.
- `CONTRAST-6`: nếu nền dưới chữ là ảnh hoặc dải chuyển màu chưa xác định, chưa được gọi là `CONTRAST-1` —
  phải qua `CONTRAST-6` trước rồi mới đo.
- `CONTRAST-7`: chữ trong một thành phần điều khiển vô hiệu được treo tỉ lệ; **lý do** vì sao nó vô hiệu thì
  không, lý do đó luôn là `CONTRAST-1`.

**Tình huống nghiệp vụ hay gặp.** Nội dung bài · nhãn của trường nhập liệu · văn bản gợi ý · văn bản hỗ trợ · thông
báo lỗi kiểm tra tính hợp lệ · giá và đơn vị · mốc thời gian trong luồng tin · chú thích dưới ảnh · chữ phụ trong hàng danh
sách · nhãn trạng thái có chữ · chú giải · chữ trong trạng thái rỗng · trục và nhãn của biểu đồ · chữ trong thông báo nổi.

---

## `CONTRAST-2` — chữ lớn, 3:1

**Tình huống.** Chữ đã đủ lớn để hình dạng chữ tự bù lại một phần độ tương phản: từ 24px trở lên, hoặc
từ 18.66px trở lên khi in đậm. Chuẩn hạ tỉ lệ xuống 3:1 vì **nét chữ dày hơn**, không phải vì nội dung
kém quan trọng hơn.

**Dấu hiệu nhận biết**

- Cỡ chữ **tính ra px** đã vượt ngưỡng, ở **mọi** điểm ngắt mà nó được hiển thị.
- Vẫn là chữ để đọc, không phải hình.
- Thường là tiêu đề, số liệu lớn, tiêu đề màn hình.

**Tự hỏi.** Cỡ chữ đã tính ra px có vượt ngưỡng ở **điểm ngắt nhỏ nhất** không? Nếu ở thiết bị di động nó tụt
xuống dưới ngưỡng, cặp đó là `CONTRAST-1`.

**Ranh giới**

- `CONTRAST-1`: chỉ có cỡ và độ đậm phân định. Đây là chỗ hay bị lách nhất: phóng to chữ **để khỏi
  phải đo** là một quyết định kiểu chữ kèm hệ quả độ tương phản, không phải một cách né đo.
- `CONTRAST-3`: một con số lớn là chữ ⇒ `CONTRAST-2`. Một cột trong biểu đồ, dù to hơn nhiều, là đồ
  hoạ ⇒ `CONTRAST-3`.

**Cẩn thận với thiết kế đáp ứng.** `text-3xl md:text-5xl` đạt ngưỡng ở máy tính nhưng phải kiểm lại ở thiết bị di động. Một
mã đúng ở một điểm ngắt và sai ở điểm ngắt khác là **một cặp chưa đo**, không phải một mã linh hoạt.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề lớn trong vùng nổi bật · tiêu đề trang · số liệu lớn trong bảng điều khiển · giá
lớn trong bảng giá · số đếm ngược · tiêu đề bài học ở đầu màn hình · con số trong thẻ thống kê.

---

## `CONTRAST-3` — thành phần điều khiển, đồ hoạ mang thông tin và đường biên cần thiết

**Tình huống.** Thứ **không phải chữ** nhưng vẫn phải nhìn thấy mới dùng hoặc hiểu được: mép của một
thành phần điều khiển, hình khối của một biểu tượng mang nghĩa, một cột trong biểu đồ, một thanh tiến độ, ô đã vạch chia.

**Dấu hiệu nhận biết**

- Không nhìn thấy nó thì **không biết bấm vào đâu** hoặc **không đọc được dữ liệu**.
- Nó là bằng chứng duy nhất cho một trạng thái: đã chọn, đang bật, đã hoàn thành.
- Nó là **mép** của thứ đang nhận thao tác.

**Tự hỏi.** Nếu đường nét này biến mất, người dùng còn biết thành phần điều khiển nằm ở đâu, hoặc còn đọc được con số
này không? Nếu không — `CONTRAST-3`.

**Ranh giới**

- `CONTRAST-0`: xem trên. Phép thử là **gỡ nó ra** rồi hỏi còn dữ kiện nào mất đi không.
- `CONTRAST-1`: chữ trên thành phần điều khiển là `CONTRAST-1`; hình của thành phần điều khiển là `CONTRAST-3`. Hai cặp khác
  nhau trên cùng một nút.
- `CONTRAST-4`: vòng tiêu điểm **không** phải một biên thường; nó chỉ tồn tại lúc có tiêu điểm và phải đo
  với hai phía, nên nó có mã riêng.
- `CONTRAST-5`: `CONTRAST-3` nói "phải nhìn thấy được"; `CONTRAST-5` nói "không được chỉ dựa vào
  sắc màu". Hai cột biểu đồ có thể **đều** đủ 3:1 với nền mà **vẫn** vi phạm `CONTRAST-5` vì chúng không
  phân biệt được với nhau khi mù màu.

**Biểu tượng chỉ đủ 3:1 khi nó là kênh duy nhất.** Một biểu tượng lặp lại y hệt chữ ngay cạnh nó là `CONTRAST-0`.

**Tình huống nghiệp vụ hay gặp.** Viền ô nhập liệu · viền và nền của nút · ô hộp kiểm chưa vạch chia · núm của
công tắc · thanh trượt · nút chỉ có biểu tượng · thanh tiến độ · cột và đường của biểu đồ · lát bánh · viền
của thẻ **khi nó là mép duy nhất** · dấu vạch chia của bước đã hoàn thành · gạch dưới của thẻ tab đang chọn ·
chấm trạng thái.

---

## `CONTRAST-4` — vòng tiêu điểm

**Tình huống.** Vết chỉ báo cho biết bàn phím **đang đứng ở đâu**. Đây là thứ duy nhất người dùng bàn
phím có để định vị mình trên trang, và nó chỉ tồn tại trong lúc di chuyển.

**Dấu hiệu nhận biết**

- Chỉ xuất hiện khi điều hướng bằng bàn phím.
- Nó bao quanh **thứ khác**, nên nó đồng thời chạm hai màu: màu thành phần điều khiển và màu nền bên ngoài.
- Nếu bị `outline-none` mà không thay bằng gì, mã này bị **xoá** chứ không phải bị thu nhỏ.

**Tự hỏi.** Vòng này có tách bạch **cả** với thành phần điều khiển bên trong **và** với nền bên ngoài không? Chỉ đạt
một phía là chưa có chỉ báo.

**Ranh giới**

- `CONTRAST-3`: biên thường mô tả thành phần điều khiển lúc nào cũng tồn tại; vòng tiêu điểm mô tả **vị trí bàn phím**
  ngay lúc này.
- trạng thái được chọn: "đang chọn" và "đang tiêu điểm" là **hai** sự thật khác nhau và phải phân biệt
  được khi cùng xuất hiện trên một phần tử. Không được dùng chung một dấu hiệu.

**Vòng có khoảng tách phải đo với nền.** `ring-offset-2` cắt một vành nền vào giữa thành phần điều khiển và vòng; vành đó là
nền, nên vòng phải tương phản với **nền**, và nền đó phải là nền đã khai báo.

**Tình huống nghiệp vụ hay gặp.** Nút · liên kết · ô nhập liệu · ô chọn · hộp kiểm và nút chọn · thẻ bấm được ·
thẻ tab · phần tử trong trình đơn · hàng có thể chọn · nút đóng của hộp thoại · thẻ trong danh sách điều hướng.

---

## `CONTRAST-5` — màu không phải kênh duy nhất

**Tình huống.** Có một sự thật nghiệp vụ chỉ được nói bằng **sắc màu**. Đây là mã duy nhất **không có tỉ
lệ nào cả**: nó không hỏi cặp có đủ sáng không, nó hỏi **có kênh thứ hai không**.

**Dấu hiệu nhận biết**

- Chụp màn hình rồi bỏ hết màu: có dữ kiện nào biến mất không?
- Câu hướng dẫn nói "chọn ô màu xanh", "dòng đỏ là dòng lỗi".
- Hai chuỗi dữ liệu chỉ khác nhau ở màu.
- Liên kết trong đoạn văn chỉ khác chữ thường ở màu.

**Tự hỏi.** In trang này ra máy in đen trắng, có câu nào không còn trả lời được không?

**Ranh giới**

- `CONTRAST-1`/`CONTRAST-3`: tỉ lệ và kênh thứ hai là **hai nghĩa vụ độc lập**. Đủ 4.5:1 không xoá
  được `CONTRAST-5`, và có biểu tượng không xoá được nghĩa vụ đo tỉ lệ. Chỗ nào cả hai cùng áp thì **cả
  hai** cùng áp.
- `CONTRAST-0`: một biểu tượng **lặp lại** chữ bên cạnh là trang trí. Cũng biểu tượng đó, khi nó là kênh thứ hai
  duy nhất cho một trạng thái, là một phần của `CONTRAST-5`.

**Kênh thứ hai phải là kênh, không phải sắc độ.** Đổi từ đỏ sang đỏ đậm hơn vẫn là sắc màu. Kênh hợp lệ:
chữ, biểu tượng có hình khác nhau, hình dạng, hoa văn, gạch dưới, vị trí, nhãn trợ năng.

**Tình huống nghiệp vụ hay gặp.** Trạng thái đơn hàng · trường nhập liệu lỗi khi kiểm tra tính hợp lệ · liên kết trong đoạn văn ·
chuỗi dữ liệu trong biểu đồ · nhãn bắt buộc/tuỳ chọn · nhãn trạng thái còn hàng/hết hàng · bản so sánh thay đổi thêm/xoá · trạng
thái đạt/chưa đạt của một bài nộp · lịch có ngày bận · mức độ ưu tiên.

---

## `CONTRAST-6` — nền không xác định

**Tình huống.** Thứ nằm dưới chữ **không phải một màu**: là ảnh, video, dải chuyển màu, hoặc nội dung do
người dùng tải lên. Không có cặp nào để đo, vì một nửa của cặp chỉ được biết lúc chạy.

**Dấu hiệu nhận biết**

- Nền đến từ dữ liệu: ảnh bìa, ảnh đại diện, ảnh sản phẩm, ảnh thu nhỏ video.
- Có dải chuyển màu, hoặc nền chuyển động.
- Cùng một dòng chữ đó, ở một bản ghi khác, sẽ nằm trên một màu khác hẳn.

**Tự hỏi.** Với **bức ảnh sáng nhất và bức ảnh tối nhất** mà dữ liệu có thể trả về, dòng chữ này có
còn đọc được không?

**Ranh giới**

- `CONTRAST-1`/`CONTRAST-2`: mã này **không thay thế** hai mã kia; nó là bước **đứng trước**. Dựng
  xong nền, cặp mới tồn tại, và lúc đó mã thật là `CONTRAST-1` hoặc `CONTRAST-2`.
- `CONTRAST-0`: bản thân bức ảnh trang trí là `CONTRAST-0`. Chữ đặt lên nó thì không.

**Không được đo với "ảnh mẫu".** Đo với ảnh trong bản thiết kế là đo với một dữ liệu may mắn. Phải đo
với **lớp nền do mình dựng ra**, vì chỉ lớp đó mới xác định.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề trên ảnh bìa · chữ trên ảnh thu nhỏ video · chữ ký tên trên
ảnh nền · nhãn trạng thái đặt trên ảnh sản phẩm · chú thích trên băng chuyền · chữ trên bản đồ · nút phát trên video ·
tên người dùng đặt trên ảnh bìa hồ sơ.

---

## `CONTRAST-7` — thành phần điều khiển thật sự vô hiệu

**Tình huống.** Một thành phần điều khiển **không nhận được thao tác nào**. Chuẩn tạm treo nghĩa vụ tỉ lệ cho nó,
đúng để nó **trông** khác với thành phần điều khiển còn dùng được.

**Dấu hiệu nhận biết**

- Có `disabled` thật, hoặc `aria-disabled="true"` thật, không phải chỉ làm mờ bằng CSS.
- Bấm vào không xảy ra gì; di chuyển đến bằng phím Thẻ tab không được, hoặc đến được nhưng không kích hoạt được.
- Có một **lý do** vì sao nó bị khoá, và lý do đó phải đọc được ở chỗ khác.

**Tự hỏi.** Thành phần điều khiển này có **thật sự** không nhận thao tác không, hay nó chỉ đang được làm mờ cho đỡ
nổi bật? Nếu là vế sau — không phải `CONTRAST-7`, mà là `CONTRAST-1` cộng `CONTRAST-3`.

**Ranh giới**

- `CONTRAST-0`: xem trên. Miễn theo trạng thái so với miễn theo bản chất.
- `CONTRAST-1`: **lý do bị khoá không bao giờ được miễn.** "Hoàn thành bài trước để mở khoá" là chữ
  người dùng phải đọc, nên nó là `CONTRAST-1` đầy đủ, kể cả khi nó nằm ngay dưới một nút mờ.
- trạng thái đang tải: nút đang gửi **không** vô hiệu theo nghĩa này — nó đang bận. Nó vẫn giữ
  `CONTRAST-1` và `CONTRAST-3`, vì người dùng vẫn phải đọc được nó đang làm gì.

**Đừng "sửa" độ tương phản của thành phần điều khiển vô hiệu.** Làm nó đậm lên cho đạt 4.5:1 là xoá mất tín hiệu
"không bấm được", tức là đổi một lỗi đọc thành một lỗi hiểu.

**Tình huống nghiệp vụ hay gặp.** Nút gửi khi biểu mẫu chưa hợp lệ · bài học bị khoá · ngày quá khứ trong
lịch · lựa chọn đã hết chỗ · thẻ tab của tính năng chưa mở · nút xoá khi chưa chọn dòng nào · trường nhập liệu chỉ đọc
trong quy trình đã chốt.

## Luật

1. Đặt tên **cả hai nửa** của cặp trước khi đặt mã. Không có nửa thứ hai thì không có mã.
2. Nền là **tổ tiên gần nhất có khai báo màu nền**, không phải màu trang mà mình đoán.
3. Độ trong suốt tạo ra một màu mới. `text-foreground/60` là một cặp khác và cần một lần đo khác.
4. Sáng và tối phải **cùng** đạt. Đạt một chủ đề là chưa đạt.
5. Một nút DOM có cả nền lẫn chữ thì có **hai** cặp, và hai cặp đó có hai mã.
6. Cỡ chữ nâng nghĩa vụ, **không** đổi vai trò.
7. Tỉ lệ không thay được `CONTRAST-5`, và `CONTRAST-5` không thay được tỉ lệ.
8. Hai mã cùng khớp thì lấy mã **chặt hơn**. Hướng an toàn của mô-đun này là đi lên.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đóng và nêu rõ mã nó áp vào.

- **Biểu trưng chữ (`CONTRAST-0`).** Chữ nằm trong dấu hiệu thương hiệu được miễn. Miễn cho dấu hiệu, không
  miễn cho chữ quanh nó, và không miễn cho dấu chữ thương hiệu bị đem đi làm tiêu đề.
- **Nội dung ngẫu nhiên (`CONTRAST-0`).** Thứ bị ẩn với mọi người dùng, hoặc nằm hoàn toàn sau nội
  dung đục, không mang nghĩa vụ.
- **Thành phần điều khiển vô hiệu (`CONTRAST-7`).** Chỉ treo tỉ lệ khi thành phần điều khiển **thật sự** không nhận thao tác và lý
  do đã được viết ở chỗ đạt `CONTRAST-1`.
- **Nền không xác định (`CONTRAST-6`).** Không bao giờ tuyên bố một tỉ lệ với một bức ảnh. Dựng nền
  trước, rồi đo với thứ mình vừa dựng.
- **Biên thừa (`CONTRAST-0` thay vì `CONTRAST-3`).** Đường phân cách chỉ nhắc lại một ranh giới đã nói bằng
  khoảng cách thì không mang thông tin. Vừa là bằng chứng duy nhất về mép thành phần điều khiển thì lập tức thành
  `CONTRAST-3`.
- **Chưa có số đo.** Giữ nguyên cặp đã được chứng nhận. Không bịa ra một sắc độ "chắc là an toàn hơn";
  chưa đo vẫn là chưa đo.
- **Tỉ lệ nâng cao.** Mô-đun này nêu sàn AA. Đòi 7:1 là một **thay đổi luật** ghi vào `changelog.md`,
  không phải một cách đọc chặt hơn của cùng luật.
