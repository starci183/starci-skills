---
id: fe-principles-divider-example
title: example.md
slug: /gates/principles/divider/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã DIVIDER-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `divider` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định duy nhất.

---

## `DIVIDER-0` — khoảng trống đã nói ranh giới

### Trường hợp: lưới thẻ khoá học

```tsx
<div className="grid gap-4 sm:grid-cols-3">
  <article className="rounded-lg border border-border p-4">
    <h3 className="font-medium">Nền tảng hệ thống</h3>
    <p className="mt-1 text-sm text-neutral-500">6 bài · 2 giờ</p>
  </article>
  <article className="rounded-lg border border-border p-4">
    <h3 className="font-medium">Khả năng mở rộng</h3>
    <p className="mt-1 text-sm text-neutral-500">10 bài · 4 giờ</p>
  </article>
  <article className="rounded-lg border border-border p-4">
    <h3 className="font-medium">Độ tin cậy</h3>
    <p className="mt-1 text-sm text-neutral-500">8 bài · 3 giờ</p>
  </article>
</div>
```

Mỗi thẻ đã có đường bao riêng, và giữa các thẻ đã có `gap-4`. Ranh giới được nói **hai lần rồi**;
thêm một `divide-x` nữa là lần thứ ba.

### Trường hợp: tiêu đề và nội dung cách nhau một khoảng

```tsx
<section className="flex flex-col gap-3">
  <h2 className="font-medium">Bài nộp gần đây</h2>
  <div className="rounded-lg border border-border p-4">…</div>
</section>
```

Quyền sở hữu của tiêu đề đã được nói bằng khoảng cách. `border-b` dưới tiêu đề ở đây là câu thứ hai
về cùng một chuyện.

### Trường hợp: hai vùng bố cục có khoảng trống ở giữa

```tsx
<div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="flex flex-col gap-4">…bộ lọc…</aside>
  <section className="min-w-0">…kết quả…</section>
</div>
```

Không có khoảng cách giữa các phần tử nào để kẻ: giữa hai vùng là khoảng trống, và đường kẻ không bắc qua khoảng trống được.

### Trường hợp: nhóm nút của một biểu mẫu

```tsx
<div className="flex items-center justify-end gap-2">
  <button className="rounded-md border border-border px-3 py-2 text-sm" type="button">Huỷ</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Lưu</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Vừa `gap` vừa `divide-*` là nói một ranh giới hai lần.** Đây là lỗi phổ biến nhất của cả mô-đun:

  ```tsx
  {/* SAI */}  <ul className="flex flex-col gap-3 divide-y divide-border">…</ul>
  {/* ĐÚNG */} <ul className="flex flex-col gap-3">…</ul>
  {/* HOẶC */} <ul className="divide-y divide-border">…</ul>
  ```

  Hai dòng đúng là **hai câu trả lời khác nhau cho hai tình huống khác nhau**, không phải hai cách
  viết của một thứ. Chọn một, và chọn nó vì các mục có dính nhau hay không.

- **Đừng ghi lại quyết định bằng một viền vô hình.** Không có gì để viết ra cả:

  ```tsx
  {/* SAI */}  <div className="border-0 border-transparent">…</div>
  {/* ĐÚNG */} <div>…</div>
  ```

- **Thẻ đã có nền riêng thì không cần thêm đường kẻ giữa các phần bên trong nó:**

  ```tsx
  {/* SAI */}
  <div className="rounded-lg border border-border p-4">
    <div className="border-b border-border pb-3">Tổng quan</div>
    <div className="pt-3">…</div>
  </div>
  ```

  Nếu hai phần đã cách nhau một khoảng thì bỏ đường kẻ. Nếu chúng **phải** dính nhau, đó là
  `DIVIDER-2` và cách viết ở dưới khác hẳn cách viết sai này.

---

## `DIVIDER-1` — một tập thành viên cùng loại

### Trường hợp: danh sách cài đặt

```tsx
<ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
  <li className="flex items-center justify-between p-4">
    <span>Thông báo qua email</span>
    <input type="checkbox" />
  </li>
  <li className="flex items-center justify-between p-4">
    <span>Thông báo đẩy</span>
    <input type="checkbox" />
  </li>
  <li className="flex items-center justify-between p-4">
    <span>Bản tin hằng tuần</span>
    <input type="checkbox" />
  </li>
