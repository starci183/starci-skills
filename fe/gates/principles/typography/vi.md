---
id: fe-principles-typography-vi
title: vi.md
slug: /gates/principles/typography/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống TYPOGRAPHY-N, nhận diện bằng quyền sở hữu nội dung chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `typography`

# Kiểu chữ

Kiểu chữ là **cỡ chữ, độ đậm và tông màu** của một dòng chữ, chọn theo **thứ dòng chữ đó sở hữu**.

Không chọn bằng cảm giác "cho nó nổi hơn" hay "chỗ này trống quá". Hãy nhìn một dòng chữ và hỏi:

> Dòng này đang sở hữu cái gì?

Chỉ có **hai dữ kiện** quyết định:

1. **Cấp độ dàn ý** — dòng này có phải một bậc trong dàn ý tài liệu không, và bậc mấy?
2. **Quyền sở hữu nội dung** — dòng này **gọi tên** một đối tượng, **phát biểu** một dữ kiện, **bổ nghĩa**
   cho một dòng khác, **chia** một luồng kết quả, hay là chữ mà một thành phần điều khiển đã tự sở hữu?

Con số, độ dài nhãn, rê chuột, khoảng trống còn lại, điểm ngắt và ảnh chụp màn hình **không** quyết
định gì cả.

**Đây là luật bắt buộc.** Mọi dòng chữ hiển thị ra đều rơi vào đúng một mã dưới đây. Không có dòng nào
ngắn đến mức được miễn: một chú thích mười hai ký tự dưới một con số là `TYPOGRAPHY-9`, đúng cùng một
lý do mà tên tuyến trang ở đầu trang là `TYPOGRAPHY-1`. Câu "có mỗi một chữ thôi mà" là chỗ luật này bị bỏ
qua nhiều nhất — vì một chữ chính là chỗ người ta với tay lấy cỡ chữ nào trông vừa mắt.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Phần tử | `className` |
|---|---|---|---|
| `TYPOGRAPHY-1` | Tên gốc của trang / tuyến trang | `h1` | `text-xl font-semibold tracking-tight` |
| `TYPOGRAPHY-2` | Bậc dàn ý đầu tiên dưới trang | `h2` | `text-base font-semibold` |
| `TYPOGRAPHY-3` | Phần con cục bộ bên trong một phần nội dung | `h3` | `text-sm font-medium` |
| `TYPOGRAPHY-4` | Bậc dàn ý cuối cùng được thừa nhận | `h4` | `text-xs font-medium text-muted-foreground` |
| `TYPOGRAPHY-5` | Một tiêu đề ngắn của đối tượng trội duy nhất trong vùng | `div` | `text-base font-medium text-foreground` |
| `TYPOGRAPHY-6` | Tiêu đề của phần tử ngang hàng lặp lại, gọn, dài hoặc dễ dài sau dịch | `div` | `text-sm font-medium text-foreground` |
| `TYPOGRAPHY-7` | Chữ giao diện thường: mô tả, siêu dữ liệu, một giá trị | `p` | `text-sm leading-5 font-normal text-foreground` |
| `TYPOGRAPHY-8` | Văn bản để đọc liên tục | `p` | `text-base leading-6 font-normal text-foreground` |
| `TYPOGRAPHY-9` | Chữ chỉ bổ nghĩa cho một dòng chính hoặc một bề mặt | `p` | `text-xs leading-4 font-normal text-muted-foreground` |
| `TYPOGRAPHY-10` | Dấu chia luồng kết quả mà không tạo phần nội dung | `div` | `text-sm leading-5 font-normal text-muted-foreground` |
| `TYPOGRAPHY-11` | Chữ mà một thành phần điều khiển đã tự sở hữu | *phần tử của chính thành phần điều khiển* | *không khai báo class CSS chữ* |
| `TYPOGRAPHY-12` | Không có cấp độ dàn ý và không nêu chủ sở hữu | `p` | `text-base font-normal text-foreground` |

---

## `TYPOGRAPHY-1` — tên gốc của trang

**Tình huống.** Dòng này trả lời câu "tôi đang ở đâu?". Nó là gốc của dàn ý tài liệu và mỗi tuyến trang chỉ
có **một** dòng như vậy.

