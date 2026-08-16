---
id: fe-patterns-vendor-boundary-example
title: example.md
slug: /fe/patterns/vendor-boundary/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã VENDOR-N, viết bằng TSX thường với một vendor thay thế.
---

# example.md

> Version: `2.00` · Module: `vendor-boundary` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Thư viện component được viết là `@vendor/ui`, thư viện glyph là
`@vendor/glyphs`. Tên thật của thư viện không đổi kết luận nào ở đây: luật nói về **file nào được
import**, không về việc import cái gì.

Mỗi mã có **nhiều case**, sau đó là **ngoại lệ và nhầm lẫn**. Phần cuối trang ánh xạ từ yêu cầu bằng
lời sang một phán quyết duy nhất.

---

## `VENDOR-1` — mỗi primitive có một chủ sở hữu có tên

### Case: leaf sở hữu primitive

```tsx
// src/components/leaves/Button/index.tsx — ĐÚNG
import { Button as VendorButton } from "@vendor/ui"

export type ButtonData = {
    readonly label: string
    readonly tone?: "primary" | "secondary" | "danger"
}

export const Button = ({ props, on }: ButtonProps) => (
    <VendorButton data-tier="leaf" onPress={on?.press} variant={props.tone ?? "primary"}>
        {props.label}
    </VendorButton>
)
```

### Case: cùng dòng import ấy, đặt trong một branch

```tsx
// src/components/branches/GenericPanel/index.tsx — SAI
import { Modal } from "@vendor/ui"
```

Không có gì sai với dòng code. Sai ở **chỗ nó đứng**: branch này vừa trở thành chủ sở hữu thứ hai của
một cơ chế đã có chủ, và không ai đặt tên cho nó.

### Case: block cần một control — compose thay vì import

```tsx
// src/components/blocks/billing/PlanRow/component.tsx — SAI
import { Button as VendorButton, Tooltip } from "@vendor/ui"

export const PlanRow = ({ props }: PlanRowProps) => (
    <Tooltip content={props.hint}>
        <VendorButton>{props.label}</VendorButton>
    </Tooltip>
)
```

```tsx
// src/components/blocks/billing/PlanRow/component.tsx — ĐÚNG
import { Button } from "@/components/leaves/Button"
import { HintTarget } from "@/components/leaves/HintTarget"

export const PlanRow = ({ props, on }: PlanRowProps) => (
    <HintTarget props={{ hint: props.hint }}>
        <Button props={{ label: props.label }} on={{ press: on.upgrade }} />
    </HintTarget>
)
```

Cần tooltip thì mở một leaf sở hữu tooltip. "Chưa có leaf nào" là một việc phải làm, không phải một
giấy phép.

### Case: subpath vẫn là vendor

```tsx
// src/components/composites/StatTile/index.tsx — SAI
import { Skeleton } from "@vendor/ui/skeleton"
```

Ranh giới đọc theo **prefix package**. Đi vòng qua subpath không đổi việc file này không phải chủ sở
hữu.

### Ngoại lệ và nhầm lẫn

- **Provider ngoài cây component được phép.** Dựng thư viện một lần cho cả ứng dụng không phải một
  component với tay lấy widget:

  ```tsx
  // src/app/providers.tsx — ĐÚNG, nằm ngoài src/components/
  import { VendorProvider } from "@vendor/ui"

  export const Providers = ({ children }: { readonly children: React.ReactNode }) => (
      <VendorProvider>{children}</VendorProvider>
  )
  ```

- **File test được miễn nửa soi-vào-trong.** Một test mount primitive không phải một component thường
  đang đòi tầng.

- **"Một chủ sở hữu" chưa được rule giữ.** Hai leaf cùng import một primitive thì không có gì báo:

  ```tsx
  // src/components/leaves/Button/index.tsx     — import { Button } from "@vendor/ui"
  // src/components/leaves/ActionButton/index.tsx — import { Button } from "@vendor/ui"   ← không ai bắt
  ```

  Đây là khoảng hở đã ghi trong `audit.md`, không phải một cách dùng hợp lệ.

---

## `VENDOR-2` — `shells/` đóng, shell rỗng cũng sai

### Case: covering shell hợp lệ

```tsx
// src/components/shells/DrawerShell/index.tsx — ĐÚNG
import { Drawer } from "@vendor/ui"

export const DrawerShell = ({ props, on, children }: DrawerShellProps) => (
    <Drawer isOpen={props.open} onOpenChange={on.openChange} placement={props.side}>
        <Drawer.Content>{children}</Drawer.Content>
    </Drawer>
)
```

### Case: thành viên thứ năm

```tsx
// src/components/shells/SheetShell/index.tsx — SAI
import { Popover } from "@vendor/ui"

export const SheetShell = ({ children }: SheetShellProps) => (
    <Popover><Popover.Content>{children}</Popover.Content></Popover>
)
```

