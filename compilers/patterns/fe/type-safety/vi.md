---
title: Type-safety · Vietnamese
module: type-safety
kind: pattern
codes: [TYPE-SAFETY-1, TYPE-SAFETY-2, TYPE-SAFETY-3, TYPE-SAFETY-4, TYPE-SAFETY-5]
---

# An toàn kiểu

Đầu vào là một shape đã có người duyệt — một layout, một block, một capability hay một contract mà
không ai còn cãi nữa. Đầu ra là kiến trúc source: file nào giữ giá trị đi từ ngoài vào, file ấy được
khai gì, không được khẳng định gì, và nợ lại điều gì bằng chữ khi nó khẳng định. Module này không mở
lại quyết định thiết kế. Nó hạ shape đó xuống source, đúng tại chỗ mà shape lặng lẽ được phép thôi
không còn bị kiểm.

## Luật

Kiểu là **nửa canon mà máy giữ hộ, không cần ai nhắc**. Phần lớn những gì các module khác nói ra được
giữ bởi một union đóng hoặc một alias slot, chứ không phải bởi một rule lint. Nghĩa là giá trị của hệ
kiểu ở đây không phải "ít bug hơn" một cách chung chung. Nó là: **phần lớn canon thôi không còn là
tuỳ chọn.**

Vì vậy module này chỉ có **một** việc: canh những chỗ có người **tắt hệ kiểu đi**. Một cast không sửa
lỗi kiểu; nó **làm im** một lỗi kiểu, đúng tại cái seam mà lỗi đó đáng có mặt nhất.

Câu hỏi phân định mọi mã dưới đây:

> **Trình biên dịch đang biết điều gì mà dòng này bảo nó quên đi?**

Nếu câu trả lời là "không gì cả, hai kiểu vốn khớp nhau" thì cast đó thừa. Nếu câu trả lời là bất cứ
thứ gì khác, cast đó đang **giấu** điều đó.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi lần xoá kiểu trong source đều rơi vào đúng một
trong năm tình huống dưới đây. Không có kích thước nào nhỏ đến mức được miễn mang mã: một dòng
`as unknown as` trong một helper là `TYPE-SAFETY-1`, cũng vì lý do đó mà một `any` lan khắp module là
`TYPE-SAFETY-2`. Câu "có mỗi một dòng thôi mà" không phải một ngoại lệ — nó chính là câu mở ra cái
seam.

## Mã tình huống

Mọi tình huống module này canh đều mang một mã, `TYPE-SAFETY-<n>`. Mã gọi tên TÌNH HUỐNG; các cột nói
tình huống ấy đòi source phải trông thế nào và cấm điều gì.

| Mã | Tình huống | Source phải trông thế nào |
|---|---|---|
| `TYPE-SAFETY-1` | Một giá trị vừa vượt vào chương trình và người viết cast nó xuyên `unknown` | Giá trị đi vào chương trình được thu hẹp bằng một phép kiểm mà trình biên dịch theo được. Cấm: cast xuyên `unknown` — `x as unknown as T` — trong source sản phẩm bị canh |
| `TYPE-SAFETY-2` | Hình dạng thật sự chưa biết và người viết với tay lấy `any` | Hình dạng thật sự chưa biết thì khai `unknown`, để việc thu hẹp buộc phải xảy ra ở chỗ nhìn thấy được. Cấm: `any`, trong một khai báo, một tham số, một đối generic hay một cast |
| `TYPE-SAFETY-3` | Kiểu mảng được viết bằng hai cách trong cùng một cây source | Một cách viết duy nhất cho kiểu mảng: `Array<T>` và `ReadonlyArray<T>`. Cấm: `T[]` và `readonly T[]` |
| `TYPE-SAFETY-4` | Một test buộc phải dựng giá trị mà kiểu cấm, vì đó chính là thứ nó chứng minh | Quyền dựng một giá trị mà kiểu cấm là một ĐƯỜNG DẪN — file `.test.` hoặc `.spec.` — và giá trị sai chính là thứ file đó đang chứng minh. Cấm: một miễn trừ dựa trên phán đoán đem cãi ở call site; một file sản phẩm nhận quyền của test |
| `TYPE-SAFETY-5` | Một cast tại một biên thật sống sót qua review | Cast sống sót qua review thì nêu lý do trong một mệnh đề ngay bên cạnh. Cấm: một cast mà lý do duy nhất là lỗi đã hết báo |

