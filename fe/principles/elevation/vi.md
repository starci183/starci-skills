---
id: fe-principles-elevation-vi
title: vi.md
slug: /fe/principles/elevation/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống ELEVATION-N, nhận diện bằng thứ nó che chứ không bằng độ đậm của bóng.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `elevation`

# Độ nổi

Độ nổi là **tuyên bố rằng một thứ nằm trên một thứ khác**. Nó được chọn từ hai dữ kiện: **mặt nền
nào đang đỡ nó**, và **nó đang che cái gì khi ở đó**.

Không chọn độ nổi bằng cảm giác "trông nổi hơn". Hãy nhìn phần tử và hỏi:

> Nó đang nằm trên cái gì, và cái nằm dưới có còn dùng được không?

Càng che nhiều, càng chặn nhiều, bậc càng cao. Không che gì cả thì không có bậc nào để tuyên bố.

**Độ nổi đo từ nền cục bộ, không đo từ trang.** Nền là thứ mà phần tử được đặt lên: trang, một
bề mặt đã có, hoặc một lớp đã được nâng lên sẵn. Một thẻ nằm trên trang và một thẻ nằm trong một
hộp thoại **không** cùng độ cao trong mắt người xem. Cái thứ hai đã được vật chủ bê lên rồi; nó không còn
gì để tuyên bố nữa.

**Độ cao và thứ tự là hai câu khác nhau.** Bóng nói *tôi cao bao nhiêu so với nền của tôi*; số `z`
nói *hai thứ đang chồng lên nhau thì cái nào ở trước*. Câu này không suy ra câu kia. Hai phần tử có
thể cùng một bậc mà vẫn cần thứ tự; hai phần tử có thể không cần thứ tự nào mà vẫn khác bậc.

**Đây là luật bắt buộc.** Mọi phần tử hiển thị ra đều rơi vào đúng một mã dưới đây, kể cả phần lớn rơi
vào `ELEVATION-0` và không phát ra class CSS nào. Không có kích thước nào nhỏ đến mức được miễn: một khối
gợi ý hai dòng nằm trong thẻ là `ELEVATION-0` đúng cùng một lý do mà một hộp thoại chặn trang là
`ELEVATION-3`. Câu "thêm cái bóng cho đẹp thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, và đó chính
là cách một trang có bốn cái bóng cùng tuyên bố một độ cao, rồi không cái nào còn nghĩa gì.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `ELEVATION-0` | Nằm đúng trong mặt phẳng của nền, không che gì | *không khai báo class CSS độ nổi* |
| `ELEVATION-1` | Một đối tượng độc lập đặt xuống và nằm yên trên nền | `shadow-surface` |
| `ELEVATION-2` | Lớp do người dùng gọi ra, che nội dung, đóng lại là mất | `z-30 shadow-popover` |
| `ELEVATION-3` | Lớp lấy cả trang đi cho tới khi được trả lời | `z-[60] shadow-dialog` + lớp nền mờ |
| `ELEVATION-4` | Hai thứ trong cùng một ngữ cảnh xếp chồng chồng nhau, phải viết thứ tự ra | `z-<bậc>`, không bóng |
| `ELEVATION-5` | Bậc là thật nhưng vật chủ không cho phép bóng, viền gánh thay | `border border-border shadow-none` |
| `ELEVATION-6` | Nền bị **khoét xuống** thay vì được xây lên | `inset-shadow-sm bg-muted` |

Mã `0`–`3` là một **thang thật**: bậc sau nằm trên bậc trước, và đó chính là nội dung của mô-đun này.
Mã `4`–`6` **không phải bậc**. Chúng đặt tên cho **phương tiện** diễn đạt độ cao hoặc thứ tự khi thang
trần không diễn đạt được: bằng một con số, bằng một đường viền, hoặc bằng cách khoét xuống.

---

## `ELEVATION-0` — nằm trong mặt phẳng của nền

**Tình huống.** Phần tử nằm đúng trên mặt phẳng mà nó thuộc về. Nó không che ai, không chặn ai, và
không tranh thứ tự với ai. Đây là câu trả lời cho phần lớn một trang.

**Dấu hiệu nhận biết**

- Bỏ mọi bóng đi thì không ai đọc sai bất cứ thứ gì.
- Không có phần tử nào bị nó phủ lên.
- Nếu nó đang nằm trong một bề mặt, thì bề mặt đó đã tuyên bố độ cao thay nó rồi.
- Ranh giới của nó (nếu có) đến từ một quyết định **quan hệ nhóm**, không phải từ độ cao.

