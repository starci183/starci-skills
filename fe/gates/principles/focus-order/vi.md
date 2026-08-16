---
id: fe-principles-focus-order-vi
title: vi.md
slug: /gates/principles/focus-order/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống FOCUS-N, nhận diện bằng đường đi bàn phím chứ không bằng bố cục nhìn thấy.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `focus-order`

# Thứ tự lấy tiêu điểm

Thứ tự lấy tiêu điểm là **đường đi của bàn phím** qua một màn hình: nhấn `Tab` thì con trỏ dừng ở đâu, dừng
theo thứ tự nào, nhìn thấy nó đang đứng ở đâu, và nó đi đâu khi một lớp mở ra rồi đóng lại.

Đường đi đó **chính là thứ tự DOM**. Không phải thứ tự nhìn thấy, không phải thứ tự trong tệp CSS,
không phải thứ tự bạn cảm thấy hợp lý.

> Thứ tự trong mã đánh dấu là thứ tự người dùng bàn phím sẽ đi qua.

**Luật này nói về THỨ TỰ DOM, không phải về `className`.** Sáu trên tám mã dưới đây **không phát ra
class CSS nào cả**: chúng được quyết bởi vị trí của nút DOM, bởi một thuộc tính, hoặc bởi đoạn mã chạy khi
một lớp mở ra và đóng lại. `order-2`, `flex-row-reverse`, `grid-cols-*`, `absolute`, `float` chỉ dời
**điểm ảnh**; đường đi bàn phím vẫn nằm nguyên chỗ cũ. Đó chính là lý do một màn hình nhìn hoàn toàn
đúng mà vẫn không dùng được bằng bàn phím: mắt đọc theo cột trái sang phải, còn `Tab` thì nhảy theo
thứ tự bạn đã viết trong tệp.

Khi thứ tự nhìn thấy và thứ tự đọc mâu thuẫn, **mã đánh dấu phải dời**. Class CSS không bao giờ thắng cuộc
tranh cãi đó.

**Đây là luật bắt buộc.** Bất cứ thứ gì hiển thị ra đều làm phát sinh ít nhất một quyết định tiêu điểm, và
mọi quyết định đều rơi vào đúng một mã. Không có phần tử nào nhỏ đến mức được miễn: một biểu tượng trang
trí trong nút là `FOCUS-0`, đúng cùng một lý do mà một hộp thoại cài đặt là `FOCUS-3`. "Có mỗi cái biểu tượng
thôi mà", "chỉ là cái danh sách thả xuống", "ai mà di chuyển tới bằng phím Thẻ tab đó" là ba chỗ luật này bị bỏ qua nhiều nhất.

Chuẩn mà mô-đun này gánh: **2.4.3 Thứ tự lấy tiêu điểm**, **2.4.7 Tiêu điểm hiển thị**, **2.1.2 Không mắc kẹt bàn phím**,
**2.4.1 Bypass Các khối**.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `FOCUS-0` | Nút DOM **không được** là điểm dừng: trang trí, trùng lặp, hoặc nằm sau một lớp đang bị khoá | *không class CSS* — không `tabindex`, thêm `aria-hidden` / `inert` khi cần |
| `FOCUS-1` | Nút DOM là điểm dừng và lấy vị trí từ **chỗ nó đứng trong DOM** | *không class CSS* — vị trí chính là câu trả lời |
| `FOCUS-2` | Nút DOM có thể giữ tiêu điểm, nên phải **nhìn thấy được** lúc nó đang giữ | `focus-visible:outline-2 focus-visible:outline-offset-2` |
| `FOCUS-3` | Một lớp chiếm cả màn hình, nên đường đi bị **giam** trong lớp đó | *không class CSS* — `role="dialog" aria-modal="true"` + `inert` phần còn lại |
| `FOCUS-4` | Một lớp vừa đóng, tiêu điểm **trả về** đúng chỗ đã mở nó | *không class CSS* — giữ ref rồi `.focus()` |
| `FOCUS-5` | Khối lặp lại chắn giữa đầu tài liệu và nội dung thật | `sr-only focus:not-sr-only focus:absolute …` |
| `FOCUS-6` | Một thành phần tiện ích hợp thành là **một** điểm dừng; phím mũi tên đi bên trong | *không class CSS* — `tabindex` `0` cho thành viên đang chọn, `-1` cho phần còn lại |
| `FOCUS-7` | Nội dung mới vừa xuất hiện, tiêu điểm phải **được đưa tới** đó | *không class CSS* — `tabIndex={-1}` trên đích rồi `.focus()` |