**Dấu hiệu nhận biết**

- Nếu xoá dòng này, người dùng không còn biết trang đang nói về cái gì.
- Nó thường trùng hoặc gần trùng với đường dẫn phân cấp cuối, với thẻ tab tiêu đề, với tên tuyến trang.
- Mọi thứ khác trên trang đều nằm **dưới** nó về mặt dàn ý, kể cả những thứ trông to hơn.
- Trên một tuyến trang chi tiết, tên của chính đối tượng đó **là** tên trang.

**Tự hỏi.** Dòng này có phải là gốc dàn ý của tuyến trang hiện tại không?

**Ranh giới**

- `TYPOGRAPHY-2`: `h2` gọi tên một **phần** của trang; `h1` gọi tên **cả** trang. Nếu còn một dòng
  nào khác bao trùm nó thì nó không phải `TYPOGRAPHY-1`.
- `TYPOGRAPHY-5`: tiêu đề đối tượng **không vào** dàn ý. Cùng một chuỗi "System Design Mastery" là
  `TYPOGRAPHY-1` trên tuyến trang chi tiết của chính khoá đó, nhưng là `TYPOGRAPHY-6` khi nằm trong danh
  sách ở tuyến trang chỉ mục. **Tuyến trang quyết định, không phải chuỗi.**

**Tình huống nghiệp vụ hay gặp.** Tên trang bảng điều khiển · tên trang báo cáo · tên khoá học trên
tuyến trang chi tiết khoá học · tên hồ sơ trên tuyến trang hồ sơ công khai · tên đơn hàng trên tuyến trang đơn hàng ·
tên bài viết trên tuyến trang bài viết · tiêu đề trang cài đặt.

---

## `TYPOGRAPHY-2` — bậc dàn ý đầu tiên dưới trang

**Tình huống.** Một phần của trang có mục đích riêng, có nội dung riêng, và **phải xuất hiện trong
dàn ý** để người dùng trình đọc màn hình nhảy tới được.

**Dấu hiệu nhận biết**

- Người ta gọi nó bằng tên khi nói chuyện: "phần đánh giá", "phần hoạt động gần đây".
- Nó có thể rỗng riêng, lỗi riêng, tải riêng.
- Nó là con trực tiếp của trang về mặt dàn ý, không phải con của một phần nội dung khác.

**Tự hỏi.** Phần này có phải một mục cấp một của trang mà người dùng cần nhảy thẳng tới không?

**Ranh giới**

- `TYPOGRAPHY-1`: xem trên.
- `TYPOGRAPHY-3`: `h3` nằm **bên trong** một `h2`. Nếu không có `h2` nào bao nó thì nó chưa phải
  `h3`.
- `TYPOGRAPHY-5`: cùng công thức `text-base` nhưng khác **độ đậm chữ** và khác **phần tử**. `h2` là
  `font-semibold` và vào dàn ý; tiêu đề đối tượng là `font-medium` và không vào dàn ý. Đây là cặp bị
  nhầm nhiều nhất ở nửa trên của thang.

**Tình huống nghiệp vụ hay gặp.** Tổng quan · Hoạt động gần đây · Nội dung khoá học · Đánh giá học
viên · Thanh toán · Bảo mật · Thành viên nhóm · Tệp đính kèm · Câu hỏi thường gặp.

---

## `TYPOGRAPHY-3` — phần con cục bộ

**Tình huống.** Một nhóm nhỏ **bên trong** một phần nội dung, đủ độc lập để cần một cái tên, nhưng không đủ
lớn để là một mục cấp một của trang.

**Dấu hiệu nhận biết**

- Luôn có một `h2` ở trên nó trong cùng cây.
- Nó gom vài dòng lại thành một chủ đề nhỏ.
- Bỏ nó đi thì phần nội dung vẫn còn nội dung, chỉ mất một cái tên nhóm.

**Tự hỏi.** Nhóm này có nằm trong một phần nội dung đã được đặt tên, và tự nó có cần một cái tên không?

**Ranh giới**

