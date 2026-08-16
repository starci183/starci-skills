---
id: fe-patterns-icon-example
title: example.md
slug: /gates/patterns/icon/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã ICON-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `icon` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. `Icon` ở đây là icon leaf — file duy nhất được phép gọi tên thư
viện glyph — và người gọi chỉ truyền vào **ý nghĩa** cùng **vai trò**. Không tên sản phẩm, không tên
repository, không component library.

Mỗi mã có **nhiều case**, từng case đặt **ĐÚNG** cạnh **SAI**, sau đó là mục ngoại lệ và những thứ trông
giống nhưng không phải mã đó. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định duy nhất.

---

## `ICON-1` — ba vai trò, không có bậc thứ tư

### Case: người gọi mô tả công việc, không mô tả kích thước

```tsx
{/* ĐÚNG */}
<Icon props={{ name: "search", role: "leading" }} />

{/* SAI */}
<Icon props={{ name: "search", size: 18 }} />
```

Vế SAI thậm chí không compile được, và đó là điểm mạnh nhất của mã này: prop shape của leaf chỉ có
`props`, `on`, `isLoading` — **không có kênh nào để viết một kích thước**. Sai lầm bị chặn ở chỗ nó
được gõ ra, chứ không phải ở review.

### Case: bậc thứ ba đi vòng qua className

```tsx
{/* SAI */}
<span className="size-4.5">
    <Icon props={{ name: "streak", role: "chip" }} />
</span>

{/* SAI */}
<CaretGlyph className="size-[18px]" />

{/* ĐÚNG */}
<Icon props={{ name: "streak", role: "chip" }} />
```

Hai vế SAI là cùng một hành vi: dựng ra một bậc mà không ai áp dụng nhất quán được. Người viết chọn
`18px` vì nó đúng trên màn hình của họ hôm đó; người sau copy **cái gần nhất trong ba bậc**, và sau
vài tháng sản phẩm có ba kích thước icon mà không ai quyết định cả.

### Case: cùng một ý nghĩa, ba chỗ, ba vai trò

```tsx
<h2 className="flex items-center gap-2 text-lg font-medium">
    <Icon props={{ name: "course", role: "heading" }} />
    Khoá học của tôi
</h2>

<a className="flex items-center gap-2 px-3 py-2 text-sm" href="#courses">
    <Icon props={{ name: "course", role: "leading" }} />
    Khoá học
</a>

<span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
    <Icon props={{ name: "course", role: "chip" }} />
    12
</span>
```

Một ý nghĩa duy nhất, ba công việc khác nhau, ba bản vẽ khác nhau. Người gọi không cần biết bản nào —
đó chính là thứ mã này mua được.

### Ngoại lệ và nhầm lẫn

- **`isLoading` không phải một vai trò.** Trạng thái tải bảo toàn chỗ và bảo toàn bậc; đổi role
  khi đang tải làm layout nhảy đúng lúc người đọc đang chờ.
- **Density hay viewport không đổi vai trò.** Màn hẹp không biến `heading` thành `leading`.

---

## `ICON-2` — glyph mở đầu một vùng

### Case: empty state

```tsx
{/* ĐÚNG */}
<div className="flex flex-col items-center gap-3 py-12 text-center">
    <Icon props={{ name: "saved", role: "heading" }} />
    <p className="text-sm text-neutral-500">Chưa có mục nào được lưu</p>
</div>
```

### Case: ép bản micro vào hộp 24px

```tsx
{/* SAI */}
<BookmarkMicroGlyph className="size-6" />

{/* ĐÚNG */}
<Icon props={{ name: "saved", role: "heading" }} />
```

Hộp thì đúng 24px, nét thì không. Bản micro được vẽ với ít chi tiết hơn **có chủ ý**, để đọc được ở
16px; phóng nó lên chỉ làm lộ ra rằng nó thiếu chi tiết, và cạnh một heading thật nó trông như một
badge lạc chỗ.

### Case: heading của một section có thật

```tsx
<section aria-labelledby="progress" className="flex flex-col gap-3">
    <h2 className="flex items-center gap-2 font-medium" id="progress">
        <Icon props={{ name: "league", role: "heading" }} />
        Bảng xếp hạng tuần
    </h2>
    <ol className="divide-y rounded-lg border">…</ol>
</section>
```

