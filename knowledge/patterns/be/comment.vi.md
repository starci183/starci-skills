# Chú thích

Tệp này trả lời một câu hỏi: cho một khai báo hay câu lệnh backend, nó có mang chú thích không,
chú thích đứng ở đâu, và nói gì?

Nguồn: `features/api/core/graphql/mutations/courses/add-to-cart/*`,
`features/api/core/graphql/queries/courses/course/course.handler.ts`,
`modules/platform/exceptions/errors/abstract.ts`, `errors/courses/challenge-not-found.ts`,
`modules/platform/exceptions/filters/abstract-exception-http.filter.ts`,
`modules/databases/postgresql/primary/enums/locale.ts`,
`modules/api/apollo/server/monolithic/monolithic-apollo-server.module.ts`, `eslint.config.mjs`.

## BE-COMMENT-1 — Mọi export có docblock, đặt sau các decorator

1676 trên 2009 tệp không phải spec dưới `features/api/core/graphql` chứa docblock; lint
`require-export-jsdoc` ở mức error. Khối này nằm giữa các decorator của lớp và `export class`.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Resolver | `@Resolver()\n/**\n * GraphQL entry for adding a course to the current user's shopping cart.\n */\nexport class AddToCartResolver` |
| Trường hợp 2 | Handler | `@CommandHandler(AddToCartCommand)\n@Injectable()\n/**\n * Handler for the addToCart mutation.\n *\n * Idempotently places a \`(user, course)\` row into the cart: …\n */\nexport class AddToCartHandler` |
| Trường hợp 3 | Module | `@Module({ … })\n/** Isolated Nest registration for staging a course in the cart before checkout. */\nexport class AddToCartSingleMutationModule` |
| Trường hợp 4 | Kiểu đầu vào | `@InputType({ description: "…" })\n/** Request for the addToCart mutation -- identifies the course to add to the caller's cart. */\nexport class AddToCartRequest` |
| Trường hợp 5 | Export không decorator | ngay phía trên: `/** CQRS command carrying the request/user context for the addToCart mutation. */\nexport class AddToCartCommand` |
| Trường hợp 6 | Interceptor | `@Injectable()\n/**\n * Interceptor that wraps resolver result in { data, message, success } and handles errors.\n *\n * @example\n * Use @GraphQLSuccessMessage("Done") on a resolver; …\n */` |

## BE-COMMENT-2 — Docblock nêu trách nhiệm và bất biến, không nêu tên

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Vì sao một trường nullable | `\`data\` … is marked \`nullable: true\` because the transform interceptor sets \`data = null\` on the error path -- a non-nullable field would crash GraphQL and mask the real error instead of surfacing it.` (`AddToCartResponse`) |
| Trường hợp 2 | Vì sao một lớp tồn tại | `Nest's default filter only maps subclasses of \`HttpException\` to their status code -- \`AbstractException\` extends plain \`Error\`, so without this filter every thrown \`AbstractException\` falls through to a generic 500.` (`AbstractExceptionHttpFilter`) |
| Trường hợp 3 | Điều không được xảy ra | `Fails the request when the challenge id is unknown -- downstream must not grade a ghost challenge.` (`ChallengeNotFoundException`) |
| Trường hợp 4 | Ai ném nó | `Thrown by \`AiEntitlementService.consume\` when the user has no remaining allowance in one of the sliding windows, …` |
| Trường hợp 5 | Nhắc lại tên | `/** Constructor. */` vẫn xuất hiện ở 27 tệp (`add-to-cart.handler.ts` trong số đó); lint `no-restated-name-jsdoc` gọi tên nó là nợ, không phải mẫu |

## BE-COMMENT-3 — Phương thức và trường

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Phương thức | `/**\n * Processes the addToCart command.\n * @param command - The command carrying request + authenticated user.\n * @returns The cart row holding the course (created or already present).\n */` |
| Trường hợp 2 | Trường | `/** Unique error code for identification */ readonly code: string`; `/** Id of the course the user wants to place in their cart. */ courseId: string` |
| Trường hợp 3 | Trường interface có tham chiếu chéo | `/** Enrollment id for the active course (user x course), injected by {@link GraphQLEnrollmentGuard} from the \`x-course-id\` header. … */ enrollmentId?: string` |
| Trường hợp 4 | Generic | `@template TParams - The parameters type.` (`ICQRSHandler`) |

## BE-COMMENT-4 — Mỗi thành viên enum đều được chú thích

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | `Locale` | `/** Serve Vietnamese copy; missing Vi falls through to \`fallbackLocale\`. */ Vi = "vi", /** Serve English copy; also the usual \`defaultLocale\` / fallback. */ En = "en"` (lint `require-enum-member-jsdoc`) |

## BE-COMMENT-5 — Chú thích dòng là văn xuôi về lý do

9720 dòng `//` tồn tại trong `src/` không kể spec. Chúng đứng trên câu lệnh, viết thường theo dạng
câu, và đưa ra hệ quả thúc đẩy đoạn mã.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Một chốt chặn | `// reject unauthenticated callers up front -- cart rows are per-user` |
| Trường hợp 2 | Một ràng buộc | `// idempotent add: if the (user, course) row already exists, return it as-is --\n// creating a second one would violate UQ_cart_items_user_course` |
| Trường hợp 3 | Một quyết định phạm vi | `// a course the user already OWNS must not be carted -- real enrollment (paid)\n// only, so a trial/preview row (is_enrolled = false) still allows adding to cart` |
| Trường hợp 4 | Một lượt chuyển giao | `// hand off to the command handler which performs the DB work` |
| Trường hợp 5 | Chính sách lỗi | `// any OTHER error (graphql-js's own execution errors …) is by definition an UNEXPECTED server bug, never the client's fault -- default it to 500 too` |
| Trường hợp 6 | Dấu nối ` -- ` | dùng ở 1299 trên 9720 dòng; câu trơn là dạng đa số |

## BE-COMMENT-6 — Chú thích khối cho lập luận nhiều đoạn bên trong thân

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | `course.handler.ts` | `/*\n * EITHER IDENTIFIER ADDRESSES THE SAME OBJECT, because the synchronizer writes both.\n * \`MaterializeAndUploadService\` uploads … It used to refuse anything but a display id, … That reading was wrong about the bucket …\n */` — mở bằng một khẳng định viết hoa, rồi bằng chứng, rồi lịch sử đã sửa |
| Trường hợp 2 | Cấu hình | các khối trong `eslint.config.mjs` ghi vì sao một luật ở mức error, kèm nợ đã đo (`nợ=0 (296/296)`) |

## BE-COMMENT-7 — Thứ một chú thích không bao giờ chứa

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Ký tự ngoài ASCII | lint `no-non-ascii-source`, `no-ai-symbol`, `no-emoji`; chú thích giữ ASCII |
| Trường hợp 2 | Tiếng Việt | lint `no-vietnamese`; một chuỗi tiếng Việt phát ra cho client mang theo lý do: `[Locale.Vi]: "Thêm khóa học vào giỏ hàng thành công", // vn-ok: vi-locale string emitted to clients` (lint `require-vn-ok-reason`) |
| Trường hợp 3 | Tắt luật | `eslint-disable-next-line` (lint `no-line-suppression`); ngoại lệ sống trong cấu hình kèm chú thích |
| Trường hợp 4 | Nhắc lại tên | xem BE-COMMENT-2 Trường hợp 5 |