---

## `FOCUS-0` — không nằm trong đường đi bàn phím

**Tình huống.** Nút DOM hiện ra trên màn hình nhưng **không được** là một điểm dừng: nó chỉ trang trí,
nó lặp lại một đích đến đã có, hoặc nó nằm dưới một lớp đang chiếm màn hình.

**Dấu hiệu nhận biết**

- Bỏ nó đi thì không mất **hành động** nào, chỉ mất trang trí.
- Nó dẫn tới đúng nơi mà một thành phần điều khiển ngay cạnh đã dẫn tới.
- Nó đang bị lớp phủ che, hoặc nằm trong khung/thẻ tab/ngăn trượt đang **đóng**.
- Người dùng bàn phím dừng ở đó và không biết mình đang ở đâu, cũng không làm được gì.

**Tự hỏi.** Nếu dừng ở đây, người dùng có làm được một việc gì mà chỗ khác chưa cho làm không? Nếu
không — `FOCUS-0`.

**Ranh giới**

- `FOCUS-1`: `FOCUS-1` là nút DOM **phải** dừng được. Câu hỏi phân định là *có hành động không*, không
  phải *có nhìn thấy không*.
- `FOCUS-6`: thành viên không được chọn trong một danh sách thẻ tab mang `tabindex="-1"` nhưng vẫn **tới được
  bằng phím mũi tên** — đó là `FOCUS-6`, không phải `FOCUS-0`. `FOCUS-0` là không tới được bằng bàn
  phím, bằng bất kỳ phím nào.
- `FOCUS-3`: phần nền bị `inert` khi hộp thoại mở **là** `FOCUS-0` xét theo từng nút DOM, nhưng quyết
  định "khoá cả nền" thuộc về `FOCUS-3`. Mã theo **quyết định**, không theo cây.

**Tình huống nghiệp vụ hay gặp.** Biểu tượng trang trí trong nút · ảnh đại diện ảnh trong thẻ đã có một liên kết
tiêu đề · ảnh nền vùng nổi bật · `<div>` bọc chỉ để căn bố cục · slide chưa hiện của băng chuyền · khung của thẻ tab
không được chọn · ngăn trượt đã đóng nhưng vẫn nằm trong DOM để chạy hoạt ảnh · toàn bộ nền khi hộp thoại
đang mở · nút "sao chép" trùng với liên kết đã có · dòng phân cách · nhãn trạng thái chỉ để đọc.

---

## `FOCUS-1` — vị trí trong DOM chính là vị trí trong đường đi

**Tình huống.** Nút DOM là một thành phần điều khiển thật, và nó dừng đúng ở chỗ nó đứng trong mã đánh dấu. Đây là mã mặc
định, chiếm phần lớn mọi màn hình.

**Dấu hiệu nhận biết**

- Nó là `a[href]`, `button`, `input`, `select`, `textarea`, hoặc một nút DOM có `tabindex="0"` thật sự
  đang làm việc của một thành phần điều khiển.
- Đọc tệp từ trên xuống thì thứ tự các thành phần điều khiển **trùng** với thứ tự người ta sẽ thao tác.
- Không có `order-*`, `*-reverse`, `absolute` hay lưới cách đặt nào đang kéo nó đi chỗ khác so với
  mắt nhìn.

**Tự hỏi.** Đọc mã đánh dấu từ trên xuống, thứ tự dừng có trùng với thứ tự đọc bằng mắt không? Nếu không,
đây **chưa** phải `FOCUS-1` — mã đánh dấu phải dời trước.

**Ranh giới**

- `FOCUS-0`: xem trên.
- `FOCUS-6`: nếu các thành phần điều khiển là **phần tử ngang hàng trong một thành phần tiện ích** (thẻ tab, thanh công cụ, nút chọn, trình đơn, lưới), cả cụm
  chỉ được một điểm dừng — `FOCUS-6`. Ba nút hành động độc lập cạnh nhau thì mỗi nút là một
  `FOCUS-1`.
