---
id: fe-principles-grid-example
title: example.md
slug: /fe/principles/grid/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã GRID-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `grid` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một hệ cột duy nhất.

---

## `GRID-0` — không có hệ cột

### Trường hợp: luồng tin hoạt động, chỉ đọc theo một chiều

```tsx
<ul className="flex flex-col gap-3">
  {events.map((event) => (
    <li className="rounded-lg border p-4" key={event.id}>
      <p className="text-sm">{event.title}</p>
    </li>
  ))}
</ul>
```

Không ai cần sự kiện thứ ba thẳng mép với sự kiện thứ nhất. Không có hàng thì không có cột.

### Trường hợp: hàng nhãn nhỏ lọc tự xuống dòng

```tsx
<div className="flex flex-wrap items-center gap-2">
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Nền tảng</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Kiến trúc phân tán</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Vận hành</button>
</div>
```

Có xuống hàng, **không** có cột: mỗi nhãn nhỏ rộng theo chữ của nó, và nhãn nhỏ ở hàng dưới không việc gì
phải thẳng mép với nhãn nhỏ ở hàng trên.

### Trường hợp: danh sách có đường phân cách — nhịp nằm trong hàng

```tsx
<ul className="divide-y rounded-lg border">
  {invoices.map((invoice) => (
    <li className="flex items-center justify-between p-4" key={invoice.id}>
      <span className="font-medium">{invoice.plan}</span>
      <span className="tabular-nums">{invoice.amount}</span>
    </li>
  ))}
</ul>
```

### Trường hợp: các bước của một quy trình

```tsx
<ol className="flex flex-col gap-4">
  <li className="flex gap-3">
    <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums">1</span>
    <p className="text-sm">Xác minh email</p>
  </li>
  <li className="flex gap-3">
    <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums">2</span>
    <p className="text-sm">Chọn lộ trình học</p>
  </li>
</ol>
```

### Ngoại lệ và nhầm lẫn

- **Không viết `grid grid-cols-1`.** Một cột là dòng chảy, không phải hệ cột.

  ```tsx
  {/* SAI */}  <ul className="grid grid-cols-1 gap-3">…</ul>
  {/* ĐÚNG */} <ul className="flex flex-col gap-3">…</ul>
  ```

- **`grid-cols-1 md:grid-cols-3` thì lại đúng**, vì ở đây `grid-cols-1` không phải "một cột" — nó là
  bậc cơ sở của một khai báo `GRID-1` có thang. Bỏ nó đi thì cơ sở thừa hưởng ngầm, và thừa hưởng ngầm
  là chỗ số cột đi lạc.

  ```tsx
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">…</div>
  ```

- **`flex flex-wrap` cộng `basis-1/3` là cột giả:**

  ```tsx
  {/* SAI */}
  <div className="flex flex-wrap gap-4">
    <article className="basis-[calc(33.333%-1rem)] rounded-lg border p-4">…</article>
    <article className="basis-[calc(33.333%-1rem)] rounded-lg border p-4">…</article>
  </div>
  ```

  Phép trừ đó phải được tính lại mỗi lần rãnh cột đổi, và nó sai ngay lần đầu ai đó đổi `gap-4` thành
  `gap-6`. Cột là việc của vùng chứa: `grid grid-cols-3 gap-4`.

---

## `GRID-1` — chốt số cột

### Trường hợp: bộ ba ô số liệu

```tsx
<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
  <div className="rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">12</span>
    <p className="text-sm text-neutral-500">khoá đang học</p>
  </div>
  <div className="rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">86</span>
    <p className="text-sm text-neutral-500">bài đã xong</p>
  </div>
  <div className="rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">7</span>
    <p className="text-sm text-neutral-500">ngày liên tiếp</p>
  </div>
</div>
```

`2` chia hết `4` ở cơ sở, `3` chia hết `12` ở `lg`. Cả hai bậc đều nằm trong thang.

### Trường hợp: biểu mẫu hai cột

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="first">Tên</label>
    <input className="rounded-md border px-3 py-2" id="first" />
  </div>
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="last">Họ</label>
    <input className="rounded-md border px-3 py-2" id="last" />
  </div>
