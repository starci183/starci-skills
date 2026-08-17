---
title: Landmark · Vietnamese
---

# Landmark

Đầu vào là mã đã viết xong — một file, một mẩu diff. Đầu ra là một **phán quyết**: file có nằm trong
phạm vi hay không, rule đã xuất bản nào nổ, nó báo gì và trên node nào, mã luật tương ứng là gì, và
cửa mở nào đã có thể giấu đúng cái sai đó đi. Mô-đun này không chọn gì cả. Nó từ chối, và nó phải chỉ
được vào đúng phần tử mà nó từ chối.

## Luật

Landmark là nhóm nhỏ các phần tử mà người đọc có thể nhảy GIỮA chúng mà không cần đọc bên trong. Một
hộp trung tính và một landmark bày ra y hệt nhau, và chỉ một trong hai là lý do tồn tại của "skip to
main content".

Kho đăng ký làm cho sai sót này im lặng. Một khoá tên `<vùng>-main` ghi lại đúng ý định và vẽ ra một
hộp trung tính, vì nhánh vẽ node của kho đăng ký vẽ hộp trung tính. Không có gì đỏ lên: **tên trong
khoá không phải phần tử trong tài liệu.**

Luật là tập `LANDMARK-<n>` và nó phát biểu **năm mã. Hai trong số đó có rule.** Tài liệu này nói về
CÁCH GIỮ LUẬT chứ không nói về luật — thứ máy nhìn thấy được, và ở `## Lối thoát hợp lệ`, thứ máy
không nhìn thấy.

## Luật máy đã xuất bản

Danh tính của mỗi rule là TÊN của nó, vì đó là chuỗi mà build log in ra, mà một comment disable gọi
tên, và mà một cuộc trao đổi về lỗi ấy dùng để nói.

| Rule | Mã | Bắt gì |
|---|---|---|
| `routed-page-is-a-main-landmark` | `LANDMARK-4` | Một layout của route vừa vẽ children được route tới vừa tự dựng chrome, mà cả file không có landmark nào. |
| `main-landmark-belongs-to-a-route-file` | `LANDMARK-5` | Một landmark được vẽ ở file không sở hữu cả màn hình — mọi tầng dưới file route, và (với nhánh landmark) dưới cả bề mặt trang. |

`LANDMARK-1`, `LANDMARK-2` và `LANDMARK-3` **không có rule nào trong mô-đun này**. Chúng là **chưa
được giữ**, không phải đã được phủ: một nhánh cho mỗi phần tử landmark, một nhánh không sở hữu class
nào, và việc từ chối một prop chọn phần tử trên khung trung tính đều chỉ do review giữ. Một lần chạy
xanh không nói gì về cả ba mã ấy.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là file
   đã qua — nghĩa là không visitor nào chạy và rule không tồn tại cho file đó.
