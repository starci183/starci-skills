---
id: fe-principles-density-example
title: example.md
slug: /gates/principles/density/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã DENSITY-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `density` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Khai báo mật độ là một class CSS **không vẽ ra gì**: `[--density:1]`, `[--density:2]`, `[--density:3]`.
Nó nằm ở chỗ vùng bắt đầu, nó **di truyền xuống** toàn bộ cây con, và nó tồn tại để người sau đọc
được quyết định đó trong DOM thay vì phải đoán. Nhịp thật — chiều cao thành phần điều khiển, cỡ biểu tượng, khoảng đệm bên trong của hàng
— do các thành phần lặp lại bên trong tự viết theo bảng nhịp của mã đang có hiệu lực.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một mã duy nhất.

---

## `DENSITY-0` — không khai báo, thừa hưởng

### Trường hợp: một hàng dùng chung, không biết và không cần biết mình ở đâu

```tsx
function OrderRow({ order }) {
  return (
    <li className="flex items-center justify-between p-3">
      <span className="flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">
          {order.initials}
        </span>
        <span className="flex flex-col gap-1">
          <strong>{order.customer}</strong>
          <span className="text-sm text-neutral-500">{order.code}</span>
        </span>
      </span>
      <span className="tabular-nums">{order.total}</span>
    </li>
  );
}
```

Không có class CSS `[--density:…]` nào ở đây, và đó là câu trả lời **đúng**: hàng này không biết nó chặt
hay thoáng, vì câu hỏi đó không thuộc về nó.

### Trường hợp: lớp bọc bên trong một vùng đã khai báo

```tsx
<section className="[--density:2] flex flex-col gap-6">
  <div className="flex flex-col gap-3">
    <h2 className="font-medium">Thông tin thanh toán</h2>
    <div className="grid gap-4 sm:grid-cols-2">…</div>
  </div>
</section>
```

Ba `div` bên trong đều là `DENSITY-0`. Chỉ `section` khai báo, vì chỉ ở đó vùng mới bắt đầu.

### Trường hợp: cùng một thành phần, hai ngữ cảnh, hai kết quả — không sửa một dòng nào của thành phần

Ngữ cảnh thoáng:

```tsx
<section className="[--density:1] flex flex-col gap-6">
  <h2 className="text-xl font-semibold">Đơn hàng mới nhất của bạn</h2>
  <ul className="divide-y rounded-lg border">
    <OrderSummaryRow order={latest} />
  </ul>
</section>
```

Ngữ cảnh chặt, **cùng một `OrderSummaryRow`**:

```tsx
<section className="[--density:3] flex flex-col gap-3">
  <h2 className="font-medium">Tất cả đơn hàng</h2>
  <ul className="divide-y rounded-lg border">
    {orders.map((order) => <OrderSummaryRow key={order.id} order={order} />)}
  </ul>
</section>
```

Đây là toàn bộ lý do luật tồn tại. Nếu `OrderSummaryRow` được phép tự quyết, hai chỗ này sẽ sinh ra
`<OrderSummaryRow size="lg" />` và `<OrderSummaryRow size="sm" />`, rồi chỗ thứ ba sinh ra `"md"`,
rồi chỗ thứ tư sinh ra `"xs"`.

### Ngoại lệ và nhầm lẫn

- **Không viết `[--density:0]`.** Thừa hưởng là trạng thái không quyết định, không phải bậc bằng không.

  ```tsx
  {/* SAI */}  <li className="[--density:0] p-3">…</li>
  {/* ĐÚNG */} <li className="p-3">…</li>
  ```

- **Thành phần không được nhận thuộc tính truyền vào mật độ.** Đây là chính xác cái mà luật này cấm:

  ```tsx
  {/* SAI */}
  function OrderRow({ order, density = "md" }) {
    return <li className={density === "sm" ? "p-2" : "p-4"}>…</li>;
  }
  ```

  ```tsx
  {/* SAI — cùng một lỗi, mặc một cái tên khác */}
  <OrderRow order={order} compact />
  <OrderRow order={order} size="lg" />
  ```