</div>
```

### Trường hợp: lưới gói giá — số phần tử đã biết trước

```tsx
<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
  {plans.map((plan) => (
    <article className="flex flex-col gap-4 rounded-xl border p-6" key={plan.id}>
      <h3 className="font-medium">{plan.name}</h3>
      <p className="text-2xl font-semibold tabular-nums">{plan.price}</p>
      <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Chọn gói</button>
    </article>
  ))}
</div>
```

Ba gói là một quyết định sản phẩm, không phải một con số ngẫu nhiên từ dữ liệu — nên số cột được
**hứa**, không được suy ra.

### Trường hợp: lưới ảnh vuông

```tsx
<ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
  {photos.map((photo) => (
    <li className="aspect-square overflow-hidden rounded-md bg-neutral-100" key={photo.id}>
      <img alt={photo.alt} className="size-full object-cover" src={photo.src} />
    </li>
  ))}
</ul>
```

Tỉ lệ ô do `aspect-square` trên **con** giữ, không do rãnh giữ. Rãnh chỉ biết bề ngang.

### Ngoại lệ và nhầm lẫn

- **Số cột ngoài thang là thay đổi luật, không phải lựa chọn:**

  ```tsx
  {/* SAI */}  <div className="grid grid-cols-5 gap-4">…</div>
  {/* SAI */}  <div className="grid gap-4 lg:grid-cols-7">…</div>
  {/* ĐÚNG */} <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">…</div>
  ```

- **Số phần tử đến từ dữ liệu ⇒ `GRID-2`, không phải `GRID-1`.** `grid-cols-3` cho một danh sách trả về
  từ API là chốt một con số mà không ai hứa.
- **Con tự đặt bề rộng là bỏ luật:**

  ```tsx
  {/* SAI */}  <div className="grid grid-cols-3 gap-4"><article className="w-64">…</article></div>
  ```

  Vùng chứa đã cấp một rãnh; con đặt `w-64` là từ chối rãnh đó và tự lệch mép.
- **Đừng thêm lề ngoài ngang lên con để "cho thoáng":**

  ```tsx
  {/* SAI */}  <div className="grid grid-cols-3 gap-4"><article className="mx-2">…</article></div>
  ```

  Rãnh cột là khoảng cách ngang duy nhất giữa các cột. Muốn rộng hơn thì đổi rãnh cột của cả trường nhập liệu.

---

## `GRID-2` — số cột suy ra từ bề rộng tối thiểu

### Trường hợp: kết quả tìm kiếm, số lượng không biết trước

```tsx
<ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
  {results.map((result) => (
    <li className="min-w-0 rounded-lg border p-4" key={result.id}>
      <h3 className="truncate font-medium">{result.title}</h3>
      <p className="text-sm text-neutral-500">{result.summary}</p>
    </li>
  ))}
</ul>
```

Không ai sửa class CSS khi dữ liệu trả về 3 hay 30 phần tử. Đó chính là dấu hiệu của `GRID-2`.

### Trường hợp: `auto-fit` khi một phần tử được phép chiếm cả hàng

```tsx
<ul className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-4">
  {members.map((member) => (
    <li className="rounded-lg border p-4" key={member.id}>{member.name}</li>
  ))}
</ul>
```

Với `auto-fit`, một thành viên duy nhất sẽ **phình hết bề rộng**. Nếu điều đó là sai với thiết kế,
đổi về `auto-fill` — và đây là một quyết định nghiệp vụ ("lúc ít dữ liệu trông thế nào"), không phải
một chi tiết cú pháp.

### Trường hợp: thanh dọc cuộn ngang — số cột suy ra dọc trục cuộn

```tsx
<div className="grid grid-flow-col auto-cols-[16rem] gap-4 overflow-x-auto pb-2">
  {courses.map((course) => (
    <article className="rounded-lg border p-4" key={course.id}>{course.title}</article>
  ))}
