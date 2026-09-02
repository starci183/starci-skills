# Chú thích

Tệp này trả lời một câu hỏi: cho một khai báo hay câu lệnh frontend, nó có mang chú thích không,
và chú thích ấy nói gì?

Nguồn: `src/components/pages/AuthenticationPage/*`, `blocks/ai/StarCiAiChat/*`,
`blocks/ai/CourseAdvisorRecommendationCard/*`, `hooks/index.ts`, `hooks/swr/useQueryCourseSwr.ts`,
`hooks/swr/useMutateAddToCartSwr.ts`, `modules/api/graphql/queries/query-course.ts`,
`eslint.config.mjs`.

## FE-COMMENT-1 — Mọi export đều mang docblock

415 trên 417 tệp component không phải spec chứa một khối `/** */`; lint `require-export-jsdoc`
ép điều này.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Một component | `/** Render the connected cart route. */` · `/** Draw every AI-owner state from resolved fixture data; no transport or translation lives here. */` |
| Trường hợp 2 | Một kiểu props | `/** Complete state/data/action contract for the pure advisor surface. */` · `/** Closed leaf props for a button-treatment sample. */` |
| Trường hợp 3 | Một export class-name | `/** Messenger-like visual roles owned by the StarCi course-advisor surface. */` · `/** Grammar-owned page frame; this app alias adds no visual override. */` |
| Trường hợp 4 | Một hằng | `/** Canonical state inventory shared by connected owners and presentation tests. */` · `/** The key prefix, so a caller can revalidate every course read at once. */` |
| Trường hợp 5 | Một route | `/** The routed authentication screen. The route mounts one page and makes no drawing decision. */` |

Câu một dòng nêu quyền sở hữu hoặc vai trò ("owned by", "resolved by the connected owner", "no
transport lives here"), không nêu lại tên.

## FE-COMMENT-2 — Trường được chú thích khi tên chưa đủ nói

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Một bộ xử lý | `/** Called after the panel establishes a session. */ readonly signedIn?: () => void` |
| Trường hợp 2 | Một prop mà nguồn gốc quan trọng | `/** URL-owned journey rendered before the browser hydrates stored challenge metadata. */ readonly initialMode?: AuthMode` |
| Trường hợp 3 | Một tham số hook | `/** The short human-facing identifier the route carries - \`fullstack-mastery\`, not a UUID. */ displayId?: string` |
| Trường hợp 4 | Một prop Grammar | `/** Pending belongs to the action that started the work and blocks duplicate presses. */ readonly isPending?: boolean` |
| Trường hợp 5 | Trường tự hiển nhiên | `readonly id: string`, `readonly body: string` không mang gì |

## FE-COMMENT-3 — Văn xuôi lý giải quyết định trên hook và tài liệu

Hook và module GraphQL mang docblock nhiều đoạn; mỗi đoạn mở bằng một khẳng định viết hoa rồi đưa
ra lý do đã đo được.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Quyết định về khóa | `THE DISPLAY ID IS PART OF THE KEY, which is what makes two course pages in one session safe: …` (`useQueryCourseSwr`) |
| Trường hợp 2 | Phương án đã bác | `IT SENDS \`displayId\` AND NEVER \`id\`, and that is a measured decision rather than a preference. … The server answers that with \`success: false, error: COURSE_NOT_FOUND_EXCEPTION\`` |
| Trường hợp 3 | Vì sao khóa mang đối số | `THE KEY CARRIES THE COURSE, and it has to. Every hook sharing a key shares its state, so a grid of cards on one key is a grid where pressing ONE card puts every other card's control into the running state` (`useMutateAddToCartSwr`) |
| Trường hợp 4 | Lý do chọn trường | `WHY THE CONTENT FACTS ARE SELECTED AND NOT ASKED FOR. …` (`query-course.ts`) |
| Trường hợp 5 | `@param` | `@param courseId - The course this hook's press is about, or \`undefined\` to stay idle.`; `@param input - {@link AuthenticationPageProps}` xuất hiện ở một page và không phải chuẩn chung |

## FE-COMMENT-4 — Chú thích dòng là câu văn về lý do

201 dòng `//` tồn tại dưới `src/components` (không kể spec). Chúng đứng trên câu lệnh và giải
thích hệ quả; không dòng nào nhắc lại mã.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Lý do của một chốt chặn | `// A server-rendered form has no React submit handler yet. Keeping its secret-bearing controls disabled until hydration prevents the browser's native GET fallback from placing an email, password or OTP in the URL when a reader acts before JavaScript attaches.` |
| Trường hợp 2 | Quyết định câu chữ | `// The transport case deliberately does NOT say the details or the code were wrong, because nobody knows that - the request never got an answer.` |
| Trường hợp 3 | Quyết định cache | `// The sign-out drops every identity entry, whichever viewer it was cached under, and leaves every other cache namespace - and every non-tuple key - exactly where it was.` |
| Trường hợp 4 | Vật thế trong kiểm thử | `// jsdom implements ranges but not their geometry, and the block asks a range where it is so the surface can be placed over it. A fixed rect is the honest stand-in: nothing here has layout.` |
| Trường hợp 5 | Ngoại lệ cấu hình | khối chú thích trên `files: ["src/modules/api/graphql/clients/options.ts"]` trong `eslint.config.mjs` nêu vì sao ngoại lệ sống trong cấu hình chứ không nội tuyến |

## FE-COMMENT-5 — Thứ một chú thích không bao giờ chứa

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Ngôn ngữ thứ hai | chỉ tiếng Anh trong mã nguồn (lint `no-second-language-in-source`, `no-second-language-in-path`); câu chữ cho người dùng nằm trong `src/messages/{en,vi}.json` |
| Trường hợp 2 | Emoji | không có (lint `no-emoji-in-source`) |
| Trường hợp 3 | Tắt lint | `eslint-disable` trong 0 tệp; cấu hình mang ngoại lệ kèm lý do |
| Trường hợp 4 | Nhắc lại tên | không thấy `/** Props for CartPage. */` đứng một mình; docblock bổ sung page sở hữu gì: `/** The page owns only the route-level composition; CartBlock owns cart state and actions. */` |
