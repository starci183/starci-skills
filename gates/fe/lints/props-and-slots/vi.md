---
title: Props-and-slots · Vietnamese
---

# Props và slots

Đầu vào là mã đã viết xong — một file, một hunk của diff. Đầu ra là một **phán quyết**: file có nằm
trong phạm vi hay không, luật máy nào đã nổ, nó báo cái gì và trên node nào, ánh xạ sang mã luật nào,
và lối thoát đang mở nào lẽ ra đã che đúng lỗi đó. Module này không chọn hình dạng props nào cả. Nó
từ chối một hình dạng, và nó phải chỉ được vào đúng tham số, đúng key hay đúng attribute mà nó từ
chối.

## Luật

Props của một component là một tập ĐÓNG gồm các slot có tên, và tập đó được viết thành một type alias
cho mỗi tầng chứ không lắp ráp lại ở từng component. Vì vậy thứ mà người gọi được phép đưa cho một
component không phải là một quy ước ai đó phải nhớ — nó là thứ duy nhất biên dịch được. Cả hệ thống
có năm slot và không component nào có đủ cả năm: `props` là thứ nó vẽ, `on` là thứ nó làm, `contract`
là key nó render còn `render` là một component có tên cho mỗi slot mà key đó khai báo, và `isLoading`
được truyền xuống chứ không bao giờ tự quyết tại chỗ.

Luật phát biểu **bảy mã**, từ `SLOTS-1` đến `SLOTS-7`. **Ba trong số đó có luật máy.** Đó không phải
tai nạn về độ phủ mà là bố trí luật muốn: các slot alias trong `props.ts` chính là hàng rào, một slot
thứ năm không qua nổi trình biên dịch chứ không phải không qua nổi review, và một khi bản thân hình
dạng đã từ chối thì chẳng còn gì cho luật máy đi tuần. Luật máy chỉ tồn tại đúng ở chỗ type không có
gì để nhìn — một shape KHÔNG CÓ TÊN, một lỗ `children` tự viết tay bên cạnh các alias thay vì nằm
trong chúng, và một lane `items` chung trên một surface dùng chung. Module này ghi lại một phần ba
được cưỡng chế ấy một cách trung thực, kể cả những chỗ mà mức cưỡng chế mỏng hơn cái tên của nó.

## Luật máy đã xuất bản

| Luật máy | Mã | Nó báo cái gì |
|---|---|---|
| `no-inline-parameter-type` | `SLOTS-3` | `inline` — một tham số hàm có type khai báo chứa object shape vô danh, kể cả nằm trong ngoặc, trong intersection hay trong union |
| `no-children-slot` | `SLOTS-4` | `slot` — một thành viên `children` khai trong type, hoặc một key `children` destructure ở tham số, trong file component thuộc phạm vi |
| `no-surface-list-items-slot` | `SLOTS-7` | `items` — một attribute JSX `items` trên thẻ đang bind tới `SurfaceListCard` import từ đúng một đường dẫn literal |

`SLOTS-1` (slot dữ liệu chỉ chở dữ liệu, không bao giờ chở hàm, component hay bất cứ giá trị nào mang
hành vi), `SLOTS-2` (dữ liệu của component khai bằng type alias, không bằng `interface`), `SLOTS-5`
(component nằm dưới bên sở hữu request thì nhận `isLoading` chứ không tự quyết trạng thái chờ) và
`SLOTS-6` (diện mạo là một variant có tên quyết định bên trong, không phải `className`, `style`, prop
khoảng cách hay hook style theo từng phần) **hoàn toàn không có luật máy** ở đây. Ba trong số đó được
giữ ở nơi khác — `SLOTS-1`, `SLOTS-2` và `SLOTS-6` thuộc tầng `unrepresentable`, do `DataValue`, do
ràng buộc `D extends ComponentData` và do ba tier alias đóng trong `@starci/eslint-canon-fe/props` giữ — còn
`SLOTS-5` là `documented`, tức chẳng có gì giữ cả. Một lần chạy sạch của module này không nói được gì
về bốn mã ấy, và ở đâu type chưa từng phủ tới file thì mã đó đơn giản là chưa được cưỡng chế, chứ
không phải đã được bao phủ.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa file đã qua — nó
   có nghĩa là không visitor nào được cài và luật máy không tồn tại đối với file đó.
   `no-inline-parameter-type` không cài cổng đường dẫn nào cả nên không có trạng thái ngoài phạm vi;
   `no-children-slot` cần `isGoverned`; `no-surface-list-items-slot` cần `/src/` trong đường dẫn.
