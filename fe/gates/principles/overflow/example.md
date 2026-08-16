---
id: fe-principles-overflow-example
title: example.md
slug: /gates/principles/overflow/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã OVERFLOW-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `overflow` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một khai báo duy nhất.

Hai class CSS xuất hiện khắp nơi dưới đây và không phải để trang trí: `min-w-0` và `min-h-0` là điều kiện
để `truncate` và để cuộn **có tác dụng gì đó**. Thiếu chúng, khai báo vẫn nằm trong mã, vẫn qua
đánh giá, và vẫn không làm gì cả.

---

## `OVERFLOW-0` — không khai báo

### Trường hợp: nhãn trạng thái lấy từ tập đóng

```tsx
<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Đã thanh toán</span>
```

Bốn nhãn có thể có — *Nháp, Chờ thanh toán, Đã thanh toán, Đã huỷ* — đều nằm trong tầm kiểm soát và
đều ngắn. Không có dữ liệu thật nào làm vỡ ô này.

### Trường hợp: phần trăm tiến độ

```tsx
<div className="flex items-center gap-2">
  <div className="h-2 flex-1 rounded-full bg-neutral-200">
    <div className="h-2 w-[68%] rounded-full bg-neutral-900" />
  </div>
  <span className="text-sm tabular-nums text-neutral-500">68%</span>
</div>
```

Bề rộng lớn nhất của ô số là `100%` và biết trước, nên nó không cần khai gì — nhưng nó **cũng không
được** co lại, nên phần này còn một mã thứ hai, xem `OVERFLOW-6`.

### Trường hợp: chữ viết tắt trong ảnh đại diện

```tsx
<span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
```

### Trường hợp: số thứ tự và tổng số câu

```tsx
<span className="text-xs tabular-nums text-neutral-500">Câu 3 / 10</span>
```

### Ngoại lệ và nhầm lẫn

- **Nhãn tập đóng nhưng đa ngôn ngữ thì không còn đóng.** Nếu chuỗi này đến từ một bảng dịch mở, nó là
  `OVERFLOW-1` ở mọi ngôn ngữ, kể cả ngôn ngữ mà nó đang ngắn.

  ```tsx
  {/* SAI khi nhãn đến từ bảng dịch mở */}
  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{t(status)}</span>

  {/* ĐÚNG */}
  <span className="max-w-32 truncate rounded-full bg-neutral-100 px-2 py-0.5 text-xs" title={t(status)}>
    {t(status)}
  </span>
  ```

- **Số tiền không phải `OVERFLOW-0`.** Bề rộng của nó không suy ra được từ định dạng; nó là
  `OVERFLOW-3`.
- **Đừng phòng thủ chỗ không có rủi ro:**

  ```tsx
  {/* SAI — truncate trên một giá trị hai chữ số */}
  <span className="truncate tabular-nums">68%</span>
  ```

  Khai báo thừa dạy người đọc sau rằng ô này có thể dài, và họ sẽ thiết kế theo giả định đó.

---

## `OVERFLOW-1` — một dòng, cắt đuôi

### Trường hợp: tên khoá học trong thẻ

```tsx
<div className="rounded-lg border p-4">
  <h3 className="truncate font-medium" title="Kiến trúc hệ thống phân tán cho ứng dụng nhiều vùng">
    Kiến trúc hệ thống phân tán cho ứng dụng nhiều vùng
  </h3>
</div>
```

### Trường hợp: tên tệp trong hàng đính kèm

```tsx
<li className="flex items-center gap-2 p-3">
  <svg aria-hidden="true" className="size-4 shrink-0" />
  <span className="min-w-0 flex-1 truncate">bao-cao-tai-chinh-quy-4-ban-cuoi-da-duyet.pdf</span>
  <span className="shrink-0 text-xs tabular-nums text-neutral-500">2,4 MB</span>
</li>
```

`min-w-0 flex-1` không phải trang trí: thiếu nó, ô tên **không cắt** mà đẩy dung lượng tệp ra khỏi
hàng. Đây là `OVERFLOW-1` lồng trong `OVERFLOW-6`.

### Trường hợp: thư điện tử trong hàng thành viên, có đường lấy lại

```tsx
<a className="block truncate text-sm text-neutral-500" href="/members/482" title="nguyen.van.an.long@example-organisation.com">
  nguyen.van.an.long@example-organisation.com
</a>
```

Cắt hợp lệ vì cả hàng bấm được và trang chi tiết hiện giá trị đủ.

### Trường hợp: dòng chủ đề trong hộp thư

