---
title: Served-locale · Vietnamese
module: served-locale
kind: pattern
codes: [LOCALE-1, LOCALE-2, LOCALE-3, LOCALE-4, LOCALE-5]
---

# Ngôn ngữ được phục vụ

Đầu vào của pattern này là một shape đã được duyệt: một màn hình, một capability, một hợp đồng dữ liệu
mà câu trả lời của nó được dịch ở phía server. Quyết định "bề mặt này phải hiện ra bằng ngôn ngữ của
người đọc" không được mở lại ở đây. Cái pattern này sinh ra là **kiến trúc source** — file nào lắp ráp
chain transport, file nào suy ra locale, file nào được phép viết chuỗi header, và mỗi file đó được
phép nhận tham số gì. Shape nói người đọc nhận đúng ngôn ngữ của mình; pattern này nói điều đó trở
thành sự thật ở chỗ nào trong cây source.

## Luật

Có những dữ liệu được **dịch ở phía server**. Một tài liệu, một thân bài, một tên danh mục — API lưu
mỗi ngôn ngữ một bản và trả về đúng bản mà nó **được hỏi**. Nghĩa là request phải hỏi. Và một request
không nói gì thì nhận bản mặc định của server, mãi mãi, ở mọi ngôn ngữ.

Việc khai báo thuộc về **transport**, không thuộc về người gọi. **Chain nào chạm tới mạng thì chain đó
gắn locale, và đúng một file viết nó.** Một màn hình có thể được dịch hoàn hảo — mọi label resolve ở
nửa connected, không literal nào dưới block — mà vẫn trả cho người đọc một tài liệu tiếng Anh, vì phần
khung lấy từ từ điển còn phần nội dung lấy từ một API chưa bao giờ được cho biết phải phục vụ ngôn ngữ
nào.

Câu hỏi phân định mọi trường hợp: **một người đọc ở ngôn ngữ khác có nhận về DỮ LIỆU khác từ lời gọi
này không?** Nếu có, request phải khai báo locale, và phải khai báo ở **một chỗ**, không phải ở từng
call site.

**Đây là luật ràng buộc, không phải lời khuyên.** Luật này không phải luật dịch chữ bên cạnh. Luật kia
quyết định **ai chọn chữ** bên trong cây component; luật này quyết định **request khai báo cái gì**
trên đường đi ra. Tuân thủ luật này không nói gì về luật kia, và kiểu hỏng của luật này lại trông
giống hệt kiểu hỏng của luật kia — một cái khung song ngữ phủ lên nội dung đơn ngữ sẽ bị đi tìm trong
từ điển, nơi không có gì sai cả.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `LOCALE-<n>`. Mã đặt tên cho TÌNH HUỐNG.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `LOCALE-1` | Một chain transport được dựng ra và chạm tới mạng mà không mang theo ngôn ngữ | Mọi chain transport dựng ra link terminal đều gắn locale của người đọc, vô điều kiện, cạnh link auth. Cấm: một chain chạm mạng mà câm về ngôn ngữ, và mọi điều kiện — auth, feature flag, route — đặt lên việc gắn đó |
| `LOCALE-2` | Giá trị locale phải đến từ đâu đó, và có người định truyền nó xuống | Link tự suy ra locale từ địa chỉ mà người đọc đang đứng. Cấm: một tham số `locale` xuyên qua hook, query function hay call site, vì đó là thứ người viết tiếp theo sẽ bỏ sót |
| `LOCALE-3` | App nhớ lựa chọn trong một cookie, còn API nằm ở origin khác | Giá trị đi bằng request header khi API khác origin. Cấm: trông cậy vào một cookie mà server về nguyên tắc đọc được nhưng thực tế không bao giờ nhận được |
| `LOCALE-4` | Server trả lời bằng ngôn ngữ mặc định và câu trả lời trông vẫn đúng | Mọi request đều khai báo locale, nên bản mặc định của server là cái **sàn** nằm dưới một khai báo chứ không phải thứ đã trả lời. Cấm: coi một câu trả lời mặc định trông đúng là bằng chứng fallback hoạt động |
| `LOCALE-5` | Một chỗ thứ hai trong cây tự tay viết cùng cái header ngôn ngữ | Chuỗi header do link locale viết, và không do gì khác viết. Cấm: một call site thứ hai tự set cùng header đó |

