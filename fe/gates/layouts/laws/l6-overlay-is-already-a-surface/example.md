---
id: fe-layouts-laws-l6-overlay-is-already-a-surface-example
title: example.md
slug: /gates/layouts/laws/l6-overlay-is-already-a-surface/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của sáu mã L6-N, đọc thẳng từ sáu overlay đang sống.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l6-overlay-is-already-a-surface` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`.
Không có ví dụ bịa: một mã không có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

Toàn bộ tầng overlay của repo sống gồm sáu thư mục dưới `src/components/overlays/`:
`ai/StarCiAiDrawer`, `auth/SignInOverlay`, `commerce/CartDrawer`, `commerce/CheckoutOverlay`,
`courses/CoursePriceOverlay` và `search/GlobalSearchOverlay`. Cả sáu file component đều được đọc để
viết tài liệu này.

---

## `L6-1` — ruột là region phẳng

### Trường hợp: shell giữ ranh giới, ruột đi thẳng qua

```tsx
<Modal.Dialog
    data-tier="shell"
    data-component="ModalShell"
    className={input.size === "cover" ? "p-4" : undefined}
>
    <Modal.CloseTrigger />
    <Modal.Body className="p-0">{input.children}</Modal.Body>
</Modal.Dialog>
```

`Modal.Dialog` là mặt phẳng, `Modal.Body` là một cái lỗ không diễn giải gì. Overlay nhận được một
vật đã có mép, đã có nút đóng, và không có lớp đệm thừa nào để một card bám vào.

Neo: `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:37-43`.

### Trường hợp: overlay ghi lý do ngay cạnh quyết định

```tsx
/**
 * IT MOUNTS NO SURFACE BRANCH - canon VENDOR-8. The covering surface is already the bounded object;
 * a `SurfaceCard` inside it would draw a second border and a second inset around a body that is
 * already framed.
 */
```

`CartDrawer` viết gần như y hệt câu đó, và nói rõ nó chép lại rule bên cạnh cùng một quyết định.
Hai chỗ duy nhất trong toàn bộ `overlays/` mà chữ `SurfaceCard` xuất hiện chính là hai comment này.

Neo: `…\overlays\courses\CoursePriceOverlay\component.tsx:13-15` và
`…\overlays\commerce\CartDrawer\component.tsx:20-22`.

### Trông giống nhưng không phải `L6-1`

Một overlay mount `ContractContent` thay vì `Tree` không phải một biến thể của `L6-1`.
`SignInOverlay` làm thế vì `VENDOR-12` bắt auth projection có đúng một host không đệm, và đó là
chuyện chủ host chứ không phải chuyện ranh giới. Cả hai cách đều khai `buildsCardInside: false`.

---

## `L6-2` — panel đã tự xưng tên

### Trường hợp: drawer đặt tên ở header của nhà cung cấp

```tsx
<Drawer.Header>
    <Drawer.Heading>{input.title}</Drawer.Heading>
</Drawer.Header>
<Drawer.CloseTrigger />
<Drawer.Body className="p-0">{input.children}</Drawer.Body>
```

`title` là prop bắt buộc của `DrawerShell`, nên không có đường nào mở một drawer mà không đặt tên
cho nó.

Neo: `D:\Repositories\starci-academy-fe\src\components\shells\DrawerShell\index.tsx:64-73`.

### Trường hợp: ruột không nói lại cái tên đó

`CartDrawer` ghi thẳng ở đầu file rằng nó không giữ tiêu đề nào, vì một tiêu đề thứ hai bên trong sẽ
gọi tên đúng cái thứ người đọc vừa mở, hai lần. `why` của `cart-drawer-column` nói lại cùng một
điều bằng ngôn ngữ của contract.

Neo: `…\overlays\commerce\CartDrawer\component.tsx:24-25` và
`…\src\components\contracts\index.ts:2561`.

### Ngoại lệ: modal không tự xưng tên, nên ruột giữ tiêu đề

```ts
"course-price-detail-stack": {
    classes: ["flex", "flex-col", "gap-4", "p-6"],
    children: { title: { leaf: "heading" }, reckoning: {…}, notice: {…}, reason: {…}, forward: {…} },
    …
}
```

