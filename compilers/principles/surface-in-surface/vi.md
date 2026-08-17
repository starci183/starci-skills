---
title: Surface-in-surface · Vietnamese
---

# Bề mặt trong bề mặt

## LOADS

None.


## Bản ghi

Nguyên tắc này nhận một yêu cầu viết bằng lời thường — "một cái thẻ có danh sách bài học bên trong" — rồi trả về
là, với **mỗi vùng chứa** mà yêu cầu đó ngụ ý, một mã tình huống và một className. Yêu cầu không bao
giờ nói ra một đường viền, một cái bóng hay một cái nền, và không được phép chọn chúng bằng mắt: ranh
giới suy ra từ thứ **đã** sở hữu ranh giới bao quanh vùng chứa, và từ việc vùng chứa có sở hữu một
nhóm của riêng nó hay không.

## Luật

Ranh giới là một **tuyên bố quan hệ nhóm**: nó nói "những thứ bên trong đây là một nhóm gọi được tên,
và nhóm đó không phải nhóm bao quanh nó". Chỉ vẽ ranh giới khi tuyên bố đó đúng, và vẽ theo đúng hình
thức mà bề mặt chứa cho phép.

Một đối tượng độc lập ở cấp trang được **nâng nổi**. Một nhóm lồng riêng biệt, gọi được tên, được
**dàn ý**. Một tuyên bố lồng bị trùng, tầm thường hoặc không gọi được tên thì ở **phẳng**.

Một class bề mặt chỉ nói về quyền sở hữu ranh giới. Khoảng cách, khoảng đệm trong và độ lệch thuộc mô-đun
khác và không bao giờ xuất hiện trong đầu ra của mô-đun này.

**Đây là luật bắt buộc.** Mọi vùng chứa hiển thị ra đều rơi vào đúng một mã dưới đây, kể cả những mã
không phát ra gì. Không có bố cục nào nhỏ đến mức được miễn: một đoạn mô tả hai dòng nằm trong thẻ là
`SURFACE-IN-SURFACE-4`, đúng cùng một lý do mà một tập hàng trải ngang trang là
`SURFACE-IN-SURFACE-2`. Câu "chỉ là cái div bọc thôi mà" không phải một ngoại lệ; đó là chỗ luật này
bị bỏ qua nhiều nhất, và cũng chính là cách một trang có ba đường viền cùng nói một điều.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `SURFACE-IN-SURFACE-<số>`. Mã gọi tên TÌNH HUỐNG;
cột className gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có hai mã không
vẽ ra ranh giới nhìn thấy được nào cả.

| Mã | Tình huống | className |
|---|---|---|
| `SURFACE-IN-SURFACE-1` | Một đối tượng độc lập nằm thẳng trên nền trang | `rounded-2xl bg-card shadow-surface` |
| `SURFACE-IN-SURFACE-2` | Một tập hàng so sánh được, ở cấp trang | `overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border` |
| `SURFACE-IN-SURFACE-3` | Phần nội dung chỉ gọi tên cho các phần tử ngang hàng đã tự có ranh giới | `bg-background shadow-none` |
| `SURFACE-IN-SURFACE-4` | Quan hệ nhóm trùng bề mặt chứa, tầm thường, hoặc không gọi được tên | `bg-transparent shadow-none` |
| `SURFACE-IN-SURFACE-5` | Một tập liền mạch riêng, gọi được tên, nằm trong một bề mặt đã có | `overflow-hidden rounded-xl border border-border bg-transparent shadow-none` |
| `SURFACE-IN-SURFACE-6` | Một hành động thường, cục bộ, nằm trong bề mặt đã có | `border border-border bg-transparent text-foreground` |

Thứ tự mã đi đúng theo cách người đọc gặp chúng: **từ nền trang vào trong**. Mã `1`–`3` quyết định bản
thân trang được vẽ gì; mã `4`–`6` quyết định khi đã có một bề mặt bao quanh thì bên trong còn được vẽ
gì.

