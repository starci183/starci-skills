---
id: fe-principles-text-expansion-example
title: example.md
slug: /fe/principles/text-expansion/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã EXPANSION-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `text-expansion` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Các chuỗi trong ví dụ được viết ra ở **nhiều ngôn ngữ thật**, vì đây là mô-đun duy nhất mà một ví dụ
chỉ có một ngôn ngữ **không chứng minh được gì**. `t("…")` trong ví dụ là một hàm tra danh mục bất
kỳ; điều đáng đọc là **hình dạng của lời gọi**, không phải tên hàm.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một mã duy nhất.

---

## `EXPANSION-0` — đoạn liền mạch giống hệt ở mọi ngôn ngữ

### Trường hợp: đuôi tệp trong danh sách tài liệu

```tsx
<span className="rounded border px-1.5 py-0.5 text-xs font-medium uppercase">PDF</span>
```

Không có `min-w`, không có dải nở, vì tập giá trị đóng: `PDF`, `CSV`, `DOCX`, `PNG`. Bật thêm ngôn
ngữ thứ năm cũng không sinh ra một hình dạng ký tự nào mới.

### Trường hợp: mã trạng thái trong log kỹ thuật

```tsx
<ul className="divide-y rounded-lg border">
  <li className="flex items-center gap-3 p-3">
    <span className="w-12 shrink-0 text-xs font-medium tabular-nums">404</span>
    <span className="min-w-0 truncate text-sm">/api/orders/8891</span>
  </li>
</ul>
```

`w-12` ở đây **được phép** đo cứng: mọi giá trị chảy qua ô đó đều là ba chữ số. Cũng con số `w-12`
ấy đặt dưới một nhãn dịch được thì là lỗi — xem `EXPANSION-2`.

### Trường hợp: phím tắt

```tsx
<kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>
```

### Trường hợp: cột mã ISO trong bảng chọn tiền tệ

```tsx
<div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
  <span className="font-mono text-sm">VND</span>
  <span className="min-w-0 truncate text-sm">{t("currency.vnd.name")}</span>
</div>
```

Cột trái đo cứng vì mã ISO luôn ba ký tự. Cột phải là **tên** tiền tệ, có bản dịch, nên nó lấy
`minmax(0,1fr)` chứ không lấy một con số.

### Trường hợp: số hiệu phiên bản trong phần cuối

```tsx
<span className="font-mono text-xs text-neutral-500">v2.4.1</span>
```

### Ngoại lệ và nhầm lẫn

- **Có một chữ dịch được đứng cạnh thì cụm không còn là `EXPANSION-0`.** Phải tách hai mã, đúng như
  luật một quyết định một đoạn liền mạch:

  ```tsx
  {/* SAI — đo cứng cả cụm theo bản tiếng Anh "PDF file" */}
  <span className="w-20 whitespace-nowrap text-sm">{t("file.pdf")} </span>

  {/* ĐÚNG — chữ nở tự do, token giữ nguyên */}
  <span className="inline-flex w-auto items-center gap-1.5 whitespace-normal text-sm">
    <span>{t("file.label")}</span>
    <span className="font-mono uppercase">pdf</span>
  </span>
  ```

- **Đơn vị đo thường KHÔNG phải `EXPANSION-0`.** `MB` bất biến, nhưng `phút`, `bài`, `mục` thì dịch
  được và nở:

  ```tsx
  {/* SAI */}  <span className="w-16">{count} mins</span>
  {/* ĐÚNG */} <span className="w-auto whitespace-normal">{t("duration.minutes", { count })}</span>
  ```

- **Thư điện tử dài không làm nó rời `EXPANSION-0`.** Thư điện tử không đổi theo ngôn ngữ. Việc nó tràn là quyết
  định của mô-đun cắt/tràn, không phải lý do gán mã nở khác:

  ```tsx
  <span className="min-w-0 truncate text-sm text-neutral-500">nguyen.van.an.contact@example.com</span>
  ```

- **Không dịch mã trạng thái, mã lỗi, tên miền.** Dịch chúng là làm hỏng thứ mà người dùng dùng để
  tìm kiếm và để báo lỗi.

---

## `EXPANSION-1` — một đoạn liền mạch dịch được, hộp của chính nó phải nuốt

### Trường hợp: nút chính — chuỗi nguồn 4 ký tự, dải nở 100–200%

```tsx
<button className="w-auto whitespace-normal rounded-md bg-neutral-900 px-4 py-2 text-sm text-white" type="submit">
  {t("action.save")}
</button>
```

`Save` · `Lưu` · `Speichern` · `Enregistrer` · `حفظ`. Bản dài nhất gấp gần ba lần bản nguồn, nên bất
kỳ con số nào đặt vào chỗ bề rộng đều là con số của một ngôn ngữ.

