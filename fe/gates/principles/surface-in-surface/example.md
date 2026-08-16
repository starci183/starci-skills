---
id: fe-principles-surface-in-surface-example
title: example.md
slug: /gates/principles/surface-in-surface/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã SURFACE-IN-SURFACE-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `surface-in-surface` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Sau đó là một mục riêng cho **mã lồng mã**, vì luật *một vùng chứa, một tuyên bố* chỉ nhìn thấy được
khi hai mã nằm trong nhau. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một class CSS duy nhất.

**Về biến thiết kế màu.** `bg-card`, `bg-background`, `border-border`, `text-foreground` và `shadow-surface`
là **tên ngữ nghĩa** mà giao diện nào cũng tự định nghĩa được: nền của một bề mặt, nền của trang,
một màu ranh giới, một màu chữ, và **một** mức độ nổi. Chúng không phải tên của một sản phẩm nào.

**Về khoảng cách.** Trong các ví dụ vẫn có `gap-*` và `p-*` vì mã đánh dấu thật có chúng, nhưng chúng **không**
phải đầu ra của mô-đun này. Quyết định của mô-đun này luôn là **một** chuỗi class CSS ranh giới.

---

## `SURFACE-IN-SURFACE-1` — đối tượng độc lập trên nền trang

`rounded-2xl bg-card shadow-surface`

### Trường hợp: thẻ tóm tắt đơn hàng

```tsx
<article className="rounded-2xl bg-card shadow-surface">
  <header className="p-4">
    <h2 className="font-medium">Đơn hàng #10482</h2>
  </header>
  <div className="p-4">
    <p className="text-sm">Đã thanh toán · giao trong 3 ngày làm việc</p>
  </div>
</article>
```

Đối tượng gọi được tên ("đơn hàng #10482"), có thành viên, có trạng thái riêng, có kết quả riêng, và
bề mặt chứa của nó là nền trang. Đủ bốn dữ kiện thì được nâng nổi.

### Trường hợp: khung biểu mẫu độc lập

```tsx
<section className="rounded-2xl bg-card shadow-surface">
  <h2 className="p-4 font-medium">Đổi mật khẩu</h2>
  <form className="flex flex-col gap-4 p-4">
    <input aria-label="Mật khẩu hiện tại" className="rounded-md border px-3 py-2" type="password" />
    <input aria-label="Mật khẩu mới" className="rounded-md border px-3 py-2" type="password" />
  </form>
</section>
```

Biểu mẫu tự tải, tự lỗi, tự thành công mà không kéo theo phần còn lại của trang — nên nó là một đối tượng,
không phải một mảng nội dung.

### Trường hợp: khối thống kê tiến độ

```tsx
<div className="rounded-2xl bg-card shadow-surface p-4">
  <span className="text-sm text-neutral-500">Tiến độ tuần này</span>
  <p className="text-3xl font-semibold tabular-nums">68%</p>
</div>
```

### Trường hợp: thẻ trong một lưới — nhiều đối tượng cùng cấp, mỗi cái tự sở hữu

```tsx
<div className="grid gap-4 sm:grid-cols-3">
  <article className="rounded-2xl bg-card shadow-surface p-4">Nền tảng hệ thống</article>
  <article className="rounded-2xl bg-card shadow-surface p-4">Khả năng mở rộng</article>
  <article className="rounded-2xl bg-card shadow-surface p-4">Độ tin cậy</article>
</div>
```

Cha của lưới **không** được vẽ gì — nó là `SURFACE-IN-SURFACE-3`. Xem mục đó.

### Trường hợp: khung bộ lọc là một đối tượng, không phải một cái nền

```tsx
<aside className="rounded-2xl bg-card shadow-surface p-4">
  <h3 className="text-sm font-medium">Cấp độ</h3>
  <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" />Nền tảng</label>
  <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" />Nâng cao</label>
</aside>
```

### Trường hợp: khung chờ của cùng đối tượng đó — giữ đúng ranh giới

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <span className="block h-5 w-40 rounded bg-neutral-200" />
  <span className="mt-3 block h-8 w-24 rounded bg-neutral-200" />
