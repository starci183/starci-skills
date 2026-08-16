---
id: fe-principles-typography-example
title: example.md
slug: /fe/principles/typography/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã TYPOGRAPHY-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `typography` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Hai biến thiết kế `text-foreground` và `text-muted-foreground` là **hai tông nội dung** mà mọi chủ đề đều phải
có. Giao diện nào viết chúng thành bậc bảng màu cụ thể thì thay đúng hai cái tên, luật không đổi.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Cuối trang là bảng ánh xạ từ yêu cầu bằng lời sang một công thức, và bảng câu hỏi phân định ranh giới.

---

## `TYPOGRAPHY-1` — tên gốc của trang

### Trường hợp: tên trang của một tuyến trang danh sách

```tsx
<main className="flex flex-col gap-6">
  <h1 className="text-xl font-semibold tracking-tight">Khoá học</h1>
  <section className="flex flex-col gap-3">…</section>
</main>
```

### Trường hợp: tuyến trang chi tiết — tên đối tượng CHÍNH LÀ tên trang

```tsx
<main className="flex flex-col gap-6">
  <h1 className="text-xl font-semibold tracking-tight">System Design Mastery</h1>
  <p className="text-sm leading-5 font-normal text-foreground">
    Lộ trình chuyên sâu cho kỹ sư đã có nền tảng backend.
  </p>
</main>
```

Trên tuyến trang này không còn cái tên nào bao trùm nó nữa, nên nó là gốc dàn ý. Cùng chuỗi ấy nằm trong
danh sách ở tuyến trang chỉ mục thì lại là `TYPOGRAPHY-6` — tuyến trang quyết định, không phải chuỗi.

### Trường hợp: tên trang cạnh một cụm hành động

```tsx
<header className="flex flex-wrap items-center justify-between gap-4">
  <h1 className="text-xl font-semibold tracking-tight">Báo cáo vận hành</h1>
  <div className="flex items-center gap-2">
    <button className="rounded-md border px-3 py-2" type="button">Xuất CSV</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-white" type="button">Tạo báo cáo</button>
  </div>
</header>
```

Hai nhãn nút là `TYPOGRAPHY-11`: chúng không mang class CSS chữ nào, vì thành phần điều khiển đã tự sở hữu chữ của nó.

### Ngoại lệ và nhầm lẫn

- **Một trang không có hai `h1`.** Nếu đang có hai, một trong hai thực ra là phần nội dung hoặc đối tượng
  tiêu đề.

  ```tsx
  {/* SAI: dòng thứ hai không phải gốc dàn ý, nó chỉ là tên một object trong trang */}
  <h1 className="text-xl font-semibold tracking-tight">Khoá học</h1>
  <h1 className="text-xl font-semibold tracking-tight">System Design Mastery</h1>
  ```

- **Đừng lấy `h1` để làm dòng chào mừng to hơn.** `Chào buổi sáng, An` không phải tên tuyến trang.

  ```tsx
  {/* SAI */}  <h1 className="text-xl font-semibold tracking-tight">Chào buổi sáng, An</h1>
  {/* ĐÚNG */} <h1 className="text-xl font-semibold tracking-tight">Bảng điều khiển</h1>
  ```

- **`h1` ẩn về mặt thị giác vẫn là `h1`.** Nếu thiết kế không muốn thấy tên tuyến trang, dùng
  `className="sr-only"` chứ không đổi nó thành `div`, vì dàn ý vẫn cần gốc.

---

## `TYPOGRAPHY-2` — bậc dàn ý đầu tiên

### Trường hợp: hai phần nội dung của một trang

```tsx
<main className="flex flex-col gap-6">
  <h1 className="text-xl font-semibold tracking-tight">Bảng điều khiển</h1>
  <section aria-labelledby="overview" className="flex flex-col gap-3">
    <h2 className="text-base font-semibold" id="overview">Tổng quan</h2>
    <div className="rounded-lg border p-4">…</div>
  </section>
  <section aria-labelledby="activity" className="flex flex-col gap-3">
    <h2 className="text-base font-semibold" id="activity">Hoạt động gần đây</h2>
    <ul className="divide-y rounded-lg border">…</ul>
  </section>
</main>
```

### Trường hợp: phần nội dung có mô tả ngay dưới tên

```tsx
<section className="flex flex-col gap-3">
  <h2 className="text-base font-semibold">Thành viên nhóm</h2>
  <p className="text-sm leading-5 font-normal text-foreground">
    Người có quyền quản trị có thể mời và gỡ thành viên.
  </p>
</section>
```

Dòng mô tả tự đứng được như một dữ kiện nên là `TYPOGRAPHY-7`, không phải nội dung hỗ trợ.

### Trường hợp: `h2` với một con số đếm đi kèm

```tsx
<h2 className="flex items-baseline gap-2 text-base font-semibold">
  Đánh giá học viên
  <span className="text-xs leading-4 font-normal text-muted-foreground">128 đánh giá</span>
</h2>
```

Con số bổ nghĩa cho tên phần nội dung nên nó là `TYPOGRAPHY-9` nằm bên trong tiêu đề; nó không được lấy
`font-semibold` chỉ vì nó ở trong `h2`.

