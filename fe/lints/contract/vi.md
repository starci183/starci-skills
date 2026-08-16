---
id: fe-lints-contract-vi
title: vi.md
slug: /fe/lints/contract/vi
sidebar_label: vi.md
sidebar_position: 1
description: Mười luật máy giữ hợp đồng nút — bắt gì, giữ mã nào, và cửa nào còn mở.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `contract`

# Máy giữ hợp đồng nút

Một nút cấu trúc được mô tả **một lần**, bằng một khoá. Khoá sở hữu ba thứ không tách rời được: các
class nó mặc, phần tử nó mở ra, và lý do các con nằm như thế. Người viết cần một hình dạng thì gõ
khoá — đó là toàn bộ quyết định bố cục.

Trang này **không** chép lại luật. Trang này ghi lại **cái máy nhìn thấy được**, và quan trọng hơn:
**cái máy không nhìn thấy**. Một luật không có luật máy giữ thì ai cũng biết là chưa có ai giữ. Một
luật máy giữ bị rò thì mọi người **tin là đã đóng** — đó mới là thứ nguy hiểm.

Ba điều mạnh nhất trong luật này **không phải luật máy giữ**: bảng từ vựng class và bảng từ vựng phần
tử là union đóng, và bản ghi khe con do trình biên dịch kiểm. Giá trị sai ở đó **không viết ra được**,
chứ không phải bị cấm. Mười luật dưới đây chỉ lo phần kiểu dữ liệu không thấy: **tệp nào** viết ra
chuỗi đó, khoá **có tồn tại** không, và **có ai vẽ** nó không.

## Bảng tra nhanh

| Luật máy giữ | Mã luật | Bắt gì |
|---|---|---|
| `no-literal-structural-class` | `CONTRACT-1` | Class cấu trúc viết thẳng ở nơi gọi, kể cả khi được nâng lên thành hằng số của mô-đun |
| `no-class-composition-outside-contract` | `CONTRACT-2` | Chuỗi class được ghép lúc chạy: gọi hàm ghép class, hoặc nội suy vào thuộc tính class |
| `only-the-frame-wears-a-node` | `CONTRACT-4` | Gọi `contractNodeProps` ở bất cứ đâu ngoài khung dựng |
| `contract-why-is-a-reason` | `CONTRACT-6` | Lý do ngắn dưới mười hai từ, hoặc lý do chỉ ghép lại các từ trong khoá |
| `no-structural-host-outside-contract-frame` | `CONTRACT-7` | Hộp trung tính viết tay, và phần tử ngữ nghĩa đeo class |
| `no-hand-written-contract-attrs` | `CONTRACT-8` | Thuộc tính dấu `data-node` / `data-why` viết tay |
| `no-duplicate-entry-shape` | `CONTRACT-9` | Hai mục trong bảng đánh vần cùng một hình dạng dưới hai cái tên |
| `no-unknown-contract-key` | *không mã nào* | Khoá không có trong bảng |
| `no-interaction-class-in-entry` | `CONTRACT-12` | Class trong mục là hành vi, là màu, hoặc là vật thể nổi — không phải cách sắp xếp |
| `no-dead-contract-key` | `CONTRACT-13` | Khoá nằm trong bảng mà không ai vẽ |

Chín trên mười ánh xạ được vào một mã. Một luật — `no-unknown-contract-key` — **không giữ mã nào**;
xem mục của nó và mục "Findings" trong `audit.md`.

---

## `no-literal-structural-class`

**Bắt gì.** Một token cấu trúc (`flex`, `grid`, `gap-4`, `items-center`, `col-span-2`, `absolute`…)
nằm trong một chuỗi class tĩnh, ở bất kỳ tệp nào bị quản. Và cùng token đó khi đã bị nâng lên thành
một hằng số chuỗi cấp mô-đun — vì nâng lên một dòng không biến quyết định thành hợp lệ, nó chỉ làm
quyết định **không ai nhìn thấy nữa**.

**Giữ mã nào.** `CONTRACT-1`. Đây là luật mà chín luật còn lại tồn tại để bảo vệ.

