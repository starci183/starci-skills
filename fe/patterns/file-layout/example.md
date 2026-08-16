---
id: fe-patterns-file-layout-example
title: example.md
slug: /fe/patterns/file-layout/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã LAYOUT-N, viết bằng cây thư mục thường và TSX thường.
---

# example.md

> Version: `2.00` · Module: `file-layout` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **cây thư mục thường và TSX thường**. Không component library, không design
system riêng, không tên sản phẩm. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó đứng sai chỗ.

Mỗi mã có **nhiều case**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một đích đến duy nhất.

---

## `FILE-1` — một thư mục, một component, tên khớp export

### Case: đường dẫn dự đoán được cái tên

```text
components/leaves/Badge/
    index.tsx           export const Badge
    component.tsx
    component.test.tsx
```

Grep `Badge` ra **một** chỗ. Biết tên thì biết đường dẫn; đứng ở đường dẫn thì đoán ra tên.

### Case: thư mục nói một đằng, export nói một nẻo

```text
components/leaves/Card/
    index.tsx           export const Panel   <- sai: đường dẫn thôi không dự đoán được cái tên nữa
```

Đây gần như luôn là dấu vết của một lần đổi tên chỉ làm nửa chừng. Sửa bằng cách đổi **một trong hai**
cho khớp, không phải bằng cách thêm một re-export.

### Case: export trực tiếp, đúng tên thư mục

```tsx
// components/leaves/Badge/index.tsx
export const Badge = ({ props }: BadgeProps) => <BadgeComponent props={props} />
```

```tsx
// SAI: thư mục Badge/, không có export nào thuộc họ Badge
export const StatusChip = ({ props }: StatusChipProps) => <StatusChipComponent props={props} />
```

### Case: một component và các biến thể có kiểu riêng — vẫn là một component

```tsx
// components/branches/Card/index.tsx
export const Card = ({ props, render }: CardProps) => <CardRoot props={props}>{render()}</CardRoot>
export const CardRoot = ({ props, children }: CardRootProps) => <div className="rounded-lg border">{children}</div>
export const CardHeader = ({ props }: CardHeaderProps) => <div className="border-b p-4">{props.title}</div>
```

Ba tên, một họ. `FILE-1` hỏi *tên đã export có thuộc họ của thư mục không*, và cả ba đều thuộc.

### Ngoại lệ và nhầm lẫn

- **Hành khách đi nhờ.** Cùng thư mục, không cùng họ:

  ```tsx
  // components/branches/Card/index.tsx
  export const Card = ({ props, render }: CardProps) => /* … */
  export const useCardMetrics = () => /* … */          {/* SAI: đây là fetch, thuộc FILE-3 */}
  export const InvoiceRow = ({ props }: InvoiceRowProps) => /* … */  {/* SAI: câu nghiệp vụ, thuộc blocks/ */}
  ```

  Đây là chỗ rule **không** đỡ được: nó chấp nhận thư mục ngay khi có **một** export thuộc họ, nên hai
  hành khách trên vẫn qua cửa. Xem `audit.md`.

- **Namespace object vẫn khớp tên.** `export const Card = { Root, Header }` trong thư mục `Card/`
  **thoả** `FILE-1` và **vi phạm** `FILE-4`. Hai mã nhìn hai thứ khác nhau trên cùng một dòng.

- **Re-export không sửa được gì.** Thêm `export { Panel as Card }` làm rule im lặng nhưng grep vẫn ra
  hai cái tên cho một thứ, đúng cái mà mã này sinh ra để chặn.

---

## `FILE-2` — thư mục màn hình giữ đúng hai nửa

### Case: một block bình thường, nằm đúng feature của nó

```text
components/blocks/dashboard/DailyQuest/
    index.tsx           phần đấu dây: request, tình huống, chữ nghĩa
    component.tsx       hình dạng
    component.test.tsx  bản sinh đôi
```

### Case: thư mục page mọc thêm chân

```text
components/pages/DashboardPage/
    index.tsx
    component.tsx
    DailyQuest.tsx      <- sai: được phát minh ở đây, nên feature cần nó tiếp theo không tìm ra
    utils/format.ts     <- sai: không phải component code (vi phạm luôn FILE-3)
```

