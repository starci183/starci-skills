---
id: fe-principles-padding-example
title: example.md
slug: /fe/principles/padding/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã PADDING-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `padding` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Cuối trang là bảng ánh xạ từ yêu cầu bằng lời sang class CSS, và bảng phân định ranh giới.

Đọc theo thứ tự này ở mọi ví dụ:

1. Ai vẽ ranh giới ở đây?
2. Ranh giới đó chịu trách nhiệm cho **nội dung trực tiếp** nào?
3. Có ranh giới thứ hai lồng bên trong không?

---

## `PADDING-0` — thể thứ nhất: không có ranh giới, không khai báo class CSS

### Trường hợp: cụm xếp dọc chỉ để xếp đặt bên trong một khung có sẵn

```tsx
<article className="rounded-xl border p-4">
  {/* stack chỉ tổ chức thứ tự dọc; ranh giới đã do <article> sở hữu */}
  <div className="flex flex-col gap-3">
    <h2 className="font-medium">Tài khoản</h2>
    <p className="text-sm text-neutral-500">Quản lý hồ sơ và thiết lập bảo mật.</p>
  </div>
</article>
```

### Trường hợp: lưới xếp các thẻ ngang hàng

```tsx
<div className="grid gap-4 sm:grid-cols-3">
  <article className="rounded-xl border p-4">…</article>
  <article className="rounded-xl border p-4">…</article>
  <article className="rounded-xl border p-4">…</article>
</div>
```

Lưới không vẽ gì cả. Mỗi thẻ tự sở hữu ranh giới của mình và tự nhận `PADDING-4`.

### Trường hợp: cột nội dung của trang

```tsx
<main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
  <section className="flex flex-col gap-3">…</section>
  <section className="flex flex-col gap-3">…</section>
</main>
```

`max-w-*` và `mx-auto` là quyết định **bề rộng**, không phải ranh giới. Trang này chưa có bề mặt nào
ở cấp ngoài cùng.

### Trường hợp: hàng bọc hai nút

```tsx
<div className="flex items-center gap-2">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Lưu</button>
</div>
```

Khoảng đệm bên trong của **nút** thuộc về chính nút, ở nơi nút được định nghĩa. Cái hàng bọc chúng không sở hữu gì.

### Trường hợp: lớp bọc `min-w-0` để cắt chữ

```tsx
<div className="flex items-center gap-2">
  <span className="size-10 shrink-0 rounded-full bg-neutral-100" />
  {/* wrapper tồn tại để cho phép truncate hoạt động, không để tạo ranh giới */}
  <div className="min-w-0 flex flex-col gap-1">
    <strong className="truncate">Nguyễn Văn An</strong>
    <span className="truncate text-sm text-neutral-500">an.nguyen@example.com</span>
  </div>
</div>
```

---

## `PADDING-0` — thể thứ hai: ranh giới thật uỷ quyền khoảng đệm bên trong, viết `p-0`

### Trường hợp: danh sách có đường phân cách, hàng tự thêm khoảng đệm

```tsx
<ul className="divide-y rounded-xl border p-0">
  {items.map((item) => (
    <li className="p-4" key={item.id}>{item.label}</li>
  ))}
</ul>
```

`p-0` viết ra thành chữ vì đây là **quyết định**: nếu cha giữ lại khoảng đệm bên trong, đường kẻ sẽ hụt hai đầu và
danh sách trông như bị cắt cụt.

### Trường hợp: dải số liệu chia cột

```tsx
<dl className="grid grid-cols-3 divide-x rounded-lg border p-0">
  {stats.map((stat) => (
    <div className="p-2" key={stat.label}>
      <dt className="text-xs text-neutral-500">{stat.label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
    </div>
  ))}
</dl>
```

### Trường hợp: thẻ có ảnh bìa tràn sát viền

