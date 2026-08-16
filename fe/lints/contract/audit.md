---
id: fe-lints-contract-audit
title: audit.md
slug: /fe/lints/contract/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thực thi — mười luật giữ được gì, và cửa nào còn mở.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `contract`

Phản biện này **không** kiểm luật. Luật nằm ở `patterns/contract.md`. Phản biện này kiểm **phần thực
thi**: mười luật máy giữ có thật sự giữ được điều chúng mang tên không, và chỗ nào chúng chỉ **trông
như** đang giữ.

## Verdict

**Chấp nhận, kèm ba mươi mốt cửa còn mở được ghi tên.**

Mã nguồn công bố **đúng mười** luật trong `rules` — trùng với con số nêu trong yêu cầu. Chín trên
mười ánh xạ được vào một mã `CONTRACT-<n>`; một luật (`no-unknown-contract-key`) **không giữ mã nào**
và được ghi thành finding thay vì bịa ánh xạ.

Điều làm mô-đun này đáng tin không phải số luật, mà là **kỷ luật im lặng**: cả ba bộ đọc — bảng khoá,
host của khoá, và lượt đi bộ tham chiếu — đều trả `null` khi không đọc được, và mọi luật dùng chúng
đều dừng. Một bộ đọc nhìn vào chỗ trống mà trả lời "không có gì vẽ cái này" thì câu trả lời tới dưới
dạng **một danh sách xoá**, và đó là kiểu hỏng đắt nhất một luật máy giữ có thể gây ra.

Điều làm nó **chưa** đáng tin tuyệt đối cũng là chuyện đó ở chiều ngược lại: **im lặng và sạch trông
giống hệt nhau**. Xem "Rủi ro còn mở", mục đầu tiên.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số luật công bố so với yêu cầu | Đúng **10**. Nguồn là quyền quyết định và nguồn đồng ý |
| Mỗi luật có một mã luật | **9/10**. `no-unknown-contract-key` không giữ mã nào |
| Mỗi mã luật có một luật giữ | **8/13**. `CONTRACT-3`, `CONTRACT-11` do kiểu dữ liệu giữ (đúng ý đồ); `CONTRACT-10` là một miễn trừ chứ không phải một luật; `CONTRACT-5` **không ai giữ** |
| Danh tính luật là **tên công bố**, không phải số | Đạt. Không mã số nào được bịa ra trong mô-đun này |
| Mỗi luật có ít nhất một cửa mở thành thật | Đạt. **31 hàng cửa mở** được ghi tên trong `INDEX.md`; không luật nào ghi "không có" |
| Có luật nào kín thật không | **Không**. Kể cả luật kín nhất (`no-hand-written-contract-attrs`) vẫn thua một dấu spread |
| Bộ đọc thất bại có im lặng không | Đạt ở cả ba: bảng, host, lượt đi bộ |
| Hai luật cùng phạm vi có chốt phạm vi giống nhau không | **Không đạt**. Xem F-3 |
| Hành vi thật có khớp với tên luật không | **Không đạt ở hai chỗ**. Xem F-1 và F-2 |

## Findings

**F-1 · `no-unknown-contract-key` không giữ mã nào, và tên nó hứa nhiều hơn nó làm.**
Mã nguồn xếp nó dưới banner `CONTRACT-9`, thông điệp của nó dẫn cả `CONTRACT-9` lẫn `CONTRACT-5`.
Phép kiểm thật sự là **phép thuộc tập** trên hai dạng gọi tên (`<Tree contract="…">` và
`contractSpec("…")`). Không mã đánh số nào phát biểu "khoá phải có trong bảng". `CONTRACT-9` nói về
việc một khoá **mới** có xứng đáng ra đời không, và luật thật sự giữ điều đó là
`no-duplicate-entry-shape`. Ghi nhận, không ánh xạ.

**F-2 · `contract-why-is-a-reason` có hai thông điệp, và thông điệp thứ hai gần như không bắn
được.** `restates` đòi **mọi** từ trong lý do đều thuộc tập từ tách theo gạch của khoá, nhưng nó chỉ
được xét **sau** khi lý do đã qua sàn mười hai từ. Một câu mười hai từ dựng hoàn toàn từ ba, bốn từ
của khoá là chuyện gần như không xảy ra tự nhiên; chỉ cần một liên từ là thoát. Trên thực tế luật này
là **một sàn độ dài**, không phải một phép đo nội dung — và tên nó nói khác.

