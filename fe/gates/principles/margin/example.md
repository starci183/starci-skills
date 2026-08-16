---
id: fe-principles-margin-example
title: example.md
slug: /gates/principles/margin/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã MARGIN-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `margin` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thông thường với `className` thông thường**. Không thư viện thành
phần, không hệ thống thiết kế riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao
diện nào — nên nếu một ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã
đó**. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một class CSS duy nhất.

Một lưu ý đọc xuyên suốt: mã áp cho **một phần tử**, không áp cho cả cây. Một trang bình thường gồm
hàng trăm `MARGIN-0` và vài chỗ còn lại. Nếu bạn thấy nhiều hơn "vài chỗ", đó là dấu hiệu một quyết
định của cha đang bị con giành mất.

---

## `MARGIN-0` — không khai báo lề ngoài

### Trường hợp: hai phần nội dung chồng nhau

```tsx
<main className="flex flex-col gap-6">
  <section>Tổng quan</section>
  <section>Hoạt động gần đây</section>
</main>
```

Khoảng cách giữa hai phần nội dung là một quan hệ giữa **hai** thứ, nên nó thuộc về cha. Không con nào ở
đây có quyết định đặt chỗ của riêng nó.

### Trường hợp: nhãn và ô nhập liệu

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="email">Email</label>
  <input className="rounded-md border px-3 py-2" id="email" type="email" />
</div>
```

### Trường hợp: lưới thẻ

```tsx
<div className="grid gap-4 sm:grid-cols-3">
  <article className="rounded-lg border p-4">Nền tảng hệ thống</article>
  <article className="rounded-lg border p-4">Khả năng mở rộng</article>
  <article className="rounded-lg border p-4">Độ tin cậy</article>
</div>
```

### Trường hợp: biểu tượng và chữ trong một nút

```tsx
<button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" type="button">
  <svg aria-hidden="true" className="size-4" />
  Tải xuống
</button>
```

### Trường hợp: hàng trong danh sách có đường phân cách

```tsx
<ul className="divide-y rounded-lg border">
  <li className="p-4">Thông báo qua email</li>
  <li className="p-4">Thông báo đẩy</li>
  <li className="p-4">Bản tin hằng tuần</li>
</ul>
```

Nhịp nằm trong khoảng đệm trong của hàng và trong đường phân cách. Không có phần tử nào tự dịch chuyển.

### Trường hợp: khung chờ giữ đúng chỗ của nội dung thật

```tsx
<div className="flex flex-col gap-3">
  <span className="h-5 w-40 rounded bg-neutral-200" />
  <span className="h-10 w-full rounded bg-neutral-200" />
</div>
```

### Trường hợp: trạng thái rỗng nằm trong đúng khung của trạng thái có dữ liệu

```tsx
<section className="flex flex-col gap-3">
  <h2 className="font-medium">Bài nộp</h2>
  <div className="rounded-lg border p-8 text-center text-sm text-neutral-500">
    Chưa có bài nộp nào.
  </div>
