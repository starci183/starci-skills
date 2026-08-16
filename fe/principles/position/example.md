---
id: fe-principles-position-example
title: example.md
slug: /fe/principles/position/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã POSITION-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `position` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định duy nhất.

Vị trí hầu như luôn xuất hiện **theo cặp trên hai tầng**: một `POSITION-2` ở tầng cha và một
`POSITION-3` ở tầng con. Vì vậy các ví dụ lồng nhau ở đây không phải phần nâng cao — chúng là hình
dạng bình thường của luật này.

---

## `POSITION-1` — dòng chảy bình thường, không phát class CSS

### Trường hợp: biểu mẫu đọc từ trên xuống

```tsx
<form className="flex flex-col gap-4">
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="email">Email</label>
    <input className="rounded-md border px-3 py-2" id="email" type="email" />
  </div>
  <button className="self-start rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">
    Lưu thay đổi
  </button>
</form>
```

Không có phần tử nào đè lên phần tử nào, và nút phải nằm sau bằng chứng mà nó tác động.

### Trường hợp: lỗi nội tuyến phải đẩy các trường nhập liệu sau xuống

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="slug">Đường dẫn</label>
  <input aria-describedby="slug-error" aria-invalid className="rounded-md border px-3 py-2" id="slug" />
  <p className="text-sm text-red-600" id="slug-error">Đường dẫn này đã được dùng.</p>
</div>
```

Thông báo lỗi **phải** chiếm chỗ. Đặt nó `absolute` để "bố cục khỏi nhảy" là đổi một vấn đề nhìn thấy
được lấy một vấn đề chồng chữ không nhìn thấy được.

### Trường hợp: thanh công cụ căn hai đầu

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <h2 className="font-medium">Đơn hàng</h2>
  <div className="flex items-center gap-2">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Xuất file</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Tạo mới</button>
  </div>
</div>
```

"Bên trái và bên phải" là **phân phối khoảng trống**, việc của chủ sở hữu. Nó không phải bằng chứng để rời
luồng.

### Trường hợp: một hàng hồ sơ — cha sở hữu cách xếp

```tsx
<div className="flex items-center gap-3">
  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  <span className="flex min-w-0 flex-col gap-1">
    <strong className="truncate">Nguyễn Văn An</strong>
    <span className="truncate text-sm text-neutral-500">an.nguyen@example.com</span>
  </span>
  <button className="ml-auto shrink-0 rounded-md border px-3 py-2 text-sm" type="button">Sửa</button>
</div>
```

### Trường hợp: tiêu đề dài phải xuống dòng, không được đè lên siêu dữ liệu

```tsx
<article className="flex items-start justify-between gap-3">
  <div className="min-w-0">
    <h3 className="font-medium">Thiết kế hệ thống hàng đợi chịu lỗi cho luồng thanh toán</h3>
    <p className="mt-1 text-sm text-neutral-500">Cập nhật 3 ngày trước</p>
  </div>
  <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs">Nháp</span>
</article>
```

`min-w-0` và `shrink-0` là hình học của chữ. Chữ dài là bài toán của wrapping, không phải của toạ độ.

### Trường hợp: một vùng đổi trạng thái — bốn trạng thái, một mã

```tsx
<section className="flex flex-col gap-3">
  <h2 className="font-medium">Bài đã nộp</h2>
  {status === "loading" && <div className="h-24 rounded-lg bg-neutral-100" />}
  {status === "empty" && <p className="rounded-lg border p-6 text-sm text-neutral-500">Chưa có bài nộp nào.</p>}
  {status === "error" && <p className="rounded-lg border border-red-200 p-6 text-sm text-red-700">Không tải được.</p>}
  {status === "ready" && <ul className="divide-y rounded-lg border">{/* rows */}</ul>}
</section>
```

Bốn trạng thái thay nhau trong **cùng một chỗ**. Trạng thái không tạo ra hệ toạ độ mới, nên cả bốn
dùng chung `POSITION-1`.

### Ngoại lệ và nhầm lẫn

- **Không viết `static`.** Vắng mặt class CSS là một sự kiện khác với việc khai báo `static`.

  ```tsx
  {/* SAI */}  <div className="static flex flex-col gap-3">…</div>
  {/* ĐÚNG */} <div className="flex flex-col gap-3">…</div>
  ```

