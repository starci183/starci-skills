---
id: fe-principles-grid-vi
title: vi.md
slug: /fe/principles/grid/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống GRID-N, nhận diện bằng nghiệp vụ chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `grid`

# Lưới

Lưới là **hệ cột** mà một trang cam kết một lần rồi giữ ở mọi nơi: nội dung rơi đúng vào những mép
dọc dùng chung, để người đọc **đoán được** thứ tiếp theo bắt đầu ở đâu trước cả khi nó tải xong.

Số cột không phải sở thích của từng phần nội dung. Nó là thuộc tính của **trường nhập liệu** — vùng mà cả trang đã
thoả thuận. Hãy nhìn một khối sắp dựng và hỏi:

> Mình đang đặt tên cho **trường nhập liệu**, cho **vùng chứa tạo cột**, hay cho **một đứa con nằm trong cột**?

Ba câu hỏi đó là ba trục. Trả lời trục trước, mã tự lộ ra.

**Đây là luật bắt buộc.** Mọi vùng bày các phần tử ngang hàng lặp lại đều rơi vào đúng một mã dưới đây;
mọi con của một vùng chứa tạo cột cũng vậy; và cái vỏ trang bọc chúng cũng vậy. Không có kích thước
nào nhỏ đến mức được miễn: hai ô số liệu đứng cạnh nhau là `GRID-1` đúng cùng một lý do mà cả trang
danh mục là `GRID-1`. Câu "có mỗi hai cái hộp thôi mà" là chỗ luật này bị bỏ qua nhiều nhất — và bỏ
qua đủ nhiều lần thì một cơ sở mã có mười mấy con số cột không liên quan gì đến nhau, và **không có
trường nhập liệu nào cả**.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `GRID-0` | Các phần tử lặp lại chỉ đọc theo một chiều; không đòi hỏi mép dọc chung | *không khai báo lưới* |
| `GRID-1` | Vùng chứa chốt **có bao nhiêu cột**, theo từng điểm ngắt | `grid grid-cols-2 lg:grid-cols-3` |
| `GRID-2` | Vùng chứa để số cột **suy ra** từ bề rộng tối thiểu của phần tử | `grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]` |
| `GRID-3` | Vùng chứa gán **vai trò cố định** cho từng rãnh | `grid grid-cols-[16rem_minmax(0,1fr)]` |
| `GRID-4` | Trường nhập liệu: lề ngoài và độ dài dòng mà các cột sống bên trong | `mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8` |
| `GRID-5` | Một con chiếm **đúng một cột** | *không khai báo cách đặt* |
| `GRID-6` | Một con **trải qua nhiều cột**, hoặc toàn bộ | `col-span-2 lg:col-span-3` |
| `GRID-7` | Một con **cố ý phá ra ngoài** lề của trường nhập liệu | `col-span-full -mx-4 sm:-mx-6 lg:-mx-8` |

Mã `GRID-0`…`GRID-4` nói về **vùng chứa hoặc trường nhập liệu**. Mã `GRID-5`…`GRID-7` nói về **một đứa con**.
Đọc trục trước, rồi mới đọc mã.

**Thang cột của trường nhập liệu.**

| Điểm ngắt | Số cột của trường nhập liệu | Số cột vùng chứa được phép khai |
|---|---|---|
| cơ sở | 4 | 1, 2, 4 |
| `sm` / `md` | 8 | 1, 2, 4, 8 |
| `lg` trở lên | 12 | 1, 2, 3, 4, 6, 12 |

Thang 4 / 8 / 12 lấy theo Chất liệu bố cục lưới, không lấy 4 / 8 / 16 của Carbon 2x lưới, vì một lý do
kiểm được chứ không phải vì đẹp: 12 chia hết cho 2, 3, 4 và 6, nên một hàng ba-phần tử rơi đúng mép
trường nhập liệu; 16 **không** chia hết cho 3, nên mọi hàng ba-phần tử bên trong nó hoặc lẻ rãnh hoặc lệch trường nhập liệu.

---

## `GRID-0` — không có hệ cột, chảy là đủ

