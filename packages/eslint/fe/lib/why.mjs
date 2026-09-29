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
 * Every rule that carries a catalogue id (R18, R49-R52, R55, R56, R58, R60-R62, R65-R67) has an entry;
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
    vi: "`fetch` (hoặc thư viện HTTP khác) ở `<file>` nằm ngoài `modules/api/client.ts`. Mỗi app chỉ có đúng một đường truyền.",
    fixVi: "Gọi client của app và nhận `Outcome<T>`; không tự gọi `fetch`.",
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
    vi: "Client ở `<file>` không đổi 401/403 thành `refused`, nên trạng thái \"cần đăng nhập\" không bao giờ đạt được.",
    fixVi: "Thêm nhánh 401/403 trả `{ kind: \"refused\" }` trong client.",
  },
  "no-http-status-collapse": {
    code: "FE_HTTP_STATUS_COLLAPSE",
    vi: "`<file>` gộp mọi mã HTTP thành một nhánh (hoặc trả null khi phản hồi lỗi). 401/403 phải thành `refused`.",
    fixVi: "Trả `Outcome` theo mã: `refused` (401/403), `not-found`, `invalid`, `unavailable`; không trả nguyên văn lỗi của server làm lý do.",
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
  "e2e-spec-location": {
    code: "FE_E2E_SHAPE",
    vi: "Spec e2e `<file>` không nằm ở `e2e/<area>/<name>.e2e-spec.ts`.",
    fixVi: "Đưa spec vào `e2e/<area>/` với hậu tố `.e2e-spec.ts`; helper vào `e2e/support/` hoặc `e2e/fixtures/`.",
  },
  "e2e-no-absolute-path": {
    code: "FE_E2E_SHAPE",
    vi: "Spec e2e `<file>` dùng đường dẫn tuyệt đối.",
    fixVi: "Dựng đường dẫn từ cấu hình hoặc thư mục của chính spec.",
  },
  "e2e-no-docker": {
    code: "FE_E2E_SHAPE",
    vi: "Spec e2e `<file>` phụ thuộc vào docker.",
    fixVi: "Trỏ suite tới một URL từ cấu hình; môi trường tự cung cấp stack.",
  },
  "e2e-no-cross-repo-write": {
    code: "FE_E2E_SHAPE",
    vi: "Spec e2e `<file>` ghi ra ngoài repo của app (đường dẫn tuyệt đối hoặc `..`).",
    fixVi: "Chỉ ghi vào thư mục kết quả của chính repo này.",
  },
  "e2e-no-skip": {
    code: "FE_E2E_SHAPE",
    vi: "Spec e2e `<file>` bỏ qua test (`test.skip`/`fixme`) — thiếu môi trường phải làm suite đỏ, không được xanh.",
    fixVi: "Sửa môi trường hoặc xóa test; không bỏ qua có điều kiện.",
  },
  "e2e-typed-helpers": {
    code: "FE_E2E_SHAPE",
    vi: "Helper e2e ở `<file>` có tham số không kiểu hoặc dùng `any`.",
    fixVi: "Khai kiểu cho mọi tham số của helper; thay `any` bằng kiểu thật hoặc `unknown` kèm kiểm tra.",
  },
  "playwright-viewports": {
    code: "FE_E2E_SHAPE",
    vi: "`playwright.config` không khai đúng ba viewport 1440x900, 768x1024, 390x844.",
    fixVi: "Mỗi project khai một viewport; đủ ba, không thêm cỡ thứ tư.",
  },
  "no-class-string-in-spec": {
    code: "FE_SPEC_QUALITY",
    vi: "Spec `<file>` ghim chuỗi class. Spec kiểm hành vi, không kiểm stylesheet.",
    fixVi: "Assert theo role, tên, trạng thái hoặc chữ hiển thị.",
  },
  "spec-tests-its-neighbour": {
    code: "FE_SPEC_QUALITY",
    vi: "Spec `<file>` không import chủ thể nằm cạnh nó.",
    fixVi: "Đưa spec về cạnh chủ thể, hoặc test đúng đơn vị nằm cạnh.",
  },
  "no-barrel-spec": {
    code: "FE_SPEC_QUALITY",
    vi: "Spec `<file>` đặt cạnh một barrel. Barrel không có hành vi để test.",
    fixVi: "Xóa spec; test từng đơn vị mà barrel xuất lại, cạnh chính đơn vị đó.",
  },
  "no-double-cast-in-spec": {
    code: "FE_SPEC_QUALITY",
    vi: "Spec `<file>` ép kiểu hai lần (`as unknown as`).",
    fixVi: "Dựng giá trị bằng factory có kiểu (`mock<T>()` hoặc fixture builder).",
  },
  "connected-spec-has-axe": {
    code: "FE_SPEC_QUALITY",
    vi: "Spec `<file>` của màn hình kết nối không có assert axe.",
    fixVi: "Thêm `expect(await axe(container)).toHaveNoViolations()`.",
  },
  "no-mocked-translations": {
    code: "FE_I18N_CATALOG",
    vi: "Spec `<file>` giả lập `next-intl`, nên chỉ kiểm khóa chứ không kiểm catalog thật.",
    fixVi: "Render trong `NextIntlClientProvider` với `messages/<locale>.json` thật.",
  },
  "no-inline-lint-config": {
    code: "HFS_INLINE_SUPPRESSION",
    vi: "Có chú thích tắt luật ở `<file>:<line>`. HFS không cho tắt tại chỗ — sửa code, hoặc đề xuất đổi luật.",
    fixVi: "Xóa `eslint-disable`, `@ts-ignore`, `@ts-expect-error` hoặc `vn-ok` và sửa nguyên nhân.",
  },
}