- **`relative` trên lớp bọc mà không có con được định vị là vi phạm vô hình.**

  ```tsx
  {/* SAI — không có con nào absolute; relative này render y hệt như không có, và sẽ bắt nhầm
      một absolute được thêm vào sau này */}
  <div className="relative flex flex-col gap-3">
    <h2 className="font-medium">Tổng quan</h2>
    <p className="text-sm text-neutral-500">Ba mươi ngày gần nhất.</p>
  </div>
  ```

- **Dùng `absolute` để căn chỉnh là đổi sai lầm này lấy sai lầm khác:**

  ```tsx
  {/* SAI — nút không đè lên gì cả, nó chỉ cần được đẩy về cuối hàng */}
  <div className="relative">
    <h2 className="font-medium">Đơn hàng</h2>
    <button className="absolute end-0 top-0" type="button">Tạo mới</button>
  </div>

  {/* ĐÚNG */}
  <div className="flex items-center justify-between gap-3">
    <h2 className="font-medium">Đơn hàng</h2>
    <button type="button">Tạo mới</button>
  </div>
  ```

  Bản `absolute` hỏng ngay khi tiêu đề dài ra: chữ chui xuống dưới nút thay vì đẩy nút đi.

- **Không dùng vị trí để sửa thứ tự đọc.** Nếu trên màn hình rộng cụm tóm tắt phải nằm bên phải
  nhưng trong DOM nó phải nằm sau nội dung chính, đó là việc của thứ tự lưới rãnh, không phải việc
  kéo nó ra khỏi luồng.

---

## `POSITION-2` — làm chủ hệ toạ độ

### Trường hợp: ảnh thu nhỏ làm gốc toạ độ cho nhãn trạng thái

```tsx
<div className="relative overflow-hidden rounded-xl border">
  <img alt="Ảnh xem trước bài giảng" className="aspect-video w-full object-cover" src={preview} />
  <span className="absolute end-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">Mới</span>
</div>
```

Đây là **cặp chuẩn**: cha là `POSITION-2`, con là `POSITION-3`. `relative` ở đây có việc để làm và
gọi tên được con của nó, nên nó hợp lệ.

### Trường hợp: vỏ ô nhập chừa sẵn chỗ cho nút xoá

```tsx
<div className="relative">
  <input aria-label="Tìm kiếm" className="w-full rounded-md border py-2 pe-10 ps-3" />
  <button
    aria-label="Xoá từ khoá"
    className="absolute end-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-500"
    type="button"
  >
    ×
  </button>
</div>
```

`pe-10` trên ô nhập liệu là phần **giữ chỗ** mà `absolute` không tự làm được. Bỏ `pe-10` đi thì chữ chạy
xuống dưới nút.

### Trường hợp: khung cắt hoạ tiết trang trí

```tsx
<section className="relative overflow-hidden rounded-xl border p-6">
  <span aria-hidden className="absolute -end-8 -top-8 size-32 rounded-full bg-neutral-100" />
  <div className="relative flex flex-col gap-1">
    <span className="text-2xl font-semibold tabular-nums">7</span>
    <span className="text-sm text-neutral-500">ngày học liên tiếp</span>
  </div>
</section>
```

`relative` thứ hai trên cụm nội dung **có việc**: nó nâng nội dung lên trên hoạ tiết mà không phải
thêm một tầng chỉ số xếp chồng trên chính hoạ tiết. Không có con được định vị thì `relative` đó sẽ là thừa.

### Trường hợp: khung ảnh đại diện mang chấm trạng thái

```tsx
<span className="relative inline-block">
  <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  <span aria-hidden className="absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-emerald-500" />
  <span className="sr-only">Đang hoạt động</span>
</span>
```

Chấm màu là trang trí, nên trạng thái thật vẫn phải tồn tại trong luồng ở dạng đọc được.

### Ngoại lệ và nhầm lẫn

