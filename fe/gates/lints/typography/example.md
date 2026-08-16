---
id: fe-lints-typography-example
title: example.md
slug: /gates/lints/typography/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho luật lint typography — chỗ nổ, chỗ im, và chỗ mã đi lọt.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `typography` · Luật: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là **mã thật**, kèm đường dẫn tệp, vì đường dẫn chính là dữ kiện chịu lực của phép
phát hiện: đổi thư mục là đổi kết quả, và đó không phải chuyện phụ.

Mục **SAI** là mã làm luật nổ. Mục **ĐÚNG** là mã luật im **và** hợp luật. Mục **Cửa lách và nhầm
lẫn** ở cuối là mã luật im **nhưng không** hợp luật — đó là danh sách chỗ mù, không phải danh sách
cách viết được phép.

---

## `no-heading-tag-outside-heading-component`

### SAI — thẻ tiêu đề viết tay ở một trang thường

```tsx
// src/components/pages/CourseDetail/index.tsx
// NỔ: messageId `tag`, tag = "h2", level = 2
export const CourseDetail = ({ course }: CourseDetailProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-2xl font-bold">{course.name}</h2>
    <Text props={{ content: course.summary, size: "sm" }} />
  </section>
)
```

### ĐÚNG — một prop quyết cả thẻ lẫn cỡ

```tsx
// src/components/pages/CourseDetail/index.tsx
export const CourseDetail = ({ course }: CourseDetailProps) => (
  <section className="flex flex-col gap-3">
    <Heading props={{ content: course.name, level: 2 }} />
    <Text props={{ content: course.summary, size: "sm" }} />
  </section>
)
```

### SAI — bậc thứ năm, tức là một vấn đề cấu trúc

```tsx
// src/components/blocks/ModuleOutline/index.tsx
// NỔ: messageId `tooDeep`, tag = "h5", deepest = 4
<article className="flex flex-col gap-2">
  <h5 className="text-xs font-medium">{lesson.title}</h5>
  <p className="text-xs text-muted">{lesson.duration}</p>
</article>
```

### ĐÚNG — làm phẳng phần nội dung, rồi đặt tiêu đề bằng bậc thang có

```tsx
// src/components/blocks/ModuleOutline/index.tsx
// Bài học không còn là một phần nội dung lồng bốn lớp; nó là một hàng trong
// danh sách của phần nội dung cấp ba.
<article className="flex flex-col gap-2">
  <Heading props={{ content: lesson.title, level: 3 }} />
  <Text props={{ content: lesson.duration, size: "xs" }} />
</article>
```

### SAI — thẻ tiêu đề trong một tệp bố cục

```tsx
// src/components/layouts/DashboardShell/index.tsx
// NỔ: messageId `tag`, tag = "h1", level = 1
<header className="flex items-center justify-between gap-4">
  <h1 className="text-xl font-semibold">{pageTitle}</h1>
  <ActionCluster props={{ actions }} />
</header>
```

### ĐÚNG — cùng vùng mốc, tiêu đề đi qua bậc

```tsx
// src/components/layouts/DashboardShell/index.tsx
// `header` là vùng mốc, không phải tiêu đề — luật không đụng tới nó.
<header className="flex items-center justify-between gap-4">
  <Heading props={{ content: pageTitle, level: 1 }} />
  <ActionCluster props={{ actions }} />
</header>
```

### SAI — tiêu đề chỉ dành cho trình đọc màn hình

```tsx
// src/components/blocks/FilterRail/index.tsx
// NỔ: messageId `tag`. Luật không đọc thuộc tính nào, nên `sr-only` không
// làm nó im — và đúng ra là không nên, vì đây chính là một dòng dàn ý.
<h2 className="sr-only">Bộ lọc</h2>
```

### ĐÚNG — vẫn là một dòng dàn ý, nhưng do bậc quyết

```tsx
// src/components/blocks/FilterRail/index.tsx
// Dòng dàn ý vẫn còn nguyên, và nó vẫn do MỘT bậc quyết. Việc ẩn nó khỏi thị
// giác là quyết định của thành phần tiêu đề, không phải của chỗ gọi — nếu chiếc
// lá chưa có đường nào để nói điều đó thì đây là một đề nghị sửa hợp đồng của
// chiếc lá, không phải một lý do để viết thẻ thô.
<Heading props={{ content: "Bộ lọc", level: 2 }} />
```

### SAI — thẻ tiêu đề sinh ra trong vòng lặp