- `TYPOGRAPHY-2`: đếm bậc, đừng đếm kích thước vùng. Một `h3` trong một phần nội dung nhỏ vẫn là `h3`.
- `TYPOGRAPHY-6`: cùng `text-sm` nhưng khác độ đậm và khác phần tử. `h3` là `font-medium` **và**
  vào dàn ý; tiêu đề ngang hàng là `font-medium` **và không** vào dàn ý. Nếu cái tên đó là tên của một
  **đối tượng dữ liệu** (một khoá học, một tệp, một người) thì nó là `TYPOGRAPHY-6`, không phải `h3`.

**Tình huống nghiệp vụ hay gặp.** Thông tin cá nhân / Thông tin liên hệ trong trang hồ sơ · Cấp độ /
Chủ đề / Thời lượng trong một thanh bộ lọc · Địa chỉ giao hàng / Địa chỉ thanh toán trong một phần nội dung
thanh toán · Điều kiện tiên quyết trong một phần nội dung giới thiệu.

---

## `TYPOGRAPHY-4` — bậc dàn ý cuối cùng

**Tình huống.** Bậc dàn ý thứ tư, và là bậc cuối. Ở độ sâu này cái tên đã gần như một cái nhãn: nó
vẫn phải có mặt trong dàn ý, nhưng nó không được giành lấy sự chú ý của mắt nữa.

**Dấu hiệu nhận biết**

- Có đủ một chuỗi `h1 → h2 → h3` ở trên nó.
- Nó đặt tên cho một tiêu chí, một mục con của mục con.
- Người dùng bàn phím vẫn cần nhảy tới nó.

**Tự hỏi.** Dòng này có thật sự cần nằm trong dàn ý không, hay nó chỉ là chữ bổ nghĩa?

**Ranh giới**

- `TYPOGRAPHY-9`: **đây là ranh giới nguy hiểm nhất trong mô-đun.** Cả hai đều `text-xs` và đều
  giảm nhấn. Khác nhau ở hai chỗ, và cả hai đều bắt buộc: `TYPOGRAPHY-4` là `font-medium` và là một
  `h4` **thật** trong dàn ý; `TYPOGRAPHY-9` là `font-normal` và **không** phải phần tử tiêu đề.
  Nếu dòng đó không cần xuất hiện trong danh sách tiêu đề của trang thì nó không phải `h4`.
- bậc thứ năm: **không tồn tại**. Cần độ sâu 5 nghĩa là cấu trúc nội dung phải phẳng lại. Đây là
  yêu cầu duy nhất mà mô-đun trả lời bằng một câu hỏi thay vì một class CSS.

**Tình huống nghiệp vụ hay gặp.** Tên tiêu chí chấm điểm dưới một nhóm tiêu chí · tên bước nhỏ trong
một quy trình đã có ba bậc · tên trường trong một nhóm trường lồng sâu · tên mục con của một điều
khoản.

---

## `TYPOGRAPHY-5` — đối tượng trội duy nhất

**Tình huống.** Một vùng lớn tồn tại để nói về **một** đối tượng, và đối tượng đó có một cái tên **ngắn**.
Cái tên ấy dẫn dắt cả vùng nhưng **không** vào dàn ý tài liệu, vì nó là dữ liệu chứ không phải cấu
trúc.

**Dấu hiệu nhận biết**

- Trong vùng đó chỉ có **một** tiêu đề như vậy, không có cái thứ hai ngang hàng.
- Chuỗi ngắn, và ngắn một cách ổn định — không phải "hiện tại đang ngắn".
- Mọi dòng còn lại trong vùng đều đang mô tả đối tượng này.

**Tự hỏi.** Vùng này có đúng **một** đối tượng, và tên nó có ngắn một cách ổn định không? Thiếu **một**
trong hai dữ kiện là rơi xuống `TYPOGRAPHY-6`.

**Ranh giới**

- `TYPOGRAPHY-2`: tiêu đề đối tượng không vào dàn ý. Đừng biến nó thành `h2` chỉ vì nó là dòng to nhất
  trong vùng.
- `TYPOGRAPHY-6`: cần **cả hai** dữ kiện duy-nhất và ngắn. Lặp lại, gọn, dài, hoặc dễ dài sau dịch
  → luôn là `TYPOGRAPHY-6`. Mặc định an toàn là `TYPOGRAPHY-6`.

