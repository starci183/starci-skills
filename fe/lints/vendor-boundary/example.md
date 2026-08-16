---
id: fe-lints-vendor-boundary-example
title: example.md
slug: /fe/lints/vendor-boundary/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng rule — chỗ nó nổ, chỗ nó im, và chỗ nó không nhìn thấy gì.
---

# example.md

> Version: `2.00` · Mô-đun: `vendor-boundary` · Cơ chế: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là **tên rule đã công bố**, nguyên văn. Mỗi mục có vài cặp **SAI** (rule nổ) và
**ĐÚNG** (rule im), rồi một mục **Cửa lách và nhầm lẫn** chứa mã **đi lọt**.

> Mã trong mục "Cửa lách" là mã mà rule **không nhìn thấy**, không phải mã được phép viết. Luật vẫn
> cấm nó; chỉ là không có máy nào bắt. Đó là lý do kệ tài liệu này tồn tại: một luật không có rule
> thì ai cũng biết là không được giữ, còn một rule thủng thì mọi người tin là đã đóng.

**Quy ước.** `@vendor/react` và `<tiền-tố-vendor>` thay cho định danh gói thư viện ngoài mà nguồn
ghim. Đường dẫn file ghi ở dòng đầu mỗi khối, vì với kệ này **tên file là một phần của cơ chế**.

---

## `vendor-boundary`

### SAI — import thư viện ngoài từ một nhánh thường

```tsx
// src/components/branches/GenericPanel/index.tsx
import { Modal } from "@vendor/react"   // outside

export const GenericPanel = () => <Modal>…</Modal>
```

### SAI — file lạ nằm trong thư mục vỏ

```tsx
// src/components/shells/TooltipShell/index.tsx
import { Tooltip } from "@vendor/react"   // outside + unknownShell

export const TooltipShell = () => <Tooltip>…</Tooltip>
```

Hai báo cáo cùng lúc: `outside` vì `TooltipShell` không nằm trong danh sách bốn tên, và
`unknownShell` vì nó vẫn ngồi trong thư mục vỏ. Thêm tên nó vào thư mục **không** làm nó hợp lệ.

### SAI — vỏ không bọc gì

```tsx
// src/components/shells/DrawerShell/index.tsx
import { ContractContent } from "@/components/contracts"   // emptyShell

export const DrawerShell = ({ contract }) => <ContractContent contract={contract} />
```

### ĐÚNG — lá sở hữu nguyên thể đóng

```tsx
// src/components/leaves/Button/index.tsx
import { Button as VendorButton } from "@vendor/react"

export const Button = ({ label, on }) => <VendorButton onPress={on?.press}>{label}</VendorButton>
```

### ĐÚNG — nhánh bề mặt đã đặt tên chiếu hợp đồng vào thân của thư viện

```tsx
// src/components/branches/SurfaceListCard/index.tsx
import { Card } from "@vendor/react"

export const SurfaceListCard = ({ contract, render }) => (
  <Card>
    <Card.Content>{contract.rows.map(render)}</Card.Content>
  </Card>
)
```

### ĐÚNG — vỏ của framework, không import thư viện nào

```tsx
// src/components/shells/RouteShell/index.tsx
export const RouteShell = ({ children }) => <div className="min-h-dvh">{children}</div>
```

Không có `emptyShell` ở đây, và đó là ngoại lệ **duy nhất** có tên: cơ chế của vỏ này là của
framework, nên bắt nó import một nguyên thể là bắt nó thêm rác.

### Cửa lách và nhầm lẫn

Re-export không phải `ImportDeclaration`. Cả hai file dưới đây **không có báo cáo nào**:

```ts
// src/components/branches/GenericPanel/vendor.ts
export { Modal, ModalContent } from "@vendor/react"   // rule không thấy
```

```tsx
// src/components/branches/GenericPanel/index.tsx
import { Modal } from "./vendor"   // đường dẫn nội bộ, hợp lệ với rule
```