**Tình huống.** Các phần tử lặp lại nhưng chỉ được đọc theo **một** chiều. Không ai cần phần tử ở hàng dưới
thẳng mép với phần tử ở hàng trên, vì "hàng" không phải là một khái niệm của khối này.

**Dấu hiệu nhận biết**

- Danh sách xếp chồng, luồng tin, dòng thời gian, trình đơn điều hướng.
- Một hàng nhãn nhỏ/thẻ tự xuống dòng khi hết chỗ: có xuống hàng nhưng **không có cột**, vì phần tử rộng
  theo nội dung.
- Thêm hoặc bớt một phần tử không làm hỏng bố cục của các phần tử còn lại.
- Chiều rộng phần tử là hệ quả của nội dung hoặc của cha, không phải một quyết định.

**Tự hỏi.** Phần tử ở hàng sau có **bắt buộc** phải thẳng mép dọc với phần tử ở hàng trước không? Nếu
không — `GRID-0`.

**Ranh giới**

- `GRID-1`: `flex flex-wrap` sinh ra nhiều hàng nhưng **không** sinh ra cột. Ba thẻ có bề rộng khác
  nhau tự xuống dòng là `GRID-0`; ba thẻ buộc phải bằng nhau và thẳng mép là `GRID-1`.
- `GRID-2`: `GRID-2` cũng để số cột tự suy ra, nhưng nó **có** cột: mọi phần tử chia nhau một rãnh
  đều nhau và hàng dưới thẳng mép hàng trên.
- `GRID-4`: một danh sách vẫn nằm trong trường nhập liệu. `GRID-0` nói về nội bộ danh sách, không nói về lề ngoài.

**Không viết `grid grid-cols-1`.** Một cột không phải là một hệ cột — đó là dòng chảy. Khai
`grid-cols-1` là tuyên bố trường nhập liệu có một cột, trong khi thật ra nó **không có cột nào**.

**Tình huống nghiệp vụ hay gặp.** Luồng tin hoạt động · danh sách hoá đơn có đường phân cách · dòng thời gian nộp bài ·
trình đơn điều hướng dọc · hàng nhãn nhỏ lọc tự xuống dòng · đường dẫn phân cấp · danh sách bình luận · các bước của
một quy trình · danh sách tệp đính kèm.

---

## `GRID-1` — chốt số cột

**Tình huống.** Thiết kế **hứa** một con số: hai-lên ở thiết bị di động, ba-lên ở máy tính. Số phần tử đã biết
trước hoặc đã được cắt cho vừa con số đó, và người đọc được phép trông cậy vào nhịp ấy.

**Dấu hiệu nhận biết**

- Số cột được nói ra thành lời trong yêu cầu: "ba thẻ một hàng".
- Phần tử đổi chỗ cho nhau được — chúng cùng loại, cùng vai trò.
- Bề rộng phần tử là **hệ quả** của số cột, không phải nguyên nhân.
- Thêm một phần tử thứ tư sẽ **xuống hàng**, và điều đó chấp nhận được.

**Tự hỏi.** Số cột là **lời hứa của thiết kế**, hay là **hệ quả** của việc phần tử không được hẹp hơn
một ngưỡng? Lời hứa — `GRID-1`.

**Ranh giới**

- `GRID-0`: xem trên. Không có yêu cầu thẳng mép thì không có cột.
- `GRID-2`: nếu không ai nói được con số, chỉ nói được "đừng để thẻ hẹp hơn 16rem", thì con số là
  thứ **suy ra** — `GRID-2`. Chốt bừa một số ở đây là đoán.
- `GRID-3`: nếu các con **không** đổi chỗ cho nhau được — rãnh đầu luôn là bộ lọc, rãnh sau luôn
  là kết quả — thì đó là vai trò cố định, `GRID-3`.

**Số cột phải chia hết trường nhập liệu.** `grid-cols-5` và `lg:grid-cols-7` không nằm trong thang; chúng làm
mọi phần tử lệch khỏi mép trường nhập liệu và biến trường nhập liệu thành trang trí.