`ModalShell` chỉ dựng `Modal.CloseTrigger` chứ không có header nào, nên slot `title` ở đây là hợp
lệ và bắt buộc phải có. Ai đọc `L6-2` thành "trong overlay không được có tiêu đề" sẽ xoá đúng cái
tiêu đề duy nhất mà bảng giá này có.

Neo: `…\contracts\index.ts:2164-2167` và `…\shells\ModalShell\index.tsx:42`.

### Trông giống nhưng không phải `L6-2`

Một `ChoiceTabs` ở đầu `checkout-panel-column` trông như một hàng tiêu đề nhưng không phải: nó là
điều khiển chọn cách trả tiền, tức là phần đầu tiên của quyết định chứ không phải tên của panel.
Bỏ nó đi thì người đọc mất một lựa chọn, còn bỏ một tiêu đề trùng thì không mất gì.

---

## `L6-3` — phần đệm viết đúng một lần

### Trường hợp: sáu overlay, hai cách đệm, mỗi cái đúng một chủ

| Overlay | Contract gốc | Phần đệm ở đâu |
|---|---|---|
| `CartDrawer` | `cart-drawer-column` | contract, `p-4` |
| `CheckoutOverlay` | `checkout-panel-column` | contract, `p-6` |
| `CoursePriceOverlay` | `course-price-detail-stack` | contract, `p-6` |
| `GlobalSearchOverlay` | `global-search-workspace` | shell, `p-4` trên dialog vì `size="cover"` |
| `StarCiAiDrawer` | `starci-ai-drawer-column` | không ai đệm; cột `flex` trần |
| `SignInOverlay` | `centred-page-column` | không ai đệm; xem trường hợp ngay dưới |

`why` của ba contract đầu nói ra lý do bằng cùng một mệnh đề: chúng tự mang lớp đệm vì cái shell
chúng đứng trong đó chuyển ruột đi thẳng qua mà không sắp xếp và không đệm.

Neo: `…\contracts\index.ts:2530`, `…\contracts\index.ts:2554`, `…\contracts\index.ts:2165`,
`…\contracts\index.ts:2850`, `…\contracts\index.ts:2742`, `…\shells\ModalShell\index.tsx:40`.

### Trông giống nhưng không phải `L6-3`

`centred-page-column` không khai padding, và đó **không** phải một chỗ thiếu chủ. `VENDOR-12` khai
auth projection có đúng một host không đệm, nên ở đây "không ai đệm" là câu trả lời đã được phán
chứ không phải câu hỏi chưa ai hỏi. Giá trị thật mà người đọc nhìn thấy trên màn hình thì chưa đo
được, vì chưa có lần render nào.

---

## `L6-4` — một vật bên trong có thật

### Trường hợp sống: cột giữa của Global Search

```tsx
list: input.props.items.length === 0 ? undefined : defineContractProjection("global-search-surface-list", () => (
    <SurfaceListCard
        contract="global-search-surface-list"
        render={ResultsList}
        props={{ ...input.props, isNested: true, isLabelHidden: true }}
        on={input.on}
        isLoading={input.isLoading}
    />
)),
```

File này là `src/components/blocks/search/GlobalSearchResults/component.tsx`, tức tầng block, không
phải tầng overlay. Đó là điều kiện thứ ba của `L6-4` và nó có mặt ở đây theo đúng nghĩa đen của
đường dẫn.

Contract đi kèm khai một danh sách dính liền chứ không phải một cái card thứ hai:

```ts
"global-search-surface-list": {
    classes: ["min-w-0", "overflow-hidden", "divide-y", "divide-separator", "p-0"],
    children: { list: { leaf: "selection-list", repeats: true, restingCount: 1 } },
    why: "Global Search results share one label-less nested SurfaceListCard; …",
}
```

Neo: `…\blocks\search\GlobalSearchResults\component.tsx:63-66` và `…\contracts\index.ts:2874-2879`.

### Trường hợp: mặt còn lại của cùng quyền

```tsx
notice: input.props.items.length > 0 ? undefined : defineCompositeComponent("empty-notice", {}, () => (
    <EmptyNotice props={{ icon: "search", message: input.props.emptyMessage, … }} on={{ act: input.on?.recover }} />
)),
```

Rỗng **thay** cả mặt phẳng danh sách chứ không ngồi bên trong nó. `why` của
`global-search-result-region` nói đúng như vậy.

