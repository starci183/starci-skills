---
id: fe-lints-the-split-example
title: example.md
slug: /fe/lints/the-split/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng thông điệp của hai luật, kèm mã đi lọt qua cửa còn mở.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `the-split` · Luật: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi khối mã dưới đây mở đầu bằng **đường dẫn tệp**, vì với cả hai luật thì đường dẫn chính là thứ
quyết định luật có tồn tại hay không. **SAI** nghĩa là luật nổ; **ĐÚNG** nghĩa là luật im. Trong mục
**Chỗ lách và chỗ dễ nhầm**, mã được ghi rõ là *luật không thấy* — đó không phải mã được phép viết, đó là
mã lọt qua.

---

## `presentational-purity`

### Trường hợp: một yêu cầu mạng trong nửa vẽ

```tsx
// SAI — src/components/blocks/billing/OrderSummary/component.tsx
export const _OrderSummary = () => {
  const order = useQueryCurrentOrderSwr()
  return <p>{order.data?.total}</p>
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/component.tsx
export const _OrderSummary = (input: Props) => <p>{input.props.total}</p>
```

### Trường hợp: một kho trạng thái trong nửa vẽ

```tsx
// SAI — src/components/blocks/billing/OrderSummary/component.tsx
export const _OrderSummary = (input: Props) => {
  const currency = useAppSelector((state) => state.settings.currency)
  return <p>{`${input.props.total} ${currency}`}</p>
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/component.tsx
export const _OrderSummary = (input: Props) => <p>{`${input.props.total} ${input.props.currency}`}</p>
```

### Trường hợp: tra chữ dịch trong nửa vẽ

```tsx
// SAI — src/components/blocks/billing/OrderSummary/component.tsx
export const _OrderSummary = (input: Props) => {
  const t = useTranslations("order")
  return <h3>{t("title")}</h3>
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/component.tsx
export const _OrderSummary = (input: Props) => <h3>{input.props.title}</h3>
```

### Trường hợp: đọc ngôn ngữ đang phục vụ

```tsx
// SAI — src/components/blocks/billing/OrderSummary/component.tsx
const _OrderSummary = (input: Props) => {
  const locale = useLocale()
  return <time>{new Intl.DateTimeFormat(locale).format(input.props.paidAt)}</time>
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/component.tsx
const _OrderSummary = (input: Props) => <time>{input.props.paidAtLabel}</time>
```

### Trường hợp: một truy vấn trực tiếp

```tsx
// SAI — src/components/blocks/billing/OrderSummary/component.tsx
const rows = queryOrderRows({ request })
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/index.tsx
const rows = queryOrderRows({ request })
return <_OrderSummary state="ready" props={{ rows }} />
```

Cùng một dòng chữ, đổi mỗi tên tệp: luật này **chỉ tồn tại** trên `component.tsx`, và nửa đã nối thì
đọc thế giới là đúng việc của nó.

