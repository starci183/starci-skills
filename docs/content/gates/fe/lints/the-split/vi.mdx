---
title: The-split · Vietnamese
---

# Đường chia

## LOADS

None.


## Bản ghi

Gate này nhận code đã viết rồi — một file, một khúc diff. Kết quả là một **phán quyết**: file có nằm trong
phạm vi hay không, rule nào đã bắn, nó báo gì và trên nút nào, ứng với mã luật nào, và lỗ hổng mở nào
lẽ ra đã giấu được đúng cái hỏng đó. Mô-đun này không chọn gì cả. Nó từ chối, và nó phải chỉ được vào
đúng lời gọi mà nó từ chối.

## Luật

Một bề mặt sở hữu một request thì gồm hai file. Một file đi lấy dữ liệu, chốt xem người đọc đang ở
tình huống nào và phân giải chữ nghĩa; file kia nhận một tình huống đã chốt rồi vẽ ra. Đường chia tồn
tại để mọi thứ có thể sai về **dữ liệu** nằm trong một file, còn mọi thứ có thể sai về **vẽ** nằm
trong file còn lại.

Luật phát biểu sáu mã. **Hai mã có rule.** Đó không phải sự tình cờ về độ phủ, đó là hình dạng của bài
toán: một file có đi lấy dữ liệu, có đọc store hay có phân giải chữ thì lộ ra ở thứ nó **gọi**, còn
một file vẽ dở thì trông y hệt một file vẽ tốt. Mô-đun này ghi lại nửa được thi hành một cách trung
thực, kể cả những chỗ việc thi hành mỏng hơn cái tên của nó.

## Luật máy đã xuất bản

| Rule | Mã | Nó báo cái gì |
|---|---|---|
| `presentational-purity` | `SPLIT-1` | `reaches` — một lời gọi theo tên thuộc bốn họ đọc-thế-giới, nằm trong nửa vẽ |
| `connected-block-has-presentational-twin` | `SPLIT-5` | `missing` — index của một khối có kết nối đọc thế giới nhưng không import đúng `_<Folder>` từ `./component`; `bypass` — nó render một thẻ JSX khác; `unused` — nó import twin mà không bao giờ render |

Cả hai rule đều ánh xạ vào một mã mà luật có phát biểu. Không rule nào ở đây thi hành thứ luật không
nói, và không rule nào bị bỏ trống mã.

`SPLIT-2` (tạo kiểu ở lại nửa vẽ), `SPLIT-3` (tình huống đi qua đường chia dưới dạng một cái tên, không
phải một túi cờ), `SPLIT-4` (chữ được phân giải trước khi đi qua) và `SPLIT-6` (bề mặt không có request
thì không chia) **hoàn toàn không có rule**. Chúng không được thi hành một cách có chủ ý, và một lượt
chạy xanh không nói được gì về bất kỳ mã nào trong số đó.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ, và ghi lại.** Ở đây "ngoài phạm vi" không có nghĩa là file đã qua —
   nó nghĩa là không visitor nào được cài và rule không tồn tại với file đó.
2. **`presentational-purity` cần tên file kết thúc bằng `component.tsx`.** Mọi tên khác, kể cả
   `view.tsx`, `Component.tsx` hay `component.jsx`, đều tắt rule.
3. **Rule twin cần một index của khối** — `components/blocks/**/<Folder>/index.tsx` với thư mục
   viết hoa — và cần file đó có đọc thế giới. Không đọc thế giới thì không kiểm gì cả.
4. **Xem loại callee trước.** Cả hai rule dừng ngay khi callee không phải một `Identifier` trần, nên
   đúng một namespace là hạ được cả hai.
5. **Mỗi phát hiện phát một khối**, và ghi dòng `hatch` mỗi khi có một lỗ hổng mở lẽ ra đã giấu được
   đúng cái hỏng đó.
6. **Không báo thứ không rule nào canh.** Bốn trên sáu mã không có máy nào giữ; một phán quyết nói
   khác là phán quyết sai về mô-đun này.

## `presentational-purity` — SPLIT-1

**Nó báo cái gì.** `reaches` — mỗi lời gọi vi phạm một báo cáo, có chèn tên đã khớp.

