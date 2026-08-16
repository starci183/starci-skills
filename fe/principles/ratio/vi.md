---
id: fe-principles-ratio-vi
title: vi.md
slug: /fe/principles/ratio/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống RATIO-N, nhận diện bằng nghiệp vụ chứ không bằng cách ảnh trông ra sao.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `ratio`

# Tỷ lệ

Tỷ lệ là **hình dạng mà một khung nội dung đa phương tiện cam kết giữ**, khai báo **trước khi dữ liệu về**, cùng với
cách xử lý khi tệp thật **không cùng hình dạng** với cam kết đó.

Tỉ lệ không được chọn bằng cách nhìn tấm ảnh mẫu rồi thấy "cắt thế này đẹp". Hãy nhìn cái khung và
hỏi:

> Trước khi biết tệp là gì, trang này đã hứa dành ra bao nhiêu chỗ?

Một tỉ lệ không được khai báo là một bố cục sẽ **nhảy** vào đúng lúc ảnh tải xong. Cú nhảy đó không
phải lỗi trình duyệt; nó là lúc cái khung tự thú rằng chưa ai quyết định.

**Đây là luật bắt buộc.** Bất cứ thứ gì chiếm chỗ cho ảnh, video, nội dung nhúng, vùng vẽ hay biểu đồ đều rơi
vào đúng một mã dưới đây. Không có kích thước nào nhỏ đến mức được miễn: một ảnh đại diện 24px là `RATIO-1`
đúng cùng một lý do mà một vùng nổi bật tràn màn hình là `RATIO-2`. Câu "có mỗi cái ảnh thu nhỏ bé tí" là chỗ
luật này bị bỏ qua nhiều nhất, và cũng là chỗ mà khi bố cục giật thì người ta ít khi đổ đúng nguyên
nhân.

Khung sở hữu hình dạng. Khung đã khai tỉ lệ thì **phải khai luôn cách lấp** (`fit`), vì khai hình
dạng mà không khai cách lấp là mới quyết định được một nửa những gì người đọc nhìn thấy.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `RATIO-0` | Nguồn đã tự khai kích thước của nó; khung không áp đặt gì | *không tỷ lệ class CSS, không cách khớp class CSS* |
| `RATIO-1` | Bố cục cần một ô vuông, và các ô vuông phải khớp nhau | `aspect-square` + `object-cover` |
| `RATIO-2` | Khung giữ nội dung động, hoặc ảnh đại diện đứng thay cho nội dung động đó | `aspect-video` + `object-cover` |
| `RATIO-3` | Khung giữ ảnh chụp tĩnh, chủ thể cần thêm chiều cao | `aspect-[4/3]` + `object-cover` |
| `RATIO-4` | Sản phẩm tự đặt một tỉ lệ riêng: hằng số, hoặc tính theo từng bản ghi | `aspect-[<w>/<h>]` + `object-cover` |
| `RATIO-5` | Hình dạng của nguồn **chính là nội dung**; cắt là mất thông tin | khung có chặn + `object-contain` |

**Cắt (`object-cover`) chỉ được cấp phép bởi `RATIO-1`…`RATIO-4`.** Bốn mã đó tồn tại vì bố cục sở
hữu hình dạng, và chính quyền sở hữu đó mới cho phép vứt bỏ phần thừa của nguồn. `RATIO-5` là tình
huống giấy phép bị rút lại.

---

## `RATIO-0` — nguồn đã tự khai kích thước

**Tình huống.** Kích thước thật của nguồn đã có mặt trong mã đánh dấu, hoặc thứ đang hiển thị không phải
nội dung đa phương tiện về muộn. Khung **không** áp đặt hình dạng nào, và nó vẫn không nhảy — vì chỗ đã được giữ sẵn từ
chính con số của nguồn.

**Dấu hiệu nhận biết**