### Ngoại lệ và nhầm lẫn

- **Một row có chữ to không phải heading.** Heading là **vị trí trong nội dung**, không phải cỡ chữ
  bên cạnh.
- **Tile lớn không nâng glyph lên heading** — xem `ICON-11`.

---

## `ICON-3` — glyph dẫn một control hoặc một row

### Case: tab điều hướng

```tsx
{/* ĐÚNG */}
<nav className="flex flex-col gap-1">
    <a className="flex items-center gap-2 rounded-md px-3 py-2 text-sm" href="#home">
        <Icon props={{ name: "home", role: "leading" }} />
        Tổng quan
    </a>
    <a className="flex items-center gap-2 rounded-md px-3 py-2 text-sm" href="#explore">
        <Icon props={{ name: "explore", role: "leading" }} />
        Khám phá
    </a>
</nav>
```

### Case: nút chỉ có icon

```tsx
{/* ĐÚNG */}
<button aria-label="Làm mới" className="rounded-md border p-2" type="button">
    <Icon props={{ name: "retry", role: "leading" }} />
</button>

{/* SAI */}
<button aria-label="Làm mới" className="rounded-md border p-2" type="button">
    <Icon props={{ name: "retry", role: "heading" }} />
</button>
```

Nút không mở đầu vùng nào cả. Nó là một control bình thường, và `heading` ở đây làm nó nặng hơn nút
thật sự quan trọng của màn.

### Case: icon trong field

```tsx
<label className="flex items-center gap-2 rounded-md border px-3 py-2">
    <Icon props={{ name: "email", role: "leading" }} />
    <input className="min-w-0 flex-1 outline-none" placeholder="Email" type="email" />
</label>
```

### Ngoại lệ và nhầm lẫn

- **Có `role: "leading"` đúng không có nghĩa là được đặt ở đó** — `ICON-12` quyết định vị trí.
- **Row trong một danh sách đồng nhất** (mười dòng cùng loại) thì glyph giống hệt nhau ở mọi dòng
  không phân biệt được gì; đó lại là `ICON-12`.

---

## `ICON-4` — glyph trong một chip

### Case: chip đóng

```tsx
{/* ĐÚNG */}
<span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
    Đang lọc
    <button aria-label="Bỏ lọc" type="button">
        <Icon props={{ name: "close", role: "chip" }} />
    </button>
</span>
```

### Case: ép bản 24 outline xuống 16px

```tsx
{/* SAI */}
<XMarkOutlineGlyph className="size-4" />

{/* ĐÚNG */}
<Icon props={{ name: "close", role: "chip" }} />
```

Cái hộp CSS cuối cùng bằng nhau, và đó chính là lý do lỗi này sống lâu: nhìn bằng thước thì "đúng
rồi". Nhưng nét outline vẽ cho 24px, khi thu về 16px, mảnh tới mức thành một vệt xám — chip mất khả
năng đọc đúng ở chỗ nó cần nhất.

### Case: `mini` không phải chip

```tsx
{/* SAI — mini là family 20px */}
import { XMarkIcon } from "@heroicons/react/20/solid"

{/* ĐÚNG — micro là family 16 solid, do icon leaf chọn */}
<Icon props={{ name: "close", role: "chip" }} />
```

Kích thước gần đúng không phải family đúng. `mini` tồn tại cho một công việc khác; dùng nó ở chip là
lấy một bản vẽ có mật độ chi tiết sai rồi hy vọng không ai để ý.

### Ngoại lệ và nhầm lẫn

- **Chip đã có vỏ riêng**, nên glyph bên trong không cần "nhẹ" bằng nét mảnh. Đó là việc của bản
  micro.
- **`size-4` trên một `<svg>` tự viết** không bị mã nào bắt và cũng không đúng — xem
  [`audit.md`](./audit.md).

---

## `ICON-5` — glyph thừa hưởng màu

### Case: state của vùng nói màu