Hai cây trên khác nhau đúng **một** điều: các bộ phận có tên **ngoài** cái màn hình đầu tiên cần đến
chúng hay không.

### Case: giai đoạn cuối của cùng một thói quen

```text
components/pages/CheckoutPage/
    index.tsx
    component.tsx
    SummaryPanel.tsx
    AddressForm.tsx
    PaymentMethods.tsx
    constants/steps.ts
    utils/money.ts
    types/checkout.ts
```

Không có bước nào ở đây là một quyết định tồi. Mỗi bước đều là câu "chỉ page này dùng thôi", và tổng
của chúng là một codebase thứ hai với từ vựng riêng.

### Case: sau khi mỗi thứ về nhà của nó

```text
components/pages/CheckoutPage/
    index.tsx
    component.tsx
components/blocks/commerce/SummaryPanel/
components/blocks/commerce/AddressForm/
components/blocks/commerce/PaymentMethods/
modules/utils/money.ts
modules/types/checkout.ts
resources/checkout-steps.ts
```

Không thứ gì bị xoá. Mỗi thứ chỉ chuyển sang chỗ mà người thứ hai sẽ tìm.

### Ngoại lệ và nhầm lẫn

- **Test sinh đôi được phép:**

  ```text
  components/overlays/auth/SignInOverlay/
      index.tsx
      index.test.tsx
      component.tsx
      component.test.tsx
  ```

- **Rule đếm FILE, không đọc nội dung.** `component.tsx` phình thành bốn component vẫn qua cửa:

  ```tsx
  // components/pages/CheckoutPage/component.tsx — SAI về luật, XANH về rule
  const SummaryPanel = () => /* … */
  const AddressForm = () => /* … */
  const PaymentMethods = () => /* … */
  export const CheckoutPageComponent = () => (
    <div className="flex flex-col gap-6"><SummaryPanel /><AddressForm /><PaymentMethods /></div>
  )
  ```

  Đây là dư địa được ghi rõ ở `INDEX.md` và ở `audit.md`, không phải một lỗ hổng vừa phát hiện.

- **`blocks/` không nằm trong tầm của `FILE-2`.** Rule chỉ soi `pages/`, `layouts/`, `overlays/`.
  Một file thứ ba trong thư mục block vẫn sai theo luật, chỉ là không có gì bắt.

---

## `FILE-3` — thứ không phải component code không ở trong cây component

### Case: bốn cái tên bị cấm, ở mọi độ sâu

```text
components/blocks/billing/InvoiceTable/utils/columns.ts      <- sai
components/pages/ReportPage/constants/ranges.ts              <- sai
components/branches/Tree/types/contract.ts                   <- sai
components/blocks/search/ResultList/hooks/useResults.ts      <- sai
```

Độ sâu không cứu được gì. Rule đọc "có `utils/` ở đâu đó dưới `components/` không", chứ không đọc
"nó nằm trong tier nào".

### Case: mỗi thứ về đúng nhà

```text
modules/utils/columns.ts        hàm thuần
resources/report-ranges.ts      config map, không dịch
modules/types/contract.ts       shape dùng chung
hooks/swr/use-results.ts        fetch
```

### Case: file lẻ, không phải thư mục

```tsx
// components/blocks/billing/InvoiceRow/format.ts — SAI về luật, XANH về rule
export const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(amount)
```

Rule tìm **thư mục** tên `utils`, và đây không phải thư mục. Người thứ hai vẫn không tìm ra hàm này,
và vẫn viết lại nó.

### Case: gọi từ nhà thật

```tsx
// components/blocks/billing/InvoiceRow/component.tsx
import { formatAmount } from "@/modules/utils/money"

export const InvoiceRowComponent = ({ props }: InvoiceRowComponentProps) => (
  <div className="flex items-center justify-between p-4">
    <span className="font-medium">{props.plan}</span>
    <span className="tabular-nums">{formatAmount(props.amount, props.currency)}</span>
  </div>
)
```

### Ngoại lệ và nhầm lẫn

