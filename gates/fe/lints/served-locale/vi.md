---
title: Served-locale · Vietnamese
---

# Ngôn ngữ được phục vụ

Đầu vào là mã đã viết xong — một tệp, một mảnh diff. Đầu ra là một **phán quyết**: tệp đó có thuộc
phạm vi hay không, rule đã xuất bản nào nổ, nó báo gì và nổ tại nút nào, mã luật tương ứng là mã nào,
và cửa còn mở nào lẽ ra đã che đúng cái sai đó. Mô-đun này không chọn gì cả. Nó từ chối, và nó phải
chỉ được đúng nút mà nó từ chối.

## Luật

Có những dữ liệu được dịch ở phía máy chủ, nên chính lời gọi phải nói ra nó muốn nhận lại ngôn ngữ
nào. Lời gọi không nói gì thì nhận bản mặc định, mãi mãi, ở mọi ngôn ngữ.

Luật mang năm mã, `LOCALE-1` … `LOCALE-5`. Tệp nguồn xuất bản đúng **hai** rule. Hai trong năm mã có
rule giữ; ba mã còn lại thì không, và điều đó được ghi thẳng ra như một phát hiện chứ không được làm
cho êm đi. Mô-đun này chỉ nói về phần THỰC THI: máy nhìn thấy được gì của luật ấy, và — phần chẳng ai
chịu viết ra — máy không nhìn thấy được gì.

## Luật máy đã xuất bản

| Rule | Mã | Nó báo gì |
|---|---|---|
| `api-client-attaches-the-locale` | `LOCALE-1` | Một tệp dựng đường truyền HTTP cuối cùng nhưng trong tệp không có lời gọi nào tới một xưởng tạo mắt xích ngôn ngữ. Báo một lần cho mỗi tệp, tại nút mắt xích cuối cùng đầu tiên. |
| `locale-header-belongs-to-the-link` | `LOCALE-5` | Một thuộc tính đối tượng mang khoá `x-locale` ở bất kỳ tệp nào không phải tệp mắt xích ngôn ngữ. Báo một lần cho mỗi thuộc tính vi phạm. |

`LOCALE-2` (đọc ngôn ngữ từ địa chỉ, không đọc từ một đối số), `LOCALE-3` (cookie không phải phương
tiện truyền tải khi vượt qua một origin) và `LOCALE-4` (mặc định của máy chủ là một sàn, không phải
một phương án dự phòng) **không có rule nào giữ**. Cả ba đều là khẳng định về việc một *giá trị* thực
sự LÀ gì, trong khi hai rule chỉ nhìn thấy một cái tên. Ba mã đó là **không được thực thi**, chứ không
phải được bao phủ: chúng là câu hỏi dành cho người duyệt, và coi một build xanh là bằng chứng cho
chúng chính là sai lầm mà mô-đun này sinh ra để chặn.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp đã
   qua — nghĩa là cổng miễn trừ đã nổ và rule không hề xét tệp đó.
2. **Kiểm miễn trừ.** `api-client-attaches-the-locale` tắt với tệp nằm trực tiếp trong một thư mục tên
   `links`, và tắt với tệp `.test.` hoặc `.spec.`. `locale-header-belongs-to-the-link` chỉ tắt với
   chính tệp mắt xích ngôn ngữ, và nó **không** có miễn trừ cho tệp kiểm thử.
3. **Đọc các nút.** Với rule chuỗi: mọi tên bên bị gọi của `CallExpression` và `NewExpression` trong
   tệp, kết luận tại `Program:exit`. Với rule header: mọi `Property` có khoá đọc được thành chuỗi.
4. **Xuất một khối cho mỗi phát hiện.** Rule chuỗi cho nhiều nhất một khối mỗi tệp; rule header cho một
   khối cho mỗi thuộc tính vi phạm.
5. **Viết dòng `hatch`** mỗi khi có một cửa còn mở lẽ ra đã che đúng cái sai đó.
6. **Đừng báo thứ không rule nào canh.** Ba trong năm mã không có máy nào giữ; một phán quyết nói khác
   đi là một phán quyết hiểu sai mô-đun.

## `api-client-attaches-the-locale` — LOCALE-1

**Nó báo cái gì.** Một tệp dựng đường truyền HTTP cuối cùng nhưng trong tệp không có lời gọi nào tới
một xưởng tạo mắt xích ngôn ngữ. Một báo lỗi cho mỗi tệp, neo vào nút mắt xích cuối cùng ĐẦU TIÊN mà
nó thấy.

