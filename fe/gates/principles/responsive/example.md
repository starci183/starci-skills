---
id: fe-principles-responsive-example
title: example.md
slug: /gates/principles/responsive/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã RESPONSIVE-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `responsive` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký, không bản xem trước trực tiếp của một sản phẩm nào. Một luật chỉ đúng khi nó
đúng ở bất kỳ giao diện nào — nên nếu một ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó
sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới mục **ngoại lệ và nhầm lẫn**: những thứ trông giống mã đó nhưng
không phải, và những thứ bị cấm. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một chuỗi class CSS duy
nhất, và phân định từng cặp ranh giới.

Tiền tố `sm:` / `md:` / `lg:` trong mọi ví dụ đại diện cho **ngưỡng đã đo được**. Chúng không phải
tên thiết bị, và không phải một phần của đáp án — đáp án là *bề rộng nào bạn thấy nội dung hỏng*.

---

## `RESPONSIVE-1` — không khai báo class CSS thiết kế đáp ứng

### Trường hợp: một cột nội dung đọc dọc

```tsx
<article className="flex flex-col gap-4">
  <h1 className="text-2xl font-semibold">Nhất quán trong hệ phân tán</h1>
  <p className="text-muted-foreground">
    Bài này mô tả các mức nhất quán bằng kịch bản hỏng, không bằng định nghĩa.
  </p>
  <p>Đọc xong bạn sẽ chọn được mức nhất quán từ hệ quả nghiệp vụ.</p>
</article>
```

Văn bản vốn đã tự xuống dòng. Ở bề rộng hẹp nhất được hỗ trợ, không có gì hỏng — nên không có gì để
sửa.

### Trường hợp: biểu mẫu một cột

```tsx
<form className="flex flex-col gap-4">
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="email">Email</label>
    <input className="rounded-md border px-3 py-2" id="email" type="email" />
  </div>
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="pass">Mật khẩu</label>
    <input className="rounded-md border px-3 py-2" id="pass" type="password" />
  </div>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Đăng nhập</button>
</form>
```

Một cột là hình học hẹp nhất đã. Không có bề rộng nào khiến nó hỏng thêm được nữa.

### Trường hợp: trạng thái rỗng

```tsx
<div className="flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
  <p className="font-medium">Bạn chưa ghi danh khoá nào</p>
  <p className="text-sm text-muted-foreground">Chọn một khoá để bắt đầu lộ trình.</p>
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Xem danh mục</button>
</div>
```

### Trường hợp: nội dung một hộp thoại ngắn

```tsx
<div className="flex flex-col gap-4 rounded-lg border p-6">
  <h2 className="text-lg font-semibold">Huỷ ghi danh?</h2>
  <p className="text-sm text-muted-foreground">Tiến độ của bạn được giữ lại trong 30 ngày.</p>
  <div className="flex flex-col gap-2">
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Huỷ ghi danh</button>
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Giữ nguyên</button>
  </div>
</div>
```

Hai nút vốn đã xếp dọc ở mọi bề rộng. Không có bề rộng nào khiến chúng hỏng thêm, nên không có gì để
sửa — đừng thêm `sm:flex-row` chỉ vì có chỗ trống.

### Trường hợp: chỗ "vỡ ở màn hẹp" thật ra là thiếu `min-w-0`

```tsx
<div className="flex items-center gap-3">
  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100">AN</span>
  <div className="flex min-w-0 flex-col gap-1">
    <strong className="truncate">Thiết kế hệ thống thanh toán chịu lỗi từng phần</strong>
    <span className="truncate text-sm text-muted-foreground">Cập nhật hôm qua</span>
  </div>
</div>
```

Phần tử con flex mặc định **không co nhỏ hơn nội dung của nó** — đó là lý do thật khiến hàng này đẩy tràn ở
màn hẹp. `min-w-0` sửa đúng nguyên nhân; một điểm ngắt chỉ giấu triệu chứng đi ở đúng một bề rộng.

### Ngoại lệ và nhầm lẫn

- **Cấm điểm ngắt rỗng.** Viết một ghi đè lặp lại đúng cơ sở là tuyên bố rằng có một bề rộng quan
  trọng, trong khi không có.

  ```tsx
  {/* SAI */}  <div className="flex flex-row sm:flex-row gap-2">…</div>
  {/* SAI */}  <ul className="grid grid-cols-3 lg:grid-cols-3 gap-4">…</ul>
  {/* ĐÚNG */} <div className="flex flex-row gap-2">…</div>
  ```

- **"Cho nó thiết bị di động hơn" không phải bằng chứng.** Không gọi tên được cái gì hỏng thì đáp án là mã này.

  ```tsx
  {/* SAI: thêm breakpoint vì được yêu cầu chung chung */}
  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">…</section>
  ```

- **Cấm tư duy max-chiều rộng.** Cơ sở là trạng thái hẹp nhất; ghi đè chỉ đi lên.

  ```tsx
  {/* SAI */}  <div className="flex-row max-sm:flex-col">…</div>
  {/* ĐÚNG */} <div className="flex flex-col sm:flex-row">…</div>
  ```

---

## `RESPONSIVE-2` — xuống dòng: vẫn một chuỗi, chỉ thêm dòng

