---
title: Contract · Vietnamese
---

# Hợp đồng

## LOADS

None.


## Bản ghi

Gate này nhận code đã viết rồi — một file, một khúc diff. Kết quả là một **phán quyết**: rule nào đã bắn,
nó thi hành mã luật nào, cơ chế nào làm nó bắn, nó tìm thấy gì, và khi có thì thêm cả cách viết lẽ ra
đã né được báo cáo. Mô-đun này không chọn gì cả. Nó từ chối, và nó phải chỉ được vào đúng nút mà nó từ
chối.

## Luật

Một nút cấu trúc được mô tả **một lần duy nhất**, bằng một khoá sở hữu các class mà nút đó mặc, phần
tử nó mở ra, và lý do các con của nó nằm như vậy. Tác giả cần một hình dạng thì gõ khoá. Luật mà mấy
rule này giữ chạy từ `CONTRACT-1` tới `CONTRACT-13` và thuộc sở hữu của khuôn mẫu contract, không
thuộc file này.

**Bảo đảm mạnh nhất trong luật này lại không phải rule nào cả.** Từ vựng class và từ vựng host là
union đóng, nên một giá trị lệch thang là **không biểu diễn được** chứ không phải bị cấm, còn danh
tính, số lượng và props của một slot là lỗi biên dịch trước khi có rule nào chạy. Phần mấy rule ở đây
phủ là phần một kiểu dữ liệu không nhìn thấy: **file nào** đã viết ra chuỗi đó, khoá có tồn tại không,
và có ai render nó không.

Kệ này ghi phần **thi hành**, không ghi luật. Mọi mục đều đúng với rule như nó đã được cài đặt, kể cả
những chỗ rule hẹp hơn chính câu mà nó mang tên.

## Luật máy đã xuất bản

Mười rule xuất xưởng, và source xuất ra đúng mười mục trong `rules`.

| Rule | Mã | Nó báo cái gì |
|---|---|---|
| `no-literal-structural-class` | `CONTRACT-1` | `structural` — một token cấu trúc trong thuộc tính class tĩnh; `hoisted` — chính token đó trong một hằng chuỗi ở cấp module |
| `no-class-composition-outside-contract` | `CONTRACT-2` | `composer` — một lời gọi tới hàm gộp class đã biết; `interpolated` — thuộc tính class dựng bằng template hoặc bằng `+` |
| `only-the-frame-wears-a-node` | `CONTRACT-4` | `worn` — một lời gọi `contractNodeProps` ở bất cứ đâu ngoài frame |
| `contract-why-is-a-reason` | `CONTRACT-6` | `tooShort` — lý do dưới mười hai từ; `restates` — lý do chỉ ghép lại từ chính các từ của khoá |
| `no-structural-host-outside-contract-frame` | `CONTRACT-7` | `host` — một hộp trung tính viết tay; `styledSemantic` — một phần tử ngữ nghĩa có mang class |
| `no-hand-written-contract-attrs` | `CONTRACT-8` | `marker` — thuộc tính `data-node` hoặc `data-why` viết tay |
| `no-duplicate-entry-shape` | `CONTRACT-9` | `duplicate` — một mục có class, host và slot trùng với mục khác đã ghi |
| `no-unknown-contract-key` | *không có* | `unknown` — một khoá không có trong bảng, kèm danh sách các khoá đang có |
| `no-interaction-class-in-entry` | `CONTRACT-12` | `interaction`, `paint`, `raised` — một class trong mục là hành vi, màu sơn hay độ nổi chứ không phải sự sắp đặt |
| `no-dead-contract-key` | `CONTRACT-13` | `dead` — một khoá trong bảng mà không file nào được duyệt và không slot anh em nào gọi tên |

**`no-unknown-contract-key` không thi hành mã nào trong luật, và đó là một phát hiện chứ không phải
một khe hở để trát vữa lên.** Thông điệp của nó trích `CONTRACT-9` và `CONTRACT-5` như lời khuyên,
nhưng phép kiểm nó thực sự làm là **thành viên**: chuỗi này có xuất hiện như một khoá trong bảng
không. Không mã đánh số nào phát biểu điều đó. `CONTRACT-9` quản chuyện một khoá **mới** có chính đáng
hay không — một phán đoán mà không rule nào nhận — và rule thật sự giữ `CONTRACT-9` là
`no-duplicate-entry-shape`. Phán quyết trích rule này thì ghi `code: none`.

