---
title: Translation · Vietnamese
---

# Chữ nghĩa

Đầu vào là mã đã viết xong — một tệp, một mảnh diff. Đầu ra là một **phán quyết**: tệp đó có nằm trong
cổng thư mục hay không, luật máy nào đã nổ, nó báo cái gì và trên node nào, việc đó ứng với mã luật
nào, và cửa còn mở nào có thể đã che đúng cái lỗi ấy. Mô-đun này không chọn chữ cho ai. Nó từ chối một
cách viết, và nó phải chỉ được ra đúng chuỗi mà nó từ chối.

## Luật

Chữ là dữ liệu. Nửa có kết nối tra chữ rồi trao xuống thứ đã quyết xong, nên không thành phần nào dưới
block tự nói một chữ nào của riêng nó. Luật mang các mã có tiền tố `COPY-`.

Trang này ghi một thứ hẹp hơn và hữu ích hơn lúc review: **phần nào của luật đó một lần build thật sự
có thể trượt, và phần nào thì không.** Một điều luật không có luật máy thì ai cũng biết là chưa được
giữ. Một luật máy bị tin là kín trong khi nó đang rò mới là thứ nguy hiểm, vì không ai còn đi kiểm nữa.

Luật nêu sáu mã. **Hai luật máy được công bố. Bốn trong sáu mã không có luật máy nào cả.**

## Luật máy đã xuất bản

| Luật máy | Mã luật | Nó báo cái gì |
|---|---|---|
| `no-copy-resolution-below-block` | `COPY-1` | Thông điệp `resolves`, một lần cho mỗi lời gọi khớp, đặt trên cả `CallExpression`, nêu tên định danh được gọi |
| `no-hardcoded-copy-in-vocabulary` | `COPY-2` | Thông điệp `hardcoded` trên một thuộc tính được canh, nêu tên thuộc tính và chuỗi chữ; thông điệp `text` trên chữ hiển thị trong thẻ, nêu chuỗi chữ |

`COPY-3` (khoá không bao giờ vượt qua ranh giới), `COPY-4` (chuỗi đã tra xong vẫn tuân hàng rào dữ
liệu), `COPY-5` (từ điển không phải mã nguồn) và `COPY-6` (giá trị mà chương trình đem ra so khớp không
phải chữ nghĩa) **không có luật máy nào trong tệp nguồn**. `COPY-5` được thoả mãn bằng cấu trúc — nội
dung từ điển không nằm trong bốn thư mục được canh — còn `COPY-3`, `COPY-4` và `COPY-6` là luật chưa
được giữ, chứ không phải luật đã được phủ. `COPY-3` là cái đắt nhất: một prop tên `labelKey` mang giá
trị `"quest.title"` chỉ là một token chữ thường không có dấu cách, đúng thứ mà cả hai luật máy đều
không nhìn tới.

Cả hai luật ship trong `@starci/eslint-canon-fe` dưới tiền tố `starci-fe/`, cả hai đều
`type: "problem"`, và cả hai đều là `error` trong tập `recommended` được xuất ra.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ khác, và ghi lại phạm vi đó.** Ngoài phạm vi ở đây không có nghĩa là
   tệp đã sạch — nó có nghĩa là cổng thư mục trả về một đối tượng visitor rỗng và cả hai luật đều không
   tồn tại đối với tệp ấy.
2. **Cổng chính là đường dẫn.** Tệp phải chứa `/src/components/<dir>/` với `<dir>` thuộc `leaves`,
   `shells`, `composites`, `branches`. Bất cứ thứ gì khác — một tên thư mục tầng khác, một gốc khác, một
   đường dẫn tương đối — đều tắt cả hai luật cùng một lúc.
3. **Kiểm các ngoại lệ.** Nội dung từ điển được miễn bằng cấu trúc chứ không bằng phán đoán; không có
   danh sách cho phép nào cấu hình được, vì cả hai luật khai `schema: []`.
4. **Đọc các node.** Với `COPY-1` là mọi `CallExpression` có callee là `Identifier` trần. Với `COPY-2`
   là mọi `JSXAttribute` thuộc tập năm tên và mọi `JSXText`.
