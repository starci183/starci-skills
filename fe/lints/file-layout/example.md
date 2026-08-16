---
id: fe-lints-file-layout-example
title: example.md
slug: /fe/lints/file-layout/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng luật lint — chỗ nào báo lỗi, chỗ nào không, và mã nào lọt qua.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `file-layout` · Luật lint: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là **một luật lint**, với vài cặp **SAI** (luật báo lỗi) và **ĐÚNG** (luật im), rồi
một mục **Chỗ lách và chỗ dễ nhầm**.

Đọc mục cuối của mỗi phần cho kỹ. Mã trong đó **không phải mã được phép viết** — nó là mã mà luật
lint **không nhìn thấy**. Hai chuyện đó khác hẳn nhau, và lẫn lộn giữa chúng là cách một cây thư mục
mục ruỗng trong khi mọi cổng vẫn xanh.

Cây thư mục viết trong khối `text`, mã nguồn viết trong khối `tsx`. Không tên sản phẩm, không thư
viện thành phần, không khoá đăng ký.

---

## `surface-folder-two-files-only`

### SAI — một thành phần thứ ba mọc trong thư mục màn hình

```text
src/components/pages/DashboardPage/
    index.tsx
    component.tsx
    component.test.tsx
    StreakStrip.tsx        <- luật báo: `pages/DashboardPage/` chứa `StreakStrip.tsx`
```

### ĐÚNG — thành phần đó có tên riêng, nên nó có nhà riêng

```text
src/components/pages/DashboardPage/
    index.tsx
    component.tsx
    component.test.tsx

src/components/blocks/dashboard/StreakStrip/
    index.tsx
    component.tsx
    component.test.tsx
```

### SAI — một thư mục tiện ích nấp trong thư mục khung

```text
src/components/layouts/ShellNav/
    index.tsx
    component.tsx
    utils/
        format.ts          <- luật báo: `layouts/ShellNav/` chứa `utils/format.ts`
```

Chú ý: file này bị **hai** luật báo cùng lúc — luật thư mục màn hình vì nó là thứ ba, và
`no-helper-folder-in-components` vì `utils/` không phải mã dựng hình.

### ĐÚNG — hàm thuần đi về cây không phải React

```text
src/components/layouts/ShellNav/
    index.tsx
    component.tsx

src/modules/utils/
    format.ts
```

### ĐÚNG — lớp phủ có tầng nhóm, và chỉ giữ hai nửa

```text
src/components/overlays/auth/SignInOverlay/
    index.tsx
    component.tsx
    index.test.tsx
```

### Chỗ lách và chỗ dễ nhầm

**Gom ba thành phần vào một file thì luật hết đếm được.** Đây là mã **lọt qua**, không phải mã hợp
lệ — nó vi phạm đúng cái thói quen mà `FILE-2` sinh ra để chặn, và không có gì báo:

```tsx
// src/components/pages/DashboardPage/component.tsx — im lặng, vì luật đếm FILE
export const StreakStrip = () => <section className="flex flex-col gap-2" />
export const QuestList = () => <ul className="divide-y" />
export const DashboardPage = () => (
  <div className="flex flex-col gap-6">
    <StreakStrip />
    <QuestList />
  </div>
)
```

**Lớp phủ đặt phẳng thì ra khỏi vùng phủ.** Cùng một file thứ ba, khác nhau đúng một tầng thư mục:

```text
src/components/overlays/auth/SignInOverlay/Field.tsx    <- báo lỗi
src/components/overlays/SignInOverlay/Field.tsx         <- IM LẶNG: thiếu tầng nhóm nên biểu thức hết khớp
```

**File không được lint thì không tới được luật nào.** Đây là mã lọt qua vì trình chạy không ghé
tới nó, chứ không phải vì luật chấp nhận nó:

```text
src/components/pages/DashboardPage/
    index.tsx
    component.tsx
    copy.json              <- IM LẶNG nếu cấu hình không lint `.json`
    styles.css             <- IM LẶNG nếu cấu hình không lint `.css`
```

---

## `route-tree-holds-routes-only`

### SAI — file chủ của màn hình viết thẳng vào cây định tuyến

```text
src/app/provisioning/
    page.tsx
    fleet-page.tsx         <- luật báo: `fleet-page.tsx` không phải một khe của khung nền
```

### ĐÚNG — route gắn, màn hình sống ở tầng của nó

```text
src/app/provisioning/
    page.tsx

src/components/pages/FleetPage/
    index.tsx
    component.tsx
```