```tsx
<div className="flex min-w-0 flex-col gap-1">
  <span className="truncate font-medium">Xác nhận lịch phỏng vấn vòng hai vào sáng thứ Năm</span>
  <span className="truncate text-sm text-neutral-500">Chào bạn, mình gửi lại lịch đã chốt cùng đường dẫn phòng họp…</span>
</div>
```

### Trường hợp: đường dẫn phân cấp giữa bị cắt, hai đầu giữ nguyên

```tsx
<nav className="flex min-w-0 items-center gap-1 text-sm">
  <a className="shrink-0 text-neutral-500" href="/">Trang chủ</a>
  <span className="shrink-0 text-neutral-300">/</span>
  <a className="min-w-0 truncate text-neutral-500" href="/c/482">Kiến trúc hệ thống phân tán cho ứng dụng nhiều vùng</a>
  <span className="shrink-0 text-neutral-300">/</span>
  <span className="shrink-0 font-medium">Bài 12</span>
</nav>
```

Mắt xích cuối là chỗ người đọc đang đứng và mắt xích đầu là chỗ họ quay về; chỉ mắt xích giữa được
phép mất chi tiết.

### Ngoại lệ và nhầm lẫn

- **Cắt mà không có đường lấy lại là xoá dữ liệu:**

  ```tsx
  {/* SAI — không tooltip, không link, không trang chi tiết */}
  <span className="truncate">{member.email}</span>
  ```

- **`truncate` trên con của một hàng flex mà thiếu `min-w-0` là không có tác dụng:**

  ```tsx
  {/* SAI */}
  <div className="flex items-center gap-2">
    <span className="flex-1 truncate">{course.title}</span>
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Tiếp tục</button>
  </div>

  {/* ĐÚNG */}
  <div className="flex items-center gap-2">
    <span className="min-w-0 flex-1 truncate">{course.title}</span>
    <button className="shrink-0 rounded-md border px-3 py-2 text-sm" type="button">Tiếp tục</button>
  </div>
  ```

- **Cắt cứng không dấu hiệu bị cấm.** Che phần thừa mà không để lại dấu ba chấm là mất dữ liệu im lặng:

  ```tsx
  {/* SAI */}  <span className="block h-6 overflow-hidden whitespace-nowrap">{title}</span>
  {/* ĐÚNG */} <span className="block truncate" title={title}>{title}</span>
  ```

- **Số tiền cạnh tên vẫn không được cắt.** Một hàng có hai mã là chuyện bình thường:

  ```tsx
  <div className="flex items-baseline gap-2">
    <span className="min-w-0 flex-1 truncate">{transaction.description}</span>
    <span className="shrink-0 break-words tabular-nums">{transaction.amount}</span>
  </div>
  ```

- **Khung chờ phải hứa đúng hình dạng:**

  ```tsx
  {/* SAI — khung chờ hai dòng cho một ô sẽ cắt một dòng */}
  <span className="block h-9 w-full rounded bg-neutral-200" />
  {/* ĐÚNG */}
  <span className="block h-5 w-56 rounded bg-neutral-200" />
  ```

---

## `OVERFLOW-2` — giới hạn dòng theo số dòng

### Trường hợp: mô tả khoá học trong lưới thẻ

```tsx
<article className="flex flex-col gap-2 rounded-lg border p-4">
  <h3 className="truncate font-medium">Thiết kế hệ thống chịu tải</h3>
  <p className="line-clamp-3 text-sm text-neutral-500">
    Khoá học đi từ ràng buộc kinh doanh tới lựa chọn kiến trúc: giới hạn nhất quán, chiến lược nhân bản,
    hàng đợi, và cách đo một thay đổi trước khi đưa lên môi trường thật.
  </p>
  <a className="text-sm underline" href="/c/482">Xem chi tiết</a>
</article>
```

Giới hạn dòng ở đây có giá trị nghiệp vụ: nó giữ mọi thẻ trong lưới cùng chiều cao nên người đọc **so sánh
được** — và đường dẫn ngay dưới là chỗ đọc đủ.

### Trường hợp: nội dung đánh giá trong danh sách

```tsx
<li className="flex flex-col gap-2 p-4">
  <div className="flex items-center gap-2">
    <strong className="min-w-0 truncate">Mai Lê</strong>
    <span className="shrink-0 text-sm text-neutral-500">★ 5</span>
  </div>
  <p className="line-clamp-2 text-sm">
    Phần nói về retry giải thích trade-off bằng một tình huống hỏng thật, nên mình hiểu vì sao
    idempotency phải có trước khi chọn thư viện.
  </p>
</li>
```

### Trường hợp: giới hạn dòng mở ra được — mã đổi khi mở