**Cách phát hiện.** Hai bộ thăm. `JSXAttribute` tên `className`/`class`, giá trị là `Literal` chuỗi
hoặc `JSXExpressionContainer` chứa `Literal` hoặc `TemplateLiteral` **không có lỗ**. Mỗi token bị cắt
hết phần trước dấu `:` cuối cùng và bỏ dấu `!` đầu, rồi đối chiếu một tập chín phần tử và một biểu
thức chính quy tiền tố. Bộ thăm thứ hai: `VariableDeclarator` có `id` là `Identifier` và `init` là
chuỗi tĩnh, quét token y hệt.

**Vì sao luật này đáng có máy giữ.** Vì khoảnh khắc một nơi gọi gõ được `flex gap-3`, cái cây bị
quyết định ở đúng bằng số nơi gọi, và không ai đọc bảng khoá mà đoán ra được hình dạng nữa. Kiểu dữ
liệu **không** chặn được chuyện này: `"flex gap-3"` là một `string` hợp lệ ở mọi nơi. Chỉ có luật máy
giữ mới trả lời được câu hỏi "**tệp nào** viết ra chuỗi này".

**Cửa còn mở.**

- Gom vào cấu trúc: `const CLASSES = { root: "flex flex-col gap-4" }` rồi `className={CLASSES.root}`.
  `init` là `ObjectExpression`, không phải `Literal` — cả hai bộ thăm đều mù. Đây **không phải** phá
  hoại, đây là một người đang dọn dẹp cho gọn.
- Mảng token rồi `.join(" ")`: literal nằm trong `ArrayExpression`, không nằm ở thuộc tính mà luật
  canh.
- Toán tử ba ngôi: `className={dense ? "flex gap-2" : "grid gap-4"}` **lọt cả hai** luật — luật này
  đòi chuỗi tĩnh, còn `no-class-composition-outside-contract` chỉ biết template và `+`.
- Trường tĩnh của lớp và tham số mặc định: `static root = "flex"` là `PropertyDefinition`, không phải
  `VariableDeclarator`.
- Thư mục `leaves/` được miễn **toàn bộ, mọi độ sâu**. Miễn theo **thư mục** nghĩa là ai cũng thoát
  được bằng cách dời tệp vào đó.
- Bốn thư mục nhánh bề mặt được miễn **toàn bộ**, kể cả tệp phụ nằm sâu bên trong.
- Danh sách token cấu trúc là **đóng**: `w-`, `h-`, `p-`, `m-`, `max-w-`, `block`, `hidden`,
  `mx-auto` không có trong đó.
- Bộ thăm hằng số bắn **mọi chuỗi trong tệp bị quản**, kể cả chuỗi không bao giờ là class — một câu
  tài liệu chứa chữ `gap-4` cũng bị báo.

---

## `no-class-composition-outside-contract`

**Bắt gì.** Một lời gọi tới tám cái tên quen thuộc chuyên ghép class, và một thuộc tính class được
dựng bằng nội suy hoặc bằng phép `+`.

**Giữ mã nào.** `CONTRACT-2`.

**Cách phát hiện.** `CallExpression` có callee là `Identifier` **trần** nằm trong tập
`cn`, `clsx`, `classnames`, `classNames`, `twMerge`, `twJoin`, `cva`, `tv` — báo ngay tại lời gọi, bất
kể nó trả về cái gì và được dùng ở đâu. Cộng thêm `JSXAttribute` class có biểu thức là
`TemplateLiteral` **có lỗ** hoặc `BinaryExpression` toán tử `+`.

**Vì sao luật này đáng có máy giữ.** Vì một chuỗi class ghép lúc chạy là **một bảng thứ hai không có
khoá**: không lý do, không tên, không ai đọc ngược lại được. Cái khác biệt mà nhánh đó đang rẽ là một
khác biệt **thật** — mà một khác biệt thật thì xứng đáng có một cái tên.

**Cửa còn mở.**

- `utils.cn(...)`: callee là `MemberExpression` → không bắt. Trớ trêu là
  `only-the-frame-wears-a-node` **có** xử `MemberExpression` — hai luật cùng nhà bất đồng về đúng
  một kiểu né.