- **`hooks/` cạnh component là cái sai gây tranh cãi nhiều nhất.** Lý lẽ luôn là "hook này chỉ màn này
  dùng". Nhưng một fetch có tên: nó gọi một endpoint, và endpoint đó sẽ có người thứ hai gọi.

  ```text
  {/* SAI */}  components/pages/ProfilePage/hooks/useProfile.ts
  {/* ĐÚNG */} hooks/swr/use-profile.ts
  ```

- **Thư mục đích chưa tồn tại không phải cớ.** `resources/` được tạo ở lần dùng đầu tiên.
- **`src/types/` ở gốc không vi phạm mã này.** Rule chỉ cấm bốn cái tên đó **dưới `components/`**. Nó
  vẫn lệch với đích đến mà luật nêu (`modules/types/`) — xem `audit.md`.

---

## `FILE-4` — family export ra từng thành viên

### Case: một object đứng thay cho namespace

```tsx
// SAI: một object runtime, nên call site import cái header là link cả họ,
// và không mảnh nào rơi ra được khỏi bundle.
export const Card = { Root: CardRoot, Header: CardHeader, Footer: CardFooter }
```

### Case: cùng một họ, export ra từng thành viên

```tsx
export const CardRoot = ({ props, children }: CardRootProps) => <div className="rounded-lg border">{children}</div>
export const CardHeader = ({ props }: CardHeaderProps) => <div className="border-b p-4">{props.title}</div>
export const CardFooter = ({ props }: CardFooterProps) => <div className="border-t p-4">{props.note}</div>
```

Hai đoạn trên khác nhau đúng **một** điều: bundler có phân biệt được các thành viên hay không.

### Case: call site

```tsx
// SAI: một import, cả họ đi theo
import { Card } from "@/components/branches/Card"
const Header = () => <Card.Header props={{ title: "Hoá đơn" }} />
```

```tsx
// ĐÚNG: đúng thứ được dùng, đúng thứ được link
import { CardHeader } from "@/components/branches/Card"
const Header = () => <CardHeader props={{ title: "Hoá đơn" }} />
```

Dấu chấm ở call site là một tiện nghi, và bundler là bên trả tiền cho tiện nghi đó.

### Ngoại lệ và nhầm lẫn

- **Object dữ liệu không phải namespace.** Rule đòi tên viết hoa **và** ít nhất hai thành viên đều
  viết hoa. Một bảng dữ liệu key thường không rơi vào mã này:

  ```tsx
  export const statusLabel = { draft: "Nháp", sent: "Đã gửi", paid: "Đã thanh toán" } as const
  ```

- **Metadata viết thường lọt lưới.** Đây là dư địa có thật của rule:

  ```tsx
  export const meta = { shape: "leaf", world: "pure" } as const
  ```

  Đúng luật (không phải family), nhưng nó cho thấy rule đang phân biệt bằng **chữ hoa đầu tên**, chứ
  không bằng "đây có phải component không".

- **Một thành viên thì không bị bắt.** `export const Card = { Root: CardRoot }` qua cửa vì rule đòi
  từ hai thành viên trở lên. Về luật, nó vẫn là một namespace mới bắt đầu.

---

## `FILE-5` — package dùng chung dừng lại ngay dưới block

### Case: đường ranh bị vượt từ phía package

```text
packages/ui/src/
    leaves/Badge/
    branches/Card/
    blocks/FleetRow/        <- sai: package vừa học được một domain
    pages/FleetPage/        <- sai: và app tiếp theo vẫn ship cả hai
```

### Case: đường ranh nằm đúng chỗ

```text
packages/ui/src/            HÌNH DẠNG - không biết feature nào
    contracts/
    leaves/Badge/
    composites/Field/
    branches/Card/
    shells/AppShell/

apps/fleet/src/             CÂU NÓI NGHIỆP VỤ - biết domain của chính nó
    app/
    components/
        blocks/fleet/FleetRow/
        overlays/fleet/AssignVehicleOverlay/
        layouts/FleetLayout/
        pages/FleetPage/
```

### Case: đường ranh bị vượt từ phía app

```text
apps/billing/src/components/
    leaves/Badge/           <- sai: app thứ hai sẽ viết lại nó, và hai bản trôi khỏi nhau
    contracts/index.ts      <- sai: bảng contract là hình dạng, một bản là đủ và là bắt buộc
```