```tsx
<div className="flex flex-col gap-2">
  <p className={expanded ? "text-sm" : "line-clamp-4 text-sm"}>{review.body}</p>
  <button className="self-start text-sm underline" onClick={toggle} type="button">
    {expanded ? "Thu gọn" : "Đọc thêm"}
  </button>
</div>
```

Khi mở, vùng này là `OVERFLOW-7`: nó dài ra và trang cuộn. Nó **không** đổi thành một hộp có trần.

### Trường hợp: xem trước tin nhắn trong hộp thư

```tsx
<p className="line-clamp-2 text-sm text-neutral-500">{thread.lastMessage}</p>
```

### Ngoại lệ và nhầm lẫn

- **`line-clamp-1` là `truncate` mặc áo nặng hơn:**

  ```tsx
  {/* SAI */}  <p className="line-clamp-1">{title}</p>
  {/* ĐÚNG */} <p className="truncate" title={title}>{title}</p>
  ```

- **Nội dung chính của trang đọc không được giới hạn dòng:**

  ```tsx
  {/* SAI — người ta vào đây để đọc */}
  <article className="line-clamp-6 prose">{post.body}</article>
  {/* ĐÚNG */}
  <article className="prose">{post.body}</article>
  ```

- **Giới hạn dòng không thay được cuộn khi phần thừa đáng giữ.** Một khung hội thoại `line-clamp-10` là vứt bỏ
  các tin nhắn cũ, không phải giấu chúng.
- **Đừng đổi số dòng theo khung nhìn để "cho đẹp":**

  ```tsx
  {/* SAI — số dòng là quyết định nghiệp vụ, không phải biến trang trí */}
  <p className="line-clamp-2 text-sm md:line-clamp-5 xl:line-clamp-7">{course.summary}</p>
  ```

  Nếu "đủ để chọn" thật sự khác nhau giữa thiết bị di động và máy tính, đó là một quyết định phải nói ra, không
  phải một hệ quả của bề rộng màn hình.

---

## `OVERFLOW-3` — buộc phải xuống dòng

### Trường hợp: số tiền trong hàng giao dịch

```tsx
<div className="flex items-baseline justify-between gap-3">
  <span className="min-w-0 flex-1 truncate text-sm">Gia hạn gói năm</span>
  <span className="shrink-0 whitespace-nowrap tabular-nums">12.990.000đ</span>
</div>
```

Số tiền vừa không được cắt, vừa không được xuống dòng giữa chừng — nên nó giữ nguyên bề rộng của mình
và bên trái là bên nhường.

### Trường hợp: mã đơn hàng người đọc phải đọc đúng từng ký tự

```tsx
<div className="flex flex-col gap-1">
  <span className="text-sm text-neutral-500">Mã đơn</span>
  <code className="break-all rounded bg-neutral-100 px-2 py-1 text-sm">ORD-2026-08-16-9F3A7C21B</code>
</div>
```

### Trường hợp: URL người dùng dán vào

```tsx
<p className="break-all text-sm text-neutral-600">
  https://example-organisation.com/reports/2026/quarter-four/final-approved-version-with-appendix
</p>
```

Chuỗi này không có khoảng trắng nào, nên nó phải được phép gãy **giữa từ**; chỉ cho phép gãy ở khoảng
trắng thì nó vẫn đẩy vỡ cột.

### Trường hợp: thông báo lỗi — đuôi câu là phần mang thông tin

```tsx
<div className="rounded-md border border-red-200 bg-red-50 p-3">
  <p className="break-words text-sm text-red-800">
    Không thể xác thực khoá API: khoá đã bị thu hồi lúc 09:12 ngày 16/08/2026 bởi quản trị viên workspace.
  </p>
</div>
```

### Trường hợp: địa chỉ ví trong trang chi tiết

```tsx
<dl className="flex flex-col gap-1">
  <dt className="text-sm text-neutral-500">Địa chỉ nhận</dt>
  <dd className="break-all font-mono text-sm">0x7a3f9c21b48e5d0a6c7f1e93b2d84a05f6c3e7b9</dd>
</dl>
```

### Ngoại lệ và nhầm lẫn

- **Cắt một con số là tạo ra một con số khác:**

  ```tsx
  {/* SAI */}  <span className="truncate tabular-nums">1.299.000đ</span>
  ```

  Không có dấu hiệu nào cho người đọc biết `1.299` là phần đầu của một số lớn hơn — họ đọc được một
  giá trị **sai**, không phải một giá trị thiếu.

- **Bảng thì không phải mã này.** Một khối có cấu trúc cột không xuống dòng được:

  ```tsx
  {/* SAI — ép bảng xuống dòng làm lệch cột */}
  <table className="w-full break-all">…</table>
  ```

  Xem `OVERFLOW-5`.

