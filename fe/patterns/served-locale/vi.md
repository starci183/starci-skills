---
id: fe-patterns-served-locale-vi
title: vi.md
slug: /fe/patterns/served-locale/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã LOCALE-N, nhận diện bằng nghiệp vụ chứ không bằng cảm giác "chỗ này chắc dịch rồi".
---

# vi.md

> Version: `2.00` · Module: `served-locale`

# Served locale

Có những dữ liệu được **dịch ở phía server**. Một tài liệu, một thân bài, một tên danh mục — API lưu
mỗi ngôn ngữ một bản và trả về đúng bản mà nó **được hỏi**. Nghĩa là request phải hỏi. Và một request
không nói gì thì nhận bản mặc định của server, mãi mãi, ở mọi ngôn ngữ.

Câu hỏi phân định mọi trường hợp:

> Một người đọc ở ngôn ngữ khác có nhận về **dữ liệu khác** từ lời gọi này không?

Nếu có — request phải khai báo locale, và phải khai báo ở **một chỗ**, không phải ở từng call site.

**Đây không phải luật dịch chữ.** Luật `translation` quyết định **ai chọn chữ** bên trong cây
component. Luật này quyết định **request khai báo cái gì** trên đường đi ra. Một màn hình có thể tuân
thủ luật kia hoàn hảo — mọi label resolve ở nửa connected, không literal nào dưới block — mà vẫn trả
cho người đọc tiếng Việt một tài liệu tiếng Anh, vì phần khung lấy từ từ điển còn phần nội dung lấy
từ một API chưa bao giờ được cho biết phải phục vụ ngôn ngữ nào.

Đó cũng là lý do hỏng theo kiểu này **đắt**: nó trông giống một lỗ hổng bản dịch, nên người ta đi tìm
trong từ điển, nơi không có gì sai cả.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `LOCALE-1` | Một chain transport được dựng ra mà không gắn locale | Gắn link locale vào chain, **vô điều kiện**, cạnh link auth |
| `LOCALE-2` | Có ý định truyền `locale` xuống hook hoặc query function | Link tự đọc địa chỉ; không ai phải nhớ truyền gì |
| `LOCALE-3` | Trông cậy vào cookie để mang ngôn ngữ sang một API khác origin | Gửi header; cookie không đi qua ranh giới đó |
| `LOCALE-4` | Bản mặc định của server trả về trông vẫn đúng nên coi như xong | Bản mặc định là **sàn**, không phải fallback được phép dựa vào |
| `LOCALE-5` | Một call site tự tay set header ngôn ngữ | Chỉ link locale được viết header đó |

---

## `LOCALE-1` — chain nào cũng khai báo, và khai báo vô điều kiện

**Tình huống.** Có một chỗ trong ứng dụng lắp ráp đường truyền: retry, timeout, auth, rồi link cuối
cùng thật sự chạm mạng. Locale phải đi cùng **ở đó**, chứ không phải trong cái hook tình cờ đang cần
tới nó.

**Dấu hiệu nhận biết**

- File đang dựng ra link terminal — link duy nhất nói chuyện với network.
- Chain đã đầy đủ: có retry, có timeout, có token, và **câm về ngôn ngữ**.
- Việc gắn locale đang bị đặt sau một điều kiện: chỉ khi đã đăng nhập, chỉ ở một route, chỉ khi bật
  một cờ.

**Tự hỏi.** Nếu tôi gắn locale ở tầng hook thay vì ở chain, thì người tiếp theo viết hook mới có
**phải nhớ** gắn không? Nếu có — sai chỗ rồi.

**Vì sao vô điều kiện.** Khách vãng lai cũng đọc bằng một ngôn ngữ. Khác với bearer token, ở đây
không có nhánh ẩn danh nào **được phép** không khai báo gì. Đặt locale sau cờ `withAuth` là biến toàn
bộ nội dung công khai — thứ mà đa số người đọc thấy trước tiên — thành tiếng mặc định.

**Ranh giới**

- ↔ `LOCALE-5`: `LOCALE-1` nói **phải có** một chỗ gắn; `LOCALE-5` nói **chỉ được có một** chỗ. Thiếu
  chain là `LOCALE-1`; hai chỗ cùng viết là `LOCALE-5`.
- ↔ `LOCALE-2`: chain **có** link locale nhưng link đó lấy giá trị từ đâu là chuyện của `LOCALE-2`.
  Một link gắn `"en"` cứng vẫn thoả `LOCALE-1`.

**Ngoại lệ đóng.** File **là một link** thì không phải là chain. File định nghĩa link terminal dựng ra
link đó vì đấy là việc của nó; nhét một link locale vào bên trong một link là giấu cả chain vào trong
một mắt xích. Ngoại lệ này được tìm ra bằng cách **chạy** rule, không phải bằng cách nghĩ ra.

