---
id: fe-lints-lint-escape-hatch-example
title: example.md
slug: /fe/lints/lint-escape-hatch/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho rule no-inline-lint-config — chỗ nó nổ, chỗ nó im, và chỗ nó nhìn không ra.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `lint-escape-hatch` · Luật: [`INDEX.md`](./INDEX.md) · Bối cảnh: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã nguồn thường, đặt trong một tệp có đoạn `/src/` trên đường dẫn — vì ngoài
cổng đó rule không có mặt. Không tên sản phẩm, không thư viện thành phần riêng; chỉ những định danh
rule thật, vì định danh là thứ hiện ra trong bản dựng.

Mỗi trường hợp có một cặp **SAI** (rule nổ) và **ĐÚNG** (rule im). Cuối trang là mục **Cửa lách và
nhầm lẫn**: mã ở đó **lọt qua** rule, và lọt không có nghĩa là được phép.

---

## `no-inline-lint-config`

### Trường hợp: cú pháp khai báo của thư viện ngoài

Một thư viện bên ngoài đòi cú pháp mà rule chung cấm. Phản xạ đầu tiên là tắt tại chỗ.

```ts
// SAI — src/integrations/vendor-types.ts
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace VendorTypes {
    export type Handle = string
}
```

```ts
// ĐÚNG — src/integrations/vendor-types.d.ts
declare module "vendor" {
    export type Handle = string
}
```

Hai bản này khác nhau đúng một điều: cấu hình chung sở hữu cú pháp khai báo hợp lệ, hay một tệp tự
đình chỉ luật cho riêng nó.

### Trường hợp: biến khai báo mà không dùng

```ts
// SAI — src/checkout/summary.ts
/* eslint-disable no-unused-vars */
function summarize(items: Item[], currency: string) {
    return items.reduce((total, item) => total + item.amount, 0)
}
```

```ts
// ĐÚNG — src/checkout/summary.ts
function summarize(items: Item[]) {
    return items.reduce((total, item) => total + item.amount, 0)
}
```

Tham số thừa là một dữ kiện: chữ ký hàm đang hứa một thứ nó không dùng. Tắt rule giữ lại lời hứa sai.

### Trường hợp: phụ thuộc của hook

```tsx
// SAI — src/dashboard/use-summary.ts
useEffect(() => {
    void refresh(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

```tsx
// ĐÚNG — src/dashboard/use-summary.ts
const load = useCallback(() => {
    void refresh(range)
}, [range, refresh])

useEffect(() => {
    load()
}, [load])
```

Dòng tắt lint ở bản SAI không làm cho phụ thuộc biến mất; nó chỉ làm cho lần chạy lại thiếu sót trở
nên im lặng.

### Trường hợp: tắt cả tệp ngay dòng đầu

```ts
// SAI — src/reports/legacy-adapter.ts
/* eslint-disable */
export const adapt = (raw: any) => raw.rows.map((r: any) => ({ id: r.i, label: r.l }))
```

```ts
// ĐÚNG — src/reports/legacy-adapter.ts
interface RawRow {
    i: string
    l: string
}

interface RawReport {
    rows: RawRow[]
}

