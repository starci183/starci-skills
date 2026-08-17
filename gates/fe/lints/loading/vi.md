---
title: Loading · Vietnamese
---

# Trạng thái chờ

Đầu vào là mã đã viết xong — một tệp, một mẩu diff. Đầu ra là một **phán quyết**: tệp có nằm trong
phạm vi hay không, quy tắc đã xuất bản nào đã nổ, nó báo gì và trên nút nào, mã luật tương ứng là gì,
và cửa còn mở nào lẽ ra đã che đúng lỗi đó. Mô-đun này không chọn hình dạng lúc chờ. Nó từ chối một
hình dạng, và phải chỉ được đúng tên tệp, đúng thuộc tính hoặc đúng biểu thức ba ngôi mà nó từ chối.

## Luật

Một bề mặt đang chờ dữ liệu vẽ đúng cái hình dạng nó sẽ vẽ khi dữ liệu về, chỉ rút các giá trị ra. Một
cây thứ hai mô tả cây thứ nhất thì đúng vào ngày nó được viết và sai ngay lần đầu hình dạng thật thay
đổi, mà chẳng có gì đỏ lên khi điều đó xảy ra: một hình dạng lúc chờ **không có mệnh đề nào để sai**.
Đó chính là toàn bộ lý do luật này đáng có máy giữ — nó là loại khuyết tật mà không trình biên dịch nào
và không bài test nào sẽ báo.

Luật nằm ở `patterns/fe/loading/INDEX.md` và mang bảy mã, `LOADING-1` tới `LOADING-7`. Các quy tắc ghi
ở đây giữ **hai** trong bảy mã đó. Năm mã còn lại không có người giữ, và điều này được nói thẳng chứ
không ngầm hiểu: một luật không ai giữ thì được biết là chưa được thực thi, và đó là tình trạng an toàn
hơn một quy tắc rò rỉ mà người ta tưởng đã kín.

## Luật máy đã xuất bản

Ba quy tắc được xuất bản. Danh tính của chúng là cái tên mà bản build in ra; không có mã số riêng cho
quy tắc, mã số chỉ thuộc về luật mà nó giữ.

| Quy tắc | Mã | Nó báo gì |
|---|---|---|
| `no-resting-twin-component` | `LOADING-1` | `twin` — chính tệp này **là** một bản sao dựng tay, đặt tên theo thành phần nó chép lại. Báo một lần trên `Program`, nên cả tệp là phát hiện. |
| `no-placeholder-prop` | `LOADING-1` | `prop` — một cây dựng sẵn được trao vào qua thuộc tính `skeleton`, `placeholder` hoặc `fallback`. `import` — một binding `*Skeleton` nhập vào theo đường dẫn tương đối. |
| `no-resting-branch-at-call-site` | `LOADING-2` | `branch` — một cờ chờ chọn giữa **hai** phần tử gốc **khác nhau**, trích nguyên văn bản của cờ (40 ký tự đầu). |

Hai quy tắc cùng giữ một mã, vì `LOADING-1` cấm hai dáng của cùng một sai lầm: một bản sao khai báo
thành tệp, và một bản sao trao vào qua prop.

Không quy tắc nào giữ `LOADING-3` (chiều cao bị co), `LOADING-4` (im lặng với công nghệ trợ giúp),
`LOADING-5` (một điều khiển chưa có nơi để đi), `LOADING-6` (một cờ trải khắp các vùng độc lập) hay
`LOADING-7` (trạng thái chờ là một thành viên của union). Năm mã đó **không có quy tắc nào cả** — chúng
chưa được thực thi, không phải đã được phủ, và một lần chạy xanh không nói gì về bất kỳ mã nào trong số
đó. Chúng nằm ở `audit.md`, không nằm ở đây: một quy tắc không chỉ được vào đâu thì mới chỉ là đề xuất.

## Đọc một diff

1. **Quyết định phạm vi trước tiên, và ghi lại.** Đường dẫn đã chuẩn hoá phải chứa `/src/components/`.
   Ngoài phạm vi không có nghĩa là tệp đã sạch — `create` trả về đối tượng thăm rỗng và quy tắc không
   tồn tại đối với tệp đó.