- **`relative` không có con được định vị là thừa.** Xoá đi.
- **`relative` mà lại có khoảng tách là một quyết định khác:**

  ```tsx
  {/* SAI — relative + offset tự dịch chính mình, để lại một lỗ trống đúng bằng kích thước cũ */}
  <div className="relative top-2">…</div>
  ```

  Muốn đẩy một phần tử đi mà vẫn giữ chỗ cũ thì đó gần như luôn là một sai lầm về khoảng cách giữa các phần tử giữa các
  phần tử cùng cấp, không phải một quyết định về vị trí.

- **Đừng rải `relative` "cho chắc".** Một `relative` đặt sẵn ở tầng ngoài sẽ **cướp** điểm neo của một
  `absolute` được thêm vào tầng trong sau này, và lỗi đó chỉ lộ ra ở màn hình khác:

  ```tsx
  {/* SAI — con muốn bám vào card, nhưng ancestor positioned gần nhất là cái wrapper thừa */}
  <div className="relative">
    <div className="rounded-xl border p-4">
      <span className="absolute end-2 top-2">Mới</span>
    </div>
  </div>

  {/* ĐÚNG — owner là chính cái card mà badge phải bám vào */}
  <div>
    <div className="relative rounded-xl border p-4">
      <span className="absolute end-2 top-2">Mới</span>
    </div>
  </div>
  ```

---

## `POSITION-3` — bám vào một phần tử tổ tiên được gọi tên

### Trường hợp: lớp dải chuyển màu để chữ đọc được trên ảnh

```tsx
<div className="relative overflow-hidden rounded-xl">
  <img alt="" className="aspect-[16/9] w-full object-cover" src={cover} />
  <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
  <h3 className="absolute inset-x-4 bottom-4 text-lg font-medium text-white">Nền tảng hệ phân tán</h3>
</div>
```

Hai con cùng bám một chủ sở hữu. Chúng **đè lên nhau có chủ đích** — đó mới là bằng chứng để rời luồng.

### Trường hợp: huy hiệu số trên nút thông báo

```tsx
<button aria-label="Thông báo, 3 mục chưa đọc" className="relative rounded-md border p-2" type="button">
  <svg aria-hidden className="size-5" />
  <span
    aria-hidden
    className="absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs text-white"
  >
    3
  </span>
</button>
```

Con số đã nằm trong `aria-label`, nên huy hiệu được phép là trang trí thuần.

### Trường hợp: thanh tiến độ mảnh ở mép dưới thẻ

```tsx
<article className="relative overflow-hidden rounded-xl border p-4">
  <h3 className="font-medium">Hàng đợi và độ trễ</h3>
  <p className="mt-1 text-sm text-neutral-500">8 / 12 bài</p>
  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-neutral-200">
    <span className="block h-full w-2/3 bg-neutral-900" />
  </span>
</article>
```

### Trường hợp: nhãn giảm giá trên ảnh sản phẩm

```tsx
<div className="relative">
  <img alt="Bộ tài liệu luyện tập" className="aspect-square w-full rounded-lg object-cover" src={thumb} />
  <span className="absolute start-2 top-2 rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">-20%</span>
</div>
```

### Trường hợp: lồng ba tầng — `POSITION-1` chứa `POSITION-2` chứa `POSITION-3`

```tsx
<ul className="divide-y rounded-lg border">
  {items.map((item) => (
    <li className="flex items-center gap-3 p-4" key={item.id}>
      <span className="relative shrink-0">
        <img alt="" className="size-12 rounded-md object-cover" src={item.thumb} />
        {item.isNew && (
          <span className="absolute -end-1 -top-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white">
            Mới
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate">{item.title}</strong>
        <span className="block truncate text-sm text-neutral-500">{item.author}</span>
      </span>
    </li>
  ))}
</ul>
```

Cả ba mã cùng có mặt trong một cây, mỗi mã trên **một** phần tử: `li` là `POSITION-1` vì nó phải đẩy
hàng sau; khung ảnh là `POSITION-2` vì có nhãn trạng thái cần gốc toạ độ; nhãn trạng thái là `POSITION-3` vì nó rời luồng
và bám khung ảnh. Đọc từ ngoài vào trong, mỗi tầng chỉ khai một vai trò — đó là cách duy nhất nhìn
thấy luật này.

