---
id: fe-lints-icon-example
title: example.md
slug: /gates/lints/icon/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng luật lint biểu tượng — cái gì bị báo, cái gì không, và cái gì lọt.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `icon` · Luật: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi luật có nhiều cặp **SAI** (luật nổ) và **ĐÚNG** (luật im), rồi tới mục **Chỗ lách và chỗ dễ nhầm**
mang mã đi lọt.

Đọc mục cuối đó cho kỹ: mã trong đó **không phải mã được phép**. Nó là mã mà luật **không nhìn thấy**.
Hai chuyện đó khác nhau, và nhầm chúng là cách một kệ tài liệu thực thi biến thành một danh sách mẹo
lách.

---

## `no-vendor-icon-outside-icon-leaf`

### SAI — nhập thẳng thư viện hình tại chỗ gọi

```tsx
// src/components/blocks/CourseRow/index.tsx
import { ChevronRight } from "lucide-react"

export const CourseRow = () => <ChevronRight className="size-5" />
```

### ĐÚNG — hỏi một ý nghĩa và một vai trò

```tsx
// src/components/blocks/CourseRow/index.tsx
import { Icon } from "@/components/leaves/Icon"

export const CourseRow = () => <Icon props={{ name: "disclosure", role: "leading" }} />
```

### SAI — đi đường vòng qua đường dẫn con của gói

```tsx
// src/app/(dashboard)/page.tsx
import { CaretRight } from "@phosphor-icons/react/dist/ssr"
```

Gói được so bằng **tiền tố**, nên đường dẫn con không cứu được. Đây đúng là escape mà cả mô-đun luật
này được viết ra sau khi phát hiện.

### ĐÚNG — chiếc lá biểu tượng, tệp duy nhất được gọi tên thư viện

```tsx
// src/components/leaves/Icon/index.tsx
import { BookOpenIcon } from "@heroicons/react/24/outline"
import { XMarkIcon } from "@heroicons/react/16/solid"
```

### SAI — một gói không có trong danh sách nhưng tên đã tự khai

```ts
// src/lib/menu.ts
import { Home } from "some-tiny-icons"
```

Tên gói mang chữ `icon`, nên nó bị coi là gói hình dù chẳng ai liệt kê nó.

### ĐÚNG — một gói ngoài không dính dáng gì tới hình

```ts
// src/lib/menu.ts
import { format } from "date-fns"
```

### Chỗ lách và chỗ dễ nhầm

Toàn bộ mã dưới đây **đi lọt**. Không cái nào trong số này là cách viết được phép.

```tsx
// src/components/blocks/StatRow/index.tsx
// LỌT: không phải ImportDeclaration, nên bộ duyệt không thấy gì.
const { ChevronRight } = require("lucide-react")
```

```tsx
// src/components/blocks/StatRow/index.tsx
// LỌT: import động là một nút khác hẳn.
const Caret = dynamic(() => import("@phosphor-icons/react").then((m) => m.CaretRight))
```

```ts
// src/components/leaves/marks.ts
// LỌT: xuất lại có mang nguồn, nhưng không phải ImportDeclaration.
// Một tệp trung chuyển một dòng là giặt sạch cả gói.
export { ChevronRight, Home } from "lucide-react"
```

```ts
// packages/ui/marks.ts
// LỌT: đường dẫn không chứa "/src/", nên luật còn chẳng được lắp.
// Tên xuất lại trung tính, không mang dấu hiệu tên nào.
export { CaretRight as Forward } from "@phosphor-icons/react"
```

```tsx
// src/features/league/leaves/Icon/index.tsx
// LỌT: cổng tệp là phép so ĐUÔI đường dẫn, nên đây là chiếc lá biểu tượng thứ hai,
// tự do y hệt chiếc lá thật, chỉ khác chỗ đứng.
import { Trophy } from "lucide-react"
```

---

## `heroicons-is-the-glyph-vendor`

### SAI — đổi nhà cung cấp từ bên trong chính chiếc lá

```tsx
// src/components/leaves/Icon/index.tsx
import { Fire } from "@phosphor-icons/react"
```

Quyền sở hữu bản đồ ý nghĩa không phải giấy phép mở bộ từ vựng hình thứ hai. Luật này cố tình không
miễn trừ cho chiếc lá.