2. **Kiểm tra ngoại lệ ngay sau đó.** Tên tệp khớp `/\.(?:test|spec)\.(?:ts|tsx)$/` là vật liệu đối
   chiếu và được miễn cả ba quy tắc. Thuộc tính `placeholder` mang một chuỗi được miễn có chủ đích. Một
   biểu thức ba ngôi có `null` ở một nhánh cũng được miễn có chủ đích.
3. **Đọc đúng những nút mà quy tắc thật sự thăm.** Tên tệp cho `no-resting-twin-component`;
   `JSXAttribute` và `ImportDeclaration` cho `no-placeholder-prop`; `ConditionalExpression` cho
   `no-resting-branch-at-call-site`. Mọi thứ khác trong tệp không phải là bằng chứng.
4. **Xuất một khối cho mỗi phát hiện** — nhiều nhất một `twin` cho mỗi tệp, một `prop` cho mỗi thuộc
   tính phạm luật, một `import` cho mỗi specifier phạm luật, một `branch` cho mỗi ba ngôi phạm luật.
5. **Viết dòng `hatch` mỗi khi có một cửa còn mở lẽ ra đã che đúng lỗi đó**, kể cả trên một tệp không
   báo gì.
6. **Không báo cái mà không quy tắc nào canh.** Năm trong bảy mã không có máy giữ; một phán quyết nói
   khác đi là hiểu sai mô-đun này.

## `no-resting-twin-component` — LOADING-1

**Nó báo cái gì.** `twin` — một báo cáo cho mỗi tệp, trên `Program`, nên **cả tệp** là phát hiện, không
phải một dòng nào bên trong.

**Nó phát hiện bằng gì.** **Chỉ bằng tên tệp. Nội dung tệp không bao giờ được phân tích để ra quyết
định này.** `context.filename` được khớp với `/\/([A-Za-z0-9]*Skeleton)\/index\.tsx?$/`, rồi với
`/\/([A-Za-z0-9]*Skeleton)\.tsx?$/`; đoạn bắt được đem thử lại với `^[A-Za-z0-9]*Skeleton$`. Trúng thì
nó đăng ký một bộ thăm `Program` và báo trên chính nút mà trình phân tích trao cho.

**Nó không thấy gì.** Bất kỳ bao nhiêu bản sao **khai báo bên trong một tệp có tên hợp lệ**:
`export const AvatarSkeleton = () => …` nằm trong `Avatar/index.tsx` — quy tắc không bao giờ soi khai
báo, nó là một quy tắc theo tên tệp khoác áo bộ thăm AST. Cũng vậy với bản sao mang bất kỳ chữ nào
khác: `AvatarPlaceholder`, `AvatarLoading`, `AvatarShimmer`, `AvatarResting`, `avatar-skeleton.tsx`,
`Card.Skeleton.tsx` — mẫu là chữ `Skeleton` viết đúng hoa thường trong một đoạn chỉ gồm `[A-Za-z0-9]`,
nên một dấu chấm hay một gạch nối trong tên tệp là hết khớp. `AvatarSkeleton/view.tsx` và
`AvatarSkeleton/render.tsx`, nơi thư mục được đặt tên còn tệp thì không phải `index`, cũng thoát: mẫu
thứ nhất đòi `index`, mẫu thứ hai đòi tên bản sao nằm trên chính tệp. Và `AvatarSkeleton.jsx` thoát —
mẫu phần mở rộng là `tsx?`, không có `jsx` trong đó.

**Ranh giới.** Quy tắc này xử một cái tên trên đĩa. Việc một cây nghỉ được trao qua như một giá trị
thuộc về `no-placeholder-prop`; việc nó được viết thẳng tại nơi gọi thuộc về
`no-resting-branch-at-call-site`.

## `no-placeholder-prop` — LOADING-1

**Nó báo cái gì.** `prop` — một cây dựng sẵn trao vào qua một thuộc tính. `import` — một binding
`*Skeleton` nhập vào theo đường dẫn tương đối. Hai báo cáo, một tội: một bản sao mà chính thành phần bị
mô tả cũng không nhìn thấy.