### Ngoại lệ và nhầm lẫn

- **`absolute` mà không có chủ sở hữu được gọi tên là bay tự do:**

  ```tsx
  {/* SAI — không ancestor nào positioned, badge bám vào gốc tài liệu */}
  <div className="rounded-xl border">
    <img alt="" className="w-full" src={cover} />
    <span className="absolute end-2 top-2">Mới</span>
  </div>
  ```

- **`absolute` không chừa chỗ; chủ sở hữu phải chừa:**

  ```tsx
  {/* SAI — chữ chạy tuột xuống dưới nút xoá */}
  <div className="relative">
    <input className="w-full rounded-md border px-3 py-2" />
    <button className="absolute end-1 top-1/2 -translate-y-1/2 p-2" type="button">×</button>
  </div>
  ```

  Bản đúng thêm `pe-10` cho ô nhập liệu, như trường hợp ở `POSITION-2`.

- **Nhãn trạng thái là thông tin duy nhất thì không được là trang trí:**

  ```tsx
  {/* SAI — trạng thái chỉ tồn tại dưới dạng một chấm màu */}
  <span className="absolute end-0 top-0 size-2 rounded-full bg-red-500" />

  {/* ĐÚNG — chấm màu là presentation, trạng thái vẫn có mặt trong flow */}
  <>
    <span aria-hidden className="absolute end-0 top-0 size-2 rounded-full bg-red-500" />
    <span className="sr-only">Có mục chưa đọc</span>
  </>
  ```

- **`absolute` bên trong `absolute` vẫn cần một chủ sở hữu riêng.** Một `absolute` **không** tự trở thành
  gốc toạ độ trừ khi nó cũng được khai là chủ sở hữu của con:

  ```tsx
  <div className="relative">
    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70">
      {/* con này đo từ chính lớp gradient, vì absolute cũng là positioned */}
      <span className="absolute end-3 bottom-3 text-xs text-white">12:04</span>
    </div>
  </div>
  ```

  Ở đây `absolute` tầng ngoài đóng cả hai vai: nó là `POSITION-3` với cha, và là gốc toạ độ cho con.
  Đó là ngoại lệ duy nhất mà một phần tử mang hai vai — và nó vẫn chỉ mang **một** class CSS vị trí.

- **Đừng dùng `absolute` để "giữ bố cục khỏi nhảy" khi kiểm tra tính hợp lệ.** Chỗ của thông báo lỗi phải được
  chừa sẵn trong luồng, hoặc chấp nhận là nó đẩy.

---

## `POSITION-4` — bám khung nhìn

### Trường hợp: lớp phủ chặn tương tác

```tsx
<div className="fixed inset-0 z-50 bg-black/50" />
```

Lớp phủ thuộc về **màn hình**, không thuộc về phần nội dung nào, và không đẩy nội dung nào.

### Trường hợp: nút hành động nổi trên thiết bị di động

```tsx
<button
  className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] end-4 z-40 rounded-full bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg lg:hidden"
  type="button"
>
  Ghi chú mới
</button>
```

`env(safe-area-inset-bottom)` là hệ quả trực tiếp của việc **khung nhìn** sở hữu phần tử: chủ sở hữu có
mép vật lý, và mép đó phải được tôn trọng.

### Trường hợp: vùng xếp thông báo nổi

```tsx
<div aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:inset-x-auto sm:end-4 sm:w-80">
  {toasts.map((toast) => (
    <div className="rounded-lg border bg-white p-3 text-sm shadow-lg" key={toast.id}>
      {toast.message}
    </div>
  ))}
</div>
```

Đổi từ tràn ngang trên thiết bị di động sang cột hẹp bên phải trên màn rộng **không** đổi mã: chủ sở hữu vẫn là
khung nhìn.

### Trường hợp: thanh chấp thuận, và chỗ nó không tự chừa

```tsx
<>
  <main className="pb-24">…nội dung trang…</main>
  <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white p-4">
    <p className="text-sm">Trang này dùng cookie để ghi nhớ lựa chọn của bạn.</p>
  </div>
</>
```

`pb-24` trên `main` là bằng chứng của luật "`fixed` không giữ chỗ". Thiếu nó thì dòng cuối cùng của
trang nằm vĩnh viễn dưới thanh này.