**Nó phát hiện bằng gì.** Hai cổng miễn trừ đọc `context.filename` (thiếu thì `context.getFilename()`),
sau khi đã đổi mọi dấu gạch ngược thành gạch xuôi: `/\/links\/[^/]+$/` (tệp nằm trực tiếp trong một thư
mục tên `links`) và `/\.(?:test|spec)\.[cm]?[jt]sx?$/`. Rồi một hàm thăm duy nhất gắn vào cả
`CallExpression` lẫn `NewExpression`. Nó rút ra tên bên bị gọi — `Identifier` cho `.name`, một
`MemberExpression` có thuộc tính là `Identifier` cho `.property.name`, còn lại cho `null` — và so chuỗi
đó với hai tập cứng: tập cuối cùng `createHttpLink`, `HttpLink`, `createUploadLink`, `BatchHttpLink`;
tập ngôn ngữ `createAttachLocaleLink`, `createLocaleLink`. Tới `Program:exit`, thấy một tên cuối cùng
mà không thấy tên ngôn ngữ nào thì báo.

**Nó không thấy gì.** Xưởng cuối cùng được nhập khẩu dưới một tên khác —
`import { createHttpLink as createTransport }` rồi `createTransport({ uri })` — vì tập chỉ giữ bốn chuỗi
và so với cách viết của bên bị gọi, còn rule thì không truy vết nhập khẩu. Một chuỗi lắp từ những mắt
xích dựng ở nơi khác, `from([localeLink, authLink, httpLink])`, nơi không có lời gọi nào và không có
`new` nào, nên không tên cuối cùng nào được thấy và tệp im lặng — kể cả khi chính mắt xích ngôn ngữ là
thứ bị bỏ quên. `createLocaleLink` có mặt trong tệp nhưng không nằm trong chuỗi: gán vào một hằng chẳng
ai dùng, nằm trong một nhánh chết, hay được định nghĩa tại chỗ như một cái vỏ; rule chỉ ghi nhận rằng
một CÁI TÊN đã được gọi ở đâu đó trong tệp, không bao giờ kiểm kết quả có tới được mảng chứa mắt xích
cuối cùng hay không, cũng không kiểm nó có đứng trước hay không. Gắn có điều kiện,
`...(isLoggedIn ? [createAttachLocaleLink()] : [])`, trong khi `LOCALE-1` nói thẳng là **vô điều kiện**
— khách vãng lai cũng đọc bằng một ngôn ngữ. Một chuỗi hoàn chỉnh tình cờ nằm trong tệp đặt trực tiếp
dưới thư mục tên `links`, vì miễn trừ là lệnh cấm theo THƯ MỤC và nó miễn cho mọi tệp anh em cùng với
đúng tệp mà nó nhắm tới. Và một mắt xích ngôn ngữ tính ra giá trị sai — gán cứng một thứ tiếng, hay đọc
từ một đối số chẳng ai truyền — vì rule thấy một cái tên, không bao giờ thấy phần thân.

**Ranh giới.** Rule này phán xét xem một cái tên có được gọi trong một tệp hay không. Chuỗi header được
phép viết ở đâu là việc của `locale-header-belongs-to-the-link`. `LOCALE-2`, `LOCALE-3` và `LOCALE-4`
đều nằm xuôi dòng của một giá trị mà không rule nào nhìn vào được.

## `locale-header-belongs-to-the-link` — LOCALE-5

**Nó báo cái gì.** Một thuộc tính đối tượng có khoá đúng bằng `x-locale`, ở bất kỳ tệp nào không phải
tệp mắt xích ngôn ngữ. Mỗi thuộc tính vi phạm là một báo lỗi riêng, nên nhiều thuộc tính trong một tệp
đều báo.

**Nó phát hiện bằng gì.** Một cổng miễn trừ trên `context.filename` đã chuẩn hoá:
`/\/links\/locale\.[cm]?tsx?$/`. Rồi một hàm thăm `Property`. Khoá được đọc thành chuỗi theo đúng hai
cách — khoá `Identifier` **không** tính toán cho `.name`, khoá `Literal` có giá trị chuỗi cho `.value`
dù có tính toán hay không — rồi so bằng tuyệt đối với chuỗi `"x-locale"`.