</article>
```

Khung chờ giữ nguyên mã vì đối tượng vẫn tồn tại, chỉ chưa có dữ liệu. Làm phẳng khung chờ rồi nâng nổi khi
tải xong là để bố cục nhảy đúng lúc người dùng đang nhìn.

### Ngoại lệ và nhầm lẫn

- **Không cộng đường viền vào độ nổi.** Độ nổi và dàn ý là hai cách nói cùng một điều; nói cả hai
  là nói hai lần.

  ```tsx
  {/* SAI */}  <article className="rounded-2xl border border-border bg-card shadow-surface">…</article>
  {/* ĐÚNG */} <article className="rounded-2xl bg-card shadow-surface">…</article>
  ```

- **Không nâng nổi một vùng chứa chỉ gom phần tử ngang hàng đã có ranh giới** — đó là `SURFACE-IN-SURFACE-3`.

  ```tsx
  {/* SAI — card bọc card */}
  <section className="rounded-2xl bg-card shadow-surface">
    <article className="rounded-2xl bg-card shadow-surface p-4">Thiết bị 1</article>
    <article className="rounded-2xl bg-card shadow-surface p-4">Thiết bị 2</article>
  </section>
  ```

- **Không nâng nổi bên trong một bề mặt khác.** Thẻ trong thẻ là lỗi, không phải một lựa chọn; bên
  trong bề mặt, quan hệ nhóm riêng dùng `SURFACE-IN-SURFACE-5`.
- **Không nâng nổi một thành phần điều khiển.** Một cái nút không phải một đối tượng nghiệp vụ.
- **"Nhìn cho nổi" không phải bằng chứng.** Nếu không nêu được tên, thành viên, trạng thái và kết
  quả, thì chưa có đối tượng.

---

## `SURFACE-IN-SURFACE-2` — tập hàng so sánh được, ở cấp trang

`overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border`

### Trường hợp: bảng xếp hạng

```tsx
<ol className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
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

Mọi hàng có cùng ba trường và đọc theo cùng một cách, nên chúng so sánh được. Cả tập là **một** đối tượng
cấp trang; từng hàng **không** được nâng nổi.

### Trường hợp: lịch sử giao dịch

```tsx
<ul className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
  {transactions.map((transaction) => (
    <li className="flex items-center justify-between p-4" key={transaction.id}>
      <span className="flex flex-col gap-1">
        <span className="font-medium">{transaction.title}</span>
        <span className="text-sm text-neutral-500">{transaction.paidAt}</span>
      </span>
      <span className="tabular-nums">{transaction.amount}</span>
    </li>
  ))}
</ul>
```

### Trường hợp: danh sách thiết bị đang đăng nhập

```tsx
<ul className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
  <li className="flex items-center justify-between p-4">
    <span>Trình duyệt trên máy tính · Hà Nội</span>
    <span className="text-sm text-neutral-500">Đang hoạt động</span>
  </li>
  <li className="flex items-center justify-between p-4">
    <span>Ứng dụng di động · Đà Nẵng</span>
    <span className="text-sm text-neutral-500">2 ngày trước</span>
  </li>
</ul>
```

### Trường hợp: danh sách cài đặt — hàng bấm được vẫn không tự nâng nổi

```tsx
<div className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
  <button className="flex w-full items-center justify-between p-4 text-left" type="button">
    <span>Thông báo qua email</span>
    <span className="text-sm text-neutral-500">Bật</span>
  </button>
  <button className="flex w-full items-center justify-between p-4 text-left" type="button">
    <span>Thông báo đẩy</span>
    <span className="text-sm text-neutral-500">Tắt</span>
  </button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Thiếu `overflow-hidden` là hỏng góc bo.** Hàng đầu và hàng cuối tràn ra ngoài bán kính của tập, và
  cái tràn đó xuất hiện đúng ở trạng thái rê chuột — nghĩa là đánh giá tĩnh sẽ không thấy.

  ```tsx
  {/* SAI */}  <ul className="rounded-2xl bg-card shadow-surface divide-y divide-border">…</ul>
  ```

- **Hàng không so sánh được thì không phải tập liền mạch.** Ba khối có cấu trúc khác hẳn nhau là ba
  đối tượng riêng, mỗi cái `SURFACE-IN-SURFACE-1`, và cha của chúng là `SURFACE-IN-SURFACE-3`.
- **Đã `divide-y` thì không thêm khoảng cách giữa hàng.** Hai cách nói cùng một ranh giới.

  ```tsx
  {/* SAI */}  <ul className="… divide-y divide-border flex flex-col gap-2">…</ul>
  ```

- **Nằm trong một bề mặt khác thì xuống dàn ý.** Cùng tập liền mạch, bề mặt chứa khác — xem
  `SURFACE-IN-SURFACE-5`.
- **Danh sách rỗng vẫn giữ ranh giới của tập.** Đối tượng vẫn tồn tại; chỉ số thành viên bằng 0.

  ```tsx
  <div className="overflow-hidden rounded-2xl bg-card shadow-surface">
    <p className="p-8 text-center text-sm text-neutral-500">Chưa có giao dịch nào.</p>
  </div>
  ```

---

## `SURFACE-IN-SURFACE-3` — phần nội dung chỉ gọi tên cho phần tử ngang hàng đã có ranh giới

`bg-background shadow-none`

### Trường hợp: tiêu đề và lưới thẻ

```tsx
<section className="bg-background shadow-none" aria-labelledby="courses">
  <h2 className="font-medium" id="courses">Khoá học của tôi</h2>
  <div className="mt-3 grid gap-4 sm:grid-cols-3">
    <article className="rounded-2xl bg-card shadow-surface p-4">Nền tảng hệ thống</article>
    <article className="rounded-2xl bg-card shadow-surface p-4">Khả năng mở rộng</article>
    <article className="rounded-2xl bg-card shadow-surface p-4">Độ tin cậy</article>
  </div>