</div>
```

### Ngoại lệ và nhầm lẫn

- **`minmax(16rem,1fr)` chứ không phải `minmax(16rem,auto)`.** Với `auto`, rãnh cuối co lại theo nội
  dung và các phần tử không còn bằng nhau — lưới mất mép dọc, tức là mất lý do tồn tại.
- **Không đặt `min-w-*` lên con để thay cho `minmax`:**

  ```tsx
  {/* SAI */}
  <ul className="flex flex-wrap gap-4">
    <li className="min-w-64 flex-1 rounded-lg border p-4">…</li>
  </ul>
  ```

  Cách này cho các hàng khác nhau số phần tử khác nhau **và** bề rộng khác nhau; hàng cuối sẽ giãn ra
  trông như lỗi.
- **`GRID-2` vẫn là vùng chứa.** Nó không được đồng thời giữ `max-w-*` và `mx-auto` — đó là `GRID-4`.

---

## `GRID-3` — rãnh có vai trò cố định

### Trường hợp: thanh dọc bộ lọc và vùng kết quả

```tsx
<div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="flex flex-col gap-4">
    <h3 className="text-sm font-medium">Cấp độ</h3>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" />Nền tảng</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" />Nâng cao</label>
  </aside>
  <section className="min-w-0">…kết quả…</section>
</div>
```

Đổi chỗ hai con thì trang đọc **sai nghĩa**, không chỉ xấu. Đó là phép thử của `GRID-3`.

### Trường hợp: mục lục ghim và bài đọc

```tsx
<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
  <article className="min-w-0 max-w-prose">…nội dung bài…</article>
  <nav className="flex flex-col gap-2 lg:sticky lg:top-24">
    <a className="text-sm text-neutral-500" href="#a">Bối cảnh</a>
    <a className="text-sm text-neutral-500" href="#b">Đánh đổi</a>
  </nav>
</div>
```

`lg:sticky` chỉ đúng trên **một** rãnh. Hành vi hình học riêng của từng bên là bằng chứng của
`GRID-3`.

### Trường hợp: biểu mẫu và khung tóm tắt đơn hàng

```tsx
<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
  <form className="flex flex-col gap-6">…thông tin thanh toán…</form>
  <aside className="rounded-xl border p-6 lg:sticky lg:top-24">
    <h3 className="font-medium">Tóm tắt</h3>
  </aside>
</div>
```

### Ngoại lệ và nhầm lẫn

- **`1fr` không chặn được nội dung không co:**

  ```tsx
  {/* SAI */}  <div className="grid lg:grid-cols-[16rem_1fr] gap-8">…</div>
  {/* ĐÚNG */} <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)] gap-8">…</div>
  ```

  Rãnh `1fr` có min-chiều rộng mặc định là `auto`. Một bảng rộng hoặc một khối mã sẽ đẩy rãnh phình ra
  và nuốt mất thanh dọc. Đây là lỗi runtime chứ không phải lỗi thẩm mỹ.
- **Thêm con thứ ba vào `GRID-3` là sai, không phải "xuống hàng":**

  ```tsx
  {/* SAI */}
  <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)] gap-8">
    <aside>…</aside>
    <section>…</section>
    <aside>…</aside>
  </div>
  ```

  Con thứ ba rơi xuống rãnh đầu ở hàng hai — nó **thừa hưởng vai trò của thanh dọc** mà không ai định
  thế. Cần ba vai trò thì khai ba rãnh.
- **Thanh dọc xếp chồng ở thiết bị di động vẫn là `GRID-3`.** Không có `lg:` thì không có rãnh; nhưng vai trò không
  đổi, nên mã không đổi.

---

## `GRID-4` — trường nhập liệu

### Trường hợp: vỏ trang

```tsx
<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
  <main className="flex flex-col gap-10">…</main>
</div>
```

### Trường hợp: trường nhập liệu và vùng chứa là hai nút DOM — lồng nhau `GRID-4` ⊃ `GRID-1` ⊃ `GRID-5`

```tsx
<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
  <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <article className="rounded-lg border p-4">Đang học</article>
    <article className="rounded-lg border p-4">Đã hoàn thành</article>
    <article className="rounded-lg border p-4">Chứng chỉ</article>
    <article className="rounded-lg border p-4">Chuỗi ngày</article>
  </section>