</ul>
```

`overflow-hidden` không phải trang trí: nó là thứ khiến đường kẻ **dừng lại ở góc bo** thay vì chạy
quá ra ngoài.

### Trường hợp: lịch sử giao dịch sinh từ dữ liệu

```tsx
<ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
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

### Trường hợp: tập chạy ngang — trục đổi, mã không đổi

```tsx
<div className="flex divide-x divide-border overflow-hidden rounded-lg border border-border">
  <div className="flex-1 p-4">
    <div className="text-2xl font-semibold tabular-nums">12</div>
    <div className="text-sm text-neutral-500">khoá đang học</div>
  </div>
  <div className="flex-1 p-4">
    <div className="text-2xl font-semibold tabular-nums">86</div>
    <div className="text-sm text-neutral-500">bài đã xong</div>
  </div>
  <div className="flex-1 p-4">
    <div className="text-2xl font-semibold tabular-nums">7</div>
    <div className="text-sm text-neutral-500">ngày liên tiếp</div>
  </div>
</div>
```

Ba ô là **ba phiên bản của cùng một loại** — cùng cách đọc, cùng vai trò. Trục ngang là hệ quả của
việc tập chạy ngang, không phải một quyết định riêng.

### Trường hợp: các mục chương trong một khoá học, có mục bấm được

```tsx
<ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
  {lessons.map((lesson) => (
    <li key={lesson.id}>
      <a className="flex items-center justify-between p-4 hover:bg-neutral-50" href={lesson.href}>
        <span className="min-w-0 truncate">{lesson.title}</span>
        <span className="text-sm tabular-nums text-neutral-500">{lesson.minutes} phút</span>
      </a>
    </li>
  ))}
</ul>
```

Vùng bấm được chiếm hết hàng, và đường kẻ vẫn là việc của phần tử cha. Nếu đưa `border-b` vào thẻ `a`, mỗi
lần rê chuột sẽ có một dải nền dừng lại **trên** đường kẻ thay vì chạm tới nó.

### Trường hợp: tập chỉ có một thành viên — vẫn giữ class CSS

```tsx
<ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
  <li className="p-4">Chưa có giao dịch nào khác trong tháng này</li>
</ul>
```

Không có đường kẻ nào được vẽ, và đó là hành vi đúng: class CSS nói về **quan hệ giữa các thành viên**,
không nói về số lượng. Gỡ class CSS ra khi danh sách ngắn là để lại một quả bom chờ dữ liệu thứ hai.

### Ngoại lệ và nhầm lẫn

- **`border-b` trên từng thành viên vẽ thừa một đường dưới đáy:**

  ```tsx
  {/* SAI */}
  <ul className="overflow-hidden rounded-lg border border-border">
    <li className="border-b border-border p-4">Thông báo qua email</li>
    <li className="border-b border-border p-4">Thông báo đẩy</li>
    <li className="border-b border-border p-4">Bản tin hằng tuần</li>
  </ul>
  ```

  Mục cuối mọc một ranh giới **ngoài** mà không ai yêu cầu, và nó nằm chồng lên chính viền của mặt
  chứa. Cách chữa bằng `last:border-b-0` chỉ là vá: quyền sở hữu vẫn đặt sai chỗ, và mọi thành viên
  vẫn phải tự biết mình đứng thứ mấy.

