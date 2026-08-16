---
id: fe-layouts-laws-l7-overlay-width-is-a-product-decision-example
title: example.md
slug: /fe/layouts/laws/l7-overlay-width-is-a-product-decision/example
sidebar_label: example.md
sidebar_position: 2
description: Bảy mã L7-N đọc thẳng từ bốn overlay modal, hai drawer và một dropdown đang chạy, kèm những chỗ trông giống mà không phải.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l7-overlay-width-is-a-product-decision` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`. Một
mã không có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có, chứ không bịa ra một cái.

Toàn bộ mặt bằng đo được gồm sáu thư mục dưới `src/components/overlays/`. Bốn cái mở trên
`ModalShell` và khai được chiều rộng: `auth/SignInOverlay`, `courses/CoursePriceOverlay`,
`commerce/CheckoutOverlay`, `search/GlobalSearchOverlay`. Hai cái mở trên `DrawerShell` và không khai
được gì: `commerce/CartDrawer`, `ai/StarCiAiDrawer`. Ngoài overlay còn `DropdownShell` với hai call
site, cũng không có chiều rộng nào.

---

## `L7-1` — khai một giá trị, và để lý do đứng cạnh nó

### Trường hợp: thang thuộc về shell, không thuộc về overlay

```tsx
/** How wide the surface is allowed to get. */
export type ModalShellSize = "xs" | "sm" | "md" | "lg" | "cover"
```

Năm nấc, và không có nấc thứ sáu. Một plan muốn một số đo không nằm trong năm nấc này thì đang đề
nghị đổi shell, và việc ấy làm ở `ModalShell` trước chứ không làm bằng một class trong contract.

Neo: `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:13`.

### Trường hợp: năm nấc ấy quy ra số đo thật

```css
.modal__dialog--xs { @apply max-w-xs; }
.modal__dialog--sm { @apply max-w-sm; }
.modal__dialog--md { @apply max-w-md; }
.modal__dialog--lg { @apply max-w-lg; }
.modal__dialog--cover { @apply h-full min-h-full w-full; }
```

`size` chọn đúng một trong năm class này, và bốn class đầu chỉ là `max-w-*` của Tailwind, tức `20rem`,
`24rem`, `28rem` và `32rem`. Repo không ghi đè bốn token ấy: `globals.css` chỉ thêm họ
`--container-app-*` của riêng nó.

Hệ quả dùng được ngay là nấc của shell so trực tiếp được với `max-w-*` mà một contract bên trong tự
khai, nên câu "ai đang thắng" trả lời được bằng số chứ không phải bằng cảm giác.

Neo: `…\node_modules\@heroui\styles\dist\components\modal.css:220-250`, ánh xạ ở
`…\node_modules\@heroui\styles\dist\components\modal\modal.styles.js:33-53`, token ở
`…\node_modules\tailwindcss\theme.css:335-338`, và `…\src\app\globals.css:35-38`.

### Trường hợp: mặc định thật, và nó không phải chữ "hẹp"

```tsx
<Modal.Container size={input.size ?? "md"} placement="center">
```

Không truyền `size` thì shell quy về `md`. Đây là lý do mã `L7-6` tồn tại: im lặng vẫn cho ra một
chiều rộng, nên im lặng không phải là chưa chọn mà là chọn mà chưa phán.

Neo: `…\shells\ModalShell\index.tsx:36`.

### Trường hợp: ba giá trị đang chạy, không phải một

| Overlay | Neo | Giá trị | Lý do viết tại chỗ |
|---|---|---|---|
| `SignInOverlay` | `…\overlays\auth\SignInOverlay\component.tsx:39` | `xs` | không |
| `CoursePriceOverlay` | `…\overlays\courses\CoursePriceOverlay\component.tsx:41` | `sm` | **có** |
| `CheckoutOverlay` | `…\overlays\commerce\CheckoutOverlay\component.tsx:121` | `sm` | không |
| `GlobalSearchOverlay` | `…\overlays\search\GlobalSearchOverlay\component.tsx:193` | `cover` | không tại call site; có ở contract |

`md` là mặc định chưa ai chạm, `lg` chưa có call site nào. Ba trên bốn overlay không ghi lý do bên
cạnh giá trị, và đó là khoản nợ đo được chứ không phải một nhận xét về phong cách.

### Trông giống nhưng không phải `L7-1`

Một overlay mount `ContractContent` thay vì `Tree` không đổi gì về chiều rộng. `SignInOverlay` và
`CoursePriceOverlay` cùng đi đường `ContractContent`, một cái ở `xs`, một cái ở `sm`. Cách ruột được
chiếu vào shell là chuyện của [`L6`](../l6-overlay-is-already-a-surface/INDEX.md), còn shell mở rộng
bao nhiêu là chuyện ở đây.