**Nó phát hiện bằng gì.** Nửa `prop` là một bộ thăm `JSXAttribute`. `name.type` của thuộc tính phải là
`JSXIdentifier` và `name.name` phải đúng bằng `skeleton`, `placeholder` hoặc `fallback`. Giá trị phải
là một `JSXExpressionContainer` mà `expression.type` là `JSXElement` hoặc `JSXFragment`. Ba cái tên,
một loại container, hai loại biểu thức — không xét gì thêm. Nửa `import` là một bộ thăm
`ImportDeclaration`. `node.source.value` phải là chuỗi khớp `/^\.\.?\//` — một đường dẫn tương đối.
Từng `local.name` của specifier được thử với `^[A-Za-z0-9]*Skeleton$`, trừ đúng chuỗi `Skeleton` ra, vì
đó là nguyên thuỷ mà một thành phần **nghỉ bằng**, không phải bản sao của một thành phần.

**Nó không thấy gì.** Phần tử được gom vào một cái tên trước: `const resting = <AvatarBar/>` rồi
`skeleton={resting}`. Tương tự `skeleton={SHAPES.avatar}`, `skeleton={renderResting()}`,
`skeleton={<AvatarBar/> as ReactNode}`, `fallback={isWide ? <A/> : <B/>}` — phép kiểm tra đặt trên
`expression.type`, mà một `Identifier`, `MemberExpression`, `CallExpression`, `TSAsExpression` hay
`ConditionalExpression` đều không phải `JSXElement`, và không có gì đi theo tham chiếu đó. Truyền chính
thành phần thay vì một phần tử, `skeleton={AvatarBar}`, thoát vì cùng lý do: một tham chiếu không phải
một phần tử. Bất kỳ tên thuộc tính thứ tư nào cũng thoát — `loadingView={<X/>}`, `restingSlot={<X/>}`,
`renderSkeleton={() => <X/>}`, `emptyState={<X/>}` — danh sách tên đóng ở ba, và một hàm trả về phần tử
là một `JSXExpressionContainer` chứa `ArrowFunctionExpression`. **Cây nằm trong một prop dạng đối
tượng** — `props={{ fallback: <AvatarBar/> }}` — là một `Property` trong `ObjectExpression`, không phải
`JSXAttribute`; ở nơi mọi thứ đều đi qua một prop đối tượng, quy tắc này gần như không thấy gì. Ở nửa
import, `import { AvatarSkeleton } from "@/components/leaves/AvatarSkeleton"` thoát vì nguồn phải bắt
đầu bằng `./` hoặc `../`, mà alias mới là cách nhập thông thường.
`import { AvatarSkeleton as Resting } from "./x"` và `import * as Shapes from "./skeletons"` thoát vì
chỉ `specifier.local.name` được đọc — tên gốc không bao giờ được đọc, nên đổi tên ngay tại chỗ nhập là
một lối thoát trọn vẹn. Và `import { AvatarPlaceholder } from "./x"` thoát vẫn trên chữ `Skeleton` đó.

**Ranh giới.** Quy tắc này xử một thuộc tính và một specifier nhập trong đúng một tệp. Nó không bao giờ
mở mô-đun được nhập, và không bao giờ hỏi xem bản sao mà nó gọi tên có tồn tại hay không.

## `no-resting-branch-at-call-site` — LOADING-2

**Nó báo cái gì.** `branch` — một cờ chờ chọn giữa hai phần tử gốc khác nhau, trích nguyên văn bản của
cờ, 40 ký tự đầu.

**Nó phát hiện bằng gì.** Một bộ thăm `ConditionalExpression`. Điều kiện được đọc ngược lại thành **văn
bản nguồn** — `sourceCode.getText(node.test)` — rồi khớp với `/\bis(?:Loading|Skeleton|Pending)\b/`.
Mỗi nhánh được rút về một chuỗi duy nhất: một `JSXElement` thành tên thẻ mở của nó (`JSXIdentifier`,
hoặc `object.property` với `JSXMemberExpression`), một `JSXFragment` thành `"<>"`, mọi thứ khác thành
`null`. Nó chỉ báo khi cả hai chuỗi đều tồn tại **và khác nhau**. Chính phép rút gọn đó là chi tiết chịu
lực của cả mô-đun này: quy tắc so **tên phần tử gốc**, không so cây.