Neo: `…\blocks\search\GlobalSearchResults\component.tsx:71-78` và `…\contracts\index.ts:2872`.

### Ngoại lệ: nó được ghim bằng test, không bằng văn xuôi

```tsx
expect(document.querySelector("[data-node=\"global-search-result-region\"] [data-component=\"SurfaceListCard\"] [data-component=\"SelectionList\"]")).toBeTruthy()
expect(document.querySelector("[data-component=\"SurfaceListCardSurface\"][data-surface-context=\"nested\"]")).toBeTruthy()
```

Hai dòng này nằm trong test của chính overlay, nên nếu ai gỡ mặt phẳng lồng đi thì test đỏ. Đây là
chỗ duy nhất trong toàn bộ luật có một cái máy giữ, và nó giữ **ngoại lệ** chứ không giữ luật.

Neo: `…\overlays\search\GlobalSearchOverlay\component.test.tsx:57-58`.

---

## `L6-5` — trông như panel mà không phải

### Trường hợp: một khoá kết thúc bằng `-card` không dựng mặt phẳng nào

```ts
"global-search-context-card": {
    classes: ["hidden", "min-w-0", "flex-col", "gap-3", "p-4", "md:flex"],
    children: {
        title: { leaf: "text", props: { size: "sm", weight: "medium" } },
        kind: { leaf: "text", props: { size: "xs", tone: "muted" } },
        snippet: { leaf: "text", props: { size: "sm" }, optional: true },
        status: { leaf: "badge", optional: true },
        action: { leaf: "button", optional: true },
    },
    …
}
```

Không `border`, không `rounded`, không `shadow`, không nền. Năm slot leaf và một lớp đệm. Cái tên
mô tả vai trò mà vùng này đóng cho người đọc, và vai trò không phải là ranh giới.

Neo: `…\contracts\index.ts:2881-2890`.

### Trông giống nhưng không phải `L6-4`

Cột ngữ cảnh có tên, có padding, có nhóm nội dung riêng, nên rất dễ bị đọc thành một vật lồng hợp
lệ. Nó trượt ở điều kiện đầu tiên: tiêu đề, loại, trích đoạn, trạng thái và nút là năm phần **khác
loại** của một lời phát biểu, không phải một tập thành viên đồng hạng. Hồ sơ thiết kế bác cách đọc
đó hai lần trong cùng một record, một dòng tiếng Việt và một dòng tiếng Anh, và bản tiếng Anh gọi
thẳng tên vùng context khi nói cái gì đứng thay chỗ card bị bỏ.

---

## `L6-6` — từ chối và ghi nợ

### Chưa biểu diễn được

Chưa có chỗ nào trong repo sống cần một vật bounded không-phải-danh-sách bên trong overlay, nên mã
này chưa có ví dụ đang chạy. Nếu gặp, cách xử lý là ghi vào `owed` và dừng: chỉ `SurfaceListCard`
khai `isNested`, nên lời khai không tồn tại để mà viết ra.

### Trông giống nhưng không phải `L6-6`

Tự viết `rounded-xl border` vào `classes` của một contract chỉ dùng trong overlay. Đó không phải
cách đi vòng qua mã này mà là cách tạo ra một chủ sở hữu thứ hai vô hình: rule
`no-surface-branch-in-overlay` chỉ đọc câu lệnh `import`, nên một cái viền viết bằng class sẽ đi
qua mà không ai báo.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "modal này thêm card cho gọn" | `L6-1` | overlay đã là mặt phẳng |
| "cái drawer thiếu tiêu đề" | `L6-2` | shell đã đặt tên; kiểm `title` trước khi thêm |
| "bên trong sát mép quá / thừa khoảng trắng" | `L6-3` | tìm hai chủ phần đệm, bỏ một |
| "trò render SurfaceListCard ở giữa chứ" | `L6-4` | phải do block khai, kèm `isNested` và tên chủ ngoài |
| "cái pane bên phải bo góc lại cho giống card" | `L6-5` | tên là nhãn của vùng; đọc `classes` |
| "cho form này vào một khung riêng trong modal" | `L6-6` | không biểu diễn được, ghi `owed` |
| "modal rộng ra" | không phải mã này | chiều rộng là `L7` |