```tsx
// src/components/blocks/ReviewList/index.tsx
// NỔ: một lần cho mỗi nút `JSXOpeningElement` trong tệp, không phải một lần
// cho mỗi phần tử được vẽ ra. Vị trí trong cây không phải tiêu chí.
{reviews.map((review) => (
  <li className="flex flex-col gap-1" key={review.id}>
    <h3 className="text-sm font-medium">{review.author}</h3>
    <p className="text-sm">{review.body}</p>
  </li>
))}
```

### ĐÚNG — cùng vòng lặp, tiêu đề đi qua bậc

```tsx
// src/components/blocks/ReviewList/index.tsx
{reviews.map((review) => (
  <li className="flex flex-col gap-1" key={review.id}>
    <Heading props={{ content: review.author, level: 3 }} />
    <Text props={{ content: review.body, size: "sm" }} />
  </li>
))}
```

### SAI — bọc lại bằng một thành phần một dòng

```tsx
// src/components/leaves/SectionTitle/index.tsx
// NỔ tại ĐÂY. Bọc lại chỉ làm các chỗ gọi im; cái thẻ vẫn tồn tại trong một
// tệp không phải tệp kiểm thử và không phải chiếc lá tiêu đề.
export const SectionTitle = ({ children }: SectionTitleProps) => (
  <h2 className="text-2xl font-bold">{children}</h2>
)
```

### ĐÚNG — bỏ hẳn lớp bọc, gọi thẳng chiếc lá đã có

```tsx
// src/components/blocks/BillingSection/index.tsx
<Heading props={{ content: "Thanh toán", level: 2 }} />
```

### ĐÚNG — chiếc lá tiêu đề, tệp duy nhất được viết thẻ

```tsx
// src/components/leaves/Heading/index.tsx
// Cổng tệp thấy `/src/components/leaves/Heading/` và trả về visitor rỗng:
// luật không được lắp cho tệp này.
const TAGS = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" } as const

export const Heading = ({ props }: HeadingProps) => {
  const Tag = TAGS[props.level]
  return <Tag className={LEVEL_CLASSES[props.level]}>{props.content}</Tag>
}
```

### ĐÚNG — bài kiểm thử sinh đôi dựng markup bằng tay

```tsx
// src/components/leaves/Heading/index.test.tsx
// Miễn trừ theo hậu tố `.test.tsx`. Bài kiểm thử cần viết được thẻ thô thì mới
// khẳng định được rằng bậc hai sinh ra đúng `h2`.
it("bậc hai sinh ra thẻ h2", () => {
  const { container } = render(<Heading props={{ content: "Tiêu đề", level: 2 }} />)
  expect(container.querySelector("h2")).not.toBeNull()
})
```

### SAI — thẻ tiêu đề nằm trong một nhánh điều kiện

```tsx
// src/components/composites/EmptyState/index.tsx
// NỔ: cả hai nhánh, hai lần báo. Nhánh không được chọn lúc chạy vẫn là một nút
// trong cây cú pháp.
{isCompact ? <h4 className="text-xs">{title}</h4> : <h3 className="text-sm">{title}</h3>}
```

### ĐÚNG — bậc là một giá trị, không phải một thẻ

```tsx
// src/components/composites/EmptyState/index.tsx
<Heading props={{ content: title, level: isCompact ? 4 : 3 }} />
```

### ĐÚNG — thẻ thường không phải thẻ tiêu đề

```tsx
// src/components/blocks/StatRow/index.tsx
// Luật chỉ hỏi tập sáu thẻ tiêu đề. `p`, `span`, `strong`, `section`, `header`
// đều đi qua — kể cả khi cách dùng chúng có vấn đề với một mã luật khác.
<div className="flex flex-col gap-1">
  <span className="text-2xl font-semibold tabular-nums">{value}</span>
  <span className="text-xs text-muted">{unit}</span>
</div>
```

### Chỗ lách và chỗ dễ nhầm

```tsx
// src/components/blocks/AccordionSection/index.tsx
// LỌT: cửa rộng nhất trên kệ. Tên thẻ là `JSXIdentifier` nhưng viết hoa, nên
// phép thử nội tại trả `null` và luật không thấy tiêu đề nào cả.
// Đây KHÔNG phải cách viết được phép — đây là chỗ luật mù.
const Tag = `h${level}` as "h2" | "h3"
return <Tag className="text-base font-semibold">{title}</Tag>
```

```tsx
// src/components/blocks/PortableHeading/index.tsx
// LỌT: không có nút JSX nào, nên không visitor nào chạy.
export const PortableHeading = ({ level, title }: PortableHeadingProps) =>
  createElement(`h${level}`, { className: "text-xl font-bold" }, title)
```

