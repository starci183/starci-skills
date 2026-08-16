---
id: fe-principles-density-vi
title: vi.md
slug: /fe/principles/density/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống DENSITY-N, nhận diện bằng công việc của người đọc chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `density`

# Mật độ

Mật độ là **độ chặt** mà thông tin lặp lại được đóng gói trong một vùng.

Nó do **ngữ cảnh** quyết định — vùng đó đang phục vụ việc gì cho người đọc — chứ **không** do bản
thân thành phần quyết định.

> Người đọc đang **dừng lại ở một thứ**, đang **làm việc với vài thứ**, hay đang **quét qua rất
> nhiều thứ**?

Cùng một dòng gồm tên, trạng thái và số tiền: đặt trên một trang bán hàng thì nó phải thoáng, đặt
trong một bảng hai trăm dòng thì nó phải chặt. **Không có gì bên trong dòng đó thay đổi.** Chỉ ngữ
cảnh thay đổi.

Đây chính là lý do luật tồn tại. Khi thành phần được phép tự trả lời, câu trả lời sẽ đi vào dưới dạng
một thuộc tính truyền vào — `size`, `dense`, `compact`, `variant="sm"` — và thuộc tính truyền vào đó **mọc thêm một giá trị mỗi lần
thành phần được đặt vào một chỗ mới**, bởi mỗi chỗ mới là một ngữ cảnh, và thành phần đã bị bắt phải
mang trong mình mọi ngữ cảnh mà nó sẽ từng được đặt vào. Ngữ cảnh khai báo một lần ở trên thay thế
toàn bộ số thuộc tính truyền vào đó.

**Đây là luật bắt buộc.** Mọi cây con hiển thị ra đều rơi vào đúng một mã dưới đây. Không có thành phần
nào nhỏ đến mức được miễn: một thanh công cụ hai nút là `DENSITY-0` đúng cùng một lý do mà một bảng giao
dịch là `DENSITY-3` — cả hai đều đang trả lời câu hỏi mật độ, chỉ có một bên trả lời **thành lời**.
Câu "có mỗi một thành phần thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, và nó bị bỏ qua bằng cách
thêm một thuộc tính truyền vào kích thước.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `DENSITY-0` | Không khai báo gì; thừa hưởng mật độ của ngữ cảnh bao ngoài | *không khai báo class CSS* |
| `DENSITY-1` | Thoáng: người đọc dừng lại ở **một** thứ để đọc hoặc để bị thuyết phục | `[--density:1]` |
| `DENSITY-2` | Mặc định: một công việc với **vài** thành phần | `[--density:2]` |
| `DENSITY-3` | Chặt: quét, so sánh, thao tác trên **rất nhiều** thành phần cùng lúc | `[--density:3]` |

Khai báo này **không vẽ ra gì cả**, và đó là chủ ý. Mọi thứ mà mật độ định vẽ thì đã có chủ khác:
khoảng cách giữa các phần tử giữa các phần tử cùng cấp thuộc về luật quan hệ, khoảng đệm bên trong của một ranh giới thuộc về luật ranh giới, cỡ chữ
của một dòng thuộc về luật sở hữu dòng. Nếu mật độ tự vẽ, nó đang phủ quyết ba mô-đun khác từ xa.
Cho nên mật độ **khai báo**, còn các thành phần lặp lại bên trong vùng thì **đọc** khai báo đó và tự
viết nhịp của mình.

### Nhịp mà mỗi mã ấn định

Mật độ chỉ điều khiển **những gì lặp lại**. Thứ chỉ xuất hiện một lần, ở một cỡ, tại một chỗ thì
không lặp và không thuộc thẩm quyền của mật độ.

| Thành phần lặp lại | `DENSITY-1` | `DENSITY-2` | `DENSITY-3` |
|---|---|---|---|
| Hộp thành phần điều khiển (nút, ô nhập liệu, ô chọn, điều kiện) | `h-11 px-4` | `h-9 px-3` | `h-7 px-2` |
| Biểu tượng bên trong thành phần điều khiển | `size-5` | `size-4` | `size-3.5` |
| Nội dung đa phương tiện biến thiết kế trong một hàng lặp (ảnh đại diện, ảnh thu nhỏ) | `size-12` | `size-10` | `size-8` |
| Khoảng đệm bên trong của hàng/ô lặp lại | `p-4` | `p-3` | `p-2` |
| Khoảng đệm bên trong của ô bảng | `px-4 py-3` | `px-3 py-2` | `px-2 py-1` |