- Phần tử có sẵn `width` và `height` là số thật của tệp, không phải số ước lượng.
- Hoặc là véc-tơ nội tuyến đã có `viewBox`, tự mang tỉ lệ theo mình.
- Hoặc asset nằm cố định trong gói, tỉ lệ biết trước từ lúc viết mã.
- Tắt mạng, tải chậm, load lỗi — dòng chữ bên dưới **không** dịch chuyển.

**Tự hỏi.** Nếu ảnh về sau ba giây, có một điểm ảnh nào bên dưới nó bị đẩy đi không? Nếu không —
`RATIO-0`. Nếu có, `RATIO-0` **không hợp lệ** và phải chọn một trong `RATIO-1`…`RATIO-5`.

**Ranh giới**

- `RATIO-5`: cả hai đều giữ nguyên hình dạng của nguồn, nhưng `RATIO-0` **biết** hình dạng đó từ
  trước, còn `RATIO-5` **không biết** và phải dựng một khung có chặn để hứng.
- `RATIO-4`: nếu kích thước tuy có trong dữ liệu nhưng phải tính ra rồi gán vào khung, đó là
  `RATIO-4` tính theo bản ghi, không phải `RATIO-0`.
- mọi mã còn lại: chỉ cần bố cục muốn các khung **khớp nhau**, `RATIO-0` đã bị loại — nguồn không
  có nghĩa vụ khớp với hàng xóm của nó.

**Không có "để trống cho lành".** Bỏ trống tỉ lệ vì chưa nghĩ ra nên chọn gì **không phải** `RATIO-0`.
`RATIO-0` là một khẳng định có bằng chứng: chỗ đã được giữ ở nơi khác. Mã này tồn tại để phân biệt
*đã quyết định là không cần khai* với *chưa quyết định gì*.

**Tình huống nghiệp vụ hay gặp.** Biểu tượng véc-tơ nội tuyến · biểu trưng trong gói · minh hoạ tĩnh trong trang
tài liệu · ảnh trong nội dung do bản dựng-time biết trước kích thước · sơ đồ SVG dựng bằng mã · biểu đồ
vẽ trực tiếp bằng thẻ, không tải ảnh.

---

## `RATIO-1` — bố cục cần ô vuông

**Tình huống.** Hình vuông không phải vì ảnh vuông, mà vì **các khung phải khớp nhau**: một hàng
ảnh đại diện, một lưới ô, một dải biểu tượng. Nguồn tuỳ ý, khung không đổi.

**Dấu hiệu nhận biết**

- Có nhiều khung cùng loại đứng cạnh nhau và phải đọc như một tập.
- Người dùng có thể tải lên ảnh bất kỳ chiều nào, và giao diện vẫn phải đều.
- Chủ thể nằm ở giữa hoặc ở trên; phần rìa bị cắt không mang thông tin.
- Bo tròn hoàn toàn (`rounded-full`) chỉ đúng khi khung đã vuông.

**Tự hỏi.** Nếu một khung ở đây rộng hơn khung bên cạnh, cái tập này có vỡ không? Nếu có — `RATIO-1`.

**Ranh giới**

- `RATIO-3`: `RATIO-1` chọn vuông vì **hàng xóm**; `RATIO-3` chọn 4:3 vì **chủ thể** cần chiều cao.
  Ảnh đại diện là `RATIO-1`; ảnh chụp sản phẩm đứng một mình là `RATIO-3`.
- `RATIO-5`: nếu cắt rìa làm mất thông tin — biểu trưng bị xén chữ, ảnh chụp màn hình bị mất cột — thì
  không được dùng `RATIO-1` kể cả khi lưới muốn vuông.
- `RATIO-4`: 1:1 là một tỉ lệ có tên sẵn. Viết `aspect-[1/1]` là đi vòng để nói cùng một điều.

**Tình huống nghiệp vụ hay gặp.** Ảnh đại diện người dùng · ảnh đại diện tổ chức · ô lưới thư viện ảnh · ảnh bìa
album · biểu tượng ứng dụng · ô sản phẩm trong lưới đều · ảnh thành viên trong trang giới thiệu ·
ảnh thu nhỏ vuông trong danh sách gợi ý · mã QR trong khung có nền.