### Trường hợp: danh sách thẻ do dữ liệu quyết định

```tsx
<ul className="flex flex-wrap items-center gap-2">
  {tags.map((tag) => (
    <li className="rounded-full border px-3 py-1 text-sm" key={tag.id}>{tag.name}</li>
  ))}
</ul>
```

Số thẻ không biết trước, nên không có bề rộng nào an toàn nếu ép một dòng. Thẻ thứ chín rơi xuống
dòng dưới không làm ai hiểu sai.

### Trường hợp: siêu dữ liệu dưới tiêu đề

```tsx
<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
  <span>Mai Lê</span>
  <span aria-hidden="true">·</span>
  <time dateTime="2026-08-16">16/08/2026</time>
  <span aria-hidden="true">·</span>
  <span>18 phút đọc</span>
  <span aria-hidden="true">·</span>
  <span>Nâng cao</span>
</div>
```

`gap-x` và `gap-y` khác nhau ở đây vì khoảng cách giữa các phần tử giữa các dòng của một chuỗi xuống dòng không phải cùng một quan
hệ với khoảng cách giữa các phần tử giữa các mục trên một dòng — đây là điều chỉnh trong cùng một quan hệ, không phải đổi mã.

### Trường hợp: nhãn nhỏ bộ lọc đang bật

```tsx
<div className="flex flex-wrap items-center gap-2">
  <span className="text-sm text-muted-foreground">Đang lọc:</span>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Nền tảng ×</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Dưới 8 tuần ×</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Có mentor ×</button>
</div>
```

### Trường hợp: nhãn dài ra vì đổi ngôn ngữ

```tsx
<div className="flex flex-wrap items-center gap-2">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Xuất báo cáo tiến độ học tập</button>
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Chia sẻ với người hướng dẫn</button>
</div>
```

Bản dịch dài gấp rưỡi bản gốc là chuyện bình thường. `flex-wrap` chịu được điều đó mà không cần biết
trước độ dài; một hàng cứng thì không.

### Trường hợp: danh sách người tham gia

```tsx
<ul className="flex flex-wrap items-center gap-3">
  {members.map((member) => (
    <li className="flex items-center gap-2" key={member.id}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs">{member.initials}</span>
      <span className="text-sm">{member.name}</span>
    </li>
  ))}
</ul>
```

Mỗi `li` bên trong là một cụm không được tách rời — nên `shrink-0` trên ảnh đại diện, để chuỗi xuống dòng ở ranh
giới giữa các người, không xuống dòng vào giữa một người.

### Ngoại lệ và nhầm lẫn

- **Xuống dòng không thẳng cột.** Nếu người đọc cần **so sánh** giữa các phần tử thì xuống dòng là sai mã — đó là
  `RESPONSIVE-4`.

  ```tsx
  {/* SAI: các ô số liệu cần thẳng cột để so sánh */}
  <div className="flex flex-wrap gap-4">
    <div className="flex flex-col gap-1"><span className="text-2xl tabular-nums">12</span><span className="text-sm text-muted-foreground">khoá đang học</span></div>
    <div className="flex flex-col gap-1"><span className="text-2xl tabular-nums">86</span><span className="text-sm text-muted-foreground">bài đã xong</span></div>
  </div>
  ```

- **Xuống dòng trên một quan hệ hai vế là đúng mã sai chỗ.** Tiêu đề và nhóm hành động không phải phần tử ngang hàng đồng
  hạng; để chúng xuống dòng sẽ cho ra một trạng thái trung gian mà nhóm hành động dính lệch dưới tiêu đề.
  Đó là `RESPONSIVE-3`.

  ```tsx
  {/* SAI */}  <div className="flex flex-wrap items-center justify-between gap-3">…tiêu đề…<div>…nút…</div></div>
  ```

- **Cấm thu nhỏ để né xuống dòng.**

  ```tsx
  {/* SAI: giữ một dòng bằng cách hạ cỡ chữ và hit target */}
  <div className="flex items-center gap-1">
    <button className="px-1 py-0.5 text-[10px]" type="button">Lọc</button>
    <button className="px-1 py-0.5 text-[10px]" type="button">Sắp xếp</button>
  </div>
  ```

---

## `RESPONSIVE-3` — đổi trục: dọc khi hẹp, ngang khi đủ chỗ

### Trường hợp: phần đầu của một trang

```tsx
<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex min-w-0 flex-col gap-1">
    <h2 className="truncate text-lg font-semibold">Cài đặt không gian làm việc</h2>
    <p className="text-sm text-muted-foreground">Quản lý quyền truy cập và thông báo.</p>
  </div>
  <div className="flex flex-wrap items-center gap-2">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Xem nhật ký</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Mời thành viên</button>
  </div>
</header>
```

Cụm chữ và cụm nút là hai vế của một quan hệ. Khi hẹp, cả hai vẫn hiện, vẫn đúng thứ tự, chỉ xếp dọc.
`gap-3` giữ nguyên ở cả hai trục vì quan hệ giữa hai vế không đổi theo bề rộng.