5. **Xuất một khối cho mỗi phát hiện**, nêu rõ node và phép thử đã nổ.
6. **Viết dòng `hatch` mỗi khi có một cửa còn mở dính vào** — kể cả trên một tệp không báo gì, nơi sự im
   lặng chính là cái cửa đó chứ không phải sự tuân thủ.
7. **Không báo cái mà không luật máy nào canh.** Bốn trong sáu mã không có máy; một phán quyết nói khác
   đi là hiểu sai mô-đun này.

## `no-copy-resolution-below-block` — COPY-1

**Nó báo cái gì.** Thông điệp `resolves`, một lần cho mỗi lời gọi khớp, đặt trên cả `CallExpression`,
nêu tên định danh được gọi.

**Nó phát hiện bằng gì.** Cổng thư mục trước đã. Sau đó nó thăm mọi `CallExpression`, bắt buộc
`callee.type === "Identifier"` và `callee.name` khớp
`/^(?:useTranslations|useLocale|useFormatter|getTranslations)$/`, rồi báo trên node lời gọi. Gọi ở đâu
trong một tệp đã qua cổng cũng bị bắt: trong thân thành phần, ở cấp mô-đun, trong một callback, trong
một hàm phụ nằm cùng tệp.

**Nó không thấy gì.** Không đọc đường dẫn import, không kiểm module specifier, không phân giải binding —
luật khớp **cách viết**, không khớp **ký hiệu**. Đổi tên khi import,
`import { useTranslations as useCopy }`, thì tên không còn khớp. Gọi dạng thuộc tính,
`i18n.useTranslations()`, có callee là `MemberExpression` nên bị loại trước cả bước so tên. Gán rồi gọi,
`const t = useTranslations; t()`, thì lời gọi mang tên khác. Bất kỳ tên tra chữ nào ngoài bốn tên đó —
`useI18n`, `useMessages`, `useT`, `getLocale`, `useNow`, `useTimeZone`, hay một hàm bọc của chính dự án
tên `useCopy()` — đều lọt vì đây là tập đóng: một hàm bọc cách đó một tệp vẫn kéo nguyên cái runtime ấy
vào mà không báo gì. Và chuyển lời gọi sang một tệp **ngoài** bốn thư mục rồi import ngược vào thì phụ
thuộc vẫn còn y nguyên, báo cáo thì không có.

**Ranh giới.** Luật này xử các lời gọi. Còn một chuỗi đứng sẵn trong markup có phải chữ nghĩa hay không
là việc của `COPY-2`.

## `no-hardcoded-copy-in-vocabulary` — COPY-2

**Nó báo cái gì.** Thông điệp `hardcoded` trên một thuộc tính được canh, nêu tên thuộc tính và chuỗi
chữ; thông điệp `text` trên chữ hiển thị trong thẻ, nêu chuỗi chữ.

**Nó phát hiện bằng gì.** Cùng cổng thư mục đó, rồi hai visitor. `JSXAttribute`: tên thuộc tính phải là
`JSXIdentifier` và nằm trong tập `aria-label`, `placeholder`, `title`, `alt`, `aria-description`; giá
trị phải là `Literal` chuỗi, hoặc `JSXExpressionContainer` có `expression.type === "Literal"` là chuỗi —
mọi dạng khác trả `null`. `JSXText`: lấy `node.value`, ép chuỗi, `trim()`. Cả hai visitor đi qua đúng
một phép thử: chuỗi có khoảng trắng (`/\s/`) **và** bắt đầu bằng một chữ hoa ASCII (`/^[A-Z]/`). Phép
thử cố tình thô, đúng như chú thích trong nguồn: một phép thử hay cãi xem thế nào mới là câu là phép thử
không ai tin.

