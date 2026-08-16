---
id: fe-principles-position-vi
title: vi.md
slug: /gates/principles/position/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống POSITION-N, nhận diện bằng nghiệp vụ chứ không bằng chỗ nhìn thấy trên màn hình.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `position`

# Vị trí

Vị trí trả lời đúng **hai** câu hỏi, không hơn:

> Phần tử này còn **giữ chỗ** trong luồng không?
> Và **hệ toạ độ nào** đang sở hữu nó?

Vị trí **không** trả lời câu "cho nó nằm ở góc trên bên phải". Câu đó là một bức ảnh, và một bức
ảnh có thể được dựng ra bằng cả sáu mã dưới đây — bằng flex, bằng `absolute`, bằng `fixed`, bằng
`sticky`. Chừng nào chưa biết ai giữ chỗ và ai sở hữu toạ độ thì chưa có dữ kiện để chọn.

**Đây là luật bắt buộc.** Mọi phần tử được hiển thị đều rơi vào đúng một mã dưới đây, kể cả — nhất là —
đa số phần tử rơi vào `POSITION-1` và không phát ra class CSS nào. Không có kích thước nào nhỏ đến mức
được miễn: một nhãn trạng thái nằm đè lên ảnh thu nhỏ là `POSITION-3` đúng cùng một lý do mà một lớp phủ chặn
tương tác là `POSITION-4`. Câu "nó chỉ là cái lớp bọc thôi mà" là chỗ luật này bị vi phạm nhiều
nhất, và vi phạm đó **vô hình**: một lớp bọc mang `relative` mà không có được định vị phần tử hậu duệ nào
hiển thị ra y hệt như khi không mang.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `POSITION-1` | Đọc theo thứ tự tài liệu, phải đẩy phần đứng sau | *không khai báo vị trí* |
| `POSITION-2` | Một phần tử trong luồng phải làm **chủ toạ độ** cho con được định vị | `relative` |
| `POSITION-3` | Rời luồng, bám vào một phần tử tổ tiên **được gọi tên** | `absolute` + khoảng đệm bên trong đã khai báo |
| `POSITION-4` | Rời luồng, bám vào **khung nhìn** | `fixed` + khoảng đệm bên trong đã khai báo |
| `POSITION-5` | Vẫn giữ chỗ, bám cuộn phần tử tổ tiên **được gọi tên** tới một ngưỡng | `sticky` + ngưỡng + nền đục |
| `POSITION-6` | Vị trí gắn liền với va chạm, trả tiêu điểm và đóng lớp | *mô-đun này không phát class CSS* |

Sáu mã đánh số theo **thứ tự người đọc gặp**, không theo độ lớn. Đây **không phải một cái thang**:
`POSITION-5` không "to hơn" `POSITION-3`, và không có tình huống nào nằm giữa hai mã. Một yêu cầu
không khớp mã nào là một yêu cầu **thiếu dữ kiện**, không phải một yêu cầu cần chế thêm mã thứ bảy.

**Không bao giờ viết `static`.** Vắng mặt class CSS vị trí là một sự kiện khác với việc khai báo
`static`. Viết `static` là tuyên bố mình đã quyết một hệ toạ độ, trong khi thật ra mình quyết là
không sở hữu hệ toạ độ nào.

---

## `POSITION-1` — dòng chảy bình thường

**Tình huống.** Nội dung đọc từ trên xuống, từ trước ra sau. Khi phần tử này xuất hiện, dài ra, hay
biến mất, những phần đứng sau **phải dịch chuyển theo**. Đây là mặc định và là đáp án đúng cho phần
lớn màn hình.

**Dấu hiệu nhận biết**

- Nội dung phía sau phải bị đẩy xuống khi phần tử này dài thêm.
- Không có phần tử nào **đè lên** phần tử nào.
- Việc căn hai đầu, chia đều, hay dồn về một phía đã có chủ sở hữu lo — đó là chuyện phân phối không gian
  của cha, không phải chuyện toạ độ.
- Trạng thái đổi (đang tải, rỗng, lỗi, có dữ liệu) chỉ thay nội dung trong cùng một chỗ.

