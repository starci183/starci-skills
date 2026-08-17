---
title: Translation · Vietnamese
---

# Bản dịch

Đầu vào là một shape đã được duyệt — một layout, một block, một capability hay một contract mà mọi câu
hỏi thiết kế đã đóng lại rồi. Module này không mở lại bất kỳ câu hỏi nào trong số đó. Nó nhận shape đã
duyệt ấy và nói chữ của shape nằm ở đâu trong source: file nào resolve từng chuỗi, tier nào được phép
giữ chuỗi, thứ gì được vượt biên, thứ gì đi trong `props`, và chuỗi nào thật ra không phải copy. Đầu ra
là kiến trúc source, không phải một ý kiến thiết kế.

## Luật

Chữ là **dữ liệu**. Nó đến từ một cuốn từ điển, nó đổi mà không cần deploy, và nó khác nhau tuỳ người
đọc. Vì vậy nó được **nửa sở hữu request** quyết định xong rồi mới truyền xuống — y hệt mọi dữ liệu
khác trong hệ thống này.

Hệ quả duy nhất cần nói thẳng, vì đây là chỗ người ta hay với tay qua: **không component nào nằm dưới
block được tự nói một chữ nào của riêng nó.** Leaf chỉ render chuỗi nó được đưa. Composite chỉ sắp xếp
những chuỗi nó được đưa. Cả hai đều không biết mình đang ở ngôn ngữ nào, và vì thế không thể bị bản
dịch về muộn làm cho sai.

Câu hỏi phân định mọi trường hợp: **một người đọc ở ngôn ngữ khác có nhìn thấy thứ khác ở đây không?**
Nếu có — đó là copy, và copy được resolve ở một file phía trên.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi chuỗi người đọc nhìn thấy hoặc nghe thấy đều rơi
vào đúng một mã dưới đây, kể cả những chuỗi không trông giống câu. Một chữ `alt` duy nhất vẫn là
`COPY-2`, đúng cùng lý do mà cả một đoạn văn là `COPY-2`. Câu "có mỗi một chữ thôi mà" là chỗ luật này
bị bỏ qua nhiều nhất.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `COPY-<n>`. Mã gọi tên TÌNH HUỐNG. Hai trong sáu mã
mô tả những chuỗi **không phải** copy chút nào, và chúng mang mã đúng cùng lý do với bốn mã kia: một
trường hợp không ai trích dẫn được là một trường hợp không ai chứng minh được là đã làm sai.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `COPY-1` | Nửa connected sở hữu request chọn câu đúng cho tình huống nó vừa settle | Nửa connected sở hữu request resolve mọi chữ mô tả câu trả lời của nó; không chữ nào được chọn dưới nửa đó, vì chỉ chủ sở hữu request mới biết câu nào là câu đúng |
| `COPY-2` | Một tier dưới block đang ôm một literal người đọc thấy hoặc nghe | Component dưới block chỉ render những chuỗi được đưa xuống; không giữ literal nào người đọc thấy hoặc nghe — trong nội dung, `aria-label`, `placeholder`, `title` hay `alt` |
| `COPY-3` | Có ý định truyền `labelKey` xuống cho con tự tra | Chuỗi đã resolve thì vượt biên; KEY từ điển thì không bao giờ |
| `COPY-4` | Một chữ đã resolve rồi thì phải đi đường nào xuống | Chữ đã resolve đi trong `props` như mọi value khác; không đến bằng context, ambient runtime hay module import |
| `COPY-5` | File trong thư mục locale bị đem ra soi luật "source viết bằng tiếng Anh" | File trong thư mục locale là nội dung, nên luật viết-bằng-tiếng-Anh không với tới nó — miễn theo ĐƯỜNG DẪN, không xét từng file |
| `COPY-6` | Một chuỗi mà CHƯƠNG TRÌNH so khớp, không phải để người đọc đọc | Giá trị chương trình SO KHỚP thì giữ nguyên văn, đánh dấu lý do ngay trên dòng đó; không dịch, không để trống dấu |

