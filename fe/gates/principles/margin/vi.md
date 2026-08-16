---
id: fe-principles-margin-vi
title: vi.md
slug: /gates/principles/margin/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống MARGIN-N, nhận diện bằng dữ kiện bố cục chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `margin`

# Lề ngoài

Lề ngoài dịch chuyển **một** phần tử so với phần không gian mà phần tử cha còn dư. Nó **không** nói
về khoảng cách giữa các phần tử cùng cấp và **không** nói một hộp giữ bao nhiêu khoảng đệm bên trong.

Nhịp giữa các phần tử cùng cấp là việc của phần tử cha. Khoảng đệm bên trong ranh giới là việc của
chủ ranh giới. Phần còn lại dành cho lề ngoài là một danh sách **đóng** gồm vài việc đặt chỗ, và mỗi
việc chỉ hợp lệ khi có một **dữ kiện bố cục** chứng minh: một ràng buộc chiều rộng, một trục còn dư
chỗ, một cột có chiều cao được cấp hoặc một lề ngoài có thật đang tồn tại.

Đừng chọn lề ngoài bằng câu “trông lệch quá”. Hãy nhìn phần tử và hỏi:

> Phần tử cha đã sở hữu khoảng cách này chưa? Nếu rồi, mình không có việc gì ở đây.

**Đây là luật bắt buộc.** Mọi phần tử hiển thị đều rơi vào đúng một mã dưới đây, và mã hay gặp nhất
là mã **không tạo class CSS nào**. Không có phần tử nào nhỏ, sâu hay tạm tới mức được miễn: một nút trong
một hàng hai món là `MARGIN-0` đúng cùng lý do mà cả khung trang là `MARGIN-0`. Câu “lệch có mấy
điểm ảnh thôi mà” là chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `MARGIN-0` | Đặt chỗ thông thường — phần tử cha đã sở hữu mọi khoảng cách đang bàn | *không khai báo lề ngoài* |
| `MARGIN-1` | Xoá — có một lề ngoài mặc định của trình duyệt hoặc của bên thứ ba cần xoá | `m-0` |
| `MARGIN-2` | Căn giữa (`mx-auto`) — một khối đã bị giới hạn chiều rộng, cần nằm giữa phần chiều ngang còn dư | `mx-auto` |
| `MARGIN-3` | Dạt cuối hàng (`ms-auto`) — một phần tử flex nhận phần chiều ngang còn dư trước nó | `ms-auto` |
| `MARGIN-4` | Xuống đáy cột (`mt-auto`) — một phần tử con flex nhận phần chiều dọc còn dư trong một cột **có chiều cao được cấp** | `mt-auto` |

`MARGIN-0` là **mã tình huống**, không phải một giá trị. Nó không tạo class CSS nào và **không phải**
`m-0`. Hai thứ này là hai lời khẳng định khác nhau: `MARGIN-0` nói *ở đây không ai đặt lề ngoài cả*,
còn `MARGIN-1` nói *có người khác đặt và tôi biết đó là ai*.

Mô-đun này **không có thang đo**, và đó là chủ ý. Lề ngoài không phải một nhịp; nhịp mới cần các bậc để
so sánh xa gần. Mỗi mã ở đây là một **việc đặt chỗ** riêng biệt: hoặc áp dụng, hoặc không. Con số
trong mã chỉ là **thứ tự đọc**, không phải một bậc: `MARGIN-2` không lớn hơn `MARGIN-1`. Nghĩa của
từng mã nằm ở **cột Tình huống** — chỗ gọi tên việc xoá lề ngoài, `mx-auto`, `ms-auto`, `mt-auto` — và
không bao giờ đọc mã mà bỏ cột đó.

---

## `MARGIN-0` — phần tử cha đã sở hữu khoảng cách rồi