### Ngoại lệ và nhầm lẫn

- **`h2` và tiêu đề đối tượng dùng chung `text-base` nhưng khác độ đậm và khác phần tử:**

  ```tsx
  <h2 className="text-base font-semibold">Nội dung khoá học</h2>
  <div className="text-base font-medium text-foreground">System Design Mastery</div>
  ```

  Cái trên vào dàn ý, cái dưới không. Đổi độ đậm ở đây là đổi luật, không phải đổi thẩm mỹ.

- **Đừng dựng `h2` cho một mốc thời gian.** Đó là `TYPOGRAPHY-10`.
- **Phần nội dung rỗng vẫn giữ `h2`.** Trạng thái rỗng không hạ cấp cái tên:

  ```tsx
  <section className="flex flex-col gap-3">
    <h2 className="text-base font-semibold">Tệp đính kèm</h2>
    <p className="text-sm leading-5 font-normal text-foreground">Chưa có tệp nào được tải lên.</p>
  </section>
  ```

---

## `TYPOGRAPHY-3` — phần con cục bộ

### Trường hợp: hai nhóm nhỏ trong một phần nội dung

```tsx
<section className="flex flex-col gap-4">
  <h2 className="text-base font-semibold">Hồ sơ</h2>
  <div className="flex flex-col gap-3">
    <h3 className="text-sm font-medium">Thông tin cá nhân</h3>
    <div className="rounded-lg border p-4">…</div>
  </div>
  <div className="flex flex-col gap-3">
    <h3 className="text-sm font-medium">Thông tin liên hệ</h3>
    <div className="rounded-lg border p-4">…</div>
  </div>
</section>
```

### Trường hợp: nhóm bộ lọc trong một thanh dọc

```tsx
<aside className="flex flex-col gap-4">
  <h2 className="text-base font-semibold">Bộ lọc</h2>
  <div className="flex flex-col gap-3">
    <h3 className="text-sm font-medium">Cấp độ</h3>
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2"><input type="checkbox" />Nền tảng</label>
      <label className="flex items-center gap-2"><input type="checkbox" />Nâng cao</label>
    </div>
  </div>
</aside>
```

Hai chuỗi `Nền tảng` và `Nâng cao` là `TYPOGRAPHY-11`: chúng là nhãn của hộp kiểm, thành phần điều khiển sở hữu.

### Ngoại lệ và nhầm lẫn

- **`h3` không dùng cho tên một đối tượng dữ liệu.** Tên đối tượng là `TYPOGRAPHY-6`:

  ```tsx
  {/* SAI: đây là tên một bài học, không phải một mục cấu trúc của trang */}
  <h3 className="text-sm font-medium">Đọc và ghi theo cơ chế quorum</h3>
  {/* ĐÚNG */}
  <div className="text-sm font-medium text-foreground">Đọc và ghi theo cơ chế quorum</div>
  ```

- **Không có `h2` ở trên thì chưa được dùng `h3`.** Bỏ bậc là làm hỏng dàn ý, kể cả khi trông vẫn ổn.

---

## `TYPOGRAPHY-4` — bậc dàn ý cuối cùng

### Trường hợp: đủ bốn bậc

```tsx
<main className="flex flex-col gap-6">
  <h1 className="text-xl font-semibold tracking-tight">Thang chấm điểm</h1>
  <section className="flex flex-col gap-4">
    <h2 className="text-base font-semibold">Kỹ năng hệ thống</h2>
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Khả năng mở rộng</h3>
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">Phân vùng dữ liệu</h4>
        <p className="text-sm leading-5 font-normal text-foreground">
          Ứng viên nêu được khoá phân vùng và hệ quả khi khoá lệch.
        </p>
      </div>
    </div>
  </section>
</main>
```

### Trường hợp: `h4` và một dòng nội dung hỗ trợ đứng cạnh nhau

```tsx
<div className="flex flex-col gap-2">
  <h4 className="text-xs font-medium text-muted-foreground">Điều kiện tiên quyết</h4>
  <p className="text-sm leading-5 font-normal text-foreground">Đã hoàn thành hai module nền tảng.</p>
  <p className="text-xs leading-4 font-normal text-muted-foreground">Cập nhật 12 phút trước</p>
</div>
```

Dòng đầu và dòng cuối cùng `text-xs` và cùng giảm nhấn. Cái phân biệt chúng là `font-medium` cộng với
phần tử `h4`: một cái phải nằm trong dàn ý, một cái không được phép nằm trong đó.

### Ngoại lệ và nhầm lẫn

- **Không có bậc thứ năm.** Đây là yêu cầu duy nhất trả lời bằng một câu hỏi:

  ```tsx
  {/* SAI: bậc năm không tồn tại; hãy hỏi tác giả phẳng lại outline */}
  <h5 className="text-xs font-normal text-muted-foreground">Chi tiết nhỏ hơn nữa</h5>
  ```

- **Đừng lấy `h4` để làm nhãn dẫn.** Một chữ nhỏ in hoa ở trên một tiêu đề là chữ bổ nghĩa, không phải
  một bậc dàn ý:

  ```tsx
  {/* SAI */}  <h4 className="text-xs font-medium text-muted-foreground">KHOÁ HỌC MỚI</h4>
  {/* ĐÚNG */} <p className="text-xs leading-4 font-normal text-muted-foreground">Khoá học mới</p>
  ```