---

## `DENSITY-0` — không khai báo, thừa hưởng ngữ cảnh

**Tình huống.** Cây con này **không tự quyết** mật độ. Nó nhận mật độ từ vùng bao ngoài gần nhất đã
khai báo. Đây là câu trả lời đúng cho **gần như mọi thành phần từng được viết**: một hàng, một thẻ,
một trường nhập liệu, một nút.

**Dấu hiệu nhận biết**

- Thành phần được dùng lại ở nhiều chỗ khác nhau, và các chỗ đó không giống nhau về công việc.
- Không thể trả lời "thành phần này chặt hay thoáng" nếu chưa biết nó nằm ở đâu.
- Câu trả lời "tuỳ chỗ" là câu trả lời đúng — và nó chính là `DENSITY-0`.
- Cái đang xét là một lớp bọc bên trong một vùng đã khai báo rồi.

**Tự hỏi.** Nếu đem nguyên cây con này đặt sang một vùng có công việc khác, nó có **phải** đổi mật độ
không? Nếu có — nó không được tự khai báo, nó là `DENSITY-0`.

**Ranh giới**

- `DENSITY-2`: `DENSITY-0` là *"tiếp tục thừa hưởng"*; `DENSITY-2` là *"đặt lại về mặc định, dù
  bên ngoài là gì"*. Hai câu này ngược nhau. Một biểu mẫu nằm trong một bảng `DENSITY-3` mà để `DENSITY-0`
  thì ô nhập liệu sẽ tụt xuống `h-7` — nó phải khai báo `DENSITY-2` **thành lời**.
- gốc cây: cây con ngoài cùng **không được** là `DENSITY-0`, vì nó không có gì để thừa hưởng.

**Không viết `[--density:0]`.** Thừa hưởng ngữ cảnh là **trạng thái không quyết định**, không phải một
bậc mật độ bằng không. Mã `DENSITY-0` là mã tình huống, không phải tên class CSS.

**Tình huống nghiệp vụ hay gặp.** Hàng danh sách dùng chung · thẻ sản phẩm · trường nhập liệu trong biểu mẫu · nút
hành động · nhãn trạng thái trạng thái · ô của bảng · phần tử của trình đơn · ảnh đại diện kèm tên · mọi thành phần nằm
trong thư viện dùng chung · mọi lớp bọc `flex`/`grid` bên trong một vùng đã khai báo.

---

## `DENSITY-1` — thoáng, để đọc và để thuyết phục

**Tình huống.** Người đọc đang **dừng lại ở một thứ**. Vùng này không yêu cầu họ so sánh; nó yêu cầu
họ hiểu, hoặc đồng ý.

**Dấu hiệu nhận biết**

- Vùng có **một** thông điệp chính, hoặc **một** quyết định cần đưa ra.
- Số thành phần cùng hình dạng rất ít — thường dưới bốn, và chúng không phải để so sánh chi tiết.
- Nội dung là văn xuôi, là lời chào, là lời mời, hoặc là một bước trong quy trình dẫn dắt.
- Thêm thành phần thứ hai mươi vào vùng này là vô nghĩa; vùng không được thiết kế để chứa nhiều.

**Tự hỏi.** Người đọc ở đây có đang **so sánh** thứ gì với thứ gì không? Nếu không, và họ đang dừng
lại ở một thứ duy nhất — `DENSITY-1`.

**Ranh giới**

- `DENSITY-2`: `DENSITY-2` vẫn là **làm việc** — điền, sửa, xác nhận, xem chi tiết. `DENSITY-1` là
  **đọc hoặc bị thuyết phục**. Một biểu mẫu cài đặt sáu trường là `DENSITY-2` kể cả khi nó đứng một mình
  trên trang; nó là việc phải làm, không phải bài phải đọc.