### Trường hợp: cặp nút trong hộp thoại, cho phép xuống dòng khi hẹp

```tsx
<div className="flex flex-wrap items-center justify-end gap-2">
  <button className="w-auto whitespace-normal rounded-md border px-4 py-2 text-sm" type="button">
    {t("action.cancel")}
  </button>
  <button className="w-auto whitespace-normal rounded-md bg-neutral-900 px-4 py-2 text-sm text-white" type="submit">
    {t("action.confirm")}
  </button>
</div>
```

`Cancel / Confirm` là 6 và 7 ký tự; `Abbrechen / Bestätigen` là 9 và 10. `flex-wrap` là chỗ phần dài
thêm đi vào, thay vì đẩy một nút ra khỏi hộp thoại.

### Trường hợp: mục trình đơn có biểu tượng dẫn đầu và phím tắt đuôi

```tsx
<button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm" type="button">
  <svg aria-hidden="true" className="size-4 shrink-0" />
  <span className="min-w-0 whitespace-normal">{t("menu.duplicateItem")}</span>
  <kbd className="ms-auto shrink-0 font-mono text-xs text-neutral-500">⌘D</kbd>
</button>
```

Chỉ **một** phần của hàng này được phép nở, và nó được nêu tên rõ ràng. Biểu tượng và phím tắt là
`EXPANSION-0` nên `shrink-0`; nhãn là `EXPANSION-1` nên nó nhận phần dài thêm.

### Trường hợp: nhãn nhỏ lọc — cả hàng phải xuống dòng được

```tsx
<div className="flex flex-wrap items-center gap-2">
  {filters.map((filter) => (
    <button className="w-auto whitespace-normal rounded-full border px-3 py-1 text-sm" key={filter.id} type="button">
      {t(filter.labelKey)}
    </button>
  ))}
</div>
```

### Trường hợp: trạng thái rỗng

```tsx
<div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
  <p className="w-auto max-w-[46ch] whitespace-normal font-medium">{t("orders.empty.title")}</p>
  <p className="w-auto max-w-[46ch] whitespace-normal text-sm text-neutral-500">{t("orders.empty.body")}</p>
</div>
```

Trần đọc theo `ch` đúng ở mọi ngôn ngữ vì nó đo theo **ký tự**, không theo điểm ảnh của một phông chữ một
ngôn ngữ.

### Trường hợp: nút chỉ có biểu tượng — đoạn liền mạch vẫn tồn tại, chỉ là không nhìn thấy

```tsx
<button aria-label={t("action.archive")} className="rounded-md border p-2" title={t("action.archive")} type="button">
  <svg aria-hidden="true" className="size-4" />
</button>
```

Không có chữ hiện ra **không** xoá tình huống. Tên trợ năng là đoạn liền mạch dịch được, và cái chú giải mà nó
sinh ra là một hộp `EXPANSION-1` thật sự trên màn hình.

### Trường hợp: nhãn thẻ tab — nở theo chiều dọc thay vì tràn ngang

```tsx
<div className="flex flex-wrap items-center gap-1 border-b" role="tablist">
  <button className="w-auto whitespace-normal border-b-2 px-3 py-2 text-sm" role="tab" type="button">
    {t("tab.overview")}
  </button>
  <button className="w-auto whitespace-normal border-b-2 border-transparent px-3 py-2 text-sm" role="tab" type="button">
    {t("tab.paymentMethods")}
  </button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **`whitespace-nowrap` trên đoạn liền mạch dịch được là lỗi**, kể cả khi hôm nay nó vừa:

  ```tsx
  {/* SAI */}  <button className="w-24 whitespace-nowrap">{t("action.undo")}</button>
  {/* ĐÚNG */} <button className="w-auto whitespace-normal">{t("action.undo")}</button>
  ```

  `Undo` bốn ký tự, `Rückgängig` mười. `w-24` cắt mất một nửa nghĩa của nút.

- **`truncate` trên nhãn điều khiển là lỗi.** Cắt một câu là mất một phần thông tin; cắt tên một nút
  là mất **chính cái tên** — người dùng không còn biết bấm vào thì xảy ra chuyện gì:

  ```tsx
  {/* SAI */}  <button className="w-32 truncate">{t("action.addToCart")}</button>
  ```

  `In den Warenkorb` cắt còn `In den Waren…` không phải một nhãn ngắn hơn, nó là một nhãn khác.

- **Rút gọn bản dịch cho vừa hộp là đảo ngược luật.** Yêu cầu "dịch ngắn lại đi" là lấy cái nút làm
  chuẩn cho ngôn ngữ.
- **Không đo hộp theo bản CJK.** `保存` hai ký tự không phải căn cứ để thu nút lại.
- **Khung chờ giữ nguyên mã.** Ô xám thay chỗ một nhãn dịch được vẫn phải nở được như nhãn thật, nếu
  không thì bố cục nhảy đúng vào lúc dữ liệu về.

---

## `EXPANSION-2` — một cột dùng chung cho nhiều đoạn liền mạch

### Trường hợp: biểu mẫu hai cột — cột nhãn suy ra từ nội dung

```tsx
<div className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3">
  <label className="text-sm font-medium" htmlFor="name">{t("field.fullName")}</label>
  <input className="rounded-md border px-3 py-2" id="name" />
  <label className="text-sm font-medium" htmlFor="tax">{t("field.taxIdentificationNumber")}</label>
  <input className="rounded-md border px-3 py-2" id="tax" />
