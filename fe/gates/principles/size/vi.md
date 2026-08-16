---
id: fe-principles-size-vi
title: vi.md
slug: /gates/principles/size/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống SIZE-N, nhận diện bằng chủ sở hữu phép đo chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `size`

# Kích thước

Kích thước là **chiều dài của một hộp trên một trục**, và luật này không hỏi nó dài bao nhiêu. Nó hỏi:

> Ai là người quyết định con số đó?

Chỉ có ba nguồn: **nội dung** bên trong hộp, **phần tử cha** đang mời chỗ, hoặc **một mức chặn** ai
đó cố ý đặt ra. Tám mã dưới đây là tám câu trả lời khác nhau cho đúng câu hỏi ấy.

**Mỗi trục là một quyết định riêng.** Một ô nhập bình luận lấy chiều ngang từ cha và chiều dọc từ một
mức sàn do người thiết kế đặt. Gọi nó là "một hộp đã tập kích thước" là cách một trong hai trục không bao
giờ được ai quyết.

**Đây là luật bắt buộc.** Bất cứ thứ gì hiển thị ra đều chiếm chỗ trên hai trục, và mỗi trục rơi vào
đúng một mã. Không có phần tử nào nhỏ đến mức được miễn: một biểu tượng `16px` là `SIZE-4` đúng cùng lý do
mà khung trang là `SIZE-2`. Câu "có mỗi cái biểu tượng thôi mà" là chỗ những con số không giải thích được
đi vào cơ sở mã.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `SIZE-0` | Hộp đúng bằng thứ nó chứa; bỏ nội dung đi thì hộp co lại | *không khai báo class CSS kích thước* |
| `SIZE-1` | Hộp nhận trọn phần chỗ mà cha mời | `w-full` · `h-full` · `flex-1` |
| `SIZE-2` | Có một **trần**: dòng đọc, khung trang, chiều cao phần tử chồng lớp | `max-w-[65ch]` · `max-w-5xl` · `max-h-[80vh]` |
| `SIZE-3` | Có một **sàn**: giữ chỗ để không sụp, không nhảy | `min-h-32` · `min-w-24` · `min-h-screen` |
| `SIZE-4` | Một biến thiết kế ấn định thẳng con số | `size-4` · `size-10` · `h-10` · `w-64` |
| `SIZE-5` | Một **phần chia** đã nêu rõ của cha | `w-1/2` · `basis-1/3` |
| `SIZE-6` | Gỡ **sàn tự nhiên** của nội dung để phép đo của cha thắng | `min-w-0` · `min-h-0` |
| `SIZE-7` | Trục kia suy ra trục này | `aspect-video` · `aspect-square` |

Thứ tự phân giải khi nhiều mã cùng khớp trên **một** trục:

`SIZE-7` → `SIZE-4` → `SIZE-2` → `SIZE-3` → `SIZE-6` → `SIZE-5` → `SIZE-1` → `SIZE-0`

---

## `SIZE-0` — nội dung tự đo

**Tình huống.** Hộp đúng bằng thứ nó chứa. Không ai áp đặt gì lên nó: bỏ chữ ra thì hộp co lại, thêm
chữ vào thì hộp nở ra, và đó chính là điều mong muốn.

**Dấu hiệu nhận biết**

- Nội dung ngắn, đã biết trước, và không có trạng thái nào làm nó dài gấp mấy lần.
- Hộp nằm cạnh những hộp khác trên một hàng và **không** được kỳ vọng thẳng cột với chúng.
- Nếu ép nó rộng ra, khoảng trống thừa bên trong sẽ trở thành một lời nói dối về nội dung.

**Tự hỏi.** Bỏ hết nội dung ra thì hộp này có nên biến mất về bề rộng bằng không không?

**Ranh giới**

- `SIZE-1`: `SIZE-0` co theo nội dung; `SIZE-1` giữ nguyên chiều dài kể cả khi rỗng. Một
  `<div>` khối trong luồng thường **đã là** `SIZE-1` theo trục ngang — nó không phải `SIZE-0`, chỉ
  là không cần viết class CSS nào.
- `SIZE-4`: nếu con số phải giống nhau ở mọi chỗ dùng lại, đó là biến thiết kế — `SIZE-4`, không phải để
  nội dung tự đo.
