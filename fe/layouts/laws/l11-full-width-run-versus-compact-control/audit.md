---
id: fe-layouts-laws-l11-full-width-run-versus-compact-control-audit
title: audit.md
slug: /fe/layouts/laws/l11-full-width-run-versus-compact-control/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L11: chỗ tiêu chí phân định được, cách đọc ngược mà mô-đun này dễ gây ra nhất, ba mô-đun đang cùng nhận một tiêu chí, và khoản nợ gate chưa có trường nào.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l11-full-width-run-versus-compact-control`

Phản biện này kiểm xem hai câu hỏi của luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ
đó, mà không lén chọn hộ một hình dạng ở chỗ thầy chưa phán.

## Kết luận

Chấp nhận, với bốn khoản phải ghi ngay: một cách đọc ngược mà chính mô-đun này dễ gây ra, một tiêu chí
đang có ba mô-đun cùng nhận, một chỗ trong cây sống tự mâu thuẫn với chính nó và bị tiêu chí xử thành
vi phạm, và một khoản nợ gate không có trường nào để trả.

**Cách đọc ngược phải nói trước mọi thứ khác.** Ai đọc mô-đun này rồi rút ra rằng cái nút chọn năm
phải chạy hết chiều ngang là đã đọc sai hoàn toàn. Vòng một được dẫn ra ở đây vì nó là lý do tiêu chí
tồn tại, không phải vì nó là kết quả. Kết quả đang chạy trong repo sống là vòng hai, và nó gọn. Bản
ghi phân loại phản hồi vòng hai là `correction-of-prior-interpretation` tại
`.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:207`, tức là sửa cách hiểu,
và giữ vòng một lại làm lịch sử từ chối tại `:235`.

Nói rõ thêm một tầng nữa, vì đây là mô-đun `criterion` chứ không phải `fixed`: canon không được phép
chốt một bên. Cả hai vòng phán quyết đều còn hiệu lực theo đúng nghĩa của chúng, nên thứ được giữ lại
là câu hỏi phân biệt được chúng chứ không phải một trong hai câu trả lời.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L11-1` so với `L11-2` | Loại trừ được bằng vế thứ nhất: cái nằm dưới còn là nó không, hay đã thành loại khác |
| `L11-1` so với `L11-4` | Loại trừ được bằng `regionParent`: vùng bị thay là vùng của trang hay một vùng bên trong trang |
| `L11-2` so với `L11-4` | Không cần loại trừ, hai mã ra cùng một hình dạng; chỉ khác lý do, và lý do phải ghi đúng |
| `L11-1` so với `L11-3` | Loại trừ được vì `w-full` của một hàng không phải `w-full` của điều khiển; hỏi lại từng điều khiển |
| `L11-5` so với mọi mã | Không phải một nhánh của phân loại; nó chạy **sau** khi đã phân loại xong |
| `L11-6` so với sự lưỡng lự | Chỉ mở khi cả hai cách đọc đều bảo vệ được bằng lý do sản phẩm |
| Thiếu bằng chứng về vùng bị thay | Rơi về `L11-6`, không rơi về "làm giống cái gần nhất" |
| Có lấn sang kệ khác không | Có một chỗ phải hoà giải, ghi ở mục ngay dưới |

Chỗ đáng ngờ nhất đã kiểm riêng: vị trí trong cây có tự nó quyết định được hình dạng không. Không.
`scope-switch-row` là anh em ngang hàng với bảng xếp hạng ở tầng cao nhất của hợp đồng trang, đúng vị
trí mà một hàng `L11-1` sẽ đứng, và nó vẫn gọn. Vế thứ nhất phải chạy trước, và vế thứ hai chỉ mở ra
khi vế thứ nhất đã trả lời là mặt.

Chỗ đáng ngờ thứ hai: `L11-4` có phải một cửa hậu để mọi điều khiển đều gọn không. Không, vì điều kiện
mở nó là `regionParent` không phải hợp đồng tầng cao nhất của trang, và trong repo sống có đúng ba chỗ
không thoả điều kiện ấy, cả ba đều chạy hết chiều ngang.

## Mâu thuẫn chéo

**Một tiêu chí đang có ba mô-đun cùng nhận, và hai mô-đun kia đều trỏ đi chỗ khác.**