export const adapt = (raw: RawReport) => raw.rows.map((row) => ({ id: row.i, label: row.l }))
```

Một dòng ở đầu tệp tắt **mọi** luật cho **mọi** dòng phía sau, kể cả những luật chưa được viết ra vào
lúc dòng đó được thêm vào.

### Trường hợp: tắt kèm lý do tử tế

```ts
// SAI — src/session/token.ts
// eslint-disable-next-line no-console -- tạm thời, sẽ gỡ sau khi xong đợt phát hành
console.log("token refreshed", expiresAt)
```

```ts
// ĐÚNG — src/session/token.ts
logger.debug("token refreshed", { expiresAt })
```

Lý do **ghi lại** việc né luật, nó không **ngăn** việc né luật. `\b` trong mẫu đóng phép khớp ngay sau
tên directive, nên phần lý do thậm chí không được đọc tới.

### Trường hợp: kiểu `any` ở ranh giới dữ liệu

```ts
// SAI — src/api/parse.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const parse = (payload: any) => payload.data.items
```

```ts
// ĐÚNG — src/api/parse.ts
export const parse = (payload: unknown) => {
    if (!isPayload(payload)) throw new InvalidPayloadError()
    return payload.data.items
}
```

### Trường hợp: cặp `disable` / `enable` bọc lấy một khối

```ts
// SAI — src/pricing/table.ts
/* eslint-disable no-magic-numbers */
const tiers = [9, 29, 99]
const discount = 0.15
/* eslint-enable no-magic-numbers */
```

```ts
// ĐÚNG — src/pricing/table.ts
const TIER_PRICES = [9, 29, 99] as const
const ANNUAL_DISCOUNT_RATE = 0.15
```

Rule nổ **hai lần** ở bản SAI: `eslint-enable` là một nhánh riêng trong mẫu, không phải phần phụ.

### Trường hợp: né một rule kiến trúc

```tsx
// SAI — src/blocks/credit-stat-row.tsx
/* eslint-disable starci-fe/connected-block-has-presentational-twin */
return <StatRow props={{ label }} isLoading />
```

```tsx
// ĐÚNG — src/blocks/credit-stat-row.tsx
return <_CreditStatRow state="pending" props={{ label }} />
```

Hai bản khác nhau đúng một điều: ranh giới giữa phần nối dữ liệu và phần trình bày còn tồn tại hay
không. Đây là loại rule đắt nhất, và cũng là loại hay bị tắt nhất.

### Trường hợp: directive viết trong chú thích của đánh dấu

```tsx
// SAI — src/views/settings-panel.tsx
return (
    <section>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div onClick={onToggle}>{label}</div>
    </section>
)
```

```tsx
// ĐÚNG — src/views/settings-panel.tsx
return (
    <section>
        <button onClick={onToggle} type="button">{label}</button>
    </section>
)
```

Chú thích trong biểu thức đánh dấu vẫn là một node chú thích bình thường, nên `getAllComments()` trả
nó về và rule vẫn nổ.

### Trường hợp: chú thích khối nhiều dòng, directive nằm ở dòng thứ hai

```ts
// SAI — src/search/index.ts
/*
 eslint-disable complexity
*/
export const rank = (query: string, docs: Doc[]) => docs.map((doc) => score(query, doc))
```

```ts
// ĐÚNG — src/search/index.ts
export const rank = (query: string, docs: Doc[]) => docs.map((doc) => score(query, doc))
```

`\s` trong `^\s*` bao cả ký tự xuống dòng, nên xuống dòng không phải chỗ trốn.

### Trường hợp: chú thích **không** bị báo, và đó là cố ý

```ts
// ĐÚNG — src/session/token.ts
// Tệp này không dùng eslint-disable ở bất kỳ đâu; mọi trường hợp hợp lệ đã nằm trong cấu hình chung.
export const refresh = () => client.post("/token/refresh")
```

```ts
// ĐÚNG — src/session/token.ts
// Cờ eslint-disabled bên dưới là tên trạng thái nội bộ, không phải directive.
const eslintDisabled = false
```

Bắt hụt ở hai chỗ này là **có chủ ý**. Bộ lint chỉ nghe directive nằm ở đầu thân chú thích; một mẫu
không neo sẽ bắt trúng **chữ** thay vì bắt trúng **directive**, và câu giải thích rằng tệp này không
tắt lint lại bị báo là đang tắt lint. Cách duy nhất cho im khi ấy là thôi viết lời giải thích — ngược
hẳn ý luật.

### Chỗ lách và chỗ dễ nhầm

Mã trong mục này **lọt qua** rule. Không mục nào ở đây là mã được phép; đây là danh sách những chỗ
người gác nhìn không ra, để ai đọc còn biết mà tự canh.

- **Chú thích cấu hình trần.** Đây mới là "đổi cấu hình lint tại chỗ" ở nghĩa đen nhất, bộ lint nghe
  theo, và mẫu không khớp vì mẫu chỉ biết họ `disable`/`enable`:

  ```ts
  // src/session/token.ts — LỌT, không phải được phép
  /* eslint no-console: "off" */
  console.log("token refreshed", expiresAt)
  ```

- **Khai báo môi trường và biến toàn cục.** Cùng một lỗ hổng họ hàng — đổi cách tệp được lint, không
  mở đầu bằng `eslint-disable`:

  ```ts
  // src/tools/bootstrap.ts — LỌT
  /* eslint-env node */
  /* globals FEATURE_FLAGS */
  ```

- **Tệp nằm ngoài đoạn `/src/`.** Cùng một dòng, đặt ở thư mục gốc của kho thì rule **không có mặt**,
  chứ không phải yếu đi:

  ```ts
  // app/routes/report.ts — LỌT, vì đường dẫn không có đoạn /src/
  /* eslint-disable */
  export const loader = async () => fetchEverything()
  ```

- **Cùng một tệp, gọi bằng đường dẫn tương đối.** Cổng đòi đúng chuỗi `/src/`, mà đường dẫn tương đối
  thì không có dấu phân cách đứng trước:

  ```bash
  # LỌT — cùng nội dung, một cách gọi bị canh, một cách gọi thì không
  lint /kho/src/thing.tsx      # có /src/  → rule chạy
  lint src/thing.tsx           # không có  → rule im
  ```

- **Miễn trừ viết trong cấu hình thay vì viết trong tệp.** Đây đúng là thứ luật cấm mạnh nhất, và cũng
  đúng là thứ không có gì đi soi:

  ```js
  // eslint.config.mjs — LỌT, và là cửa hở lớn nhất của mô-đun này
  {
      files: ["src/reports/legacy-adapter.ts"],
      rules: { "starci-fe/no-inline-lint-config": "off" },
  }
  ```

- **Directive cất trong chuỗi rồi mới ghi ra tệp sau.** Chuỗi ký tự không phải chú thích:

  ```ts
  // src/tools/codegen.ts — LỌT
  const BANNER = "// eslint-disable-next-line @typescript-eslint/no-explicit-any"
  await writeFile(target, `${BANNER}\n${body}`)
  ```

- **Chú thích ở bề mặt bộ phân tích không giao lại.** `getAllComments()` chỉ trả về thứ đã được gắn
  vào cây cú pháp:

  ```html
  <!-- src/emails/receipt.html — LỌT -->
  <!-- eslint-disable -->
  ```

- **Cấu hình tiêu thụ quên áp `linterOptions.noInlineConfig`.** Khi đó chính rule này bị bịt miệng
  trước khi kịp báo — một hàng rào tắt được bằng đúng dòng chú thích mà nó cấm:

  ```ts
  // src/reports/legacy-adapter.ts — LỌT khi hàng rào cấu hình không được áp
  /* eslint-disable starci-fe/no-inline-lint-config */
  /* eslint-disable */
  ```

  ```js
  // eslint.config.mjs — bản có hàng rào: directive trên kia thành vô hiệu
  { linterOptions: { noInlineConfig: true }, rules: recommended }
  ```

## Ánh xạ yêu cầu sang một phán quyết

Nêu đường dẫn tệp, dạng chú thích và cấu hình đang áp. Thiếu **một** dữ kiện quyết định thì hỏi
**một** câu rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Phán quyết |
|---|---|---|---|
| "Cho tôi tắt rule này đúng một dòng, có ghi lý do" | Lý do không đổi được bản chất; `\b` còn không đọc tới nó | `LINT-ESCAPE-1` | Rule nổ. Sửa mã hoặc sửa rule chung |
| "Tệp này là mã cũ, cho tắt cả tệp" | Tắt cả tệp tắt luôn những luật chưa được viết | `LINT-ESCAPE-1` | Rule nổ. Sửa, hoặc đưa hẳn tệp ra khỏi mã nguồn sản phẩm |
| "Thêm đường dẫn này vào danh sách miễn trừ" | Rule không nhận tuỳ chọn nào | `LINT-ESCAPE-3` | Không có chỗ để viết. Từ chối |
| "Hạ rule xuống `warn` trong cấu hình cho đợt này" | Rule không đọc cấu hình | `LINT-ESCAPE-3` | **Lọt**. Là cửa hở, phải chặn bằng rà soát người |
| "Tôi chỉ viết `/* eslint some-rule: off */` thôi mà" | Mẫu chỉ biết họ `disable`/`enable` | `LINT-ESCAPE-1` | **Lọt**. Vẫn là vi phạm luật |
| "Tệp nằm ở thư mục gốc, không có `/src/`" | Cổng đường dẫn không khớp | — | **Lọt**. Rule không có mặt, không phải cho phép |
| "Cần cố tình dựng directive để kiểm thử rule" | Tệp kiểm thử nằm ngoài mọi đoạn `/src/` | — | Hợp lệ. Là ranh giới của cổng, không phải ngoại lệ |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| Rule nổ / rule im | Thân chú thích có **mở đầu** bằng `eslint-disable`, `-line`, `-next-line` hay `eslint-enable` không? |
| Rule im / rule không có mặt | Đường dẫn sau khi đổi `\` thành `/` có chứa đoạn `/src/` không? |
| Vi phạm luật / lọt qua máy | Bộ lint có nghe theo dòng đó không, dù mẫu có khớp hay không? |
| Ngoại lệ / ranh giới của cổng | Đây là mã nguồn sản phẩm, hay là tệp kiểm thử dựng ra directive để soi chính rule? |
| Rule chưa đủ / luật chưa đủ | Nếu rule bắt nhầm, sửa **mẫu** cho mọi người; nếu rule bắt đúng, sửa **mã** |

## Sai lầm lặp lại nhiều nhất

1. Tin rằng ghi kèm lý do thì dòng tắt lint trở nên hợp lệ.
2. Tắt cả tệp ở dòng đầu, tắt luôn những luật chưa được viết ra.
3. Chuyển ngoại lệ từ chú thích sang cấu hình rồi coi là đã tuân thủ — cùng một hành vi, chỉ khác chỗ
   viết, và chỗ viết mới thì không có gì soi.
4. Đọc "lọt qua máy" thành "được phép".
5. Đưa rule vào plugin nhưng quên áp `linterOptions.noInlineConfig`, để lại một hàng rào tắt được bằng
   đúng dòng nó cấm.
6. Bỏ tệp ra khỏi đoạn `/src/` để hết đỏ, thay vì sửa nội dung.
7. Viết `\b` ra khỏi mẫu để "bắt cho chắc", rồi bắt trúng cả câu giải thích và làm im luôn lời giải
   thích đó.
