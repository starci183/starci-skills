---
id: fe-principles-responsive-vi
title: vi.md
slug: /gates/principles/responsive/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống RESPONSIVE-N, nhận diện bằng nội dung lỗi đo được chứ không bằng tên thiết bị.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `responsive`

# Thiết kế đáp ứng

Thiết kế đáp ứng là việc **đổi hình học** của một vùng giao diện **tại đúng điểm nội dung bắt đầu hỏng**,
bằng **phép biến đổi nhỏ nhất** sửa được chỗ hỏng đó.

Đừng chọn điểm ngắt bằng cảm giác, bằng ảnh chụp một cái điện thoại, hay bằng câu "cho nó thiết bị di động
hơn". Hãy thu hẹp khung nhìn cho tới khi có thứ **thật sự hỏng**, rồi hỏi:

> Cái gì vừa hỏng, và phép sửa **rẻ nhất** khiến nó hết hỏng là gì?

Càng ít thứ bị đổi, phép sửa càng đúng. Xuống dòng rẻ hơn đổi trục; đổi trục rẻ hơn đổi số cột; đổi số cột
rẻ hơn cho cuộn ngang; và cho cuộn ngang vẫn rẻ hơn thay hẳn một vùng bằng một thành phần điều khiển khác.

**Đây là luật bắt buộc.** Mọi vùng hiển thị ra đều rơi vào đúng một mã dưới đây — kể cả vùng không cần
class CSS nào: đó là `RESPONSIVE-1`, và `RESPONSIVE-1` là một **quyết định phải bảo vệ được**, không phải
chỗ luật bị bỏ quên. Không có kích thước nào nhỏ đến mức được miễn: một hàng hai nút có tình huống
thiết kế đáp ứng của nó, đúng cùng một lý do mà một khung trang có thanh bộ lọc cũng có. Câu "có mỗi hai cái
nút thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

Ba thứ **không bao giờ** được đổi theo bề rộng: **thứ tự DOM**, **thứ tự đọc và tiêu điểm**, và **tập
việc người dùng làm được**. Thiết kế đáp ứng đổi chỗ ngồi, không đổi màn hình đó dùng để làm gì.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `RESPONSIVE-1` | Không có gì hỏng ở mọi bề rộng được hỗ trợ | *không khai báo class CSS thiết kế đáp ứng* |
| `RESPONSIVE-2` | Các phần tử ngang hàng vẫn là một chuỗi nội tuyến, chỉ cần xuống thêm dòng | `flex flex-wrap` |
| `RESPONSIVE-3` | Một hàng hết dùng được, nhưng vẫn đúng người đúng thứ tự khi xếp dọc | `flex flex-col sm:flex-row` |
| `RESPONSIVE-4` | Các phần tử lặp lại ngang hàng cần bớt cột khi hẹp | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| `RESPONSIVE-5` | Nội dung mà **ý nghĩa nằm ở chính sự sắp ngang**, không dàn lại được | chủ sở hữu `max-w-full overflow-x-auto` + con `min-w-max` |
| `RESPONSIVE-6` | Một vùng thường trực đổi thành một thành phần điều khiển gọn **tương đương và vẫn tới được** | cặp `hidden md:block` / `md:hidden` |

Tiền tố `sm:`, `md:`, `lg:` trong bảng chỉ là **chỗ điền**. Con số thật là bề rộng mà bạn **đã đo
được** là nội dung hỏng. Một điểm ngắt chọn vì "cái này là máy tính bảng" là một con số bịa mặc áo tiện ích
class CSS.

---

## `RESPONSIVE-1` — không có gì hỏng

**Tình huống.** Ở mọi bề rộng được hỗ trợ, không có va chạm, không bị cắt, không có thành phần điều khiển nào nhỏ
dưới mức bấm được, không có chữ nào bị tràn ra ngoài. Bố cục gốc — vốn đã viết cho trạng thái hẹp
nhất — tự nó đã đúng. Vùng này **không sở hữu** một phép biến đổi nào.

**Dấu hiệu nhận biết**

- Thu khung nhìn về bề rộng hẹp nhất được hỗ trợ mà không thấy thứ gì hỏng.
- Nội dung vốn đã tự xuống dòng được, hoặc vốn đã là một cột.
- Yêu cầu duy nhất nghe được là "cho nó thiết kế đáp ứng đi", "nhìn thiết bị di động hơn" — không ai chỉ ra được cái
  gì hỏng.
