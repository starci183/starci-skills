---
id: fe-layouts-laws-l5-every-route-has-a-real-owner-example
title: example.md
slug: /fe/layouts/laws/l5-every-route-has-a-real-owner/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của sáu mã L5-N, đọc thẳng từ năm mươi mốt file route đang sống.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l5-every-route-has-a-real-owner` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`.
Không có ví dụ bịa: một mã không có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

Phép đo nền cho cả tài liệu: quét toàn bộ `src/app` được **51 file `page.tsx`**, trong đó **48 file
mount một owner từ `@/components/pages/`**, **3 file gọi `redirect()`**, và **0 file làm việc khác**.
Không có thân file thứ ba trong repo này.

---

## `L5-1` — route mang nội dung, mount một owner

### Trường hợp: `/qa`, chính cái route từng bị bác vì chỉ có redirect

```tsx
import { CourseQaPage } from "@/components/pages/CourseQaPage"

type QaPageProps = { params: Promise<{ lang: string; displayId: string }> }

const QaPage = async ({ params }: QaPageProps) => {
    const { displayId } = await params
    return <CourseQaPage displayId={displayId} />
}
```

File giải `displayId` rồi mount. Không import contract nào, không gọi hook nào, không viết
`className` nào. Bốn mươi tám route còn lại cùng hình dạng này.

Neo phán quyết đưa route này từ redirect sang owner thật:
`.workflows\designs\starci-academy\learn-branch.md:1491`, nguyên văn "Legacy QA is a product surface;
redirect changes meaning."

### Trông giống nhưng không phải `L5-1`: mượn trang của route hàng xóm

Kế hoạch từng đề nghị dùng `CourseDetailPage` làm landing cho `/learn/content`, vì cả hai đều là
trang của một khoá học và cả hai đều render đầy màn hình. Bị bác tại
`.workflows\designs\starci-academy\learn-branch.md:755` với lý do giải phẫu trang mua khoá không phải
giải phẫu bảng điều khiển học.

Route vẫn xanh nếu làm theo đề nghị đó. Đây là lý do luật đo bằng owner có tên chứ không đo bằng
trang có hiện.

### Trông giống nhưng không phải `L5-1`: chuyển hướng route module sang trình đọc

Đề nghị đưa mọi route module thẳng tới trình đọc bài bị bác tại `…\learn-branch.md:756`, vì trang
module legacy giữ header, băng học tiếp và danh sách bài của riêng nó. Người đọc tới `/module/<id>`
để nhìn cấu trúc một chương, không phải để rơi vào một bài cụ thể.

---

## `L5-2` — cửa vào, đích nằm trong params

### Trường hợp: `/learn`

```tsx
const LearnIndexPage = async ({ params }: LearnIndexPageProps) => {
    const { lang, displayId } = await params
    redirect(`/${lang}/courses/${displayId}/learn/content`)
}
```

Hai tham số vào, một địa chỉ ra. Không truy vấn nào, nên không có gì để chờ và không có gì hỏng.

### Trường hợp: gốc `[lang]`, có sẵn lý do viết trong file

```tsx
const HomePage = async ({ params }: PageProps<"/[lang]">) => {
    const { lang } = await params
    redirect(`/${lang}/dashboard`)
}
```

Chú thích ngay trên nó ghi rằng gốc site không mang nội dung riêng trong bản dựng này, dashboard là
bề mặt duy nhất, nên gốc đưa thẳng người đọc sang đó thay vì render một phiên bản rỗng hơn của cùng
một trang. Đó chính là câu trả lời cho phép thử `contentElsewhere`, viết sẵn bằng tiếng Anh trong mã.

### Trường hợp: `/learn/flashcards`

```tsx
/** Preserves the legacy flashcards entry by forwarding to the review overview. */
const FlashcardsIndexRoute = async ({ params }: FlashcardsIndexRouteProps) => {
    const { lang, displayId } = await params
    redirect(`/${lang}/courses/${displayId}/learn/flashcards/review`)
}
```

Ba file trên là toàn bộ `L5-2` đang sống. Danh sách đóng, và một redirect thứ tư xuất hiện mà không
kèm phán quyết là dấu hiệu ai đó vừa lấp một route.

### Trông giống nhưng không phải `L5-2`

