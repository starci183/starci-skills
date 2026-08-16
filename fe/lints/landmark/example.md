---
id: fe-lints-landmark-example
title: example.md
slug: /fe/lints/landmark/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng rule landmark — chỗ rule nổ, chỗ rule im, và chỗ rule bị lách.
---

# example.md

> Version: `2.00` · Mô-đun: `landmark` · Luật: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi rule có nhiều cặp **SAI** (rule nổ) và **ĐÚNG** (rule im), rồi tới mục **Cửa lách và nhầm lẫn**.

Mục cửa lách **không phải danh sách những gì được phép**. Đó là mã **đi lọt** — mã vi phạm luật mà
rule không nhìn thấy. Đọc nhầm hai thứ này là cách nhanh nhất để biến một tài liệu enforcement thành
một tài liệu cho phép.

---

## `routed-page-is-a-main-landmark`

### SAI — layout tự dựng chrome, ném children cho leaf trơn

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

`children` có mặt, `Tree` có mặt, landmark không có ở đâu cả. Rule báo ở `Program:exit`. Ý định được
ghi lại đầy đủ trong tên khoá, và không ai nhảy tới được nội dung chính.

### ĐÚNG — children được bọc trong nhánh landmark

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

Hai đoạn trên khác nhau đúng **một** thứ: người đọc có bỏ qua được thanh điều hướng để tới trang hay
không.

### ĐÚNG — không có nhánh landmark nào, entry tự khai host

```tsx
// src/app/settings/layout.tsx
export default function SettingsLayout({ children }: { children: ReactNode }) {
    return (
        <Tree
            contract="rail-beside-page"
            render={defineContractComponent("rail-beside-page", {
                rail: defineContractProjection("settings-rail", () => <SettingsRail />),
                body: defineContractProjection("routed-page-main", () => (
                    <Tree
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

Khoá đó khai host trong bảng:

```ts
// src/components/contracts/index.ts
export const CONTRACTS = buildContracts({
    "routed-page-main": {
        host: "main",
        classes: ["flex", "flex-col", "gap-6"],
        why: "the routed page scrolls as one column and must be reachable by skipping the chrome",
    },
})
```

Rule đọc bảng bằng văn bản, thấy `host: "main"`, và im. Một kho **xoá sạch nhánh landmark** vẫn thoả
được rule này.

### ĐÚNG — layout gốc

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="vi">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
```

Có `children`, không có `Tree`. Không dựng chrome thì không bị hỏi landmark — và đòi nó ở đây chính là
tự đặt landmark thứ hai vào tài liệu.

### ĐÚNG — layout chuyển tiếp

```tsx
// src/app/dashboard/(reports)/layout.tsx
export default function ReportsLayout({ children }: { children: ReactNode }) {
    return <>{children}</>
}
```

Uỷ quyền toàn bộ chrome cho layout bên trên. Rule im, và im là đúng.

### Cửa lách và nhầm lẫn

> Toàn bộ mã dưới đây **vi phạm luật**. Rule **không thấy**. Đây là lỗ hổng, không phải giấy phép.

**Đổi tên prop khi destructure là rule biến mất.**

```tsx
// src/app/dashboard/layout.tsx
// LỌT: không còn Identifier nào tên `children` ngoài key của một Property.
export default function DashboardLayout({ children: content }: { children: ReactNode }) {
    return (
        <Tree
            contract="nav-over-body-page"
            render={defineContractComponent("nav-over-body-page", {
                navigation: defineContractProjection("double-navbar", () => <ShellNav />),
                body: defineLeafComponent("page", {}, () => content),
            })}
        />
    )
}
```

Nhánh `Identifier` bỏ qua đúng trường hợp `parent.type === "Property"`, mà `children:` ở đây **chính
là** key của một `Property`. Một lần đổi tên. Không cần ác ý — chỉ cần thấy `content` đọc xuôi hơn.

**Bí danh cho nhánh khung.**

```tsx
// src/app/dashboard/layout.tsx
import { Tree as Frame } from "@/components/branches/Tree"

// LỌT: `composesChrome` so tên trần "Tree"; ở đây phần tử tên "Frame".
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return <Frame contract="nav-over-body-page" render={/* ... */} />
}
```

**Gọi khung qua member expression.**

```tsx
// LỌT: `node.name.type` là JSXMemberExpression, không phải JSXIdentifier.
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return <Branches.Tree contract="nav-over-body-page" render={/* ... */} />
}
```

**Chuyển chrome vào một component vỏ — và cả hai rule cùng im.**

```tsx
// src/app/dashboard/layout.tsx
// LỌT: layout không gọi tên khung nào, nên không bị coi là dựng chrome.
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return <AppShell>{children}</AppShell>
}
```