2. **`routed-page-is-a-main-landmark` đòi tên file khớp `/\/app\/(?:.*\/)?layout\.tsx$/`**, sau khi đã
   đổi `\` thành `/`. Thư mục router tên khác, đuôi file khác, thì rule biến mất.
3. **Kiểm miễn trừ trước khi đọc node.** `main-landmark-belongs-to-a-route-file` trả về rỗng với bất
   kỳ file nào có đoạn thư mục của chính nhánh landmark trong đường dẫn.
4. **Đọc các node.** Rule thứ nhất gom ba biến bool trên toàn bộ file; rule thứ hai xét từng
   `JSXOpeningElement` với hai vị từ theo tên file. Một landmark có hai hình dạng, và hình dạng quyết
   định tập file nào được phép giữ nó.
5. **Xuất một block cho mỗi finding**, và viết dòng `hatch` mỗi khi có một cửa mở đã có thể giấu đúng
   cái sai đó.
6. **Không báo thứ không rule nào canh.** Ba trong năm mã không có máy giữ, và một phần tử landmark
   viết tay bằng chữ thường vô hình với cả hai hình dạng; một phán quyết nói khác đi là nói sai về
   mô-đun.

## `routed-page-is-a-main-landmark` — LANDMARK-4

**Nó báo cái gì.** Một layout của route đã tự dựng chrome quanh trang được route tới mà không đánh dấu
landmark ở bất cứ đâu trong file. Một báo cáo, tại `Program:exit`.

**Nó phát hiện bằng gì.** Cổng theo `context.filename` khớp `/\/app\/(?:.*\/)?layout\.tsx$/` sau khi
đổi `\` thành `/`. Rồi ba biến bool độc lập gom trên toàn bộ file: một `JSXExpressionContainer` mà
biểu thức là `Identifier` tên `children`, **hoặc** bất kỳ `Identifier` tên `children` nào có cha không
phải `Property`; một `JSXOpeningElement` mang đúng tên nhánh khung trung tính ở dạng `JSXIdentifier`;
và bất kỳ phần tử landmark nào theo một trong hai hình dạng. Báo tại `Program:exit` khi hai cái đầu
đúng còn cái thứ ba sai.

**Nó không thấy gì.** Đổi tên prop khi destructure — `function Layout({ children: content })` — biến
`children` thành KEY của một `Property`, đúng nhánh bị bỏ qua, và trong file không còn định danh nào
tên `children`; một lần đổi tên là rule ngừng tồn tại cho file đó. Đặt bí danh cho nhánh khung khi
import — `import { Tree as Frame }` — hoặc gọi qua member expression như `<Branches.Tree>` khiến
`composesChrome` sai, nên một layout dựng chrome đầy đủ được đo là không dựng chrome và không bao giờ
bị hỏi landmark. Chuyển chrome vào một component vỏ mà layout render thì cả hai rule cùng im: layout
không gọi tên khung nào, còn cái vỏ thì không được giữ landmark vì rule thứ hai từ chối ngay. Một
landmark bọc nhầm thứ vẫn thoả rule hoàn toàn, vì ba biến bool gom độc lập và không hề so với nhau về
cấu trúc — vẽ landmark quanh thanh điều hướng rồi ném `children` cho một leaf trơn là đi lọt.
`contract={"khoa"}` thay vì `contract="khoa"` biến giá trị thành `JSXExpressionContainer` chứ không
còn là `Literal`, nên hình dạng hai mù; chỉ cần hai dấu ngoặc nhọn. Khoá đi qua biến hoặc hàm —
`<Tree contract={keyFor(state)} />` — cũng im lặng như vậy, mà chọn giữa các entry anh em qua một hàm
trả về khoá là cách viết bình thường. Thư mục router không tên `app`, hoặc file route đuôi khác, làm
rule biến mất chứ không phải báo sai; ngược lại, BẤT KỲ thư mục nào tên `app` ở bất kỳ đâu trong đường
dẫn đều mở cổng cho một file chẳng có phận sự gì với landmark. JSX nằm trong nhánh không bao giờ render
vẫn nằm trong cây, nên mã chết vẫn thoả rule.

**Ranh giới.** Rule này hỏi trong một layout của route có landmark hay không. Landmark có được vẽ ở
file được phép giữ nó hay không là `LANDMARK-5`.

## `main-landmark-belongs-to-a-route-file` — LANDMARK-5

**Nó báo cái gì.** Một landmark được vẽ ở tầng dưới người sở hữu cả màn hình. Landmark thứ hai không
phải landmark mạnh hơn, nó là landmark mơ hồ: khi có ba cái, "nhảy tới nội dung chính" không còn nghĩa
gì.

**Nó phát hiện bằng gì.** Miễn trừ bất kỳ file nào có đoạn thư mục của chính nhánh landmark trong
đường dẫn. Tính hai vị từ theo tên file — file route `/\/app\/(?:.*\/)?(?:layout|page)\.tsx$/` và bề
mặt trang `/\/components\/pages\/[A-Z][A-Za-z0-9]*\/(?:index|component)\.tsx$/` — rồi báo trên
`JSXOpeningElement`. Hình dạng một, nhánh landmark có tên, bị báo khi file không phải file route; bề
mặt trang KHÔNG được miễn ở nhánh này. Hình dạng hai, một khung mà entry khai `host: "main"`, bị báo
khi file không phải file route và cũng không phải bề mặt trang. Bất đối xứng ấy là cố ý và đã được đo:
import một landmark về để bọc thứ gì đó không phải cùng một hành động với render node ngoài cùng của
màn hình theo khoá mà bảng đã khai.

**Nó không thấy gì.** Một phần tử landmark viết tay bằng chữ thường không khớp hình dạng nào — hình
dạng một đòi tên nhánh viết hoa, hình dạng hai đòi một khoá contract — nên cách viết sai trực tiếp
nhất chẳng bị báo gì. Đặt bí danh cho nhánh landmark — `import { Main as Screen }` — hỏng ở tập một
phần tử, còn `<Branches.Main>` hỏng ngay ở phép kiểm `name.type`. Mọi phần tử landmark khác ngoài cái
duy nhất trong tập đều vô hình với cả hai rule, và người thêm nhánh cho một landmark mới không được
nhắc rằng đó là một thay đổi rule. Khoá không phải literal đi lọt y như ở rule thứ nhất. Miễn trừ là
một đoạn đường dẫn, nên BẤT KỲ file nào nằm trong thư mục của nhánh landmark — một helper, một story,
một component thứ hai chuyển vào — đều được miễn toàn bộ rule; cấm theo thư mục không phải cấm theo
file, và ở đây miễn trừ lách được bằng một lệnh `mv`. Vị từ tầng trang ghi cứng `/components/pages/`,
đòi thư mục viết hoa cùng file tên `index` hoặc `component`, nên một kho đơn-gói khác layout, một thư
mục viết thường hay một file đặt tên khác đều khiến một bề mặt trang đúng luật bị báo là đặt sai
landmark. Bảng entry thụt lề khác bốn dấu cách làm hỏng cửa sổ chặn một entry, và một entry không khai
host sẽ thừa hưởng host đầu tiên bên dưới nó. JSX chết vẫn bị báo. Và một layout cùng trang dưới nó
cùng mở landmark thì một rule đọc mỗi lần một file không thể thấy — nguồn nói thẳng điều này thay vì
để nó ngầm, và đó chính là lý do rule thu hẹp CHỖ được phép thay vì đi đếm số lần.

**Ranh giới.** Rule này xét landmark được vẽ ở đâu, mỗi lần một file. Rốt cuộc tài liệu có bao nhiêu
landmark là câu hỏi cho review, và phải được viết ra như vậy.

## Cách phát hiện

| Thành phần | Cơ chế |
|---|---|
| chuẩn hoá dấu phân cách | Đường dẫn được đọc sau khi đổi `\` thành `/` trước mọi phép kiểm, nên một đường dẫn Windows quyết định y hệt |
| ngoài phạm vi | Cổng của rule thứ nhất không cài visitor nào. Rule không tồn tại cho file đó, chứ không phải file đó đã qua |
| phần tử landmark, hình dạng một | `JSXOpeningElement` có `name.type` là `JSXIdentifier` và tên nằm trong một tập một phần tử chứa tên nhánh landmark |
| phần tử landmark, hình dạng hai | Một phần tử `JSXIdentifier` bất kỳ khác mang `JSXAttribute` tên `contract` với giá trị là string `Literal`, mà bảng entry tìm được bằng cách đi ngược lên từ file đang lint khai `host: "main"` cho khoá đó |
| tra bảng entry | Đi ngược lên hệ thống file, tối đa bốn mươi cấp, mỗi cấp thử ba đường dẫn bảng tương đối. Bảng được đọc như VĂN BẢN: `indexOf('"<key>": {')`, rồi một cửa sổ kết thúc ở `\n` tiếp theo có đúng bốn dấu cách và một khoá trong ngoặc kép, rồi `/\bhost:\s*"([a-z]+)"/`. Không có `host` thì đọc là hộp trung tính; bảng không đọc được thì đọc là `null` |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt, nhưng không.

| Viết kiểu này | Vì sao vẫn nổ |
|---|---|
| Ném `children` cho một builder thay vì đặt vào JSX | Nhánh `Identifier` trần vẫn đếm, nên một layout truyền `children` vào một callback slot vẫn được đo là có vẽ trang được route tới |
| Xoá sạch nhánh landmark và khai phần tử ở entry | Hình dạng hai đọc host từ bảng, nên một kho không còn nhánh landmark nào vẫn thoả rule thứ nhất và vẫn bị rule thứ hai canh |
| Viết một landmark ngay trong file cài đặt của nhánh landmark | Miễn có chủ đích. Đó là chỗ duy nhất phần tử ấy được vẽ bằng tay, đúng như khung trung tính là chỗ duy nhất một hộp trung tính được vẽ bằng tay |
| Một khoá có TÊN kết thúc bằng `-main`, vẽ trong một block | Tên không được đọc. Chỉ host mà entry khai mới được đọc, nên một cột đọc đặt tên theo vùng vẫn là một cột đọc |
| Một entry viết vài dòng phía trên một entry có landmark | Cửa sổ kết thúc ở khoá tiếp theo cùng mức thụt lề chứ không cắt theo độ dài cố định, nên một entry không khai host không còn thừa hưởng cái ngay bên dưới |
| Một layout chuyển tiếp hoặc layout gốc có vẽ `children` | Cả hai đều không dựng chrome, nên không chạm biến bool thứ hai, và không cái nào bị đòi một landmark mà nó chỉ nhân đôi |

**Đang mở** — chỗ mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Phạm vi | Cái gì đi lọt |
|---|---|
| `routed-page-is-a-main-landmark` | **Đổi tên prop khi destructure** — `function Layout({ children: content })`. Một lần đổi tên là rule ngừng tồn tại cho file đó |
| `routed-page-is-a-main-landmark` | **Đặt bí danh cho nhánh khung khi import**, `import { Tree as Frame }`, hoặc gọi qua member expression. Chrome đầy đủ được đo là không có chrome |
| `routed-page-is-a-main-landmark` | **Landmark bọc nhầm thứ.** Ba biến bool không bao giờ được so với nhau về cấu trúc |
| cả hai | **Chuyển chrome vào một component vỏ mà layout render.** Cả hai rule cùng im và tài liệu ra đời có chrome mà không có landmark |
| cả hai | **`contract={"khoa"}` thay vì `contract="khoa"`**, và **khoá đi qua biến hoặc hàm** — `<Tree contract={keyFor(state)} />`. Hình dạng hai không thấy khoá |
| cả hai | **Thư mục router không tên `app`, hoặc đuôi file khác** — rule biến mất chứ không báo sai — và theo chiều ngược lại, **bất kỳ thư mục nào tên `app`, ở bất kỳ đâu**, mở cổng cho một file không liên quan |
| cả hai | **JSX chết.** Một landmark trong nhánh không bao giờ render vẫn thoả rule thứ nhất và vẫn bị rule thứ hai báo |
| `main-landmark-belongs-to-a-route-file` | **Phần tử landmark viết tay bằng chữ thường.** Không hình dạng nào khớp cách viết sai trực tiếp nhất |
| `main-landmark-belongs-to-a-route-file` | **Đặt bí danh cho nhánh landmark** — `import { Main as Screen }` — hoặc `<Branches.Main>` |
| `main-landmark-belongs-to-a-route-file` | **Mọi phần tử landmark khác ngoài cái trong tập.** Tập có đúng một thành viên, và thêm nhánh cho một cái khác là một thay đổi rule mà không ai được nhắc |
| `main-landmark-belongs-to-a-route-file` | **Chuyển file vào thư mục của nhánh landmark.** Một miễn trừ theo thư mục, lách được bằng `mv` |
| `main-landmark-belongs-to-a-route-file` | **Bề mặt trang nằm trong một gói dùng chung, hoặc trong thư mục không viết hoa** — một bề mặt trang đúng luật bị báo là đặt sai landmark |
| `main-landmark-belongs-to-a-route-file` | **Bảng entry thụt lề khác bốn dấu cách.** Cửa sổ chạy tới hết file và một entry không khai host thừa hưởng host đầu tiên bên dưới |
| không rule nào | **Một layout và trang dưới nó cùng mở landmark**, và **mọi thứ mà `LANDMARK-1`, `LANDMARK-2`, `LANDMARK-3` cấm** — một nhánh cho mỗi phần tử landmark, một nhánh không sở hữu class nào, và việc từ chối một prop chọn phần tử trên khung trung tính |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| filename | Đường dẫn của file đang lint, đã chuẩn hoá về dấu `/` |
| AST | JSX của một file, dưới một parser, không phân giải liên file |
| entry table | Bảng gần nhất tìm được bằng cách đi ngược lên, đọc như văn bản |
| element name | Một định danh trần; member expression và bí danh là những chuỗi khác |
| contract key | Một string literal viết ngay tại thuộc tính, không gì khác |

## Quy tắc

1. Danh tính của một rule là tên được publish của nó. Không có mã số thứ hai.
2. Một rule đọc một file. Thứ gì cần hai file là câu hỏi cho review, và phải được viết ra như vậy.
3. Bảng không đọc được thì im lặng, không bao giờ báo lỗi. Một cái đọc mà chẳng nhìn vào đâu thì không
   có quyền trả lời "ở đây không có gì".
4. Nhánh landmark và host do entry khai là hai hình dạng với hai tập file được phép giữ chúng, và gộp
   chúng lại từng là một khuyết tật đã đo được.
5. Phép kiểm nhánh khung trong rule thứ nhất là một phép thu hẹp, không phải trang trí: bỏ nó đi thì
   rule sẽ đòi landmark ở đúng những file mà rule thứ hai từ chối.
6. Mọi rule publish ở mức error. `error` nghĩa là build gãy, không phải cảnh báo để xếp hàng xử lý.

## Ngoại lệ

Ngoại lệ là một phần của cách giữ luật, không phải chỗ lách.

- **Thư mục của chính nhánh landmark.** Miễn hoàn toàn khỏi rule thứ hai, vì file đó vẽ phần tử bằng
  tay và bắt buộc phải thế. Nó giải phóng mọi phép kiểm của `main-landmark-belongs-to-a-route-file`
  cho mọi file nằm trong thư mục ấy.
- **Layout gốc và layout chuyển tiếp.** Không được miễn bằng tên — chúng đơn giản là không dựng chrome,
  nên điều kiện thứ hai của rule thứ nhất sai. Đòi landmark ở một trong hai chỗ đó là tự đặt landmark
  thứ hai vào tài liệu.
- **Bề mặt trang.** Được phép render entry khai host landmark, và KHÔNG được phép import nhánh
  landmark. Bất đối xứng này là cố ý: render node ngoài cùng của màn hình không phải cùng một hành động
  với việc import một landmark về để bọc thứ gì đó. Nó chỉ giải phóng hình dạng hai, không giải phóng
  gì ở hình dạng một.
- **Bản ghi và cây sinh tự động.** KHÔNG được miễn ở đây. Cổng của rule thứ nhất và hai vị từ của rule
  thứ hai là bộ lọc duy nhất; một bản ghi chứa file mang hình dạng route sẽ bị lint như source.

## Đầu ra

Một block cho mỗi finding:

```text
rule: <routed-page-is-a-main-landmark | main-landmark-belongs-to-a-route-file>
file: <path as the rule sees it, forward slashes>
gate: <matched | not matched, and which predicate decided>
evidence: <the AST fact — element name, attribute kind, identifier parent>
verdict: <reported | silent>
hatch: <the open hatch that applies, or none>
```

Một file sạch xuất một block với `verdict: silent` cùng cổng đã khớp. Một file ngoài phạm vi xuất một
block với `gate: not matched` và `verdict: silent` — file đó chưa được xét, và block phải nói rõ vị từ
nào đã loại nó.

## Ví dụ đã giải

**Đầu vào.** Một layout dashboard tự dựng chrome rồi ném trang được route tới cho một leaf trơn, cùng
với block vẽ cột đọc bên cạnh nó.

```tsx
// src/app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <Tree
            contract="nav-over-body-page"
            render={defineContractComponent("nav-over-body-page", {
                navigation: defineContractProjection("double-navbar", () => <ShellNav />),
                body: defineLeafComponent("page", {}, () => children),
            })}
        />
    )
}
```

```tsx
// src/components/blocks/DashboardBody/component.tsx
export const DashboardBody = () => (
    <Main
        contract="dashboard-main"
        render={defineContractComponent("dashboard-main", {
            feed: defineContractProjection("activity-feed", () => <ActivityFeed />),
        })}
    />
)
```

```text
rule: routed-page-is-a-main-landmark
file: src/app/dashboard/layout.tsx
gate: matched — /\/app\/(?:.*\/)?layout\.tsx$/
evidence: JSXExpressionContainer children present, JSXOpeningElement Tree present, no landmark element in either shape
verdict: reported at Program:exit
hatch: none
```

```text
rule: main-landmark-belongs-to-a-route-file
file: src/components/blocks/DashboardBody/component.tsx
gate: matched — not the landmark branch directory, and neither the route-file nor the page-surface predicate
evidence: JSXOpeningElement Main, shape one, the named landmark branch
verdict: reported at JSXOpeningElement
hatch: none
```

`dashboard-main` là cột đọc bên cạnh thanh dọc, không phải trang. Sau khi sửa, cột đọc ở lại là một
khung trung tính còn layout bọc children được route tới trong landmark:

```tsx
// src/app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <Tree
            contract="nav-over-body-page"
            render={defineContractComponent("nav-over-body-page", {
                navigation: defineContractProjection("double-navbar", () => <ShellNav />),
                body: defineContractProjection("routed-page-main", () => (
                    <Main
                        contract="routed-page-main"
                        render={defineContractComponent("routed-page-main", {
                            page: defineLeafComponent("page", {}, () => children),
                        })}
                    />
                )),
            })}
        />
    )
}
```

```tsx
// src/components/blocks/DashboardBody/component.tsx
export const DashboardBody = () => (
    <Tree
        contract="dashboard-main"
        render={defineContractComponent("dashboard-main", {
            feed: defineContractProjection("activity-feed", () => <ActivityFeed />),
        })}
    />
)
```

Nhưng đúng cái sai ấy sống sót qua một lần chuyển chỗ. Đẩy chrome vào một component vỏ thì cả hai rule
cùng im:

```tsx
// src/app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return <AppShell>{children}</AppShell>
}
```

```text
rule: routed-page-is-a-main-landmark
file: src/app/dashboard/layout.tsx
gate: matched — /\/app\/(?:.*\/)?layout\.tsx$/
evidence: JSXExpressionContainer children present, no JSXOpeningElement named the neutral frame branch
report: none
hatch: moving the chrome into a shell component leaves composesChrome false, so the layout is never asked for a landmark — and the shell cannot hold one, because the second rule refuses it there. The document ships with chrome and no landmark
```

## Phạm vi

Mô-đun này nói về rule của đúng một luật và không gì khác. Nó không gọi tên sản phẩm, thư viện
component hay kho mã nào. Tên rule, tên phần tử mà chúng so khớp và gói mà chúng xuất xưởng là những
định danh xuất hiện trong build log, và được viết nguyên văn. Việc một tài liệu rốt cuộc có đúng một
landmark hay không, mỗi phần tử landmark có đúng một nhánh hay không, một nhánh có sở hữu class hay
không, và khung trung tính có nhận một prop chọn phần tử hay không đều do review giữ, không phải do
mô-đun này.