2. **Kiểm tra ngoại lệ trước khi đọc node.** File registry contract được miễn khỏi `no-children-slot`
   vì thành viên `children` của nó mô tả ngữ pháp con đã đóng. File route của framework nằm ngoài
   component tier và được nhận ReactNode, với điều kiện đóng nó thành một projection có tên trước khi
   ghép component. Không có thư mục component nào được đặc quyền.
3. **Đọc đúng những node mà luật máy thật sự ghé qua.** Một type annotation đã khai ở tham số; một key
   `TSPropertySignature` hoặc một key property trong `ObjectPattern`; một import specifier rồi mới tới
   tên attribute JSX. Node mà visitor không bao giờ tới là chưa được xét, không phải sạch.
4. **Xuất một block cho mỗi finding**, trên đúng node mà luật máy báo — type annotation, identifier
   `children`, cả attribute `items`.
5. **Viết dòng `hatch`** mỗi khi một lối thoát đang mở bên dưới lẽ ra đã che đúng lỗi ấy. Một tham số
   `Readonly<{…}>`, một props type `PropsWithChildren` và một import qua barrel đều lọt, và không cái
   nào trong đó là tuân thủ.
6. **Đừng báo thứ không luật máy nào canh.** Bốn trên bảy mã không có máy ở đây; một phán quyết nói
   khác đi là hiểu sai module này.

## `no-inline-parameter-type` — SLOTS-3

**Nó báo cái gì.** `inline` — mỗi tham số vi phạm một báo cáo, đặt trên `param.typeAnnotation` khi có,
và trên chính tham số khi không có.

**Nó phát hiện bằng gì.** Không có phép thử tên file nào: `create` cài visitor cho mọi file mà parser
đưa tới. Bốn visitor dùng chung một walker `checkParams` — `ArrowFunctionExpression`,
`FunctionExpression`, `FunctionDeclaration` và `TSEmptyBodyFunctionExpression`. Với mỗi tham số nó đọc
`param.typeAnnotation?.typeAnnotation` rồi chạy `isInlineObjectType`, hàm này trả true cho một
`TSTypeLiteral`, đệ quy qua `TSParenthesizedType`, và trả true khi bất kỳ thành viên nào của một
`TSIntersectionType` hoặc `TSUnionType` trả true. Mọi thứ còn lại là false.

**Nó không thấy gì.** Một tham số không có annotation: `declared` là undefined, phép duyệt trả false
ngay, và một destructure không type là vô hình. Một shape chỉ cách một lớp bọc —
`Readonly<{label: string}>`, `Partial<{…}>`, `{…}[]` — là `TSTypeReference` hay `TSArrayType`, mà
walker chỉ đệ quy qua ngoặc, intersection và union, nên một utility type bình thường là đủ hạ nó. Cái
TÊN chỉ được đọc chứ không được kiểm: mọi type có tên đều lọt, kể cả tên không phải `XProps` cho
component `X`, kể cả một alias `type X = {…}` khai ba dòng phía trên và dùng đúng một lần. Một shape
lắp ráp sau tham số — destructure trong thân hàm, hay spread vào một biến cục bộ — không bao giờ tới
được annotation của tham số. Và vì không có cổng phạm vi, luật máy nổ trong file test, trong fixture
và trong tooling y hệt như trong mã sản phẩm; repository nào không ưa điều đó sẽ hạ severity và mất
trọn cả mã luật.

**Ranh giới.** Luật máy này xét hình dạng tại tham số. Còn type có tên mà nó trỏ tới có đúng tier
alias hay không, và alias đó có nạp thêm slot thứ tư hay không, là việc của type chứ không phải một
finding ở đây.