### ĐÚNG — đúng hai họ đã duyệt

```tsx
// src/components/leaves/Icon/index.tsx
import { FireIcon, HomeIcon } from "@heroicons/react/24/outline"
import { CheckCircleIcon } from "@heroicons/react/16/solid"
```

### SAI — họ ở giữa, đúng nhà cung cấp nhưng sai họ

```tsx
// src/components/leaves/Icon/index.tsx
import { BellIcon } from "@heroicons/react/20/solid"
```

Cùng nhà cung cấp không đủ. Chỉ hai chuỗi đúng nguyên văn được tha; họ 20 là một họ thứ ba.

### ĐÚNG — mark của nhà cung cấp danh tính là SVG cục bộ

```tsx
// src/components/leaves/Icon/brands.tsx
export const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
    <path d="M12 11v2h5.5c-.2 1.4-1.6 4-5.5 4a5 5 0 1 1 0-10c1.4 0 2.5.6 3.1 1.1l2.1-2A8 8 0 1 0 12 20c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12z" />
  </svg>
)
```

Nguồn tương đối và SVG viết tay bị loại trước mọi phép thử, nên mark chính xác của một nhà cung cấp
danh tính vẫn là cách làm được luật văn bản chỉ định.

### SAI — một câu nhập sai bị báo hai lần

```tsx
// src/components/blocks/StreakCard/index.tsx
import { Flame } from "lucide-react"
```

Từ một tệp thường, câu này vi phạm **cả hai** luật nhập: một lần vì nhập gói hình ngoài chiếc lá,
một lần vì gói đó không thuộc hai họ. Hai thông điệp trên cùng một dòng là đúng thiết kế.

### Chỗ lách và chỗ dễ nhầm

```ts
// src/components/leaves/Icon/index.tsx
// LỌT: tên gói không mang icon/glyph/lucide/feather/tabler/fortawesome,
// và không nằm trong danh sách tiền tố. Một bộ hình thứ hai vào nhà bằng cửa chính.
import { Medal } from "@some-vendor/pictograms-react"
```

```tsx
// src/components/leaves/Icon/index.tsx
// LỌT: nguồn tương đối bị loại trước khi thử. Cả một bộ từ vựng hình thứ hai
// có thể được lắp hoàn toàn bằng tệp cục bộ.
import Flame from "./glyphs/flame.svg"
```

```ts
// src/components/blocks/StreakCard/index.tsx
// NHẦM LẪN THEO CHIỀU NGƯỢC LẠI: bị báo dù không có gì được đóng gói ra.
// Đây là một lần báo thừa, không phải một escape.
import type { LucideIcon } from "lucide-react"
```

---

## `no-off-scale-glyph-size`

### SAI — giá trị tuỳ ý trong ngoặc vuông

```tsx
<Icon props={{ name: "streak", role: "leading" }} className="size-[18px]" />
```

### ĐÚNG — một trong các bậc mà vai trò đưa ra

```tsx
<Icon props={{ name: "streak", role: "leading" }} />
```

### SAI — phân số thập phân

```tsx
<span className="inline-flex items-center gap-2 size-4.5" />
```

### ĐÚNG — bậc nguyên nằm trong thang

```tsx
<span className="inline-flex items-center gap-2 size-4" />
```

### SAI — giặt literal vào một hằng vẫn bị bắt

```ts
// Mọi VariableDeclarator có khởi tạo là chuỗi tĩnh đều bị quét,
// nên kiểu gom-chuỗi-lớp-vào-hằng đơn giản nhất đã bị bịt sẵn.
const GLYPH = "shrink-0 size-[18px] text-current"
```

### ĐÚNG — cùng cách gom, nhưng cỡ nằm trong thang

```ts
const GLYPH = "shrink-0 size-5 text-current"
```

### ĐÚNG — thuộc tính viết bằng `class`, và bằng template không biểu thức

```tsx
// Cả hai cách viết đều được rút chuỗi tĩnh ra, nên cả hai đều bị soi bình thường.
const a = <i class="size-4" />
const b = <i className={`size-4`} />
```

### Chỗ lách và chỗ dễ nhầm