</div>
```

Ba mã, ba tầng, mỗi tầng một quyết định: nút DOM ngoài là `GRID-4` — nội dung kết thúc ở đâu; nút DOM giữa
là `GRID-1` — có bao nhiêu cột; mỗi `article` là `GRID-5` — nhận đúng một cột và không viết gì cả.
Đây là hình dạng chuẩn của mô-đun này.

### Trường hợp: độ dài dòng đọc lồng trong trường nhập liệu — `GRID-4` thứ hai, và là cái duy nhất được phép

```tsx
<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
  <article className="mx-auto max-w-prose">
    <h1 className="text-2xl font-semibold">Vì sao quorum không chỉ là đếm node</h1>
    <p className="mt-4 text-neutral-700">…</p>
  </article>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Một nút DOM không giữ cả trường nhập liệu lẫn rãnh:**

  ```tsx
  {/* SAI */}
  <div className="mx-auto grid max-w-6xl grid-cols-3 gap-6 px-4">…</div>

  {/* ĐÚNG */}
  <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
    <div className="grid grid-cols-3 gap-6">…</div>
  </div>
  ```

  Nút DOM gộp không sai về điểm ảnh; nó sai vì **không còn chỗ để tràn lề**. Một `GRID-7` phải triệt tiêu
  khoảng đệm trong của trường nhập liệu, và nếu trường nhập liệu cũng chính là lưới thì con phải vừa `col-span-full` vừa đoán đúng
  khoảng đệm trong của chính cha nó ở mọi điểm ngắt.
- **Mỗi phần nội dung tự khai `max-w` là có nhiều trường nhập liệu:**

  ```tsx
  {/* SAI */}
  <section className="mx-auto max-w-5xl px-4">…</section>
  <section className="mx-auto max-w-7xl px-6">…</section>
  ```

  Hai độ dài dòng khác nhau trên cùng một trang là hai lời hứa khác nhau, và người đọc thấy nội dung
  "nhảy vào nhảy ra" khi cuộn.
- **Lề ngoài không nhỏ hơn rãnh cột:**

  ```tsx
  {/* SAI */}  <div className="mx-auto max-w-6xl px-2"><div className="grid grid-cols-3 gap-8">…</div></div>
  {/* ĐÚNG */} <div className="mx-auto max-w-6xl px-8"><div className="grid grid-cols-3 gap-8">…</div></div>
  ```

- **`w-full` không thừa.** Thiếu nó, trường nhập liệu nằm trong một flex/lưới phần tử cha sẽ co theo nội dung và
  `mx-auto` không còn nghĩa gì.

---

## `GRID-5` — một con, đúng một cột

### Trường hợp: mặc định — không viết gì cả

```tsx
<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
  <article className="rounded-lg border p-4">…</article>
  <article className="rounded-lg border p-4">…</article>
</div>
```

### Trường hợp: `min-w-0` để chặn nội dung không co được

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="min-w-0 rounded-lg border p-4">
    <p className="truncate text-sm">bao-cao-quy-4-phien-ban-cuoi-cung-da-duyet.pdf</p>
  </div>
  <div className="min-w-0 rounded-lg border p-4">…</div>
</div>
```

`min-w-0` không phải class CSS cách đặt — nó không đòi thêm cột nào. Đây vẫn là `GRID-5`.

### Trường hợp: một bảng nằm trọn trong một cột

```tsx
<div className="grid gap-6 lg:grid-cols-2">
  <div className="min-w-0 overflow-x-auto rounded-lg border">
    <table className="w-full text-sm">
      <thead><tr><th className="p-3 text-left">Bài</th><th className="p-3 text-right">Điểm</th></tr></thead>
      <tbody><tr><td className="p-3">Quorum</td><td className="p-3 text-right tabular-nums">92</td></tr></tbody>
    </table>
  </div>
  <div className="min-w-0">…</div>