**Nó không thấy gì.** Túi prop của nhà, `<Input props={{ placeholder: "Search courses" }} />` — thuộc
tính tên là `props`, và chuỗi nằm trong một `ObjectExpression` mà không visitor nào bước vào. Hằng số
giặt sạch chuỗi, `const PLACEHOLDER = "Search courses"` rồi `placeholder={PLACEHOLDER}`. Mọi thứ không
phải `Literal` trần trong ngoặc nhọn — template literal, phép nối chuỗi, toán tử ba ngôi, lời gọi hàm.
Chữ nằm trong ngoặc nhọn giữa thẻ, `<span>{"Search courses"}</span>`, không phải `JSXText` mà cũng không
phải `JSXAttribute`. Câu bị chen một biểu thức, `<span>Search {count} courses</span>`, vỡ thành
`"Search"` và `"courses"`. Chữ một từ — `Submit`, `Close`, `Avatar` — không có dấu cách. Chữ không mở
đầu bằng chữ hoa ASCII, `aria-label="close dialog"`, và mọi câu mở đầu bằng `Đ`, `Ê`, `Ô`, `Ơ`, `Ư`,
`Á`, `Ổ`: luật sinh ra để bảo vệ người đọc ngôn ngữ khác lại mù trước chính chữ viết bằng ngôn ngữ ấy.
Mọi thuộc tính ngoài năm cái — `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, `label`,
`description`, `emptyMessage`, `errorMessage`, `tooltip`. Spread,
`<Input {...{ placeholder: "Search courses" }} />`, là `JSXSpreadAttribute`, khác node. Mảng và đối
tượng, `const TABS = ["Overview", "Recent activity"]`, rồi map ra markup sau.

**Ranh giới.** Luật này xử những chuỗi đứng trong markup. Một lời gọi đi lấy chuỗi là `COPY-1`; một khoá
vượt qua ranh giới là `COPY-3`, và `COPY-3` không có luật máy.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng thư mục, cả hai luật | Chạy một lần trong `create`. Lấy `context.filename` (thiếu thì `context.getFilename()`), ép bằng `String()`, đổi mọi `\` thành `/`, rồi kiểm chuỗi con `/src/components/<dir>/` với `<dir>` thuộc `leaves`, `shells`, `composites`, `branches` |
| ngoài phạm vi | Tệp không qua cổng nhận một đối tượng visitor rỗng — luật không cài gì và không thể báo lỗi. Nó không tốn gì và cũng không thấy gì |
| chuẩn hoá dấu phân cách | Cổng đổi `\` thành `/` trước khi kiểm chuỗi con, nên một đường dẫn Windows cũng quyết định y hệt |
| khớp tên hàm tra chữ | `CallExpression` với `callee.type === "Identifier"`, tên kiểm theo `/^(?:useTranslations|useLocale|useFormatter|getTranslations)$/` |
| bộ đọc thuộc tính | `attributeText`: `Literal` chuỗi, hoặc `JSXExpressionContainer` có `expression.type === "Literal"` là chuỗi; mọi dạng khác là `null` |
| phép thử "trông như câu" | `/\s/` **và** `/^[A-Z]/`, dùng chung cho visitor `JSXAttribute` và `JSXText` |
| ngoài tệp đang lint | Không gì cả. Không thông tin kiểu, không phân giải import, không phân tích liên tệp, không biết một ký hiệu trỏ tới đâu |

## Lối thoát hợp lệ

**Đã đóng** — người đọc tưởng những cách viết này lọt, nhưng không.

| Viết kiểu này | Vì sao vẫn nổ |
|---|---|
| `placeholder={"Search courses"}` — bọc chuỗi trong ngoặc nhọn | `attributeText` mở `JSXExpressionContainer` có expression là `Literal`. Cặp ngoặc không mua được gì |
| Chữ trải qua ba dòng nguồn kèm thụt lề | `JSXText` được `trim()` trước khi chạy phép thử, nên khoảng trắng đầu cuối không nguỵ trang được |
| Thành phần viết trên Windows nên đường dẫn có dấu gạch ngược | Cổng đổi `\` thành `/` trước khi kiểm chuỗi con. Cổng thư mục không phụ thuộc hệ điều hành |
| Đổi tên kết quả — `const tr = useTranslations()` | Luật khớp **callee**, không khớp biến hứng kết quả |
| Tra chữ ngoài thân thành phần — ở cấp mô-đun, trong callback, trong hàm phụ cùng tệp | Visitor là `CallExpression` và không có điều kiện về hàm bao ngoài. Ở đâu trong tệp đã qua cổng cũng nổ |
| Chữ nằm trong tệp phụ đặt bên trong một trong bốn thư mục | Cổng tính theo **đường dẫn tệp**, không theo thành phần. Một `hooks.ts` nằm cạnh thành phần cũng bị canh |
| Thư mục lồng rất sâu — `.../src/components/leaves/a/b/c/component.tsx` | Đây là phép kiểm chuỗi con, không phải phép kiểm độ sâu |

**Còn mở** — chỗ mù đã ship. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Phạm vi | Cái gì lọt |
|---|---|
| `no-hardcoded-copy-in-vocabulary` | **Túi prop của nhà.** `<Input props={{ placeholder: "Search courses" }} />` — `props` không nằm trong tập được canh và `ObjectExpression` không bao giờ được soi. Đây đúng là hình dạng mà ví dụ phản diện của luật được viết ra |
| `no-hardcoded-copy-in-vocabulary` | **Hằng số giặt sạch chuỗi.** `const PLACEHOLDER = "Search courses"` rồi `placeholder={PLACEHOLDER}`. Không ai cần ác ý — đây là hình dạng của việc dọn dẹp cho gọn |
| `no-hardcoded-copy-in-vocabulary` | **Mọi thứ không phải `Literal` trần trong ngoặc nhọn** — template literal, nối chuỗi, ba ngôi, lời gọi: `attributeText` trả `null` |
| `no-hardcoded-copy-in-vocabulary` | **Chữ trong ngoặc nhọn giữa thẻ.** `<span>{"Search courses"}</span>` không thuộc node nào trong hai loại |
| `no-hardcoded-copy-in-vocabulary` | **Câu bị chen một biểu thức.** `<span>Search {count} courses</span>` — chen một giá trị là hoà tan cả câu thành hai token |
| `no-hardcoded-copy-in-vocabulary` | **Chữ một từ.** `<span>Submit</span>`, `aria-label="Close"`, `alt="Avatar"`. Người đọc ngôn ngữ khác vẫn thấy y nguyên từng cái một |
| `no-hardcoded-copy-in-vocabulary` | **Chữ không mở đầu bằng chữ hoa ASCII.** `aria-label="close dialog"`, và mọi câu mở đầu bằng `Đ`, `Ê`, `Ô`, `Ơ`, `Ư`, `Á`, `Ổ` |
| `no-hardcoded-copy-in-vocabulary` | **Mọi thuộc tính ngoài năm cái**, và **spread**, và **mảng, đối tượng** rồi map ra markup |
| `no-copy-resolution-below-block` | **Đổi tên khi import hoặc gọi dạng thuộc tính**, và **mọi tên tra chữ ngoài bốn tên** — luật khớp cách viết, không khớp ký hiệu đứng sau nó |
| cả hai | **Cổng thư mục và tên tệp.** Thư mục tầng đặt tên `leaf/`, `atoms/`, `overlays/`, `pages/`, hay thành phần nằm ở `ui/leaves/`. Tên thư mục là thứ rẻ nhất trong một kho mã để thay đổi, và một thư mục tầng mới là một lỗ hổng im lặng chứ không phải một lần build đỏ |
| cả hai | **Đường dẫn tương đối.** Lint bằng chương trình, hoặc đẩy stdin với `--stdin-filename` tương đối, cho ra `components/leaves/…` không có dấu gạch đứng đầu; cổng kiểm `/src/components/leaves/`, cả hai luật cùng tắt, và lần chạy đó xanh vì lý do sai |
| cả hai | **Dời lời gọi ra ngoài một tệp.** Một hook ở `hooks/` gọi runtime rồi được một leaf import: phụ thuộc mà luật sinh ra để chặn vẫn còn nguyên, còn lời gọi thì không nằm trong tệp đã qua cổng |
| không luật nào | **Mọi thứ `COPY-3`, `COPY-4` và `COPY-6` cấm** — một khoá vượt ranh giới, một chuỗi đã tra xong phá hàng rào dữ liệu, một giá trị đem ra so khớp bị coi là chữ nghĩa |

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| đường dẫn tệp | `context.filename`, hoặc `context.getFilename()` khi không có cái trước, với `\` đã đổi thành `/`. Chỉ dùng cho cổng thư mục |
| quyết định phạm vi | Chuỗi con thư mục nào trong bốn cái đã khớp, hoặc không cái nào khớp |
| cây cú pháp | AST của đúng một tệp: các node `CallExpression`, `JSXAttribute`, `JSXText` |
| tên hàm được gọi | Mọi callee là `Identifier` trần trong tệp |
| giá trị thuộc tính | Tên thuộc tính và chuỗi mà `attributeText` lấy ra, hoặc `null` |
| chữ trong thẻ | `node.value` của từng `JSXText`, đã ép chuỗi và `trim()` |
| tuỳ chọn | Không có. Cả hai khai `schema: []`, nên không nới được danh sách thư mục hay danh sách tên hàm ở nơi dùng |
| kiểu | Không có. Không thông tin kiểu, không phân giải import, không phân tích liên tệp |

## Quy tắc

1. Danh tính của một luật máy là **tên đã công bố**. Tên trong log build, trong dòng tắt luật và trong
   tài liệu này là cùng một chuỗi; đặt thêm một mã số thứ hai là tạo ra hai tên cho một thứ.
2. Cổng thư mục chạy trong `create`. Ngoài bốn thư mục, các luật không cài visitor nào, nên ngoài phạm
   vi nghĩa là luật không tồn tại với tệp đó, chứ không phải tệp đó đã sạch.
3. Chỉ ghi ở đây những luật **có thật** trong tệp nguồn. Luật đáng có mà chưa có là một rủi ro còn mở,
   không phải một luật đã xuất bản.
4. Không luật nào tự sửa mã. Mỗi báo cáo là một việc thật: nhấc chuỗi lên nửa có kết nối và đặt cho nó
   một khoá, chứ không xoá đi.
5. Mọi báo cáo đều là `error` trong `recommended`; không có tầng khuyến nghị nào.
6. Cả hai luật khớp **văn bản** — một chuỗi con thư mục, một cách viết tên hàm, một lớp ký tự. Không
   luật nào phân giải binding, nên mọi lần đổi tên đều thắng chúng và mọi bí danh đều trốn được.
7. Mỗi luật máy phải có ít nhất một dòng cửa còn mở trung thực, hoặc một lập luận vì sao nó kín. Viết
   "không có" cho gọn là hỏng cả mục đích của kệ tài liệu này.

## Ngoại lệ

- **Nội dung từ điển** được miễn bằng **cấu trúc**, không bằng phán đoán: nó không nằm trong bốn thư mục
  được canh, nên không cổng nào phải quyết định gì về nó. Nó giải phóng `COPY-5`, và chỉ bằng cấu trúc.
- **Giá trị mà chương trình đem ra so khớp** (`COPY-6`) không có dấu hiệu nào máy đọc được. Luật yêu cầu
  đánh dấu lý do trên dòng đó, nhưng luật máy không đọc chú thích — thứ thật sự làm im báo cáo là một
  chỉ thị tắt luật, và chỉ thị đó không bắt ai phải nêu lý do. Dấu của luật và cái khoá miệng của máy là
  hai thứ khác nhau.
- **Không có ngoại lệ nội tuyến cho bất cứ thứ gì khác.** Với `schema: []` thì không có danh sách cho
  phép, nên kho mã nào không đồng ý thì sửa gói, không sửa cấu hình.

## Đầu ra

Một lần chạy xuất một dòng cho mỗi báo cáo, mang theo tên luật đã công bố:

```text
<file>:<line>:<col>  error  <message>  starci-fe/no-copy-resolution-below-block
<file>:<line>:<col>  error  <message>  starci-fe/no-hardcoded-copy-in-vocabulary
```

Một phán quyết là một khối cho mỗi phát hiện:

```text
file:   <path as the rule sees it, forward slashes>
scope:  <in | out — the folder substring that decided it>
rule:   <published name>
sees:   <the node and the predicate that fired, or would have>
misses: <the open hatch that applies to the code under review>
```

Một tệp sạch nằm trong cổng xuất một khối với `sees: nothing fired` và một dòng `misses:` nêu cái cửa
còn mở dính vào nó. Một tệp ngoài cổng xuất một khối với `scope: out`, `rule: none` và
`sees: no visitor installed — unjudged, not clean`.

## Ví dụ đã giải

**Đầu vào.** `components/leaves/SearchField/component.tsx`:

```tsx
import {useTranslations} from "next-intl"