```tsx
{/* ĐÚNG */}
<button className="flex items-center gap-2 text-neutral-400" disabled type="button">
    <Icon props={{ name: "send", role: "leading" }} />
    Gửi
</button>

{/* SAI */}
<button className="flex items-center gap-2 text-neutral-400" disabled type="button">
    <span className="text-blue-600"><Icon props={{ name: "send", role: "leading" }} /></span>
    Gửi
</button>
```

Vế SAI tạo ra một nút **nửa disabled**: chữ đã xám, glyph vẫn tươi. Người đọc tin vào cái sáng hơn,
nên nút trông như còn bấm được.

### Case: brand mark nhiều màu — ngoại lệ đóng

```tsx
{/* ĐÚNG — bốn màu gốc là danh tính của mark, không phải một lựa chọn thẩm mỹ */}
<Icon props={{ name: "google", role: "chip" }} />

{/* SAI — mark bị nhuộm theo state của vùng */}
<span className="text-neutral-900"><GenericSearchGlyph className="size-4" /></span>
```

### Case: brand mark đơn sắc vẫn `currentColor`

```tsx
{/* ĐÚNG — mark đơn sắc không có màu để mất, nên nó theo state như mọi glyph khác */}
<button className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm" type="button">
    <Icon props={{ name: "github", role: "chip" }} />
    Tiếp tục
</button>
```

Hai case trên nằm cạnh nhau trong cùng một file brand, và đó là cách đọc ngoại lệ này cho đúng: ngoại
lệ áp cho **mark nào mất danh tính khi đổi màu**, không áp cho "mọi thứ trong thư mục brand".

### Ngoại lệ và nhầm lẫn

- **Theme tối.** Không có nhánh riêng cho theme: `currentColor` đã đi theo `text-*` của node trên.
- **Trạng thái selected** cũng vậy — glyph không cần biết mình đang được chọn.

---

## `ICON-6` — người gọi nói ý nghĩa, không nói vendor

### Case: một màn cần một mũi tên

```tsx
{/* SAI — file màn hình import thẳng từ thư viện glyph */}
import { ArrowRightIcon } from "@heroicons/react/24/outline"

const Row = () => <ArrowRightIcon className="size-5" />

{/* ĐÚNG */}
import { Icon } from "@/components/leaves/Icon"

const Row = () => <Icon props={{ name: "next", role: "leading" }} />
```

Vế SAI trả lời **ba** câu hỏi ngay tại call site — thư viện nào, hình nào, to bao nhiêu — và màn tiếp
theo sẽ trả lời cả ba khác đi. Vế ĐÚNG chỉ trả lời một, và câu trả lời còn lại được giữ ở đúng một chỗ.

### Case: subpath cũng là import

```tsx
{/* SAI — kiểm tra bằng phép so tên package sẽ không thấy dòng này */}
import { CaretRight } from "@phosphor-icons/react/dist/ssr"
```

Chính vì vậy rule so **tiền tố**, không so bằng. Đây không phải giả định: đó là đường mà lỗi đầu tiên
đã đi qua.

### Case: file "phụ trợ" cạnh icon leaf

```tsx
{/* SAI — file brand mở một đường thứ hai vào thư viện glyph */}
import { StarIcon } from "@heroicons/react/24/outline"
export const PartnerMark = () => <StarIcon className="size-5" />

{/* ĐÚNG — file brand sở hữu đường vẽ cục bộ, không phải một lối vào thư viện */}
export const PartnerMark = (input: SVGProps<SVGSVGElement>) => (
    <svg {...input} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="…" />
    </svg>
)
```

### Ngoại lệ và nhầm lẫn

- **Không có ý nghĩa nào khớp** thì đáp án là `ICON-9` — thêm một dòng vào bảng nguồn — chứ không phải
  một import.
- **Code mẫu trên mạng** hầu như luôn viết theo kiểu vế SAI, vì ví dụ ngắn không có bảng ý nghĩa nào
  để tôn trọng.

---

## `ICON-7` — một vendor, hai family

### Case: thêm một thư viện glyph thứ hai

```tsx
{/* SAI — kể cả khi dòng này nằm trong chính icon leaf */}
import { Rocket } from "lucide-react"

{/* ĐÚNG — ánh xạ ý nghĩa vào hai family đang có, hoặc quyết định lại về ý nghĩa */}
<Icon props={{ name: "talents", role: "leading" }} />
```

