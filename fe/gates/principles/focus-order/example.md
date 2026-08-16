---
id: fe-principles-focus-order-example
title: example.md
slug: /gates/principles/focus-order/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã FOCUS-N, viết bằng mã đánh dấu thuần và className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `focus-order` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Hãy để ý một chuyện xuyên suốt trang này: **phần lớn các ví dụ không có class CSS nào mới**. Cái đổi là
**chỗ đứng của nút DOM** và **một thuộc tính**. Đó là toàn bộ nội dung của luật này, và cũng là lý do
nó bị bỏ sót — không có gì trong class CSS danh sách để soi ra.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định duy nhất.

---

## `FOCUS-0` — không nằm trong đường đi bàn phím

### Trường hợp: biểu tượng trang trí trong nút

```tsx
<button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" type="button">
  <svg aria-hidden="true" className="size-4" focusable="false" />
  Tải xuống
</button>
```

Cái nút là điểm dừng; cái biểu tượng **không**. `aria-hidden` cắt nó khỏi cây tên gọi, `focusable="false"`
xử lý riêng trường hợp SVG trong các engine cũ vẫn nhận tiêu điểm.

### Trường hợp: thẻ có hai liên kết cùng đích — bản sai

```tsx
{/* SAI: tab hai lần cho cùng một chỗ đến */}
<article className="rounded-lg border p-4">
  <a href="/khoa-hoc/he-thong-phan-tan">
    <img alt="" className="mb-3 aspect-video w-full rounded object-cover" src={cover} />
  </a>
  <a className="font-medium" href="/khoa-hoc/he-thong-phan-tan">Hệ thống phân tán</a>
</article>
```

### Trường hợp: thẻ có hai liên kết cùng đích — bản đúng

```tsx
<article className="relative rounded-lg border p-4">
  <img alt="" className="mb-3 aspect-video w-full rounded object-cover" src={cover} />
  <a
    className="font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
    href="/khoa-hoc/he-thong-phan-tan"
  >
    Hệ thống phân tán
  </a>
</article>
```

Ảnh trở về đúng vai trò của nó: trang trí. Vùng bấm được mở rộng ra cả thẻ bằng giả-phần tử, nên
chuột không mất gì, còn bàn phím chỉ còn **một** điểm dừng.

### Trường hợp: nền bị khoá trong lúc một lớp chiếm màn hình

```tsx
<div className="min-h-dvh" inert={isDialogOpen ? "" : undefined}>
  <header className="flex items-center justify-between p-4">…</header>
  <main className="p-4">…</main>
</div>
```

### Trường hợp: khung của thẻ tab không được chọn

```tsx
<div id="panel-hoat-dong" hidden={selected !== "hoat-dong"} role="tabpanel">
  <a className="underline focus-visible:outline-2 focus-visible:outline-offset-2" href="/nhat-ky">Xem toàn bộ nhật ký</a>
</div>
```

`hidden` gỡ cả khung khỏi đường đi. Mọi thành phần điều khiển bên trong thành `FOCUS-0` mà không phải khai báo
từng cái.

### Trường hợp: ngăn trượt đang chạy hoạt ảnh đóng

```tsx
<aside
  aria-hidden={!open}
  className={`fixed inset-y-0 right-0 w-80 border-l bg-white transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}
  inert={open ? undefined : ""}
>
  …
</aside>
```

`translate-x-full` chỉ đẩy điểm ảnh ra ngoài màn hình. Không có `inert`, mọi nút bên trong vẫn di chuyển tới bằng phím Thẻ tab
được trong suốt thời gian nó "đã đóng".

### Ngoại lệ và nhầm lẫn

- **`opacity-0` và `-translate-x-full` không giấu được thứ gì khỏi bàn phím.**

  ```tsx
  {/* SAI: mắt không thấy, Tab vẫn tới */}
  <div className="pointer-events-none opacity-0">
    <button type="button">Xoá tài khoản</button>
  </div>
  ```

- **Đừng biến một `div` bố cục thành điểm dừng.**

  ```tsx
  {/* SAI: dừng ở đây không làm được gì */}
  <div className="rounded-lg border p-4" tabIndex={0}>
    <h3 className="font-medium">Gói tiêu chuẩn</h3>
    <button type="button">Chọn gói</button>
  </div>
  ```

- **`aria-hidden` không gỡ được điểm dừng.** Nó chỉ giấu khỏi trình đọc màn hình. Một nút DOM vừa
  `aria-hidden="true"` vừa nhận tiêu điểm là trạng thái tệ nhất: người dùng dừng ở một chỗ **không có
  tên**.

  ```tsx
  {/* SAI */}  <button aria-hidden="true" type="button">Đóng</button>
  {/* ĐÚNG */} <button aria-label="Đóng" type="button">…</button>
  ```

- **`disabled` khác `FOCUS-0`.** Nút bị vô hiệu hoá đã tự rời đường đi; đừng chồng thêm `aria-hidden`, vì
  người dùng vẫn cần đọc được là nó **đang** ở đó và **đang** không dùng được.

---

## `FOCUS-1` — vị trí trong DOM chính là vị trí trong đường đi

### Trường hợp: biểu mẫu đăng nhập — đọc tệp từ trên xuống là ra đường đi

```tsx
<form className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="email">Email</label>
  <input className="rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2" id="email" type="email" />
  <label className="text-sm font-medium" htmlFor="matkhau">Mật khẩu</label>
  <input className="rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2" id="matkhau" type="password" />
  <a className="text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2" href="/quen-mat-khau">Quên mật khẩu?</a>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2" type="submit">Đăng nhập</button>