`LOCALE-3` VÀ `LOCALE-4` KHÔNG PHẢI LỜI BÌNH VỀ BA MÃ KIA. Chúng đặt tên cho hai cách một bề mặt vượt
qua review mà vẫn đơn ngữ: một phương tiện không thể vượt qua chính cái ranh giới nó được giao vượt,
và một câu trả lời trông đúng vì người sẽ nhận ra không phải người đang test. Cả hai đều im lặng, và
một lỗi im lặng không có tên là lỗi không ai chứng minh được là do ai gây ra.

Dãy số không có khoảng trống và sẽ không có thêm. Năm mã này được trích dẫn từ các file luật khác và
từ các bản ghi task; đánh số lại một mã ở đây là âm thầm làm hỏng một trích dẫn ai đó đã viết.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói người đọc ở ngôn ngữ khác nhìn thấy bề mặt này bằng ngôn ngữ của
   họ, và nó nói bề mặt hiển thị dữ liệu nào.
2. **Đọc xem shape KHÔNG nói gì, và vì vậy không giải quyết gì.** Một shape đã duyệt không nêu tên file
   client, không nói API có cùng origin với app hay không, không chọn phương tiện vận chuyển, và không
   nói giá trị được suy ra ở đâu. Bốn sự thật đó chính là phần pattern này giải quyết; shape không cung
   cấp cái nào.
3. **Giải từ ngoài vào trong.** Bắt đầu ở chain dựng ra link terminal (`LOCALE-1`), rồi tới link suy ra
   giá trị (`LOCALE-2`), rồi tới phương tiện phải vượt ranh giới (`LOCALE-3`), rồi tới câu trả lời đi
   về (`LOCALE-4`), cuối cùng đếm số chỗ viết header trong cây (`LOCALE-5`).
4. **Hỏi đúng câu hỏi của từng mã.** `LOCALE-1`: chain chạm mạng có gắn ngôn ngữ không, và có gắn vô
   điều kiện không? `LOCALE-2`: giá trị đến bằng cách **suy ra** hay bằng cách **được truyền**?
   `LOCALE-3`: trên đúng đường mà request này đi — ẩn danh, cross-origin — cookie **có thật sự được
   gửi** không? `LOCALE-4`: câu trả lời này đúng vì **request đã làm rõ**, hay vì **tôi tình cờ đọc
   đúng ngôn ngữ mặc định**? `LOCALE-5`: nếu ngày mai nguồn locale đổi, phải sửa **bao nhiêu** chỗ mới
   đúng lại?
5. **Khi hai mã cùng khớp, ghi cả hai.** Một call site vừa tự set header vừa nhận `locale` qua tham số
   vi phạm cả `LOCALE-5` lẫn `LOCALE-2`; ghi cả hai mã, đừng chọn một. Khi hai mã đứng ở quan hệ
   nguyên nhân — hậu quả — `LOCALE-1` hoặc `LOCALE-3` là nguyên nhân, `LOCALE-4` là cách người ta bỏ
   qua hậu quả — thì ghi nguyên nhân, và ghi thêm `LOCALE-4` riêng nếu có người đang coi câu trả lời
   mặc định là bằng chứng.

## `LOCALE-1` — chain nào cũng khai báo, và khai báo vô điều kiện

**Tình huống.** Có một chỗ trong ứng dụng lắp ráp đường truyền: retry, timeout, auth, rồi link cuối
cùng thật sự chạm mạng. Locale phải đi cùng **ở đó**, chứ không phải trong cái hook tình cờ đang cần
tới nó.

**Nó sinh ra gì trong source.** Một link locale là phần tử thường của mảng chain, đứng trước link
terminal và nằm ngoài cái spread có điều kiện chèn link auth. Thêm auth thì thêm đúng một link; link
locale có mặt ở cả hai hình dạng. File lắp ráp chain sở hữu việc này; hook không sở hữu chút nào.

**Dấu hiệu nhận biết.**

- File đang dựng ra link terminal — link duy nhất nói chuyện với network.
- Chain đã đầy đủ: có retry, có timeout, có token, và **câm về ngôn ngữ**.
- Việc gắn locale đang bị đặt sau một điều kiện: chỉ khi đã đăng nhập, chỉ ở một route, chỉ khi bật
  một cờ.