**Nó phát hiện bằng gì.** Phạm vi là `context.filename`, đổi dấu gạch ngược thành `/`, kiểm với
`/(?:^|\/)component\.tsx$/`; ngoài phạm vi thì `create` trả về một đối tượng visitor rỗng. Trong phạm
vi có đúng một visitor, `CallExpression`, đòi `node.callee.type === "Identifier"` rồi kiểm
`callee.name` với một regex hợp nhất bốn họ: `useSWR` / `useSWRMutation` / `use…Swr`; `useAppSelector`
/ `useDispatch` / `use…Store`; `useTranslations` / `useLocale` / `useFormatter`; `query<Capital>…` /
`mutation<Capital>…`.

**Điểm mù.** Callee dạng biểu thức thành viên — `hooks.useTranslations()`,
`store.useAppSelector()`, `client.queryOrder()` — vì visitor thoát ngay khi callee không phải
`Identifier`. Một hook bọc mang tên bình thường — `useOrderData()`, `useRowsFor(id)`, `loadSummary()` —
không khớp họ nào, và đây chính là động tác dọn dẹp tiêu chuẩn: dời đi một file là cùng một lần fetch
trở nên tàng hình. Hậu tố viết hoa toàn bộ, `useOrderSWR()`, nằm ngoài hậu tố `Swr` chính xác. Một
bí danh cục bộ trong nửa vẽ — `import {useTranslations as translate}` rồi gọi `translate("x")` — thì
lọt, vì rule này **không hề đọc import**. Với tay qua một component con thay vì gọi trực tiếp — nửa vẽ
render một `<OrderTotal />` có kết nối — không sinh ra lời gọi nào trong file này. Và cái cổng tên file
là thứ rẻ nhất trong một repository để thay đổi.

**Ranh giới.** Rule này xử các lời gọi trong một file. Chuyện twin có tồn tại không, có được render
không, là `SPLIT-5`.

## `connected-block-has-presentational-twin` — SPLIT-5

**Nó báo cái gì.** `missing`, rồi dừng; ngược lại thì mỗi thẻ lạ một `bypass`, cộng tối đa một
`unused`.

**Nó phát hiện bằng gì.** Phạm vi là cùng tên file đã chuẩn hoá, khớp với
`/\/src\/components\/blocks\/(?:[^/]+\/)*([A-Z][A-Za-z0-9]*)\/index\.tsx$/`; nhóm bắt số 1 là tên thư
mục, và twin là chuỗi `_` cộng tên đó, **suy ra** chứ không bao giờ cấu hình. Ba bộ thu thập và một
quyết định. `ImportDeclaration` đặt `importsTwin` chỉ khi chuỗi nguồn đúng bằng `./component` và có
một specifier thoả `imported.name === local.name === twin`; song song đó nó thêm mọi specifier có
`imported.name` khớp regex thế giới vào một tập ràng buộc cục bộ, bất kể nguồn nào. `CallExpression`
đặt `readsWorld` khi một callee `Identifier` nằm trong tập đó hoặc khớp thẳng regex.
`JSXOpeningElement` đẩy mọi thẻ `JSXIdentifier` vào một danh sách đã render và đặt `rendersTwin` khi
khớp chính xác. `Program:exit` lặng lẽ thoát nếu không có `readsWorld`.

**Điểm mù.** Giặt sạch lần đọc thế giới là tắt luôn cả phép kiểm: nếu index gọi
`useOrderData()` thì `readsWorld` vẫn là false, `Program:exit` thoát, và khối đó trở nên **tàng hình**
chứ không phải không tuân thủ — hai rule dùng chung một bộ dò, nên một lần giặt hạ cả hai. Render
không qua JSX, `createElement(Row, props)` đặt cạnh một `<XBase />`, để nguyên một cây thay thế không lọt
vào danh sách trong khi `rendersTwin` vẫn đúng. Một thẻ có namespace, `<Ui.Card>`, là
`JSXMemberExpression` nên không bao giờ vào danh sách. Một đường dẫn ngoài đúng một khuôn — `features/…`,
`app/…`, `components/blocks/…` mà thiếu `src`, thư mục viết thường, entrypoint tên `index.ts` — thì
không có rule nào trên nó. Và twin **không bao giờ được mở ra**: `XBase` có thể không tồn tại, có thể đi
fetch, có thể chẳng vẽ gì. "Có twin trình bày" được quyết từ một **cái tên**.

