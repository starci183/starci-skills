---
id: fe-principles-surface-in-surface-vi
title: vi.md
slug: /gates/principles/surface-in-surface/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống SURFACE-IN-SURFACE-N, nhận diện bằng nghiệp vụ chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `surface-in-surface`

# Bề mặt in bề mặt

Bề mặt là **ranh giới** mà một vùng chứa tự nhận. Vẽ một ranh giới nghĩa là tuyên bố:

> Những thứ bên trong đây là **một nhóm gọi được tên**, và nhóm đó **không phải** nhóm bao quanh nó.

Ranh giới không được chọn bằng cảm giác "nhìn trống quá", "cần tách ra cho dễ đọc" hay "cho nó có
khung". Hãy nhìn vùng chứa và hỏi:

> Nó sở hữu nhóm nào mà bề mặt chứa của nó chưa sở hữu?

Trả lời được — có ranh giới. Trả lời không được — không có ranh giới. Không có đáp án ở giữa.

Mô-đun này **chỉ** quyết định quyền sở hữu ranh giới. `gap`, `padding`, `margin` thuộc mô-đun khác và
không bao giờ là đầu ra ở đây.

**Đây là luật bắt buộc.** Mọi vùng chứa hiển thị ra đều rơi vào đúng một mã dưới đây, kể cả những mã
không vẽ gì. Không có kích thước nào nhỏ đến mức được miễn: một đoạn mô tả hai dòng nằm trong thẻ là
`SURFACE-IN-SURFACE-4`, đúng cùng một lý do mà một bảng hàng trải ngang trang là
`SURFACE-IN-SURFACE-2`. Câu "chỉ là cái div bọc thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, và
cũng chính là cách một trang có ba đường viền cùng nói một điều.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `SURFACE-IN-SURFACE-1` | Một đối tượng độc lập nằm thẳng trên nền trang | `rounded-2xl bg-card shadow-surface` |
| `SURFACE-IN-SURFACE-2` | Một tập hàng so sánh được, ở cấp trang | `overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border` |
| `SURFACE-IN-SURFACE-3` | Phần nội dung chỉ gọi tên cho các phần tử ngang hàng đã tự có ranh giới | `bg-background shadow-none` |
| `SURFACE-IN-SURFACE-4` | Quan hệ nhóm trùng bề mặt chứa, thường, hoặc không gọi được tên | `bg-transparent shadow-none` |
| `SURFACE-IN-SURFACE-5` | Một tập liền mạch riêng, gọi được tên, nằm trong bề mặt khác | `overflow-hidden rounded-xl border border-border bg-transparent shadow-none` |
| `SURFACE-IN-SURFACE-6` | Một hành động thường, cục bộ, nằm trong bề mặt đã có | `border border-border bg-transparent text-foreground` |

Thứ tự mã đi **từ nền trang vào trong**. Mã `1`–`3` quyết định trang được vẽ gì; mã `4`–`6` quyết
định khi đã có một bề mặt bao quanh thì bên trong còn được vẽ gì.

---

## `SURFACE-IN-SURFACE-1` — một đối tượng độc lập trên nền trang

**Tình huống.** Một thứ đứng thẳng trên nền trang, tự nó là **một đối tượng nghiệp vụ hoàn chỉnh**:
gọi được tên, liệt kê được thành viên, có trạng thái riêng và có kết quả riêng. Nó nhận một ranh giới
cấp trang, và ranh giới đó là **độ nổi** — nền thẻ cộng bóng, **không** đường viền.

**Dấu hiệu nhận biết**

- Đặt tên cho nó bằng một danh từ nghiệp vụ được, không phải bằng vị trí ("cái khối bên phải").
- Nó có thể tự tải, tự rỗng, tự lỗi mà phần còn lại của trang vẫn sống.
- Bề mặt chứa của nó là **nền trang**, không phải một bề mặt khác.
- Bỏ nó khỏi trang thì trang mất một chức năng, không phải mất một mảng trang trí.

**Tự hỏi.** Đối tượng này có tên, có thành viên, có trạng thái và có kết quả riêng của nó không — và
bề mặt chứa của nó có đúng là nền trang không?