Tự hỏi: nếu tôi gắn locale ở tầng hook thay vì ở chain, thì người tiếp theo viết hook mới có **phải
nhớ** gắn không? Nếu có thì sai chỗ rồi. Và phải vô điều kiện vì khách vãng lai cũng đọc bằng một ngôn
ngữ — khác với bearer token, ở đây không có nhánh ẩn danh nào **được phép** không khai báo gì. Đặt
locale sau cờ `withAuth` là biến toàn bộ nội dung công khai — thứ mà đa số người đọc thấy trước tiên —
thành tiếng mặc định.

**Ranh giới.** Đây không phải `LOCALE-5`: `LOCALE-1` nói **phải có** một chỗ gắn, còn `LOCALE-5` nói
**chỉ được có một** chỗ. Thiếu chain là `LOCALE-1`; hai chỗ cùng viết là `LOCALE-5`. Cũng không phải
`LOCALE-2`: ở đây chain **có** link locale, còn link đó lấy giá trị từ đâu là chuyện của `LOCALE-2`.
Một link gắn `"en"` cứng vẫn thoả `LOCALE-1`.

**Tình huống nghiệp vụ hay gặp.** Client ẩn danh cho trang public · client có auth cho khu vực đăng
nhập · client riêng cho upload · client dựng trong một script hoặc một worker · client thứ hai được
thêm vào cho một tính năng mới và copy từ client cũ **trước khi** locale được thêm vào client cũ.

## `LOCALE-2` — đọc từ địa chỉ, không nhận từ tham số

**Tình huống.** Giá trị locale phải đến từ đâu đó. Có hai kiểu nguồn: kiểu **phải có người nhớ truyền**
và kiểu **tự có sẵn ở nơi request được lắp ráp**. Luật chọn kiểu thứ hai.

**Nó sinh ra gì trong source.** Một resolver không nhận tham số locale nào. Nó đọc path segment đầu
tiên, và nó **từ chối** một segment không phải locale đã ship thay vì chấp nhận bất cứ thứ gì phép thu
hẹp mặc định trả về. Call site công khai không truyền gì cả.

**Dấu hiệu nhận biết.**

- Một hook có tham số `locale` trong signature.
- Một query function nhận `headers` từ bên ngoài chỉ để nhét ngôn ngữ vào.
- Một SWR key có thêm `locale` để "cache cho đúng" — dấu hiệu là locale đang đi bằng tay.

Tự hỏi: giá trị này đến bằng cách **suy ra**, hay bằng cách **được truyền**? Nếu được truyền, thì
người viết hook tiếp theo có gì nhắc họ? Nguồn là địa chỉ vì URL đã mang ngôn ngữ của người đọc và
middleware đã redirect họ tới đúng đó. Đó vừa là tuyên bố ý định mạnh nhất, vừa — quan trọng hơn — là
thứ **không ai phải nhớ truyền**. Một tham số bị bỏ sót không báo lỗi: lời gọi vẫn thành công và trả
về ngôn ngữ mặc định.

**Ranh giới.** Với `LOCALE-1`: có link mà lấy sai nguồn là `LOCALE-2`; không có link là `LOCALE-1`. Với
`LOCALE-3`: cookie **là** một nguồn hợp lệ cho link đọc, vì nó nằm cùng phía client — `LOCALE-3` cấm
cookie làm **phương tiện vận chuyển** sang server, không cấm nó làm **nguồn đọc** ở client. Với
`LOCALE-4`: rơi về app default vì không đọc được địa chỉ là một nhánh đã đóng của `LOCALE-2`; coi cái
default đó là "đã xong" thì thành `LOCALE-4`.

**Tình huống nghiệp vụ hay gặp.** Hook chi tiết khoá học · hook danh sách có filter · query function
chạy trên server component · một hook mới copy từ hook cũ · một trang chia sẻ link có prefix ngôn ngữ.

## `LOCALE-3` — cookie không đi qua ranh giới origin

**Tình huống.** Ứng dụng nhớ lựa chọn của người đọc trong một cookie, và server hoàn toàn có khả năng
đọc cookie đó. Cả hai điều đều đúng, và **không điều nào** làm cho giá trị đi được sang một origin
khác.