```tsx
<article className="overflow-hidden rounded-xl border p-0">
  <img alt="" className="aspect-video w-full object-cover" src={course.cover} />
  {/* inset của cả card được giao cho đúng một content child, để ảnh chạm được tới viền */}
  <div className="p-4">
    <h3 className="font-medium">{course.title}</h3>
    <p className="text-sm text-neutral-500">{course.summary}</p>
  </div>
</article>
```

### Trường hợp: khung bảng dữ liệu

```tsx
<div className="overflow-x-auto rounded-lg border p-0">
  <table className="w-full text-sm">
    <thead className="border-b">
      <tr>
        <th className="p-3 text-left font-medium">Học viên</th>
        <th className="p-3 text-left font-medium">Tiến độ</th>
      </tr>
    </thead>
    <tbody className="divide-y">
      <tr>
        <td className="p-3">Nguyễn Văn An</td>
        <td className="p-3 tabular-nums">68%</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Trường hợp: trình đơn lệnh

```tsx
<div className="divide-y rounded-lg border p-0" role="listbox">
  <button className="w-full p-3 text-left text-sm" type="button">Mở dự án</button>
  <button className="w-full p-3 text-left text-sm" type="button">Tạo tài liệu</button>
  <button className="w-full p-3 text-left text-sm" type="button">Mời thành viên</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Không viết `p-0` lên lớp bọc trong suốt.** Lớp bọc không sở hữu ranh giới nào để mà uỷ quyền.

  ```tsx
  {/* SAI */}  <div className="flex flex-col gap-4 p-0">…</div>
  {/* ĐÚNG */} <div className="flex flex-col gap-4">…</div>
  ```

- **Không bỏ trống khoảng đệm bên trong của một ranh giới thật đang uỷ quyền.** Người đọc sau phải phân biệt được "đã
  quyết định giao đi" với "quên chưa đặt".

  ```tsx
  {/* SAI */}  <ul className="divide-y rounded-xl border">…</ul>
  {/* ĐÚNG */} <ul className="divide-y rounded-xl border p-0">…</ul>
  ```

- **Không vừa giữ khoảng đệm bên trong ở cha, vừa kẻ đường phân cách.** Ranh giới bị nói hai lần theo hai cách mâu thuẫn.

  ```tsx
  {/* SAI */}  <ul className="divide-y rounded-xl border p-4">…</ul>
  ```

- **Lớp bọc lồng lớp bọc không được cộng dồn khoảng đệm trong.** Không có ranh giới mới thì không có khoảng đệm bên trong mới.

  ```tsx
  {/* SAI */}
  <article className="rounded-xl border p-4">
    <div className="p-4">
      <div className="p-4">…</div>
    </div>
  </article>
  ```

---

## `PADDING-2` — ô lặp lại gọn

### Trường hợp: ô số liệu, mỗi ô một dữ kiện

```tsx
<dl className="grid grid-cols-3 divide-x rounded-lg border p-0">
  <div className="p-2">
    <dt className="text-xs text-neutral-500">Đang mở</dt>
    <dd className="text-lg font-semibold tabular-nums">12</dd>
  </div>
  <div className="p-2">
    <dt className="text-xs text-neutral-500">Đã đóng</dt>
    <dd className="text-lg font-semibold tabular-nums">8</dd>
  </div>
  <div className="p-2">
    <dt className="text-xs text-neutral-500">Bị chặn</dt>
    <dd className="text-lg font-semibold tabular-nums">2</dd>
  </div>
</dl>
```

Nhãn và số ở đây trả lời **một** câu hỏi, nên vẫn là một dữ kiện chứ không phải một nhóm.

### Trường hợp: ô ngày trong lịch

```tsx
<div className="grid grid-cols-7 gap-px rounded-lg border bg-neutral-200 p-0">
  {days.map((day) => (
    <button className="bg-white p-2 text-sm tabular-nums" key={day.iso} type="button">
      {day.label}
    </button>
  ))}
</div>
```

### Trường hợp: ô chú giải biểu đồ