---

## `L7-2` — một lời phát biểu, đọc từng điều khiển một

### Trường hợp sống: panel đăng nhập mở ở `xs`

```tsx
export const _SignInOverlay = <const K extends ContractKey>(input: SignInOverlayProps<K>) => (
    <ModalShell isOpen={input.isOpen} size="xs" onDismiss={input.onDismiss}>
        <ContractContent contract={input.render.meta.contract} render={input.render} />
    </ModalShell>
)
```

Ruột là một biểu mẫu, người đọc đi từng ô một, và chiều rộng thừa không mua thêm được gì. Con số hợp
lý, nhưng nguyên cái file không có một câu nào nói vì sao là `xs` chứ không phải `sm`.

Neo: `…\overlays\auth\SignInOverlay\component.tsx:39`.

### Trường hợp: lý do có thật, nhưng nó nằm ở tầng khác và nói cho một lần dùng khác

```ts
"centred-page-column": {
    classes: ["mx-auto", "flex", "w-full", "max-w-md", "flex-col", "gap-6"],
    …
    why: "A surface read one control at a time is centred and narrow on purpose: a form that runs the width of a desktop screen makes the eye travel between a label and the box it names.",
}
```

Đây đúng là một lý do hợp lệ theo `L7-2`, và nó được viết rất rõ. Chỉ có điều nó là lý do của
contract, và contract ấy còn phục vụ route `/authentication`, nơi cùng cái panel này đứng một mình
bên trong `authentication-panel-card` mà không có shell nào bọc.

Trong overlay thì `xs` của shell là `max-w-xs`, tức `20rem`, còn cái trần của contract là `28rem`.
Trần ấy không bao giờ chạm tới. Người đọc gặp một panel hẹp hơn hai nấc so với con số mà câu giải
thích duy nhất đang giải thích.

Neo: `…\contracts\index.ts:1747` và `:1758`; lần dùng ngoài overlay ở `…\contracts\index.ts:758-761`,
nơi `authentication-panel-card` cũng mang `max-w-md` một lần nữa.

### Trông giống nhưng không phải `L7-2`

`CheckoutOverlay` cũng có biểu mẫu ở trong, nhưng thứ quyết định chiều rộng của nó không phải cái
biểu mẫu mà là bảng tiền bên dưới. Đọc `readerTask` theo thành phần dễ thấy nhất sẽ ra `L7-2` và một
con số hẹp hơn cần thiết. Đọc theo việc người ta thật sự làm trong panel thì ra `L7-3`.

---

## `L7-3` — một cột số đọc theo dòng

### Trường hợp: lý do duy nhất được viết ngay cạnh giá trị

```tsx
/**
 * `sm` RATHER THAN `xs`, because the body is a reckoning read line by line - a label and an amount
 * per row - and at `xs` the amounts wrap under their labels, which is the moment the column stops
 * being a column.
 */
```

Câu này làm được ba việc mà một lý do phải làm. Nó nêu giá trị. Nó nêu giá trị bị loại. Và nó nêu cái
gì hỏng ở giá trị bị loại, tức là nó nói được điều gì xảy ra khi lùi một nấc. Một lý do nói được như
thế là một phép đo, còn một lý do không nói được thì mới là một lựa chọn.

Neo: `…\overlays\courses\CoursePriceOverlay\component.tsx:20-22`, và giá trị nó giải thích ở `:41`.

### Trường hợp: cùng dạng nội dung, cùng giá trị, không có lý do

```tsx
<ModalShell
    isOpen={input.props.isOpen}
    size="sm"
    onDismiss={input.on?.dismiss ?? (() => undefined)}
>
```

`CheckoutOverlay` mở ở `sm` và ruột của nó cũng là một bảng nhãn với số, gồm lịch trả góp và phần
tổng kết đơn hàng. Kết quả render đúng theo `L7-3`. Phần thiếu là ba mươi chữ lẽ ra phải nằm trong
khối chú thích đầu file, nơi đã có sẵn bốn đoạn nói về những quyết định khác của cùng overlay này.

Neo: `…\overlays\commerce\CheckoutOverlay\component.tsx:121`, khối chú thích ở `:14-34`.

### Trông giống nhưng không phải `L7-3`

Một danh sách các dòng chỉ có chữ, không có cột số bên phải, thì không rơi vào mã này. `CartDrawer`
có danh sách dòng nhưng nó nằm trên `DrawerShell`, nên nó không khai được chiều rộng nào và rơi
xuống `L7-7`.

---

## `L7-4` — làm việc trên nhiều vùng cùng lúc