**Nó sinh ra gì trong source.** Trong file dựng link HTTP terminal, `credentials` chỉ là `"include"`
khi người gọi chủ động bật, và mặc định là tắt — nên request ẩn danh, tức gần như mọi lượt đọc, không
gửi cookie nào. Vì thế header là phương tiện duy nhất sống sót trên đường đó, và source phải gửi nó.

**Dấu hiệu nhận biết.**

- API nằm ở domain khác với app.
- Chain gửi request ẩn danh, và đường ẩn danh cố ý **không** bật credentials.
- Có người đang lập luận "server đọc cookie rồi mà" để kết luận không cần header.

Tự hỏi: trên đúng đường mà request này đi — ẩn danh, cross-origin — cookie **có thật sự được gửi**
không? Đây là dạng đúng tốn kém nhất: đúng về nguyên tắc, sai về thực tế. Server có code đọc cookie,
code đó chạy, và nó không bao giờ nhận được gì. Không ai thấy lỗi; chỉ thấy nội dung sai ngôn ngữ.
Đừng sửa bằng cách bật credentials — đường ẩn danh không bật credentials là một quyết định có lý do
riêng: gửi cookie sang một API cross-origin chưa opt-in chỉ tạo ra lỗi CORS, và nó kéo theo cả một
phạm vi bảo mật khác. Cách sửa là **gửi header**.

**Ranh giới.** Với `LOCALE-2`: cookie làm **nguồn đọc** phía client thì hợp lệ; cookie làm **phương
tiện** sang server thì không. Với `LOCALE-4`: `LOCALE-3` là lý do phổ biến nhất khiến `LOCALE-4` xảy
ra — không gửi được gì nên nhận về bản mặc định.

**Tình huống nghiệp vụ hay gặp.** App và API khác domain · API sau một gateway riêng · môi trường
preview có domain tạm · request từ server component, nơi không có cookie của trình duyệt trong tay ·
request từ một worker.

## `LOCALE-4` — mặc định của server là sàn, không phải fallback

**Tình huống.** Server trả lời một request không khai báo bằng tiếng mặc định. Đó là server đang **cẩn
thận**, không phải server đang **cho phép**.

**Nó sinh ra gì trong source.** Một resolver có kiểu trả về là union locale đóng, không phải optional,
và không có nhánh nào trả về rỗng — nên không có đường nào đưa cho server một request không khai báo
để nó phải cẩn thận. Mọi request đều khai báo.

**Dấu hiệu nhận biết.**

- Trang chạy, không có lỗi, nội dung đọc được — chỉ là đọc được bằng ngôn ngữ khác.
- Có người kết luận "fallback hoạt động tốt".
- Người test và người đọc thật không cùng một ngôn ngữ.

Tự hỏi: câu trả lời này đúng vì **request đã làm rõ**, hay đúng vì **tôi tình cờ đọc đúng ngôn ngữ mặc
định**? Coi bản mặc định là fallback biến một header thiếu thành một **quyết định sản phẩm ngầm**:
"người đọc ngôn ngữ khác thì đọc tạm tiếng mặc định". Không ai từng quyết định như vậy, và người duy
nhất phát hiện ra là người đang bị phục vụ sai ngôn ngữ.

**Ranh giới.** Với `LOCALE-1` và `LOCALE-3`: hai mã đó là **nguyên nhân**, còn `LOCALE-4` là **cách
người ta bỏ qua** hậu quả. Với `LOCALE-2`: nhánh không có địa chỉ để đọc rơi về app default là một
ngoại lệ đóng; dựa vào nó ở nhánh có địa chỉ thì là `LOCALE-4`.

**Tình huống nghiệp vụ hay gặp.** QA chạy toàn bộ ở ngôn ngữ mặc định · smoke test chỉ kiểm status
200 · một môi trường staging chỉ seed một ngôn ngữ · một report bug bị đóng vì "không tái hiện được".

## `LOCALE-5` — một chỗ viết header, nên một chỗ kiểm được

**Tình huống.** Header ngôn ngữ do link locale viết, và không do gì khác viết. Một call site tự set
thêm là **câu trả lời thứ hai** cho cùng một câu hỏi.