**Ranh giới**

- `SURFACE-IN-SURFACE-2`: nếu nội dung bên trong là một **tập hàng so sánh được** thì đó là mã `2`;
  mã `2` là một biến thể đóng của mã `1`, thêm `overflow-hidden` và `divide-y` vì nhịp nằm trong hàng.
- `SURFACE-IN-SURFACE-3`: nếu vùng chứa **chỉ** gom những thứ đã tự có ranh giới thì nó không sở
  hữu gì thêm — mã `3`. Thẻ bọc thẻ là lỗi kinh điển của ranh giới này.
- `SURFACE-IN-SURFACE-5`: cùng một "nhóm riêng" nhưng bề mặt chứa khác nhau. Trên nền trang thì nâng nổi;
  bên trong một bề mặt thì dàn ý.

**Tình huống nghiệp vụ hay gặp.** Thẻ tóm tắt đơn hàng · khung biểu mẫu đăng ký · khối thống kê tiến độ ·
thẻ hồ sơ người dùng · khối thanh toán · thẻ khoá học trong lưới · khung bộ lọc ở cột trái · khối
"bắt đầu từ đây" của trang trống · thẻ hoá đơn · khối bản đồ kèm thông tin địa điểm.

---

## `SURFACE-IN-SURFACE-2` — một tập hàng so sánh được, ở cấp trang

**Tình huống.** Nhiều hàng **cùng loại**, đọc theo cùng một cách, so sánh được với nhau. Cả tập là
**một** đối tượng cấp trang; từng hàng **không** phải đối tượng riêng. Một ranh giới duy nhất ôm cả tập,
và ranh giới giữa các hàng do `divide-y` nói, không do khoảng trắng nói.

**Dấu hiệu nhận biết**

- Mọi hàng có cùng cấu trúc: cùng những trường, cùng thứ tự đọc.
- Thêm hay bớt một hàng không làm đổi ý nghĩa của tập.
- Người dùng đọc chúng để **so sánh** hoặc **duyệt**, không để đọc từng cái như một câu chuyện riêng.
- `overflow-hidden` là bắt buộc: nếu không, hàng đầu và hàng cuối tràn ra ngoài góc bo của tập.

**Tự hỏi.** Các hàng có so sánh được với nhau bằng cùng một tập trường không — và cả tập có phải là
một đối tượng cấp trang không?

**Ranh giới**

- `SURFACE-IN-SURFACE-1`: một đối tượng đơn lẻ có nội dung không đồng dạng thì là mã `1`. Ba hàng có
  cấu trúc khác hẳn nhau **không** phải tập liền mạch.
- `SURFACE-IN-SURFACE-3`: nếu mỗi hàng đã tự là một thẻ có ranh giới riêng thì chúng là phần tử ngang hàng, và
  cha của chúng là mã `3`.
- `SURFACE-IN-SURFACE-5`: cùng một tập liền mạch, nhưng bề mặt chứa là bề mặt khác thì xuống dàn ý.

**Tình huống nghiệp vụ hay gặp.** Bảng xếp hạng · lịch sử giao dịch · danh sách hoá đơn · danh sách
thiết bị đang đăng nhập · danh sách cài đặt · luồng tin thông báo · danh sách thành viên nhóm · danh sách tệp
đính kèm · lịch sử hoạt động.

---

## `SURFACE-IN-SURFACE-3` — phần nội dung chỉ gọi tên cho các phần tử ngang hàng đã có ranh giới

**Tình huống.** Một vùng trang có tiêu đề, nhưng **con của nó đã tự sở hữu ranh giới**. Phần nội dung chỉ
làm một việc: gọi tên. Nếu nó vẽ thêm một ranh giới nữa thì cùng một quan hệ nhóm bị tuyên bố hai lần,
và người đọc phải tự đoán khung nào mới là khung thật.

**Dấu hiệu nhận biết**

- Con trực tiếp là các thẻ, các đối tượng đã nâng nổi, hoặc các tập liền mạch.
- Phần nội dung không có trạng thái riêng ngoài trạng thái của tập con.
- Xoá ranh giới của phần nội dung đi thì không mất thông tin nào — chỉ mất một cái khung.
- Phần nội dung dùng đúng **nền trang**, nên các con nổi lên trên nền đó.