### Case: phép thử, viết thành một câu

```text
Badge      -> app thứ hai muốn nó mà không muốn feature nào cả  -> packages/ui/src/leaves/
FleetRow   -> muốn nó tức là đã muốn domain fleet               -> apps/fleet/src/components/blocks/
```

### Ngoại lệ và nhầm lẫn

- **Cây một app không kích hoạt mã này.** Cả hai biểu thức đều đòi một đoạn `packages/<name>/src/`
  hoặc `apps/<name>/src/`, nên trong checkout một app, rule **im lặng theo thiết kế** — không phải vì
  cây đã đúng.
- **"Tái sử dụng được về mặt kỹ thuật" không phải tiêu chí.** Một `FleetRow` viết rất tổng quát vẫn là
  một câu nói nghiệp vụ.
- **Header của package không thay được cây thư mục.** Một package từng mang đúng một `blocks/FleetRow/`
  trong khi header của chính nó khẳng định block thuộc về app. Văn bản đúng, cây sai, và **không gì đỏ
  cho bên nào** — đó là toàn bộ lý lẽ cho việc có một rule thay vì một đoạn văn.

---

## `FILE-6` — route chỉ mount, `app/` chỉ chứa route

### Case: một route bình thường

```tsx
// app/[lang]/dashboard/page.tsx
const DashboardRoute = () => <DashboardPage />
export default DashboardRoute
```

Nó nói **URL nào render page nào**. Hết.

### Case: route đã trở thành page thứ hai

```tsx
// SAI: route vừa fetch vừa sắp đặt, nên giờ có hai page và chỉ một trong hai
// nằm ở chỗ người ta sẽ tìm.
export default function DashboardRoute() {
  const session = useSessionToken()
  return (
    <Tree contract="nav-over-body-page">
      <ShellNav session={session} />
      <DashboardPage />
    </Tree>
  )
}
```

Hai đoạn trên khác nhau đúng **một** điều: route có vẽ hay không.

### Case: một component nằm trong cây route

```text
app/[lang]/fleet/
    page.tsx
    fleet-page.tsx      <- sai: đây là một component, đang ở thư mục duy nhất không ai grep
    helpers.ts          <- sai: cũng vậy
```

### Case: sau khi mỗi thứ về nhà của nó

```text
app/[lang]/fleet/
    page.tsx
components/pages/FleetPage/
    index.tsx
    component.tsx
modules/utils/fleet.ts
```

`page.tsx` mount `FleetPage`. Người tìm một màn hình vào `components/pages/` và thấy nó nằm cạnh các
màn hình anh em của nó.

### Case: cây route giữ đúng những gì framework đặt tên

```text
app/
    layout.tsx
    global-error.tsx
    providers.tsx           được nhận: root layout mount nó
    globals.css             được nhận: document import nó
    sitemap.ts
    robots.ts
    api/checkout/route.ts   miễn: server code, không phải màn hình
    _internal/seed.ts       miễn: cửa thoát của chính framework
    [lang]/
        page.tsx
        layout.tsx
        page.test.tsx       miễn: test không ship trong bundle nào
```

### Ngoại lệ và nhầm lẫn

- **Test của route được miễn, và tên cố ý không bị ép.** Test của một route tách theo **mối quan
  tâm** — render gì, ai được vào, ranh giới ở đâu:

  ```text
  app/[lang]/fleet/renders.test.tsx
  app/[lang]/fleet/authorisation.test.tsx
  ```

  Ép cả hai thành `page.test.tsx` chỉ đổi lấy một file dài hơn.

- **`page.tsx` tự vẽ vẫn qua cửa:**

  ```tsx
  // app/[lang]/fleet/page.tsx — SAI về luật, XANH về rule
  export default function FleetRoute() {
    const { data } = useFleet()
    return <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">…</div>
  }
  ```

  "Vẽ" không phải thứ đo được bằng đường dẫn: route mount một component và route sắp đặt sáu thứ đều
  trả về JSX. Cái **đo được chính xác** là file trong cây route có phải slot của framework hay không.