Cùng lối đó, một vỏ **lấy hàng bằng re-export** vừa lọt chiều ra vừa bị báo sai ở chiều vào:

```ts
// src/components/shells/DropdownShell/index.tsx
export { Dropdown } from "@vendor/react"   // importsVendor vẫn là false ⇒ emptyShell nổ oan
```

Import động cũng không phải node đó:

```tsx
// src/components/branches/GenericPanel/index.tsx
const load = async () => (await import("@vendor/react")).Modal   // rule không thấy
```

Và quyền sở hữu chỉ là **nằm trong thư mục**. Dời nguyên file sai chỗ vào thư mục lá là im:

```tsx
// src/components/leaves/GenericPanel/index.tsx
import { Modal } from "@vendor/react"   // hợp lệ với rule, sai với luật
```

---

## `modal-shell-owns-scroll-body`

### SAI — thân cuộn tự thêm đệm

```tsx
// src/components/shells/ModalShell/index.tsx
import { Modal } from "@vendor/react"

export const ModalShell = ({ children }) => (
  <Modal>
    <Modal.Body className="p-6">{children}</Modal.Body>   {/* inset */}
  </Modal>
)
```

### SAI — không có thân cuộn nào

```tsx
// src/components/shells/ModalShell/index.tsx
import { Modal } from "@vendor/react"

export const ModalShell = ({ children }) => (
  <Modal>
    <div className="overflow-y-auto">{children}</div>   {/* missing */}
  </Modal>
)
```

### ĐÚNG

```tsx
// src/components/shells/ModalShell/index.tsx
import { Modal } from "@vendor/react"

export const ModalShell = ({ children }) => (
  <Modal>
    <Modal.Body className="p-0">{children}</Modal.Body>
  </Modal>
)
```

### Cửa lách và nhầm lẫn

Đổi tên object là phép kiểm đệm biến mất. File dưới đây **không có báo cáo nào**, vì thân thứ nhất
làm thoả phép kiểm hiện diện còn thân thứ hai không mang tên `Modal.Body`:

```tsx
// src/components/shells/ModalShell/index.tsx
import { Modal, Modal as Dialog } from "@vendor/react"

export const ModalShell = ({ children, footer }) => (
  <Modal>
    <Modal.Body className="p-0">{children}</Modal.Body>
    <Dialog.Body className="p-6">{footer}</Dialog.Body>   {/* rule không thấy */}
  </Modal>
)
```

Đệm đi bằng prop khác cũng không ai đọc:

```tsx
<Modal.Body className="p-0" classNames={{ base: "py-6" }}>{children}</Modal.Body>
```

Ngược lại là **nhầm lẫn thường gặp**: hai dòng dưới đây đều nổ `inset` dù đúng luật, vì giá trị không
phải một `Literal` trần:

```tsx
<Modal.Body className={"p-0"}>{children}</Modal.Body>        // nổ oan
<Modal.Body className={cn("p-0")}>{children}</Modal.Body>    // nổ oan
```

---

## `field-input-uses-secondary-variant`

### SAI — dùng biến thể mặc định

```tsx
// src/components/leaves/Field/index.tsx
import { Input } from "@vendor/react"

export const Field = ({ label, value }) => (
  <label>
    {label}
    <Input value={value} />   {/* variant */}
  </label>
)
```

### ĐÚNG — có khoá biến thể, kể cả khi đổi tên cục bộ

```tsx
// src/components/leaves/Field/index.tsx
import { Input as VendorInput } from "@vendor/react"

export const Field = ({ label, value }) => (
  <label>
    {label}
    <VendorInput variant="secondary" value={value} />
  </label>
)
```

### Cửa lách và nhầm lẫn

Nguồn phải **bằng đúng**. Import gói con thì tập ràng buộc rỗng và rule không còn việc gì:

```tsx
// src/components/leaves/Field/index.tsx
import { Input } from "@vendor/input"

export const Field = ({ value }) => <Input value={value} />   // rule không thấy
```

Import namespace cũng vậy — tên phần tử là biểu thức thành viên, không phải định danh thuần:

```tsx
import * as Vendor from "@vendor/react"

export const Field = ({ value }) => <Vendor.Input value={value} />   // rule không thấy
```

Và **nhầm lẫn**: cả hai dòng dưới nổ `variant` dù ý định đúng, vì giá trị không phải literal:

```tsx
<Input variant={"secondary"} />                          // nổ oan
<Input variant={dense ? "secondary" : "secondary"} />    // nổ oan
```

---

## `field-label-is-text-only`

### SAI — biểu tượng suy ra từ loại dữ liệu

```tsx
// src/components/leaves/Field/index.tsx
import { Icon } from "@/components/leaves/Icon"

export const Field = ({ label, kind }) => (
  <label className="flex items-center gap-2">
    <Icon name={kind === "email" ? "mail" : "lock"} />   {/* icon */}
    {label}
  </label>
)
```

### SAI — chôn sâu vẫn bị thấy

```tsx
<label>
  <span><strong><Icon name="mail" /></strong></span>   {/* icon — leo tổ tiên không giới hạn độ sâu */}
  {label}
</label>
```

### ĐÚNG — nhãn là chữ; biểu tượng thuộc về một điều khiển có hành động riêng

```tsx
// src/components/leaves/Field/index.tsx
import { Icon } from "@/components/leaves/Icon"

export const Field = ({ label, on }) => (
  <div className="flex flex-col gap-3">
    <label>{label}</label>
    <div className="relative">
      <Input variant="secondary" />
      <button type="button" onClick={on?.toggleVisibility}>
        <Icon name="eye" />
      </button>
    </div>
  </div>
)
```

### Cửa lách và nhầm lẫn

Chỉ **phần tử `label` chữ thường** mới là tổ tiên rule biết. Cả ba dạng dưới đây đi lọt:

```tsx
export const Field = ({ label, kind }) => (
  <Input variant="secondary" label={<><Icon name={kind} /> {label}</>} />   // rule không thấy
)
```

```tsx
import { Label } from "@/components/leaves/Label"

<Label><Icon name="mail" /> {label}</Label>   // rule không thấy — Label viết hoa
```

```tsx
import { Mail } from "@glyph-package/icons"

<label><Mail /> {label}</label>   // rule không thấy — không nằm trong tập ràng buộc
```

Trường hợp thứ ba là chỗ hở mà chú thích đầu nguồn đã cảnh báo: rule này ghim **một** đường dẫn
biểu tượng, còn gói glyph là ranh giới của mô-đun khác.

---

## `no-surface-branch-in-overlay`

### SAI — lớp phủ gắn thêm một bề mặt

```tsx
// src/components/overlays/settings/ProfileOverlay/component.tsx
import { SurfaceFormCard } from "@/components/branches/SurfaceFormCard"   // nested

export const ProfileOverlay = ({ contract }) => <SurfaceFormCard contract={contract} />
```

### ĐÚNG — lớp phủ đã là ranh giới, dùng tiêu đề và hàng trực tiếp

```tsx
// src/components/overlays/settings/ProfileOverlay/component.tsx
export const ProfileOverlay = ({ contract }) => (
  <div className="flex flex-col gap-6">
    <h2 className="text-lg font-semibold">{contract.title}</h2>
    <div className="flex flex-col gap-4">{contract.rows.map(renderRow)}</div>
  </div>
)
```

### Cửa lách và nhầm lẫn

Import tương đối **trượt hoàn toàn**, vì chuỗi không chứa đoạn `components/branches/`:

```tsx
// src/components/overlays/settings/ProfileOverlay/component.tsx
import { SurfaceFormCard } from "../../../branches/SurfaceFormCard"   // rule không thấy
```