</section>
```

### Ngoại lệ và nhầm lẫn

- **Không dùng lề ngoài đo bằng số để tạo khoảng cách giữa các phần tử cùng cấp.** Khoảng cách là quyết
  định của phần tử cha:

  ```tsx
  {/* SAI */}
  <main className="flex flex-col">
    <section>Tổng quan</section>
    <section className="mt-6">Hoạt động gần đây</section>
  </main>
  ```

  ```tsx
  {/* ĐÚNG */}
  <main className="flex flex-col gap-6">
    <section>Tổng quan</section>
    <section>Hoạt động gần đây</section>
  </main>
  ```

  Bản SAI trông giống hệt bản ĐÚNG trên màn hình, và đó chính là vấn đề: nó đặt khoảng cách vào một
  chỗ mà người sau không tìm ra, và khoảng cách sẽ biến mất ngay khi phần nội dung thứ hai bị ẩn theo
  điều kiện.

- **Không dùng lề ngoài để tạo khoảng thở bên trong.** Đó là khoảng đệm trong của chủ ranh giới:

  ```tsx
  {/* SAI */}  <div className="rounded-lg border"><p className="m-4">Nội dung</p></div>
  {/* ĐÚNG */} <div className="rounded-lg border p-4"><p>Nội dung</p></div>
  ```

- **Không dùng `m-0` để bóp một khoảng cách mà phần tử cha đã chọn.** `m-0` khẳng định có một lề ngoài ngoại lai; nếu
  không có thì lời khẳng định đó sai:

  ```tsx
  {/* SAI */}  <div className="flex flex-col gap-6"><p className="m-0">…</p><p className="m-0">…</p></div>
  ```

  Muốn hẹp hơn thì đổi khoảng cách ở phần tử cha, đừng dán `m-0` lên từng phần tử con.

- **Không dùng lề ngoài âm để tràn ra khỏi khoảng đệm của phần tử cha.** Dựng một cấu trúc không có khoảng đệm để
  mà tràn:

  ```tsx
  {/* SAI */}
  <article className="rounded-lg border p-4">
    <img alt="" className="-mx-4 -mt-4 w-auto" src="/cover.jpg" />
    <h3>Tiêu đề</h3>
  </article>
  ```

  ```tsx
  {/* ĐÚNG */}
  <article className="overflow-hidden rounded-lg border">
    <img alt="" className="block w-full" src="/cover.jpg" />
    <div className="p-4">
      <h3>Tiêu đề</h3>
    </div>
  </article>
  ```

  Bản ĐÚNG di chuyển ranh giới khoảng đệm trong xuống đúng phần cần khoảng đệm trong, nên không có ranh giới nào bị
  vượt qua sau lưng người sở hữu nó.

- **Phần tử chồng lớp không dịch bằng lề ngoài.** Thứ nằm đè lên luồng là bài toán định vị:

  ```tsx
  {/* SAI */}  <div className="-mt-10">…nhãn đè lên ảnh…</div>
  {/* ĐÚNG */} <div className="relative"><img alt="" src="/cover.jpg" /><span className="absolute bottom-0 translate-y-1/2">…</span></div>
  ```

---

## `MARGIN-1` — `m-0` xoá một lề ngoài có thật

### Trường hợp: tiêu đề trong một thẻ đã có khoảng đệm trong

```tsx
<article className="rounded-lg border p-4">
  <h3 className="m-0 font-medium">Biểu mẫu dễ tiếp cận</h3>
  <p className="text-sm text-neutral-500">Tóm tắt ngắn.</p>
</article>
```

Lề ngoài mặc định của `h3` cộng thêm vào khoảng đệm trong của thẻ, làm mép trên dày hơn mép dưới. `m-0` trả
quyền quyết định về cho thẻ.

### Trường hợp: đoạn văn cuối trong một khối văn bản

```tsx
<div className="rounded-lg border p-4">
  <p>Đoạn đầu.</p>
  <p className="m-0">Đoạn cuối, không kéo thêm khoảng trắng xuống dưới border.</p>
</div>
```

### Trường hợp: trích dẫn trong nội dung do người dùng nhập

```tsx
<blockquote className="m-0 border-s-2 ps-4 text-sm text-neutral-600">
  Phần giải thích trade-off bằng kịch bản hỏng là chỗ đọng lại nhất.
</blockquote>
```

### Trường hợp: danh sách mặc định của trình duyệt bên trong một danh sách đã tự thêm khoảng đệm trong

```tsx
<div className="rounded-lg border p-4">
  <ul className="m-0 flex list-none flex-col gap-2 p-0">
    <li>Ghi trùng khi retry</li>
    <li>Đọc cũ sau khi ghi</li>
  </ul>
</div>
```

### Trường hợp: thành phần của bên thứ ba mang theo lề ngoài riêng

```tsx
<div className="rounded-lg border p-4">
  <div className="[&>iframe]:m-0">
    <iframe src="/embed/player" title="Trình phát" />
  </div>
</div>
```

Lề ngoài đến từ ngoài tầm với của lớp xoá dùng chung, nên nó bị xoá tại chỗ và chỗ đó ghi rõ mình đang xoá cái
gì.

### Trường hợp: `fieldset` mặc định trong một biểu mẫu đã dùng khoảng cách của phần tử cha

```tsx
<form className="flex flex-col gap-4">
  <fieldset className="m-0 border-0 p-0">
    <legend className="text-sm font-medium">Thông tin liên hệ</legend>
  </fieldset>