</form>
```

### Trường hợp: `order-*` phá đường đi — bản sai

```tsx
{/* SAI: mắt đọc Huỷ → Xác nhận, bàn phím đi Xác nhận → Huỷ */}
<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Xác nhận</button>
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
</div>
```

### Trường hợp: cùng bố cục đó, viết đúng

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
  <button className="rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" type="button">Huỷ</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2" type="submit">Xác nhận</button>
</div>
```

Muốn *Xác nhận* nằm bên phải trên máy tính và **ở trên** trên thiết bị di động thì đó là một quyết định thiết
kế phải trả bằng mã đánh dấu, chứ không phải bằng `-reverse`. Nếu thứ tự thao tác đúng là *Huỷ* rồi *Xác
nhận*, hãy để mã đánh dấu nói đúng như vậy ở mọi khung nhìn.

### Trường hợp: thanh bên nằm bên trái nhưng nội dung phải đọc trước

```tsx
<div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="flex flex-col gap-2">
    <a className="rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" href="#tong-quan">Tổng quan</a>
    <a className="rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" href="#hoc-vien">Học viên</a>
  </aside>
  <main className="min-w-0">…</main>
</div>
```

Thanh bên đứng **trước** trong DOM vì nó thật sự được đọc trước; nếu nó dài, câu trả lời là `FOCUS-5`,
**không phải** đẩy nó xuống cuối tệp rồi kéo ngược bằng lưới.

### Trường hợp: `tabindex` dương — luôn sai

```tsx
{/* SAI: kéo hai node này lên đầu đường đi của cả tài liệu */}
<input tabIndex={1} />
<button tabIndex={2} type="submit">Gửi</button>
```

`tabindex` dương không chèn nút DOM vào chỗ bạn tưởng — nó tạo ra một đường đi **thứ hai** chạy trước
toàn bộ tài liệu. Chỉ cần một nút DOM như thế là cả trang đổi thứ tự.

### Trường hợp: liên kết "bỏ qua" trong một dòng dài — thứ tự trong câu

```tsx
<p className="text-sm">
  Bài kiểm tra kéo dài 45 phút.
  <a className="ml-1 underline focus-visible:outline-2 focus-visible:outline-offset-2" href="/quy-che">Xem quy chế</a>
  trước khi bắt đầu.
</p>
```

### Ngoại lệ và nhầm lẫn

- **Hiển thị hai bản rồi ẩn một bản theo khung nhìn là cấm.**

  ```tsx
  {/* SAI: một id tồn tại hai lần, và bản bị ẩn bằng class vẫn tab tới được */}
  <div className="lg:hidden"><input id="tim-kiem" /></div>
  <div className="hidden lg:block"><input id="tim-kiem" /></div>
  ```

- **`absolute` không dời điểm dừng.** Một nút "Đóng" đặt `absolute right-4 top-4` mà viết ở **cuối**
  thẻ thì bàn phím tới nó sau cùng, dù mắt thấy nó đầu tiên. Muốn nó đến trước thì viết nó trước.
- **Không có `FOCUS-1` cho thứ không phải thành phần điều khiển.** Đưa `tabindex="0"` lên `<h2>` để "cho di chuyển tới bằng phím Thẻ tab
  được" là biến một tiêu đề thành cái bẫy im lặng. Tiêu đề chỉ nhận `tabIndex={-1}`, và chỉ dưới
  `FOCUS-7`.

---

## `FOCUS-2` — nhìn thấy tiêu điểm đang đứng ở đâu

### Trường hợp: chỉ báo mặc định của mô-đun

```tsx
<button className="rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" type="button">
  Lưu nháp
</button>
```

### Trường hợp: thay bằng vòng, hợp lệ vì có vẽ thứ thay thế

```tsx
<a
  className="rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
  href="/ho-so"
>
  Hồ sơ của tôi
</a>
```

### Trường hợp: thành phần điều khiển nằm trên ảnh — chỉ báo phải sống được trên mọi nền

```tsx
<div className="relative">
  <img alt="" className="aspect-video w-full rounded-lg object-cover" src={cover} />
  <button
    className="absolute bottom-3 right-3 rounded-md bg-white/90 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
    type="button"
  >
    Xem trước
  </button>
</div>
```

### Trường hợp: bán kính của chỉ báo phải khớp với nút DOM