**Nó không thấy gì.** **Cùng một thẻ gốc ở cả hai nhánh**:
`isLoading ? <div className="h-4 animate-pulse"/> : <div><Avatar/><Text/></div>` — hai nhánh đều rút về
`div`, hai chuỗi bằng nhau, và quy tắc trả về; hai cây hoàn toàn khác nhau đi qua như một. Bọc chung một
vỏ cũng vậy: `isLoading ? <Row><Bar/></Row> : <Row><Avatar/><Text/></Row>`. Đọc trạng thái ngay tại chỗ,
`input.state === "pending" ? <AvatarBar/> : <Avatar/>`, thì vô hình: mẫu cờ đòi đúng chữ `is` đứng trước
`Loading`, `Skeleton` hoặc `Pending`, và một thành viên union viết là `"pending"` đúng là biểu thức mà
đoạn "đường nối" của chính luật đang nói tới. Một cờ có thêm danh từ — `isLoadingCourses ? <A/> : <B/>`,
`isPendingReview ? <A/> : <B/>` — thoát vì `\b` sau `Loading` gãy khi ký tự tiếp theo vẫn là ký tự từ;
thêm một danh từ vào cờ là gỡ mất quy tắc. Một cách gọi khác của "đang chờ" — `loading`, `busy`,
`isFetching`, `isWaiting`, `!data` — không được nhận ra; chỉ ba cách viết được nhận. Nhánh viết bằng bất
cứ dạng nào ngoài ba ngôi đều thoát: `if (isLoading) return <AvatarBar/>`, cặp `{isLoading && <AvatarBar/>}`
đứng cạnh `{!isLoading && <Avatar/>}`, hay một `switch` trên union trạng thái — chỉ `ConditionalExpression`
được thăm. Và chọn thành phần vào một cái tên, `const El = isLoading ? AvatarBar : Avatar` rồi `<El/>`,
thoát vì hai nhánh đều là `Identifier`, `armName` trả `null`, và quy tắc từ chối xử.

**Ranh giới.** `null` ở một nhánh không bao giờ bị báo. Một điều khiển chưa có nơi để đi là `LOADING-5`
đang **đúng**, không phải một cây thứ hai — và `LOADING-5` thì không có quy tắc nào giữ.

## Cách phát hiện

Mọi quy tắc đều hỏi tệp cùng một câu trước tiên, và không hỏi gì khác:

| Cổng | Cơ chế |
|---|---|
| chuẩn hoá đường dẫn | `String(filename).replace(/\\/g, "/")` — đường dẫn dùng gạch chéo ngược được so như mọi đường dẫn khác |
| trong phạm vi | `normalizePath(context.filename).includes("/src/components/")` — một phép thử chuỗi con thuần tuý |
| ngoài phạm vi | `/\.(?:test|spec)\.(?:ts|tsx)$/` — một bản sao dựng tay bên trong test là vật liệu đối chiếu |

Rồi, theo từng quy tắc:

| Quy tắc | Cơ chế |
|---|---|
| `no-resting-twin-component` | Chỉ tên tệp, không bao giờ nội dung: `/\/([A-Za-z0-9]*Skeleton)\/index\.tsx?$/`, rồi `/\/([A-Za-z0-9]*Skeleton)\.tsx?$/`, đoạn bắt được thử lại với `^[A-Za-z0-9]*Skeleton$`, báo một lần trên `Program` |
| `no-placeholder-prop` (`prop`) | `JSXAttribute` — tên dạng `JSXIdentifier` nằm đúng trong `skeleton`, `placeholder`, `fallback`; giá trị là `JSXExpressionContainer`; `expression.type` là `JSXElement` hoặc `JSXFragment` |
| `no-placeholder-prop` (`import`) | `ImportDeclaration` — `node.source.value` khớp `/^\.\.?\//`, từng `specifier.local.name` khớp `^[A-Za-z0-9]*Skeleton$`, trừ đúng chuỗi `Skeleton` |
| `no-resting-branch-at-call-site` | `ConditionalExpression` — `sourceCode.getText(node.test)` khớp `/\bis(?:Loading|Skeleton|Pending)\b/`, mỗi nhánh rút về một chuỗi, chỉ báo khi cả hai tồn tại và khác nhau |

Không có gì với ra ngoài tệp đang lint: không thông tin kiểu, không phân giải mô-đun, không đọc chéo
tệp, không cấu hình.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt qua, nhưng không.