</div>
```

Bảng chạy thuật toán cột riêng của nó. Với mô-đun này nó chỉ là **một** con.

### Ngoại lệ và nhầm lẫn

- **Không viết `col-span-1`:**

  ```tsx
  {/* SAI */}  <article className="col-span-1 rounded-lg border p-4">…</article>
  {/* ĐÚNG */} <article className="rounded-lg border p-4">…</article>
  ```

- **`col-span-1` để "huỷ" một độ trải cột ở điểm ngắt khác thì lại đúng**, vì lúc đó nó là một bậc thật
  trong thang của `GRID-6`, không phải một khai báo thừa:

  ```tsx
  <article className="col-span-2 rounded-lg border p-4 lg:col-span-1">…</article>
  ```

- **Khung chờ giữ nguyên mã và nguyên số cột:**

  ```tsx
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div className="h-24 rounded-lg bg-neutral-200" key={index} />
    ))}
  </div>
  ```

---

## `GRID-6` — một con trải nhiều cột

### Trường hợp: thẻ nổi bật đầu lưới

```tsx
<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
  <article className="col-span-2 rounded-lg border p-6">
    <h3 className="font-medium">Tiếp tục học</h3>
    <p className="text-sm text-neutral-500">Nhất quán trong hệ phân tán · bài 4/12</p>
  </article>
  <article className="rounded-lg border p-4">…</article>
  <article className="rounded-lg border p-4">…</article>
</div>
```

### Trường hợp: biểu đồ cần bề ngang, các ô cạnh nó thì không

```tsx
<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
  <figure className="min-w-0 rounded-lg border p-4 lg:col-span-2">
    <figcaption className="text-sm text-neutral-500">Tiến độ 30 ngày</figcaption>
    <div className="mt-3 h-48 rounded bg-neutral-100" />
  </figure>
  <div className="flex flex-col gap-3 rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">68%</span>
    <span className="text-sm text-neutral-500">hoàn thành</span>
  </div>
</div>
```

### Trường hợp: trạng thái rỗng chiếm cả lưới

```tsx
<div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
  {results.length === 0 ? (
    <p className="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-neutral-500">
      Không có kết quả nào khớp bộ lọc hiện tại.
    </p>
  ) : (
    results.map((result) => <article className="rounded-lg border p-4" key={result.id}>{result.title}</article>)
  )}
</div>
```

`col-span-full` là cách duy nhất đúng ở đây: nó vẫn nằm **trong** lề của trường nhập liệu, chỉ là chiếm hết cột.

### Trường hợp: ô ghi chú dài trong biểu mẫu nhiều cột

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="city">Thành phố</label>
    <input className="rounded-md border px-3 py-2" id="city" />
  </div>
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="zip">Mã bưu chính</label>
    <input className="rounded-md border px-3 py-2" id="zip" />
  </div>
  <div className="flex flex-col gap-3 sm:col-span-2">
    <label className="text-sm font-medium" htmlFor="note">Ghi chú giao hàng</label>
    <textarea className="min-h-24 rounded-md border p-3" id="note" />
  </div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Không giả độ trải cột bằng bề rộng:**

  ```tsx
  {/* SAI */}  <div className="grid grid-cols-3 gap-4"><article className="w-2/3">…</article></div>
  {/* ĐÚNG */} <div className="grid grid-cols-3 gap-4"><article className="col-span-2">…</article></div>
  ```

  `w-2/3` cho hai phần ba của **một** rãnh, cộng thêm một rãnh cột thừa bên phải. Mọi thứ dưới nó lệch
  mép.
- **Độ trải cột không được lớn hơn số cột ở điểm ngắt đó:**

  ```tsx
  {/* SAI */}  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><article className="col-span-3">…</article></div>
  ```

  Ở cơ sở, `col-span-3` trong lưới hai cột bị kẹp về hai và im lặng — không có lỗi, chỉ có một bố cục
  khác với ý định. Độ trải cột có điểm ngắt thì phải có đủ bậc: `col-span-2 lg:col-span-3`.
- **Mọi con đều có độ trải cột cố định ⇒ bạn đang dựng `GRID-3` bằng tay:**

  ```tsx
  {/* SAI */}
  <div className="grid grid-cols-3 gap-8">
    <aside className="col-span-1">…</aside>
    <section className="col-span-2">…</section>
  </div>

  {/* ĐÚNG */}
  <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <aside>…</aside>
    <section className="min-w-0">…</section>
  </div>
  ```

  Bản sai buộc thanh dọc phải rộng đúng một phần ba màn hình 27 inch. Vai trò cần bề rộng riêng, không cần
  một phân số.

---

## `GRID-7` — cố ý phá ra ngoài trường nhập liệu

### Trường hợp: dải nền màu chạm mép trường nhập liệu

```tsx
<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
  <section className="flex flex-col gap-6">
    <h2 className="font-medium">Học viên nói gì</h2>
    <div className="-mx-4 bg-neutral-50 px-4 py-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <p className="text-sm">…</p>
    </div>
    <p className="text-sm text-neutral-500">Nội dung sau đó quay lại đúng lề cũ.</p>
  </section>