```tsx
<button className="rounded-full border p-2 focus-visible:outline-2 focus-visible:outline-offset-2" type="button">
  <svg aria-hidden="true" className="size-4" />
  <span className="sr-only">Thông báo</span>
</button>
```

### Trường hợp: cha `overflow-hidden` xén mất chỉ báo — bản sai

```tsx
{/* SAI: outline-offset bị cắt ở mép cha */}
<div className="overflow-hidden rounded-lg border">
  <button className="w-full p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2" type="button">
    Chương 1 — Nền tảng
  </button>
</div>
```

### Trường hợp: sửa bằng chỉ báo vẽ vào trong

```tsx
<div className="overflow-hidden rounded-lg border">
  <button className="w-full p-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2" type="button">
    Chương 1 — Nền tảng
  </button>
</div>
```

Không dời `overflow-hidden`, không bỏ chỉ báo: cho nó vẽ vào phía trong. Bài học là **chỉ báo phải
thắng**, chứ không phải "chỗ này không hiện được thì thôi".

### Ngoại lệ và nhầm lẫn

- **`outline-none` trần trụi là vi phạm, ở mọi kích thước.**

  ```tsx
  {/* SAI */}  <input className="rounded-md border px-3 py-2 focus:outline-none" />
  ```

- **`hover:` không gánh được `focus`.**

  ```tsx
  {/* SAI: chuột có phản hồi, bàn phím thì không */}
  <a className="rounded px-2 py-1 hover:bg-neutral-100" href="/gioi-thieu">Giới thiệu</a>
  ```

- **Chỉ đổi màu chữ là không đủ.** Một nút DOM đang giữ tiêu điểm phải phân biệt được với nút DOM bên cạnh
  **mà không cần so sánh hai màu gần nhau**; đường viền làm được việc đó, một sắc độ chữ thì không.
- **Nút DOM `FOCUS-0` không được vẽ vòng.** Nếu bạn thấy mình viết `focus-visible:` cho một `div` trang
  trí, phân loại đã sai từ trước đó một bước.

---

## `FOCUS-3` — giam đường đi trong lớp chiếm cả màn hình

### Trường hợp: hộp thoại xác nhận, đầy đủ ba nghĩa vụ

```tsx
function ConfirmDialog({ onClose }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const panel = panelRef.current
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    panel.querySelector("[data-landing]")?.focus()

    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose()
        return
      }
      if (event.key !== "Tab") return

      const stops = Array.from(panel.querySelectorAll(selector))
      const first = stops[0]
      const last = stops[stops.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener("keydown", onKeyDown)
    return () => panel.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 grid place-items-center bg-black/50 p-4">
      <div
        aria-labelledby="xac-nhan-tieu-de"
        aria-modal="true"
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-6"
        ref={panelRef}
        role="dialog"
      >
        <h2 className="font-medium" id="xac-nhan-tieu-de" tabIndex={-1} data-landing>
          Xoá bản nháp này?
        </h2>
        <p className="text-sm text-neutral-600">Bản nháp sẽ không khôi phục lại được.</p>
        <div className="flex justify-end gap-2">
          <button className="rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onClose} type="button">Huỷ</button>
          <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2" type="button">Xoá</button>
        </div>
      </div>
    </div>
  )
}
```

Ba nghĩa vụ, không được thiếu cái nào: **vòng lại** ở hai đầu, **`Escape`** thoát ra, **`inert`** cho
phần nền (xem `FOCUS-0`). Thiếu cái thứ hai thì đây không còn là `FOCUS-3` — nó là cái bẫy 2.1.2 cấm.

### Trường hợp: dưới bảng trượt trên thiết bị di động cũng là lớp chiếm màn hình

```tsx
<div className="fixed inset-0 flex items-end bg-black/50">
  <div
    aria-labelledby="chon-phuong-thuc"
    aria-modal="true"
    className="flex w-full flex-col gap-3 rounded-t-2xl bg-white p-6"
    role="dialog"
  >
    <h2 className="font-medium" id="chon-phuong-thuc" tabIndex={-1}>Chọn phương thức thanh toán</h2>
    …
  </div>
</div>
```

Nó trượt lên từ dưới và trông "nhẹ", nhưng nền đã không dùng được nữa. Hình dạng không quyết định mã;
**quyền sở hữu màn hình** mới quyết định.

### Trường hợp: lớp KHÔNG chiếm màn hình — không giam

```tsx
<div className="relative">
  <input
    aria-controls="goi-y"
    aria-expanded={open}
    className="w-full rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
    role="combobox"
  />
  <ul className="absolute z-10 mt-1 w-full rounded-md border bg-white" hidden={!open} id="goi-y" role="listbox">
    <li className="px-3 py-2" role="option">Hệ thống phân tán</li>
    <li className="px-3 py-2" role="option">Hệ quản trị dữ liệu</li>
  </ul>
</div>
```