```tsx
// src/components/blocks/AppShell/component.tsx
// Và landmark KHÔNG được đặt ở đây: rule thứ hai từ chối ngay.
export const AppShell = ({ children }: { children: ReactNode }) => (
    <Tree
        contract="nav-over-body-page"
        render={defineContractComponent("nav-over-body-page", {
            navigation: defineContractProjection("double-navbar", () => <ShellNav />),
            body: defineLeafComponent("page", {}, () => children),
        })}
    />
)
```

Đây là lỗ hổng nghiêm trọng nhất của cả mô-đun: tài liệu ra đời có chrome đầy đủ, **không có landmark
nào**, và không rule nào có chỗ để nói.

**Landmark bọc nhầm thứ vẫn thoả rule.**

```tsx
// src/app/dashboard/layout.tsx
// LỌT: ba biến bool được gom độc lập, không hề so cấu trúc với nhau.
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <Tree
            contract="nav-over-body-page"
            render={defineContractComponent("nav-over-body-page", {
                // landmark bọc THANH ĐIỀU HƯỚNG
                navigation: defineContractProjection("rail-main", () => (
                    <Main contract="rail-main" render={/* ... */} />
                )),
                // còn trang thì đi bằng leaf trơn
                body: defineLeafComponent("page", {}, () => children),
            })}
        />
    )
}
```

Trình đọc màn hình được mời nhảy thẳng vào… thanh điều hướng.

**Hai dấu ngoặc nhọn làm hình dạng hai mù.**

```tsx
// LỌT theo chiều ngược lại: đây là landmark ĐÚNG, nhưng rule không đếm được nó,
// nên layout bị BÁO SAI là thiếu landmark.
<Tree contract={"routed-page-main"} render={/* ... */} />
```

`contractKeyOf` đòi `value.type === "Literal"`. Bọc trong ngoặc nhọn thì giá trị thành
`JSXExpressionContainer`.

**Khoá đi qua biến hoặc hàm.**

```tsx
// LỌT: cùng nhánh, cùng im lặng.
const key = variant === "wide" ? "routed-page-main" : "routed-page-main-narrow"
return <Tree contract={key} render={/* ... */} />
```

**Thư mục router tên khác, hoặc đuôi file khác.**

```text
src/routes/dashboard/layout.tsx     → cổng không khớp, rule không tồn tại
src/app/dashboard/layout.jsx        → cổng không khớp, rule không tồn tại
src/app/dashboard/layout.ts         → cổng không khớp, rule không tồn tại
```

**Và ngược lại: bất kỳ thư mục nào tên `app`.**

```text
src/components/blocks/app/layout.tsx  → cổng KHỚP, và file này bị coi là layout của route
```

**JSX chết vẫn làm rule im.**

```tsx
// LỌT: AST không quan tâm nhánh này có render hay không.
{false && <Main contract="routed-page-main" render={/* ... */} />}
```

---

## `main-landmark-belongs-to-a-route-file`

### SAI — nhánh landmark nằm trong một block

```tsx
// src/components/blocks/DashboardBody/component.tsx
// Khoá tên `-main` nên tay tự với lấy nhánh landmark. Đây đúng là cái bẫy.
export const DashboardBody = () => (
    <Main
        contract="dashboard-main"
        render={defineContractComponent("dashboard-main", {
            feed: defineContractProjection("activity-feed", () => <ActivityFeed />),
        })}
    />
)
```

`dashboard-main` là **cột đọc** bên cạnh thanh dọc, không phải trang. Vẽ nó bằng nhánh landmark là đặt
landmark thứ hai bên dưới cái mà layout đã mở.

### ĐÚNG — cột đọc ở lại là một khung trung tính

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

Hai đoạn khác nhau đúng **một** thứ: tài liệu có một landmark hay có nhiều.

### SAI — entry khai host landmark, render trong một composite

```tsx
// src/components/composites/ProfileColumn/component.tsx
export const ProfileColumn = () => <Tree contract="profile-main" render={/* ... */} />
```

```ts
// src/components/contracts/index.ts
    "profile-main": {
        host: "main",
        classes: ["flex", "flex-col", "gap-4"],
        why: "the profile column scrolls beside the rail and keeps its own rhythm",
    },
```

Không ai import landmark cả — nhưng bảng đã nói khoá này mở phần tử gì, và khung tuân theo. Composite
không sở hữu cả màn hình, nên rule báo. **Hướng sửa nằm ở entry**, không phải ở call site: một cột đọc
thì `host` của nó không được là landmark.

### ĐÚNG — cùng entry ấy, render bởi bề mặt trang

```tsx
// src/components/pages/Profile/component.tsx
export const ProfilePage = () => <Tree contract="profile-main" render={/* ... */} />
```

Bề mặt trang **là** người vẽ node ngoài cùng của màn hình, nên hình dạng hai được phép ở đây.