- **Cái giá của việc để nó là văn xuôi có hồ sơ.** Một page owner được viết vào
  `app/<segment>/fleet-page.tsx`, đi qua build, lint, typecheck, bốn ảnh chụp niêm phong và một lần phê
  duyệt, tới sát mép một lần ghi vào production với **mọi cổng đều xanh** — vì mọi cổng đều đang đọc
  rule, còn cái này thì chỉ là văn xuôi.

---

## Ánh xạ yêu cầu sang một đích đến

Nêu file, nó **là** cái gì, và feature nó nói (nếu có). Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng. Câu trả lời phải là một đường dẫn hoặc một câu hỏi — không bao giờ cả
hai.

| Yêu cầu bằng lời | Lập luận | Mã | Đích đến |
|---|---|---|---|
| "Thêm một row hoá đơn, chỉ trang thanh toán dùng" | Nó là một câu nói nghiệp vụ, có tên ngoài màn hình đó | `FILE-2` | `components/blocks/billing/InvoiceRow/` |
| "Để hàm format tiền cạnh component cho gần" | Hàm thuần, không render gì | `FILE-3` | `modules/utils/money.ts` |
| "Viết `useProfile` trong thư mục ProfilePage" | Nó là một fetch | `FILE-3` | `hooks/swr/use-profile.ts` |
| "Gom Root/Header thành `Card` cho call site gọn" | Một object runtime, không phải một family | `FILE-4` | Export thẳng `CardRoot`, `CardHeader` |
| "Đưa `FleetRow` vào package cho hai app dùng chung" | Muốn nó tức là đã muốn domain fleet | `FILE-5` | `apps/fleet/src/components/blocks/fleet/FleetRow/` |
| "Đưa `Badge` vào app đang cần nó" | Nó không biết feature nào | `FILE-5` | `packages/ui/src/leaves/Badge/` |
| "Route này fetch luôn cho nhanh" | Route chỉ nói URL nào render page nào | `FILE-6` | `components/pages/<Name>/index.tsx` |
| "Đặt tạm component trong `app/` cho gần route" | Cây route được địa chỉ hoá bằng URL, không duyệt theo tier | `FILE-6` | `components/pages/<Name>/` |
| "Đổi tên component nhưng giữ tên thư mục cũ" | Đường dẫn thôi không còn dự đoán được cái tên | `FILE-1` | Đổi một trong hai cho khớp |
| "Thêm một component nhỏ vào thư mục Card cho tiện" | Không cùng họ ⇒ hành khách đi nhờ | `FILE-1` | Thư mục riêng ở tier của nó |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `FILE-1` / `FILE-2` | Đang hỏi *tên có khớp export không*, hay đang **đếm file** trong một thư mục màn hình? |
| `FILE-1` / `FILE-4` | Đang hỏi *tên đã export thuộc họ nào*, hay *nó được export ra bằng hình dạng gì*? |
| `FILE-2` / `FILE-3` | Thứ thừa ra là **một file bất kỳ** trong thư mục màn hình, hay đúng một trong bốn thư mục helper? |
| `FILE-3` / `FILE-5` | Câu hỏi là *nó có render không*, hay *nó có biết một feature không*? |
| `FILE-5` / mọi mã khác | Workspace có nhiều app không? Nếu chỉ một app, mã này không kích hoạt. |
| `FILE-6` / `FILE-2` | Vấn đề là **file nào** nằm trong `app/`, hay là **bên trong** `page.tsx` có gì? |

## Sai lầm lặp lại nhiều nhất

1. Trả lời "ai đang gọi nó" thay vì "nó là cái gì".
2. Câu "chỉ mỗi màn này dùng thôi", nói ra ở bước thứ nhất của bốn bước.
3. Để helper cạnh component vì thư mục đích "chưa có".
4. Gom family thành một object cho call site có dấu chấm.
5. Đặt block vào package dùng chung vì nó "viết tổng quát rồi".
6. Fetch trong route file, rồi không tạo page.
7. Đặt component vào `app/` cho gần route.
8. Đổi tên component mà không đổi tên thư mục, rồi vá bằng một re-export.
9. Coi rule xanh là luật đã được giữ — đặc biệt với `FILE-2` và `FILE-6`, hai chỗ rule đọc đường
   dẫn còn luật nói về nội dung.