- `SIZE-2`: đoạn văn dài **không bao giờ** là `SIZE-0`. Văn bản không có trần là một trục chưa ai
  quyết, không phải một trục do nội dung quyết.

**Tình huống nghiệp vụ hay gặp.** Nhãn trạng thái trạng thái · nhãn nhỏ bộ lọc · nút trong một hàng hành động · nhãn
đơn vị đứng cạnh số · đường dẫn phân cấp · thẻ kỹ năng · nút "Xem thêm" dưới một danh sách · dòng siêu dữ liệu
gọn của một bản ghi.

---

## `SIZE-1` — cha đo, hộp nhận trọn

**Tình huống.** Cha đang giữ một phần chỗ và hộp này nhận **toàn bộ** phần đó. Chiều dài của hộp là
hệ quả của bố cục, không phải của chữ bên trong.

**Dấu hiệu nhận biết**

- Hộp phải thẳng cột với các hộp anh em ở trên và dưới nó.
- Khi nội dung rỗng, hộp vẫn phải giữ nguyên chiều dài.
- Cha là flex, lưới, hoặc hộp này là một thành phần điều khiển mà mặc định của trình duyệt là co theo nội dung.

**Tự hỏi.** Nếu nội dung biến mất, chiều dài này có phải giữ nguyên không?

**Ranh giới**

- `SIZE-0`: xem trên.
- `SIZE-5`: `SIZE-1` nhận **hết**; `SIZE-5` nhận **một phần đã nêu rõ**.
- `SIZE-6`: nếu nội dung bên trong có sàn tự nhiên đang phá phép đo của cha — chữ dài không chịu
  cắt, vùng cuộn không chịu cuộn — thì trục đó là `SIZE-6`, và `SIZE-1` chỉ là thứ `SIZE-6` cho phép
  xảy ra.
- `SIZE-2`: nếu có trần chặn lại thì trần mới là chủ trục, `w-full` chỉ là đường đi tới trần.

**Không viết `w-full` cho con khối trong luồng thường.** Nó đã đúng sẵn. Viết class CSS ở chỗ mặc định
**khác** đi: con của flex, con của lưới, `inline-block`, `input`, `button`, `select`, và hộp định vị
tuyệt đối.

**Tình huống nghiệp vụ hay gặp.** Ô nhập liệu trong một trường nhập liệu · nút gửi chiếm hết bề ngang trên thiết bị di động ·
vùng nội dung chính cạnh một thanh dọc · thẻ trong một ô lưới · thanh tiến độ trong khung của nó · vùng
kết quả tìm kiếm · phần thân của một hộp thoại.

---

## `SIZE-2` — có một trần

**Tình huống.** Hộp sẵn sàng nở ra nhưng ai đó đã đặt mức không được vượt. Trần luôn có **lý do**, và
lý do ấy phải nói được thành lời trước khi con số được viết ra.

**Dấu hiệu nhận biết**

- Vượt qua một mức nào đó thì hộp bắt đầu **hỏng chức năng**, chứ không phải chỉ xấu đi: mắt lạc dòng
  khi quay đầu dòng, phần tử chồng lớp tràn khỏi màn hình, trang căng ra trên màn siêu rộng.
- Con số đến từ một chuẩn hoặc một khung, không phải từ ảnh chụp màn hình.
- Ở màn hẹp, trần **không** có tác dụng gì cả — đó là dấu hiệu đúng của một trần.

**Tự hỏi.** Có một mức mà vượt qua nó thì hộp này hỏng việc chứ không chỉ xấu?

**Ranh giới**

- `SIZE-1`: `SIZE-1` nhận hết mọi thứ cha mời; `SIZE-2` nhận hết **cho tới** một mức.
- `SIZE-4`: biến thiết kế ấn định luôn con số ở mọi bề rộng; trần chỉ có hiệu lực khi chỗ trống vượt nó.
- `SIZE-3`: trần chặn nở, sàn chặn co. Hai thứ ngược chiều nhau và có thể cùng tồn tại.

**Chuẩn dòng đọc.** Một dòng chữ chạy quá dài thì mắt mất điểm quay đầu dòng ở cuối mỗi dòng; chạy
quá ngắn thì nhịp đọc bị bẻ liên tục. Vùng an toàn quen thuộc là khoảng **45–75 ký tự** một dòng, và
đó là lý do một cột văn bản luôn phải có trần — không phải vì cột hẹp trông đẹp hơn.