### SAI — vẫn cùng bề mặt trang đó, nhưng import nhánh landmark

```tsx
// src/components/pages/Profile/component.tsx
// Bề mặt trang KHÔNG được miễn ở nhánh này. Rule báo.
export const ProfilePage = () => <Main contract="profile-main" render={/* ... */} />
```

Bất đối xứng là cố ý và đây là chỗ dễ đọc nhầm nhất của rule: **tên rule nói "route file", nhưng tập
file được phép của hai hình dạng không giống nhau.**

### ĐÚNG — file route giữ nhánh landmark

```tsx
// src/app/report/[id]/page.tsx
export default function ReportPage() {
    return <Main contract="routed-page-main" render={/* ... */} />
}
```

`page.tsx` cũng là file route. Một route không có layout dựng chrome thì `page.tsx` chính là người
dựng ngoài cùng, và ép landmark đi lên sẽ phải bịa ra một layout chỉ để bọc.

### ĐÚNG — chính file cài đặt của nhánh landmark

```tsx
// src/components/branches/Main/component.tsx
// Nhánh này giống nhánh khung trung tính ở MỌI điểm trừ phần tử nó mở ra.
export const Main = (props: BranchProps) => <ContractNode {...props} host="main" />
```

Miễn trừ có chủ đích: đây là **một** chỗ duy nhất phần tử ấy được viết tay, đúng như nhánh khung trung
tính là một chỗ duy nhất một hộp trung tính được viết tay. Rule trả về rỗng ngay từ dòng đầu, không
kiểm gì trong file này.

### Cửa lách và nhầm lẫn

> Toàn bộ mã dưới đây **vi phạm luật**. Rule **không thấy**.

**Viết tay phần tử landmark bằng chữ thường — cách sai trực tiếp nhất, và rule của luật này im.**

```tsx
// src/components/blocks/DashboardBody/component.tsx
// LỌT khỏi CẢ HAI hình dạng: không phải tên nhánh viết hoa, cũng không có khoá contract.
export const DashboardBody = () => <main className="flex flex-col gap-4">{/* ... */}</main>
```

Hình dạng một so với một tập chỉ chứa tên nhánh **viết hoa**; hình dạng hai đòi một `contract` là
literal. Không nhánh nào khớp một thẻ chữ thường.

**Bí danh cho nhánh landmark.**

```tsx
// LỌT: tập nhánh landmark chỉ chứa đúng một chuỗi, và "Screen" không phải chuỗi đó.
import { Main as Screen } from "@/components/branches/Main"

export const DashboardBody = () => <Screen contract="dashboard-main" render={/* ... */} />
```

**Member expression còn hỏng sớm hơn.**

```tsx
// LỌT: `name.type !== "JSXIdentifier"` nên cả hai nhánh cùng false ngay dòng đầu.
export const DashboardBody = () => <Branches.Main contract="dashboard-main" render={/* ... */} />
```

**Chỉ một phần tử landmark được biết.**

```tsx
// LỌT: tập có đúng MỘT thành viên. Mọi landmark khác vô hình với cả hai rule.
export const SidebarBlock = () => <Nav contract="sidebar-rail" render={/* ... */} />
export const FiltersBlock = () => <Aside contract="filters-rail" render={/* ... */} />
```

Và người thêm nhánh cho một landmark mới **không được nhắc** phải thêm tên nó vào tập.

**Khoá không phải literal.**

```tsx
// LỌT: entry của khoá này khai host landmark, nhưng hình dạng hai không đọc được khoá.
const key = verdictKey(row)          // trả về "profile-main"
export const RowBlock = () => <Tree contract={key} render={/* ... */} />
```

**Miễn trừ là một đoạn đường dẫn, không phải một file.**

```text
src/components/branches/Main/component.tsx   → miễn (đúng ý định)
src/components/branches/Main/helpers.ts      → miễn
src/components/branches/Main/DashboardBody.tsx → miễn, và đây là block chuyển vào bằng `mv`
```

```tsx
// src/components/branches/Main/DashboardBody.tsx
// LỌT: file nằm trong thư mục nhánh landmark nên rule trả về rỗng, không kiểm gì hết.
export const DashboardBody = () => <Main contract="dashboard-main" render={/* ... */} />
```

**Bề mặt trang ở layout khác thì bị BÁO SAI.**

```text
packages/ui/src/pages/Profile/component.tsx  → vị từ đòi "/components/pages/", không khớp
src/components/pages/profile/component.tsx   → thư mục viết thường, không khớp
src/components/pages/Profile/view.tsx        → tên file khác index|component, không khớp
```

Cả ba đều là bề mặt trang **đúng luật** và cả ba đều bị báo là đặt sai landmark.

**Bảng entry thụt lề khác bốn dấu cách.**