### Trường hợp sống: Global Search mở ở `cover`

```tsx
<ModalShell isOpen={isOpen} size="cover" onDismiss={() => on?.dismiss?.()}>
    <Tree contract="global-search-workspace" …/>
</ModalShell>
```

Neo: `…\overlays\search\GlobalSearchOverlay\component.tsx:193`.

### Trường hợp: cái mà `cover` mua được, đã hoá thành mã

```ts
"global-search-body": {
    classes: ["flex", "min-w-0", "flex-col", "gap-4", "md:flex", "md:flex-row", "md:items-start", "md:gap-8",
        "md:[&>[data-component=SelectionList][data-variant=scopes]]:w-72", …
        "md:[&>[data-node=global-search-result-region]]:grow", …
        "md:[&>[data-node=global-search-context-card]]:w-72", …],
    children: { scopes: {…}, results: {…}, context: {…} },
    why: "The scope ListBox, result region and selected render stay visible together on desktop. …",
}
```

Câu `why` này là dòng bác `:260` đã hoá thành mã. Dòng ấy loại hai direction hẹp vì "chưa dùng đủ
chiều rộng để đổi nhóm và xem ngữ cảnh đồng thời", và ba vùng ở đây đúng là nhóm, kết quả và ngữ
cảnh, xếp cạnh nhau từ `md:` trở lên.

Khai `cover` thì phải gọi tên được ba vùng như vậy. Không gọi tên được thì chưa có gì chứng minh cần
tới `cover`, và plan quay về `L7-1` để chọn lại.

Neo: `…\contracts\index.ts:2857-2864`.

### Trường hợp: contract gốc của cover không khai chiều rộng nào

```ts
"global-search-workspace": {
    classes: ["flex", "min-w-0", "flex-col", "gap-4"],
    children: { query: { leaf: "search-command-field" }, body: { contract: "global-search-body" } },
    …
}
```

Không `max-w`, không `w-`, không padding. Bề ngang do shell giữ, phần đệm cũng do shell viết vì
`size="cover"`, và cả hai chuyện ấy có đúng một chủ.

Neo: `…\contracts\index.ts:2849-2855` và `…\shells\ModalShell\index.tsx:40`.

### Trông giống nhưng không phải `L7-4`

Ba cột `w-72 / grow / w-72` bên trong `global-search-body` **không** phải phát biểu của mã này. Đó là
[`L10`](../l10-region-width-belongs-to-its-owner/INDEX.md), và chính `L10` đã ghi contract này vào
danh sách sáu chủ hàng phát chiều rộng cho con. `L7` chỉ nói cái panel mở rộng tới đâu; chia phần bên
trong là việc của luật kia, kể cả khi một plan viết cả hai trong cùng một lần.

---

## `L7-5` — lý do nói về loại vật thì bị từ chối

### Trường hợp: chính dòng bác

| Rejected | Instead | Why |
|---|---|---|
| Giả định modal phải hẹp/gọn | Search workspace lớn có sidebar và context pane | Thầy ưu tiên dễ thao tác, không bắt modal hẹp |

Cái bị bác ở đây không phải một con số mà là một giả định, tức là bác ở tầng lý do chứ không ở tầng
giá trị. Đó là lý do mã này phát ra một lời từ chối thay vì phát ra một con số khác.

Neo: `.workflows\designs\starci-academy\global-search-modal-20260815.md:259`.

### Trường hợp: bác lần thứ hai, và lần này bằng việc người đọc không làm được gì

| Rejected | Instead | Why |
|---|---|---|
| A/B làm final direction | C · Search workspace | Chưa dùng đủ chiều rộng để đổi nhóm và xem ngữ cảnh đồng thời |

Hai dòng đứng liền nhau trong cùng phase `## plan r2`. Dòng trên gỡ cái mặc định, dòng dưới đặt vào
chỗ trống ấy một cách phán khác, và cách phán ấy là đọc xem trong panel người ta phải làm gì.

Neo: cùng hồ sơ, `:260`.

### Trông giống nhưng không phải `L7-5`

"Panel này hẹp hơn panel kia vì nó chỉ có một cột điều khiển còn panel kia có một cột số" nghe như
đang so sánh hai overlay, nhưng nó đang so sánh hai loại nội dung. Đó là một lý do hợp lệ của `L7-2`
đối chiếu với `L7-3`, không phải một lần chép giá trị.

---

## `L7-6` — im lặng không phải là một lời khai

### Chưa có ví dụ sống

Không overlay nào trong repo đang ở `md`, và không overlay nào đang ở `lg`. Nghĩa là mã này chưa có
lần chạy nào để đọc, và nó được phát biểu từ hành vi của shell chứ không từ một màn hình.