- `FOCUS-2`: `FOCUS-1` trả lời *dừng ở đâu*; `FOCUS-2` trả lời *có nhìn thấy chỗ dừng không*. Một
  nút DOM `FOCUS-1` **luôn** kèm một quyết định `FOCUS-2`.

**Tình huống nghiệp vụ hay gặp.** Biểu mẫu đăng nhập · nút hành động trong phần đầu thẻ · liên kết trong danh
sách kết quả · ô tìm kiếm · hộp kiểm điều khoản · nút phân trang · đường dẫn phân cấp · liên kết trong phần cuối ·
nút "tải thêm" · trường nhập liệu trong bảng chỉnh sửa được.

---

## `FOCUS-2` — nhìn thấy tiêu điểm đang đứng ở đâu

**Tình huống.** Nút DOM có thể giữ tiêu điểm. Vậy thì khi nó đang giữ, người dùng phải **nhìn thấy** điều
đó. Đây là mã đi kèm bắt buộc của mọi nút DOM `FOCUS-1`, mọi thành viên `FOCUS-6`, và mọi đích hạ cánh
của `FOCUS-3`, `FOCUS-4`, `FOCUS-7`.

**Dấu hiệu nhận biết**

- Nhấn `Tab` liên tục mà có lúc **không biết** mình đang ở đâu.
- Trong mã có `outline-none` / `focus:outline-none` mà không có gì vẽ thay.
- Chỉ có `hover:` đổi màu, còn `focus-visible:` thì không có gì.
- Chỉ báo bị viền tròn của cha cắt mất, hoặc bị `overflow-hidden` xén.

**Tự hỏi.** Chỉ nhìn màn hình, không nhìn tay, có chỉ ra được nút DOM nào đang giữ tiêu điểm không?

**Ranh giới**

- `FOCUS-1`: xem trên. `FOCUS-1` không nói gì về hình dạng; `FOCUS-2` không nói gì về thứ tự.
- `FOCUS-0`: nút DOM `FOCUS-0` **không bao giờ** làm phát sinh `FOCUS-2`. Vẽ vòng cho thứ không dừng
  được là dấu hiệu ai đó đã phân loại sai ngay từ đầu.
- **`hover` không thay được `focus`.** Chuột và bàn phím là hai đường đi khác nhau; một trạng thái
  không phục vụ được cả hai.

**Tình huống nghiệp vụ hay gặp.** Nút chính trên nền tối · liên kết trong đoạn văn · thẻ bấm được ·
biểu tượng-nút trong thanh công cụ · hàng của bảng chọn được · thẻ tab · phần tử trong trình đơn · nút bên trong một cụm có
`overflow-hidden` · thành phần điều khiển nằm trên ảnh · nút trong bám dính thanh.

---

## `FOCUS-3` — giam đường đi trong lớp chiếm cả màn hình

**Tình huống.** Một lớp mở ra và **chiếm quyền cả màn hình**: phần nền không còn dùng được nữa. Khi
đó đường đi bàn phím phải nằm gọn trong lớp, `Tab` ở cuối quay về đầu, và phần nền bị khoá.

**Dấu hiệu nhận biết**

- Có lớp nền mờ, và bấm ra ngoài thì đóng.
- Phải trả lời hoặc đóng thì mới làm tiếp được việc phía sau.
- Nếu **không** giam, `Tab` sẽ chạy ra sau lớp phủ và người dùng bàn phím thao tác lên thứ họ không
  nhìn thấy.

**Tự hỏi.** Trong lúc lớp này mở, phần nền có còn dùng được không? Nếu **không** còn — `FOCUS-3`.

**Ranh giới**

- `FOCUS-7`: lớp **không** chiếm màn hình (trình đơn, cửa sổ bật lên gợi ý, trình soạn thảo tại chỗ) thì **cấm giam**. Nó
  chỉ đưa tiêu điểm vào — `FOCUS-7` — rồi vẫn thuộc đường đi của trang. Giam một lớp không sở hữu màn
  hình chính là bàn phím bẫy mà 2.1.2 cấm.
- `FOCUS-4`: `FOCUS-3` là lúc **mở và đang mở**; `FOCUS-4` là lúc **đóng**. Một hộp thoại luôn có cả
  hai, và chúng là hai quyết định riêng.