- Chỗ hẹp bị kêu thật ra là **một dòng chữ dài trong một phần tử con flex**, sửa bằng `min-w-0` chứ không
  phải bằng điểm ngắt.

**Tự hỏi.** Ở bề rộng hẹp nhất được hỗ trợ, **cái gì** đang hỏng? Nếu không gọi tên được — dừng lại,
đây là `RESPONSIVE-1`.

**Ranh giới**

- `RESPONSIVE-2`: chỉ lên `2` khi đã **thấy** các phần tử ngang hàng đè nhau hoặc bị đẩy tràn, không phải khi
  đoán rằng có ngày chúng sẽ tràn.
- `RESPONSIVE-3`: một hàng **chật** chưa phải một hàng **hỏng**. Hỏng nghĩa là có phần tử xuống dưới
  bề rộng dùng được của nó, hoặc bị cắt mất.
- mọi mã khác: thiếu bằng chứng thì mặc định luôn là mã này. Đây là mặc định an toàn của cả mô-đun.

**Không viết điểm ngắt rỗng.** `sm:flex-row` trên thứ vốn đã là hàng, `lg:grid-cols-3` trên lưới vốn
đã ba cột, `md:block` trên khối vốn đang hiện — đều là nói dối rằng có một bề rộng nào đó quan
trọng. Mã `RESPONSIVE-1` là mã tình huống, không phải tên class CSS.

**Tình huống nghiệp vụ hay gặp.** Một cột nội dung đọc dọc · biểu mẫu một cột · một khối văn bản · thẻ
đơn lẻ · trạng thái rỗng có một dòng chữ và một nút · hộp thoại nội dung ngắn · một cụm nhãn trạng thái ·
đường dẫn phân cấp ngắn · bảng điều khiển chỉ có một biểu đồ đã tự co giãn.

---

## `RESPONSIVE-2` — vẫn một chuỗi, chỉ cần thêm dòng

**Tình huống.** Các phần tử là **phần tử ngang hàng nội tuyến**: chúng không có thứ tự bắt buộc phải nằm trên cùng một
dòng, số lượng có thể không biết trước, và việc phần tử cuối rơi xuống dòng dưới **không làm mất
nghĩa gì cả**. Chuỗi vẫn là một chuỗi, chỉ dài ra theo chiều dọc.

**Dấu hiệu nhận biết**

- Số lượng phần tử do dữ liệu quyết định: thẻ, nhãn nhỏ lọc, nhãn, tác giả, kỹ năng.
- Độ dài nhãn thay đổi theo ngôn ngữ hoặc theo dữ liệu người dùng nhập.
- Bỏ một phần tử ra khỏi dòng đầu không làm ai hiểu sai điều gì.
- Không có phần tử nào là "vế trái" hay "vế phải" của một quan hệ hai bên.

**Tự hỏi.** Nếu phần tử cuối rơi xuống dòng dưới, có ai hiểu sai gì không? Nếu không — `RESPONSIVE-2`.

**Ranh giới**

- `RESPONSIVE-1`: `2` cần một tràn **quan sát được**, không phải một dự đoán.
- `RESPONSIVE-3`: `3` dành cho **một quan hệ hai vế** (tiêu đề và hành động, trường nhập liệu và nút) mà cả hai
  vế cùng đổi trục một lần. `2` là **nhiều phần tử ngang hàng đồng hạng** tự tìm chỗ. Nếu bạn phải hỏi "vế nào
  xuống trước", đó là `3`.
- `RESPONSIVE-4`: `4` dành cho các phần tử **lặp lại có bề rộng tối thiểu đo được** và cần **thẳng
  cột**. Nếu việc thẳng cột không quan trọng thì `2` rẻ hơn và đúng hơn.
- `RESPONSIVE-5`: nếu vị trí ngang của các phần tử **là** thông tin (thứ tự thời gian, cột so
  sánh), xuống dòng sẽ phá nghĩa — đó là `5`.

**Tình huống nghiệp vụ hay gặp.** Danh sách thẻ · nhãn nhỏ bộ lọc đang bật · nhóm nút phụ trong thanh công cụ ·
siêu dữ liệu dưới tiêu đề (tác giả · ngày · thời lượng · mức độ) · danh sách kỹ năng trong hồ sơ · nhãn
trạng thái của một đơn hàng · các nút chia sẻ · danh sách người tham gia dạng ảnh đại diện + tên · nhóm
nhãn trạng thái chứng chỉ.