</form>
```

### Ngoại lệ và nhầm lẫn

- **Không gọi tên được lề ngoài đang tồn tại ⇒ không phải mã này.** Đó là `MARGIN-0`.
- **Xoá xong mà thiếu khoảng cách ⇒ phần tử cha chưa quyết khoảng cách.** Sửa ở phần tử cha, đừng để lề ngoài mặc định làm
  thay việc của cha:

  ```tsx
  {/* SAI: dựa vào margin mặc định của trình duyệt để tạo khoảng cách */}
  <article className="rounded-lg border p-4">
    <h3>Tiêu đề</h3>
    <p>Nội dung</p>
  </article>
  ```

  ```tsx
  {/* ĐÚNG: phần tử cha quyết khoảng cách, phần tử con xoá margin ngoại lai */}
  <article className="flex flex-col gap-2 rounded-lg border p-4">
    <h3 className="m-0 font-medium">Tiêu đề</h3>
    <p className="m-0 text-sm text-neutral-500">Nội dung</p>
  </article>
  ```

- **Ưu tiên lớp xoá dùng chung.** Nếu quy tắc toàn cục đã bỏ lề ngoài mặc định của tiêu đề thì viết
  `m-0` ở từng nơi sử dụng là rác: nó nói dối rằng vẫn còn một lề ngoài ở đó.
- **`m-0` không phải `MARGIN-0`.** Hai mã, hai lời khẳng định khác nhau. Đừng viết `m-0` lên một phần
  tử không có lề ngoài nào chỉ để "cho chắc".

---

## `MARGIN-2` — `mx-auto` căn giữa khối đã bị giới hạn

### Trường hợp: cột đọc

```tsx
<main className="mx-auto w-full max-w-3xl">
  <h1 className="m-0 text-2xl font-semibold">Hướng dẫn</h1>
</main>
```

### Trường hợp: thẻ đăng nhập giữa màn hình

```tsx
<div className="grid min-h-screen place-items-center p-4">
  <form className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-lg border p-6">
    <h1 className="m-0 text-lg font-semibold">Đăng nhập</h1>
    <input aria-label="Email" className="rounded-md border px-3 py-2" type="email" />
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Tiếp tục</button>
  </form>
</div>
```

### Trường hợp: khối trạng thái rỗng hẹp trong một vùng rộng

```tsx
<section className="rounded-lg border p-8">
  <div className="mx-auto flex max-w-sm flex-col gap-2 text-center">
    <strong>Chưa có gì ở đây</strong>
    <p className="m-0 text-sm text-neutral-500">Tạo mục đầu tiên để bắt đầu theo dõi tiến độ.</p>
  </div>
</section>
```

### Trường hợp: khối kêu gọi hành động hẹp giữa một phần nội dung rộng

```tsx
<section className="rounded-lg bg-neutral-50 p-8">
  <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
    <p className="m-0">Sẵn sàng nộp bài?</p>
    <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white" type="button">Nộp bài</button>
  </div>
</section>
```

### Trường hợp: ảnh có bề rộng cố định trong khung rộng hơn

```tsx
<figure className="m-0">
  <img alt="Sơ đồ luồng ghi" className="mx-auto block w-full max-w-xl" src="/diagram.png" />
  <figcaption className="mt-0 text-center text-xs text-neutral-500">Luồng ghi có quorum</figcaption>
</figure>
```

`figure` có lề ngoài mặc định nên nó là `MARGIN-1`; ảnh bị giới hạn bề rộng nên nó là `MARGIN-2`. Hai
phần tử, hai mã.

### Ngoại lệ và nhầm lẫn

- **Không có ràng buộc chiều rộng ⇒ `mx-auto` là class CSS không có tác dụng:**

  ```tsx
  {/* SAI: khối đã chiếm trọn chiều ngang, không còn phần dư nào để chia */}
  <div className="mx-auto">Nội dung</div>
  ```

  ```tsx
  {/* ĐÚNG */}
  <div className="mx-auto w-full max-w-2xl">Nội dung</div>
  ```

- **Căn giữa nhiều con là việc của cha:**

  ```tsx
  {/* SAI */}
  <div className="flex flex-col gap-3">
    <span className="mx-auto">Một</span>
    <span className="mx-auto">Hai</span>
  </div>
  ```

  ```tsx
  {/* ĐÚNG */}
  <div className="flex flex-col items-center gap-3">
    <span>Một</span>
    <span>Hai</span>
  </div>
  ```

- **`mx-auto` trên một phần tử con của hàng flex không phải căn giữa trang.** Nó chỉ chia phần dư
  *của riêng phần tử đó* trên trục chính, và kết quả gần như luôn khác thứ người viết định nói. Muốn cả hàng nằm
  giữa thì cha dùng `justify-center`.
- **Căn giữa chữ không phải căn giữa khối.** `text-center` và `mx-auto` giải hai bài toán khác nhau;
  dùng nhầm cái này cho cái kia là lý do phổ biến khiến một khối “vẫn lệch” sau khi đã thêm class CSS.

---

## `MARGIN-3` — `ms-auto` đẩy một phần tử về cuối hàng

### Trường hợp: nút hành động cuối thanh công cụ

```tsx
<header className="flex items-center gap-3">
  <h2 className="m-0 font-medium">Bản nháp</h2>
  <button className="ms-auto rounded-md border px-3 py-2 text-sm" type="button">Xuất bản</button>