`COPY-5` VÀ `COPY-6` KHÔNG PHẢI NGOẠI LỆ CỦA LUẬT, CHÚNG LÀ MỘT PHẦN CỦA LUẬT. Một mục từ điển và một
trạng thái bị so khớp đều là chuỗi người đọc có thể nhìn thấy, và cả hai sẽ bị xử lý sai bởi một luật
chỉ biết "dịch hết đi". Chính việc gọi tên chúng thành mã mới giữ được bốn mã còn lại đủ hẹp để tuyệt
đối.

Đánh số không có lỗ hổng và sẽ không có thêm. Sáu mã này được trích dẫn từ các file luật khác và từ các
task record; đổi số một mã ở đây là âm thầm làm hỏng một trích dẫn ai đó đã viết.

## Đọc một shape đã duyệt

1. **Đọc những gì shape nói ra.** Nó nói surface, các tier dựng nên nó, nửa nào sở hữu request, và màn
   hình phải hiện những state nào của câu trả lời. Coi những điều đó là đã chốt.
2. **Gọi tên những gì shape không nói, và vì thế không giải quyết.** Shape không nói chữ được chọn ở
   đâu, một prop mang key hay mang chuỗi đã resolve, hay một literal nào đó có phải copy hay không. Đó
   đúng là những câu hỏi các mã dưới đây trả lời; một shape "trông hiển nhiên" vẫn không giải quyết gì
   ở đây cả.
3. **Giải từ ngoài vào trong.** Bắt đầu ở nửa connected sở hữu request rồi đi vào. Chủ sở hữu request
   quyết định câu nào đúng; mọi tier dưới nó chỉ nhận. Quyết một file bên trong trước sẽ khiến bạn bịa
   ra một chủ sở hữu mà shape chưa hề nêu.
4. **Hỏi lần lượt câu hỏi của từng mã** trên từng chuỗi:
   - `COPY-1` — ai là người biết tình huống này là tình huống nào? Chữ phải được chọn ở đúng chỗ đó.
   - `COPY-2` — người đọc ở ngôn ngữ khác có thấy đúng chuỗi này không, screen reader có đọc nó lên
     không?
   - `COPY-3` — con có phải tra thêm một bước nữa mới ra chữ không?
   - `COPY-4` — nếu xoá sạch từ điển khỏi dự án, component này còn render được không?
   - `COPY-5` — file này là tác quyền hay là nội dung?
   - `COPY-6` — có đoạn code nào `===`, `switch` hay lấy làm key của map trên đúng chuỗi này không?
5. **Khi hai mã cùng khớp**, hãy tách chuỗi thay vì chọn một mã thắng. Một giá trị vừa bị so khớp vừa
   được hiển thị là hai thứ: giá trị để so, và chữ để hiện. Còn khi hai mã mô tả hai lỗi khác nhau trên
   cùng một file thì cả hai đều đúng — một leaf gọi hook dịch vi phạm `COPY-1`, một leaf viết thẳng
   `"Tìm khoá học"` vi phạm `COPY-2`, và một file có thể phạm cả hai. Cách sửa khác nhau, nên hai mã
   không gộp.

## `COPY-1` — nửa connected chọn từng chữ

**Tình huống.** Block sở hữu request cũng sở hữu những chữ mô tả câu trả lời của request đó. Lý do
không phải là thói quen chia file: chỉ nửa đó mới biết người đọc đang ở tình huống nào — đang tải,
rỗng, lỗi, hay đã có số liệu — nên chỉ nó mới biết **câu nào là câu đúng**.

**Nó sinh ra gì trong source.** Hook dịch nằm trong entrypoint connected, ngay cạnh hook gọi dữ liệu.
Nửa drawing chỉ nhận vào những giá trị `string` đã xong — không id, không điều kiện.

**Dấu hiệu nhận biết.** File đang gọi một hook resolve chữ nằm cùng chỗ với hook gọi dữ liệu. Câu chữ
đổi theo state: pending nói một kiểu, settled nói kiểu khác. Nửa còn lại nhận vào toàn `string` đã
xong.