**Tự hỏi.** Có thứ gì nằm dưới nó và bị nó che không? Nếu không — `ELEVATION-0`.

**Ranh giới**

- `ELEVATION-1`: `ELEVATION-1` cần một **đối tượng độc lập trên nền trang**. Một khối nằm trong thẻ
  không phải đối tượng độc lập, vì thẻ đã là đối tượng đó rồi.
- `ELEVATION-5`: nếu phần tử **thật sự** cao hơn vật chủ mà chỉ bị cấm dùng bóng, đó là
  `ELEVATION-5`. Nếu nó không cao hơn gì cả thì viền của nó là chuyện của mô-đun khác, không phải mã
  này.
- `ELEVATION-6`: `ELEVATION-6` khoét xuống dưới mặt phẳng. Bằng phẳng khác với lõm.

**Không viết `shadow-none` và không viết `z-0`.** Không tuyên bố là **trạng thái vắng mặt** của một
tuyên bố, không phải một tuyên bố bằng không. `shadow-none` nói rằng đã có một quyết định bị đảo
ngược; `z-0` ghim phần tử vào một cuộc so sánh mà nó không tham gia.

**Tình huống nghiệp vụ hay gặp.** Đoạn mô tả trong thẻ · hàng trong một danh sách có đường phân cách · khối
gợi ý dưới ô nhập liệu · tiêu đề của phần nội dung · một hàng thống kê · nội dung bên trong hộp thoại · ô của lưới
khoá học **nằm trong** một khung đã nâng · phần thân của vùng thu gọn · phần cuối của trang.

---

## `ELEVATION-1` — đối tượng độc lập nằm yên trên nền

**Tình huống.** Một thứ tự nó là một đối tượng hoàn chỉnh, được **đặt xuống** nền trang. Nó không được
gọi ra, không biến mất, và không chặn ai — nhưng nó tách khỏi nền, và cái bóng nói đúng điều đó.

**Dấu hiệu nhận biết**

- Nó có mặt ngay khi trang hiển thị, không cần ai bấm gì.
- Nó tự gọi tên được: một đơn hàng, một khoá học, một hồ sơ, một bảng.
- Nền ngay dưới nó là **trang**, không phải một bề mặt khác.
- Cuộn trang thì nó cuộn theo — nó không đứng yên bên trên cái gì.

**Tự hỏi.** Nó có phải là một đối tượng độc lập **đặt trực tiếp lên nền trang** không?

**Ranh giới**

- `ELEVATION-0`: xem trên. Cùng một thẻ, đặt trên trang thì là `ELEVATION-1`, đặt trong một thẻ
  khác thì là `ELEVATION-0`.
- `ELEVATION-2`: `ELEVATION-1` **có sẵn**; `ELEVATION-2` **được gọi ra**. Nếu tồn tại của nó phụ
  thuộc vào một hành động của người dùng, nó không phải bậc nghỉ.
- `ELEVATION-5`: cùng một bậc, khác phương tiện. Nếu nền tối tới mức bóng không đọc được, hoặc nếu
  đã có một bề mặt bao quanh, viền gánh bậc này thay bóng.

**Một mức, không hai.** Chỉ có **một** tên bóng cho bậc nghỉ. Ngay khi xuất hiện "bóng nghỉ đậm hơn"
và "bóng nghỉ nhạt hơn", thang đã ngừng nói về độ cao và bắt đầu nói về thị hiếu.

**Tình huống nghiệp vụ hay gặp.** Thẻ khoá học trên trang danh mục · thẻ tóm tắt đơn hàng · bảng giá
· khung thống kê trên bảng điều khiển · khối bài viết nổi bật · biểu mẫu đăng nhập giữa trang · bảng dữ liệu có
bo góc · thẻ hồ sơ người dùng.

---

## `ELEVATION-2` — lớp được gọi ra

**Tình huống.** Người dùng làm một việc, và một mặt phẳng mới xuất hiện **đè lên** nội dung. Nó neo
vào thứ đã gọi nó ra, nó che một phần trang, nhưng phần còn lại của trang vẫn sống: người dùng nhìn
ra chỗ khác là nó tự đóng.

**Dấu hiệu nhận biết**

- Trước hành động của người dùng, nó không tồn tại trong DOM hoặc không chiếm chỗ nào.
- Nó phủ lên nội dung thật, nên nền của nó phải **đục**.
- Bấm ra ngoài, hoặc nhấn Escape, là nó biến mất — và **không mất dữ liệu gì**.
- Nội dung bên dưới vẫn đọc được và vẫn còn ý nghĩa.

