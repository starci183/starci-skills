---
id: fe-patterns-cache-key-vi
title: vi.md
slug: /fe/patterns/cache-key/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống CACHE-N, nhận diện bằng nghiệp vụ chứ không bằng cảm giác về hiệu năng.
---

# vi.md

> Version: `2.00` · Module: `cache-key`

# Cache key

Cache key là **tên của một câu trả lời**. Mọi thứ dùng chung một key là dùng chung câu trả lời đó —
dữ liệu, lỗi, và với một mutation thì cả trạng thái đang chạy. Nên key không phải cái nhãn dán vào
request sau khi đã gọi. Nó **là câu hỏi, viết ra thành chữ**.

Vì thế key là một lời khẳng định, và lời khẳng định đó kiểm được:

> Câu trả lời này đúng với **bất kỳ ai** hỏi đúng câu hỏi này.

Nếu hai người gọi cùng sinh ra một key mà cần hai câu trả lời khác nhau, thì key đang đặt tên cho một
thứ **thô hơn** câu trả lời nó đang giữ — và một trong hai người sẽ đọc phải phần của người kia.

Câu hỏi quyết định một mảnh có thuộc về key hay không:

> Nếu giá trị này khác đi, câu trả lời có khác đi không?

Khác thì mảnh đó **thuộc về key**. Không khác thì đó là nhiễu: nó xé một entry thành nhiều entry và
bắt fetch lại mà chẳng đổi được gì.

**Đây là luật bắt buộc.** Mỗi hook đặt tên cho một câu trả lời được cache đều rơi vào ít nhất một mã
dưới đây. Không có query nào nhỏ đến mức được miễn: câu "có mỗi một chuỗi thôi mà" chính là chỗ một
câu trả lời riêng tư đánh mất người đọc của nó nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Key phải có |
|---|---|---|
| `CACHE-1` | Câu trả lời đổi theo một giá trị nào đó | Giá trị đó nằm **trong** key, và fetcher đọc tham số **ra từ** key |
| `CACHE-2` | Câu trả lời tính từ *ai đang hỏi* | Một fingerprint ổn định, không đảo ngược được, của phiên đăng nhập |
| `CACHE-3` | Một hành động bấm trên **từng dòng** của một danh sách | Id của dòng đó, mỗi dòng một hook |
| `CACHE-4` | Còn một mảnh chưa biết | `null` — chưa có câu hỏi thì chưa hỏi |
| `CACHE-5` | Kết quả có thể là `null` | Nghĩa của `null` viết ngay tại chỗ bóc kết quả; lỗi vẫn là lỗi |

---

## `CACHE-1` — mọi giá trị làm đổi câu trả lời đều nằm trong key

**Tình huống.** Câu trả lời phụ thuộc vào một giá trị: một bộ lọc, một trang, một ngôn ngữ, một
khoảng thời gian. Cache **không so sánh request**, nó so sánh key. Hai lần gọi cùng một key là **một**
entry, và người gọi thứ hai được phục vụ bằng câu trả lời của người thứ nhất, không có request nào đi
ra cả.

Đó vừa là toàn bộ ý nghĩa của cache, vừa là toàn bộ cách nó hỏng. Một mảnh mà câu trả lời phụ thuộc
vào nhưng key bỏ quên **không** thỉnh thoảng cho ra dữ liệu cũ — nó cho ra dữ liệu **sai, một cách
tất định**. Và nó trông đúng, vì một câu trả lời hợp lý cho câu hỏi sai thì không phân biệt được với
câu trả lời đúng.

Cùng lý do đó quyết định fetcher lấy tham số ở đâu: **đọc ra từ key**, không đóng gói (`closure`)
tham số nó được gọi kèm. Key và closure là **hai bản sao của một sự thật**, và sau một lần re-render
hai bản đó có thể lệch nhau — entry khi ấy được xếp dưới tên của câu hỏi này nhưng giữ câu trả lời
của câu hỏi kia.

**Dấu hiệu nhận biết**

- Có một biến nào đó xuất hiện trong request nhưng không xuất hiện trong key.
- Fetcher không nhận tham số nào từ key mà vẫn gọi được — nghĩa là nó đang đọc từ scope ngoài.
- Đổi bộ lọc trên màn hình mà dữ liệu không đổi, hoặc đổi rồi lại nhảy về giá trị cũ.
- Ngược lại: key chứa một giá trị mà server không hề dùng tới, và mỗi lần nó đổi lại thấy fetch lại.

**Tự hỏi.** Nếu giá trị này khác đi, server có trả về thứ khác không? Có ⇒ vào key. Không ⇒ ra khỏi
key.

**Ranh giới**