**Ranh giới.** Không phải `COPY-2`: `COPY-1` nói **chỗ chữ được chọn**, còn `COPY-2` nói **chỗ chữ
không được phép có mặt** — một leaf gọi hook dịch vi phạm `COPY-1`, một leaf viết thẳng
`"Tìm khoá học"` vi phạm `COPY-2`; hai lỗi khác nhau, hai cách sửa khác nhau. Cũng không phải `COPY-3`:
nếu nửa connected chọn **key** rồi đưa key xuống thì nó chưa quyết định gì cả — đó là `COPY-3`, không
phải đã tuân thủ `COPY-1`.

**Tình huống nghiệp vụ hay gặp.** Hạn mức còn lại trong tuần · trạng thái đơn hàng · số ngày streak ·
thông báo lỗi thanh toán · nhãn của một tab phụ thuộc quyền · câu tóm tắt kết quả bài kiểm tra.

## `COPY-2` — dưới block thì không giữ chữ nào người đọc thấy

**Tình huống.** Một leaf, composite, branch hay shell đang chứa literal mà người đọc nhìn thấy hoặc
**nghe thấy**. Không chỉ trong nội dung: `aria-label`, `placeholder`, `title`, `alt` là bốn chỗ copy
trốn nhiều nhất, vì khi lướt file thì cả bốn đều **không trông giống một câu**.

`aria-label` không phải trường hợp nhỏ. Screen reader hiểu đó là **văn bản chính**, nên một nhãn tiếng
Anh nằm trên một màn hình tiếng Việt là lỗi to nhất trang, rơi đúng vào người ít có cách xoay xở nhất.

**Nó sinh ra gì trong source.** File dưới `leaves/`, `composites/`, `branches/` và `shells/` không mang
prose trong nội dung, `aria-label`, `placeholder`, `title` hay `alt`. Mọi chuỗi như vậy được nhấc lên
nửa connected và đi xuống dưới dạng một value.

**Dấu hiệu nhận biết.** Chuỗi có dấu cách và bắt đầu bằng chữ hoa — trông như một câu người ta nói ra.
File nằm dưới `leaves/`, `composites/` hoặc `branches/`. Xoá chuỗi đi thì component vẫn dựng được, chỉ
là không còn chữ.

**Ranh giới.** Không phải `COPY-1` — xem trên. Không phải `COPY-6`: một chuỗi mà **chương trình** so
khớp thì không phải copy, kể cả khi nó lọt vào tier này; phân định bằng câu hỏi có đoạn code nào **so
sánh** với chuỗi này không. Và token không phải copy: `"search"` trong `name="search"` là tên icon,
không có dấu cách, không ai đọc nó lên.

**Tình huống nghiệp vụ hay gặp.** Placeholder ô tìm kiếm · `aria-label` nút đóng modal · `alt` của ảnh
khoá học · `title` của nút icon-only · chữ "Không có dữ liệu" trong empty state của một composite ·
nhãn "Xem thêm" trong branch phân trang.

## `COPY-3` — key không được vượt biên

**Tình huống.** Có người định truyền `labelKey="quest.title"` xuống, coi như thế là đã "tách i18n ra
ngoài". Không phải: nó **dời chỗ tra cứu**, chứ không dời **quyết định**. Con vẫn phải tra, nên con vẫn
cần toàn bộ runtime dịch mới render được — và như vậy nó không còn dựng được từ một fixture.

**Nó sinh ra gì trong source.** Prop mang chữ trong nửa drawing được khai kiểu bằng chính giá trị đã
resolve (`label: string`). Không prop nào mang một đường dẫn từ điển vượt biên, và con không import bất
kỳ hàm tra từ điển nào.

**Dấu hiệu nhận biết.** Prop có tên kết thúc bằng `Key`, `I18nKey`, `MessageId`, và giá trị của nó là
một đường dẫn có dấu chấm. Con phải import hàm tra từ điển để hiển thị được prop mình nhận. Test của
con phải mount provider ngôn ngữ mới chạy.