**Tình huống nghiệp vụ hay gặp.** Tên khoá học trong một thẻ giới thiệu lớn · tên gói dịch vụ trong
một khung so sánh một gói · tên tệp trong một khung xem trước · tên đối tượng trong một khung bên chi
tiết · tên chiến dịch trong một khối tóm tắt.

---

## `TYPOGRAPHY-6` — tiêu đề của phần tử ngang hàng

**Tình huống.** Cái tên của một đối tượng nằm **giữa nhiều đối tượng cùng loại**, hoặc một cái tên có thể
dài ra. Nhịp quét mắt phải đều nhau giữa các dòng, nên không dòng nào được to hơn dòng nào.

**Dấu hiệu nhận biết**

- Nó đến từ một vòng lặp, hoặc sẽ đến từ một vòng lặp trong tương lai gần.
- Có thể dài, có thể xuống dòng, có thể dài thêm sau khi dịch.
- Vùng chứa nó là một danh sách, một lưới, một bảng.

**Tự hỏi.** Cái tên này có phải một trong nhiều cái tên ngang hàng, hoặc có rủi ro dài ra không?

**Ranh giới**

- `TYPOGRAPHY-5`: xem trên. Bố cục rộng ra **không** thăng cấp phần tử ngang hàng thành chủ đạo.
- `TYPOGRAPHY-3`: tiêu đề ngang hàng gọi tên một **đối tượng dữ liệu**; `h3` gọi tên một **mục cấu trúc**.
  Cùng `text-sm font-medium` nhưng khác phần tử và khác dàn ý.
- `TYPOGRAPHY-7`: tiêu đề **gọi tên** (`font-medium`), văn bản **phát biểu** (`font-normal`). Nếu dòng
  đó là một câu thì nó không phải tiêu đề.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề của từng bài trong danh sách bài học · tên tệp trong danh
sách tệp · tiêu đề bài viết trong luồng tin · tên thành viên trong danh sách thành viên · tên mô-đun
trong lưới mô-đun · tiêu đề thông báo trong danh sách thông báo · tên đơn hàng trong lịch sử đơn hàng.

---

## `TYPOGRAPHY-7` — chữ giao diện thường

**Tình huống.** Một dòng **phát biểu một dữ kiện**: mô tả ngắn, siêu dữ liệu, một giá trị, một trạng thái
bằng chữ. Người dùng **quét** nó chứ không **đọc** nó.

**Dấu hiệu nhận biết**

- Đứng một mình nó vẫn có nghĩa — nó không cần một dòng khác ở trên để tồn tại.
- Nó là dữ liệu hoặc mô tả dữ liệu, không phải tên của dữ liệu.
- Người dùng liếc qua và lấy thông tin, không dừng lại đọc từng câu.

**Tự hỏi.** Dòng này có tự đứng được như một dữ kiện, và công việc của người đọc là quét chứ không
phải đọc liên tục, đúng không?

**Ranh giới**

- `TYPOGRAPHY-6`: xem trên.
- `TYPOGRAPHY-8`: khác nhau ở **công việc của người đọc**, không ở độ dài. Ba câu trong một thẻ để
  liếc vẫn là `TYPOGRAPHY-7`; một đoạn trong bài viết để đọc là `TYPOGRAPHY-8`.
- `TYPOGRAPHY-9`: `TYPOGRAPHY-9` **mất nghĩa** khi tách khỏi dòng nó bổ nghĩa; `TYPOGRAPHY-7` thì
  không. Đây là phép thử duy nhất cần dùng.

**Tình huống nghiệp vụ hay gặp.** Mô tả ngắn của một phần tử · `28/42 bài đã xong` trong một tóm tắt ·
địa chỉ thư điện tử trong một dòng thông tin · trạng thái bằng chữ trong một dòng chi tiết · số lượng trong
một dòng tóm tắt giỏ hàng · tên người tạo trong một dòng siêu dữ liệu có nghĩa độc lập.

---

## `TYPOGRAPHY-8` — văn bản để đọc liên tục

