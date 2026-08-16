---
id: be-patterns-exception-identity-vi
title: vi.md
slug: /be/patterns/exception-identity/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống IDENTITY-N, nhận diện bằng người đọc ở đầu bên kia chứ không bằng cảm giác đặt tên.
---

# vi.md

> Version: `2.00` · Module: `exception-identity`

# Exception identity

Danh tính của một lỗi là **một từ** phân biệt nó với mọi lỗi khác mà ứng dụng có thể sinh ra. Danh tính
đó được viết qua **ba bảng chữ**, và cả ba phải nói cùng một điều:

| Bảng chữ | Ai đọc | Đọc để làm gì |
|---|---|---|
| Tên class | Các gate lint | Mọi rule về exception đều khớp theo hậu tố `Exception` |
| Code | Client | Khớp code để rẽ nhánh, vì một response có thể mang nhiều lỗi khác severity |
| Tên type metadata | Nơi throw | Là hợp đồng mà call site phải thoả, và là chỗ trường thứ hai sẽ rơi vào |

Ba nơi đọc này **không thay thế được cho nhau**. Tên class không tới được client; code không tới được
throw site. Vì thế đây không phải ba quyết định, mà là **một** quyết định được viết ra ở ba nơi.

Câu hỏi quyết định một khai báo có danh tính hay không:

> Nếu lỗi này và lỗi khai báo ngay phía trên nó cùng tới client, có thứ gì phân biệt được chúng mà
> **không cần đọc tiếng Anh** không?

Nếu câu trả lời là *message*, khai báo đó không có danh tính. Nó có một câu văn.

**Đây là luật bắt buộc.** Mọi class extends `AbstractException` đều thuộc cả năm mã dưới đây. Không
có lỗi nào nhỏ tới mức được miễn: câu "lỗi nội bộ, có ai bắt đâu" chính là nơi luật này bị bỏ qua
nhiều nhất — và cũng là lỗi sẽ xuất hiện trong alert lúc 3 giờ sáng mà không có tên.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `IDENTITY-1` | Đặt tên cho một class lỗi mới | Tên kết thúc bằng `Exception` |
| `IDENTITY-2` | Chọn code để client khớp | Code = tên class viết SCREAMING_SNAKE, truyền dạng literal |
| `IDENTITY-3` | Đổi tên một class lỗi đã tồn tại | Đổi cả class lẫn code, có kế hoạch migration |
| `IDENTITY-4` | Khai báo kiểu payload của lỗi | `<Class>Metadata`, kể cả khi không thêm trường nào |
| `IDENTITY-5` | Chọn HTTP status | Chỉ set khi status **là** hợp đồng; danh tính nằm ở code |

---

## `IDENTITY-1` — tên class phải kết thúc bằng `Exception`

**Tình huống.** Bạn đang đặt tên cho một class extends `AbstractException`. Đây là chỗ ai cũng nghĩ là
chuyện thẩm mỹ, và nó không phải.

Hậu tố `Exception` là **thứ duy nhất mọi rule khác nhìn thấy**. Rule bắt tham số object, rule bắt
extends đúng base, rule bắt nằm trong thư mục errors — tất cả đều khớp theo hậu tố đó; còn rule ở
throw site thì chỉ nhận diện `Error` và các tên của framework. Cho nên một class đặt tên
`SomethingError` sẽ: nằm đúng thư mục errors, extends đúng house base, được throw ở call site thật —
và **không rule nào kiểm nó**. Gate im lặng, và im lặng thì đọc như đồng ý.

**Dấu hiệu nhận biết**

- Tên kết thúc bằng `Error`, hoặc là một danh từ trần (`InvalidToken`, `QuotaExceeded`).
- Class extends `AbstractException` nhưng lint không hề báo gì về nó — kể cả khi bạn cố tình viết sai
  một thứ khác trong cùng file.
- Grep tên class trong report của lint không ra dòng nào.

**Tự hỏi.** Nếu tôi cố tình phá một rule exception khác ngay trong class này, gate có đỏ lên không?
Nếu không — class đang vô hình.

**Ranh giới**

- ↔ `EXCEPTION-3`: đó là cùng một cái bẫy nhìn từ đầu kia. `EXCEPTION-3` bắt class extends base của
  framework — trông đúng nhà ở chỗ throw. `IDENTITY-1` bắt class đặt tên ngoài quy ước — trông đúng
  nhà ở trong thư mục. Cả hai đều là lỗi **qua được mọi cửa bằng cách vô hình với cửa**.