**Tự hỏi.** Nếu phần tử này dài thêm một dòng, phần đứng sau nó **có phải dịch xuống không**? Nếu
có — `POSITION-1`.

**Ranh giới**

- `POSITION-2`: `relative` chỉ được thêm khi **đã có** một con được định vị cần chủ toạ độ. Không có
  con đó thì vẫn là `POSITION-1`, dù cái lớp bọc trông "có vẻ nên relative".
- `POSITION-3`: nếu chưa ai gọi tên điểm neo chủ sở hữu thì **giữ nguyên** `POSITION-1`. Thiếu chủ sở hữu là
  thiếu dữ kiện, không phải là được phép đoán.
- `POSITION-5`: "cho nó luôn nhìn thấy" chưa phải `sticky` chừng nào chưa có cuộn phần tử tổ tiên và
  ngưỡng.

**Tình huống nghiệp vụ hay gặp.** Biểu mẫu nhãn–ô nhập–gợi ý–nút gửi · thông báo lỗi nội tuyến đẩy các
trường nhập liệu sau xuống · thanh công cụ có tiêu đề bên trái và cụm nút bên phải · nút hành động đứng sau bằng
chứng mà nó tác động · vùng đổi trạng thái tải/rỗng/lỗi/có dữ liệu · tiêu đề dài phải xuống dòng chứ
không được đè lên siêu dữ liệu · đường dẫn phân cấp · bảng số liệu thường · phần bình luận nối tiếp bài viết.

---

## `POSITION-2` — làm chủ hệ toạ độ

**Tình huống.** Bản thân phần tử này **không hề dịch chuyển**. Nó vẫn ở nguyên trong luồng, vẫn giữ
chỗ, vẫn đẩy phần sau. Việc duy nhất nó làm thêm là **nhận trách nhiệm làm gốc toạ độ** cho một con
đã rời luồng.

**Dấu hiệu nhận biết**

- Có một con cụ thể mang `absolute` và con đó phải bám vào **đúng** phần tử này.
- Bỏ `relative` đi thì con kia không biến mất, nó **bay đi chỗ khác** — bám vào một phần tử tổ tiên xa hơn.
- Bản thân phần tử này không có khoảng tách nào (`top-*`, `left-*`) — nếu có, nó đang tự dịch mình, và đó
  là một quyết định khác cần lý do riêng.

**Tự hỏi.** Có **con nào** đang cần phần tử này làm gốc toạ độ không? Nếu không kể tên được con đó
thì `relative` này thừa.

**Ranh giới**

- `POSITION-1`: đây là ranh giới hay bị vi phạm nhất, và vi phạm **không nhìn thấy được**. Một
  `relative` thừa hiển thị ra y hệt như không có. Nó chỉ lộ ra sau này, khi ai đó thêm một
  `POSITION-3` ở tầng sâu hơn và con đó bám nhầm vào cái lớp bọc thừa này thay vì bám vào chủ sở hữu thật.
- `POSITION-3`: `relative` **giữ chỗ**, `absolute` **không**. Hai mã này thường đi thành cặp trên
  hai tầng khác nhau của cùng một cây, và đó là lý do chúng phải là hai mã chứ không phải một.

**Tình huống nghiệp vụ hay gặp.** Ảnh thu nhỏ chứa nhãn trạng thái trạng thái · vỏ ô nhập chứa nút xoá ở cuối ·
khung bị cắt (`overflow-hidden`) chứa hoạ tiết trang trí · thẻ có dấu "mới" ở góc · khung ảnh đại diện có
chấm online · vùng biểu đồ có nhãn đè lên · nút có chấm đếm thông báo.

---

## `POSITION-3` — bám vào một phần tử tổ tiên được gọi tên

**Tình huống.** Phần tử **rời khỏi luồng**: nó không còn giữ chỗ, không còn đẩy ai. Toạ độ của nó
được đo từ một phần tử tổ tiên **cụ thể, gọi được tên**, và nó phải **di chuyển cùng** phần tử tổ tiên đó.

**Dấu hiệu nhận biết**