**Tình huống nghiệp vụ hay gặp.** Bộ ba ô số liệu · lưới gói giá · hàng thẻ tính năng · lưới ảnh
vuông · thẻ thành viên nhóm · hai cột biểu mẫu (họ / tên) · lưới huy hiệu · bộ thẻ lộ trình học.

---

## `GRID-2` — số cột suy ra từ bề rộng tối thiểu

**Tình huống.** Số phần tử đến từ **dữ liệu**, và thứ duy nhất thiết kế nói được là: một phần tử hẹp hơn
ngưỡng nào đó thì không đọc được nữa. Số cột là thứ rơi ra sau, không phải thứ chọn trước.

**Dấu hiệu nhận biết**

- Số phần tử thay đổi theo tài khoản, theo bộ lọc, theo trang.
- Yêu cầu nói bằng **bề rộng**, không nói bằng **số lượng**.
- Cùng một khối được nhúng ở nhiều chỗ rộng hẹp khác nhau mà không được sửa lại số cột.
- Hàng cuối thiếu phần tử vẫn phải nhìn ổn.

**Tự hỏi.** Nếu ngày mai dữ liệu trả về mười bảy phần tử thay vì sáu, có ai phải sửa class CSS không? Nếu
không — `GRID-2`.

**Ranh giới**

- `GRID-1`: xem trên. Đây là ranh giới hay bị chọn sai nhất, vì `grid-cols-3` **trông** đúng ở màn
  hình của người viết ra nó.
- `GRID-0`: `GRID-2` vẫn phải thẳng mép dọc; `flex flex-wrap` thì không.
- `GRID-3`: `GRID-2` có các rãnh **giống hệt nhau**; `GRID-3` có các rãnh **khác vai trò**.

**`auto-fill` hay `auto-fit`.** `auto-fill` giữ nguyên số rãnh kể cả khi thiếu phần tử — hàng cuối
không giãn ra. `auto-fit` co các rãnh rỗng lại, nên một phần tử duy nhất sẽ **phình hết bề rộng**. Chọn
`auto-fill` khi lưới phải giữ nhịp lúc dữ liệu ít, chọn `auto-fit` khi một phần tử duy nhất được phép
chiếm cả hàng.

**Tình huống nghiệp vụ hay gặp.** Kết quả tìm kiếm · danh mục khoá học · thư viện ảnh · danh sách
thành viên · lưới template · kết quả lọc · thẻ thông báo · thanh dọc cuộn ngang.

---

## `GRID-3` — rãnh có vai trò cố định

**Tình huống.** Các rãnh **không đổi chỗ cho nhau được**. Một bên là thanh dọc, một bên là nội dung; một
bên là vùng vẽ, một bên là bảng kiểm tra. Bề rộng của rãnh là một quyết định bố cục, không phải một phép
chia.

**Dấu hiệu nhận biết**

- Ít nhất một rãnh có bề rộng cố định hoặc bị chặn trên/dưới (`16rem`, `minmax(0,1fr)`).
- Thêm một con thứ ba vào vùng chứa này là **sai**, không phải là "xuống hàng".
- Mỗi bên có thể ghim, cuộn riêng, hoặc biến mất ở màn hình hẹp.
- Đổi thứ tự hai con thì trang đọc **sai nghĩa**, không chỉ xấu.

**Tự hỏi.** Nếu đổi chỗ hai con cho nhau, trang có còn đúng nghĩa không? Nếu không — `GRID-3`.

**Ranh giới**

- `GRID-1`: `GRID-1` có các con thay thế được cho nhau; `GRID-3` thì không.
- `GRID-2`: `GRID-2` có rãnh đồng dạng sinh ra hàng loạt; `GRID-3` có rãnh được đặt tên từng cái.
- `GRID-0`: thanh dọc xếp chồng xuống dưới ở thiết bị di động **vẫn** là `GRID-3`. Thiết kế đáp ứng không đổi mã.