`SURFACE-IN-SURFACE-4` LÀ MỘT TÌNH HUỐNG, KHÔNG PHẢI MỘT MÓN TRANG TRÍ. `bg-transparent shadow-none`
là bằng chứng viết ra rằng vùng chứa đã được phân loại và kết luận là không sở hữu gì — nó không phải
thứ sót lại, và cũng không phải cùng một sự thật với "chưa ai xét tới class nào". Một vùng chứa phẳng
mà lại mang thêm đường viền là chưa theo mã này; nó đã lặng lẽ nhảy sang `SURFACE-IN-SURFACE-5` mà
chưa chứng minh quan hệ nhóm mà mã đó đòi hỏi.

Không có mã nào cho "một nhóm lồng không phải danh sách". Chỗ trống đó là cố ý, không phải sơ suất:
quan hệ nhóm lồng duy nhất mà bộ từ vựng này thừa nhận là **một tập liền mạch gồm những thành viên so
sánh được**. Một nhóm lồng gồm những phần không đồng dạng là `SURFACE-IN-SURFACE-4` cho tới khi có đủ
ca thật để đề xuất đổi luật.

## Đọc một yêu cầu

1. **Liệt kê những vùng chứa mà yêu cầu nói ra.** "Một cái thẻ có danh sách bài học bên trong" nói ra
   hai: cái thẻ nằm trên trang, và danh sách bài học nằm trong thẻ.
2. **Không bịa ra vùng chứa mà yêu cầu không hề nhắc.** Một phần nội dung của trang, một hộp thoại hay
   một hành động ở chân thẻ không nằm trong yêu cầu đó. Giải cái được nói ra; phần còn lại giải khi nó
   xuất hiện.
3. **Giải từ ngoài vào trong**, rồi tới từng vùng chứa lồng bên trong. Bề mặt chứa của một vùng chứa
   chính là thứ mà bước trước đã trao cho một ranh giới: `page`, `card`, `outlined-group` hoặc
   `overlay`. Một vùng chứa không bao giờ thừa hưởng mã của con nó.
4. **Với mỗi vùng chứa, gọi tên bề mặt chứa, loại nội dung con và quan hệ nhóm, rồi hỏi câu hỏi** nằm
   trong phần của từng mã. Mã đầu tiên có tình huống khớp chính là đáp án. Quan hệ nhóm chỉ được coi là
   gọi được tên khi nêu ra được tên, thành viên, trạng thái riêng và kết quả riêng của nó; DOM lồng
   nhau không phải bằng chứng quan hệ nhóm.
5. **Nếu một vùng chứa đưa ra hai tuyên bố ranh giới, phải tách lồng nhau trước rồi mới chọn.** Một
   vùng chứa nhiều nhất chỉ có một tuyên bố. Nếu thiếu một dữ kiện quyết định, hỏi đúng một câu rồi
   dừng — nhưng nếu dữ kiện thiếu chính là quan hệ nhóm thì không cần hỏi: quan hệ nhóm chưa xác định
   đã là `SURFACE-IN-SURFACE-4`.

## `SURFACE-IN-SURFACE-1` — một đối tượng độc lập trên nền trang

**Khi nào gặp.** Một thứ đứng thẳng trên nền trang, tự nó là **một đối tượng nghiệp vụ hoàn chỉnh**:
gọi được tên, liệt kê được thành viên, có trạng thái riêng và có kết quả riêng. Nó nhận một ranh giới
cấp trang, và ranh giới đó là **độ nổi** — nền thẻ cộng bóng, **không** đường viền.

**Cách nhận ra**

- Đặt tên cho nó bằng một danh từ nghiệp vụ được, không phải bằng vị trí ("cái khối bên phải").
- Nó có thể tự tải, tự rỗng, tự lỗi mà phần còn lại của trang vẫn sống.
- Bề mặt chứa của nó là **nền trang**, không phải một bề mặt khác.
- Bỏ nó khỏi trang thì trang mất một chức năng, không phải mất một mảng trang trí.

**Tự hỏi.** Đối tượng này có tên, có thành viên, có trạng thái và có kết quả riêng của nó không — và
bề mặt chứa của nó có đúng là nền trang không?

**Ranh giới**

- `SURFACE-IN-SURFACE-2`: nếu nội dung bên trong là một **tập hàng so sánh được** thì đó là mã `2`;
  mã `2` là một biến thể đóng của mã `1`, thêm `overflow-hidden` và `divide-y` vì nhịp nằm trong hàng.