- **Gốc không được là `DENSITY-0`.** Không có gì để thừa hưởng thì không thể thừa hưởng:

  ```tsx
  {/* SAI */}  <body><div id="app">…</div></body>
  {/* ĐÚNG */} <body><div className="[--density:2]" id="app">…</div></body>
  ```

- **`DENSITY-0` không có nghĩa là "mặc định".** Nó có nghĩa là "theo cái bên trên". Một biểu mẫu đặt trong
  bảng `DENSITY-3` mà im lặng thì ô nhập liệu của nó sẽ là `h-7`, và đó là hệ quả đúng của việc im lặng.

---

## `DENSITY-1` — thoáng, để đọc và để thuyết phục

### Trường hợp: khối giá

```tsx
<section className="[--density:1] mx-auto max-w-2xl flex flex-col gap-6">
  <div className="flex flex-col gap-1">
    <span className="text-3xl font-semibold tabular-nums">499.000đ</span>
    <span className="text-sm text-neutral-500">mỗi tháng, huỷ bất cứ lúc nào</span>
  </div>
  <ul className="flex flex-col gap-3">
    <li className="flex items-start gap-2">
      <svg aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>Không giới hạn dự án</span>
    </li>
    <li className="flex items-start gap-2">
      <svg aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>Sao lưu hằng ngày</span>
    </li>
  </ul>
  <button className="h-11 rounded-md bg-neutral-900 px-4 text-white" type="button">
    Bắt đầu dùng thử
  </button>
</section>
```

`h-11` và `size-5` là nhịp mà `DENSITY-1` ấn định. Không ai chọn chúng bằng mắt.

### Trường hợp: bước hướng dẫn ban đầu — một quyết định trên một màn hình

```tsx
<section className="[--density:1] mx-auto flex max-w-xl flex-col gap-6">
  <div className="flex flex-col gap-1">
    <h1 className="text-2xl font-semibold">Bạn làm việc theo nhóm hay một mình?</h1>
    <p className="text-sm text-neutral-500">Có thể đổi lại sau trong cài đặt.</p>
  </div>
  <div className="flex flex-col gap-3">
    <label className="flex items-center gap-3 rounded-lg border p-4">
      <input name="mode" type="radio" />
      <span>Một mình</span>
    </label>
    <label className="flex items-center gap-3 rounded-lg border p-4">
      <input name="mode" type="radio" />
      <span>Theo nhóm</span>
    </label>
  </div>
  <button className="h-11 rounded-md bg-neutral-900 px-4 text-white" type="submit">Tiếp tục</button>
</section>
```

Hai lựa chọn không phải là một danh sách để quét. Người đọc dừng lại ở **một** quyết định.

### Trường hợp: trạng thái rỗng có lời mời hành động

```tsx
<div className="[--density:1] flex flex-col items-center gap-6 rounded-lg border p-6 text-center">
  <div className="flex flex-col gap-1">
    <strong>Chưa có hoá đơn nào</strong>
    <p className="text-sm text-neutral-500">Hoá đơn sẽ xuất hiện ở đây sau kỳ thanh toán đầu tiên.</p>
  </div>
  <button className="inline-flex h-11 items-center gap-2 rounded-md border px-4" type="button">
    <svg aria-hidden="true" className="size-5" />
    Thêm phương thức thanh toán
  </button>
</div>
```

### Trường hợp: trang bài viết

```tsx
<article className="[--density:1] mx-auto flex max-w-2xl flex-col gap-6">
  <h1 className="text-3xl font-semibold">Vì sao retry cần idempotency key</h1>
  <p>Một lần gửi lại không phải là một lần gửi mới, nhưng máy chủ không biết điều đó.</p>
  <p>Khoá idempotency là cách người gửi nói ra điều mình đã biết.</p>
</article>
```