- ↔ `IDENTITY-2`: `IDENTITY-1` nói về tên class; `IDENTITY-2` nói về việc code phải bám theo tên đó.
  Sai `IDENTITY-1` thì `IDENTITY-2` cũng không được kiểm, vì rule của nó cũng khớp theo hậu tố.

**Tình huống nghiệp vụ hay gặp.** Port một lỗi từ thư viện ngoài vào (`ParseError` → giữ nguyên tên
theo quán tính) · lỗi validate ngắn (`SlugTaken`) · lỗi hạ tầng (`S3UploadFailure`) · lỗi timeout
(`UpstreamTimeoutError`) · lỗi được sinh ra bằng codegen từ một schema có sẵn tên.

---

## `IDENTITY-2` — code là tên class, viết SCREAMING_SNAKE

**Tình huống.** Bạn đang viết đối số thứ hai của `super()`. Code này là thứ **client khớp**, cho nên
nó là hợp đồng ra ngoài. Nó được **suy ra** từ tên class, không được **chọn** cạnh tên class.

Hai hệ quả của việc suy ra, và cả hai đều là mục đích:

**Thứ nhất: không ai phải tra cứu.** Người có tên class biết code; người có code tìm được class bằng
một lần grep. Một code chọn tay là **cái tên thứ hai** của cùng một lỗi — và cái tên thứ hai chính là
cái nằm trong client, trong alert rule, trong ticket hỗ trợ, trong khi cái tên thứ nhất là cái duy
nhất có trong source.

**Thứ hai: duy nhất mà không phải cố.** Code copy từ exception khai báo ngay phía trên là **cách phổ
biến nhất** để hai lỗi không liên quan dùng chung một danh tính. Chuyện này đã xảy ra thật: một
challenge OTP và một challenge khoá học cùng báo một code, nên client khớp code không phân biệt được
"thiếu bài học" với "thiếu bước đăng nhập". Đó đúng là khuyết tật mà `EXCEPTION-1` từ chối exception
của framework để tránh — chỉ khác là lần này nó xảy ra **bên trong** vốn từ của nhà.

**Dấu hiệu nhận biết**

- Code ngắn hơn tên class rõ rệt (`REVIEW_FORBIDDEN` cho `DocumentNotOwnedException`).
- Code là một danh từ chung mà nhiều lỗi đều dùng được (`NOT_FOUND`, `FORBIDDEN`, `INVALID_INPUT`).
- Code được ghép bằng template string, hằng số, hoặc `${prefix}_NOT_FOUND`.
- Hai file cạnh nhau trong cùng thư mục có cùng một code.

**Tự hỏi.** Nếu tôi grep chính xác chuỗi code này trong repo, tôi có tới thẳng class không? Nếu không
— code đang là tên thứ hai.

**Ranh giới**

- ↔ `IDENTITY-1`: xem trên.
- ↔ `IDENTITY-3`: `IDENTITY-2` áp lúc **viết mới**. `IDENTITY-3` áp lúc **sửa cái đã có**. Cùng một
  luật "code bám tên class", nhưng chi phí khác hẳn nhau: viết mới thì free, sửa thì có client.
- ↔ `IDENTITY-5`: nếu bạn thấy mình đang chọn status để hai lỗi khác nhau, tức là bạn đang trả lời
  `IDENTITY-2` bằng công cụ sai.

**Không phải phần của luật này.** Chỗ đặt dấu gạch dưới bên trong một acronym. `GRAPHQL_DATA_...` và
`GRAPH_QL_DATA_...` cùng gọi tên một class, không có cách tách nào đúng, và một rule ép một cách sẽ
bắn vào code đang đúng. **Chữ cái là ruling, không phải gạch dưới.**

**Tình huống nghiệp vụ hay gặp.** Copy file lỗi bên cạnh rồi sửa tên class mà quên sửa code · lỗi
"not found" cho một entity mới · code đặt theo tên endpoint thay vì tên lỗi · code ghép theo tenant
hoặc theo provider · code rút gọn cho ngắn dòng.

---

## `IDENTITY-3` — đổi tên class là đổi hợp đồng trên dây

**Tình huống.** Class đã tồn tại, đã có client, và bạn muốn đổi tên nó cho đúng hơn. Vì code được suy
ra từ tên class, việc đổi tên **không phải một refactor** — nó là một thay đổi client nhìn thấy được.