### Ngoại lệ và nhầm lẫn

- **"Luôn nhìn thấy" chưa phải `fixed`.** Đó là câu hỏi chưa trả lời giữa `POSITION-4` và
  `POSITION-5`. Phép thử: cuộn tới cuối vùng chứa — nó **biến mất theo** vùng chứa (`POSITION-5`) hay
  vẫn ở đó (`POSITION-4`)?
- **`fixed` bên trong một phần tử tổ tiên có `transform` sẽ đo theo phần tử tổ tiên đó, không theo khung nhìn.** Nếu
  nghiệp vụ nói khung nhìn thì `fixed` phải nằm ngoài mọi phần tử tổ tiên có transform/bộ lọc; nếu không thể
  thì tình huống đã bị mô tả sai và phải quay lại kiểm tra chủ sở hữu.
- **Đừng dùng `fixed` cho tiêu đề bảng.** Tiêu đề bảng thuộc về bảng, nên nó dừng khi bảng hết — đó
  là `POSITION-5`.

---

## `POSITION-5` — bám cuộn phần tử tổ tiên tới một ngưỡng

### Trường hợp: hàng tiêu đề cột trong vùng cuộn

```tsx
<div className="max-h-80 overflow-y-auto rounded-lg border">
  <div className="sticky top-0 z-10 grid grid-cols-3 gap-3 border-b bg-white p-3 text-sm font-medium">
    <span>Tên</span>
    <span>Trạng thái</span>
    <span>Cập nhật</span>
  </div>
  <ul className="divide-y">{/* rows */}</ul>
</div>
```

Đủ **ba** dữ kiện: cuộn phần tử tổ tiên là `max-h-80 overflow-y-auto`, ngưỡng là `top-0`, nền đục là
`bg-white`. Thiếu bất kỳ cái nào là chưa đủ để phát `sticky`.

### Trường hợp: mục lục bên cạnh bài viết dài

```tsx
<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
  <article className="min-w-0">…nội dung dài…</article>
  <nav className="sticky top-4 self-start hidden lg:flex lg:flex-col lg:gap-2">
    <a className="text-sm text-neutral-500" href="#a">Đặt vấn đề</a>
    <a className="text-sm text-neutral-500" href="#b">Đánh đổi</a>
  </nav>
</div>
```

`self-start` là bắt buộc: một phần tử lưới bị kéo cao bằng cả rãnh thì không còn khoảng nào để trôi, và
`sticky` sẽ trông như không hoạt động.

### Trường hợp: thanh hành động ghim đáy một khung cuộn

```tsx
<div className="flex max-h-96 flex-col overflow-y-auto rounded-lg border">
  <div className="flex flex-col gap-3 p-4">…các điều khoản…</div>
  <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-3">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Đồng ý</button>
  </div>
</div>
```

Thanh này dừng lại **cùng khung**, không đi theo màn hình — đó là điều tách nó khỏi `POSITION-4`.

### Trường hợp: tiêu đề nhóm trong danh sách dài

```tsx
<div className="max-h-96 overflow-y-auto rounded-lg border">
  {groups.map((group) => (
    <section key={group.id}>
      <h3 className="sticky top-0 border-b bg-neutral-50 px-4 py-2 text-xs font-medium uppercase text-neutral-500">
        {group.label}
      </h3>
      <ul className="divide-y">{/* rows */}</ul>
    </section>
  ))}
</div>
```

Mỗi tiêu đề dính ở đỉnh **trong phạm vi phần nội dung của nó** rồi bị tiêu đề sau đẩy đi. Hành vi đó có
được là nhờ ranh giới của cha, không phải nhờ một class CSS riêng.

### Trường hợp: tóm tắt giỏ hàng bám theo khi cuộn danh mục

```tsx
<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
  <section className="min-w-0">…danh mục…</section>
  <aside className="lg:sticky lg:top-24 rounded-xl border p-4">
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-neutral-500">Tạm tính</span>
      <span className="font-semibold tabular-nums">1.298.000đ</span>
    </div>
  </aside>
</div>
```