</section>
```

Phần nội dung chỉ làm một việc: gọi tên. Con của nó đã tự sở hữu ranh giới, nên nó không sở hữu thêm gì.

### Trường hợp: ba thẻ giá ngang hàng

```tsx
<section className="bg-background shadow-none" aria-labelledby="plans">
  <h2 className="font-medium" id="plans">Gói dịch vụ</h2>
  <div className="mt-3 grid gap-4 lg:grid-cols-3">
    <article className="rounded-2xl bg-card shadow-surface p-4">Cơ bản</article>
    <article className="rounded-2xl bg-card shadow-surface p-4">Tiêu chuẩn</article>
    <article className="rounded-2xl bg-card shadow-surface p-4">Doanh nghiệp</article>
  </div>
</section>
```

### Trường hợp: thẻ tab khung chứa phần tử ngang hàng đã có ranh giới

```tsx
<div className="bg-background shadow-none" role="tabpanel">
  <ul className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
    <li className="p-4">Hoá đơn tháng 7</li>
    <li className="p-4">Hoá đơn tháng 8</li>
  </ul>
</div>
```

### Trường hợp: vùng trang gom hai đối tượng khác loại

```tsx
<section className="bg-background shadow-none">
  <div className="grid gap-4 lg:grid-cols-2">
    <article className="rounded-2xl bg-card shadow-surface p-4">Tóm tắt thanh toán</article>
    <ul className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
      <li className="p-4">Giao dịch gần đây</li>
      <li className="p-4">Giao dịch trước đó</li>
    </ul>
  </div>
</section>
```

Hai con là hai mã khác nhau (`1` và `2`) nhưng đều **đã có** ranh giới, nên cha vẫn là mã `3`.

### Ngoại lệ và nhầm lẫn

- **Đừng bọc thẻ quanh thẻ.** Đây là lỗi hay gặp nhất của mã này.

  ```tsx
  {/* SAI */}
  <section className="rounded-2xl bg-card shadow-surface p-4">
    <h2>Gói dịch vụ</h2>
    <article className="rounded-2xl bg-card shadow-surface p-4">Cơ bản</article>
  </section>
  ```

- **Nếu phần nội dung tự là một đối tượng thì con của nó phải phẳng.** Không được vừa nâng nổi cha vừa nâng nổi
  con.

  ```tsx
  {/* ĐÚNG — cha là object, con là nội dung */}
  <section className="rounded-2xl bg-card shadow-surface p-4">
    <h2 className="font-medium">Tổng quan tài khoản</h2>
    <div className="bg-transparent shadow-none mt-3">
      <p className="text-sm">Gói tiêu chuẩn · gia hạn ngày 01/09</p>
    </div>
  </section>
  ```

- **Đừng nhầm mã `3` với mã `4`.** Mã `3` đứng ở **cấp trang** và dùng `bg-background`; mã `4` đứng
  **trong một bề mặt** và dùng `bg-transparent`. Hai mã cùng "không vẽ gì" nhưng nói hai điều khác
  nhau, và dùng nhầm nền sẽ làm một khối trong thẻ có nền đục khác bề mặt chứa.
- **Tiêu đề không tạo ra ranh giới.** Có tiêu đề không đủ để nâng nổi; phải có tên, thành viên, trạng
  thái và kết quả.

---

## `SURFACE-IN-SURFACE-4` — trùng, thường, hoặc không gọi được tên

`bg-transparent shadow-none`

### Trường hợp: nội dung thường trong một thẻ

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Nền tảng hệ thống</h2>
  <div className="bg-transparent shadow-none mt-3">
    <p className="text-sm">Khoá học đi từ mô hình dữ liệu tới quyết định nhất quán.</p>
  </div>
</article>
```

