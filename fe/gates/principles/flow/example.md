---
id: fe-principles-flow-example
title: example.md
slug: /gates/principles/flow/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã FLOW-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `flow` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Các class CSS không thuộc mô-đun này — `gap-*`, `items-*`, `justify-*`, `min-w-0`, `truncate`, `p-*` —
vẫn xuất hiện vì mã đánh dấu thật có chúng. Chúng **không bao giờ** là lý do chọn mã. Lý do chọn mã luôn
là: trục nào, và khi hết chỗ thì cái gì nhường.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một khai báo duy nhất.

---

## `FLOW-0` — một con, không khai báo trục

### Trường hợp: lớp bọc chỉ để giới hạn bề rộng

```tsx
<div className="mx-auto max-w-3xl px-4">
  <article className="rounded-lg border p-6">…</article>
</div>
```

Vùng chứa ngoài tồn tại vì bề rộng tối đa, không vì một trục. Không có con thứ hai để định hướng.

### Trường hợp: khung của một ảnh

```tsx
<figure className="overflow-hidden rounded-lg border">
  <img alt="Ảnh bìa khoá học" className="aspect-video w-full object-cover" src={cover} />
</figure>
```

### Trường hợp: vùng nền của một phần nội dung

```tsx
<section className="rounded-xl bg-neutral-50 p-6">
  <p className="text-sm text-neutral-600">Bạn chưa có bài nộp nào trong tuần này.</p>
</section>
```

### Ngoại lệ và nhầm lẫn

- **Danh sách hôm nay chỉ có một kết quả vẫn không phải `FLOW-0`.** Mã đi theo tập, không theo dữ
  liệu:

  ```tsx
  {/* SAI: bỏ flow vì "đang có mỗi một cái" */}
  <div>
    {results.map((item) => (
      <div className="rounded-lg border p-4" key={item.id}>{item.title}</div>
    ))}
  </div>

  {/* ĐÚNG: tập này là một chồng, kể cả khi chỉ có một phần tử */}
  <div className="flex flex-col gap-2">
    {results.map((item) => (
      <div className="rounded-lg border p-4" key={item.id}>{item.title}</div>
    ))}
  </div>
  ```

- **`flex` cho một con không phải vô hại.** Nó đổi hành vi của chính đứa con đó:

  ```tsx
  {/* SAI: con đang là block bỗng co theo nội dung, w-full mất tác dụng */}
  <div className="flex rounded-lg border p-4">
    <p className="w-full">Một đoạn mô tả dài…</p>
  </div>
  ```

- **Cần canh giữa một con thì đó vẫn là `FLOW-0`.** Canh lề là việc của mô-đun khác; `grid
  place-items-center` ở đây là một cách canh, không phải một tuyên bố trục — và nó không tạo ra tập
  nào cả.

---

## `FLOW-1` — chữ trong một câu

### Trường hợp: câu có phần in đậm và một liên kết

```tsx
<p className="text-sm text-neutral-700">
  Khoá <strong>Nền tảng hệ thống</strong> mở lại vào ngày 20/09.{" "}
  <a className="underline" href="/schedule">Xem lịch khai giảng</a>.
</p>
```

Ngắt dòng được phép rơi vào giữa hai chữ bất kỳ, kể cả giữa các chữ bên trong `<strong>`. Đó là dấu
hiệu chắc chắn của `FLOW-1`.

### Trường hợp: câu có chèn một nhãn nhỏ nhỏ

```tsx
<p className="text-sm leading-relaxed text-neutral-700">
  Bài nộp của bạn đang ở trạng thái
  <span className="mx-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">chờ chấm</span>
  và thường có kết quả trong vòng hai ngày làm việc.
</p>
```

### Trường hợp: câu có biểu tượng dẫn nhập

```tsx
<p className="text-sm text-neutral-600">
  <svg aria-hidden="true" className="mr-1 inline size-4 align-[-0.125em]" />
  Kết quả được cập nhật lại mỗi 15 phút, nên con số vừa xem có thể chưa phải con số cuối cùng.
</p>
```

Biểu tượng nằm **trong** câu thì nó là một thành phần nội tuyến. Đưa cả câu vào `flex` để canh biểu tượng là đổi một
đoạn văn thành một hàng.

### Ngoại lệ và nhầm lẫn