Trên thiết bị di động nó chỉ là `POSITION-1` xếp chồng; trên màn rộng nghiệp vụ yêu cầu nó bám cuộn. Đây là
trường hợp **vai trò thật sự thay đổi**, nên hai mã cho hai điểm ngắt là hợp lệ — khác hẳn với việc
bẻ một mã theo bề rộng màn hình.

### Ngoại lệ và nhầm lẫn

- **`sticky` không ngưỡng là không có hành vi:**

  ```tsx
  {/* SAI — không có top-* hay bottom-*, không có điểm dừng nào để nói là đúng */}
  <div className="sticky z-10 bg-white">…</div>
  ```

- **`sticky` trong suốt là chồng chữ:**

  ```tsx
  {/* SAI — nội dung trôi qua bên dưới và đọc lẫn vào tiêu đề */}
  <div className="sticky top-0">Tên · Trạng thái · Cập nhật</div>
  ```

- **`sticky` chết lặng khi một phần tử tổ tiên có `overflow-hidden`:**

  ```tsx
  {/* SAI — overflow-hidden ở cha cắt mất scroll ancestor mà sticky cần */}
  <div className="overflow-hidden rounded-xl border">
    <div className="max-h-80 overflow-y-auto">
      <div className="sticky top-0 bg-white">…</div>
    </div>
  </div>
  ```

  `overflow-hidden` để bo góc là lý do phổ biến nhất khiến `sticky` "không chạy" mà không báo lỗi gì.

- **`sticky` không phải `fixed` viết ngắn.** `sticky` giữ chỗ; bỏ nó ra thì bố cục co lại.

---

## `POSITION-6` — vị trí gắn liền với vòng đời tương tác

### Trường hợp: trình đơn thả xuống — đây là thứ **không** được viết ra

```tsx
{/* SAI — toạ độ đúng, mọi thứ còn lại thiếu: không lật khi chạm mép màn hình, không bẫy focus,
    không trả focus về trigger, không đóng bằng Escape hay bấm ra ngoài, không khai vai trò */}
<div className="relative">
  <button onClick={() => setOpen(!open)} type="button">Tuỳ chọn</button>
  {open && (
    <div className="absolute end-0 top-full mt-2 w-48 rounded-md border bg-white p-1 shadow-lg">
      <button className="block w-full px-3 py-2 text-left text-sm" type="button">Đổi tên</button>
      <button className="block w-full px-3 py-2 text-left text-sm" type="button">Xoá</button>
    </div>
  )}
</div>
```

Đoạn trên trông đúng trong ảnh chụp và sai với bàn phím, sai với trình đọc màn hình, và sai khi
điều kiện nằm sát mép phải. Mô-đun này **không phát ra class CSS** cho tình huống này: `absolute` chỉ giải
được phần dễ nhất và im lặng bỏ mất phần còn lại. Lớp tương tác — bất kể giao diện đó dùng thứ gì —
mới là nơi sở hữu va chạm, tiêu điểm và đóng mở.

### Trường hợp: chú giải trên biểu tượng

```tsx
{/* SAI — tooltip viết tay bằng hover thuần: không có đường vào bằng bàn phím, không tự tránh mép */}
<span className="group relative">
  <svg aria-hidden className="size-4" />
  <span className="absolute bottom-full start-1/2 hidden -translate-x-1/2 rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
    Điểm trung bình 30 ngày
  </span>
</span>
```

Nếu thông tin đó cần thiết cho việc hiểu con số, nó không được chỉ tồn tại khi rê chuột. Hoặc đưa nó
vào luồng, hoặc giao cho lớp tương tác.

### Trường hợp: `POSITION-4` và `POSITION-6` lồng nhau

```tsx
<div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
  <div aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-6" role="dialog">
    <h2 className="font-medium">Xoá bản nháp?</h2>
    <p className="mt-2 text-sm text-neutral-500">Hành động này không thể hoàn tác.</p>
    <div className="mt-4 flex justify-end gap-2">
      <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
      <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white" type="button">Xoá</button>
    </div>
  </div>
</div>
```