---

## `TYPOGRAPHY-5` — đối tượng trội duy nhất

### Trường hợp: thẻ giới thiệu một đối tượng duy nhất

```tsx
<div className="flex flex-col gap-3 rounded-lg border p-4">
  <div className="text-base font-medium text-foreground">Rate limiter</div>
  <p className="text-sm leading-5 font-normal text-foreground">
    Thiết kế bộ giới hạn tần suất chịu được cụm nhiều node.
  </p>
</div>
```

### Trường hợp: khung bên chi tiết

```tsx
<aside className="flex flex-col gap-4 border-l p-4">
  <div className="text-base font-medium text-foreground">bao-cao-quy-4.pdf</div>
  <p className="text-xs leading-4 font-normal text-muted-foreground">PDF · 2,4 MB</p>
</aside>
```

Chỉ có một đối tượng trong khung, và tên tệp ngắn ổn định, nên đủ hai dữ kiện cho `TYPOGRAPHY-5`.

### Trường hợp: hai mã lồng nhau — chủ đạo tiêu đề và nội dung hỗ trợ của nó

```tsx
<section className="flex flex-col gap-3 rounded-lg border p-4">
  <div className="flex flex-col gap-1">
    <div className="text-base font-medium text-foreground">Gói Chuyên sâu</div>
    <p className="text-xs leading-4 font-normal text-muted-foreground">Thanh toán theo năm</p>
  </div>
  <p className="text-sm leading-5 font-normal text-foreground">
    Bao gồm toàn bộ module nâng cao và hai buổi phản hồi mỗi tháng.
  </p>
</section>
```

Ba mã trong một khối: `TYPOGRAPHY-5` cho tên gói, `TYPOGRAPHY-9` cho dòng chỉ có nghĩa nhờ tên gói,
`TYPOGRAPHY-7` cho dòng mô tả tự đứng được. Đây là chỗ luật *một dòng, một quyền sở hữu* nhìn thấy
được: nếu gộp hai dòng dưới thành một cỡ chữ, khối này nói dối rằng chúng cùng loại.

### Ngoại lệ và nhầm lẫn

- **Thiếu một trong hai dữ kiện là rơi xuống phần tử ngang hàng.** Tiêu đề có thể dài ra thì dùng `TYPOGRAPHY-6`,
  ngay cả khi hôm nay nó đang ngắn:

  ```tsx
  {/* SAI: chuỗi này dài ra sau khi dịch, nhưng vẫn đang lấy recipe dominant */}
  <div className="text-base font-medium text-foreground">
    Kết quả kiểm tra năng lực hệ thống phân tán nâng cao
  </div>
  {/* ĐÚNG */}
  <div className="text-sm font-medium text-foreground">
    Kết quả kiểm tra năng lực hệ thống phân tán nâng cao
  </div>
  ```

- **Hai đối tượng trong vùng ⇒ không còn chủ đạo.** Có cái thứ hai ngang hàng là cả hai thành phần tử ngang hàng.
- **Đừng đổi `div` thành `h2` chỉ vì nó là dòng to nhất trong thẻ.** Tiêu đề đối tượng không vào dàn ý.

---

## `TYPOGRAPHY-6` — tiêu đề của phần tử ngang hàng

### Trường hợp: danh sách bài học

```tsx
<ul className="divide-y rounded-lg border">
  {lessons.map((lesson) => (
    <li className="flex items-center justify-between p-4" key={lesson.id}>
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{lesson.title}</span>
        <span className="text-xs leading-4 font-normal text-muted-foreground">{lesson.duration}</span>
      </span>
      <span className="text-sm leading-5 font-normal text-foreground tabular-nums">{lesson.progress}</span>
    </li>
  ))}
</ul>
```

### Trường hợp: lưới mô-đun

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  {modules.map((module) => (
    <article className="flex flex-col gap-2 rounded-lg border p-4" key={module.id}>
      <div className="text-sm font-medium text-foreground">{module.title}</div>
      <p className="text-sm leading-5 font-normal text-foreground">{module.summary}</p>
      <p className="text-xs leading-4 font-normal text-muted-foreground">{module.lessonCount} bài</p>
    </article>
  ))}
</div>
```

### Trường hợp: tiêu đề ngang hàng dài, xuống dòng

```tsx
<div className="flex flex-col gap-1">
  <div className="text-sm font-medium text-foreground">
    Kết quả kiểm tra có tiêu đề dài và vẫn phải quét được theo cùng một nhịp
  </div>
  <p className="text-xs leading-4 font-normal text-muted-foreground">Cập nhật 12 phút trước</p>
</div>
```

### Trường hợp: cùng tiêu đề ngang hàng trên hai bố cục — mã không đổi

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  <div className="text-sm font-medium text-foreground">Idempotency và retry</div>
  <p className="text-xs leading-4 font-normal text-muted-foreground">6 bài · 48 phút</p>
</div>
```