- **`flex` trên một đoạn văn xoá mất dấu cách và khả năng ngắt dòng giữa chừng:**

  ```tsx
  {/* SAI */}
  <p className="flex items-center gap-1 text-sm">
    Bài nộp của bạn đang ở trạng thái
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs">chờ chấm</span>
  </p>
  ```

  Câu bị chẻ thành hai phần tử flex: mệnh đề đầu không còn ngắt dòng chung với nhãn nhỏ, và ở màn hình hẹp
  nó bị bóp lại thành một cột chữ hẹp bên cạnh một nhãn nhỏ.

- **Biểu tượng đứng trước một nhãn ngắn thì lại là `FLOW-2`, không phải `FLOW-1`:**

  ```tsx
  <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" type="button">
    <svg aria-hidden="true" className="size-4" />
    Tải chứng chỉ
  </button>
  ```

  Khác biệt nằm ở chỗ ngắt dòng: nhãn của nút không được phép gãy đôi, còn câu văn thì được.

---

## `FLOW-2` — một hàng, một dòng

### Trường hợp: một dòng danh sách, nhãn trái và giá trị phải

```tsx
<li className="flex items-center justify-between p-4">
  <span className="min-w-0 truncate">Thiết kế hệ thống nâng cao</span>
  <span className="ml-4 shrink-0 tabular-nums">1.299.000đ</span>
</li>
```

Hàng này không được phép gãy: chiều cao đều nhau là thứ mắt dùng để quét cả danh sách. Ai co, ai giữ,
ai bị cắt đuôi là việc của mô-đun tràn nội dung — `FLOW-2` chỉ ràng buộc rằng chỉ có một dòng.

### Trường hợp: phần đầu của thẻ

```tsx
<header className="flex items-start justify-between gap-3">
  <h3 className="min-w-0 truncate font-medium">Báo cáo tiến độ tháng 8</h3>
  <button aria-label="Tuỳ chọn" className="shrink-0 rounded-md border p-1.5" type="button" />
</header>
```

### Trường hợp: cụm nhận diện

```tsx
<div className="flex items-center gap-2">
  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  <span className="min-w-0 truncate font-medium">Nguyễn Văn An</span>
</div>
```

### Trường hợp: dòng tổng tiền

```tsx
<div className="flex items-baseline justify-between border-t pt-3">
  <span className="text-sm text-neutral-600">Tổng thanh toán</span>
  <strong className="tabular-nums">1.499.000đ</strong>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Khai báo cả một dòng lẫn cho phép xuống dòng là không khai báo gì:**

  ```tsx
  {/* SAI: flex-nowrap và flex-wrap phủ định nhau, kết quả phụ thuộc thứ tự class */}
  <div className="flex flex-nowrap flex-wrap items-center gap-2">…</div>
  ```

- **`flex-row` thừa khi không huỷ `flex-col` ở đâu cả:**

  ```tsx
  {/* SAI */}  <div className="flex flex-row items-center gap-2">…</div>
  {/* ĐÚNG */} <div className="flex items-center gap-2">…</div>
  ```

  Hàng đã là trục mặc định. `flex-row` chỉ có nghĩa trong `FLOW-5`, nơi nó huỷ `flex-col` tại một
  điểm ngắt.

- **Một hàng dài mà không nói ai nhường sẽ đẩy phần tử cuối ra khỏi khung.** `FLOW-2` là lời hứa "chỉ
  một dòng"; lời hứa đó bắt buộc phải đi kèm một quyết định nhường bề rộng.

---

## `FLOW-3` — một chồng đọc từ trên xuống

### Trường hợp: nhãn và ô nhập

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="email">Email</label>
  <input className="rounded-md border px-3 py-2" id="email" type="email" />
</div>
```

### Trường hợp: thân của một thẻ

```tsx
<article className="flex flex-col gap-3 rounded-lg border p-4">
  <h3 className="font-medium">Kiểm thử hệ thống phân tán</h3>
  <p className="text-sm text-neutral-600">Ba tuần, mỗi tuần một bài thực hành có chấm.</p>
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Xem chi tiết</button>
</article>
```

### Trường hợp: danh sách bình luận, số phần tử do dữ liệu quyết

```tsx
<ul className="flex flex-col gap-4">
  {comments.map((comment) => (
    <li className="flex flex-col gap-1" key={comment.id}>
      <strong className="text-sm">{comment.author}</strong>
      <p className="text-sm text-neutral-700">{comment.body}</p>
    </li>
  ))}
</ul>
```