- `DENSITY-3`: không bao giờ kề nhau trực tiếp. Nếu ai đó phân vân giữa hai mã này thì họ chưa nêu
  công việc của người đọc.

**Không phải bằng chứng.** "Nhìn cho sang", "cho nó thở", "khoảng trắng đẹp hơn", một ảnh chụp màn
hình, một màn hình rộng. Bằng chứng duy nhất là công việc của người đọc.

**Tình huống nghiệp vụ hay gặp.** Trang giới thiệu sản phẩm · khối giá và gói dịch vụ · trang bài
viết dài · màn hình chào và hướng dẫn ban đầu từng bước · trạng thái rỗng có lời mời hành động · màn hình
xác nhận sau khi đặt hàng · trang cảm ơn · một bước duy nhất trong luồng thanh toán · trang lỗi có
hướng dẫn.

---

## `DENSITY-2` — mặc định

**Tình huống.** Người đọc đang **làm việc với vài thành phần**: xem một hồ sơ, sửa một biểu mẫu, đọc
chi tiết một đơn hàng. Có nhiều thứ trên màn hình, nhưng chúng khác nhau, và không ai quét chúng
theo cột.

**Dấu hiệu nhận biết**

- Các thành phần **khác hình dạng nhau**: một cụm nhận diện, một nhóm trường, một khối tóm tắt.
- Người đọc thao tác lần lượt, không đọc lướt theo chiều dọc.
- Số lượng thành phần cùng loại là hữu hạn và không phụ thuộc dữ liệu — sáu trường vẫn là sáu trường.
- Đây cũng là mật độ mà **gốc ứng dụng** khai báo.

**Tự hỏi.** Người đọc có đang **thao tác lần lượt** trên một số ít thành phần khác nhau, thay vì quét
một danh sách đồng dạng không?

**Ranh giới**

- `DENSITY-1`: xem trên.
- `DENSITY-3`: hỏi số lượng **và** hỏi động tác. Mười dòng người đọc *đọc từng dòng* là `DENSITY-2`;
  mười dòng người đọc *so sánh cột này với cột kia* là `DENSITY-3`. Số lượng một mình không đủ; động
  tác so sánh mới là dấu hiệu.
- `DENSITY-0`: xem phần `DENSITY-0`. `DENSITY-2` là **đặt lại thành lời**, `DENSITY-0` là im lặng.

**Đây là mã mặc định khi phân vân.** Nếu hai mã cùng hợp lý và bên yêu cầu chưa nói rõ họ cần đọc hay
cần quét, chọn `DENSITY-2`.

**Tình huống nghiệp vụ hay gặp.** Biểu mẫu cài đặt tài khoản · trang chi tiết một đơn hàng · hồ sơ người
dùng · trang tạo mới một bản ghi · hộp thoại xác nhận có nội dung · khung chi tiết bên phải · thẻ tab thông
tin chung · gốc của ứng dụng.

---

## `DENSITY-3` — chặt, cho danh sách dài và bảng

**Tình huống.** Người đọc đang **quét, so sánh hoặc thao tác hàng loạt** trên rất nhiều thành phần
cùng hình dạng. Mỗi hàng thừa ra đều đẩy hàng kế tiếp ra khỏi tầm mắt, và làm hỏng chính động tác so
sánh mà vùng này tồn tại để phục vụ.

**Dấu hiệu nhận biết**

- Số thành phần **do dữ liệu quyết định**, không do thiết kế quyết định: có thể là 3, có thể là 3000.
- Các thành phần **cùng một hình dạng**, và giá trị nằm thẳng cột với nhau.
- Người đọc tìm một dòng trong nhiều dòng, hoặc so hai dòng với nhau.
- Có phân trang, cuộn ảo, sắp xếp, lọc, hoặc chọn nhiều.

**Tự hỏi.** Nếu mỗi thành phần cao thêm một chút, người đọc có **mất đi khả năng so sánh** không?

**Ranh giới**

- `DENSITY-2`: xem trên.
- **sàn cảm ứng**: nếu các thành phần được **bấm bằng ngón tay**, `DENSITY-3` không được kéo vùng
  chạm xuống dưới ngưỡng tối thiểu. Vùng đó ít nhất là `DENSITY-2`.