Cửa sổ bật lên gợi ý **không** giam: `Tab` phải rời được nó và đi tiếp trong trang. Tiêu điểm vẫn ở ô ô nhập liệu, các
option được đi bằng mũi tên. Đây là `FOCUS-6` bên trong, `FOCUS-7` lúc mở, `FOCUS-4` lúc đóng — và
tuyệt đối không có `FOCUS-3` nào ở đây.

### Trường hợp lồng nhau: hộp thoại (`FOCUS-3`) ⊃ danh sách thẻ tab (`FOCUS-6`) ⊃ trường nhập liệu (`FOCUS-1`)

```tsx
<div
  aria-labelledby="cai-dat-tieu-de"
  aria-modal="true"
  className="flex w-full max-w-lg flex-col gap-4 rounded-lg bg-white p-6"
  role="dialog"
>
  <h2 className="font-medium" id="cai-dat-tieu-de" tabIndex={-1}>Cài đặt</h2>

  <div className="flex gap-2" role="tablist">
    <button
      aria-selected={tab === "chung"}
      className="rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      role="tab"
      tabIndex={tab === "chung" ? 0 : -1}
      type="button"
    >
      Chung
    </button>
    <button
      aria-selected={tab === "thong-bao"}
      className="rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      role="tab"
      tabIndex={tab === "thong-bao" ? 0 : -1}
      type="button"
    >
      Thông báo
    </button>
  </div>

  <div hidden={tab !== "chung"} role="tabpanel">
    <label className="text-sm font-medium" htmlFor="ten-hien-thi">Tên hiển thị</label>
    <input className="mt-2 w-full rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2" id="ten-hien-thi" />
  </div>

  <div className="flex justify-end gap-2">
    <button className="rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" type="button">Huỷ</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2" type="submit">Lưu</button>
  </div>
</div>
```

Đếm điểm dừng bên trong lớp này: **danh sách thẻ tab một điểm**, trường nhập liệu một, *Huỷ* một, *Lưu* một — bốn. Không
phải năm. Cái khung bị `hidden` đóng góp **không** điểm dừng nào. Đây là ví dụ chuẩn của luật *mã áp
cho một quyết định, không áp cho cả cây*: cùng một hộp thoại mang `FOCUS-3` ở ngoài, `FOCUS-6` ở giữa,
`FOCUS-1` và `FOCUS-0` ở trong, và mỗi nút DOM lại mang một quyết định `FOCUS-2` của riêng nó.

### Ngoại lệ và nhầm lẫn

- **Giam mà không có `Escape` là cái bẫy.**

  ```tsx
  {/* SAI: vòng lại ở hai đầu nhưng không có đường ra */}
  <div aria-modal="true" role="dialog">
    <input />
    <button type="submit">Tiếp tục</button>
  </div>
  ```

- **Thông báo nổi, biểu ngữ, chú giải không bao giờ giam.** Chúng không sở hữu màn hình. Thông báo nổi quan trọng thì
  dùng `role="status"` để đọc lên, không kéo tiêu điểm.
- **Hai lớp chồng nhau thì lớp trên cùng sở hữu đường đi**, và lúc đóng nó phải trả về lớp dưới —
  chứ không phải về trang.
- **`aria-modal="true"` không giam được gì.** Nó nói cho trình đọc màn hình, không nói cho `Tab`.
  Thiếu `inert` là nền vẫn đến được bằng phím Thẻ tab.

---

## `FOCUS-4` — trả tiêu điểm về chỗ đã mở nó

### Trường hợp: giữ ref chỗ mở, trả về lúc đóng

```tsx
function DeleteDraftButton() {
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        className="rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Xoá bản nháp
      </button>
      {open ? <ConfirmDialog onClose={close} /> : null}
    </>
  )
}
```

### Trường hợp: chỗ mở đã chết theo hành động — trả về người kế nhiệm

```tsx
function removeRow(id) {
  const rows = listRef.current.querySelectorAll("[data-row]")
  const index = Array.from(rows).findIndex((row) => row.dataset.row === id)
  const successor = rows[index + 1] ?? rows[index - 1] ?? listRef.current

  setRows((current) => current.filter((row) => row.id !== id))
  requestAnimationFrame(() => successor.focus())
}
```

Xoá dòng thứ ba thì cái nút đã mở hộp xác nhận cũng biến mất. Người kế nhiệm phải được **gọi tên
trước** khi trạng thái đổi; sau khi hiển thị lại thì không còn gì để hỏi nữa.

### Trường hợp: danh sách có người kế nhiệm hợp lệ

```tsx
<ul className="divide-y rounded-lg border" ref={listRef} tabIndex={-1}>
  {rows.map((row) => (
    <li className="flex items-center justify-between p-4" data-row={row.id} key={row.id}>
      <span>{row.title}</span>
      <button
        className="rounded-md border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => confirmRemove(row.id)}
        type="button"
      >
        Xoá
      </button>
    </li>
  ))}
</ul>
```