Import hoàn toàn hợp lệ; **thư mục** thì không. Cần một slot `children` tuỳ ý không tạo ra shell mới.

### Case: shell rỗng — nửa soi-vào-trong

```tsx
// src/components/shells/ModalShell/parts.tsx — SAI
// Không import vendor nào. Đây là một branch thường đang giữ một đặc quyền nó không cần.
export const ModalHeaderRow = ({ props }: ModalHeaderRowProps) => (
    <div className="flex items-center justify-between px-6 pt-6">{props.title}</div>
)
```

```tsx
// src/components/branches/ModalHeaderRow/index.tsx — ĐÚNG
// Cùng một file, đặt ở tầng đúng với việc nó làm.
export const ModalHeaderRow = ({ props }: ModalHeaderRowProps) => (
    <div className="flex items-center justify-between px-6 pt-6">{props.title}</div>
)
```

### Case: framework shell không import vendor — vẫn hợp lệ

```tsx
// src/components/shells/RouteShell/index.tsx — ĐÚNG
// Cơ chế nó sở hữu là của framework, không phải của vendor.
export const RouteShell = ({ children }: RouteShellProps) => (
    <div data-tier="shell" className="min-h-dvh">{children}</div>
)
```

Bắt file này import một primitive "cho giống ba cái kia" là ép thêm một dòng vô nghĩa. Ngoại lệ này
đóng và chỉ áp cho đúng nó.

### Ngoại lệ và nhầm lẫn

- **"Nó cần children slot" không phải lý do.** Đó là mô tả của vấn đề, không phải giấy phép:

  ```tsx
  // SAI  — shells/TabsShell/index.tsx, vì tabs "cũng có children"
  // ĐÚNG — branches/TabsSection/index.tsx, dùng contract + render
  ```

- **Chuyển một file khó xếp vào `shells/` là đúng cái mà nửa soi-vào-trong sinh ra để chặn.**
- **Bốn shell không phải ba.** Danh sách nào chỉ kể ba là một lỗi gate, không phải một luật chặt hơn.

---

## `VENDOR-3` — surface branch giữ ruột có kiểu

### Case: surface branch chiếu contract vào thân vendor

```tsx
// src/components/branches/SurfaceListCard/index.tsx — ĐÚNG
import { Card } from "@vendor/ui"

export type SurfaceListCardData<K extends string> = {
    readonly title: string
    readonly rows: readonly SurfaceListRow<K>[]
}

export const SurfaceListCard = <K extends string>({ props, render }: SurfaceListCardProps<K>) => (
    <Card>
        <Card.Content>
            <h2>{props.title}</h2>
            <ul className="divide-y">
                {props.rows.map((row) => <li key={row.key}>{render[row.key]}</li>)}
            </ul>
        </Card.Content>
    </Card>
)
```

### Case: wrapper bị hiểu thành giấy phép nhận `children`

```tsx
// src/components/branches/SurfaceCard/index.tsx — SAI
import { Card } from "@vendor/ui"

export type SurfaceCardData = {
    readonly title: string
    readonly children: React.ReactNode
}

export const SurfaceCard = ({ props }: SurfaceCardProps) => (
    <Card><Card.Content>{props.children}</Card.Content></Card>
)
```

Quyền import wrapper đến từ việc branch này **chiếu một contract có kiểu**. Bỏ contract đi thì quyền
ấy mất luôn lý do tồn tại.

### Case: `children` đi vào bằng cửa khác

```tsx
// SAI — cùng một lỗ, đến từ tham số destructure
export const SurfaceFormCard = ({ props, children }: SurfaceFormCardProps) => (
    <Card><Card.Content>{children}</Card.Content></Card>
)
```

### Case: list card nhận node thay vì dữ liệu

```tsx
// SAI
<SurfaceListCard props={{ title: "Hoá đơn", rows: invoices.map((i) => <InvoiceRow key={i.id} {...i} />) }} />
```

```tsx
// ĐÚNG
<SurfaceListCard
    props={{ title: "Hoá đơn", rows: invoices.map((i) => ({ key: i.id })) }}
    render={Object.fromEntries(invoices.map((i) => [i.id, <InvoiceRow key={i.id} props={i} />]))}
/>
```

### Ngoại lệ và nhầm lẫn

- **Shell được nhận `children`; surface branch thì không.** Cùng một từ, hai quyền khác nhau, và sự
  khác nhau ấy chính là ranh giới giữa `VENDOR-2` và `VENDOR-3`.
- **Không có rule nào trong module này giữ mã trên.** Nửa `children` do một module khác giữ; nửa
  "wrapper không nới ruột" thì chưa ai giữ. Đọc `audit.md` trước khi tin là an toàn.

---

## `VENDOR-4` — không có `CardShell`

### Case: branch có tên tự sở hữu wrapper