- **Giam chỉ hợp lệ khi thoát được.** Không có `Escape` và không có nút đóng nhìn thấy được thì đó
  không phải `FOCUS-3` — đó là một cái bẫy.

**Tình huống nghiệp vụ hay gặp.** Xác nhận xoá · biểu mẫu thanh toán trong hộp thoại · hộp thoại cài đặt · lightbox
ảnh · ngăn trượt lọc trên thiết bị di động · hướng dẫn ban đầu bắt buộc · dưới bảng trượt chọn phương thức thanh toán · hộp thoại
phiên đăng nhập hết hạn.

---

## `FOCUS-4` — trả tiêu điểm về chỗ đã mở nó

**Tình huống.** Một lớp đóng lại, hoặc một phần tử đang giữ tiêu điểm bị gỡ khỏi DOM. Tiêu điểm phải quay về
**đúng chỗ người dùng đã rời đi**, chứ không rơi xuống `<body>`.

**Dấu hiệu nhận biết**

- Đóng hộp thoại xong, nhấn `Tab` thì con trỏ bắt đầu lại từ đầu trang.
- Xoá một dòng xong, không biết mình đang đứng ở đâu nữa.
- Đóng trình đơn bằng `Escape` xong, nút mở trình đơn không còn được đánh dấu.

**Tự hỏi.** Sau khi lớp này biến mất, người dùng đang đứng ở đâu — và họ có tự trả lời được câu đó
không?

**Ranh giới**

- `FOCUS-3`: xem trên.
- `FOCUS-7`: `FOCUS-4` đi **lùi**, về thứ đã gây ra lớp. `FOCUS-7` đi **tới**, về thứ vừa xuất
  hiện. Nếu đóng một hộp thoại "tạo mới" và bạn muốn nhảy tới bản ghi vừa tạo, đó là **hai** quyết định
  và bản ghi mới thắng, nhưng phải nói rõ ràng chứ không phải hệ quả tình cờ.
- **Chỗ mở đã biến mất.** Xoá một dòng thì cái nút đã mở hộp xác nhận cũng chết theo. Khi đó
  `FOCUS-4` trả về **chủ sở hữu còn sống gần nhất** của danh sách đó — dòng kế tiếp, hoặc chính cái
  danh sách — chứ tuyệt đối không phải `<body>`.

**Tình huống nghiệp vụ hay gặp.** Đóng hộp thoại · huỷ hộp thoại xác nhận · đóng trình đơn bằng `Escape` · lưu
xong trong ngăn trượt · xoá một phần tử khỏi danh sách · đóng lightbox · bỏ chế độ chỉnh sửa tại chỗ · gỡ
một bộ lọc nhãn nhỏ.

---

## `FOCUS-5` — đường tắt vượt qua khối lặp lại

**Tình huống.** Giữa đầu tài liệu và nội dung thật có một khối **lặp lại trên mọi trang**: phần đầu,
thanh điều hướng chính, đường dẫn phân cấp, thanh công cụ. Người dùng bàn phím phải có cách nhảy qua nó bằng
**một** phím dừng.

**Dấu hiệu nhận biết**

- Nút DOM đầu tiên trong `<body>` không phải nội dung, mà là điều hướng.
- Để tới được nội dung phải nhấn `Tab` hơn chục lần, và số đó lặp lại ở **mọi** trang.
- Trang nào cũng có đúng khối đó ở đúng chỗ đó.

**Tự hỏi.** Từ đầu tài liệu tới thành phần điều khiển đầu tiên của nội dung, phải đi qua bao nhiêu điểm dừng lặp
lại — và con số đó có lặp ở mọi trang không?

**Ranh giới**

- `FOCUS-1`: bỏ qua liên kết **là** một `FOCUS-1` xét theo bản thân nó, nhưng quyết định "phải có một
  đường tắt và nó phải đứng đầu tài liệu" là `FOCUS-5`.
- `FOCUS-7`: bỏ qua liên kết không tự chạy; nó chờ người dùng bấm. Còn `FOCUS-7` là tiêu điểm **tự** được
  dời đi.
- **Đứng đầu DOM, không phải đầu màn hình.** Nó là nút DOM đầu tiên trong tài liệu; `sr-only` giấu nó
  khỏi mắt và `focus:not-sr-only` mang nó trở lại. Đây là chỗ hiếm hoi trong mô-đun này mà `className`
  thật sự làm việc.