```ts
// Cửa sổ chặn một entry tìm "\n" + ĐÚNG bốn dấu cách + khoá trong ngoặc kép.
// Thụt hai dấu cách thì cửa sổ chạy tới hết file:
export const CONTRACTS = buildContracts({
  "activity-feed": {
    classes: ["flex", "flex-col", "gap-2"],
    why: "the feed stacks records and keeps one rhythm between them",
  },
  "routed-page-main": {
    host: "main",
    classes: ["flex", "flex-col", "gap-6"],
    why: "the routed page scrolls as one column and must be reachable by skipping the chrome",
  },
})
```

`activity-feed` không khai host, nhưng cửa sổ của nó không dừng đúng chỗ và nó **thừa hưởng**
`host: "main"` bên dưới. Mọi call site của `activity-feed` ngoài file route liền bị báo — một danh
sách sửa dài, không có lỗi nào là thật.

**Hai file, mỗi file hợp lệ, tài liệu có hai landmark.**

```tsx
// src/app/dashboard/layout.tsx — hợp lệ với cả hai rule
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <Tree
            contract="nav-over-body-page"
            render={defineContractComponent("nav-over-body-page", {
                navigation: defineContractProjection("double-navbar", () => <ShellNav />),
                body: defineContractProjection("routed-page-main", () => (
                    <Main contract="routed-page-main" render={/* ... */} />
                )),
            })}
        />
    )
}
```

```tsx
// src/components/pages/Dashboard/component.tsx — cũng hợp lệ với cả hai rule
export const DashboardPage = () => <Tree contract="profile-main" render={/* ... */} />
```

Rule đọc một file mỗi lần. Không có chỗ nào đứng để nhìn thấy hai cái cùng lúc. Nguồn nói thẳng điều
này thay vì để nó ngầm, và đó là lý do rule thu hẹp **chỗ được phép** thay vì đi đếm.

---

## Ánh xạ yêu cầu sang rule

| Yêu cầu bằng lời | Rule trả lời | Kết quả |
|---|---|---|
| "Layout này dựng thanh điều hướng, trang bên trong nhảy tới được chưa?" | `routed-page-is-a-main-landmark` | Có landmark ở đâu đó trong file thì im |
| "Block này đặt landmark có được không?" | `main-landmark-belongs-to-a-route-file` | Không, trừ file route và (với hình dạng hai) bề mặt trang |
| "Bề mặt trang render entry khai host landmark được không?" | `main-landmark-belongs-to-a-route-file` | Được — nhưng **import** nhánh landmark thì không |
| "Kho không còn nhánh landmark, có bị báo thiếu không?" | `routed-page-is-a-main-landmark` | Không, entry khai host là đủ |
| "Trang có đúng một landmark không?" | *không rule nào* | Câu hỏi cho review; rule đọc một file mỗi lần |
| "Nhánh landmark có mang class không?" | *không rule nào* | `LANDMARK-2` không có máy giữ |
| "Có ai truyền phần tử vào khung bằng prop không?" | *không rule nào* | `LANDMARK-3` không có máy giữ |
| "Có phần tử landmark viết tay bằng chữ thường không?" | *không rule nào ở luật này* | Ngoài phạm vi hai rule tại đây |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| Layout gốc / layout dựng chrome | File này có tự vẽ khung điều hướng, hay chỉ mount provider? |
| Layout chuyển tiếp / layout dựng chrome | Chrome do file này vẽ, hay do file trên nó vẽ? |
| File route / bề mặt trang | Đường dẫn nằm dưới `app/`, hay dưới thư mục trang có tên viết hoa? |
| Hình dạng một / hình dạng hai | Có người **import** landmark về bọc, hay bảng **khai** host cho khoá? |
| Cột đọc / trang | Bỏ node này đi thì mất một cột, hay mất cả màn hình? |
| Rule im / rule mù | Rule đã chạy và không thấy vi phạm, hay cổng đã loại file này từ đầu? |

## Sai lầm lặp lại nhiều nhất

1. Đọc mục cửa lách như danh sách được phép. Đó là danh sách **lỗ hổng**.
2. Thấy khoá tên `-main` rồi với tay lấy nhánh landmark cho hợp tên.
3. Tin rằng "rule im" nghĩa là "đã kiểm và sạch". Rất nhiều lần nó nghĩa là **cổng đã loại file này**.
4. Đổi tên prop `children` khi destructure rồi tưởng không mất gì.
5. Đặt bí danh khi import một nhánh, và mất luôn cả hai rule cùng lúc.
6. Chuyển chrome vào một component vỏ rồi tưởng landmark vẫn còn được ai đó giữ.
7. Sửa call site khi bị báo hình dạng hai, trong khi thứ sai là **`host` của entry**.
8. Tưởng bề mặt trang được miễn cho cả hai hình dạng. Nó chỉ được miễn cho hình dạng hai.
