---
id: fe-principles-gap-example
title: example.md
slug: /fe/principles/gap/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã GAP-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `gap` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một class CSS duy nhất.

---

## `GAP-0` — không khai báo khoảng cách

### Trường hợp: danh sách có đường phân cách, hàng tự thêm khoảng đệm

```tsx
<ul className="divide-y rounded-lg border">
  <li className="p-4">Thông báo qua email</li>
  <li className="p-4">Thông báo đẩy</li>
  <li className="p-4">Bản tin hằng tuần</li>
</ul>
```

### Trường hợp: bảng xếp hạng — hàng có nội dung, vẫn không khoảng cách

```tsx
<ol className="divide-y rounded-lg border">
  {rows.map((row) => (
    <li className="flex items-center justify-between p-4" key={row.id}>
      <span className="flex items-center gap-2">
        <span className="text-sm text-neutral-500 tabular-nums">{row.rank}</span>
        <span className="font-medium">{row.name}</span>
      </span>
      <span className="text-sm tabular-nums">{row.points}</span>
    </li>
  ))}
</ol>
```

Chú ý hai `gap-2` bên trong: cha của các `li` là `GAP-0`, nhưng bên trong mỗi hàng vẫn có `GAP-2`
riêng. **Mã áp cho một quan hệ, không áp cho cả cây.**

### Trường hợp: lịch sử thanh toán — hàng nhiều dòng

```tsx
<ul className="divide-y rounded-lg border">
  {invoices.map((invoice) => (
    <li className="flex items-center justify-between p-4" key={invoice.id}>
      <span className="flex flex-col gap-1">
        <span className="font-medium">{invoice.plan}</span>
        <span className="text-sm text-neutral-500">{invoice.paidAt}</span>
      </span>
      <span className="tabular-nums">{invoice.amount}</span>
    </li>
  ))}
</ul>
```

### Trường hợp: lệnh trình đơn

```tsx
<div className="divide-y rounded-lg border" role="listbox">
  <button className="flex w-full items-center gap-2 p-3 text-left" type="button">Mở dự án</button>
  <button className="flex w-full items-center gap-2 p-3 text-left" type="button">Tạo tài liệu</button>
  <button className="flex w-full items-center gap-2 p-3 text-left" type="button">Mời thành viên</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Không viết `gap-0`.** Không có khoảng cách giữa các phần tử là trạng thái vắng mặt, không phải một bậc.

  ```tsx
  {/* SAI */}  <ul className="divide-y gap-0">…</ul>
  {/* ĐÚNG */} <ul className="divide-y">…</ul>
  ```

- **Không đường phân cách, không khoảng đệm trong hàng ⇒ không còn là `GAP-0`.** Ba thẻ rời nhau là `GAP-4`.
- **Hai nút cạnh nhau không phải danh sách.** Đó là `GAP-2`.
- **Đường phân cách cộng khoảng cách là nói hai lần một ranh giới:**

  ```tsx
  {/* SAI */}  <ul className="flex flex-col divide-y gap-2">…</ul>
  ```

---

## `GAP-1` — một danh tính, một giá trị

### Trường hợp: tên và tên người dùng

```tsx
<div className="flex flex-col gap-1">
  <strong>Nguyễn Văn An</strong>
  <span className="text-sm text-neutral-500">@an.nguyen</span>
</div>
```

### Trường hợp: số liệu và đơn vị

```tsx
<div className="flex flex-col gap-1">
  <span className="text-2xl font-semibold tabular-nums">42</span>
  <span className="text-sm text-neutral-500">bài đã hoàn thành</span>
</div>
```

### Trường hợp: giá và chu kỳ thanh toán

```tsx
<div className="flex flex-col gap-1">
  <span className="text-2xl font-semibold tabular-nums">499.000đ</span>
  <span className="text-sm text-neutral-500">mỗi tháng</span>
</div>
```

### Trường hợp: tiêu đề và phụ đề ngắn

```tsx
<div className="flex flex-col gap-1">
  <h3 className="font-medium">System Design Mastery</h3>
  <p className="text-sm text-neutral-500">Khoá học chuyên sâu</p>
</div>
```

### Trường hợp: danh tính nằm cạnh ảnh đại diện — hai mã lồng nhau

```tsx
<div className="flex items-center gap-2">
  <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  <span className="flex flex-col gap-1">
    <strong>Nguyễn Văn An</strong>
    <span className="text-sm text-neutral-500">@an.nguyen</span>
  </span>