Hai mã gọi tên **sự vắng mặt của một cơ chế** chứ không phải một giá trị. `TYPE-SAFETY-4` là một
quyền, không phải một điều cấm: đây là mã duy nhất trong module nói **được phép**, và nó tồn tại để
chữ **không** ở `TYPE-SAFETY-1` được tuyệt đối ở mọi nơi khác. `TYPE-SAFETY-5` canh một comment, thứ
duy nhất trong danh sách này mà không trình biên dịch nào đọc. Cả hai đều là tình huống thật mà người
đọc phải trích dẫn được: một module chỉ mô tả nổi những gì checker nhìn thấy thì không sửa được đúng
những ca mà checker cố tình không được giao.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói rằng một giá trị nào đó chạm tới bề mặt này: một response body, một
   record đọc từ storage, một token đã decode, một event vendor, một prop của contract. Điều đó đã
   chốt; ở đây không mở lại.
2. **Đọc xem shape không nói gì, và vì thế không giải quyết gì.** Một shape không bao giờ nói kiểu nên
   chứa gì — chuyện đó thuộc về module contract và props — và cũng không nói giá trị có được kiểm ở
   runtime hay không. Module này chỉ canh đúng khoảnh khắc trình biên dịch bị bảo thôi nhìn.
3. **Giải từ ngoài vào trong.** Bắt đầu ở file nơi giá trị bước vào chương trình rồi đi dần vào trong.
   Cái seam mà một double cast xoá đi chính là seam ngoài cùng, và mọi file bên trong đều thừa hưởng
   bất cứ điều gì file ấy đã quyết.
4. **Hỏi câu hỏi của từng mã, theo thứ tự.** File có cast xuyên `unknown` không (`TYPE-SAFETY-1`)? Nó
   có viết `any` ở chỗ hình dạng thật sự chưa biết không (`TYPE-SAFETY-2`)? Kiểu mảng có bị viết hai
   cách không (`TYPE-SAFETY-3`)? Đường dẫn có phải file `.test.`/`.spec.` mà chủ đề của nó chính là giá
   trị sai không (`TYPE-SAFETY-4`)? Một cast sống sót có mang lý do trong một mệnh đề không
   (`TYPE-SAFETY-5`)?
5. **Khi hai mã cùng khớp, chọn mã có bán kính đúng.** Xoá dừng lại ở một dòng là `TYPE-SAFETY-1`; một
   kiểu đi theo giá trị sang cả những file chưa bao giờ nhắc tới nó là `TYPE-SAFETY-2`. Cùng một hành
   vi, khác bán kính — và cái đi theo thì đắt hơn.

## `TYPE-SAFETY-1` — cast xuyên `unknown` là xoá, không phải thu hẹp

**Tình huống.** Một giá trị vừa đi từ **ngoài chương trình vào trong**: response mạng, thứ đọc từ
storage, một payload người khác gửi tới, một kiểu vendor không khớp. Nó không có hình dạng mình muốn.
Thay vì kiểm tra, người viết bảo trình biên dịch quên hết đi bằng `x as unknown as T`.

**Nó sinh ra gì trong source.** Một file bị canh dưới `/src/` khai giá trị đi vào rồi thu hẹp nó bằng
một phép kiểm mà trình biên dịch theo được — một predicate, một `typeof`, một trường phân biệt. Cụm
`as unknown as` không xuất hiện trong file ấy. Cast **một tầng** như `a as B` vẫn còn là một lời khai
mà trình biên dịch **kiểm được một phần** — nó vẫn từ chối nếu hai kiểu không có gì chung. Chính vì
thế mới phải đi vòng qua `unknown`: `unknown` chung với **mọi** kiểu, nên bước qua nó là cách hợp pháp
hoá một lời khai đáng ra không kiểm nổi. Đó không phải thu hẹp. Đó là **xoá** — và cái bị xoá đúng là
cái đáng giữ nhất: seam nơi giá trị vượt từ ngoài vào trong. Bên trong chương trình, một cast sai
thường được các kiểu khác bắt lại vài dòng sau. Ở biên, không có ai bắt cả; dữ liệu sai sẽ đi tiếp cho
tới lúc nó vỡ ở một chỗ chẳng liên quan gì.