`tabIndex={-1}` trên `<ul>` không thêm điểm dừng nào — nó chỉ tạo ra một **chỗ hạ cánh cuối cùng**
cho trường hợp xoá đúng dòng cuối cùng.

### Trường hợp: đóng trình đơn bằng `Escape`

```tsx
function onMenuKeyDown(event) {
  if (event.key !== "Escape") return
  setOpen(false)
  triggerRef.current?.focus()
}
```

### Ngoại lệ và nhầm lẫn

- **Đừng để tiêu điểm rơi xuống `<body>`.**

  ```tsx
  {/* SAI: đóng xong là mất dấu, Tab bắt đầu lại từ đầu trang */}
  <button onClick={() => setOpen(false)} type="button">Đóng</button>
  ```

- **Đừng `.focus()` trước khi nút DOM quay lại DOM.** Nếu chỗ mở bị unmount trong lúc lớp đang bật, hãy
  trả về sau khi hiển thị, không phải trong cùng một nhịp.
- **Đóng hộp thoại "tạo mới" thành công là hai quyết định, không phải một.** Trả về chỗ mở là `FOCUS-4`;
  nhảy tới bản ghi vừa tạo là `FOCUS-7`. Chọn một, viết ra, đừng để nó thành hệ quả tình cờ của thứ
  tự re-hiển thị.
- **`autoFocus` trên chỗ mở là câu trả lời sai.** Nó bắn lúc mount, còn việc bạn cần là bắn lúc
  **đóng**.

---

## `FOCUS-5` — đường tắt vượt qua khối lặp lại

### Trường hợp: bỏ qua liên kết là nút DOM đầu tiên của tài liệu

```tsx
<body>
  <a
    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:outline-2 focus:outline-offset-2"
    href="#noi-dung"
  >
    Bỏ qua điều hướng
  </a>
  <header className="flex items-center gap-4 border-b p-4">…</header>
  <main id="noi-dung" tabIndex={-1}>…</main>
</body>
```

Hai chi tiết đều bắt buộc: nó là nút DOM **đầu tiên**, và đích `#noi-dung` mang `tabIndex={-1}` — không
có nó thì nhiều trình duyệt cuộn tới nơi nhưng để tiêu điểm lại ở chỗ cũ, và lần `Tab` kế tiếp lại rơi
vào giữa phần đầu.

### Trường hợp: nhiều đường tắt khi có nhiều khối lặp

```tsx
<div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:left-4 focus-within:top-4 focus-within:z-50 focus-within:flex focus-within:gap-2">
  <a className="rounded-md bg-white px-3 py-2 focus:outline-2 focus:outline-offset-2" href="#noi-dung">Tới nội dung</a>
  <a className="rounded-md bg-white px-3 py-2 focus:outline-2 focus:outline-offset-2" href="#tim-kiem">Tới ô tìm kiếm</a>
  <a className="rounded-md bg-white px-3 py-2 focus:outline-2 focus:outline-offset-2" href="#dieu-huong">Tới điều hướng</a>
</div>
```

### Trường hợp lồng nhau: `FOCUS-5` ⊃ `FOCUS-0` ⊃ `FOCUS-1`, rồi `FOCUS-7` khi đổi tuyến trang

```tsx
<>
  <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:outline-2 focus:outline-offset-2" href="#noi-dung">
    Bỏ qua điều hướng
  </a>

  <header className="flex items-center gap-3 border-b p-4">
    <svg aria-hidden="true" className="size-6" />
    <nav className="flex gap-2">
      <a className="rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" href="/khoa-hoc">Khoá học</a>
      <a className="rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" href="/lo-trinh">Lộ trình</a>
    </nav>
  </header>

  <main id="noi-dung" tabIndex={-1}>
    <h1 className="p-4 text-xl font-semibold" ref={headingRef} tabIndex={-1}>
      {pageTitle}
    </h1>
    …
  </main>
</>
```

Bốn mã trong một khung: đường tắt là `FOCUS-5`, biểu trưng là `FOCUS-0`, các liên kết điều hướng là `FOCUS-1`,
và `headingRef` là đích hạ cánh `FOCUS-7` mỗi lần tuyến trang đổi.

### Ngoại lệ và nhầm lẫn

- **Đừng giấu bằng `hidden` hay `display:none`** — như vậy nó không nhận được tiêu điểm, và đường tắt
  không bao giờ hiện ra. `sr-only` giấu khỏi mắt mà vẫn giữ nó trong đường đi.
- **Đừng đặt nó sau phần đầu** cho "dễ style". Đứng sau phần đầu thì nó bỏ qua đúng thứ mà nó đã bắt
  người ta đi qua.
- **Đích thiếu `tabIndex={-1}` là đường tắt hỏng một nửa:** cuộn thì đúng, tiêu điểm thì không đi.

  ```tsx
  {/* SAI */}  <main id="noi-dung">…</main>
  {/* ĐÚNG */} <main id="noi-dung" tabIndex={-1}>…</main>
  ```