- **Phần đầu của danh sách không phải thành viên của danh sách:**

  ```tsx
  {/* SAI */}
  <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
    <div className="bg-neutral-50 p-3 text-sm font-medium">Giao dịch</div>
    <div className="p-4">Gói tháng · 499.000đ</div>
    <div className="p-4">Gói tháng · 499.000đ</div>
  </div>
  ```

  Ở đây `divide-y` đang vẽ **cả** cạnh dưới phần đầu lẫn các đường giữa các hàng, bằng một chủ sở hữu
  duy nhất — nghĩa là phần đầu đang bị tính như một hàng. Xem trường hợp lồng mã ở `DIVIDER-2`.

- **Danh sách thẻ rời nhau không phải `DIVIDER-1`.** Đó là `DIVIDER-0`.

- **Thiếu `overflow-hidden` trên bề mặt chứa bo góc thì đường kẻ chạy quá góc:**

  ```tsx
  {/* SAI */}  <ul className="divide-y divide-border rounded-lg border border-border">…</ul>
  {/* ĐÚNG */} <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">…</ul>
  ```

---

## `DIVIDER-2` — một dải tự đóng cạnh của nó

### Trường hợp: phần đầu của hộp thoại

```tsx
<div className="rounded-lg border border-border bg-white">
  <header className="border-b border-border p-4">
    <h2 className="font-medium">Mời thành viên</h2>
  </header>
  <div className="p-4">…biểu mẫu…</div>
</div>
```

Nội dung chạy **sát** vào phần đầu vì cả hai nằm trên một mặt liền, nên khoảng trống không còn để nói
ranh giới. `border-b` thuộc về phần đầu: nội dung không cần biết mình đứng sau ai.

### Trường hợp: phần cuối hành động của một biểu mẫu dài

```tsx
<div className="rounded-lg border border-border bg-white">
  <div className="p-4">…nhiều field…</div>
  <footer className="flex items-center justify-end gap-2 border-t border-border p-4">
    <button className="rounded-md border border-border px-3 py-2 text-sm" type="button">Huỷ</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Lưu</button>
  </footer>
</div>
```

Dải nằm **sau** nội dung nên nó đóng cạnh **trên** của chính nó. Trục và cạnh đổi theo vị trí; mã
không đổi.

### Trường hợp: thanh công cụ ghim trên vùng kết quả

```tsx
<div className="overflow-y-auto rounded-lg border border-border bg-white">
  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-white p-3">
    <input aria-label="Tìm kiếm" className="min-w-0 flex-1 rounded-md border border-border px-3 py-2" />
    <button className="rounded-md border border-border px-3 py-2 text-sm" type="button">Lọc</button>
  </div>
  <ul className="divide-y divide-border">
    <li className="p-4">Đọc và ghi theo cơ chế quorum</li>
    <li className="p-4">Rate limiter</li>
  </ul>
</div>
```

Đường kẻ có mặt **ngay từ đầu**, không đợi cuộn. Nền đục cũng là bắt buộc: một dải ghim trong suốt
thì đường kẻ của nó sẽ nằm trên nội dung đang trượt qua bên dưới.

### Trường hợp: phần đầu của danh sách — hai mã lồng nhau

```tsx
<div className="overflow-hidden rounded-lg border border-border">
  <div className="flex items-center justify-between border-b border-border bg-neutral-50 p-3 text-sm font-medium">
    <span>Giao dịch</span>
    <span>Số tiền</span>
  </div>
  <ul className="divide-y divide-border">
    <li className="flex items-center justify-between p-4"><span>Gói tháng · 08/2026</span><span className="tabular-nums">499.000đ</span></li>
    <li className="flex items-center justify-between p-4"><span>Gói tháng · 07/2026</span><span className="tabular-nums">499.000đ</span></li>
    <li className="flex items-center justify-between p-4"><span>Gói tháng · 06/2026</span><span className="tabular-nums">499.000đ</span></li>
  </ul>
</div>
```

Đây là ví dụ chuẩn của luật *một đường kẻ, một chủ sở hữu*. Phần đầu sở hữu cạnh dưới của nó
(`DIVIDER-2`). Danh sách sở hữu các đường giữa các thành viên của nó (`DIVIDER-1`). Viền bao ngoài
là chuyện của mặt chứa (`DIVIDER-4`, không thuộc mô-đun này). Ba ranh giới, ba chủ, không cái nào
nói hộ cái nào — và không cái nào bị nói hai lần.