**Tình huống nghiệp vụ hay gặp.** Client ẩn danh cho trang public · client có auth cho khu vực đăng
nhập · client riêng cho upload · client dựng trong một script hoặc một worker · client thứ hai được
thêm vào cho một tính năng mới và copy từ client cũ **trước khi** locale được thêm vào client cũ.

---

## `LOCALE-2` — đọc từ địa chỉ, không nhận từ tham số

**Tình huống.** Giá trị locale phải đến từ đâu đó. Có hai kiểu nguồn: kiểu **phải có người nhớ truyền**
và kiểu **tự có sẵn ở nơi request được lắp ráp**. Luật chọn kiểu thứ hai.

**Dấu hiệu nhận biết**

- Một hook có tham số `locale` trong signature.
- Một query function nhận `headers` từ bên ngoài chỉ để nhét ngôn ngữ vào.
- Một SWR key có thêm `locale` để "cache cho đúng" — dấu hiệu là locale đang đi bằng tay.

**Tự hỏi.** Giá trị này đến bằng cách **suy ra**, hay bằng cách **được truyền**? Nếu được truyền, thì
người viết hook tiếp theo có gì nhắc họ?

**Vì sao là địa chỉ.** URL đã mang ngôn ngữ của người đọc, và middleware đã redirect họ tới đúng đó.
Đó vừa là tuyên bố ý định mạnh nhất, vừa — quan trọng hơn — là thứ **không ai phải nhớ truyền**. Một
tham số bị bỏ sót không báo lỗi: lời gọi vẫn thành công và trả về ngôn ngữ mặc định.

**Ranh giới**

- ↔ `LOCALE-1`: xem trên. Có link mà lấy sai nguồn là `LOCALE-2`; không có link là `LOCALE-1`.
- ↔ `LOCALE-3`: cookie **là** một nguồn hợp lệ cho link đọc (nó nằm cùng phía client). `LOCALE-3` cấm
  cookie làm **phương tiện vận chuyển** sang server, không cấm nó làm **nguồn đọc** ở client.
- ↔ `LOCALE-4`: rơi về app default vì không đọc được địa chỉ là một nhánh đã đóng của `LOCALE-2`;
  coi cái default đó là "đã xong" thì thành `LOCALE-4`.

**Seam cho test không phải tham số.** Một link được phép nhận một hàm resolve để spec cố định giá trị.
Điều kiện: call site production **không truyền gì**, và mặc định là hàm suy ra. Ngày một call site
production bắt đầu truyền, cái seam đã trở thành đúng cái tham số mà mã này cấm.

**Tình huống nghiệp vụ hay gặp.** Hook chi tiết khoá học · hook danh sách có filter · query function
chạy trên server component · một hook mới copy từ hook cũ · một trang chia sẻ link có prefix ngôn ngữ.

---

## `LOCALE-3` — cookie không đi qua ranh giới origin

**Tình huống.** Ứng dụng nhớ lựa chọn của người đọc trong một cookie, và server hoàn toàn có khả năng
đọc cookie đó. Cả hai điều đều đúng, và **không điều nào** làm cho giá trị đi được sang một origin
khác.

**Dấu hiệu nhận biết**

- API nằm ở domain khác với app.
- Chain gửi request ẩn danh, và đường ẩn danh cố ý **không** bật credentials.
- Có người đang lập luận "server đọc cookie rồi mà" để kết luận không cần header.

**Tự hỏi.** Trên đúng đường mà request này đi — ẩn danh, cross-origin — cookie **có thật sự được gửi**
không?

**Vì sao đắt.** Đây là dạng đúng tốn kém nhất: đúng về nguyên tắc, sai về thực tế. Server có code đọc
cookie, code đó chạy, và nó không bao giờ nhận được gì. Không ai thấy lỗi; chỉ thấy nội dung sai
ngôn ngữ.

**Đừng sửa bằng cách bật credentials.** Đường ẩn danh không bật credentials là một quyết định có lý
do riêng: gửi cookie sang một API cross-origin chưa opt-in chỉ tạo ra lỗi CORS, và nó kéo theo cả một
phạm vi bảo mật khác. Cách sửa là **gửi header**.

**Ranh giới**

- ↔ `LOCALE-2`: cookie làm **nguồn đọc** phía client thì hợp lệ; cookie làm **phương tiện** sang
  server thì không.
- ↔ `LOCALE-4`: `LOCALE-3` là lý do phổ biến nhất khiến `LOCALE-4` xảy ra — không gửi được gì nên
  nhận về bản mặc định.

**Tình huống nghiệp vụ hay gặp.** App và API khác domain · API sau một gateway riêng · môi trường
preview có domain tạm · request từ server component (không có cookie của trình duyệt trong tay) ·
request từ một worker.

---

## `LOCALE-4` — mặc định của server là sàn, không phải fallback

**Tình huống.** Server trả lời một request không khai báo bằng tiếng mặc định. Đó là server đang
**cẩn thận**, không phải server đang **cho phép**.