```tsx
// src/components/branches/SurfaceCard/index.tsx — ĐÚNG
import { Card } from "@vendor/ui"

export const SurfaceCard = ({ props, render }: SurfaceCardProps) => (
    <Card>
        <Card.Content className="flex flex-col gap-3">
            <h2 className="font-medium">{props.title}</h2>
            {render.body}
        </Card.Content>
    </Card>
)
```

### Case: lớp trung gian tự nhận là shell

```tsx
// src/components/shells/CardShell/index.tsx — SAI
import { Card } from "@vendor/ui"

export const CardShell = ({ children }: CardShellProps) => (
    <Card><Card.Content>{children}</Card.Content></Card>
)
```

`Card > Card.Content` **trông** như một cơ chế vì có wrapper và có thân. Nhưng nó không mở, không
đóng, không bẫy focus, không portal, không quản lý cuộn. Nó là cú pháp bọc.

### Case: đổi chỗ không cứu được

```tsx
// src/components/branches/CardShell/index.tsx — vẫn SAI
import { Card } from "@vendor/ui"
```

Ở `shells/` thì sai vì là thành viên thứ năm. Ở `branches/` thì sai vì tên `CardShell` hứa một cơ chế
không tồn tại, và bốn surface branch có tên đã sở hữu wrapper ấy rồi.

### Ngoại lệ và nhầm lẫn

- **"Để dùng lại phần bọc" là mô tả của một branch, không phải của một shell.** Muốn dùng lại thì đã
  có bốn surface branch có tên.
- **`CardShell` gần như luôn kéo theo `VENDOR-3`**, vì lý do duy nhất để dựng nó là nhận `children`.

---

## `VENDOR-5` — thư viện glyph có ranh giới riêng

### Case: glyph có leaf của nó

```tsx
// src/components/leaves/Icon/index.tsx — ĐÚNG
import { ChevronDownIcon, CheckIcon } from "@vendor/glyphs"

const GLYPHS = { chevronDown: ChevronDownIcon, check: CheckIcon } as const

export const Icon = ({ props }: IconProps) => {
    const Glyph = GLYPHS[props.name]
    return <Glyph aria-hidden="true" className={SIZE_BY_ROLE[props.role]} />
}
```

### Case: caret nhập thẳng, ở một kích thước không tồn tại ở đâu khác

```tsx
// src/components/blocks/nav/SortMenu/component.tsx — SAI theo module icon, KHÔNG bị module này bắt
import { ChevronDownIcon } from "@vendor/glyphs"

export const SortMenu = () => <button><ChevronDownIcon className="h-[13px] w-[13px]" /></button>
```

Dòng import này **không** khớp prefix package mà luật vendor-boundary bảo vệ. Nó là chuyện của module
icon. Đây chính là khoảng trống mà `VENDOR-5` đặt tên: một rule gọi tên một vendor thì bảo vệ một
vendor.

### Case: đừng chờ nhầm rule

```tsx
// SAI về mặt lập luận, dù code có thể đúng:
// "Icon này chắc vendor-boundary bắt rồi." — không, nó không bắt.
```

### Ngoại lệ và nhầm lẫn

- **Cùng là "vendor" không có nghĩa là cùng một ranh giới.** Hai package, hai module rule, hai bộ
  message.
- **Khoảng trống giữa hai module là chỗ lỗi thật đã từng lọt.** Nó được ghi thành một mã chính là để
  người đọc không phải phát hiện lại.

---

## `VENDOR-6` — `ModalShell` có một scroll body zero-inset

### Case: thân vendor là vùng cuộn, và nó zero-inset

```tsx
// src/components/shells/ModalShell/index.tsx — ĐÚNG
import { Modal } from "@vendor/ui"

export const ModalShell = ({ props, on, children }: ModalShellProps) => (
    <Modal isOpen={props.open} onOpenChange={on.openChange} size={props.size}>
        <Modal.Content>
            <Modal.Body className="p-0">{children}</Modal.Body>
        </Modal.Content>
    </Modal>
)
```

### Case: thân vendor mang inset — nội dung bị đẩy hai lần

```tsx
// SAI
<Modal.Body className="p-6">{children}</Modal.Body>
```

Contract được mount bên trong đã sở hữu layout của chính nó. Cộng thêm `p-6` ở đây là nói cùng một
khoảng cách hai lần, và người sửa sau sẽ gỡ nhầm lớp.

### Case: shell tự dựng vùng cuộn thay vì dùng thân vendor

```tsx
// SAI
<Modal.Content>
    <div className="max-h-[70vh] overflow-y-auto">{children}</div>
</Modal.Content>
```

```tsx
// ĐÚNG
<Modal.Content>
    <Modal.Body className="p-0">{children}</Modal.Body>
</Modal.Content>
```