## `no-children-slot` — SLOTS-4

**Nó báo cái gì.** `slot` — mỗi node `children` một báo cáo, đặt trên identifier của key.

**Nó phát hiện bằng gì.** `create` trả `{}` trừ khi `isGoverned` chấp nhận tên file. `isGoverned` đổi
backslash thành `/`, trả false cho `isContractTableFile(path)`, và ngoài ra đòi
`COMPONENT_ROOTS.filter((root) => root !== "src").some((root) => path.includes("/" + root + "/"))` —
tức `/src/components/` hoặc `/packages/ui/src/`, với entry `src` trần bị bỏ ở đây và chỉ ở đây, bởi
dùng làm hàng rào thì nó khớp mọi file dưới `src/` và báo một routed page vì đã nhận children, đúng
cái việc duy nhất mà một page được phép làm. Trong phạm vi có hai visitor. `TSPropertySignature` báo
khi `node.key.type === "Identifier"` và `node.key.name === "children"`. `Property` báo đúng key đó khi
cha nó là một `ObjectPattern` và ông nó không phải `VariableDeclarator` — một `children` destructure ở
tham số, chính là cái slot ấy đi vào bằng cửa khác, trong khi `const {children} = props` trong thân
hàm được cố ý thả qua.

**Nó không thấy gì.** Một thành viên viết trong nháy, `"children": ReactNode`, có key là `Literal` chứ
không phải `Identifier`, và key computed cũng vậy. Một lỗ children mang tên khác — `content: ReactNode`,
`body: ReactNode`, `trigger: ReactNode` — vì luật máy khớp một identifier và không biết gì về
ReactNode. `PropsWithChildren<XData>`, hay bất kỳ props type nào import về mà mang sẵn thành viên đó,
vì luật máy không bao giờ mở file khác. Nửa khẳng định của mã luật thì hoàn toàn không ai canh: ở đây
không có gì kiểm rằng một container khai `contract` và `render` cùng nhau, và không có gì thấy một
closed shape mọc thêm `render`. Và cổng tầng chỉ là một đường dẫn: chính component đó nằm dưới
`apps/web/features/…`, hay dưới một `ui/` không phải component root nào, thì không có luật máy nào
đụng tới — literal về bố cục là thứ rẻ nhất trong một repository để thay.

**Ranh giới.** Luật máy này chỉ thấy cái lỗ markup và không thấy gì hơn. `BranchProps` giữ nửa khẳng
định, còn các shell trao thẳng phần bên trong cho cơ chế vendor thì được miễn bằng lời của luật chứ
không bằng mã của luật máy này.

## `no-surface-list-items-slot` — SLOTS-7

**Nó báo cái gì.** `items` — mỗi attribute vi phạm một báo cáo, đặt trên trọn `JSXAttribute`.

**Nó phát hiện bằng gì.** Phạm vi là `context.filename` với backslash đổi thành `/`, bắt buộc
`includes("/src/")`; mọi thứ khác nhận một object visitor rỗng. Trong phạm vi, luật máy giữ một tập
`bindings` cục bộ. `ImportDeclaration` chuẩn hóa chuỗi source rồi thử nó với
`/(?:^|\/)components\/branches\/SurfaceListCard$/`; với source khớp, nó thêm `specifier.local.name` của
mọi specifier có `imported.name` đúng bằng `SurfaceListCard`. `JSXOpeningElement` chỉ lấy tên thẻ khi
`node.name.type === "JSXIdentifier"`, đòi tên đó nằm trong `bindings`, rồi báo mọi attribute kiểu
`JSXAttribute` có `name.type === "JSXIdentifier"` và `name.name` là `items`.