`ICON-6` cố ý không nhìn vào icon leaf, vì đó là file được phép nhập. `ICON-7` là mã nhìn vào đúng
chỗ đó — nếu thiếu nó, quyền sở hữu bản đồ sẽ tự biến thành giấy phép mở một ngôn ngữ hình thứ hai.

### Case: brand mark lấy từ package tổng hợp

```tsx
{/* SAI — hình gần giống, không phải mark */}
import { SiSomeProvider } from "react-icons/si"

{/* ĐÚNG — mark được vẽ đúng, trong thư mục icon */}
<Icon props={{ name: "google", role: "chip" }} />
```

### Ngoại lệ và nhầm lẫn

- **Ngoại lệ artwork giải thưởng** là một tập đóng: một file, một package, bốn identity. Cái thứ năm
  vẫn bị báo. Ngoại lệ đó **là một bộ từ vựng**, không phải một cánh cửa.
- **"Bên kia không có hình này"** là một phát hiện về **ý nghĩa**, không phải lý do đổi package.

---

## `ICON-8` — glyph không bao giờ co lại

### Case: row hẹp, tên dài

```tsx
{/* ĐÚNG — glyph bảo toàn, chữ nhường bằng truncate */}
<div className="flex min-w-0 items-center gap-2">
    <Icon props={{ name: "cv", role: "leading" }} />
    <span className="truncate">ho-so-ung-vien-phien-ban-cuoi-cung.pdf</span>
</div>

{/* SAI — glyph là thứ co lại đầu tiên */}
<div className="flex items-center gap-2">
    <span className="shrink"><Icon props={{ name: "cv", role: "leading" }} /></span>
    <span>ho-so-ung-vien-phien-ban-cuoi-cung.pdf</span>
</div>
```

Vế SAI hỏng đúng vào lúc tệ nhất: row đang chật là row khó đọc nhất, và nó chọn làm méo cái duy nhất
còn nhận ra được bằng một cái liếc.

### Case: `<svg>` tự viết trong một hàng cuộn ngang

```tsx
{/* SAI — không có shrink-0, và cũng không mã nào bắt được */}
<div className="flex gap-2 overflow-x-auto">
    <svg className="size-4" viewBox="0 0 16 16" />
    <span className="whitespace-nowrap">Bộ lọc rất dài</span>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Chữ dịch dài ra** là việc của luật text-expansion: wrap hoặc truncate. Không bao giờ là việc của
  glyph.
- **`shrink-0` đã nằm sẵn trong cả ba vai trò**, nên chỉ những glyph **đi vòng qua leaf** mới mất nó.

---

## `ICON-9` — bảng nguồn sở hữu việc chọn hình

### Case: thêm một ý nghĩa

```tsx
{/* ĐÚNG — union, map và bảng đổi trong cùng một thay đổi logic */}
export type IconName = /* … */ | "practice"

const GLYPHS = {
    /* … */
    practice: { heading: CodeBracketOutline, leading: CodeBracketOutline, chip: CodeBracketSolid },
}
```

### Case: hai ý nghĩa dùng chung một hình

```tsx
{/* SAI — hai đích đến khác nhau, một hình */}
const GLYPHS = {
    course: { /* BookOpen */ },
    blog: { /* BookOpen */ },
}
```

Người đọc không phân biệt được hai đích, và người viết sau sẽ **copy chính sự mập mờ đó** khi thêm
đích thứ ba. Một hình trùng không phải chuyện thẩm mỹ; nó là một mất mát về khả năng điều hướng.

### Ngoại lệ và nhầm lẫn

- **Bảng có dòng ≠ được vẽ ở mọi chỗ.** `ICON-10` và `ICON-12` vẫn quyết định vị trí.
- **Luật gốc nói có test parity giữa bảng và map**; trong source hiện tại không tìm thấy test đó —
  xem [`audit.md`](./audit.md).

---

## `ICON-10` — dữ kiện nghiệp vụ gọn thì để nguyên chữ

### Case: ô số liệu lặp lại

```tsx
{/* ĐÚNG */}
<div className="flex flex-col gap-1">
    <span className="text-sm">Nội dung đã học</span>
    <span className="text-2xl font-semibold tabular-nums">68%</span>