**Nó không thấy gì.** `headers["x-locale"] = locale`, vì một phép gán vào biểu thức thành viên không
phải nút `Property` và rule chỉ đi trong đối tượng khai báo thẳng. `headers.set("x-locale", locale)`,
nơi tên header là một ĐỐI SỐ và không gì trong rule đọc đối số của lời gọi. `const HEADER = "x-locale"`
… `{ [HEADER]: locale }`, vì khoá tính toán dạng `Identifier` trả về `null` từ `propertyKeyOf` — nhánh
đó đòi khoá **không** tính toán — nên cái hằng rửa sạch chuỗi, và trớ trêu là chính tệp nguồn của rule
cũng xuất một hằng như vậy. `{ "X-Locale": locale }`, hay bất kỳ cách viết hoa thường nào khác, vì phép
so là so bằng tuyệt đối trong khi tên header là không phân biệt hoa thường trên đường truyền.
`{ ...localeHeader }`, vì một phần tử trải không phải `Property`, còn đối tượng được trải thì nằm trong
một tệp rule không mở ra. Tệp được miễn bị đổi tên thành `links/attach-locale.ts` — hay viết bằng
JavaScript thành `links/locale.js` — vì miễn trừ là một mẫu tên tệp mà nhóm đuôi `[cm]?tsx?` chỉ khớp
`.ts`, `.tsx`, `.mts`, `.cts` chứ không gì khác, và tên tệp là thứ rẻ nhất trong một kho mã để thay
đổi. Một tệp bất kỳ chẳng liên quan tình cờ nằm ở đường dẫn kết thúc `/links/locale.ts`, vì cổng là
phép khớp phần đuôi của đường dẫn chứ không phải phép nhận dạng mô-đun. Và chính mắt xích ngôn ngữ khi
nó ngừng viết header: rule cấm chuỗi đó ở nơi khác chứ không bao giờ đòi chuỗi đó **có mặt** ở đúng nơi
nó thuộc về, nên cả hai rule vẫn xanh trong khi không ai gửi header — đúng cái sai mà luật được viết ra
sau khi gặp phải.