- **`break-words` và `break-all` không thay thế nhau.** `break-words` giữ từ nguyên vẹn và chỉ gãy khi
  một từ dài hơn cả dòng; `break-all` gãy ở bất kỳ đâu và chỉ dành cho chuỗi máy đọc.

  ```tsx
  {/* SAI — câu tiếng Việt bị gãy giữa từ, đọc rất khó */}
  <p className="break-all text-sm">{error.message}</p>
  ```

- **Trong hàng flex, phần `OVERFLOW-3` là phần giữ, không phải phần nhường:**

  ```tsx
  {/* SAI — số tiền bị bóp */}
  <div className="flex items-baseline gap-2">
    <span className="flex-1">{description}</span>
    <span className="min-w-0 flex-1 truncate tabular-nums">{amount}</span>
  </div>
  ```

---

## `OVERFLOW-4` — hộp cuộn theo chiều dọc

### Trường hợp: thân hộp thoại — phần cuối hành động luôn phải thấy

```tsx
<div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border bg-white shadow-lg">
  <header className="shrink-0 border-b p-4">
    <h2 className="font-medium">Chọn thành viên</h2>
  </header>
  <div className="min-h-0 flex-1 overflow-y-auto p-4">
    <ul className="flex flex-col gap-2">
      {members.map((member) => (
        <li className="flex items-center gap-2" key={member.id}>
          <input type="checkbox" />
          <span className="min-w-0 flex-1 truncate">{member.email}</span>
        </li>
      ))}
    </ul>
  </div>
  <footer className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Thêm</button>
  </footer>
</div>
```

Ba thứ phải cùng có mặt để hình này đứng được: bề mặt giữ `max-h` và bo góc; hộp bên trong giữ cuộn;
`min-h-0` giải phóng chiều cao tối thiểu của một phần tử con flex, thiếu nó thì hộp giữa **nở ra theo nội
dung** và phần cuối bị đẩy khỏi màn hình thay vì cuộn.

### Trường hợp: danh sách gợi ý của ô tìm kiếm

```tsx
<div className="relative">
  <input aria-label="Tìm kiếm" className="w-full rounded-md border px-3 py-2" />
  <div className="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-md border bg-white shadow-lg">
    <ul className="max-h-72 overflow-y-auto overscroll-contain">
      {results.map((result) => (
        <li className="truncate px-3 py-2 text-sm" key={result.id}>{result.label}</li>
      ))}
    </ul>
  </div>
</div>
```

`overscroll-contain` chặn việc cuộn hết đáy danh sách rồi trang nền cuộn tiếp — người đọc mất chỗ đứng
mà không hiểu vì sao. `overflow-hidden` ở lớp ngoài chỉ để bo góc ăn vào hàng đầu và hàng cuối; nó
**không** phải khai báo tràn nội dung của nội dung.

### Trường hợp: khung hội thoại — phần thừa đáng giữ

```tsx
<div className="flex h-[32rem] flex-col rounded-lg border">
  <div className="min-h-0 flex-1 overflow-y-auto">
    <ol className="flex flex-col gap-3 p-4">
      {messages.map((message) => (
        <li className="flex flex-col gap-1" key={message.id}>
          <span className="text-xs tabular-nums text-neutral-500">{message.at}</span>
          <p className="break-words text-sm">{message.body}</p>
        </li>
      ))}
    </ol>
  </div>
  <div className="flex shrink-0 items-center gap-2 border-t p-3">
    <input aria-label="Nội dung" className="min-w-0 flex-1 rounded-md border px-3 py-2" />
    <button className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Gửi</button>
  </div>
</div>
```

### Trường hợp: bảng dài có hàng tiêu đề dính vào nội dung