**Ranh giới.** Không phải `COPY-4`: `COPY-4` nói chữ **đã resolve** đi trong `props`, còn `COPY-3` cấm
thứ **chưa resolve** đi cùng đường đó — cùng một đường ống, hai loại hàng khác nhau. Và **không phải
mọi prop tên `*Key` đều vi phạm**: `selectedKey` của một tab hay một hàng danh sách là **định danh**,
không phải mục từ điển, vì không có gì phải tra để render nó. Phân định bằng việc hỏi key đó tra vào
đâu — vào từ điển, hay vào chính danh sách đang render.

**Tình huống nghiệp vụ hay gặp.** `labelKey` cho nút · `emptyMessageId` cho danh sách rỗng · `errorKey`
cho form · một mảng `{ id, labelKey }` cho menu — mảng là chỗ key hay đi lậu nhất, vì nó trông như dữ
liệu.

## `COPY-4` — chữ đã resolve là một value, nên theo đúng hàng rào dữ liệu

**Tình huống.** Sau khi nửa connected chọn xong, chuỗi đó **không còn là chuyện ngôn ngữ nữa**. Nó là
một value như số dư hay tên file, và nó đi đúng con đường mọi value khác đi: `props`.

Đây là mã đổi lấy một thứ cụ thể chứ không phải một nguyên tắc thẩm mỹ: nhờ nó, một component render
được từ fixture với chữ `"anything"` và vẫn đúng. Cái test không cần từ điển chính là bằng chứng chữ đã
đến bằng đường value.

**Nó sinh ra gì trong source.** Test của nửa drawing dựng component từ những chuỗi fixture trần, không
mount provider dịch nào. Không chữ nào đến với component bằng context, ambient runtime hay module
import.

**Dấu hiệu nhận biết.** Kiểu của prop là `string`, không phải union của key. Test dựng component bằng
chuỗi bịa, không mount provider nào. Đổi từ điển không làm test đổi.

**Ranh giới.** Không phải `COPY-3` — xem trên. Không phải `COPY-1`: `COPY-1` nói ai chọn, còn `COPY-4`
nói chữ đi đường nào sau khi đã chọn. Một chữ resolve đúng chỗ nhưng chui xuống bằng context toàn cục
thì vi phạm `COPY-4` chứ không vi phạm `COPY-1`.

**Tình huống nghiệp vụ hay gặp.** Nhãn và giá trị của một stat row · tiêu đề empty state · nội dung
toast sau khi submit · nhãn cột của bảng · chuỗi đã format sẵn số và đơn vị.

## `COPY-5` — từ điển chính là ngôn ngữ kia, nên nó không phải source

**Tình huống.** Luật "source viết bằng tiếng Anh" tồn tại để một người vào dự án sau một năm vẫn đọc
được mọi dòng. Từ điển thì ngược lại: **nội dung của nó buộc phải là ngôn ngữ kia**. Đem luật đó soi
vào thư mục locale là đọc sai cả hai luật.

**Nó sinh ra gì trong source.** File locale được miễn theo một danh sách ĐƯỜNG DẪN —
`src/messages/<locale>.json` và danh sách `CONTENT_PATHS` — nên không file nào phải tự biện hộ cho
mình. Fixture và spec cũng được miễn đúng cách đó, theo đường dẫn.

**Dấu hiệu nhận biết.** File nằm trong thư mục locale, đuôi `.json`, mỗi khoá là một câu. Không có
logic nào trong file — chỉ có chữ.

**Ranh giới.** Miễn trừ này là một **đường dẫn**, không phải một phán đoán: đó là quyết định đắt nhất
của mã này, vì một miễn trừ dựa trên phán đoán sẽ bị đem ra cãi ở từng file, mãi mãi. Không phải
`COPY-6`: từ điển được miễn vì nó **là nội dung**, còn chuỗi matched được giữ vì **chương trình so khớp
nó** — hai lý do khác hẳn nhau, đừng gộp.

**Tình huống nghiệp vụ hay gặp.** File từ điển từng ngôn ngữ · fixture dựng lại nguyên văn payload của
server · snapshot test bảo toàn chữ hiển thị.

## `COPY-6` — chữ mà CHƯƠNG TRÌNH so khớp thì không phải copy

