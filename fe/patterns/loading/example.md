---
id: fe-patterns-loading-example
title: example.md
slug: /fe/patterns/loading/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã LOADING-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `loading` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Không component library, không design system riêng, không
registry key, không tên sản phẩm. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm mới đọc được, ví dụ đó nằm sai chỗ.

Mỗi mã có **nhiều case**, từng case đặt bản **ĐÚNG** cạnh bản **SAI**, sau đó là mục **ngoại lệ và nhầm
lẫn**. Sau mỗi cặp là một câu làm rõ hai bản khác nhau ở đúng **một** điều — vì nếu phải kể ra hai
điều thì cặp đó chưa phải là một phép thử.

---

## `LOADING-1` — một hình, hai trạng thái

### Case: dòng chữ nghỉ

```tsx
// ĐÚNG
export const Text = ({ content, isLoading = false }: TextProps) => (
  <span className={isLoading ? "inline-block h-4 w-24 animate-pulse rounded bg-neutral-200" : "text-sm"}>
    {isLoading ? " " : content}
  </span>
)
```

```tsx
// SAI
export const TextSkeleton = () => (
  <span className="inline-block h-4 w-24 animate-pulse rounded bg-neutral-200" />
)
```

Chúng khác nhau ở đúng một điều: bản đang chờ có đổi theo khi bản thật đổi hay không.

### Case: card khoá học

```tsx
// ĐÚNG
export const CourseCard = ({ course, isLoading = false }: CourseCardProps) => (
  <article className="flex flex-col gap-3 rounded-lg border p-4">
    <Text content={course?.title} isLoading={isLoading} />
    <Text content={course?.author} isLoading={isLoading} />
  </article>
)
```

```tsx
// SAI
export const CourseCardSkeleton = () => (
  <article className="flex flex-col gap-3 rounded-lg border p-4">
    <span className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
    <span className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
  </article>
)
```

Chúng khác nhau ở đúng một điều: thêm dòng thứ ba vào card thì có phải nhớ sửa hai chỗ không.

### Case: hình nghỉ đưa từ ngoài vào bằng prop

```tsx
// ĐÚNG
<InvoiceRow invoice={invoice} isLoading={isLoading} />
```

```tsx
// SAI
<InvoiceRow
  invoice={invoice}
  skeleton={
    <div className="flex justify-between p-4">
      <span className="h-4 w-32 rounded bg-neutral-200" />
      <span className="h-4 w-16 rounded bg-neutral-200" />
    </div>
  }
/>
```

Chúng khác nhau ở đúng một điều: bản mô tả đứng gần hay đứng xa cái hình mà nó mô tả — bản SAI thì
chính `InvoiceRow` cũng không nhìn thấy nó.

### Ngoại lệ và nhầm lẫn

- **Primitive nghỉ dùng chung KHÔNG phải twin.** Nó không mô tả hình của ai cả, nên không thể drift
  khỏi hình nào:

  ```tsx
  // ĐÚNG — một mặt nghỉ tổng quát, component nghỉ BẰNG nó
  export const Resting = ({ className }: { className: string }) => (
    <span aria-hidden className={`animate-pulse rounded bg-neutral-200 ${className}`} />
  )
  ```

- **Twin trong file test là fixture, không phải cây thứ hai.** Nó không được ship cho ai đọc:

  ```tsx
  // ĐÚNG — trong invoice-row.test.tsx
  const expected = <div className="flex justify-between p-4"><span /><span /></div>
  ```

- **Prop tên `fallback` hay `placeholder` vẫn là cùng một sai lầm.** Đổi tên không đổi bản chất:

  ```tsx
  // SAI
  <StatTile value={value} fallback={<span className="h-8 w-12 rounded bg-neutral-200" />} />
  ```

- **`isLoading` phải được NHẬN, không được QUYẾT, ở tầng leaf:**

  ```tsx
  // SAI — leaf tự đi hỏi xem dữ liệu về chưa
  export const Text = ({ id }: { id: string }) => {
    const { data, isLoading } = useQuery(id)
    return <span>{isLoading ? " " : data?.content}</span>
  }
  ```

---

## `LOADING-2` — vẫn là phần tử đó, chỉ rút ruột ra

### Case: ternary ở call site

```tsx
// ĐÚNG
<Avatar name={user?.name} isLoading={isLoading} />
```