---

## `RATIO-2` — nội dung động, hoặc ảnh đứng thay cho nó

**Tình huống.** Khung giữ thứ vốn được quay, phát hoặc trình chiếu — hoặc giữ **ảnh đại diện** cho
thứ đó. Ảnh đại diện phải mang đúng hình dạng của cái nó thay mặt, nếu không lúc bấm vào khung sẽ đổi
hình.

**Dấu hiệu nhận biết**

- Bấm vào thì mở ra một trình phát, một bản ghi màn hình, một buổi phát trực tiếp.
- Nguồn vốn được sản xuất theo khung ngang rộng.
- Có nút phát, thời lượng, hoặc trạng thái "đang phát" chồng lên.
- Nội dung nhúng của bên thứ ba mà mình không kiểm soát nội dung bên trong.

**Tự hỏi.** Thứ nằm sau cú bấm có phải là nội dung phát theo thời gian không? Nếu có — `RATIO-2`, kể
cả khi hiện tại đang hiển thị một tấm ảnh tĩnh.

**Ranh giới**

- `RATIO-3`: đây là ranh giới hay chọn sai nhất. Câu hỏi không phải "ảnh trông ngang hay dọc" mà
  "khung này thay mặt cho nội dung động hay cho một tấm ảnh". Ảnh bìa bài viết là `RATIO-3` hoặc
  `RATIO-4`; ảnh đại diện của một bản ghi hình là `RATIO-2`.
- `RATIO-4`: biểu ngữ rộng hơn 16:9 — 3:1, 21:9 — không phải `RATIO-2`. `RATIO-2` gắn với nội dung
  động, không gắn với "rộng".
- `RATIO-5`: bản ghi màn hình dọc, hoặc video người dùng tự quay bằng điện thoại, cắt vào 16:9 là
  mất hết. Lúc đó khung vẫn 16:9 nhưng nội dung `object-contain` — và đó là `RATIO-5`.

**Tình huống nghiệp vụ hay gặp.** Ảnh thu nhỏ bài giảng · trình phát video · nội dung nhúng video bên thứ ba ·
bản ghi buổi họp · ảnh đại diện buổi phát trực tiếp · ảnh chụp slide bài trình bày · xem trước bản ghi
màn hình · khung nhúng bản đồ tương tác.

---

## `RATIO-3` — ảnh chụp tĩnh cần chiều cao

**Tình huống.** Khung giữ **một tấm ảnh chụp**, và chủ thể của nó cần chiều dọc: người, món ăn, đồ
vật, không gian. Cắt vào 16:9 sẽ xén mất đầu hoặc chân của chủ thể.

**Dấu hiệu nhận biết**

- Nguồn là ảnh chụp thật, không phải đồ hoạ dựng.
- Khung đứng một mình hoặc trong lưới thưa, không phải một dải ảnh đại diện.
- Người đọc nhìn tấm ảnh vì **nội dung của ảnh**, không vì nó là nút bấm.
- Chủ thể có phần trên và phần dưới đều đáng giữ.

**Tự hỏi.** Cắt bớt chiều cao của tấm này thì người đọc mất gì? Nếu mất một phần chủ thể mà họ đến để
xem — `RATIO-3`, không phải `RATIO-2`.

**Ranh giới**

- `RATIO-2`: xem trên. Tiêu chí là *thay mặt cho cái gì*, không phải *trông ngang bao nhiêu*.
- `RATIO-1`: `RATIO-1` cần các khung khớp nhau; `RATIO-3` cần chủ thể đủ chỗ. Khi cả hai cùng đúng
  — một lưới ảnh chụp — hãy chọn mã **cắt ít hơn**, tức `RATIO-3`, rồi để lưới khớp bằng cột chứ
  không bằng việc ép vuông.
- `RATIO-4`: 4:3 là tỉ lệ có tên. Chỉ đi sang `RATIO-4` khi sản phẩm thật sự cần một con số khác.