| Mô-đun | Câu đang viết | Hệ quả |
|---|---|---|
| `L4` | Ngoại lệ: "A parameter control that the founder called primary. **Ruled both ways and settled at `L4-4`.** Primary hierarchy is about how a control is drawn; it does not promote a block's parameter into the page's content region." | `L4` tự nhận đã chốt tiêu chí bên trong nó |
| `L10` | Ngoại lệ: "Whether a segmented control runs the full line or holds an intrinsic measure at the edge of a heading row is a hierarchy decision, and the founder ruled it both ways. **That criterion lives in `l4`**" | `L10` trỏ tiêu chí sang `L4` |
| `L11` | Mô-đun này | Tiêu chí ở đây, và `L4` với `L10` chỉ đọc kết quả |

Ba chỗ ấy không sai về nội dung, chúng chỉ không biết mô-đun này tồn tại: cả `L4` lẫn `L10` được viết
khi bảng định tuyến của kệ còn ghi `L11` là **owed**. Cái phải sửa là hai câu ngoại lệ và một dòng
bảng, và cả ba đều nằm ngoài mô-đun này nên chỉ được ghi ra chứ không tự sửa ở đây. **Cả ba đã được
sửa ở vòng nghiệm thu kệ `1.01`:** `L4-4` nay nói rõ nó đọc tiêu chí hình dạng từ đây chứ không tự
chốt, `L10` trỏ tiêu chí sang đây thay vì sang `L4`, và hàng `L11` của bảng là một link.

Neo: `..\l4-tab-switches-panel-route-switches-page\INDEX.md` mục `Exceptions`,
`..\l10-region-width-belongs-to-its-owner\INDEX.md:112-115`, và `..\..\INDEX.md:106` cùng `:114-116`.

**Một neo lệch dòng trong `L4`.** `l4-tab-switches-panel-route-switches-page\changelog.md` dẫn câu
`WARNINGS` "Earlier session evidence called a full-width underline “primary”…" về dòng `:234` của hồ
sơ. Dòng `234` là dòng phân cách bảng; câu ấy nằm ở `:235`. Mô-đun này dùng `:235`, và ghi lệch ra đây
thay vì sửa file của mô-đun khác.

## Repo sống đang ở đâu

Mười bốn call site được đọc hết, ba của `ExtendedTabs` và mười một của `ChoiceTabs`. Bốn cái dùng cơ
chế hàng chạy hết chiều ngang và mười cái giữ chiều rộng intrinsic. Mười ba cái ra đúng kết quả khi
chạy hai câu hỏi của luật, một cái không.

| Điều khiển | Vế 1 | Vế 2 | Mã | Hình dạng đang chạy |
|---|---|---|---|---|
| Hàng tab thứ hai của navbar | mặt | vùng của trang | `L11-1` | đầy, đúng |
| Tab hồ sơ công khai | mặt | vùng của trang | `L11-1` | đầy, đúng |
| Bốn mục trang chi tiết khoá học | mặt | vùng của trang | `L11-1` | đầy, đúng |
| Bốn mặt của cột đọc trang bài luyện mã | mặt | vùng bên trong | `L11-4` | **đầy, sai** |
| Chọn năm của biểu đồ đóng góp | giá trị | không hỏi | `L11-2` | gọn, đúng |
| Phạm vi bảng xếp hạng tuần | giá trị | không hỏi | `L11-2` | gọn, đúng |
| Hạng mục bảng xếp hạng khoá học | giá trị | không hỏi | `L11-2` | gọn, đúng |
| Lưới hay dòng ở danh mục khoá học | giá trị | không hỏi | `L11-2` | gọn, đúng |
| Phạm vi luồng hoạt động | giá trị | không hỏi | `L11-2` trong hàng `L11-3` | gọn, đúng |
| Hạng mục luồng hoạt động | giá trị | không hỏi | `L11-2` trong hàng `L11-3` | gọn, đúng |
| Ba mặt nội dung của trang học | mặt | vùng bên trong | `L11-4` | gọn, đúng |
| Ngôn ngữ của trang học | giá trị | vùng bên trong | `L11-2` cùng ngoại lệ `L11-5` | gọn, đúng, sơn gạch chân |
| Mua hay dùng thử trong rail giá | mặt | vùng bên trong | `L11-4` | gọn, đúng |
| Cách trả tiền trong overlay thanh toán | mặt | vùng bên trong | `L11-4` | gọn, đúng |

Trục ngôn ngữ là chỗ duy nhất cố ý giữ lớp sơn gạch chân trên một điều khiển gọn, và nó là bằng chứng
sống cho việc lớp sơn không quyết định chiều rộng.

## Vi phạm còn sống

**Một chỗ trong pixel, và một chỗ trong câu giải thích.**