</div>
```

`-mx-*` triệt tiêu **đúng** khoảng đệm trong của trường nhập liệu ở **cùng** điểm ngắt, rồi `px-*` trả lại phần lề bên
trong nền. Lệch một bậc là hở nền.

### Trường hợp: thanh dọc cuộn ngang tràn lề trên thiết bị di động — `GRID-7` ⊃ `GRID-2`

```tsx
<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
  <section className="flex flex-col gap-4">
    <h2 className="font-medium">Đang thịnh hành</h2>
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="grid grid-flow-col auto-cols-[16rem] gap-4">
        {courses.map((course) => (
          <article className="rounded-lg border p-4" key={course.id}>{course.title}</article>
        ))}
      </div>
    </div>
  </section>
</div>
```

Hai mã, hai phần tử: nút DOM ngoài là `GRID-7` — nó rời lề để thẻ cuối "chảy" ra mép và người đọc biết
còn nữa ở bên phải; nút DOM trong là `GRID-2` — số cột suy ra từ `auto-cols-[16rem]`. Từ `sm` trở lên
`mx-0` tắt tràn lề, vì lúc đó cả thanh dọc đã vừa trong lề.

### Trường hợp: vùng nổi bật tràn lề hết khung nhìn

```tsx
<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
  <section className="relative left-1/2 w-screen -translate-x-1/2 bg-neutral-900 py-20">
    <div className="mx-auto w-full max-w-6xl px-4 text-white sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Học bằng cách dựng lại hệ thống thật</h1>
    </div>
  </section>