**Nó không thấy gì.** Mọi surface dùng chung khác — `SurfaceCard`, `SurfaceAccordionCard`,
`SurfaceFormCard` — vì luật máy bị buộc vào đúng một đường dẫn import. Mọi cách viết khác của đường dẫn
đó: một barrel (`@/components/branches`), một re-export, một đường dẫn tương đối có đuôi file
(`./SurfaceListCard.tsx`), hay một default import vốn không mang `imported` name nào để so. Một thẻ có
namespace, `<Ui.SurfaceListCard items={…} />`, là `JSXMemberExpression` nên không bao giờ khớp. Một
lớp trung gian — `const List = SurfaceListCard` rồi `<List items={…} />` — không nằm trong `bindings`.
Một spread, `<SurfaceListCard {...{items}} />`, là `JSXSpreadAttribute` và không có tên attribute. Và
bản thân cái lane sống sót qua một lần đổi tên: `rows`, `entries`, `data` là lane collection chung dưới
một từ khác, mà chỉ đúng chữ `items` mới bị canh.

**Ranh giới.** Luật máy này xét một attribute trên một surface đã import. Còn collection đã dời vào
`props` có được đặt tên theo domain hay không, và surface có trót học domain đó hay không, là câu hỏi
của người đọc.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| chuẩn hóa dấu phân cách | `no-children-slot` và `no-surface-list-items-slot` đổi backslash thành `/` trước khi khớp, nên đường dẫn Windows quyết định y như nhau. `isInlineObjectType` không đọc đường dẫn nào cả |
| ngoài phạm vi | `create` trả về object visitor rỗng. Luật máy không tồn tại với file đó, chứ không phải cho file đó qua |
| component roots | `COMPONENT_ROOTS = ["src/components", "packages/ui/src", "src"]`, import từ `contract.mjs`; `isGoverned` bỏ entry `src` trần và khớp hai entry còn lại dưới dạng `/<root>/` ở bất kỳ đâu trong đường dẫn |
| miễn trừ registry | `isContractTableFile(path)` — `contracts/index.ts` dưới bất kỳ root được hỗ trợ nào — tắt `no-children-slot` cho file đó |
| phép duyệt shape | `isInlineObjectType` trả true trên `TSTypeLiteral`, đệ quy qua `TSParenthesizedType`, và `some` qua thành viên `TSIntersectionType` và `TSUnionType`. Không mở gì khác |
| bind surface | Một regex nguồn import, `/(?:^|\/)components\/branches\/SurfaceListCard$/`, cộng một phép so đúng `imported.name === "SurfaceListCard"`, sinh ra tập tên thẻ cục bộ mà visitor JSX sẽ nhìn |
| với ra ngoài file | Không có. Cả ba luật máy đọc một file; không luật máy nào mở một type đã import, một re-export hay chính component surface |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt, và chúng không lọt.

| Viết kiểu này | Vì sao vẫn nổ |
|---|---|
| `({label}: {label: string} & Base) => …` | `isInlineObjectType` duyệt qua các thành viên của intersection, nên một nửa vô danh là đủ |
| `({label}: ({label: string})) => …` | Type trong ngoặc được bóc ra trước khi thử |
| Một method signature không thân hàm, trong file khai báo | `TSEmptyBodyFunctionExpression` là một trong bốn dạng hàm được ghé |
| `interface XProps { children?: ReactNode }` | `TSPropertySignature` ghé thành viên của interface và của type literal như nhau |
| `function X({children, ...rest}: XProps)` | Một `children` destructure ở tham số bị báo như chính cái slot ấy đi vào bằng cửa khác |
| Cùng component đó trong monorepo tại `packages/ui/src/...` | `COMPONENT_ROOTS` mang sẵn bố cục đó, nên hàng rào đứng ở cả hai repository chứ không im lặng ở cả hai |
| Đường dẫn Windows với backslash | Cả hai phép thử phạm vi chuẩn hóa dấu phân cách trước |
| `import {SurfaceListCard as ListCard}` rồi `<ListCard items={…} />` | Tập binding khóa theo `imported.name` và lưu tên cục bộ, nên một alias vẫn bị canh |
| `<SurfaceListCard items={tasks} className="…" />` | Mọi `JSXAttribute` trên thẻ đã khớp đều được quét; các attribute khác không đổi gì |

**Đang mở** — mù đã xuất xưởng. Một phán quyết không được nói rằng những thứ này đã được xét.