Cha là `FLOW-3`, và mỗi `li` lại là một `FLOW-3` khác. **Mã áp cho một tập, không áp cho cả cây.**

### Trường hợp: các bước của một quy trình

```tsx
<ol className="flex flex-col gap-4">
  <li className="flex flex-col gap-1">
    <span className="text-xs text-neutral-500">Bước 1</span>
    <span className="text-sm">Xác nhận địa chỉ email</span>
  </li>
  <li className="flex flex-col gap-1">
    <span className="text-xs text-neutral-500">Bước 2</span>
    <span className="text-sm">Chọn lộ trình học</span>
  </li>
</ol>
```

### Ngoại lệ và nhầm lẫn

- **Không khai báo trục rồi nối bằng `margin` trên con:**

  ```tsx
  {/* SAI */}
  <div>
    <label className="text-sm font-medium" htmlFor="name">Họ và tên</label>
    <input className="mt-3 w-full rounded-md border px-3 py-2" id="name" />
  </div>
  ```

  `gap` chỉ sống trong flex và lưới. Không khai báo trục dọc thì khoảng cách giữa các phần tử buộc phải nằm trên con, và đó
  đúng là lỗi mà mô-đun khoảng cách cấm.

- **`grid` không bao giờ khai báo số cột là `FLOW-3` viết nhầm họ:**

  ```tsx
  {/* SAI */}  <div className="grid gap-3">…</div>
  {/* ĐÚNG */} <div className="flex flex-col gap-3">…</div>
  ```

  Viết `flex-col` để trục hiện lên ngay trong danh sách class CSS, thay vì phải suy ra từ việc không thấy
  `grid-cols-*` ở đâu cả.

- **`flex-col-reverse` để đảo thứ tự là một lỗi, không phải một mã.** Thứ tự nhìn thấy phải bằng thứ
  tự trong DOM; đảo bằng CSS làm bàn phím và trình đọc màn hình đi ngược với mắt. Muốn đổi thứ tự thì
  đổi thứ tự dữ liệu.

---

## `FLOW-4` — một hàng được phép xuống dòng

### Trường hợp: túi thẻ do người dùng nhập

```tsx
<div className="flex flex-wrap gap-2">
  {tags.map((tag) => (
    <span className="rounded-full border px-3 py-1 text-sm" key={tag}>{tag}</span>
  ))}
</div>
```

### Trường hợp: cụm bộ lọc

```tsx
<div className="flex flex-wrap items-center gap-2">
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đang học</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đã hoàn thành</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đã lưu</button>
</div>
```

### Trường hợp: chú giải của một biểu đồ

```tsx
<ul className="flex flex-wrap gap-x-4 gap-y-2">
  <li className="flex items-center gap-2 text-sm">
    <span className="size-2 rounded-full bg-neutral-900" />Bài học
  </li>
  <li className="flex items-center gap-2 text-sm">
    <span className="size-2 rounded-full bg-neutral-400" />Thử thách
  </li>
  <li className="flex items-center gap-2 text-sm">
    <span className="size-2 rounded-full bg-neutral-200" />Ôn tập
  </li>
</ul>
```

Cha là `FLOW-4`; mỗi `li` bên trong là `FLOW-2` — chấm màu và nhãn không được phép gãy đôi. Đây là
cặp lồng nhau hay gặp nhất của mô-đun này.

### Trường hợp: hai nhãn nhỏ trông như lúc nào cũng vừa

```tsx
<div className="flex flex-wrap items-center gap-2">
  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">Trung cấp</span>
  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">Có chứng chỉ hoàn thành</span>
</div>
```

Hai nhãn nhỏ, thừa chỗ ở mọi bề rộng đã thử. Vẫn là `FLOW-4`, vì nhãn thứ hai là văn bản có thể dài ra
theo ngôn ngữ và theo cỡ chữ người dùng đặt.

### Ngoại lệ và nhầm lẫn

- **Cần thẳng cột thì không phải `FLOW-4`:**

  ```tsx
  {/* SAI: các card rộng khác nhau, dòng hai không thẳng cột với dòng một */}
  <div className="flex flex-wrap gap-4">
    {courses.map((course) => (
      <article className="w-72 rounded-lg border p-4" key={course.id}>…</article>
    ))}
  </div>
  ```

  Bề rộng cứng `w-72` là dấu hiệu đang cố dựng lưới bằng xuống dòng: hàng cuối lệch, khoảng trống bên phải
  không chia đều, và các thẻ không cao bằng nhau. Đây là `FLOW-7`.