```tsx
// src/components/blocks/ArticleBody/index.tsx
// LỌT: `"<h2>…</h2>"` là một `Literal`, không phải `JSXOpeningElement`.
// Toàn bộ dàn ý của bài viết được dựng ở đây mà không luật nào nhìn thấy.
<div dangerouslySetInnerHTML={{ __html: article.html }} />
```

```tsx
// app/(marketing)/pricing/page.tsx
// LỌT: đường dẫn không chứa đoạn `/src/`, nên `create` trả visitor rỗng.
// Cùng một cái thẻ, cùng một trang, khác thư mục — khác kết quả.
<h1 className="text-4xl font-bold">Bảng giá</h1>
```

```tsx
// src/components/blocks/Anything/index.test.tsx
// LỌT: miễn trừ chỉ theo TÊN tệp, không ghép cặp với thư mục nào. Mọi tệp
// `.test.tsx` ở bất kỳ đâu đều được viết thẻ tiêu đề vì bất kỳ lý do gì —
// kể cả một tệp kiểm thử chẳng liên quan gì tới tiêu đề.
export const Fixture = () => <h2 className="text-3xl font-black">Bất kỳ</h2>
```

```tsx
// src/components/leaves/Heading/variants/Legacy.tsx
// LỌT: cổng chiếc lá là phép so CHUỖI CON, không phải danh tính tệp. Mọi tệp
// nằm dưới thư mục đó — và mọi thư mục khác trùng hình dạng đường dẫn, kể cả ở
// một workspace thứ hai — đều nhận nguyên quyền của bản gốc.
export const LegacyTitle = ({ title }: LegacyTitleProps) => (
  <h1 className="text-5xl font-black">{title}</h1>
)
```

```tsx
// src/components/blocks/DocsOutline/index.tsx
// LỌT: `node.name.type` là `JSXMemberExpression`, nên phép lấy tên thẻ trả
// `null` trước khi tập sáu thẻ được hỏi tới. Một object không gian tên giặt
// sạch cả sáu thẻ cùng lúc.
<Tags.h2 className="text-2xl font-bold">{section.title}</Tags.h2>
```

```tsx
// src/components/blocks/StepPanel/index.tsx
// LỌT: tạo ra ĐÚNG dòng dàn ý mà luật đang nói tới, nhưng không có thẻ tiêu đề
// nào. Với luật lint thì đây chỉ là một cái hộp.
<div role="heading" aria-level={2} className="text-2xl font-bold">
  {step.title}
</div>
```

```tsx
// src/components/blocks/SettingsGroup/index.tsx
// LỌT CẢ HAI LUẬT: không có thẻ (luật này im), và cũng không đủ to cộng đủ nặng
// để luật sinh đôi ở mô-đun kia nổ. Một tiêu đề không có dàn ý, đi lọt qua khe
// giữa hai luật — và khe đó chính là chỗ cái tiếp theo sẽ được viết ra.
<div className="text-lg font-semibold">{group.name}</div>
```

```tsx
// src/components/composites/ProfileCard/index.tsx
// NHẦM LẪN: người viết tưởng mình đã "bọc lại xong" nên chỗ gọi sạch. Đúng là
// chỗ gọi sạch — nhưng tệp định nghĩa `SectionTitle` vẫn nổ, và bản build vẫn
// đỏ. Bọc lại không phải một cách sửa; nó chỉ dời chỗ báo.
<SectionTitle>Hồ sơ</SectionTitle>
```

```tsx
// src/components/blocks/ReviewList/index.stories.tsx
// NHẦM LẪN theo chiều ngược lại: tệp story KHÔNG được miễn trừ. Hậu tố phải là
// `.test.` hoặc `.spec.`; `.stories.` không nằm trong đó, nên đây vẫn NỔ.
export const Default = () => <h3 className="text-sm font-medium">Bản mẫu</h3>
```

```tsx
// src/components/pages/CourseDetail/Heading/index.tsx
// NHẦM LẪN: thư mục tên `Heading` là chưa đủ. Cổng đòi đúng đoạn
// `/src/components/leaves/Heading/`, nên tệp này vẫn NỔ.
<h2 className="text-2xl font-bold">{course.name}</h2>
```

---

## Ánh xạ yêu cầu sang một luật lint

Nêu **tệp**, **nút cú pháp** và **tên thẻ**. Thiếu một trong ba thì luật không có gì để đứng canh.