```tsx
// src/app/provisioning/page.tsx — route nói màn nào dựng ở URL nào, hết
const ProvisioningRoute = () => <FleetPage />
export default ProvisioningRoute
```

### SAI — một hàm tiện ích trốn trong thư mục route

```text
src/app/dashboard/
    page.tsx
    utils.ts               <- luật báo
    DashboardHeader.tsx    <- luật báo
```

### ĐÚNG — các khe của khung nền, kể cả khi lồng trong nhóm route

```text
src/app/
    layout.tsx
    providers.tsx
    globals.css
    not-found.tsx
    (auth)/
        sign-in/
            page.tsx
        screen.test.tsx    <- kiểm thử cạnh route: được miễn, có chủ ý
    api/
        health/
            route.ts       <- mã máy chủ: được miễn
```

### Chỗ lách và chỗ dễ nhầm

**Cây định tuyến ở gốc kho thì luật không tồn tại.** Cùng một file, hai bố cục, hai kết quả:

```text
src/app/provisioning/fleet-page.tsx    <- báo lỗi
app/provisioning/fleet-page.tsx        <- IM LẶNG: biểu thức đòi `/src/app/`
```

**Route vẫn vẽ được thoải mái, miễn là tên đúng.** Mã dưới đây **lọt qua** và vi phạm đúng câu đầu
của `FILE-6`:

```tsx
// src/app/dashboard/page.tsx — IM LẶNG: luật đọc TÊN, không đọc việc file đang làm gì
export default function DashboardRoute() {
  const session = useSessionToken()
  const { data } = useDashboardSummary(session)
  return (
    <div className="grid gap-8">
      <aside className="w-64"><ShellNav /></aside>
      <main className="flex flex-col gap-6">
        <h1 className="text-xl">{data?.title}</h1>
        <StreakStrip value={data?.streak} />
      </main>
    </div>
  )
}
```

**Gạch dưới ở gốc cây miễn cả FILE, nhưng gạch dưới ở tầng sâu thì không miễn gì.** Đây là chỗ dễ
đọc nhầm nhất của luật này:

```text
src/app/_FleetPage.tsx                    <- IM LẶNG: phần còn lại bắt đầu bằng `_`
src/app/_lib/token.ts                     <- IM LẶNG: cùng lý do
src/app/dashboard/_components/Card.tsx    <- BÁO LỖI: phần còn lại bắt đầu bằng `dashboard/`
```

**Đội tên một khe là đi qua được.** Cả hai file dưới đây đều là màn hình đầy đủ; chỉ một cái bị bắt:

```text
src/app/dashboard/FleetScreen.tsx    <- báo lỗi
src/app/dashboard/template.tsx       <- IM LẶNG: `template` nằm trong danh sách khe
```

---

## `no-helper-folder-in-components`

### SAI — thư mục tiện ích nằm trong cây thành phần

```text
src/components/blocks/dashboard/StreakStrip/
    index.tsx
    component.tsx
    utils/
        format.ts          <- luật báo: `utils/` không phải mã dựng hình
```

### ĐÚNG — mỗi thứ về cây gọi đúng tên nó

```text
src/components/blocks/dashboard/StreakStrip/
    index.tsx
    component.tsx

src/modules/utils/format.ts
src/modules/types/streak.ts
src/hooks/swr/useStreak.ts
src/resources/streak-copy.ts
```

### SAI — thư mục hằng số cạnh một leaf

```text
src/components/leaves/Text/
    index.tsx
    component.tsx
    constants/
        tone.ts            <- luật báo
```

### ĐÚNG — bản đồ cấu hình là tài nguyên, không phải thành phần

```text
src/components/leaves/Text/
    index.tsx
    component.tsx

src/resources/text-tone.ts
```

### Chỗ lách và chỗ dễ nhầm

**Đặt nông một tầng là thoát.** Đây là cửa lách nghiêm trọng nhất của luật này — chỗ đặt hiển nhiên
nhất lại đúng là chỗ luật không nhìn thấy:

```text
src/components/blocks/dashboard/StreakStrip/utils/format.ts    <- báo lỗi
src/components/utils/format.ts                                 <- IM LẶNG: không còn đoạn nào ở giữa
```

**Bốn cái tên là một danh sách đóng.** Đổi tên thư mục là gỡ luật, và không có gì trong cây thay đổi:

```text
src/components/blocks/dashboard/StreakStrip/utils/format.ts      <- báo lỗi
src/components/blocks/dashboard/StreakStrip/helpers/format.ts    <- IM LẶNG
src/components/blocks/dashboard/StreakStrip/lib/format.ts        <- IM LẶNG
src/components/blocks/dashboard/StreakStrip/shared/format.ts     <- IM LẶNG
```