Vùng cuộn của dialog là cơ chế vendor. Vẽ lại nó bằng tay là bỏ mất mọi thứ vendor đã xử lý cùng nó.

### Case: mặt nội dung thứ hai trong dialog

```tsx
// SAI
<Modal.Body className="p-0">
    <div className="rounded-xl border bg-white p-6">{children}</div>
</Modal.Body>
```

### Ngoại lệ và nhầm lẫn

- **`p-0` là giá trị chính xác, không phải "padding nhỏ".** `px-0`, `p-[0px]`, hay không khai báo gì
  đều không phải cùng một câu.
- **Đây là nửa `shell` của bài toán padding auth.** Nửa còn lại là `VENDOR-12`; sửa một nửa thì dải
  padding thứ hai vẫn quay lại.

---

## `VENDOR-7` — Field nhà cố định variant input

### Case: variant bị cố định ở chủ sở hữu

```tsx
// src/components/leaves/Input/index.tsx — ĐÚNG
import { Input as VendorInput } from "@vendor/ui"

export const Input = ({ props, on }: InputProps) => (
    <VendorInput
        variant="secondary"
        type={HTML_TYPE_BY_KIND[props.kind ?? "text"]}
        value={props.value}
        onValueChange={on?.change}
    />
)
```

### Case: appearance slot mở ra cho người gọi

```tsx
// SAI
export type FieldData = {
    readonly id: string
    readonly label: string
    readonly variant?: "primary" | "secondary" | "flat"
}
```

```tsx
// ĐÚNG
export type FieldData = {
    readonly id: string
    readonly label: string
    readonly kind?: FieldKind
}
```

`kind` là một dữ kiện nghiệp vụ — đang nhập cái gì. `variant` là một lựa chọn thẩm mỹ mà người gọi
không có dữ kiện để quyết.

### Case: một chỗ gọi "chỉnh cho hợp màn này"

```tsx
// SAI
<Field props={{ id: "email", label: "Email", variant: "primary" }} />
```

Field luôn đứng trong một mặt đã bounded. Variant mặc định vẽ ra một mặt cạnh tranh với mặt đang chứa
nó, và trong dialog thì ô nhập trông nổi hơn chính dialog.

### Ngoại lệ và nhầm lẫn

- **Hiện tại không có rule nào bắt được mã này.** Rule tồn tại nhưng canh một đường dẫn cây không có,
  nên nó không bao giờ chạy. Ghi trong `audit.md`.
- **Ô tìm kiếm ở navbar không phải Field nhà.** Nó không đứng trên mặt bounded, và nó là một leaf
  khác.

---

## `VENDOR-8` — overlay đã là vật bounded

### Case: overlay vẽ trực tiếp

```tsx
// src/components/overlays/settings/NotificationOverlay/component.tsx — ĐÚNG
import { ModalShell } from "@/components/shells/ModalShell"
import { Field } from "@/components/composites/Field"

export const NotificationOverlay = ({ props, on }: NotificationOverlayProps) => (
    <ModalShell props={{ open: props.open }} on={{ openChange: on.openChange }}>
        <div className="flex flex-col gap-6 p-6">
            <h2 className="font-medium">Thông báo</h2>
            <div className="flex flex-col gap-4">
                <Field props={{ id: "digest", label: "Bản tin hằng tuần" }} />
                <Field props={{ id: "mentions", label: "Khi có người nhắc tới bạn" }} />
            </div>
        </div>
    </ModalShell>
)
```

### Case: mặt lồng mặt

```tsx
// SAI
import { SurfaceFormCard } from "@/components/branches/SurfaceFormCard"

export const NotificationOverlay = ({ props }: NotificationOverlayProps) => (
    <ModalShell props={{ open: props.open }}>
        <SurfaceFormCard props={{ title: "Thông báo" }} render={{ body: <Fields /> }} />
    </ModalShell>
)
```

Overlay **đã là** mặt bounded: có viền, có nền, có bóng. Thêm một card vào trong là vẽ hai viền lồng
nhau để nói cùng một ranh giới.

### Case: "chỉ để nhóm mấy dòng lại cho gọn"

```tsx
// SAI — cần nhóm thì dùng heading và khoảng cách
<SurfaceCard props={{ title: "Bảo mật" }} render={{ body: <SecurityRows /> }} />
```

```tsx
// ĐÚNG
<section className="flex flex-col gap-3">
    <h3 className="text-sm font-medium">Bảo mật</h3>
    <SecurityRows />
</section>
```

### Ngoại lệ và nhầm lẫn

- **Surface branch không bị cấm tồn tại.** Chúng hợp lệ trên nền trang; luật cấm đúng **một vị trí**.
- **Drawer và dialog cùng chịu luật này**, vì cả hai đều đã là vật bounded.

---

## `VENDOR-9` — label của field chỉ có chữ

### Case: label chỉ có chữ