**Tình huống.** Server gửi xuống một trạng thái, và màn hình **so sánh** với chuỗi đó để quyết định
render nhánh nào. Dịch nó là làm hỏng phép so sánh — và cái hỏng đó **im lặng**: không có lỗi
TypeScript, không có exception, chỉ có một nhánh không bao giờ chạy nữa.

Nên chuỗi đó ở nguyên, và **được đánh dấu ngay trên dòng của nó cùng lý do**. Dấu đó không phải thủ
tục: nó là thứ nói cho người đọc sau biết đây là một **quyết định**, chứ không phải một chỗ ai đó quên
dịch.

**Nó sinh ra gì trong source.** Literal được giữ nguyên văn và mang `// vn-ok: <reason>` trên dòng của
nó. Khi một giá trị vừa bị so khớp vừa được hiển thị, source giữ hai thứ: giá trị để so, và chữ để
hiện.

**Dấu hiệu nhận biết.** Có một phép `===`, một `switch`, hoặc một key của map, so vào đúng chuỗi này.
Chuỗi đến từ ngoài hệ thống: server, webhook, cổng thanh toán, một enum của bên thứ ba. Đổi chuỗi này
phải đổi cả phía kia mới đúng.

**Ranh giới.** Không phải `COPY-2`: cùng là một literal nằm trong source, nhưng `COPY-2` nói về chuỗi
**người đọc** đọc, còn `COPY-6` nói về chuỗi **chương trình** đọc. Không phải `COPY-5` — xem trên. Và
dấu **không** biến một chuỗi copy thành value: đánh dấu một câu chỉ để nó lọt qua cổng ngôn ngữ là dùng
sai mã này, và không có gì trong hệ thống phát hiện được.

**Tình huống nghiệp vụ hay gặp.** Trạng thái đơn hàng server gửi verbatim · mã lỗi của cổng thanh toán ·
tên phương thức thanh toán dùng làm khoá map · giá trị enum trong query string · tên sự kiện analytics.

## Tầng giữ

Tier nào thật sự giữ từng mã — một kiểu đóng, một luật lint, hay chỉ một người đọc. Những dòng
`enforced` được hiện thực bởi `sources/fe/translation.mjs`.

| Mã | Tier | Ai giữ |
|---|---|---|
| `COPY-1` | `enforced` | `starci-fe/no-copy-resolution-below-block` |
| `COPY-2` | `enforced` | `starci-fe/no-hardcoded-copy-in-vocabulary` |
| `COPY-3` | `documented` | không có gì máy móc |
| `COPY-4` | `documented` | không có gì máy móc |
| `COPY-5` | `documented` | không có gì trong module này |
| `COPY-6` | `documented` | không có gì trong module này |

Bốn trên sáu dòng ghi `documented`, và bảng này tồn tại để nói thẳng điều đó ra, thay vì để hai dòng
`enforced` khiến người ta tưởng cả module đã được giữ.

Hai trong bốn dòng đó có hỗ trợ máy móc, nhưng hỗ trợ ấy thuộc về một luật LÁNG GIỀNG nên không được
tính ở đây: `starci-fe/no-second-language-in-source`, do `.claude/sources/fe/comments.mjs` công bố,
miễn các từ điển locale theo đường dẫn (`COPY-5`) và đọc pragma `vn-ok:` trên dòng được đánh dấu
(`COPY-6`). Tính luật của láng giềng thành enforcement của module này sẽ làm module trông như được giữ
ở chỗ nó không được giữ: luật đó bắn theo NGÔN NGỮ, nên nó không bao giờ thấy một key tiếng Anh đang
vượt biên, và nó không phân biệt được một matched-value đã đánh dấu với một câu copy đã đánh dấu.

`COPY-1` còn được với tới bởi `starci-fe/presentational-purity` của luật split, luật này từ chối đúng
lời gọi đó trong một file tên `component.tsx`. Hai luật phủ một mã từ hai góc là dư thừa, không phải
một tier thứ hai: luật split chặn theo tên file, còn luật của module này chặn theo thư mục tier, và một
leaf không phải nửa split thì chỉ luật thứ hai nhìn thấy.

## Điểm neo