- ↔ `CACHE-2`: người đọc cũng là một mảnh, nhưng nó có mã riêng vì nó hỏng theo một kiểu khác —
  hỏng khi **đăng xuất**, không phải khi đổi tham số.
- ↔ `CACHE-3`: id của item cũng là một mảnh, nhưng với mutation nó còn quyết định **trạng thái đang
  chạy** chứ không chỉ dữ liệu.
- ↔ `CACHE-4`: `CACHE-1` nói mảnh nào **phải có**; `CACHE-4` nói phải làm gì khi mảnh đó **chưa có**.

**Tình huống nghiệp vụ hay gặp.** Danh sách có bộ lọc và phân trang · tìm kiếm theo từ khoá · báo cáo
theo khoảng ngày · nội dung theo ngôn ngữ đang phục vụ · chi tiết một bản ghi theo id · bảng xếp hạng
theo phạm vi (tuần/tháng) · giỏ hàng theo mã khuyến mãi đang áp.

---

## `CACHE-2` — câu trả lời riêng tư phải mang người đọc trong key

**Tình huống.** Câu trả lời được **tính ra từ chính người đang hỏi**. Đó không phải dữ liệu chung tình
cờ nằm sau lớp đăng nhập; đó là **mỗi người một câu trả lời khác nhau**, và một key không nhắc tới
người đọc thì đang hứa điều ngược lại.

Hai kiểu hỏng nối nhau, và kiểu thứ hai nặng hơn kiểu thứ nhất. **Đăng nhập vào không thay đổi gì**,
vì key không đổi — người vừa đăng nhập tiếp tục đọc đúng cái lời từ chối đã fetch một giây trước đó.
**Đăng xuất ra cũng không thay đổi gì**, nên người tiếp theo trên cái tab ấy đọc được số liệu của
người trước — và những con số đó trông hoàn toàn hợp lý.

Cả hai đều hết khả năng xảy ra ngay khi người đọc trở thành một mảnh của key: đổi người đọc là đổi
key, mà một key chưa từng fetch thì không có gì để phục vụ cả.

Thứ đưa vào là **fingerprint ổn định và không đảo ngược được** của phiên, **không bao giờ** là chính
credential. Key được đưa cho devtools, cho mọi công cụ soi cache, và cho bất cứ chỗ nào log key lại
khi một request thất bại; một bearer token nằm ở đó là đúng cái sai lầm của một bearer token nằm
trong web storage. Fingerprint **không phải** một biên giới bảo mật và không tự nhận là như vậy — nó
chỉ cần **khác đi khi người đọc khác đi**.

**Dấu hiệu nhận biết**

- Tên query có chữ "của tôi", "đang theo dõi", "đã mua", "còn lại", "dành cho bạn".
- Server đọc danh tính từ header để tính ra kết quả, chứ không chỉ để cho phép truy cập.
- Đăng xuất rồi mà màn hình vẫn còn số liệu cũ cho tới khi F5.
- Vừa đăng nhập xong mà vẫn thấy trạng thái "hãy đăng nhập".

**Tự hỏi.** Hai người cùng đăng nhập, cùng gọi query này, có nhận về hai kết quả khác nhau không?

**Ranh giới**

- ↔ `CACHE-1`: nằm sau auth **không** đồng nghĩa với riêng tư. Một catalog công khai đặt trong route
  đã đăng nhập vẫn là câu trả lời chung — thêm người đọc vào key chỉ nhân bản một entry giống hệt
  nhau cho từng người.
- ↔ `CACHE-4`: khi chưa biết người đọc là ai, `CACHE-2` nói "phải có mảnh này", còn `CACHE-4` nói
  "chưa có thì key là `null`". Hai mã luôn đi cùng nhau ở các query riêng tư.

**Tình huống nghiệp vụ hay gặp.** Bảng điều khiển cá nhân · tiến độ học · giỏ hàng · thông báo · số
dư và hạn mức · giá đã áp ưu đãi theo hạng thành viên · danh sách đang theo dõi · quyền truy cập một
nội dung trả phí.

---

## `CACHE-3` — hành động trên từng dòng phải mang dòng đó trong key

**Tình huống.** Các hook dùng chung một key thì dùng chung **trạng thái**, không chỉ dữ liệu. Với một
mutation, trạng thái đó bao gồm `isMutating` — đúng cái mà một nút bấm đọc để biết mình đang chạy.

Nên một key duy nhất trải khắp một danh sách sẽ tạo ra: bấm **một** dòng, cả cột nút cùng quay
spinner, và mọi dòng khác bị disable vì một cú bấm mà người đọc không hề thực hiện.