Một route chuyển hướng vì owner của nó chưa viết xong. Nhìn giống hệt ba file trên, nhưng phép thử
cho ra kết quả ngược: bỏ route đi thì mất nội dung. Đó là `L5-4`, và neo bác nằm ở
`…\learn-branch.md:495`, nguyên văn "Stub làm route “xanh” nhưng sai product behavior và vi phạm
parity."

---

## `L5-3` — cửa vào phải hỏi runtime, nên nó là một trang

### Trường hợp: `/profile`

```tsx
"use client"
import { ProfileRedirectPage } from "@/components/pages/ProfileRedirectPage"
/** Mount the canonical self-profile redirect. */
const ProfileRoute = () => <ProfileRedirectPage />
```

File route vẫn chỉ mount, đúng như `L5-1`. Khác biệt nằm trong owner:

```tsx
export const ProfileRedirectPage = () => {
    const router = useRouter()
    const me = useQueryMeSwr()
    useEffect(() => {
        if (me.data?.username) router.replace(`/profile/${me.data.username}`)
        else if (me.data === null) router.replace("/authentication")
    }, [me.data, router])
    return <_ProfileRedirectPage />
}
```

Hai kết cục rẽ từ một câu trả lời của runtime. `me.data` chưa về thì chưa nhánh nào chạy, và cái
khoảng chưa đó là một trạng thái thật mà ai đó phải sở hữu.

### Ngoại lệ: owner vẽ ra `null` vẫn là owner

```tsx
/** Render no transient screen while the canonical route resolves. */
export const _ProfileRedirectPage = () => null
```

Trông y hệt một chỗ trống, nhưng nửa thuần này khai rõ nó không vẽ màn hình quá độ nào, và đó là một
quyết định đã lấy chứ không phải một việc còn thiếu. `L5-4` nhắm vào route giả vờ có bề mặt, không
nhắm vào trang cố ý để trống.

### Trông giống nhưng không phải `L5-3`

`/learn` cũng chuyển hướng, cũng nằm trong một họ route lớn, nhưng nó không hỏi gì cả. Ai thấy hai
route đều chuyển hướng rồi kết luận chúng cùng mã là đang phân loại bằng kết quả nhìn thấy thay vì
bằng nguồn của đích.

---

## `L5-4` — nháp, hình gần giống, hoặc trang đi mượn

### Trường hợp: dựng stub cho những route `/learn` còn thiếu

Kế hoạch nhánh `/learn` đề nghị tạo stub hoặc redirect cho phần route chưa có owner, để danh sách
nhìn cho liền mạch. Bị bác tại `…\learn-branch.md:495`.

### Trường hợp: dựng UI theo hình gần giống

Bị bác hai lần với hai cách nói khác nhau. Tại `…\learn-branch.md:563`: "Legacy parity yêu cầu đúng
anatomy và state, không chỉ route tồn tại." Tại `…\learn-branch.md:640`: "Approximate UI would
violate absolute legacy parity."

Hai dòng này nên đọc cùng nhau. Dòng đầu nói route tồn tại chưa đủ, dòng sau nói bề mặt gần đúng
cũng chưa đủ.

### Trường hợp: báo xong vì route đã có và typecheck đã sạch

```text
Rejected : Gọi A2-A6 đã hoàn tất chỉ vì route/typecheck đã có
Instead  : Chọn direction rồi review với lint/live/browser evidence
Why      : Feedback agent xác nhận còn gap.
```

Neo: `…\learn-branch.md:854`. Đây là mã `L5-4` ở dạng khó thấy nhất, vì không ai viết stub cả, chỉ là
tiêu chí nghiệm thu bị hạ xuống thành trình biên dịch.

### Việc phải làm

Ghi route vào `owed` với tên owner còn nợ, không cắm redirect. Một dòng `owed` là món nợ được đếm;
một redirect lặng lẽ là món nợ biến mất khỏi sổ mà vẫn còn nguyên trong sản phẩm.

---

## `L5-5` — hai đích, luật trả lại câu hỏi

### Trường hợp: `/learn`, hai phán quyết ngược nhau và cả hai còn hiệu lực