```tsx
// SAI
{isLoading ? <AvatarSkeleton /> : <Avatar name={user.name} />}
```

Chúng khác nhau ở đúng một điều: hình nghỉ được viết ở trong component hay ở ngoài nó.

### Case: bảo toàn thẻ và measure

```tsx
// ĐÚNG
<span
  data-loading={isLoading ? "true" : "false"}
  className={isLoading ? "inline-block h-5 w-32 animate-pulse rounded bg-neutral-200" : "text-base font-medium"}
>
  {isLoading ? " " : title}
</span>
```

```tsx
// SAI
{isLoading ? <div className="h-5 w-32 animate-pulse rounded bg-neutral-200" /> : <span className="text-base font-medium">{title}</span>}
```

Chúng khác nhau ở đúng một điều: `div` và `span` không xếp giống nhau trong một dòng chữ, nên chữ
nhảy đúng lúc dữ liệu về.

### Case: badge trạng thái

```tsx
// ĐÚNG
export const Badge = ({ label, isLoading = false }: BadgeProps) => (
  <span className={isLoading
    ? "inline-block h-6 w-16 animate-pulse rounded-full bg-neutral-200"
    : "inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800"}>
    {isLoading ? " " : label}
  </span>
)
```

```tsx
// SAI
{isLoading ? <Placeholder shape="pill" /> : <Badge label={label} />}
```

Chúng khác nhau ở đúng một điều: `rounded-full` được khai báo một lần hay hai lần.

### Ngoại lệ và nhầm lẫn

- **Cùng một component ở cả hai nhánh là dạng thành thật.** Nếu vẫn muốn viết ternary thì viết thế
  này — nhưng lúc đó ternary chỉ còn là một cách truyền cờ vòng vo:

  ```tsx
  // ĐÚNG nhưng thừa
  {isLoading ? <Avatar isLoading /> : <Avatar name={user.name} />}
  // ĐÚNG và gọn
  <Avatar name={user?.name} isLoading={isLoading} />
  ```

- **Nhánh `null` KHÔNG thuộc mã này** — đó là `LOADING-5` và nó đúng:

  ```tsx
  // ĐÚNG
  {destination === undefined ? null : <SeeMoreLink href={destination} label={label} />}
  ```

- **Fetch lại phía sau dữ liệu đang hiển thị thì đừng rút ruột:**

  ```tsx
  // SAI — hình đi giật lùi, người đọc mất chữ đang đọc dở
  <Text content={data.title} isLoading={isValidating} />
  ```

---

## `LOADING-3` — vùng nghỉ bảo toàn chiều cao

### Case: danh sách nghỉ bằng đúng số dòng đã khai báo

```tsx
// ĐÚNG
const RESTING_ROWS = 6

const rows = isLoading
  ? Array.from({ length: RESTING_ROWS }, (_unused, index) => ({ id: `resting-${index}` }))
  : props.rows

return <ul className="flex flex-col gap-2">{rows.map((row) => <Row key={row.id} row={row} isLoading={isLoading} />)}</ul>
```

```tsx
// SAI
{isLoading ? null : props.rows.map((row) => <Row key={row.id} row={row} />)}
```

Chúng khác nhau ở đúng một điều: người đọc có giữ được chỗ mình đang đọc khi dữ liệu về hay không.

### Case: số dòng nghỉ là một quyết định có tên

```tsx
// ĐÚNG — số đứng cạnh chỗ khai báo rằng vùng này lặp
const list = { repeats: true, restingCount: 6 } as const
```

```tsx
// SAI — số nằm rải trong JSX, không ai biết nó dựa vào đâu
{isLoading && <><Row /><Row /><Row /></>}
```

Chúng khác nhau ở đúng một điều: con số ấy có phải là một quyết định để người sau tra lại được không.

### Case: cả section giữ khung

```tsx
// ĐÚNG
<section className="flex flex-col gap-3">
  <h2 className="font-medium">{label}</h2>
  <ul className="flex flex-col gap-2">{rows.map(…)}</ul>
</section>
```

```tsx
// SAI
{isLoading ? null : (
  <section className="flex flex-col gap-3">
    <h2 className="font-medium">{label}</h2>
    <ul className="flex flex-col gap-2">{props.rows.map(…)}</ul>
  </section>
)}
```

Chúng khác nhau ở đúng một điều: cái tên của vùng có biến mất trong lúc nội dung của nó đang trên
đường về hay không.