**Tình huống.** Nhiều câu, nhiều đoạn, và công việc của người dùng là **đọc từ đầu đến cuối**. Chữ
lớn hơn và dòng thưa hơn không phải vì đoạn văn quan trọng hơn, mà vì mắt phải chạy hết từng dòng.

**Dấu hiệu nhận biết**

- Có từ vài đoạn trở lên, hoặc là nội dung bài viết / tài liệu / giải thích dài.
- Người dùng dừng lại ở đây, không lướt qua.
- Xoá một đoạn thì mất nghĩa, không phải mất một dữ kiện rời.

**Tự hỏi.** Người đọc có phải đọc liên tục qua nhiều câu để hiểu không?

**Ranh giới**

- `TYPOGRAPHY-7`: xem trên. **Độ dài không phải tiêu chí** — công việc đọc mới là tiêu chí.
- `TYPOGRAPHY-5`: cùng `text-base` nhưng khác độ đậm. `font-medium` là tên, `font-normal` là nội
  dung. Một đoạn văn không bao giờ được `font-medium` để "nhấn mạnh".

**Tình huống nghiệp vụ hay gặp.** Thân bài viết · nội dung bài học dạng chữ · phần giải thích khái
niệm nhiều đoạn · điều khoản dịch vụ · changelog viết thành văn · phần mô tả dài của một khoá học.

---

## `TYPOGRAPHY-9` — chữ chỉ bổ nghĩa

**Tình huống.** Dòng này **chỉ tồn tại nhờ** một dòng khác hoặc một bề mặt khác. Tách nó ra khỏi
dòng chính thì nó không còn nói được gì.

**Dấu hiệu nhận biết**

- Luôn có một dòng chính ở ngay trên hoặc ngay cạnh.
- Đọc riêng nó thì câu hỏi "cái gì?" không có câu trả lời.
- Nó là thời điểm, đơn vị, tên định danh, nguồn gốc, chú thích, đếm phụ.

**Tự hỏi.** Nếu xoá dòng ở trên, dòng này còn nói được gì không? Nếu không — `TYPOGRAPHY-9`.

**Ranh giới**

- `TYPOGRAPHY-7`: xem trên.
- `TYPOGRAPHY-4`: cùng `text-xs` và cùng giảm nhấn. Khác ở **độ đậm** và ở **phần tử**: `h4` là
  `font-medium` và nằm trong dàn ý; nội dung hỗ trợ là `font-normal` và không phải tiêu đề.
- `TYPOGRAPHY-10`: nội dung hỗ trợ gắn vào **một** dòng; phần phân chia chia **một luồng** và không thuộc về
  dòng nào.

**Cặp không tách rời.** `text-xs` và `text-muted-foreground` đi cùng nhau. Không có nội dung hỗ trợ màu
tiền cảnh, và không có `text-xs` không giảm nhấn — trừ đúng `TYPOGRAPHY-4`.

**Tình huống nghiệp vụ hay gặp.** `Cập nhật 12 phút trước` dưới một tiêu đề · tên định danh dưới tên hiển thị
· đơn vị dưới một con số · `PDF · 2,4 MB` dưới tên tệp · `Bao gồm VAT` dưới giá · nguồn của một trích
dẫn · chú thích dưới một biểu đồ · dòng gợi ý dưới một trường nhập liệu.

---

## `TYPOGRAPHY-10` — dấu chia luồng kết quả

**Tình huống.** Một luồng kết quả liên tục cần mốc để quét — `Hôm nay`, `Hôm qua`, `Tháng 8` — nhưng
những mốc đó **không** tạo thêm phần nội dung trong tài liệu. Chúng chia thời gian, không chia cấu trúc.

**Dấu hiệu nhận biết**

- Sinh ra từ **dữ liệu**, không từ thiết kế trang: có bao nhiêu ngày thì có bấy nhiêu dấu.
- Không có mục lục nào nên liệt kê chúng.
- Bỏ hết dấu đi thì danh sách vẫn đúng, chỉ khó quét hơn.

**Tự hỏi.** Dấu này có tạo thêm một mục trong dàn ý tài liệu không? Nếu không — `TYPOGRAPHY-10`.

**Ranh giới**