**F-3 · Ba luật cùng đọc bảng, hai cách chốt phạm vi.** `no-duplicate-entry-shape` và
`no-interaction-class-in-entry` đọc mục qua đúng lời gọi `buildContracts`, đúng như lý do đã ghi
trong nguồn: một bảng thứ hai trong cùng tệp sẽ báo bảng thứ nhất. `contract-why-is-a-reason` thì
bắn vào **mọi** thuộc tính tên `why` trong tệp. Cùng một tệp, cùng một lớp rủi ro, hai chuẩn.

**F-4 · Hai luật bất đồng về việc "gọi tên một khoá" trông ra sao.** `no-dead-contract-key` đếm
**năm** dạng tham chiếu; `no-unknown-contract-key` kiểm **hai** dạng, và **không dạng nào trong hai
trùng với bốn dạng còn lại** ngoài `<Tree contract>`. Hậu quả kép: một khoá gõ sai viết bằng
`defineContractComponent` vừa không bị bắt, vừa **giữ sống** một khoá đã chết mang tên đó.

**F-5 · Hai luật bất đồng về `MemberExpression`.** `only-the-frame-wears-a-node` xử cả
`Identifier` lẫn member không tính toán. `no-class-composition-outside-contract` chỉ xử `Identifier`
trần. `utils.cn(...)` lọt, `helpers.contractNodeProps(...)` không lọt. Không có lý do nào trong nguồn
giải thích chênh lệch này.

**F-6 · Hai luật bất đồng về biến thể.** `no-literal-structural-class` **cắt** biến thể và dấu `!`
trước khi đối chiếu. `no-interaction-class-in-entry` đối chiếu **chuỗi thô**. Nên `lg:!flex` bị bắt ở
nơi gọi, còn `lg:bg-surface` đi thẳng vào bảng — tức là luật canh **bảng**, nơi hậu quả lâu dài hơn,
lại là luật lỏng hơn.

**F-7 · `no-unknown-contract-key` phụ thuộc vào ĐỊNH DẠNG của bảng.** Mẫu khoá đòi **đúng bốn** ký tự
trắng đầu dòng và `[a-z][a-z-]*`. Đổi thụt lề sang hai dấu cách ⇒ không khoá nào được thu ⇒
`readContracts` trả `null` ⇒ luật **tắt trong im lặng**. Thêm một chữ số vào tên khoá ⇒ khoá vắng mặt
khỏi danh sách ⇒ **mọi** chỗ dùng đúng bị báo là khoá lạ. Một luật mà `prettier` bật tắt được là một
luật có hai trạng thái mà không trạng thái nào lên tiếng.

**F-8 · Ba luật cấp bảng vẫn soi bản ghi kế hoạch.** Chỉ `no-dead-contract-key` bỏ qua đường dẫn chứa
`.artifacts`, kèm ghi chú đo được rằng hai phương án thiết kế từng mở ra hàng trăm đề xuất xoá.
`contract-why-is-a-reason`, `no-duplicate-entry-shape` và `no-interaction-class-in-entry` **không**
có miễn trừ đó, nên một bản sao từ vựng trong phương án thiết kế bị soi như thể nó đang chạy thật.

**F-9 · Miễn trừ khung dựng là một THƯ MỤC.** `isContractFrameFile` đòi đúng đoạn đường dẫn
`branches/Tree/`. Gộp khung dựng thành một tệp phẳng `branches/Tree.tsx` bên cạnh anh em của nó và
khung dựng **trở thành kẻ vi phạm chính luật nó hiện thực** — nó mở host và sơn dấu, đó là việc của
nó.

**F-10 · `contractHostOf` được xuất ra nhưng không luật nào trong tệp này dùng.** Nó là hàm dùng cho
mô-đun luật khác, và điều đó có ghi ở đầu tệp. Ghi lại ở đây để lần đọc sau không đi tìm luật đang
gọi nó trong chính tệp này.