Một luật không chỉ được vào code thật thì chỉ là một đề xuất. Đường dẫn là đường dẫn source tương đối
với repository; chính hình dạng của cây, chứ không phải tên sản phẩm nào, mới làm chúng kiểm được.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `COPY-1` | `src/components/blocks/**/index.tsx` cạnh file `component.tsx` sinh đôi | Hook dịch xuất hiện trong entrypoint connected và không xuất hiện trong file sinh đôi nào. Một cây tuân thủ sẽ có số đếm dương ở glob thứ nhất và bằng không ở glob thứ hai |
| `COPY-2` | `src/components/{leaves,composites,branches,shells}/**` | Không `aria-label`, `placeholder`, `title` hay `alt` nào mang prose, và không đoạn text JSX nào đọc lên như một câu |
| `COPY-3` | kiểu của props trong `src/components/blocks/**/component.tsx` | Prop mang chữ được khai kiểu bằng chính giá trị đã resolve (`label: string`). Mọi prop `*Key` đều gọi tên một hàng đang được chọn, không bao giờ là một mục từ điển |
| `COPY-4` | `src/components/blocks/**/component.test.tsx` | File sinh đôi render từ những chuỗi fixture trần, không mount provider dịch nào — test chạy qua chính là bằng chứng chữ đã đến bằng đường value |
| `COPY-5` | `src/messages/<locale>.json`, và `CONTENT_PATHS` trong `.claude/sources/fe/comments.mjs` | Miễn trừ là một danh sách đường dẫn, nên không file nào tự biện hộ cho mình |
| `COPY-6` | `chưa neo được` | Có tồn tại những dòng đánh dấu `// vn-ok: <reason>`, nhưng các literal được đánh dấu tìm thấy lại là copy chứ không phải giá trị chương trình so khớp. Chính tình huống của mã này thì chưa có điểm neo |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| surface | File và tier nó nằm trong: nửa connected, nửa drawing, hay một tier dưới block |
| ownership | Nửa nào sở hữu request mà những chữ kia mô tả câu trả lời của nó |
| carrier | Chuỗi nằm ở đâu: text JSX, một thuộc tính người đọc nghe được, một prop, hay một hằng module |
| role | Copy, nội dung từ điển, hay một giá trị chương trình đem ra so sánh |
| situation | Câu chữ đúng với state nào của câu trả lời |

## Quy tắc

1. Nửa sở hữu request sở hữu từng chữ.
2. Component dưới block không giữ literal nào người đọc thấy hoặc nghe — kể cả trong `aria-label`,
   `placeholder`, `title`, `alt`.
3. Chuỗi đã resolve thì vượt biên; key thì không.
4. Chuỗi đã resolve là value, đi trong `props`.
5. Nửa drawing phải render đúng từ một fixture khi không có từ điển nào trong dự án.
6. Thư mục locale là nội dung, khớp theo đường dẫn chứ không theo phán đoán.
7. Chuỗi chương trình so khớp thì không dịch, và mang lý do trên chính dòng của nó.
8. Mọi chuỗi người đọc thấy đều rơi vào đúng một mã. Không chuỗi nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
dụng vào.

- **Nội dung locale (`COPY-5`).** File trong thư mục locale là ngôn ngữ kia. Luật viết-bằng-tiếng-Anh
  không với tới chúng. Miễn theo ĐƯỜNG DẪN, vì một miễn trừ dựa trên phán đoán sẽ bị cãi ở từng file,
  mãi mãi.
- **Fixture và spec (`COPY-2`, `COPY-4`).** Một fixture tái hiện chuỗi thật thì phải tái hiện đúng
  nguyên văn; dịch đi là đang test một thứ khác. Cũng miễn theo đường dẫn.
- **Giá trị matched (`COPY-6`).** Một trạng thái server gửi xuống và màn hình đem ra so sánh thì giữ
  nguyên, đánh dấu lý do trên dòng của nó. Dấu ấy là thứ nói cho người đọc sau biết đây là một quyết
  định, chứ không phải chỗ ai đó quên.
