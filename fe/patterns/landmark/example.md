---
id: fe-patterns-landmark-example
title: example.md
slug: /fe/patterns/landmark/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã LANDMARK-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `landmark` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Tên component và tên key ở đây là **minh hoạ**, không phải tên
riêng của một sản phẩm nào; hãy thay bằng tên mà ứng dụng của bạn đang dùng:

| Tên trong ví dụ | Vai trò |
|---|---|
| `Frame` | Branch vẽ **một** node của registry. Không sở hữu class nào |
| `MainFrame`, `NavFrame` | Branch landmark: giống `Frame` ở mọi điểm trừ element nó mở |
| `registry` | Bảng entry: `classes`, `host`, `children`, `why` |
| `defineNode` · `defineProjection` · `defineLeaf` | Khai báo nội dung khớp đúng một key |

Mỗi mã có **nhiều case**, sau đó là **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một file và một vật mang.

---

## `LANDMARK-1` — mỗi element một branch

### Case: màn hình cần thêm một `nav` thật

```tsx
// SAI: một branch học cách mở nhiều element. Ý nghĩa của document trở thành một bảng tra.
const ELEMENTS = { tree: "div", main: "main", nav: "nav" } as const

export const Frame = ({ contract, render, kind = "tree" }: FrameProps) => {
    const Host = ELEMENTS[kind]
    return <Host {...nodeProps(contract)}><Content contract={contract} render={render} /></Host>
}
```

```tsx
// ĐÚNG: một branch cho mỗi element. Thêm `nav` là thêm một file, không sửa file đang chạy.
export const NavFrame = <const K extends ContractKey>({ contract, render }: FrameProps<K>) => (
    <nav {...nodeProps(contract)}>
        <Content contract={contract} render={render} />
    </nav>
)
```

Hai bản khác nhau đúng một điều: bản dưới không có chỗ nào để quên. Bản trên có `kind`, và mặc định
của `kind` là `"tree"`.

### Case: branch landmark giống branch thường ở mọi dòng còn lại

```tsx
// Branch thường. Nó là nơi DUY NHẤT một `div` được viết ra.
export const Frame = <const K extends ContractKey>({ contract, render }: FrameProps<K>) => (
    <div {...nodeProps(contract)}>
        <Content contract={contract} render={render} />
    </div>
)
```

```tsx
// Branch landmark. Cùng props, cùng lookup, cùng nội dung. Khác đúng một token: element.
export const MainFrame = <const K extends ContractKey>({ contract, render }: FrameProps<K>) => (
    <main {...nodeProps(contract)}>
        <Content contract={contract} render={render} />
    </main>
)
```

Sự giống nhau này **là** lý do luật đứng vững: khi bản đúng chỉ tốn một file, bản sai không còn thắng
được bằng lập luận "cách kia rẻ hơn".

### Case: landmark viết tay

```tsx
// SAI: `<main>` này không mang key. Không có gì ghi lại class của nó, tập con nó nhận, hay lý do.
const CoursesLayout = ({ children }: { children: ReactNode }) => (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">{children}</main>
)
```

```tsx
// ĐÚNG: element đi cùng key, nên class và lý do có một nơi để sống.
const CoursesLayout = ({ children }: { children: ReactNode }) => (
    <MainFrame
        contract="routed-page-main"
        render={defineNode("routed-page-main", {
            page: defineLeaf("page", {}, () => children),
        })}
    />
)
```

### Ngoại lệ và nhầm lẫn

- **Chính file cài đặt branch landmark được viết element bằng tay.** Đó là ngoại lệ đóng và là lý do
  branch tồn tại:

  ```tsx
  // branches/MainFrame/index.tsx — nơi duy nhất chuỗi `<main>` được phép xuất hiện.
  export const MainFrame = <const K extends ContractKey>({ contract, render }: FrameProps<K>) => (
      <main {...nodeProps(contract)}>
          <Content contract={contract} render={render} />
      </main>
  )
  ```

- **"Thêm branch nữa là lặp code" không phải một phản biện.** Chỗ trùng lặp ở đây là chỗ trùng lặp mà
  ta muốn: nó khiến mỗi element có đúng một nơi để đọc.
- **Một `header` bên trong một card không cần branch landmark.** `header` của một card là hình dạng
  cục bộ, không phải vùng người đọc nhảy tới.

---

## `LANDMARK-2` — branch không sở hữu class nào

### Case: có người muốn truyền class vào cho nhanh

```tsx
// SAI: branch mọc thêm một prop mà key không có tiếng nói. Giờ có hai chỗ trả lời "vì sao rộng chừng này".
export const MainFrame = ({ contract, render, className }: MainFrameProps) => (
    <main className={className} {...nodeProps(contract)}>
        <Content contract={contract} render={render} />
    </main>
)
```