### Ngoại lệ và nhầm lẫn

- **Đường kẻ hiện ra khi cuộn là ranh giới do vị trí quyết định:**

  ```tsx
  {/* SAI */}  <div className={`sticky top-0 ${scrolled ? "border-b border-border" : ""}`}>…</div>
  {/* ĐÚNG */} <div className="sticky top-0 border-b border-border bg-white">…</div>
  ```

  Dải ở **trên** nội dung kể cả khi chưa ai cuộn. Sự thật đó không phụ thuộc vào `scrollTop`.

- **Dải cách nội dung một khoảng thì không đóng cạnh:**

  ```tsx
  {/* SAI */}
  <section className="flex flex-col gap-3">
    <h2 className="border-b border-border pb-2 font-medium">Bài nộp gần đây</h2>
    <div className="rounded-lg border border-border p-4">…</div>
  </section>
  ```

  Đã có `gap-3` chạy qua khoảng cách giữa các phần tử này. Đây là `DIVIDER-0`.

- **Cả dải lẫn nội dung cùng khai một cạnh thì ra hai đường:**

  ```tsx
  {/* SAI */}
  <header className="border-b border-border p-4">…</header>
  <div className="border-t border-border p-4">…</div>
  ```

---

## `DIVIDER-3` — hai vùng ngang hàng chung một khoảng cách giữa các phần tử

### Trường hợp: danh sách hội thoại và khung trò chuyện

```tsx
<div className="flex h-full overflow-hidden rounded-lg border border-border">
  <aside className="w-72 shrink-0 overflow-y-auto">
    <ul className="divide-y divide-border">
      <li className="p-3">Nhóm hỗ trợ học viên</li>
      <li className="p-3">Phản hồi bài nộp</li>
    </ul>
  </aside>
  <section className="min-w-0 flex-1 border-l border-border">…khung hội thoại…</section>
</div>
```

Hai vùng **khác loại**, không bên nào sở hữu bên kia, và chúng dính nhau vì cùng nằm trên một mặt
liền. Khoảng cách giữa các phần tử được khai báo **một lần**, bởi vế sau. Bên trong vế trước lại là một `DIVIDER-1` riêng.

### Trường hợp: vùng soạn thảo và vùng xem trước

```tsx
<div className="grid overflow-hidden rounded-lg border border-border md:grid-cols-2">
  <div className="min-w-0 p-4">
    <textarea className="min-h-64 w-full resize-none outline-none" />
  </div>
  <div className="min-w-0 border-t border-border p-4 md:border-l md:border-t-0">…xem trước…</div>
</div>
```

Trên màn hình hẹp hai vùng xếp chồng nên khoảng cách giữa các phần tử nằm ở cạnh **trên**; rộng ra thì khoảng cách giữa các phần tử chuyển sang cạnh
**trái**. Chủ sở hữu vẫn là vế sau, mã vẫn là `DIVIDER-3`.

### Trường hợp: điểm ngắt đưa khoảng trống vào thay cho đường kẻ

```tsx
<div className="flex flex-col gap-6 md:flex-row md:gap-0">
  <section className="min-w-0 md:flex-1 md:pr-6">…tóm tắt đơn hàng…</section>
  <section className="min-w-0 md:flex-1 md:border-l md:border-border md:pl-6">…phương thức thanh toán…</section>
</div>
```

Dưới `md` là `DIVIDER-0` — `gap-6` đã nói ranh giới. Từ `md` trở lên là `DIVIDER-3` — khoảng trống bị
thu về `0` để hai cột bám sát nhau, nên đường kẻ tiếp quản. Ở **cả hai** phía điểm ngắt, ranh giới
được nói đúng một lần.

### Trường hợp: cụm tổng và cụm chi tiết trong cùng một thẻ