- Nó **đè lên** nội dung khác, và việc đè đó là chủ ý nghiệp vụ chứ không phải hệ quả căn chỉnh.
- Khi phần tử tổ tiên cuộn đi, nó cuộn đi theo. Khi phần tử tổ tiên đổi kích thước, nó bám theo mép mới.
- Chỗ nó chiếm đã được chủ sở hữu **chừa sẵn** — hoặc nó là trang trí thuần và không cần chỗ.
- Có khoảng đệm bên trong khai báo rõ ràng: `top-*`, `end-*`, `inset-*`.

**Tự hỏi.** Phần tử tổ tiên nào là **gốc toạ độ** của nó? Nếu không gọi tên được phần tử tổ tiên đó thì chưa được
phép rời luồng.

**Ranh giới**

- `POSITION-1`: "cho nó nằm ở góc trên bên phải" **không** phải bằng chứng để rời luồng. Căn chỉnh
  trong khoảng trống là việc của flex/lưới; rời luồng là việc của sự **đè lên nhau**.
- `POSITION-4`: gốc toạ độ là **một phần tử tổ tiên** hay là **khung nhìn**? Nếu cuộn trang mà nó phải ở
  yên một chỗ trên màn hình thì đó là `POSITION-4`.
- `POSITION-6`: nếu ngoài toạ độ ra nó còn phải tránh mép màn hình, trả tiêu điểm về điều kiện và đóng
  khi bấm ra ngoài, thì nó **không phải** `POSITION-3`.

**Tình huống nghiệp vụ hay gặp.** Nhãn trạng thái trạng thái trên ảnh thu nhỏ · nút xoá trong ô tìm kiếm · chấm
online trên ảnh đại diện · huy hiệu số trên nút thông báo · nhãn "giảm giá" trên ảnh sản phẩm · hoạ tiết
trang trí bị khung cắt · thanh tiến độ mảnh nằm ở mép dưới của thẻ · lớp dải chuyển màu phủ ảnh để chữ
đọc được.

---

## `POSITION-4` — bám khung nhìn

**Tình huống.** **Khung nhìn** sở hữu phần tử. Tài liệu cuộn bao nhiêu cũng không liên quan: phần tử ở
nguyên chỗ của nó trên màn hình, và nó **không thuộc về** bất kỳ phần nội dung nào.

**Dấu hiệu nhận biết**

- Nó không dừng lại ở ranh giới của bất kỳ phần nội dung nào — cuộn hết trang nó vẫn còn đó.
- Nó không giữ chỗ; không có nội dung nào bị nó đẩy đi.
- Nghiệp vụ mô tả nó theo **màn hình**, không theo **nội dung**: "chặn toàn màn hình", "luôn nổi ở
  góc màn hình".

**Tự hỏi.** Khi cuộn tới cuối trang, phần tử này **còn ở nguyên chỗ trên màn hình** không? Nếu có —
`POSITION-4`. Nếu nó phải dừng lại ở đâu đó — không phải.

**Ranh giới**

- `POSITION-5`: đây là ranh giới bị nhầm nhiều nhất, vì cả hai đều được mô tả bằng cùng một câu
  tiếng Việt: "giữ cho nó luôn nhìn thấy". `fixed` **rời luồng** và **không bao giờ dừng**; `sticky`
  **giữ chỗ** và **dừng ở ranh giới**. Khi yêu cầu chỉ nói "luôn nhìn thấy", đó là dữ kiện thiếu, và
  phải hỏi đúng một câu.
- `POSITION-3`: gốc toạ độ là khung nhìn hay một phần tử tổ tiên.
- `POSITION-6`: một lớp phủ chặn tương tác là `POSITION-4` **về hình học**, nhưng vòng đời của
  hộp thoại nằm bên trong nó thì thuộc `POSITION-6`. Hai mã cùng có mặt trên hai phần tử khác nhau.

**Tình huống nghiệp vụ hay gặp.** Lớp phủ tối chặn tương tác · nút hành động nổi ở góc màn hình trên
thiết bị di động · thanh thông báo hệ thống ghim đáy màn hình · vùng xếp thông báo nổi · thanh chấp thuận cookie ·
thanh tiến trình tải mảnh ở mép trên màn hình.