**Dấu hiệu nhận biết**

- Trang chạy, không có lỗi, nội dung đọc được — chỉ là đọc được bằng ngôn ngữ khác.
- Có người kết luận "fallback hoạt động tốt".
- Người test và người đọc thật không cùng một ngôn ngữ.

**Tự hỏi.** Câu trả lời này đúng vì **request đã nói rõ**, hay đúng vì **tôi tình cờ đọc đúng ngôn
ngữ mặc định**?

**Vì sao phải nói ra.** Coi bản mặc định là fallback biến một header thiếu thành một **quyết định sản
phẩm ngầm**: "người đọc ngôn ngữ khác thì đọc tạm tiếng mặc định". Không ai từng quyết định như vậy,
và người duy nhất phát hiện ra là người đang bị phục vụ sai ngôn ngữ.

**Ranh giới**

- ↔ `LOCALE-1` và `LOCALE-3`: hai mã đó là **nguyên nhân**; `LOCALE-4` là **cách người ta bỏ qua** hậu
  quả.
- ↔ `LOCALE-2`: nhánh không có địa chỉ để đọc rơi về app default là một ngoại lệ đóng; dựa vào nó ở
  nhánh có địa chỉ thì là `LOCALE-4`.

**Tình huống nghiệp vụ hay gặp.** QA chạy toàn bộ ở ngôn ngữ mặc định · smoke test chỉ kiểm status
200 · một môi trường staging chỉ seed một ngôn ngữ · một report bug bị đóng vì "không tái hiện được".

---

## `LOCALE-5` — một chỗ viết header, nên một chỗ kiểm được

**Tình huống.** Header ngôn ngữ do link locale viết, và không do gì khác viết. Một call site tự set
thêm là **câu trả lời thứ hai** cho cùng một câu hỏi.

**Dấu hiệu nhận biết**

- Có một object `headers` ở tầng hook hoặc query có khoá ngôn ngữ.
- Có một hằng số ngôn ngữ được viết cứng ngay tại chỗ gọi.
- Có hai chỗ trong repo cùng chứa chuỗi header đó.

**Tự hỏi.** Nếu ngày mai nguồn locale đổi, tôi phải sửa **bao nhiêu** chỗ mới đúng lại?

**Vì sao một chỗ.** Hai chỗ cùng trả lời không phải là dư thừa vô hại: chúng **phân kỳ ngay lần đầu**
một trong hai được cập nhật. Kết quả điển hình là một hook đúng và toàn bộ phần còn lại của bề mặt
nằm ở ngôn ngữ mặc định — đúng cái trạng thái khó chẩn đoán nhất, vì có bằng chứng cho thấy "chỗ này
làm được mà".

**Ranh giới**

- ↔ `LOCALE-1`: thiếu hẳn là `LOCALE-1`; thừa một chỗ là `LOCALE-5`.
- ↔ `LOCALE-2`: một call site vừa set header vừa nhận `locale` qua tham số vi phạm cả hai; ghi cả hai
  mã, đừng chọn một.

**Tình huống nghiệp vụ hay gặp.** Một hook được "vá nhanh" cho kịp release · một script seed dữ liệu ·
một test helper bị copy vào production · một request tới endpoint thứ hai được viết tay ngoài chain.

---

## Luật

1. Chain nào dựng ra link terminal thì chain đó gắn locale.
2. Việc gắn là **vô điều kiện**; khách vãng lai cũng đọc bằng một ngôn ngữ.
3. Locale được **suy ra** ở nơi request được lắp ráp, không được **truyền vào** đó.
4. Địa chỉ là nguồn mạnh nhất và là nguồn duy nhất không ai phải nhớ.
5. Cookie không phải phương tiện khi API khác origin.
6. Bản mặc định của server là sàn nằm dưới một khai báo, không phải thứ đã trả lời.
7. Đúng **một** file viết header đó.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **File là một link, không phải một chain (`LOCALE-1`).** File định nghĩa link terminal không có cách
  nào đúng để gắn locale. Ngoại lệ theo **đường dẫn**, và nó được đo ra chứ không được đoán ra.
- **Spec (`LOCALE-1`).** Một spec khẳng định **về** một chain chứ không **là** một chain.
- **Chính file link locale (`LOCALE-5`).** Chỗ duy nhất được viết header được nhận diện bằng đường
  dẫn, vì cả luật lẫn rule đều cần một cái tên để chỉ vào.
- **Seam cho test (`LOCALE-2`).** Nhận một hàm resolve để spec cố định giá trị là hợp lệ khi call site
  production không truyền gì.
- **Render không có địa chỉ (`LOCALE-2`, `LOCALE-4`).** Nơi không có địa chỉ để đọc, resolver trả app
  default thay vì bỏ trống header, và lần fetch phía client sửa lại. Ngoại lệ đóng ở đúng nhánh đó;
  giá phải trả của nó được tranh luận ở `audit.md`.