- `TYPOGRAPHY-2` / `TYPOGRAPHY-3`: đây là chỗ hay sai nhất. Dấu trông như tiêu đề nên bị viết
  thành `h3`, và dàn ý của trang lập tức đầy những `Hôm qua`, `Tháng 7`. Dấu **không bao giờ**
  là phần tử tiêu đề.
- `TYPOGRAPHY-9`: xem trên.

**Tình huống nghiệp vụ hay gặp.** `Hôm nay` / `Hôm qua` trong luồng tin hoạt động · nhóm theo tháng trong
lịch sử giao dịch · chữ cái đầu trong danh bạ đã sắp xếp · `Tuần này` trong danh sách nhiệm vụ · nhãn
nhóm trong một danh sách kết quả tìm kiếm đã gom.

---

## `TYPOGRAPHY-11` — chữ mà thành phần điều khiển đã sở hữu

**Tình huống.** Chuỗi nằm **bên trong** một thành phần điều khiển: nhãn nút, chữ trong nhãn trạng thái, chữ của liên kết, văn bản gợi ý
của trường nhập liệu, chữ trong nhãn trạng thái. Thành phần điều khiển đó đã quyết định kiểu chữ của chính nó rồi.

**Dấu hiệu nhận biết**

- Chuỗi nằm trong `button`, `a`, `input`, hoặc một phần tử có vai trò điều khiển / trạng thái.
- Đổi chữ đó thì hành vi đổi, không chỉ nội dung đổi.
- Cùng một thành phần điều khiển đó xuất hiện ở nhiều nơi khác và phải trông giống hệt nhau.

**Tự hỏi.** Chuỗi này có nằm bên trong một thành phần điều khiển đã tự đặt kiểu chữ của nó không?

**Ranh giới**

- mọi mã khác: `TYPOGRAPHY-11` **thắng tất cả**. Kể cả khi chuỗi đọc y hệt chữ `TYPOGRAPHY-7`, ở
  trong thành phần điều khiển là ở trong thành phần điều khiển.
- `TYPOGRAPHY-9`: một dòng gợi ý nằm **bên ngoài** trường nhập liệu là `TYPOGRAPHY-9`. Văn bản gợi ý nằm **bên
  trong** trường nhập liệu là `TYPOGRAPHY-11`.

**Không khai báo class CSS chữ.** Đây là mã **không phát ra công thức nào**. Viết đè một cỡ chữ lên nhãn nút
là giành một quyền sở hữu mà nơi gọi không có, và cái sai đó tàng hình cho tới ngày thành phần điều khiển đổi rồi
một nơi sử dụng lệch khỏi tất cả các nơi sử dụng còn lại.

**Tình huống nghiệp vụ hay gặp.** Nhãn nút · chữ trong nhãn nhỏ trạng thái · chữ trong nhãn trạng thái đếm · nhãn
thẻ tab · văn bản gợi ý · chữ của liên kết điều hướng · nhãn của nút chuyển · chữ trong mục trong trình đơn.

---

## `TYPOGRAPHY-12` — chưa nêu chủ sở hữu

**Tình huống.** Yêu cầu thật sự **không** nêu cấp độ dàn ý và **không** nêu chủ sở hữu nội dung, và cũng
không có ngữ nghĩa tiêu đề/nội dung hỗ trợ nào suy ra được. Cần một câu trả lời đọc được thay vì một lời từ
chối.

**Dấu hiệu nhận biết**

- Yêu cầu chỉ nói về hình thức: "cho nó nổi hơn", "chỗ này to lên chút".
- Không xác định được dòng này thuộc về ai, và cũng không có dòng nào quanh nó để so.

**Tự hỏi.** Đã thật sự không suy ra được chủ sở hữu, hay chỉ là chưa chịu hỏi?

**Ranh giới**

- mọi mã khác: `TYPOGRAPHY-12` là **sàn**, không phải lối thoát. Nếu yêu cầu có nêu chủ sở hữu ở đâu đó
  thì dùng mã đúng, đừng rơi xuống đây cho nhanh.

**Không tự thăng cấp bằng con số.** Một giá trị số **không** tự trở thành dòng dẫn dắt chỉ vì nó là
số. Muốn nó dẫn dắt thì phải có một quyết định nội dung nói rằng nó dẫn dắt.