</div>
```

`max-content` là **quyết định**: cột rộng bằng nhãn dài nhất **của ngôn ngữ đang hiển thị**, và nó tự đo
lại ở mọi ngôn ngữ. Một con số gõ tay chỉ đo lại được khi có người nhớ ra phải đo lại.

### Trường hợp: cùng bố cục đó, xuống một cột khi nhãn quá dài

```tsx
<div className="grid gap-3 sm:grid-cols-[minmax(8rem,max-content)_minmax(0,1fr)] sm:items-baseline sm:gap-x-4">
  <label className="text-sm font-medium" htmlFor="ref">{t("field.reference")}</label>
  <input className="rounded-md border px-3 py-2" id="ref" />
</div>
```

`minmax(8rem, max-content)` là sàn cộng trần: sàn để các nhãn ngắn vẫn thẳng hàng, `max-content` để
nhãn dài không bị ép.

### Trường hợp: phần đầu bảng — mỗi ô là một đoạn liền mạch dịch được

```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b text-start">
      <th className="min-w-fit px-3 py-2 text-start font-medium">{t("table.orderReference")}</th>
      <th className="min-w-fit px-3 py-2 text-start font-medium">{t("table.customerName")}</th>
      <th className="min-w-fit px-3 py-2 text-end font-medium">{t("table.amountDue")}</th>
    </tr>
  </thead>
</table>
```

### Trường hợp: thanh bên điều hướng — bề rộng phục vụ mọi mục cùng lúc

```tsx
<nav className="flex w-fit min-w-48 max-w-64 flex-col gap-1">
  <a className="rounded-md px-3 py-2 text-sm" href="#a">{t("nav.dashboard")}</a>
  <a className="rounded-md px-3 py-2 text-sm" href="#b">{t("nav.paymentMethods")}</a>
  <a className="rounded-md px-3 py-2 text-sm" href="#c">{t("nav.notificationPreferences")}</a>
</nav>
```

`w-fit` giữa một sàn và một trần: điều hướng đo theo mục dài nhất, nhưng không được phép nuốt nửa màn hình
ở một ngôn ngữ nào đó. Trần là quyết định bố cục; con số bên trong sàn–trần **không** đến từ việc đo
một chuỗi.

### Trường hợp: nhóm nút phân đoạn chia đều

```tsx
<div className="flex w-full flex-wrap gap-1 rounded-lg border p-1">
  <button className="min-w-fit grow basis-0 whitespace-normal rounded-md px-3 py-1.5 text-sm" type="button">
    {t("segment.all")}
  </button>
  <button className="min-w-fit grow basis-0 whitespace-normal rounded-md px-3 py-1.5 text-sm" type="button">
    {t("segment.awaitingPayment")}
  </button>
</div>
```

`basis-0 grow` chia đều phần dư; `min-w-fit` là phanh — không nhánh nào bị ép xuống dưới nội dung của
chính nó chỉ vì nhánh kia ngắn hơn.

### Ngoại lệ và nhầm lẫn

- **Con số ra đời sau khi nhìn một bản dịch là dấu hiệu chắc chắn nhất của lỗi này:**

  ```tsx
  {/* SAI — 120px là bề rộng của chữ "Full name" */}
  <div className="grid grid-cols-[120px_1fr] gap-4">…</div>
  ```

- **`grid-cols-3` cho ba nhãn không bằng nhau là chia đều nhầm chỗ.** Chia đều đúng khi các ô **phải**
  bằng nhau, không phải khi chúng tình cờ bằng nhau ở một ngôn ngữ.
- **Thiếu `min-w-0` ở nhánh co được thì cột không co, cả hàng tràn:**

  ```tsx
  {/* SAI */}  <div className="flex"><span className="flex-1">{longRun}</span><span>{badge}</span></div>
  {/* ĐÚNG */} <div className="flex"><span className="min-w-0 flex-1">{longRun}</span><span className="shrink-0">{badge}</span></div>
  ```

- **Cột toàn `EXPANSION-0` thì được đo cứng.** Đây là ngoại lệ duy nhất, và nó phải đúng với **mọi**
  giá trị chảy qua cột, không chỉ với các giá trị hôm nay.

---

## `EXPANSION-3` — một câu bị ghép từ nhiều mảnh

### Trường hợp: câu có số — gom thành một đoạn liền mạch

```tsx
{/* SAI — trật tự bị đóng cứng, và ở RTL các mảnh hiện ra ngược */}
<p className="text-sm">
  {t("results.showing")} <strong>{shown}</strong> {t("results.of")} <strong>{total}</strong>