**Tình huống nghiệp vụ hay gặp.** Ảnh bìa bài viết · ảnh phòng trong trang đặt chỗ · ảnh món ăn ·
ảnh chân dung giảng viên trong hồ sơ · ảnh sự kiện · ảnh minh hoạ trong thẻ nội dung · ảnh chụp sản
phẩm ở trang chi tiết · thư viện ảnh chuyến đi.

---

## `RATIO-4` — sản phẩm tự đặt một tỉ lệ

**Tình huống.** Không tỉ lệ có tên nào phục vụ được yêu cầu, nên sản phẩm **tự khai** một con số:
hoặc là hằng số cho cả một loại khung, hoặc tính ra từ kích thước mà **dữ liệu mang theo** cho từng
bản ghi.

**Dấu hiệu nhận biết**

- Khung có vai trò hình học riêng: dải ngang rất rộng, cột dọc rất cao, ô theo lưới của trang.
- Hoặc bản ghi có sẵn `width`/`height` và mỗi bản ghi giữ đúng hình dạng của mình.
- Con số được viết ra một lần, ở một chỗ, và mọi khung cùng loại dùng lại nó.

**Tự hỏi.** Con số này là quyết định của **sản phẩm**, hay chỉ là con số của **một tấm ảnh cụ thể**
mà mình vừa nhìn thấy? Nếu là của một tấm ảnh cụ thể thì đây không phải `RATIO-4`.

**Ranh giới**

- `RATIO-1`/`RATIO-2`/`RATIO-3`: nếu con số trùng 1:1, 16:9 hay 4:3 thì dùng mã có tên. `RATIO-4`
  không phải chỗ viết lại cùng một tỉ lệ bằng cú pháp khác.
- `RATIO-0`: `RATIO-0` là kích thước đã nằm trong mã đánh dấu từ lúc bản dựng. `RATIO-4` tính theo bản ghi
  là kích thước **về cùng dữ liệu** rồi mới trở thành khai báo.
- `RATIO-5`: `RATIO-4` vẫn **cắt**. Nếu bản ghi thiếu kích thước thì không được rơi về "không khai
  gì" — phải rơi về một mã đã khai và cắt.

**Tình huống nghiệp vụ hay gặp.** Biểu ngữ khuyến mãi rất rộng · ảnh bìa hồ sơ · thẻ chia sẻ mạng xã
hội · quảng cáo dạng cột dọc · ảnh do người dùng tải lên có lưu sẵn kích thước · ô lưới masonry · ảnh
bìa sách 2:3 · ảnh bìa danh mục theo lưới của trang · khung nhúng có tỉ lệ do bên cung cấp quy định.

---

## `RATIO-5` — hình dạng của nguồn chính là nội dung

**Tình huống.** Cắt tấm này là **xoá mất thông tin người đọc đến để xem**: một ảnh chụp màn hình mất
cột bên phải, một biểu trưng bị xén chữ, một biểu đồ mất trục, một trang tài liệu mất lề. Khung vẫn phải
khai một cái chặn để không nhảy, nhưng nội dung nằm **trọn vẹn** bên trong.

**Dấu hiệu nhận biết**

- Nguồn do người dùng hoặc bên thứ ba cung cấp, hình dạng tuỳ ý và không đoán trước được.
- Bốn cạnh của nguồn đều mang nghĩa: viền, trục, lề, khung bao.
- Nếu cắt, người đọc sẽ phải mở ảnh gốc ra để hiểu — tức là giao diện đã thất bại.
- Khung thường có nền riêng để phần thừa nhìn ra là phần thừa, không phải chỗ trống lỗi.

**Tự hỏi.** Nếu cắt tấm này theo khung, người đọc có phải mở bản gốc mới hiểu được không? Nếu có —
`RATIO-5`.

**Ranh giới**

- `RATIO-0`: `RATIO-0` biết trước kích thước nên không cần chặn; `RATIO-5` không biết nên **bắt
  buộc** phải có chặn — hoặc một tỉ lệ khung, hoặc một chiều cao cố định.