Đoạn mô tả thuộc đúng nhóm mà thẻ đã tuyên bố. Thêm một ranh giới nữa là nói lại điều bề mặt chứa đã nói.

### Trường hợp: nội dung thường trong phần tử chồng lớp

```tsx
<div className="rounded-2xl bg-card shadow-surface p-4" role="dialog" aria-label="Xác nhận huỷ">
  <h2 className="font-medium">Huỷ đăng ký?</h2>
  <div className="bg-transparent shadow-none mt-3">
    <p className="text-sm">Bạn vẫn truy cập được tới hết chu kỳ đã thanh toán.</p>
  </div>
</div>
```

Phần tử chồng lớp đã sở hữu ranh giới của **cả tác vụ**. Mọi thứ thường bên trong nó rơi vào mã `4`.

### Trường hợp: lớp bọc kỹ thuật — tồn tại vì bố cục, không vì quan hệ nhóm

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <div className="bg-transparent shadow-none flex flex-col gap-3">
    <span className="text-sm text-neutral-500">Trạng thái</span>
    <span className="font-medium">Đang xử lý</span>
  </div>
</article>
```

Vùng chứa này có mặt để đặt hướng xếp. Nó không có tên, không có thành viên, không có kết quả — nên
nó không có ranh giới.

### Trường hợp: không gọi được tên quan hệ nhóm — mặc định an toàn

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Hồ sơ</h2>
  {/* Chưa ai nêu được tên/thành viên/trạng thái/kết quả cho cụm dưới đây ⇒ không vẽ ranh giới. */}
  <div className="bg-transparent shadow-none mt-3">
    <p className="text-sm">Đã xác minh email · đã bật xác thực hai bước</p>
  </div>
</article>
```

### Trường hợp: trạng thái rỗng bằng chữ, bên trong thẻ đã có

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Bài nộp gần đây</h2>
  <div className="bg-transparent shadow-none py-8 text-center">
    <p className="text-sm text-neutral-500">Chưa có bài nộp nào.</p>
  </div>
</article>
```

### Trường hợp: khung chờ bên trong thẻ — vẫn phẳng

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <div className="bg-transparent shadow-none flex flex-col gap-2">
    <span className="h-4 w-48 rounded bg-neutral-200" />
    <span className="h-4 w-32 rounded bg-neutral-200" />
  </div>
</article>
```

### Ngoại lệ và nhầm lẫn

- **Phẳng nghĩa là phẳng.** `bg-transparent` cộng thêm một đường viền là đã lặng lẽ nhảy sang mã `5` mà
  chưa chứng minh quan hệ nhóm.

  ```tsx
  {/* SAI */}  <div className="bg-transparent shadow-none rounded-xl border border-border">…</div>
  ```

- **DOM lồng nhau không phải bằng chứng quan hệ nhóm.** Một `div` có 5 cấp cha vẫn có thể không sở hữu
  gì cả.
- **Đừng bọc bề mặt quanh một thành phần điều khiển.** Một nút là mã `6`, và mã `6` không sinh ra lớp bọc.

  ```tsx
  {/* SAI */}
  <div className="rounded-xl border border-border p-2">
    <button type="button">Thử lại</button>
  </div>
  ```

- **Gọi tên được thì phải lên mã `5`.** Mã `4` là mặc định an toàn, không phải chỗ trốn: nếu tập bên
  trong đúng là một tập liền mạch có tên riêng, để nó phẳng là giấu mất một ranh giới thật.

---

## `SURFACE-IN-SURFACE-5` — tập liền mạch riêng bên trong một bề mặt

`overflow-hidden rounded-xl border border-border bg-transparent shadow-none`

### Trường hợp: danh sách bài học bên trong thẻ khoá học

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Nền tảng hệ thống</h2>
  <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none divide-y divide-border mt-3">
    <li className="flex items-center justify-between p-3">
      <span className="text-sm">Mô hình dữ liệu</span>
      <span className="text-xs text-neutral-500">12 phút</span>
    </li>
    <li className="flex items-center justify-between p-3">
      <span className="text-sm">Quorum đọc và ghi</span>
      <span className="text-xs text-neutral-500">18 phút</span>
    </li>
  </ul>