**Chặt không phải là bớt thông tin.** Bỏ một trường đi là quyết định về **mức độ hé lộ**, không phải
về mật độ. Mật độ chỉ đổi độ chặt của cùng một lượng thông tin.

**Tình huống nghiệp vụ hay gặp.** Bảng giao dịch · danh sách đơn hàng · sổ nhật ký hệ thống · kết quả
tìm kiếm dạng bảng · bảng xếp hạng · lệnh bảng màu · cây thư mục ở thanh bên · thanh công cụ toàn biểu tượng ·
danh sách chọn nhiều có hộp kiểm · bảng so sánh gói · inbox.

---

## Luật

1. **Ngữ cảnh khai báo mật độ; thành phần không bao giờ tự xin.** Không có thuộc tính truyền vào `size`, `dense`,
   `compact` trên thành phần.
2. Một vùng khai báo **một** mật độ. Cây con cần mật độ khác là **một vùng mới**, và nó phải khai báo
   thành lời.
3. Khai báo được viết **ở chỗ vùng bắt đầu**, không rắc lên mọi lớp bọc bên trong.
4. Cây con ngoài cùng **bắt buộc** phải khai báo. `DENSITY-0` ở gốc là lỗi: không có gì để thừa hưởng.
5. Mật độ chỉ điều khiển **những gì lặp lại**. Nó không đụng vào khoảng cách giữa các phần tử giữa phần tử cùng cấp, không đụng vào
   khoảng đệm bên trong của một ranh giới, không đụng vào cỡ chữ của một dòng.
6. Mật độ đổi **độ chặt**, không đổi **lượng thông tin**. Bỏ bớt trường là việc của luật hé lộ.
7. Khung chờ, rỗng, lỗi và có dữ liệu của cùng một vùng dùng chung một mã.
8. Nếu hai mã cùng hợp lý, chọn `DENSITY-2`; chỉ hỏi khi bên yêu cầu nói rõ về khối lượng đọc hoặc ý
   đồ thuyết phục.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Vùng lồng có công việc khác.** Một bảng nằm trong một trang thoáng khai báo `DENSITY-3` **thành
  lời**. Nó không thừa hưởng `DENSITY-1` rồi đi bù trừ từng phần tử một.
- **Đặt lại thành lời.** Cây con cần mặc định trở lại bên trong một vùng chặt thì khai báo `DENSITY-2`.
  Không khai báo gì là `DENSITY-0`, nghĩa là "tiếp tục thừa hưởng" — ngược hẳn với đặt lại.
- **Phần tử chồng lớp.** Trình đơn, cửa sổ nổi, bộ chọn mở ra từ một thành phần điều khiển thì thừa hưởng mật độ của **vùng đã mở nó**,
  không phải của lớp mà nó hiển thị vào. Công việc của người đọc không đổi chỉ vì cái lớp đổi. Nếu nội
  dung phần tử chồng lớp tự nó là một danh sách dài để quét, nó khai báo `DENSITY-3` **vì lý do đó**, không phải
  vì nó là phần tử chồng lớp.
- **Sàn cảm ứng.** `DENSITY-3` không bao giờ kéo một thành phần tương tác xuống dưới ngưỡng vùng chạm
  tối thiểu. Vùng có thành phần được bấm bằng ngón tay ít nhất là `DENSITY-2`; một phiên bản chặt hơn
  của vùng đó là **một vùng khác theo loại con trỏ**, không phải một thành phần điều khiển nhỏ hơn.
- **Thiết kế đáp ứng.** Điểm ngắt **không** đổi mật độ. Nó đổi trục, đổi số cột, đổi thứ được hiện. Mật độ
  chỉ đổi khi **công việc** của vùng đổi theo — ví dụ một bảng trở thành chồng bản ghi đơn lẻ trên
  màn hình hẹp dùng cảm ứng.
- **Hai mã cùng khớp.** Lấy `DENSITY-2`. Chỉ hỏi **một** câu phân định khi bên yêu cầu nói rõ khối
  lượng đọc hoặc ý đồ thuyết phục.