**Nó sinh ra gì trong source.** Chuỗi header xuất hiện ở đúng một file production — file link locale —
và các lần xuất hiện khác là phần prose của chính file đó. Một lần trúng thứ hai trong production
chính là vi phạm.

**Dấu hiệu nhận biết.**

- Có một object `headers` ở tầng hook hoặc query có khoá ngôn ngữ.
- Có một hằng số ngôn ngữ được viết cứng ngay tại chỗ gọi.
- Có hai chỗ trong repo cùng chứa chuỗi header đó.

Tự hỏi: nếu ngày mai nguồn locale đổi, tôi phải sửa **bao nhiêu** chỗ mới đúng lại? Hai chỗ cùng trả
lời không phải là dư thừa vô hại: chúng **phân kỳ ngay lần đầu** một trong hai được cập nhật. Kết quả
điển hình là một hook đúng và toàn bộ phần còn lại của bề mặt nằm ở ngôn ngữ mặc định — đúng cái trạng
thái khó chẩn đoán nhất, vì có bằng chứng cho thấy "chỗ này làm được mà".

**Ranh giới.** Với `LOCALE-1`: thiếu hẳn là `LOCALE-1`; thừa một chỗ là `LOCALE-5`. Với `LOCALE-2`: một
call site vừa set header vừa nhận `locale` qua tham số vi phạm cả hai; ghi cả hai mã, đừng chọn một.

**Tình huống nghiệp vụ hay gặp.** Một hook được "vá nhanh" cho kịp release · một script seed dữ liệu ·
một test helper bị copy vào production · một request tới endpoint thứ hai được viết tay ngoài chain.

## Tầng giữ

Tầng nào thật sự giữ từng mã — một kiểu đóng, một lint rule, hay chỉ một người đọc. Các dòng
`enforced` được cài đặt ở `sources/fe/served-locale.mjs`.

| Mã | Tầng | Giữ bởi |
|---|---|---|
| `LOCALE-1` | `enforced` | `starci-fe/api-client-attaches-the-locale` |
| `LOCALE-2` | `documented` | không có gì máy móc |
| `LOCALE-3` | `documented` | không có gì máy móc |
| `LOCALE-4` | `documented` | không có gì máy móc |
| `LOCALE-5` | `enforced` | `starci-fe/locale-header-belongs-to-the-link` |

Ba trên năm dòng ghi `documented`, và bảng này tồn tại để nói thẳng điều đó ra, thay vì để hai dòng
`enforced` ngầm ám chỉ rằng module đã được phủ.

Khoảng trống ấy có một hình dạng duy nhất, và chính rule source nói ra chứ không ám chỉ: cả hai rule
đều là sự thật **theo từng file**. Một chain được lắp ráp trong một file, và một header được viết ở
chỗ nó được viết. Không rule nào nhìn thấy giá trị mà link tính ra có ĐÚNG hay không — nó đọc địa chỉ,
đọc cookie, hay trả về một hằng số — vì điều đó nằm trong một hàm mà rule chỉ biết TÊN. Một link tên
`createAttachLocaleLink` gắn `"en"` vô điều kiện vẫn thoả cả hai rule, và sai đúng theo cái cách mà
luật này sinh ra để ngăn. Trường hợp đó là `LOCALE-2`, và nó là câu hỏi review **do cấu tạo**, không
phải do bỏ sót.

`LOCALE-3` và `LOCALE-4` còn xa tầm với hơn: một cái là sự thật về TRIỂN KHAI (API có khác origin hay
không), cái kia là sự thật về một CÂU TRẢ LỜI mà gate không bao giờ nhìn thấy. Không cái nào hiện ra
trong một file source cả.

Tầng transport sở hữu mối bận tâm này. Cây component, các hook và các query function phải **không biết
gì** về nó: chúng không suy ra locale và cũng không mang locale, và ngay khi một trong số chúng làm
thế thì mối bận tâm đã rời khỏi tầng của nó, và vi phạm đã có mã.

## Điểm neo

Một luật không chỉ được vào code thật thì mới là một đề xuất. Các đường dẫn là đường dẫn source tương
đối với repository; chính hình dạng của cây, chứ không phải tên của sản phẩm nào, làm chúng kiểm được.