### Ngoại lệ và nhầm lẫn

- **Một danh sách dài nằm trong trang thoáng vẫn là `DENSITY-3`.** Vùng lồng khai báo lại:

  ```tsx
  <main className="[--density:1] flex flex-col gap-8">
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Bảng điều khiển</h1>
      <p>Tổng quan hoạt động của tài khoản trong 30 ngày qua.</p>
    </section>
    <section className="[--density:3] flex flex-col gap-3">
      <h2 className="font-medium">Giao dịch gần đây</h2>
      <table className="w-full">…</table>
    </section>
  </main>
  ```

  Đây là ví dụ **mã lồng mã**: `DENSITY-1` bao ngoài, `DENSITY-3` bên trong, mỗi vùng khai báo đúng
  công việc của mình. Không có vùng nào đi bù trừ cho vùng kia bằng cách chỉnh từng phần tử.

- **"Nhìn cho sang" không phải bằng chứng.** Một biểu mẫu cài đặt sáu trường vẫn là `DENSITY-2` dù nó đứng
  một mình giữa trang: nó là việc phải làm, không phải bài phải đọc.
- **Đừng dùng `DENSITY-1` để tạo khoảng trống giữa hai phần nội dung.** Khoảng cách giữa phần tử cùng cấp là việc của
  luật quan hệ, không phải của mật độ:

  ```tsx
  {/* SAI — đổi mật độ để lấy khoảng trắng */}
  <div className="[--density:1] flex flex-col gap-6">…</div>
  ```

---

## `DENSITY-2` — mặc định

### Trường hợp: gốc ứng dụng khai báo thành lời

```tsx
<div className="[--density:2] min-h-screen" id="app">
  <header className="border-b">…</header>
  <main>…</main>
</div>
```

Mọi vùng không khai báo gì bên dưới đây đều thừa hưởng `2`. Đây là câu khai báo quan trọng nhất trong
toàn bộ ứng dụng, vì nó là chỗ duy nhất không có gì ở trên để thừa hưởng.

### Trường hợp: biểu mẫu cài đặt

```tsx
<section className="[--density:2] flex flex-col gap-6">
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="name">Tên hiển thị</label>
    <input className="h-9 rounded-md border px-3" id="name" />
  </div>
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="email">Email</label>
    <input className="h-9 rounded-md border px-3" id="email" type="email" />
  </div>
  <div className="flex items-center gap-2">
    <button className="h-9 rounded-md border px-3 text-sm" type="button">Huỷ</button>
    <button className="h-9 rounded-md bg-neutral-900 px-3 text-sm text-white" type="submit">Lưu</button>
  </div>
</section>
```

### Trường hợp: trang chi tiết một bản ghi

```tsx
<section className="[--density:2] flex flex-col gap-6">
  <div className="flex items-center gap-2">
    <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">TL</span>
    <span className="flex flex-col gap-1">
      <strong>Trần Lam</strong>
      <span className="text-sm text-neutral-500">Đơn #A-10482</span>
    </span>
  </div>
  <div className="rounded-lg border p-4">
    <dl className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1"><dt className="text-sm text-neutral-500">Trạng thái</dt><dd>Đang giao</dd></div>
      <div className="flex flex-col gap-1"><dt className="text-sm text-neutral-500">Tổng tiền</dt><dd className="tabular-nums">1.240.000đ</dd></div>
    </dl>
  </div>
</section>
```

### Trường hợp: đặt lại thành lời bên trong một vùng chặt — mã lồng mã

```tsx
<section className="[--density:3] flex flex-col gap-3">
  <h2 className="font-medium">Thành viên</h2>
  <ul className="divide-y rounded-lg border">
    <li className="flex items-center justify-between p-2">
      <span className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-neutral-100 text-xs">TL</span>
        <span>Trần Lam</span>
      </span>
      <button className="h-7 rounded-md border px-2 text-sm" type="button">Sửa</button>
    </li>
  </ul>
  <form className="[--density:2] flex items-center gap-2 rounded-lg border p-4">
    <input aria-label="Email người mời" className="h-9 min-w-0 flex-1 rounded-md border px-3" />
    <button className="h-9 rounded-md bg-neutral-900 px-3 text-sm text-white" type="submit">Mời</button>
  </form>
</section>
```