**Tự hỏi.** Con của nó đã tự có ranh giới chưa? Nếu rồi, phần nội dung này còn sở hữu cái gì?

**Ranh giới**

- `SURFACE-IN-SURFACE-1`: nếu chính phần nội dung là một đối tượng nghiệp vụ hoàn chỉnh — có tên, thành
  viên, trạng thái, kết quả — thì nó là mã `1`, và lúc đó con của nó **không** được nâng nổi nữa.
- `SURFACE-IN-SURFACE-4`: mã `3` là ở **cấp trang** và dùng nền trang; mã `4` là ở **bên trong một
  bề mặt** và dùng nền trong suốt. Hai mã cùng "không vẽ gì" nhưng đứng ở hai chỗ khác nhau và nói
  hai điều khác nhau.

**Tình huống nghiệp vụ hay gặp.** "Khoá học của tôi" + lưới thẻ khoá học · "Thiết bị" + các thẻ thiết
bị · "Gói dịch vụ" + ba thẻ giá · thẻ tab khung chứa các thẻ ngang hàng · vùng bảng điều khiển gom nhiều khối
thống kê · "Kết quả tìm kiếm" + danh sách kết quả đã có khung riêng.

---

## `SURFACE-IN-SURFACE-4` — trùng quan hệ nhóm, thường, hoặc không gọi được tên

**Tình huống.** Vùng chứa nằm **bên trong** một bề mặt đã có (thẻ, outlined nhóm, phần tử chồng lớp) và
không sở hữu nhóm nào khác bề mặt chứa. Có ba đường dẫn tới đây, và cả ba cho cùng một kết quả:

1. **Trùng** — nội dung thuộc đúng nhóm mà bề mặt chứa đã tuyên bố.
2. **Thường** — chỉ là nội dung, không phải một nhóm.
3. **Không gọi được tên** — có thể là một nhóm, nhưng chưa ai nêu được tên, thành viên, trạng thái và
   kết quả của nó.

**Dấu hiệu nhận biết**

- Bạn không đặt được tên cho nhóm mà không lặp lại tên của bề mặt chứa.
- Vùng chứa tồn tại vì lý do kỹ thuật: để đặt `flex-col`, để bọc một map, để nhận một ref.
- Nội dung bên trong không có trạng thái tải riêng, không rỗng riêng, không lỗi riêng.
- Phần tử chồng lớp đã sở hữu ranh giới của cả tác vụ; mọi thứ thường bên trong nó rơi vào đây.

**Tự hỏi.** Ranh giới này sở hữu nhóm nào mà bề mặt chứa hiện tại chưa sở hữu? Nếu không nêu được — mã `4`.

**Ranh giới**

- `SURFACE-IN-SURFACE-5`: mã `5` đòi một quan hệ nhóm **gọi được tên** và **so sánh được thành viên**.
  Không nêu được thì không được lên mã `5`; DOM lồng nhau **không** phải bằng chứng quan hệ nhóm.
- `SURFACE-IN-SURFACE-3`: mã `3` ở cấp trang, dùng nền trang. Mã `4` ở trong bề mặt, dùng nền
  trong suốt.
- `SURFACE-IN-SURFACE-6`: một thành phần điều khiển đơn lẻ không bao giờ được bọc bề mặt; nó đi thẳng vào mã `6`
  và không sinh ra lớp bọc.

**Đây là mặc định an toàn.** Khi thiếu dữ kiện, mã `4` là đáp án. Thêm một ranh giới không có chứng
cứ là bịa ra một nhóm không tồn tại, và cái giá phải trả rơi vào người đọc chứ không rơi vào người
viết.

**Tình huống nghiệp vụ hay gặp.** Đoạn mô tả trong thẻ · nội dung thường của hộp thoại · trường trong biểu mẫu
nằm trong khung · khối kết quả trong phần tử chồng lớp · lớp bọc chỉ để xếp cột · vùng chú thích dưới biểu đồ ·
khung chờ của bất kỳ nội dung nào ở trên · trạng thái rỗng chữ trong một thẻ đã có.