| Mã | Điểm neo | Cần nhìn cái gì |
|---|---|---|
| `LOCALE-1` | `src/modules/api/graphql/clients/create-apollo-client.ts` | Link locale là phần tử thường của mảng chain — trước link terminal, ngoài cái spread có điều kiện chèn link auth. Thêm auth thì thêm đúng một link; link locale có mặt ở cả hai hình dạng |
| `LOCALE-2` | `src/modules/api/graphql/clients/links/locale.ts` | Resolver không nhận tham số locale. Nó đọc path segment đầu tiên, và nó từ chối một segment không phải locale đã ship thay vì chấp nhận bất cứ thứ gì phép thu hẹp mặc định trả về. Call site công khai không truyền gì |
| `LOCALE-3` | `src/modules/api/graphql/clients/links/http.ts` | `credentials` chỉ là `"include"` khi người gọi chủ động bật, và mặc định là tắt — nên request ẩn danh, tức gần như mọi lượt đọc, không gửi cookie. Header là phương tiện duy nhất sống sót trên đường đó |
| `LOCALE-4` | `src/modules/api/graphql/clients/links/locale.ts`, kiểu trả về của resolver và nhánh không có địa chỉ | Kiểu trả về là union locale đóng, không phải optional. Không có đường nào trả về rỗng, nên không có đường nào đưa cho server một request không khai báo để nó phải cẩn thận |
| `LOCALE-5` | một lần tìm chuỗi header trong cả cây | Nó xuất hiện ở đúng một file production — file link locale — và các lần xuất hiện khác là prose của chính file đó. Một lần trúng thứ hai trong production chính là vi phạm |

Điểm neo của `LOCALE-4` là yếu nhất trong năm cái và được ghi nhận đúng như vậy: nó chứng minh client
luôn khai báo MỘT CÁI GÌ ĐÓ, chứ không chứng minh cái đã khai báo đến từ người đọc.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| call | Operation, và chain transport mà nó đi qua |
| answer | Thân response có khác nhau theo người đọc không, hay chỉ phần khung quanh nó khác |
| origin | API có cùng origin với app không |
| carrier | Giá trị sẽ đi bằng gì: transport header, cookie, tham số, hay không gì cả |
| source | Giá trị được suy ra từ đâu: địa chỉ, lựa chọn đã nhớ, hay mặc định của app |
| ownership | File nào viết header |

## Quy tắc

1. Chain nào chạm tới mạng thì chain đó khai báo một ngôn ngữ.
2. Việc khai báo là **vô điều kiện**; khách vãng lai cũng đọc bằng một ngôn ngữ.
3. Locale được **SUY RA** ở nơi request được lắp ráp, không bao giờ được **TRUYỀN VÀO** đó.
4. Địa chỉ là tuyên bố ý định mạnh nhất hiện có, và là tuyên bố duy nhất không ai phải nhớ chuyển
   tiếp.
5. Cookie không phải phương tiện khi vượt một ranh giới origin mà request không chủ động opt-in.
6. Bản mặc định của server nằm dưới một khai báo; nó không bao giờ là thứ đã quyết định.
7. Đúng **một** file viết header đó.
8. Mọi lời gọi có câu trả lời khác nhau theo người đọc đều quy về đúng một mã. Không lời gọi nào nằm
   ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
dụng vào.

- **Phần cài đặt của chính một link (`LOCALE-1`).** File **là một link** thì không phải là chain. File
  định nghĩa link terminal dựng ra link đó vì đấy là toàn bộ việc của nó, và không có cách nào đúng để
  gắn locale ở đấy — nhét một link locale vào bên trong link terminal là giấu cả chain vào trong một
  mắt xích. Ngoại lệ này theo ĐƯỜNG DẪN, và nó được tìm ra bằng cách **chạy** rule chứ không phải bằng
  cách đoán.
- **Spec (`LOCALE-1`).** Một spec khẳng định **về** một chain chứ không **là** một chain.
- **Chính file link locale (`LOCALE-5`).** Chỗ duy nhất được viết header được nhận diện bằng đường
  dẫn, vì điểm mấu chốt của mã này là cái chỗ đó phải được ĐẶT TÊN và trích dẫn được.