</p>

{/* ĐÚNG — người dịch nắm toàn bộ trật tự */}
<p className="text-sm">{t("results.summary", { shown, total })}</p>
```

Câu tiếng Việt "Hiển thị 10 trên 240 kết quả" và câu tiếng Đức "10 von 240 Ergebnissen werden
angezeigt" không cùng thứ tự thành phần. Bản ghép mảnh chỉ dựng được câu đầu.

### Trường hợp: cần in đậm một phần — văn bản gợi ý trả về phần tử

```tsx
<p className="text-sm">
  {t.rich("cart.itemsSelected", {
    count: selectedCount,
    strong: (chunks) => <strong className="font-semibold">{chunks}</strong>,
  })}
</p>
```

Chuỗi trong danh mục giữ cả dấu và cả vị trí: `"Bạn đã chọn <strong>{count}</strong> mục"`. Chỗ in
đậm là một quyết định **thuộc về câu**, nên nó nằm trong câu.

### Trường hợp: câu có liên kết ở giữa

```tsx
<p className="text-sm text-neutral-600">
  {t.rich("terms.notice", {
    link: (chunks) => <a className="underline" href="/terms">{chunks}</a>,
  })}
</p>
```

### Trường hợp: nhiều biến, và trật tự đổi theo ngôn ngữ

```tsx
<p className="text-sm text-neutral-500">
  {t("activity.updatedBy", { name: actor.name, time: formattedTime })}
</p>
```

Tiếng Anh đặt người trước thời gian, nhiều ngôn ngữ khác thì ngược lại. Chỉ khi cả hai biến nằm trong
**một** chuỗi thì người dịch mới đổi được thứ tự đó.

### Trường hợp: nhãn có đơn vị — đơn vị thuộc về câu, không ghép sau số

```tsx
{/* SAI */}
<span className="text-sm">{minutes} {t("unit.minutes")}</span>

{/* ĐÚNG */}
<span className="text-sm">{t("duration.minutes", { count: minutes })}</span>
```

### Ngoại lệ và nhầm lẫn

- **Dấu cách và dấu câu nằm ngoài chuỗi dịch là cùng một lỗi ở dạng nhỏ nhất:**

  ```tsx
  {/* SAI */}  <span>{t("cart.title")} ({count})</span>
  {/* ĐÚNG */} <span>{t("cart.titleWithCount", { count })}</span>
  ```

- **`"item" + (n > 1 ? "s" : "")` là ngữ pháp của một ngôn ngữ áp cho mọi ngôn ngữ.** Xem
  `EXPANSION-6`.
- **Hai đoạn liền mạch cạnh nhau mà mỗi đoạn liền mạch là một câu trọn vẹn thì KHÔNG phải `EXPANSION-3`.** Đó là hai đoạn liền mạch
  `EXPANSION-1`:

  ```tsx
  <div className="flex flex-col gap-1">
    <span className="font-medium">{t("plan.title")}</span>
    <span className="text-sm text-neutral-500">{t("plan.description")}</span>
  </div>
  ```

  Phép thử: bỏ đoạn liền mạch thứ hai đi, đoạn liền mạch thứ nhất có còn là một câu đúng không? Còn ⇒ hai đoạn liền mạch độc lập.

- **Không có class CSS nào sửa được mã này.** Thêm `whitespace-normal` vào một câu ghép mảnh chỉ làm nó
  xuống dòng đúng chỗ sai.

---

## `EXPANSION-4` — hình học phải lật khi RTL

### Trường hợp: hàng có biểu tượng dẫn đầu

```tsx
<li className="flex items-center gap-3 border-s-2 ps-3 pe-4 py-2">
  <svg aria-hidden="true" className="size-4 shrink-0" />
  <span className="min-w-0 truncate text-sm">{t("nav.notificationPreferences")}</span>
</li>
```

`ps`/`pe` và `border-s` mô tả **trước** và **sau** theo dòng chữ, nên cùng một mã đánh dấu dựng đúng cả hai
chiều mà không cần nhánh riêng.

### Trường hợp: mũi tên quay lại — hình dạng ký tự chỉ hướng di chuyển

```tsx
<button className="inline-flex items-center gap-2 text-sm" type="button">
  <svg aria-hidden="true" className="size-4 rtl:-scale-x-100" />
  {t("action.back")}