**Ranh giới.** Rule này khoá vào `imported.name`, nên một bí danh ở chỗ import vẫn tính là đọc thế
giới — đúng cái lỗ mà `presentational-purity` để hở.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| chuẩn hoá dấu phân cách | Cả hai phép kiểm phạm vi đổi dấu gạch ngược thành `/` trước khi khớp, nên một đường dẫn Windows cho ra cùng một quyết định |
| ngoài phạm vi | `create` trả về đối tượng visitor rỗng. Rule **không tồn tại** với file đó chứ không phải cho nó qua |
| regex thế giới dùng chung | Một hợp nhất bốn họ, kiểm trên tên callee `Identifier` trần; mọi lỗ hổng mở bên dưới đều là một cách để không phải là thứ đó |
| suy ra twin | Tên twin đến từ đoạn thư mục viết hoa nằm trên `index.tsx`, và phép import phải khớp cả hai chiều: cùng chuỗi nguồn, cùng tên import, cùng tên cục bộ |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng mấy cách viết này lọt, nhưng không.

| Viết kiểu này | Vì sao vẫn bắn |
|---|---|
| `import {useTranslations as translate}` ở nửa có kết nối | Rule twin khoá vào `imported.name`, không phải tên cục bộ |
| `<div><XBase /></div>` | Mọi thẻ `JSXIdentifier` đều được thu, kể cả thẻ host viết thường, nên lớp bọc bị báo `bypass` |
| Chôn khối thật sâu trong thư mục con | Regex phạm vi cho phép bao nhiêu đoạn trung gian cũng được |
| Đường dẫn Windows với dấu gạch ngược | Cả hai phép kiểm chuẩn hoá dấu phân cách trước |
| Dời nửa vẽ sang tầng khác mà giữ tên | Phạm vi neo vào ranh giới đoạn đường dẫn, nên `component.tsx` nằm đâu cũng trong phạm vi |
| `props={{label: useTranslations("x")("label")}}` | `CallExpression` duyệt cả cây; lồng trong một thuộc tính không đổi gì |
| Một khối mỏng — một lá, một tree, không state cục bộ | Trong code không có nhánh nào cho khối mỏng; chỉ `readsWorld` là mở phép kiểm |
| Đọc thế giới ở đúng một nhánh | Một lời gọi khớp ở bất cứ đâu trong file cũng đặt `readsWorld` cho cả file |

**Còn mở** — chỗ mù đã xuất xưởng. Một phán quyết không được nhận là đã xét mấy chỗ này.

| Phạm vi | Cái gì lọt |
|---|---|
| cả hai | **Callee dạng biểu thức thành viên.** Thế giới đi vào qua một namespace và không gì bị báo |
| cả hai | **Hook bọc mang tên bình thường.** Dời đi một file là cùng lần fetch đó tàng hình |
| cả hai | **Hậu tố viết hoa toàn bộ.** `useOrderSWR()` nằm ngoài hậu tố `Swr` chính xác |
| cả hai | **Default import đổi tên.** Specifier mặc định không có `imported` để kiểm |
| `presentational-purity` | **Bí danh cục bộ trong nửa vẽ**, **với tay qua component con** thay vì gọi, và **mọi tên file không phải `component.tsx`** |
| `connected-block-has-presentational-twin` | **Lần đọc thế giới đã bị giặt**, **render không qua JSX**, **thẻ có namespace**, **đường dẫn ngoài đúng một khuôn**, và **twin không bao giờ được mở ra** |
| không rule nào | **Mọi thứ `SPLIT-2`, `SPLIT-3`, `SPLIT-4` và `SPLIT-6` cấm** — tạo kiểu quyết ở nửa có kết nối, bốn biến bool thay cho một tình huống có tên, một khoá dịch đi qua đường chia, một cú chia hai file cho bề mặt chẳng fetch gì |

Dòng cuối chính là bản tóm tắt trung thực của mô-đun này: trong sáu mã, hai mã được giữ, và hai mã
được giữ đó dùng chung một bộ dò mà bất kỳ hàm bọc nào đặt tên bình thường cũng hạ được.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| tên file | Đường dẫn đúng như rule nhìn thấy, dấu phân cách chuẩn hoá thành `/` |
| quyết định phạm vi | Phép kiểm tên file nào đã khớp, hoặc không cái nào khớp |
| tên các lời gọi | Mọi callee `Identifier` trong file |
| specifier import | Chuỗi nguồn, `imported.name` và `local.name` của từng specifier |
| tên thư mục | Với một index khối: đoạn viết hoa nằm trên `index.tsx` — nó quyết định twin |
| tên thẻ JSX | Mọi thẻ mở `JSXIdentifier`; thẻ dạng biểu thức thành viên không được thu |

## Quy tắc