### Ngoại lệ và nhầm lẫn

- **Bỏ một CONTROL vì chưa có đích là đúng; bỏ một VÙNG vì chưa có dữ liệu là sai.** Control mất đi
  không làm ai mất chỗ đọc.
- **Số dòng nghỉ không cần bằng số dòng thật.** Nó cần bằng **kích thước của một vùng thật**, và một
  danh sách 200 dòng vẫn nghỉ bằng 6.
- **Đừng lấy chiều cao cố định để né vấn đề:**

  ```tsx
  // SAI — vùng đúng cao, nhưng bên trong rỗng, và chiều cao thật đổi thì con số này ở lại
  <div className="h-[420px]">{isLoading ? null : <List rows={rows} />}</div>
  ```

---

## `LOADING-4` — phần đang nghỉ được giấu khỏi trợ năng

### Case: giấu đúng lúc nghỉ, trả lại ngay khi có nội dung

```tsx
// ĐÚNG
<span aria-hidden={isLoading ? true : undefined} className={isLoading ? RESTING : TEXT}>
  {isLoading ? " " : content}
</span>
```

```tsx
// SAI
<span className={isLoading ? RESTING : TEXT}>{isLoading ? " " : content}</span>
```

Chúng khác nhau ở đúng một điều: screen reader đọc ra một chuỗi trống hay im lặng.

### Case: đừng dán nhãn "đang tải" lên từng ô

```tsx
// ĐÚNG — vùng nói một lần, các ô im lặng
<section aria-busy={isLoading}>
  {rows.map((row) => <Row key={row.id} row={row} isLoading={isLoading} />)}
</section>
```

```tsx
// SAI — mười ô cùng tự giới thiệu
{rows.map((row) => <span key={row.id} aria-label="Đang tải" className={RESTING} />)}
```

Chúng khác nhau ở đúng một điều: người dùng nghe một câu hay nghe mười câu giống hệt nhau.

### Ngoại lệ và nhầm lẫn

- **Icon nghỉ cũng phải giấu**, kể cả khi lúc thật nó đã `aria-hidden` sẵn — điều cần kiểm là nó
  không đổi hành vi trợ năng giữa hai trạng thái:

  ```tsx
  // ĐÚNG
  {isLoading ? <span aria-hidden className="size-5 animate-pulse rounded-full bg-neutral-200" /> : <Icon name={name} aria-hidden />}
  ```

- **Giấu vĩnh viễn là một lỗi khác:**

  ```tsx
  // SAI — nội dung thật cũng không ai đọc được
  <span aria-hidden className={isLoading ? RESTING : TEXT}>{content}</span>
  ```

---

## `LOADING-5` — chưa có nơi để đi thì chưa vẽ control

### Case: card nghỉ không có lối ra

```tsx
// ĐÚNG
<article className="flex flex-col gap-2 rounded-lg border p-4">
  <Text content={item?.title} isLoading={isLoading} />
  {item === undefined ? null : <SeeMoreLink href={item.href} label={resumeLabel} />}
</article>
```

```tsx
// SAI
<article className="flex flex-col gap-2 rounded-lg border p-4">
  <Text content={item?.title} isLoading={isLoading} />
  <SeeMoreLink href={item?.href} label={resumeLabel} isLoading={isLoading} />
</article>
```

Chúng khác nhau ở đúng một điều: người đọc có bấm được vào một thứ chưa dẫn đi đâu hay không.

### Case: vắng mặt, không phải `disabled`

```tsx
// ĐÚNG
{invoice === undefined ? null : <button type="button" onClick={() => download(invoice.id)}>Tải hoá đơn</button>}
```

```tsx
// SAI
<button type="button" disabled={isLoading} onClick={() => download(invoice!.id)}>Tải hoá đơn</button>
```

Chúng khác nhau ở đúng một điều: một nút xám vẫn là một lời hứa, còn chỗ trống thì không hứa gì.

### Ngoại lệ và nhầm lẫn

- **Control mà bề rộng CHÍNH LÀ nhãn của nó thì không nghỉ được.** Dòng chữ có measure khai báo sẵn
  nên nghỉ được; cái nút thì không:

  ```tsx
  // SAI — bề rộng lúc nghỉ do ta bịa ra, và nút nhảy khi nhãn thật về
  <button type="button" className={isLoading ? "h-9 w-24 animate-pulse rounded bg-neutral-200" : BTN}>
    {isLoading ? " " : label}
  </button>
  ```