</button>
```

Mũi tên này nói "lùi lại trong lịch sử điều hướng". Ở RTL, "lùi" nằm bên phải, nên hình dạng ký tự phải soi
gương theo, nếu không nó chỉ ngược chiều với chính hành động của nó.

### Trường hợp: ngăn trượt neo mép đầu dòng

```tsx
<aside className="fixed inset-y-0 start-0 w-80 border-e bg-white p-4">
  <h2 className="text-start font-medium">{t("panel.filters")}</h2>
</aside>
```

### Trường hợp: nhãn trạng thái đếm ở góc ảnh đại diện

```tsx
<div className="relative w-fit">
  <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  <span className="absolute -top-1 -end-1 rounded-full bg-red-600 px-1.5 text-xs text-white tabular-nums" dir="ltr">
    12
  </span>
</div>
```

Vị trí nhãn trạng thái lật (`-end-1`), còn con số bên trong thì không (`dir="ltr"`). Đây là `EXPANSION-4` và
`EXPANSION-5` nằm trên cùng một phần tử vì chúng trả lời **hai câu hỏi khác nhau**: một cái về chỗ,
một cái về chiều của chữ.

### Trường hợp: thụt lề cây

```tsx
<ul className="text-sm">
  <li className="py-1 ps-0">{t("tree.root")}</li>
  <li className="py-1 ps-4">{t("tree.child")}</li>
  <li className="py-1 ps-8">{t("tree.grandchild")}</li>
</ul>
```

### Trường hợp: đường dẫn phân cấp

```tsx
<nav className="flex flex-wrap items-center gap-1 text-sm">
  <a className="underline" href="#a">{t("nav.dashboard")}</a>
  <svg aria-hidden="true" className="size-3 shrink-0 rtl:-scale-x-100" />
  <a className="underline" href="#b">{t("nav.orders")}</a>
</nav>
```

### Trường hợp: thanh tiến độ **tác vụ** — mọc từ đầu dòng

```tsx
<div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
  <div className="h-full rounded-full bg-neutral-900 rtl:ms-auto" style={{ inlineSize: "62%" }} />
</div>
```

Thanh này nói "đã xong 62% công việc". Tiến trình của việc chạy theo chiều đọc, nên ở RTL nó mọc từ
phải. So thẳng với thanh nội dung đa phương tiện ở `EXPANSION-5`.

### Ngoại lệ và nhầm lẫn

- **`ml`/`mr`, `left`/`right`, `text-left` mặc định là lỗi im lặng**: chúng hiển thị bình thường ở LTR
  và sai nghĩa ở RTL, nên không có điều kiện nào bắt được ngoài mắt người đọc RTL.

  ```tsx
  {/* SAI */}  <div className="ml-2 text-left absolute left-0" />
  {/* ĐÚNG */} <div className="ms-2 text-start absolute start-0" />
  ```

- **Lật đúng một nửa của một cặp còn tệ hơn không lật:**

  ```tsx
  {/* SAI */}
  <button><svg className="size-4 rtl:-scale-x-100" /></button>  {/* hoàn tác */}
  <button><svg className="size-4" /></button>                    {/* làm lại — quên lật */}
  ```

- **`rtl:-scale-x-100` không phải phản xạ mặc định.** Nó chỉ đúng với hình dạng ký tự **chỉ hướng**. Dán nó lên
  mọi biểu tượng là biến toàn bộ bộ biểu tượng thành ảnh gương của chính nó.
- **Bo góc của nhóm nút cũng là hình học có chiều:** dùng `rounded-s-*` và `rounded-e-*`, không dùng
  `rounded-l-*`.

---

## `EXPANSION-5` — lật là sai nghĩa

### Trường hợp: điều khiển phát lại

```tsx
<div className="flex items-center gap-2">
  <button aria-label={t("player.previous")} className="rounded-md p-2" type="button">
    <svg aria-hidden="true" className="size-4" />
  </button>
  <button aria-label={t("player.play")} className="rounded-md bg-neutral-900 p-2 text-white" type="button">
    <svg aria-hidden="true" className="size-4" />
  </button>
</div>
```

Không có `rtl:` ở đâu cả, và đó là **quyết định**, không phải thiếu sót. Chiều của các nút này là
chiều của bản ghi chạy tới, không phải chiều của câu văn.

### Trường hợp: thanh thời lượng nội dung đa phương tiện — cùng hình dạng với thanh tác vụ, khác mã

```tsx
<div className="flex items-center gap-2" dir="ltr">
  <span className="font-mono text-xs tabular-nums">01:24</span>
  <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
    <div className="h-full rounded-full bg-neutral-900" style={{ inlineSize: "38%" }} />
  </div>
  <span className="font-mono text-xs tabular-nums">03:41</span>