**`minmax(0,1fr)` chứ không phải `1fr`.** Rãnh `1fr` có min-chiều rộng mặc định là `auto`, nên một nội
dung không xuống dòng được — bảng rộng, khối mã — sẽ **đẩy rãnh phình ra** và ăn mất thanh dọc. Đây là
lỗi runtime, không phải lỗi thẩm mỹ.

**Tình huống nghiệp vụ hay gặp.** Thanh dọc bộ lọc + vùng kết quả · điều hướng + nội dung · vùng vẽ +
bảng kiểm tra · hộp thư + khung hội thoại · mục lục + bài đọc · danh mục + khung giỏ hàng · cây thư mục +
trình soạn thảo · biểu mẫu + khung tóm tắt đơn hàng.

---

## `GRID-4` — trường nhập liệu: lề ngoài và độ dài dòng

**Tình huống.** Một phần tử quyết định **nội dung được phép tồn tại ở đâu**: nó căn giữa, chặn bề
rộng tối đa, và đặt lề ngoài. Nó **không** nói gì về số cột.

**Dấu hiệu nhận biết**

- `mx-auto` cộng một `max-w-*`.
- Khoảng đệm trong ngang đổi theo điểm ngắt — đó chính là lề ngoài.
- Mọi phần nội dung của trang đều nằm trong nó và **không** tự khai lại `max-w`.
- Bỏ nó đi thì chữ chạy dài hết màn hình 27 inch.

**Tự hỏi.** Phần tử này đang quyết định **nội dung kết thúc ở đâu**, hay **có bao nhiêu cột**? Kết
thúc ở đâu — `GRID-4`.

**Ranh giới**

- `GRID-1`, `GRID-2`, `GRID-3`: trường nhập liệu **không** khai rãnh. Một nút DOM vừa `max-w-6xl mx-auto px-4`
  vừa `grid grid-cols-3` đang gánh hai quyết định; phải tách làm hai nút DOM.
- `GRID-7`: tràn lề là một lần thoát ra rồi quay lại. Một trường nhập liệu rộng hơn thì vẫn là trường nhập liệu.

**Lề ngoài không nhỏ hơn rãnh cột.** Nếu `gap-6` mà lề chỉ `px-4`, cột ngoài cùng dính vào mép màn hình
chặt hơn các cột dính vào nhau — người đọc sẽ thấy lưới bị lệch mà không nói được vì sao.

**Rãnh cột không được chọn ở đây.** Giá trị của rãnh cột thuộc về mô-đun khoảng cách giữa các phần tử kề bên. Điều mô-đun này sở
hữu là: **một trường nhập liệu, một rãnh cột cho mỗi điểm ngắt**, và rãnh cột là khoảng cách ngang **duy nhất**
giữa các cột.

**Tình huống nghiệp vụ hay gặp.** Vỏ trang · khung của bố cục đã đăng nhập · vùng chứa của một
phần nội dung trên landing · vùng đọc của bài viết dài (`max-w-prose`) · vùng nội dung của hộp thoại · vùng
nội dung in ấn.

---

## `GRID-5` — một con, đúng một cột

**Tình huống.** Một đứa con **nhận** đúng cái rãnh mà vùng chứa đưa cho nó. Nó không thương lượng
gì cả. Đây là tình huống phổ biến nhất trong toàn mô-đun, và cũng là tình huống hay bị viết thừa
class CSS nhất.

**Dấu hiệu nhận biết**

- Không có class CSS cách đặt nào trên con.
- Bề rộng của nó do vùng chứa quyết, không do nó quyết.
- Đưa nó sang một vùng chứa khác thì nó tự vừa, không cần sửa.

**Tự hỏi.** Con này có **đòi** gì từ lưới không? Nếu không — `GRID-5`, và không viết gì cả.

**Ranh giới**

- `GRID-6`: `GRID-6` đòi nhiều hơn một cột. Đòi thì phải nói ra bằng `col-span-*`.
- `GRID-7`: `GRID-7` đi ra khỏi lề của trường nhập liệu. `GRID-5` không bao giờ ra khỏi rãnh của nó.

**Không viết `col-span-1`.** Không đòi hỏi là **trạng thái vắng mặt** của một yêu cầu, không phải một
yêu cầu bằng một. Mã `GRID-5` là mã tình huống, không phải tên class CSS.