- **Xuống dòng trên trục dọc không xuống dòng gì cả:**

  ```tsx
  {/* SAI: không có chiều cao thì không có chỗ để ngắt cột */}
  <div className="flex flex-col flex-wrap gap-2">…</div>
  ```

---

## `FLOW-5` — hàng khi rộng, chồng khi hẹp

### Trường hợp: khối kêu gọi hành động

```tsx
<div className="flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex flex-col gap-1">
    <strong>Bạn còn 3 ngày dùng thử</strong>
    <span className="text-sm text-neutral-600">Gia hạn để giữ lại tiến độ đang có.</span>
  </div>
  <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white sm:shrink-0" type="button">
    Gia hạn ngay
  </button>
</div>
```

Cha là `FLOW-5`; cụm chữ bên trong là `FLOW-3`. Khi hẹp, nút cần trọn bề rộng để bấm — nên tập này
đổi trục chứ không gãy dòng.

### Trường hợp: tiêu đề trang và hành động chính

```tsx
<header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
  <h1 className="text-xl font-semibold">Bài nộp của tôi</h1>
  <div className="flex items-center gap-2">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Xuất CSV</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Nộp bài mới</button>
  </div>
</header>
```

Cha `FLOW-5`, nhóm nút bên trong `FLOW-2`: hai nút luôn đứng cạnh nhau kể cả ở màn hình hẹp, vì chúng
là một cụm hành động.

### Trường hợp: ảnh và mô tả

```tsx
<section className="flex flex-col gap-6 lg:flex-row lg:items-center">
  <img alt="" className="w-full rounded-lg object-cover lg:w-1/2" src={illustration} />
  <div className="flex flex-col gap-3 lg:w-1/2">
    <h2 className="text-lg font-medium">Học bằng bài thực hành có chấm</h2>
    <p className="text-sm text-neutral-600">Mỗi tuần một bài, phản hồi trong hai ngày làm việc.</p>
  </div>
</section>
```

### Ngoại lệ và nhầm lẫn

- **Viết theo hướng rộng trước là sai hướng:**

  ```tsx
  {/* SAI: mặc định là hàng, bề rộng nào chưa nghĩ tới thì vỡ */}
  <div className="flex flex-row gap-4 sm:flex-col">…</div>

  {/* ĐÚNG: mặc định an toàn, rộng ra mới thành hàng */}
  <div className="flex flex-col gap-4 sm:flex-row">…</div>
  ```

- **Một túi phần tử không bao giờ là `FLOW-5`:**

  ```tsx
  {/* SAI: 12 cái chip xếp thành 12 dòng trên mobile */}
  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
    {tags.map((tag) => <span key={tag}>{tag}</span>)}
  </div>
  ```

  Nhãn nhỏ không cần trọn bề rộng, nên câu trả lời khi hết chỗ là **gãy dòng**, tức `FLOW-4`.

---

## `FLOW-6` — số cột do sản phẩm quyết

### Trường hợp: hai trường nhập liệu trong một hàng

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

Con số **hai** đến từ nội dung: họ và tên là một cặp. Một cột ở bề rộng gốc được khai báo ngầm, và
hợp lệ vì có `sm:grid-cols-2` nói ra số cột.

### Trường hợp: ba ô số liệu — mã lồng mã

```tsx
<section className="flex flex-col gap-3">
  <h2 className="font-medium">Tổng quan tuần này</h2>
  <div className="grid gap-4 sm:grid-cols-3">
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-semibold tabular-nums">12</span>
      <span className="text-sm text-neutral-500">bài đã hoàn thành</span>
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-semibold tabular-nums">4,5</span>
      <span className="text-sm text-neutral-500">giờ học</span>
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-semibold tabular-nums">7</span>
      <span className="text-sm text-neutral-500">ngày liên tiếp</span>
    </div>
  </div>
</section>
```

Ba mã trong một khối: `FLOW-3` giữa tiêu đề và lưới, `FLOW-6` cho ba ô, `FLOW-3` bên trong mỗi ô. Một
cha, một luồng — mỗi tập con có cha riêng của nó.

### Trường hợp: lưới lựa chọn trắc nghiệm