```tsx
<div className="max-h-96 overflow-y-auto rounded-lg border">
  <table className="w-full text-sm">
    <thead className="sticky top-0 bg-white">
      <tr className="border-b">
        <th className="px-3 py-2 text-left font-medium">Bài học</th>
        <th className="px-3 py-2 text-right font-medium">Thời lượng</th>
      </tr>
    </thead>
    <tbody className="divide-y">
      {lessons.map((lesson) => (
        <tr key={lesson.id}>
          <td className="max-w-0 truncate px-3 py-2">{lesson.title}</td>
          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{lesson.duration}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

Hàng tiêu đề nằm **trong** hộp cuộn là đúng: nó thuộc về bảng đang cuộn, không phải thuộc về khung.
Một phần cuối hành động của khung thì ngược lại — nó thuộc về khung và phải nằm ngoài.

### Ngoại lệ và nhầm lẫn

- **Cuộn đặt thẳng lên bề mặt thì khoảng đệm trong của bề mặt cuộn mất trước tiên:**

  ```tsx
  {/* SAI */}
  <div className="max-h-96 overflow-y-auto rounded-lg border p-4 shadow">…</div>

  {/* ĐÚNG */}
  <div className="flex max-h-96 flex-col rounded-lg border shadow">
    <div className="min-h-0 flex-1 overflow-y-auto p-4">…</div>
  </div>
  ```

- **Thiếu `min-h-0` là hỏng im lặng:**

  ```tsx
  {/* SAI — hộp giữa nở theo nội dung, không bao giờ cuộn */}
  <div className="flex h-96 flex-col">
    <div className="flex-1 overflow-y-auto">…</div>
    <footer className="border-t p-3">…</footer>
  </div>
  ```

- **Hai trần trên một chuỗi là hai thanh cuộn:**

  ```tsx
  {/* SAI */}
  <div className="max-h-96 overflow-y-auto">
    <div className="max-h-80 overflow-y-auto">…</div>
  </div>
  ```

- **`overflow-y-scroll` cố định không phải cách chống nhảy bố cục.** Nó vẽ một máng cuộn rỗng ở mọi
  trạng thái, kể cả khi danh sách chỉ có hai dòng, và nói dối rằng còn nội dung phía dưới.
- **Một danh sách trên trang, không có gì cần luôn hiển thị, là `OVERFLOW-7`:**

  ```tsx
  {/* SAI — tạo thanh cuộn thứ hai lồng trong thanh cuộn của trang */}
  <section className="max-h-[40rem] overflow-y-auto">…kết quả tìm kiếm…</section>
  ```

---

## `OVERFLOW-5` — khung cuộn ngang

### Trường hợp: bảng nhiều cột trên màn hẹp

```tsx
<div className="min-w-0">
  <div className="overflow-x-auto rounded-lg border">
    <table className="w-full min-w-[48rem] text-sm">
      <thead>
        <tr className="border-b bg-neutral-50">
          <th className="px-3 py-2 text-left font-medium">Giao dịch</th>
          <th className="px-3 py-2 text-left font-medium">Phương thức</th>
          <th className="px-3 py-2 text-left font-medium">Thời điểm</th>
          <th className="px-3 py-2 text-right font-medium">Số tiền</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="whitespace-nowrap px-3 py-2">{row.description}</td>
            <td className="whitespace-nowrap px-3 py-2">{row.method}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{row.at}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

`min-w-[48rem]` là bề rộng tối thiểu **thật** của bảng — nó nói rằng bốn cột này không rút xuống dưới
mức đó mà vẫn đọc được. `min-w-0` ở lớp ngoài là điều kiện để cột chứa nó chịu hẹp lại; thiếu nó, cả
cột nở ra và trang cuộn ngang thay vì bảng.

### Trường hợp: đoạn mã

```tsx
<pre className="overflow-x-auto rounded-lg border bg-neutral-950 p-4 text-sm text-neutral-100">
  <code>{snippet}</code>
</pre>
```

Ở đây bề mặt và khung cuộn trùng nhau một cách hợp lệ vì khoảng đệm trong nằm trên **cả hai trục** của một khối
mà người đọc chấp nhận trượt — nhưng nếu khối này có phần đầu riêng (tên tệp, nút sao chép), phần đầu đó
phải nằm ngoài khung cuộn.

### Trường hợp: dải nhãn nhỏ lọc, có điểm dừng

```tsx
<div className="-mx-4 overflow-x-auto px-4">
  <div className="flex w-max items-center gap-2">
    {topics.map((topic) => (
      <button className="shrink-0 rounded-full border px-3 py-1 text-sm" key={topic.id} type="button">
        {topic.label}
      </button>
    ))}
  </div>
</div>
```

`w-max` để hàng lấy đúng bề rộng nội dung thay vì bị bó vào bề rộng cột; `shrink-0` để các nhãn nhỏ không
tự bóp lại thành một hàng chật chội thay vì trượt.

### Trường hợp: dải ảnh nhỏ với vệt mờ ở mép

```tsx
<div className="relative">
  <div className="overflow-x-auto">
    <div className="flex w-max gap-2">
      {shots.map((shot) => (
        <img alt="" className="h-24 w-40 shrink-0 rounded-md object-cover" key={shot.id} src={shot.src} />
      ))}
    </div>
  </div>
  <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white" />
</div>
```

Vệt mờ ở đây không phải hiệu ứng: nó là **tín hiệu** rằng còn nội dung bên phải, và nó bắt buộc nếu
thanh cuộn bị ẩn.

### Ngoại lệ và nhầm lẫn