```tsx
<ul className="grid grid-cols-2 divide-x divide-y rounded-lg border p-0">
  <li className="flex items-center gap-2 p-2 text-sm">
    <span className="size-2 rounded-full bg-neutral-900" />
    Bài học
  </li>
  <li className="flex items-center gap-2 p-2 text-sm">
    <span className="size-2 rounded-full bg-neutral-400" />
    Thử thách
  </li>
</ul>
```

### Trường hợp: danh sách dày đặc, mỗi hàng một nhãn

```tsx
<ul className="max-h-64 divide-y overflow-y-auto rounded-lg border p-0">
  {tags.map((tag) => (
    <li className="p-2 text-sm" key={tag}>{tag}</li>
  ))}
</ul>
```

### Trường hợp: ô phím tắt

```tsx
<dl className="grid grid-cols-2 divide-x divide-y rounded-lg border p-0">
  <div className="flex items-center justify-between p-2 text-sm">
    <dt>Tìm kiếm</dt>
    <dd className="font-mono text-xs text-neutral-500">Ctrl K</dd>
  </div>
  <div className="flex items-center justify-between p-2 text-sm">
    <dt>Lưu</dt>
    <dd className="font-mono text-xs text-neutral-500">Ctrl S</dd>
  </div>
</dl>
```

### Ngoại lệ và nhầm lẫn

- **Ô đã có nhóm nội dung thì lên `PADDING-3`,** kể cả khi nó vẫn nhỏ:

  ```tsx
  {/* SAI: ô này có nhãn + giá trị + trạng thái, không còn là một dữ kiện */}
  <section className="p-2">
    <h3 className="text-sm text-neutral-500">Độ trễ</h3>
    <p className="text-lg tabular-nums">120 ms</p>
    <span className="text-xs text-emerald-700">trong ngưỡng</span>
  </section>
  ```

- **Không dùng `PADDING-2` để "cho gọn hơn".** Gọn là hệ quả của việc ô chỉ có một dữ kiện, không phải
  tiêu chí để chọn.
- **Không vá khoảng đệm bên trong của thành phần điều khiển từ bên ngoài:**

  ```tsx
  {/* SAI: caller sửa hình dạng của nút tại đúng một chỗ gọi */}
  <button className="rounded-md border px-3 py-2 p-2 text-sm" type="button">Áp dụng</button>
  ```

- **Ô lặp lại không phải bề mặt dùng lại được.** Nếu mang ra khỏi bộ mà vẫn đúng nghĩa thì đó là
  `PADDING-4`.

---

## `PADDING-3` — ô lặp lại có một nhóm nhỏ

### Trường hợp: lưới kẻ, mỗi ô có nhãn, giá trị và trạng thái

```tsx
<div className="grid grid-cols-2 divide-x divide-y rounded-lg border p-0">
  {metrics.map((metric) => (
    <section className="flex flex-col gap-1 p-3" key={metric.label}>
      <h3 className="text-sm text-neutral-500">{metric.label}</h3>
      <p className="text-lg font-semibold tabular-nums">{metric.value}</p>
      <span className="text-xs text-neutral-500">{metric.note}</span>
    </section>
  ))}
</div>
```

### Trường hợp: hàng danh sách có dòng chính và dòng phụ

```tsx
<ul className="divide-y rounded-xl border p-0">
  {invoices.map((invoice) => (
    <li className="flex items-center justify-between p-3" key={invoice.id}>
      <span className="flex flex-col gap-1">
        <span className="font-medium">{invoice.plan}</span>
        <span className="text-sm text-neutral-500">{invoice.paidAt}</span>
      </span>
      <span className="tabular-nums">{invoice.amount}</span>
    </li>
  ))}
</ul>
```

### Trường hợp: dòng thành viên có vai trò

```tsx
<ul className="divide-y rounded-xl border p-0">
  {members.map((member) => (
    <li className="flex items-center gap-3 p-3" key={member.id}>
      <span className="size-8 shrink-0 rounded-full bg-neutral-100" />
      <span className="min-w-0 flex flex-col gap-1">
        <strong className="truncate text-sm">{member.name}</strong>
        <span className="truncate text-xs text-neutral-500">{member.email}</span>
      </span>
      <span className="ml-auto text-xs text-neutral-500">{member.role}</span>
    </li>
  ))}
</ul>
```