</div>
```

Cha ngoài là `GAP-2` — ảnh đại diện và cụm chữ cùng tạo **một** tài liệu nhận diện. Cha trong là `GAP-1` —
tên người dùng bổ nghĩa cho tên. Đây là ví dụ chuẩn của luật *một phần tử cha, một quan hệ*.

### Trường hợp: tên tệp và loại tệp

```tsx
<div className="flex flex-col gap-1">
  <span className="truncate font-medium">bao-cao-quy-4.pdf</span>
  <span className="text-xs text-neutral-500">PDF · 2,4 MB</span>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Nhãn + ô nhập liệu là `GAP-3`, không phải `GAP-1`.** Nhãn sở hữu một khối có tương tác chứ không chú
  thích một giá trị.
- **Hai trường nhập liệu là `GAP-4`.** Mỗi trường nhập liệu đã là một nhóm `GAP-3` bên trong.
- **Khung chờ giữ nguyên mã:**

  ```tsx
  <div className="flex flex-col gap-1">
    <span className="h-5 w-40 rounded bg-neutral-200" />
    <span className="h-4 w-24 rounded bg-neutral-200" />
  </div>
  ```

- **Không dùng `margin` trên con để tạo khoảng cách giữa các phần tử:**

  ```tsx
  {/* SAI */}  <div className="flex flex-col"><strong>An</strong><span className="mt-1">@an</span></div>
  ```

---

## `GAP-2` — một khối gọn

### Trường hợp: nhóm hành động

```tsx
<div className="flex items-center gap-2">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Xem trước</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Lưu</button>
</div>
```

### Trường hợp: biểu tượng và nhãn trong một nút

```tsx
<button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" type="button">
  <svg aria-hidden="true" className="size-4" />
  Tải xuống
</button>
```

### Trường hợp: ô nhập liệu và hành động trực tiếp của nó

```tsx
<div className="flex items-center gap-2">
  <input aria-label="Mã giảm giá" className="min-w-0 flex-1 rounded-md border px-3 py-2" />
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Áp dụng</button>
</div>
```

### Trường hợp: một đánh giá là một tài liệu

```tsx
<article className="flex flex-col gap-2">
  <header className="flex items-center gap-2">
    <strong>Mai Lê</strong>
    <span className="text-sm text-neutral-500">★ 5</span>
  </header>
  <p className="text-sm">Phần consistency giải thích trade-off bằng failure scenario.</p>
</article>
```

### Trường hợp: chronology — mốc thời gian và sự kiện là một tài liệu

```tsx
<li className="flex items-baseline gap-2">
  <time className="text-xs tabular-nums text-neutral-500" dateTime="2026-08-16T09:12">09:12</time>
  <span className="text-sm">Đã gửi bài nộp để chấm</span>
</li>
```

### Trường hợp: cụm bộ lọc gọn

```tsx
<div className="flex flex-wrap items-center gap-2">
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đang học</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đã xong</button>
</div>
```

### Trường hợp: cụm giá có giá gốc và mức giảm

```tsx
<div className="flex flex-wrap items-baseline gap-2">
  <span className="text-xl font-semibold tabular-nums">799.000đ</span>
  <span className="text-sm text-neutral-500 line-through tabular-nums">999.000đ</span>
  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">-20%</span>
</div>
```

### Trường hợp: hành động cụm xếp dọc khi hẹp — đổi trục, giữ mã

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Xác nhận</button>
</div>
```

Trục đổi từ dọc sang ngang, quan hệ **không** đổi, nên mã không đổi.

### Ngoại lệ và nhầm lẫn

- **Mốc thời gian chỉ để ghi ngày cho một khối riêng không thuộc tài liệu đó** — lúc đó nó là `GAP-3`:

  ```tsx
  <section className="flex flex-col gap-3">
    <time className="text-xs text-neutral-500" dateTime="2026-08-16">16/08/2026</time>
    <div className="rounded-lg border p-4">…nội dung của ngày hôm đó…</div>
  </section>
  ```

- **Một chữ gọi tên cả nhóm nút thì cụm ngoài lên `GAP-3`:**

  ```tsx
  <div className="flex flex-col gap-3">
    <span className="text-sm font-medium">Hành động</span>
    <div className="flex items-center gap-2">
      <button type="button">Xem trước</button>
      <button type="submit">Lưu</button>
    </div>
  </div>
  ```

- **Trục ngang/dọc không phải tiêu chí.** Một cụm dọc vẫn có thể là `GAP-2`.

---

## `GAP-3` — một phần sở hữu phần kế tiếp

### Trường hợp: nhãn và ô nhập liệu

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="email">Email</label>
  <input className="rounded-md border px-3 py-2" id="email" type="email" />
</div>
```