---

## `RESPONSIVE-3` — hàng hết dùng được, xếp dọc thì vẫn đúng

**Tình huống.** Hai (hoặc vài) nhóm tạo thành **một quan hệ có hai vế** trên một hàng. Khi hẹp, ít
nhất một vế tụt xuống dưới bề rộng dùng được của nó — chữ bị cắt, ô nhập liệu còn vài ký tự, nút chồng lên
nhau. Cũng **những vế đó, cũng thứ tự đó**, xếp dọc thì vẫn đọc đúng.

**Dấu hiệu nhận biết**

- Có thể gọi tên từng vế: "cụm tiêu đề" và "cụm hành động"; "ô nhập" và "nút gửi".
- Ở trạng thái hẹp, đọc từ trên xuống vẫn ra đúng câu chuyện như đọc từ trái sang phải khi rộng.
- Không vế nào biến mất, không vế nào đổi mức ưu tiên.
- Chỉ có **trục** đổi. Khoảng cách giữa các phần tử giữa các vế, khoảng đệm trong, phân cấp đều giữ nguyên.

**Tự hỏi.** Vẫn đúng những vế đó và đúng thứ tự đó khi xếp dọc chứ? Nếu phải đảo thứ tự mới xuôi thì
**dừng** — đó là thiết kế lại tác vụ, không phải thiết kế đáp ứng.

**Ranh giới**

- `RESPONSIVE-2`: xem trên. `2` không có khái niệm "vế".
- `RESPONSIVE-4`: `3` là **các vế khác nhau** đổi trục; `4` là **các phần tử giống nhau** đổi số cột.
  Tiêu đề cạnh hành động là `3`; mười hai thẻ khoá học là `4`.
- `RESPONSIVE-6`: `3` **giữ cả hai vế hiện ra**, chỉ đổi trục. Nếu một vế **biến mất** và được thay
  bằng một thành phần điều khiển khác thì đó là `6`, và `6` phải trả được các điều kiện của nó.

**Tình huống nghiệp vụ hay gặp.** Phần đầu trang: tiêu đề + mô tả bên trái, nhóm nút bên phải · ô nhập
mã giảm giá + nút áp dụng · thanh tìm kiếm + nút lọc · phần cuối của hộp thoại với Huỷ và Xác nhận · một
hàng tóm tắt hoá đơn: tên gói bên trái, giá bên phải · khối giá + nút ghi danh · cụm ảnh đại diện + tên +
nút theo dõi.

---

## `RESPONSIVE-4` — các phần tử lặp lại cần bớt cột

**Tình huống.** Một tập phần tử **cùng loại, ngang hàng, lặp lại**, mỗi phần tử có một **bề rộng tối thiểu
đo được** để còn đọc/dùng được. Khi vùng chứa hẹp lại, số cột giảm dần. Thứ tự các phần tử **không đổi**;
chỉ số rãnh đổi.

**Dấu hiệu nhận biết**

- Các phần tử hiển thị ra từ một vòng lặp trên cùng một loại dữ liệu.
- Mỗi phần tử có cùng cấu trúc bên trong, cùng vai trò.
- Việc **thẳng cột, thẳng hàng** giữa các phần tử có ý nghĩa với người đọc (dễ so sánh, dễ quét mắt).
- Bạn có một con số thật cho "hẹp hơn mức này thì phần tử không đọc được nữa".

**Tự hỏi.** Đây là những phần tử **giống nhau lặp lại**, và bạn có **bề rộng tối thiểu đo được** cho một
phần tử chưa? Nếu chưa có con số đó, đừng bịa ngưỡng — để một cột.

**Ranh giới**

- `RESPONSIVE-2`: xuống dòng cũng xuống dòng được, nhưng xuống dòng **không thẳng cột**. Nếu người dùng cần so
  sánh giữa các phần tử thì `4`; nếu chỉ cần đọc hết thì `2` rẻ hơn.
- `RESPONSIVE-3`: xem trên.
- `RESPONSIVE-5`: nếu **thứ tự ngang** của các phần tử là thông tin (mốc thời gian, các cột của một
  phép so sánh) thì việc rớt xuống dòng dưới sẽ phá nghĩa — đó là `5`.