**Cấm thư mục không phải cấm file.** Bỏ thư mục đi, để file nằm trơ cạnh anh em của nó, thì file trốn
được cả hai luật cùng lúc — luật này vì nó không phải thư mục, luật thư mục màn hình vì tầng block
nằm ngoài tầm:

```text
src/components/blocks/dashboard/StreakStrip/utils/format.ts    <- báo lỗi
src/components/blocks/dashboard/StreakStrip/utils.ts           <- IM LẶNG: cả hai luật đều không thấy
```

---

## `export-matches-folder`

### SAI — thư mục nói một đằng, export nói một nẻo

```tsx
// src/components/leaves/Text/index.tsx
export const Paragraph = () => null
// luật báo: thư mục `Text` không có export nào thuộc họ (exports: Paragraph)
```

### ĐÚNG — đường dẫn đoán trước cái tên

```tsx
// src/components/leaves/Text/index.tsx
export { Text } from "./component"
export type { TextProps } from "./component"
```

### ĐÚNG — một biến thể vẫn thuộc họ, vì ký tự sau tiền tố viết hoa

```tsx
// src/components/leaves/Text/index.tsx
export const TextLink = () => null
// thuộc họ: `Text` + `Link`
```

### SAI — tên gần giống nhưng ký tự sau tiền tố viết thường

```tsx
// src/components/leaves/Text/index.tsx
export const Textual = () => null
// luật báo: `Textual` không phải `Text` cộng một thành viên, chỉ là một từ dài hơn
```

### SAI — barrel đổi tên không giấu được sai lệch

```tsx
// src/components/leaves/Text/index.tsx
export { Paragraph } from "./component"
// specifier vẫn được thu, nên luật vẫn thấy `Paragraph`
```

### Chỗ lách và chỗ dễ nhầm

**Barrel bằng `export *` thì luật không thu được tên nào, nên nó im.** Đây là dạng barrel thông dụng
nhất, và nó **lọt qua**:

```tsx
// src/components/leaves/Text/index.tsx — IM LẶNG dù `component.tsx` chỉ export `Paragraph`
export * from "./component"
```

**`export default` cũng vậy, và `export class` cũng vậy:**

```tsx
// src/components/leaves/Text/index.tsx — cả ba đều IM LẶNG
const Paragraph = () => null
export default Paragraph
```

```tsx
// src/components/leaves/Text/index.tsx — IM LẶNG: khai báo lớp không được thu
export class Paragraph {}
```

**Một export đúng họ gánh được cả file.** Mô tả của chính luật nói rằng "một hành khách không liên
quan thì không qua được"; mã dưới đây cho thấy nó qua được:

```tsx
// src/components/leaves/Text/index.tsx — IM LẶNG, vì đã có `Text` trong tập tên
export const Text = () => null
export const formatToneClassName = (tone: string) => `text-${tone}`
export const DEFAULT_TONE = "neutral"
```

**Đổi tên thư mục là gỡ luật.** Không có gì trong file thay đổi:

```text
src/components/leaves/Text/index.tsx     <- được canh
src/components/leaves/text/index.tsx     <- IM LẶNG: thư mục không PascalCase
src/components/leaves/Text/index.jsx     <- IM LẶNG: phần mở rộng ngoài `.ts`/`.tsx`
src/components/leaves/Text/component.tsx <- IM LẶNG: chỉ `index` bị canh
```

---

## `no-runtime-namespace`

### SAI — một họ thành phần gói thành một object

```tsx
export const Card = { Root: CardRoot, Header: CardHeader }
// luật báo: `Card` là một namespace lúc chạy, gồm Root, Header
```

### ĐÚNG — export thẳng từng thành viên

```tsx
export const CardRoot = ({ children }: CardRootProps) => (
  <div className="rounded-lg border p-4">{children}</div>
)
export const CardHeader = ({ title }: CardHeaderProps) => (
  <h3 className="text-base font-medium">{title}</h3>
)
```

### SAI — thêm `as const` không đổi được gì

```tsx
export const Chip = { Dot: ChipDot, Label: ChipLabel } as const
// luật báo: lớp `as` được bóc trước khi kiểm tra object
```

### ĐÚNG — một thành viên thì chưa phải một namespace

```tsx
export const Card = { Root: CardRoot }
// im lặng: ngưỡng là hai thành viên trở lên
```

### Chỗ lách và chỗ dễ nhầm

**`Object.assign` là cách dựng họ có dấu chấm phổ biến nhất, và luật không thấy nó:**