- **`onClick` rỗng không phải là "không có đích".** Nó vẫn là một đích bấm được:

  ```tsx
  // SAI
  <button type="button" onClick={isLoading ? () => {} : onResume}>Học tiếp</button>
  ```

- **Chỗ trống của control không được làm co card.** Nếu bỏ control làm vỡ chiều cao, đó là
  `LOADING-3` và phải giữ khung bằng vùng chứa, không phải bằng cách vẽ lại control.

---

## `LOADING-6` — mỗi vùng tự sở hữu việc chờ của mình

### Case: bốn vùng, bốn request, bốn cờ

```tsx
// ĐÚNG
<main className="flex flex-col gap-6">
  <ContinueLearning />
  <WeeklyGoals />
  <ActivityFeed />
  <Changelog />
</main>
```

```tsx
// SAI
const isLoading = courses.isLoading || goals.isLoading || activity.isLoading || changelog.isLoading

return (
  <main className="flex flex-col gap-6">
    <ContinueLearning isLoading={isLoading} />
    <WeeklyGoals isLoading={isLoading} />
    <ActivityFeed isLoading={isLoading} />
    <Changelog isLoading={isLoading} />
  </main>
)
```

Chúng khác nhau ở đúng một điều: trang lấp dần trong một giây, hay trắng ba giây rồi hiện một lượt.

### Case: mỗi block tự đọc request của mình

```tsx
// ĐÚNG
export const WeeklyGoals = () => {
  const goals = useMyWeeklyGoals()
  if (goals.error !== undefined) return <WeeklyGoalsView state="failed" props={{ label, message }} />
  if (goals.data === undefined) return <WeeklyGoalsView state="pending" props={{ label }} />
  return <WeeklyGoalsView state="ready" props={{ label, rows: goals.data.rows }} />
}
```

```tsx
// SAI
export const WeeklyGoals = ({ isLoading, rows }: { isLoading: boolean; rows?: Row[] }) => (
  <WeeklyGoalsView state={isLoading ? "pending" : "ready"} props={{ label, rows: rows ?? [] }} />
)
```

Chúng khác nhau ở đúng một điều: ai biết câu trả lời của vùng này đã về hay chưa.

### Ngoại lệ và nhầm lẫn

- **Hai phần đọc từ CÙNG một câu trả lời thì chờ cùng nhau là đúng** — chúng chỉ có một câu trả lời
  để chờ:

  ```tsx
  // ĐÚNG
  <><ProfileName user={data?.user} isLoading={isLoading} /><ProfileBio user={data?.user} isLoading={isLoading} /></>
  ```

- **`Promise.all` gom request không liên quan là cách tạo ra lỗi này ở tầng dữ liệu**, và không có
  lint nào nhìn thấy nó.

---

## `LOADING-7` — chờ là một tình huống thật

### Case: `pending` đứng trong union

```tsx
// ĐÚNG
type WeeklyGoalsInput =
  | { readonly state: "pending"; readonly props: { readonly label: string } }
  | { readonly state: "empty"; readonly props: { readonly label: string; readonly message: string } }
  | { readonly state: "failed"; readonly props: { readonly label: string; readonly message: string } }
  | { readonly state: "ready"; readonly props: { readonly label: string; readonly rows: readonly Row[] } }
```

```tsx
// SAI
type WeeklyGoalsInput = { readonly rows?: readonly Row[] }
```

Chúng khác nhau ở đúng một điều: "chưa về" và "không có" có phải hai từ khác nhau hay không.

### Case: `pending` mang theo phần khung

```tsx
// ĐÚNG — nhãn của vùng đã biết từ trước khi request được gửi đi
if (input.state === "pending") {
  return <Card label={input.props.label} isLoading>{restingRows}</Card>
}
```

```tsx
// SAI
if (input.state === "pending") return null
```

Chúng khác nhau ở đúng một điều: người đọc lúc chờ có còn biết mình đang ở vùng nào không.

### Case: mối nối giữa hai nửa

```tsx
// ĐÚNG — block nói tình huống, leaf nói dáng nghỉ
const isLoading = input.state === "pending"
return <Text content={input.state === "ready" ? input.props.title : undefined} isLoading={isLoading} />
```