</div>
```

Đặt cạnh thanh tiến độ ở `EXPANSION-4`: hai đoạn mã đánh dấu gần như giống hệt nhau và mang hai mã khác
nhau. Phân định **không** nằm ở hình dạng, nó nằm ở **thanh đó đang nói về cái gì**.

### Trường hợp: cụm số nhúng trong câu RTL

```tsx
<p className="text-start text-sm" dir="rtl" lang="ar">
  تم تسليم الطلب رقم <span dir="ltr">8891</span> في الساعة <span dir="ltr">09:12</span>
</p>
```

Câu chảy từ phải sang trái; hai cụm số vẫn chạy từ trái sang phải. Không cô lập thì dấu câu ở hai đầu
sẽ bị kéo về phía sai và con số đọc ra không còn là con số ban đầu.

### Trường hợp: URL và đường dẫn nhúng trong câu

```tsx
<p className="text-start text-sm" dir="rtl" lang="ar">
  <span>{t("docs.seeReference")}</span>{" "}
  <code className="rounded bg-neutral-100 px-1 font-mono text-xs" dir="ltr">/api/v1/orders</code>
</p>
```

### Trường hợp: dấu chữ thương hiệu

```tsx
<span className="text-lg font-semibold tracking-tight" dir="ltr">Northwind</span>
```

### Trường hợp: đồ thị có trục thời gian

```tsx
<figure className="flex flex-col gap-2" dir="ltr">
  <div className="flex h-32 items-end gap-1">
    {months.map((month) => (
      <div className="w-4 rounded-t bg-neutral-800" key={month.key} style={{ blockSize: month.height }} />
    ))}
  </div>
  <figcaption className="text-start text-xs text-neutral-500" dir="auto">{t("chart.revenueByMonth")}</figcaption>
</figure>
```

Trục thời gian chạy tới trước ở mọi văn hoá, nên vùng vẽ giữ `dir="ltr"`; phần chú thích là câu văn
nên nó theo chiều của câu.

### Trường hợp: dãy số điện thoại và mã đơn trong bảng

```tsx
<td className="px-3 py-2 font-mono text-sm tabular-nums" dir="ltr">+84 24 3944 8888</td>
```

### Ngoại lệ và nhầm lẫn

- **Nhầm nguy hiểm nhất: mũi tên nào cũng cho là không lật.** Mũi tên "quay lại" **phải** lật
  (`EXPANSION-4`); mũi tên "tua tới" **không** lật. Cùng một tam giác.
- **Không dùng `dir="ltr"` cho cả một khối văn bản** chỉ vì bên trong có một con số:

  ```tsx
  {/* SAI — cả đoạn văn Ả Rập bị ép sang LTR vì một con số */}
  <p dir="ltr" lang="ar">تم تسليم الطلب رقم 8891</p>
  ```

  Cô lập **đảo**, không đảo ngược cả biển.

- **`dir="auto"` chỉ đúng cho nội dung người dùng nhập mà mình không biết trước ngôn ngữ.** Với chuỗi
  của chính mình, chiều là thứ mình biết, nên hãy nói ra.
- **Dấu tích, dấu cộng, biểu tượng không có hướng thì không có gì để lật.** Chúng thuộc mã này một cách
  lặng lẽ, và điều đó vẫn phải nói ra được khi bị hỏi.

---

## `EXPANSION-6` — giá trị do ngôn ngữ in ra

### Trường hợp: tiền tệ — ký hiệu, dấu phân cách và **vị trí ký hiệu** đều là của ngôn ngữ

```tsx
const price = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(1234.5);

<span className="text-lg font-semibold tabular-nums" dir="ltr">{price}</span>
```

`$1,234.50` · `1.234,50 €` · `1 234,50 €`. Ba bề rộng khác nhau và hai vị trí ký hiệu khác nhau — nên
cột chứa nó là `EXPANSION-2`, không phải một con số đo từ bản tiếng Anh.

### Trường hợp: ngày

```tsx
<time className="text-sm tabular-nums" dateTime="2026-08-16">
  {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)}
</time>
```

Thuộc tính `dateTime` giữ dạng máy đọc được bất biến; phần hiện ra là dạng của ngôn ngữ. Hai vai trò,
hai chỗ, không lẫn vào nhau.

### Trường hợp: thời gian tương đối

```tsx
<span className="text-sm text-neutral-500">
  {new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-3, "day")}
</span>
```

### Trường hợp: số nhiều — không phải hai nhánh

```tsx
{/* SAI — ngữ pháp của một ngôn ngữ, áp cho tất cả */}
<span>{count} item{count > 1 ? "s" : ""}</span>