</div>

{/* SAI */}
<div className="flex flex-col gap-1">
    <span className="flex items-center gap-1 text-sm">
        <Icon props={{ name: "course", role: "chip" }} />
        Nội dung đã học
    </span>
    <span className="text-2xl font-semibold tabular-nums">68%</span>
</div>
```

Quyển sách cạnh chữ "Nội dung" lặp lại đúng thứ chữ đã đóng. Trong một lưới sáu ô, sáu glyph khác nhau
dựng lên **một trục thị giác thứ hai** cạnh trục chữ — và người đọc phải quét cả hai.

### Case: caption streak

```tsx
{/* SAI */}
<span className="flex items-center gap-1 text-xs text-neutral-500">
    <Icon props={{ name: "streak", role: "chip" }} />
    7 ngày liên tiếp
</span>

{/* ĐÚNG */}
<span className="text-xs text-neutral-500">7 ngày liên tiếp</span>
```

### Case: ngữ nghĩa generic thì được giữ

```tsx
{/* ĐÚNG — complete/pending là state mà reference thật sự mang */}
<li className="flex items-center gap-2 p-3">
    <Icon props={{ name: "complete", role: "chip" }} />
    <span className="text-sm">Đã nộp bài</span>
</li>
```

### Ngoại lệ và nhầm lẫn

- **Điều hướng, entry point có tên, heading của vùng rỗng lớn** vẫn giữ glyph: ở đó glyph là một phần
  của việc **định vị**.
- **"Cho đỡ trống"** không phải một lý do. Nếu vùng trống là vấn đề, đó là việc của khoảng cách và bố
  cục.

---

## `ICON-11` — plate đổi, glyph không đổi

### Case: hai bậc plate, một bậc glyph

```tsx
{/* ĐÚNG */}
<IconTile props={{ icon: "course", size: "sm" }} />
<IconTile props={{ icon: "course", size: "md" }} />
```

Cả hai vẽ glyph ở `leading` `size-5`. Bậc plate đổi **khoảng thở và mức nhấn của bề mặt**; nó không
thăng chức cho glyph.

### Case: người gọi suy ra role từ kích thước tile

```tsx
{/* SAI */}
<span className="grid size-10 place-items-center rounded-xl bg-neutral-100">
    <Icon props={{ name: "course", role: "heading" }} />
</span>

{/* ĐÚNG */}
<IconTile props={{ icon: "course", size: "md" }} />
```

Vế SAI làm cùng một ý nghĩa xuất hiện ở hai trọng lượng khác nhau tại hai màn, chỉ vì hai plate khác
nhau — và không ai từng quyết định điều đó.

### Case: plate có artwork thật thì glyph đứng xuống

```tsx
{/* ĐÚNG — có ảnh thì ảnh nói "cái nào"; không có thì glyph nói "loại gì" */}
<IconTile props={{ icon: "course", image: coverUrl, size: "md" }} />
```

Đây vẫn là `ICON-11`: leaf sở hữu quyết định, người gọi không phải chọn giữa ảnh và glyph.

### Ngoại lệ và nhầm lẫn

- **Tile lớn không phải heading.** Heading là vị trí trong nội dung, không phải đường kính của đĩa.
- **Một leaf plate thứ hai** sẽ không bị gì chặn nếu nó chọn khác — xem [`audit.md`](./audit.md).

---

## `ICON-12` — leading phải phân biệt được peer

### Case: tập peer khác loại — glyph có việc để làm

```tsx
{/* ĐÚNG */}
<ul className="divide-y rounded-lg border">
    <li className="flex items-center gap-2 p-3">
        <Icon props={{ name: "practice", role: "leading" }} />
        <span className="text-sm">Luyện tập</span>
    </li>
    <li className="flex items-center gap-2 p-3">
        <Icon props={{ name: "review", role: "leading" }} />
        <span className="text-sm">Bài cần chấm</span>
    </li>
    <li className="flex items-center gap-2 p-3">
        <Icon props={{ name: "saved", role: "leading" }} />
        <span className="text-sm">Đã lưu</span>
    </li>