**Ranh giới.** Rule này phán xét một chuỗi được phép viết ở đâu. Còn chuỗi truyền tải có gắn mắt xích
ngôn ngữ hay không là việc của `api-client-attaches-the-locale`.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng đường dẫn | `context.filename`, hoặc `context.getFilename()` khi thiếu cái trước, với mọi dấu gạch ngược đổi thành gạch xuôi trước mỗi phép thử, nên `\` và `/` so ra như nhau |
| miễn trừ của rule chuỗi | `/\/links\/[^/]+$/` và `/\.(?:test\|spec)\.[cm]?[jt]sx?$/` |
| miễn trừ của rule header | `/\/links\/locale\.[cm]?tsx?$/` |
| bộ duyệt | Một hàm thăm gắn vào cả `CallExpression` lẫn `NewExpression` cho rule chuỗi; một hàm thăm `Property` cho rule header |
| bộ đọc | `calleeName`: `Identifier` cho `.name`, `MemberExpression` có thuộc tính là `Identifier` cho `.property.name`, còn lại cho `null`. `propertyKeyOf`: khoá `Identifier` không tính toán cho `.name`, khoá `Literal` có giá trị chuỗi cho `.value`, dù tính toán hay không |
| các tập | tập cuối cùng `createHttpLink`, `HttpLink`, `createUploadLink`, `BatchHttpLink`; tập ngôn ngữ `createAttachLocaleLink`, `createLocaleLink`; chuỗi header `"x-locale"` |
| với ra ngoài tệp | Không gì cả. Không rule nào đọc kiểu, truy vết một nhập khẩu, đi theo một biến, hay nhìn sang tệp nào khác ngoài tệp trước mặt |

Cả hai rule đều là `type: "problem"` với `schema: []`, nên không có lựa chọn nào để làm nhẹ, và không
rule nào có bản vá tự động.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt qua, nhưng chúng không lọt.

| Viết như thế này | Vì sao vẫn nổ |
|---|---|
| `new HttpLink({ uri })` thay cho `createHttpLink({ uri })` | Một hàm thăm duy nhất gắn vào cả `CallExpression` lẫn `NewExpression`, nên hàm dựng và xưởng được đọc như nhau |
| `transport.createHttpLink({ uri })` — đi qua một đối tượng | `calleeName` bóc `MemberExpression` và trả `.property.name`, nên phần định danh phía trước bị bỏ đi |
| Gắn mắt xích ngôn ngữ ở dưới mắt xích cuối cùng trong tệp | Phép so xảy ra tại `Program:exit`, sau khi cả tệp đã duyệt xong, nên thứ tự trong nguồn không quan trọng |
| `{ ["x-locale"]: locale }` — khoá tính toán thay vì khoá thường | `propertyKeyOf` nhận mọi khoá `Literal` có giá trị chuỗi, dù tính toán hay không |
| Một đường dẫn Windows, nơi dấu ngăn là gạch ngược | Mọi phép thử đường dẫn chạy trên một bản đã chuẩn hoá |
| Đổi tên tệp chuỗi, hay cho nó đuôi `.tsx` | Rule chuỗi hoàn toàn không gác theo tên tệp, ngoài hai miễn trừ của nó. Tệp nào ở đâu cũng bị soi |
| Chôn mắt xích cuối cùng sâu thêm một thư mục, ở `links/http/index.ts`, để ăn theo miễn trừ | `/\/links\/[^/]+$/` đòi tệp nằm **trực tiếp** trong `links`, nên đường dẫn lồng không đủ tư cách |
| Viết header trong một hook thay vì trong tầng truyền tải | Rule header soi mọi tệp trừ đúng một đường dẫn được miễn, nên một hook, một hàm truy vấn hay một đối tượng cấu hình đều bị báo |

**Còn mở** — mù đã xuất xưởng. Một phán quyết không được nhận là đã xét những chỗ này. Không chỗ nào
trong đây là phá hoại; phần lớn chỉ là ai đó dọn dẹp cho gọn.

| Phạm vi | Cái gì lọt | Cái giá phải trả |
|---|---|---|
| `api-client-attaches-the-locale` | Xưởng cuối cùng nhập khẩu dưới một tên khác | Chuỗi không bao giờ được nhận ra là một chuỗi |
| `api-client-attaches-the-locale` | Chuỗi lắp từ những mắt xích dựng nơi khác, không có lời gọi và không có `new` | Im lặng kể cả khi chính mắt xích ngôn ngữ là thứ bị bỏ quên |
| `api-client-attaches-the-locale` | `createLocaleLink` được gọi nhưng không nằm trong chuỗi — hằng chẳng ai dùng, nhánh chết, cái vỏ tại chỗ | Một cái tên chẳng chứng minh gì về mảng hay về thứ tự |
| `api-client-attaches-the-locale` | Gắn có điều kiện | `LOCALE-1` nói là vô điều kiện; khách vãng lai cũng đọc bằng một ngôn ngữ |
| `api-client-attaches-the-locale` | Cả một chuỗi đặt trực tiếp trong thư mục tên `links` | Lệnh cấm theo thư mục miễn cho mọi tệp anh em |
| `api-client-attaches-the-locale` | Một mắt xích ngôn ngữ tính ra giá trị sai | Rule thấy một cái tên, không bao giờ thấy phần thân |
| `locale-header-belongs-to-the-link` | `headers["x-locale"] = locale` | Một phép gán không phải `Property` |
| `locale-header-belongs-to-the-link` | `headers.set("x-locale", locale)` | Tên header là đối số, mà đối số thì không được đọc |
| `locale-header-belongs-to-the-link` | `const HEADER = "x-locale"` … `{ [HEADER]: locale }` | Hằng rửa sạch chuỗi — chính tệp nguồn cũng xuất một hằng như vậy |
| `locale-header-belongs-to-the-link` | `{ "X-Locale": locale }`, hay bất kỳ cách viết hoa thường nào khác | Vẫn đúng header đó đi trên đường truyền mà không có báo lỗi nào |
| `locale-header-belongs-to-the-link` | `{ ...localeHeader }` dựng ở mô-đun khác | Trải không phải `Property`, còn mô-đun kia thì không được mở ra |
| `locale-header-belongs-to-the-link` | Tệp được miễn đổi tên thành `links/attach-locale.ts`, hay viết thành `links/locale.js` | Miễn trừ neo vào tên tệp, thứ rẻ nhất để thay đổi |
| `locale-header-belongs-to-the-link` | Một tệp bất kỳ chẳng liên quan ở đường dẫn kết thúc `/links/locale.ts` | Khớp phần đuôi không phải nhận dạng mô-đun; tệp đó được viết header thoải mái |
| `locale-header-belongs-to-the-link` | Chính mắt xích ngôn ngữ ngừng viết header | Cả hai rule vẫn xanh trong khi không ai gửi header — đúng cái sai mà luật được viết ra sau khi gặp phải |
| không rule nào | **Mọi thứ `LOCALE-2`, `LOCALE-3` và `LOCALE-4` cấm** — ngôn ngữ đọc từ một đối số thay vì từ địa chỉ, cookie dùng làm phương tiện truyền tải khi vượt qua một origin, mặc định của máy chủ bị dùng như phương án dự phòng | Ba trong năm mã hoàn toàn không có máy nào giữ |

Xanh cả hai rule là một phát biểu về TÊN GỌI và VỊ TRÍ, không bao giờ là phát biểu về giá trị mà một
lời gọi mang theo.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| tên tệp | `context.filename`, hoặc `context.getFilename()` khi thiếu cái trước, dưới dạng đường dẫn đã chuẩn hoá gạch xuôi |
| quyết định phạm vi | Cổng miễn trừ nào đã khớp, hoặc không cổng nào khớp |
| cú pháp | AST của MỘT tệp: `CallExpression`, `NewExpression`, `Property` |
| tên gọi | Cách viết của bên bị gọi, và cách viết của khoá thuộc tính |
| kiểu | Không có |
| nhập khẩu | Không truy vết. Một ràng buộc nhập khẩu chỉ là một cái tên, không hơn |
| tệp khác | Không đọc. Cả hai rule đều là mỗi lần một tệp, ngay từ cách dựng |

## Quy tắc

1. Danh tính của một rule là **tên đã xuất bản** của nó. Mô-đun này không đặt thêm mã số cho rule nào.
2. Cả hai rule đều là `type: "problem"` và xuất xưởng ở mức `error`. Không có bậc cảnh báo và không có
   đối tượng lựa chọn.
3. `api-client-attaches-the-locale` báo nhiều nhất một lần cho mỗi tệp, neo vào nút mắt xích cuối cùng
   ĐẦU TIÊN mà nó thấy.
4. `locale-header-belongs-to-the-link` báo một lần cho mỗi thuộc tính vi phạm, nên nhiều thuộc tính
   trong một tệp đều báo.
5. Không rule nào có bản vá tự động. Một báo lỗi luôn là một lần sửa bằng tay.
6. Xanh cả hai rule là một phát biểu về TÊN GỌI và VỊ TRÍ, không bao giờ là phát biểu về giá trị mà một
   lời gọi mang theo.
7. Chỉ tài liệu hoá rule có thật trong tệp nguồn. Một rule đáng ra nên tồn tại là một rủi ro, không
   phải một rule.
8. Mỗi rule phải có ít nhất một cửa còn mở được viết ra, hoặc một lập luận vì sao nó kín. Viết "không
   có" cho gọn là điều bị cấm ở đây: một cửa mở không ai biết nguy hiểm hơn một luật không có rule nào,
   vì luật không có rule thì ai cũng biết là không được giữ, còn rule rò rỉ thì ai cũng tin là đã kín.

## Ngoại lệ

Ba miễn trừ nằm trong nguồn, mỗi miễn trừ chỉ thuộc về **một** rule.

- **Tệp cài đặt của một mắt xích** được miễn khỏi rule chuỗi, tức là nhả `LOCALE-1` cho tệp nằm trực
  tiếp trong `links/`. Tệp như vậy định nghĩa **một** mắt xích; dựng mắt xích cuối cùng chính là việc
  của nó, và gắn mắt xích ngôn ngữ vào trong đó là một chuỗi trốn bên trong một mắt xích. Miễn trừ này
  được tìm ra bằng cách **chạy thật** chứ không phải bằng cách nghĩ: bản đầu tiên báo lỗi một tệp đã làm
  đúng mọi thứ, và một rule không có cách nào thoả mãn đúng là một phát hiện về chính rule đó.
- **Tệp spec hoặc test** được miễn khỏi rule chuỗi, tức là nhả `LOCALE-1` ở đó, vì nó khẳng định *về*
  một chuỗi chứ không *là* một chuỗi.
- **Tệp mắt xích ngôn ngữ** được miễn khỏi rule header, tức là nhả `LOCALE-5` cho đúng một đường dẫn,
  nhận diện bằng đường dẫn chứ không bằng nội dung, vì điều rule đó muốn giữ chính là "chỉ một chỗ có
  tên được viết header".

Rule header **không** có miễn trừ cho tệp kiểm thử. Hàm nhận diện tệp spec có tồn tại nhưng chỉ được
rule chuỗi dùng, nên một câu khẳng định có nhắc tên header vẫn bị báo như mã sản xuất.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
file: <path as the rule sees it, forward slashes>
rule: <api-client-attaches-the-locale | locale-header-belongs-to-the-link>
scope: <in | out — the exemption gate that decided it>
report: <line>:<col>  error  <message>  starci-fe/<rule>
code: <LOCALE-1 | LOCALE-5>
hatch: <the open hatch that would have hidden this, or none>
```