Item chính là thứ làm cho cú bấm này **khác** cú bấm ở dòng bên cạnh. Thiếu nó trong key, thì với
cache, cả danh sách chỉ có đúng một cái nút.

**Dấu hiệu nhận biết**

- Hook mutation được gọi trong một component render lặp lại theo `map`.
- Nút "Thêm", "Xoá", "Theo dõi", "Thích" nằm trên từng dòng.
- Bấm một cái, cả lưới cùng hiện trạng thái đang chạy.

**Tự hỏi.** Trên màn hình có bao nhiêu cái nút đang tồn tại cùng lúc cho hành động này? Nhiều hơn một
⇒ key phải phân biệt được chúng.

**Ranh giới**

- ↔ `CACHE-1`: `CACHE-1` nói về **dữ liệu** trả về; `CACHE-3` nói về **trạng thái đang chạy** dùng
  chung. Một mutation có thể sai `CACHE-3` mà dữ liệu trả về vẫn đúng.
- ↔ Ngoại lệ **hành động hàng loạt**: xoá sạch giỏ, đánh dấu đã đọc tất cả — chủ thể thật sự **là**
  cả danh sách, chỉ có một cú bấm và một trạng thái chạy, nên key không có item. Hành động trên từng
  dòng và hành động hàng loạt là **hai hành động khác nhau**, không phải một hành động đánh key theo
  hai kiểu.

**Tình huống nghiệp vụ hay gặp.** Thêm vào giỏ trên từng thẻ · theo dõi/bỏ theo dõi trên từng hồ sơ ·
thả cảm xúc trên từng bài · xoá một dòng trong bảng · ghim/bỏ ghim · duyệt từng yêu cầu · gửi lại một
email trong danh sách.

---

## `CACHE-4` — chưa đủ mảnh thì key là `null`, không phải một key có lỗ

**Tình huống.** Mọi mảnh phải **đã biết** thì câu hỏi mới tồn tại. Trong lúc còn một mảnh là
`undefined` — người đọc trước khi phiên giải xong, một id thuộc về một placeholder đang nghỉ, một
tham số của một surface chưa ai mở — hook truyền `null` và **không fetch gì cả**.

Cái thay thế còn tệ hơn một request lãng phí. Một key dựng quanh một mảnh còn thiếu là đi hỏi một
điều **không ai muốn biết**, rồi cache câu trả lời dưới một cái tên mà **không người gọi nào sau này
sinh ra lại được**. Một query cần token mà bắn đi khi chưa có token thì không thất bại một lần: nó
thất bại theo một vòng retry có backoff, và **mỗi lần lại tự báo là đang tải** — đó chính là cách một
màn hình đã đăng xuất cứ nhấp nháy skeleton trước mặt một người không hề chờ đợi gì.

Một **placeholder** thay cho mảnh còn thiếu là đúng cái lỗi đó khoác lên mình một cái key hợp lệ:
chuỗi rỗng, số không, hay chữ `guest` sinh ra một entry **thật**, giữ một câu trả lời **thật** cho một
câu hỏi người gọi **không hỏi** — và về sau chẳng có dấu hiệu nào để nhìn ra là nó hỏng.

**Dấu hiệu nhận biết**

- Trong key có `??`, `||`, hoặc một literal `""` / `0` / `"guest"` / `"anonymous"`.
- Có một tham số kiểu `id?: string` nhưng key vẫn được dựng vô điều kiện.
- Màn hình đã đăng xuất mà vẫn thấy skeleton chạy mãi.
- Devtools thấy cùng một request lặp lại theo chu kỳ giãn dần, đều thất bại.

**Tự hỏi.** Trong lần render **đầu tiên**, mảnh nào còn là `undefined`? Mảnh đó có nằm trong key
không?

**Ranh giới**

- ↔ `CACHE-1`: `CACHE-1` sai vì **thiếu** một mảnh lẽ ra phải có; `CACHE-4` sai vì **bịa** ra một
  mảnh chưa tới.
- ↔ `CACHE-5`: `CACHE-4` nói về `null` ở vị trí **key** (chưa hỏi). `CACHE-5` nói về `null` ở vị trí
  **kết quả** (đã hỏi, và câu trả lời là không có gì). Hai chữ `null` này không liên quan gì đến
  nhau, và lẫn chúng là hiểu nhầm hay gặp nhất của module này.

**Tình huống nghiệp vụ hay gặp.** Query cần đăng nhập trong lúc phiên đang khôi phục · chi tiết một
bản ghi khi id đến từ route param còn chưa parse · dữ liệu của một tab chưa được mở · nội dung trong
một modal chưa bật · hàng trong danh sách đang ở trạng thái skeleton.

---

## `CACHE-5` — thất bại và rỗng là hai câu trả lời khác nhau