{/* ĐÚNG — catalogue giữ đủ số dạng mà ngôn ngữ đó cần */}
<span>{t("cart.itemCount", { count })}</span>
```

Có ngôn ngữ chỉ có một dạng số nhiều, có ngôn ngữ có tới sáu. Hai nhánh `if` không diễn đạt nổi cả
hai đầu của dải đó.

### Trường hợp: nối một danh sách thành câu

```tsx
{/* SAI */}  <span>{authors.join(", ")}</span>
{/* ĐÚNG */} <span>{new Intl.ListFormat(locale, { type: "conjunction" }).format(authors)}</span>
```

### Trường hợp: số rút gọn và phần trăm

```tsx
<div className="flex items-baseline gap-2">
  <span className="text-2xl font-semibold tabular-nums" dir="ltr">
    {new Intl.NumberFormat(locale, { notation: "compact" }).format(12400)}
  </span>
  <span className="text-sm text-neutral-500 tabular-nums" dir="ltr">
    {new Intl.NumberFormat(locale, { style: "percent" }).format(0.62)}
  </span>
</div>
```

### Trường hợp: cột số trong bảng — `tabular-nums` là vì hàng thẳng cột, không vì đẹp

```tsx
<td className="px-3 py-2 text-end tabular-nums" dir="ltr">{formattedAmount}</td>
```

### Ngoại lệ và nhầm lẫn

- **Nối chuỗi ký hiệu tiền tệ là lỗi ở cả hai đầu**: sai ký hiệu, và sai **vị trí** ký hiệu:

  ```tsx
  {/* SAI */}  <span>${amount.toFixed(2)}</span>
  {/* SAI */}  <span>{amount.toLocaleString()} đ</span>
  ```

- **`toLocaleString()` không truyền ngôn ngữ là lấy ngôn ngữ của máy**, không phải ngôn ngữ của người dùng
  đang chọn trong sản phẩm. Hai thứ đó khác nhau và chỉ khác nhau ở máy người khác.
- **Định dạng ngày đóng cứng là lỗi đọc sai chứ không phải lỗi xấu:** `03/04/2026` là hai ngày khác
  nhau ở hai ngôn ngữ, và không có cách nào cho người đọc biết mình đang ở ngôn ngữ nào.
- **`tabular-nums` không thay được bộ định dạng.** Nó xếp thẳng cột, nó không đổi dấu phân cách.

---

## Mã lồng mã

### Một hàng đơn hàng mang năm mã

Đây là chỗ đọc rõ nhất luật **một quyết định, một đoạn liền mạch**. Không phần tử nào ở đây mang hai lần cùng một
câu hỏi.

```tsx
<li className="flex items-center gap-3 border-b px-4 py-3">
  <svg aria-hidden="true" className="size-4 shrink-0" />

  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="min-w-0 truncate font-medium">{order.customerName}</span>
    <span className="w-auto whitespace-normal text-xs text-neutral-500">
      {t("orders.summary", { count: order.itemCount, city: order.city })}
    </span>
  </div>

  <span className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-xs uppercase" dir="ltr">
    {order.reference}
  </span>

  <span className="shrink-0 text-end font-semibold tabular-nums" dir="ltr">
    {formattedTotal}
  </span>
</li>
```

- Khoảng cách và khoảng đệm trong của hàng lật theo chiều đọc — `EXPANSION-4`.
- Tên khách hàng do người dùng nhập, không đổi theo ngôn ngữ — `EXPANSION-0` ở trục độ dài; việc nó bị
  cắt là quyết định của mô-đun cắt/tràn, không phải của mã nở.
- Dòng tóm tắt là **một** câu có văn bản gợi ý — `EXPANSION-3`, và cái hộp giữ nó là `EXPANSION-1`.
- Mã đơn là biến thiết kế bất biến, cô lập chiều — `EXPANSION-0` cộng `EXPANSION-5`.
- Tổng tiền do ngôn ngữ in ra, không lật, và nằm trong cột dùng chung — `EXPANSION-6` cộng `EXPANSION-5`,
  với bề rộng cột do `EXPANSION-2` quyết.

Một phần tử cha phẳng gán một `w-32` cho cả hàng sẽ trộn cả năm quyết định vào một con số, và con số đó
đúng ở đúng một ngôn ngữ.

### Nhãn, trường và gợi ý trong một biểu mẫu RTL

```tsx
<div className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2">
  <label className="text-start text-sm font-medium" htmlFor="iban">{t("field.bankAccountNumber")}</label>
  <div className="flex min-w-0 flex-col gap-1">
    <input className="rounded-md border px-3 py-2 text-start font-mono" dir="ltr" id="iban" />
    <p className="w-auto whitespace-normal text-xs text-neutral-500">{t("field.bankAccountNumber.hint")}</p>
  </div>