Tên đã xuất bản CHÍNH LÀ danh tính của rule. Đó là thứ hiện ra trong log build, trong một comment tắt
rule, và trong mọi cuộc trao đổi về lần đỏ đó.

Một tệp sạch xuất một khối với `report: none` cùng dòng `hatch` gọi tên cửa còn mở nào lẽ ra đã che một
cái sai ở đây, hoặc `none`. Một tệp ngoài phạm vi xuất một khối với `scope: out` kèm cổng đã miễn cho
nó, và `report: unjudged` — không bao giờ là `report: none`, vì rule đã không nhìn.

## Ví dụ đã giải

**Đầu vào.** Hai tệp.

```ts
// src/api/client.ts
import { createHttpLink, from } from "@apollo/client"
import { authLink } from "./links/auth"

export const link = from([authLink, createHttpLink({ uri: API_URL })])
```

```ts
// src/hooks/use-course.ts
export function courseHeaders(locale: string) {
  return { "x-locale": locale, "x-client": "web" }
}
```

`api/client.ts` không nằm trong thư mục nào tên `links` và không phải tệp spec, nên rule chuỗi chạy.
Nó gọi `createHttpLink` và không hề gọi xưởng ngôn ngữ nào.

```text
file: src/api/client.ts
rule: api-client-attaches-the-locale
scope: in — neither /\/links\/[^/]+$/ nor /\.(?:test|spec)\.[cm]?[jt]sx?$/ matched
report: 5:38  error  <message>  starci-fe/api-client-attaches-the-locale
code: LOCALE-1
hatch: none
```