```tsx
<div className="flex overflow-hidden rounded-lg border border-border">
  <div className="p-4">
    <div className="text-2xl font-semibold tabular-nums">4,9</div>
    <div className="text-sm text-neutral-500">điểm trung bình</div>
  </div>
  <div className="min-w-0 flex-1 border-l border-border p-4">
    <ul className="flex flex-col gap-1 text-sm">
      <li>5 sao · 96</li>
      <li>4 sao · 24</li>
      <li>3 sao · 8</li>
    </ul>
  </div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Cả hai vế cùng khai cạnh của mình thì đường dày gấp đôi:**

  ```tsx
  {/* SAI */}
  <aside className="w-72 border-r border-border">…</aside>
  <section className="flex-1 border-l border-border">…</section>
  ```

- **Hai vùng có `gap` thì không có gì để kẻ:**

  ```tsx
  {/* SAI */}
  <div className="grid gap-8 lg:grid-cols-2">
    <section>…</section>
    <section className="border-l border-border">…</section>
  </div>
  ```

  Đường kẻ ở đây không nằm giữa hai vùng; nó nằm lơ lửng cách vế trước đúng `2rem`. Đây là
  `DIVIDER-0`.

- **`divide-x` cho hai vùng khác loại là mượn cơ chế của tập.** `divide-*` phát biểu "các con của tôi
  là những thành viên cùng loại". Hai vùng khác loại không phải thế, và cách viết đó sẽ tự sinh thêm
  đường kẻ ngay khi có người thêm một `div` thứ ba vào cùng phần tử cha.

---

## `DIVIDER-4` — đường kẻ bao quanh, mô-đun này không trả lời

### Trường hợp: một mặt phẳng chứa danh sách

```tsx
<ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
  <li className="p-4">Nền tảng hệ thống</li>
  <li className="p-4">Khả năng mở rộng</li>
</ul>
```

Có hai ranh giới khác nhau trong đúng một dòng class CSS. `divide-y divide-border` **ngăn cách** các
thành viên — đó là `DIVIDER-1`, mô-đun này quyết. `border border-border` **bao quanh** cả tập — đó là
`DIVIDER-4`, một tuyên bố về tư cách thành viên, và luật quan hệ nhóm mới là nơi cân nó với hai lựa
chọn còn lại: nâng thành một mặt riêng, hoặc để phẳng.

### Trường hợp: ô nhập liệu

```tsx
<input className="w-full rounded-md border border-border px-3 py-2" id="email" type="email" />
```

Đường bao ở đây không ngăn cách ô nhập với thứ gì cả; nó nói "vùng bấm vào được kết thúc ở đây".

### Trường hợp: hộp cảnh báo trong một mặt đã có sẵn

```tsx
<div className="rounded-lg border border-border bg-white p-4">
  <p className="text-sm">Hạn nộp bài đã được dời sang thứ Sáu.</p>
  <div className="mt-3 rounded-md border border-border p-3">
    <p className="text-sm">Bài nộp sau hạn vẫn được chấm nhưng không tính vào điểm chuyên cần.</p>
  </div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Đừng dùng bốn cạnh để nói một khoảng cách giữa các phần tử:**

  ```tsx
  {/* SAI */}
  <div>
    <header className="rounded-md border border-border p-3">Giao dịch</header>
    <ul className="divide-y divide-border">…</ul>
  </div>
  ```

  Cái cần nói là "phần đầu kết thúc ở đây", tức **một** cạnh. Bốn cạnh nói một chuyện khác hẳn: rằng
  phần đầu là một nhóm gọi được tên, tách khỏi danh sách bên dưới.

- **Bao thêm một vòng nữa quanh thứ đã có đường bao là nói hai lần:**

  ```tsx
  {/* SAI */}
  <div className="rounded-lg border border-border p-2">
    <div className="rounded-md border border-border p-4">…</div>
  </div>
  ```

---

## `DIVIDER-5` — ma trận ô, hai trục

### Trường hợp: bảng so sánh gói dịch vụ