</ul>
```

Che hết chữ đi, ba glyph vẫn chọn được ba đích. Đó là phép thử của mã này.

### Case: row tóm tắt đứng một mình

```tsx
{/* SAI */}
<section className="flex flex-col gap-3">
    <h2 className="font-medium">Kỹ năng</h2>
    <div className="flex items-center gap-2">
        <Icon props={{ name: "practice", role: "leading" }} />
        <span>Tổng số bài đã luyện</span>
        <span className="ml-auto text-xs text-neutral-500">128</span>
    </div>
</section>

{/* ĐÚNG */}
<section className="flex flex-col gap-3">
    <h2 className="font-medium">Kỹ năng</h2>
    <div className="flex items-center gap-2">
        <span>Tổng số bài đã luyện</span>
        <span className="ml-auto text-xs text-neutral-500">128</span>
    </div>
</section>
```

Không có peer nào để phân biệt, và heading `Kỹ năng` đã nói đúng khái niệm mà glyph đang lặp lại.
Chú ý vế ĐÚNG **vẫn giữ** fact phụ ở `text-xs muted` — mã này không xoá dữ kiện, nó chỉ bỏ trang trí.

### Case: tập đồng nhất — glyph giống nhau không phân biệt gì

```tsx
{/* SAI — mười dòng cùng một glyph */}
<ul className="divide-y">
    {lessons.map((lesson) => (
        <li className="flex items-center gap-2 p-3" key={lesson.id}>
            <Icon props={{ name: "course", role: "leading" }} />
            <span className="text-sm">{lesson.title}</span>
        </li>
    ))}
</ul>
```

Mọi dòng đều là bài học, nên glyph không mang thông tin nào. Nếu cần một mark ở đây, thứ phân biệt
được là **trạng thái** của từng bài — complete, pending — chứ không phải loại của chúng.

### Ngoại lệ và nhầm lẫn

- **Điều hướng luôn là peer**, kể cả khi tạm thời chỉ còn hai mục.
- **Một section có nhiều row tóm tắt** thì chúng đã thành peer; lúc đó câu hỏi quay về `ICON-10`: các
  row đó có phải ô dữ kiện lặp lại không?

---

## `ICON-13` — reaction là artwork, không phải glyph

### Case: truyền identity

```tsx
{/* ĐÚNG */}
<ReactionMark props={{ reaction: "love", label: "Yêu thích" }} />

{/* SAI — emoji Unicode: mỗi nền tảng vẽ một kiểu */}
<span role="img" aria-label="Yêu thích">❤️</span>
```

### Case: call site truyền tài nguyên

```tsx
{/* SAI */}
<ReactionMark props={{ src: "/reactions/love.svg", label: "Yêu thích" }} />

{/* SAI */}
<img src={reaction.assetUrl} alt="Yêu thích" className="size-5" />

{/* ĐÚNG */}
<ReactionMark props={{ reaction: "love", label: "Yêu thích" }} />
```

Vế SAI làm bộ từ vựng đóng của sản phẩm rò ra **mọi dòng feed**. Sau đó bất kỳ ai cũng có thể truyền
một ảnh khác, và tập sáu cảm xúc không còn là một tập nữa.

### Case: đừng biến artwork thành catalogue

```tsx
{/* SAI — mở một vendor hình thứ hai qua cửa sau */}
import { Icon as ArtworkCatalogue } from "@some/artwork-catalogue"