| Phạm vi | Cái gì lọt |
|---|---|
| `no-inline-parameter-type` | **Một tham số không annotation**, **một shape cách đúng một utility type** — `Readonly<{…}>`, `Partial<{…}>`, `{…}[]` — và **bất kỳ cái tên nào**, vì `XProps` cho component `X` chỉ được đọc chứ không bao giờ được kiểm |
| `no-children-slot` | **Một key viết trong nháy hoặc computed**, **một lỗ markup mang tên khác** như `content: ReactNode`, **`PropsWithChildren` hay bất kỳ props type nào import về**, **`const {children} = props` trong thân hàm**, **một đường dẫn ngoài hai component root**, và **trọn nửa khẳng định** — không gì kiểm rằng `contract` và `render` xuất hiện cùng nhau, hay rằng một closed shape chưa mọc thêm `render` |
| `no-surface-list-items-slot` | **Mọi surface dùng chung khác**, **một barrel, một re-export, một đuôi file trong đường dẫn hay một default import**, **một thẻ có namespace**, **một binding gián tiếp**, **một spread attribute**, và **đúng cái lane chung đó viết thành `rows`, `entries` hay `data`** |
| không luật máy nào | **Mọi thứ mà `SLOTS-1`, `SLOTS-2`, `SLOTS-5` và `SLOTS-6` cấm** — một handler đi trong `props`, một data shape khai bằng `interface`, một component tự quyết trạng thái chờ, và `className`, `style`, prop khoảng cách hay hook style theo từng phần. Ba trong số đó do type giữ, ở mọi nơi tier alias được dùng; một props type viết tay chưa từng dùng tier alias thì không có gì giữ, còn `SLOTS-5` thì không có gì giữ ở bất cứ đâu |

Dòng cuối đó là bản tóm tắt trung thực: trong bảy mã, ba do luật máy ở đây giữ, ba do một hình dạng
chỉ giữ được ở nơi hình dạng ấy được dùng, và một do người đọc giữ.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| tên file | Đường dẫn đúng như luật máy nhìn thấy, dấu phân cách chuẩn hóa thành `/` |
| quyết định phạm vi | Cổng nào đã khớp — `isGoverned`, `/src/`, hay không cổng nào cả — hoặc không cổng nào khớp |
| annotation tham số | `typeAnnotation.typeAnnotation` của mọi tham số hàm, và loại node ở từng lớp của nó |
| key của property | Mọi key `TSPropertySignature`, và mọi key property trong `ObjectPattern`, kèm loại node của cha và ông |
| import specifier | Chuỗi source đã chuẩn hóa, `imported.name` và `local.name` của từng specifier |
| thẻ và attribute JSX | Mọi thẻ mở `JSXIdentifier`, và từng tên `JSXAttribute` trên các thẻ đã khớp một binding |

## Quy tắc

1. Alias là trọn hình dạng; không có slot thứ tư nào để thêm.
2. Dữ liệu và hành vi đi ở hai slot khác nhau.
3. Mọi shape của tham số đều có tên trong module khai nó.
4. `contract` và `render` xuất hiện cùng nhau hoặc không xuất hiện.
5. Tầng sở hữu request là tầng viết `isLoading` và không bao giờ nhận `isLoading`.
6. Diện mạo được quyết định bên trong component, dưới một cái tên.
7. Một surface dùng chung không học mô hình collection của bất kỳ người gọi nào.
8. Mỗi component một tier alias; component cần một alias khác là component đã chọn nhầm tầng.
9. Danh tính của một luật máy là cái tên đã xuất bản của nó. Mã `SLOTS-<n>` gọi tên tình huống, ổn
   định, được trích dẫn từ ngoài module, và không bao giờ bị đánh số lại.
10. Không luật máy nào nhận option: cả ba đều khai `schema: []`. Severity là núm vặn duy nhất một
    repository có, và mức đã xuất bản là `error` cho cả ba dưới tiền tố `starci-fe/`.
11. Mỗi luật máy đọc đúng một file. Không luật máy nào mở một type đã import hay chính component
    surface.