</header>
```

### Trường hợp: nhãn trạng thái cuối một hàng

```tsx
<div className="flex items-center gap-3 rounded-lg border p-4">
  <span className="grid size-8 place-items-center rounded-full bg-neutral-100 text-xs">AN</span>
  <span className="font-medium">Nguyễn Văn An</span>
  <span className="ms-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Đang hoạt động</span>
</div>
```

### Trường hợp: giá tiền cuối một dòng đơn hàng

```tsx
<li className="flex items-baseline gap-2 p-4">
  <span className="font-medium">Gói nâng cao</span>
  <span className="text-sm text-neutral-500">× 1</span>
  <span className="ms-auto tabular-nums">499.000đ</span>
</li>
```

### Trường hợp: hai mã lồng nhau — hàng là `MARGIN-0`, nhãn là `MARGIN-3`

```tsx
<ul className="divide-y rounded-lg border">
  {items.map((item) => (
    <li className="flex items-center gap-3 p-4" key={item.id}>
      <span className="truncate">{item.title}</span>
      <span className="ms-auto shrink-0 text-sm tabular-nums text-neutral-500">{item.duration}</span>
    </li>
  ))}
</ul>
```

Cả `ul` lẫn từng `li` đều là `MARGIN-0` — nhịp nằm trong đường phân cách và khoảng đệm trong của hàng. Chỉ
**một** phần tử con bên trong mỗi hàng mang `MARGIN-3`. Đây là hình dạng bình thường của luật: một
cây gần như toàn `MARGIN-0`, điểm xuyết vài chỗ có dữ kiện bố cục thật.

### Ngoại lệ và nhầm lẫn

- **Hai con dạt hai đầu là `justify-between` ở cha, không phải `ms-auto` ở con:**

  ```tsx
  {/* SAI */}
  <div className="flex items-center">
    <span>Trạng thái</span>
    <button className="ms-auto" type="button">Xử lý</button>
  </div>
  ```

  ```tsx
  {/* ĐÚNG khi ý là "hai đầu" */}
  <div className="flex items-center justify-between">
    <span>Trạng thái</span>
    <button type="button">Xử lý</button>
  </div>
  ```

  Khác biệt không nằm ở hình ảnh — hai bản này hiển thị giống nhau khi chỉ có hai phần tử con. Nó nằm ở chỗ
  bản ĐÚNG vẫn còn đúng khi thêm con thứ ba, còn bản SAI thì đổi nghĩa lặng lẽ.

- **Hai `ms-auto` trong một hàng là luật phân bố đội lốt luật đặt chỗ:**

  ```tsx
  {/* SAI */}
  <div className="flex items-center gap-2">
    <span>A</span>
    <span className="ms-auto">B</span>
    <span className="ms-auto">C</span>
  </div>
  ```

  ```tsx
  {/* ĐÚNG: bọc nhóm, rồi đẩy một nhóm */}
  <div className="flex items-center gap-2">
    <span>A</span>
    <div className="ms-auto flex items-center gap-2">
      <span>B</span>
      <span>C</span>
    </div>
  </div>
  ```

- **Không phải con trực tiếp thì lề ngoài tự động không nuốt được phần dư của hàng:**

  ```tsx
  {/* SAI: nút nằm trong một div trung gian, phần dư thuộc về div đó */}
  <div className="flex items-center gap-3">
    <h2>Bản nháp</h2>
    <div><button className="ms-auto" type="button">Xuất bản</button></div>
  </div>
  ```

- **Ưu tiên thuộc tính lô-gic.** `ms-auto` chứ không `ml-auto`, để vị trí vẫn đúng ở ngôn ngữ viết từ
  phải sang trái:

  ```tsx
  {/* SAI */}  <button className="ml-auto" type="button">Xuất bản</button>
  {/* ĐÚNG */} <button className="ms-auto" type="button">Xuất bản</button>
  ```

---

## `MARGIN-4` — `mt-auto` ghim một phần tử con xuống đáy cột

### Trường hợp: thẻ cùng chiều cao trong một lưới

```tsx
<div className="grid gap-4 sm:grid-cols-3">
  {courses.map((course) => (
    <article className="flex h-full flex-col gap-3 rounded-lg border p-4" key={course.id}>
      <h3 className="m-0 font-medium">{course.title}</h3>
      <p className="m-0 text-sm text-neutral-500">{course.summary}</p>
      <a className="mt-auto text-sm underline" href={course.href}>Xem chi tiết</a>
    </article>
  ))}