### Trường hợp: ô so sánh gói dịch vụ

```tsx
<div className="grid grid-cols-3 divide-x rounded-lg border p-0">
  {plans.map((plan) => (
    <div className="flex flex-col gap-1 p-3" key={plan.id}>
      <span className="text-sm font-medium">{plan.name}</span>
      <span className="text-lg font-semibold tabular-nums">{plan.price}</span>
      <span className="text-xs text-neutral-500">{plan.billing}</span>
    </div>
  ))}
</div>
```

### Trường hợp: ô bảng có nội dung nhóm

```tsx
<div className="overflow-x-auto rounded-lg border p-0">
  <table className="w-full text-sm">
    <tbody className="divide-y">
      {rows.map((row) => (
        <tr key={row.id}>
          <td className="p-3">
            <span className="flex flex-col gap-1">
              <span className="font-medium">{row.title}</span>
              <span className="text-xs text-neutral-500">{row.subtitle}</span>
            </span>
          </td>
          <td className="p-3 tabular-nums">{row.amount}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Cùng một bộ ô phải cùng một bậc.** Trộn `p-2` và `p-3` giữa các ô anh em là nói rằng chúng không
  cùng một bộ.

  ```tsx
  {/* SAI */}
  <dl className="grid grid-cols-2 divide-x rounded-lg border p-0">
    <div className="p-2">…</div>
    <div className="p-3">…</div>
  </dl>
  ```

- **Nội dung đó bọc trong thẻ riêng thì thành `PADDING-4`:**

  ```tsx
  {/* Cũng nội dung ấy, nhưng giờ nó tự đứng được ⇒ surface, không còn là ô */}
  <article className="rounded-xl border p-4">
    <div className="flex flex-col gap-1">
      <span className="font-medium">Gói tháng</span>
      <span className="text-sm text-neutral-500">Gia hạn 16/09/2026</span>
    </div>
  </article>
  ```

- **Hàng không được tự thêm `border` để trông "rõ hơn".** Thêm viền là tạo ranh giới mới, và lúc đó cả
  danh sách phải chuyển sang mô hình thẻ ngang hàng — đó là một quyết định thiết kế, không phải một class CSS
  thêm vào.

---

## `PADDING-4` — bề mặt thông thường

### Trường hợp: thẻ thông thường

```tsx
<article className="rounded-xl border p-4">
  <div className="flex flex-col gap-3">
    <h3 className="font-medium">Chi tiết gói</h3>
    <p className="text-sm text-neutral-500">Thông tin gia hạn và mức sử dụng.</p>
    <button className="self-start rounded-md border px-3 py-2 text-sm" type="button">Đổi gói</button>
  </div>
</article>
```

### Trường hợp: hàng đã cấu thành trong một danh sách

```tsx
<ul className="divide-y rounded-xl border p-0">
  {submissions.map((submission) => (
    <li className="flex flex-col gap-3 p-4" key={submission.id}>
      <div className="flex items-center justify-between">
        <strong className="text-sm">{submission.title}</strong>
        <span className="text-xs text-neutral-500">{submission.submittedAt}</span>
      </div>
      <p className="text-sm text-neutral-500">{submission.excerpt}</p>
      <div className="flex items-center gap-2">
        <button className="rounded-md border px-3 py-2 text-sm" type="button">Xem</button>
        <button className="rounded-md border px-3 py-2 text-sm" type="button">Chấm lại</button>
      </div>
    </li>
  ))}