</div>
```

Cột nhãn là `EXPANSION-2`; ô nhập giữ `dir="ltr"` vì số tài khoản là dãy ký tự bất biến
(`EXPANSION-5`) trong khi nhãn và gợi ý quanh nó vẫn theo chiều của câu (`EXPANSION-4`); dòng gợi ý
tự nuốt phần dài thêm (`EXPANSION-1`).

## Ánh xạ yêu cầu sang một mã

Nêu nguồn chuỗi, tập ngôn ngữ và ai sở hữu bề rộng. Nếu thiếu **một** dữ kiện quyết định, hỏi **một**
câu cụ thể rồi dừng. Câu trả lời phải là một mã kèm class CSS, hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Làm nút Lưu rộng 96px cho cân | Nhãn dịch được, nguồn 4 ký tự, dải nở tới 200% | `EXPANSION-1` | `w-auto whitespace-normal` |
| Cho nhãn biểu mẫu thẳng cột | Bề rộng phục vụ mọi nhãn ở mọi ngôn ngữ | `EXPANSION-2` | `grid-cols-[max-content_minmax(0,1fr)]` |
| Hiện "Showing 10 of 240" | Trật tự từ thuộc về người dịch | `EXPANSION-3` | một đoạn liền mạch, văn bản gợi ý bên trong |
| Đẩy biểu tượng ra xa nhãn 8px | Khoảng cách này có bên, và bên đổi theo chiều đọc | `EXPANSION-4` | `ms-2` thay cho `ml-2` |
| Lật nút Phát khi bật tiếng Ả Rập | Chiều của nút đến từ băng ghi, không từ câu | `EXPANSION-5` | không `rtl:`, giữ nguyên |
| Hiện giá 1234.5 | Ký hiệu, dấu phân cách và vị trí ký hiệu là của ngôn ngữ | `EXPANSION-6` | `Intl.NumberFormat` + `tabular-nums` |
| Đặt nhãn trạng thái PDF cạnh tên tệp | Tập giá trị đóng, không dịch | `EXPANSION-0` | không class CSS nở |
| Cắt bớt nhãn nút cho khỏi tràn | Cắt tên thành phần điều khiển là mất chính cái tên | `EXPANSION-1` | `flex-wrap` ở cha, bỏ `truncate` |
| Rút gọn bản dịch cho vừa hộp | Hộp không phải chuẩn của ngôn ngữ | `EXPANSION-1` | nới hộp, giữ nguyên chuỗi |
| Cột mã ISO rộng đúng 3 ký tự | Mọi giá trị chảy qua cột đều bất biến | `EXPANSION-0` | được phép đo cứng |

Ở dòng cắt nhãn nút, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ chấp nhận mất tên
thành phần điều khiển: *"Người dùng có cần đọc đủ nhãn này trước khi bấm không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `EXPANSION-0` / `EXPANSION-1` | Chuỗi này có một mục trong danh mục bản dịch không? |
| `EXPANSION-0` / `EXPANSION-6` | Giá trị lấy từ một tập đóng, hay do bộ định dạng in ra? |
| `EXPANSION-1` / `EXPANSION-2` | Bề rộng này ràng buộc một đoạn liền mạch, hay ràng buộc cả một cột? |
| `EXPANSION-1` / `EXPANSION-3` | Đoạn liền mạch này tự nó là một câu đúng, hay là một mảnh cụt? |
| `EXPANSION-3` / `EXPANSION-6` | Vấn đề nằm ở **vị trí** giá trị trong câu, hay ở **hình dạng** giá trị? |
| `EXPANSION-4` / `EXPANSION-5` | Chiều của thứ này đến từ câu văn, hay từ thời gian / số học / thương hiệu? |
| `EXPANSION-4` / `EXPANSION-2` | Câu hỏi là **bên nào**, hay là **bao nhiêu chỗ**? |

## Sai lầm lặp lại nhiều nhất

1. Đo hộp bằng chuỗi đang hiện trên máy mình.
2. `whitespace-nowrap` hoặc `truncate` trên một nhãn điều khiển dịch được.
3. Bảo người dịch viết ngắn lại thay vì nới cái hộp.
4. Ghép câu từ nhiều `<span>` để chèn số hoặc để in đậm một phần.
5. `n > 1 ? "s" : ""` — ngữ pháp của một ngôn ngữ áp cho tất cả.
6. `ml`/`left`/`text-left` mặc định, rồi phát hiện ra ở RTL khi đã muộn.
7. Lật đúng một nửa của một cặp hình dạng ký tự.
8. Lật cả nút Phát và thanh thời lượng cùng với phần còn lại của giao diện.
9. Ép cả một đoạn văn RTL sang `dir="ltr"` chỉ vì trong đó có một con số.
10. Nối ký hiệu tiền tệ hoặc `toFixed(2)` thay vì gọi bộ định dạng của ngôn ngữ.
11. Đo cột theo bản CJK ngắn nhất rồi tưởng là đã tiết kiệm được chỗ.
12. Coi bản bản dựng giả-bản địa hoá là bằng chứng đã xong, thay vì là bằng chứng cho một mã.
