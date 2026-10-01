/**
 * The Vietnamese "why" of each rule the HFS catalogue assigns to this canon.
 *
 * WHERE IT IS SURFACED. An ESLint message is written for the developer at the terminal, in English,
 * and says what is wrong in the vocabulary of the rule. The agent that reads a failed land gate needs
 * the catalogue's sentence instead: the finding code (the key in `modules/kernel/failure-codes.yaml`)
 * and a Vietnamese headline and next step it can quote to the owner. This map is the canon's half of
 * that contract: `code` is the finding code, `vi` the headline with `<file>` / `<what>` placeholders
 * the reader fills from the ESLint location, `fixVi` the one sentence "what do I do now".
 *
 * Every rule that carries a catalogue id (R18, R22, R49-R59, R60-R62, R65-R67) has an entry;
 * the twin test refuses a rule of those laws with no entry and an entry for a rule that does not exist.
 */

/** @typedef {{ code: string, vi: string, fixVi: string }} Why */

/** @type {Record<string, Why>} */
export const why = {
  "no-env-outside-config": {
    code: "FE_ENV_OWNER",
    vi: "`<file>` đọc biến môi trường. Chỉ `modules/config` được đọc env.",
    fixVi: "Đọc giá trị từ export có kiểu của `modules/config` thay vì `process.env`.",
  },
  "no-hardcoded-endpoint-fallback": {
    code: "FE_ENV_OWNER",
    vi: "`<file>` có giá trị dự phòng cứng cho địa chỉ hoặc bí mật (`?? \"http://localhost…\"`). Thiếu biến ở production phải ném lỗi khi nạp cấu hình, không được lặng lẽ trỏ về máy dev.",
    fixVi: "Xóa giá trị dự phòng; để `modules/config` ném lỗi khi thiếu biến ở production.",
  },
  "fetch-only-in-api-client": {
    code: "FE_TRANSPORT_OWNER",
    vi: "`fetch` (hoặc `Request`, `EventSource`, `sendBeacon`, thư viện HTTP khác) ở `<file>` nằm ngoài client duy nhất (`modules/api/client.ts`, hoặc `src/client.ts` của gói api dùng chung). Mỗi repo chỉ có đúng một đường truyền.",
    fixVi: "Gọi client của repo và nhận `Outcome<T>`; không tự gọi `fetch`.",
  },
  "client-fetch-has-signal": {
    code: "FE_TRANSPORT_OWNER",
    vi: "`fetch` ở `<file>` không có `signal`. Client bắt buộc có timeout và `AbortSignal`.",
    fixVi: "Truyền `signal` (`AbortSignal.timeout(...)` kết hợp với tín hiệu của người gọi).",
  },
  "no-shared-transport-state": {
    code: "FE_TRANSPORT_OWNER",
    vi: "`<file>` giữ trạng thái dùng chung dạng `let`/`var` trong tầng API. Token và locale không được nằm trong singleton.",
    fixVi: "Truyền credential và locale bằng tham số hoặc context.",
  },
  "client-maps-auth-to-refused": {
    code: "FE_HTTP_STATUS_COLLAPSE",
    vi: "Client ở `<file>` không có nhánh so sánh `response.status` với 401 và 403 rồi trả `{ kind: \"refused\" }`, nên trạng thái \"cần đăng nhập\" không bao giờ đạt được.",
    fixVi: "Thêm nhánh `response.status === 401 || response.status === 403` trả `{ ok: false, kind: \"refused\" }` ngay trong client.",
  },
  "no-failure-collapse": {
    code: "FE_HTTP_STATUS_COLLAPSE",
    vi: "`<file>` gộp mọi thất bại (phản hồi HTTP lỗi hoặc `Outcome` thất bại) thành một nhánh hoặc một giá trị rỗng, nên lý do bị mất.",
    fixVi: "Giữ lý do: với `Outcome` thì rẽ nhánh theo mã lý do; với phản hồi HTTP thì đổi mã trạng thái thành `Outcome` (`refused` cho 401/403, `not-found`, `invalid`, `unavailable`). Không dùng nguyên văn lỗi của server làm lý do.",
  },
  "no-hand-typed-wire": {
    code: "FE_WIRE_GENERATED",
    vi: "`<file>` tự gõ kiểu wire hoặc ép kiểu phản hồi. Dùng kiểu sinh từ `contract/`.",
    fixVi: "Chạy codegen từ bản sao hợp đồng ở `modules/api/contract/` và nhập kiểu sinh ra; đưa tài liệu GraphQL vào tệp `.graphql`.",
  },
  "use-client-only-at-boundary": {
    code: "FE_CLIENT_BOUNDARY",
    vi: "`\"use client\"` ở `<file>` (`<slot>` không được là client component).",
    fixVi: "Đặt `\"use client\"` ở `index.tsx` của block có tương tác, leaf, hoặc `error.tsx`/`global-error.tsx`; giữ layout và page là server component.",
  },
  "hooks-folder-holds-hooks-only": {
    code: "FE_HOOKS_ARE_HOOKS",
    vi: "`<file>` trong `hooks/` không phải React hook. Reader server về `modules/api`, helper về `<domain>.shared.ts`.",
    fixVi: "Mỗi tệp `use*.ts` một hook; helper dùng chung vào `<domain>.shared.ts`; reader server vào `modules/api/<domain>/read-*.ts`.",
  },
  "no-middleware-file": {
    code: "FE_NEXT_CONVENTIONS",
    vi: "`<file>` dùng tên `middleware`. Từ Next 16 bộ chặn request là `proxy.ts` và xuất `proxy`.",
    fixVi: "Đổi tên tệp thành `proxy.ts` và đổi export thành `proxy`.",
  },
  "locale-segment-is-locale": {
    code: "FE_I18N_PLACEMENT",
    vi: "Tệp `<file>` nằm dưới segment ngôn ngữ không phải `[locale]`. Chỉ có một mẫu: `next-intl`, `[locale]`, mặc định `vi`.",
    fixVi: "Đổi tên thư mục segment thành `[locale]`.",
  },
  "no-second-i18n-stack": {
    code: "FE_I18N_PLACEMENT",
    vi: "`<file>` nhập một thư viện i18n thứ hai. App chỉ dùng `next-intl` qua `modules/i18n`.",
    fixVi: "Chuyển sang `next-intl`; xóa thư viện còn lại.",
  },
  "html-lang-from-locale": {
    code: "FE_I18N_LITERAL",
    vi: "`<html lang>` ở `<file>` là chữ cứng. Thuộc tính `lang` phải lấy từ segment `[locale]`.",
    fixVi: "Dùng `lang={locale}` từ tham số của layout `[locale]`.",
  },
  "no-hardcoded-copy": {
    code: "FE_I18N_LITERAL",
    vi: "Chữ `\"<text>\"` ở `<file>:<line>` không đi qua `t()`.",
    fixVi: "Chuyển câu vào `modules/i18n/messages/<locale>.json` và đọc bằng `t(\"khóa\")`; không có ngoại lệ và không có `vn-ok`.",
  },
  "no-raw-brand-value": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`<file>` dùng giá trị màu/độ dài thô (`<what>`). Màu và khoảng cách chỉ đến từ token grammar; màu thương hiệu chỉ ở `brand.css`.",
    fixVi: "Dùng lớp hoặc biến token của grammar; giá trị màu chỉ khai trong `modules/brand/brand.css`.",
  },
  "status-text-uses-soft-foreground": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`<file>` tô chữ hoặc icon bằng tông trạng thái đặc (`<what>`, ví dụ `text-success`). Tông đặc là màu nền; dùng làm màu chữ nó đọc dưới 4.5:1 trên nền trang.",
    fixVi: "Đổi thành cặp mềm: `text-<tông>-soft-foreground` (kèm `bg-<tông>-soft` nếu nằm trên nền nhạt); tông đặc chỉ dùng với `bg-<tông>` và `text-<tông>-foreground`.",
  },
  "no-native-form-control": {
    code: "FE_NATIVE_FORM_CONTROL",
    vi: "`<tag>` thô ở `<file>`. Dùng renderer của grammar.",
    fixVi: "Thay bằng thành phần của grammar; nếu chưa có, thêm vào grammar thay vì vẽ tại chỗ.",
  },
  "component-line-budget": {
    code: "FE_SIZE_AND_STATE_BUDGET",
    vi: "`<file>` dài `<n>` dòng, vượt ngưỡng 300 dòng của một component.",
    fixVi: "Tách phần vẽ khỏi phần dữ liệu và tách từng khu vực thành đơn vị riêng.",
  },
  "unit-hook-budget": {
    code: "FE_SIZE_AND_STATE_BUDGET",
    vi: "`<unit>` có `<n>` hook dữ liệu / `<m>` useState, vượt ngưỡng 6.",
    fixVi: "Gom trạng thái đổi cùng nhau vào reducer hoặc hook riêng; tách mỗi vùng dữ liệu thành block kết nối riêng.",
  },
  "no-hand-rolled-polling": {
    code: "FE_SIZE_AND_STATE_BUDGET",
    vi: "`<unit>` tự viết vòng poll (`setInterval` hoặc `setTimeout` tự gọi lại).",
    fixVi: "Làm tươi qua hook dữ liệu (`refreshInterval`) hoặc socket, mỗi resource đúng một cơ chế.",
  },
  "no-inline-lint-config": {
    code: "HFS_INLINE_SUPPRESSION",
    vi: "Có chú thích tắt luật ở `<file>:<line>`. HFS không cho tắt tại chỗ — sửa code, hoặc đề xuất đổi luật.",
    fixVi: "Xóa `eslint-disable`, `@ts-ignore`, `@ts-expect-error` hoặc `vn-ok` và sửa nguyên nhân.",
  },
  "no-double-cast": {
    code: "FE_TYPE_ESCAPE",
    vi: "`<file>` ép kiểu qua `unknown` (`as unknown as T`): trình biên dịch quên mọi thứ nó biết ngay tại chỗ dữ liệu đi vào.",
    fixVi: "Thu hẹp từ `unknown` bằng type guard hoặc parser; không ép kiểu.",
  },
  "no-type-assertion": {
    code: "FE_TYPE_ESCAPE",
    vi: "`<file>` dùng `as T` hoặc `<T>x`: một lời khẳng định trình biên dịch không kiểm được. Sai thì lỗi rơi vào trình duyệt của người dùng.",
    fixVi: "Thu hẹp bằng type guard, `in`, discriminant hoặc parser tại nơi dữ liệu đi vào; dùng `satisfies` nếu chỉ muốn kiểm một literal.",
  },
  "no-non-null-assertion": {
    code: "FE_TYPE_ESCAPE",
    vi: "`<file>` dùng `x!`: khẳng định giá trị có mặt mà không chứng minh.",
    fixVi: "Xử lý nhánh vắng mặt (`if`, `??`, return sớm) hoặc sửa kiểu để giá trị không thể vắng.",
  },
  "no-explicit-any": {
    code: "FE_TYPE_ESCAPE",
    vi: "`<file>` dùng `any`: tắt kiểm kiểu cho giá trị đó và mọi thứ suy ra từ nó.",
    fixVi: "Dùng kiểu thật, generic, hoặc `unknown` rồi thu hẹp tại chỗ dùng.",
  },
  "list-item-has-key": {
    code: "FE_LIST_KEY",
    vi: "Phần tử trả từ `.map` ở `<file>` không có `key`, nên React nhận diện hàng theo vị trí và hàng bị đổi state khi xoá hoặc sắp xếp lại.",
    fixVi: "Thêm `key` lấy từ id của dữ liệu; với fragment dùng `<Fragment key={...}>`.",
  },
  "no-index-key": {
    code: "FE_LIST_KEY",
    vi: "`key` ở `<file>` lấy từ chỉ số của `.map` hoặc giá trị sinh ngẫu nhiên; chỉ số là vị trí, không phải danh tính.",
    fixVi: "Dùng id mà dữ liệu mang (`key={row.id}`); không dùng index, `Math.random`, `Date.now`.",
  },
  "no-inline-literal-prop-in-list": {
    code: "FE_LIST_KEY",
    vi: "Component trong `.map` ở `<file>` nhận object hoặc array literal làm prop: mỗi hàng mỗi lần render một giá trị mới, memo không bao giờ trúng.",
    fixVi: "Nâng hằng số ra ngoài component hoặc dựng một lần trước `.map`.",
  },
  "effect-subscription-needs-cleanup": {
    code: "FE_EFFECT_CLEANUP",
    vi: "`<what>` ở `<file>` (timer, frame, listener, observer, socket hoặc subscription) được effect hoặc `subscribe` khởi động nhưng cleanup trả về không giải phóng đúng handle/target/listener đó.",
    fixVi: "Giữ handle và trả cleanup gọi `clearTimeout(id)`, `cancelAnimationFrame(id)`, `removeEventListener` cùng type và listener, `.disconnect()`, `.close()` hoặc `.unsubscribe()` trên đúng đối tượng.",
  },
  "no-data-fetch-in-effect": {
    code: "FE_EFFECT_FETCH",
    vi: "`useEffect` ở `<file>` khởi động một promise (`await`, `fetch`, `.then`, `void load()`, `mutate()`/`refresh()` gọi thẳng): không cache, không gộp request, không trạng thái loading/lỗi, không huỷ. Độ tươi của dữ liệu đến từ key của SWR, không đến từ effect.",
    fixVi: "Đọc phía client bằng SWR gọi client của app (`hooks/`) với key theo thứ thay đổi; gọi `mutate()` từ sự kiện làm dữ liệu đổi (handler, message socket); phía route dùng server reader `modules/api/<domain>/read-*.ts`.",
  },
  "no-empty-catch": {
    code: "FE_SWALLOWED_ERROR",
    vi: "`catch` hoặc `.catch` ở `<file>` không làm gì: lỗi biến mất, không thông báo, không dấu vết.",
    fixVi: "Trả một outcome có kiểu mang nguyên nhân, hiển thị trạng thái lỗi, hoặc ném lại.",
  },
  "no-console": {
    code: "FE_CONSOLE_CALL",
    vi: "`console.<method>` ở `<file>`: không vào pipeline log nào và lộ chi tiết nội bộ cho người dùng.",
    fixVi: "Trả outcome có kiểu, hiển thị trạng thái lỗi, hoặc để lỗi tới `error.tsx`.",
  },
  "page-exports-metadata": {
    code: "FE_PAGE_METADATA_MISSING",
    vi: "`<file>` là `page.tsx` nhưng không export `metadata` hoặc `generateMetadata`; mọi trang trong nhánh mang cùng một tiêu đề.",
    fixVi: "Export `metadata` (hoặc `generateMetadata` khi tiêu đề lấy từ dữ liệu) với tiêu đề và mô tả lấy từ catalog thông điệp.",
  },
  "no-null-suspense-fallback": {
    code: "FE_SUSPENSE_NULL_FALLBACK",
    vi: "`<Suspense>` ở `<file>` có `fallback` rỗng: người dùng thấy khoảng trống thay vì trạng thái đang tải.",
    fixVi: "Truyền skeleton (trạng thái loading) của đúng thứ đang tải làm `fallback`.",
  },
  "navigation-from-intl": {
    code: "FE_I18N_NAVIGATION",
    vi: "`<file>` nhập `Link`, `useRouter`, `usePathname` hoặc `redirect` từ Next, không biết locale: đường dẫn mất tiền tố `[locale]`.",
    fixVi: "Nhập từ `modules/i18n/navigation`, được next-intl dựng từ `routing.ts`.",
  },
  "no-native-anchor": {
    code: "FE_I18N_NAVIGATION",
    vi: "`<a>` ở `<file>` trỏ route nội bộ (tải lại cả trang, mất locale, mất prefetch) hoặc mở tab mới mà không có `rel`.",
    fixVi: "Dùng `Link` từ `modules/i18n/navigation` với href dựng bởi `modules/routes`; liên kết `_blank` thêm `rel=\"noopener noreferrer\"`.",
  },
  "use-intl-formatter": {
    code: "FE_I18N_FORMATTER",
    vi: "`<file>` định dạng số, tiền hoặc ngày bằng `toLocale*String`, `new Intl.*`, `toFixed`, ký hiệu tiền dán vào template hoặc thư viện ngày, thay vì formatter của next-intl.",
    fixVi: "Dùng `useFormatter()` (hoặc `getFormatter()` ở server): `number(...)`, `dateTime(...)`, `relativeTime(...)`.",
  },
  "no-hardcoded-route": {
    code: "FE_ROUTE_HARDCODED",
    vi: "`<file>` viết thẳng đường dẫn route ở nơi gọi; route đổi chỗ thì bản sao trỏ vào 404.",
    fixVi: "Dựng href bằng hàm của `modules/routes` và dùng đúng hàm đó ở mọi nơi.",
  },
  "client-no-server-import": {
    code: "FE_CLIENT_SERVER_IMPORT",
    vi: "Client component ở `<file>` nhập mã chỉ tồn tại ở server (`server-only`, `next/headers`, module Node, server reader).",
    fixVi: "Đọc dữ liệu ở server component hoặc server reader rồi truyền xuống bằng props; hoặc dùng SWR gọi client của app.",
  },
  "server-module-marks-server-only": {
    code: "FE_SERVER_ONLY_MARK",
    vi: "Module `<file>` nhập API chỉ có ở server (`next/headers`, `next/server`, `next-intl/server`, module Node hoặc module đã là server-only) nhưng không mở đầu bằng `import \"server-only\"`.",
    fixVi: "Đặt `import \"server-only\"` làm câu lệnh đầu tiên của tệp; tệp route (`page`, `layout`, `route`, `proxy`) là server component sẵn nên không cần.",
  },
  "web-storage-only-in-modules": {
    code: "FE_STORAGE_OUTSIDE_MODULES",
    vi: "`<file>` dùng `localStorage`/`sessionStorage` ngoài `modules/`; storage không có ở server và ném lỗi khi đầy hạn mức.",
    fixVi: "Đặt đọc/ghi sau một hook hoặc module trong `modules/` có bảo vệ (`typeof window`, try/catch) rồi gọi từ block.",
  },
  "no-dangerous-html": {
    code: "FE_DANGEROUS_HTML",
    vi: "`dangerouslySetInnerHTML` trên `<tag>` ở `<file>`: chuỗi bất kỳ trở thành HTML chạy được.",
    fixVi: "Render nội dung thành phần tử; chỉ `<script>` mang JSON-LD hoặc mã theme từ hằng số của app mới được dùng.",
  },
  "response-cookie-attributes": {
    code: "FE_COOKIE_ATTRIBUTES",
    vi: "`<file>` ghi cookie qua cookie phản hồi của Next mà không nêu `httpOnly` cố định, thiếu `secure` hoặc `sameSite` không phải `lax`/`strict`.",
    fixVi: "Truyền một hằng số options `as const` của module sở hữu cookie: `httpOnly: true` (chỉ `false` cho cookie tùy chọn script cần đọc), `secure` từ `modules/config`, `sameSite: \"lax\"` hoặc `\"strict\"`.",
  },
  "props-fields-readonly": {
    code: "FE_PROPS_MUTABLE",
    vi: "Kiểu props của component ở `<file>` có field hoặc collection không `readonly`, nên component có thể ghi vào thứ nó được truyền.",
    fixVi: "Đánh dấu `readonly` cho mọi field và index signature, viết collection là `readonly T[]`, `readonly [A, B]` hoặc `ReadonlyArray<T>`.",
  },
  "no-native-img": {
    code: "FE_NATIVE_IMAGE",
    vi: "`<img>` thô ở `<file>`: tải ảnh gốc, không giữ chỗ nên trang nhảy khi ảnh tải xong.",
    fixVi: "Dùng `Image` của `next/image` với `width` và `height` (hoặc `fill` và `sizes`) và `alt` từ catalog.",
  },
  "image-has-size": {
    code: "FE_NATIVE_IMAGE",
    vi: "`Image` ở `<file>` thiếu `width` và `height` (hoặc `fill` mà thiếu `sizes`): trình duyệt không giữ chỗ được.",
    fixVi: "Cho đủ `width` và `height`, hoặc `fill` trong khung có kích thước kèm `sizes`.",
  },
  "outcome-kinds-exhaustive": {
    code: "FE_OUTCOME_KIND_UNHANDLED",
    vi: "`switch` trên `kind` ở `<file>` có nhánh `ok` nhưng thiếu một trong refused, invalid, not-found, unavailable.",
    fixVi: "Viết đủ năm nhánh của `Outcome<T>`, mỗi nhánh một màn; không dựa vào `default`.",
  },
  "one-outcome-union": {
    code: "FE_HTTP_STATUS_COLLAPSE",
    vi: "`<file>` khai báo thêm một union kết quả (`ok` hoặc `kind`) ngoài `outcome.ts`. Repo chỉ có một `Outcome<T>`.",
    fixVi: "Dùng `Outcome<T>` của `modules/api/outcome.ts` (hoặc gói api dùng chung); thêm chi tiết nghiệp vụ qua tham số thứ hai thay vì khai báo union mới.",
  },
  "i18n-stack-in-one-module": {
    code: "FE_I18N_PLACEMENT",
    vi: "`<file>` tự dựng một tầng của stack next-intl (`defineRouting`, `createNavigation`, `getRequestConfig`, `createMiddleware`). Stack chỉ được viết một lần cho cả repo.",
    fixVi: "Gọi factory `createAppI18n` của gói i18n dùng chung trong `modules/i18n/index.ts` và nhập kết quả; repo một app thì chỉ viết stack trong `modules/i18n` của app đó.",
  },
  "no-raw-structural-element": {
    code: "FE_NATIVE_FORM_CONTROL",
    vi: "`<tag>` thô ở `<file>`. Cấu trúc trang và chữ được ghép từ component của grammar, không viết HTML thô.",
    fixVi: "Thay bằng component grammar tương ứng (`Heading`, `Text`, `SurfaceCard`, ...); nếu grammar chưa có, thêm vào grammar hoặc gói ui thay vì vẽ tại chỗ.",
  },
  "file-size-growth": {
    code: "HFS_SIZE_GROWTH",
    vi: "`<file>` vượt ngân sách dòng: file mới đã dài quá mức, hoặc file cũ dài hơn bản ở commit cha. Mỗi file phải nhỏ để một người đọc hết và một bài test phủ hết.",
    fixVi: "Tách phần mới sang file riêng theo trách nhiệm; một file đã vượt ngân sách chỉ được giữ nguyên hoặc ngắn lại.",
  },
}