<ArtworkCatalogue icon="flat:party-popper" className="size-5" />
```

### Ngoại lệ và nhầm lẫn

- **Artwork nhiều màu** nên `ICON-5` không áp: `currentColor` sẽ xoá chính thứ làm nên nó.
- **Attribution đi cùng tài nguyên.** Đây là điều kiện của việc dùng bộ artwork đó, không phải một
  ghi chú tuỳ chọn.
- **Điều hướng, state và action vẫn thuộc bộ từ vựng glyph duy nhất.** Biên artwork này hẹp đúng bằng
  sáu identity.

---

## Ánh xạ yêu cầu sang một quyết định

Nêu ý nghĩa, vị trí và tập xung quanh. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng. Câu trả lời phải là một quyết định hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm icon vào tiêu đề khối "Khoá học của tôi" | Glyph mở đầu một vùng | `ICON-2` | `role: "heading"` |
| Thêm icon vào từng mục điều hướng | Tập peer khác loại | `ICON-3` + `ICON-12` | `role: "leading"` |
| Thêm nút đóng vào chip bộ lọc | Glyph trong vỏ đã đóng | `ICON-4` | `role: "chip"` |
| "Cho icon này to hơn chút" | Đang mô tả kích thước, không phải công việc | `ICON-1` | Hỏi glyph đang làm việc gì; không thêm bậc |
| Màn mới cần một mũi tên chưa có trong bảng | Thiếu ý nghĩa, không thiếu package | `ICON-9` | Thêm một dòng vào bảng nguồn, rồi gọi bằng tên |
| Dùng bộ icon khác cho đẹp hơn | Ngôn ngữ hình thứ hai | `ICON-7` | Từ chối; ánh xạ vào hai family đang có |
| Thêm icon vào từng ô thống kê hồ sơ | Ô dữ kiện lặp lại, reference chỉ có chữ | `ICON-10` | Giữ text-only |
| Thêm icon vào dòng "Tổng số bài" dưới heading | Không có peer để phân biệt | `ICON-12` | Bỏ icon; fact phụ `text-xs muted` |
| Tile to lên thì icon cũng to lên chứ? | Plate là bề mặt, không phải vai trò | `ICON-11` | Giữ `leading`; chỉ đổi bậc plate |
| Hiện reaction bằng emoji cho nhanh | Font nền tảng vẽ khác nhau | `ICON-13` | Truyền identity qua reaction leaf |
| Icon trong nút disabled nên xám hẳn | Màu thuộc về vùng | `ICON-5` | Không tô glyph; để `currentColor` |
| Row chật quá, thu nhỏ icon lại | Chữ phải nhường trước | `ICON-8` | Giữ `shrink-0`; truncate chữ |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `ICON-1` / `ICON-2,3,4` | Đang hỏi **có mấy vai trò**, hay **vai trò này vẽ bằng bản nào**? |
| `ICON-2` / `ICON-3` | Glyph mở đầu một **vùng**, hay dẫn **một dòng**? |
| `ICON-3` / `ICON-4` | Chỗ đứng đã có vỏ riêng (nền, bo góc, padding) chưa? |
| `ICON-3` / `ICON-12` | Câu hỏi là **vẽ bằng gì**, hay **có được vẽ không**? |
| `ICON-5` / ngoại lệ brand | Đổi màu mark này thì nó còn là mark đó không? |
| `ICON-6` / `ICON-7` | Vấn đề là **file nào import**, hay **import cái gì**? |
| `ICON-9` / `ICON-6` | Thiếu một **ý nghĩa**, hay thiếu một **hình**? |
| `ICON-10` / `ICON-12` | Đây là **ô dữ kiện lặp lại trong lưới**, hay **một row đứng một mình**? |
| `ICON-11` / `ICON-2` | Cái đổi là **bề mặt**, hay **vị trí trong nội dung**? |
| `ICON-13` / `ICON-7` | Đây là **artwork biểu cảm đã đóng**, hay một **catalogue hình** mới? |

## Sai lầm lặp lại nhiều nhất

1. Import thẳng từ thư viện glyph "chỉ một lần này thôi".
2. Chọn size bằng mắt rồi tạo ra bậc thứ ba (`size-4.5`, `size-[18px]`).
3. Ép bản 24 outline vào chip, hoặc phóng bản micro lên heading — vì hộp CSS trông đúng.
4. Dùng `mini` 20px làm chip.
5. Tô màu riêng cho glyph trong một vùng đã có state.
6. Thêm glyph trang trí vào ô số liệu "cho đỡ trống".
7. Đặt leading icon lên một row tóm tắt đứng một mình.
8. Suy vai trò glyph từ kích thước plate.
9. Render reaction bằng emoji Unicode hoặc truyền đường dẫn ảnh từ call site.
10. Đổi `GLYPHS` mà quên bảng nguồn — code và tài liệu bắt đầu nói hai chuyện khác nhau ngay hôm đó.