```tsx
// src/components/composites/Field/index.tsx — ĐÚNG
<Label props={{ htmlFor: props.id, content: props.label }} />
```

### Case: suy icon từ kiểu input

```tsx
// SAI
const ICON_BY_KIND = { email: "envelope", password: "lock", code: "asterisk" } as const

<Label props={{ htmlFor: props.id, content: props.label, icon: ICON_BY_KIND[props.kind] }} />
```

Phong bì không nói thêm gì mà chữ "Email" chưa nói. Nó là một lớp nhiễu suy ra từ một dữ kiện kỹ
thuật.

### Case: glyph nằm trong thẻ label

```tsx
// SAI
<label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
    <Icon props={{ name: "lock", role: "chip" }} />
    Mật khẩu
</label>
```

### Case: glyph có hành động riêng — ngoại lệ đóng

```tsx
// ĐÚNG — glyph thuộc về nút hiện/ẩn, không thuộc về label
<label htmlFor="password" className="text-sm font-medium">Mật khẩu</label>
<div className="relative">
    <Input props={{ kind: "password" }} />
    <button aria-label={revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={toggle} type="button">
        <Icon props={{ name: revealed ? "eyeOff" : "eye", role: "control" }} />
    </button>
</div>
```

Chủ sở hữu của glyph là **hành động**, không bao giờ là label.

### Ngoại lệ và nhầm lẫn

- **Leaf label có thể _nhận_ một `icon` mà field vẫn không _truyền_.** Luật giữ ở **chỗ gọi**, và hiện
  nay không có rule nào đọc chỗ gọi đó. Ghi trong `audit.md`.
- **Icon trạng thái lỗi không phải icon của label.** Nó thuộc về dòng thông báo, có nội dung riêng.

---

## `VENDOR-10` — `TextLink` là Link của vendor

### Case: leaf bọc primitive link

```tsx
// src/components/leaves/TextLink/index.tsx — ĐÚNG
import { Link as VendorLink } from "@vendor/ui"

export const TextLink = ({ props, on }: TextLinkProps) => (
    <VendorLink data-tier="leaf" size={props.size ?? "sm"} onPress={on.press}>
        {props.label}
    </VendorLink>
)
```

### Case: link vẽ tay

```tsx
// SAI
export const TextLink = ({ props, on }: TextLinkProps) => (
    <button className="text-primary hover:underline" onClick={on.press} type="button">
        {props.label}
    </button>
)
```

Mất focus ring, mất thứ tự bàn phím, mất hành vi cảm ứng, mất mọi trạng thái không được viết ra. Cái
được là năm giây.

### Case: bọc đúng primitive nhưng vẫn thêm class hover tay

```tsx
// SAI
<VendorLink className="hover:underline" onPress={on.press}>{props.label}</VendorLink>
```

Nếu hover của vendor chưa đúng, đó là một quyết định token hoặc một issue với vendor — không phải một
class dán chồng.

### Ngoại lệ và nhầm lẫn

- **Đúng `VENDOR-10` không miễn `VENDOR-14`:**

  ```tsx
  {/* SAI — primitive đúng, đích sai */}
  <VendorLink href="/khoa-hoc">Khoá học</VendorLink>
  ```

- **Một nút thật vẫn là nút.** Luật không bắt mọi thứ bấm được phải thành link; nó bắt thứ **đóng vai
  link** phải là link.

---

## `VENDOR-11` — cơ chế dropdown và ý nghĩa tài khoản là hai chủ

### Case: shell sở hữu cơ chế

```tsx
// src/components/shells/DropdownShell/index.tsx — ĐÚNG
import { Dropdown } from "@vendor/ui"

export const DropdownShell = <A extends string>({ props, on, render }: DropdownShellProps<A>) => (
    <Dropdown placement={props.placement}>
        <Dropdown.Trigger>{render.trigger}</Dropdown.Trigger>
        <Dropdown.Popover>
            <Dropdown.Menu onAction={(key) => on.action(key as A)}>
                {props.sections.map((section) => (
                    <Dropdown.Section key={section.key} title={section.title}>
                        {section.items.map((item) => (
                            <Dropdown.Item key={item.action}>{item.label}</Dropdown.Item>
                        ))}
                    </Dropdown.Section>
                ))}
            </Dropdown.Menu>
        </Dropdown.Popover>
    </Dropdown>
)
```

### Case: block sở hữu ý nghĩa

```tsx
// src/components/blocks/auth/AccountMenu/component.tsx — ĐÚNG
import { DropdownShell } from "@/components/shells/DropdownShell"

export const AccountMenu = ({ props, on }: AccountMenuProps) => (
    <DropdownShell
        props={{
            placement: "bottom right",
            sections: [
                { key: "guest", title: props.guestSentence, items: [
                    { action: "signIn", label: props.signInLabel },
                    { action: "signUp", label: props.signUpLabel },
                ] },
            ],
        }}
        on={{ action: on.choose }}
        render={{ trigger: <IconButton props={{ icon: "account" }} /> }}
    />
)
```