**Tình huống.** Phần tử đang nằm đúng chỗ mà bố cục của phần tử cha đặt nó vào. Mọi khoảng cách quanh
nó đã được nơi khác quyết định: phần tử cha quyết khoảng cách giữa các phần tử cùng cấp, chủ ranh
giới quyết khoảng đệm bên trong. Phần tử này không có quyết định đặt chỗ nào của riêng nó.

**Dấu hiệu nhận biết**

- Yêu cầu đang nói về **khoảng cách giữa hai thứ**, không phải vị trí của một thứ.
- Yêu cầu đang nói về **khoảng đệm bên trong một cái hộp**.
- Bỏ hết lề ngoài đi thì bố cục vẫn đúng, chỉ là khoảng cách có thể cần chỉnh — mà khoảng cách đó nằm
  ở phần tử cha.
- Không nêu được ràng buộc chiều rộng, trục còn dư chỗ, nguồn chiều cao hay lề ngoài có thật nào.
- Đây là mã của **đại đa số** phần tử trên một trang.

**Tự hỏi.** Có dữ kiện bố cục nào chứng minh phần tử này phải tự dịch chuyển không? Nếu không nêu
được — `MARGIN-0`.

**Ranh giới**

- `MARGIN-1`: `MARGIN-0` là *không ai đặt lề ngoài*; `MARGIN-1` là *có lề ngoài thật, gọi được tên và
  đang phá nhịp*. Không gọi tên được lề ngoài đó thì không phải `MARGIN-1`.
- `MARGIN-2`: chỉ khi có **ràng buộc chiều rộng** đã khai báo thì mới rời khỏi `MARGIN-0`. Khối
  chiếm trọn chiều ngang thì `mx-auto` không căn giữa gì cả, và ta vẫn đang ở `MARGIN-0`.
- `MARGIN-3` / `MARGIN-4`: cần một trục **thật sự còn dư chỗ**. Muốn cả hàng dàn đều thì đó là việc
  của `justify-*` ở phần tử cha, không phải lề ngoài tự động ở phần tử con.

**Tình huống nghiệp vụ hay gặp.** Hai phần nội dung chồng lên nhau trong một trang · các thẻ trong
một lưới · nhãn đứng trên ô nhập liệu · biểu tượng cạnh chữ trong một nút · hàng trong một danh sách
có đường phân cách · ảnh đại diện cạnh tên · nút phụ cạnh nút chính · vùng nội dung chảy trong một
khung đã có khoảng đệm trong · khung chờ thay chỗ cho nội dung thật · trạng thái rỗng nằm trong đúng khung của
trạng thái có dữ liệu.

---

## `MARGIN-1` — xoá một lề ngoài có thật, gọi được tên

**Tình huống.** Có một lề ngoài **không do ta viết** đang tồn tại và đang phá nhịp mà phần tử cha đã
quyết: lề ngoài mặc định của trình duyệt trên tiêu đề, đoạn văn, danh sách, trích dẫn hoặc lề ngoài đi
kèm một thành phần của bên thứ ba. Ta không tạo khoảng cách; ta **trả quyền quyết định** về cho phần
tử cha.

**Dấu hiệu nhận biết**

- Gọi tên được chính xác lề ngoài đang bị xoá và ai đặt nó.
- Sau khi xoá, khoảng cách còn lại vẫn đúng vì phần tử cha đã có khoảng cách của mình — nghĩa là
  lề ngoài kia đang **cộng thêm** vào một khoảng cách đã đủ.
- Nếu xoá xong mà bố cục **thiếu** khoảng cách thì vấn đề không phải lề ngoài thừa, mà là phần tử cha
  chưa quyết khoảng cách. Đó là `MARGIN-0` cộng một sửa đổi ở phần tử cha.

**Tự hỏi.** Mình có chỉ được ra lề ngoài cụ thể đang tồn tại và ai là người đặt nó không?

**Ranh giới**