### Trường hợp: tiêu đề và thẻ mà nó gọi tên

```tsx
<section className="flex flex-col gap-3">
  <h2 className="font-medium">Khoá học của tôi</h2>
  <div className="rounded-lg border p-4">…</div>
</section>
```

### Trường hợp: thanh công cụ và vùng kết quả

```tsx
<div className="flex flex-col gap-3">
  <div className="flex items-center gap-2">
    <input aria-label="Tìm kiếm" className="min-w-0 flex-1 rounded-md border px-3 py-2" />
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Lọc</button>
  </div>
  <div className="rounded-lg border">…kết quả…</div>
</div>
```

Thanh công cụ bên trong là `GAP-2`; thanh công cụ sở hữu vùng kết quả nên cha ngoài là `GAP-3`.

### Trường hợp: các thẻ thẻ tab và nội dung

```tsx
<div className="flex flex-col gap-3">
  <div className="flex items-center gap-2" role="tablist">
    <button role="tab" type="button">Tổng quan</button>
    <button role="tab" type="button">Hoạt động</button>
  </div>
  <div role="tabpanel">…</div>
</div>
```

### Trường hợp: câu hỏi và vùng trả lời

```tsx
<div className="flex flex-col gap-3">
  <p className="font-medium">Vì sao quorum write cần xét failure domain thay vì chỉ đếm node?</p>
  <textarea className="min-h-32 rounded-md border p-3" />
</div>
```

### Trường hợp: hộp kiểm điều khoản và nút gửi

```tsx
<div className="flex flex-col gap-3">
  <label className="flex items-start gap-2 text-sm">
    <input className="mt-0.5" type="checkbox" />
    <span>Tôi đồng ý với điều khoản dịch vụ</span>
  </label>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Tạo tài khoản</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Cả hai bên đều là nhóm ⇒ `GAP-4`, không phải `GAP-3`.**
- **Nhãn + ô nhập liệu + gợi ý là hai quan hệ, phải lồng:**

  ```tsx
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="slug">Đường dẫn</label>
    <div className="flex flex-col gap-1">
      <input className="rounded-md border px-3 py-2" id="slug" />
      <p className="text-xs text-neutral-500">Chỉ dùng chữ thường và dấu gạch ngang.</p>
    </div>
  </div>
  ```

  Nhãn sở hữu trường nhập liệu ⇒ `GAP-3`. Gợi ý bổ nghĩa trường nhập liệu ⇒ `GAP-1`. Một phần tử cha phẳng `gap-3` cho cả ba là
  **sai**, vì nó nói gợi ý và trường nhập liệu là hai thứ ngang cấp với nhãn.

- **Trạng thái lỗi không đổi mã.** Gợi ý đổi màu, đổi nội dung, **giữ chỗ và giữ khoảng cách giữa các phần tử** — nếu không,
  bố cục nhảy mỗi lần kiểm tra tính hợp lệ.

---

## `GAP-4` — hai nhóm ngang hàng

### Trường hợp: cụm hồ sơ và cụm tiến độ

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <div className="flex items-center gap-2">
    <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
    <span className="flex flex-col gap-1">
      <strong>Nguyễn Văn An</strong>
      <span className="text-sm text-neutral-500">@an.nguyen</span>
    </span>
  </div>
  <div className="flex flex-col gap-1">
    <span className="text-2xl font-semibold tabular-nums">68%</span>
    <span className="text-sm text-neutral-500">tiến độ khoá học</span>
  </div>
</div>
```

### Trường hợp: hai trường nhập liệu trong một biểu mẫu

```tsx
<div className="grid gap-4 sm:grid-cols-2">
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

### Trường hợp: biểu đồ và cụm chú giải

```tsx
<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
  <figure className="min-w-0 flex-1">…</figure>
  <ul className="flex flex-col gap-2">
    <li className="flex items-center gap-2"><span className="size-2 rounded-full bg-neutral-900" />Nội dung</li>
    <li className="flex items-center gap-2"><span className="size-2 rounded-full bg-neutral-400" />Thử thách</li>
  </ul>