```tsx
// LỌT: cỡ nguyên lệch thang không khớp mẫu, vì mẫu chỉ nhận phân số hoặc ngoặc vuông.
// Đây chính là cách DỄ VIẾT HƠN của đúng sai lầm mà luật sinh ra để chặn.
<Icon props={{ name: "streak", role: "leading" }} className="size-9" />
```

```tsx
// LỌT: dạng hai tiện ích rộng-cao riêng không phải tiện ích mà mẫu canh.
<i className="h-[18px] w-[18px]" />
```

```ts
// LỌT: chuỗi nằm trong object không phải thuộc tính lớp, cũng không phải
// hằng khởi tạo bằng chuỗi. Chỗ gọn gàng nhất để cất chuỗi lớp là chỗ mù nhất.
const CLASSES = { glyph: "shrink-0 size-[18px]" }
```

```tsx
// LỌT: mảng cũng vậy — literal không nằm ở nút mà luật đứng canh.
<i className={join(["shrink-0", "size-[18px]"])} />
```

```tsx
// LỌT: chuỗi tĩnh không bao giờ được rút ra từ một lời gọi hàm.
<i className={cx("shrink-0", isCompact && "size-[18px]")} />
```

```tsx
// LỌT: template có một biểu thức thì trả về rỗng, không còn gì để thử.
<i className={`shrink-0 size-[${px}px]`} />
```

```ts
// LỌT MỘT NỬA: phép so không toàn cục, nên chỉ "size-4.5" bị báo,
// còn "size-[18px]" đứng sau không bao giờ được đọc tới.
const BOTH = "size-4.5 md:size-[18px]"
```

```tsx
// BÁO NHẦM: đây là ảnh đại diện, không phải hình biểu tượng. Luật không có
// lấy một mẩu ngữ cảnh hình nào — nó chỉ thấy một tiện ích size- trong ngoặc vuông.
<img alt="" className="rounded-full size-[44px]" />
```

---

## `no-decorative-icon-in-metric-cell`

### SAI — hình trang trí trong ô số liệu lặp lại

```tsx
// src/components/composites/LabelledProgressRow/index.tsx
export const LabelledProgressRow = ({ label, value }: Props) => (
  <div className="flex items-center gap-2">
    <Icon props={{ name: "course", role: "chip" }} />
    <span>{label}</span>
    <span className="ml-auto tabular-nums">{value}</span>
  </div>
)
```

### ĐÚNG — giữ nhãn và con số, bỏ hình

```tsx
// src/components/composites/LabelledProgressRow/index.tsx
export const LabelledProgressRow = ({ label, value }: Props) => (
  <div className="flex items-center gap-2">
    <span>{label}</span>
    <span className="ml-auto tabular-nums">{value}</span>
  </div>
)
```

### SAI — hình trạng thái cũng vẫn là thẻ `Icon` trong đúng tệp đó

```tsx
// src/components/composites/LabelledProgressRow/index.tsx
<Icon props={{ name: "complete", role: "chip" }} />
```

Luật không phân biệt hình tính năng với hình trạng thái. Trong tệp này, mọi thẻ `Icon` đều bị báo.

### ĐÚNG — cùng thẻ đó ở một tệp khác

```tsx
// src/components/blocks/NavItem/index.tsx
<Icon props={{ name: "home", role: "leading" }} />
```

Ô điều hướng có các lựa chọn ngang hàng để phân biệt, nên hình ở đây làm đúng việc của nó.

### Chỗ lách và chỗ dễ nhầm

```tsx
// src/components/composites/LabelledProgressRow/row.tsx
// LỌT: cả luật chỉ tồn tại cho MỘT đường dẫn. Chuyển phần đánh dấu sang tệp anh em
// cùng thư mục là xoá được luật mà không chạm một dòng nào vào luật.
export const Row = () => <Icon props={{ name: "course", role: "chip" }} />
```

```tsx
// src/components/composites/LabelledProgressRow/index.tsx
// LỌT: tên thẻ phải đúng chữ "Icon". Bí danh lúc nhập là đủ để biến mất.
import { Icon as Glyph } from "@/components/leaves/Icon"

export const LabelledProgressRow = () => <Glyph props={{ name: "course", role: "chip" }} />
```