**Tình huống nghiệp vụ hay gặp.** Lưới thẻ khoá học · lưới sản phẩm · thư viện ảnh · lưới ô số liệu
· danh sách bài viết dạng thẻ · lưới thành viên nhóm · các gói giá đặt cạnh nhau · lưới bài tập ·
danh sách tệp dạng tile.

---

## `RESPONSIVE-5` — nghĩa nằm ở chính sự sắp ngang

**Tình huống.** Nội dung mà **quan hệ giữa các phần chính là vị trí ngang của chúng**: cột của một
bảng, các mốc trên một trục thời gian, các nút DOM và đường nối của một sơ đồ. Xuống dòng hay xếp dọc
**không phải là sắp xếp lại**, mà là **xoá mất thông tin**. Vì vậy vùng đó được cuộn ngang — nhưng
cuộn **bên trong chủ sở hữu của nó**, không bao giờ để cả trang cuộn ngang.

**Dấu hiệu nhận biết**

- Có thể chỉ ra một câu người dùng đọc được **nhờ** sự thẳng hàng: "cột này so với cột kia".
- Bỏ một cột đi hoặc đẩy nó xuống dòng là mất một phép so sánh.
- Nội dung có bề rộng nội tại: bảng, sơ đồ, dòng mã, khuông nhạc, gantt.

**Tự hỏi.** Nếu cho phần này dàn lại sang trục khác, có phép so sánh nào **biến mất** không? Phải trả
lời được **có** kèm ví dụ cụ thể mới được dùng mã này.

**Ranh giới**

- `RESPONSIVE-2` và `RESPONSIVE-4`: đây là mã **cuối cùng** được chọn, không phải mã tiện nhất.
  Cuộn ngang bắt người dùng làm thêm việc; chỉ trả cái giá đó khi dàn lại thật sự phá nghĩa.
- `RESPONSIVE-6`: nếu bạn định **giấu bớt cột** khi hẹp, đó không còn là `5`. Giấu nội dung phải đi
  qua các điều kiện của `6`, và cột số liệu thiết yếu thì không được giấu.

**Bề rộng nội tại, không phải số cứng.** Con trong vùng cuộn dùng `min-w-max` — để chính nội dung
khai báo bề rộng của nó. Một con số cứng (`min-w-[720px]`) hay một biến riêng của dự án là một lời
đoán, và nó sai ngay khi ngôn ngữ đổi hoặc dữ liệu dài ra.

**Tình huống nghiệp vụ hay gặp.** Bảng dữ liệu nhiều cột · bảng so sánh gói dịch vụ · trục thời gian
có mốc và đường nối · sơ đồ kiến trúc · biểu đồ gantt · lịch theo tuần · khối mã có dòng dài · bảng
kết quả benchmark.

---

## `RESPONSIVE-6` — vùng thường trực đổi thành thành phần điều khiển tương đương

**Tình huống.** Ở bề rộng lớn, một vùng **thường trực** luôn hiện (thanh dọc lọc, điều hướng mở rộng, khung
phụ). Ở bề rộng hẹp, vùng đó không còn chỗ, và nó được thay bằng **một thành phần điều khiển gọn dẫn tới đúng nội
dung ấy**. Đây là mã đắt nhất, vì nó là mã duy nhất khiến DOM có hai cách biểu diễn cho một việc.

**Dấu hiệu nhận biết**

- Vùng đó là một **vùng bố cục** có hình học riêng, không phải một cụm chữ.
- Có thể gọi tên thành phần điều khiển thay thế: một nút mở khung, một nút trình đơn — và nó **đã tồn tại**, không phải
  sẽ làm sau.
- Cả hai cách biểu diễn đọc **cùng một trạng thái**: cùng số bộ lọc đang bật, cùng mục đang chọn.

**Tự hỏi.** Có **đúng một** thành phần điều khiển thay thế dẫn tới cùng tác vụ đó với cùng trạng thái đó, và tiêu điểm quay về
đúng chỗ khi đóng, không? Thiếu một trong ba — từ chối mã này và giữ nội dung hiện ra.

**Ranh giới**

- `RESPONSIVE-3`: `3` giữ cả hai vế hiện ra và chỉ đổi trục. Chỉ dùng `6` khi việc xếp dọc **thật
  sự** không dùng được, chứ không phải vì trông rườm rà.