**F-11 · Bộ thăm hằng số của `CONTRACT-1` báo thừa.** Nó quét **mọi** chuỗi tĩnh trong tệp bị quản,
không chỉ chuỗi dùng làm class. Một câu tài liệu hay một khoá i18n chứa chữ `gap-4` sẽ bị báo
`hoisted`. Đây là hướng an toàn hơn hướng ngược lại, nhưng nó là báo thừa và cần được gọi tên như
vậy.

## Decisions

- **Giữ danh tính luật là TÊN công bố.** Không bịa mã số. Tên là thứ hiện trong log build, trong
  comment tắt luật, và trong mọi cuộc trao đổi về lần hỏng đó; một định danh thứ hai sẽ thành một
  luật hai tên và không cách nào biết thông điệp tới từ tên nào.
- **Không ánh xạ `no-unknown-contract-key` vào bất kỳ mã nào.** Ghi thành F-1.
- **Không tài liệu hoá luật chưa tồn tại.** `CONTRACT-5` được nêu ở phần "không luật nào" trong
  `example.md` và ở "Rủi ro còn mở" dưới đây, không được viết như một luật đang chạy.
- **Ghi tên đủ 31 hàng cửa mở, mỗi luật ít nhất một.** Không luật nào được ghi "không có". Một cửa mở
  không ai biết nguy hiểm hơn một luật không tồn tại: luật không tồn tại thì ai cũng biết là chưa ai
  giữ; luật rò thì mọi người **tin là đã đóng**.
- **Không đề xuất sửa nguồn trong tài liệu này.** Mô-đun này ghi lại thực thi hiện có. Mỗi rủi ro
  dưới đây nêu **thứ luật phải soi thêm** để đóng, để lần nâng cấp sau có sẵn phạm vi.
- **Chép nguyên tên định danh có chữ sản phẩm.** Tên luật và tên hàm được so khớp là chuỗi **ship
  ra**; văn xuôi và ví dụ thì không nêu tên sản phẩm, thư viện hay kho nào.

## Rủi ro còn mở

Sắp theo mức thiệt hại, không theo thứ tự luật.

**R-1 · Cả mười luật tắt cho tệp ngoài `/src/`.** Mọi cổng đều dựng trên phép thử chuỗi con đó.
*Để đóng:* luật phải nhận gốc dự án từ config thay vì đoán từ đường dẫn, hoặc `COMPONENT_ROOTS` phải
được cấp qua option của luật. *Giá:* chuyển một hằng số thành cấu hình cho **mọi** luật cùng lúc —
nhưng đây là rủi ro duy nhất khiến một kho **hoàn toàn không được giữ** mà bản chạy vẫn xanh, nên nó
đứng đầu danh sách.

**R-2 · Toán tử ba ngôi lọt cả hai luật class.** `className={a ? "flex gap-2" : "grid"}`.
*Để đóng:* bộ thăm thuộc tính phải gấp `ConditionalExpression` và `LogicalExpression` lại, thu mọi
literal ở các nhánh rồi quét từng cái. *Giá:* rẻ — vài chục dòng, và nó bịt cửa **được dùng nhiều
nhất** trong mô-đun.

**R-3 · Class gom vào đối tượng/mảng hằng số.** `const CLASSES = { root: "flex gap-4" }`.
*Để đóng:* bộ thăm hằng số phải đi xuống `ObjectExpression` và `ArrayExpression`, không chỉ nhận
`Literal` ở `init`. *Giá:* rẻ, và cùng lúc làm F-11 tệ hơn — càng nhiều chuỗi được quét thì càng
nhiều chuỗi không phải class bị báo. Đóng R-3 nên đi kèm một điều kiện lọc theo tên biến hoặc theo
nơi dùng.

**R-4 · Bốn trên năm dạng gọi tên khoá không được kiểm.**
*Để đóng:* `no-unknown-contract-key` phải kiểm thêm `defineContractComponent`,
`defineContractProjection`, `CONTRACTS[...]` và thuộc tính `contract:` — tức là dùng **cùng một danh
sách dạng** mà lượt đi bộ đã dùng. *Giá:* rẻ về kỹ thuật, và đây là chỗ hai luật đang mâu thuẫn nên
đóng nó **giảm** tổng độ phức tạp thay vì tăng.