Lớp phủ là `POSITION-4` thật: nó bám khung nhìn và hình học của nó đã đầy đủ. Cái nằm **bên trong** nó
là `POSITION-6`: bẫy tiêu điểm, trả tiêu điểm về nút đã mở nó, đóng bằng `Escape`, khoá cuộn nền — không thứ
nào trong số đó là một className. Hai mã nằm trên hai phần tử khác nhau của cùng một cây, và trộn
chúng thành một là cách người ta ship ra một hộp thoại mà bàn phím không thoát ra được.

### Ngoại lệ và nhầm lẫn

- **Bám vào cái gì đó ≠ `POSITION-6`.** Nhãn trạng thái trên ảnh thu nhỏ cũng bám, nhưng nó không mở, không
  đóng, không giữ tiêu điểm. Ranh giới nằm ở **vòng đời**, không ở việc có điểm neo hay không.
- **Một lớp phủ đơn thuần không có vòng đời vẫn là `POSITION-4`.** Ví dụ một lớp mờ báo "đang xử lý"
  không nhận tiêu điểm và không có nút đóng.
- **Đừng chép toạ độ của một trình đơn ra khỏi ngữ cảnh của nó.** `absolute end-0 top-full` là đúng cho
  một điều kiện ở giữa màn và sai cho cùng điều kiện đó ở sát mép — mà chỉ lớp tương tác mới biết điều kiện
  đang ở đâu.

---

## Ánh xạ yêu cầu sang một quyết định

Nêu phần tử, việc nó có phải giữ chỗ không, và ai sở hữu toạ độ của nó. Nếu thiếu **một** dữ kiện
quyết định, hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi —
không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Nhãn, ô nhập, gợi ý và nút gửi đọc từ trên xuống | Mọi phần tử đều giữ chỗ trong luồng | `POSITION-1` | không class CSS vị trí |
| Tiêu đề và cụm nút chia hai đầu một hàng, hẹp thì xuống dòng | Chủ sở hữu phân phối khoảng trống | `POSITION-1` | không class CSS vị trí |
| Lỗi nội tuyến hiện dưới trường nhập liệu và đẩy các trường nhập liệu sau xuống | Thông báo tham gia luồng | `POSITION-1` | không class CSS vị trí |
| Vùng nội dung đổi giữa đang tải, rỗng, lỗi, có dữ liệu | Trạng thái không tạo hệ toạ độ mới | `POSITION-1` | không class CSS vị trí |
| Nhãn trạng thái trạng thái nằm ở mép trên ảnh thu nhỏ và đi theo ảnh thu nhỏ | Ảnh thu nhỏ là gốc toạ độ; nhãn trạng thái rời luồng | `POSITION-2` + `POSITION-3` | ảnh thu nhỏ `relative`; nhãn trạng thái `absolute top-2 end-2` |
| Nút xoá nằm trong một vị trí chừa sẵn ở cuối ô nhập | Vỏ ô sở hữu toạ độ và tự chừa chỗ | `POSITION-2` + `POSITION-3` | vỏ `relative`; ô nhập liệu `pe-10`; nút `absolute end-1 top-1/2 -translate-y-1/2` |
| Hoạ tiết trang trí bị khung cắt, không mang nội dung | Khung là điểm neo; trang trí không cần chỗ | `POSITION-2` + `POSITION-3` | khung `relative overflow-hidden`; hoạ tiết `absolute` + khoảng đệm bên trong |
| Lớp chặn phủ kín màn hình, không phụ thuộc cuộn trang | Khung nhìn sở hữu lớp này | `POSITION-4` | `fixed inset-0` |
| Một tiện ích luôn ở góc màn hình khi trang cuộn, không thuộc phần nội dung nào | Quyền sở hữu khung nhìn đã nêu rõ | `POSITION-4` | `fixed` + khoảng đệm bên trong tôn trọng vùng an toàn |
| Nhãn cột giữ chỗ của mình và dừng ở mép trên vùng cuộn của bảng | Bám cuộn phần tử tổ tiên tới ngưỡng | `POSITION-5` | `sticky top-0` + nền đục |
| Mục lục bên cạnh còn thấy trong vùng bài viết rồi dừng ở ranh giới vùng đó | Giữ rãnh của mình, đo theo cuộn phần tử tổ tiên | `POSITION-5` | `sticky top-4 self-start` |
| Thanh nút ở đáy một khung cuộn, chiếm hàng của nó và dừng cùng khung | Hành vi theo cuộn, không theo khung nhìn | `POSITION-5` | `sticky bottom-0` + nền đục |
| Trình đơn mở ra từ một nút, tránh mép màn, đóng bằng Escape | Vị trí gắn với vòng đời | `POSITION-6` | không phát class CSS; giao cho lớp tương tác |
| "Cho nút vào góc trên bên phải" | Thiếu chủ sở hữu toạ độ | — | hỏi *"Phần tử nào là gốc toạ độ?"* |
| "Giữ cho phần đầu luôn nhìn thấy" | Có thể là khung nhìn, có thể là vùng chứa có thể cuộn | — | hỏi *"Nó dừng ở ranh giới vùng cuộn hay bám khung nhìn?"* |
| "Cho thông báo nổi lên trên nội dung" | Chưa rõ giữ chỗ và điểm neo | — | hỏi *"Nội dung sau có phải dịch chuyển khi nó xuất hiện, và nó bám vào phần tử nào?"* |
| "Làm cái thanh dọc này bám dính" | Thiếu ngưỡng | — | hỏi *"Nó phải dừng ở ranh giới trên hay dưới nào?"* |
| "Dùng absolute cho nút thẳng hàng đẹp hơn" | Mong muốn thị giác không phải bằng chứng rời luồng | — | hỏi *"Quan hệ đè lên nhau nào bắt buộc nút phải rời luồng?"* |