</div>
```

`h-full` là bằng chứng: chiều cao đến từ hàng của lưới chứ không từ nội dung, nên có phần dư để nhận.
Tóm tắt dài ngắn khác nhau mà các liên kết vẫn thẳng đáy.

### Trường hợp: thanh bên cao bằng màn hình

```tsx
<aside className="flex h-screen flex-col gap-2 border-e p-4">
  <a className="rounded-md px-3 py-2 text-sm" href="#a">Bảng điều khiển</a>
  <a className="rounded-md px-3 py-2 text-sm" href="#b">Khoá học</a>
  <button className="mt-auto rounded-md px-3 py-2 text-start text-sm" type="button">Đăng xuất</button>
</aside>
```

### Trường hợp: thẻ sản phẩm — giá và nút ở đáy

```tsx
<article className="flex h-full flex-col gap-2 rounded-lg border p-4">
  <h3 className="m-0 font-medium">Gói nâng cao</h3>
  <p className="m-0 text-sm text-neutral-500">Bao gồm chấm bài và phản hồi chi tiết.</p>
  <div className="mt-auto flex items-baseline gap-2">
    <span className="text-xl font-semibold tabular-nums">499.000đ</span>
    <span className="text-sm text-neutral-500">mỗi tháng</span>
  </div>
</article>
```

### Trường hợp: đồng nhất trạng thái — khung chờ giữ nguyên `mt-auto`

```tsx
<article className="flex h-full flex-col gap-3 rounded-lg border p-4">
  <span className="h-5 w-32 rounded bg-neutral-200" />
  <span className="h-4 w-full rounded bg-neutral-200" />
  <span className="mt-auto h-9 w-24 rounded bg-neutral-200" />
</article>
```

Bỏ `mt-auto` ở khung chờ thì nút sẽ nhảy xuống đáy đúng lúc dữ liệu về — một chuyển động không ai yêu
cầu, do bộ quy tắc bị bỏ ở đúng trạng thái ít người xem nhất.

### Trường hợp: ba mã lồng nhau trong một thẻ

```tsx
<article className="flex h-full flex-col gap-3 rounded-lg border p-4">
  <h3 className="m-0 font-medium">Thiết kế hệ thống ghi tin cậy</h3>
  <p className="m-0 text-sm text-neutral-500">Retry, idempotency và các miền hỏng.</p>
  <footer className="mt-auto flex items-center gap-2">
    <span className="text-sm text-neutral-500">12 bài</span>
    <a className="ms-auto text-sm underline" href="#detail">Tiếp tục</a>
  </footer>
</article>
```

Ba phần tử, ba mã: `h3` là `MARGIN-1`, `footer` là `MARGIN-4`, liên kết bên trong phần cuối là `MARGIN-3` —
còn `p` và `span` là `MARGIN-0`. Mỗi mã trả lời cho **một** phần tử, và chỉ khi
phần tử đó có dữ kiện bố cục của riêng nó.

### Trường hợp: bốn mã lồng nhau trong một trang

```tsx
<div className="mx-auto w-full max-w-5xl p-6">
  <header className="flex items-center gap-3">
    <h1 className="m-0 text-xl font-semibold">Khoá học của tôi</h1>
    <button className="ms-auto rounded-md border px-3 py-2 text-sm" type="button">Lọc</button>
  </header>
  <div className="mt-0 grid gap-4 sm:grid-cols-2">
    <article className="flex h-full flex-col gap-3 rounded-lg border p-4">
      <h3 className="m-0 font-medium">Nền tảng hệ thống</h3>
      <p className="m-0 text-sm text-neutral-500">Sáu bài.</p>
      <a className="mt-auto text-sm underline" href="#a">Tiếp tục</a>
    </article>
    <article className="flex h-full flex-col gap-3 rounded-lg border p-4">
      <h3 className="m-0 font-medium">Khả năng mở rộng</h3>
      <p className="m-0 text-sm text-neutral-500">Mười bài, gồm hai lab dài.</p>
      <a className="mt-auto text-sm underline" href="#b">Tiếp tục</a>
    </article>
  </div>