Đó là hệ quả trung thực, và cũng là lý do phải giữ nó. Lựa chọn thay thế là một class mang code bảo
lưu một cái tên nó không còn nữa — chuyện này cũng đã xảy ra thật: một lỗi tra cứu đường dẫn vẫn báo
code của lần tra cứu thư mục ngày xưa, và không người đọc nào của một trong hai cái tên đoán được cái
kia.

Cho nên: đổi tên là **một quyết định có migration**, không phải một cú dọn dẹp làm tiện tay khi đi
ngang. Nếu code cũ bắt buộc phải ở lại trên dây vì một client đã phát hành, thì **class giữ nguyên tên
cũ** cho đến khi client đó được gỡ. Thứ bị từ chối là nửa-đổi-tên im lặng, để hai cái tên bất đồng
mãi mãi.

**Dấu hiệu nhận biết**

- Diff có đổi tên class mà không đổi dòng `super(...)`.
- Diff có đổi code mà không đổi tên class.
- Commit message ghi "rename", "cleanup", "chore" cho một file trong thư mục errors.
- Có e2e spec assert đúng chuỗi code đó, và spec không nằm trong diff.

**Tự hỏi.** Ai đang khớp code này ngay lúc này — client nào, alert nào, spec nào? Nếu tôi không trả
lời được, tôi chưa đủ điều kiện đổi tên.

**Ranh giới**

- ↔ `IDENTITY-2`: xem trên.
- ↔ `IDENTITY-1`: đổi `SomethingError` thành `SomethingException` **cũng** là một lần đổi tên có hệ
  quả trên dây. Sửa `IDENTITY-1` không miễn `IDENTITY-3`.

**Một thứ đắt vì được tin, rẻ vì được đo.** Giả định "đổi code nghĩa là phải phát hành đồng bộ" từng
được tin rất lâu. Khi đo thật: trên ba front end, tổng cộng năm code được khớp, và không code nào
trong số đó thuộc về một khai báo đã trôi. Đo thì rẻ; tin thì đắt.

**Tình huống nghiệp vụ hay gặp.** Đổi tên domain (`Folder` → `Path`) · gộp hai module · sửa lỗi chính
tả trong tên class · đổi tên khi tách service · rename hàng loạt bằng IDE refactor.

---

## `IDENTITY-4` — type metadata mang tên chính exception của nó

**Tình huống.** Bạn đang khai báo kiểu cho tham số destructure của constructor. Kiểu đó tên là
`<Class>Metadata`, extends `AbstractExceptionMetadata` — **kể cả khi nó không thêm trường nào**, lúc
đó là một alias rỗng:

`export type XExceptionMetadata = AbstractExceptionMetadata`

Alias rỗng không phải nghi thức, cùng lý do mà object rỗng của `EXCEPTION-2` không phải nghi thức:
**nó là chỗ trường đầu tiên sẽ rơi vào.** Một tham số gõ thẳng base nói rằng "lỗi này không mang gì
cả" — điều đó ngừng đúng ngay khoảnh khắc ai đó có một id cần gắn vào. Và ở đúng khoảnh khắc ấy, base
đang được **mọi** exception khác dùng chung, nên trường mới không thể thêm ở đó, và khai báo phải bị
đập ra nắn lại trước khi mở rộng được.

Đặt tên type theo exception còn có nghĩa: người đọc cầm tên lỗi tìm được payload của nó **mà không
cần mở file**.

**Dấu hiệu nhận biết**

- Tham số gõ thẳng `AbstractExceptionMetadata`.
- Tham số không có annotation nào (destructure trần) — nhận mọi object, kể cả object thiếu đúng cái
  id mà lỗi này sinh ra để mang.
- Type tên theo entity chứ không theo exception (`ReviewMetadata` cho `DocumentNotOwnedException`).
- Một type metadata được dùng lại cho hai exception khác nhau.

**Tự hỏi.** Ngày mai lỗi này cần nói **cái nào** bị từ chối, tôi thêm trường vào đâu? Nếu câu trả lời
là "vào base mà mọi lỗi dùng chung" — sai mã.

**Ranh giới**

- ↔ `EXCEPTION-2`: `EXCEPTION-2` bắt constructor nhận **một object**. `IDENTITY-4` bắt object đó có
  **tên riêng**. Thoả cái trước mà hỏng cái sau là chuyện thường gặp.
- ↔ `IDENTITY-1`: rule giữ `IDENTITY-4` cũng khớp theo hậu tố `Exception`, nên một class sai
  `IDENTITY-1` thì `IDENTITY-4` cũng không được kiểm.