**Dấu hiệu nhận biết.** Cụm chữ `as unknown as` xuất hiện trong một file không phải test. Cast nằm ngay
sau `JSON.parse`, `response.json()`, `localStorage.getItem`, hoặc một import vendor. Lý do được nêu là
*TypeScript kêu*, *nó không chịu nhận*, *biết chắc nó là kiểu này rồi*. Tự hỏi: nếu ngày mai server đổi
field, dòng này có đỏ lên không? Nếu không, không ai đang kiểm cả, và cast này chính là chỗ việc kiểm
bị tắt.

**Ranh giới.** Không phải `TYPE-SAFETY-2`: mã này xoá **tại một dòng**, còn `any` xoá rồi **đi theo giá
trị** sang mọi file nó chạm tới. Không phải `TYPE-SAFETY-4`: cùng một cú pháp, khác **file** — trong
`.test.`/`.spec.` thì dựng giá trị sai chính là việc của file đó. Không phải `TYPE-SAFETY-5`: mã ấy nói
về cast **một tầng** còn giữ được lý do; cast xuyên `unknown` không được cứu bằng một dòng comment, vì
lý do không làm cho việc xoá trở lại thành việc kiểm. Và cast đi *vào* `unknown` — riêng
`value as unknown` — không phải mã này: nó chuyển giá trị từ một kiểu không đáng tin sang một kiểu
**không dùng được nếu chưa kiểm**, tức chiều ngược lại, và là chiều luật này muốn.

**Tình huống nghiệp vụ hay gặp.** Body của một response REST · payload đã decode của một token · một
record đọc từ `localStorage` · một kiểu vendor khai sai · một event của thư viện bên thứ ba · dữ liệu
seed đưa vào một hàm đã đóng kiểu.

## `TYPE-SAFETY-2` — `any` là cùng một hành vi xoá, và nó lan

**Tình huống.** Hình dạng thật sự chưa biết, nên người viết đặt `any` cho xong. Khác biệt so với
`TYPE-SAFETY-1` không nằm ở mức độ nghiêm trọng của một dòng, mà ở **bán kính**.

**Nó sinh ra gì trong source.** Một khai báo, một tham số hay một đối generic mang kiểu `unknown`, với
bước thu hẹp nhìn thấy được ngay trong file cần nó — một predicate cục bộ, một `isRecord`, một chuỗi
`typeof` — và không có `any` ở bất cứ đâu trong file. Một cast dừng lại ở dòng đó. `any` thì **đi
theo**: mọi property đọc ra từ nó là `any`, mọi giá trị suy ra từ nó là `any`, và việc xoá kiểu chạm
tới cả những file chưa bao giờ nhắc tới nó. Người sau đọc một file sạch sẽ, thấy một biến có kiểu, và
không có cách nào biết rằng kiểu đó đã bị bỏ kiểm từ ba file trước. `unknown` không nói dối: nó nói
"chưa biết", và nó **bắt** việc thu hẹp phải xảy ra ở đâu đó, giữa thanh thiên bạch nhật.

**Dấu hiệu nhận biết.** `: any`, `<any>`, `as any`, `Array<any>`, `Record<string, any>`. Một hàm nhận
`any` rồi trả về thứ gì đó có kiểu, mà **không** có bước kiểm nào ở giữa. Lý do được nêu là *tạm thời*,
*sẽ sửa sau*, *chỗ này generic quá*. Tự hỏi: nếu đổi `any` này thành `unknown`, có bao nhiêu chỗ đỏ
lên? Mỗi chỗ đỏ là một chỗ đang tin vào một điều chưa ai kiểm.

**Ranh giới.** Không phải `TYPE-SAFETY-1`: nếu chọn được, hãy chọn mã có **bán kính đúng** — một dòng
thì là `TYPE-SAFETY-1`, một kiểu lan đi thì là `TYPE-SAFETY-2`. Không phải `TYPE-SAFETY-5`: `any`
**không** được cứu bằng một lý do, vì lý do biện hộ cho việc bắc cầu tại một điểm, mà `any` không phải
một điểm.