```tsx
// IM LẶNG: phần khởi tạo là một lời gọi, không phải object literal
export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Footer: CardFooter,
})
```

**Gán thuộc tính sau khai báo cũng vậy:**

```tsx
// IM LẶNG: object được lắp ráp bên ngoài cái nút luật đang canh
export const Card = CardRoot
Card.Header = CardHeader
Card.Footer = CardFooter
```

**Tách khai báo khỏi export là đủ:**

```tsx
// IM LẶNG: nút export mang specifier, không mang khai báo
const Card = { Root: CardRoot, Header: CardHeader }
export { Card }
```

**Một khoá viết thường tắt luật cho cả object:**

```tsx
// IM LẶNG: điều kiện "mọi thành viên viết hoa" hỏng, nên cả khai báo bị bỏ qua
export const Card = { Root: CardRoot, Header: CardHeader, displayName: "Card" }
```

**`satisfies` không được bóc, chỉ `as` được bóc:**

```tsx
export const Chip = { Dot: ChipDot, Label: ChipLabel } as const      // báo lỗi
export const Chip = { Dot: ChipDot, Label: ChipLabel } satisfies P   // IM LẶNG
```

**Và nhầm lẫn theo chiều ngược lại: luật này không có cổng đường dẫn.** Nó chạy trên **mọi** file
được lint, kể cả file không phải thành phần, nên một bản đồ dữ liệu với khoá viết hoa vẫn bị báo:

```tsx
// src/modules/api/status.ts — BÁO LỖI, dù đây là dữ liệu chứ không phải một họ thành phần
export const Status = { Draft: "draft", Live: "live" }
```

Cách viết không bị báo là hạ khoá xuống chữ thường, và đó là cách viết đúng cho dữ liệu:

```tsx
export const status = { draft: "draft", live: "live" } as const
```

---

## `monorepo-tier-belongs-to-its-side`

### SAI — một tầng biết nghiệp vụ nằm trong gói dùng chung

```text
packages/ui/src/blocks/FleetRow/
    index.tsx              <- luật báo `featureInPackage`: `blocks/` biết một nghiệp vụ
```

### ĐÚNG — câu nghiệp vụ thuộc về ứng dụng sở hữu nghiệp vụ đó

```text
apps/web/src/components/blocks/fleet/FleetRow/
    index.tsx
    component.tsx
```

### SAI — từ vựng dùng chung bị nhốt trong một ứng dụng

```text
apps/web/src/components/leaves/Badge/
    index.tsx              <- luật báo `vocabularyInApp`: `leaves/` không biết nghiệp vụ nào
```

### ĐÚNG — hình dạng có đúng một bản, ở gói dùng chung

```text
packages/ui/src/
    contracts/
        index.ts
    leaves/Badge/
        index.tsx
    branches/Tree/
        index.tsx
```

### ĐÚNG — kho một ứng dụng không có bên nào để chọn

```text
src/components/blocks/dashboard/StreakStrip/index.tsx    <- im lặng, đúng chủ ý
src/components/leaves/Badge/index.tsx                    <- im lặng, đúng chủ ý
```

### Chỗ lách và chỗ dễ nhầm

**Bất đối xứng một đoạn thư mục.** Phía ứng dụng chấp nhận `components/`, phía gói thì không, nên
cùng một vi phạm viết thừa một thư mục là thoát:

```text
packages/ui/src/blocks/FleetRow/index.tsx               <- báo lỗi
packages/ui/src/components/blocks/FleetRow/index.tsx    <- IM LẶNG
```

**Workspace đặt tên khác là luật không tồn tại:**

```text
packages/ui/src/blocks/FleetRow/index.tsx    <- báo lỗi
libs/ui/src/blocks/FleetRow/index.tsx        <- IM LẶNG
services/ui/src/blocks/FleetRow/index.tsx    <- IM LẶNG
```

**Và cửa lách lớn nhất: luật giữ vị trí của TẦNG, không giữ việc file có biết nghiệp vụ hay không.**
File dưới đây nằm ở một đường dẫn hoàn toàn hợp lệ, và nó chính là thất bại mà `FILE-5` mô tả:

```tsx
// packages/ui/src/leaves/FleetStatusDot/component.tsx — IM LẶNG, dù nó biết rõ một nghiệp vụ
export const FleetStatusDot = ({ status }: { status: "provisioning" | "draining" }) => (
  <span className={status === "draining" ? "bg-amber-500" : "bg-emerald-500"} />
)
```

---

## Ánh xạ yêu cầu sang một luật lint