</article>
```

"Danh sách bài học" là một nhóm gọi được tên, khác tên với "khoá học", có thể rỗng riêng và tải riêng.
Nó được **một** đường viền, **không** được độ nổi thứ hai.

### Trường hợp: các dòng chi tiết trong khung thanh toán

```tsx
<section className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Thanh toán</h2>
  <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none divide-y divide-border mt-3">
    <li className="flex items-center justify-between p-3"><span className="text-sm">Gói tiêu chuẩn</span><span className="text-sm tabular-nums">499.000đ</span></li>
    <li className="flex items-center justify-between p-3"><span className="text-sm">Thuế</span><span className="text-sm tabular-nums">49.900đ</span></li>
  </ul>
  <p className="mt-3 text-sm">Tổng cộng: <strong className="tabular-nums">548.900đ</strong></p>
</section>
```

Bề mặt chứa còn nội dung khác ngoài nhóm này (tiêu đề, dòng tổng), nên nhóm này đúng là một nhóm **bên
trong**, không phải chính bề mặt chứa.

### Trường hợp: tệp đính kèm trong hộp thoại

```tsx
<div className="rounded-2xl bg-card shadow-surface p-4" role="dialog" aria-label="Nộp bài">
  <h2 className="font-medium">Nộp bài</h2>
  <p className="mt-2 text-sm">Kiểm tra lại các tệp trước khi gửi.</p>
  <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none divide-y divide-border mt-3">
    <li className="flex items-center justify-between p-3"><span className="truncate text-sm">bao-cao.pdf</span><span className="text-xs text-neutral-500">2,4 MB</span></li>
    <li className="flex items-center justify-between p-3"><span className="truncate text-sm">so-do.png</span><span className="text-xs text-neutral-500">840 KB</span></li>
  </ul>
</div>
```

### Trường hợp: bề mặt chứa đã gọi tên nhóm — bỏ nhãn lặp, giữ ranh giới

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Người tham gia</h2>
  {/* Host đã nói "Người tham gia" ⇒ bỏ nhãn thứ hai bên trong outline, nhưng KHÔNG bỏ outline:
      membership vẫn khác host. */}
  <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none divide-y divide-border mt-3">
    <li className="p-3 text-sm">An Nguyễn</li>
    <li className="p-3 text-sm">Mai Lê</li>
  </ul>
</article>
```

### Trường hợp: nhóm lồng ở trạng thái rỗng — giữ ranh giới, không giữ đường phân cách

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Lịch sử thay đổi</h2>
  <div className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none mt-3">
    <p className="p-6 text-center text-sm text-neutral-500">Chưa có thay đổi nào được ghi lại.</p>
  </div>
</article>
```

### Ngoại lệ và nhầm lẫn

- **Không cộng bóng vào dàn ý.** Trong một bề mặt, độ nổi lần hai là nói dối về độ sâu.

  ```tsx
  {/* SAI */}  <ul className="rounded-xl border border-border bg-card shadow-surface">…</ul>
  {/* ĐÚNG */} <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none">…</ul>
  ```

- **Không dùng `bg-card` cho nhóm lồng.** Nền đục lần hai làm nhóm trông như một tầng khác, trong khi
  nó vẫn nằm cùng một tầng với bề mặt chứa.
- **Chỉ quan hệ nhóm liền mạch mới được lồng ranh giới.** Một nhóm lồng gồm những phần **không** đồng
  dạng chưa có mã trong bộ từ vựng này; nó là mã `4`.

  ```tsx
  {/* SAI — các phần bên trong không so sánh được với nhau */}
  <div className="rounded-xl border border-border p-3">
    <h3>Ghi chú</h3>
    <img alt="" src="…" />
    <button type="button">Chia sẻ</button>
  </div>
  ```

- **Một nhóm chiếm trọn bề mặt chứa thì chính nó là bề mặt chứa.** Nếu ngoài nhóm này thẻ không còn gì, hai ranh
  giới đang nói cùng một điều — bỏ thẻ, giữ mã `2` ở cấp trang.
- **Hai đối tượng có đường viền chạm nhau vẫn là hai đối tượng.** Nằm cạnh nhau không biến chúng thành một tập;
  chỉ tính so sánh được của hàng mới biến.

---

## `SURFACE-IN-SURFACE-6` — hành động thường bên trong bề mặt

`border border-border bg-transparent text-foreground`

### Trường hợp: nút thử lại trong thẻ lỗi

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <p className="text-sm">Không tải được tiến độ học tập.</p>
  <button className="border border-border bg-transparent text-foreground rounded-md px-3 py-2 text-sm mt-3" type="button">
    Thử lại
  </button>
</article>
```