**`min-w-0` không phải class CSS cách đặt.** Nó chặn nội dung không co được (bảng, khối mã, chuỗi
dài) làm phình rãnh. Một `GRID-5` có `min-w-0` vẫn là `GRID-5`.

**Tình huống nghiệp vụ hay gặp.** Một thẻ khoá học trong lưới danh mục · một ô số liệu · một ảnh
trong thư viện · một trường nhập liệu trong biểu mẫu hai cột · một thẻ thành viên · một bảng nằm trọn trong một cột.

---

## `GRID-6` — một con trải nhiều cột

**Tình huống.** Một đứa con **quan trọng hơn** hoặc **rộng hơn** phần còn lại, và nó nói điều đó
bằng số cột nó chiếm — chứ không bằng bề rộng riêng.

**Dấu hiệu nhận biết**

- Phần tử đầu tiên của lưới là phần tử nổi bật, các phần tử sau bình thường.
- Một biểu đồ cần bề ngang mới đọc được, trong khi các ô cạnh nó thì không.
- Một hàng tiêu đề hoặc một trạng thái rỗng phải nằm hết bề ngang của lưới.
- Số cột chiếm được đổi theo điểm ngắt, nhưng vai trò thì không.

**Tự hỏi.** Con này có đòi **nhiều hơn một cột** của chính lưới đang chứa nó không?

**Ranh giới**

- `GRID-5`: xem trên.
- `GRID-7`: `col-span-full` vẫn nằm **trong** lề của trường nhập liệu. Chỉ khi nó tiếp tục đi ra ngoài lề thì
  mới là `GRID-7`.
- `GRID-3`: nếu **mọi** con đều có độ trải cột riêng và cố định, thứ bạn đang dựng là rãnh có vai trò —
  hãy khai `GRID-3` ở vùng chứa thay vì rải độ trải cột lên từng con.

**Không giả độ trải cột bằng bề rộng.** `w-2/3` hay `basis-2/3` trên một con của lưới không cho nó hai cột;
nó cho hai phần ba của **một** cột, và mọi thứ dưới nó lệch mép.

**Tình huống nghiệp vụ hay gặp.** Thẻ nổi bật đầu lưới · biểu đồ rộng trong bảng điều khiển · trạng thái
rỗng chiếm cả lưới · biểu ngữ thông báo trong lưới thẻ · ô ghi chú dài trong biểu mẫu nhiều cột · hàng
tổng kết cuối lưới số liệu.

---

## `GRID-7` — cố ý phá ra ngoài trường nhập liệu

**Tình huống.** Một khối **phải** chạm mép — hoặc chạm mép của trường nhập liệu, hoặc chạm mép khung nhìn — trong
khi mọi thứ trước và sau nó vẫn tôn trọng lề. Đây là ngoại lệ được **khai báo**, không phải một lần
lách.

**Dấu hiệu nhận biết**

- Nền có màu hoặc có ảnh, và phần nền hở ra hai bên trông như lỗi.
- Một thanh dọc cuộn ngang phải "chảy" ra khỏi mép để người đọc biết còn nữa ở bên phải.
- Trước và sau khối đó, nội dung quay lại đúng lề cũ.

**Tự hỏi.** Khối này có **buộc** phải chạm mép để nói đúng ý nó không, hay chỉ là muốn rộng hơn một
chút? Muốn rộng hơn một chút thì đó là `GRID-4` sai số, không phải `GRID-7`.

**Ranh giới**

- `GRID-6`: `col-span-full` là trải hết **cột**; `GRID-7` là ra khỏi **lề**.
- `GRID-4`: nếu cả trang cần rộng hơn thì sửa trường nhập liệu, đừng cho từng khối tự phá ra.

**Tràn lề do trường nhập liệu cho phép, không do con tự lấy.** Một `-mx-*` chỉ đúng khi nó **triệt tiêu đúng**
khoảng đệm trong của trường nhập liệu ở cùng điểm ngắt. Con nằm sâu ba tầng mà tự `-mx-8` là đang đoán khoảng đệm trong của tổ
tiên nó.