Ba mã không có rule và cũng không định có. `CONTRACT-3` và `CONTRACT-11` là union đóng và một bản ghi
slot đã được kiểm, do hệ kiểu giữ. `CONTRACT-5` — **tên** của khoá quy định thứ nằm bên trong nó —
không do gì giữ cả, chỉ xuất hiện dưới dạng văn xuôi trong thông điệp của một rule khác. `CONTRACT-10`
được diễn đạt thành một miễn trừ chứ không phải một rule: bốn nhánh bề mặt có tên được tha khỏi hai
rule để mỗi cái tự sở hữu lớp bọc cố định của mình.

## Đọc một diff

1. **Kiểm cổng đường dẫn trước.** Mọi cổng ở đây đều dựng trên việc đường dẫn có chứa `/src/`, trực
   tiếp hoặc thông qua phép kiểm bảng. File nằm ngoài đó không sạch, nó **chưa được xét** — và lượt
   chạy vẫn xanh trong cả hai trường hợp, nên phán quyết buộc phải nói rõ là cái nào.
2. **Kiểm miễn trừ thứ hai**, trước khi đọc bất kỳ nút nào. `leaves/`, `branches/Tree/`, bốn nhánh bề
   mặt có tên, file `.test.`/`.spec.` và `.artifacts` mỗi thứ tắt đi một số rule cụ thể.
3. **Đọc các nút của file cho chín rule chạy trên AST.** Một parser, một file, một lượt.
4. **Chỉ đọc bảng và cây thư mục ở chỗ có rule đòi** — danh sách khoá cho `no-unknown-contract-key`,
   lượt duyệt repository cho `no-dead-contract-key`.
5. **Mỗi phát hiện phát một khối**, gọi tên cơ chế đã bắn.
6. **Khi có một lỗ hổng mở áp vào, ghi nó vào phán quyết.** Một bản sửa chỉ dời cùng một quyết định
   sang một loại nút khác thì không phải bản sửa, và biên bản phải nói ra điều đó.

## `no-literal-structural-class` — CONTRACT-1

**Nó báo cái gì.** `structural` cho một token cấu trúc trong thuộc tính class tĩnh; `hoisted` cho
chính token đó trong một hằng chuỗi ở cấp module, kèm tên biến.

**Nó phát hiện bằng gì.** Hai visitor. Một thuộc tính class có giá trị là chuỗi literal, hoặc một
container biểu thức bọc một literal hay một template không có lỗ; và một `VariableDeclarator` có giá
trị khởi tạo cùng loại. Chữ được tách theo khoảng trắng, mỗi token bỏ hết phần tới dấu `:` cuối cùng
và dấu `!` đứng đầu, rồi khớp với một tập chín phần tử — `flex`, `grid`, `contents`, bốn giá trị
position — và một regex tiền tố phủ `flex-`, `grid-cols-`, `gap-`, `items-`, `justify-`, `col-`,
`row-`, `space-x-`, `divide-`, `overflow-`, `inset-`, `top-`, `z-`, `basis-`, `shrink`, `grow` cùng
nhiều cái khác.

**Điểm mù.** Chuỗi được gom vào một cấu trúc: `const CLASSES = {root: "flex gap-4"}` rồi
`className={CLASSES.root}` — giá trị khởi tạo là `ObjectExpression` nên không visitor nào thấy chuỗi.
Một mảng ghép lúc dùng, `["flex", "gap-4"].join(" ")`. Một trường của lớp hay một tham số mặc định,
`static root = "flex gap-4"`, `({cls = "flex"})` — đó là `PropertyDefinition` và `AssignmentPattern`,
visitor khai báo biến không biết cái nào. Và mọi thứ nằm dưới `leaves/`.