---

## `SURFACE-IN-SURFACE-5` — tập liền mạch riêng nằm trong bề mặt khác

**Tình huống.** Bên trong một bề mặt đã có, xuất hiện một **tập hàng so sánh được** thuộc về một
quan hệ nhóm **khác** với bề mặt chứa và **gọi được tên**. Tập đó cần một ranh giới, nhưng **không** được
độ nổi: trong một bề mặt, độ nổi lần hai là một lời nói dối về độ sâu. Nó nhận **một** đường viền,
nền trong suốt, không bóng.

**Dấu hiệu nhận biết**

- Các hàng bên trong so sánh được với nhau (cùng trường, cùng cách đọc).
- Nhóm có tên riêng, khác tên của bề mặt chứa.
- Nhóm có thể rỗng riêng, lỗi riêng, tải riêng.
- Bề mặt chứa vẫn còn nhiều nội dung khác ngoài nhóm này — nếu không, nhóm này chính là bề mặt chứa.

**Tự hỏi.** Tập này gọi tên được, và tên đó có khác tên của bề mặt chứa không?

**Ranh giới**

- `SURFACE-IN-SURFACE-4`: không gọi được tên thì phẳng. Đây là ranh giới bị vi phạm nhiều nhất.
- `SURFACE-IN-SURFACE-2`: cùng một tập liền mạch; bề mặt chứa là nền trang thì nâng nổi, bề mặt chứa là bề mặt thì
  dàn ý. **Không bao giờ cả hai.**
- `SURFACE-IN-SURFACE-1`: mã `1` không tồn tại bên trong một bề mặt. Thẻ trong thẻ là lỗi, không
  phải một lựa chọn.

**Chỉ quan hệ nhóm liền mạch mới được lồng ranh giới.** Một nhóm lồng gồm những phần **không** đồng dạng
chưa có mã trong bộ từ vựng này; nó là mã `4` cho tới khi có đủ ca thật để đề xuất đổi luật. Ghi nhận
điều này ở `audit.md` như một rủi ro còn mở, không phải một chỗ trống để tự điền.

**Tình huống nghiệp vụ hay gặp.** Danh sách bài học bên trong thẻ khoá học · danh sách tệp đính kèm
trong hộp thoại · các dòng chi tiết đơn hàng trong khung thanh toán · danh sách người tham gia trong
thẻ sự kiện · lịch sử thay đổi trong ngăn trượt chi tiết · các dòng phân bổ chi phí trong thẻ hoá đơn.

---

## `SURFACE-IN-SURFACE-6` — một hành động thường nằm trong bề mặt

**Tình huống.** Một thành phần điều khiển nằm trong một bề mặt đã có, phục vụ chính bề mặt chứa đó, và **chưa ai chứng
minh** nó là kết quả chính. Nó nhận cách thể hiện thứ cấp: một đường viền, nền trong suốt, chữ màu tiền cảnh
— đủ để bấm được, không đủ để cạnh tranh với bề mặt chứa.

**Dấu hiệu nhận biết**

- Bề mặt chứa của thành phần điều khiển đã là một bề mặt (thẻ, outlined nhóm, phần tử chồng lớp).
- Thành phần điều khiển làm một việc cục bộ: thử lại, xem thêm, sao chép, tải xuống, huỷ.
- Chưa có tài liệu nào nêu nó là kết quả chính duy nhất của bề mặt chứa.

**Tự hỏi.** Đã có ai chứng minh đây là kết quả chính duy nhất của bề mặt chứa chưa? Chưa — thì thứ cấp.

**Ranh giới**

- `SURFACE-IN-SURFACE-4`: một thành phần điều khiển **không phải** một nhóm, nên nó không sinh ra lớp bọc bề mặt.
  Bọc một cái nút bằng một cái khung là tuyên bố một quan hệ nhóm chỉ có một thành viên.