- `SURFACE-IN-SURFACE-3`: nếu vùng chứa **chỉ** gom những thứ đã tự có ranh giới thì nó không sở hữu
  gì thêm — mã `3`. Thẻ bọc thẻ là lỗi kinh điển của ranh giới này.
- `SURFACE-IN-SURFACE-5`: cùng một "nhóm riêng" nhưng bề mặt chứa khác nhau. Trên nền trang thì nâng
  nổi; bên trong một bề mặt thì dàn ý.

**Tình huống nghiệp vụ hay gặp.** Thẻ tóm tắt đơn hàng · khung biểu mẫu độc lập · khối thống kê tiến
độ · thẻ hồ sơ người dùng · khối thanh toán · thẻ khoá học trong lưới · khung bộ lọc ở cột trái · khối
"bắt đầu từ đây" của trang trống · thẻ hoá đơn · khối bản đồ kèm thông tin địa điểm.

## `SURFACE-IN-SURFACE-2` — một tập hàng so sánh được, ở cấp trang

**Khi nào gặp.** Nhiều hàng **cùng loại**, đọc theo cùng một cách, so sánh được với nhau. Cả tập là
**một** đối tượng cấp trang; từng hàng **không** phải đối tượng riêng. Một ranh giới duy nhất ôm cả
tập, và ranh giới giữa các hàng do `divide-y` nói, không do khoảng trắng nói.

**Cách nhận ra**

- Mọi hàng có cùng cấu trúc: cùng những trường, cùng thứ tự đọc.
- Thêm hay bớt một hàng không làm đổi ý nghĩa của tập.
- Người dùng đọc chúng để **so sánh** hoặc **duyệt**, không để đọc từng cái như một câu chuyện riêng.
- `overflow-hidden` là bắt buộc: nếu không, hàng đầu và hàng cuối tràn ra ngoài góc bo của tập.

**Tự hỏi.** Các hàng có so sánh được với nhau bằng cùng một tập trường không — và cả tập có phải là
một đối tượng cấp trang không?

**Ranh giới**

- `SURFACE-IN-SURFACE-1`: một đối tượng đơn lẻ có nội dung không đồng dạng thì là mã `1`. Ba khối có
  cấu trúc khác hẳn nhau **không** phải tập liền mạch.
- `SURFACE-IN-SURFACE-3`: nếu mỗi hàng đã tự là một thẻ có ranh giới riêng thì chúng là phần tử ngang
  hàng, và cha của chúng là mã `3`.
- `SURFACE-IN-SURFACE-5`: cùng một tập liền mạch, nhưng bề mặt chứa là một bề mặt khác thì xuống dàn
  ý.

**Tình huống nghiệp vụ hay gặp.** Bảng xếp hạng · lịch sử giao dịch · danh sách hoá đơn · danh sách
thiết bị đang đăng nhập · danh sách cài đặt · luồng tin thông báo · danh sách thành viên nhóm · danh
sách tệp đính kèm · lịch sử hoạt động.

## `SURFACE-IN-SURFACE-3` — phần nội dung chỉ gọi tên cho phần tử ngang hàng đã có ranh giới

**Khi nào gặp.** Một vùng trang có tiêu đề, nhưng **con của nó đã tự sở hữu ranh giới**. Phần nội dung
chỉ làm một việc: gọi tên. Nếu nó vẽ thêm một ranh giới nữa thì cùng một quan hệ nhóm bị tuyên bố hai
lần, và người đọc phải tự đoán khung nào mới là khung thật.

**Cách nhận ra**

- Con trực tiếp là các thẻ, các đối tượng đã nâng nổi, hoặc các tập liền mạch.
- Phần nội dung không có trạng thái riêng ngoài trạng thái của tập con.
- Xoá ranh giới của phần nội dung đi thì không mất thông tin nào — chỉ mất một cái khung.
- Phần nội dung dùng đúng **nền trang**, nên các con nổi lên trên nền đó.

**Tự hỏi.** Con của nó đã tự có ranh giới chưa? Nếu rồi, phần nội dung này còn sở hữu cái gì?

**Ranh giới**

- `SURFACE-IN-SURFACE-1`: nếu chính phần nội dung là một đối tượng nghiệp vụ hoàn chỉnh — có tên,
  thành viên, trạng thái, kết quả — thì nó là mã `1`, và lúc đó con của nó **không** được nâng nổi
  nữa.