| Vòng | Rejected | Instead | Why, nguyên văn | Neo |
|---|---|---|---|---|
| A | `/learn` redirect sang `/learn/content` | `/learn` có Today page owner thật | "“Trang hôm nay là ở route `/learn` default”." | `…\learn-branch.md:1858` |
| A, nhắc lại ở Apply | `/learn` redirect to `/learn/content` | Real `CourseLearnTodayPage` at default route | "User: “Trang hôm nay là ở route `/learn` default”." | `…\learn-branch.md:2109` |
| B, lật | Current A+B Today default | Legacy `/learn` entry to `/learn/content` | "User: “sửa learn để follow legacy”." | `.workflows\fidel\starci-academy\learn-legacy-ai-policy.md:79` |
| B, nhắc lại kèm lý do | Today as bare `/learn` default | Legacy `/learn/content` entry | "Binding legacy behavior and the user's explicit direction." | `…\learn-legacy-ai-policy.md:159` |

Phần luật giữ được, và giữ qua cả hai vòng: `/learn` không mang nội dung nào mà `/learn/content`
không mang, nên nó **được phép** là cửa vào. Phần luật không giữ: cửa đó mở sang Hôm nay hay sang
Nội dung.

### Trông giống nhưng không phải `L5-5`

Một route chỉ có một đích hợp lý nhưng người viết chưa chắc. Đó không phải `L5-5`, đó là chưa chạy
phép thử `contentElsewhere`. `L5-5` chỉ mở khi cả hai đích đều bảo vệ được bằng lý do sản phẩm.

### Cách trả lời sai duy nhất

Chọn theo lần gần nhất. Lần gần nhất là một dữ kiện về thời gian, không phải một lý do về sản phẩm,
và canon chép nó vào thì lần lật sau sẽ phải viết lại canon.

---

## `L5-6` — danh sách chết của một cú lật

### Trường hợp sống: bốn thứ vòng B để lại

```text
CourseLearnTodayPage      → không route nào mount; grep toàn src/ ngoài chính thư mục đó trả rỗng
isToday                   → LearnShellLayout\index.tsx:128 so pathname với `${base}/learn`
TODAY_TABS                → LearnShellLayout\index.tsx:95-99, chỉ mở được qua isToday
course-learn-today-page   → contracts\index.ts:293, chỉ trang mồ côi kia gọi tới
```

Owner mồ côi này không phải một khung sườn bỏ dở. Nó gọi tám hook SWR, có `component.test.tsx` chạy
được, và contract của nó khai đủ header, subtitle, primary, secondary, course, progress, notice.

### Vì sao không gate nào kêu

Cả bốn thứ vẫn biên dịch, test của owner mồ côi vẫn xanh vì nó render nửa thuần trực tiếp. Không có
lint rule nào hỏi "route nào mount trang này". Nghĩa vụ của `L5-6` vì thế đặt vào kế hoạch chứ không
đặt vào máy.

### Trông giống nhưng không phải `L5-6`

Một component không ai dùng nữa vì đã hợp nhất với component khác. Đó là dọn dẹp thông thường.
`L5-6` chỉ áp khi nguyên nhân là một phán quyết vừa dời nội dung khỏi một route, vì lúc đó cái chết
đi kèm một quyết định sản phẩm mà kế hoạch phải mang theo.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Câu phân định | Mã |
|---|---|---|
| "route này chưa có gì, redirect tạm đi" | Bỏ route đi thì mất nội dung nào? | mất → `L5-4`; không mất → `L5-2` |
| "cho `/profile` về trang của tôi" | Biết username từ đâu? | từ runtime → `L5-3` |
| "lấy trang kia dùng tạm cho route này" | Hai trang mang cùng một nghĩa chứ? | không → `L5-4` |
| "giữ địa chỉ cũ cho khỏi gãy link" | Địa chỉ cũ từng mở ra bề mặt gì? | có bề mặt → `L5-1`; không → `L5-2` |
| "xong rồi, route xanh hết" | Ai đọc owner và states? | `L5-4` cho tới khi có bằng chứng khác |
| "`/learn` nên vào đâu" | Có phán quyết chưa? | `L5-5`, hỏi thầy, không lấy lần gần nhất |
| "thầy vừa đổi ý về route đó" | Cái gì chết theo? | `L5-6`, liệt kê trước khi nhận cú lật |