Barrel và import sâu cũng trượt phép khớp neo-đuôi:

```tsx
import { SurfaceListCard } from "@/components/branches"                    // rule không thấy
import { SurfaceListCard } from "@/components/branches/SurfaceListCard/index"  // rule không thấy
```

Và rule cấm một **import**, không cấm một lần **vẽ**:

```tsx
// src/components/overlays/settings/parts/Section.tsx  ← không nằm trong overlays/? nằm, nhưng…
import { SurfaceCard } from "@/components/branches/SurfaceCard"   // nested ở ĐÂY
```

```tsx
// src/components/blocks/settings/SettingsSurface.tsx  ← ngoài overlays/
import { SurfaceCard } from "@/components/branches/SurfaceCard"
export const SettingsSurface = (props) => <SurfaceCard {...props} />
```

```tsx
// src/components/overlays/settings/ProfileOverlay/component.tsx
import { SettingsSurface } from "@/components/blocks/settings/SettingsSurface"   // rule không thấy
```

Ba khối trên là một chuỗi: đẩy import ra ngoài thư mục lớp phủ rồi gọi lại, cùng một bề mặt lồng
trong cùng một lớp phủ, không báo cáo nào.

---

## `text-link-uses-hero-link`

### SAI — tự dựng link bằng nút thô

```tsx
// src/components/leaves/TextLink/index.tsx
export const TextLink = ({ label, on }) => (
  <button type="button" onClick={on?.press}>{label}</button>   // handmade + missing
)
```

### SAI — class gạch chân viết thẳng

```tsx
// src/components/leaves/TextLink/index.tsx
import { Link } from "@vendor/react"

export const TextLink = ({ label, on }) => (
  <Link className="hover:underline" onPress={on?.press}>{label}</Link>   // handmade
)
```

### ĐÚNG

```tsx
// src/components/leaves/TextLink/index.tsx
import { Link } from "@vendor/react"

export const TextLink = ({ label, on }) => <Link onPress={on?.press}>{label}</Link>
```

### Cửa lách và nhầm lẫn

**Hằng số rửa sạch chuỗi** — đây là dạng kinh điển, và không ai làm nó để phá luật; người ta làm nó
khi dọn dẹp:

```tsx
// src/components/leaves/TextLink/index.tsx
import { Link } from "@vendor/react"

const CLASSES = { root: "hover:underline underline-offset-4" }

export const TextLink = ({ label, on }) => (
  <Link className={CLASSES.root} onPress={on?.press}>{label}</Link>   // rule không thấy
)
```

Template literal và lời gọi gộp class cũng không phải `Literal`:

```tsx
<Link className={`hover:underline`} />          // rule không thấy
<Link className={cn("hover:underline")} />      // rule không thấy
```

Có import là đủ — không cần vẽ:

```tsx
import { Link } from "@vendor/react"   // chỉ để thoả rule

export const TextLink = ({ label, on }) => <a onClick={on?.press}>{label}</a>   // rule không thấy
```

Và rule biết đúng **một thẻ** và **hai chuỗi con**; một gạch chân vẽ bằng viền dưới đi lọt:

```tsx
<a className="border-b border-current" onClick={on?.press}>{label}</a>   // rule không thấy
```

---

## `account-control-owns-dropdown`

### SAI — khối sản phẩm tự ôm cơ chế của thư viện

```tsx
// src/components/blocks/auth/AccountMenu/component.tsx
import { Dropdown } from "@vendor/react"   // vendor + shell

export const AccountMenu = () => <Dropdown>…</Dropdown>
```

### SAI — khối import các mảnh giải phẫu rồi tự lắp

```tsx
// src/components/blocks/auth/AccountMenu/component.tsx
import { DropdownShell, DropdownShellSection, DropdownShellItem } from "@/components/shells/DropdownShell"   // pieces

export const AccountMenu = () => (
  <DropdownShell>
    <DropdownShellSection>
      <DropdownShellItem>Đăng nhập</DropdownShellItem>
    </DropdownShellSection>
  </DropdownShell>
)
```