**Tình huống nghiệp vụ hay gặp.** Wrapper quanh một client HTTP · handler nhận payload của webhook ·
adapter dịch dữ liệu vendor · hàm util "dùng chung" đã mất kiểu từ lâu · props tạm của một component
mới dựng.

## `TYPE-SAFETY-3` — một thứ, một cách viết

**Tình huống.** `Array<T>` và `T[]` **nghĩa y hệt nhau**. Đó chính xác là lý do đây là một luật chứ
không phải một sở thích: khi hai cách viết cùng đúng, không có thứ gì sửa cách thứ hai cả.

**Nó sinh ra gì trong source.** Mọi kiểu mảng trong cây đều viết ở dạng generic — `Array<T>` và
`ReadonlyArray<T>` — kể cả khi kiểu phần tử tự nó đã generic hoặc lạ. Chọn dạng generic vì nó là dạng
**còn đọc được khi kiểu phần tử tự nó cũng generic**. So `Array<Map<string, Set<number>>>` với
`Map<string, Set<number>>[]`: ở dạng hậu tố, cặp ngoặc nói "đây là mảng" bị đẩy ra tận cuối, sau khi
mắt đã phải giải xong hai tầng generic khác. File viết hôm thứ Ba đọc khác file bên cạnh, và mọi diff
sau đó mang thêm tiếng ồn không nói gì về nghiệp vụ.

**Dấu hiệu nhận biết.** `T[]` hoặc `readonly T[]` trong một file `.ts`/`.tsx`. Hai cách viết cùng tồn
tại trong **một** file. Tự hỏi: nếu kiểu phần tử ngày mai trở thành generic, dòng này còn đọc được
không?

**Ranh giới.** Không phải bất kỳ mã nào khác ở đây: đây là mã duy nhất **không** nói về việc tắt kiểm.
Không có gì bị xoá cả; hệ kiểu vẫn làm việc như thường. Nó ở trong module này vì cùng một lý do gốc —
thứ không có ai sửa thì sẽ trôi.

**Tình huống nghiệp vụ hay gặp.** Kiểu dữ liệu của một component · kết quả query · tham số rest của một
handler · union chứa mảng lồng · kiểu readonly của contract.

## `TYPE-SAFETY-4` — test được phép dựng giá trị sai, vì đó là việc của nó

**Tình huống.** Cần chứng minh rằng một API đã đóng kiểu **từ chối** đầu vào sai. Muốn chứng minh điều
đó thì phải **dựng ra** đầu vào sai — và không có cách nào dựng một giá trị mà kiểu cấm, ngoài việc bảo
trình biên dịch quên kiểu đi.

**Nó sinh ra gì trong source.** Một file có đường dẫn kết thúc bằng `.test.ts`, `.test.tsx`, `.spec.ts`
hoặc `.spec.tsx`, giữ giá trị cố tình sai, còn file sản phẩm thì để sạch. Đây là mã duy nhất trong
module nói **được phép**. Nó tồn tại chính để chữ **không** ở `TYPE-SAFETY-1` được tuyệt đối ở mọi nơi
khác. **Miễn trừ này là một ĐƯỜNG DẪN, và bắt buộc phải là đường dẫn.** Một miễn trừ dựa trên phán đoán
— "khi nào thật sự cần thì được" — sẽ bị đem ra cãi ở **từng** call site, và bên cãi luôn là bên đang
vội. Một đường dẫn thì cãi **một lần**, ở đây.

**Dấu hiệu nhận biết.** File kết thúc bằng `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`. Giá trị
được dựng là một fake **cố tình thiếu**: đủ để hàm dưới test chạm tới, không đủ để khớp kiểu thật. Xung
quanh có một câu làm rõ file này đang canh điều gì. Tự hỏi: giá trị sai này có phải **chính là thứ đang
được chứng minh** không? Nếu chỉ là dựng fixture cho nhanh thì miễn trừ không áp dụng — nó chỉ đang mượn
quyền của một mã khác.