Thành phần điều khiển **không** được bọc trong một lớp bọc có ranh giới: một nhóm chỉ có một thành viên không phải
một nhóm.

### Trường hợp: "Xem tất cả" ở chân một thẻ danh sách

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Thông báo</h2>
  <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none divide-y divide-border mt-3">
    <li className="p-3 text-sm">Bài nộp đã được chấm</li>
    <li className="p-3 text-sm">Có phản hồi mới</li>
  </ul>
  <button className="border border-border bg-transparent text-foreground rounded-md px-3 py-2 text-sm mt-3" type="button">
    Xem tất cả
  </button>
</article>
```

Ba mã cùng có mặt: `1` cho thẻ, `5` cho danh sách lồng, `6` cho hành động.

### Trường hợp: hai hành động trong phần cuối hộp thoại

```tsx
<div className="rounded-2xl bg-card shadow-surface p-4" role="dialog" aria-label="Xoá bản nháp">
  <h2 className="font-medium">Xoá bản nháp?</h2>
  <p className="mt-2 text-sm">Thao tác này không hoàn tác được.</p>
  <div className="bg-transparent shadow-none mt-4 flex items-center gap-2">
    <button className="border border-border bg-transparent text-foreground rounded-md px-3 py-2 text-sm" type="button">Giữ lại</button>
    <button className="border border-border bg-transparent text-foreground rounded-md px-3 py-2 text-sm" type="button">Xoá</button>
  </div>
</div>
```

Cụm hai nút là mã `4` (chỉ là một lớp bọc xếp hàng), từng nút là mã `6`. **Chưa** nút nào được
nâng cấp: vị trí dưới-phải không phải bằng chứng.

### Trường hợp: hành động cục bộ trong một hàng của tập liền mạch

```tsx
<ul className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
  <li className="flex items-center justify-between p-4">
    <span className="text-sm">Hoá đơn tháng 8</span>
    <button className="border border-border bg-transparent text-foreground rounded-md px-3 py-1.5 text-sm" type="button">
      Tải xuống
    </button>
  </li>
</ul>
```

### Ngoại lệ và nhầm lẫn

- **Không bọc thành phần điều khiển bằng bề mặt.**

  ```tsx
  {/* SAI */}
  <div className="rounded-2xl bg-card shadow-surface p-2">
    <button type="button">Sao chép mã</button>
  </div>
  ```

- **Là thành phần điều khiển duy nhất cũng không tự lên chính.** Duy nhất là một dữ kiện về số lượng, không phải
  một dữ kiện về ưu tiên.
- **Không tự đổi sang cách thể hiện nổi hơn.** Nâng cấp phải do
  [cảm nhận về hành động](../../../senses/call-to-action/INDEX.md) chứng minh; nếu chưa có chứng minh, giữ mã `6`
  và ghi lại yêu cầu.
- **Trạng thái `disabled` hay `loading` không đổi mã.** Ranh giới không đổi khi nút đang chờ.

---

## Mã lồng mã — nơi luật "một vùng chứa, một tuyên bố" nhìn thấy được

Một mã áp cho **một quan hệ**, không áp cho cả cây. Ba ví dụ dưới đây có bốn tới năm mã cùng lúc.

### Trang đầy đủ: mã `3` bọc mã `1` và mã `2`

```tsx
<main className="bg-background">
  <section className="bg-background shadow-none" aria-labelledby="overview">
    <h2 className="font-medium" id="overview">Tổng quan</h2>
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl bg-card shadow-surface p-4">
        <span className="text-sm text-neutral-500">Tiến độ tuần này</span>
        <p className="text-3xl font-semibold tabular-nums">68%</p>
      </article>
      <ul className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
        <li className="p-4 text-sm">Hoàn thành “Quorum đọc và ghi”</li>
        <li className="p-4 text-sm">Nộp bài thử thách “Giới hạn tần suất”</li>
      </ul>
    </div>
  </section>