**Tràn lề hết khung nhìn có giá phải trả.** `w-screen` bằng `100vw`, và `100vw` **tính cả thanh cuộn**,
nên trên trình duyệt có scrollbar chiếm chỗ nó sẽ tạo tràn ngang. Muốn dùng thì tổ tiên phải
`overflow-x-clip`, và đó là một quyết định của trang chứ không phải của khối.

**Tình huống nghiệp vụ hay gặp.** Vùng nổi bật có ảnh nền · dải chứng thực nền màu · thanh dọc cuộn ngang trên
thiết bị di động · bảng rộng cần cuộn ngang · dải phân cách toàn chiều rộng · bản đồ nhúng · băng thông báo
trên cùng trang.

---

## Luật

1. Trường nhập liệu sở hữu độ dài dòng và lề ngoài; vùng chứa sở hữu rãnh. **Một nút DOM không giữ cả hai.**
2. Số cột khai báo phải chia hết số cột của trường nhập liệu ở điểm ngắt đó.
3. Rãnh cột là khoảng cách ngang **duy nhất** giữa các cột; cột không tự thêm lề ngoài ngang.
4. Giá trị rãnh cột thuộc mô-đun khoảng cách giữa các phần tử; mô-đun này chỉ giữ luật **một trường nhập liệu một rãnh cột mỗi điểm ngắt**.
5. Lề ngoài không bao giờ nhỏ hơn rãnh cột.
6. Mỗi con của vùng chứa tạo cột rơi vào đúng một trong `GRID-5`, `GRID-6`, `GRID-7`.
7. Con không dùng `width` hay `basis` để giả một độ trải cột.
8. Đổi số cột theo điểm ngắt **không** đổi mã.
9. Khi hai mã kề nhau cùng hợp lý, chọn mã **đòi ít hơn**: `GRID-0` trước `GRID-1`, `GRID-5` trước
   `GRID-6`, `GRID-6` trước `GRID-7`.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Bảng.** `<table>` chạy thuật toán cột riêng của nó. Với mô-đun này, một bảng là **một** đứa con —
  `GRID-5` hoặc `GRID-6` — và cột bên trong bảng nằm ngoài phạm vi.
- **Độ dài dòng đọc.** Văn bản dài bị chặn bởi độ dài dòng đọc được, không bởi số cột trường nhập liệu. Một độ dài dòng
  hẹp hơn lồng trong trường nhập liệu là một `GRID-4` thứ hai, và đó là **trường nhập liệu lồng duy nhất** được phép.
- **Đúng một phần tử, mãi mãi.** Vùng chứa chỉ hiển thị một thứ và sẽ luôn như vậy là `GRID-0`, không phải
  `GRID-1` với số cột bằng một.
- **Số phần tử không biết trước.** Khi số lượng đến từ dữ liệu và thiết kế chỉ nói được bề rộng tối
  thiểu, tình huống là `GRID-2`; chốt một con số ở đó là đoán.
- **Thanh dọc cuộn ngang.** Là `GRID-2` theo trục cuộn của nó; nếu đồng thời tràn ra ngoài lề trường nhập liệu thì nó
  **cũng** mang `GRID-7` với tư cách một đứa con. Hai mã, hai phần tử — không bao giờ hai mã trên
  cùng một phần tử.
- **Tính đồng nhất trạng thái.** Khung chờ, trạng thái rỗng và nội dung thật dùng chung một mã. Lưới rỗng đổi
  số cột là nói dối về hệ cột, và người dùng thấy bố cục nhảy đúng lúc dữ liệu về.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi vai trò bố cục **thật sự** đổi, không phải khi màn hình hẹp đi. Thanh dọc
  xếp chồng ở thiết bị di động vẫn là `GRID-3`.
- **In ấn và thư điện tử.** Trường nhập liệu vẫn tồn tại, chỉ là độ dài dòng khác. Bỏ hẳn trường nhập liệu trong bản in là bỏ luật,
  không phải thích nghi với môi trường.