**Ranh giới.** Không phải `TYPE-SAFETY-1`: cùng cú pháp, khác file. Đây là toàn bộ khác biệt, và cũng
là lý do miễn trừ phải là đường dẫn chứ không phải lời hứa. Không phải `TYPE-SAFETY-5`: trong test, lý
do **không** phải điều kiện để cast tồn tại; nhưng một câu nói file đang canh gì vẫn là thứ khiến người
sau đọc được, và đó là thói quen chứ không phải luật. **Một file test không tự động sạch.** Miễn trừ
chỉ nói: dựng giá trị sai ở đây không phải lỗi. Nó **không** nói mọi cast trong test đều đúng. Cast
trong test vì lười vẫn là cast vì lười — chỉ là không có gì báo cáo nó.

**Tình huống nghiệp vụ hay gặp.** Fake một operation của transport link · dựng response thiếu field bắt
buộc · ép một `undefined` vào chỗ khai là `Error` để xem nhánh phòng thủ có chạy · mock một module
vendor bằng những mảnh tối thiểu · dựng một state không hợp lệ để kiểm guard.

## `TYPE-SAFETY-5` — cast sống sót thì mang theo lý do

**Tình huống.** Đôi khi một biên **thật sự** cần một cast: kiểu vendor khai sai, một giá trị mà runtime
bảo đảm còn trình biên dịch thì không, một implementation rộng hơn mọi overload của chính nó. Những
trường hợp đó có thật.

**Nó sinh ra gì trong source.** Một cast một tầng, bên cạnh là một mệnh đề nêu **điều runtime bảo đảm**
hoặc **điều vendor khai sai**, và sau cast vẫn còn một bước kiểm — cast chỉ mở đủ chỗ để kiểm, không
thay cho kiểm. Thứ tách chúng khỏi phần còn lại không phải mức độ tự tin của người viết, mà là: **lý do
viết ra được thành một mệnh đề**. Và phép thử ấy mạnh hơn vẻ ngoài của nó. Khi ép mình viết câu đó ra,
phần lớn cast sẽ tự hỏng: câu duy nhất viết được là "vì nếu không thì nó báo lỗi" — mà lỗi ấy chính là
trình biên dịch đang nói một điều **đúng**.

**Dấu hiệu nhận biết.** Cast một tầng, không xuyên `unknown`. Bên cạnh có một câu nêu điều runtime bảo
đảm hoặc điều vendor khai sai, không phải nêu lại cast đang làm gì. Sau cast vẫn còn một bước thu hẹp.
Tự hỏi: viết lý do ra thành một câu đi. Nếu câu ấy là "vì nó báo lỗi" thì cast này thuộc về
`TYPE-SAFETY-1` hoặc thuộc về một sửa đổi hình dạng, không thuộc về đây.

**Ranh giới.** Không phải `TYPE-SAFETY-1`: lý do **không** cứu được cast xuyên `unknown`; xoá kiểu kèm
giải thích vẫn là xoá kiểu. Không phải `TYPE-SAFETY-2`: lý do cũng không cứu được `any`, vì `any` không
dừng ở dòng có lý do ấy. Không phải `TYPE-SAFETY-4`: trong test, cast không cần xin phép; ngoài test,
nó cần. **Không có rule nào giữ mã này, và không thể có.** Máy nhìn thấy comment tồn tại, nhưng không
nhìn thấy comment **đúng**. Một rule đòi "phải có comment" sẽ được thoả mãn bởi chữ `cast`. Đây là chỗ
duy nhất trong module mà người đọc là cơ chế duy nhất.

**Tình huống nghiệp vụ hay gặp.** Implementation của một factory có overload · claim công khai đã decode
từ token · một `.d.ts` vendor thiếu field mà runtime luôn gửi · một literal cần bảo toàn kiểu hẹp · một
branded type dựng ở đúng một chỗ đã kiểm.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là một union đóng hoặc một branded type làm cho
giá trị sai không viết ra được; `enforced` nghĩa là một rule trong `starci-eslint/packages/fe/type-safety.mjs` báo cáo
nó, tên rule nêu bên dưới; `documented` nghĩa là không có gì trong file rule của module này giữ nó, chỉ
người đọc giữ.