**Tình huống nghiệp vụ hay gặp.** Lỗi không có payload (thiếu header, thiếu config) · lỗi dùng lại
type của một lỗi anh em · lỗi sinh bằng snippet có sẵn · lỗi wrap một lỗi upstream và chỉ mang
`originalError`.

---

## `IDENTITY-5` — HTTP status không phải danh tính

**Tình huống.** Bạn đang cân nhắc `httpStatus`. Base nhận nó như một tham số **tuỳ chọn**, phần lớn
lỗi bỏ qua và rơi về mặc định 500 ở biên. Nó là một nhượng bộ cho tầng vận chuyển, dành cho các
trường hợp mà **status chính là hợp đồng**: một guard trả 401, một upload bị từ chối vì 413, một cấu
hình thiếu thật sự là 500.

Status **không bao giờ** là cách phân biệt hai lỗi, vì một status là một **hạng mục** mà hàng trăm lỗi
cùng thuộc về. Đây là lý do một exception có set status vẫn phải thoả đủ mọi mã ở trên, và là lý do
câu hỏi của người review luôn là "client khớp cái gì?" — câu đó đang hỏi về code. Một khai báo với
tay lấy status **để trở nên phân biệt được** là một khai báo đã trả lời sai câu hỏi.

**Dấu hiệu nhận biết**

- Hai lỗi cạnh nhau có code chung chung như nhau và được phân biệt bằng 403 với 404.
- Code là tên của một status (`FORBIDDEN_EXCEPTION`, `BAD_REQUEST_EXCEPTION`).
- Lý do đưa ra cho status là "để phía kia biết đây là lỗi khác", không phải "endpoint này cam kết trả
  status đó".
- Set status trên một lỗi chỉ chạy trong background job, nơi không có transport nào đọc nó.

**Tự hỏi.** Có caller nào **đã cam kết** với status này chưa? Nếu không có, bỏ status đi và để mặc
định làm việc của nó.

**Ranh giới**

- ↔ `IDENTITY-2`: xem trên. Status trả lời "transport nên đáp thế nào"; code trả lời "đây là lỗi
  nào". Dùng cái trước để làm việc của cái sau là nhầm tầng.
- ↔ `EXCEPTION-1`: đừng quay lại dùng exception của framework chỉ vì nó "mang sẵn status". Status
  không đổi lại được cái giá là mất danh tính.

**Tình huống nghiệp vụ hay gặp.** Guard xác thực (401) · guard phân quyền (403) · file quá lớn (413)
· rate limit (429) · secret chưa cấu hình (500, và đúng là 500) · lỗi domain thường (không set gì).

---

## Luật

1. Một lỗi có **một** từ, viết bằng **ba** bảng chữ, và ba bảng chữ nói cùng một thứ.
2. Tên class kết thúc bằng `Exception`. Không có ngoại lệ về kích thước hay mức độ nội bộ.
3. Code **suy ra** từ tên class, viết SCREAMING_SNAKE, truyền dạng **literal** vào `super()`.
4. Chỗ đặt gạch dưới trong acronym không thuộc luật; chữ cái mới thuộc luật.
5. Đổi tên class là đổi hợp đồng trên dây. Đổi cả hai, hoặc giữ nguyên cả hai cho tới khi client cũ
   được gỡ.
6. Type metadata mang tên exception của nó, kể cả khi rỗng.
7. `httpStatus` chỉ set khi status là hợp đồng của caller. Danh tính nằm ở code.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp vào.

- **Acronym.** (`IDENTITY-2`) Không phán xử chỗ đặt gạch dưới bên trong acronym. Hai cách tách cùng
  gọi tên một class.
- **Client đã phát hành.** (`IDENTITY-3`) Code cũ được phép ở lại trên dây — bằng cách **giữ nguyên
  tên class cũ**, không phải bằng cách để class mới mang code cũ.
- **Status là hợp đồng.** (`IDENTITY-5`) Guard, upload, rate limit và cấu hình sai được set status.
  Set ở đó không miễn bất cứ mã nào khác.
- **Lỗi hình dạng framework.** Class extends base của framework không thuộc module này; nó bị từ chối
  từ trước bởi `EXCEPTION-3`. Module này chỉ nói về danh tính **bên trong** house base.
- **Payload rỗng.** (`IDENTITY-4`) Không có miễn trừ cho lỗi "chẳng mang gì". Alias rỗng vẫn phải
  khai, vì nó là chỗ trường đầu tiên rơi vào.