### Case: block với tay lấy vendor

```tsx
// SAI
import { Dropdown } from "@vendor/ui"
```

### Case: block ráp lại giải phẫu bằng mảnh của shell

```tsx
// SAI
import { DropdownShell, DropdownShellSection, DropdownShellItem } from "@/components/shells/DropdownShell"

<DropdownShell>
    <DropdownShellSection title={props.guestSentence}>
        <DropdownShellItem>{props.signInLabel}</DropdownShellItem>
    </DropdownShellSection>
</DropdownShell>
```

Shell nhận **dữ liệu có kiểu** và tự bung ra thành trigger/popover/menu/section/item. Xuất mảnh ra
ngoài là dựng lại đúng cái vừa đóng gói.

### Case: nav giả lập control

```tsx
// SAI — bấm icon tài khoản nhảy thẳng vào một chế độ auth
<IconButton props={{ icon: "account" }} on={{ press: openSignIn }} />
```

```tsx
// ĐÚNG — nav compose block; block sở hữu câu dành cho khách và hai lựa chọn
<AccountMenu props={{ guestSentence, signInLabel, signUpLabel }} on={{ choose }} />
```

Bấm vào tài khoản mở ra **bản tóm tắt khách cộng hai lựa chọn**; nó không nhảy thẳng vào một chế độ.

### Ngoại lệ và nhầm lẫn

- **Khi đã đăng nhập, cấu trúc không đổi.** Vẫn là block sở hữu ý nghĩa, shell sở hữu cơ chế.
- **Rule giữ được mọi nửa cấu trúc, nhưng nửa sản phẩm chỉ được giữ bằng một lệnh cấm.** Nó chặn lối
  tắt mà không mô tả được cái đúng phải trông thế nào.

---

## `VENDOR-12` — auth projection có một host zero-inset

### Case: ba lớp, một inset

```tsx
// src/components/overlays/auth/SignInOverlay/component.tsx — ĐÚNG
import { ContractContent } from "@/components/branches/Tree"
import { ModalShell } from "@/components/shells/ModalShell"

export const SignInOverlay = ({ props, on, render }: SignInOverlayProps) => (
    <ModalShell props={{ open: props.open }} on={{ openChange: on.openChange }}>
        <ContractContent contract={render.meta.contract} render={render} />
    </ModalShell>
)
```

### Case: bọc thêm một host nữa

```tsx
// SAI
import { Tree } from "@/components/branches/Tree"

<ModalShell props={{ open: props.open }}>
    <Tree contract="centred-page-column" render={render} />
</ModalShell>
```

Panel đã sở hữu `centred-page-column` rồi. Mở thêm một `Tree` quanh nó là nhân đôi chính cái host đó.

### Case: cột nội dung mọc inset dọc

```tsx
// SAI — trong bảng contract
"centred-page-column": { className: "mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-10" }
```

```tsx
// ĐÚNG
"centred-page-column": { className: "mx-auto flex w-full max-w-md flex-col gap-6 px-6" }
```

Shell đã là zero-inset để nội dung auth chạm thẳng vào vùng cuộn. Thêm `py-*` ở đây dựng lại đúng dải
padding thứ hai mà `VENDOR-6` vừa gỡ.

### Ngoại lệ và nhầm lẫn

- **`px-*` không phải cái bị cấm.** Luật nói về **inset dọc**; ngang là chuyện khác.
- **Rule khớp theo TÊN được import, không theo đường dẫn.** Một workspace phát hành cùng những
  branch ấy từ một package khác vẫn phải khớp; `ContractContent` và `Tree` là từ vựng của canon, và
  một file import chúng nghĩa như nhau ở bất cứ đâu nó resolve tới.

---

## `VENDOR-13` — compound control giữ đủ giải phẫu

### Case: lồng đúng

```tsx
// src/components/leaves/Checkbox/index.tsx — ĐÚNG
import { Checkbox as VendorCheckbox } from "@vendor/ui"

export const Checkbox = ({ props, on }: CheckboxProps) => (
    <VendorCheckbox.Root isSelected={props.checked} onChange={on.change}>
        <VendorCheckbox.Content>
            <VendorCheckbox.Control>
                <VendorCheckbox.Indicator />
            </VendorCheckbox.Control>
            <span>{props.label}</span>
        </VendorCheckbox.Content>
    </VendorCheckbox.Root>
)
```

### Case: Control và Content là anh em

```tsx
// SAI
<VendorCheckbox.Root>
    <VendorCheckbox.Control><VendorCheckbox.Indicator /></VendorCheckbox.Control>
    <VendorCheckbox.Content><span>{props.label}</span></VendorCheckbox.Content>
</VendorCheckbox.Root>
```

