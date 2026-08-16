---
id: fe-lints-translation-vi
title: vi.md
slug: /gates/lints/translation/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai luật máy giữ được của luật chữ nghĩa — bắt gì, phát hiện bằng gì, và cửa nào còn mở.
---

# vi.md

> Phiên bản: `2.00`

Mô-đun: `translation`. Nguồn sự thật là
[`sources/fe/translation.mjs`](../../../../sources/fe/translation.mjs); luật nằm ở
[`canon/patterns/translation.md`](../../../canon/patterns/translation.md).

Trang này không chép lại luật. Nó nói **máy nhìn thấy được đến đâu**. Một điều luật không có luật máy
thì ai cũng biết là chưa được giữ. Một luật máy bị tin là kín trong khi nó đang rò mới là thứ nguy
hiểm, vì không ai còn đi kiểm nữa.

## Bảng tra nhanh

| Luật máy | Mã luật | Bắt gì |
|---|---|---|
| `no-copy-resolution-below-block` | `COPY-1` | Một lời gọi tra chữ (`useTranslations`, `useLocale`, `useFormatter`, `getTranslations`) nằm trong tệp thuộc bốn thư mục `leaves`, `shells`, `composites`, `branches`. |
| `no-hardcoded-copy-in-vocabulary` | `COPY-2` | Một chuỗi **có dấu cách và bắt đầu bằng chữ hoa ASCII**, đứng ở `aria-label`, `placeholder`, `title`, `alt`, `aria-description`, hoặc đứng làm chữ hiển thị trực tiếp trong thẻ, trong cùng bốn thư mục đó. |

`COPY-3`, `COPY-4`, `COPY-6` **không có luật máy nào**. `COPY-5` được thoả mãn bằng cấu trúc thư mục
chứ không bằng một phép kiểm. Chi tiết ở `audit.md`.

---

## `no-copy-resolution-below-block`

**Bắt gì?** Mọi `CallExpression` mà tên hàm được gọi viết đúng một trong bốn chữ:
`useTranslations`, `useLocale`, `useFormatter`, `getTranslations` — với điều kiện tệp đang lint nằm
trong một trong bốn thư mục nhận chữ. Gọi ở đâu trong tệp cũng bị bắt: trong thân thành phần, ở cấp
mô-đun, trong một hàm phụ, trong một callback.

**Giữ mã nào?** `COPY-1` — nửa có kết nối tra chữ, mọi thứ bên dưới chỉ nhận chuỗi đã tra xong.

**Phát hiện thế nào?**