- **Phần thân cuộn ngang là hỏng, không phải một cách hiển thị:**

  ```tsx
  {/* SAI — bảng đẩy rộng cả trang */}
  <table className="min-w-[48rem]">…</table>
  ```

  Bảng phải nằm trong một khung có `overflow-x-auto`, và khung đó phải nằm trong một cột **được phép
  hẹp lại**.

- **Khung cuộn trong một cột lưới mà thiếu `minmax(0,1fr)` thì cột nở theo nội dung:**

  ```tsx
  {/* SAI */}  <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">…</div>
  {/* ĐÚNG */} <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">…</div>
  ```

- **Ẩn thanh cuộn mà không trả lại tín hiệu khác là giấu mất khả năng cuộn.** Nếu thanh cuộn bị ẩn thì
  vệt mờ, nút mũi tên hoặc điểm dừng khi trượt trở thành bắt buộc, không phải tuỳ chọn.
- **Cuộn ngang không phải cách chữa cho một hàng thiếu chỗ:**

  ```tsx
  {/* SAI — hàng có một ô co được, đó là OVERFLOW-6 */}
  <div className="flex items-center gap-2 overflow-x-auto">
    <span>{course.title}</span>
    <button type="button">Tiếp tục</button>
  </div>
  ```

- **`overflow-x-auto` không đi kèm bo góc trên chính nó.** Bo góc phải nằm ở lớp ngoài, nếu không mép
  bo bị nội dung trượt cắt ngang.

---

## `OVERFLOW-6` — khai ai nhường trên một hàng

### Trường hợp: hàng danh sách có tiêu đề và hành động

```tsx
<li className="flex items-center gap-3 p-4">
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="truncate font-medium">{lesson.title}</span>
    <span className="truncate text-sm text-neutral-500">{lesson.section}</span>
  </div>
  <button className="shrink-0 rounded-md border px-3 py-2 text-sm" type="button">Tiếp tục</button>
</li>
```

### Trường hợp: phần đầu thẻ có tiêu đề và nhãn trạng thái trạng thái

```tsx
<header className="flex items-start justify-between gap-3">
  <h3 className="min-w-0 flex-1 truncate font-medium">{project.name}</h3>
  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Chờ duyệt</span>
</header>
```

Nhãn trạng thái là `OVERFLOW-0` ở ô của nó và là **bên giữ** ở hàng này. Hai vai trò khác nhau, hai mã khác nhau,
cùng một phần tử.

### Trường hợp: ba phần — biểu tượng giữ, chữ nhường, số giữ

```tsx
<div className="flex items-center gap-3">
  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="truncate font-medium">Nguyễn Văn An</span>
    <span className="truncate text-sm text-neutral-500">nguyen.van.an.long@example-organisation.com</span>
  </div>
  <span className="shrink-0 whitespace-nowrap tabular-nums">1.299.000đ</span>
</div>
```

Ba mã cùng có mặt: hàng là `OVERFLOW-6`; hai dòng chữ là `OVERFLOW-1`; số tiền là `OVERFLOW-3` nên nó
nằm ở vế giữ.

### Trường hợp: hàng có hai bên đều co được — phải phân xử bằng tỷ lệ

```tsx
<div className="flex items-baseline gap-3">
  <span className="min-w-0 flex-[2] truncate font-medium">{book.title}</span>
  <span className="min-w-0 flex-1 truncate text-right text-sm text-neutral-500">{book.author}</span>
</div>
```

Khi cả hai bên đều được phép mất chi tiết, luật vẫn buộc nói rõ **bên nào mất trước** — không có tỷ lệ
thì trình duyệt quyết định, và nó quyết định theo độ dài dữ liệu chứ không theo tầm quan trọng.

### Trường hợp: hàng xuống hàng thay vì cắt — vẫn là một khai báo

```tsx
<div className="flex flex-wrap items-center gap-2">
  {tags.map((tag) => (
    <span className="rounded-full border px-2 py-0.5 text-xs" key={tag}>{tag}</span>
  ))}
</div>
```

Cho phép xuống hàng là một cách khai `OVERFLOW-6` hợp lệ: không ai nhường vì hàng nở thêm dòng. Nó chỉ
đúng khi các phần tử **không có thứ tự đọc theo cột** và số dòng thêm ra không phá bố cục xung quanh.

### Ngoại lệ và nhầm lẫn

- **Không khai gì là để trình duyệt khai hộ, và nó khai sai:**

  ```tsx
  {/* SAI — tên dài đẩy nút ra khỏi hàng */}
  <div className="flex items-center gap-3">
    <span>{course.title}</span>
    <button type="button">Ghi danh</button>
  </div>
  ```