| Viết theo cách này | Vì sao vẫn nổ |
|---|---|
| Dấu phân cách đường dẫn kiểu Windows trong kho đích | `normalizePath` đổi `\` thành `/` trước mọi phép khớp |
| Chôn bản sao sâu hơn: `.../leaves/media/AvatarSkeleton/index.tsx` | Cả hai mẫu neo vào dấu `/` cuối cùng, ở độ sâu bất kỳ |
| Bỏ chữ `x`: `AvatarSkeleton.ts` | `tsx?` khớp cả `.ts` lẫn `.tsx` |
| Một cây rỗng: `skeleton={<></>}` | `JSXFragment` được xử lý cạnh `JSXElement` |
| Leo thật xa: `import { AvatarSkeleton } from "../../leaves/AvatarSkeleton"` | `^\.\.?\/` khớp mọi độ sâu tương đối |
| `placeholder="Search"` trên một ô nhập văn bản | Chỉ `JSXExpressionContainer` chứa một phần tử mới bị báo; một chuỗi được để yên có chủ đích |
| Phủ định cờ: `!isLoading ? <Avatar/> : <Bar/>` | Điều kiện được khớp như văn bản; `\bisLoading\b` vẫn nằm trong đó |
| Nghỉ bằng một fragment trần: `isLoading ? <></> : <Avatar/>` | `"<>"` là một cái tên như mọi cái tên khác, và nó khác `Avatar` |
| Hai nửa của cùng một namespace: `isPending ? <Card.Bar/> : <Card.Body/>` | `JSXMemberExpression` rút về `Card.Bar` và `Card.Body` |
| Viết tội ở một page rồi nhập vào | Không bắt được gì, nhưng cũng không tuyên bố gì — xem hàng Mở đầu tiên |

**Còn mở** — vùng mù đã xuất xưởng, mỗi hàng đọc thẳng ra từ mã cài đặt. Một phán quyết không được
tuyên là đã xử những chỗ này.

| Phạm vi | Cái gì đi lọt |
|---|---|
| cả ba | **Cùng một tội viết ở ngoài `/src/components/`** — một thư mục route, một thư mục feature, một gói thứ hai, hay bất kỳ cây nào đặt tên thư mục khác đi. Phạm vi là một phép thử chuỗi con trên đường dẫn: đổi tên thư mục là gỡ cả ba quy tắc cùng lúc, trong im lặng, và bản build vẫn xanh |
| cả ba | **Một tệp tên `*.stories.tsx`.** Chỉ `.test.` và `.spec.` được coi là vật liệu đối chiếu, nên một bản trình diễn các hình dạng lúc chờ bị xử như mã sản phẩm |
| `no-resting-twin-component` | **Bản sao khai báo bên trong một tệp có tên hợp lệ**, **cùng bản sao dưới bất kỳ chữ nào khác**, **`AvatarSkeleton/view.tsx`**, và **`AvatarSkeleton.jsx`** |
| `no-placeholder-prop` (`prop`) | **Phần tử được gom vào một cái tên trước**, **một tham chiếu thành phần thay vì một phần tử**, **bất kỳ tên thuộc tính thứ tư nào**, và **cây nằm trong một prop dạng đối tượng** |
| `no-placeholder-prop` (`import`) | **Nguồn dạng alias hoặc bare specifier**, **đổi tên ngay tại chỗ nhập**, **nhập cả namespace**, và **bất kỳ chữ nào khác `Skeleton`** |
| `no-resting-branch-at-call-site` | **Cùng một thẻ gốc ở cả hai nhánh**, **đọc trạng thái ngay tại chỗ**, **một cờ có thêm danh từ**, **một cách gọi khác của "đang chờ"**, **mọi dạng viết ngoài ba ngôi**, và **chọn thành phần vào một cái tên** |
| không quy tắc nào | **Toàn bộ những gì `LOADING-3` tới `LOADING-7` cấm** — chiều cao bị co, im lặng với công nghệ trợ giúp, một điều khiển chưa có nơi để đi, một cờ trải khắp các vùng độc lập, và trạng thái chờ là một thành viên của union |

Hàng cuối cùng là bản tổng kết trung thực: trong bảy mã, hai mã có người giữ, và hai mã có người giữ đó
bị một lần đổi tên bình thường đánh bại.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| `context.filename` | Đường dẫn tuyệt đối hoặc tương đối theo kho của tệp đang lint |
| quyết định phạm vi | Đường dẫn đã chuẩn hoá có chứa `/src/components/` hay không, và mẫu test/spec có khớp hay không |
| văn bản nguồn | Phân tích như TypeScript có JSX; riêng quy tắc nhánh còn đọc điều kiện của nó ngược lại thành văn bản |
| không gì khác | Không thông tin kiểu, không phân giải mô-đun, không đọc chéo tệp, không tuỳ chọn cấu hình — mọi quy tắc đều khai báo `schema: []` |

## Quy tắc

1. Danh tính của một quy tắc là tên nó công bố. Không có định danh thứ hai cho nó ở bất cứ đâu; mã số
   thuộc về luật mà nó giữ.
2. Mọi quy tắc đều `type: "problem"` và không nhận tuỳ chọn nào.
3. Phạm vi được quyết định trước tiên; ngoài `/src/components/` thì `create` trả về đối tượng thăm rỗng
   và quy tắc không tốn gì.
4. Quy tắc bản sao báo nhiều nhất một lần cho mỗi tệp, trên `Program`.
5. `null` ở một nhánh của ba ngôi chờ không bao giờ bị báo: một điều khiển chưa có nơi để đi là
   `LOADING-5` đang đúng, không phải một cây thứ hai.
6. Cái tên trần `Skeleton` không bao giờ là một bản sao. Nó là nguyên thuỷ mà một thành phần **nghỉ
   bằng**.
7. Không quy tắc nào đưa bản vá tự động. Mọi phát hiện đều là một quyết định hình dạng mà con người
   phải làm.
8. Chỉ ghi ở đây những quy tắc có thật trong tệp nguồn. Một quy tắc "đáng lẽ nên có" thuộc về
   `audit.md`.
9. Mỗi quy tắc đều có ít nhất một hàng trung thực ở bảng cửa còn mở. Viết "không có" cho gọn thì nguy
   hiểm hơn cả việc không có quy tắc nào.
10. Mức nghiêm trọng công bố, xuất ra dưới tên `recommended`, là `error` cho cả ba.

## Ngoại lệ

Ngoại lệ là một phần của quy tắc, không phải sự nới tay.

- **Tệp test.** Tệp kết thúc bằng `.test.ts`, `.test.tsx`, `.spec.ts` hoặc `.spec.tsx` được miễn cả ba.
  Một bản sao dựng tay trong test là vật liệu để đối chiếu, không phải bản mô tả thứ hai mà ai đó vẽ ra
  màn hình.
- **Ngoài cây thành phần.** Ghi ra như một ngoại lệ vì nó rộng nhất: ba quy tắc chỉ quản cây thành
  phần, không quản gì khác.
- **Nguyên thuỷ nghỉ.** Một binding có tên cục bộ đúng bằng `Skeleton` được miễn ở nửa `import` của
  `no-placeholder-prop`. Nó **không** được miễn ở `no-resting-twin-component`, và chỗ bất nhất này là
  một phát hiện — xem `audit.md`.
- **Ba ngôi có `null` một bên.** Cố ý bỏ qua; nó giải phóng `LOADING-5`, mã mà không quy tắc nào giữ.
- **Thuộc tính `placeholder` dạng chuỗi của một ô nhập văn bản.** Một giá trị chuỗi không bao giờ bị
  báo.

## Đầu ra

Một lần chạy xuất ra các phát hiện lint thông thường. Tên quy tắc là toàn bộ danh tính; không in gì
khác để nhận ra luật nào bị vi phạm:

```text
<file>:<line>:<column>  error  <message>  starci-fe/<rule-name>
```

Mỗi phát hiện một khối phán quyết:

```text
file: <path as the rule sees it, forward slashes>
rule: <no-resting-twin-component | no-placeholder-prop | no-resting-branch-at-call-site>
scope: <in | out — the path test that decided it>
report: <twin | prop | import | branch> at <node>
code: <LOADING-1 | LOADING-2>
hatch: <the open hatch that would have hidden this, or none>
```

Một tệp sạch nằm trong phạm vi xuất một khối với `report: none` và, ở đâu có cửa còn mở, dòng `hatch`
nói vì sao sự im lặng đó không phải là tuân thủ. Một tệp ngoài phạm vi xuất `scope: out`,
`report: none` và `code: none` — không bộ thăm nào được cài, nên không có gì về nó được xử cả.

Một kho áp dụng bộ quy tắc này khi đã có lịch sử nên chuẩn bị tinh thần rằng quy tắc bản sao sẽ báo cả
một thư mục một lúc: những cây placeholder giữ tay luôn đến theo bầy, mỗi màn hình một cây, và mỗi cây
là một hình dạng có thật phải được gấp lại vào thành phần nó chép, chứ không phải xoá đi.

## Ví dụ đã giải

**Đầu vào.** Hai tệp dưới `components/leaves/Avatar/`:

```tsx
// src/components/leaves/AvatarSkeleton/index.tsx
export const AvatarSkeleton = () => (
  <Row><Bar className="h-4 w-24" /></Row>
)
```

```tsx
// src/components/leaves/Avatar/index.tsx
import { AvatarSkeleton } from "../AvatarSkeleton"