### SAI — nút biểu tượng tài khoản tự mang hành động

```tsx
// src/components/layouts/ShellNav/component.tsx
import { AccountMenu } from "@/components/blocks/auth/AccountMenu"

export const ShellNav = ({ on }) => (
  <IconButton props={{ icon: "account" }} on={{ press: on?.openSignIn }} />   // direct
)
```

### ĐÚNG — dữ liệu có kiểu đi vào, cơ chế ở lại trong vỏ

```tsx
// src/components/blocks/auth/AccountMenu/component.tsx
import { DropdownShell } from "@/components/shells/DropdownShell"

export const AccountMenu = ({ contract, on }) => (
  <DropdownShell
    sections={contract.sections}
    trigger={<IconButton props={{ icon: "account" }} />}
    on={{ action: on?.action }}
  />
)
```

```tsx
// src/components/shells/DropdownShell/index.tsx
import { Dropdown } from "@vendor/react"

export const DropdownShell = ({ sections, trigger, on }) => (
  <Dropdown>
    <Dropdown.Trigger>{trigger}</Dropdown.Trigger>
    <Dropdown.Menu onAction={on?.action}>{sections.map(renderSection)}</Dropdown.Menu>
  </Dropdown>
)
```

### Cửa lách và nhầm lẫn

Phép kiểm `direct` đòi đúng một hình dạng chữ. Cả hai dạng dưới đây làm đúng việc bị cấm mà đi lọt:

```tsx
// src/components/layouts/ShellNav/component.tsx
const ACCOUNT = { icon: "account" }

<IconButton props={ACCOUNT} on={{ press: on?.openSignIn }} />   // rule không thấy
```

```tsx
<IconButton props={{ icon: "account" }} onPress={on?.openSignIn} />   // rule không thấy
```

Mảnh giải phẫu mang tên khác thì với rule này không phải giải phẫu:

```ts
// src/components/shells/DropdownShell/index.tsx
export { Section, Item }   // rule không thấy — chỉ hai tiền tố được biết
```

Và **nhầm lẫn nặng**: import tương đối làm cờ `hasOwner` không bao giờ bật, nên mã đúng bị báo sai:

```tsx
// src/components/layouts/ShellNav/component.tsx
import { AccountMenu } from "../../blocks/auth/AccountMenu"   // menu nổ oan

export const ShellNav = () => <AccountMenu />
```

---

## `auth-overlay-owns-single-content-host`

### SAI — mở thêm một vật chứa quanh panel đã có vật chứa

```tsx
// src/components/overlays/auth/SignInOverlay/component.tsx
import { Tree } from "@/components/branches/Tree"   // duplicate

export const SignInOverlay = ({ contract }) => (
  <Tree>
    <AuthenticationPanel contract={contract} />
  </Tree>
)
```

### SAI — token cột giữa tự khai đệm dọc

```ts
// src/components/contracts/index.ts
export const contracts = {
  "centred-page-column": { className: "py-10 mx-auto w-full max-w-md" },   // inset
}
```

### ĐÚNG

```tsx
// src/components/overlays/auth/SignInOverlay/component.tsx
import { ContractContent } from "@/components/contracts"

export const SignInOverlay = ({ contract }) => <ContractContent contract={contract} />
```

```ts
// src/components/contracts/index.ts
export const contracts = {
  "centred-page-column": { className: "mx-auto w-full max-w-md" },
}
```

### Cửa lách và nhầm lẫn

Biểu thức đệm **neo vào dấu nháy**: nó chỉ khớp khi class đệm dọc là token **đầu tiên**. Đổi thứ tự
là đi lọt, và kết quả render y hệt khối SAI ở trên:

