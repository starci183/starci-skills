/**
 * The Vietnamese "why" of each rule of this canon, in the same shape as `@starci/eslint-canon-fe`'s `lib/why.mjs`.
 *
 * A stylelint message is written for the developer at the terminal, in English. The agent that reads a failed land
 * gate needs the catalogue's sentence instead: the finding code (a key of `modules/kernel/failure-codes.yaml`), a
 * Vietnamese headline with `<file>` / `<what>` placeholders the reader fills from the stylelint location, and one
 * sentence "what do I do now". Every rule has an entry; the twin test refuses a rule with none and an entry for a
 * rule that does not exist.
 */

/** @typedef {{ code: string, vi: string, fixVi: string }} Why */

/** @type {Record<string, Why>} */
export const why = {
  "token-only": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "CSS ở `<file>` dùng `<what>` không phải token của grammar. Màu, khoảng cách, bo góc và chữ chỉ đến từ token grammar; một tên biến riêng là một hệ thiết kế thứ hai.",
    fixVi: "Thay bằng `var(--...)` của grammar (`--grammar-*`, token của family, token ngữ nghĩa) hoặc từ khóa trung tính.",
  },
  "raw-brand-value": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "CSS ở `<file>` viết giá trị màu/độ dài thô (`<what>`: hex, rgb, hsl, oklch hoặc px). Giá trị thô chỉ được nằm trong `modules/brand/brand.css`, có cả giá trị sáng và tối.",
    fixVi: "Dùng token grammar; nếu là màu thương hiệu thì khai ở `modules/brand/brand.css` cho cả sáng và tối.",
  },
  "no-apply-raw": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`@apply <what>` ở `<file>` áp một giá trị tùy ý hoặc giá trị thô. Giá trị tùy ý là giá trị thô đổi tên, lách qua thang của grammar.",
    fixVi: "Dùng utility có trong thang, hoặc tham chiếu token dạng `[var(--...)]`.",
  },
  "no-important": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`!important` ở `<file>` (`<what>`). Nó thắng cuộc tranh độ ưu tiên bằng cách làm lần sau không thể thắng, và làm bản ghi đè của grammar sống sót qua đợt đổi thương hiệu.",
    fixVi: "Bỏ `!important`; sửa thứ tự cascade (layer của grammar đã quyết ai thắng).",
  },
  "globals-shape": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`globals.css` (`<file>`) chứa `<what>`. File CSS toàn cục chỉ có `@import`, `@source` và khối khai token.",
    fixVi: "Chuyển phần tạo kiểu vào utility của grammar; trong `globals.css` chỉ giữ `@import`/`@source` và token là bí danh `var(--...)`.",
  },
  "no-token-redefinition": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`<file>` khai lại token của grammar (`<what>`). Token của grammar chỉ được đặt giá trị ở `modules/brand/brand.css`; CSS module hay `globals.css` khai lại làm component khác family và không đổi thương hiệu được.",
    fixVi: "Xóa khai báo; nếu cần đổi giá trị thì đổi ở `modules/brand/brand.css`, cho cả sáng và tối.",
  },
  "brand-layer-shape": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`brand.css` (`<file>`) sai hình dạng (`<what>`). Lớp thương hiệu chỉ khai token của grammar, trong một khối sáng và một khối tối, mỗi token có đủ hai giá trị.",
    fixVi: "Chỉ giữ khai báo token trong `:root` và `.dark` (hoặc `@media (prefers-color-scheme: dark)`); thêm giá trị còn thiếu cho chế độ kia.",
  },
  "no-inline-lint-config": {
    code: "HFS_INLINE_SUPPRESSION",
    vi: "Có chú thích tắt luật ở `<file>:<line>`. HFS không cho tắt tại chỗ — sửa code, hoặc đề xuất đổi luật.",
    fixVi: "Xóa `stylelint-disable` và sửa nguyên nhân.",
  },
  "no-css-module": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`<file>` là CSS module. HFS cấm `*.module.css`: một stylesheet riêng cho từng component là nơi hệ thiết kế thứ hai bắt đầu.",
    fixVi: "Xóa file; tạo kiểu bằng component và token của grammar, phần grammar còn thiếu thì bổ sung vào grammar.",
  },
  "no-class-selector": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "CSS ở `<file>` có selector class (`<what>`). CSS của app không định nghĩa component; kiểu đi qua component và token của grammar.",
    fixVi: "Xóa rule; dùng component grammar hoặc token thay cho class riêng.",
  },
  "breakpoint-scale": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`@media` ở `<file>` dùng breakpoint `<what>` ngoài thang của grammar, nên bố cục đổi ở độ rộng khác các component khác.",
    fixVi: "Dùng một breakpoint của thang grammar (30rem, 40rem, 48rem, 70rem), hoặc px tương đương ở 16px/rem.",
  },
  "source-resolves": {
    code: "FE_STYLE_SOURCE_UNRESOLVED",
    vi: "`@source` ở `<file>` trỏ tới đường dẫn không tồn tại (`<what>`). Tailwind không quét file nào và lặng lẽ làm mất các utility mà component dùng.",
    fixVi: "Sửa đường dẫn `@source` để trỏ tới thư mục có thật, tính từ chính file CSS.",
  },
  "globals-import-order": {
    code: "FE_STYLE_TOKEN_ONLY",
    vi: "`globals.css` (`<file>`) import sai thứ tự hoặc import ngoài danh sách chuẩn (`<what>`). Thứ tự chuẩn: tailwindcss, @heroui/styles/css, stylesheet family của grammar, modules/brand/brand.css, rồi `@source`.",
    fixVi: "Sắp lại `@import` theo thứ tự chuẩn và bỏ import ngoài danh sách; `@source` đặt sau cùng.",
  },
}