Biểu mẫu mời là một **việc phải làm**, không phải một dòng để quét, nên nó không thừa hưởng `3`. Nó nói ra
điều đó bằng `[--density:2]`. Nếu nó im lặng, ô nhập liệu sẽ tụt xuống `h-7` cùng với các hàng — và đó là hệ
quả đúng của việc im lặng, không phải một lỗi của luật.

### Ngoại lệ và nhầm lẫn

- **Đừng rắc khai báo lên mọi lớp bọc.** Một vùng khai báo một lần, ở chỗ nó bắt đầu:

  ```tsx
  {/* SAI */}
  <section className="[--density:2]">
    <div className="[--density:2]">
      <div className="[--density:2]">…</div>
    </div>
  </section>
  ```

- **`DENSITY-2` không phải là chỗ trú của sự lười.** Nó là mặc định khi **phân vân**, không phải mặc
  định khi **chưa hỏi**. Nếu người đọc rõ ràng đang quét hai trăm dòng, đó là `DENSITY-3`.
- **Sàn cảm ứng đẩy một vùng lên `DENSITY-2`:**

  ```tsx
  {/* SAI — hàng chọn bằng ngón tay mà cao 28px */}
  <li className="flex h-7 items-center px-2">Giao hàng tiêu chuẩn</li>
  ```

  ```tsx
  {/* ĐÚNG */}
  <li className="flex h-9 items-center px-3">Giao hàng tiêu chuẩn</li>
  ```

---

## `DENSITY-3` — chặt, cho danh sách dài và bảng

### Trường hợp: bảng dữ liệu

```tsx
<div className="[--density:3] flex flex-col gap-3">
  <h2 className="font-medium">Giao dịch</h2>
  <table className="w-full text-left">
    <thead className="border-b">
      <tr>
        <th className="px-2 py-1 text-sm font-medium text-neutral-500">Mã</th>
        <th className="px-2 py-1 text-sm font-medium text-neutral-500">Khách hàng</th>
        <th className="px-2 py-1 text-right text-sm font-medium text-neutral-500">Số tiền</th>
      </tr>
    </thead>
    <tbody className="divide-y">
      {rows.map((row) => (
        <tr key={row.id}>
          <td className="px-2 py-1 tabular-nums">{row.code}</td>
          <td className="px-2 py-1">{row.customer}</td>
          <td className="px-2 py-1 text-right tabular-nums">{row.amount}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Trường hợp: danh sách dài có ảnh đại diện và hành động

```tsx
<ul className="[--density:3] divide-y rounded-lg border">
  {members.map((member) => (
    <li className="flex items-center justify-between p-2" key={member.id}>
      <span className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-neutral-100 text-xs">
          {member.initials}
        </span>
        <span>{member.name}</span>
      </span>
      <button className="inline-flex h-7 items-center gap-2 rounded-md border px-2 text-sm" type="button">
        <svg aria-hidden="true" className="size-3.5" />
        Sửa
      </button>
    </li>
  ))}
</ul>
```

`size-8`, `h-7`, `size-3.5`, `p-2` — cả bốn đều đến từ **một** quyết định ở `ul`, không phải bốn lần
chọn riêng lẻ.

### Trường hợp: lệnh bảng màu

```tsx
<div className="[--density:3] flex flex-col gap-2 rounded-lg border p-2">
  <input aria-label="Tìm lệnh" className="h-7 rounded-md border px-2" />
  <ul role="listbox">
    <li className="flex items-center gap-2 rounded-md p-2" role="option">
      <svg aria-hidden="true" className="size-3.5" />
      Tạo dự án mới
    </li>
    <li className="flex items-center gap-2 rounded-md p-2" role="option">
      <svg aria-hidden="true" className="size-3.5" />
      Mời thành viên
    </li>
  </ul>