Hàng trên máy tính biến thành cụm xếp dọc trên thiết bị di động. Quyền sở hữu không đổi nên công thức không đổi.

### Ngoại lệ và nhầm lẫn

- **Bố cục rộng ra không thăng cấp phần tử ngang hàng:**

  ```tsx
  {/* SAI: cùng một danh sách, cùng một vai trò, nhưng to lên ở màn rộng */}
  <div className="text-sm font-medium lg:text-base">Đọc và ghi theo cơ chế quorum</div>
  ```

- **Tiêu đề ngang hàng không phải tiêu đề.** Nếu viết thành `h3`, dàn ý của trang sẽ đầy tên dữ liệu và
  người dùng bàn phím nhảy vào một mục lục vô nghĩa.
- **Một câu không phải tiêu đề.** Nếu dòng đó phát biểu một dữ kiện thì nó là `TYPOGRAPHY-7`:

  ```tsx
  {/* SAI */}  <div className="text-sm font-medium text-foreground">Bạn đã hoàn thành 28/42 bài.</div>
  {/* ĐÚNG */} <p className="text-sm leading-5 font-normal text-foreground">Bạn đã hoàn thành 28/42 bài.</p>
  ```

---

## `TYPOGRAPHY-7` — chữ giao diện thường

### Trường hợp: mô tả ngắn trong một thẻ

```tsx
<div className="flex flex-col gap-2 rounded-lg border p-4">
  <div className="text-sm font-medium text-foreground">Các mô hình nhất quán</div>
  <p className="text-sm leading-5 font-normal text-foreground">
    So sánh linearizability và eventual consistency qua các kịch bản lỗi thật.
  </p>
</div>
```

### Trường hợp: một giá trị trong khối tóm tắt

```tsx
<div className="flex items-baseline gap-2">
  <span className="text-sm leading-5 font-normal text-foreground tabular-nums">28/42</span>
  <span className="text-xs leading-4 font-normal text-muted-foreground">bài đã xong</span>
</div>
```

Con số **không** tự thăng cấp vì nó là số. Nó là một dữ kiện trong tóm tắt nên nó là chữ giao diện thường;
dòng đơn vị chỉ có nghĩa nhờ nó nên dòng đơn vị là nội dung hỗ trợ.

### Trường hợp: dòng thông tin trong trang cài đặt

```tsx
<div className="flex flex-col gap-1">
  <p className="text-sm leading-5 font-normal text-foreground">an.nguyen@example.com</p>
  <p className="text-xs leading-4 font-normal text-muted-foreground">Đã xác minh</p>
</div>
```

### Trường hợp: trạng thái rỗng

```tsx
<div className="flex flex-col gap-2 rounded-lg border p-8 text-center">
  <div className="text-sm font-medium text-foreground">Chưa có hoạt động nào</div>
  <p className="text-sm leading-5 font-normal text-foreground">
    Hoàn thành một bài học để bắt đầu chuỗi ngày liên tiếp.
  </p>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Đừng dùng `TYPOGRAPHY-9` cho mọi thứ nhỏ và phụ.** Phép thử là *tách ra còn nghĩa không*:

  ```tsx
  {/* SAI: dòng này tự đứng được, nó không bổ nghĩa cho dòng nào */}
  <p className="text-xs leading-4 font-normal text-muted-foreground">
    Người có quyền quản trị có thể mời và gỡ thành viên.
  </p>
  {/* ĐÚNG */}
  <p className="text-sm leading-5 font-normal text-foreground">
    Người có quyền quản trị có thể mời và gỡ thành viên.
  </p>
  ```

- **`font-medium` không dùng để nhấn mạnh một câu.** Muốn nhấn một cụm trong câu thì dùng `strong`
  trong luồng chữ, không đổi công thức của cả dòng.
- **Ba câu vẫn có thể là `TYPOGRAPHY-7`.** Độ dài không phải tiêu chí; công việc đọc mới là.

---

## `TYPOGRAPHY-8` — văn bản để đọc liên tục

### Trường hợp: nhiều đoạn trong một bài

```tsx
<article className="flex flex-col gap-4">
  <h2 className="text-base font-semibold">Vô hiệu hoá bộ nhớ đệm</h2>
  <p className="text-base leading-6 font-normal text-foreground">
    Cache chỉ đúng khi chiến lược vô hiệu hoá giữ dữ liệu đọc được trong giới hạn nhất quán đã hứa.
  </p>
  <p className="text-base leading-6 font-normal text-foreground">
    Khi giới hạn đó không được viết ra, mỗi lần đọc cũ sẽ bị tranh luận như một sự cố, dù nó nằm đúng
    trong hành vi đã thiết kế.
  </p>
</article>
```

### Trường hợp: văn bản có tiêu đề xen giữa

```tsx
<article className="flex flex-col gap-4">
  <h2 className="text-base font-semibold">Điều khoản dịch vụ</h2>
  <p className="text-base leading-6 font-normal text-foreground">…</p>
  <h3 className="text-sm font-medium">Quyền của người dùng</h3>
  <p className="text-base leading-6 font-normal text-foreground">…</p>