```tsx
// ĐÚNG: branch cấp element; class đến từ entry, cùng chỗ với tập con và lý do.
registry["routed-page-main"] = {
    host: "main",
    classes: ["flex", "min-w-0", "grow", "flex-col"],
    children: { page: { leaf: "page" } },
    why: "Trang được route là vùng người đọc đến để xem, nên nó là landmark của document và có thể nhảy thẳng vào, vượt qua điều hướng phía trên.",
}
```

### Case: ai đó muốn một biến thể `compact`

```tsx
// SAI: branch bắt đầu có ý kiến riêng về khoảng cách. Nó đang trở thành một registry thứ hai — mà là
// một registry không có chỗ nào ghi `why`.
<MainFrame compact contract="routed-page-main" render={…} />
```

```tsx
// ĐÚNG: nếu màn hình này thật sự cần một nhịp khác, đó là một key khác, và key đó nói ra lý do.
registry["routed-page-main-dense"] = {
    host: "main",
    classes: ["flex", "min-w-0", "grow", "flex-col"],
    children: { page: { leaf: "page" } },
    why: "Khu vực làm bài không có chrome phụ nào bên dưới navbar, nên trang tự cầm toàn bộ chiều cao còn lại thay vì chừa lề cho thứ không tồn tại.",
}
```

### Ngoại lệ và nhầm lẫn

- **`data-*` không phải class và không phải ngoại lệ.** Branch được gắn thuộc tính tra cứu, vì chúng
  không quyết định gì cả:

  ```tsx
  <main data-node={contract} data-why={registry[contract].why} {...nodeProps(contract)}>
  ```

- **`min-w-0` "chỉ một cái thôi" vẫn là một class.** Nó vẫn quyết định một hành vi layout, và chỗ của
  quyết định đó là entry.
- **Đây không phải luật về `LANDMARK-3`.** Một branch mang class vẫn có thể mở đúng element; nó hỏng ở
  chỗ **truy nguyên**, không ở chỗ **ý nghĩa**.

---

## `LANDMARK-3` — element không phải một prop

### Case: đề xuất `as`

```tsx
// SAI: ý nghĩa của document nằm cùng dòng với các quyết định giao diện, và mặc định là `div`.
// Màn hình đầu tiên quên prop này là màn hình không ai nhảy vào được — mà trông vẫn y hệt.
<Frame as="main" contract="routed-page-main" render={…} />
```

```tsx
// ĐÚNG: entry đã nói element, nên call site không có gì để quên.
<Frame contract="routed-page-main" render={…} />
```

### Case: props của branch đóng lại

```tsx
/** Props của branch vẽ một node. Đúng hai thứ, và không thứ nào là một tag. */
export interface FrameProps<K extends ContractKey> {
    /** Key của registry. Quyết định layout DUY NHẤT mà người viết màn hình được đưa ra. */
    contract: K
    /** Nội dung đã được kiểm là khớp đúng key này. */
    render: ContractComponent<NoInfer<K>>
}
```

Không có `as`, `element`, `tag` hay `component`. `<Frame as="main">` không phải một lựa chọn tồi — nó
**không compile được**, và đó là tầng giữ mạnh nhất mà module này có.

### Case: element đến từ entry

```tsx
export const Frame = <const K extends ContractKey>({ contract, render }: FrameProps<K>) => {
    // Vắng `host` nghĩa là node này không mang ý nghĩa riêng nào cho document.
    const Host = registry[contract].host ?? "div"
    return (
        <Host {...nodeProps(contract)}>
            <Content contract={contract} render={render} />
        </Host>
    )
}
```

### Ngoại lệ và nhầm lẫn

- **`host` là một union đóng, không phải một chuỗi bất kỳ.** Cái ngăn `host: "marquee"` là kiểu, không
  phải review:

  ```tsx
  export type ContractHost =
      | "div" | "ul" | "ol" | "li" | "form" | "nav" | "main" | "section" | "header" | "footer" | "aside"
  ```

- **Đây không phải lệnh cấm mọi polymorphic component.** Luật cấm **element mang ý nghĩa cho document**
  bị chọn ở call site. Một `Button` chuyển thành `a` khi có `href` không nằm trong phạm vi này.
- **Một prop hợp lệ đặt đúng file route vẫn sai.** Chỗ đặt là chuyện của `LANDMARK-5`; ai được chọn là
  chuyện của mã này.

---

## `LANDMARK-4` — layout dựng chrome là người đánh dấu

### Case: layout vừa vẽ điều hướng vừa nhận trang