**Ranh giới.** Class được gộp là `CONTRACT-2`, không phải rule này. Rule này chỉ nhìn thấy một chuỗi
tĩnh.

## `no-class-composition-outside-contract` — CONTRACT-2

**Nó báo cái gì.** `composer` cho lời gọi tới một hàm gộp class đã biết; `interpolated` cho thuộc tính
class dựng bằng template hoặc bằng `+`.

**Nó phát hiện bằng gì.** Một `CallExpression` có callee là định danh trần nằm trong tập tám tên —
`cn`, `clsx`, `classnames`, `classNames`, `twMerge`, `twJoin`, `cva`, `tv` — và bị báo bất kể nó trả
về gì. Cộng thêm thuộc tính class có biểu thức là template có lỗ, hoặc `BinaryExpression` với toán tử
`+`.

**Điểm mù.** `utils.cn(base, extra)`, hoặc `import {cn as classes}` rồi gọi `classes(...)`:
callee bắt buộc là định danh trần trong tập, nên gọi qua thành viên và import đổi tên đều tàng hình —
ngược hẳn với cách `only-the-frame-wears-a-node` xử lý lời gọi qua thành viên, nên hai rule mâu thuẫn
nhau về cùng một mánh né. Gộp bằng phương thức mảng, `[base, dense && "gap-2"].filter(Boolean).join(" ")`.
Và `` const root = `flex ${gap}` `` gán ra trước, vì visitor nội suy chỉ đọc ở thuộc tính.

**Ranh giới.** Một biểu thức ba ngôi — `className={dense ? "flex gap-2" : "grid gap-4"}` — qua được
rule này **và** `no-literal-structural-class`: cái đầu cần chuỗi tĩnh, cái sau chỉ biết template và
`+`. Đó là lỗ hổng dễ với tới nhất trong cả mô-đun này.

## `only-the-frame-wears-a-node` — CONTRACT-4

**Nó báo cái gì.** `worn` — một lời gọi `contractNodeProps` ở bất cứ đâu ngoài frame.

**Nó phát hiện bằng gì.** Một `CallExpression` có callee là định danh `contractNodeProps`, hoặc một
`MemberExpression` không tính toán mà thuộc tính là chính định danh đó. Không xét gì về đối số, về đối
tượng nhận, hay về kết quả.

**Điểm mù.** Bản thân hành vi, nó chỉ thấy cái tên: `CONTRACTS["key"].classes.join(" ")` trải
vào một phần tử của vendor, hay `contractNodeProps` truyền theo tham chiếu vào `map`, đều với tới đúng
đám class đó mà vẫn tàng hình.

**Ranh giới.** Test cố tình **không** được miễn ở rule này; chỉ đúng thư mục của frame được miễn. Một
test song sinh mà trải props ra là một phát hiện, không phải một sự cho phép.

## `contract-why-is-a-reason` — CONTRACT-6

**Nó báo cái gì.** `tooShort` khi lý do dưới mười hai từ; `restates` khi lý do chỉ ghép từ chính các
từ trong khoá của nó.

**Nó phát hiện bằng gì.** Một `Property` có khoá không tính toán đọc ra `why` và giá trị là chuỗi
literal. Dưới mười hai từ thì bắn `tooShort`; ngược lại mỗi từ được hạ về chữ thường, lọc còn `a-z`,
rồi kiểm xem có nằm trong các từ tách theo dấu gạch của khoá sở hữu hay không, khoá này đọc từ
`node.parent.parent`.

**Điểm mù.** Một lý do viết bằng template literal — đúng một dấu backtick là tắt cả rule, kể
cả sàn độ dài. Mười hai từ nước ốc vẫn qua được cái sàn duy nhất đang có. Còn `restates` đòi **mọi** từ
đều đến từ khoá, điều gần như không thể đạt khi tối thiểu đã là mười hai từ, nên trên thực tế thông
điệp thứ hai không bao giờ bắn.

**Ranh giới.** Rule gác ở đúng một tên file kết thúc bằng `contracts/index.ts` dưới ba tiền tố đã
biết. Một file bảng thứ hai không phải là bảng.