### Trường hợp: ô nhập và hành động trực tiếp của nó

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
  <input aria-label="Mã giảm giá" className="min-w-0 rounded-md border px-3 py-2 sm:flex-1" />
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Áp dụng</button>
</div>
```

Ngưỡng `sm` ở đây là bề rộng mà ô nhập tụt xuống dưới mức nhập được — đo bằng số ký tự còn nhìn thấy,
không phải bằng tên thiết bị.

### Trường hợp: phần cuối của hộp thoại

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Xác nhận huỷ ghi danh</button>
</div>
```

Thứ tự DOM là Huỷ trước, Xác nhận sau, ở **mọi** bề rộng. Muốn nút chính lên trên khi hẹp thì phải
đổi DOM cho cả hai trạng thái, không được dùng `order-*`.

### Trường hợp: hai nhóm chi tiết ngang hàng

```tsx
<div className="flex flex-col gap-4 md:flex-row md:items-start">
  <div className="flex min-w-0 flex-1 flex-col gap-3">
    <h3 className="font-medium">Địa chỉ nhận hoá đơn</h3>
    <p className="text-sm text-muted-foreground">Số 12, đường Lê Lợi, Quận 1</p>
  </div>
  <div className="flex min-w-0 flex-1 flex-col gap-3">
    <h3 className="font-medium">Phương thức thanh toán</h3>
    <p className="text-sm text-muted-foreground">Thẻ kết thúc bằng 4242</p>
  </div>
</div>
```

### Trường hợp: khối giá và nút ghi danh

```tsx
<div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
  <div className="flex flex-col gap-1">
    <span className="text-2xl font-semibold tabular-nums">1.290.000đ</span>
    <span className="text-sm text-muted-foreground">trọn khoá, học lại miễn phí</span>
  </div>
  <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white md:shrink-0" type="button">
    Ghi danh ngay
  </button>
</div>
```

Giá là nội dung thiết yếu, nên không có bề rộng nào được phép giấu nó — `RESPONSIVE-6` bị loại từ đầu
ở đây, và đổi trục là phép sửa đúng.

### Ngoại lệ và nhầm lẫn

- **Đổi trục không được đổi khoảng cách giữa các phần tử.** Nếu `gap` đổi theo điểm ngắt, bạn đang nói quan hệ giữa hai vế
  thay đổi theo bề rộng màn hình — điều đó không đúng.

  ```tsx
  {/* SAI */}  <div className="flex flex-col gap-6 sm:flex-row sm:gap-2">…</div>
  {/* ĐÚNG */} <div className="flex flex-col gap-3 sm:flex-row">…</div>
  ```

- **Cấm `order-*` theo điểm ngắt.** Bàn phím và trình đọc màn hình chỉ đọc được thứ tự DOM; một thứ tự
  thị giác khác là một câu chuyện thứ hai mà họ không bao giờ nhận được.

  ```tsx
  {/* SAI */}
  <div className="flex flex-col sm:flex-row">
    <div className="order-2 sm:order-1">…tóm tắt…</div>
    <div className="order-1 sm:order-2">…hành động…</div>
  </div>
  ```

  Nếu trạng thái hẹp **thật sự** cần hành động đứng trước, đó là một tác vụ khác và phải được thiết kế
  lại, không phải vá bằng CSS.

- **Bên sử dụng không vá ruột con.** Thành phần nào sở hữu hình học thì thành phần đó viết điểm ngắt.

  ```tsx
  {/* SAI: người gọi áp breakpoint lên phần bên trong của một component khác */}
  <PageHeader className="sm:flex-col md:flex-row" />
  ```

---

## `RESPONSIVE-4` — lưới: bớt cột khi hẹp

### Trường hợp: lưới thẻ lặp lại

```tsx
<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {courses.map((course) => (
    <li className="flex flex-col gap-3 rounded-lg border p-4" key={course.id}>
      <h3 className="font-medium">{course.title}</h3>
      <p className="text-sm text-muted-foreground">{course.summary}</p>
    </li>
  ))}
</ul>
```

Ba ngưỡng, ba con số đã đo: dưới `sm` một thẻ đầy đủ đã chiếm hết bề rộng đọc được; tại `sm` hai thẻ
vẫn trên mức tối thiểu; tại `lg` ba thẻ vẫn vậy. Không có con số nào thì không có ngưỡng nào.

### Trường hợp: lưới ô số liệu, cần thẳng cột để so sánh

```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <div className="flex flex-col gap-1 rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">12</span>
    <span className="text-sm text-muted-foreground">khoá đang học</span>
  </div>
  <div className="flex flex-col gap-1 rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">86</span>
    <span className="text-sm text-muted-foreground">bài đã xong</span>
  </div>
  <div className="flex flex-col gap-1 rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">7</span>
    <span className="text-sm text-muted-foreground">ngày liên tiếp</span>
  </div>
  <div className="flex flex-col gap-1 rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">4,9</span>
    <span className="text-sm text-muted-foreground">điểm trung bình</span>
  </div>
</div>
```

Đây chính là chỗ `RESPONSIVE-2` sai: xuống dòng cũng xuống dòng được, nhưng các ô sẽ so le và mất khả năng
quét mắt theo cột.

### Trường hợp: chưa có bề rộng tối thiểu đo được