Năm dòng cuối là **năm câu hỏi**, không phải năm class CSS. Một yêu cầu thiếu dữ kiện phải luôn sinh ra
**cùng một** câu hỏi ở hai người đọc khác nhau; nếu nó sinh ra hai toạ độ đoán mò thì luật này chưa
làm được việc của nó.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `POSITION-1` / `POSITION-2` | Có con được định vị nào **gọi tên được** đang cần phần tử này làm gốc toạ độ không? |
| `POSITION-1` / `POSITION-3` | Phần tử này có phải chừa chỗ trong luồng không? |
| `POSITION-2` / `POSITION-3` | Phần tử này **là** gốc toạ độ, hay được **đo** từ một gốc toạ độ? |
| `POSITION-3` / `POSITION-4` | Gốc toạ độ là một phần tử tổ tiên cụ thể hay là khung nhìn? |
| `POSITION-4` / `POSITION-5` | Nó dừng ở ranh giới vùng cuộn, hay bám màn hình mãi mãi? |
| `POSITION-1` / `POSITION-5` | Đã có cuộn phần tử tổ tiên **và** ngưỡng chưa? |
| `POSITION-3` / `POSITION-6` | Ngoài toạ độ ra, nó còn phải tránh va chạm, giữ tiêu điểm và tự đóng không? |
| `POSITION-4` / `POSITION-6` | Đây là hình học của lớp phủ, hay là vòng đời của thứ nằm trong nó? |

## Sai lầm lặp lại nhiều nhất

1. Thêm `relative` cho mọi lớp bọc "cho chắc", rồi một `absolute` ở tầng sâu bám nhầm vào nó.
2. Dùng `absolute` để căn chỉnh, rồi vỡ ngay khi chữ dài ra.
3. Coi `fixed` và `sticky` là hai cách viết của "luôn nhìn thấy".
4. Viết `sticky` mà quên ngưỡng, quên nền đục, hoặc để một phần tử tổ tiên `overflow-hidden` giết nó.
5. Quên rằng `absolute` và `fixed` không giữ chỗ, rồi để nội dung nằm vĩnh viễn dưới một thanh ghim.
6. Dựng lại trình đơn, chú giải, hộp thoại bằng class CSS thô và mất tiêu điểm, mất `Escape`, mất va chạm.
7. Để nhãn trạng thái trang trí là nơi **duy nhất** một trạng thái tồn tại.
8. Đổi mã theo điểm ngắt dù vai trò không đổi — hoặc ngược lại, ép một mã gánh hai vai trò thật sự
   khác nhau.
9. Viết `static` thay vì bỏ hẳn class CSS.