**Tình huống nghiệp vụ hay gặp.** Yêu cầu "làm 4.9/5 nổi hơn" mà không nói vùng đó dẫn bằng gì · một
dòng chữ dán vào mà chưa gắn với cấu trúc nào · nội dung tạm trong lúc chờ quyết định nội dung.

---

## Luật

1. Cấp độ dàn ý quyết định **cả** phần tử ngữ nghĩa **lẫn** cấp bậc hiển thị. Không có `h2` mang dáng
   phần thân, cũng không có `div` mang dáng tiêu đề.
2. Chỉ có **bốn** bậc tiêu đề. Cần bậc năm thì phẳng lại cấu trúc nội dung.
3. Một vùng có giới hạn chỉ có **một** dòng chữ dẫn dắt.
4. `TYPOGRAPHY-5` cần đủ **hai** dữ kiện: đối tượng duy nhất **và** tiêu đề ngắn ổn định. Thiếu một là rơi
   xuống `TYPOGRAPHY-6`.
5. Tiêu đề lặp lại, gọn, dài hoặc có thể bản địa hoá **luôn** dùng công thức cho phần tử ngang hàng.
6. `text-xs` luôn là nội dung hỗ trợ và luôn giảm nhấn — trừ đúng `TYPOGRAPHY-4`, vốn là `font-medium` và là một
   tiêu đề thật.
7. Con số, rê chuột, độ dài nhãn, khoảng trống còn lại và điểm ngắt **không** tạo cấp bậc.
8. Đang tải, rỗng, lỗi, thiết bị di động, dịch và chủ đề **không** đổi mã đã tính.
9. Không dùng đường viền, màu nền hay nhãn trạng thái để làm chữ quan trọng hơn. Những thứ đó nói về bề mặt,
   không nói về cấp bậc.
10. Chữ do thành phần điều khiển sở hữu **không** nhận kiểu chữ ghi đè từ bên ngoài.
11. Không ráp một công thức cỡ chữ/độ đậm/sắc thái không có trong bảng. Vốn từ là đóng.
12. Nếu còn hai mã liền kề cùng hợp lý, chọn mã **giành ít quyền sở hữu hơn**: phần tử ngang hàng trước chủ đạo,
    nội dung hỗ trợ trước phần nội dung, văn bản giao diện trước văn bản đọc liên tục. Chỉ hỏi khi yêu cầu bắt buộc quyền lớn hơn.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Chữ do thành phần điều khiển sở hữu.** `TYPOGRAPHY-11` thắng mọi mã khác, kể cả khi chuỗi đọc y hệt chữ giao diện
  thường.
- **Tên trang cũng là tên đối tượng.** Trên tuyến trang chi tiết, tên đối tượng **là** `TYPOGRAPHY-1`. Cùng chuỗi
  đó trong danh sách ở tuyến trang chỉ mục là `TYPOGRAPHY-6`. Tuyến trang quyết định, không phải chuỗi.
- **Xin cấp tiêu đề 5.** Không phát ra gì cả. Hỏi tác giả phẳng lại dàn ý. Đây là yêu cầu duy
  nhất mô-đun trả lời bằng câu hỏi.
- **Giá trị số chưa có chủ sở hữu.** Số không tự thăng cấp. Dùng `TYPOGRAPHY-12`, và chỉ hỏi ai dẫn dắt
  vùng này khi bên yêu cầu thật sự muốn thăng cấp nó.
- **Tính đồng nhất trạng thái.** Khung chờ, rỗng và lỗi của cùng một nội dung giữ nguyên mã. Khung chờ đổi
  cấp bậc là nói dối về quyền sở hữu trong lúc chờ.
- **Văn bản dài chưa có chính sách truy cập đầy đủ.** Truncate hay xuống dòng **không** phải quyết định
  kiểu chữ. Giữ nguyên mã đã tính và hỏi giá trị đầy đủ có buộc phải với tới được không.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi **quyền sở hữu** đổi, không phải khi màn hình đổi. Một tiêu đề ngang hàng
  vẫn là tiêu đề ngang hàng khi hàng trên máy tính biến thành cụm xếp dọc trên thiết bị di động.