12. Ngoài phạm vi nghĩa là không visitor nào được cài, không phải file đã qua.
13. `no-inline-parameter-type` báo mỗi tham số vi phạm một lần; `no-children-slot` mỗi node `children`
    một lần; `no-surface-list-items-slot` mỗi attribute vi phạm một lần.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ nương nhẹ. Mỗi ngoại lệ đều đóng và nêu rõ mã nó giải
phóng.

- **Bảng registry.** `SLOTS-4` không áp cho chính bảng contract, nơi một ngữ pháp con có tên mô tả thứ
  mà một key chấp nhận. Báo nó là bắt đúng cái file đã xóa bỏ lỗ vô danh phải thôi mô tả thứ đã thay
  cho lỗ đó. Ngoại lệ này nằm trong mã: `isContractTableFile` cắt ngang `isGoverned`.
- **Ngoài các component tier.** Một routed page không bị `SLOTS-4` quản; nhận thứ framework trao là
  việc duy nhất một page được phép làm. File route của framework được nhận ReactNode, và phải đóng nó
  thành một projection có tên trước khi ghép component. Ngoại lệ này cũng nằm trong mã, dưới dạng
  entry `src` trần bị bỏ.
- **Các shell đóng.** `SLOTS-4` miễn cho những shell trao thẳng phần bên trong cho cơ chế vendor —
  modal, drawer và dropdown — vì chúng không sắp xếp gì và không thể từ chối một hình dạng do vendor
  khai. Danh sách là bốn file, gọi theo tên; không có miễn trừ theo cả thư mục. Ngoại lệ này sống
  trong lời của luật chứ không trong luật máy: một shell nằm trong component tier vẫn bị
  `no-children-slot` báo như mọi file khác.
- **Hai lane cho `render`.** `SLOTS-4` được thỏa bằng slot đã bind và bằng một component type có
  thương hiệu ổn định. Lane nào áp dụng là do dữ liệu runtime có lặp hay không quyết định, không phải
  do sở thích. Không luật máy nào đọc lane nào cả.
- **Một tham số vô hướng.** `SLOTS-3` quản các shape. Một tham số kiểu `string` không phải một shape
  không nơi tra cứu và không cần alias — và `isInlineObjectType` trả false cho nó mà chẳng cần ai dặn.

Không luật máy nào khai option, allowlist hay lối tắt riêng cho từng file. Lối ra duy nhất còn lại là
một comment disable, và module này không cấp cái nào. Repository nào cần một cái là đang thay đổi luật,
việc đó thuộc về lịch sử của module — không thuộc về một dòng comment phía trên tham số.

## Đầu ra

Mỗi finding một block:

```text
file: <path as the rule sees it, forward slashes>
rule: <no-inline-parameter-type | no-children-slot | no-surface-list-items-slot>
scope: <in | out — the gate that decided it, or "no gate">
report: <inline | slot | items> at <node>
code: <SLOTS-3 | SLOTS-4 | SLOTS-7>
hatch: <the open hatch that would have hidden this, or none>
```

Một file sạch và trong phạm vi xuất một block cho mỗi luật máy đã chạy, với `report: none` và
`hatch: none`. Một file ngoài phạm vi xuất một block cho mỗi luật máy với `scope: out` và
`report: unjudged` — không bao giờ là `report: none`, vì không visitor nào đã nhìn.

## Ví dụ đã giải

**Đầu vào.** Một branch nằm trong component tier, `components/branches/ModalBranch/index.tsx`, và
một call site dưới `app/tasks/page.tsx`:

```tsx
// src/components/branches/ModalBranch/index.tsx
type ModalBranchProps = { readonly children?: ReactNode }

export function ModalBranch({ children }: ModalBranchProps) {
  return <VendorModal>{children}</VendorModal>
}

export const ModalTitle = ({ text }: { readonly text: string } & Sized) => <h2>{text}</h2>
```

```tsx
// src/app/tasks/page.tsx
import { SurfaceListCard } from "@/components/branches/SurfaceListCard"

export default function TasksPage() {
  return <SurfaceListCard items={tasks} contract="task-list" render={render} />
}
```