| Mã | Tầng | Ai giữ |
|---|---|---|
| `TYPE-SAFETY-1` | `enforced` | `no-double-cast`, messageId `double`. Báo cáo cast ngoài của cặp `x as unknown as T`, trong mọi file khớp `/src/` mà không phải `.test.`/`.spec.`. Chính xác — nó khớp đúng một hình dạng cú pháp — và đầy đủ cho hình dạng đó. |
| `TYPE-SAFETY-2` | `documented` | Không gì trong file này, **cố ý**. Chính plugin TypeScript có `@typescript-eslint/no-explicit-any` từ chối `any`, và viết lại nó ở đây là tạo bản sao thứ hai của rule người khác — thêm một thứ phải giữ cho khớp, mà cái không ai sửa mới chính là cái ngừng khớp. Giữ ở ngoài module, với một cái giá đã biết: module này không nói được rule đó chạy ở mức severity nào. |
| `TYPE-SAFETY-3` | `documented` | Không gì trong file này, cũng vì lý do đó. Cách viết mảng là câu hỏi hình dạng formatter, đã được `@typescript-eslint/array-type` với `{ default: "generic", readonly: "generic" }` trả lời. Thứ không rule nào giữ là *lý do* — rằng dạng generic còn đọc được khi kiểu phần tử tự nó cũng generic. |
| `TYPE-SAFETY-4` | `documented` | Miễn trừ được HIỆN THỰC bởi `no-double-cast` (`isTestFile`, `isGoverned`), nên một file sản phẩm không thể nhận quyền ấy — nhưng nửa đó được báo cáo dưới `TYPE-SAFETY-1`. Nửa thuộc về mã này, rằng giá trị sai chính là thứ test đang CHỨNG MINH, thì không ai giữ. Một test cast xuyên `unknown` vì lười sẽ đi qua trong im lặng. |
| `TYPE-SAFETY-5` | `documented` | Không rule nào đọc một lý do. Checker thấy được comment tồn tại; nó không thấy được comment đúng, và một rule đòi có comment gì cũng được sẽ được thoả mãn bởi chữ `cast`. |

Một mã do rule giữ; bốn mã do người đọc giữ. Bốn mã ấy không phải một đống nợ để đóng lại trong im
lặng. Hai mã (`TYPE-SAFETY-2`, `TYPE-SAFETY-3`) là bàn giao có chủ đích cho những rule mà repository
tiêu thụ vốn đã có, và hai mã (`TYPE-SAFETY-4`, `TYPE-SAFETY-5`) là phần luật mà không thể giao cho một
checker nếu không muốn nó thành thủ tục hình thức.

## Điểm neo

Một luật không chỉ được vào code thật thì chỉ là một đề xuất. Đường dẫn tính từ cây source front-end.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `TYPE-SAFETY-1` | `src/components/contracts/props.ts`, và sự vắng mặt trên toàn cây | Các kiểu contract được khai báo, không bao giờ bị cast vào chỗ. Trên toàn cây, mọi lần xuất hiện của `as unknown as` đều nằm trong file `.test.`/`.spec.`; không có file source bị canh nào chứa nó. Chính sự vắng mặt đó là điểm neo — bằng chứng của mã này là một con số không, và một hit mới duy nhất đã là toàn bộ finding. |
| `TYPE-SAFETY-2` | `src/modules/code/sandbox-repo.ts`, `src/components/leaves/Article/index.tsx` | Cả hai nhận giá trị bên ngoài dưới dạng `unknown` — `parseSandboxRepoSnapshot(raw: unknown)`, `toNode(value: unknown)` — và mỗi file mang một predicate `isRecord` cục bộ để thu hẹp nó. Việc thu hẹp nhìn thấy được ngay trong file cần nó, đó là thứ `unknown` mua được còn `any` thì tiêu mất. |
| `TYPE-SAFETY-3` | `src/components/contracts/props.ts` | `ReadonlyArray<DataValue>` bên trong union `DataValue` và `Array<never>` trong `ComponentActions`. Cả hai đều là kiểu phần tử tự nó generic hoặc lạ, và đó chính là chỗ cách viết thôi không còn là chuyện hình thức. |
| `TYPE-SAFETY-4` | `src/modules/api/graphql/clients/links/bearer.test.ts` | Một operation transport giả được ráp từ ba method mà link chạm tới rồi trả về qua một double cast. Doc comment của chính file nói nó đang canh gì; cast tồn tại vì muốn chứng minh một API đóng kiểu từ chối một operation dị dạng thì phải dựng ra một cái. |
| `TYPE-SAFETY-5` | `src/hooks/auth/useSessionRefresh.ts`, `src/components/contracts/props.ts` | Ở file thứ nhất, đích của cast là `{ exp?: unknown }` và dòng doc phía trên nói vì sao hình dạng ấy không được tin thêm nữa; sau đó giá trị được thu hẹp bằng `typeof`. Ở file thứ hai, implementation của một factory có overload được cast sang chính tập overload của nó, dưới một doc comment nói bề mặt nào mới là bề mặt được kiểm. Ca ngược trong cùng cây: `src/app/sitemap.ts` cast một response body sang một kiểu có tên mà không có mệnh đề lý do, và không có gì báo cáo nó. |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| đường dẫn file | File là source sản phẩm bị canh (`/src/`) hay là file `.test.`/`.spec.` |
| hình dạng xoá kiểu | Double cast xuyên `unknown`, một annotation `any`, hay một cast một tầng |
| nguồn gốc của giá trị | Nó vượt từ ngoài vào chương trình — mạng, storage, một kiểu vendor — hay được dựng bên trong |
| trình biên dịch đang biết gì | Kiểu đang có hiệu lực ở dòng ngay trước lần xoá |
| tầm với | Việc xoá dừng lại ở dòng này hay đi theo giá trị |
| lý do | Với một cast sống sót: câu sẽ được viết ngay bên cạnh nó |