- **Một trang thật sự không có khối lặp thì không cần đường tắt.** Đây là ngoại lệ đóng duy nhất của
  `FOCUS-5`, và nó hiếm hơn người ta tưởng — một phần đầu ba liên kết vẫn là ba điểm dừng lặp trên mọi
  trang.

---

## `FOCUS-6` — một thành phần tiện ích hợp thành là một điểm dừng

### Trường hợp: danh sách thẻ tab với tabindex luân chuyển

```tsx
<div className="flex gap-2" role="tablist">
  {tabs.map((tab) => (
    <button
      aria-selected={tab.id === selected}
      className="rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      key={tab.id}
      onKeyDown={onTabKeyDown}
      role="tab"
      tabIndex={tab.id === selected ? 0 : -1}
      type="button"
    >
      {tab.label}
    </button>
  ))}
</div>
```

### Trường hợp: phím mũi tên đi trong thành phần tiện ích

```tsx
function onTabKeyDown(event) {
  const keys = { ArrowRight: 1, ArrowLeft: -1 }
  const step = keys[event.key]
  if (!step) return

  event.preventDefault()
  const next = (tabs.findIndex((tab) => tab.id === selected) + step + tabs.length) % tabs.length
  setSelected(tabs[next].id)
  tabRefs.current[next]?.focus()
}
```

`tabindex` đổi chỗ theo thành viên đang chọn, nên rời thành phần tiện ích rồi `Tab` quay lại sẽ rơi đúng chỗ vừa
rời — chứ không phải về thành viên đầu tiên.

### Trường hợp: thanh công cụ định dạng — mười nút, một điểm dừng

```tsx
<div aria-label="Định dạng" className="flex gap-1 rounded-md border p-1" role="toolbar">
  <button aria-pressed={bold} className="rounded p-2 focus-visible:outline-2 focus-visible:outline-offset-2" tabIndex={active === 0 ? 0 : -1} type="button">
    <span className="sr-only">In đậm</span>
    <svg aria-hidden="true" className="size-4" />
  </button>
  <button aria-pressed={italic} className="rounded p-2 focus-visible:outline-2 focus-visible:outline-offset-2" tabIndex={active === 1 ? 0 : -1} type="button">
    <span className="sr-only">In nghiêng</span>
    <svg aria-hidden="true" className="size-4" />
  </button>
</div>
```

### Trường hợp: nhóm nút chọn — trình duyệt đã làm sẵn `FOCUS-6`

```tsx
<fieldset className="flex flex-col gap-2">
  <legend className="text-sm font-medium">Chế độ hiển thị</legend>
  <label className="flex items-center gap-2 text-sm">
    <input className="focus-visible:outline-2 focus-visible:outline-offset-2" name="che-do" type="radio" value="luoi" />
    Lưới
  </label>
  <label className="flex items-center gap-2 text-sm">
    <input className="focus-visible:outline-2 focus-visible:outline-offset-2" name="che-do" type="radio" value="danh-sach" />
    Danh sách
  </label>
</fieldset>
```

Cùng `name` là đã có `FOCUS-6` miễn phí: cả nhóm một điểm dừng, mũi tên đi bên trong. Dựng lại bằng
`<button>` là tự tay bỏ đi thứ đã đúng sẵn.

### Ngoại lệ và nhầm lẫn

- **Ba nút hành động khác nhau KHÔNG phải `FOCUS-6`.**

  ```tsx
  {/* Ba việc khác nhau ⇒ ba FOCUS-1, mỗi nút một điểm dừng */}
  <div className="flex gap-2">
    <button type="button">Xem trước</button>
    <button type="submit">Lưu</button>
    <button type="button">Xoá</button>
  </div>
  ```

- **Đừng để cả thành phần tiện ích không còn điểm dừng nào.**

  ```tsx
  {/* SAI: không thành viên nào mang tabIndex 0 ⇒ Tab đi vòng qua cả widget */}
  <div role="tablist">
    <button role="tab" tabIndex={-1} type="button">Tổng quan</button>
    <button role="tab" tabIndex={-1} type="button">Hoạt động</button>
  </div>
  ```

- **Đừng giam thành phần tiện ích.** Ra khỏi danh sách thẻ tab bằng `Tab` phải luôn được; chặn `Tab` ở đây là vi phạm 2.1.2.
- **Bảng dữ liệu thường không phải `FOCUS-6`.** Chỉ khi mỗi ô thật sự là một đích thao tác thì mới
  dựng lưới có tiêu điểm luân chuyển; còn bảng chỉ để đọc thì các liên kết trong ô là `FOCUS-1`.

---

## `FOCUS-7` — đưa tiêu điểm tới nội dung vừa xuất hiện

### Trường hợp: đổi tuyến trang trong ứng dụng một trang

```tsx
useEffect(() => {
  headingRef.current?.focus()
}, [pathname])
```

```tsx
<h1 className="text-xl font-semibold focus:outline-2 focus:outline-offset-2" ref={headingRef} tabIndex={-1}>
  Lộ trình của tôi
</h1>
```