</div>
```

### Trường hợp: câu hỏi và cụm lựa chọn

```tsx
<div className="flex flex-col gap-4">
  <div className="flex flex-col gap-1">
    <span className="text-xs text-neutral-500">Câu 3 / 10</span>
    <p className="font-medium">Idempotency key giải quyết vấn đề nào?</p>
  </div>
  <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 rounded-md border p-3"><input name="q3" type="radio" />Ghi trùng khi retry</label>
    <label className="flex items-center gap-2 rounded-md border p-3"><input name="q3" type="radio" />Đọc cũ sau khi ghi</label>
  </div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Một bên chỉ là một chữ ⇒ quay về `GAP-3`.** `GAP-4` cần **cả hai** bên đã có cấu trúc.
- **Mỗi bên có tiêu đề và trạng thái tải riêng ⇒ lên `GAP-6`.**
- **Lưới đổi số cột không đổi mã:** `grid gap-4 sm:grid-cols-2` vẫn là `GAP-4` ở mọi bề rộng.

---

## `GAP-6` — hai phần nội dung của một trang

### Trường hợp: tổng quan và hoạt động gần đây

```tsx
<main className="flex flex-col gap-6">
  <section aria-labelledby="overview" className="flex flex-col gap-3">
    <h2 className="font-medium" id="overview">Tổng quan</h2>
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1"><span className="text-2xl font-semibold tabular-nums">12</span><span className="text-sm text-neutral-500">khoá đang học</span></div>
      <div className="flex flex-col gap-1"><span className="text-2xl font-semibold tabular-nums">86</span><span className="text-sm text-neutral-500">bài đã xong</span></div>
      <div className="flex flex-col gap-1"><span className="text-2xl font-semibold tabular-nums">7</span><span className="text-sm text-neutral-500">ngày liên tiếp</span></div>
    </div>
  </section>
  <section aria-labelledby="activity" className="flex flex-col gap-3">
    <h2 className="font-medium" id="activity">Hoạt động gần đây</h2>
    <ul className="divide-y rounded-lg border">
      <li className="p-4">Hoàn thành “Đọc và ghi theo cơ chế quorum”</li>
      <li className="p-4">Nộp bài thử thách “Rate limiter”</li>
    </ul>
  </section>
</main>
```

Ba mã cùng có mặt: `GAP-6` giữa hai phần nội dung, `GAP-3` giữa tiêu đề và nội dung, `GAP-4` giữa ba ô số
liệu, `GAP-1` bên trong mỗi ô, `GAP-0` cho danh sách có đường phân cách.

### Trường hợp: nội dung khoá học và đánh giá học viên

```tsx
<div className="flex flex-col gap-6">
  <section aria-labelledby="curriculum" className="flex flex-col gap-3">
    <h2 className="font-medium" id="curriculum">Nội dung khoá học</h2>
    <ul className="divide-y rounded-lg border">
      <li className="flex items-center justify-between p-4"><span>Nền tảng hệ thống</span><span className="text-sm text-neutral-500">6 bài</span></li>
      <li className="flex items-center justify-between p-4"><span>Khả năng mở rộng</span><span className="text-sm text-neutral-500">10 bài</span></li>
    </ul>
  </section>
  <section aria-labelledby="reviews" className="flex flex-col gap-3">
    <h2 className="font-medium" id="reviews">Đánh giá học viên</h2>
    <div className="flex items-baseline gap-2">
      <span className="text-xl font-semibold tabular-nums">4,9</span>
      <span className="text-sm text-neutral-500">128 đánh giá</span>
    </div>
    <ul className="divide-y rounded-lg border">
      <li className="flex flex-col gap-2 p-4"><strong>An Nguyễn</strong><p className="text-sm">Lab retry buộc mình tìm ra idempotency trước khi chọn implementation.</p></li>
    </ul>
  </section>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Hai thẻ trong cùng một phần nội dung không phải `GAP-6`.** Đó là `GAP-4`.
- **Phần nội dung chỉ có tiêu đề và một con số chưa chứng minh được nó tự đứng độc lập** — chưa đủ để gọi
  là `GAP-6`, và cũng không được dùng làm ví dụ minh hoạ cho mã này.
- **Hai bên tự quyết hình học của mình ⇒ `GAP-8`.**

---

## `GAP-8` — hai vùng bố cục

### Trường hợp: thanh bộ lọc và vùng kết quả

```tsx
<div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="flex flex-col gap-4">
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Cấp độ</h3>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" />Nền tảng</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" />Nâng cao</label>
      </div>
    </div>
  </aside>
  <section className="min-w-0">…kết quả…</section>