```tsx
<ul className="grid grid-cols-1 gap-4">
  {items.map((item) => <li className="rounded-lg border p-4" key={item.id}>{item.title}</li>)}
</ul>
```

Chưa đo thì một cột. Một cột là số cột duy nhất không thể sai; một ngưỡng bịa ra thì sai ở đúng những
bề rộng chưa ai thử.

### Trường hợp: tính đồng nhất trạng thái — khung chờ dùng đúng rãnh của nội dung thật

```tsx
<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {Array.from({ length: 6 }).map((_, index) => (
    <li className="flex flex-col gap-3 rounded-lg border p-4" key={index}>
      <span className="h-5 w-2/3 rounded bg-neutral-200" />
      <span className="h-4 w-full rounded bg-neutral-200" />
    </li>
  ))}
</ul>
```

Cùng chủ sở hữu, cùng số rãnh, cùng khoảng cách giữa các phần tử. Nếu khung chờ dùng hình học khác, bố cục sẽ nhảy đúng vào lúc dữ
liệu về — và người dùng đang bấm dở.

### Trường hợp: lưới thành viên có bề rộng tối thiểu nhỏ hơn

```tsx
<ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
  {members.map((member) => (
    <li className="flex flex-col items-center gap-2 text-center" key={member.id}>
      <span className="grid size-12 place-items-center rounded-full bg-neutral-100">{member.initials}</span>
      <span className="text-sm">{member.name}</span>
    </li>
  ))}
</ul>
```

Cơ sở ở đây là **hai** cột chứ không phải một, vì bề rộng tối thiểu của một ô nhỏ hơn nhiều so với một
thẻ khoá học. Cơ sở không mặc định bằng `1`; cơ sở bằng **số cột còn dùng được ở bề rộng hẹp nhất**.

### Ngoại lệ và nhầm lẫn

- **Trạng thái rỗng không được đổi chủ sở hữu.** Trạng thái rỗng hiển thị **bên trong** cùng vùng, không thay cả
  lưới bằng một bố cục khác.

  ```tsx
  <section className="flex flex-col gap-3">
    <h2 className="font-medium">Khoá học của tôi</h2>
    {courses.length === 0 ? (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Chưa có khoá nào</div>
    ) : (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">…</ul>
    )}
  </section>
  ```

- **Các phần tử không lặp lại thì không phải lưới.** Một tiêu đề và một cụm nút đặt vào `grid-cols-2` là
  ép hai thứ khác vai trò vào một khuôn ngang hàng — đó là `RESPONSIVE-3`.

- **Cấm ngưỡng theo tên thiết bị.**

  ```tsx
  {/* SAI: "máy tính bảng thì hai cột" — không ai đo gì cả */}
  <ul className="grid grid-cols-1 md:grid-cols-2">…</ul>
  ```

  Cũng chuỗi class CSS ấy sẽ **đúng** ngay khi có một câu đi kèm: *tại `md`, mỗi thẻ vẫn trên bề rộng tối
  thiểu đã đo*. Cái sai không nằm ở class CSS, nó nằm ở chỗ không có phép đo.

---

## `RESPONSIVE-5` — cuộn ngang có biên, khi nghĩa nằm ở sự sắp ngang

### Trường hợp: bảng dữ liệu nhiều cột

```tsx
<div className="max-w-full overflow-x-auto">
  <table className="min-w-max">
    <thead>
      <tr>
        <th className="px-4 py-2 text-left text-sm">Học viên</th>
        <th className="px-4 py-2 text-left text-sm">Khoá</th>
        <th className="px-4 py-2 text-right text-sm">Tiến độ</th>
        <th className="px-4 py-2 text-right text-sm">Hạn nộp</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-t">
        <td className="px-4 py-2">Mai Lê</td>
        <td className="px-4 py-2">Nền tảng hệ thống</td>
        <td className="px-4 py-2 text-right tabular-nums">68%</td>
        <td className="px-4 py-2 text-right tabular-nums">20/08</td>
      </tr>
    </tbody>
  </table>
</div>
```

Câu người dùng đọc được nhờ thẳng hàng là "ai đang chậm hơn ai". Cho các ô xuống dòng là xoá mất câu
đó. Vùng cuộn nằm ở chủ sở hữu nên **trang** không bao giờ cuộn ngang.

### Trường hợp: bảng so sánh gói

```tsx
<div className="max-w-full overflow-x-auto">
  <table className="min-w-max">
    <thead>
      <tr>
        <th className="px-4 py-2 text-left text-sm">Quyền lợi</th>
        <th className="px-4 py-2 text-sm">Cơ bản</th>
        <th className="px-4 py-2 text-sm">Tiêu chuẩn</th>
        <th className="px-4 py-2 text-sm">Nâng cao</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-t">
        <td className="px-4 py-2 text-sm">Chấm bài có phản hồi</td>
        <td className="px-4 py-2 text-center">—</td>
        <td className="px-4 py-2 text-center">✓</td>
        <td className="px-4 py-2 text-center">✓</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Trường hợp: trục thời gian có mốc và đường nối

```tsx
<div className="max-w-full overflow-x-auto">
  <ol className="flex min-w-max items-center gap-4">
    <li className="flex items-center gap-4">
      <span className="rounded-md border px-3 py-2 text-sm">Nộp bài</span>
      <span aria-hidden="true" className="h-px w-12 bg-neutral-300" />
    </li>
    <li className="flex items-center gap-4">
      <span className="rounded-md border px-3 py-2 text-sm">Chấm tự động</span>
      <span aria-hidden="true" className="h-px w-12 bg-neutral-300" />
    </li>
    <li>
      <span className="rounded-md border px-3 py-2 text-sm">Phản hồi của mentor</span>
    </li>
  </ol>