</ul>
```

Hàng này không còn là "ô": nó có tiêu đề, mô tả và hành động riêng, tức là đã cấu thành như một
bề mặt. Cha vẫn là `PADDING-0` thể `p-0`.

### Trường hợp: khung biểu mẫu có viền

```tsx
<section className="rounded-xl border p-4">
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="name">Tên hiển thị</label>
      <input className="rounded-md border px-3 py-2" id="name" />
    </div>
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="bio">Giới thiệu</label>
      <textarea className="min-h-24 rounded-md border p-3" id="bio" />
    </div>
  </div>
</section>
```

### Trường hợp: thẻ trạng thái rỗng — tính đồng nhất với trạng thái có dữ liệu

```tsx
<article className="rounded-xl border p-4">
  <div className="flex flex-col items-center gap-3 text-center">
    <p className="text-sm text-neutral-500">Chưa có bài nộp nào.</p>
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Nộp bài đầu tiên</button>
  </div>
</article>
```

### Trường hợp: khung chờ giữ nguyên khoảng đệm trong cây

```tsx
<article className="rounded-xl border p-4">
  <div className="flex flex-col gap-3">
    <span className="h-5 w-40 rounded bg-neutral-200" />
    <span className="h-4 w-64 rounded bg-neutral-200" />
  </div>
</article>
```

Đổi khoảng đệm bên trong khi đang tải làm bố cục nhảy đúng vào lúc người dùng đang nhìn.

### Trường hợp: thẻ lỗi

```tsx
<article className="rounded-xl border border-red-200 bg-red-50 p-4">
  <div className="flex flex-col gap-2">
    <strong className="text-sm text-red-800">Không tải được tiến độ</strong>
    <p className="text-sm text-red-700">Kết nối bị gián đoạn. Thử lại sau ít phút.</p>
  </div>
</article>
```

Đổi màu là đổi **ngữ nghĩa trạng thái**, không đổi vai trò ranh giới — nên bậc giữ nguyên.

### Ngoại lệ và nhầm lẫn

- **Hai thẻ cạnh nhau trông chật thì sửa `gap` của cha, không phình khoảng đệm trong của thẻ:**

  ```tsx
  {/* SAI: card tự phình để đẩy hàng xóm */}
  <div className="grid grid-cols-2 gap-1">
    <article className="rounded-xl border p-6">…</article>
    <article className="rounded-xl border p-6">…</article>
  </div>

  {/* ĐÚNG: khoảng cách giữa sibling thuộc về parent */}
  <div className="grid grid-cols-2 gap-4">
    <article className="rounded-xl border p-4">…</article>
    <article className="rounded-xl border p-4">…</article>
  </div>
  ```

- **Đừng đổi bậc theo khung nhìn nếu vai trò không đổi:**

  ```tsx
  {/* SAI: card vẫn là card ở mọi bề rộng */}
  <article className="rounded-xl border p-4 lg:p-6">…</article>
  ```

- **Lớp bọc bên trong thẻ không nhận khoảng đệm bên trong:**

  ```tsx
  {/* SAI */}
  <article className="rounded-xl border p-4">
    <div className="flex flex-col gap-3 p-4">…</div>
  </article>
  ```

- **Thẻ to hơn không phải `PADDING-6`.** Kích thước không nâng bậc; vai trò trên tuyến trang mới nâng bậc.

---

## `PADDING-6` — mặt phẳng chính

### Trường hợp: mặt phẳng đọc

```tsx
<main className="mx-auto w-full max-w-3xl rounded-xl border p-6">
  <div className="flex flex-col gap-6">
    <h1 className="text-2xl font-semibold">Đọc và ghi theo cơ chế quorum</h1>
    <p className="text-sm leading-7">…nội dung bài đọc dài…</p>
  </div>
</main>
```

### Trường hợp: vùng làm bài

```tsx
<main className="mx-auto w-full max-w-2xl rounded-xl border p-6">
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">Câu 3 / 10</span>
      <p className="font-medium">Idempotency key giải quyết vấn đề nào?</p>
    </div>
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 rounded-md border p-3">
        <input name="q3" type="radio" />Ghi trùng khi retry
      </label>
      <label className="flex items-center gap-2 rounded-md border p-3">
        <input name="q3" type="radio" />Đọc cũ sau khi ghi
      </label>
    </div>
  </div>