```ts
"centred-page-column": { className: "mx-auto w-full max-w-md py-10" },   // rule không thấy
```

Đệm bốn phía cũng dựng lại dải thứ hai mà không khớp gì:

```ts
"centred-page-column": { className: "p-10 mx-auto w-full max-w-md" },   // rule không thấy
```

Phát hiện đọc `imported.name`, nên import mặc định không mang tên nào để so:

```tsx
import Tree from "@/components/branches/Tree"   // rule không thấy

export const SignInOverlay = ({ contract }) => (
  <Tree><AuthenticationPanel contract={contract} /></Tree>
)
```

Và cờ `hasContent` chỉ đo **sự hiện diện của import**:

```tsx
import { ContractContent } from "@/components/contracts"   // import cho có

export const SignInOverlay = ({ contract }) => <SomeOtherHost contract={contract} />   // rule không thấy
```

---

## `checkbox-keeps-compound-anatomy`

### SAI — phần điều khiển và phần nội dung là anh em

```tsx
// src/components/leaves/Checkbox/index.tsx
import { Checkbox as HeroCheckbox } from "@vendor/react"

export const Checkbox = ({ label }) => (
  <HeroCheckbox.Root>
    <HeroCheckbox.Control>
      <HeroCheckbox.Indicator />
    </HeroCheckbox.Control>
    <HeroCheckbox.Content>{label}</HeroCheckbox.Content>   {/* anatomy */}
  </HeroCheckbox.Root>
)
```

Vẫn vẽ ra một ô tick. Nhìn ảnh chụp không thấy sai. Nhưng chữ nhìn thấy nằm **ngoài** vùng bấm.

### SAI — truyền chữ nhãn thẳng vào gốc

```tsx
// src/components/leaves/Checkbox/index.tsx
import { Checkbox as HeroCheckbox } from "@vendor/react"

export const Checkbox = ({ label }) => <HeroCheckbox.Root label={label} />   // anatomy
```

Tên khả truy cập vẫn đúng, nên test truy vấn theo nhãn vẫn xanh — mà không có cái ô nào được vẽ.

### ĐÚNG

```tsx
// src/components/leaves/Checkbox/index.tsx
import { Checkbox as HeroCheckbox } from "@vendor/react"

export const Checkbox = ({ label }) => (
  <HeroCheckbox.Root>
    <HeroCheckbox.Content>
      <HeroCheckbox.Control>
        <HeroCheckbox.Indicator />
      </HeroCheckbox.Control>
      {label}
    </HeroCheckbox.Content>
  </HeroCheckbox.Root>
)
```

### Cửa lách và nhầm lẫn

Ba biến là **toàn file**. Một điều khiển đúng làm thoả cả ba cho một điều khiển hỏng đứng cạnh:

```tsx
// src/components/leaves/Checkbox/index.tsx
export const Checkbox = ({ label }) => (
  <HeroCheckbox.Root>
    <HeroCheckbox.Content>
      <HeroCheckbox.Control><HeroCheckbox.Indicator /></HeroCheckbox.Control>
      {label}
    </HeroCheckbox.Content>
  </HeroCheckbox.Root>
)

export const CompactCheckbox = ({ label }) => (
  <HeroCheckbox.Root>
    <HeroCheckbox.Control><HeroCheckbox.Indicator /></HeroCheckbox.Control>
    <HeroCheckbox.Content>{label}</HeroCheckbox.Content>   // rule không thấy
  </HeroCheckbox.Root>
)
```

Và ngay trong khối ĐÚNG, **vị trí nhãn không hề được kiểm**. Khối dưới đây thoả cả ba biến trong khi
chữ vẫn nằm ngoài vùng bấm — đúng lối hỏng mà văn bản luật mô tả:

```tsx
<HeroCheckbox.Root>
  <HeroCheckbox.Content>
    <HeroCheckbox.Control><HeroCheckbox.Indicator /></HeroCheckbox.Control>
  </HeroCheckbox.Content>
  <span>{label}</span>   // rule không thấy
</HeroCheckbox.Root>
```