```tsx
<div className="grid gap-2 sm:grid-cols-2">
  {options.map((option) => (
    <label className="flex items-center gap-2 rounded-md border p-3 text-sm" key={option.id}>
      <input name="answer" type="radio" value={option.id} />
      <span className="min-w-0">{option.label}</span>
    </label>
  ))}
</div>
```

### Trường hợp: bảng giá ba gói

```tsx
<div className="grid gap-4 lg:grid-cols-3">
  {plans.map((plan) => (
    <article className="flex flex-col gap-4 rounded-xl border p-6" key={plan.id}>
      <div className="flex flex-col gap-1">
        <strong>{plan.name}</strong>
        <span className="text-sm text-neutral-500">{plan.tagline}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{plan.price}</span>
        <span className="text-sm text-neutral-500">mỗi tháng</span>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
    </article>
  ))}
</div>
```

Số ba ở đây là số gói, không phải số thẻ nhét vừa màn hình. Đó là điều phân biệt `FLOW-6` với
`FLOW-7`.

### Ngoại lệ và nhầm lẫn

- **Đếm điểm ngắt cho một tập không biết trước độ dài là dấu hiệu sai mã:**

  ```tsx
  {/* SAI: bốn breakpoint cho một danh sách do dữ liệu quyết */}
  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    {results.map((result) => (
      <article className="rounded-lg border p-4" key={result.id}>{result.title}</article>
    ))}
  </div>
  ```

  Câu hỏi thật không phải "mấy cột ở màn hình vừa" mà là "dưới bề rộng nào thì thẻ mất nghĩa" —
  `FLOW-7`.

- **Dùng `grid-cols-2` cho hai vùng có vai trò khác nhau là ép thanh dọc rộng bằng nửa trang:**

  ```tsx
  {/* SAI */}  <div className="grid gap-8 lg:grid-cols-2"><aside>…</aside><section>…</section></div>
  {/* ĐÚNG */} <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]"><aside>…</aside><section>…</section></div>
  ```

---

## `FLOW-7` — số cột do bề rộng tối thiểu của phần tử quyết

### Trường hợp: lưới kết quả có bộ lọc

```tsx
<div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
  {courses.map((course) => (
    <article className="flex flex-col gap-2 rounded-lg border p-4" key={course.id}>
      <h3 className="truncate font-medium">{course.title}</h3>
      <p className="line-clamp-2 text-sm text-neutral-600">{course.summary}</p>
    </article>
  ))}
</div>
```

Không có điểm ngắt nào, và đó là điểm mạnh: cùng khối này đặt trong một thanh dọc hẹp hay trong một hộp thoại
đều tự ra đúng số cột, vì câu được khai báo là "thẻ dưới 16rem thì không đọc được".

### Trường hợp: thư viện ảnh

```tsx
<ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
  {photos.map((photo) => (
    <li key={photo.id}>
      <img alt={photo.alt} className="aspect-square w-full rounded-md object-cover" src={photo.src} />
    </li>
  ))}
</ul>
```

### Trường hợp: `auto-fit` khi trạng thái một phần tử phải chiếm trọn hàng

```tsx
<div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-4">
  {attachments.map((file) => (
    <div className="flex items-center gap-3 rounded-lg border p-3" key={file.id}>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-neutral-100 text-xs">
        {file.ext}
      </span>
      <span className="min-w-0 truncate text-sm">{file.name}</span>
    </div>
  ))}
</div>
```

`auto-fit` được chọn **có chủ đích**: khi chỉ còn một tệp đính kèm, ô đó kéo dài hết hàng thay vì
đứng lẻ loi ở bề rộng tối thiểu. Nếu yêu cầu ngược lại — một phần tử vẫn giữ đúng bề rộng của một phần tử —
thì viết `auto-fill`.

### Ngoại lệ và nhầm lẫn

- **`1fr` không có `minmax(0,…)` làm cột từ chối co lại:**

  ```tsx
  {/* SAI: một tên tệp dài không xuống dòng sẽ nới cột và đẩy cả lưới trượt ngang */}
  <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,auto))] gap-4">…</div>
  ```

- **Bề rộng tối thiểu phải là bề rộng đọc được, không phải một con số cho đẹp:**

  ```tsx
  {/* SAI: 8rem cho một card có tiêu đề và mô tả — mỗi dòng còn 2-3 chữ */}
  <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-4">
    {courses.map((course) => <article key={course.id}>…</article>)}
  </div>
  ```

  `FLOW-7` chỉ đúng khi con số kia trả lời được câu hỏi "dưới bao nhiêu thì phần tử mất nghĩa".