- `RATIO-1`…`RATIO-4`: bốn mã kia được cắt vì bố cục sở hữu hình dạng. Ở đây quyền sở hữu đó không
  còn, nên `object-cover` là sai bất kể khung trông đẹp đến đâu.
- **Từ chối cũng là một kết quả hợp lệ.** Khi nguồn chưa đo được và việc cắt là không chấp nhận được,
  đường ra đúng là **đo trước rồi mới khai** (chuyển thành `RATIO-4` tính theo bản ghi), chứ không
  phải hiển thị một khung không khai gì rồi chờ nó nhảy.

**Tình huống nghiệp vụ hay gặp.** Ảnh chụp màn hình đính kèm trong báo lỗi · biểu trưng đối tác trên một
dải · biểu đồ xuất ra dạng ảnh · trang tài liệu quét · ảnh đính kèm trong hội thoại hỗ trợ · chữ ký ·
ảnh minh chứng thanh toán · sơ đồ kiến trúc do người dùng tải lên · bản xem trước tệp đính kèm.

---

## Luật

1. Khung khai tỉ lệ; nội dung đa phương tiện lấp đầy khung. **Một khung, một chủ sở hữu hình dạng.**
2. Khung đã khai tỉ lệ thì phải khai luôn `fit`. Khai một nửa là chưa quyết định.
3. Đã cắt thì phải nói cắt **từ đâu**. Cắt giữa là một lựa chọn, không phải sự vắng mặt của lựa chọn.
4. Không đặt tỉ lệ và chiều cao cố định lên cùng một khung — hai lời khai cho một sự thật, và một
   trong hai sẽ thắng trong im lặng.
5. Khung có cắt thì phải cắt thật (`overflow-hidden`), nếu không phần thừa sẽ tràn ra ngoài bo góc.
6. Khung chờ, văn bản gợi ý, trạng thái lỗi và trạng thái đã tải dùng **chung một khung**. Bằng chứng
   của một tỉ lệ đã khai là **không có gì dịch chuyển** giữa các trạng thái đó.
7. `RATIO-0` chỉ hợp lệ khi khung **không thể** nhảy. Không biết chọn gì nên bỏ trống thì không phải
   `RATIO-0`.
8. Nếu hai mã liền kề cùng hợp lý, chọn mã **cắt ít hơn**; chỉ hỏi khi bên yêu cầu nói rõ họ cần hình
   dạng cắt nhiều hơn.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Art hướng.** Tỉ lệ được phép đổi theo khung nhìn khi **vai trò bố cục** thật sự đổi — vuông
  trong luồng tin hẹp, rộng theo băng ngang trên máy tính. Cả hai tỉ lệ đều phải là mã đã khai, `fit`
  **không** đổi theo, và lý do phải là một dữ kiện bố cục chứ không phải sở thích.
- **Véc-tơ nội tuyến.** Thứ đã có `viewBox` là `RATIO-0`. Gắn thêm tỷ lệ class CSS vào nó là lời khai thứ
  hai cho cùng một sự thật.
- **Dữ liệu mang kích thước.** Có `width`/`height` trong bản ghi thì `RATIO-4` tính theo bản ghi.
  Thiếu thì rơi về một mã đã khai và cắt — **không** rơi về không khai gì.
- **Nội dung nhúng bên thứ ba.** Không kiểm soát được bên trong không có nghĩa là không sở hữu cái khung. Khai
  `RATIO-2` hoặc `RATIO-4` rồi cho nội dung nhúng lấp tuyệt đối.
- **Dải chiều cao cố định.** Một hàng biểu trưng hay một ảnh thu nhỏ cao bằng dòng được phép chặn **chiều
  cao** thay vì chặn tỉ lệ. Chỉ hợp lệ dưới `RATIO-5`, nơi chiều cao là cái chặn còn hình dạng vẫn
  thuộc về nguồn.
- **Thiết kế đáp ứng.** Đổi số cột, đổi bề rộng khung **không** đổi mã. Chỉ có thay đổi vai trò bố cục mới
  được kích hoạt ngoại lệ art hướng ở trên.