---

## `no-internal-starci-href`

### SAI — đích nội bộ viết thành literal

```tsx
// src/components/blocks/marketing/Footer/component.tsx
export const Footer = () => <a href="/terms">Điều khoản</a>   // internal
```

### SAI — đích nội bộ nằm trong giá trị object

```ts
// src/components/layouts/ShellNav/links.ts
export const links = [
  { label: "Khoá học", href: "/courses" },        // internal
  { label: "Blog", externalHref: "/blog" },       // internal
]
```

### SAI — lá chỉ-nội-bộ khai báo `href` trong kiểu

```ts
// src/components/leaves/NavLink/index.tsx
interface NavLinkProps {
  label: string
  href: string   // leaf — cấm cả việc khai báo
}
```

### ĐÚNG — thành phần thuần báo ra một lần bấm, phần được nối giữ đường dẫn

```tsx
// src/components/leaves/NavLink/index.tsx
export const NavLink = ({ label, on }) => (
  <button type="button" onClick={on?.press}>{label}</button>
)
```

```tsx
// src/components/layouts/ShellNav/index.tsx
"use client"
import { useRouter } from "next/navigation"

export const ShellNavConnected = () => {
  const router = useRouter()
  return <ShellNav on={{ press: (id) => router.push(ROUTES[id]) }} />
}
```

### ĐÚNG — `href` dành cho đích bên ngoài

```tsx
<a href="https://an-external-host.example/docs" rel="noreferrer" target="_blank">Tài liệu</a>
```

### Cửa lách và nhầm lẫn

**Mọi đích tính toán được đều đi lọt** — và đây là dạng phổ biến nhất của một đường dẫn nội bộ thật:

```tsx
<a href={`/courses/${course.id}`}>{course.title}</a>   // rule không thấy
<a href={ROUTES.courses}>Khoá học</a>                  // rule không thấy
<a href={"/courses" + suffix}>Khoá học</a>             // rule không thấy
```

Mảng chuỗi thuần không có thuộc tính `href` nào để rule đứng lên:

```ts
export const footerPaths = ["/terms", "/privacy"]   // rule không thấy
```

Khoá mang tên khác cũng vậy — rule đọc đúng hai khoá:

```ts
export const links = [{ label: "Khoá học", to: "/courses" }]   // rule không thấy
```

Và phép thử nội bộ là **một ký tự đầu cộng một host ghim**, nên nó vừa hụt vừa thừa:

```tsx
<a href="https://staging.an-internal-host.example/courses">Khoá học</a>   // hụt: rule không thấy
<a href="//an-external-cdn.example/file.pdf">Tải về</a>                   // thừa: internal nổ oan
```

---

## Ánh xạ yêu cầu sang một rule

Nêu file, node và chuỗi. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu rồi dừng.