```tsx
// src/components/composites/LabelledProgressRow/index.tsx
// LỌT: JSXMemberExpression không phải JSXIdentifier; và một thành phần khác
// tự vẽ hình bên trong thì luật cũng không nhìn thấy hình nào.
<Glyphs.Icon props={{ name: "course", role: "chip" }} />
<IconTile props={{ name: "course" }} />
```

---

## `rank-artwork-is-a-closed-set`

### SAI — định danh tranh giải nêu ngoài chiếc lá xếp hạng

```tsx
// src/components/blocks/LeaderboardRow/index.tsx
<Iconify icon="fluent-emoji-flat:1st-place-medal" className="size-5" />
```

Bản đồ hạng-sang-tranh phải nằm một chỗ, để màn hình thứ hai không trả lời cùng câu hỏi khác đi.

### ĐÚNG — hỏi chiếc lá bằng thứ hạng

```tsx
// src/components/blocks/LeaderboardRow/index.tsx
<RankMark props={{ place }} />
```

### SAI — tấm huy chương thứ năm, ngay bên trong chiếc lá

```ts
// src/components/leaves/RankMark/index.tsx
const ARTWORK = {
  1: "fluent-emoji-flat:1st-place-medal",
  2: "fluent-emoji-flat:2nd-place-medal",
  3: "fluent-emoji-flat:3rd-place-medal",
  4: "fluent-emoji-flat:4th-place-medal",
}
```

Miễn trừ mua về bốn định danh, không mua về nguyên một catalog. Cái thứ năm là một quyết định sản
phẩm về việc một thứ hạng **có nghĩa gì**, nên nó được quyết trong văn bản luật chứ không trong tệp
này.

### ĐÚNG — đúng bốn định danh, ba hạng rồi một cúp cho mọi hạng dưới

```ts
// src/components/leaves/RankMark/index.tsx
const ARTWORK = {
  1: "fluent-emoji-flat:1st-place-medal",
  2: "fluent-emoji-flat:2nd-place-medal",
  3: "fluent-emoji-flat:3rd-place-medal",
}

const fallback = "fluent-emoji-flat:trophy"
```

### ĐÚNG — bài kiểm thử sinh đôi được gọi tên cả cái ngoài tập

```ts
// src/components/leaves/RankMark/index.test.ts
it("từ chối tranh ngoài tập", () => {
  expect(isRankArtwork("fluent-emoji-flat:4th-place-medal")).toBe(false)
})
```

Muốn chứng minh một tập là đóng thì phải gọi tên cả cái ở trong lẫn cái ở ngoài, nên tệp kiểm thử
được miễn.

### Chỗ lách và chỗ dễ nhầm

```ts
// src/components/leaves/RankMark/index.tsx
// LỌT: template literal không phải Literal, nên CẢ HAI nhánh biến mất cùng lúc —
// tập đóng không được kiểm, và quyền sở hữu cũng không.
// Ghép chuỗi lại đúng là cách tự nhiên nhất để viết một bản đồ hạng-sang-tranh.
const artwork = (place: number) => `fluent-emoji-flat:${place}th-place-medal`
```

```tsx
// src/components/blocks/LeaderboardRow/index.tsx
// LỌT: cùng lý do, nhưng ở NGOÀI chiếc lá — nghĩa là bản đồ vừa bị trả lời lần thứ hai.
<Iconify icon={`fluent-emoji-flat:${place}st-place-medal`} />
```

```ts
// src/components/leaves/RankMark/index.tsx
// LỌT: chỉ MỘT tiền tố bộ sưu tập được nhận ra. Một tấm huy chương lấy từ
// bộ sưu tập khác trong cùng catalog đi qua sạch sẽ, trong lẫn ngoài chiếc lá.
const ARTWORK = { 1: "twemoji:1st-place-medal" }
```

```ts
// src/components/blocks/LeaderboardRow/index.tsx
// NHẦM LẪN: chuỗi ghép bằng dấu cộng lại BỊ báo, vì mẩu đầu tự nó đã mang
// tiền tố và không thuộc bốn định danh. Cùng ý đồ, khác cách viết, khác kết quả.
const artwork = "fluent-emoji-flat:" + place + "st-place-medal"
```

---

## Ánh xạ yêu cầu sang một luật lint

Nêu tệp, nút cú pháp và giá trị. Nếu thiếu một trong ba, luật không có gì để đứng canh.