- `SURFACE-IN-SURFACE-4`: mã `3` đứng ở **cấp trang** và dùng nền trang; mã `4` đứng **bên trong một
  bề mặt** và dùng nền trong suốt. Hai mã cùng "không vẽ gì" nhưng đứng ở hai chỗ khác nhau và nói hai
  điều khác nhau.

**Tình huống nghiệp vụ hay gặp.** "Khoá học của tôi" + lưới thẻ khoá học · "Thiết bị" + các thẻ thiết
bị · "Gói dịch vụ" + ba thẻ giá · thẻ tab khung chứa các thẻ ngang hàng · vùng bảng điều khiển gom
nhiều khối thống kê · "Kết quả tìm kiếm" + danh sách kết quả đã có khung riêng.

## `SURFACE-IN-SURFACE-4` — trùng, tầm thường, hoặc không gọi được tên

**Khi nào gặp.** Vùng chứa nằm **bên trong** một bề mặt đã có (thẻ, nhóm có dàn ý, phần tử chồng lớp)
và không sở hữu nhóm nào khác bề mặt chứa. Có ba đường dẫn tới đây, và cả ba cho cùng một kết quả:

1. **Trùng** — nội dung thuộc đúng nhóm mà bề mặt chứa đã tuyên bố.
2. **Tầm thường** — chỉ là nội dung, không phải một nhóm.
3. **Không gọi được tên** — có thể là một nhóm, nhưng chưa ai nêu được tên, thành viên, trạng thái và
   kết quả của nó.

**Cách nhận ra**

- Bạn không đặt được tên cho nhóm mà không lặp lại tên của bề mặt chứa.
- Vùng chứa tồn tại vì lý do kỹ thuật: để đặt `flex-col`, để bọc một bản đồ, để nhận một ref.
- Nội dung bên trong không có trạng thái tải riêng, không rỗng riêng, không lỗi riêng.
- Phần tử chồng lớp đã sở hữu ranh giới của cả tác vụ; mọi thứ thường bên trong nó rơi vào đây.

**Tự hỏi.** Ranh giới này sở hữu nhóm nào mà bề mặt chứa hiện tại chưa sở hữu? Nếu không nêu được —
mã `4`.

**Ranh giới**

- `SURFACE-IN-SURFACE-5`: mã `5` đòi một quan hệ nhóm **gọi được tên** và **so sánh được thành viên**.
  Không nêu được thì không được lên mã `5`; DOM lồng nhau **không** phải bằng chứng quan hệ nhóm.
- `SURFACE-IN-SURFACE-3`: mã `3` ở cấp trang, dùng nền trang. Mã `4` ở trong bề mặt, dùng nền trong
  suốt.
- `SURFACE-IN-SURFACE-6`: một thành phần điều khiển đơn lẻ không bao giờ được bọc bề mặt; nó đi thẳng
  vào mã `6` và không sinh ra lớp bọc.

**Đây là mặc định an toàn.** Khi thiếu dữ kiện, mã `4` là đáp án. Thêm một ranh giới không có chứng cứ
là bịa ra một nhóm không tồn tại, và cái giá phải trả rơi vào người đọc chứ không rơi vào người viết.

**Tình huống nghiệp vụ hay gặp.** Đoạn mô tả trong thẻ · nội dung thường của hộp thoại · trường trong
biểu mẫu nằm trong khung · khối kết quả trong phần tử chồng lớp · lớp bọc chỉ để xếp cột · vùng chú
thích dưới biểu đồ · khung chờ của bất kỳ nội dung nào ở trên · trạng thái rỗng bằng chữ trong một thẻ
đã có.

## `SURFACE-IN-SURFACE-5` — tập liền mạch riêng nằm trong bề mặt khác

**Khi nào gặp.** Bên trong một bề mặt đã có, xuất hiện một **tập hàng so sánh được** thuộc về một quan
hệ nhóm **khác** với bề mặt chứa và **gọi được tên**. Tập đó cần một ranh giới, nhưng **không** được
độ nổi: trong một bề mặt, độ nổi lần hai là một lời nói dối về độ sâu. Nó nhận **một** đường viền, nền
trong suốt, không bóng.