</div>
```

Đường nối chỉ có nghĩa khi hai mốc nằm cạnh nhau theo chiều ngang. Cho `flex-wrap` vào đây sẽ tạo ra
những đoạn kẻ dẫn tới hư không.

### Trường hợp: khối mã có dòng dài

```tsx
<div className="max-w-full overflow-x-auto rounded-lg border bg-neutral-50 p-4">
  <pre className="min-w-max text-sm">
    <code>{snippet}</code>
  </pre>
</div>
```

Thụt đầu dòng và vị trí ngắt dòng của mã **là** một phần nội dung. Cho nó tự xuống dòng là sửa nội dung
của người viết, không phải sắp xếp lại nó.

### Ngoại lệ và nhầm lẫn

- **Cấm bề rộng tối thiểu bịa ra.** Nội dung tự khai bề rộng của nó.

  ```tsx
  {/* SAI */}  <table className="min-w-[720px]">…</table>
  {/* ĐÚNG */} <table className="min-w-max">…</table>
  ```

- **Cấm để trang cuộn ngang.** Thiếu `max-w-full` ở chủ sở hữu thì vùng cuộn nở ra và đẩy cả trang.

  ```tsx
  {/* SAI */}  <div className="overflow-x-auto"><table className="min-w-max">…</table></div>
  {/* ĐÚNG */} <div className="max-w-full overflow-x-auto"><table className="min-w-max">…</table></div>
  ```

- **Không phải cái gì nằm ngang cũng là mã này.** Một hàng nút nằm ngang **không** mang nghĩa gì ở chỗ
  nằm ngang; nó là `RESPONSIVE-2` hoặc `RESPONSIVE-3`. Cuộn ngang bắt người dùng làm thêm việc, chỉ
  trả cái giá đó khi có một phép so sánh thật sự bị mất.

  ```tsx
  {/* SAI: bắt cuộn ngang cho thứ vốn wrap được */}
  <div className="overflow-x-auto"><div className="flex min-w-max gap-2">…các nút lọc…</div></div>
  ```

- **Cấm giấu bớt cột để khỏi phải cuộn.** Giấu nội dung đi qua điều kiện của `RESPONSIVE-6`, và cột số
  liệu thiết yếu thì không được giấu.

---

## `RESPONSIVE-6` — vùng thường trực đổi thành thành phần điều khiển tương đương

### Trường hợp: thanh dọc bộ lọc và nút mở bộ lọc

```tsx
<div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="hidden lg:block">
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Cấp độ</h3>
      <label className="flex items-center gap-2 text-sm">
        <input checked={levels.includes("basic")} onChange={toggleLevel} type="checkbox" value="basic" />
        Nền tảng
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input checked={levels.includes("advanced")} onChange={toggleLevel} type="checkbox" value="advanced" />
        Nâng cao
      </label>
    </div>
  </aside>
  <button
    aria-expanded={filtersOpen}
    className="rounded-md border px-3 py-2 text-sm lg:hidden"
    onClick={openFilters}
    type="button"
  >
    Bộ lọc · {levels.length}
  </button>
  <section className="min-w-0">…kết quả…</section>
</div>
```

Cả hai biểu diễn đọc **cùng một** `levels`. Đó là điều kiện khiến mã này hợp lệ: nếu mỗi bên giữ trạng thái
riêng, người dùng xoay máy một cái là thấy bộ lọc của mình biến mất.

### Trường hợp: điều hướng ngang và nút trình đơn

```tsx
<nav className="flex items-center justify-between gap-4">
  <a className="font-semibold" href="/">Trang chủ</a>
  <ul className="hidden items-center gap-4 md:flex">
    <li><a aria-current={path === "/courses" ? "page" : undefined} href="/courses">Khoá học</a></li>
    <li><a aria-current={path === "/paths" ? "page" : undefined} href="/paths">Lộ trình</a></li>
    <li><a aria-current={path === "/community" ? "page" : undefined} href="/community">Cộng đồng</a></li>
  </ul>
  <button aria-expanded={menuOpen} className="md:hidden" onClick={openMenu} type="button">Menu</button>
</nav>
```

Cùng ba đích đến, cùng một `path` quyết định mục đang chọn. Trình đơn hẹp không được thiếu một đích nào —
thiếu một đích là bỏ mất một tác vụ, không phải "gọn hơn".

### Trường hợp: tiêu điểm quay về đúng chỗ khi đóng

```tsx
<button
  aria-expanded={filtersOpen}
  className="rounded-md border px-3 py-2 text-sm lg:hidden"
  onClick={() => setFiltersOpen(true)}
  ref={triggerRef}
  type="button"