```tsx
<div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
  <div className="flex divide-x divide-border bg-neutral-50 text-sm font-medium">
    <div className="flex-1 p-3">Tính năng</div>
    <div className="w-32 p-3">Cơ bản</div>
    <div className="w-32 p-3">Nâng cao</div>
  </div>
  <div className="flex divide-x divide-border">
    <div className="flex-1 p-3">Số khoá học truy cập</div>
    <div className="w-32 p-3 tabular-nums">3</div>
    <div className="w-32 p-3 tabular-nums">Không giới hạn</div>
  </div>
  <div className="flex divide-x divide-border">
    <div className="flex-1 p-3">Chấm bài tự động</div>
    <div className="w-32 p-3">Không</div>
    <div className="w-32 p-3">Có</div>
  </div>
</div>
```

Một ô có nghĩa nhờ **cả hàng lẫn cột**: "Nâng cao × chấm bài tự động". Cả hai trục đều phải được nói,
nên có hai chủ sở hữu — ma trận sở hữu các đường ngang, mỗi hàng sở hữu các đường dọc của nó.

### Trường hợp: lịch dạng lưới

```tsx
<div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
  {weeks.map((week) => (
    <div className="flex divide-x divide-border" key={week.id}>
      {week.days.map((day) => (
        <div className="min-w-0 flex-1 p-2" key={day.id}>
          <div className="text-xs tabular-nums text-neutral-500">{day.label}</div>
          <div className="mt-1 text-sm">{day.summary}</div>
        </div>
      ))}
    </div>
  ))}
</div>
```

### Trường hợp: ma trận quyền theo vai trò

```tsx
<div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
  <div className="flex divide-x divide-border bg-neutral-50 text-sm font-medium">
    <div className="flex-1 p-3">Hành động</div>
    <div className="w-28 p-3">Học viên</div>
    <div className="w-28 p-3">Trợ giảng</div>
    <div className="w-28 p-3">Quản trị</div>
  </div>
  {permissions.map((permission) => (
    <div className="flex divide-x divide-border" key={permission.id}>
      <div className="flex-1 p-3">{permission.label}</div>
      {permission.roles.map((allowed, index) => (
        <div className="w-28 p-3 text-sm" key={index}>{allowed ? "Có" : "—"}</div>
      ))}
    </div>
  ))}
</div>
```

### Ngoại lệ và nhầm lẫn

- **Ô đầu và ô cuối không mọc cạnh ngoài:**

  ```tsx
  {/* SAI */}
  <div className="flex">
    <div className="flex-1 border-l border-r border-border p-3">Tính năng</div>
    <div className="w-32 border-r border-border p-3">Cơ bản</div>
  </div>
  ```

  Khung ngoài là ranh giới của **mặt chứa** ma trận, không phải tổng của các cạnh ô.

- **Một hàng nhiều cột nhưng cột không so sánh được với nhau thì vẫn là `DIVIDER-1`:**

  ```tsx
  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
    <li className="flex items-center justify-between p-4">
      <span>Gói tháng · 08/2026</span>
      <span className="tabular-nums">499.000đ</span>
    </li>
  </ul>
  ```

  Tên và số tiền không phải hai thứ đem ra so sánh với nhau; chúng chỉ là bố cục bên trong hàng. Kẻ
  một `divide-x` vào đây là bịa ra một trục thứ hai không tồn tại.

- **Lưới thẻ có `gap` không phải ma trận.** Đó là `DIVIDER-0`.

---

## `DIVIDER-6` — đường kẻ tự nó là một phần tử

### Trường hợp: ngắt chủ đề trong bài viết dài

```tsx
<article className="flex flex-col gap-4">
  <p>Quorum không phải là chuyện đếm node, mà là chuyện đếm failure domain.</p>
  <hr className="border-t border-border" />
  <p>Phần dưới đây chuyển sang một câu hỏi khác: khi nào thì đọc cũ là chấp nhận được.</p>
</article>
```