- **`flex-1` không kèm `min-w-0` là khai một nửa** — nửa còn lại là nửa có tác dụng.
- **Đặt `shrink-0` cho tất cả là quay về không có ai nhường:**

  ```tsx
  {/* SAI */}
  <div className="flex items-center gap-3">
    <span className="shrink-0">{course.title}</span>
    <span className="shrink-0">{course.level}</span>
    <button className="shrink-0" type="button">Ghi danh</button>
  </div>
  ```

  Nếu thật sự **không ai** co được thì đây không còn là một hàng có tranh chấp — nó là một khối rộng và
  thuộc `OVERFLOW-5`.

- **Ẩn phần tử trên màn hẹp không phải cách phân xử.** Bỏ hẳn giá hoặc bỏ hẳn hành động trên thiết bị di động là
  một quyết định sản phẩm, không phải một cách thoát khỏi việc khai ai nhường.

---

## `OVERFLOW-7` — không khai, trần thuộc về tổ tiên

### Trường hợp: thân bài viết

```tsx
<article className="flex flex-col gap-4">
  <h1 className="text-2xl font-semibold">Vì sao quorum đọc và ghi không đối xứng</h1>
  <p className="break-words">{post.body}</p>
</article>
```

### Trường hợp: lưới thẻ trên trang danh mục

```tsx
<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {courses.map((course) => (
    <article className="flex flex-col gap-2 rounded-lg border p-4" key={course.id}>
      <h3 className="truncate font-medium">{course.title}</h3>
      <p className="line-clamp-3 text-sm text-neutral-500">{course.summary}</p>
    </article>
  ))}
</section>
```

Lưới là `OVERFLOW-7` — nó dài ra theo số thẻ và trang cuộn. Bên trong mỗi thẻ vẫn có `OVERFLOW-1` và
`OVERFLOW-2` riêng. **Mã áp cho một hộp, không áp cho cả cây.**

### Trường hợp: cột biểu mẫu dài

```tsx
<form className="flex flex-col gap-6">
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="name">Tên hiển thị</label>
    <input className="rounded-md border px-3 py-2" id="name" />
  </div>
  <div className="flex flex-col gap-3">
    <label className="text-sm font-medium" htmlFor="bio">Giới thiệu</label>
    <textarea className="min-h-32 rounded-md border p-3" id="bio" />
  </div>
  <button className="self-start rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Lưu</button>
</form>
```

Nút Lưu ở cuối biểu mẫu dài **không** phải lý do đặt trần: nếu nó thật sự phải luôn thấy thì đó là một
quyết định sản phẩm, và khi đó cả khối chuyển sang `OVERFLOW-4`.

### Trường hợp: hai thanh dọc và vùng giữa — trần nằm ở tổ tiên, không nằm ở đây

```tsx
<div className="grid h-screen grid-cols-[16rem_minmax(0,1fr)_20rem]">
  <aside className="min-h-0 overflow-y-auto border-r">…điều hướng…</aside>
  <main className="min-h-0 overflow-y-auto">
    <div className="flex flex-col gap-6 p-6">…nội dung dài tuỳ ý…</div>
  </main>
  <aside className="min-h-0 overflow-y-auto border-l">…thông tin phụ…</aside>
</div>
```

Ba `OVERFLOW-4` cạnh nhau, mỗi cột một trần **cùng do một tổ tiên duy nhất đặt ra** (`h-screen`), và
nội dung bên trong `main` là `OVERFLOW-7`: nó không khai gì, vì trần đã có chủ.

### Ngoại lệ và nhầm lẫn

- **Đặt trần vào một vùng không cần trần là tạo thanh cuộn thứ hai:**

  ```tsx
  {/* SAI */}  <article className="max-h-[60rem] overflow-y-auto">{post.body}</article>
  {/* ĐÚNG */} <article className="break-words">{post.body}</article>
  ```

- **`h-full` truyền xuống một chuỗi không ai đặt chiều cao là không có tác dụng.** Trần phải có một chủ
  thật sự — khung nhìn, hoặc một tổ tiên có chiều cao xác định.
- **`OVERFLOW-7` không phải "quên khai".** Nó là kết luận rằng vùng này được phép dài ra, và kết luận
  đó phải nói được thành lời khi đánh giá hỏi.
- **`OVERFLOW-0` và `OVERFLOW-7` cùng không phát class CSS nhưng không thay nhau được:**

  ```tsx
  {/* OVERFLOW-0 — không thể tràn */}
  <span className="text-xs tabular-nums">68%</span>
  {/* OVERFLOW-7 — tràn được phép, viewport chịu */}
  <section className="flex flex-col gap-6">{sections}</section>
  ```

---

## Ánh xạ yêu cầu sang một khai báo