Vẫn vẽ ra một dấu tick. Nhưng chữ nằm **ngoài** vùng bấm: bấm vào chữ không toggle, và người dùng
không có cách nào biết điều đó trước khi thử.

### Case: chữ truyền thẳng vào root

```tsx
// SAI
<VendorCheckbox.Root>{props.label}</VendorCheckbox.Root>
```

Có accessible name, truy vấn được bằng test theo semantic, và **không vẽ ra ô nào**. Cả hỏng hình lẫn
hỏng tương tác đều nấp được sau một test xanh.

### Case: thiếu Indicator

```tsx
// SAI
<VendorCheckbox.Content>
    <VendorCheckbox.Control />
    <span>{props.label}</span>
</VendorCheckbox.Content>
```

### Ngoại lệ và nhầm lẫn

- **Rule chỉ đọc một control ở một đường dẫn.** Câu tổng quát "compound control giữ giải phẫu" hiện
  chỉ được giữ cho checkbox; radio và switch dựa vào người đọc.
- **Đừng nghiệm thu bằng truy vấn semantic.** Ở mã này, truy vấn xanh là thứ **che** lỗi.

---

## `VENDOR-14` — điều hướng nội bộ là một hành động

### Case: leaf báo hành động

```tsx
// src/components/leaves/NavLink/index.tsx — ĐÚNG
export type NavLinkData = {
    readonly id: string
    readonly label: string
    readonly active?: boolean
}

export const NavLink = ({ props, on }: NavLinkProps) => (
    <TextLink props={{ label: props.label }} on={{ press: () => on.press(props.id) }} />
)
```

```tsx
// component đã kết nối — ĐÚNG, đường dẫn nằm ở đây
const PATH_BY_ID = { dashboard: "/bang-dieu-khien", courses: "/khoa-hoc" } as const

<NavLink props={{ id: "courses", label: t("nav.courses") }} on={{ press: (id) => router.push(PATH_BY_ID[id]) }} />
```

### Case: `href` nội bộ

```tsx
// SAI
<a href="/khoa-hoc">Khoá học</a>
```

### Case: leaf chỉ dùng nội bộ mà khai báo `href`

```tsx
// SAI — khai báo thôi đã là vi phạm, chưa cần ai truyền vào
export type SeeMoreLinkData = {
    readonly label: string
    readonly href?: string
}
```

```tsx
// ĐÚNG
export type SeeMoreLinkData = {
    readonly label: string
}
```

### Case: `href` nằm trong dữ liệu

```tsx
// SAI
const LEGAL_LINKS = [
    { label: "Điều khoản", href: "/dieu-khoan" },
    { label: "Bảo mật", externalHref: "/bao-mat" },
]
```

```tsx
// ĐÚNG
const LEGAL_LINKS = [
    { label: "Điều khoản", id: "terms" },
    { label: "Bảo mật", id: "privacy" },
]
```

### Case: trông và mang ngữ nghĩa là link — luật vẫn áp

```tsx
// SAI — brand về trang chủ
<a className="font-semibold" href="/">Trang chủ</a>
```

```tsx
// ĐÚNG
<TextLink props={{ label: "Trang chủ" }} on={{ press: () => router.push("/") }} />
```

### Case: đích ngoài ứng dụng — `href` thật, ngoại lệ đóng

```tsx
// ĐÚNG
<TextLink props={{ label: "Tài liệu vendor", externalHref: "https://example.com/docs" }} />
```

### Ngoại lệ và nhầm lẫn

- **Ép một URL ngoài đi qua router là lỗi ngược lại**, và nó lặng lẽ hơn: người dùng bấm rồi mới thấy
  màn trắng.
- **Danh sách leaf chỉ-nội-bộ trong rule phải khớp cây thật.** Một tên trong danh sách mà cây không có
  là một leaf không được ai canh. Ghi trong `audit.md`.

---

## Ánh xạ yêu cầu sang một phán quyết