**Tình huống.** "Request không tới nơi" và "thật sự không có gì" muốn **hai câu chữ khác nhau trên
màn hình**, và một fetcher gộp lỗi thành `null` đã **phá huỷ sự khác biệt đó trước khi** bất kỳ người
gọi nào kịp phân biệt. Một thất bại phải **vẫn là thất bại** — nó thuộc về `error` của hook, nơi
người gọi có thể quyết định thử lại, nói ra, hoặc chủ động lùi về một phương án khác.

Nhờ vậy `null` được rảnh tay để mang **đúng một** nghĩa, và **hook là chỗ ghi nghĩa đó xuống**, ngay
cạnh đoạn bóc kết quả sinh ra nó: một bản xem trước giá trả `null` khi không tính được mức giá riêng
cho người này, nên màn hình lấy giá niêm yết mà hiển thị — đó là câu trả lời **trung thực**, không
phải một lỗi bị nuốt. Người gọi không suy ra được điều đó từ kiểu dữ liệu, và **không được phép phải
đoán**.

**Dấu hiệu nhận biết**

- Trong fetcher có `try { … } catch { return null }`.
- Kiểu trả về là `T | null` mà không có một dòng nào nói `null` nghĩa là gì.
- Màn hình hiện "chưa có dữ liệu" trong khi mạng đang hỏng.
- Mỗi component tự diễn giải `null` theo một cách, và chúng không giống nhau.

**Tự hỏi.** Khi thấy `null` ở chỗ đọc, người đọc màn hình nên thấy chữ gì? Nếu câu trả lời phụ thuộc
vào việc request có tới nơi hay không, thì `null` đang gánh hai nghĩa.

**Ranh giới**

- ↔ `CACHE-4`: xem trên — `null` của key và `null` của kết quả là hai thứ.
- ↔ Ngoại lệ **`null` là thất bại theo hợp đồng**: fetcher vẫn được trả `null` cho một dạng thất bại
  mà người gọi **phải** xử lý như rỗng — nhưng chỉ khi chính server phân biệt được hai thứ đó và hook
  ghi sự phân biệt ấy xuống tại chỗ bóc. Một `catch` không có kiểu **không bao giờ** là trường hợp
  này.

**Tình huống nghiệp vụ hay gặp.** Xem trước giá riêng · trạng thái ưu đãi đang áp dụng · hồ sơ mở
rộng có thể chưa tạo · phiên gần nhất có thể chưa từng có · bản nháp chưa lưu · số liệu của một kỳ
chưa chốt.

---

## Luật

1. Key chứa **mọi** giá trị câu trả lời đổi theo, và **không** chứa gì khác.
2. Fetcher lấy tham số **ra từ key**, không lấy từ scope ngoài.
3. Câu trả lời riêng tư nêu tên người đọc; câu trả lời chung thì không.
4. Mảnh người đọc là **fingerprint**, không bao giờ là credential.
5. Hành động trên từng dòng nêu tên dòng đó; một hook phục vụ một dòng.
6. Key chưa đủ mảnh là `null`. **Không có** mảnh thay thế.
7. Thất bại tới tay người gọi qua `error` của hook, không bao giờ qua dữ liệu.
8. Nghĩa của một `null` được ghi ngay tại chỗ sinh ra nó.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Câu trả lời thật sự dùng chung.** `CACHE-2` không áp dụng cho câu trả lời giống hệt nhau với mọi
  người đọc. Nằm sau lớp đăng nhập là một dữ kiện khác với được tính ra từ người đọc.
- **Token làm mới thì fetch lại.** Ở `CACHE-2`, token được gia hạn làm fingerprint đổi và tốn một lần
  fetch lại. Chấp nhận có chủ đích: phương án còn lại là giải mã credential để lấy claim định danh,
  tức là đẩy một hook cache vào việc phân tích credential.
- **Key chỉ có prefix, không có mảnh nào.** Ở `CACHE-1`, một key hằng là đúng khi câu trả lời thật sự
  là một câu trả lời cho tất cả mọi người, mãi mãi — một tài liệu cấu hình tĩnh, một changelog công
  khai. Nó hết đúng ngay khi câu trả lời bắt đầu đổi theo bất cứ thứ gì.
- **Hành động hàng loạt.** Ở `CACHE-3`, hành động mà chủ thể thật sự **là** cả danh sách thì key
  không mang item, vì chỉ có một cú bấm và một trạng thái chạy.
- **`null` là thất bại theo hợp đồng.** Ở `CACHE-5`, chỉ hợp lệ khi server phân biệt được và hook ghi
  sự phân biệt đó xuống tại chỗ bóc kết quả. `catch` trống không phải trường hợp này.