```tsx
// ĐÚNG: điều hướng là anh em của trang được route, và trang là landmark.
const DashboardLayout = ({ children }: { children: ReactNode }) => (
    <Frame
        contract="nav-over-body-page"
        render={defineNode("nav-over-body-page", {
            navigation: defineProjection("double-navbar", () => <ShellNav />),
            body: defineProjection("routed-page-main", () => (
                <Frame
                    contract="routed-page-main"
                    render={defineNode("routed-page-main", {
                        page: defineLeaf("page", {}, () => children),
                    })}
                />
            )),
        })}
    />
)
```

```tsx
// SAI: key nói "main", DOM nói "div". Ý định được ghi lại đầy đủ và không ai với tới được.
body: defineLeaf("page", {}, () => children),
```

Hai bản khác nhau đúng một điều: người đọc có bỏ qua được điều hướng để tới thẳng trang hay không.

### Case: layout gốc — không bị hỏi tới

```tsx
// Nó vẽ khung tài liệu và gắn provider. Đánh dấu ở đây là tự tay đặt landmark thứ hai vào document.
const RootLayout = ({ children }: { children: ReactNode }) => (
    <html lang="vi">
        <body>
            <AppProviders>{children}</AppProviders>
        </body>
    </html>
)
```

### Case: layout trung chuyển — cũng không bị hỏi tới

```tsx
// Nó không dựng chrome nào; chrome thuộc về layout bên ngoài. Nó chỉ chuyển trang đi tiếp.
const SettingsLayout = ({ children }: { children: ReactNode }) => <>{children}</>
```

### Case: route không có layout dựng chrome

```tsx
// Trang này là người dựng ngoài cùng của màn hình, nên landmark thuộc về nó. Bắt đẩy lên trên đồng
// nghĩa với việc bịa ra một layout mà việc duy nhất là bọc.
const StandaloneReportPage = () => (
    <Frame
        contract="report-page"
        render={defineNode("report-page", {
            title: defineLeaf("heading", {}, () => "Báo cáo tháng"),
            body: defineProjection("report-body", () => <ReportBody />),
        })}
    />
)
```

### Ngoại lệ và nhầm lẫn

- **`children` đi qua callback vẫn là `children`.** Một layout đưa nó cho builder không vì thế mà
  thoát:

  ```tsx
  // Vẫn là layout dựng chrome đang cầm trang được route — chỉ là nó cầm gián tiếp.
  body: defineProjection("routed-page-main", () => renderPageBody(children)),
  ```

- **Điều kiện là "dựng chrome", không phải "có `children`".** Nếu chỉ cần chạm tới `children` là bị
  hỏi, layout gốc và layout trung chuyển đều bị hỏi, và thoả mãn chúng sẽ đặt vào document đúng cái
  landmark thứ hai mà `LANDMARK-5` từ chối. Độ thô đó đã đo được thật, và đó là lý do điều kiện hẹp
  như hiện nay.
- **Một layout có thể dựng chrome mà không có `nav`.** Chrome là bất cứ thứ gì lặp lại quanh trang:
  thanh tiến độ, breadcrumb, thanh công cụ của khu vực.

---

## `LANDMARK-5` — một `main` cho mỗi document

### Case: cái bẫy mà luật này được viết ra để chặn

```tsx
// SAI: `dashboard-main` là CỘT ĐỌC nằm cạnh rail, không phải trang. Vẽ nó bằng branch landmark là
// đặt một `main` thứ hai bên dưới cái mà layout đã mở.
<MainFrame contract="dashboard-main" render={…} />
```

```tsx
// ĐÚNG: cột là một hình dạng, nên nó ở lại branch thường. Landmark đã được nhận ở một tầng trên.
<Frame contract="dashboard-main" render={…} />
```

Hai bản khác nhau đúng một điều: document có một landmark hay có mấy cái.

### Case: entry của cột đọc không được khai host

```tsx
// SAI: cái tên đã dụ được entry. Ba key kiểu này trên một màn hình là ba lần nhận landmark.
registry["profile-main"] = {
    host: "main",
    classes: ["flex", "min-w-0", "grow", "flex-col", "gap-6"],
    children: { section: { contract: "label-row-over-card", repeats: true } },
    why: "…",
}
```

```tsx
// ĐÚNG: không khai host. Cột đọc mở `div`, và `why` làm rõ nó là một phần của trang.
registry["profile-main"] = {
    classes: ["flex", "min-w-0", "grow", "flex-col", "gap-6"],
    children: { section: { contract: "label-row-over-card", repeats: true } },
    why: "Mỗi họ bằng chứng của hồ sơ là một section được gọi tên và tự tiếp đất, còn mọi họ giữ chung một nhịp đọc.",
}
```

**Cái tên là một cái tên; `host` mới là một lời hứa.**

### Case: bề mặt trang mang entry khai host