## `no-structural-host-outside-contract-frame` — CONTRACT-7

**Nó báo cái gì.** `host` cho một hộp trung tính viết tay; `styledSemantic` cho một phần tử ngữ nghĩa
có mang class.

**Nó phát hiện bằng gì.** Một `JSXOpeningElement` có tên bằng đúng dạng chữ thường của chính nó. Tập
trung tính bảy phần tử — `div`, `section`, `main`, `header`, `footer`, `aside`, `nav` — bị báo vô điều
kiện. Tập ngữ nghĩa bốn phần tử — `ul`, `ol`, `li`, `form` — chỉ bị báo khi có một thuộc tính là
`JSXAttribute` tên `className` hoặc `class`.

**Điểm mù.** Mười một tên thẻ được liệt kê; `<span className="flex gap-2">`, `<article>`,
`<figure>`, `<label>`, `<table>` và `<dl>` là những phần tử chứa mà rule này không có ý kiến gì. Một
phép trải mang class, `<ul {...listProps}>`, là `JSXSpreadAttribute` nên trượt phép kiểm thuộc tính.
Và host tính toán — `const Tag = "div"` rồi `<Tag>`, hay `createElement("div", props)` — không bao giờ
là định danh chữ thường tại chỗ gọi.

**Ranh giới.** Với sang `<ul>` để né lệnh cấm hộp trung tính là không được: một phần tử ngữ nghĩa mang
class thì thôi làm lớp bọc và bị báo.

## `no-hand-written-contract-attrs` — CONTRACT-8

**Nó báo cái gì.** `marker` — thuộc tính `data-node` hoặc `data-why` viết tay.

**Nó phát hiện bằng gì.** Một `JSXAttribute` có nút tên là `JSXIdentifier` đọc ra `data-node` hoặc
`data-why`.

**Điểm mù.** Mọi cách gián tiếp: `<div {...{"data-node": key}} />`,
`element.setAttribute("data-node", key)`, hoặc cặp đó truyền qua một đối tượng props thường. Và một
marker thứ ba mà frame bắt đầu vẽ vào ngày mai — tập này giữ hai chuỗi, thêm marker cho frame không có
nghĩa là thêm vào đây.

**Ranh giới.** Chỉ tên thuộc tính JSX viết thẳng mới khớp; mọi thứ khác là một loại nút khác.

## `no-duplicate-entry-shape` — CONTRACT-9

**Nó báo cái gì.** `duplicate` — một mục có class, host và slot trùng với mục khác đã ghi. Một cặp chỉ
bị báo một lần, ở mục đứng sau.

**Nó phát hiện bằng gì.** Một `CallExpression` trên `buildContracts`; mỗi thuộc tính của đối số đầu
được rút về một chuỗi dựng từ các class dạng **đa tập đã sắp**, literal `host`, và danh tính của từng
slot có tên — `contract`, `composite` hay `leaf`, các phương án đã sắp và khử trùng — cộng hai cờ
`optional` và `repeats`. Tên khoá, `why`, `restingCount` và `props` của slot bị loại trừ **có chủ ý**.
Chuỗi bằng nhau thì đụng nhau trong một `Map`.

**Điểm mù.** Mục nào không đọc tĩnh được thì bị bỏ qua chứ không bị báo, nên
`{...shared, classes: [...]}`, `classes: STACK` hay một khoá tính toán giấu được một bản sao vĩnh
viễn. Và mỗi lời gọi dựng bản đồ riêng, nên hai mục giống hệt nhau ở hai lời gọi `buildContracts` hay
hai file bảng không bao giờ gặp nhau.

**Ranh giới.** Đảo thứ tự mảng class, đổi tên khoá hay viết lại lý do đều không thoát: đó đúng là
những trường mà chuỗi hình dạng loại ra.

## `no-unknown-contract-key` — không có mã

**Nó báo cái gì.** `unknown` — một khoá không có trong bảng, kèm danh sách các khoá đang có.