---

## `POSITION-5` — bám cuộn phần tử tổ tiên tới một ngưỡng

**Tình huống.** Phần tử **vẫn giữ chỗ của mình trong luồng**, nhưng khi cuộn phần tử tổ tiên cuộn qua một
ngưỡng, nó **dừng lại** tại ngưỡng đó thay vì trôi đi. Khi vùng chứa nó kết thúc, nó **đi theo** vùng
đó ra khỏi màn hình.

**Dấu hiệu nhận biết**

- Nó có một cuộn phần tử tổ tiên **gọi được tên**: một vùng `overflow-y-auto`, hoặc chính document.
- Có ngưỡng khai báo rõ: `top-*` hoặc `bottom-*`. Không có ngưỡng thì `sticky` **không có
  điểm dừng** và hành vi không xác định.
- Nội dung có thể trôi **bên dưới** nó, nên nó cần một nền **đục**. Thiếu nền đục là chữ chồng chữ.
- Nó vẫn chiếm chỗ ban đầu: bỏ nó ra thì bố cục **co lại**.

**Tự hỏi.** Nó **dừng ở ranh giới của vùng chứa** hay đi theo màn hình mãi mãi? Dừng — `POSITION-5`.

**Ranh giới**

- `POSITION-4`: xem trên. Phép thử dứt điểm: cuộn qua hết vùng chứa. `sticky` biến mất cùng vùng
  chứa; `fixed` thì không.
- `POSITION-1`: nếu chưa ai nói ngưỡng dừng là gì thì giữ nguyên luồng và hỏi một câu.
- `POSITION-2`: cả hai đều giữ chỗ, nhưng `relative` không bám theo cuộn — nó chỉ nhận trách nhiệm
  làm gốc toạ độ.

**Tình huống nghiệp vụ hay gặp.** Hàng tiêu đề cột của bảng cuộn dọc · mục lục bên cạnh bài viết dài
· thanh nút hành động ghim đáy một khung cuộn · tiêu đề nhóm trong danh sách dài · thanh tóm tắt giỏ
hàng bám theo khi cuộn danh mục · thanh lọc dính đầu vùng kết quả.

---

## `POSITION-6` — vị trí gắn liền với vòng đời tương tác

**Tình huống.** Phần tử **bám vào một điều kiện**, nhưng toạ độ chỉ là phần nhỏ nhất của việc đặt nó:
nó còn phải **lật hướng khi chạm mép màn hình**, **nhận tiêu điểm** khi mở, **trả tiêu điểm về điều kiện** khi
đóng, đóng khi bấm ra ngoài hoặc bấm `Escape`, và tuyên bố vai trò của mình cho công nghệ trợ giúp.

Mô-đun này **không phát ra class CSS nào** cho tình huống đó. Không phải vì toạ độ khó, mà vì viết tay
`absolute` sẽ dựng lại **đúng phần dễ nhất** và **âm thầm bỏ mất tất cả phần còn lại**. Kết quả trông
đúng trong ảnh chụp và sai với bàn phím, sai với trình đọc màn hình, sai khi điều kiện nằm sát mép.

**Dấu hiệu nhận biết**

- Có một điều kiện, và lớp này mở ra **từ** điều kiện đó.
- Lớp phải tránh mép màn hình: chạm mép thì lật lên/lật sang.
- Có khái niệm "đang mở" / "đang đóng", và có nơi tiêu điểm phải quay về.
- Có phím `Escape`, có bấm-ra-ngoài-để-đóng.

**Tự hỏi.** Ngoài toạ độ ra, nó còn phải **tránh va chạm, giữ tiêu điểm và tự đóng** không? Nếu có —
`POSITION-6`, và câu trả lời không phải là một class CSS.

**Ranh giới**

- `POSITION-3`: một nhãn trạng thái trang trí bám ảnh thu nhỏ **không** có vòng đời — không mở, không đóng,
  không giữ tiêu điểm. Đó là `POSITION-3` thật. Ranh giới nằm ở **vòng đời**, không nằm ở việc có bám
  vào cái gì hay không.