| Yêu cầu bằng lời | Nút và giá trị | Luật nổ | Cách viết đúng |
|---|---|---|---|
| Thêm một mũi tên nhỏ vào một hàng danh sách | `ImportDeclaration` từ một gói hình, tệp thường | `no-vendor-icon-outside-icon-leaf` + `heroicons-is-the-glyph-vendor` | Truyền một ý nghĩa và một vai trò cho chiếc lá |
| Thêm một hình mới vào bản đồ ý nghĩa | `ImportDeclaration` từ một họ đã duyệt, trong chiếc lá | không luật nào | Thêm một hàng vào bản đồ ý nghĩa |
| Đổi sang bộ hình khác cho đẹp hơn | `ImportDeclaration` gói khác, trong chiếc lá | `heroicons-is-the-glyph-vendor` | Đây là thay đổi luật, không phải thay đổi tệp |
| Cho hình này to hơn một chút | `JSXAttribute` `className` chứa `size-[…]` | `no-off-scale-glyph-size` | Chọn bậc mà vai trò đưa ra, hoặc đề nghị sửa thang |
| Thêm biểu tượng cho từng chỉ số trong lưới | `JSXOpeningElement` tên `Icon`, trong tệp ô số liệu | `no-decorative-icon-in-metric-cell` | Giữ nhãn và con số ở dạng chữ |
| Vẽ huy chương cho hạng nhất ngay tại hàng bảng xếp hạng | `Literal` mang tiền tố tranh giải, ngoài chiếc lá | `rank-artwork-is-a-closed-set` (`outside`) | Truyền thứ hạng cho chiếc lá xếp hạng |
| Thêm huy chương cho hạng tư | `Literal` lạ, trong chiếc lá | `rank-artwork-is-a-closed-set` (`unknown`) | Quyết trong văn bản luật trước |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| `no-vendor-icon-outside-icon-leaf` / `heroicons-is-the-glyph-vendor` | Tệp này có phải chiếc lá biểu tượng không? Nếu phải, chỉ luật nhà cung cấp còn hiệu lực; nếu không, cả hai cùng nổ trên một dòng. |
| `heroicons-is-the-glyph-vendor` / không luật nào | Chuỗi nguồn có đúng nguyên văn một trong hai họ đã duyệt không? "Cùng nhà cung cấp" không đủ. |
| `no-off-scale-glyph-size` / không luật nào | Giá trị viết bằng phân số hay ngoặc vuông? Nếu là số nguyên, luật im — kể cả khi số đó lệch thang. |
| `no-decorative-icon-in-metric-cell` / không luật nào | Đường dẫn có kết thúc đúng bằng tệp ô số liệu không? Câu này quyết định trước cả tên thẻ. |
| `rank-artwork-is-a-closed-set` nhánh `outside` / nhánh `unknown` | Tệp có phải chiếc lá xếp hạng không? Cùng một chuỗi cho hai thông điệp khác nhau tuỳ chỗ đứng. |
| Một chuỗi tranh giải trong tệp kiểm thử / trong tệp thường | Tên tệp có khớp `.test.tsx` không? Đây là miễn trừ duy nhất theo tên tệp trên kệ. |

## Sai lầm lặp lại nhiều nhất

1. Đọc mục **Cửa lách** như danh sách cách viết được phép. Nó là danh sách chỗ mù.
2. Tin rằng `size-9` hợp lệ vì lint im. Lint chỉ nhìn phân số và ngoặc vuông.
3. Gom chuỗi lớp vào một **object** rồi tưởng vẫn được soi như gom vào một hằng chuỗi.
4. Đổi tên tệp ô số liệu rồi coi như luật vẫn còn đó.
5. Ghép định danh tranh giải bằng template và tưởng tập vẫn đóng.
6. Xuất lại một gói hình bằng một dòng `export … from` rồi gọi đó là "đã bọc lại".
7. Đặt tệp ngoài `/src/` và tưởng bốn trong năm luật vẫn đang chạy.
8. Thấy hai thông điệp trên một dòng `import` và tưởng cấu hình bị lặp.
9. Đọc mã `ICON-11` trong thông điệp tranh giải rồi đi tìm nó trong văn bản luật — ở đó nó nói về
   chuyện khác hẳn.