**Nó phát hiện bằng gì.** Một `JSXOpeningElement` có tên phần tử đúng bằng `Tree`, đọc thuộc tính
`contract` tĩnh; và một `CallExpression` trên định danh trần `contractSpec` với đối số đầu là chuỗi.
Danh sách khoá được đọc từ đĩa dưới dạng **chữ**: thư mục được đi ngược lên tối đa bốn mươi tầng thử
ba đường dẫn tương đối, lời gọi `buildContracts({` đã chọn được cắt theo ngoặc cân bằng, rồi khoá được
khớp bằng `/^\s{4}"([a-z][a-z-]*)":\s*\{/gm`.

**Điểm mù.** Bốn trong năm dạng mà nơi khác tính là một tham chiếu —
`defineContractComponent("typo-key")`, `defineContractProjection("typo-key")`, `CONTRACTS["typo-key"]`,
`contract: "typo-key"` trong một đối tượng — hoàn toàn không được kiểm ở đây, nên một lỗi gõ ở ba
trong số đó vừa không bị kiểm vừa đủ để giữ một khoá thật khỏi bị coi là chết. Render động hay đổi tên
— `<Tree contract={key} />`, `contract={ok ? "a" : "b"}`, `import {Tree as Node}`, `<Contract.Tree>` —
đều ngoài tầm với. Và regex khoá đòi đúng bốn khoảng trắng đầu dòng cùng `[a-z][a-z-]*`: định dạng lại
bảng là danh sách khoá rỗng và rule **tắt trong im lặng**, còn một khoá như `grid-2-up` thì vắng khỏi
danh sách nên mọi lần dùng đúng của nó đều bị báo là khoá lạ.

**Ranh giới.** Rule này kiểm tư cách thành viên, không kiểm sự chính đáng. Một khoá mới có xứng đáng
tồn tại hay không là `CONTRACT-9`, và không rule nào nhận phán đoán đó.

## `no-interaction-class-in-entry` — CONTRACT-12

**Nó báo cái gì.** `interaction`, `paint` hoặc `raised` — một class trong mục là hành vi, màu sơn hay
độ nổi chứ không phải sự sắp đặt.

**Nó phát hiện bằng gì.** Một `CallExpression` trên `buildContracts`; mảng `classes` hoặc `classNames`
của từng mục được duyệt từng phần tử, mỗi chuỗi được kiểm **thô** — không bóc biến thể — với ba regex:
họ tương tác (`cursor-`, `group`, `hover:`, `active:`, `focus:`, `focus-visible:`, `disabled:`,
`aria-*:`, `data-[`), họ màu sơn (sáu tên màu chữ chính xác, `decoration-`, `underline`) và họ vật thể
nổi (`bg-surface`, `shadow`). Một nền được tha khi chính mảng đó còn giữ một `w-full` cùng một
`border-b` hoặc `border-t`.

**Điểm mù.** Bất kỳ biến thể nào cũng dắt thẳng một class bị cấm vào bảng:
`md:cursor-pointer`, `lg:bg-surface`, `dark:shadow-md`, `!bg-surface`, `group-hover:opacity-80` — vì
ba regex này không bóc biến thể, khác với `no-literal-structural-class` vốn có bóc. Mọi cách viết khác
của một nền, một độ nổi hay một màu đều hợp lệ: `bg-white`, `bg-card`, `bg-neutral-50`,
`drop-shadow-lg`, `ring-1`, `text-primary`, `text-red-500`. Và ngoại lệ dải ngang là một **mật khẩu
hai từ** chứ không phải một phán đoán về việc nút đó là gì: thêm `w-full` và `border-b` là
`bg-surface` được tha.

**Ranh giới.** Rule này đọc các mục trong bảng, không đọc markup tại chỗ gọi.

## `no-dead-contract-key` — CONTRACT-13

**Nó báo cái gì.** `dead` — một khoá trong bảng mà không file nào được duyệt và không slot anh em nào
gọi tên.