Hai bên là những đoạn tuỳ ý trong một dòng chảy; không đoạn nào có tư cách sở hữu cái khoảng cách giữa các phần tử. Và ngắt
chủ đề là một sự kiện **có nghĩa**, nên nó được viết bằng phần tử mang đúng nghĩa đó chứ không phải
bằng một `div` cao một điểm ảnh.

### Trường hợp: đường kẻ mang nhãn "hoặc"

```tsx
<div className="flex flex-col gap-4">
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Đăng nhập</button>
  <div aria-hidden="true" className="flex items-center gap-3">
    <span className="h-px flex-1 bg-neutral-200" />
    <span className="text-xs text-neutral-500">hoặc</span>
    <span className="h-px flex-1 bg-neutral-200" />
  </div>
  <button className="rounded-md border border-border px-3 py-2 text-sm" type="button">Tiếp tục bằng tài khoản công việc</button>
</div>
```

Đường kẻ ở đây **không thể** là cạnh của ai, vì nó phải bị cắt làm đôi để chừa chỗ cho chữ. Đó chính
là dấu hiệu chắc chắn nhất của mã này.

### Trường hợp: mốc ngày trong luồng tin nhắn

```tsx
<div className="flex flex-col gap-3">
  <div className="flex items-center gap-3">
    <span className="h-px flex-1 bg-neutral-200" />
    <span className="text-xs text-neutral-500">Hôm nay</span>
    <span className="h-px flex-1 bg-neutral-200" />
  </div>
  <p className="max-w-prose rounded-lg bg-neutral-100 p-3 text-sm">Bài nộp của bạn đã được chấm.</p>
  <p className="max-w-prose self-end rounded-lg bg-neutral-900 p-3 text-sm text-white">Cảm ơn thầy.</p>
</div>
```

Mốc ngày **không** phải một tin nhắn, nên nó không phải một thành viên của tập — nó là một phần tử
ngắt nằm giữa các thành viên.

### Ngoại lệ và nhầm lẫn

- **Ngắt chủ đề không được viết bằng một hộp rỗng:**

  ```tsx
  {/* SAI */}  <div className="h-px w-full bg-neutral-200" />
  {/* ĐÚNG */} <hr className="border-t border-border" />
  ```

  Ngoại lệ nằm trong chính mã này: khi đường kẻ **mang nhãn**, nó buộc phải bị cắt làm hai đoạn, và
  hai đoạn đó là hình ảnh trang trí của một phần tử đã có chữ nói hộ nghĩa. Lúc đó `aria-hidden` là
  bắt buộc, vì hai vạch đó không được đọc thành hai ngắt riêng biệt.

- **Một mốc chia trong danh sách không phải một `DIVIDER-1`:**

  ```tsx
  {/* SAI */}
  <ul className="divide-y divide-border">
    <li className="bg-neutral-50 p-2 text-xs">Hôm nay</li>
    <li className="p-4">Bài nộp đã được chấm</li>
  </ul>
  ```

  `divide-y` đang coi mốc ngày là một thông báo. Mốc ngày và thông báo không cùng loại, nên chúng
  không cùng một tập — và đó là lý do mã này tồn tại.

---

## Ánh xạ yêu cầu sang một quyết định