</main>
```

### Trường hợp: vùng nội dung của hộp thoại chỉ có một việc

```tsx
<div className="w-full max-w-lg rounded-xl border bg-white p-6" role="dialog">
  <div className="flex flex-col gap-4">
    <h2 className="font-medium">Xoá không gian làm việc</h2>
    <p className="text-sm text-neutral-500">Hành động này không thể hoàn tác.</p>
    <div className="flex items-center justify-end gap-2">
      <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
      <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white" type="button">Xoá</button>
    </div>
  </div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Một thẻ giữa những thẻ ngang hàng không bao giờ là `PADDING-6`:**

  ```tsx
  {/* SAI: ba surface ngang hàng, một cái tự nhận vai trò mặt phẳng chính */}
  <div className="grid gap-4 sm:grid-cols-3">
    <article className="rounded-xl border p-4">…</article>
    <article className="rounded-xl border p-6">…</article>
    <article className="rounded-xl border p-4">…</article>
  </div>
  ```

- **"Cho thoáng hơn" không phải bằng chứng.** Yêu cầu ấy không chứng minh được vai trò trên tuyến trang, nên
  nó không chọn được `PADDING-6`.
- **Hai mặt phẳng chính trên một tuyến trang là mâu thuẫn.** Nếu thật sự có hai, một trong hai là
  `PADDING-4`, hoặc tuyến trang đang làm hai việc và đó là vấn đề của tuyến trang chứ không phải của khoảng đệm trong.

---

## Mã lồng mã — nơi luật *một ranh giới, một khoảng đệm bên trong* mới nhìn thấy được

### Trường hợp: thẻ chứa khối nhấn mạnh — hai ranh giới, một cụm xếp dọc trong suốt

```tsx
<article className="rounded-xl border p-4">
  {/* stack không vẽ gì ⇒ PADDING-0 thể không class */}
  <div className="flex flex-col gap-4">
    <p className="text-sm">Mức sử dụng tháng này</p>
    {/* callout tự thêm nền và viền ⇒ boundary thật ⇒ PADDING-4 */}
    <aside className="rounded-lg border bg-neutral-50 p-4">
      <p className="text-sm">Bạn đã dùng 92% hạn mức.</p>
    </aside>
  </div>
</article>
```

Ba phần tử, ba mã: `PADDING-4` cho thẻ, `PADDING-0` cho cụm xếp dọc, `PADDING-4` cho khối nhấn mạnh.

### Trường hợp: thẻ uỷ quyền cho ảnh, rồi chứa một danh sách uỷ quyền cho hàng

```tsx
<article className="overflow-hidden rounded-xl border p-0">
  <img alt="" className="aspect-video w-full object-cover" src={course.cover} />
  <div className="p-4">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{course.title}</h3>
        <span className="text-sm text-neutral-500">{course.lessonCount} bài học</span>
      </div>
      <ul className="divide-y rounded-lg border p-0">
        {course.lessons.map((lesson) => (
          <li className="flex items-center justify-between p-3" key={lesson.id}>
            <span className="text-sm">{lesson.title}</span>
            <span className="text-xs text-neutral-500">{lesson.duration}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
</article>
```

Thẻ ngoài `PADDING-0` thể `p-0`; nội dung phần tử con `PADDING-4`; hai cụm xếp dọc bên trong `PADDING-0` thể không
class CSS; danh sách `PADDING-0` thể `p-0`; mỗi hàng `PADDING-3`.

### Trường hợp: cả một trang, năm mã cùng có mặt