Nêu **đường dẫn file**, **package được import** và **hình dạng ruột**. Nếu thiếu **một** dữ kiện quyết
định, hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một phán quyết hoặc một câu hỏi — không bao
giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Phán quyết |
|---|---|---|---|
| "Block này cần một tooltip, cho tôi import từ thư viện" | Block không nằm trong danh sách đóng | `VENDOR-1` | Mở một leaf sở hữu tooltip, rồi compose nó |
| "Tạo `SheetShell` cho bottom sheet" | `shells/` đóng ở bốn | `VENDOR-2` | Dựng branch với `contract + render` |
| "File trong `shells/` này không import gì, kệ đi" | Nửa soi-vào-trong | `VENDOR-2` | Chuyển ra `branches/`, trừ khi nó là framework shell |
| "Card cho tôi nhận `children` cho nhanh" | Wrapper không nới ruột | `VENDOR-3` | Giữ `contract + render` |
| "Tách phần bọc card thành `CardShell` để dùng lại" | Cú pháp bọc, không phải cơ chế | `VENDOR-4` | Dùng surface branch có tên |
| "Icon này chắc vendor-boundary bắt rồi" | Một rule bảo vệ một vendor | `VENDOR-5` | Kiểm module icon; luật này không đọc package glyph |
| "Thêm `p-6` vào thân dialog cho thoáng" | Contract đã sở hữu layout | `VENDOR-6` | Giữ `p-0`; padding thuộc về contract |
| "Cho Field một prop `variant`" | Người gọi không có dữ kiện để quyết | `VENDOR-7` | Đóng slot; variant cố định ở chủ sở hữu |
| "Bọc nhóm này trong dialog bằng một card" | Overlay đã là vật bounded | `VENDOR-8` | Dùng heading và khoảng cách |
| "Ô email nên có icon phong bì" | Suy ra từ kiểu input, không thêm nghĩa | `VENDOR-9` | Label chỉ chữ; glyph chỉ khi có hành động riêng |
| "Vẽ link bằng `button` cộng `hover:underline`" | Mất focus, bàn phím, trạng thái | `VENDOR-10` | Bọc primitive link của vendor |
| "Cho menu tài khoản import Dropdown luôn" | Cơ chế và ý nghĩa là hai chủ | `VENDOR-11` | Block compose shell, truyền section có kiểu |
| "Bọc panel auth trong một `Tree` nữa" | Panel đã sở hữu host | `VENDOR-12` | Chiếu bằng `ContractContent` |
| "Checkbox có accessible name rồi, test xanh" | Truy vấn semantic che cả hai kiểu hỏng | `VENDOR-13` | Kiểm đúng thứ tự lồng Content > Control > Indicator |
| "Gắn `href="/khoa-hoc"` cho gọn" | Component thuần không nên biết đường đi | `VENDOR-14` | Báo id/press; router thuộc lớp đã kết nối |
| "Link này ra tài liệu bên ngoài" | Đích ngoài ứng dụng | `VENDOR-14` | `href` thật — ngoại lệ đóng |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `VENDOR-1` / `VENDOR-2` | File này có được import không, hay thư mục này có được thêm thành viên không? |
| `VENDOR-1` / `VENDOR-5` | Package đang import là thư viện component hay thư viện glyph? |
| `VENDOR-2` / `VENDOR-4` | Lớp này sở hữu một **hành vi** (mở, đóng, focus trap, portal, cuộn) hay chỉ cú pháp bọc? |
| `VENDOR-2` / `VENDOR-3` | Slot này là `children` không diễn giải, hay là một contract có kiểu? |
| `VENDOR-6` / `VENDOR-12` | Inset dọc thứ hai đến từ shell hay từ màn dùng shell? |
| `VENDOR-6` / `VENDOR-8` | Mặt thứ hai do shell tạo ra hay do nội dung mang vào? |
| `VENDOR-7` / `VENDOR-9` | Thứ đang bị trang trí là **mặt** của ô nhập hay **label** của nó? |
| `VENDOR-10` / `VENDOR-14` | Câu hỏi là *cái gì vẽ ra link* hay *link đi đâu*? |
| `VENDOR-11` / `VENDOR-2` | File này sở hữu cơ chế vendor hay ý nghĩa sản phẩm? |
| `VENDOR-13` / `VENDOR-1` | Import đã đúng chỗ chưa, và nếu đúng rồi thì đã ráp đủ mảnh chưa? |

## Sai lầm lặp lại nhiều nhất

1. Import vendor ở tầng block hoặc page vì "chỉ chỗ này thôi".
2. Tạo shell thứ năm vì thứ cần dựng "cũng có children slot".
3. Để một file không import gì nằm lại trong `shells/` — nửa soi-vào-trong bị bỏ quên nhiều nhất.
4. Coi `Card > Card.Content` là một cơ chế và dựng `CardShell`.
5. Nghĩ rằng luật này cũng giữ thư viện glyph.
6. Cộng padding vào thân dialog trong khi contract bên trong đã có padding.
7. Mở một `variant` cho người gọi vì một màn hình trông chưa hợp.
8. Bọc nội dung overlay bằng một surface branch để "cho gọn".
9. Suy một icon trang trí từ kiểu input rồi đặt trước label.
10. Vẽ link bằng `button` cộng `hover:underline`.
11. Cho block sản phẩm import vendor hoặc ráp lại mảnh Section/Item của shell.
12. Nhân đôi content host của màn auth rồi thêm `py-*` vào cột đã có chủ.
13. Nghiệm thu compound control bằng truy vấn semantic, đúng chỗ truy vấn che lỗi.
14. Gắn `href` nội bộ vì nó ngắn hơn một dòng `router.push`.