File branch nằm dưới `/src/components/` và không phải bảng contract, nên `isGoverned` nhận nó và
`no-children-slot` chạy; `no-inline-parameter-type` chạy trên cả hai file vì nó không có cổng; cả hai
file đều chứa `/src/`, nên `no-surface-list-items-slot` ở trong phạm vi với cả hai.

```text
file: src/components/branches/ModalBranch/index.tsx
rule: no-children-slot
scope: in — isGoverned, root src/components, not the contract table
report: slot at TSPropertySignature children
code: SLOTS-4
hatch: none
```

```text
file: src/components/branches/ModalBranch/index.tsx
rule: no-children-slot
scope: in — isGoverned, root src/components, not the contract table
report: slot at Property children in ObjectPattern
code: SLOTS-4
hatch: none
```

Hai finding chứ không phải một: thành viên đã khai và key destructure là cùng một slot đi vào bằng hai
cửa, và mỗi cái được báo ngay chỗ nó được viết.

```text
file: src/components/branches/ModalBranch/index.tsx
rule: no-inline-parameter-type
scope: in — no gate; this rule visits every parsed file
report: inline at TSTypeAnnotation of ({ text }) in ModalTitle
code: SLOTS-3
hatch: none
```

```text
file: src/app/tasks/page.tsx
rule: no-surface-list-items-slot
scope: in — filename includes /src/, binding SurfaceListCard from @/components/branches/SurfaceListCard
report: items at JSXAttribute items
code: SLOTS-7
hatch: none
```

Sau khi sửa, branch khai `contract` và `render` rồi trao phần bên trong đi tiếp dưới dạng một
projection có tên, title nhận một props type có tên, và collection đi trong `props` dưới tên domain
của nó:

```tsx
// src/components/branches/ModalBranch/index.tsx
type ModalBranchProps = {
  readonly contract: ModalContract
  readonly render: ModalRender
}

type ModalTitleProps = { readonly text: string } & Sized

export function ModalBranch({ contract, render }: ModalBranchProps) {
  return <Tree contract={contract} render={render} />
}

export const ModalTitle = ({ text }: ModalTitleProps) => <h2>{text}</h2>
```

```tsx
// src/app/tasks/page.tsx
import { SurfaceListCard } from "@/components/branches"

export default function TasksPage() {
  return <SurfaceListCard props={{ tasks }} contract="task-list" render={render} />
}
```

Bản sửa là thật, và hai trong số các luật máy này lẽ ra đã im lặng vì lý do sai. Đổi import sang barrel
là không còn gì bind:

```text
file: src/app/tasks/page.tsx
rule: no-surface-list-items-slot
scope: in — filename includes /src/
report: none
code: SLOTS-7
hatch: the import source must end exactly with components/branches/SurfaceListCard, so a barrel import leaves bindings empty and the tag is never examined — the lane is invisible rather than absent
```

Và đúng hình dạng đó sống sót qua một utility type ở tham số:

```tsx
export const ModalTitle = ({ text }: Readonly<{ text: string }>) => <h2>{text}</h2>
```

```text
file: src/components/branches/ModalBranch/index.tsx
rule: no-inline-parameter-type
scope: in — no gate
report: none
code: SLOTS-3
hatch: the annotation is a TSTypeReference and isInlineObjectType recurses only through parentheses, intersections and unions, so the shape still has no name and nothing reports it
```

## Phạm vi

Module này ghi lại việc cưỡng chế, không ghi lại luật. Nó không gọi tên sản phẩm, thư viện component
hay repository nào. Tên luật máy, message id, token mã và tiền tố plugin là những định danh xuất hiện
trong build output nên được chép lại nguyên văn; mọi thứ viết quanh chúng là TSX bình thường. Phần do
type giữ — `SLOTS-1`, `SLOTS-2`, `SLOTS-6` — thuộc về `@starci/eslint-canon-fe/props`, còn phần không gì giữ —
`SLOTS-5` — thuộc về người đọc.