**Cách nhận ra**

- Các hàng bên trong so sánh được với nhau (cùng trường, cùng thứ tự đọc).
- Nhóm có tên riêng, khác tên của bề mặt chứa.
- Nhóm có thể rỗng riêng, lỗi riêng, tải riêng.
- Bề mặt chứa vẫn còn nhiều nội dung khác ngoài nhóm này — nếu không, nhóm này chính là bề mặt chứa.

**Tự hỏi.** Tập này gọi tên được, và tên đó có khác tên của bề mặt chứa không?

**Ranh giới**

- `SURFACE-IN-SURFACE-4`: không gọi được tên thì phẳng. Đây là ranh giới bị vi phạm nhiều nhất.
- `SURFACE-IN-SURFACE-2`: cùng một tập liền mạch; trên nền trang thì nâng nổi, trong một bề mặt thì
  dàn ý. **Không bao giờ cả hai.**
- `SURFACE-IN-SURFACE-1`: mã `1` không tồn tại bên trong một bề mặt. Thẻ trong thẻ là lỗi, không phải
  một lựa chọn.

**Chỉ quan hệ nhóm liền mạch mới được lồng ranh giới.** Một nhóm lồng gồm những phần **không** đồng
dạng chưa có mã trong bộ từ vựng này; nó là mã `4` cho tới khi có đủ ca thật để đề xuất đổi luật.

**Tình huống nghiệp vụ hay gặp.** Danh sách bài học bên trong thẻ khoá học · danh sách tệp đính kèm
trong hộp thoại · các dòng chi tiết đơn hàng trong khung thanh toán · danh sách người tham gia trong
thẻ sự kiện · lịch sử thay đổi trong ngăn trượt chi tiết · các dòng phân bổ chi phí trong thẻ hoá đơn.

## `SURFACE-IN-SURFACE-6` — một hành động thường nằm trong bề mặt

**Khi nào gặp.** Một thành phần điều khiển nằm trong một bề mặt đã có, phục vụ chính bề mặt chứa đó, và
**chưa ai chứng minh** nó là kết quả chính. Nó nhận cách thể hiện thứ cấp: một đường viền, nền trong
suốt, chữ màu tiền cảnh — đủ để bấm được, không đủ để cạnh tranh với bề mặt chứa.

**Cách nhận ra**

- Bề mặt chứa của thành phần điều khiển đã là một bề mặt (thẻ, nhóm có dàn ý, phần tử chồng lớp).
- Thành phần điều khiển làm một việc cục bộ: thử lại, xem thêm, sao chép, tải xuống, huỷ.
- Chưa có tài liệu nào nêu nó là kết quả chính duy nhất của bề mặt chứa.

**Tự hỏi.** Đã có ai chứng minh đây là kết quả chính duy nhất của bề mặt chứa chưa? Chưa — thì thứ cấp.

**Ranh giới**

- `SURFACE-IN-SURFACE-4`: một thành phần điều khiển **không phải** một nhóm, nên nó không sinh ra lớp
  bọc bề mặt. Bọc một cái nút bằng một cái khung là tuyên bố một quan hệ nhóm chỉ có một thành viên.
- Nâng cấp: chỉ ý định CTA mới được nâng nó lên chính. Vị trí dưới-phải, chữ to, hay việc nó là thành
  phần điều khiển duy nhất **đều không** phải bằng chứng.

**Tình huống nghiệp vụ hay gặp.** Nút "Thử lại" trong thẻ lỗi · "Xem tất cả" ở chân thẻ danh sách ·
"Sao chép mã" trong khung · "Tải hoá đơn" trong dòng giao dịch · "Huỷ" trong phần cuối hộp thoại ·
"Đổi ảnh" trong thẻ hồ sơ · "Xem chi tiết" trong thẻ tóm tắt.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| `host` | `page` · `card` · `outlined-group` · `overlay` — thứ đã sở hữu ranh giới bao quanh vùng chứa này |
| `child` | `ordinary-content` · `independent-group` · `peer-surfaces` · `joined-rows` · `single-control` |
| `membership` | `same-as-host` · `distinct-and-nameable` · `unknown` |
| `action-priority` | `ordinary-local` · `separately-proven-primary` · `unknown` |