**Nó phát hiện bằng gì.** Một lượt duyệt hệ tệp. Gốc repository được phục dựng từ đường dẫn bảng bằng
phép khớp hậu tố dài nhất, rồi mọi `src` dưới các gốc component cộng mọi `apps/*/src` và
`packages/*/src` được duyệt — bỏ qua `node_modules`, `.next`, `dist` và `.artifacts` — đọc các đuôi
`.ts .tsx .js .jsx .mjs .cjs`. Năm regex tham chiếu được áp lên chữ của từng file, và trong bất kỳ
file nào có chứa từ `ContractKey`, mọi literal chữ thường có gạch nối đặt trong nháy đều tính là một
tham chiếu. Khoá được gọi tên bởi slot `children.*.contract` của mục khác thì gom riêng. Phần còn lại
bị báo.

**Điểm mù.** Một khoá chỉ được gọi tên trong `.md`, `.mdx`, `.json` hay bất kỳ đuôi nào ngoài
sáu đuôi được duyệt sẽ bị báo là chết trong khi một tài liệu đang render nó — và phát hiện đó tới tay
người đọc dưới dạng một lệnh xoá. Render động, `` contract={`row-${size}`} `` hay `CONTRACTS[key]` trong
một file không hề nhắc `ContractKey`, cũng bị báo chết trong khi nó vẽ ở mọi lần tải. Chiều ngược lại
cũng phải trả giá: regex tham chiếu thứ hai khớp **mọi** thuộc tính đối tượng tên `contract` có giá
trị chuỗi gạch nối, nên `const job = {contract: "full-time"}` ở bất cứ đâu trong repository cũng giữ
một khoá chết sống mãi, và một file nhắc `ContractKey` sẽ nâng mọi literal gạch nối trong nháy của nó
lên thành tham chiếu.

**Ranh giới.** Một cây không duyệt được thì không sinh phát hiện nào, chứ không tuyên bố cả bảng là
chết.

## Cách phát hiện

Bộ máy dùng chung, và hai rule với tay ra ngoài file.

| Bộ phận | Cơ chế |
|---|---|
| cổng đường dẫn | Cả mười cổng đều là phép kiểm chuỗi con hoặc hậu tố trên `context.filename` đã đổi sang gạch chéo xuôi, tựa trên `/src/` |
| lượt đọc AST | Chín rule đọc chính các nút của file: một parser, một file, một lượt |
| đọc bảng | `no-unknown-contract-key` đọc bảng hợp đồng từ đĩa dưới dạng **chữ** — một rule ESLint không import được module TypeScript — đi ngược lên tối đa bốn mươi tầng qua ba đường dẫn tương đối, rồi khớp khoá bằng regex. Bộ nhớ đệm khoá vô hiệu theo mtime của bảng |
| duyệt cây | `no-dead-contract-key` duyệt repository một lần cho mỗi bảng trong mỗi tiến trình, từ gốc phục dựng bằng khớp hậu tố dài nhất |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng mấy cách viết này lọt, nhưng không.

| Viết kiểu này | Vì sao vẫn bắn |
|---|---|
| `className="lg:hover:!flex"` | Mỗi token bị cắt tới dấu `:` cuối và bỏ dấu `!` đầu trước khi khớp |
| `className={"flex gap-4"}`, hoặc chuỗi backtick không có lỗ | Container được bóc ra và template không lỗ được ghép lại thành một chuỗi |
| `const ROOT = "flex flex-col gap-4"` | Visitor khai báo biến sinh ra đúng để bắt ca này và gọi tên biến |
| Viết `class` thay vì `className` | Cả hai tên thuộc tính cùng qua một phép kiểm |
| `` className={`flex ${dense ? "gap-2" : "gap-4"}`} `` | Template có biểu thức trên thuộc tính class bị báo là `interpolated` |
| `<ul className="flex gap-2">` | Phần tử ngữ nghĩa mang class bị báo là `styledSemantic` |
| `<section>` hay `<nav>` thay cho `<div>` | Cả bảy hộp trung tính bị cấm cùng nhau, vô điều kiện |
| `helpers.contractNodeProps(contract)` | Biểu thức thành viên không tính toán có thuộc tính đó cũng bị khớp |
| Trải props bên trong một test | Test không được miễn ở rule này; chỉ thư mục của frame được miễn |
| Đảo class, đổi tên khoá, viết lại lý do | Class so sánh dạng đa tập đã sắp; tên, lý do và số phần tử nghỉ đều bị loại trừ |
| Đảo slot hoặc đảo các phương án của slot | Slot sắp theo tên; phương án khử trùng và sắp trước khi ghép |
| Một khoá chỉ được render từ slot của mục anh em | Khoá con được gom trước vòng lặp báo cáo |
| Một khoá chỉ được render trong story hoặc test | Story và test được duyệt y như source sản phẩm |