</div>
```

### Trường hợp: cây thư mục ở thanh bên

```tsx
<nav className="[--density:3] flex flex-col">
  <a className="flex h-7 items-center gap-2 rounded-md px-2 text-sm" href="#a">
    <svg aria-hidden="true" className="size-3.5" />
    src
  </a>
  <a className="flex h-7 items-center gap-2 rounded-md pl-6 pr-2 text-sm" href="#b">
    <svg aria-hidden="true" className="size-3.5" />
    index.ts
  </a>
</nav>
```

### Trường hợp: thanh công cụ toàn biểu tượng

```tsx
<div className="[--density:3] flex items-center gap-2 rounded-md border p-2">
  <button aria-label="In đậm" className="grid size-7 place-items-center rounded" type="button">
    <svg aria-hidden="true" className="size-3.5" />
  </button>
  <button aria-label="In nghiêng" className="grid size-7 place-items-center rounded" type="button">
    <svg aria-hidden="true" className="size-3.5" />
  </button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Chặt không phải là bớt thông tin.** Bỏ một cột đi là quyết định về mức độ hé lộ, không phải về mật
  độ:

  ```tsx
  {/* SAI — gọi là "compact" nhưng thực chất là giấu dữ liệu */}
  <td className="px-2 py-1">{row.code}</td>
  {/* cột "Khách hàng" bị xoá khỏi bảng */}
  ```

- **Phần tử chồng lớp thừa hưởng vùng đã mở nó, không phải lớp nó nằm trong.** Trình đơn mở ra từ một trang thoáng
  vẫn thoáng:

  ```tsx
  <section className="[--density:1] flex flex-col gap-6">
    <button className="h-11 rounded-md border px-4" type="button">Tuỳ chọn</button>
    <div className="rounded-lg border p-4" role="menu">
      <button className="flex h-11 w-full items-center gap-2 px-4 text-left" role="menuitem" type="button">
        <svg aria-hidden="true" className="size-5" />
        Chia sẻ
      </button>
    </div>
  </section>
  ```

  Nếu **nội dung** phần tử chồng lớp tự nó là một danh sách dài để quét, nó khai báo `DENSITY-3` vì lý do đó,
  không phải vì nó là phần tử chồng lớp.

- **Sàn cảm ứng.** Danh sách chọn bằng ngón tay không xuống `DENSITY-3` chỉ vì nó dài.
- **Điểm ngắt không đổi mật độ.** Chỉ khi **công việc** đổi thì mật độ mới đổi:

  ```tsx
  {/* SAI — hẹp lại thì đổi mật độ */}
  <ul className="[--density:2] sm:[--density:3]">…</ul>
  ```

  ```tsx
  {/* ĐÚNG — bảng để so sánh trên màn rộng, chồng bản ghi để đọc từng cái trên màn hẹp */}
  <div className="[--density:2] flex flex-col gap-3 lg:hidden">…từng bản ghi một…</div>
  <div className="[--density:3] hidden lg:block">…bảng so sánh…</div>
  ```

- **Đừng dùng `DENSITY-3` để nhét thêm nội dung lên đầu trang.** "Hiển thị thêm nội dung trong màn hình đầu tiên" là ý muốn
  về bố cục, không phải bằng chứng về công việc của người đọc.

---

## Ánh xạ yêu cầu sang một mã

