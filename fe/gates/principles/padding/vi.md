---
id: fe-principles-padding-vi
title: vi.md
slug: /gates/principles/padding/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống PADDING-N, nhận diện bằng quyền sở hữu ranh giới chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `padding`

# Khoảng đệm trong

Khoảng đệm trong là khoảng **khoảng đệm bên trong** mà một **ranh giới** dành cho nội dung trực tiếp của chính nó.

Ranh giới là thứ **vẽ ra một ranh giới** — nền, viền, đổ bóng, ô kẻ — hoặc **sở hữu ranh giới đó về mặt
ngữ nghĩa**, ví dụ mặt phẳng mà cả một tuyến trang sinh ra để phục vụ. Không có ranh giới thì không có gì để
khoảng đệm bên trong.

Đừng chọn khoảng đệm trong bằng cảm giác. Hãy chỉ vào một phần tử và hỏi:

> Nó có đang **sở hữu một ranh giới** không, và ranh giới đó **chịu trách nhiệm cho loại nội dung
> nào**?

Nội dung càng gọn và càng lặp lại, khoảng đệm bên trong càng nhỏ. Nội dung càng là **việc chính của cả trang**, khoảng đệm bên trong
càng lớn.

Khoảng đệm trong **không** dùng để đẩy hàng xóm ra xa. Khoảng cách giữa các phần tử cùng cấp là việc của `gap` trên
phần tử cha. Một phần tử phình khoảng đệm bên trong của mình để đẩy phần tử bên cạnh là đang trả lời một câu hỏi không ai
hỏi.

**Đây là luật bắt buộc.** Mọi phần tử hiển thị ra đều hoặc là ranh giới hoặc không, và cả hai câu trả lời
đều có mã dưới đây. Không có kích thước nào nhỏ đến mức được miễn: một ô hai dòng trong dải chia kẻ là
`PADDING-2` đúng cùng một lý do mà mặt phẳng đọc tài liệu là `PADDING-6`. Câu "nó chỉ là cái lớp bọc
thôi mà" là chỗ luật này bị bỏ qua nhiều nhất — và nó có mã riêng chính vì thế.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `PADDING-0` | Phần tử **không sở hữu khoảng đệm bên trong nào** | *không khai báo class CSS*, hoặc `p-0` khi một ranh giới thật uỷ quyền |
| `PADDING-2` | Ô lặp lại gọn, chỉ chứa **một** dữ kiện ngắn hoặc **một** hành động | `p-2` |
| `PADDING-3` | Ô lặp lại hoặc ô kẻ thường, chứa **một nhóm nội dung nhỏ** | `p-3` |
| `PADDING-4` | Bề mặt thông thường, hàng đã được cấu thành, hoặc khối nhấn mạnh lồng bên trong | `p-4` |
| `PADDING-6` | Mặt phẳng đọc/làm việc **chính** của tuyến trang | `p-6` |

Thang này **thủng** ở `1`, `5` và mọi giá trị trên `6`. Thang thủng ép người viết phải quyết định vai
trò của ranh giới; thang liền mời người ta chia đôi khoảng cách, tức là để thẩm mỹ quay lại bằng đường
số học. Thêm một bậc là **đổi luật**, ghi vào `changelog.md`, không phải một lần chọn khác đi.

---

## `PADDING-0` — phần tử không sở hữu khoảng đệm bên trong nào

Đây là mã duy nhất phát ra **hai thứ khác nhau**, và lý do rất hẹp: cả hai đều nói khoảng đệm bên trong bằng không,
nhưng chúng khác nhau ở chỗ **có tồn tại ranh giới hay không**.

### Thể thứ nhất — không có ranh giới ⇒ *không khai báo class CSS*

**Tình huống.** Một lớp bọc chỉ để **xếp đặt**: dựng cụm xếp dọc, dựng lưới, dựng một hàng. Nó không vẽ nền,
không vẽ viền, không mang ngữ nghĩa ranh giới nào. Nó không có gì để khoảng đệm bên trong.

**Dấu hiệu nhận biết**