Đích là **cái tiêu đề**, không phải `<main>`: chỉ báo `FOCUS-2` phải đọc được, và một khung bao quanh
nửa màn hình thì không đọc được. Và ở đây dùng `focus:` chứ không `focus-visible:` — cú dời này
không do người dùng gõ ra, nên phải luôn nói cho họ biết họ vừa bị đặt ở đâu.

### Trường hợp: tóm tắt lỗi sau khi gửi

```tsx
<div
  className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-4 focus:outline-2 focus:outline-offset-2"
  hidden={errors.length === 0}
  ref={errorSummaryRef}
  role="alert"
  tabIndex={-1}
>
  <strong className="text-sm">Còn {errors.length} mục cần sửa</strong>
  <ul className="flex flex-col gap-1">
    {errors.map((error) => (
      <li key={error.field}>
        <a className="text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2" href={`#${error.field}`}>
          {error.message}
        </a>
      </li>
    ))}
  </ul>
</div>
```

Đây là chỗ hiếm hoi mà đích hạ cánh là một khối chứ không phải một dòng chữ, và nó hợp lệ vì bản thân
khối đó **là** nội dung mới: mỗi lỗi là một liên kết nhảy thẳng tới trường nhập liệu hỏng.

### Trường hợp: "tải thêm" — tiêu điểm tới đầu lô kết quả mới

```tsx
function onLoadMore() {
  const previousCount = items.length
  fetchMore().then((next) => {
    setItems([...items, ...next])
    requestAnimationFrame(() => itemRefs.current[previousCount]?.focus())
  })
}
```

Nếu để tiêu điểm ở nguyên nút "Tải thêm", người dùng bàn phím phải đi ngược lên để tìm thứ họ vừa yêu
cầu — và họ không có cách nào biết là đã có bao nhiêu thứ mới.

### Trường hợp: bước tiếp theo của trình hướng dẫn

```tsx
<section aria-labelledby="buoc-2">
  <h2 className="font-medium focus:outline-2 focus:outline-offset-2" id="buoc-2" ref={stepRef} tabIndex={-1}>
    Bước 2 — Thông tin thanh toán
  </h2>
  …
</section>
```

### Trường hợp: mở trình soạn thảo tại chỗ, và đóng lại

```tsx
function startEditing() {
  setEditing(true)
  requestAnimationFrame(() => inputRef.current?.focus())
}