```tsx
// SAI — block tự quyết dáng nghỉ, tức là tự mô tả giải phẫu của leaf
{input.state === "pending"
  ? <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
  : <Text content={input.props.title} />}
```

Chúng khác nhau ở đúng một điều: file nào đang biết hình dạng của cái đang nghỉ.

### Ngoại lệ và nhầm lẫn

- **`pending` không được dùng lại giao diện của `empty`.** Hai tình huống cần hai câu chữ:

  ```tsx
  // SAI
  if (data === undefined) return <EmptyNotice message="Chưa có mục tiêu nào" />
  ```

- **Dữ liệu đã có trong cache vẫn là `ready`**, kể cả khi đang fetch lại phía sau.

---

## Ánh xạ yêu cầu sang một quyết định

Nêu vùng, tầng của file, và tình huống. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng. Câu trả lời phải là một quyết định hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Làm skeleton cho card khoá học" | Card đã tồn tại và đã biết hình của mình | `LOADING-1` | Thêm `isLoading` vào chính card, không tạo file mới |
| "Lúc tải thì thay chữ bằng thanh xám" | Cùng một dòng, chỉ rút giá trị ra | `LOADING-2` | Một `<span>`, đổi class và đổi nội dung |
| "Danh sách lúc chờ để trống cho gọn" | Vùng co lại thì cột dưới nhảy | `LOADING-3` | Nghỉ bằng số dòng đã khai báo |
| "Thêm aria-label 'đang tải' cho từng ô" | Lúc này không có nội dung để đọc | `LOADING-4` | `aria-hidden` trên ô, `aria-busy` một lần trên vùng |
| "Nút Học tiếp cũng cho shimmer luôn" | Đích chưa tồn tại | `LOADING-5` | Bỏ hẳn control cho tới khi có đích |
| "Chờ hết API rồi hãy render trang" | Bốn request độc lập | `LOADING-6` | Mỗi vùng một cờ, lấp dần |
| "Chưa có data thì trả về null" | "Chưa về" khác "không có" | `LOADING-7` | `pending` vào union, mang theo nhãn vùng |
| "Truyền sẵn markup skeleton vào qua prop" | Cây thứ hai, lại còn đứng xa hơn twin | `LOADING-1` | Truyền cờ xuống, để từng phần tự nghỉ |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `LOADING-1` / `LOADING-2` | Cây thứ hai đang nằm trong một file/prop riêng, hay được viết ngay tại call site? |
| `LOADING-2` / `LOADING-3` | Đang hỏi về một phần tử giữ hình, hay về cả một vùng giữ chiều cao? |
| `LOADING-2` / `LOADING-5` | Nhánh còn lại là một element khác, hay là `null`? |
| `LOADING-3` / `LOADING-5` | Thứ bị bỏ đi là cả một vùng, hay chỉ một control chưa có đích? |
| `LOADING-3` / `LOADING-6` | Đang nói về chiều cao của một vùng, hay về nhiều vùng chờ lẫn nhau? |
| `LOADING-4` / `LOADING-7` | Thông báo đặt ở từng ô nghỉ, hay một lần ở khung của vùng? |
| `LOADING-6` / `LOADING-7` | Nhiều vùng dùng chung một cờ, hay một vùng thiếu hẳn tình huống `pending`? |
| `LOADING-1` / `LOADING-7` | Nhánh `pending` đã có tên chưa, và nó đang render chính component đó hay một twin? |

## Sai lầm lặp lại nhiều nhất

1. Dựng một file `…Skeleton` bên cạnh component thật, rồi quên nó ngay hôm sau.
2. Viết ternary chọn giữa hai element khác nhau ở call site.
3. Lúc chờ thì `return null` cho cả một vùng, và cột bên dưới nhảy khi dữ liệu về.
4. Vẽ nút hoặc link trong lúc đích của nó chưa tồn tại.
5. Dùng `disabled` thay cho vắng mặt, tưởng như thế là an toàn hơn.
6. Gộp bốn request độc lập vào một cờ `isLoading` duy nhất.
7. Coi `data === undefined` là empty state, làm mất luôn sự khác nhau giữa "chưa về" và "không có".
8. Để shimmer nằm trong cây trợ năng, hoặc dán nhãn "đang tải" lên từng ô một.
9. Rút ruột nội dung đang hiển thị chỉ vì đang fetch lại phía sau.
10. Để block tự viết dáng nghỉ của leaf, tức là mô tả lại giải phẫu của một file khác.