## Quy tắc

1. Không `as unknown as` trong source sản phẩm dưới `/src/`.
2. Cast là **xoá**, không phải thu hẹp. Thu hẹp là lời khai mà trình biên dịch còn kiểm được một phần.
3. Cái seam mà một double cast xoá đi chính là cái đáng kiểm nhất: nơi giá trị vượt từ ngoài chương
   trình vào trong.
4. `unknown` buộc việc thu hẹp phải xảy ra ở một chỗ nhìn thấy được; `any` gỡ luôn yêu cầu phải có
   bước thu hẹp.
5. Một lần xoá dừng ở một dòng và một lần xoá đi theo giá trị là hai kích thước của cùng một hành vi,
   và cái đi theo thì đắt hơn.
6. Một thứ một cách viết. Ở đâu hai cách viết cùng nghĩa, module chọn lấy một, và không để lại gì cho
   tâm trạng của ngày hôm đó.
7. Miễn trừ cho test là một đường dẫn, quyết một lần, không phải một phán đoán đem cãi lại ở từng call
   site.
8. Một lý do không viết nổi thành một mệnh đề là một cast đang giấu điều gì đó, chứ không phải đang bắc
   cầu qua điều gì đó.
9. Mỗi rule ngoại lai mà module này giao một mã cho đều được nêu tên. Một mã không giao cho ai là một mã
   không ai giữ, và module này nói thẳng ra thay vì ngụ ý rằng nó đã được phủ.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **File test.** `TYPE-SAFETY-1` không áp dụng cho file `.test.` hoặc `.spec.`. Đó là `TYPE-SAFETY-4`,
  và nó hẹp vì nó là một đường dẫn: chứng minh một API đóng kiểu từ chối đầu vào sai thì phải dựng ra
  đầu vào sai, mà không có cách nào dựng một giá trị kiểu cấm ngoài việc bảo trình biên dịch quên kiểu
  đi.
- **Ngoài `/src/`.** Tooling, config build và script nằm ngoài phạm vi `TYPE-SAFETY-1`. Luật này canh
  chương trình, không canh cỗ máy lắp ra chương trình.
- **Biên thật, có lý do thật.** `TYPE-SAFETY-5` chấp nhận cast sống sót: một kiểu vendor sai, một giá
  trị mà runtime bảo đảm còn trình biên dịch thì không. Những thứ đó có thật. Thứ tách chúng khỏi phần
  còn lại là lý do viết ra được thành một mệnh đề.
- **Cast đi vào `unknown`.** Một cast một tầng *sang* `unknown` không phải là xoá kiểu theo nghĩa của
  `TYPE-SAFETY-1`. Nó chuyển giá trị từ một kiểu trình biên dịch đáng ra không nên tin sang một kiểu
  không dùng được nếu chưa kiểm — chiều ngược lại, và là chiều module này muốn.