Nêu đường dẫn và, nếu là hai luật AST, nêu cả danh sách export. Trả lời phải là **tên luật đã
publish**, không bao giờ là một mã số tự đặt.

| Yêu cầu bằng lời | Đường dẫn hoặc mã | Luật lint | Mã luật | Kết quả |
|---|---|---|---|---|
| "Thêm một thành phần nhỏ vào thư mục màn hình cho tiện" | `components/pages/<Tên>/Extra.tsx` | `surface-folder-two-files-only` | `FILE-2` | Báo lỗi; đưa sang `blocks/<nhóm>/` |
| "Để hàm định dạng cạnh thành phần dùng nó" | `components/blocks/<nhóm>/<Tên>/utils/x.ts` | `no-helper-folder-in-components` | `FILE-3` | Báo lỗi; đưa sang `modules/utils/` |
| "Viết luôn màn hình trong thư mục route cho gần" | `src/app/<đoạn>/<Tên>.tsx` | `route-tree-holds-routes-only` | `FILE-6` | Báo lỗi; đưa sang `components/pages/<Tên>/` |
| "Thư mục `Text` export `Paragraph`" | `components/leaves/Text/index.tsx` | `export-matches-folder` | `FILE-1` | Báo lỗi; đổi tên một trong hai |
| "Gói họ thẻ lại cho gọn để gọi `Card.Header`" | `export const Card = { Root, Header }` | `no-runtime-namespace` | `FILE-4` | Báo lỗi; export thẳng từng thành viên |
| "Đưa hàng danh sách dùng chung lên gói `ui`" | `packages/ui/src/blocks/<Tên>/` | `monorepo-tier-belongs-to-its-side` | `FILE-5` | Báo lỗi `featureInPackage`; đưa về ứng dụng |
| "Nhân bản `Badge` sang ứng dụng thứ hai" | `apps/<app>/src/components/leaves/Badge/` | `monorepo-tier-belongs-to-its-side` | `FILE-5` | Báo lỗi `vocabularyInApp`; đưa lên gói dùng chung |
| "Thêm kiểm thử cho route" | `src/app/<đoạn>/access.test.tsx` | `route-tree-holds-routes-only` | `FILE-6` | Được miễn, có chủ ý |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `surface-folder-two-files-only` / `no-helper-folder-in-components` | Thứ thừa ra là một **thư mục** mang một trong bốn cái tên, hay một **file** bất kỳ? Thư mục thì cả hai cùng báo; file thì chỉ luật thư mục màn hình báo, và chỉ khi tầng là page/layout/overlay |
| `surface-folder-two-files-only` / `route-tree-holds-routes-only` | File nằm dưới `src/components/` hay dưới `src/app/`? Hai cây, hai luật, không giao nhau |
| `export-matches-folder` / `no-runtime-namespace` | Vấn đề là **tên** không khớp thư mục, hay **hình dạng** export gom thành một object? Một file có thể vi phạm cả hai |
| `monorepo-tier-belongs-to-its-side` / mọi luật còn lại | Kho có cả `packages/` lẫn `apps/` không? Không có thì luật này im, và bốn luật kia vẫn chạy nguyên |
| Báo lỗi / im lặng / ngoài phạm vi | Biểu thức đường dẫn có khớp không? Khớp mà chấp nhận là một phán quyết; không khớp thì **không có phán quyết nào**, và đừng đọc cái sau thành cái trước |

## Sai lầm lặp lại nhiều nhất

1. Tin rằng một mã luật đã có máy giữ thì mã luật đó đã kín. Ba mươi tư cửa còn mở trong mô-đun này
   nói ngược lại.
2. Đọc "luật lint im lặng" thành "cách viết này hợp lệ". Im lặng còn có nghĩa là biểu thức chưa bao
   giờ khớp.
3. Gom nhiều thành phần vào một file để thư mục màn hình đủ hai nửa. Đếm file thì xanh, luật thì vẫn
   vỡ.
4. Đổi tên thư mục hoặc file để hết đỏ — `helpers/` thay `utils/`, `text/` thay `Text/`,
   `template.tsx` thay `FleetScreen.tsx`. Cả ba đều làm luật ngừng tồn tại chứ không làm nó hài lòng.
5. Thêm `displayName` vào một object namespace rồi tưởng đã sửa xong. Nó chỉ tắt luật.
6. Dùng `export *` trong barrel rồi tin rằng tên thư mục đã được kiểm.
7. Tự đặt một mã số cho luật lint khi báo cáo, thay vì dùng đúng cái tên mà bản dựng in ra.
8. Mô tả một luật đọc đường dẫn như thể nó đã đọc nội dung file.