- Đổi tên khi nhập: `import { cn as classes }` rồi `classes(...)`.
- Ghép bằng phương thức mảng: `[base, dense && "gap-2"].filter(Boolean).join(" ")`.
- Nội suy được nâng lên biến: ``const root = `flex ${gap}` `` rồi `className={root}` — bộ thăm nội
  suy chỉ đọc thuộc tính, còn bộ thăm hằng số bên luật kia đòi template **không lỗ**.
- `className={cond && "flex gap-2"}`: `LogicalExpression`, không luật nào ngó.

---

## `only-the-frame-wears-a-node`

**Bắt gì.** Mọi lời gọi `contractNodeProps` ở bất kỳ tệp nguồn nào không phải khung dựng.

**Giữ mã nào.** `CONTRACT-4`.

**Cách phát hiện.** `CallExpression` có callee là `Identifier` tên đó, **hoặc** `MemberExpression`
không tính toán mà thuộc tính mang tên đó. Không xét đối số, không xét kết quả.

**Vì sao luật này đáng có máy giữ.** Vì đây là hỏng hóc **không đỏ ở đâu cả**. Hàm đó trả về class và
các dấu, **không** trả về phần tử. Trải chúng lên một phần tử của thư viện là đặt hợp đồng của một
khoá lên phần tử **do tệp này chọn**: mục ghi `ol`, tài liệu nhận về `div`, danh sách rơi khỏi cây trợ
năng, không còn gì thông báo có bao nhiêu mục — mà khoá vẫn phân giải đúng, dấu vẫn đọc đúng, mọi cổng
vẫn xanh. Không có kiểu dữ liệu nào bắt được điều đó, vì kiểu dữ liệu **không biết** props này rồi sẽ
được trải lên đâu.

**Cửa còn mở.**

- Luật cấm **một cái tên**, không cấm **hành vi**: `CONTRACTS["key"].classes.join(" ")` rồi trải, tái
  tạo y nguyên hỏng hóc mà không nói tên nào.
- Truyền hàm mà không gọi: `useMemo(contractNodeProps, [])`, `list.map(contractNodeProps)`.
- Bí danh: `const wear = contractNodeProps` rồi `wear(...)`.
- Truy cập tính toán: `helpers["contractNodeProps"](x)` bị **bỏ qua có chủ ý** (callee tính toán).
- Tệp ngoài `/src/`.

---

## `contract-why-is-a-reason`

**Bắt gì.** Một `why` ngắn dưới mười hai từ, hoặc một `why` mà **mọi** từ đều lấy ra từ chính cái
khoá.

**Giữ mã nào.** `CONTRACT-6`.

**Cách phát hiện.** Chỉ chạy trong tệp bảng. `Property` có khoá đọc ra `why`, giá trị là `Literal`
chuỗi. Đếm từ; dưới mười hai thì báo `tooShort`. Ngược lại, chuẩn hoá từng từ về `a-z` và kiểm xem
**tất cả** có nằm trong tập từ tách theo dấu gạch của khoá không. Khoá được lấy bằng
`node.parent.parent`.