Nêu cái khoảng cách giữa các phần tử, hai bên của nó, và **có hay không** khoảng trống chạy qua nó. Nếu thiếu **một** dữ kiện
quyết định, hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi —
không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Xếp các thẻ khoá học thành lưới, cách nhau ra | Khoảng trống đã nói ranh giới | `DIVIDER-0` | không class CSS đường phân cách |
| Danh sách cài đặt liền mạch, có gạch giữa các dòng | N thành viên cùng loại, dính nhau trên một mặt | `DIVIDER-1` | `divide-y divide-border` trên phần tử cha |
| Ba ô số liệu nằm ngang trong một thẻ, có vạch ngăn | Tập cùng loại, trục ngang là hệ quả | `DIVIDER-1` | `flex divide-x divide-border` |
| Tách phần tiêu đề hộp thoại khỏi phần thân | Dải gọi tên phần sau, hai bên dính nhau | `DIVIDER-2` | `border-b border-border` trên phần đầu |
| Nút Lưu/Huỷ dính đáy một biểu mẫu dài | Dải nằm sau, đóng cạnh trên của nó | `DIVIDER-2` | `border-t border-border` trên phần cuối |
| Thanh bên hội thoại dính vào khung trò chuyện | Hai vùng khác loại, chạm nhau, ngang hàng | `DIVIDER-3` | `border-l border-border` trên vế sau |
| Bảng so sánh gói, đọc dọc lẫn ngang đều có nghĩa | Ô có nghĩa trên hai trục | `DIVIDER-5` | `divide-y` trên ma trận + `divide-x` trên mỗi hàng |
| Chèn chữ "hoặc" giữa hai cách đăng nhập | Đường kẻ phải bị cắt để mang nhãn ⇒ không là cạnh của ai | `DIVIDER-6` | hai vạch `h-px` + `aria-hidden` |
| Cho khối tóm tắt một đường bao cho tách bạch | Bốn cạnh là tuyên bố tư cách thành viên | `DIVIDER-4` | mô-đun này không trả lời — chuyển sang luật quan hệ nhóm |
| Ngăn cách phần tóm tắt và phần điều khoản | Chưa biết hai bên có chạm nhau không ⇒ lấy mã an toàn | `DIVIDER-0` | không class CSS đường phân cách |

Ở dòng cuối, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ hai phần phải nằm sát nhau:
*"Hai phần này có chung một mặt liền và chạm nhau, hay giữa chúng có khoảng trống?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `DIVIDER-0` / mọi mã khác | Phần tử cha có đang giữ một khoảng trống chạy qua đúng khoảng cách giữa các phần tử này không? |
| `DIVIDER-1` / `DIVIDER-0` | Các mục dính sát nhau trên một mặt liền, hay cách nhau ra? |
| `DIVIDER-1` / `DIVIDER-2` | Phần này là **một thành viên** của tập, hay là thứ **gọi tên** cả tập? |
| `DIVIDER-1` / `DIVIDER-3` | N thứ **cùng loại**, hay 2 thứ **khác loại**? |
| `DIVIDER-2` / `DIVIDER-3` | Một bên chi phối bên kia, hay hai bên ngang hàng? |
| `DIVIDER-1` / `DIVIDER-5` | Một ô có nghĩa nhờ hàng của nó thôi, hay nhờ cả hàng lẫn cột? |
| `DIVIDER-3` / `DIVIDER-4` | Đường này nằm **giữa** hai thứ, hay chạy **quanh** một thứ? |
| `DIVIDER-2` / `DIVIDER-6` | Có phần tử nào sở hữu được cạnh này không, hay đường kẻ phải tự đứng? |

## Sai lầm lặp lại nhiều nhất

1. Vừa `gap` vừa `divide-*` trên cùng một phần tử cha — một ranh giới nói hai lần.
2. `border-b` trên từng thành viên, rồi vá bằng `last:border-b-0`.
3. Hai phần tử cạnh nhau cùng khai cạnh đối diện của nhau — ra hai đường.
4. Kẻ một đường bên cạnh một vùng đã cách vùng kia bằng khoảng trống, nên đường kẻ nằm lơ lửng.
5. Quên `overflow-hidden` trên bề mặt chứa bo góc, đường kẻ chạy quá góc.
6. Cho đường kẻ của dải ghim xuất hiện khi cuộn.
7. Dùng bốn cạnh để nói một khoảng cách giữa các phần tử, hoặc bao thêm một vòng quanh thứ đã có đường bao.
8. Gỡ `divide-*` vì danh sách đang có một mục.
9. Khung chờ không có đường kẻ, nội dung thật thì có — bố cục nhảy khi dữ liệu về.
10. Vẽ `divide-x` bên trong một hàng chỉ vì hàng có nhiều cột.