1. Cổng thư mục chạy **một lần** trong `create`: lấy `context.filename` (thiếu thì
   `context.getFilename()`), đổi mọi `\` thành `/`, rồi kiểm chuỗi con `/src/components/<dir>/` với
   `<dir>` thuộc `leaves`, `shells`, `composites`, `branches`. Không qua cổng thì luật trả về đối
   tượng rỗng — nó **không cài visitor nào cả**, nên không thể báo lỗi.
2. Qua cổng rồi thì thăm `CallExpression`. Bắt buộc `callee.type === "Identifier"` và `callee.name`
   khớp `/^(?:useTranslations|useLocale|useFormatter|getTranslations)$/`.
3. Không đọc đường dẫn import, không phân giải binding. Luật khớp **cách viết**, không khớp **ký
   hiệu**.

**Vì sao nên để máy giữ luật này?** Không phải vì chữ sai, mà vì **phụ thuộc**. Một thành phần tra
chữ thì phải có runtime dịch mới dựng lên được từ một fixture, và nó phải tự biết người đọc đang ở
tình huống nào mới chọn đúng câu — hai việc đó đều thuộc về nửa có kết nối, cách đó đúng một tệp. Lỗi
này không hiện ra trên màn hình; nó chỉ hiện ra khi ai đó cố dựng thành phần một mình và không dựng
được.

**Những chỗ còn lọt.**

- Đổi tên khi import (`import { useTranslations as useCopy }`) thì tên không còn khớp.
- Gọi dạng thuộc tính (`i18n.useTranslations()`) thì `callee` là `MemberExpression`, bị loại trước cả
  bước so tên.
- Gán rồi gọi (`const f = useTranslations; f()`) thì lời gọi mang tên khác.
- Bất kỳ tên tra chữ nào ngoài bốn tên đó — kể cả một hàm bọc của chính dự án — đều lọt.
- Chuyển lời gọi sang một tệp **ngoài** bốn thư mục rồi import vào: phụ thuộc vẫn còn nguyên, báo cáo
  thì không.
- Đặt tên thư mục khác (`leaf/`, `atoms/`, `overlays/`) hoặc đặt thành phần ở `src/ui/leaves/`: cổng
  im lặng tắt.
- Lint bằng đường dẫn **tương đối** thì chuỗi con thiếu dấu `/` đứng đầu, cả hai luật cùng tắt, và
  lần chạy đó xanh vì lý do sai.

---

## `no-hardcoded-copy-in-vocabulary`

**Bắt gì?** Trong bốn thư mục nhận chữ:

- một `JSXAttribute` tên thuộc `aria-label`, `placeholder`, `title`, `alt`, `aria-description`, giá
  trị là chuỗi thường hoặc chuỗi thường bọc trong ngoặc nhọn — và chuỗi đó "trông như câu";
- một đoạn `JSXText` (chữ viết thẳng trong thẻ) mà sau khi cắt khoảng trắng vẫn "trông như câu".

"Trông như câu" ở đây có nghĩa rất hẹp: **có ít nhất một khoảng trắng, và bắt đầu bằng một chữ hoa
A–Z**.

**Giữ mã nào?** `COPY-2` — thành phần dưới block không giữ chữ mà người đọc nhìn hoặc nghe thấy.

**Phát hiện thế nào?**

1. Cùng một cổng thư mục như luật trên.
2. `JSXAttribute`: tên phải là `JSXIdentifier` (nên `xlink:title` dạng namespace bị bỏ qua) và nằm
   trong tập năm tên. Giá trị lấy bằng `attributeText`: nhận `Literal` chuỗi, hoặc
   `JSXExpressionContainer` có `expression.type === "Literal"` là chuỗi. Mọi dạng khác trả `null`.
3. `JSXText`: lấy `node.value`, ép chuỗi, `trim()`.
4. Cả hai đi qua đúng một phép thử: `/\s/` và `/^[A-Z]/`.

**Vì sao nên để máy giữ luật này?** Vì chữ **trốn trong thuộc tính**. Không thuộc tính nào trong năm
cái đó đọc giống một câu khi mắt lướt qua tệp, nên chúng là chỗ chữ sống sót lâu nhất qua mọi lần
soát tay. Riêng `aria-label` không phải chuyện nhỏ: trình đọc màn hình coi nó là **chữ chính**, nên
một nhãn tiếng Anh nằm trên một màn hình đã dịch là lỗi to tiếng nhất trang, giáng đúng vào người ít
có khả năng lách qua nó nhất.

Phép thử cố tình thô. Một phép thử tinh vi hơn sẽ phải tranh cãi từng chuỗi xem có phải câu không, và
một phép thử hay cãi là phép thử không ai tin.

**Những chỗ còn lọt.** Cái giá của sự thô đó, viết ra đủ:

- **Túi prop của nhà.** `<Input props={{ placeholder: "Search courses" }} />` — thuộc tính tên là
  `props`, không nằm trong tập năm tên; chuỗi nằm trong một `ObjectExpression` mà không visitor nào
  bước vào. Đây đúng là hình dạng mà ví dụ phản diện của luật được viết ra.
- **Hằng số giặt sạch chuỗi.** `const PLACEHOLDER = "Search courses"` rồi `placeholder={PLACEHOLDER}`.
  Chuỗi nằm ở `VariableDeclarator`, thuộc tính chỉ còn một `Identifier`.
- **Mọi thứ không phải `Literal` trần.** Template literal, phép nối chuỗi, toán tử ba ngôi, lời gọi
  hàm — `attributeText` trả `null` hết.
- **Chữ trong ngoặc nhọn giữa thẻ.** `<span>{"Search courses"}</span>` không phải `JSXText` và cũng
  không phải `JSXAttribute`.
- **Câu bị chen một biểu thức.** `<span>Search {count} courses</span>` vỡ thành `"Search"` và
  `"courses"`: cái đầu không có dấu cách, cái sau chữ thường.
- **Chữ một từ.** `Submit`, `Close`, `Avatar` — không có dấu cách nên không phải "câu", trong khi
  người đọc ngôn ngữ khác vẫn thấy y nguyên.
- **Chữ không mở đầu bằng chữ hoa ASCII.** `aria-label="close dialog"` lọt vì chữ thường; và mọi câu
  mở đầu bằng `Đ`, `Ê`, `Ô`, `Ơ`, `Ư`, `Á`, `Ổ` cũng lọt, vì `/^[A-Z]/` chỉ biết bảng chữ ASCII. Luật
  sinh ra để bảo vệ người đọc ngôn ngữ khác lại mù trước chính chữ viết bằng ngôn ngữ ấy.
- **Thuộc tính ngoài năm cái.** `aria-placeholder`, `aria-roledescription`, `aria-valuetext`,
  `label`, `description`, `emptyMessage`, `errorMessage`, `tooltip`.
- **Spread.** `<Input {...{ placeholder: "Search courses" }} />` là `JSXSpreadAttribute`, khác node.
- **Mảng và đối tượng.** `["Overview", "Recent activity"]` rồi map ra: chuỗi không đứng ở chỗ luật
  đang canh.
- **Cổng thư mục và tên tệp.** Giống luật trên, và đây là thứ rẻ nhất trong một kho mã để thay đổi.

---

## Luật

1. Danh tính của một luật máy là **tên đã công bố**. Tên đó xuất hiện trong log build, trong dòng tắt
   luật và trong mọi cuộc trao đổi về lỗi; đặt thêm một mã số thứ hai là tạo ra hai tên cho một thứ.
2. Chỉ ghi ở đây những luật **có thật** trong tệp nguồn. Luật đáng có mà chưa có thì thuộc mục "Rủi
   ro còn mở" của `audit.md`.
3. Mỗi luật máy phải có ít nhất một dòng **cửa còn mở** trung thực, hoặc một lập luận vì sao nó kín.
   Viết "không có" cho gọn là hỏng cả mục đích của kệ tài liệu này.
4. Không luật nào ở đây tự sửa mã. Mỗi báo cáo là một việc thật: nhấc chuỗi lên nửa có kết nối và
   đặt cho nó một khoá.
5. Cả hai luật khớp **văn bản** — chuỗi con thư mục, cách viết tên hàm, một lớp ký tự. Không luật nào
   phân giải ký hiệu, nên mọi lần đổi tên đều thắng chúng.

## Ngoại lệ

- **Nội dung từ điển** được miễn bằng **cấu trúc**, không bằng phán đoán: tệp từ điển không nằm trong
  bốn thư mục nhận chữ, nên không cổng nào phải quyết định gì về nó.
- **Giá trị mà chương trình đem ra so khớp** (`COPY-6`) không có dấu hiệu nào máy đọc được. Luật yêu
  cầu đánh dấu lý do trên dòng đó, nhưng luật máy không đọc chú thích — thứ thật sự làm im báo cáo là
  một chỉ thị tắt luật, và chỉ thị đó không bắt ai phải nêu lý do. Dấu của luật và cái khoá miệng của
  máy là hai thứ khác nhau.
- **Không có ngoại lệ cấu hình.** Cả hai luật khai `schema: []`, nên không thể nới danh sách thư mục
  hay danh sách tên hàm ở nơi dùng. Ai không đồng ý thì sửa gói, không sửa cấu hình.