- **Key không phải key từ điển (`COPY-3`).** Một prop gọi tên tab, hàng hay lựa chọn đang được chọn là
  định danh, không phải một lượt tra. Nó vượt biên tự do, vì không phải resolve gì để render nó.
- **Token không phải chữ (`COPY-2`).** Tên icon, tên variant, tên recipe là định danh nội bộ: không dấu
  cách, không ai đọc lên, không đổi theo ngôn ngữ.

## Đầu ra

Mỗi chuỗi mà shape đã duyệt sinh ra thì một khối.

```text
surface: <file, and the tier it sits in>
code: <COPY-1 | COPY-2 | COPY-3 | COPY-4 | COPY-5 | COPY-6>
string: <the word in question>
role: <copy | dictionary content | matched value>
resolved-in: <the connected half that owns the request | the dictionary | not resolved>
reason: <the fact that excludes the adjacent code>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một panel hạn mức tuần được duyệt thành một block gồm entrypoint connected và một
file drawing sinh đôi: nó hiện một tiêu đề, phần hạn mức còn lại, một dòng empty khi chưa dùng gì, và
một nút đóng chỉ có icon; trạng thái reset hạn mức về từ server dưới dạng một status mà màn hình rẽ
nhánh theo.

Những gì shape không nói, và vì thế không giải quyết: từng chữ được chọn ở đâu, file sinh đôi nhận một
key hay một câu đã xong, tên khả truy cập của nút đóng có phải copy hay không, và status của server là
copy hay là value. Những điều đó được giải ở đây, từ ngoài vào trong.

```text
surface: src/components/blocks/weekly-quota/index.tsx, connected half
code: COPY-1
string: "3 of 10 lessons left this week"
role: copy
resolved-in: the connected half that owns the request
reason: the sentence differs by state — pending, empty and settled are three different sentences — and only the owner of the request knows which state it is in, which is why this is not COPY-4: COPY-4 governs the road the word takes after it is already chosen
```

```text
surface: src/components/blocks/weekly-quota/component.tsx, drawing half
code: COPY-4
string: "3 of 10 lessons left this week"
role: copy
resolved-in: the connected half that owns the request
reason: the prop is typed `string` and the twin's test renders it from a fixture with no translation provider mounted, which is why this is not COPY-3: nothing here has to be looked up before it renders
```

```text
surface: src/components/leaves/icon-button/index.tsx, tier below a block
code: COPY-2
string: "Close"
role: copy
resolved-in: not resolved
reason: a screen reader speaks the `aria-label` as primary text, so a reader in another language hears this exact string — which is why it is not the icon token "close" in name="close", which has no spaces and is never spoken
```

```text
surface: src/components/blocks/weekly-quota/index.tsx, connected half
code: COPY-6
string: "quota_exhausted"
role: matched value
resolved-in: not resolved
reason: a `switch` in this file compares against this exact string, so translating it would silently kill a branch — which is why it is not COPY-2: the program reads it, not the reader, and the display sentence is a separate string
```

```text
surface: src/messages/vi.json, locale content
code: COPY-5
string: "Còn 3 trên 10 bài trong tuần này"
role: dictionary content
resolved-in: the dictionary
reason: the file is exempt by PATH, as content rather than authorship — which is why it is not COPY-6: it is preserved because it IS the other language, not because the program compares it
```

## Phạm vi

Module này phát biểu một luật đúng với bất kỳ front end nào phục vụ nhiều hơn một ngôn ngữ. Nó không
gọi tên sản phẩm nào, thư viện component nào hay repository nào. Mọi ví dụ đều là TSX thông thường.

MỘT IDENTIFIER ĐƯỢC SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một luật được trích dẫn bằng đúng
tên công bố của nó, kèm cả tiền tố plugin, vì đó chính là chuỗi mà build log in ra và comment disable
mang theo. Một trích dẫn không dán được vào ô tìm kiếm thì không phải trích dẫn. Điều lệnh cấm ở trên
cấm là PROSE và VÍ DỤ cần đến một sản phẩm mới hiểu được — không bao giờ là một identifier mà ai đó sẽ
đọc thấy trong một lần fail và phải đi tra.