**R-5 · Luật khoá lạ phụ thuộc định dạng bảng, và tắt trong im lặng.**
*Để đóng:* bộ đọc phải phân tích bảng bằng cân bằng ngoặc theo **cấp** thay vì bằng thụt lề cố định,
và mẫu khoá phải nhận chữ số. Kèm theo đó, "đọc được bảng nhưng không thu được khoá nào" phải là một
**trạng thái khác** với "không có bảng" — trạng thái đầu là một finding về công cụ. *Giá:* trung
bình. Bài kiểm thử song sinh khẳng định một tệp thật phân tích được đã tồn tại chính vì lớp hỏng này;
đừng bao giờ xoá nó cho tiện.

**R-6 · Luật cấp bảng không cắt biến thể.** `md:cursor-pointer`, `lg:bg-surface`, `!bg-surface`,
`dark:shadow-md`, `group-hover:*`.
*Để đóng:* dùng lại đúng hàm `bareToken` đã có sẵn trong cùng tệp trước khi đối chiếu ba biểu thức.
*Giá:* gần bằng không — hàm đã nằm cách đó vài trăm dòng. Đây là cửa **rẻ nhất để đóng** trong toàn
danh sách.

**R-7 · Miễn trừ theo thư mục là miễn trừ ai cũng bước vào được.** `leaves/`, `branches/Tree/`, và
bốn thư mục nhánh bề mặt.
*Để đóng:* không đóng được bằng luật, và nguồn đã nói thẳng: thứ giữ một thành phần ở ngoài tầng lá
là **một câu hỏi do người đặt** — tệp này có sắp xếp hai nội dung không. Một cổng máy trả lời câu đó
sẽ phải phân biệt "sắp xếp" với "vẽ một giá trị", tức là phải hiểu ý định. *Kết luận:* giữ nguyên,
và đưa vào phần soát tay khi có tệp mới trong ba vùng đó.

**R-8 · Miễn trừ nhánh bề mặt là danh sách bốn tên cứng, và miễn TOÀN BỘ tệp.**
*Để đóng:* thu hẹp miễn trừ về đúng lớp bọc — chỉ tha `JSXOpeningElement` là con trực tiếp của thân
thư viện — và đọc danh sách tên từ option thay vì hằng số. *Giá:* trung bình, và nó biến một miễn trừ
thô thành một luật có điều kiện. Nhánh bề mặt **thứ năm** hiện không được miễn gì cả, nên chi phí
đang được trả sẵn ở chiều ngược lại.

**R-9 · `only-the-frame-wears-a-node` cấm một cái tên, không cấm hành vi.**
`CONTRACTS["k"].classes.join(" ")` tái tạo y nguyên hỏng hóc.
*Để đóng:* phải theo dõi luồng dữ liệu từ bảng tới một thuộc tính spread — tức là phân tích liên
thủ tục, thứ một luật ESLint một-tệp-một-lượt **không làm được**. *Kết luận:* đóng bằng luật thì đắt
hơn giá trị thu về; chỗ đúng để đóng là **kiểu dữ liệu** — nếu hàm trả về một nhãn hiệu chỉ khung
dựng nhận được, cửa này khoá bằng trình biên dịch.

**R-10 · `no-dead-contract-key` báo chết oan với khoá dựng động và khoá chỉ có trong tài liệu.**
*Để đóng:* thêm `.md`/`.mdx`/`.json` vào tập tệp được đi bộ (rẻ), và mở rộng sự hào phóng theo
`ContractKey` sang mọi tệp có mẫu template chứa tiền tố khoá (không rẻ, và dễ hoá thành nhận bừa).
*Giá:* phần tài liệu nên đóng; phần khoá động thì **hướng hào phóng là hướng đúng** — giá của đọc
thừa là một khoá chết sống thêm một kỳ phát hành, giá của đọc thiếu là một finding mang nội dung
"xoá cái đang chạy".

**R-11 · `no-dead-contract-key` giữ sống nhầm.** Mẫu `contract: "…"` khớp mọi thuộc tính cùng tên ở
mọi tệp, và một tệp nhắc `ContractKey` biến mọi literal gạch nối trong nó thành tham chiếu.
*Để đóng:* mẫu phải gắn với ngữ cảnh khai khe hoặc với import từ bảng. *Giá:* trung bình, và nó
**đánh đổi trực tiếp** với R-10: siết lại để bớt giữ sống nhầm là nới rộng phần báo chết oan. Không
đóng được cả hai bằng một lần sửa; phải chọn hướng và ghi lại lựa chọn đó.