- `MARGIN-0`: không gọi tên được lề ngoài đang tồn tại thì không có gì để xoá.
- **`m-0` không phải cách làm hẹp một khoảng cách.** Muốn hẹp hơn thì đổi bậc khoảng cách ở phần tử
  cha. Dùng `m-0` để bóp khoảng cách là nói dối: nó khẳng định đang có một lề ngoài ngoại lai trong khi
  không có.
- **Ưu tiên lớp xoá dùng chung.** Nếu một quy tắc toàn cục có thể sở hữu lề ngoài mặc định đó thì để nó
  sở hữu. `MARGIN-1` tại chỗ dành cho trường hợp lề ngoài đến từ ngoài tầm với của quy tắc dùng chung.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề trong một thẻ đã có khoảng đệm trong · đoạn văn cuối trong một khối
văn bản · trích dẫn nhúng trong nội dung do người dùng nhập · `ul`/`ol` mặc định của trình duyệt bên
trong một danh sách đã tự thêm khoảng đệm trong · `figure` mặc định · nội dung Markdown hiển thị trong một
khung đã quyết khoảng cách · thành phần nhúng của bên thứ ba mang theo lề ngoài riêng · `fieldset` mặc
định trong một biểu mẫu đã dùng khoảng cách.

---

## `MARGIN-2` — `mx-auto`: khối đã bị giới hạn, cần nằm giữa

**Tình huống.** Một khối **đã có ràng buộc chiều rộng** nhỏ hơn không gian chiều ngang mà phần tử cha
cho phép, nên hai bên nó còn dư chỗ. `mx-auto` chia đôi phần dư đó. Không có ràng buộc chiều rộng thì
không có phần dư và class CSS này không làm gì cả.

**Dấu hiệu nhận biết**

- Trên chính phần tử có `max-w-*` hoặc một `w-*` cụ thể.
- Phần tử cha rộng hơn phần tử và phần dư nằm trên trục ngang.
- Yêu cầu nói về **một** khối tự đặt mình vào giữa, không phải về việc xếp nhiều phần tử con.

**Tự hỏi.** Chiều rộng nào đang ràng buộc khối này? Nếu không trả lời được — chưa phải mã này.

**Ranh giới**

- `MARGIN-0`: khối chiếm trọn chiều ngang thì `mx-auto` là class CSS vô hiệu. Dữ kiện còn thiếu là
  **chiều rộng**, không phải lề ngoài.
- `MARGIN-3`: `mx-auto` chia đôi phần dư về **hai** phía; `ms-auto` dồn **toàn bộ** phần dư về
  một phía. Một cái là căn giữa, một cái là đẩy về cuối.
- **Căn giữa nhiều phần tử con là việc của phần tử cha.** Nếu tất cả các phần tử con đều cần nằm giữa
  thì phần tử cha dùng `items-center` / `justify-center` / `place-items-center`; đừng rải `mx-auto`
  lên từng phần tử con.

**Tình huống nghiệp vụ hay gặp.** Cột đọc có bề rộng tối đa · khung nội dung chính của trang · thẻ
đăng nhập giữa màn hình · khối trạng thái rỗng có bề rộng giới hạn · ảnh bìa có bề rộng cố định trong
một khung rộng hơn · khối kêu gọi hành động hẹp giữa một phần nội dung rộng · hộp thoại xác nhận có
bề rộng tối đa · biểu mẫu một cột trong một trang rộng.

---

## `MARGIN-3` — `ms-auto`: một phần tử dạt về cuối hàng

**Tình huống.** Trong một hàng flex, **đúng một** phần tử con cần nhận hết phần chiều ngang còn dư
**trước nó**, để nó nằm sát mép cuối trong khi các phần tử con còn lại vẫn giữ nhịp của phần tử cha.

**Dấu hiệu nhận biết**

- Phần tử cha là hàng flex hoặc một vùng flex có trục chính nằm ngang.
- Phần tử là **con trực tiếp** của phần tử cha đó.
- Hàng còn dư chỗ: tổng bề rộng các phần tử con nhỏ hơn bề rộng phần tử cha.
- Yêu cầu nói về **một** phần tử ở mép cuối, các phần tử khác không đổi vị trí tương đối.