- nâng cấp: chỉ [cảm nhận về hành động](../../../senses/call-to-action/INDEX.md) mới được nâng nó lên chính.
  Vị trí dưới-phải, chữ to, hay việc nó là thành phần điều khiển duy nhất **đều không** phải bằng chứng.

**Tình huống nghiệp vụ hay gặp.** Nút "Thử lại" trong thẻ lỗi · "Xem tất cả" ở chân thẻ danh sách ·
"Sao chép mã" trong khung · "Tải hoá đơn" trong dòng giao dịch · "Huỷ" trong phần cuối hộp thoại · "Đổi
ảnh" trong thẻ hồ sơ · "Xem chi tiết" trong thẻ tóm tắt.

---

## Luật

1. Ranh giới là một **quan hệ nhóm tuyên bố**, không phải trang trí.
2. Bề mặt nằm thẳng trên trang dùng `bg-card` và độ nổi, **không** đường viền.
3. Ranh giới hợp lệ bên trong một bề mặt khác dùng **một** `border-border`, nền trong suốt, không
   bóng.
4. Con trùng quan hệ nhóm với bề mặt chứa phải phẳng.
5. Quan hệ nhóm không gọi được tên cũng phẳng; **không đoán** ranh giới.
6. Phần nội dung chứa phần tử ngang hàng đã có ranh giới dùng nền trang, không dựng thêm thẻ bên ngoài.
7. Phần tử chồng lớp đã sở hữu ranh giới của tác vụ; nội dung thường bên trong nó phẳng.
8. Một thành phần điều khiển đơn lẻ **không** phải một bề mặt và không được bọc.
9. Hành động thường bên trong bề mặt dùng cách thể hiện thứ cấp; chỉ cảm nhận về hành động mới nâng cấp.
10. Trạng thái và khung nhìn **không** đổi quyền sở hữu ranh giới. Khung chờ vẽ đúng số đối tượng mà nội dung
    thật vẽ.
11. Một vùng chứa chỉ tuyên bố **một** ranh giới. Hai tuyên bố cần hai cấp lồng nhau, không phải một
    className dài hơn.
12. Mô-đun này **không** được trả về `gap`, `padding` hay `margin`.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Bề mặt chứa đã gọi đúng tên của lồng nhau tập liền mạch.** Vẫn là `SURFACE-IN-SURFACE-5`; chỉ **nhãn lặp** bên
  trong dàn ý được phép bỏ. Ranh giới ở lại vì quan hệ nhóm vẫn khác bề mặt chứa — thứ thừa là cái nhãn thứ
  hai, không phải cái khung.
- **Không gọi được tên quan hệ nhóm.** `SURFACE-IN-SURFACE-4`, luôn luôn. Nếu bên yêu cầu vẫn muốn một
  ranh giới, hỏi **đúng một câu** rồi dừng: *"Ranh giới này sở hữu nhóm nào khác bề mặt chứa hiện tại?"*
- **Hành động thường trong bề mặt.** `SURFACE-IN-SURFACE-6`, kể cả khi nó là thành phần điều khiển duy nhất, kể cả
  khi nó nằm ở góc dưới bên phải.
- **Có yêu cầu nâng cấp lên chính.** Giữ `SURFACE-IN-SURFACE-6` cho tới khi
  [cảm nhận về hành động](../../../senses/call-to-action/INDEX.md) chứng minh được một kết quả chính ở cấp bề mặt chứa.
- **Hai đối tượng có đường viền chạm nhau.** Giữ hai ranh giới tách rời. Nằm cạnh nhau **không** phải
  quan hệ nhóm; chỉ tính so sánh được của hàng mới biến chúng thành `SURFACE-IN-SURFACE-2`.
- **Đổi trạng thái.** Đang tải, rỗng, lỗi giữ nguyên mã của trạng thái đã settle. Khung chờ làm phẳng
  một thẻ, hoặc trạng thái lỗi nâng một khối phẳng thành thẻ, là nói dối về quyền sở hữu đúng lúc
  người dùng ít có khả năng kiểm chứng nhất.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi **bề mặt chứa thật sự đổi**. Màn hình hẹp đi không biến một đối tượng thành
  một phần nội dung, và cũng không biến một phần nội dung thành một thẻ.