**Tự hỏi.** Người dùng có thể bỏ qua nó bằng cách nhìn chỗ khác không? Nếu có — `ELEVATION-2`.

**Ranh giới**

- `ELEVATION-1`: xem trên.
- `ELEVATION-3`: câu phân định là **mất mát**. Bỏ qua `ELEVATION-2` thì không mất gì. Bỏ qua
  `ELEVATION-3` thì một câu hỏi chưa được trả lời hoặc một việc dở dang bị huỷ.
- `ELEVATION-4`: một bám dính sub-phần đầu cũng đứng ở bậc `z-30`, nhưng nó **luôn ở đó** và không do ai
  gọi ra. Cùng một số, khác mã — số là phương tiện, mã là tình huống.

**Nền phải đục.** Một lớp trong suốt nằm đè lên chữ thì hai lớp chữ chồng lên nhau, và cái bóng chỉ
làm cho sự chồng chéo đó trông có chủ ý.

**Tình huống nghiệp vụ hay gặp.** Danh sách thả xuống chọn ngôn ngữ · trình đơn tài khoản · cửa sổ nổi giải thích một chỉ
số · lịch chọn ngày · gợi ý autocomplete của ô tìm kiếm · trình đơn ngữ cảnh khi bấm chuột phải · chú giải
giàu nội dung · khung thông báo · combobox chọn nhiều mục.

---

## `ELEVATION-3` — lớp lấy cả trang đi

**Tình huống.** Trang phía sau **ngừng dùng được**. Có một câu hỏi phải trả lời, hoặc một việc phải
làm xong hay huỷ hẳn, trước khi người dùng lấy lại quyền điều khiển.

**Dấu hiệu nhận biết**

- Có một lớp nền mờ che toàn bộ khung nhìn.
- Cuộn của trang phía sau bị khoá; tiêu điểm bàn phím bị giữ lại bên trong.
- Đóng nó đi là **mất một thứ gì đó**: dữ liệu đã nhập, hoặc một quyết định chưa đưa ra.
- Nó phải vượt lên trên **mọi** chrome của trang, kể cả thanh điều hướng trên cùng.

**Tự hỏi.** Người dùng có còn làm được việc gì ở phía sau không? Nếu không — `ELEVATION-3`.

**Ranh giới**

- `ELEVATION-2`: xem trên.
- `ELEVATION-4`: một cold-load phủ kín cũng ngồi ở bậc trên cùng, nhưng nó **không hỏi gì cả** — nó
  chỉ chiếm chỗ trong lúc chờ. Không có câu hỏi thì không phải blocking lớp.

**Bên trong nó, nền đã dịch lên.** Mọi thứ nằm trong một blocking lớp đều đo từ mặt phẳng của lớp
đó. Một thẻ trong hộp thoại là `ELEVATION-0`, không phải `ELEVATION-1`. Chồng bóng nghỉ lên bóng chặn là
nói hai lần một độ cao.

**Tình huống nghiệp vụ hay gặp.** Xác nhận xoá · biểu mẫu thanh toán · bảng trượt trượt lên từ đáy trên thiết bị di động
· hộp thoại chọn ảnh đại diện · cảnh báo phiên đăng nhập sắp hết hạn · nhập mã xác thực hai lớp ·
trình xem ảnh toàn màn hình · hướng dẫn ban đầu bắt buộc bước đầu.

---

## `ELEVATION-4` — viết thứ tự ra

**Tình huống.** Hai thứ trong **cùng một ngữ cảnh xếp chồng** chồng lên nhau, và trình duyệt sẽ quyết
định bằng thứ tự nguồn nếu ta không nói gì. Ở đây ta chỉ tuyên bố **thứ tự**, không tuyên bố độ cao:
không có bóng nào cả.

**Dấu hiệu nhận biết**

- Hai vùng thật sự phủ lên nhau về mặt hình học.
- Vấn đề là "cái nào ở trước", không phải "cái nào cao hơn".
- Đổi thứ tự trong mã đánh dấu thì kết quả đổi theo — dấu hiệu chắc chắn rằng thứ tự đang không được viết
  ra.

**Tự hỏi.** Ta đang cần một **thứ tự** hay một **độ cao**? Nếu chỉ cần thứ tự — `ELEVATION-4`.

**Ranh giới**

- `ELEVATION-2` và `ELEVATION-3`: hai mã đó **cũng** lấy bậc từ thang này, nhưng chúng còn tuyên bố
  cả độ cao. `ELEVATION-4` thuần tuý là thứ tự, và không bao giờ đi kèm bóng.