</main>
```

`3` cho phần nội dung, `1` cho khối thống kê, `2` cho tập hàng. Phần nội dung **không** vẽ gì vì cả hai con đã tự
sở hữu ranh giới của mình.

### Thẻ đầy đủ: mã `1` bọc mã `4`, mã `5` và mã `6`

```tsx
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Khả năng mở rộng</h2>

  <div className="bg-transparent shadow-none mt-2">
    <p className="text-sm">Khoá học đi từ tải đọc tới phân mảnh ghi.</p>
  </div>

  <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none divide-y divide-border mt-4">
    <li className="flex items-center justify-between p-3"><span className="text-sm">Bộ nhớ đệm</span><span className="text-xs text-neutral-500">14 phút</span></li>
    <li className="flex items-center justify-between p-3"><span className="text-sm">Phân mảnh</span><span className="text-xs text-neutral-500">22 phút</span></li>
  </ul>

  <button className="border border-border bg-transparent text-foreground rounded-md px-3 py-2 text-sm mt-4" type="button">
    Tiếp tục học
  </button>
</article>
```

Bốn mã, bốn quan hệ khác nhau, **một** tuyên bố cho mỗi vùng chứa. Đổi bất kỳ cái nào sang mã khác là
đổi một sự thật nghiệp vụ, không phải đổi một chi tiết thị giác.

### Phần tử chồng lớp đầy đủ: phần tử chồng lớp là bề mặt chứa, mã `4` cho nội dung, mã `5` cho nhóm, mã `6` cho hành động

```tsx
<div className="rounded-2xl bg-card shadow-surface p-4" role="dialog" aria-label="Xác nhận nộp bài">
  <h2 className="font-medium">Xác nhận nộp bài</h2>

  <div className="bg-transparent shadow-none mt-2">
    <p className="text-sm">Sau khi nộp, bạn không sửa được nội dung đã gửi.</p>
  </div>

  <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none divide-y divide-border mt-3">
    <li className="flex items-center justify-between p-3"><span className="truncate text-sm">bai-lam.md</span><span className="text-xs text-neutral-500">18 KB</span></li>
    <li className="flex items-center justify-between p-3"><span className="truncate text-sm">so-do.png</span><span className="text-xs text-neutral-500">840 KB</span></li>
  </ul>

  <div className="bg-transparent shadow-none mt-4 flex items-center gap-2">
    <button className="border border-border bg-transparent text-foreground rounded-md px-3 py-2 text-sm" type="button">Quay lại</button>
    <button className="border border-border bg-transparent text-foreground rounded-md px-3 py-2 text-sm" type="button">Nộp bài</button>
  </div>
</div>
```

### Cùng một tập liền mạch, hai bề mặt chứa, hai mã

```tsx
{/* Host = nền trang ⇒ SURFACE-IN-SURFACE-2 */}
<ul className="overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border">
  <li className="p-4 text-sm">Hoá đơn tháng 7</li>
  <li className="p-4 text-sm">Hoá đơn tháng 8</li>
</ul>
```

```tsx
{/* Host = một card ⇒ SURFACE-IN-SURFACE-5 */}
<article className="rounded-2xl bg-card shadow-surface p-4">
  <h2 className="font-medium">Thanh toán</h2>
  <ul className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none divide-y divide-border mt-3">
    <li className="p-3 text-sm">Hoá đơn tháng 7</li>
    <li className="p-3 text-sm">Hoá đơn tháng 8</li>
  </ul>
</article>
```

Nội dung y hệt nhau, mã khác nhau. **Bề mặt chứa quyết định hình thức của ranh giới; quan hệ nhóm quyết định
có ranh giới hay không.**

### Tính đồng nhất trạng thái: khung chờ vẽ đúng số đối tượng mà nội dung thật vẽ

```tsx
{/* Đang tải — vẫn 1 card + 1 nhóm lồng, đúng như khi đã có dữ liệu */}
<article className="rounded-2xl bg-card shadow-surface p-4">
  <span className="block h-5 w-40 rounded bg-neutral-200" />
  <div className="overflow-hidden rounded-xl border border-border bg-transparent shadow-none mt-3">
    <div className="p-3"><span className="block h-4 w-32 rounded bg-neutral-200" /></div>
    <div className="border-t border-border p-3"><span className="block h-4 w-24 rounded bg-neutral-200" /></div>
  </div>