**Tình huống nghiệp vụ hay gặp.** Bài viết, mô tả khoá học, điều khoản dịch vụ · khung trang căn giữa
trên màn rộng · biểu mẫu đăng nhập giữa màn · hộp thoại và ngăn trượt · thông báo nổi · chú giải · ảnh không được vượt
quá khung chứa · vùng cuộn của một danh sách gợi ý.

---

## `SIZE-3` — có một sàn

**Tình huống.** Hộp có lúc rỗng hoặc gần rỗng, và nếu để nó co theo nội dung thì trang sẽ **nhảy**
hoặc vùng đó biến mất. Sàn là chỗ được **giữ trước** cho một trạng thái chưa tới.

**Dấu hiệu nhận biết**

- Hộp có nhiều trạng thái nội dung: rỗng, đang tải, một dòng, mười dòng.
- Người dùng sẽ **thao tác** vào vùng đó, nên vùng đó phải đủ lớn để bấm hoặc gõ ngay từ đầu.
- Nếu bỏ sàn đi, thứ hỏng là **vị trí của những phần tử khác**, không phải vẻ ngoài của hộp này.

**Tự hỏi.** Ở trạng thái nội dung nhỏ nhất, có thứ gì khác trên trang bị dịch chỗ không?

**Ranh giới**

- `SIZE-4`: sàn cho phép nở thêm; biến thiết kế thì không. Ô nhập nhiều dòng phải là sàn — ấn định chiều
  cao sẽ biến nó thành một vùng cuộn tí hon.
- `SIZE-2`: xem trên.
- `SIZE-0`: `SIZE-0` chấp nhận hộp co lại; `SIZE-3` là lúc việc co lại chính là lỗi.

**Đơn vị không đổi mã.** `min-h-screen` vẫn là `SIZE-3`. Khung nhìn là nơi con số đến, không phải người
sở hữu trục.

**Tình huống nghiệp vụ hay gặp.** Ô nhập nhiều dòng · vùng trạng thái rỗng có minh hoạ và nút hành
động · khung ứng dụng phải phủ hết chiều cao màn hình để phần cuối không trôi lên giữa · cột số liệu giữ
bề rộng để bảng không rung khi số đổi · nút có nhãn đổi giữa "Lưu" và "Đang lưu" · vùng biểu đồ trước
khi dữ liệu về · thẻ trong lưới phải cao bằng nhau tối thiểu.

---

## `SIZE-4` — biến thiết kế ấn định

**Tình huống.** Con số **không** đến từ nội dung và **không** đến từ cha. Nó là một quyết định của hệ
thống, giống nhau ở mọi nơi phần tử này xuất hiện.

**Dấu hiệu nhận biết**

- Cùng một phần tử xuất hiện ở nhiều màn và phải trông y hệt nhau.
- Nội dung bên trong không có "chiều dài tự nhiên" nào đáng tin: một hình dạng ký tự, một ảnh đại diện, một
  rãnh thanh trượt.
- Nếu để nó co theo nội dung, nó sẽ nhảy mỗi lần dữ liệu đổi.

**Tự hỏi.** Con số này có phải giống hệt nhau ở mọi chỗ phần tử này xuất hiện không?

**Ranh giới**

- `SIZE-0`: biểu tượng là `SIZE-4` vì SVG không có "chiều dài tự nhiên" nào đáng dùng; chữ thì có.
- `SIZE-3`: xem trên.
- `SIZE-7`: nếu chỉ **một** trục được ấn định và trục kia suy ra từ nó, trục suy ra là `SIZE-7`.

**Con số phải đến từ thang biến thiết kế.** Một giá trị lẻ đo trên ảnh chụp màn hình không phải là `SIZE-4`;
đó là `SIZE-4` giả, và nó sẽ không khớp với bất kỳ phần tử nào khác trong hệ.

**Tình huống nghiệp vụ hay gặp.** Biểu tượng trong nút và trong trình đơn · ảnh đại diện · chấm trạng thái · chiều cao
thành phần điều khiển để nút và ô nhập liệu thẳng hàng · thanh tiến độ mảnh · phần đầu dính có chiều cao cố định để nội
dung bên dưới trừ đúng phần bị che · thanh dọc điều hướng bề rộng cố định · ô hộp kiểm tuỳ biến.