</div>
```

### Trường hợp: điều hướng và nội dung

```tsx
<div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
  <nav className="flex flex-col gap-2">
    <a className="rounded-md px-3 py-2 text-sm" href="#a">Bảng điều khiển</a>
    <a className="rounded-md px-3 py-2 text-sm" href="#b">Khoá học</a>
  </nav>
  <main className="min-w-0">…</main>
</div>
```

### Trường hợp: catalog và khung giỏ hàng ghim

```tsx
<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
  <section className="min-w-0">…danh mục…</section>
  <aside className="lg:sticky lg:top-24">…giỏ hàng…</aside>
</div>
```

`lg:sticky` là bằng chứng của `GAP-8`: một bên có hành vi hình học riêng mà bên kia không có.

### Ngoại lệ và nhầm lẫn

- **Thẻ to không phải bố cục vùng.** Kích thước không quyết định mã.
- **Trên thiết bị di động thanh dọc xếp chồng vẫn giữ `gap-8`**, vì vai trò bố cục không đổi, chỉ có trục đổi.
- **Đừng dùng `gap-8` để làm thẻ “thoáng hơn”** — muốn thoáng thì đó là việc của `padding`.

---

## Ánh xạ yêu cầu sang một class CSS

Nêu phần tử cha, các con trực tiếp và quan hệ. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ
thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Hiện tên hiển thị, ngay dưới là tên người dùng | Tên người dùng bổ nghĩa cùng một danh tính | `GAP-1` | `flex flex-col gap-1` |
| Đặt Lưu và Xem trước thành một cụm phát hành | Hai thành phần điều khiển phục vụ một hành động | `GAP-2` | `flex items-center gap-2` |
| Đặt nhãn lên trên trường nhập liệu mà nó gọi tên | Nhãn sở hữu khối kế tiếp | `GAP-3` | `flex flex-col gap-3` |
| Xếp cạnh nhau cụm hồ sơ và cụm tiến độ, mỗi bên có hàng riêng | Hai bên đều là nhóm đã cấu trúc | `GAP-4` | `grid gap-4` |
| Xếp chồng Tổng quan và Hoạt động, mỗi phần có tiêu đề và đang tải riêng | Hai phần nội dung trong một mạch nội dung | `GAP-6` | `flex flex-col gap-6` |
| Dựng thanh bộ lọc và vùng kết quả, mỗi bên tự quyết bề rộng | Hai vùng bố cục độc lập | `GAP-8` | `grid gap-8` |
| Hiển thị các hàng chọn được, có đường phân cách, mỗi hàng tự thêm khoảng đệm | Danh sách đã có nhịp riêng | `GAP-0` | không class CSS khoảng cách |
| Đặt ảnh đại diện, tên và mô tả trên một hàng | Chưa chứng minh mô tả là khối riêng ⇒ lấy bậc nhỏ hơn | `GAP-2` | `flex items-center gap-2` |

Ở dòng cuối, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ cần quan hệ lớn hơn:
*"Mô tả có phải là một khối nội dung được sở hữu độc lập không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `GAP-1` / `GAP-2` | Một con bổ nghĩa một dữ kiện, hay các con cùng tạo một thao tác/tài liệu? |
| `GAP-2` / `GAP-3` | Có một ranh giới dùng chung, hay một con sở hữu một khối? |
| `GAP-3` / `GAP-4` | Một nhóm chi phối nhóm kia, hay hai bên ngang hàng? |
| `GAP-4` / `GAP-6` | Hai nhóm có mục đích và trạng thái riêng ở cấp trang không? |
| `GAP-6` / `GAP-8` | Hai phần nội dung có tự sở hữu hình học bố cục không? |
| `GAP-0` / mọi mã khác | Nhịp đã nằm trong hàng khoảng đệm trong và đường phân cách chưa? |

## Sai lầm lặp lại nhiều nhất

1. Chọn khoảng cách bằng mắt — thấy chật thì tăng một bậc.
2. Dùng `margin` trên con thay vì `gap` trên cha.
3. Một phần tử cha phẳng ôm nhiều quan hệ rồi lấy một giá trị trung bình.
4. Đổi bậc khi thiết kế đáp ứng dù quan hệ không đổi.
5. Vừa `divide-y` vừa `gap`.
6. Viết `gap-0` thay vì bỏ hẳn class CSS.
7. Khung chờ dùng bậc khác nội dung thật.