**Vì sao luật này đáng có máy giữ.** Vì lý do là thứ **duy nhất** không tái dựng lại được từ mã nguồn
về sau. Class đọc được, phần tử đọc được — còn chuyện "vì sao nút này tồn tại" thì mất là mất hẳn. Một
cái nhãn ("hàng chip") tốn một dòng và không dạy ai điều gì; một dữ kiện ("các thẻ xuống dòng trước
tiêu đề") là thứ đã sinh ra cái nút.

**Cửa còn mở.**

- Viết bằng dấu backtick: ``why: `...` `` không phải `Literal` → **tắt sạch** luật cho mục đó, kể cả
  sàn mười hai từ.
- Mười hai từ nước lã vẫn qua: chỉ có sàn **độ dài**, không có thước đo nội dung.
- Thông điệp `restates` gần như **không bao giờ bắn được**: nó đòi **mọi** từ đều thuộc khoá, trong
  khi sàn đã là mười hai từ — chỉ cần một từ ngoài khoá là thoát.
- Bảng tách làm nhiều tệp: luật chốt vào **một** tên tệp.
- Bắn vào **mọi** `why` trong tệp, kể cả `why` của một bảng khác hoặc một đối tượng lồng — trong khi
  hai luật cùng cấp lại đọc mục qua đúng lời gọi `buildContracts`. Ba luật cùng phạm vi, hai cách
  chốt phạm vi khác nhau.

---

## `no-structural-host-outside-contract-frame`

**Bắt gì.** Bảy hộp trung tính viết tay (`div`, `section`, `main`, `header`, `footer`, `aside`,
`nav`) — cấm vô điều kiện. Và bốn phần tử ngữ nghĩa (`ul`, `ol`, `li`, `form`) — chỉ cấm **khi chúng
đeo class**.

**Giữ mã nào.** `CONTRACT-7`.

**Cách phát hiện.** `JSXOpeningElement` có tên là `JSXIdentifier` viết thường. Thuộc tập trung tính
thì báo ngay. Thuộc tập ngữ nghĩa thì chỉ báo khi có ít nhất một `JSXAttribute` tên `className`/
`class`.

**Vì sao luật này đáng có máy giữ.** Vì một hộp trung tính viết tay là **một nút không khoá**: không
gì ghi nó phải mặc class nào, con nào được phép nằm trong, và vì sao nó ở đó. Còn ranh giới ngữ nghĩa
thì tinh hơn: một `form` tồn tại để gửi, một `ul` tồn tại vì nội dung của nó **là** một danh sách —
công nghệ trợ giúp đọc ra phần tử, nên không thay bằng hộp trung tính được. Bản trước cấm thẳng cả
bốn và đã báo sai ba cái bọc lương thiện chỉ mang một handler và không mang class nào.

**Cửa còn mở.**

- Mọi phần tử chứa khác **không** nằm trong mười một cái tên: `span`, `article`, `figure`, `label`,
  `fieldset`, `table`, `tr`, `td`, `dl`, `dd`. `<article className="rounded border p-4">` hoàn toàn
  hợp lệ với luật này.
- Class đi qua spread: `<ul {...listProps}>` — `JSXSpreadAttribute` không phải `JSXAttribute`.
- Tên thẻ gián tiếp: `const Tag = "div"` rồi `<Tag>`, hoặc `createElement("div", …)`.
- Bốn thư mục nhánh bề mặt và cả thư mục `leaves/` được miễn.
- Miễn khung dựng là miễn theo **thư mục**: gộp khung dựng thành một tệp phẳng bên cạnh anh em của
  nó, và khung dựng trở thành kẻ vi phạm chính luật nó hiện thực.

---

## `no-hand-written-contract-attrs`

**Bắt gì.** Thuộc tính `data-node` hoặc `data-why` viết tay ở bất kỳ tệp nguồn nào không phải khung
dựng và không phải tệp kiểm thử.

**Giữ mã nào.** `CONTRACT-8`.

**Cách phát hiện.** `JSXAttribute` có tên node là `JSXIdentifier` với văn bản đúng bằng một trong hai
chuỗi đó.

**Vì sao luật này đáng có máy giữ.** Vì một dấu viết tay **tệ hơn một nút không dấu**. Nút không dấu
thì ít nhất còn thành thật. Nút mang dấu viết tay tuyên bố một hợp đồng **không ai giữ**, và mọi bài
kiểm thử, mọi công cụ đi dọc theo các thuộc tính đó đều tin lời tuyên bố ấy.

**Cửa còn mở.**

- Spread: `<div {...{ "data-node": key }} />`.
- Không qua JSX: `element.setAttribute("data-node", key)`, hoặc gói vào một đối tượng props thường
  rồi truyền xuống.
- Tập chỉ có **hai** chuỗi: khung dựng thêm dấu thứ ba thì luật không biết.
- Tệp kiểm thử được miễn có chủ ý — nhưng một tệp fixture đặt tên không phải `.test`/`.spec` thì lại
  bị bắt.

---

## `no-unknown-contract-key`

**Bắt gì.** Một khoá không có trong bảng, kèm theo danh sách các khoá **có** trong bảng.

**Giữ mã nào.** **Không mã nào.** Mã nguồn xếp nó dưới `CONTRACT-9` và thông điệp của nó có nhắc
`CONTRACT-9` lẫn `CONTRACT-5` như lời khuyên — nhưng phép kiểm nó thực hiện là **phép thuộc tập**:
chuỗi này có xuất hiện làm khoá trong bảng không. Không mã đánh số nào phát biểu điều đó. `CONTRACT-9`
nói về việc **một khoá mới có xứng đáng ra đời không** — một phán đoán không luật máy nào cầm — và
luật thật sự giữ `CONTRACT-9` là `no-duplicate-entry-shape`. Ghi nhận là **finding**, không bịa ánh
xạ.

**Cách phát hiện.** `JSXOpeningElement` có tên đúng bằng `Tree`, đọc thuộc tính `contract` tĩnh; và
`CallExpression` trên `Identifier` trần `contractSpec` với đối số đầu là chuỗi. Danh sách khoá đọc từ
đĩa: đi ngược thư mục tối đa bốn mươi bậc, thử ba đường dẫn tương đối, cắt lời gọi `buildContracts({`
theo **cân bằng ngoặc**, rồi bắt khoá bằng `/^\s{4}"([a-z][a-z-]*)":\s*\{/gm`.

**Vì sao luật này đáng có máy giữ.** Vì một khoá gõ sai không mô tả class nào, phần tử nào, lý do
nào — mà nó **vẫn dịch được**. Và vì thông điệp liệt kê ra các khoá đang có, nó là chỗ duy nhất một
người mới học được bảng từ vựng ngay tại chỗ mình gõ sai.

**Cửa còn mở.**

- **Bốn trên năm dạng tham chiếu không được kiểm.** `defineContractComponent("sai-khoa")`,
  `defineContractProjection("sai-khoa")`, `CONTRACTS["sai-khoa"]` và `contract: "sai-khoa"` đều là
  những dạng mà `no-dead-contract-key` **đếm là tham chiếu**, nhưng luật này **không** kiểm dạng nào
  trong đó. Hai luật cùng nhà bất đồng về việc "gọi tên một khoá" trông ra sao.
- Khoá động: `contract={key}`, `contract={ok ? "a" : "b"}`.
- Đổi tên khung dựng khi nhập, hoặc gọi qua `<Contract.Tree>`.
- `x.contractSpec("…")`: callee là `MemberExpression` → không bắt.
- **Định dạng lại bảng là tắt luật.** Biểu thức chính quy đòi **đúng bốn** ký tự trắng đầu dòng. Đổi
  sang thụt hai dấu cách thì danh sách khoá rỗng, bộ đọc trả `null`, và luật **tắt trong im lặng**.
- **Khoá có chữ số bị báo sai.** Mẫu khoá là `[a-z][a-z-]*` — không có `0-9`. Một khoá như
  `grid-2-up` không lọt vào danh sách, nên **mọi** chỗ dùng đúng nó đều bị báo là khoá lạ.

---

## `no-duplicate-entry-shape`

**Bắt gì.** Một mục đánh vần đúng cái hình dạng mà một mục khác đã đánh vần: cùng bộ class (không kể
thứ tự), cùng `host`, cùng các khe mang cùng thứ.

**Giữ mã nào.** `CONTRACT-9`.

**Cách phát hiện.** Đọc mục từ đối số đầu của `buildContracts`. Mỗi mục rút về một chuỗi so sánh:
class **sắp xếp** như một đa tập, `host` literal, và từng khe theo tên với danh tính khai báo
(`contract` / `composite` / `leaf`, các phương án được khử trùng và sắp xếp) cùng hai cờ `optional`,
`repeats`. **Cố ý bỏ ra ngoài**: tên khoá, `why`, `restingCount`, và `props` của khe.

**Vì sao luật này đáng có máy giữ.** Vì bảng từ vựng nở ra **từng nơi gọi một**. Một `restingCount`
khác không phải một hình dạng khác; một cái tên khác cũng không. Đây chính là chỗ `CONTRACT-9` được
cầm bằng máy: không phán xét "khoá mới này có đáng không", mà phát biểu chính xác **khi nào hai khoá
là một khoá**.

**Cửa còn mở.**

- Một `SpreadElement` trong mục — `{ ...shared, classes: [...] }` — làm `propertyName` trả `null`,
  mục bị **bỏ qua** chứ không bị báo. Một dấu ba chấm giấu được bản sao vĩnh viễn.
- `classes: STACK` (hằng số thay vì mảng literal): cũng bị bỏ qua.
- Hai bảng, hai lời gọi `buildContracts`: mỗi lời gọi dựng bản đồ riêng, không so nhau.
- Bỏ `props` của khe ra ngoài nghĩa là hai khe khác nhau ràng buộc literal vẫn bị coi là **cùng hình
  dạng** — đúng ý đồ đã ghi, nhưng đó là một hướng báo thừa.

---

## `no-interaction-class-in-entry`

**Bắt gì.** Ba họ class mà một mục **không được** giữ: hành vi (`cursor-`, `group`, `hover:`,
`active:`, `focus:`, `disabled:`…), màu của một giá trị (sáu tên màu chữ, `decoration-`, `underline`),
và vật thể nổi (`bg-surface*`, `shadow*`).

**Giữ mã nào.** `CONTRACT-12`.

**Cách phát hiện.** Đọc mục từ `buildContracts`, duyệt từng phần tử literal của mảng `classes`/
`classNames`, đối chiếu **chuỗi thô** với ba biểu thức chính quy. Một nền được tha khi cùng mảng đó có
`w-full` **và** `border-b` hoặc `border-t` — nghĩa là mục được viết như một **dải chạy hết bề ngang và
tự kẻ ranh giới**, thứ duy nhất được phép có nền.

**Vì sao luật này đáng có máy giữ.** Vì một nút mang `cursor-pointer` đang **hứa** rằng nó bấm được,
trong khi thứ thật sự bấm được — cái nút, cái liên kết, thứ giữ handler và trạng thái vô hiệu — nằm ở
chỗ khác. Hai chủ cho một lời hứa, và cái bảng là bên **không thể được báo** rằng lời hứa đã tắt. Nền
cộng độ nổi thì thành một **vật thể**, mà vật thể đã có chủ: nhánh bề mặt vẽ nó. Vẽ hai lần thì không
ai đọc ngược lại được.

**Cửa còn mở.**

- **Không cắt biến thể.** Ba biểu thức đối chiếu chuỗi **thô**, khác hẳn
  `no-literal-structural-class` vốn có cắt. Nên `md:cursor-pointer`, `lg:bg-surface`,
  `dark:shadow-md`, `!bg-surface`, `group-hover:opacity-80` **đi thẳng vào bảng**.
- Họ nền và họ nổi chỉ có hai tiền tố: `bg-white`, `bg-card`, `bg-neutral-50`, `drop-shadow-lg`,
  `ring-1` đều hợp lệ.
- Họ màu chỉ có **sáu tên chính xác**: `text-primary`, `text-red-500` hợp lệ.
- Ngoại lệ dải là một **mật khẩu hai token**: thêm `w-full` và `border-b` là mở được nền.
- Phần tử class không phải literal thì bỏ qua.

---

## `no-dead-contract-key`

**Bắt gì.** Một khoá nằm trong bảng mà **không tệp nào được đi qua** gọi tên, và **không khe con nào**
của mục khác khai báo.

**Giữ mã nào.** `CONTRACT-13`.

**Cách phát hiện.** Đi bộ trên hệ tệp. Gốc kho được suy ra từ đường dẫn bảng theo hậu tố **dài
nhất**, rồi duyệt các gốc thành phần cộng **mọi** `apps/*/src` và `packages/*/src`, bỏ qua
`node_modules`, `.next`, `dist`, `.artifacts`, đọc sáu phần mở rộng mã nguồn. Năm mẫu tham chiếu chạy
trên văn bản từng tệp; **thêm vào đó**, trong bất kỳ tệp nào có chữ `ContractKey`, **mọi** literal
thường có gạch nối đều được tính là tham chiếu. Khoá do khe `children.*.contract` khai báo được gom
riêng trước khi báo cáo.

**Vì sao luật này đáng có máy giữ.** Vì một khoá không ai vẽ là **một lời hứa về một cái không tồn
tại**, và nó không nằm yên: nó sống sót qua mọi lần đổi tên (đổi tên đi theo nơi gọi, mà nó không có
nơi gọi nào), nó theo cả bảng đi sang kho tiếp theo, và nó làm cái bảng dài hơn phần mã đọc nó — tới
lúc muốn biết một khoá tả màn hình thật hay tả ý định thì phải đi tìm trong nguồn.

**Cửa còn mở.**

- Khoá chỉ được gọi tên trong `.md`, `.mdx`, `.json` hoặc bất kỳ phần mở rộng nào ngoài sáu cái được
  duyệt → **báo chết oan**, và finding tới dưới dạng lệnh xoá.
- Khoá dựng động: ``contract={`row-${size}`}`` trong một tệp không nhắc `ContractKey` → báo chết oan
  trong khi nó vẽ ở mọi lần tải.
- Chiều ngược lại: mẫu `contract: "…"` khớp **mọi** thuộc tính tên `contract` ở mọi tệp. Một dòng dữ
  liệu nghiệp vụ như `{ contract: "full-time" }` giữ sống một khoá đã chết.
- Sự hào phóng theo `ContractKey`: một tệp có nhắc tên kiểu đó biến **mọi** literal có gạch nối trong
  nó thành tham chiếu — kể cả một bảng dịch.
- Khoá chỉ được nhắc **trong chính tệp bảng** (ngoài khe con) → báo chết, vì tệp bảng là tệp duy nhất
  bị bỏ qua khi đi bộ.

---

## Luật

1. Một luật máy giữ **không đọc được thứ nó cần** thì **im lặng**. Không bảng, bảng không phân tích
   được, cây không đi được — tất cả đều ra **không finding nào**, không bao giờ ra một finding chống
   lại mọi nơi gọi.
2. Ba gốc bố cục là **một danh sách**. Luật nào viết tiền tố bằng tay là luật sai câm ở bố cục kia,
   sai theo cả hai chiều cùng lúc.
3. Phân tích bằng văn bản là **cố ý**: một luật ESLint chạy dưới một bộ phân tích, trên một tệp, và
   không nhập được một mô-đun TypeScript.
4. Khung dựng là **miễn trừ duy nhất** cho việc đeo một nút. Tệp kiểm thử **không** phải miễn trừ thứ
   hai.
5. Luật cấp mục đọc mục từ đúng lời gọi `buildContracts`, không đọc mọi đối tượng trong tệp — để một
   bảng thứ hai không báo bảng thứ nhất.
6. Một cặp trùng hình dạng chỉ báo **một lần**, trên mục **sau**.

## Ngoại lệ

Mọi miễn trừ ở đây đều là **một thư mục hoặc một phép thử tên tệp**. Điều đó biến từng cái thành ranh
giới chính sách mà ai cũng bước qua được bằng cách **dời một tệp**.

- **Tầng lá.** Mọi tệp dưới thư mục `leaves/` tự viết class và tự mở hộp. Thứ giữ một thành phần ở
  ngoài là **một câu hỏi do người đặt** — tệp này có sắp xếp hai nội dung không — và **không cổng nào
  hỏi câu đó**.
- **Khung dựng.** Mọi tệp dưới `branches/Tree/` được mở host và sơn dấu. Miễn theo thư mục.
- **Bốn nhánh bề mặt có tên.** `SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard`,
  `SurfaceFormCard` được miễn hai luật để tự sở hữu lớp bọc cố định của mình. Nhánh bề mặt **thứ năm**
  không được miễn gì cả.
- **Tệp kiểm thử.** Tên khớp `.test.` / `.spec.` nằm ngoài tập bị quản của ba luật, vì một bài kiểm
  thử song sinh được phép dựng fixture bằng tay. Chúng **vẫn** nằm trong
  `only-the-frame-wears-a-node`.
- **Bản ghi kế hoạch.** Chỉ `no-dead-contract-key` bỏ qua đường dẫn chứa `.artifacts`. Ba luật cấp
  bảng còn lại **vẫn soi** bản sao từ vựng của một phương án thiết kế như thể nó đang chạy thật.