---

## `FLOW-8` — các rãnh có vai trò khác nhau

### Trường hợp: thanh dọc lọc và vùng kết quả

```tsx
<div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="flex flex-col gap-6">
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

Thanh dọc và kết quả không hoán đổi được, và bề rộng `16rem` là một quyết định bố cục chứ không phải hệ
quả của nội dung. Ở bề rộng hẹp không có `grid-cols-*` nào, nên hai rãnh xếp chồng — vẫn cùng một
mã, vì điểm ngắt là **một phần** của mã.

### Trường hợp: nội dung và mục lục ghim

```tsx
<div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_14rem] xl:items-start">
  <article className="min-w-0">…bài viết…</article>
  <nav className="flex flex-col gap-2 xl:sticky xl:top-24">
    <a className="text-sm text-neutral-600" href="#a">Giới thiệu</a>
    <a className="text-sm text-neutral-600" href="#b">Cách chấm điểm</a>
  </nav>
</div>
```

`xl:sticky` chỉ đặt được lên một rãnh vì chỉ rãnh đó sở hữu hình học của mình. Đó là bằng chứng
đang ở `FLOW-8` chứ không phải `FLOW-6`.

### Trường hợp: cả trang, năm mã lồng nhau

```tsx
<div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
  <nav className="flex flex-col gap-1">
    <a className="rounded-md px-3 py-2 text-sm" href="#dashboard">Bảng điều khiển</a>
    <a className="rounded-md px-3 py-2 text-sm" href="#courses">Khoá học</a>
    <a className="rounded-md px-3 py-2 text-sm" href="#submissions">Bài nộp</a>
  </nav>

  <main className="flex min-w-0 flex-col gap-6">
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h1 className="text-xl font-semibold">Khoá học của tôi</h1>
      <div className="flex items-center gap-2">
        <button className="rounded-md border px-3 py-2 text-sm" type="button">Bộ lọc</button>
        <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Khám phá</button>
      </div>
    </header>

    <div className="flex flex-wrap items-center gap-2">
      <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
      <button className="rounded-full border px-3 py-1 text-sm" type="button">Đang học</button>
      <button className="rounded-full border px-3 py-1 text-sm" type="button">Đã hoàn thành</button>
    </div>

    <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
      {courses.map((course) => (
        <article className="flex flex-col gap-3 rounded-lg border p-4" key={course.id}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate font-medium">{course.title}</h3>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{course.level}</span>
          </div>
          <p className="line-clamp-2 text-sm text-neutral-600">{course.summary}</p>
        </article>
      ))}
    </div>
  </main>