</article>
```

Tiêu đề nhỏ hơn thân bài. Điều đó **không** sai: cấp bậc đến từ quyền sở hữu, không đến từ cỡ chữ, và
thân bài to hơn vì công việc của nó là đọc liên tục.

### Ngoại lệ và nhầm lẫn

- **Đừng lấy `TYPOGRAPHY-8` cho mô tả trong thẻ.** Thẻ là để quét:

  ```tsx
  {/* SAI */}  <p className="text-base leading-6 font-normal text-foreground">6 bài · 48 phút</p>
  {/* ĐÚNG */} <p className="text-sm leading-5 font-normal text-foreground">6 bài · 48 phút</p>
  ```

- **Không có văn bản `font-medium`.** Một đoạn văn in đậm hơn không phải một đoạn văn quan trọng hơn,
  nó chỉ là một đoạn văn khó đọc hơn.

---

## `TYPOGRAPHY-9` — chữ chỉ bổ nghĩa

### Trường hợp: tên định danh dưới tên hiển thị

```tsx
<div className="flex flex-col gap-1">
  <div className="text-sm font-medium text-foreground">Nguyễn Văn An</div>
  <p className="text-xs leading-4 font-normal text-muted-foreground">@an.nguyen</p>
</div>
```

### Trường hợp: đơn vị dưới một con số

```tsx
<div className="flex flex-col gap-1">
  <span className="text-base font-medium text-foreground tabular-nums">68%</span>
  <p className="text-xs leading-4 font-normal text-muted-foreground">tiến độ khoá học</p>
</div>
```

### Trường hợp: dòng gợi ý dưới một trường nhập liệu

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium text-foreground" htmlFor="slug">Đường dẫn</label>
  <div className="flex flex-col gap-1">
    <input className="rounded-md border px-3 py-2" id="slug" />
    <p className="text-xs leading-4 font-normal text-muted-foreground">
      Chỉ dùng chữ thường và dấu gạch ngang.
    </p>
  </div>
</div>
```

Dòng gợi ý nằm **ngoài** trường nhập liệu nên nó là `TYPOGRAPHY-9`. Văn bản gợi ý nằm **trong** trường nhập liệu thì lại là
`TYPOGRAPHY-11`.

### Trường hợp: nguồn dưới một trích dẫn

```tsx
<figure className="flex flex-col gap-2">
  <blockquote className="text-base leading-6 font-normal text-foreground">
    Lab retry buộc mình tìm ra idempotency trước khi chọn implementation.
  </blockquote>
  <figcaption className="text-xs leading-4 font-normal text-muted-foreground">Mai Lê · học viên</figcaption>
</figure>
```

### Ngoại lệ và nhầm lẫn

- **Không có nội dung hỗ trợ màu tiền cảnh:**

  ```tsx
  {/* SAI: giữ text-xs mà bỏ muted là phá cặp không tách rời */}
  <p className="text-xs leading-4 font-normal text-foreground">Cập nhật 12 phút trước</p>
  ```

- **Không có `text-xs` không giảm nhấn — trừ `h4`.** Đó là ngoại lệ duy nhất, và nó phải là phần tử
  `h4` với `font-medium`.
- **Trạng thái lỗi giữ nguyên mã, chỉ đổi tông:**

  ```tsx
  <p className="text-xs leading-4 font-normal text-red-600">Đường dẫn đã tồn tại.</p>
  ```

  Vai trò vẫn là bổ nghĩa cho trường nhập liệu, nên cỡ chữ và độ đậm không đổi; đổi cỡ ở đây làm bố cục nhảy mỗi
  lần kiểm tra tính hợp lệ.

---

## `TYPOGRAPHY-10` — dấu chia luồng kết quả

### Trường hợp: luồng tin hoạt động chia theo ngày

```tsx
<div className="flex flex-col gap-4">
  <div className="flex flex-col gap-2">
    <div className="text-sm leading-5 font-normal text-muted-foreground">Hôm nay</div>
    <ul className="divide-y rounded-lg border">
      <li className="p-4">Hoàn thành “Đọc và ghi theo cơ chế quorum”</li>
      <li className="p-4">Nộp bài thử thách “Rate limiter”</li>
    </ul>
  </div>
  <div className="flex flex-col gap-2">
    <div className="text-sm leading-5 font-normal text-muted-foreground">Hôm qua</div>
    <ul className="divide-y rounded-lg border">
      <li className="p-4">Bắt đầu mô-đun “Các mô hình nhất quán”</li>
    </ul>
  </div>
</div>
```

### Trường hợp: danh bạ chia theo chữ cái