export function SearchField() {
  const t = useTranslations("search")
  return (
    <div>
      <input placeholder="Search courses" aria-label="Search courses" />
      <span>Search courses now</span>
      <button aria-label="Close">{t("submit")}</button>
    </div>
  )
}
```

Đường dẫn chứa `/src/components/leaves/`, nên cổng mở và cả hai luật đều cài visitor.

```text
file:   src/components/leaves/SearchField/component.tsx
scope:  in — /src/components/leaves/
rule:   no-copy-resolution-below-block
sees:   CallExpression, Identifier callee useTranslations, matches the four-name regex
misses: an alias or a wrapper one file away would have made the same dependency invisible
```

```text
file:   src/components/leaves/SearchField/component.tsx
scope:  in — /src/components/leaves/
rule:   no-hardcoded-copy-in-vocabulary
sees:   JSXAttribute placeholder, string Literal "Search courses", whitespace and ASCII capital
misses: the same string inside props={{ placeholder: "Search courses" }} is never inspected
```

```text
file:   src/components/leaves/SearchField/component.tsx
scope:  in — /src/components/leaves/
rule:   no-hardcoded-copy-in-vocabulary
sees:   JSXAttribute aria-label, string Literal "Search courses", whitespace and ASCII capital
misses: aria-label="close dialog" would pass the same visitor on the capital test alone
```

```text
file:   src/components/leaves/SearchField/component.tsx
scope:  in — /src/components/leaves/
rule:   no-hardcoded-copy-in-vocabulary
sees:   JSXText "Search courses now" after trim, whitespace and ASCII capital
misses: <span>Search {count} courses</span> splits into two tokens and reports nothing
```

`aria-label="Close"` không bao giờ bị báo. Nó chỉ có một từ nên trượt nửa "có khoảng trắng" của phép
thử — trong khi người đọc ngôn ngữ khác vẫn thấy nguyên chữ `Close`.

**Đã sửa.** Chữ do nửa có kết nối tra xong rồi mới trao xuống:

```tsx
export function SearchField({placeholder, searchLabel, heading, closeLabel, submitText}) {
  return (
    <div>
      <input placeholder={placeholder} aria-label={searchLabel} />
      <span>{heading}</span>
      <button aria-label={closeLabel}>{submitText}</button>
    </div>
  )
}
```

Nhưng một cửa còn mở vẫn sống sót qua lần sửa này. Một leaf anh em viết theo túi prop của nhà thì không
báo gì cả:

```tsx
// src/components/leaves/SearchInput/component.tsx
<Input props={{ placeholder: "Search courses" }} />
```

```text
file:   src/components/leaves/SearchInput/component.tsx
scope:  in — /src/components/leaves/
rule:   no-hardcoded-copy-in-vocabulary
sees:   nothing fired
misses: the attribute is named props, the literal sits in an ObjectExpression, and no visitor steps
        into it — the silence is blindness, not compliance
```

## Phạm vi

Mô-đun này chỉ ghi phần thực thi, không ghi bản thân luật. Nó không nêu tên sản phẩm, thư viện thành
phần hay kho mã nào; danh từ riêng duy nhất là các định danh đã công bố — tên luật máy, gói mà chúng
ship trong đó, và những chuỗi mà các luật đem ra khớp. Một khoá vượt ranh giới (`COPY-3`), một chuỗi đã
tra xong phá hàng rào dữ liệu (`COPY-4`), từ điển bị coi là mã nguồn (`COPY-5`) và một giá trị đem ra so
khớp bị coi là chữ nghĩa (`COPY-6`) thuộc về mô-đun pattern nêu luật; không máy nào ở đây xử chúng.