Nêu ngữ cảnh, vùng và công việc của người đọc. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu
cụ thể rồi dừng. Câu trả lời phải là một mã hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Dựng bảng giao dịch có sắp xếp và phân trang | Người đọc so sánh nhiều dòng cùng hình dạng | `DENSITY-3` | `[--density:3]`, ô `px-2 py-1` |
| Dựng khối giá cho trang bán hàng | Một quyết định, không có gì để so sánh chi tiết | `DENSITY-1` | `[--density:1]`, thành phần điều khiển `h-11 px-4` |
| Dựng biểu mẫu cài đặt tài khoản sáu trường | Việc phải làm, số trường không do dữ liệu quyết định | `DENSITY-2` | `[--density:2]`, thành phần điều khiển `h-9 px-3` |
| Viết một hàng danh sách dùng lại ở nhiều trang | Hàng không biết ngữ cảnh của mình | `DENSITY-0` | không khai báo class CSS |
| Nhúng biểu mẫu mời thành viên vào cuối bảng thành viên | Việc phải làm nằm trong vùng để quét | `DENSITY-2` | `[--density:2]` khai báo lại thành lời |
| Dựng trình đơn bật ra từ nút trên trang giới thiệu | Phần tử chồng lớp theo vùng đã mở nó | `DENSITY-0` | không khai báo; thừa hưởng `1` |
| Dựng danh sách chọn phương thức giao hàng cho thiết bị di động | Bấm bằng ngón tay ⇒ sàn cảm ứng | `DENSITY-2` | `[--density:2]`, hàng `h-9` |
| Dựng gốc ứng dụng | Không có gì để thừa hưởng | `DENSITY-2` | `[--density:2]` trên nút DOM gốc |
| Hiện danh sách mười thông báo trên trang chủ | Chưa nêu người đọc quét hay đọc từng cái ⇒ lấy mặc định | `DENSITY-2` | `[--density:2]` |

Ở dòng cuối, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ cần một trong hai:
*"Người đọc ở đây tìm một thông báo trong nhiều thông báo, hay đọc lần lượt từng cái?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `DENSITY-0` / `DENSITY-2` | Cây con này **tiếp tục thừa hưởng**, hay **đặt lại** bất kể bên ngoài là gì? |
| `DENSITY-1` / `DENSITY-2` | Người đọc đang **đọc/bị thuyết phục**, hay đang **thao tác**? |
| `DENSITY-2` / `DENSITY-3` | Người đọc đang **đọc lần lượt**, hay đang **so sánh giữa các dòng**? |
| `DENSITY-3` / sàn cảm ứng | Các thành phần này có được bấm bằng ngón tay không? |
| `DENSITY-0` / gốc | Có ngữ cảnh nào ở trên để thừa hưởng không? |
| Mọi ranh giới | Số lượng thành phần do **dữ liệu** quyết định hay do **thiết kế** quyết định? |

## Sai lầm lặp lại nhiều nhất

1. Thêm thuộc tính truyền vào `size` / `dense` / `compact` cho thành phần, rồi thêm giá trị mới cho mỗi nơi sử dụng.
2. Chọn mật độ bằng mắt: thấy chật thì nới, thấy trống thì bóp.
3. Vùng lồng có công việc khác nhưng không khai báo lại, rồi đi bù trừ từng phần tử một.
4. Im lặng ở chỗ đáng lẽ phải **đặt lại thành lời** — nhầm `DENSITY-0` với `DENSITY-2`.
5. Không khai báo gì ở gốc, rồi ngạc nhiên vì không có gì để thừa hưởng.
6. Rắc khai báo lên mọi lớp bọc thay vì một lần ở chỗ vùng bắt đầu.
7. Đổi mật độ theo điểm ngắt dù công việc của vùng không đổi.
8. Gọi việc bỏ bớt cột là "compact".
9. Dùng mật độ để lấy khoảng trắng giữa hai phần nội dung — đó là việc của luật quan hệ.
10. Kéo vùng chạm xuống dưới ngưỡng tối thiểu nhân danh `DENSITY-3`.
11. Viết `[--density:0]` thay vì bỏ hẳn class CSS.
12. Khung chờ dùng mật độ khác nội dung thật, làm bố cục nhảy khi tải xong.