</div>
```

Ở đây `mt-0` trên lưới là một lỗi cố tình để đọc: lưới không có lề ngoài mặc định nào, nên `mt-0` là
một lời khẳng định sai và phải bị xoá. Khoảng cách giữa phần đầu và lưới thuộc về phần tử cha:

```tsx
{/* ĐÚNG */}
<div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
  <header className="flex items-center gap-3">
    <h1 className="m-0 text-xl font-semibold">Khoá học của tôi</h1>
    <button className="ms-auto rounded-md border px-3 py-2 text-sm" type="button">Lọc</button>
  </header>
  <div className="grid gap-4 sm:grid-cols-2">…</div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Cột co theo nội dung ⇒ `mt-auto` vô hiệu:**

  ```tsx
  {/* SAI: không có h-full, không có flex-1, không có min-h — không có phần dư nào để nuốt */}
  <article className="flex flex-col gap-3 rounded-lg border p-4">
    <h3 className="m-0">Tiêu đề</h3>
    <a className="mt-auto" href="#x">Tiếp tục</a>
  </article>
  ```

  Class CSS này không làm gì cả, nhưng nó **tồn tại mãi như một lời giải thích sai**: người sau sẽ tin
  rằng đáy thẻ đang được ghim, và sẽ sửa nhầm chỗ khi nó lệch.

- **Cột chỉ có hai khối ⇒ `justify-between` ở cha sạch hơn:**

  ```tsx
  {/* ĐÚNG cho đúng hai khối */}
  <article className="flex h-full flex-col justify-between rounded-lg border p-4">
    <h3 className="m-0">Tiêu đề</h3>
    <a href="#x">Tiếp tục</a>
  </article>
  ```

  Dùng `mt-auto` khi có nhiều con và chỉ **một** con phải xuống đáy.

- **Chiều cao đến từ `flex-1` cũng hợp lệ:**

  ```tsx
  <div className="flex h-96 flex-col">
    <header className="border-b p-4">Tiêu đề</header>
    <section className="flex flex-1 flex-col gap-3 p-4">
      <p className="m-0 text-sm">Nội dung dài ngắn tuỳ dữ liệu.</p>
      <button className="mt-auto rounded-md border px-3 py-2 text-sm" type="button">Lưu</button>
    </section>
  </div>
  ```

- **Thiết kế đáp ứng: chỉ đổi mã khi vai trò bố cục đổi thật:**

  ```tsx
  {/* Ở màn hẹp thẻ co theo nội dung; chỉ từ sm mới có hàng cùng chiều cao */}
  <article className="flex flex-col gap-3 rounded-lg border p-4 sm:h-full">
    <h3 className="m-0 font-medium">Tiêu đề</h3>
    <a className="text-sm underline sm:mt-auto" href="#x">Tiếp tục</a>
  </article>
  ```

  Đây **không** phải ngoại lệ cho việc đổi class CSS theo màn hình cho đẹp: nguồn chiều cao thật sự khác
  nhau ở hai điểm ngắt, nên tình huống khác nhau.

- **`mb-auto` không phải một mã.** Tập đóng ở năm mã; muốn đẩy nội dung lên đỉnh thì cha quyết bằng
  `justify-start`.

---

## Ánh xạ yêu cầu sang một class CSS