>
  Bộ lọc · {levels.length}
</button>
{filtersOpen ? (
  <div onClose={() => { setFiltersOpen(false); triggerRef.current?.focus(); }} role="dialog">
    …đúng các bộ lọc đó, đọc cùng state đó…
  </div>
) : null}
```

Không có đường tiêu điểm quay về, người dùng bàn phím đóng khung xong sẽ rơi về đầu tài liệu và phải đi
lại toàn bộ trang. Đường tiêu điểm là **một phần của điều kiện**, không phải phần đánh bóng.

### Trường hợp: mục lục cạnh bài đọc

```tsx
<div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_15rem]">
  <article className="min-w-0">…nội dung bài…</article>
  <nav aria-label="Nội dung bài" className="hidden xl:sticky xl:top-24 xl:block">
    <ol className="flex flex-col gap-2 text-sm">
      <li><a aria-current={active === "intro" ? "true" : undefined} href="#intro">Mở đầu</a></li>
      <li><a aria-current={active === "quorum" ? "true" : undefined} href="#quorum">Quorum</a></li>
    </ol>
  </nav>
  <button aria-expanded={tocOpen} className="rounded-md border px-3 py-2 text-sm xl:hidden" type="button">
    Nội dung bài
  </button>
</div>
```

Cùng một `active` quyết định mục đang đọc ở cả hai biểu diễn. Ngưỡng là `xl` vì mục lục chỉ đủ chỗ khi
bài đọc vẫn còn trên bề rộng đọc được — con số này đến từ bài đọc, không đến từ mục lục.

### Ngoại lệ và nhầm lẫn

- **Giấu mà không có đường thay thế không phải một mã — đó là một lỗi.**

  ```tsx
  {/* SAI: nội dung biến mất và không có gì thay thế */}
  <aside className="hidden md:block">…bộ lọc…</aside>
  ```

- **Cấm nhân đôi trạng thái.**

  ```tsx
  {/* SAI: hai biểu diễn giữ hai state khác nhau */}
  <aside className="hidden lg:block">{/* useState riêng bên trong */}</aside>
  <button className="lg:hidden" type="button">{/* useState riêng bên trong */}</button>
  ```

- **Nội dung thiết yếu không bao giờ được giấu.** Giá tiền, cảnh báo mất dữ liệu, điều khoản bắt buộc
  đọc — không có `hidden` nào hợp lệ cho những thứ này, kể cả khi có đường thay thế, vì đường thay thế
  đòi một cú bấm mà quyết định thì cần thấy ngay.

---

## Mã lồng trong mã

Luật *một chủ sở hữu, một quan hệ hình học* chỉ nhìn thấy được khi các mã lồng vào nhau. Một cây hiển thị
bình thường mang nhiều mã cùng lúc, và mỗi mã chỉ nói về **các con trực tiếp của chủ sở hữu nó**.

### Trường hợp: `RESPONSIVE-3` bọc `RESPONSIVE-2`

```tsx
<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex min-w-0 flex-col gap-1">
    <h2 className="truncate text-lg font-semibold">Nền tảng hệ thống</h2>
    <p className="text-sm text-muted-foreground">12 bài · 8 tuần</p>
  </div>
  <div className="flex flex-wrap items-center gap-2">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Lưu</button>
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Chia sẻ</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Ghi danh</button>
  </div>
</header>
```

Chủ sở hữu ngoài là `RESPONSIVE-3`: hai vế đổi trục. Chủ sở hữu trong là `RESPONSIVE-2`: ba nút là phần tử ngang hàng đồng
hạng tự tìm chỗ. Cụm chữ bên trái là `RESPONSIVE-1` — nó không hỏng ở bề rộng nào, `min-w-0` không
phải một phép biến đổi thiết kế đáp ứng mà là cách phần tử con flex vốn phải được khai báo.

### Trường hợp: `RESPONSIVE-4` bọc `RESPONSIVE-5`

```tsx
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <section className="flex flex-col gap-3 rounded-lg border p-4">
    <h3 className="font-medium">Tiến độ theo tuần</h3>
    <div className="max-w-full overflow-x-auto">
      <table className="min-w-max">…</table>
    </div>
  </section>
  <section className="flex flex-col gap-3 rounded-lg border p-4">
    <h3 className="font-medium">Điểm bài kiểm tra</h3>
    <div className="max-w-full overflow-x-auto">
      <table className="min-w-max">…</table>
    </div>
  </section>