**Tình huống nghiệp vụ hay gặp.** Phần đầu + điều hướng toàn site · thanh bên điều hướng · thanh lọc lặp lại ·
biểu ngữ quảng cáo phía trên · thanh đường dẫn phân cấp · thanh công cụ của trang danh sách · phần cuối nhiều cột (đường
tắt ngược lên đầu).

---

## `FOCUS-6` — một thành phần tiện ích hợp thành là một điểm dừng

**Tình huống.** Một tập thành phần điều khiển **cùng loại, cùng vai trò**, chọn một trong nhiều: thẻ tab, thanh công cụ,
nhóm nút chọn, trình đơn, hộp danh sách, lưới. Cả cụm chỉ được **một** điểm dừng; vào rồi thì phím mũi tên đi giữa
các thành viên.

**Dấu hiệu nhận biết**

- Các thành viên là phần tử ngang hàng, đổi cho nhau được, và có đúng một thành viên đang "được chọn".
- Nếu để mỗi thành viên là một điểm dừng, riêng cái thành phần tiện ích này đã nuốt hết mười lăm lần `Tab`.
- Đọc lên thì cả cụm có một cái tên chung: "bộ lọc", "chế độ xem", "các mục".

**Tự hỏi.** Người dùng đang chọn **một trong nhiều** cùng loại, hay đang lần lượt làm **nhiều việc
khác nhau**? Chọn một trong nhiều — `FOCUS-6`.

**Ranh giới**

- `FOCUS-1`: ba nút *Lưu*, *Xem trước*, *Xoá* là ba việc khác nhau ⇒ ba `FOCUS-1`. Ba thẻ tab *Tổng
  quan*, *Hoạt động*, *Cài đặt* là một lựa chọn ⇒ một `FOCUS-6`.
- `FOCUS-0`: thành viên không được chọn mang `tabindex="-1"` nhưng **vẫn tới được bằng mũi tên**.
  `FOCUS-0` là không tới được bằng bàn phím.
- `FOCUS-3`: thành phần tiện ích hợp thành **không** giam. Ra khỏi nó bằng `Tab` phải luôn được.
- **Trạng thái phải theo được người dùng.** `tabindex="0"` chạy theo thành viên đang chọn; sau khi
  rời đi rồi quay lại, `Tab` phải rơi đúng vào thành viên đó chứ không phải thành viên đầu tiên.

**Tình huống nghiệp vụ hay gặp.** Danh sách thẻ tab · thanh công cụ định dạng · nhóm nút chọn · nhóm nút phân đoạn · trình đơn
thả xuống · hộp danh sách gợi ý · thanh chọn ngày · lưới ảnh chọn được · cây thư mục · các nhãn nhỏ lọc chọn
một.

---

## `FOCUS-7` — đưa tiêu điểm tới nội dung vừa xuất hiện

**Tình huống.** Nội dung mới xuất hiện vì một hành động của người dùng, và chỗ họ đang đứng **không
còn** trả lời được câu "giờ tôi ở đâu". Tiêu điểm phải được dời tới nội dung mới.

**Dấu hiệu nhận biết**

- Chuyển trang trong ứng dụng một trang: URL đổi, nội dung đổi, tiêu điểm vẫn nằm ở cái liên kết cũ.
- Bấm "Gửi" mà biểu mẫu lỗi: thông báo lỗi hiện ở trên đầu, tiêu điểm vẫn ở nút Gửi tận dưới.
- Bấm "Tải thêm": mười kết quả mới đã hiển thị, không ai được báo.
- Mở khung gợi ý, trình soạn thảo tại chỗ, hay một bước tiếp theo của trình hướng dẫn.

**Tự hỏi.** Sau thay đổi này, chỗ tiêu điểm đang đứng có còn giải thích được nội dung đang hiện không?

**Ranh giới**

- `FOCUS-4`: xem trên — tới, chứ không phải lùi.
- `FOCUS-3`: `FOCUS-7` **đưa vào** mà **không giam**. Lớp không sở hữu màn hình thì dừng ở
  `FOCUS-7`.