</div>
```

Bên trong khối tràn lề, trường nhập liệu được **khai lại** để chữ vẫn nằm đúng độ dài dòng. Tràn lề là việc của nền,
không phải của nội dung.

### Ngoại lệ và nhầm lẫn

- **`w-screen` bằng `100vw`, và `100vw` tính cả thanh cuộn.** Trên trình duyệt có scrollbar chiếm chỗ,
  khối trên tạo tràn ngang cả trang. Muốn dùng thì tổ tiên phải nhận trách nhiệm:

  ```tsx
  <body className="overflow-x-clip">…</body>
  ```

  Đó là một quyết định của trang, không phải của khối. Chưa có nó thì chưa được tràn lề khung nhìn.
- **Con nằm sâu không được tự đoán khoảng đệm trong của tổ tiên:**

  ```tsx
  {/* SAI */}
  <div className="mx-auto max-w-6xl px-4 lg:px-8">
    <section><div><figure className="-mx-8">…</figure></div></section>
  </div>
  ```

  `-mx-8` chỉ đúng ở `lg`, và sai ở mọi điểm ngắt còn lại. Tràn lề phải là **con trực tiếp** của
  trường nhập liệu, hoặc phải `col-span-full` trước rồi mới rời lề.
- **Muốn rộng hơn một chút không phải tràn lề:**

  ```tsx
  {/* SAI */}  <section className="-mx-2">…</section>
  ```

  Nếu cả trang cần rộng hơn thì sửa `max-w` của trường nhập liệu. Một khối tự nới hai bên là trường nhập liệu sai số được
  vá tại chỗ, và vết vá đó sẽ được sao chép.
- **Tràn lề không được đổi mã của lưới bên trong nó.** Thanh dọc vẫn là `GRID-2` dù đang tràn lề; vùng nổi bật vẫn
  chứa một `GRID-4` khai lại.

---

## Ánh xạ yêu cầu sang một hệ cột

Nêu trường nhập liệu, vùng chứa và vai trò của con. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Liệt kê các hoạt động gần đây, mới nhất lên đầu | Chỉ đọc theo một chiều, không cần mép dọc | `GRID-0` | `flex flex-col gap-3` |
| Cho ba thẻ giá nằm một hàng ở máy tính | Số cột là lời hứa của thiết kế | `GRID-1` | `grid grid-cols-1 gap-6 md:grid-cols-3` |
| Bày kết quả tìm kiếm, thẻ đừng hẹp hơn 16rem | Yêu cầu nói bằng bề rộng, không bằng số lượng | `GRID-2` | `grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4` |
| Thanh dọc lọc bên trái, kết quả bên phải | Hai rãnh có vai trò cố định, không đổi chỗ được | `GRID-3` | `grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]` |
| Nội dung đừng chạy dài hết màn hình lớn | Quyết định nội dung kết thúc ở đâu | `GRID-4` | `mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8` |
| Mỗi khoá học một thẻ trong lưới danh mục | Con nhận đúng rãnh được cấp | `GRID-5` | không class CSS cách đặt |
| Biểu đồ rộng gấp đôi, ô số liệu bên cạnh | Con đòi nhiều hơn một cột của chính lưới đó | `GRID-6` | `lg:col-span-2` |
| Hiện dòng "không có kết quả" giữa lưới | Thông báo phải chiếm hết cột nhưng vẫn trong lề | `GRID-6` | `col-span-full` |
| Vùng nổi bật nền tối chạm hai mép màn hình | Nền phải ra ngoài lề, nội dung thì không | `GRID-7` | `relative left-1/2 w-screen -translate-x-1/2` |
| Xếp các thẻ tính năng cho đẹp | Chưa nêu số lượng có được hứa hay không ⇒ lấy mã đòi ít hơn | `GRID-0` | `flex flex-col gap-4` |

Ở dòng cuối, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ cần mép dọc dùng chung:
*"Thẻ ở hàng dưới có bắt buộc thẳng mép với thẻ ở hàng trên không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `GRID-0` / `GRID-1` | Phần tử ở hàng sau có bắt buộc thẳng mép dọc với hàng trước không? |
| `GRID-1` / `GRID-2` | Số cột là lời hứa của thiết kế, hay hệ quả của bề rộng tối thiểu? |
| `GRID-1` / `GRID-3` | Các con có đổi chỗ cho nhau được không? |
| `GRID-2` / `GRID-3` | Rãnh giống hệt nhau và sinh hàng loạt, hay từng rãnh có tên riêng? |
| `GRID-4` / `GRID-1` | Phần tử này quyết định nội dung kết thúc ở đâu, hay có bao nhiêu cột? |
| `GRID-5` / `GRID-6` | Con này có đòi nhiều hơn một cột không? |
| `GRID-6` / `GRID-7` | Nó dừng ở mép cột cuối, hay đi tiếp ra ngoài lề của trường nhập liệu? |
| `GRID-7` / `GRID-4` | Chỉ khối này cần chạm mép, hay cả trang cần rộng hơn? |

## Sai lầm lặp lại nhiều nhất

1. Một nút DOM vừa `mx-auto max-w-*` vừa `grid-cols-*` — gộp trường nhập liệu vào vùng chứa, rồi không tràn lề
   được nữa.
2. Mỗi phần nội dung tự khai một `max-w` khác nhau, nên trang không có trường nhập liệu nào cả.
3. Chốt `grid-cols-3` cho một danh sách đến từ dữ liệu.
4. Số cột ngoài thang: `grid-cols-5`, `lg:grid-cols-7`.
5. `w-2/3` hoặc `basis-1/3` thay cho `col-span-*`.
6. `1fr` thay vì `minmax(0,1fr)`, rồi một bảng rộng nuốt mất thanh dọc.
7. Viết `col-span-1` hoặc `grid grid-cols-1` cho tình huống không đòi hỏi gì.
8. `-mx-8` trên một con nằm sâu, đoán khoảng đệm trong của tổ tiên ở đúng một điểm ngắt.
9. `w-screen` mà không ai nhận trách nhiệm `overflow-x-clip`.
10. Lưới rỗng hoặc khung chờ đổi số cột so với lưới có dữ liệu.