function stopEditing() {
  setEditing(false)
  requestAnimationFrame(() => triggerRef.current?.focus())
}
```

Một cặp đầy đủ: mở là `FOCUS-7`, đóng là `FOCUS-4`. Không lớp nào chiếm màn hình, nên **không có
`FOCUS-3`** ở đây và cũng không được giam.

### Ngoại lệ và nhầm lẫn

- **Khung chờ đổi thành nội dung thật KHÔNG phải `FOCUS-7`.**

  ```tsx
  {/* SAI: cướp focus của người đang gõ ở chỗ khác */}
  useEffect(() => {
    if (!isLoading) contentRef.current?.focus()
  }, [isLoading])
  ```

- **Đừng hạ cánh xuống cả vùng.**

  ```tsx
  {/* SAI: chỉ báo thành cái khung bao nửa màn hình */}
  <main ref={landingRef} tabIndex={-1}>…</main>
  ```

- **Đừng `autoFocus` ở mọi trang.** Chỉ hợp lệ khi cả màn hình tồn tại vì đúng một trường nhập liệu đó — ô tìm
  kiếm của một trang tìm kiếm, ô nhập mã của một trang xác thực.
- **Thông báo nổi không kéo tiêu điểm.** Nội dung mới xuất hiện **không do** người dùng yêu cầu thì đọc lên bằng
  `role="status"`, không dời tiêu điểm.
- **Đừng dời tiêu điểm hai lần cho một hành động.** Đóng hộp thoại và nhảy tới bản ghi mới là một chuỗi phải
  chốt, không phải một cuộc đua giữa hai `useEffect`.

---

## Ánh xạ yêu cầu sang một quyết định

Nêu nút DOM hoặc chuyển tiếp, vị trí trong DOM, và điều gì vừa xuất hiện hay biến mất. Nếu thiếu **một**
dữ kiện quyết định, hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một quyết định hoặc một câu
hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm biểu tượng vào nút để nhìn rõ hành động | Biểu tượng không thêm hành động nào | `FOCUS-0` | `aria-hidden="true"`, không class CSS |
| Cho cả thẻ bấm được, tiêu đề vẫn là liên kết | Hai đích trùng nhau ⇒ chỉ giữ một điểm dừng | `FOCUS-0` | ảnh bỏ liên kết, liên kết tiêu đề `after:absolute after:inset-0` |
| Đặt nút Xác nhận bên phải, Huỷ bên trái | Thứ tự thao tác quyết định thứ tự mã đánh dấu | `FOCUS-1` | viết Huỷ trước, **không** `flex-row-reverse` |
| Bỏ cái viền xanh xấu quanh nút | Chỉ báo là bắt buộc, chỉ được thay chứ không được bỏ | `FOCUS-2` | `focus-visible:outline-2 focus-visible:outline-offset-2` |
| Mở hộp xác nhận trước khi xoá | Nền không dùng được nữa | `FOCUS-3` | bẫy + `Escape` + `inert` nền |
| Đóng hộp xác nhận | Đường đi phải quay về chỗ đã rời | `FOCUS-4` | ref chỗ mở, `.focus()` |
| Xoá xong thì đứng ở đâu | Chỗ mở đã chết theo hành động | `FOCUS-4` | tiêu điểm dòng kế tiếp, không phải `<body>` |
| Phần đầu mười liên kết lặp ở mọi trang | Khối lặp chắn giữa đầu tài liệu và nội dung | `FOCUS-5` | bỏ qua liên kết đứng đầu `<body>` |
| Bộ lọc năm nhãn nhỏ chọn một | Chọn một trong nhiều cùng loại | `FOCUS-6` | `tabindex` luân chuyển, mũi tên đi bên trong |
| Ba nút Lưu / Xem trước / Xoá | Ba việc khác nhau | `FOCUS-1` | mỗi nút một điểm dừng |
| Đổi trang mà không tải lại | Chỗ tiêu điểm cũ không còn giải thích được nội dung mới | `FOCUS-7` | `.focus()` vào tiêu đề, `tabIndex={-1}` |
| Hiện tóm tắt lỗi ở đầu biểu mẫu | Nội dung mới do người dùng yêu cầu | `FOCUS-7` | `role="alert"`, `tabIndex={-1}`, `.focus()` |
| Hiện thông báo nổi "đã lưu" | Người dùng không yêu cầu nội dung này | *không dời tiêu điểm* | `role="status"` |
| Khung gợi ý dưới ô tìm kiếm | Lớp không sở hữu màn hình | `FOCUS-6` + `FOCUS-7` | mở thì đưa vào, mũi tên đi trong, **không** giam |

Dòng cuối là chỗ hay bị hỏi ngược nhất. Câu phân định **chỉ** được hỏi khi thật sự chưa rõ: *"Trong
lúc lớp này mở, phần nền có còn dùng được không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `FOCUS-0` / `FOCUS-1` | Nút DOM này có làm được việc gì mà chỗ khác chưa cho làm không? |
| `FOCUS-0` / `FOCUS-6` | Nút DOM này không tới được bằng **mọi** phím, hay chỉ không tới được bằng `Tab`? |
| `FOCUS-1` / `FOCUS-2` | Câu hỏi là *dừng ở đâu* hay *có nhìn thấy chỗ dừng không*? |
| `FOCUS-1` / `FOCUS-6` | Người dùng đang chọn một trong nhiều cùng loại, hay làm lần lượt nhiều việc khác nhau? |
| `FOCUS-3` / `FOCUS-7` | Trong lúc lớp này mở, phần nền có còn dùng được không? |
| `FOCUS-3` / bẫy bàn phím | Có `Escape` và có nút đóng nhìn thấy được không? |
| `FOCUS-4` / `FOCUS-7` | Tiêu điểm đi **lùi** về thứ đã gây ra, hay đi **tới** thứ vừa xuất hiện? |
| `FOCUS-5` / `FOCUS-1` | Khối chắn phía trước có lặp lại ở **mọi** trang không? |
| `FOCUS-7` / không làm gì | Người dùng có **yêu cầu** nội dung này không? |

## Sai lầm lặp lại nhiều nhất

1. Đảo thứ tự bằng `flex-row-reverse` / `order-*` rồi tưởng đã đổi cả đường đi bàn phím.
2. `focus:outline-none` cho "sạch" mà không vẽ thứ gì thay thế.
3. Ẩn bằng `opacity-0` hoặc dịch ra ngoài màn hình, rồi để nguyên nó trong đường đi.
4. Hộp thoại giam được nhưng không có `Escape` — biến 2.4.3 thành vi phạm 2.1.2.
5. Đóng lớp xong bỏ tiêu điểm rơi xuống `<body>`.
6. Xoá một dòng mà không gọi tên người kế nhiệm.
7. Mỗi thẻ tab, mỗi nhãn nhỏ lọc là một điểm dừng, khiến một thành phần tiện ích nuốt hai chục lần `Tab`.
8. Bỏ qua liên kết đặt sau phần đầu, hoặc đích thiếu `tabIndex={-1}`.
9. Đổi tuyến trang mà tiêu điểm vẫn nằm ở liên kết cũ của trang cũ.
10. `tabindex` dương, "chỉ một chỗ thôi mà" — và cả tài liệu đổi thứ tự.
11. `aria-hidden="true"` trên một nút DOM vẫn nhận được tiêu điểm: dừng ở một chỗ không có tên.
12. Đặt `tabIndex={0}` lên `<div>` bố cục để "cho nó bấm được".