`hooks/use-course.ts` không phải `links/locale.<ext>`, nên rule header chạy, và khoá `Literal`
`"x-locale"` khớp tuyệt đối.

```text
file: src/hooks/use-course.ts
rule: locale-header-belongs-to-the-link
scope: in — /\/links\/locale\.[cm]?tsx?$/ did not match
report: 3:11  error  <message>  starci-fe/locale-header-belongs-to-the-link
code: LOCALE-5
hatch: none
```

**Đã sửa.** Chuỗi gắn mắt xích ngôn ngữ, và header quay về đúng một tệp sở hữu nó:

```ts
// src/api/client.ts
import { createHttpLink, from } from "@apollo/client"
import { createAttachLocaleLink } from "./links/locale"
import { authLink } from "./links/auth"

export const link = from([createAttachLocaleLink(), authLink, createHttpLink({ uri: API_URL })])
```

```ts
// src/hooks/use-course.ts
export function courseHeaders() {
  return { "x-client": "web" }
}
```

Cả hai rule xanh. Nhưng một cửa còn mở sống sót qua lần sửa này — rule header không bao giờ đòi chuỗi
đó có mặt ở đúng nơi nó thuộc về:

```text
file: src/api/links/locale.ts
rule: locale-header-belongs-to-the-link
scope: out — /\/links\/locale\.[cm]?tsx?$/ matched
report: unjudged
code: LOCALE-5
hatch: the exempt file may stop writing the header entirely and both rules stay green, so this silence is not compliance
```

Và một cửa nữa cũng sống sót qua đúng lần sửa đó — rule chuỗi thấy một cái tên, không thấy một chuỗi:

```text
file: src/api/client.ts
rule: api-client-attaches-the-locale
scope: in — neither exemption matched
report: none
code: LOCALE-1
hatch: the rule records that createAttachLocaleLink was called somewhere in the file; it never checks the call reaches the array the terminal link is in, nor that it precedes it, nor that the value it computes is right
```

## Phạm vi

Mô-đun này tài liệu hoá hai rule và không gì khác. Nó không gọi tên sản phẩm nào, thư viện client nào,
kho mã nào; tên rule, tên các bên bị gọi mà rule canh và chuỗi header đều là định danh xuất xưởng, và
chúng được trích nguyên văn vì một định danh bị đổi tên là một rule khác. Ngôn ngữ có được đọc từ địa
chỉ hay không, cookie có mang nó vượt qua một origin hay không, và mặc định của máy chủ là một sàn hay
một phương án dự phòng là `LOCALE-2`, `LOCALE-3` và `LOCALE-4`, thuộc về luật và về người duyệt — không
mô-đun nào ở đây phán xét chúng.