- tính đồng nhất trạng thái: khung chờ biến thành nội dung thật **không** phải `FOCUS-7`. Tiêu điểm chỉ dời khi
  người dùng **đã yêu cầu** nội dung đó.
- **Đích hạ cánh phải nhỏ.** Hạ xuống cái tiêu đề gọi tên nội dung mới, không phải cái vùng bọc nó
  — để chỉ báo `FOCUS-2` còn đọc được, thay vì thành một cái khung bao nửa màn hình.
- **Đích hạ cánh dùng `focus:`, không dùng `focus-visible:`.** Cú dời này không do người dùng gõ ra,
  nên phải luôn báo cho họ biết họ vừa bị đặt ở đâu.

**Tình huống nghiệp vụ hay gặp.** Điều hướng trong SPA · tóm tắt lỗi sau khi gửi · "tải thêm" ·
bước tiếp theo của trình hướng dẫn · kết quả tìm kiếm vừa thay · mở khung gợi ý · vào chế độ sửa tại chỗ · nội
dung thẻ tab vừa đổi khi khung không tự tiêu điểm được · thông báo thành công cần đọc ngay.

---

## Luật

1. Đường đi bàn phím **là** thứ tự DOM. Không class CSS nào dời được nó.
2. `tabindex` dương bị **cấm**. Không mã nào trong mô-đun này phát ra nó.
3. Thứ gì giữ được tiêu điểm thì phải **nhìn thấy** được lúc nó giữ.
4. `outline-none` chỉ hợp lệ khi chính nút DOM đó vẽ thứ thay thế ở cùng trạng thái.
5. Một thành phần tiện ích hợp thành là **một** điểm dừng.
6. Tiêu điểm không bao giờ bị bỏ lại trên nút DOM đã bị gỡ, bị ẩn hoặc bị disable — mỗi lần gỡ phải **gọi
   tên** người kế nhiệm.
7. Chỉ được giam ở nơi **chắc chắn** thoát ra được.
8. Nhìn thấy và tới được phải **đồng ý với nhau**: mắt không thấy thì bàn phím không tới.
9. Đường tắt là nút DOM **đầu tiên của tài liệu**, không phải nút DOM đầu tiên nhìn thấy được.
10. Khi thứ tự nhìn thấy và thứ tự đọc mâu thuẫn, **mã đánh dấu dời**, không phải class CSS đổi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Thứ tự nhìn thấy khác thứ tự đọc.** Nếu bố cục thật sự cần tóm tắt nằm trên biểu mẫu ở một khung nhìn
  và nằm dưới ở khung nhìn khác: dời DOM, hoặc hiển thị đúng một thứ tự đã chốt. Đảo bằng class CSS, hoặc
  hiển thị hai bản rồi ẩn một bản, đều **bị cấm** dưới `FOCUS-1` — bản bị ẩn hoặc vẫn đến được bằng phím Thẻ tab,
  hoặc nhân đôi mọi id trong đó.
- **Tiêu điểm lúc mới vào trang.** Chỉ được dời tiêu điểm khi màn hình có **đúng một** lý do tồn tại là một
  trường nhập liệu đó. Còn lại, đường đi bắt đầu từ đầu tài liệu, dưới `FOCUS-5`.
- **Chỗ mở đã biến mất.** `FOCUS-4` trả về chủ sở hữu còn sống gần nhất của danh sách, không bao giờ
  về `<body>`.
- **Lớp không chiếm màn hình thì không giam.** Trình đơn, cửa sổ bật lên gợi ý, trình soạn thảo tại chỗ: mở bằng `FOCUS-7`,
  đi lại bằng `FOCUS-6`, đóng bằng `FOCUS-4`, và **không bao giờ** `FOCUS-3`.
- **Tính đồng nhất trạng thái.** Khung chờ đổi thành nội dung thật **không** dời tiêu điểm.
- **Đích hạ cánh phải nhỏ.** `FOCUS-7` hạ xuống tiêu đề, không hạ xuống vùng.
- **Hoạt ảnh đóng.** Ngăn trượt còn nằm trong DOM để chạy hoạt ảnh thoát vẫn phải `inert` **ngay từ lúc
  bắt đầu đóng**, dưới `FOCUS-0` — nếu không, có một khoảng thời gian ngắn mà bàn phím thẻ tab được vào
  thứ đang biến mất.