### Trường hợp: trông giống mà không khớp họ nào

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/component.tsx
const rows = useMemo(() => buildRows(input.props.items), [input.props.items])
const isPending = input.state === "pending"
```

Quyết định một tình huống **đã chốt** trông ra sao chính là việc của tệp này. Luật không đụng tới nó.

### Chỗ lách và chỗ dễ nhầm

> Mã trong mục này là mã **luật không thấy**, không phải mã được phép viết.

- **Gọi qua thuộc tính — luật không thấy.** Visitor thoát ngay khi callee không phải `Identifier`.

  ```tsx
  // src/components/blocks/billing/OrderSummary/component.tsx — KHÔNG bị báo, vẫn phá luật
  import * as hooks from "@/hooks"
  const t = hooks.useTranslations("order")
  ```

- **Bọc lại một lớp — luật không thấy.** Không họ nào khớp `useOrderData`.

  ```tsx
  // src/hooks/useOrderData.ts
  export const useOrderData = () => useQueryCurrentOrderSwr()
  ```

  ```tsx
  // src/components/blocks/billing/OrderSummary/component.tsx — KHÔNG bị báo
  const order = useOrderData()
  ```

- **Đổi tên lúc nhập — luật không thấy.** Luật này không đọc `import` lần nào.

  ```tsx
  // src/components/blocks/billing/OrderSummary/component.tsx — KHÔNG bị báo
  import { useTranslations as translate } from "@/i18n"
  const t = translate("order")
  ```

- **Với tay qua một đứa con — luật không thấy.** Không có `CallExpression` nào mang tên thế giới.

  ```tsx
  // src/components/blocks/billing/OrderSummary/component.tsx — KHÔNG bị báo
  import { PaymentRow } from "../PaymentRow" // index.tsx của nó tự gọi mạng
  export const _OrderSummary = (input: Props) => <PaymentRow />
  ```

- **Đổi tên tệp là luật biến mất — luật không thấy.**

  ```tsx
  // src/components/blocks/billing/OrderSummary/view.tsx — KHÔNG bị báo
  const t = useTranslations("order")
  ```

- **Hậu tố viết hoa hết — luật không thấy.** Họ đòi đúng chữ `Swr`.

  ```tsx
  // src/components/blocks/billing/OrderSummary/component.tsx — KHÔNG bị báo
  const order = useCurrentOrderSWR()
  ```

- **Báo nhầm phía ngược lại.** Một hàm thuần tuý dựng chuỗi truy vấn vẫn khớp `query<ChữHoa>…`:

  ```tsx
  // src/components/blocks/billing/OrderSummary/component.tsx — BỊ BÁO, dù chẳng đọc gì
  const href = `?${queryStringFrom(input.props.filters)}`
  ```

---

## `connected-block-has-presentational-twin`

### Trường hợp: đọc thế giới mà không có bản sao — `missing`

```tsx
// SAI — src/components/blocks/billing/OrderSummary/index.tsx
import { useTranslations } from "@/i18n"