</div>
```

Hai thẻ là phần tử lặp lại ngang hàng ⇒ `RESPONSIVE-4`. Bên trong mỗi thẻ, bảng không dàn lại được ⇒
`RESPONSIVE-5`. `max-w-full` ở chủ sở hữu của bảng là thứ giữ cho vùng cuộn không nở ra làm hỏng lưới cha
— không có nó, một cột lưới sẽ bị đẩy rộng theo bảng và cả trang cuộn ngang.

### Trường hợp: `RESPONSIVE-4` bọc `RESPONSIVE-3` bọc `RESPONSIVE-2`

```tsx
<ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
  {plans.map((plan) => (
    <li className="flex flex-col gap-4 rounded-lg border p-4" key={plan.id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="font-medium">{plan.name}</h3>
        <span className="text-xl font-semibold tabular-nums">{plan.price}</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {plan.perks.map((perk) => (
          <li className="rounded-full border px-3 py-1 text-xs" key={perk}>{perk}</li>
        ))}
      </ul>
    </li>
  ))}
</ul>
```

Ba chủ sở hữu, ba mã, không mã nào biết gì về mã kia. Đây là lý do luật nói **một chủ sở hữu, một quan hệ hình
học**: nếu cố diễn đạt cả ba bằng một vùng chứa phẳng, bạn sẽ phải chọn một điểm ngắt chung cho ba
lỗi xảy ra ở ba bề rộng khác nhau, và mọi lựa chọn đều sai với hai trong ba.

### Trường hợp: `RESPONSIVE-6` bọc `RESPONSIVE-4` bọc `RESPONSIVE-3`

```tsx
<div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="hidden lg:block">…bộ lọc, đọc cùng state…</aside>
  <button aria-expanded={filtersOpen} className="rounded-md border px-3 py-2 text-sm lg:hidden" type="button">
    Bộ lọc · {levels.length}
  </button>

  <section className="flex min-w-0 flex-col gap-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{total} khoá phù hợp</p>
      <select aria-label="Sắp xếp" className="rounded-md border px-3 py-2 text-sm">
        <option>Mới nhất</option>
        <option>Phù hợp nhất</option>
      </select>
    </div>
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {results.map((result) => (
        <li className="flex flex-col gap-3 rounded-lg border p-4" key={result.id}>
          <h3 className="font-medium">{result.title}</h3>
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </li>
      ))}
    </ul>
  </section>
</div>
```

Ba mã, ba chủ sở hữu khác nhau, không mã nào với tay vào phạm vi của mã khác. Chú ý `xl:grid-cols-3` chứ
không phải `lg:grid-cols-3`: bên trong cột kết quả, bề rộng khả dụng đã bị thanh dọc chiếm mất một phần,
nên ngưỡng ba cột đến muộn hơn. **Ngưỡng thuộc về vùng chứa, không thuộc về khung nhìn** — đây là chỗ
sai nhiều nhất khi lồng `RESPONSIVE-6` với `RESPONSIVE-4`.

---

## Ánh xạ yêu cầu sang một chuỗi class CSS

Nêu chủ sở hữu, các con trực tiếp và **lỗi quan sát được**. Nếu thiếu một dữ kiện quyết định, trả về
**mặc định an toàn** — không phải một câu hỏi. Chỉ có đúng một trường hợp được hỏi, ở dòng cuối bảng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Ba hành động ngắn nằm một hàng, xuống dòng khi nhãn dài ra | Thứ tự và quan hệ giữ nguyên, chỉ ngắt dòng đổi | `RESPONSIVE-2` | `flex flex-wrap gap-2` |
| Số lượng thẻ không biết trước, phải đọc hết, không cuộn ngang trang | Phần tử ngang hàng nội tuyến độc lập được phép xuống dòng | `RESPONSIVE-2` | `flex flex-wrap gap-2` |
| Siêu dữ liệu và tiện ích được dùng nhiều dòng, giữ nguyên thứ tự DOM | Xuống dòng sửa va chạm mà không tạo mô hình tác vụ mới | `RESPONSIVE-2` | `flex flex-wrap items-center gap-3` |
| Ô nhập và nút gửi xếp dọc khi ô tụt dưới mức nhập được, cùng hàng khi đủ chỗ | Cùng vế, cùng thứ tự, chỉ đổi trục | `RESPONSIVE-3` | `flex flex-col gap-2 sm:flex-row` sau khi đo ngưỡng `sm` |
| Tiêu đề/mô tả và nhóm tiện ích xếp dọc khi hẹp, thẳng hàng khi cả hai đủ chỗ | Chủ sở hữu đổi trục, không đổi nghĩa | `RESPONSIVE-3` | `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between` |
| Hai nhóm chi tiết ngang hàng, mặc định đọc dọc, cạnh nhau khi vùng chứa rộng | Thứ tự nguồn đúng ở cả hai hình học | `RESPONSIVE-3` | `flex flex-col gap-4 sm:flex-row` |
| Thẻ ngang hàng cần ít nhất một cột đọc được, có thể lên hai rồi ba rãnh bằng nhau | Phần tử lặp lại thuộc về lưới thiết kế đáp ứng | `RESPONSIVE-4` | `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` |
| Bốn số liệu so sánh được: một cột khi hẹp, hai cột khi mỗi ô còn đọc được | Số rãnh bám theo bề rộng tối thiểu đã đo | `RESPONSIVE-4` | `grid grid-cols-1 gap-3 sm:grid-cols-2` |
| Ô nội dung đa phương tiện ngang hàng, không nhỏ hơn bề rộng ảnh thu nhỏ đã đo, tối đa ba cột | Ngưỡng lưới suy ra từ bề rộng tối thiểu của phần tử | `RESPONSIVE-4` | `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` |
| Quan hệ giữa các cột phải giữ ngang; hẹp thì cuộn vùng bảng, không cuộn trang | Dàn lại sẽ phá nghĩa hàng/cột | `RESPONSIVE-5` | chủ sở hữu `max-w-full overflow-x-auto`; bảng `min-w-max` |
| Sơ đồ có nút DOM và đường nối phải giữ topology ngang, hẹp thì cuộn trong biên | Topology không cụm xếp dọc được mà không đổi nghĩa | `RESPONSIVE-5` | chủ sở hữu `max-w-full overflow-x-auto`; sơ đồ `min-w-max` |
| Thanh dọc bộ lọc rộng thành một nút mở đúng bộ lọc đó, chung trạng thái và trả tiêu điểm | Đường thay thế tường minh và tương đương | `RESPONSIVE-6` | thanh dọc `hidden md:block`; điều kiện `md:hidden` tại ngưỡng đã đo |
| Điều hướng mở rộng thành một nút trình đơn, cùng đích đến và cùng mục đang chọn | Hai biểu diễn phơi cùng tác vụ và cùng trạng thái | `RESPONSIVE-6` | các liên kết `hidden md:flex`; điều kiện `md:hidden` |
| "Làm cho khung này thân thiện thiết bị di động" | Không nêu được nội dung nào hỏng | `RESPONSIVE-1` | giữ bố cục gốc, không thêm class CSS nào |
| "Máy tính bảng thì cho hai cột" | Tên thiết bị không cho biết bề rộng tối thiểu của phần tử | `RESPONSIVE-1` | giữ một cột, không thêm điểm ngắt |
| "Màn nhỏ thì ẩn phần phụ đi" | Chưa biết nó có thiết yếu không và có đường tới không | `RESPONSIVE-1` | giữ nội dung hiện ra, không thêm class CSS khả năng hiển thị |
| "Màn hẹp thì cho nút lên trước" | Chưa rõ tác vụ/thứ tự thật sự đổi hay chỉ vị trí đổi | `RESPONSIVE-1` | giữ thứ tự DOM, không thêm `order-*` |
| Yêu cầu áp một phép biến đổi đắt hơn nhưng không nêu lỗi | Ngoại lệ được đòi không suy ra được từ hành vi quan sát được | — | hỏi: *"Nội dung lỗi quan sát được nào bắt buộc phép biến đổi này?"* |

Câu hỏi ở dòng cuối là **câu hỏi duy nhất** mô-đun này được phép hỏi. Trả lời phải là một chuỗi class CSS
hoặc một câu hỏi — không bao giờ cả hai.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu; còn lại lấy mặc định an toàn.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `RESPONSIVE-1` / mọi mã khác | Ở bề rộng hẹp nhất được hỗ trợ, **cái gì** đang hỏng? |
| `RESPONSIVE-2` / `RESPONSIVE-3` | Đây là nhiều phần tử ngang hàng đồng hạng tự tìm chỗ, hay một quan hệ hai vế cùng đổi trục một lần? |
| `RESPONSIVE-2` / `RESPONSIVE-4` | Người đọc có cần **so sánh theo cột** giữa các phần tử không? |
| `RESPONSIVE-3` / `RESPONSIVE-4` | Các phần tử là **những vế khác vai trò**, hay **những phần tử giống nhau lặp lại**? |
| `RESPONSIVE-4` / `RESPONSIVE-5` | Vị trí ngang của phần tử có **là** thông tin không (thứ tự, phép so sánh)? |
| `RESPONSIVE-3` / `RESPONSIVE-6` | Xếp dọc có thật sự không dùng được, hay chỉ là trông rườm rà? |
| `RESPONSIVE-5` / `RESPONSIVE-6` | Có định giấu bớt phần nội dung không? Nếu có, đường thay thế là gì? |
| bất kỳ mã nào / không có mã | Lỗi đã được **quan sát**, hay mới chỉ được **dự đoán**? |

## Sai lầm lặp lại nhiều nhất

1. Chọn điểm ngắt bằng tên thiết bị thay vì bằng bề rộng đã đo được là nội dung hỏng.
2. Thêm điểm ngắt khi không có gì hỏng, chỉ vì được yêu cầu "làm thiết kế đáp ứng".
3. Đổi `gap` hoặc `padding` cùng lúc với đổi trục, làm quan hệ thay đổi theo bề rộng màn hình.
4. Dùng `order-*` theo điểm ngắt, tạo ra một thứ tự thị giác mà bàn phím không có.
5. Giấu nội dung mà không có thành phần điều khiển thay thế, rồi gọi đó là thiết kế thiết bị di động.
6. Hai biểu diễn của `RESPONSIVE-6` giữ hai trạng thái riêng.
7. Thu nhỏ chữ hoặc vùng tương tác để né xuống dòng.
8. Cho bảng `min-w-[con-số-cứng]` thay vì `min-w-max`, rồi sai ngay khi đổi ngôn ngữ.
9. Quên `max-w-full` ở chủ sở hữu của vùng cuộn, để cả trang cuộn ngang.
10. Khung chờ dùng rãnh khác nội dung thật, làm bố cục nhảy đúng lúc dữ liệu về.
11. Bên sử dụng áp điểm ngắt lên ruột của một thành phần khác.
12. Đo ngưỡng lưới theo khung nhìn trong khi lưới nằm trong một cột hẹp hơn khung nhìn.