**Tự hỏi.** Phần tử này có phải con trực tiếp của đúng hàng flex đang sở hữu mép đó không?

**Ranh giới**

- `MARGIN-0`: chỉ có hai phần tử con và muốn chúng dạt về hai đầu — đó là `justify-between` ở phần
  tử cha, một quyết định phân bố, không phải một quyết định đặt chỗ.
- `MARGIN-2`: xem trên.
- **Chỉ một `ms-auto` trong một hàng.** Hai `ms-auto` là một luật phân bố đội lốt luật đặt chỗ, và
  kết quả nó tạo ra không đọc được từ chỗ nào cả. Muốn chia nhóm thì bọc nhóm lại.
- **Ưu tiên thuộc tính lô-gic.** Dùng `ms-auto` chứ không `ml-auto`, để vị trí vẫn đúng trong ngôn ngữ
  viết từ phải sang trái.

**Tình huống nghiệp vụ hay gặp.** Nút hành động cuối một thanh công cụ · nhãn trạng thái cuối một
hàng danh sách · giá tiền cuối một dòng đơn hàng · nút đóng cuối một phần đầu · chỉ báo “mới” cuối
một mục thông báo · dấu chọn cuối một mục đã chọn · nút xem thêm cuối một hàng tiêu đề · thời gian
cuối một dòng tin nhắn.

---

## `MARGIN-4` — `mt-auto`: một phần tử con xuống đáy cột

**Tình huống.** Trong một cột flex **có chiều cao được cấp từ bên ngoài**, đúng một phần tử con cần
nhận phần chiều dọc còn dư **trước nó**, để nó nằm sát đáy dù nội dung phía trên dài ngắn khác nhau.

**Dấu hiệu nhận biết**

- Cột nhận chiều cao từ phần tử cha: `h-full` trong một lưới có hàng cùng chiều cao, `flex-1` trong
  một cột cao hơn, `min-h-*` hoặc một cơ chế kéo giãn mặc định.
- Nội dung phía trên có **độ dài thay đổi** — đó là lý do phải ghim đáy thay vì để nó tự rơi xuống.
- Có nhiều phần tử cùng hàng và các phần tử này cần thẳng đáy.

**Tự hỏi.** Chiều cao của cột này đến từ đâu? Nếu nó đến từ chính nội dung — không có phần dư nào để
nhận và mã này sai.

**Ranh giới**

- `MARGIN-0`: cột co theo nội dung thì `mt-auto` vô hiệu. Cần sửa **bố cục**, không phải thêm
  lề ngoài. Đây là lỗi hay gặp nhất của mã này: class CSS được viết ra, không có tác dụng gì và tồn tại mãi
  như một lời giải thích sai.
- `MARGIN-3`: cùng một cơ chế, khác trục. Trục ngang dùng `ms-auto`, trục dọc dùng `mt-auto`.
- **`justify-between` khi cột chỉ có hai khối.** Nếu cột chỉ gồm một khối trên và một khối dưới, phần
  tử cha quyết bằng `justify-between` sạch hơn. Dùng `mt-auto` khi có nhiều phần tử con và chỉ
  **một** phần tử con phải xuống đáy.

**Tình huống nghiệp vụ hay gặp.** Nút hành động ở đáy các thẻ cùng chiều cao trong một lưới · giá và
nút mua ở đáy thẻ sản phẩm · nút đăng xuất ở đáy một thanh bên cao bằng màn hình · dòng thông tin
phụ ở đáy một thẻ hồ sơ · cụm nút ở đáy một bảng bên · thanh tổng tiền ở đáy một cột giỏ hàng · chú
thích nguồn ở đáy một thẻ thống kê.

---

## Luật