```tsx
// components/pages/Report/index.tsx — người vẽ node ngoài cùng của màn hình.
// Entry nói element; không ai import landmark nào cả, nên đây không phải cái bẫy ở trên.
const ReportPage = () => (
    <Frame
        contract="report-page"
        render={defineNode("report-page", {
            header: defineProjection("page-header-stack", () => <ReportHeader />),
            body: defineProjection("report-body", () => <ReportBody />),
        })}
    />
)
```

### Case: branch landmark rơi vào một block

```tsx
// SAI: block vẽ một PHẦN của màn hình. Landmark thêm vào đây là cái thứ hai, không phải cái mạnh hơn.
const ResultsBlock = ({ results }: ResultsBlockProps) => (
    <MainFrame contract="results-column" render={defineNode("results-column", { … })} />
)
```

### Ngoại lệ và nhầm lẫn

- **Hai vật mang, hai tập file, và gộp lại từng là lỗi thật.** Branch landmark ở lại file route; entry
  khai host được phép ở bề mặt trang, vì người render node ngoài cùng của màn hình chính là bề mặt
  trang chứ không phải file route:

  ```tsx
  // app/[lang]/report/page.tsx — route gắn trang vào URL và tự nó không vẽ gì.
  const Page = () => <ReportPage />
  ```

- **Không rule nào thấy được trường hợp xuyên file.** Một layout mở landmark và một trang bên dưới nó
  cũng mở landmark là hai file hợp lệ riêng lẻ. Đó là câu hỏi review, và luật nói thẳng như vậy thay
  vì giả vờ có bảo đảm.
- **`nav` thứ hai không sai theo mã này.** Một document được phép có nhiều `nav`; điều `LANDMARK-5`
  nói tới là `main`.

---

## Ánh xạ yêu cầu sang một file và một vật mang

Nêu file, vai trò của nó với màn hình, và vật mang. Nếu thiếu **một** dữ kiện quyết định, hỏi **một**
câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm một rail điều hướng thật cho khu vực này | Cần element mới, không cần cờ mới | `LANDMARK-1` | Thêm `NavFrame`, một file |
| Cho mình truyền class vào branch landmark cho nhanh | Class thuộc về key cùng chỗ với `why` | `LANDMARK-2` | Sửa entry, không sửa branch |
| Gộp hai branch lại, nhận `as` cho gọn | Element là ý nghĩa của document | `LANDMARK-3` | Giữ hai branch; call site không chọn element |
| Layout này vẽ navbar rồi nhận trang | File này biết chỗ điều hướng kết thúc | `LANDMARK-4` | Bọc `children` bằng vật mang landmark |
| Route này không có layout, trang tự dựng cả màn hình | Trang là người dựng ngoài cùng | `LANDMARK-4` | Landmark ở chính trang đó |
| Key `dashboard-main` render ra `div`, sửa cho đúng tên đi | Key này là cột đọc, không phải trang | `LANDMARK-5` | Giữ `div`; không khai `host` |
| Cho bề mặt trang mở `main` | Entry khai host, không ai import landmark | `LANDMARK-5` | Được, ở bề mặt trang |
| Block kết quả nên là `main` cho đúng nghĩa | Block vẽ một phần màn hình | `LANDMARK-5` | Từ chối; landmark ở tầng trên |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `LANDMARK-1` / `LANDMARK-3` | Vấn đề là **có bao nhiêu branch**, hay là **ai chọn element**? |
| `LANDMARK-1` / `LANDMARK-2` | Branch mới có mọc thêm thứ gì ngoài element không? |
| `LANDMARK-2` / `LANDMARK-3` | Mất đi là **lý do** của layout, hay **ý nghĩa** của document? |
| `LANDMARK-4` / `LANDMARK-5` | File này **phải** đánh dấu, hay **không được** đánh dấu? |
| `LANDMARK-5` — hai vật mang | Có ai **import** một landmark không, hay registry nói element? |
| `LANDMARK-5` — key hay trang | Bỏ node này đi thì mất cả trang, hay chỉ mất một cột? |

## Sai lầm lặp lại nhiều nhất

1. Tin cái tên trong key: `*-main` được đọc thành landmark.
2. Viết `<main>` bằng tay, nên không có gì ghi lại class, con và lý do.
3. Gộp branch rồi nhận `as`, và màn hình đầu tiên quên prop là màn hình không nhảy vào được.
4. Nhét class vào branch landmark, khiến "vì sao rộng chừng này" có hai câu trả lời.
5. Vẽ cột đọc bằng branch landmark, đặt `main` thứ hai vào document.
6. Bắt layout gốc hoặc layout trung chuyển đánh dấu, cũng đặt `main` thứ hai vào document.
7. Tin rằng lint đã thấy hết — trường hợp layout và trang **cùng** mở landmark không rule nào thấy.