export const Avatar = ({ isLoading, name }) => (
  <Card skeleton={<AvatarSkeleton />}>
    {isLoading ? <AvatarSkeleton /> : <Person name={name} />}
  </Card>
)
```

Cả hai đường dẫn đều chứa `/src/components/` và không tệp nào kết thúc bằng `.test.` hay `.spec.`, nên
cả ba quy tắc đều được cài.

```text
file: src/components/leaves/AvatarSkeleton/index.tsx
rule: no-resting-twin-component
scope: in — /src/components/ substring, folder pattern AvatarSkeleton/index.tsx
report: twin at Program
code: LOADING-1
hatch: none
```

```text
file: src/components/leaves/Avatar/index.tsx
rule: no-placeholder-prop
scope: in — /src/components/ substring
report: import at ImportDeclaration "../AvatarSkeleton", specifier AvatarSkeleton
code: LOADING-1
hatch: none
```

```text
file: src/components/leaves/Avatar/index.tsx
rule: no-placeholder-prop
scope: in — /src/components/ substring
report: prop at JSXAttribute skeleton={<AvatarSkeleton />}
code: LOADING-1
hatch: none
```

```text
file: src/components/leaves/Avatar/index.tsx
rule: no-resting-branch-at-call-site
scope: in — /src/components/ substring
report: branch at ConditionalExpression, test "isLoading"
code: LOADING-2
hatch: none
```

**Đã sửa.** Tệp bản sao bị xoá, prop và import đi theo nó, và một hình dạng duy nhất tự vẽ chính mình
với các giá trị đã rút ra:

```tsx
// src/components/leaves/Avatar/index.tsx
export const Avatar = ({ isLoading, name }) => (
  <Card>
    <Person name={isLoading ? null : name} resting={isLoading} />
  </Card>
)
```

Nhưng một cửa còn mở sống sót qua bản sửa. Viết theo cách dưới đây thì đúng cái cây thứ hai đó vẫn xuất
xưởng, và mọi quy tắc đều im lặng:

```tsx
// src/components/leaves/Avatar/index.tsx
export const Avatar = ({ isLoadingProfile, name }) => (
  <Card>
    {isLoadingProfile
      ? <Row><Bar className="h-4 w-24" /></Row>
      : <Row><Person name={name} /></Row>}
  </Card>
)
```

```text
file: src/components/leaves/Avatar/index.tsx
rule: no-resting-branch-at-call-site
scope: in — /src/components/ substring
report: none
code: LOADING-2
hatch: two hatches at once — a qualified flag, because \b after Loading fails against the following word character in isLoadingProfile; and the same root tag on both arms, because each arm reduces to Row and equal strings return. Silence here is blindness, not compliance
```

## Phạm vi

Mô-đun này ghi phần thực thi cho một luật của một canon front-end, và chỉ hai mã có quy tắc. `LOADING-3`
tới `LOADING-7` thuộc về luật ở `patterns/fe/loading/INDEX.md` và về `audit.md`, không thuộc về máy nào
ở đây. Nó không gọi tên sản phẩm nào, thư viện thành phần nào hay kho mã nào trong lời văn lẫn trong ví
dụ. Tên quy tắc và tên gói là những định danh có xuất xưởng, nên được chép lại nguyên văn.