1. Khoảng cách giữa các phần tử cùng cấp luôn giải ở **phần tử cha**, bằng khoảng cách của phần tử cha
   — không bao giờ bằng lề ngoài trên phần tử con.
2. Khoảng đệm bên trong một ranh giới luôn giải bằng **khoảng đệm trong** của chủ ranh giới.
3. Chỉ dùng `m-0` khi biết **chính xác** lề ngoài nào đang tồn tại và ai đặt nó.
4. Lề ngoài tự động chỉ hợp lệ khi trục tương ứng **thật sự còn dư chỗ**.
5. `mx-auto` cần một ràng buộc chiều rộng; `mt-auto` cần một cột có chiều cao được cấp từ ngoài.
6. Một hàng chỉ có **một** `ms-auto`; một cột chỉ có **một** `mt-auto`.
7. Không dùng lề ngoài đo bằng số (`mt-4`, `mb-6`, `ml-2`, …) cho bất kỳ mã nào trong mô-đun này.
8. Không dùng lề ngoài âm để chỉnh bằng mắt hoặc để xuyên qua ranh giới của phần tử cha.
9. Ưu tiên thuộc tính lô-gic (`ms-`, `me-`) hơn thuộc tính vật lý (`ml-`, `mr-`).
10. Thiếu dữ kiện bố cục thì **không viết lề ngoài nào** và chỉ hỏi **một** câu khi bên yêu cầu nói rõ
    họ cần đặt chỗ bằng lề ngoài tự động.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Chỉ xoá lề ngoài gọi được tên.** `m-0` hợp lệ với một lề ngoài mặc định có thật — tiêu đề, đoạn văn,
  danh sách, trích dẫn, thành phần bên thứ ba. Nó không hợp lệ như một cách bóp khoảng cách mà phần tử
  cha đã chọn.
- **Lớp xoá dùng chung trước.** Nếu một quy tắc toàn cục có thể sở hữu lề ngoài mặc định đó thì để nó
  sở hữu. `MARGIN-1` tại chỗ dành cho lề ngoài đến từ ngoài tầm với của quy tắc dùng chung.
- **Ràng buộc trước, căn giữa sau.** `mx-auto` trên một khối không giới hạn chiều rộng không phải là
  căn giữa — nó là một class CSS không có tác dụng. Dữ kiện còn thiếu là chiều rộng.
- **Tràn toàn chiều rộng là cấu trúc bố cục, không phải lề ngoài.** Muốn tràn ra khỏi khoảng đệm của một
  vùng chứa thì dựng một cấu trúc **không có khoảng đệm để mà tràn**. Lề ngoài âm bị từ chối vì nó lặng
  lẽ vượt qua một ranh giới mà phần tử cha tưởng mình đang sở hữu.
- **Phần tử chồng lớp là bài toán vị trí, không phải lề ngoài.** Thứ phải nằm đè lên luồng là bài toán
  định vị; đẩy nó bằng lề ngoài làm chủ sở hữu thật của vị trí đó không còn tìm ra được.
- **Đồng nhất giữa các trạng thái.** Vị trí không đổi giữa trạng thái đang tải, rỗng, lỗi và có dữ
  liệu. Khung chờ trong một thẻ có chiều cao được cấp vẫn giữ `mt-auto` ở phần tử thay chỗ cho nút,
  nếu không bố cục sẽ nhảy đúng lúc dữ liệu về.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi **vai trò bố cục** thật sự đổi — ví dụ một cột có chiều cao
  được cấp ở màn rộng nhưng co theo nội dung ở màn hẹp, lúc đó `MARGIN-4` chỉ đúng ở màn rộng. Màn
  hẹp đi mà bố cục không đổi thì mã không đổi.
- **Thiếu dữ kiện.** Không nêu được phần tử cha, trục còn dư chỗ, ràng buộc chiều rộng hay nguồn
  chiều cao thì tạo `MARGIN-0`. Hỏi **một** câu và chỉ khi bên yêu cầu nói rõ họ cần lề ngoài tự động.