---

## `SIZE-5` — một phần chia của cha

**Tình huống.** Cha bị chia theo một tỉ lệ **đã nêu rõ**, và hộp này nhận đúng phần của nó. Tỉ lệ là
một phát biểu về nội dung: bên nào quan trọng hơn, bên nào phụ.

**Dấu hiệu nhận biết**

- Có thể nói thành lời: "một nửa", "một phần ba", "hai phần ba".
- Tỉ lệ đúng ở mọi bề rộng mà bố cục này còn hiệu lực.
- Chiều dài của hộp **không** phụ thuộc nội dung của chính nó, cũng không phụ thuộc nội dung của hộp
  bên cạnh.

**Tự hỏi.** Tỉ lệ này có phải là một quyết định về tầm quan trọng, hay chỉ là con số làm ảnh chụp
hiện tại trông cân?

**Ranh giới**

- `SIZE-1`: `SIZE-5` nhận một phần; `SIZE-1` nhận hết.
- `SIZE-4`: phần chia co giãn theo cha; biến thiết kế thì không. Thanh dọc cần đúng chỗ cho hai dòng nhãn là
  `SIZE-4`; thanh dọc "chiếm một phần tư" là `SIZE-5`.
- lưới: khi các phần bằng nhau và **có khoảng cách giữa các phần tử ở giữa**, tỉ lệ thuộc về **rãnh của cha**, không thuộc
  về con. Lúc đó con là `SIZE-1` trong ô của nó, còn cha khai báo số cột.

**Tình huống nghiệp vụ hay gặp.** Bố cục hai cột không đều giữa nội dung và tóm tắt · thẻ so sánh gói
dịch vụ · thanh chia đôi giữa ảnh và mô tả trong một vùng nổi bật · phần trăm hoàn thành vẽ bằng một hộp con
bên trong rãnh · ba khối quyền lợi trên một hàng cuộn ngang.

---

## `SIZE-6` — gỡ sàn tự nhiên

**Tình huống.** Cha đã nói rõ hộp con được bao nhiêu chỗ, nhưng **nội dung bên trong không chịu**:
một chuỗi dài không chỗ ngắt, một bảng, một vùng lẽ ra phải cuộn. Mặc định của flex và lưới là **không
cho con nhỏ hơn nội dung tối thiểu của nó**, nên phép đo của cha bị vô hiệu trong im lặng.

`SIZE-6` là lúc ta xử cho cha thắng.

**Dấu hiệu nhận biết**

- Có `truncate`, `line-clamp`, hoặc một ô văn bản dài trong một hàng flex.
- Có vùng cuộn nằm bên trong một cột flex có chiều cao xác định.
- Triệu chứng: hộp **tràn ra ngoài** cha, cả trang có thanh cuộn ngang, hoặc vùng cuộn không bao giờ
  cuộn mà đẩy dài cả trang.

**Tự hỏi.** Có nội dung nào bên trong đang từ chối co lại, khiến phép đo của cha không có hiệu lực?

**Ranh giới**

- `SIZE-1`: `SIZE-1` là phép đo; `SIZE-6` là điều kiện để phép đo ấy có hiệu lực. Khi cả hai cùng
  có mặt trên một trục, mã là `SIZE-6`, vì đó mới là quyết định mà `SIZE-1` một mình không nói được.
- `SIZE-2`: trần chặn nở ra; `SIZE-6` cho phép co vào.
- `SIZE-3`: hai mã đối nghịch trực tiếp. `SIZE-3` dựng một sàn, `SIZE-6` dỡ cái sàn mà trình duyệt
  tự dựng.

**`overflow-hidden` không thay thế được.** Nó giấu hậu quả và giữ nguyên nguyên nhân: hộp vẫn được đo
sai, chỉ là ta không nhìn thấy nữa.

**Tình huống nghiệp vụ hay gặp.** Tên tệp dài trong một hàng có nút ở cuối · tiêu đề cắt bằng dấu ba
chấm cạnh một nhãn trạng thái · thư điện tử người dùng trong trình đơn tài khoản · vùng tin nhắn cuộn trong khung trò chuyện cao
bằng màn hình · bảng đặt trong một cột flex · biểu đồ trong một ô lưới · đường dẫn phân cấp dài.

---

## `SIZE-7` — trục kia suy ra