`host`, `child` và `membership` quyết định ranh giới. `action-priority` chỉ được tra cho
`SURFACE-IN-SURFACE-6`, và chỉ ý định CTA mới được nâng nó lên. Không một giá trị khoảng cách, khoảng
đệm, lề hay khoảng đệm trong nào là đầu vào hoặc đầu ra của mô-đun này.

Một quan hệ nhóm chỉ **gọi được tên** khi nêu ra được tên, thành viên, trạng thái riêng và kết quả
riêng của nó. DOM lồng nhau không phải bằng chứng quan hệ nhóm; một `div` tồn tại chỉ để đặt hướng xếp
thì không có thành viên và không có kết quả.

## Quy tắc

1. Ranh giới chỉ tồn tại cho một tuyên bố quan hệ nhóm gọi được tên.
2. Nâng nổi cấp trang và dàn ý lồng bên trong loại trừ lẫn nhau. Độ nổi không bao giờ mang đường viền,
   và dàn ý không bao giờ mang bóng.
3. Bề mặt cấp trang dùng `bg-card`; nền trang dùng `bg-background`.
4. Ranh giới lồng bên trong dùng **một** `border-border`, nền trong suốt và không bóng.
5. Quan hệ nhóm trùng và quan hệ nhóm chưa xác định đều rơi vào `SURFACE-IN-SURFACE-4`.
6. Phần nội dung có con đã tự sở hữu ranh giới thì không tuyên bố ranh giới nào của riêng nó.
7. Phần tử chồng lớp đã sở hữu ranh giới của tác vụ; nội dung thường bên trong nó phẳng.
8. Một thành phần điều khiển đơn lẻ không bao giờ được bọc bề mặt. Một thành phần điều khiển không
   phải một nhóm.
9. Hành động thường nằm lồng bên trong giữ mức thứ cấp; chỉ ý định CTA mới được nâng cấp nó.
10. Trạng thái sẵn sàng, đang tải, rỗng, lỗi và thiết kế đáp ứng đều giữ nguyên quyền sở hữu ranh
    giới. Số đối tượng mà khung chờ vẽ bằng đúng số đối tượng mà nội dung đã settle vẽ.
11. Một vùng chứa nhiều nhất chỉ tuyên bố **một** ranh giới; hai tuyên bố về cùng một quan hệ nhóm cần
    hai cấp lồng nhau, không phải một className dài hơn.
12. Khoảng cách, khoảng đệm trong và độ lệch ra ngoài nằm ngoài mô-đun này.

Ngoài ra: mọi vùng chứa được hiển thị ra đều rơi vào đúng một mã, và không bố cục nào nằm ngoài phạm
vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Bề mặt chứa đã gọi đúng tên của tập lồng bên trong.** Vẫn là `SURFACE-IN-SURFACE-5`; chỉ **nhãn
  lặp** bên trong dàn ý được phép bỏ. Ranh giới ở lại vì quan hệ nhóm vẫn khác bề mặt chứa — thứ thừa
  là cái nhãn thứ hai, không phải cái khung.
- **Không gọi được tên quan hệ nhóm.** `SURFACE-IN-SURFACE-4`, luôn luôn. Nếu bên yêu cầu vẫn muốn một
  ranh giới, hỏi **đúng một câu** — *ranh giới này sở hữu nhóm nào khác bề mặt chứa hiện tại?* — rồi
  dừng.
- **Hành động thường trong bề mặt.** `SURFACE-IN-SURFACE-6`, kể cả khi nó là thành phần điều khiển duy
  nhất, kể cả khi nó nằm ở góc dưới bên phải.
- **Có yêu cầu nâng cấp lên chính.** Giữ `SURFACE-IN-SURFACE-6` cho tới khi ý định CTA chứng minh được
  một kết quả chính ở cấp bề mặt chứa.
- **Hai đối tượng có đường viền chạm nhau.** Giữ hai ranh giới tách rời. Nằm cạnh nhau **không** phải
  quan hệ nhóm; chỉ tính so sánh được của hàng mới biến chúng thành `SURFACE-IN-SURFACE-2`.