```tsx
<div className="flex flex-col gap-2">
  <div className="text-sm leading-5 font-normal text-muted-foreground">A</div>
  <ul className="divide-y rounded-lg border">
    <li className="p-4 text-sm font-medium text-foreground">An Nguyễn</li>
    <li className="p-4 text-sm font-medium text-foreground">Anh Trần</li>
  </ul>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Dấu không bao giờ là phần tử tiêu đề:**

  ```tsx
  {/* SAI: outline của trang sẽ đầy “Hôm qua”, “Tháng 7”, do dữ liệu sinh ra */}
  <h3 className="text-sm font-medium">Hôm qua</h3>
  {/* ĐÚNG */}
  <div className="text-sm leading-5 font-normal text-muted-foreground">Hôm qua</div>
  ```

- **Dấu không phải nội dung hỗ trợ.** Nó không bổ nghĩa cho dòng nào cả, nên nó không lấy `text-xs`.
- **Một mốc thời gian đặt tên cho cả một phần nội dung thì lại là `h2`.** Phép thử là ai sinh ra nó: dữ
  liệu sinh ra dấu, còn thiết kế trang sinh ra phần nội dung.

---

## `TYPOGRAPHY-11` — chữ mà thành phần điều khiển đã sở hữu

### Trường hợp: nhãn nút

```tsx
<button className="rounded-md bg-neutral-900 px-3 py-2 text-white" type="submit">Lưu thay đổi</button>
```

Không có class CSS chữ nào trên chuỗi. Thành phần điều khiển đã quyết định kiểu chữ của chính nó.

### Trường hợp: nhãn nhỏ trạng thái và nhãn trạng thái đếm

```tsx
<div className="flex items-center gap-2">
  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Đang hoạt động</span>
  <span className="rounded-full bg-neutral-100 px-2 py-0.5 tabular-nums">12</span>
</div>
```

### Trường hợp: nhãn thẻ tab

```tsx
<div className="flex items-center gap-2" role="tablist">
  <button role="tab" type="button">Tổng quan</button>
  <button role="tab" type="button">Hoạt động</button>
</div>
```

### Trường hợp: liên kết điều hướng

```tsx
<nav className="flex flex-col gap-2">
  <a className="rounded-md px-3 py-2" href="#dashboard">Bảng điều khiển</a>
  <a className="rounded-md px-3 py-2" href="#courses">Khoá học</a>
</nav>
```

### Ngoại lệ và nhầm lẫn

- **Đừng đè cỡ chữ lên nhãn thành phần điều khiển:**

  ```tsx
  {/* SAI: giành một quyền sở hữu mà nơi gọi không có; call site này sẽ lệch khi control đổi */}
  <button className="text-xs leading-4 font-normal text-muted-foreground" type="button">Huỷ</button>
  ```

- **`TYPOGRAPHY-11` thắng cả khi chuỗi đọc y hệt chữ giao diện thường.** Ở trong thành phần điều khiển là ở trong thành phần điều khiển.
- **Chữ nằm cạnh thành phần điều khiển thì không thuộc thành phần điều khiển:**

  ```tsx
  <div className="flex items-center gap-2">
    <button className="rounded-md border px-3 py-2" type="button">Áp dụng</button>
    <p className="text-xs leading-4 font-normal text-muted-foreground">Mã giảm giá hết hạn sau 3 ngày</p>
  </div>
  ```

  Dòng bên phải là `TYPOGRAPHY-9` vì nó bổ nghĩa cho hành động, không nằm trong nút.

---

## `TYPOGRAPHY-12` — chưa nêu chủ sở hữu

### Trường hợp: một dòng chữ chưa gắn với cấu trúc nào

```tsx
<p className="text-base font-normal text-foreground">4,9 / 5</p>
```

Yêu cầu chỉ nói "cho nó nổi hơn", không nói vùng này dẫn bằng gì. Trả về công thức đọc được, và chỉ hỏi
ai dẫn dắt vùng này khi bên yêu cầu thật sự muốn thăng cấp nó.

### Trường hợp: cùng con số đó, sau khi chủ sở hữu đã được nêu

```tsx
<div className="flex flex-col gap-1">
  <span className="text-base font-medium text-foreground tabular-nums">4,9 / 5</span>
  <p className="text-xs leading-4 font-normal text-muted-foreground">128 đánh giá</p>
</div>
```

Một quyết định nội dung đã nói rằng điểm số dẫn dắt khối này, nên nó rời `TYPOGRAPHY-12` và nhận
`TYPOGRAPHY-5`. Chính quyết định ấy làm nó thăng cấp, không phải hình dáng con số.

### Ngoại lệ và nhầm lẫn

- **`TYPOGRAPHY-12` không phải lối thoát.** Nếu trong yêu cầu đã có chủ sở hữu thì dùng mã đúng.
- **Đừng ráp một công thức mới cho nhanh:**

  ```tsx
  {/* SAI: text-lg và font-bold không có trong bảng; vốn từ là đóng */}
  <p className="text-lg font-bold">4,9 / 5</p>
  ```

---

## Ví dụ lồng nhau — một cây, nhiều mã

Luật *một dòng, một quyền sở hữu* chỉ nhìn thấy được khi các mã nằm trong nhau.

```tsx
<main className="flex flex-col gap-6">
  <h1 className="text-xl font-semibold tracking-tight">System Design Mastery</h1>

  <section aria-labelledby="curriculum" className="flex flex-col gap-3">
    <h2 className="text-base font-semibold" id="curriculum">Nội dung khoá học</h2>
    <ul className="divide-y rounded-lg border">
      {modules.map((module) => (
        <li className="flex items-center justify-between p-4" key={module.id}>
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{module.title}</span>
            <span className="text-xs leading-4 font-normal text-muted-foreground">
              {module.lessonCount} bài · {module.duration}
            </span>
          </span>
          <button className="rounded-md border px-3 py-2" type="button">Tiếp tục</button>
        </li>
      ))}
    </ul>
  </section>

  <section aria-labelledby="reviews" className="flex flex-col gap-3">
    <h2 className="text-base font-semibold" id="reviews">Đánh giá học viên</h2>
    <div className="flex flex-col gap-1">
      <span className="text-base font-medium text-foreground tabular-nums">4,9 / 5</span>
      <p className="text-xs leading-4 font-normal text-muted-foreground">128 đánh giá</p>
    </div>
    <div className="text-sm leading-5 font-normal text-muted-foreground">Tháng này</div>
    <ul className="divide-y rounded-lg border">
      <li className="flex flex-col gap-1 p-4">
        <span className="text-sm font-medium text-foreground">Mai Lê</span>
        <p className="text-sm leading-5 font-normal text-foreground">
          Lab retry buộc mình tìm ra idempotency trước khi chọn implementation.
        </p>
      </li>
    </ul>
  </section>