- **Seam cho test (`LOCALE-2`).** Một link được phép nhận một resolver tiêm vào để spec cố định giá
  trị. Đó không phải tham số xuyên tầng: call site production không truyền gì, và mặc định là hàm suy
  ra. Ngày một call site production bắt đầu truyền, cái seam đã trở thành đúng cái tham số mà
  `LOCALE-2` cấm.
- **Render không có địa chỉ (`LOCALE-2`, `LOCALE-4`).** Nơi không có địa chỉ để đọc — một lượt render
  phía server — resolver trả app default thay vì bỏ trống header, và lần fetch phía client sửa lại.
  Ngoại lệ đóng ở đúng nhánh đó, và giá phải trả của nó là có thật.

## Đầu ra

```text
call: <the operation, and the chain it travels through>
code: <LOCALE-1 | LOCALE-2 | LOCALE-3 | LOCALE-4 | LOCALE-5>
carrier: <transport header | cookie | argument | nothing>
source: <address | remembered choice | app default>
declared: <yes | no>
reason: <the fact that excludes the adjacent code>
```

## Ví dụ đã giải

Shape đã duyệt: một bề mặt chi tiết tài liệu công khai, nơi một người đọc ẩn danh đứng trên địa chỉ có
prefix ngôn ngữ nhìn thấy chính thân tài liệu bằng ngôn ngữ đó, chứ không chỉ phần khung quanh nó.

Shape nói rằng câu trả lời khác nhau theo người đọc. Nó **không** nói client nào lắp ráp request, API
có cùng origin với app hay không, cái gì mang giá trị đi, và giá trị được suy ra ở đâu — nên nó không
giải quyết những điều đó; pattern này giải quyết.

```text
call: document detail read, through the anonymous client chain in create-apollo-client.ts
code: LOCALE-1
carrier: transport header
source: address
declared: yes
reason: the chain assembles the terminal link, so it is a chain and not a link — the terminal-link file's exemption does not reach it, and the locale link sits outside the conditional auth spread, so no condition gates the attachment
```

```text
call: the locale link that the chain attaches, in links/locale.ts
code: LOCALE-2
carrier: transport header
source: address
declared: yes
reason: the resolver takes no locale argument and reads the first path segment, so the value is derived where the request is assembled rather than passed in — which is what separates this from LOCALE-1, where the question is only whether a link exists at all
```

```text
call: the same anonymous read, crossing to the API origin through links/http.ts
code: LOCALE-3
carrier: transport header
source: address
declared: yes
reason: credentials default to off on the anonymous path, so the remembered-choice cookie is never sent — the cookie remains a valid client-side source for the link to read, which is why this is LOCALE-3 and not LOCALE-2
```

```text
call: one search of the tree for the language header literal
code: LOCALE-5
carrier: transport header
source: address
declared: yes
reason: the literal occurs in one production file, the locale link, and nowhere else — a missing attachment would have been LOCALE-1, whereas one extra writer is LOCALE-5
```

```text
call: the server-rendered first pass of the same surface, with no address to read
code: LOCALE-4
carrier: transport header
source: app default
declared: yes
reason: the resolver's return type is the closed locale union with no path that returns nothing, so the default is a floor beneath a declaration rather than the thing that answered — treating the default answer as proof the fallback works is the LOCALE-4 failure this branch's closed exception does not license
```

## Phạm vi

Quy tắc này đúng với mọi đoạn code cùng loại trong stack này: mọi front end mà API của nó phục vụ dữ
liệu đã dịch. Nó không nêu tên sản phẩm nào, thư viện component nào, repository nào, và cũng không nêu
tên một tính năng đơn lẻ nào. Mọi ví dụ đều là TSX thông thường.

MỘT ĐỊNH DANH ĐƯỢC SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một rule được trích dẫn bằng tên đã
công bố của nó, kèm cả prefix plugin, vì đó chính là chuỗi mà build log in ra và comment disable mang
theo. Một trích dẫn không dán được vào ô tìm kiếm thì không phải trích dẫn. Điều bị cấm ở trên là
PROSE và VÍ DỤ cần có một sản phẩm mới hiểu được — không bao giờ là một định danh mà ai đó sẽ đọc thấy
trong một lần hỏng và phải đi tra.