**Tình huống.** Chỉ **một** trục được đo, trục còn lại là hệ quả của một tỉ lệ đã chốt. Hộp giữ đúng
chỗ cho một thứ chưa tới hoặc chưa biết chiều dài thật.

**Dấu hiệu nhận biết**

- Nội dung là ảnh, video, bản đồ hay nội dung nhúng — thứ mang theo kích thước mà **không ai trong cơ sở mã
  này chọn**.
- Nếu không giữ chỗ trước, khi nội dung tải xong nó sẽ **đẩy** những gì đang hiển thị.
- Tỉ lệ là một phần của thiết kế: ô vuông cho ảnh đại diện, khung phim cho ảnh thu nhỏ.

**Tự hỏi.** Chiều dài của trục này có được suy ra từ trục kia, thay vì được đo riêng?

**Ranh giới**

- `SIZE-4`: biến thiết kế ấn định **cả hai** trục bằng những con số đã biết; `SIZE-7` chỉ biết một trục và
  một tỉ lệ.
- `SIZE-3`: sàn giữ chỗ tối thiểu rồi cho nở; tỉ lệ giữ đúng hình dạng ở mọi bề rộng.

**Bắt buộc chứ không tuỳ chọn.** Ở bất cứ chỗ nào nội dung tới muộn có thể làm dịch chuyển thứ đang
hiển thị, việc giữ chỗ bằng tỉ lệ là luật.

**Tình huống nghiệp vụ hay gặp.** Ảnh thu nhỏ bài giảng · ảnh bìa khoá học · ảnh đại diện trong lưới thành
viên · bản đồ nhúng · khung video · văn bản gợi ý ảnh khi tải · ô ảnh trong lưới bộ sưu tập.

---

## Luật

1. Hỏi **ai đo**, không hỏi **bao nhiêu**.
2. Mỗi **trục** một mã. Một hộp mang hai mã, không phải một.
3. Đơn vị không đổi mã. `ch`, `rem`, `%`, `vh`, `px` là đơn vị; mã nói về chủ sở hữu.
4. Con khối trong luồng thường đã là `SIZE-1` theo trục ngang — đừng viết lại bằng `w-full`.
5. Văn bản chạy dài luôn có trần. Không trần nghĩa là trục đó chưa ai quyết.
6. Con của flex hoặc lưới mà phải cắt chữ hoặc phải cuộn thì luôn mang `SIZE-6` trên trục đó.
7. Con số ấn định lấy từ thang biến thiết kế, không lấy từ ảnh chụp màn hình.
8. Cha và đứa con duy nhất của nó không cùng khai báo một chiều dài.
9. Khung chờ, rỗng, lỗi và có dữ liệu dùng chung một mã trên cùng một trục.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Vừa sàn vừa trần trên một trục.** Trục đó là một **khoảng** đã nêu rõ. Ghi mã theo mức mà yêu cầu
  thật sự nói về: trần nếu nỗi lo là nở quá, sàn nếu nỗi lo là sụp xuống. Mức còn lại là hàng rào,
  không phải quyết định.
- **Hộp định vị tuyệt đối.** "Cha" trong `SIZE-1` và `SIZE-5` là **khối chứa**, không phải cha
  trong DOM. Đọc mã trên sai phần tử thì mọi lập luận sau đó đều sai.
- **Nội dung đa phương tiện không biết kích thước trước.** Xem `SIZE-7`: giữ chỗ là bắt buộc ở mọi chỗ mà nội dung tới
  muộn sẽ đẩy phần đang hiển thị.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi **vai trò bố cục** đổi. Một thanh dọc biến thành dải xếp chồng là đổi chủ
  sở hữu thật; cũng thanh dọc đó chỉ hẹp bớt đi thì không.
- **Phần tử biểu mẫu và phần tử thay thế.** `input`, `select`, `textarea`, `img`, `iframe` mang sẵn kích
  thước do nền tảng chọn, tức mặc định của chúng là `SIZE-0`. Khai `SIZE-1` cho chúng là một quyết
  định thật, kể cả trong luồng thường.
- **Tính đồng nhất trạng thái.** Khung chờ đo theo nội dung trong khi nội dung thật lấp đầy cha là một cách
  nói dối về bố cục, và người dùng thấy lời nói dối đó dưới dạng một cú nhảy.