- Xoá phần tử này đi thì **không có ranh giới nào biến mất**, chỉ có bố cục vỡ.
- Class CSS của nó chỉ gồm `flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `min-w-0`.
- Nội dung bên trong nó đã tự có bề mặt riêng, hoặc đang nằm trong một bề mặt của cha.

**Tự hỏi.** Nếu tôi bỏ hết class CSS trang trí đi, phần tử này còn vẽ ra ranh giới nào không?

**Ranh giới**

- thể `p-0`: `p-0` là **quyết định của một ranh giới thật**. Lớp bọc trong suốt không có quyền ra
  quyết định đó, vì nó không sở hữu ranh giới nào để mà uỷ quyền.
- `PADDING-4`: nếu lớp bọc được thêm `border` hoặc `bg-*`, nó vừa **trở thành** ranh giới — và lúc đó
  nó phải nhận một khoảng đệm bên trong, không được để trống.

**Tình huống nghiệp vụ hay gặp.** Cụm xếp dọc giữa tiêu đề và biểu mẫu bên trong một khung có sẵn · lưới xếp các
thẻ · cột nội dung của trang · hàng bọc hai nút · lớp bọc `min-w-0` để cắt chữ · vùng bọc chỉ để đặt
`gap`.

### Thể thứ hai — ranh giới thật uỷ quyền khoảng đệm bên trong ⇒ `p-0`

**Tình huống.** Có ranh giới thật, nhưng nó **giao toàn bộ khoảng đệm bên trong** cho các hàng/ô trực tiếp, hoặc cho
**một** nội dung phần tử con. Lý do nghiệp vụ luôn là một trong hai: để **đường kẻ chạm tới mép**, hoặc để
**ảnh/nội dung tràn sát viền**.

**Dấu hiệu nhận biết**

- Có `border`, `bg-*` hoặc `rounded-*` trên phần tử này.
- Các con trực tiếp tự thêm khoảng đệm và tự là vùng bấm được.
- Nếu cha giữ lại khoảng đệm bên trong, đường phân cách sẽ hụt hai đầu và danh sách trông như bị cắt cụt.

**Tự hỏi.** Ranh giới này có thật, và nó có đang **cố ý** giao khoảng đệm bên trong cho con không?

**Ranh giới**

- thể *không class CSS*: xem trên. Đây là khác biệt lâu đời nhất của mô-đun này và cũng là chỗ bị viết
  sai nhiều nhất.
- `PADDING-4`: một danh sách mà cha giữ `p-4` **và** vẫn kẻ `divide-y` là đang nói ranh giới hai lần theo
  hai cách mâu thuẫn.

**Viết `p-0` ra thành chữ, đừng bỏ trống.** Uỷ quyền là một **quyết định**; người đọc sau phải phân
biệt được "đã quyết định giao đi" với "quên chưa đặt".

**Tình huống nghiệp vụ hay gặp.** Danh sách có đường phân cách · bảng dữ liệu · dải số liệu chia cột · thẻ có ảnh
bìa tràn viền · trình đơn lệnh · luồng tin thông báo · khung chứa bảng cuộn ngang.

---

## `PADDING-2` — ô lặp lại gọn

**Tình huống.** Một ô **lặp lại** trong một tập ô giống nhau, và nó chỉ chứa **một** dữ kiện ngắn hoặc
**một** hành động. Ô tồn tại để **đếm được, quét mắt được**, không phải để đọc.

**Dấu hiệu nhận biết**

- Nội dung là một con số, một nhãn, một ngày, một phím tắt, một trạng thái.
- Các ô cùng bộ đều giống nhau về cấu trúc; đọc một ô là hiểu cả bộ.
- Ô nằm trong một cha đã uỷ quyền khoảng đệm bên trong (`PADDING-0` thể `p-0`).

**Tự hỏi.** Ô này chứa **một** dữ kiện, hay chứa **một nhóm** dữ kiện?

**Ranh giới**

- `PADDING-3`: có **nhóm** — nhãn cộng giá trị cộng trạng thái — thì lên `PADDING-3`. Một số kèm
  đơn vị của chính nó vẫn là **một** dữ kiện.
- `PADDING-4`: ô lặp lại **không** phải bề mặt dùng lại được. Nếu phần tử đó tự đứng một mình ở chỗ
  khác cũng đúng nghĩa thì nó là bề mặt, không phải ô.

**Không dùng `PADDING-2` để "cho gọn hơn".** Gọn là hệ quả, không phải tiêu chí.

**Tình huống nghiệp vụ hay gặp.** Ô số liệu trong dải chia cột · ô ngày trong lịch · ô phím tắt · ô
chú giải biểu đồ · hàng dày đặc chỉ có một nhãn · ô nhãn màu trong bảng trạng thái · ô đơn vị trong
bảng quy đổi.

---

## `PADDING-3` — ô lặp lại có một nhóm nhỏ

**Tình huống.** Vẫn là ô lặp lại hoặc ô kẻ, nhưng bên trong đã là **một nhóm nội dung nhỏ**: nhãn và
giá trị, tiêu đề và dòng phụ, tên và trạng thái.

**Dấu hiệu nhận biết**

- Bên trong ô đã cần tới `gap` để tổ chức các phần của nó.
- Ô vẫn thuộc một bộ đồng dạng, vẫn không tự đứng một mình được.
- Đường kẻ hoặc lưới vẫn là thứ phân tách các ô, không phải khoảng trắng.

**Tự hỏi.** Ô này đã cần **cấu trúc bên trong** chưa, và nó có còn phụ thuộc vào bộ của mình không?

**Ranh giới**

- `PADDING-2`: xem trên.
- `PADDING-4`: câu hỏi quyết định là **tự đứng được hay không**. Một hàng trong danh sách kẻ là
  `PADDING-3`; cũng nội dung đó nhưng bọc trong một thẻ có viền riêng, rời khỏi danh sách vẫn đúng, là
  `PADDING-4`.

**Tình huống nghiệp vụ hay gặp.** Ô lưới có nhãn + giá trị + trạng thái · hàng danh sách có dòng chính
và dòng phụ · ô bảng số liệu · dòng lịch sử giao dịch · dòng thành viên có vai trò · ô so sánh gói
dịch vụ.

---

## `PADDING-4` — bề mặt thông thường

**Tình huống.** Một **bề mặt dùng lại được**: nó tự vẽ ranh giới, ôm một cụm nội dung đã cấu thành,
và mang đi chỗ khác vẫn đọc được nguyên nghĩa. Đây là bậc mặc định của mọi thẻ, khung và khối nhấn mạnh
lồng trong.

**Dấu hiệu nhận biết**

- Có ranh giới thật và có nhiều loại nội dung bên trong: tiêu đề, mô tả, số liệu, hành động.
- Bên cạnh nó có những bề mặt ngang hàng khác.
- Nó **không** phải lý do tồn tại của cả tuyến trang.

**Tự hỏi.** Đây là một bề mặt dùng lại được nằm giữa những bề mặt khác, hay là mặt phẳng chính của
tuyến trang?

**Ranh giới**

- `PADDING-3`: xem trên.
- `PADDING-6`: chỉ lên `PADDING-6` khi tuyến trang **chỉ tồn tại** vì mặt phẳng này. Một thẻ to vẫn là
  thẻ; kích thước không nâng bậc.

**Khối nhấn mạnh lồng bên trong cũng là `PADDING-4`.** Nó thêm nền/viền của riêng nó ⇒ nó là ranh giới thật ⇒
nó phải có khoảng đệm bên trong. Nhưng cái cụm xếp dọc nằm giữa thẻ và khối nhấn mạnh thì **không** — cụm xếp dọc là `PADDING-0` thể
không class CSS.

**Tình huống nghiệp vụ hay gặp.** Thẻ khoá học · khung hồ sơ · khối tóm tắt thanh toán · khối nhấn mạnh cảnh
báo hạn mức · hàng đã cấu thành trong một danh sách · thẻ trạng thái rỗng · thẻ thông báo lỗi · khối biểu mẫu
có viền.

---

## `PADDING-6` — mặt phẳng chính

**Tình huống.** Tuyến trang này **sinh ra để phục vụ đúng một việc**, và đây là mặt phẳng chứa việc đó: một
bài đọc, một luồng làm bài, một tài liệu, một biểu mẫu dài. Không có bề mặt nào ngang hàng cạnh tranh
sự chú ý với nó.

**Dấu hiệu nhận biết**

- Chỉ có một mặt phẳng như thế trên tuyến trang.
- Nội dung bên trong là dòng chảy dài, cần biên nghỉ mắt để đọc liên tục.
- Bỏ mặt phẳng này đi thì tuyến trang mất lý do tồn tại.

**Tự hỏi.** Nếu bỏ mặt phẳng này, tuyến trang còn nghĩa gì không?

**Ranh giới**

- `PADDING-4`: xem trên. "To hơn", "thoáng hơn", một ảnh chụp màn hình — **không** phải bằng chứng.
  Bằng chứng duy nhất là **vai trò trên tuyến trang**.

**Tình huống nghiệp vụ hay gặp.** Mặt phẳng đọc bài học · vùng làm bài kiểm tra · trang tài liệu · một
biểu mẫu dài chiếm cả tuyến trang · vùng nội dung của hộp thoại khi hộp thoại chỉ có một việc · trang kết
quả sau khi nộp bài.

---

## Luật

1. Tìm phần tử **vẽ ra hoặc sở hữu về ngữ nghĩa** ranh giới đó trước. Nó là chủ sở hữu khoảng đệm bên trong.
2. Chỉ **trực tiếp nội dung** của ranh giới đó quyết định bậc.
3. Một ranh giới nhận **đúng một** quyết định khoảng đệm bên trong.
4. Lớp bọc chỉ xếp đặt thì **không có class CSS khoảng đệm trong** — không phải `p-0`.
5. Bề mặt nằm trong bề mặt chỉ có khoảng đệm bên trong riêng khi nó **thật sự** thêm nền, viền hoặc ranh giới ngữ
   nghĩa.
6. Khoảng đệm trong không dùng để đẩy phần tử cùng cấp; việc đó thuộc `gap` của phần tử cha.
7. Đang tải, rỗng, lỗi và sẵn sàng giữ **nguyên một** khoảng đệm trong cây.
8. Đổi trục hay đổi khung nhìn **không** đổi bậc, trừ khi vai trò ranh giới thật sự đổi.
9. Nếu còn hai bậc liền kề cùng hợp lý, mặc định chọn **bậc nhỏ hơn**; chỉ hỏi khi bên yêu cầu nói rõ
   họ cần vai trò lớn hơn.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **`p-0` là uỷ quyền tường minh.** Nó khác hoàn toàn với việc không khai báo khoảng đệm trong trên một lớp bọc
  trong suốt. Cả hai đều thuộc `PADDING-0`, và chọn nhầm thể là một lỗi, không phải một cách viết
  khác.
- **Thành phần điều khiển tương tác giữ khoảng đệm bên trong nội tại của nó.** Bên sử dụng không vá thêm `px-*`/`py-*` từ bên ngoài.
  Ai thấy khoảng đệm bên trong đó sai thì sửa ở nơi thành phần điều khiển được định nghĩa; vá tại một nơi sử dụng biến một thành phần điều khiển
  thành hai hình dạng.
- **Cạnh phần tử chồng lớp.** Chỉ được chừa khoảng đệm bên trong cho một thành phần điều khiển đặt đè lên mép của phần tử khác **sau khi**
  vị trí và hình học bố cục đã được xác định. Chưa xác định thì không bịa khoảng đệm bên trong.
- **Từ ngữ không phải bằng chứng.** "Lớn", "thoáng", "chật", cùng một ảnh chụp màn hình — không phân
  biệt được `PADDING-4` với `PADDING-6`.
- **Chưa rõ ai sở hữu ranh giới.** Mặc định **không** thêm khoảng đệm trong nào từ phía bên sử dụng, và hỏi đúng
  **một** câu — chỉ khi bên yêu cầu nói rõ họ cần một khoảng đệm bên trong khác mặc định.
- **Tính đồng nhất trạng thái.** Khung chờ, rỗng, lỗi và có dữ liệu dùng chung một khoảng đệm trong cây. Đổi khoảng đệm bên trong khi
  đang tải làm bố cục nhảy đúng vào lúc người dùng đang nhìn.
- **Thiết kế đáp ứng.** Chỉ đổi bậc khi vai trò ranh giới **thật sự** đổi, không phải khi màn hình rộng ra.