Cách khai đúng khi gặp: viết `md` ra thành chữ kèm lý do của nó, đừng bỏ trống `size`. Hai cách cho
ra cùng một pixel và khác nhau ở chỗ người đọc plan có biết là đã cân nhắc hay không.

### Trông giống nhưng không phải `L7-6`

Bỏ trống `size` rồi ghi trong bản ghi thiết kế rằng "dùng mặc định" cũng không đủ, vì lý do vẫn không
nằm cạnh giá trị, và ở đây thì cả giá trị cũng không nằm trong mã. Người sửa sau này mở file ra sẽ
thấy một lời gọi shell không có tham số nào và không có gì để đọc.

---

## `L7-7` — drawer và dropdown chưa khai được

### Trường hợp: shell drawer không có `size`

```tsx
export type DrawerShellPlacement = "left" | "right" | "bottom"

export type DrawerShellProps = {
    readonly isOpen: boolean
    readonly placement?: DrawerShellPlacement
    readonly title: string
    …
}
```

Không có prop nào về bề ngang. Thứ duy nhất khai được là cạnh mở, và vắng mặt thì shell quy về
`right`.

Neo: `…\shells\DrawerShell\index.tsx:33`, `:40`, `:62`.

### Trường hợp: một drawer không khai gì cả

```tsx
<DrawerShell
    isOpen={input.props.isOpen}
    title={labels.title}
    onDismiss={input.on?.dismiss ?? (() => undefined)}
>
```

`CartDrawer` không truyền `placement`, nên nó nhận cạnh phải của vendor, và bề ngang của nó hoàn toàn
do vendor quyết. Không có chỗ nào trong repo sống phán về con số đó.

Neo: `…\overlays\commerce\CartDrawer\component.tsx:116-120`.

### Trường hợp: khai theo viewport, nhưng khai cạnh chứ không khai bề ngang

```tsx
placement: typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches ? "bottom" : "right",
```

Đây là chỗ dễ đọc nhầm nhất của mã này. Có một media query, có hai nhánh theo màn rộng màn hẹp, nên
trông như một quyết định về chiều rộng. Nó là quyết định về cạnh mở, và cái panel rộng bao nhiêu ở
mỗi nhánh thì vẫn là của vendor.

Neo: `…\overlays\ai\StarCiAiDrawer\index.tsx:19`, kiểu ở `…\StarCiAiDrawer\component.tsx:10`, lời gọi
ở `…\StarCiAiDrawer\component.tsx:27-32`.

### Trường hợp: dropdown cũng vậy

```tsx
export type DropdownShellPlacement = "bottom left" | "bottom right" | "top left" | "top right"
```

`DropdownShell` chỉ nhận `placement`, và hai call site của nó là `…\blocks\auth\AccountMenu\component.tsx:59`
với `…\blocks\locale\LanguageMenu\component.tsx:25`. Không chỗ nào khai bề ngang.

Neo: `…\shells\DropdownShell\index.tsx:6`.

### Trông giống nhưng không phải `L7-7`

Viết `w-96` vào `classes` của `cart-drawer-column` để "cho drawer rộng ra". Đó không phải cách đi vòng
qua mã này mà là cách tạo ra một chủ thứ hai cho một số đo mà shell đang giữ, và không rule nào nhìn
thấy nó. Đúng cùng một hình dạng với cái viền tự sơn mà
[`L6-6`](../l6-overlay-is-already-a-surface/INDEX.md) đã từ chối.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "modal rộng ra đi cho dễ thao tác" | `L7-1` | hỏi người đọc làm gì trong đó trước, rồi mới chọn nấc |
| "cái form đăng nhập để hẹp thôi" | `L7-2` | hợp lệ, nhưng phải nói được cái gì hỏng khi rộng hơn |
| "số tiền bị xuống dòng dưới nhãn" | `L7-3` | đúng ngưỡng mà `CoursePriceOverlay` đã ghi lại |
| "muốn vừa đổi nhóm vừa xem chi tiết" | `L7-4` | `cover`, và gọi tên những vùng phải cùng nhìn thấy |
| "modal thì hẹp cho gọn" | `L7-5` | từ chối lý do, trả câu hỏi về cho thầy |
| "để mặc định là được" | `L7-6` | mặc định là `md`; viết nó ra thành chữ |
| "drawer giỏ hàng rộng quá" | `L7-7` | không biểu diễn được, ghi `owed` |
| "cột ngữ cảnh bên phải rộng bao nhiêu" | không phải mã này | chia phần bên trong là `L10` |
| "trong modal thêm một card cho gọn" | không phải mã này | ranh giới bên trong là `L6` |