export const OrderSummary = () => {
  const t = useTranslations("order")
  return <StatRow props={{ label: t("total") }} />
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/index.tsx
import { useTranslations } from "@/i18n"
import { _OrderSummary } from "./component"

export const OrderSummary = () => {
  const t = useTranslations("order")
  return <_OrderSummary state="ready" props={{ label: t("total") }} />
}
```

### Trường hợp: bọc một thẻ thường quanh bản sao — `bypass`

```tsx
// SAI — src/components/blocks/billing/OrderSummary/index.tsx
import { _OrderSummary } from "./component"

export const OrderSummary = () => {
  const order = useQueryCurrentOrderSwr()
  return (
    <div className="p-4">
      <_OrderSummary state="ready" props={{ total: order.data.total }} />
    </div>
  )
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/index.tsx
import { _OrderSummary } from "./component"

export const OrderSummary = () => {
  const order = useQueryCurrentOrderSwr()
  return <_OrderSummary state="ready" props={{ total: order.data.total }} />
}
```

Cái `<div className="p-4">` là một quyết định **hình thức** nằm sai nửa. Khoảng đệm đó thuộc về
`component.tsx`, nơi người ta nhìn thấy hệ quả của nó.

### Trường hợp: một nhánh vẽ cây khác — `bypass`

```tsx
// SAI — src/components/blocks/billing/OrderSummary/index.tsx
import { _OrderSummary } from "./component"

export const OrderSummary = () => {
  const order = useQueryCurrentOrderSwr()
  if (order.data.items.length === 0) return <EmptyNotice />
  return <_OrderSummary state="ready" props={{ items: order.data.items }} />
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/index.tsx
import { _OrderSummary } from "./component"

export const OrderSummary = () => {
  const order = useQueryCurrentOrderSwr()
  if (order.data.items.length === 0) return <_OrderSummary state="empty" props={{}} />
  return <_OrderSummary state="ready" props={{ items: order.data.items }} />
}
```

Trạng thái rỗng là một **tình huống**, và mọi tình huống đều được vẽ ở nửa vẽ.

### Trường hợp: nhập rồi bỏ quên — `unused`

```tsx
// SAI — src/components/blocks/billing/OrderSummary/index.tsx
import { _OrderSummary } from "./component"

export const OrderSummary = () => {
  const t = useTranslations("order")
  return t("empty")
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/index.tsx
import { _OrderSummary } from "./component"

export const OrderSummary = () => {
  const t = useTranslations("order")
  return <_OrderSummary state="empty" props={{ message: t("empty") }} />
}
```

### Trường hợp: block mỏng vẫn không được miễn

```tsx
// SAI — src/components/blocks/billing/CreditRow/index.tsx
export const CreditRow = () => {
  const quota = useQueryQuotaSwr()
  return <StatRow props={{ value: quota.data.value }} />
}
```

```tsx
// ĐÚNG — src/components/blocks/billing/CreditRow/index.tsx
import { _CreditRow } from "./component"

export const CreditRow = () => {
  const quota = useQueryQuotaSwr()
  return <_CreditRow state="settled" props={{ value: quota.data.value }} />
}
```

Trong mã nguồn **không có nhánh nào** hỏi block này mỏng hay dày.

### Trường hợp: không đọc thế giới thì không bị soi

```tsx
// ĐÚNG — src/components/blocks/billing/OrderSummary/index.tsx
export const OrderSummary = ({ props }: Props) => <OrderRows props={props} />
```

Tệp này chỉ nhận và chuyển tiếp. `readsWorld` không bật, `Program:exit` trả về ngay, không báo gì.

### Chỗ lách và chỗ dễ nhầm

> Mã trong mục này là mã **luật không thấy**, không phải mã được phép viết.

- **Giặt sạch lời gọi là tắt cả luật — luật không thấy.** Đây là cửa rộng nhất của mô-đun.

  ```tsx
  // src/components/blocks/billing/OrderSummary/index.tsx — KHÔNG bị báo, dù vẽ thẳng một lá
  import { useOrderData } from "@/hooks/useOrderData"

  export const OrderSummary = () => {
    const order = useOrderData()
    return <StatRow props={{ total: order.total }} />
  }
  ```

- **Vẽ mà không dùng JSX — luật không thấy.** Bản sao vẫn xuất hiện ở một nhánh, nên `rendersTwin`
  bật và danh sách đã vẽ chỉ có mỗi bản sao.

  ```tsx
  // src/components/blocks/billing/OrderSummary/index.tsx — KHÔNG bị báo
  import { _OrderSummary } from "./component"

  export const OrderSummary = () => {
    const order = useQueryCurrentOrderSwr()
    if (order.error) return createElement(ErrorPanel, { error: order.error })
    return <_OrderSummary state="ready" props={{ total: order.data.total }} />
  }
  ```

- **Thẻ có dấu chấm — luật không thấy.** `JSXMemberExpression` không được đẩy vào danh sách.

  ```tsx
  // src/components/blocks/billing/OrderSummary/index.tsx — KHÔNG bị báo
  import { _OrderSummary } from "./component"

  export const OrderSummary = () => {
    const order = useQueryCurrentOrderSwr()
    return (
      <Ui.Card>
        <_OrderSummary state="ready" props={{ total: order.data.total }} />
      </Ui.Card>
    )
  }
  ```

- **Đặt sai một đoạn đường dẫn là hết luật — luật không thấy.**

  ```tsx
  // src/features/billing/OrderSummary/index.tsx — KHÔNG bị báo
  export const OrderSummary = () => {
    const order = useQueryCurrentOrderSwr()
    return <StatRow props={{ total: order.data.total }} />
  }
  ```

- **Bản sao chỉ là một cái tên — luật không thấy.** Luật không mở `component.tsx` ra xem bao giờ.

  ```tsx
  // src/components/blocks/billing/OrderSummary/component.tsx — KHÔNG bị báo bởi luật bản sao
  export const _OrderSummary = () => <div /> // rỗng, và cả cây thật vẫn nằm ở index.tsx
  ```

- **Nhập mặc định rồi đổi tên — luật không thấy.** Specifier mặc định không có `imported` để thử.

  ```tsx
  // src/components/blocks/billing/OrderSummary/index.tsx — KHÔNG bị báo
  import fetcher from "@/lib/fetcher"
  export const OrderSummary = () => <StatRow props={{ total: fetcher("/order").total }} />
  ```

- **Đổi tên khi nhập là báo NHẦM, không phải lọt.** Tệp dưới đây viết đúng tinh thần mà vẫn ăn
  `missing`, vì phép nhập phải khít cả ba: nguồn, tên nhập, tên cục bộ.

  ```tsx
  // src/components/blocks/billing/OrderSummary/index.tsx — BỊ BÁO `missing`
  import { _OrderSummary as View } from "./component"
  export const OrderSummary = () => {
    const order = useQueryCurrentOrderSwr()
    return <View state="ready" props={{ total: order.data.total }} />
  }
  ```

---

## Ánh xạ yêu cầu sang cảnh báo

| Yêu cầu bằng lời | Luật nào tỉnh dậy | Thông điệp | Mã luật |
|---|---|---|---|
| "Cho tôi lấy chữ dịch ngay trong tệp vẽ cho tiện" | `presentational-purity` | `reaches` | `SPLIT-1` |
| "Đọc tạm kho trạng thái ở đây, có mỗi một giá trị" | `presentational-purity` | `reaches` | `SPLIT-1` |
| "Định dạng ngày theo ngôn ngữ hiện tại ngay chỗ vẽ" | `presentational-purity` | `reaches` | `SPLIT-1` |
| "Block này mỏng, vẽ thẳng một lá thôi" | `connected-block-has-presentational-twin` | `missing` | `SPLIT-5` |
| "Bọc thêm cái `div` cho có khoảng đệm" | `connected-block-has-presentational-twin` | `bypass` | `SPLIT-5` |
| "Rỗng thì trả về một thông báo riêng cho nhanh" | `connected-block-has-presentational-twin` | `bypass` | `SPLIT-5` |
| "Có nhập bản sao rồi mà, để đó đã" | `connected-block-has-presentational-twin` | `unused` | `SPLIT-5` |
| "Gom lời gọi vào một hook cho gọn" | **không luật nào** | *im lặng* | — |
| "Chuyển khoá dịch xuống, để tệp vẽ tự tra" | **không luật nào** | *im lặng* | `SPLIT-4` không có luật máy |
| "Dùng bốn cờ boolean thay cho một tên tình huống" | **không luật nào** | *im lặng* | `SPLIT-3` không có luật máy |
| "Tách đôi một bề mặt chẳng gọi mạng gì cả" | **không luật nào** | *im lặng* | `SPLIT-6` không có luật máy |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| `reaches` có nổ không | Tên hàm được gọi có phải `Identifier` khớp một trong bốn họ không, và tệp có tên đúng `component.tsx` không? |
| `missing` hay im lặng | Bộ dò có coi tệp này là đã đọc thế giới không? Nếu không, luật không hề chạy tiếp |
| `missing` hay `bypass` | Đã có phép nhập khít cả ba (nguồn `./component`, tên nhập, tên cục bộ) chưa? Chưa thì dừng ở `missing` |
| `bypass` hay không | Thẻ đó là `JSXIdentifier` chứ? Thẻ có dấu chấm không bao giờ vào danh sách |
| `unused` hay `bypass` | Bản sao có xuất hiện dưới dạng thẻ JSX ít nhất một lần không? |
| Luật thật sự đóng hay chỉ có vẻ đóng | Lời gọi thế giới có đi thẳng bằng tên gốc không, hay đã qua một hàm bọc / một namespace? |

## Sai lầm lặp lại nhiều nhất

1. Tin rằng `presentational-purity` kiểm "độ thuần". Nó kiểm **bốn họ tên hàm**, không hơn.
2. Tin rằng `connected-block-has-presentational-twin` đã kiểm bản sao tồn tại. Nó kiểm **một cái tên**.
3. Bọc lời gọi vào một hook tên bình thường rồi tưởng mình đã dọn dẹp — thực ra vừa tắt cả hai luật.
4. Đổi tên tệp vẽ khỏi `component.tsx` và không biết rằng luật vừa biến mất khỏi tệp đó.
5. Bọc `<div>` quanh bản sao vì "cho có khoảng đệm", rồi đi gỡ luật thay vì dời khoảng đệm sang nửa vẽ.
6. Đổi tên bản sao lúc nhập cho "đọc cho gọn", rồi kết luận luật hỏng khi thấy `missing`.
7. Coi `SPLIT-2`, `SPLIT-3`, `SPLIT-4`, `SPLIT-6` là đã được giữ, chỉ vì cùng nằm trong một văn bản
   luật với hai điều đã có máy giữ.