- `POSITION-4`: lớp phủ tối phủ kín khung nhìn tự nó là `POSITION-4`; cái nằm **trong** lớp phủ, với
  tiêu điểm bẫy và đường thoát, là `POSITION-6`.

**Tình huống nghiệp vụ hay gặp.** Trình đơn thả xuống từ nút · chú giải trên biểu tượng · cửa sổ nổi chọn
ngày · hộp gợi ý của ô tìm kiếm · trình đơn chuột phải · hộp thoại xác nhận · combobox có danh sách gợi ý.

---

## Luật

1. Mặc định là luồng thường. Không phát ra class CSS vị trí khi không có việc gì cho nó làm.
2. `relative` chỉ được thêm khi **gọi tên được** con được định vị đang cần nó làm gốc toạ độ.
3. `absolute` phải **gọi tên** điểm neo chủ sở hữu. Nếu chưa có phần tử tổ tiên được định vị nào là chủ đích, thì
   chính chủ sở hữu đó phải được đặt `POSITION-2` một cách **cố ý**, không phải để nó tự tìm thấy một
   phần tử tổ tiên tình cờ ở đâu đó phía trên.
4. `fixed` nghĩa là **khung nhìn sở hữu**, không phải "cho nó luôn hiện ra đâu đó".
5. `sticky` phải đủ **ba** thứ: cuộn phần tử tổ tiên gọi được tên, ngưỡng, và nền đục ở chỗ nội dung
   có thể trôi qua bên dưới.
6. `absolute` và `fixed` **không giữ chỗ**. Chủ sở hữu phải tự chừa sẵn chỗ nếu nghiệp vụ cần chỗ đó.
7. Vị trí **không** dùng để sửa khoảng cách, căn chỉnh, thứ tự nguồn hay thứ tự thiết kế đáp ứng.
8. Vị trí **không bao giờ** làm thứ tự đọc khác thứ tự DOM. Thứ tự nhìn và thứ tự tiêu điểm đi cùng
   nhau.
9. Trình đơn, chú giải, cửa sổ nổi và hộp thoại là `POSITION-6`; mô-đun này không dựng lại vòng đời của chúng
   bằng class CSS thô.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Chưa khai báo điểm neo chủ sở hữu.** Giữ `POSITION-1`, không phát class CSS. Thiếu chủ sở hữu giải về luồng
  thường, không giải về một `POSITION-3` đoán mò.
- **Chưa khai báo quyền sở hữu khung nhìn.** Không phát `fixed`. "Luôn nhìn thấy" là câu hỏi chưa trả
  lời giữa `POSITION-4` và `POSITION-5`.
- **Chưa khai báo ngưỡng.** Không phát `sticky`. Một phần tử bám cuộn mà không có ngưỡng thì
  không có chỗ dừng nào để nói là đúng hay sai.
- **Trang trí thuần.** Một phần tử không mang nội dung và không có tương tác được phép là
  `POSITION-3` chỉ để trình bày, **với điều kiện** thông tin mà nó minh hoạ vẫn tồn tại trong luồng ở
  dạng đọc được.
- **Tính đồng nhất trạng thái.** Bốn trạng thái của một vùng — đang tải, rỗng, lỗi, có dữ liệu — dùng chung
  một mã. Khung chờ đổi cách tham gia luồng là làm trang nhảy trong lúc tải.
- **Hai mã cùng khớp.** Chọn mã **giữ được luồng**. Chỉ hỏi đúng **một** câu cụ thể khi bên yêu cầu
  nói rõ họ cần hành vi rời luồng.
- **Thiết kế đáp ứng.** Đổi khung nhìn không tự đổi mã. Chỉ đổi khi **vai trò** thay đổi thật — ví dụ một
  thanh hành động là `POSITION-1` trong trang rộng nhưng được nghiệp vụ yêu cầu ghim vào màn hình
  trên thiết bị di động, thì đó là hai mã cho hai vai trò khác nhau, không phải một mã bị bẻ cong.