```tsx
<main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
  <section className="rounded-xl border p-6">
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Tiến độ học tập</h1>
      <dl className="grid grid-cols-3 divide-x rounded-lg border p-0">
        <div className="p-2"><dt className="text-xs text-neutral-500">Đang học</dt><dd className="text-lg tabular-nums">12</dd></div>
        <div className="p-2"><dt className="text-xs text-neutral-500">Đã xong</dt><dd className="text-lg tabular-nums">86</dd></div>
        <div className="p-2"><dt className="text-xs text-neutral-500">Chuỗi ngày</dt><dd className="text-lg tabular-nums">7</dd></div>
      </dl>
    </div>
  </section>
  <div className="grid gap-4 sm:grid-cols-2">
    <article className="rounded-xl border p-4">
      <div className="flex flex-col gap-3">
        <h2 className="font-medium">Hoạt động gần đây</h2>
        <ul className="divide-y rounded-lg border p-0">
          <li className="p-3">Hoàn thành “Đọc và ghi theo cơ chế quorum”</li>
          <li className="p-3">Nộp bài thử thách “Rate limiter”</li>
        </ul>
      </div>
    </article>
    <article className="rounded-xl border p-4">
      <div className="flex flex-col gap-3">
        <h2 className="font-medium">Nhắc nhở</h2>
        <aside className="rounded-lg border bg-neutral-50 p-4">
          <p className="text-sm">Còn 2 bài để giữ chuỗi ngày.</p>
        </aside>
      </div>
    </article>
  </div>
</main>
```

`main` và các cụm xếp dọc là `PADDING-0` thể không class CSS; mặt phẳng chính `PADDING-6`; hai thẻ `PADDING-4`;
khối nhấn mạnh lồng `PADDING-4`; dải số liệu và danh sách `PADDING-0` thể `p-0`; ô số liệu `PADDING-2`; hàng
`PADDING-3`.

### Trường hợp: thành phần điều khiển đè lên mép — không bịa khoảng đệm bên trong

```tsx
<div className="relative">
  <input aria-label="Tìm kiếm" className="w-full rounded-md border px-3 py-2" />
  {/* SAI nếu thêm padding vào input để "chừa chỗ" khi slot chưa được định nghĩa */}
  <button className="absolute inset-y-0 right-0 px-3 text-sm" type="button">Xoá</button>
</div>
```

Khoảng đệm bên trong cần chừa phụ thuộc vào **hình học của vị trí**: nút rộng bao nhiêu, có luôn hiện không, có thêm
biểu tượng không. Chưa có câu trả lời thì không thêm khoảng đệm bên trong — hỏi đúng một câu, rồi mới viết.

---

## Ánh xạ yêu cầu sang một class CSS