- **Đổi trạng thái.** Bản vẽ khi đang tải, khi rỗng và khi lỗi giữ nguyên mã của bản vẽ đã settle.
  Khung chờ làm phẳng một thẻ, hoặc trạng thái lỗi nâng một khối phẳng thành thẻ, là nói dối về quyền
  sở hữu đúng lúc người dùng ít có khả năng kiểm chứng nhất.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi **bề mặt chứa thật sự đổi**. Màn hình hẹp đi không biến một đối
  tượng thành một phần nội dung, và cũng không biến một phần nội dung thành một thẻ.

## Đầu ra

Mỗi vùng chứa một khối, từ ngoài vào trong:

```text
host: <page | card | outlined-group | overlay>
child: <ordinary-content | independent-group | peer-surfaces | joined-rows | single-control>
membership: <same-as-host | distinct-and-nameable | unknown>
situation: <SURFACE-IN-SURFACE-1 … SURFACE-IN-SURFACE-6>
className: <đúng className trong bảng Mã tình huống>
reason: <dữ kiện về bề mặt chứa và quan hệ nhóm loại trừ mã liền kề>
removed: <ranh giới trùng mà quyết định này xoá đi, hoặc none>
```

## Ví dụ đã giải

**Yêu cầu.** "Một phần nội dung 'Khoá học của tôi' gồm ba thẻ khoá học; mỗi thẻ có tên khoá học, một
đoạn mô tả ngắn, danh sách bài học của nó, và một nút Tiếp tục."

Yêu cầu này nói ra năm vùng chứa: phần nội dung, mỗi thẻ khoá học, khối mô tả trong thẻ, danh sách bài
học trong thẻ, và thành phần điều khiển Tiếp tục. Nó không nói tới hộp thoại, không nói tới tập hàng ở
cấp trang, cũng không đưa ra chứng minh nào về kết quả chính, nên không giải những thứ đó.

```text
host: page
child: peer-surfaces
membership: same-as-host
situation: SURFACE-IN-SURFACE-3
className: bg-background shadow-none
reason: phần nội dung chỉ gọi tên cho ba cái thẻ đã tự sở hữu ranh giới, điều này loại trừ SURFACE-IN-SURFACE-1
removed: cái thẻ ngoài lẽ ra sẽ bọc quanh ba thẻ khoá học
```

```text
host: page
child: independent-group
membership: distinct-and-nameable
situation: SURFACE-IN-SURFACE-1
className: rounded-2xl bg-card shadow-surface
reason: một khoá học là đối tượng hoàn chỉnh có tên, thành viên, trạng thái và kết quả riêng, và bề mặt chứa của nó là nền trang, điều này loại trừ SURFACE-IN-SURFACE-5
removed: none
```

```text
host: card
child: ordinary-content
membership: same-as-host
situation: SURFACE-IN-SURFACE-4
className: bg-transparent shadow-none
reason: đoạn mô tả thuộc đúng khoá học mà cái thẻ đã tuyên bố, điều này loại trừ SURFACE-IN-SURFACE-5
removed: none
```

```text
host: card
child: joined-rows
membership: distinct-and-nameable
situation: SURFACE-IN-SURFACE-5
className: overflow-hidden rounded-xl border border-border bg-transparent shadow-none
reason: các bài học là những hàng so sánh được dưới một cái tên riêng khác tên khoá học, và bề mặt chứa là một cái thẻ chứ không phải nền trang, điều này loại trừ SURFACE-IN-SURFACE-2
removed: none
```

```text
host: card
child: single-control
membership: same-as-host
situation: SURFACE-IN-SURFACE-6
className: border border-border bg-transparent text-foreground
reason: Tiếp tục là một hành động cục bộ thường, chưa ai chứng minh nó là kết quả chính, và một thành phần điều khiển không phải một nhóm, điều này loại trừ SURFACE-IN-SURFACE-4
removed: lớp bọc có đường viền lẽ ra sẽ đóng khung một cái nút đơn lẻ
```

## Phạm vi

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường. Các từ chỉ màu `bg-card`, `bg-background`, `border-border`, `text-foreground` và từ chỉ độ nổi
`shadow-surface` là những tên ngữ nghĩa mà mỗi front end tự định nghĩa cho mình: nền của một bề mặt,
nền của trang, một màu ranh giới, một màu tiền cảnh và một mức độ nổi.