**R-12 · `contract-why-is-a-reason` tắt sạch với `why` viết bằng backtick.**
*Để đóng:* nhận thêm `TemplateLiteral` không lỗ, và **báo** `TemplateLiteral` có lỗ như một finding
riêng — một lý do dựng lúc chạy không phải một lý do. *Giá:* rẻ.

**R-13 · Thông điệp `restates` gần như không bắn được (F-2).**
*Để đóng:* đổi điều kiện từ "mọi từ thuộc khoá" sang "tỷ lệ từ ngoài khoá dưới một ngưỡng", hoặc bỏ
hẳn và nói rõ luật này là **một sàn độ dài**. *Giá:* rẻ về mã, đắt về tranh luận — mọi ngưỡng đều là
một con số phải bảo vệ được.

**R-14 · `no-structural-host-outside-contract-frame` chỉ biết mười một tên thẻ.** `span`, `article`,
`figure`, `label`, `fieldset`, `table`, `dl` đều là phần tử chứa mà luật không có ý kiến.
*Để đóng:* mở rộng tập trung tính, hoặc lật quy tắc — **mọi** thẻ nội tại viết tay đều bị hỏi, trừ
một danh sách trắng các phần tử lá (`span`, `strong`, `img`, `input`…). *Giá:* lật quy tắc là thay
đổi diện tích báo lỗi rất lớn; phải đo trên một kho thật trước, đúng cách `COMPONENT_ROOTS` từng được
đo.

**R-15 · Mọi luật đều thua một dấu spread.** Class qua spread, dấu hợp đồng qua spread, mục qua
spread.
*Để đóng:* mỗi luật phải gấp được `ObjectExpression` hằng ở cùng phạm vi. *Giá:* lặp lại ở năm chỗ,
và chỉ đóng được trường hợp đối tượng nằm ngay trong tệp. Với đối tượng nhập từ tệp khác thì không
đóng được — lại là ranh giới một-tệp-một-lượt.

**R-16 · Ba luật cấp bảng soi bản ghi kế hoạch (F-8).**
*Để đóng:* chép đúng một dòng bỏ qua `.artifacts` sang ba luật còn lại. *Giá:* gần bằng không. Đây là
thứ nên đóng sớm nhất vì nó **đã** được đo là gây thiệt hại ở luật thứ tư.

**R-17 · `CONTRACT-5` không ai giữ.** Tên khoá phải cố định thứ nằm bên trong nó — `card`, `box`,
`wrapper`, `row` là những cái tên nhận mọi thứ nên không ràng buộc gì.
*Để đóng:* một luật có thể từ chối một danh sách đen tên chung, nhưng nó **không** đo được điều luật
thật sự nói: cái tên có cố định được nội dung không. *Kết luận:* danh sách đen là thứ rẻ và có thật;
phần còn lại thuộc về người soát. Ghi vào đây để không ai tưởng `CONTRACT-5` đang được giữ.

## Re-audit Triggers

- Thêm, bỏ, hoặc đổi tên bất kỳ luật nào trong `rules` — kể cả khi hành vi không đổi.
- `COMPONENT_ROOTS`, `CONTRACT_TABLE_RELATIVE`, `LEAF_DIR_RELATIVE` hoặc danh sách bốn nhánh bề mặt
  thay đổi.
- Bảng hợp đồng đổi vị trí, đổi thụt lề, hoặc tách làm nhiều tệp.
- Một khoá mới mang chữ số trong tên.
- Khung dựng đổi từ thư mục sang tệp phẳng, hoặc ngược lại.
- Khung dựng bắt đầu sơn một dấu thứ ba.
- Một dạng gọi tên khoá thứ sáu ra đời, hoặc một dạng hiện có bị bỏ.
- Một luật ở đây bị hạ xuống `warn` trong một kho tiêu thụ — mức thật do
  `eslint.config.mjs` của kho đó quyết định, không phải do `recommended` ở đây.
- Một finding bị sửa bằng cách **dịch sang kiểu node khác** thay vì bằng cách gõ một khoá.
- Xuất hiện đề xuất xoá một khoá dựa trên `no-dead-contract-key` mà chưa kiểm hai cửa nêu ở R-10.