- **Implementation của overload.** `TYPE-SAFETY-5` chấp nhận cast từ implementation signature sang chính
  tập overload của nó, vì tập overload mới là bề mặt được kiểm, còn implementation cố ý rộng hơn bất kỳ
  overload đơn lẻ nào.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra là một block.

```text
file: <path under the source tree>
governed: <yes | no — test file | no — outside /src/>
situation: <TYPE-SAFETY-1 … TYPE-SAFETY-5>
erasure: <double cast | any | single cast | none>
verdict: <refused | permitted | permitted with reason>
holder: <no-double-cast | foreign rule name | reader>
reason: <what the compiler knew, and why it may or may not forget it>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một bề mặt phiên làm việc tự làm mới từ một token mà trình duyệt vốn đang giữ, đọc
về một snapshot repository từ dịch vụ sandbox, phơi props của nó qua một factory có overload, và được
canh bởi một test chứng minh transport link từ chối một operation dị dạng.

Shape nói rằng những giá trị ấy đi tới và chúng được tiêu thụ ở đâu. Nó **không** nói claim của token
chứa gì, field của snapshot tên gì, hay có thứ gì kiểm chúng ở runtime hay không — nên nó không giải
quyết những điều đó. Nội dung của kiểu thuộc về module contract và props; việc kiểm ở runtime không
thuộc về gì trong module này. Thứ shape thật sự giải quyết là khoảnh khắc mỗi file được phép bảo trình
biên dịch thôi nhìn.

```text
file: src/hooks/auth/useSessionRefresh.ts
governed: yes
situation: TYPE-SAFETY-5
erasure: single cast
verdict: permitted with reason
holder: reader
reason: the cast target is `{ exp?: unknown }` and the value is narrowed with `typeof` afterwards — it is a single-step cast that opens just enough room to check, not a route through `unknown`, which is the fact that excludes TYPE-SAFETY-1
```

```text
file: src/modules/code/sandbox-repo.ts
governed: yes
situation: TYPE-SAFETY-2
erasure: none
verdict: permitted
holder: foreign rule name — @typescript-eslint/no-explicit-any
reason: the snapshot enters as `parseSandboxRepoSnapshot(raw: unknown)` and a local `isRecord` predicate narrows it in the file that needs it — the erasure would have travelled with the value into every consumer, which is the radius that makes this TYPE-SAFETY-2 and not TYPE-SAFETY-1
```

```text
file: src/components/contracts/props.ts
governed: yes
situation: TYPE-SAFETY-3
erasure: none
verdict: permitted
holder: foreign rule name — @typescript-eslint/array-type
reason: the array types are spelled `ReadonlyArray<DataValue>` and `Array<never>`, whose element types are themselves generic or exotic — nothing is erased here at all, which is the fact that excludes every other code in this module
```

```text
file: src/modules/api/graphql/clients/links/bearer.test.ts
governed: no — test file
situation: TYPE-SAFETY-4
erasure: double cast
verdict: permitted
holder: reader
reason: the fake transport operation is assembled from the three methods the link touches and the malformed operation is exactly what the file proves is refused — the path ends in `.test.ts`, which is the fact that excludes TYPE-SAFETY-1
```

```text
file: src/app/sitemap.ts
governed: yes
situation: TYPE-SAFETY-1
erasure: double cast
verdict: refused
holder: no-double-cast
reason: the response body crossed into the program from the network and the compiler knew only that it was unvalidated — a route through `unknown` erases that at the one seam worth checking, and no reason clause converts erasure back into checking, which is the fact that excludes TYPE-SAFETY-5
```

## Phạm vi

Luật này đúng cho mọi đoạn code cùng loại trong stack này: bất kỳ file front-end nào tắt việc kiểm kiểu
bên trong một cây source. Nó không gọi tên một feature riêng lẻ nào, không gọi tên sản phẩm và không gọi
tên thương hiệu thư viện. Điểm neo trích đường dẫn thật vì một module pattern nợ người đọc một chỗ để
kiểm; mọi ví dụ đã giải đều là TSX hoặc TS thông thường trên các module giữ chỗ.

Nó không canh việc một kiểu nên chứa gì — chuyện đó thuộc về module contract và props — và nó không canh
việc kiểm ở runtime. Nó chỉ canh đúng khoảnh khắc trình biên dịch bị bảo thôi nhìn.