- `ELEVATION-0`: nếu hai thứ không chồng nhau thì không có thứ tự nào cần viết.

**Thang đóng, và số to hơn không mạnh hơn.** Mọi `z` đều lấy từ bảng trong `INDEX.md`. Hai tiện ích nằm
cùng một cơ chế xếp tầng lớp được phân định bằng **thứ tự nguồn**, không bằng độ lớn — nên một phần tử đã
thua một lần thì leo lên số nào cũng có thể thua lại. Một cuộc tranh chấp ở đỉnh thang là **báo cáo
về kiến trúc**: hai thứ lẽ ra phải lồng vào nhau đã bị hiển thị thành anh em. Sửa quan hệ, đừng sửa số.

**Ngữ cảnh xếp chồng là cái bẫy thật sự.** `transform`, `filter`, `opacity` nhỏ hơn 1, `will-change`,
`isolate` và một phần tử fixed đều **tạo ra một ngữ cảnh xếp chồng mới**. Con của chúng không bao giờ
trèo ra ngoài được, dù đặt số bao nhiêu. Khi một lớp "không chịu nổi lên", câu hỏi đúng là *tổ tiên
nào đã đóng nắp lại*, chứ không phải *số đã đủ to chưa*.

**`isolate` là công cụ, không phải bệnh.** Cố ý mở một ngữ cảnh xếp chồng quanh một thành phần để thang
cục bộ của nó không rò ra ngoài là một quyết định `ELEVATION-4` hợp lệ.

**Tình huống nghiệp vụ hay gặp.** Bám dính sub-phần đầu của một thẻ tab · thanh lọc dính dưới navbar · nút tay
cầm để kéo giãn một thanh dọc đang bám dính · thanh điều khiển video đè lên khung hình · nhãn trạng thái đè lên góc
ảnh ảnh thu nhỏ · nút nổi cấp trang · thanh tiến trình điều hướng phải vượt navbar · hình trang trí nền
phải nằm sau chữ.

---

## `ELEVATION-5` — viền gánh bậc thay bóng

**Tình huống.** Bậc là **thật** — phần tử đúng là nằm trên vật chủ của nó — nhưng bóng không nói được
điều đó ở đây. Hoặc vì đã có một bề mặt bao quanh và một cái bóng nữa sẽ là bóng thứ hai trong cùng
một mặt phẳng; hoặc vì nền quá tối, bóng đổ xuống nền tối là đổ vào hư không.

**Dấu hiệu nhận biết**

- Vật chủ trực tiếp đã có bóng của riêng nó.
- Trên nền tối, bật/tắt bóng không làm ranh giới rõ hơn chút nào.
- Phần tử vẫn cần được đọc là **tách khỏi** vật chủ, không phải là một phần của nó.

**Tự hỏi.** Bậc này có thật không, và cái bóng ở đây có nói được điều gì mà mắt đọc ra không?

**Ranh giới**

- `ELEVATION-1`: cùng một bậc nghỉ, khác phương tiện. Chọn `ELEVATION-1` khi nền là trang và bóng
  đọc được; chọn `ELEVATION-5` khi nền là một bề mặt khác hoặc bóng vô hiệu.
- `ELEVATION-0`: đây là ranh giới hay bị lách nhất. Nếu phần tử **không** cao hơn vật chủ thì viền
  của nó không phải chuyện của mô-đun này — nó là một tuyên bố quan hệ nhóm, và mã độ nổi của nó là
  `ELEVATION-0`.

**Không bao giờ cả hai.** Một phần tử vừa `shadow-surface` vừa `border` là nói hai lần một độ cao
bằng hai giọng khác nhau, và người đọc sẽ đi tìm sự khác biệt không tồn tại giữa chúng.

**Tình huống nghiệp vụ hay gặp.** Khung tóm tắt nổi bên trong một thẻ đã nâng · khối cảnh báo trong
một hộp thoại · thẻ lồng trên chủ đề tối · một hàng nội dung được nhấn bên trong một bảng · vùng thả tệp
· khối trích dẫn được nhấn trong một bài viết đã nằm trên bề mặt.

---

## `ELEVATION-6` — khoét xuống thay vì xây lên

**Tình huống.** Phần tử không nằm trên nền: nó là một **chỗ lõm** trong nền. Nó là nơi để đổ một thứ
gì đó vào — một giá trị, một tiến độ, một lựa chọn đang trượt qua lại.