Nêu hộp, trục, và độ dài lớn nhất mà dữ liệu thật có thể đạt tới. Nếu thiếu **một** dữ kiện quyết
định, hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao
giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Hiện nhãn trạng thái đơn hàng | Bốn nhãn trong tập đóng, một ngôn ngữ | `OVERFLOW-0` | không class CSS |
| Hiện tên khoá học một dòng trong thẻ | Nhận ra từ đầu chuỗi, có trang chi tiết | `OVERFLOW-1` | `truncate` + `title` |
| Hiện mô tả ngắn trong lưới thẻ để so sánh | Đọc lấy ý, cần đều chiều cao | `OVERFLOW-2` | `line-clamp-3` |
| Hiện số tiền của giao dịch | Cắt là ra một số khác | `OVERFLOW-3` | `whitespace-nowrap tabular-nums` |
| Hiện mã đơn hàng đầy đủ trong cột hẹp | Chuỗi máy đọc, không có khoảng trắng | `OVERFLOW-3` | `break-all` |
| Danh sách chọn trong hộp thoại, nút Thêm luôn thấy | Có anh em phải luôn hiển thị | `OVERFLOW-4` | `min-h-0 flex-1 overflow-y-auto` |
| Gợi ý tìm kiếm không được kéo trang nền | Cuộn trong lớp phủ | `OVERFLOW-4` | `max-h-72 overflow-y-auto overscroll-contain` |
| Bảng bốn cột đọc được trên thiết bị di động | Cấu trúc cột không rút được | `OVERFLOW-5` | `overflow-x-auto` + `min-w-[48rem]` |
| Hàng có tên dài và một nút | Một bên co được, một bên không | `OVERFLOW-6` | `min-w-0 flex-1` · `shrink-0` |
| Trang bài viết hiện toàn bộ nội dung | Không ai ngoài khung nhìn cần chặn | `OVERFLOW-7` | không class CSS |
| Hiện tên người và thư điện tử trong một hàng, cạnh nút | Chưa nói được ai nhường ⇒ hỏi một câu | — | *"Trên màn hẹp, thư điện tử được phép mất chi tiết hay nút được phép biến mất?"* |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `OVERFLOW-0` / `OVERFLOW-1` | Tập giá trị có còn đóng ở **mọi** ngôn ngữ được phát hành không? |
| `OVERFLOW-0` / `OVERFLOW-7` | Tràn ở đây là **không thể**, hay là **được phép** và có người khác chặn? |
| `OVERFLOW-1` / `OVERFLOW-2` | Người đọc nhận ra bản ghi từ đầu chuỗi, hay đang đọc để nắm ý? |
| `OVERFLOW-1` / `OVERFLOW-3` | Bị cắt thì người đọc **thiếu** thông tin hay **hiểu sai** thông tin? |
| `OVERFLOW-2` / `OVERFLOW-4` | Phần thừa đáng vứt tại chỗ, hay đáng giữ để xem tiếp? |
| `OVERFLOW-2` / `OVERFLOW-7` | Màn này để quét hay để đọc? |
| `OVERFLOW-3` / `OVERFLOW-5` | Thứ quá rộng là một chuỗi văn bản hay một khối có cấu trúc cột? |
| `OVERFLOW-4` / `OVERFLOW-7` | Có phần tử nào bên cạnh phải luôn nhìn thấy không? |
| `OVERFLOW-5` / `OVERFLOW-6` | Có phần tử nào trong hàng được phép co lại không? |
| `OVERFLOW-6` / mọi mã ô chữ | Đang quyết định cho **ô chữ** hay cho **hàng chứa nó**? |

## Sai lầm lặp lại nhiều nhất

1. `truncate` trên con của hàng flex mà quên `min-w-0` — mã đúng nhìn, không có tác dụng.
2. Hộp cuộn trong cột flex mà quên `min-h-0` — hộp nở ra, không bao giờ cuộn.
3. Cắt số tiền, mã đơn hoặc mã lỗi.
4. Đặt `overflow-y-auto` lên chính bề mặt, kéo theo khoảng đệm trong và bo góc cuộn mất.
5. Đặt trần lên một vùng `OVERFLOW-7` và sinh ra thanh cuộn thứ hai.
6. Bảng rộng không có khung, làm cả trang cuộn ngang.
7. `line-clamp-1` thay cho `truncate`.
8. Cắt mà không để lại đường lấy lại giá trị đầy đủ.
9. Ẩn thanh cuộn ngang mà không trả lại tín hiệu nào khác.
10. Đổi mã theo khung nhìn dù bản chất nội dung không đổi.
11. Coi `overflow-hidden` để bo góc là đã khai xong tràn nội dung của nội dung bên trong.