**Còn mở** — chỗ mù đã xuất xưởng. Một phán quyết không được nhận là đã xét mấy chỗ này.

| Phạm vi | Cái gì lọt |
|---|---|
| cả mười | **Mọi đường dẫn không có `/src/`.** Một app để route ở gốc repository không phải bị lint thiếu, nó **hoàn toàn không được lint**, và lượt chạy vẫn xanh |
| `no-literal-structural-class` | **Cả thư mục `leaves/`, ở mọi độ sâu.** Miễn trừ là một thư mục, nên nó là ranh giới chính sách chứ không phải một kiểu dữ liệu |
| rule class và rule host | **Bốn nhánh bề mặt có tên, kể cả thư mục con.** Miễn trừ là toàn bộ chứ không bó vào đúng chỗ nối lớp bọc: nhánh bề mặt thứ năm không được miễn gì, còn một file phụ trợ nằm nhờ trong bốn thư mục kia thì được miễn hết |
| ba rule bảng | **Một bản sao bảng nằm trong hồ sơ thiết kế.** Chỉ `no-dead-contract-key` bỏ qua `/.artifacts/`, nên ba rule còn lại lint từ vựng chép lại của một phương án thiết kế như thể nó đã xuất xưởng |

## Đầu vào

| Đầu vào | Ai đọc nó |
|---|---|
| `context.filename` | Mọi rule |
| AST của file | Chín rule |
| Bảng hợp đồng trên đĩa, đọc dưới dạng **chữ** | `no-unknown-contract-key` |
| Cây repository trên đĩa | `no-dead-contract-key` |
| mtime của bảng | Bộ nhớ đệm khoá, vô hiệu theo nó |

## Quy tắc

1. Một rule không đọc được thứ nó cần thì **im**. Bảng thiếu, bảng không phân tích được và cây không
   duyệt được đều sinh ra không phát hiện nào, chứ không bao giờ sinh một phát hiện chụp lên mọi chỗ gọi.
2. Ba gốc component là một danh sách duy nhất, nên thêm một layout vào đó là thêm nó vào mọi phép kiểm
   cùng lúc.
3. Phân tích bằng chữ là chủ ý, không phải tạm bợ. Một rule chạy dưới một parser trên một file.
4. Frame là file duy nhất được miễn khỏi việc mặc nút, và một test không phải miễn trừ thứ hai.
5. Các rule cấp mục đọc mục từ đúng lời gọi `buildContracts` đã chọn, không đọc mọi đối tượng trong
   file, nên một bảng thứ hai trong cùng file không thể báo lên bảng thứ nhất.
6. Một cặp mục trùng nhau chỉ bị báo một lần, ở mục đứng sau.

## Ngoại lệ

Mỗi miễn trừ là một phép kiểm thư mục hoặc tên file, nên tất cả đều là ranh giới chính sách mà ai cũng
bước qua được bằng cách dời một file.

- **Tầng lá.** Mọi file dưới `leaves/` tự viết class và tự mở hộp của mình. Thứ giữ một component
  đứng ngoài là một câu hỏi do người đặt ra — file này có sắp đặt hai phần nội dung không — và không
  cổng nào hỏi câu đó.
- **Frame.** Mọi file dưới `branches/Tree/` được mở host và vẽ marker, vì biến một khoá thành một
  phần tử chính là việc của nó. Miễn trừ là **thư mục**: dẹp frame thành một file phẳng nằm cạnh anh
  em nó thì frame thành kẻ vi phạm chính cái rule nó cài đặt.