**Dấu hiệu nhận biết**

- Nó là một cái **máng** hoặc một cái **giếng**: có thứ khác sẽ chạy hoặc nằm bên trong nó.
- Nội dung của nó do người dùng hoặc do hệ thống đổ vào, không phải do nó tự có.
- Nếu nâng lên thay vì khoét xuống, nó sẽ tranh chấp độ cao với chính thứ nằm trong nó.

**Tự hỏi.** Đây là một vật đặt lên nền, hay một chỗ trũng để chứa thứ khác?

**Ranh giới**

- `ELEVATION-0`: một khối phẳng chỉ đơn thuần nằm đó, không chứa gì trượt qua và không nhận gì đổ
  vào, thì là `ELEVATION-0`. Đổi nền cho dễ nhìn **không** biến nó thành một cái giếng.
- `ELEVATION-1`: ngược chiều nhau hoàn toàn. `ELEVATION-1` tách khỏi nền bằng cách nổi lên;
  `ELEVATION-6` tách khỏi nền bằng cách lún xuống.

**Trong lòng giếng, nền cũng dịch — xuống.** Con của một `ELEVATION-6` thường là `ELEVATION-1` chứ
không phải `ELEVATION-0`: thanh tiến độ nằm trong máng của nó **có** nổi lên so với đáy máng, và đó
chính là điều làm cho tiến độ đọc được.

**Tình huống nghiệp vụ hay gặp.** Máng của thanh tiến độ · rãnh của một thanh trượt · nền của một
nhóm nút phân đoạn (viên trượt bên trong mới là thứ nổi) · khung nhập liệu được vẽ như một giếng · khối
mã có nền lún · vùng thả tệp khi chưa có gì · ô tìm kiếm trong một thanh công cụ đã nâng.

---

## Luật

1. Bậc đo từ **nền cục bộ**, không đo từ trang. Vật chủ đã nâng thì con không nâng nữa.
2. Bóng nói **độ cao**; `z` nói **thứ tự**. Không câu nào thay được câu kia.
3. Một phần tử tuyên bố **một** lần. Không vừa bóng vừa viền.
4. Mọi `z` lấy từ thang đóng. Số ở giữa hai bậc, hoặc số vượt bậc trên cùng, là một đề xuất đổi luật.
5. Thứ tự chỉ so được **trong cùng một ngữ cảnh xếp chồng**. Không có số nào trèo ra khỏi ngữ cảnh của
   tổ tiên.
6. Độ nổi **không** đổi vì con trỏ chuột đi qua.
7. Khung chờ và nội dung thật cùng một bậc.
8. Nếu còn hai bậc liền kề cùng hợp lý, mặc định chọn **bậc thấp hơn**; chỉ hỏi khi bên yêu cầu nói rõ
   họ cần tuyên bố lớn hơn.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Nổi lên khi cuộn.** Một phần đầu dính được phép nhận `shadow-surface` **sau khi** đã có nội dung
  chui xuống dưới nó. Được phép vì lúc đó tuyên bố mới trở thành đúng: trước khi cuộn nó chưa che ai.
- **Nhấc lên khi kéo.** Một phần tử đang bị kéo được phép nâng bậc **trong lúc đang giữ**, vì lúc đó
  nó thật sự nằm trên thứ nó sắp được thả xuống. Thả tay là trở về mã nghỉ ngay.
- **Nền tối.** Bóng không đọc được thì bậc nghỉ chuyển sang `ELEVATION-5`. Bậc không đổi, chỉ phương
  tiện đổi. Đây **không** phải giấy phép để tăng độ đậm của bóng cho "thấy rõ hơn".
- **Lớp gọi ra từ trong một lớp.** Không leo số. Hiển thị lớp thứ hai **bên trong** lớp thứ
  nhất, để lớp thứ nhất trở thành nền của nó. Hai lớp cùng ở phần thân tranh nhau bậc trên cùng là báo
  cáo về kiến trúc, không phải nhu cầu về một bậc thứ bảy.
- **Chế độ màu cưỡng bức và in ấn.** Bóng có thể không hiển thị. Ranh giới nào mà nội dung phụ thuộc vào thì
  phải tồn tại cả dưới dạng viền hoặc nền — đó là quyết định của mô-đun bề mặt, không phải cớ để nâng
  bậc.
- **Tính đồng nhất trạng thái.** Đang tải, rỗng, lỗi và nội dung thật dùng chung một mã. Đổi bậc khi đang
  tải là nói dối về thứ đang nằm dưới.