- "giấu cho gọn": giấu mà không có đường thay thế **không phải là một mã**. Đó là một lỗi. Nội dung
  thiết yếu không bao giờ được giấu.

**Hai biểu diễn, một trạng thái.** Nếu hai bên giữ trạng thái riêng, người dùng sẽ thấy bộ lọc "biến mất" khi
xoay máy. Trạng thái phải nằm ở chủ sở hữu, cả hai bên chỉ đọc nó.

**Tình huống nghiệp vụ hay gặp.** Thanh bộ lọc dọc được thay bằng nút "Bộ lọc · 3" · thanh điều hướng ngang
được thu vào nút trình đơn · mục lục bên cạnh được thay bằng nút "Nội dung khoá học" · khung chi tiết cạnh
danh sách chuyển thành trang chi tiết riêng · phần tóm tắt giỏ hàng chuyển thành thanh tổng tiền ghim dưới đáy.

---

## Luật

1. Class CSS gốc viết cho trạng thái **hẹp nhất**; mọi điểm ngắt là ghi đè min-chiều rộng chồng lên. Mô-đun
   này không có tư duy max-chiều rộng.
2. Điểm ngắt đánh dấu **điểm nội dung hỏng**, không đánh dấu tên thiết bị.
3. Một thứ tự DOM, một thứ tự đọc, một thứ tự tiêu điểm — ở mọi bề rộng. **Cấm** `order-*` theo
   điểm ngắt: nó kể một câu chuyện thứ hai mà DOM không kể, và bàn phím với trình đọc màn hình chỉ nhận
   được câu chuyện thứ nhất.
4. Đổi trục **không** tự đổi khoảng cách, khoảng đệm trong, phân cấp hay ngữ nghĩa.
5. Thành phần sở hữu hình học thì thành phần đó viết class CSS thiết kế đáp ứng. Bên sử dụng không vá vào ruột con.
6. Không giấu nội dung thiết yếu. Cặp khả năng hiển thị phải có đường thay thế tương đương, trạng thái dùng chung
   và đường tiêu điểm xác định.
7. Xuống dòng hoặc cụm xếp dọc **trước**, rồi mới tính tới việc thu nhỏ. Không bao giờ thu chữ hay vùng tương tác
   xuống dưới mức dùng được chỉ để giữ một dòng.
8. Đang tải, rỗng, lỗi và sẵn sàng dùng **cùng chủ sở hữu, cùng rãnh, cùng điểm neo**. Trạng thái mạng không
   phải là một bố cục.
9. Nếu hai mã liền kề cùng hợp lý, chọn **mã có chỉ số nhỏ hơn** — phép sửa rẻ hơn.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Không có lỗi quan sát được.** Trả lời `RESPONSIVE-1`: giữ bố cục gốc, không thêm gì. "Làm cho
  nó thiết kế đáp ứng" không phải bằng chứng.
- **Không có bề rộng tối thiểu đo được.** Đừng bịa ngưỡng lưới. `RESPONSIVE-4` thiếu con số thì rơi
  về một cột — số cột duy nhất không thể sai.
- **Chưa chứng minh dàn lại phá nghĩa.** `RESPONSIVE-5` đòi một ví dụ cụ thể về phép so sánh bị mất.
  Chưa có thì dùng `2` hoặc `3`.
- **Không có đường thay thế.** Từ chối `RESPONSIVE-6`, giữ nội dung hiện ra.
- **Chữ tràn trước, bố cục tràn sau.** Tiêu đề dài sửa trong chính ô của nó trước: `min-w-0`, cho
  xuống dòng, hoặc truncate nhưng giữ đủ giá trị cho trợ năng. Phần tử con flex mặc định không nhỏ hơn nội dung
  của nó, nên rất nhiều "vỡ ở màn hẹp" là thiếu `min-w-0` chứ không phải thiếu điểm ngắt.
- **Hai mã liền kề cùng khớp.** Chọn mã nhỏ hơn. Chỉ hỏi **một** câu phân định khi bên yêu cầu nói rõ
  họ cần phép biến đổi đắt hơn mà không nêu được lỗi.
- **Tính đồng nhất trạng thái.** Khung chờ, rỗng và lỗi hiển thị trong **cùng chủ sở hữu** và mang **cùng mã** với
  trạng thái đã tải xong. Đổi mã lúc đang tải là nói dối về hình học.