</main>
```

Bảy mã cùng có mặt: `TYPOGRAPHY-1` cho tên tuyến trang, `TYPOGRAPHY-2` cho hai phần nội dung, `TYPOGRAPHY-6` cho
tên mô-đun và tên người đánh giá, `TYPOGRAPHY-9` cho hai dòng chỉ có nghĩa nhờ dòng trên,
`TYPOGRAPHY-7` cho nội dung đánh giá, `TYPOGRAPHY-10` cho mốc `Tháng này`, `TYPOGRAPHY-11` cho nhãn
nút, và `TYPOGRAPHY-5` cho điểm tổng đã được tuyên là dòng dẫn của khối đánh giá.

### Cùng cây đó ở trạng thái khung chờ — mọi mã giữ nguyên

```tsx
<li className="flex items-center justify-between p-4">
  <span className="flex flex-col gap-1">
    <span className="h-5 w-48 rounded bg-neutral-200" />
    <span className="h-4 w-24 rounded bg-neutral-200" />
  </span>
  <span className="h-9 w-24 rounded-md bg-neutral-200" />
</li>
```

Chiều cao của mỗi khối xám bằng đúng chiều cao dòng của mã nó thay thế. Nếu khung chờ dùng một chiều
cao khác, nó đang nói dối về quyền sở hữu trong lúc chờ, và bố cục sẽ nhảy khi dữ liệu về.

### Cùng cây đó ở trạng thái lỗi cục bộ — mã cũng giữ nguyên

```tsx
<li className="flex items-center justify-between p-4">
  <span className="flex flex-col gap-1">
    <span className="text-sm font-medium text-foreground">Các mô hình nhất quán</span>
    <span className="text-xs leading-4 font-normal text-red-600">Không tải được tiến độ</span>
  </span>
  <button className="rounded-md border px-3 py-2" type="button">Thử lại</button>