</article>
```

---

## Ánh xạ yêu cầu sang một class CSS

Nêu `host`, `child` và `membership`. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi
dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Một tóm tắt độc lập nằm thẳng trên trang." | Đối tượng có tên, thành viên, trạng thái, kết quả; bề mặt chứa là nền trang | `SURFACE-IN-SURFACE-1` | `rounded-2xl bg-card shadow-surface` |
| "Các hàng ngang hàng tạo một tập ngay trên trang." | Hàng so sánh được, cả tập là một đối tượng cấp trang | `SURFACE-IN-SURFACE-2` | `overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border` |
| "Một phần nội dung chỉ đặt tên cho mấy thẻ bên dưới." | Con đã tự sở hữu ranh giới | `SURFACE-IN-SURFACE-3` | `bg-background shadow-none` |
| "Đoạn mô tả vẫn thuộc đúng thẻ hiện tại." | Trùng quan hệ nhóm với bề mặt chứa | `SURFACE-IN-SURFACE-4` | `bg-transparent shadow-none` |
| "Muốn thêm một thẻ lồng nhưng chưa gọi tên được nhóm." | Quan hệ nhóm chưa xác định ⇒ dùng phương án an toàn | `SURFACE-IN-SURFACE-4` | `bg-transparent shadow-none` |
| "Một tập hàng có quan hệ nhóm riêng nằm trong thẻ." | Gọi được tên, khác bề mặt chứa, bề mặt chứa vẫn còn nội dung khác | `SURFACE-IN-SURFACE-5` | `overflow-hidden rounded-xl border border-border bg-transparent shadow-none` |
| "Một nút thử lại nằm trong thẻ." | Hành động cục bộ, chưa chứng minh ưu tiên | `SURFACE-IN-SURFACE-6` | `border border-border bg-transparent text-foreground` |
| "Nút này là nút chính, cho nó nổi lên." | Ưu tiên chưa được chứng minh ở mô-đun này | `SURFACE-IN-SURFACE-6` | `border border-border bg-transparent text-foreground` |
| "Nội dung thường bên trong hộp thoại." | Phần tử chồng lớp đã sở hữu ranh giới tác vụ | `SURFACE-IN-SURFACE-4` | `bg-transparent shadow-none` |

Ở hai dòng cuối, thứ bị từ chối không phải yêu cầu mà là **thiếu bằng chứng**: nâng cấp cần
[cảm nhận về hành động](../../../senses/call-to-action/INDEX.md), và ranh giới cần một quan hệ nhóm gọi được tên.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu, và hỏi **một** câu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `1` / `2` | Nội dung bên trong có phải một tập hàng so sánh được bằng cùng tập trường không? |
| `1` / `3` | Vùng chứa này tự là một đối tượng nghiệp vụ, hay chỉ gọi tên cho những thứ đã có ranh giới? |
| `1` / `5` | Bề mặt chứa của nó là nền trang hay là một bề mặt khác? |
| `2` / `3` | Từng hàng đã tự là một thẻ có ranh giới riêng chưa? |
| `3` / `4` | Vùng chứa đang đứng trên nền trang hay đứng bên trong một bề mặt? |
| `4` / `5` | Ranh giới này sở hữu nhóm nào khác bề mặt chứa hiện tại — nêu tên, thành viên, trạng thái, kết quả? |
| `4` / `6` | Đây là một nhóm hay là một thành phần điều khiển đơn lẻ? |
| `5` / `2` | Nếu bỏ bề mặt chứa đi thì nhóm này có còn bề mặt chứa nào không? |
| `6` / nâng cấp | Đã có ai chứng minh đây là kết quả chính duy nhất của bề mặt chứa chưa? |
| Hai đối tượng chạm nhau | Chúng có phải các hàng so sánh được của cùng một tập không? |

## Sai lầm lặp lại nhiều nhất

1. Bọc thẻ quanh thẻ, vì phần nội dung "trông trống".
2. Cộng đường viền vào một trang bề mặt đã có độ nổi.
3. Cộng bóng vào một dàn ý lồng nhau.
4. Dùng `bg-card` cho nhóm lồng, làm nó trông như một tầng khác.
5. Gọi một lớp bọc là "nhóm" mà không nêu được thành viên của nó.
6. Bọc một thành phần điều khiển đơn lẻ bằng một ranh giới.
7. Nâng cấp mọi thành phần điều khiển ở góc dưới bên phải thành chính.
8. Quên `overflow-hidden` trên tập liền mạch, rồi hàng tràn ra ngoài góc bo ở trạng thái rê chuột.
9. Vừa `divide-y` vừa đặt khoảng cách giữa hàng.
10. Khung chờ vẽ số đối tượng khác nội dung thật.
11. Đổi mã khi thiết kế đáp ứng dù bề mặt chứa không đổi.
12. Trả về một quyết định `gap` hoặc `padding` từ mô-đun này.