Nêu phần tử, bố cục của phần tử cha, trục còn dư chỗ và ý định đặt chỗ. Nếu thiếu **một** dữ kiện
quyết định, tạo `MARGIN-0` và hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một
câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Tăng khoảng cách giữa Tổng quan và Hoạt động | Đây là khoảng cách giữa các phần tử cùng cấp, thuộc về phần tử cha | `MARGIN-0` | không có class CSS lề ngoài; phân loại khoảng cách ở phần tử cha |
| Cho nội dung trong thẻ thở ra khỏi viền | Khoảng thở bên trong ranh giới là khoảng đệm trong | `MARGIN-0` | không có class CSS lề ngoài; khoảng đệm trong ở chủ ranh giới |
| Tiêu đề nhúng mang lề ngoài của trình duyệt, bỏ nó đi | Có một lề ngoài thật, gọi được tên | `MARGIN-1` | `m-0` |
| Căn giữa một cột đọc có bề rộng tối đa | Khối bị giới hạn, hai bên còn dư chỗ | `MARGIN-2` | `mx-auto w-full max-w-3xl` |
| Giữ tiêu đề ở đầu, đẩy Xuất bản về cuối cùng hàng | Một phần tử flex nhận phần chiều ngang còn dư trước nó | `MARGIN-3` | `ms-auto` |
| Thẻ cùng chiều cao phải giữ nút ở đáy sau phần nội dung dài ngắn khác nhau | Thân thẻ là cột có chiều cao được cấp | `MARGIN-4` | `mt-auto` |
| Căn giữa nội dung này bằng lề ngoài | Không có ràng buộc chiều rộng nên không chứng minh được căn giữa | `MARGIN-0` | không có class CSS lề ngoài |
| Đẩy hành động này ra sát mép | Chưa biết phần tử cha có phải hàng flex sở hữu mép đó không | `MARGIN-0` | không có class CSS lề ngoài |
| Kéo ảnh bìa tràn ra khỏi khoảng đệm trong của thẻ | Tràn viền là cấu trúc bố cục, không phải lề ngoài | `MARGIN-0` | không có class CSS lề ngoài; đổi cấu trúc |
| Nhích nhãn lên đè mép ảnh vài điểm ảnh | Đè lên luồng là bài toán định vị | `MARGIN-0` | không có class CSS lề ngoài; dùng thuộc tính vị trí |

Hai dòng "thiếu dữ kiện" chỉ được hỏi khi bên yêu cầu **nói rõ** họ cần đặt chỗ bằng lề ngoài tự động:

- *"Chiều rộng hoặc `max-width` nào đang ràng buộc khối này?"*
- *"Phần tử này có phải con trực tiếp của đúng hàng flex đang sở hữu mép đó không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `MARGIN-0` / `MARGIN-1` | Có gọi tên được lề ngoài đang tồn tại và ai đặt nó không? |
| `MARGIN-0` / `MARGIN-2` | Chiều rộng nào đang ràng buộc khối, để lại phần chiều ngang còn dư? |
| `MARGIN-0` / `MARGIN-3` | Phần tử cha có phải hàng flex và phần tử có phải con trực tiếp của nó không? |
| `MARGIN-0` / `MARGIN-4` | Chiều cao của cột đến từ cha hay từ chính nội dung? |
| `MARGIN-2` / `MARGIN-3` | Phần dư được chia đôi về hai phía, hay dồn hết về một phía? |
| `MARGIN-3` / `MARGIN-4` | Trục còn dư chỗ là trục ngang hay trục dọc? |
| Lề ngoài tự động / phân bố ở phần tử cha | Chỉ **một** phần tử con cần dịch hay **mọi** phần tử con cần được xếp lại? |

## Sai lầm lặp lại nhiều nhất

1. Dùng lề ngoài đo bằng số (`mt-4`, `mb-6`) để tạo khoảng cách giữa các phần tử cùng cấp, thay vì để
   phần tử cha quyết.
2. Dùng lề ngoài để tạo khoảng thở bên trong, thay vì khoảng đệm trong của chủ ranh giới.
3. Viết `m-0` khi không có lề ngoài nào tồn tại — một lời khẳng định sai để lại vĩnh viễn trong mã.
4. Viết `mx-auto` mà không có ràng buộc chiều rộng, rồi kết luận “class CSS này không chạy”.
5. Viết `mt-auto` trong một cột co theo nội dung, rồi tin rằng đáy đang được ghim.
6. Hai `ms-auto` trong một hàng, tạo ra một kết quả không đọc được từ chỗ nào.
7. Dùng `ml-auto`/`mr-auto` thay vì thuộc tính lô-gic, làm hỏng ngôn ngữ viết từ phải sang trái.
8. Dùng lề ngoài âm để tràn viền, thay vì đổi chỗ đặt khoảng đệm trong.
9. Bỏ lề ngoài tự động ở khung chờ nên bố cục nhảy đúng lúc dữ liệu về.
10. Đổi mã theo điểm ngắt dù nguồn chiều cao và trục còn dư chỗ không hề đổi.