**Trong pixel.** `problem-reading-column` đặt một `ExtendedTabs` chạy hết chiều ngang lên trên bốn mặt
đề bài, gợi ý, lời giải và các lần nộp, trong khi chính hợp đồng ấy khai `md:w-2/5` và là một trong
hai cột của `coding-problem-page`. Vế thứ nhất trả lời là mặt, vế thứ hai trả lời là vùng bên trong,
nên tiêu chí phát ra `L11-4` và điều khiển phải gọn. Câu `why` của hợp đồng lại đang dùng đúng ngôn
ngữ của `L11-1`, rằng các tab đứng yên trong khi cái nằm dưới chúng đổi, và đó là lý do đúng cho một
hàng chạy hết chiều ngang nhưng chỉ khi vùng bị đổi là vùng của trang.

Chỗ này quan trọng hơn một lỗi lẻ, vì trang học có cùng hình dạng ấy và trả lời ngược lại. Hai màn
hình đặt một hàng chọn mặt lên trên phần thân của một cột, một bên dùng pill gọn với lý do ghi tại
chỗ, một bên dùng hàng gạch chân đầy với lý do cũng ghi tại chỗ. Cây sống đang tự mâu thuẫn ở đây, và
chưa có lời phán nào của thầy đứng riêng cho cặp ấy. Tiêu chí chọn bên gọn vì nó suy ra từ chính chữ
"the page's content region" trong lời bác `:242`, nhưng khả năng một phán quyết lật cả hai sang
`L11-1` là có thật và được ghi ở mục rủi ro.
Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2625-2631,2633-2643`,
`…\blocks\coding\ProblemReadingColumn\component.tsx:88-103`, `…\leaves\ExtendedTabs\index.tsx:37`.

**Trong câu giải thích.**
`D:\Repositories\starci-academy-fe\src\components\pages\CoursesCatalogPage\component.tsx:216-226`
khai `variant: "primary"` cho cặp lưới và dòng, tức là render đúng theo `L11-2`, nhưng comment bên
cạnh biện minh bằng câu rằng những tab này đổi cả panel chứ không lọc danh sách bên dưới chúng. Theo
tiêu chí thì đổi cả vùng nội dung của trang chính là vế chạy hết chiều ngang, còn lưới hay dòng là một
cách bày lại cùng một danh sách, tức là vế gọn. Lý do đang chống lại kết quả mà nó đứng cạnh.

Đây đúng là loại lỗi mà dòng `:241` của hồ sơ đã bác một lần dưới dạng tên và hình phải mô tả cùng một
sản phẩm. Chưa sửa, vì sửa mã trong repo sống nằm ngoài phạm vi của việc lập mô-đun.

**Một chỗ chưa đủ tư cách gọi là vi phạm.** Hợp đồng `dual-tabs-toolbar` có hai chủ.
`DualTabsToolbar` ép cả hai trục về `primary`, còn `ContentTabRow` dựng thẳng cùng hợp đồng ấy với
trục sau ở `secondary` kèm lý do ghi tại chỗ. Câu `why` của hợp đồng nói "Two independent primary-tab
axes", nên nó chỉ mô tả đúng một trong hai chủ. Cả hai render đều đúng theo tiêu chí, nên đây là một
câu `why` hẹp hơn thực tế chứ không phải một hình dạng sai.
Neo: `…\contracts\index.ts:1323-1329`, `…\composites\DualTabsToolbar\index.tsx:21-30`,
`…\blocks\dashboard\FeedExplorer\component.tsx:35-40`, `…\blocks\learn\ContentTabRow\component.tsx:103-110`.

## Nhận định

- **Tiêu chí có hai vế, và bỏ vế nào cũng sai ở một chỗ đo được.** Chỉ dùng vế thứ nhất thì ba mặt nội
  dung của trang học sẽ thành một hàng gạch chân mọc giữa một cột đọc đã bị kẹp giữa hai cột khác.
  Chỉ dùng vế thứ hai thì `scope-switch-row` sẽ bị kéo dài, mà nó vừa được sửa khỏi đúng hình dạng ấy
  và lý do còn nằm trong comment. Hai vế phải đi theo thứ tự, và thứ tự ấy là phần dễ mất nhất khi ai
  đó tóm tắt luật này thành một câu.
- **Cặp gần nhau nhất là ba mặt nội dung của trang học với bốn mặt của cột đọc trang bài luyện mã.**
  Hai màn hình đặt cùng một câu hỏi và trả lời ngược nhau, mỗi bên có lý do ghi tại chỗ, và không bên
  nào có một lời phán của thầy đứng sau. Đây là chỗ tiêu chí mỏng nhất, và cái mỏng ấy có thật trong
  cây chứ không phải do cách viết luật tạo ra.
- **Cặp gần nhì là bốn mục trang chi tiết khoá học với ba mặt nội dung của trang học.** Cả hai chọn
  giữa những loại nội dung khác nhau, và thứ tách chúng ra là chỗ đứng trong cây cùng việc một bên
  khai `host: "nav"` còn bên kia không.
- **Điểm mạnh nhất của bản này là vế thứ nhất kiểm được bằng cách gọi tên.** Hỏi cái gì còn lại sau
  khi bấm thì hoặc gọi được tên một thứ vẫn nguyên, hoặc không. Không có khoảng giữa để lách, và câu
  hỏi ấy không đòi ai đánh giá cái nút quan trọng đến đâu.
- **`L11-5` là mã duy nhất không thuộc phân loại và vẫn phải có mặt.** Cú lật của thầy có hai nửa,
  nửa hình dạng và nửa tên gọi, và hai dòng bác về tên gọi ở `:172` cùng `:241` sẽ mất chỗ nếu mô-đun
  chỉ nhận bốn dòng về hình dạng.
- **Cả sáu dòng bác đến từ một hồ sơ duy nhất.** Đó là con số nhỏ nhất trong các luật cùng kệ, và nó
  có nghĩa là tiêu chí này được thử trên đúng một màn hình. Chín điều khiển đang chạy thì khớp, nhưng
  khớp với một tiêu chí suy ra từ chúng không phải cùng một việc với việc tiêu chí đã sống qua một lần
  bị thử ở chỗ khác.

## Quyết định

- **Phát biểu luật thành một câu hỏi có thứ tự, không thành một giá trị.** Đây là hạng `criterion` và
  nó đứng cùng hạng với [`l5`](../l5-every-route-has-a-real-owner/INDEX.md), nơi `L5-5` cũng phát ra
  một câu hỏi. Mọi cách viết khác đều buộc canon chọn một bên trong hai lần thầy phán ngược nhau.
- **Tách vế thứ hai ra thành `L11-4` thay vì gộp vào `L11-1`.** Nếu không có mã riêng thì ba mặt nội
  dung của trang học, cặp mua hoặc dùng thử trong rail và cặp cách trả tiền trong overlay đều bị đọc
  thành trường hợp lệ của `L11-1`, và cả ba đang gọn trong repo sống.
- **Đặt `L11-3` để chuỗi `w-full` thôi làm bằng chứng.** Ba hợp đồng `L11-1` và hai hợp đồng `L11-3`
  đều mang `w-full`, nên đọc mảng `classes` mà không hỏi lại từng điều khiển sẽ ra kết quả ngược ở hai
  chỗ.
- **Không nhận chuyện URL vào mô-đun này.** Việc bấm vào thì địa chỉ có đổi hay không thuộc
  [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md), và hai dòng bác `:242` cùng `:291`
  được cả hai mô-đun cùng dùng cho hai kết luận khác nhau, điều đó hợp lệ vì mỗi mô-đun rút một câu
  khác ra từ cùng một lời phán.
- **Không đưa dòng `:83` vào bảng neo.** Nó là một hàng `REJECTED` thật, "Change year-selection
  behavior", nhưng nó nói về hành vi chọn năm chứ không nói về hình dạng hay tên gọi, nên nó không
  thuộc luật này.
- **Không đưa `:207`, `:213-215`, `:235` và `:50-51` vào cột neo từ chối.** Chúng lần lượt là dòng
  phân loại phản hồi, bảng `OUTPUTS`, một hàng `WARNINGS` và hai dòng đo, không phải hàng `REJECTED`
  có cột `Why`. Chúng đứng trong bảng `Anchor` với nhãn riêng.

## Rủi ro còn mở

- **Gate không có trường nào cho luật này.** `gate.schema.json` có `Region.widthOwner` ở `:290` và
  `Region.widthClass` ở `:295`, cả hai thuộc `L10` và nói về vùng. `Section` ở `:326-359` có
  `renderForm` cho archetype khối và không có gì cho một điều khiển. Nghĩa là một mã `L11` hôm nay chỉ
  được khẳng định bằng văn xuôi trong `reason.why` và không máy nào so được nó với mô-đun này. Sửa
  được bằng cách thêm một trường hình dạng điều khiển, nhưng đó là thay đổi GATE và phải làm ở schema
  trước theo Version Rule của kệ.
  Neo: `D:\Repositories\starci-academy-backend\.claude\fe\layouts\gate.schema.json:290,295,326-359`.
- **~~Bảng định tuyến của kệ vẫn ghi `L11` là owed.~~ Đã xong ở kệ `1.01`.** Ô "Owner module" nay là
  một link tới đây, Kind là **criterion — founder flipped** đúng như `L5`, và đoạn dưới bảng đã được
  viết lại. Người đọc đi từ gốc kệ tìm được mô-đun này.
- **Vế thứ nhất vẫn là một phán đoán của người.** "Cái nằm dưới còn là nó không" gọi tên được, nhưng
  không rule nào kiểm được câu trả lời có trung thực hay không. Một người muốn kéo dài một điều khiển
  chỉ cần khai rằng vùng đổi loại, và không có gì chặn lời khai ấy ngoài việc đọc plan.
- **Vế thứ hai có thể bị lật cả hai đầu bằng một phán quyết.** Ba mặt nội dung của trang học và bốn
  mặt của cột đọc trang bài luyện mã đang được xếp vào `L11-4` bằng chỗ đứng trong cây, không bằng
  một lần thầy phán, và cây sống đang render chúng ngược nhau. Nếu thầy phán rằng một hàng chọn mặt
  đứng trên phần thân của một cột vẫn là điều hướng vùng, thì cái đang bị ghi là vi phạm hoá ra đúng,
  `L11-4` mất hai trong bốn ví dụ, và vế thứ hai phải viết lại từ đầu. Đây là rủi ro lớn nhất của
  mô-đun, và cách đóng nó là hỏi chứ không phải suy thêm.
- **`L11-6` chưa có ví dụ sống.** Không điều khiển nào trong repo đang treo ở trạng thái chưa phán,
  nên mã này được phát biểu từ chính cú lật chứ không từ một chỗ đang chờ. *Suy luận về cách nó sẽ
  chạy lần tới, không có neo.*
- **Chưa đo bằng ảnh chụp.** Mọi câu trong tài liệu này về việc một dải trải hết measure được đọc
  thành một băng chia đôi trang đều suy từ comment trong hợp đồng, từ hai con số đo ở vòng một và từ
  phán quyết, không từ một lần render dưới cùng route, viewport, locale, theme, persona và seed. Riêng
  `px-6` mà `ExtendedTabs` tự mang ở `:37` chưa được đối chiếu với phần đệm của các hợp đồng bọc ngoài
  nó, nên khoảng cách thật từ mép trái màn hình đến chữ đầu tiên của một hàng `L11-1` là chỗ chưa biết
  rõ nhất.
- **Mười bốn call site là toàn bộ họ tab, không phải toàn bộ điều khiển.** Một `Select`, một nhóm nút
  lọc hay một `Switch` cũng đổi thứ nằm dưới nó, và tiêu chí này chưa được thử trên chúng. Bản luật cố
  ý phát biểu bằng việc bấm vào thì cái gì bị thay chứ không bằng tên leaf, nhưng chưa có bằng chứng
  cho thấy nó vẫn đúng ở họ khác.

## Điều kiện phản biện lại

- Thầy phán vòng ba về cái nút chọn năm, hoặc phán lần đầu về một hàng chọn mặt đứng trên phần thân
  của một cột, tức là về cặp trang học và trang bài luyện mã.
- `problem-reading-column` đổi sang điều khiển gọn, hoặc `learn-content-page` đổi sang hàng đầy, vì
  hai việc ấy đóng mâu thuẫn trong cây theo hai chiều ngược nhau.
- Một call site thứ năm dùng cơ chế hàng chạy hết chiều ngang xuất hiện, hoặc một trong bốn cái hiện
  có đổi hình dạng.
- `ChoiceTabs` đổi giá trị mặc định ở `:62`, vì khi ấy cái bẫy im lặng của `L11-5` biến mất và một
  ngoại lệ trong luật hết hiệu lực.
- `gate.schema.json` thêm một trường hình dạng điều khiển, vì khi ấy khoản nợ gate đóng lại và mã
  chuyển từ văn xuôi sang máy.
- Bảng định tuyến ở [`../../INDEX.md`](../../INDEX.md) thêm link cho `L11`, hoặc `L4` và `L10` sửa hai
  câu ngoại lệ đang trỏ tiêu chí đi chỗ khác.
- Comment ở `CoursesCatalogPage\component.tsx:216-220` được viết lại, vì khi ấy vi phạm còn sống duy
  nhất của mô-đun đóng lại.
- Có lần render đầu tiên dưới cùng route, viewport, theme và persona, vì khi ấy phần chưa đo bằng ảnh
  chụp ở trên hết hiệu lực.