| Yêu cầu bằng lời | Nút và giá trị | Luật nổ | Cách viết đúng |
|---|---|---|---|
| Thêm tên phần nội dung vào trang này | `JSXOpeningElement` tên `h2`, tệp trong `/src/` | `no-heading-tag-outside-heading-component` (`tag`) | Dựng thành phần tiêu đề với bậc 2 |
| Tiêu đề nhỏ cho từng bài học trong từng chương của từng khoá | `JSXOpeningElement` tên `h5` | `no-heading-tag-outside-heading-component` (`tooDeep`) | Làm phẳng phần nội dung trước, rồi dùng bậc thang có |
| Thêm một tiêu đề ẩn cho trình đọc màn hình | `JSXOpeningElement` tên `h2`, có `sr-only` | `no-heading-tag-outside-heading-component` (`tag`) | Vẫn là một bậc; ẩn thị giác là việc của prop, không phải của thẻ |
| Cho tiêu đề đổi bậc theo độ sâu lồng nhau | `JSXOpeningElement` tên viết hoa | **không luật nào** | Truyền bậc cho thành phần tiêu đề; đừng tự tính tên thẻ |
| Đổi cỡ chữ tiêu đề cho vừa mắt hơn | `JSXAttribute` `className` trên `Heading` | không luật nào ở kệ này | Đây là thay đổi luật, không phải thay đổi tệp |
| Sửa bản đồ bậc sang thẻ | `JSXOpeningElement` tên `h3`, trong thư mục chiếc lá | không luật nào | Đúng chỗ — chiếc lá là nơi duy nhất quyết cả hai |
| Đổ nội dung bài viết dạng HTML vào trang | `JSXAttribute` `dangerouslySetInnerHTML` | không luật nào | Luật không giữ được; kiểm dàn ý bằng cách khác |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| `tag` / `tooDeep` | `Number(tag.slice(1))` có lớn hơn `4` không? Đây là toàn bộ phép chia hai nhánh, và hai nhánh nói hai chuyện khác nhau: quyền sở hữu so với cấu trúc |
| Luật nổ / luật không được lắp | Đường dẫn có chứa `/src/`, có kết thúc bằng `.test.`/`.spec.`, có chứa đoạn thư mục chiếc lá tiêu đề không? Ba câu này quyết định trước cả tên thẻ |
| Thẻ nội tại / thành phần | Chuỗi tên có bằng đúng dạng viết thường của chính nó không? Nếu không, luật trả `null` và dừng — kể cả khi biến đó đang giữ chuỗi `"h2"` |
| Luật này / luật sinh đôi ở mô-đun kia | Có **thẻ** tiêu đề không? Nếu có, luật này. Nếu chỉ có cỡ to cộng độ đậm nặng trên thẻ khác, luật kia. Nếu không cái nào, không luật nào |
| Thư mục chiếc lá / thư mục chỉ trùng tên | Đường dẫn có chứa nguyên đoạn `/src/components/leaves/Heading/` không? Một thư mục tên `Heading` ở chỗ khác không được miễn trừ |
| Tệp kiểm thử / tệp story | Hậu tố là `.test.`/`.spec.` hay `.stories.`? Chỉ hai cái đầu được miễn trừ |

## Sai lầm lặp lại nhiều nhất

1. Đọc mục **Cửa lách** như danh sách cách viết được phép. Nó là danh sách chỗ mù.
2. Tính tên thẻ vào một biến viết hoa rồi tưởng mình đã làm cho nó "linh hoạt". Luật biến mất cùng
   lúc đó, và đây là cách phổ biến nhất khiến nó biến mất.
3. Bọc `<h2>` vào một thành phần một dòng và gọi đó là đã sửa. Báo lỗi chỉ dời sang tệp lớp bọc.
4. Thấy `sr-only` rồi tưởng luật sẽ tha. Luật không đọc thuộc tính nào cả — và một tiêu đề ẩn vẫn là
   một dòng dàn ý thật.
5. Đặt tệp ngoài `/src/` rồi tưởng luật vẫn đang chạy.
6. Tin rằng `h5` "nhỏ hơn nên nhẹ hơn". Nó báo bằng một thông điệp khác, và thông điệp đó nói rằng
   vấn đề nằm ở cấu trúc chứ không ở cỡ chữ.
7. Đặt một thư mục tên `Heading` ở chỗ khác rồi tưởng đã có miễn trừ.
8. Viết `<div role="heading">` để "đúng ngữ nghĩa mà lint không kêu" — vừa lách được máy, vừa vi phạm
   đúng cái luật mà máy đang giữ.
9. Tin rằng lint xanh nghĩa là dàn ý đúng. Markdown, MDX và mọi HTML đổ vào bằng chuỗi đều nằm ngoài
   tầm nhìn của luật.