| Yêu cầu bằng lời | Lập luận | Rule | Kết quả |
|---|---|---|---|
| "Nhánh này cần một hộp thoại, cho nó import thư viện" | Nhánh thường không nằm trong danh sách sở hữu | `vendor-boundary` | `outside` |
| "Thêm một vỏ mới cho tooltip" | Danh sách vỏ là danh sách đóng bốn tên | `vendor-boundary` | `unknownShell` |
| "File này ở trong thư mục vỏ nhưng chỉ chiếu hợp đồng" | Vỏ không bọc nguyên thể là một nhánh xếp nhầm tầng | `vendor-boundary` | `emptyShell` |
| "Hộp thoại bị hụt lề trên, thêm `p-6` vào thân" | Hợp đồng gắn vào đã sở hữu bố cục | `modal-shell-owns-scroll-body` | `inset` |
| "Dùng ô nhập mặc định cho nhanh" | Bề mặt trường thứ hai bên trong một bề mặt đã có ranh giới | `field-input-uses-secondary-variant` | `variant` |
| "Cho biểu tượng phong bì trước nhãn email" | Nhãn là chữ; biểu tượng cần hành động riêng | `field-label-is-text-only` | `icon` |
| "Bọc nội dung lớp phủ vào một thẻ cho gọn" | Lớp phủ đã là vật thể có ranh giới | `no-surface-branch-in-overlay` | `nested` |
| "Làm link bằng `button` cho dễ gắn handler" | Ngữ nghĩa điều hướng thuộc nguyên thể của thư viện | `text-link-uses-hero-link` | `handmade` |
| "Bấm biểu tượng tài khoản thì mở thẳng đăng nhập" | Khách vãng lai phải thấy lựa chọn trước | `account-control-owns-dropdown` | `direct` |
| "Cột giữa hơi sát, thêm `py-10`" | Vật chứa đã không-đệm; đây là dải thứ hai | `auth-overlay-owns-single-content-host` | `inset` |
| "Đặt phần điều khiển cạnh phần nội dung cho phẳng" | Chữ nhìn thấy ra khỏi vùng bấm | `checkbox-keeps-compound-anatomy` | `anatomy` |
| "Điều khoản chỉ là một link tĩnh, để `href` cũng được" | Điều hướng nội bộ là hành động, kể cả khi trông như link | `no-internal-starci-href` | `internal` |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `outside` / `unknownShell` | File có nằm **trong thư mục vỏ** không? Nếu có, hai báo cáo cùng nổ và cái phải sửa là **chỗ đặt file**, không phải import |
| `emptyShell` / `unknownShell` | Tên thư mục có nằm trong bốn tên vỏ không? Có ⇒ `emptyShell`; không ⇒ `unknownShell` |
| `emptyShell` / ngoại lệ vỏ framework | Cơ chế của vỏ là của thư viện hay của framework? Của framework ⇒ không đòi import |
| `missing` / `inset` (vỏ hộp thoại) | Thân của thư viện có tồn tại không? Không ⇒ `missing`; có mà sai class ⇒ `inset` |
| `vendor` / `shell` / `pieces` | Khối import thư viện, hay không import vỏ, hay import các mảnh của vỏ? Ba báo cáo khác nhau cho ba lối hỏng khác nhau |
| `duplicate` / `inset` (lớp phủ xác thực) | Vật chứa thứ hai đến từ một lần bọc, hay từ một class đệm? |
| `internal` / `leaf` | File có phải một trong bốn lá chỉ-nội-bộ không? Có ⇒ **mọi** `href` đều cấm, không xét giá trị |
| Rule nổ / cửa còn mở | Giá trị có phải một `Literal` trần không? Không ⇒ rule không nhìn thấy, và im lặng **không** phải là hợp lệ |

## Sai lầm lặp lại nhiều nhất

1. Đọc **im lặng** thành **hợp lệ**. Quá nửa số cửa mở trên kệ này là im lặng: hằng số, biểu thức,
   import tương đối, re-export.
2. Dời file vào thư mục lá để "cho hợp lệ". Quyền sở hữu là thư mục, nên cách đó luôn hiệu quả — và
   luôn sai.
3. Gom class vào một hằng cho gọn, rồi mất luôn mọi phép kiểm chuỗi con đi kèm.
4. Import một thứ **cho có** để tắt một báo cáo hiện-diện, mà không vẽ nó.
5. Viết `className={"p-0"}` hoặc `variant={"secondary"}` rồi ngạc nhiên vì rule vẫn nổ: cả hai không
   phải `Literal` trần.
6. Dùng import tương đối trong các file có cổng tên file, làm cờ sở hữu không bao giờ bật.
7. Sửa một `href` literal thành template literal có nội suy và coi như đã sửa xong.
8. Đổi tên file (`index.tsx` → `component.tsx`) và mất trọn một rule mà không ai thấy gì đỏ lên.