Nêu chủ ranh giới, trực tiếp nội dung của nó và vai trò trên tuyến trang. Nếu thiếu **một** dữ kiện quyết định,
mặc định **không** phát khoảng đệm trong từ phía bên sử dụng, và chỉ hỏi **một** câu cụ thể khi bên yêu cầu nói rõ
họ cần một khoảng đệm bên trong khác mặc định. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ
cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Xếp tiêu đề, mô tả và biểu mẫu bên trong một khung có sẵn; cụm xếp dọc không vẽ nền hay viền | Cụm xếp dọc chỉ xếp đặt, không sở hữu ranh giới | `PADDING-0` | không class CSS khoảng đệm trong |
| Danh sách có viền, các hàng tự thêm khoảng đệm và có đường phân cách chạy hết bề ngang | Ranh giới giao khoảng đệm bên trong cho hàng để đường kẻ chạm mép | `PADDING-0` | `p-0` ở gốc, `p-4` ở hàng |
| Thẻ có ảnh bìa tràn sát viền rồi mới tới phần chữ | Ranh giới giao khoảng đệm bên trong cho đúng một nội dung phần tử con | `PADDING-0` | `p-0` ở thẻ, `p-4` ở phần chữ |
| Các ô lặp lại, mỗi ô một con số ngắn và nhãn của nó | Mỗi ô là đơn vị lặp gọn, chỉ một dữ kiện | `PADDING-2` | `p-2` mỗi ô |
| Ô lưới có nhãn, giá trị và trạng thái ngắn, phân tách bằng đường kẻ | Ô đã ôm một nhóm nhỏ chứ không phải một dữ kiện | `PADDING-3` | `p-3` mỗi ô |
| Thẻ có tiêu đề, siêu dữ liệu, nội dung và hành động, dùng lại được | Bề mặt thông thường đã cấu thành | `PADDING-4` | `p-4` ở chủ nội dung của thẻ |
| Tuyến trang chỉ dành cho một luồng đọc/làm việc, không có phần nội dung cạnh tranh | Ranh giới là mặt phẳng chính chứ không phải thẻ cục bộ | `PADDING-6` | `p-6` ở mặt phẳng |
| Thẻ thông thường chứa một khối nhấn mạnh có nền và viền riêng | Hai ranh giới thật ⇒ hai khoảng đệm bên trong; cụm xếp dọc ở giữa không có | `PADDING-4` ×2 | `p-4` ở thẻ, `p-4` ở khối nhấn mạnh, không class CSS ở cụm xếp dọc |
| "Thêm khoảng đệm trong cho cái khung to này" | "To" không chứng minh được vai trò thông thường hay chính | *chưa quyết* | không phát khoảng đệm trong; hỏi: "Đây là bề mặt cục bộ dùng lại được, hay là mặt phẳng đọc/làm việc chính?" |
| "Chừa chỗ để chữ không đè lên nút xoá ở mép phải" | Khoảng đệm bên trong cần chừa phụ thuộc vị trí đã có hay chưa | *chưa quyết* | không phát khoảng đệm trong; hỏi: "Trường nhập liệu này đã có vị trí cho thành phần điều khiển ở mép chưa?" |
| Hai thẻ cạnh nhau trông chật | Khoảng cách giữa phần tử cùng cấp không phải việc của khoảng đệm trong | — | giữ nguyên `p-4`, sửa `gap` của phần tử cha |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| không class CSS / `p-0` | Ở đây có ranh giới thật không, hay chỉ có một lớp bọc xếp đặt? |
| `PADDING-2` / `PADDING-3` | Ô chứa **một** dữ kiện, hay **một nhóm** dữ kiện? |
| `PADDING-3` / `PADDING-4` | Đây là ô thuộc một bộ đồng dạng, hay là bề mặt tự đứng được? |
| `PADDING-4` / `PADDING-6` | Đây là bề mặt cục bộ dùng lại được, hay là lý do tồn tại của tuyến trang? |
| một hay hai chủ `p-4` | Phần tử bên trong có thêm nền/viền/ngữ nghĩa ranh giới không? |
| khoảng đệm trong / khoảng cách | Cần nới bên trong ranh giới, hay cần đẩy hai phần tử cùng cấp ra xa nhau? |
| khoảng đệm bên trong ở mép | Vị trí và hình học bố cục của thành phần điều khiển ở mép đã được xác định chưa? |

## Sai lầm lặp lại nhiều nhất

1. Chọn khoảng đệm bên trong bằng mắt — thấy chật thì tăng một bậc.
2. Viết `p-0` lên lớp bọc trong suốt, hoặc bỏ trống khoảng đệm bên trong của một ranh giới đang uỷ quyền.
3. Lớp bọc lồng lớp bọc, mỗi lớp cộng thêm một `p-4` mà không thêm ranh giới nào.
4. Dùng khoảng đệm trong để đẩy hàng xóm thay vì sửa `gap` của phần tử cha.
5. Vừa `p-4` ở gốc danh sách vừa `divide-y`, khiến đường kẻ hụt hai đầu.
6. Đổi bậc theo khung nhìn dù vai trò ranh giới không đổi.
7. Khung chờ hoặc trạng thái rỗng dùng khoảng đệm trong cây khác nội dung thật.
8. Bên sử dụng vá `px-*`/`py-*` lên một thành phần điều khiển để sửa hình dạng của nó tại đúng một chỗ gọi.
9. Nâng một thẻ lên `p-6` vì nó to, chứ không vì nó là mặt phẳng chính.