</li>
```

Dòng lỗi vẫn là `TYPOGRAPHY-9`: nó vẫn chỉ bổ nghĩa cho tiêu đề. Chỉ tông màu đổi.

---

## Ánh xạ yêu cầu sang một công thức

Nêu dòng chữ, cấp độ dàn ý và chủ sở hữu. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng. Câu trả lời phải là một công thức hoặc một câu hỏi — không bao giờ cả hai.

| # | Yêu cầu bằng lời | Dữ kiện quyết định | Mã | `className` |
|---:|---|---|---|---|
| 1 | "Tên của trang báo cáo hiện tại." | Gốc dàn ý của tuyến trang | `TYPOGRAPHY-1` | `text-xl font-semibold tracking-tight` |
| 2 | "Tên phần nội dung ngay dưới tên trang." | Cấp độ dàn ý hai | `TYPOGRAPHY-2` | `text-base font-semibold` |
| 3 | "Tên phần con kết quả học tập." | Cấp độ dàn ý ba | `TYPOGRAPHY-3` | `text-sm font-medium` |
| 4 | "Tên tiêu chí dưới một phần con, vẫn phải có trong dàn ý." | Cấp độ dàn ý bốn | `TYPOGRAPHY-4` | `text-xs font-medium text-muted-foreground` |
| 5 | "Tên ngắn của đối tượng duy nhất mà thẻ lớn này đại diện; không vào dàn ý." | Một đối tượng trội, tên ngắn ổn định | `TYPOGRAPHY-5` | `text-base font-medium text-foreground` |
| 6 | "Sáu result phần tử là phần tử ngang hàng; tiêu đề có thể dài sau khi dịch." | Lặp lại và có rủi ro dài | `TYPOGRAPHY-6` | `text-sm font-medium text-foreground` |
| 7 | "28/42 là một dữ kiện trong summary, không tự dẫn." | Giá trị giao diện thường | `TYPOGRAPHY-7` | `text-sm leading-5 font-normal text-foreground` |
| 8 | "Bốn đoạn văn giải thích cách vô hiệu hoá bộ nhớ đệm để đọc liên tục." | Công việc là đọc liên tục | `TYPOGRAPHY-8` | `text-base leading-6 font-normal text-foreground` |
| 9 | "Tên định danh chỉ giải thích tên hiển thị ngay phía trên." | Bổ nghĩa một dòng chính | `TYPOGRAPHY-9` | `text-xs leading-4 font-normal text-muted-foreground` |
| 10 | "`Hôm qua` chia activity danh sách nhưng không tạo phần nội dung." | Phần phân chia, không có cấp độ dàn ý | `TYPOGRAPHY-10` | `text-sm leading-5 font-normal text-muted-foreground` |
| 11 | "Mô-đun tiêu đề vẫn là phần tử ngang hàng khi tiến độ lỗi." | Trạng thái không đổi quyền sở hữu | `TYPOGRAPHY-6` | `text-sm font-medium text-foreground` |
| 12 | "Chỉnh phông chữ nhãn của nút." | Kiểu chữ thuộc về thành phần điều khiển | `TYPOGRAPHY-11` | *không khai báo class CSS chữ* |
| 13 | "Tiêu đề ngang hàng chuyển từ máy tính hàng sang thiết bị di động cụm xếp dọc." | Bố cục đổi, vai trò không đổi | `TYPOGRAPHY-6` | `text-sm font-medium text-foreground` |
| 14 | "Thời lượng chú thích đang đang tải." | Quan hệ bổ nghĩa vẫn còn | `TYPOGRAPHY-9` | `text-xs leading-4 font-normal text-muted-foreground` |
| 15 | "4.9/5 cần nổi hơn." | Chưa nêu chủ sở hữu nào | `TYPOGRAPHY-12` | `text-base font-normal text-foreground` |
| 16 | "Thêm tiêu đề level thứ năm." | Dàn ý đã đóng ở bốn | *không có* | Hỏi tác giả phẳng lại dàn ý |

Ở dòng 15, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ muốn thăng cấp:
*"Dòng nào đang dẫn dắt vùng này?"* Dòng 16 là yêu cầu duy nhất trả lời bằng câu hỏi thay vì công thức.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TYPOGRAPHY-1` / `TYPOGRAPHY-2` | Còn cái tên nào bao trùm dòng này trên tuyến trang hiện tại không? |
| `TYPOGRAPHY-2` / `TYPOGRAPHY-5` | Dòng này gọi tên một **mục cấu trúc** của trang, hay gọi tên một **đối tượng dữ liệu**? |
| `TYPOGRAPHY-3` / `TYPOGRAPHY-6` | Cái tên này do thiết kế trang sinh ra, hay do một hàng dữ liệu sinh ra? |
| `TYPOGRAPHY-4` / `TYPOGRAPHY-9` | Dòng này có buộc phải xuất hiện trong danh sách tiêu đề của trang không? |
| `TYPOGRAPHY-5` / `TYPOGRAPHY-6` | Vùng này có đúng một đối tượng, và tên nó có ngắn một cách ổn định không? |
| `TYPOGRAPHY-6` / `TYPOGRAPHY-7` | Dòng này **gọi tên** một thứ, hay **phát biểu** một dữ kiện? |
| `TYPOGRAPHY-7` / `TYPOGRAPHY-8` | Người dùng quét dòng này, hay đọc liên tục qua nhiều câu? |
| `TYPOGRAPHY-7` / `TYPOGRAPHY-9` | Xoá dòng ở trên thì dòng này còn nói được gì không? |
| `TYPOGRAPHY-9` / `TYPOGRAPHY-10` | Dòng này gắn vào **một** dòng cụ thể, hay chia **một luồng** kết quả? |
| `TYPOGRAPHY-10` / `TYPOGRAPHY-2` | Dấu này có nên xuất hiện trong mục lục của trang không? |
| `TYPOGRAPHY-11` / mọi mã khác | Chuỗi này nằm **bên trong** một thành phần điều khiển hay **bên cạnh** nó? |
| `TYPOGRAPHY-12` / mọi mã khác | Đã thật sự không suy ra được chủ sở hữu, hay chỉ là chưa hỏi? |

## Sai lầm lặp lại nhiều nhất

1. Chọn cỡ chữ bằng mắt — thấy yếu thì tăng lên `text-lg`, thấy nặng thì hạ xuống `text-xs`.
2. Coi mọi dòng to là tiêu đề, và mọi dòng nhỏ là nội dung hỗ trợ.
3. Viết dấu chia ngày thành `h3`, làm dàn ý của trang đầy tên do dữ liệu sinh ra.
4. Thăng cấp tiêu đề ngang hàng trên màn rộng.
5. Giữ `text-xs` nhưng bỏ `text-muted-foreground`, phá cặp không tách rời của `TYPOGRAPHY-9`.
6. Đè kiểu chữ lên chữ mà thành phần điều khiển đã sở hữu.
7. Đổi cấp bậc trong khung chờ, rỗng, lỗi hoặc dark chủ đề.
8. Ráp một công thức không có trong bảng — `text-lg`, `font-bold`, một bậc tiêu đề thứ năm.
9. Cho một con số tự thăng cấp chỉ vì nó là con số.
10. Dùng đường viền, màu nền hoặc nhãn trạng thái để giả cấp bậc thay vì tuyên bố quyền sở hữu.