</div>
```

Đọc từ ngoài vào: `FLOW-8` cho hai rãnh có vai trò khác nhau · `FLOW-3` cho các khối trong vùng nội
dung · `FLOW-5` cho phần đầu · `FLOW-4` cho cụm bộ lọc · `FLOW-7` cho lưới thẻ · `FLOW-2` cho hàng
tiêu đề bên trong mỗi thẻ. Mỗi tập có cha riêng, và không cha nào phải diễn đạt hai trục.

### Ngoại lệ và nhầm lẫn

- **`1fr` thay cho `minmax(0,1fr)` ở rãnh nội dung:**

  ```tsx
  {/* SAI: một bảng hoặc một chuỗi dài bên trong sẽ nới track và làm cả trang trượt ngang */}
  <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">…</div>
  ```

  `truncate` bên trong rãnh đó cũng lặng lẽ không có tác dụng, nên lỗi này thường bị đi tìm nhầm ở
  mô-đun tràn nội dung.

- **Bề rộng của thanh dọc đặt bằng `w-*` trên chính thanh dọc thay vì bằng rãnh:**

  ```tsx
  {/* SAI: con tự khai báo hình học của track mà nó đang nằm trong */}
  <div className="flex gap-8">
    <aside className="w-64 shrink-0">…</aside>
    <section className="min-w-0 flex-1">…</section>
  </div>
  ```

  Cách này chạy được, nhưng nó chuyển quyết định bố cục xuống cho con và làm mất khả năng đọc cả bố
  cục trang từ một dòng class CSS duy nhất ở cha. `FLOW-8` yêu cầu rãnh nói ra bề rộng của rãnh.

---

## Ánh xạ yêu cầu sang một khai báo

Nêu cha, các con trực tiếp và điều xảy ra khi hết bề rộng. Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả
hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Bọc nội dung trang trong một khung giới hạn bề rộng | Chỉ một con ở mọi trạng thái | `FLOW-0` | không class CSS luồng |
| Chèn tên gói in đậm vào giữa câu mô tả | Ngắt dòng được phép rơi giữa hai chữ | `FLOW-1` | không class CSS luồng |
| Tên bên trái, số tiền bên phải, các dòng cao bằng nhau | Gãy dòng làm hỏng nhịp quét dọc | `FLOW-2` | `flex items-center justify-between` |
| Nhãn nằm trên ô nhập | Thứ tự trên–dưới là thứ tự đọc | `FLOW-3` | `flex flex-col` |
| Hiện các thẻ người dùng tự thêm | Túi phần tử, cột không mang nghĩa | `FLOW-4` | `flex flex-wrap` |
| Nội dung bên trái, nút bên phải, thiết bị di động thì nút xuống dưới | Khi hẹp nút cần trọn bề rộng | `FLOW-5` | `flex flex-col sm:flex-row` |
| Xếp họ và tên cạnh nhau trên màn hình vừa trở lên | Số cột đến từ nội dung | `FLOW-6` | `grid sm:grid-cols-2` |
| Hiện kết quả tìm kiếm dạng thẻ, bao nhiêu cũng được | Số cột là hệ quả của bề rộng còn lại | `FLOW-7` | `grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]` |
| Thanh dọc lọc cố định bên trái, kết quả bên phải | Hai rãnh không hoán đổi được | `FLOW-8` | `grid lg:grid-cols-[16rem_minmax(0,1fr)]` |
| Xếp bốn ô số liệu trên một hàng cho gọn | Chưa rõ bốn là quyết định nội dung hay chỉ là "nhét vừa" | — | hỏi một câu rồi dừng |

Ở dòng cuối, câu phân định là: *"Con số bốn đến từ nội dung, hay từ bề rộng còn lại của màn hình?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `FLOW-0` / `FLOW-3` | Có trạng thái dữ liệu nào làm vùng chứa mọc ra con thứ hai không? |
| `FLOW-1` / `FLOW-2` | Ngắt dòng rơi vào **giữa** một phần thì có đúng không? |
| `FLOW-2` / `FLOW-4` | Phần tử cuối rơi xuống dòng dưới thì hàng còn đọc đúng không? |
| `FLOW-2` / `FLOW-5` | Khi hẹp, nên cắt bớt một phần tử hay để cả tập đổi trục? |
| `FLOW-4` / `FLOW-5` | Phần tử có cần trọn bề rộng khi hẹp không, hay chỉ cần chỗ để ngồi? |
| `FLOW-4` / `FLOW-7` | Phần tử thứ tư có cần thẳng cột dưới phần tử thứ nhất không? |
| `FLOW-6` / `FLOW-7` | Số cột đến từ nội dung hay từ bề rộng còn lại? |
| `FLOW-6` / `FLOW-8` | Đổi chỗ hai vùng cho nhau thì nghĩa của trang có đổi không? |
| `FLOW-3` / mọi lưới | Có điểm ngắt nào khai báo số cột không? |

## Sai lầm lặp lại nhiều nhất

1. Không khai báo trục dọc, rồi nối các con bằng `margin`.
2. Dựng lưới bằng `flex-wrap` cộng bề rộng cứng, để hàng cuối lệch và các thẻ không cao bằng nhau.
3. Viết `1fr` thay vì `minmax(0,1fr)` cho rãnh nội dung, rồi đi tìm lỗi ở mô-đun tràn nội dung.
4. Đặt `flex` lên một đoạn văn để canh một biểu tượng hoặc một nhãn nhỏ.
5. Đếm điểm ngắt cho một tập mà độ dài do dữ liệu quyết, thay vì khai báo bề rộng tối thiểu.
6. Viết `flex flex-row` trong khi hàng đã là trục mặc định.
7. Viết theo hướng rộng trước: `flex-row sm:flex-col`.
8. Dùng `grid-cols-2` cho một thanh dọc và một vùng nội dung.
9. Bỏ khai báo luồng vì "đang có mỗi một phần tử".
10. Dùng `*-reverse` hoặc `order-*` để sửa thứ tự đọc, làm bàn phím đi ngược với mắt.