- **Bốn nhánh bề mặt có tên.** File dưới `branches/SurfaceCard/`, `branches/SurfaceAccordionCard/`,
  `branches/SurfaceListCard/` và `branches/SurfaceFormCard/` được tha khỏi rule class literal và rule
  host để mỗi cái tự sở hữu lớp bọc vendor cố định của mình.
- **Test.** File khớp `.test.` hoặc `.spec.` nằm ngoài các rule class, gộp class và host, vì một test
  song sinh có thể dựng markup mẫu bằng tay. Chúng vẫn nằm trong `only-the-frame-wears-a-node`.
- **Hồ sơ thiết kế.** Riêng `no-dead-contract-key` bỏ qua mọi đường dẫn chứa `.artifacts`, vì một
  phương án thiết kế mang theo một bản sao từ vựng và chỉ vẽ một trang trong đó.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule: <tên rule đã xuất bản>
code: <CONTRACT-n | none>
file: <đường dẫn>
mechanism: <loại nút hoặc phép kiểm đường dẫn đã bắn>
finding: <thứ rule báo>
hatch: <cách viết lẽ ra đã né được báo cáo, khi có>
```

Dòng cuối **không phải tuỳ chọn** khi có một lỗ hổng mở áp vào phát hiện đó. Một bản sửa chỉ dời cùng
một quyết định sang một loại nút khác thì không phải bản sửa, và biên bản phải nói ra điều đó.

## Ví dụ đã giải

**Đầu vào.** Một file khối ở `components/blocks/course/CourseRow/index.tsx`:

```tsx
const ROOT = "flex items-center gap-4"

export function CourseRow({course, dense}) {
  return (
    <div className={ROOT}>
      <span className={dense ? "flex gap-2" : "grid gap-4"}>{course.title}</span>
    </div>
  )
}
```

Đường dẫn có chứa `/src/` và file không nằm dưới `leaves/`, `branches/Tree/` hay một nhánh bề mặt có
tên, nên mọi rule đều chạy.

```text
rule: no-literal-structural-class
code: CONTRACT-1
file: src/components/blocks/course/CourseRow/index.tsx
mechanism: VariableDeclarator với init là Literal chuỗi
finding: hoisted — ROOT
hatch: none
```

```text
rule: no-structural-host-outside-contract-frame
code: CONTRACT-7
file: src/components/blocks/course/CourseRow/index.tsx
mechanism: JSXOpeningElement thuộc tập trung tính
finding: host — div
hatch: none
```

Hai khối, và vi phạm thứ ba không nằm trong số đó. Biểu thức ba ngôi trên `span` viết class cấu trúc
ngay tại chỗ gọi mà vẫn tàng hình: `no-literal-structural-class` cần một chuỗi tĩnh mà một biểu thức
điều kiện thì không phải, còn `no-class-composition-outside-contract` chỉ biết template và `+`. Phán
quyết ghi lại điều đó:

```text
rule: no-class-composition-outside-contract
code: CONTRACT-2
file: src/components/blocks/course/CourseRow/index.tsx
mechanism: không cơ chế nào bắn
finding: none
hatch: một biểu thức ba ngôi giữa hai chuỗi class tĩnh qua được cả rule này lẫn CONTRACT-1
```

Sửa xong, khối gõ khoá và frame mở hộp:

```tsx
export function CourseRow({course}) {
  return <Tree contract="row-between" title={course.title} />
}
```

Lúc này `no-unknown-contract-key` mới là rule đáng kể: nếu `row-between` không phải một khoá trong
bảng thì nó bắn — còn nếu bảng đã bị định dạng lại thành thụt hai khoảng trắng thì nó đọc ra không
khoá nào và **không nói gì cả**.

## Phạm vi

Mô-đun này ghi những rule tồn tại trong source, và không ghi gì khác. Một rule đáng lẽ phải có mà chưa
có là rủi ro để mở, không bao giờ được ghi ở đây như thể nó đang chạy. Văn xuôi và ví dụ không gọi tên
sản phẩm nào, thư viện thành phần nào hay repository nào; tên rule đã xuất bản và các định danh mà rule
khớp vào đều được chép nguyên văn, vì đó là những chuỗi mà một lượt build in ra.