1. Danh tính của một rule là tên đã xuất bản của nó. Không có định danh dạng số cho rule ở bất cứ đâu
   trong mô-đun này.
2. Mỗi rule đọc đúng một file. Không rule nào mở nửa còn lại ra.
3. Không rule nào nhận tuỳ chọn: cả hai khai `schema: []`. Mức nghiêm trọng là núm duy nhất một
   repository có.
4. Ngoài phạm vi nghĩa là không visitor nào được cài, không phải là file đã qua.
5. `presentational-purity` báo một lần cho mỗi lời gọi vi phạm.
6. Rule twin báo `missing` rồi dừng, hoặc mỗi thẻ lạ một `bypass` cộng tối đa một `unused`.
7. File nào bộ dò không coi là có đọc thế giới thì không bao giờ bị rule twin báo.
8. Tên twin suy ra từ thư mục, không bao giờ cấu hình, và phép import phải khớp chính xác cả hai chiều.
9. Mức nghiêm trọng đã xuất bản của cả hai là `error`.

## Ngoại lệ

Trong code không có ngoại lệ nào. Không rule nào khai tuỳ chọn, danh sách cho phép, nhánh khối mỏng
hay lối tắt theo file, và luật nói bằng lời rằng một lá, một tree ở mọi trạng thái, không state miền
cục bộ và một twin chỉ chuyển tiếp — tất cả vẫn là cùng một luật.

Lối ra duy nhất là một comment tắt rule, và mô-đun này không cấp cái nào. Repository nào cần đến nó là
đang **đổi luật**, và chuyện đó thuộc về lịch sử của mô-đun — không thuộc về một dòng comment đặt trên
lời gọi.

## Đầu ra

Mỗi phát hiện một khối:

```text
file: <đường dẫn đúng như rule nhìn thấy, gạch chéo xuôi>
rule: <presentational-purity | connected-block-has-presentational-twin>
scope: <in | out — phép kiểm tên file đã quyết>
report: <reaches | missing | bypass | unused> tại <nút>
code: <SPLIT-1 | SPLIT-5>
hatch: <lỗ hổng mở lẽ ra đã giấu được cái này, hoặc none>
```

## Ví dụ đã giải

**Đầu vào.** Hai file của một khối, `components/blocks/order/OrderTotal/`:

```tsx
// index.tsx
import {useTranslations} from "next-intl"
import {Row} from "./Row"

export function OrderTotal({id}) {
  const t = useTranslations("order")
  return <Row label={t("total")} />
}
```

```tsx
// component.tsx
export function OrderTotalBase({label}) {
  const t = useTranslations("order")
  return <p>{label ?? t("fallback")}</p>
}
```

Index khớp phạm vi index-khối và có đọc thế giới nên rule twin chạy. `component.tsx` khớp phạm vi
purity nên rule kia cũng chạy.

```text
file: src/components/blocks/order/OrderTotal/index.tsx
rule: connected-block-has-presentational-twin
scope: in — regex index khối, thư mục OrderTotal, twin OrderTotalBase
report: missing tại Program:exit
code: SPLIT-5
hatch: none
```

`missing` làm rule dừng lại, nên thẻ `<Row />` không bao giờ bị báo `bypass`. Một phát hiện, không
phải hai.

```text
file: src/components/blocks/order/OrderTotal/component.tsx
rule: presentational-purity
scope: in — /component\.tsx$/
report: reaches tại CallExpression useTranslations
code: SPLIT-1
hatch: none
```

Sửa xong thì index import twin từ `./component` và nửa vẽ nhận chữ đã chốt qua props. Nhưng đúng cái
hỏng đó sống sót qua một lần đổi tên:

```tsx
// index.tsx
import {useOrderCopy} from "./copy"
```

```text
file: src/components/blocks/order/OrderTotal/index.tsx
rule: connected-block-has-presentational-twin
scope: in — regex index khối
report: none
code: SPLIT-5
hatch: một hook bọc đặt tên bình thường làm readsWorld vẫn false, nên Program:exit thoát và khối trở nên tàng hình chứ không phải đã tuân thủ
```

## Phạm vi

Mô-đun này ghi phần thi hành, không ghi luật. Nó không gọi tên sản phẩm nào, thư viện thành phần nào
hay repository nào. Tên rule, id thông điệp và tiền tố plugin là những định danh đi ra trong kết quả
build nên được chép nguyên văn; mọi thứ viết quanh chúng là markup thường và lời gọi thường.
